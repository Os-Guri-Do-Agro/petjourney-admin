# Spec: Parte 0 - Fundacao: Papeis (RolesGuard), Codigo Publico, Catalogo i18n de Erro e Trust Proxy

**Status:** In Review | **Autor:** Claude + Nicolas | **Atualizado em:** 2026-06-24 | **Versao:** 0.5

> Spec filha do epico `docs/specs/epicos/acesso-compartilhamento-e-parcerias.md` (Parte 0). Implementa as decisoes **D2** (util de codigo publico), **D3** (papeis via `@Roles`/RolesGuard) e **D14** (catalogo i18n de erro, `trustProxy`, politica 403 vs 404) do epico, e congela os contratos que **D15** (decisoes finais 2026-06-24) exige da fundacao: assinatura do util de codigo publico, requisito de throttle cross-instancia (Redis ou lockout por codigo) e dominios via env.

> **Contrato congelado para 1/2 (Achado 1).** A assinatura do `PublicCodeService` definida nesta spec (`gerar(isTaken): Promise<string>` + `resolveAtivoOrThrow(codigo, findByCodigo): registro` que **lanca 404**, nunca retorna `null`) e o **contrato unico autoritativo**. A Parte 1 (`01:426`) ja descreve o util de forma compativel; a Parte 2 (`02:39-50`) descreve uma assinatura **divergente** (`gerar({ usuarioId, tipo, ttlMs })`, `resolver(codigo): ... | null`) que **NAO** pluga neste util — a secao "Helper de codigo publico (D2)" da Parte 2 deve ser reescrita para casar este contrato (ttl/expiraEm/usuarioId/tipo viram responsabilidade do service de Familia, que calcula `expiraEm` e persiste; validacao usa `resolveAtivoOrThrow` com 404, nao `resolver`->null). Ver Regra 13a e Perguntas em Aberto #10.

---

## Visao Geral

Fundacao puramente habilitadora, sem feature de dominio. Entrega quatro blocos reusaveis pelas Partes 1, 2, 3 e 4:

1. **`@Roles` decorator + `RolesGuard`** — autorizacao baseada em papel derivado de `req.user` (perfis + `isSystemAdmin` + vinculo de parceiro), **sem adicionar campo novo no JWT**. Reaproveita os ids que o token ja carrega (`tutorId`, `tutorActive`, `veterinarioId`, `isSystemAdmin`). Papel `PARCEIRO` deriva de vinculo ativo (resolvido em runtime, ja que a tabela de membership so existe a partir da Parte 3; o guard ja trata isso de forma tolerante via resolver injetavel no-op). **O `RolesGuard` exige `JwtAuthGuard` (nao `OptionalJwtAuthGuard`) antes** — ver Regra 6 e Furo 1.

2. **Util compartilhado de codigo publico de 6 digitos** (`src/common/public-code/`) — geracao com unicidade entre registros ativos/nao-expirados (respaldada por UNIQUE parcial no banco do consumidor + retry em colisao de INSERT, ver Regra 11a/12a — Achado 3), validacao com erro generico 404, RNG criptografico injetavel, e constante de rate-limit reusando o `@nestjs/throttler` (ja dependencia do projeto). Prestador (Parte 1) e convite de Familia (Parte 2) reusam o mesmo util — D2 proibe duplicar geracao de codigo. **Esta parte entrega apenas a defesa por IP; a defesa por codigo (anti-brute-force distribuido) e da parte que consome** — ver Regra 14 e Furo 11. **D15: o `@nestjs/throttler` atual e in-memory** (`ThrottlerModule.forRoot` sem storage, `app.module.ts:47`), logo **nao e cross-instancia** no Railway (cada instancia tem seu proprio balde). A Parte 0 define a **interface/constante**; o requisito de throttle confiavel cross-instancia (**Redis no throttler OU lockout por codigo persistido**) e do DoD das Partes 1/2 — ver Regra 14a e Perguntas em Aberto #2.

3. **Catalogo i18n de mensagem de erro** (`src/common/errors/`) — D14. Catalogo **estatico por chave** (constante TypeScript, **nao** tabela), reusando a infra i18n existente (`src/common/i18n`): mesmo padrao do `ESPECIE_LABELS` (`Record<ErrorKey, Record<Locale, string>>`, en-GB sempre explicito). Resolucao de locale via helper puro `localeFromRequest` (mesma logica do `@Locale()`/`Accept-Language`, agora null-safe e reusavel pelo filtro). Excecoes de dominio carregam **chave** + status; o `HttpExceptionFilter` resolve a chave para a copy do locale da request **e remove o `errorKey` do payload** (nao vaza identificador interno). As mensagens do `RolesGuard` e do util de codigo publico passam a referenciar chaves deste catalogo. **`OwnershipService` e migrado de fato nesta parte** (AC31 obrigatorio), para que ao menos uma rota viva exercite o catalogo end-to-end — ver Furo 4.

4. **Decisao de `trustProxy` + politica 403 vs 404** — D14. `trustProxy` habilitado no `FastifyAdapter` (`src/main.ts`) pro `req.ip` ser o IP real atras do Railway (senao o rate-limit por IP fica global). **Numero de hops lido de env (`TRUST_PROXY_HOPS`, default `1`), nao literal** — o numero exato do Railway e desconhecido e e confirmado por smoke pos-deploy (bloqueante no DoD) — ver Regra 23, Furo 3 e Furo 9. Politica documentada: **403** para ownership autenticado, **404 generico** para lookup por codigo publico (anti-enumeracao). Helper de politica (`assert403`) definido com semantica e teste explicitos para as Partes 1-4 reusarem — ver Furo 6.

**Restricao de shippability:** zero alteracao de contrato em qualquer rota existente. Como nenhuma rota atual usa `@Roles` nem o util de codigo, o comportamento de autorizacao em producao apos o merge e identico ao de hoje. O catalogo i18n de erro **so muda a forma** das mensagens quando o `Accept-Language`/`?lang=` pedir um locale != pt-BR; com pt-BR (default e maioria do trafego hoje), a copy e identica a de hoje (as chaves do catalogo tem pt-BR igual as strings literais atuais). A habilitacao de `trustProxy` muda **so** o valor de `req.ip` (passa a ser o cliente real em vez do proxy); nenhuma rota existente depende de `req.ip` para logica de negocio (verificado em research). **`trustProxy` NAO muda o IP logado pelo `logger.middleware.ts`** (esse middleware le `req.socket.remoteAddress`, nao `req.ip`) — ver Furo 2. O `OwnershipService` tem sua **mensagem** migrada para chave de catalogo (mudanca aditiva: mesmo status 403, mesma copy pt-BR); sua **logica** de ownership nao muda (evolucao para Familia e D4, escopo da Parte 2).

**Reclassificacao do blast radius do `trustProxy` (Achado 8 — NAO e inerte):** a habilitacao de `trustProxy` **nao** e codigo morto. Ela altera o comportamento do `ThrottlerGuard` **global ja ativo** (`app.module.ts:89`), que e o `APP_GUARD` aplicado a **todas** as rotas throttladas de hoje (ex.: `public-pet.controller.ts:23`, 30/min/IP). O tracker default le `req.ip`; com `trustProxy` ligado, `req.ip` passa a derivar do `X-Forwarded-For`. **Se o numero de hops estiver errado**, o XFF vira spoofavel e um atacante zera o throttle por IP de rotas **existentes** (nao so das futuras das Partes 1/2). Consequencia: o smoke de `TRUST_PROXY_HOPS` e **bloqueante ANTES do merge em `master`** (nao "pos-deploy recomendado"). Ver Regra 23, Riscos e Plano de Rollout.

---

## Contratos congelados (D15) — o que 1/2/3/4 consomem desta fundacao

Estes contratos sao **autoritativos**: as Partes 1-4 consomem exatamente o que esta aqui. Onde uma spec filha divergir, a spec filha e quem corrige.

| Contrato | Forma congelada | Quem consome | Origem |
|---|---|---|---|
| Geracao de codigo | `PublicCodeService.gerar(isTaken: (codigo: string) => Promise<boolean>): Promise<string>` — retorna **so a string**; `expiraEm`/`ttl`/`usuarioId`/`tipo` sao responsabilidade do service de dominio (calcula e persiste). | Parte 1 (Prestador), Parte 2 (ConviteFamilia) | Achado 1, Regra 10-13 |
| Validacao de codigo | `PublicCodeService.resolveAtivoOrThrow(codigo, findByCodigo): registro` — **lanca `LocalizedException('PUBLIC_CODE_INVALID', 404)`** em invalido/expirado/revogado/mal-formatado; **nunca retorna `null`** (o 404 generico ja e o sinal anti-enumeracao). | Parte 1, Parte 2 | Achado 1, Regra 13 |
| Unicidade do codigo | Predicado `isTaken` **DEVE** ser `status=ATIVO AND expiraEm > now` (ambos), respaldado por **UNIQUE parcial** (`status=ATIVO`) na coluna de codigo da tabela do consumidor; o fluxo correto e gerar -> tentar INSERT -> em `P2002` tratar como colisao e regerar no mesmo loop de `MAX_TENTATIVAS`. | Parte 1, Parte 2 | Achado 3, Achado 7, Regra 11a/12a |
| Throttle cross-instancia | Constante `PUBLIC_CODE_THROTTLE` (defesa por IP, 10/min). O throttler atual e **in-memory** (nao cross-instancia no Railway); a defesa confiavel exige **Redis no throttler OU lockout por codigo persistido** — entrega das Partes 1/2 no DoD delas. | Parte 1, Parte 2 | D15, Regra 14/14a |
| Catalogo de erro | `ERROR_CATALOG`, `ErrorKey`, `resolveErrorMessage`, `LocalizedException`, `assert403` (e `assert403Owner`, Regra 21a). Partes 1-4 **adicionam chaves** ao mesmo arquivo (4 locales, en-GB explicito). | Partes 1-4 | D14, Regra 16-21a |
| Papel | `AppRole`, `@Roles`, `RolesGuard` (exige `JwtAuthGuard` antes). `PARCEIRO` via `ParceiroRoleResolver` (no-op aqui; Parte 3 substitui). | Parte 3 (PARCEIRO), follow-up vet | D3, Regra 1-9 |
| Dominios | **D15: dominios via env** — `PRESTADOR_BASE_URL` (Parte 1), `FAMILIA_INVITE_BASE_URL` (Parte 2), `PARCEIRO_INDICACAO_BASE_URL` (Parte 3). A Parte 0 nao constroi links, mas documenta o padrao e lista as envs ao lado de `TRUST_PROXY_HOPS` no `.env.example` para as filhas nao reinventarem. | Partes 1/2/3 | D15 |

> **Itens de D15 que NAO sao da Parte 0** (registrados aqui so para nao serem confundidos como escopo desta fundacao, pois D15 e cross-cutting): comissao anual base = `event.price` (Parte 4); `codigoIndicacao` na Parte 3 e consumido pela Parte 4; clawback via `CANCELLATION` + `cancel_reason="CUSTOMER_SUPPORT"` exigindo estender `src/webhook/dto/revenuecat-event.dto.ts` (Parte 4); `FAMILIA_CARENCIA_DIAS=7` e feature flag `FAMILIA_LEITURA_PRONTUARIO` (Parte 2); anti-laranja hold de saque + limite leve por parceiro (Parte 4). A Parte 0 **nao** implementa nenhum desses; eles vivem nas filhas indicadas.

---

## Motivacao / Contexto de Negocio

- A camada de autorizacao hoje e binaria: `tutor.usuarioId === userId` OU `isSystemAdmin` (metodos `assert*` em `src/auth/services/ownership.service.ts`). Nao ha enum de papel, nem `@Roles`/RolesGuard (epico, secao "Ancoras", `jwt.strategy.ts:31-40`).
- Parceiro logado (Parte 3) e vet-com-conta (follow-up da Parte 1) precisam restringir rotas por papel **antes** de chegar na checagem de recurso. Sem fundacao de papel, cada parte reinventaria o guard.
- Prestador (Parte 1) e convite de Familia (Parte 2) precisam do **mesmo** padrao de codigo de 6 digitos (geracao unica + rate-limit + erro generico). D2 manda extrair um util unico para nao divergir geracao/validacao entre as duas frentes.
- O produto vende conteudo localizado (epico i18n-conteudo: `src/common/i18n`), mas as **mensagens de erro** sao pt-BR fixo e espalhadas no throw de cada service. D14 manda criar um catalogo unico de erro traduzido (pt-BR/en-US/en-GB/es-419, en-GB explicito) que as respostas passam a usar — comecando pelas mensagens novas desta fundacao **e migrando o `OwnershipService` ja nesta parte** (para ter exercicio end-to-end real), abrindo caminho para migrar as existentes sem big-bang.
- O rate-limit por IP das rotas publicas por codigo (Partes 1/2) so e confiavel se `req.ip` for o IP real do cliente. Atras do Railway (proxy), sem `trustProxy`, `req.ip` e o IP do proxy e o balde por IP fica global. D14 decide habilitar `trustProxy` agora, na fundacao, para a Parte 1 ja nascer com o tracker correto.
- Construir a fundacao isolada e shippable reduz o risco: ela vai pra producao sem mudar contrato, e as Partes 1-4 plugam nela.

---

## Research Findings (com ancoras arquivo:linha reais)

### Auth / papeis (estado atual)
- O JWT (objeto `req.user` montado em `validate()`) carrega exatamente: `{ userId, email, nome, isSystemAdmin, tutorId, tutorActive, veterinarioId }` — `src/auth/strategies/jwt.strategy.ts:31-40`. `tutorId` e `veterinarioId` sao `null` quando o perfil nao existe; `tutorActive` e `null` quando nao ha perfil tutor e `false` quando ha mas esta inativo (`jwt.strategy.ts:36-39`).
- `validate()` faz `findUnique` no `Usuario` incluindo `tutorPerfil` e `veterinarioPerfil` (`jwt.strategy.ts:18-24`). **Nao** inclui nenhum vinculo de parceiro (a tabela `ParceiroEquipe` ainda nao existe; sera criada na Parte 3). `Usuario.ativo === false` ja bloqueia login global (`jwt.strategy.ts:27-29`), entao quem chega ao `RolesGuard` ja passou pelo ban global.
- **Tutor inativo continua autenticado.** `Usuario.ativo` (ban global) e `Tutor.ativo` (perfil inativo) sao distintos: um tutor inativo recebe JWT valido com `tutorActive=false` e tem um fluxo de **reativacao** dedicado: rota `POST /users/me/reactivate` no `src/inactivation/inactivation.controller.ts:54-64` (handler `selfReactivate`), que chama `InactivationService.selfReactivate` (`src/inactivation/inactivation.service.ts:210-239`, transacao de reativacao + recomendacao de refresh de token). Isso e relevante para a Regra 2/AC3 abaixo. **A rota de reativacao NAO pode ser protegida por `@Roles(AppRole.TUTOR)`** (senao o tutor inativo nunca reativa).
- `SystemAdminGuard` (`src/auth/guards/system-admin.guard.ts:4-15`) e o unico guard de papel hoje: le `request.user.isSystemAdmin`, lanca `ForbiddenException('Acesso restrito a administradores do sistema')`. E sincrono e nao usa `Reflector`.
- `JwtAuthGuard` (`src/auth/guards/jwt-auth.guard.ts`) e so `AuthGuard('jwt')`. **`OptionalJwtAuthGuard` (`src/auth/guards/optional-jwt-auth.guard.ts:11-13`) NAO lanca em token ausente/invalido: seu `handleRequest` retorna `user ?? null`, ou seja `req.user = null` para request anonima legitima.** Isso e decisivo para a Regra 6 / Furo 1: `RolesGuard` precedido por `OptionalJwtAuthGuard` numa rota legitimamente publica-opcional veria `req.user` nulo **sem** ser misconfig. Por isso o `RolesGuard` **exige `JwtAuthGuard`** (que lanca 401 antes) e o check de pareamento **nao** aceita `OptionalJwtAuthGuard`.
- Guards sao aplicados **por controller/rota** via `@UseGuards(JwtAuthGuard)`. Nao ha `JwtAuthGuard` global em `APP_GUARD`. Logo, `@Roles`/`RolesGuard` tambem serao opt-in por rota (composiveis com `@UseGuards`), nao globais.
- Nao existe decorator `@Public` nem `@CurrentTutor` no repo. Padrao atual de extrair tutor: `@Req() req` com `req.user.tutorId`.
- `AuthModule` e `@Global()` e exporta `AuthService` e `OwnershipService`. O `RolesGuard` novo entra como provider exportado aqui (fica disponivel global sem reimport).
- **Bypass de admin do `OwnershipService`:** os metodos `assert*` aceitam um parametro `isAdmin` que **curto-circuita** a checagem de propriedade (`ownership.service.ts:42,56`). Ou seja, no nivel de **recurso**, admin e superusuario. Isso e relevante para a Regra 4 (contraste deliberado: no `RolesGuard`, admin **nao** e superusuario implicito).
- **Mensagem de ownership atual:** `OwnershipService.deny` (`ownership.service.ts:23-28`) lanca `ForbiddenException('Acesso negado a este recurso')` — **sem ponto final**. A copy pt-BR do catalogo (`OWNERSHIP_FORBIDDEN`) deve casar essa string **exata** (sem ponto) para satisfazer AC28/AC31 (zero mudanca de copy pt-BR).

### Throttler + proxy (estado atual)
- `@nestjs/throttler@6.5.0` ja e dependencia (`package.json:56`), versao instalada confirmada em `node_modules`.
- `ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])` ja configurado globalmente (**bucket sem `name` = bucket `default`**) e `ThrottlerGuard` registrado como `APP_GUARD` em `src/app.module.ts:47,89`.
- Override por rota ja em uso: `@Throttle({ default: { limit: 30, ttl: 60_000 } })` em `src/public-pet/public-pet.controller.ts:23`. **O util de codigo publico reusa esse mecanismo existente** — nao instala lib nova.
- `ThrottlerGuard` (6.5.0) expoe `protected getTracker(req): Promise<string>` e a opcao `getTracker`/`generateKey` por config (`throttler.guard.d.ts:13,19`). Por default `getTracker` retorna `req.ip`. **`req.ip` depende de `trustProxy`** (ver abaixo).
- `FastifyAdapter` instanciado **sem opcoes** em `src/main.ts:30-33` — **sem `trustProxy`**. Em producao atras do proxy do Railway, `req.ip` e o IP do proxy. Consequencia: throttle por IP seria efetivamente global ate `trustProxy`/`getTracker` ser configurado. **D14 decide habilitar `trustProxy` nesta fundacao** (ver Regra 23 e Modelo de Dados/Arquivos Impactados).
- **Nenhuma rota existente usa `req.ip` para logica de negocio** (verificado por grep `req.ip`/`request.ip`/`\.ip\b` em `src/**/*.ts` — **zero match**): hoje **nenhum** codigo consome `req.ip` (nem o throttler explicitamente — usa o default interno). Logo, habilitar `trustProxy` e seguro para a logica de dominio (so corrige o valor que o tracker default do throttler le).
- **`logger.middleware.ts` NAO usa `req.ip`:** ele loga `req.socket.remoteAddress` (`src/logger.middleware.ts:45`) e opera sobre `req: FastifyRequest['raw']` (o Node request cru, `logger.middleware.ts:41`), que **nao tem** `.ip` (a decoracao `req.ip` e da request Fastify, nao da raw). **Conclusao corrigida (Furo 2):** habilitar `trustProxy` **NAO** muda o IP visto nos logs. O log continua mostrando `socket.remoteAddress` (o IP do proxy do Railway). Para o IP real nos logs seria preciso uma mudanca separada (acessar a request Fastify decorada, nao a raw) — **fora do escopo desta parte** e registrada em Perguntas em Aberto.

