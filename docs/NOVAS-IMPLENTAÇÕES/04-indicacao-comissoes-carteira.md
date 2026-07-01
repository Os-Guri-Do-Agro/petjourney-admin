# Spec: Parte 4 - Programa de Indicacao e Carteira (Comissoes)

**Status:** In Review (draft) | **Autor:** Claude + Nicolas | **Atualizado em:** 2026-06-24 | **Versao:** 0.4

> Parte 4 do epico [Acesso, Compartilhamento e Parcerias](../epicos/acesso-compartilhamento-e-parcerias.md) (decisao **D13** + finos de **D14** + decisoes finais autoritativas de **D15** + ajustes pos-auditoria **D16**).
> **BLOQUEADA por Parte 3 implementada.** Depende da identidade do parceiro (modelo `Parceiro` evoluido: `cnpj`/`statusAuditoria`, **coluna `codigoIndicacao String? @unique`**, **coluna `comissaoPercentual Float?` nullable** (D16), tabela `ParceiroEquipe`, `ParceiroGuard`/`RolesGuard`, asserts `assertParceiroMembership`/`assertParceiroDono`/`resolveParceiroDoUsuario`). **Nada disso existe no codigo nem em spec aprovada hoje** (ver "Estado real da fundacao" abaixo). E do webhook RevenueCat / `Subscription` ja existentes (esses, sim, em producao).
> **Dependencia SOFT da Parte 0** (catalogo i18n de erros). E shippable sem a Parte 0 com fallback pt-BR fixo (ver Riscos e Perguntas em Aberto). A migracao para o catalogo e troca centralizada, sem mudar shape de rota.

---

## Contrato de schema Parte 3 <-> Parte 4 (reconciliado, autoritativo - D15 + D16)

> Esta secao fixa **quem e dono de cada coluna de `Parceiro`** relacionada a indicacao/comissao, fechando a contradicao historica entre os drafts. **Fonte:** D15 + D16 + ground truth da spec irma [03-parceiro-portal-auditado.md](03-parceiro-portal-auditado.md) v0.4 (verificada 2026-06-24).

| Coluna / artefato | Dono (cria a coluna) | Parte 4 faz | Ancora |
|---|---|---|---|
| `Parceiro.codigoIndicacao String? @unique` | **Parte 3** (nasce null; nenhum fluxo da Parte 3 preenche) | **CONSOME**: gera valor lazy/anti-corrida na 1a chamada de `GET /parceiro/portal/indicacao`, define formato/QR/link/captura no signup | [03:133](03-parceiro-portal-auditado.md), [03:386](03-parceiro-portal-auditado.md) |
| `Parceiro.cnpj` / `statusAuditoria` (enum com `APROVADO`) | **Parte 3** | CONSOME (`statusAuditoria=APROVADO` e pre-condicao da Regra 2/6) | [03:465](03-parceiro-portal-auditado.md) |
| `Parceiro.comissaoPercentual Float?` | **Parte 3** (coluna aditiva nullable - **D16**; nasce null = usar default global) | **CONSOME**: `percentualEfetivo = parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` (5%) - Regra 4. **NUNCA hardcodar 5% no callsite.** Permite percentual por parceiro negociado sem deploy. | [epico D16](../epicos/acesso-compartilhamento-e-parcerias.md) |
| `Parceiro.comissaoAcumuladaCentavos Int` | **NINGUEM. NAO existe.** Removido pela Parte 3 v0.4 | **NAO denormaliza bruto em coluna.** "Bruto historico" = derivado do ledger sob demanda: `SUM(valorCentavos WHERE tipo=CREDITO_COMISSAO)`. Mais consistente com a Regra 8 (uma unica invariante materializada). | derivado |

**Implicacao direta:**
- A Parte 4 **NAO recria** a coluna `codigoIndicacao` (a Parte 3 ja a adiciona na migration dela - [03:228](03-parceiro-portal-auditado.md)). Recriar = dois `ALTER TABLE "Parceiro" ADD codigoIndicacao @unique` = conflito de migration garantido. A migration da Parte 4 **nao toca** `codigoIndicacao`.
- A Parte 4 **NAO recria** a coluna `comissaoPercentual` (a Parte 3 a adiciona, aditiva/nullable - D16). Se a Parte 3 ainda nao a tiver criado quando a Parte 4 for ao codigo, esta migration a adiciona (aditivo, `Float?` nullable). A coluna **nasce null**; null significa "usar `COMISSAO_PADRAO_PCT`".
- A Parte 4 **NAO espera** `comissaoAcumuladaCentavos` da Parte 3. Ela nao existe em nenhuma das duas specs. O bruto e derivado do ledger.
- O fallback antigo "se a Parte 3 nao implementar, esta parte adiciona as colunas de comissao" foi reduzido a **uma** coluna: `comissaoPercentual` (aditiva/nullable). **Nunca** `comissaoAcumuladaCentavos` (nao existe em design nenhum - o bruto e derivado do ledger).
- **Pre-condicao de implementacao (T0):** Parte 3 implementada **com as colunas `codigoIndicacao` e `comissaoPercentual` ja criadas**. Se a Parte 3 ainda nao tiver criado alguma quando a Parte 4 for ao codigo, a migration da Parte 4 a adiciona (aditivo, nullable) - mas **so `codigoIndicacao` e `comissaoPercentual`**, nunca `comissaoAcumuladaCentavos`.

---

## Estado real da fundacao (pre-condicao dura, NAO assumir entregue)

Esta parte foi escrita sobre as Partes 0-3 do epico. **Ground truth verificado no repo em 2026-06-24:** as Partes 0, 1, 2 e 3 sao **specs draft "In Review", NAO implementadas e NAO aprovadas** ([README.md:12-16,54-55](README.md) - "drafts In Review ... nao estao aprovados para implementacao").

Confirmacoes de codigo (o que existe HOJE):

