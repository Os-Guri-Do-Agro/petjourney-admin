# Frente Clínica: validação de uso real (27/10/2026)

Persona e roteiro: fui a recepcionista e gerente da Aurora Clínica e Hotel Veterinário num dia
cheio. Abri o dia pelo Início, operei a Agenda (dia e semana, consulta, encaixe, remarcação,
cancelamento, bloqueio, chegada, falta), atendi o agendamento online pelo lado do tutor e pelo
lado da recepção, cuidei da fila de espera e das faltas, cadastrei e importei pacientes, recebi e
baixei vacinas no estoque e conferi Relatórios e Pendências. Forcei falha e lentidão pelo painel
de desenvolvimento, e repassei as telas em 1440, 1024x768 e 768x1024 com toque, no claro e no
escuro, e em `ar` (RTL).

Resumo: 33 achados (C-16 é registro de fluxo que funcionou). Bloqueia 3, Confunde 17, Incomoda 4,
Polimento 9. Corrigidos e conferidos na tela: 28. Abertos: C-11, C-14, C-21, C-33 e as notas do
C-34, com o motivo em cada um.

## Achados

### C-01 · Atendimento some da Agenda quando começa durante almoço ou reunião da clínica · Bloqueia
- Tela: `/veterinario/agenda` (Dia, formato Tabela)  ·  Largura/tema: todas, claro e escuro
- O que acontece: o bloqueio da clínica inteira vira uma faixa única ("Reunião · Reunião clínica
  semanal · até 18:00", "Almoço · até 13:00") e engole as meias horas que cobre. A Amora, **em
  atendimento** com o Tiago Sá às 17:30, e o Zeus, às 12:00 com a Helena, não apareciam em lugar
  nenhum da grade; o Início dizia "1 Em consulta: Amora" e a Agenda não mostrava a Amora.
- Por que pesa para quem usa: a recepção não vê quem está na sala nem quem está marcado; pode
  marcar outro paciente por cima ou dizer ao tutor que não há atendimento.
- Correção: a meia hora em que algum atendimento começa deixa de virar faixa e volta a ser linha
  comum; as células das outras colunas ficam hachuradas pelo bloqueio da clínica (sem "Marcar"),
  com o motivo escrito uma vez, na primeira coluna (`AgendaTabelaDia.vue`, `linhas`,
  `bloqueioDaColuna`, `mostraRotuloDoBloqueio`). Efeito colateral bom: meia hora parcialmente
  coberta por bloqueio da clínica também deixa de oferecer "Marcar".
- Conferido: 1440x900, claro: Amora 17:30 e Zeus 12:00 aparecem; faixa da reunião e do almoço
  seguem de ponta a ponta nas meias horas sem atendimento.

### C-02 · "até 17:00" do bloqueio cortado na coluna estreita · Polimento
- Tela: `/veterinario/agenda` (Tabela)  ·  1440, cinco profissionais
- O que acontece: a etiqueta "Bloqueio pessoal até 17:00" na coluna do Tiago aparecia como
  "Bloqueio pessoal até 17:(": cortava a hora, que é a parte que se procura.
- Por que pesa para quem usa: a recepção não sabe até quando o profissional está fora.
- Correção: quem cede largura é o motivo, com reticências; a hora não encolhe
  (`AgendaTabelaDia.vue`, `.tabela__etiqueta strong`, `.tabela__etiqueta-ate`).
- Conferido: 1440, claro: "Bloqueio pes… até 17:00".

### C-03 · Três números diferentes para "atendimentos de hoje" · Confunde
- Tela: `/veterinario/agenda` e Início  ·  todas as larguras
- O que acontece: no mesmo dia, a saudação da Agenda dizia "Terça-feira, 27 de outubro: 38
  atendimentos, 2 na recepção", a fita da semana logo abaixo mostrava "32" sob o dia 27 e o
  Início dizia "24 de 37 atendimentos feitos hoje". A saudação contava as 6 faltas; a fita não; o
  Início conta as faltas e junta a cirurgia com dois profissionais numa só.
- Por que pesa para quem usa: o gerente compara e não sabe qual número é o certo; desconfia da tela.
- Correção: a saudação da Agenda passa a usar a mesma conta da fita e da visão Semana
  (`ocupaHorario`: sem cancelado e sem falta) (`agenda.vue`, `fraseDoDia`). O número do Início
  ficou anotado em "Compartilhado".
- Conferido: 1440, claro: "32 atendimentos, 2 na recepção" com "32" na fita; na quarta, "18" e
  "18"; depois de criar uma consulta, "19" e "19".

### C-04 · Digitar no diálogo disparava os atalhos da Agenda · Bloqueia
- Tela: `/veterinario/agenda`, "Novo atendimento"  ·  todas
- O que acontece: abrir "Novo atendimento", clicar em Paciente e digitar "Rita" trocava a agenda
  para "por sala" (URL `?agrupar=sala`) e a busca ficava com "ita". O "R" caía no atalho porque o
  foco ainda estava no combobox, que não é campo de texto. Com qualquer modal aberto, "d", "s",
  "t" e as setas mexiam na agenda por trás.
- Por que pesa para quem usa: a recepção digita rápido com o tutor no telefone; perde a primeira
  letra, não acha o paciente e a agenda muda de visão sem ela saber por quê.
- Correção: tecla que nasce em diálogo, gaveta, combobox, lista ou popover (ou com modal aberto)
  não é da agenda; só o Esc atravessa (`useClinicShortcuts.ts`, `ehDeOutraCamada`).
- Conferido: 1440, claro: "N" abre o diálogo, clicar em Paciente e digitar "Rita" deixa
  "Rita" na busca, lista Tofu e Zeus, e a URL não muda.

### C-05 · "Registrar chegada" oferecido em consulta de outro dia · Confunde
- Tela: `/veterinario/agenda`, gaveta do atendimento  ·  todas
- O que acontece: abrindo a Frida de amanhã (28/10, 14:00, Confirmado), o botão principal da
  gaveta era "Registrar chegada". Um clique punha na recepção quem nem saiu de casa.
- Por que pesa para quem usa: é o botão mais chamativo da gaveta; erro de clique muda o estado e
  bagunça a fila da recepção de hoje.
- Correção: o próximo passo de agendado/confirmado (chegada) só aparece no dia do atendimento
  (`AgendaAppointmentDrawer.vue`, `proximoStatus`).
- Conferido: 1440, claro: a Frida de 28/10 abre sem o botão; as de hoje continuam com ele.

### C-06 · Gaveta dizia "Retorno: Fila de espera" · Confunde
- Tela: gaveta do atendimento  ·  todas
- O que acontece: na grade de dados, ao lado de "Profissional: Ana Ribeiro" e "Sala: Consultório
  1", aparecia "Retorno: Fila de espera": o tipo virava rótulo e a origem virava valor.
- Por que pesa para quem usa: lê-se como "o retorno é a fila de espera", que não quer dizer nada.
- Correção: dois pares, "Tipo: Retorno" e "Como chegou: Fila de espera", com chaves novas
  `clinico.agenda.tipoCurto` e `clinico.agenda.comoChegou` nos 6 idiomas
  (`AgendaAppointmentDrawer.vue`).
- Conferido: 1440, claro, pt: os quatro pares alinhados em duas colunas.

### C-07 · "Confirmada pela recepção em 23 min" (confirmação no futuro) · Incomoda
- Tela: gaveta do atendimento de amanhã  ·  qualquer, à noite
- O que acontece: a demonstração gerava a confirmação de presença de amanhã "na noite anterior"
  (19h a 21h30 de hoje); aberta às 20h30, a gaveta dizia "Confirmada pela recepção em 23 min".
- Por que pesa para quem usa: confirmação no futuro é impossível; na apresentação, lê como bug.
- Correção: o atendimento de amanhã nasce confirmado hoje de manhã (9h a 11h30); o de hoje continua
  confirmado na noite anterior (`data/seed.ts`, bloco "Presença confirmada").
- Conferido: 1440, claro: "Confirmada pela recepção há 9 h".

### C-08 · Cancelar promete que o card continua visível, e ele some · Confunde
- Tela: `/veterinario/agenda`, "Cancelar atendimento"  ·  todas
- O que acontece: o diálogo diz "O horário volta a ficar livre, mas o card continua visível no
  dia." Com o padrão "Ocultar cancelados" ligado, o card sai da grade ao confirmar.
- Por que pesa para quem usa: a recepção procura o card para conferir e acha que o cancelamento
  apagou o atendimento.
- Correção: o texto diz o que acontece e onde ver: "O horário volta a ficar livre. Para ver os
  cancelados na agenda, desligue "Ocultar cancelados" em Exibição." nos 6 idiomas; e o aviso ao
  responsável passou de "O atendimento do {paciente}" para "de {paciente}" (Frida é fêmea)
  (`locales/*.json`, `clinico.agenda.cancelarDialogo`).
- Conferido: 1440, claro: diálogo com o texto novo; toast "Atendimento cancelado. Desfazer (Z)".

### C-09 · Bloquear horário em cima de paciente marcado, sem aviso · Confunde
- Tela: `/veterinario/agenda`, "Bloquear horário" (tecla B)  ·  todas
- O que acontece: bloquear o Tiago das 15:00 às 16:00 de quarta caiu em cima do banho e tosa da
  Sushi (14:15 a 15:45) sem uma palavra no diálogo; depois de salvar, nada confirma o bloqueio.
- Por que pesa para quem usa: o paciente continua marcado num horário em que ninguém vai atender;
  ninguém liga para o responsável.
- Correção: o diálogo lista quem já está marcado debaixo do bloqueio, no dia, profissional e sala
  escolhidos: "Já tem atendimento neste horário: Sushi 14:15. Bloquear não desmarca ninguém;
  remarque e avise o responsável." (`AgendaBloquearDialog.vue`, `afetados`; chave
  `clinico.agenda.bloqueio.afetados` nos 6 idiomas).