### i18n (estado atual) — base do catalogo de erro (D14)
- `SUPPORTED_LOCALES = ['pt-BR', 'en-US', 'en-GB', 'es-419']` com `pt-BR` como `DEFAULT_LOCALE` — `src/common/i18n/locales.ts:8,12`. `normalizeLocale(raw)` (`locales.ts:32-43`) mapeia qualquer tag para um locale suportado (case-insensitive; desconhecido → pt-BR; **null/undefined/nao-string → pt-BR**, `locales.ts:33`); **en-GB e tratado explicitamente** (`locales.ts:38`), antes do branch generico `en-*` → en-US. **`normalizeLocale` ja e null-safe** — o helper `localeFromRequest` se apoia nisso (Furo 7).
- `@Locale()` (param decorator) ja existe — `src/common/decorators/locale.decorator.ts:14-19`: resolve `?lang=` (override) → `Accept-Language` (primeira tag) → `DEFAULT_LOCALE`, com guardas null-safe: `const query = req.query as Record<...> | undefined; const lang = query?.lang ?? req.headers['accept-language']; normalizeLocale(typeof lang === 'string' ? lang : undefined)`. **O helper `localeFromRequest` extrai exatamente essas guardas** (Furo 7) e o `@Locale()` passa a delegar a ele (refactor DRY).
- **Padrao de catalogo estatico ja existe:** `ESPECIE_LABELS: Record<Especie, Record<Locale, string>>` (`src/common/i18n/especie.labels.ts:12-20`) — constante TS, en-GB sempre explicito (`'en-GB': 'Dog'`, etc.), com `traduzEspecie(especie, locale)` caindo no `DEFAULT_LOCALE` e por fim no proprio valor (`especie.labels.ts:23-25`). **O catalogo de erro copia exatamente esse formato** (chave de erro no lugar do enum de especie). NAO e tabela; e constante. **O tipo `Record<ErrorKey, Record<Locale, string>>` ja forca completude de locale em tempo de compilacao** (chave faltando um locale = erro de tipo TS) — ver Furo 8 / AC30.
- `aplicarTraducao`/`cadeiaDeLocales` (`traducao.util.ts`, `locales.ts:50-59`) servem conteudo dinamico via coluna JSONB `traducoes`. **O catalogo de erro NAO usa essa via** (erro nao e conteudo de banco): usa o padrao estatico do `ESPECIE_LABELS`. A regra do Nicolas (en-GB sempre explicito, nunca via fallback) e respeitada porque o catalogo declara en-GB explicito em toda chave; o `LOCALE_FALLBACK` (`locales.ts:18-20`) **nao** e consultado pelo catalogo de erro.

### Envelope de resposta + validacao + filtro de erro (forma REAL verificada)
- **Sucesso:** `TransformInterceptor` (`src/common/interceptors/transform.interceptor.ts:10-30`) envelopa em `{ statusCode, message, data }`. Aplica-se **so a respostas de sucesso** (roda no `next.handle().pipe(map(...))`).
- **Erro:** o `HttpExceptionFilter` (`src/common/filters/http-exception.filter.ts:6-26`) **nao** usa o envelope de sucesso. Ele captura `HttpException`, le `exception.getResponse()`, monta `error = typeof res === 'string' ? { message: res } : (res as object)` e emite `{ statusCode, timestamp, path, ...error }` (`http-exception.filter.ts:13-25`). Para `HttpException` padrao do Nest, `exceptionResponse` e `{ statusCode, message, error }`. **Nao ha campo `data` em respostas de erro.** Forma efetiva de um 403: `{ statusCode: 403, timestamp, path, message: '...', error: 'Forbidden' }`.
- **Atencao (Furo 10):** o filtro faz **spread de `...error`** (`http-exception.filter.ts:24`). Se a excecao for `LocalizedException` (cujo `exceptionResponse` carrega `{ errorKey, message }`), o spread **vazaria `errorKey`** (ex.: `"ROLE_FORBIDDEN"`) no JSON da resposta. **O passo novo do filtro DEVE remover `errorKey` do objeto antes do spread** (ou construir o payload explicitamente sem ele). As tabelas de erro desta spec mostram a forma final **sem** `errorKey` — o codigo precisa garantir isso (AC27a).
- **O filtro hoje nao tem nocao de locale**: a `message` ja vem materializada (string fixa) de dentro do throw. Para o catalogo i18n (D14), o filtro precisa (a) detectar uma excecao que carrega **chave** em vez de mensagem materializada, (b) resolver a chave para o locale da request via `localeFromRequest(request)` (null-safe), e (c) remover `errorKey` do payload.
- `ValidationPipe` global com `transform/whitelist/forbidNonWhitelisted` (`src/main.ts:116-122`). DTOs com `class-validator`.
- Filtros globais `HttpExceptionFilter` + `PrismaClientExceptionFilter` (`src/main.ts:110-113`) formatam excecoes — nao envolver em try/catch generico.

### Schema (verificado em prisma/schema.prisma)
- `Usuario`: tem `isSystemAdmin`, relacoes `tutorPerfil Tutor?`, `veterinarioPerfil Veterinario?`. **Nao** tem campo/relacao de parceiro.
- `Tutor`: `usuarioId @unique`, `ativo Boolean @default(true)`.
- `Veterinario`: `usuarioId @unique`.
- `Parceiro`: hoje e leve (`id, nome, logoUrl, ativo, cupons`). **Sem** `usuarioId`, **sem** membership. A relacao `Usuario`<->`Parceiro` (`ParceiroEquipe`) e criada na Parte 3 (D6). **Esta Parte 0 nao cria essa tabela.**
- `ClinicasEquipe` e o padrao de membership de referencia (PK composta, `status StatusConvite`, `ativo`, `roleId`). Serve de molde para `ParceiroEquipe` na Parte 3 — citado aqui so como referencia.

### Conclusao de design a partir do research
- **Nenhuma tabela ou enum Prisma novo nesta Parte 0.** Papel e derivado em runtime; o util de codigo publico nao tem entidade propria (cada parte tem a sua tabela com a coluna de codigo); o catalogo de erro e constante TS; `trustProxy` e config de bootstrap. O util e o catalogo sao codigo TypeScript puro + integracao generica.
- O papel `PARCEIRO` nao pode ser resolvido a partir de `req.user` (o JWT nao carrega vinculo de parceiro e a tabela ainda nem existe). Solucao: o `RolesGuard` resolve `PARCEIRO` via **resolver injetavel** (`ParceiroRoleResolver`) que, na Parte 0, retorna sempre `false`. A Parte 3 substitui a implementacao desse resolver por uma query real em `ParceiroEquipe`, sem tocar o guard.
- O RNG do util e **injetavel** (token DI), nao um import direto chamado inline, para que o teste fixe codigos deterministicos sem depender de spy fragil em `node:crypto` (ver Estrategia de Testes e AC15).
- O catalogo de erro segue o **padrao estatico** do `ESPECIE_LABELS` (constante `Record<ErrorKey, Record<Locale, string>>`, en-GB explicito), nao a via JSONB de conteudo. Excecoes carregam **chave**; o filtro resolve e limpa `errorKey`. Isso desacopla "qual erro" (codigo de dominio) de "em que idioma" (request), e centraliza a copy num so arquivo.

---

## Modelo de Dados (diff Prisma por entidade)

**Nenhuma mudanca de schema Prisma nesta parte.**

- Nenhum model novo.
- Nenhum campo novo.
- Nenhum enum novo no `schema.prisma`.
- Nenhuma migration (`prisma migrate` nao roda nesta parte).

Justificativa:
- Papel e **derivado** de `req.user` + resolver, nunca persistido (D3: "SEM novo campo no JWT"; e por extensao, sem campo no banco).
- O util de codigo publico e agnostico de tabela: recebe a tabela/coluna alvo via callback do chamador. As tabelas que armazenam codigo (`CompartilhamentoPrestador`, `ConviteFamilia`) sao criadas nas Partes 1 e 2, com seus proprios diffs de schema.
- O enum de papel (`AppRole`) e um enum **TypeScript** (`src/auth/roles.enum.ts`), nao um enum Prisma — papel nao e coluna.
- **O catalogo i18n de erro e uma constante TypeScript** (`src/common/errors/error-catalog.ts`), **nao** uma tabela. A chave de erro (`ErrorKey`) e um union TS. D14 manda catalogo **estatico por chave** — sem nova entidade Prisma, sem migration, sem JSONB.
- **`trustProxy` e config de bootstrap** (`FastifyAdapter`), nao schema. O numero de hops vem de env (`TRUST_PROXY_HOPS`), nao de banco.

Confirmacao de invariante D8/regra 2: como nao ha migration, nao ha consumidor (app `petjourney-app`, CMS `petjourney-cms`) impactado por schema. Mudanca 100% aditiva no nivel de codigo. A mudanca de copy de erro para locale != pt-BR e aditiva (clientes que mandam `Accept-Language` passam a receber a mensagem traduzida; quem nao manda continua recebendo pt-BR identico ao de hoje).

---

## Contrato dos Endpoints

**Esta parte nao adiciona, remove nem altera nenhum endpoint HTTP.**

Entrega artefatos internos consumidos por controllers/services das Partes 1-4:
- `@Roles(...roles)` (decorator de metadata).
- `RolesGuard` (guard composivel com `JwtAuthGuard` **obrigatorio**).
- `AppRole` (enum TS).
- `PublicCodeService` (util de geracao/validacao de codigo): `gerar(isTaken)`, **`gerarComInsert(tentarInserir)`** (retry em `P2002`, fecha TOCTOU — Achado 3), `resolveAtivoOrThrow(codigo, findByCodigo)` (lanca 404, nunca `null`), e o helper `isTakenFactory(findAtivoVivo)` (embute `expiraEm > now` — Achado 7).
- `RandomCodeGenerator` (RNG cripto injetavel) + token DI.
- `ParceiroRoleResolver` (interface + impl no-op da Parte 0) + token DI.
- `PUBLIC_CODE_THROTTLE` (constante de config de throttle por IP). **D15: requisito de throttle cross-instancia (Redis OU lockout por codigo) e do DoD das Partes 1/2** — ver Regra 14a.
- `ERROR_CATALOG` + `ErrorKey` + `resolveErrorMessage` + `LocalizedException` (catalogo i18n de erro — D14).
- `localeFromRequest` (helper puro null-safe de locale por request).
- `assert403` (politica 403 com semantica e teste — Furo 6) **e `assert403Owner(ownerUserId, currentUserId)`** (variante tipada que compara internamente, fecha o predicado degenerado — Achado 5).
- Habilitacao de `trustProxy` no `main.ts` via `TRUST_PROXY_HOPS` (D14).

### Exemplo de uso (ilustrativo, NAO faz parte do escopo de implementacao desta parte)

