# Tradução / i18n — Guia de implementação para o app mobile

> **Objetivo:** documentar **toda** a implementação de tradução do projeto web (PetJourney `petjourney-web`, next-intl) e descrever, passo a passo, como aplicar **a mesma** estratégia no projeto **mobile (React Native / Expo)**, reaproveitando os mesmos catálogos de mensagens, a mesma lista de idiomas, o mesmo glossário de termos e as mesmas regras de tom.
>
> **Princípio central:** os arquivos `messages/{pt,en,en-GB,es}.json` são a **fonte única de verdade** das traduções. Web e mobile devem **consumir o mesmo catálogo** (ou um catálogo idêntico em estrutura e chaves), para que uma frase traduzida uma vez valha nas duas plataformas.
>
> Fontes no repositório web (branch `develop`): `src/i18n/`, `messages/*.json`, `src/components/language-switcher/`, e os specs `docs/specs/i18n-{discovery,glossary,review,translation-task}.md`.

---

## 1. TL;DR — decisões-chave (valem para web **e** mobile)

| Decisão | Valor | Por quê |
|---|---|---|
| **Idiomas suportados** | `pt` (default), `en` (US), `en-GB` (UK), `es` (LatAm) | Mesma lista nas duas plataformas. `pt` é a origem. |
| **Formato das mensagens** | **ICU MessageFormat** (plural, select, variáveis `{name}`, tags `<tag>…</tag>`) | É o que o next-intl usa. No mobile, usar **i18next + i18next-icu** mantém o **mesmo** catálogo funcionando sem reescrever. |
| **Organização** | Por **namespace** (`common`, `nav`, `home`, `cadastro`, `carteirinha`, …) | Mesmos namespaces/chaves nas duas plataformas → paridade verificável. |
| **Default / fallback** | `pt` sempre | Nunca mostrar chave crua; faltou tradução → cai pra `pt`. |
| **Detecção inicial** | idioma do dispositivo → resolvido para um dos 4 locales | Web usa cookie `NEXT_LOCALE`; mobile usa locale do device + persistência. |
| **Persistência da escolha** | Web: cookie `NEXT_LOCALE` (1 ano). Mobile: `AsyncStorage` chave `APP_LOCALE`. | A escolha do usuário sobrevive a reloads/reinícios. |
| **Tom por idioma** | pt informal ("você") · en neutro · **es formal ("usted")** · en-GB ortografia britânica | Definido pelo stakeholder — **obrigatório** e idêntico nas plataformas. |
| **Glossário de produto** | tabela fixa (pet, tutor→pet parent/dueño, carteirinha→vaccination card/cartilla, …) | Consistência de marca. Ver §4. |

---

## 2. Idiomas suportados e política de tom

| Locale | Variante | Tratamento | Regras |
|---|---|---|---|
| `pt` | Português do Brasil (**origem**) | informal — "você" | Texto-fonte. |
| `en` | Inglês **americano (US)** | neutro — "you" | Ortografia US (organi**z**e, col**o**r, customize, center). Title Case em headlines/botões curtos; sentence case em parágrafos. |
| `en-GB` | Inglês **britânico (UK)** | neutro — "you" | Ortografia UK: `-ise` (organi**s**e, customise, personalise), `-our` (col**ou**r, behaviour, favourite), `-re` (cent**re**), `ll` dobrado (cancelled, enrolment), "licence"(subst.)/"practise"(verbo), "whilst", "mum", "mobile" (não "cell"), "holiday" (não "vacation"). Mesma estrutura/Title Case do en-US — difere só em ortografia/vocabulário, **não em tom**. |
| `es` | Espanhol **neutro LatAm** | **formal — "usted"** | Vocabulário pan-hispânico (usar "celular" não "móvil"; "computadora"). **usted** consistente em verbos e possessivos (su/sus). `¿`/`¡` de abertura **obrigatórios**. Concordância de gênero rigorosa. |

> **Datas/números/moeda:** sempre via `Intl` com o locale correspondente (`pt-BR`, `en-US`, `en-GB`, `es`). Nunca formatar à mão.

---

## 3. O que **NÃO** se traduz (idêntico em web e mobile)

- **Marca / nomes próprios:** PetJourney, nomes de pessoas/pets de exemplo (Watson, Lily, Bravecto, V10…).
- **Lojas / plataformas:** App Store, Google Play, WhatsApp, Instagram, Facebook, LinkedIn.
- **Siglas legais:** LGPD, HIPAA, GDPR, ANPD, QR code.
- **Labels de analytics** (`event({ label })`) — permanecem em **pt** (são chaves internas, não UI).

