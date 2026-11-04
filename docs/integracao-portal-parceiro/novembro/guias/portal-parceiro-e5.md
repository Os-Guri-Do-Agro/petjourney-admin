<!-- doc cmvu1cg6ltrktacemiip · "Handoff E5-01: portal-parceiro-e5.md" · atualizado 2026-10-30T13:33:25.818Z · card PJ-7G0NQI -->

# Guia do front: Portal do parceiro, E5 (internação)

**Para:** o Luís. Portal web do parceiro (`petjourney-admin`). O app (`petjourney-app`) não ganha tela nesta etapa.
**Backend:**
- E5-01a (leitos, internar, mudar de leito, gravidade, previsão, detalhe, vagas da recepção, bloco `internados` do Meu dia e `PET_INTERNADO` no pedido online) pronta e validada em dev em 2026-10-28: unit, integração contra o Postgres de dev e smoke por HTTP (`npx tsx scripts/smoke-internacao.ts`). **Não está em produção.**
- E5-01b (mapa com urgência, encerrar com alta, óbito e transferência, linha do tempo) pronta em dev em 2026-10-28, **depois da auditoria** (ainda não no `develop`). Seções 9 a 11. A 01a e a 01b vão juntas ao master: uma internação que não fecha é leito preso.

**Spec de origem:** `docs/specs/2026/q4/q4-1/portal-parceiro/e5-internacao/01-leitos-e-internacao.md` (decisões do gerente de 2026-10-28, P1 a P13).

**Contrato:** `contrato/openapi.json`; gere os tipos dele. Convenções iguais às da onda 0 ([portal-parceiro-e0.md](portal-parceiro-e0.md), seção 1): envelope `{ statusCode, message, data }`; erro com `codigo` (para decidir a tela) e `message` localizada (para mostrar); `?parceiroId=` quando o usuário tem mais de um parceiro; datas de saída em ISO com o offset do fuso da clínica.

---

## 1. Quem entra

Todas as rotas exigem o módulo **Clínica** (sem ele: 403 `MODULO_INATIVO`; suspenso: lê, mas a escrita dá 403 `MODULO_SOMENTE_LEITURA`). Sem a permissão: 403 `SEM_PERMISSAO` com `permissao`.

| O quê | Permissão | Quem tem |
|---|---|---|
| Cadastro de leitos (listar, criar, editar, reativar, apagar) | `estabelecimento.editar` | DONO, GESTOR |
| **Desativar** leito (P11) | `estabelecimento.editar` **ou** `internacao.executar` | DONO, GESTOR, VETERINÁRIO, ENFERMAGEM |
| Internar e editar o caso (PATCH) | `internacao.prescrever`, **com CRMV** | DONO e VETERINÁRIO com CRMV em dia (sem: 403 `CRMV_OBRIGATORIO`) |
| Mudar de leito, gravidade, previsão de alta | `internacao.executar` | DONO, VETERINÁRIO, ENFERMAGEM |
| Detalhe da internação e mapa | `prontuario.ler` | DONO, VETERINÁRIO, ENFERMAGEM |
| Encerrar (alta, óbito, transferência) | `internacao.prescrever`, **com CRMV** | DONO e VETERINÁRIO com CRMV em dia |
| Encerramento administrativo (só sem veterinário apto) | `estabelecimento.editar` | DONO, GESTOR |
| Vagas ("tem vaga?") | `agenda.ler` | inclui a RECEPÇÃO |

A RECEPÇÃO só enxerga as **vagas** (contagens, sem paciente). O GESTOR cadastra leitos, mas não interna nem lê o detalhe. Esconda os botões pelo `GET /parceiro/portal/eu`.

**Recurso de outra clínica ou id que não existe:** 403 `OWNERSHIP_FORBIDDEN`, sempre o mesmo corpo (vale para leito, sala, paciente, internação, atendimento e profissional).

Todas as ações têm limite de 300 por hora por pessoa e as leituras, 1200 por hora: 429 `INTERNACAO_TAXA_EXCEDIDA` com `tenteDeNovoEmSegundos`.

---

## 2. Leitos

Base: `/parceiro/portal/clinica/leitos`. Substitui `criarLeito`, `editarLeito`, `desativarLeito`, `reativarLeito` e `removerLeito` do `internacao-repository.ts`, e as regras `impedimentoParaDesativar`, `impedimentoParaRemover`, `impedimentoParaNomear`, `proximoNomeDeLeito` de `domain/internacao.ts` (a API decide; o front só mostra o motivo).

| Rota | Corpo | Resposta |
|---|---|---|
| `GET /leitos` | | `{ itens: LeitoDto[], nomeSugerido: { GERAL, FELINO, ISOLAMENTO, UTI }, limite: 100 }` |
| `POST /leitos` | `{ salaId, nome, kind }` | 201 `LeitoDto`. Aceita `Idempotency-Key` |
| `PATCH /leitos/:id` | `{ nome?, kind?, salaId? }` | `LeitoDto`. `null` dá 400 |
| `POST /leitos/:id/desativar` | `{ motivo, detalhe? }` | `LeitoDto`. Já inativo: 200 sem mudar nada |
| `POST /leitos/:id/reativar` | | `LeitoDto`. Já ativo: 200 |
| `DELETE /leitos/:id` | | 204 |

- `LeitoDto`: `{ id, nome, kind, salaId, salaNome, ativo, motivoInativo, detalheInativo, inativoDesde, jaRecebeuPaciente, ocupado, podeApagar }`. `ocupado` diz que há paciente, **sem dizer qual** (o cadastro não exige `prontuario.ler`).
- `kind`: `GERAL`, `FELINO`, `ISOLAMENTO`, `UTI` (o `LeitoKind` do mock em maiúsculas).
- `motivo` de desativar: `MANUTENCAO`, `DESINFECCAO`, `REFORMA`, `EQUIPAMENTO`, `OUTRO`. Com `OUTRO`, `detalhe` é obrigatório (até 200 caracteres; sem ele, 400).
- `nomeSugerido`: o próximo nome livre de cada tipo (R3, F1, I1, UTI, UTI 2). Use para preencher o campo; não recalcule no front.
- O leito só fica em sala de tipo **INTERNACAO** e ativa (as salas são da configuração da agenda, E3-01).

Erros:
- 409 `LEITO_NOME_EM_USO`: nome repetido na clínica, ignorando maiúsculas e espaços das pontas, inclusive entre os inativos.
- 409 `LEITOS_NO_LIMITE` (`limite: 100`).
- 409 `SALA_NAO_E_DE_INTERNACAO` (`reason`: `TIPO` ou `INATIVA`).
- 409 `LEITO_OCUPADO`: desativar, ou mudar o tipo ou a sala, de leito com paciente. A mensagem já diz o que fazer ("mude o paciente de leito ou encerre a internação antes").
- 409 `LEITO_COM_HISTORICO`: apagar leito que já recebeu paciente. Ofereça **desativar** no lugar (use `podeApagar` para decidir qual botão mostrar).

Na configuração das salas (E3-01): desativar uma sala de internação, ou mudar o tipo dela, com paciente num leito dela dá 409 `SALA_COM_LEITO_OCUPADO`.

---

## 3. Internar

`POST /parceiro/portal/clinica/internacoes` (aceita `Idempotency-Key`: o duplo toque com a mesma chave devolve a mesma internação; sem chave, o segundo leva 409 `PACIENTE_JA_INTERNADO`).

```json
{
  "pacienteId": "...",
  "leitoId": "...",
  "motivo": "Pós-operatório de fratura",
  "gravidade": "ATENCAO",
  "pesoEntradaKg": 12.4,
  "diagnosticoDeTrabalho": "Fratura de fêmur",
  "atendimentoId": "...",
  "responsavelProfissionalId": "...",
  "entradaEm": "2026-10-28T09:30:00-03:00",
  "altaPrevistaEm": "2026-10-30T12:00:00-03:00",
  "observacao": "Interna da clínica",
  "confirmarAvisos": ["GATO_EM_LEITO_COMUM"],
  "confirmarPesoKg": 12.4
}
```

- Obrigatórios: `pacienteId`, `leitoId`, `motivo` (até 300), `gravidade` (`ESTAVEL`, `ATENCAO`, `CRITICO`), `pesoEntradaKg` (0,01 a 999,99, até 2 casas).
- `atendimentoId`: a consulta de origem, que tem de ser **do mesmo paciente** (de outro paciente: 403). Sem ele, o paciente chegou de fora.
- `responsavelProfissionalId`: o veterinário responsável pelo caso (padrão: quem interna). Outro veterinário precisa de CRMV em dia (403 `CRMV_OBRIGATORIO` com `campo: responsavelProfissionalId`).
- `entradaEm` (P3): opcional, até 24 h para trás, nunca antes da consulta de origem nem no futuro (400 `INTERNACAO_DATA_INVALIDA` com `campo` e `reason`: `ANTES_DE_24H`, `NO_FUTURO`, `ANTES_DO_ATENDIMENTO`). Padrão: agora.
- `altaPrevistaEm`: depois da entrada e de agora, até 60 dias da entrada (`reason`: `ANTES_DA_ENTRADA`, `NO_PASSADO`, `DEPOIS_DE_60_DIAS`).
- O **peso de entrada não muda o cadastro** do paciente (P7). Ele é a base das doses do plantão (E5-02).
- Nome e CRMV de quem internou vêm do cadastro do profissional, nunca do corpo.

Avisos que pedem confirmação (o usuário confirma e o front reenvia o mesmo corpo com a confirmação):
- 409 `LEITO_INCOMPATIVEL` com `avisos` e `exigeConfirmacao: true`. Hoje só dois: `GATO_EM_LEITO_COMUM` (gato em leito que não é FELINO) e `NAO_GATO_EM_LEITO_FELINO`. Reenvie com `confirmarAvisos: [<os avisos>]`. Isolamento e UTI não geram aviso nesta versão (P8).
- 409 `PESO_DIVERGENTE` com `ultimoPesoKg`, `informadoKg` e `exigeConfirmacao: true`: o peso foge mais de 50% do último peso do cadastro (um 25 no lugar de 2,5). Mostre os dois números e peça para a pessoa **redigitar** o peso; reenvie com `confirmarPesoKg` igual ao `pesoEntradaKg` (diferente dele, o 409 volta). Um "sim" não basta: quem digitou 25 no lugar de 2,5 confirmaria o erro.

Recusas:
- 409 `PACIENTE_JA_INTERNADO`, `PACIENTE_INATIVO`, `PACIENTE_COM_OBITO`, `CADASTRO_MESCLADO` (com `mescladoEmId`), `ATENDIMENTO_ANULADO`.
- 409 `LEITO_INDISPONIVEL` com `reason`: `INATIVO`, `OCUPADO`, `SALA_INATIVA`, `SALA_NAO_E_DE_INTERNACAO`. Recarregue a lista de leitos e peça outro.

Resposta: 201 `InternacaoDto` (seção 4).

---

## 4. Detalhe e o que muda durante a internação

`GET /parceiro/portal/clinica/internacoes/:id` devolve `InternacaoDto` em qualquer status: a internação encerrada continua legível, com `encerrada: true`.

`InternacaoDto`: `{ id, status, encerrada, paciente: { id, nome, especie }, leito: { id, nome, kind }, responsavel: { id, nome }, internadoPor: { id, nome }, atendimentoId, motivo, diagnosticoDeTrabalho, observacao, entradaEm, altaPrevistaEm, encerradaEm, altaEm, gravidade, gravidadeNaEntrada, pesoEntradaKg, horasInternado, orientacaoDeSaida, avisadoPorTelefone, mudancasDeLeito[], mudancasDeGravidade[], mudancasTruncadas }`.