- Conferido: 1440, claro: aviso em âmbar pastel com tinta escura; some ao trocar para um horário
  livre.
- Não corrigido: falta retorno depois de bloquear (nenhum toast); ver Propostas.

### C-10 · Textos de conflito com travessão e "bloqueio de Bloqueio pessoal" · Polimento
- Tela: Agenda (título dos cards, avisos dos diálogos)  ·  todas
- O que acontece: "Sobrepõe Luna, das 15:00 — 30 min em comum." (travessão) e "Invade um bloqueio
  de Bloqueio pessoal por 30 min."
- Correção: "Sobrepõe Luna, das 15:00: 30 min em comum." e "Entra 30 min no horário bloqueado
  (Bloqueio pessoal)." em pt, en, en-GB, es (sr e ar já estavam bons)
  (`clinico.conflitos.professional-overlap`, `block-invasion`).
- Conferido: 1440, pt: rótulo do card da Frida/Tofu com o texto novo.

### C-11 · Remarcar para outro dia não existe · Confunde
- Tela: `/veterinario/agenda`  ·  todas
- O que acontece: o tutor liga pedindo "passa para quinta?". O arraste só anda dentro do dia, o
  "Editar atendimento" não tem data ("O dia não se edita aqui: mudar de dia é remarcar, e
  remarcar tem caixa própria") e a caixa própria só abre depois de uma falta. A única saída é
  cancelar e criar outro, o que perde o histórico e o aviso de remarcação.
- Não corrigido: pede uma ação nova ("Remarcar" com calendário na gaveta). Ver Propostas.

### C-12 · Botão de ligar no "Reagendar" da falta · Incomoda
- Tela: Agenda, depois de "Marcar falta" e "Registrar motivo"  ·  todas
- O que acontece: a caixa "Reagendar" mostrava o telefone do responsável como botão com borda e
  ícone, um link `tel:` ("(11) 96622-7745"). A regra da casa é a tela registrar o contato, não
  discar; o diálogo de falta já tinha perdido o "Ligar" pelo mesmo motivo.
- Correção: o telefone fica como texto à vista, sem borda, hover nem link
  (`AgendaReagendarDialog.vue`, `.reagendar__telefone`).
- Conferido: 1440, claro: o telefone aparece como `span` ao lado de "Faltou em 27/10 às 10:00".

### C-13 · Mensagens ao tutor com travessão e gênero fixo · Polimento
- Tela: Reagendar falta, Recusa de pedido, Fila (oferta de vaga), Respondidos, Novo paciente,
  Pedido de vacinas  ·  pt, en, en-GB, es
- O que acontece: "Conseguimos um novo horário em 28/10 às 08:00 — podemos confirmar?", "Se puder
  outro dia, peça de novo — ou ligue (11) 3555-0142", "Recusado — Sem horário", "Ele saiu da lista
  — escolha outro.", "Só nome e responsável são obrigatórios — o resto entra quando existe.",
  "Pedido de vacinas — {mês}"; e "Abriu um horário para o {paciente}" (a Pérola é fêmea).
- Correção: vírgula, dois-pontos ou ponto no lugar do travessão nas chaves da Clínica
  (`clinico.faltas.reagendar.mensagemPadrao`, `clinico.pedidos.recusa.mensagem.sem-horario`,
  `clinico.pedidos.respondido.recusado`, `clinico.pedidos.app.horarioSumiu`,
  `clinico.paciente.novo.ajudaCompleta`, `telefoneSecundarioDica`,
  `clinico.estoque.pedido.cabecalhoTexto`) e "para {paciente}" na oferta da fila. sr e ar já
  estavam sem travessão.
- Conferido: 1440, pt: mensagem do Reagendar "… às 08:00. Podemos confirmar?"; `check:i18n` OK.
- Ficou para a frente Veterinário: travessões em `clinico.bulario.*`, `clinico.documentos.*`,
  `clinico.prontuario.*`, `clinico.internacao.*`.

### C-14 · A página pública mostra outra clínica · Confunde
- Tela: `/agendar/petjourney-vila-madalena` e "Link da clínica" em `/veterinario/pedidos`
- O que acontece: a conta é da "Aurora Clínica e Hotel Veterinário", mas o link é
  `…/agendar/petjourney-vila-madalena` e a página diz "PetJourney Clínica Veterinária, Rua das
  Acácias, 421 — Vila Madalena". Também "Quem atende: Ana, Helena, Tiago e Caio" (a Márcia some
  da página, embora atenda na agenda).
