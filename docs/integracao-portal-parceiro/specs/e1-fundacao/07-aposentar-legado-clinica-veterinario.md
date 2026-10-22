# Spec: Aposentar o legado `Veterinario`, `Clinica` e `ClinicasPacientes`

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E1 fundação](../../../../../epicos/portal-parceiro-e1-fundacao.md)
**Depende de:** [E1-03 profissionais](03-profissionais-e-papeis.md) (para onde o CRMV migra) e [E2-02 vínculo](../e2-pacientes-e-ponte/02-vinculo-e-consentimento.md) (o substituto do `ClinicasPacientes`)
**Onda:** 6 (última)

---

## Visão Geral

Tirar do schema e do código o modelo antigo de veterinário e clínica, em fases que não quebram app publicado: parar de gravar, migrar o que tem valor, parar de ler, medir zero uso e só então apagar.

## Motivação

Com o `Profissional` (E1-03) e o `VinculoPacientePet` (E2-02), o legado vira duas fontes da verdade para a mesma coisa. Ele ainda é gravável pela API (inventário, achado 2) e o portal ainda decide rota pelo `veterinarioId` do login (E0-03, item 5), contra a regra "veterinário não é perfil" (memória `feedback-veterinario-nao-e-perfil`).

---

## Research Findings: quem toca o legado hoje

| Peça | Onde | O que faz |
|---|---|---|
| `Veterinario` (1-1 com `Usuario`) | `prisma/schema.prisma:140-151` | `crmv @unique`, especialidade, bio |
| Escrita | `POST /usuario` com bloco `veterinario` (`src/usuario/usuario.service.ts:149`) e `PATCH /usuario` | cria e altera |
| Leitura | JWT `veterinarioId` (`src/auth/strategies/jwt.strategy.ts:17-49`); `GET /auth/perfis` devolve `veterinario`; cadastro do parceiro copia o CRMV (`src/parceiro-portal/parceiro-portal.service.ts:460-468`); `getPlanoForVeterinario` (`src/subscription/subscription.service.ts:236`) e `GET /subscription/veterinario/:id` | |
| `Clinica`, `ClinicaRole`, `ClinicaPermission`, `ClinicasEquipe`, `ClinicasPacientes` | `schema.prisma:153-202`, `:938-948` | ninguém cria; a inativação apaga linhas (`src/inactivation/inactivation.service.ts:522,559`) |
| `Endereco.clinicaId` | `schema.prisma:520-541` | FK para o legado |
| `TipoEntidade` `VETERINARIO`, `CLINICA`; `TipoPlano.CLINICA` | `schema.prisma:1380-1384`, `:1471-1474` | sem assinatura real |
| `AppRole.VETERINARIO` | `src/auth/roles.enum.ts` | não usado por controller |
| Diretório `GET /clinica*` e `GET /veterinario*` | `src/clinica/clinica.controller.ts`, `src/veterinario/veterinario.controller.ts` | já servido sobre `Parceiro` (não é legado de dado, só de nome); duas telas órfãs do app chamam |
| Fronts | app `add-profile.tsx?target=veterinario` (`PATCH /usuario` com `veterinario.crmv`); CMS filtra `perfil=VETERINARIO`; portal `getVeterinarioId()` em `login.vue:164` | |

## Fases

| Fase | O que faz | Reversível | Critério para seguir |
|---|---|---|---|
| F1 Parar de gravar | `POST`/`PATCH /usuario` ignoram o bloco `veterinario` (sem erro, com log `[Legado] VETERINARIO_IGNORADO usuarioId=...`); o cadastro do parceiro deixa de copiar CRMV do legado | sim | 30 dias sem o log, ou só de builds antigas conhecidas |
| F2 Migrar | Script com trava de prod (`scripts/lib/trava-prod.ts`): para cada `Veterinario` com usuário membro DONO de um `Parceiro` de categoria veterinária, cria `Profissional` com o CRMV (sem conferido); relatório dos que não têm parceiro | sim (o script só cria) | relatório revisado pelo Nicolas |
| F3 Parar de ler | JWT deixa `veterinarioId` sempre `null` por uma release e depois some; `perfis.veterinario` sempre `null`; `getPlanoForVeterinario` e a rota admin removidos; diretório renomeado para `GET /prestadores` com os aliases antigos respondendo por 90 dias | sim | handoff aplicado no portal (E0-03), CMS e app |
| F4 Apagar | Migration destrutiva removendo os 6 models, os valores de enum e `Endereco.clinicaId`, depois de backup CSV num bucket privado com retenção de 1 ano | **não** | zero leitura e escrita por 30 dias no log; aprovação explícita do Nicolas |

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | F4 apagar dado que alguém ainda usa | F4 só depois de 30 dias de zero uso medido; backup CSV; aprovação explícita; `prisma migrate diff` revisado |
| Médio | App antigo quebrar ao receber `veterinarioId: null` | F3 mantém o campo com `null` por uma release antes de remover (o app usa optional chaining nesse ponto, conferir no handoff) |
| Médio | Expurgo LGPD quebrar por FK | A F4 retira as linhas de `inactivation.service.ts:522,559` na mesma migration |

## Acceptance Criteria

- [ ] F1: `PATCH /usuario` com `veterinario.crmv` responde 200, não cria nem altera `Veterinario`, e loga o evento sem PII.
- [ ] F2: o script é idempotente (rodar duas vezes não duplica `Profissional`) e recusa o banco de produção sem `--prod` e `CONFIRMO_PRODUCAO`.
- [ ] F3: nenhum handler lê `Veterinario`, `Clinica*` ou `ClinicasPacientes` (grep no CI, regra nova no `lint:catraca` ou teste de arquitetura).
- [ ] F4: migration roda do zero no CI (Postgres 16) e o schema bate; o expurgo de conta continua verde.

## Estratégia de Testes

- Unit das fases F1 e F3; script F2 com banco de teste (integration); teste de arquitetura de F3; CI de migration para F4.

## Tasks

- [ ] **T1** F1 (código + log)
- [ ] **T2** F2 (script + relatório) *(E1-03)*
- [ ] **T3** F3 (leituras, aliases, handoff) *(E0-03 aplicado nos fronts)*
- [ ] **T4** F4 (backup + migration destrutiva) *(30 dias de zero uso + aprovação)*

## Rollback

F1 a F3: reverter o commit. F4: restaurar do backup CSV com script inverso preparado antes de aplicar (gate da F4).

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
