# Spec: Parte 2 — Plano Família (membership)

**Status:** In Review | **Autor:** Claude + Nicolas | **Atualizado em:** 2026-06-24 | **Versão:** 0.5

> **v0.5 (reconciliação D15 + auditoria):** (1) Contrato real do `PublicCodeService` da Parte 0 (`gerar(isTaken)`/`resolveAtivoOrThrow`, agnóstico de tabela, lança `PUBLIC_CODE_INVALID` 404) — substitui o helper fictício; `ConviteFamilia` é tabela própria (Pergunta 6 fechada). (2) `deny()` já migrado pela Parte 0 para `LocalizedException('OWNERSHIP_FORBIDDEN')`; novos métodos reusam; AC de 403 asseveram status+chave. (3) **Defesa por código (D15):** `@Throttle` por código nas rotas públicas por código (lockout por código). (4) **Feature flag `FAMILIA_LEITURA_PRONTUARIO` firme (D15):** leitura por família gated, default off (Pergunta 9 fechada). (5) `LINK_LIDER` **multi-uso** (não consome no aceite) vs `CODIGO_CONVIDADO` single-use; corrida de vaga/limite revalidada na transação (Regra 6b, AC10c/AC21b). (6) Resiliência de `getNivelForTutor` escopada à herança (tutor-inexistente continua lançando, AC15c). (7) Remoção de membro confia em `onDelete: Cascade` (não delete manual, AC29b); remoção de pet revoga delegações atomicamente sem cascade via `FamiliaPet` (AC28b). (8) Leitura na carência alinhada à herança de Pro (Regra 4, AC40m/AC40n). (9) Gatilho garantido de carência (herança escreve + cron varre ATIVA, AC38d/AC38e); janela de consistência com webhook declarada benigna (AC42d). (10) Documento user-level próprio concede via dono-direto (AC40l2). (11) Mensagens de erro pelo catálogo i18n da Parte 0. (12) DELETE com `@HttpCode(200)` explícito (AC44). (13) Líder Freemium: ciclo trial→suspensão declarado (AC43c). Perguntas novas 10 (ebook callsite) e 11 (Freemium líder).

