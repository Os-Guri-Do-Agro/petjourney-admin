<!-- doc cmvtwa12xydzcuvw0vd · "Handoff E4-06: portal-parceiro-e4.md" · atualizado 2026-10-30T16:52:41.160Z · card PJ-0EK0TY -->

# Guia do front: Portal do parceiro, E4 (prontuário, receita, vacinas e adesão)

**Para:** o Luís. Portal web do parceiro (`petjourney-admin`), CMS (`petjourney-cms`) e app (`petjourney-app`, seção 4).
**Backend:**
- E4-02 (catálogos clínicos) pronta e validada em dev em 2026-10-21: unit, integração contra o Postgres de dev e smoke por HTTP (`npm run script:smoke-catalogos-clinicos`). **Não está em produção**, e o conteúdo clínico de partida ainda **não foi revisado** por veterinário responsável técnico (gate de produção da spec).
- E4-04 (vacinação conectada) pronta e validada em dev em 2026-10-21: unit, integração no Postgres de dev (inclusive uma clínica de 3.000 pacientes) e smoke por HTTP (`npm run script:smoke-vacinacao`). **Não está em produção.** Seções 3 (portal) e 4 (app).
- E4-01 (atendimento e prontuário: E4-01a núcleo e E4-01b retorno, atos, linha do tempo e listas) pronta e validada em dev em 2026-10-28. **Não está em produção.** Seção 5.
- E4-03a (receita digital, núcleo: prescrição, rascunho, assinatura com senha, PDF, cancelar, receita no resumo do app) pronta e validada em dev em 2026-10-28. **Não está em produção.** Seção 6. A E4-03b (controle especial, verificação pública, repetir, salvar nos documentos) entra na mesma seção quando ficar pronta.
**Specs de origem:** `docs/specs/2026/q4/q4-1/portal-parceiro/e4-prontuario/02-catalogos-clinicos.md` (v0.3: revisão de segurança de 2026-10-21, com traduções validadas por campo, `Vary` no pacote e motivo na edição do global; veja 1.2, 1.7, 1.8 e 2.1) e `.../e4-prontuario/04-vacinacao-conectada.md` (v0.2)

**Contrato:** `contrato/openapi.json`; gere os tipos dele. Convenções iguais às da onda 0 ([portal-parceiro-e0.md](portal-parceiro-e0.md), seção 1):
- envelope `{ statusCode, message, data }`;
- erro com `codigo` (para decidir a tela) e `message` localizada (para mostrar);
- `?parceiroId=` quando o usuário tem mais de um parceiro;
- idioma do conteúdo pelo `Accept-Language` (ou `?lang=` nas rotas GET): nome, apresentação, indicações, contraindicações, notas de dose, exames, diagnósticos e vacinas já vêm traduzidos nos 6 idiomas.

---

## 1. Catálogos clínicos no portal (E4-02)

Substitui no mock:
- `referenceRangesFixture` (`data/fixtures/reference-ranges.ts`) e a resolução de `domain/ranges.ts` + `domain/porte.ts`;
- `diagnosisCatalogFixture` e `examCatalogFixture` (`data/fixtures/catalogs.ts`);
- `medicationsFixture` (`data/fixtures/medications.ts`), `TEXTO_DO_CATALOGO` (`data/fixtures/catalog-text.ts`) e `domain/catalog-i18n.ts` (a API devolve traduzido);
- `vacinasFixture` (`data/fixtures/vacinas.ts`);
- a conta de `domain/dose.ts`, `domain/receita.ts` (`passosDaConta`, `fracionar`) e os avisos de `domain/bulario.ts`.

Quando cada rota estiver ligada, **apague a regra local** correspondente (P2 do épico: regra mora no servidor). Fica no front só a montagem das frases.

### 1.1 Quem entra

- **Módulo:** todas as rotas desta seção exigem o módulo **Clínica** ligado.
  - Sem o módulo: 403 `MODULO_INATIVO`.
  - Módulo só de consulta (suspenso, desligado, vencido): lê e calcula dose; acrescentar dá 403 `MODULO_SOMENTE_LEITURA`.
- **Permissão** (sem ela: 403 `SEM_PERMISSAO` com `permissao`):

| O quê | Permissão | Quem tem |
|---|---|---|
| Pacote, busca de medicamentos e diagnósticos, faixas do paciente | `prontuario.ler` | DONO, VETERINÁRIO, ENFERMAGEM |
| Acréscimos da clínica (criar, editar, listar) | `catalogo.gerir` (nova) | DONO, GESTOR |
| Calcular dose | `prontuario.escrever` | DONO e VETERINÁRIO, **com CRMV** (sem CRMV: 403 `CRMV_OBRIGATORIO`) |

  A RECEPÇÃO não lê o catálogo clínico. O GESTOR acrescenta itens mas não lê o pacote nem busca (não tem `prontuario.ler`): na tela de acréscimos, use `GET .../catalogos/acrescimos`. Esconda os botões pelo `GET /parceiro/portal/eu`.
- **Item de outra clínica, item global (para editar) ou id que não existe:** 403 de acesso negado, **sem `codigo`** e sem dizer qual (o mesmo de pacientes, guia e2 seção 1.3).

### 1.2 Pacote inicial

`GET /parceiro/portal/clinica/catalogos`
- Resposta `{ faixas, exames, vacinas, classes }`. Vem com `Cache-Control: private, max-age=3600` e `Vary: Authorization, Accept-Language`: guarde por 1 h, e **invalide** quando a própria clínica criar ou editar um exame ou vacina.
- O pacote é **da clínica e do idioma**: a chave do seu cache (React Query ou outro) tem de levar o `parceiroId` e o idioma. Quando o usuário tem mais de um parceiro, mande sempre `?parceiroId=` na URL (o mesmo vale para todas as rotas desta seção): sem ele a API recusa, e com ele a URL de uma clínica nunca serve o pacote da outra num cache do navegador ou do caminho.
- `faixas`: `FaixaDeReferenciaDto` `{ id, vital, especie, porte, faixaEtaria, min, max, unidade, precisao, fonte, revisado, revisadoPor, revisadoEm, ativo }`.
  - `vital`: `TEMPERATURA`, `FREQUENCIA_CARDIACA`, `FREQUENCIA_RESPIRATORIA`, `TEMPO_PREENCHIMENTO_CAPILAR`, `ESCORE_CORPORAL`, `PRESSAO_SISTOLICA` (o `VitalKey` do mock em maiúsculas; `PESO` não tem faixa).
  - `porte` e `faixaEtaria` nulos = vale para qualquer um.
  - `especie` é o enum da API (`CACHORRO`, `GATO`, `AVE`, `ROEDOR`, `COELHO`, `PEIXE`, `REPTIL`, `OUTRO`). **Não há equino**: as faixas equinas do mock não foram para a API.
- `exames`: `{ id, origem, nome, grupo, ativo }`, `grupo` `LABORATORIO`, `IMAGEM` ou `OUTROS`; `origem` `GLOBAL` (PetJourney) ou `PARCEIRO` (da clínica).
- `vacinas`: `VacinaDto` com o protocolo (seção 1.6).
- `classes`: as classes do bulário (`ANTIBIOTICO`, `ANTI_INFLAMATORIO`, ..., `OUTRA`), para o filtro.
- **`revisado: false`** em faixa e vacina: o conteúdo ainda não passou pela curadoria do responsável técnico. Mostre um selo discreto ("referência não revisada") enquanto for `false`. Hoje **tudo** vem `false`.

### 1.3 Faixas do paciente (não resolva no front)

`GET /parceiro/portal/clinica/catalogos/faixas/paciente/:pacienteId`
- Resposta `{ pacienteId, especie, porte, porteEstimado, faixaEtaria, faixas: [{ vital, faixa }] }`, uma linha por sinal vital.
- A API resolve da faixa mais específica para a mais geral (porte e idade, porte, idade, espécie), com a idade calculada no fuso do estabelecimento. É a regra de `domain/ranges.ts`, com os testes de `porte-faixas.spec.ts` como golden tests.
- `faixa: null` = **sem referência** (D4). Mostre o valor sem julgar; nunca invente faixa.
- `porteEstimado: true`: o cadastro não informa o porte e a API estimou pelo peso. É palpite: mostre "porte estimado" e leve ao cadastro do paciente.
- `faixaEtaria: null`: nascimento desconhecido (a idade não entra).
- O status de cada medição (`ABAIXO`, `DENTRO`, `ACIMA`, `SEM_REFERENCIA`, `NAO_AFERIDO`) vai sair pronto no prontuário (E4-01). Até lá, compare `valor` com `min`/`max` da faixa que esta rota devolveu.

### 1.4 Busca no bulário e nos diagnósticos

- **Medicamentos:** `GET /parceiro/portal/clinica/catalogos/medicamentos?q=&especie=&limite=12`
  - `q`: nome, princípio ativo, sinônimo ou **indicação** ("otite"), em qualquer idioma, com tolerância a erro de digitação ("amoxicilna"). Até 60 caracteres. Sem `q`: os primeiros por nome.
  - `especie`: só os que têm dose para a espécie, **inclusive os proibidos nela** (esconder seria pior).
  - `limite`: 1 a 50, padrão 12.
  - **Só aparece o global revisado** pelo responsável técnico, mais os acréscimos da clínica. Hoje o bulário de partida está todo pendente de revisão: a busca devolve só o que a clínica acrescentou. Isso é esperado (D2), não é erro.
  - `MedicamentoDto`: `{ id, origem, nome, principioAtivo, sinonimosDoPrincipio, apresentacao, concentracao, unidadeApresentacao, classe, controle, listaControle, viasPermitidas, doseUsualMgKg: { min, max }, doses, indicacoes, contraindicacoes, efeitosAdversos, interacoes, cuidados, observacao, fonte, revisado, revisadoPor, revisadoEm, ativo }`.
  - `unidadeApresentacao`: `ML`, `COMPRIMIDO`, `GOTA`, `APLICACAO`. `concentracao` é mg por essa unidade.
  - `controle`: `NENHUM`, `MAPA_VETERINARIO` (Portaria MAPA 837/2025) ou `ANVISA_HUMANO` (Portaria 344/98 e SNCR), com `listaControle` ("C1") quando houver. Substitui o booleano `controlado` do mock; a receita (E4-03) decide a folha por ele.
  - `doses`: `{ id, especie, mgKgMin, mgKgMax, frequenciaHoras, duracaoUsualDias, proibido, nota }`. Substitui `MedicationDose` (`mgPorKg.min/max` viraram `mgKgMin/mgKgMax`).
  - `cuidados`: `GESTANTE`, `LACTANTE`, `FILHOTE`, `IDOSO`, `RENAL`, `HEPATICO`, `CARDIACO`, `GASTRICO`.
  - `sinonimosDoPrincipio`: todas as grafias do princípio nos 6 idiomas. Não use para mostrar; o alerta de alergia é cruzado no servidor (seção 1.5).
- **Diagnósticos:** `GET /parceiro/portal/clinica/catalogos/diagnosticos?q=&limite=12`
  - Por código ("GE-01" ou "ge01") e por descrição, em qualquer idioma. Global e da clínica (diagnóstico não passa por revisão).
  - `DiagnosticoDto`: `{ id, origem, codigo, codigoExterno, descricao, sistema, ativo }`. `sistema` é o `SystemKey` do mock em maiúsculas, ou nulo. `codigoExterno` fica para a VeNom.
- **Pronto quando:** o seletor de medicamento e o de diagnóstico do atendimento buscam na API (com debounce de uns 250 ms), e `medicationsFixture`, `diagnosisCatalogFixture` e `catalog-i18n.ts` saem do caminho.

### 1.5 Cálculo de dose

`POST /parceiro/portal/clinica/dose/calcular` `{ medicamentoId, pacienteId, mgPorKg, frequenciaHoras, duracaoDias?, pesoKg? }`

- `mgPorKg`: a dose que **o veterinário** escolheu. A API não sugere dose: ela faz a conta e mostra a faixa do bulário ao lado. O campo pode vir pré-preenchido com `faixaDeReferencia.mgKgMin` (o mínimo, como o mock fazia), nunca com o máximo.
- `duracaoDias` omitido: **uso contínuo** (sem total de administrações).
- `pesoKg`: o peso aferido agora no atendimento. Omitido, vale o último do cadastro do paciente.
- Resposta `ResultadoDaDoseDto`:
  - `medicamento` `{ id, origem, nome, principioAtivo, concentracao, unidadeApresentacao }` e `paciente` `{ id, especie, pesoKg, pesoOrigem }` (`INFORMADO`, `CADASTRO` ou nulo).
  - `calculo`: `{ pesoKg, mgPorKg, mgPorAdministracao, quantidadeApresentacao, unidadeApresentacao, frequenciaHoras, administracoesPorDia, duracaoDias, totalAdministracoes }`. **Nulo sem peso** (AC5): não mostre número nenhum.
  - `passos`: a conta para o veterinário conferir de cabeça. `tipo` `PESO_POR_DOSE` (`{ pesoKg, mgPorKg, mg }`), `DOSE_POR_CONCENTRACAO` (`{ mg, concentracao, unidade, quantidade }`) e `TOTAL` (`{ porDia, dias, total }`). O front monta a frase no idioma da tela: "12,4 kg × 10 mg/kg = 124 mg". O mock tinha os mesmos três passos em minúsculas.
  - `fracionamento` (só comprimido): `{ tipo, inteiros, quantidade, aproximado }`. `tipo` `INTEIRO`, `MEIO`, `UM_E_MEIO`, `QUARTO`, `TRES_QUARTOS`, `MULTIPLO` ou `APROXIMADO`. `quantidade` é sempre a partível (2,5, não 2,48). Com **`aproximado: true`**, a tela cobra a decisão do veterinário ("a conta deu 2,48 comprimidos; arredondado para 2 e meio") em vez de imprimir a fração em silêncio. Ex.: 124 mg num comprimido de 250 mg = `MEIO`, aproximado (AC4).
  - `faixaDeReferencia`: `{ mgKgMin, mgKgMax, origem, frequenciaHoras, duracaoUsualDias }`. `origem` `ESPECIE` (vence) ou `GERAL` (o bulário não traz a espécie, ou ela é proibida). Mostre ao lado do campo de dose.
  - `avisos`: do mais grave para o menos grave, cada um `{ codigo, bloqueante, cuidado, detalhe }`:

| `codigo` | Quando | `bloqueante` | `detalhe` |
|---|---|---|---|
| `ESPECIE_PROIBIDA` | O bulário contraindica o remédio na espécie | sim | a nota da espécie, traduzida |
| `ALERGIA` | Alerta de alergia do paciente casa com o princípio, em qualquer idioma (AC3) | sim | o texto do alerta |
| `PESO_AUSENTE` | Sem peso no pedido nem no cadastro | não | |
| `ACIMA_DA_USUAL` / `ABAIXO_DA_USUAL` | `mgPorKg` fora da faixa (da espécie, ou geral) | não | |
| `SEM_DOSE_DA_ESPECIE` | O bulário não traz a espécie: a faixa é a geral | não | |
| `CUIDADO` | Cuidado do remédio que casa com o paciente (`cuidado`: `RENAL`, `FILHOTE`...) | não | o texto do alerta, quando veio dele |

  - **`bloqueante: true`** não é bloqueio do servidor: a tela não segue sem o veterinário **confirmar explicitamente** (a receita, E4-03, vai registrar a confirmação). `exigeConfirmacao` resume se há algum.
  - `responsabilidade`: frase pronta, no idioma do pedido, dizendo que a conta é para conferência e que a dose e a decisão são do veterinário. **Mostre sempre junto da conta** (é a mitigação do risco Alto da spec).
- Medicamento global não revisado, desativado, de outra clínica ou inexistente, ou paciente de outra clínica: 403 sem `codigo`.
- Arredondamento (para os testes de tela baterem): mg por administração com 2 casas, quantidade com 2 casas, administrações por dia com 2 casas, total inteiro (mínimo 1), tudo meio para cima e em decimal exato.
- **Pronto quando:** o formulário de prescrição chama esta rota a cada mudança de dose, intervalo, duração ou peso (com debounce), mostra a conta em passos, a fração com a marca de aproximação, a faixa e os avisos, e `domain/dose.ts`, `domain/receita.ts` (`passosDaConta`, `fracionar`) e os avisos de `domain/bulario.ts` saem do portal.

### 1.6 Vacinas e o protocolo

`VacinaDto`: `{ id, origem, nome, fabricante, especies, dosesSerieFilhote, dosesSerieAdultoSemHistorico, idadeMinimaDias, essencial, vias, intervaloReforcoDias, intervaloEntreDosesDias, obrigatoria, estoqueMinimoPadrao, modoSerieFilhote, idadeMinimaUltimaDoseFilhoteDias, fonte, revisado, revisadoPor, revisadoEm, ativo }`.
- Renomeados do mock: `dosesNaSerie` virou `dosesSerieFilhote`, `dosesAdultoSemHistorico` virou `dosesSerieAdultoSemHistorico`, `estoqueMinimo` virou `estoqueMinimoPadrao`; o `INTERVALO_ENTRE_DOSES_DA_SERIE` (28) virou `intervaloEntreDosesDias`, por vacina.
- `vias`: `SUBCUTANEA`, `INTRAMUSCULAR`, `INTRANASAL`, `ORAL`... (a de rotina primeiro).
- **`modoSerieFilhote`** (pergunta clínica em aberto, regra das 16 semanas da WSAVA):
  - `FIXA`: `dosesSerieFilhote` doses, uma a cada `intervaloEntreDosesDias` (o que o mock faz hoje). Todas as vacinas de partida vêm assim.
  - `ATE_IDADE_MINIMA`: no mínimo `dosesSerieFilhote` doses, repetindo até uma ser dada com `idadeMinimaUltimaDoseFilhoteDias` ou mais (112 = 16 semanas).
  - O cálculo da próxima dose e do plano vacinal é da E4-04 (vacinação, seção 3): a API respeita os dois modos. Mostre o modo na tela de vacina; quando a seção 3 estiver ligada, `domain/protocolo-vacinal.ts` sai do portal.
- **Pronto quando:** a tela de vacinas e o seletor da aplicação leem do pacote, e `vacinasFixture` sai do caminho.

### 1.7 Acréscimos da clínica (DONO ou GESTOR)

O catálogo global é da PetJourney e só leitura para a clínica (D1). A clínica acrescenta o que é dela: um manipulado, uma vacina importada, um exame do laboratório parceiro, um código de diagnóstico próprio.

- **Listar os da clínica:** `GET /parceiro/portal/clinica/catalogos/acrescimos` devolve `{ medicamentos, vacinas, exames, diagnosticos }`, ativos e inativos, com o conteúdo como foi escrito e o `traducoes` cru (para editar).
- **Criar:** `POST /parceiro/portal/clinica/catalogos/{medicamentos|vacinas|exames|diagnosticos}` (aceita `Idempotency-Key`; mande uma por clique em "Salvar"). Resposta 201 com o item (`origem: PARCEIRO`). **Teto de 2.000 medicamentos próprios por clínica** (ativos ou não; re-auditoria 2 do G4): o 2.001º dá 409 `CATALOGO_MEDICAMENTOS_NO_LIMITE` com `limite`. Mostre "A clínica chegou ao limite de medicamentos próprios: reaproveite um que não prescreve mais" e leve para a lista de acréscimos. Desativar não libera lugar (o teto é do catálogo da clínica, como o das vacinas).
- **Editar:** `PATCH .../catalogos/{tipo}/:id` com o que muda; `ativo: false` desativa (nada se apaga), `true` reativa. `null` em campo obrigatório: 400. No medicamento, `doses` **substitui** a lista inteira.
- Medicamento: `{ nome, principioAtivo, sinonimosDoPrincipio?, concentracao, unidadeApresentacao, apresentacao, classe, controle?, listaControle?, viasPermitidas, doseUsualMgKgMin, doseUsualMgKgMax, indicacoes?, contraindicacoes?, efeitosAdversos?, interacoes?, cuidados?, observacao?, fonte?, doses?, traducoes? }`; cada dose `{ especie, mgKgMin, mgKgMax, frequenciaHoras, duracaoUsualDias?, proibido?, nota?, traducoes? }`.
- Vacina: os campos da seção 1.6 (sem `id`, `origem` e revisão) e `traducoes?` (`nome` por idioma).
- Exame: `{ nome, grupo, traducoes? }`. Diagnóstico: `{ codigo, codigoExterno?, descricao, sistema?, traducoes? }` (código com letras, números, ponto e hífen, até 20).
- `traducoes` é opcional para a clínica: `{ "en-US": { campo: texto }, ... }`, locales `en-US`, `en-GB`, `es-419`, `sr-Latn` (sem cirílico) e `ar`. Sem tradução, o item aparece no português em todos os idiomas.
- **Só os campos que a entidade traduz, no mesmo formato e com os mesmos limites do português** (revisão de segurança v0.3):
  - medicamento: `nome` e `principioAtivo` (texto, 2 a 120), `apresentacao` (2 a 200), `observacao` (até 1000); `indicacoes`, `contraindicacoes`, `efeitosAdversos` e `interacoes` (lista de até 30 itens, cada um de 1 a 300);
  - vacina e exame: `nome` (2 a 120); diagnóstico: `descricao` (2 a 200); nota da dose: `nota` (até 300).
  - Texto vazio (`""`) = sem tradução naquele idioma (o campo sai). en-GB que não vier é copiado do en-US.
  - Fora disso: 400 `CATALOGO_TRADUCAO_INVALIDA` com `campo` (ex.: `en-US.nome`, `es-419.indicacoes[3]`, `doses.GATO.ar.nota`), `motivo` e o limite (`min`, `max` ou `aceitos`). `motivo`: `LOCALE_INVALIDO`, `FORMATO`, `CAMPO_DESCONHECIDO`, `TIPO` (lista onde é texto ou o contrário), `TAMANHO`, `ITENS_DEMAIS`, `CIRILICO`. Leve o foco ao campo.
- **Sinônimos do princípio:** até 20 **no total**, contando o princípio e as grafias que vêm das traduções do `principioAtivo` (a API junta os três). Passou: 400 `CATALOGO_SINONIMOS_DEMAIS` com `max` e `total`.
- Erros: ver seção 1.8.
- **Pronto quando:** a clínica (DONO ou GESTOR) cadastra, edita e desativa os próprios itens, e eles aparecem marcados como "da clínica" na busca e no pacote.

### 1.8 Erros desta seção

| `codigo` | Status | Quando | Extra |
|---|---|---|---|
| `CATALOGO_NOME_EM_USO` | 409 | Outro item ativo da clínica com o mesmo nome (sem diferenciar maiúscula) | `tipo` |
| `DIAGNOSTICO_CODIGO_EM_USO` | 409 | Código já usado por um diagnóstico ativo da clínica ou do catálogo global | `codigoClinico` |
| `DOSE_FAIXA_INVALIDA` | 400 | Dose mínima maior que a máxima | `especie` ou `campo` |
| `DOSE_ESPECIE_REPETIDA` | 400 | A mesma espécie duas vezes nas doses | `especie` |
| `VACINA_SERIE_INVALIDA` | 400 | `ATE_IDADE_MINIMA` sem a idade, ou `FIXA` com ela | `modoSerieFilhote` |
| `CATALOGO_TRADUCAO_INVALIDA` | 400 | Tradução com campo que a entidade não traduz, tipo errado, tamanho fora do limite, lista com mais de 30 itens, locale inválido ou cirílico no sr-Latn | `campo`, `motivo`, `min`/`max`/`aceitos` |
| `CATALOGO_SINONIMOS_DEMAIS` | 400 | Mais de 20 grafias do princípio, contando as traduções | `max`, `total` |
| (sem `codigo`) | 403 | Item de outra clínica, global (para editar) ou inexistente; paciente de outra clínica | |
| `SEM_PERMISSAO` / `CRMV_OBRIGATORIO` | 403 | Papel sem a permissão; dose sem CRMV | `permissao` |
| `MODULO_INATIVO` / `MODULO_SOMENTE_LEITURA` | 403 | Módulo Clínica desligado ou só de consulta | `modulo`, `reason` |

---

## 2. Curadoria do catálogo global no CMS (E4-02)

**Superfície:** `petjourney-cms`, área de admin (SystemAdmin). Tela nova "Catálogos clínicos".

O catálogo global entrou no dev a partir do protótipo do portal (34 faixas, 12 diagnósticos, 9 exames, 16 medicamentos com 34 doses, 6 vacinas), **todo marcado como não revisado**. Bulário não revisado não aparece para prescrição. A tela de curadoria é por onde o responsável técnico da PetJourney confere cada item, registra a fonte e libera.

### 2.1 Rotas (todas `JwtAuthGuard` + SystemAdmin)

