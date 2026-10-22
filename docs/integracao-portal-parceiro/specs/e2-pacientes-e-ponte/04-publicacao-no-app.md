# Spec: Publicação no app (o escritor único da clínica para o pet do responsável)

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.4
**Épico:** [E2 pacientes e ponte](../../../../../epicos/portal-parceiro-e2-pacientes-e-ponte.md) (decisão A2 do guarda-chuva)
**Depende de:** [E2-02 vínculo](02-vinculo-e-consentimento.md), [E1-05 trilha](../e1-fundacao/05-trilha-de-auditoria-clinica.md)
**Usada por:** E4-01 (resumo liberado), E4-04 (vacina aplicada), E5-03 (boletim de alta), E7-04 (estadia encerrada)

---

## Visão Geral

O `PublicadorClinicoService` é o único caminho pelo qual um registro do estabelecimento vira registro do pet no app. Ele:
- confere o vínculo ativo na mesma transação;
- chama os escritores que já existem (`ConsultaService.createWithTx` e afins);
- grava autoria (parceiro e profissional) nos modelos do app;
- garante idempotência por origem;
- notifica o responsável;
- sabe anular e republicar;
- respeita quando o responsável remove a cópia do app.

## Motivação

- **Decisão A2 do Nicolas (2026-10-20).** Com vínculo aceito, vacina aplicada, resumo liberado e peso aferido entram sozinhos no app, com autoria, sem o responsável poder editar. Isso revoga a D1 da anotação estruturada e a P6 da receita com IA **somente para clínica com vínculo ativo**.
- O portal desenhou o que vira o quê no app (doc 09, seção 2):
  - uma `Consulta` por atendimento liberado, com `ConsultaPrescricaoItem` por item;
  - o peso aferido como `PesoRegistro` sem duplicar;
  - a vacina como `Vacina` com lote, fechando o lembrete pendente de mesmo nome e criando a próxima dose como `LembreteSerie` VACINA;
  - agendamento e internação da clínica **não** viram registro no app.

---

## Research Findings

- `Consulta` não tem `parceiroId`, profissional nem autoria (`prisma/schema.prisma:615-648`); escritor único `ConsultaService.createWithTx` / `createComPrescricaoWithTx` (`src/consulta/consulta.service.ts:70-96`), usado pela importação da anotação e pela leitura de receita (P5).
- `Vacina` tem só `nome`, `aplicadaEm`, `petId`, `gerouLembreteId` (`:950-964`). O DTO cria lembrete opcional (`src/vacina/dto/create-vacina.dto.ts:16-37`).
- `PesoRegistro` ganha `origem` na E2-03.
- `ServicoRealizado` tem os campos de hospedagem e "é criado sempre pelo tutor" (`:2909-2941`): a E7-04 publica estadia por aqui, com a mesma revogação da D1.
- Mutação de prontuário pelo tutor passa por `assertMutacaoProntuario` e pelos `assert*Ownership` (`src/auth/services/ownership.service.ts:68-318`).
- Timeline monta de `Consulta`, `Vacina`, `Medicamento`, `PesoRegistro`, `Documents`, `ServicoRealizado` (`src/timeline/timeline.types.ts:10-23`): o que for publicado aparece sem tipo novo de evento.
- O app hoje edita e apaga qualquer `Consulta`/`Vacina` do pet. Passar a recusar edição do que veio da clínica é mudança de comportamento para registros novos (os antigos não têm `origem=PARCEIRO`).

**Breaking changes:**
- Aditivas no schema: colunas novas com default.
- Comportamento: `PATCH` de `Consulta`, `Vacina` e `PesoRegistro` com `origem=PARCEIRO` passa a dar 403 `REGISTRO_DA_CLINICA`. Só atinge registros criados por esta spec. A build do app que não conhece o campo mostra o botão de editar e recebe o 403 com mensagem localizada (aceitável; o handoff esconde o botão).

## Decisões

