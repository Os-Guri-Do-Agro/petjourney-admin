# Spec: Parte 3 — Parceiro: Identidade, Login, Equipe e Auditoria

**Status:** In Review | **Autor:** Claude + Nicolas | **Atualizado em:** 2026-06-24 | **Versao:** 0.6

> Spec filha do epico [Acesso, Compartilhamento e Parcerias](../epicos/acesso-compartilhamento-e-parcerias.md) (Parte 3, descrita em [acesso-compartilhamento-e-parcerias.md:183-190](../epicos/acesso-compartilhamento-e-parcerias.md)). Construida 100% aditiva sobre o modulo de cupom ja em producao ([cupons-tutor-backend.md](../cupons-tutor-backend.md)).
>
> **Dependencia SOFT da Parte 0 (Fundacao: `@Roles` + `RolesGuard` + catalogo de erro i18n D14).** Hoje nao existe nenhum `RolesGuard`/`@Roles` no repo (verificado: `src/auth/guards/` so tem `jwt-auth.guard.ts`, `optional-jwt-auth.guard.ts`, `system-admin.guard.ts`), nem catalogo de erro traduzido ([epico:125](../epicos/acesso-compartilhamento-e-parcerias.md)). **Esta spec e shippable sem a Parte 0**: o portal usa um guard local `ParceiroGuard` (membership ACEITO libera, senao 403), entregue como Task T0/AC desta parte; enquanto o catalogo de erro D14 nao existir, as mensagens saem em pt-BR literal e migram para o catalogo quando a Fundacao entrar (divida no CHANGELOG). Quando a Fundacao entrar, migra-se de `@UseGuards(ParceiroGuard)` para `@Roles('PARCEIRO')` + `RolesGuard` global, sem mudar shape de rota. Ver "Consideracoes de Arquitetura" e T0.
>
> **Mudanca de escopo (v0.3, decisao D13/D14 do Nicolas em 2026-06-24):** **comissao saiu inteira desta parte.** Cupom e **so desconto de loja, nao gera comissao** ([epico:108-120](../epicos/acesso-compartilhamento-e-parcerias.md), D13). A comissao vira o **programa de indicacao** (Parte 4: atribuicao no signup via codigo/QR/link, 5% da assinatura por ate 18 meses, carteira/saque). Esta parte: (a) **nao** tem nenhum campo/calculo de comissao em `CupomResgate`; `parceiroId` no resgate serve **so para relatorio/atribuicao do resgate ao parceiro**.
>
> **Reconciliacao do `codigoIndicacao` (v0.5, decisao D15 do Nicolas em 2026-06-24, autoritativa, [epico:130](../epicos/acesso-compartilhamento-e-parcerias.md)).** A v0.4 reduziu o `codigoIndicacao` a so a coluna nullable, empurrando geracao e exibicao para a Parte 4. **D15 reverte essa decisao e e a fonte autoritativa:** o `codigoIndicacao` e **atributo de identidade do parceiro** — **nasce na Parte 3** (gerado no create + backfill dos legados) e **e exibido no portal da Parte 3** (`GET /parceiro/portal/indicacao`). **A Parte 4 apenas CONSOME** o codigo (captura no signup -> atribuicao -> comissao). Para honrar D15 sem reintroduzir o lock-in de formato que motivou a v0.4, esta parte fixa **um** formato coerente e estavel: **codigo aleatorio curto base32 sem ambiguidade** (`crypto.randomBytes` -> alfabeto sem `0/O/1/I`, 10 chars, ~50 bits) com retry em P2002. Esse formato e **legivel, nao-deterministico do id (sem o furo de colisao do `md5(id)` a 32 bits) e nao prende a Parte 4** (a Parte 4 so le a string; nao re-deriva nada do id). O dominio/path do link de indicacao vem de env (`PARCEIRO_INDICACAO_BASE_URL`, D15). Ver Regra 11, Regra 15, "Modelo de Dados" e "Consideracoes de Arquitetura".
>
> **Reconciliacao da comissao % por parceiro (v0.6, decisao D16 do Nicolas em 2026-06-24, [epico:142](../epicos/acesso-compartilhamento-e-parcerias.md)).** A v0.4 removeu inteira a coluna de comissao do `Parceiro`. **D16 traz de volta UMA coluna so:** `Parceiro.comissaoPercentual Float?` (nullable; `null` = usa o default global `COMISSAO_PADRAO_PCT = 5%` definido em constante/env na Parte 4). **D16 NAO readiciona `comissaoAcumuladaCentavos`** — o bruto/saldo do parceiro vem do **ledger da Parte 4**, nao de coluna no `Parceiro`. O percentual deixa de ser hardcoded: a Parte 4 le `parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` no calculo, permitindo **negociacao comercial por parceiro sem deploy**. Cupom/`CupomResgate` continuam SEM comissao (D13 intacto); a unica coluna de comissao reintroduzida e o **percentual** em `Parceiro` (so o percentual; nada de saldo). Ver Modelo de Dados, "Contrato com a Parte 4" e "Consideracoes de Arquitetura".

---

## Visao Geral

`Parceiro` hoje e uma entidade leve admin-only ([schema.prisma:198-209](../../../prisma/schema.prisma)): so `nome @unique`, `logoUrl?`, `ativo` e a relacao `cupons`. Nao tem login, nao tem CNPJ, nao tem credenciamento auditado, nao tem codigo de indicacao. O endpoint de resgate (`POST /tutor/cupons/:id/resgatar`) foi deliberadamente adiado para "v2" na Entrega 1 ([cupons-tutor-backend.md:32](../cupons-tutor-backend.md)); a tabela `CupomResgate` foi criada vazia ([schema.prisma:246-256](../../../prisma/schema.prisma)), sem `@@unique([cupomId, tutorId])`, justamente esperando esta parte.

Esta parte entrega quatro coisas, todas aditivas:

1. **Identidade do parceiro via membership** — `Parceiro` ganha login pela tabela N-N `ParceiroEquipe` (`Usuario` <-> `Parceiro`, papel `DONO`/`OPERADOR`, status de convite), espelhando o padrao dormente de `ClinicasEquipe` ([schema.prisma:129-141](../../../prisma/schema.prisma)). Vet autonomo = `Parceiro` com 1 membro.
2. **Credenciamento auditado** — `Parceiro` ganha `cnpj?`, `statusAuditoria` (enum `PENDENTE`/`APROVADO`/`REJEITADO`/`SUSPENSO`) e trilha de auditoria. Admin aprova/rejeita/suspende.
3. **`codigoIndicacao`: nasce e e exibido aqui (D15); `comissaoPercentual` configuravel por parceiro (D16)** — `Parceiro` ganha `codigoIndicacao String? @unique`, **gerado no create do parceiro e backfillado nos legados** (formato aleatorio base32 curto, Regra 11). O portal expoe `GET /parceiro/portal/indicacao` (link/QR montados a partir de `PARCEIRO_INDICACAO_BASE_URL`). **A geracao/exibicao sao desta Parte 3 (D15); a Parte 4 so CONSOME** o codigo (captura no signup, atribuicao, comissao). Ver Regra 11 e Regra 15. **D16** adiciona tambem a coluna aditiva `comissaoPercentual Float?` (so o percentual; `null` = default global `COMISSAO_PADRAO_PCT = 5%`); a Parte 4 le `parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` no calculo. O **saldo** continua no ledger da Parte 4 (sem `comissaoAcumuladaCentavos` no `Parceiro`).
4. **Resgate com atribuicao (sem comissao) + portal de transparencia** — `CupomResgate` ganha `parceiroId` **so para atribuir o resgate ao parceiro em relatorio**; entra `POST /tutor/cupons/:id/resgatar` com decremento atomico de `usosRestantes` e dedupe de uso unico via indice unico **parcial** `WHERE "usoUnicoSnapshot"`. Parceiro logado (via `ParceiroGuard` local, migravel para `RolesGuard`) ve seus cupons, resgates atribuidos, status de auditoria e codigo/link de indicacao, scoped pela sua membership.

**Cupom nao gera comissao nesta parte (nem em nenhuma).** A unica relacao entre cupom e parceiro aqui e a **atribuicao do resgate** (`parceiroId` denormalizado no resgate) para o parceiro ver "quantos resgates dos meus cupons aconteceram". Nenhum valor monetario e calculado a partir de resgate. A receita de parceiro vem do **programa de indicacao (Parte 4)**, que **consome** o `codigoIndicacao` nascido aqui e o **percentual** configuravel `comissaoPercentual` (D16) tambem nascido aqui.

---

## Motivacao / Contexto de Negocio

- O lado B2B esta bloqueado: o cupom ja tem dono (`Cupom.parceiroId -> Parceiro`, [schema.prisma:222-223](../../../prisma/schema.prisma)), mas o parceiro nao tem como logar, ver seus resgates, ver seu codigo de indicacao ou ser credenciado para o programa de indicacao ([epico:27](../epicos/acesso-compartilhamento-e-parcerias.md)).
- A Entrega 1 ja foi desenhada "a prova de parceria" exatamente para este momento: `Parceiro` como FK + `CupomResgate` criada vazia = epico atual e **aditivo, sem migration de retrabalho** ([cupons-tutor-backend.md:18](../cupons-tutor-backend.md)).
- O resgate (`POST .../resgatar`) era o unico GET/POST do contrato do front que ficou faltando; o app ja gera o QR `petjourney://cupom/{codigo}` ([cupons-tutor-backend.md:154](../cupons-tutor-backend.md)) e espera poder registrar o uso.
- Credenciamento auditado e pre-requisito de confianca: nao da para incluir um parceiro nao verificado no programa de indicacao. O fluxo `PENDENTE -> APROVADO` e a porta de entrada do programa de parcerias.
- O `codigoIndicacao` e **identidade do parceiro** (D15): nasce com o parceiro e e o que o portal exibe para ele divulgar. A Parte 4 so consome esse codigo (captura no signup, credito de 5%). Por isso geracao e exibicao ficam aqui, e nao na Parte 4 ([epico:130,186-188](../epicos/acesso-compartilhamento-e-parcerias.md)).
- O **percentual de comissao por parceiro** (D16) e **negociacao comercial**: alguns parceiros estrategicos podem ter percentual acima/abaixo do default. Hardcodar 5% obrigaria deploy a cada negociacao. Por isso a coluna `comissaoPercentual Float?` (so o percentual; `null` = default global) nasce aqui como atributo do parceiro, e a Parte 4 a le no calculo ([epico:142](../epicos/acesso-compartilhamento-e-parcerias.md)).

---

## Research Findings (ancoras arquivo:linha reais)

**Stack confirmada:** NestJS 11 + Fastify + Prisma 7 + Postgres 16 (Supabase). IDs `cuid()`. Envelope global de **sucesso** `{ statusCode, message, data }` via `TransformInterceptor` ([transform.interceptor.ts:16-31](../../../src/common/interceptors/transform.interceptor.ts), `message` fixo `"Operation successful"`). Envelope de **erro** `{ statusCode, timestamp, path, message, error }` (sem `data`) via filtros globais ([api-conventions.md](../../../.claude/rules/api-conventions.md)). ValidationPipe global com class-validator (`whitelist/forbidNonWhitelisted/transform`).

**Parceiro / Cupom / CupomResgate (estado atual, verificado):**
- `Parceiro` leve: `id, nome @unique, logoUrl?, ativo @default(true), createdAt, updatedAt, cupons` ([schema.prisma:201-209](../../../prisma/schema.prisma)). Sem `usuarioId`, sem `cnpj`, sem status de auditoria, **sem `codigoIndicacao`**, **sem `comissaoPercentual`**. **`ativo Boolean @default(true)` ja existe** ([schema.prisma:205](../../../prisma/schema.prisma)) — interacao com `statusAuditoria` resolvida na Regra 5.
- `Cupom`: `parceiroId` FK obrigatoria, `usoUnico Boolean @default(false)`, `usosRestantes Int?` (null = ilimitado), `descontoPercentual Int`, `categoria CupomCategoria`, `@@index([ativo, validoAte])`, `@@index([parceiroId])` ([schema.prisma:214-241](../../../prisma/schema.prisma)).
- `CupomResgate`: `id, cupomId, cupom (onDelete: Cascade), tutorId, canal CanalResgate, createdAt`, `@@index([cupomId])`, `@@index([tutorId])`. **Sem** `parceiroId`, **sem** `@@unique([cupomId, tutorId])` ([schema.prisma:246-256](../../../prisma/schema.prisma)). Comentario no schema diz que o unique entra "junto com o endpoint" ([schema.prisma:243-245](../../../prisma/schema.prisma)). **`CupomResgate.cupom` tem `onDelete: Cascade` ([schema.prisma:249](../../../prisma/schema.prisma))** — relevante para a janela "cupom deletado durante resgate" (Regra 16).
- `enum CanalResgate { QR, CODIGO_MANUAL }` ([schema.prisma:266-269](../../../prisma/schema.prisma)).

**CupomService (onde o resgate encaixa) — verificado linha a linha:**
- `whereDisponivel(nivel)` ja centraliza a regra de disponibilidade: `ativo:true && validoAte>now && (usosRestantes null|>0) && (planoMinimoNivel null|nivel>=)` ([cupom.service.ts:100-109](../../../src/cupom/cupom.service.ts)). Esse `ativo:true` filtra **`Cupom.ativo`**, nao `Parceiro.ativo` — confirmado ([cupom.service.ts:102](../../../src/cupom/cupom.service.ts)). E **privado**, usado por `listarParaTutor` e `buscarParaTutor` ([cupom.service.ts:61,81](../../../src/cupom/cupom.service.ts)) — unicos callsites internos (audit grep em T11).
- `nivelDoTutor(tutorId)` degrada para 0 em tutor inexistente (`.catch(() => 0)`) ([cupom.service.ts:95-97](../../../src/cupom/cupom.service.ts)).
- **String de erro ja em uso:** `buscarParaTutor` e `findOne`/`ensureExists` lancam `new NotFoundException('Cupom não encontrado')` (com til, `não`) em ([cupom.service.ts:77,84,163,193](../../../src/cupom/cupom.service.ts)). O resgate **reusa esta string literal exata** (`'Cupom não encontrado'`) ate o catalogo D14 entrar — ver i18n e Regra 12.
- `mapToResponse` e allow-list (nunca vaza `parceiroId`/`traducoes`/`planoMinimoNivel`); entrega `categoria` **crua** (`categoria: c.categoria`, [cupom.service.ts:120](../../../src/cupom/cupom.service.ts)). O mapper do portal segue o mesmo padrao (ver contrato de `CupomParceiroResponse`).
- `cache.invalidatePrefix('cupom:tutor:')` apos qualquer mutacao de cupom ([cupom.service.ts:144,177,187](../../../src/cupom/cupom.service.ts)) e tambem em `parceiro.service.update` ([parceiro.service.ts:37](../../../src/cupom/parceiro.service.ts)). O resgate decrementa `usosRestantes` e a auditoria muda visibilidade, entao **ambos** precisam invalidar (Regras 9-10 e AC).

**ParceiroService / Controller (admin atual) — verificado:**
- `ParceiroService.create` faz `prisma.parceiro.create({ data: dto })` simples ([parceiro.service.ts:15-21](../../../src/cupom/parceiro.service.ts)); mapeia P2002 -> `ConflictException('Ja existe um parceiro com esse nome')` ([parceiro.service.ts:58-63](../../../src/cupom/parceiro.service.ts)). `remove` bloqueia com `ConflictException` se ha cupons vinculados ([parceiro.service.ts:44-51](../../../src/cupom/parceiro.service.ts)).
- `ParceiroController` = `@Controller('parceiro')` sob `JwtAuthGuard + SystemAdminGuard` ([parceiro.controller.ts:9-13](../../../src/cupom/parceiro.controller.ts)); `POST /parceiro` recebe `CreateParceiroDto` validado pelo ValidationPipe global (`whitelist+forbidNonWhitelisted` -> **campo nao declarado no DTO = 400**). Por isso `donoUsuarioId?` precisa ser **adicionado formalmente** ao `CreateParceiroDto` (ver Breaking Changes e Regra 1). Esta parte **adiciona** rotas de auditoria a este controller admin e cria um **novo** controller parceiro-scoped.

**Seed (verificado, [seed.ts:247-257](../../../prisma/seed.ts)):**
- `seedCupons()` faz `prisma.parceiro.upsert({ where:{nome}, create:{ nome }, update:{} })` — **nao seta `statusAuditoria`**. Apos esta parte, `statusAuditoria` tem default DB `PENDENTE`, entao **parceiros criados pelo seed nascem PENDENTE** e seus cupons (`PETJOURNEY20` etc.) somem de `GET /tutor/cupons` (que passa a exigir `APROVADO`+`ativo`). O backfill `UPDATE Parceiro SET statusAuditoria='APROVADO'` roda **dentro da migration** e so afeta linhas existentes naquele instante; o seed roda **depois** e recria/atualiza esses parceiros sem o status, regredindo-os para PENDENTE em qualquer ambiente recem-seedado (dev, CI, staging apos `migrate reset`). **Por isso a atualizacao do seed e OBRIGATORIA, nao opcional** (Regra 17). Sem ela, o smoke de resgate (T10) e o dev local quebram no dia 1. (`comissaoPercentual` do seed fica `null` = default global; nao precisa setar.)