- Por que pesa para quem usa: na apresentação, o tutor cai numa clínica com outro nome; o dono
  pergunta de onde veio "PetJourney Vila Madalena".
- Não corrigido: o nome vem da demonstração (`data/fixtures/clinic.ts`, `seed-pedidos.ts`), e o
  hotel tem o mesmo caso ("PetJourney Hotel"). Sugestão: a demonstração tomar o nome da empresa
  da conta (store do parceiro) para clínica, hotel e slug.

### C-15 · Celular do tutor sem máscara e sem dizer o que falta · Confunde
- Tela: `/agendar/<slug>`, passo 4 "Seus dados"  ·  1440 e tablet
- O que acontece: o campo "Celular com DDD" aceitava qualquer texto e guardava "11987650042" cru,
  que aparecia assim na revisão e na tela final ("A confirmação chega por mensagem no
  11987650042"). Sem o DDD, o "Continuar" só ficava apagado, sem dizer por quê; e um celular sem o
  nono dígito passava (a regra contava só 10 dígitos).
- Por que pesa para quem usa: o tutor no celular não entende por que não avança e desiste; a
  clínica recebe número que não recebe mensagem.
- Correção: máscara progressiva "(11) 98765-0042" e, ao sair do campo, "Telefone inválido. Use
  DDD + número."; a validação usa a mesma régua do cadastro da clínica (`telefoneValido`)
  (`EtapaSeusDados.vue`, `fluxo-do-pedido.ts`, `.fx-erro` em `fluxo.css`).
- Conferido: 1440, claro, pt: "987654321" vira "(98) 7654-321" com o erro em vermelho de tinta;
  "11987650042" vira "(11) 98765-0042" sem erro.

### C-16 · Pedido feito pelo link aparece na caixa; aceitar, recusar e marcar outro dia funcionam · ok
- Tela: `/agendar/petjourney-vila-madalena` → `/veterinario/pedidos`
- O que vi: o pedido da Bolota (Beatriz Moura, consulta por sintoma, qua. 28/10 09:00 com a
  Helena) entrou em "Esperando resposta" com "Primeira vez" e "Pelo link da clínica". Aceitar o
  Thor mostrou "Thor: marcado para qua., 28/10 · 10:00 com Ana Ribeiro. O responsável já foi
  avisado. Ver na agenda"; a recusa de Nina e Oliver abre a mensagem pronta ao tutor, com o motivo
  e o telefone da clínica ("A mensagem chega no app, com o botão para pedir outro horário"); a
  Luna foi marcada em outro dia (qui. 29/10 10:00) pelo calendário da gaveta. Selos do menu
  acompanharam (Agenda 6 → 5 → 4).

### C-17 · Fila oferecia ao Zeus uma vaga que já tinha passado · Confunde
- Tela: `/veterinario/fila`, "Ofertas esperando resposta"  ·  à noite
- O que acontece: às 21h, a oferta do Zeus era "ter., 27/10 17:00" com "4 min para responder,
  até 21:08": a vaga do dia já tinha passado (e terça nem está nas janelas dele, seg. de manhã e
  qua. à tarde).