- **D1 Uma tabela de publicação.** `PublicacaoClinica` liga `(origemTipo, origemId)` do estabelecimento a `(alvoTipo, alvoId)` do app, com status. Ela garante a idempotência (unique) e o caminho de volta (anular, republicar).
- **D2 Autoria nos modelos do app.**
  - `Consulta`, `Vacina`, `PesoRegistro` e `ServicoRealizado` ganham `origem` (`TUTOR` default, `ANOTACAO`, `LEITURA_RECEITA`, `PARCEIRO`), `parceiroId?` e `profissionalNome?`/`profissionalCrmv?` congelados.
  - `Vacina` ganha também `lote?`, `fabricante?`, `validadeLote?`, `dose?`, `dosesNaSerie?`, `via?` e `aplicadaNaClinica Boolean`.
  - Os campos de texto que já existem (`clinicaNome`, `veterinarioNome`) continuam sendo preenchidos, para a build atual do app mostrar certo sem mudança.
- **D3 Somente leitura para o responsável, remoção permitida.** `PATCH` recusa (`REGISTRO_DA_CLINICA`). `DELETE` remove a cópia do app e marca a publicação `REMOVIDA_PELO_RESPONSAVEL`; a clínica não republica o que ele removeu (republicação de adendo também respeita).
- **D4 Anular na clínica remove do app.** Anulação de atendimento ou de aplicação (P4 do épico pai) apaga a cópia no app pelo mesmo serviço, cancela o lembrete de próxima dose que a publicação criou, e manda `CLINICA_ANULOU_REGISTRO` sem conteúdo clínico ("A clínica X corrigiu um registro de Rex").
- **D5 Republicar é atualizar.** Adendo no atendimento ou correção de aplicação republica: atualiza a cópia no app (se não removida) e manda `ATENDIMENTO_RESUMO_ATUALIZADO` só quando muda algo visível ao responsável.
- **D6 Não depende de plano.** Publicação vale para qualquer plano do responsável (doc 09 do portal, seção 13). Pet inativo por queda de plano recebe mesmo assim; pet com óbito não recebe (o vínculo já foi encerrado).
- **D7 O que nunca vai para o app.** Diagnóstico diferencial, mg/kg, anotações internas, faixa de referência, boletim retido, prioridade da fila. É a lista que o portal já trava em teste (`projecao-do-responsavel.ts`, "o que não pode vazar", doc 09 seção 18). Aqui vira teste de forma do payload publicado.

### Decidido na implementação (v0.2)

- **P1 O domínio monta o conteúdo; o publicador não lê o atendimento.**
  - Atendimento, aplicação e estadia ainda não existem (E4-01, E4-04, E7-04), então os métodos recebem o conteúdo já mapeado: `ConsultaParaOApp`, `VacinaParaOApp`, kg e data.
  - O tipo de `ConsultaParaOApp` não tem campo para diagnóstico diferencial, mg/kg, anotação interna, faixa de referência nem fila: o D7 vale por construção, mais o teste de forma.
- **P2 Vínculo travado:**
  - `SELECT ... FOR UPDATE` na linha ATIVA, na transação do domínio. Encerramento simultâneo espera ou já foi visto, então nunca se publica no encerrado.
  - Paciente com óbito não recebe.
- **P3 Avisos depois do commit:** cada `publicar*` devolve o aviso; o domínio chama `avisar(...)` depois do commit.
  - Hoje só o dono recebe. A família com `paraMembro` fica como follow-up (o padrão do detector de lembretes tem regra própria de destinatários).
  - A copy só tem o nome do pet: sem clínica e sem remédio ou vacina.
- **P4 Republicar:**
  - a consulta atualiza o texto e só avisa `ATENDIMENTO_RESUMO_ATUALIZADO` se algo visível mudou;
  - os itens de prescrição não são republicados (follow-up da E4-01, que define o adendo de receita);
  - a vacina atualiza os campos sem aviso.
- **P5 Peso:** se já existe o mesmo peso no mesmo dia (UTC), nada é criado e a publicação não aponta para a linha do responsável (anular nunca apaga dado dele).
- **P6 Vacina:**
  - conclui a ocorrência VACINA pendente cujo título contém o nome da vacina (sem acento e sem caixa; "V10" casa com "Reforço de V10"), na data da aplicação;
  - a próxima dose vira `LembreteSerie` derivada, também registrada em `PublicacaoClinica` (`LEMBRETE_SERIE`), para a anulação apagar.
