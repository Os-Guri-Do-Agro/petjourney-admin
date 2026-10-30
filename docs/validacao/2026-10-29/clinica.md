# Frente Clínica: validação de uso real (29/10/2026)

Persona e roteiro: fui a recepção e a gerência da Aurora Clínica e Hotel Veterinário. Entrei com a
conta da Helena (`helena@clinica-aurora.example.com`), liguei Clínica e Hotel e, para ter o dia
cheio, abri as telas com o relógio da página às 10:40 (o mesmo truque da sessão de captura); parte
das telas também foi vista no horário real, à noite. Usei Hoje, Agenda (dia e semana, por
profissional, criar pelo botão e pela grade, gaveta do atendimento, bloquear pelo atalho B,
domingo e segunda), Pedidos (link da clínica, sugestão de horário), Fila, Faltas, Pacientes (busca
por telefone, filtros, ficha da Açaí), Vacinas, Estoque, Relatórios (Hoje, Esta semana, Semana
passada, 30 dias) e a página pública `/agendar/<slug>?clinico=on` com sessão. Tamanhos: 1440x900,
1024x768 e 768x1024. Temas: claro e escuro. Idiomas: pt em tudo; es em Faltas e no selo; ar
(RTL) na Agenda fechada. Contraste medido por script (cor do texto contra o primeiro fundo opaco).

Resumo: 25 achados. Bloqueia 0, Confunde 10, Incomoda 4, Polimento 11. Corrigidos e conferidos na
tela: 20 (18 na frente e C-23 e C-24 no fechamento). Não corrigidos: 5 (C-19, C-20, C-21, C-22 e
C-25), com o motivo em cada um.

Os seis abertos da rodada anterior que eram desta frente: "Novo atendimento começa num horário
bloqueado" (C-03, corrigido), "Fundo de continua parece cartão vazio" (C-04, corrigido), C-33
(C-05, corrigido) e C-34 (C-06, corrigido), C-21 (C-07, corrigido: entram no selo, em atenção),
C-14 (C-09, corrigido: a demonstração usa o nome da conta) e C-11 (C-19, não corrigido: não é
pequeno; proposta abaixo). As correções antigas conferidas continuam valendo (C-01 atendimento no
almoço, C-04 atalhos no diálogo, C-08 cancelar, C-09 aviso e toast do bloqueio, C-12/C-20 sem
botão de ligar, C-22 busca, C-28 saldo sem lote vencido, C-32 dica do toque), com uma regressão de
número (C-01 abaixo).

## Achados

### C-01 · Três números diferentes para "atendimentos de hoje", de novo · Confunde
- Tela: Hoje, Agenda e Início  ·  Largura/tema: todas, claro e escuro
- O que acontece: às 10:40, o Hoje dizia "7 de 37 atendimentos feitos hoje", a Agenda "36
  atendimentos, 2 na recepção" (e "36" na fita da semana) e o Início "7 de 35". O Hoje contava as
  duas faltas no total (o Início já não contava desde a consolidação de 28/10); a Agenda contava a
  cirurgia do Bento duas vezes, uma por profissional.
- Por que pesa para quem usa: é a mesma pergunta em três telas, com três respostas; a gerente
  desconfia de todas.
