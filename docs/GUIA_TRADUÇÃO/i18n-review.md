# i18n — Etapa 5 & 6: Verificação e Fechamento

> Resultado da migração pt-BR → en (US) + **en-GB (UK)** + es (LatAm, "usted"), com next-intl.
> Data: 2026-06-08. Ver também `i18n-discovery.md` e `i18n-glossary.md`.

> **Atualização (2026-06-08): roteamento revertido para SEM locale na URL.**
> O idioma vem do cookie `NEXT_LOCALE` (lido em `src/i18n/request.ts`), trocado pelo
> seletor de idioma. **Não há** segmento `[locale]`, middleware/proxy nem URLs `/en` `/es` —
> as rotas vivem direto em `src/app/(landing)/` e `src/app/(public)/`, e a URL nunca muda.
> Trade-offs: as páginas passam a ser renderizadas **dinamicamente** (SSR por request, pois
> lê cookie) e não há SEO multilíngue por URL/hreflang. As seções abaixo já refletem isso.

---

## 1. Checklist de verificação (Etapa 5)

| Item | Status | Evidência |
|---|---|---|
| **Paridade de chaves** (todos == pt) | ✅ | Script `check-parity`: **816 chaves** em cada um dos **4 locales** (pt, en-US, en-GB, es), 0 faltando / 0 sobrando. (611 base + 116 termos + 89 privacidade.) |
| **Inglês britânico (en-GB)** | ✅ | Derivado do en-US com ortografia/vocabulário UK; scan `check-americanisms` → 0 americanismos residuais. |
| **Placeholders preservados** (`{name}`, `{count}`, `{n}`) | ✅ | Mesma assinatura de placeholders em todas as chaves correspondentes. |
| **JSON válido** | ✅ | `JSON.parse` sem erro nos 3 arquivos. |
| **Build de produção** | ✅ | `next build` → "Compiled successfully", **17 rotas** sem `MISSING_MESSAGE`/`IntlError`/type error. Todas as rotas de conteúdo são `ƒ` (dinâmicas, SSR por request). |
| **Render por idioma (runtime)** | ✅ | `next start` + requisições com cookie `NEXT_LOCALE=pt/en/en-GB/es` em `/`, `/tutor`, `/cadastro`: status 200, idioma correto (`<html lang>`), ortografia UK distinta da US ("organised" vs "organized"), sem erro de mensagem. |
| **Idioma por cookie (sem URL)** | ✅ | URL não muda; `request.ts` lê `NEXT_LOCALE`; seletor grava cookie + `router.refresh()`. Sem middleware/proxy. |
| **Naturalidade (headlines/CTAs)** | ✅ revisado | Headlines/CTAs reescritos idiomaticamente (não literais). Itens criativos listados em §3. |
| **Consistência de glossário** | ✅ | `common` centraliza CTAs; termos-chave seguem `i18n-glossary.md`. |

### Como reproduzir
```bash
node c:/tmp/check-parity.mjs   # paridade de chaves + placeholders
npx next build                  # build + render em 3 locales
```

---

## 2. O que foi traduzido

**Chrome:** header (nav + CTA), footer (newsletter + toasts + links), **seletor de idioma** (globo, header + footer).
**Home:** hero, "como funciona", tour do app (10 slides), tabela comparativa, segurança, CTA final, faixa de artigos.
**Landing:** tutor, clínicas, contato (form + validações + toasts), sobre-nós (valores, manifesto, jornada, equipe), artigos (UI estática da lista + detalhe).
**Públicas:** cadastro, lista-espera, baixar-app, linktree, exclusão de conta, **termos** e **privacidade** (ver §3-bis), 404, carteirinha pública não encontrada.
**Forms:** SignupForm (incl. mapeamento de erros do backend), waitlist-modal, DownloadAppPanel.
**Carteirinha pública** (`/public/[slug]`): todos os labels estáticos, mapas (espécie, porte, severidade, categorias…), **pluralização ICU** (alergias/vacinas/medicamentos/documentos), idade, e datas locale-aware.
**SEO:** `metadata` localizada (idioma do request) em todas as rotas principais (home + cadastro/baixar-app/exclusão via `generateMetadata`; tutor/clínicas/contato/sobre-nós/artigos via `layout.tsx`); `sitemap.ts` com **uma URL por rota** (sem `/en` `/es`, pois o idioma é por cookie).

**Arquitetura:** `messages/{pt,en,es}.json` (namespaces por domínio); `src/i18n/{routing,request,navigation}.ts` (sem roteamento por locale — `request.ts` resolve o idioma pelo cookie `NEXT_LOCALE`); **sem** `proxy`/middleware; rotas direto em `src/app/(landing)/` e `src/app/(public)/`; root `app/layout.tsx` usa `getLocale()`/`getMessages()`.

---

## 3. Decisões tomadas / itens que pedem sua validação