---

## 4. Glossário de produto (consistência obrigatória)

> Estes termos definem a **voz da marca**. Use exatamente estes equivalentes em qualquer string nova, nas duas plataformas.

| pt | en (US) | en-GB | es (usted) | Obs. |
|---|---|---|---|---|
| pet | pet | pet | mascota | "pet" é aceito em inglês e mais quente que "animal". |
| tutor | pet parent | pet parent | dueño / tutor | Evitar "owner" (frio). |
| veterinário | veterinarian / vet | veterinarian / vet | veterinario | "vet" em contextos curtos. |
| clínica (veterinária) | (veterinary) clinic | (veterinary) clinic | clínica (veterinaria) | |
| prontuário | health record | health record | historial clínico | |
| carteirinha (de vacinação) | (digital) vaccination card | (digital) vaccination card | cartilla de vacunación | |
| vacina / reforço | vaccine / booster | vaccine / booster | vacuna / refuerzo | |
| consulta | (vet) visit / appointment | (vet) visit / appointment | consulta / cita | |
| medicação / medicamento | medication | medication | medicamento | |
| lembretes inteligentes | smart reminders | smart reminders | recordatorios inteligentes | |
| cadastro / cadastre-se | sign up | sign up | registrarse / regístrese | Botão: "Sign up" / "Regístrese". |
| conta | account | account | cuenta | |
| grátis | free | free | gratis | |
| 3 meses grátis | 3 months free | 3 months free | 3 meses gratis | |
| sem cartão de crédito | no credit card required | no credit card required | sin tarjeta de crédito | |
| espécie / raça | species / breed | species / breed | especie / raza | |
| filhote | puppy/kitten (genérico: young pet) | puppy/kitten | cachorro/cría | ⚠️ "cachorro" em es = puppy. |
| castrado | neutered/spayed | neutered/spayed | castrado/esterilizado | |

**CTAs recorrentes (namespace `common`):** Comece grátis agora → Start free now / Comience gratis ahora · Cadastre-se grátis → Sign up free / Regístrese gratis · Saiba mais → Learn more / Más información · Ver como funciona → See how it works / Vea cómo funciona · Entre em contato → Get in touch / Contáctenos · Voltar → Back / Volver · Ler mais → Read more / Leer más · Enviar → Send / Enviar · Anterior/Próxima → Previous/Next / Anterior/Siguiente.

---

## 5. Como funciona na **web** (next-intl) — arquitetura de referência

A web usa **next-intl** no modo **"sem locale na URL"**: o idioma é resolvido **por request** a partir do cookie `NEXT_LOCALE`. Resumo dos pontos que o mobile vai espelhar:

- **Fonte da lista de locales** — `src/i18n/routing.ts`:
  ```ts
  export const routing = {
    locales: ["pt", "en", "en-GB", "es"] as const,
    defaultLocale: "pt" as const,
  };
  export type Locale = (typeof routing.locales)[number];
  ```
- **Resolução por request** — `src/i18n/request.ts` lê o cookie `NEXT_LOCALE`, valida contra a lista e importa `messages/${locale}.json`. Sem cookie válido → `pt`.
- **Provider** — o root layout (`src/app/layout.tsx`) envolve a árvore com `<NextIntlClientProvider locale messages>` e usa `getLocale()`/`getMessages()`. O `<html lang={locale}>` acompanha o idioma.
- **Metadata/SEO** — `generateMetadata()` usa `getTranslations('metadata.home')` e um mapa `OG_LOCALE` (`pt→pt_BR`, `en→en_US`, `en-GB→en_GB`, `es→es_ES`).
- **Consumo nos componentes:**
  - Texto simples: `const t = useTranslations('namespace'); t('chave')`.
  - **Variáveis:** `t('hero.titlePostSignup', { name })` para `"Pronto, {name}."`.
  - **Plural (ICU):** `t('carteirinha.summary.allergies', { count })` para `"{count, plural, one {# alergia registrada} other {# alergias registradas}}"`.
  - **Rich text (tags):** `t.rich('cadastro.form.terms', { terms: (c) => <a…>{c}</a>, privacy: (c) => <a…>{c}</a> })` para `"Aceito os <terms>termos de uso</terms> e a <privacy>política…</privacy>."`.
  - **Arrays:** `(t.raw('sobreNos.manifesto.lines') as string[]).map(…)`.
