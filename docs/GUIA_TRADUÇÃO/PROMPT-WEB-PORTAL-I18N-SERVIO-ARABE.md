# Sérvio e Árabe na landing e no portal: prompt pronto + como fizemos no app

**Criado em:** 2026-09-17
**Para:** quem vai rodar a tarefa (dev) e o agente de IA que vai executar em cada repo web
**Projetos-alvo:**

| Projeto | Repo | Stack de i18n | Catálogos | Chaves (pt) |
| --- | --- | --- | --- | --- |
| Landing page | `D:\PROJETOS\petjourney-web` | Next 16 + **next-intl** (ICU), idioma por cookie `NEXT_LOCALE` / `Accept-Language`, sem locale na URL | `messages/{pt,en,en-GB,es}.json` | ~1.333 |
| Portal | `D:\PROJETOS\petjourney-admin` ("PetJourney Portal") | Vue 3 + **vue-i18n** (plural com `\|`, não ICU), idioma em `localStorage` `APP_LOCALE` | `src/locales/{pt,en,en-GB,es}.json` | ~2.524 |

**Base no app (leitura obrigatória para o agente):**
- Kit de ferramentas e briefings: [kit-sr-ar/](kit-sr-ar/README.md)
- Catálogos revisados do app (memória de tradução): `D:\PROJETOS\petjourney-app\src\locales\{en,sr,ar}.json`
- Glossário sr/ar: [i18n-glossary.md §7](i18n-glossary.md)
- Contrato da API para os idiomas novos: [../BACKEND-I18N-SERVIO-ARABE.md](../BACKEND-I18N-SERVIO-ARABE.md)
- Registro técnico: [../CHANGELOG.md](../CHANGELOG.md), entrada "2026-09-16 — i18n — Sérvio (latino) e Árabe (RTL) no app"
- PDF de revisão do app (modelo do entregável): [PetJourney-App-revisao-traducao-sr-ar.pdf](PetJourney-App-revisao-traducao-sr-ar.pdf)

---

## 1. Como usar este documento

1. Abra uma sessão do Claude Code **dentro do repo-alvo** (primeiro `petjourney-web`, depois `petjourney-admin`, ou em paralelo em duas sessões).
2. Cole o prompt da **seção 4** inteiro. Ele é o mesmo para os dois projetos: o agente detecta em qual está.
3. O agente vai fazer perguntas só se algo aqui não bater com o repo. As decisões de produto (alfabeto, RTL, tratamento, termos) **já estão tomadas** e não devem ser reabertas.
4. Ao fim, cada repo entrega: idiomas funcionando, catálogos `sr.json`/`ar.json`, gate de paridade estendido, PDF de revisão para a equipe de tradução e um relatório.

Pré-requisito: a sessão precisa conseguir **ler** o repo do app (`D:\PROJETOS\petjourney-app`) para usar o kit e a memória de tradução.

---

## 2. O que fizemos no app (e por quê)

### 2.1 Decisões de produto (valem para web e portal)

| Decisão | Valor | Motivo |
| --- | --- | --- |
| Sérvio | **alfabeto latino (latinica)**, variante ekavska | Mais usado em produtos digitais na Sérvia. A fonte do app (Readex Pro) não tem cirílico. |
| Tratamento no sérvio | **formal "Vi"**, com maiúscula (Vi, Vas, Vaš); botões no imperativo formal (Sačuvajte, Nastavite) | Mesmo raciocínio do espanhol "usted": app de saúde, público 25-60. |
| Árabe | **MSA (árabe moderno padrão)**, sem dialeto | Um catálogo só para todos os países árabes. |
| Árabe no layout | **RTL completo (espelhado)** | Leitor de árabe espera a interface inteira da direita para a esquerda, não só o texto. |
| Tratamento no árabe | neutro de gênero quando possível: botões com masdar (حفظ، إلغاء), frases com يرجى/يمكنك; senão masculino genérico | Árabe marca gênero no verbo; o app não sabe o gênero do usuário. |
| Dígitos no árabe | ocidentais **0-9** | A copy usa 0-9; misturar com ٠١٢ na mesma tela fica errado. |
| Fallback de tradução | **sr e ar → en → pt** | Quem lê sérvio/árabe entende inglês, não português. es continua caindo direto no pt. |
| Referência de sentido | o **inglês aprovado** (`en.json`), com o pt como contexto | O en já foi validado pela equipe. |