| Artefato assumido pela Parte 4 | Estado real verificado | Ancora |
|---|---|---|
| `Parceiro` com `cnpj`/`statusAuditoria`/`codigoIndicacao`/`comissaoPercentual` | **NAO existe.** `Parceiro` e a entidade LEVE original: so `id`/`nome @unique`/`logoUrl?`/`ativo`/`createdAt`/`updatedAt`/`cupons`. Grep no repo inteiro: zero match para `statusAuditoria`, `codigoIndicacao`, `comissaoPercentual`, `ParceiroEquipe`. **`comissaoPercentual` passa a ser coluna da Parte 3 (D16); `comissaoAcumuladaCentavos` nao existe em design nenhum (bruto derivado do ledger).** | [schema.prisma:201-209](../../../prisma/schema.prisma#L201-L209) |
| Tabela `ParceiroEquipe` (membership) | **NAO existe.** | grep zero |
| `ParceiroGuard` / `RolesGuard` / `@Roles` | **NAO existe.** `src/auth/guards/` so tem `jwt-auth.guard.ts`, `optional-jwt-auth.guard.ts`, `system-admin.guard.ts`. | [03-parceiro-portal-auditado.md:7](03-parceiro-portal-auditado.md), `src/auth/guards/` |
| `assertParceiroMembership` / `assertParceiroDono` / `resolveParceiroDoUsuario` | **NAO existe** no `OwnershipService` (so tem asserts de pet/tutor/vacina/consulta/documento/etc). | [ownership.service.ts](../../../src/auth/services/ownership.service.ts) |

**Implicacao para o sizing:** o que o texto chamava de "a Parte 3 ja adicionou X, esta parte reusa" e **falso hoje** para os artefatos de identidade (codigo, percentual, equipe, guard, asserts). Esta parte so e implementavel **apos** a Parte 3 ser implementada (nao apenas redigida). Para a coluna `codigoIndicacao`, o dono e a Parte 3 (cria null) e a Parte 4 a consome (gera valor). Para a coluna `comissaoPercentual` (D16), o dono e a Parte 3 (cria null/nullable) e a Parte 4 a consome (`?? COMISSAO_PADRAO_PCT`). Ver "Contrato de schema Parte 3 <-> Parte 4".

Pre-condicoes duras de implementacao desta parte (todas da Parte 3):
1. Schema `Parceiro` evoluido (`cnpj`, `statusAuditoria` enum com `APROVADO`, **coluna `codigoIndicacao String? @unique` ja criada e null**, **coluna `comissaoPercentual Float?` nullable ja criada e null** - D16).
2. Tabela `ParceiroEquipe` (vinculo `usuarioId` x `parceiroId` x papel DONO/OPERADOR).
3. Guard de papel de parceiro (`ParceiroGuard` local OU `RolesGuard`).
4. Asserts `assertParceiroMembership(parceiroId, userId)` e `assertParceiroDono(parceiroId, userId)` no `OwnershipService`.

**T0 e BLOQUEANTE e e de reconciliacao de contrato, nao so de ordem:** confirmar que a Parte 3 implementada entrega `codigoIndicacao` + `comissaoPercentual` (colunas) + identidade + guards + asserts. A coluna `comissaoAcumuladaCentavos` **nao** faz parte do contrato (nem la, nem aqui - bruto derivado do ledger). Se a Parte 3 nao entregar `codigoIndicacao` ou `comissaoPercentual`, esta parte as adiciona (aditivo, nullable). Idealmente Parte 3 e Parte 4 sao revisadas juntas para fixar as colunas de `Parceiro` de uma vez (Risco "Fundacao").

---

## Visao Geral

Programa de indicacao do parceiro + carteira de comissoes estilo banco. Cada `Parceiro` tem um **codigo de indicacao** unico (coluna criada na Parte 3; valor/QR/link gerados nesta Parte 4). Tutor que se cadastra por ali fica **atribuido** ao parceiro. Quando esse tutor assina (apos o trial), o parceiro ganha o **percentual configurado da assinatura** (`parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT`, default **5%** - D16) por ate **18 meses** a partir da primeira conversao paga. Os creditos caem numa **carteira** (saldo + extrato/ledger). Reembolso **estorna** a comissao do ciclo (clawback determinado por D15: `CANCELLATION` com `cancel_reason="CUSTOMER_SUPPORT"`). O parceiro **saca via PIX** (minimo R$50) num ciclo mensal (corte dia 27, pagamento ate dia 5), com **liquidacao manual por admin** (sem integracao bancaria automatica nesta onda).

A integracao com receita acontece num **hook no `WebhookService` apos atualizar a `Subscription`**, e e **idempotente** via `WebhookEvent.eventId` (chave de dedupe que ja existe) + `ParceiroTransacao.refEvento @unique` (segunda defesa). Dinheiro e sempre **centavos inteiros** (`Int`), nunca `Float`.

Escopo desta parte (D13 + D15 + D16):
1. **Atribuicao** tutor -> parceiro no signup (`referidoPorParceiroId`), unica e imutavel, best-effort (lookup que falha nao derruba o signup), com janela de 18 meses.
2. **Comissao** do percentual efetivo (`parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT`, default 5% - D16) disparada pelos eventos do webhook (INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE), base **mensal = `Plano.preco`** e **anual = `event.price_in_purchased_currency` real pago** (D15), com clawback em reembolso (`CANCELLATION`/`CUSTOMER_SUPPORT`).
3. **Carteira** (`ParceiroCarteira` saldo + `ParceiroTransacao` extrato/ledger).
4. **Saque** (`ParceiroSaque`) PIX com liquidacao admin, com **debito atomico anti-double-spend**.
5. **Job de reconciliacao** que recupera creditos perdidos por falha transitoria do hook (fecha o buraco da Regra 14), com janela de lookback.
6. **Anti-laranja desta onda (D15):** hold de saque + **limite leve de N conversoes/parceiro/janela** que marca o parceiro para revisao admin e segura saque.

Fora desta parte: integracao bancaria/PIX automatica (liquidacao e manual); telas mobile/CMS (ficam nos repos de front); notificacoes push; camada anti-fraude avancada (detec. de IP/dispositivo/laranja por sinal de rede fica em camada futura - Regra 16c).

---

## Motivacao / Contexto de Negocio

- A Parte 3 (draft) deixa a comissao como **stub** deliberado (`computeComissao` retorna null, [03-parceiro-portal-auditado.md:366](03-parceiro-portal-auditado.md)). O modelo de comissao por **resgate de cupom** foi abandonado por uma razao concreta: o desconto do cupom e **externo** (usado na loja do parceiro), nao toca billing, e o sistema **nao tem o valor bruto da venda** ([cupons-tutor-backend.md:16](../cupons-tutor-backend.md)). Sem valor, nao da pra calcular o percentual.
- A decisao **D13** (Nicolas, 2026-06-24) move a comissao para **indicacao**: a base do percentual mensal passa a ser `Plano.preco` (preco de lista, **computavel internamente**), e o gatilho passa a ser o **evento de assinatura paga** (que o backend ja recebe e processa via webhook RevenueCat). **D15** fixa que a base **anual** e o **valor real pago** (`event.price_in_purchased_currency`), nao `Plano.preco*12` nem um `precoAnual` inventado. Isso resolve o furo do "valor bruto inexistente" e do "preco anual inexistente". **D16** torna o percentual **configuravel por parceiro** via coluna `Parceiro.comissaoPercentual` (null = default global `COMISSAO_PADRAO_PCT = 5%`), permitindo negociacao comercial sem deploy.
- O lado B2B (parcerias) precisa de um incentivo recorrente real para o parceiro divulgar o app. Carteira + saque transformam a comissao acumulada em algo sacavel, fechando o ciclo de aquisicao por indicacao.

---

## Research Findings (ancoras arquivo:linha reais)

> Coluna "Categoria": **PROD** = fato verificado em producao hoje. **DRAFT-P3** = proposto pela Parte 3 (spec draft, NAO implementado) - esta parte depende da Parte 3 ser implementada antes.

| # | Cat | Fato | Ancora |
|---|---|---|---|
| 1 | PROD | `WebhookService.handleRevenueCatEvent` ja **deduplica** por `WebhookEvent.eventId` (busca `gateway_eventId`, retorna `DUPLICATED` se existe) **antes** de processar. **Atencao (furo de recuperacao):** o dedupe roda **antes** de `processEvent`, e o `WebhookEvent` e gravado **PROCESSED logo apos** `processEvent`. Logo, se o credito de comissao falhar transitoriamente, a reentrega do mesmo `event.id` cai em DUPLICATED e o hook **nunca roda de novo**. Por isso a recuperacao e via **job de reconciliacao** (Regra 14), nao via reprocesso do webhook. | [webhook.service.ts:33-60](../../../src/webhook/webhook.service.ts#L33-L60), [webhook.service.ts:62-70](../../../src/webhook/webhook.service.ts#L62-L70) |
| 2 | PROD | O switch chama `upsertSubscription` para `INITIAL_PURCHASE`/`PRODUCT_CHANGE`/`RENEWAL`/`UNCANCELLATION`. O hook de comissao entra **depois** desse switch, dentro de `processEvent`, com `usuario`/`tutorId`/`tipoAssinatura`/`produtoPlanoId` ja resolvidos. | [webhook.service.ts:247-313](../../../src/webhook/webhook.service.ts#L247-L313) |
| 3 | PROD | O webhook ja carrega `usuario` (via `app_user_id`) com `tutorPerfil`; a atribuicao mora em `Usuario` sem +1 query (`usuario.referidoPorParceiroId` ja vem). `tutorId = usuario.tutorPerfil.id`. | [webhook.service.ts:172-228](../../../src/webhook/webhook.service.ts#L172-L228) |
| 4 | PROD | `inferTipoAssinatura(productId)`: contem `'annual'` -> `ANNUAL`, senao `MONTHLY`. | [webhook.service.ts:315-318](../../../src/webhook/webhook.service.ts#L315-L318) |
| 5 | PROD | `PRODUCT_CHANGE` e tratado como upsert; o swap de plano (upgrade) faz EXPIRED no antigo + CREATE no novo. A base do credito **NAO** deve ler o estado pos-swap da `Subscription` (pode divergir em corrida): le `Plano.preco` direto do `produtoPlanoId` resolvido do **proprio evento** (deterministico). | [webhook.service.ts:413-437](../../../src/webhook/webhook.service.ts#L413-L437) |
| 6 | PROD | O DTO do webhook **ja expoe** `price`, `price_in_purchased_currency`, `currency`, `purchased_at_ms`, `period_type`, `transaction_id`, `original_transaction_id`. **`period_type`** distingue TRIAL/INTRO de NORMAL (usado na pre-condicao "pago, nao trial" - Regra 6c). **`original_transaction_id`/`transaction_id`** sao a chave de correlacao do clawback (Regra 7). **NAO expoe `cancel_reason`** (so `expiration_at_ms`) - precisa ser estendido (D15, T4b). | [revenuecat-event.dto.ts:27-57](../../../src/webhook/dto/revenuecat-event.dto.ts#L27-L57) |
| 7 | PROD | O webhook resolve apenas `produtoPlanoId` via `ProdutoGateway` ([webhook.service.ts:189-210](../../../src/webhook/webhook.service.ts#L189-L210)); **NAO carrega o objeto `Plano` nem `Plano.preco`.** Logo o hook precisa de **+1 query** (`prisma.plano.findUnique({ where:{id:produtoPlanoId}, select:{preco:true} })`) **so para a base mensal**. Para a base anual a base vem do **proprio evento** (`event.price_in_purchased_currency`), sem +1 query. **D16:** o hook tambem le `parceiro.comissaoPercentual` (ja resolvido via `referidoPorParceiroId` - sem query extra dedicada se incluido no select do parceiro). A NFR contabiliza essas leituras. | [webhook.service.ts:189-210](../../../src/webhook/webhook.service.ts#L189-L210) |
| 8 | PROD | `Plano.preco` e **Float** e na seed e o **preco mensal de lista** (Pro 24.90, Premium 39.90; Basico/Freemium 0). **Nao ha coluna de preco anual.** Pior: `petjourney_pro_annual` e `petjourney_pro_monthly` mapeiam para o **mesmo `planoId`** (idem premium) - logo `Plano.preco` e **identico** para mensal e anual, e o `Plano` **nao da nenhum sinal do valor anual real**. Por isso (D15) a base anual usa `event.price_in_purchased_currency` real e **`Plano.preco` so vale para o mensal**. | [schema.prisma:143-159](../../../prisma/schema.prisma#L143-L159), [seed.ts:118-138](../../../prisma/seed.ts#L118-L138), [seed.ts:164-169](../../../prisma/seed.ts#L164-L169) |
| 9 | PROD | `event.id` (a chave de idempotencia) e **`@IsOptional @IsString`** no DTO: pode nao vir. O `recordEvent` ja sintetiza um id quando falta (`revenuecat:no-id:<ts>:<rand>`), **mas** esse id sintetico **nao serve** de `refEvento` de comissao (muda a cada reentrega -> creditaria 2x). Logo: **evento pago sem `event.id` real NAO credita** (Regra 6e + AC). | [revenuecat-event.dto.ts:23-25](../../../src/webhook/dto/revenuecat-event.dto.ts#L23-L25), [webhook.service.ts:129-145](../../../src/webhook/webhook.service.ts#L129-L145) |
| 10 | DRAFT-P3 | A Parte 3 (draft v0.4) **adiciona a COLUNA** `codigoIndicacao String? @unique` na migration dela ([03:133,228](03-parceiro-portal-auditado.md)), mas **nao gera valor** (nasce null; "geracao e consumo sao da Parte 4" - [03:386](03-parceiro-portal-auditado.md)). Logo a Parte 4 **consome** a coluna (gera valor lazy, define formato/QR/link), **sem recriar a coluna**. Alinhado a **D15**. | [03:133](03-parceiro-portal-auditado.md), [03:386](03-parceiro-portal-auditado.md) |
| 11 | DRAFT-P3 | **D16:** o percentual de comissao passa a ser **coluna aditiva `Parceiro.comissaoPercentual Float?` nullable**, dona da **Parte 3** (nasce null). Esta parte **consome**: `percentualEfetivo = parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` (default global `5.0` em constante de config). **NUNCA hardcodar 5% no callsite do calculo.** A coluna `comissaoAcumuladaCentavos` **nao existe** em design nenhum: o bruto e **derivado do ledger** (`SUM(CREDITO_COMISSAO)`). Ver "Contrato de schema Parte 3 <-> Parte 4". | [epico D16](../epicos/acesso-compartilhamento-e-parcerias.md), [03:142](03-parceiro-portal-auditado.md) |
| 12 | PROD | `Subscription` e 1 `Usuario` -> 1 `Plano` por `(tipoEntidade, entidadeId)`, indice unico parcial em ACTIVE; o webhook nao muda contrato (D5). A comissao **observa** a subscription, nao a redefine. | [subscription.service.ts:38-48](../../../src/subscription/subscription.service.ts#L38-L48), [webhook.service.ts:330-437](../../../src/webhook/webhook.service.ts#L330-L437) |
| 13 | PROD/DRAFT-P3 | Padrao `assert*` no `OwnershipService` lanca `ForbiddenException` (403) com WARN; admin bypassa (PROD: existe para pet/tutor/etc). `assertParceiroMembership`/`assertParceiroDono` sao **DRAFT-P3** (nao existem hoje) - esta parte os assume entregues pela Parte 3. | [ownership.service.ts:23-44](../../../src/auth/services/ownership.service.ts#L23-L44) |
| 14 | PROD | Signup do tutor e via `UsuarioService.create` (cria `Usuario` + `tutorPerfil` + subscription Freemium TRIAL 3 meses) num unico `prisma.usuario.create` com nested creates. E o ponto unico de captura do `codigoIndicacao`. O lookup do parceiro por codigo e uma query **SEPARADA antes** do create. `CreateUsuarioDto` valida com class-validator. | [usuario.service.ts:22-75](../../../src/usuario/usuario.service.ts#L22-L75), [usuario/dto/create-usuario.dto.ts](../../../src/usuario/dto/create-usuario.dto.ts) |
| 15 | PROD | Envelope de sucesso `{ statusCode, message, data }` via `TransformInterceptor` global; erro `{ statusCode, timestamp, path, message, error }` via `HttpExceptionFilter`. | [transform.interceptor.ts:10-30](../../../src/common/interceptors/transform.interceptor.ts#L10-L30) |
| 16 | PROD | i18n de **conteudo** existe (`src/common/i18n/` - locales/traducao.util/especie.labels). Mas e catalogo de **labels de conteudo**, nao de **erros**; o catalogo de erros (Parte 0) e **epico separado** e nao existe. Mensagens novas de erro ficam pt-BR fixo ate o catalogo. | `src/common/i18n/`, [00-fundacao-papeis-e-codigo.md:184](00-fundacao-papeis-e-codigo.md) |
| 17 | PROD | `SystemAdminGuard` existe (`src/auth/guards/system-admin.guard.ts`). As rotas admin desta parte reusam ele. | `src/auth/guards/system-admin.guard.ts` |
| 18 | PROD | `WebhookEvent` so tem `@@unique([gateway,eventId])` e `@@index([receivedAt])` - **sem indice em `status` nem `type`**. O anti-join da reconciliacao (Regra 14) tem que usar a janela de `receivedAt` para nao virar seq scan crescente. Indice composto opcional `(gateway, type, status, receivedAt)` se o volume crescer. | [schema.prisma:854-868](../../../prisma/schema.prisma#L854-L868) |
| 19 | PROD | Throttler atual e **in-memory** (`ThrottlerModule.forRoot([{ ttl:60000, limit:60 }])`, sem storage Redis) - **nao e cross-instancia no Railway**. D15 exige Redis no throttler OU lockout por codigo nas rotas publicas por codigo. Nesta parte a unica rota "publica por codigo" e o lookup de `codigoIndicacao` no signup (Regra 17). | [app.module.ts:47](../../../src/app.module.ts#L47) |

---

## Modelo de Dados (diff Prisma)

Tudo **aditivo**: 2 colunas novas nullable em `Usuario`, **0 colunas novas em `Parceiro`** (as colunas `codigoIndicacao` e `comissaoPercentual` ja vem da Parte 3), 4 tabelas novas, 4 enums novos. Nenhuma coluna existente muda de tipo ou de obrigatoriedade.

> **Pre-condicao:** assume que `Parceiro.statusAuditoria` (com `APROVADO`), `Parceiro.codigoIndicacao String? @unique` e `Parceiro.comissaoPercentual Float?` ja existem (Parte 3). **Esta migration NAO recria `codigoIndicacao` nem `comissaoPercentual`** (recriar = conflito de migration; ver "Contrato de schema"). Se a Parte 3 nao estiver implementada quando esta parte for ao codigo, esta migration adiciona **somente `statusAuditoria` + `codigoIndicacao` + `comissaoPercentual`** (aditivo, nullable) - **nunca** `comissaoAcumuladaCentavos` (nao existe em design nenhum).

### Enums novos

```prisma
/// Tipo de lancamento no ledger da carteira do parceiro.
enum TipoTransacaoParceiro {
  CREDITO_COMISSAO  // +: comissao de uma assinatura paga atribuida
  ESTORNO           // -: clawback de reembolso do ciclo
  DEBITO_SAQUE      // -: saque solicitado/pago ao parceiro
  AJUSTE            // +/-: ajuste manual de admin (com motivo), reconciliacao
}

/// Origem (evento de billing) que disparou o credito/estorno de comissao.
enum OrigemComissao {
  INITIAL_PURCHASE
  RENEWAL
  UPGRADE          // PRODUCT_CHANGE com troca para plano de maior nivel/valor
  REFUND           // reembolso (CANCELLATION/CUSTOMER_SUPPORT; gera ESTORNO)
}

/// Periodicidade da assinatura que gerou a comissao (snapshot; nao depende de billing).
enum PeriodicidadeComissao {
  MENSAL
  ANUAL
}

/// Status do saque PIX (liquidacao manual por admin nesta onda).
enum StatusSaque {
  PENDENTE  // solicitado, aguardando liquidacao do admin
  PAGO      // admin marcou como liquidado (PIX feito fora do sistema)
  FALHA     // liquidacao falhou; saldo volta a ficar disponivel (estorno do debito)
}
```

### `Usuario` - colunas aditivas (atribuicao de indicacao)

**Decisao Tutor vs Usuario: a atribuicao mora em `Usuario`.** Justificativa:
- O webhook resolve `usuario` por `app_user_id` e ja carrega `tutorPerfil` numa unica query ([webhook.service.ts:172-176](../../../src/webhook/webhook.service.ts#L172-L176)); ler `usuario.referidoPorParceiroId` no hook custa **zero query extra**. Em `Tutor` seria +1 join no caminho quente.
- A `Subscription` (fonte do evento pago) e keyed em `Usuario` (`usuarioId`); a comissao acompanha o pagador, que e o `Usuario`.
- A captura acontece em `UsuarioService.create`, no mesmo `prisma.usuario.create` com nested create do `tutorPerfil` ([usuario.service.ts:36-51](../../../src/usuario/usuario.service.ts#L36-L51)) - colocar no `Usuario` casa com a ordem de criacao.
- Um `Usuario` pode acumular perfis (tutor + vet); a indicacao e da pessoa/conta, nao do papel.

```prisma
model Usuario {
  // ... campos existentes ...
  // --- ADITIVO (Parte 4) ---
  /// Parceiro que indicou este usuario (capturado no signup via codigoIndicacao).
  /// Atribuicao UNICA e IMUTAVEL: gravada apenas na criacao, nunca atualizada (Regra 1).
  /// Nullable: a grande maioria dos usuarios nao vem de indicacao.
  referidoPorParceiroId String?
  referidoPorParceiro   Parceiro? @relation("ParceiroIndicou", fields: [referidoPorParceiroId], references: [id])
  /// Marco da PRIMEIRA conversao paga deste usuario indicado. Ancora a janela de 18 meses.
  /// null = ainda nao converteu (so trial/sem assinatura paga). Gravado 1x (Regra 3).
  primeiraConversaoEm   DateTime?
}
```

> `primeiraConversaoEm` mora no `Usuario` (nao em `Subscription`) porque a janela e por **pessoa indicada**, nao por assinatura: o usuario pode cancelar e voltar; a janela de 18 meses ja comecou a contar.

### `Parceiro` - relacoes reversas aditivas (as colunas `codigoIndicacao` e `comissaoPercentual` ja vem da Parte 3)

> **D15 + D16 + [03:133](03-parceiro-portal-auditado.md):** a **coluna** `codigoIndicacao String? @unique` e a **coluna** `comissaoPercentual Float?` **nascem na Parte 3** (null). Esta parte **NAO recria as colunas**; apenas (a) gera o valor lazy/anti-corrida de `codigoIndicacao` (Regra 12), (b) le `comissaoPercentual` no calculo (Regra 4) e (c) declara as relacoes reversas das tabelas novas. **Nao ha `comissaoAcumuladaCentavos`** em `Parceiro` (Research #11).

```prisma
model Parceiro {
  // ... colunas da Parte 3 (cnpj, statusAuditoria, codigoIndicacao String? @unique,
  //     comissaoPercentual Float?, ...) ...
  // SEM comissaoAcumuladaCentavos (nao existe em design nenhum; bruto derivado do ledger).
  // --- ADITIVO (Parte 4): apenas relacoes reversas (nenhuma coluna nova) ---
  usuariosIndicados Usuario[]          @relation("ParceiroIndicou")
  carteira          ParceiroCarteira?
  transacoes        ParceiroTransacao[]
  saques            ParceiroSaque[]
}
```

> **Percentual de indicacao (D16):** `percentualEfetivo = parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` (constante de config, default `5.0`), aplicado por `computeComissaoIndicacao` (Regra 4). A coluna `comissaoPercentual Float?` (nullable, dona da Parte 3) permite negociar percentual por parceiro sem deploy; `null` cai no default global. **NUNCA hardcodar 5% no callsite.**
> **Bruto historico:** derivado do ledger sob demanda (`SUM(valorCentavos WHERE tipo=CREDITO_COMISSAO)`), nao denormalizado em coluna. Mais consistente com a invariante unica da Regra 8.

### `ParceiroCarteira` - tabela nova (saldo materializado, 1-1 com Parceiro)

```prisma
/// Carteira do parceiro. Saldo materializado (denormalizado) sobre o ledger
/// ParceiroTransacao, que e a FONTE DE VERDADE. saldoTotalCentavos e a UNICA
/// invariante reconciliavel: == SUM(ParceiroTransacao.valorCentavos) (Regra 8).
/// O "sacavel" (total menos creditos em hold) e computado on-the-fly (Regra 16a),
/// NAO materializado.
model ParceiroCarteira {
  id         String   @id @default(cuid())
  parceiroId String   @unique
  parceiro   Parceiro @relation(fields: [parceiroId], references: [id], onDelete: Cascade)
  /// Saldo TOTAL em centavos inteiros (inclui creditos em hold). Atualizado na MESMA
  /// transacao de cada insert no ledger. Reconciliavel = SUM(ParceiroTransacao.valorCentavos).
  /// NAO e o valor "disponivel para saque" (esse desconta o hold - Regra 16a).
  saldoTotalCentavos Int      @default(0)
  /// Chave PIX cadastrada pelo parceiro (DONO). Texto livre validado no DTO. Nullable ate cadastrar.
  chavePix   String?
  /// Marca de revisao anti-laranja (Regra 16d). Quando true, saques ficam bloqueados
  /// ate o admin revisar/liberar. Setado pelo limite de N conversoes/janela.
  emRevisaoAntifraude Boolean @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

> **Rename intencional `saldoDisponivelCentavos` -> `saldoTotalCentavos`.** A versao anterior chamava o materializado de "disponivel", o que conflitava com o hold (Regra 16a): credito em hold entra no materializado mas **nao** pode ser sacado. Para nao validar saque contra dinheiro em hold, o materializado e o **total** (reconciliavel - Regra 8) e o **sacavel** e derivado (`total - SUM(CREDITO_COMISSAO em hold)`, Regra 16a). `GET /carteira` retorna ambos.

### `ParceiroTransacao` - tabela nova (ledger / extrato; fonte de verdade)

```prisma
/// Ledger imutavel (append-only) das movimentacoes da carteira. NUNCA se edita
/// nem deleta linha; correcoes entram como nova linha (ESTORNO/AJUSTE). Saldo = SUM(valorCentavos).
model ParceiroTransacao {
  id          String                 @id @default(cuid())
  parceiroId  String
  parceiro    Parceiro               @relation(fields: [parceiroId], references: [id], onDelete: Cascade)
  tipo        TipoTransacaoParceiro
  /// Valor com sinal, em centavos inteiros. CREDITO_COMISSAO/AJUSTE+ positivo;
  /// ESTORNO/DEBITO_SAQUE negativo. Soma de tudo = saldo total.
  valorCentavos Int
  /// Periodicidade da assinatura que gerou (null para DEBITO_SAQUE/AJUSTE).
  periodicidade PeriodicidadeComissao?
  /// Evento de billing de origem (null para DEBITO_SAQUE/AJUSTE manual).
  origem      OrigemComissao?
  /// Snapshot do percentual EFETIVO aplicado (ex.: 5.0 ou o negociado do parceiro). Permite recalculo/auditoria.
  percentualSnapshot Float?
  /// Snapshot da base (em centavos) usada no calculo. Auditoria.
  baseCentavos Int?
  /// Moeda do snapshot da base (ISO, ex.: "BRL"). Para o anual, gravar event.currency
  /// (auditoria; so credita se currency==BRL - Regra 11). null para mensal/saque/ajuste.
  baseMoeda   String?
  /// Usuario indicado (tutor pagante) que originou a comissao. Atribuicao/auditoria interna.
  /// NUNCA serializado na resposta do parceiro (PII). Nullable para DEBITO_SAQUE/AJUSTE.
  usuarioIndicadoId String?
  /// Subscription observada (snapshot do id). Auditoria interna; nao e FK rigida. NUNCA serializado (correlacionavel a tutor).
  subscriptionId String?
  /// Chave de correlacao do ciclo para clawback deterministico: snapshot do
  /// transaction_id (ou original_transaction_id) do evento que gerou o credito.
  /// O REFUND bate por esta chave para estornar EXATAMENTE o ciclo reembolsado (Regra 7).
  transactionRef String?
  /// CHAVE DE IDEMPOTENCIA. Para comissao: o WebhookEvent.eventId que disparou
  /// (garante 1 credito por evento). Para estorno: "refund:<eventId do refund>".
  /// Para saque: "saque:<saqueId>"; para falha de saque: "saque-falha:<saqueId>".
  /// Para AJUSTE: "ajuste:<cuid>". Unico GLOBAL -> reprocessar o mesmo evento nao duplica.
  /// NUNCA recebe null nem string vazia (NOT NULL no banco) - ver Regra 6e.
  refEvento   String                 @unique
  /// FK para o saque, quando tipo=DEBITO_SAQUE (ou ESTORNO de saque com FALHA).
  saqueId     String?
  saque       ParceiroSaque?         @relation(fields: [saqueId], references: [id])
  createdAt   DateTime               @default(now())

  @@index([parceiroId, createdAt(sort: Desc)])
  @@index([usuarioIndicadoId])
  @@index([transactionRef])
  // Suporta o limite anti-laranja (N conversoes/janela por usuario indicado) sem seq scan.
  @@index([parceiroId, tipo, createdAt])
}
```

> **`refEvento String @unique` e o coracao da idempotencia.** Como o webhook ja deduplica por `WebhookEvent.eventId`, o mesmo evento nao chega duas vezes ao hook em condicoes normais; o `@unique` em `refEvento` e a **segunda linha de defesa** (race/reentrega): um `P2002` no insert significa "ja creditei esse evento" -> no-op idempotente. **`refEvento` jamais recebe null/'':** evento pago sem `event.id` real nao chega a inserir linha (Regra 6e).

### `ParceiroSaque` - tabela nova (saque PIX, liquidacao admin)

```prisma
/// Pedido de saque do parceiro. Liquidacao MANUAL por admin nesta onda
/// (sem integracao bancaria; admin marca PAGO apos fazer o PIX por fora).
model ParceiroSaque {
  id            String      @id @default(cuid())
  parceiroId    String
  parceiro      Parceiro    @relation(fields: [parceiroId], references: [id], onDelete: Cascade)
  /// Valor solicitado, em centavos. Minimo 5000 (R$50) - Regra 9.
  valorCentavos Int
  /// Snapshot da chave PIX usada no pedido (a chave da carteira pode mudar depois).
  chavePixSnapshot String
  status        StatusSaque @default(PENDENTE)
  /// Admin que liquidou/marcou falha (usuarioId). Trilha.
  liquidadoPorId String?
  liquidadoEm   DateTime?
  /// Motivo de falha (texto livre do admin), OBRIGATORIO quando status=FALHA (validado no DTO).
  motivoFalha   String?
  /// Comprovante/identificador do PIX informado pelo admin ao marcar PAGO. Opcional.
  comprovante   String?
  transacoes    ParceiroTransacao[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([parceiroId, status])
  @@index([status, createdAt])
}
```

### Migration (aditiva)

- Nome sugerido: `prisma/migrations/20260624130000_parceiro_indicacao_comissao_carteira/`.
- SQL, em ordem:
  1. `CREATE TYPE` para os 4 enums novos.
  2. (Se Parte 3 nao implementada) `ALTER TABLE "Parceiro"` adiciona `statusAuditoria` (com `APROVADO`), **`codigoIndicacao TEXT NULL` + `CREATE UNIQUE INDEX`** e **`comissaoPercentual DOUBLE PRECISION NULL`** (D16) - **somente se a coluna ainda nao existir** (a Parte 3 e a dona; ver "Contrato de schema"). **NUNCA** adicionar `comissaoAcumuladaCentavos`.
  3. `ALTER TABLE "Usuario" ADD COLUMN "referidoPorParceiroId" TEXT NULL, ADD COLUMN "primeiraConversaoEm" TIMESTAMP NULL;` + FK + `CREATE INDEX` em `referidoPorParceiroId`.
  4. `CREATE TABLE "ParceiroCarteira"` (`@@unique` parceiroId, `saldoTotalCentavos`, `emRevisaoAntifraude`).
  5. `CREATE TABLE "ParceiroTransacao"` + `CREATE UNIQUE INDEX` em `refEvento` + indices `(parceiroId, createdAt DESC)`, `usuarioIndicadoId`, `transactionRef`, `(parceiroId, tipo, createdAt)`.
  6. `CREATE TABLE "ParceiroSaque"` + indices.
  7. (Opcional, Research #18) `CREATE INDEX ON "WebhookEvent"("gateway","type","status","receivedAt")` se o volume de webhooks justificar - senao a janela de `receivedAt` ja basta (Regra 14).
- **Importante:** os passos "ADD COLUMN codigoIndicacao" e "ADD COLUMN comissaoPercentual" da versao anterior **so entram como fallback condicional `IF NOT EXISTS`** se a Parte 3 nao as tiver criado (sao colunas da Parte 3). No caminho normal a migration nao as toca.
- **Sem backfill obrigatorio.** Carteiras criadas lazy (upsert) na primeira movimentacao. `comissaoPercentual` nasce null (= default global). Rodar `prisma migrate status` antes; `prisma migrate deploy` em prod (Supabase bloqueia shadow DB).
- **Consumidores (app/CMS):** ver secao "Consumidores (mobile/CMS)" - ha mudanca de **comportamento** de front nao trivial (persistencia cross-sessao do codigo), nao so campos novos.

---

## Contrato dos Endpoints

> Envelope de sucesso `{ statusCode, message, data }` (TransformInterceptor global). Erro `{ statusCode, timestamp, path, message, error }` (HttpExceptionFilter). Todas as rotas autenticadas com `JwtAuthGuard`; as parceiro-scoped reusam `ParceiroGuard`/`RolesGuard` (Parte 3 - pre-condicao). **Mensagens de erro pelo catalogo i18n (Parte 0)** (pt-BR/en-US/en-GB/es-419, en-GB explicito - D14); fallback pt-BR fixo se o catalogo (Parte 0) ainda nao existir. **Mensagens novas sem em-dash** (ponto/dois-pontos) - Regra de copy do CLAUDE.md. Codigos de erro estaveis: `SALDO_INSUFICIENTE`, `VALOR_ABAIXO_MINIMO`, `PIX_NAO_CADASTRADO`, `SAQUE_BLOQUEADO_REVISAO`, `SAQUE_BLOQUEADO_SALDO_NEGATIVO`.

### Signup (alteracao aditiva de DTO existente)

`POST /usuario` - `CreateUsuarioDto` ganha campo opcional:

```ts
@ApiPropertyOptional({ description: 'Codigo de indicacao do parceiro (opcional)', example: 'PJ-AB12CD' })
@IsString()
@IsOptional()
@MaxLength(20)
@Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
codigoIndicacao?: string;
```

- **Normalizacao no DTO:** `trim` + `uppercase` antes do lookup (Regra 2). Sem normalizar, `'pj-ab12cd '` perderia uma atribuicao legitima silenciosamente.
- Quando presente, normalizado e valido (parceiro existe e `statusAuditoria=APROVADO`), grava `Usuario.referidoPorParceiroId`. Invalido/inexistente/erro transitorio no lookup: **ignora silenciosamente** (`referidoPorParceiroId=null`; signup nao falha - Regra 2). Sem novo erro 4xx no signup. O lookup e **best-effort** (Regra 18).

### Parceiro-scoped (autenticadas; `ParceiroGuard` + `assertParceiroMembership`)

Base `@Controller('parceiro/portal')`. Todas aceitam `?parceiroId=` (obrigatorio quando o usuario tem >1 parceiro ativo; auto-resolvido quando tem 1; sempre validado contra membership - mesmo padrao da Parte 3, [03-parceiro-portal-auditado.md:288](03-parceiro-portal-auditado.md)).

| Metodo | Rota | Papel | Descricao | Sucesso |
|---|---|---|---|---|
| GET | `/parceiro/portal/indicacao` | membership | Retorna `codigoIndicacao` (gera lazy se null), QR (data URL) e link. | 200 |
| GET | `/parceiro/portal/carteira` | membership | Saldo total + saldo sacavel (pos-hold) + chave PIX + total ja sacado + flag de revisao. | 200 |
| GET | `/parceiro/portal/carteira/extrato` | membership | Extrato paginado (cursor) do ledger. | 200 |
| PATCH | `/parceiro/portal/carteira/pix` | **DONO** | Cadastra/atualiza `ParceiroCarteira.chavePix`. | 200 |
| POST | `/parceiro/portal/saques` | **DONO** | Solicita saque PIX (>= R$50, <= sacavel). Debita atomico do saldo, cria `ParceiroSaque(PENDENTE)`. | 201 |
| GET | `/parceiro/portal/saques` | membership | Lista saques do parceiro (status, valor, datas). | 200 |
| GET | `/parceiro/portal/saques/:id` | membership | Detalhe de um saque do parceiro. **`assertSaqueOwnership` obrigatorio.** | 200 |

**GET `/parceiro/portal/indicacao`** - `data`:
```json
{ "codigoIndicacao": "PJ-AB12CD", "qrCodeDataUrl": "data:image/png;base64,...", "linkIndicacao": "https://<PARCEIRO_INDICACAO_BASE_URL>/r/PJ-AB12CD" }
```

**GET `/parceiro/portal/carteira`** - `data`. `saldoSacavelCentavos` = `saldoTotalCentavos` menos creditos em hold (Regra 16a); `bloqueadoParaSaque` reflete revisao anti-laranja (Regra 16d) ou saldo negativo (Regra 16e).
```json
{ "saldoTotalCentavos": 12450, "saldoSacavelCentavos": 9450, "chavePix": "parceiro@email.com", "totalSacadoCentavos": 5000, "bloqueadoParaSaque": false }
```

**GET `/parceiro/portal/carteira/extrato?cursor=&limit=20`** - `data`. **Allow-list ESTRITA de resposta (campo a campo):** `id`, `tipo`, `valorCentavos`, `periodicidade`, `origem`, `createdAt`. **Proibidos na serializacao:** `usuarioIndicadoId`, `subscriptionId`, `transactionRef`, `baseCentavos`, `baseMoeda`, `percentualSnapshot` (sao auditoria interna; `subscriptionId`/`transactionRef`/`usuarioIndicadoId` sao correlacionaveis a um tutor).
```json
{ "items": [ { "id": "...", "tipo": "CREDITO_COMISSAO", "valorCentavos": 1245, "periodicidade": "MENSAL", "origem": "RENEWAL", "createdAt": "..." } ], "nextCursor": "..." }
```

**POST `/parceiro/portal/saques`** - body `SolicitarSaqueDto { valorCentavos: number }` (`@IsInt @Min(5000)`). Em transacao com **debito atomico** (Regra 10b): valida `chavePix != null`, `valorCentavos >= 5000`, parceiro **nao** em revisao anti-laranja e saldo **nao** negativo; calcula o **sacavel sob lock** (`SELECT ... FOR UPDATE` da carteira + recomputo do hold) e valida `valorCentavos <= sacavel`; cria `ParceiroSaque(PENDENTE)`; insere `ParceiroTransacao(DEBITO_SAQUE, -valor, refEvento="saque:<saqueId>")`; decrementa `saldoTotalCentavos`. Erros: `400 SALDO_INSUFICIENTE`, `400 VALOR_ABAIXO_MINIMO`, `400 PIX_NAO_CADASTRADO`, `403 SAQUE_BLOQUEADO_REVISAO`, `400 SAQUE_BLOQUEADO_SALDO_NEGATIVO`.

### Admin (autenticadas; `SystemAdminGuard`)

| Metodo | Rota | Descricao | Sucesso |
|---|---|---|---|
| GET | `/admin/parceiro/saques?status=PENDENTE` | Fila de saques para liquidacao. | 200 |
| POST | `/admin/parceiro/saques/:id/pagar` | Marca `PAGO`. Body `PagarSaqueDto { comprovante?: string }`. Grava `liquidadoPorId/liquidadoEm/comprovante?`. **Bloqueia se saldo do parceiro < 0** (Regra 16e). | 200 |
| POST | `/admin/parceiro/saques/:id/falhar` | Marca `FALHA`, **estorna** o debito, grava `motivoFalha`. Body `FalharSaqueDto { motivoFalha: string }` (`@IsString @IsNotEmpty` - obrigatorio). | 200 |
| POST | `/admin/parceiro/:parceiroId/carteira/ajuste` | Ajuste manual (`AjusteDto { valorCentavos, motivo }`) -> `ParceiroTransacao(AJUSTE)`. **Guard-rails na Regra 19.** | 201 |
| POST | `/admin/parceiro/:parceiroId/carteira/revisao` | Libera/aplica revisao anti-laranja (`RevisaoDto { emRevisao: boolean, motivo: string }`). Seta `ParceiroCarteira.emRevisaoAntifraude`. | 200 |

**POST `/admin/parceiro/saques/:id/falhar`** - em transacao: `status=FALHA`, insere `ParceiroTransacao(ESTORNO, +valor, refEvento="saque-falha:<saqueId>")`, incrementa `saldoTotalCentavos`. Idempotente: se ja FALHA, no-op.

**POST `/admin/parceiro/:parceiroId/carteira/ajuste`** - `AjusteDto { valorCentavos: number; motivo: string }` (`@IsInt`, `valorCentavos != 0`; `motivo @IsString @IsNotEmpty`; `Math.abs(valorCentavos) <= AJUSTE_MAX_CENTAVOS` sanity-check). Insere `ParceiroTransacao(AJUSTE, valorCentavos, refEvento="ajuste:<cuid>")` + `saldoTotalCentavos += valorCentavos`, grava `liquidadoPorId`-equivalente (`ajustadoPorId` no log de auditoria com `adminId`). **Um AJUSTE negativo PODE deixar o saldo < 0** (correcao deliberada de credito indevido); o saldo negativo entao bloqueia novos saques/liquidacao (Regra 16e). Guard-rails completos na Regra 19.

---

## Regras de Negocio

1. **Atribuicao unica e imutavel (primeira indicacao vence).** `Usuario.referidoPorParceiroId` so e gravado **na criacao** (`UsuarioService.create`). Nunca um update posterior reescreve.

2. **Codigo invalido no signup nao quebra o cadastro.** O `codigoIndicacao` e **normalizado (trim+uppercase) no DTO** antes do lookup. Resolve para o parceiro **somente** se existe e `statusAuditoria=APROVADO`. Codigo inexistente/parceiro nao-aprovado => grava `referidoPorParceiroId = null` e segue o signup (sem 4xx). Auto-indicacao (dono se cadastra com o proprio codigo) e permitida no cadastro mas **nao gera comissao** (Regra 6 exige tutor pagante distinto; ver Regra 16 e Perguntas para anti-fraude).

3. **Marco da primeira conversao paga ancora a janela de 18 meses.** No hook, no primeiro evento **pago** atribuido (`period_type=NORMAL` - Regra 6c), grava `Usuario.primeiraConversaoEm = <purchased_at_ms do evento>` se ainda null. Usa o **timestamp do evento** (`purchased_at_ms`), nao `now()` do servidor, para nao distorcer a janela em reentrega tardia. **Fallback:** se um evento que creditaria nao trouxer `purchased_at_ms`, ver Regra 15a (usa `now()` com WARN).

4. **Comissao = percentual efetivo da base (percentual via coluna do parceiro com fallback global - D16).** `percentualEfetivo = parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` (constante de config, default `5.0`). A coluna `Parceiro.comissaoPercentual Float?` e nullable (dona da Parte 3); `null` => usa `COMISSAO_PADRAO_PCT`. **NUNCA hardcodar 5% no callsite** - sempre `?? COMISSAO_PADRAO_PCT`. O percentual efetivo e gravado em `ParceiroTransacao.percentualSnapshot` (auditoria/recalculo). Conversao para centavos **uma vez**: `comissaoCentavos = Math.round(baseCentavos * percentualEfetivo / 100)`. Tudo em inteiro apos a conversao.
   - **Base MENSAL** = `Math.round(Plano.preco * 100)`, lendo `Plano.preco` do `produtoPlanoId` resolvido do **proprio evento** (deterministico, nao depende do estado pos-swap da Subscription - Research #5/#7; +1 query `Plano(preco)`).
   - **Base ANUAL** = `Math.round(event.price_in_purchased_currency * 100)` (valor **real pago**, D15). **Caminho de leitura:** usar `event.price_in_purchased_currency` (moeda da compra), **nao** `event.price` (pode vir na moeda do gateway, ex.: USD). Gravar `event.currency` em `ParceiroTransacao.baseMoeda` para auditoria. **Pre-condicao:** so credita anual se `currency == 'BRL'` e `price_in_purchased_currency > 0`; senao loga `[Comissao][SKIP] reason=anual_moeda_ou_preco_invalido currency=...` e **nao credita** (ver Regra 11).

5. **Disparo por evento de billing (idempotente).** O hook roda em `processEvent` apos `upsertSubscription`, so para `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, e so quando `period_type=NORMAL`:
   - **INITIAL_PURCHASE (pago):** 1 credito; ancora `primeiraConversaoEm`.
   - **RENEWAL (mensal, pago):** 1 credito por renovacao, enquanto ativo e dentro dos 18 meses.
   - **RENEWAL/INITIAL_PURCHASE (anual, pago):** percentual efetivo de `event.price_in_purchased_currency` real (D15), 1x por ciclo, enquanto dentro dos 18 meses. Gated por kill-switch `COMISSAO_ANUAL_ENABLED` (default off como seguranca operacional - **nao** mais "bloqueado ate decisao"; a base ja esta decidida por D15).
   - **PRODUCT_CHANGE:** ver Regra 5a (so credita troca com cobranca nova; idempotencia por ciclo).
   - **Chave de idempotencia:** `ParceiroTransacao.refEvento = WebhookEvent.eventId`. Insert num try/catch: `P2002` => no-op (evento ja creditado).

5a. **PRODUCT_CHANGE so credita troca com cobranca nova (anti super-credito).** `PRODUCT_CHANGE` no RevenueCat dispara em upgrade/downgrade/crossgrade e **nem sempre representa cobranca imediata** (pode ser troca agendada para o proximo ciclo, ou proration). Para nao creditar duas vezes no mesmo ciclo pago (ex.: `INITIAL_PURCHASE` + `PRODUCT_CHANGE` no mesmo mes) nem creditar troca sem dinheiro novo:
   - So credita `PRODUCT_CHANGE` quando `period_type=NORMAL` **E** ha `transaction_id` novo **distinto** do `transactionRef` do ultimo `CREDITO_COMISSAO` do mesmo `usuarioIndicadoId` no ciclo corrente (sinal de cobranca nova). `transaction_id` igual => mesma cobranca ja creditada => no-op.
   - Downgrade nao estorna; passa a creditar o valor menor nas proximas renovacoes (o credito recorrente vem no `RENEWAL` seguinte, nao no `PRODUCT_CHANGE`).
   - A idempotencia por `refEvento` ja evita duplicar o **mesmo** evento; esta regra evita duplicar o **mesmo ciclo** por eventos diferentes.

6. **Pre-condicoes do credito (todas necessarias):**
   (a) `usuario.referidoPorParceiroId != null`;
   (b) parceiro ainda `statusAuditoria=APROVADO`;
   (c) **evento pago, nao trial:** `event.period_type === 'NORMAL'` (RevenueCat manda `TRIAL`/`INTRO`/`NORMAL`; so `NORMAL` credita e so `NORMAL` ancora `primeiraConversaoEm` - Research #6);
   (d) dentro da janela de 18 meses (Regra 3 + Regra 15);
   (e) **`event.id` real presente** (nao o id sintetico do `recordEvent`). Sem `event.id`, **nao credita** (nao da pra deduplicar; `refEvento` jamais recebe '' ) - log `SKIP reason=no_event_id`, nenhuma linha de ledger criada. Consistente com [webhook.service.ts:129-133](../../../src/webhook/webhook.service.ts#L129-L133).
   Falha em qualquer uma => nenhum credito, sem erro (Regra 13).

7. **Clawback em reembolso (gatilho RESOLVIDO por D15: `CANCELLATION` + `cancel_reason="CUSTOMER_SUPPORT"`).** Confirmado na doc do RevenueCat (D15): **reembolso chega como `event.type === 'CANCELLATION'` com `cancel_reason === 'CUSTOMER_SUPPORT'`** - **nao ha** evento/`CHARGEBACK` dedicado. **So esse caso estorna.** `UNSUBSCRIBE` e demais `cancel_reason` (`BILLING_ERROR`, `CUSTOMER_UNSATISFIED`, `UNKNOWN`, etc.) **NAO estornam** - so interrompem a recorrencia futura (o proximo `RENEWAL` nao vem; o ja creditado permanece). Requer **estender o DTO** para ler `cancel_reason` (T4b).
   - Ao chegar `CANCELLATION`/`CUSTOMER_SUPPORT` atribuido, busca o `CREDITO_COMISSAO` do ciclo **por `transactionRef`** (snapshot do `transaction_id`/`original_transaction_id` gravado no credito; o evento traz o mesmo identificador). Insere `ParceiroTransacao(ESTORNO, -valorDoCreditoEncontrado, origem=REFUND, refEvento="refund:<eventId do refund>", transactionRef=<o mesmo>)` e decrementa o saldo.
   - **Sem fallback "ultimo credito":** se nao achar o credito por `transactionRef`, **nao estorna as cegas**; loga `[Comissao][CLAWBACK][ORPHAN]` para revisao manual de admin (evita estornar o ciclo errado).
   - Saldo pode ficar **negativo** apos clawback se o parceiro ja sacou (o hold de 14 dias nao cobre reembolsos tardios de loja - Apple permite ate ~90 dias). Politica de saldo negativo na Regra 16e.
   > **Nota:** hoje o webhook so trata `EXPIRATION`/`BILLING_ISSUE`/`CANCELLATION`; o ramo `CANCELLATION` ja existe ([webhook.service.ts:293-296](../../../src/webhook/webhook.service.ts#L293-L296)). Esta parte adiciona, dentro do hook de comissao, a leitura de `cancel_reason` e o estorno **apenas para `CUSTOMER_SUPPORT`** (nao toca `Subscription`).

8. **Ledger e a fonte de verdade; saldo total e materializado e reconciliavel.** Todo insert em `ParceiroTransacao` + `saldoTotalCentavos += valorCentavos` acontecem na **mesma `$transaction`**. **Invariante dura unica:** `ParceiroCarteira.saldoTotalCentavos == SUM(ParceiroTransacao.valorCentavos WHERE parceiroId)`. **NAO ha** `comissaoAcumuladaCentavos` denormalizado (Research #11): o "bruto historico" e derivado sob demanda (`SUM(valorCentavos WHERE tipo=CREDITO_COMISSAO)`), assim como "total sacado" (`-SUM(WHERE tipo=DEBITO_SAQUE)`) - sempre do ledger, nunca de coluna. O **sacavel** (Regra 16a) e derivado do total menos hold; **nao** e materializado (so o total e). Um script/endpoint de reconciliacao (admin) recomputa o saldo total do ledger e reporta drift.

9. **Saque: PIX, minimo R$50, ciclo mensal.** `valorCentavos >= 5000` e `<= saldoSacavelCentavos` (pos-hold, Regra 16a) e `chavePix != null` e carteira **nao** em revisao (Regra 16d) e saldo **nao** negativo (Regra 16e). **Ciclo (corte dia 27 -> pagamento ate dia 5):** orientacao operacional + UI nesta onda (parceiro solicita quando quiser; admin paga no ciclo). Sem cron de bloqueio por data nesta versao (ver Perguntas). Liquidacao 100% manual.

10. **Saque debita na hora, falha estorna.** Solicitar ja debita (cria `DEBITO_SAQUE` negativo) + cria `ParceiroSaque(PENDENTE)` - impede saque duplo. `PAGO`: so muda status. `FALHA`: insere `ESTORNO` positivo, devolve saldo, status=FALHA, `motivoFalha` obrigatorio. Tudo idempotente (status final => no-op).

10a. **Debito de saque e atomico (anti double-spend / corrida).** Dois saques concorrentes do mesmo parceiro **nao** podem ambos ler o mesmo saldo e ambos debitar (oversaque por corrida, READ COMMITTED). Como o **sacavel** e um agregado (depende do hold - Regra 16a), um `UPDATE ... WHERE saldo >= valor` puro nao basta. Implementacao: na `$transaction`, **`SELECT ... FOR UPDATE`** da linha de `ParceiroCarteira` (lock pessimista da carteira) **antes** de qualquer leitura; recomputar o `saldoSacavelCentavos` sob o lock; validar `valorCentavos <= sacavel`; entao inserir `DEBITO_SAQUE` e decrementar `saldoTotalCentavos`. O lock serializa saques concorrentes da mesma carteira. **AC + integration de concorrencia obrigatorios** (2 saques simultaneos => no maximo 1 passa).

11. **Base do credito anual: RESOLVIDA por D15.** Base anual = **`event.price_in_purchased_currency`** (valor **real pago**), snapshot em `baseCentavos` via `Math.round(price_in_purchased_currency * 100)`, com `baseMoeda = event.currency`. A `Subscription` ja encoda a duracao de 12 meses (Nicolas confirmou). **NAO** usar `Plano.preco*12` (planos anuais tem desconto vs 12x mensal -> super-comissao) nem inventar `Plano.precoAnual` (proibido por D15). Credita **1x por ciclo** anual NORMAL (`INITIAL_PURCHASE`/`RENEWAL`), dentro dos 18 meses. **Guarda de moeda:** so credita se `currency == 'BRL'` e `price_in_purchased_currency > 0`; senao SKIP com log (Regra 4). `COMISSAO_ANUAL_ENABLED` permanece como **kill-switch operacional** (default off), nao mais como bloqueio de decisao. AC8 entra no DoD assim que a flag for ligada (a base nao depende mais de decisao pendente).

12. **Geracao do codigo de indicacao (sem corrida).** A **coluna** `codigoIndicacao` vem da Parte 3 (nasce null); esta parte **gera o valor**. Formato `PJ-XXXXXX` (6 chars base32 Crockford, sem ambiguos). Gerado **lazy** no primeiro `GET /parceiro/portal/indicacao`. **Anti-corrida:** geracao via update condicional `UPDATE "Parceiro" SET codigoIndicacao=$novo WHERE id=$id AND codigoIndicacao IS NULL` retornando linhas afetadas; **0 linhas => releia o codigo existente** (outro request ganhou; idempotente, link distribuido continua valido). `@unique` cobre colisao entre parceiros (retry com novo codigo). **Uma vez gerado, NUNCA regerado.** Gera local (helper proprio); **nao depende do helper da Parte 0** (que nao existe) - se a Parte 0 entregar um util, migra depois.

13. **A comissao nunca derruba o webhook.** O hook roda **dentro** de `processEvent` mas seu erro e **engolido com log de alerta** (try/catch local), nunca propaga. Motivo: a `Subscription` ja foi atualizada; falha no credito nao pode fazer o RevenueCat reenviar e arriscar dupla atualizacao de assinatura. Credito perdido e recuperado pelo **job de reconciliacao** (Regra 14).

14. **Recuperacao de credito perdido (job de reconciliacao - fecha o buraco da Regra 13).** O dedupe do webhook grava o `WebhookEvent` como **PROCESSED** mesmo quando o hook de comissao falhou (Research #1); a reentrega do mesmo `event.id` cai em DUPLICATED e **nao re-roda o hook**. Logo a recuperacao **NAO** reprocessa o webhook (nao refaz `upsertSubscription` - perigoso). Em vez disso, um **cron (admin)** roda periodicamente (sugestao: a cada 1h):
   - **Query com janela de lookback (Research #18):** seleciona `WebhookEvent` com `status=PROCESSED`, `type IN ('INITIAL_PURCHASE','RENEWAL','PRODUCT_CHANGE')`, **`receivedAt >= now() - RECONCILE_LOOKBACK` (default 7 dias, cobre a janela de falha + folga)**, cujo `eventId` **nao** tem `ParceiroTransacao(refEvento=eventId)` correspondente (anti-join). A janela usa o indice `receivedAt` existente para nao virar seq scan crescente; eventos mais antigos que o lookback **nao** sao recuperados pelo cron (assume-se que as reentregas do RevenueCat ja teriam ocorrido). Indice composto opcional `(gateway, type, status, receivedAt)` se o volume crescer.
   - Para cada um, **le `WebhookEvent.payload` (Json salvo)** para reconstruir `app_user_id`/`product_id`/`period_type`/`purchased_at_ms`/`event.id`/`price`/`currency`. **Se o payload salvo nao tiver `event.id` real, `period_type`, `purchased_at_ms` ou `app_user_id`** (campos `@IsOptional` podem nao ter vindo - Research #6/#9): loga `[Comissao][RECONCILE][SKIP] reason=payload_incompleto eventId=...` e **NAO credita** (mesma postura conservadora do hook ao vivo). Senao reavalia as pre-condicoes da Regra 6 e chama `creditarComissao(...)` **diretamente** (idempotente por `refEvento` - se foi creditado nesse meio-tempo, `P2002` => no-op).
   - So considera eventos pagos atribuidos (filtra por `period_type=NORMAL` e payload com `app_user_id` cujo usuario tem `referidoPorParceiroId`).
   - Reporta drift; nao toca `Subscription`. Idempotente e seguro re-rodar. Nunca lanca para fora (um payload ruim de um evento nao quebra o job inteiro).

15. **Janela de 18 meses (precisa, sem ambiguidade de relogio/borda).** Instante de avaliacao = **`purchased_at_ms` do evento** (nao `now()` do servidor). Janela valida: `dataEvento <= addMonths(primeiraConversaoEm, 18)` usando `addMonths` de `date-fns` (calendario, **nao** `547 dias`), que trata overflow de dia (ex.: 31 ago + N meses -> ultimo dia valido). **Borda inclusiva:** o evento no ultimo instante do mes 18 **credita**; 1ms depois **nao**. Sem `primeiraConversaoEm` ainda (primeiro pago): a janela comeca neste evento.

15a. **`purchased_at_ms` ausente num evento que creditaria (fallback documentado).** `purchased_at_ms` e `@IsOptional` no DTO (Research #6) e pode nao vir. Num evento que passou todas as outras pre-condicoes (incl. `event.id` real e `period_type=NORMAL`) **mas sem `purchased_at_ms`**: usar `now()` do servidor como ancora da janela e do `primeiraConversaoEm`, com log `[Comissao][CREDIT] warn=no_purchased_at_ms fallback=now`. O credito acontece (ja temos `event.id` real para idempotencia); apenas a ancora de tempo degrada para `now()`. Nao confundir com Regra 6e (sem `event.id` => nunca credita).

16. **Travas anti-fraude desta onda (D15/D16: hold + limite leve de conversoes; saldo negativo).**
   - **(a) Hold de janela de chargeback (sacavel derivado).** O `CREDITO_COMISSAO` entra no ledger (conta no `saldoTotalCentavos`) mas **so fica sacavel apos N dias** (`COMISSAO_HOLD_DIAS`, default **14** - D16; **hold unico, sem diferenciacao por store** nesta onda). **Saldo sacavel** = `saldoTotalCentavos - SUM(CREDITO_COMISSAO WHERE createdAt > now - HOLD_DIAS)`, computado **on-the-fly** (sob o lock do saque - Regra 10a). `POST /saques` valida contra o **sacavel**, nunca contra o total materializado. Cobre a janela tipica de reembolso antes de liberar saque.
   - **(b) Bloqueio de liquidacao com saldo negativo:** ver Regra 16e.
   - **(c) Anti-laranja avancado (rede/IP/dispositivo) fica em camada futura.** Detec. de contas-laranja por sinal de rede (mesmo IP/dispositivo) **nao** e travada nesta onda. Risco residual de farming por sinal de rede explicitamente aceito e documentado.
   - **(d) Limite leve de N conversoes/parceiro/janela antes de revisao admin (D15, desta onda).** Conta `CREDITO_COMISSAO` distintos (por `usuarioIndicadoId` distinto, evento `INITIAL_PURCHASE`/`RENEWAL` de primeira conversao) por parceiro numa janela movel (`ANTILARANJA_JANELA_DIAS`, default 30). Ao exceder `ANTILARANJA_MAX_CONVERSOES` (default 20), seta `ParceiroCarteira.emRevisaoAntifraude = true` e loga `[Comissao][ANTILARANJA] parceiroId=... conversoes=...`. **Nao bloqueia o credito** (o credito entra normalmente no ledger); **segura o saque** (`POST /saques` => `403 SAQUE_BLOQUEADO_REVISAO`) ate o admin revisar e liberar via `POST /admin/parceiro/:parceiroId/carteira/revisao`. A contagem usa o indice `(parceiroId, tipo, createdAt)`.
   - **(e) Politica de saldo negativo persistente (RESOLVIDA por D16: sem write-off automatico).** Clawback (Regra 7) ou AJUSTE negativo (Regra 19) podem deixar `saldoTotalCentavos < 0`, possivelmente sem creditos futuros imediatos para compensar (reembolso de loja chega tarde - Apple ~90 dias - depois do hold de 14 dias). **Nesta onda NAO ha write-off automatico:** a divida **persiste** como saldo negativo e e **abatida de comissoes futuras** (compensacao por creditos futuros). Enquanto `saldoTotalCentavos < 0`: (i) `POST /saques` => `400 SAQUE_BLOQUEADO_SALDO_NEGATIVO`; (ii) admin **nao** marca PAGO (bloqueio na rota `/pagar`); (iii) creditos futuros compensam automaticamente (o `SUM` ja faz isso, o saldo sobe sozinho ate quitar a divida). **Sem baixa automatica** apos N dias (D16). Eventual write-off manual extraordinario, se necessario, e via AJUSTE de admin com trilha (Regra 19), nunca automatico.

17. **Throttle das rotas publicas por codigo (D15).** A unica superficie "publica por codigo" desta parte e o lookup de `codigoIndicacao` no `POST /usuario` (signup). O throttler atual e **in-memory** (Research #19), nao cross-instancia no Railway. Requisito D15 (no DoD): **Redis no throttler OU lockout por codigo** nessa rota. Nesta parte, como o lookup e best-effort e nao confirma existencia do codigo (atribuicao null silenciosa - Regra 2, anti-enumeracao), o risco e baixo; ainda assim o signup ja e rate-limited pelo gateway e, se a Parte 0/1 entregar o throttler com Redis, esta rota o herda. Sem Redis, aplicar lockout leve por `codigoIndicacao` repetido (contagem por codigo) para nao virar oraculo de enumeracao.

18. **Lookup de parceiro no signup e best-effort (nao derruba o cadastro).** O lookup do parceiro por `codigoIndicacao` (que exige `statusAuditoria=APROVADO`) e uma query **separada antes** do `prisma.usuario.create` (Research #14). **Qualquer** resultado nao-feliz - codigo invalido, parceiro nao-aprovado, **OU erro transitorio do DB no lookup** - resolve para `referidoPorParceiroId = null` e o signup **segue** (com log). So **nao** se engole erro do `create` principal (esse propaga normalmente). Isso garante "codigo errado nao quebra cadastro" mesmo quando a falha e do banco, nao do codigo.

19. **Guard-rails do AJUSTE manual de admin.** `AjusteDto`: `valorCentavos` `@IsInt` e `!= 0`; `motivo` **obrigatorio** (`@IsString @IsNotEmpty`); sanity-check de faixa `Math.abs(valorCentavos) <= AJUSTE_MAX_CENTAVOS` (env, default `1000000` = R$10.000) - acima disso, `400` (evita inflar/zerar a carteira por engano). Cada AJUSTE grava trilha de auditoria com `adminId` (log `[Carteira][AJUSTE] parceiroId=... adminId=... valorCentavos=... motivo=...`) e `refEvento="ajuste:<cuid>"` (unico). Um AJUSTE negativo **pode** deixar `saldoTotalCentavos < 0` (correcao deliberada); o saldo negativo entao bloqueia saque/liquidacao (Regra 16e). Aprovacao dupla de admin **fica em aberto** (Perguntas) - nesta onda 1 admin basta, com trilha.

---

## Autorizacao / BOLA (por rota)

> Reusa os asserts da Parte 3 (`assertParceiroMembership`/`assertParceiroDono` - **pre-condicao**, nao existem hoje). **Nenhum** `parceiroId` vindo do cliente e usado sem assert. PII do tutor indicado **nunca** sai nas respostas do parceiro.

| Rota | Papel | Assert |
|---|---|---|
| `POST /usuario` (signup) | publico | N/A. Lookup de `codigoIndicacao` por **codigo publico**: parceiro nao-aprovado/inexistente/erro de lookup => atribuicao null. Falha silenciosa (anti-enumeracao); nunca 4xx que confirme o codigo. |
| `GET /parceiro/portal/indicacao` | membership | `assertParceiroMembership(parceiroId, userId)` (Parte 3). |
| `GET /parceiro/portal/carteira` | membership | `assertParceiroMembership` (Parte 3). |
| `GET /parceiro/portal/carteira/extrato` | membership | `assertParceiroMembership` (Parte 3). Filtrado por `parceiroId` validado; allow-list sem PII. |
| `PATCH /parceiro/portal/carteira/pix` | DONO | `assertParceiroDono(parceiroId, userId)` (Parte 3). |
| `POST /parceiro/portal/saques` | DONO | `assertParceiroDono` (Parte 3). |
| `GET /parceiro/portal/saques` | membership | `assertParceiroMembership` (Parte 3). Lista filtrada por `parceiroId` validado. |
| `GET /parceiro/portal/saques/:id` | membership | **`assertSaqueOwnership(saqueId, userId, isAdmin)` (NOVO, OBRIGATORIO).** Caminho `ParceiroSaque -> Parceiro -> ParceiroEquipe(usuarioId)`. 403 se nao membro. |
| `GET /admin/parceiro/saques` | admin | `SystemAdminGuard` (existente). |
| `POST /admin/parceiro/saques/:id/pagar` | admin | `SystemAdminGuard` + `assertSaqueExiste(saqueId)` (404 se inexistente; admin ve tudo). |
| `POST /admin/parceiro/saques/:id/falhar` | admin | `SystemAdminGuard` + `assertSaqueExiste(saqueId)`. |
| `POST /admin/parceiro/:parceiroId/carteira/ajuste` | admin | `SystemAdminGuard` (admin opera qualquer parceiro). |
| `POST /admin/parceiro/:parceiroId/carteira/revisao` | admin | `SystemAdminGuard`. |

- **403 vs 404 (D14):** rota autenticada acessando recurso de outro parceiro => **403** (via `assertParceiro*`/`assertSaqueOwnership`). Lookup de `codigoIndicacao` (codigo publico) no signup => atribuicao null sem vazar existencia, nunca 403/404 que confirme o codigo.
- **`assertSaqueOwnership` e OBRIGATORIO** (nao opcional) para qualquer rota de saque parceiro-scoped. Ganha spec dedicado (happy + ator errado 403 + admin bypass).

---

## Riscos e Mitigacoes

| Sev | Risco | Mitigacao |
|---|---|---|
| Alta | **Fundacao (Partes 0-3) NAO implementada** - esta parte assume artefatos inexistentes | "Estado real da fundacao": Parte 4 BLOQUEADA por Parte 3 implementada. **T0 reconcilia o contrato de schema** (colunas `codigoIndicacao` e `comissaoPercentual` da Parte 3; sem `comissaoAcumuladaCentavos` em design nenhum). Idealmente Parte 3 e 4 revisadas juntas. |
| Alta | **Contradicao de schema Parte 3 vs Parte 4** (comissao/codigo) | **Resolvido** (D15 + D16 + "Contrato de schema Parte 3 <-> Parte 4"): `codigoIndicacao` e `comissaoPercentual` = colunas da Parte 3, valor gerado/lido aqui (sem recriar coluna -> sem conflito de migration); bruto = derivado do ledger (sem `comissaoAcumuladaCentavos`). |
| Alta | **Credito duplicado** do mesmo evento (reentrega/race) | Dupla defesa: dedupe do webhook por `eventId` + `refEvento @unique`. Insert em try/catch; `P2002` => no-op. PRODUCT_CHANGE no mesmo ciclo coberto pela Regra 5a. |
| Alta | **Comissao derruba o webhook** | Hook com try/catch local (Regra 13). Lookup de parceiro no signup tambem best-effort (Regra 18). |
| Alta | **Credito perdido em falha transitoria** (evento ja PROCESSED, reentrega cai em DUPLICATED, hook nao re-roda) | **Job de reconciliacao** (Regra 14): anti-join `WebhookEvent PROCESSED` x `ParceiroTransacao` **com janela de lookback** (indice `receivedAt`), le payload salvo (SKIP se incompleto), credita direto via `creditarComissao` (idempotente). Sem reprocessar webhook. |
| Alta | **`refEvento` null/'' para evento pago sem `event.id`** | Evento pago sem `event.id` real NAO credita (Regra 6e). `refEvento` jamais recebe ''. AC explicito (AC5b). |
| Alta | **Base da comissao mensal nao carregada no webhook** (`Plano.preco` ausente) | NFR: hook faz +1 query `Plano(preco)` pelo `produtoPlanoId` do proprio evento. Snapshot em `baseCentavos`. Anual nao usa +1 query (base vem do evento). |
| Alta | **Percentual hardcodado no callsite** (ignora negociacao por parceiro - D16) | Regra 4: `parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT`, **nunca** `5` literal no calculo. Percentual efetivo gravado em `percentualSnapshot`. AC4 valida o default; AC4b valida o percentual por parceiro. |
| Alta | **Double-spend de saque concorrente** | Debito atomico com `SELECT ... FOR UPDATE` da carteira + recomputo do sacavel sob lock (Regra 10a). AC + integration de concorrencia. |
| Alta | **Clawback sobre gatilho indefinido + estorno do ciclo errado** | **Gatilho RESOLVIDO (D15):** `CANCELLATION`/`cancel_reason=CUSTOMER_SUPPORT`. So esse estorna. Correlacao deterministica por `transactionRef`; sem fallback "ultimo credito" - orfao vira revisao manual (Regra 7). Requer estender DTO (T4b). |
| Media | **Base anual** | **RESOLVIDA (D15):** `event.price_in_purchased_currency` real, snapshot com moeda; guarda `currency==BRL`. `COMISSAO_ANUAL_ENABLED` vira kill-switch (nao bloqueio de decisao). `*12`/`precoAnual` proibidos. |
| Media | **Anual creditado em moeda errada** (`price` em USD) | Usar `price_in_purchased_currency` (nao `price`); gravar `currency`; SKIP se `currency!=BRL` ou preco ausente (Regra 4/11). |
| Media | **Reconciliacao cara** (seq scan crescente em `WebhookEvent` sem indice de status/type) | Janela de `receivedAt >= now - RECONCILE_LOOKBACK` (indice existente) + indice composto opcional. Eventos > lookback nao recuperados (assumido). (Research #18, Regra 14). |
| Media | **Payload salvo sem campos necessarios** para reconciliar | Job SKIP `payload_incompleto` se faltar `event.id`/`period_type`/`purchased_at_ms`/`app_user_id`; nao credita e nao quebra (Regra 14, AC25b). |
| Media | **PRODUCT_CHANGE super-credita** (2 creditos no mesmo ciclo / troca sem cobranca) | Regra 5a: so credita com `transaction_id` novo distinto do ultimo credito do ciclo; downgrade nao estorna. AC9b. |
| Media | **Saldo negativo apos clawback pos-saque** (D16: sem write-off automatico) | Hold de chargeback (Regra 16a, **14 dias**) + bloqueio de saque/liquidacao com saldo<0 (Regra 16e) + **compensacao por creditos futuros (divida persiste, abatida dos proximos creditos)** + alerta. **Sem baixa automatica** (D16); write-off so via AJUSTE manual extraordinario com trilha. |
| Media | **Auto-indicacao / contas-laranja** | "tutor pagante distinto" + hold (16a) + **limite leve de N conversoes/janela -> revisao admin (16d, D15)**. Anti-laranja por rede fica em camada futura (16c, residuo aceito). |
| Media | **AJUSTE manual sem guard-rails** (admin zera/infla carteira) | Regra 19: motivo obrigatorio, sanity-check de faixa, trilha com `adminId`. AJUSTE negativo pode deixar saldo<0 (deliberado -> bloqueia saque). AC de ajuste credito/debito + invariante. |
| Media | **Lookup de parceiro no signup quebra o cadastro** | Best-effort (Regra 18): qualquer falha do lookup => `null` + segue. So o `create` principal propaga. AC2c. |
| Media | **Throttle in-memory nao cross-instancia (Railway)** | D15: Redis no throttler OU lockout por codigo na rota publica (Regra 17). DoD exige. |
| Media | **Float drift** em dinheiro | Centavos `Int`; `Math.round(base*100)` uma vez antes do percentual. Anual usa preco real do evento (sem `*12`). |
| Baixa | **Corrida na geracao do codigo** (2 devices) | Update condicional `WHERE codigoIndicacao IS NULL`; 0 linhas => relê existente (Regra 12). Nunca regera. Coluna ja existe (Parte 3). |
| Baixa | **`purchased_at_ms` ausente num evento que creditaria** | Fallback `now()` com WARN (Regra 15a); credito acontece (ja ha `event.id` real); so a ancora de tempo degrada. AC7c. |
| Baixa | **Codigo malformado/case no signup perde atribuicao** | Normalizacao trim+uppercase no DTO (Regra 2). AC de equivalencia de caixa/espaco. |
| Baixa | **Catalogo i18n de erro (Parte 0) ausente** | Fallback pt-BR fixo; migracao centralizada quando o catalogo existir. Mensagens novas sem em-dash. |

---

## Requisitos Nao-Funcionais

- **Latencia do webhook:** o hook adiciona **+1 leitura de `Plano(preco)`** pelo `produtoPlanoId` do evento **so para o mensal** + a leitura de `Parceiro.comissaoPercentual` (D16, no mesmo select do parceiro ja resolvido via `referidoPorParceiroId` - sem query dedicada adicional) (a atribuicao `usuario.referidoPorParceiroId` ja vem - 0 query; o anual le a base do proprio evento - 0 query) + 1 transacao curta (upsert carteira + insert ledger + saldo). `select` minimalista (`{ preco: true }` para `Plano`; `{ comissaoPercentual: true, statusAuditoria: true }` para `Parceiro`). Erro do hook nunca bloqueia a resposta 200 ao RevenueCat.
- **Consistencia:** ledger + saldo sempre na mesma `$transaction`. Idempotencia por `refEvento @unique`. Saque com lock pessimista (Regra 10a). Recuperacao por job (Regra 14).
- **Dinheiro:** centavos `Int` em todo o sistema. Nenhuma operacao monetaria em `Float` (apos `Math.round(base*100)` no ponto de calculo). O percentual e `Float` (5.0) so como multiplicador antes do `Math.round`.
- **Privacidade:** respostas do parceiro nunca contem PII do tutor indicado nem campos correlacionaveis (`usuarioIndicadoId`/`subscriptionId`/`transactionRef`/`baseMoeda`/`percentualSnapshot` so no banco; allow-list estrita no extrato). Logs sem PII (hash/redact `usuarioIndicadoId`).
- **Seguranca:** `security-auditor` obrigatorio. DoD exige zero finding sev >= media.
- **Throttle (D14/D15):** rotas publicas (lookup de codigo) cross-instancia exigem Redis no throttler OU lockout por codigo (Regra 17); signup ja e rate-limited pelo gateway.

---

## Acceptance Criteria

**Atribuicao**
- [ ] AC1 - Signup com `codigoIndicacao` de parceiro APROVADO => `Usuario.referidoPorParceiroId` = id do parceiro.
- [ ] AC2 - Signup com `codigoIndicacao` inexistente ou de parceiro nao-APROVADO => cadastro completa com `referidoPorParceiroId = null` e **sem** erro 4xx.
- [ ] AC2b - Signup com `codigoIndicacao` em caixa/espaco diferentes mas equivalente (`' pj-ab12cd '`) => **ainda atribui** (normalizacao trim+uppercase).
- [ ] AC2c - **Erro transitorio do DB no lookup de parceiro** (lookup lanca) => signup **NAO** quebra: `referidoPorParceiroId = null` + log; `POST /usuario` retorna 201 (Regra 18).
- [ ] AC3 - Usuario ja atribuido => `referidoPorParceiroId` nao muda (imutavel) em qualquer fluxo posterior.

**Comissao via webhook (idempotente)**
- [ ] AC4 - Tutor atribuido a parceiro **com `comissaoPercentual = null`** sem `primeiraConversaoEm`, webhook `INITIAL_PURCHASE` mensal com `period_type=NORMAL` => cria `CREDITO_COMISSAO` com `valorCentavos = Math.round(Math.round(Plano.preco*100) * COMISSAO_PADRAO_PCT/100)`, `percentualSnapshot = COMISSAO_PADRAO_PCT` (5.0), grava `primeiraConversaoEm = purchased_at_ms`, `saldoTotalCentavos += valor`.
- [ ] AC4b - **(D16)** Tutor atribuido a parceiro **com `comissaoPercentual = 8.0`**, `INITIAL_PURCHASE` mensal NORMAL => credito usa **8%** (`percentualEfetivo = parceiro.comissaoPercentual`), `percentualSnapshot = 8.0`; **nunca** 5%.
- [ ] AC5 - Mesmo `INITIAL_PURCHASE` reentregue (mesmo `event.id`) => DUPLICATED, **nenhuma** transacao nova. Segunda defesa: mesmo `refEvento` => `P2002` => no-op.
- [ ] AC5b - Evento **pago sem `event.id`** real => **nenhum credito**, log `SKIP reason=no_event_id`, **nenhuma** linha de ledger (e `refEvento` nunca recebe '').
- [ ] AC6 - Tutor atribuido mensal dentro dos 18 meses, `RENEWAL` NORMAL => 1 credito novo por renovacao.
- [ ] AC6b - Evento com `period_type=TRIAL` (ou `INTRO`) => **nunca credita e nunca ancora `primeiraConversaoEm`**.
- [ ] AC7 - `primeiraConversaoEm` ha > 18 meses (avaliado por `purchased_at_ms`), `RENEWAL` => **nenhum** credito.
- [ ] AC7b - **Borda exata:** evento no ultimo instante do mes 18 credita; evento 1ms depois nao.
- [ ] AC7c - Evento pago atribuido com `event.id` real **mas sem `purchased_at_ms`** => credita usando `now()` como ancora, log `warn=no_purchased_at_ms` (Regra 15a).
- [ ] AC8 - *(gated por kill-switch `COMISSAO_ANUAL_ENABLED`; a base ja esta decidida por D15)* Tutor atribuido anual NORMAL dentro da janela, `currency=BRL` e `price_in_purchased_currency>0` => 1 credito = `Math.round(price_in_purchased_currency*100) * percentualEfetivo/100`, `baseMoeda='BRL'`.
- [ ] AC8b - Evento anual com `currency != BRL` **ou** `price_in_purchased_currency` ausente/<=0 => **nao credita**, log `SKIP reason=anual_moeda_ou_preco_invalido`.
- [ ] AC9 - `PRODUCT_CHANGE` para plano de maior valor **com `transaction_id` novo** => credita usando `Plano.preco` do **produto do proprio evento** (deterministico).
- [ ] AC9b - `PRODUCT_CHANGE` cujo `transaction_id` **igual** ao do ultimo credito do ciclo (sem cobranca nova) => **nenhum** credito novo (Regra 5a); downgrade nao estorna.
- [ ] AC10 - Sem atribuicao OU parceiro nao-APROVADO OU `period_type!=NORMAL` => **nenhum** credito e **nenhuma** falha do webhook.
- [ ] AC10b - Hook lanca erro interno (DB do ledger fora) => evento **nao** falha (200 ao RevenueCat), log `[Comissao][ERROR]`; **job de reconciliacao** recupera o credito depois (AC25).

**Clawback** *(gatilho RESOLVIDO por D15; gated por kill-switch `COMISSAO_CLAWBACK_ENABLED` ate o DTO ser estendido - T4b)*
- [ ] AC11 - `CANCELLATION` com `cancel_reason='CUSTOMER_SUPPORT'` atribuido, `transactionRef` casando um `CREDITO_COMISSAO` => cria `ESTORNO(-valorDaqueleCredito, origem=REFUND)` e `saldoTotalCentavos -= valor` (estorna **exatamente** o ciclo reembolsado).
- [ ] AC11b - `CANCELLATION`/`CUSTOMER_SUPPORT` cujo `transactionRef` **nao** casa nenhum credito => **nao estorna**, log `[Comissao][CLAWBACK][ORPHAN]` para revisao manual.
- [ ] AC11c - `CANCELLATION` com `cancel_reason != 'CUSTOMER_SUPPORT'` (`UNSUBSCRIBE`, `BILLING_ERROR`, etc.) => **NAO estorna** (so para a recorrencia).
- [ ] AC12 - `CANCELLATION` sem reembolso (qualquer `cancel_reason` que nao `CUSTOMER_SUPPORT`) => **nenhum** estorno.

**Carteira / Ledger**
- [ ] AC13 - Parceiro com N transacoes, `GET /carteira` => `saldoTotalCentavos == SUM(ParceiroTransacao.valorCentavos)` (reconciliavel).
- [ ] AC13b - Apos credito + saque + falha-de-saque + ajuste juntos, a invariante de AC13 se mantem; o "bruto" derivado (`SUM(CREDITO_COMISSAO)`) **diverge** do saldo (esperado; nao ha coluna denormalizada).
- [ ] AC13c - `saldoSacavelCentavos` retornado por `GET /carteira` desconta creditos em hold (`createdAt > now - HOLD_DIAS`, **14 dias**); credito recem-criado entra no total mas **nao** no sacavel.
- [ ] AC14 - Outro parceiro, `GET /carteira?parceiroId=<terceiro>` => **403**.
- [ ] AC15 - `GET /extrato` => itens contem **apenas** `id/tipo/valorCentavos/periodicidade/origem/createdAt`; **nunca** `email/nome/cpf/usuarioIndicadoId/subscriptionId/transactionRef/baseCentavos/baseMoeda/percentualSnapshot` (allow-list estrita).
- [ ] AC15b - **BOLA de saque:** parceiro A `GET /saques?parceiroId=B` ou `GET /saques/:idDeB` => **403** (`assertSaqueOwnership`).

**Saque**
- [ ] AC16 - Saldo sacavel R$120 e PIX cadastrado, `POST /saques { 5000 }` => `ParceiroSaque(PENDENTE)`, `DEBITO_SAQUE(-5000)`, saldo total R$70.
- [ ] AC16b - Credito ainda em **hold** (Regra 16a, 14 dias) nao conta como sacavel: saque que so teria saldo via credito em hold => `400 SALDO_INSUFICIENTE`.
- [ ] AC16c - **Concorrencia:** dois `POST /saques` simultaneos do mesmo parceiro com sacavel para apenas um => **no maximo 1** passa (lock pessimista, Regra 10a); o outro => `400 SALDO_INSUFICIENTE`. (integration)
- [ ] AC16d - Parceiro `emRevisaoAntifraude=true`, `POST /saques` => `403 SAQUE_BLOQUEADO_REVISAO`; admin libera via `/carteira/revisao` => saque passa.
- [ ] AC16e - `saldoTotalCentavos < 0`, `POST /saques` => `400 SAQUE_BLOQUEADO_SALDO_NEGATIVO`; admin `/pagar` em saque desse parceiro => bloqueado. **(D16) Credito futuro abate a divida:** apos novo `CREDITO_COMISSAO` que zera/positiva o saldo, o saque volta a ser permitido (sem write-off automatico).
- [ ] AC17 - Saldo sacavel R$30, `POST /saques { 5000 }` => **400 SALDO_INSUFICIENTE**, nenhuma transacao.
- [ ] AC18 - `valorCentavos < 5000` => **400 VALOR_ABAIXO_MINIMO**.
- [ ] AC19 - Sem chave PIX => **400 PIX_NAO_CADASTRADO**.
- [ ] AC20 - OPERADOR (nao DONO), `POST /saques` => **403** (`assertParceiroDono`).
- [ ] AC21 - Saque PENDENTE, admin `POST /.../pagar` (saldo >= 0) => `PAGO`, grava `liquidadoPorId/liquidadoEm/comprovante?`, saldo inalterado.
- [ ] AC21b - `POST /.../falhar` **sem** `motivoFalha` => **400** (obrigatorio).
- [ ] AC22 - Saque PENDENTE, admin `POST /.../falhar` com motivo => `FALHA`, `ESTORNO(+valor)`, saldo volta. Reexecutar => no-op.

**Ajuste / Anti-laranja (admin)**
- [ ] AC22b - `POST /admin/.../carteira/ajuste { +1000, motivo }` => `AJUSTE(+1000)`, `saldoTotalCentavos += 1000`, invariante da Regra 8 mantida; trilha com `adminId`.
- [ ] AC22c - `POST /admin/.../carteira/ajuste { -valor, motivo }` que leva saldo < 0 => aplicado (deliberado); subsequente `POST /saques` => `400 SAQUE_BLOQUEADO_SALDO_NEGATIVO`.
- [ ] AC22d - AJUSTE sem `motivo` **ou** `|valorCentavos| > AJUSTE_MAX_CENTAVOS` **ou** `valorCentavos == 0` => **400** (Regra 19).
- [ ] AC22e - Parceiro excede `ANTILARANJA_MAX_CONVERSOES` na janela => `emRevisaoAntifraude` vira true e proximo `POST /saques` => `403 SAQUE_BLOQUEADO_REVISAO` (Regra 16d); creditos continuam entrando no ledger.

**Indicacao**
- [ ] AC23 - Parceiro APROVADO sem codigo (coluna null, da Parte 3), `GET /indicacao` => gera `codigoIndicacao` unico (formato `PJ-XXXXXX`), retorna QR (data URL) e link com `PARCEIRO_INDICACAO_BASE_URL`.
- [ ] AC23b - Duas chamadas concorrentes de `GET /indicacao` do mesmo parceiro => **um unico** codigo (update condicional `WHERE codigoIndicacao IS NULL`); nunca regera.

**Reconciliacao**
- [ ] AC25 - `WebhookEvent PROCESSED` (dentro do lookback) de tipo pago atribuido **sem** `ParceiroTransacao(refEvento=eventId)` => job credita via `creditarComissao` lendo o payload salvo; re-rodar o job => no-op (idempotente).
- [ ] AC25b - `WebhookEvent PROCESSED` com **payload incompleto** (sem `event.id`/`period_type`/`purchased_at_ms`/`app_user_id`) => job **nao credita**, log `RECONCILE SKIP reason=payload_incompleto`, **nao quebra** o job.
- [ ] AC25c - Evento PROCESSED **mais antigo que `RECONCILE_LOOKBACK`** => **fora** da janela do job (nao recuperado), documentado.

**Schema/Migration**
- [ ] AC24 - Migration 100% aditiva (`prisma migrate status` limpo); nenhum shape/rota existente quebra; valores monetarios `Int` em todas as colunas novas; **`codigoIndicacao` e `comissaoPercentual` NAO recriadas** (colunas da Parte 3); **nenhuma coluna `comissaoAcumuladaCentavos`** em `Parceiro`.

---

## Estrategia de Testes

**Unit (`*.spec.ts`, mock Prisma OK)**
- `comissao.service.spec.ts` (novo): `computeComissaoIndicacao` (**percentual efetivo via `parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` - default 5% E percentual por parceiro (ex.: 8%); nunca 5% hardcodado**; arredondamento em centavos; **base mensal de `Plano.preco`**, **base anual de `event.price_in_purchased_currency` com guarda de moeda BRL**); janela de 18 meses via `purchased_at_ms` (dentro/fora/**borda exata** addMonths/overflow de dia; **fallback `now()` sem `purchased_at_ms`**); pre-condicoes (sem atribuicao, parceiro nao-aprovado, `period_type=TRIAL`, sem `event.id`) => null; **PRODUCT_CHANGE sem `transaction_id` novo => null** (Regra 5a).
- `carteira.service.spec.ts` (novo): saque happy; `SALDO_INSUFICIENTE` (inclui credito em hold nao-sacavel, **HOLD_DIAS=14**); **sacavel = total - hold**; `VALOR_ABAIXO_MINIMO`; `PIX_NAO_CADASTRADO`; **`SAQUE_BLOQUEADO_REVISAO`** (16d); **`SAQUE_BLOQUEADO_SALDO_NEGATIVO`** (16e) **+ credito futuro abate a divida e libera saque (D16)**; falha de saque estorna; `motivoFalha` obrigatorio; idempotencia de pagar/falhar; **AJUSTE guard-rails** (motivo obrigatorio, faixa, valor zero) (Regra 19).
- `webhook.service.spec.ts` (estender): hook credita em INITIAL_PURCHASE/RENEWAL/PRODUCT_CHANGE NORMAL **com o percentual efetivo do parceiro**; **nao** credita sem atribuicao/fora da janela/TRIAL/sem event.id; **engole** erro sem derrubar o evento; **clawback so em `cancel_reason=CUSTOMER_SUPPORT`** por `transactionRef`; orfao nao estorna; `CANCELLATION` com outro `cancel_reason` nao estorna.
- `reconciliacao.service.spec.ts` (novo): anti-join (dentro do lookback) encontra evento sem credito; credita via `creditarComissao`; **payload incompleto => SKIP sem quebrar**; re-rodar = no-op.
- `ownership.service.spec.ts` (estender): `assertSaqueOwnership` happy + ator errado (403) + admin bypass.
- DTO: `SolicitarSaqueDto` (`@IsInt @Min(5000)`); `FalharSaqueDto` (`motivoFalha @IsNotEmpty`); `AjusteDto` (`motivo @IsNotEmpty`, `valorCentavos != 0`, faixa); `codigoIndicacao` no `CreateUsuarioDto` (`@IsOptional @MaxLength` + transform trim/uppercase). **DTO do webhook estendido com `cancel_reason?` (`@IsOptional @IsString`).**

**Integration (`*.integration.spec.ts`, Postgres real - sem mock de banco)**
- Idempotencia real: dois inserts com mesmo `refEvento` => 1 linha (`@unique`).
- Reconciliacao de invariante: `saldoTotalCentavos == SUM(valorCentavos)` apos credito + saque + falha + ajuste; bruto derivado diverge (esperado).
- **Concorrencia de saque:** 2 `POST /saques` simultaneos com sacavel para um => no maximo 1 passa (lock pessimista, Regra 10a).
- Geracao concorrente de codigo: 2 updates condicionais => 1 codigo.
- BOLA: parceiro A nao ve carteira/extrato/saque (lista e detalhe) de B (403).
- Job de reconciliacao: evento PROCESSED (no lookback) sem credito => credito gerado; payload incompleto => SKIP; re-rodar = no-op.
- **Saldo negativo (D16):** clawback pos-saque deixa saldo < 0; saque/liquidacao bloqueados; novo credito abate a divida e libera (sem write-off automatico).

**Smoke (`scripts/`)**
- `scripts/smoke-comissao-indicacao.ts`: signup com codigo -> simula `INITIAL_PURCHASE` NORMAL mensal (HTTP no webhook) -> confere credito (com percentual efetivo do parceiro) -> reentrega o mesmo evento -> confere que nao duplica -> simula `CANCELLATION`/`CUSTOMER_SUPPORT` -> confere estorno -> solicita saque (apos hold de 14 dias) -> admin paga. End-to-end contra DB real.

---

## Consumidores (mobile/CMS)

Mudancas de contrato sao 100% aditivas (nenhum shape existente muda), **mas ha trabalho de front nao trivial alem de "campos novos"**:

- **`petjourney-app` (atribuicao cross-sessao):** o app precisa **capturar o `codigoIndicacao` do deep-link/QR e persisti-lo localmente** ate o `POST /usuario`, que pode ocorrer **dias depois** de abrir o link (abrir link != cadastrar). Requer storage local com TTL/limpeza. **Confirmar com o repo de front que a captura cross-sessao esta no escopo deles** (Perguntas 6). Tambem ganha as rotas de carteira/indicacao/saque.
- **`petjourney-cms`:** telas admin de fila de saque, liquidacao (PAGO com `comprovante` opcional, **bloqueada se saldo<0**), falha (`motivoFalha` **obrigatorio**), ajuste manual (motivo obrigatorio, faixa), **liberacao de revisao anti-laranja** e **edicao de `comissaoPercentual` por parceiro (D16, na tela de parceiro da Parte 3)**. Contrato dos campos admin documentado acima (Contrato dos Endpoints / Admin).
- **Mudanca de comportamento do signup:** passa a aceitar `codigoIndicacao` (e ignorar silenciosamente se invalido/erro de lookup - Regra 2/18). Nenhum erro novo no signup.

---

## Arquivos Impactados

| Arquivo | Acao | Motivo |
|---|---|---|
| `prisma/schema.prisma` | Modificar | 4 enums; `Usuario.referidoPorParceiroId`/`primeiraConversaoEm`; relacoes reversas em `Parceiro` (**sem coluna nova; `codigoIndicacao` e `comissaoPercentual` vem da Parte 3; sem `comissaoAcumuladaCentavos`**); tabelas carteira/transacao/saque (`saldoTotalCentavos`, `baseMoeda`, `percentualSnapshot`, `emRevisaoAntifraude`) |
| `prisma/migrations/20260624130000_.../migration.sql` | Criar | Migration aditiva (nao recria `codigoIndicacao`/`comissaoPercentual`; fallback condicional so se Parte 3 ausente) |
| `src/usuario/dto/create-usuario.dto.ts` | Modificar | `codigoIndicacao` opcional + transform trim/uppercase |
| `src/usuario/usuario.service.ts` | Modificar | Lookup best-effort de `referidoPorParceiroId` no `create` (codigo APROVADO; falha silenciosa, incl. erro de DB - Regra 18) |
| `src/webhook/dto/revenuecat-event.dto.ts` | **Modificar** | **Estender com `cancel_reason?: string` (`@IsOptional @IsString`)** para o clawback (D15, T4b) |
| `src/webhook/webhook.service.ts` | Modificar | Hook de comissao apos `upsertSubscription`; +1 query `Plano(preco)` (mensal) + leitura de `Parceiro.comissaoPercentual` (D16); base anual do evento; handling de clawback (`CANCELLATION`/`CUSTOMER_SUPPORT`, sem tocar Subscription); try/catch que engole erro |
| `src/webhook/webhook.module.ts` | Modificar | Importar `ComissaoModule`/`CarteiraModule` |
| `src/comissao/` (e `src/parceiro-carteira/`) | Criar | `comissao.service.ts` (computeComissaoIndicacao com `percentualEfetivo` + creditar/estornar), `carteira.service.ts` (saldo/sacavel/extrato/saque + hold 14d + lock + revisao + saldo negativo), `reconciliacao.service.ts` + cron, controllers portal/admin, DTOs, module, specs; constante `COMISSAO_PADRAO_PCT` |
| `src/auth/services/ownership.service.ts` | Modificar | `assertSaqueOwnership` (obrigatorio) + `assertSaqueExiste` |
| `prisma/seed.ts` | Modificar (opcional) | `codigoIndicacao` nos parceiros seedados (idempotente; mas geracao canonica e lazy via endpoint); `comissaoPercentual` deixado null (= default global) |
| `scripts/smoke-comissao-indicacao.ts` | Criar | Smoke end-to-end |
| `docs/CHANGELOG.md` | Modificar | Entry da Parte 4 |

---

## Tasks Tecnicas

- [ ] **T0 (BLOQUEANTE - reconciliar contrato Parte3/Parte4)** - Confirmar Parte 3 implementada com: schema `Parceiro` evoluido (`cnpj`/`statusAuditoria`/**coluna `codigoIndicacao String? @unique` criada e null**/**coluna `comissaoPercentual Float?` nullable criada e null - D16**), `ParceiroEquipe`, `ParceiroGuard`, `assertParceiroMembership`/`assertParceiroDono`. **Confirmar que NAO ha `comissaoAcumuladaCentavos`** (bruto derivado do ledger). Se `codigoIndicacao` ou `comissaoPercentual` nao existirem, esta parte as adiciona (so essas colunas, aditivas/nullable). Idealmente revisar Parte 3 e 4 juntas.
- [ ] **T1** - Schema Prisma: enums + colunas `Usuario` + relacoes reversas `Parceiro` (sem coluna nova) + tabelas carteira/transacao/saque (`saldoTotalCentavos`/`baseMoeda`/`percentualSnapshot`/`emRevisaoAntifraude`/indices). `prisma migrate status`, migration (sem recriar `codigoIndicacao`/`comissaoPercentual`), `prisma generate`.
- [ ] **T2 (dep: T1)** - `CreateUsuarioDto` (transform trim/uppercase) + `UsuarioService.create`: lookup best-effort de parceiro APROVADO -> gravar `referidoPorParceiroId` (qualquer falha do lookup => null, signup segue - Regra 18). Spec (incl. AC2c erro de DB).
- [ ] **T3 (dep: T1)** - `ComissaoService`: `computeComissaoIndicacao(parceiro, planoOuEvento, periodicidade, dataEvento)` (centavos, **`percentualEfetivo = parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` - nunca 5% hardcodado**, **base mensal `Plano.preco` / base anual `event.price_in_purchased_currency` com guarda BRL**, janela `purchased_at_ms`/addMonths + fallback `now()`, pre-condicoes incl. `period_type`/`event.id`/PRODUCT_CHANGE Regra 5a) + `creditarComissao(...)` (transacao: upsert carteira + insert ledger por `refEvento` com `percentualSnapshot` + `saldoTotalCentavos +=` + `primeiraConversaoEm` lazy + contagem anti-laranja) + `estornarComissao(...)` por `transactionRef`. Constante `COMISSAO_PADRAO_PCT`. Spec.
- [ ] **T4 (dep: T3)** - Hook em `WebhookService.processEvent`: +1 query `Plano(preco)` (mensal) + leitura de `Parceiro.comissaoPercentual` (D16); base anual do evento; chamar `creditarComissao` (INITIAL_PURCHASE/RENEWAL/PRODUCT_CHANGE NORMAL), try/catch que engole + log. Estender webhook spec.
- [ ] **T4b (dep: T4)** - **Estender `RevenueCatEventPayloadDto` com `cancel_reason?: string` (`@IsOptional @IsString`)** e implementar clawback: `CANCELLATION` + `cancel_reason='CUSTOMER_SUPPORT'` => `estornarComissao` por `transactionRef`; outros `cancel_reason` nao estornam (D15). Gated por `COMISSAO_CLAWBACK_ENABLED`. Spec (AC11/11b/11c/12).
- [ ] **T5 (dep: T1)** - `CarteiraService` + controller portal: `GET carteira` (total + **sacavel pos-hold 14d** + flags), `GET extrato` (cursor, allow-list estrita), `PATCH pix`, `POST saques` (**debito atomico com `FOR UPDATE`** + checagens revisao/saldo<0), `GET saques`, `GET saques/:id` (`assertSaqueOwnership`). Specs (BOLA + saque + hold + concorrencia + saldo negativo).
- [ ] **T6 (dep: T5)** - Controller admin: `GET/POST /admin/parceiro/saques/*` (pagar com **bloqueio saldo<0** / falhar com estorno) + `POST /.../carteira/ajuste` (**guard-rails Regra 19**) + `POST /.../carteira/revisao`. `SystemAdminGuard`. Specs.
- [ ] **T7 (dep: T0,T1)** - `GET /parceiro/portal/indicacao`: geracao lazy **anti-corrida** (update condicional sobre a coluna da Parte 3) + QR (data URL) + link via `PARCEIRO_INDICACAO_BASE_URL`. Spec.
- [ ] **T8 (dep: T1)** - `ReconciliacaoService` + cron: anti-join `WebhookEvent` x `ParceiroTransacao` **com janela de lookback** (Regra 14), le payload (SKIP se incompleto), credita via `creditarComissao`. Spec + integration.
- [ ] **T9 (dep: T0)** - Throttle das rotas publicas por codigo (D15): Redis no throttler OU lockout por codigo no lookup do signup (Regra 17). Coordenar com Parte 0/1.
- [ ] **T10 (dep: T2-T9)** - Smoke `scripts/smoke-comissao-indicacao.ts` contra DB real.
- [ ] **T11** - `security-auditor` em todas as rotas novas (DoD: zero finding sev >= media). Swagger. CHANGELOG.

---

## Consideracoes de Arquitetura

- **Contrato unico de `Parceiro` (D15 + D16):** `codigoIndicacao` e coluna da Parte 3 (consumida aqui, nao recriada); `comissaoPercentual` e coluna da Parte 3 (lida aqui via `?? COMISSAO_PADRAO_PCT`, nao recriada); bruto e derivado do ledger. Zero `comissaoAcumuladaCentavos` -> uma unica invariante materializada (Regra 8), sem campo denormalizado para divergir.
- **Percentual configuravel sem deploy (D16):** o percentual mora na coluna `Parceiro.comissaoPercentual` (nullable) com fallback de codigo `COMISSAO_PADRAO_PCT`. O calculo nunca hardcoda 5%; o efetivo e gravado em `percentualSnapshot` por transacao (auditoria/recalculo). Negociacao comercial por parceiro vira um `UPDATE` na coluna, sem release.
- **Idempotencia em camadas + recuperacao:** webhook deduplica por `eventId` (camada 1); `refEvento @unique` no ledger e camada 2 (race/reentrega); **job de reconciliacao** (Regra 14) e a camada 3 (falha transitoria do hook - o evento ja foi PROCESSED e a reentrega cai em DUPLICATED, entao reprocessar o webhook nao recupera; o job credita direto, idempotente, dentro de uma janela de lookback).
- **Hook nao-bloqueante:** a comissao e efeito **lateral** do evento de billing (D5: webhook nao muda). Erro do hook e engolido; trade-off (credito perdido em falha) coberto pelo job. O lookup de parceiro no signup tambem e best-effort (nao quebra o cadastro - Regra 18).
- **Base canonica deterministica:** mensal = `Plano.preco` lido do `produtoPlanoId` do **proprio evento** (nao do estado pos-swap da Subscription); anual = `event.price_in_purchased_currency` real do evento (D15), com moeda auditada e guarda BRL.
- **Ledger append-only + saldo materializado:** padrao contabil. `saldoTotalCentavos` = cache reconciliavel (unica invariante dura). **Sacavel** = total menos hold, computado on-the-fly (nao materializado) e sob lock no saque.
- **Saque com lock pessimista:** `SELECT ... FOR UPDATE` da carteira serializa saques concorrentes; o sacavel (agregado com hold) e recomputado sob o lock - um `UPDATE` condicional puro nao bastaria por causa do hold.
- **Centavos `Int`:** `Plano.preco` (Float legado) e `event.price_in_purchased_currency` convertidos com `Math.round(base*100)` uma vez. Sem `*12` (amplificaria drift + comercialmente errado).
- **Hold de chargeback (14 dias - D16) + bloqueio de saldo negativo:** travas baratas que tornam "aceitar saldo negativo" sustentavel. **Sem write-off automatico (D16):** a divida persiste e e compensada por creditos futuros; saque/liquidacao ficam bloqueados ate o saldo voltar a >= 0.
- **`codigoIndicacao` lazy anti-corrida:** evita backfill; update condicional sobre a coluna ja existente (Parte 3) garante codigo unico estavel.

---

## Plano de Rollout / Rollback

- **Rollout:** (1) `prisma migrate deploy` (aditivo; nao recria `codigoIndicacao`/`comissaoPercentual`). (2) Deploy da API com o hook atras de flag `COMISSAO_INDICACAO_ENABLED` (default off). Credito anual atras de **kill-switch** `COMISSAO_ANUAL_ENABLED` (default off; **base ja decidida por D15**, liga quando o app validar o fluxo anual). Clawback atras de `COMISSAO_CLAWBACK_ENABLED` (default off; liga apos T4b estender o DTO e validar `cancel_reason`). (3) Smoke em staging contra webhook real. (4) Ligar `COMISSAO_INDICACAO_ENABLED`. (5) Ligar job de reconciliacao (cron) com `RECONCILE_LOOKBACK`. (6) Garantir throttler com Redis ou lockout por codigo (D15) antes de divulgar codigos. (7) Seed/CMS publica codigos. Confirmar `COMISSAO_HOLD_DIAS=14` e `COMISSAO_PADRAO_PCT=5` em config.
- **Rollback:** desligar `COMISSAO_INDICACAO_ENABLED` (para de creditar; rotas de carteira ficam read-only). Reverter deploy remove rotas novas (aditivas). Migration nao precisa rollback (nullable/default; inerte). `referidoPorParceiroId` gravado permanece (inofensivo sem hook).
- **Cuidado:** nao reverter so o `refEvento @unique` sem desligar o hook (perderia anti-duplicata). Nao reverter as colunas `codigoIndicacao`/`comissaoPercentual` (sao da Parte 3).

---

## Observabilidade

- **Logs estruturados (sem PII):** `[Comissao][CREDIT] eventId=... parceiroId=... usuarioIndicadoId=<hash> valorCentavos=... percentual=... periodicidade=... origem=... base=<mensal|anual> moeda=...`; `[Comissao][SKIP] reason=<no_attr|not_approved|out_of_window|trial|no_event_id|anual_moeda_ou_preco_invalido|product_change_sem_cobranca>`; `[Comissao][CREDIT] warn=no_purchased_at_ms fallback=now`; `[Comissao][CLAWBACK] ...`; `[Comissao][CLAWBACK][ORPHAN] transactionRef=... (revisao manual)`; `[Comissao][ANTILARANJA] parceiroId=... conversoes=...`; `[Comissao][ERROR] ...` (**alerta**); `[Comissao][RECONCILE] recovered=N skipped_incompleto=M`.
- **Carteira/Saque:** logar criacao/pagamento/falha (valor + status, **sem** chave PIX em claro); `[Carteira][AJUSTE] parceiroId=... adminId=... valorCentavos=... motivo=...`; `[Carteira][SALDO_NEGATIVO] parceiroId=... saldoCentavos=... (sem write-off; aguarda creditos futuros)`.
- **BOLA:** negacoes logam WARN via `OwnershipService.deny`.
- **Metricas/alertas:** taxa de `[Comissao][ERROR]` (creditos perdidos); recuperados pelo job (`RECONCILE recovered`); saldos negativos (clawback/ajuste pos-saque - persistentes, sem baixa); parceiros `emRevisaoAntifraude`; fila de saques PENDENTE > X dias (SLA dia 5); clawbacks orfaos pendentes de revisao.
- **Job de reconciliacao (cron):** Regra 14. Recomputa saldo total do ledger e reporta drift; recupera creditos faltantes (anti-join `WebhookEvent PROCESSED` x `ParceiroTransacao`, janela de lookback).

---

## Definition of Done

- [ ] **Parte 3 confirmada implementada** (colunas `codigoIndicacao` + `comissaoPercentual` + identidade + guards + asserts; **sem `comissaoAcumuladaCentavos`**) - pre-condicao dura (T0).
- [ ] Migration aditiva aplicada (`migrate status` limpo dev + smoke contra DB real); `codigoIndicacao`/`comissaoPercentual` **nao recriadas**; **nenhuma coluna `comissaoAcumuladaCentavos`** em `Parceiro` (AC24).
- [ ] Atribuicao no signup best-effort (AC1-AC3, AC2b, **AC2c erro de lookup nao quebra cadastro**); codigo invalido/case-diferente nao quebra cadastro.
- [ ] Credito do **percentual efetivo (`parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT`, default 5% - D16; nunca hardcodado)** por INITIAL_PURCHASE/RENEWAL/PRODUCT_CHANGE NORMAL, idempotente por `eventId`/`refEvento` (AC4-AC10b); percentual por parceiro respeitado (AC4b); sem `event.id` nao credita (AC5b); TRIAL nao credita (AC6b); PRODUCT_CHANGE sem cobranca nova nao credita (AC9b).
- [ ] Janela de 18 meses por `purchased_at_ms`, borda exata, **fallback `now()` sem `purchased_at_ms`** (AC7, AC7b, AC7c).
- [ ] **Credito anual (AC8/AC8b) com base = `event.price_in_purchased_currency` real (D15)**, guarda de moeda BRL; gated por kill-switch `COMISSAO_ANUAL_ENABLED` (operacional, nao bloqueio de decisao) - entra no DoD quando a flag liga.
- [ ] Job de reconciliacao recupera credito perdido dentro do lookback; SKIP em payload incompleto (AC25, AC25b, AC25c).
- [ ] Clawback **so em `cancel_reason=CUSTOMER_SUPPORT`** (D15), determinstico por `transactionRef`; orfao nao estorna; outros `cancel_reason` nao estornam (AC11-AC12); **DTO estendido com `cancel_reason` (T4b)**; gated por `COMISSAO_CLAWBACK_ENABLED`.
- [ ] Carteira/extrato sem PII (allow-list estrita); `saldoTotalCentavos` reconciliavel; sacavel desconta hold de **14 dias** (AC13-AC15b).
- [ ] Saque PIX min R$50 com hold de 14 dias, **debito atomico anti-concorrencia** (AC16c), bloqueio por revisao anti-laranja (AC16d) e saldo negativo (AC16e), debito/estorno/liquidacao admin, `motivoFalha` obrigatorio, BOLA fechada (AC15b-AC22).
- [ ] **Saldo negativo sem write-off automatico (D16):** divida persiste, bloqueia saque/liquidacao, abatida de creditos futuros (AC16e).
- [ ] **Limite leve de N conversoes/janela -> revisao admin (D15)** ativo (AC22e); AJUSTE com guard-rails (AC22b-d).
- [ ] `codigoIndicacao`/QR/link anti-corrida sobre a coluna da Parte 3 (AC23, AC23b).
- [ ] **Throttle das rotas publicas por codigo cross-instancia (D15): Redis ou lockout por codigo** (Regra 17, T9).
- [ ] Dinheiro 100% em centavos `Int` (AC24).
- [ ] `npm test` verde + `npm run lint` sem erro.
- [ ] `security-auditor` rodado: zero finding sev >= media.
- [ ] Swagger atualizado; CHANGELOG com entry.
- [ ] **Mensagens novas de erro sem em-dash** (`SALDO_INSUFICIENTE`/`VALOR_ABAIXO_MINIMO`/`PIX_NAO_CADASTRADO`/`SAQUE_BLOQUEADO_REVISAO`/`SAQUE_BLOQUEADO_SALDO_NEGATIVO` e copy de portal usam ponto/dois-pontos), pelo catalogo i18n (fallback pt-BR). Titulos legados de beneficio no seed (`IA - ...`, `Diario do pet - ...`, [seed.ts:186-188,207](../../../prisma/seed.ts#L186-L207)) ja violam a regra mas ficam **fora do escopo** desta parte e **nao** devem ser copiados como modelo.

---

## Perguntas em Aberto

> As decisoes ja tomadas (base anual, gatilho de clawback, codigoIndicacao na Parte 3, limite anti-laranja desta onda, throttler, **hold de 14 dias unico sem diferenciacao por store**, **percentual via coluna `comissaoPercentual ?? COMISSAO_PADRAO_PCT`**, **saldo negativo sem write-off automatico**) foram **dobradas no corpo** (D15 + D16) e saem desta lista. O que resta aqui exige **decisao de produto nova** ou confirmacao operacional - nao foi inventado.

1. **Parametros anti-laranja.** `ANTILARANJA_MAX_CONVERSOES` (default 20) e `ANTILARANJA_JANELA_DIAS` (default 30) sao chutes iniciais (Regra 16d). Calibrar com dados reais. Detec. por sinal de rede (IP/dispositivo) fica em camada futura (16c) - confirmar tolerancia ao residuo.
2. **Ciclo de saque como regra dura?** Dia 27 corte / dia 5 pagamento e orientacao operacional + UI nesta versao (Regra 9). Vira **bloqueio por data** (cron que so libera saque pos-corte) numa proxima onda?
3. **Aprovacao dupla de AJUSTE.** Nesta onda 1 admin faz AJUSTE com trilha + faixa (Regra 19). Operacoes acima de um teto precisam de segundo aprovador? (decisao de produto). Mesmo enquadramento para o write-off manual extraordinario de saldo negativo (D16 nao automatiza; quem aprova a baixa manual?).
4. **`PARCEIRO_INDICACAO_BASE_URL` + captura cross-sessao no app.** (a) Dominio do link (`petjourney.health/r/...`?), alinhado com `PRESTADOR_BASE_URL`/`FAMILIA_INVITE_BASE_URL` (D15: via env). (b) Confirmar com o repo de front que **persistir o `codigoIndicacao` do deep-link/QR ate o signup (dias depois)** esta no escopo deles (trabalho de front nao trivial - ver Consumidores).
5. **Catalogo i18n de erro (Parte 0).** A Parte 0 (draft) deixou o catalogo de erros como epico separado (pt-BR fixo). D14 diz que entra na Fundacao. Esta parte usa fallback pt-BR (recomendado, shippable) e migra quando o catalogo existir - confirmar.
6. **Faixa/governanca de `comissaoPercentual` por parceiro (D16).** A coluna permite percentual negociado. Ha teto/piso de negocio (ex.: nunca acima de X%)? Quem edita no CMS (admin apenas)? Confirmar guard-rail comercial e quem audita mudancas de percentual.

---

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-06-24 | 0.1 | Criacao da spec da Parte 4 (indicacao + carteira + comissoes). | Claude + Nicolas |
| 2026-06-24 | 0.2 | Correcao adversarial (furos alta/media). Reescrito "Estado real da fundacao"; Research PROD vs DRAFT-P3; job de reconciliacao (Regra 14); `event.id` real obrigatorio (Regra 6e); +1 query `Plano(preco)`; `period_type=NORMAL` (Regra 6c); clawback por `transactionRef` (Regra 7); AC8 anual gated; hold de chargeback (Regra 16); `assertSaqueOwnership` obrigatorio; allow-list estrita; janela 18m por `purchased_at_ms`/addMonths; geracao anti-corrida; normalizacao trim/uppercase; `motivoFalha` obrigatorio. | Claude (correcao) |
| 2026-06-24 | 0.3 | **Reconciliacao com D15 + auditoria.** Dobrado D15 no corpo: base anual = `event.price_in_purchased_currency` real (Regra 4/11, AC8/8b; `*12`/`precoAnual` removidos); clawback = `CANCELLATION`/`cancel_reason=CUSTOMER_SUPPORT` (Regra 7, AC11/11c/12; DTO estendido T4b); `codigoIndicacao` = coluna da Parte 3, consumida sem recriar (secao "Contrato de schema", Research #10/#11, migration); throttler Redis/lockout (Regra 17, T9); anti-laranja com limite de conversoes/janela (Regra 16d, AC22e); dominio via env. Removidas colunas de comissao de `Parceiro` (default de codigo + bruto derivado do ledger). Adicionado (derivavel): rename `saldoTotalCentavos` + sacavel pos-hold separado (Regra 8/16a, AC13c); debito de saque atomico com `FOR UPDATE` (Regra 10a, AC16c); reconciliacao com janela de lookback + SKIP payload incompleto (Regra 14, AC25b/25c, Research #18); PRODUCT_CHANGE so com cobranca nova (Regra 5a, AC9b); base anual em `price_in_purchased_currency`/moeda BRL (Regra 4, AC8b); saldo negativo persistente (Regra 16e, AC16e); lookup de parceiro best-effort incl. erro de DB (Regra 18, AC2c); guard-rails do AJUSTE (Regra 19, AC22b-d); fallback `purchased_at_ms` (Regra 15a, AC7c). Movido para Perguntas (decisao de produto): write-off de saldo negativo, hold por store, calibracao anti-laranja, ciclo de saque duro, aprovacao dupla de ajuste, percentual por parceiro. | Claude (reconciliacao D15) |
| 2026-06-24 | 0.4 | **Reconciliacao com D16 (ajustes pos-auditoria).** (1) **Hold = 14 dias:** `COMISSAO_HOLD_DIAS` default 7 -> **14**, hold unico **sem diferenciacao por store** nesta onda (Regra 16a, Regra 7, AC13c/AC16b, Riscos, Consideracoes, Rollout); removida a pergunta de hold-por-store. (2) **Percentual via coluna (D16):** `Parceiro.comissaoPercentual Float?` (coluna aditiva nullable, dona da Parte 3) consumida via `percentualEfetivo = parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` (5%); **nunca hardcodar 5% no callsite**; `percentualSnapshot` grava o efetivo; atualizados "Contrato de schema", "Estado real da fundacao", Research #11, Modelo `Parceiro`, Regra 4, NFR, Arquivos, Tasks T0/T1/T3/T4, AC4/AC4b; constante renomeada `COMISSAO_PERCENTUAL_DEFAULT` -> `COMISSAO_PADRAO_PCT`. (3) **Saldo negativo (D16):** **sem write-off automatico** nesta onda; divida persiste e e abatida de comissoes futuras, com saque/liquidacao bloqueados enquanto negativo (Regra 16e confirmada, AC16e estendido); removida da lista de Perguntas. Anti-laranja desta onda (16d), centavos `Int` e BOLA por rota preservados. | Claude (reconciliacao D16) |