- Correção: uma régua só. `umPorGrupo` (cirurgia com dois profissionais conta uma vez) passou para
  `domain/load.ts` e vale para a fita e a semana (`cargaDoDia.agendados`), para a frase da Agenda
  (`agenda.vue`, `fraseDoDia`) e para o Hoje, que também deixou de contar a falta no total
  (`useMeuDia.ts`, `progressoDoDia`). Teste novo em `clinical.spec.ts` ("a cirurgia com dois
  profissionais conta um atendimento, e ocupa as duas colunas").
- Conferido: 1440, claro, 10:40: Hoje "7 de 35", Agenda "35 atendimentos, 2 na recepção" com "35"
  na fita, Início "7 de 35".

### C-02 · Relatórios contavam a cirurgia de dois profissionais duas vezes · Confunde
- Tela: `/veterinario/resumo`  ·  1440, claro
- O que acontece: "Movimento por dia" dava 38 para quinta (35 + 2 faltas + a segunda perna da
  cirurgia), e "Por tipo de atendimento" e "Tempo de atendimento" somavam a cirurgia em dobro.
- Por que pesa para quem usa: o número do relatório não bate com a agenda do mesmo dia.
- Correção: dia, tipo, origem, horário e horas contam o atendimento uma vez; "Por profissional"
  continua contando cada um que esteve na sala (`domain/resumo.ts`). Teste novo em `resumo.spec.ts`.
- Conferido: 1440, claro: quinta = 37 (35 + 2 faltas), igual à Agenda.

### C-03 · Novo atendimento abria num horário tomado (aberto da rodada anterior) · Confunde
- Tela: Agenda, "Novo atendimento" pelo botão ou pela tecla N  ·  todas
- O que acontece: às 10:40 o formulário propunha 10:45 com a Ana Ribeiro no Consultório 1; ao
  escolher o paciente, quatro avisos (Amora em consulta, Simba, sala ocupada, horário bloqueado) e
  o botão "Agendar mesmo assim".
- Por que pesa para quem usa: a recepção com o tutor no telefone lê "Agendar mesmo assim" no
  primeiro horário que o sistema mesmo sugeriu.
- Correção: sem horário vindo do clique na grade, a hora anda do próximo passo até o primeiro
  horário sem choque de profissional, sala, bloqueio, almoço ou expediente
  (`AgendaCriarDialog.vue`, `primeiroHorario`, `TOMAM_O_HORARIO`, `salaPara`). Carga alta continua
  só aviso. O clique na grade continua mandando a hora clicada.
- Conferido: 1440, claro: abre às 13:15 com a Ana (o primeiro horário em que ela e o Consultório 1
  estão livres; 11:30 tem a Frida na sala e 11:45 entra no almoço).

### C-04 · Bloco branco sem texto no atendimento que atravessa o almoço (aberto) · Polimento
- Tela: Agenda (Tabela), coluna da Helena Vasconcelos, 12:30  ·  todas, claro e escuro
- O que acontece: o banho do Maximiliano (11:30 às 13:00) dizia o nome só na meia hora das 12:00,
  que vira a faixa do almoço; a das 12:30 ficava como um cartão branco vazio. Além disso, o rótulo
  da continuação cortava o traço da esquerda, e no bloco branco sobravam dois tocos.
- Correção: o nome vai para a primeira meia hora **à vista** depois do início
  (`AgendaTabelaDia.vue`, `primeiraContinuacao`); o rótulo começa depois do traço
  (`.continua`, `margin-inline-start`).
- Conferido: 1440, claro e escuro: "Maximiliano Bar… até 13:00" às 12:30, traço inteiro; contraste
  6,4 a 8,5:1 no escuro.

### C-05 · Domingo fechado mostrava a grade vazia, "0%" e "Clique num horário livre" (C-33) · Polimento
- Tela: `/veterinario/agenda?data=2026-11-01`  ·  1440, claro, escuro e ar
- O que acontece: aviso "A clínica não abre neste dia." e, logo abaixo, cinco colunas com 0%, a
  grade em branco e a dica de marcar.
- Correção: dia fechado sem nada marcado vira um estado só: "Clínica fechada", a frase do motivo e
  o botão "Ir para seg., 02/11" (próximo dia de expediente). Com emergência marcada, a grade volta
  com o aviso (`agenda.vue`, `fechadoSemNada`, `proximoDiaAberto`; chaves
  `clinico.agenda.fechadaSemNada` e `irParaDia` nos 6 idiomas).
- Conferido: 1440 claro e escuro; em ar, "الانتقال إلى الاثنين، 02/11"; o botão leva a 02/11.

### C-06 · Visão Semana com a frase do dia (C-34) · Polimento
- Tela: Agenda, Semana  ·  1440
- O que acontece: o topo continuava "Domingo, 01 de novembro: nenhum atendimento marcado" com a
  semana inteira na tela.
- Correção: na Semana o topo diz "Semana de 02/11 a 08/11: 164 atendimentos" (`agenda.vue`,
  `rotuloDoTopo`, `fraseDaSemana`; chave `clinico.agenda.semanaDeAte` nos 6 idiomas).
- Conferido: 1440, claro.

### C-07 · Faltas a justificar fora do selo de Pendências (C-21) · Confunde
- Tela: menu "Pendências" e abas de `/veterinario/atividades`  ·  todas
- O que acontece: a aba Faltas era a única sem número, embora o topo dela diga "15 pacientes com
  falta sem motivo"; e a tela abria em "Reincidentes" (8 pacientes, sem o Açaí) enquanto a frase
  mandava começar pelo Açaí.
- Decisão (direção recomendada): entram. Contam **pacientes** com falta sem motivo, a mesma régua do
  recorte "A justificar" e da frase do topo, em tom de atenção (ligação a fazer, ninguém esperando
  do outro lado). A tela abre em "A justificar", que é o que o selo conta.
- Correção: contador `faltas` em `useClinicoPendencias.ts` (com teste), rota
  `/veterinario/faltas` em `contagemPorRota` (`src/composables/useAppNavigation.ts`, uma entrada),
  chave `clinico.navegacao.selo.faltas` nos 6 idiomas, `faltas.vue` abre em `pendentes`.
- Conferido: 1440, claro: "Pendências 36" = Atividades 12 + Faltas 15 + Vacinas 6 + Tratamentos 1 +
  Estoque 2; em es, "Ausencias 15" com o título "15 pacientes con faltas sin motivo". Justificar
  uma falta refaz a contagem (`invalidarTudo`).
- Ficou de fora: a lista "O que pede ação" do Início não ganhou linha de faltas (é tela da casca,
  como o Estoque, que também não está lá).

### C-08 · Selo "Reincidente" passava por cima da coluna de faltas · Polimento
- Tela: Faltas, recorte "A justificar"  ·  1440
- O que acontece: com o nome longo ("Maximiliano Bartholomeu…"), o selo encostava no número de
  faltas da coluna ao lado (o nome não cede e o selo não quebrava).
- Correção: sem lugar, o selo desce para baixo do nome (`ClinicPacienteCelula.vue`,
  `.paciente__linha` com `flex-wrap`). Vale para Pacientes e Vacinas, que usam a mesma célula.
- Conferido: 1440 e 768, claro: nenhuma linha passa da célula; sem rolagem lateral.

### C-09 · A página pública mostrava outra clínica (C-14) · Confunde
- Tela: `/agendar/<slug>` e "Link da clínica" em Pedidos  ·  1440
- O que acontece: a conta é a "Aurora Clínica e Hotel Veterinário"; o link era
  `/agendar/petjourney-vila-madalena` e a página dizia "PetJourney Clínica Veterinária".
- Decisão: a demonstração toma o nome da empresa da conta, o mesmo que a barra do portal guarda
  (`petjourney-parceiro-nome`, gravado pela store do parceiro e mantido depois de sair, por isso a
  página aberta sem sessão também o encontra). O endereço segue o da demonstração. O link antigo
  continua abrindo, para não quebrar o que já foi divulgado nem a captura da apresentação.
- Correção: `data/identidade-da-conta.ts` (novo), `seed.ts` (nome da clínica), `seed-pedidos.ts`
  (`slugDaClinica`), `pages/agendar/[clinica].vue` (aceita o slug antigo).
- Conferido: 1440, claro: link `/agendar/aurora-clinica-e-hotel-veterinario`; a página abre com
  "Aurora Clínica e Hotel Veterinário"; `/agendar/petjourney-vila-madalena` também.
- Efeito para a frente Veterinário: cabeçalhos de documento passam a sair com o nome da Aurora.

### C-10 · Travessão longo no endereço da clínica · Polimento
- Tela: página pública (e o endereço em documentos)  ·  todas
- O que acontece: "Rua das Acácias, 421", travessão longo, "Vila Madalena".
- Correção: vírgula no lugar (`data/fixtures/clinic.ts`).
- Conferido: 1440: "Rua das Acácias, 421, Vila Madalena, São Paulo/SP · CEP 05435-020".

### C-11 · "Marcar 08:00" sem dizer o dia, num pedido de quatro dias · Confunde
- Tela: Pedidos, Tobias ("30/10 a 02/11 · Manhã")  ·  1440 e 1024
- O que acontece: o botão cheio dizia "Marcar 08:00" para uma janela de quatro dias.
- Correção: quando o dia da sugestão não é o dia pedido, o botão leva o dia: "Marcar sex. 08:00",
  com a data inteira no `title`; a coluna dos botões foi de 15 para 17 rem para caber ao lado de
  "Responder" (`PedidoLinha.vue`, `acaoPrincipal`).
- Conferido: 1440 e 1024, claro: nenhum botão cortado (largura de conteúdo igual à visível).

### C-12 · "Ver como o responsável pede" em texto solto sobre a faixa, a 3,8:1 · Incomoda
- Tela: Pedidos, topo  ·  todas
- O que acontece: botão transparente, tinta #1D3557 sobre a faixa sálvia #76938D: 3,76:1, abaixo de
  4,5; os dois vizinhos são botões cheios.
- Correção: contorno, como os vizinhos (`veterinario/pedidos.vue`).
- Conferido: 1024, claro: três botões iguais no topo.

### C-13 · Gaveta do atendimento com rolagem lateral · Incomoda
- Tela: Agenda, gaveta do Chico (10:30)  ·  1440
- O que acontece: o conflito "Sobrepõe Maximiliano Bartholomeu von Schnauzerhausen III, das 09:45:
  20 min em comum." ficava numa linha só de 613 px, numa gaveta de 340: barra de rolagem lateral e
  fim da frase fora da vista.
- Correção: na gaveta, o selo do conflito quebra em linhas (`AgendaAppointmentDrawer.vue`,
  `.drawer__avisos`).
- Conferido: 1440, claro: largura de conteúdo igual à da gaveta (328/328), três avisos legíveis.

### C-14 · "Carga do dia sobe para 565 min, acima dos 480 min usuais" · Polimento
- Tela: gaveta e "Novo atendimento"  ·  todas; em ar, "min" em letra latina no meio do árabe
- Correção: os minutos saem pelo formatador de duração: "Carga do dia sobe para 9 h 25 min, acima
  das 8 h usuais." (`useClinicFormat.ts`, `conflito`; `clinico.conflitos.over-capacity` nos 6
  idiomas).
