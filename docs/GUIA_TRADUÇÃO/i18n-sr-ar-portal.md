# i18n: Sérvio (latino) e Árabe (RTL) no portal

**Data:** 2026-09-17
**Base:** [PROMPT-WEB-PORTAL-I18N-SERVIO-ARABE.md](PROMPT-WEB-PORTAL-I18N-SERVIO-ARABE.md) (decisões e processo do app mobile)
**Para a equipe de tradução:** [PetJourney-Portal-revisao-traducao-sr-ar.pdf](PetJourney-Portal-revisao-traducao-sr-ar.pdf)
**Glossário:** [i18n-glossary.md §8](i18n-glossary.md)

---

## 1. Resultado

| Item | Valor |
|---|---|
| Idiomas | `pt`, `en`, `en-GB`, `es`, **`sr`**, **`ar`** |
| Chaves por idioma | 2.527 (~10,6 mil palavras em inglês) |
| Catálogo clínico (fora dos JSON) | 176 linhas por idioma: 16 medicamentos, 12 diagnósticos, 9 exames, 7 tipos de atendimento, 8 salas (`catalog-text.ts`) |
| Tradução | 6 lotes × 2 idiomas (12 tradutores-agentes) + 2 tradutores do catálogo clínico; memória do app com sugestão para 576 chaves |
| Revisão cruzada | 2 revisores por idioma: sr 57 correções, ar 59 correções; padronização final sr 3, ar 1 |
| Verificação | `check:i18n` OK (6 idiomas), `vue-tsc` OK, ESLint OK, build OK, 805 testes OK (inclui renderização de todas as chaves sr/ar com vue-i18n) |

## 2. Infraestrutura

| Arquivo | O que mudou |
|---|---|
| `src/i18n/locales.ts` | `sr`, `ar` em `LOCALES`; mapas `INTL_LOCALE` (`sr-Latn-RS`, `ar-u-nu-latn`), `API_LOCALE` (`sr-Latn`, `ar`), `HTML_LANG`; `RTL_LOCALES` + `isRTLLocale()` |
| `src/i18n/index.ts` | catálogos sr/ar; fallback `sr/ar → en → pt`; `pluralRules`; `<html lang dir>` na troca de idioma e no boot |
| `src/i18n/plural.ts` (novo) | regras de plural sr (`one/few/other`, 4 formas com zero) e ar (6 formas) via `Intl.PluralRules` |
| `src/i18n/resolve.ts` | detecção do navegador pela 1ª subtag (`matchLocaleTag`): `sr-Cyrl` → sr; `srn`/`arn` não casam |
| `src/service/api.ts` | `Accept-Language` pelo `API_LOCALE` |
| `LanguageSwitcher.vue` | bandeira RS (sérvio) e AE (árabe), nomes nativos (`Srpski`, `العربية`), paddings lógicos; `Select` do PrimeVue nas três superfícies (login, configurações e menu do avatar, que antes usava `Listbox`), com altura suficiente para os 6 idiomas |
| `src/assets/main.css` | fonte `PetJourney Arabic` (Readex Pro, `@fontsource-variable/readex-pro`, só a faixa árabe via `unicode-range`); `--font-sans`; ícones direcionais espelhados em RTL (`scale: -1 1`) |
| Pilhas de fonte com nome fixo | `clinic-tokens.css`, `AuthLayout.vue`, `DocumentoFolha.vue`, `ProntuarioImpressao.vue` incluem `PetJourney Arabic` |
| `scripts/check-i18n-parity.mjs` | 6 idiomas; em sr/ar: placeholders e `{'x'}` iguais ao en, "PetJourney", em-dash, cirílico, marcas invisíveis, compilação vue-i18n, quantidade de formas de plural, listas `termo.*.itens` |
| `src/i18n/__tests__/i18n.spec.ts` (novo) | detecção, tags, regras de plural e renderização de todo o catálogo sr/ar |
| `eslint.config.ts`, `.gitignore` | ignoram `.i18n-work/` (pasta de trabalho local da tradução) |

Fonte: o portal não carrega fonte web para texto latino (DM Sans/system-ui). Cobertura conferida com `font-coverage.cjs`: sérvio 96 caracteres em Segoe UI, 0 faltando; árabe 129 caracteres em Readex Pro, 0 faltando.

## 3. RTL

- 71 arquivos convertidos para propriedades lógicas (`margin/padding/border-inline-*`, `inset-inline-*`, `text-align: start/end`, raios lógicos, Tailwind `ms-/me-`), sem mudança em LTR.
- Variantes `[dir='rtl']` para animações com `translateX` (menu lateral, brilhos dos cards, barra de desfazer).
- `AuthLayout.vue`: a arte de fundo espelha em RTL (a faixa verde acompanha a coluna da marca).
- `App.vue`: Toast em `top-left` no árabe. `PortalSaqueDetalheDrawer.vue`: Drawer à esquerda no árabe (PrimeVue posiciona pelo lado físico).
- Telefones exibidos dentro de texto isolados com `<bdi dir="ltr">` (10 componentes).
- `PassagemDePlantaoDialog.vue`: seta `→` de texto trocada por ícone (espelha).
- Conferido com screenshots em Chrome headless (desktop e celular): login, agenda com drawer, meu dia, internação, bulário (ar); início, meu dia, internação, resumo (sr). Gráficos ApexCharts continuam LTR.

