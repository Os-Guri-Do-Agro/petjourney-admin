# Frente Hotel: validação de uso real (29/10/2026)

Persona e roteiro: fui a gerente do hotel e creche da Aurora Clínica e Hotel Veterinário, entrando
com a Helena (`helena@clinica-aurora.example.com`) e `?clinico=on&hotel=on`, numa quinta de casa
cheia, do fim da tarde ao fechamento (o relógio real, das 19:50 às 20:50: Bento já atrasado na
saída, Sushi e Zeus por entrar, Tofu com ocorrência grave sem contato). Usei Hotel › Hoje (painel,
rotina, hóspedes), Reservas (mapa com "Onde cabe", lista com os dois horizontes, busca, filtros e
ordenação; reserva pendente, confirmada, na casa e encerrada; registrar sinal, alterar datas,
prorrogar, cancelar, registrar comprovante), Pedidos (link do hotel, prévia do celular, aceitar,
abrir a gaveta, recusar), check-in da Sushi, check-out do Bento e do Tofu (pesagem, pertences,
cobrança e devolução), estadia do Tofu (ligação registrada, boletim retido, gerar boletim), A casa
(planta, tirar de operação, rotina padrão com publicação "Agora"), Relatórios (7, 30 e 90 dias) e a
página pública `/reservar/<slug>?hotel=on` do começo ao "Pedido enviado". Também conferi o avatar
em Acessos do Portal e na Agenda da semana do Início, por causa da troca de cor.

Tamanhos: 1440x900, 1024x768 e 768x1024. Temas: claro em tudo; escuro no painel, no Início, em
Acessos e na reserva (1024). Idiomas: pt em tudo; ar (RTL) na reserva a 768, com o menu "Mais
ações"; sr na reserva a 1024 (texto longo no cabeçalho); es no painel. Contraste medido por script
(cor do texto contra o primeiro fundo opaco): painel claro e escuro, reserva escura, Acessos.

