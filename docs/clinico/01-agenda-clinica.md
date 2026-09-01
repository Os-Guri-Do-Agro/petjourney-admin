# 01 · Agenda da clínica

> Protótipo da agenda operacional: visão por dia e por semana, várias pessoas e várias salas
> ao mesmo tempo, com encaixe, bloqueio e remarcação arrastando.

## Por que existe

A agenda é a tela onde a recepção vive, e é ela que decide se a clínica migra de sistema. Se
for pior que a atual, nada mais importa. É também onde o nosso diferencial aterrissa, porque o
agendamento vindo do responsável cai aqui.

## Pronto quando

Dá para percorrer um dia inteiro de uma clínica de três vets no protótipo: marcar, encaixar,
bloquear, arrastar e cancelar, sem sair da tela.

---

## Estado atual (auditoria de código)

A base é madura. O que segue foi verificado arquivo a arquivo, não presumido.

### Já existe e atende

| O que o requisito pede | Onde está | Observação |
|---|---|---|
| Grade por dia, colunas de profissional | `composables/useAgendaDia.ts` → `colunas` | Layout de faixas por sobreposição em `domain/overlap.ts` |
| Alternância para colunas de sala | `useAgendaDia.ts` (ramo `agrupamento === 'sala'`) | Bloqueio de sala só pinta coluna de sala — decisão correta e comentada |
| Eixo de tempo com o agora | `useAgendaDia.ts` → `mostrarLinhaDoAgora` | Só aparece quando o dia na tela é hoje |
| Dia com 40 atendimentos navegável | `useAgendaDia.ts` → `LIMITE_VIRTUALIZACAO` | Eixo virtualiza acima de 100 marcas |
| Encaixe com aviso de sobreposição | `AgendaCriarDialog.vue` | Avisa e sugere horário livre; **nada bloqueia** |
| Bloqueio de horário e recorrência | `AgendaBloquearDialog.vue`, `types.ts` → `Block` | Almoço, reunião, férias, manutenção, pessoal |
| Feriado / clínica fechada | `agenda.vue`, faixa de clínica fechada | Único conflito `blocking`, ainda assim contornável |
| Arrastar para remarcar com confirmação | `useAgendaDrag.ts` + `AgendaMoveDialog.vue` | Mostra de → para, avisos e texto ao responsável |
| Desfazer a última ação | `stores/agenda.ts` → `DESFAZER_SEGUNDOS`, `AgendaUndoBar.vue` | 8 s |
| Estado da visão na URL | `useAgendaUrlState.ts` | Link aberto pelo vet cai no mesmo lugar |
| Visão de semana com carga por dia | `AgendaWeekView.vue` | Ocupação em % **e** barra |
| Cancelamento com motivo | `AgendaCancelDialog.vue` | `CancelReason` tipado, tela traduz |
| Fila avisada quando o horário vaga | `agenda.vue` → `avisarFilaDaVaga`, `stores/fila.ts` | Cancelar e falta disparam |
| Marcar falta | `AgendaAppointmentDrawer.vue` — botão no rodapé do drawer | **Único ponto de entrada do módulo.** Libera o horário e avisa a fila; entra no desfazer de 8 s — ver L11 |
| Painel de faltas com minutos perdidos | `pages/(accounts)/veterinario/faltas.vue` | Abre filtrado em reincidentes |
| Atalhos de teclado | `useClinicShortcuts.ts` | D, S, T, ←, →, N, E, B, Z, ? |

### Casos difíceis já plantados no dataset

`data/seed.ts` → `casosDoDiaAncora()`, dia âncora determinístico com 40 atendimentos.

| Caso do requisito | Situação |
|---|---|
| Dois vets e três salas no mesmo horário | OK — `apt-sobrepoe-a/b` mais as salas do dataset |
| Atendimento que ocupa duas salas | OK — `apt-cirurgia-centro` + `apt-cirurgia-recuperacao`, via `linkedGroupId` |
| Atendimento que atravessa o almoço | OK — caso `atravessa-almoco` |
| Dia com quarenta atendimentos | OK — `ATENDIMENTOS_NO_DIA_ANCORA = 40` |
| Encaixe de emergência **dentro de bloco reservado** | Falta — ver lacuna L9 |

---

## Lacunas

O que o requisito pede e o código hoje não faz.

### L1 · Legenda por tipo de atendimento, legível sem depender só de cor

**Pedido explícito do requisito.** Não existe legenda alguma na agenda — busca por `legenda`
em `features/clinico` só encontra os gráficos do resumo. Hoje o tipo do atendimento vive na
cor da borda do card e no texto interno: quem olha a grade de longe não tem chave de leitura,
e quem não distingue cores não tem nenhuma.

