# i18n — Etapa 2: Glossário e Guia de Estilo

> Decisões de terminologia e tom, aplicadas de forma consistente em **todas** as traduções.
> Fonte das decisões: respostas do stakeholder em 2026-06-08 (ver `i18n-discovery.md` §8).

---

## 1. Idiomas e variantes

| Locale | Variante | Tratamento |
|---|---|---|
| `pt` | Português do Brasil (origem) | informal — "você" |
| `en` | **Inglês americano (US)** | neutro — "you" (color, organize, mom, customize) |
| `en-GB` | **Inglês britânico (UK)** | neutro — "you" (colour, organise, mum, customise) |
| `es` | **Espanhol neutro LatAm** | **formal — "usted"** (su mascota, organice, regístrese) |

### Regras por idioma
- **en-US:** ortografia US (organize/color/customize/center). Title Case em headlines e botões curtos (ex.: "Start Free Now", "Learn More"). Sentence case em parágrafos.
- **en-GB:** ortografia britânica — `-ise` (organise, customise, personalise), `-our` (colour, behaviour, favourite), `-re` (centre), `ll` dobrado (cancelled, enrolment→enrolment), "licence" (subst.)/"practise" (verbo), "whilst", "mum". Vocabulário UK quando aplicável ("mobile" não "cell", "holiday" não "vacation"), mas **manter os termos do glossário** (pet, vet, pet parent). Mesma estrutura/Title Case do en-US — difere só em ortografia/vocabulário, não em tom. Datas/números via `Intl` com locale `en-GB`.
- **es (LatAm, usted):** vocabulário neutro pan-hispânico (evitar regionalismos: usar "celular" e não "móvil"; "computadora"). Tratamento **usted** consistente em verbos e possessivos (su/sus). `¿` e `¡` de abertura obrigatórios. Concordância de gênero rigorosa.

---

## 2. Termos que NÃO se traduzem

- **Marca/nomes próprios:** PetJourney, nomes da equipe (Watson, Lily, etc.).
- **Lojas/plataformas:** App Store, Google Play, WhatsApp, Instagram, Facebook, LinkedIn.
- **Siglas legais:** LGPD, HIPAA, GDPR, ANPD, QR code.
- **Nomes de produtos/remédios em mocks:** Bravecto, V10, etc. (dados sintéticos do `IPhoneMockup`).
- **Labels de analytics** (`event({label})`) — permanecem em pt (chaves internas).

---

## 3. Glossário de produto (consistência obrigatória)

| pt | en (US) | es (LatAm, usted) | Obs. |
|---|---|---|---|
| pet | pet | mascota | "pet" é aceito em en-US e mais quente que "animal". |
| tutor | pet parent | dueño / tutor | en: "pet parent" (tom da marca); evitar "owner" frio. es: "dueño". |
| veterinário | veterinarian / vet | veterinario | "vet" em contextos informais/curtos. |
| clínica (veterinária) | (veterinary) clinic | clínica (veterinaria) | |
| prontuário | health record | historial clínico | |
| carteirinha (de vacinação) | (digital) vaccination card | cartilla de vacunación | |
| vacina / reforço | vaccine / booster | vacuna / refuerzo | |
| consulta | (vet) visit / appointment | consulta / cita | |
| medicação / medicamento | medication | medicamento | |
| peso | weight | peso | |
| documento | document / record | documento | |
| lembrete | reminder | recordatorio | |
| lembretes inteligentes | smart reminders | recordatorios inteligentes | |
| histórico (clínico) | history / clinical history | historial | |
| cadastro / cadastre-se | sign up | registrarse / regístrese | botão: "Sign up" / "Regístrese". |
| conta | account | cuenta | |
| grátis | free | gratis | |
| 3 meses grátis | 3 months free | 3 meses gratis | |
| sem cartão de crédito | no credit card required | sin tarjeta de crédito | |
| espécie | species | especie | |
| raça | breed | raza | |
| filhote | puppy/kitten (genérico: young pet) | cachorro/cría | cuidado: "cachorro" em es = puppy. |
| castrado | neutered/spayed | castrado/esterilizado | |
| microchip | microchip | microchip | |

---

## 4. CTAs e microcopy recorrentes (namespace `common`)

| pt | en (US) | es (usted) |
|---|---|---|
| Comece grátis agora | Start free now | Comience gratis ahora |
| Cadastre-se grátis | Sign up free | Regístrese gratis |
| Cadastre-se | Sign up | Regístrese |
| Saiba mais | Learn more | Más información |
| Ver como funciona | See how it works | Vea cómo funciona |
| Entre em contato | Get in touch | Contáctenos |
| Voltar | Back | Volver |
| ← Voltar ao site | ← Back to site | ← Volver al sitio |
| Ler mais | Read more | Leer más |
| Enviar | Send | Enviar |
| Enviando... | Sending… | Enviando… |
| Anterior / Próxima | Previous / Next | Anterior / Siguiente |

---

## 5. Tom da marca (aplicado a todos)

- **Formal, profissional e confiável — porém humano e natural.** Nada de tradução literal, falso cognato ou jargão corporativo vazio.
- **Headlines/CTAs:** curtos, idiomáticos, persuasivos. Reescrever, nunca traduzir palavra por palavra.
- **Localizar, não traduzir.** Reordenar/dividir frases quando soar melhor no idioma destino.
- **es:** mesmo com "usted" (formal), manter calor humano — formal ≠ robótico/distante.

---

## 6. Convenções técnicas

- **Datas/números:** usar `useFormatter`/`Intl` com o locale ativo (não strings fixas), exceto datas legais hardcoded (traduzir o mês manualmente).
- **Pluralização:** ICU `{count, plural, one {…} other {…}}` — pt/es têm `one/other`; en idem. Atenção a gênero no es (registrada/registradas).
- **Interpolação:** `{name}`, `{email}` — preservar exatamente o nome da variável em todos os idiomas.
- **Rich text:** tags inline via `t.rich` (`<strong>`, `<br/>`).
