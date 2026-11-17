# Usabilidade do módulo Clínica: análise e plano

Feita em 15 e 16/11/2026, a pedido do Luís, depois de os usuários reclamarem que a plataforma é
difícil de usar. O visual (cores, tipografia, tema) está aprovado e não é assunto daqui. O assunto é
**layout, navegação, organização do conteúdo e da informação**.

- **Como foi feita.** Três frentes independentes, sem uma ver o trabalho da outra:
  [recepção e gestão](frentes/recepcao.md) (casca, Hoje, Agenda, Pedidos, Fila, Pacientes, cadastro,
  ficha, Pendências, Configuração), [clínico](frentes/clinico.md) (prontuário, ficha clínica, bulário,
  internação, vacinas, tratamentos, estoque, cópias, relatórios) e [o que se mede no código](frentes/codigo.md)
  (tamanho das telas, níveis de aba, gavetas, botões, vocabulário, rotas sem entrada).
- **O que foi olhado.** As telas que o usuário real vê (as da API, em `src/components/<área>/`), com a
  conta de QA `portal-demo` na API de dev, em 1440x900 e 1024x768. Dezoito tarefas do dia a dia foram
  percorridas clique a clique. Nada foi gravado na API.
- **Limites.** Hoje (16/11) a agenda estava vazia: o dia cheio do Hoje foi lido no código. Não havia
  internado ativo nem pedido pendente: esses fluxos foram lidos no código e na internação encerrada do
  Fubá. O catálogo de remédios do dev tem 2 itens. Só o perfil de dona foi visto.

## 1. O resultado em uma página

**Nota de usabilidade (heurísticas de Nielsen, 0 a 4 cada): 18 de 40.** Na faixa em que "as partes
funcionam, mas o conjunto cansa". Não há uma tela quebrada que explique as reclamações; há uma soma:
cada tarefa do dia esbarra em dois ou três tropeços.

| # | Heurística | Recepção | Clínico | O que pesa |
|---|---|---|---|---|
| 1 | O sistema diz o que está acontecendo | 2 | 3 | Cinco lugares contam "pendências" com cinco números; a agenda não mostra "agora" |
| 2 | Fala a língua de quem trabalha | 2 | 2 | "Fila de espera" não é a sala de espera; "Atividades"; "Atendimento avulso"; Estoque dentro de Pendências |
| 3 | Dá para voltar e desfazer | 2 | 2 | Ficha sem volta; abrir a consulta anterior tira do rascunho; escritas de um toque sem desfazer |
| 4 | Mesma coisa, mesmo jeito | 1 | 2 | Título muda de regra a cada aba; filtro muda de lugar; quatro nomes para "remarcar" |
| 5 | Evita o erro antes | 2 | 1 | **Alergia não aparece no prontuário nem na receita**; marcar em dia passado; hora digitada sem ver vagas |
| 6 | Mostra em vez de fazer lembrar | 1 | 1 | Sem busca; gaveta do horário sem telefone; nome do paciente some ao rolar |
| 7 | Atalhos para quem tem pressa | 1 | 2 | Sem "Novo" e sem busca fora da demonstração; ficha não marca horário |
| 8 | Só o necessário na tela | 2 | 2 | Faixa verde leva 174 a 359 px; ficha com 10 seções abertas; cadastro com 27 campos |
| 9 | Erro que se entende e se resolve | 2 | 2 | Cadastro falha em silêncio; "Nenhum resultado" sem saída |
| 10 | Ajuda na hora | 2 | 2 | As frases sob os títulos ajudam; falta legenda na agenda |
| | **Total** | **17** | **19** | |

**Carga mental:** falham 5 dos 8 itens nas duas frentes (foco único, blocos de até 4, poucas escolhas,
memória de trabalho, hierarquia). Pontos com mais de 4 escolhas à vista: menu (22 linhas), abas de
Pendências (6), ficha (~30 botões), cadastro (27 campos), tipo de documento (9).