- **P7 Anular:**
  - apaga consulta, vacina, peso e lembrete publicados, mais os lembretes derivados (`aplicarCascadeLembrete` com cascade);
  - o que o responsável já removeu fica como está;
  - na consulta, o `TratamentoFixo` que os itens criarem fica para a E4-01 decidir (hoje a publicação não manda itens).
- **P8 Somente leitura (D3):**
  - `PATCH` de consulta, vacina e peso e `POST /consulta/:id/anexos` dão 403 `REGISTRO_DA_CLINICA` quando `origem = PARCEIRO`; o SystemAdmin passa;
  - o `DELETE` marca a publicação `REMOVIDA_PELO_RESPONSAVEL` na mesma transação;
  - a origem vem dos `assert*Ownership`, sem consulta extra.
- **P9 Origem nos fluxos que já existiam:** confirmar da leitura de receita = `LEITURA_RECEITA`; importação da anotação = `ANOTACAO`. O resto segue `TUTOR`, o default.
- **P10 Estadia (`publicarEstadia`) fica para a E7-04.** As colunas de autoria já existem em `ServicoRealizado`; o formato da hospedagem é dela.

### Revisão de segurança (v0.3, 2026-10-21)

- **P11 Republicar só no mesmo vínculo** (ALTO `SEG-2026-10-21-PUBLICACAO-OUTRO-VINCULO`).
  - **Problema:** com o paciente religado a outro pet, um adendo do atendimento antigo escrevia o texto novo na cópia do pet antigo, que pode ser de outra pessoa.
  - **Regra:** a publicação anterior só é atualizada quando o `vinculoId` dela é o do vínculo ativo de agora.
  - **Fora disso:** devolve `null`, e a cópia antiga fica como estava (D6). Como a unique é (origemTipo, origemId, alvoTipo), o mesmo ato não ganha cópia nova no pet novo.
  - Vale para consulta, vacina e peso.
- **P12 Lembrete da vacina** (MÉDIO `SEG-2026-10-21-PUBLICACAO-LEMBRETE-SUBSTRING`; corrige a P6):
  - o nome casa por palavras inteiras, com no mínimo 2 caracteres ("V10" fecha "Reforço de V10", mas "V" e "V1" não);
  - a ocorrência fechada fica registrada como `PublicacaoClinica` `LEMBRETE_FECHADO`, e o `anular` a devolve a `PENDENTE`.
- **P13 Vacina apagada por fora do app** (admin, expurgo): republicar devolve `null` sem derrubar a transação do domínio, como a consulta já fazia.
- **P14 Leitura de receita no modo EXISTENTE** respeita o somente leitura (MÉDIO `SEG-2026-10-21-LEITURA-RECEITA-SOMENTE-LEITURA`): na consulta da clínica, dá 403 `REGISTRO_DA_CLINICA` antes de qualquer escrita. Entra na lista da P8.

## Modelo de dados (aditivo)

```prisma
enum OrigemRegistroApp { TUTOR ANOTACAO LEITURA_RECEITA PARCEIRO }
enum StatusPublicacao  { PUBLICADA ANULADA REMOVIDA_PELO_RESPONSAVEL }

model PublicacaoClinica {
  id          String           @id @default(cuid())
  parceiroId  String
  vinculoId   String
  petId       String
  origemTipo  String           // ATENDIMENTO | APLICACAO_VACINA | PESAGEM | ESTADIA | BOLETIM_ALTA
  origemId    String
  alvoTipo    String           // CONSULTA | VACINA | PESO | SERVICO_REALIZADO | LEMBRETE_SERIE
  alvoId      String?
  status      StatusPublicacao @default(PUBLICADA)
  publicadaEm DateTime         @default(now())
  atualizadaEm DateTime        @updatedAt
  anuladaEm   DateTime?
  motivo      String?
  @@unique([origemTipo, origemId, alvoTipo])
  @@index([petId])
  @@index([parceiroId, publicadaEm])
}

// Consulta, Vacina, PesoRegistro, ServicoRealizado (aditivo)
origem           OrigemRegistroApp @default(TUTOR)
parceiroId       String?
profissionalNome String?
profissionalCrmv String?          // "CRMV-SP 12345", como estava no ato

// Vacina (aditivo)
lote              String?
fabricante        String?
validadeLote      DateTime? @db.Date
dose              Int?
dosesNaSerie      Int?
via               String?   // SUBCUTANEA | INTRAMUSCULAR | INTRANASAL | ORAL
aplicadaNaClinica Boolean   @default(false)
```

