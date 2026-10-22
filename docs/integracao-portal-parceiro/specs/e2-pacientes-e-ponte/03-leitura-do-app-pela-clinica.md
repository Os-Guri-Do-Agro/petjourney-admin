# Spec: A clínica lê o app com consentimento (diário, peso de casa, carteirinha) e o "Este pet em 30 segundos"

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E2 pacientes e ponte](../../../../../epicos/portal-parceiro-e2-pacientes-e-ponte.md)
**Depende de:** [E2-02 vínculo e consentimento](02-vinculo-e-consentimento.md), [E1-05 trilha](../e1-fundacao/05-trilha-de-auditoria-clinica.md)

---

## Visão Geral

Rotas do portal que leem, de um paciente com vínculo ativo, o que o responsável liberou no app, e o resumo que o veterinário lê antes de entrar na sala:
- o **diário** com enum cru, desde a última consulta;
- o **peso de casa**;
- a **carteirinha**: vacinas, alergias, diagnósticos e tratamentos contínuos;
- o **"Este pet em 30 segundos"**, montado no servidor.

Toda leitura confere o consentimento na hora e grava `LER_DADO_DO_APP` na trilha (E1-05), que o responsável vê.

## Motivação

- É o dado que só este produto tem: o que aconteceu em casa entre uma consulta e outra (doc 09 do portal, seção 7).
- O acesso temporário não alimenta essa tela: manda só 15 registros dos últimos 30 dias, só os com sintoma, já rotulados (D11.4). "Um desmaio no meio de noventa registros normais nem chegaria à clínica" (doc 09).
- O portal já monta o resumo no cliente (`petjourney-admin/src/features/clinico/domain/resumo-do-paciente.ts`, 742 linhas, com testes). Na API, a regra vai para o servidor (P2 do épico pai).

---

## Research Findings

- **Contrato do portal (lido):**
  - `EntradaDoDiarioParaClinica` (enum cru: vitalidade, alimentação, hidratação, fezes, urina, sintomas, doenças, observações, remédios, `nota` só com consentimento de notas, fotos).
  - `PesoParaClinica`.
  - `DiarioParaClinica` com `desde` (`contrato/responsavel.ts:729-760`).
  - A rota proposta era `GET /parceiro/portal/pacientes/:petId/diario?desde=`.
- **Regras do resumo a portar (`domain/resumo-do-paciente.ts`):**
  - janela de peso de 180 dias (`:43`);
  - perda de atenção em -5% e de risco em -10% (`:46-47`), "contínua" quando a série não sobe de verdade;
  - sintoma recorrente com 3 vezes (`:61`);
  - sintomas de alarme `CONVULSAO`, `FALTA_DE_AR`, `SANGRAMENTO` e sangue nas fezes (`:67-69`);
  - polifarmácia com 5 remédios ou mais (`:195`);
  - no máximo 3 falas do responsável no resumo.
- **API:**
  - `DiarioPet` e `PesoRegistro` (`prisma/schema.prisma:1015-1049`, `:750-763`).
  - `PesoRegistro` não tem origem: o peso que a importação da anotação grava leva o nome da clínica em `observacoes` (D4 da anotação). O doc 09 do portal (seção 20, item 5) pede que o peso aferido publicado seja reconhecível, para não voltar como peso de casa.
  - Escrita do diário exige plano nível 3+ (inventário 1.4): sem diário, a leitura volta vazia, com motivo.

**Breaking changes:** nenhuma. `PesoRegistro.origem` é coluna nova com default `CASA`.

## Decisões

- **D1 A clínica endereça pelo paciente dela.** Rotas sob `/parceiro/portal/pacientes/:pacienteId/app/*`; o servidor resolve o vínculo ativo e o `petId`. O `petId` do app não é devolvido à clínica.
- **D2 Janela padrão desde a última consulta finalizada** daquele paciente na clínica (E4-01), com teto de 90 dias e `?desde=` opcional dentro do teto. Sem consulta finalizada: 30 dias.
- **D3 Peso de casa é só `origem=CASA`.** Pesos publicados por clínica (`origem=PARCEIRO`) e importados de anotação (`origem=ANOTACAO`) não voltam como peso de casa.
- **D4 Carteirinha não depende do consentimento do diário.** Vacinas, alergias, diagnósticos e tratamentos contínuos são o mínimo para atender com segurança, e o vínculo aceito já cobre (D-E2.2). Diário, peso de casa e notas seguem as chaves.
- **D5 Resumo calculado no servidor**, com as constantes do portal num `resumo-do-paciente.config.ts`. Os testes do portal viram golden tests.
- **D6 Fotos do diário pelo cofre.** Fotos citadas saem como URL assinada de 15 min, copiadas para o bucket privado do parceiro sob demanda (padrão D11.2), nunca a URL pública do `bucketFotos`.

