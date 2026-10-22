# Spec: Contrato das rotas novas (erros com código, fuso, idempotência) e proteção das rotas públicas

**Status:** Concluído (API em dev, 2026-10-21; nada usa os decorators até a primeira rota de domínio)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.4
**Handoff:** [portal-parceiro-e1.md](../../../../../../frontend/novembro-2026/portal-parceiro-e1.md), seção 3
**Épico:** [E1 fundação](../../../../../epicos/portal-parceiro-e1-fundacao.md)
**Depende de:** [E1-01 perfil](01-perfil-publico-do-estabelecimento.md) (fuso do estabelecimento)

---

## Visão Geral

As convenções que toda rota dos módulos Clínica e Hotel segue, entregues como infraestrutura reaproveitável e testada antes da primeira rota de domínio:

1. **Erro com `codigo` estável** no corpo, além da `message` localizada.
2. **Data e hora no fuso do estabelecimento**, em ISO 8601 com offset.
3. **Prefixos** das rotas (A3 do épico pai).
4. **Idempotência** por header nas criações que o cliente pode repetir.
5. **Limite de taxa distribuído** (no Postgres) e **captcha** nas rotas públicas que escrevem.
6. **CORS** que deixa o portal mandar os headers que essas rotas usam.

## Motivação

- O contrato do portal decide a tela pelo `codigo` (`CodigoDeErroClinico`, `petjourney-admin/src/features/clinico/contrato/responsavel.ts:64-92`): `HORARIO_INDISPONIVEL`, `RESERVA_EXPIRADA`, `OFERTA_EXPIRADA`, `VAGA_JA_PREENCHIDA`, `SOMENTE_LEITURA`... Hoje o `HttpExceptionFilter` remove o `errorKey` do payload (inventário 3.6) e o portal decide por `statusCode` + `reason` só no funil do parceiro (`src/service/api.ts:9-21` do portal).
- O throttler é em memória por réplica (`app.module.ts:67`), sem captcha e sem `Idempotency-Key` (inventário 3.8 e 3.11). O pedido de horário e a reserva de hotel pelo link público são escrita anônima: herdariam o furo D15 já registrado em `compartilhamento-prestador-publico.controller.ts:15-18`.
- O CORS de produção só libera `Content-Type`, `Authorization`, `Accept` e `Accept-Language` (`main.ts:151`).

---

## Research Findings

- `LocalizedException(errorKey, status, extra?)` (`src/common/errors/localized-exception.ts`), `ERROR_CATALOG` com 197 chaves (`error-catalog.ts:288`), resolvido no `HttpExceptionFilter` pelo `Accept-Language`.
- Cursor opaco com escopo: `codificarCursor`/`decodificarCursor` (`src/parceiro-portal/cursor-opaco.helper.ts:43,55`).
- Rota pública: `// PUBLIC:` acima do decorator, conferido por `scripts/audit-endpoints.ts`.
- IP real: `TRUST_PROXY_HOPS` (`main.ts:52`) e `ipParaSinal` para tráfego que chega pelo proxy do Next do site (`src/sinais-cliente/helpers/classificar-cliente.helper.ts`, memória `project-site-passa-por-proxy-ip`).
- Lock distribuído existente: `pg_try_advisory_xact_lock` (`src/notificacao/helpers/advisory-lock.helper.ts:42,61`). Não há Redis no projeto.

**Breaking changes:** nenhuma. O `codigo` é campo novo no corpo de erro (aditivo). O CORS só ganha headers.

## Decisões

- **D1 `codigo` estável.** `LocalizedException` ganha o parâmetro opcional `codigo` (UPPER_SNAKE). O filtro o mantém no corpo (`{ statusCode, message, error, codigo?, timestamp, path }`). A lista de códigos clínicos vive em `src/common/errors/codigos-clinicos.ts`, exportada no OpenAPI como enum, e é **única** para Clínica e Hotel.
- **D2 Prefixos.**
  - Parceiro: `/parceiro/portal/estabelecimento/*`, `/parceiro/portal/profissionais/*`, `/parceiro/portal/pacientes/*`, `/parceiro/portal/clinica/*`, `/parceiro/portal/hotel/*`.
  - Responsável: `/tutor/clinica/*` e `/tutor/hotel/*`, que já são os do contrato do portal.
  - Público: `/public/estabelecimentos/:slug/*`, com acompanhamento sem conta em `/public/pedidos/:token` (clínica) e `/public/reservas/:token` (hotel). O `/publico` do portal vira `/public` (handoff).
