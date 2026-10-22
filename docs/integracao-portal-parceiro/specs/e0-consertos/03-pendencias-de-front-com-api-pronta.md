# Spec de integração: o que o portal ainda não consome e a API já entrega

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E0 consertos](../../../../../epicos/portal-parceiro-e0-consertos.md)
**Superfície:** `petjourney-admin` (portal). Nenhuma mudança de API nesta parte.

---

## Visão Geral

A lista do que o portal precisa fazer com rotas e campos que **já existem em produção**, conferida em 2026-10-20 contra `origin/main` (`cd813e7`) e `origin/redesign/portal` (`290f279`) do portal e o `master` da API. Serve de base para o handoff do frontender. Nenhum item aqui pede código novo no backend; onde a API ainda tem uma decisão aberta, ela está marcada.

## Itens

| # | O que falta no portal | O que a API já entrega | Evidência no portal | Decisão pendente |
|---|---|---|---|---|
| 1 | **Indicados do parceiro com status** | `GET /parceiro/portal/indicados` (`src/parceiro-portal/parceiro-portal.controller.ts:88`), spec `2026/q4/q4-1/indicados-parceiro-status-e-cms.md` | nenhuma chamada a `indicados` em `src/service/` | **Q2 da spec dos indicados** (aviso ao responsável no cadastro) antes de mostrar a lista. A rota já devolve status e plano ao lado do nome completo |
| 2 | **Categoria `VETERINARIO` (autônomo) no cadastro** | `CategoriaParceiro.VETERINARIO` (`prisma/schema.prisma:350-363`), aceita no `POST /parceiro/portal/cadastro` | `src/service/parceiro/types.ts:15-21` não tem `VETERINARIO`; `PortalParceiroCadastroForm.vue:54-60` não oferece | nenhuma (o site já oferece) |
| 3 | **Escolha granular do acesso temporário** | `diarioSelecao` e contadores de itens omitidos no snapshot (spec `2026/q4/q4-1/acesso-temporario-selecao-granular.md`) | nenhuma ocorrência de `diarioSelecao` ou "omitid" no portal | nenhuma |
| 4 | **Espécie OUTRO** | `Especie.OUTRO` + `OtherInfo.tipoEspecie` (spec `2026/q4/q4-1/especie-outro-cadastro-pet.md`), flag ligada em prod | nenhuma ocorrência de `tipoEspecie` no portal; os filtros de espécie em `pages/(accounts)/parceiro/acessos/index.vue` não mostram o nome digitado | nenhuma |
| 5 | **Perfil "veterinário" fora da UI** | `GET /auth/perfis` devolve `veterinario` como legado; a regra do produto é nunca usá-lo (memória `feedback-veterinario-nao-e-perfil`) | `pages/(shared)/auth/login.vue:164` roteia por `getVeterinarioId()`; `PartnerPageFrame.vue:97` e `composables/useAppNavigation.ts:10` usam `hasVeterinarioProfile()` | nenhuma. Depois do E1-02 (módulos), o menu clínico depende do módulo ligado no servidor, não do perfil |
| 6 | **Equipe pela lista** | rotas da [E0-01](01-equipe-completa.md) | `PortalEquipeSection.vue:140-160` pede ID do usuário; `convite.vue` pede ID do parceiro | depende da E0-01 |
| 7 | **Capacidade de saque da API** | campo da [E0-02](02-capacidade-de-saque-pronta.md) | `service/parceiro/regras-de-saque.ts`; `HomeEspacoPortal.vue:113` na redesign | depende da E0-02 |
| 8 | **Textos fixos em português fora do i18n** | não se aplica | `pages/(accounts)/parceiro/equipe.vue:34` ("Gerencie quem pode operar a parceria..."), `title="Equipe"`, `PortalEquipeSection.vue:96-164` | nenhuma: o portal tem 6 locales |

## Acceptance Criteria (do lado do portal, para o handoff)

- [ ] Cada item acima tem tela ou campo funcionando contra a API de dev, conferido pelo frontender.
- [ ] Nenhuma tela do portal lê `veterinarioId` nem `perfis.veterinario`.
- [ ] `npm run check:i18n` do portal passa sem texto fixo em português nas telas de equipe.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Médio | Mostrar indicados com nome e plano antes de decidir a Q2 da spec de indicados | O item 1 fica bloqueado até a decisão; o handoff diz isso no topo |

## Rollout / Rollback

Sem código de API. O rollout é do front, item a item, depois de conferido contra a API de dev.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