| Rota | O quê |
|---|---|
| `GET /admin/catalogos-clinicos/{faixas,medicamentos,vacinas,exames,diagnosticos}?q=&especie=&revisado=&ativo=&pagina=&limite=` | Lista o global, paginado (`{ itens, total, pagina, limite }`, limite até 200). `revisado=false` = a fila de pendentes |
| `POST /admin/catalogos-clinicos/{tipo}` | Cria item global (nasce **não revisado**). Mesmo corpo dos acréscimos da clínica (guia seção 1.7); faixa: `{ vital, especie, porte?, faixaEtaria?, min, max, unidade, precisao?, fonte? }` |
| `PATCH /admin/catalogos-clinicos/{tipo}/:id` | Edita. **`motivo` obrigatório** (5 a 500 caracteres; sem ele: 400 `CURADORIA_MOTIVO_OBRIGATORIO` com `min` e `max`, e nada muda). Toda edição gera protocolo `CUR` com os campos que mudaram e o antes e o depois dos números clínicos (doses, proibido, cuidados, faixa). **Mudar qualquer campo além de `ativo` derruba a revisão** de faixa, medicamento e vacina (o item sai da prescrição até revisar de novo). Avise isso no botão salvar de item revisado |
| `POST /admin/catalogos-clinicos/{faixas,medicamentos,vacinas}/:id/revisao` `{ revisadoPor, fonte, motivo? }` | Revisão clínica: `revisadoPor` no formato `CRMV-SP 12345` (o CRMV do responsável técnico), `fonte` (bula, referência), `motivo` opcional. Devolve `{ protocolo, tipo, id, revisado, revisadoPor, revisadoEm, fonte }` |
| `POST /admin/catalogos-clinicos/{faixas,medicamentos,vacinas}/:id/revisao/revogar` `{ motivo }` | Tira a revisão (o item sai da prescrição), com motivo |

- Os itens do admin vêm no conteúdo canônico (pt-BR) com o `traducoes` cru, para editar os 6 idiomas lado a lado.
- **Editar pede o motivo**: o formulário de edição do item global tem um campo "Motivo da alteração" obrigatório, enviado como `motivo` no mesmo corpo do `PATCH`. O motivo vai para o protocolo `CUR` (nunca para o log). O código do protocolo não volta na resposta do `PATCH`; ele fica no `ProtocoloAdmin` do item (`entidadeId` = id do item).
- As traduções passam pelo mesmo validador da clínica (seção 1.7): só os campos da entidade, com os limites do português; erro 400 `CATALOGO_TRADUCAO_INVALIDA` com `campo` e `motivo`. O conteúdo de partida inteiro passa nele, então reenviar o `traducoes` que a lista devolveu funciona.
- **Revisar exige traduções completas** (D6): `nome`, princípio, apresentação, observação e cada lista com o **mesmo número de itens** do português, nos 5 idiomas além do pt-BR, mais a nota de cada dose. Faltando: 400 `REVISAO_TRADUCAO_INCOMPLETA` com `faltando` (até 20, ex.: `en-GB.contraindicacoes`, `doses.GATO.ar.nota`) e `totalFaltando`. Mostre a lista e leve aos campos.
- Revogar item que não está revisado: 409 `ITEM_NAO_REVISADO`. Faixa repetida (mesma espécie, sinal, porte e idade entre as ativas): 409 `FAIXA_DE_REFERENCIA_DUPLICADA`; mínimo acima do máximo: 400 `FAIXA_DE_REFERENCIA_INVALIDA`.
- Cada revisão e cada revogação geram protocolo `CUR-AAAA-NNNNNN`. O payload da revisão guarda o conteúdo exato que foi revisado; consulte pelo código em `GET /admin/protocolo/:codigo`, a rota que o CMS já usa (a lista por parceiro não traz estes, que são do catálogo, não de um parceiro).
- Acréscimos de clínica não aparecem aqui e não passam pela curadoria.

### 2.2 A tela

- Abas por tipo; filtro "pendentes de revisão" ligado por padrão em medicamentos, faixas e vacinas.
- No medicamento: os campos clínicos, as doses por espécie (com "proibido na espécie" e a nota), o regime de controle e a lista, os 6 idiomas lado a lado, e o bloco "Revisão" com CRMV, fonte e motivo.
- Na vacina: o protocolo inteiro, inclusive o modo da série de filhote (`FIXA` ou `ATE_IDADE_MINIMA` com a idade). A escolha entre os dois é **pergunta clínica em aberto** (regra das 16 semanas da WSAVA): não mude o padrão sem a resposta do responsável técnico.
- **Pronto quando:** o responsável técnico consegue achar os pendentes, corrigir o conteúdo e as traduções, revisar com CRMV e fonte e ver o protocolo, e o item revisado passa a aparecer na busca do portal.

---

## 3. Vacinação conectada no portal (E4-04)

Substitui no mock (`petjourney-admin`):
- `vacina-repository.ts` inteiro (`aplicar`, `registrarExterna`, `plano`, `lotesParaAplicar`, `listaDeChamada`, `aplicadas`, `doPaciente`, `naCarteirinha`);
- as regras de `domain/protocolo-vacinal.ts`, `domain/vacinacao.ts` (`proximaDose`, `situacaoDoReforco`, `reforcosDoPaciente`, `listaDeChamada`) e `domain/lote-na-aplicacao.ts`, que viraram golden tests na API (`src/vacinacao-clinica/regras/`);
- a prévia do celular (`CarteirinhaNoApp.vue`) passa a ler as rotas do app (seção 4), com o token de quem é dono do pet só na demonstração; na clínica real a prévia sai ou lê o plano da clínica (seção 3.3).

Apague a regra local quando a rota estiver ligada: a tela não calcula dose, série, próxima dose, situação nem validade.

### 3.1 Quem entra

- **Módulo:** Clínica ligado em todas as rotas (sem ele: 403 `MODULO_INATIVO`; só de consulta: as leituras funcionam, as escritas dão 403 `MODULO_SOMENTE_LEITURA`).
- **Permissão** (sem ela: 403 `SEM_PERMISSAO` com `permissao`):

| O quê | Permissão | Quem tem |
|---|---|---|
| Plano e histórico do paciente | `paciente.ler` | DONO, GESTOR, RECEPÇÃO, VETERINÁRIO, ENFERMAGEM |
| Aplicar, registrar de outro lugar, anular, lotes para aplicar | `vacina.aplicar` | DONO, VETERINÁRIO, ENFERMAGEM (sem exigir CRMV) |
| Aplicar **com** `marcarProxima` (cria agendamento) | `vacina.aplicar` e `agenda.escrever` | DONO, VETERINÁRIO (a ENFERMAGEM não marca: 403) |
| Aplicadas no período e lista de chamada | `agenda.ler` | DONO, GESTOR, RECEPÇÃO, VETERINÁRIO, ENFERMAGEM |

- Esconda "Aplicar vacina", "Registrar de outro lugar" e "Anular" pelo `GET /parceiro/portal/eu`; esconda "Marcar a próxima dose" no diálogo de aplicar para quem não tem `agenda.escrever` (revisão v0.3).
- **Paciente, vacina, profissional, tipo de atendimento ou aplicação de outra clínica (ou que não existe):** 403 sem `codigo`, sem dizer qual. A vacina pode ser do catálogo global ou acréscimo da própria clínica (E4-02).

### 3.2 Aplicar (`POST /parceiro/portal/pacientes/:id/vacinas/aplicar`)

Corpo: `{ vacinaId, loteCodigo, validadeLote, via, profissionalId, aplicadaEm?, observacao?, confirmarIdadeMinima?, marcarProxima? }`. Aceita `Idempotency-Key` (mande uma por clique em "Aplicar e registrar": a repetição devolve a mesma aplicação).

- **A dose não vem da tela.** A API calcula `dose`, `dosesNaSerie`, `tipoDeSerie` (`FILHOTE` ou `ADULTO`) e `proximaDoseEm` e congela na aplicação. O diálogo mostra o que o plano (3.3) diz que é a dose da vez; o "2 de 3" que a tela previu é o que a API grava.
- `loteCodigo` (até 40: letras, números, espaço, `.`, `/`, `-`, `_`) e `validadeLote` (`AAAA-MM-DD`) são **obrigatórios** na aplicação da clínica. Sem estoque (E6-01 ainda não existe), o lote é digitado; o seletor vem de 3.4.
- `via`: uma das `vias` da vacina no catálogo (fora delas: 409 `VIA_INVALIDA` com `viasPermitidas`). Defeito 2 do doc 13: nada de via fixa em subcutânea no atendimento.
- `profissionalId`: quem aplicou (qualquer profissional ativo da clínica, não só quem atende). Inativo: 409 `PROFISSIONAL_INDISPONIVEL`.
  - **O CRMV dele só vai ao app se a clínica o confirmou** (revisão v0.3): quem grava é o próprio profissional, ou é DONO ou GESTOR. Senão a dose vai ao app sem CRMV ("CRMV não confirmado") e com o nome de quem gravou. A resposta traz `crmvConfirmado`; mostre no diálogo, antes de gravar, "no app: CRMV não confirmado" quando o usuário escolhe outro profissional e não é DONO/GESTOR.
- `aplicadaEm` (ISO com offset): padrão agora; até 30 dias para trás; no futuro: 400 `APLICACAO_DATA_INVALIDA` (`reason`: `FUTURO`, `PASSADO_DEMAIS`, `ANTES_DO_NASCIMENTO`).
- **Lote vencido trava no servidor:** validade antes do dia da aplicação (na parede da clínica): 409 `LOTE_VENCIDO` com `validadeLote` e `aplicadaEm`. A validade vale até o fim do dia impresso.
- **Idade mínima:** antes dela, 409 `IDADE_MINIMA_NAO_ATINGIDA` com `aPartirDe`, `idadeMinimaDias` e `exigeConfirmacao: true`. Mostre "o paciente só tem idade para esta vacina a partir de {data}" e, se o veterinário confirmar, reenvie com `confirmarIdadeMinima: true` (a resposta traz o aviso `IDADE_MINIMA_CONFIRMADA`).
- **Uma dose por vacina por dia:** a mesma vacina de novo no mesmo dia: 409 `APLICACAO_REPETIDA` com `aplicacaoId` (abra a que já existe). Data anterior à última dose daquela vacina: 409 `APLICACAO_FORA_DE_ORDEM` com `ultimaEm` (registre em ordem ou anule a errada).
- Vacina desativada: 409 `VACINA_INATIVA`; de outra espécie: 409 `VACINA_FORA_DA_ESPECIE`. Paciente inativo, com óbito ou mesclado: 409 `PACIENTE_INATIVO`.
- **`marcarProxima`** `{ inicio, profissionalId, tipoId?, confirmarConflitos? }`: marca a próxima dose na agenda no mesmo gesto (decisão 6 do doc 13).
  - **Exige também `agenda.escrever`** (revisão v0.3): sem ela (a ENFERMAGEM), 403 `SEM_PERMISSAO` com `permissao: "agenda.escrever"` e **nada é gravado** (nem a dose). Não reenvie a mesma chamada: tire o `marcarProxima` ou peça a quem tem agenda.
  - Só quando a próxima dose cai em até **60 dias** e o horário escolhido também (o reforço anual vai para a lista de chamada): fora disso, 409 `PROXIMA_DOSE_FORA_DA_JANELA` com `limiteDias` e nada é gravado.
  - `tipoId` omitido: o primeiro tipo de atendimento ativo de `kind` `VACINA` da clínica; sem nenhum, 409 `MARCAR_PROXIMA_SEM_TIPO`.
  - O horário sai da mesma busca de horários livres do retorno (`GET .../agenda/sugestoes`). Feriado com a clínica fechada pede `confirmarConflitos: ["holiday-closed"]`, como no POST da agenda.
  - A agenda é chamada **depois** de a dose estar gravada. Se ela recusar (conflito bloqueante, profissional fora da agenda), a dose fica e a resposta diz: `marcacao: { status: "RECUSADA", codigo }`. Mostre "dose registrada; o horário não foi marcado: {motivo}" e ofereça marcar pela agenda. `MARCADA` traz `agendamentoId`; sem pedido, `NAO_PEDIDA`. G2 (28/10): `marcacao.conflitos` (o mesmo `ConflitoDto` da agenda, seção 2.3 do guia da E3) traz os avisos do horário marcado, como o `pedido-pendente` de um pedido online ou de uma oferta da fila no mesmo horário. Eles não bloqueiam; mostre-os como na agenda. Vazio nos outros casos. A próxima dose marcada (origem `RETORNO`) também tira o paciente da fila de espera da vacina (guia da E3, 5.11).
- Resposta 201 `ResultadoDaAplicacaoDto`: a aplicação (`AplicacaoDeVacinaDto`, 3.5) mais:
  - `publicacao: { publicada, motivo }`: `true` quando o paciente tem vínculo ATIVO com o app (a carteirinha do responsável mudou agora); `false` com `SEM_VINCULO_ATIVO` (fica só na clínica) ou `DOSE_EXTERNA`. Mostre "na carteirinha do app de {responsável}" só quando `publicada`.
  - `marcacao` (acima) e `avisos`: `LOTE_VENCE_HOJE`, `LOTE_VENCENDO` (até 60 dias: "é o primeiro a vencer: use este antes dos outros"), `IDADE_MINIMA_CONFIRMADA`.
- **Um push só por ato:** com a próxima dose marcada na mesma gravação, o responsável recebe só `VACINA_REGISTRADA_PELA_CLINICA` (nunca também um aviso de agendamento).

### 3.3 Plano vacinal, histórico e dose de outro lugar

- **Plano:** `GET /parceiro/portal/pacientes/:id/vacinas/plano` devolve `PlanoVacinalDto` `{ pacienteId, idadeEmDias, faixa, hoje, vacinas, opcionaisNaoIniciadas, atrasadas, devidas }`.
  - `vacinas[]`: `{ vacina, tipoDeSerie, situacao, aplicadasNaSerie, total, serieCompleta, doses, proxima }`, ordenadas por ação (`ATRASADA`, `DEVIDA`, `A_VENCER`, `NAO_INICIADA`, `AGUARDA_IDADE`, `EM_DIA`) e, dentro disso, pela ordem do catálogo. `vacina` tem `id, nome` (traduzido), `fabricante, obrigatoria, essencial, origem, revisado`.
  - `doses[]`: `{ numero, total, tipo (SERIE|REFORCO), estado, em, dias, aplicacaoId, agendamento }`. `estado`: `APLICADA`, `DEVIDA` (a data chegou, dentro da carência de 3 dias), `ATRASADA` (passou da carência: o mesmo relógio do `VACINA_ATRASADA` do app), `PREVISTA`, `AGUARDA_IDADE` (o `em` é o dia em que passa a caber: "a partir de {data}", nunca "atrasada"), `PENDENTE` (essencial nunca começada, com idade).
  - O tamanho da série segue o **modo do catálogo** (seção 1.6): `FIXA` ou `ATE_IDADE_MINIMA` (regra das 16 semanas). No segundo, a série pode crescer ou encurtar dose a dose ("2 de 4" vira "3 de 3" quando a dose atrasa); mostre o `total` que vier, sem explicar a regra na tela até a pergunta clínica ser respondida.
  - Opcional não iniciada fica em `opcionaisNaoIniciadas` (recolhida, nunca pendência). Vacina desativada no catálogo sai do que falta, mas a que o paciente já tomou continua no plano.
  - **Plano cortado** (revisão v0.3): `doses` traz as dadas, **a da vez e a seguinte** (ou o próximo reforço), nunca a série inteira prevista; desenhe os pontos pelo `total`. O plano tem teto de 64 KB: com `truncado: true`, faltam `vacinasOmitidas` vacinas do fim da lista (as que menos pedem ação) e `opcionaisOmitidas` opcionais; mostre "e mais N vacinas em dia". `atrasadas` e `devidas` são do plano inteiro.
- **Histórico:** `GET /parceiro/portal/pacientes/:id/vacinas` → `{ itens: AplicacaoDeVacinaDto[], truncado }`, da mais recente para a mais antiga, **anuladas inclusive** (com `anulada`), até 300 e 256 KB (`truncado`).
  - **`observacao` vem `null` para quem não tem `prontuario.ler`** (RECEPÇÃO e GESTOR, revisão v0.3): esconda o campo para esses papéis em vez de mostrar "sem observação".
- **Dose de outro lugar:** `POST /parceiro/portal/pacientes/:id/vacinas/externa` `{ vacinaId, aplicadaEm (AAAA-MM-DD, o dia do papel), local, aplicador?, procedencia (COMPROVANTE|RELATO), via?, profissionalId, observacao? }` (aceita `Idempotency-Key`).
  - **Sem lote** (nem campo): a clínica não aplicou. `profissionalId` é quem **transcreveu** e responde pelo registro.
  - Conta para o protocolo (a dose e a série saem do mesmo cálculo, pela data do papel) e entra na lista de chamada.
  - **Não vai para o app como vacina da clínica** (sem selo e sem push): o responsável a vê em `GET /tutor/clinica/vacinas` como `EXTERNA`, com o local e a procedência (seção 4).
  - Mesmas recusas de ordem, espécie, vacina inativa e paciente inativo de 3.2; data no futuro ou antes do nascimento: 400.

### 3.4 Lotes para aplicar

`GET /parceiro/portal/clinica/vacinas/:vacinaId/lotes-para-aplicar` → `{ estoque, hoje, lotes }`.
- **Sem estoque (E6-01), `estoque: false`:** os lotes são os já digitados nesta clínica para a vacina nos últimos 180 dias (até 20), com `saldo: null`. Quando o estoque existir, a mesma rota devolve a geladeira com saldo.
- Cada lote `{ codigo, validade, saldo, avaliacao: { pode, motivo, aviso, dias }, sugerido }`: os que podem primeiro, do que vence antes (`sugerido` em um só); os travados no fim (`motivo` `VENCIDO` ou `SEM_VALIDADE`), para não sumirem e alguém digitar à mão. `aviso` `VENCE_HOJE` ou `VENCENDO` (até 60 dias, a janela do estoque).
- O campo continua aceitando lote digitado; a trava do vencido é do servidor (3.2).

### 3.5 Anular, aplicadas e o formato da aplicação

- **Anular:** `POST /parceiro/portal/clinica/aplicacoes/:id/anular` `{ motivo (5 a 500) }` → 200 `AplicacaoDeVacinaDto` com `anulada: { em, motivo }`.
  - Nada se apaga: a aplicação fica no histórico, riscada. A dose anterior daquela vacina volta a ser a que cobra.
  - No app: a `Vacina` publicada sai, o lembrete da próxima dose sai, o lembrete que a aplicação tinha fechado volta a pendente, e o responsável recebe `CLINICA_ANULOU_REGISTRO` (sem nome de vacina).
  - O horário marcado para a próxima dose **fica na agenda** (a recepção decide; ele vem em `agendamentoProxima`). Ofereça "cancelar o horário da próxima dose" depois de anular.
  - Já anulada: 409 `APLICACAO_JA_ANULADA`. Com estoque (E6-01), a dose volta ao saldo do lote.
  - A aplicação mudou de ficha (o paciente foi mesclado enquanto a tela estava aberta): 409 `APLICACAO_ALTERADA`. Releia a ficha do paciente que ficou e ofereça anular de novo.
- **Aplicadas:** `GET /parceiro/portal/clinica/vacinas/aplicadas?de=&ate=&cursor=&limit=` (até 92 dias; senão 400 `VACINACAO_PERIODO_INVALIDO`; `limit` até 100, padrão 50; `proximoCursor`) → itens `{ id, aplicadaEm, paciente: { id, nome, especie }, vacina, origem, dose, dosesNaSerie, lote, profissional, anulada }`. É "o que a clínica fez" (farmacovigilância, conferência de lote).
- **`AplicacaoDeVacinaDto`:** `{ id, pacienteId, vacina, origem (CLINICA|EXTERNA), profissional: { id, nome, crmv }, aplicadaEm, lote: { codigo, validade } | null, via, dose, dosesNaSerie, tipoDeSerie, proximaDoseEm, agendamentoProxima: { id, inicio, status } | null, externa: { local, aplicador, procedencia } | null, observacao, crmvConfirmado, situacao, vigente, vacinaDaCarteiraId, anulada, criadaEm }`.
  - `profissional.crmv` é o do cadastro (dado interno); `crmvConfirmado` diz se ele foi ao app (revisão v0.3).
  - `situacao` (`EM_DIA`, `PROXIMO`, `VENCIDO`, `SERIE_INCOMPLETA`) só cobra na dose `vigente` (a última não anulada daquela vacina); as anteriores vêm `EM_DIA` (defeito 1 do doc 13).
  - Datas com o offset da clínica; `proximaDoseEm` e `validade` em `AAAA-MM-DD`.

### 3.6 Lista de chamada e o contador

- `GET /parceiro/portal/clinica/vacinas/chamada?situacao=&cursor=&limit=` → `{ hoje, itens, proximoCursor }`, do mais atrasado para o menos (`diasParaVencer` negativo = venceu).
  - Entram: `VENCIDO` (passou da carência de 3 dias, até 2 anos atrás), `SERIE_INCOMPLETA` (série aberta) e `PROXIMO` (reforço em até 30 dias). Quem está em dia não entra. `situacao` filtra uma delas.
  - Fica de fora: paciente inativo, com óbito ou mesclado, e vacina desativada.
  - Cada item: `{ aplicacaoId, paciente, cliente: { id, nome, telefone }, vacina, ultimaEm, proximaDoseEm, diasParaVencer, situacao, doseSeguinte, agendamentoProxima }`. O telefone é para ligar; a recepção tem `agenda.ler`.
  - Paginação por cursor (até 100 por página). Medido numa clínica de 3.000 pacientes e 24.000 aplicações: ~180 ms por página no dev, 29 KB por página de 50.
- **Contador `vacinasAtrasadas`** (E1-06) em `GET /parceiro/portal/pendencias?modulo=CLINICA`: os vencidos da lista de chamada (paciente ativo), tom `RISCO`, `rota` `/veterinario/vacinas`, para quem tem `agenda.ler`. Cache de 30 s, como os outros.

### 3.7 Erros desta seção

| `codigo` | Status | Quando | Extra |
|---|---|---|---|
| `LOTE_VENCIDO` | 409 | Validade antes do dia da aplicação | `validadeLote`, `aplicadaEm` |
| `VIA_INVALIDA` | 409 | Via fora das vias da vacina | `viasPermitidas` |
| `IDADE_MINIMA_NAO_ATINGIDA` | 409 | Antes da idade mínima, sem `confirmarIdadeMinima` | `aPartirDe`, `idadeMinimaDias`, `exigeConfirmacao` |
| `VACINA_FORA_DA_ESPECIE` / `VACINA_INATIVA` | 409 | Vacina de outra espécie; desativada no catálogo | `especies`; `vacinaId` |
| `APLICACAO_REPETIDA` | 409 | A mesma vacina no mesmo dia | `aplicacaoId` |
| `APLICACAO_FORA_DE_ORDEM` | 409 | Data anterior à última dose daquela vacina | `ultimaEm` |
| `APLICACAO_DATA_INVALIDA` | 400 | Futuro, mais de 30 dias para trás (clínica), antes do nascimento | `reason` |
| `PROXIMA_DOSE_FORA_DA_JANELA` | 409 | `marcarProxima` com a próxima dose ou o horário a mais de 60 dias | `limiteDias`, `proximaDoseEm?` |
| `MARCAR_PROXIMA_SEM_TIPO` | 409 | Sem `tipoId` e sem tipo `VACINA` ativo | |
| `APLICACAO_JA_ANULADA` | 409 | Anular de novo | |
| `APLICACAO_ALTERADA` | 409 | Anular uma aplicação que a mescla levou para outro paciente: releia a ficha | `reason: PACIENTE_MUDOU` |
| `SEM_PERMISSAO` | 403 | Aplicar com `marcarProxima` sem `agenda.escrever` (ENFERMAGEM); nada gravado | `permissao: agenda.escrever` |
| `VACINACAO_PERIODO_INVALIDO` | 400 | Aplicadas com mais de 92 dias ou fim antes do início | `maxDias` |
| `VACINACAO_TAXA_EXCEDIDA` | 429 | Mais de 300 escritas de vacinação por usuário por hora | `limite`, `tenteDeNovoEmSegundos` |
| `AGENDA_DATA_FORA_DO_LIMITE` | 400 | Data com ano fora de 2000 a 2100 | `campo` |
| `PACIENTE_INATIVO` / `PROFISSIONAL_INDISPONIVEL` | 409 | Paciente inativo, com óbito ou mesclado; aplicador inativo | `obito`; `reason` |
| (sem `codigo`) | 403 | Recurso de outra clínica ou inexistente | |

- **Pronto quando:** a ficha do paciente mostra o plano e o histórico da API; o diálogo de aplicar usa os lotes de 3.4, trata a idade mínima com confirmação e marca a próxima dose (só para quem tem `agenda.escrever`); "Registrar de outro lugar" grava sem lote; a lista de chamada e a tela "Vacinas" leem a API; anular funciona com motivo; o plano cortado mostra "e mais N"; e `vacina-repository.ts`, `protocolo-vacinal.ts`, `vacinacao.ts` e `lote-na-aplicacao.ts` saem do portal.

