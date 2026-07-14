# i18n — Etapa 1: Descoberta e Mapeamento

> Inventário do estado atual do projeto antes de qualquer alteração.
> Base para as decisões de arquitetura e tradução (ver seção **8. Decisões pendentes**).
> Gerado a partir de leitura completa de `src/` em 2026-06-08.

> ⚠️ **Nota de atualização (2026-06-08):** a decisão **D1** (locale na URL, `app/[locale]/`,
> `localePrefix: as-needed`, `/en` `/es`) foi posteriormente **REVERTIDA** a pedido do
> stakeholder. O projeto usa next-intl **sem locale na URL** — idioma por cookie `NEXT_LOCALE`,
> rotas direto em `src/app/`, sem middleware/proxy. Trechos abaixo que descrevem o esquema com
> `[locale]` são históricos; ver `i18n-review.md` para a arquitetura final.

---

## 1. Resumo executivo

- **Stack:** Next.js `16.1.6` (App Router) + React `19.2.3` + Tailwind v4 + GSAP. `reactCompiler: true`.
- **i18n hoje:** **inexistente.** Nenhuma biblioteca instalada, nenhum arquivo de mensagens, nenhum roteamento por locale. Todo texto está **hardcoded em JSX** (pt-BR), incluindo dentro de arrays de dados (`PASSOS`, `FEATURES`, `SLIDES`, `valores`, `TEAM_MEMBERS`, etc.) e em objetos `metadata` de SEO.
- **`<html lang="pt">`** fixo em [src/app/layout.tsx](../../src/app/layout.tsx#L65).
- **Volume estimado:** ~900–1.100 strings traduzíveis, das quais ~450 estão concentradas em **2 documentos jurídicos** (termos + privacidade).
- **Idioma origem:** pt-BR → destinos `en` e `es`.

---

## 2. Estrutura de rotas atual

Sem segmento de locale. Dois route groups:

```
src/app/
├── layout.tsx                    # root: <html lang="pt">, metadata global, GTM/GA
├── not-found.tsx                 # 404 global
├── sitemap.ts                    # 10 rotas hardcoded, sem locale
├── globals.css
├── (landing)/                    # layout com Header + Footer
│   ├── layout.tsx
│   ├── page.tsx                  # Home
│   ├── tutor/page.tsx
│   ├── clinicas/page.tsx
│   ├── contato/page.tsx
│   ├── sobre-nos/page.tsx
│   ├── artigos/page.tsx
│   └── artigos/[id]/page.tsx
└── (public)/                     # layout vazio (sem header/footer)
    ├── layout.tsx
    ├── cadastro/{page,layout}.tsx
    ├── lista-espera/page.tsx
    ├── baixar-app/{page,layout}.tsx
    ├── linktree/page.tsx
    ├── privacidade/page.tsx
    ├── termos/page.tsx
    ├── exclusao/page.tsx
    └── public/[slug]/{page,not-found}.tsx   # carteirinha pública (dados via API)
```

**Implicação:** adotar roteamento por locale (`/en`, `/es`) exige mover `(landing)` e `(public)` para dentro de `app/[locale]/` e ajustar `middleware`, `sitemap`, todos os `Link href` internos e os `window.open('/cadastro')`. É a parte mais invasiva da migração (ver decisão D1).

---

## 3. Inventário por arquivo

Legenda: **C** = Client Component, **S** = Server Component, **API** = contém conteúdo dinâmico vindo do backend.

### Layout / chrome global

| Arquivo | Tipo | Strings | Observações |
|---|---|---|---|
| `app/layout.tsx` | S | ~10 | `metadata` global (title template, description, keywords[8], OG, Twitter). `<html lang>` fixo. |
| `components/header/index.tsx` | C | 6 | Nav em array `headerItems`; "Cadastre-se" ×2 (desktop/mobile); `window.open('/cadastro')`. |
| `components/footer/index.tsx` | C | 12 | Newsletter (input + 3 toasts), nav repetida, copyright, links legais. |
| `components/PublicMinimalHeader.tsx` | S | 1 | `voltarLabel` (prop com default "← Voltar ao site"). |

### Home (`(landing)/page.tsx` + componentes)

| Arquivo | Tipo | Strings | Observações |
|---|---|---|---|
| `(landing)/page.tsx` | C | ~14 | Seção Segurança (4 cards em array inline), CTA final, "Comece grátis agora"/"Saiba mais". |
| `components/home/HeroSection.tsx` | C | 4 | H1, subtítulo, 2 CTAs. |
| `components/home/HowItWorksSection.tsx` | C | ~11 | Array `PASSOS` (3× titulo/descricao/tempo) + eyebrow/título/subtítulo. |
| `components/home/ComparisonTableSection.tsx` | C | ~14 | Array `FEATURES` (8 linhas) + cabeçalhos + "parcial" + CTA + nota. |
| `components/home/AppTourSlideshow.tsx` | C | ~70 | Array `SLIDES` (**10 slides** × eyebrow/titulo/descricao/3 bullets/alt) + CTA + aria-labels. **Maior componente da home.** |
| `components/home/articles-section.tsx` | C + API | 4 | "Artigos", descrição, "Ler mais". Títulos dos artigos vêm da **API**. |
| `components/home/carousel-wrap.tsx` | C | 1 | Apenas `alt="Apoiador"`. |

### Páginas landing

| Arquivo | Tipo | Strings | Observações |
|---|---|---|---|
| `(landing)/tutor/page.tsx` | C | ~48 | Arrays `funcionalidades`(6), `passos`(3), `beneficios`(4) + hero + CTA. **Sem `metadata` próprio.** |
| `(landing)/clinicas/page.tsx` | C | ~58 | Arrays whiteLabel/rpm/vet (3 cada) + lista bullets + benefícios. Sem metadata. |
| `(landing)/contato/page.tsx` | C | ~42 | Form completo (labels, placeholders, validações, toasts), `assuntos`(4), email de contato. |
| `(landing)/sobre-nos/page.tsx` | C | ~72 | Arrays `valores`(6, com `\n`), `jornada`(4), `TEAM_MEMBERS`(6 bios longas), manifesto(6), slogan. **Maior página.** |
| `(landing)/artigos/page.tsx` | C + API | ~32 | UI de busca/filtro/paginação estática; artigos+categorias via **API**; datas `toLocaleDateString("pt-BR")`. |
| `(landing)/artigos/[id]/page.tsx` | C + API | ~18 | UI estática (back link, "Outros Artigos"); corpo via **`dangerouslySetInnerHTML`** (API); `getCategoryColor()` com 6 categorias hardcoded; 2 formatos de data. |

### Páginas públicas

| Arquivo | Tipo | Strings | Observações |
|---|---|---|---|
| `(public)/cadastro/page.tsx` | C | ~12 | Objeto `PAINEL` (3 features) + headings. `\n` literal no título. |
| `(public)/cadastro/layout.tsx` | S | 4 | **`metadata`** (title/description + OG). |
| `(public)/lista-espera/page.tsx` | C | ~35 | Form + validações + dropdown perfis + modal sucesso + hero. |
| `(public)/baixar-app/page.tsx` | C | ~6 | **Interpolação** `${primeiroNome}`; copy condicional (post-signup via sessionStorage). |
| `(public)/baixar-app/layout.tsx` | S | 2 | **`metadata`**. |
| `(public)/linktree/page.tsx` | C | ~15 | CTAs, slogan, mensagem WhatsApp URL-encoded, aria-labels sociais. |
| `(public)/exclusao/page.tsx` | S | ~35 | **`metadata`** + arrays `exclusaoItems`/`desativacaoItems` (4 cada). |
| `(public)/privacidade/page.tsx` | S | **~200+** | **`metadata`** + documento jurídico longo. `<strong>` inline, listas, emails, data hardcoded. **Alto esforço.** |
| `(public)/termos/page.tsx` | S | **~250+** | **`metadata`** + maior documento. Seções 1–23, `<strong>`/`<em>`, refs regulatórias (LGPD/HIPAA/GDPR). **Esforço muito alto.** |
| `(public)/public/[slug]/page.tsx` | S + API | ~70 | `generateMetadata()` dinâmico. Muitos **mapas de label** (ESPECIE/PORTE/SEVERIDADE/etc.), `countLabel()` com **pluralização**, datas, idade. Dados do pet via **API**. |
| `(public)/public/[slug]/not-found.tsx` | S | 5 | Carteirinha não encontrada. |
| `app/not-found.tsx` | S | 4 | 404 global com emoji. |

### Componentes de formulário / modais

| Arquivo | Tipo | Strings | Observações |
|---|---|---|---|
| `components/waitlist-modal/index.tsx` | C | ~22 | Form lista de espera + validações + toasts + `perfis`(4). |
| `components/cadastro/SignupForm.tsx` | C | ~28 | Form signup + validações + **tabela `TRADUCOES_ERRO`** (regex→pt para erros do backend) + requisitos de senha. |
| `components/cadastro/DownloadAppPanel.tsx` | C | ~8 | Copy condicional `postSignup` + interpolação de email. |
| `components/IPhoneMockup.tsx` | S | ~22 | **UI mock sintética** (nomes "Rex"/"Mia", remédio "Bravecto", meses abreviados). Ver decisão D-escopo. |

### Sem texto traduzível

`transition-link`, `PageSlideIn`, `GoogleAnalytics`, `lib/*` — sem strings de UI.

---

## 4. Sintaxe especial e padrões encontrados

| Padrão | Onde | Risco / tratamento |
|---|---|---|
| **Interpolação** `${var}` | `baixar-app` (`primeiroNome`), `DownloadAppPanel` (email), carteirinha (nome do pet, idade) | Usar `t('key', {name})` do next-intl. |
| **Pluralização** | `public/[slug]` `countLabel()` ("registrada/registradas", "ativo/ativos"…) | Usar ICU plural (`{count, plural, ...}`). pt/en/es têm regras diferentes. |
| **`dangerouslySetInnerHTML`** | `artigos/[id]` (corpo do artigo, da API) | **Não traduzível no front** — conteúdo é do backend. |
| **Tags inline** `<strong>`/`<em>`/`<br/>` dentro de texto | `termos`, `privacidade`, `cadastro` (`\n`), home (`<br/>`) | next-intl `t.rich()` com `<strong>{...}</strong>`. |
| **`\n` literal** | `cadastro/page.tsx`, `sobre-nos` (`valores`) | Preservar ou converter para `<br/>`/`t.rich`. |
| **Datas** `toLocaleDateString("pt-BR")` | `artigos`, `artigos/[id]`, carteirinha | Trocar locale dinamicamente; usar `useFormatter`/`Intl`. |
| **Datas hardcoded** ("21 de abril de 2026") | `privacidade`, `termos` | Texto fixo — traduzir manualmente por idioma. |
| **Strings em arrays de dados** | quase todos os componentes | Migrar dados para `messages/*.json` ou referenciar por chave a partir do componente. |
| **Mapas de label** (ESPECIE_LABEL etc.) | carteirinha | Traduzir cada mapa; chaves técnicas permanecem. |
| **Estado de loading via ternário** | header/footer/forms (`{loading ? 'Enviando...' : '...'}`) | 2 chaves separadas por botão. |
| **Tabela `TRADUCOES_ERRO`** (regex→pt) | `SignupForm` | Backend retorna erro (provável EN); mapeamento precisa de versão por idioma. |
| **Labels de analytics** (`event({label:'...'})`) | header, páginas landing | **Não traduzir** — são chaves internas de tracking. Manter em pt. |
| **Rotas hardcoded** (`/cadastro`, `/termos`…) | em todo lugar | Precisam passar pelo `Link`/navegação com locale (depende de D1). |
| **Nomes de marca / próprios** | "PetJourney", nomes da equipe, "App Store", "Google Play" | **Não traduzir.** |

---

## 5. Conteúdo dinâmico (FORA do escopo de i18n estático)

Estes textos **vêm do backend** e não podem ser traduzidos via arquivos de mensagens do front. Só a "moldura" estática (labels, botões, estados vazios) é traduzível:

- **Artigos** (`artigos`, `artigos/[id]`, `articles-section`): título, subtítulo, conteúdo HTML, categorias — via `artigoService` / `categoriaArtigoService`.
- **Carteirinha pública** (`public/[slug]`): nome/raça/espécie do pet, vacinas, medicamentos, diagnósticos — via `/api/proxy/public/{slug}`.

➡️ Tradução desse conteúdo seria responsabilidade do **backend** (i18n de API) — fora desta tarefa. **Decisão D3.**

---

## 6. SEO / metadata (impacto alto, precisa de tradução)

Objetos `metadata` exportados que precisam de versão por idioma:
- `app/layout.tsx` (global), `cadastro/layout.tsx`, `baixar-app/layout.tsx`, `privacidade`, `termos`, `exclusao`, `public/[slug]` (`generateMetadata`).
- Faltando hoje (sem metadata próprio, deveriam ter): `tutor`, `clinicas`, `contato`, `sobre-nos`, `artigos`.
- **`sitemap.ts`** não tem entradas por locale nem `alternates`/`hreflang` — precisará ser refatorado se adotarmos D1=roteamento por locale.

---

## 7. Proposta de estrutura de mensagens (next-intl)

Organização profissional sugerida (namespaces por domínio, não por página solta):

```
messages/
├── pt.json     # origem (extraído do código atual)
├── en.json
└── es.json
```

Namespaces propostos:

```
common      → CTAs e termos reusados (Cadastre-se grátis, Saiba mais, Voltar, Enviando…)
metadata    → SEO por rota (home, tutor, clinicas, …)
nav         → header + footer (Home, Tutor, Clínicas, Artigos, Sobre nós, Catálogo, Newsletter…)
home        → hero, howItWorks, appTour, comparison, security, articles, finalCta
tutor / clinicas / contato / sobreNos
artigos     → UI estática da lista + detalhe
cadastro / listaEspera / baixarApp / linktree / exclusao
legal       → privacidade, termos   (ver D2 — pode ficar fora)
forms       → waitlist, signup (labels, validações, toasts, erros backend)
carteirinha → labels + mapas + plurais da página pública
errors      → 404 global + carteirinha not-found
```

---

## 8. Decisões pendentes (bloqueiam o início) ⛔

Conforme a regra do task ("não avançar sem confirmar se algo estiver ambíguo"):

| # | Decisão | Recomendação |
|---|---|---|
| **D1** | **Estratégia de roteamento.** Locale na URL (`/`, `/en`, `/es`) vs sem roteamento (cookie). | **Locale na URL com pt como default sem prefixo** (`localePrefix: 'as-needed'`) — melhor SEO, preserva URLs pt atuais já indexadas. |
| **D2** | **Documentos jurídicos** (termos + privacidade, ~450 strings, sensíveis). Traduzir agora ou manter só pt? | A confirmar — tradução jurídica tem implicação legal. |
| **D3** | **Conteúdo de API** (artigos, carteirinha). Confirmar que fica fora (responsabilidade do backend). | Fora do escopo desta tarefa. Traduzir só a moldura estática. |
| **D4** | **Inglês:** US ou UK? | US (padrão SaaS global). |
| **D5** | **Espanhol:** tratamento formal (usted) vs informal (tú); neutro LatAm vs ES. | A confirmar (depende do tom desejado p/ público misto B2C/B2B). |
| **D6** | **IPhoneMockup** (UI mock sintética com nomes próprios). Traduzir labels? | Baixa prioridade — traduzir só labels genéricos, manter nomes próprios. |

---

## 9. Riscos

1. **Restructure de rotas (D1)** toca muitos arquivos — maior fonte de regressão. Requer atualizar `Link`, `window.open`, `sitemap`, `middleware`.
2. **Documentos jurídicos** — volume + sensibilidade legal.
3. **`dangerouslySetInnerHTML`** e **conteúdo de API** não são cobertos por i18n de front.
4. **Pluralização e gênero** (especialmente espanhol) exigem ICU bem montado.
5. **Tabela de erros do backend** (`TRADUCOES_ERRO`) — depende do idioma que o backend retorna.
6. **`reactCompiler: true`** — validar que `next-intl` opera bem com o React Compiler (deve, mas testar build).

---

## 10. Próximos passos

1. ✅ Etapa 1 (este documento).
2. ⏳ Resolver **D1–D6** com o stakeholder.
3. ⏳ Etapa 2 — `i18n-glossary.md` (glossário + guia de estilo).
4. ⏳ Instalar e configurar `next-intl` conforme D1.
5. ⏳ Extrair pt → `messages/pt.json` (refactor incremental, rota por rota).
6. ⏳ Etapas 3–4 (en, es) + Etapa 5 (verificação) + Etapa 6 (seletor de idioma + fechamento).
```