### As sete causas

1. **O balcão não tem caminho contínuo.** Buscar, cadastrar, marcar e remarcar são quatro telas que
   não se passam o bastão. Cliente novo com consulta custa ~18 cliques, 3 telas e o nome do pet digitado
   3 vezes. A busca (Ctrl K) e o botão "Criar" que costuravam isso só existem no modo demonstração.
2. **O menu agrupa por tipo de lista, não por trabalho.** Prontuários e Bulário são abas de
   "Pacientes"; Vacinas e Estoque são abas de "Pendências"; Boletins pendentes e Vagas da internação
   não têm nenhuma entrada. Há até 3 níveis de seletor (destino, aba, recorte), cada um com regra própria.
3. **A casca gasta o espaço do trabalho.** Barra de 272 px em qualquer largura, faixa verde de 174 px
   (359 no Hoje em 1024) e menu de 1.262 px em 655 visíveis, sem aviso de que continua. Em 1024x768,
   metade da tela passa antes da primeira linha útil.
4. **A informação do paciente não o acompanha.** Alerta, peso, idade, responsável e telefone aparecem
   na ficha e somem no prontuário, na receita, na gaveta do horário, em Retornos e em Faltas, que é
   justamente onde se decide ou se liga.
5. **"Pendente" não tem uma fonte só.** Início diz "2 assuntos urgentes" ao lado de "Nada parado
   agora"; Hoje diz 1; o selo de Pacientes diz 5; Pendências não tem selo; Avisos, 29.
6. **Telas que servem todos os papéis ao mesmo tempo.** Ficha (10 seções, 12 ações, até 5 botões
   principais), Hoje e Pendências misturam recepção, veterinária e gestão; cada um atravessa o que é do
   outro.
7. **Nomes instáveis.** Horário / atendimento / consulta / agendamento; paciente / pet / animal;
   responsável / cliente; mudar horário / reagendar / remarcar; dezesseis verbos de "fim".

### O que precisa de atenção antes do resto

- **Alergia fora do prontuário (segurança clínica).** A Mel tem "Alergia · Risco · Dipirona" na ficha.
  O atendimento dela não mostra isso no cabeçalho nem na gaveta "Prescrever"; o servidor só avisa depois
  do Salvar. Na própria ficha, "Alertas: Alergia" convive com "Alergias: Nenhuma registrada" (uma é da
  clínica, a outra vem do app). Conferido no código: `AtendimentoDaClinica.vue` não cita alerta.
- **Tratamentos em casa abre com erro** ("parceiroPeloToken is not defined"), o mesmo do guia de 09/11.
- **Horas que não batem entre telas** (a mesma consulta 17:53 na lista e 19:00 no prontuário): provável
  fuso. Não é layout, mas mina a confiança.

### O que já funciona (e fica)

- Gaveta lateral em todo formulário (67 gavetas, nenhum formulário em diálogo no meio).
- "Tudo salvo" e o "Falta para finalizar · Ir para" do prontuário; o conflito de horário com
  alternativas; o desfazer da agenda.
- URL por aba e por filtro; botão principal branco no canto da faixa, sempre no mesmo lugar.
- Pedidos, Pacientes (lista), Importar e Cópias: nota 4 de 5, só ajustes.

## 2. Nota por tela