**Membership de referencia (`ClinicasEquipe`, dormente) — verificado:**
- Chave composta `@@id([clinicaId, usuarioId])`, `status StatusConvite @default(PENDENTE)`, `ativo Boolean @default(true)`, `joinedAt`, `roleId`, relacoes para `Clinica`, `ClinicaRole`, `Usuario` ([schema.prisma:129-141](../../../prisma/schema.prisma)). **Modelagem** a espelhar; o **service** (`clinica.service.ts`) e stub e nao deve ser copiado ([epico:50](../epicos/acesso-compartilhamento-e-parcerias.md)).
- `enum StatusConvite { PENDENTE, ACEITO, RECUSADO }` ([schema.prisma:923-927](../../../prisma/schema.prisma)) — **reusar**, nao criar enum novo de status de convite.
- `Usuario.equipe ClinicasEquipe[]` — `Usuario` ja acumula memberships. Vamos adicionar `Usuario.parceiroEquipe ParceiroEquipe[]`.

**Auth / papeis:**
- JWT carrega `userId, email, nome, isSystemAdmin, tutorId, tutorActive, veterinarioId` ([jwt.strategy.ts:31-40](../../../src/auth/strategies/jwt.strategy.ts)). **Nao carrega parceiroId** e nao vamos adicionar (papel parceiro deriva de query de membership, igual a estrategia do epico para papeis derivados, [epico:75](../epicos/acesso-compartilhamento-e-parcerias.md)).
- `SystemAdminGuard` checa `user.isSystemAdmin` ([system-admin.guard.ts:4-14](../../../src/auth/guards/system-admin.guard.ts)).
- `OwnershipService` tem 17 metodos `assert*`, todos binarios `owner.usuarioId === userId || isAdmin`, com `deny()` que loga WARN ([ownership.service.ts:23-28,46-330](../../../src/auth/services/ownership.service.ts)). Nenhum cobre parceiro/membership. Esta parte **adiciona** asserts dedicados.

**SubscriptionService:** `getNivelForTutor(tutorId): Promise<number>` (0 sem assinatura, 404 se tutor inexistente) ([subscription.service.ts:136-157](../../../src/subscription/subscription.service.ts)). Reusado pelo resgate via `nivelDoTutor` (que ja faz `.catch(() => 0)`).

**DELETE 204 sob o interceptor:** o repo ja tem rotas DELETE com `@HttpCode(204)`/`@HttpCode(HttpStatus.NO_CONTENT)` (ex.: [diario-pet.controller.ts:130](../../../src/diario-pet/diario-pet.controller.ts), `alergia`, `diagnostico`, `tratamento-fixo`). O `TransformInterceptor` ainda envelopa o body (`data: undefined`), mas o status 204 e o padrao aceito do repo — esta parte **segue esse padrao**, sem caso especial.

**Backfill por seed:** o seed atual so cria 2 parceiros fixos por nome ([seed.ts:247-256](../../../prisma/seed.ts)). Parceiros criados pelo CMS em runtime **nao** sao tocados pelo seed — por isso o backfill `APROVADO` dos legados precisa rodar na **migration SQL** (`UPDATE` em todos), nao so no seed (ver Plano de Rollout e Risco "CMS"). **O `codigoIndicacao` e backfillado por linha (geracao com retry de unicidade no service de migration data, Regra 11)** — nao por `UPDATE` SQL puro, que nao re-tenta colisao. **`comissaoPercentual` dos legados fica `null`** (default global), entao nao precisa de backfill.

**i18n de conteudo:** locales em [locales.ts](../../../src/common/i18n/locales.ts) (`pt-BR`, `en-US`, `en-GB`, `es-419`); `@Locale()` decorator ([locale.decorator.ts](../../../src/common/decorators/locale.decorator.ts)). **Nao existe catalogo de erro traduzido ainda** (`src/common/i18n/` so tem `locales`, `traducao.util`, `especie.labels`) — e deliverable da Parte 0 (D14, [epico:125](../epicos/acesso-compartilhamento-e-parcerias.md)). Esta parte registra as chaves de erro que devem entrar no catalogo (ver i18n).

**RevenueCat DTO (verificado, [revenuecat-event.dto.ts:1-58](../../../src/webhook/dto/revenuecat-event.dto.ts)):** `RevenueCatEventPayloadDto` le hoje `type, app_user_id, product_id?, expiration_at_ms?, purchased_at_ms?, price?, ...` — **nao le `cancel_reason`**. D15 exige estender o DTO para ler `cancel_reason` (clawback so estorna em `CANCELLATION` com `cancel_reason='CUSTOMER_SUPPORT'`). **Isso e escopo da Parte 4** (clawback/comissao); registrado aqui so como dependencia para a Parte 4 nao redescobrir (ver "Perguntas em Aberto").

**Breaking changes:** ver secao dedicada abaixo. Em resumo: schema 100% aditivo; **ha uma mudanca de comportamento** (filtro de disponibilidade passa a exigir `parceiro.statusAuditoria=APROVADO` **e** `parceiro.ativo=true`) que afeta o CMS e e mitigada por backfill na migration + default `APROVADO` para parceiro criado por admin + seed atualizado; e **uma mudanca de contrato aditiva** (`POST /parceiro` aceita `donoUsuarioId?` opcional).

---

## Modelo de Dados (diff Prisma por entidade)

### Enums novos

```prisma
/// Status de credenciamento/auditoria do parceiro comercial.
enum StatusAuditoriaParceiro {
  PENDENTE   // criado por fluxo de auto-cadastro/convite; cupons ocultos do tutor, fora do programa de indicacao
  APROVADO   // credenciado; portal liberado; cupons visiveis ao tutor (se parceiro.ativo); habilitado ao programa de indicacao
  REJEITADO  // reprovado na auditoria; cupons ficam ocultos do tutor; portal so-leitura (mutacao de equipe bloqueada)
  SUSPENSO   // suspenso por violacao; cupons ocultos; portal somente-leitura do historico (mutacao de equipe bloqueada)
}

/// Papel de um Usuario dentro de um Parceiro (membership).
enum PapelParceiro {
  DONO      // controla a equipe (convidar/remover), edita dados do parceiro
  OPERADOR  // opera dashboard/leitura; nao mexe na equipe nem nos dados cadastrais
}
```

> `StatusConvite { PENDENTE, ACEITO, RECUSADO }` ([schema.prisma:923-927](../../../prisma/schema.prisma)) e **reusado** em `ParceiroEquipe.status` (nao criar enum novo).
>
> **Nota sobre o default de `statusAuditoria`:** o enum tem default `PENDENTE` no banco, mas o **service** sobrescreve para `APROVADO` quando o parceiro e criado pelo fluxo admin (`POST /parceiro`, `SystemAdminGuard`) — ver Regra de Negocio 1. Isso resolve o caso do CMS: parceiro criado por admin nasce visivel; o default `PENDENTE` so vale para fluxos de auto-cadastro/convite que ainda nao existem. **O seed tambem nasce APROVADO** (Regra 17), senao os cupons seedados somem apos `migrate reset`.

### `Parceiro` — colunas aditivas (todas nullable ou com default)

```prisma
model Parceiro {
  id              String                   @id @default(cuid())
  nome            String                   @unique
  logoUrl         String?
  ativo           Boolean                  @default(true)  // JA EXISTE: soft-disable manual (ver Regra 5)
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt
  cupons          Cupom[]

  // --- ADITIVO (Parte 3) ---
  /// CNPJ do parceiro (vet autonomo pode nao ter; por isso nullable). Unico quando presente.
  cnpj            String?                  @unique
  /// Credenciamento. Default DB PENDENTE; service usa APROVADO no fluxo admin (Regra 1).
  statusAuditoria StatusAuditoriaParceiro  @default(PENDENTE)
  /// Trilha de auditoria (quem/quando/por que). usuarioId do admin que decidiu.
  auditadoPorId   String?
  auditadoEm      DateTime?
  /// Motivo de rejeicao/suspensao (texto livre do admin; mostrado ao parceiro no portal).
  motivoAuditoria String?
  /// Codigo publico de indicacao do parceiro (identidade, D15). GERADO no create
  /// (Regra 11) e backfillado nos legados (geracao por linha com retry, nao UPDATE SQL).
  /// Formato: aleatorio base32 sem ambiguidade, 10 chars (~50 bits). A Parte 4 so CONSOME
  /// (captura no signup, atribuicao, comissao). Nullable so para a janela do backfill.
  codigoIndicacao String?                  @unique
  /// Percentual de comissao do programa de indicacao, configuravel por parceiro (D16).
  /// SO O PERCENTUAL (nada de saldo). null = usa o default global COMISSAO_PADRAO_PCT = 5%
  /// (constante/env definida na Parte 4). A Parte 4 le `comissaoPercentual ?? COMISSAO_PADRAO_PCT`
  /// no calculo. Permite negociacao comercial por parceiro sem deploy. O saldo/bruto NAO mora aqui:
  /// vem do ledger da Parte 4 (por isso NAO existe comissaoAcumuladaCentavos no Parceiro).
  comissaoPercentual Float?

  // relacoes aditivas
  equipe          ParceiroEquipe[]
  resgates        CupomResgate[]
  auditadoPor     Usuario?                 @relation("ParceiroAuditadoPor", fields: [auditadoPorId], references: [id])

  // Opcional (volume): se a listagem de cupom por parceiro crescer, indexar o gate.
  // @@index([statusAuditoria, ativo])  // ver Risco "JOIN em whereDisponivel"
}
```

> **`codigoIndicacao` nasce preenchido nesta parte (D15).** Parceiros criados pelo `POST /parceiro` (admin) e os legados (via backfill por linha) recebem codigo unico. **A unica coluna de comissao em `Parceiro` e `comissaoPercentual Float?` (so o percentual, configuravel por parceiro, D16):** `null` = usa o default global `COMISSAO_PADRAO_PCT = 5%` (constante/env da Parte 4); a Parte 4 le `comissaoPercentual ?? COMISSAO_PADRAO_PCT` no calculo. **Nao** existe coluna de **saldo** (`comissaoAcumuladaCentavos`) no `Parceiro` — o bruto/saldo vem do **ledger da Parte 4** (D13/D16). A Parte 4 nao re-adiciona `codigoIndicacao` nem `comissaoPercentual` (ja existem aqui); ela cria suas proprias tabelas/colunas de carteira/atribuicao no seu schema diff (ver "Contrato com a Parte 4").

### `ParceiroEquipe` — tabela nova (membership N-N, espelha `ClinicasEquipe`)

```prisma
/// Vinculo N-N Usuario<->Parceiro. Login do parceiro = ter >=1 membership ATIVA
/// (status ACEITO && ativo). Espelha ClinicasEquipe (schema.prisma:129-141) na modelagem;
/// NAO copia clinica.service (stub).
model ParceiroEquipe {
  parceiroId String
  usuarioId  String
  papel      PapelParceiro @default(OPERADOR)
  status     StatusConvite @default(PENDENTE)
  ativo      Boolean       @default(true)
  joinedAt   DateTime      @default(now())
  /// Quem convidou (usuarioId do DONO). Auditoria de equipe.
  convidadoPorId String?
  parceiro   Parceiro      @relation(fields: [parceiroId], references: [id], onDelete: Cascade)
  usuario    Usuario       @relation(fields: [usuarioId], references: [id])

  @@id([parceiroId, usuarioId])
  @@index([usuarioId])
}
```

> **Invariante:** **todo `Parceiro` com `statusAuditoria=APROVADO` deve ter >=1 membership com `papel=DONO`, `status=ACEITO` e `ativo=true`.** A invariante e atrelada ao status APROVADO (nao a "todo parceiro"): parceiro orfao so e permitido enquanto `PENDENTE` (ver Regra 1 e Risco). Postgres nao expressa "pelo menos um"; a invariante e mantida no service dentro de transacao (contagem com bloqueio, ver Regra 4).
>
> **PK composta `@@id([parceiroId, usuarioId])` e re-convite de ex-membro:** como a PK e composta, um `ParceiroEquipe(parceiroId,usuarioId)` removido (`ativo=false`) **permanece na tabela**. Re-convidar esse mesmo usuario nao pode fazer `create` (estouraria P2002 no PK); usa **upsert/reativacao** (Regra 18).

### `CupomResgate` — colunas aditivas (atribuicao, SEM comissao) + indice unico parcial

```prisma
model CupomResgate {
  id        String       @id @default(cuid())
  cupomId   String
  cupom     Cupom        @relation(fields: [cupomId], references: [id], onDelete: Cascade)
  tutorId   String
  canal     CanalResgate
  createdAt DateTime     @default(now())

  // --- ADITIVO (Parte 3) ---
  /// Atribuicao do resgate ao parceiro dono do cupom no momento do resgate.
  /// SO PARA RELATORIO (o parceiro ve "quantos resgates dos meus cupons aconteceram").
  /// NAO gera comissao (cupom e so desconto de loja; comissao = Parte 4 / indicacao).
  /// Nullable so para backfill de linhas antigas (hoje a tabela esta vazia).
  parceiroId        String?
  parceiro          Parceiro?  @relation(fields: [parceiroId], references: [id])
  /// Snapshot do desconto no momento do resgate (campanha pode mudar depois). Relatorio.
  descontoPercentualSnapshot Int?
  /// Snapshot de cupom.usoUnico no momento do resgate; alimenta o indice unico parcial.
  usoUnicoSnapshot  Boolean    @default(false)

  @@index([cupomId])
  @@index([tutorId])
  @@index([parceiroId])
}
```

> **Removido da v0.2:** `comissaoCentavos`, `comissaoPercentualSnapshot`. Cupom **nao gera comissao**; resgate nao carrega valor monetario. O que sobra e atribuicao (`parceiroId`) + snapshot de desconto (relatorio). **D16 nao reabre isso:** o percentual configuravel volta como coluna de `Parceiro` (`comissaoPercentual`), nao em `CupomResgate` — resgate de cupom continua sem qualquer campo de comissao.
>
> **O dedupe NAO e um `@@unique([cupomId, tutorId])` global.** Prisma nao expressa indice unico parcial no schema, entao o unique e criado **direto no SQL da migration** como **indice parcial** restrito a cupons de uso unico:
>
> ```sql
> CREATE UNIQUE INDEX "CupomResgate_cupomId_tutorId_usoUnicoSnapshot_key"
>   ON "CupomResgate" ("cupomId", "tutorId")
>   WHERE "usoUnicoSnapshot" = true;
> ```
>
> **Nome do indice reflete a coluna real** (`usoUnicoSnapshot`), nao `usoUnico` (corrige o nome enganoso da v0.3).
>
> **Problema que isso resolve:** `usoUnico` mora em `Cupom`, nao em `CupomResgate`, e um indice parcial so pode referenciar colunas da propria tabela. Por isso o resgate **denormaliza** `usoUnico` para `CupomResgate` (coluna aditiva `usoUnicoSnapshot Boolean @default(false)`, preenchida no insert a partir de `cupom.usoUnico`), e o indice parcial usa essa coluna. Assim **cupom ilimitado (uso multiplo) pode ser resgatado N vezes pelo mesmo tutor sem 409**, e so o cupom de uso unico tem dedupe. Isso corrige o furo do `@@unique` global (que faria um cupom ilimitado resgatado 2x retornar 409 errado de "uso unico").

### `Usuario` — relacao reversa aditiva

```prisma
model Usuario {
  // ... campos existentes ...
  // ADITIVO:
  parceiroEquipe   ParceiroEquipe[]
  parceirosAuditados Parceiro[]     @relation("ParceiroAuditadoPor")
}
```

### Contrato com a Parte 4 (limite de schema entre as partes)

> Para evitar a colisao de migration que existia entre os drafts (Parte 3 e Parte 4 brigando por quem cria as colunas), o limite e explicito:

| Coluna | Quem cria | Quem consome |
|---|---|---|
| `Parceiro.codigoIndicacao String? @unique` | **Parte 3** (esta spec): cria a coluna, **gera no create + backfilla legados** (D15). | Parte 4: le o codigo (captura no signup -> `referidoPorParceiroId`). **Parte 4 NAO re-adiciona a coluna nem re-gera** (ja existe e ja vem preenchida). |
| `Parceiro.comissaoPercentual Float?` (so o percentual, nullable; `null` = `COMISSAO_PADRAO_PCT = 5%`) | **Parte 3** (esta spec, D16): cria a coluna aditiva. Permite negociacao comercial por parceiro sem deploy. | **Parte 4:** le `parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` no calculo da comissao (`COMISSAO_PADRAO_PCT` e constante/env definida na Parte 4). **Parte 4 NAO re-adiciona a coluna.** |
| `Parceiro.comissaoAcumuladaCentavos` (saldo/bruto) | **Parte 4** (schema/ledger dela). **Esta Parte 3 NAO a cria** — o saldo vem do **ledger da Parte 4**, nao de coluna no `Parceiro` (D16). | Parte 4. **A Parte 4 nao deve listar `comissaoAcumuladaCentavos` como "reuse da Parte 3"** — nasce la (ou no ledger). |
| `CupomResgate.parceiroId` (atribuicao, sem comissao) | **Parte 3** (esta spec). | Relatorio do portal (Parte 3). **Nao** alimenta comissao. |
| Extensao de `revenuecat-event.dto.ts` para ler `cancel_reason` | **Parte 4** (clawback, D15). Esta Parte 3 nao toca o webhook. | Parte 4. |