- Por que pesa para quem usa: a recepção liga oferecendo um horário que já foi; na apresentação
  noturna, lê como bug.
- Correção: a demonstração oferece a próxima quarta às 17h, dentro da janela do Zeus
  (`data/seed.ts`, `montarFila`, `fila-1`).
- Conferido: 1440, claro: "qua., 28/10 17:00 · Vaga oferecida", prazo de 4 min.

### C-18 · "Remover" da fila apagava na hora, sem pergunta nem rastro · Confunde
- Tela: `/veterinario/fila`, "Esperando vaga"  ·  todas
- O que acontece: um clique em "Remover" tirava a entrada da lista na hora, sem confirmação,
  sem desfazer, e ela não vai para "Já resolvidas" (o status `removido` some de todas as listas).
- Por que pesa para quem usa: a lista é cheia de botões; um clique errado apaga o pedido de um
  tutor que espera há dias, e ninguém sabe que ele existiu.
- Correção: o primeiro clique troca, na própria linha, por "Cancelar" e "Remover da fila"; só o
  segundo remove (`fila.vue`, `aRemover`).
- Conferido: 1440, claro: na Pandora, "Remover" vira "Cancelar · Remover da fila"; "Cancelar"
  volta ao normal.
- Ver também Propostas (removidos em "Já resolvidas").

### C-19 · "Adicionar à fila" com o botão "Manter como está" · Polimento
- Tela: `/veterinario/fila`, "Adicionar à fila"  ·  todas
- O que acontece: o formulário novo oferecia "Manter como está" ao lado de "Adicionar à fila";
  não há nada "como está" num cadastro novo.
- Correção: "Cancelar" (`FilaAdicionarDialog.vue`).
- Conferido: 1440, claro.

### C-20 · Painel de faltas com "Ligar para (11) 99504-3312" · Incomoda
- Tela: `/veterinario/faltas`, detalhe do responsável  ·  todas
- O que acontece: o telefone do responsável no topo do detalhe era um link `tel:` azul com
  `title="Ligar para (11) 99504-3312"`. Mesma regra do C-12: a tela registra, não disca.
- Correção: telefone como texto, com o ícone (`faltas.vue`, `.detalhe__telefone`; saiu
  `hrefDoTelefone`).
- Conferido: 1440, claro: "Faltas de Daniel Okamoto · (11) 99504-3312" sem link; nenhum `tel:`
  na tela.

### C-21 · Faltas a justificar fora do selo de Pendências · Confunde
- Tela: menu "Pendências 20" e abas de `/veterinario/atividades`  ·  todas
- O que acontece: a aba Faltas é a única sem selo, embora o próprio topo diga "19 pacientes com
  falta sem motivo"; o "20" de Pendências soma Atividades 12, Vacinas 6, Tratamentos 1 e
  Estoque 1, e deixa as 30 faltas a justificar de fora. No Início, "O que pede ação" também não
  as lista.
- Por que pesa para quem usa: quem confia no selo acha que não há ligação a fazer.
- Não corrigido: a contagem é da casca (`useAppNavigation.ts`, `contagemPorRota` sem
  `/veterinario/faltas`) e decidir se falta entra no selo (e com que tom) é decisão de produto.
  Anotado em "Compartilhado".

### C-22 · Busca de pacientes com o "x" azul do navegador · Polimento
- Tela: `/veterinario/pacientes` (e Vacinas, Atendimentos, que usam a mesma barra)  ·  todas
- O que acontece: o `type="search"` mostrava o botão de limpar do Chrome, azul, fora da paleta e
  fora do Phosphor; depois de limpar, o foco caía no corpo da página.
- Correção: o "x" do navegador some e entra um `Button` da casa (`ph ph-x`, tinta secundária,
  "Limpar") que devolve o foco ao campo (`components/base/ClinicFilterBar.vue`, `limparBusca`,
  `.filtro__limpar`). Edição pequena num arquivo da base, relida antes.
- Conferido: 1440, claro: "xyzw" → "Nenhum paciente encontrado" com o "x" cinza à direita;
  clicar limpa, volta a "29 resultados" e o foco fica no campo.

### C-23 · Prévia do novo paciente dizia "Fêmea · Castrado" · Polimento
- Tela: `/veterinario/paciente/novo`, "Como vai aparecer na clínica"  ·  pt, es, sr, ar
- O que acontece: Pipoca, fêmea, castrada, aparecia como "Felina · Siamês · Fêmea · Castrado".
- Correção: a prévia concorda com o sexo, com as mesmas chaves do cabeçalho do paciente
  (`castrada`/`inteira`) (`PacientePreview.vue`).
- Conferido: 1440, claro: "Felina · Siamês · Fêmea · Castrada"; o cadastro salvo abre a ficha
  com "Fêmea · Castrada" e "Alergia: Dipirona (Risco)".