Diferenças em relação ao mock (`types.ts`):
- `status`: `INTERNADO`, `ALTA`, `OBITO`, `TRANSFERIDO` (maiúsculas).
- **`encerradaEm`** é o instante de qualquer desfecho (P9). `altaEm` só vem preenchido quando o desfecho é `ALTA` (compatibilidade com o mock); use `encerradaEm`.
- `avisadoPorTelefone` é **objeto** `{ em, por: { id, nome } }` ou `null`, não booleano (óbito e transferência).
- `responsavelId` do mock virou `responsavel: { id, nome }`; `encounterId` virou `atendimentoId`; `diagnostico` virou `diagnosticoDeTrabalho`.
- Não há id de usuário na resposta; quem internou é o profissional (`internadoPor`).
- `mudancasDeLeito` e `mudancasDeGravidade`: as 50 mais recentes, da mais nova, com `mudancasTruncadas`.

| Rota | Permissão | Corpo | Nota |
|---|---|---|---|
| `PATCH /internacoes/:id` | `internacao.prescrever` | `{ diagnosticoDeTrabalho?, observacao?, responsavelProfissionalId? }` | `null` limpa diagnóstico e observação; o responsável não aceita `null` |
| `POST /internacoes/:id/mudar-leito` | `internacao.executar` | `{ paraLeitoId, motivo?, confirmarAvisos? }` | O leito de origem fica livre na hora |
| `POST /internacoes/:id/gravidade` | `internacao.executar` | `{ gravidade }` | A mesma gravidade: 200 com `semMudanca: true`, nada gravado |
| `POST /internacoes/:id/previsao-de-alta` | `internacao.executar` | `{ altaPrevistaEm: string \| null }` | `null` limpa; o campo é obrigatório no corpo |

Erros comuns a estas rotas: 409 `INTERNACAO_ENCERRADA` (a internação já terminou); em mudar de leito, 409 `LEITO_IGUAL`, `LEITO_INDISPONIVEL` (`reason`, inclusive `INTERNACAO_MUDOU` quando outra pessoa mudou o leito antes: recarregue) e `LEITO_INCOMPATIVEL`.

Encerrar: seção 10.

---

## 5. Vagas da recepção (P4)

`GET /parceiro/portal/clinica/internacao/vagas` (`agenda.ler`): `{ porKind: [{ kind, livres, ocupados, inativos }], livres, ocupados, inativos }`. Os quatro tipos vêm sempre, na mesma ordem (GERAL, FELINO, ISOLAMENTO, UTI). Nenhum dado de paciente. É a resposta para "tem vaga?" ao telefone.

---

## 6. Bloco `internados` do Meu dia (E3-08)

`GET /parceiro/portal/clinica/meu-dia` agora traz `blocos.internados` para quem tem `prontuario.ler`, e `internados` **saiu** de `blocosIndisponiveis`. A recepção não recebe o bloco (ausente, não zero).

- Itens: os internados que **cobram ação**, do escopo (PROFISSIONAL: os casos de que ele é o responsável; CLINICA: todos), até 20, ordenados por urgência.
- Cobra ação: dose atrasada ou nos próximos 60 minutos, boletim retido, previsão de alta vencida ou para hoje. Até a E5-02 (doses) e a E5-03 (boletins) entrarem, só a previsão de alta conta; o bloco vai aparecer quase sempre vazio, e isso é esperado.
- Campos novos no item (`ItemDoPainelDto`): `leitoNome`, `gravidade` e `urgencia` (`NENHUMA`, `ATENCAO`, `URGENTE`). O `id` é o da internação; `quando` é a entrada. Pinte o cartão pela **urgência**, nunca pela gravidade (decisão do doc 07).

---

## 7. Paciente internado em outras telas

- Inativar o paciente (inclusive por óbito), juntar dois cadastros internados ou atender o pedido de exclusão do titular com o paciente internado dá 409 **`PACIENTE_INTERNADO`** (P2), com a mensagem "O paciente está internado. Encerre a internação antes.". Na justificativa de falta com motivo óbito, o mesmo 409. Se o animal morreu internado, o óbito se registra no encerramento da internação (E5-01b).
- Juntar um cadastro internado num cadastro inativo ou com óbito dá 409 `PACIENTE_INATIVO` ou `PACIENTE_COM_OBITO`.
- Juntar um cadastro internado com outro não internado move a internação para o cadastro que fica.

## 8. App (sem tela nova)

`POST /tutor/clinica/pedidos` (e os dias) com um pet internado naquela clínica dá 409 `PET_INTERNADO` (a copy já está no catálogo). O corpo não traz leito, motivo nem data. Só o dono atual do pet recebe esse código: a família continua levando `SOMENTE_LEITURA` antes, e quem não é dono, o 403 de sempre. **Nenhum tipo de notificação novo** nesta etapa (nada a acrescentar em `rotas-notificacao.ts`).

---

## 9. Mapa de leitos (E5-01b)

`GET /parceiro/portal/clinica/internacao/mapa` (`prontuario.ler`). Substitui `mapa` e `mapaDeLeitos` do `internacao-repository.ts` e a ordenação da pauta (`internacao.vue`): a API decide a urgência.

`MapaDto`: `{ leitos: CelulaDoMapaDto[], porUrgencia: string[], vagas: VagasPorKindDto[], cabecalho, geradoEm }`.
- `leitos`: **na ordem do cadastro** (sala, nome), cada um `{ leito: { id, nome, kind, ativo, motivoInativo, salaId, salaNome }, internacao: InternadoDoMapaDto | null }`. O leito vazio e o inativo aparecem (o vazio é a informação que falta numa lista de internados).
- `InternadoDoMapaDto`: `{ id, paciente: { id, nome, especie }, responsavel: { id, nome }, gravidade, urgencia: { nivel, motivos }, sinais: { dosesAtrasadas, minutosDaMaisAtrasada, proximaEmMinutos, boletimRetido }, entradaEm, altaPrevistaEm, altaPrevistaHoje, horasInternado }`.
  - **Pinte o cartão pela `urgencia.nivel`** (`NENHUMA`, `ATENCAO`, `URGENTE`), nunca pela gravidade (doc 07). `motivos`: `BOLETIM_RETIDO`, `DOSES_ATRASADAS`, `DOSE_PROXIMA` (próximos 60 min), `ALTA_PREVISTA_VENCIDA`.
  - **Nenhum texto clínico no mapa** (decisão do gerente na auditoria da 01b: a tela pode ir para a TV do plantão). Motivo, diagnóstico, observação e orientação ficam no detalhe (`GET .../internacoes/:id`). O cartão mostra o nome do animal, o leito, a gravidade e a urgência.
  - Até a E5-02 (doses) e a E5-03 (boletins), `sinais` vem zerado e a urgência só acende pela previsão de alta vencida.
- `porUrgencia`: os ids das internações da mais urgente para a menos (a pauta). Boletim retido primeiro, depois mais doses atrasadas, a mais atrasada, o degrau, e só então a gravidade.
- `cabecalho`: `{ ativos, ocupados, livres, inativos, criticos, cobramAcao }`, para a frase do resumo da ala.
- Faça polling de no máximo 30 s (o limite de leitura é 1200 por hora por pessoa).

## 10. Encerrar a internação (E5-01b)

`POST /parceiro/portal/clinica/internacoes/:id/encerrar` (`internacao.prescrever`, com CRMV). Aceita `Idempotency-Key`: o duplo toque com a mesma chave devolve a internação encerrada, sem o bloco `encerramento`.

```json
{
  "desfecho": "OBITO",
  "orientacao": "Conversamos com a família sobre a cremação e os documentos.",
  "ocorreuEm": "2026-10-28T23:50:00-03:00",
  "avisadoPorTelefone": { "em": "2026-10-28T23:55:00-03:00", "porProfissionalId": "..." }
}
```

- `desfecho`: `ALTA`, `TRANSFERIDO`, `OBITO` (nessa ordem na tela: o esperado primeiro, o grave por último). `INTERNADO` dá 400.
- `orientacao`: obrigatória nos três, 10 a 2000 caracteres. Sem ela: 422 `ORIENTACAO_OBRIGATORIA` (com `minimo: 10`). **Na ALTA, com o paciente ligado ao app, ela vai inteira ao app do dono e da família** no boletim de alta (seção 18.2): a tela de alta deve dizer isso perto do campo ("o responsável vai ler este texto no app"). No óbito e na transferência, fica só na clínica.
- `avisadoPorTelefone`: **obrigatório em OBITO e TRANSFERIDO** (quem ligou, um profissional **ativo** da clínica, e quando; desativado ou de outra clínica: 403). Sem ele: 422 `ALTA_SEM_AVISO` com `desfecho`, e nada é gravado. É o contrato do mock com uma diferença: é objeto, não booleano. Hora no futuro ou antes da entrada: 400 `AVISO_POR_TELEFONE_INVALIDO` (`reason`).
- `ocorreuEm`: opcional (padrão agora), entre a entrada e agora (400 `INTERNACAO_DATA_INVALIDA`, `campo: ocorreuEm`). No óbito, o dia civil desse instante no fuso da clínica vira o óbito do paciente: 23h50 registrado às 00h10 grava o dia certo.
- Nome e CRMV de quem encerrou vêm do cadastro, nunca do corpo.

Resposta: `InternacaoDto` encerrada (`encerrada: true`, `encerradaEm`, `orientacaoDeSaida`, `avisadoPorTelefone`) mais `encerramento`:
- `resumo`: `{ horas, feitas, naoFeitas, pendentesAgora, aSuspender, boletinsRetidos, boletinsEnviados }`. `pendentesAgora` e `aSuspender` são contados **separados** (a mesma dose nunca nas duas). Até a E5-02 e a E5-03 entrarem, vêm zerados.
- `avisos`: `DOSE_PENDENTE`, `DOSE_FUTURA`, `BOLETIM_RETIDO`. **Avisos, nunca travas**: mostre antes de confirmar, mas a API não recusa por pendência.
- `obito` (só no OBITO): `{ obitoEm, agendamentosCancelados, vinculosEncerrados }`.

O que cada desfecho faz:
- **ALTA**: encerra. É o único desfecho que pode sair por mensagem ao responsável (o boletim de alta é da E5-03).
- **TRANSFERIDO**: encerra; o paciente segue ativo e com o vínculo.
- **OBITO**: encerra e, na mesma operação, registra o óbito no cadastro: o paciente fica inativo, o vínculo com o app se encerra sem aviso, a agenda dele do dia do óbito em diante é cancelada sem aviso, e ele sai da fila de espera e dos pedidos online. **Nada é enviado ao responsável** (o aviso foi a ligação).

Erros: 409 `INTERNACAO_ENCERRADA` (já encerrada), 409 `INTERNACAO_ALTERADA` (o paciente foi juntado a outro cadastro enquanto encerrava: recarregue), 403 `CRMV_OBRIGATORIO`.

Depois do encerramento, o leito fica livre na hora, e as telas que davam 409 `PACIENTE_INTERNADO` (inativar, juntar, exclusão a pedido do titular) voltam a funcionar.

## 11. Linha do tempo do paciente (E5-01b)

`GET /parceiro/portal/pacientes/:id/linha-do-tempo` ganhou o tipo `INTERNACAO` (com `prontuario.ler`; a recepção não vê). O item é curto: `titulo: "INTERNACAO"`, `situacao` = o status (`INTERNADO`, `ALTA`, `OBITO`, `TRANSFERIDO`), `em` = a entrada, `profissionalNome` = o responsável pelo caso. O motivo e o diagnóstico abrem pelo detalhe (`GET .../internacoes/:id`). Traduza o título no front.

## 12. Encerramento administrativo (decisão 14 do gerente)

`POST /parceiro/portal/clinica/internacoes/:id/encerrar-administrativo` (`estabelecimento.editar`: DONO ou GESTOR; não exige CRMV). Aceita `Idempotency-Key`.