---

## 4. Carteirinha conectada no app (E4-04)

**Superfície:** `petjourney-app`. É o doc 14 do portal (`petjourney-admin/docs/clinico/14-carteirinha-visao-do-responsavel.md`) com o contrato real da API. Nenhuma tela nova: a carteira que já existe (`app/screens/vacina/lista.tsx`) passa a mostrar o que a clínica registrou e ganha o bloco de protocolo.

### 4.1 O que chega

- **A dose da clínica já está em `GET /vacina?petId=`** (E2-04): `origem: PARCEIRO`, `aplicadaNaClinica: true`, `lote`, `validadeLote`, `fabricante`, `dose`, `dosesNaSerie`, `via`, `parceiroId`, `profissionalNome`, `profissionalCrmv`, `gravadaPorNome` (revisão v0.3). `profissionalCrmv: null` numa dose da clínica = "CRMV não confirmado" (a clínica não confirmou o CRMV de quem aplicou); `gravadaPorNome` preenchido = quem gravou não é quem aplicou: mostre os dois. É **uma linha só** por aplicação (a publicação fecha o lembrete VACINA pendente de mesmo nome e cria a próxima dose como lembrete com a data da clínica). Somente leitura: esconda "editar" quando `origem = PARCEIRO` (PATCH dá 403 `REGISTRO_DA_CLINICA`); "remover do meu app" continua valendo.
- **`GET /tutor/clinica/vacinas?petId=`** → `VacinaAplicadaNaClinicaDto[]`: as doses que as clínicas com vínculo ATIVO registraram, inclusive as **de outro lugar** que elas transcreveram:
  - `{ id, petId, clinica: { id, nome }, origem, profissional: { nome, crmv } | null, gravadaPor: { nome } | null, vacina: { nome, fabricante, obrigatoria, essencial }, aplicadaEm, lote, validadeLote, via, dose, dosesNaSerie, proximaDoseEm, proximaDoseAgendada: { agendamentoId, inicio } | null, situacao, externa, vacinaDaCarteiraId }`.
  - **Autoria (revisão v0.3):** `profissional.crmv` (e `externa.registradaPor.crmv`) vem `null` quando a clínica não confirmou o CRMV: mostre "CRMV não confirmado". `gravadaPor` vem quando quem gravou não é o profissional do registro: "Aplicada por {profissional.nome} · registrada por {gravadaPor.nome}".
  - **Só as doses do vínculo** (revisão v0.3): entram as aplicadas ou registradas desde que este pet foi ligado à clínica, ou publicadas para ele. As de antes (o paciente da clínica pode ter sido ligado a outro pet) não vêm; o plano as conta (abaixo).
  - Teto de 256 KB (as mais antigas saem primeiro).
  - `vacinaDaCarteiraId` é a `Vacina` de `GET /vacina` que esta aplicação publicou: use para juntar o selo e a linha (nunca mostre as duas).
  - `situacao` já vem com a carência e **só a dose mais recente de cada vacina cobra** (a dose 1 de uma série já seguida pela 2 vem `EM_DIA`, sem horário). Não aplique `vacinaEstaAtrasada` de novo.
  - `externa`: `{ local, aplicador, procedencia (COMPROVANTE|RELATO), registradaPor: { nome, crmv }, registradaEm }`; na `EXTERNA`, `profissional`, `lote` e `validadeLote` vêm nulos. **Selo só na `CLINICA`** ("Aplicada · {clinica.nome}"); a externa mostra "Outro local · {local}" e "Registrada por {clínica} · comprovante conferido" ou "sem comprovante" (tom de atenção).
  - Sem clínica com vínculo: `[]`. Pet de outra pessoa: 403.
- **`GET /tutor/clinica/vacinas/plano?petId=`** → `PlanoVacinalDoPetDto[]`, **um por clínica** com vínculo ATIVO (o catálogo e as doses são de cada clínica; o contrato do portal previa um só): `{ petId, clinica, geradoEm, vacinas, opcionaisNaoIniciadas, atrasadas }`.
  - `vacinas[]`: `{ vacina, tipoDeSerie, situacao, aplicadasNaSerie, total, doses: [{ numero, total, tipo, estado, em, aplicacaoId, agendamento }], aplicadasAntesDoVinculo }`, com os estados e a ordem da seção 3.3.
  - **Revisão v0.3:** `doses` traz as dadas desde o vínculo, a da vez e a seguinte (não a série inteira: desenhe os pontos pelo `total` e `aplicadasNaSerie`); `aplicadasAntesDoVinculo` são doses que contam no plano mas não têm detalhe para este pet (mostre só "N doses anteriores registradas pela clínica").
  - Cada plano tem `truncado`, `vacinasOmitidas` e `opcionaisOmitidas` (teto de 64 KB por clínica e 256 KB na soma). Uma clínica que passou do teto total vem só com o cabeçalho (`vacinas: []`, `truncado: true`): peça `GET /tutor/clinica/vacinas/plano?petId=&clinicaId={clinica.id}` quando o responsável abrir aquele bloco.
  - O plano da clínica **vale mais** que o `intervaloProximaDose` do app (`constants/vacina-protocols.ts`) para o que ela registrou: o app não recalcula a próxima dose.
  - Calculado na hora (muda com o calendário); não guarde cópia. Pet sem clínica: `[]` (a carteira segue como é, sem o bloco).
- **Família com leitura** lê as duas rotas e não altera nada (403 em editar e apagar). Pet inativo some para a família, como no resto da E2-02.

### 4.2 A tela

- Bloco "Protocolo · {clínica}" acima dos cartões, uma linha por vacina em andamento ou que pede ação, com os pontos (`total` pontos, cheios até `aplicadasNaSerie`), a frase da dose da vez pelo `estado` ("Atrasada há N dias", "Dose para hoje", "A partir de {data}", "Ainda não começou", "Próxima dose {data}") e "Marcada {data}, {hora}" quando há `agendamento`. Opcionais não iniciadas numa linha pequena.
- Com mais de uma clínica, um bloco por clínica (a ordem é a do vínculo mais recente).
- Textos nos 6 idiomas (pt sem "tutor", sem travessão); os do portal (`clinico.vacinas.app.*`) servem de base.

### 4.3 Notificações

| Tipo | Quando | Copy (pt) | Rota na API (`ROTA_POR_TIPO`) |
|---|---|---|---|
| `VACINA_REGISTRADA_PELA_CLINICA` (E2-04) | A clínica aplicou (uma por ato; a dose de fora não avisa) | "Vacina de {pet} registrada" | `/screens/notifications` (o inbox, até o app mapear) |
| `CLINICA_ANULOU_REGISTRO` (E2-04) | A clínica anulou | "Registro de {pet} corrigido pela clínica" | `/screens/notifications` |
| **`VACINA_REFORCO_PROXIMO`** (novo, E4-04) | Cron diário: o reforço de uma vacina que a clínica **aplicou** entra nos 30 dias (uma vez por aplicação; nunca para dose de outro lugar, paciente com óbito, pet inativo ou sem vínculo ativo) | "Reforço de vacina de {pet} chegando" / "Uma vacina registrada pela clínica tem reforço nos próximos 30 dias. Abra a carteirinha para ver." | **`/screens/vacina/lista`**, com `?petId=` na `url` dos dados |

- No app, `services/notificacao/rotas-notificacao.ts` ganha `VACINA_REFORCO_PROXIMO` nos três mapas, na mesma release da API: o tipo em `TipoNotificacao`; a rota `/screens/vacina/lista` (com `petId` dos `dados`); `AFETA_HOME_POR_TIPO: false` (não muda o feed de lembretes); `PERFIL_POR_TIPO: "tutor"`.
- `dados` do novo: `{ parceiroId, petId, petNome, aplicacaoId, proximaDoseEm, url }`. Sem nome de vacina nem de clínica no push (P8 da receita).
- Teto (revisão v0.3): no máximo 6 avisos de vacina (registrada ou anulada) por pet por dia; passou, a carteira muda e o push não sai. O app sempre relê a carteira ao abrir, sem depender do push.
- Sugestão para quando a carteira mostrar a dose da clínica: `VACINA_REGISTRADA_PELA_CLINICA` pode passar a abrir `/screens/vacina/lista` também (a API troca a rota na mesma release do app; avise).
- **Pronto quando:** a carteira do Biscoito mostra "2 de 3" com o selo da clínica e o lote, a dose de fora sem selo, o bloco de protocolo com a 3ª dose marcada e a antirrábica em "A partir de", nenhuma vacina aparece duas vezes, o app não calcula próxima dose para o que veio da clínica, e o toque em `VACINA_REFORCO_PROXIMO` abre a carteira do pet certo.

---

## 5. Prontuário: atendimento, retorno, atos e linha do tempo (E4-01)

**Backend:** E4-01a (núcleo) e E4-01b (retorno, atos, linha do tempo, listas, contadores e o aviso `RETORNO_PENDENTE`) prontas e validadas em dev em 2026-10-28: unit, integração no Postgres de dev e smoke por HTTP (`scripts/smoke-prontuario.ts`). **Não está em produção** (gate: parecer jurídico Q-JUR1/Q-JUR5 e as migrations com trigger aplicadas pelo Nicolas).
**Spec:** `docs/specs/2026/q4/q4-1/portal-parceiro/e4-prontuario/01-atendimento-e-prontuario.md` (decisões do gerente de 2026-10-27, 1 a 20).
**Para:** portal web (`petjourney-admin`) e app (`petjourney-app`: o resumo do atendimento e o aviso de retorno). Convenções do topo deste guia.

### 5.1 Quem entra

- Módulo **Clínica** ligado. Suspenso: lê, não escreve (403 `MODULO_SOMENTE_LEITURA`).
- Permissão (sem ela: 403 `SEM_PERMISSAO` com `permissao`; sem CRMV completo: 403 `CRMV_OBRIGATORIO`):

| O quê | Permissão | Quem tem |
|---|---|---|
| Ler o atendimento, a lista, os adendos, a integridade, a linha do tempo | `prontuario.ler` | DONO, VETERINÁRIO, ENFERMAGEM |
| Abrir avulso, PATCH, abrir/assumir/liberar edição, descartar, **ato na consulta**, anular ato do rascunho | `prontuario.escrever` (CRMV) | DONO e VETERINÁRIO com CRMV |
| Finalizar, anular, **todo adendo**, **ato avulso**, anular ato de registro finalizado ou avulso | `prontuario.finalizar` (CRMV) | idem |
| Adendo **para o responsável** | `prontuario.finalizar` **e** `resumo.liberar` | idem |
| Liberar o resumo | `resumo.liberar` (CRMV) | idem |
| **Marcar o retorno** | `agenda.escrever` | DONO, GESTOR, RECEPÇÃO, VETERINÁRIO |
| **Retornos pendentes** | `agenda.ler` | os mesmos e a ENFERMAGEM |

- RECEPÇÃO, GESTOR e FINANCEIRO não leem prontuário (nem a linha do tempo). A ENFERMAGEM lê e recebe `somenteLeitura: true` com `motivoSomenteLeitura: SEM_PERMISSAO_DE_ESCRITA`; por enquanto ela **não registra ato** (vem depois da E1-08).
- Id de outra clínica ou que não existe: 403 de acesso negado, sem `codigo` (o mesmo de pacientes).
- **Quando a E1-08 entrar** (selo de CRMV conferido), finalizar, anular, adendo, liberar, ato avulso e anular ato finalizado passam a exigir o selo: o 403 vira `CRMV_NAO_CONFERIDO` com `reason`. O rascunho continua editável.

### 5.2 Ciclo de vida

`RASCUNHO` → `FINALIZADO` → (opcional) `ANULADO`. `RASCUNHO` → `ANULADO` também (com conteúdo). Anulado é terminal.

- **Nasce no `iniciar` da agenda**: `POST /parceiro/portal/clinica/agendamentos/:id/iniciar` devolve `agendamentos[].atendimentoId`. O responsável é o profissional do agendamento (não quem clicou). Agendamento de **BANHO** não abre atendimento.
- **Avulso**: `POST /parceiro/portal/clinica/atendimentos` `{ pacienteId, profissionalId?, tipo?, retificaAtendimentoId? }` (201, `AtendimentoDto`). Mande `Idempotency-Key`; sem ela, o duplo toque cria dois rascunhos (descartáveis). Paciente inativo: 409 `PACIENTE_INATIVO` (o com óbito pode); mesclado: 409 `CADASTRO_MESCLADO`.
- **Desfazer do iniciar** (o token de 15 s da agenda): apaga o atendimento se ninguém gravou nada; com algo gravado, 409 `DESFAZER_EXPIRADO`.
- **Com o atendimento aberto**, o agendamento não troca de tipo nem de profissional (409 `ATENDIMENTO_ABERTO`); horário e sala seguem.

### 5.3 Ler e listar

`GET /parceiro/portal/clinica/atendimentos/:id?dispositivoId=` → `AtendimentoDto`. Leitura pura (não toma lock). Campos principais:
- `status`, `versao` (mande no próximo PATCH), `tipo`, `agendamentoId` (**nulo no avulso**), `realizadoEm` (ISO com o offset da clínica), `dataDoAtendimento` (`YYYY-MM-DD`).
- `paciente` (o cadastro de agora) e `retrato` (o paciente **no ato**, só no finalizado: mostre este no registro fechado).
- `somenteLeitura` + `motivoSomenteLeitura` (`FINALIZADO | ANULADO | OUTRO_DISPOSITIVO | SEM_PERMISSAO_DE_ESCRITA`) + `lock` (`dispositivoRotulo`, `profissionalNome`, `desde`, `ate`).
- `anamnese`, `exameFisico` (`vitais.<chave>` com `valor`, `naoAferido`, `status` e `faixa`; `sistemas`; `porte` e `faixaEtaria` usados), `diagnostico` (`semDiagnostico`, `itens`, `antecedentes`), `conduta` (com `retornoEmDias`, `retornoTipoId` e `retornoAgendamentoId`).
  - `status` do vital: `ABAIXO | DENTRO | ACIMA | SEM_REFERENCIA | NAO_AFERIDO`. **Não calcule no front.** No rascunho a API deriva pela faixa do catálogo e a idade na data do atendimento; no finalizado, devolve o rótulo e a faixa **congelados** no ato.
- `edicoes` (último editor de cada seção), `autores` (congelados na finalização: `RESPONSAVEL`, `FINALIZOU`, `AUTOR_DE_SECAO`, `ANULOU`).
- `adendos` `{ itens (5 mais recentes), total }`; o resto em `GET .../:id/adendos?cursor=&limit=`.
- `atos` `{ itens (5 mais recentes), total }` (ver 5.8).
- `resumo` `{ liberadoEm, publicado, motivoNaoPublicado, consultaId }`.
- `consultaAnterior`, `preConsulta` e `pesoDeCasa` (desde o G3, a pré-consulta respondida chega como sugestão: veja a seção 11.1), `faltamParaFinalizar` (a mesma conta do 422).

**Lista** (a tela de atendimentos e a de rascunhos): `GET /parceiro/portal/clinica/atendimentos?status=&profissionalId=&cursor=&limit=` (`prontuario.ler`; 1 a 50, padrão 20) → `{ itens, proximoCursor }`, do mais recente. Item sem texto clínico: `id`, `status`, `tipo`, `pacienteId`, `pacienteNome`, `profissionalId`, `profissionalNome`, `agendamentoId`, `abertoEm`, `dataDoAtendimento`, `finalizadoEm`, `anuladoEm`, `nuncaAberto`.
- `status=RASCUNHO` são os rascunhos abertos. **Sem filtro aparece também o rascunho de quem saiu da clínica**: outro veterinário abre, assume e finaliza com confirmação (não há rota de transferir).
- `nuncaAberto: true` = rascunho vazio que o responsável nunca abriu (a recepção iniciou): mostre como "iniciado, não aberto".

### 5.4 Editar (autosave e lock)

- Ao abrir a tela de edição: `POST .../:id/abrir-edicao` `{ dispositivoId, dispositivoRotulo }`. Repita **a cada 5 min** com a tela ativa (o lock vale 10 min). Se vier `somenteLeitura: true`, mostre "em edição em {rótulo}" e o botão **Assumir edição** (`POST .../:id/assumir-edicao`). Ao sair: `POST .../:id/liberar-edicao` `{ dispositivoId }`.
- `dispositivoId`: gere um por aba (`[A-Za-z0-9-]{8,64}`) e guarde na aba. O `dispositivoRotulo` segue a regra do texto clínico (abaixo).
- Autosave (800 ms): `PATCH .../:id` `{ secao, dados, versao, dispositivoId, dispositivoRotulo? }`.
  - `secao`: `ANAMNESE | EXAME_FISICO | DIAGNOSTICO | CONDUTA`; `dados` no formato da seção (no OpenAPI: `AnamneseDadosDto`, `ExameFisicoDadosDto`, `DiagnosticoDadosDto`, `CondutaDadosDto`).
  - Campo ausente fica; `null` limpa; lista (`sistemas`, `itens`, `antecedentes`) presente **substitui a lista inteira** (mande `id` dos itens que já existem).
  - Resposta `{ id, secao, versao, semMudanca, lock }`. **Uma gravação em voo por vez**: espere a resposta, use a `versao` nova.
  - 409 `ATENDIMENTO_ALTERADO` traz `atual: { secao, dados, versao }`: aplique o `atual`, refaça a mescla e grave de novo. Ele também vem depois de um **ato** registrado em outra aba (o ato sobe a versão, 5.8).
  - 409 `EDICAO_EM_OUTRO_DISPOSITIVO` (com `lock`) e 409 `EDICAO_ASSUMIDA` (com `atual`): **guarde o rascunho local** e ofereça recarregar.
  - Vital: `{ valor, naoAferido }`. "Não aferido" com valor, casa decimal a mais ou valor absurdo: 400.
  - Texto com caractere de controle ou controle bidi (U+202A a U+202E, U+2066 a U+2069): 400. LRM e RLM passam.
  - `camposDaPreConsulta`: a marca só fica se o valor for o da sugestão. `camposDaEscuta` não é do portal (400).
  - Corpo acima de 64 KB: 413 `ATENDIMENTO_LIMITE`. Taxa: 3000 gravações por hora (429 `ATENDIMENTO_TAXA_EXCEDIDA` com `tenteDeNovoEmSegundos`).
- **Retorno** (decisão do veterinário): na seção CONDUTA, `retornoEmDias` (1 a 730) e `retornoTipoId` (o tipo de atendimento do retorno, opcional). Só o veterinário define; a recepção depois só marca o horário (5.7).

### 5.5 Finalizar, adendo, anular, descartar

- **Senha (parecer de 30/10, desde 30/10):** finalizar e anular aceitam `senha`; sem ela e sem a janela de 15 minutos da sessão, 401 `ASSINATURA_SENHA_EXIGIDA`. Detalhes na seção 6.8.
- `POST .../:id/finalizar` `{ versao, dispositivoId, confirmarOutroResponsavel?, senha? }`:
  - 422 `ATENDIMENTO_INCOMPLETO` com `faltam` (`QUEIXA`, `DIAGNOSTICO`, `CONDUTA` e bloqueios de outros módulos);
  - 409 `ATENDIMENTO_DE_OUTRO_PROFISSIONAL` (`responsavel`, `voce`): peça confirmação e reenvie com `confirmarOutroResponsavel: true`.
  - Mostre a **tela de revisão** (o que vai ao responsável) antes de finalizar: depois, orientação errada só se corrige por adendo para o responsável.
  - Não publica. A copy nunca diz "assinado digitalmente".
- `POST .../:id/adendos` `{ texto, paraOResponsavel? }` (201): só no finalizado (rascunho: 409 `ATENDIMENTO_NAO_FINALIZADO`). Interno por padrão. Para o responsável: até 2000 caracteres, 10 por atendimento; republica o resumo já liberado (no app aparece depois das orientações, com a data).
- `POST .../:id/anular` `{ motivo, confirmarOutroResponsavel? }` (motivo de 5 a 500): rascunho com conteúdo devolve o agendamento a AGUARDANDO; finalizado mantém o agendamento FINALIZADO e tira a Consulta do app. Rascunho vazio: 409 `ATENDIMENTO_SEM_CONTEUDO` (use descartar). Finalizado que **outro veterinário** assinou: 409 `ATENDIMENTO_DE_OUTRO_PROFISSIONAL` (`responsavel`, `voce`); peça confirmação e reenvie com `confirmarOutroResponsavel: true`. Retificação: abra um avulso com `retificaAtendimentoId`.
- `POST .../:id/descartar` (sem corpo): só o rascunho em que ninguém gravou; devolve o agendamento a AGUARDANDO. Com conteúdo (inclusive um ato): 409 `ATENDIMENTO_COM_CONTEUDO`.
- `GET .../:id/integridade` → `{ confere, verificadoEm }` (sem conteúdo).

### 5.6 Liberar o resumo

`POST .../:id/liberar-resumo` → `{ publicado, motivo, liberadoEm, consultaId }`. Sem vínculo ativo, com óbito ou removido pelo responsável: `publicado: false` com `motivo` (`SEM_VINCULO | OBITO | REMOVIDO_PELO_RESPONSAVEL | ANULADO`) e nada gravado. Mostre "não publicado" com o motivo. Idempotente. O resumo **nunca** sai sozinho quando o vínculo nascer depois: alguém libera de novo (o painel do dia, E3-08, mostra a pilha "resumos não publicados").

### 5.7 Retorno e retornos pendentes

- **Marcar**: `POST /parceiro/portal/clinica/atendimentos/:id/retorno` (`agenda.escrever`; mande `Idempotency-Key`) `{ inicio?, profissionalId?, tipoId?, duracaoMinutos?, salaIds?, confirmarConflitos?, avisarResponsavel?, mensagem? }` → **201** `MutacaoDaAgendaDto` (a mesma resposta do criar da agenda, com o `desfazerToken` de 15 s). **Só agenda**: nada clínico na resposta (a recepção não lê prontuário).
  - Sem `inicio`: a API escolhe o **primeiro horário livre do profissional** (padrão: quem atendeu) a partir do vencimento, avançando dia fechado, feriado e férias por até 5 semanas. Para oferecer opções antes, use as sugestões da agenda com `aPartirDe` igual ao `venceEm` e mande o `inicio` escolhido.
  - O tipo é o que o veterinário escolheu (`conduta.retornoTipoId`). `tipoId` no corpo só quando ele não escolheu; diferente do dele: 400 `ATENDIMENTO_INVALIDO` com `reason: TIPO_DO_VETERINARIO`; nenhum dos dois: 400 com `reason: TIPO_OBRIGATORIO`. `emDias` no corpo: 400 (é do veterinário).
  - 409 `RETORNO_NAO_DEFINIDO`: o veterinário não definiu os dias; mostre "peça ao veterinário".
  - 409 `RETORNO_JA_MARCADO` (`agendamentoId`): abra o agendamento. Se ele for **cancelado** ou virar **falta**, o retorno volta a pendente e pode ser marcado de novo.
  - 409 `RETORNO_SEM_HORARIO` (`venceEm`, `sugerirFila: true`): ofereça a **fila de espera** (E3-04) ou um horário manual.
  - `inicio` no passado: 400 `ATENDIMENTO_INVALIDO` com `reason: INICIO_NO_PASSADO`. Os 409 do criar da agenda (conflito, paciente inativo) valem igual. Atendimento anulado: 409 `ATENDIMENTO_ANULADO`.
  - O desfazer (o token) apaga o agendamento, e o retorno volta à lista de pendentes.
  - O agendamento nasce com `origem: RETORNO`. Vale no rascunho e no finalizado.
- **Pendentes**: `GET /parceiro/portal/clinica/retornos-pendentes?somenteVencidos=&cursor=&limit=` (`agenda.ler`; 1 a 200, padrão 50) → `{ itens, proximoCursor, hoje }`. Item: `atendimentoId`, `pacienteId`, `pacienteNome`, `profissionalId`, `profissionalNome`, `tipoId`, `tipoNome`, `emDias`, `dataDoAtendimento`, `venceEm`, `diasDeAtraso` (negativo: faltam dias), `retornoAnteriorId` (o marcado e depois cancelado). Ordem: vencimento. **O vencimento conta da data do atendimento**, não da finalização. Sem texto clínico.

### 5.8 Atos (medicação aplicada, procedimento)