Entregar: legenda dos sete `AppointmentTypeKind` com **cor + ícone + nome**, recolhível,
posicionada onde não roube altura da grade. O ícone é o que a torna independente de cor.

### L2 · Carga por profissional na visão de semana

A subtarefa pede "ocupação por dia **e por profissional**". `AgendaWeekView.vue` mostra só o
agregado do dia. A recepção que responde *"terça de manhã está vazia"* precisa saber **de
quem** está vazia — a agenda da Ana cheia e a do Caio vazia somam 50% e escondem as duas
respostas.

Entregar: por dia, a ocupação de cada profissional em linha própria; e um recorte por período
(manhã/tarde), que é como a pergunta chega no balcão.

### L3 · Disparar o reagendamento a partir da falta

Busca por `reagend` em `features/clinico` e em `locales`: **zero ocorrências**. Marcar falta
hoje só muda o status. A subtarefa nomeia três coisas e a terceira não existe.

Entregar: ação "Reagendar" na linha da falta e no drawer do atendimento faltado, que abre a
criação já com paciente, tipo e profissional preenchidos e sugestão dos próximos horários
livres.

### L4 · Histórico de faltas do responsável

`faltas.vue` mostra o **agregado** (`NoShowSummary`: contagem, minutos, última). A subtarefa
pede "ver o histórico de faltas do responsável" — as faltas em si, com data, tipo e se houve
reagendamento depois. Sem isso não dá para distinguir três faltas em três anos de três faltas
no mês.

Entregar: detalhe expansível ou painel lateral por responsável, listando cada falta.

### L5 · Posição na fila

`WaitlistEntry` não tem posição e `fila.vue` não a mostra. A subtarefa pede "a lista, **a
posição na fila** e a mensagem que sai". Sem posição a fila não responde à única pergunta que
o responsável faz ao telefone: *"sou o quantos?"*.

Entregar: posição calculada por prioridade e antiguidade, visível na tabela e citável no
telefone.

### L6 · A mensagem que sai da fila

`AgendaMoveDialog.vue` já mostra e deixa editar o texto que vai ao responsável. A oferta de
vaga (`fila.ofertar`) dispara **sem prévia nenhuma**. A subtarefa pede a mensagem
explicitamente.

Entregar: prévia editável antes de ofertar, no mesmo padrão da remarcação, com o prazo da
oferta dentro do texto.

### L7 · Entrar na fila pela tela

A chave `clinico.fila.adicionar` existe nos quatro idiomas e **nenhum componente a usa**. A
fila só nasce do dataset. O fluxo "não há horário, o responsável entra na fila" não fecha no
protótipo.

Entregar: botão e diálogo de entrada na fila, com janelas aceitas e prioridade. Ponto de
partida natural: quando `AgendaCriarDialog` não acha horário bom, oferecer a fila ali.

### L8 · Registro dos avisos enviados

O texto da remarcação é digitado, confirmado e **some**. Não fica registro de que o
responsável foi avisado, quando, nem do quê. Numa tela cujo requisito diz *"errar aqui liga
para o tutor errado"*, o comprovante é parte do fluxo.

Entregar: histórico de avisos por atendimento (remarcação, cancelamento, oferta de vaga),
visível no drawer.

### L9 · Encaixe de emergência dentro de bloco reservado

O caso difícil pedido é o encaixe **no meio de um bloco reservado**. `apt-encaixe` está às
10:20 com a prof-ana, e nenhum bloqueio dela cobre esse horário — o único bloco às 10:00 é de
sala (`bloco-manutencao`, sala-exame). O caso, como está, não exercita o conflito
`block-invasion`.

Entregar: mover o encaixe para dentro de um bloco de profissional, ou plantar um bloco por
baixo dele, de modo que a grade mostre a emergência atravessando o bloco reservado e o
diálogo levante `block-invasion`.

### L10 · Aviso de sobreposição durante o arraste

O aviso existe **no diálogo**. Depois de criado, o card encaixado mostra conflitos
(`conflitosNoCard`), mas a sobreposição no momento do gesto — arrastar por cima de horário
cheio — só aparece ao soltar. Um sinal durante o arraste evita abrir o diálogo à toa.

Entregar: realce da faixa de destino durante o arraste quando houver sobreposição.

### L11 · Marcar falta está escondido no drawer

A ação existe, mas só no rodapé do drawer, atrás de dois cliques, e nada no card sugere que ela
mora lá dentro. Três consequências:

- **Não se descobre.** Quem procura "onde marco falta" não acha sem abrir um atendimento.
- **O rótulo é substantivo.** O botão diz "Falta" (reaproveita `formato.status`), ao lado de
  "Cancelar", que é verbo. Fica ambíguo se é estado ou comando.