> **Acao para a Parte 4 (quando for escrita):** remover de la qualquer afirmacao de que "a Parte 3 nao cria `codigoIndicacao`" ou de que "`codigoIndicacao` nasce na Parte 4" (contradiz D15 e esta spec). Remover tambem qualquer afirmacao de que "a Parte 3 nao tem campo de comissao" ou de que `comissaoPercentual` "nasce na Parte 4" (contradiz D16: o **percentual** nasce aqui; so o **saldo**/`comissaoAcumuladaCentavos`/ledger e da Parte 4). A Parte 4 le `parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` e define `COMISSAO_PADRAO_PCT` como constante/env. Remover tambem referencias a um `computeComissao` stub na Parte 3 ([anteriormente citado como 03-...:366] — **nao existe**; o calculo de comissao saiu inteira desta parte, **so** o percentual configuravel ficou). A Parte 4 define `computeComissaoIndicacao` do zero, lendo o percentual por parceiro.

### Migration

- Nome sugerido: `prisma/migrations/20260624120000_parceiro_identidade_equipe_auditoria/`.
- SQL/data, em ordem:
  1. `CREATE TYPE "StatusAuditoriaParceiro"` e `"PapelParceiro"`.
  2. `ALTER TABLE "Parceiro" ADD COLUMN ...` (todas nullable/default; `statusAuditoria DEFAULT 'PENDENTE'`; `codigoIndicacao` nullable; **`comissaoPercentual DOUBLE PRECISION NULL`** sem default = D16, `null` significa default global). `CREATE UNIQUE INDEX` para `cnpj` e `codigoIndicacao` (Postgres permite multiplos NULL em `@unique`, entao a coluna pode ser preenchida em passo seguinte sem colidir com NULLs transitorios). `comissaoPercentual` **nao** e `@unique` (varios parceiros podem ter o mesmo percentual).
  3. **Backfill de status dos legados (idempotente):**
     - `UPDATE "Parceiro" SET "statusAuditoria" = 'APROVADO';` (todos os parceiros existentes — inclusive os criados pelo CMS em runtime — viram APROVADO para nao sumir cupons ja publicados). Idempotente em rerun. **`comissaoPercentual` dos legados fica `null` (default global); sem backfill.**
  4. **Backfill de `codigoIndicacao` dos legados (D15, geracao por linha com retry):** **nao** e `UPDATE` SQL puro (SQL de migration nao re-tenta colisao). Roda como **passo de data-migration** (script `prisma/migrations/.../backfill-codigo-indicacao.ts` ou bloco do seed idempotente executado pelo deploy), gerando o codigo aleatorio base32 por linha com retry em P2002 ate todos os `codigoIndicacao` ficarem unicos e nao-nulos. Idempotente: so preenche linhas com `codigoIndicacao IS NULL`. Ver Regra 11 e "Plano de Rollout".
  5. `CREATE TABLE "ParceiroEquipe" (...)` + `CREATE INDEX` em `usuarioId`.
  6. `ALTER TABLE "CupomResgate" ADD COLUMN` (`parceiroId`, `descontoPercentualSnapshot`, `usoUnicoSnapshot BOOLEAN NOT NULL DEFAULT false`) + `CREATE INDEX` em `parceiroId`.
  7. **Guarda anti-duplicata antes do indice unico** (a tabela esta vazia hoje, mas a migration deve abortar com mensagem clara se houver duplicata de uso unico):
     ```sql
     DO $$
     BEGIN
       IF EXISTS (
         SELECT 1 FROM "CupomResgate"
         WHERE "usoUnicoSnapshot" = true
         GROUP BY "cupomId", "tutorId" HAVING count(*) > 1
       ) THEN
         RAISE EXCEPTION 'Abortado: ha resgates de uso unico duplicados (cupomId,tutorId); resolver antes de criar o indice unico parcial.';
       END IF;
     END $$;
     ```
  8. `CREATE UNIQUE INDEX "CupomResgate_cupomId_tutorId_usoUnicoSnapshot_key" ... WHERE "usoUnicoSnapshot" = true;` (parcial).
- Aplicar via `npx prisma migrate deploy` (Supabase bloqueia shadow DB — ver CLAUDE.md). Rodar `prisma migrate status` antes. **O passo 4 (backfill de codigo) roda apos `migrate deploy`** (data-migration), nao dentro do SQL DDL, exatamente para poder re-tentar colisao.

> **Por que codigo aleatorio (e nao `md5(id)`) no backfill:** a v0.3 sugeria `upper(substr(md5("id"),1,8))` (32 bits, colisao por aniversario) **sem guarda anti-colisao** — se dois ids colidissem nos 8 hex, o `@unique` estouraria no meio da migration, deixando-a parcialmente aplicada (Supabase, `migrate deploy` sem rollback automatico). Trocando para **geracao aleatoria base32 com retry** (passo de data-migration que re-tenta P2002 por linha), a unicidade e garantida e o backfill nunca aborta por colisao. O formato fica fixado aqui (D15: codigo nasce na Parte 3), e a Parte 4 so le.

---

## Breaking Changes

> A spec inteira e schema-aditiva, mas **mudancas de comportamento/contrato existem** e precisam estar explicitas.

| Mudanca | Quem afeta | Mitigacao |
|---|---|---|
| `whereDisponivel(nivel)` passa a exigir `parceiro.statusAuditoria='APROVADO'` **E** `parceiro.ativo=true`. Cupons de parceiro nao-APROVADO ou desativado somem de `GET /tutor/cupons` e `GET /tutor/cupons/:id`. | **petjourney-app** (lista/detalhe de cupom do tutor) e indiretamente **petjourney-cms** (parceiros que ele cria/edita/desativa); **e o dev/CI local** (seed). Sem mitigacao, todo parceiro legado, todo parceiro novo do CMS e todo parceiro seedado nasceriam invisiveis. | (a) **Backfill na migration** marca todos os legados como `APROVADO` (item 3). (b) Parceiro criado por admin (`POST /parceiro`, fluxo do CMS) **nasce `APROVADO`** (Regra 1) e `ativo=true` (default existente). (c) **Seed atualizado (OBRIGATORIO, Regra 17):** `parceiro.upsert({ create:{ nome, statusAuditoria:'APROVADO' }, update:{ statusAuditoria:'APROVADO' } })` — senao os cupons seedados somem apos `migrate reset` e o smoke de resgate (T10) quebra. (d) `parceiro.ativo` ja existia mas **nao era filtro** em `whereDisponivel`; passar a filtrar e mudanca de comportamento — antes um parceiro `ativo=false` ainda exibia cupons (bug latente), agora nao. Documentado na Regra 5. (e) Teste de regressao em `cupom.service.spec` cobre APROVADO+ativo lista, e nao-APROVADO / `ativo=false` nao lista; AC de smoke cobre "seed -> `GET /tutor/cupons` retorna os cupons seedados". |
| `POST /parceiro` aceita campo **opcional novo** `donoUsuarioId?` no `CreateParceiroDto`. | **petjourney-cms** (cria parceiro). | Aditivo e retrocompativel: campo opcional, payloads atuais (sem o campo) continuam validos. **CMS pode** passar a mandar `donoUsuarioId` para ja vincular o DONO. Como o ValidationPipe usa `forbidNonWhitelisted`, o campo precisa estar declarado no DTO (item de Arquivos Impactados); sem a declaracao, o CMS receberia 400 ao mandar o campo. |
| `POST /tutor/cupons/:id/resgatar` agora existe (antes 404 de rota). | petjourney-app (passa a poder resgatar). | Aditivo puro; consumidor opt-in. |
| `GET /parceiro/portal/indicacao` agora existe e expoe `codigoIndicacao` + link (D15). | petjourney-app/portal do parceiro (consumidor opt-in). | Aditivo. `codigoIndicacao` e publico por natureza (o parceiro divulga). Nao expoe PII de tutor. Dominio do link via `PARCEIRO_INDICACAO_BASE_URL` (env). |
| `Parceiro` ganha coluna aditiva `comissaoPercentual Float?` (D16). | Nenhum consumidor atual (a coluna so e lida pela Parte 4). | Aditivo puro: coluna nullable, sem default, `null` = default global `COMISSAO_PADRAO_PCT`. Nenhum shape de resposta existente muda; o CMS pode (futuro) editar o percentual por parceiro, mas isso e opt-in. Saldo nao mora aqui (ledger = Parte 4). |

Nenhum shape de resposta existente muda. CMS e app **so ganham rotas/campos novos**; as unicas alteracoes observaveis sao a visibilidade condicionada a `APROVADO + ativo` (neutralizada pelo backfill + default admin + seed) e os campos/rotas novos.

> **Drift com o epico (registrado como divida):** o criterio de sucesso do epico ([epico:230](../epicos/acesso-compartilhamento-e-parcerias.md)) e o DoD ([epico:218](../epicos/acesso-compartilhamento-e-parcerias.md)) refletem a v0.1. **Acao:** atualizar o epico para v0.2 trocando, no criterio de sucesso, "resgates atribuidos **com comissao registrada**" por "resgates atribuidos (`parceiroId`); comissao na Parte 4". **O codigo/QR/link de indicacao PERMANECE como entregavel da Parte 3** (D15 confirma: nasce + e exibido aqui) — alinhado com o DoD do epico ([epico:218](../epicos/acesso-compartilhamento-e-parcerias.md)). Registrado em "Perguntas em Aberto" e no CHANGELOG como divida de documentacao do epico. Enquanto o epico nao for atualizado, **D13/D14/D15/D16 (decisoes mais recentes do Nicolas) prevalecem** sobre o corpo v0.1.

---

## Contrato dos Endpoints

> Sucesso sob envelope global `{ statusCode, message, data }` (`message` = `"Operation successful"`); erro sob `{ statusCode, timestamp, path, message, error }` (sem `data`). Os shapes abaixo descrevem o conteudo de `data`. DTOs validados por ValidationPipe global.

### A. Resgate (tutor autenticado) — modulo cupom

#### `POST /tutor/cupons/:id/resgatar`
- **Guards:** `JwtAuthGuard`. Le `req.user.tutorId` (padrao do `cupom.controller.ts`).
- **Body:** `ResgatarCupomDto { canal: CanalResgate }` (`@IsEnum(CanalResgate)`).
- **Sucesso (201):** `data = { resgateId, cupomId, codigo, descontoPercentual, parceiro, usosRestantes?, jaResgatado: false }`.
  - `descontoPercentual` = `cupom.descontoPercentual` atual no momento do resgate (mesmo valor gravado em `descontoPercentualSnapshot`; consistente no insert).
  - `parceiro` = `cupom.parceiro.nome` (string, allow-list, igual ao mapper de cupom). **Nao** expoe `codigoIndicacao` nem `comissaoPercentual` do parceiro ao tutor (sao do portal do parceiro, nao do fluxo do tutor).
  - `usosRestantes` omitido quando ilimitado ou `usoUnico` (mesma regra de omissao do `mapToResponse`).
- **Erros (ordem de avaliacao definida — ver Regra 5; mensagens passam pelo catalogo de erro D14 quando existir):**
  - `401` sem JWT.
  - `404 Cupom não encontrado` (string literal exata ja em uso, [cupom.service.ts:77](../../../src/cupom/cupom.service.ts)) — id inexistente, indisponivel/inelegivel (reusa `whereDisponivel(nivel)` que **ja inclui** `statusAuditoria=APROVADO` e `parceiro.ativo=true`), ou `tutorId` null (mesma regra de `buscarParaTutor`). Nao vaza existencia. **Cupom de parceiro nao-APROVADO/`ativo=false` cai aqui (404), nao 403** — ver decisao de codigo abaixo.
  - `409 Cupom de uso único já resgatado` — `usoUnico=true` e ja existe resgate `(cupomId, tutorId)` (P2002 do indice parcial). So dispara para cupom de uso unico.
  - `409 Cupom esgotado` — `usosRestantes=0` na hora do decremento atomico (corrida).

> **Decisao 404-vs-403 (D14):** como `whereDisponivel` passa a embutir `statusAuditoria=APROVADO` + `parceiro.ativo=true`, um cupom de parceiro `PENDENTE`/`REJEITADO`/`SUSPENSO`/`ativo=false` **nao passa no filtro** e o resgate retorna **404 `Cupom não encontrado`** — consistente com a listagem (o cupom nem aparece para o tutor) e sem vazar a existencia/estado do parceiro ao tutor. **Nao ha 403 no fluxo do tutor.** 403 e reservado para ownership autenticado (rotas do portal); 404 generico cobre o lookup do cupom (D14). O AC e a estrategia de testes foram alinhados para 404.

> **Janela "cupom deletado durante o resgate" (Regra 16):** o lookup do cupom e o insert do `CupomResgate` rodam na **mesma transacao**, entao a janela e minima. Se o admin deletar o cupom exatamente entre o lookup e o insert, a FK do insert falha (`onDelete: Cascade` em `CupomResgate.cupom`, [schema.prisma:249](../../../prisma/schema.prisma)); a transacao reverte e o filtro Prisma global mapeia para erro generico (P2025/FK -> 404/409). Estado raro e **nao** deixa linha invalida. Documentado como aceito (Regra 16); sem codigo extra.

### B. Portal do parceiro (parceiro autenticado) — modulo novo `parceiro-portal`

> Base `@Controller('parceiro/portal')`. Guard padrao do controller: `JwtAuthGuard` + **`ParceiroGuard` local** (libera quem tem >=1 `ParceiroEquipe` com `status=ACEITO && ativo=true`; senao 403). Migravel para `@Roles('PARCEIRO')` + `RolesGuard` quando a Parte 0 entrar (mesmo shape).
>
> **Excecao ao guard (corrige catch-22):** a rota `PATCH .../equipe/convites/aceitar` **NAO passa pelo `ParceiroGuard`** (o convidado de primeira viagem ainda esta `PENDENTE`, nao tem membership `ACEITO`, e seria bloqueado antes de aceitar). Ela usa **so `JwtAuthGuard`** e valida o convite `PENDENTE` no service. Implementacao: o `ParceiroGuard` le metadata `@SkipParceiroGuard()` (decorator local) na rota de aceite, ou a rota fica fora do controller guardado. Ver Regra 13 e Autorizacao/BOLA.
>
> **Scope:** o parceiro alvo e resolvido via `assertParceiroMembership` do `req.user.userId`. **Todas as rotas do portal aceitam `?parceiroId=`** (corrige ambiguidade para dono de N parceiros): obrigatorio quando o usuario tem >1 parceiro ativo (`400` se omitido com N>1), opcional/auto-resolvido quando tem exatamente 1, sempre validado contra a membership (403 se nao e membro — D14).
>
> **Precedencia de checagens (corrige borda N=0):** em qualquer rota do portal guardada, o `ParceiroGuard` roda **primeiro** (403 se o usuario tem zero membership `ACEITO+ativo`). So depois o service resolve `?parceiroId=` (400 se N>1 e omitido; 403 se o `parceiroId` informado nao e do usuario). Logo o caso N=0 **sempre** cai em 403 do guard e **nunca** chega ao 400 de "parceiroId obrigatorio".

#### `GET /parceiro/portal/dashboard?parceiroId=`
- **Resposta (200):** `data = { parceiro: { id, nome, logoUrl, statusAuditoria, motivoAuditoria?, cnpj? }, papel: PapelParceiro, totais: { cuponsAtivos, resgatesTotal, resgatesUltimos30d } }`.
- `400 parceiroId obrigatorio quando ha mais de um parceiro` se omitido com N>1. Nunca vaza dados de outro parceiro nem ids internos de tutor. **Sem valor de comissao** (saldo/credito = Parte 4; esta parte nao calcula nem expoe saldo). O percentual configuravel `comissaoPercentual` e atributo do parceiro mas **nao** e exposto no dashboard nesta parte (a UI de comissao e da Parte 4).

#### `GET /parceiro/portal/cupons?parceiroId=&cursor=&limit=20`
- Lista cupons do **proprio** parceiro (todos, incl. inativos/expirados — visao do dono, nao do tutor). Paginacao cursor-based.
- **Resposta:** `data = { data: CupomParceiroResponse[], meta: { proximoCursor? } }`.
- `CupomParceiroResponse` (allow-list): `{ id, codigo, titulo, descontoPercentual, categoria, validoAte, ativo, usoUnico, usosRestantes?, totalResgates }`.
  - **`categoria` sai como enum cru** (`CupomCategoria`, ex.: `PETSHOP`), igual ao `mapToResponse` atual ([cupom.service.ts:120](../../../src/cupom/cupom.service.ts)). Sem i18n.
  - **`titulo` sai cru (pt-BR base, sem i18n de `traducoes`)** — e a visao do **dono**, nao do tutor; o portal nao recebe `@Locale()` de conteudo de cupom. **Nao** vaza `traducoes`/`planoMinimoNivel`/`parceiroId`.