- Conferido: 1440, pt.

### C-15 · Bloquear horário abria em cima do almoço · Confunde
- Tela: Agenda, "Bloquear horário" (tecla B)  ·  todas
- O que acontece: abria sempre "Reunião, 12:00 às 13:00, clínica inteira": exatamente o almoço que
  já existe, e no passado para quem bloqueia à tarde.
- Correção: abre na próxima meia hora sem bloqueio da clínica (ou do profissional escolhido), com
  uma hora de duração, dentro do expediente (`AgendaBloquearDialog.vue`, `janelaInicial`).
- Conferido: 1440, claro, 10:40: abre 11:00 às 12:00; ao bloquear, "Horário bloqueado: 11:00 às
  12:00." e o bloqueio entra na grade.

### C-16 · "Esperando há 0 min" no Hoje · Polimento
- Tela: Hoje, "Quem vem depois" e o cartão do paciente  ·  todas
- O que acontece: o Simba, que chegou agora, aparecia "Esperando há 0 min" ao lado de "esperando
  agora" na lista "O que pede ação".
- Correção: no primeiro minuto, "Chegou agora" (e "Entrou agora" para quem acabou de entrar na
  sala) (`MeuDiaFoco.vue`, `tempoDesde`; chaves `clinico.meuDia.estado.esperaAgora` e `salaAgora`
  nos 6 idiomas).