| Tela | Nota (1 a 5) | O que mais dói |
|---|---|---|
| Casca e navegação | 2 | Sem busca nem "Novo"; menu não cabe; abas por tipo de lista; título sem regra |
| Agenda | 2 | Abre às 07:00 e não em "agora"; sem busca por nome; gaveta sem telefone; remarcar escondido e sem ver vagas |
| Cadastro novo | 2 | 27 campos; erro fora da vista; responsável depois do pet |
| Ficha do paciente | 2 (1 em 1024) | 10 seções para todos os papéis; contato no fim; não marca horário; alergia contraditória |
| Atendimento (prontuário) | 2 | Sem alerta; nada fixo ao rolar; consulta anterior tira do rascunho; finalizado é formulário apagado |
| Tratamentos em casa | 2 | Abre com erro |
| Pendências (Atividades, Faltas, Retornos) | 2,5 | Faltas abre num recorte vazio; "Marcar" grava sem mostrar; contagens divergentes |
| Hoje | 3 (2 para a recepção) | É a tela da veterinária; o botão principal não inicia o atendimento |
| Internação | 3 (mapa 4, detalhe 2) | Duas telas sem entrada; checklist do plantão é um link pequeno; "Estado" antes do que fazer |
| Vacinas | 3 | Lista de chamada sem ação na linha |
| Estoque | 3 | Escondido em Pendências; validade no fim da análise |
| Relatórios | 3 | 4 atendimentos no subtítulo, 16 nos quadros; sem "este mês" |
| Atendimentos (lista) | 3 | Aba de Pacientes; sem busca nem período |
| Bulário | 3 | Sem atalho a partir do prontuário |
| Fila de espera | 3 | O nome leva ao lugar errado |
| Configuração | 3 | A configuração da agenda está em três lugares |
| Correções | 3 | Título "Pacientes"; "Resolver" grava no clique |
| Pacientes (lista) | 4 | Busca não vai para a URL; linha sem próximo horário |
| Pedidos | 4 | O botão em destaque é configuração |
| Cópias do prontuário | 4 | O vencido é o último da lista |
| Importar | 4 | Polimento |

## 3. O plano, tela por tela

Uma tela por vez. Cada uma é redesenhada, conferida no navegador (claro e escuro, 1440 e 1024),
mostrada com antes e depois, e **espera a aprovação** antes da seguinte. A tela de login não entra.

A ordem começa pela moldura (vale para todas as telas), segue o caminho do balcão e depois o do
consultório. O que é mais usado e mais dói vem antes.

| # | Tela | O que muda | Situação |
|---|---|---|---|
| 1 | **Navegação do módulo** | Menu por trabalho, abas com nome que diz o que tem dentro, uma regra de título, cabeçalho numa linha, menu que cabe e recolhe sozinho no tablet | **Feita, esperando aprovação** (ver §4; menu em seções e formatos de layout em §5) |
| 2 | **Busca e "Novo" em qualquer tela** | Busca por pet, responsável ou telefone pela API (Ctrl K), com "Abrir ficha" e "Marcar horário"; "Novo": horário, paciente, lista de espera | A fazer |
| 3 | **Agenda** | Abre no "agora"; busca por nome; cartão com tipo e situação em texto; gaveta com telefone, alerta e "Iniciar atendimento" à vista; "Remarcar" com as vagas; cadastro rápido dentro do marcar | A fazer |
| 4 | **Cadastro novo** | Dois passos (responsável, depois o pet), só o obrigatório, erro à vista, idade aproximada | A fazer |
| 5 | **Ficha do paciente** | Cabeçalho com alertas, responsável, telefone e ações (marcar, atender, vacinar, documento); abas "Resumo", "Clínico" e "Cadastro"; uma lista só de alergias | A fazer |
| 6 | **Atendimento (prontuário)** | Barra fixa com paciente, alertas, seções e Finalizar; histórico numa gaveta; finalizado como folha de leitura; "Saída da consulta" num lugar só; receita com peso, alergia e dose | A fazer |
| 7 | **Hoje** | Visão por papel (recepção x consultório); o botão principal inicia o atendimento; lembra a escolha | A fazer |
| 8 | **Pendências** e contagens | "Visão geral" com um número só, igual no Início, no Hoje e nos selos; Faltas abre no que há para fazer; Retornos com telefone e horário à vista; Avisos com nome e link | A fazer |
| 9 | **Internação** | Detalhe: o que fazer agora primeiro, estado no cabeçalho, alvos de toque; internar sem ser pelo leito | A fazer |
| 10 | **Vacinas e Estoque** | Ação na linha da lista de chamada; validade em destaque | A fazer |
| 11 | **Relatórios** | Marcados, concluídos e faltas como indicadores; "Este mês" | A fazer |
| 12 | **Configuração** | Horários, feriados e agendamento online com entrada aqui | A fazer |
| 13 | Ajustes menores | Pacientes (lista), Pedidos, Lista de espera, Correções, Cópias, Atendimentos (lista), Bulário, Importar | A fazer |
| — | Fora da fila | Tratamentos em casa abria com erro: faltava um `import` em `adesao-service.ts` (o commit 8faf265 deixou o `develop` sem passar no type-check). **Corrigido junto, em alteração separada.** Horas divergentes (fuso): a ver | Erro corrigido; fuso em aberto |