### 2.2 Tags de idioma

| Uso | sr | ar | Onde no app |
| --- | --- | --- | --- |
| Código do idioma na UI (i18n, cookie, storage) | `sr` | `ar` | `src/i18n/locales.ts` `LOCALES` |
| `Intl` (datas, números) | `sr-Latn-RS` | `ar-u-nu-latn` | `INTL_LOCALE`. **Sem o `-Latn` o Intl formata o mês em cirílico** ("септембар"). |
| API (`Accept-Language`, `?lang=`, mapa `traducoes`, locale do push) | `sr-Latn` | `ar` | `API_LOCALE` + `src/i18n/api-locale.ts` |
| `<html lang>` | `sr-Latn` | `ar` | `utils/exportCard.ts` (PDF) |
| Detecção do idioma do navegador/device | 1ª subtag `sr` (inclui `sr-Cyrl`) | 1ª subtag `ar` | `src/i18n/resolve.ts`. **Não usar `startsWith("sr")`/`startsWith("ar")`:** casa `srn` (sranan) e `arn` (mapudungun). |

### 2.3 O que mudou no código do app

- **Lista de idiomas e mapas:** `LOCALES` com 6 idiomas; `INTL_LOCALE`, `API_LOCALE` (novo), `PICKER_LOCALE`, `NATIVE_APP_LOCALE`, `RTL_LOCALES` + `isRTLLocale()`.
- **Catálogos centralizados:** `src/i18n/catalogs.ts` alimenta o i18next e os utils que reconhecem rótulo salvo em qualquer idioma.
- **Fallback:** `fallbackLng: { sr: ["en","pt"], ar: ["en","pt"], default: ["pt"] }` e a mesma cadeia no resolver do mapa `traducoes` da API.
- **RTL (`src/i18n/rtl.ts`):** `I18nManager.allowRTL/forceRTL` seguindo o idioma **do app** (não o do aparelho). Entrar ou sair do árabe recarrega o app, com trava contra loop. Ícones direcionais espelhados por um wrapper (`DirectionalFeather`, só setas, chevrons, log-in/out, send, skip). Animação de navegação espelhada. `writingDirection: "rtl"` no texto (iOS). PDF da carteirinha com `dir="rtl"` e CSS lógico (`text-align: start/end`, `margin-inline-*`, `padding-inline-*`).
- **Seletor de idioma:** nomes nativos em todos os catálogos (`"sr": "Srpski"`, `"ar": "العربية"`); bandeira 🇷🇸 para sr e globo 🌍 para ar (árabe não tem país único, igual ao es com 🌎).
- **Unidade de peso:** sr e ar usam kg.
- **Gate `check:i18n` estendido** com 3 regras novas: plural com todas as categorias do idioma, cirílico proibido no sr, chave `*.icon` (nome de glifo usado pelo código) idêntica ao pt.
- **Bugs antigos achados pelos tradutores e corrigidos:** texto montado no código com palavra em português fixa (`${inicio} a ${fim}`), contagens montadas como `${n} ${palavra}` sem plural, datas formatadas com `"pt-BR"` fixo. **Esses três padrões quase certamente existem também na web e no portal.**
- **Pitfall de prefixo:** o app reconhece títulos salvos por "começa com prefixo". Em árabe "جرعة" (dose) é começo de "جرعة معززة" (reforço). Resolvido trocando o prefixo do reforço para "لقاح معزز". Qualquer lógica de "começa com" sobre texto traduzido precisa dessa checagem.

### 2.4 Números do app