#### `GET /parceiro/portal/resgates?parceiroId=&cursor=&limit=20`
- Lista resgates atribuidos ao parceiro. **PII de tutor nao e exposta de forma alguma:** o response **nao inclui `tutorId`, nome, email, nem qualquer ref derivada reversivel.** Cada resgate e identificado apenas pelo `resgateId` (cuid proprio da linha de resgate, nao relacionavel a outros recursos do tutor). **Nao** ha `tutorRef`/hash de `tutorId` (um cuid de tutor e enumeravel/colidivel entre parceiros). Se no futuro for preciso "mesmo tutor, varios resgates neste parceiro", usar `HMAC(tutorId, chave-por-parceiro)` — fica como follow-up; hoje **nao exportamos nada derivado de `tutorId`**.
- **Resposta:** `data = { data: ResgateResponse[], meta: { proximoCursor? } }`.
- `ResgateResponse` (allow-list estrita): `{ resgateId, cupomCodigo, canal, descontoPercentualSnapshot?, resgatadoEm }`. **Sem** `tutorId`/`tutorRef`/email/nome e **sem** campo de comissao (resgate nao gera comissao).

#### `GET /parceiro/portal/status?parceiroId=`
- **Resposta:** `data = { statusAuditoria, motivoAuditoria?, auditadoEm?, podeOperar: boolean }`. `podeOperar = statusAuditoria === 'APROVADO' && parceiro.ativo === true`.

#### `GET /parceiro/portal/indicacao?parceiroId=` (D15 — exibicao do codigo)
- **Guard:** `ParceiroGuard` + `assertParceiroMembership(parceiroId, userId)` (DONO **ou** OPERADOR podem ver; e info de divulgacao, nao mutacao).
- **Resposta (200):** `data = { codigoIndicacao, link, podeIndicar: boolean, aviso? }`.
  - `codigoIndicacao` = `parceiro.codigoIndicacao` (nunca null nesta parte — gerado no create/backfill, Regra 11).
  - `link` = `` `${PARCEIRO_INDICACAO_BASE_URL}/r/${codigoIndicacao}` `` (dominio via env, D15; placeholder ate confirmar dominio final — registrado em "Perguntas em Aberto"). O QR e montado pelo app a partir do `link` (o backend nao renderiza imagem; entrega a string).
  - `podeIndicar = statusAuditoria === 'APROVADO' && ativo === true` (o programa de indicacao da Parte 4 so credita parceiro APROVADO; o codigo existe sempre, mas a atribuicao so vale quando o parceiro esta operavel).
  - `aviso?` (so quando `podeIndicar === false`): copy curta, sem em-dash, en-GB explicito quando o catalogo i18n D14 existir. Ate la, pt-BR literal: `'Seu cadastro ainda esta em analise. O link de indicacao funciona, mas as comissoes so passam a contar apos a aprovacao.'`
  - **Nao** expoe `comissaoPercentual` ao parceiro nesta rota (o percentual negociado e dado comercial interno; a Parte 4 decide se/como expor a comissao efetiva no extrato da carteira).
- **Erros:** `403` se nao e membro (BOLA); `400 parceiroId obrigatorio quando ha mais de um parceiro` se N>1 e omitido.

> **Por que a exibicao fica aqui e nao na Parte 4 (D15):** o `codigoIndicacao` e identidade do parceiro; ele nasce com o parceiro e o portal e onde ele o divulga. A **atribuicao** (captura do codigo no signup do tutor), o **credito** (que le `comissaoPercentual ?? COMISSAO_PADRAO_PCT`, D16) e a **carteira/saque** sao Parte 4 — essa parte so **consome** o codigo. A rota `/indicacao` nao depende de nada da Parte 4 (so le a coluna + monta link a partir do env), entao e shippable aqui.
>
> **Removido da v0.2:** `GET /parceiro/portal/comissoes`. O valor/saldo de comissao nao existe nesta parte; o endpoint de carteira/extrato e a Parte 4. (D16 reintroduz so o **percentual** como coluna de `Parceiro`, nao um endpoint de carteira.)

### C. Gestao de equipe do parceiro (DONO autenticado) — `parceiro-portal`

> **Gate de status:** rotas de **mutacao** de equipe (`POST` convite, `DELETE` membro) exigem o parceiro estar **operavel** (`statusAuditoria=APROVADO` e `ativo=true`); parceiro `SUSPENSO`/`REJEITADO`/`PENDENTE`/`ativo=false` retorna **409 `Parceiro nao operavel`** (Regra 14, alinha com "portal somente-leitura" do enum). O **aceite de convite** (`PATCH .../aceitar`) **nao** e gated por status (o convidado precisa poder aceitar para que o parceiro `PENDENTE` consiga seu primeiro DONO e seja aprovado).
>
> **Mudanca de papel (promover/rebaixar) esta FORA do escopo desta parte (Regra 19).** Nao ha `PATCH` de papel. DONO so e criado no create (`donoUsuarioId`) ou via convite com `papel=DONO`. **Nenhum caminho desta parte rebaixa um DONO** (o `DELETE` faz soft-delete do membro, nao troca papel), entao a invariante "1 DONO" nao pode ser furada por rebaixamento. Trocar/promover papel e follow-up; quando entrar, aplica a **mesma guarda `FOR UPDATE` da Regra 4** ao rebaixamento de DONO.

#### `POST /parceiro/portal/equipe/convites?parceiroId=`
- **Guard:** `ParceiroGuard` + `assertParceiroDono(parceiroId, userId)` no service + gate de status operavel (Regra 14).
- **Body:** `ConvidarMembroDto { email: string, papel: PapelParceiro }` (`@IsEmail`, `@IsEnum`).
- Resolve o `Usuario` por email (404 se nao existe usuario; convite externo por email fica fora de escopo — ver Perguntas). Entao (Regra 18):
  - se **nao existe** `ParceiroEquipe(parceiroId,usuarioId)`: cria `ParceiroEquipe(status=PENDENTE, papel, ativo=true)`.
  - se existe com `ativo=false` (ex-membro removido): **reativa** via upsert no PK composto (`status=PENDENTE, papel, ativo=true, convidadoPorId`) — **nao** `create` (estouraria P2002 no PK), **nao** 409.
  - se existe com `ativo=true` e `status` em `{ACEITO, PENDENTE}`: `409 Parceiro ja tem esse membro` (ja membro ou ja convidado).
- **Resposta (201):** `data = { parceiroId, usuarioId, papel, status: 'PENDENTE' }`.

#### `PATCH /parceiro/portal/equipe/convites/aceitar?parceiroId=`
- **Guard:** **so `JwtAuthGuard`** (fora do `ParceiroGuard` — ver excecao na secao B; o convidado ainda nao tem membership ACEITO).
- **Query:** `parceiroId` **obrigatorio sempre** (identifica qual convite). **Nao** ha auto-resolucao: `resolveParceiroDoUsuario` so lista memberships **ACEITO**, e o convite a aceitar e **PENDENTE**, entao o helper nao o veria. Se `parceiroId` for omitido -> **400 `parceiroId obrigatorio`** (Regra 20). Isso resolve tambem o caso "usuario com 2 convites PENDENTES em parceiros diferentes": ele e obrigado a dizer qual.
- O **convidado** aceita: `ParceiroEquipe.status PENDENTE -> ACEITO` para o proprio `req.user.userId` no parceiro indicado.
- **Re-aceite / idempotencia (Regra 20):** o segundo `PATCH .../aceitar` do mesmo convite ja nao encontra status `PENDENTE` (ja virou `ACEITO`), entao retorna **404 `Convite nao encontrado`** (nao ha convite PENDENTE desse usuario nesse parceiro). Escolha deliberada: 404 (nao 200 idempotente), consistente com "404 se nao ha convite PENDENTE". AC cobre o re-aceite.
- **Erros:** `400` se `parceiroId` omitido; `404 Convite nao encontrado` se nao ha convite `PENDENTE` desse usuario nesse parceiro (inclui o caso de re-aceite).
- **Resposta:** `data = { parceiroId, status: 'ACEITO' }`.

#### `DELETE /parceiro/portal/equipe/:usuarioId?parceiroId=`
- **Guard:** `ParceiroGuard` + `assertParceiroDono(parceiroId, userId)` + gate de status operavel (Regra 14).
- DONO remove membro (`ativo=false`, soft-delete; a linha `(parceiroId,usuarioId)` permanece e pode ser reativada por re-convite, Regra 18). **BOLA:** alvo `:usuarioId` pertence ao mesmo parceiro + nao e o ultimo DONO ativo. Bloqueia remover o ultimo DONO (`409 Parceiro precisa de pelo menos um dono`, contagem com `FOR UPDATE`, Regra 4).
- **204** sem corpo (`@HttpCode(204)`, padrao do repo; o interceptor envelopa com `data: undefined`).

### D. Auditoria admin — controller `parceiro` existente (`SystemAdminGuard`)

> Adicionadas ao `ParceiroController` ([parceiro.controller.ts](../../../src/cupom/parceiro.controller.ts)), ja `JwtAuthGuard + SystemAdminGuard`.

#### `GET /parceiro/auditoria?status=PENDENTE&cursor=&limit=20`
- Lista parceiros por `statusAuditoria` (default PENDENTE = fila de aprovacao).
- **Resposta:** `data = { data: ParceiroAdminResponse[], meta }`.

#### `POST /parceiro/:id/auditoria/aprovar`
- **Body:** vazio ou `{}` (sem `codigoIndicacao` — ja foi gerado no create, Regra 11, nao se gera/regenera na aprovacao). **A definicao/edicao de `comissaoPercentual` por parceiro (D16) NAO ocorre na aprovacao** — e atributo cadastral do parceiro (definido no create ou via edicao cadastral do CMS, fora desta rota de auditoria); `null` continua valido = default global.
- `statusAuditoria -> APROVADO`, grava `auditadoPorId = req.user.userId`, `auditadoEm = now`. **Pre-condicao da invariante:** so aprova se o parceiro tem >=1 DONO ACEITO ativo; senao `409 Parceiro precisa de pelo menos um dono` (a invariante "1 DONO" so vale a partir de APROVADO — Regra 4). Invalida cache `cupom:tutor:`.
- **Resposta:** `data = ParceiroAdminResponse`.

#### `POST /parceiro/:id/auditoria/rejeitar`
- **Body:** `MotivoAuditoriaDto { motivo: string }` (`@IsString @MinLength(3)`).
- `statusAuditoria -> REJEITADO`, grava `motivoAuditoria`, `auditadoPorId`, `auditadoEm`. Invalida cache `cupom:tutor:`.

#### `POST /parceiro/:id/auditoria/suspender`
- **Body:** `MotivoAuditoriaDto { motivo: string }`.
- `statusAuditoria -> SUSPENSO`. Invalida cache `cupom:tutor:` (cupons do parceiro deixam de aparecer ao tutor; ver Regra 9/10).

> **Efeito na visibilidade do cupom ao tutor:** `whereDisponivel(nivel)` passa a exigir `parceiro.statusAuditoria = APROVADO` **e** `parceiro.ativo = true`. Mudanca de comportamento da listagem — listada em "Breaking Changes".

---

## Regras de Negocio

1. **Criacao de parceiro define DONO, nasce APROVADO no fluxo admin e GERA `codigoIndicacao`.** `POST /parceiro` (admin/CMS) passa a aceitar `donoUsuarioId?` (declarado no `CreateParceiroDto`). Em transacao: cria `Parceiro` com **`statusAuditoria=APROVADO`** (fluxo admin = ja confiavel; resolve o breaking do CMS) + **`codigoIndicacao` gerado (Regra 11)** + `ParceiroEquipe(papel=DONO, status=ACEITO, ativo=true)` se `donoUsuarioId` informado (404 se o usuario nao existe). `comissaoPercentual` nasce `null` (default global `COMISSAO_PADRAO_PCT`, D16) salvo se um valor for explicitamente informado pelo admin/CMS no cadastro. Sem `donoUsuarioId`, cria parceiro **orfao** APROVADO com `codigoIndicacao` ja gerado — permitido **apenas porque o admin liga o dono depois via convite**; a invariante "1 DONO" so se torna exigivel nas transicoes de equipe e na aprovacao explicita (ver Regra 4 e nota de tolerancia abaixo). Fluxos futuros de auto-cadastro (nao admin) nascem `PENDENTE` (mas tambem geram `codigoIndicacao` no create — o codigo e identidade, independe de status).
   > **Tolerancia de orfao APROVADO no fluxo admin:** como o admin cria APROVADO sem dono e liga depois, a invariante da Regra 4 e enforçada nas **transicoes de equipe** (nao deixar cair a zero DONO) e na **aprovacao explicita** (`/aprovar` exige >=1 DONO), nao na criacao crua via `POST /parceiro`. Isso e intencional e documentado: o admin e confiavel para completar o vinculo. AC cobre os dois caminhos (com e sem `donoUsuarioId`).
2. **Vet autonomo = Parceiro com 1 membro DONO.** Nao ha entidade separada. O `Usuario` desse vet pode tambem ter `veterinarioPerfil`; os perfis coexistem.
3. **Papel PARCEIRO deriva de membership, nao do JWT.** `ParceiroGuard` (ou `RolesGuard` da Parte 0) consulta `ParceiroEquipe` por `usuarioId` com `status=ACEITO && ativo=true`. JWT nao muda.
4. **Invariante "pelo menos um DONO ACEITO" para parceiro APROVADO, com bloqueio de corrida.** Remover o ultimo DONO ativo de um parceiro APROVADO e bloqueado (`409 Parceiro precisa de pelo menos um dono`). A contagem de DONOs ativos e feita **dentro de uma transacao com bloqueio de linha** (`SELECT ... FOR UPDATE` via `$queryRaw` na transacao) para evitar que **dois DELETEs concorrentes** removam dois DONOs e deixem zero. `/aprovar` tambem exige >=1 DONO ACEITO antes de mudar para APROVADO. Coberto por integration test de concorrencia (DB real). Parceiro orfao so e tolerado enquanto `PENDENTE` ou no caminho admin da Regra 1. **Nao ha rebaixamento de papel nesta parte (Regra 19)**, entao o unico caminho que pode reduzir DONOs e o `DELETE` de membro, ja guardado aqui.
5. **Resgate / visibilidade — `statusAuditoria` E `parceiro.ativo`, e ordem de avaliacao.** `whereDisponivel(nivel)` passa a incluir **`parceiro: { is: { statusAuditoria: 'APROVADO', ativo: true } }`**. Decisao explicita (corrige a ambiguidade `ativo` vs `statusAuditoria`): **ambos** sao gate de visibilidade — `statusAuditoria` e o credenciamento; `ativo` e o soft-disable manual do parceiro. Um parceiro `ativo=false` **mesmo APROVADO** tem cupons ocultos (antes desta parte `whereDisponivel` nao filtrava `parceiro.ativo`, entao cupons de parceiro desativado apareciam — bug latente corrigido; ver Breaking Changes). A ordem dentro de `resgatar(id, tutorId, dto)`:
   1. `tutorId` null -> `404` (sem chamar `getNivelForTutor`).
   2. resolve `nivel = nivelDoTutor(tutorId)`; busca cupom por `{ id, ...whereDisponivel(nivel) }` com `include parceiro`. Se nao acha -> `404` (cobre inexistente, inelegivel, parceiro nao-APROVADO e parceiro `ativo=false`, sem leak).
   3. transacao: dedupe (uso unico) + decremento atomico + atribuicao (snapshots).
   Nao ha 403 no fluxo do tutor (decisao 404-vs-403 acima, D14).