## 4. Tela 1: navegação do módulo

### O menu, antes e depois

| Antes | Depois |
|---|---|
| Hoje | Hoje |
| Agenda: Agenda · Pedidos · Fila de espera | Agenda: **Calendário** · Pedidos · **Lista de espera** |
| Pacientes: Pacientes · Correções · Atendimentos · Bulário · Cópias | Pacientes: **Cadastros** · Correções |
| | **Prontuários** (novo): Atendimentos · Cópias · Bulário |
| Internação (sem abas; Plantão por um link; Boletins e Vagas sem entrada) | Internação: **Mapa · Plantão · Boletins** (e **Vagas** para quem não lê o mapa, como a recepção) |
| | **Vacinas** (novo): Reforços · Estoque |
| Pendências: Atividades · Faltas · Retornos · Vacinas · Tratamentos em casa · Estoque de vacinas | Pendências: **Visão geral** · Faltas · Retornos · Tratamentos em casa |
| Relatórios | Relatórios |
| Configuração | Configuração |

Por quê:

- **Prontuário não é "paciente".** A veterinária procura "prontuários"; a recepção, que não lê
  prontuário, deixa de ver três abas que não eram dela.
- **Estoque e vacinas aplicadas não são pendência.** Vacinas ganha porta própria, com o estoque ao lado.
- **A internação tem quatro perguntas** (quem está onde, o que fazer agora, a quem avisar, tem vaga) e
  só uma tinha porta. Boletins e Vagas, que a recepção usa, voltam a ter entrada.
- **Nenhum destino passa de 4 abas**, então a fileira cabe em 1024 sem rolar de lado.
- **O selo de cada destino passa a dizer a verdade:** o "5" de Pacientes era rascunho de prontuário
  mais pedido de cópia; agora aparece em Prontuários.
- As URLs não mudaram: favorito, link salvo e aviso continuam abrindo a mesma tela.

### O resto

- **Uma regra de título:** o título é sempre o destino aceso no menu; a aba diz a tela; a frase embaixo
  diz o estado.
- **Cabeçalho numa linha:** título, abas e ações lado a lado quando cabem; a faixa cai de 174 para
  109 px (80 sem a frase de estado). Se apertar, as abas ficam só com o nome; se ainda assim não
  couber, descem para a linha de baixo, como antes. Medido: na Agenda em 1024x768 a primeira hora da
  grade subiu de 385 para 269 px.
- **Menu que cabe:** linha de 40 px no lugar de 52 (44 no toque); só o espaço em uso nasce aberto, os
  outros ficam numa linha com o selo (um clique abre, e a escolha fica lembrada). Em 1440x900 o menu
  inteiro aparece sem rolar. Onde ainda rola (tela baixa), o lado que continua esmaece.
- **Tablet:** abaixo de 1280 px a barra nasce recolhida em ícones (70 px no lugar de 272); o botão de
  sempre a expande. Quem já escolheu densidade ou largura em Configurações › Aparência continua com
  a escolha.