- **Marcação é uma a uma.** Falta se marca em lote, no fim do turno: hoje são dois cliques por
  paciente mais fechar o drawer.

Entregar: ação de falta direto no card (menu de contexto ou botão que aparece no hover, com
equivalente de teclado), rótulo em forma de comando, e um modo de fechar o turno que percorra
os atendimentos não iniciados que já passaram do horário.

---

## Plano de execução

Ordem por dependência e por peso no "pronto quando".

### Bloco A — Leitura da grade ✅

- [x] **L1** Legenda por tipo (cor + ícone + nome), recolhível e clicável para filtrar
- [x] **L10** Realce de sobreposição durante o arraste, com o motivo por escrito
- [x] **Extra** Arraste no agrupamento por sala deixou de corromper `professionalId`

### Bloco B — Semana que responde "onde cabe alguém" ✅

- [x] **L2** Carga por profissional e por período na visão de semana — iniciais e cor da coluna
      da grade, duas barras por pessoa (manhã e tarde, cada uma contra meio expediente) e a
      ocupação do dia em número ao lado.

### Bloco C — Falta vira ação ✅

- [x] **L11** Marcar falta a um clique no próprio card — só aparece para quem já devia ter
      chegado, e no hover ou no foco. Rótulo virou comando ("Marcar falta").
- [x] **L3** Reagendar a partir da falta — a caixa abre **junto** com a marcação, já com
      horários buscados e o telefone do responsável clicável. Também disponível no painel de
      faltas. Mesmo motor do retorno do prontuário.
- [x] **L4** Histórico de faltas do responsável — cada falta com data, tipo, minutos perdidos
      e **se voltou depois**; quem já remarcou não recebe convite para remarcar de novo.

### Bloco D — Fila que fecha o ciclo ✅

- [x] **L5** Posição na fila — prioridade e depois antiguidade, com quem já recebeu oferta
      fora da contagem. Regra em `domain/waitlist.ts`, 7 testes.
- [x] **L6** Prévia da mensagem de oferta, com o prazo dentro do texto.
- [x] **L7** Entrar na fila pela tela — botão próprio, e a saída aparece **dentro do
      agendamento** quando não há horário nem alternativa.

### Bloco E — Rastro e casos difíceis ✅

- [x] **L8** Histórico de avisos enviados por atendimento — remarcação, cancelamento,
      reagendamento e oferta de vaga deixam comprovante, visível no drawer.
- [x] **L9** Encaixe de emergência dentro de bloco reservado — movido para 16:20 por cima do
      bloqueio pessoal do prof-tiago, e travado por teste para não evaporar de novo.

---

## Defeitos encontrados durante a execução

### D1 · Arrastar no agrupamento por sala corrompia o atendimento — **corrigido**

A grade entrega o id da coluna de destino, e `useAgendaDrag` o colocava direto em
`professionalId`. No agrupamento por profissional isso está certo; **por sala, a coluna é uma
sala**, e o gesto gravava um id de sala dentro de `professionalId`. O atendimento sumia de
todas as colunas de profissional, sem erro na tela e sem nada no console — só reaparecia
quando alguém reabria o dia e reparava na falta.

O mesmo valia para o equivalente de teclado: `colunas.indexOf(appointment.professionalId)`
devolve `-1` no agrupamento por sala, e a primeira seta lateral jogava o card para a coluna 0
qualquer que fosse a origem.

Corrigido dando à proposta de arraste a noção de **destino**: quem monta a grade sabe o que a
coluna significa e traduz (`destinoDaColuna`). Por sala, a troca substitui só a sala de origem
na lista — atendimento em duas salas não perde a outra. Coberto por
`data/__tests__/agenda-mover.spec.ts`.

### D2 · O fantasma do arraste mostrava os conflitos do lugar errado — **corrigido**

A prévia herdava `conflitos` do card original. Arrastar para um horário livre continuava
exibindo o aviso antigo, e arrastar para cima de horário cheio não exibia nada. Agora os
conflitos são recalculados na posição de destino a cada movimento — que é o que sustenta o L10.

---

## Decisões

- **Nada bloqueia.** Sobreposição, sala ocupada e dia fechado seguem agendáveis com aviso.
  A clínica encaixa mesmo; regra que proíbe vira regra contornada no papel. Vale para tudo
  que for adicionado aqui.
- **Conflito viaja como `kind` mais `params`**, nunca texto pronto — o portal tem quatro
  idiomas e a tradução é da apresentação.
- **Sem API.** Tudo entra em `data/` com o formato que o backend terá; nenhum componente
  conhece `fixtures`.
- **Cor nunca sozinha.** Toda codificação por cor ganha ícone ou texto ao lado.