### C-24 · Importação: "Arrumamos sozinhos 1 linha" e o painel abre com 3 · Confunde
- Tela: `/veterinario/paciente/importar`, passo 3  ·  todas
- O que vi com a planilha de teste (8 linhas: boas, sem nome, data 31/02, e-mail sem domínio,
  CPF 111.111.111-11, celular sem DDD, tutora repetida com telefone novo, hamster e coelho): uma
  pergunta só ("Camila Ferraz já é cliente da clínica?"), a linha sem nome fica de fora com
  "Animal sem nome", o celular "987654321" ganha o DDD da clínica, datas e pesos são lidos, e a
  importação termina com "7 de 8 linhas entraram". A lista de pacientes passa de 29 para 34.
- O que acontece: a caixa "Arrumamos sozinhos" dizia "1 linha" logo acima de "3 valores errados
  ficam em branco"; o "Ver quais" dela abria o painel na aba "Corrigidas 3" (Thor, Luna, Bolinha).
  A caixa contava só as linhas reformatadas; o painel conta também as que perderam valor.
- Por que pesa para quem usa: o número da caixa e o do painel não batem; quem confere desconfia
  da importação inteira.
- Correção: a caixa usa a mesma régua do painel (toda linha com ajuste)
  (`MigracaoPassoImportar.vue`, `corrigidas`).
- Conferido: 1440, claro: "Arrumamos sozinhos 3 linhas" e "Corrigidas 3".
- Observação: coelho entra como "Roedor" (o sistema não tem lagomorfo); vale para o cadastro.

### C-25 · "Quem chamar" prometia o dobro de agenda a recuperar · Confunde
- Tela: `/veterinario/vacinas?aba=atraso`  ·  todas
- O que acontece: no recorte "6 vacinas vencidas", o cartão "Quem chamar · 4" dizia "Chamando
  todos, são 4 h 20 min de agenda a recuperar (20 min por aplicação)": a conta usava as 13 vacinas
  de todos os recortes, não as 6 da lista à vista.
- Por que pesa para quem usa: o gerente usa esse número para decidir quanto tempo da recepção
  dedicar às ligações; o dobro distorce a decisão.
- Correção: a conta usa a lista do recorte escolhido (`vacinas.vue`, `potencial`).
- Conferido: 1440, claro: "Vencidas" → "2 h"; "No total" → "4 h 20 min".

### C-29 · Meta de teto dizia "5 doses de 0 doses" · Polimento
- Tela: `/veterinario/estoque?aba=metas`  ·  todas
- O que acontece: as metas de limite (perdas, orçamento) usavam o mesmo "de" das metas de alvo:
  "5 doses de 0 doses · Estourou", "R$ 618,40 de R$ 400,00".
- Correção: meta de teto diz "5 doses · limite 0 doses" (chave nova `clinico.estoque.metas.limite`
  nos 6 idiomas) (`MetasDoMes.vue`).
- Conferido: 1440, claro, pt.

### C-26 · "Agendar" da lista de vacinas abria a agenda vazia · Incomoda
- Tela: `/veterinario/vacinas?aba=atraso`  ·  todas
- O que acontece: "Agendar: Thor" levava a `/veterinario/agenda` sem nada; a recepção, com o
  tutor no telefone, abria "Novo atendimento", procurava o Thor de novo e trocava o tipo para
  vacinação.
- Correção: abre o formulário com o pet e o tipo "Vacinação" já escolhidos
  (`?novo=1&paciente=…&tipo=vacina`, o mesmo caminho do "Marcar retorno" de Atividades)
  (`vacinas.vue`, `agendar`).
- Conferido: 1440, claro: "Agendar: Thor" → "Novo atendimento · Paciente Thor · Vacinação".

### C-27 · Receber lote vencido: a data sumia e a tela pedia "Informe a validade" · Confunde
- Tela: `/veterinario/estoque`, "Receber lote"  ·  todas
- O que acontece: digitar "15/09/2026" (lote já vencido) na validade e sair do campo apagava a
  data sem aviso (o calendário tinha data mínima = amanhã); ao "Dar entrada", só "Informe a
  validade.". A mensagem pronta para o caso ("Validade vencida: frasco vencido volta ao
  fornecedor, não entra na geladeira.") nunca aparecia.
- Por que pesa para quem usa: quem confere a nota digita a data do frasco, vê o campo esvaziar e
  acha que o sistema travou; tenta de novo até desistir.
- Correção: sem data mínima no campo; a validade vencida fica escrita e o erro aparece na hora,
  sem esperar o "Dar entrada" (`ReceberLoteDialog.vue`, `erroValidade`).
- Conferido: 1440, claro: "15/09/2026" fica no campo com o erro em vermelho de tinta; com
  "30/09/2027", lote FLV2610A, 10 doses, NF 48.211, a FeLV passa de "0 · Acabou" a "10 · Em nível"
  e o selo de Pendências cai de 20 para 19.

### C-28 · Lote vencido contava como estoque "em nível" · Confunde
- Tela: `/veterinario/estoque`, "Geladeira"  ·  todas
- O que acontece: a V10 aparecia "11 · mínimo 10 · Em nível" com o lote V10-2409 (2 doses)
  vencido há 20 dias; a Antirrábica, "21 · 504 dias", com 9 doses do RAB-2410 vencidas. O saldo
  por vacina somava lotes vencidos, que não vacinam ninguém; a compra sugerida saía menor.
- Por que pesa para quem usa: o gerente não compra V10 e descobre na hora da vacina que não tem.
- Correção: o saldo e a cobertura por vacina contam só lotes não vencidos; o valor parado continua
  contando o vencido até o descarte (`domain/estoque-vacinas.ts`, `saldos`), com teste novo
  ("lote vencido fica fora do saldo que aplica, mas segue no valor parado").
- Conferido: 1440, claro: "V10 · 9 · mínimo 10 · Abaixo do mínimo"; "Antirrábica · 12 · 288 dias";
  o topo passa a "2 vacinas para comprar".