## Rotas (`@ExigeModulo(CLINICA)`, `@ExigePermissao('prontuario.ler')`)

| Método e rota | Consentimento | Resposta |
|---|---|---|
| `GET /parceiro/portal/pacientes/:pacienteId/app/diario?desde=` | `diarioCompleto` (e `notas` para o campo `nota`) | `{ desde, entradas: EntradaDoDiarioParaClinica[] }`; sem diário no plano: `{ entradas: [], motivo: 'SEM_DIARIO' }` |
| `GET /parceiro/portal/pacientes/:pacienteId/app/pesos?desde=` | `peso` | `PesoParaClinica[]` só `CASA` |
| `GET /parceiro/portal/pacientes/:pacienteId/app/carteirinha` | vínculo ativo | vacinas (com lote quando vier de clínica), alergias ativas, diagnósticos ativos, tratamentos contínuos ativos |
| `GET /parceiro/portal/pacientes/:pacienteId/app/fotos/:fotoId/url` | `diarioCompleto` | URL assinada 15 min |
| `GET /parceiro/portal/pacientes/:pacienteId/resumo` | o que estiver liberado | `ResumoDoPaciente`: sinais (perda de peso, alarme, recorrente, adesão da E4-05, polifarmácia), contagem por campo, últimos valores, falas, medicação em uso, última consulta na clínica, e `naoLiberado: ['diario', 'peso']` quando faltar consentimento |

Sem vínculo ativo: 403 `PET_SEM_ACESSO`. Consentimento desligado: 403 `SEM_CONSENTIMENTO` com o nome da chave.

## Acceptance Criteria

- [ ] **Given** vínculo ativo com `diarioCompleto=true` e `notas=false` **When** lê o diário **Then** as entradas vêm com `nota: null` e o resto cru (enum, não rótulo).
- [ ] **Given** `diarioCompleto=false` **Then** 403 `SEM_CONSENTIMENTO` e nenhuma linha de trilha de leitura.
- [ ] **Given** um peso publicado pela própria clínica **Then** ele não aparece em `/app/pesos`.
- [ ] **Given** uma perda de 12% contínua em 180 dias **Then** o resumo traz o sinal `perda-de-peso` com tom de risco; com uma subida real no meio **Then** não é "contínua" (casos do `resumo-do-paciente.spec.ts` do portal).
- [ ] **Given** um único registro com `CONVULSAO` **Then** sinal `alarme` com a data.
- [ ] Toda leitura bem-sucedida gera um evento `LER_DADO_DO_APP` com `petId` e tipo, que o responsável vê em `/tutor/clinica/clinicas/:id/acessos`.
- [ ] Depois de encerrar o vínculo, qualquer rota daqui dá 403 na hora.
- [ ] p95 do resumo abaixo de 400 ms com 90 dias de diário (medido com seed).

## Estratégia de Testes

- Unit: regras do resumo (golden tests copiados do portal), filtro de origem do peso, janela padrão, recorte de notas.
- Integration: consentimento desligado entre duas leituras.
- Cenários: outro parceiro, vínculo encerrado, consentimento desligado.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | `PesoRegistro.origem OrigemPeso @default(CASA)` + `parceiroId?`; backfill: peso com `observacoes` igual ao nome de clínica de anotação importada vira `ANOTACAO` (script com trava de prod) |
| `src/vinculo-clinico/leitura/` (controller, service, `regras/resumo-do-paciente.ts`, config) | Criar |
| `src/compartilhamento-prestador/anotacao-importacao.service.ts` | Modificar: grava `origem=ANOTACAO` no peso |
| `src/peso-registro/*` | Modificar: `origem=CASA` no POST do app |

## Tasks

- [ ] **T1** Migration de origem do peso + backfill
- [ ] **T2** Rotas de diário, pesos, carteirinha, fotos com consentimento e trilha *(T1, E2-02, E1-05)*
- [ ] **T3** Porte das regras do resumo + golden tests *(T2)*
- [ ] **T4** Rota do resumo *(T3)*
- [ ] **T5** Cenários + handoff ("Este pet em 30 segundos" lendo a API)

## Rollout / Rollback

Aditivo. O backfill do peso é idempotente; rollback do código não precisa desfazer a coluna.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Clínica lendo o diário depois da revogação | Consentimento conferido em cada leitura, sem cache; cenário dedicado |
| Médio | Backfill de `PesoRegistro.origem` marcar peso de casa como da clínica | Backfill só pelo vínculo exato com anotação importada (consulta e data), idempotente, com relatório antes de gravar em prod |

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