- Só vale quando a clínica **não tem nenhum veterinário ativo com CRMV em dia**. Havendo um, 409 `ENCERRAMENTO_ADMINISTRATIVO_COM_VETERINARIO` ("quem encerra é o veterinário"). Mostre o botão só para quem tem a permissão e explique a regra; a API confere de novo na hora.
- Corpo: `{ "motivo": "..." }`, de 20 a 500 caracteres (fora disso: 400). Nada de orientação clínica, aviso por telefone ou óbito.
- Resposta: `InternacaoDto` com `status: "ENCERRAMENTO_ADMINISTRATIVO"`, `encerrada: true`, `motivoEncerramentoAdministrativo` preenchido, `orientacaoDeSaida: null`, e o bloco `encerramento` (resumo e avisos; `obito: null`).
- **Se o animal morreu**, registre o óbito pelo cadastro do paciente **depois** do encerramento (`POST /parceiro/portal/pacientes/:id/inativar` com `motivo: OBITO`).
- Nada sai por notificação. O novo status também aparece na linha do tempo (`situacao`) e no detalhe; trate o rótulo no front.

---

## 13. Prescrição de internação (E5-02a)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e5-internacao/02-prescricao-enfermagem-e-plantoes.md`. A E5-02b (checklist, registrar, recusar, desfazer) está na seção 14; a E5-02c (plantões, passagem, evolução) vem depois; esta parte entrega prescrever, listar, suspender, as doses criadas pelo servidor, o sinal real de dose no mapa e o contador.

### 13.1 Prescrever

`POST /parceiro/portal/clinica/internacoes/:id/prescricoes` (`internacao.prescrever`: DONO e VETERINARIO, com CRMV). Aceita `Idempotency-Key` (o duplo toque devolve a mesma prescrição, sem dose nova). **Sem prescrição verbal**: quem prescreve é o veterinário logado, inclusive de fora da clínica, pelo celular. A enfermagem não vê o botão.

```json
{
  "kind": "MEDICAMENTO",
  "medicamentoId": "...",
  "via": "INTRAVENOSA",
  "mgPorKg": 25,
  "frequenciaHoras": 8,
  "primeiroHorario": "2026-10-29T06:00:00-03:00",
  "encerraEm": "2026-11-03T22:00:00-03:00",
  "alergiaConfirmada": false,
  "proibidoConfirmado": false,
  "confirmarDuplicidade": false,
  "substituiPrescricaoId": null,
  "observacao": "Diluir em 10 mL"
}
```

- `kind`: `MEDICAMENTO`, `FLUIDO`, `MONITORAMENTO`, `ALIMENTACAO`, `PROCEDIMENTO`.
- **MEDICAMENTO (P2: dose estruturada, troque o campo de texto do mock)**: `medicamentoId` do catálogo (global revisado ou o da clínica), `via` e `mgPorKg` (até 1000) são obrigatórios. **Não mande peso**: a conta é sempre sobre o peso de entrada da internação (`pesoKg` no corpo dá 400). Não mande `descricao` (o nome vem do catálogo). `mgPorAdministracao`, `quantidade`, `unidade` e `fracao` são opcionais: se a tela mandar a conta dela e não bater com a do servidor, 422 `DOSE_DIVERGENTE` com `calculado`.
- **Os outros tipos**: `descricao` obrigatória (1 a 200), nenhum campo de dose (422 `PRESCRICAO_INVALIDA`, `reason: CAMPO_SO_DO_MEDICAMENTO`, `campo`). Se a descrição citar um fármaco do catálogo ("Dipirona 25 mg/kg IV" como procedimento), a API confere alergia, espécie contraindicada e duplicidade como no medicamento: o mesmo 422 `CONFIRMACAO_PENDENTE` (com `farmacos`), e aqui `alergiaConfirmada`/`proibidoConfirmado` valem.
- **FLUIDO** é contínuo: as linhas são **conferências da bomba**, não doses. Sem `frequenciaHoras`, a conferência é de hora em hora.
- `frequenciaHoras`: de 1 a 168, obrigatória menos no FLUIDO. "De 8 em 8 h" é tempo decorrido: no dia da troca de horário (Londres) o intervalo continua de 8 h.
- `primeiroHorario`: ISO com offset, de 30 min atrás até 7 dias à frente (segundos descartados). Mais de 30 min atrás: 400 `PRESCRICAO_PRIMEIRO_HORARIO_NO_PASSADO` (`toleranciaMinutos`). Mais de 7 dias: 400 `INTERNACAO_DATA_INVALIDA` (`campo: primeiroHorario`, `reason: DISTANTE`).
- `encerraEm`: opcional, a última dose possível (inclusiva), depois do primeiro horário e no máximo 60 dias (400 `INTERNACAO_DATA_INVALIDA`, `reason: ANTES_DO_PRIMEIRO_HORARIO` ou `DURACAO_MAXIMA`). Sem ele, vale até suspender ou encerrar a internação.
- **Confirmações** (422 `CONFIRMACAO_PENDENTE`, nada gravado, com `avisos`, `detalhes`, `dose` e `faixa`; o mesmo diálogo da receita da E4-03):
  - `ALERGIA` e `ESPECIE_PROIBIDA`: mande `alergiaConfirmada`/`proibidoConfirmado`.
  - `DOSE_ARREDONDADA` (auditoria, 28/10): o comprimido não fecha numa fração, ou o mg real sai a mais de 10% da conta. `dose: { mgCalculado, mgReal, aproximado, quantidade, unidade, fracao }`: mostre "o animal recebe X mg (a conta dá Y mg)" e mande `arredondamentoConfirmado: true`. Comprimido cuja conta dá menos da metade de um quarto: 422 `DOSE_MENOR_QUE_UM_QUARTO_DE_COMPRIMIDO`, sem confirmação possível (escolha outra apresentação). mL sai com até 3 casas.
  - `FORA_DA_FAIXA` (auditoria, 28/10): a dose acima da faixa usual (da espécie, ou a geral) ou o bulário sem a espécie. `faixa: { mgKgMin, mgKgMax, origem }`: mande `foraDaFaixaConfirmada: true`. **Acima de 3x o teto**: 422 `DOSE_MUITO_ACIMA_DA_FAIXA` (`mgPorKg`, `faixa`, `limiteMgKg`), sem confirmação possível: confira a dose e a unidade.
  - A copy do `CONFIRMACAO_PENDENTE` é genérica: escolha o texto da tela por `avisos`.
- **Duplicidade**: o mesmo medicamento ou o mesmo princípio ativo (por qualquer grafia: dipirona e metamizol) já ativo, ou o mesmo fluido: 409 `PRESCRICAO_DUPLICADA` com `prescricaoIds` e `exigeConfirmacao: true`. Mande de novo com `confirmarDuplicidade: true` se for intencional.
- **Trocar a dose**: mande `substituiPrescricaoId` (uma ativa desta internação). A antiga é suspensa (**toda** dose pendente dela vira `SUSPENSA`, inclusive a da janela e as atrasadas; motivo do sistema "Dose trocada por uma prescrição nova") e a nova nasce na mesma operação, sem pedir confirmação de duplicidade. A substituída já suspensa ou terminada: 409 `PRESCRICAO_ENCERRADA`.
- **Teto**: 40 prescrições ativas por internação (409 `PRESCRICOES_NO_LIMITE`, `limite`).
- Outros erros: 409 `INTERNACAO_ENCERRADA`, 409 `MEDICAMENTO_INATIVO`, 403 `CRMV_OBRIGATORIO` (sem CRMV em dia; quando a E1-08 entrar, o selo), 403 `OWNERSHIP_FORBIDDEN` (internação, prescrição ou medicamento de outra clínica: o mesmo corpo de inexistente), 429 `INTERNACAO_TAXA_EXCEDIDA`.

Resposta 201 (`PrescricaoDeInternacaoCriadaDto`): a prescrição (13.3) mais
- `peso`: `{ pesoBaseKg, aferidoEm, aferidoHaDias }` (**P10: mostre na tela de prescrever** "12,4 kg, aferido há 2 dias"; não há nova pesagem na v1);
- `dosesCriadas` (até 72 h à frente, completando o dia da clínica: o cron completa de hora em hora);
- `avisos`: `{ codigo, bloqueante, detalhe }` da conta (`ACIMA_DA_USUAL`, `ABAIXO_DA_USUAL`, `SEM_DOSE_DA_ESPECIE`, `CUIDADO`, e os já confirmados);
- `responsabilidade`: a frase "a conta é para conferência; a dose é do veterinário" no idioma dos textos da clínica (mostre perto da dose);
- `substituida`: o id da antiga, quando trocou a dose.

### 13.2 Listar

`GET /parceiro/portal/clinica/internacoes/:id/prescricoes` (`internacao.executar`: a enfermagem lê). `{ internacaoId, encerrada, peso, ativas[], inativas[], inativasTruncado }`. `ativas` (até 40) pela primeira dose; `inativas` (suspensas ou com `encerraEm` passado), as 100 mais recentes. Sem a lista de doses (o checklist é a E5-02b). A recepção recebe 403.

### 13.3 `PrescricaoDeInternacaoDto`

`{ id, internacaoId, kind, medicamentoId, descricao, principioAtivo, via, dose, doseTexto, regime, frequenciaHoras, continuo, primeiroHorario, encerraEm, materializadoAte, prescritoPor: { profissionalId, nome }, prescritoEm, ativa, suspensao, substituiPrescricaoId, observacao, pendentes, proximaEm }`.
- `dose` (só MEDICAMENTO): `{ mgPorKg, pesoKg, mgPorAdministracao, mgReal, quantidade, unidade, fracao, arredondamentoConfirmado, foraDaFaixaConfirmada }`. `mgPorAdministracao` é a conta; `mgReal`, o que o animal recebe (mostre os dois quando diferirem). `doseTexto` é derivado e congelado no idioma da clínica ("meio comprimido, a cada 8 horas, via oral"): use para exibir, nunca para calcular.
- `suspensao`: `{ em, motivo, por: { profissionalId, nome } | null, substituidaPorId }` ou null. No encerramento e na troca de dose, `motivo` é o texto do sistema ("Internação encerrada").
- `pendentes` e `proximaEm`: doses pendentes daqui para a frente (na janela de 30 min ou futuras) e a próxima.
- Datas no fuso da clínica com offset. Nenhum `usuarioId` sai na resposta.

### 13.4 Suspender

`POST /parceiro/portal/clinica/internacoes/:id/prescricoes/:pid/suspender` (`internacao.prescrever`). Corpo `{ "motivo": "..." }` (1 a 300). **Toda dose pendente** vira `SUSPENSA` (a futura, a da janela e a atrasada: a ordem de parar vale já, auditoria de 28/10); as feitas, puladas e recusadas ficam como estão, com quem executou. Dose de prescrição suspensa não se registra mais (o banco recusa) e some do contador e do mapa. Resposta: a prescrição mais `dosesSuspensas` e `semMudanca` (já suspensa: 200 com `semMudanca: true`, nada gravado). `pid` de outra internação ou clínica: 403. Internação encerrada: 409 `INTERNACAO_ENCERRADA` (o encerramento já suspendeu tudo).

### 13.5 O que muda nas telas da E5-01

- **Mapa** (seção 9) e bloco `internados`: `sinais.dosesAtrasadas`, `minutosDaMaisAtrasada` e `proximaEmMinutos` agora vêm das doses reais (a conferência de fluido não entra, P5). O estável com dose atrasada passa na frente do crítico em dia.
- **Encerrar** (seção 10): `resumo.feitas`, `naoFeitas`, `pendentesAgora` e `aSuspender` agora são reais. `pendentesAgora` = pendentes na janela (até 30 min à frente) ou atrasadas; `aSuspender` = as que viriam depois. O encerramento suspende exatamente as `aSuspender`; as atrasadas e as da janela ficam registradas como não dadas (P8), fora dos contadores.
- **Contador novo** em `GET /parceiro/portal/pendencias`: `dosesAtrasadasInternacao` (módulo CLINICA, permissão `internacao.executar`: DONO, veterinário e enfermagem veem; recepção não), tom `RISCO` quando há atrasada, rota `/clinica/internacao`. Acrescente a chave no catálogo de texto do portal. Dose de prescrição suspensa não conta (nem no mapa).