6. **Resgate — dedupe de uso unico via indice parcial.** Se `usoUnico=true`, no maximo 1 resgate por `(cupomId, tutorId)`, forcado pelo indice unico parcial `WHERE usoUnicoSnapshot=true`; P2002 -> `409 Cupom de uso único já resgatado`. **Cupom de uso multiplo (ilimitado ou com estoque) NAO tem dedupe**: o mesmo tutor pode resgatar de novo (retorna 201). POST repetido em cupom de uso unico retorna 409 (idempotente, sem segundo registro).
7. **Resgate — decremento atomico de estoque.** Quando `usosRestantes != null`, decrementa em transacao com guarda (`updateMany where usosRestantes: { gt: 0 }`; se `count=0` -> `409 Cupom esgotado`). `usosRestantes=null` (ilimitado) nao decrementa.
8. **Resgate — atribuicao (sem comissao).** Grava `parceiroId = cupom.parceiroId`, `descontoPercentualSnapshot = cupom.descontoPercentual`, `usoUnicoSnapshot = cupom.usoUnico`. **Nao** calcula nenhum valor monetario. Atribuicao serve so para o relatorio do portal. A receita de parceiro vem da indicacao (Parte 4), nao do resgate.
9. **Suspensao/rejeicao/desativacao oculta cupom do tutor.** `whereDisponivel` exige `statusAuditoria=APROVADO` + `ativo=true`. Resgates ja feitos permanecem no historico do portal (nao se apagam).
10. **Cache.** Invalidar `cupom:tutor:` em **todas** estas operacoes: resgate (decrementa `usosRestantes`), aprovar, rejeitar e **suspender** parceiro (muda visibilidade). A suspensao **deve** invalidar (senao o cupom suspenso fica visivel ate o TTL de 60s) — ja coberto para `update` ([parceiro.service.ts:37](../../../src/cupom/parceiro.service.ts)); replicar nos novos metodos de auditoria. Listado em Arquivos Impactados e como AC.
11. **`codigoIndicacao`: gerado nesta parte (D15), formato fixado, backfill com retry.** Cada `Parceiro` recebe um `codigoIndicacao` **no create** (admin/CMS e futuros auto-cadastros) e os **legados sao backfillados** (data-migration por linha). Formato: **aleatorio base32 sem ambiguidade**, alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem `0/O/1/I/L`), **10 chars** (~50 bits) via `crypto.randomBytes`; geracao com **retry em P2002** ate inserir unico. **Nao** e `md5(id)` (evita o furo de colisao a 32 bits sem guarda da v0.3). A Parte 4 **so consome** o codigo (captura no signup -> `referidoPorParceiroId`, credito de comissao); **nao** re-gera nem re-deriva nada do id. O dominio/path do link de indicacao vem de `PARCEIRO_INDICACAO_BASE_URL` (env, D15), usado em `GET /parceiro/portal/indicacao`.
12. **Copy sem em-dash; reusar string de erro existente.** Toda mensagem JSON/portal sem em-dash. `motivoAuditoria` e texto livre do admin; exibido como veio. **O resgate reusa a string literal `'Cupom não encontrado'` (com til) ja em uso no `CupomService`** ([cupom.service.ts:77,84,163,193](../../../src/cupom/cupom.service.ts)) para nao criar duas grafias do mesmo erro no mesmo service. Mensagens de erro passam pelo catalogo i18n (D14) quando a Parte 0 entrar; ate la, pt-BR literal sem em-dash.
13. **Aceite de convite fora do `ParceiroGuard`.** `PATCH .../equipe/convites/aceitar` usa so `JwtAuthGuard`; o `ParceiroGuard` (que exige membership ACEITO) bloquearia o primeiro aceite (catch-22, pois o convidado esta PENDENTE). O service valida que ha convite `PENDENTE` do proprio `userId` no `parceiroId` (404 senao). Implementado via decorator `@SkipParceiroGuard()` lido pelo guard, ou rota fora do controller guardado.
14. **Parceiro nao-operavel bloqueia mutacao de equipe.** Convidar/remover membro exige `statusAuditoria=APROVADO && ativo=true`; caso contrario `409 Parceiro nao operavel` (alinha com "portal somente-leitura" do enum para SUSPENSO/REJEITADO). GETs do portal continuam acessiveis para o membro ver status/historico/indicacao. O **aceite** de convite e a unica mutacao **nao** gated por status (necessario para um parceiro PENDENTE conseguir seu primeiro DONO).
15. **`/indicacao` exibe o codigo a DONO e OPERADOR; `podeIndicar` reflete operabilidade.** A rota `GET /parceiro/portal/indicacao` e visivel a qualquer membro ACEITO (DONO ou OPERADOR) — e info de divulgacao, nao mutacao. `podeIndicar = APROVADO && ativo`; quando false, retorna `aviso` (sem em-dash, en-GB explicito no catalogo D14). O `link` usa `PARCEIRO_INDICACAO_BASE_URL` (env). **A atribuicao/comissao a partir desse codigo e Parte 4** (esta parte so exibe o codigo; a Parte 4 le `comissaoPercentual ?? COMISSAO_PADRAO_PCT` no credito, D16).
16. **Janela "cupom deletado durante o resgate" (aceito).** Lookup e insert do `CupomResgate` rodam na mesma transacao -> janela minima. Se o cupom for deletado entre os dois, a FK falha (`onDelete: Cascade`), a transacao reverte e o filtro Prisma global mapeia (P2025/FK) para erro generico. Estado raro, nao deixa linha invalida. **Decisao: aceitar como improvavel; sem codigo extra.** Documentado para nao virar surpresa.
17. **Seed nasce APROVADO (OBRIGATORIO).** O seed (`seedCupons`, [seed.ts:251-255](../../../prisma/seed.ts)) passa a setar `statusAuditoria: 'APROVADO'` no `create` **e** no `update` do upsert: `parceiro.upsert({ where:{nome}, create:{ nome, statusAuditoria:'APROVADO' }, update:{ statusAuditoria:'APROVADO' } })`. Sem isso, apos `migrate reset` + seed os parceiros seedados nascem PENDENTE (default DB) e seus cupons somem de `GET /tutor/cupons`, quebrando o dev local, o CI e o smoke de resgate (T10). `comissaoPercentual` do seed fica `null` (default global; nao precisa setar). AC dedicado: "apos `migrate reset` + seed, `GET /tutor/cupons` retorna os cupons seedados".
18. **Re-convite de ex-membro removido reativa (nao 409).** Como o `DELETE` de membro e soft-delete (`ativo=false`) e a PK e composta `(parceiroId,usuarioId)`, a linha permanece. Ao re-convidar esse usuario, o service faz **upsert/reativacao** (`status=PENDENTE, ativo=true, papel, convidadoPorId`) — **nao** `create` (estouraria P2002 no PK). So retorna `409 Parceiro ja tem esse membro` quando a linha existe com `ativo=true` e status em `{ACEITO, PENDENTE}` (ja membro ou ja convidado). AC: "re-convidar ex-membro removido funciona (vira PENDENTE de novo)".
19. **Sem mudanca de papel nesta parte (fora de escopo, mas seguro).** Nao ha `PATCH` de papel (promover OPERADOR->DONO ou rebaixar DONO->OPERADOR). DONO so nasce no create (`donoUsuarioId`) ou via convite com `papel=DONO`. **Nenhum caminho desta parte rebaixa um DONO**, entao a invariante "1 DONO" (Regra 4) nao pode ser furada por rebaixamento. Quando um `PATCH` de papel for adicionado (follow-up), ele **deve** aplicar a mesma guarda `FOR UPDATE` da Regra 4 ao rebaixamento do ultimo DONO. Registrado em "Perguntas em Aberto".
20. **Aceite de convite: `parceiroId` obrigatorio; re-aceite -> 404.** `PATCH .../aceitar` exige `parceiroId` sempre (sem auto-resolucao, pois `resolveParceiroDoUsuario` so ve ACEITO e o convite e PENDENTE); omitir -> `400 parceiroId obrigatorio`. Isso cobre o caso de usuario com 2 convites PENDENTES em parceiros diferentes (ele e obrigado a escolher). O **re-aceite** (segundo `PATCH` do mesmo convite) ja nao acha status PENDENTE (virou ACEITO) -> `404 Convite nao encontrado` (deliberadamente nao-idempotente-200, consistente com "404 se nao ha convite PENDENTE"). AC cobre os dois casos.
21. **`comissaoPercentual` configuravel por parceiro (D16) — so o percentual, nada de saldo.** `Parceiro.comissaoPercentual Float?` e atributo cadastral: `null` = usa o default global `COMISSAO_PADRAO_PCT = 5%` (constante/env definida na Parte 4). **Esta parte so cria a coluna** (e a aceita no create se informada); **nao calcula nem credita comissao** (isso e Parte 4, que le `parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT`). **Nao existe** `comissaoAcumuladaCentavos`/saldo no `Parceiro`: o bruto/saldo vem do **ledger da Parte 4** (dinheiro em centavos, no ledger). O percentual deixa de ser hardcoded e permite negociacao comercial por parceiro sem deploy. Cupom/`CupomResgate` continuam sem comissao (D13 intacto).

---

## Autorizacao / BOLA (por rota)

> Esta parte introduz uma nova dimensao de ownership (parceiro via membership), entao **cria asserts novos** no `OwnershipService`. **403 para ownership autenticado; 404 generico para lookup por codigo publico de cupom** (D14).

**Asserts novos a criar em `OwnershipService`:**
- `assertParceiroMembership(parceiroId, userId, isAdmin=false): Promise<{ papel: PapelParceiro }>` — busca `ParceiroEquipe(parceiroId, usuarioId=userId, status=ACEITO, ativo=true)`; se nao existe e nao admin -> `deny` (403, padrao [ownership.service.ts:23-28](../../../src/auth/services/ownership.service.ts)). Retorna o papel para o caller distinguir DONO/OPERADOR.
- `assertParceiroDono(parceiroId, userId, isAdmin=false)` — como acima exigindo `papel=DONO`.
- `resolveParceiroDoUsuario(userId): Promise<string[]>` — helper (nao assert) que lista ids de parceiros ativos (membership ACEITO+ativo) do usuario; usado para resolver `?parceiroId=` ausente (1 parceiro -> auto; N -> `400`; 0 nunca chega aqui pois o guard ja deu 403). **Nao** resolve a rota de aceite (la o convite e PENDENTE, fora deste helper — Regra 20).

| Rota | Quem | Checagem BOLA |
|---|---|---|
| `POST /tutor/cupons/:id/resgatar` | tutor | `req.user.tutorId` do JWT; cupom resolvido por `whereDisponivel` (404 sem leak). Nao recebe id de outro tutor. |
| `GET /parceiro/portal/dashboard\|cupons\|resgates\|status\|indicacao` | parceiro | `ParceiroGuard` (403 se zero membership ACEITO) roda antes. `assertParceiroMembership(parceiroId, userId)` no service. `parceiroId` (query) **sempre** validado contra membership; nunca confiado cru. N parceiros -> exige `?parceiroId=` (400 se omitido). N=0 -> 403 do guard (nunca 400). |
| `POST /parceiro/portal/equipe/convites` | DONO | `ParceiroGuard` + `assertParceiroDono` (403 para OPERADOR/nao membro) + gate operavel (409 se nao-APROVADO/`ativo=false`). |
| `PATCH /parceiro/portal/equipe/convites/aceitar` | convidado | **so `JwtAuthGuard`** (fora do `ParceiroGuard`, Regra 13). `parceiroId` obrigatorio (400 se omitido, Regra 20). Resolve membership PENDENTE do proprio `userId` no `parceiroId` dado (404 senao / re-aceite); sem id de outro usuario. |
| `DELETE /parceiro/portal/equipe/:usuarioId` | DONO | `ParceiroGuard` + `assertParceiroDono(parceiroId, userId)` + gate operavel + alvo `:usuarioId` pertence ao mesmo parceiro + nao e o ultimo DONO ativo (Regra 4, com bloqueio). |
| `GET /parceiro/auditoria`, `POST /parceiro/:id/auditoria/*` | admin | `SystemAdminGuard` (ja existente). Admin = `isAdmin=true`. 403 para nao-admin. |

**Nota anti-IDOR:** nas rotas guardadas do portal o `parceiroId` **nunca** e usado direto do cliente sem `assertParceiroMembership`. **Precedencia:** `ParceiroGuard` (403 se zero ACEITO) -> resolucao de `?parceiroId=` (400 se N>1) -> `assert*` (403 se nao e do usuario). Rodar o agent `security-auditor` (criterio de aceite no DoD: zero findings de severidade >= media).

---

## Riscos e Mitigacoes

| Nivel | Risco | Mitigacao |
|---|---|---|
| Alta | `whereDisponivel` exigir `APROVADO`+`ativo` faz cupons sumirem (parceiro novo PENDENTE; legados desativados; **seed PENDENTE apos `migrate reset`**) | Parceiro criado por admin nasce `APROVADO`+`ativo=true` (Regra 1); backfill `UPDATE` na **migration** marca legados APROVADO; **seed atualizado (OBRIGATORIO, Regra 17)** nasce APROVADO. Sem o seed, dev/CI/smoke quebram no dia 1. Listado em Breaking Changes; teste de regressao em `cupom.service.spec` + AC de smoke "seed -> cupons visiveis". |
| Alta | Colisao 404 vs 403 no resgate de parceiro nao-APROVADO/desativado | Padronizado **404** (parceiro nao-APROVADO/`ativo=false` nao passa em `whereDisponivel`, igual a listagem, sem leak; D14). 403 reservado a ownership autenticado (portal). AC e testes alinhados a 404. |
| Alta | Dedupe global `(cupomId,tutorId)` daria 409 errado em cupom ilimitado resgatado 2x | Indice unico **parcial** `WHERE usoUnicoSnapshot=true` (coluna denormalizada). So cupom de uso unico deduplica; uso multiplo permite N resgates. Nome do indice reflete a coluna real. |
| Alta | Portal depende de `RolesGuard`/`@Roles` + catalogo de erro (Parte 0) inexistentes | `ParceiroGuard` local entregue nesta parte (T0/AC); mensagens em pt-BR literal ate o catalogo D14 existir (reusa string `'Cupom não encontrado'` existente). Parte 3 shippable sem Parte 0; migracao registrada como divida. |
| Alta | **Colisao/contradicao de schema com a Parte 4** (quem cria `codigoIndicacao` / `comissaoPercentual` / colunas de saldo) | Resolvido por D15/D16 + "Contrato com a Parte 4": **`codigoIndicacao` e criado+gerado+backfillado aqui (Parte 3, D15)**; **`comissaoPercentual Float?` e criada aqui (Parte 3, D16)** e a Parte 4 so a le (`?? COMISSAO_PADRAO_PCT`). A Parte 4 NAO re-adiciona nem re-gera essas colunas. O **saldo** (`comissaoAcumuladaCentavos`/ledger) e 100% da Parte 4 e deve entrar no schema diff **da Parte 4**, nao como "reuse da Parte 3". Referencia a `computeComissao` stub na Parte 3 e obsoleta (nao existe) e deve sair da Parte 4. |
| Alta | Backfill de `codigoIndicacao` com `md5(id)` (32 bits, sem guarda) podia abortar a migration por colisao no `@unique` (Supabase, sem rollback) | Formato trocado para **aleatorio base32 (~50 bits) com retry em P2002** como **data-migration por linha** (nao `UPDATE` SQL puro). Unicidade garantida; backfill nunca aborta por colisao. Formato fixado aqui (D15), Parte 4 so le. |
| Alta | Catch-22 no aceite do primeiro convite (`ParceiroGuard` exige ACEITO, mas o convidado esta PENDENTE) | Rota de aceite **fora** do `ParceiroGuard` (so `JwtAuthGuard`), valida convite PENDENTE no service (Regra 13). AC cobre primeiro aceite de usuario sem nenhuma membership ACEITO. |
| Media | Re-convite de ex-membro removido (`ativo=false`) estourava P2002 no PK composto -> 409 errado "ja membro" | Convite faz **upsert/reativacao** quando existe linha `ativo=false` (Regra 18); 409 so quando `ativo=true` e status ACEITO/PENDENTE. AC "re-convidar ex-membro funciona". |
| Media | Aceite ambiguo (usuario com 2 convites PENDENTES) / re-aceite indefinido | `parceiroId` **obrigatorio** no aceite (400 se omitido); re-aceite -> 404 (status ja nao e PENDENTE). Regra 20 + AC dos dois casos. |
| Media | `donoUsuarioId?` novo em `CreateParceiroDto` quebra CMS com `forbidNonWhitelisted` | Campo **opcional** declarado no DTO; payloads atuais (sem o campo) seguem validos. CMS listado em Breaking Changes como consumidor do campo opcional. AC cobre create com e sem `donoUsuarioId`. |
| Media | Ambiguidade `parceiro.ativo` vs `statusAuditoria` (parceiro `ativo=false`+APROVADO exibiria cupom) | `whereDisponivel` passa a exigir **ambos** `APROVADO` e `ativo=true` (Regra 5). AC cobre `ativo=false`+APROVADO -> cupom oculto e resgate 404. Documentado como correcao de bug latente. |
| Media | Mutacao de equipe em parceiro SUSPENSO/REJEITADO (enum diz "so-leitura" mas nada enforça) | Gate de status nas mutacoes (Regra 14): convite/remocao exigem APROVADO+ativo (409 `Parceiro nao operavel`); aceite e GETs livres. AC cobre convite em SUSPENSO -> 409. |
| Media | Escopo de **calculo/saldo** de comissao vazar para esta parte por engano | Calculo/credito/saldo de comissao **removidos** do schema/endpoints/regras (D13). `CupomResgate.parceiroId` e so atribuicao para relatorio. **D16 reintroduz APENAS o percentual configuravel** (`Parceiro.comissaoPercentual Float?`, so o percentual, nada de saldo); o calculo/credito/ledger continuam Parte 4. AC asserta ausencia de campo de **valor/saldo** de comissao no resgate e no portal e presenca da coluna `comissaoPercentual` no `Parceiro`. |
| Media | PII: ref de tutor reversivel (cuid enumeravel / hash sem salt) | `ResgateResponse` **nao** exporta nada derivado de `tutorId`. So `resgateId` (cuid da propria linha). HMAC com chave-por-parceiro fica como follow-up. AC de nao-reversibilidade (allow-list `toEqual`). |
| Media | Race em 2 DELETEs concorrentes deixa 0 DONOs | Transacao com bloqueio de linha (`FOR UPDATE`) na contagem de DONOs (Regra 4); integration test de concorrencia. Invariante atrelada a APROVADO. Sem rebaixamento de papel nesta parte (Regra 19), o `DELETE` e o unico caminho. |
| Media | Corrida no decremento de `usosRestantes` (duplo resgate concorrente) | `updateMany where usosRestantes: { gt: 0 }` atomico + transacao; `count=0` -> 409. Integration test com DB real. |
| Media | Drift epico (criterio de sucesso ainda cita comissao no resgate) | Divida registrada (Breaking Changes + Perguntas + CHANGELOG): atualizar epico para v0.2 (so o criterio de sucesso; o DoD que cita codigo de indicacao na Parte 3 **continua correto** por D15). D13/D14/D15/D16 prevalecem sobre o corpo v0.1. |
| Baixa | `whereDisponivel` agora faz JOIN + condicao na relacao `parceiro` (`is: { statusAuditoria, ativo }`) na listagem de cupom | Catalogo pequeno + cache 60s -> custo trivial. **Confirmar via `EXPLAIN`** que o JOIN nao degrada. Opcional: `@@index([statusAuditoria, ativo])` em `Parceiro` se o volume crescer. Documentado; nao bloqueante. |
| Baixa | Cupom deletado durante o resgate (FK no insert) | Lookup+insert na mesma transacao -> janela minima; FK falha -> transacao reverte -> filtro mapeia (P2025/FK). Estado raro, nao deixa linha invalida. Aceito (Regra 16); sem codigo extra. |
| Baixa | Suspender parceiro nao invalida cache -> cupom visivel ate 60s | `cache.invalidatePrefix('cupom:tutor:')` em aprovar/rejeitar/suspender (Regra 10, Arquivos Impactados, AC). |
| Baixa | Vazamento de PII de tutor no portal | Allow-list mapper sem `tutorId`/email; teste asserta ausencia. |
| Baixa | `categoria`/`titulo` do portal sem contrato definido | `categoria` enum cru (igual ao `mapToResponse`); `titulo` cru sem i18n (visao do dono). Documentado no contrato de `CupomParceiroResponse`. |
| Baixa | `comissaoPercentual` com valor invalido (negativo, > 100, ou unidade ambigua %vs fracao) | Documentar a unidade (percentual, ex.: `5.0` = 5%, nao `0.05`) no comentario do schema e na Parte 4 (que faz o calculo). Se o create/edicao aceitar o valor, validar `@IsNumber` + faixa `@Min(0) @Max(100)` no DTO quando a edicao por CMS entrar (follow-up; nesta parte a coluna so existe + aceita no create). |