1. **Espanhol = "usted" (formal) neutro LatAm**, inglês = US. Aplicado de forma consistente.
2. **Slogan (sobre-nós)** "amar · conectar · cuidar" → en "Love · Connect · Care", es "Amar · Conectar · Cuidar". Escolha criativa — confirmar.
3. **"tutor"** → en "pet parent", es "dueño" (glossário). Em listas/dropdowns ("Dueño") pode ficar longo — confirmar se prefere "Tutor".
4. **LGPD (lei brasileira)** aparece em 3 lugares com tratamento ligeiramente diferente:
   - Home/segurança: "LGPD compliance" + menção à lei brasileira.
   - Clínicas: generalizado para "data protection regulations" / "normativa de protección de datos".
   - Cadastro (rodapé): manteve a sigla "LGPD".
   👉 **Decisão pendente:** para en/es, manter LGPD, citar GDPR, ou generalizar? Hoje está misto.
5. **Validação de telefone BR (11 dígitos)** em contato/lista-espera/waitlist: mantida (lógica não alterada). A mensagem foi traduzida literalmente; para públicos en/es essa regra pode não fazer sentido — decisão de produto futura.
6. **Analytics (waitlist):** o label do `event()` passou a usar o `id` estável do perfil (`TUTOR`…) em vez do nome traduzido — mantém o tracking consistente entre idiomas.
7. **Metadata do artigo individual** (`/artigos/[id]`) herda a metadata genérica de "Artigos" (o conteúdo do artigo vem da API). Metadata por artigo exigiria i18n no backend.

---

## 3-bis. Documentos jurídicos (D2 — CONCLUÍDO em 2026-06-08) ⚖️

Termos de Uso (`/termos`, namespace `termos`, 116 chaves, 23 seções) e Política de Privacidade (`/privacidade`, namespace `privacidade`, 89 chaves, 13 seções) foram **traduzidos nos 4 idiomas** (pt/en-US/en-GB/es), com paridade exata, nenhuma cláusula omitida e tags inline (`<strong>`/`<em>`/e-mail) preservadas via `t.rich`.

> ⚠️ **Tradução de REFERÊNCIA — recomenda-se revisão jurídica** antes de publicar en/es: traduzir cláusulas legais tem implicação de responsabilidade. Termos sinalizados pelos tradutores para um advogado confirmar:
> - **CONTRATADA/CONTRATANTE/TITULAR** → CONTRACTOR/CUSTOMER/DATA SUBJECT (en); mantidos em es. Confirmar se batem com as definições de parte usadas nos contratos.
> - **"Direito de Arrependimento" (art. 49 CDC)** → "Right of Withdrawal" / "Derecho de Arrepentimiento" (vs "cooling-off period").
> - **"encarregado (DPO)"** (LGPD) → "Data protection officer (DPO)" / "encargado (DPO)".
> - **"Razão social / responsável"** → "Legal name / responsible party" / "Razón social / responsable".
> - **CEP** → "ZIP code" (US) / "postcode" (UK) / mantido "CEP" (es). Citações de leis BR (8.078/1990, 13.709/2018) mantidas em forma numérica; siglas LGPD/HIPAA/GDPR/ANPD não traduzidas.

## 4. Pendências (fora do escopo desta rodada)
- **Conteúdo dinâmico da API (D3):** títulos/corpos de artigos e dados do pet na carteirinha vêm do backend — só a "moldura" estática foi traduzida. Tradução desse conteúdo é responsabilidade do backend (i18n de API).
- **`IPhoneMockup`** (UI sintética com nomes próprios "Rex"/"Bravecto"): não traduzido — são dados de demonstração (D6). As telas reais do tour já usam screenshots.

---

## 5. Como adicionar/editar traduções (para a equipe)

- Textos ficam em `messages/<locale>.json`, agrupados por namespace (ex.: `home.hero.title`).
- Em componentes: `const t = useTranslations('home.hero')` → `t('title')`. CTAs reusáveis em `common`.
- Server Components/metadata: `getTranslations('namespace')` (idioma do request — **não** passar `locale`). Locale atual no servidor: `getLocale()`.
- Trocar idioma: gravar cookie `NEXT_LOCALE` + `router.refresh()` (ver `language-switcher`).
- **Adicionar um novo idioma** (checklist, ex.: como foi feito o `en-GB`): (1) `src/i18n/routing.ts` `locales`; (2) `messages/<locale>.json` (mesmas 611 chaves); (3) `OG_LOCALE` em `app/layout.tsx`; (4) `SHORT` + a label `languageSwitcher.<locale>` (nos 4 arquivos); (5) os mapas `dateLocale`/`DATE_LOCALE` em `artigos/page.tsx`, `artigos/[id]/page.tsx`, `public/[slug]/page.tsx`. Validar com `check-parity`.
- Navegação interna: `Link`/`useRouter` de `@/i18n/navigation` (re-exporta `next/link` + `next/navigation`; sem prefixo de locale). Links externos: `<a>` normal.
- Listas (arrays): `t.raw('chave') as string[]`. Tags inline (`<strong>`, `<br/>`): `t.rich(...)`. Plurais: ICU `{count, plural, ...}`.
- Ao adicionar uma chave, adicione-a **nos 3 arquivos** (mantém a paridade — validável com `check-parity`).
