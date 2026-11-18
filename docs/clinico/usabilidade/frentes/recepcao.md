# Frente **recepcao** — avaliação heurística de usabilidade (módulo Clínica)

Persona: recepcionista e gerente de clínica veterinária, no balcão, atendendo telefone e cliente ao
mesmo tempo. Sessão: `portal-demo@petjourney.test` na API de dev, 16/11/2026 (madrugada), dados em
09/11. Viewports: 1440x900 (base), 1024x768 (tablet deitado) e uma conferência em 768x1024.
Capturas em `C:\Users\darkb\AppData\Local\Temp\claude\478cf78b24a912ec\6f943fdd-c525-4bf3-9a49-d6f9880f96e5\scratchpad\analise\capturas\recepcao\` (54 arquivos, citados abaixo só pelo nome).

Severidade: **P0** impede a tarefa · **P1** confunde ou atrasa muito · **P2** incomoda · **P3** polimento.
Não encontrei P0 puro (nada que trave de vez). O que encontrei é um conjunto grande de P1 que, somados,
explicam a queixa "difícil de usar": cada tarefa do balcão esbarra em dois ou três deles.

## O que não consegui ver, e por quê

- **Hoje com o dia cheio**: a agenda de 16/11 está vazia. Avaliei o vazio na tela e o cheio pelo código
  (`MeuDiaFoco.vue`, `useMeuDiaDaClinica.ts`).
- **Pedido esperando resposta**: não havia nenhum ("Nenhum pedido esperando resposta"). Vi a lista de
  Aceitos e a gaveta em modo leitura; o fluxo de responder foi lido em `RespostaDoPedidoGaveta.vue`.
- **Fila de espera, Correções e Faltas "A justificar" com itens**: as três estavam vazias. Formulários e
  linhas lidos no código.
- **Bento não existe nesta conta** (busca "bento" em Ativos e Inativos: "Nenhum paciente com essa
  busca"). Usei **Fubá** e **Bidu**.
- **Menu recolhido ("Recolher menu")**: não acionei. A escolha é gravada no `localStorage`, que é
  compartilhado com as abas dos outros agentes. Em 1024 a barra **não** recolhe sozinha (ver casca).
- **Não cliquei** (gravam na hora, sem confirmação): "Marcar chegada", "Confirmar presença", "Iniciar
  atendimento", "Marcar" (Retornos), "Encerrar" (alerta), "Desativar"/"Reativar" (Configuração), itens da
  lista de Avisos (o clique marca como lido), "Sugerir horários" (rota com teto por hora), "Usar este"
  (importação).
- Tema escuro e outros idiomas: fora do combinado.
- Abas vizinhas de outra frente (Atendimentos, Bulário, Cópias, Vacinas, Tratamentos em casa, Estoque de
  vacinas): só avaliei o nome e o lugar delas.
- De passagem: o selo de "Pacientes" no menu oscilou durante a sessão (5 → 3 → sem selo → 5),
  provavelmente por uso de outra aba; e `resize_page` não mudou o viewport (usei a emulação de viewport).

---

## 0. A casca e a navegação

**Fontes:** `src/components/layout/AppShell.vue`, `src/components/layout/ShellNavegacao.vue`,
`src/navegacao/espacos.ts`, `src/composables/useAppNavigation.ts`, `src/components/ui/UiPagina.vue`,
`src/components/ui/UiAbas.vue`, `src/components/layout/ShellAvisos.vue`, `src/components/layout/ShellCriar.vue`.

**O que responde:** onde estou e para onde posso ir.

**Anatomia (1440x900):** barra lateral de 272 px (19% da largura): topo com a empresa (100 px), mapa
(Início + Clínica 7 + Hotel 4 + Portal 7 = 22 linhas de ~52 px) e pé com Avisos e conta (129 px). À
direita, cada tela abre com uma faixa verde: título, uma frase de estado, ações e a fileira de abas.

**Altura consumida pela casca** (medido):

| Tela | Faixa verde | Primeira linha de trabalho em | % da altura antes do trabalho |
|---|---|---|---|
| Agenda 1440x900 | 174 px | 326 px (primeira hora da grade) | 36% |
| Agenda 1024x768 | 174 px + barra de data em 2 linhas (98 px) | ~385 px | 50% |
| Pacientes 1440x900 | 174 px | ~285 px | 32% |
| Pacientes 1024x768 | 174 px | ~340 px | 44% |
| Hoje 1440x900 (vazio) | 278 px | 320 px | 36% |
| Hoje 1024x768 (vazio) | 359 px | 400 px | 52% |
| Ficha / Cadastrar (sem abas) | 110 px | 138 px | 15% |

### Problemas

1. **P1 — Fora do modo Demonstração não existe busca global nem "Criar".** Em `AppShell.vue` o botão de
   busca e o `Ctrl K` só existem com `clinicaNaDemonstracao`, e `ShellCriar` recebe
   `:clinica="clinicaNaDemonstracao"` (lista vazia fora da demo). Na sessão real a barra não tem busca,
   nem "novo agendamento / novo paciente / pôr na fila" (`01-hoje-vazio-1440.jpg`). O próprio comentário
   de `ShellCriar.vue` descreve a dor que isso resolvia ("a recepção estava olhando o Tofu e caía em
   'Escolha o paciente'"). **Proposta:** ligar busca (paciente, responsável, telefone) e "Criar" pela API,
   sempre visíveis no alto da barra; `Ctrl K` de qualquer tela; resultado com telefone e atalhos
   "Marcar horário" / "Abrir ficha".
2. **P1 — O menu não cabe e não avisa.** 1.262 px de menu em 655 px visíveis (1440x900): metade fica
   abaixo da dobra, sem barra de rolagem; "Hotel > Hoje" aparece cortado e o Portal inteiro some
   (`01-hoje-vazio-1440.jpg`, `02-casca-menu-rolado-1440.jpg`). Em 1024x768 só cabem Início e Clínica.
   Para ir a "Estabelecimento" (onde moram os feriados) é preciso rolar a barra. **Proposta:** linha de
   40 px; abrir só o espaço em uso e deixar os outros fechados numa linha com o selo (o modo que
   `ShellNavegacao` já tem quando `todosAbertos` é falso); lembrar por pessoa.
3. **P1 — Em 1024 a barra continua com 272 px** (26,6% da largura) e o conteúdo fica com 752 px (680
   úteis), menos do que no tablet em pé (768). Classe `shell--recolhida` ausente em 1024
   (`18-agenda-dia-1024.jpg`). **Proposta:** recolher para ícones abaixo de 1280 px (ou virar gaveta até
   1100), com o rótulo no toque longo/hover.
4. **P1 — Cinco lugares dizem "o que está pendente", com cinco números** (detalhe no percurso 8):
   Início "2 assuntos urgentes", Hoje "1 assunto esperando você", selo "Pacientes 5", Pendências >
   Atividades "2 prontuários em rascunho e 1 resumo", Avisos "29". O destino **Pendências não tem selo**,
   e o selo vermelho de **Pacientes** soma rascunhos de prontuário (aba Atendimentos, 2) com pedidos de
   cópia (aba Cópias, 3): nada a ver com paciente. **Proposta:** uma fonte só de contagem; selo no
   destino que resolve (Pendências); mesma frase e mesmo destino em todos os lugares.
5. **P1 — Regra de título muda de aba para aba.** Agenda > Pedidos vira "Pedidos de horário"; Agenda >
   Fila vira "Fila de espera"; Pendências > Faltas vira "Faltas"; mas Pacientes > Correções continua
   "Pacientes" (com o subtítulo "Nenhum pedido aberto", `39-correcoes-1440.jpg`) e Pendências > Retornos
   continua "Pendências" ("Nenhum retorno vencido.", `44-pendencias-retornos.jpg`). O comentário de
   `UiPagina.vue` diz que o título é o nome do destino; metade das telas passa `titulo` próprio.
   **Proposta:** uma regra só: título = destino, abas dizem a tela, e a frase de estado sempre nomeia o
   assunto ("Correções: nenhum pedido aberto").
6. **P1 — Nomes que não dizem o que tem dentro:**
   - **"Fila de espera"** é a lista de quem aguarda **vaga na agenda** ("Ninguém aguardando vaga"), não
     quem está na recepção esperando. Para o balcão, "fila de espera" é a sala de espera. → "Lista de
     espera" ou "Aguardando vaga".
   - **"Atividades"** é o painel das pilhas atrasadas (pedidos atrasados, faltas sem contato, retornos
     vencidos, vacinas atrasadas, rascunhos, resumos não enviados: `AtividadesDaClinica.vue`). → "Visão
     geral" ou "Tudo que está parado".
   - **"Correções"** = pedidos de correção de cadastro vindos do app. **"Cópias"** = pedidos de cópia do
     prontuário. → "Pedidos de correção", "Cópias do prontuário".
   - **"Hoje"** aparece duas vezes no menu (Clínica e Hotel), ao lado de "Início", que também é um "hoje".
   - Aba com o nome do destino: **Agenda > Agenda**, **Pacientes > Pacientes** (em 768 px a palavra
     "Agenda" aparece três vezes nos primeiros 180 px, `53-agenda-tablet-em-pe-768.jpg`). → "Grade",
     "Lista".
7. **P2 — Agrupamento das abas não segue o papel.** Em **Pacientes** moram Correções, Atendimentos
   (prontuários), **Bulário** (consulta de medicamentos) e Cópias: três de cinco abas não são da
   recepção e uma não é sobre pacientes. Em **Pendências**, seis abas (Atividades, Faltas, Retornos,
   Vacinas, Tratamentos em casa, Estoque de vacinas) misturam fila da recepção, clínica e compras.
   **Proposta:** Pendências com duas visões ("Recepção": pedidos, faltas, retornos, correções, cópias;
   "Clínica": prontuários, vacinas, tratamentos, estoque), a primeira escolhida pelo papel; Bulário sai
   de Pacientes (vai para a área clínica ou para a busca).
8. **P2 — Três níveis de navegação empilhados**: destino na barra → abas na faixa → segundo seletor no
   corpo (Esperando resposta/Aceitos/Recusados/Encerrados; Reincidentes/A justificar/Todas; Todos/Vencidos;
   Na fila/Não responderam; Abertos/Resolvidos; Ativos/Inativos; Dia/Semana). E o segundo seletor muda de
   lugar: à esquerda fora da caixa (Pedidos, Fila, Faltas, Retornos), à direita dentro da caixa
   (Correções, Pacientes). **Proposta:** um padrão único de barra de filtro (busca à esquerda, recorte à
   direita), sempre fora da caixa.
9. **P2 — Fileira de abas rola de lado sem controle.** Em 1024 a aba "Estoque de vacinas" fica
   inteira fora (`nav` com 854 px em 680, `52-pendencias-retornos-1024.jpg`); com a gaveta aberta em
   1440 some "Tratamentos em casa" (`43-faltas-gaveta-historico.jpg`). Há só o esmaecido; sem setas, e a
   barra de rolagem é escondida (`UiAbas.vue`). **Proposta:** menos abas (item 7) e menu "Mais" para o
   que não couber.
10. **P2 — Gaveta lateral e Avisos empurram a tela em 1440** (o conteúdo reflui): os botões da faixa
    quebram de linha, a faixa cresce de 174 para 234 px e a grade desce 114 px no instante do clique
    (`07-agenda-dia-0911-1440.jpg` → `08-agenda-gaveta-agendado.jpg`). Em 1024 a mesma gaveta **cobre**
    72% do conteúdo (`19-agenda-gaveta-1024.jpg`). Dois comportamentos para o mesmo gesto.
    **Proposta:** em telas ≥1280, gaveta por cima sem refluir o cabeçalho (ou coluna fixa reservada na
    Agenda); nunca mexer na posição do que a pessoa acabou de clicar.
11. **P2 — Avisos sem nome e sem destino.** "Novo pedido de horário — Um responsável pediu um horário…
    Veja os pedidos na agenda." não diz quem nem quando, e não é link (só os avisos de vínculo e de módulo
    têm rota em `ShellAvisos.vue`). 29 não lidos, vários repetidos ("Cópia de prontuário perto do
    prazo" x4) (`03-casca-avisos.jpg`). **Proposta:** todo aviso com pet/responsável e link para a tela
    que resolve; agrupar repetidos; avisos já resolvidos saem do contador.
12. **P3 —** alvos de toque abaixo de 44 px no tablet: abas 38 px, botões de linha 34 px, lápis/lixeira
    ~34 px, cartão curto da grade ~22 px. "Choose Month"/"Choose Year" em inglês nos calendários.

**O que funciona:** o destino aceso na barra bate com o título na maioria das telas; URLs por aba e por
filtro (dá para favoritar `?data=`, `?aba=`, `?recorte=`); botão principal branco no canto da faixa é
sempre fácil de achar.

**Nota: 2/5.**

---

## 1. Hoje — `/clinica/meu-dia`

**Fontes:** `src/features/clinico/components/meu-dia/MeuDiaFoco.vue`,
`src/components/meu-dia/useMeuDiaDaClinica.ts`.

**O que responde:** "quem está comigo agora e o que me espera" — é a tela do **veterinário**.

**Anatomia (1440x900, vazio):** faixa verde de 278 px com dois cartões brancos: à esquerda "Ninguém na
sala nem na recepção, e nada mais marcado para hoje."; à direita "1 assunto esperando você", a data,
o seletor "Minha agenda | Clínica" e três números (Na recepção 0, Em consulta 0, Internados 0).
Embaixo, "Quem vem depois" ("Nada mais marcado para hoje.") e "O que pede ação (1)": "2 prontuários em
rascunho · Mel, Nino · Atividades". Com o dia cheio (código): o cartão da esquerda vira o paciente da
vez com "Chamar"/"Continuar" e "Ver resumo"; a lista mostra até 7 (recepção primeiro, com "Esperando há
X min" e botão "Chamar"), depois os horários.

### Problemas

1. **P1 — A tela é do veterinário, e é a única "Hoje".** Não tem nenhuma ação da recepção: sem "Marcar
   horário", sem "Cadastrar paciente", sem busca, sem "Marcar chegada" (o botão da linha é "Chamar", que
   leva à Agenda com a gaveta aberta: `rotaDoProntuario` → `focoNaAgenda`). Para a recepção o destino
   "Hoje" é vitrine; o trabalho está na Agenda. **Proposta:** Hoje por papel. Recepção: três colunas
   "A chegar" (com "Marcar chegada" na linha), "Na recepção" (há quanto tempo), "Em atendimento", mais
   atalhos Marcar horário / Cadastrar / Buscar. Veterinário: o desenho atual.
2. **P1 — Entra em "Minha agenda" e não lembra a escolha.** A conta com ficha de profissional abre em
   `PROFISSIONAL`; troquei para "Clínica", saí e voltei: "Minha agenda" de novo (`escolhido` é um `ref`
   local). Quem é gerente/recepção e tem ficha vê a clínica "vazia" todo dia. **Proposta:** lembrar por
   pessoa; para quem não atende, abrir em Clínica.
3. **P1 — "O que pede ação" não é a mesma lista do Início nem dos selos.** Aqui: 1 linha, tom "Normal",
   "2 prontuários em rascunho" → `/clinica/atividades`. No Início: "2 pendências", tom **Urgente** →
   `/clinica/atendimentos?status=RASCUNHO`, mais "3 pedidos de cópia". Pedidos de horário, correções e
   cópias não entram na pauta do Hoje (`linhasDaPauta` só lê internados, faltas, retornos, pré-consultas
   e rascunhos). **Proposta:** ver transversal T2.
4. **P2 — Os três números levam ao mesmo lugar genérico.** "Na recepção" e "Em consulta" abrem
   `/clinica/agenda` sem filtro. **Proposta:** abrir a lista filtrada (ou rolar até o primeiro).
5. **P2 — Vazio sem próxima ação e faixa alta.** Duas frases quase iguais ("…nada mais marcado para
   hoje." / "Nada mais marcado para hoje.") e 278 px de verde (359 px em 1024, 47% da tela,
   `38-hoje-1024.jpg`) para dizer "nada". **Proposta:** vazio com "Marcar horário" e "Ver a semana";
   faixa encolhe quando não há paciente da vez.
6. **P2 — Em 1024 a ordem inverte:** "O que pede ação" sobe para antes de "Quem vem depois".
7. **P3 —** "1 assunto esperando você" conta linhas, não itens (a linha diz "2 prontuários").

**O que funciona:** frase-resumo no topo; lista com alerta em selo curto ("Alergia") e tempo de espera;
relê sozinha a cada 30 s.

**Nota: 3/5** (para o veterinário); **2/5** para a recepção.

---

## 2. Agenda — `/clinica/agenda`

**Fontes:** `src/components/agendamentos/AgendaDaClinica.vue`, `GradeDoDia.vue`, `SemanaDaAgenda.vue`,
`AgendamentoGaveta.vue`, `MarcarGaveta.vue`, `DesfazerNaAgenda.vue`, `src/components/faltas/FaltaDoHorario.vue`.

**O que responde:** "quem vem, com quem, a que horas" e é onde a recepção marca, recebe e remarca.

**Anatomia (1440x900):** faixa com "Agenda", "4 horários marcados", "Fechar o turno (2)", "Marcar
horário" e as abas Agenda | Pedidos | Fila de espera. Barra: ‹ data › "Hoje" à esquerda; "Dia | Semana"
e "Exibição" à direita. Grade por profissional, 96 px por hora, das 07:00 às 22:00 (1.440 px de altura);
na dobra cabem 07:00 a ~12:50. Cartão: hora, nome do pet, ícone de situação; tipo na segunda linha só
se durar 25 min ou mais.

### Problemas

1. **P1 — A grade não vai até "agora".** Abre sempre no topo (07:00); não há `scrollIntoView` em
   `AgendaDaClinica.vue` nem em `GradeDoDia.vue`. Às 15h a recepção rola a cada visita; em 1024 cabem só
   4 horas (`18-agenda-dia-1024.jpg`). **Proposta:** ao abrir "hoje", rolar até 1 h antes da linha do
   agora; cabeçalho das colunas preso; opção de densidade (60 px/h) e de esconder horas sem expediente.
2. **P1 — Não dá para achar uma consulta pelo nome.** Não há busca nem filtro por paciente/profissional
   na Agenda ("Exibição" só troca colunas e esconde cancelados, `16-agenda-exibicao.jpg`). A visão
   Semana lista nomes em corpo pequeno, 6 por dia + "e mais 2", e o nome não é clicável: o cartão inteiro
   só abre o dia (`17-agenda-semana-1440.jpg`). A ficha não mostra o próximo horário. Quando o
   responsável liga para remarcar e não lembra o dia, a recepção caça semana a semana. **Proposta:**
   campo "Buscar paciente ou responsável" na barra da agenda, com os próximos horários daquele pet; na
   Semana, cada nome abre a gaveta; "Próximos horários" na ficha.
3. **P1 — Cliente novo não cabe no "Marcar horário".** Digitei "Thor" em Paciente: "Nenhum resultado" e
   mais nada (`14-agenda-marcar-paciente-nao-encontrado.jpg`). É preciso cancelar, ir a Pacientes,
   cadastrar (27 campos), cair na ficha (que não tem "Marcar horário") e voltar. **Proposta:** na lista
   vazia, "Cadastrar 'Thor' agora" abrindo um cadastro curto na própria gaveta (nome do pet, espécie,
   responsável, telefone) e voltando ao horário já com o paciente escolhido.
4. **P1 — A gaveta do horário não tem telefone.** "Responsável: Marina Souza" e um link "Abrir a ficha"
   (`08-agenda-gaveta-agendado.jpg`). Para confirmar presença ou avisar atraso é preciso sair da agenda.
   Também faltam espécie/raça e alertas do pet. **Proposta:** cabeçalho da gaveta com pet (espécie,
   alerta), responsável, telefone preferido (copiar / abrir WhatsApp) e a ação seguinte.
5. **P1 — "Remarcar" está escondido e tem quatro nomes.** Fica em "Mais ações" > **"Mudar horário"**
   (`09-agenda-gaveta-mais-acoes.jpg`); na falta chama **"Reagendar"**; em Retornos, **"Outro horário"**;
   em Pedidos, selo **"Remarcação"**. E são três interfaces diferentes: "Mudar horário" (calendário + hora
   digitada, "Os avisos do horário novo aparecem depois de salvar", sem horários livres e sem dizer de
   quem é o horário, `10-agenda-gaveta-mudar-horario.jpg`), "Reagendar" da falta (lista de sugestões) e
   arrastar o cartão (só mouse). **Proposta:** um verbo ("Remarcar"), visível no pé da gaveta, com a
   mesma tela do "Marcar": simulação ao vivo, sugestões e o nome do pet + horário atual no topo.
6. **P1 — Ações que gravam na hora ao lado das que abrem formulário, sem distinção.** "Marcar chegada",
   "Confirmar presença" e "Iniciar atendimento" gravam no clique (`agir()`); "Editar", "Mudar horário",
   "Cancelar horário" e "Marcar falta" abrem um passo. O "Desfazer" dura 8 s. No balcão, com o telefone
   no ombro, "Iniciar atendimento" no menu é um clique errado caro (abre prontuário). **Proposta:**
   separar no menu "Passo do atendimento" de "Alterar o horário"; desfazer de chegada/confirmação sem
   prazo (voltar a situação pela própria gaveta).
7. **P2 — Cartão diz pouco e a situação é só um ícone.** Cartão de 15–20 min mostra "07:00 Nino" e um
   ícone sem dica (`aria-hidden`, sem `title`); falta e cancelado são riscados; não há legenda. Tipo,
   responsável, "encaixe" e alerta ficam de fora. **Proposta:** uma linha "07:00 · Nino (Rafael) ·
   Vacinação" com selo de situação em texto curto; legenda no "Exibição"; dica no hover.
8. **P2 — "Fechar o turno (2)"** é jargão para "marcar falta em quem não veio" e aparece como botão de
   mesmo peso que "Marcar horário" sempre que há horário passado sem chegada. **Proposta:** "Marcar 2
   faltas" como aviso discreto na grade ("2 não vieram: marcar falta"), fora da faixa.
9. **P2 — "Marcar horário" num dia passado nasce no dia passado.** Vendo 09/11, o formulário abriu com
   Dia = 9 e Hora = 09:00 (`13-agenda-marcar-horario-vazio.jpg`), sem aviso. E a grade ao lado não
   acompanha o dia escolhido no formulário (escolhi 17/11, a grade ficou em 09/11,
   `15-agenda-marcar-preenchido.jpg`). **Proposta:** data mínima = hoje com aviso; a grade segue o dia do
   formulário e mostra o "fantasma" do horário.
10. **P2 — "4 horários marcados" com 8 cartões na tela** (a frase exclui 2 faltas e 2 cancelados sem
    dizer). **Proposta:** "4 marcados · 2 faltas · 2 cancelados".
11. **P2 — Hora é campo de máscara e "Sugerir horários" fica abaixo da dobra da gaveta**, desligado até
    escolher paciente e atendimento. O melhor recurso do formulário é o menos visível. **Proposta:**
    depois de paciente + atendimento, mostrar direto os próximos horários livres como botões.
12. **P3 —** o painel do autocomplete cobre os rótulos "Atendimento"/"Profissional"; vocabulário varia
    entre formulários ("Atendimento" aqui, "Serviço" e "Com quem" na fila, "Tipo de atendimento" na
    configuração).

**O que funciona:** "Neste horário: Sem aviso neste horário." (simulação ao vivo) e as alternativas;
clicar num vazio da grade abre o formulário com hora e profissional; "Marcar chegada" é o botão
principal da gaveta; "Desfazer" depois de gravar; ao marcar em outro dia a agenda pula para ele.

**Nota: 2/5.**

---

## 3. Pedidos — `/clinica/pedidos`

**Fontes:** `src/components/pedidos/CaixaDePedidos.vue`, `RespostaDoPedidoGaveta.vue`,
`ConfiguracaoOnlineGaveta.vue`.

**O que responde:** "quem pediu horário pelo app/site e ainda espera resposta".

**Anatomia:** título "Pedidos de horário", "Nenhum pedido esperando resposta", botão branco "Como
recebemos pedidos"; abas; seletor Esperando resposta | Aceitos | Recusados | Encerrados; caixa com a
lista (dia e hora à esquerda, "Bidu · Vacinação", "Bruno Alves · Vacina · Pelo app", selo, "Ver"/
"Responder").

### Problemas

1. **P2 — O botão em destaque é configuração, não trabalho.** "Como recebemos pedidos" ocupa o lugar do
   botão principal e abre "Como a clínica recebe pedidos" (ligar/desligar pedido online, caminhos,
   serviços, aceite automático: `23-pedidos-como-recebemos.jpg`). Isso é configuração da agenda e não
   aparece em Configuração. **Proposta:** mover para Configuração > "Agendamento online" e deixar aqui um
   link discreto.
2. **P2 — A mesma frase duas vezes** ("Nenhum pedido esperando resposta" na faixa e na caixa,
   `20-pedidos-1440.jpg`) e a faixa muda de altura ao trocar de recorte (174 → 162 px, a lista pula).
3. **P2 — Gaveta do pedido respondido não leva a lugar nenhum.** "Resposta: Marcado" sem "Ver na
   agenda" nem "Abrir a ficha" (`22-pedidos-gaveta-ver.jpg`). **Proposta:** dois links no pé.
4. **P2 — Pedido novo não chega por onde a recepção olha.** O aviso "Novo pedido de horário" não é link
   e a pauta do Hoje não lista pedidos; só o selo na barra e o número do Início avisam.
5. **P3 —** "Recusar" e "Aceitar" usam o mesmo botão cheio; "Aceitos" não segue ordem de data.

**O que funciona:** responder é curto (linha → "Responder" → horário pedido já escolhido → "Aceitar":
3–4 cliques); prazo em selo com tom; a gaveta mostra motivo, relato e contato de quem pede.

**Nota: 4/5.**

---

## 4. Fila de espera — `/clinica/fila`

**Fonte:** `src/components/fila/FilaDeEspera.vue`, `EntrarNaFilaGaveta.vue`, `VagasGaveta.vue`.

**O que responde:** "quem quer horário e não achou vaga" (lista de espera).

**Anatomia:** "Fila de espera", "Ninguém aguardando vaga", botões "Vagas para a fila" e "Adicionar à
fila"; seletor Na fila | Não responderam; vazio "Fila vazia — Quando faltar horário, adicione o paciente
aqui em vez de improvisar." com outro "Adicionar à fila".

### Problemas

1. **P1 — O nome engana quem está no balcão.** "Quem está esperando agora?" → a recepção clica em "Fila
   de espera" e cai na lista de vagas. Quem está na recepção aparece só no Hoje ("Na recepção") e como
   ícone de ampulheta na grade. **Proposta:** renomear para "Lista de espera"; e dar à Agenda um painel
   "Na recepção agora".
2. **P2 — "Vagas para a fila"** não se explica (vagas que abriram? reservar vaga?). **Proposta:** "Vagas
   abertas" com contagem, ou só mostrar quando houver.
3. **P3 —** três "Adicionar à fila" na mesma tela com a gaveta aberta (`25-fila-adicionar.jpg`).

**O que funciona:** formulário curto e em ordem (paciente, serviço, prioridade, disponibilidade); vazio
que ensina.

**Nota: 3/5.**

---

## 5. Pacientes — `/clinica/pacientes`

**Fonte:** `src/components/cadastro/PacientesLista.vue`.

**O que responde:** "achar um pet ou um responsável e o contato dele".

**Anatomia:** faixa "Pacientes", "6 pacientes ativos", "Importar planilha" e "Cadastrar paciente";
abas Pacientes | Correções | Atendimentos (2) | Bulário | Cópias (3); caixa com busca ("Nome do pet, do
responsável, telefone ou CPF"), "Todas as espécies", Ativos | Inativos; linhas com avatar, nome,
espécie · raça, responsável + telefone, selo de alerta e seta.

### Problemas

1. **P2 — A busca se perde.** O termo e os filtros não vão para a URL nem para o cadastro: voltar da
   ficha zera a lista, e "Cadastrar paciente" depois de buscar "bento" abre o formulário em branco
   (`router.push('/clinica/paciente/novo')`). **Proposta:** `?q=` na URL; levar o termo como nome.
2. **P2 — A linha não diz o que a recepção quer saber nem age.** Sem próximo horário, sem última visita,
   sem atalho "Marcar horário". **Proposta:** coluna "Próximo horário" e botão "Marcar" na linha.
3. **P2 — Colunas desalinhadas.** Sem selo de alerta, o bloco do responsável desloca ~90 px (linha
   "Pipoca", `26-pacientes-1440.jpg`). **Proposta:** grade com colunas fixas.
4. **P2 — Texto do vazio da busca fala de base vazia:** "Nenhum paciente com essa busca — Cadastre o
   primeiro no balcão, com o responsável junto." (`27-pacientes-busca-sem-resultado.jpg`).
5. **P3 —** selo "Alergia" em quase toda linha vira ruído; sem agrupar pets do mesmo responsável.

**O que funciona:** telefone já na linha (a tarefa "achar o telefone" acaba aqui); busca por pet,
responsável, telefone ou CPF; a linha inteira é link.

**Nota: 4/5.**

---

## 6. Cadastro novo — `/clinica/paciente/novo`

**Fontes:** `src/components/cadastro/PacienteNovo.vue`, `PacienteCampos.vue`, `ClienteCampos.vue`, `campos.ts`.

**O que responde:** "pôr um pet e o responsável dele na base".

**Anatomia:** faixa "Cadastrar paciente" com "← Pacientes"; folha única com duas seções, título à
esquerda e campos à direita: **O pet** (nome, espécie, raça, sexo, castrado, nascimento em calendário
aberto, porte, peso, microchip, pelagem) e **Quem responde por ele** (Cliente da casa | Cliente novo).
No pé, "Cancelar" e "Cadastrar paciente". Com "Cliente novo": 27 campos, 2.425 px (2,7 telas).

### Problemas

1. **P1 — Clicar em "Cadastrar paciente" com erro não mostra nada.** Os erros ("Informe o nome do
   pet.", "Escolha a espécie.", "Informe o nome do responsável.") ficam 1.100–1.250 px acima do botão;
   a tela não rola, não há resumo nem aviso (`30-paciente-novo-apos-enviar-vazio.jpg`; `cadastrar()`
   retorna em silêncio). Para quem usa, "o botão não funciona". **Proposta:** rolar e focar o primeiro
   erro e repetir "Faltam 3 campos" ao lado do botão.
2. **P1 — Ordem invertida para o balcão e tudo aberto.** A conversa começa por "seu nome e telefone";
   a tela começa pelo pet e só mostra o responsável depois de uma tela de rolagem; "Cliente novo" abre
   18 campos de uma vez (endereço completo, contato de emergência). **Proposta:** passo 1 "Responsável"
   (buscar por telefone/nome ou criar com nome + telefone), passo 2 "Pet" (nome, espécie, raça, sexo,
   idade); o resto recolhido em "Completar depois".
3. **P1 — Depois de salvar, a ficha não oferece o passo seguinte.** O código leva à ficha ("de onde
   sai o que se faz com ele em seguida"), mas a ficha não tem "Marcar horário". **Proposta:** ao salvar,
   "Marcar horário para {pet}" como ação principal (a Agenda já aceita abrir a marcação com paciente
   pela URL: `?retorno=<paciente>&nome=`).
4. **P2 — Nascimento num calendário mensal aberto** (Novembro de 2026): para um cão de 2019 são dezenas
   de cliques, e o calendário ocupa 330 px. "Data estimada pela idade" fica desligado até escolher um
   dia. **Proposta:** campo digitado dd/mm/aaaa **ou** "idade aproximada" (anos/meses).
5. **P2 — Telefone do cliente novo não é obrigatório nem marcado como opcional** (`validarCliente` só
   exige o nome). Os campos de endereço também não têm "(opcional)", os outros têm. **Proposta:**
   telefone obrigatório (ou confirmação explícita "sem telefone"); marcação coerente.
6. **P2 — Sair perde tudo sem aviso** (não há guarda de rota; "← Pacientes", "Cancelar" e o menu
   descartam 27 campos). **Proposta:** confirmar descarte quando houver algo digitado.
7. **P3 —** "← Pacientes" fica embaixo do título aqui e em cima do título em Importar.

**O que funciona:** "Nome e espécie são obrigatórios. O resto pode ser completado depois."; busca de
cliente da casa mostra os pets dele; CPF repetido oferece "usar este cliente".

**Nota: 2/5.**

---

## 7. Importar — `/clinica/paciente/importar`

**Fonte:** `src/components/importacao/ImportacaoDaBase.vue`.

**O que responde:** "trazer a base de outro sistema".

**Anatomia:** "← Pacientes", "Trazer pacientes de outro sistema", passos 1 Arquivo · 2 Dúvidas · 3
Importar, selo "Nada é gravado até você confirmar, no último passo.", área de arrastar com "Escolher
arquivo" (`31-importar-1440.jpg`).

### Problemas

1. **P3 —** o botão que leva aqui chama "Importar planilha" e a tela, "Trazer pacientes de outro
   sistema"; o passo "Dúvidas" não diz de quem é a dúvida ("Conferir" seria mais claro).
2. **P3 —** "Planilhas de exemplo" (só em dev) ocupa a dobra com botões "Usar este" que gravam na
   clínica de verdade.

**O que funciona:** passo a passo com a promessa de que nada grava antes do fim; diz os formatos e os
sistemas reconhecidos.

**Nota: 4/5.**

---

## 8. Ficha do paciente (lado do cadastro) — `/clinica/ficha/:id`

**Fontes:** `src/components/cadastro/FichaDoPaciente.vue`, `VinculoCartao.vue`, `ResumoDoApp.vue`,
`ClienteGaveta.vue`, `PacienteGaveta.vue`, `AlertaGaveta.vue`, `AutorizadoGaveta.vue`.

**O que responde:** deveria responder "quem é este pet, de quem é, como falo com a pessoa e o que faço
agora". Hoje responde "tudo o que existe sobre o pet".

**Anatomia (1440x900, Fubá):** faixa "Fubá — Cachorro · SRD · Macho", "Editar" e "Mais" (Pôr foto,
Registrar óbito, Inativar, Juntar com outro cadastro). Duas colunas. Esquerda: Dados do paciente,
Alertas, Vacinas, Histórico clínico, Tratamentos em casa, Documentos. Direita: responsável (Bruna
Castro, telefone, e-mail, endereço), "Este pet em 30 segundos" (656 px), "No app do responsável", "Quem
pode buscar". 10 seções, ~30 botões, 2.396 px (2,7 telas).

### Problemas

1. **P1 — No tablet o telefone vai para o fim.** Abaixo de 960 px de conteúdo a ficha vira uma coluna
   na ordem do código (`fp__colunas`): o cartão do responsável começa em **2.247 px** e "Quem pode
   buscar" em 3.534 px, numa página de 3.782 px (4,9 telas de 768) (`36-ficha-fuba-1024.jpg`).
   **Proposta:** cabeçalho fixo da ficha com responsável, telefone preferido e ações; em uma coluna, a
   ordem é contato → alertas → resto.
2. **P1 — Da ficha não se marca horário nem se vê o próximo.** Não há "Marcar horário", "Pôr na lista
   de espera" nem "Próximos horários" (o Histórico clínico só olha para trás). É a tela onde a recepção
   cai depois de buscar e depois de cadastrar. **Proposta:** ações principais na faixa: "Marcar horário",
   "Remarcar" (se houver horário futuro) e o próximo horário em destaque.
3. **P1 — Não tem volta.** A faixa da ficha não usa o slot `voltar`: sem "← Pacientes" e sem trilha.
   Voltar pelo menu perde a busca. **Proposta:** "← Pacientes" (ou "← Agenda", de onde veio) no alto.
4. **P1 — A ficha é uma só para todos os papéis.** A recepção atravessa Vacinas ("Aplicar"), Histórico
   clínico (6 sub-abas), Tratamentos em casa e Documentos para chegar a "Quem pode buscar".
   **Proposta:** abas da ficha "Cadastro" (pet, responsável, autorizados, app, alertas) e "Clínico"
   (vacinas, histórico, tratamentos, documentos), abrindo pela aba do papel.
5. **P2 — Dois lugares falam de alergia e se contradizem à primeira vista.** À esquerda "Alertas:
   Alergia · Risco · Dipirona: inchaço no focinho"; à direita, em "Este pet em 30 segundos", "Alergias:
   Nenhuma registrada" (é o que o app do responsável diz) (`34-ficha-fuba-rolada-1.jpg`). **Proposta:**
   rotular a origem ("No app: nenhuma") e nunca escrever "nenhuma" ao lado de um alerta de risco.
6. **P2 — "Este pet em 30 segundos" tem 656 px e sete blocos**; não é resumo. **Proposta:** três linhas
   no topo (alerta, último atendimento, o que está em aberto) e o resto recolhido.
7. **P2 — Estado do app confuso (Bidu):** "Este paciente ainda não está ligado ao app…" com "Ligar ao
   app" e, logo abaixo, "PROPOSTAS: Aceita · código · respondida em 9 de novembro" — o vínculo foi
   encerrado pelo responsável (há aviso disso), mas o cartão não diz (`54-ficha-bidu-1440.jpg`).
   **Proposta:** uma frase de estado: "Vínculo encerrado pelo responsável em 09/11. Propor de novo".
8. **P2 — Identidade repetida e sem os outros pets.** Nome na faixa, avatar grande e "Dados do paciente"
   de novo no primeiro cartão; e o cartão do responsável não lista os outros pets da pessoa (Marina
   Souza tem Mel e Pipoca). **Proposta:** "Outros pets de {responsável}" com link.
9. **P3 —** "Encerrar" (alerta) grava no clique; "Encerrar vínculo" tem o mesmo peso dos botões neutros.

**O que funciona:** em 1440 o telefone preferido está na primeira dobra, com "preferido" e "Prefere
WhatsApp"; "O que a recepção confere no balcão." explica o cartão; remover autorizado pede confirmação
na própria linha.

**Nota: 2/5** (1440: 3; 1024: 1).

---

## 9. Correções — `/clinica/correcoes`

**Fonte:** `src/components/cadastro/CorrecoesLista.vue`.

**O que responde:** "o que os responsáveis pediram, pelo app, para corrigir no cadastro".

**Anatomia:** título "Pacientes", "Nenhum pedido aberto"; caixa com a frase explicativa à esquerda e
Abertos | Resolvidos à direita; vazio "Nenhum pedido aberto" (`39-correcoes-1440.jpg`).

### Problemas

1. **P2 —** nome e título não se explicam: aba "Correções" sob o título "Pacientes"; o sentido só
   aparece na frase dentro da caixa. **Proposta:** "Pedidos de correção" e frase de estado completa.
2. **P2 —** a linha (pelo código) mostra o nome do cliente e a mensagem, com "Abrir cadastro" e
   "Resolver": resolver grava no clique e não mostra o que mudou. **Proposta:** abrir a gaveta do
   cadastro já no campo pedido, com "Marcar como resolvido" ao salvar.
3. **P3 —** sem selo na aba mesmo quando houver pedidos (o selo de Pacientes soma outras coisas).

**O que funciona:** vazio limpo; separa abertos de resolvidos.

**Nota: 3/5.**

---

## 10. Pendências — Atividades, Faltas, Retornos

**Fontes:** `src/components/atividades/AtividadesDaClinica.vue`, `src/components/faltas/FaltasDaClinica.vue`,
`HistoricoDeFaltasGaveta.vue`, `FaltaDoHorario.vue`, `JustificativaCampos.vue`,
`src/components/atendimento/RetornosPendentes.vue`.

**O que responde:** "o que ficou para trás e alguém precisa resolver".

**Anatomia:** faixa "Pendências" + seis abas. **Atividades** (`/clinica/atividades`): um cartão por
pilha com título, porquê, total e linhas ("Prontuários em rascunho — 2", "Resumos que não chegaram ao
app — 1", cada linha com "Ver o paciente"). **Faltas** (`/clinica/faltas`): Reincidentes | A justificar |
Todas; lista por paciente ("Fubá — Bruna Castro · última em 09/11/2026 — 1 falta · 30 min").
**Retornos** (`/clinica/retornos-pendentes`): Todos | Vencidos; linhas "Mel [Vence em 7 dias] — Retorno ·
Portal Demo · consulta de 8 de nov." com "Outro horário" e "Marcar".

### Problemas

1. **P1 — A porta de entrada de Pendências é a aba menos clara e o destino não tem selo.** "Atividades"
   é o painel geral, mas o nome não diz isso, e hoje abre em "Prontuários em rascunho" (trabalho do
   veterinário). As outras abas não mostram contagem. **Proposta:** primeira aba "Visão geral" com um
   cartão por assunto e o número; selo em cada aba e no destino.
2. **P1 — Faltas abre em "Reincidentes" vazio e diz que não há faltas.** "Nenhum reincidente — As
   faltas marcadas na agenda aparecem aqui." com três faltas em "Todas" (`41-…reincidentes.jpg`,
   `42-…todas.jpg`). Quem procura "quem faltou esta semana" conclui que não houve falta. Não há filtro
   de período (só "últimos 12 meses"), a lista é agregada por paciente e "30 min" não tem rótulo.
   **Proposta:** abrir em "A justificar" quando houver, senão em "Todas"; lista por falta, com data, e
   recorte Hoje | Semana | Mês; "Reincidentes" como filtro secundário.
3. **P1 — "Marcar" em Retornos grava um horário que a pessoa ainda não viu.** `marcar(item)` marca no
   clique, sem dizer dia nem hora no botão (o horário aparece depois, com desfazer). A recepção está ao
   telefone e precisa dizer o horário **antes**. E a linha não tem responsável nem telefone, embora a
   tarefa seja ligar. **Proposta:** botão com o horário ("Marcar ter 17/11 10:00") ou sempre abrir a
   escolha; responsável + telefone na linha.
4. **P2 — Justificar tem três níveis dentro da gaveta e outro verbo.** Linha → gaveta "Faltas de Bruno
   Alves" (a lista é por pet, a gaveta é por responsável) → falta → "Registrar contato" → formulário.
   O filtro diz "A justificar", o botão diz "Registrar contato", a agenda diz "Já falei com o
   responsável", o selo diz "Justificada" e o registro diz "É o que vale". **Proposta:** ação "Justificar"
   direto na linha da falta; um vocabulário só.
5. **P2 — "Ver o paciente" não resolve a pendência.** Em Atividades as linhas de rascunho e de resumo
   levam à ficha (`ficha(item)`), onde ainda é preciso achar o atendimento; os ícones do botão mudam
   (lápis, avião) e o rótulo é o mesmo. **Proposta:** "Abrir o prontuário" / "Reenviar resumo".
6. **P2 — Título muda entre abas irmãs** (Pendências / Faltas / Pendências) e Retornos não tem avatar
   nem ícone como as outras listas.

**O que funciona:** cada pilha diz por que importa ("Enquanto não fecha, o resumo não vai ao
responsável."); selo de prazo ("Aberto há 7 dias", "Vence em 7 dias"); recorte na URL.

**Nota: 2,5/5** (Atividades 3, Faltas 2, Retornos 3).

---

## 11. Configuração — `/clinica/configuracao`

**Fontes:** `src/components/agenda/ConfiguracaoDaAgenda.vue`, `SalasAba.vue`, `TiposAba.vue`,
`BloqueiosAba.vue`, `BloqueioGaveta.vue`, `PoliticaAba.vue`.

**O que responde:** "como a agenda da clínica funciona".

**Anatomia:** "Configuração da clínica", frase, abas Salas | Leitos | Tipos de atendimento | Bloqueios |
Política | Catálogo da clínica; uma caixa por aba com título, frase, botão "Novo …" e linhas com subir,
descer, editar e "Desativar" (`45-configuracao-salas.jpg`).

### Problemas

1. **P1 — A configuração da agenda está em três lugares.** Salas, tipos, bloqueios e política aqui;
   **horário da semana e feriados** em Portal > Estabelecimento > Horários (a aba Bloqueios avisa em
   texto, sem link: "O horário da semana e os feriados ficam em Estabelecimento.",
   `47-configuracao-bloqueios.jpg`, `50-estabelecimento-horarios-feriados.jpg`); **agendamento online** em
   Agenda > Pedidos > "Como recebemos pedidos". Para o feriado, a gerente vai a Bloqueios, lê o aviso,
   rola o menu até o Portal. **Proposta:** uma aba "Horários e feriados" aqui (mesmo que edite o dado do
   Estabelecimento) e uma "Agendamento online"; no mínimo, transformar o aviso em link.
2. **P2 — "Novo bloqueio" não tem "dia inteiro".** Para fechar um dia é preciso digitar início e fim
   (`48-configuracao-novo-bloqueio.jpg`), e há dois jeitos de fechar a clínica (bloqueio "Clínica toda"
   e feriado). **Proposta:** chave "Dia inteiro" e uma frase dizendo quando usar cada um.
3. **P2 — "A ordem é a da legenda da agenda."** (Tipos de atendimento): a Agenda não tem legenda.
   "Aparece no pedido online" no tipo e "Serviços que podem ser pedidos" na gaveta dos pedidos parecem
   a mesma chave em dois lugares.
4. **P3 —** "Desativar"/"Reativar" gravam no clique; subir/descer/editar são só ícones de 34 px.

**O que funciona:** cada aba diz para que serve numa frase; Política é o modelo de formulário (assunto à
esquerda, campo e limite à direita, "Vale para o que for marcado depois."); mudar a duração de um tipo
são 4 cliques.

**Nota: 3/5.**

---

## Percursos de tarefa

| # | Tarefa | Caminho feito | Cliques | Onde travou ou hesitou |
|---|---|---|---|---|
| 1 | Cliente novo com cachorro: cadastrar e marcar consulta amanhã 10h | Agenda → Marcar horário → digita o nome → "Nenhum resultado" → Cancelar → Pacientes → Cadastrar paciente → nome, espécie → rola → Cliente novo → nome, telefone → Cadastrar paciente → cai na ficha → Agenda → Marcar horário → digita o nome de novo → Atendimento → Profissional → dia → hora → Marcar | ~18 cliques + 5 campos; 3 telas; nome do pet digitado 3 vezes | Beco sem saída no "Nenhum resultado"; responsável escondido abaixo da dobra; ficha sem "Marcar horário"; se faltar um obrigatório, o botão "não faz nada" |
| 2 | Remarcar a consulta do Fubá | Sabendo o dia: Agenda → data → dia → achar o cartão (rolar se for à tarde) → cartão → Mais ações → Mudar horário | 6 até o formulário | Sem busca por nome; se não souber o dia, varre a Semana (nomes não clicáveis) ou não acha; "Mudar horário" escondido e com outro nome; formulário sem horários livres e sem dizer de quem é |
| 3 | Paciente chegou: marcar chegada e ver quem espera | Agenda → cartão → Marcar chegada (parei antes). Quem espera: Hoje → "Na recepção" + topo de "Quem vem depois" | 2–3 | "Fila de espera" parece ser a resposta e não é; na Agenda quem espera é só um ícone; o número "Na recepção" leva à agenda sem filtro; Hoje abre em "Minha agenda" |
| 4 | Responder um pedido do app/site | Agenda → aba Pedidos → Responder → (horário pedido já marcado) → Aceitar | 4 | O aviso "Novo pedido de horário" não é link; botão em destaque da tela é configuração. O resto é direto |
| 5 | Telefone do responsável pelo Fubá, de qualquer tela | Pacientes → digitar "fub" → telefone na linha | 1 + digitação | Sem busca global; pela gaveta da agenda são +1 clique (Abrir a ficha) e, em 1024, três telas de rolagem |
| 6 | Quem faltou esta semana e justificar | Pendências → Faltas → (abre em Reincidentes, vazio) → Todas → linha → gaveta → falta → Registrar contato → preencher → Registrar | 7 | Tela diz "Nenhum reincidente… aparecem aqui" com faltas existindo; sem filtro de semana; lista por paciente em 12 meses; "justificar" não é o nome do botão |
| 7 | Mudar a duração de um tipo e bloquear um feriado | Duração: Configuração → Tipos de atendimento → lápis → duração → Salvar. Feriado: Configuração → Bloqueios → lê o aviso → rola o menu → Estabelecimento → Horários → Adicionar feriado | 4 e 5 (+ rolagem) | Feriado mora em outro espaço, sem link; "Novo bloqueio" parece servir e não tem "dia inteiro" |
| 8 | "O que está pendente para a recepção hoje?" | Início, Hoje, Pendências, Avisos, selos | — | Cinco respostas diferentes (abaixo) |

**Percurso 8 em números (mesma conta, mesma hora):**

| Lugar | O que diz | Leva a |
|---|---|---|
| Início, faixa | "2 assuntos urgentes pedem sua atenção hoje" | — |
| Início, caixa Clínica | "Nada parado agora" (ao lado dos mesmos 4 números da faixa, repetidos) | — |
| Início, "O que pede ação (2)" | "2 pendências · **Urgente** · Atendimentos" e "3 pedidos de cópia do prontuário em aberto · **Urgente**" | `/clinica/atendimentos?status=RASCUNHO`, `/clinica/copias-do-prontuario` |
| Hoje | "1 assunto esperando você": "2 prontuários em rascunho · Mel, Nino · Atividades" (tom **Normal**) | `/clinica/atividades` |
| Menu | selo vermelho **5** em "Pacientes" (2 rascunhos + 3 cópias); **Pendências sem selo** | — |
| Pendências > Atividades | "2 prontuários em rascunho e 1 resumo que não chegou ao app." | ficha do paciente |
| Pendências > Retornos | 4 retornos a marcar (vencem em 7–8 dias); não contam em lugar nenhum | — |
| Avisos | 29 não lidos, incluindo pedidos de horário já respondidos e 4 avisos repetidos de cópia | a maioria não é link |

O mesmo item (2 rascunhos) tem três nomes ("2 pendências", "2 prontuários em rascunho", selo "2"), dois
tons (Urgente, Normal) e três destinos. E nenhuma dessas listas é "da recepção": rascunho de prontuário
é do veterinário; o que é da recepção (retornos a marcar, faltas a justificar, correções, cópias) está
espalhado ou sem contagem.

---

## Heurísticas de Nielsen (0 = falha grave, 4 = sem problema)

| # | Heurística | Nota | Achado-chave |
|---|---|---|---|
| 1 | Visibilidade do estado do sistema | 2 | Contagens de pendência divergem em 5 lugares; a agenda não mostra "agora"; o cadastro falha em silêncio. A favor: "Neste horário: Sem aviso", frase-resumo na faixa, Desfazer |
| 2 | Correspondência com o mundo real | 2 | "Fila de espera" (lista de vaga), "Atividades", "Fechar o turno", "É o que vale", "Mudar horário" em vez de remarcar |
| 3 | Controle e liberdade | 2 | Ficha sem volta; formulários sem aviso de descarte; "Marcar" (Retornos) grava às cegas; busca não sobrevive a ir e voltar. A favor: Desfazer de 8 s na agenda |
| 4 | Consistência e padrões | 1 | Título por aba sem regra; filtro em lugares diferentes; 4 nomes e 3 telas para remarcar; gaveta empurra em 1440 e cobre em 1024; "Atendimento/Serviço/Tipo" |
| 5 | Prevenção de erros | 2 | Marcar em dia passado sem aviso; hora digitada sem ver vagas no "Mudar horário"; ações de um clique misturadas com as de formulário; telefone não obrigatório |
| 6 | Reconhecer em vez de lembrar | 1 | Sem busca global; gaveta sem telefone; cartão sem tipo/responsável; situação só por ícone sem legenda; é preciso lembrar o dia para achar a consulta |
| 7 | Flexibilidade e eficiência | 1 | Sem atalhos nem "Criar" fora da demo; sem marcar a partir da ficha ou da lista; sem cadastro rápido dentro do marcar. A favor: clicar no vazio da grade |
| 8 | Estética e desenho minimalista | 2 | Faixa verde leva 19–47% da altura; ficha com 10 seções; cadastro com 27 campos abertos; os 4 números do Início repetidos |
| 9 | Reconhecer, diagnosticar e recuperar erros | 2 | Erros do cadastro fora da vista; "Nenhum resultado" sem saída. A favor: conflito de horário com "Marcar mesmo assim" e alternativas |
| 10 | Ajuda e documentação | 2 | Frases de seção ajudam ("O que a recepção confere no balcão."); vazios ensinam. Falta legenda na agenda e explicação dos rótulos de jargão |

**Total: 17/40.**

---

## Carga cognitiva

| Item | Situação | Onde |
|---|---|---|
| Foco único | **Falha** | Dois "inícios" (Início e Hoje) com números sobrepostos; ficha sem foco para a recepção |
| Blocos de até 4 | **Falha** | Menu com 22 linhas; ficha com 10 seções; cadastro com 27 campos; Pendências com 6 abas |
| Agrupamento | **Falha** | Bulário e Atendimentos em Pacientes; agendamento online em Pedidos; feriados no Portal |
| Hierarquia visual | Parcial | Botão principal branco na faixa é claro; mas em Pedidos ele é configuração e na Agenda divide peso com "Fechar o turno" |
| Uma coisa por vez | Parcial | Gavetas ajudam; cadastro novo e ficha jogam tudo de uma vez |
| Poucas escolhas | **Falha** | ~30 botões na ficha; 5 itens em "Mais ações" misturando gravar e abrir |
| Memória de trabalho | **Falha** | Lembrar o dia da consulta; redigitar o nome do pet 3 vezes; guardar o telefone de outra tela |
| Revelação progressiva | Parcial | "Mais ações", "Opcionais não iniciadas", "Histórico (1)" recolhem bem; "Cliente novo" abre 18 campos |

Falham 5 de 8; 3 parciais.

**Pontos de decisão com mais de 4 opções à vista:** menu lateral (22 destinos); abas de Pendências (6),
de Configuração (6) e de Pacientes (5); "Mais ações" do horário (5); ficha do paciente (~30 botões em 10
seções); cadastro novo (27 campos); "Marcar horário" (11 campos); Histórico clínico da ficha (6 filtros).

---

## Achados transversais

- **T1 — A recepção não tem um caminho contínuo.** Buscar, cadastrar, marcar e remarcar são quatro
  telas que não se passam o bastão: o "Marcar" não cadastra, o cadastro cai numa ficha que não marca, a
  ficha não mostra o próximo horário, a agenda não busca por nome. A busca global e o "Criar" que
  costurariam isso existem no código e estão desligados fora da demonstração.
- **T2 — "Pendente" não tem uma fonte só.** Início, Hoje, selos, Pendências e Avisos contam coisas
  diferentes com nomes, tons e destinos diferentes; o destino chamado Pendências não tem selo.
- **T3 — Navegação em três andares com regras variáveis.** Destino → aba → recorte → gaveta com modos.
  Título, lugar do filtro e comportamento da gaveta mudam de tela para tela.
- **T4 — Vocabulário instável.** Remarcar (Mudar horário / Reagendar / Outro horário / Remarcação);
  tipo (Atendimento / Serviço / Tipo de atendimento); justificar (A justificar / Registrar contato / Já
  falei com o responsável / É o que vale); "Fila de espera"; "Atividades"; nome do botão ≠ título da tela
  ("Importar planilha" → "Trazer pacientes de outro sistema"; "Como recebemos pedidos" → "Como a clínica
  recebe pedidos").
- **T5 — A casca gasta o espaço do trabalho.** 272 px de barra em qualquer largura ≥ 900, faixa de 174
  a 359 px, 96 px por hora na grade: em 1024x768 metade da tela passa antes da primeira linha útil.
- **T6 — Uma tela para todos os papéis.** Hoje, a ficha e Pendências servem veterinário, enfermagem e
  recepção ao mesmo tempo; a recepção atravessa o conteúdo clínico para chegar ao dela.
- **T7 — Um clique que grava x um clique que abre.** Chegada, confirmação, iniciar, "Marcar" (retorno),
  "Encerrar" (alerta), "Resolver" (correção), "Desativar" gravam direto, lado a lado com botões que só
  abrem formulário, sem diferença visual; o desfazer só existe na agenda e dura 8 s.
- **T8 — Tablet deitado é o pior caso.** Barra larga, abas cortadas, gaveta cobrindo a grade, ficha em
  uma coluna com o contato no fim, alvos de 34–38 px.
- **T9 — O contato do responsável não acompanha o pet.** Telefone aparece na lista de Pacientes e na
  ficha, e some na gaveta da agenda, em Retornos, em Faltas e nos Avisos, justamente onde se liga.

---

## As 5 prioridades da frente (em ordem)

1. **Costurar o fluxo do balcão:** busca global + "Criar" ligados à API; cadastro curto dentro do
   "Marcar horário" quando o paciente não existe; "Marcar horário"/"Remarcar" e "Próximo horário" na
   ficha e na linha da lista. (T1; Agenda 2–3, Cadastro 3, Ficha 2, Casca 1.)
2. **Fazer da Agenda a estação da recepção:** abrir no "agora", busca por paciente, gaveta com telefone
   e "Remarcar" à vista usando a mesma tela do "Marcar" (sugestões de horário), cartões com tipo e
   situação em texto, painel "Na recepção agora", faixa e barra compactas, gaveta sem refluir.
3. **Uma verdade só para pendências:** mesma contagem, mesmo nome, mesmo destino em Início, Hoje, selos
   e Pendências; "Atividades" vira "Visão geral" com selo por aba; Faltas abre no que há para fazer;
   Avisos com nome e link.
4. **Arrumar a casca:** menu que cabe (só o espaço em uso aberto, linha de 40 px, recolher sozinho
   abaixo de 1280), regra única de título e de filtro, renomear "Fila de espera", "Atividades",
   "Correções", "Cópias", "Fechar o turno"; abas por papel em Pacientes e Pendências.
5. **Ficha e cadastro pensados para o balcão e o tablet:** cabeçalho fixo com responsável, telefone e
   ações; abas "Cadastro" e "Clínico"; cadastro novo em dois passos começando pelo responsável, só com
   o obrigatório, erro visível, idade aproximada no lugar do calendário.

---

## Ordem de ataque das telas (da que mais dói para a que menos)

1. **Agenda** (grade + gavetas Marcar / Horário / Mudar horário) — nota 2
2. **Cadastro novo** (junto com o "paciente não encontrado" do Marcar) — nota 2
3. **Casca e navegação** (menu, faixa, abas, títulos, busca e Criar) — nota 2
4. **Ficha do paciente** (lado do cadastro; ordem no tablet, ações, volta) — nota 2
5. **Pendências** (Atividades como visão geral, Faltas, Retornos) + contagens do Início/Hoje — nota 2,5
6. **Hoje** (versão da recepção; lembrar o escopo) — nota 3 (2 para a recepção)
7. **Fila de espera** (nome e "Vagas para a fila") — nota 3
8. **Configuração** (juntar horários/feriados e agendamento online) — nota 3
9. **Correções** — nota 3
10. **Pacientes** (busca na URL, próximo horário, colunas) — nota 4
11. **Pedidos** (tirar a configuração do destaque, links na gaveta) — nota 4
12. **Importar** — nota 4

---

## Índice das capturas

`01` Hoje vazio 1440 · `02` menu rolado · `03` Avisos · `04` menu da conta · `05` Agenda de hoje vazia ·
`06` calendário · `07` Agenda dia 09/11 · `08` gaveta do horário · `09` Mais ações · `10` Mudar horário ·
`11` Marcar falta · `12` gaveta da falta (Fubá) · `13` Marcar horário vazio · `14` paciente não
encontrado · `15` Marcar preenchido · `16` Exibição · `17` Semana · `18` Agenda 1024 · `19` gaveta 1024 ·
`20` Pedidos · `21` Pedidos aceitos · `22` gaveta do pedido · `23` Como recebemos pedidos · `24` Fila ·
`25` Adicionar à fila · `26` Pacientes · `27` busca sem resultado · `28` Cadastro novo · `29` cadastro
rolado · `30` cadastro depois de enviar vazio · `31` Importar · `32` ficha Fubá · `33` menu Mais da ficha ·
`34`–`35` ficha rolada · `36` ficha 1024 · `37` Pacientes 1024 · `38` Hoje 1024 · `39` Correções ·
`40` Atividades · `41` Faltas reincidentes · `42` Faltas todas · `43` gaveta de faltas · `44` Retornos ·
`45` Configuração salas · `46` editar tipo · `47` Bloqueios · `48` Novo bloqueio · `49` Política ·
`50` Estabelecimento > Horários · `51` Início · `52` Retornos 1024 · `53` Agenda 768 em pé · `54` ficha Bidu