- **Seletor de idioma** — `src/components/language-switcher/index.tsx`: grava `document.cookie = "NEXT_LOCALE=…"` e chama `router.refresh()` (revalida os Server Components, que releem o cookie). Bandeiras via `country-flag-icons` (SVG — renderiza igual em qualquer SO); `es` usa o globo (espanhol é neutro, sem bandeira única).

> **Trade-off conhecido:** ler cookie torna o render dinâmico (SSR por request). No mobile isso não se aplica — a resolução é local e instantânea.

---

## 6. Estrutura dos catálogos de mensagens (a parte compartilhada)

Os 4 arquivos `messages/{pt,en,en-GB,es}.json` têm **as mesmas chaves** (paridade obrigatória). Namespaces atuais (top-level):

```
metadata, common, nav, languageSwitcher, home, artigos, baixarApp,
cadastro, carteirinha, clinicas, contato, errors, exclusao, forms,
linktree, listaEspera, pageMeta, sobreNos, tutor, privacidade, termos
```

Padrões de valor usados (todos **ICU MessageFormat**, portáveis para o mobile):

```jsonc
{
  "common": { "threeMonthsFree": "3 meses grátis", "back": "Voltar" },

  // Variável simples (single-brace ICU)
  "baixarApp": { "hero": { "titlePostSignup": "Pronto, {name}." } },

  // Plural ICU — '#' é o número formatado no locale
  "carteirinha": {
    "summary": {
      "allergies": "{count, plural, one {# alergia registrada} other {# alergias registradas}}"
    }
  },

  // Rich text — tags nomeadas viram componentes na renderização
  "cadastro": {
    "form": { "terms": "Aceito os <terms>termos de uso</terms> e a <privacy>política de privacidade</privacy>." }
  },

  // Quebra de linha (web-ism!) — ver gotcha §7.4
  "sobreNos": { "manifesto": { "title": "…cada pet merece <br></br> uma vida longa…" } },

  // Array (lista de bullets)
  "sobreNos": { "manifesto": { "lines": ["linha 1", "linha 2", "…"] } }
}
```

**Convenções de chave:** `camelCase`, agrupado por tela/seção (`home.appTour.slides.vacinas.bullets`). Nada de texto na chave — a chave é estável, o texto muda por locale.

---

## 7. Implementação no **mobile** (React Native / Expo)

next-intl é **exclusivo do Next.js** — não roda em RN. O equivalente que preserva **o mesmo catálogo ICU** é:

### 7.1 Stack recomendada

| Função | Pacote | Observação |
|---|---|---|
| Engine i18n | **`i18next`** + **`react-i18next`** | Padrão de mercado, maduro, hooks + `<Trans>`. |
| **ICU MessageFormat** | **`i18next-icu`** | **Decisão crítica:** faz o i18next entender `{count, plural, …}`, `{name}` e `<tag>` **iguais aos da web** → catálogo reaproveitado sem reescrever. |
| Locale do dispositivo | **`expo-localization`** | `getLocales()` → BCP-47 (`pt-BR`, `en-GB`, `es-MX`…). |
| Persistência | **`@react-native-async-storage/async-storage`** | Chave `APP_LOCALE`. (Alternativa rápida: `react-native-mmkv`.) |
| Formatação data/número | **`Intl`** (Hermes) | Hermes do Expo já traz `Intl` com ICU. Se faltar, polyfill `@formatjs/intl-*`. |

```bash
npx expo install expo-localization @react-native-async-storage/async-storage
npm i i18next react-i18next i18next-icu
```

### 7.2 Estrutura de pastas (espelha a web)

```
src/
  i18n/
    index.ts          # bootstrap do i18next (equivale a request.ts + provider)
    locales.ts        # lista de locales + default (equivale a routing.ts)
    resolve.ts        # device locale -> um dos 4 locales + persistência
  locales/            # <- catálogos (MESMO conteúdo de messages/*.json da web)
    pt.json
    en.json
    en-GB.json
    es.json
  components/
    LanguageSwitcher.tsx
```

> **Como compartilhar os catálogos:** copie `messages/*.json` da web para `src/locales/` (script de sync no CI) **ou** extraia para um pacote npm interno (`@petjourney/i18n-messages`) consumido pelos dois repos. O importante é que **as chaves sejam idênticas** (ver paridade, §8).

### 7.3 `locales.ts` — fonte da lista (igual ao `routing.ts`)