---

## Requisitos Nao-Funcionais (aplicaveis)

- **Seguranca/PII:** portal do parceiro **nunca** expoe `tutorId` cru nem qualquer ref derivada reversivel, nome ou email de tutor. Negacoes de ownership logadas WARN (padrao `OwnershipService.deny`). `codigoIndicacao` e publico por natureza (o parceiro divulga); nao e PII. `comissaoPercentual` e dado comercial interno; nao e exposto no fluxo do tutor nem nas rotas de leitura do portal nesta parte.
- **Atomicidade:** resgate e uma transacao (`prisma.$transaction`): decremento de estoque + insercao de `CupomResgate` (com snapshots de atribuicao). Tudo ou nada. Criacao de parceiro com DONO + geracao de `codigoIndicacao` e atomica (parceiro + membership + codigo na mesma transacao; retry de unicidade do codigo dentro da transacao ou pre-geracao com checagem). Remocao de DONO transacional com bloqueio.
- **Dinheiro em centavos:** nenhum valor monetario e calculado/armazenado nesta parte (resgate nao gera comissao; `comissaoPercentual` e percentual, nao centavos). Quando a Parte 4 calcular comissao, todo valor monetario (saldo/credito/ledger) e em **centavos**.
- **Performance:** queries do portal com `select` explicito. Paginacao cursor-based. `@@index([parceiroId])` em `CupomResgate` para o dashboard/resgates. JOIN de `whereDisponivel` na relacao `parceiro` confirmado por `EXPLAIN` (volume pequeno; indice opcional documentado).
- **Observabilidade:** logar (sem PII) resgate criado, mudanca de `statusAuditoria`, eventos de equipe e negacoes BOLA.
- **i18n:** ver abaixo. Sem string de valor/saldo de comissao (calculo removido). A copy do `aviso` de `/indicacao` (parceiro nao-operavel) e a unica copy de conteudo nova; en-GB explicito no catalogo D14 quando entrar.

### i18n

> **Mensagens de erro passam pelo catalogo i18n (D14)** — pt-BR/en-US/en-GB/es-419, **en-GB explicito** (regra de memoria do Nicolas, nunca via fallback). O catalogo e deliverable da Parte 0 ([epico:125](../epicos/acesso-compartilhamento-e-parcerias.md)); ate ele existir, as mensagens saem em pt-BR literal (sem em-dash) e migram quando a Fundacao entrar. As chaves de erro desta parte a registrar no catalogo:
> - `cupom.nao_encontrado` -> string atual literal **`'Cupom não encontrado'`** (com til), ja em uso ([cupom.service.ts:77,84,163,193](../../../src/cupom/cupom.service.ts)) — **reusar verbatim**, nao criar grafia divergente.
> - `cupom.uso_unico_ja_resgatado` -> `'Cupom de uso único já resgatado'`.
> - `cupom.esgotado` -> `'Cupom esgotado'`.
> - `parceiro.precisa_de_dono` -> `'Parceiro precisa de pelo menos um dono'`.
> - `parceiro.nao_operavel` -> `'Parceiro nao operavel'`.
> - `parceiro.ja_membro` -> `'Parceiro ja tem esse membro'`.
> - `convite.nao_encontrado` -> `'Convite nao encontrado'`.
> - `portal.parceiroId_obrigatorio` -> `'parceiroId obrigatorio'` (aceite de convite, Regra 20).
> - `portal.parceiroId_obrigatorio_multiplos` -> `'parceiroId obrigatorio quando ha mais de um parceiro'`.
>
> **Copy de conteudo (nao-erro) nova:** o `aviso` de `GET /parceiro/portal/indicacao` para parceiro nao-operavel:
> - `parceiro.indicacao.aviso_nao_operavel` -> pt-BR literal `'Seu cadastro ainda esta em analise. O link de indicacao funciona, mas as comissoes so passam a contar apos a aprovacao.'` (sem em-dash; en-GB explicito quando o catalogo D14 entrar).

---

## Acceptance Criteria

**Schema/migration**
- [ ] Existe enum `StatusAuditoriaParceiro` (PENDENTE/APROVADO/REJEITADO/SUSPENSO) e `PapelParceiro` (DONO/OPERADOR).
- [ ] `Parceiro` tem `cnpj? @unique`, `statusAuditoria @default(PENDENTE)`, `auditadoPorId?`, `auditadoEm?`, `motivoAuditoria?`, `codigoIndicacao? @unique`, **`comissaoPercentual Float?` (nullable, sem default; `null` = default global `COMISSAO_PADRAO_PCT`, D16)**. **Nao** tem `comissaoAcumuladaCentavos`/coluna de saldo (saldo = ledger da Parte 4).
- [ ] Apos a migration + backfill, **todos os `Parceiro` tem `codigoIndicacao` nao-null e unico** (gerado no create; legados backfillados por linha com retry — D15). Formato: base32 sem ambiguidade, 10 chars. `comissaoPercentual` dos legados permanece `null` (default global; sem backfill).
- [ ] Existe tabela `ParceiroEquipe` com `@@id([parceiroId, usuarioId])`, `papel`, `status` (reusa `StatusConvite`), `ativo`, `convidadoPorId?`.
- [ ] `CupomResgate` tem `parceiroId?`, `descontoPercentualSnapshot?`, `usoUnicoSnapshot Boolean @default(false)`. **Nao** tem `comissaoCentavos`/`comissaoPercentualSnapshot`.
- [ ] Existe **indice unico parcial** chamado `CupomResgate_cupomId_tutorId_usoUnicoSnapshot_key` `WHERE "usoUnicoSnapshot" = true` em `(cupomId, tutorId)` — **nao** unique global; nome reflete a coluna real.
- [ ] Migration aplica sem erro em `CupomResgate` vazia; aborta com mensagem clara se houver duplicata de uso unico.
- [ ] Migration faz `UPDATE "Parceiro" SET "statusAuditoria"='APROVADO'` em **todos** os parceiros legados (nao some cupom ja publicado, inclusive os criados pelo CMS em runtime). O backfill de `codigoIndicacao` roda como **data-migration por linha** (retry em P2002), nao `UPDATE` SQL puro. `comissaoPercentual` e adicionada como coluna nullable sem default (nao precisa de backfill).

**Seed**
- [ ] Apos `migrate reset` + `prisma db seed`, `GET /tutor/cupons` retorna os cupons seedados (`PETJOURNEY20` etc.) — o seed cria os parceiros com `statusAuditoria='APROVADO'` (no `create` **e** no `update` do upsert, Regra 17) e `codigoIndicacao` gerado. `comissaoPercentual` seedado fica `null` (default global).

**Criacao de parceiro / DONO / codigoIndicacao / comissaoPercentual** (Given/When/Then)
- [ ] Given `POST /parceiro` (admin) **com** `donoUsuarioId` valido, When cria, Then cria `Parceiro(statusAuditoria=APROVADO, codigoIndicacao gerado e unico)` + `ParceiroEquipe(papel=DONO,status=ACEITO,ativo=true)` na mesma transacao; `donoUsuarioId` inexistente -> 404.
- [ ] Given `POST /parceiro` (admin) **sem** `donoUsuarioId`, When cria, Then cria parceiro **orfao** `APROVADO` (admin liga o dono depois via convite) com `codigoIndicacao` ja gerado e unico.
- [ ] Given `POST /parceiro` **sem** informar `comissaoPercentual`, When cria, Then `comissaoPercentual` fica `null` (a Parte 4 usara o default global `COMISSAO_PADRAO_PCT`, D16). A coluna existe e aceita um valor explicito quando informado (sem disparar `forbidNonWhitelisted` se declarada no DTO).
- [ ] `CreateParceiroDto` aceita `donoUsuarioId?` sem disparar `forbidNonWhitelisted` 400; payload sem o campo continua valido (retrocompat).

**Indicacao (codigo nasce e e exibido aqui — D15)**
- [ ] Todo parceiro criado nesta parte recebe `codigoIndicacao` no create (unico, retry em colisao); nenhum permanece null apos o backfill.
- [ ] `GET /parceiro/portal/indicacao` retorna `{ codigoIndicacao, link, podeIndicar, aviso? }`; `link` usa `PARCEIRO_INDICACAO_BASE_URL`; DONO **e** OPERADOR acessam (membro ACEITO); nao-membro -> 403; parceiro nao-operavel -> `podeIndicar=false` + `aviso` (sem em-dash). A **atribuicao/comissao** a partir do codigo NAO esta nesta parte (Parte 4 consome, lendo `comissaoPercentual ?? COMISSAO_PADRAO_PCT`).

**Resgate** (Given/When/Then)
- [ ] Given tutor elegivel e cupom **ilimitado** de parceiro APROVADO+ativo, When `POST .../resgatar` **duas vezes**, Then ambas retornam 201 e criam 2 `CupomResgate` com `parceiroId` preenchido (cupom de uso multiplo nao deduplica).
- [ ] Given cupom `usoUnico=true` ja resgatado por esse tutor, When resgata de novo, Then 409 `Cupom de uso único já resgatado` e nenhum segundo registro.
- [ ] Given cupom `usosRestantes=1`, When dois resgates concorrentes, Then exatamente 1 sucede e o outro recebe 409 `Cupom esgotado`; `usosRestantes` final = 0 (nunca negativo).
- [ ] Given cupom de parceiro `SUSPENSO`/`REJEITADO`/`PENDENTE` **ou** `ativo=false`, When resgata, Then **404 `Cupom não encontrado`** (nao passa em `whereDisponivel`; sem leak; sem 403).
- [ ] Given `tutorId` null (vet/admin), When resgata, Then 404 sem chamar `getNivelForTutor`.
- [ ] Given cupom inexistente/inelegivel, When resgata, Then 404 sem vazar existencia, com a string literal `'Cupom não encontrado'`.
- [ ] Cada resgate grava `descontoPercentualSnapshot`, `usoUnicoSnapshot`, `parceiroId`; nenhum campo de comissao e gravado no resgate (resgate nao gera comissao).

**Portal**
- [ ] `GET /parceiro/portal/dashboard` retorna totais do **proprio** parceiro (`cuponsAtivos, resgatesTotal, resgatesUltimos30d`, **sem** valor/saldo de comissao); usuario sem membership ACEITO recebe 403 (do `ParceiroGuard`).
- [ ] `GET /parceiro/portal/cupons`: item allow-list `{ id, codigo, titulo, descontoPercentual, categoria, validoAte, ativo, usoUnico, usosRestantes?, totalResgates }`; `categoria` enum cru; `titulo` sem i18n; sem `traducoes`/`planoMinimoNivel`/`parceiroId`.
- [ ] `GET /parceiro/portal/resgates`: `expect(item).toEqual({ resgateId, cupomCodigo, canal, descontoPercentualSnapshot?, resgatadoEm })` — allow-list exata; asserta **ausencia** de `tutorId`, `tutorRef`, `email`, `nome`, `comissaoCentavos` (`expect(item).not.toHaveProperty('tutorId')` etc.).
- [ ] Parceiro A com `?parceiroId=<B>` recebe 403 (BOLA).
- [ ] Usuario com 2 parceiros ativos chamando `/dashboard` **sem** `?parceiroId=` recebe 400; com `?parceiroId=` valido recebe 200 do parceiro correto.
- [ ] Usuario com **zero** membership ACEITO (so PENDENTE) chamando qualquer GET do portal recebe **403** (guard), nunca 400.

**Auditoria admin**
- [ ] `POST /parceiro/:id/auditoria/aprovar` muda status para APROVADO, grava `auditadoPorId/auditadoEm`; exige >=1 DONO ACEITO ativo (senao 409). **Nao** regera `codigoIndicacao` (ja existe) e **nao** define/altera `comissaoPercentual` (atributo cadastral, nao de auditoria).
- [ ] `POST .../rejeitar` e `.../suspender` exigem `motivo` (>=3 chars, senao 400) e gravam `motivoAuditoria`.
- [ ] Apos `suspender`, `cache.invalidatePrefix('cupom:tutor:')` e chamado e `GET /tutor/cupons` **nao** retorna o cupom do parceiro (sem esperar TTL).
- [ ] Rotas de auditoria exigem `SystemAdminGuard` (403 para nao-admin).

**Equipe**
- [ ] DONO de parceiro **APROVADO+ativo** convida por email existente -> `ParceiroEquipe(PENDENTE)`; convidado aceita -> ACEITO. Convite a email inexistente -> 404.
- [ ] **Re-convidar ex-membro removido** (`ativo=false`) reativa o vinculo (volta a `PENDENTE/ativo=true`), nao retorna 409 (Regra 18).
- [ ] Convidar membro **ativo** ja ACEITO/PENDENTE -> 409 `Parceiro ja tem esse membro`.
- [ ] **Primeiro aceite:** usuario sem nenhuma membership ACEITO consegue `PATCH .../aceitar?parceiroId=` seu convite PENDENTE (rota fora do `ParceiroGuard`); apos aceitar, vira membro ACEITO.
- [ ] **Aceite sem `parceiroId`** -> 400 `parceiroId obrigatorio`. **Re-aceite** (segundo PATCH do mesmo convite) -> 404 `Convite nao encontrado` (status ja nao e PENDENTE). (Regra 20.)
- [ ] Convite/remocao de equipe em parceiro `SUSPENSO`/`REJEITADO`/`ativo=false` -> 409 `Parceiro nao operavel`.
- [ ] Remover o ultimo DONO ativo retorna 409 `Parceiro precisa de pelo menos um dono`.
- [ ] Dois DELETEs concorrentes do penultimo+ultimo DONO nao deixam 0 DONOs (integration, DB real).

**Geral**
- [ ] Nenhum endpoint/shape existente quebra, exceto: (a) adicao de `statusAuditoria=APROVADO`+`ativo=true` ao filtro de disponibilidade; (b) `donoUsuarioId?` opcional novo no `CreateParceiroDto`. Ambos em "Breaking Changes". (A coluna `comissaoPercentual` e aditiva e nao muda nenhum shape de resposta.)
- [ ] `grep` por em-dash (U+2014) em copy de resposta/i18n/portal retorna vazio: `rg $'—' src/parceiro-portal src/cupom/dto src/cupom/parceiro.service.ts` sem match.
- [ ] `security-auditor` rodado com **zero findings de severidade >= media** nas rotas novas.

---

## Estrategia de Testes

**Unit (`*.spec.ts`, Prisma mockado — testing.md)**
- `cupom.service.spec.ts` (resgate): happy ilimitado; **segundo resgate de cupom ilimitado -> 201** (nao 409); uso unico dedup (segundo resgate 409 via P2002 do indice parcial); esgotado (`updateMany count=0` -> 409); parceiro nao-APROVADO -> **404**; parceiro `ativo=false`+APROVADO -> **404**; `tutorId` null -> 404 sem chamar `getNivelForTutor`; string de erro = `'Cupom não encontrado'` literal; atribuicao grava `parceiroId`+`descontoPercentualSnapshot`+`usoUnicoSnapshot`; nenhum campo de comissao gravado no resgate.
- `parceiro.service.spec.ts` (auditoria + create + codigo): aprovar/rejeitar/suspender gravam status + trilha; rejeitar/suspender sem motivo -> 400 (DTO); aprovar sem DONO ACEITO -> 409; **suspender chama `invalidatePrefix('cupom:tutor:')`**; create admin com `donoUsuarioId` cria parceiro+DONO em transacao e nasce `APROVADO` com `codigoIndicacao` gerado e `comissaoPercentual=null`; create sem `donoUsuarioId` cria orfao APROVADO com `codigoIndicacao` gerado; create com `comissaoPercentual` informado persiste o valor; **geracao de `codigoIndicacao` re-tenta em P2002** (mock force colisao 1x -> sucesso no 2o); aprovar **nao** regera codigo nem altera `comissaoPercentual`.
- `parceiro-portal.service.spec.ts`: dashboard scoped ao parceiro do usuario (sem valor de comissao); `/dashboard` sem `parceiroId` e N>1 -> 400; resgates allow-list exata (sem `tutorId`/`tutorRef`/email/comissao); cupons com `categoria` cru e `titulo` sem i18n; **`/indicacao` retorna `codigoIndicacao`+`link` (env), `podeIndicar` reflete operavel, OPERADOR tambem ve, sem expor `comissaoPercentual`**; convite cria PENDENTE; **re-convite de ex-membro (`ativo=false`) reativa**; convite a membro ativo -> 409; convite em parceiro SUSPENSO -> 409; primeiro aceite (sem membership ACEITO previa) funciona; **aceite sem `parceiroId` -> 400; re-aceite -> 404**; remover ultimo DONO -> 409.
- `ownership.service.spec.ts`: `assertParceiroMembership` happy + deny (403) sem membership ACEITO + isAdmin bypass; `assertParceiroDono` deny para OPERADOR. (Cada assert novo testa "ator errado".)
- `parceiro.guard.spec.ts`: libera com membership ACEITO+ativo; 403 com zero ACEITO; **pula** a rota de aceite (metadata `@SkipParceiroGuard()`).
- Regressao `cupom.service.spec.ts`: listagem retorna cupom de parceiro APROVADO+ativo; **nao** retorna de parceiro nao-APROVADO nem `ativo=false`.