- 4.913 chaves por idioma, ~20 mil palavras em inglês.
- 20 tradutores-agentes (10 lotes × 2 idiomas), 4 revisores (2 por idioma), 0 erros no validador.
- Revisão: 152 correções no sr, 297 no ar; mais 4 (sr) e 32 (ar) de padronização final.
- Teste de runtime: 11.533 renderizações de sr/ar via i18next-icu com polyfill de `Intl.PluralRules`, 0 texto cru, 0 erro de parse.

---

## 3. Como fizemos a tradução (o processo que deve ser repetido)

O processo é o que garante qualidade. **Não traduza em uma passada só, nem sem validador.**

### Passo 1 — Descoberta
Ler a configuração de i18n, contar chaves, mapear sintaxe especial (placeholders, plural, tags, arrays, escapes) e **ler o código onde os textos são montados** (concatenação, `startsWith`, datas com locale fixo).

### Passo 2 — Lotes
`make-chunks.mjs` divide `pt.json` + `en.json` em lotes de ~2.300 palavras de inglês, agrupando por namespace (tela/feature). Cada lote é `chave -> { pt, en }`.

### Passo 3 — Memória de tradução
`tm-prefill.mjs` sugere sr/ar a partir dos catálogos **já revisados do app** quando o inglês é igual. No dry-run: landing 310 de 1.289 chaves com sugestão; portal 576 de 2.524. As sugestões são ponto de partida, o tradutor decide pelo contexto.

### Passo 4 — Tradução (1 agente por lote por idioma, em paralelo)
Cada tradutor recebe:
- o briefing `kit-sr-ar/TRANSLATOR-BRIEF.md` (regras técnicas + regras de sr/ar + glossário);
- o lote e a sugestão da memória;
- permissão para **grep no código** do projeto quando o sentido for ambíguo;
- a obrigação de escrever em partes (`out/parts/<lang>-NN-<n>.json`), juntar com `merge-parts.mjs`, rodar `validate-chunk.mjs` até **0 erros** e tratar cada aviso;
- e de devolver até 8 decisões duvidosas para a revisão.

Regras técnicas que mais pegaram erro no app:
1. Placeholders idênticos; nunca inventar nem renomear.
2. **Plural com todas as categorias do idioma:** sr `one / few / other` (1, 21, 31 = one; 2-4, 22-24 = few); ar `zero / one / two / few / many / other` (0 / 1 / 2 / 3-10 / 11-99 / 100+).
3. **Número seguido de substantivo vira plural** em sr/ar mesmo quando pt/en não usam plural (`"{count} dias atrás"`), desde que a variável seja número (conferir no código).
4. Par `xxxOne` / `xxx`: `...One` no singular; a chave sem sufixo com plural completo.
5. Valores que são **nomes de ícone** ou identificadores usados pelo código não se traduzem.
6. Chave vazia na origem continua vazia.
7. Em-dash `—` proibido. "PetJourney" intacto e na mesma quantidade.
8. Árabe: `،` `؛` `؟`, « », dígitos 0-9, sem marcas de direção invisíveis; seta de caminho escrita é `←` (setas não espelham sozinhas; `>` espelha).

### Passo 5 — Montagem
`build-locale.mjs` monta `<lang>.json` na **mesma estrutura e ordem** do `pt.json`.

### Passo 6 — Revisão cruzada nativa (2 revisores por idioma, metades do catálogo)
Briefing `kit-sr-ar/REVIEWER-BRIEF.md`. O revisor **não retraduz o que está bom**, só corrige com motivo: gramática, termo inconsistente entre lotes, rótulo citado que não bate com o botão real, frase montada pelo código que não fecha, registro, tamanho e sentido. Escreve `out/<lang>-fixes-<N>.json` e revalida.

### Passo 7 — Padronização final e varredura
Script que agrupa textos curtos com **o mesmo inglês** e lista traduções divergentes. A maioria é legítima (gênero, contexto), mas pega as inconsistências reais. **Cuidado com falso positivo de contexto:** no app, "Plan" do registro clínico SOAP é plano de tratamento, não plano de assinatura; padronizar às cegas teria errado.