### 13.6 App

Nenhuma tela e **nenhum tipo de notificação novo** (nada em `rotas-notificacao.ts`): a E5-02 não avisa o responsável.

---

## 14. Checklist de enfermagem, registrar, recusar e desfazer (E5-02b)

> **Atenção (29/10):** alguns campos desta seção mudaram na correção da auditoria da E5-02c. A seção 16 manda sobre o texto abaixo.

Mesma spec da seção 13. Todas as rotas exigem `internacao.executar` (DONO, VETERINARIO e ENFERMAGEM; recepção, gestor e cuidador do hotel recebem 403 `SEM_PERMISSAO`) e o módulo CLINICA. Datas no fuso da clínica com offset. Nenhum `usuarioId` sai na resposta.

### 14.1 Checklist da internação

`GET /parceiro/portal/clinica/internacoes/:id/checklist?de=&ate=` (ISO com offset, inclusivos). Sem `de`/`ate`: de 12 h atrás a 12 h à frente. Só uma ponta: a outra fica a 24 h dela. Janela máxima de 48 h (400 `CHECKLIST_PERIODO_INVALIDO` com `maxHoras: 48`); `ate` antes de `de`, ou igual: o mesmo 400 com `reason: ANTES_DO_INICIO`. Internação de outra clínica ou inexistente: 403 `OWNERSHIP_FORBIDDEN` (o mesmo corpo). A internação encerrada continua legível (`encerrada: true`) e nada se registra nela.

Resposta `ChecklistDaInternacaoDto`: `{ internacaoId, encerrada, de, ate, agora, linhaDoAgora, truncado, contagens, plantao, grupos[] }`.
- `grupos`: `{ hora, itens[] }`, a hora cheia no fuso da clínica, em ordem. Desenhe a linha "agora" no grupo `linhaDoAgora`.
- `truncado`: mais de 600 linhas na janela (estreite o período).
- `contagens`: `{ dosesAtrasadas, conferenciasAtrasadas, naJanela }` (a conferência de fluido conta à parte, P5).
- `plantao`: `{ id, fimPrevisto, vencido }` ou null. `vencido`: passou do fim previsto e ninguém entregou; **não bloqueia o registro** (P6), mostre só o aviso.
- Cada item (`DoseDaInternacaoDto`): `{ id, internacaoId, prescricaoId, previstaPara, conferencia, status, situacao, atrasoMinutos, motivo, executadaEm, registradaEm, executadaPor: { profissionalId, nome } | null, turnoId, atribuidaA, atravessaAPassagem, descricao, kind, via, doseTexto, frequenciaHoras, observacao }`.
  - `situacao` em minúsculas: `futura`, `na-janela` (30 min para cada lado do horário), `atrasada`, `feita`, `pulada`, `recusada`, `suspensa`. **É lida na hora, nunca gravada**: o atraso não é um registro. Para atualizar a tela, leia de novo (sugestão: a cada minuto com a aba visível).
  - `conferencia: true` é a conferência da bomba de fluido, não dose (o botão diz "conferi", não "dei").
  - `atravessaAPassagem`: a janela da dose encosta na troca de plantão (marque na tela).
  - `atribuidaA` fica null até a E5-02c (passagem de plantão).

### 14.2 Checklist do plantão inteiro (P3)

`GET /parceiro/portal/clinica/internacao/checklist?de=&ate=`: todas as internações em curso da clínica, numa lista só (a enfermagem não trabalha internação por internação). Sem `de`/`ate`: o plantão da grade em que estamos (manhã 07 às 13, tarde 13 às 19, noite 19 às 07, no fuso da clínica). Só uma ponta: a outra fica à distância do tamanho desse plantão. Janela máxima de 12 h (`maxHoras: 12`). Mesmo envelope, sem `internacaoId`/`encerrada`; cada item (`DoseDoPlantaoDto`) leva `paciente: { id, nome, especie, leitoNome }` e **não leva `observacao`** (texto interno fica só no checklist da internação). Internação encerrada não aparece.
- **A dose atrasada nunca some (auditoria da E5-02b, 28/10):** além da janela, a lista traz as doses e conferências PENDENTE atrasadas de até 12 h antes de `de` (as de antes do plantão), a partir de `atrasadasDesde`. Elas vêm primeiro, com `situacao: atrasada`.
- `contagens` (`ContagensDoPlantaoDto`): `dosesAtrasadas` aqui é **a mesma conta do contador geral** `dosesAtrasadasInternacao` (os dois números batem), e `atrasadasForaDaLista` diz quantas atrasadas não couberam na lista (mais antigas que `atrasadasDesde`, ou cortadas por `truncado`). Com `atrasadasForaDaLista > 0`, mostre "N doses atrasadas há mais tempo: abra a internação".

### 14.3 Registrar (dar, pular, recusar)

`POST /parceiro/portal/clinica/administracoes/:id/registrar` (200). **Mande `Idempotency-Key`**: o duplo toque devolve a mesma dose, um evento só.

```json
{ "status": "PULADA", "motivo": "JEJUM", "observacao": "Jejum para o ultrassom", "executadaEm": "2026-10-28T14:05:00-03:00" }
```

- `status`: `FEITA`, `PULADA` (não foi dada) ou `RECUSADA` (o animal recusou ou cuspiu). Recusa e pulo são coisas diferentes na tela e no histórico.
- `motivo` (`MotivoNaoAdministrada`): `RECUSOU`, `CUSPIU_OU_VOMITOU`, `JEJUM`, `PROCEDIMENTO_EM_CURSO`, `ORDEM_VETERINARIA`, `SEM_ESTOQUE`, `OUTRO`. Obrigatório em PULADA e RECUSADA; `OUTRO` exige `observacao`. Em FEITA não mande (400 `MOTIVO_OBRIGATORIO`, `reason: SO_NA_NAO_DADA`). Falta: 400 `MOTIVO_OBRIGATORIO` com `campo`.
- **Conferência de fluido**: FEITA ("conferi") ou PULADA com `observacao` (sem motivo). RECUSADA: 422 `PRESCRICAO_INVALIDA`, `reason: CONFERENCIA_NAO_SE_RECUSA`.
- `observacao`: até 300 caracteres, interna.
- `executadaEm`: para registrar depois do fato, de 12 h atrás até agora (400 `INTERNACAO_DATA_INVALIDA`, `campo: executadaEm`, `reason: NO_FUTURO`, `ANTIGA_DEMAIS` ou `ANTES_DA_PRESCRICAO`). Ausente: agora.
- **Quem deu vem do login**, nunca do corpo (`executadaPorProfissionalId` no corpo dá 400). Quem não tem ficha de profissional na clínica: 403 `PROFISSIONAL_OBRIGATORIO` (peça para cadastrar a ficha na equipe).
- **Dose adiantada (P12)**: mais de 30 min antes do horário: 409 `DOSE_FORA_DA_JANELA` com `antecipadaMinutos`, `toleranciaMinutos` e `exigeConfirmacao: true`. Mande de novo com `confirmarAntecipada: true` **e** `observacao`.
- **Dose dobrada**: outra dose FEITA do mesmo fármaco a menos de metade do intervalo: 409 `INTERVALO_CURTO_ENTRE_DOSES` com `outraEm`, `frequenciaHoras` e `exigeConfirmacao: true`. Mostre "a dose anterior foi às X" e mande `confirmarIntervalo: true` só se for intencional. "Mesmo fármaco" (auditoria da E5-02b) é a mesma prescrição, a que ela substituiu (trocar a dose não zera o intervalo: dose das 14:00, troca às 14:05, a nova das 14:10 pede confirmação) e outra prescrição do mesmo princípio ativo na internação, mesmo suspensa. No registro retroativo (`executadaEm` no passado), o intervalo é conferido também contra o agora. Duas doses vizinhas registradas ao mesmo tempo: uma passa e a outra recebe este 409.
- **Já registrada** (duas pessoas na mesma dose, ou a segunda tentativa sem a chave): 409 `DOSE_JA_REGISTRADA` com `status`, `em` e `porNome` ("Dra. Ana registrou às 14:05"). Recarregue o checklist.
- **Não se registra**: dose de prescrição suspensa (ou a própria dose suspensa): 409 `PRESCRICAO_ENCERRADA`, `reason: SUSPENSA`; internação encerrada: 409 `INTERNACAO_ENCERRADA`. O banco também recusa.
- Dose de outra clínica ou inexistente: 403 `OWNERSHIP_FORBIDDEN`. 429 `INTERNACAO_TAXA_EXCEDIDA`.
- **Plantão**: o primeiro registro sem plantão aberto abre um plantão automático da grade (manhã, tarde ou noite); a resposta traz `turnoId`. A tela de plantões é a E5-02c.

- **A mesma `Idempotency-Key` depois de um desfazer** (ou com a dose registrada de novo por outra pessoa, ou com outro status): 409 `REGISTRO_DESFEITO` com `status` (o atual). Recarregue o checklist; nunca trate como sucesso.

Resposta `DoseRegistradaDeInternacaoDto`: o item da 14.1 mais `semMudanca` (false aqui).

### 14.4 Desfazer

`POST /parceiro/portal/clinica/administracoes/:id/desfazer` (200, sem corpo). A dose volta a pendente e o histórico guarda o registro e o desfazer (registrar, desfazer e registrar de novo deixam três eventos).
- Só **quem registrou**, **no mesmo plantão** e **em até 12 h**: 403 `DESFAZER_NEGADO`, `reason: OUTRO_AUTOR`, `OUTRO_PLANTAO` ou `PRAZO` (com `limiteHoras: 12`). Com o plantão automático (ninguém assumiu) ou vencido, "mesmo plantão" é o da grade (manhã, tarde, noite): o registro das 12:50 não se desfaz às 13:10. Mostre o botão só na dose do próprio usuário dentro dessas condições; depois disso o caminho é a evolução (E5-02c).
- Quem desfaz precisa de ficha de profissional ativa, como no registrar: 403 `PROFISSIONAL_OBRIGATORIO`.
- Dose ainda pendente: 200 com `semMudanca: true`, nada gravado.
- Dose de prescrição suspensa depois do registro, ou dose suspensa: 409 `PRESCRICAO_ENCERRADA`, `reason: SUSPENSA` (não há mais o que dar). Internação encerrada: 409 `INTERNACAO_ENCERRADA`.

### 14.5 Erros novos (6 locales)

`DOSE_JA_REGISTRADA`, `DOSE_FORA_DA_JANELA`, `INTERVALO_CURTO_ENTRE_DOSES`, `DESFAZER_NEGADO`, `MOTIVO_OBRIGATORIO`, `PROFISSIONAL_OBRIGATORIO`, `CHECKLIST_PERIODO_INVALIDO` e, da auditoria, `REGISTRO_DESFEITO`. Os 409 com `exigeConfirmacao: true` abrem diálogo; os demais são aviso. A copy de `INTERVALO_CURTO_ENTRE_DOSES` ("uma dose deste medicamento") e de `DESFAZER_NEGADO` (com o prazo de 12 horas) mudou.

### 14.6 App

Nenhuma tela e nenhum tipo de notificação novo.

---

## 15. Plantões, passagem e evolução (E5-02c)

> **Atenção (29/10):** alguns campos desta seção mudaram na correção da auditoria da E5-02c. A seção 16 manda sobre o texto abaixo.