### C-30 · Relatórios: "24 pacientes novos" numa semana, numa clínica de 29 · Confunde
- Tela: `/veterinario/resumo`, "Esta semana"  ·  todas
- O que acontece: o indicador "Pacientes novos" deveria contar quem teve o **primeiro**
  atendimento da vida no período, mas a tela só buscava os atendimentos do período: todo paciente
  que veio na semana "estreava" nela. "Esta semana" mostrava 24; "Hoje", 22.
- Por que pesa para quem usa: é o número que o dono leva para a reunião de captação.
- Correção: a busca vai um ano para trás do início do período (os gráficos continuam recortados
  pelo período) (`resumo.vue`, `carregar`).
- Conferido: 1440, claro: "Esta semana · 1 paciente novo · nenhum encaixe"; depois de um encaixe
  do Biscoito (que nunca tinha vindo) na quinta, pela Agenda, voltando por navegação: "2 pacientes
  novos · 1 encaixe". "30 dias" segue com 24, porque a base de demonstração começa em 06/10.

### C-31 · Falha ao salvar apagava a Agenda (e a Fila) e o diálogo ficava mudo · Bloqueia
- Tela: `/veterinario/agenda` e `/veterinario/fila`, com erro forçado pelo painel de
  desenvolvimento (`agenda.criar`, `agenda.status`, `fila.ofertar` em 100%)
- O que acontece: "Agendar" ou "Registrar chegada" que falhavam trocavam a grade inteira por
  "Não foi possível carregar · A alteração não foi salva. Tente de novo. · Tentar novamente"
  (título de erro de **carga** para uma falha de **salvar**), por trás da máscara do diálogo; o
  diálogo continuava aberto, sem uma palavra, e o "Tentar novamente" só recarregava a agenda.
  Na Fila, o "Registrar aceite" que falhava não dizia nada: o erro era marcado e apagado no mesmo
  instante pela recarga da lista.
- Por que pesa para quem usa: com a rede instável da recepção, a pessoa clica "Agendar" três
  vezes sem retorno, perde a grade de vista e não sabe se marcou ou não.
- Correção: erro de carga continua tomando a tela; erro de salvar vira aviso por cima de tudo
  (toast acima da máscara) e a grade/lista fica (`agenda.vue` e `fila.vue`, `ERRO_DE_SALVAR`,
  watch com `flush: 'sync'`).
- Conferido: 1440, claro: com `agenda.criar` falhando, o diálogo fica aberto com os dados, a grade
  continua atrás e aparece "A alteração não foi salva. Tente de novo." no canto; com
  `fila.ofertar` falhando, o Tofu continua com "Registrar aceite" e o mesmo aviso. Latência de
  4 s em Pedidos mostra "Carregando..."; falha de `pedido.listar` mostra "Não foi possível
  carregar os pedidos." com a lista anterior.

### C-32 · No tablet, a Agenda mandava "Arraste" e "Clique" · Confunde
- Tela: `/veterinario/agenda` (Tabela)  ·  1024x768 e 768x1024 com toque
- O que acontece: o rodapé dizia "Arraste um atendimento para outro horário ou profissional
  para remarcar. Clique num horário livre para marcar." No toque, o arraste do navegador não
  acontece: quem tenta arrastar só rola a tabela.
- Correção: com ponteiro grosso (toque), a dica vira "Toque num horário livre para marcar. Para
  remarcar, abra o atendimento e toque no lápis." (chave `clinico.agenda.tabela.dicaToque` nos 6
  idiomas; `@media (pointer: coarse)` em `AgendaTabelaDia.vue`).
- Conferido: 768x1024 com toque: só a dica do toque aparece; 1440 com mouse: a de sempre.
- Visto também: em 1024 com o menu aberto, a tabela de 5 profissionais rola na horizontal e os
  nomes viram "Oliv…", "Cac…" (ver Propostas).

### C-33 · Domingo fechado mostra a grade vazia e a dica de marcar · Polimento
- Tela: `/veterinario/agenda?data=2026-11-01`  ·  1440
- O que acontece: com "A clínica não abre neste dia.", a tabela ainda desenha o cabeçalho dos
  cinco profissionais com "0%", um vão branco até o rodapé e "Clique num horário livre para
  marcar", sem horário nenhum.
- Não corrigido: ajuste de layout pequeno, mas mexe na estrutura do estado vazio da tabela; fica
  junto da proposta da Agenda no tablet.