### Passo 8 — Verificação
- Gate de paridade estendido (6 idiomas, plural por idioma, cirílico, ícones).
- Typecheck / build.
- **Teste de runtime** carregando a biblioteca de i18n real com os catálogos novos e renderizando todas as chaves de sr/ar com números de cada categoria (nenhum texto cru, nenhum erro).
- Cobertura de fonte (`font-coverage.cjs`).
- Conferência visual do RTL em navegador (screenshot com Chrome headless).

### Passo 9 — PDF para a equipe de tradução
Documento em **inglês** (a equipe compara com o en aprovado), A4 paisagem, **um capítulo por área e uma seção por tela**, colunas `ID · key | English (approved reference) | Srpski (latinica) | العربية` (árabe alinhado à direita, `dir="rtl"`), plural aberto em linhas por categoria, placeholders destacados. Na frente: como revisar, regras de plural, decisões de estilo, glossário e questões em aberto. Gerado como HTML e impresso pelo Chrome headless (ReportLab não faz a forma das letras árabes). O do app está em `PetJourney-App-revisao-traducao-sr-ar.pdf`, que serve de modelo.

---

## 4. Prompt pronto (colar inteiro na sessão do repo-alvo)

````text
Você vai adicionar dois idiomas novos a este projeto web da PetJourney: SÉRVIO (alfabeto latino) e ÁRABE (com layout RTL espelhado). O app mobile já passou por isso e é a referência: mesmas decisões, mesmo processo, mesmos termos. Trabalhe com precisão de produção: nada de "typecheck passou = pronto".

## 0. Antes de tudo
1. Detecte em qual projeto você está:
   - `petjourney-web` (landing, Next + next-intl, catálogos em `messages/`), ou
   - `petjourney-admin` (portal, Vue 3 + vue-i18n, catálogos em `src/locales/`).
2. Leia inteiro, no repo do app (só leitura):
   - `D:\PROJETOS\petjourney-app\docs\traduction\PROMPT-WEB-PORTAL-I18N-SERVIO-ARABE.md` (este doc: decisões, processo e a seção do seu projeto);
   - `D:\PROJETOS\petjourney-app\docs\traduction\kit-sr-ar\README.md`, `TRANSLATOR-BRIEF.md`, `REVIEWER-BRIEF.md`, `translator-notes.md`;
   - `D:\PROJETOS\petjourney-app\docs\traduction\i18n-glossary.md` (§7, glossário sr/ar);
   - `D:\PROJETOS\petjourney-app\docs\BACKEND-I18N-SERVIO-ARABE.md` (tags da API).
3. Leia o CLAUDE.md/README e a documentação de i18n deste repo, a configuração de i18n atual e o script de paridade (se houver). Regras do repo valem junto: copy sem em-dash, "PetJourney" sempre no feminino em pt/es, git só develop/master e nunca commitar sem pedido.
4. As decisões de produto estão fechadas (sr latino com "Vi" formal; ar MSA com RTL completo; fallback sr/ar → en → pt; dígitos 0-9 no árabe). Não pergunte sobre elas. Pergunte só se o repo contradizer este documento.

## 1. Infraestrutura de idioma
- Adicione `sr` e `ar` à fonte única da lista de idiomas, com os mapas de tags do doc (§2.2): Intl `sr-Latn-RS` / `ar-u-nu-latn`; API `sr-Latn` / `ar`; `<html lang>` `sr-Latn` / `ar`.
- Detecção pelo navegador: casar pela 1ª subtag (`sr`, incluindo `sr-Cyrl`, e `ar`), nunca `startsWith`.
- Fallback de mensagens: sr e ar → en → pt.
- Header `Accept-Language` / `?lang=` da API com `sr-Latn` e `ar`, e o resolver do mapa `traducoes` (se existir) com a cadeia `sr-Latn|ar → en-US → pt-BR`.
- Seletor de idioma: incluir os dois com nome nativo (`"sr": "Srpski"`, `"ar": "العربية"` em TODOS os catálogos); ícone sérvio = bandeira RS; árabe = globo (não usar bandeira de país).
- Procure e corrija, em todo o projeto: datas/números formatados com locale fixo (`"pt-BR"`, `startsWith("en") ? … : "pt-BR"`); textos montados por concatenação com palavra em português (`${a} a ${b}`, `${n} ${label}`); lógica de "começa com" sobre texto traduzido. Liste o que achou e o que corrigiu.
- Siga a seção específica do seu projeto (§5 ou §6 deste doc) para RTL, fontes e plural.