```ts
export const LOCALES = ["pt", "en", "en-GB", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt";

// Equivalente mobile do OG_LOCALE — para Intl (datas/números) e telemetria.
export const INTL_LOCALE: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en-US",
  "en-GB": "en-GB",
  es: "es", // LatAm neutro
};
```

### 7.4 `resolve.ts` — detecção + persistência

```ts
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "./locales";

const STORAGE_KEY = "APP_LOCALE";

/** Mapeia o BCP-47 do device para um dos 4 locales suportados. */
export function resolveDeviceLocale(): Locale {
  const tags = Localization.getLocales().map((l) => l.languageTag.toLowerCase());
  for (const tag of tags) {
    if (tag === "en-gb" || tag.startsWith("en-gb")) return "en-GB";
    if (tag.startsWith("pt")) return "pt";
    if (tag.startsWith("es")) return "es";
    if (tag.startsWith("en")) return "en"; // qualquer outro inglês -> US
  }
  return DEFAULT_LOCALE;
}

/** Escolha salva (override do usuário) ou null. */
export async function getStoredLocale(): Promise<Locale | null> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return (LOCALES as readonly string[]).includes(v ?? "") ? (v as Locale) : null;
}

export async function setStoredLocale(locale: Locale): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, locale);
}

/** Locale inicial: escolha salva > device > default. */
export async function getInitialLocale(): Promise<Locale> {
  return (await getStoredLocale()) ?? resolveDeviceLocale();
}
```

### 7.5 `index.ts` — bootstrap do i18next (com ICU)

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ICU from "i18next-icu";

import { DEFAULT_LOCALE, type Locale } from "./locales";
import { getInitialLocale, setStoredLocale } from "./resolve";

import pt from "../locales/pt.json";
import en from "../locales/en.json";
import enGB from "../locales/en-GB.json";
import es from "../locales/es.json";

// Catálogos como recursos do i18next. Um único namespace "translation"
// preserva as chaves "namespace.sub.chave" exatamente como na web.
const resources = {
  pt: { translation: pt },
  en: { translation: en },
  "en-GB": { translation: enGB },
  es: { translation: es },
};

export async function initI18n() {
  const lng = await getInitialLocale();
  await i18n
    .use(ICU)               // habilita ICU MessageFormat ({plural}, {name}, <tag>)
    .use(initReactI18next)
    .init({
      resources,
      lng,
      fallbackLng: DEFAULT_LOCALE,   // faltou tradução -> pt
      defaultNS: "translation",
      keySeparator: ".",             // "home.hero.title"
      interpolation: { escapeValue: false }, // RN não tem XSS
      returnNull: false,
      react: { useSuspense: false }, // recursos vêm embutidos (sync)
    });
  return i18n;
}

/** Troca de idioma + persistência (equivale a gravar o cookie + refresh). */
export async function changeLocale(locale: Locale) {
  await i18n.changeLanguage(locale);
  await setStoredLocale(locale);
}

export default i18n;
```

**No topo do app** (ex.: `App.tsx` ou root layout do expo-router) inicialize antes de renderizar a UI:

```tsx
import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { initI18n } from "./src/i18n";

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { initI18n().then(() => setReady(true)); }, []);
  if (!ready) return null; // ou splash
  return (
    <I18nextProvider i18n={i18n}>
      {/* … resto do app … */}
    </I18nextProvider>
  );
}
```

### 7.6 Consumo nos componentes — equivalência 1:1 com a web

| Caso | Web (next-intl) | Mobile (react-i18next) |
|---|---|---|
| Texto | `const t = useTranslations('common'); t('back')` | `const { t } = useTranslation(); t('common.back')` |
| Variável | `t('baixarApp.hero.titlePostSignup', { name })` | `t('baixarApp.hero.titlePostSignup', { name })` |
| Plural ICU | `t('carteirinha.summary.allergies', { count })` | `t('carteirinha.summary.allergies', { count })` |
| Array | `t.raw('sobreNos.manifesto.lines')` | `t('sobreNos.manifesto.lines', { returnObjects: true }) as string[]` |
| Rich text | `t.rich('cadastro.form.terms', { terms, privacy })` | `<Trans i18nKey="cadastro.form.terms" components={{ terms, privacy }} />` |

```tsx
import { useTranslation, Trans } from "react-i18next";
import { Text, Pressable } from "react-native";