### C-34 · Pequenos, vistos de passagem · Polimento
- Placeholder parecendo valor: na baixa de lote, "Observação" vem com "Caiu na bancada da sala 2"
  em cinza escuro (#5F6670 contra #1D3557 do valor); lê como campo preenchido. É cor do tema.
- Em `ar`, a lista de nomes latinos dentro da frase do aviso de bloqueio embaralha a pontuação
  (bidi); o resto do diálogo está certo em RTL, com o dual ("يوجد موعدان").
- O "Novo atendimento" aberto depois do expediente começa às 21:45 do dia que já acabou, com
  "Fora do expediente" (ver Propostas: data no formulário).
- A visão Semana mantém a frase do dia ("Domingo, 01 de novembro: nenhum atendimento marcado").

## Compartilhado (para a casca/base)

- **Régua da barra lateral vazando para a Agenda (corrigido, uma linha).** A regra
  `.shell.shell--moldura-app .barra` (fio à direita, fundo e cor da barra lateral) pegava qualquer
  `.barra` da página: a barra de comando da Agenda ganhava um fio vertical solto à direita
  (x≈1403, ao lado do "...") e as `.barra` do hotel (`HospedeCard.vue`, `GradeDeOcupacao.vue`)
  ficam sujeitas ao mesmo fundo. Troquei por `.shell.shell--moldura-app > .barra`, que é o `aside`
  da casca (`src/components/layout/moldura-app.css:107`). Conferido: barra lateral com o fio, a da
  Agenda sem.
- **Início: "24 de 37 atendimentos feitos hoje" nunca chega a 100%.** O total conta as faltas, que
  nunca viram "feitas"; e o número difere da Agenda (ver C-03). Sugestão: total sem faltas, ou
  "feitos + faltas" no numerador (`src/components/home/HomeEspacoClinica.vue:139`).
- **Esc não fecha diálogo com o foco num Select fechado.** O `Select` do PrimeVue engole o Esc
  (`preventDefault` + `stopPropagation`) mesmo com a lista fechada; o `Dialog` não recebe. Vale
  para todo diálogo com Select do portal (visto em "Novo atendimento"). Precisa de solução no tema
  ou num invólucro do Select.
- **Login diz "Bem-vindo de volta"** (forma masculina para todos; a regra pede forma neutra).
- **Botão de perigo com texto branco sobre pastel (contraste 2:1).** Depois do "cor só em
  pastel", `--risco` no claro virou `#ee9f97` (`moldura-app.css:557`), mas o texto do botão cheio
  continua `--superficie` (branco) (`src/theme/trilha/trilha-tema.css:310-312`). Medido em
  "Cancelar atendimento": fundo `rgb(238,159,151)`, texto `rgb(255,255,255)`, 16 px/700: cerca de
  2:1, abaixo do AA. Vale para todo `severity="danger"` cheio do portal. Sugestão: no bloco
  pastel do claro, `--p-button-danger-color` (e hover/active) = `var(--risco-tinta)` (#9d2e29,
  cerca de 5:1), como o `warn` já faz com a tinta.
- **Faltas fora do selo de Pendências (C-21).** `contagemPorRota` em
  `src/composables/useAppNavigation.ts` não tem `/veterinario/faltas`: a aba fica sem número e o
  "Pendências 20" ignora as faltas a justificar. Decidir se entram (e com que tom).
- **"+ Criar novo → Agendamento" não leva o paciente aberto.** Na ficha do Tofu, o atalho abre
  "Novo atendimento" com "Escolha o paciente". `ShellCriar.vue` poderia mandar `paciente` quando a
  rota é `/veterinario/paciente/:id` (a Agenda já aceita `?novo=1&paciente=…`).
- **Toast de erro sem cara de erro.** O toast global sai branco, sem ícone nem tom de risco, igual
  ao de sucesso ("A alteração não foi salva. Tente de novo."). Vale dar ícone `ph-warning-circle`
  e o pastel de risco ao `severity="error"` no tema.
- **Barra de rolagem do sistema no painel de desenvolvimento** da Clínica (gaveta à direita).
  Ferramenta de demonstração, mas aparece na apresentação.
- **Busca global (Ctrl K) funciona bem a partir da Clínica:** "rita" lista Tofu e Zeus pelo
  responsável e telefone; Enter abre a ficha; "estoque" acha a tela.

## Fora do portal (API, CMS, app)

- Nada nesta frente: Clínica e página pública `/agendar` rodam mocadas no front; as chamadas de
  rede vistas nas telas da Clínica foram só as da casca (`/usuario/allInformations/…`,
  `/parceiro/portal/dashboard`, `/parceiro/portal/status`), todas 200. Nenhum erro de console nas
  telas da Clínica (o único visto foi um `ReferenceError` meu durante a edição, corrigido).
- Para quando houver API: "pacientes novos" precisa de uma data de primeiro atendimento por
  paciente vinda do servidor (C-30); a tela hoje busca um ano para trás para calcular.

## Propostas (mudanças maiores, não implementadas)

- **Remarcar com calendário (C-11).** Na gaveta do atendimento, ação "Remarcar" que abre uma
  gaveta à direita com `DatePicker` inline (dias sem vaga desabilitados), os horários livres do
  dia escolhido e a mensagem ao responsável, reaproveitando `sugerirReagendamento` e
  `agenda.mover`. Hoje mudar de dia exige cancelar e criar de novo.
- **Novo atendimento e Editar em gaveta, com data.** Os dois são formulários em `Dialog` no meio
  da tela; a regra da casa pede `Drawer` à direita. Junto, um campo de data (DatePicker): hoje o
  diálogo marca sempre no dia aberto na agenda, e a recepção precisa fechar, andar até quinta e
  abrir de novo para responder "tem quinta?". Depois do expediente, o "Novo atendimento" abre às
  20:45 do dia que já acabou, com "Fora do expediente".
- **Controles nativos na Clínica.** Cerca de 30 `<button>` nativos (fita da semana, horários
  sugeridos, "Cadastrar novo paciente" do rodapé do Select, dias da recorrência, linhas de tabela)
  e os campos de hora `InputText type="time"` (seletor do navegador, fora da paleta) em
  `AgendaCriarDialog`, `AgendaEditarDialog`, `AgendaBloquearDialog`, `FilaAdicionarDialog`. Trocar
  por `Button` e `DatePicker timeOnly` numa passada só, conferindo cada tela.
- **Retorno depois de bloquear.** Criar atendimento mostra "Atendimento criado. Desfazer (Z)";
  bloquear não mostra nada. Usar a mesma barra de desfazer.
- **Agenda no tablet.** Em 1024 com o menu aberto sobram ~750 px para cinco colunas: a tabela rola
  na horizontal e os nomes viram iniciais cortadas. Recolher o menu por padrão na Agenda abaixo de
  1280, ou deixar escolher quais profissionais aparecem (o filtro já existe, mas fica escondido).
- **Removidos da fila em "Já resolvidas".** A entrada removida some de todas as listas (status
  `removido` é filtrado no store). Mostrar em "Já resolvidas" com "Removido em …" e um "Desfazer"
  curto, como a Agenda faz.
- **Página pública com o nome da conta.** A demonstração usa "PetJourney Clínica Veterinária ·
  Vila Madalena" e o slug `petjourney-vila-madalena`; para a apresentação, tomar nome, endereço e
  slug da empresa logada (Aurora) em clínica e hotel (C-14).

## Dados criados (para a apresentação)

- Dado criado na Clínica é mocado no front: some no recarregamento completo (já sabido, anotado
  uma vez só). Para repetir na apresentação:
- Agenda: consulta da **Luna** (qua. 28/10, 09:30, Ana Ribeiro, "Tutora relata coceira nas
  orelhas há 5 dias. Lembrar: alergia a amoxicilina."); encaixe do **Bidu** (qua. 28/10, 10:15,
  Márcia, em cima do Jack); **Frida** remarcada arrastando para 11:30 com o Tiago Sá; retorno da
  Frida de 14:00 cancelado ("Responsável desmarcou"); bloqueio pessoal do Tiago (qua. 15:00 a
  16:00, "Consulta médica do Tiago"); faltas da Pérola ("Esqueceu", com observação) e do Chico;
  encaixe do **Biscoito** (qui. 29/10, 10:00).
- Página pública `/agendar/petjourney-vila-madalena`: pedido da **Bolota** (Beatriz Moura,
  (11) 98765-0042, consulta por sintoma "Coçando muito as orelhas há uma semana e balançando a
  cabeça.", qua. 28/10 09:00 com a Helena).
- Pedidos: Thor aceito (qua. 28/10 10:00, Ana); Nina e Oliver recusados ("Sem horário"); Luna
  marcada em outro dia (qui. 29/10 10:00, Caio).
- Fila: **Mel** (Luciana Prado, consulta, seg. a sex. 08:00–19:00, "Tutora prefere fim de tarde;
  aceita encaixe com qualquer veterinário."); aceite da Brunilda (qua. 28/10 15:00).
- Faltas: justificativa do Açaí Nhoque Çãpeçã ("Sem transporte", "Responsável disse que o carro
  quebrou no caminho.").
- Pacientes: **Pipoca** (felina, siamês, fêmea, castrada, 4,2 kg, microchip 985112004567321,
  "Seal point, pelo curto", alergia a Dipirona em risco; tutora Mariana Lopes Teixeira, (11)
  99123-4567, CPF 390.533.447-05, Rua Fradique Coutinho, 1180, apto 52, Pinheiros).
- Importação: planilha de 8 linhas (boas e ruins) em
  `C:\Users\darkb\AppData\Local\Temp\claude\d--PROJETOS-petjourney-admin\618afe40-92ce-48b2-a5dd-89ed0ca5db24\scratchpad\clinica\planilha-pacientes.csv`;
  entraram Paçoca, Mimi, Thor (Carlos Eduardo Siqueira), Bolinha (hamster), Zé Colmeia (coelho),
  e Luna e Nina receberam dados.
- Estoque: lote **FLV2610A** de FeLV (10 doses, validade 30/09/2027, NF 48.211); baixa de 2 doses
  do RAB-2503 por quebra ("Frasco caiu da bandeja na sala 2.").

## Verificação final (vitest, i18n, eslint/oxlint, type-check: comando e resultado)

- `npx vitest run src/features/clinico`: 66 arquivos, 939 testes, todos passaram (inclui o teste
  novo "lote vencido fica fora do saldo que aplica, mas segue no valor parado"). Os dois specs da
  fila que dependem da hora passaram nesta rodada.
- `npm run check:i18n`: paridade OK (chaves novas `clinico.agenda.comoChegou`,
  `clinico.agenda.tipoCurto`, `clinico.agenda.bloqueio.afetados` com 3 formas em sr e 6 em ar,
  `clinico.agenda.tabela.dicaToque`, `clinico.estoque.metas.limite`).
- `npx oxlint <21 arquivos tocados>` e `npx eslint <os mesmos>`: saída limpa, código 0.
- `npx prettier --check`: limpos os arquivos que já estavam limpos no HEAD (`seed.ts`,
  `PacientePreview.vue`, `MetasDoMes.vue` e os demais novos de formatação); os outros já estavam
  fora do prettier no HEAD e não foram reformatados.
- `npm run type-check`: um erro só, fora desta frente:
  `src/pages/(accounts)/hotel/mapa.vue(136,41): Property '$el' does not exist` (frente Hotel).
  Nenhum erro nos arquivos da Clínica.
- Arquivos tocados: `AgendaTabelaDia.vue`, `AgendaAppointmentDrawer.vue`,
  `AgendaBloquearDialog.vue`, `AgendaReagendarDialog.vue`, `FilaAdicionarDialog.vue`,
  `pages/(accounts)/veterinario/{agenda,fila,faltas,vacinas,resumo}.vue`,
  `pedidos/fluxo/{EtapaSeusDados.vue,fluxo-do-pedido.ts,fluxo.css}`,
  `pacientes/PacientePreview.vue`, `migracao/MigracaoPassoImportar.vue`,
  `estoque/{ReceberLoteDialog,MetasDoMes}.vue`, `composables/useClinicShortcuts.ts`,
  `domain/estoque-vacinas.ts` (+ spec), `data/seed.ts` (2 trechos), `base/ClinicFilterBar.vue`,
  `locales/*.json` (6) e uma linha da casca: `components/layout/moldura-app.css:107`.