- **Na consulta**: `POST .../atendimentos/:id/atos` (`prontuario.escrever`; mande `Idempotency-Key`) `{ kind, descricao, realizadoEm, medicamentoId?, via?, doseTexto?, observacao? }` → 201 `AtoDto`. Só no **rascunho** (finalizado: 409 `ATENDIMENTO_FINALIZADO`; registre avulso), até 100 por atendimento. Conta para o mínimo da conduta. A resposta traz `versaoDoAtendimento`: **use esta versão no próximo PATCH** (o ato sobe a versão; quem estiver em outra aba leva `ATENDIMENTO_ALTERADO`).
- **Avulso** (fora de atendimento): `POST /parceiro/portal/pacientes/:id/atos` (`prontuario.finalizar`: nasce final) com `origem?`: `CLINICA` (padrão: o profissional do login executou) ou `AVULSO` (a clínica registra o que não viu acontecer: sem profissional). Paciente com óbito pode; mesclado: 409 `CADASTRO_MESCLADO`.
- `kind`: `MEDICAMENTO | PROCEDIMENTO`. `medicamentoId`, `via` (`ORAL`, `SUBCUTANEA`...) e `doseTexto` só com `MEDICAMENTO` (senão 400 `ATENDIMENTO_INVALIDO` com `reason: SO_COM_MEDICAMENTO`). Medicamento do catálogo global ou da clínica; de outra clínica: 403; desativado: 409 `MEDICAMENTO_INATIVO`.
- `realizadoEm` obrigatório, com o offset: no futuro (mais de 5 min): 400 com `reason: ATO_NO_FUTURO`; antes do nascimento: 400 com `reason: ATO_ANTES_DO_NASCIMENTO`.
- `AtoDto`: `id`, `pacienteId`, `atendimentoId` (nulo no avulso), `kind`, `medicamentoId`, `descricao`, `via`, `doseTexto`, `realizadoEm`, `profissionalNome` (congelado; nulo no `AVULSO`), `origem`, `observacao`, `anuladoEm`, `motivoAnulacao`, `versaoDoAtendimento`.
- **Anular**: `POST /parceiro/portal/atos/:id/anular` `{ motivo }` (5 a 500) → 200 `AtoDto`. Nada se apaga: o ato fica na linha do tempo com a marca de anulado. No rascunho basta `prontuario.escrever`; no registro finalizado ou no avulso exige `prontuario.finalizar` (sem ela: 403 `SEM_PERMISSAO` com `permissao: prontuario.finalizar`). Já anulado: 409 `ATO_JA_ANULADO`.
- Vacina e internação **não** se registram como ato: aparecem na linha do tempo pelos registros delas.

### 5.9 Linha do tempo do paciente

`GET /parceiro/portal/pacientes/:id/linha-do-tempo?tipos=&cursor=&limit=` (`prontuario.ler`; 1 a 50, padrão 20) → `{ itens, proximoCursor, tipos, contagens }`.
- `tipos`: `ATENDIMENTO`, `CIRURGIA`, `ATO`, `VACINA`, `FALTA`, separados por vírgula; tipo desconhecido: 400. Omitido: todos os que você lê (o `tipos` da resposta diz quais entraram).
- Item: `tipo`, `id` (abra o detalhe pela rota do recurso), `em` (com o offset), `titulo`, `situacao`, `profissionalNome`, `detalhe`.
  - `titulo`: no atendimento, o código do tipo (`CONSULTA`, `RETORNO`...; traduza no front); no ato, a descrição; na vacina, o nome; na falta, o tipo de atendimento.
  - `situacao`: no atendimento, `RASCUNHO | FINALIZADO | ANULADO`; no ato e na vacina, `ANULADO` ou nulo; na falta, `FALTA`.
  - `detalhe`: no atendimento finalizado, o diagnóstico principal.
- `contagens` (`[{ tipo, total, maisDe }]`, teto de 1000: mostre "1000+") só na primeira página; com `cursor` vem nulo.
- O cursor só vale para o mesmo paciente e a mesma clínica (outro: 400 `CURSOR_INVALIDO`). A falta sai sem a justificativa.

### 5.10 App do responsável

- `GET /tutor/clinica/atendimentos?petId=&cursor=&limit=` → `{ itens: ResumoDoAtendimento[], proximoCursor, truncado }`.
- `GET /tutor/clinica/atendimentos/:id` → `ResumoDoAtendimento`. Não liberado, anulado, removido, de outro vínculo ou pet que não lê: 403.
- `ResumoDoAtendimento` (diferenças do contrato do portal):
  - `agendamentoId` **nulável** (atendimento avulso);
  - `correcoes: [{ texto, em }]` (novo): os adendos para o responsável;
  - `clinica.fuso` no lugar de `utcOffset` (o mesmo das rotas da agenda);
  - `profissional.crmv` (nulo até a E1-08);
  - `retorno` `{ emDias, venceEm, servicoId (nulável), profissionalId, agendamentoId }`: com `agendamentoId`, o retorno já está marcado;
  - `receita` nulo, `exames` e `documentos` vazios até a E4-03 e a E4-06.
- Push: os da publicação (`ATENDIMENTO_RESUMO_DISPONIVEL`, `ATENDIMENTO_RESUMO_ATUALIZADO`, `CLINICA_ANULOU_REGISTRO`) e, **agora em uso**, `RETORNO_PENDENTE`:
  - sai **uma vez** por atendimento, das 10h da clínica em diante, quando o retorno vence (até 7 dias depois) e ninguém marcou; só ao dono do pet do vínculo ativo, com o resumo publicado, e só se o paciente não tem horário marcado depois da consulta;
  - `dados`: `{ parceiroId, atendimentoId, petId, petNome, venceEm (AAAA-MM-DD), url }`; a copy leva o nome do pet e a data;
  - o tipo já existe no catálogo desde a E3-06 e abre `/screens/notifications` (como os outros da clínica). **Confira** que `services/notificacao/rotas-notificacao.ts` tem `RETORNO_PENDENTE` nos três mapas (o tipo em `TipoNotificacao`, a rota, `AFETA_HOME_POR_TIPO: false` e `PERFIL_POR_TIPO: "tutor"`). Quando a tela do atendimento existir no app, a API troca a rota na mesma release (avise).

### 5.11 Contadores do menu (`GET /parceiro/portal/pendencias`)

- `rascunhosDeProntuario` (**por pessoa**: os rascunhos em que você é o responsável; `prontuario.escrever`; rota `/clinica/atendimentos?status=RASCUNHO`). O tom sobe pelo rascunho mais velho que você já abriu: neutro até 12 h, atenção até 24 h, risco depois. O "iniciado e nunca aberto" conta no número, não no tom.
- `retornosPendentes` (vencidos ou vencendo hoje; `agenda.escrever`; tom de atenção; rota `/clinica/retornos-pendentes`).

### 5.12 Códigos de erro desta seção

`ATENDIMENTO_ALTERADO`, `ATENDIMENTO_FINALIZADO`, `ATENDIMENTO_ANULADO`, `ATENDIMENTO_NAO_FINALIZADO`, `ATENDIMENTO_INCOMPLETO`, `ATENDIMENTO_COM_CONTEUDO`, `ATENDIMENTO_SEM_CONTEUDO`, `ATENDIMENTO_DE_OUTRO_PROFISSIONAL`, `ATENDIMENTO_JA_ABERTO`, `ATENDIMENTO_ABERTO`, `ATENDIMENTO_LIMITE`, `ATENDIMENTO_INVALIDO`, `ATENDIMENTO_TAXA_EXCEDIDA`, `EDICAO_EM_OUTRO_DISPOSITIVO`, `EDICAO_ASSUMIDA`, `RETORNO_NAO_DEFINIDO`, `RETORNO_JA_MARCADO`, `RETORNO_SEM_HORARIO`, `ATO_JA_ANULADO`, `MEDICAMENTO_INATIVO`. Todos com `message` nos 6 idiomas.

### 5.13 Pronto quando

- O veterinário abre pelo `iniciar`, edita em duas abas (a segunda em leitura, com "assumir"), registra um curativo no rascunho sem perder digitação, revisa e finaliza.
- A recepção vê o retorno em "Retornos pendentes" com o vencimento contado da consulta, marca com um toque (o primeiro horário do mesmo veterinário), desfaz em 15 s e o retorno volta à lista; sem horário, oferece a fila.
- A linha do tempo do paciente mostra consultas, atos (os anulados marcados), vacinas e faltas, pagina sem repetir e não aparece para a recepção.
- O dono no app recebe o resumo liberado e, no dia do vencimento, o aviso do retorno uma vez só.

---

## 6. Receita digital, núcleo (E4-03a)

**Backend:** pronto e validado em dev em 2026-10-28 (unit, integração no Postgres e no storage de dev, smoke por HTTP `npx tsx scripts/smoke-receituario.ts`, 28/28). **Não está em produção** e tem gate jurídico (Q-JUR2 e Q-JUR3) antes de cliente real. Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e4-prontuario/03-receituario-digital.md` (decisões do gerente P1 a P15 de 28/10).

**Produção:** a 03a não vai para produção antes da 03b (o QR aponta para a página de verificação que só a 03b cria). Correção da auditoria em 28/10 (`30de139`): o PDF agora é legível (fonte latina embutida inteira) e a assinatura não segura trava durante o render; para o front, nada mudou no contrato.

**O que fica para a E4-03b:** a folha de controle especial (2 vias, endereço obrigatório), a verificação pública `GET /public/receitas/:codigo` e a página `petjourney.health/receita/<código>`, "repetir receita", "salvar nos documentos" no app e o aviso `RECEITA_CANCELADA`. O QR e o rodapé do PDF já apontam para `petjourney.health/receita/<código>`: a página do site é da 03b.

Substitui no mock: `Prescription`, `DoseCalc`, `Receita`, `AssinaturaEletronica` (`types.ts`) e a conta de `domain/receita.ts` (`passosDaConta`, `fracionar`, `gerarCodigoVerificador`, `VALIDADE_EM_DIAS`): **o servidor calcula e confere**; a tela mostra a conta e manda o que o veterinário viu.

### 6.1 Quem entra

Módulo **Clínica** (suspenso: lê; escrever dá 403 `MODULO_SOMENTE_LEITURA`).

| O quê | Permissão |
|---|---|
| Ler prescrições e receitas, abrir o PDF | `prontuario.ler` |
| Prescrever, editar, remover, rascunho, descartar | `prontuario.escrever` (exige CRMV) |
| Assinar e cancelar | `receita.assinar` (exige CRMV **conferido** pela PetJourney: P4) |

**Selo interino (P4):** quem tem CRMV mas ainda **não foi conferido** no CMS prescreve, mas assinar e cancelar dão 403 `CRMV_NAO_CONFERIDO` com `reason: SEM_SELO`. Mostre "Seu CRMV ainda não foi conferido pela PetJourney" e esconda o botão quando o `eu` disser que falta (a E1-08 traz o fluxo completo).

### 6.2 Prescrição (`/parceiro/portal/clinica/atendimentos/:id/prescricoes`)

É uma gravação do rascunho: usa a **mesma `versao` e o mesmo `dispositivoId`** do PATCH do atendimento (seção 5). Cada gravação devolve a `versao` nova; mande-a na próxima (prescrição ou PATCH).

| Rota | Corpo / resposta |
|---|---|
| `GET` | `{ itens: PrescricaoDto[], versao }` |
| `POST` | `CriarPrescricaoDto` → 201 `GravacaoDaPrescricaoDto` (a prescrição + `versao` + `avisos[]`) |
| `PATCH /:pid` | `AtualizarPrescricaoDto` (dose, via, posologia, confirmações, `critico`) → 200 |
| `DELETE /:pid?versao=&dispositivoId=` | 200 `{ versao }` (não é 204: a tela precisa da versão nova) |

Dois jeitos de prescrever:
- **Por peso** (só do catálogo): `medicamentoId`, `mgPorKg`, `pesoKg?` (sem ele: o peso do exame do atendimento, depois o do cadastro; `pesoOrigem` diz qual). O servidor calcula `mgPorAdministracao`, `quantidade` e `fracao`. Se a tela mandar `mgPorAdministracao`/`quantidade`/`fracao` e não baterem: 422 `DOSE_DIVERGENTE` com `calculado`. Sem peso nenhum (nem o informado, nem o do exame, nem o do cadastro): 422 `PESO_AUSENTE` (código próprio desde a re-auditoria do G4, 29/10; o corpo ainda traz `reason: PESO_AUSENTE` e `campo: pesoKg`). Mostre "Informe o peso do animal" com o campo `pesoKg` em destaque.
- **Por quantidade** (pomada, colírio, nome livre): `quantidade` + `unidade` (`ML`, `COMPRIMIDO`, `GOTA`, `APLICACAO`). Comprimido só em quartos (0,25; 0,5; 1,5...).
- **Nome livre (P3):** `nomeLivre` + `declaraNaoControlado: true`, sem `mgPorKg`. Nome que bate com controlado do catálogo: 422 `NOME_LIVRE_CONTROLADO` ("escolha no catálogo").
- `duracaoDias` ausente ou `null` = **uso contínuo**. `frequenciaHoras` 1 a 720 (24 = "uma vez ao dia").
- **Confirmações (D8):** com alergia registrada ao princípio ou espécie contraindicada, sem `alergiaConfirmada`/`proibidoConfirmado`: 422 `CONFIRMACAO_PENDENTE` com `avisos: ['ALERGIA' | 'ESPECIE_PROIBIDA']` e `detalhes`. Mostre o aviso e peça o "estou ciente".
- **Dose arredondada (auditoria da E5-02a, 28/10, vale aqui também):** por peso, quando o comprimido não fecha numa fração (`fracao: APROXIMADO` ou fração "quase") ou o mg real sai a mais de 10% da conta, o 422 `CONFIRMACAO_PENDENTE` traz `avisos: ['DOSE_ARREDONDADA']` e `dose: { mgCalculado, mgReal, aproximado, quantidade, unidade, fracao }`. Mostre "o animal recebe X mg (a conta dá Y mg)" e mande `arredondamentoConfirmado: true`. Trocar a dose no PATCH pede confirmar de novo. A linha sem a confirmação não assina (o mesmo 422 com `pendentes`). Comprimido cuja conta dá menos da metade de um quarto: 422 `DOSE_MENOR_QUE_UM_QUARTO_DE_COMPRIMIDO` (escolha outra apresentação), e por quantidade, menos de 1/4. mL agora sai com até 3 casas. `PrescricaoDto` ganhou `arredondamentoConfirmado` e `mgReal`. A copy do `CONFIRMACAO_PENDENTE` ficou genérica (alergia, espécie, arredondamento ou faixa): use `avisos` para escolher o texto da tela.
- **Faixa usual na receita (auditoria da E5-02b, 28/10; a mesma regra da internação, porque a receita é dose de vários dias em casa):** a dose acima da faixa usual (da espécie, ou a geral) ou de medicamento cujo bulário não traz a espécie dá 422 `CONFIRMACAO_PENDENTE` com `avisos: ['FORA_DA_FAIXA']` e `faixa: { mgKgMin, mgKgMax, origem }` (`origem: ESPECIE | GERAL`). Mostre a faixa e mande `foraDaFaixaConfirmada: true`; a confirmação fica gravada no item (`PrescricaoDto.foraDaFaixaConfirmada`). Vale também para a dose por quantidade de medicamento do catálogo sem a espécie no bulário. **Acima de 3x o teto da faixa**: 422 `DOSE_MUITO_ACIMA_DA_FAIXA` (`mgPorKg`, `faixa`, `limiteMgKg`), sem confirmação possível: confira a dose e a unidade. Trocar a dose no PATCH pede confirmar de novo. Na assinatura, a linha sem a confirmação dá o 422 com `pendentes` (`avisos: ['FORA_DA_FAIXA']`) e a muito acima dá `DOSE_MUITO_ACIMA_DA_FAIXA` com `prescricaoId`. O "repetir receita" omite o item que pede a confirmação (`motivo: CONFIRMACAO_PENDENTE`), como já faz com a alergia.
- **Faixa também na dose por quantidade (G4, 29/10; vale para todo medicamento do catálogo):** por quantidade (`quantidade` + `unidade`, sem `mgPorKg`), o servidor calcula o mg/kg que o animal recebe: `quantidade x concentração / peso` (o peso informado, o do exame ou o do cadastro). As mesmas regras da dose por peso:
  - **acima de 3x o teto da faixa**: 422 `DOSE_MUITO_ACIMA_DA_FAIXA` sem confirmação possível, com `mgPorKg` (o efetivo), `faixa`, `limiteMgKg` e `porQuantidade: { quantidade, mgPorAdministracao, pesoKg }`. É o "5" digitado no lugar de "0,5" comprimido: mostre "5 comprimidos = 10 mg = 3,33 mg/kg, o limite é 0,3 mg/kg" e peça para conferir a quantidade e a unidade;
  - **acima da faixa**: 422 `CONFIRMACAO_PENDENTE` com `avisos: ['FORA_DA_FAIXA']`, `faixa` e `porQuantidade: { quantidade, unidade, pesoKg, mgPorKg }`. Mostre o mg/kg ao lado da faixa e mande `foraDaFaixaConfirmada: true`;
  - **sem peso nenhum** (nem informado, nem do exame, nem do cadastro; re-auditoria do G4, 29/10, decisão 16): 422 `PESO_AUSENTE` com `campo: 'pesoKg'`, sem confirmação possível (antes pedia `FORA_DA_FAIXA` e qualquer quantidade passava com um clique). A tela pede o `pesoKg` na linha e manda de novo. Vale só para medicamento do catálogo com faixa por kg; a pomada, o colírio e o nome livre seguem sem peso;
  - **a faixa da espécie 0..0** (o bulário tem faixa para o fármaco, mas a da espécie é zero, sem ser proibida): pede `FORA_DA_FAIXA` também por quantidade (`porQuantidade.mgPorKg: null`), como já pedia por peso;
  - medicamento sem faixa no bulário (teto 0, a pomada e o colírio) e nome livre: nada muda.
  Trocar a quantidade no PATCH pede confirmar de novo. Na assinatura, a linha antiga sem a marca dá o 422 com `pendentes` (`FORA_DA_FAIXA`), e a muito acima dá `DOSE_MUITO_ACIMA_DA_FAIXA` com `prescricaoId`. `avisosNoAto` passa a trazer `ACIMA_DA_USUAL` também nesse modo. O 422 `CONFIRMACAO_PENDENTE` ganhou o campo `porQuantidade` (null na dose por peso).
- **Peso acima do esperado para a espécie (re-auditoria do G4, 29/10):** quando o peso entra na conta (por peso, ou por quantidade de medicamento com faixa por kg) e passa do teto da espécie, o 422 `CONFIRMACAO_PENDENTE` traz `avisos: ['PESO_IMPLAUSIVEL']` e `peso: { kg, origem, limiteKg }`. Tetos: cão 120 kg, gato 15, ave 2, roedor 3, coelho 12, peixe 15; réptil e outro sem teto. É o erro de digitação (o 4 que virou 40, gramas no campo de quilos), que multiplica a dose. Mostre "Gato com 40 kg? O esperado é até 15 kg. Confira o peso" e dois botões: corrigir o `pesoKg`, ou confirmar com `pesoImplausivelConfirmado: true`. A confirmação fica gravada (`PrescricaoDto.pesoImplausivelConfirmado`). Trocar a dose ou o peso no PATCH pede confirmar de novo. A linha sem a confirmação não assina (o 422 com `pendentes`, `avisos: ['PESO_IMPLAUSIVEL']`). A copy do `CONFIRMACAO_PENDENTE` cita o peso; use `avisos` para o texto da tela.
- **Nome livre também passa pela alergia e pela espécie (re-auditoria do G4, 29/10):** o nome livre que cita um fármaco do catálogo ("Amoxicilina manipulada 50 mg") é conferido como o do catálogo: alergia registrada ao princípio ou espécie contraindicada dão o 422 `CONFIRMACAO_PENDENTE` com `avisos: ['ALERGIA' | 'ESPECIE_PROIBIDA']` e `detalhes`, e pedem `alergiaConfirmada` / `proibidoConfirmado`. A dose continua sem conta (P3). Na assinatura vale a mesma regra do catálogo (alerta criado depois da confirmação: o 422 com `pendentes`).
- **Na assinatura, por quantidade (re-auditoria do G4, 29/10):** o peso que o veterinário INFORMOU na linha (`pesoOrigem: INFORMADO`) vale sempre (ele pesou para esta dose). Sem ele, entre o peso gravado na linha (o do exame ou do cadastro no ato) e o de agora, vale o MENOR (o maior mg/kg): o animal que emagreceu depois da prescrição pode dar `DOSE_MUITO_ACIMA_DA_FAIXA` ou `FORA_DA_FAIXA` pendente. A linha gravada sem peso (das versões de antes) não confirma nada quando o peso chega: o 422 com `pendentes` pede confirmar de novo (e o PATCH também), e sem peso nenhum a assinatura dá `PESO_AUSENTE` com `prescricaoId`.
- `dose` vem pronta para mostrar ("meio comprimido", "2,5 mL"), no idioma das orientações do atendimento. Nunca mostre "0,5 comprimido".
- **Teto:** 10 prescrições vivas por atendimento (P15): 400 `PRESCRICAO_LIMITE`.
- **Na receita assinada** a prescrição fica congelada (`editavel: false`): PATCH/DELETE dão 409 `PRESCRICAO_JA_ASSINADA`. Para mudar a dose: nova prescrição e nova receita (e cancele a antiga).
- Lock de outro dispositivo, versão velha, finalizado: os mesmos 409 da seção 5; no atendimento finalizado, 409 `RECEITA_ATENDIMENTO_FECHADO` (P1: receita só antes de finalizar; o caminho do "esqueci" é abrir um atendimento avulso para o paciente).

### 6.3 Receita

| Rota | O quê |
|---|---|
| `GET /atendimentos/:id/receitas` | `{ itens: ReceitaDto[] }` (rascunho, assinadas e canceladas) |
| `POST /atendimentos/:id/receitas` | `{ prescricaoIds: [1..10] }` → 201 rascunho com a **prévia** (`itens`, `foraDoPdf`, `exigeNotificacaoOficial`). Id de outro atendimento ou clínica: 403 e nada se liga. Prescrição já em outra receita: 409 `PRESCRICAO_JA_ASSINADA` `reason: EM_OUTRA_RECEITA` |
| `GET /receitas/:id` | `ReceitaDto`. Assinada: os itens **congelados** (nunca a prescrição de agora) |
| `DELETE /receitas/:id` | Descarta o rascunho → 200 `{ versao }` |
| `POST /receitas/:id/assinar` | `{ senha }` + header `Idempotency-Key` (UUID v4) → 200 `ReceitaDto` |
| `GET /receitas/:id/pdf` | `{ url, expiraEm }`: URL assinada de 15 min (bucket privado). Rascunho: 409 `RECEITA_NAO_ASSINADA`; cancelada: 409 `RECEITA_JA_CANCELADA` |
| `POST /receitas/:id/cancelar` | `{ motivo (10 a 500), confirmarOutroResponsavel? }` → 200 `ReceitaDto` |

**Assinar:**
- A senha é a da conta (reautenticação). Errada: **401** `ASSINATURA_SENHA_INCORRETA` (não trate como sessão expirada: olhe o `codigo`). 5 erros da pessoa ou 10 da mesma rede em 15 min (somados com a troca de senha e a exclusão da conta, desde o G3): 429 `ASSINATURA_SENHA_BLOQUEADA` com `tenteDeNovoEmSegundos`. Conta sem senha própria: 403 `ASSINATURA_SENHA_NECESSARIA` ("crie uma senha no perfil"). Nada é gerado em nenhum desses casos.
- Nome e CRMV saem do profissional logado, nunca do corpo.
- **Folhas (D4, falha fechada):** nesta entrega só a **receita simples** sai no PDF. Item controlado de lista que exige Notificação de Receita (A, B ou lista desconhecida) fica fora com `motivo: EXIGE_NOTIFICACAO_OFICIAL` e volta em `exigeNotificacaoOficial` ("use o talonário oficial"). Controlado C1 com a flag de controle especial ligada fica fora com `FOLHA_DE_CONTROLE_ESPECIAL_INDISPONIVEL` até a 03b. Nenhum item emitível: 422 `RECEITA_SEM_ITEM_EMITIVEL` com `foraDoPdf`. Esses itens ficam **só na clínica** (P8): não vão ao app.
- Alergia registrada depois da confirmação: 422 `CONFIRMACAO_PENDENTE` com `pendentes: [{ prescricaoId, avisos }]`.
- Duplo toque: mande a mesma `Idempotency-Key` e receba a mesma receita. Sem a chave, o segundo toque leva 409 `RECEITA_JA_ASSINADA`.
- A resposta traz `versaoDoAtendimento`: use-a no finalizar (assinar sobe a versão).
- Storage fora: 503 `RECEITA_ARQUIVO_INDISPONIVEL` (nada assinado; tente de novo).

**Finalizar (P2):** com prescrição sem receita assinada ou com receita em rascunho, o `finalizar` dá 422 `ATENDIMENTO_INCOMPLETO` com `faltam` contendo `PRESCRICAO_SEM_RECEITA` ou `RECEITA_EM_RASCUNHO`. Ponha a receita **antes** do botão Finalizar.

**Cancelar:** exige o CRMV conferido. Receita de outro veterinário: 409 `ATENDIMENTO_DE_OUTRO_PROFISSIONAL` (com `responsavel`); confirme e mande `confirmarOutroResponsavel: true`. Depois de cancelar, o PDF não abre mais (nem na clínica nem no app) e nada do app é apagado sozinho (P6). Anular o atendimento cancela as receitas dele (`cancelamento.origem: ATENDIMENTO_ANULADO`).

**O PDF:** rodapé "Documento emitido eletronicamente por <nome>, CRMV-<UF> <número>, em <data>. Confira a autenticidade em petjourney.health/receita/<código>", o resumo do conteúdo (12 hex) e o QR. O rodapé não afirma o tipo jurídico da assinatura (P7). Desde o parecer de 30/10 (seção 6.8), a folha **simples** diz "Assinatura eletrônica avançada (Lei 14.063/2020, art. 14)" no corpo; a de controle especial nunca. Nada diz "assinada digitalmente". O número sequencial não aparece (P11).

### 6.4 App do responsável (`petjourney-app`)

- `GET /tutor/clinica/atendimentos/:id` ganha:
  - `receita`: a assinada mais recente (ou a cancelada, se só houver ela), `ReceitaDoResumoDto`: `id`, `status`, `cancelada`, `emitidaEm`, `validaAte`, `prescritorNome`, `prescritorCrmv` (só com o CRMV conferido), `folhas`, `medicamentos[]`, `pdfDisponivel`;
  - `receitas`: todas, da mais nova.
- `medicamentos[]`: `nome`, `dose` ("meio comprimido"), `via` ("via oral"), `frequencia` ("a cada 12 horas"), `duracaoDias` (**ausente** no uso contínuo: a chave não existe), `usoContinuo`, `instrucoes?`. Nunca mg/kg, peso ou item de notificação oficial.
- `GET /tutor/clinica/receitas/:id/url`: `{ id, url, expiraEm, cancelada }`. Cancelada: `url: null` e `cancelada: true` (mostre "A clínica cancelou esta receita"). Receita de outro pet, rascunho, vínculo encerrado, resumo removido: 403.
- Os itens também entram na `Consulta` do app (`ConsultaPrescricaoItem`) no liberar, **sem lembrete nem tratamento** (A2: o lembrete nasce com o toque do responsável, E4-05).
- Nenhum tipo de notificação novo nesta entrega (`RECEITA_CANCELADA` é da 03b).

### 6.5 Códigos de erro desta seção

`CRMV_NAO_CONFERIDO`, `PRESCRICAO_INVALIDA` (`reason`: `PESO_AUSENTE`, `QUANTIDADE_OBRIGATORIA`, `QUANTIDADE_NAO_PARTIVEL`, `VIA_NAO_PERMITIDA`, `UNIDADE_DIFERENTE_DA_APRESENTACAO`, `MEDICAMENTO_OU_NOME`, `DECLARACAO_OBRIGATORIA`, `CONTA_NO_NOME_LIVRE`, `CONTA_IMPOSSIVEL`, `IDS_REPETIDOS`, `CAMPO_NULO`), `PESO_AUSENTE` (422, desde a re-auditoria do G4), `PRESCRICAO_JA_ASSINADA`, `PRESCRICAO_LIMITE`, `CONFIRMACAO_PENDENTE`, `DOSE_DIVERGENTE`, `NOME_LIVRE_CONTROLADO`, `RECEITA_SEM_ITEM_EMITIVEL`, `RECEITA_JA_ASSINADA`, `RECEITA_NAO_ASSINADA`, `RECEITA_JA_CANCELADA`, `RECEITA_ARQUIVO_INDISPONIVEL`, `RECEITA_ATENDIMENTO_FECHADO`, `RECEITA_TAXA_EXCEDIDA` (60 assinaturas por hora), e os da base comum (a E4-06 usa os mesmos): `ASSINATURA_SENHA_INCORRETA`, `ASSINATURA_SENHA_BLOQUEADA`, `ASSINATURA_SENHA_NECESSARIA`. Todos com `message` nos 6 idiomas.

### 6.6 Pronto quando

- O veterinário prescreve pelo peso vendo a conta, confirma a alergia quando há, faz a receita antes de finalizar, assina com a senha e abre o PDF.
- O controlado de lista A/B aparece marcado "use o talonário oficial" e não sai no PDF.
- O dono no app vê a receita no resumo, abre o PDF e, se cancelada, vê o aviso sem link.

### 6.7 E4-03b: controle especial, verificação pública, repetir e o aviso de cancelamento

**Backend:** pronto em dev em 2026-10-28 (integração 16/16 contra o banco e o storage de dev, smoke por HTTP 34/34). **Não está em produção**: a receita inteira (03a e 03b) só vai depois do parecer jurídico (Q-JUR2, Q-JUR3 e J5) e com o bucket privado e a flag do controle especial criados em produção pelo Nicolas.

**Folha de controle especial (D4 e D5)**
- Com `receituario.controleEspecialHabilitado` ligada (dev: sim; produção: não), o item C1 sai na **receita de controle especial**: 2 vias (1ª farmácia, 2ª paciente), cada uma numa página, com o emitente (nome, CRMV e o **endereço completo do estabelecimento**), o paciente, o **comprador** (nome, CPF e endereço do **cliente do cadastro da clínica**) e o quadro do fornecedor em branco. Um PDF e um código para as duas folhas (P14). `folhas` passa a vir `['CONTROLE_ESPECIAL', 'SIMPLES']`.
- Assinar sem o endereço do estabelecimento (logradouro, número, bairro, cidade, UF, CEP no perfil) ou sem nome, CPF e endereço do cliente: **422 `ENDERECO_OBRIGATORIO_NA_RECEITA`** com `faltando: ['estabelecimentoEndereco' | 'compradorNome' | 'compradorDocumento' | 'compradorEndereco']`. Mostre o que falta e leve à ficha do cliente ou ao perfil. Cliente mesclado: 409 `CADASTRO_MESCLADO`; anonimizado: 409 `CLIENTE_ANONIMIZADO`.
- `FOLHA_DE_CONTROLE_ESPECIAL_INDISPONIVEL` **não existe mais**: o único motivo de `foraDoPdf` é `EXIGE_NOTIFICACAO_OFICIAL`.

**Repetir (P13):** `POST /parceiro/portal/clinica/receitas/:id/repetir` com `{ atendimentoId, versao, dispositivoId }` (o destino **já aberto**, do mesmo paciente; a rota não cria atendimento: chame `POST /atendimentos` antes). Resposta 201 `{ criadas: PrescricaoDto[], omitidos: [{ prescricaoIdDeOrigem, nome, motivo }], versao }`.
- As prescrições novas vêm **sem** as confirmações de alergia e espécie (D8) e com a conta do peso de agora.
- `omitidos.motivo`: `MEDICAMENTO_INDISPONIVEL`, `PRESCRICAO_LIMITE`, `CONFIRMACAO_PENDENTE` (prescreva de novo confirmando), `PRESCRICAO_INVALIDA` (ex.: sem peso), `NOME_LIVRE_CONTROLADO`.
- Receita ou destino de outra clínica, ou destino de outro paciente: 403. Destino finalizado: 409 `RECEITA_ATENDIMENTO_FECHADO`.

**Verificação pública (site, Luís): `petjourney.health/receita/<código>`**
- Lê `GET /public/receitas/:codigo` (sem login; aceita minúsculas). Resposta `VerificacaoDaReceitaDto`: `codigo`, `situacao` (`VALIDA`, `VENCIDA`, `CANCELADA`; sem o motivo), `emitidaEm` e `validaAte` (`YYYY-MM-DD`, no fuso da clínica), `estabelecimento`, `prescritor { nome, crmv }` (o CRMV só com a conferência), `paciente` (nome do animal), `responsavel` (só as iniciais, "R. S."), `medicamentos [{ nome, quantidade }]`.
- Nunca vem endereço, CPF, comprador, diagnóstico nem instrução. Código inexistente, mal formado, rascunho ou de clínica excluída: o mesmo **404 `RECEITA_NAO_ENCONTRADA`** (mostre "não encontramos uma receita com este código"). Mais de 20 consultas por minuto da mesma rede: 429 `TAXA_PUBLICA_EXCEDIDA` com `Retry-After`. `Cache-Control: no-store`.
- O QR do PDF abre essa página. **Base legal pendente (J5):** o texto da página não afirma o tipo jurídico da assinatura (P7); use "Receita emitida eletronicamente por ...".

**App (`petjourney-app`): o tipo novo `RECEITA_CANCELADA`**
- Push e inbox (sem e-mail), categoria CLÍNICO, canal Android de cuidado. Vai ao **dono** quando a clínica cancela uma receita que já estava no app (resumo publicado). Copy: "Receita de {pet} cancelada pela clínica" / "A clínica cancelou uma receita. Abra o resumo do atendimento para ver o que mudou."
- `dados`: `{ parceiroId, petId, petNome, atendimentoId, receitaId, publicacaoId }`. **Entre em `rotas-notificacao.ts`** (hoje a API manda `url: '/screens/notifications'`): o toque deve abrir o resumo do atendimento (`GET /tutor/clinica/atendimentos/:atendimentoId`), que já mostra a receita como cancelada e sem PDF. Sem isso, cai em Unmatched Route.
- Nada é apagado sozinho: os itens na `Consulta` e os lembretes que o responsável criou ficam (P6).

**"Salvar nos documentos" (P9): não entra.** A resposta do Nicolas ainda não veio; o app abre o PDF pela URL assinada da clínica (`GET /tutor/clinica/receitas/:id/url`), sem cópia no bucket público.

**PDF:** emoji e caracteres que a fonte não desenha saem do texto (antes viravam "?"); a linha do paciente separa os campos com " · ".

**Códigos novos:** `ENDERECO_OBRIGATORIO_NA_RECEITA`, `RECEITA_NAO_ENCONTRADA` (6 idiomas).

### 6.8 Parecer jurídico de 30/10: o que muda na receita e no prontuário

Fonte: `docs/nicolas/parecer-interno-juridico-portal-2026-10-30.md`. Backend em dev (sem push até a auditoria).

**Itens fora do PDF (substitui a regra "o único motivo é `EXIGE_NOTIFICACAO_OFICIAL`" da 6.7)**
- `foraDoPdf[]` agora traz `{ prescricaoId, motivo, instrucao }`. `instrucao` é o texto pronto, no idioma do atendimento (6 locales): mostre-o no item, sem montar a frase no front.
- `motivo` (e `itens[].classe`):

| `motivo` | `classe` | Quando | O que a tela diz (a `instrucao`) |
|---|---|---|---|
| `EXIGE_NOTIFICACAO_OFICIAL` | `NOTIFICACAO_OFICIAL` | humano das listas A e B, lista desconhecida, ou C1 com a flag desligada | talonário oficial da Vigilância Sanitária |
| `EMITIR_NO_SIPEAGRO` | `SIPEAGRO` | **todo** produto veterinário controlado do MAPA (`MAPA_VETERINARIO`), qualquer lista, mesmo com a flag ligada | emitir a Notificação de Receita Veterinária no SIPEAGRO |
| `MAGISTRAL_CONTROLADA_MAPA` | `MAGISTRAL_CONTROLADA_MAPA` | controlado do MAPA marcado como manipulado no catálogo | formulário próprio em 3 vias, com carimbo e assinatura à mão |
| `RECEITA_DE_RETENCAO_EM_PAPEL` | `RETENCAO` | antimicrobiano de uso humano (`ANVISA_RETENCAO`) | receita em 2 vias, assinada à mão, com retenção (RDC 471/2021) |

- `exigeNotificacaoOficial` continua só com os de `EXIGE_NOTIFICACAO_OFICIAL`.
- Só o C1 **humano** (`ANVISA_HUMANO`) sai na folha de controle especial, com a flag ligada. O C1 do MAPA nunca mais sai nela.
- Esses itens continuam **só na clínica**: não vão ao app nem ao PDF.

**Finalizar com item fora do PDF (P2 revista):** a prescrição que nunca sai no PDF **não precisa de receita**, e ficar solta não gera `PRESCRICAO_SEM_RECEITA`. Ela fica no prontuário como conduta. Se o veterinário puser só itens desse tipo num rascunho, assinar dá `RECEITA_SEM_ITEM_EMITIVEL`. Nesse caso, descarte o rascunho (`DELETE /receitas/:id`) e finalize. Sugestão de tela: não ofereça "pôr na receita" para item com `foraDoPdf`.

**Catálogo:** o medicamento ganha `manipulado: boolean` (leitura e escrita da clínica e do admin, padrão `false`). O enum `RegimeControle` ganha `ANVISA_RETENCAO` (o admin marca o antimicrobiano de uso humano na curadoria).

**Nome livre (P3):** é conferido também contra as 21 substâncias que o MAPA manda continuar tratando como controladas (Ofício-Circular 6/2026: xilazina, detomidina, medetomidina, tiletamina, zolazepam, clembuterol etc., em pt, en, es e sr). Se o nome cita uma delas, o retorno é 422 `NOME_LIVRE_CONTROLADO` com `reason: SUBSTANCIA_CONTROLADA`. A assinatura confere de novo e, se casar, devolve o mesmo 422 com `prescricaoId`. O veterinário tem de escolher o medicamento do catálogo.

**PDF:** a folha **simples** ganha, depois das datas, a linha "Assinatura eletrônica avançada (Lei 14.063/2020, art. 14)" nos 6 locales (a Q-JUR2 respondeu: para a receita comum, a avançada basta). A folha de controle especial **nunca** diz isso. O rodapé não muda. A tela da receita simples pode usar a mesma frase; a do controle especial, não.

**Prontuário: senha ao finalizar e ao anular (seção 5.5)**
- `POST .../:id/finalizar` e `POST .../:id/anular` aceitam `senha` (opcional, até 200).
- Sem `senha` e sem janela aberta: **401 `ASSINATURA_SENHA_EXIGIDA`** com `janelaMinutos: 15`. Abra o diálogo de senha e reenvie com `senha`. Isso não gasta tentativa.
- Senha certa (ou assinar uma receita com a senha) abre uma **janela de 15 minutos nesta sessão**: os próximos finalizar e anular no mesmo login e no mesmo aparelho passam sem `senha`. Outro aparelho, ou o token renovado, pede de novo. A assinatura da receita e dos documentos continua pedindo a senha sempre.
- Senha enviada é sempre conferida, mesmo com a janela aberta. Errada: 401 `ASSINATURA_SENHA_INCORRETA`. 5 erros da pessoa ou 10 da rede em 15 min (o mesmo balde da assinatura e da troca de senha): 429 `ASSINATURA_SENHA_BLOQUEADA`. Conta sem senha própria: 403 `ASSINATURA_SENHA_NECESSARIA`.
- Recomendação: no 401, olhe o `codigo`. Não trate como sessão expirada.
- A `Idempotency-Key` do finalizar continua valendo. A senha não entra no hash do corpo, então reenviar com a mesma chave e sem a senha repete a resposta.

**Códigos novos:** `ASSINATURA_SENHA_EXIGIDA` (6 idiomas). `NOME_LIVRE_CONTROLADO` ganha `reason: SUBSTANCIA_CONTROLADA`.



---

## 7. Tratamentos em casa e adesão, lado do responsável (E4-05a)

**Backend:** primeira fatia pronta e validada em dev em 2026-10-28 (unit, integração no Postgres de dev e smoke por HTTP `npx tsx scripts/smoke-adesao.ts`, 29/29). **Não está em produção.** Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e4-prontuario/05-tratamentos-e-adesao.md` (decisões do gerente de 28/10).