## Interface do serviço (interna)

```ts
publicarAtendimento(tx, atendimentoId): Promise<PublicacaoClinica>   // Consulta + itens + peso
publicarAplicacaoDeVacina(tx, aplicacaoId): Promise<PublicacaoClinica> // Vacina + fecha lembrete pendente + próxima dose
publicarPesagem(tx, origem, pacienteId, kg, em): Promise<PublicacaoClinica | null> // dedup por data e valor
publicarEstadia(tx, hospedagemId): Promise<PublicacaoClinica>          // ServicoRealizado HOSPEDAGEM (E7-04)
anular(tx, origemTipo, origemId, motivo): Promise<void>
```

Cada método: (1) confere vínculo ATIVO e pet sem óbito na transação, senão devolve `null` e não publica; (2) upsert pela unique; (3) respeita `REMOVIDA_PELO_RESPONSAVEL`; (4) grava trilha `PUBLICAR`; (5) emite a notificação depois do commit (padrão best-effort do `NotificacaoEmissorService`).

**Mapa do atendimento para a `Consulta`** (doc 09 do portal, seção 2):

| `Consulta` | vem de |
|---|---|
| `data` | finalização do atendimento |
| `tipo` | tipo do agendamento (consulta, retorno, vacina, exame, cirurgia, emergência) |
| `clinicaNome` | `EstabelecimentoPerfil.nomePublico` |
| `veterinarioNome`, `veterinarioEspecialidade` | profissional responsável |
| `motivo` | queixa principal |
| `diagnostico` | diagnósticos presuntivos e definitivos, nunca diferenciais |
| `prescricao` | texto legível da receita |
| `observacoes` | orientações ao responsável |
| `pesoNaConsulta` | peso aferido |
| itens | `ConsultaPrescricaoItem` com instrução para o responsável, sem mg/kg |

## Rotas

Nenhuma rota pública nova para publicar (é chamada pelos domínios). Mudanças nas rotas do app:

| Rota | Mudança |
|---|---|
| `GET /consulta`, `/vacina`, `/peso-registro`, `/timeline` | Devolvem `origem`, `parceiroId`, `parceiroNome`, `profissionalNome`, `profissionalCrmv` e, na vacina, lote, fabricante, validade, dose e via |
| `PATCH /consulta/:id`, `/vacina/:id`, `/peso-registro/:id` | 403 `REGISTRO_DA_CLINICA` quando `origem=PARCEIRO` |
| `DELETE` das mesmas | Permitido; marca a publicação `REMOVIDA_PELO_RESPONSAVEL` |

Notificações novas (responsável, CLINICO, com `paraMembro` para família): `ATENDIMENTO_RESUMO_DISPONIVEL`, `ATENDIMENTO_RESUMO_ATUALIZADO`, `VACINA_REGISTRADA_PELA_CLINICA` (que já diz a próxima dose; uma notificação por ato, decisão 7 do doc 13 do portal), `CLINICA_ANULOU_REGISTRO`. Push sem nome de remédio (P8 da receita).

## Acceptance Criteria

