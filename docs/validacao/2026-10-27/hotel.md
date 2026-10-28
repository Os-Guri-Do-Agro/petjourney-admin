# Frente Hotel: validação de uso real (27/10/2026)

Persona e roteiro: fui a gerente do hotel e creche da Aurora, cobrindo também a recepção e a equipe de
cuidadores no turno, às vésperas de um fim de semana prolongado com o hotel quase cheio. Percorri
Hoje, Reservas, Reserva online (página pública e Pedidos), Check-in e estadia, Mapa, Acomodações,
Hóspedes, Rotina, Rotina padrão e Resumo, em 1440x900 (principal), 1280, 1024x768 e 768x1024 com
toque, nos temas claro e escuro.

Observação geral (anotada uma vez): o módulo Hotel está mocado no front neste branch; tudo o que se
grava some num recarregamento completo da página.

## Achados

### H-01 · O mesmo animal podia ter duas reservas no mesmo período · Confunde
- Tela: `/hotel/mapa` (Nova reserva) e `/hotel/reserva/<id>`  ·  Largura/tema: todas
- O que acontece: com o Bidu já reservado na Baia A5 de 30/10 a 08/11, criei outra reserva do
  Bidu na Baia A3 de 30/10 a 02/11. Nenhum aviso; a segunda reserva nasceu "Pendente" e passou a
  prender a Baia A3 no feriado.
- Por que pesa para quem usa: no fim de semana prolongado, com o hotel quase cheio, a casa recusa
  outro cliente por uma vaga que ninguém vai ocupar; no dia da entrada aparecem dois check-ins do
  mesmo cão.
- Correção: regra nova no domínio `reservaDoAnimalNoPeriodo` (`src/features/hotel/domain/disponibilidade.ts:118`),
  que vale também para o acompanhante; o repositório recusa em `criar` e `editar` com
  `hotel.erros.vaga.animal-ja-reservado` (`src/features/hotel/data/repositories/reserva-repository.ts`);
  o diálogo mostra logo abaixo do hóspede "Bidu já tem reserva nesse período (Baia A5, 30/10 · 10:00
  → 08/11 · 11:00). Ajuste ou cancele aquela antes de criar outra." e desabilita "Criar reserva"
  (`src/features/hotel/components/reserva/NovaReservaDialog.vue`). Teste novo em
  `src/features/hotel/domain/__tests__/disponibilidade.spec.ts` (3 casos).
- Conferido: 1440x900, claro, pt: a mensagem aparece e o botão fica desabilitado.

### H-02 · Selo do pagamento continuava "Sem sinal" depois de confirmar o sinal · Confunde
- Tela: `/hotel/reserva/<id>`  ·  Largura/tema: todas
- O que acontece: em "Registrar sinal e confirmar", o cabeçalho virou "Confirmada" e a tabela passou a
  mostrar "Já pago −R$ 98,10", mas o selo do bloco Pagamento seguiu "Sem sinal" em laranja.
- Por que pesa para quem usa: a recepção vê duas verdades na mesma tela e cobra o sinal de novo.
- Correção: o repositório devolvia o próprio objeto do conjunto em `abrir`; como as escritas mudam a
  reserva no lugar, a tela reaproveitava o proxy antigo e o `computed` do selo não recalculava. Agora
  devolve uma cópia (`src/features/hotel/data/repositories/reserva-repository.ts`, `abrir`).
- Conferido: 1440x900, claro: depois de registrar o sinal o selo vira "Sinal pago".

### H-03 · "Registrar sinal e confirmar" gravava o sinal sugerido sem perguntar o valor · Confunde
- Tela: `/hotel/reserva/<id>` (reserva pendente)  ·  Largura/tema: todas
- O que acontece: um clique grava R$ 98,10 (o sugerido) e confirma a reserva. Não há onde dizer que
  o responsável pagou R$ 100, ou só R$ 50.
- Por que pesa para quem usa: fica registrado um valor que ninguém recebeu e a conta da saída sai
  errada.
- Correção: o botão abre um popover "Quanto o responsável pagou de sinal", com o valor já no
  sugerido, dica "Sinal sugerido: R$ 98,10" e "Registrar e confirmar"
  (`src/pages/(accounts)/hotel/reserva/[reservaId].vue`, `abrirSinal`/`confirmarSinal`), 6 idiomas.
- Conferido: 1440x900, claro: popover "Quanto o responsável pagou de sinal" com R$ 100,00 na Luna; a reserva vira "Confirmada · Sinal pago", "Já pago −R$ 100,00", saldo R$ 336,00.