Correções antigas conferidas e valendo: H-01 (mesmo animal em duas reservas, pelo balcão), H-04
(comprovante começa vazio e trava sem data), H-10 (ligação libera o boletim: "Rascunho" e "Enviar"),
H-11 (check-out vê a pesagem e o quarto pertence), H-18 (alterar datas e prorrogar), H-19 (Baia A5
com reserva não sai de operação), H-22 (as telas veem a mudança: sinal, check-out, tarefas), H-23
(o check-out cobra o que grava e zera o saldo) e H-25 ("Agora" depois das 20h: "4 tarefas nascem,
4 caem no turno de agora"). Uma regressão de caminho: o H-01 não valia para o aceite de pedido
online (H-02 abaixo). Os três abertos da rodada anterior foram feitos (H-03, H-04, H-05).

Observação de ambiente: a página recarregou muitas vezes pelo Vite (três frentes salvando arquivos).
Duas vezes, no meio da recarga, a tela veio sem a camada da moldura (blocos com borda e ladrilhos
lavanda); recarregada, voltou ao normal. Não é defeito do produto.

Resumo: 26 achados. Bloqueia 1, Confunde 11, Incomoda 6, Polimento 8. Corrigidos e conferidos na
tela: 23 (21 na frente e H-25 e H-26 no fechamento). Não corrigidos: 3 (H-22, H-23 e H-24).

## Achados

### H-01 · Hóspede atrasado: a estadia cobrava R$ 507,35, a reserva e a lista R$ 437,85 · Confunde
- Tela: `/hotel/reserva/res-bento`, `/hotel/reservas` x `/hotel/hospedagem/hosp-bento` e painel  ·  Largura/tema: todas
- O que acontece: às 20h o Bento (saída prevista 16:30) aparecia com "Saldo R$ 507,35 a receber na saída" na estadia, no painel e no check-out (diária cheia de saída tardia, a correção H-23), e com "Saldo a receber R$ 437,85" na reserva e "R$ 437,85 a receber" na lista de reservas, com a nota "A saída prevista é depois do horário: R$ 69,50".
- Por que pesa para quem usa: dois saldos para o mesmo hóspede na mesma noite; quem olha a lista cobra um, quem olha a estadia cobra outro.
- Correção: a conta de uma estadia passou a ter um lugar só, `contaDaEstadia` (`src/features/hotel/data/repositories/reserva-repository.ts:292`), usada pelo check-out e pela estadia (`hospedagem-repository.ts`, `orcamentoNaSaida`). Hóspede na casa depois da hora prevista sai da leitura com a conta da entrega agora, na lista e no detalhe (`comContaDeAgora`, `:327`), sem mudar a reserva gravada; o detalhe avisa com `contaDaEntregaAgora`, e a nota vira "Passou da saída prevista: entregando agora, são R$ 139,00 a mais na conta." (`reserva/[reservaId].vue`, chave `hotel.reserva.saidaAtrasada` nos 6 idiomas). Teste novo em `fluxo.spec.ts` ("passada a hora de saída, a reserva e a lista cobram o mesmo saldo que a estadia").
- Conferido: 1440, claro: reserva do Bento "R$ 507,35 de R$ 695,00", tabela com "Saída tardia R$ 139,00"; lista "R$ 507,35 a receber"; estadia "R$ 507,35". Escuro a 1024: mesma conta.

### H-02 · Aceitar o pedido online dava a segunda baia ao mesmo cão · Confunde
- Tela: `/hotel/pedidos`, pedido da Luna  ·  Largura/tema: todas
- O que acontece: a Luna tem reserva de 03/11 08:00 a 07/11 12:00 (Baia B2) e um pedido pelo app de 07/11 10:00 a 10/11. A linha oferecia "Reservar Baia B1" e o aceite gravava: duas reservas vivas do mesmo animal na manhã de 07/11. A regra do H-01 da rodada anterior valia no balcão, mas não no aceite de pedido.
- Por que pesa para quem usa: uma baia presa para um cão que estará em outra; e o responsável recebe "reservado" para um período que já era dele.
- Correção: o aceite confere a mesma regra (`reservaDoAnimalNoPeriodo`) e recusa (`src/features/hotel/data/reserva-online.ts:1235`); a store mostra o motivo em vez do genérico "tente de novo" (`stores/pedidos-de-reserva.ts:114`). A caixa traz `reservaDoAnimal` em cada pedido (`reserva-online.ts:1012`): a linha perde o "Reservar" e diz "Já tem reserva: Baia B2, 03/11 · 08:00 → 07/11 · 12:00" (`PedidoDeReservaLinha.vue:194`, quebra em duas linhas para não cortar); a gaveta mostra "Luna já tem reserva nesse período (...). Ajuste ou cancele aquela antes de criar outra." e trava o botão (`PedidoDeReservaGaveta.vue:317`). Chave nova `hotel.pedidos.linha.jaTemReserva` nos 6 idiomas. Teste novo em `reserva-online.spec.ts`.
- Conferido: 1440, claro: linha da Luna só com "Responder" e o aviso; gaveta com o aviso em atenção e "Reservar Baia B1" desabilitado; Thor, Cacau, Bolota e Bento e Açaí seguem com o botão cheio.

### H-03 · Sem cadastro de animal novo na reserva de balcão (aberto da rodada anterior) · Bloqueia
- Tela: `/hotel/mapa` › Nova reserva  ·  Largura/tema: todas
- O que acontece: a busca do hóspede só achava quem já estava no cadastro ("Nenhum animal com esse nome no cadastro do hotel."). O responsável novo que liga não tinha como ser atendido no balcão: era mandado ao link público ou à clínica.
- Por que pesa para quem usa: a venda por telefone de um cliente novo, que é a mais comum na véspera de feriado, não acontecia.
- Decisão (direção recomendada): cadastro mínimo dentro da própria venda, o mesmo do pedido pelo link: nome do animal, espécie (só as que a acomodação recebe; com uma só, ela aparece escrita), porte (cão), responsável e celular com máscara. O resto do cadastro fica para o check-in, como a dica diz. O animal e o responsável só entram no cadastro se a vaga passar.
- Correção: botão "Animal novo" ao lado do rótulo do hóspede, e "Escolher do cadastro" para voltar (`src/features/hotel/components/reserva/NovaReservaDialog.vue:205`, `:230`); orçamento, vaga e aviso de documentação calculados com o porte e a espécie digitados; `reservaRepository.criar` aceita `hospedeNovo` (`reserva-repository.ts:232`, `:245`, `:704`); a store recarrega o catálogo depois (`stores/reservas.ts:238`). Mensagem de "não encontrado" aponta o caminho: "Primeira vez? Use \"Animal novo\".". Chaves `hotel.reserva.novo.*` nos 6 idiomas. Teste novo em `fluxo.spec.ts` (gato na baia do canil é recusado e nada fica no cadastro; cão médio entra com o responsável).
- Conferido: 1440, claro: Baia B2 › Animal novo › "Pipoca", Pequeno, "Juliana Reis", "11981234567" vira "(11) 98123-4567"; orçamento R$ 267,00; "Criar reserva" abre a reserva "Pipoca · Cão · Pequeno · Juliana Reis (11) 98123-4567", pendente, com as oito exigências em "Não apresentado".

### H-04 · Saída antes da data: o crédito sumia sem devolução (aberto) · Confunde
- Tela: check-out e reserva encerrada  ·  Largura/tema: todas
- O que acontece: com o Tofu (estadia de cinco noites já quitada) saindo hoje, o check-out mostrava "Saldo a receber −R$ 135,00 · Nada a receber"; ao fechar, a reserva ficava com saldo negativo e o selo "Quitado". Ninguém era avisado de que havia dinheiro a devolver, nem ficava registrado que ele voltou.
- Por que pesa para quem usa: o responsável sai sem o troco, ou a casa devolve e o sistema não sabe.
- Decisão (direção recomendada): devolver no balcão, na entrega, e registrar no fechamento. Crédito para uma próxima estadia exigiria saldo por responsável, que o produto não tem.
- Correção: o passo 3 do check-out vira "Devolver ao responsável R$ 135,00 · O que foi pago passou da conta das noites usadas: devolva no balcão, na hora da entrega." (`CheckOutDialog.vue:408`); fechar a estadia grava `devolvidoCentavos` na reserva e fecha o saldo em zero (`hospedagem-repository.ts:1310`, tipo em `data/types.ts`); a conta da reserva mostra "Já pago −R$ 550,00 · Devolvido ao responsável +R$ 135,00 · Saldo R$ 0,00" (`OrcamentoTabela.vue`); a estadia e o passo "Saída" dizem "Devolver R$ ..." e "a devolver na saída" quando o saldo é negativo. Chaves novas nos 6 idiomas. Teste novo em `fluxo.spec.ts` e o antigo do check-out ajustado.
- Conferido: 1440, claro: check-out do Tofu com "Devolver ao responsável R$ 135,00"; reserva encerrada com a linha "Devolvido ao responsável +R$ 135,00" e saldo zero.

### H-05 · Cabeçalho da reserva com seis ações em três linhas no tablet (aberto) · Incomoda
- Tela: `/hotel/reserva/<id>` pendente  ·  Largura/tema: 1440 (já em duas linhas), 1024 (três), 768
- O que acontece: Como usar, Cancelar reserva (texto solto sobre a faixa), Alterar datas, Registrar comprovante, Fazer check-in e Registrar sinal e confirmar. Em 1024, três linhas com a ação principal sozinha embaixo; em 1440, duas.
- Decisão (direção recomendada): à vista só o próximo passo (cheio) e mudar as datas (contorno); o resto em "Mais ações" (ícone "…", como o da Agenda), com cancelar na tinta de risco.
- Correção: menu do PrimeVue com Registrar comprovante, Fazer check-in (antes do sinal) e Cancelar reserva (`reserva/[reservaId].vue:523`, estilo do item de risco no fim do arquivo); o botão só aparece quando há o que pôr nele (na reserva de quem está na casa ficam Prorrogar e Abrir estadia). Chave `hotel.reserva.tela.mais` ("Mais ações") nos 6 idiomas.
- Conferido: uma linha em 1440, 1024 e 768 (pt), em sr a 1024 e em ar a 768; o menu abre alinhado ao botão também em RTL.

### H-06 · `/reservar` com "PetJourney Hotel" para a conta da Aurora (pedido da frente Clínica) · Confunde
- Tela: `/reservar/<slug>`, "Link do hotel" em Pedidos, ficha da estadia  ·  Largura/tema: todas
- O que acontece: o link era `/reservar/petjourney-hotel` e a página dizia "PetJourney Hotel". Junto: a veterinária de retaguarda da ficha aparecia na "Clínica PetJourney", e o boletim gerado começava "Tofu está no PetJourney Hotel", que com o nome da Aurora ficaria "está no Aurora Clínica...".
- Correção: o mesmo caminho da Clínica, reaproveitando `src/features/clinico/data/identidade-da-conta.ts` no lugar (o hotel já importa da clínica; mover o arquivo mexeria nos imports da frente Veterinário). Nome do hotel na semente (`data/seed.ts:669`), endereço `slugDoHotel()` (`seed-pedidos-de-reserva.ts:50`), link antigo continua abrindo (`pages/reservar/[hotel].vue:59`), clínica da casa com o nome da conta (`seed.ts:1100`), boletim sem artigo: "Aurora Clínica e Hotel Veterinário: notícias de Tofu." (`hospedagem-repository.ts:1101`).
- Conferido: 1440, claro: "Link do hotel" `/reservar/aurora-clinica-e-hotel-veterinario`; a página abre com "Aurora Clínica e Hotel Veterinário"; `/reservar/petjourney-hotel` também; fluxo completo até "Pedido enviado" (Rufus, Renata Figueiredo).

### H-07 · Boletim retido escrito para a equipe, e datado antes da ocorrência · Confunde
- Tela: `/hotel/hospedagem/hosp-tofu?aba=boletins`  ·  Largura/tema: todas
- O que acontece: o boletim retido do Tofu era de "qua., 28/10, 19:00", com "recusou as refeições de hoje. Precisamos falar com você antes de mandar o boletim.", e a ocorrência é de hoje, 07:40. Depois da ligação ele vira rascunho e "Enviar" mandaria essa frase ao responsável. O boletim gerado na hora terminava "Houve uma ocorrência que precisamos conversar por telefone antes de qualquer coisa." mesmo só saindo depois da ligação. Os enviados diziam "dormiu a noite inteira. Está tranquilo." para a Nina, que chegou às 14h daquele dia.
- Correção: semente com o retido às 07:55 e texto para o responsável ("Tofu não aceitou as refeições desde ontem à noite. Está bebendo água, a ração vai aquecida e oferecida à mão, e a veterinária de retaguarda acompanha. Seguimos em contato.") e enviados neutros (`data/seed.ts:1497`); boletim gerado: "Houve uma ocorrência, e falamos sobre ela por telefone." (`hospedagem-repository.ts:1110`).
- Conferido: 1440, claro: aba Boletins do Tofu com o texto novo, às 07:55; "Gerar boletim" com o nome da casa e a frase da ocorrência nova.

### H-08 · Reserva encerrada mostrava a saída prevista · Confunde
- Tela: `/hotel/reserva/res-tofu` depois do check-out  ·  Largura/tema: todas
- O que acontece: o Tofu saiu hoje às 20:23 e o quadro seguia "Saída 31/10 · sábado · 10:00", com a nota "A saída prevista é depois do horário: R$ 85,00 a mais na conta.".
- Correção: o detalhe traz `saidaReal` (a hora do check-out) e o quadro usa ela depois da saída (`reserva-repository.ts:457`, `reserva/[reservaId].vue:133`); a nota de saída tardia some depois da saída, porque a conta já tem a linha.
- Conferido: 1440, claro: reserva do Tofu encerrada com a saída de hoje.

### H-09 · "A partir de hoje" abria em quatro estadias encerradas ontem · Confunde
- Tela: `/hotel/reservas`  ·  Largura/tema: todas
- O que acontece: "17 reservas a partir de hoje" e a lista começava em Bidu, Ni e Jack (encerradas em 28/10) e Cacau (não compareceu, 28/10).
- Correção: a leitura continua vindo desde ontem (para não perder quem passou da saída e segue na casa), mas o que já fechou antes de hoje fica em "Tudo, com histórico" (`reservas.vue:72`).
- Conferido: 1440, claro: "13 reservas a partir de hoje: 4 chegam nos próximos 7 dias, 2 ainda sem sinal."; filtros somam 13 (situação e bloco).

### H-10 · Relatórios de 90 dias com 45 dias vazios: ocupação 21% e retorno 0% · Confunde
- Tela: `/hotel/resumo`, 90 dias  ·  Largura/tema: todas
- O que acontece: a semente só tinha 45 dias de passado. Em 90 dias o gráfico ficava chapado de 31/07 a 12/09, a ocupação média caía para 21% e "Retorno 0%" (ninguém tinha vindo antes do período), enquanto 30 dias dava 51%.
- Correção: 120 dias de história (`data/seed.ts:945`), com o porquê no comentário.
- Conferido: 1440, claro: 90 dias "R$ 68.490,90 em 556 diárias vendidas, com 32% de ocupação média", retorno 80%, barras desde 31/07; 30 e 7 dias seguem coerentes (diária média = receita / diárias).

### H-11 · Peso digitado não liberava "Registrar peso" nem "Confirmar check-in" · Confunde
- Tela: check-out do Bento e check-in da Sushi  ·  Largura/tema: todas
- O que acontece: o InputNumber só entrega o número ao sair do campo. Digitado "32,1", o "Registrar peso" (que parece habilitado) seguia desabilitado e o clique não fazia nada; no check-in, "Falta o peso na balança." continuava no rodapé com o peso digitado.
- Correção: o número entra a cada tecla, e Enter registra a pesagem (`CheckOutDialog.vue:285`, `CheckInDialog.vue:442`).
- Conferido: 1440: "32,1" e Enter registram a pesagem do Bento ("−0,9%"); no check-in da Sushi o aviso some ao digitar "4,3" e "Confirmar check-in" abre a estadia.

### H-12 · Cancelar sem sinal pago dizia "não devolve o sinal" · Confunde
- Tela: Mais ações › Cancelar reserva (Luna, sem sinal)  ·  Largura/tema: todas
- O que acontece: o diálogo dizia "Fora do prazo: o cancelamento não devolve o sinal." sobre um sinal que nunca foi pago; e "Manter reserva" e o "Cancelar" do popover do sinal eram botões de texto.
- Correção: a frase só aparece com sinal pago; os dois botões em contorno (`reserva/[reservaId].vue:1035`).
- Conferido: 1440, claro.

### H-13 · Alterar datas fechava a gaveta em silêncio · Incomoda
- Tela: reserva › Alterar datas  ·  Largura/tema: todas
- O que acontece: salvar fechava a gaveta e só o quadro mudava, sem confirmação; com o responsável no telefone, a recepção precisa repetir o que ficou gravado. Os rótulos "chega às" e "sai às" vinham minúsculos, ao lado de "Acomodação".
- Correção: aviso "Reserva alterada: Baia B2, 10/11 · 08:00 → 14/11 · 12:00." (`reserva/[reservaId].vue:416`, chave `hotel.reserva.alterar.feito`); "Chega às" e "Sai às" com maiúscula (também na Nova reserva), 6 idiomas.
- Conferido: 1440, claro: Luna de 03–07/11 para 10–14/11, aviso no canto e quadro com as datas novas.

### H-14 · "Ver como o responsável pede" em texto solto sobre a faixa (pedido da frente Clínica, C-12) · Incomoda
- Tela: `/hotel/pedidos`, topo  ·  Largura/tema: todas
- Correção: contorno, como "Link do hotel" e "Configurar" (`pages/(accounts)/hotel/pedidos.vue:423`).
- Conferido: 1440, claro: três botões iguais no topo.

### H-15 · Espanhol do Hotel em "tú" · Incomoda
- Tela: todo o módulo em es  ·  Largura/tema: todas
- O que acontece: 36 frases tratavam por tú ("Compruébalo", "Revisa el documento", "Pide uno con foto", "Haz clic", "Nadie te necesita ahora", "requieren tu atención"...), contra a regra do usted.
- Correção: todas para usted em `src/locales/es.json` (hotel.*; e `clinico.meuDia.resumo.urgentes`/`pendentes`, que o painel do hotel usa e a Clínica também mostra).
- Conferido: painel em es: "2 asuntos urgentes requieren su atención", "Pida el documento ahora, o dispénselo con su nombre."; varredura por script sem tú no `hotel.*`.

### H-16 · Avatar do hóspede em cor cheia com letra branca (pedido da frente Parceiro) · Polimento
- Tela: Hotel inteiro, Agenda da semana do Início, Acessos do Portal  ·  Largura/tema: claro e escuro
- Correção: os seis tons viraram pastel do mesmo matiz com a tinta escura da família (7,3:1 ou mais) e, no escuro, fundo fundo com tinta clara (8,3:1 ou mais), com saturação abaixo da dos selos para não passar por estado (`src/features/hotel/components/base/PetAvatar.vue:185`, `:215`). A Mel continua com a mesma cor de família.
- Conferido: painel, Início (Agenda da semana), Acessos (Fred "FR", Paçoca "PA"), reserva e pedidos, claro e escuro; script de contraste sem falha.

### H-17 · "sai hoje às 16:30" às 20h · Polimento
- Tela: A casa (cartão da Baia A1) e Hóspedes (Bento)  ·  Largura/tema: todas
- Correção: passada a meia hora de folga do Painel, "sai 16:30 · atrasou 4 h" (`acomodacoes.vue:374`, `HospedeCard.vue:162`), curto para caber no cartão.
- Conferido: 1440: texto inteiro no cartão (151 de 151 px).

### H-18 · Diário de gato "passeando no gramado" e cão "ronronando" · Polimento
- Tela: estadia (Diário) e boletim gerado  ·  Largura/tema: todas
- O que acontece: o Tofu, gato renal recusando a ração, tinha "Preferiu andar devagar hoje. Voltou tranquilo e deitou na sombra." e "Brincou de bolinha com o grupo da tarde.", que iam para o boletim; e um cão podia ter "Ronronou o tempo todo".
- Correção: textos por espécie na semente; o momento da manhã do gato vira brincadeira de gatil (`data/seed.ts:1321`).
- Conferido: testes do hotel e do Início passando com a semente nova.

### H-19 · "1 estressado, 1 em adaptação e mais 3 tranquilos" com 6 na casa · Polimento
- Tela: painel, Bem-estar na casa  ·  Largura/tema: todas
- Correção: conta animais, como o "Na casa" (Mel e Amora dividem a baia) (`BemEstarDaCasa.vue:80`).
- Conferido: "e mais 4 tranquilos".

### H-20 · Reserva de quem já está na casa com "O que falta para a entrada" · Polimento
- Tela: `/hotel/reserva/res-bento`  ·  Correção: depois da entrada a seção se chama "Documentação" (`reserva/[reservaId].vue:905`).  ·  Conferido: 1440 e 1024.

### H-21 · Pequenos, vistos de passagem · Polimento
- "Saldo a receber" encostava no ícone do canto em 1024 (texto terminava no pixel 942, o ícone começava no 942): o rótulo para antes do ícone (`reserva/[reservaId].vue:1300`). Conferido a 1024, escuro: "Saldo a / receber".
- Ficha da estadia com "Gatil · Gatil" (corredor e tipo com o mesmo nome): aparece uma vez (`hospedagem/[hospedagemId].vue:1087`). Conferido no Tofu.
- Seletor "A partir de hoje / Tudo, com histórico" em 16 px, maior que a busca ao lado: 14,5 px, como "Ativos / Histórico" de Acessos (`reservas.vue:838`).
- Pedido de dois pets: o segundo rosto cobria a última letra do primeiro ("BE" lia "B"): sobreposição de 8 px (`PedidoDeReservaLinha.vue:455`). Conferido: "BE AN".
- Dinheiro em espanhol saía "507,35 BRL": símbolo em todos os idiomas, "507,35 R$" (`useHotelFormat.ts:233`).

## Não corrigido

### H-22 · Prévia "Amanhã" da rotina padrão conta o dia inteiro · Confunde
- Tela: A casa › Rotina padrão › Publicar  ·  Mudar só um horário de higiene mostra "37 tarefas nascem · 0 intocadas" em "Amanhã" (em "Agora", "4 tarefas nascem"). O número é o que a publicação faz (amanhã ainda não existe), e há teste que exige isso.
- Proposta (já anotada em 27/10): mostrar "o que esta mudança muda" separado de "o que seria gerado de qualquer jeito", rodando a mesma prévia com a rotina em vigor e mostrando a diferença; manter o número de hoje como está.

### H-23 · Formulários em diálogo no meio da tela · Incomoda
- Nova reserva, Check-in, Check-out, Editar acomodação e Cancelar reserva abrem em `Dialog` centralizado; a regra da casa é gaveta à direita para formulário (Alterar datas e Pedidos já são gaveta). Não mexi: é redesenho de cinco telas longas, com rolagem interna e passo a passo.
- Proposta: começar pelo Check-out e pela Nova reserva (os mais usados no balcão), como `Drawer` à direita empurrando a página em tela larga, no modelo da `AlterarReservaGaveta`.

### H-24 · "Registrar ligação" grava num clique, sem o que foi conversado · Incomoda
- Tela: estadia do Tofu e painel. Um clique registra a ligação e libera boletim, turno e saída. Não pergunta com quem se falou nem o combinado; quem clica antes de ligar "faz" a ligação.
- Proposta: um popover curto "Com quem falou e o que ficou combinado" (texto opcional) com "Registrar", e o registro aparece na ocorrência com hora e quem ligou. Decisão de produto: hoje o desenho é um clique de propósito (comentário no repositório).

### H-25 · Ações em botão de texto que se usa todo dia · Polimento
- "Pular" na prancheta da rotina, "Dispensar" na documentação, "+ Nova acomodação" e setas de ordem nos blocos de A casa são botões transparentes.
- Correção (fechamento, coordenador): contorno em "Pular" (`rotina/TarefaLinha.vue:241`), "Dispensar" (`reserva/ExigenciasLista.vue:200`) e nos dois "Nova acomodação", com rótulo e só o "+" (`hotel/acomodacoes.vue:621`, `:632`), pela regra de nunca pôr ação em botão transparente. "Pular" segue mais leve que "Feita" (contorno contra cheio), igual ao "Recusou" ao lado. As setas de ordem ficaram como estavam (são ícones de arrumação, não ação do dia).
- Conferido: rotina (Nina, Mel, Tofu: "Pular" com borda de 1 px, ao lado de "Recusou"), A casa (o "+" do corredor) e reserva do Zeus ("Registrar" e "Dispensar" iguais).

### H-26 · Paciente de teste da Clínica num pedido do hotel · Polimento
- O pedido "Bento e Açaí Nhoque Çãpeçã" usa a Açaí da semente da Clínica, cujo nome é de propósito cheio de acentos (teste de quebra de linha). Num pedido de hotel lê como dado inventado.
- Correção (fechamento): o João não tinha outro animal, então ganhou a Canela (SRD, média, caramelo), que só existe no hotel (`src/features/hotel/data/seed-pedidos-de-reserva.ts:83`); o pedido é "Bento e Canela" (`:207`). Ela entra na semente do hotel depois de todo sorteio, para não mudar o resto da casa, com a carteira de vacinas do Bento (`src/features/hotel/data/seed.ts:1585`). O cadastro da Clínica não mudou. O teste "Bento e Canela vão para uma acomodação que comporta os dois" continua passando.
- Conferido: 1440, Reservas › Pedidos: "Bento e Canela · João Pedro Camargo · O hotel escolhe · Reservar Baia A3"; a gaveta diz "Bento · Grande, Canela · Médio", sem pendência de documento.

## Para outras frentes

- **Todas**: o `PetAvatar` (Hotel) aparece na Clínica (Agenda, Fila, Pacientes, Internação, pedidos), no Início e em Acessos; agora é pastel. Conferi Início e Acessos; a Clínica herda igual.
- **Clínica e Veterinário**: `clinico.meuDia.resumo.urgentes` e `pendentes` em es passaram a usted ("requiere su atención", "lo espera"); o Hoje da Clínica mostra o mesmo texto.
- **Clínica**: `identidade-da-conta.ts` agora é importado também pela semente e pelos pedidos do hotel; se mudar de lugar, levar os dois imports do hotel junto.

## Fora do portal (API, CMS, app)

Nada chamado de verdade: o Hotel é mocado no front neste branch; na rede só as chamadas da casca
(todas 200). Para quando o contrato do hotel for à API, o que os mocks passaram a esperar:
- Aceite de pedido de reserva deve recusar quando o mesmo animal (ou o acompanhante) já tem reserva
  viva que cruza o período, com código próprio (o mock usa `animal-ja-reservado`); a caixa de
  pedidos deve trazer essa reserva para o balcão ver antes de aceitar.
- Criar reserva no balcão com animal e responsável novos (nome, espécie, porte, nome e celular do
  responsável), gravando o cadastro só se a vaga passar.
- Check-out deve registrar a devolução quando o pago passa da conta das noites usadas
  (`devolvidoCentavos`), e o detalhe da reserva deve trazer a saída real e a conta da entrega agora
  para hóspede que passou da saída prevista.

## Dados criados (somem ao recarregar)

Reserva de balcão da **Pipoca** (Juliana Reis, Baia B2, 30/10 a 02/11); **Luna** movida para 10 a
14/11 e confirmada com sinal de R$ 130,80; pedido do **Thor** aceito na Suíte S1; check-out do
**Bento** (32,1 kg) e do **Tofu** (4,9 kg, R$ 135,00 devolvidos), depois da ligação para a Rita;
check-in da **Sushi** (4,3 kg); pedido pela página pública do **Rufus** (Renata Figueiredo, Baia,
05 a 08/11); rotina padrão com higiene às 22:30 (aberta, não publicada).

## Arquivos compartilhados editados

- `src/locales/{pt,en,en-GB,es,sr,ar}.json`: chaves novas `hotel.reserva.saidaAtrasada`,
  `hotel.reserva.alterar.feito`, `hotel.reserva.tela.mais`, `hotel.reserva.novo.*`,
  `hotel.checkout.devolver`, `devolverNoBalcao`, `hotel.estadia.stat.saldoDevolver`,
  `hotel.estadia.nova.saida.devolver`, `hotel.orcamento.devolvido`,
  `hotel.pedidos.linha.jaTemReserva`; mudadas `hotel.reserva.chegaAs`, `saiAs` (maiúscula),
  `hotel.reserva.hospedeNaoEncontrado` (aponta o "Animal novo"); em es, 36 frases do hotel para
  usted e `clinico.meuDia.resumo.urgentes`/`pendentes`. Edições pontuais por trecho; duas levas
  (a chave `alterar.feito` e as frases do usted) por troca de texto exata em script, conferida
  depois com `JSON.parse` e o diff, sem regravar o arquivo como JSON.
- Nenhum arquivo de `components/ui`, `components/layout`, `theme`, `assets/main.css` ou stores comuns.

## Verificação final

- `npx vitest run`: 141 arquivos, **1832 testes passando** (inclui os 4 novos do hotel: saldo do
  atrasado, devolução da saída antecipada, animal novo no balcão, pedido que cruza reserva do mesmo
  animal, e o check-out antigo ajustado). Depois da última mudança na semente, `npx vitest run
  src/features/hotel src/components/home`: 25 arquivos, 424 passando.
- `npm run type-check`: sem erros.
- `npm run check:i18n`: paridade OK.
- `node scripts/lint-copy.mjs src/locales`: ok.
- `npx eslint` nos 27 arquivos tocados: sem erros. `npx oxlint`: 1 erro **antigo**, o mesmo do
  HEAD (`hospedagem-repository.ts`, variável `hospedagem` sem uso em `registrarMedicacao`, agora na
  linha 820).
- Prettier (`--write`) só nos arquivos que estavam formatados no HEAD e não são compartilhados
  (PetAvatar, HospedeCard, BemEstarDaCasa, NovaReservaDialog, OrcamentoTabela, os dois specs, os
  repositórios, `reserva-online`, as duas sementes, `types`, as duas stores, `useHotelFormat` e
  `pages/reservar/[hotel].vue`); as páginas do hotel e os diálogos de check-in, check-out e
  pedidos já vinham fora do prettier e não foram reformatados.
- Arquivos tocados: `features/hotel/components/{base/PetAvatar,estadia/CheckInDialog,estadia/CheckOutDialog,hospedes/HospedeCard,painel/BemEstarDaCasa,pedidos/PedidoDeReservaGaveta,pedidos/PedidoDeReservaLinha,reserva/NovaReservaDialog,reserva/OrcamentoTabela}.vue`,
  `features/hotel/composables/useHotelFormat.ts`, `features/hotel/data/{reserva-online,seed,seed-pedidos-de-reserva,types}.ts`,
  `features/hotel/data/repositories/{hospedagem-repository,index,reserva-repository}.ts`,
  `features/hotel/data/__tests__/{fluxo,reserva-online}.spec.ts`, `features/hotel/stores/{pedidos-de-reserva,reservas}.ts`,
  `pages/(accounts)/hotel/{acomodacoes,pedidos,reservas}.vue`, `pages/(accounts)/hotel/hospedagem/[hospedagemId].vue`,
  `pages/(accounts)/hotel/reserva/[reservaId].vue`, `pages/reservar/[hotel].vue` e os 6 locales.