- **Plantão sem "voltar":** virou aba, ao lado do mapa.
- **O prontuário aberto acende "Prontuários"** no menu (antes acendia "Pacientes").
- **Bulário (pedido do Luís em 16/11):** o conteúdo dos dois cartões tinha um recuo a mais que o
  título (16 e 18 px, sobra do cartão antigo sem respiro) e encostava no fio do cabeçalho; os filtros
  cortavam "Todas as esp…". Agora tudo alinha com o título, há 16 px depois do fio, a busca tem a lupa
  (como em Pacientes), lista e ficha dividem a largura (os filtros cabem lado a lado em 1440 e descem
  um embaixo do outro em 1280), o selo ("Da clínica", "Controlado") vai na linha do nome também na
  ficha, as listas de indicações ganharam marcador alinhado ao título e a tabela de doses alinha com a
  régua (o intervalo não quebra mais).

Arquivos: `src/navegacao/espacos.ts`, `src/components/ui/UiPagina.vue`, `UiAbas.vue`,
`src/components/layout/ShellNavegacao.vue`, `moldura-app.css`, `src/composables/useLayoutPreferences.ts`,
`useAppNavigation.ts`, `src/components/internacao/ChecklistDoPlantao.vue`,
`src/components/bulario/BularioDaClinica.vue`, `DoseDoPaciente.vue` e os seis idiomas.

### O que ficou para as próximas telas

Busca e "Novo" (tela 2), contagens e Avisos (tela 8), e a gaveta que empurra a página (entra com a
Agenda, tela 3, que é onde mais atrapalha).

## 5. Tela 1b: o menu em seções e os formatos de layout

Pedido do Luís em 16/11, olhando a barra da tela 1: "muito inflado de conteúdo; seções onde o usuário
olhe e já saiba o que vai ter dentro; formatos de layout para a barra e o cabeçalho, porque cada
pessoa tem uma preferência".

### Seções com título

| Espaço | Seções |
|---|---|
| Clínica | **Dia a dia**: Hoje, Agenda, Pendências · **Atendimento**: Pacientes, Prontuários, Internação, Vacinas · **Gestão**: Relatórios, Configuração |
| Hotel | **Dia a dia**: Hoje, Reservas · **Gestão**: A casa, Relatórios |
| Portal | **Parceria**: Programas, Divulgação, Indicados · **Clientes**: Acessos · **Empresa**: Carteira, Equipe, Estabelecimento |

Pendências subiu para o lado do Hoje e da Agenda: é trabalho do dia, não fim de lista. Seção sem
tela (permissão, módulo desligado) some; espaço de uma seção só não repete o título. Só de ícones, o
título vira um fio curto entre os grupos.

### Quatro formatos, de cada pessoa

Em Configurações › Aparência (com a miniatura de cada um) e no menu da conta (troca em um clique):

| Formato | Como fica |
|---|---|
| **Seções** (padrão) | Barra lateral com as telas agrupadas; linha de 38 px (44 no toque), ícone solto, sem o quadradinho de 40 px que dava a cada linha o peso de um cartão. Recolhe sozinha em ícones abaixo de 1280 px (dá para desligar). |
| **Ladrilhos** | O desenho de antes (quadradinho em cada tela, guia), agora com os títulos das seções. A altura das linhas só vale aqui. |
| **Só ícones** | A coluna estreita, com os fios entre os grupos; o nome no `title`. É o mesmo que o botão de recolher da barra. |
| **Menu no alto** | Sem barra lateral: faixa branca com a empresa, Início, um botão por espaço e, à direita, pendência, avisos e conta. Cada espaço abre um painel com as seções lado a lado, e cada tela mostra embaixo o nome das abas ("Calendário · Pedidos · Lista de espera"). Até 900 px vira a gaveta de sempre. |

Medido: no formato Seções, o menu da Clínica inteira cabe em 1440x900 sem rolar (663 de 663 px).
A preferência é deste navegador (`petjourney-navigator-layout` e `petjourney-navigator-style`); quem
tinha escolhido Ladrilhos compactos continua com a altura que escolheu. "Todos abertos" passou a se
chamar "Você escolhe", que é o que ele faz desde a tela 1.