**Integration (`*.integration.spec.ts`, Postgres real — nunca mockar banco, testing.md)**
- Resgate concorrente real: 2 transacoes paralelas em cupom `usosRestantes=1` -> exatamente 1 sucesso, estoque final 0, sem linha duplicada.
- Indice unico parcial real: segundo insert de uso unico `(cupomId, tutorId)` lanca P2002; insert de cupom **uso multiplo** `(cupomId, tutorId)` repetido **nao** lanca (passa).
- Remocao concorrente de DONO: 2 DELETEs paralelos do penultimo+ultimo DONO -> nunca 0 DONOs ativos (valida o `FOR UPDATE`).
- Migration + backfill: aplicar em base com parceiros legados confirma todos -> `APROVADO`, todos `codigoIndicacao` nao-null e unicos (backfill por linha), `comissaoPercentual` nullable presente (legados `null`), indice parcial criado com o nome esperado.
- Re-convite real: remover membro (`ativo=false`) e re-convidar o mesmo usuario nao estoura P2002 no PK composto; vira PENDENTE de novo.

**Smoke (`scripts/test-*.ts`, HTTP+DB real)**
- `scripts/test-resgate-smoke.ts`: **`migrate reset` + seed -> `GET /tutor/cupons` lista os cupons seedados** (parceiro seedado nasce APROVADO+ativo, Regra 17); seed parceiro APROVADO + cupom; token tutor; `POST .../resgatar` -> 201; repetir uso unico -> 409; repetir uso multiplo -> 201; conferir envelope `{ statusCode, message, data }`.
- Smoke do portal: token de DONO -> dashboard/cupons/resgates/status/indicacao retornam so o proprio parceiro; resgates sem `tutorId`; `/indicacao` traz `codigoIndicacao`+`link`; primeiro aceite de convite por token de convidado.

---

## Arquivos Impactados

| Arquivo | Acao | Descricao |
|---|---|---|
| `prisma/schema.prisma` | Modificar | Enums; colunas `Parceiro` (`cnpj`, `statusAuditoria`, trilha, `codigoIndicacao`, **`comissaoPercentual Float?`** D16); tabela `ParceiroEquipe`; colunas + `usoUnicoSnapshot` em `CupomResgate`; relacoes reversas em `Usuario` |
| `prisma/migrations/20260624120000_parceiro_identidade_equipe_auditoria/migration.sql` | Criar | DDL aditivo (incl. `Parceiro.comissaoPercentual DOUBLE PRECISION NULL`) + **UPDATE backfill APROVADO** + guarda anti-duplicata + indice unico **parcial** `CupomResgate_cupomId_tutorId_usoUnicoSnapshot_key` |
| `prisma/migrations/20260624120000_.../backfill-codigo-indicacao.ts` (ou bloco do deploy) | Criar | **Backfill de `codigoIndicacao` por linha** (geracao base32 com retry P2002), idempotente (so `WHERE codigoIndicacao IS NULL`) |
| `prisma/seed.ts` | Modificar | **OBRIGATORIO:** upsert de parceiro com `statusAuditoria:'APROVADO'` no `create` e `update` (Regra 17) + `codigoIndicacao` gerado (`comissaoPercentual` fica null = default global) |
| `src/common/...` (helper de geracao) | Criar | Funcao pura `gerarCodigoIndicacao()` (base32 sem ambiguidade, 10 chars) — testavel, reusada por create/seed/backfill |
| `src/cupom/cupom.service.ts` | Modificar | `resgatar(id, tutorId, dto)` (transacao: dedupe + decremento + atribuicao + snapshots + invalidate, string `'Cupom não encontrado'`); `whereDisponivel` exige `parceiro: { is: { statusAuditoria:'APROVADO', ativo:true } }` |
| `src/cupom/cupom.controller.ts` | Modificar | `POST :id/resgatar` (JwtAuthGuard, `req.user.tutorId`) |
| `src/cupom/dto/resgatar-cupom.dto.ts` | Criar | `ResgatarCupomDto { canal: CanalResgate }` |
| `src/cupom/dto/create-parceiro.dto.ts` | Modificar | Adicionar `donoUsuarioId?` (`@IsOptional @IsString`); opcionalmente `comissaoPercentual?` (`@IsOptional @IsNumber @Min(0) @Max(100)`, D16) se o CMS for definir o percentual no cadastro |
| `src/cupom/parceiro.service.ts` | Modificar | Auditoria (aprovar/rejeitar/suspender, todos invalidam cache; aprovar exige DONO) + create com DONO/APROVADO + **geracao de `codigoIndicacao`** em transacao (+ persistir `comissaoPercentual` se informado) |
| `src/cupom/parceiro.controller.ts` | Modificar | `GET /auditoria`, `POST /:id/auditoria/{aprovar,rejeitar,suspender}` (SystemAdminGuard) |
| `src/cupom/dto/auditoria-parceiro.dto.ts` | Criar | `MotivoAuditoriaDto` |
| `src/auth/guards/parceiro.guard.ts` | Criar | `ParceiroGuard` local (membership ACEITO+ativo; respeita `@SkipParceiroGuard()`); migravel para `@Roles('PARCEIRO')` |
| `src/auth/decorators/skip-parceiro-guard.decorator.ts` | Criar | `@SkipParceiroGuard()` (metadata para o aceite de convite ficar fora do guard) |
| `src/parceiro-portal/parceiro-portal.module.ts` | Criar | Modulo do portal |
| `src/parceiro-portal/parceiro-portal.controller.ts` | Criar | `@Controller('parceiro/portal')` (JwtAuthGuard + ParceiroGuard; aceite com `@SkipParceiroGuard()`); rota `/indicacao` |
| `src/parceiro-portal/parceiro-portal.service.ts` | Criar | dashboard/cupons/resgates/status/indicacao + equipe; mappers allow-list; gate de status nas mutacoes; reativacao de ex-membro |
| `src/parceiro-portal/dto/*.ts` | Criar | `ConvidarMembroDto`, query DTOs (cursor/limit/parceiroId) |
| `src/auth/services/ownership.service.ts` | Modificar | `assertParceiroMembership`, `assertParceiroDono`, `resolveParceiroDoUsuario` |
| `src/auth/services/ownership.service.spec.ts` | Modificar | Testes dos asserts novos (happy + ator errado + admin bypass) |
| `src/app.module.ts` | Modificar | Registrar `ParceiroPortalModule` |
| `src/cupom/*.spec.ts` + `src/parceiro-portal/*.spec.ts` + `src/auth/guards/parceiro.guard.spec.ts` | Criar/Modificar | Conforme Estrategia de Testes |
| `.env` / config | Modificar | `PARCEIRO_INDICACAO_BASE_URL` (env, dominio do link de indicacao, D15; placeholder ate confirmar) |
| `docs/specs/epicos/acesso-compartilhamento-e-parcerias.md` | Modificar | Atualizar epico p/ v0.2: criterio de sucesso ([epico:230]) refletindo D13 (comissao=Parte 4). O DoD da Parte 3 ([epico:218]) que cita codigo/QR/link **continua valido** (D15: nasce+exibe aqui) |
| `docs/CHANGELOG.md` | Modificar | Entry da Parte 3 (CLAUDE.md regra 7) + divida de migracao do guard/catalogo + divida de update do epico |

---

## Tasks Tecnicas (ordenado, dependencias explicitas)

- [ ] **T0** — `ParceiroGuard` local (membership ACEITO+ativo libera, senao 403) + `@SkipParceiroGuard()` (para o aceite de convite) + spec. **Nao depende da Parte 0**; e o que torna a Parte 3 shippable sozinha. Registrar no CHANGELOG a divida de migrar para `@Roles('PARCEIRO')` + catalogo de erro D14 quando a Fundacao entrar.
- [ ] **T1** — Schema Prisma: enums + colunas `Parceiro` (incl. `codigoIndicacao` e `comissaoPercentual Float?` D16) + `ParceiroEquipe` + colunas/`usoUnicoSnapshot` `CupomResgate` (sem comissao no resgate) + reversas `Usuario`. `prisma migrate status`, gerar migration, `prisma generate`.
- [ ] **T2 (dep: T1)** — Migration SQL: DDL (incl. `Parceiro.comissaoPercentual` nullable) + `UPDATE backfill APROVADO em todos`, guarda anti-duplicata, indice unico **parcial** `WHERE usoUnicoSnapshot=true` com nome correto. + **data-migration de backfill de `codigoIndicacao` por linha** (geracao base32 com retry P2002, idempotente). + helper puro `gerarCodigoIndicacao()`.
- [ ] **T3 (dep: T1)** — `OwnershipService`: `assertParceiroMembership`, `assertParceiroDono`, `resolveParceiroDoUsuario` + spec.
- [ ] **T4 (dep: T1)** — DTOs: `ResgatarCupomDto`, `MotivoAuditoriaDto`, `ConvidarMembroDto`, `donoUsuarioId?` (e opcionalmente `comissaoPercentual?` D16) em `CreateParceiroDto`, query DTOs do portal.
- [ ] **T5 (dep: T1, T4)** — `CupomService.resgatar` (transacao, snapshots, decremento, atribuicao sem comissao, string `'Cupom não encontrado'`) + `whereDisponivel` com `statusAuditoria` + `parceiro.ativo`. `cupom.controller` rota de resgate.
- [ ] **T6 (dep: T1, T4)** — `ParceiroService` auditoria (invalidate em suspender/rejeitar/aprovar; aprovar exige DONO) + create com DONO/APROVADO + **geracao de `codigoIndicacao`** em transacao (+ persistir `comissaoPercentual` se informado); rotas no `ParceiroController`. **Atualizar `seed.ts` (Regra 17).**
- [ ] **T7 (dep: T0, T3, T4)** — `ParceiroPortalModule/Controller/Service` (dashboard/cupons/resgates/status/**indicacao**/equipe) com mappers allow-list, `?parceiroId=` obrigatorio com N>1, precedencia guard->resolve, gate de status nas mutacoes, **reativacao de ex-membro (Regra 18)**, aceite fora do guard com `parceiroId` obrigatorio (Regra 20). Registrar no `app.module`. Adicionar `PARCEIRO_INDICACAO_BASE_URL` na config.
- [ ] **T8 (dep: T5, T6, T7)** — Unit specs + ownership spec + guard spec.
- [ ] **T9 (dep: T5, T6)** — Integration spec (concorrencia de resgate + indice parcial + remocao concorrente de DONO + migration backfill APROVADO/codigo + `comissaoPercentual` nullable + re-convite) contra Postgres real.
- [ ] **T10 (dep: T2, T5, T7)** — Smoke `scripts/test-resgate-smoke.ts` (incl. `migrate reset`+seed -> cupons visiveis) + smoke do portal (incl. `/indicacao` e primeiro aceite).
- [ ] **T11 (dep: tudo)** — Swagger atualizado; rodar `security-auditor` (gate: zero findings >= media); `npm test` + integration + `npm run lint`; `grep` U+2014 vazio; `audit grep` dos callsites de `whereDisponivel`/`mapToResponse`; `EXPLAIN` do JOIN de `whereDisponivel`; atualizar epico para v0.2; CHANGELOG.

---

## Consideracoes de Arquitetura

- **Membership N-N e nao `Parceiro.usuarioId?` 1-1.** Decisao locked do epico (D6, [epico:71-76](../epicos/acesso-compartilhamento-e-parcerias.md)). Espelha `ClinicasEquipe` na **modelagem**, sem reusar o service stub de clinica.
- **Reuso do enum `StatusConvite`** em vez de criar enum de convite proprio ([schema.prisma:923](../../../prisma/schema.prisma)).
- **Comissao desacoplada (D13), percentual configuravel por parceiro (D16).** Cupom e so desconto de loja; resgate atribui ao parceiro so para relatorio. A receita do parceiro vem do **programa de indicacao (Parte 4)**. O **percentual** dessa comissao deixa de ser hardcoded: vive em `Parceiro.comissaoPercentual Float?` (so o percentual; `null` = `COMISSAO_PADRAO_PCT = 5%`), nasce nesta parte (D16) e e lido pela Parte 4 como `parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT`. O **saldo**/credito/extrato (em centavos) vive no **ledger da Parte 4**, nunca em coluna do `Parceiro` (por isso nada de `comissaoAcumuladaCentavos` aqui).
- **`codigoIndicacao` nasce e e exibido aqui (D15).** A v0.4 empurrou geracao/exibicao para a Parte 4; **D15 reverte** — o codigo e identidade do parceiro: gerado no create + backfill, exibido em `/parceiro/portal/indicacao`. Para nao prender a Parte 4 (motivacao da v0.4), o formato e **fixado e estavel** (aleatorio base32 ~50 bits, nao deterministico do id), e a Parte 4 **so le a string** (captura no signup -> atribuicao -> comissao); ela nao re-deriva nada do id nem re-gera. Isso elimina o furo de colisao do `md5(id)` a 32 bits e o lock-in de "deterministico do id vs retry" (escolha um modelo: aleatorio com retry, coerente). O dominio do link vem de env (`PARCEIRO_INDICACAO_BASE_URL`), nao hard-coded.
- **Contrato de schema com a Parte 4 e explicito** (secao "Contrato com a Parte 4"): `codigoIndicacao` = Parte 3 cria+gera; `comissaoPercentual Float?` = Parte 3 cria (D16), Parte 4 le `?? COMISSAO_PADRAO_PCT`; `comissaoAcumuladaCentavos`/saldo/ledger = Parte 4; `CupomResgate.parceiroId` = Parte 3 (so atribuicao); `cancel_reason` no webhook = Parte 4. Isso impede a colisao de migration ("column already exists") e a contradicao "quem nasce o codigo / quem tem o percentual" que existia entre os drafts.
- **`ParceiroGuard` local em vez de bloquear na Parte 0.** Faz a mesma derivacao (`ParceiroEquipe` ACEITO+ativo). A rota de **aceite de convite** fica fora do guard (`@SkipParceiroGuard()`), senao o primeiro aceite seria impossivel (catch-22). Migra-se para `@Roles('PARCEIRO')` + `RolesGuard` global quando a Fundacao existir, **sem** mudar shape de rota.
- **Resgate vive no `CupomService`** (regra de disponibilidade, cache e mapper ja estao la). Portal e modulo separado (guard e shape proprios).
- **`whereDisponivel` filtra `parceiro.statusAuditoria` E `parceiro.ativo`.** `statusAuditoria` e credenciamento; `ativo` e soft-disable manual. Ambos sao gate; o filtro por `parceiro.ativo` e novo (antes nem `ativo` nem `statusAuditoria` eram checados na relacao `parceiro`). O JOIN adicional na listagem e trivial em catalogo pequeno (confirmar por `EXPLAIN`; `@@index([statusAuditoria, ativo])` opcional se crescer).
- **Indice unico parcial e nao global.** Prisma nao expressa parcial no `.prisma`; criado no SQL. Denormaliza `usoUnico` -> `usoUnicoSnapshot` em `CupomResgate` porque indice parcial so referencia colunas da propria tabela. Nome do indice reflete a coluna real.
- **404-vs-403 (D14):** 403 para ownership autenticado (portal/equipe); 404 generico para o lookup do cupom (resgate), embutindo `statusAuditoria=APROVADO`+`ativo=true` em `whereDisponivel` (sem leak; consistente com a listagem).
- **Re-convite via upsert no PK composto** (Regra 18) em vez de `create` (que estouraria P2002), porque o soft-delete deixa a linha `(parceiroId,usuarioId)`.

---

## Plano de Rollout / Rollback

