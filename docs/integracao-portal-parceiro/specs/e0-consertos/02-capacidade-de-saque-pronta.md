# Spec: Capacidade de saque calculada pela API

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.2
**Handoff:** [front-portal-parceiro-e0.md](../../../../../../implementacao-por-superficie/front-portal-parceiro-e0.md), seção 3
**Épico:** [E0 consertos](../../../../../epicos/portal-parceiro-e0-consertos.md)
**Depende de:** nada
**Tamanho:** pequena (cabe num dia)

---

## Visão Geral

`GET /parceiro/portal/carteira` passa a devolver a situação de saque já decidida (`capacidadeDeSaque`) e o mínimo vigente, para o portal e o app pararem de repetir a regra.

## Motivação

O portal reimplementa a regra em `petjourney-admin/src/service/parceiro/regras-de-saque.ts` (mínimo de R$ 50 fixo, `MIN_SAQUE_CENTAVOS = 5000`, e a ordem bloqueado, sem saldo, tudo retido, só dono, sem PIX, abaixo do mínimo). A API tem o mesmo número em `src/comissao/comissao.config.ts:25` (`SAQUE_MINIMO_CENTAVOS`). A `redesign/portal` usa a regra local também no Início (`components/home/HomeEspacoPortal.vue:113`). Se o mínimo mudar na API, a tela promete um saque que a API recusa.

## Research Findings

- `src/comissao/carteira-portal.controller.ts:19` expõe `GET carteira`; `src/comissao/carteira.service.ts:147` monta `bloqueadoParaSaque` como `emRevisaoAntifraude || saldoTotalCentavos < 0`.
- O papel (DONO) já é resolvido na membership do parceiro; o saque já exige DONO.
- O app tem lógica parecida para o influenciador (`src/influencer/influencer-carteira.service.ts:120`): fora do escopo, com o mesmo campo como follow-up.

## Contrato (aditivo)

```ts
Carteira = {
  // campos atuais sem mudança
  saldoTotalCentavos, saldoSacavelCentavos, chavePix, totalSacadoCentavos, bloqueadoParaSaque,
  // novos
  saqueMinimoCentavos: number,
  capacidadeDeSaque: 'BLOQUEADO' | 'SEM_SALDO' | 'TUDO_RETIDO' | 'SO_DONO' | 'SEM_CHAVE_PIX' | 'ABAIXO_DO_MINIMO' | 'LIBERADO',
}
```

A ordem de avaliação é a do portal hoje (é a ordem em que a pessoa resolve), e fica numa função pura `capacidadeDeSaque(carteira, ehDono, minimo)` em `src/comissao/regras/capacidade-de-saque.ts`.

## Acceptance Criteria

- [x] **Given** carteira em revisão antifraude **When** `GET carteira` **Then** `capacidadeDeSaque = BLOQUEADO`, qualquer que seja o saldo. **Atendido** (unit, smoke).
- [x] **Given** saldo total positivo e sacável zero **Then** `TUDO_RETIDO`. **Atendido** (unit).
- [x] **Given** OPERADOR com saldo sacável acima do mínimo **Then** `SO_DONO`. **Atendido** (unit, smoke).
- [x] **Given** DONO sem chave PIX **Then** `SEM_CHAVE_PIX`; com PIX e sacável de R$ 49,99 **Then** `ABAIXO_DO_MINIMO`; com R$ 50,00 **Then** `LIBERADO`. **Atendido** (unit, smoke).
- [x] `saqueMinimoCentavos` é lido de `SAQUE_MINIMO_CENTAVOS`, e `POST /parceiro/portal/saques` usa a mesma constante e a mesma função (teste de concordância GET x POST em 13 cenários; smoke). **Atendido**.
- [x] Os campos atuais da resposta continuam com o mesmo nome e valor (sem breaking change). **Atendido**, com uma exceção deliberada: para OPERADOR, `chavePix` vem mascarada (abaixo).

## Estratégia de Testes

- Unit da função pura com os 7 resultados e a ordem (casos copiados de `regras-de-saque.spec.ts` do portal, se existir, como golden test).
- Unit do service garantindo `ehDono` vindo da membership.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `src/comissao/regras/capacidade-de-saque.ts` (+ spec) | Criar |
| `src/comissao/carteira.service.ts` | Modificar (montar os dois campos) |
| `src/comissao/dto/*` (Swagger) | Modificar |
| `contrato/openapi.json` | Regenerar |

## Tasks

- [x] **T1** Função pura + testes
- [x] **T2** Campos na resposta + Swagger + `openapi:exportar` *(T1)*
- [x] **T3** Handoff ([front-portal-parceiro-e0.md](../../../../../../implementacao-por-superficie/front-portal-parceiro-e0.md), seção 3): portal (`regras-de-saque.ts`, `PortalCarteiraVisaoPanel`, `HomeEspacoPortal` da redesign) e app passam a ler `capacidadeDeSaque` e apagam a regra local

## Rollout / Rollback

Aditivo. Rollback é reverter o commit; o front antigo ignora campos novos.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Baixo | A regra nova divergir da que o `POST /saques` aplica | O `POST /saques` passa a chamar a mesma função pura antes de debitar; teste que compara as duas |

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementada (agente da onda 0). Rota real do saque: `POST /parceiro/portal/saques`; o POST mantém as respostas de erro de antes (SEM_SALDO, TUDO_RETIDO e ABAIXO_DO_MINIMO seguem em `SALDO_INSUFICIENTE`; o check de PIX segue antes da regra). Revisão: as três leituras do GET em paralelo; e, pelo achado `SEG-2026-10-21-CARTEIRA-PIX-OPERADOR`, a `chavePix` sai mascarada para OPERADOR (`mascararChavePix`, só os 4 últimos). O detalhe do saque segue com a chave inteira (`SEG-2026-10-21-SAQUE-PIX-SNAPSHOT-OPERADOR`, aberto) | Claude |
