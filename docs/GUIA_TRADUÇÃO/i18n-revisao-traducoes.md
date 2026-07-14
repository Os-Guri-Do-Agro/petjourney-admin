# i18n — Revisão de Traduções (PETJourney_Revisao_Traducoes.xlsx)

> Implementação das 34 sugestões da planilha de revisão. Fonte: `PETJourney_Revisao_Traducoes.xlsx` (aba "Sugestões de Revisão").
> Data: 2026-06-10. Ver também `i18n-glossary.md` e `i18n-review.md`.

## Legenda de status
- ⬜ Pendente · ✅ Implementado · ⏸️ Aguardando decisão · ➖ Sem ação (já correto)

> **Mapa de referências da planilha → namespace no código:**
> 00 Compartilhado=`common`/`nav.footer` · 01 Home=`home` · 02 Tutor=`tutor` · 03 Clínicas=`parcerias` · 04 Sobre Nós=`sobreNos` · 05 Contato=`contato` · 06 Artigos=`artigos` · 07 Cadastro=`cadastro` · 08 Lista de Espera=`forms.waitlist`/`listaEspera` · 10 Linktree=`linktree` · 11 Exclusão=`exclusao` · 12 Carteirinha=`carteirinha` · 13 Termos=`termos`

---

## 🔴 Críticos