**Abrir e recolher em todos os formatos** (pedido do Luís, 16/11): o título de cada espaço (Clínica,
Hotel, Portal) virou sempre o botão de abrir e recolher, também na barra só de ícones. Antes, no modo
"Só o da tela" e na barra de ícones, o título era um link para o espaço, e a seta ao lado do nome
não recolhia nada. "Espaços na barra" agora escolhe só o jeito:

- **Um de cada vez** (era "Só o da tela"): abrir um espaço recolhe o que estava aberto, e ir para uma
  tela abre o espaço dela. Nada fica guardado.
- **Você escolhe** (padrão): quantos quiser abertos ao mesmo tempo, e a barra lembra como ficou.

No Menu no alto cada espaço já abre e fecha o painel dele pelo próprio botão, com a seta.

Arquivos: `src/navegacao/espacos.ts` (seções), `src/components/layout/ShellNavegacao.vue`,
`ShellTopo.vue` (novo), `AppShell.vue`, `ShellConta.vue`, `moldura-app.css`,
`src/composables/useLayoutPreferences.ts`, `src/components/settings/SettingsAparenciaPanel.vue`,
`SettingsLayoutMockup.vue`, os seis idiomas e os testes (`espacos.spec.ts`,
`useLayoutPreferences.spec.ts`).

## 6. Ações rápidas no Início

Pedido do Luís em 16/11, com duas referências: primeiro uma lista de botões ("Novo responsável",
"Nova consulta"…), depois o desenho que ficou, de blocos coloridos lado a lado ("Crie algo novo").

Seis ações, só com o que o portal já faz. Cada uma abre o formulário que já existe, na tela dona
dele, por um pedido na URL que a tela atende e tira (recarregar não reabre):

| Ação | Para onde vai | Quem vê |
|---|---|---|
| Novo paciente | Pacientes com `?novo=1`: a gaveta do cadastro em passos abre (§7) | `paciente.escrever` |
| Marcar consulta | Agenda com `?novo=1`: a marcação abre no próximo horário de hoje | `agenda.escrever` |
| Atender agora | Escolhe o paciente e abre o atendimento avulso (o mesmo da ficha) | `prontuario.escrever` |
| Aplicar vacina | Escolhe o paciente; a ficha abre com `?aplicar=vacina`, rola até Vacinas e abre a gaveta | `vacina.aplicar` |
| Lista de espera | Lista de espera com `?adicionar=1`: a gaveta de pôr na fila abre | `fila.gerir` |
| Novo acesso temporário | Acessos com `?vincular`: o modal do código abre vazio (já existia). Era "Vincular código"; o nome mudou também no botão e no modal dos Acessos (pedido de 17/11) | tela Acessos no menu |

Todas pedem a Clínica com escrita, menos o código. Com menos de duas ações a seção não aparece.
Desenho: o bloco no pastel da cor da ação (no escuro, a mesma cor funda), com o nome embaixo; dentro,
o ícone da ação num selo claro no canto de cima e o mesmo ícone enorme no fundo, em duotone, saindo
pela borda e girado, como marca-d'água (pedido do Luís: "um ícone maior no background"). Ao passar o
mouse, o ícone de fundo se endireita e cresce um pouco (sem movimento com "reduzir movimento"). Seis
numa linha, três quando a página encolhe (gaveta aberta, tablet). A descrição de cada uma vai para o
leitor de tela, não para o bloco.

Ficou de fora, por não existir hoje sem um atendimento: "Nova receita" (a receita nasce dentro do
atendimento; "Atender agora" leva até ela) e "Novo evento". "Novo responsável" e "Novo animal" são um
cadastro só no portal ("Novo paciente").