## 2. Tradução (processo do doc §3, obrigatório)
1. Crie uma pasta de trabalho FORA do git (ex.: `.i18n-work/` no .gitignore, ou pasta temporária) e rode `make-chunks.mjs` e `tm-prefill.mjs` do kit, com `I18N_WORK` e `LOCALES_DIR` apontando para este projeto. Garanta antes a paridade pt/en.
2. Adapte o `TRANSLATOR-BRIEF.md` para este projeto: seção "Produto e público" (landing = site de marketing + documentos legais; portal = área de trabalho do parceiro/veterinário), caminhos e formato de saída. No portal, troque as regras de ICU pelas de vue-i18n (§6). Mantenha intactas as regras de sr, de ar e o glossário. Use a memória `out/tm/` como sugestão.
3. Dispare 1 tradutor-agente por lote por idioma, em paralelo. Cada um: grep no código quando o sentido for ambíguo, escreve em partes, junta com `merge-parts.mjs`, roda o validador até 0 erros, trata os avisos e devolve até 8 decisões duvidosas.
4. Monte os catálogos com `build-locale.mjs` (estrutura e ordem do pt.json).
5. Revisão cruzada: 2 revisores por idioma (metades), com `REVIEWER-BRIEF.md`. Correções em `out/<lang>-fixes-N.json`, revalidadas. Resolva também, na revisão, as inconsistências com os termos do app (glossário §7 e `translator-notes.md`).
6. Varredura final de consistência (mesmo inglês → traduções divergentes), padronizando só o que for inconsistência real. Cuidado com homônimos de contexto.
7. Textos legais (termos, privacidade, exclusão) e menções a LGPD: traduzir seguindo exatamente o que o en aprovado fez; marcar no relatório que precisam de validação jurídica local.

## 3. Verificação (não pule)
- Gate de paridade estendido para 6 idiomas, com as regras novas: plural com as categorias do idioma (sr one/few/other; ar zero/one/two/few/many/other), cirílico proibido no sr, placeholders, em-dash, chaves idênticas.
- Typecheck, lint e build de produção.
- Teste de runtime: carregue a biblioteca de i18n real deste projeto (next-intl/use-intl ou vue-i18n) com os catálogos novos e renderize TODAS as chaves de sr e ar, com números de cada categoria de plural (sr: 1, 2, 5, 21, 22; ar: 0, 1, 2, 3, 11, 100). Critério: nenhum texto cru, nenhum `{placeholder}` sobrando, nenhum erro.
- Cobertura de fonte (`font-coverage.cjs` com `FONT_DIR` apontando para a fonte usada).
- RTL: rode o projeto, abra as páginas principais em `ar` e tire screenshots com Chrome headless (desktop e mobile). Confira: menu/header espelhados, ícones direcionais invertidos, carrosséis e animações na direção certa, formulários e tabelas alinhados à direita, nada vazando para fora. Faça o mesmo em `sr` para textos longos quebrando layout.

## 4. PDF para a equipe de tradução
Gere o documento de revisão deste projeto no mesmo formato do app (doc §3 passo 9): em inglês, A4 paisagem, um capítulo por área e uma seção por página/tela com nome em inglês, colunas `ID · key | English (approved reference) | Srpski (latinica) | العربية`, plural aberto por categoria, placeholders destacados, guia na frente (como revisar, plural, estilo, glossário, questões em aberto deste projeto). Adapte `kit-sr-ar/pdf/key-screens.cjs` e `build-review-html.cjs` à estrutura de rotas deste projeto. Salve o PDF na pasta de docs de tradução do repo.