function Exemplo() {
  const { t } = useTranslation();

  return (
    <>
      <Text>{t("common.back")}</Text>

      {/* Plural — a mesma string ICU da web */}
      <Text>{t("carteirinha.summary.allergies", { count: 3 })}</Text>

      {/* Array */}
      {(t("sobreNos.manifesto.lines", { returnObjects: true }) as string[]).map(
        (line, i) => <Text key={i}>{line}</Text>
      )}

      {/* Rich text — tags <terms>/<privacy> viram componentes RN */}
      <Trans
        i18nKey="cadastro.form.terms"
        components={{
          terms:   <Text style={styles.link} onPress={openTerms} />,
          privacy: <Text style={styles.link} onPress={openPrivacy} />,
        }}
      />
    </>
  );
}
```

### 7.7 Formatação de data / número / moeda

Use `Intl` com o locale do mapa `INTL_LOCALE`:

```ts
import { INTL_LOCALE } from "./locales";
import i18n from "./i18n";

const loc = INTL_LOCALE[i18n.language as keyof typeof INTL_LOCALE] ?? "pt-BR";
new Intl.DateTimeFormat(loc, { dateStyle: "medium" }).format(date);
new Intl.NumberFormat(loc).format(1234.5);
```

> Hermes (engine do Expo) já inclui `Intl` com ICU. Se o build não tiver, faça polyfill com `@formatjs/intl-getcanonicallocales`, `@formatjs/intl-locale`, `@formatjs/intl-pluralrules`, `@formatjs/intl-datetimeformat`, `@formatjs/intl-numberformat` **antes** de inicializar o i18n.

### 7.8 `LanguageSwitcher.tsx` (espelha o componente da web)

```tsx
import { useTranslation } from "react-i18next";
import { View, Text, Pressable } from "react-native";
import { LOCALES, type Locale } from "../i18n/locales";
import { changeLocale } from "../i18n";