Arquivos: `src/components/home/HomeAcoesRapidas.vue` (novo), `src/components/cadastro/EscolherPacienteGaveta.vue`
(novo), `src/pages/(accounts)/inicio.vue`, `AgendaDaClinica.vue`, `FilaDeEspera.vue`,
`VacinasDaFicha.vue` e os seis idiomas.

## 7. Campos de paciente e cadastro em passos

Pedidos do Luís em 17/11.

**A lista aparece ao clicar.** Todo campo que escolhe paciente mostra a lista dos pacientes da clínica
ao receber o clique (ou a seta para baixo, no teclado), sem esperar a digitação; digitando, filtra
como antes. Vale para os campos com lista suspensa (escolher paciente das Ações rápidas, marcar
consulta, lista de espera, internar, pedido de cópia, espera e reserva do Hotel; no acompanhante da
reserva vêm os animais da mesma casa) e para os de lista embaixo (mesclar duplicado, vincular o acesso
a um paciente da casa, responsável no cadastro novo). Sem termo, a API devolve os primeiros 20.

**Cadastro de paciente em gaveta, com passos.** A página `/clinica/paciente/novo` virou uma gaveta
lateral na própria lista de Pacientes, em três passos, um assunto por passo:

1. **Responsável**: cliente da casa (a lista aparece ao clicar na busca) ou cliente novo.
2. **Pet**: nome e espécie (obrigatórios), raça, sexo, castrado.
3. **Detalhes**: nascimento, porte, peso, microchip, pelagem; tudo opcional.

Os passos feitos voltam pelo número; "Continuar" só passa com o passo certo. Erro da API volta ao
passo do campo (CPF de outro cliente: passo 1, com "Usar este cliente"). O X guarda o rascunho,
"Cancelar" descarta. Depois de cadastrar, a ficha do paciente novo, como antes. O endereço antigo
leva até a gaveta (`/clinica/pacientes?novo=1`); na demonstração segue o formulário dela.

Junto: o campo ao lado de um que mostra erro não estica mais (Raça ficava mais alta que Espécie).

Arquivos: `src/components/cadastro/NovoPacienteGaveta.vue` (novo), `useListaAoClicar.ts` (novo),
`PacientesLista.vue`, `PacienteCampos.vue` (prop `parte`), `MesclarGaveta.vue`, `PorAcessoGaveta.vue`,
`src/pages/(accounts)/clinica/paciente/novo.vue`, as gavetas com campo de paciente e os seis idiomas;
`PacienteNovo.vue` saiu.

## 8. Vacinas: a lista de chamada em cartões de vacina

Pedido do Luís em 17/11: "cada pet deveria parecer meio que um cartão de vacina".

A lista de chamada (Vacinas › Reforços) deixou de ser uma linha por vacina e virou um cartão por pet,
como a carteira de vacinação de papel, lado a lado (três por linha em 1440, dois em 1024):

- **Capa**: o verde dos pets com os rabiscos do app, o retrato, "Carteira de vacinação", o nome (leva à
  ficha) e espécie, raça e idade.
- **Picote**: a linha tracejada com os dois cortes em meia-lua, cortados no próprio cartão.
- **Uma linha por vacina**: o nome, a última dose e a próxima em números (07/11/2026), quanto falta
  ("Vence em 19 dias · falta a dose 2") e o **carimbo** da situação, de borda dupla e meio torto:
  Vencida (vermelho), Série aberta (laranja), A vencer (verde). Horário já marcado vira um selo verde.
- **Pé**: o responsável com o telefone formatado (antes vinha 5511988887701) e o botão "Aplicar", que
  abre a ficha já na gaveta de aplicar (só para quem tem `vacina.aplicar`).

A API manda uma linha por vacina, do mais atrasado ao menos; o cartão entra na ordem da vacina mais
atrasada do pet, e as outras vacinas do mesmo pet vão para dentro dele. As Aplicadas seguem em lista.

Arquivos: `src/components/vacinas/VacinasDaClinica.vue` e os seis idiomas.
