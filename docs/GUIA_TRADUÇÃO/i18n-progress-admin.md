# i18n — Progresso: PetJourney Admin

> Checklist vivo. Atualizar após cada superfície (extrair → traduzir → validar → próximo).
> Discovery: `i18n-discovery-admin.md`. Glossário: `i18n-glossary.md`.

Legenda: ⬜ pendente · 🔨 em andamento · ✅ feito · ✔️ validado

---

## Infraestrutura

| Item | Status | Data | Notas |
|---|---|---|---|
| Discovery admin | ✔️ | 2026-07-14 | `i18n-discovery-admin.md` |
| Glossário portal parceiro | ✔️ | 2026-07-14 | §7 em `i18n-glossary.md` |
| vue-i18n + locales + resolve | ✔️ | 2026-07-14 | `src/i18n/*`, `src/locales/*`, `main.ts` |
| Script paridade | ✔️ | 2026-07-14 | `npm run check:i18n` — 642 chaves × 4 locales |
| LanguageSwitcher | ✔️ | 2026-07-14 | Select no login; Select em Configurações → Conta; Select no menu do avatar |

---

## Superfícies

| # | Superfície | Extrair/traduzir | Validado | Data validação | Gate |
|---|---|---|---|---|---|
| 1 | AuthLayout + login | ✔️ | ✔️ | 2026-07-14 | paridade · glossário · build/lint · clínica comentada intacta |
| 2 | Register + forgot-password | ✔️ | ✔️ | 2026-07-14 | idem + PasswordRequirements |
| 3 | AppShell + nav ativos | ✔️ | ✔️ | 2026-07-14 | clínico/equipe labels PT só atrás de flag off |
| 4 | Início | ✔️ | ✔️ | 2026-07-14 | dashboard + atalhos |
| 5 | Programas | ✔️ | ✔️ | 2026-07-14 | cards + credenciamento |
| 6 | Divulgação | ✔️ | ✔️ | 2026-07-14 | painel + chave `divulgacao.shareKit.linkName` |
| 7 | Carteira + saque | ✔️ | ✔️ | 2026-07-14 | visão/extrato/saques + detalhe |
| 8 | Selecionar / convite | ✔️ | ✔️ | 2026-07-14 | |
| 9 | Settings + 404 | ✔️ | ✔️ | 2026-07-14 | perfil/segurança/conta + `errors.notFound` |

### Gate de validação (fechado em 2026-07-14)

- [x] Mesmas chaves-folha nos 4 JSONs (`npm run check:i18n`)
- [x] Placeholders preservados (`{name}`, `{q}`, `{valor}`, …)
- [x] Glossário respeitado; marca/siglas intactas
- [x] `es` usted + `¿`/`¡`; `en-GB` (ex.: Forgotten password)
- [x] Superfícies ativas usam `t()` / `i18n.global.t`
- [x] `npm run build` e `npm run lint` limpos
- [x] Blocos comentados / telas inativas **não** traduzidos (exceto labels clínicos hardcoded só usados com flag off)

---

## Fora de escopo (esta rodada)

Clínico (`CLINICAL_MENU_ENABLED`), equipe, tutor, UI comentada (conta clínica no login; busca global se aplicável), `_mocks/`, conteúdo de API.