## 4. Plural em sr/ar sem plural no inglês

29 chaves têm plural só em sr/ar (a palavra muda com o número nesses idiomas). Todas as chamadas passam o número como 3º argumento de `t()` (inofensivo em pt/en/es). Lista em `PLURAL_ONLY_IN_SR_AR` (`scripts/check-i18n-parity.mjs`). Ao criar chave com número + substantivo, avaliar se entra na lista.

## 5. Bugs antigos encontrados e corrigidos

| Onde | Problema | Correção |
|---|---|---|
| `DocumentoTermo.vue` | `t()` numa string com `\|` devolve só a 2ª forma: termos de consentimento, recusa e eutanásia saíam com **um item** (em todos os idiomas) | lista lida com `tm()` + `split('\|')` |
| `AltaDialog.vue` | avisos de alta sem o número do plural: "3 dose is still due" sempre no singular | `t(key, { total }, total)` |
| `useClinicFormat.ts` | `Intl` com o código cru do idioma (`sr` = cirílico, `ar` = possíveis dígitos ٠١٢) e números pelo `n()` do vue-i18n | `INTL_LOCALE` e `Intl.NumberFormat` |
| `fila.vue` | dias da semana fixos em pt ("seg", "ter") em todo idioma | `formato.diaDaSemanaCurtoPorIndice` |
| `utils/format/money.ts` + 6 telas | BRL sempre formatado em pt-BR | formato do idioma da tela (máscara/parse de digitação continuam pt-BR) |
| 5 listas | `localeCompare(..., 'pt-BR')` ou sem locale | `INTL_LOCALE` |
| `acessos/[id].vue` | peso e tamanho de arquivo com ponto decimal cru | `Intl.NumberFormat` |
| `DocumentoEncaminhamento.vue` | chave `diagnostico.kind.*` inexistente (a real é `diagnostico.tipo.*`): encaminhamento mostrava a chave crua | `diagnostico.tipo.*` |
| `FilaAdicionarDialog.vue` | rótulos "Prioridade" (chamava a chave-mãe, um objeto) e "Observação" (chave inexistente) saíam como chave crua | nova chave `clinico.fila.prioridadeRotulo` nos 6 idiomas; observação usa `clinico.prontuario.conduta.observacao`, como a `AgendaEditarDialog` |
| `inicio.vue`, extrato, saques | `text-transform: capitalize` em datas ("Setembro De 2026", sr "Septembar") | só a primeira letra |
| `bulario.ts` | alerta de cuidado casa texto livre só em pt/en | termos em sr e ar |
| `LanguageSwitcher.vue` | no login, o `backdrop-filter` do gatilho cria contexto de empilhamento: as opções do meio da lista ficavam atrás da copy da marca e não recebiam clique | `z-index` na raiz do seletor |

## 6. Riscos e pendências conhecidas (não corrigidos)

- Textos em pt fixos no código, visíveis em qualquer idioma: nome de fallback "Veterinário"/"Parceiro" (`stores/usuario-perfil.ts`, `stores/parceiro.ts`); erros de `auth-service.ts`/`upload-service.ts`; resumo de vacina gravado em pt (`vacina-repository.ts`); boletim ao responsável em pt (`boletim-texto.ts`, intencional); unidades de sinais vitais da fixture (`mpm`).
- Rótulo `clinico.agenda.mover.para` ("To") reaproveitado no drawer da agenda acima do horário.
- `utils/parceiro/modo-participacao.ts` decide fluxo lendo `error.message` do backend (depende do idioma da resposta).
- Listas com `join(', ')` usam vírgula latina no árabe; heatmap do resumo mostra "08h".
- PrimeVue sem `locale` configurado: textos internos dos componentes (vazio de select, calendário) ficam no inglês padrão, em todos os idiomas.
- Conteúdo da API (mensagens do backend, avisos de indicação) chega em pt/en até o backend suportar `sr-Latn`/`ar`.
- Telas do portal do parceiro dependem da API e não foram fotografadas em RTL; o layout usa os mesmos componentes convertidos.
- Textos legais e documentos clínicos impressos precisam de validação jurídica local; referências brasileiras (Portaria 344/98, CRMV, CPF, PIX, R$) seguem o en.

## 7. Questões para a equipe de tradução

Estão no guia do PDF ("Open questions"). Resumo: sérvio (barra de gênero no aceite dos termos, "pre 1 dan", "zakoniti staratelj/vlasnik", "uginuće" vs "smrtni ishod", "d" para dias, "boks", nomes dos programas); árabe (idade compacta longa, resumos de dose em rótulo, "البرنامج التشاركي", "حفظ بتنسيق PDF", h/min latinos, "التنويم"/"سرير", duais de idade); ambos (objeto indefinido do termo de consentimento redundante na origem, referências brasileiras, rótulo "To" reaproveitado).

## 8. Como repetir

A pasta de trabalho `.i18n-work/` (fora do git) guarda lotes, saídas, correções, notas dos tradutores, o validador vue-i18n (`kit/validate-vue.mjs`) e os geradores do PDF (`pdf/`). Para uma chave nova em sr/ar: traduzir seguindo §8 do glossário, rodar `npm run check:i18n` e `npx vitest run src/i18n`.