## 5. Entrega
- Relatório final curto (em português): o que mudou no código (arquivos), números (chaves, lotes, correções da revisão), verificação com resultado real, bugs antigos achados, riscos não testados e questões para a equipe de tradução.
- Registre no changelog/docs do repo, seguindo o padrão dele.
- NÃO faça commit nem push.
````

---

## 5. Landing (`petjourney-web`): pontos específicos

**Arquivos de i18n:** `src/i18n/routing.ts` (lista), `request.ts` (cookie `NEXT_LOCALE` → `Accept-Language` → pt), `negotiate-locale.ts` (`matchTag`: incluir `sr` e `ar` pela 1ª subtag), `api-locale.ts` (`ApiLocale`, `LOCALE_MAP`: `sr → sr-Latn`, `ar → ar`), `navigation.ts`. Seletor em `src/components/language-switcher/` (bandeiras SVG de `country-flag-icons`: usar `RS`; árabe com ícone de globo, igual ao es).

**`src/app/layout.tsx`:**
- `<html lang={...} dir={locale === "ar" ? "rtl" : "ltr"}>`. `lang` com `sr-Latn` para sérvio.
- `OG_LOCALE`: `sr → sr_RS`, `ar → ar_AR`.
- **Fonte, sérvio:** a Inter é carregada hoje com `subsets: ["latin"]`. As letras č ć đ (U+010D, U+0107, U+0111) ficam no subset **`latin-ext`**: sem ele, essas letras saem em outra fonte, no meio da palavra. Incluir `"latin-ext"` nos `subsets`.
- **Fonte, árabe:** a **Inter não tem glifos árabes**. Sem fonte árabe, o navegador cai numa fonte do sistema diferente em cada SO. Carregar uma fonte árabe via `next/font/google` (subset `arabic`) e aplicar em `:lang(ar)`. Recomendado: **Readex Pro** (a do app, feita para árabe + latino) ou Noto Sans Arabic. Conferir com `font-coverage.cjs`.

**Mensagens:** next-intl usa **ICU** igual ao app: o validador do kit funciona sem adaptação (next-intl já traz `intl-messageformat`). Atenção a:
- `t.rich` com tags (`<terms>…</terms>`, `<br></br>`): mesmas tags, mesma quantidade.
- Arrays (`t.raw(...)`): mesmo número de itens.
- `metadata` / `generateMetadata`: title e description em sr/ar (SEO).

**RTL na web (Tailwind v4):**
- Trocar classes físicas por lógicas onde a direção importa: `ml-/mr-` → `ms-/me-`, `pl-/pr-` → `ps-/pe-`, `left-/right-` → `start-/end-`, `text-left/right` → `text-start/end`, `rounded-l/r` → `rounded-s/e`, `border-l/r` → `border-s/e`. Onde precisar de exceção, usar a variante `rtl:`.
- `space-x-*` não inverte bem em RTL: preferir `gap-*`.
- Ícones direcionais (lucide: setas, chevrons) com `rtl:-scale-x-100`.
- **Carrosséis embla** (`embla-carousel-react`): passar `direction: "rtl"` nas opções quando o idioma for ar.
- **Animações GSAP** com `x`/`xPercent`: inverter o sinal no RTL. 35 arquivos usam embla ou gsap: conferir um por um.
- HeroUI / Headless UI: conferir se herdam `dir` do `<html>` (popovers, selects, drawers).
- Números, telefone e e-mail dentro de texto árabe: envolver em `<bdi>` ou `dir="ltr"` quando embaralharem.

**Conteúdo da API** (artigos, carteirinha pública): mandar `sr-Latn`/`ar`. Até o backend implementar ([BACKEND-I18N-SERVIO-ARABE.md](../BACKEND-I18N-SERVIO-ARABE.md)), esse conteúdo vem em pt: registrar como pendência, não é bug da web.