- **D3 Datas.** Entrada `YYYY-MM-DD` e `HH:mm` são da parede do estabelecimento; data-hora sai sempre em ISO com o offset daquele instante no fuso do estabelecimento (`isoNoFuso`, da E1-01). Nunca UTC "Z" em rota de agenda ou hotel.
- **D4 Idempotência.** Header `Idempotency-Key` (UUID v4) aceito nas criações marcadas com `@Idempotente()`. A tabela guarda `(escopo, chave)` com o hash do corpo e a resposta por 24 h: a mesma chave com o mesmo corpo devolve a resposta anterior; com corpo diferente, 422 `CHAVE_DE_IDEMPOTENCIA_REUSADA`.
- **D5 Limite distribuído.** Um `ThrottlerStorage` sobre Postgres para os baldes nomeados das rotas públicas que escrevem (`@ThrottlePublico('pedido', 5, '10m')`), com chave por IP real e por slug. As rotas internas continuam no throttler em memória de hoje. A mesma storage resolve o D15 do acesso temporário, se o Nicolas quiser ligar lá (fora do escopo, follow-up).
- **D6 Captcha.** Cloudflare Turnstile (gratuito, sem rastreamento publicitário) nas escritas públicas, verificado no servidor com `TURNSTILE_SECRET`. Flag `PUBLIC_CAPTCHA_ENABLED`, ligada no `.env` de dev com a chave de teste da Cloudflare e desligada no `.env.example` (memória "flags de dev nascem ligadas").
- **D7 CORS.** `allowedHeaders` ganha `Idempotency-Key` e `X-Timezone`. O fuso do estabelecimento não depende do header (D-E1.2); o header serve para o app do responsável mostrar "horário da clínica" quando o aparelho estiver em outro fuso.

## Decisões da implementação (2026-10-21)

- **I1 `codigo` sem parâmetro novo.** O `HttpExceptionFilter` já espalha o extra no corpo; `new LocalizedException(chave, status, { codigo })` basta, e a onda 0 já usa. `CODIGOS_CLINICOS` e o `ErroDaApiDto` (enum no OpenAPI) ficam em `src/common/errors/codigos-clinicos.ts`.
- **I2 Limite por guard próprio**, não por `ThrottlerStorage` do Nest.
  - `@ThrottlePublico(nome, { porIp, porSlug?, janela })` usa um guard próprio sobre o `TaxaService` (`INSERT ... ON CONFLICT ... RETURNING` numa janela fixa).
  - Separa o limite por IP do limite por estabelecimento: um teto único de 5 travaria a clínica depois de 5 pedidos de pessoas diferentes.
  - Janela fixa: na virada cabe até 2x o limite; o captcha segura o resto.
  - `BaldeDeTaxa` é `UNLOGGED` (escrito à mão na migration).
- **I3 Idempotência:**
  - interceptor de rota, dentro do envelope global (guarda o corpo cru, repete com o mesmo status);
  - header opcional;
  - o escopo leva método, rota e usuário (ou IP);
  - falha do handler libera a chave.
  - A poda diária não usa advisory lock: `deleteMany` por data é idempotente entre réplicas.
- **I4 Captcha:**
  - token no header `X-Captcha-Token` (no corpo, o `forbidNonWhitelisted` exigiria o campo em todo DTO);
  - sem `PUBLIC_CAPTCHA_ENABLED`, liga só em dev, com a chave de teste pública da Cloudflare, sem mexer no `.env`;
  - ligado em produção sem segredo falha fechado (503).
- **I5 CORS:** `Idempotency-Key`, `X-Captcha-Token` e `X-Timezone`, em dev e em produção.
- **I6 Contrato de datas (T6):** `datasEmUtc()` (`src/common/utils/datas-com-offset.ts`) acha data-hora em "Z" ou `Date` cru numa resposta; a página pública da E1-01 já é conferida com ela. Cada rota de Clínica e Hotel usa a mesma asserção no seu teste. Ainda não há rota clínica para varrer.
- **I7 Origem por /64 e balde do estabelecimento só depois do captcha** (achado M9 da auditoria da onda 1, 2026-10-21).
  - A chave do balde por IP é `origemDaTentativa(req.ip)` (`src/common/seguranca/limite-por-origem.ts`, a mesma do `@LimitePorOrigem`): IPv4 inteiro, IPv6 pelo /64, IPv4 mapeado volta a ser IPv4. Com o IP cru, quem tem um /64 trocava de endereço a cada pedido e zerava o limite.
  - Ordem no `TaxaPublicaGuard`: balde da origem, depois o captcha (quando a rota tem `@ExigeCaptcha()`), e só então o balde do slug. Antes, um robô sem captcha esgotava o balde de uma clínica e ela parava de receber pedidos de verdade.
  - O captcha é verificado uma vez por requisição (`TurnstileService.verificarRequisicao` marca a requisição; a Cloudflare aceita cada token uma vez só), então `@ThrottlePublico` e `@ExigeCaptcha` funcionam em qualquer ordem de decorator. Interceptors (o `@Idempotente`) rodam depois dos guards: não gastam balde.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Spam ou robô enchendo a caixa de pedidos da clínica pelo link público | Captcha + balde por IP e por slug no Postgres + cadastro mínimo validado (telefone com DDD) + teto por telefone por dia |