**Rollout**
1. `prisma migrate status` (confirmar nada pendente divergente).
2. Aplicar migration via `migrate deploy` em staging. O **backfill APROVADO roda dentro da migration** (UPDATE em todos os parceiros). `comissaoPercentual` entra como coluna nullable (sem backfill; legados `null`). Em seguida roda a **data-migration de `codigoIndicacao`** (geracao por linha com retry; idempotente).
3. Confirmar `PARCEIRO_INDICACAO_BASE_URL` no env de staging.
4. Smoke de resgate (incl. `migrate reset`+seed -> cupons visiveis) + portal (incl. `/indicacao`) em staging contra DB real.
5. `security-auditor` (gate: zero >= media) + `npm test` + integration.
6. Deploy da API; `migrate deploy` + data-migration de codigo em prod (janela de baixo trafego; `CupomResgate` vazia, indice parcial barato).
7. Habilitar rotas no CMS/app (consumidores opt-in). Confirmar que cupons do CMS continuam visiveis (default admin APROVADO + ativo + backfill). Confirmar que o CMS pode mandar `donoUsuarioId` opcional (e, se aplicavel, `comissaoPercentual`). Confirmar `/indicacao` traz codigo + link com o dominio real.
8. Atualizar o epico para v0.2 (criterio de sucesso) refletindo D13/D15/D16.

**Rollback**
- Codigo: reverter deploy da API (rotas novas somem; `donoUsuarioId`/`comissaoPercentual` opcionais deixam de ser lidos; nada quebra, sao aditivos). **Excecao:** `whereDisponivel` voltaria a ignorar `statusAuditoria` e `parceiro.ativo` — aceitavel (cupons voltam ao estado pre-feature).
- Schema: migration aditiva; colunas nullable/tabela nova ficam inertes. Reverter o indice unico parcial = dropar o indice (isolado). O backfill `APROVADO` e idempotente (rerun seguro) e nao destrutivo. O backfill de `codigoIndicacao` so preenche linhas null (idempotente); reverter o deploy nao apaga os codigos ja gerados (coluna inerte, sem consumidor ate a Parte 4). `comissaoPercentual` fica inerte (sem consumidor ate a Parte 4).

---

## Observabilidade

- Log estruturado (Pino, sem PII): `resgate.criado` (`cupomId`, `parceiroId`, `canal`), `parceiro.auditoria.mudou` (`parceiroId`, `de`, `para`, `adminUserId`), `parceiro.equipe.convite/aceite/remocao/reativacao`, `parceiro.codigo.gerado` (`parceiroId`, sem o codigo em log para nao poluir; codigo e publico mas nao precisa de log).
- Negacoes BOLA dos asserts novos seguem `OwnershipService.deny` (WARN).
- Metrica de negocio ([epico:230](../epicos/acesso-compartilhamento-e-parcerias.md)): nº de parceiros com login ativo (membership ACEITO) e nº de resgates **atribuidos** (com `parceiroId`). **Atencao ao drift:** o criterio de sucesso do epico ainda diz "resgates atribuidos **com comissao registrada**" (texto v0.1, anterior a D13). **Nesta parte nao ha comissao a observar** — so atribuicao de resgate; a metrica de comissao pertence a Parte 4 (credito por renovacao, lendo `comissaoPercentual ?? COMISSAO_PADRAO_PCT`). O epico precisa ser atualizado para v0.2 (divida registrada em Breaking Changes/Perguntas/CHANGELOG); ate la D13/D15/D16 prevalecem.

---

## Definition of Done

- [ ] Todos os Acceptance Criteria atendidos.
- [ ] Migration aplicada (`migrate deploy`) + `prisma generate`; backfill `APROVADO` rodado **na migration**; backfill de `codigoIndicacao` rodado (data-migration por linha, todos nao-null e unicos — D15); coluna `comissaoPercentual Float?` criada (nullable, legados `null` = default global — D16).
- [ ] **Seed atualizado (Regra 17):** apos `migrate reset`+seed, `GET /tutor/cupons` lista os cupons seedados (parceiro seedado APROVADO+ativo).
- [ ] `POST /tutor/cupons/:id/resgatar` em producao com decremento atomico + dedupe **parcial** (so uso unico) + atribuicao (`parceiroId`, sem comissao); string de erro reusa `'Cupom não encontrado'`.
- [ ] Portal do parceiro (dashboard/cupons/resgates/status/**indicacao**) e equipe funcionando, scoped por membership, com `?parceiroId=` exigido para N>1, precedencia guard->resolve correta, sem leak de PII (zero campo derivado de `tutorId`) e sem valor/saldo de comissao.
- [ ] `GET /parceiro/portal/indicacao` exibe `codigoIndicacao` + `link` (env `PARCEIRO_INDICACAO_BASE_URL`); DONO e OPERADOR acessam; `podeIndicar`/`aviso` corretos. **Atribuicao/comissao a partir do codigo NAO esta nesta parte (Parte 4 consome, lendo `comissaoPercentual ?? COMISSAO_PADRAO_PCT`).**
- [ ] Primeiro aceite de convite funciona (rota fora do `ParceiroGuard`, `parceiroId` obrigatorio); re-aceite -> 404; re-convite de ex-membro reativa; mutacao de equipe bloqueada em parceiro nao-operavel (409).
- [ ] Coluna `codigoIndicacao` existe, e `@unique` e **preenchida em todos os parceiros** (gerada aqui — D15); a Parte 4 so consome. Coluna `comissaoPercentual Float?` existe (nullable; D16); a Parte 4 a le no calculo.
- [ ] `ParceiroGuard` local em producao; divida de migracao para `@Roles('PARCEIRO')` + catalogo de erro D14 registrada no CHANGELOG.
- [ ] Auditoria admin (aprovar/rejeitar/suspender) gravando trilha e invalidando cache; aprovar exige DONO ACEITO, nao regera codigo e nao altera `comissaoPercentual`.
- [ ] Asserts de ownership novos com teste happy + ator errado + admin bypass; guard spec cobrindo skip do aceite.
- [ ] `whereDisponivel` filtra `statusAuditoria=APROVADO` **e** `parceiro.ativo=true`; regressao confirma APROVADO+ativo lista, nao-APROVADO / `ativo=false` nao lista. `EXPLAIN` do JOIN confirmado.
- [ ] `CreateParceiroDto` aceita `donoUsuarioId?` opcional sem 400; CMS listado como consumidor em Breaking Changes.
- [ ] `npm test` + integration (concorrencia de resgate + indice parcial + remocao de DONO + migration backfill APROVADO/codigo + `comissaoPercentual` nullable + re-convite) + smoke passam; `npm run lint` limpo; `security-auditor` com zero findings >= media.
- [ ] Swagger/Scalar atualizado para todas as rotas novas.
- [ ] 403 para ownership autenticado e 404 generico para lookup de cupom confirmados (D14); mensagens de erro mapeadas para chaves do catalogo i18n (pt-BR literal ate a Parte 0 entrar; `cupom.nao_encontrado` reusa a string existente verbatim).
- [ ] `grep` U+2014 vazio em copy de resposta/i18n.
- [ ] Epico atualizado para v0.2 (criterio de sucesso refletindo D13; DoD da Parte 3 com codigo de indicacao **mantido**, D15) OU a divida explicitamente registrada no CHANGELOG.
- [ ] CHANGELOG atualizado; spec marcada Concluido com data.

---

## Perguntas em Aberto

> Itens que exigem decisao de produto/Nicolas. **Nenhuma regra/numero foi inventada** para resolve-los; ficam aqui em vez de virar regra na spec. As decisoes ja derivaveis de D1-D16 ou do padrao do repo foram movidas para "Regras de Negocio".

### Programa de indicacao — o que a Parte 4 CONSOME (geracao/exibicao ja sao desta parte, D15; percentual ja e desta parte, D16)

> O `codigoIndicacao` **nasce e e exibido nesta Parte 3** (D15, Regra 11/15) e o **percentual** `comissaoPercentual` **nasce nesta Parte 3** (D16, Regra 21). O que segue e **escopo da Parte 4** (que so consome o codigo e o percentual):

1. **Dominio/path final do link:** `PARCEIRO_INDICACAO_BASE_URL` e o path (`/r/{codigo}` ou deep-link) precisam casar com a rota de captura no signup da Parte 4. Esta parte ja usa o env no `/indicacao`; **confirmar o dominio real antes do deploy** (placeholder ate la). Decisao de produto/Nicolas.
2. **Atribuicao no signup (Parte 4):** captura de `referidoPorParceiroId` quando o tutor se cadastra via codigo/QR/link.
3. **Credito por renovacao (Parte 4):** integracao com o webhook RevenueCat para creditar a comissao por ciclo, calculada como `(parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT)` aplicada a base (`Plano.preco` mensal; `event.price` anual). `COMISSAO_PADRAO_PCT = 5%` e constante/env definida na Parte 4 (D16). **Requer estender `src/webhook/dto/revenuecat-event.dto.ts` para ler `cancel_reason`** (hoje so le `expiration_at_ms`, [revenuecat-event.dto.ts:15-17](../../../src/webhook/dto/revenuecat-event.dto.ts)) — clawback so estorna em `CANCELLATION` com `cancel_reason='CUSTOMER_SUPPORT'` (D15).
4. **Rotacao/expiracao do `codigoIndicacao`:** se o codigo deve poder ser rotacionado/desativado (Parte 4 ou onda futura). Hoje o codigo e estavel (gerado uma vez, nao rotaciona).
5. **Carteira/saque (Parte 4):** PIX, minimo R$50, ciclo dia 27 -> dia 5, liquidacao admin (D13/D15). Saldo/extrato em **centavos** no ledger da Parte 4. Anti-laranja: hold de saque + limite leve de N conversoes/parceiro antes de revisao admin (D15/D16); resto camada futura.
6. **Edicao do `comissaoPercentual` por parceiro (D16):** esta parte cria a coluna e (opcionalmente) aceita o valor no create. Onde fica a UI/rota de **edicao** do percentual negociado (CMS admin? rota dedicada de auditoria/comercial?) e quem pode edita-lo e decisao de produto — follow-up. Validar faixa (`0 <= pct <= 100`) e a unidade (percentual, nao fracao) na rota de edicao.

### Gestao de papel / equipe

7. **Mudanca de papel (promover/rebaixar) (Regra 19):** esta parte **nao** tem `PATCH` de papel — DONO so via create ou convite com `papel=DONO`. Como um parceiro promove um segundo DONO ou rebaixa um DONO existente? Follow-up. Quando entrar, aplicar a guarda `FOR UPDATE` da Regra 4 ao rebaixamento do ultimo DONO. Decisao de produto.
8. **Convite a usuario inexistente:** hoje a spec exige `Usuario` ja cadastrado (404). Convite externo por email (criar conta no aceite) e desejado? Follow-up.
9. **`OPERADOR` opera resgate B2B (validar QR na loja)?** Esta parte nao inclui endpoint B2B de validacao de QR (estava fora na Entrega 1, [cupons-tutor-backend.md:35](../cupons-tutor-backend.md)). Confirmar se entra aqui ou em onda futura. Hoje `OPERADOR` tem leitura no portal (incl. `/indicacao`).
10. **HMAC de `tutorRef` por parceiro:** caso o portal precise correlacionar "mesmo tutor, varios resgates", introduzir `HMAC(tutorId, chave-por-parceiro)`. Hoje **nao exportamos** nada derivado de `tutorId`. Confirmar se a correlacao e requisito de produto.

### Documentacao do epico (divida de update)

11. **Atualizar o epico para v0.2.** O criterio de sucesso ([epico:230](../epicos/acesso-compartilhamento-e-parcerias.md)) ainda diz "resgates atribuidos **com comissao registrada**" (pre-D13) — trocar por "resgates atribuidos (`parceiroId`); comissao na Parte 4". O DoD da Parte 3 ([epico:218](../epicos/acesso-compartilhamento-e-parcerias.md)) que cita "codigo/QR/link de indicacao" **permanece correto** (D15: nasce + exibe aqui). D13/D14/D15/D16 prevalecem ate o update.

---

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-06-23 | 0.1 | Criacao da spec filha Parte 3 apos research. Modelo de comissao mantido em aberto (decisao locked do epico). | Claude + Nicolas |
| 2026-06-23 | 0.2 | Revisao adversarial aplicada (10 furos). Corrigidos: (alta) `ParceiroGuard` local vira T0/AC, Parte 3 shippable sem Parte 0; (alta) "Breaking Changes" lista CMS + backfill na migration + parceiro admin nasce APROVADO; (alta) dedupe vira indice unico **parcial** `WHERE usoUnicoSnapshot` (cupom ilimitado resgata N vezes), AC do 2o resgate; (alta) colisao 404-vs-403 unificada em **404**; (media) PII sem `tutorRef` reversivel (so `resgateId`), HMAC vira pergunta; (media) remocao de DONO com `FOR UPDATE` + integration, invariante atrelada a APROVADO; (media) DoD explicita comissao=null e metrica zerada; (media) ACs testaveis; (baixa) invalidate cache em suspender + DELETE 204 alinhado ao padrao do repo; (baixa) backfill via migration UPDATE, `?parceiroId=` em todas as rotas. Ancoras de path corrigidas. | Claude + Nicolas |
| 2026-06-24 | 0.3 | **Desacoplamento de comissao (D13/D14).** Removidos do escopo: `Parceiro.comissaoPercentual`, `Parceiro.comissaoAcumuladaCentavos`, `CupomResgate.comissaoCentavos`, `CupomResgate.comissaoPercentualSnapshot`, `computeComissao`, endpoint `GET /parceiro/portal/comissoes`, string i18n de comissao. `CupomResgate.parceiroId` mantido **so para atribuicao/relatorio**. Adicionado `Parceiro.codigoIndicacao` (entao com geracao no create/seed/backfill + helper de link/QR + endpoint `GET /parceiro/portal/indicacao`). 403 vs 404 e i18n de erro alinhados a D14. | Claude + Nicolas |
| 2026-06-24 | 0.4 | **Revisao adversarial (13 furos).** (alta) `codigoIndicacao` reduzido a **so a coluna nullable** — geracao/formato/backfill/helper/endpoint movidos para a Parte 4; (alta) catch-22 do aceite resolvido (`PATCH .../aceitar` fora do `ParceiroGuard` via `@SkipParceiroGuard()`); (media) `donoUsuarioId?` formalizado no `CreateParceiroDto`; (media) `whereDisponivel` passa a exigir `parceiro.ativo=true` alem de APROVADO; (media) mutacao de equipe gated por status operavel (409 `Parceiro nao operavel`); (media) drift com o epico registrado; (media) string de erro do resgate reusa `'Cupom não encontrado'`; (baixa) `categoria` cru + `titulo` sem i18n; (baixa) nome do indice corrigido; (baixa) precedencia guard->resolve documentada. | Claude + Nicolas |
| 2026-06-24 | 0.5 | **Reconciliacao com D15 (autoritativo) + correcao de achados de auditoria.** (alta, D15) `codigoIndicacao` **volta para a Parte 3**: nasce no create + backfill por linha (formato aleatorio base32 ~50 bits com retry, nao `md5(id)`), exibido em `GET /parceiro/portal/indicacao` (link via `PARCEIRO_INDICACAO_BASE_URL`); a Parte 4 so **consome** (Regras 11/15). (alta) Contrato de schema com a Parte 4 explicitado: `codigoIndicacao`=Parte 3 cria+gera; `comissao*`=Parte 4 cria (nao "reuse da Parte 3"); referencia obsoleta a `computeComissao` stub removida; resolve a colisao de migration "column already exists". (alta) **Seed APROVADO vira OBRIGATORIO** (Regra 17) com AC de smoke — senao cupons seedados somem apos `migrate reset`. (media) Aceite de convite: `parceiroId` obrigatorio (400 se omitido), re-aceite -> 404, resolve ambiguidade de N convites PENDENTES (Regra 20). (media) Re-convite de ex-membro removido (`ativo=false`) **reativa** via upsert no PK composto em vez de 409 (Regra 18). (media) Mudanca de papel documentada como fora de escopo, sem caminho que rebaixe DONO (Regra 19). (baixa) Janela "cupom deletado durante resgate" documentada e aceita (Regra 16). (baixa) JOIN de `whereDisponivel` -> `EXPLAIN` + indice opcional. Dependencia de `cancel_reason` no webhook (D15) registrada como contrato para a Parte 4. | Claude + Nicolas |
| 2026-06-24 | 0.6 | **Reconciliacao com D16 (comissao % configuravel por parceiro).** A v0.4 removeu inteira a coluna de comissao do `Parceiro`; **D16 traz de volta UMA coluna so:** `Parceiro.comissaoPercentual Float?` (nullable; `null` = default global `COMISSAO_PADRAO_PCT = 5%` em constante/env da Parte 4). **NAO** readiciona `comissaoAcumuladaCentavos` (o bruto/saldo vem do **ledger da Parte 4**, nao de coluna no `Parceiro`). A Parte 4 le `parceiro.comissaoPercentual ?? COMISSAO_PADRAO_PCT` no calculo — o percentual deixa de ser hardcoded e permite negociacao comercial por parceiro sem deploy (Regra 21). Ajustados: model `Parceiro` (coluna aditiva), "Contrato com a Parte 4" (linha de comissao dividida: percentual=Parte 3, saldo=Parte 4), migration/DDL + tasks (T1/T2/T4/T6/T9), Breaking Changes (linha aditiva), ACs de schema/create/portal/auditoria, riscos, NFR (dinheiro em centavos no ledger), DoD, observabilidade e Perguntas. Cupom/`CupomResgate` continuam SEM comissao (D13 intacto); a unica coluna de comissao reintroduzida e o **percentual** em `Parceiro` (so o percentual, nada de saldo). | Claude + Nicolas |