Mesma spec. Todas as rotas exigem `internacao.executar` (DONO, VETERINARIO, ENFERMAGEM) e o módulo CLINICA; quem assume, entrega ou evolui precisa de ficha de profissional ativa (403 `PROFISSIONAL_OBRIGATORIO`). Um plantão aberto por clínica na internação; o do hotel é outro contexto (as rotas daqui dão 403 nele). Grade fixa por enquanto (P7): manhã 07 às 13, tarde 13 às 19, noite 19 às 07, no fuso da clínica.

### 15.1 Plantão atual

`GET /parceiro/portal/clinica/turnos/atual`. `PlantaoAtualDaInternacaoDto`: `{ agora, atual, sugerido, pendencias[], pendenciasTruncado, passagemRecebida }`.
- `atual` (`PlantaoDaInternacaoDto`): `{ id, kind, inicio, fimPrevisto, origem (ASSUMIDO | RECEBIDO | AUTOMATICO), responsavel: { profissionalId, nome }, vencido, entregueEm, turnoAnteriorId }`. `vencido: true` (passou do fim e ninguém entregou) **não bloqueia nada** (P6): mostre o aviso e o botão de entregar.
- Sem plantão aberto: `atual: null` e `sugerido: { kind, inicio, fimPrevisto }` (o da grade de agora), com o botão "Assumir plantão". O primeiro registro de dose ou evolução sem plantão abre um AUTOMATICO com quem registrou.
- `pendencias` (lidas agora, até 300): as PENDENTE das internações em curso, das atrasadas de até 12 h ao fim do plantão: `{ administracaoId, internacaoId, previstaPara, situacao (futura | na-janela | atrasada), conferencia, descricao, paciente: { id, nome, especie, leitoNome }, atribuidaA, exigeDonoNaPassagem }`. `exigeDonoNaPassagem: true` é a dose em cima da troca (a janela de 30 min contém o agora): a tela de entregar pede um dono para cada uma.
- `passagemRecebida`: a lista congelada que o plantão anterior entregou, `{ turnoId, entregueEm, entreguePor, nota, pendencias[] }`, cada pendência `{ administracaoId, previstaPara, descricao ("Rex (L3): Dipirona 500 mg/mL"), situacaoNaEntrega, atribuidaA, statusAgora }`. **A lista não muda depois** (AC5): `situacaoNaEntrega` é a do instante da entrega; `statusAgora` é o status da dose agora, lido à parte (mostre "resolvida" quando não for mais PENDENTE).

### 15.2 Assumir

`POST /parceiro/portal/clinica/turnos/assumir` (201, sem corpo, aceita `Idempotency-Key`). Abre o plantão da grade com quem assume como responsável; faltando menos de 1 h para o da grade acabar, abre o seguinte (quem chega 18:30 assume a noite). Com um aberto: 409 `PLANTAO_JA_ABERTO` com `turnoId` (a troca de mãos é pela passagem). Dois assumir ao mesmo tempo: um abre, o outro recebe esse 409.

### 15.3 Entregar (a passagem, D5)

`POST /parceiro/portal/clinica/turnos/:id/entregar` (200, aceita `Idempotency-Key`).

```json
{ "recebidoPorId": "<profissional>", "nota": "Rex com dor leve; dipirona das 14:00 com a Bia.", "atribuicoes": [{ "administracaoId": "...", "profissionalId": "..." }] }
```

- `recebidoPorId`: profissional ativo desta clínica (outra clínica ou inexistente: 403 `OWNERSHIP_FORBIDDEN`), diferente do responsável (409 `PASSAGEM_PARA_SI_MESMO`). Ele vira o responsável do plantão seguinte.
- `nota`: obrigatória, até 1000 caracteres.
- `atribuicoes` (até 300): quem fica com cada dose. **Obrigatória para cada dose em cima da troca sem dono**: sem ela, 409 `DOSE_SEM_DONO_NA_PASSAGEM` com `administracaoIds` (até 50) e `total`; mostre as doses e peça o dono. Dose de outra clínica ou profissional de fora: 403. Dose que não está mais pendente (dada, suspensa, internação encerrada): 422 `ATRIBUICAO_INVALIDA` (`reason: NAO_PENDENTE`, `administracaoIds`); a mesma dose para duas pessoas: `reason: DUPLICADA`.
- As **atrasadas não travam**: entram na lista congelada com quem recebe como dono.
- Quem entrega: o responsável do plantão. O DONO também, com o plantão vencido ou com o responsável sem ficha ativa (P6); os outros: 403 `PASSAGEM_NEGADA` (`reason: NAO_E_O_RESPONSAVEL`, `vencido`).
- O plantão já entregue (a segunda entrega ao mesmo tempo, a tela velha): 409 `PLANTAO_ENCERRADO`. Mais de 300 pendências para congelar: 409 `PASSAGEM_GRANDE_DEMAIS` (`limite`): resolva as atrasadas ou peça ao veterinário para suspender o que não vale.
- Uma dose registrada no meio da entrega cai no plantão novo (nunca fica sem plantão).

Resposta `EntregaDoPlantaoDto`: `{ entregue, novo (origem RECEBIDO), pendenciasCongeladas, atribuicoes }`.

### 15.4 Evolução

`POST /parceiro/portal/clinica/internacoes/:id/evolucoes` (200). Uma por plantão: a segunda no mesmo plantão reescreve (`reescrita: true`).

```json
{ "vitais": { "temperatura": { "valor": 38.6, "naoAferido": false } }, "observado": "Comeu metade", "avaliacao": "Dor controlada", "plano": "Manter", "gravidade": "ATENCAO", "evolucaoId": null }
```

- `vitais`: o mesmo `VitaisDto` do exame físico (as mesmas faixas, casas e `naoAferido`); valor impossível ou `naoAferido` com valor: 400.
- `observado`, `avaliacao`, `plano`: opcionais, até 1000 caracteres cada, **internos** (nada sai para o responsável).
- `gravidade`: obrigatória. Diferente da atual, muda a gravidade da internação na mesma operação (`gravidadeMudou: true`, entra no histórico de gravidade e é a fonte do boletim da E5-03).
- Só o autor ou o responsável do plantão reescrevem: 409 `EVOLUCAO_CONGELADA` (`reason: OUTRO_AUTOR`).
- **Depois da passagem a evolução antiga congela**: mande o `evolucaoId` que a tela está editando; se ele for de um plantão entregue, 409 `EVOLUCAO_CONGELADA` (`reason: PLANTAO_ENTREGUE`) e nada é criado. Sem `evolucaoId`, a evolução vai para o plantão aberto.
- Internação encerrada: 409 `INTERNACAO_ENCERRADA`. Outra clínica: 403.

Resposta `EvolucaoSalvaDto`: `{ id, internacaoId, plantao: { id, kind, inicio, entregueEm }, profissional: { profissionalId, nome }, registradoEm, atualizadoEm, vitais, observado, avaliacao, plano, gravidade, congelada, gravidadeMudou, reescrita }`.

`GET /parceiro/portal/clinica/internacoes/:id/evolucoes?cursor=`: `{ itens[], proximoCursor }`, mais recentes primeiro, 50 por página; `congelada: true` nas de plantão entregue. Cursor inválido: 400 `CURSOR_INVALIDO`.

### 15.5 Erros novos (6 locales)

`PLANTAO_JA_ABERTO`, `PLANTAO_ENCERRADO`, `PASSAGEM_NEGADA`, `PASSAGEM_PARA_SI_MESMO`, `DOSE_SEM_DONO_NA_PASSAGEM`, `ATRIBUICAO_INVALIDA`, `PASSAGEM_GRANDE_DEMAIS`, `EVOLUCAO_CONGELADA`.

### 15.6 App

Nenhuma tela e nenhum tipo de notificação novo.

---

## 16. Correção da auditoria da E5-02c (29/10): o que mudou no contrato

Vale sobre as seções 14 e 15.

### 16.1 Checklists: dicionários e orçamento de 512 KB

Os textos que se repetiam em cada linha agora vêm **uma vez só**, em dicionários ao lado das linhas. A resposta inteira tem no máximo 512 KB: as linhas que não cabem saem do fim, `truncado: true` avisa, e as contagens continuam sendo de todas as linhas lidas.
- Cada item (`AdministracaoDeInternacaoDto`) **perdeu** `descricao`, `kind`, `via`, `doseTexto`, `frequenciaHoras`, `executadaPor` e `atribuidaA`. **Ganhou** `executadaPorId` e `atribuidaAId`. O item continua com `prescricaoId`.
- Os dois checklists ganharam:
  - `prescricoes: [{ id, descricao, kind, via, doseTexto, frequenciaHoras }]`;
  - `profissionais: [{ profissionalId, nome }]`;
  - `totalLido`: quantas linhas foram lidas.
- O do plantão também ganhou `internacoes: [{ id, pacienteId, pacienteNome, especie, leitoNome }]`, e o item **perdeu** `paciente` (use o `internacaoId`).
- Registrar e desfazer (`DoseRegistradaDeInternacaoDto`) continuam completos: o item mais `prescricao` (o objeto do dicionário), `executadaPor`, `atribuidaA`, `observacao` e `semMudanca`.

### 16.2 `GET /turnos/atual`

- Cada pendência **perdeu** `descricao`, `paciente` e `atribuidaA`, e **ganhou** `prescricaoId` e `atribuidaAId`.
- A resposta ganhou os dicionários `prescricoes`, `internacoes` e `profissionais`.
- Na `passagemRecebida`, as pendências trocaram `atribuidaA` por `atribuidaAId`; a `descricao` congelada continua. A `passagemRecebida` também ganhou `truncado`.
- O orçamento de 512 KB vale para a resposta inteira. **A lista congelada da passagem vem primeiro** e cabe inteira mesmo no teto (300 pendências, 300 nomes, a nota de 1000 caracteres). As pendências de agora usam o que sobra e podem ser cortadas (`pendenciasTruncado`): para ver todas, use o checklist do plantão.

### 16.3 Passagem: quem recebe e quem fica com a dose

- `recebidoPorId` e cada `atribuicoes[].profissionalId` precisam **executar a internação**. Isso quer dizer: ficha ativa com login, membro aceito e ativo da equipe, conta viva e um papel com `internacao.executar` (DONO, veterinário ou enfermagem). A recepção, o gestor ou quem saiu da equipe recebem o 403 `OWNERSHIP_FORBIDDEN`, o mesmo corpo de inexistente. Na tela de entregar, liste só essas pessoas.
- A dose atribuída antes a alguém que perdeu o acesso conta como **sem dono**: a passagem pede um dono novo (409 `DOSE_SEM_DONO_NA_PASSAGEM`).
- O DONO entrega o plantão quando ele está vencido **ou** quando o responsável perdeu o acesso.

### 16.4 Evolução: a tela velha não estraga nada

- **`gravidadeVista`** (obrigatória): a gravidade que a tela mostrava ao abrir. Se a gravidade atual for outra, a API responde 409 `INTERNACAO_ALTERADA` (`reason: GRAVIDADE`, `gravidade` = a atual) e nada é gravado. Recarregue e mostre a gravidade atual.
- **Reescrever** (já há evolução neste plantão): mande `evolucaoId` **e** `atualizadoEmVisto`, que é o `atualizadoEm` lido, agora com milissegundos (`2026-10-28T14:05:07.123-03:00`). Sem os dois, ou se outra pessoa salvou depois, a API responde 409 `EVOLUCAO_ALTERADA` com `evolucaoId` e `atualizadoEm` da versão atual, e nada é gravado. Recarregue e mostre a versão atual.
- O responsável do plantão continua podendo reescrever a evolução de outra pessoa, e **a versão anterior fica no histórico**:
  - a lista e a evolução salva trazem `versoesAnteriores`;
  - `GET /parceiro/portal/clinica/internacoes/:id/evolucoes/:evolucaoId/versoes` devolve `{ evolucaoId, itens[], truncado }`, mais recentes primeiro e até 50;
  - cada versão: `{ id, profissional, escritaEm, substituidaPor, substituidaEm, vitais, observado, avaliacao, plano, gravidade }`;
  - evolução de outra internação ou de outra clínica: 403;
  - a lista de versões também tem `?cursor=` e `proximoCursor`.