| Médio | Storage de taxa no Postgres virar gargalo | Só nas rotas públicas que escrevem (volume baixo); tabela com `UNLOGGED` e limpeza horária; `INSERT ... ON CONFLICT DO UPDATE` numa linha por balde e janela |
| Médio | Cliente reusar chave de idempotência com corpo diferente | 422 com código próprio; teste dedicado |

## Modelo de dados (aditivo)

```prisma
model ChaveIdempotencia {
  escopo        String   // "POST /tutor/clinica/pedidos:usuarioId"
  chave         String
  hashCorpo     String
  status        Int?
  resposta      Json?
  criadaEm      DateTime @default(now())
  @@id([escopo, chave])
  @@index([criadaEm])
}

model BaldeDeTaxa {
  chave     String   // "pedido:ip:1.2.3.4" ou "pedido:slug:clinica-x"
  janela    DateTime // início da janela
  contagem  Int
  @@id([chave, janela])
}
```

## Acceptance Criteria

- [x] **Given** uma rota que lança `LocalizedException(chave, status, { codigo })` **Then** o corpo tem `codigo` e `message` no idioma do `Accept-Language`. **Atendido** (spec do filtro com `MODULO_INATIVO` em en-GB; smoke da onda 0).
- [x] **Given** a mesma `Idempotency-Key` e o mesmo corpo em dois `POST` **Then** o segundo devolve o mesmo status e corpo do primeiro, sem criar nada. **Atendido** (unit do interceptor; integração com dois `POST` simultâneos).
- [x] **Given** a mesma chave com corpo diferente **Then** 422 `CHAVE_DE_IDEMPOTENCIA_REUSADA`. **Atendido** (unit, integração).
- [x] **Given** 6 pedidos públicos do mesmo IP em 10 minutos para o mesmo slug **Then** o sexto recebe 429, **mesmo com as requisições distribuídas em 3 réplicas**. **Atendido** (integração: 3 módulos Nest com pools próprios no mesmo banco, exatamente 5 passam).
- [x] **Given** `PUBLIC_CAPTCHA_ENABLED=true` e token inválido **Then** 400 `CAPTCHA_INVALIDO`, sem gravar nada (o guard roda antes do handler). **Atendido** (unit com a Cloudflare simulada).
- [ ] Em produção, o preflight `OPTIONS` com `Access-Control-Request-Headers: idempotency-key` passa.
- [x] Toda data-hora das rotas novas sai com offset. **Atendido para o que existe** (I6: a página pública da E1-01 passa por `datasEmUtc`); cada rota clínica nova repete a asserção.

## Estratégia de Testes

- Unit: filtro com `codigo`, decorator de idempotência (repetida, corpo diferente, expirada), storage de taxa (janela, virada), verificação do Turnstile (sucesso, falha, timeout com resposta 503 e sem gravar).
- Integration: concorrência de taxa com 3 instâncias; idempotência sob dois `POST` simultâneos (unique da PK resolve).
- Cenário: rota pública sem captcha com a flag ligada.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `src/common/errors/localized-exception.ts`, `src/common/filters/http-exception.filter.ts` | Modificar (`codigo`) |
| `src/common/errors/codigos-clinicos.ts` | Criar |
| `src/common/idempotencia/` (decorator, interceptor, service, cron de limpeza) | Criar |
| `src/common/taxa/` (storage Postgres, decorator `@ThrottlePublico`) | Criar |
| `src/common/captcha/turnstile.service.ts` | Criar |
| `src/main.ts` | Modificar (CORS) |
| `prisma/schema.prisma` + migration | Modificar |
| `.env.example` | Modificar (`PUBLIC_CAPTCHA_ENABLED=false`, `TURNSTILE_SECRET=`) |

## Tasks

- [x] **T1** `codigo` no erro + lista de códigos + OpenAPI (I1)
- [x] **T2** Idempotência (tabela, interceptor, limpeza diária; sem advisory lock, I3)
- [x] **T3** Storage de taxa no Postgres + decorator (I2)
- [x] **T4** Turnstile + flag (I4)
- [x] **T5** CORS (I5)
- [x] **T6** Teste de contrato de datas com offset (I6; roda no `npm test` do CI)

## Rollout / Rollback

Aditivo. Nada usa os decorators até a primeira rota de domínio. Rollback: reverter; tabelas sem uso.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementada; decisões I1 a I6. Migration `20261021093000_idempotencia_e_balde_de_taxa` | Claude |
| 2026-10-21 | 0.3 | Auditoria de segurança da onda 1: I7 (balde por origem /64; balde do slug só depois do captcha válido; achado M9) | Claude |
| 2026-10-21 | 0.4 | Idempotência (M1): escopo pelo caminho concreto, com o parceiro conferido pelos guards (a mesma chave em `/pacientes/P1/alertas` e `/P2/alertas`, ou em dois parceiros, nunca colide). `@Idempotente({ releitura: true })` guarda só o id do que foi criado e, na repetição, o handler relê pelo service (com ownership): nenhuma resposta com dado pessoal fica 24 h na tabela | Claude |