// Em iOS/Android os emojis de bandeira renderizam normalmente (ao contrário do
// Windows na web). 'es' é neutro pan-LatAm -> globo, igual à web.
const FLAG: Record<Locale, string> = { pt: "🇧🇷", en: "🇺🇸", "en-GB": "🇬🇧", es: "🌎" };

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = i18n.language as Locale;

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("languageSwitcher.label")}>
      {LOCALES.map((loc) => {
        const active = loc === current;
        return (
          <Pressable
            key={loc}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => changeLocale(loc)}
          >
            <Text>{FLAG[loc]} {t(`languageSwitcher.${loc}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

> O namespace `languageSwitcher` já existe nos catálogos: `label`, `pt` ("Português (BR)"), `en` ("English (US)"), `en-GB` ("English (UK)"), `es` ("Español (LatAm)").

---

## 8. Paridade & QA

**Regra:** os 4 catálogos têm **exatamente** as mesmas chaves-folha. Antes de subir, valide. Script reaproveitável (web e mobile):

```js
// scripts/check-i18n-parity.mjs — uso: node scripts/check-i18n-parity.mjs
import fs from "node:fs";
const dir = "messages"; // ou "src/locales" no mobile
const base = "pt";
const leaves = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? leaves(v, `${p}${k}.`)
      : [`${p}${k}`]
  );
const ref = new Set(leaves(JSON.parse(fs.readFileSync(`${dir}/${base}.json`))));
let ok = true;
for (const loc of ["en", "en-GB", "es"]) {
  const cur = new Set(leaves(JSON.parse(fs.readFileSync(`${dir}/${loc}.json`))));
  const missing = [...ref].filter((k) => !cur.has(k));
  const extra = [...cur].filter((k) => !ref.has(k));
  if (missing.length || extra.length) {
    ok = false;
    console.log(`\n[${loc}] faltando: ${missing.length} | sobrando: ${extra.length}`);
    missing.slice(0, 20).forEach((k) => console.log("  - faltando", k));
    extra.slice(0, 20).forEach((k) => console.log("  + sobrando", k));
  }
}
console.log(ok ? "\n✅ paridade OK" : "\n❌ paridade quebrada");
process.exit(ok ? 0 : 1);
```

**Checklist por locale ao adicionar/alterar string:**
- [ ] Chave adicionada nos **4** arquivos (paridade verde).
- [ ] `es` em **usted** (su/sus, verbos), com `¿`/`¡`.
- [ ] `en-GB` com ortografia britânica (-ise/-our/-re).
- [ ] Termos do **glossário** (§4) respeitados; nomes próprios **não** traduzidos (§3).
- [ ] Plural via ICU (`{count, plural, …}`), nunca concatenação.
- [ ] Rich text via tags `<tag>` + `Trans` (mobile) / `t.rich` (web).
- [ ] Data/número via `Intl` com o locale certo.

---

## 9. Passo a passo de implementação no mobile

1. **Instalar** a stack (§7.1).
2. **Copiar** `messages/{pt,en,en-GB,es}.json` da web para `src/locales/` (e criar um job de sync para mantê-los iguais).
3. Criar `src/i18n/locales.ts`, `resolve.ts`, `index.ts` (§7.3–7.5).
4. **Inicializar** o i18n no topo do app, antes da UI (§7.5).
5. Trocar textos hard-coded por `t('namespace.chave')`; rich text por `<Trans>` (§7.6).
6. Adicionar o **`LanguageSwitcher`** (§7.8) em Configurações/Perfil.
7. Formatar datas/números via `Intl` (§7.7).
8. Rodar o **check de paridade** no CI (§8).

---

## 10. Armadilhas conhecidas (gotchas)

- **`<br></br>` é web-ism.** Aparece em algumas strings (`sobreNos.manifesto.title`, etc.). No mobile, **não** existe `<br>` — trate via `<Trans components={{ br: <Text>{"\n"}</Text> }} />` **ou** faça um pré-processamento `.replace(/<br><\/br>/g, "\n")`. Idealmente, novas strings usam `\n` direto em vez de `<br>`.
- **ICU single-brace `{name}`.** O i18next "puro" usa `{{name}}` (chaves duplas). Com **i18next-icu** ativo, use `{name}` (igual à web). Não misture os dois estilos.
- **`returnObjects` para arrays.** No mobile, arrays exigem `t(key, { returnObjects: true })`; sem isso o i18next devolve string.
- **Fallback silencioso.** `fallbackLng: 'pt'` evita mostrar a chave crua, mas **mascara** traduções faltando — por isso o check de paridade (§8) é obrigatório no CI.
- **`es` é neutro, sem bandeira única.** Use globo (🌎 / lucide `Globe`), como na web. Não use a bandeira da Espanha.
- **`en` vs `en-GB`.** São **dois** locales distintos (US e UK). O resolver de device precisa diferenciar `en-GB` de outros `en-*` (ver §7.4).
- **Não inventar catálogo paralelo no mobile.** Telas one-off às vezes tentam um objeto `COPY` local (como faz a página web `/apps-lojas`, que é fallback por ainda não estar no catálogo). Isso **não** deve virar padrão no mobile — toda string de UI vai pro catálogo compartilhado para manter paridade.

---

## 11. Mapeamento rápido web → mobile

| Conceito | Web (next-intl) | Mobile (i18next) |
|---|---|---|
| Lista de locales | `src/i18n/routing.ts` | `src/i18n/locales.ts` |
| Resolução do idioma | cookie `NEXT_LOCALE` (`request.ts`) | device + `AsyncStorage` (`resolve.ts`) |
| Provider | `<NextIntlClientProvider>` | `<I18nextProvider>` |
| Hook de texto | `useTranslations(ns)` | `useTranslation()` + chave completa |
| Variáveis / plural | ICU nativo | i18next-**icu** (mesma sintaxe) |
| Rich text | `t.rich(key, tags)` | `<Trans components={…} />` |
| Arrays | `t.raw(key)` | `t(key, { returnObjects: true })` |
| Trocar idioma | grava cookie + `router.refresh()` | `changeLocale()` (changeLanguage + persist) |
| `<html lang>` | `getLocale()` no layout | n/a (app nativo) |
| SEO/OG locale | `OG_LOCALE` em `generateMetadata` | n/a (usar `INTL_LOCALE` p/ Intl) |
| Catálogo | `messages/*.json` | `src/locales/*.json` (**mesmo conteúdo**) |

---

## 12. Referências (repo web, branch `develop`)

- `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/i18n/navigation.ts`
- `src/app/layout.tsx` (provider + metadata + `OG_LOCALE`)
- `src/components/language-switcher/index.tsx`
- `messages/{pt,en,en-GB,es}.json`
- `docs/specs/i18n-discovery.md` (decisões do stakeholder), `i18n-glossary.md` (glossário/estilo — §4 deste doc resume), `i18n-review.md` (checklist por locale: OG_LOCALE, dateLocale em artigos/carteirinha), `i18n-translation-task.md`

> ⚠️ Na web, todo esse sistema vive em **`develop`** — **não está em `main`** (em `main` as páginas são pt-BR hard-coded e `next-intl` nem está nas deps). Ao portar para o mobile, use os arquivos do branch `develop` como fonte.
