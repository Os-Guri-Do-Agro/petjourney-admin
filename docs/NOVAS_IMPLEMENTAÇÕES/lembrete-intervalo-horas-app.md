# Spec Frontend (App): Lembrete com Intervalo em Horas

**Status:** Backend LIVE em dev (2026-08-05). O app **já estava implementado**; isto aqui é integração e verificação.
**Autor:** Claude + Nicolas
**Criado em:** 2026-08-05
**Superfície:** `petjourney-app` (Expo / React Native)
**Spec de backend:** [lembrete-intervalo-horas.md](lembrete-intervalo-horas.md)
**Pedido original do app:** `petjourney-app/docs/specs/2026-08-01-lembrete-intervalo-horas-backend.md`

---

## 0. O que você precisa saber, em 3 linhas

O backend aceitou o contrato **exatamente como o app pediu**: `frequencia: "INTERVALO_HORAS"` + `intervaloHoras: 1..72`. Nada a mudar no que já está implementado (picker, forms, card, services, i18n nos 4 locales).

O que esta spec traz é o que **não estava no pedido** e o app precisa saber: uma regra nova de cálculo (catch-up), dois erros novos com `reason` roteável, e um limite conhecido do backend que tem consequência de UX real em regimes curtos.

---

## 1. O que já está pronto no app (conferido)

| Peça | Arquivo | Estado |
|---|---|---|
| Roleta de intervalo | `components/forms/IntervaloHorasPicker.tsx` | Pronto |
| Formulário de lembrete | `components/lembrete/LembreteForm.tsx` | Pronto |
| Formulário de medicamento | `components/medicamento/MedicamentoForm.tsx` | Pronto |
| Rótulo do card ("A cada 12h") | `components/LembreteCard.tsx` | Pronto |
| Contrato do service | `services/lembrete/lembrete-service.ts` | Pronto |
| Contrato do medicamento | `services/medicamento/medicamento-service.ts` | Pronto |
| i18n (`pt`, `en`, `en-GB`, `es`) | `src/locales/*.json` | Pronto |

Nada disso precisa mudar. A faixa da roleta (1 a 72) bate com a faixa aceita pelo backend.

---

## 2. O que mudou em relação ao pedido original

### 2.1 Catch-up: a próxima ocorrência pode não ser `dataPrevista + intervalo`

Esta é a única mudança de semântica, e é a que mais importa para o app.

**O problema:** com o cálculo literal do pedido (`proxima = atual + 12h`), um tutor que conclui a dose das 08:00 só às 21:00 do dia seguinte ganharia uma próxima ocorrência **já vencida**. Em série de 6/6h, isso vira uma pilha de lembretes atrasados que o tutor tem que ir concluindo um a um.

**O que o backend faz agora:** avança em múltiplos do intervalo até cair no futuro, preservando a fase da grade.

```
Série 12/12h, grade 08:00 / 20:00
Ocorrência prevista: 01/08 08:00
Tutor conclui em:    03/08 09:30   (mais de 2 dias de atraso)

Antes (literal):  próxima = 01/08 20:00   (já passou)
Agora (catch-up): próxima = 03/08 20:00   (próximo horário FUTURO da grade)
```

**O que o app precisa fazer:** nada, desde que **use a data que o backend devolve** e não recalcule por conta própria.

- No response do `PATCH /lembrete/:id/status`, use `proximaOcorrencia.dataPrevista`.
- Não assuma `dataPrevista + intervaloHoras` em nenhum lugar da UI (ex.: para mostrar "próxima dose às X" logo após concluir).

Se hoje o app calcula essa previsão localmente em algum ponto, é o único ajuste real desta integração.

> A assimetria é proposital: catch-up vale **só** para `INTERVALO_HORAS`. `DIARIO`, `SEMANAL`, `MENSAL` e `ANUAL` mantêm o comportamento de sempre (um passo a partir da data prevista).

### 2.2 Erros novos, com `reason` roteável

Duas chaves novas, traduzidas nos 4 locales, com `reason` no topo do payload:

| `reason` | Status | Quando | Copy do backend (pt-BR) |
|---|---|---|---|
| `LEMBRETE_INTERVALO_HORAS_OBRIGATORIO` | 400 | `INTERVALO_HORAS` sem `intervaloHoras` | "Escolha de quantas em quantas horas o lembrete deve se repetir." |
| `LEMBRETE_INTERVALO_HORAS_INVALIDO` | 400 | fora de 1..72, ou fracionado | "O intervalo do lembrete precisa ser um numero inteiro de horas entre 1 e 72." |