### H-04 · Comprovante: "Data da apresentação" e validade sem ano · Confunde
- Tela: `/hotel/reserva/res-zeus` > Registrar (Vacina da tosse dos canis)  ·  Largura/tema: todas
- O que acontece: o diálogo pede "Data da apresentação" (vem com hoje) e mostra em verde "Válido até
  27/10". A validade é calculada a partir dessa data; com o rótulo, a recepção põe o dia de hoje e
  escreve a data da aplicação no campo de texto (foi o que eu fiz: "aplicada em 12/03/2026"). E "27/10"
  é 27/10/2027, mas sem o ano lê como "vence hoje". Na lista ficou "Vale até 27/10 · Em dia".
- Por que pesa para quem usa: a vacina de março ganha sete meses a mais de validade; e uma validade
  certa parece vencida.
- Correção: rótulo "Data da aplicação ou emissão", dica "A que está na carteira ou no documento, não a
  de hoje. A validade conta a partir dela.", calendário não deixa data futura
  (`src/features/hotel/components/reserva/ExigenciaDialog.vue`); formatador novo `validade` mostra o
  ano quando não é o corrente (`src/features/hotel/composables/useHotelFormat.ts`), usado no diálogo e
  na lista de documentos (`ExigenciasLista.vue`). 6 idiomas. Na conferência de 28/10 o campo ainda
  vinha preenchido com hoje, contradizendo a dica: agora começa vazio, a caixa de validade fica
  neutra com "Escolha a data da carteira para ver a validade." e "Registrar comprovante" só libera
  com data e documento.
- Conferido: 768x1024, escuro: "Vale até 16/04/2027" na lista de documentos da Luna. Em 28/10, 1440,
  reserva do Zeus: rótulo e dica novos, campo vazio e botão travado; com 12/03/2026, "Válido até
  12/03/2027" e o botão libera.

### H-05 · "Não apresentado" como resumo da documentação lia como "o animal não veio" · Confunde
- Tela: `/hotel/painel` (Chegam hoje), `/hotel/reservas` (Véspera travada), dica da barra no mapa
- O que acontece: no painel, Zeus aparece "15:00 · Atrasou 5 h · Não apresentado". Na lista, a
  véspera mostra "chega hoje · Não apresentado". Em hotel, "não apresentado" é o hóspede que não
  apareceu (e a própria lista usa "Não compareceu" para isso).