| # | Idioma | Chave(s) | Mudança | Status |
|---|---|---|---|---|
| 1 | ES | (sistêmico) | `Dueño/Dueña/Dueños` → `Tutor/Tutora/Tutores` em todas as ocorrências | ✅ |
| 2 | EN-US | `contato.form.phonePlaceholder`, `forms.waitlist.placeholders.phone` | `(00) 00000-0000` → `(000) 000-0000` | ✅ |
| 3 | EN-GB | idem | `(00) 00000-0000` → `07911 123456` | ✅ |
| 4 | ES | idem | `(00) 00000-0000` → `+00 000 0000000` | ✅ |
| 5 | EN/EN-GB/ES | `*.validation.phone` / `telefone` | "11 digits/dígitos" → mensagem genérica de telefone válido | ✅ |
| 6 | PT/EN/ES | `exclusao.activePlan.description` vs `termos` Seção 12 | **Contradição no texto-fonte PT** (após o ciclo × imediato) | ⏸️ |
| 16 | ES | `tutor.title` | "Guía para dueños" → "Guía para tutores" | ✅ (via #1) |
| 17 | ES | `sobreNos.team.intro` | "...somos dueños de mascotas" → "...tutores de mascotas" | ✅ (via #1) |
| 21 | ES | `forms.waitlist.profiles.tutor`, `listaEspera.perfis.tutor` | "Dueño" → "Tutor" | ✅ (via #1) |
| 26 | ES | `carteirinha.tutorPrefix`, `.sections.tutor`, `.fields.tutor` | "Dueño" → "Tutor/a" (campo sem gênero) | ✅ (via #1) |
| 30 | ES | `parcerias.whiteLabel.relationship.bullets[2]` | "...con los dueños" → "...con los tutores" | ✅ (via #1) |
| 31 | ES | `parcerias.benefits.items.brand.description` | "...de los dueños" → "...de los tutores" | ✅ (via #1) |

## 🟡 Melhorias

| # | Idioma | Chave(s) | Mudança | Status |
|---|---|---|---|---|
| 7 | EN-US | `cadastro.lgpd` | "Fully compliant with the LGPD." → "...with applicable data protection law." | ✅ |
| 8 | EN-GB | `cadastro.lgpd` | → "Fully compliant with UK data protection law. (ICO)" | ✅ |
| 9 | ES | `cadastro.lgpd` | → "Cumplimiento con la normativa de protección de datos aplicable." | ✅ |
| 10 | EN/EN-GB | `home.appTour.slides.consultas.title` | "Your vet's full memory" → "Everything your vet needs to know" | ✅ |
| 11 | ES | idem | → "Todo lo que su veterinario necesita saber" | ✅ |
| 12 | EN/EN-GB | `home.howItWorks.steps.start.title` | "Start using it" → "Start taking care" | ✅ |
| 13 | ES | idem | → "Empiece a cuidar" | ✅ |
| 14 | EN/EN-GB | `tutor...tutorNotes.desc` | → "A log of recurring signs, symptoms, and care needs" | ✅ |
| 15 | ES | idem | → "Registro de señales, síntomas y necesidades de cuidado recurrentes" | ✅ |
| 18 | EN/EN-GB | `artigos.searchPlaceholder` | "What are you sniffing out?" → "What's your nose telling you?" | ✅ |
| 19 | ES | idem | "¿Qué está olfateando?" → "¿Qué anda buscando hoy?" | ✅ |
| 20 | ES | `listaEspera.hero.benefitsTitle` | "...y asegure:" → "...y obtenga:" | ✅ |
| 22 | EN/EN-GB | `linktree.ctaButton` | "I Want to Start" → "Get Started" | ✅ |
| 23 | ES | `linktree.ctaButton` | "Quiero empezar" → "Comience ahora" | ✅ |
| 24 | ES | `linktree.slogan` | "Cuidamos..." → "Cuidando de su mascota con amor y dedicación" | ✅ |
| 27 | ES | `termos` Seção 5.6 (título) | "Compartición con terceros" → "Transferencia de datos a terceros" | ✅ |
| 28 | ES | `termos` Seção 5.6 (corpo) | "...compartición con terceros..." → "...transferencia de datos a terceros..." | ✅ |
| 29 | EN/EN-GB/ES | `termos` Seção 12 p1 | nota de clareza sobre desativação vs. retenção de dados | ✅ |
| 32 | ES | `nav.footer.tagline` | "Cuidamos..." → "Cuidando de su mascota con amor y dedicación…" | ✅ |
| 33 | ES | `nav.footer.subscribeSuccess` | "¡Su suscripción se realizó con éxito!" → "¡Ya está suscrito/a!" | ✅ |
| 34 | ES | `common.noCreditCard` | "sin tarjeta de crédito" → "sin necesidad de tarjeta de crédito" | ✅ |

## ➖ Sem ação

| # | Idioma | Chave | Nota |
|---|---|---|---|
| 25 | EN | `carteirinha.tutorPrefix`/tutor | "Pet parent: {name}" — já correto, mantido |

---

## Pendência que precisa de decisão (item 6)

A planilha aponta uma **contradição no texto-fonte em PT-BR** (não é erro de tradução):
- **Exclusão de conta** (`exclusao`): a conta "só será excluída após o encerramento do ciclo atual".
- **Termos, Seção 12** (`termos`): a conta "será imediatamente desativada".

São conceitos potencialmente diferentes (encerramento de plano/cobrança × desativação de acesso), mas o texto pode confundir o usuário e tem implicação legal. O item 29 (nota de clareza nos Termos) **mitiga** a confusão em EN/ES, mas a fonte PT precisa de uma decisão de produto/jurídico antes da publicação.

> **Decisão (2026-06-10):** mantido como está por ora — será resolvido com o jurídico posteriormente. Nenhuma alteração de texto-fonte feita neste item.

## Notas de implementação
- Sistêmico (#1): aplicado via script de pares exatos em `messages/es.json`, com verificação de "dueño" residual = 0.
- Itens marcados "EN/EN-GB": o texto sugerido (US) não tem variação ortográfica US/UK, então foi aplicado igual nos dois.
- PT-BR de `cadastro.lgpd` mantém a sigla "LGPD" (a marca é brasileira); só EN/ES generalizam.
- Validação de 11 dígitos (#5): apenas o **texto** da mensagem foi ajustado em EN/ES; a regra de validação no código não foi alterada (decisão de produto separada).