Rota que so parceiro logado acessa (entra de fato na Parte 3). Ordem de guards obrigatoria: `JwtAuthGuard` antes (popula `req.user` **e lanca 401 se anonimo**), `RolesGuard` depois.

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.PARCEIRO)
@Get('parceiro/dashboard')
dashboard(@Req() req) { ... }
```

> **`OptionalJwtAuthGuard` NAO pode preceder o `RolesGuard`** (Furo 1): ele deixa `req.user = null` para anonimo legitimo, e o `RolesGuard` nao tem como distinguir "anonimo legitimo" de "misconfig" so olhando `req.user`. Rotas que precisam de "auth opcional + papel" nao sao suportadas por este guard nesta parte (registrado em Perguntas em Aberto). O check de pareamento (Task 23) **falha** se `RolesGuard` aparecer sem `JwtAuthGuard` imediatamente antes.

Erros padronizados quando `RolesGuard` nega. **Forma real do `HttpExceptionFilter`** (sem `data`, **sem `errorKey`**; copy visivel sem em-dash; a `message` e resolvida pelo catalogo i18n no locale da request — coluna mostra o pt-BR):

| Situacao | Status | Chave (ErrorKey) | Forma da resposta de erro (locale pt-BR) |
|---|---|---|---|
| `req.user` ausente porque faltou `JwtAuthGuard` antes (misconfig de rota) | 401 | `AUTH_REQUIRED` | `{ statusCode: 401, timestamp, path, message: 'Autenticacao necessaria.', error: 'Unauthorized' }` |
| usuario autenticado mas sem nenhum papel exigido | 403 | `ROLE_FORBIDDEN` | `{ statusCode: 403, timestamp, path, message: 'Acesso restrito ao papel necessario.', error: 'Forbidden' }` |

> O 401 acima sinaliza **misconfig de rota** (faltou `JwtAuthGuard` antes do `RolesGuard`). Com `JwtAuthGuard` obrigatorio antes, uma request anonima legitima ja toma 401 **no `JwtAuthGuard`** (que lanca), nunca chegando ao `RolesGuard` com `req.user` nulo. O 401 do `RolesGuard` so dispara se o pareamento estiver errado (rede de seguranca). Mitigado por JSDoc obrigatorio + check de pareamento de guards (ver Regra 6 e Riscos).

Erros do util de codigo publico (quando as Partes 1/2 chamam `resolveAtivoOrThrow`):

| Situacao | Status | Chave (ErrorKey) | Forma da resposta de erro (locale pt-BR) |
|---|---|---|---|
| codigo inexistente, expirado, revogado OU formato invalido | 404 | `PUBLIC_CODE_INVALID` | `{ statusCode: 404, timestamp, path, message: 'Codigo invalido ou expirado.', error: 'Not Found' }` |
| densidade de codigos vivos impede geracao | 503 | `PUBLIC_CODE_GEN_EXHAUSTED` | `{ statusCode: 503, timestamp, path, message: 'Nao foi possivel gerar um codigo no momento. Tente novamente.', error: 'Service Unavailable' }` |
| rate-limit estourado | 429 | (forma padrao do `ThrottlerGuard`) | forma padrao do `ThrottlerGuard` (passa pelo mesmo `HttpExceptionFilter`; mensagem do throttler nao e catalogada nesta parte) |

> D2: erro **generico** unico para invalido/expirado/revogado/mal-formatado (nao vaza qual). 404 escolhido por nao revelar existencia (D14: lookup por codigo publico = 404 generico anti-enumeracao).

### Exemplo de resposta de erro em outro locale (catalogo i18n — D14)

Mesma situacao `ROLE_FORBIDDEN`, request com `Accept-Language: en-GB` (ou `?lang=en-GB`):

```json
{ "statusCode": 403, "timestamp": "...", "path": "...", "message": "Access restricted to the required role.", "error": "Forbidden" }
```

Com `Accept-Language: es-419`:

```json
{ "statusCode": 403, "timestamp": "...", "path": "...", "message": "Acceso restringido al rol requerido.", "error": "Forbidden" }
```

> A resposta **nao contem o campo `errorKey`** (o filtro o remove antes do spread — Furo 10). A `error` (`'Forbidden'`/`'Unauthorized'`/`'Not Found'`) e o reason-phrase HTTP padrao do Nest e **nao** e traduzido (e identificador tecnico, nao copy de usuario). So a `message` passa pelo catalogo. `statusCode`/`error` permanecem estaveis para o cliente parsear; a `message` e para exibicao.

---

## Regras de Negocio

### Papeis (`@Roles` + `RolesGuard`) — D3

1. **Enum de papel (`AppRole`)** vive em `src/auth/roles.enum.ts`. Valores nesta parte: `SYSTEM_ADMIN`, `TUTOR`, `VETERINARIO`, `PARCEIRO`. Papeis de **familia** (`LIDER`/`CONVIDADO`) **NAO** entram aqui: D3 diz que sao escopados ao plano, nao globais. Quem resolve familia e a Parte 2 (via membership), nao o `RolesGuard`.

2. **Derivacao de papel a partir de `req.user`** (sem campo novo no JWT):
   - `SYSTEM_ADMIN` ⟺ `req.user.isSystemAdmin === true`.
   - `TUTOR` ⟺ `req.user.tutorId != null` **e** `req.user.tutorActive !== false`. Semantica explicita: **`@Roles(AppRole.TUTOR)` significa "tutor com perfil ativo"**. Um tutor inativo (`tutorActive === false`) continua **autenticado** (JWT valido) mas **nao** tem papel `TUTOR`; o caminho dele e a rota de **reativacao** `POST /users/me/reactivate` (`src/inactivation/inactivation.controller.ts:54-64` → `inactivation.service.ts:210-239`), que **nao deve** ser protegida por `@Roles(AppRole.TUTOR)` (senao o tutor inativo nunca reativa). `tutorActive === null` significa "sem perfil tutor" e ja e coberto por `tutorId == null`.
   - `VETERINARIO` ⟺ `req.user.veterinarioId != null`.
   - `PARCEIRO` ⟺ `ParceiroRoleResolver.isParceiro(userId)` retorna `true`. **Na Parte 0 esse resolver retorna sempre `false`** (sem tabela de membership ainda). A Parte 3 troca a impl.

2a. **Semantica de staleness do claim de papel (Achado 4 — derivada de D3):** `@Roles(AppRole.TUTOR)` reflete o **estado do JWT no momento da emissao**, nao o estado vivo de `Tutor.ativo`. O `tutorActive` e materializado no login (`jwt.strategy.ts:38`) e **nao** e re-consultado a cada request. Um tutor que se inativa (`POST /users/me/inactivate`) ou reativa (`POST /users/me/reactivate`, `inactivation.controller.ts:54-64`) **depois** de obter o token continua com o claim antigo ate o refresh — a propria rota de reativacao instrui o app a chamar `/auth/refresh` em seguida. Existe portanto uma **janela de staleness**: `@Roles(TUTOR)` pode autorizar um tutor ja inativo (token stale `tutorActive=true`) ou negar um tutor ja reativado (token stale `tutorActive=false`). Regras derivadas:
   - **`@Roles` e uma checagem de papel, nao de estado vivo.** A janela de staleness e **aceita como design** nesta fundacao, mitigada pelo **TTL curto do access token** (`JWT_ACCESS_TTL`) + refresh apos inativar/reativar. Documentar isso no JSDoc do `RolesGuard` e nas Partes 1-4.
   - **Para acoes sensiveis a inativacao** (ex.: criar compartilhamento de prestador na Parte 1, criar/gerir familia na Parte 2), a parte consumidora **DEVE revalidar `Tutor.ativo` no service** (query) em vez de confiar so no claim — exatamente como ja faz o `OwnershipService` (estado vivo no banco). O guard de papel **nao** substitui essa revalidacao.
   - **Nao** introduzir consulta de estado vivo dentro do `RolesGuard` nesta parte (custaria I/O em toda rota de papel e nao foi pedido). A decisao "guard consulta estado vivo vs. confia no claim + TTL curto" fica registrada em Perguntas em Aberto #11 para reabrir so se alguma parte exigir.

3. **Semantica OR (qualquer papel basta).** `@Roles(A, B)` autoriza se o usuario tem **pelo menos um** dos papeis. Sem nenhum papel exigido casado → 403. Racional: e o padrao de NestJS RBAC e cobre os casos do epico (ex.: rota acessivel a `TUTOR` OU `SYSTEM_ADMIN`).

4. **`SYSTEM_ADMIN` nao e superusuario implicito no `RolesGuard`.** Se uma rota exige `@Roles(AppRole.PARCEIRO)`, admin **nao** passa automaticamente; para liberar admin, declarar `@Roles(AppRole.PARCEIRO, AppRole.SYSTEM_ADMIN)`. Racional: evita escalonamento silencioso; deixa a intencao explicita na rota.
   - **Contraste deliberado com o `OwnershipService`** (documentar no JSDoc e na PR): no nivel de **recurso**, admin **e** superusuario (parametro `isAdmin` curto-circuita o ownership, `ownership.service.ts:42,56`). No nivel de **papel** (`RolesGuard`), admin **nao** e. As duas camadas respondem perguntas diferentes (papel = "pode tentar essa classe de rota"; ownership = "esse recurso e dele"). Rotas administrativas que hoje dependem do bypass de recurso e que migrarem para `@Roles` no futuro precisam listar `SYSTEM_ADMIN` explicitamente. Esta parte **nao** migra nenhuma rota.

5. **Rota sem `@Roles`** (so `RolesGuard` aplicado sem metadata) → guard **permite** (degrada para "qualquer autenticado"), desde que `req.user` exista. Se `req.user` for ausente, lanca 401 (Regra 6).

6. **Composicao com `JwtAuthGuard` (obrigatoria) e protecao contra misconfig:** uso obrigatorio `@UseGuards(JwtAuthGuard, RolesGuard)` nessa ordem (auth resolve `req.user` **e lanca 401 se anonimo** antes do papel). `RolesGuard` **nao** autentica; assume `req.user` populado por um guard que **lanca** quando ausente. **`OptionalJwtAuthGuard` e PROIBIDO antes do `RolesGuard`** (Furo 1): como ele deixa `req.user = null` para anonimo legitimo (`optional-jwt-auth.guard.ts:11-13`), o `RolesGuard` nao consegue distinguir "anonimo legitimo" de "misconfig" — entao a combinacao "auth opcional + papel" nao e suportada nesta parte. Se `req.user` faltar no `RolesGuard`, e tratado como **misconfig de rota** (faltou `JwtAuthGuard`): o guard lanca `LocalizedException('AUTH_REQUIRED', 401)` **e** loga WARN especifico (`reason=missing_user`) para flagar a rota mal montada. O JSDoc do `RolesGuard` exige `JwtAuthGuard` antes. Um check de pareamento (ver Tasks) varre os controllers e **falha** se algum aplicar `RolesGuard` sem **`JwtAuthGuard`** imediatamente antes (`OptionalJwtAuthGuard` **nao** satisfaz o check).

7. **`SystemAdminGuard` permanece intacto** (`system-admin.guard.ts`). Nao migrar rotas existentes agora (regra de zero alteracao de comportamento). `RolesGuard` pode coexistir; migracao futura e opcional e fora do escopo.

8. **`RolesGuard` e async** (`canActivate` retorna `Promise<boolean>`) porque `PARCEIRO` pode exigir I/O (na Parte 3). Na Parte 0 o resolver no-op resolve sincrono, mas a assinatura ja e async para nao quebrar contrato depois.

9. **Curto-circuito sincrono antes do resolver (ordem determinista).** O guard avalia **primeiro** todos os papeis sincronos exigidos (`SYSTEM_ADMIN`/`TUTOR`/`VETERINARIO`, derivados so de `req.user`). Se **qualquer** um casar, autoriza **sem** chamar o `ParceiroRoleResolver` (zero I/O). So chama o resolver quando (a) `PARCEIRO` esta entre os papeis exigidos **e** (b) nenhum papel sincrono casou. Consequencia testavel: `@Roles(AppRole.TUTOR, AppRole.PARCEIRO)` com um tutor ativo autoriza sem invocar o resolver (a ordem dos papeis no decorator nao muda o resultado; os sincronos sempre sao avaliados primeiro). Ver AC24.

### Util de codigo publico — D2

10. **Formato:** string de exatamente 6 digitos decimais (`000000`–`999999`), com zeros a esquerda preservados. Gerado com RNG criptografico (`crypto.randomInt`), **encapsulado num provider injetavel** (`RandomCodeGenerator`), nunca `Math.random`.

11. **Unicidade entre ativos/nao-expirados:** o codigo gerado deve ser unico **apenas** no conjunto de registros que o chamador considera "vivos" (status ativo **e** `expiraEm > now`). Codigos de registros expirados/revogados podem ser reaproveitados (espaco de 10^6 e finito; reuso seguro porque o antigo nao abre mais nada). O chamador fornece o predicado de colisao via callback `isTaken(codigo): Promise<boolean>`.

11a. **Contrato do `isTaken` (obrigatorio e nao-opcional — Achado 7):** o predicado de colisao **DEVE** ser `status=ATIVO AND expiraEm > now` (os **dois**, sempre). Implementar `isTaken` so por `status=ATIVO` (esquecendo `expiraEm > now`) e o classico "fechar parcial": um registro `ATIVO` com `expiraEm <= now` mas ainda nao lazy-expirado (porque ninguem o leu, ver Regra 13) seguiria "ocupando" o codigo do ponto de vista do `isTaken`, bloqueando reuso legitimo e degradando a densidade do espaco de codigos. Como o predicado e fornecido pelo caller, o **DoD das Partes 1/2 DEVE auditar** que o `isTaken` inclui `expiraEm > now`. Para fechar isso no contrato (e nao so na revisao), o util expoe um helper opcional `isTakenFactory(findAtivoVivo)` que embute o `expiraEm > now`: o caller passa **so** a query de existencia por `(codigo, status=ATIVO)` e o util adiciona a comparacao temporal — preferir esse factory a um callback livre. Ver AC13a.

12. **Geracao com retry anti-colisao:** loop ate `MAX_TENTATIVAS = 5`. Se `isTaken` for `true`, gera outro. Se estourar 5 tentativas, lanca `LocalizedException` com chave `PUBLIC_CODE_GEN_EXHAUSTED` (503) e loga WARN. Racional: com 10^6 codigos, 5 tentativas so falham se houver centenas de milhares de codigos vivos simultaneos — sinal de abuso ou de design quebrado a montante; melhor falhar alto.

12a. **Race condition de unicidade (TOCTOU) — `isTaken` sozinho NAO garante unicidade (Achado 3):** o padrao `isTaken(codigo)` retorna `false` -> caller faz `INSERT` e **check-then-insert**: entre a checagem e o INSERT, duas requests concorrentes podem gerar o **mesmo** codigo e ambas passarem o `isTaken`, resultando em **dois codigos identicos vivos**. O `isTaken` reduz colisao mas **nao** a elimina sob concorrencia. Contrato de fechamento (obrigatorio para Partes 1/2):
    - **(a) UNIQUE parcial no banco e mandatorio.** A tabela de cada consumidor (`CompartilhamentoPrestador`, `ConviteFamilia`) **DEVE** ter um indice UNIQUE parcial na coluna de codigo restrito a `status=ATIVO` (ex.: `@@unique([codigo])` com `where status=ATIVO`, ou unique parcial via migration SQL). Esse indice e a **unica** garantia real de unicidade entre vivos; o `isTaken` e so otimizacao para evitar a maioria dos roundtrips.
    - **(b) O retry envolve o INSERT, nao so o `isTaken`.** O fluxo correto e: `gerar codigo -> tentar INSERT -> em P2002 (unique violation) tratar como colisao e regerar dentro do mesmo loop de MAX_TENTATIVAS`. Para suportar isso o util expoe a variante `gerarComInsert(tentarInserir: (codigo) => Promise<T>): Promise<T>`, onde `tentarInserir` faz o INSERT e **lanca** em `P2002`; o util captura `P2002`, regenera e tenta de novo ate `MAX_TENTATIVAS`, lancando `PUBLIC_CODE_GEN_EXHAUSTED` (503) se esgotar. O `gerar(isTaken)` continua disponivel para callers que preferem o check-then-insert com o UNIQUE como rede, mas o **caminho recomendado e `gerarComInsert`** (fecha o TOCTOU). Ver AC13b.

13. **Validacao (`resolveAtivoOrThrow`):** recebe o codigo + um loader `findByCodigo(codigo)` do chamador. Regras:
    - normaliza input (trim, remove espacos/hifens, valida regex `^\d{6}$`; formato invalido → mesmo 404 generico, **nao** 400, para nao distinguir "mal formatado" de "inexistente").
    - se nao encontrar, ou `status` for revogado, ou `expiraEm <= now` → lanca `LocalizedException` com chave `PUBLIC_CODE_INVALID` (404) (D2: erro unico generico).
    - retorna o registro vivo para o chamador prosseguir.
    - **Nao** muta status aqui (lazy-expire ATIVO→EXPIRADO e responsabilidade do service de dominio da Parte 1/2; o util so le e decide).
    - **Nunca retorna `null`** (Achado 1): em qualquer caso de invalidez **lanca** o 404 generico. O caller nao re-traduz `null` para 404; o util ja e o ponto unico do 404 anti-enumeracao.

13a. **Contrato congelado vs. divergencia da Parte 2 (Achado 1):** a Parte 2 (`02:39-50`) declara um `CodigoPublicoHelper` com `gerar(input: { usuarioId; tipo; ttlMs }): Promise<{ codigo; expiraEm }>` e `resolver(codigo): Promise<{...} | null>`. **Essas assinaturas NAO existem neste util e nao devem ser implementadas aqui.** A Parte 0 e tabela-agnostica por D2 (o util nao conhece `usuarioId`/`tipo`/`ttl` — isso e identidade da tabela de cada parte). A reconciliacao e na Parte 2 (nao aqui): `expiraEm = now + ttl` e calculado e persistido pelo **service de Familia** ao criar o `ConviteFamilia`; a unicidade usa `gerar(isTaken)`/`gerarComInsert`; a validacao usa `resolveAtivoOrThrow` (que **lanca 404**, dispensando o `resolver`->`null`). A Parte 1 (`01:426`) ja consome o contrato correto (callback `isTaken` + 404 generico) e serve de referencia. Registrado em Perguntas em Aberto #10 como acao de reconciliacao da Parte 2.

14. **Rate-limit (so a defesa por IP nesta parte):** o util **nao** implementa rate-limit proprio; expoe a constante `PUBLIC_CODE_THROTTLE` (`{ default: { limit: 10, ttl: 60_000 } }`) que as rotas publicas das Partes 1/2 aplicam via `@Throttle(PUBLIC_CODE_THROTTLE)`. Reusa o `ThrottlerGuard` global (`app.module.ts:89`). O nome de bucket `default` **deve substituir** o bucket `default` global (limit 60) naquela rota, baixando para 10/min/IP — comportamento desejado.
    - **Substituicao efetiva e verificada em runtime, nao assumida (Achado 6).** O `ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])` cria **um** bucket sem `name`, que o `@nestjs/throttler` 6.x nomeia internamente `default`; o override por rota `@Throttle({ default: {...} })` so **substitui** (em vez de coexistir/somar) se o nome bater exatamente `default`. Isso e plausivel (e o que `public-pet.controller.ts:23` ja faz com limit 30), **mas nao e provado por leitura** — e o tipo de "ts passou nao e pronto" que ja queimou o repo. Por isso esta parte adiciona um **teste runtime** (`app.inject`) numa rota fixture com `@Throttle(PUBLIC_CODE_THROTTLE)`: a **11a** request/min/IP toma **429** e ate 10 passam, confirmando que **10 substitui 60** (e nao soma para 70 nem mantem 60). Ver AC22a. Se o throttler 6.5.0 nao substituir por nome como esperado, ajustar (mesmo nome ou desabilitar o `default` global na rota) **nesta parte** — antes de a Parte 1 depender disso.
    - **Chave de throttle confiavel (D14):** o tracker default e `req.ip`. Com `trustProxy` habilitado nesta fundacao (Regra 23), `req.ip` passa a ser o IP real do cliente atras do Railway, entao o balde por IP funciona.
    - **A Parte 0 NAO entrega a defesa por codigo (Furo 11).** O balde **por IP sozinho NAO protege contra brute-force distribuido** (atacante com muitos IPs distribui as tentativas de um codigo alvo). A defesa real contra brute-force de um codigo de 6 digitos (espaco 10^6) e um **segundo balde chaveado pelo codigo/recurso** (independente de IP), que **e responsabilidade da parte que consome** (Parte 1/2), porque a granularidade exata (por codigo vs por slug de convite) depende do shape da tabela de cada parte e o nome de bucket `default` ja esta ocupado pelo balde por IP (precisaria de um segundo bucket nomeado via `@Throttle` named + `generateKey`). Shape sugerido para a parte consumidora: `@Throttle({ default: PUBLIC_CODE_THROTTLE.default, codigo: { limit: <n>, ttl: 60_000 } })` com `generateKey` do bucket `codigo` chaveando pelo codigo recebido. **Registrado em Perguntas em Aberto #2.** Consequencia para o risco "Alto: brute-force": a mitigacao **completa** depende de algo que esta parte **nao** entrega — ver tabela de Riscos.

14a. **Throttle cross-instancia (D15) — o storage atual e in-memory:** o `ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])` (`app.module.ts:47`) usa o **storage default in-memory** do `@nestjs/throttler` (nao ha `ThrottlerStorageRedisService` nem outro adapter configurado). No Railway com **mais de uma instancia**, cada instancia mantem seu **proprio** contador: o limite efetivo por IP/codigo vira `limit x numero_de_instancias`, e um atacante roteado por instancias diferentes furam o balde. **D15 exige**, para as rotas publicas por codigo das Partes 1/2, **uma** das duas opcoes (decisao da parte consumidora no DoD dela):
    - **(A) Redis no throttler:** trocar o storage default por `ThrottlerStorageRedisService` (estado compartilhado entre instancias) — fecha tanto o balde por IP quanto o balde por codigo de forma cross-instancia.
    - **(B) Lockout por codigo persistido:** um contador de tentativas falhas **por codigo** persistido no Postgres (coluna `tentativasInvalidas` + `bloqueadoAte` na tabela do consumidor), incrementado a cada `resolveAtivoOrThrow` que da 404, com lockout temporario do codigo apos N falhas — independente de throttler/instancia.
    A **Parte 0 nao escolhe** entre (A) e (B) (depende de infra Redis estar disponivel e do shape de cada tabela); ela **congela o requisito**: nenhuma rota publica por codigo das Partes 1/2 vai a producao sem (A) **ou** (B). O `PUBLIC_CODE_THROTTLE` in-memory sozinho **nao** satisfaz o DoD das filhas. Ver Perguntas em Aberto #2 e a tabela de Riscos (linha "brute-force").

15. **Sem em-dash** em qualquer copy do util e do catalogo de erro (mensagens 404/503 e demais chaves). Verificado nas strings (uso de ponto/dois-pontos). AC23 grep `—` = 0 cobre os arquivos novos, **incluindo `error-catalog.ts`**.

### Catalogo i18n de mensagem de erro — D14

16. **Modelo: catalogo estatico por chave (constante, NAO tabela).** Vive em `src/common/errors/error-catalog.ts`. Formato espelha `ESPECIE_LABELS`:
    ```ts
    export type ErrorKey =
      | 'AUTH_REQUIRED'
      | 'ROLE_FORBIDDEN'
      | 'PUBLIC_CODE_INVALID'
      | 'PUBLIC_CODE_GEN_EXHAUSTED'
      | 'OWNERSHIP_FORBIDDEN'; // mensagem migrada do OwnershipService (AC31 obrigatorio)

    export const ERROR_CATALOG: Record<ErrorKey, Record<Locale, string>> = {
      AUTH_REQUIRED: {
        'pt-BR': 'Autenticacao necessaria.',
        'en-US': 'Authentication required.',
        'en-GB': 'Authentication required.',
        'es-419': 'Autenticacion requerida.',
      },
      ROLE_FORBIDDEN: {
        'pt-BR': 'Acesso restrito ao papel necessario.',
        'en-US': 'Access restricted to the required role.',
        'en-GB': 'Access restricted to the required role.',
        'es-419': 'Acceso restringido al rol requerido.',
      },
      PUBLIC_CODE_INVALID: {
        'pt-BR': 'Codigo invalido ou expirado.',
        'en-US': 'Invalid or expired code.',
        'en-GB': 'Invalid or expired code.',
        'es-419': 'Codigo invalido o expirado.',
      },
      PUBLIC_CODE_GEN_EXHAUSTED: {
        'pt-BR': 'Nao foi possivel gerar um codigo no momento. Tente novamente.',
        'en-US': 'Could not generate a code right now. Please try again.',
        'en-GB': 'Could not generate a code right now. Please try again.',
        'es-419': 'No se pudo generar un codigo en este momento. Intente de nuevo.',
      },
      OWNERSHIP_FORBIDDEN: {
        // pt-BR DEVE casar exatamente a string atual do OwnershipService
        // (ownership.service.ts:27) — SEM ponto final — para AC28/AC31.
        'pt-BR': 'Acesso negado a este recurso',
        'en-US': 'Access to this resource is denied',
        'en-GB': 'Access to this resource is denied',
        'es-419': 'Acceso denegado a este recurso',
      },
    };
    ```
    - **`en-GB` sempre explicito** em toda chave (regra do Nicolas / `i18n-en-gb-obrigatorio`). Nunca via fallback en-GB → en-US, mesmo quando o texto e identico ao en-US: a chave declara `'en-GB'` literal. **Completude de locale e garantida pelo COMPILADOR** (o tipo `Record<ErrorKey, Record<Locale, string>>` faz uma chave que omita qualquer locale virar erro de tipo TS) — ver Furo 8. AC30 cobre o que o compilador **nao** cobre: en-dash ausente e string nao-vazia.
    - **Constante, nao tabela:** sem entidade Prisma, sem migration, sem JSONB. Igual ao `ESPECIE_LABELS`. Editar erro = editar o arquivo (revisavel em PR).
    - **Sem em-dash** em nenhuma string do catalogo (AC23).

17. **Resolucao da copy (`resolveErrorMessage(key, locale)`):** funcao pura, espelha `traduzEspecie`:
    ```ts
    export function resolveErrorMessage(key: ErrorKey, locale: Locale = DEFAULT_LOCALE): string {
      return ERROR_CATALOG[key]?.[locale] ?? ERROR_CATALOG[key]?.[DEFAULT_LOCALE] ?? key;
    }
    ```
    O `locale` vem do `Accept-Language`/`?lang=` da request via `localeFromRequest` (mesma fonte do `@Locale()`). Cai no `DEFAULT_LOCALE` (pt-BR) e por fim na propria chave (nunca quebra a resposta).

18. **Interface chave-de-erro → excecao: `LocalizedException`.** Uma excecao de dominio que carrega a **chave** (e o status), nao a mensagem materializada:
    ```ts
    export class LocalizedException extends HttpException {
      constructor(public readonly errorKey: ErrorKey, status: HttpStatus) {
        // mensagem placeholder = pt-BR (para logs/stack e fallback se o filtro nao resolver)
        super({ errorKey, message: resolveErrorMessage(errorKey, DEFAULT_LOCALE) }, status);
      }
    }
    ```
    - O `RolesGuard`, o `PublicCodeService` e o `OwnershipService` lancam `LocalizedException(<key>, <status>)` em vez de strings literais. Helpers de conveniencia podem existir (ex.: `forbiddenRole()` → `new LocalizedException('ROLE_FORBIDDEN', HttpStatus.FORBIDDEN)`), mas nao sao obrigatorios.
    - **O `exceptionResponse` carrega `errorKey`** — por isso o filtro **deve removê-lo** antes de serializar a resposta (Regra 19 / Furo 10).

19. **Integracao no `HttpExceptionFilter` (forma minima e segura):** o filtro (`http-exception.filter.ts:6-26`) ganha um passo: se o `exceptionResponse` (objeto) carrega `errorKey` (instancia de `LocalizedException`), o filtro:
    1. resolve `message = resolveErrorMessage(errorKey, localeFromRequest(request))`;
    2. **remove `errorKey`** do objeto antes do spread `...error` (constroi o payload sem `errorKey` — senao o identificador interno vaza no JSON, Furo 10);
    3. usa a `message` resolvida no payload.
    O `localeFromRequest(req)` (helper puro **null-safe**, ver Regra 19b) extrai `?lang=`/`Accept-Language` e aplica `normalizeLocale`. **Excecoes que NAO carregam `errorKey` passam intactas** (comportamento atual preservado byte-a-byte): o filtro so muda a `message` e remove `errorKey` quando ha `errorKey`. Logo, nenhuma das centenas de `throw new ForbiddenException('...')` espalhadas hoje muda — so o que opta pela chave. Migracao incremental.
    - **`error` (reason-phrase) nao e traduzido.** O filtro mantem o `error: 'Forbidden'`/`'Unauthorized'`/`'Not Found'` do Nest (identificador tecnico). So a `message` e localizada.

    **19b. `localeFromRequest` e null-safe (Furo 7).** O helper replica **exatamente** as guardas do `locale.decorator.ts:16-18` e **nunca lanca**, mesmo no caminho de erro (onde `req.query` pode ser `undefined` se a excecao subir antes do roteamento popular a query):
    ```ts
    export function localeFromRequest(req: FastifyRequest): Locale {
      const query = req.query as Record<string, string | undefined> | undefined;
      const lang = query?.lang ?? req.headers?.['accept-language'];
      return normalizeLocale(typeof lang === 'string' ? lang : undefined);
    }
    ```
    `normalizeLocale` ja e tolerante a `undefined`/null (`locales.ts:33`), entao `localeFromRequest` cai em `DEFAULT_LOCALE` sem quebrar para qualquer request degenerada. O `@Locale()` passa a **delegar** a esse helper (refactor DRY), garantindo que decorator e filtro usem a mesma logica.

20. **Escopo do catalogo nesta parte (D14 cumprido incrementalmente — Furo 4):** so as chaves geradas pela fundacao (`AUTH_REQUIRED`, `ROLE_FORBIDDEN`, `PUBLIC_CODE_INVALID`, `PUBLIC_CODE_GEN_EXHAUSTED`) + `OWNERSHIP_FORBIDDEN` (migracao **obrigatoria** do ownership nesta parte). D14 ("respostas passam pelo catalogo") e cumprido **incrementalmente**: a Parte 0 entrega a infra + 5 chaves e migra **uma** familia de respostas reais (os 403 de ownership), suficiente para **exercicio end-to-end** (uma rota viva que dispara 403 de ownership com `Accept-Language: en-GB` retorna a copy traduzida — validavel por smoke/integration real, nao so unit com `ArgumentsHost` mock). As centenas de `throw new XException('string')` legadas ficam intactas por design (migracao oportunistica futura — Perguntas em Aberto #4). As Partes 1-4 **adicionam suas chaves ao mesmo arquivo** (ex.: `FAMILIA_LIMITE_MEMBROS`, `PRESTADOR_EXPIRADO`). O catalogo cresce aditivamente; cada parte que adiciona chave preenche os 4 locales (en-GB explicito) — **completude de locale forcada pelo compilador** (tipo), en-dash e nao-vazio validados por test/CI (AC30).

### Politica 403 vs 404 — D14

21. **Politica (D14):** ownership autenticado (rota autenticada acessando recurso de terceiro) usa **403**; lookup por **codigo publico** (prestador, convite de familia) usa **404 generico** anti-enumeracao.
    - **403 (ownership):** ja e o padrao do repo (`OwnershipService` lanca `ForbiddenException`, `ownership.service.ts:23-28`, agora via `LocalizedException('OWNERSHIP_FORBIDDEN')`). **Nao** trocar por 404: o tutor esta autenticado e a existencia do recurso nao e segredo dele; 403 e o sinal correto e nao vaza enumeracao entre tutores porque o id e opaco e a checagem e por `tutorId`.
    - **404 generico (codigo publico):** o util de codigo publico ja centraliza isso (Regra 13 → `PUBLIC_CODE_INVALID` 404), **indistinguivel** entre inexistente/expirado/revogado/mal-formatado. Aqui o 404 e o **proprio** sinal anti-enumeracao (nao revela se o codigo existe).
    - **Helper/politica `assert403` (semantica explicita — Furo 6):** helper fino em `src/common/errors/` com assinatura e semantica **inequivocas**:
      ```ts
      /**
       * Lanca LocalizedException 403 quando o acesso NAO e permitido.
       * @param temAcesso - true se o usuario PODE acessar (NAO lanca);
       *                     false se deve ser negado (LANCA 403).
       * Mnemonico: "assert que tem acesso; se nao tem, 403".
       */
      export function assert403(temAcesso: boolean, key: ErrorKey = 'OWNERSHIP_FORBIDDEN'): void {
        if (!temAcesso) throw new LocalizedException(key, HttpStatus.FORBIDDEN);
      }
      // uso: assert403(membro.tutorId === tutorLogado, 'OWNERSHIP_FORBIDDEN');
      ```
      O argumento e **"tem acesso"** (verdadeiro = libera), alinhado ao nome `assert403` ("garanta que pode; senao 403"). **Tem AC dedicado (AC36)** cobrindo happy (`temAcesso=true` → nao lanca) + falha (`temAcesso=false` → lanca 403 com a key). Sem esse AC, o helper seria o classico "fechar parcial, Nicolas pega o gap" — por isso e testado nesta parte. **Nao** substitui o `OwnershipService` (continua sendo o chokepoint dos `assert*Ownership`); e para os 403 que nao tem metodo dedicado (ex.: checagens ad-hoc de membro de familia na Parte 2). O 404 de codigo publico ja vem do `resolveAtivoOrThrow` (nao precisa de helper separado).
    - **Anti-pattern de predicado degenerado (Achado 5 — o ponto onde BOLA mais facilmente entra):** o `assert403(boolean)` **confia 100%** no booleano que o caller computa — diferente do `OwnershipService.assert*`, que faz a query e compara internamente. O risco concreto: o caller comparar o campo **errado**, em especial `req.user.usuarioId` (que **nao existe**: o JWT expoe `req.user.userId`, ver `jwt.strategy.ts:31-40` e a nota da Parte 2 `02:89-93`). `membro.usuarioId === req.user.usuarioId` vira `undefined === undefined` → `true` → `assert403(true)` → **libera tudo**. Regras derivadas (obrigatorias):
      - **O booleano passado ao `assert403` DEVE comparar valores garantidamente nao-`undefined`.** Comparar contra `req.user.userId` (existe), **nunca** `req.user.usuarioId` (sempre `undefined`).
      - **Para ownership use a variante tipada `assert403Owner`** (Regra 21a), que compara internamente e fecha o buraco do predicado degenerado. Reservar `assert403(boolean)` para checagens **nao-ownership** (ex.: status de convite, flag de feature) onde nao ha "owner id" a comparar.
      - **`security-auditor` audita cada callsite de `assert403` nas Partes 1-4** (cada booleano e cada `assert403Owner`), no mesmo nivel do "tutor errado" do checklist de BOLA.

21a. **Variante tipada `assert403Owner` (fecha o predicado degenerado — Achado 5):**
    ```ts
    /**
     * 403 quando o recurso NAO pertence ao usuario logado.
     * Compara internamente (nao recebe boolean pre-computado, evitando o bug
     * `req.user.usuarioId === undefined`). Ambos os ids sao tipados como string.
     * @param ownerUserId  Usuario.id dono do recurso (ex.: pet.tutor.usuarioId).
     * @param currentUserId  req.user.userId (NUNCA req.user.usuarioId, que e undefined).
     */
    export function assert403Owner(
      ownerUserId: string,
      currentUserId: string,
      key: ErrorKey = 'OWNERSHIP_FORBIDDEN',
    ): void {
      if (ownerUserId !== currentUserId) {
        throw new LocalizedException(key, HttpStatus.FORBIDDEN);
      }
    }
    // uso: assert403Owner(pet.tutor.usuarioId, req.user.userId);
    ```
    A assinatura tipada (`string`, `string`) faz o TypeScript reclamar se o caller passar `req.user.usuarioId` (tipo `undefined`/inexistente no shape de `req.user`), empurrando o erro para compile-time em vez de virar 403-falso-positivo silencioso. **AC36a** cobre: mesmo id → nao lanca; ids diferentes → 403 com a key. `assert403Owner` e o helper **preferido** para os 403 ad-hoc de ownership fora do `OwnershipService` (ex.: "esse `MembroFamilia` e do tutor logado?"); `assert403(boolean)` so para o resto.
    - **Onde aplicar:** Parte 1 (rotas tutor = 403 ownership via `OwnershipService`/`assert403`; rotas prestador publicas = 404 via `resolveAtivoOrThrow`). Parte 2 (rotas de familia autenticadas = 403; abrir convite por codigo/link = 404 via util). Parte 3/4 (rotas de parceiro autenticadas = 403). Documentado aqui para nao divergir entre partes.

22. **`RolesGuard` nega com 403 (`ROLE_FORBIDDEN`), nao 404.** Papel e checado em rota autenticada; 403 e o correto (a rota existe, o usuario so nao tem o papel). Nao confundir com o 404 de codigo publico (rota anonima). A unica excecao e o **401** de misconfig (Regra 6), que e erro de configuracao, nao de autorizacao.

### Trust proxy — D14

23. **Decisao (D14): habilitar `trustProxy` no `FastifyAdapter`** (`src/main.ts:30-33`), nesta fundacao, para que `req.ip` reflita o IP real do cliente atras do proxy do Railway. Sem isso, o rate-limit por IP das rotas publicas por codigo (Partes 1/2) fica global (todos os clientes no mesmo balde) — o que torna o limite de 10/min inutil contra brute-force por IP.
    - **Abordagem escolhida: `trustProxy: <n>` com numero de hops, lido de env, nao `true` cego e nao literal hardcoded (Furo 3 + Furo 9).** `new FastifyAdapter({ trustProxy: Number(process.env.TRUST_PROXY_HOPS ?? 1) })`.
    - **Semantica correta do `proxy-addr` (Furo 3):** quando `trustProxy` e um **numero `n`**, o Fastify (via `proxy-addr`) trata como **"os `n` proxies imediatamente a frente do servidor sao confiaveis"** — ou seja, conta **hops a partir do socket para fora** (do servidor em direcao ao cliente), e resolve `req.ip` "subindo" `n` posicoes confiaveis na cadeia `X-Forwarded-For` a partir do IP do socket. **Nao** e "os ultimos `n` da string XFF" como descrito antes (modelo mental invertido que induzia a erro de calibracao). O efeito pratico com 1 proxy real (`cliente -> railway-edge -> app`) e que `req.ip` vira o IP que o edge do Railway viu (o cliente), e um XFF injetado pelo cliente **a esquerda** e descartado por estar alem dos `n` hops confiaveis. **Confirmar o numero de hops exato do Railway antes de promover a producao** (Perguntas em Aberto #1; **bloqueante** no DoD): se houver CDN/load-balancer extra na frente, ajustar `TRUST_PROXY_HOPS`. Por isso o valor e **env, nao literal** — calibravel sem novo deploy de codigo.
    - **`trustProxy: true` e proibido:** confia em **qualquer** `X-Forwarded-For`, que e spoofavel pelo cliente (cliente injeta `X-Forwarded-For: 1.2.3.4` e o Fastify pega o IP forjado, furando o throttle por IP). `<n>` fixo descarta o que o cliente injeta alem dos hops confiaveis.
    - **Cross-spec: a Parte 1 NAO reabilita `trustProxy` (Achado 2 — resolve a contradicao Parte 0 vs Parte 1).** A habilitacao de `trustProxy` foi **puxada para esta fundacao** (era "validado na Parte 1" no epico D14; agora e "habilitado na Parte 0, `req.ip` real validado por smoke"). A Parte 1 (`01:632,651,716`, Task 0c) instrui `new FastifyAdapter({ trustProxy: true })` — isso e **incompativel** com esta decisao e, como ambas editam o **mesmo** `main.ts` e a Parte 0 entra primeiro, a Parte 1 sobrescreveria o fix seguro (`TRUST_PROXY_HOPS`) por um inseguro (`true`, spoofavel), reabrindo o furo. **Acao na Parte 1 (registrada em Perguntas em Aberto #10 e marcada no epico):** remover a habilitacao de `trustProxy` do escopo da Parte 1 (Task 0c, AC33 da Parte 1), substituir por "trustProxy ja entregue pela Parte 0 via `TRUST_PROXY_HOPS`; a Parte 1 so **valida** `req.ip` real no smoke"; **nunca** usar `trustProxy: true`. A Parte 1 mantem apenas o `limits.files` do multipart (esse e legitimo dela). O changelog da Parte 1 deve registrar a correcao para nao reintroduzir `true`.
    - **Por que `trustProxy` e nao `getTracker` custom:** `trustProxy: <n>` e a forma idiomatica do Fastify e corrige `req.ip` para **todo** consumidor de `req.ip` (throttler, futuras rotas), num so ponto (`main.ts`). Um `getTracker` custom saneando XFF resolveria so o throttler e duplicaria a logica de hops. **Plano B:** `getTracker` custom saneando o ultimo IP confiavel do XFF, se o numero de hops do Railway for instavel.
    - **Defesa em profundidade (inalterada):** mesmo com `req.ip` correto, as rotas de troca-de-codigo devem aplicar o balde secundario **por codigo** (Regra 14), porque um atacante com muitos IPs ainda distribui o brute-force por IP; o balde por codigo limita tentativas **por codigo alvo** independente de IP. **Esse balde por codigo NAO e entregue nesta parte** (Furo 11) — e da parte consumidora.
    - **Seguranca de habilitar agora:** nenhuma rota existente usa `req.ip` para logica de negocio (research: zero match de `req.ip` em `src/**`). O efeito e: o tracker default do throttler passa a ver o IP real. **NAO ha efeito nos logs** — o `logger.middleware.ts` loga `req.socket.remoteAddress`, nao `req.ip` (Furo 2). Zero impacto em contrato. Por isso entra na fundacao (e nao na Parte 1), deixando a Parte 1 nascer correta — desde que o numero de hops seja confirmado por smoke (bloqueante).

---

## Autorizacao / BOLA (por rota)

Esta parte **nao adiciona rota que recebe id de recurso**, portanto nao ha nova superficie BOLA direta. Ainda assim:

- **`RolesGuard` e autorizacao por papel, NAO por recurso.** Ele responde "esse usuario pode tentar essa classe de rota?", nunca "esse recurso e dele?". A checagem de propriedade continua sendo responsabilidade do `OwnershipService` (`src/auth/services/ownership.service.ts`) dentro do service, em cada parte que recebe id. **Documentar isso e mandatorio** para nao induzir as Partes 1-4 a achar que `@Roles` substitui ownership.
- **Politica 403 vs 404 (D14) e mandatoria nas Partes 1-4:** ownership autenticado = 403 (via `OwnershipService` ou `assert403`); lookup por codigo publico = 404 generico (via `resolveAtivoOrThrow`). Ver Regra 21. O teste de "tutor errado" (abaixo) verifica o 403; o teste de "codigo invalido/inexistente" verifica o 404 indistinguivel.
- **`assert403` tem semantica testada (Furo 6):** argumento e "tem acesso" (true libera, false lanca 403). AC36 cobre. Evita uso invertido que abriria BOLA.
- **`assert403Owner` fecha o predicado degenerado (Achado 5):** para ownership ad-hoc fora do `OwnershipService`, usar `assert403Owner(ownerUserId, currentUserId)` (compara internamente, tipado `string`/`string`) em vez de `assert403(boolean)`. Isso bloqueia o bug `req.user.usuarioId === undefined → assert403(true) → libera tudo` em compile-time (o JWT so tem `req.user.userId`). `security-auditor` audita cada callsite de `assert403`/`assert403Owner` nas Partes 1-4. AC36a cobre.
- **Staleness do claim de papel (Achado 4):** `@Roles(TUTOR)` reflete o JWT, nao o `Tutor.ativo` vivo. Para acoes sensiveis a inativacao (criar compartilhamento, gerir familia), a parte consumidora **revalida `Tutor.ativo` no service**; o guard de papel nao basta. Ver Regra 2a.
- **`OwnershipService` tem sua mensagem migrada (nao a logica).** A evolucao do `OwnershipService` para honrar Familia e D4 (Parte 2). O util de codigo publico do prestador **nao** passa pelo `OwnershipService` (D4: prestador e snapshot + codigo publico, fluxo separado). A unica mudanca no `OwnershipService` nesta parte e trocar a **string** do throw por uma **chave** de catalogo (`OWNERSHIP_FORBIDDEN`), sem mudar status (403) nem logica (AC31 obrigatorio).
- **Rotas publicas por codigo (Partes 1/2)** nao tem `tutorId` no contexto; a autorizacao delas e "possuir o codigo valido + estar dentro do rate-limit". O util garante o erro generico (404) para nao vazar existencia — aqui o 404 e o **proprio** sinal generico. O `trustProxy` (D14) garante que o rate-limit por IP dessas rotas funcione **uma vez confirmado o numero de hops**; o balde por codigo (defesa contra brute-force distribuido) e responsabilidade da parte consumidora (Furo 11).
- **Teste de "papel errado" obrigatorio:** para cada papel suportado pelo `RolesGuard`, o spec de teste cobre o caso de usuario sem o papel exigido recebendo 403 (analogo ao "tutor errado" do checklist de BOLA do projeto).

---

## Riscos e Mitigacoes

| Nivel | Risco | Mitigacao |
|---|---|---|
| Alto | `RolesGuard` aplicado por engano em rota existente, mudando comportamento (quebra "zero alteracao"). | Parte 0 **nao** decora nenhuma rota existente. Prova de zero-regressao (AC11): **`git diff --stat` em `src/**/*.controller.ts` = vazio** + **grep `RolesGuard` em `src/**/*.controller.ts` = 0**. `npm run audit:endpoints` roda como check secundario (garante que nenhuma rota publica foi exposta), **mas nao detecta `RolesGuard`** — por isso nao serve sozinho de prova. |
| Alto | `OptionalJwtAuthGuard` antes do `RolesGuard` faz anonimo legitimo tomar 401 falso (ou pior, depender de `req.user` null). | **Furo 1:** `RolesGuard` exige `JwtAuthGuard` (que lanca 401 no anonimo) antes; `OptionalJwtAuthGuard` e **proibido** no pareamento. Check de pareamento (Task 23) falha se `RolesGuard` aparecer sem `JwtAuthGuard` imediatamente antes. "Auth opcional + papel" nao e suportado nesta parte (Perguntas em Aberto). AC37 cobre. |
| Alto | `trustProxy` com hops errados deixa `req.ip` spoofavel (cliente injeta XFF) e fura o throttle por IP — agravado se mergeado antes de confirmar o numero real do Railway. **NAO e inerte:** afeta o `ThrottlerGuard` global ja ativo (`public-pet` 30/min e qualquer rota throttlada de hoje), nao so as futuras (Achado 8). | **Furo 3 + Furo 9 + Achado 8:** usar `trustProxy: <n>` lido de `TRUST_PROXY_HOPS` (default 1), **nao** `true` e **nao** literal. **Confirmar o numero de hops do Railway por smoke e BLOQUEANTE ANTES do merge em `master`** (nao "pos-deploy recomendado") — porque um hop errado torna o XFF spoofavel para rotas **existentes** e um atacante zera o throttle do `public-pet` ja vivo. Plano B: `getTracker` custom saneando o ultimo IP confiavel do XFF. Documentar quais rotas EXISTENTES mudam de comportamento de throttle (**todas** as throttladas, nao so as novas). Semantica do `proxy-addr` documentada (hops a partir do socket). AC33-AC35 a validar por bootstrap + smoke. |
| Alto | Race de unicidade do codigo (TOCTOU): `isTaken` false em 2 requests concorrentes -> 2 INSERT do mesmo codigo -> dois codigos identicos vivos (Achado 3). | **Regra 11a/12a:** `isTaken` (`status=ATIVO AND expiraEm > now`) **nao** garante unicidade sozinho. Obrigatorio nas Partes 1/2: **UNIQUE parcial** (`status=ATIVO`) na coluna de codigo + fluxo `gerar -> INSERT -> em P2002 regerar` via `gerarComInsert`. AC13a/AC13b cobrem (predicado completo + colisao P2002 regera). |
| Alto | Brute-force do codigo de 6 digitos (espaco pequeno, 10^6) **nao** totalmente mitigado nesta parte; agravado pelo throttler **in-memory** (nao cross-instancia no Railway, D15). | **Furo 11 + D15 (Regra 14/14a):** Parte 0 entrega **so** a constante de defesa por IP (`PUBLIC_CODE_THROTTLE` 10/min/IP, confiavel com `trustProxy`) + erro generico 404 + RNG cripto. O storage atual e **in-memory** (`app.module.ts:47`, sem Redis): com >1 instancia o limite efetivo multiplica por instancia. **A defesa real (anti-brute-force distribuido e cross-instancia) NAO e entregue aqui** — e do DoD da parte consumidora, via **Redis no throttler OU lockout por codigo persistido** (Regra 14a) + balde secundario chaveado pelo codigo. Registrado em Perguntas em Aberto #2. Cada parte que consome **deve** entregar (A) ou (B) no seu DoD. |
| Medio | Catalogo i18n de erro quebra respostas existentes (regressao de copy). | Regra 19: o filtro so resolve via catalogo (e remove `errorKey`) quando a excecao carrega `errorKey`. Todos os `throw new XException('string')` atuais passam **intactos**. pt-BR do catalogo = string literal atual, incl. `OWNERSHIP_FORBIDDEN` **sem ponto** = `'Acesso negado a este recurso'` (AC28). AC32: request sem `Accept-Language` recebe pt-BR identico ao de hoje. |
| Medio | `errorKey` vaza no JSON de resposta (spread `...error` do filtro inclui o campo interno). | **Furo 10:** o passo do filtro **remove `errorKey`** antes do spread. AC27a verifica que o payload de `LocalizedException` **nao** contem `errorKey`. |
| Medio | `localeFromRequest` quebra no caminho de erro quando `req.query` e undefined. | **Furo 7:** helper replica as guardas null-safe do `locale.decorator.ts` (`query?.lang`, `typeof check`, `req.headers?.['accept-language']`) e `normalizeLocale` ja tolera undefined. AC38: request sem query/headers → `DEFAULT_LOCALE`, filtro nao quebra. |
| Medio | Afirmar que `trustProxy` melhora o IP nos logs (falso). | **Furo 2:** removida a afirmacao das 3 secoes. Documentado que `logger.middleware.ts` loga `req.socket.remoteAddress` (raw request, sem `.ip`), portanto `trustProxy` **nao** afeta os logs. IP real nos logs registrado em Perguntas em Aberto como mudanca separada. |
| Medio | D14 "respostas passam pelo catalogo" cumprido so para fracao minuscula (feature nao verificavel end-to-end). | **Furo 4:** migracao do `OwnershipService` virou **obrigatoria** (AC31), garantindo ao menos uma rota viva exercitando o catalogo com `Accept-Language` real (smoke/integration). D14 documentado como cumprido **incrementalmente**. |
| Medio | `en-GB` caindo em en-US por fallback implicito (viola regra do Nicolas). | Regra 16: toda chave declara `'en-GB'` literal. **Completude de locale forcada pelo COMPILADOR** (tipo `Record<ErrorKey, Record<Locale, string>>`). Nunca via `LOCALE_FALLBACK`. AC30 cobre o residual (en-dash, nao-vazio). |
| Medio | AC30 super-vendido como rede de futuro sem gancho de CI. | **Furo 8:** reconhecido que o **tipo** ja garante completude de locale em compile-time. AC30 vira teste de en-dash + nao-vazio. O grep de en-dash e o test de completude/nao-vazio entram no **pipeline (lint/CI)**, nao so como spec unit, para enforcement automatico nas Partes 1-4. |
| Medio | `assert403` usado invertido (libera quando devia negar) → BOLA. | **Furo 6:** assinatura e semantica explicitas (`temAcesso: boolean`, true libera) + AC36 dedicado (happy + falha). Sem o AC, o helper nao entraria nesta parte. |
| Medio | `assert403` alimentado com predicado degenerado (ex.: `req.user.usuarioId === undefined` → `assert403(true)` → libera tudo) → BOLA (Achado 5). | **Regra 21/21a:** booleano DEVE comparar valores nao-`undefined` (usar `req.user.userId`, **nunca** `req.user.usuarioId`); variante tipada `assert403Owner(ownerUserId, currentUserId)` que compara internamente e falha em compile-time se receber `usuarioId`. `security-auditor` audita cada callsite nas Partes 1-4. AC36a cobre. |
| Medio | `@Roles(TUTOR)` autoriza tutor ja inativo (ou nega ja reativado) na janela entre inativar/reativar e o refresh do token — claim stale (Achado 4). | **Regra 2a:** `@Roles` reflete o estado do JWT, nao o `Tutor.ativo` vivo. Janela aceita como design (TTL curto + refresh apos inativar/reativar); acoes sensiveis a inativacao (Partes 1/2) **revalidam `Tutor.ativo` no service**. Decisao "guard consulta estado vivo" em aberto #11. |
| Medio | `@Throttle({ default })` **soma/coexiste** com o `default` global (60) em vez de **substituir** por 10/min — assumido por leitura, nao provado (Achado 6). | **Regra 14:** teste runtime via `app.inject` (AC22a) numa rota fixture: 11a request/min/IP → 429, ate 10 passam, confirmando 10 substitui 60. Se o throttler 6.5.0 nao substituir por nome, ajustar nesta parte antes de a Parte 1 depender. |
| Medio | Parte 2 consome assinatura divergente do util (`gerar({usuarioId,tipo,ttlMs})` / `resolver(...)|null`) que NAO pluga no contrato da Parte 0 (Achado 1). | **Regra 13a + contrato congelado:** assinatura unica autoritativa na Parte 0 (`gerar(isTaken)`/`gerarComInsert`, `resolveAtivoOrThrow` lanca 404). A reconciliacao e na Parte 2 (reescrever a secao "Helper de codigo publico"; `expiraEm`/`ttl`/`usuarioId` viram do service de Familia). Aberto #10. |
| Medio | Documentar erro com envelope `{statusCode,message,data}` quando o filtro real nao emite `data`. | Tabelas de erro desta spec usam a **forma real** do `HttpExceptionFilter` (`{ statusCode, timestamp, path, message, error }`, sem `data`, sem `errorKey`). Verificado em `http-exception.filter.ts:6-26`. |
| Medio | AC15 (RNG cripto) nao-testavel com `import { randomInt }` (binding congelado, spy falha). | RNG **injetavel** via provider `RandomCodeGenerator` (token DI). O teste injeta um fake deterministico; um teste dedicado verifica que a impl real chama `crypto.randomInt` via `import * as crypto`. Ver Estrategia de Testes / AC15. |
| Medio | Ordem `@Roles(TUTOR, PARCEIRO)` ambigua / chama resolver a toa. | Regra 9: sincronos sempre avaliados primeiro; resolver so se `PARCEIRO` exigido e nenhum sincrono casou. AC24 fixa o comportamento. |
| Medio | `PARCEIRO` resolver no-op esquecido em `false` apos a Parte 3 (parceiro nunca autoriza). | Resolver e interface injetavel com token DI; a Parte 3 **substitui o provider** e adiciona teste de integracao "parceiro com membership ativo recebe papel PARCEIRO". DoD da Parte 3 referencia isso. |
| Medio | Colisao de codigo sob alta densidade trava geracao. | `MAX_TENTATIVAS = 5` + 503 explicito com log WARN. Unicidade so entre vivos reduz densidade. |
| Baixo | Admin esperando bypass implicito no `RolesGuard` e levando 403. | Regra 4 explicita + contraste documentado com o bypass de recurso do `OwnershipService`. Rotas admin listam `SYSTEM_ADMIN` no `@Roles`. |
| Baixo | Tutor inativo barrado por `@Roles(TUTOR)` sem caminho de volta. | Regra 2: `@Roles(TUTOR)` = tutor ativo, por design. Rota de **reativacao** `POST /users/me/reactivate` (`inactivation.controller.ts:54-64`) **nao** pode ser protegida por `@Roles(TUTOR)`. Documentado para as partes que decorarem rotas de tutor. |
| Baixo | Ambiguidade de "editar common.module.ts" gera dupla provisao do `PublicCodeService`. | Ponto de import unico: `PublicCodeModule` exporta o `PublicCodeService`; Partes 1/2 importam `PublicCodeModule` direto. `common.module.ts` **nao** e tocado. O catalogo de erro e funcao pura (sem DI), importavel direto; o filtro o usa sem modulo. |
| Baixo | Confusao 403 vs 404 entre partes (uma parte usa 404 pra ownership autenticado). | Regra 21 documenta a politica e onde aplicar; `assert403` (com semantica testada) padroniza o 403 fora do `OwnershipService`; `resolveAtivoOrThrow` centraliza o 404 de codigo publico. |

---

## Requisitos Nao-Funcionais (aplicaveis)

- **Performance:** `RolesGuard` decide sem query quando algum papel sincrono exigido casa (admin/tutor/vet) — Regra 9. Query so quando `PARCEIRO` exigido e nenhum sincrono casou (e na Parte 0 nem isso: resolver no-op). `PublicCodeService.gerar` faz no maximo `MAX_TENTATIVAS` chamadas a `isTaken` (callback indexado pela coluna de codigo, unica entre vivos). O catalogo de erro e lookup O(1) em objeto estatico (sem I/O). `localeFromRequest` e parse O(1) do header. `trustProxy` nao adiciona custo mensuravel (Fastify ja parseia XFF).
- **Seguranca:** RNG cripto injetavel; unicidade de codigo respaldada por UNIQUE parcial + retry em `P2002` (TOCTOU fechado — Achado 3); rate-limit por IP **confiavel** apos confirmar hops (`trustProxy` via env) — lembrando que o `trustProxy` afeta o `ThrottlerGuard` global **ja ativo**, nao so as rotas futuras (Achado 8); **defesa por codigo + cross-instancia (Redis ou lockout por codigo, D15) delegada a parte consumidora (nao entregue nesta parte)**; erro generico sem leak; `errorKey` removido do payload (sem vazar identificador interno); 403 vs 404 por politica anti-enumeracao (D14); `assert403Owner` tipado para fechar o predicado degenerado de BOLA (Achado 5); `@Roles` reflete o claim (staleness aceita; revalidacao viva no service para acoes sensiveis — Achado 4); sem PII em log (logs do guard/util usam `userId`/`resource`, nunca email/cpf — consistente com `OwnershipService` que so loga `user=<id>`). O catalogo de erro nao introduz PII (so copy estatica).
- **i18n:** mensagens de erro novas + a migrada do `OwnershipService` passam pelo catalogo (pt-BR/en-US/en-GB/es-419, en-GB explicito), resolvidas pelo locale da request (`Accept-Language`/`?lang=` via `localeFromRequest`). Cobre a regra `i18n-en-gb-obrigatorio` (en-GB nunca via fallback; completude forcada pelo tipo).
- **Observabilidade:** WARN em negacao de papel, em 401 por misconfig, e em estouro de tentativas de geracao (ver secao Observabilidade). **Os logs NAO passam a registrar o IP real** com `trustProxy` (Furo 2: o middleware le `socket.remoteAddress`).
- **Compatibilidade:** zero breaking. `@nestjs/throttler` ja instalado; nenhuma dependencia nova. Sem migration. Mensagens pt-BR identicas as de hoje quando o cliente nao pede outro locale (incl. ownership: `'Acesso negado a este recurso'` sem ponto).
- **Testabilidade:** guard, util, catalogo, `localeFromRequest` e `assert403` sao unidades puras testaveis com mock leve (sem DB). O passo do filtro e testavel com um `ArgumentsHost` mock + `LocalizedException`. A migracao do ownership permite um teste de integracao real exercitando o catalogo end-to-end.

---

## Acceptance Criteria

### `@Roles` + `RolesGuard`

- **AC1 (admin):** Dado `req.user.isSystemAdmin=true`, Quando rota tem `@Roles(AppRole.SYSTEM_ADMIN)`, Entao `RolesGuard.canActivate` resolve `true`.
- **AC2 (tutor ativo):** Dado `req.user.tutorId='t1'` e `tutorActive=true`, Quando rota tem `@Roles(AppRole.TUTOR)`, Entao autoriza (`true`).
- **AC3 (tutor inativo):** Dado `req.user.tutorId='t1'` e `tutorActive=false`, Quando rota tem `@Roles(AppRole.TUTOR)`, Entao nega com `LocalizedException` chave `ROLE_FORBIDDEN` (403, `message` pt-BR `'Acesso restrito ao papel necessario.'`). Observacao de design: o tutor inativo segue **autenticado**; o caminho de reativacao usa a rota dedicada `POST /users/me/reactivate` nao protegida por `@Roles(TUTOR)` (Regra 2).
- **AC4 (vet):** Dado `req.user.veterinarioId='v1'`, Quando rota tem `@Roles(AppRole.VETERINARIO)`, Entao autoriza.
- **AC5 (OR):** Dado usuario so com `tutorId` (ativo), Quando rota tem `@Roles(AppRole.TUTOR, AppRole.VETERINARIO)`, Entao autoriza (basta um papel).
- **AC6 (admin nao e superuser):** Dado `isSystemAdmin=true` e `tutorId=null`, Quando rota tem `@Roles(AppRole.PARCEIRO)` (sem `SYSTEM_ADMIN` na lista), Entao **nega** 403.
- **AC7 (parceiro no-op):** Dado qualquer `req.user`, Quando rota tem `@Roles(AppRole.PARCEIRO)` e o resolver e a impl no-op da Parte 0, Entao **nega** 403 (nenhum usuario e parceiro nesta parte). `ParceiroRoleResolver.isParceiro` foi chamado.
- **AC8 (req.user ausente = misconfig):** Dado `request.user` ausente/undefined, Quando `RolesGuard` roda, Entao lanca `LocalizedException` chave `AUTH_REQUIRED` (401, `message` pt-BR `'Autenticacao necessaria.'`) e loga WARN `reason=missing_user`.
- **AC9 (sem metadata):** Dado rota com `RolesGuard` mas **sem** `@Roles`, e `req.user` presente, Entao autoriza (`true`) sem checar papel.
- **AC10 (async):** `canActivate` retorna `Promise<boolean>` (assinatura async confirmada por tipo).
- **AC11 (zero regressao):** `git diff --stat` sobre `src/**/*.controller.ts` apos a parte e **vazio** (nenhum controller existente alterado), **e** grep `RolesGuard` em `src/**/*.controller.ts` retorna 0. `npm run audit:endpoints` passa como check secundario (nenhuma rota publica exposta).
- **AC24 (curto-circuito sincrono):** Dado `req.user` com `tutorId` ativo, Quando rota tem `@Roles(AppRole.TUTOR, AppRole.PARCEIRO)`, Entao autoriza (`true`) **sem** invocar `ParceiroRoleResolver.isParceiro` (spy confirma 0 chamadas). Inverso: dado usuario sem papel sincrono casando e rota com `PARCEIRO` exigido, o resolver **e** chamado.
- **AC37 (OptionalJwtAuthGuard nao satisfaz o pareamento — Furo 1):** O check de pareamento de guards (Task 23) **falha** se um controller aplicar `RolesGuard` precedido por `OptionalJwtAuthGuard` (ou por nenhum guard de auth) em vez de `JwtAuthGuard`. Verificavel por um caso de teste do proprio check (fixture com `@UseGuards(OptionalJwtAuthGuard, RolesGuard)` → check reporta falha; fixture com `@UseGuards(JwtAuthGuard, RolesGuard)` → check passa). Nesta parte nenhum controller real usa `RolesGuard`, entao o check passa vacuamente no repo; o teste exercita o check com fixtures.

### Util de codigo publico

- **AC12 (formato):** `PublicCodeService.gerar(isTaken)` com `isTaken=async()=>false` retorna string que casa `^\d{6}$` (inclui caso com zero a esquerda forcando o RNG injetado a retornar `7` → `'000007'`).
- **AC13 (unicidade entre vivos):** Dado `isTaken` que retorna `true` na 1a e 2a chamada e `false` na 3a, Quando `gerar`, Entao retorna o 3o codigo e chamou `isTaken` 3 vezes.
- **AC13a (predicado de `isTaken` inclui `expiraEm > now` — Achado 7):** O helper `isTakenFactory(findAtivoVivo)` produz um `isTaken` que retorna `false` para um registro `status=ATIVO` cujo `expiraEm <= now` (ou seja, um codigo de registro ativo-mas-vencido **nao** bloqueia reuso). Verifica que a comparacao temporal e embutida pelo util, nao confiada ao caller. (Para `gerar(isTaken)` cru: o DoD das Partes 1/2 audita que o predicado inclui `expiraEm > now`.)
- **AC13b (colisao de INSERT regera — Achado 3):** Dado `gerarComInsert(tentarInserir)` onde `tentarInserir` lanca `P2002` (unique violation) na 1a tentativa e resolve na 2a, Quando `gerarComInsert`, Entao regenera o codigo, tenta o INSERT de novo e retorna o resultado da 2a tentativa (2 chamadas a `tentarInserir`, codigos distintos). Dado `tentarInserir` que lanca `P2002` em todas as `MAX_TENTATIVAS`, Entao lanca `LocalizedException('PUBLIC_CODE_GEN_EXHAUSTED', 503)`. Erros nao-`P2002` do `tentarInserir` **sobem** sem regerar (nao sao colisao).
- **AC14 (estouro):** Dado `isTaken` sempre `true`, Quando `gerar`, Entao apos 5 tentativas lanca `LocalizedException` chave `PUBLIC_CODE_GEN_EXHAUSTED` (503) e nao retorna codigo.
- **AC15 (RNG cripto):** O `RandomCodeGenerator` real chama `crypto.randomInt` (verificado por `jest.spyOn(crypto, 'randomInt')` com `import * as crypto from 'node:crypto'`), nao `Math.random`. O `PublicCodeService` consome o RNG **via injecao** (token DI), permitindo um fake deterministico nos demais testes.
- **AC16 (validacao OK):** Dado `findByCodigo` retorna registro com `status` vivo e `expiraEm` no futuro, Quando `resolveAtivoOrThrow('123456', findByCodigo)`, Entao retorna o registro.
- **AC17 (expirado):** Dado registro com `expiraEm <= now`, Entao lanca `LocalizedException` chave `PUBLIC_CODE_INVALID` (404, `message` pt-BR `'Codigo invalido ou expirado.'`).
- **AC18 (revogado):** Dado registro com status revogado, Entao lanca o **mesmo** 404 generico (chave `PUBLIC_CODE_INVALID`, mensagem identica ao AC17, indistinguivel).
- **AC19 (inexistente):** Dado `findByCodigo` retorna `null`, Entao lanca o mesmo 404 generico (`PUBLIC_CODE_INVALID`).
- **AC20 (formato invalido):** Dado input `'12-34-56'` ou `'abc'` ou `'12345'`, Entao normaliza/valida e lanca o **mesmo** 404 generico (`PUBLIC_CODE_INVALID`, nao 400). `findByCodigo` **nao** e chamado para input que falha o regex (curto-circuito antes do loader).
- **AC21 (normalizacao):** Dado input `' 123456 '` (espacos) ou `'123-456'`, Entao normaliza para `'123456'` e segue o fluxo de validacao.
- **AC22 (constante de throttle):** `PUBLIC_CODE_THROTTLE` exportado como `{ default: { limit: 10, ttl: 60_000 } }` (valor verificavel por igualdade estrutural).
- **AC22a (substituicao efetiva do balde — runtime, Achado 6):** Montando a app Nest com o `ThrottlerGuard` global (60/min) **e** uma rota fixture decorada com `@Throttle(PUBLIC_CODE_THROTTLE)`, Quando se injeta (via `app.inject`) 11 requests/min do mesmo IP, Entao as **10 primeiras** retornam 2xx/4xx-de-negocio e a **11a** retorna **429**, provando que o balde de 10 **substitui** o de 60 (e nao soma para 70 nem permanece 60). Se o `@nestjs/throttler` 6.5.0 nao substituir por nome `default`, ajustar a config nesta parte (mesmo nome ou desabilitar o `default` global na rota) ate o teste passar.
- **AC23 (sem em-dash):** Nenhuma string de mensagem do guard, do util ou do catalogo de erro contem o caractere em-dash. Checklist binario: grep `—` nos arquivos novos (incluindo `error-catalog.ts`) retorna 0; rodado tambem no CI (Furo 8).

### Catalogo i18n de erro (D14)

- **AC25 (resolucao por locale):** `resolveErrorMessage('ROLE_FORBIDDEN', 'en-GB')` → `'Access restricted to the required role.'`; `'es-419'` → `'Acceso restringido al rol requerido.'`; `'pt-BR'` → `'Acesso restrito ao papel necessario.'`.
- **AC26 (fallback):** `resolveErrorMessage('ROLE_FORBIDDEN', <locale normalizado pra pt-BR>)` → copy pt-BR; chave inexistente (type-cast forcado) → a propria chave (nunca quebra).
- **AC27 (filtro resolve por Accept-Language):** Dado `LocalizedException('ROLE_FORBIDDEN', 403)` e request com `Accept-Language: en-GB`, Quando o `HttpExceptionFilter` formata, Entao o payload tem `message: 'Access restricted to the required role.'`, `statusCode: 403`, `error: 'Forbidden'`, **sem `data`**. Com `?lang=es-419`, a `message` e a espanhola.
- **AC27a (errorKey nao vaza — Furo 10):** O payload de qualquer resposta originada de `LocalizedException` **nao contem o campo `errorKey`** (o filtro o remove antes do spread). Verificado pela ausencia da chave `errorKey` no JSON serializado.
- **AC28 (pt-BR == copy atual):** A copy pt-BR de cada chave da fundacao e **identica** a string usada hoje/antes: `'Autenticacao necessaria.'`, `'Acesso restrito ao papel necessario.'`, `'Codigo invalido ou expirado.'`, `'Nao foi possivel gerar um codigo no momento. Tente novamente.'`, e `OWNERSHIP_FORBIDDEN` = `'Acesso negado a este recurso'` (**sem ponto final**, casando `ownership.service.ts:27`). Garante zero mudanca de copy em pt-BR.
- **AC29 (excecao sem chave passa intacta):** Dado `throw new ForbiddenException('mensagem fixa')` (sem `errorKey`), Quando o filtro formata, Entao a `message` permanece `'mensagem fixa'` e nenhum `errorKey` e adicionado. Comportamento atual preservado.
- **AC30 (en-dash + nao-vazio; completude de locale e compile-time — Furo 8):** O **tipo** `Record<ErrorKey, Record<Locale, string>>` ja garante completude de locale (chave faltando locale = erro de compilacao). O test de AC30 cobre o residual: varre `ERROR_CATALOG` e falha se qualquer string for vazia **ou** contiver em-dash. Roda no **CI/lint** (nao so como unit isolado) para servir de rede nas Partes 1-4. Checklist binario.
- **AC31 (ownership migrado — OBRIGATORIO, Furo 4):** O `OwnershipService.deny` migra para `LocalizedException('OWNERSHIP_FORBIDDEN', HttpStatus.FORBIDDEN)`. Com locale pt-BR a resposta e identica a de hoje (`403`, `message: 'Acesso negado a este recurso'`, sem ponto); com `en-GB` retorna `'Access to this resource is denied'`. **Validavel por integration/smoke real** numa rota que dispara 403 de ownership (exercicio end-to-end do catalogo). **Nao** opcional nesta parte.
- **AC32 (sem Accept-Language == pt-BR):** Dado uma request **sem** `Accept-Language` e **sem** `?lang=` para uma `LocalizedException`, Entao a `message` resolvida e a pt-BR (default), identica ao comportamento de hoje.
- **AC38 (localeFromRequest null-safe — Furo 7):** Dado uma request com `req.query === undefined` e/ou sem header `accept-language`, Entao `localeFromRequest(req)` retorna `DEFAULT_LOCALE` **sem lancar**, e o `HttpExceptionFilter` formata a resposta normalmente (nao quebra no caminho de erro).

### Politica 403 (D14)

- **AC36 (assert403 — Furo 6):** `assert403(true)` **nao** lanca (retorna void). `assert403(false)` lanca `LocalizedException` (403) com a key default `OWNERSHIP_FORBIDDEN`; `assert403(false, 'ROLE_FORBIDDEN')` lanca 403 com key `ROLE_FORBIDDEN`. (Happy + falha + key custom.)
- **AC36a (assert403Owner — Achado 5):** `assert403Owner('u1', 'u1')` **nao** lanca (mesmo dono). `assert403Owner('u1', 'u2')` lanca `LocalizedException` (403, key default `OWNERSHIP_FORBIDDEN`); com key custom lanca 403 com a key dada. **Type-level:** confirmar (por compilacao ou comentario de teste) que passar `req.user.usuarioId` (campo inexistente/`undefined` no shape do JWT) e erro de tipo, nao 403-falso-positivo silencioso.

### Trust proxy (D14) — a VALIDAR por bootstrap + smoke, nao "fato" (Furo 3)

- **AC33 (trustProxy habilitado via env):** `src/main.ts` instancia `new FastifyAdapter({ trustProxy: Number(process.env.TRUST_PROXY_HOPS ?? 1) })` (numero de hops lido de env, default 1). Verificavel por leitura do `main.ts` e por teste de bootstrap. Antes desta parte `main.ts:30-33` instanciava `new FastifyAdapter()` sem opcoes.
- **AC34 (req.ip = cliente atras de N hops — a validar):** Montando a app com `TRUST_PROXY_HOPS=1` e injetando request com `X-Forwarded-For: <ip-cliente>` via 1 hop, espera-se `req.ip === '<ip-cliente>'`. **Marcado como "a validar por teste de bootstrap (app.inject) + smoke pos-deploy"**, nao como comportamento provado contra o Railway; o numero real de hops esta em Perguntas em Aberto #1.
- **AC35 (XFF spoofado descartado — a validar):** Com `TRUST_PROXY_HOPS=1` e `X-Forwarded-For: 1.2.3.4, <ip-cliente-real>`, espera-se `req.ip === '<ip-cliente-real>'` (o injetado `1.2.3.4`, alem do hop confiavel, e descartado pela semantica do `proxy-addr`). **A validar por bootstrap + smoke**; o valor final de `TRUST_PROXY_HOPS` depende da topologia confirmada do Railway.

---

## Estrategia de Testes

### Unit (`*.spec.ts`, rodam em `npm test`)
- `src/auth/guards/roles.guard.spec.ts`: cobre AC1-AC10 e AC24. Monta `ExecutionContext` mock com `getHandler/getClass` e `Reflector` mockado; `switchToHttp().getRequest()` retornando `{ user }` controlado. `ParceiroRoleResolver` mockado (no-op `false`; em um teste `true`; em AC24 spy confirmando **zero** chamadas quando um sincrono casa). Asserta a **chave** da `LocalizedException` (`ROLE_FORBIDDEN`/`AUTH_REQUIRED`) e o status. Nomes em pt presente do indicativo ("autoriza admin", "nega tutor inativo", "lanca 401 sem user", "nao chama resolver quando tutor casa").
- `src/auth/decorators/roles.decorator.spec.ts` (leve): confirma que `@Roles(A,B)` grava metadata `ROLES_KEY` com `[A,B]`.
- `src/common/public-code/public-code.service.spec.ts`: cobre AC12-AC22 **+ AC13a (predicado via `isTakenFactory` ignora registro ATIVO vencido) + AC13b (`gerarComInsert` regera em `P2002`, esgota em 503, propaga erro nao-`P2002`)**. Injeta um `RandomCodeGenerator` fake deterministico (inclui `7` → `'000007'`). Mock dos callbacks `isTaken`/`findByCodigo`/`tentarInserir`. Asserta **chave** + status.
- `src/common/public-code/random-code-generator.spec.ts`: cobre AC15. `jest.spyOn(crypto, 'randomInt')` com `import * as crypto from 'node:crypto'`; confirma `crypto.randomInt(0, 1_000_000)` e nunca `Math.random`.
- `src/common/errors/error-catalog.spec.ts`: cobre AC25, AC26, AC28, AC30, AC23. `resolveErrorMessage` por locale; fallback; pt-BR == copy atual (igualdade literal, incl. ownership sem ponto); test de en-dash + nao-vazio varrendo `ERROR_CATALOG`.
- `src/common/errors/localized-exception.spec.ts`: cobre AC36 (`assert403` happy/falha/key custom), **AC36a (`assert403Owner`: mesmo id nao lanca, ids diferentes 403; nota type-level de que `req.user.usuarioId` e erro de tipo)** e o shape do `exceptionResponse` (carrega `errorKey`).
- `src/common/i18n/request-locale.spec.ts`: cobre AC38 (null-safe: `req.query` undefined, sem header → `DEFAULT_LOCALE`, nao lanca) + paridade com `@Locale()` (mesmos inputs, mesma saida).
- `src/common/filters/http-exception.filter.spec.ts`: cobre AC27, AC27a, AC29, AC32, AC38. Mock de `ArgumentsHost`/`FastifyRequest`/`FastifyReply`; lanca `LocalizedException` com `Accept-Language` variado e asserta `message` resolvida + payload **sem `data` e sem `errorKey`**; lanca `ForbiddenException('fixa')` (sem chave) e asserta `message` intacta; request sem `Accept-Language` → pt-BR; request com `query` undefined → nao quebra.

### Integration (`*.integration.spec.ts`, fora do `npm test` default, DB real)
- **Ownership migrado (AC31 — exercicio end-to-end do catalogo, Furo 4):** um integration test contra Postgres real que dispara um 403 de ownership (ex.: tutor A tentando recurso de tutor B) com `Accept-Language: en-GB` e asserta `message: 'Access to this resource is denied'`; com pt-BR (ou sem header) asserta `'Acesso negado a este recurso'`. Isso prova que o catalogo passa por uma rota viva (nao so unit com `ArgumentsHost` mock).
- Guard, util, catalogo, `localeFromRequest` e `assert403` nao tocam banco (callbacks/objetos estaticos) → seus testes ficam em `*.spec.ts`. A integracao real com `ParceiroEquipe` e validada na Parte 3.
- **`trustProxy` (AC33-AC35):** validavel sem DB montando a app Nest (ou Fastify minimo) com `trustProxy: Number(process.env.TRUST_PROXY_HOPS ?? 1)` e injetando request com `X-Forwarded-For` via `app.inject`. **Marcado como "a validar"** ate o smoke pos-deploy confirmar o numero de hops real do Railway.
- **Substituicao do balde de throttle (AC22a — runtime, Achado 6):** monta uma app Nest com o `ThrottlerGuard` global (60/min) e uma rota fixture com `@Throttle(PUBLIC_CODE_THROTTLE)` (10/min); via `app.inject` dispara 11 requests do mesmo IP num minuto e asserta que a 11a toma **429** (10 substitui 60). Sem DB. Se o throttler 6.5.0 nao substituir por nome `default`, o teste pega e a config e ajustada nesta parte. **Este teste e o que transforma "ts passou" em "comportamento provado".**

### Smoke (`scripts/`)
- **`scripts/test-trust-proxy-smoke.ts` (BLOQUEANTE no rollout — Furo 9):** confirma que `req.ip` no Railway reflete o cliente real com o `TRUST_PROXY_HOPS` configurado. **Roda contra o ambiente vivo antes de promover `develop`→`master` para producao.** Se o IP nao bater (numero de hops errado), o valor de `TRUST_PROXY_HOPS` e ajustado (env, sem novo deploy de codigo) ou ativa-se o plano B (`getTracker` custom).
- Fundacao sem rota HTTP propria nao exige smoke de dominio; as Partes 1-4 trazem seus smokes ao plugar util/guard/catalogo.

### Checklist antes do done
- [ ] `npm test` passa (novos specs verdes).
- [ ] `npm run lint` sem erro.
- [ ] `git diff --stat src/**/*.controller.ts` vazio **e** grep `RolesGuard` em controllers = 0 (AC11).
- [ ] `npm run audit:endpoints` passa (check secundario).
- [ ] grep `—` (em-dash) nos arquivos novos (incl. `error-catalog.ts`) = 0, **tambem no CI** (AC23).
- [ ] Test de en-dash + nao-vazio do catalogo verde no CI (AC30); completude de locale garantida pelo compilador.
- [ ] `main.ts` com `trustProxy` lido de `TRUST_PROXY_HOPS` (AC33) e teste de bootstrap de `req.ip` (AC34/AC35) verdes **com marca de "a validar por smoke"**.
- [ ] Ownership migrado (AC31) e integration test end-to-end do catalogo verde.
- [ ] AC37 (check de pareamento rejeita `OptionalJwtAuthGuard`) verde.

---

## Arquivos Impactados

| Arquivo | Acao | Descricao |
|---|---|---|
| `src/auth/roles.enum.ts` | criar | `enum AppRole { SYSTEM_ADMIN, TUTOR, VETERINARIO, PARCEIRO }` (enum TS, nao Prisma). |
| `src/auth/decorators/roles.decorator.ts` | criar | `export const ROLES_KEY = 'roles'; export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);` |
| `src/auth/guards/roles.guard.ts` | criar | `RolesGuard implements CanActivate` async. Le metadata via `Reflector`, deriva papel de `req.user`, avalia sincronos primeiro (Regra 9), consulta `ParceiroRoleResolver` so se `PARCEIRO` exigido e nenhum sincrono casou. Lanca `LocalizedException` (`AUTH_REQUIRED`/`ROLE_FORBIDDEN`), sem strings literais. JSDoc cobre: **exige `JwtAuthGuard` (nao `OptionalJwtAuthGuard`) antes**; admin nao e superuser; contraste com bypass do `OwnershipService`; `PARCEIRO` via resolver substituido na Parte 3. |
| `src/auth/services/parceiro-role.resolver.ts` | criar | Interface `ParceiroRoleResolver { isParceiro(userId: string): Promise<boolean> }` + token DI `PARCEIRO_ROLE_RESOLVER` + impl no-op `NoopParceiroRoleResolver` (retorna `false`). Substituida na Parte 3. |
| `src/auth/auth.module.ts` | editar | Registrar nos `providers`: `RolesGuard`, `{ provide: PARCEIRO_ROLE_RESOLVER, useClass: NoopParceiroRoleResolver }`. Exportar `RolesGuard` e `PARCEIRO_ROLE_RESOLVER` (modulo ja e `@Global`). |
| `src/common/public-code/random-code-generator.ts` | criar | Provider `RandomCodeGenerator` + token DI `RANDOM_CODE_GENERATOR`. Impl real `import * as crypto from 'node:crypto'`, `crypto.randomInt(0, 1_000_000)` + `padStart(6,'0')`. Injetavel. |
| `src/common/public-code/public-code.service.ts` | criar | `PublicCodeService` com `gerar(isTaken)`, **`gerarComInsert(tentarInserir)`** (captura `P2002` e regera dentro de `MAX_TENTATIVAS` — Achado 3), `resolveAtivoOrThrow(codigo, findByCodigo)` (lanca 404, nunca `null`) e `isTakenFactory(findAtivoVivo)` (embute `expiraEm > now` — Achado 7). Consome `RANDOM_CODE_GENERATOR`, retry, lanca `LocalizedException` (`PUBLIC_CODE_INVALID` 404, `PUBLIC_CODE_GEN_EXHAUSTED` 503). |
| `src/common/public-code/public-code.constants.ts` | criar | `PUBLIC_CODE_THROTTLE = { default: { limit: 10, ttl: 60_000 } }`, `MAX_TENTATIVAS = 5`, `CODE_REGEX = /^\d{6}$/`. (so defesa por IP — defesa por codigo **e cross-instancia/Redis-ou-lockout (D15)** sao da parte consumidora) |
| `src/common/public-code/public-code.module.ts` | criar | `@Module` provendo/exportando `PublicCodeService` e `RANDOM_CODE_GENERATOR`. **Ponto de import unico** para as Partes 1/2. |
| `src/common/errors/error-catalog.ts` | criar | **D14.** `ErrorKey` (union TS) + `ERROR_CATALOG: Record<ErrorKey, Record<Locale, string>>` (constante, en-GB explicito, sem em-dash; `OWNERSHIP_FORBIDDEN` pt-BR sem ponto) + `resolveErrorMessage(key, locale)`. Importa de `../i18n/locales`. |
| `src/common/errors/localized-exception.ts` | criar | **D14.** `LocalizedException extends HttpException` carregando `errorKey` + status; placeholder pt-BR. `assert403(temAcesso: boolean, key?: ErrorKey)` lancando 403 quando `!temAcesso` (semantica testada — Furo 6) **e `assert403Owner(ownerUserId: string, currentUserId: string, key?: ErrorKey)`** que compara internamente (fecha o predicado degenerado — Achado 5, AC36a). |
| `src/common/i18n/request-locale.ts` | criar | **D14.** `localeFromRequest(req): Locale` null-safe (replica guardas do `locale.decorator.ts:16-18`, nunca lanca — Furo 7). Reusado pelo filtro e pelo `@Locale()`. |
| `src/common/decorators/locale.decorator.ts` | editar | **D14 (DRY).** Delegar para `localeFromRequest` (mesma logica, um so ponto). |
| `src/common/filters/http-exception.filter.ts` | editar | **D14.** Se `exceptionResponse` carrega `errorKey`: resolver `resolveErrorMessage(errorKey, localeFromRequest(request))`, **remover `errorKey`** do objeto antes do spread (Furo 10), usar como `message`. Excecoes sem `errorKey` intactas. `error` (reason-phrase) nao traduzido. |
| `src/main.ts` | editar | **D14.** Trocar `new FastifyAdapter()` por `new FastifyAdapter({ trustProxy: Number(process.env.TRUST_PROXY_HOPS ?? 1) })` (numero de hops via env, default 1 — Furo 3/9). Pre-requisito do rate-limit por IP confiavel (Partes 1/2). |
| `src/auth/services/ownership.service.ts` | editar (**obrigatorio** — Furo 4) | **D14.** Trocar `ForbiddenException('Acesso negado a este recurso')` (`ownership.service.ts:27`) por `LocalizedException('OWNERSHIP_FORBIDDEN', HttpStatus.FORBIDDEN)` (status e copy pt-BR identicos — sem ponto; agora localizavel). AC31 obrigatorio (exercita o catalogo end-to-end). Nenhuma outra logica muda. |
| `.env` / `.env.example` | editar | **D14/D15.** Documentar `TRUST_PROXY_HOPS` (default 1; confirmar topologia do Railway) **e os dominios via env das filhas (D15):** `PRESTADOR_BASE_URL` (Parte 1), `FAMILIA_INVITE_BASE_URL` (Parte 2), `PARCEIRO_INDICACAO_BASE_URL` (Parte 3) — placeholders ate confirmar o dominio real. A Parte 0 nao constroi links, mas lista as envs para as filhas nao reinventarem o padrao. |
| `src/auth/guards/roles.guard.spec.ts` | criar | Unit do guard (AC1-AC10, AC24). |
| `src/auth/decorators/roles.decorator.spec.ts` | criar | Unit do decorator (metadata). |
| `src/common/public-code/public-code.service.spec.ts` | criar | Unit do util (AC12-AC22). |
| `src/common/public-code/random-code-generator.spec.ts` | criar | Unit do RNG real (AC15). |
| `src/common/errors/error-catalog.spec.ts` | criar | **D14.** Unit do catalogo (AC25, AC26, AC28, AC30, AC23). |
| `src/common/errors/localized-exception.spec.ts` | criar | **D14.** Unit de `assert403` (AC36) + shape do exceptionResponse. |
| `src/common/i18n/request-locale.spec.ts` | criar | **D14.** Unit de `localeFromRequest` null-safe (AC38). |
| `src/common/filters/http-exception.filter.spec.ts` | criar | **D14.** Unit do filtro com `LocalizedException` + locale (AC27, AC27a, AC29, AC32, AC38). |
| `scripts/test-trust-proxy-smoke.ts` | criar | **D14.** Smoke (bloqueante pre-prod) confirmando `req.ip` real no Railway com `TRUST_PROXY_HOPS`. |
| `docs/CHANGELOG.md` | editar | Registrar entry da Parte 0 (regra 7 do CLAUDE.md). |
| `docs/specs/epicos/acesso-compartilhamento-e-parcerias.md` | editar | Marcar Parte 0 de "em redacao" para spec linkada; **atualizar o resumo da Parte 0 (`epico:144-151`)** para listar tambem as entregas de D14/D15 que migraram para a fundacao (catalogo i18n de erro, `trustProxy` via `TRUST_PROXY_HOPS`, politica 403 vs 404, migracao do `OwnershipService`, contratos congelados do util + throttle cross-instancia); **corrigir D14 (`epico:124`)** de "Validado na Parte 1" para "Habilitado na Parte 0; `req.ip` real validado por smoke" (Achado 2, Achado 9). |
| `docs/specs/acesso-compartilhamento-e-parcerias/01-compartilhamento-prestador.md` | editar (cross-spec) | **Achado 2:** remover a habilitacao de `trustProxy` (Task 0c/AC33 da Parte 1, `01:632,651,716`); substituir por "trustProxy entregue pela Parte 0 via `TRUST_PROXY_HOPS`, a Parte 1 so valida `req.ip` no smoke"; **nunca** `trustProxy: true`; manter so o `limits.files` do multipart; registrar no changelog da Parte 1. (acao da Parte 1; listada aqui por ser pre-requisito desta fundacao) |
| `docs/specs/acesso-compartilhamento-e-parcerias/02-plano-familia.md` | editar (cross-spec) | **Achado 1:** reescrever a secao "Helper de codigo publico (D2)" (`02:39-53`) para casar o contrato congelado (`gerar(isTaken)`/`gerarComInsert`, `resolveAtivoOrThrow` lanca 404); `expiraEm`/`ttl`/`usuarioId`/`tipo` viram responsabilidade do service de Familia. (acao da Parte 2; listada aqui por ser o consumidor divergente) |

**Nenhum** arquivo de controller/rota existente e tocado. `prisma/schema.prisma` **nao** muda. `src/common/common.module.ts` **nao** e tocado (import unico via `PublicCodeModule`). `src/main.ts` muda **apenas** na opcao `trustProxy` (via env). `OwnershipService` muda **so a mensagem** (chave de catalogo), nao a logica. O `HttpExceptionFilter` muda de forma **aditiva** (so resolve via catalogo quando ha `errorKey`, removendo o `errorKey` do payload).

---

## Tasks Tecnicas (checklist ordenado)

1. [ ] Criar `src/auth/roles.enum.ts` com `AppRole`.
2. [ ] Criar `src/auth/decorators/roles.decorator.ts` (`ROLES_KEY` + `Roles`). Depende de (1).
3. [ ] Criar `src/auth/services/parceiro-role.resolver.ts` (interface + token DI + `NoopParceiroRoleResolver`).
4. [ ] Criar `src/common/errors/error-catalog.ts` (`ErrorKey`, `ERROR_CATALOG`, `resolveErrorMessage`) — D14. `OWNERSHIP_FORBIDDEN` pt-BR **sem ponto**. (depende so de `../i18n/locales`)
5. [ ] Criar `src/common/i18n/request-locale.ts` (`localeFromRequest` null-safe) — D14. Reaproveita `normalizeLocale`. (Furo 7)
6. [ ] Editar `src/common/decorators/locale.decorator.ts` para delegar a `localeFromRequest` (DRY). Depende de (5).
7. [ ] Criar `src/common/errors/localized-exception.ts` (`LocalizedException` + `assert403` com semantica testada + **`assert403Owner` tipado**, Achado 5) — D14. Depende de (4).
8. [ ] Criar `src/auth/guards/roles.guard.ts`. Depende de (1),(2),(3),(7). Async; injeta `Reflector` + `@Inject(PARCEIRO_ROLE_RESOLVER)`. Implementa Regras 2-6,8,9. Lanca `LocalizedException` (`AUTH_REQUIRED`/`ROLE_FORBIDDEN`). JSDoc exige `JwtAuthGuard` antes (nao Optional).
9. [ ] Editar `src/auth/auth.module.ts`: registrar/exportar `RolesGuard` e o resolver no-op. Depende de (3),(8).
10. [ ] Criar `src/common/public-code/public-code.constants.ts`. (sem deps)
11. [ ] Criar `src/common/public-code/random-code-generator.ts` (provider + token DI; `import * as crypto`). (sem deps)
12. [ ] Criar `src/common/public-code/public-code.service.ts`. Depende de (7),(10),(11). Implementa Regras 10-13a, incluindo **`gerarComInsert` (retry em `P2002`, Achado 3)** e **`isTakenFactory` (embute `expiraEm > now`, Achado 7)**. Lanca `LocalizedException`.
13. [ ] Criar `src/common/public-code/public-code.module.ts` (provide + export). Depende de (11),(12). Import unico (nao tocar `common.module.ts`).
14. [ ] Editar `src/common/filters/http-exception.filter.ts`: passo de resolucao via catalogo quando ha `errorKey`, **removendo `errorKey` do payload** (Furo 10), preservando excecoes sem chave (Regra 19). Depende de (4),(5),(7).
15. [ ] Editar `src/main.ts`: `new FastifyAdapter({ trustProxy: Number(process.env.TRUST_PROXY_HOPS ?? 1) })` + documentar `TRUST_PROXY_HOPS` em `.env.example` — D14/Regra 23 (Furo 3/9).
16. [ ] Editar `src/auth/services/ownership.service.ts`: `deny` via `LocalizedException('OWNERSHIP_FORBIDDEN', HttpStatus.FORBIDDEN)` (copy pt-BR identica, sem ponto). **Obrigatorio** (AC31 — Furo 4). Depende de (7).
17. [ ] Escrever `roles.guard.spec.ts` (AC1-AC10, AC24). Depende de (8).
18. [ ] Escrever `roles.decorator.spec.ts`. Depende de (2).
19. [ ] Escrever `public-code.service.spec.ts` (AC12-AC22, **AC13a/AC13b** — predicado completo + colisao `P2002` regera) e `random-code-generator.spec.ts` (AC15). Depende de (11),(12).
19a. [ ] Escrever teste runtime de substituicao do balde (**AC22a**, Achado 6): `app.inject` numa rota fixture com `@Throttle(PUBLIC_CODE_THROTTLE)` provando 11a request/min/IP → 429 (10 substitui 60). Ajustar a config se nao substituir por nome. Depende de (10).
20. [ ] Escrever `error-catalog.spec.ts` (AC25,26,28,30,23), `localized-exception.spec.ts` (AC36, **AC36a** — `assert403Owner`), `request-locale.spec.ts` (AC38) e `http-exception.filter.spec.ts` (AC27,27a,29,32,38). Depende de (4),(7),(5),(14).
21. [ ] Escrever integration test do ownership migrado (AC31, end-to-end do catalogo, DB real). Depende de (16).
22. [ ] Adicionar test/check de `trustProxy` (AC33-AC35 via `app.inject` com XFF, **marcados "a validar"**) + `scripts/test-trust-proxy-smoke.ts` (bloqueante pre-prod). Depende de (15).
23. [ ] Adicionar/ajustar check de pareamento de guards (lint custom ou extensao do `audit-endpoints.ts`): falhar se algum controller aplicar `RolesGuard` sem **`JwtAuthGuard`** imediatamente antes (`OptionalJwtAuthGuard` **nao** satisfaz — Furo 1). Teste do check com fixtures (AC37). Nesta parte nenhum controller usa `RolesGuard` → passa vacuamente. Depende de (8).
24. [ ] Adicionar grep de em-dash (AC23) e test de nao-vazio do catalogo (AC30) ao pipeline CI/lint (enforcement futuro — Furo 8). Depende de (4).
25. [ ] Rodar `npm test`, `npm run lint`; confirmar AC23 e AC30. Depende de (9),(13),(14),(16),(17)-(24).
26. [ ] Provar AC11: `git diff --stat src/**/*.controller.ts` vazio + grep `RolesGuard` em controllers = 0; `npm run audit:endpoints` (check secundario). Depende de (25).
27. [ ] Registrar entry em `docs/CHANGELOG.md` e atualizar status no epico. **Atualizar o resumo da Parte 0 e corrigir D14 no epico** (`epico:124,144-151`, Achado 9). Rodar `security-auditor`. Depende de (26).
28. [ ] **Cross-spec (pre-requisito desta fundacao):** abrir as edicoes nas specs filhas — Parte 1 remove `trustProxy: true` (Achado 2); Parte 2 reescreve a secao "Helper de codigo publico" para o contrato congelado (Achado 1). Nao bloqueia o merge da Parte 0, mas **deve** ser feito antes de a respectiva filha entrar. Registrado em Perguntas em Aberto #10.

---

## Consideracoes de Arquitetura

- **Por que `RolesGuard` exige `JwtAuthGuard` e nao `OptionalJwtAuthGuard` (Furo 1):** o Optional deixa `req.user = null` para anonimo legitimo, indistinguivel de misconfig pelo guard. Exigir o `JwtAuthGuard` (que lanca 401 no anonimo) torna `req.user` sempre populado quando o `RolesGuard` roda; um `req.user` nulo no guard so pode ser misconfig real. Custa o caso "auth opcional + papel" (raro; nao requerido por nenhuma parte hoje), registrado em aberto.
- **Por que resolver injetavel para `PARCEIRO`:** mantem a Parte 0 sem dependencia do schema da Parte 3 e shippable. Inversao de dependencia (interface + token DI) permite a Parte 3 trocar a impl sem editar `RolesGuard`.
- **Por que RNG injetavel e nao import direto:** `import { randomInt }` cria binding dificil de espiar; codigo deterministico no teste exige controlar a fonte. Encapsular num provider (token DI) torna o `PublicCodeService` testavel sem spy fragil e isola a verificacao "usa crypto" num teste dedicado (AC15).
- **Por que enum TS e nao enum Prisma:** papel e derivado, nunca persistido (D3). Coluna de papel global criaria fonte de verdade dupla.
- **Por que sincronos antes do resolver:** evita I/O desnecessario e torna o resultado independente da ordem dos papeis (Regra 9 / AC24).
- **Por que reusar `@nestjs/throttler` e nao bucket proprio:** ja instalado e wired globalmente (`app.module.ts:47,89`), ja em uso com override por rota (`public-pet.controller.ts:23`). O util so exporta a **constante** (defesa por IP). O bucket `default` do `@Throttle` substitui o `default` global (60→10) na rota. **A defesa por codigo (segundo bucket nomeado) e da parte consumidora** (Furo 11), pois o nome `default` ja esta ocupado e a granularidade depende da tabela.
- **Por que util agnostico de tabela (callbacks):** Prestador e Familia tem tabelas diferentes (`CompartilhamentoPrestador`, `ConviteFamilia`). Um util que recebe `isTaken`/`findByCodigo` cumpre D2 sem amarrar entidade.
- **Por que catalogo estatico (constante) e nao tabela (D14):** mensagem de erro nao e conteudo dinamico (nao muda sem deploy, nao tem CRUD de CMS). Tabela traria query por request + fonte de verdade fora do codigo. O padrao do repo (`ESPECIE_LABELS`) ja existe; copia-lo mantem consistencia, lookup O(1), revisao por PR. **Bonus:** o tipo `Record<ErrorKey, Record<Locale, string>>` ja garante completude de locale em compile-time (Furo 8).
- **Por que o filtro remove `errorKey` do payload (Furo 10):** o `HttpExceptionFilter` faz spread de `...error`; sem remover, o identificador interno (`ROLE_FORBIDDEN`) vazaria no JSON ao cliente, divergindo das tabelas da spec e expondo nomenclatura interna. A `message` localizada e o que vai pro humano; `errorKey` e so interno ao throw.
- **Por que excecao carrega chave e o filtro resolve:** quem lanca (guard/service) muitas vezes nao tem a request/locale a mao; o filtro **sempre** tem (`ArgumentsHost`). Separar "qual erro" (chave) de "em que idioma" (locale) e o ponto natural, e permite migracao incremental (legado sem chave passa intacto).
- **Por que `localeFromRequest` null-safe e compartilhado (Furo 7):** o caminho de erro pode rodar antes da query estar populada; o helper precisa nunca lancar. Compartilha-lo com o `@Locale()` (DRY) garante uma so logica de resolucao.
- **Por que `trustProxy: <n>` via env e nao literal nem `true` (Furo 3/9):** `true` confia em XFF arbitrario (spoofavel). `<n>` fixo confia so nos hops imediatos ao servidor (semantica do `proxy-addr`: conta hops a partir do socket para fora). Via **env** (`TRUST_PROXY_HOPS`) o numero e calibravel sem novo deploy de codigo apos o smoke confirmar a topologia do Railway. `getTracker` custom e plano B.
- **Por que `trustProxy` na fundacao e nao na Parte 1:** config de bootstrap de impacto zero em contrato (nenhuma rota usa `req.ip` para negocio) e a Parte 1 ja precisa dele. **Ressalva (Furo 2):** nao melhora os logs (`logger.middleware.ts` usa `socket.remoteAddress`). **Ressalva (Furo 9):** o numero de hops e a validar por smoke bloqueante antes de prod.
- **Coexistencia com `SystemAdminGuard`:** vivem juntos; migracao para `@Roles(SYSTEM_ADMIN)` e follow-up opcional.
- **Contraste de superusuario (papel vs recurso):** `RolesGuard` nao da bypass de admin; `OwnershipService` da (`isAdmin`). Camadas distintas e deliberadamente assimetricas; documentado no JSDoc do guard.
- **Politica 403 vs 404 centralizada (D14):** 403 de ownership via `OwnershipService`/`assert403` (com semantica testada — Furo 6); 404 de codigo publico via `resolveAtivoOrThrow`. Cada caso tem um ponto unico; nenhuma parte reinventa o status.

---

## Plano de Rollout / Rollback

- **Rollout:** merge direto em `develop` (regra do repo: so `develop`/`master`, sem feature branch). O guard/util sao codigo morto ate as Partes 1-4, **mas o `trustProxy` NAO e inerte (Achado 8):** ele altera o `req.ip` lido pelo `ThrottlerGuard` global ja ativo, afetando **todas** as rotas throttladas de hoje (`public-pet` 30/min e qualquer `@Throttle`). O catalogo so muda copy quando o cliente pede locale != pt-BR; nesta parte ele e exercitado de fato pelos 403 de ownership migrados (AC31). `trustProxy` muda so o valor de `req.ip` (NAO os logs — Furo 2). Sem migration ⇒ `prisma migrate deploy` nao roda nada novo. **BLOQUEANTE ANTES de promover `develop`→`master` (Furo 9 + Achado 8, nao "pos-deploy"): rodar `scripts/test-trust-proxy-smoke.ts` e confirmar que `req.ip` no Railway reflete o cliente real com o `TRUST_PROXY_HOPS` configurado; ajustar o env se a topologia diferir de 1 hop.** Enquanto o numero de hops nao for confirmado, um hop errado torna o XFF spoofavel para as rotas throttladas **existentes** (atacante zera o throttle do `public-pet`), entao o smoke gate roda **antes** do merge em `master`, nao depois. Plano B se a topologia for instavel: `getTracker` custom saneando o ultimo IP confiavel do XFF.
- **Feature flag:** desnecessaria para o guard/util (codigo morto ate Parte 1-4). `TRUST_PROXY_HOPS` e o "knob" do trust proxy (env, ajustavel sem deploy). Risco de ativacao acidental do guard mitigado por AC11.
- **Rollback:** reverter o commit. Sem efeito colateral de dados. O unico runtime-visivel a reverter e `trustProxy` (volta `req.ip` ao IP do proxy — mas como nada de negocio o usa, e benigno) e a copy localizada (volta a pt-BR fixo; ownership volta a `ForbiddenException` literal). Seguro a qualquer momento antes das Partes 1-4 dependerem dos simbolos.
- **Coordenacao com consumidores:** nenhuma quebra. App e CMS nao veem rota nova nem schema. Clientes que ja mandam `Accept-Language` passam a receber mensagens de erro (guard/util/ownership) traduzidas — melhoria; o shape `{ statusCode, message, error }` nao muda (e `errorKey` nao vaza — Furo 10).

## Observabilidade

- **Negacao de papel:** `RolesGuard` loga WARN ao negar: `[Authz] DENY user=<userId> required=<roles> reason=missing_role` (sem PII). Espelha o padrao do `OwnershipService.deny` (`ownership.service.ts:23-28`).
- **401 por misconfig:** WARN `[Authz] DENY anon reason=missing_user` (flagra rota sem `JwtAuthGuard` antes do `RolesGuard`).
- **Estouro de geracao de codigo:** `PublicCodeService` loga WARN `[PublicCode] gen_exhausted tentativas=5` antes de lancar 503.
- **IP nos logs (Furo 2 — corrigido):** `trustProxy` **NAO** altera o IP logado pelo `logger.middleware.ts` (le `req.socket.remoteAddress`, nao `req.ip`). Sem mudanca de observabilidade de IP nesta parte. Logar o IP real exigiria uma mudanca separada (request Fastify decorada em vez da raw) — fora do escopo, registrado em aberto.
- **Catalogo de erro:** sem log proprio (funcao pura). O filtro nao loga a copy (so formata na resposta).
- **Sem metrica nova de infra** nesta parte. Throttle 429 ja contabilizado pelo `ThrottlerGuard`, agora chaveado por IP real **no tracker do throttler** (uma vez confirmado o numero de hops).
- Usar `Logger`/`console.warn` no padrao do repo. Nao logar PII.

## Definition of Done

- [ ] `AppRole`, `@Roles`, `RolesGuard`, `ParceiroRoleResolver` (no-op), `RandomCodeGenerator`, `PublicCodeService` (com `gerar`, **`gerarComInsert`**, `resolveAtivoOrThrow`, **`isTakenFactory`**), `PUBLIC_CODE_THROTTLE` criados e exportados.
- [ ] `ERROR_CATALOG` + `ErrorKey` + `resolveErrorMessage` + `LocalizedException` + `assert403` + **`assert403Owner`** + `localeFromRequest` criados; `HttpExceptionFilter` resolve via catalogo quando ha `errorKey` **e remove `errorKey` do payload** (D14, Furo 10).
- [ ] `main.ts` com `trustProxy: Number(process.env.TRUST_PROXY_HOPS ?? 1)`; `TRUST_PROXY_HOPS` documentado — D14 (Furo 3/9).
- [ ] `@Locale()` delega a `localeFromRequest` (DRY); helper null-safe (Furo 7).
- [ ] `OwnershipService.deny` migrado para `LocalizedException('OWNERSHIP_FORBIDDEN')` (AC31 **obrigatorio**); copy pt-BR identica (sem ponto) — Furo 4.
- [ ] `RolesGuard` cobre AC1-AC10, AC24, AC37; util cobre AC12-AC22 **+ AC13a/AC13b (predicado completo + colisao P2002 regera) + AC22a (substituicao do balde, runtime)**; RNG cobre AC15; catalogo cobre AC25-AC32 + AC27a; `assert403`/`assert403Owner` cobrem AC36/**AC36a**; `localeFromRequest` cobre AC38; trustProxy cobre AC33-AC35 (marcados "a validar"); em-dash zero (AC23).
- [ ] **D15: requisito de throttle cross-instancia documentado e congelado** (Redis no throttler OU lockout por codigo persistido) como entrega do DoD das Partes 1/2 — a Parte 0 entrega so a constante in-memory (Regra 14a). DoD das filhas referencia.
- [ ] **Contrato congelado do util** verificado: `resolveAtivoOrThrow` lanca 404 (nunca `null`); `gerarComInsert` + UNIQUE parcial sao o caminho recomendado (TOCTOU); divergencia da Parte 2 listada como acao de reconciliacao (Achado 1).
- [ ] Integration test end-to-end do catalogo via ownership migrado verde (AC31).
- [ ] `npm test` verde, `npm run lint` limpo.
- [ ] AC11 provado: `git diff --stat src/**/*.controller.ts` vazio + grep `RolesGuard` em controllers = 0; `npm run audit:endpoints` passa.
- [ ] Test de catalogo (en-dash + nao-vazio) verde **e no CI**; completude de locale garantida pelo compilador (Furo 8).
- [ ] Check de pareamento de guards (Task 23) presente, rejeita `OptionalJwtAuthGuard` (AC37) e verde.
- [ ] **BLOQUEANTE (antes do merge em `master`, nao pos-deploy — Achado 8):** smoke de `req.ip` no Railway rodado e numero de hops confirmado (`TRUST_PROXY_HOPS` ajustado se necessario). Justificativa: `trustProxy` afeta o `ThrottlerGuard` global ja ativo (rotas throttladas existentes), entao um hop errado fura o throttle de `public-pet` em producao (Furo 9 + Achado 8).
- [ ] `RolesGuard`, `PublicCodeService`, catalogo/`LocalizedException`/`assert403` importaveis pelas Partes 1-4.
- [ ] JSDoc no `RolesGuard` documenta: exige `JwtAuthGuard` (nao Optional) antes; admin nao e superuser implicito (contraste com bypass do `OwnershipService`); `PARCEIRO` via resolver substituido na Parte 3.
- [ ] Politica 403 vs 404 (D14) documentada e refletida no `assert403`/`resolveAtivoOrThrow`.
- [ ] Erros documentados batem com a forma real do `HttpExceptionFilter` (sem `data`, sem `errorKey`).
- [ ] `docs/CHANGELOG.md` com entry; status da Parte 0 atualizado no epico.
- [ ] `security-auditor` rodado (guard de autz + util de codigo de acesso + catalogo de erro + `trustProxy`).

## Perguntas em Aberto

1. **Numero de hops do `trustProxy` no Railway (decisao de infra, D14):** default `TRUST_PROXY_HOPS=1` (1 proxy: edge do Railway). **Confirmar a topologia real** (CDN/load-balancer extra na frente → ajustar). **Bloqueante por smoke pos-deploy** antes de prod (AC34/AC35). Plano B: `getTracker` custom saneando o ultimo IP confiavel do XFF.
2. **Defesa por codigo + cross-instancia (alem de por IP) nas rotas de troca-de-codigo (Partes 1/2) — D15:** a Parte 0 entrega **so** a constante de defesa por IP **in-memory**; o balde **por codigo/recurso** (anti-brute-force distribuido por IP, indispensavel para o espaco 10^6) **e** a confiabilidade **cross-instancia** sao responsabilidade da parte consumidora. **D15 exige (escolha da filha):** (A) **Redis no throttler** (`ThrottlerStorageRedisService`, estado compartilhado entre instancias) **OU** (B) **lockout por codigo persistido** (contador de tentativas falhas por codigo no Postgres + bloqueio temporario). Confirmar a granularidade exata (por codigo vs por slug de convite) por tabela; cada parte que consome deve entregar (A) ou (B) no DoD. O `PUBLIC_CODE_THROTTLE` in-memory sozinho **nao** satisfaz.
3. **IP real nos logs:** `trustProxy` **nao** muda o IP logado (o `logger.middleware.ts` le `socket.remoteAddress`, nao `req.ip`). Vale uma mudanca separada para logar o IP real (acessar a request Fastify decorada em vez da raw) — backlog de observabilidade. Decidir prioridade.
4. **Auth opcional + papel:** o `RolesGuard` desta parte exige `JwtAuthGuard` (lanca 401 no anonimo), entao "rota publica-opcional que tambem checa papel quando ha login" nao e suportada. Alguma parte futura precisa disso? Se sim, desenhar um modo do guard que aceite `req.user` nulo como anonimo legitimo (403/permitir conforme a rota) sem confundir com misconfig.
5. **Limite default 10/min/IP:** conservador. Prestador (Parte 1) ou Familia (Parte 2) querem endurecer? Override-avel por rota.
6. **Migrar mensagens de erro legadas para o catalogo:** o catalogo ja existe e o filtro ja resolve. A Parte 0 migrou as 5 chaves novas + `OwnershipService`. As centenas de `throw new XException('string')` restantes: sweep dedicada (epico de i18n de erro) ou oportunistica por parte? Proposta: oportunistico.
7. **`MAX_TENTATIVAS = 5`:** suficiente assumindo unicidade so entre vivos (D2). Se alguma parte exigir "unico global historico", a densidade sobe e o valor precisa revisao. Confirmar que nenhuma parte exige global.
8. **Migracao de `SystemAdminGuard` para `@Roles(SYSTEM_ADMIN)`:** fora do escopo (zero regressao). Agendar como follow-up de limpeza? Sem urgencia.
9. **Tradutor de copy es-419/en-GB:** as traducoes do catalogo foram redigidas na spec. Revisar com falante nativo antes de prod (es-419, en-GB) ou aceitar como v1? Sem em-dash em todas (regra 4 do CLAUDE.md). Nota: `OWNERSHIP_FORBIDDEN` pt-BR mantida **sem ponto** para casar a string atual.

10. **Reconciliacao cross-spec das specs filhas (acao de redacao, nao decisao de produto — Achados 1 e 2):** duas edicoes ja decididas, pendentes de aplicar nas filhas. **(a) Parte 2:** reescrever "Helper de codigo publico (D2)" (`02:39-53`) para o contrato congelado desta fundacao (`gerar(isTaken)`/`gerarComInsert`, `resolveAtivoOrThrow` lanca 404; `expiraEm`/`ttl`/`usuarioId`/`tipo` calculados/persistidos pelo service de Familia). **(b) Parte 1:** remover a habilitacao de `trustProxy` (Task 0c/AC33, `01:632,651,716`), substituir por "entregue pela Parte 0 via `TRUST_PROXY_HOPS`, Parte 1 so valida no smoke"; **nunca** `trustProxy: true`; manter so `limits.files`. Nao bloqueia o merge da Parte 0; bloqueia a entrada de cada filha. **Decisao ja tomada — so falta editar os arquivos.**

11. **`RolesGuard` consultar estado vivo de `Tutor.ativo` vs. confiar no claim + TTL curto (Achado 4):** hoje `@Roles(TUTOR)` reflete o JWT no momento da emissao; ha janela de staleness entre inativar/reativar e o refresh. A fundacao **aceita** a janela (TTL curto + revalidacao no service para acoes sensiveis). **Decisao de produto/seguranca em aberto:** alguma parte futura exige que o proprio guard consulte `Tutor.ativo` vivo (custo: +1 query por rota de papel)? Se sim, desenhar um modo do guard que faca a consulta so quando a rota declarar "papel fresco obrigatorio". Sem demanda hoje.

## Change Log

| Data | Versao | Mudanca | Autor |
|---|---|---|---|
| 2026-06-23 | 0.1 | Criacao da spec da Parte 0 apos research de `jwt.strategy.ts`, `system-admin.guard.ts`, `ownership.service.ts`, `main.ts`, `app.module.ts`, `schema.prisma` e padrao de `@Throttle`. Decisoes locked D2/D3. | Claude + Nicolas |
| 2026-06-23 | 0.2 | Revisao adversarial: AC11 via `git diff` + grep `RolesGuard`; pre-requisito `trustProxy`/`getTracker` + balde por codigo; tabelas de erro na forma real do filtro (sem `data`); RNG injetavel + AC15; JSDoc + check de pareamento; curto-circuito sincrono + AC24; contraste com bypass de admin; `@Roles(TUTOR)`=ativo + nota de reativacao; `common.module.ts` nao tocado. | Claude + Nicolas |
| 2026-06-24 | 0.3 | Aplicacao de **D14**: catalogo i18n de erro estatico por chave (`ERROR_CATALOG`, `LocalizedException`, filtro resolve a chave); `trustProxy` virou decisao (`FastifyAdapter({ trustProxy: 1 })`); politica 403 vs 404 documentada (`assert403`, `resolveAtivoOrThrow`). | Claude + Nicolas |
| 2026-06-24 | 0.5 | **Reconciliacao com D15 + correcao de 9 achados de auditoria.** D15 dobrado no corpo: contratos congelados (tabela nova "Contratos congelados (D15)"); throttle in-memory nao-cross-instancia → requisito Redis-ou-lockout das Partes 1/2 (Regra 14a, aberto #2); dominios via env documentados; itens de D15 nao-Parte-0 listados como das filhas. **Achado 1 (alta):** contrato do util congelado (`gerar(isTaken)`/`gerarComInsert`/`resolveAtivoOrThrow` lanca 404, nunca null); divergencia da Parte 2 vira acao de reconciliacao (Regra 13a, aberto #10). **Achado 2 (alta):** Parte 0 e dona da habilitacao de `trustProxy`; Parte 1 NAO reabilita e nunca usa `trustProxy: true` (Regra 23 cross-spec, aberto #10, epico corrigido). **Achado 3 (alta):** race TOCTOU de unicidade fechado — UNIQUE parcial + `gerarComInsert` com retry em `P2002` (Regra 11a/12a, AC13b). **Achado 4 (media):** staleness do claim `@Roles(TUTOR)` vs `Tutor.ativo` vivo documentada (Regra 2a, aberto #11). **Achado 5 (media):** `assert403Owner` tipado fecha o predicado degenerado (`req.user.usuarioId`=undefined) (Regra 21a, AC36a). **Achado 6 (media):** substituicao do balde de throttle provada em runtime via `app.inject` (Regra 14, AC22a). **Achado 7 (media):** contrato do `isTaken` (`status=ATIVO AND expiraEm > now`) obrigatorio + `isTakenFactory` (Regra 11a, AC13a). **Achado 8 (media):** `trustProxy` reclassificado de "inerte" para "afeta o ThrottlerGuard global ja ativo"; smoke bloqueante ANTES do merge em `master`. **Achado 9 (baixa):** epico atualizado (resumo da Parte 0 + D14 "habilitado na Parte 0"). | Claude + Nicolas |
| 2026-06-24 | 0.4 | Segunda revisao adversarial (11 furos), correcoes alta/media: **(alta, Furo 1)** `RolesGuard` exige `JwtAuthGuard` (nao `OptionalJwtAuthGuard`, que deixa `req.user=null` legitimo, `optional-jwt-auth.guard.ts:11-13`); check de pareamento rejeita Optional; AC37; "auth opcional + papel" → aberto #4. **(alta, Furo 2)** Removida a afirmacao falsa de que `trustProxy` melhora o IP nos logs — `logger.middleware.ts:45` le `socket.remoteAddress` (raw request, sem `.ip`); corrigido em Research/RNF/Observabilidade; IP real nos logs → aberto #3. **(media, Furo 3)** Semantica correta do `proxy-addr` (n = hops a partir do socket); AC34/AC35 rebaixados a "a validar"; `TRUST_PROXY_HOPS` via env. **(media, Furo 4)** Migracao do `OwnershipService` virou **obrigatoria** (AC31) + integration test end-to-end do catalogo; D14 cumprido incrementalmente. **(media, Furo 5)** Ancora de reativacao corrigida: rota `POST /users/me/reactivate` (`inactivation.controller.ts:54-64`) + service `inactivation.service.ts:210-239` (era `206-236`). **(media, Furo 6)** `assert403` com assinatura/semantica explicitas (`temAcesso: boolean`, true libera) + AC36. **(media, Furo 7)** `localeFromRequest` null-safe replicando guardas do `locale.decorator.ts:16-18` + AC38. **(media, Furo 8)** Reconhecido que o tipo ja garante completude de locale (compile-time); AC30 vira en-dash + nao-vazio no CI. **(media→baixa, Furo 9)** `TRUST_PROXY_HOPS` via env (nao literal 1) + smoke bloqueante no DoD/rollout. **(baixa, Furo 10)** Filtro **remove `errorKey`** do payload antes do spread (`http-exception.filter.ts:24`) + AC27a. **(baixa, Furo 11)** Explicitado que a Parte 0 entrega **so** a defesa por IP; defesa por codigo (anti-brute-force distribuido) e da parte consumidora → aberto #2; risco "Alto: brute-force" reclassificado. Tambem: `OWNERSHIP_FORBIDDEN` pt-BR **sem ponto** para casar `ownership.service.ts:27` (AC28). | Claude + Nicolas |