- As listas de evoluções e de versões têm o mesmo orçamento de 512 KB por página: com textos grandes a página vem com menos de 50, `truncado: true` e `proximoCursor` para seguir (re-auditoria, 29/10).
- A copy de `INTERNACAO_ALTERADA` ficou genérica ("a internação mudou enquanto você trabalhava nela").

### 16.5 Erro novo

`EVOLUCAO_ALTERADA` (6 locales).

---

## 17. Boletim ao responsável (E5-03a, parte manual)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e5-internacao/03-boletim-ao-responsavel.md`. A parte automática (cron de 15 min, silêncio noturno com a junção das 7h, boletim de alta, foto) é a E5-03b: as telas abaixo já nascem com os campos dela, mas nada automático sai ainda.

**A regra que as telas não podem tentar reproduzir:** a retenção é do servidor. Boletim de piora (ou o primeiro de quem entrou crítico) só sai depois que alguém da clínica liga para o responsável. A tela nunca decide isso sozinha; ela mostra o que a API devolve.

### 17.1 Portal: conversa do boletim (no detalhe da internação)

Módulo CLÍNICA. `boletim.compor` = veterinário, enfermagem e DONO (ler, escrever, descartar, preferência). `boletim.enviar` = os mesmos e a **recepção** (ligar e enviar). A recepção não escreve o texto: esconda "Escrever boletim" para ela.

| Rota | Permissão | O que faz |
|---|---|---|
| `GET /parceiro/portal/clinica/internacoes/:id/boletins?cursor=` | compor | A conversa: todos os boletins (retidos, descartados e enviados), do mais recente, 30 por página. `semCanalNoApp: true` = sem vínculo com o app: mostre "Sem app: avise por telefone" |
| `GET .../internacoes/:id/boletins/modelos` | compor | Sugestões de texto no idioma do responsável, `observadoDaUltimaEvolucao` (texto **interno**: use só como ponto de partida, nunca cole sem revisar), `dosesDadasNoPeriodo`, `exigeLigacao` (o próximo boletim só sai depois da ligação). Nada é gravado |
| `POST .../internacoes/:id/boletins` | compor | `{ texto (1 a 2000), idioma? }`, aceita `Idempotency-Key`. Nasce `RASCUNHO` ou `RETIDO` |
| `POST /parceiro/portal/clinica/boletins/:id/descartar` | compor | Descarta o aberto (fica na conversa como `CANCELADO`, `DESCARTADO`) |
| `POST /parceiro/portal/clinica/boletins/:id/ligacao` | enviar | `{ porProfissionalId, em? }`. Sem `em`, vale "liguei agora" (relógio do servidor). `RETIDO` vira `LIBERADO` |
| `POST /parceiro/portal/clinica/boletins/:id/enviar` | enviar | Aceita `Idempotency-Key`. Resposta `{ id, entregue, motivo, boletim }` |
| `GET` e `PUT .../internacoes/:id/preferencias` | compor | Preferência do responsável (pedido por telefone): `{ frequenciaHoras (1, 2, 4, 6, 8, 12, 24), fotoSempre?, silencioNoturno? }` |

`BoletimDaClinicaDto`: `{ id, internacaoId, tipo (ATUALIZACAO, ALTA), origem (AUTOMATICO, MANUAL), status, gravidade, texto, idioma, geradoEm, atualizadoEm, autorUsuarioId, exigeLigacao, motivoDaRetencao (PIORA, ENTROU_CRITICO), retidoDesde, ligacao: { em, por: { profissionalId, nome }, registradaPorUsuarioId } ou null, enviadoEm, canceladoEm, motivoCancelamento (DESCARTADO, SUPERADO, ENCERRAMENTO), entrega: { situacao, canal, motivo, destinatarios, soInbox, em } ou null }`.

Estados e o botão de cada um:
- `RASCUNHO`: pronto para enviar ("Enviar").
- `RETIDO`: precisa de ligação. Mostre "Ligar para o responsável" com o telefone do cliente e "Registrar ligação" (quem ligou: lista de profissionais ativos). O selo do leito e a faixa de "Meu dia" vêm da API (motivo de urgência `BOLETIM_RETIDO` no mapa e o contador `boletinsRetidos`, tom RISCO, para quem tem `boletim.enviar`).
- `LIBERADO`: ligação feita, falta enviar ("Enviar").
- `ENVIADO`: mostre `entrega` (canal, quantas pessoas; `soInbox` = passou do teto de 12 no dia e chegou só no inbox).
- `CANCELADO`: em cinza, com o motivo. `SUPERADO` = o estado do paciente mudou depois que o texto foi escrito.

Um boletim aberto por internação. Ao piorar a gravidade, a API cria na hora o `RETIDO` com um texto fechado ("A equipe ligou para conversar sobre {pet}..."), e o rascunho manual que estava aberto vira `SUPERADO`. **O retido criado pelo sistema (`autorUsuarioId: null`) não se descarta** (409 `BOLETIM_RETIDO_DO_SISTEMA`): esconda "Descartar" nele. A clínica liga, envia e depois escreve o próprio boletim. O retido escrito por alguém da equipe pode ser descartado, mas o selo continua enquanto a ligação ou o envio estiver pendente: o contador e o selo contam internações com pendência pela regra do servidor, não boletins.

Envio:
- 409 `BOLETIM_EXIGE_LIGACAO` (`motivo`, `desde`): nada saiu. Recarregue a conversa (o boletim ficou `RETIDO`) e peça a ligação.
- 409 `BOLETIM_DESATUALIZADO`: o estado mudou depois do texto. Descarte e escreva de novo.
- 200 `entregue: false` com `motivo` `SEM_CANAL_NO_APP` ou `NAO_AVISAR`: nada saiu para o app; o boletim continua como estava e o comprovante registra `canal: NENHUM`. Mostre "Sem app: avise por telefone".
- O mesmo envio duas vezes devolve o mesmo comprovante (um push só).

Ligação: 400 `LIGACAO_INVALIDA` com `reason` `ANTES_DA_PIORA` (a ligação precisa ser depois da piora; vem `desde`), `NO_FUTURO` ou `ANTES_DA_ENTRADA`. A ligação é autodeclaração: a tela registra quem ligou e quando, sem prometer verificação.

Erros novos (6 locales): `BOLETIM_RETIDO_DO_SISTEMA` (com `boletimId`), `BOLETIM_EXIGE_LIGACAO`, `BOLETIM_DESATUALIZADO`, `BOLETIM_JA_ABERTO` (com `boletimId`), `BOLETIM_JA_ENVIADO`, `BOLETIM_CANCELADO`, `BOLETIM_CONGELADO`, `LIGACAO_INVALIDA`, `PREFERENCIA_INVALIDA` (com `permitidas`), `BOLETIM_TAXA_EXCEDIDA`.

### 17.2 App: internação do pet (tela nova)

Lê o dono e a família. Nunca vem gravidade, leito, motivo, diagnóstico, observação, status interno nem contagem de boletins retidos: **não tente inferir nada** (nem "sem notícia há X horas").

| Rota | Quem | O que faz |
|---|---|---|
| `GET /tutor/clinica/internacoes?petId=` | dono, família | Internações do pet: abertas e encerradas há menos de 30 dias |
| `GET /tutor/clinica/internacoes/:id` | dono, família | `InternacaoNaClinicaDto` |
| `GET /tutor/clinica/internacoes/:id/boletins?cursor=` | dono, família | Só os enviados, do mais recente, 30 por página |
| `GET /tutor/clinica/internacoes/:id/boletins/:boletimId` | dono, família | Um boletim (o toque na notificação) |
| `GET` e `PUT /tutor/clinica/internacoes/:id/preferencias` | ler: dono e família; mudar: **só o dono** | `{ frequenciaHoras, fotoSempre?, silencioNoturno? }`. A família recebe 403 `SOMENTE_LEITURA` |

`InternacaoNaClinicaDto`: `{ id, situacao (INTERNADO, ALTA, ENCERRADA), somenteContato, entradaEm, encerradaEm, previsaoDeAlta: { em, estimativa: true } ou null, petId, petNome, clinica: { id, nome, telefone, fuso }, podeAjustarPreferencias }`.
- `previsaoDeAlta`: é a previsão **congelada no último boletim enviado** (a do momento do envio), mostrada com "pode mudar". Antes do primeiro boletim, não há previsão. Ela muda (ou some) só quando sai um boletim novo; nunca no instante em que a clínica mexe na internação.
- `somenteContato: true` (óbito): mostre só "Internação encerrada" e o contato da clínica, sem datas. Os boletins dão 403 nesse caso. Só o dono atual vê; a família recebe 403.
- `ENCERRADA` cobre óbito, transferência e encerramento administrativo, sem dizer qual.

`BoletimDoAppDto`: `{ id, tipo, texto, idioma, enviadoEm, aposLigacao }`. Mostre o idioma de origem quando for diferente do aparelho (a PetJourney não traduz texto de saúde). `aposLigacao: true` = "Depois da conversa por telefone".

Preferência: `PreferenciaDeBoletimDto` = `{ internacaoId, frequenciaHoras, fotoSempre, silencioNoturno, definidaPor (RESPONSAVEL, CLINICA ou null), definidaEm, mensagensPorDia, tetoDePushesPorDia (12) }`. Mostre `mensagensPorDia` ao escolher a frequência. O push nunca toca de madrugada (o aparelho segura até de manhã); a notícia entra no inbox na hora. Diga isso perto do interruptor de silêncio noturno.

Todo o resto (pet de outra pessoa, vínculo encerrado, pet passado a outra conta, conta em exclusão) é o 403 de sempre. Balde próprio: 429 `BOLETIM_TAXA_EXCEDIDA`.

### 17.3 Dois tipos de notificação novos (app)

| Tipo | Título (pt-BR) | Corpo | `dados` |
|---|---|---|---|
| `INTERNACAO_BOLETIM` | "Notícias de {pet}" | "A clínica mandou uma atualização. Toque para ler no app." | `{ internacaoId, boletimId, petId, petNome, url, paraMembro? }` |
| `INTERNACAO_ALTA` (sai na E5-03b) | "{pet} teve alta" | "A clínica mandou as orientações para casa. Toque para ler no app." | os mesmos |

Os dois precisam entrar em `rotas-notificacao.ts` (`ROTA_POR_TIPO`, `AFETA_HOME_POR_TIPO`, `PERFIL_POR_TIPO`), categoria CLINICO. Sem isso, o toque cai em Unmatched Route. Até a tela existir, a API manda `url: /screens/notifications`; com a tela pronta, o toque abre a internação `internacaoId` no boletim `boletimId`. O push nunca tem texto clínico, e a família recebe com `paraMembro: true`. Os dois tipos não furam o silêncio da noite.

---

## 18. Boletim automático, alta e foto (E5-03b)

Vale sobre a seção 17. Ainda não está no develop (vai depois da auditoria).

### 18.1 O automático (nada a fazer na tela, só mostrar)