- Conferido: 1440, claro: "Esperando há 7 min | Chegou agora".

### C-17 · Estoque: "13 aplicadas · 1 perdidas" · Polimento
- Tela: Estoque, "Lotes na geladeira"  ·  pt e es
- Correção: frase sem plural: "aplicadas: 13 · perdidas: 1" (`clinico.vacinas.estoque.saidas`, pt
  e es; en, sr e ar já não tinham o problema).
- Conferido: 1440, pt.

### C-18 · Estoque: data do lote sem ano ("recebido em 03/12") · Confunde
- Tela: Estoque, "Lotes na geladeira"  ·  todas
- O que acontece: em outubro de 2026, "recebido em 03/12" e "recebido em 04/09" (de 2025) liam como
  dezembro que vem; a validade "26/02" também não dizia o ano.
- Correção: com o ano quando não é deste ano (`estoque.vue`, `dataDoLote`).
- Conferido: 1440, claro: "recebido em 03/12/2025", "recebido em 12/04" (deste ano).

### C-19 · Remarcar para outro dia (C-11 da rodada anterior) · Confunde
- Não corrigido: não é pequeno. Pede ação nova na gaveta, com calendário, horários livres do dia
  escolhido, mensagem ao responsável e o `mover` para outra data; o diálogo de reagendar que existe
  é o da falta (textos de falta, cria outro atendimento em vez de mover). Ver Propostas.

### C-20 · Demonstração com volume impossível por paciente · Confunde
- Tela: ficha da Açaí, Agenda, Relatórios  ·  todas
- O que acontece: a Açaí (canina) tem "Ver todos os agendados (27)" e 21 atendimentos só em
  outubro, com duas cirurgias de disco em três dias com cirurgiões diferentes; no dia, o Thor tem
  quatro atendimentos e o Maximiliano três (dois banhos); o Bidu falta à cirurgia das 08:15 e tem
  retorno finalizado às 10:15. São 29 pacientes para mais de 30 atendimentos por dia.