> Spec filha do épico [Acesso, Compartilhamento e Parcerias](../epicos/acesso-compartilhamento-e-parcerias.md). Fonte de contrato: [compartilhamento-plano-familia.txt](../epicos/compartilhamento-plano-familia.txt). **Bloqueada pela Parte 0** (RolesGuard + helper de código público de 6 dígitos), descrita em `00-fundacao-papeis-e-codigo.md` (em redação). Ver [Dependência da Parte 0](#dependência-da-parte-0-contrato-mínimo) para o contrato mínimo que esta parte consome.

---

## Visão Geral

Implementa o **Plano Família**: um membership vivo onde um tutor **líder Premium** compartilha o plano com até 4 convidados. Convite por **código** (líder digita o código do convidado) **e por link** (convidado abre o link do líder). Convidado herda **Pro (nível 2)** enquanto membro ativo; líder mantém Premium (nível 3). Cada membro vincula seus próprios pets ao plano: líder direto, convidado via solicitação que o líder aprova/recusa.

**Leitura de prontuário por família entra no escopo desta parte (mudança da v0.3, ver [Escopo de visibilidade](#escopo-de-visibilidade-o-que-entra-nesta-parte)):** além da leitura de **metadados** dos pets via snapshot (`GET /familia`), todos os membros da família **ATIVA** passam a ler (read-only) os **recursos de prontuário** dos pets do plano: vacina, consulta, diário, medicamento, peso, documento, diagnóstico, alergia e tratamento fixo. A leitura por família é honrada por um método consolidado `assertPodeLerRecursoDoPet` (dono OU admin OU membro-de-família-ativa-com-o-pet-vinculado OU delegado), que substitui o `assertPetOwnership` **somente nos caminhos de leitura** (list `findAll`/`findByPet` e detalhe `findOne`). **Mutação continua restrita ao dono**, salvo **delegação temporária** (create-only, intra-família). Cada rota de leitura trocada passa por `security-auditor` com AC de regressão dedicada por recurso. Para não fechar parcial, a tabela em [Escopo de visibilidade](#escopo-de-visibilidade-o-que-entra-nesta-parte) lista **todas** as rotas de leitura tocadas, não um subconjunto.

> **Correção da v0.4 (furo de ownership do pet detalhe):** `pet.service.findOne`/`findOneWithAllInformation` **não usam `assertPetOwnership`** — fazem `prisma.pet.findUnique(...)` inline (query única que já traz `tutor.usuarioId`) e validam por `ownership.assertOwnsByUsuarioId(...)` ([pet.service.ts:69-94, 96-184](../../../src/pet/pet.service.ts)). Plugar `assertPodeLerRecursoDoPet` (que re-busca o pet) **duplicaria** a query que esse endpoint consolidou de propósito. Por isso a leitura de pet por família usa uma **forma inline família-aware** (`assertPodeLerPetInline`) que recebe o `ownerUsuarioId` já carregado e só dispara a sub-query de família **quando o check de dono falha**. Ver [Autorização / BOLA](#autorização--bola-por-rota).

Entidades novas: `FamiliaPlano`, `MembroFamilia`, `FamiliaPet`, `SolicitacaoPet`, `ConviteFamilia`, `DelegacaoPet`. Evolução **aditiva** do `OwnershipService`. Herança de nível resolvida por `max()` em `getNivelForTutor`, **sem tocar** o contrato do webhook RevenueCat.

É a parte mais próxima de receita: o Premium **já vende** "Gestão completa da família (até 5 pessoas)" no marketing ([seed.ts:190](../../../prisma/seed.ts), benefício associado a `Premium` e `Freemium`).

---

## Motivação / Contexto de Negócio

- O benefício "Gestão completa da família (até 5 pessoas)" já é vendido no Premium ([seed.ts:181-191](../../../prisma/seed.ts)) mas **não existe no backend**. Promessa de marketing a cumprir.
- O front da tela Família **já está pronto com mock local** (`app/(fullscreen)/family.tsx`, `src/features/familia/`) e contrato escrito ([compartilhamento-plano-familia.txt](../epicos/compartilhamento-plano-familia.txt)). Backend é o gargalo.
- A camada de autorização hoje é binária (dono-ou-admin): `OwnershipService` valida `pet.tutor.usuarioId === userId` ([ownership.service.ts:46-59](../../../src/auth/services/ownership.service.ts)). Família exige evoluí-la sem regressão.
- A monetização foi fechada com o Nicolas (D10/D11 do épico): assinatura é da loja (RevenueCat dona do billing), logo a herança resolve por `max(próprio, herdado)` e **nunca cancela assinatura de loja**.
- A promessa "todos da família veem o prontuário dos pets do plano" (decisão travada do épico) entra agora **por inteiro** (leitura read-only de todos os recursos de prontuário), não só metadados — entrega completa da regra de visibilidade.

---

## Dependência da Parte 0 (contrato mínimo)

Esta parte **não é implementável nem testável** até a Parte 0 existir. Confirmado por grep: zero ocorrências de `RolesGuard`/`@Roles`/`@CurrentTutor` no `src/` hoje (apenas citados nas `.claude/rules`). Para não acoplar a Parte 2 a detalhes ainda indefinidos, fixamos aqui a **interface mínima** que esta parte consome da Parte 0. A Parte 0 pode entregar mais; estes são os contratos dependidos:

### Helper de código público (D2) — `PublicCodeService` (API real da Parte 0)

> **Correção de contrato (reconciliação D15):** versões anteriores desta spec assumiam um helper *stateful* fictício (`gerar({usuarioId, tipo, ttlMs})` + `resolver(): {…}|null`). **Esse helper não existe.** A Parte 0 (`00-fundacao-papeis-e-codigo.md` Regras 12-14, AC do util) entrega o **`PublicCodeService`**, que é **agnóstico de tabela** (não conhece `usuarioId`/`tipo`/`ttlMs`, não persiste convite, não retorna `expiraEm`) e opera por **callbacks**. A Parte 2 é dona da persistência de `ConviteFamilia`; o util só gera/valida a string de 6 dígitos.

```ts
// src/common/<public-code>/public-code.service.ts — API REAL que a Parte 2 consome
interface PublicCodeService {
  // Gera código de 6 dígitos único. O caller passa `isTaken`: o util chama
  // até achar um código livre (loop até MAX_TENTATIVAS=5; estourou => lança
  // LocalizedException('PUBLIC_CODE_GEN_EXHAUSTED', 503)). NÃO persiste nada,
  // NÃO calcula expiração, NÃO conhece usuarioId/tipo: só devolve a string.
  gerar(isTaken: (codigo: string) => Promise<boolean>): Promise<string>;

  // Resolve um código ativo via loader do caller. `findByCodigo` faz a query
  // na tabela do caller (aqui: prisma.conviteFamilia.findUnique). O util valida
  // estado (não encontrado / revogado / consumido / expirado <= now) e, em
  // qualquer um, LANÇA LocalizedException('PUBLIC_CODE_INVALID', 404) — erro
  // único genérico anti-enumeração (D2). NÃO retorna null.
  resolveAtivoOrThrow<T>(codigo: string, findByCodigo: (c: string) => Promise<T | null>): Promise<T>;
}
```

**Como a Parte 2 usa (a Parte 2 é dona do schema de `ConviteFamilia`):**

- **Gerar (`GET /familia/convite`):** o `familia.service` chama `gerar(isTaken)` passando um `isTaken` que faz `prisma.conviteFamilia.findFirst({ where: { codigo, consumidoEm: null } })` (código vivo já em uso?). O service **calcula ele mesmo** `expiraEm = now + FAMILIA_CONVITE_TTL_DIAS` e **grava** a linha `ConviteFamilia(codigo, tipo, usuarioId, familiaId?, expiraEm)`. O util não toca o banco.
- **Resolver (aceite/convite):** o service chama `resolveAtivoOrThrow(codigo, (c) => prisma.conviteFamilia.findUnique({ where: { codigo: c } }))`. O util retorna a linha `ConviteFamilia` quando ativa, ou **lança `LocalizedException('PUBLIC_CODE_INVALID', 404)`** quando inválida/expirada/consumida. O service **captura esse 404** e o re-emite como o `INVITE_NOT_FOUND` genérico da Família (mesmo status 404, mesma copy genérica via catálogo) — **não há `resolver(): null`** a tratar.
- **Estado de "consumido"/"expirado":** o `findByCodigo` da Família devolve a linha; cabe ao util checar `consumidoEm`/`expiraEm` (Regra 13 da Parte 0). O `LINK_LIDER` é **multi-uso** e não seta `consumidoEm` no aceite (ver [Regra 11](#regras-de-negócio)) — a expiração (`expiraEm`) é o que o encerra.

> A Parte 2 **modela e persiste** `ConviteFamilia` (é a tabela do caller); o util **não** tem entidade própria (Parte 0 Modelo de Dados: "cada parte tem a sua tabela com a coluna de código"). Não há "wrapper fino" nem tabela de código na Parte 0. A Pergunta em Aberto 6 (contrato do helper) **está fechada** por este parágrafo — o kickoff só confirma o path de import do `PublicCodeService`.

### RolesGuard / papel (D3)

A Parte 2 **não usa `@Roles` para papel de família** — papel `LIDER`/`CONVIDADO` é escopado ao plano (resolvido por query em `MembroFamilia`), não global. O `RolesGuard` da Parte 0 só é necessário se a rota exigir papel de principal (não é o caso aqui). **`@CurrentTutor` também não existe hoje**; esta parte usa `@Req() req` e lê `req.user.userId`/`req.user.tutorId` (ver [nota sobre nomes](#nota-crítica-usuarioid-vs-userid)), evitando depender de um decorator ainda não construído.

---

## Research Findings (âncoras arquivo:linha reais)

| Achado | Implicação para a spec | Âncora |
|---|---|---|
| `Pet` usa `tutorId String?` (1-N) e o campo de espécie é **`especiePet Especie`** (não `especie`). | DTO/snapshot expõe `especie` mapeado de `pet.especiePet`. | [schema.prisma:314-356](../../../prisma/schema.prisma) |
| `Tutor.usuarioId` é `@unique` (1-1 Usuario↔Tutor). | Resolver `usuarioId` a partir de `tutorId` e vice-versa é direto. | [schema.prisma:60-77](../../../prisma/schema.prisma) |
| `OwnershipService.assertPetOwnership` (binário) busca `pet.tutor.usuarioId === userId`; `deny()` nega o acesso (403). **A Parte 0 (D14/D4) JÁ MIGROU `deny()` para lançar `LocalizedException('OWNERSHIP_FORBIDDEN', 403)`** (catálogo i18n; copy pt-BR idêntica `'Acesso negado a este recurso'` **sem ponto final**, AC28/AC31 da Parte 0), substituindo a string literal `ForbiddenException('Acesso negado a este recurso')`. Pet inexistente → `NotFoundException('Pet não encontrado')` (404). | Evolução aditiva: novos métodos. **Os 6 novos métodos da Parte 2 reusam `deny()` (não inventam string própria) e herdam de graça o `LocalizedException('OWNERSHIP_FORBIDDEN')` da Parte 0** — mesmo 403, mesma copy do catálogo. Pet inexistente segue 404; pet de outro tutor segue 403 (anti-leak). Não mexer nos `assert*` de edição/delete. **AC de 403 asseveram status + chave (`OWNERSHIP_FORBIDDEN`), não a string literal.** | [ownership.service.ts:46-59](../../../src/auth/services/ownership.service.ts), [00-fundacao Regra 18/AC31](../acesso-compartilhamento-e-parcerias/00-fundacao-papeis-e-codigo.md) |
| **`OwnershipService.assertOwnsByUsuarioId(ownerUsuarioId, userId, resource, resourceId, isAdmin)` é a validação inline** para quando o service já carregou o recurso numa query única com `tutor: { select: { usuarioId } }`. Não faz query; só compara `ownerUsuarioId !== userId` → `deny()`. | **`pet.service.findOne`/`findOneWithAllInformation` usam ESTE método, não `assertPetOwnership`** (ver achado seguinte). A leitura de pet por família precisa de uma forma inline análoga (`assertPodeLerPetInline`) que aceite o `ownerUsuarioId` já carregado. | [ownership.service.ts:30-44](../../../src/auth/services/ownership.service.ts) |
| **`pet.service.findOne` (linha 69-94) e `findOneWithAllInformation` (linha 96-184) NÃO chamam `assertPetOwnership`**: fazem `prisma.pet.findUnique` inline com `tutor: { select: { usuarioId } }` (ou `tutor.usuario` no allinfos) e validam via `this.ownership.assertOwnsByUsuarioId(pet.tutor?.usuarioId, userId, 'pet', id, isAdmin)`. Comentários explícitos ("antes esta operação era 2 queries") provam que a query única é intencional. **`findOneWithAllInformation` inclui `tutor.usuario.{nome,email,telefone}` no retorno (linha 170-172).** | **Correção crítica (furo v0.4):** a leitura de pet por família NÃO troca por `assertPodeLerRecursoDoPet` (que re-buscaria o pet, desfazendo a consolidação). Usa `assertPodeLerPetInline(petId, ownerUsuarioId, userId, isAdmin)`. E `findOneWithAllInformation` **vaza PII do dono** (email/telefone) — precisa redigir esses campos quando o leitor não é o dono (ver [Vazamento de PII em /pet/allinfos](#vazamento-de-pii-em-petallinfos-por-família)). | [pet.service.ts:69-94, 96-184](../../../src/pet/pet.service.ts) |
| Os 9 `assert<Recurso>Ownership` de prontuário (vacina/consulta/peso/medicamento/diário/diagnóstico/alergia/tratamento-fixo/documento) resolvem ownership por `recurso.pet.tutor.usuarioId === userId` ou `documento.usuarioId === userId`; todos têm a mesma forma (404 inexistente, 403 de outro tutor). | A leitura por família troca **apenas o caminho de leitura** (list `findAll`/`findByPet` e detalhe `findOne`) para `assertPodeLerRecursoDoPet`; edição/delete continua em `assert<Recurso>Ownership`. | [ownership.service.ts:72-317](../../../src/auth/services/ownership.service.ts) |
| Os controllers de prontuário expõem leitura em dois caminhos: list (`@Get()` com `petId` via query, resolvido por `assertPetOwnership(petId,...)`) e detalhe (`@Get(':id')`, resolvido pelo `assert<Recurso>Ownership(id,...)`). Ex.: `diario-pet.service.ts:88` (list) e `findOne`. | Cada recurso tem 2 rotas de leitura a tornar família-aware: list por `petId` e detalhe por `id`. Lista completa em [Escopo de visibilidade](#escopo-de-visibilidade-o-que-entra-nesta-parte). | [diario-pet.controller.ts:56,95](../../../src/diario-pet/diario-pet.controller.ts), [diario-pet.service.ts:88](../../../src/diario-pet/diario-pet.service.ts) |
| **`DiarioPet` gating é `REQUIRED_NIVEL = 3` e SÓ de escrita** (comentário linha 26-28: "Gating de escrita: nivel >= 3 (Premium/Freemium). Leitura sempre liberada"). | **Correção (furo v0.4):** o convidado herda Pro=2, que **não desbloqueia o diário** (precisa de 3) — e o gating do diário só afeta escrita, que herança nenhuma libera para pet alheio. Logo o diário **não é um "ganho" de acesso do convidado pela herança**. Removido da lista de expansões de acesso; permanece em Task 20 só como "confirmar que NÃO quebra". | [diario-pet.service.ts:20,26-27](../../../src/diario-pet/diario-pet.service.ts) |
| `getNivelForTutor(tutorId)` → `subscription.plano.nivel` ou `0`. É consumido com `.catch(() => 0)` em `cupom.service.ts:96`, e direto (sem catch) em `ebook.service.ts:72,98` e `diario-pet.service.ts:360`. | Herança via `max()` **deve ser resiliente internamente** (degrada para nível próprio, nunca lança/nunca cai pra 0 por falha de família). Ver [Herança resiliente](#regras-de-negócio) e AC15b. | [subscription.service.ts:136-157](../../../src/subscription/subscription.service.ts), [cupom.service.ts:96](../../../src/cupom/cupom.service.ts), [ebook.service.ts:72](../../../src/ebook/ebook.service.ts), [diario-pet.service.ts:360](../../../src/diario-pet/diario-pet.service.ts) |
| `getSubscriptionInfoForTutor` lê `plano.nivel` da subscription **direta** (não aplica `max()`). É o que a home consome. Tem **catch-up de Freemium**: se a ACTIVE é Freemium vencida, migra pra Básico via `planoService.handleFreemiumDowngradeForUser` na própria leitura (lazy-write). | "Nível efetivo" (com herança) **diverge** de "subscription real". Divergência intencional e documentada. **O catch-up de Freemium é o padrão espelhado pela carência da suspensão da família** (lazy-write na leitura + cron de varredura). | [subscription.service.ts:188-302](../../../src/subscription/subscription.service.ts) |
| `Subscription` é `(usuarioId, tipoEntidade, entidadeId, planoId, status)`. Sem noção de seats. `usuarioId` é usado pelo webhook. | NÃO redefinir `Subscription.usuarioId` (D5). Herança calculada em runtime. | [schema.prisma:804-825](../../../prisma/schema.prisma) |
| Planos: **Básico=1, Pro=2, Premium=3, Freemium=4** (Freemium é trial com benefícios Premium). | Gating Família = plano efetivo do líder habilita família (`familiaMaxMembros != null` no seed de Premium, não Freemium, D16). Herança ao convidado **fixa em Pro (nível 2)**. | [seed.ts:109-213](../../../prisma/seed.ts) |
| JWT `req.user` carrega `userId, email, nome, isSystemAdmin, tutorId, tutorActive, veterinarioId`. **Não há campo `usuarioId`** nem `familiaRole`. | `usuarioId` do recurso === `req.user.userId` (que é o `Usuario.id`). Novos asserts recebem `userId`, não `usuarioId`. Ver [nota crítica](#nota-crítica-usuarioid-vs-userid). | [jwt.strategy.ts:31-40](../../../src/auth/strategies/jwt.strategy.ts) |
| `Documents.petId` é **nullable** (`String?`) e `Documents.usuarioId` é **nullable** (`String?`): há documentos **user-level sem pet**. | **Correção (furo v0.4):** a leitura de documento por família só se aplica quando `petId != null`. Documento user-level (`petId === null`) **nunca** concede por família — só dono-direto (`usuarioId === userId`). `assertPodeLerRecursoPorId(documento)` curto-circuita para o check de dono-direto quando `petId` é null (sem chamar a sub-query de família; evita NPE em `findUnique(null)`). Ver [Documentos user-level](#documentos-user-level-petid-null). | [schema.prisma:550-558](../../../prisma/schema.prisma) |
| Rotas de documento: `GET /documents/usuario/:usuarioId`, `GET /documents/pet/:petId`, `GET /documents/:id`. Os arquivos (`DocumentoArquivo`) só são servidos **embutidos** no `GET /documents/:id` (e no allinfos do pet); **não há rota GET autônoma de download/signed-URL de arquivo por id**. As rotas de arquivo existentes são todas mutação (`POST :id/arquivos`, `DELETE :id/arquivos/:arquivoId`, `PATCH :id/arquivos/reordenar`). | **Correção (furo v0.4):** não há leitura autônoma de arquivo a tornar família-aware. A leitura de arquivo acontece **embutida** no `GET /documents/:id`, então segue o documento (mesmo caminho de leitura). **`assertArquivoOwnership` permanece intacto** (só é usado em mutação). Removida a menção solta a "`assertArquivoOwnership` no caminho de leitura". | [documents.controller.ts:112-217](../../../src/documents/documents.controller.ts) |
| `getNivelForTutor` resiliência: callsites engolem exceção (`cupom.service.ts:96` `.catch(()=>0)`) ou chamam direto (`ebook`/`diario`). | Herança via `max()` **deve degradar para nível próprio sem lançar** em falha de família (senão um convidado cairia a 0 silenciosamente). Ver Regra 2 e AC15b. | idem acima |
| `TransformInterceptor` **sempre sobrescreve** `message` com `'Operation successful'` ([transform.interceptor.ts:24-28](../../../src/common/interceptors/transform.interceptor.ts)). | Para mensagens de sucesso do contrato, **ajustar o interceptor** a respeitar `message` custom quando o handler retorna `{ message, data }`. Listado em Arquivos Impactados. | [transform.interceptor.ts:16-31](../../../src/common/interceptors/transform.interceptor.ts) |
| `HttpExceptionFilter` faz `send({ statusCode, timestamp, path, ...error })` onde `error` é o objeto passado à exception. Campos custom ficam **no topo**, NÃO sob `data`. Padrão já usado: `diario-pet.service.ts:354` lança `ForbiddenException({ code, message })`. | Erros de negócio expõem `reason`/`feature` **no topo do JSON** (não sob `data`). O filter **não precisa mudar**. Ver [Forma do erro](#forma-do-erro-de-negócio). | [http-exception.filter.ts:18-25](../../../src/common/filters/http-exception.filter.ts), [diario-pet.service.ts:354](../../../src/diario-pet/diario-pet.service.ts) |
| **`@nestjs/schedule` v6.1.1 ESTÁ no `package.json` (linha 54); `ScheduleModule.forRoot()` já registrado em `app.module.ts:48`; já existem crons**: `inactivation.cron.ts` (`@Cron(EVERY_DAY_AT_3AM)`) e `plano.service.ts:110` (`@Cron('0 3 * * *')`, downgrade Freemium). | **Correção (furo v0.4):** o agendador **já existe** — o cron de carência **não é** "talvez ausente". O cron `varrerCarenciaFamilia` reusa a infra (`@Cron`, janela 03h, mesma do downgrade de Freemium). Removida a hedge "se ausente o catch-up basta"; o cron é **entrega firme**, com o catch-up na leitura como rede de segurança (não como substituto). | [package.json:54](../../../package.json), [app.module.ts:48](../../../src/app.module.ts), [inactivation.cron.ts:9](../../../src/inactivation/inactivation.cron.ts), [plano.service.ts:110](../../../src/plano/plano.service.ts) |
| i18n de **conteúdo** é via `traducoes` Json (`Plano`/`Beneficio`/`Cupom`); mensagens de `HttpException` eram pt-BR hardcoded. **A Parte 0 (D14) entrega o catálogo i18n de erro** (`ERROR_CATALOG`/`LocalizedException`, 4 locales, en-GB explícito, `src/common/errors/error-catalog.ts`). | **Reconciliação D15/Parte 0:** as **mensagens de erro** da Família passam pelo catálogo (chaves novas adicionadas ao `ERROR_CATALOG` em 4 locales, en-GB explícito, sem em-dash). Mensagens de **sucesso** seguem pt-BR no handler (catálogo é de erro). Ver [i18n](#requisitos-não-funcionais). | [locales.ts:8-12](../../../src/common/i18n/locales.ts), [00-fundacao error-catalog](../acesso-compartilhamento-e-parcerias/00-fundacao-papeis-e-codigo.md), [seed.ts:30-107](../../../prisma/seed.ts) |
| `ClinicasEquipe` (dormente): `status StatusConvite` + `@@id([clinicaId, usuarioId])`. | `MembroFamilia` espelha o padrão de membership (chave composta família+usuário). | [schema.prisma:129-141](../../../prisma/schema.prisma) |

---

## Nota crítica: `usuarioId` vs `userId`

O JWT (`jwt.strategy.ts:31-40`) expõe **`req.user.userId`** (que **é** o `Usuario.id`) e `req.user.tutorId`. **Não existe `req.user.usuarioId`** — passar `req.user.usuarioId` resultaria em `undefined` e abriria/fecharia acesso errado (risco de BOLA).

**Convenção desta spec:** os novos métodos do `OwnershipService` recebem o parâmetro chamado **`userId`** (espelhando os asserts existentes e o inline `assertOwnsByUsuarioId`, que usam `userId`). Onde o texto fala "usuário", o valor é sempre `req.user.userId`. O nome de coluna no banco continua `usuarioId` (`MembroFamilia.usuarioId`), mas o valor passado em runtime é `req.user.userId`.

---

## Modelo de Dados (diff Prisma por entidade)

Todas as tabelas são **novas** (aditivas). Os 3 campos novos em `Plano` são **colunas nullable**. Nenhuma coluna existente muda de tipo ou é removida. Backfill: nenhum (zero famílias = comportamento idêntico ao de hoje, D4/D8).

### Enums novos

```prisma
enum FamiliaRole { LIDER  CONVIDADO }
enum SolicitacaoStatus { PENDENTE  APROVADA  RECUSADA }
enum FamiliaStatus { ATIVA  SUSPENSA }
/// CODIGO_CONVIDADO: líder digita o código do convidado (POST /convites).
/// LINK_LIDER: convidado abre o link do líder (POST /convites/:codigo/aceitar).
enum ConviteTipo { CODIGO_CONVIDADO  LINK_LIDER }
```

### `Plano` (3 colunas novas, nullable — aditivas)

```prisma
model Plano {
  // ... campos existentes inalterados ...
  limitePets               Int?
  /// Família: máx de membros incluindo o líder. null => plano sem família. Premium seed=5 (Freemium não, D16).
  familiaMaxMembros        Int?
  /// Família: máx de pets do LÍDER no plano. seed=5.
  familiaMaxPetsLider      Int?
  /// Família: máx de pets de CADA convidado no plano. seed=2 (corrige txt que dizia 3).
  familiaMaxPetsConvidado  Int?
}
```

> **Gating deriva de `familiaMaxMembros != null` no plano efetivo do líder** (configurável, fail-closed), não de hardcode de nível.

### `FamiliaPlano` (novo)

```prisma
model FamiliaPlano {
  id            String          @id @default(cuid())
  liderMembroId String?         @unique
  status        FamiliaStatus   @default(ATIVA)
  suspensaEm    DateTime?
  carenciaAte   DateTime?
  membros       MembroFamilia[]
  pets          FamiliaPet[]
  solicitacoes  SolicitacaoPet[]
  convites      ConviteFamilia[]
  delegacoes    DelegacaoPet[]
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  lider         MembroFamilia?  @relation("FamiliaLider", fields: [liderMembroId], references: [id])
  @@index([status])
  @@index([carenciaAte])
}
```

> Índice em `carenciaAte` adicionado na v0.3 para o cron de varredura da carência (`status = SUSPENSA AND carenciaAte <= now`) ser barato.

### `MembroFamilia` (novo)

```prisma
model MembroFamilia {
  id            String        @id @default(cuid())
  familiaId     String
  familia       FamiliaPlano  @relation(fields: [familiaId], references: [id], onDelete: Cascade)
  usuarioId     String
  usuario       Usuario       @relation(fields: [usuarioId], references: [id])
  tutorId       String
  tutor         Tutor         @relation(fields: [tutorId], references: [id])
  role          FamiliaRole
  entrouEm      DateTime      @default(now())
  pets          FamiliaPet[]
  solicitacoes  SolicitacaoPet[]
  lideraFamilia FamiliaPlano? @relation("FamiliaLider")
  @@unique([familiaId, usuarioId])
  @@index([usuarioId])
  @@index([tutorId])
}
```

> **"1 família ativa por usuário"** via índice único parcial SQL na migration:
> `CREATE UNIQUE INDEX membro_familia_usuario_unico ON "MembroFamilia"("usuarioId");`
> (cada usuário em no máx 1 família; remover membro deleta a linha e libera o usuário).

### `FamiliaPet` (novo)

```prisma
model FamiliaPet {
  id           String        @id @default(cuid())
  familiaId    String
  familia      FamiliaPlano  @relation(fields: [familiaId], references: [id], onDelete: Cascade)
  donoMembroId String
  donoMembro   MembroFamilia @relation(fields: [donoMembroId], references: [id], onDelete: Cascade)
  petId        String
  pet          Pet           @relation(fields: [petId], references: [id], onDelete: Cascade)
  vinculadoEm  DateTime      @default(now())
  @@unique([familiaId, petId])
  @@index([donoMembroId])
  @@index([petId])
}
```

> Remover o vínculo NÃO apaga o `Pet` real.

### `SolicitacaoPet` (novo)

```prisma
model SolicitacaoPet {
  id                    String            @id @default(cuid())
  familiaId             String
  familia               FamiliaPlano      @relation(fields: [familiaId], references: [id], onDelete: Cascade)
  membroId              String
  membro                MembroFamilia     @relation(fields: [membroId], references: [id], onDelete: Cascade)
  petId                 String
  pet                   Pet               @relation(fields: [petId], references: [id], onDelete: Cascade)
  status                SolicitacaoStatus @default(PENDENTE)
  criadaEm              DateTime          @default(now())
  respondidaEm          DateTime?
  respondidaPorMembroId String?
  respondidaPor         MembroFamilia?    @relation("SolicitacaoRespondidaPor", fields: [respondidaPorMembroId], references: [id])
  @@index([familiaId, status])
  @@index([membroId])
}
```

> Unique parcial SQL: `CREATE UNIQUE INDEX solic_pet_pendente_unica ON "SolicitacaoPet"("membroId","petId") WHERE status = 'PENDENTE';`

### `ConviteFamilia` (novo — reusa helper de código da Parte 0)

```prisma
model ConviteFamilia {
  id          String        @id @default(cuid())
  codigo      String        @unique
  tipo        ConviteTipo
  familiaId   String?
  familia     FamiliaPlano? @relation(fields: [familiaId], references: [id], onDelete: Cascade)
  usuarioId   String        // LINK_LIDER => líder; CODIGO_CONVIDADO => convidado
  usuario     Usuario       @relation(fields: [usuarioId], references: [id])
  expiraEm    DateTime
  consumidoEm DateTime?     // single-use; histórico preservado
  createdAt   DateTime      @default(now())
  @@index([usuarioId, tipo])
  @@index([expiraEm])
}
```

> **Reuso de convite (não rotaciona a cada GET):** `GET /familia/convite` deve **reusar** o convite ATIVO não-expirado e não-consumido do mesmo `(usuarioId, tipo)` quando existir, em vez de gerar um novo a cada chamada (ver [Regra 11](#regras-de-negócio) e a Pergunta em Aberto 3). Isso evita invalidar um link já compartilhado no WhatsApp só por reabrir a tela. Unique parcial SQL para garantir no máximo um convite vivo por usuário+tipo:
> `CREATE UNIQUE INDEX convite_familia_ativo_unico ON "ConviteFamilia"("usuarioId","tipo") WHERE "consumidoEm" IS NULL;`

### `DelegacaoPet` (novo — delegação temporária intra-família, D12)

```prisma
model DelegacaoPet {
  id               String        @id @default(cuid())
  familiaId        String
  familia          FamiliaPlano  @relation(fields: [familiaId], references: [id], onDelete: Cascade)
  petId            String
  pet              Pet           @relation(fields: [petId], references: [id], onDelete: Cascade)
  donoMembroId     String        // dono do pet delega (NÃO o líder — D12)
  donoMembro       MembroFamilia @relation("DelegacaoDono", fields: [donoMembroId], references: [id], onDelete: Cascade)
  delegadoMembroId String
  delegadoMembro   MembroFamilia @relation("DelegacaoDelegado", fields: [delegadoMembroId], references: [id], onDelete: Cascade)
  expiraEm         DateTime?     // null = indefinida até revogar
  revogadaEm       DateTime?     // ativa = revogadaEm null && (expiraEm null || expiraEm > now)
  createdAt        DateTime      @default(now())
  @@index([petId, delegadoMembroId])
  @@index([delegadoMembroId])
}
```

### Relações reversas (aditivas)

- `Usuario`: `membrosFamilia MembroFamilia[]`, `convitesFamilia ConviteFamilia[]`.
- `Tutor`: `membrosFamilia MembroFamilia[]`.
- `Pet`: `familiaPets FamiliaPet[]`, `solicitacoesPet SolicitacaoPet[]`, `delegacoes DelegacaoPet[]`.

---

## Escopo de visibilidade (o que entra nesta parte)

A decisão travada do épico (regra de visibilidade) é "todos os membros da família ATIVA leem todos os pets do plano". **Na v0.3 essa regra entra por inteiro** (metadados + prontuário read-only), com auditoria por recurso para não fechar parcial (anti-pattern do CLAUDE.md).

| Camada de leitura | Entra nesta Parte 2? | Como |
|---|---|---|
| Metadados do pet (nome, espécie, foto, dono) via snapshot `GET /familia` | **Sim** | Snapshot computa via query de família; mapper allow-list. |
| Lista de pets vinculáveis (`pets-disponiveis`) | **Sim** (só do próprio tutor) | — |
| Infra `assertPodeLerRecursoDoPet`/`assertPodeLerPetInline`/`assertPetCreateAccess` no `OwnershipService` | **Sim** (aditiva) | Métodos novos; zero famílias = idêntico ao atual. |
| **Prontuário read-only dos pets do plano** (list + detalhe de vacina/consulta/diário/medicamento/peso/documento/diagnóstico/alergia/tratamento-fixo) honrando família | **Sim** | Troca o caminho de leitura de cada recurso para `assertPodeLerRecursoDoPet`. `security-auditor` + AC de regressão **por recurso**. |
| **Detalhe do pet** (`GET /pet/:id`, `GET /pet/allinfos/:id`) honrando família | **Sim** (com redação de PII no allinfos) | Usa `assertPodeLerPetInline` (forma inline, não re-busca o pet). `/pet/allinfos` redige `email`/`telefone` do dono quando o leitor não é o dono. Ver [Vazamento de PII](#vazamento-de-pii-em-petallinfos-por-família). |
| **Mutação** (POST/PATCH/PUT/DELETE de prontuário) por outro membro | **Não** | Continua exigindo dono (ou delegação create-only). `assert<Recurso>Ownership` inalterado nesses caminhos. |

### Rotas de leitura de prontuário tocadas (cobertura completa — Delta 1)

Cada recurso de prontuário tem **dois** caminhos de leitura: a list (`@Get()` com `petId` via query, hoje validada por `assertPetOwnership(petId,...)` no service) e o detalhe (`@Get(':id')`, hoje validado pelo `assert<Recurso>Ownership(id,...)`). **Ambos** trocam para o caminho de leitura família-aware. O **detalhe do pet** é um caso à parte (ownership inline; ver nota abaixo da tabela).

| Recurso | List (petId) | Detalhe (id) | Service ownership atual | Passa por `security-auditor` |
|---|---|---|---|---|
| Vacina | `GET /vacina?petId=` ([vacina.controller.ts:46](../../../src/vacina/vacina.controller.ts)) | `GET /vacina/:id` ([vacina.controller.ts:65](../../../src/vacina/vacina.controller.ts)) | `assertPetOwnership` (list) / `assertVacinaOwnership` (detalhe) | Sim |
| Consulta | `GET /consulta?petId=` ([consulta.controller.ts:45](../../../src/consulta/consulta.controller.ts)) | `GET /consulta/:id` ([consulta.controller.ts:56](../../../src/consulta/consulta.controller.ts)) | `assertPetOwnership` / `assertConsultaOwnership` | Sim |
| Diário | `GET /diario-pet?petId=` ([diario-pet.controller.ts:56](../../../src/diario-pet/diario-pet.controller.ts), `findAll` em [diario-pet.service.ts:88](../../../src/diario-pet/diario-pet.service.ts)) | `GET /diario-pet/:id` ([diario-pet.controller.ts:95](../../../src/diario-pet/diario-pet.controller.ts)) | `assertPetOwnership` / `assertDiarioPetOwnership` | Sim |
| Medicamento | `GET /medicamento?petId=` ([medicamento.controller.ts:47](../../../src/medicamento/medicamento.controller.ts)) | `GET /medicamento/:id` ([medicamento.controller.ts:66](../../../src/medicamento/medicamento.controller.ts)) | `assertPetOwnership` / `assertMedicamentoOwnership` | Sim |
| Peso | `GET /peso-registro?petId=` ([peso-registro.controller.ts:45](../../../src/peso-registro/peso-registro.controller.ts)) | `GET /peso-registro/:id` ([peso-registro.controller.ts:56](../../../src/peso-registro/peso-registro.controller.ts)) | `assertPetOwnership` / `assertPesoOwnership` | Sim |
| Documento | `GET /documents/pet/:petId` ([documents.controller.ts:123](../../../src/documents/documents.controller.ts)) | `GET /documents/:id` ([documents.controller.ts:129](../../../src/documents/documents.controller.ts)) | (via `petId`) `assertPetOwnership` / `assertDocumentOwnership` | Sim |
| Diagnóstico | `GET /diagnostico?petId=` ([diagnostico.controller.ts:38](../../../src/diagnostico/diagnostico.controller.ts)) | `GET /diagnostico/:id` ([diagnostico.controller.ts:51](../../../src/diagnostico/diagnostico.controller.ts)) | `assertPetOwnership` / `assertDiagnosticoOwnership` | Sim |
| Alergia | `GET /alergia?petId=` ([alergia.controller.ts:38](../../../src/alergia/alergia.controller.ts)) | `GET /alergia/:id` ([alergia.controller.ts:51](../../../src/alergia/alergia.controller.ts)) | `assertPetOwnership` / `assertAlergiaOwnership` | Sim |
| Tratamento fixo | `GET /tratamento-fixo?petId=` ([tratamento-fixo.controller.ts:43](../../../src/tratamento-fixo/tratamento-fixo.controller.ts)) | `GET /tratamento-fixo/:id` ([tratamento-fixo.controller.ts:56](../../../src/tratamento-fixo/tratamento-fixo.controller.ts)) | `assertPetOwnership` / `assertTratamentoFixoOwnership` | Sim |
| Pet (detalhe) | `GET /pet/byTutorId/:id` ([pet.controller.ts:30](../../../src/pet/pet.controller.ts)) — **não toca** (lista por tutorId do próprio, não por família) | `GET /pet/:id`, `GET /pet/allinfos/:id` ([pet.controller.ts:40,35](../../../src/pet/pet.controller.ts)) | **ownership inline** (`findUnique` + `assertOwnsByUsuarioId`, NÃO `assertPetOwnership`) | Sim |

> **Pet detalhe é diferente dos demais (correção v0.4):** `GET /pet/:id` e `GET /pet/allinfos/:id` **não** chamam `assertPetOwnership`; fazem `prisma.pet.findUnique` inline (query única, intencional) e validam com `assertOwnsByUsuarioId(pet.tutor?.usuarioId,...)`. **Não trocamos por `assertPodeLerRecursoDoPet`** (re-buscaria o pet). Usamos `assertPodeLerPetInline(petId, ownerUsuarioId, userId, isAdmin)`: recebe o `ownerUsuarioId` já carregado, retorna ok se dono/admin, e só dispara a sub-query de família quando o dono não bate. Além disso, `/pet/allinfos/:id` carrega `tutor.usuario.{nome,email,telefone}` — quando o leitor é membro de família (não o dono), **email/telefone do dono são redigidos** (ver [Vazamento de PII](#vazamento-de-pii-em-petallinfos-por-família)).

> **Recorte explícito do que NÃO entra:** `GET /pet/byTutorId/:id` lista os pets **de um tutorId** (o próprio); não é leitura "do pet alheio por família" e por isso **não troca** (continua restrito ao dono). A leitura por família entra no detalhe do pet (`GET /pet/:id` e `/pet/allinfos/:id`) e em todos os recursos de prontuário acima. **Arquivos de documento (`DocumentoArquivo`) só são servidos embutidos em `GET /documents/:id`** (não há rota GET autônoma de download/signed-URL de arquivo por id; as rotas de arquivo são todas mutação). Logo a leitura de arquivo segue o documento: se o membro lê o documento por família, lê os arquivos embutidos pelo mesmo caminho. **`assertArquivoOwnership` permanece intacto** (só usado em mutação) — a v0.4 remove a menção solta a ele no caminho de leitura.

> Consequência consciente: nesta parte, um membro da família ATIVA **lê** (read-only) o prontuário completo dos pets do plano, mas **não muta** nada de pet alheio (salvo delegação create-only). A v0.3/v0.4 entrega a regra de visibilidade por inteiro, com `security-auditor` por recurso.

### Vazamento de PII em `/pet/allinfos` por família

> **Furo de PII corrigido na v0.4.** `pet.service.findOneWithAllInformation` ([pet.service.ts:170-172](../../../src/pet/pet.service.ts)) inclui `tutor.usuario.{nome,email,telefone}` no retorno. Hoje isso é inócuo (só o dono lê). Ao abrir `/pet/allinfos/:id` por família (Delta 1), um membro convidado passaria a receber **email e telefone do tutor dono** — contradizendo o requisito de privacidade desta spec.

**Decisão:** ao conceder a leitura por família em `/pet/allinfos`, o service **redige PII de contato do dono** quando o leitor não é o dono. Implementação no `pet.service`: depois do `assertPodeLerPetInline`, se `pet.tutor?.usuarioId !== userId && !isAdmin` (leitor é membro de família, não o dono), o retorno **omite/zera `email` e `telefone`** do dono (mantém `nome`, que já aparece no snapshot allow-list de membros). `nome` é mantido porque o snapshot da família já o expõe entre membros; `email`/`telefone` são contato e ficam fora. Mutação não muda.

> **AC dedicado (regressão de PII):** convidado lê `/pet/allinfos/:id` de pet alheio (família ATIVA) → 200 **sem `email` nem `telefone` do dono** no payload (AC40k). O dono lendo o próprio pet continua recebendo tudo (sem regressão).

---

## Documentos user-level (`petId` null)

> **Furo de NPE/branch corrigido na v0.4.** `Documents.petId` é nullable — há documentos do usuário sem pet. `assertPodeLerRecursoDoPet` exige `petId` (faz `pet.findUnique`). Sem tratamento, um documento user-level cairia em `findUnique(null)` (NPE) ou num branch de família indevido.

**Regra:** para documento (e qualquer recurso) com `petId === null`, a **leitura por família NÃO se aplica** (sem pet, sem família). Só o **dono-direto** (`documento.usuarioId === userId`) — ou admin — concede. `assertPodeLerRecursoPorId(documento, id, userId, isAdmin)` resolve o `petId` do documento; se `petId === null`, **curto-circuita** para o check de dono-direto (`usuarioId === userId` OU admin) **sem chamar a sub-query de família**. `GET /documents/pet/:petId` lista apenas documentos com aquele `petId` (não-null por construção), então o risco real é o detalhe por id.

> **Dono-direto vale para os dois casos (correção):** o ramo `documento.usuarioId === userId` concede **sempre** — `petId` null OU não-null. Isso preserva o caminho que `assertDocumentOwnership` já honra hoje ([ownership.service.ts:272-290](../../../src/auth/services/ownership.service.ts): dono via `usuarioId` direto OU via `pet.tutor`): ao trocar o detalhe para `assertPodeLerRecursoPorId`, o leitor que abre **o próprio documento user-level** (`usuarioId === userId`, `petId` null) **continua recebendo 200** (não pode regredir para 403). A família só nega o documento user-level **de outro** membro.

> **ACs dedicados:** (AC40l) membro de família tenta ler documento user-level (sem pet) **de outro membro** via `GET /documents/:id` → 403 (família não concede a documento sem pet); (AC40l2 — novo) o leitor abre **o próprio** documento user-level (`usuarioId === userId`, `petId` null) → **200** (dono-direto preservado, sem regressão do `assertDocumentOwnership` atual).

---

## Mudança de comportamento global (herança de nível)

> Esta seção reconcilia a herança com D8 ("nenhum endpoint atual muda de forma"). A herança `max()` em `getNivelForTutor` **é uma mudança de comportamento global intencional**, não isolada à Família.

`getNivelForTutor` alimenta **cupom** (`whereDisponivel` filtra por `planoMinimoNivel <= nivel`), **ebook** (`temAcesso`) e **diário-pet** (gating de escrita Premium). Ao introduzir `max(próprio, herdado)`:

- Um convidado de família ATIVA (sem assinatura própria) passa a ver **cupons de `planoMinimoNivel <= 2`** e **ebooks de `plano.nivel <= 2`**, **fora da tela Família**. **Isso é intencional** (D10: convidado herda Pro vale em todo o produto, não só na Família). Está declarado aqui como mudança de comportamento e coberto por AC (AC12c/AC12d).
- **Diário-pet NÃO é afetado para o convidado (correção v0.4):** o gating do diário é `REQUIRED_NIVEL = 3` ([diario-pet.service.ts:20](../../../src/diario-pet/diario-pet.service.ts)) e **só de escrita** (leitura sempre liberada ao dono). O convidado herda **Pro=2 < 3**, logo a herança **não desbloqueia o diário** dele; e o gating de escrita do diário só se aplica ao próprio dono escrevendo no próprio pet, que herança nenhuma muda. Portanto o diário **não entra na lista de expansões de acesso do convidado** — permanece apenas como callsite a **confirmar que não quebra** (Task 20), não como ganho esperado.
- `getSubscriptionInfoForTutor` (consumido pela home/CMS) **continua lendo `plano.nivel` da subscription direta** e **não aplica `max()`**. Logo "nível efetivo" (gating) e "subscription real" (exibição) **divergem de propósito**: a home/CMS mostra o plano que o usuário paga; o gating respeita o herdado. **Decisão:** não alterar `getSubscriptionInfoForTutor` nesta parte (manter a home mostrando a assinatura real). Documentar a divergência para o suporte/CMS (ver Perguntas em Aberto 5).

**Reconciliação com D8:** D8 fala em "forma de endpoint" (contrato/shape de request/response). Nenhum shape muda. O que muda é o **conteúdo** retornado por cupom/ebook para convidados de família — efeito de dado, não de contrato. Também muda o **conteúdo** das rotas de leitura de prontuário (um membro de família passa a receber 200 + dados onde antes recebia 403), o que é a entrega central da Parte 2 (Delta 1) e está coberto por AC de regressão por recurso. **Nuance de "consumidores opt-in" (furo v0.4):** o `petjourney-app` passa a **receber prontuário de pet alheio nas MESMAS rotas existentes** sem mudança de shape — mas é mudança de **semântica observável** (um `200 + dados` onde antes era `403`). Um cliente antigo que use "403 = não é meu pet" como sinal de UI pode renderizar errado. Por isso o app é listado como **consumidor cujo comportamento muda** (não só "ganha rotas") e há uma decisão de rollout em aberto sobre feature flag (ver Perguntas em Aberto 9). Registrado explicitamente para o revisor não tratar como regressão silenciosa.

---

## Contrato dos Endpoints

Base `/tutor/familia`. **Todas autenticadas** (JWT global). Envelope de sucesso `{ statusCode, message, data }` (com `message` custom respeitada pelo interceptor ajustado). Guards: **JWT** (autenticado); **GATING** = `FamiliaGatingGuard` (403 `FEATURE_NOT_INCLUDED` se plano efetivo não habilita); **MEMBRO** (membro da família); **LIDER** (`viewer.isLider`).

### 2.1 `GET /tutor/familia` — snapshot
- **Guard:** JWT + GATING(soft). Premium sem família → estado vazio com ele como líder potencial (não persiste). Não-membro com plano sem família → 403.
- **200:** snapshot completo (ver Forma do snapshot). **Erros:** 401; 403 `FEATURE_NOT_INCLUDED`.

### 2.2 `GET /tutor/familia/convite` — código + link do usuário atual
- **Guard:** JWT. **Reusa** o `ConviteFamilia` ATIVO não-expirado não-consumido do `(usuarioId, tipo)` se houver; senão gera um novo via helper Parte 0 (`expiraEm = now + FAMILIA_CONVITE_TTL_DIAS`, default 30d). **Não rotaciona/invalida** o convite existente só por reabrir a tela. Líder elegível → `LINK_LIDER`; usuário comum → `CODIGO_CONVIDADO`.
- **200:** `{ codigo, link, tipo, expiraEm }`, `link = "${FAMILIA_INVITE_BASE_URL}/familia/convite/${codigo}"`. **Erros:** 401; 429 (rate-limit helper).

### 2.3 `POST /tutor/familia/convites` — convidar por código (líder digita)
- **Guard:** JWT + GATING + LIDER + **THROTTLE-POR-CÓDIGO** (`@Throttle(PUBLIC_CODE_THROTTLE)` com `generateKey` chaveado pelo `body.codigo` — ver [Defesa por código](#defesa-por-código-d15)). **Payload:** `{ codigo }` (`@Matches(/^\d{6}$/)`).
- Resolve `CODIGO_CONVIDADO` ativo (via `resolveAtivoOrThrow`) → identifica convidado → lazy-create `FamiliaPlano` do líder → adiciona `CONVIDADO`. Marca consumido (`CODIGO_CONVIDADO` é single-use). Transação.
- **201:** `"Usuário convidado com sucesso."` + snapshot. **Erros:** 401; 403 (não-líder/plano); 404 `INVITE_NOT_FOUND` (genérico); 409 `FAMILY_FULL` / `ALREADY_MEMBER` / `ALREADY_IN_ANOTHER_FAMILY` / `CANNOT_INVITE_SELF`; 429 (brute-force por código); 400.

### 2.4 `POST /tutor/familia/convites/:codigo/aceitar` — aceitar por link (convidado abre)
- **Guard:** JWT (sem GATING — convidado herda Pro) + **THROTTLE-POR-CÓDIGO** (`@Throttle(PUBLIC_CODE_THROTTLE)` com `generateKey` chaveado pelo `:codigo` da rota — ver [Defesa por código](#defesa-por-código-d15)). Resolve `LINK_LIDER` ativo (via `resolveAtivoOrThrow`) → valida vaga (contagem **dentro da transação**, ver [Regra 6b](#regras-de-negócio)) → adiciona o **usuário autenticado** como `CONVIDADO`. `LINK_LIDER` é **multi-uso** (não marca `consumidoEm`; vive até `expiraEm`). Transação.
- **200:** `"Você entrou no plano familiar."` + snapshot. **Erros:** 401; 404 `INVITE_NOT_FOUND`; 409 `FAMILY_FULL`/`ALREADY_MEMBER`/`ALREADY_IN_ANOTHER_FAMILY`/`CANNOT_INVITE_SELF`; 403 `LEADER_NOT_PREMIUM` (família suspensa fora da carência); 429 (brute-force por código).

### 2.5 `POST /tutor/familia/pets` — adicionar pet
- **Guard:** JWT + GATING + MEMBRO. **Payload:** `{ petId }`.
- Valida pet do tutor (BOLA via `assertPetOwnership`). Líder → `FamiliaPet` direto. Convidado → `SolicitacaoPet` PENDENTE. Limite = vinculados + pendentes.
- **201 (líder):** `"Pet adicionado ao plano."`. **202 (convidado):** `"Solicitação enviada para aprovação."`. **Erros:** 401; 403; 404 `PET_NOT_FOUND` (pet inexistente) / 403 (pet de outro tutor); 409 `PET_ALREADY_LINKED`/`PET_REQUEST_PENDING`/`PET_LIMIT_REACHED`; 400.

### 2.6 `GET /tutor/familia/pets-disponiveis`
- **Guard:** JWT + GATING + MEMBRO. Lista pets `ativo=true` do tutor não vinculados e sem solicitação pendente dele.
- **200:** `PetDisponivel[]` (`{ id, nome, especie, foto }`). **Erros:** 401; 403.

### 2.7 `PATCH /tutor/familia/solicitacoes/:id/aprovar`
- **Guard:** JWT + GATING + LIDER. BOLA por família. Precisa PENDENTE. Revalida limite. **Algoritmo idempotente explícito** (ver [Regra 6](#regras-de-negócio)): dentro da transação, se já existe `FamiliaPet(familiaId, petId)` do **mesmo dono**, marca `APROVADA`/`respondidaEm`/`respondidaPorMembroId` e retorna 200 **sem recriar** o `FamiliaPet` (não confiar em catch de P2002); se existe com dono diferente → 409 `PET_ALREADY_LINKED`; senão cria `FamiliaPet` + marca `APROVADA`.
- **200:** `"Solicitação aprovada."`. **Erros:** 401; 403; 404 `REQUEST_NOT_FOUND`; 409 `REQUEST_NOT_PENDING`/`PET_LIMIT_REACHED`/`PET_ALREADY_LINKED`.

### 2.8 `PATCH /tutor/familia/solicitacoes/:id/recusar`
- **Guard:** JWT + GATING + LIDER. BOLA por família. PENDENTE. `status=RECUSADA`. **200:** `"Solicitação recusada."`. **Erros:** 401; 403; 404 `REQUEST_NOT_FOUND`; 409 `REQUEST_NOT_PENDING`.

### 2.9 `DELETE /tutor/familia/pets/:petId` — remover pet do plano
- **Guard:** JWT + GATING + MEMBRO. Líder remove qualquer; convidado só `donoMembroId === viewer`. Na **mesma transação**: revoga/deleta **todas** as `DelegacaoPet` daquele `petId` (não há cascade via `FamiliaPet`; preferir `revogadaEm=now` para histórico — ver [Regra 7](#regras-de-negócio)) + `SolicitacaoPet` PENDENTE do pet + o `FamiliaPet`. **Não apaga `Pet` real.**
- **200 (com snapshot atualizado):** `"Pet removido do plano."`. **Erros:** 401; 403; 404 `FAMILY_PET_NOT_FOUND`.

### 2.10 `DELETE /tutor/familia/membros/:membroId` — remover membro convidado
- **Guard:** JWT + GATING + LIDER. BOLA por família. Líder não removível. Deleta `MembroFamilia`; **`FamiliaPet`/`SolicitacaoPet`/`DelegacaoPet` (dono e delegado) saem por `onDelete: Cascade`** (não delete manual — ver [Regra 8](#regras-de-negócio)). Pro herdado cai na próxima leitura. Pets reais preservados.
- **200 (com snapshot atualizado):** `"Membro removido do plano."`. **Erros:** 401; 403; 404 `MEMBER_NOT_FOUND`; 409 `CANNOT_REMOVE_LEADER`.

### 2.11 `POST /tutor/familia/pets/:petId/delegacoes` — delegar (create-only, D12)
- **Guard:** JWT + GATING + MEMBRO. **Dono do pet delega** (não líder). **Payload:** `{ delegadoMembroId, duracaoHoras?: 24|72|168|336, indefinida?: boolean }`.
- BOLA: pet do tutor (`assertPetOwnership`) + vinculado à família; delegado é membro != dono. Cria `DelegacaoPet`. Concede create-only em diário/medicamento/vacina/peso/documento.
- **201:** `"Acesso temporário concedido."`. **Erros:** 401; 403; 404 `FAMILY_PET_NOT_FOUND`/`MEMBER_NOT_FOUND`; 409 `DELEGATION_TO_SELF`/`DELEGATION_ALREADY_ACTIVE`; 400.

### 2.12 `DELETE /tutor/familia/pets/:petId/delegacoes/:delegacaoId` — revogar
- **Guard:** JWT + GATING + MEMBRO. Dono ou líder. Marca `revogadaEm`. **200 (com snapshot atualizado):** `"Acesso temporário revogado."`. **Erros:** 401; 403; 404 `DELEGATION_NOT_FOUND`.

> **Desvio consciente de REST (204 → 200):** os `DELETE` (2.9, 2.10, 2.12) retornam **200 com snapshot** em vez de 204 sem corpo. Contradiz a tabela de convenções do repo (`api-conventions.md`: DELETE → 204), mas é deliberado: o contrato do front (txt seção 9, "toda mutação retorna o snapshot") quer o estado atualizado para substituir localmente sem refetch. Justificativa registrada em [Considerações de Arquitetura](#considerações-de-arquitetura).
>
> **Nota técnica (NestJS+Fastify):** essas três rotas `DELETE` devem ter **`@HttpCode(200)` explícito** no handler (não confiar no default implícito) e o handler retorna `{ message, data: snapshot }` para o `TransformInterceptor` ajustado envelopar com a `message` custom. O default do Nest para `DELETE` é 200 (não 204), mas declarar `@HttpCode(200)` explícito remove ambiguidade e garante que o interceptor com `message` custom não colida com um 204 sem corpo. **AC de shape do DELETE (AC44 — novo):** cada `DELETE` (2.9/2.10/2.12) retorna **200** com corpo `{ statusCode: 200, message: <custom>, data: <snapshot> }` (não 204, não corpo vazio). Coberto pelo `transform.interceptor.spec.ts` (já listado).

> **Rotas de prontuário (Delta 1) não vivem sob `/tutor/familia`:** a leitura por família é entregue **dentro dos controllers de prontuário existentes** (vacina, consulta, etc.), trocando a checagem de ownership no caminho de leitura. Não há rota nova de prontuário; o contrato/shape das rotas de leitura existentes **não muda** (D8) — só o conjunto de quem recebe 200 vs 403. Ver [Escopo de visibilidade](#escopo-de-visibilidade-o-que-entra-nesta-parte) e [Autorização / BOLA](#autorização--bola-por-rota).

### Defesa por código (D15)

> **Requisito firme de D15 (não opcional).** As rotas que resolvem um código/link de 6 dígitos (`POST /convites` resolvendo `CODIGO_CONVIDADO`, `POST /convites/:codigo/aceitar` resolvendo `LINK_LIDER`) são superfícies de **brute-force por código** (espaço 10^6). A Parte 0 entrega **só a defesa por IP** (`PUBLIC_CODE_THROTTLE` por `req.ip` com `trustProxy`) e **empurra explicitamente a defesa por código para a parte consumidora** (00-fundacao Regra 14 / Furo 11 / Regra 23: "o balde por código NÃO é entregue nesta parte — é da parte consumidora; cada parte que consome deve entregar no DoD"). D15 reforça: o throttler atual é **in-memory (não cross-instância no Railway)**, então o requisito é **Redis no throttler OU lockout por código** nas rotas públicas por código.

**Entrega desta parte (lockout por código, sem depender de Redis):** as duas rotas acima recebem um **balde de throttle nomeado por código alvo**, espelhando o shape sugerido em 00-fundacao Furo 11:

```ts
// generateKey chaveia pelo CÓDIGO (não pelo IP), limitando N tentativas
// por código-alvo independente de IP — fecha o brute-force distribuído.
@Throttle({
  default: {
    limit: 10, ttl: 60_000,
    generateKey: (ctx) => {
      const req = ctx.switchToHttp().getRequest();
      const codigo = req.params?.codigo ?? req.body?.codigo ?? 'sem-codigo';
      return `familia-convite:${codigo}`;
    },
  },
})
```

- **Por que por código e não só por IP:** um atacante com muitos IPs distribui o brute-force e fura o balde por IP; o balde por código limita tentativas **por código-alvo**, independente de IP (defesa em profundidade, Furo 11).
- **Cross-instância:** se/quando o throttler migrar para storage Redis (decisão de infra, fora desta parte), o balde por código passa a ser cross-instância automaticamente. Até lá, o lockout por código **in-process** já eleva o custo do brute-force e é o que D15 exige no mínimo desta parte. Se o produto preferir Redis-first, o balde por código continua válido (não conflita).
- **404 genérico preservado:** tentativas inválidas continuam recebendo 404 `INVITE_NOT_FOUND` (via `resolveAtivoOrThrow`); ao estourar o balde, **429** (forma padrão do `ThrottlerGuard`).

### Feature flag de rollout (D15)

> **Requisito firme de D15 (não é mais pergunta aberta).** D15 decidiu: *"Rollout da leitura de prontuário por família: atrás de feature flag (`FAMILIA_LEITURA_PRONTUARIO`) até o app validar telas com pets compartilhados."* A troca de leitura (Delta 1) faz rotas existentes retornarem `200 + dados` de pet alheio onde antes era `403` — **mudança de semântica observável** sem opt-in de versão do cliente. Por isso a abertura por família **nasce atrás da flag**.

- **`FAMILIA_LEITURA_PRONTUARIO` (env, boolean): default `off` em produção.** Com a flag **off**, `assertPodeLerRecursoDoPet`/`assertPodeLerPetInline`/`assertPodeLerRecursoPorId` **não avaliam o ramo de família** (comportam-se como o ownership dono-only de hoje; ramos de admin/dono/delegação continuam). Com a flag **on**, o ramo de família (janela `ATIVA` OU `SUSPENSA && now < carenciaAte`) passa a conceder leitura.
- **A delegação (D12) NÃO é gated pela flag:** a flag controla só a leitura **por família** (Delta 1). O create-only por delegação (`assertPetCreateAccess`) e a leitura por delegação são acesso explícito concedido pelo dono, não a abertura em massa de prontuário — seguem ligados independentemente da flag.
- **Snapshot e rotas `/tutor/familia` NÃO são gated pela flag:** a flag é só sobre a **leitura de prontuário/pet por família nas rotas existentes** (a parte com mudança de semântica observável). O membership, convites, limites e o snapshot de metadados são feature nova (rotas novas, sem cliente legado) e entram sem flag.
- **Plano:** liga-se a flag em produção **só depois** de `security-auditor` por rota e da validação da tela de prontuário do app contra pets compartilhados. Até lá, a família funciona (convite/membership/limites/herança de Pro/snapshot), mas a leitura cruzada de prontuário fica fechada. Fecha a [Pergunta 9](#perguntas-em-aberto) (referenciando D15).

### Forma do snapshot (`FamiliaPlano` de resposta)

```jsonc
{
  "id": "fam_...", "liderId": "<membroId do líder>", "status": "ATIVA",
  "suspensaEm": null, "carenciaAte": null,
  "viewer": { "membroId": "...", "role": "LIDER", "isLider": true, "podeConvidar": true },
  "limites": { "maxMembros": 5, "maxPetsLider": 5, "maxPetsConvidado": 2 },
  "membros": [{
    "id": "membro_...", "usuarioId": "...", "tutorId": "...", "nome": "...",
    "contato": "...", "foto": null, "role": "LIDER", "entrouEm": "...",
    "pets": [{ "id": "<petId>", "nome": "Rex", "especie": "CACHORRO", "foto": null,
               "donoId": "<membroId>", "donoNome": "Nicolas", "vinculadoEm": "..." }]
  }],
  "solicitacoes": [{ "id": "...", "membroId": "...", "membroNome": "...", "petId": "...",
    "petNome": "...", "petEspecie": "GATO", "petFoto": null, "status": "PENDENTE",
    "criadaEm": "...", "respondidaEm": null, "respondidaPorMembroId": null }],
  "delegacoes": [{ "id": "...", "petId": "...", "donoMembroId": "...",
    "delegadoMembroId": "...", "expiraEm": "...", "ativa": true }],
  "meta": { "totalMembros": 2, "totalPets": 1, "solicitacoesPendentes": 1, "vagasMembrosRestantes": 3 }
}
```

> `especie` no snapshot = mapeamento de `pet.especiePet` (enum `Especie`). Mapper allow-list (espelha `cupom.service.ts mapToResponse`); nunca vaza campos internos/PII de não-membros. `contato` só de membros da própria família. `suspensaEm`/`carenciaAte` expostos no snapshot para o front exibir a contagem de carência quando `status=SUSPENSA` (ver [Regra 9](#regras-de-negócio)).

### Forma do erro de negócio

> Verificado no `HttpExceptionFilter` real ([http-exception.filter.ts:18-25](../../../src/common/filters/http-exception.filter.ts)): ele faz `send({ statusCode, timestamp, path, ...error })`, onde `error` é o objeto passado à exception. **Campos custom ficam no topo do JSON, NÃO sob `data`.** O padrão já existe no repo: `diario-pet.service.ts:354` lança `new ForbiddenException({ code, message })` e o cliente recebe `code` no topo.

Os erros de negócio da Família lançam exceptions carregando `reason`/`feature` no payload custom (o `HttpExceptionFilter` espalha `...error` no topo). **Reconciliação com D15/Parte 0 (catálogo i18n):** a `message` vem do `ERROR_CATALOG` (resolvida pelo locale da request, com en-GB explícito) via `LocalizedException`, que carrega a **chave** em vez da string materializada; o filtro da Parte 0 resolve a chave e remove `errorKey` do payload. As chaves novas de negócio da Família (`FEATURE_NOT_INCLUDED`, `FAMILY_FULL`, `PET_LIMIT_REACHED`, etc.) são **adicionadas ao `ERROR_CATALOG`**:

```ts
// Forma reconciliada (D15/Parte 0): chave de catálogo + payload de negócio.
throw new LocalizedException('FEATURE_NOT_INCLUDED', HttpStatus.FORBIDDEN, {
  reason: 'FEATURE_NOT_INCLUDED',
  feature: 'FAMILIA',
});
// Resposta: { statusCode: 403, timestamp, path, message: <catálogo no locale>, reason: 'FEATURE_NOT_INCLUDED', feature: 'FAMILIA' }
// (sem `errorKey` — o filtro da Parte 0 o remove antes do spread)
```

Forma final da resposta de erro: `{ statusCode, timestamp, path, message, reason, feature? }`. Copy **sem em-dash** em todos os 4 locales do catálogo. Ex. (pt-BR): `"Família sem vagas para novos membros."`, `"Limite de pets do plano atingido."`. `HttpExceptionFilter` **não** entra em Arquivos Impactados (já coberto/estendido pela Parte 0). Se a Parte 0 ainda não estiver merjada no momento da implementação, o fallback temporário é `ForbiddenException({ message, reason, feature })` com copy pt-BR do catálogo, migrando para `LocalizedException` assim que a Parte 0 entrar (não bloqueia, mas o alvo é o catálogo).

> **Nota de copy (furo v0.4):** **as strings de mensagem nos `throw` devem ser revisadas isoladamente contra em-dash.** Esta spec usa em-dash livremente na **prosa descritiva**; esse em-dash **não pode vazar** para as mensagens visíveis ao usuário. AC39 é o gate automatizável (grep por `—` nos arquivos de `src/familia` e nas mensagens novas dos services de prontuário/subscription).

### Códigos de erro (negócio)

| `reason` | HTTP | Quando |
|---|---|---|
| `FEATURE_NOT_INCLUDED` | 403 | Plano efetivo não habilita família e viewer não é membro |
| `LEADER_NOT_PREMIUM` | 403 | Família SUSPENSA (líder perdeu Premium) e fora da carência; não aceita novos membros |
| `NOT_A_MEMBER` | 403 | Rota MEMBRO, viewer fora da família |
| `NOT_LEADER` | 403 | Rota LIDER, viewer não é líder |
| `INVITE_NOT_FOUND` | 404 | Código inválido/expirado/consumido (genérico, anti-enumeração — D2) |
| `PET_NOT_FOUND` | 404 | Pet inexistente (`assertPetOwnership` `NotFoundException`) |
| `OWNERSHIP_FORBIDDEN` (pet de outro tutor) | 403 | `assertPetOwnership`/`deny()` lança `LocalizedException('OWNERSHIP_FORBIDDEN')` (Parte 0; anti-leak; mantém 403, não 404) |
| `REQUEST_NOT_FOUND` | 404 | Solicitação inexistente/de outra família |
| `MEMBER_NOT_FOUND` | 404 | Membro inexistente/de outra família |
| `FAMILY_PET_NOT_FOUND` | 404 | Pet não vinculado à família |
| `DELEGATION_NOT_FOUND` | 404 | Delegação inexistente/de outra família |
| `FAMILY_FULL` | 409 | `maxMembros` atingido |
| `PET_LIMIT_REACHED` | 409 | Limite do papel (vinculados + pendentes) |
| `PET_ALREADY_LINKED` | 409 | Pet já vinculado ao membro (ou a outro dono, na aprovação) |
| `PET_REQUEST_PENDING` | 409 | Solicitação pendente duplicada |
| `ALREADY_MEMBER` | 409 | Já é membro desta família |
| `ALREADY_IN_ANOTHER_FAMILY` | 409 | Já é membro de outra família ativa |
| `CANNOT_INVITE_SELF` | 409 | Convidar/aceitar a si mesmo |
| `CANNOT_REMOVE_LEADER` | 409 | Remover o líder |
| `REQUEST_NOT_PENDING` | 409 | Solicitação já respondida |
| `DELEGATION_TO_SELF` | 409 | Delegar pra si |
| `DELEGATION_ALREADY_ACTIVE` | 409 | Delegação ativa duplicada (mesmo pet/delegado) |
| (rate-limit helper) | 429 | Geração de código abusiva |

> **Erros das rotas de prontuário (Delta 1) não mudam de forma:** continuam lançando 404 (recurso inexistente) e 403 (`deny()` para quem não é dono nem membro da família nem delegado), exatamente como hoje. Não há `reason` novo no prontuário; só o conjunto de quem passa pela checagem aumenta (membro de família ATIVA). Mantém o padrão anti-leak (403 para recurso existente de quem não tem acesso, 404 só para inexistente).

---

## Regras de Negócio

1. **Gating (D10):** habilitado sse `planoEfetivoDoLider.familiaMaxMembros != null`. Só Premium (3) habilita por seed; Freemium (4) NÃO (trial expira, D16), assim como Pro (2)/Básico (1). Fail-closed (`getNivelForTutor(...).catch(() => 0)` no padrão do cupom).
2. **Herança de nível (D5/D11), resiliente:** `getNivelForTutor` retorna `max(nívelPróprio, nívelHerdado)`. Herdado = `2` (Pro) sse o tutor é `CONVIDADO` de família `ATIVA` (ou `SUSPENSA` dentro da carência) com líder nível efetivo `>= 3`. **Nunca herda Premium.** Runtime, sem campo na Subscription, sem cancelar loja. Sem assinatura própria → 2; paga Pro → `max(2,2)=2` (app sugere cancelar na loja); paga Premium → `max(3,2)=3`. **Anti-loop:** nível do líder lido da subscription própria (sem herança recursiva). **Resiliência obrigatória (correção crítica) — escopo preciso:** o `try/catch` interno cobre **apenas a resolução de herança de família** (buscar `MembroFamilia` + subscription do líder + estado da carência). Em qualquer falha dessa sub-resolução (líder inconsistente, timeout Supabase), degrada para o **nível próprio** do tutor e **nunca propaga exceção nem cai para 0 por falha da família**. Razão: os callsites de gating engolem exceção com `.catch(() => 0)` (cupom) ou chamam direto (ebook/diário); se a herança lançasse, um convidado degradaria silenciosamente para nível 0 e perderia todo acesso. Ver AC15b.
   - **O que NÃO muda (reconciliação com o throw pré-existente):** `getNivelForTutor` **hoje lança `NotFoundException('Tutor com ID ... não encontrado')`** quando o tutor não existe ([subscription.service.ts:141-145](../../../src/subscription/subscription.service.ts)), **antes** de qualquer resolução de subscription/família. **Esse comportamento permanece intacto** — "resiliente" aqui significa "a *herança de família* nunca derruba o nível", **não** "o método nunca lança". O caso tutor-inexistente é um erro de chamador (id inválido), não uma falha da família, e continua sendo 404/erro propagado. O `try/catch` interno é colocado **só ao redor do bloco de herança**, depois do guard de tutor-inexistente, nunca o engolindo.
   - **Callsite ebook (sem catch):** `ebook.service.ts:72,98` chama `getNivelForTutor` **sem** `.catch` ([confirmado](../../../src/ebook/ebook.service.ts)), enquanto cupom mascara com `.catch(() => 0)`. Como o throw de tutor-inexistente continua de pé, um `tutorId` inválido chegando ao ebook ainda propagaria 404/500. **Isso é o comportamento atual, não regressão desta parte** — a herança não o introduz nem o piora. Blindar o caminho tutor-inexistente do ebook (ex.: `.catch(() => 0)` no ebook) é **decisão de produto separada** movida para [Perguntas em Aberto 10](#perguntas-em-aberto); esta parte **não** altera o contrato de erro do ebook por padrão.
3. **Limites (backend é fonte de verdade, configuráveis):** `maxMembros=5` (líder + 4), `maxPetsLider=5`, `maxPetsConvidado=2` (corrige txt que dizia 3). Pendentes contam vaga.
4. **Visibilidade (entrega completa na v0.3/v0.4) — leitura alinhada à herança de Pro (reconciliação):** todos os membros da família **ATIVA** leem (read-only) **metadados** (via snapshot) **e o prontuário** (vacina, consulta, diário, medicamento, peso, documento, diagnóstico, alergia, tratamento fixo) de todos os pets do plano, **mais o detalhe do pet** (`GET /pet/:id`, `/pet/allinfos/:id` com PII de contato do dono redigida para não-donos). A leitura por família é honrada por `assertPodeLerRecursoDoPet`/`assertPodeLerPetInline` (ver [Autorização / BOLA](#autorização--bola-por-rota)); cada rota de leitura tocada está na tabela de [Escopo de visibilidade](#escopo-de-visibilidade-o-que-entra-nesta-parte) e passa por `security-auditor`.
   - **Condição de concessão por família = `ATIVA` OU (`SUSPENSA` E `now < carenciaAte`)** — **a leitura segue exatamente a mesma janela da herança de Pro** (Regra 2: o convidado mantém Pro durante a carência). Era incoerente conceder Pro na carência mas cortar a leitura no instante da suspensão; a v0.5 alinha os dois. Racional: a carência existe justamente para **não rebaixar nada** enquanto o líder atrasa renovação/há lag de webhook — então o membro continua Pro **e** continua lendo o prontuário dos pets do plano durante a carência.
   - **Família SUSPENSA FORA da carência (`now >= carenciaAte`) não concede leitura por família** (membro só lê os próprios pets). É o mesmo instante em que a herança de Pro deixa de conceder (pós-carência). Assim leitura e nível efetivo caem juntos, nunca em momentos diferentes.
   - `assertPodeLerRecursoDoPet`/`assertPodeLerPetInline` implementam a condição `ATIVA OU (SUSPENSA && now < carenciaAte)` (não `FamiliaStatus.ATIVA` puro). **Documento user-level (`petId` null) nunca concede por família.** **Mutação só do dono**, salvo delegação create-only.
5. **Adicionar pet:** líder direto; convidado solicitação PENDENTE. Limite checado antes de gravar nos dois caminhos.
6. **Aprovar/recusar (algoritmo idempotente explícito):** só líder; aprovar revalida limite. **Idempotência não pode depender de catch de P2002** (o `@@unique([familiaId, petId])` lançaria 409, contradizendo o 200 idempotente prometido). Dentro da transação: (a) buscar `FamiliaPet(familiaId, petId)`; (b) se existe e `donoMembroId === membro da solicitação` → marcar `APROVADA`/`respondidaEm`/`respondidaPorMembroId`, retornar 200 sem recriar; (c) se existe com outro dono → 409 `PET_ALREADY_LINKED`; (d) se não existe → revalidar limite, criar `FamiliaPet`, marcar `APROVADA`.
6b. **Corrida de vaga e de limite (revalidação transacional obrigatória):** todo caminho que cria `MembroFamilia` (aceite por link/código) ou `FamiliaPet` (add direto do líder 2.5, aprovar 2.7) **conta o invariante DENTRO da mesma transação, imediatamente antes do insert**, não antes de abrir a transação. Razão: sob aceites/adições simultâneos com 1 vaga restante, ambos passariam um check feito fora da transação e estourariam `maxMembros`/limite de pets.
    - **Vaga de membro:** dentro da transação, `count(MembroFamilia where familiaId)` e comparar com `maxMembros` antes do insert; sob corrida, o 2º aceite recebe **409 `FAMILY_FULL`**. O `LINK_LIDER` é multi-uso (Regra 11), então a vaga é o único freio — por isso a contagem precisa estar na transação.
    - **Limite de pets do papel:** dentro da transação, `count(FamiliaPet do dono) + count(SolicitacaoPet PENDENTE do dono)` e comparar com `maxPetsLider`/`maxPetsConvidado` antes do insert; sob corrida de duas adições no mesmo limite, exatamente uma passa, a outra recebe **409 `PET_LIMIT_REACHED`**.
    - **Reforço de banco:** o índice `@@unique([familiaId, usuarioId])` (e `@@unique([familiaId, petId])`) garante que a corrida nunca duplica linha; a contagem transacional garante que a corrida nunca estoura o **limite numérico** (que o unique não cobre). Os dois juntos fecham a corrida sem lock pessimista explícito; sob isolamento padrão do Postgres a revalidação na transação é suficiente para o volume desta feature.
7. **Remover pet do plano (limpeza atômica de delegações — sem cascade via `FamiliaPet`):** líder remove qualquer; convidado só os próprios. **`DelegacaoPet` NÃO tem `onDelete: Cascade` via `FamiliaPet`** (só via `FamiliaPlano`/`MembroFamilia`/`Pet`), então remover o `FamiliaPet` **não** limpa as delegações automaticamente. Por isso a transação de `DELETE /familia/pets/:petId` (2.9) **deleta/revoga atomicamente, no mesmo `$transaction`, TODAS as `DelegacaoPet` daquele `petId`** (preferir `revogadaEm = now` a delete físico, para preservar histórico) + as `SolicitacaoPet` PENDENTE do pet + o `FamiliaPet`. Sem isso, um pet fora do plano poderia manter uma delegação ativa concedendo create-only (`assertPetCreateAccess` checa `DelegacaoPet` por `petId`, não por `FamiliaPet`). Nunca apaga `Pet` real (só `FamiliaPet`/delegações/solicitações). Idempotente (pet já fora → 404 `FAMILY_PET_NOT_FOUND`).
8. **Remover membro (cascade do schema é a fonte de limpeza, não delete manual):** só líder, só convidados; líder não removível. **A remoção deleta a linha `MembroFamilia` e confia no `onDelete: Cascade` já modelado** — `FamiliaPet`, `SolicitacaoPet` e `DelegacaoPet` (relações `DelegacaoDono`/`DelegacaoDelegado`) apontam para `MembroFamilia` com `onDelete: Cascade`, então deletar o membro **remove em cascata** seus pets-vínculo, solicitações e delegações (como dono **e** como delegado). **Não duplicar deletes manuais** desses registros dentro da transação (o delete manual mascararia ordem/idempotência e seria redundante com o cascade). A transação faz: deletar `MembroFamilia` (o cascade cuida do resto) + qualquer reconciliação de snapshot. Idempotente (membro já removido → 404 `MEMBER_NOT_FOUND`). Pro herdado do removido cai na próxima leitura/resolução de herança (a herança resolve membership em runtime — sem o `MembroFamilia`, não há herança). Pets reais (`Pet`) preservados (só `FamiliaPet` some).
   - **Acesso em voo:** como a leitura por família (`assertPodeLerRecursoDoPet`) e o create por delegação (`assertPetCreateAccess`) **resolvem membership/delegação em runtime a cada chamada**, no instante em que o `MembroFamilia` (e suas delegações em cascata) deixa de existir, **qualquer leitura ou create subsequente do removido sobre pets do plano deixa de ser concedido imediatamente** — não há janela de acesso residual. Operações já commitadas antes da remoção permanecem (não há rollback de escrita passada); o que muda é o acesso futuro.
9. **Queda do líder — modelo de suspensão com carência (runtime-driven + cron de catch-up, Delta 2):**
   - **Detecção e suspensão (lazy-write em DOIS gatilhos + cron):** o status efetivo é **computado em runtime**, espelhando o catch-up de Freemium em `getSubscriptionInfoForTutor` (lazy-write na leitura). Quando o líder está com nível efetivo `< 3`, a **primeira resolução que detecta a queda** persiste idempotentemente `status=SUSPENSA` + `suspensaEm = now` + `carenciaAte = suspensaEm + FAMILIA_CARENCIA_DIAS` (default **7d**). A escrita é idempotente: se já está `SUSPENSA` com `suspensaEm` setado, não reescreve. **Quem detecta/escreve (gatilho garantido, correção):**
     - **(i) `GET /familia`** (líder ou convidado abre a tela): escreve a suspensão.
     - **(ii) `getNivelHerdadoFamilia` (resolução de herança):** **também escreve a suspensão** ao detectar líder `< 3` numa família `ATIVA`. Isso é o gatilho que cobre o convidado que **nunca abre a tela Família** mas exerce gating via cupom/ebook (que chamam `getNivelForTutor` → herança). Sem isso, uma família ficaria `ATIVA` indefinidamente com líder `< 3` concedendo Pro até alguém abrir `GET /familia`. Como a herança é chamada toda vez que o convidado exerce gating, a queda é detectada e a carência inicia na primeira leitura de gating do convidado. (A escrita da suspensão dentro da resolução de herança é idempotente e roda dentro do mesmo `try/catch` de resiliência — falha de escrita degrada para a leitura, não derruba o nível.)
     - **(iii) Cron `varrerCarenciaFamilia` (rede de segurança para famílias órfãs de leitura):** além de processar `SUSPENSA AND carenciaAte <= now`, o cron **também varre `status=ATIVA` revalidando o nível efetivo do líder**; se o líder está `< 3`, **inicia a suspensão+carência** (escreve `suspensaEm`/`carenciaAte`). Isso garante que uma família cujo líder caiu mas que **ninguém leu** (nem o líder abre a tela, nem o convidado exerce gating) ainda **entra em carência** de forma determinística, sem depender de leitura. Sem essa varredura de `ATIVA`, a família ficaria `ATIVA` para sempre com líder caído. O custo extra é varrer famílias ATIVA 1x/dia (volume baixo; indexado por `status`).
   - **Durante a carência (`SUSPENSA` e `now < carenciaAte`):** os convidados **mantêm o Pro herdado** (a herança ainda concede Pro de família `SUSPENSA` enquanto `now < carenciaAte`). Razão: a carência existe justamente para não rebaixar ninguém imediatamente quando o líder esquece de renovar/há atraso de webhook. A família **não aceita novos membros** durante a suspensão (convite/aceite → 403 `LEADER_NOT_PREMIUM`). O front exibe a contagem via `suspensaEm`/`carenciaAte` no snapshot (push de aviso está no backlog do épico, não nesta parte).
   - **Pós-carência (`SUSPENSA` e `now >= carenciaAte`):** o rebaixamento dos convidados **efetiva**: a herança **deixa de conceder Pro** (convidados voltam ao nível real deles). O efetivador é o **cron `varrerCarenciaFamilia`** (ver abaixo) e, como rede de segurança, o próprio `getNivelHerdadoFamilia` trata `now >= carenciaAte` como "carência expirada" mesmo se o cron não tiver rodado (catch-up na leitura, espelhando o catch-up de Freemium). Assim não há janela onde um convidado continua Pro indevidamente porque o cron ainda não rodou.
   - **Reativação dentro (ou fora) da carência:** quando o líder volta a nível efetivo `>= 3`, a próxima leitura (`GET /familia` ou resolução de herança) limpa `suspensaEm`/`carenciaAte` e marca `ATIVA` (lazy-write idempotente). Vale tanto **dentro** da carência (convidados nunca chegaram a perder o Pro) quanto **depois** (convidados recuperam o Pro herdado na próxima leitura). A reativação **não recria** vínculos/pets (eles nunca foram apagados pela suspensão; suspensão nunca deleta dados).
   - **Cron `varrerCarenciaFamilia` (catch-up + iniciador de carência órfã, espelha o downgrade de Freemium):** roda diariamente via `@Cron` (`@nestjs/schedule` já presente no repo — `package.json:54`, `ScheduleModule.forRoot()` em `app.module.ts:48`; mesma janela 03h do cron de downgrade de Freemium em `plano.service.ts:110` e do `inactivation.cron.ts`). Dois passos:
     - **(a) Reconciliar suspensas:** seleciona `FamiliaPlano` com `status=SUSPENSA AND carenciaAte <= now` (índice `@@index([carenciaAte])`). Para cada uma: **revalida o nível efetivo do líder** (a suspensão pode ter sido transitória); se o líder voltou a `>= 3`, marca `ATIVA` e limpa `suspensaEm`/`carenciaAte`; se continua `< 3`, mantém `SUSPENSA` (a herança já não concede Pro pós-carência).
     - **(b) Iniciar carência de famílias ATIVA órfãs de leitura (correção Finding 9):** seleciona `FamiliaPlano` com `status=ATIVA` (índice `@@index([status])`) e revalida o nível efetivo do líder; se o líder está `< 3`, **inicia a suspensão** (`status=SUSPENSA`, `suspensaEm=now`, `carenciaAte=now+FAMILIA_CARENCIA_DIAS`). Garante que uma família cujo líder caiu mas que ninguém leu ainda entra em carência de forma determinística, sem depender de leitura.
     O cron **não deleta** família, membros nem pets; é só o efetivador/iniciador determinístico do rebaixamento + reconciliação. Idempotente (rodar 2x = mesmo estado). **Não toca o webhook nem a Subscription** (D5).
   - **Líder Freemium (caso de ciclo de vida explícito — correção):** o gating de família liga com `familiaMaxMembros != null`, que o seed ativa em **Premium (3) E Freemium (4)** ([seed.ts:76,127](../../../prisma/seed.ts)). Freemium é um **trial com benefícios Premium** que **expira e faz downgrade para Básico (1)** via o cron/catch-up de Freemium em `plano.service.ts`. Logo um líder Freemium **pode** criar família legitimamente durante o trial (nível efetivo 4 >= 3, herança concede Pro aos convidados); **quando o trial expira e o líder cai para Básico (1) < 3, a família entra em carência e suspende como qualquer outra queda de líder** — a regra de suspensão não trata Freemium como exceção, e o downgrade de trial dispara exatamente o mesmo caminho de "líder caiu". Isso é **declarado e intencional**: não há código especial para Freemium; o ciclo trial → downgrade → suspensão da família é o comportamento esperado. **RESOLVIDO por D16: NÃO.** O seed liga `familiaMaxMembros` só no Premium, então um Freemium recebe 403 em `GET /familia` e este ciclo trial para suspensão não existe para o líder. O parágrafo acima fica como contexto histórico do finding.
   - **Janela de consistência eventual com o webhook (declarada, benigna):** a fonte real do nível do líder é a `Subscription`, alterada por **webhook RevenueCat assíncrono**. Pode haver corrida entre "cron/leitura leu líder `< 3` e manteve `SUSPENSA`" e "webhook de renovação acabou de gravar `ACTIVE` Premium". A reconciliação é **eventual, não transacional cross-fonte**: o cron e a leitura **revalidam o nível do líder no momento da varredura/leitura**; se houver renovação concorrente que o cron não viu, a **próxima leitura (catch-up) ou a próxima execução do cron** marca `ATIVA`. **Nenhum estado é destrutivo** — a suspensão nunca deleta família/membros/pets, só altera `status`/`suspensaEm`/`carenciaAte` —, então a janela é **benigna**: no pior caso um líder recém-renovado fica `SUSPENSA` por algumas horas até a próxima leitura/cron, sem perda de dados e sem rebaixar ninguém (durante a carência o Pro é mantido de qualquer forma). Convergência garantida para `ATIVA` em uma rodada de leitura/cron após a renovação. *(AC opcional: renovação + cron concorrentes convergem para `ATIVA` — AC42d.)*
   - **Fonte de verdade:** o estado é a leitura/cron; `suspensaEm`/`carenciaAte` servem ao front e ao cron. **Não há transição órfã:** quem escreve a suspensão é a leitura (lazy) ou o cron, quem efetiva o rebaixamento pós-carência é o cron + catch-up na leitura.
10. **1 família ativa por usuário:** índice único parcial em `MembroFamilia.usuarioId`; segunda entrada → 409 `ALREADY_IN_ANOTHER_FAMILY`.
11. **Convite duplo + reuso + multi-uso do link (D2):** `ConviteTipo` diferencia. `CODIGO_CONVIDADO` em `POST /convites` (líder digita o código do convidado); `LINK_LIDER` em `POST /convites/:codigo/aceitar` (convidado abre o link do líder). 6 dígitos, 404 genérico (D2). **`GET /familia/convite` reusa o convite ativo existente** (não rotaciona a cada chamada) — só gera novo se não há ativo não-expirado não-consumido. Unique parcial `convite_familia_ativo_unico` garante no máximo um ativo por `(usuarioId, tipo)`.
    - **`CODIGO_CONVIDADO` é single-use:** consumido no primeiro aceite (`consumidoEm = now`). Um código de convidado serve uma entrada.
    - **`LINK_LIDER` é multi-uso (estilo Spotify: 1 link → até 4 pessoas):** o aceite **NÃO seta `consumidoEm`** — o mesmo link do líder convida vários até a família encher (`maxMembros`) ou o link expirar (`expiraEm`). Isso resolve a colisão "single-use vs 1 link convida até 4": só o `CODIGO_CONVIDADO` é single-use; o `LINK_LIDER` vive até expirar. O unique parcial `convite_familia_ativo_unico` continua válido porque o link do líder permanece **um** convite ativo (não-consumido) por `(usuarioId, LINK_LIDER)` durante toda a sua vida.
    - **Encerramento do link:** o `LINK_LIDER` deixa de funcionar quando `expiraEm <= now` (404 via `resolveAtivoOrThrow`) ou quando a família está cheia (409 `FAMILY_FULL`). Não há "consumo" no aceite.
12. **Delegação (D12):** dono (não líder) delega a um membro por janela fixa (24/72/168/336h) ou indefinida; revogável; **create-only** em diário/medicamento/vacina/peso/documento; não edita/deleta; não cria prestador; não mexe na família/pet.
13. **Família lazy-create:** `FamiliaPlano` só nasce no primeiro convite bem-sucedido. `GET /familia` de Premium sem família retorna estado vazio (não persiste).

---

## Autorização / BOLA (por rota)

Esta parte **adiciona** métodos ao `OwnershipService` (aditivo, D4); não altera os `assert*` existentes na superfície de **mutação**. Na superfície de **leitura** de prontuário, o caminho de leitura passa a chamar o método família-aware (mantendo os `assert<Recurso>Ownership` intactos para edição/delete). **Todos os novos métodos recebem `userId` (= `req.user.userId`), não `usuarioId`** (ver [nota crítica](#nota-crítica-usuarioid-vs-userid)).

> **`deny()` já foi migrado pela Parte 0 (não reintroduzir copy literal).** A Parte 0 (D14/D4, Regra 18 e AC31) substituiu o throw de `deny()` por `LocalizedException('OWNERSHIP_FORBIDDEN', 403)` — mesma copy pt-BR `'Acesso negado a este recurso'` (**sem ponto final**), agora vinda do catálogo i18n. **Os 6 métodos novos abaixo negam SEMPRE via `this.deny()`** (nunca lançam string própria), então herdam de graça o 403 + a chave do catálogo. **Consequência para os AC:** todo AC de 403 desta parte (AC38, AC38c*, AC40m, AC41, AC41b) **assevera status `403` + `reason`/chave `OWNERSHIP_FORBIDDEN`** (e, para os erros de negócio de família, o `reason` próprio), **não a string literal** — caso a Parte 0 ainda não tenha sido merjada, a asserção por status+chave evita colisão de ordem de merge. Para os 403 ad-hoc de família que não têm método dedicado (ex.: checagem de membro), usar o helper `assert403(temAcesso, 'OWNERSHIP_FORBIDDEN')` da Parte 0 (Regra 21) — nunca um `ForbiddenException('...')` cru.

### Novos métodos

- **`assertFamiliaMembership(userId)`** → `{ familia, membro }`; 403 `NOT_A_MEMBER` se nenhuma.
- **`assertFamiliaLeader(userId)`** → membership + 403 `NOT_LEADER` se `role !== LIDER`.
- **`assertPodeLerRecursoDoPet(petId, userId, isAdmin)`** → **método consolidado de leitura por família (Delta 1) para recursos que NÃO já carregaram o pet.** Faz a sua própria resolução do dono (`pet.findUnique` com `tutor.usuarioId`, como `assertPetOwnership`). Resolve acesso de **leitura** se: (a) `isAdmin`; OU (b) dono (`pet.tutor.usuarioId === userId`); OU (c) membro de família **com a janela de concessão aberta** com o pet vinculado (`FamiliaPet(familiaId, petId)` existe e o `userId` é membro daquela `FamiliaPlano` com **`status=ATIVA` OU (`status=SUSPENSA` E `now < carenciaAte`)** — mesma janela da herança de Pro, Regra 4); OU (d) delegado ativo (`DelegacaoPet` do pet com `delegadoMembro.usuarioId === userId`, `revogadaEm null`, `expiraEm null || expiraEm > now`). Pet inexistente → 404 `Pet não encontrado`. Sem nenhum dos acessos → `deny()` (403 `OWNERSHIP_FORBIDDEN`, anti-leak; herda a migração do `deny()` da Parte 0). **Zero famílias e zero delegações = idêntico ao `assertPetOwnership` de hoje.** Usado **no caminho de leitura** das rotas de prontuário (list por `petId`). **Resiliência:** a resolução de família roda dentro do método; falha na sub-query de família **não pode** abrir acesso indevido — em dúvida, cai para a checagem de dono (fail-closed para concessão por família). **Feature flag `FAMILIA_LEITURA_PRONTUARIO` (D15):** a concessão pelo ramo (c) [família] só é avaliada quando a flag está **on** (ver [Feature flag de rollout](#feature-flag-de-rollout-d15)); com a flag **off**, o método se comporta como o ownership dono-only de hoje (ramos a/b/d apenas).
- **`assertPodeLerPetInline(petId, ownerUsuarioId, userId, isAdmin)`** → **forma inline para o `pet.service` (correção v0.4).** O `pet.service.findOne`/`findOneWithAllInformation` já fizeram `pet.findUnique` (query única intencional) e têm o `ownerUsuarioId` em mãos. Este método **não re-busca o pet**: retorna ok se `isAdmin` OU `ownerUsuarioId === userId`; **só** quando o dono não bate é que dispara a sub-query de família/delegação (membro de família com a janela de concessão aberta — `ATIVA` OU `SUSPENSA && now < carenciaAte` — com `FamiliaPet(petId)`, **se a flag `FAMILIA_LEITURA_PRONTUARIO` está on**, OU delegado ativo) usando o `petId`. Sem nenhum acesso → `deny()`. Espelha `assertOwnsByUsuarioId` (ownership.service.ts:35) acrescentando o fallback de família. **Evita duplicar a query pesada que o `pet.service` consolidou de propósito** (comentários "antes eram 2 queries" em pet.service.ts:70-71, 97-98). Pet inexistente continua tratado pelo próprio `pet.service` (`if (!pet) throw NotFoundException`), antes da chamada.
- **`assertPodeLerRecursoPorId(buscaRecurso, userId, isAdmin)`** (forma de detalhe para os 9 recursos de prontuário): para as rotas `GET /<recurso>/:id`, resolve o `petId` do recurso (uma query `select { petId, pet: { tutor: { usuarioId } } }`, como os `assert<Recurso>Ownership` já fazem) e delega a regra a `assertPodeLerRecursoDoPet(petId, userId, isAdmin)` (que já honra a janela de carência e a flag `FAMILIA_LEITURA_PRONTUARIO`). Recurso inexistente → 404 com a mesma mensagem do `assert<Recurso>Ownership` correspondente. **Para `documento` (que tem `usuarioId` direto e `petId` nullable):** leitura concedida se **dono direto** (`documento.usuarioId === userId`) — **vale para `petId` null OU não-null** (documento user-level do próprio leitor é sempre concedido) — OU `isAdmin` OU, **quando `petId != null`**, dono via pet OU leitura por família/delegação via o `petId` do documento. **Quando `petId === null` (documento user-level), curto-circuita para o check de dono-direto, sem chamar a sub-query de família** (evita NPE e bloqueia concessão por família a documento sem pet — ver [Documentos user-level](#documentos-user-level-petid-null)). **Mutação de documento continua em `assertDocumentOwnership` inalterado. `assertArquivoOwnership` permanece intacto** (arquivos só são lidos embutidos em `GET /documents/:id`; não há leitura autônoma de arquivo).
- **`assertPetCreateAccess(petId, userId, isAdmin)`** → dono OU admin OU delegação ativa (`delegadoMembro.usuarioId === userId`, `revogadaEm null`, `expiraEm null || > now`). Usado nos POST de prontuário; edit/delete continuam em `assert*Ownership`.

> **Por que três formas de leitura (`assertPodeLerRecursoDoPet` por `petId`, `assertPodeLerRecursoPorId` por `id` do recurso, e `assertPodeLerPetInline` para o pet detalhe):** as rotas de list de prontuário já têm `petId` (query param), então chamam direto `assertPodeLerRecursoDoPet(petId,...)`. As rotas de detalhe de prontuário têm só o `id` do recurso, então usam a forma por id (resolve o `petId` e delega). O **pet detalhe** é especial: o `pet.service` já carregou o pet inteiro inline e tem o `ownerUsuarioId`, então usa `assertPodeLerPetInline` (não re-busca). Todas convergem para a mesma regra de família/delegação, sem duplicar a lógica em 9+ services.

### Mapa rota → checagem (família/convite/delegação)

| Rota | Checagem BOLA |
|---|---|
| `GET /familia` | `assertFamiliaMembership` (soft) / gating; viewer derivado; lazy-write de suspensão/carência |
| `GET /familia/convite` | rate-limit helper (sem recurso de terceiro) |
| `POST /familia/convites` | `assertFamiliaLeader`; código resolve convidado; não-self/não-dup |
| `POST /familia/convites/:codigo/aceitar` | código resolve família; vaga/self/outra-família; família ATIVA ou em carência |
| `POST /familia/pets` | `assertPetOwnership(petId, userId)` + `assertFamiliaMembership` |
| `GET /familia/pets-disponiveis` | `assertFamiliaMembership`; só pets do próprio tutor |
| `PATCH /familia/solicitacoes/:id/aprovar` | `assertFamiliaLeader` + solicitação da família do líder |
| `PATCH /familia/solicitacoes/:id/recusar` | idem |
| `DELETE /familia/pets/:petId` | `assertFamiliaMembership` + (líder OU `donoMembroId === viewer`) |
| `DELETE /familia/membros/:membroId` | `assertFamiliaLeader` + membro da família + não líder |
| `POST /familia/pets/:petId/delegacoes` | `assertPetOwnership(petId, userId)` + `FamiliaPet` na família + delegado membro |
| `DELETE /familia/pets/:petId/delegacoes/:delegacaoId` | `assertFamiliaMembership` + (líder OU dono) + delegação na família |

### Mapa rota de prontuário → checagem (Delta 1 — leitura por família)

> Estas rotas **já existem** e hoje usam `assertPetOwnership`/`assert<Recurso>Ownership` (ou, no caso do pet detalhe, `assertOwnsByUsuarioId` inline). A Parte 2 troca **apenas o caminho de leitura** para o método família-aware. Cada uma passa por `security-auditor` com AC de regressão (tutor sem família lê só os seus). Mutação (POST/PATCH/PUT/DELETE) **não muda**.

| Rota (leitura) | Antes | Depois (Delta 1) |
|---|---|---|
| `GET /vacina?petId=` (list) | `assertPetOwnership(petId)` | `assertPodeLerRecursoDoPet(petId)` |
| `GET /vacina/:id` (detalhe) | `assertVacinaOwnership(id)` | `assertPodeLerRecursoPorId(vacina, id)` |
| `GET /consulta?petId=` / `GET /consulta/:id` | `assertPetOwnership` / `assertConsultaOwnership` | `assertPodeLerRecursoDoPet` / `assertPodeLerRecursoPorId(consulta)` |
| `GET /diario-pet?petId=` / `GET /diario-pet/:id` | `assertPetOwnership` / `assertDiarioPetOwnership` | `assertPodeLerRecursoDoPet` / `assertPodeLerRecursoPorId(diario)` |
| `GET /medicamento?petId=` / `GET /medicamento/:id` | `assertPetOwnership` / `assertMedicamentoOwnership` | `assertPodeLerRecursoDoPet` / `assertPodeLerRecursoPorId(medicamento)` |
| `GET /peso-registro?petId=` / `GET /peso-registro/:id` | `assertPetOwnership` / `assertPesoOwnership` | `assertPodeLerRecursoDoPet` / `assertPodeLerRecursoPorId(peso)` |
| `GET /documents/pet/:petId` / `GET /documents/:id` | `assertPetOwnership` / `assertDocumentOwnership` | `assertPodeLerRecursoDoPet` / `assertPodeLerRecursoPorId(documento)` (curto-circuita p/ dono-direto se `petId` null) |
| `GET /diagnostico?petId=` / `GET /diagnostico/:id` | `assertPetOwnership` / `assertDiagnosticoOwnership` | `assertPodeLerRecursoDoPet` / `assertPodeLerRecursoPorId(diagnostico)` |
| `GET /alergia?petId=` / `GET /alergia/:id` | `assertPetOwnership` / `assertAlergiaOwnership` | `assertPodeLerRecursoDoPet` / `assertPodeLerRecursoPorId(alergia)` |
| `GET /tratamento-fixo?petId=` / `GET /tratamento-fixo/:id` | `assertPetOwnership` / `assertTratamentoFixoOwnership` | `assertPodeLerRecursoDoPet` / `assertPodeLerRecursoPorId(tratamentoFixo)` |
| `GET /pet/:id` / `GET /pet/allinfos/:id` (detalhe) | **`assertOwnsByUsuarioId` inline** (NÃO `assertPetOwnership`) | **`assertPodeLerPetInline(petId, ownerUsuarioId)`** (não re-busca o pet); `/allinfos` redige `email`/`telefone` do dono p/ não-donos |
| `GET /pet/byTutorId/:id` | filtro por tutor próprio | **não muda** (lista por tutorId próprio, não por família) |

`req.user.userId`/`tutorId` do JWT (jwt.strategy.ts:31-40); nunca confiar em ids no body. Negações logam WARN (`deny()`).

---

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Herança lançar exceção e degradar convidado a nível 0 (cupom engole com `.catch(()=>0)`; ebook/diário chamam direto) | `getNivelForTutor` resiliente: `try/catch` interno na resolução da família degrada para nível próprio, nunca propaga (Regra 2, AC15b). |
| Alto | `assertPodeLerRecursoDoPet`/`assertPodeLerPetInline` abrir leitura indevida (BOLA) ao trocar as rotas de prontuário/pet | Aditivo: zero famílias/zero delegações = idêntico ao ownership atual. Regressão "tutor lê só seus pets" por recurso (AC38, AC38c, AC40 por rota). Concessão por família é fail-closed (falha na sub-query de família cai para checagem de dono). `security-auditor` obrigatório **por rota de leitura** (task 17). Família SUSPENSA não concede leitura (Regra 4). |
| Alto | **PII do dono (email/telefone) vazar via `/pet/allinfos` ao abrir por família** | `pet.service` redige `email`/`telefone` do dono quando o leitor não é o dono (mantém `nome`, já público entre membros). AC40k (regressão de PII). Ver [Vazamento de PII](#vazamento-de-pii-em-petallinfos-por-família). |
| Alto | **Duplicar a query pesada do pet detalhe** ao plugar `assertPodeLerRecursoDoPet` (que re-busca o pet) | Usar `assertPodeLerPetInline` (recebe `ownerUsuarioId` já carregado; só busca família quando o dono não bate). Não re-busca o pet. Audit grep confirma que o pet detalhe não regrediu a 2 queries (task 20). |
| Alto | Mutação vazar pela troca de leitura (trocar `assert` no caminho errado) | Só os caminhos `findAll`/`findByPet`/`findOne` trocam; POST/PATCH/PUT/DELETE continuam em `assert<Recurso>Ownership`/`assertPetCreateAccess`. AC explícito: membro de família faz PATCH/DELETE em recurso alheio → 403 (AC41). |
| Alto | Herança recursiva em `getNivelForTutor` (líder herda de si) | Nível do líder da subscription própria (sem herança). Teste de não-loop (AC14). |
| Alto | Quebra do webhook por mexer em `Subscription.usuarioId` | Proibido (D5): herança runtime; cron de carência não toca Subscription. Smoke do webhook pós-deploy. |
| Médio | **Documento user-level (`petId` null) NPE/branch indevido** ao resolver leitura por família | `assertPodeLerRecursoPorId(documento)` curto-circuita p/ dono-direto quando `petId` null (sem sub-query de família). AC40l. |
| Médio | **App antigo tratar `200 + dados` de pet alheio como erro de UI** (semântica observável muda sem opt-in de versão) | `petjourney-app` listado como consumidor cujo comportamento muda; decisão de rollout/feature-flag em aberto (Pergunta 9); validar a tela de prontuário do app contra pets compartilhados antes do deploy. |
| Médio | Janela em que convidado continua Pro após a carência porque o cron não rodou | Catch-up na leitura: `getNivelHerdadoFamilia` trata `now >= carenciaAte` como carência expirada (não concede Pro) mesmo sem o cron (Regra 9). Cron é efetivador determinístico, não única defesa. AC42b. |
| Médio | Carência efetivar rebaixamento cedo demais (líder só atrasou renovação) | Default 7d configurável (`FAMILIA_CARENCIA_DIAS`); reativação dentro da carência nunca rebaixa; cron revalida o nível do líder antes de manter SUSPENSA (Regra 9). AC43a. |
| Médio | Expansão de acesso Pro do convidado em cupom/ebook não percebida | Declarada como mudança intencional (seção dedicada) + AC12c/AC12d. **Diário fora da lista** (gating nível 3 só de escrita; convidado Pro=2 não desbloqueia). Audit grep dos 3 callsites (task 20). |
| Médio | Idempotência de aprovar colidir com `@@unique` → 409 indevido | Algoritmo explícito (Regra 6): check-then-act na transação, não catch de P2002. |
| Médio | `GET /familia/convite` invalidar link já compartilhado | Reuso do convite ativo (Regra 11) + unique parcial `convite_familia_ativo_unico`. |
| Médio | Race em add/aprovar estourando limite | Contagem dentro de transação; unique parcial em pendente; revalidação na aprovação. |
| Médio | Usuário em 2 famílias por corrida | Índice único parcial em `MembroFamilia.usuarioId` + check `ALREADY_IN_ANOTHER_FAMILY`. |
| Médio | Enumeração de código | Helper Parte 0: rate-limit + 404 genérico (D2); single-use; expira. |
| Médio | Convidado já-pagante cobrado em dobro | D11: `max()`, nunca cancela loja; app sugere cancelar próprio. |
| Médio | Divergência "nível efetivo" vs "subscription real" confundir CMS/suporte | Documentada (seção global + Perguntas 5); `getSubscriptionInfoForTutor` mantém subscription real. |
| Baixo | Delegação não expira | `assertPetCreateAccess`/`assertPodeLerRecursoDoPet` checam `expiraEm`/`revogadaEm` em runtime (sem cron). |
| Baixo | N+1 nas rotas de prontuário por resolver família a cada leitura | Resolução de família é 1 query extra com `select` minimalista; memoizável por request. Snapshot e list já fazem ≥1 query; custo marginal. Monitorar slow routes. |
| Baixo | Remoção de membro apagar pet real | Só deleta `FamiliaPet`/vínculos; nunca `Pet.delete`. Teste de sobrevivência (AC29). |

---

## Requisitos Não-Funcionais

- **Privacidade:** snapshot expõe `contato` só de membros da própria família; mapper allow-list. Não logar PII. A leitura de prontuário por família (Delta 1) expõe dados de saúde do pet alheio a membros da família ATIVA — é a decisão de produto travada; mutação continua bloqueada. **Correção v0.4 (PII do dono):** `/pet/allinfos/:id` carrega `tutor.usuario.{nome,email,telefone}`; ao abrir por família, **email e telefone do dono são redigidos** quando o leitor não é o dono (mantém `nome`, já exposto entre membros). Logo **não há novo vazamento de email/telefone do tutor**; o que é compartilhado é o prontuário do pet (decisão travada) e o `nome` do dono (já no snapshot). AC40k cobre a regressão.
- **Performance:** snapshot 1 query com `select` controlado (membros→pets, solicitações, delegações ativas). Sem cache (mutável por usuário). Herança barata (1 query), memoizável por request. Rotas de prontuário ganham 1 query de resolução de família no caminho de leitura (minimalista, indexada por `FamiliaPet.petId`/`MembroFamilia.usuarioId`). **Pet detalhe não ganha query extra no caminho do dono** (`assertPodeLerPetInline` só busca família quando o dono não bate), preservando a consolidação de query única do endpoint mais quente (`findOneWithAllInformation`).
- **Consistência:** mutações multi-write em `prisma.$transaction`. Lazy-write de suspensão/carência e cron de catch-up são idempotentes.
- **Segurança:** `FamiliaGatingGuard` + asserts de família. `security-auditor` em toda rota com filtro por user, **incluindo cada rota de leitura de prontuário/pet trocada** (Delta 1).
- **i18n (reconciliação com D15/Parte 0):** a Parte 0 **entrega o catálogo i18n de erro** (D14: `ERROR_CATALOG`/`ErrorKey`/`LocalizedException`, pt-BR/en-US/en-GB/es-419 com **en-GB explícito**, padrão estático tipo `ESPECIE_LABELS` em `src/common/errors/error-catalog.ts`). Portanto as **mensagens de erro da Família passam pelo catálogo**, não são mais strings cruas: os 403 de ownership/membro reusam a chave `OWNERSHIP_FORBIDDEN` (já no catálogo, migrada na Parte 0) e o helper `assert403`; o 404 de código vem de `PUBLIC_CODE_INVALID` (catálogo), re-emitido como `INVITE_NOT_FOUND` genérico. **Erros de negócio específicos da Família** (`FAMILY_FULL`, `PET_LIMIT_REACHED`, `LEADER_NOT_PREMIUM`, etc.) **adicionam suas chaves ao `ERROR_CATALOG`** (pt-BR/en-US/en-GB/es-419, en-GB explícito — regra de memória do Nicolas), lançadas via `LocalizedException(<chave>, <status>)` carregando o `reason`/`feature` no payload. **Mensagens de sucesso** (`"Pet adicionado ao plano."`, etc.) seguem pt-BR no handler (o catálogo é de erro, não de sucesso; sucesso não é gated por locale nesta parte) — se houver decisão de localizar sucesso, é follow-up. **A regra em-dash continua valendo** em qualquer copy visível, **incluindo as novas chaves do catálogo** (todos os 4 locales sem `—`); AC39 grep cobre `src/familia`, as mensagens novas dos services tocados **e as entradas novas do `error-catalog.ts`**. Conteúdo de Família persistido com `traducoes` (não há nesta parte) seguiria a via JSONB com en-GB explícito, à parte do catálogo de erro.

---

## Acceptance Criteria

> **Precondição global de AC de gating/limites:** o **seed dos limites** (`familiaMaxMembros=5`, `familiaMaxPetsLider=5`, `familiaMaxPetsConvidado=2` em Premium, não em Freemium, D16) **deve estar aplicado**. ACs que dependem de limites assumem essa precondição.

**Gating** — AC1: Pro sem família → `GET /familia` 403 `reason=FEATURE_NOT_INCLUDED`, `feature=FAMILIA`. AC2 (após seed dos limites): Premium sem família → 200 `viewer.isLider=true`, só ele em `membros`, `limites={maxMembros:5, maxPetsLider:5, maxPetsConvidado:2}`. AC3 (após seed): Freemium → 403 `FEATURE_NOT_INCLUDED` (família é só Premium, D16).

**Convite por código** — AC4: líder + código válido de X → 201 `"Usuário convidado com sucesso."`, X vira `CONVIDADO`. AC5: código inexistente / código expirado / código já consumido → **os três** retornam 404 `reason=INVITE_NOT_FOUND` (resposta idêntica). AC6 (após seed): 5 membros → 409 `FAMILY_FULL`. AC7: X em outra família → 409 `ALREADY_IN_ANOTHER_FAMILY`. AC8: convidado chamando → 403 `NOT_LEADER`. AC9: código do próprio líder → 409 `CANNOT_INVITE_SELF`.

**Aceite por link** — AC10: link válido → convidado 200 `"Você entrou no plano familiar."`, vira `CONVIDADO`. AC11: família suspensa fora da carência → 403 `LEADER_NOT_PREMIUM`. **AC10b (link multi-uso):** o **mesmo** `LINK_LIDER` aceito por 2 convidados distintos (família com vagas) → ambos viram `CONVIDADO`; o convite **não** é marcado `consumidoEm` após o 1º aceite (permanece ativo até `expiraEm` ou família cheia). **AC10c (corrida de vaga, Regra 6b):** família com **1 vaga** restante e **2 aceites concorrentes** do mesmo link → **exatamente 1** entra (200); o outro recebe **409 `FAMILY_FULL`** (contagem revalidada na transação; nunca estoura `maxMembros`).

**Reuso de convite** — AC11b: dois `GET /familia/convite` seguidos do mesmo usuário retornam **o mesmo `codigo`** (não rotaciona), enquanto o convite anterior está ativo/não-consumido.

**Herança** — AC12: convidado sem assinatura própria, líder Premium → `getNivelForTutor` = 2. AC12c: o mesmo convidado vê **cupons de `planoMinimoNivel <= 2`** (mudança global intencional). AC12d: o mesmo convidado tem `temAcesso=true` em ebook de `plano.nivel <= 2`. **AC12e (diário NÃO desbloqueia — correção v0.4):** o mesmo convidado (nível efetivo 2) **continua sem acesso de escrita ao diário** (gating exige nível 3) — a herança Pro **não** muda o gate do diário; provar que `getNivelForTutor=2 < REQUIRED_NIVEL=3`. AC13: convidado paga Premium → 3 (`max(3,2)`). AC14: líder Premium → 3 sem loop (não chama herança recursivamente). AC15: família suspensa **e fora da carência**, convidado sem assinatura → 0. **AC15b (resiliência, unit-only — correção v0.4):** em **unit com Prisma mockado**, convidado de família ATIVA com a query de família/líder **forçada a lançar** (mock que `throw`) → `getNivelForTutor` retorna o **nível próprio do tutor (>= 0)** e **não propaga**; nunca cai para 0 por causa da falha de família. *A versão integração da falha forçada NÃO é exigida* (regra `testing.md`: não injetar falha artificial em DB real); em integração cobre-se só o caminho feliz da herança/carência. **AC15c (tutor-inexistente preserva o throw — correção):** `getNivelForTutor('id-inexistente')` continua lançando `NotFoundException` (comportamento pré-existente, [subscription.service.ts:141-145](../../../src/subscription/subscription.service.ts)); o `try/catch` de resiliência **não** o engole. Prova que "resiliência" = "herança de família não derruba nível", não "método nunca lança". (Decisão de blindar o callsite ebook contra esse throw fica em [Pergunta 10](#perguntas-em-aberto), fora do escopo padrão desta parte.)

**Adicionar pet** — AC16 (após seed): líder com 4 pets → 201 `"Pet adicionado ao plano."`. AC17 (após seed): líder com 5 → 409 `PET_LIMIT_REACHED`. AC18: convidado → 202 `"Solicitação enviada para aprovação."`. AC19 (após seed): convidado 1 vinculado + 1 pendente → 409 `PET_LIMIT_REACHED` (pendente conta). **AC20a:** `petId` inexistente → 404 `reason=PET_NOT_FOUND` (via `assertPetOwnership` `NotFoundException`). **AC20b:** pet existente de **outro tutor** → 403 (via `assertPetOwnership` `deny()`, política anti-leak do repo prefere 403 a 404). AC21: pet já vinculado ao membro → 409 `PET_ALREADY_LINKED`. **AC21b (corrida de limite de pets, Regra 6b):** líder com 4 pets dispara **2 adds simultâneos** (limite 5) → exatamente **1** passa (201), o outro **409 `PET_LIMIT_REACHED`** (contagem `vinculados + pendentes` revalidada na transação imediatamente antes do insert, em **todos** os caminhos de escrita de `FamiliaPet`: add direto 2.5 e aprovar 2.7).

**Solicitações** — AC22: líder aprova PENDENTE → 200, `FamiliaPet` criado, `APROVADA`, `respondidaPorMembroId` preenchido. AC23: aprovar uma já APROVADA → 409 `REQUEST_NOT_PENDING`. AC23b (idempotência da Regra 6): aprovar PENDENTE cujo `FamiliaPet(familiaId,petId)` **já existe com o mesmo dono** → 200, **sem segundo `FamiliaPet`** (não estoura `@@unique`). AC24: convidado aprova → 403 `NOT_LEADER`. AC25: solicitação de outra família → 404 `REQUEST_NOT_FOUND`. AC26: recusar PENDENTE → 200 `RECUSADA`, sem `FamiliaPet`.

**Remover** — AC27: convidado remove pet de outro → 403. AC28: líder remove pet → 200, vínculo some, `Pet` real existe. **AC28b (remover pet revoga delegação — Finding 13):** pet com delegação **ativa** a um membro; ao remover o pet do plano (2.9), a delegação é revogada/deletada na mesma transação → o ex-delegado faz `POST` (create) naquele pet → **403** (delegação não concede mais). Prova que não sobra delegação órfã quando o pet sai do plano (sem cascade via `FamiliaPet`). AC29: líder remove convidado → 200, pets dele saem, `Pet` reais preservados. **AC29b (cascade revoga acesso imediato):** após remover um membro, **qualquer `DelegacaoPet` onde ele era dono OU delegado deixa de conceder acesso na hora** — o ex-delegado faz `GET`/`POST` em pet que lhe fora delegado → 403; e um pet cujo dono era o removido some do plano (`FamiliaPet` em cascata), então outros membros perdem a leitura por família daquele pet. Prova que o cascade do schema (não delete manual) revoga leitura e create atomicamente. AC30: remover líder → 409 `CANNOT_REMOVE_LEADER`. AC31: convidado remove membro → 403 `NOT_LEADER`.

**Delegação** — AC32: dono delega `duracaoHoras:72` → 201, ativa `expiraEm ~ now+72h`. AC33: delegado faz `POST` (create) → ok; `PATCH`/`DELETE` → 403. **AC34 (setup explícito):** criar `DelegacaoPet` com `expiraEm = now - 1h` (passado); delegado tenta create → 403 (delegação não-ativa). AC35: líder/dono `DELETE` delegação → 200, `revogadaEm` preenchido. AC36: delegar pra si → 409 `DELEGATION_TO_SELF`.

**pets-disponiveis** — AC37: 3 pets do tutor (1 vinculado, 1 com solicitação pendente, 1 livre) → retorna só o 3º.

**Suspensão e carência (Delta 2)** — AC38b: família ATIVA cujo líder cai para nível efetivo `< 3`; ao chamar `GET /familia`, a família passa a `SUSPENSA` com `suspensaEm`/`carenciaAte = suspensaEm + FAMILIA_CARENCIA_DIAS` persistidos; nova chamada não duplica a escrita (idempotente). **AC38d (gatilho via herança — Finding 9):** líder cai para `< 3` e **ninguém abre `GET /familia`**; um convidado **consulta cupom/ebook** (que chama `getNivelForTutor` → herança) → `getNivelHerdadoFamilia` detecta o líder caído numa família `ATIVA` e **inicia a suspensão+carência** (escreve `suspensaEm`/`carenciaAte`), sem depender da tela Família. **AC38e (gatilho via cron de ATIVA órfã — Finding 9):** líder cai e ninguém lê (nem líder, nem convidado exerce gating); rodar `varrerCarenciaFamilia` → o passo de varredura de `status=ATIVA` revalida o líder, detecta `< 3` e marca a família `SUSPENSA` com carência. Prova que não há família `ATIVA` presa indefinidamente com líder caído. **AC42a (Pro mantido na carência):** dado líder caído e família `SUSPENSA` com `now < carenciaAte`, convidado sem assinatura própria → `getNivelForTutor` = 2 (Pro herdado mantido na carência). **AC42b (rebaixa pós-carência):** mesma família com `now >= carenciaAte` e líder ainda `< 3` → `getNivelForTutor` do convidado = 0 (Pro herdado some), **mesmo sem o cron ter rodado** (catch-up na leitura). **AC42c (cron efetiva):** com `carenciaAte <= now` e líder ainda `< 3`, rodar `varrerCarenciaFamilia` → família segue `SUSPENSA`; rodar 2x → idêntico (idempotente); pets/membros/`Pet` reais intactos. **AC42d (convergência renovação + cron — opcional, Finding 12):** família `SUSPENSA` por queda do líder; o líder **renova** (subscription volta a `>= 3`) e o cron roda concorrentemente lendo um estado intermediário → no pior caso o cron mantém `SUSPENSA`, mas a **próxima leitura ou a próxima execução do cron revalida o líder e converge para `ATIVA`**; nenhum dado é deletado na janela. Demonstra que a janela de consistência eventual é benigna (não destrutiva). **AC43a (reativa dentro da carência):** dentro da carência o líder volta a `>= 3` → próxima leitura marca `ATIVA`, limpa `suspensaEm`/`carenciaAte`; convidado segue Pro (nunca perdeu). **AC43b (reativa após carência):** após a carência (convidado já em 0) o líder volta a `>= 3` → próxima leitura/cron marca `ATIVA` e convidado volta a Pro (=2) na leitura seguinte; vínculos e pets preservados. **AC43c (Freemium não cria família, D16):** usuário com plano efetivo Freemium chama `GET /familia` e recebe 403 `FEATURE_NOT_INCLUDED`, porque o seed não liga `familiaMaxMembros` no Freemium (D16). Confirma que Freemium não vira líder e o ciclo trial para suspensão de família não ocorre.

**Leitura de prontuário por família (Delta 1) — ACs enumerados (correção v0.4, sem meta-AC):**
- **AC40a:** convidado de família ATIVA com pet do líder vinculado → `GET /vacina?petId=<petDoLider>` e `GET /vacina/:id` → 200 read-only.
- **AC40b:** idem consulta (`GET /consulta?petId=` + `GET /consulta/:id`) → 200.
- **AC40c:** idem diário (`GET /diario-pet?petId=` + `GET /diario-pet/:id`) → 200.
- **AC40d:** idem medicamento → 200.
- **AC40e:** idem peso (`GET /peso-registro...`) → 200.
- **AC40f:** idem documento (`GET /documents/pet/:petId` + `GET /documents/:id`) → 200.
- **AC40g:** idem diagnóstico → 200.
- **AC40h:** idem alergia → 200.
- **AC40i:** idem tratamento-fixo → 200.
- **AC40j:** idem detalhe do pet (`GET /pet/:id`) → 200.
- **AC40k (PII redigida — novo v0.4):** convidado lê `GET /pet/allinfos/:id` de pet alheio (família ATIVA) → 200 **sem `email` nem `telefone` do dono** no payload (`nome` permitido). Dono lendo o próprio pet recebe tudo (sem regressão).
- **AC40l (documento user-level de outro — novo v0.4):** membro de família tenta ler documento user-level (`petId` null) de **outro** membro via `GET /documents/:id` → 403 (família não concede a documento sem pet).
- **AC40l2 (documento user-level próprio — novo v0.5):** o leitor abre **o próprio** documento user-level (`documento.usuarioId === userId`, `petId` null) via `GET /documents/:id` → **200** (dono-direto concede para `petId` null; sem regressão do `assertDocumentOwnership` atual, que já honra `usuarioId === userId`).
- **AC40m (família suspensa FORA da carência não concede):** mesmo cenário do AC40a com família `SUSPENSA` e **`now >= carenciaAte`** → `GET /vacina/:id` do pet alheio → 403 (leitura cai junto com o Pro herdado pós-carência).
- **AC40n (família suspensa DENTRO da carência ainda lê — reconciliação):** mesmo cenário com família `SUSPENSA` e **`now < carenciaAte`** → `GET /vacina/:id` do pet alheio → **200** (leitura segue o Pro herdado mantido na carência, alinhado a AC42a). Prova que leitura e nível efetivo abrem/fecham na **mesma** janela.
- **AC41 (mutação bloqueada):** o mesmo membro convidado tenta `PATCH /vacina/:id` ou `DELETE /vacina/:id` de pet alheio → 403 (mutação continua só do dono/delegado).
- **AC41b (delegado lê e cria, não edita):** delegado ativo → `GET` ok, `POST` ok, `PATCH`/`DELETE` → 403.

**Regressão BOLA (enumerada — correção v0.4)** — AC38: tutor **sem família**, `assertPodeLerRecursoDoPet(petAlheio, userId)` → 403 (idêntico ao `assertPetOwnership` atual). **AC38c (por rota, enumerado):** tutor sem família chamando cada `GET` de prontuário/pet de pet alheio → 403, em cada rota da tabela de [Escopo de visibilidade](#escopo-de-visibilidade-o-que-entra-nesta-parte): **AC38c1** vacina (list+detalhe), **AC38c2** consulta, **AC38c3** diário, **AC38c4** medicamento, **AC38c5** peso, **AC38c6** documento, **AC38c7** diagnóstico, **AC38c8** alergia, **AC38c9** tratamento-fixo, **AC38c10** `GET /pet/:id`, **AC38c11** `GET /pet/allinfos/:id`. Cada um prova que a troca não regrediu o isolamento dono-only.

**Copy** — AC39: nenhuma mensagem visível (sucesso ou erro) contém em-dash (`—`); gate por grep nas strings dos `throw`/`return { message }` em `src/familia` e nas mensagens novas dos services tocados (a prosa em-dash da spec não conta). **Mensagens de erro vêm do catálogo i18n (Parte 0), não strings cruas:** os 403 de família reusam `OWNERSHIP_FORBIDDEN`/`assert403`; os erros de negócio carregam `reason` próprio; o 404 de código vem de `PUBLIC_CODE_INVALID` (mapeado para `INVITE_NOT_FOUND` genérico).

**Shape do DELETE** — **AC44 (desvio 204→200):** cada `DELETE` (2.9 `/pets/:petId`, 2.10 `/membros/:membroId`, 2.12 `/pets/:petId/delegacoes/:delegacaoId`) retorna **200** com corpo `{ statusCode: 200, message: <custom pt-BR>, data: <snapshot atualizado> }` (não 204, não corpo vazio); `@HttpCode(200)` explícito; coberto pelo `transform.interceptor.spec.ts`.

---

## Estratégia de Testes

**Unit (`*.spec.ts`, Prisma mockado):** `familia.service.spec.ts` (um `describe` por método: convidar/aceitar/addPet líder+convidado/aprovar (incl. idempotência AC23b)/recusar/removerPet/removerMembro/delegar/revogar/suspensão-carência (lazy-write AC38b, reativação AC43a/AC43b); happy + cada erro + "tutor errado"). `subscription.service.spec.ts` estendido (AC12-15, **AC12e diário-não-desbloqueia**, **AC15b resiliência/não-lança em unit**, AC14 não-loop, suspensa, **carência AC42a/AC42b**). `ownership.service.spec.ts` (novos asserts: `assertPodeLerRecursoDoPet`/`assertPodeLerRecursoPorId`/`assertPodeLerPetInline` happy por família/delegação + regressão zero-famílias AC38; **suspensa FORA da carência não concede AC40m; suspensa DENTRO da carência concede AC40n; flag `FAMILIA_LEITURA_PRONTUARIO` off = dono-only**; documento user-level de outro não concede AC40l, documento user-level próprio concede AC40l2; negação via `deny()`/`OWNERSHIP_FORBIDDEN`). Specs de prontuário (`vacina.service.spec.ts`, etc.) ganham caso "membro de família lê" (AC40) e "membro de família não muta" (AC41) — pelo menos no padrão de 1 recurso representativo + cobertura por integração nos demais. `pet.service.spec.ts`: leitura por família via `assertPodeLerPetInline` (não re-busca pet) + **redação de PII em `/allinfos` para não-dono (AC40k)**. `transform.interceptor.spec.ts` (respeita `message` custom; retrocompat com `'Operation successful'`). `varrer-carencia` cron (`*.spec.ts`): idempotência + revalidação do líder (AC42c).

**Integração (`*.integration.spec.ts`, Postgres real — nunca mockar):** fluxo e2e (2 tutores, convite por código e link, solicitação→aprovação incl. idempotência, limites, remoção preserva pets reais). **Leitura de prontuário por família (Delta 1):** convidado lê cada recurso do pet do líder (200) e é bloqueado em mutação (403) e quando a família está suspensa (403) — **1 caso por rota da tabela de Escopo de visibilidade** (AC40a-j/AC40m/AC41/AC38c1-11), incl. `/pet/allinfos` sem PII de contato (AC40k) e documento user-level negado (AC40l). Unique parcial (2 famílias falha no banco; convite ativo único por usuário+tipo). Herança real via `getNivelForTutor` (**só caminho feliz** — resiliência de falha forçada fica no unit, AC15b). Suspensão+carência runtime+cron (AC38b/AC42/AC43). Cleanup truncando `FamiliaPlano`/`MembroFamilia`/`FamiliaPet`/`SolicitacaoPet`/`ConviteFamilia`/`DelegacaoPet` em `beforeEach`.

**Smoke (`scripts/smoke-familia.ts`, HTTP+DB real):** login líder, gera convite, login convidado, aceita link, adiciona pet, líder aprova, **convidado lê o prontuário (vacina/diário) do pet do líder via as rotas reais**, valida snapshot + `getNivelForTutor`; confirma subscription do líder inalterada (webhook intacto). Valida que `GET /familia/convite` reusa o código. Confirma que `/pet/allinfos` do pet alheio **não** traz email/telefone do dono. Smoke da carência: força líder a `< 3`, lê `GET /familia` (vira SUSPENSA com carência), confirma convidado segue Pro na carência; avança o relógio/seta `carenciaAte` no passado e confirma rebaixamento.

---

## Arquivos Impactados

| Arquivo | Ação | Descrição |
|---|---|---|
| `prisma/schema.prisma` | editar | +6 models, +4 enums, +3 colunas nullable em `Plano`, relações reversas em `Usuario`/`Tutor`/`Pet`/`FamiliaPlano`, `@@index([carenciaAte])` em `FamiliaPlano` |
| `prisma/migrations/<ts>_add_plano_familia/migration.sql` | criar | Tabelas/enums/colunas + índices únicos parciais (membro por usuário; solicitação pendente única; convite ativo único por usuário+tipo) + índice `carenciaAte` |
| `prisma/seed.ts` | editar | `familiaMaxMembros=5`, `familiaMaxPetsLider=5`, `familiaMaxPetsConvidado=2` só em Premium, não em Freemium (idempotente, D16) |
| `src/familia/familia.module.ts` | criar | Nest module (AuthModule, SubscriptionModule, PrismaModule, helper Parte 0) |
| `src/familia/familia.controller.ts` | criar | 12 rotas; `@Throttle(PUBLIC_CODE_THROTTLE)` com `generateKey` por código nas rotas públicas por código (2.3, 2.4 — D15); `@HttpCode(200)` explícito nos DELETE (2.9/2.10/2.12) |
| `src/familia/familia.service.ts` | criar | Regra (lazy-create, limites, transações, snapshot, suspensão+carência runtime, reuso de convite) |
| `src/familia/familia-carencia.cron.ts` | criar | Cron `varrerCarenciaFamilia` via `@Cron` (`@nestjs/schedule` já no repo; mesma janela 03h do downgrade de Freemium); catch-up pós-carência, idempotente; não toca Subscription/webhook |
| `src/familia/familia-snapshot.mapper.ts` | criar | Mapper allow-list (especiePet→especie, sem PII; expõe `suspensaEm`/`carenciaAte`) |
| `src/familia/guards/familia-gating.guard.ts` | criar | 403 `FEATURE_NOT_INCLUDED` por plano efetivo (fail-closed) |
| `src/familia/dto/*.dto.ts` | criar | `convite.dto`, `add-pet.dto`, `delegacao.dto` (class-validator) |
| `src/familia/familia.service.spec.ts` | criar | Unit |
| `src/familia/familia.integration.spec.ts` | criar | Integração (DB real), incl. leitura de prontuário por família |
| `src/auth/services/ownership.service.ts` | editar | +`assertFamiliaMembership`/`assertFamiliaLeader`/`assertPodeLerRecursoDoPet`/`assertPodeLerRecursoPorId`/`assertPodeLerPetInline`/`assertPetCreateAccess` (aditivo; param `userId`; negam via `deny()`/`assert403` da Parte 0, não string crua; janela de concessão `ATIVA OU SUSPENSA && now < carenciaAte`; ramo de família **gated por `FAMILIA_LEITURA_PRONTUARIO`**). `deny()` **já migrado pela Parte 0** para `LocalizedException('OWNERSHIP_FORBIDDEN')` — não reverter. `assertArquivoOwnership` **não muda** (só mutação) |
| `src/familia/familia.config.ts` (ou env) | criar/editar | Flags/consts: `FAMILIA_LEITURA_PRONTUARIO` (default off em prod), `FAMILIA_CARENCIA_DIAS=7`, `FAMILIA_CONVITE_TTL_DIAS=30`, `FAMILIA_INVITE_BASE_URL` (env, D15) |
| `src/common/errors/error-catalog.ts` (Parte 0) | editar | +chaves de negócio da Família (`FEATURE_NOT_INCLUDED`, `LEADER_NOT_PREMIUM`, `FAMILY_FULL`, `PET_LIMIT_REACHED`, `INVITE_NOT_FOUND`, etc.) em 4 locales (en-GB explícito, sem em-dash) |
| `src/auth/services/ownership.service.spec.ts` | editar | Novos métodos + regressão zero-famílias + suspensa não concede + documento user-level não concede |
| `src/subscription/subscription.service.ts` | editar | `getNivelForTutor` → `max()` **resiliente**; novo `getNivelHerdadoFamilia` (com catch-up de carência: `now >= carenciaAte` não concede Pro) |
| `src/subscription/subscription.service.spec.ts` | editar | AC12-15, AC12e (diário não desbloqueia), AC15b (não-lança, unit), AC14 (não-loop), AC42 (carência) |
| `src/vacina/vacina.service.ts` | editar | Caminho de leitura (list `findAll`/detalhe `findOne`) → `assertPodeLerRecursoDoPet`/`assertPodeLerRecursoPorId`; mutação inalterada |
| `src/consulta/consulta.service.ts` | editar | idem (leitura por família) |
| `src/diario-pet/diario-pet.service.ts` | editar | idem (leitura por família; `findAll`:88). Gating de escrita (nível 3) inalterado |
| `src/medicamento/medicamento.service.ts` | editar | idem |
| `src/peso-registro/peso-registro.service.ts` | editar | idem |
| `src/documents/documents.service.ts` | editar | idem (leitura por família via `petId` do documento; **curto-circuito p/ dono-direto se `petId` null**; mutação em `assertDocumentOwnership`) |
| `src/diagnostico/diagnostico.service.ts` | editar | idem |
| `src/alergia/alergia.service.ts` | editar | idem |
| `src/tratamento-fixo/tratamento-fixo.service.ts` | editar | idem |
| `src/pet/pet.service.ts` | editar | Detalhe (`findOne`/`findOneWithAllInformation`) → **`assertPodeLerPetInline`** (não re-busca o pet); **`/allinfos` redige `email`/`telefone` do dono p/ não-donos**; `byTutorId` inalterado |
| `src/common/interceptors/transform.interceptor.ts` | editar | Respeitar `message` custom quando handler retorna `{ message, data }` (retrocompatível) |
| `scripts/smoke-familia.ts` | criar | Smoke HTTP+DB (incl. leitura de prontuário por família, PII redigida e carência) |
| `docs/CHANGELOG.md` | editar | Entry da feature |
| `src/app.module.ts` | editar | Registrar `FamiliaModule` (cron `varrerCarenciaFamilia` via `@Cron`; `ScheduleModule.forRoot()` já registrado em app.module.ts:48) |

> `HttpExceptionFilter` **não** muda (já espalha `...error` no topo). `getSubscriptionInfoForTutor` **não** muda (home mantém subscription real). `assertArquivoOwnership`/`assertPetOwnership` (em si) **não** mudam — só os callsites de leitura trocam de método. Mudança de comportamento de **conteúdo** em cupom/ebook (efeito da herança) é coberta por AC12c/AC12d e audit grep (task 20), sem editar esses arquivos; **diário não muda de conteúdo para o convidado** (Pro=2 < gate 3). Os services de prontuário só trocam o **caminho de leitura** (não a mutação); o shape de request/response **não muda** (D8).

Nenhum endpoint existente muda de **forma** (D8). Consumidores: `petjourney-app` — **comportamento muda** (tela Família + passa a receber 200+prontuário de pets do plano nas rotas existentes onde antes recebia 403; ver Pergunta 9 sobre feature flag e validação da tela); `petjourney-cms` (sem mudança obrigatória, mas ver Perguntas 5 sobre exibição de nível).

---

## Tasks Técnicas

0. **[BLOQUEADOR]** Parte 0 entregue (helper de código público com a interface mínima desta spec). Sem ela, tasks 7, 9, 11 não fecham. Confirmar assinaturas reais do helper no kickoff (Pergunta 6).
1. Confirmar helper de código público disponível em `src/common/...` e bater com o contrato mínimo. **[dep: 0]**
2. Editar `schema.prisma` (enums + 6 models + 3 colunas + relações reversas + `@@index([carenciaAte])`). `prisma migrate status` antes.
3. Gerar migration aditiva + SQL raw dos índices únicos parciais (membro por usuário; pendente única; convite ativo único) + índice `carenciaAte`. `prisma migrate dev` em Postgres local; smoke contra DB real. **[dep: 2]**
4. Atualizar `seed.ts` com limites **só em Premium** (não Freemium, D16; idempotente). **[dep: 2]**
5. Herança em `subscription.service.ts`: `getNivelHerdadoFamilia` (Pro=2 sse convidado de família ATIVA, **ou SUSPENSA dentro da carência**, com líder nível>=3, lendo líder sem herança; `now >= carenciaAte` não concede) + `getNivelForTutor = max()` **com try/catch interno resiliente**. Testes AC12-15, AC12e, AC15b (unit), AC42a/AC42b. **[dep: 2]**
6. Novos métodos no `OwnershipService` (param `userId`): `assertFamiliaMembership`/`assertFamiliaLeader`/`assertPodeLerRecursoDoPet`/`assertPodeLerRecursoPorId`/`assertPodeLerPetInline`/`assertPetCreateAccess` — **negar via `deny()`/`assert403` (não string crua; herda `OWNERSHIP_FORBIDDEN` da Parte 0); janela de concessão `ATIVA OU SUSPENSA && now < carenciaAte`; ramo de família gated por `FAMILIA_LEITURA_PRONTUARIO`** + specs (incl. regressão zero-famílias AC38, suspensa fora da carência não concede AC40m, **suspensa dentro da carência concede AC40n**, documento user-level de outro não concede AC40l, **documento user-level próprio concede AC40l2**, delegação ativa/expirada, **flag off = dono-only**). **[dep: 2]**
7. `FamiliaGatingGuard` (deriva de `familiaMaxMembros`, fail-closed). **[dep: 5]**
8. DTOs (`convite`, `add-pet`, `delegacao`) com class-validator. **[dep: 2]**
9. `familia.service.ts`: lazy-create, convidar/aceitar, add pet, pets-disponiveis, aprovar (algoritmo idempotente explícito)/recusar, remover pet/membro, delegar/revogar, **suspensão+carência runtime (lazy-write `suspensaEm`/`carenciaAte`, reativação idempotente)**, reuso de convite. Transações em multi-write. **[dep: 3,5,6,8]**
10. `familia-snapshot.mapper.ts` (allow-list, especiePet→especie, expõe `suspensaEm`/`carenciaAte`). **[dep: 9]**
11. `familia.controller.ts` (12 rotas, guards, 200/201/202, mensagens via catálogo i18n sem em-dash). **`@Throttle(PUBLIC_CODE_THROTTLE)` com `generateKey` por código (lockout por código, D15) em `POST /convites` e `POST /convites/:codigo/aceitar`; `@HttpCode(200)` explícito nos 3 DELETE.** AC44 (shape DELETE), AC de brute-force por código (429). **[dep: 9,10]**
12. **Cron `varrerCarenciaFamilia`** (`familia-carencia.cron.ts`): `@Cron` na janela 03h (mesma do downgrade de Freemium; `@nestjs/schedule` já no repo), seleciona `SUSPENSA AND carenciaAte <= now`, revalida nível do líder, reativa ou mantém, idempotente, não toca Subscription/webhook. Spec do cron (AC42c). **[dep: 5,9]**
13. **Leitura de prontuário/pet por família (Delta 1), atrás de `FAMILIA_LEITURA_PRONTUARIO`:** trocar o caminho de leitura (`findAll`/`findByPet`/`findOne`) em cada service de prontuário (vacina, consulta, diario-pet, medicamento, peso-registro, documents, diagnostico, alergia, tratamento-fixo) para `assertPodeLerRecursoDoPet`/`assertPodeLerRecursoPorId`; **no `pet.service` (`findOne`/`findOneWithAllInformation`) usar `assertPodeLerPetInline` (não re-buscar o pet) + redigir `email`/`telefone` do dono em `/allinfos` para não-donos.** **Documents:** curto-circuito p/ dono-direto quando `petId` null (concede `usuarioId === userId` para `petId` null OU não-null). **Não tocar** mutação. **Com a flag off, comportamento dono-only (verificar por AC).** AC40a-n/AC41/AC38c1-11 por recurso. **[dep: 6]**
14. Ajustar `TransformInterceptor` (message custom retrocompatível) + spec. **[dep: 11]**
15. Registrar `FamiliaModule` (+ cron) em `app.module.ts`. **[dep: 11,12]**
16. Unit + integração + smoke cobrindo AC1-43 (incl. AC12e, AC15b, AC23b, AC38b, AC40a-m, AC42, AC43). **[dep: 9,11,12,13]**
17. **`security-auditor` em todas as rotas novas E em cada rota de leitura de prontuário/pet trocada (Delta 1).** Cuidado com fechar parcial: rodar por recurso, confirmando que nenhuma das rotas de leitura (11 linhas da tabela de Escopo, list+detalhe) abriu acesso indevido, **incluindo a redação de PII em `/pet/allinfos` e o curto-circuito de documento user-level**. **[dep: 11,13]**
18. Swagger/Scalar. **[dep: 11,13]**
19. Entry em `docs/CHANGELOG.md`. **[dep: 11]**
20. **Audit grep como critério de aceite:** (a) callsites de `getNivelForTutor` (`cupom.service.ts:96`, `ebook.service.ts:72,98`, `diario-pet.service.ts:360`) — confirmar que nenhum quebra com a herança; que a expansão de acesso Pro do convidado em **cupom/ebook** é a esperada (AC12c/AC12d), não regressão; que **o diário NÃO ganha acesso** (Pro=2 < gate 3, só escrita) — anotar explicitamente, não tratar como expansão; e que nenhum callsite depende de `getNivelForTutor` lançar. (b) `assertPetOwnership`/`assertOwnsByUsuarioId`/`assert<Recurso>Ownership` nos services de prontuário e pet — confirmar que a troca para leitura por família atingiu **TODOS** os caminhos de leitura (list + detalhe) e **NENHUM** caminho de mutação; (c) confirmar que o **pet detalhe não regrediu para 2 queries** (continua query única + `assertPodeLerPetInline`, não `assertPodeLerRecursoDoPet`). **[dep: 5,6,13]**

> **i18n de erro via catálogo da Parte 0 (reconciliação D15):** as mensagens de **erro** da Família entram como chaves no `ERROR_CATALOG` (4 locales, en-GB explícito, sem em-dash); reusar `OWNERSHIP_FORBIDDEN`/`assert403`/`PUBLIC_CODE_INVALID` da Parte 0 e adicionar as chaves de negócio. Mensagens de **sucesso** seguem pt-BR no handler. A regra em-dash permanece em toda copy (incl. as novas entradas do catálogo) — gate por grep, AC39. Ver Requisitos Não-Funcionais.

---

## Considerações de Arquitetura

- **Herança sem tocar Subscription (D5):** centralizar `max()` em `getNivelForTutor` faz todo consumidor (cupom, ebook) ver o herdado sem mudança própria — **efeito global intencional** (seção dedicada). **Diário não é afetado para o convidado** (gate nível 3 só de escrita; Pro=2 não desbloqueia). `getSubscriptionInfoForTutor` deliberadamente **não** aplica `max()` (home exibe a assinatura real). Auditar callsites (task 20).
- **Herança resiliente:** o `try/catch` interno é arquitetural, não defensivo-por-acaso: os callsites de gating engolem exceção (`.catch(()=>0)`) ou chamam direto, então uma falha na resolução da família **não pode** virar "nível 0". Degrada para nível próprio. A asserção de resiliência é **unit** (Prisma mockado lança), não integração (não injetar falha em DB real).
- **Leitura por família via método consolidado (Delta 1):** em vez de espalhar a lógica de família em 9+ services, ela vive em `assertPodeLerRecursoDoPet`/`assertPodeLerRecursoPorId` no `OwnershipService` (chokepoint). Cada service de prontuário só troca a chamada no caminho de leitura. **Exceção do pet detalhe:** como o `pet.service` já consolidou a query (carrega o pet inteiro inline e tem o `ownerUsuarioId`), plugar `assertPodeLerRecursoDoPet` (que re-busca o pet) **desfaria** essa otimização do endpoint mais quente. Por isso há `assertPodeLerPetInline` (recebe o owner já carregado; só busca família quando o dono não bate). Mantém a regra de visibilidade num lugar só (testável, auditável) sem regressão de performance. Mutação fica em `assert<Recurso>Ownership`/`assertOwnsByUsuarioId` (inalterado) — a separação leitura/mutação é o que impede que a abertura de leitura vaze para escrita.
- **PII do dono redigida em `/pet/allinfos`:** o endpoint carrega `tutor.usuario.{nome,email,telefone}` para o dono ver os próprios dados; ao abrir por família, a redação de `email`/`telefone` para não-donos é feita no service (não no `OwnershipService`, que só autoriza). Mantém o contrato (mesmo shape; campos opcionais já são nullable) e evita vazamento de contato. `nome` é mantido porque o snapshot da família já o expõe entre membros.
- **Documento user-level (`petId` null):** a leitura por família é uma concessão "via pet"; sem pet não há família que conceda. `assertPodeLerRecursoPorId(documento)` curto-circuita para dono-direto quando `petId` null, o que também evita o NPE de `findUnique(null)`.
- **Suspensão com carência runtime + cron (Delta 2):** espelha o catch-up de Freemium em `getSubscriptionInfoForTutor` (lazy-write na leitura) e o cron de downgrade de Freemium (efetivador determinístico). O agendador (`@nestjs/schedule`) **já existe no repo** (não é dependência nova); o cron reusa a janela 03h. A leitura escreve `suspensaEm`/`carenciaAte`; a herança concede Pro só `ATIVA` ou `SUSPENSA && now < carenciaAte`; pós-carência a própria herança já não concede (catch-up), e o cron reconcilia/efetiva. Sem tocar o webhook nem a Subscription (D5). As colunas servem ao front e ao cron; a verdade é a leitura/cron. Evita transição órfã e janela de "Pro indevido pós-carência sem cron".
- **Erro de negócio no topo do JSON:** o `HttpExceptionFilter` espalha `...error`, então `reason`/`feature` vão no topo (não sob `data`), igual ao `code` já usado em `diario-pet`. Filter não muda.
- **Mensagem de sucesso no envelope:** handler retorna `{ message, data }`; interceptor passa a usar `message` quando presente, mantendo `'Operation successful'` como default (retrocompat). `@Res passthrough` rejeitado (acopla ao Fastify).
- **Desvio REST 204→200 nos DELETE:** deliberado — o contrato do front quer o snapshot atualizado em toda mutação (txt seção 9) para substituir estado local sem refetch. Justificado aqui para o próximo revisor não apontar como bug.
- **Reuso de convite:** `GET /familia/convite` é idempotente (reusa ativo), não gera lixo nem invalida links compartilhados; rotação só por expiração/consumo.
- **Índices únicos parciais via SQL:** Prisma não modela `WHERE` em unique; entram como `CREATE UNIQUE INDEX ... WHERE` na migration raw.

---

## Plano de Rollout / Rollback

**Rollout:** 1) `migrate deploy` (aditivo, zero downtime). 2) Seed dos limites (idempotente). 3) Deploy da API com `FamiliaModule` + cron de carência + a troca de leitura de prontuário/pet (Delta 1) — **só depois da Parte 0 em produção** e após `security-auditor` por rota. 4) App habilita a tela e passa a consumir prontuário de pets do plano nas rotas existentes. **Atenção de semântica observável (furo v0.4):** a troca de leitura faz rotas existentes retornarem `200 + dados` de pet alheio onde antes retornavam `403`. Antes do passo 4, **validar a tela de prontuário do app contra pets compartilhados** e decidir se a abertura precisa de um gate de rollout (feature flag) ou se o app já trata `200` corretamente (Pergunta 9). Se houver flag, a abertura por família fica atrás dela até o app estar validado.

**Rollback:** reverter deploy (rotas de família somem; a troca de leitura volta a `assertPetOwnership`/`assertOwnsByUsuarioId`, restaurando o isolamento dono-only — nada quebra). `getNivelForTutor` reverte a nível próprio (convidados degradam graciosamente; herança some). Cron de carência some sem efeito colateral (nunca deletou dados). Não dropar tabelas se já houver dados; se rollback pré-uso, `migrate resolve` + drop manual. Colunas em `Plano` são nullable/inertes, podem ficar.

---

## Observabilidade

- **Logs:** negações WARN (padrão `deny()`); sem PII. Concessões de leitura por família **não** logam por padrão (volume); só negações.
- **Métricas de negócio:** % de Premium que ativaram família; nº médio de convidados (query analítica sobre `MembroFamilia`/`FamiliaPlano`). Nº de famílias em carência/suspensas (`status=SUSPENSA`).
- **Abuso:** rate-limit de código emite contador; alerta em pico de 404 `INVITE_NOT_FOUND`.
- **Cron de carência:** logar nº de famílias varridas, reativadas e mantidas SUSPENSA por execução. Alerta se a varredura falhar (não pode deixar família presa pós-carência).
- **Slow routes:** `logger.middleware.ts` já cobre; snapshot e rotas de prontuário abaixo do limiar com `select` controlado. Monitorar as rotas de leitura de prontuário após a troca (1 query extra de família). O pet detalhe **não** ganha query extra no caminho do dono (`assertPodeLerPetInline` só busca família no fallback) — confirmar que o endpoint quente não regrediu (task 20c).

---

## Definition of Done

- [ ] **Parte 0 em produção** (pré-requisito).
- [ ] Migration aditiva aplicada com índices únicos parciais (membro/usuário; pendente única; convite ativo único) + índice `carenciaAte`; smoke contra DB real.
- [ ] Seed liga limites só em Premium (não Freemium, D16).
- [ ] 12 rotas de família retornando snapshot atualizado, envelope `{ statusCode, message, data }` (message custom respeitada).
- [ ] Gating 403 `FEATURE_NOT_INCLUDED` por plano efetivo do líder, fail-closed.
- [ ] Herança `max()` **resiliente**: convidado=2, sem loop, suspensa fora da carência não herda, **falha de família degrada para nível próprio sem lançar (AC15b, unit)**; **diário não desbloqueia para convidado (AC12e)**; webhook intacto (smoke).
- [ ] **Leitura de prontuário/pet por família (Delta 1):** membro de família ATIVA lê (read-only) vacina/consulta/diário/medicamento/peso/documento/diagnóstico/alergia/tratamento-fixo e `GET /pet/:id` dos pets do plano (AC40a-j); **`/pet/allinfos` sem `email`/`telefone` do dono (AC40k)**; **documento user-level negado por família (AC40l)**; família suspensa não concede (AC40m); mutação de pet alheio bloqueada (AC41); regressão dono-only por rota provada (AC38c1-11). `security-auditor` rodado **por recurso**.
- [ ] **Pet detalhe usa `assertPodeLerPetInline` (não re-busca o pet); endpoint quente não regrediu para 2 queries (audit task 20c).**
- [ ] **Carência da suspensão (Delta 2):** queda do líder → `SUSPENSA` com `FAMILIA_CARENCIA_DIAS` (default 7d); Pro mantido na carência (AC42a); rebaixa pós-carência com catch-up na leitura mesmo sem cron (AC42b); cron `varrerCarenciaFamilia` (via `@Cron`, `@nestjs/schedule` já no repo) idempotente reativa/mantém (AC42c); reativação dentro e fora da carência (AC43a/AC43b); nunca deleta dados; não toca Subscription/webhook.
- [ ] Mudança de comportamento global (acesso Pro do convidado em **cupom/ebook**, diário fora) coberta por AC12c/AC12d/AC12e e audit grep (task 20).
- [ ] `OwnershipService` evoluído (read por família + create-only por delegação), param `userId`; regressão zero-famílias provada (AC38).
- [ ] Aprovação idempotente sem depender de catch de P2002 (AC23b).
- [ ] Reuso de convite (não rotaciona a cada GET) provado (AC11b).
- [ ] Delegação create-only (create ok, edit/delete 403, expira/revoga).
- [ ] Limites enforçados (pendentes contam); remover pet/membro não apaga `Pet` real.
- [ ] 1 família ativa por usuário garantida no banco.
- [ ] AC1-43 (incl. AC11b/AC12c/AC12d/AC12e/AC15b/AC20a/AC20b/AC23b/AC38b/AC38c1-11/AC40a-m/AC42/AC43) cobertos (unit + integração); smoke vivo passa.
- [ ] `npm test` e `npm run lint` limpos.
- [ ] Nenhuma copy com em-dash; mensagens em pt-BR (sem requisito de i18n de exceptions — alinhado ao repo); strings dos `throw` revisadas isoladamente (AC39).
- [ ] **Feature flag `FAMILIA_LEITURA_PRONTUARIO` implementada (D15): default off em prod; com a flag off, `assertPodeLerRecursoDoPet`/`assertPodeLerPetInline`/`assertPodeLerRecursoPorId` se comportam como ownership dono-only (ramo de família só avaliado com a flag on); delegação NÃO é gated pela flag.** `petjourney-app` validado contra pets compartilhados antes de ligar a flag em prod (Pergunta 9, fechada por D15).
- [ ] **Defesa por código (D15) entregue nas rotas públicas por código:** `@Throttle` com balde nomeado por código (`generateKey` chaveando `:codigo`/`body.codigo`) em `POST /convites/:codigo/aceitar` e `POST /convites`; AC de brute-force (N tentativas inválidas do mesmo alvo → 429). Lockout por código satisfaz D15 mesmo sem Redis (Redis-first opcional, não conflita).
- [ ] **Leitura por família alinhada à herança de Pro na carência:** concede em `ATIVA OU (SUSPENSA && now < carenciaAte)`; fora da carência não concede (AC40m/AC40n).
- [ ] **Mensagens de erro pelo catálogo i18n da Parte 0** (`OWNERSHIP_FORBIDDEN`/`assert403`, `PUBLIC_CODE_INVALID`→`INVITE_NOT_FOUND`, chaves de negócio adicionadas ao `ERROR_CATALOG` em 4 locales com en-GB explícito, sem em-dash); novos métodos negam via `deny()`/`assert403` (nunca string crua).
- [ ] **Remoção de membro confia em `onDelete: Cascade` (não delete manual); remoção de pet revoga delegações atomicamente (sem cascade via `FamiliaPet`)** — AC29b/AC28b.
- [ ] **Gatilho garantido de início de carência:** herança (`getNivelHerdadoFamilia`) escreve suspensão ao detectar líder caído + cron varre `ATIVA` órfã (AC38d/AC38e); nenhuma família `ATIVA` presa com líder `< 3`.
- [ ] **`DELETE` 2.9/2.10/2.12 com `@HttpCode(200)` explícito retornando `{ message, data: snapshot }`** (AC44).
- [ ] `security-auditor` rodado; Swagger atualizado; CHANGELOG; audit grep dos callsites (incl. cobertura total leitura vs mutação, e pet detalhe sem regressão de query).

---

## Perguntas em Aberto

1. **[RESOLVIDA na v0.5 — leitura na carência alinhada à herança]** `FAMILIA_CARENCIA_DIAS = 7` (D15). **Decisão tomada (Regra 4 + AC40m/AC40n):** durante a carência o **acesso de leitura de prontuário por família é mantido junto com o Pro herdado** — leitura e nível efetivo abrem/fecham na **mesma janela** `ATIVA OU (SUSPENSA && now < carenciaAte)`. `assertPodeLerRecursoDoPet`/`assertPodeLerPetInline` tratam `SUSPENSA && now < carenciaAte` como "ainda lê". Era incoerente manter Pro e cortar leitura no instante da suspensão; a v0.5 corrige. Resta a confirmar apenas: **notificação/push** ao líder na suspensão (está no backlog do épico, fora desta parte).
2. **Domínio do link:** `FAMILIA_INVITE_BASE_URL` placeholder `https://petjourney.health`. Confirmar antes do deploy.
3. **Expiração e rotação do convite:** `FAMILIA_CONVITE_TTL_DIAS` default 30d. Esta spec já trava **reuso do convite ativo** (não rotaciona a cada GET). Confirmar a janela de 30d e se há algum gatilho de rotação manual desejado (ex.: botão "gerar novo link" que invalida o anterior).
4. **Granularidade da leitura por família:** esta parte concede leitura de **todo** o prontuário (todos os recursos) a todos os membros. Confirmar com o Nicolas se algum recurso é sensível o bastante para ficar **fora** da leitura compartilhada (ex.: documentos com PII de terceiros). Default desta spec: tudo compartilhado read-only entre membros da família ATIVA; **documento user-level (sem pet) já fica fora por construção** (só dono-direto).
5. **Divergência "nível efetivo" vs "subscription real" no CMS/suporte:** o gating passa a usar `max()` (herança), mas `getSubscriptionInfoForTutor` (home) mantém a subscription real. Um convidado aparece como Pro no gating sem ter subscription Pro. **Decisão de produto:** o CMS/suporte deve exibir o nível efetivo (com herança) ou a assinatura real? E deve mostrar um indicador "Pro via família" para não confundir o suporte? (Verificar se o CMS consome `getNivelForTutor` ou `getSubscriptionInfoForTutor`.)
6. **[RESOLVIDA na v0.5 — contrato real do helper da Parte 0]** A API real é o **`PublicCodeService`** (`gerar(isTaken)` + `resolveAtivoOrThrow(codigo, findByCodigo)`, lançando `LocalizedException('PUBLIC_CODE_INVALID', 404)`), agnóstico de tabela. **`ConviteFamilia` é tabela própria desta parte** (a Parte 0 não expõe tabela de convite — "cada parte tem a sua tabela com a coluna de código"). A Parte 2 é dona da persistência (calcula `expiraEm`, grava/lê a linha). Ver [Dependência da Parte 0](#dependência-da-parte-0-contrato-mínimo). Resta só confirmar o **path de import** do `PublicCodeService` no kickoff (detalhe de localização, não de contrato).
7. **Pet vinculado por dois membros:** impossível hoje (1 `tutorId`); se N-N de tutores surgir, `@@unique([familiaId, petId])` precisa revisão. Confirmar que segue fora de escopo.
8. **Janela do cron de carência:** o agendador (`@nestjs/schedule`) **já está no repo** (package.json:54) e há crons na janela 03h (`inactivation.cron.ts`, downgrade de Freemium em `plano.service.ts:110`). Recomendação: **rodar `varrerCarenciaFamilia` na mesma janela/agendador (03h)** para reaproveitar a infra. Confirmar com o Nicolas só se prefere janela separada (o catch-up na leitura é rede de segurança, não substituto do cron — o cron é entrega firme).
9. **[RESOLVIDA por D15 — feature flag obrigatória]** D15 decidiu: a leitura de prontuário por família **nasce atrás da feature flag `FAMILIA_LEITURA_PRONTUARIO`** (default **off** em prod) até o app validar as telas com pets compartilhados. Ver [Feature flag de rollout](#feature-flag-de-rollout-d15). Não é mais decisão em aberto: é requisito firme no contrato/DoD. Resta só a operação: validar a tela do app e então ligar a flag em prod (passo 4 do rollout).

10. **Blindar o callsite ebook contra tutor-inexistente (novo — Finding):** `getNivelForTutor` lança `NotFoundException` para tutor inexistente (comportamento pré-existente, preservado — ver Regra 2/AC15c). O **ebook** chama direto sem `.catch` (`ebook.service.ts:72,98`), enquanto cupom mascara com `.catch(()=>0)`. Um `tutorId` inválido chegando ao ebook propagaria 404/500. **Decisão de produto/eng:** envolver o caminho tutor-inexistente do ebook também (ex.: `.catch(()=>0)`), padronizando com o cupom? Esta parte **não** muda o contrato de erro do ebook por padrão (é comportamento atual, não regressão da herança). Confirmar com o Nicolas se quer padronizar agora.

11. **Freemium pode ser líder de família? (novo — Finding):** o gating liga com `familiaMaxMembros != null`, ativo em Premium **e Freemium** no seed. Freemium é trial efêmero que faz downgrade para Básico ao expirar, então um líder Freemium cria família e, ao fim do trial, a família suspende/entra em carência (declarado e coberto por AC43c). **RESOLVIDA por D16 (Nicolas, 2026-06-24): NÃO.** Família é só Premium (nível 3). Freemium não pode ser líder porque o trial expira e derrubaria a família. O seed põe `familiaMaxMembros` só no Premium, não no Freemium; assim o ciclo trial para suspensão deixa de ser um caminho possível para o líder.

---

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-06-24 | 0.6 | D16: família só Premium (Freemium não pode ser líder); seed põe `familiaMaxMembros` só no Premium. | Claude + Nicolas |
| 2026-06-24 | 0.5 | Reconciliação com D15 + correção dos achados de auditoria: concorrência do convite LINK_LIDER (multi-uso até a família encher), `getNivelForTutor` resiliente vs `NotFoundException` legado, race de remover-membro, líder Freemium (trial expira), leitura na carência alinhada à herança, lazy-write de suspensão respaldado por cron. Leitura de prontuário por família atrás de feature flag `FAMILIA_LEITURA_PRONTUARIO`. | Claude + Nicolas |
| 2026-06-24 | 0.4 | Reconciliação r2: leitura de prontuário por família + carência da suspensão entram no escopo. | Claude + Nicolas |