- A cada 15 minutos o servidor compõe e envia sozinho o boletim de rotina, no horário da preferência. Os horários são da parede da clínica e partem das 07:00. Exemplos: 6 h dá 07, 13 e 19; 1 h dá de 07 a 21.
- O texto é fechado, nos 6 idiomas, e nunca leva texto da enfermagem. Na conversa da clínica ele aparece com `origem: AUTOMATICO`.
- Com silêncio noturno (22:00 às 07:00 no fuso da clínica), nada de rotina sai à noite. Às 07:00 sai um só, que começa com "Bom dia" e conta a madrugada.
- A piora não espera: vira `RETIDO` na hora, mesmo de madrugada, e cobra a clínica.
- O automático não sai quando a clínica tem um boletim aberto (rascunho, retido ou liberado esperando) nem quando o paciente não tem vínculo com o app.
- `PreferenciaDeBoletimDto` ganhou `proximoBoletimEm` (fuso da clínica): mostre "Próximo boletim automático às 13:00". Mudar a frequência recalcula o próximo horário.

### 18.2 Alta

- Na alta (o encerrar com CRMV), o responsável recebe o boletim de alta: `tipo: ALTA`, com o texto "{pet} teve alta. Estas são as orientações da equipe para casa:" seguido da orientação de saída inteira que o veterinário escreveu.
- O push é `INTERNACAO_ALTA`, uma vez só.
- Óbito, transferência e encerramento administrativo não mandam nada.
- Sem vínculo com o app, não nasce boletim de alta (a recepção liga).
- Na lista do app, o boletim de alta aparece como os outros. Destaque o `tipo: ALTA` (por exemplo, "Alta e orientações para casa").

### 18.3 Foto (portal)

| Rota | Permissão | O que faz |
|---|---|---|
| `POST /parceiro/portal/clinica/boletins/:id/foto` | compor | Multipart: `file` e `legenda` opcional (até 200). JPEG, PNG ou WEBP de até 12 MB e 40 megapixels. A foto é regravada sem localização (EXIF, GPS) em 1.600 px. Uma por boletim: enviar de novo troca |
| `DELETE /parceiro/portal/clinica/boletins/:id/foto` | compor | Tira a foto |
| `GET /parceiro/portal/clinica/boletins/:id/foto` | compor | `{ url, expiraEm }`: URL assinada de 10 minutos, ou `url: null` |

- A foto só entra em boletim aberto. Depois do envio, 409 `BOLETIM_JA_ENVIADO`.
- Erro novo: 400 `BOLETIM_FOTO_INVALIDA`, com `reason` `TIPO`, `TAMANHO`, `PIXELS`, `ILEGIVEL` ou `LEGENDA`.
- `BoletimDaClinicaDto` ganhou `temFoto` e `fotoLegenda`. Avise na tela que a foto pode mostrar pessoas e outros animais.
- O `fotoSempre` da preferência é desejo do responsável, nunca obrigação: nenhum envio é recusado sem foto.

### 18.4 Foto (app)

- `BoletimDoAppDto` ganhou `temFoto` e `fotoLegenda`.
- `GET /tutor/clinica/internacoes/:id/boletins/:boletimId/foto` devolve `{ url, expiraEm }`: URL assinada de 10 minutos, ou `url: null`. Peça a URL na hora de abrir a foto, nunca guarde.
- Cada pedido confere o acesso de novo: quem perdeu o vínculo recebe 403.

### 18.5 Correção da auditoria da E5-03b (29/10): o que muda nas telas

- **Push que não toca.** O aparelho guarda o push de boletim da noite para as 08:00; a junção das 07:00, por exemplo, só toca às 08:00. Se nesse intervalo houve óbito, transferência ou vínculo encerrado, o push não sai mais. A notificação continua no inbox. No toque, o app abre a internação como ela está agora (`situacao: ENCERRADA`, ou 403 para quem perdeu o vínculo): trate os dois casos na tela da internação, sem mostrar erro genérico.
- **Foto (portal):**
  - Boletim de alta não recebe foto: 409 `INTERNACAO_ENCERRADA`. Esconda o botão de foto quando `tipo: ALTA`.
  - Se a internação foi encerrada enquanto a foto subia, a resposta também é 409 `INTERNACAO_ENCERRADA`: recarregue o detalhe.
  - Na piora, o automático aberto volta a `RETIDO` e perde a foto e a legenda (`temFoto: false`), porque elas foram escolhidas para o estado anterior. A tela mostra o retido sem foto, e a clínica pode anexar outra enquanto ele estiver aberto.
  - `reason: PIXELS` agora também cobre a imagem que ocuparia memória demais ao abrir (PNG de 16 bits, JPEG progressivo muito grande), mesmo abaixo de 40 megapixels. Mensagem sugerida: "Esta imagem é grande demais. Tire outra foto ou envie uma versão menor."

---

## 19. Correção do G4 (29/10): exclusão com o módulo suspenso, a fila da recepção e o paciente sem app

Spec: E5-01 e E5-03 (Change Log de 29/10, "Correção do G4"). Backend no develop depois do push desta rodada. **Não está em produção.**

### 19.1 Portal: a fila da recepção (tela nova)

A recepção tem `boletim.enviar`, mas não lê o mapa nem a conversa (sem `prontuario.ler` nem `boletim.compor`). Antes ela via "3 boletins retidos" e recebia 403 ao tocar. Agora o contador `boletinsRetidos` aponta para **`/clinica/internacao/boletins-pendentes`** (a rota da tela nova; antes era `/clinica/internacao`).

`GET /parceiro/portal/clinica/internacao/boletins-pendentes` (`boletim.enviar`: DONO, veterinário, enfermagem e recepção). Resposta:

```
{ fuso, truncado, itens: [{
  internacaoId,
  paciente: { id, nome, especie },
  leito: { id, nome },
  pendencia: 'LIGAR' | 'ENVIAR',
  semCanalNoApp,
  desde,              // desde quando a ligação é devida (ISO no fuso da clínica) ou null
  ultimaLigacaoEm,    // a última ligação registrada (na internação ou num boletim) ou null
  boletim: { id, status: 'RASCUNHO'|'RETIDO'|'LIBERADO', exigeLigacao, retidoDesde } | null,
  cliente: { id, nome, telefone, telefoneSecundario } | null   // null: cadastro anonimizado
}] }
```

- Sem texto clínico: nem gravidade, motivo, diagnóstico ou o texto do boletim. A tela mostra o animal, o leito, para quem ligar e o botão certo.
- Até 100 itens, em ordem de entrada; `truncado: true` = há mais (raro: o teto de leitos é 100).
- **O botão de cada item:**
  - `pendencia: 'LIGAR'` com `boletim` preenchido: "Registrar ligação" chama `POST /parceiro/portal/clinica/boletins/:boletimId/ligacao` (a de sempre).
  - `pendencia: 'LIGAR'` com `boletim: null` (o paciente sem app não ganha boletim): "Registrar ligação" chama a rota nova `POST /parceiro/portal/clinica/internacoes/:internacaoId/ligacao`.
  - `pendencia: 'ENVIAR'`: "Enviar" chama `POST /parceiro/portal/clinica/boletins/:boletimId/enviar`.
  - `semCanalNoApp: true`: mostre "Sem app: avise por telefone". Para esse paciente, a ligação registrada fecha a pendência (nada sai pelo app).
- Recarregue a lista depois de cada ação (ou use a `pendencia` que a ligação devolve, abaixo).

### 19.2 Portal: registrar a ligação na internação (rota nova)

`POST /parceiro/portal/clinica/internacoes/:id/ligacao` (`boletim.enviar`), corpo `{ porProfissionalId, em? }` (o mesmo da ligação no boletim; sem `em`, vale "liguei agora").

Resposta: `{ internacaoId, registrada, em, boletimLiberadoId, pendencia }`.
- `registrada: false`: nada era devido, ou já havia uma ligação depois da piora. Nada foi gravado; não é erro.
- `boletimLiberadoId`: havendo boletim aberto que precisava da ligação, ele foi liberado junto (RETIDO para LIBERADO). Com app, o próximo passo é enviar.
- `pendencia`: o item da fila desta internação depois da ligação (por exemplo `ENVIAR`), ou `null` quando não falta nada.
- Erros: 400 `LIGACAO_INVALIDA` (`reason`: `NO_FUTURO`, `ANTES_DA_ENTRADA`, `ANTES_DA_PIORA` com `desde`); 403 `OWNERSHIP_FORBIDDEN` (internação de outra clínica ou inexistente, o mesmo corpo; quem ligou de outra clínica ou desativado); 409 `INTERNACAO_ENCERRADA`; 429 `INTERNACAO_TAXA_EXCEDIDA`.

### 19.3 O que muda no selo, no contador e no mapa (paciente sem app)

- Sem app, a pendência é só "ligar". Ela some quando a ligação é registrada depois da piora (ou da entrada crítica), na internação ou num boletim. O `LIBERADO` sem app não cobra mais (nada sai pelo app).
- No mapa, o motivo de urgência `BOLETIM_RETIDO` some com a ligação feita: o crítico sem app que já foi avisado não fica mais na frente do estável com dose atrasada.
- Com app, nada muda: o boletim retido ou liberado cobra até ser enviado.

### 19.4 Exclusão a pedido do titular com o módulo suspenso (portal, tela do cliente)

`POST /parceiro/portal/clientes/:id/anonimizar` com o módulo Clínica **só para consulta** (suspenso, desligado, prazo vencido) e um animal internado: antes dava 409 `PACIENTE_INTERNADO` e a clínica não conseguia encerrar. Agora a exclusão **encerra a internação sozinha** (encerramento administrativo, com o motivo do sistema, sem aviso ao responsável) e conclui. O mesmo no hotel: com o módulo Hotel só para consulta, a estadia em curso é encerrada.

- A resposta ganha `internacoesEncerradas: string[]` e `hospedagensEncerradas: string[]` (ids). Se vierem preenchidos, mostre no comprovante: "A internação em curso foi encerrada administrativamente para atender ao pedido."
- Com o módulo funcionando, nada muda: 409 `PACIENTE_INTERNADO` (ou `PACIENTE_HOSPEDADO`), e a clínica encerra pela tela da internação antes.
- A internação encerrada assim aparece com `status: "ENCERRAMENTO_ADMINISTRATIVO"` e o motivo do sistema em `motivoEncerramentoAdministrativo`.
- Hotel (re-auditoria do G4, 29/10): `hospedagensEncerradas` traz os ids das **reservas** em que a estadia do animal do titular foi encerrada. Se a reserva tem também um animal de **outro cliente** (o dono de um deles mudou depois da reserva), só a estadia do titular fecha: a reserva continua `HOSPEDADO` e o outro animal segue na casa. No comprovante: "A estadia em curso no hotel foi encerrada para atender ao pedido." A estadia fechada assim não tem "entregue por" (ninguém entregou o animal no balcão).
- Ligação na internação: a hora no futuro (mais de 5 minutos) ou antes da entrada continua dando 400 `LIGACAO_INVALIDA` com `reason` `NO_FUTURO` ou `ANTES_DA_ENTRADA`; agora o banco também recusa, com o mesmo código.

### 19.5 App: o toque na notificação suprimida (`rotas-notificacao.ts`)

Quando o push adiado de `INTERNACAO_BOLETIM` ou `INTERNACAO_ALTA` é suprimido (óbito, transferência, encerramento, vínculo encerrado), a notificação continua no inbox **já lida** (`lidaEm` preenchido) e com:
- `dados.encerrada: true`;
- `dados.url` = `/screens/notifications?internacaoId=<id>&encerrada=1` (o app resolve a rota pelo tipo e leva a query da `url`, como em `rotaDaNotificacao`).

No app:
- Em `rotas-notificacao.ts`, quando a tela da internação existir, o toque em `INTERNACAO_BOLETIM` ou `INTERNACAO_ALTA` com `encerrada=1` na query (ou `dados.encerrada === true` no inbox) abre **"Internação encerrada"**, nunca o boletim nem a internação viva. O `boletimId` continua nos dados, mas não deve ser usado nesse caso.
- A tela "Internação encerrada" mostra a frase e, se `GET /tutor/clinica/internacoes/:id` responder, o contato da clínica (`somenteContato`). Se responder 403 (a pessoa perdeu o vínculo), mostre só a frase, sem erro genérico.
- Não conte essas notificações como não lidas (já vêm com `lidaEm`).