- Por que pesa para quem usa: um profissional lê a ficha e conclui que os dados são inventados.
- Não corrigido: é a geração da semente (`seed.ts`, `preencherDia` e o dia âncora); limitar por
  paciente esvazia a agenda e mexe nos testes de fumaça. Proposta: mais pacientes de fundo (sem
  ficha rica) e no máximo um atendimento por paciente a cada 7 dias fora dos casos plantados.

### C-21 · Relatórios sem exportação · Incomoda
- Tela: `/veterinario/resumo`  ·  todas
- O que acontece: a gerente fecha o mês e não tem como levar os números (nem CSV, nem PDF).
- Não corrigido: funcionalidade nova. Ver Propostas.

### C-22 · Agenda com a gaveta aberta em 1440: nomes viram "Chi…", "Pé…" · Incomoda
- Tela: Agenda (Tabela) com um atendimento aberto  ·  1440
- O que acontece: cinco colunas em cerca de 650 px; o nome do paciente fica com duas ou três letras
  ao lado de "+2".
- Não corrigido: é a mesma proposta da rodada anterior (escolher quais profissionais aparecem, ou
  recolher a coluna menos usada quando a gaveta abre).

### C-23 · Finados (02/11) não é feriado na demonstração · Polimento
- Tela: Agenda, segunda 02/11  ·  todas
- O que acontece: 34 atendimentos no Dia de Finados, feriado nacional; também falta o 20/11.
- Correção (fechamento): `feriadosDoAno` ganhou Finados (02/11) e Consciência Negra (20/11)
  (`src/features/clinico/data/seed.ts:539`), e os atendimentos de fundo pulam todo feriado fechado,
  inclusive o "Feriado municipal" do caso "dia fechado", que tinha 24 atendimentos com "Clínica
  fechada" (`seed.ts:2806`). Cada dia tem o seu sorteio; o dia âncora não passa por esse laço. Os
  números do histórico mudam um pouco (o 12/10, Nossa Senhora Aparecida, também ficou sem
  atendimento, e o sorteio de situação é sequencial).
- Conferido: 1440, Agenda de 02/11: "Clínica fechada / É Finados. Ainda é possível marcar, com
  confirmação." e "nenhum atendimento marcado"; a fita da semana mostra 0 em seg. 2 e sáb. 7.
  Testes de `src/features/clinico` passando.
- Visto de passagem: na fita da semana, domingo fechado mostra "–" e feriado fechado mostra "0"
  (`AgendaToolbar.vue`, `fechado` vem de `capacidadeDoDia`, que só olha o horário da semana). Não
  mexi: a capacidade também alimenta ocupação e conflitos.

### C-24 · "há 41 h" na coluna "Última" de Faltas · Polimento
- Tela: Faltas  ·  todas
- O que acontece: abaixo de 48 h o formatador fala em horas ("há 41 h", "há 18 h").
- Correção (fechamento): a coluna "Última" escreve dia da semana e data no formato do idioma
  ("qui., 29/10"; com o ano só fora do ano corrente), por um formatador novo `diaEData`
  (`src/features/clinico/composables/useClinicFormat.ts:166`, usado em
  `src/pages/(accounts)/veterinario/faltas.vue:716`). `distancia` e `relativo` não mudaram; a
  ordenação continua pelo instante real.
- Conferido: 1440 em pt ("qui., 29/10", "sex., 23/10", "qua., 21/10") e em ar ("الخميس، 29/10", a
  mesma ordem dia/mês do `dataCurta` do resto da Clínica), cabendo na coluna de 7,5rem.

### C-25 · Pequenos, vistos de passagem · Polimento
- "Carregando..." de toda tela da Clínica é um cartão estreito centralizado, sem a faixa do título
  (`UiPagina`, componente compartilhado; não mexi).
- Na busca do Select de paciente o leitor de tela anuncia "1 resultados disponíveis" (texto do
  PrimeVue; o plural sai da configuração de idioma do PrimeVue).
- Na página pública o link antigo `petjourney-vila-madalena` abre a mesma clínica (de propósito,
  C-09); quando a demonstração for embora, apagar `SLUG_DA_CLINICA` do `[clinica].vue`.