- Por que pesa para quem usa: a recepção pode dar a reserva como no-show em vez de pedir o documento.
- Correção: resumo próprio `hotel.resumoAdmissao` ("Falta documento", "Documento vencido", "Documento
  vence na estadia"...), via `formato.resumoDaAdmissao`, no painel (`painel.vue`), na véspera
  (`reservas.vue`) e na descrição da barra do mapa (`GradeDeOcupacao.vue`). Ao lado do nome da vacina
  e sob a coluna "Documentação" segue "Não apresentado", que ali é claro.
- Conferido: 1440x900, claro, pt: "Zeus · chega hoje · Falta documento · Resolver".

### H-06 · "Nova reserva" na lista só trocava de tela · Incomoda
- Tela: `/hotel/reservas`  ·  Largura/tema: todas
- O que acontece: o botão leva ao Mapa e não abre nada; é preciso achar e clicar de novo em "Nova
  reserva", agora no Mapa.
- Por que pesa para quem usa: clique perdido no começo de toda venda por telefone.
- Correção: a lista vai para `/hotel/mapa?nova=1` e o Mapa abre o "Onde cabe" ancorado no botão,
  limpando a query (`reservas.vue`, `mapa.vue`, `abrirNovaSePedida`).
- Conferido: 1440x900, claro: um clique em "Nova reserva" na lista abre o Mapa com "Onde cabe".

### H-07 · Mapa: padding e gap da casca vazavam na tela e a procura saía pela direita · Incomoda
- Tela: `/hotel/mapa`  ·  Largura/tema: 1440 (e todas)
- O que acontece: a faixa "Tenho um ... animal ou mais" e a grade começavam 14 px mais para dentro à
  esquerda e encostavam na borda direita da tela (sem a margem de 36 px das outras telas); o espaço
  entre a procura e a grade era de 2 px.
- Por que pesa para quem usa: tela desalinhada das vizinhas e a procura colada na borda.
- Correção: o contêiner da página se chamava `.mapa`, a mesma classe do menu lateral; a regra global
  `.shell--moldura-app .mapa` (padding 16/14, gap 2) pegava os dois. Renomeado para
  `.tela-mapa__corpo`, com trilha `minmax(0, 1fr)` para a grade rolar por dentro (`mapa.vue`).
- Conferido: 1440x900: procura e grade de 308 a 1404 px, gap de 20 px, igual a Reservas.

### H-08 · Frase do Mapa dizia que a noite mais cheia era amanhã, e hoje estava mais cheia · Polimento
- Tela: `/hotel/mapa`  ·  Largura/tema: todas
- O que acontece: "Hoje, 6 de 19 acomodações ocupadas; a noite mais cheia das três semanas é qua.
  28/10, com 14 vagas." Hoje tinha 13 vagas: a conta excluía hoje.
- Correção: hoje entra na conta (`mapa.vue`, `fraseDoResumo`). Agora: "...a noite mais cheia das
  três semanas é ter. 27/10, com 13 vagas."
- Conferido: 1440x900, pt.

### H-09 · Busca do hóspede guardava o texto entre aberturas · Incomoda
- Tela: Nova reserva > Hóspede  ·  Largura/tema: todas
- O que acontece: digitei "Bidu", fechei, reabri e digitei de novo: o filtro virou "BiduBiduBidu" e
  "Nenhum resultado".
- Correção: `reset-filter-on-hide` e mensagem de vazio própria ("Nenhum animal com esse nome no
  cadastro do hotel.") (`NovaReservaDialog.vue`).
- Conferido: 1440x900: ao reabrir, o filtro vem vazio.

### H-10 · Depois de "Registrar ligação" o boletim seguia retido, e o Enviar, apagado · Bloqueia
- Tela: `/hotel/hospedagem/hosp-tofu` (aba Boletins)  ·  Largura/tema: todas
- O que acontece: o Tofu (renal) recusou as três refeições; registrei a ligação para a Rita. O item
  "Ligue para..." sumiu, mas "Boletim retido até a ligação · Retido: falta a ligação ao responsável."
  continuou no topo e na aba, com "Enviar" desabilitado. O boletim nunca saía.
- Por que pesa para quem usa: a casa liga, e o responsável segue sem o boletim do dia; a pendência
  fica no painel para sempre.
- Correção: `registrarContato` passa o boletim liberado de `retido` para `rascunho`
  (`src/features/hotel/data/repositories/hospedagem-repository.ts`); o teste do fluxo agora confere o
  status depois da ligação (`src/features/hotel/data/__tests__/fluxo.spec.ts`).
- Conferido: 1440x900, claro: depois da ligação a aba mostra "Rascunho" e "Enviar" habilitado; o
  topo fica só com "1 tarefa da rotina atrasada".

### H-11 · Check-out não via a pesagem nem o último pertence conferido · Bloqueia
- Tela: `/hotel/hospedagem/hosp-bento?checkout=1`  ·  Largura/tema: todas
- O que acontece: marquei "Brinquedo de corda" como devolvido; a caixa ficou marcada, mas o diálogo
  seguiu "3 de 4 conferidos" e "Falta pesar e conferir 1 pertence.", com "Fechar estadia" apagado.
- Por que pesa para quem usa: o Bento, que já saiu atrasado 4 h, não consegue sair; a recepção não
  tem o que fazer além de recarregar a página.
- Correção: mesma raiz do H-02: `abrir` da hospedagem devolvia o objeto do conjunto, que pesagem,
  conferência e adaptação mudam no lugar. Agora devolve `structuredClone`
  (`src/features/hotel/data/repositories/hospedagem-repository.ts`, `abrir`).
- Conferido: 1440x900: ao marcar o quarto item, "4 de 4 conferidos", o passo 2 ganha o visto e o
  resumo vira "Falta pesar.".

### H-12 · Peso obrigatório no check-in sem marca nem aviso · Confunde
- Tela: `/hotel/reserva/<id>` > Fazer check-in  ·  Largura/tema: todas
- O que acontece: "Confirmar check-in" fica apagado no pé de um formulário longo (chegada, pertences,
  alimentação, autorizações, remédios, quem busca, emergência). O que trava é só o peso, sem `*` e
  sem mensagem.
- Correção: `*` no rótulo, `aria-required`, e no rodapé "Falta o peso na balança." enquanto ele
  falta (`src/features/hotel/components/estadia/CheckInDialog.vue`), 6 idiomas.
- Conferido: 1440x900, claro: aviso some ao digitar 4,3 kg e o botão acende.

### H-13 · "Tranquilo" sumia no seletor de adaptação · Confunde
- Tela: `/hotel/hospedagem/hosp-bento` (capa)  ·  Largura/tema: claro
- O que acontece: com "Tranquilo" escolhido, a caixa fica branca e a palavra também (branco sobre
  branco, medido: `rgb(255,255,255)` nos dois). Parece que nenhuma opção está marcada.
- Correção: o tom neutro não tinha regra e herdava o branco da capa; agora usa `--app-tinta`, a
  mesma dos botões claros da capa (`hospedagem/[hospedagemId].vue`).
- Conferido: 1440x900, claro: `rgb(29,53,87)` sobre branco.

### H-14 · Ficha da estadia dizia "Ração da casa · 0 g" para quem trouxe ração · Confunde
- Tela: `/hotel/hospedagem/<id>` (Ficha da estadia)  ·  Largura/tema: todas
- O que acontece: no check-in da Sushi deixei "Ração trazida de casa" ligado sem marca nem porção. A
  ficha mostrou "Ração da casa · 0 g": o contrário do que foi dito, e uma porção zero.
- Correção: sem marca, o texto segue a origem ("Ração trazida de casa" ou "Ração da casa"); porção
  zero não aparece (`hospedagem/[hospedagemId].vue`), 6 idiomas.
- Conferido: 28/10, 1440: check-in do Sushi com "Ração trazida de casa" e sem marca nem porção; a ficha mostra "Ração trazida de casa · 08:00, 18:00", sem "0 g".

### H-15 · Check-in "recebido por Helena Barros" com a Helena Prado logada · Polimento
- Tela: `/hotel/hospedagem/<id>` (Entrada)  ·  Largura/tema: todas
- O que acontece: a gerente da equipe mocada se chamava Helena Barros; a conta da demonstração é
  Helena Prado (rodapé do menu). Na apresentação, o check-in feito por ela aparece em nome de outra.
- Correção: a gerente do conjunto de demonstração passa a ser Helena Prado (`HP`)
  (`src/features/hotel/data/fixtures/hotel.ts`).
- Conferido: 1440x900: "10:00, recebido por Helena Prado".

### H-16 · Celular sem máscara na reserva online · Incomoda
- Tela: `/reservar/petjourney-hotel` (Seus dados)  ·  Largura/tema: todas
- O que acontece: como tutora (Mariana Coutinho, Paçoca), digitei 11987214455. A revisão disse "A
  confirmação chega por mensagem no 11987214455." e o mesmo texto cru vai para o pedido no balcão e
  para o cadastro novo.
- Correção: o campo formata enquanto digita, "(11) 98721-4455", com o `formatPhone` do projeto
  (`src/features/hotel/components/pedidos/fluxo/FluxoDaReserva.vue`). A validação conta dígitos e
  não muda.
- Conferido: 28/10, 1440, página pública: "11987214455" digitado vira "(11) 98721-4455", e a revisão diz "A confirmação chega por mensagem no (11) 98721-4455.".

### H-17 · Painel dizia "5 Na casa" e o Início, "6 Na casa" · Confunde
- Tela: `/hotel/painel` x `/inicio` (bloco Hotel)  ·  Largura/tema: todas
- O que acontece: o Início conta animais (Mel e Amora dividem a Baia A3: 6); o painel contava
  estadias (5). O próprio código do painel diz que os números são "os mesmos da fita e do Início".
- Correção: o painel passa a contar animais, com o acompanhante, no indicador, no total da coluna e
  em "Ver os 6 hóspedes" (`src/pages/(accounts)/hotel/painel.vue`, `animaisNaCasa`).
- Conferido: 1440x900, claro: "6 Na casa" no painel e no Início.

### H-18 · Não havia como mudar as datas, prorrogar ou trocar a acomodação de uma reserva · Bloqueia
- Tela: `/hotel/reserva/<id>`  ·  Largura/tema: todas
- O que acontece: a reserva oferece "Cancelar reserva", "Registrar comprovante", sinal e check-in.
  Não há "alterar datas" nem "prorrogar" em lugar nenhum do módulo; o repositório e a store sabiam
  fazer (`reservas.editar`), mas nada na interface chamava. O tutor do Thor liga pedindo mais seis
  noites e a recepção só tem como cancelar e vender de novo (e o sinal fica para trás).
- Por que pesa para quem usa: é a operação mais comum de feriado (voo atrasou, chegou um dia antes).
- Correção: botão "Alterar datas" (reserva pendente ou confirmada) e "Prorrogar estadia" (hóspede na
  casa), que abre uma gaveta à direita com calendário inline, horas, acomodação (só as que servem no
  período novo, sem contar a própria reserva), a conta nova ("Nova conta: R$ 1.317,00 (antes R$
  1.208,00).") e os mesmos avisos de vaga e de animal já reservado; quem está na casa muda só a
  saída. Novo componente `src/features/hotel/components/reserva/AlterarReservaGaveta.vue`, novo
  `reservaRepository.vagasParaMover`, ligação em `reserva/[reservaId].vue`, 6 idiomas.
- Conferido: 1440x900, claro: Bidu de 30/10–08/11 para 31/10–10/11 (10 diárias, saldo R$ 954,60);
  Thor prorrogado até 05/11 (11 diárias, saldo R$ 1.952,80).

### H-19 · Tirar de operação uma acomodação com reserva marcada · Bloqueia
- Tela: `/hotel/acomodacoes` > Baia A5 > Tirar de operação  ·  Largura/tema: todas
- O que acontece: tirei a Baia A5 para "Manutenção" sem aviso nenhum, com a estadia do Bidu confirmada
  para 30/10 nela. A reserva ficou presa numa baia fora de operação, e ninguém fica sabendo até o dia
  da chegada. (Com hóspede dentro a tela já recusava; com reserva, não.)
- Correção: `desativar` recusa com `tem-reserva-inativar`: "Há reserva marcada nesta acomodação. Na
  reserva, use "Alterar datas" para mudá-la de acomodação antes de tirar esta de operação."
  (`src/features/hotel/data/repositories/acomodacao-repository.ts`), teste novo em `fluxo.spec.ts`,
  6 idiomas.
- Conferido: 1440x900: a mensagem aparece logo abaixo do botão; Baia A6 (sem reserva) sai de operação
  normalmente.

### H-20 · "Manutenção · há 0 dias" · Polimento
- Tela: `/hotel/acomodacoes` (cartão da acomodação parada hoje)
- Correção: `haDias(0)` diz "desde hoje" (`useHotelFormat.ts`), 6 idiomas.
- Conferido: 28/10, 1440: Baia A2 tirada de operação, o cartão diz "Manutenção · desde hoje".

### H-21 · Hóspedes somava 13 atrasadas com tarefas de ontem; painel e rotina diziam 5 · Confunde
- Tela: `/hotel/hospedes` x `/hotel/painel` x `/hotel/rotina`  ·  Largura/tema: todas
- O que acontece: na grade, "Agora na rotina" do Tofu era "20:00 Medicação · atrasou 25 h" (o remédio
  de ontem, que no painel aparece "Feita" hoje), Bento "15:00 Passeio · atrasou 30 h". Somando, 13
  atrasadas; o painel e a rotina, no mesmo instante, 5. E as tarefas de ontem não aparecem em
  nenhuma tela onde se possa marcá-las. "Remédio atrasou 25 h" ainda convida a dar a dose de ontem.
- Correção: a lista de hóspedes considera as tarefas de hoje em diante, como a prancheta
  (`hospedagem-repository.ts`, `listar`).
- Conferido: 1440x900: Mel 1, Nina 2, Tofu 1, Thor 1 = 5 atrasadas, igual ao painel e à rotina;
  Bento "Nada pendente hoje · 7 de 7".

### H-22 · Respostas do mock eram o próprio objeto em memória: telas não viam a mudança · Bloqueia
- Tela: rotina (marcar em lote), check-out, sinal (ver H-02 e H-11)  ·  Largura/tema: todas
- O que acontece: depois de "Marcar as 2 como feitas" na água das 12:00, Tofu e Thor ganharam o selo
  "Feita" mas continuaram com "Pular" e "Feita" (em vez de "Desfazer"). Mesma raiz de H-02 (selo do
  sinal) e H-11 (check-out travado): o repositório devolvia o objeto do conjunto e a escrita seguinte
  o mudava no lugar, sem o Vue perceber.
- Correção: `simularChamada` devolve uma cópia de toda resposta, como uma API devolveria
  (`src/features/hotel/data/mock-runtime.ts`, `comoResposta`). As cópias pontuais feitas antes em
  `abrir` foram retiradas.
- Conferido: 1440x900: "Água · Tudo resolvido · Tofu Feita · Marcada às 21:25 · Desfazer"; sinal de
  R$ 100,00 na Luna vira "Confirmada · Sinal pago", saldo R$ 336,00; check-out do Bento fecha.

### H-23 · Check-out cobrava um valor e gravava outro · Bloqueia
- Tela: `/hotel/hospedagem/hosp-bento` (Saída e check-out)  ·  Largura/tema: todas
- O que acontece: o diálogo dizia "Saldo a receber R$ 437,85 · Cobrado no balcão, na hora da
  entrega" (conta da saída prevista, 16:30). Ao fechar às 21:26 a estadia ficou "Saldo R$ 507,35 ·
  Nada a receber" (conta refeita com a hora real, e sem registrar o pagamento), e a lista de reservas
  passaria a dizer "R$ 507,35 a receber" de um hóspede que já foi embora.
- Correção: o saldo da ficha, do painel e do diálogo, passada a hora prevista, é o da entrega agora
  ("Saída depois do horário: 100% de diária a mais."), calculado pela mesma função que o check-out
  grava (`orcamentoNaSaida`); fechar a estadia registra o saldo como recebido
  (`hospedagem-repository.ts`; teste em `fluxo.spec.ts`).
- Conferido: 1440x900: ficha e diálogo "R$ 507,35"; depois do check-out, saldo zerado.

### H-24 · Horários da rotina padrão inválidos sumiam em silêncio · Confunde
- Tela: `/hotel/rotina-padrao` > Editar (Higiene)  ·  Largura/tema: todas
- O que acontece: digitei "9h, 25:00, 16:00". A leitura ficou só com "16:00", sem aviso, e "Aplicar"
  aceso. A higiene das nove sumiria da casa inteira.
- Correção: o diálogo lista o que não leu ("Não deu para ler: 9h, 25:00. Escreva a hora como 09:00,
  entre 00:00 e 23:59.") e desabilita "Aplicar" até corrigir
  (`src/features/hotel/components/rotina-padrao/ItemDoPadraoDialog.vue`), 6 idiomas.
- Conferido: 1440x900, claro.

### H-25 · Publicar a rotina "Agora" depois das 20h valia só para amanhã · Bloqueia
- Tela: `/hotel/rotina-padrao` > Publicar alterações  ·  Largura/tema: todas
- O que acontece: às 21:3x, com um horário novo de higiene às 22:30, "Amanhã" e "Agora" davam o mesmo
  "37 tarefas nascem · 0 intocadas". "Agora" usava `new Date().toISOString()` (UTC); depois das 20h no
  fuso da casa (-04:00) a data UTC já é amanhã. A dica também dizia sempre "Começar amanhã não mexe
  no turno de quem está trabalhando agora.", mesmo com "Agora" marcado.
- Correção: o instante sai do relógio da casa (`hotelClock.nowIso()`)
  (`src/pages/(accounts)/hotel/rotina-padrao.vue`, `vigenteDesde`); a dica acompanha a escolha
  ("Vale já para o resto de hoje: os horários que ainda não passaram entram na rotina deste turno.")
  (`PublicarRotinaDialog.vue`), 6 idiomas.
- Conferido: 1440x900, claro: "Agora" mostra "4 tarefas nascem · 49 intocadas · 4 caem no turno de
  agora"; publicado como versão 2.

### H-26 · Marcar tarefa que falha não dava retorno nenhum · Confunde
- Tela: `/hotel/rotina` (com `rotina.marcar` em falha pelo painel Demonstração)  ·  Largura/tema: todas
- O que acontece: toquei "Feita" na refeição da Nina; nada aconteceu. O erro só era exibido dentro da
  proposta de rotina, na lateral. O cuidador segue achando que marcou.
- Correção: mensagem no alto da prancheta, fechável: "Não deu para marcar: a conexão falhou. A tarefa
  continua pendente; toque de novo." (`src/pages/(accounts)/hotel/rotina.vue`), 6 idiomas.
- Conferido: 1440x900, escuro.

### H-27 · Mapa sem rede dizia "Nenhuma acomodação cadastrada" · Confunde
- Tela: `/hotel/mapa` (modo offline do painel Demonstração)  ·  Largura/tema: todas
- O que acontece: "Nenhuma acomodação cadastrada. Cadastre as acomodações da casa para começar a
  vender diárias." e, no console, `Uncaught (in promise) HotelMockError: mapa.periodo falhou: offline`.
- Correção: a carga da grade trata a falha e a tela mostra o erro com "Tentar novamente"; vazio só
  com a grade carregada e sem linhas (`src/pages/(accounts)/hotel/mapa.vue`).
- Conferido: 1440x900, escuro: "Não foi possível carregar o mapa de acomodações. Tentar novamente";
  console limpo.

### H-28 · Sem rede, os cabeçalhos mostravam números falsos em cima do erro · Confunde
- Telas: `/hotel/painel` ("1 assunto esperando você · 0 Na casa · 0 Chegam hoje · 5 Tarefas
  atrasadas"), `/hotel/hospedes` ("A casa está em dia"), `/hotel/reservas` ("0 reservas a partir de
  hoje: ninguém chega nos próximos 7 dias."), `/hotel/acomodacoes` ("0 ocupadas agora, 19 livres", sem
  aviso de erro), `/hotel/rotina-padrao` ("0 tarefas por hóspede"), `/hotel/rotina` (contagem da
  prancheta antiga)
- Correção: com a leitura falhando, a frase e os números somem (o painel fica com "Painel do dia");
  em Acomodações a frase fica só com o tamanho da casa. Arquivos: `painel.vue`, `hospedes.vue`,
  `reservas.vue`, `acomodacoes.vue`, `rotina-padrao.vue`, `rotina.vue`.
- Conferido: 1440x900, escuro, offline: as dez telas do hotel mostram só o erro com "Tentar
  novamente" (Acomodações mostra o cadastro em cache, sem ocupação).

### H-29 · Gráfico de ocupação no escuro: barras dos dias de semana a 2,5:1 · Polimento
- Tela: `/hotel/resumo`  ·  Largura/tema: escuro
- O que acontece: as barras de segunda a sexta (a maioria) eram cinza-azuladas sobre o fundo escuro,
  2,51:1 (medido), escuro sobre escuro.
- Correção: no escuro, 70% de lavanda em vez de 45% (`resumo.vue`): 3,50:1 medido, e o fim de semana
  continua mais forte (7,5:1).
- Conferido: 1440x900, escuro.

### H-30 · Proposta de rotina: "recebido como Em adaptação" e frase truncada · Polimento
- Tela: estadia > Propor ajustes
- O que acontece: "o hóspede foi recebido como Em adaptação" (maiúscula no meio) e "o peso de saída
  sem um meio do caminho não diz quando o animal emagreceu".
- Correção: o estado entra minúsculo (`PropostaDeRotina.vue`); pt: "sem uma pesagem no meio, o peso
  da saída não mostra quando o animal emagreceu".
- Conferido: 1440x900, claro: "o hóspede foi recebido como em adaptação". Aprovei a mudança de
  passeio da Nina (10:00, 15:00, 18:30) e ela entrou no "Plano da estadia".

Fluxo da reserva online conferido de ponta a ponta: pedido da Paçoca (cão grande, 30/10 a 02/11,
Baia, sem extras) chegou em `/hotel/pedidos` como "Primeira vez · Pelo link do hotel"; aceitei o da
Bolota (Baia B1, faixa verde "O responsável já foi avisado e falta o sinal.", com "Ver a reserva") e
recusei o da Luna por "Sem vaga": a mensagem sugerida explica ao tutor ("Estamos lotados nessas datas
para Luna. Se puder mudar a data, peça de novo... ou ligue (11) 3555-0188 que colocamos na lista de
espera."), e o pedido vai para "Respondidos" como "Recusado: Sem vaga".

### H-31 · Travessões (—) nos textos do Hotel · Polimento
- Telas: tour ("Como usar") de estadia, reserva, reservas, resumo, rotina e pedidos; dicas de
  "Acrescentar à rotina"; aviso de venda sem autorização no check-in; recusas da proposta; pedidos
  ("Recusado — {motivo}", "Reservado — falta o sinal", mensagem de recusa "peça de novo — ou ligue").
- Correção: trocados por dois-pontos ou vírgula nas 19 chaves, em pt, en, en-GB e es (sr e ar não
  tinham). `hotel.formato.semvalor` ("—" como valor vazio) ficou como está. Conferido por script: 0
  travessões restantes em `hotel.*` fora dele; `npm run check:i18n` OK.

## Compartilhado (para a casca/base)

- **Login: "Bem-vindo de volta"** (gênero) aparecia no começo da sessão; depois do reinício do
  servidor já estava "Olá de novo" (a frente Parceiro corrigiu).
- **Estado de erro do `UiPagina` repete a frase**: título "Não foi possível carregar" e logo abaixo
  "Não foi possível carregar o mapa de acomodações." Sugestão: título curto ("Sem conexão com o
  servidor" / "Algo falhou") e a descrição específica.
- **`.shell--moldura-app .mapa`** (em `src/components/layout/moldura-app.css`) é um seletor genérico
  demais: pega qualquer `.mapa` dentro da casca. Contornei no hotel renomeando a classe (H-07);
  vale escopar a regra a `.shell .barra__mapa` para não morder outras telas.
- **Drawer em RTL** (`ar`) abre à direita como no LTR; com `position="right"` fixo, em árabe ele
  deveria abrir do lado de início da leitura. É do padrão de todas as gavetas do portal.
- **Seta "→" nos períodos** (`formato.periodo`, "01/11 · 08:00 → 05/11 · 12:00") aponta para a
  direita também em `ar`, onde a leitura é ao contrário.

## Fora do portal (API, CMS, app)

Nada: o Hotel está todo mocado no front neste branch e não houve chamada de rede do módulo. As únicas
requisições nas telas do hotel foram as da casca (`/usuario/allInformations/...`,
`/parceiro/portal/dashboard`, `/parceiro/portal/status`), todas 200.

## Propostas (mudanças maiores, não implementadas)

- **Cabeçalho da reserva com ações demais**: com "Alterar datas" são seis botões (Como usar,
  Cancelar, Alterar datas, Registrar comprovante, Fazer check-in, Registrar sinal e confirmar). Em
  1024 e 768 quebram em três linhas e a ação principal fica sozinha embaixo. Proposta: manter a
  ação principal e uma secundária à vista e recolher o resto num menu "Mais".
- **Prévia de publicação "Amanhã" conta o dia inteiro**: mudar um horário de higiene mostra "37
  tarefas nascem", porque amanhã ainda não foi gerado e todas as tarefas do dia entram na conta.
  O número é verdadeiro mas não diz o que a mudança muda; melhor separar "o que muda" de "o que
  seria gerado de qualquer jeito".
- **Saída antecipada deixa crédito sem tela**: se o animal sai antes e o sinal passa do valor real, o
  saldo fica negativo e não há onde registrar a devolução.
- **Filtros da rotina e linhas do "Onde cabe"** usam `<button>` nativo estilizado. Funcionam e têm
  foco, mas fogem da regra "PrimeVue, não HTML cru"; trocar mexe no visual da prancheta inteira.
- **Texto técnico na proposta de rotina** ("Nesta versão não há modelo nem rede: a proposta vem de
  uma simulação determinista...") é nota de bastidor na tela do cuidador; para a apresentação,
  sugiro um selo discreto "demonstração".
- **Sem cadastro de animal novo na reserva de balcão**: a busca do hóspede só acha quem já está no
  cadastro do hotel ("Nenhum animal com esse nome no cadastro do hotel."). Tutor novo por telefone
  precisa passar pela reserva online ou pela clínica.

## Dados criados (para a apresentação)

Lembrete: tudo é mocado e some num recarregamento completo (inclusive o reinício do servidor).
Criado ao longo da sessão: pedido online de **Mariana Coutinho / Paçoca** (cão grande, Baia, 30/10 a
02/11); pedido da **Bolota** aceito na Baia B1 (16 a 19/11); pedido da **Luna** recusado por "Sem
vaga"; sinal de **R$ 100,00** na reserva da Luna (confirmada); reserva do **Bidu** movida para 31/10
a 10/11; estadia do **Thor** prorrogada até 05/11; check-in da **Sushi** (4,3 kg, Gabapentina 50 mg
08:00 e 20:00); comprovante da tosse dos canis do **Zeus** ("Bronchi-Shield lote BS2291"); check-out
do **Bento** (32,1 kg, entregue a João Pedro Camargo); ligação registrada para a Rita (Tofu) e
boletim liberado; acomodação **Baia A8** no Canil A; **Baia A6** fora de operação ("Troca da tela
de proteção do solário"); rotina padrão versão 2 com higiene às 22:30; proposta aprovada para a
**Nina** (passeio 10:00, 15:00, 18:30).

## Verificação final (vitest, i18n, eslint/oxlint, type-check: comando e resultado)

- `npx vitest run src/features/hotel`: 23 arquivos, **410 testes passando** (inclui 3 casos novos de
  `reservaDoAnimalNoPeriodo` e as asserções novas de boletim liberado, desativar com reserva e saldo
  do check-out em `fluxo.spec.ts`). `npx vitest run src/components/home/__tests__
  src/router/__tests__/rotas-do-hotel.spec.ts src/navegacao/__tests__/espacos.spec.ts`: 32 passando.
- `npm run check:i18n`: **paridade OK**.
- `npx eslint <arquivos tocados do hotel>`: **sem erros**.
- `npx oxlint <arquivos tocados do hotel>`: 1 erro **antigo**, já no HEAD:
  `hospedagem-repository.ts:847` variável `hospedagem` sem uso em `registrarMedicacao` (não mexi).
- `npx prettier --write` só nos arquivos que já estavam formatados no HEAD (painel, rotina,
  NovaReservaDialog, hospedagem-repository, fluxo.spec) e no componente novo; os demais já vinham
  fora do prettier no HEAD e não foram reformatados para não inflar o diff.
- `npm run type-check`: **sem erros** (depois de corrigir o tipo do `ref` do botão no `mapa.vue`).
- Conferência na tela depois do reinício do servidor: `?nova=1` abre o "Onde cabe" ancorado no
  botão e a barra fica em `/hotel/mapa`.