**Só o app (`petjourney-app`) entra aqui.** A leitura da clínica (faixa de doses, alerta, crítico, contato, contador e `ADESAO_EM_QUEDA`) está na seção **7b** (E4-05b): esta seção 7 não tem rota de portal nem tipo de notificação novo.

O ciclo: a clínica prescreve e publica; **nada vira lembrete sozinho** (A2). O responsável toca "Criar lembretes" no resumo do atendimento, e cada remédio vira um lembrete de dose (ou um tratamento de uso contínuo). Em casa, quem dá o remédio toca "Dei" ou "Pulei" no aviso. A clínica só vai ver isso na E4-05b, e só se o responsável deixar.

Todas as rotas: `JwtAuthGuard`, prefixo `/tutor/clinica`, envelope `{ statusCode, message, data }`, erro com `codigo`. **Mande o header `X-Timezone`** (o fuso do aparelho): a grade de hoje, a primeira dose sugerida e o fim do tratamento contam nele.

### 7.1 Quem pode o quê

| Pessoa | Lê a sugestão e a grade | Cria lembretes, registra, desfaz | Liga/desliga o compartilhamento |
|---|---|---|---|
| Dono do pet | sim | sim | sim |
| Família com acesso de edição | sim | sim | **não** (403 `SOMENTE_LEITURA`) |
| Família só com leitura | sim | **não** (403 `SOMENTE_LEITURA`): esconda os botões (`podeRegistrar: false`, `podeCriar: false`) | não |
| Outra pessoa, vínculo encerrado, pet passado a outra conta, atendimento anulado | 403 `OWNERSHIP_FORBIDDEN` (o mesmo para "não existe") | 403 | 403 |

Pet inativo ou com seleção de pets pendente (plano): a escrita dá 403 `PET_INATIVO` ou `SELECAO_PETS_PENDENTE`, como no resto do prontuário.

### 7.2 Criar os lembretes da receita

**1) Sugestão (leitura pura):** `GET /tutor/clinica/atendimentos/:id/receita/lembretes/sugestao` devolve `SugestaoDosLembretesDto`:
- `receitaCancelada`: a clínica cancelou a receita (veja 7.6);
- `podeCriar`: você é o dono ou tem edição;
- `itens[]`, um por remédio publicado, com **o `itemId` que o resumo do atendimento não traz**: `itemId`, `nome`, `dose`, `via`, `frequencia` (texto), `duracaoDias` (`null` no uso contínuo), `usoContinuo`, `suportado`, `motivoNaoSuportado`, `destino` (`MEDICAMENTOS` = lembrete com fim; `TRATAMENTOS` = uso contínuo), `regime { frequencia, intervaloHoras }`, `primeiraDoseSugerida` (ISO com o offset do seu fuso), `jaTemLembrete`, `tratamentoId`.
- A primeira dose sugerida é a próxima hora cheia, **adiada até 8 h para a madrugada (0h às 6h) ficar livre**, só em remédio de 8 em 8 h ou mais espaçado. De 6 em 6 h (ou menos) não adia: a dose das 3 h não pode sumir.
- `suportado: false`: o intervalo não cabe (só 1 a 72 h, 168 h, 336 h e 720 h) ou passa de 1000 doses. Mostre "Fale com a clínica" e não ofereça o toque para esse remédio.

**2) O toque:** `POST /tutor/clinica/atendimentos/:id/receita/lembretes` → **201** `LembretesCriadosDto`.

```json
{ "itens": [ { "itemId": "...", "primeiraDose": "2026-10-28T15:00:00-03:00" } ], "compartilharComAClinica": true }
```

- `itens`: 1 a 10, sem repetir. `primeiraDose` é opcional (sem ela vale a sugestão); aceita de 1 h atrás até 24 h à frente (ou um passo, se o intervalo for maior): senão 400 `PRIMEIRA_DOSE_FORA_DO_LIMITE`.
- `compartilharComAClinica` (padrão `true`; **só vale quando quem toca é o dono**: se for família com edição, o campo é ignorado e o tratamento nasce ligado, e o dono desliga depois no `PATCH`): **a tela tem que dizer antes do toque que a clínica vai ver os registros** deste tratamento, com a chave já ligada, e o responsável pode desligar. Texto sugerido: "A clínica poderá ver se as doses foram dadas. Você pode desligar quando quiser." (copy final com o Nicolas: ver pendências J1).
- **Tudo ou nada.** Se um dos remédios não cabe, vem **422 `FREQUENCIA_NAO_SUPORTADA`** com `itens: [{ itemId, motivo }]` e nada é criado, nem os bons.
- **Duplo toque** (ou dois aparelhos): sem erro; o item que já tinha tratamento volta com `jaExistia: true`.
- Remédio com fim: lembrete de dose com `repetirAte` no **fim do dia civil** do dia N (o dia 1 é o da primeira dose), no seu fuso. Uso contínuo: tratamento fixo ativo, sem data de fim, com o lembrete ligado. O item da receita ganha `lembreteSerieId`/`tratamentoFixoId`, como na prescrição que o app já faz.
- O limite do plano não muda para a receita da clínica (decisão 15): hoje criar lembrete e tratamento não tem teto por plano; só a seleção de pets pendente barra.
- Receita **cancelada** pela clínica: 409 `RECEITA_CANCELADA_PELA_CLINICA` ao criar (os já criados seguem, veja 7.6).
- Limite de pedidos: 30 por hora por pessoa (429 `ADESAO_TAXA_EXCEDIDA` com `tenteDeNovoEmSegundos`).

### 7.3 Ler os tratamentos e a grade

`GET /tutor/clinica/tratamentos?petId=` → `ListaDeTratamentosDto { itens, dia, truncado }` (até 50; encerrados por último). `petId` de pet que você não lê ou que não existe: 403 (não 404). Sem `petId`, vem de todos os pets que você lê. Por tratamento: `id`, `petId`, `clinicaNome`, `medicamento`, `posologia { dose, unidade, via, frequencia, duracaoDias, instrucoes, usoContinuo }`, `inicioEm`, `encerrado`, `encerradoEm`, `compartilhadoComAClinica`, `podeAlterarCompartilhamento` (dono), `podeRegistrar`, `receitaCancelada`, `lembreteSerieId` (nulo se você apagou o lembrete) e `hoje[]`, as doses de hoje no seu fuso.

Cada dose (`DoseDoTratamentoDto`): `ocorrenciaId` (nulo se a dose ainda não tem linha), `previstaEm`, `situacao`, `motivo`, `registradoPor` (**primeiro nome** de quem registrou; nulo se veio por outro caminho do app), `registradoEm`, `administradoEm`, `podeRegistrar`, `podeDesfazer`.

| `situacao` | Quando | O que mostrar |
|---|---|---|
| `ABERTA` | a janela do registro está aberta (60 min antes até a dose seguinte) | "Dei" e "Pulei" (se `podeRegistrar`) |
| `PREVISTA` | ainda não chegou | só o horário |
| `DADA` | alguém tocou "Dei" | marcada, com quem; "Desfazer" se `podeDesfazer` |
| `PULADA` | alguém tocou "Pulei" | o motivo (esqueci, cuspiu, acabou o remédio). **Não é vermelha** |
| `SEM_REGISTRO` | a janela fechou e ninguém marcou | **silencioso**: sem aviso de atraso, sem cobrança. Não quer dizer que não foi dada |

`GET /tutor/clinica/tratamentos/:id/doses?desde=&ate=` → `DosesDoTratamentoDto { tratamentoId, desde, ate, doses[], truncado }`. `desde` e `ate` são dias `AAAA-MM-DD` no seu fuso (padrão: 6 dias atrás até hoje), **no máximo 90 dias** (senão 400 `ADESAO_PERIODO_INVALIDO`). A resposta corta em 256 KB (`truncado: true`).

**Nenhuma resposta traz porcentagem**, e nenhuma traz `critico`, alerta, contato nem nota da clínica: isso é só do portal. Mostre contagens ("39 dadas, 1 pulada"), nunca "97%".

### 7.4 "Dei" e "Pulei"

`POST /tutor/clinica/tratamentos/:id/doses` → **201** `DoseRegistradaDto`:

```json
{ "ocorrenciaId": "...", "situacao": "DADA" }
{ "ocorrenciaId": "...", "situacao": "PULADA", "motivo": "ESQUECI" }
```

- `motivo` ∈ `ESQUECI`, `CUSPIU`, `ACABOU`: **obrigatório em `PULADA`** (400 `MOTIVO_OBRIGATORIO`) e **proibido em `DADA`** (400 `MOTIVO_SO_NA_PULADA`).
- `DADA` aceita `administradoEm` (ISO com fuso) para "dei às 15h", com as regras de dose fora do horário que o app já conhece.
- A resposta traz `proximaDose { ocorrenciaId, dataPrevista }` (nulo se era a última). O motor de lembretes gera a próxima sozinho, tanto no "Dei" quanto no "Pulei".
- Só se registra a dose que **tem linha** (`ocorrenciaId`) e está **aberta**. Dose antiga sem registro continua pela dose retroativa do calendário (`POST /lembrete/serie/:serieId/dose-retroativa`).
- Erros 409: `DOSE_JA_REGISTRADA` (**outra pessoa da casa foi mais rápida**, inclusive quando as duas tocam ao mesmo tempo: o servidor confere o status sob a trava, então o "Pulei" de quem chegou depois nunca sobrescreve o "Dei" do outro; vem `quem`, o primeiro nome, ou `null`, e `em`: mostre "Fátima já registrou esta dose às 08:02" e atualize a grade), `DOSE_FORA_DA_JANELA` (vem `abreEm` e `fechaEm`), `TRATAMENTO_ENCERRADO`.
- **"Pulei" não se desfaz (decisão 6).** Antes do toque, o app pede confirmação: **"Pular esta dose? Não dá para desfazer"**, com "Pular" e "Cancelar". Se a pessoa deu o remédio depois, a saída é a dose retroativa.
- **No aviso de dose** (notificação), os botões "Dei" e "Pulei" chamam esta rota com o `ocorrenciaId` do aviso. O `dados` do aviso de dose do lembrete já carrega `ocorrenciaId`; a rota só aceita a ocorrência que pertence ao tratamento (do contrário, 403).