**Documentos legais** (`termos`, `privacidade`, `exclusao`): são a maior parte do volume de palavras. Seguir o en aprovado (inclusive as decisões sobre LGPD documentadas em `i18n-review.md` do repo web) e marcar para validação jurídica.

---

## 6. Portal (`petjourney-admin`): pontos específicos

**Arquivos de i18n:** `src/i18n/locales.ts` (`LOCALES`, `INTL_LOCALE`, `STORAGE_KEY`), `src/i18n/index.ts` (`createI18n`, `changeLocale`, `syncDocumentLang`), `src/i18n/resolve.ts` (`resolveDeviceLocale`: incluir `sr`/`ar` pela 1ª subtag), `src/service/api.ts` (`acceptLanguage()`: `sr-Latn` / `ar`), `scripts/check-i18n-parity.mjs` (estender para sr/ar). Criar mapa de tag da API se hoje reaproveita o `INTL_LOCALE`.

**Direção e idioma do documento:** em `changeLocale` e `syncDocumentLang`, além de `document.documentElement.lang` (`sr-Latn` / `ar`), setar `document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"`. No portal não há reload: a troca de direção é imediata pelo `dir` do `<html>`, mas componentes que calculam posição em JS (popovers, tooltips, drag, gráficos) podem precisar reagir à troca.

**Plural no vue-i18n (diferente do app e da landing):**
- O formato é **pipe** (`"one screen | {contagem} screens"`, `"none selected | 1 selected | {count} selected"`), não ICU. O validador do kit (ICU) **não serve como está**: adapte o bloco de plural para contar formas separadas por ` | `, e mantenha as outras checagens (placeholders, escapes, marca, em-dash, cirílico).
- vue-i18n só conhece a regra do inglês por padrão. Registrar `pluralRules` para `sr` e `ar` em `createI18n`, usando `Intl.PluralRules` (nativo no navegador, sem polyfill), com esta convenção de ordem das formas:

```ts
const srRules = new Intl.PluralRules('sr-Latn')
const arRules = new Intl.PluralRules('ar')
const SR = ['one', 'few', 'other']
const AR = ['zero', 'one', 'two', 'few', 'many', 'other']

pluralRules: {
  // sr: 3 formas "one | few | other"; 4 formas quando a origem tem forma zero: "zero | one | few | other"
  sr: (choice: number, len: number) => {
    const idx = SR.indexOf(srRules.select(Math.abs(choice)))
    if (len === 4) return choice === 0 ? 0 : 1 + idx
    if (len === 3) return idx
    return choice === 1 ? 0 : 1 // string ainda com 2 formas (não deveria existir)
  },
  // ar: sempre 6 formas "zero | one | two | few | many | other"
  ar: (choice: number, len: number) => {
    if (len === 6) return AR.indexOf(arRules.select(Math.abs(choice)))
    return choice === 1 ? 0 : 1
  },
},
```

  Regra para os tradutores: toda string com ` | ` no en vira, no sr, 3 formas (ou 4, se o en começa com a forma de zero, como "none selected | …"); no ar, sempre 6. O gate deve barrar quantidade de formas diferente disso. **Confirmar no código** como cada string é chamada (`t(key, n)` / `t(key, { count }, n)`) antes de mudar a quantidade de formas.
- **Escapes do vue-i18n:** caracteres especiais (`@`, `{`, `}`, `|`, `$`) precisam do literal: `you{'@'}company.com`. Manter os escapes existentes e escapar os que o tradutor introduzir. Um `|` solto num texto árabe ou sérvio vira forma de plural.

**Fonte:** conferir qual fonte o portal carrega (não está declarada no `index.html`) e se cobre č ć đ (subset latin-ext) e árabe. Aplicar fonte árabe em `:lang(ar)` como na landing e conferir com `font-coverage.cjs`.