Como o app monta o payload pelo picker, esses erros só aparecem em bug ou em request montada à mão. Ainda assim: **use a `message` do backend** (ela vem no locale da request) em vez de string fixa no app, e use o `reason` para decidir onde focar (o campo do intervalo).

### 2.3 `intervaloHoras` volta em todas as rotas de leitura

Confirmado nas cinco: `GET /lembrete/:id`, `GET /lembrete/by-serie/:serieId`, `GET /lembrete?petId=`, `GET /lembrete/proximos?tutorId=`, `GET /lembrete/historico?tutorId=`. Vem `null` quando a frequência não é horária.

O fallback que o app já tem (rótulo genérico + edição abrindo com 12h) segue valendo como rede, mas não deve disparar.

### 2.4 Trocar de frequência limpa o intervalo

Se o tutor edita um lembrete de 12/12h e muda para `MENSAL`, o backend **zera** `intervaloHoras`. Na volta, o campo vem `null`. Se a tela de edição guarda o último valor escolhido em estado local, ela pode mostrar "12" num lembrete que já é mensal. Vale conferir.

---

## 3. Limite conhecido do backend (afeta UX)

**Não existe job de recorrência.** A próxima ocorrência de qualquer série só nasce quando o tutor **conclui ou pula** a atual. Isso não é novo (já valia para `DIARIO`), mas em 12/12h, e mais ainda em 6/6h, a consequência aparece rápido:

> Se o tutor não marcar a dose das 08:00, a das 20:00 **não existe** e não vai notificar.

Como a notificação é local (agendada pelo app a partir de `GET /lembrete/proximos`), o efeito prático é: **uma dose esquecida quebra a corrente**.

O que dá para fazer no app, sem depender de backend:

- Deixar o "concluir" a um toque de distância no card e na notificação, em vez de exigir abrir o detalhe.
- Considerar um lembrete de "você tem uma dose em aberto" quando existir ocorrência `ATRASADO` de série `INTERVALO_HORAS`.
- Deixar claro na tela de criação que o regime avança conforme as doses vão sendo marcadas.

A alternativa estrutural (job que materializa ocorrências à frente) está registrada como follow-up na spec de backend e precisa de spec própria.

---

## 4. Regras que continuam valendo

- **`INTERNACAO` + recorrente** segue bloqueado. `INTERVALO_HORAS` não abre exceção.
- **Pular dose** (`status: "CANCELADO"`) em série recorrente gera a próxima normalmente, com o mesmo espaçamento.
- **Duplicata** (`OCORRENCIA_DUPLICATA`, 409): a checagem compara data **e hora**, então intervalos curtos no mesmo dia não colidem. A preocupação levantada no pedido original não se confirmou.
- **`afetarFuturas`** (reverter conclusão) não mudou de semântica.

---

## 5. Checklist de aceite (app)

- [ ] Criar lembrete 12/12h pelo app funciona de ponta a ponta e o card mostra "A cada 12h".
- [ ] Concluir a dose usa `proximaOcorrencia.dataPrevista` do response, sem recalcular localmente.
- [ ] Concluir uma dose **atrasada** (mais de um intervalo) mostra a próxima no futuro, e a UI não estranha o salto.
- [ ] Reabrir a edição de um lembrete 12/12h traz a roleta em 12.
- [ ] Mudar de `INTERVALO_HORAS` para `MENSAL` e reabrir: a roleta não mostra resíduo do intervalo antigo.
- [ ] Criar medicamento com dose 12/12h cria a série com o intervalo certo.
- [ ] Os 400 de intervalo mostram a mensagem do backend (não string fixa) e destacam o campo do intervalo.
- [ ] Nenhuma copy nova com em-dash; `en-GB` explícito nos 4 arquivos de locale (já está).

---

## 6. Como testar

Ver o roteiro fluxo a fluxo em [docs/nicolas/q3-2-o-que-foi-feito-e-como-testar.md](../../../../nicolas/q3-2-o-que-foi-feito-e-como-testar.md), seção "Fluxo 5".

---

## 7. Fora do escopo

- Job de materialização antecipada de ocorrências (backend, spec própria).
- Push notification server-side (não existe backend de push; a notificação segue local).
- Mudar catch-up para as frequências de calendário.