**Várias de uma vez (o mesmo aviso, 1 a 10 doses do mesmo pet):** `POST /tutor/clinica/tratamentos/doses` com `{ itens: [{ tratamentoId, ocorrenciaId, situacao, motivo?, administradoEm? }] }` → 201 `{ itens: [{ tratamentoId, ocorrenciaId, ok, dose, codigo }] }`. Pet de outra pessoa em qualquer item: 403 e nada é gravado. Depois disso, cada item é uma linha: conflito de estado vira `ok: false` com o `codigo`; a dose que já estava registrada volta `ok: true`, `jaExistia: true`.

**Desfazer o "Dei":** `DELETE /tutor/clinica/tratamentos/:id/doses/:ocorrenciaId` → **204**. Só quem registrou o "Dei" (`podeDesfazer`), dentro da janela. Erros: 403 `DOSE_DE_OUTRA_PESSOA`, 409 `PULADA_NAO_SE_DESFAZ`, 409 `DOSE_NAO_REGISTRADA`, 409 `DOSE_FORA_DA_JANELA` e 409 **`DOSE_SEGUINTE_JA_REGISTRADA`** (a dose seguinte já foi registrada: esta não se desfaz mais; `podeDesfazer` já vem `false` nesse caso, mas outra pessoa pode registrar a seguinte entre a leitura e o toque, então trate o erro). Depois de desfazer, a dose volta a `ABERTA` e fica uma só dose pendente.

**Janela de falha declarada:** o autor e o motivo são gravados logo depois de a dose ser marcada. Se o servidor cair no meio, a dose fica marcada **sem autor** (a grade mostra `registradoPor: null` e a clínica vai ler "não informado"). É raro e não perde a dose.

### 7.5 Compartilhar com a clínica

`PATCH /tutor/clinica/tratamentos/:id` com `{ "compartilhadoComAClinica": true | false }` → 200 `{ id, compartilhadoComAClinica }`. **Só o dono** (família com edição: 403 `SOMENTE_LEITURA`); `null` é 400. Desligar vale na hora (a clínica deixa de ler as doses e qualquer alerta é zerado) e **funciona mesmo com o pet inativo**. Mostre a chave em cada tratamento (`podeAlterarCompartilhamento`).

### 7.6 Receita cancelada pela clínica (decisão 14)

Nada é apagado nem encerrado sozinho. O tratamento vem com `receitaCancelada: true`: mostre **"a clínica cancelou esta receita"** e um toque para **encerrar os lembretes**. Esse toque usa a rota que já existe, `POST /lembrete/serie/:lembreteSerieId/encerrar` (com `encerrarTratamento: true` no uso contínuo). Depois dele a lista passa a mostrar `encerrado: true` e as rotas de dose respondem 409 `TRATAMENTO_ENCERRADO`. Enquanto a pessoa não encerrar, continua registrando normalmente. (O carimbo `encerradoEm` do tratamento é um espelho gravado pelo cron da E4-05b; `encerrado` no app vem sempre da série desligada.)

### 7.7 Exclusão, privacidade e o que a clínica verá (E4-05b)

- Apagar o pet, o vínculo ou a consulta **nunca trava** por causa do tratamento: o tratamento da clínica e os registros caem junto (Cascade); apagar só o lembrete deixa o tratamento sem série (`lembreteSerieId: null`), e "Criar lembretes" de novo religa o mesmo tratamento.
- A clínica (E4-05b) só lê o que está compartilhado, vê **`DONO`, `FAMILIA` ou `NAO_INFORMADO`** (nunca o nome de quem registrou) e nenhuma porcentagem. O alerta é só da equipe e nunca chega ao app. O primeiro nome que o app mostra (`registradoPor`, `quem`) é só para quem está no mesmo pet.
- Pendências do Nicolas de que a tela depende: base legal do compartilhamento ligado por padrão, retenção e exclusão, nome de familiar no 409 (J1 a J5 em `docs/nicolas/pendencias.md`).

### 7.8 Códigos novos (6 idiomas)

`FREQUENCIA_NAO_SUPORTADA` (422), `DOSE_JA_REGISTRADA`, `DOSE_FORA_DA_JANELA`, `TRATAMENTO_ENCERRADO`, `PULADA_NAO_SE_DESFAZ`, `DOSE_NAO_REGISTRADA`, `RECEITA_CANCELADA_PELA_CLINICA` (409); `MOTIVO_OBRIGATORIO`, `MOTIVO_SO_NA_PULADA`, `PRIMEIRA_DOSE_FORA_DO_LIMITE`, `ADESAO_ITENS_INVALIDOS`, `ADESAO_PERIODO_INVALIDO` (400); `DOSE_DE_OUTRA_PESSOA` (403); `DOSE_SEGUINTE_JA_REGISTRADA` (409); `ADESAO_TAXA_EXCEDIDA` (429). `SOMENTE_LEITURA` e `SEM_CONSENTIMENTO` já existiam. O texto para mostrar vem em `message` (idioma do pedido); decida a tela pelo `codigo`.

### 7.9 Rollback

Aditivo: duas tabelas novas (`TratamentoDaClinica`, `RegistroDeDose`) e nada em `LembreteOcorrencia`. "Dei" é `CONCLUIDO` e "Pulei" é `CANCELADO` na ocorrência, o que a build antiga do app já entende (o calendário mostra "pulada"). Voltar o código não reativa nenhum aviso de dose.

## 7b. Tratamentos em casa e adesão, lado da clínica (E4-05b)

**Backend:** pronto e validado em dev em 2026-10-28 (unit, integração no Postgres de dev, smoke por HTTP `npx tsx scripts/smoke-adesao.ts`, 44/44). **Não está em produção.** Fecha a E4-05. Entra no **portal** (`petjourney-admin`: ficha do paciente, lista da clínica e painel de pendências) e no **app** (um tipo de notificação novo, 7b.7).

Todas as rotas: `/parceiro/portal/...`, `JwtAuthGuard` + `ParceiroGuard` + `ModuloGuard` (módulo CLÍNICA), envelope `{ statusCode, message, data }`, `?parceiroId=` quando o usuário tem mais de um parceiro, erro com `codigo`. **Mande `X-Timezone`** (o fuso da clínica): os dias da faixa e a madrugada do push contam nele.

### 7b.1 Rotas

| Rota | Permissão | O que faz |
|---|---|---|
| `GET /parceiro/portal/pacientes/:pacienteId/tratamentos` | `prontuario.ler` | A adesão do paciente: até 20 tratamentos (`AdesaoDoPacienteDto { itens[], truncado }`) |
| `GET /parceiro/portal/clinica/tratamentos?filtro=PEDEM_ATENCAO&cursor=&limit=` | `prontuario.ler` | Lista da clínica, do mais novo ao mais antigo (`PaginaDeTratamentosDto { itens[], proximoCursor }`); `limit` até 50; `filtro=PEDEM_ATENCAO` = só os críticos com alerta aberto |
| `GET /parceiro/portal/clinica/tratamentos/:id/doses?desde=&ate=` | `prontuario.ler` | A faixa de doses de um tratamento (`DosesParaClinicaDto`); `desde`/`ate` são dias `AAAA-MM-DD` na parede da clínica; padrão 42 dias até hoje, **no máximo 90** |
| `PATCH /parceiro/portal/clinica/tratamentos/:id` `{ critico: boolean }` | `prontuario.escrever` | Marca ou desmarca o crítico (`CriticoAlteradoDto`). Desmarcar apaga o alerta |
| `POST /parceiro/portal/clinica/tratamentos/:id/contato` `{ nota }` (200) | `prontuario.ler` | "Já falei com a família": grava a nota **interna** (1 a 500 caracteres) e apaga o alerta (`ContatoRegistradoDto { tratamentoId, contatoEm }`) |

Quem pode: veterinário, enfermagem, dono e administrador leem e registram contato (decisão 3); **marcar crítico exige `prontuario.escrever`** (veterinário, dono). Recepção e quem não tem `prontuario.ler`: 403. Módulo suspenso: lê, não escreve.

### 7b.2 O que a ficha mostra

Cada item de `AdesaoParaClinicaDto`: `tratamentoId`, `medicamento`, `posologia { dose, unidade, via, frequencia, duracaoDias, instrucoes, usoContinuo }`, `inicioEm`, `situacao`, `encerradoEm`, `critico`, `faixa`, `resumo`, `horarioQueDestoa`, `alerta`, `contato { em, nota }`.

- `situacao`: `ACOMPANHANDO`, `ENCERRADO` (o tratamento acabou ou a receita foi cancelada) ou **`NAO_COMPARTILHADO`** (o responsável desligou o compartilhamento: `faixa`, `resumo`, `horarioQueDestoa` e `alerta` vêm `null`). Mostre "o responsável não compartilha as doses deste tratamento" e nada mais.
- `faixa { desde, minutos[], estados, quem }`: vetores do mesmo tamanho, um item por dose. `minutos[i]` = minutos desde `desde`. `estados[i]`: **`D`** dada, **`P`** pulada, **`S`** sem registro, **`A`** aberta (a dose da vez, ainda dá para marcar: fora de qualquer conta). `quem[i]`: **`O`** dono, **`F`** família, **`N`** não informado, **`-`** ninguém registrou. Desenhe uma bolinha por dose; `S` é cinza neutro, **nunca vermelho**: "sem registro" não é dose perdida.
- `resumo { desde, dadas, puladas, pulouSemMotivo, semRegistro, abertas, motivos[], porQuem }`: tudo **contagem**, desde a última consulta (ou o início do tratamento). `motivos[]` vem em código (`MotivoDaDosePulada`): o texto ("o remédio acabou", "o pet recusou") é do portal. `porQuem { DONO, FAMILIA, NAO_INFORMADO }`.
- `horarioQueDestoa { horario ("23:00"), dadas, fechadas }`: a dose do horário que quase ninguém registra. Use para uma frase neutra ("as doses das 23:00 quase nunca são registradas").
- **Nunca há porcentagem, `petId`, `ocorrenciaId`, nome de quem registrou nem texto livre do responsável.** Não calcule porcentagem no front.
- `truncado: true` na ficha: havia mais de 20 tratamentos que a clínica pode ler (vínculo ativo, dono atual e vivo). Os em curso vêm primeiro, depois os mais novos; o que fica de fora é sempre o mais antigo e encerrado. Mostre "há mais tratamentos; abra pela lista". `truncado: true` na faixa: passou de 256 KB e foi cortada; peça um período menor.

### 7b.3 O alerta (só da equipe)

`alerta { motivo, desde, janela { dadas, puladas, semRegistro, fechadas }, motivos[] }`, só em tratamento **crítico, compartilhado e em curso**:
- **`PULADAS`**: 2 ou mais doses puladas nas últimas 72 h. Texto sugerido: "pularam N doses nos últimos 3 dias".
- **`QUEDA`**: menos da metade das doses registradas nas últimas 72 h, depois de uma semana de registros regulares. **Texto obrigatório (decisão 7): "pode ser que tenham parado de registrar".** Nunca escreva "o remédio não foi dado".
- O contato registrado **depois da última dose que faltou** apaga o alerta; uma dose nova que falte depois reabre.
- Na ficha o alerta é calculado ao vivo. Na **lista** (`TratamentoNaListaDto`: `tratamentoId`, `pacienteId`, `pacienteNome`, `medicamento`, `critico`, `situacao`, `inicioEm`, `alerta`, `alertaDesde`, `contatoEm`) vem o que o cron gravou, com até 30 minutos de atraso. "Pede atenção" na lista = `alerta` não nulo.

### 7b.4 Contador e aviso (painel de pendências, E1-06)

- Contador novo **`tratamentosEmQueda`** (categoria `ATENCAO`, módulo CLÍNICA, permissão `prontuario.ler`), rota `/clinica/tratamentos?filtro=PEDEM_ATENCAO`. Conta só crítico com alerta aberto.
- A equipe (`prontuario.ler`) recebe uma notificação **`ADESAO_EM_QUEDA`** quando o alerta abre (e quando troca de `PULADAS` para `QUEDA` ou o contrário), **uma vez por episódio**, mesmo com várias réplicas da API. `dados`: `{ parceiroId, tratamentoId, pacienteId, petNome, motivo }`. **Sem push entre 22h e 8h no fuso da clínica**: o aviso entra na caixa na hora e o push sai às 8h.
- Título: "Um tratamento de {pet} pede atenção". Corpo de `QUEDA`: "...pode ser que tenham parado de registrar. Abra a ficha." A `url` vem `/screens/notifications`; no portal, abra a ficha do paciente (`pacienteId`).

### 7b.5 O crítico

Vem **ligado da receita** (decisão 9): o veterinário decide na receita e pode mudar aqui. `PATCH { critico }` é idempotente. Desligar apaga o alerta. Em tratamento `ENCERRADO`: 409 `TRATAMENTO_ENCERRADO`.

### 7b.6 A adesão no resumo do paciente (E2-03)

`GET /parceiro/portal/pacientes/:id/resumo` agora devolve `adesao` preenchida (antes era `null`): `{ tratamentos[], truncado }`, cada um com `tratamentoId`, `medicamento`, `critico`, `resumo` (as mesmas contagens, **janela de no máximo 10 dias** desde a última consulta) e `alerta`. O `alerta` do resumo é o que o cron gravou (o mesmo da lista e do contador, até 30 minutos de atraso), **independente da janela do resumo**: consulta ontem não esconde duas puladas de anteontem. Só os **compartilhados e em curso**, até 20. Sem tratamento: continua `null`. Se a leitura falhar, `adesao` vem `null` e `naoDisponivel` traz `"adesao"`: mostre o cartão como "indisponível agora", não como "sem tratamento". Para o período todo, abra a ficha (7b.1).

### 7b.7 App: tipo de notificação novo

No app (`services/notificacao/rotas-notificacao.ts`) acrescente **`ADESAO_EM_QUEDA`** ao union `TipoNotificacao` e aos três mapas, na mesma release da API (é um aviso da equipe, como `PARCEIRO_MODULO_VENCENDO`): `ROTA_POR_TIPO`: `/screens/notifications`; `AFETA_HOME_POR_TIPO`: `false`; `PERFIL_POR_TIPO`: `null`. O `audit:notificacao-rotas` da API reprova até o app ganhar o tipo.

### 7b.8 Códigos

- 403 `OWNERSHIP_FORBIDDEN`: tratamento ou paciente inexistente, de **outra clínica**, de vínculo encerrado, de pet passado a outra conta ou de **conta do responsável com exclusão agendada** (a ficha e a faixa dão 403, a lista e o contador deixam de contá-lo; o mesmo código para "não existe").
- 403 `SEM_CONSENTIMENTO`: faixa ou contato num tratamento que o responsável não compartilha (a ficha mostra `NAO_COMPARTILHADO`; a faixa e o contato respondem este código).
- 409 `TRATAMENTO_ENCERRADO`: crítico ou contato num tratamento encerrado (decidido pela série do responsável no momento do pedido, não pelo `encerradoEm`).
- 400 `ADESAO_PERIODO_INVALIDO`: `desde`/`ate` fora do formato, invertidos ou com mais de 90 dias.
- 429 `ADESAO_TAXA_EXCEDIDA` (`tenteDeNovoEmSegundos`): ficha do paciente **120 por hora**, faixa e lista 1.200 por hora, ações 300 por hora, por usuário. A ficha é a rota mais cara: não recarregue a cada foco de tela.
- 400: nota de contato vazia ou com mais de 500 caracteres, `critico` que não é booleano, campo extra.

### 7b.9 Atrasos que a tela precisa respeitar

- `encerradoEm` é um espelho gravado pelo cron a cada 30 minutos: a **verdade é a série** do responsável. Um tratamento pode aparecer `ACOMPANHANDO` até 30 minutos depois do fim.
- A lista e o contador refletem o cron (até 30 minutos de atraso); a ficha é ao vivo.
- Nota de contato, crítico e alerta são só da equipe: nada disso chega ao app do responsável.

### 7b.10 Rollback

Aditivo: um valor novo no enum de notificação (`ADESAO_EM_QUEDA`) e nenhuma coluna nova (as da 05b já vieram na migration da 05a). Voltar o código mantém os dados; sem o cron o alerta só deixa de ser gravado, e a ficha continua calculando ao vivo.

### 6.8 Correção da auditoria da E4-03b

- **Site (`/receita/<código>`):** a página precisa **repassar o IP de quem visita** à API (o mesmo padrão `ipParaSinal` do agendamento online) ou chamar a API direto do navegador. Sem isso, todas as farmácias dividem um balde só e a página trava com 429.
  - A API agora limita também por /48 do IPv6.
  - Sob uma enxurrada de 404 (mais de 300 por minuto somando todas as origens), a rota passa a exigir o captcha Turnstile no header `X-Captcha-Token` (400 `CAPTCHA_INVALIDO` sem ele). Tenha o widget pronto para esse caso.
- **Site, resposta reduzida:** a resposta ganhou `reduzida`. Com `reduzida: true` (cliente anonimizado, ou 6 meses depois da validade), vêm só `codigo`, `situacao`, `emitidaEm` e `validaAte`; `estabelecimento`, `prescritor`, `paciente` e `responsavel` vêm nulos e `medicamentos` vazio. Mostre só a situação.
- **App:** `GET /tutor/clinica/receitas/:id/url` ganhou `motivo`. `SOMENTE_O_DONO` vale para quem é da família e a receita tem a folha de controle especial (que leva o CPF e o endereço do comprador); vem com `url: null`. Mostre "o PDF desta receita fica com o dono do pet". `CANCELADA` vale para a receita cancelada.
- **Portal, ao assinar:** 422 `RECEITA_TEXTO_NAO_IMPRIMIVEL` com `campo` (`pacienteNome`, `responsavelNome`, `item.nome`, `item.instrucoes`...), `prescricaoId` quando é um item e `caracteres`. O texto tem letras que o PDF não imprime, como a escrita árabe. Peça para escrever em letras latinas ou cirílicas.
  - Frações (`½`, `⅓`, `1⁄2`), `μ`/`µ`, `×` e o cirílico saem no PDF.
  - `≥`, `≤` e `→` saem como `>=`, `<=` e `->`. Emoji some.

---

## 8. Documentos clínicos, primeira fatia (E4-06a)