- [x] **Given** vínculo ATIVO **When** o atendimento é liberado **Then** nasce uma `Consulta` com `origem=PARCEIRO`, `parceiroId`, profissional, itens de prescrição sem mg/kg, e o `PesoRegistro` com `origem=PARCEIRO` (sem duplicar um peso igual na mesma data).
- [x] **Given** a mesma liberação chamada duas vezes **Then** existe uma `Consulta` só (unique da publicação).
- [x] **Given** vínculo ENCERRADO **When** a clínica libera **Then** nada é publicado e o atendimento fica com `publicadoEm=null` (a clínica vê "não publicado: o responsável encerrou o vínculo"). *O publicador devolve `null` (integração, inclusive em corrida); o `publicadoEm` do atendimento é da E4-01.*
- [x] **Given** uma vacina V10 aplicada e um lembrete VACINA pendente "V10" no pet **Then** o lembrete é concluído pela publicação, a `Vacina` nasce com lote, dose e via, e a próxima dose vira `LembreteSerie` VACINA com a data congelada da aplicação.
- [x] **Given** o responsável chama `PATCH /vacina/:id` numa vacina da clínica **Then** 403 `REGISTRO_DA_CLINICA` com mensagem no idioma dele.
- [x] **Given** o responsável apaga a consulta publicada **When** a clínica faz um adendo **Then** nada volta para o app.
- [x] **Given** a clínica anula a aplicação **Then** a `Vacina` do app some, o lembrete da próxima dose criado pela publicação é cancelado, e sai `CLINICA_ANULOU_REGISTRO` sem nome de vacina.
- [x] O payload publicado nunca contém diagnóstico diferencial, mg/kg, observação interna nem faixa de referência (teste de forma).

## Estratégia de Testes

- Unit: cada `publicar*` (vínculo ativo, encerrado, removido, idempotência), mapeamento do atendimento, fechamento de lembrete de mesmo nome, anulação, republicação, teste de forma da D7.
- Integration: publicação e encerramento simultâneos (um ganha, nunca publica no encerrado).
- Regressão: suíte atual de `consulta`, `vacina`, `peso-registro`, `timeline` e importação da anotação verde (registros `origem=TUTOR` editáveis como antes).
- Cenários: outro tutor lendo a consulta publicada (403); família LEITURA vendo (200).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar (enums, `PublicacaoClinica`, colunas aditivas em 4 modelos) |
| `src/publicacao-clinica/` (service, helpers de mapeamento, teste de forma) | Criar |
| `src/consulta/consulta.service.ts` | Modificar: aceitar `origem` e autoria em `createWithTx` (aditivo) |
| `src/vacina/vacina.service.ts` | Modificar: criação com lote e fechamento de lembrete de mesmo nome, reusável pela publicação |
| `src/consulta`, `src/vacina`, `src/peso-registro` (controllers e services de PATCH/DELETE) | Modificar: D3 |
| `src/timeline/*` | Modificar: campos de origem |
| `src/notificacao/catalogo/*` | 4 tipos |

## Tasks

- [x] **T1** Migration aditiva (`20261021104000`, `20261021105000`)
- [x] **T2** Autoria opcional nos escritores existentes (sem mudar chamadas atuais) *(T1)*
- [x] **T3** `PublicadorClinicoService` com os 4 `publicar*`, `anular` e idempotência *(T2, E2-02)*. Consulta, vacina e pesagem; a estadia fica para a E7-04 (P10)
- [x] **T4** D3 nas rotas do app + campos de origem nas leituras e na timeline *(T1)*
- [x] **T5** Notificações *(T3)*. Só o dono; família com `paraMembro` é follow-up (P3)
- [x] **T6** Testes da estratégia, regressão, cenários, handoff do app (selo da clínica, botão de editar escondido, "remover do meu app"). Handoff em `docs/frontend/novembro-2026/portal-parceiro-e2.md`, seção 3

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Publicar no pet de quem revogou | Vínculo conferido na transação da publicação; teste de corrida |
| Médio | Duplicar vacina que o responsável já tinha lançado | Fecha lembrete pendente de mesmo nome; a carteirinha mostra as duas linhas se o responsável lançou a mesma vacina como registro (não como lembrete), e o app ganha "é a mesma" no handoff (follow-up) |
| Médio | App antigo tentar editar registro da clínica | 403 com mensagem localizada; handoff esconde o botão |

## Rollout / Rollback

Aditivo. Nada publica até um domínio chamar o serviço. Rollback: reverter o código; as colunas ficam com default.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementação (T1 a T6) e decisões P1 a P10 | Claude |
| 2026-10-21 | 0.3 | Segunda revisão de segurança: P11 a P14 (republicar só no mesmo vínculo, lembrete por palavra inteira e reaberto na anulação, vacina apagada por fora, leitura de receita na consulta da clínica) | Claude |
| 2026-10-21 | 0.4 | Gate G1: concluída do lado da API. Nada publica até a E4-01 e a E4-04 chamarem o serviço | Claude |