---

## 20. Correção do G4 (29/10): dose e prescrição (alergia nova, internação esquecida, dose não registrada)

Spec: E5-02 (Change Log de 29/10, "Correção do G4, dose e prescrição"). Backend no develop depois do push desta rodada. **Não está em produção.** Nenhum tipo de notificação novo (nada em `rotas-notificacao.ts`).

### 20.1 Alergia (ou espécie) que chegou depois da prescrição

A conferência de alergia era feita só no prescrever. Se a recepção grava "alergia a penicilina" no cadastro depois, ou se o cadastro é mesclado com outro que tem a alergia, a dose seguia sendo dada. Agora:

- **Registrar FEITA** (`POST /parceiro/portal/clinica/administracoes/:id/registrar`) com a prescrição barrada dá **409** e a dose continua `PENDENTE`:
  - `ALERGIA_NOVA_NA_PRESCRICAO`: alergia ativa ao princípio (qualquer grafia, sinônimos inclusive) e a prescrição sem a confirmação de alergia;
  - `ESPECIE_PROIBIDA_NA_PRESCRICAO`: a espécie do paciente atual é contraindicada no bulário e a prescrição não tem essa confirmação.
  - Corpo: `{ codigo, prescricaoId, avisos: ['ALERGIA' | 'ESPECIE_PROIBIDA'] }` (com alergia e espécie juntas, o código é o da alergia e `avisos` traz as duas).
  - **PULADA e RECUSADA não são barradas** (não dar a dose é o certo).
- **Marca antes do toque:** o item do dicionário `prescricoes[]` (checklist da internação, checklist do plantão, `GET /turnos/atual` e o `prescricao` da resposta do registrar) ganhou `alergiaNova: boolean` e `especieProibidaNova: boolean`. Com qualquer um `true`:
  - mostre na linha da dose "Alergia registrada depois da prescrição: chame o veterinário" (ou "Espécie contraindicada: chame o veterinário");
  - deixe o botão "Dei" desligado; "Pulei" e "Recusou" seguem ativos.
- **O caminho do veterinário:** suspender a prescrição, ou prescrever de novo com `substituiPrescricaoId` e `alergiaConfirmada: true` (ou `proibidoConfirmado: true`). A prescrição nova nasce confirmada e a dose dela registra normalmente; a antiga é suspensa na mesma transação.
- **Mapa e Meu dia:** `sinais.alergiaNova: true` na internação com prescrição ativa barrada. A urgência vira `URGENTE` com o motivo novo `ALERGIA_NOVA`, primeiro da ordem (vem antes do boletim retido e das doses atrasadas). Mostre o motivo no cartão ("Alergia nova na prescrição").

### 20.2 Internação esquecida aberta

Sem nenhum registro há 72 h (nenhuma dose registrada, evolução, prescrição nova; contando da entrada), o servidor **para de criar doses** dessa internação. O próximo registro religa a criação na rodada seguinte do cron (até 1 h).

- `InternacaoDto` (detalhe) e o item do mapa (`leitos[].internacao`) ganharam `abertaSemRegistro: { ultimoRegistroEm, horas } | null` (só na internação em curso).
- Com o campo preenchido, mostre no detalhe e no cartão do mapa: "Sem registro há {horas} h. As doses pararam de ser criadas: registre, prescreva ou encerre a internação."
- O cron também não cria doses para a clínica com o módulo Clínica só para consulta (suspenso, desligado, prazo vencido) nem para a clínica excluída.

### 20.3 Contador de doses atrasadas com piso

`dosesAtrasadasInternacao` (pendências do menu) e `sinais.dosesAtrasadas` do mapa contam só as atrasadas desde **12 h antes do início do plantão da grade** (o mesmo início da lista do checklist do plantão, `atrasadasDesde` sem `de`). Atrasada mais antiga que isso não conta mais no selo: a tela da internação continua mostrando no checklist dela. `contagens.atrasadasForaDaLista` do checklist do plantão segue igual (as do piso que não couberam na lista). O número do contador agora é o mesmo para toda a equipe da clínica (o cache é por clínica).

### 20.4 Dose não registrada (internação encerrada)

A dose que ficou `PENDENTE` quando a internação foi encerrada (a da janela e as atrasadas, P8) não aparece mais como "atrasada":
- no checklist da internação, `situacao: 'nao-registrada'` (valor novo), `atrasoMinutos: 0`, `atravessaAPassagem: false`, e ela fica fora de `contagens`. Mostre em cinza: "Não registrada (internação encerrada)";
- na passagem recebida (`GET /turnos/atual`, `passagemRecebida.pendencias[]`), o campo novo **`situacaoAgora`** traz a situação agora no vocabulário do checklist (`futura`, `na-janela`, `atrasada`, `feita`, `pulada`, `recusada`, `suspensa`, `nao-registrada`). O `statusAgora` continua o do banco (`PENDENTE`); use `situacaoAgora` para o rótulo e para contar o que ainda está pendente.

### 20.5 Erros novos (6 locales)

`ALERGIA_NOVA_NA_PRESCRICAO` (409) e `ESPECIE_PROIBIDA_NA_PRESCRICAO` (409). Os dois abrem um diálogo que manda chamar o veterinário; nenhum tem confirmação na tela da enfermagem.

### 20.6 Sem mudança de contrato

- Duas escritas nas doses (a entrega do plantão com atribuições e a suspensão ou o encerramento) agora travam as doses na mesma ordem: some um 500 raro que podia aparecer na troca de plantão.
- O ponto de extensão da baixa de estoque na dose (`aoAdministrar`, para a E9) existe, sem efeito hoje.

### 20.7 App

Nada muda.

---

## 21. Correção do G5 (29/10): boletim da internação

Spec: E5-03 (Change Log de 29/10, "Correção do G5"). Backend na pasta `wt/g5-voz`, **sem push** até a re-auditoria. **Não está em produção.** Rotas novas: nenhuma. Tipos de notificação novos: nenhum (`rotas-notificacao.ts` não muda).

### 21.1 Internação esquecida aberta

Sem nenhum registro há 72 h (o mesmo aviso `abertaSemRegistro` do detalhe e do mapa), o boletim automático para: o responsável deixa de receber "notícias" de um animal que ninguém registra. O próximo registro (prescrição, dose ou evolução) religa na rodada seguinte. Na tela, junto do aviso `abertaSemRegistro`, diga também "o boletim automático está parado".

### 21.2 Rascunho parado

- Um rascunho escrito na conversa e não enviado, **sem edição há mais tempo que a frequência do boletim** daquela internação (6 h no padrão), deixa de calar o automático: o boletim automático sai no horário, e o rascunho continua aberto.
- Esse rascunho passa a contar no contador `boletinsRetidos` e aparece na fila da recepção (`GET .../internacao/boletins-pendentes`) com `pendencia: 'ENVIAR'` e `boletim.status: 'RASCUNHO'`.
- Na conversa, mostre o rascunho parado com um aviso: "Rascunho parado: envie ou descarte". O botão de enviar continua o de sempre.

### 21.3 Sem canal no app: uma regra só

O responsável que desativou o perfil de responsável no app (ou o excluiu) conta como **sem canal no app** em todo lugar, mesmo se alguém da família ainda lê o pet. A família recebe junto do dono, nunca no lugar dele. Antes, o contador dizia "sem app" e o envio mandava para a família, e o boletim liberado ficava parado sem selo.
- Na conversa e na fila: `semCanalNoApp: true`, e o comprovante do envio vem com `motivo: 'SEM_CANAL_NO_APP'`. Mostre "Sem app: avise por telefone", como já é para quem não tem vínculo.

### 21.4 Push adiado e a piora

O boletim enviado de madrugada com o push guardado para as 8h **não toca** se o animal piorar nesse meio tempo. A notificação continua no inbox (o texto era verdade quando saiu). A piora segue o caminho de sempre: a clínica liga. No app, nada muda.

### 21.5 Exclusão a pedido do titular

A preferência do boletim que o responsável escolheu pelo app perde a conta dele. A escolha fica (`definidaPor: 'RESPONSAVEL'`, frequência, foto, silêncio). A tela não muda: o DTO nunca trouxe o usuário.

## 22. Correção do G5 (29/10): o óbito do internado que está hospedado

- Encerrar com `OBITO` um animal que também está hospedado no hotel da mesma casa não dá mais 409 `PACIENTE_HOSPEDADO`: a estadia dele é encerrada pelo sistema. A resposta ganha `encerramento.obito.hospedagensEncerradas` (número). Detalhe da tela do hotel em `portal-parceiro-e7.md`, seção 45.
- Internar um animal hospedado não pede confirmação. Enquanto ele está internado, a prancheta do hotel mostra "Na internação" e não planta a medicação nem o cuidado da estadia.
- **Re-auditoria do G5 (29/10):** o detalhe da internação e a lista de prescrições ganham `medicacaoDaEstadia` (o que o animal tomava no hotel da mesma casa, só leitura, com a última dose dada no hotel). Contrato e tela em `portal-parceiro-e7.md`, seção 45, "Re-auditoria do G5".

### 20.8 Re-auditoria do G4 (29/10)

Backend no develop (`201931bc`). **Não está em produção.** Nenhum tipo de notificação novo.

- **Alergia nova, a regra ficou mais fina:** a prescrição guarda QUAIS alertas de alergia foram confirmados no ato e todos os fármacos citados (até 5 no fluido ou no procedimento). O 409 `ALERGIA_NOVA_NA_PRESCRICAO` agora também sai quando chega um SEGUNDO alerta ao mesmo princípio depois da confirmação, e quando a alergia é ao segundo aditivo do fluido ("Ringer com cloreto de potássio e dipirona"). Mesmo corpo, mesma tela; nada muda no front.
- **`alergiaConfirmada` só fica `true`** quando havia alergia casada no ato. O "estou ciente" mandado sem alergia não vale para a alergia que vier depois.
- **Peso de entrada acima do esperado para a espécie:** prescrever MEDICAMENTO com o peso de entrada acima do teto da espécie (cão 120 kg, gato 15, ave 2, roedor 3, coelho 12, peixe 15) dá 422 `CONFIRMACAO_PENDENTE` com `avisos: ['PESO_IMPLAUSIVEL']` e `peso: { kg, origem, limiteKg }`. Mostre "Gato com 40 kg na entrada? O esperado é até 15 kg" e mande `pesoImplausivelConfirmado: true` para seguir (o peso de entrada se corrige na internação). `dose` da prescrição ganhou `pesoImplausivelConfirmado: boolean`.
- **Erro novo na ficha do paciente** (E2, mas aparece na internação também): 409 `ALERTAS_NO_LIMITE` ao passar de 50 alertas ativos (seção 1.7 do handoff da E2).
- **Re-auditoria 2 (30/10), a prescrição "a conferir":** uma prescrição de antes desta versão (fluido, procedimento, alimentação ou monitoramento gravados sem a lista de fármacos) pode vir no checklist, no plantão e no mapa com `alergiaNova: true` quando o paciente tem alergia ativa: o servidor não sabe ainda quais fármacos ela cita e falha para o lado seguro. Mostre o mesmo aviso ("Alergia registrada depois da prescrição: chame o veterinário"). Ao registrar "Dei", o servidor confere essa prescrição de verdade: se não houver alergia ao que ela cita, registra e o aviso some; se houver, 409 `ALERGIA_NOVA_NA_PRESCRICAO`, como antes. No dev, o backfill já conferiu as prescrições existentes; o caso só aparece com prescrição gravada por uma versão antiga da API. Nada muda no contrato.