**Backend:** pronto e validado em dev em 2026-10-28 (unit, integração contra o Postgres e o bucket privado de dev, smoke por HTTP `scripts/smoke-documentos.ts`). **Não está em produção.** Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e4-prontuario/06-documentos-clinicos.md`. A E4-06b (termos com aceite, laudos, entrega no app, salvar nos documentos) e a E4-06c (cópia do prontuário) entram depois nesta seção.

### 8.1 O que dá para emitir agora

Os tipos são os de `TIPOS_DE_DOCUMENTO_CLINICO` do contrato do portal **menos `RECEITUARIO`** (a receita é a seção 6). Na 06a, seis emitem:

| Tipo | Molde no portal | Campos do `conteudo` (todos opcionais no rascunho) | Para emitir |
|---|---|---|---|
| `ATESTADO_SAUDE` | `DocumentoAtestado` (`saude`) | `dataDoExame` (AAAA-MM-DD), `semAlteracoes`, `constatacoes` (2000), `recomendacoes` (2000), `finalidade` (200) | `dataDoExame` e (`constatacoes` **ou** `semAlteracoes: true`, nunca os dois) |
| `ATESTADO_VIAGEM` | `DocumentoAtestado` (`viagem`) | `dataDoExame`, `antirrabica` (300), `vermifugacao` (300), `validadeExigida` (200), `destino` (200), `finalidade` (200) | `dataDoExame` |
| `DECLARACAO_OBITO` | `DocumentoObito` | `causaProvavel` (1000), `necropsiaRealizada`, `destinacao` (`CREMACAO_INDIVIDUAL`, `CREMACAO_COLETIVA`, `SEPULTAMENTO`, `RETIRADO_PELO_RESPONSAVEL`), `observacoes` (1000) | o óbito **registrado no paciente** (senão 422 `OBITO_NAO_REGISTRADO`); a data e a hora impressas são as do cadastro |
| `COMPROVANTE_VACINACAO` | `DocumentoVacinacao` | `observacoes` (1000) | pelo menos uma dose registrada na clínica (as vacinas saem da vacinação, nunca do corpo). O PDF separa "Aplicadas nesta clínica" (com lote e fabricante; a declaração cobre só elas) de "Registradas de outro serviço (informado pelo responsável)" (com o local, sem lote nem fabricante). Faça a pré-visualização do portal no mesmo formato |
| `PEDIDO_EXAME` | `DocumentoPedidoExame` | `exames` (1 a 20, cada um `{ exameId }` do catálogo **ou** `{ nome }` livre), `indicacao` (1000), `orientacoesDeColeta` (1000) | pelo menos um exame |
| `ENCAMINHAMENTO` | `DocumentoEncaminhamento` | `destinatario` (200), `motivo` (2000), `historico` (2000), `achados` (2000), `diagnostico` (2000), `medicacaoEmUso` (1000), `solicitacao` (2000) | `motivo` e `solicitacao` |

Os tipos da 06b (`TERMO_*`, `PRONTUARIO`, `RELATORIO_PLANO`, `ORIENTACOES`, `ORCAMENTO`, `ATESTADO_COMPARECIMENTO`) dão 422 `DOCUMENTO_TIPO_INDISPONIVEL`: deixe a opção desligada.

**Identidade não vai no corpo.** Paciente (nome, espécie, raça, sexo, idade, peso, **microchip, pelagem**), responsável, clínica e quem assina (nome e CRMV) o servidor lê do cadastro **na emissão**. Se o corpo mandar essas chaves, elas são ignoradas. Quem preenche o texto clínico é a tela (pode pré-preencher do atendimento: diagnóstico, exames solicitados, achados), e o veterinário confere antes de emitir. Campo vazio sai como linha para preencher à mão, nunca deduzido. Os tipos de cada molde estão no contrato como `Conteudo*Dto`.

### 8.2 Rotas (módulo Clínica; `?parceiroId=` com mais de um parceiro)

| Método e rota | Permissão | Resposta |
|---|---|---|
| `POST /parceiro/portal/clinica/documentos` `{ tipo, pacienteId, atendimentoId?, idioma?, conteudo? }` | `prontuario.escrever` | 201 `DocumentoClinicoDto`. Com `atendimentoId` de atendimento em rascunho, vem `versaoDoAtendimento` (a versão dele sobe: siga gravando o atendimento com ela) |
| `PATCH .../documentos/:id` `{ conteudo, idioma? }` | `prontuario.escrever` | 200. **Substitui o conteúdo inteiro** (sem lock: o último a gravar vence). Emitido ou anulado: 409 |
| `DELETE .../documentos/:id` | `prontuario.escrever` | 200 `{ id, descartado: true }`. Só rascunho |
| `GET .../documentos/:id` | `prontuario.ler` | 200 `DocumentoClinicoDto` |
| `GET .../pacientes/:pid/documentos?atendimentoId=&cursor=&limit=` | `prontuario.ler` | 200 `{ itens, proximoCursor }`, do mais novo, até 50 |
| `POST .../documentos/:id/emitir` `{ senha }` + `Idempotency-Key` (UUID v4, opcional) | `prontuario.finalizar` | 200 `DocumentoClinicoDto` com `codigoVerificador`, `autorNome`, `autorCrmv`, `resumoDoConteudo`. Duplo toque com a mesma chave: o mesmo documento |
| `GET .../documentos/:id/pdf` | `prontuario.ler` | 200 `{ id, url, expiraEm }` (URL assinada de 15 min). Rascunho: 409 `DOCUMENTO_NAO_EMITIDO`; anulado: 409 `DOCUMENTO_JA_ANULADO` |
| `POST .../documentos/:id/anular` `{ motivo (10 a 500), confirmarOutroResponsavel? }` | `prontuario.finalizar` | 200. Exige o CRMV conferido. Documento de outro veterinário sem confirmar: 409 `ATENDIMENTO_DE_OUTRO_PROFISSIONAL` (modal com `responsavel` e `voce`) |
| `GET /public/documentos/:codigo` | público | 200 `{ codigo, situacao: VALIDO ou ANULADO, emitidoEm, estabelecimento, emitente: { nome, crmv }, resumoDoConteudo }`. **Nunca o tipo** |

`DocumentoClinicoDto`: `id, tipo, status (RASCUNHO, EMITIDO, ANULADO), pacienteId, atendimentoId, idioma, conteudo, emitidoEm, codigoVerificador, autorNome, autorCrmv, resumoDoConteudo, foraDoHashDoAtendimento, anulacao { em, origem, motivo } ou null, pdfDisponivel, criadoEm, atualizadoEm`. `origem` da anulação: `PROFISSIONAL` ou `ATENDIMENTO_ANULADO` (anular o atendimento anula os documentos emitidos dele).

### 8.3 Emitir: o que a tela trata

- A emissão pede a **senha da conta**, como a receita: 401 `ASSINATURA_SENHA_INCORRETA`; 429 `ASSINATURA_SENHA_BLOQUEADA` (5 erros da pessoa ou 10 da rede em 15 min, com `tenteDeNovoEmSegundos`); 403 `ASSINATURA_SENHA_NECESSARIA` (conta sem senha: "crie a senha no perfil").
- 403 `CRMV_OBRIGATORIO` (sem CRMV) e 403 `CRMV_NAO_CONFERIDO` (`reason: SEM_SELO`: o CRMV ainda não foi conferido pelo admin). Nada é gerado.
- 422 `DOCUMENTO_CAMPO_OBRIGATORIO` com `faltando` (nomes dos campos do molde, ou `vacinas` no comprovante sem dose): destaque os campos.
- 422 `DOCUMENTO_CAMPO_INVALIDO` com `campo` e `reason` (`DATA_NO_FUTURO`, `CONTRADIZ_CONSTATACOES`, `EXAME_INDISPONIVEL`, `ID_OU_NOME`).
- 422 `DOCUMENTO_TEXTO_NAO_IMPRIMIVEL` com `campo` (ex.: `conteudo.constatacoes`, `cabecalho.paciente.nome`) e `caracteres`: letras que o PDF não imprime (escrita árabe, ideograma). Peça letras latinas ou cirílicas.
- 409 `DOCUMENTO_ALTERADO`: o rascunho ou o cadastro mudou enquanto emitia; recarregue e emita de novo.
- 409 `DOCUMENTO_ATENDIMENTO_ANULADO`, `CADASTRO_MESCLADO`, `DOCUMENTO_JA_EMITIDO`, `DOCUMENTO_JA_ANULADO`; 503 `DOCUMENTO_ARQUIVO_INDISPONIVEL` (nada foi emitido; tente de novo); 429 `DOCUMENTO_TAXA_EXCEDIDA` (60 emissões por hora).
- O PDF é gerado no servidor (A4, rodapé "Documento emitido eletronicamente por ..." com o código, o resumo do conteúdo e o QR para `petjourney.health/documento/<código>`). Não imprima o HTML do molde como documento emitido: abra a URL do PDF.
- Idioma do PDF: o do atendimento, ou o `idioma` do corpo. Em árabe, os rótulos e os nomes do catálogo (vacina, exame) saem em en-GB; o texto do veterinário vai como foi escrito, se imprimível. Vacina ou exame cadastrado só em escrita árabe dá 422 `DOCUMENTO_TEXTO_NAO_IMPRIMIVEL` com `campo` `cabecalho.doMolde.vacinas.N.nome` ou `cabecalho.doMolde.exames.N.nome`: peça para cadastrar o nome em letras latinas.

### 8.4 Site: `petjourney.health/documento/<código>`

Página nova do site, no padrão da `/receita/<código>` (seção 6.8): repasse o IP de quem visita (ou chame a API do navegador), tenha o Turnstile pronto para `X-Captcha-Token` sob enxurrada de 404 e mostre só o que vem. A resposta **não diz o tipo** do documento (correção da auditoria: a declaração de óbito não pode se anunciar a quem tem o código): quem verifica tem o papel na mão. Mostre o `resumoDoConteudo` com a frase "confira com o resumo impresso no rodapé do documento". Inexistente, mal formado, rascunho, tipo não verificável ou clínica excluída: o mesmo 404 `DOCUMENTO_NAO_ENCONTRADO`. Anulado: mostre "anulado", sem motivo.

### 8.5 App

Nada muda no app na 06a: documentos no resumo, salvar nos documentos e termos são da 06b. Um efeito já vale: atendimento com **declaração de óbito ou termo de eutanásia emitido** publica o resumo **sem push** (`ATENDIMENTO_RESUMO_DISPONIVEL` e `_ATUALIZADO` aparecem só no inbox). Não há tipo de notificação novo.

### 8.6 Códigos novos (6 idiomas)

`DOCUMENTO_TIPO_INDISPONIVEL`, `DOCUMENTO_CAMPO_OBRIGATORIO`, `DOCUMENTO_CAMPO_INVALIDO`, `OBITO_NAO_REGISTRADO`, `DOCUMENTO_TEXTO_NAO_IMPRIMIVEL` (422); `DOCUMENTO_JA_EMITIDO`, `DOCUMENTO_NAO_EMITIDO`, `DOCUMENTO_JA_ANULADO`, `DOCUMENTO_ALTERADO`, `DOCUMENTO_ATENDIMENTO_ANULADO`, `DOCUMENTO_SENSIVEL_NAO_SALVAR` (409; este último só a partir da 06b); `DOCUMENTO_NAO_ENCONTRADO` (404); `DOCUMENTO_TAXA_EXCEDIDA` (429); `DOCUMENTO_ARQUIVO_INDISPONIVEL` (503).

---

## 9. Documentos clínicos, segunda fatia (E4-06b): termos, laudos e o app

**Backend:** pronto em dev em 2026-10-28 (unit, integração contra o Postgres e o bucket privado de dev, smoke por HTTP `scripts/smoke-documentos.ts`, 38/38). **Não está em produção.** Fica para depois: os moldes de prontuário, relatório e plano, orientações, orçamento e atestado de comparecimento (continuam 422 `DOCUMENTO_TIPO_INDISPONIVEL`) e a cópia do prontuário (E4-06c).

### 9.1 Termos com aceite (portal)

- Tipos novos que emitem: `TERMO_CONSENTIMENTO`, `TERMO_RECUSA`, `TERMO_EUTANASIA`. Molde `ConteudoTermoDto`: `objeto` (1000, obrigatório para emitir) e `detalhamento` (3000; em branco sai como linhas). O nome do responsável sai do cadastro da clínica.
- Emitir: `POST .../documentos/:id/emitir` ganhou `aceitePeloApp` (boolean). Só consentimento e recusa; na eutanásia, 409 `ACEITE_PRESENCIAL_OBRIGATORIO`; em outro tipo, 422 `DOCUMENTO_CAMPO_INVALIDO`. Com `aceitePeloApp`, o dono do pet (vínculo ativo) recebe o aviso `TERMO_PARA_ACEITE`.
- O PDF do termo **não tem QR** nem "confira em": termo não se verifica publicamente. O rodapé leva o código do documento.
- `DocumentoClinicoDto` ganhou `aceiteStatus` (`NAO_SE_APLICA`, `PENDENTE`, `ACEITO`, `RECUSADO`), `aceitePeloApp` e `salvoNoApp`.
- Balcão: `POST /parceiro/portal/clinica/documentos/:id/aceite-no-balcao` (`prontuario.escrever`) com `{ nome, documento, situacao: 'ACEITO' | 'RECUSADO', assinaturaPng, confirmoDivergencia? }`.
  - `assinaturaPng`: PNG em base64 (com ou sem `data:image/png;base64,`), até 300 KB e 2000 x 1000. Erro: 400 `ASSINATURA_INVALIDA` com `reason` (`NAO_E_BASE64`, `GRANDE`, `NAO_E_PNG`, `DIMENSOES`, `ILEGIVEL`).
  - Resposta `AceiteRegistradoDto`: `documentoId, situacao, canal, registradoEm, documentoConfere`.
  - **Documento diferente do CPF do cadastro** (comparado só pelos dígitos): 422 `ACEITE_DOCUMENTO_DIVERGENTE`. Mostre o aviso, peça para a equipe conferir o documento da pessoa e reenvie com `confirmoDivergencia: true`. Aí grava com `documentoConfere: false`, e o PDF do registro imprime a linha "Conferência: o documento é diferente do CPF do cadastro (diferença confirmada por quem registrou)". Cadastro sem CPF: `documentoConfere: null`, sem pedir confirmação.
  - Vale a primeira resposta (balcão ou app): o segundo leva 409 `ACEITE_JA_REGISTRADO`. Outros 409: `DOCUMENTO_NAO_E_TERMO`, `DOCUMENTO_NAO_EMITIDO`, `DOCUMENTO_JA_ANULADO`.
  - O aceite gera um **PDF de registro à parte** (texto do termo, quem, como, quando, quem da equipe registrou e a assinatura). O PDF do termo emitido não muda.
- Contador novo: `termosPendentes` (`prontuario.ler`, tom NEUTRO, rota `/clinica/documentos?aceite=PENDENTE`). Ponha a chave no catálogo de texto dos contadores do portal.

### 9.2 Laudos recebidos (portal)

| Rota | Permissão | O que faz |
|---|---|---|
| `POST /parceiro/portal/clinica/atendimentos/:id/laudos` | `prontuario.escrever` | Multipart (sem JSON): `file` repetido (1 a 4), `tipoExameId` (catálogo) **ou** `nomeDoExame`, `dataDoResultado` (AAAA-MM-DD, não no futuro). PDF, JPEG, PNG ou WebP pelos bytes (**HEIC: 400 `UPLOAD_TIPO_NAO_PERMITIDO`**, converta para JPEG antes de enviar); 20 MB cada, 40 MB por envio, 30 por atendimento. Resposta: a lista do atendimento |
| `GET .../atendimentos/:id/laudos` | `prontuario.ler` | Lista com `visivelAoResponsavel` e `removido` |
| `GET .../laudos/:lid/url` | `prontuario.ler` | URL de 15 min. Removido: 409 `LAUDO_REMOVIDO` |
| `POST .../laudos/:lid/liberar` | `resumo.liberar` | Libera ao responsável (P7). Idempotente |
| `POST .../laudos/:lid/remover` | `prontuario.escrever` | `{ motivo }` (10 a 300). Lógico: o arquivo fica |

Regra P7: o laudo anexado **antes** de liberar o resumo aparece junto com ele; o anexado **depois** só aparece com `liberar`. Com o resumo já publicado, liberar avisa o dono com `ATENDIMENTO_RESUMO_ATUALIZADO`. Erros: 400 `LAUDO_SEM_ARQUIVO`, `LAUDO_LIMITE` (`reason` `POR_ENVIO`, `POR_ARQUIVO`, `POR_ENVIO_BYTES`, `POR_ATENDIMENTO`), `LAUDO_DADOS_INVALIDOS` (`campo`, `reason`), `UPLOAD_TIPO_NAO_PERMITIDO`; 409 `DOCUMENTO_ATENDIMENTO_ANULADO`; 429 `DOCUMENTO_TAXA_EXCEDIDA` (`reason: LAUDO`, 30 envios por hora); 503 `UPLOAD_PROCESSAMENTO_OCUPADO` (reenviar só o que falhou).

### 9.3 App do responsável

- **Resumo do atendimento** (`GET /tutor/clinica/atendimentos/:id`, já existente): `documentos[]` agora vem preenchido (`id, tipo, titulo, emitidoEm, anulado, documentoDoPetId`) e há `laudos[]` novo (`id, tipoExameNome, dataDoResultado, formato: 'PDF' | 'IMAGEM'`). Entram atestados, comprovante de vacinação, pedido de exame, encaminhamento e declaração de óbito ligados ao atendimento. Termos não entram aqui (têm a lista própria) e a eutanásia nunca aparece no app. Sem URL na lista: peça a URL ao tocar.
- `GET /tutor/clinica/documentos/:id/url`: `{ id, url, expiraEm, anulado, urlDoAceite }`. Anulado: `url: null`, mostre "anulado pela clínica". `urlDoAceite` (só para o dono): o PDF do registro do aceite.
- `GET /tutor/clinica/laudos/:id/url`: URL de 15 min do laudo liberado.
- `POST /tutor/clinica/documentos/:id/salvar-nos-documentos` (200): `{ documentoDoPetId, jaExistia }`.
  - Idempotente: o segundo toque devolve o mesmo, com `jaExistia: true`.
  - Vai como tipo **"Outro"**, com o nome "<título> de <pet>" no idioma do pedido (ex.: "Comprovante de vacinação de Rex") e a data da emissão.
  - **Só o dono do pet salva.** A família (com leitura ou com edição) vê o documento, mas leva 403 ao salvar: mostre o botão "Salvar" só ao dono. **Óbito e termos: 409 `DOCUMENTO_SENSIVEL_NAO_SALVAR`** enquanto os Documentos do app forem bucket público. Nesse caso, esconda o botão "Salvar" ou mostre que o documento fica disponível pelo link.
  - Anulado depois de salvo: a cópia nos Documentos do pet **continua**. O app mostra que foi anulado pelo próprio documento clínico (`anulado: true` no resumo e na URL), não pela cópia.
- **Termos do pet** (só o dono):
  - `GET /tutor/clinica/termos?petId=` lista os itens com `podeResponderPeloApp`;
  - `POST /tutor/clinica/termos/:id/aceitar` e `POST /tutor/clinica/termos/:id/recusar` levam `{ senha }`. Erros: 401 `ASSINATURA_SENHA_INCORRETA`; 429 `ASSINATURA_SENHA_BLOQUEADA`; 403 `ASSINATURA_SENHA_NECESSARIA` (conta sem senha própria: leve a pessoa a criar a senha no perfil); 409 `TERMO_SEM_ACEITE_PELO_APP`, `ACEITE_JA_REGISTRADO`, `ACEITE_PRESENCIAL_OBRIGATORIO`, `DOCUMENTO_JA_ANULADO`.
- **Notificação nova `TERMO_PARA_ACEITE`** (categoria CLÍNICO, canal Android `cuidado`, sem e-mail). Os `dados` são `{ parceiroId, petId, petNome, documentoId }`, e a `url` vem como `/screens/notifications` até existir a tela de termos. **Acrescente o tipo em `rotas-notificacao.ts`** e abra a lista de termos do pet, senão o toque cai em Unmatched Route.

### 9.4 Códigos novos (6 idiomas)

`DOCUMENTO_NAO_E_TERMO`, `ACEITE_PRESENCIAL_OBRIGATORIO`, `ACEITE_JA_REGISTRADO`, `TERMO_SEM_ACEITE_PELO_APP`, `LAUDO_REMOVIDO` (409); `ASSINATURA_INVALIDA`, `LAUDO_SEM_ARQUIVO`, `LAUDO_LIMITE`, `LAUDO_DADOS_INVALIDOS` (400); `ACEITE_DOCUMENTO_DIVERGENTE` (422).

---

## 10. Cópia do prontuário (E4-06c)

**Backend:** pronto em dev em 2026-10-28, ainda **sem auditoria** e fora do develop. Testado com unit, integração contra o Postgres e o bucket privado de dev, e o smoke por HTTP `scripts/smoke-documentos.ts` (51/51, com o worker compilado). **Não está em produção.**

### 10.1 Quem usa

- Permissão nova **`copia.gerir`**: o DONO (que tem todas) e o GESTOR.
- A recepção, o veterinário e a enfermagem sem esse papel levam 403 do guard (`SEM_PERMISSAO`). Esconda o menu "Cópias do prontuário" de quem não tem a permissão.
- **Prorrogar e recusar** pedem, além disso, o CRMV de quem clica (o ato é do responsável técnico). Sem CRMV: 403 `CRMV_OBRIGATORIO`. CRMV ainda não conferido: 403 `CRMV_NAO_CONFERIDO`. O GESTOR sem CRMV gera e entrega, mas não prorroga nem recusa: mostre o botão com a explicação.

### 10.2 Portal (`/parceiro/portal/clinica/pedidos-de-copia`, módulo Clínica)

| Rota | O que faz |
|---|---|
| `GET /pedidos-de-copia?situacao=ABERTOS\|ENCERRADOS&cursor=&limit=` | Lista com cursor (50 no máximo) |
| `POST /pedidos-de-copia` | Pedido do balcão. Corpo: `{ pacienteId, solicitanteNome, solicitanteDocumento, de?, ate? }` (datas AAAA-MM-DD). Resposta `{ pedido, jaExistia }`: se já há pedido aberto do mesmo paciente e período, devolve o mesmo. O documento de quem pediu **nunca volta** |
| `GET /pedidos-de-copia/:id` | Detalhe |
| `POST /pedidos-de-copia/:id/prorrogar` | `{ justificativa }` (20 a 1000). Uma vez, antes de vencer; o novo prazo é **30 dias corridos do pedido** |
| `POST /pedidos-de-copia/:id/recusar` | `{ motivo }` (20 a 1000). Fim do pedido; o PDF guardado sai |
| `POST /pedidos-de-copia/:id/gerar` | **202**, status `GERANDO`. `{ de?, ate? }` opcionais trocam o período |
| `GET /pedidos-de-copia/:id/pdf` | `{ url, expiraEm, laudosForaDoPdf: [{ id, exame, dataDoResultado, url }] }`, com URLs de 15 min |
| `POST /pedidos-de-copia/:id/entregar` | `{ canal: 'MAOS' \| 'EMAIL_DO_RESPONSAVEL' }` |

**`PedidoDeCopiaDto`:**
- Identificação: `id, pacienteId, pacienteNome, origem (APP | BALCAO), solicitanteNome (só balcão)`.
- Estado: `status (ABERTO, PRORROGADO, GERANDO, PRONTO, ENTREGUE, RECUSADO, ENCERRADO_NA_EXCLUSAO)`, com `de, ate, recebidoEm, dataDoPedido`. `ENCERRADO_NA_EXCLUSAO` (parecer LGPD, G6): o responsável pediu a exclusão dos dados com o pedido aberto; é final, sai na aba "Encerrados" e não tem ação. Nesse caso o `solicitanteNome` vem "Anonimizado".
- Prazo: `venceEm, venceEmProrrogado, prazo` (o que vale agora) e `vencido`, com `justificativa` e `motivoRecusa`.
- Avisos (auditoria): `vinculoAnteriorComOutroDono` (o paciente já teve vínculo com outro dono no app; no balcão, mostre "confira quem está pedindo: a ficha tem histórico de outro dono") e `historicoDesde` (pedido do app: a cópia só traz o histórico a partir daí).
- Geração: `geracaoErro, atendimentosIncluidos, laudosEmbutidos, laudosForaDoPdf, prontoEm`.
- PDF e entrega: `guardarAte, pdfDisponivel, entregueEm, canalDeEntrega`.

**Prazo:**
- 5 dias úteis depois do dia do pedido, no fuso da clínica.
- Dia útil é de segunda a sexta, menos feriado nacional.
- **Dia fechado da clínica não prorroga.**
- Pedido numa sexta vence na sexta seguinte.
- Mostre `prazo`. Com `vencido: true`, destaque em vermelho.

**Gerar:**
1. A geração roda em segundo plano, normalmente em segundos (o pior caso medido dá 5 s).
2. Depois do 202, consulte `GET /:id` a cada 2 ou 3 s até o status sair de `GERANDO`.
3. Se der certo, vira `PRONTO` e o botão "Baixar" pede `GET /:id/pdf`.
4. Se falhar, volta a `ABERTO` ou `PRORROGADO` com `geracaoErro` (`TEMPO`, `MEMORIA`, `RENDER`, `ARMAZEM`, `GRANDE_DEMAIS`, `PDF_GRANDE`, `TENTATIVAS`). Mostre "não foi possível gerar, tente de novo".
5. Mais de 500 atendimentos no período: 422 `COPIA_GRANDE_DEMAIS` com `atendimentos` e `maximo`. Peça para escolher um período (`de` e `ate`) e registre outro pedido do balcão para o resto.

**O que a cópia traz (decisão do gerente):**
- Do atendimento anulado saem só a data, o tipo e a marca "anulado", sem o conteúdo e sem o motivo.
- O pedido do app só leva o histórico desde o vínculo do dono atual, e o PDF diz isso.
- O CRMV de quem atendeu só sai quando estava conferido no ato; sem isso, sai só o nome.

**Laudos:**
- Os laudos entram no PDF até 25 MB e 150 páginas, cada página carimbada "Anexo n, página k de m". Imagens PNG e WebP entram convertidas e reduzidas (A4 a 300 dpi), até um limite de pixels por cópia; o resto vai à parte.
- O que não couber, ou um PDF ilegível, vai em `laudosForaDoPdf`, com o link. O próprio PDF diz que essa parte é entregue à parte.
- Mostre a lista abaixo do botão do PDF.

**Guarda e entrega:**
- O PDF fica guardado **7 dias** depois de `PRONTO` ou da entrega (`guardarAte`). Depois disso, `pdfDisponivel: false` e a rota do PDF dá 409 `COPIA_PDF_EXPIRADO`.
- Um pedido ainda `PRONTO` cujo PDF já saiu pode ser gerado de novo.
- Entregar fecha o pedido. Se o pedido veio do app, a entrega se registra sozinha quando o dono baixa (`canalDeEntrega: 'APP'`).

**Contador novo `copiasDoProntuario`:**
- Permissão `copia.gerir`, rota `/clinica/copias-do-prontuario`.
- Conta os pedidos não entregues nem recusados.
- O tom muda com o prazo: `RISCO` com algum vencido, `ATENCAO` no dia ou a 2 dias úteis, `NEUTRO` no resto.

**Avisos à equipe (inbox do portal):**
- `COPIA_PEDIDA`: o dono pediu pelo app; vem com `pedidoId` e `venceEm`.
- `COPIA_PRAZO_VENCENDO`: sai 2 dias úteis antes e no dia, a partir das 9h da clínica.

### 10.3 App do dono (`/tutor/clinica`)

- `POST /tutor/clinica/clinicas/:parceiroId/copia-do-prontuario` com `{ petId }` (201): `{ copia, jaExistia }`.
  - Só o **dono** com vínculo ATIVO com aquela clínica pode pedir. A família, uma clínica sem vínculo ou um pet de outra conta levam 403.
  - São 5 pedidos por dia; acima disso, 429 `DOCUMENTO_TAXA_EXCEDIDA` (`reason: COPIA`).
  - Ponha o botão "Pedir cópia do prontuário" na tela da clínica do pet.
- `GET /tutor/clinica/copias-do-prontuario` devolve até 50 itens `{ id, petId, petNome, clinica, situacao, dataDoPedido, prazo, prorrogado, disponivel, disponivelAte }`.
  - `situacao` vale `PEDIDO`, `PRONTO`, `ENTREGUE` ou `RECUSADO`; gerando e prorrogado aparecem como `PEDIDO`.
  - Nunca vêm a justificativa, o motivo nem quem fez.
- `GET /tutor/clinica/copias-do-prontuario/:id/url` devolve `{ url, expiraEm, laudosForaDoPdf[] }`.
  - Baixar registra a entrega.
  - Depois de 7 dias: 409 `COPIA_PDF_EXPIRADO` ("peça uma nova cópia à clínica").
- **Notificações novas para `rotas-notificacao.ts`:** `COPIA_PRONTA`, `COPIA_PRORROGADA` (com `venceEm`) e `COPIA_RECUSADA`.
  - Os `dados` são `{ parceiroId, pedidoId, petId, petNome }`, e a `url` vem como `/screens/notifications` até existir a tela de cópias.
  - Abra a lista de cópias; sem a rota, o toque cai em Unmatched Route.

### 10.4 Códigos novos (6 idiomas)

| Status | Códigos |
|---|---|
| 422 | `COPIA_PRAZO_JUSTIFICATIVA`, `COPIA_MOTIVO_OBRIGATORIO`, `COPIA_GRANDE_DEMAIS` |
| 409 | `COPIA_JA_PRORROGADA`, `COPIA_PRAZO_JA_VENCEU`, `COPIA_ENCERRADA` (com `status`), `COPIA_EM_GERACAO`, `COPIA_JA_GERADA`, `COPIA_NAO_PRONTA`, `COPIA_PDF_EXPIRADO` |
| 400 | `COPIA_PERIODO_INVALIDO` (com `campo`) |

## 11. Correção do gate G3 da onda 3 (28/10)

O que muda no contrato depois da revisão cruzada da onda 3. Nenhuma rota nova e nenhum tipo de notificação novo. O `contrato/openapi.json` já está exportado.

### 11.1 Pré-consulta na anamnese (portal, E4-01 com E3-07)

- O `GET /parceiro/portal/clinica/atendimentos/:id` traz `preConsulta` preenchida quando:
  - o atendimento está em **rascunho**;
  - ele foi aberto pelo `iniciar` de um agendamento;
  - o responsável respondeu a pré-consulta;
  - quem lê tem `prontuario.ler`. A recepção recebe `null`.
- Nos outros casos, `preConsulta` vem `null`: atendimento avulso, sem resposta ou depois de finalizar.
- Forma (`PreConsultaNaAnamneseDto`):
  - `respondidaEm` e `atualizadaEm`: ISO no fuso da clínica.
  - `campos`: só os campos preenchidos, por campo da anamnese. As chaves possíveis são `queixaPrincipal`, `desdeQuando`, `evolucao`, `apetite`, `evacuacao` e `miccao`. Cada uma traz:
    - `valor`: os mesmos enums das colunas da anamnese (`ConsumoDiario`, `AspectoFezes`, `EstadoUrina`...). A tradução para o termo clínico continua no `domain/pre-consulta.ts` do portal.
    - `procedencia`: `PRE_CONSULTA` ou `DIARIO`.
    - `marca`: o valor de `CampoDaAnamnese` que o PATCH manda ao aceitar.
  - `motivo`, `sintomas`, `hidratacao` e `vitalidade`: `{ valor, procedencia }` ou `null`. Não têm campo na anamnese: são só para o veterinário ler.
  - `observacao`: o texto livre do responsável.
  - `pesoDeCasa`: `{ pesoKg, pesadoEm, procedencia }`. O `pesoDeCasa` de cima continua sendo só o número. **Nunca** preencha o peso do exame com ele.
  - `fotoIds`: até 3. A URL sai pela rota de fotos da pré-consulta.
- Nada é gravado sozinho. Para aceitar, mande o PATCH `ANAMNESE` com o valor **e** a `marca` em `camposDaPreConsulta`. O servidor reconfere: a marca só fica se o valor final for o da sugestão.

### 11.2 Mescla no meio de uma escrita (409 `CADASTRO_MESCLADO`)

- Criar receita, criar documento (com ou sem atendimento), anexar laudo e registrar ato no atendimento podem responder **409 `CADASTRO_MESCLADO`**. Isso acontece quando o gestor mesclou o paciente no mesmo instante.
- O que a tela faz: reler o atendimento (ele agora é do cadastro que ficou) e tentar de novo. Antes, essa corrida dava 500.

### 11.3 Registro fechado durante a assinatura ou a emissão

- Quando o atendimento fecha no meio da assinatura da receita ou da emissão do documento, o código agora é um só nos dois casos: **409 `ATENDIMENTO_FINALIZADO`** com `reason: CONGELADO_NO_BANCO`.
- Antes eram `RECEITA_ATENDIMENTO_FECHADO` e `DOCUMENTO_JA_EMITIDO`, e às vezes 500.
- Trate como os outros 409 de estado: releia e mostre o estado novo.
- `RECEITA_ATENDIMENTO_FECHADO` continua valendo para a checagem normal (receita só antes de finalizar).

### 11.4 Senha da assinatura

- A senha da receita, do documento e do aceite do termo pelo app é a senha da conta. O limite agora é o mesmo da troca de senha e da exclusão da conta:
  - 5 erros por pessoa em 15 minutos, somando as três telas;
  - 10 erros por rede em 15 minutos. A clínica inteira sai pelo mesmo IP, então os erros de cinco veterinários não bloqueiam o sexto.
- O código continua sendo o 429 `ASSINATURA_SENHA_BLOQUEADA`, com `tenteDeNovoEmSegundos`.

### 11.5 Cópia do prontuário

- Quando o dono pede pelo app, o servidor só devolve `jaExistia: true` se o pedido aberto for **dele, pelo app e pelo mesmo vínculo**.
- O pedido de um terceiro feito no balcão não aparece mais para o dono, e o do dono não aparece para o terceiro.
- No balcão vale a mesma regra: só reaproveita o pedido aberto do mesmo documento do solicitante.

### 11.6 Avisos ao responsável

- `RECEITA_CANCELADA`, `TERMO_PARA_ACEITE`, `COPIA_PRONTA`, `COPIA_PRORROGADA` e `COPIA_RECUSADA` deixam de ser enviados para conta em exclusão (inativa ou com o e-mail anonimizado).
- O termo continua pendente no balcão.


## 12. Anamnese por voz, primeira fatia (E4-07a): gravar e transcrever

**Backend:** pronto em dev em 2026-10-28, ainda **sem auditoria** e fora do develop (commit na pasta `wt/e4-07`). Testado com unit, integração contra o Postgres de dev (10/10) e o smoke por HTTP `scripts/smoke-anamnese-voz.ts` (46/46). **Não está em produção**: a chave `anamneseVoz.habilitada` (ConfiguracaoSistema) fica desligada lá até o bench, o LIA e o contrato com o provedor de fala. No dev a chave está ligada e o provedor é o **falso**: ele não ouve o áudio e devolve o texto da consulta de demonstração do portal (Mel e Ana), 20 s por segmento. A estruturação com a IA e a revisão item a item são a 07b.

### 12.1 Como gravar (substitui o `SpeechRecognition` fora do modo demonstração)

1. Tela de consentimento: "Quem autorizou a gravação?" (nome de quem está na sala, 2 a 120 caracteres). A hora é a do servidor: não mande.
2. `POST /parceiro/portal/clinica/atendimentos/:id/escuta` com `{ autorizadoPor }` e o header `Idempotency-Key` (UUID v4). Resposta 201: `{ sessaoId, estado, autorizadoEm, expiraEm, segmentoMaxBytes (2000000), segmentoMinMs, segmentoMaxMs (35000), sessaoMaxMs (40 min), fechaSemSegmentoEmMs (10 min), formatosAceitos }`. Não há URL de terceiro: o áudio vai para a API.
3. `MediaRecorder` com um dos `formatosAceitos` (`audio/webm`, `audio/ogg`, `audio/mp4`, `audio/wav`). Corte em segmentos de **15 a 30 s** (perto de 20 s, no silêncio; corte duro em 30 s; o último pode ser menor).
4. Cada segmento: `POST /parceiro/portal/clinica/escutas/:sessaoId/segmentos`, **multipart** com o arquivo `audio` e os campos `seq` (0, 1, 2...) e `duracaoMs` (a duração do trecho). Envie **um de cada vez, em ordem**. Resposta 200: `{ seq, repetido, duracaoMs, trechos[], proximoSeq, duracaoTranscritaMs, restanteNaSessaoMs }`.
5. **Guarde o segmento na memória até o 200.** O áudio não é guardado em lugar nenhum: se a rede cair ou vier 503, reenvie **o mesmo `seq` com o mesmo áudio**. Reenvio de um `seq` já transcrito devolve o que está gravado (`repetido: true`), sem custo.
6. `POST /parceiro/portal/clinica/escutas/:sessaoId/encerrar` fecha o microfone (idempotente). Sem segmento por 10 min, o servidor fecha sozinho (`motivoEncerramento: INATIVIDADE`).
7. `DELETE /parceiro/portal/clinica/escutas/:sessaoId` (204) descarta: a transcrição sai, o registro do consentimento fica.

`trechos[]`: `{ id ("<seq>-<indice>"), seq, indice, texto, emMs (na linha do tempo da sessão), confianca (0 a 1; abaixo de 0,7 a tela alerta), interferencia (LATIDO | FALA_SOBREPOSTA | RUIDO | null), falante ("NAO_IDENTIFICADO": sem separação de vozes na v1) }`. Trecho com `texto` vazio e `interferencia` é o latido sem fala: mostre como no protótipo. CPF, telefone, e-mail e CEP falados chegam como `[dado removido]`.

### 12.2 Outras rotas do portal

| Rota | Quem | O que faz |
|---|---|---|
| `GET /parceiro/portal/clinica/atendimentos/:id/escutas` | `prontuario.ler` | As sessões do atendimento (até 20, da mais recente): `{ itens: [{ id, estado, criadaEm, iniciadaPorMim, conteudoApagado }] }`. Use ao reabrir o atendimento para retomar a gravação em curso |
| `GET /parceiro/portal/clinica/escutas/:sessaoId?desdeSeq=` | `prontuario.ler` | Estado e trechos, 40 segmentos por página (`proximoSeq` não nulo: peça a próxima). Campos: `estado`, `autorizadoPor`, `autorizadoEm`, `expiraEm`, `encerradaEm`, `motivoEncerramento`, `profissional { id, nome }`, `iniciadaPorMim`, `segmentos`, `duracaoTranscritaMs`, `sessaoMaxMs`, `conteudoApagado`, `trechos`, `proximoSeq` |

`estado`: `ATIVA`, `ENCERRADA`, `DESCARTADA`, `EXPIRADA` nesta fatia (`ESTRUTURANDO`, `PRONTA` e `FALHOU` chegam com a 07b). A transcrição some em 24 h (`conteudoApagado: true`).

### 12.3 Quem pode

- **Iniciar, gravar, encerrar:** quem tem `prontuario.escrever` (veterinário e dono, com CRMV em dia) **e o selo** (CRMV conferido pelo admin). Sem o selo: 403 `CRMV_NAO_CONFERIDO`, a mesma tela da receita.
- **Só quem iniciou** grava segmento e encerra; outro veterinário da clínica leva 403 `ESCUTA_DE_OUTRO_PROFISSIONAL` (mostre "gravação de outro profissional"). O DONO também descarta.
- **Ler:** `prontuario.ler` (a enfermagem lê). Recepção, gestão e financeiro: 403 `SEM_PERMISSAO`.
- Com o microfone aberto o atendimento **não finaliza**: o 422 `ATENDIMENTO_INCOMPLETO` traz `ESCUTA_ATIVA` em `faltam` ("feche a gravação"). Finalizar ou anular apaga a transcrição.

### 12.4 Erros (códigos novos, 6 idiomas)

| Código | Status | A tela |
|---|---|---|
| `ESCUTA_DESLIGADA` | 404 | Esconda o botão de gravar (chave desligada) |
| `ESCUTA_INDISPONIVEL` | 503 | `reason`: `ORCAMENTO` ou `MOTOR_NAO_CONFIGURADO` (siga digitando); `OCUPADO` com `tenteDeNovoEmSegundos` (reenvie o mesmo `seq`) |
| `ESCUTA_JA_ATIVA` | 409 | Já há gravação aberta; vem `sessaoId` para retomar |
| `ESCUTA_ATENDIMENTO_FECHADO` | 409 | Atendimento finalizado ou anulado |
| `ESCUTA_SESSAO_ENCERRADA` | 409 | Com `estado`; pare de enviar |
| `ESCUTA_DE_OUTRO_PROFISSIONAL` | 403 | Só quem iniciou grava e encerra |
| `ESCUTA_AUDIO_INVALIDO` | 400 | `reason`: `FORMATO` (não é áudio pelos bytes), `TAMANHO`, `VAZIO`, `DURACAO` (fora de 1 a 35 s, ou bytes incompatíveis com a duração), `CAMPOS`, `SEQ` |
| `ESCUTA_SEQ_FORA_DE_ORDEM` | 409 | Com `esperado`: reenvie a partir dele |
| `ESCUTA_SEGMENTO_EM_CURSO` | 409 | O mesmo `seq` está sendo transcrito noutra requisição: espere `tenteDeNovoEmSegundos` e reenvie |
| `TETO_DE_ESCUTA` | 429 | `reason`: `PROFISSIONAL` (60 min em 24 h), `SESSAO` (40 min: encerre), `FALHAS`; com `limiteMinutos`. Siga digitando |
| `TETO_DE_ESCUTA_MENSAL` | 429 | A clínica chegou a 1.200 min no mês |
| `ESCUTA_TRANSCRICAO_FALHOU` | 503 | `tenteDeNovo: true`: reenvie o mesmo `seq`; `false`: o provedor recusou (siga digitando) |
| `ESCUTA_TAXA_EXCEDIDA` | 429 | Com `tenteDeNovoEmSegundos` |

Arquivo acima de 2 MB ou mais de um arquivo no multipart: **413** do parser, antes de qualquer leitura.

### 12.5 App do responsável: "sua consulta está sendo gravada"

- `GET /tutor/clinica/escutas-ativas?petId=` → `{ ativa, clinicaNome, desde }`. Só isso: nunca sessão, profissional nem o que foi dito.
- Chame ao abrir a tela do pet ou da clínica e a cada **~20 s** com a tela aberta (sem push). Com `ativa: true`, mostre a faixa "Sua consulta na {clinicaNome} está sendo gravada".
- Pet de outra pessoa ou inexistente: 403 `OWNERSHIP_FORBIDDEN`. Chave desligada: `ativa: false`.
- Nenhum tipo de notificação novo.

## 13. Anamnese por voz, segunda fatia (E4-07b): a revisão item a item

**Backend:** pronto em dev em 2026-10-28 (commit separado na pasta `wt/e4-07`), **sem auditoria**, fora do develop e **fora de produção** (a mesma chave da seção 12). Unit, integração contra o dev (13/13) e o smoke por HTTP (55/55). Em dev o estruturador é o **falso** (regras sobre o roteiro de demonstração, sem custo); o de produção é a Anthropic (`claude-opus-5-5`, effort low), validado com uma chamada real em dev (schema aceito, US$ 0,06 por consulta de demonstração).

### 13.1 O ciclo

1. `encerrar` dispara a estruturação sozinha: `estado` vai a `ESTRUTURANDO` e, em segundos, a `PRONTA` (ou `FALHOU`). Consulte o `GET /escutas/:sessaoId` a cada ~2 s até sair de `ESTRUTURANDO`. O microfone fechado por inatividade também estrutura.
2. Em `PRONTA`, o GET traz `propostas[]` e `notas[]` (abaixo). Mostre cada proposta com o valor atual do campo ao lado; **nada nasce marcado**.
3. `POST /parceiro/portal/clinica/escutas/:sessaoId/aplicar` com `{ versao, dispositivoId, escolhas: [{ propostaId, valor? }] }` (a `versao` e o `dispositivoId` do autosave do atendimento). Sem `valor`, aplica o proposto; com `valor`, aplica o editado (mesma forma do `valor` da proposta).
4. Resposta 200: `{ id (o atendimento), versao, semMudanca, lock, aplicadas: [propostaId] }`: o mesmo tratamento do autosave (atualize a `versao`). Os 409 do PATCH valem aqui: `ATENDIMENTO_ALTERADO`, `EDICAO_EM_OUTRO_DISPOSITIVO`, `EDICAO_ASSUMIDA`, `ATENDIMENTO_FINALIZADO`, `ATENDIMENTO_ANULADO`.
5. `FALHOU` (`motivoFalha`, por exemplo `RECUSA_DO_MODELO`, `MOTOR_INDISPONIVEL`, `ORCAMENTO`): com `podeReestruturar: true`, ofereça "tentar de novo": `POST /escutas/:sessaoId/reestruturar` (só quem iniciou; refaz só a IA, sem regravar). Senão, siga digitando.

### 13.2 `propostas[]` e `notas[]`

- Proposta: `{ id ("p1"...), campo, valor, modo ("DITO" | "DEDUZIDO"), citacoes: [{ trechoId, trecho, ancorada, inicio, fim }], divergencias: [{ valor, trechoId, trecho, ancorada }], alertas[], aplicada }`.
- `campo`: `queixaPrincipal`, `historia` (texto), `desdeQuando`, `evolucao`, `apetite`, `evacuacao`, `miccao`, `ambiente` (opção do enum do campo, os mesmos do PATCH), `vacinacaoEmDia`, `vermifugacaoEmDia` (boolean) e `antecedente` (`{ kind, descricao, quando }`). **Não existe diagnóstico.**
- `citacoes`: grife `inicio`..`fim` no texto do trecho `trechoId` (o servidor achou o trecho; `ancorada: false` é citação que não existe na transcrição).
- `alertas`, na ordem: `sem-origem` (sempre primeiro: **só aplica com o valor editado**, senão 409 `ESCUTA_PROPOSTA_SEM_ORIGEM`), `fala-sobreposta`, `latido`, `ruido`, `baixa-confianca` (trecho abaixo de 0,7), `divergencia` (mostre as outras versões), `deduzido` ("ninguém disse com essas palavras"), `falante-incerto`.
- Notas, a seção "ouvido e não preenchido": `{ id, tipo ("HIPOTESE" | "PESO_INFORMADO" | "MEDIDA"), valor, citacao }`. Hipótese aponta para a etapa de diagnóstico; peso de casa nunca vira peso aferido.

### 13.3 O que acontece ao aplicar

- Campo simples **substitui**; `historia` **soma** (quebra de linha, sem repetir); `antecedente` soma na seção Diagnóstico **sem repetir** (tipo e descrição). Tudo numa transação, a `versao` sobe uma vez.
- O campo aplicado com o valor proposto ganha a marca `camposDaEscuta` (e perde a da pré-consulta); editado, não ganha marca.
- De onde veio cada item fica gravado (permanente, junto do prontuário), mesmo depois de a transcrição sumir em 24 h.
- Reenviar o mesmo aplicar (rede ruim): `semMudanca: true`, nada se repete. As propostas já aplicadas voltam no GET com `aplicada: true`.
- Quem aplica: `prontuario.escrever` (não precisa ser quem gravou).

### 13.4 Códigos novos (6 idiomas)

| Código | Status | A tela |
|---|---|---|
| `ESCUTA_NAO_PRONTA` | 409 | Com `estado`: ainda estruturando, ou falhou |
| `ESCUTA_PROPOSTA_SEM_ORIGEM` | 409 | Com `propostaId`: peça a edição do valor |
| `ESCUTA_ESCOLHA_INVALIDA` | 400 | `reason`: `VALOR` (com `campo`), `REPETIDA`, `HISTORIA_LONGA` (4.000), `ANTECEDENTES_DEMAIS` (30) |
| `ESCUTA_REESTRUTURAR_INDISPONIVEL` | 409 | `reason`: `NAO_FALHOU`, `CHAMADAS_ESGOTADAS` |

`propostaId` que não é desta sessão: 403 `OWNERSHIP_FORBIDDEN` (nada é gravado).

### 13.5 Correção da auditoria da E4-07 (28/10)

- **Grave a 24 a 32 kbps** (`new MediaRecorder(stream, { audioBitsPerSecond: 32000 })`). O servidor lê a duração do contêiner (WAV, Ogg, WebM do MediaRecorder, MP4). Quando ela não vem, aceita até 16 KB/s da `duracaoMs` declarada (128 kbps). Mais que isso volta 400 `ESCUTA_AUDIO_INVALIDO` com `reason: DURACAO`. Segmento com mais de 35 s pelo contêiner também volta 400.
- `TETO_DE_ESCUTA` ganhou o `reason: CUSTO_PARCEIRO` (a clínica gastou US$ 3 em 24 h). Mostre "siga digitando", como nos outros.
- Estruturação recusada pelo teto fica `FALHOU` com `motivoFalha` `TETO_DE_ESTRUTURACOES` (40 por profissional em 24 h) ou `TETO_CUSTO_PARCEIRO`. Menos de 20 s de fala fica `PRONTA` sem propostas.
- Citação com menos de 3 palavras, ou que não contém as palavras do valor, vem com `sem-origem`. Para aplicar, o `valor` tem de ser **diferente** do proposto: mandar o mesmo valor volta 409 `ESCUTA_PROPOSTA_SEM_ORIGEM`.
- Hipótese (`pode ser`, `parece`, `deve ser`, `provável`, `compatível com`, `quadro de`, `sugere`, `suspeita de`, e os equivalentes em en, es, sr e ar) nunca vira campo, antecedente nem divergência: vai para `notas` (HIPOTESE).
- `falante-incerto` vem em toda proposta na v1 (sem separação de vozes). Mostre-o discreto, não como erro.

---

## 14. Correção do G4 (29/10): a cópia com as internações e o documento da internação

Spec: E4-06 (Change Log de 29/10). Backend no develop depois do push desta rodada. **Não está em produção.**

### 14.1 A cópia do prontuário traz as internações

Nada muda nas rotas da cópia. O PDF ganhou a seção **Internações** (antes dizia "O registro de internações ainda não está disponível nesta clínica"): entrada, desfecho e data, orientação de saída, as prescrições (dose em texto, via, frequência, início e suspensão), as doses registradas (dada, não dada ou recusada, por quem e quando) e os boletins enviados ao responsável. Texto interno da equipe (motivo, diagnóstico de trabalho, observação, evoluções) não entra. Se a cópia passar dos tetos (50 internações, 3000 doses, 300 boletins), o PDF diz quantos ficaram de fora e pede uma cópia de período menor: mostre o mesmo conselho na tela de gerar, se o PDF demorar.

### 14.2 Documento ligado à internação

- `POST /parceiro/portal/clinica/documentos` aceita **`internacaoId?`** (por exemplo, a declaração de óbito do animal que morreu internado). Tem de ser uma internação desta clínica e **do mesmo paciente**; de outro paciente, de outra clínica ou inexistente: 403 `OWNERSHIP_FORBIDDEN` (o mesmo corpo).
- Não muda depois de criado (não vai no `PATCH`).
- `DocumentoClinicoDto` ganha `internacaoId` (ou `null`).
- Na tela da internação (detalhe ou encerramento), o botão "Emitir declaração de óbito" pode já mandar o `internacaoId`. O documento aparece na cópia, na seção da internação.

---

## 15. Correção do G5 (29/10): anamnese por voz

Spec: E4-07 (Change Log de 29/10, "Correção do G5"). Backend na pasta `wt/g5-voz`, **sem push** até a re-auditoria. **Não está em produção** (a chave da voz segue desligada lá). Rotas novas: nenhuma. Tipos de notificação novos: nenhum.

### 15.1 Descartar o rascunho que teve gravação

- O atendimento com **qualquer** gravação da escuta (ativa, encerrada, descartada ou expirada) não se descarta mais: `POST /atendimentos/:id/descartar` volta **409 `ATENDIMENTO_COM_CONTEUDO`** com `bloqueios: ['ESCUTA_GRAVADA']`. A gravação guarda o registro de quem autorizou e quando.
- O caminho é **anular com motivo** (`POST /atendimentos/:id/anular`): ele passa a aceitar o rascunho na versão 1 que teve gravação (antes dava `ATENDIMENTO_SEM_CONTEUDO`). A mensagem do 409 já diz "anule com um motivo": abra o diálogo de anular.
- O "desfazer" do iniciar na agenda, com a gravação já começada, volta `DESFAZER_EXPIRADO` (o mesmo de quando alguém já escreveu no rascunho).

### 15.2 Como gravar (substitui o primeiro item da 13.5)

- Grave a **no máximo 32 kbps** (`new MediaRecorder(stream, { audioBitsPerSecond: 32000 })`) e corte o segmento em **30 s ou 120 KB, o que vier primeiro** (perto de 20 s no silêncio, como antes).
- O servidor mede a duração pelos bytes (no mínimo `bytes / 4.000` por segundo) e pelo contêiner, e reserva o teto pela maior entre essa medida e a `duracaoMs` declarada. Acima de 35 s: 400 `ESCUTA_AUDIO_INVALIDO` com `reason: DURACAO`. O limite de 16 KB/s da `duracaoMs` declarada agora vale também quando o contêiner traz a duração.
- WAV: só PCM. WAV comprimido (ADPCM e afins) volta 400 `DURACAO`.
- Depois da transcrição, conta a duração que o provedor devolveu (`duracaoMs` da resposta).

### 15.3 Encerrar com o último segmento ainda subindo

- `POST /escutas/:sessaoId/encerrar` com um segmento sendo transcrito volta **409 `ESCUTA_SEGMENTO_EM_CURSO`** com `tenteDeNovoEmSegundos: 5`. Espere o 200 do último segmento e encerre de novo (ou repita o encerrar depois dos 5 s).
- Sem segmento por 10 min, o servidor só fecha o microfone se nenhum segmento estiver sendo transcrito.
- O segmento que terminar de transcrever depois que a sessão fechou volta 409 `ESCUTA_SESSAO_ENCERRADA` e o texto dele **não entra** na transcrição. Pare de enviar.

### 15.4 Estruturação que não roda

`motivoFalha` ganhou três valores (sessão `FALHOU`, `podeReestruturar: true` enquanto couber chamada): `ESCUTA_DESLIGADA` (a chave foi desligada no meio), `PARCEIRO_INATIVO` e `MODULO_SEM_ESCRITA` (o módulo CLÍNICA suspenso, desligado ou vencido). Mostre "A organização automática não rodou. Tente de novo mais tarde" com o botão de reestruturar.

### 15.5 Exclusão a pedido do titular

A sessão de escuta dos atendimentos do titular vai a `DESCARTADA` (`motivoEncerramento: ANONIMIZACAO`), sem transcrição nem propostas, e `autorizadoPor` passa a ser `"Anonimizado"`. A gravação que estivesse aberta para de aceitar segmento (409 `ESCUTA_SESSAO_ENCERRADA`).

### 15.6 App

Nada muda.