**RTL (Tailwind v4):** mesmas regras da landing (classes lógicas, `rtl:`, ícones com `rtl:-scale-x-100`). Portal é denso em tabelas, formulários, drawers, gráficos e timers (`cronometro`, `clinico`): conferir alinhamento de colunas numéricas, direção de gráficos (normalmente continuam LTR no eixo do tempo) e posição de menus laterais.

**Volume:** o maior namespace é `clinico` (prontuário, receita, vacinas, internação): termos clínicos devem seguir o glossário do app (health record, prescription, follow-up, exam) e os nomes de medicamento/vacina ficam como estão.

---

## 7. Termos que já estão decididos (resumo; lista completa no glossário §7)

| en (aprovado) | sr | ar |
| --- | --- | --- |
| Guardian (tutor / perfil Responsável) | staratelj | مربي الحيوان الأليف (curto: المربي) |
| Owner | vlasnik | المالك / صاحب الحيوان الأليف |
| Partner / business | partner / firma | شريك / النشاط التجاري |
| pet / your pet | ljubimac / Vaš ljubimac | حيوان أليف / حيوانك الأليف |
| vet | veterinar | الطبيب البيطري |
| health record | zdravstveni karton | السجل الصحي |
| pet card | kartica ljubimca | بطاقة الحيوان الأليف |
| vaccine / booster | vakcina / revakcinacija | لقاح / جرعة معززة |
| vet visit / test / follow-up | pregled / analiza / kontrola | زيارة بيطرية / فحص / زيارة متابعة |
| prescription (na consulta) / receita (documento) | terapija / recept | الوصفة الطبية / وصفة طبية |
| medication / dose | lek / doza | دواء / جرعة |
| reminder | podsetnik | تذكير |
| plan / family plan | paket / porodični paket | الباقة / الباقة العائلية |
| coupon / redemption | kupon / iskorišćenje kupona | قسيمة / استخدام |
| affiliate / influencer | afilijejt partner / influenser | شريك التسويق بالعمولة / مؤثر |
| wallet / withdrawal / statement | novčanik / isplata / izvod | المحفظة / السحب / كشف الحساب |
| under review / partner modes | na proveri / modeli saradnje | قيد المراجعة / أنماط الشراكة |
| sign in / sign up | prijava / registracija | تسجيل الدخول / إنشاء حساب |
| account / password / email | nalog / lozinka / imejl | الحساب / كلمة المرور / البريد الإلكتروني |

Não se traduzem: PetJourney, App Store, Google Play, WhatsApp, Instagram, Facebook, nomes de plano (Freemium, Pro, Premium, Business), unidades, CPF/CNPJ/CRMV/PIX/LGPD/MRP/PDF (seguir o que o en fez com cada um).

---

## 8. Checklist de pronto (por projeto)

- [ ] `sr` e `ar` na lista de idiomas, detecção por 1ª subtag, fallback sr/ar → en → pt
- [ ] Tags corretas: Intl `sr-Latn-RS`/`ar-u-nu-latn`, API `sr-Latn`/`ar`, `<html lang dir>`
- [ ] Seletor de idioma com os dois (nome nativo, RS / globo)
- [ ] Fonte cobrindo č ć đ (latin-ext) e fonte árabe aplicada em `:lang(ar)`, cobertura conferida
- [ ] RTL: classes lógicas, ícones direcionais, carrosséis, animações, componentes de UI conferidos com screenshot
- [ ] Locale fixo, concatenação com português e "começa com" em texto traduzido: auditados e corrigidos
- [ ] Catálogos `sr.json` e `ar.json` com paridade total, montados pelo processo (lotes → validador → revisão cruzada → padronização)
- [ ] Portal: `pluralRules` de sr/ar e quantidade de formas validada; escapes do vue-i18n preservados
- [ ] Gate de paridade estendido, typecheck, lint, build e teste de runtime com resultado real
- [ ] PDF de revisão em inglês, por tela, salvo nos docs do repo
- [ ] Relatório + changelog; sem commit
