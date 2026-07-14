# i18n — Discovery: PetJourney Admin (Vue)

> Inventário deste repositório (`petjourney-admin`), distinto do discovery da landing Next.js (`i18n-discovery.md`).
> Gerado em 2026-07-14. Fonte de verdade de escopo: código + flags de go-live.

---

## 1. Resumo executivo

| Item | Valor |
|---|---|
| Stack | Vue 3 + Vite + TypeScript + Vue Router + Pinia + PrimeVue + Tailwind v4 |
| i18n antes desta migração | Inexistente (textos PT-BR hardcoded) |
| Stack i18n adotada | `vue-i18n` (Composition API, `legacy: false`) — **implementada 2026-07-14** |
| Catálogos | `src/locales/{pt,en,en-GB,es}.json` (**642** chaves-folha, paridade OK) |
| Persistência | `localStorage` chave `APP_LOCALE` (sem locale na URL) |
| Fallback | `pt` |
| Tom | igual ao glossário compartilhado (`i18n-glossary.md`) |
| Progresso | `i18n-progress-admin.md` (todas as superfícies ativas validadas) |

---

## 2. Superfícies ATIVAS (traduzir)

| Ordem | Rota / superfície | Arquivos principais | Namespace |
|---|---|---|---|
| 1 | Auth shell + login | `AuthLayout.vue`, `login.vue` | `auth` |
| 2 | Register + forgot-password | `register.vue`, `forgot-password.vue` | `auth` |
| 3 | App shell + nav | `AppShell.vue`, `useAppNavigation.ts` | `nav`, `common` |
| 4 | Início | `inicio.vue` + atalhos | `inicio` |
| 5 | Programas | `programas.vue` + views/painéis | `programas` |
| 6 | Divulgação | `divulgacao.vue` + painéis | `divulgacao` |
| 7 | Carteira + saque | `carteira/index.vue`, `saques/[id].vue` | `carteira` |
| 8 | Selecionar / convite | `selecionar.vue`, `convite.vue` | `parceiro` |
| 9 | Settings + 404 | `settings/index.vue`, `[...pathMatch].vue` | `settings`, `errors` |

Shell compartilhado (LanguageSwitcher, CTAs comuns): namespaces `common`, `languageSwitcher`.

---

## 3. Superfícies INATIVAS (não traduzir nesta rodada)

| Motivo | Rotas / UI |
|---|---|
| `CLINICAL_MENU_ENABLED = false` | `/veterinario/agenda`, `atividades`, `pacientes`, `prontuarios`, `compartilhamentos` |
| `EQUIPE_MENU_ENABLED = false` | `/parceiro/equipe` (redirect → `/inicio`) |
| Excluído do router | `/tutor` |
| HTML comentado | Busca global no `AppShell`; botão “conta da clínica” no login |
| Mocks | `src/_mocks/**` |

---

## 4. Namespaces previstos

```
common, languageSwitcher, nav, auth, errors,
inicio, programas, divulgacao, carteira, parceiro, settings
```

Convenção de chave: `camelCase`, agrupada por domínio (`auth.login.title`).

---

## 5. Riscos

1. Volume de strings em formulários multi-step (register, programas/credenciamento).
2. Mensagens de erro vindas do backend — traduzir só moldura/UX; mapear erros conhecidos quando houver tabela local.
3. Datas/números: trocar `toLocaleDateString('pt-BR')` fixo por `INTL_LOCALE` nas telas tocadas.
4. Labels de nav clínicos existem no código mas ficam ocultos — não priorizar até reativar flags.

---

## 6. Referências

- Glossário: `i18n-glossary.md` (§7 termos do portal parceiro)
- Progresso: `i18n-progress-admin.md`
- Contexto compartilhado (tom/locales): `CONTEXTO_GERAL_TRADUCAO_WEB.md`