- Em ar, "الحجز الساعة {hora}" do botão de pedido fica "الحجز الساعة الجمعة 08:00" quando leva o dia;
  legível, mas vale revisar com quem fala árabe.

## Não corrigido

- **C-19 Remarcar para outro dia.** Proposta: ação "Remarcar" na gaveta do atendimento que abre
  uma gaveta à direita com `DatePicker` inline (dias sem vaga desabilitados), os horários livres do
  dia escolhido (`buscarAlternativas`), a mensagem ao responsável (reaproveitando a do reagendar) e
  `agenda.mover` com a nova data, com a barra de desfazer.
- **C-20 Volume da demonstração.** Ver o achado: mais pacientes de fundo e limite por paciente.
- **C-21 Exportar relatórios.** Proposta: "Exportar" no topo de Relatórios com CSV do período e do
  filtro (movimento por dia, por tipo, por profissional, faltas), no mesmo formato de data da tela.
- **C-22 Agenda estreita com a gaveta.** Proposta já anotada em 27/10.
- **C-25.** Ver o achado. (C-23 e C-24 foram corrigidos no fechamento.)

## Para a frente Veterinário

- Diagnóstico de outra espécie no histórico: a Açaí (canina) tem "Cistite idiopática felina" em
  26/10, e os Relatórios listam "Cistite idiopática felina 6". A semente sorteia o diagnóstico do
  catálogo inteiro (`seed.ts`, `encounterPreenchido`, só a cirurgia filtra).
- Travessão longo no catálogo de diagnósticos: "Doença renal crônica", travessão, "estágio 2"
  (`data/fixtures/catalogs.ts` e as traduções em `catalog-text.ts`); aparece na ficha e nos
  Relatórios.
- O nome da clínica nos documentos agora é o da conta (C-09) e o endereço perdeu o travessão
  (C-10): conferir as capturas de receita e atestado.
- O texto de carga do conflito mudou para horas (C-14).

## Para a frente Hotel

- `/reservar` segue com "PetJourney Hotel"; o mesmo caminho do C-09 (`identidade-da-conta.ts`)
  serve para o hotel.
- `hotel/pedidos.vue:429` tem o mesmo "Ver como o responsável pede" em texto solto (C-12).

## Fora do portal

- Nada nesta frente: Clínica e página pública rodam com a semente no front. As chamadas de rede
  vistas foram só as da casca (todas 200). Nenhum erro de console nas telas da Clínica.

## Dados criados (somem ao recarregar)

- Bloqueio "Reunião" da clínica inteira, quinta 29/10, 11:00 às 12:00 (para conferir o C-15).

## Verificação final

- `npx vitest run src/features/clinico src/pages src/components/home src/composables
  src/navegacao`: 78 arquivos, 1062 testes, todos passam (inclui os três testes novos).
- `npm run type-check`: sem erros.
- `npm run check:i18n`: paridade OK. Chaves novas: `clinico.agenda.fechadaSemNada`, `irParaDia`,
  `semanaDeAte`, `clinico.navegacao.selo.faltas`, `clinico.meuDia.estado.esperaAgora`, `salaAgora`;
  mudadas: `clinico.conflitos.over-capacity` (6), `clinico.vacinas.estoque.saidas` (pt, es).
- `node scripts/lint-copy.mjs src/locales`: ok.
- `npx oxlint` e `npx eslint` nos 25 arquivos tocados: código 0.
- Prettier: conferido só nos arquivos que já estavam formatados no HEAD e não são compartilhados;
  todos continuam formatados. O arquivo novo `identidade-da-conta.ts` também.
- Arquivos tocados: `AgendaCriarDialog.vue`, `AgendaTabelaDia.vue`, `AgendaBloquearDialog.vue`,
  `AgendaAppointmentDrawer.vue`, `base/ClinicPacienteCelula.vue`, `meu-dia/MeuDiaFoco.vue`,
  `pedidos/PedidoLinha.vue`, `composables/{useClinicoPendencias,useMeuDia,useClinicFormat}.ts`,
  `data/{identidade-da-conta (novo),seed,seed-pedidos}.ts`, `data/fixtures/clinic.ts`,
  `domain/{load,resumo}.ts` (+ 3 specs), `pages/(accounts)/veterinario/{agenda,faltas,estoque,pedidos}.vue`,
  `pages/agendar/[clinica].vue`. Compartilhados: `src/locales/*.json` (6) e uma entrada em
  `src/composables/useAppNavigation.ts`.
