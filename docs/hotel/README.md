# Módulo hotel — requisitos e progresso

Índice dos requisitos de produto do fluxo de hospedagem. Mesma convenção do módulo clínico:
cada requisito tem documento próprio, com auditoria do que existe, lacunas e checklist.

O módulo hotel é **protótipo navegável sem API**: toda novidade entra na camada mocada
(`src/features/hotel/data/`) com o formato que o backend terá, e os repositórios devolvem a
mesma assinatura. Nenhum componente conhece `fixtures`.

## Por onde começar

| Se você quer | Abra |
|---|---|
| **Entender o produto sem ler código** | [apresentacao/Passeio-Pelo-Hotel.pdf](./apresentacao/) — 9 telas com capturas do sistema rodando |
| Ver funcionando | Ligue o módulo com `?hotel=on` e abra qualquer tela do hotel; o botão **Como usar** explica a tela por dentro |
| Entender o domínio | [01-requisitos-do-hotel.md](./01-requisitos-do-hotel.md) |
| Entender as telas | [02-fluxo-de-telas.md](./02-fluxo-de-telas.md) |

## Requisitos

| # | Requisito | Documento | Situação |
|---|-----------|-----------|----------|
| 01 | O que um hotel para animais precisa | [01-requisitos-do-hotel.md](./01-requisitos-do-hotel.md) | Levantamento completo; as 4 regras implementadas e cobertas por teste |
| 02 | Fluxo de telas do hotel | [02-fluxo-de-telas.md](./02-fluxo-de-telas.md) | **Nove telas entregues** |
| 03 | Reserva online pelo responsável — app e link público | [03-reserva-online.md](./03-reserva-online.md) | Protótipo funcionando, coberto por teste — escolher a acomodação ou o hotel escolher, urgência com o contato do hotel, caixa de pedidos do balcão, link público com cadastro mínimo, origem em Reservas |
| — | **Passeio pelo hotel** (PDF) | [apresentacao/](./apresentacao/) | O documento visual, com capturas do sistema em execução |

## A segunda rodada, e por que ela existiu

A primeira entrega foi recusada, e a frase foi esta:

> *"Olhei as telas e não entendi nada, parece que você só joga informação sem sentido, além de
> várias telas parecerem a mesma coisa visualmente, mesmo tendo outras utilidades."*

As duas críticas estavam certas, e as duas eram de desenho — não de entendimento de quem leu.

**O que estava errado.** As nove telas tinham a mesma silhueta: uma fileira de quatro cartões de
número e uma lista embaixo. Nenhuma delas *parecia* o que fazia. E nenhuma dizia para que servia:
quem chegava tinha de inferir a pergunta que a tela respondia a partir da forma dos dados.

**O que mudou.**

| Tela | Antes | Agora |
|---|---|---|
| Mapa | Quatro cartões: "8 livres" | **Grade de ocupação**: acomodações × noites, barras do que está vendido, e o buraco entre elas |
| Painel | Quatro cartões + duas listas | **Linha do tempo do dia**: chegadas em cima, saídas embaixo, "agora" marcado |
| Rotina | Cartões + lista plana | **Eixo vertical de horários**, com "para agora" separado do resto |
| Hóspedes | Tabela | **Cartões** que mudam de cor inteiros quando algo trava |
| Reservas | Tabela | Tabela **mais a faixa de véspera**: o que chega em três dias e não pode entrar |

Além disso, o menu foi reorganizado pelos quatro momentos do fluxo em vez de por tipo de objeto.

> A pergunta que cada tela responde ganhou, nessa rodada, um cartão fixo no topo de toda tela
> (`HotelCabecalho`). Ele **saiu depois**, junto com a tela de ensino: a frase migrou para o
> primeiro passo do tutorial, que é onde alguém vai procurá-la. Ver D12.

## O que está de pé

| Camada | Onde | Situação |
|---|---|---|
| Domínio | `src/features/hotel/domain/` | R1 a R4, preço, disponibilidade e rotina |
| Dados | `src/features/hotel/data/` | Dataset determinístico com 5 casos plantados, 5 repositórios |
| Stores | `src/features/hotel/stores/` | Catálogos, reservas e estadia, com invalidação única |
| Telas | `src/pages/(accounts)/hotel/` | Mapa, Reservas, Reserva, Painel, Rotina, Hóspedes, Estadia, Acomodações, Resumo |
| Idiomas | `src/locales/*.json` | 647 chaves nos seis idiomas, com plural em sr (3 formas) e ar (6) |
| Navegação | `useAppNavigation` | Seção **Hotel** em quatro blocos, atrás do interruptor oculto |

Cobertura: **mais de 200 testes do módulo**, incluindo o fluxo de ponta a ponta
(`data/__tests__/fluxo.spec.ts`), a renderização das telas com o dataset de verdade, a existência
de toda chave de tradução nos seis idiomas, e a concordância de número.

## As quatro regras, e onde elas moram

Nenhuma delas vive na tela. Regra que vive na tela é contornada pela próxima tela.

| Regra | Onde | O que trava |
|---|---|---|
| **R1** carteira vencida não entra, e "vence durante" é vencida | `domain/admissao.ts` | o check-in |
| **R2** duas estadias não ocupam a mesma acomodação | `domain/disponibilidade.ts` | a venda |
| **R3** ocorrência grave não fica no diário | `domain/estadia.ts` | o boletim e a passagem de turno |
| **R4** o que entrou tem que sair | `domain/estadia.ts` | o check-out |

## Defeitos encontrados durante a execução

### D1 · A sequência de teclas não alternava sem callback — **corrigido**

O interruptor oculto instalava o ouvinte assim:

```ts
item.aoAlternar?.(item.modulo.alternar())
```

Parece equivalente a chamar e depois avisar, e não é: **o encadeamento opcional curto-circuita a
chamada inteira, argumentos inclusive**. Sem `aoAlternar`, `alternar()` simplesmente não roda.

O defeito veio do código original de `useModuloClinico` e nunca apareceu porque o único chamador
do app sempre passa callback. Encontrado ao escrever `useModuloHotel.spec.ts`, que instala **sem**
callback de propósito. Corrigido em `useModuloOculto.ts`.

### D2 · O painel acusava documentação pendente de todo mundo — **corrigido**

O selo da lista usava `piorSituacao(itens)`, que somava ao veredito os comprovantes **não
bloqueantes** que quase ninguém tem. Resultado, visível na primeira captura de tela: *"chega hoje
sem a documentação exigida"* para todos os hóspedes. Um alarme que dispara para todo mundo não é
alarme, é ruído.

Corrigido com `situacaoParaSelo()`, que considera só o que muda uma decisão: o que impede a
entrada, o que vence no meio da estadia, e a dispensa. O que não bloqueia e falta continua
aparecendo como aviso **na tela da reserva**, que é onde alguém pode agir.

### D3 · "1 noites", "1 atrasadas", "1 diárias" — **corrigido**

A primeira rodada evitou o mecanismo de plural do projeto para não lidar com as três formas do
sérvio e as seis do árabe. O preço apareceu na primeira captura. Vinte e três chaves ganharam
plural nos seis idiomas, e `__tests__/plurais.spec.ts` guarda as duas metades: que a forma existe
no catálogo, e que o número chega como terceiro argumento do `t()` no código da tela.

### D4 · Noites contadas em blocos de 24 horas — **corrigido**

`noitesNaCasa` dividia o tempo decorrido por 24 h. Quem entrou ontem às 14h e estava na casa à 1h
da manhã aparecia com **zero noites** — enquanto a grade de ocupação, que conta por data, mostrava
a barra ocupando aquela mesma noite. Duas contas diferentes para a mesma palavra. Agora conta
meia-noite atravessada, como a grade.

### D5 · Porção de ração irreal — **corrigido**

A ficha mostrava **796 g numa refeição** para um cão de 44 kg, quase o dobro do que ele come num
dia. A porção multiplicava o peso por um número fixo; agora segue `peso^0,75`, que é como a
nutrição veterinária calcula.

### D6 · A casa não tinha passado — **corrigido**

O resumo é a única tela que olha para trás, e a captura mostrou o estrago: **ocupação média de
5%**, gráfico praticamente chapado, "retorno 0%" e o cartão de perdas com dois zeros. Nenhum
número estava errado. O mês é que não existia: toda reserva do roteiro escrito à mão começa a menos
de duas semanas de hoje, e o resumo abre nos últimos trinta dias.

O comentário do próprio `seed.ts` prometia "o recheio: as reservas de fundo que dão volume ao
mapa", e esse recheio nunca tinha sido escrito. Agora existe, e **só no passado** — encher também o
futuro tiraria do mapa os vazios entre as barras, que são a informação que aquela tela dá.

Duas decisões de dentro do recheio existem só para os números não nascerem degenerados:

- **Um terço dos responsáveis é novo** e só aparece dentro da janela do resumo. Sem isso o retorno
  nasce 100%, que é tão inútil quanto o 0% que veio corrigir.
- **Uma parte não terminou bem**: cancelamento e não comparecimento têm lastro, e o cartão de
  perdas deixa de mostrar dois zeros.

Resultado na mesma tela: 49% de ocupação, retorno de 56%, 12% de cancelamento, 8% de falta.

### D7 · O mesmo animal em quatro baias ao mesmo tempo — **corrigido**

Primeira versão do recheio, visível na lista de reservas: **"Jack" quatro vezes na mesma manhã**,
em quatro acomodações.

A invariante de sobreposição do módulo é por **acomodação**, porque é a venda que a regra R2 existe
para proteger — e ela continuava satisfeita enquanto o mesmo cachorro dormia em quatro lugares.
Gerar acomodação por acomodação foi o que abriu a brecha. O recheio agora carrega a agenda de cada
animal, incluindo a do roteiro escrito à mão, e `dataset.spec.ts` guarda a invariante nova.

### D8 · A lista de reservas abria no arquivo — **corrigido**

Consequência direta de D6: com passado, a lista passou a abrir em **129 linhas começando seis
semanas atrás**, todas encerradas. A pergunta da tela é "o que está vendido e o que vai dar
trabalho"; a resposta tinha ido para a terceira página de rolagem.

A tela abre no que vem a partir de ontem, e o arquivo mudou de lugar em vez de sumir: o controle
**Mostrar · A partir de hoje / Tudo, com histórico** fica ao lado da lista, para que ninguém
conclua que o histórico se perdeu.

### D9 · A mesma temporada, três vezes, se contradizendo — **corrigido**

A tela de configuração listava "Fim de ano" três vezes: `20/12 → 31/12`, `01/01 → 05/01` e
`20/12 → 05/01`. Nenhuma linha estava errada — eram as três pontas em que a virada do ano é
quebrada para o cálculo de preço poder comparar datas.

Só que quebrar a virada do ano é problema do preço, não de quem cadastra. O dataset passou a
carregar as duas listas, e a tela de configuração mostra a faixa **como a operação a digitou**:
`20/12 → 05/01`, sem ano, porque temporada é recorrente.

### D10 · Concordância, segunda rodada — **corrigido**

O que sobrou de D3, encontrado varrendo o catálogo atrás de chave com número e sem plural:

| Onde | O que aparecia |
|---|---|
| Reserva | "Vence em 03/10, **1 dias** antes da saída" |
| Painel do dia | "2 chegam · **1 saem**" |
| Acomodações | "Isolamento · Gigante · **cabem 1**" |
| Tela de ensino | "**7 reservas no sistema**", quando conta só as que cruzam hoje |
| Mapa | `Nenhuma acomodação livre para **{noites}** noites` |

A última não é concordância: é um **placeholder sem argumento**. A frase tinha sido reescrita e a
chamada perdeu o parâmetro; `{noites}` chegaria cru à tela. O teste de renderização do projeto
cobre sérvio e árabe, não o português, então nada apontaria para ela.

### D11 · Cancelamento datado depois da estadia — **corrigido**

Achado ao escrever D6, não na tela. `montarReserva` carimbava `canceladaEm` em "anteontem", fixo.
Com o roteiro escrito à mão, que só cancela reserva futura, sempre coube; com o recheio histórico,
uma estadia de quarenta dias atrás passaria a ter sido cancelada anteontem. Agora o cancelamento é
sempre dois dias antes da entrada.

### D12 · A tela de ensino ensinava longe do que ensinava — **substituída**

Havia uma tela `/hotel/como-funciona`, primeira do menu, e um botão que ligava parágrafos de apoio
no cabeçalho de cada tela. Os dois explicavam **longe do que explicavam**: a tela à parte ensinava
o fluxo e ficava para trás quando a pessoa ia trabalhar, e o parágrafo dizia "a coluna de
documentação é ordenável" a quem ainda não tinha visto coluna nenhuma.

No lugar dos dois, o botão **"Como usar"** abre um tutorial da própria tela: escurece o resto,
acende uma parte de cada vez e põe a frase encostada nela. Quatro a cinco passos por tela, nas nove
telas, nos seis idiomas.

Saiu junto o `HotelCabecalho`, o cartão com a pergunta da tela que abria todas as nove. Ele existia
para a tela dizer a que veio, e passou a cobrar a primeira dobra de tela por uma frase que só serve
na primeira visita — a mesma frase que o primeiro passo do tutorial agora diz, sob demanda. Com ele
foram `hotel.fluxo.*` e as nove `hotel.<tela>.pergunta`, que não tinham mais leitor.

Três defeitos do componente apareceram ao escrever o teste dele, não ao usá-lo:

| O que | Por que importava |
|---|---|
| Montar já aberto não desenhava nada | O roteiro só era montado na **transição** de fechado para aberto. Falha silenciosa: `v-if` sem passo não é erro, é tela limpa |
| Esc não fechava durante a rolagem | Os atalhos eram registrados **depois** de `mirar()`, que espera o alvo acomodar. Quem abrisse sem querer ficava esperando a animação |
| `scrollIntoView` derrubava o tutorial | O `jsdom` não implementa o método. Trazer o alvo à vista é melhoria, não requisito — a medição não depende dela |

### D13 · Reserva, check-in e check-out não conversavam — **corrigido**

Uma auditoria pedida sobre os três cadastros. Eles são momentos do **mesmo contrato**, e o que se
pergunta num deveria reaparecer no seguinte. O traço comum dos oito defeitos: **nenhum quebrava
nada**. O orçamento fechava, a tela abria, o teste passava. O que faltava era a informação
atravessar.

| # | O que acontecia | Agora |
|---|---|---|
| 1 | **Serviço vendido nunca virava trabalho.** Banho, tosa, passeio extra e recreação entravam no orçamento; `planejarDia` só gerava refeição, água, medicação, passeio e higiene. Cobrava-se o banho e ninguém era avisado de dar o banho | O serviço vira tarefa na prancheta, com a origem gravada. Por diária entra todo dia; cobrado uma vez entra no primeiro dia inteiro |
| 2 | **Não havia onde registrar medicação.** O repositório aceitava `medicacoes`, a rotina gerava as tarefas, a ficha mostrava a dose, o serviço "medicação assistida" era vendido — e `medicacoes` não aparecia em nenhum `.vue`. Só a semente criava | Bloco no check-in, com remédio, dose, via, horários e receita. Remédio sem horário trava a confirmação, porque sem horário não vira tarefa nenhuma |
| 3 | **Autorização e venda se contradiziam em silêncio.** As autorizações nasciam numa lista fixa, sem olhar a reserva: vender passeio extra e o responsável negar a saída à rua não acusava nada, e a conta seguia cobrando | A venda pré-marca o que ela exige, o selo "serviço vendido" fica ao lado, e negar acende um aviso com o nome do que foi negado |
| 4 | **A inspeção de entrada não voltava.** Carrapato, ferida e claudicação eram registrados na chegada e nunca mais mostrados | Aparece no check-out, ao lado da pesagem — é o que responde "ele já chegou assim" |
| 5 | **O peso de saída não voltava ao cadastro.** Ficava só na estadia, e `pet.pesoKg` seguia com o valor antigo — que é o que sugere o peso no próximo check-in e define o porte no preço | O check-out atualiza o cadastro |
| 6 | **A hora de entrada e saída não era editável.** Vinha fixa da política (08:00/12:00), e a meia diária da saída tardia depende da hora: o caso C1, do Bento saindo 16h30, **só existia pela semente** | Campo de hora na reserva, ao lado do período, e o orçamento refaz na hora |
| 6b | **Nem a duração.** O dia de entrada vinha do clique no mapa e as noites vinham da **busca**, lá em cima: mudar de três para cinco exigia fechar o diálogo, mexer no seletor de datas e clicar de novo na mesma célula | Contador de noites com atalhos de 1, 2, 3, 5, 7 e 15, e a vaga respondendo **enquanto** o número muda — esticar por cima da próxima reserva era recusado só no clique de confirmar |
| 7 | **Ninguém registrava quem retira o animal.** `recebidoPor`/`entreguePor` são o funcionário; a quem se entregou não existia | Lista de autorizados na reserva, conferência no check-out, e o nome gravado. Entregar a quem não está na lista continua possível e fica registrado |
| 8 | **A adaptação não podia mudar.** Nascia `em-adaptacao` no check-in e nenhuma tela a alterava — e a tela de Hóspedes é construída em volta desse selo | Seletor na tela da estadia |

O que **não** entrou: o acompanhante continua cobrado na reserva e sem estadia própria — ver a
lacuna abaixo. As costuras corrigidas estão guardadas em
`src/features/hotel/__tests__/ligacao-do-fluxo.spec.ts`.

Dois defeitos apareceram só ao conferir na tela, e nenhum dos dois quebrava o typecheck:

- **`<SelectButton>` sem import** virou elemento HTML desconhecido. A página montava, o seletor de
  adaptação simplesmente não existia — e o `vue-tsc` não reclama de componente não resolvido.
- **Duas instruções num `@click`** passaram pelos tipos e derrubaram o `build`. O template do Vue
  aceita uma expressão; o handler virou função.

### D14 · O hóspede virou um rosto — **feito**

Pedido direto: o animal devia aparecer com avatar em toda menção. Existia só a inicial num círculo,
e em um lugar só — o cartão da tela de Hóspedes.

`PetAvatar` entrou em **onze pontos**: cartão do hóspede, barras do mapa, trilho do dia, linhas da
prancheta, tabela de reservas, faixa de véspera, lista de espera, passagem de turno e os cabeçalhos
de reserva e estadia — com o acompanhante encostado no principal quando a reserva tem dois.

**Sobre a foto.** `Pet` ganhou `fotoUrl`, e o componente a usa quando ela existe. A camada mocada
fica com o campo vazio de propósito: povoar o repositório de retratos inventados criaria imagens
que alguém acabaria tomando por dado real. Enquanto a API não traz o retrato, o avatar desenha o
que o cadastro tem — as iniciais, a silhueta da espécie, e **uma cor fixa por animal tirada do
nome**. A cor é derivada e não sorteada: a mesma Mel tem o mesmo tom na lista, no mapa e na
prancheta, e cor que muda entre telas é pior que cor nenhuma, porque ensina a não confiar nela.

Um defeito apareceu ao escrever o teste: um **comentário acima do elemento raiz** transforma o
componente em fragmento, e fragmento não repassa o `class` do pai — o avatar do acompanhante
perdia o deslocamento que o encosta no principal. O comentário desceu para dentro da raiz.

### D15 · O painel do dia estava agressivo e confuso — **refeito**

A crítica, literal: *"visualmente agressiva e um pouco confusa ainda, gostei da ideia da linha de
tempo, mas deve melhorar"*. Três causas, e nenhuma era a linha do tempo em si.

**Uma parede de vermelho.** Os dois avisos eram faixas rosa de ponta a ponta da tela, com título
vermelho por cima. Duas paredes vermelhas lado a lado não somam urgência — elas se anulam, e levam
o resto da tela junto. Agora o sinal é uma **barra de 3px na lateral** e um ícone tonal; a
superfície do aviso voltou a ser a mesma de qualquer outro cartão.

**O relógio gastava o vermelho.** O "agora" era uma barra grossa com selo vermelho, do mesmo tom
dos avisos que travam a operação. Vermelho que diz "são 12h20" faz o vermelho que diz "ligue para o
responsável" valer menos. Agora o que passou fica **sombreado** e o instante é um fio fino na cor
de acento, com a hora escrita em vez da palavra "agora".

**A tela dizia a mesma coisa duas vezes.** "09:30 Sushi" no trilho e "09:30 Sushi · Gatil G2 ·
Daniel Okamoto" na lista logo abaixo — duas renderizações do mesmo fato leem como duas
informações, e era daí que vinha o "confusa". A marca **perdeu o nome**: mostra hora e rosto, e o
avatar carrega a identidade em 18 px. O trilho responde **quando**; a lista responde **quem e o
quê**. De quebra, a marca agora cabe num dia de quinze movimentos, e não só de três.

Mais três acertos menores: a frase-resumo virou o **cabeçalho do cartão do dia** em vez de flutuar
entre dois blocos; as horas são rotuladas de duas em duas, porque dezessete rótulos seguidos viram
cerca e não escala; e a haste que liga a marca ao trilho ficou visível — quase invisível, ela
deixava as pastilhas boiando acima de uma régua.

**A barra lateral durou uma versão.** A correção do vermelho trocou o preenchimento por uma barra
colorida na lateral do aviso, e a resposta foi direta: *"muita cara de IA"*. É justo — a barra
aparece em todo aviso de todo template, não diz nada que o ícone já não diga, e deixa a tela com
cara de peça pronta. Ficou o cartão comum, com a urgência num **disco cheio** de 28 px. O mesmo
corte valeu para o cartão de hóspede em risco, que tinha a mesma barra.

**As duas listas viraram um cartão cada.** Cada linha era uma caixa com borda própria, sob um
título solto: para ler dois hóspedes o olho atravessava três molduras. Agora a moldura é uma só, as
linhas se separam por um filete, a hora tem coluna fixa com numeral tabular — e cada linha mostra o
rosto do hóspede, como o resto do módulo. O cabeçalho ganhou um disco com a seta que entra e a seta
que sai, para as duas listas parecidas se distinguirem sem ler o título.

### D16 · A passagem de turno era uma tira de mil pixels — **refeita**

Treze pendências numa coluna só, cada uma em duas linhas: o diálogo tinha quase mil pixels de
altura, com rolagem, e o campo de assinatura — que é o gesto que fecha tudo — ficava fora da vista.

**O inventário virou grade.** Duas ou três colunas conforme a largura, e a mesma lista cabe em
cinco linhas: 250 px em vez de 600. Foi possível porque cada item foi reduzido ao que se lê de
relance — hora, rosto, o que é e onde. A grade também muda a leitura: em coluna única o olho
percorre; em grade ele varre, que é o que se faz com um inventário.

**A lista estava na ordem errada.** Saía agrupada por hóspede — as três do Thor, depois as três do
Bento —, porque era a ordem em que as tarefas nascem. Quem assume o turno não pergunta "o que falta
do Thor": pergunta o que vem primeiro. Agora `pendenciasDoTurno` devolve em ordem de relógio, e um
teste guarda isso.

**Faltava o dia.** Ordenada, a lista revelou o que a desordem escondia: **seis das treze pendências
eram de ontem**. E a linha mostrava só `HH:MM` — a água que ninguém trocou ontem às 07:00 aparecia
idêntica à que vence hoje às 07:00. Numa passagem de turno essa diferença é a informação inteira, e
agora a data aparece em âmbar sobre a hora quando a pendência não é do dia.

Mais: o cabeçalho virou **entrega → assume**, com o turno de cada lado; a assinatura ganhou bloco
próprio, separada do inventário, porque solta logo abaixo da lista ela parecia mais um item dela; e
o bloco de impedimento passou a seguir o padrão do painel — cartão branco com a urgência num disco
cheio, em vez de preenchimento rosa de ponta a ponta.

Um detalhe que só apareceu na tela: a primeira versão da grade desenhava as divisórias com o truque
de fundo escuro no contêiner e vão de 1px entre os itens. Funciona com a grade cheia — na última
fileira, as células que sobram viram **buracos cinzas**, e buraco emparelhado com conteúdo lê como
algo que faltou carregar. Cada pendência virou um cartão independente, que não tem última fileira.

Duas coisas ficaram abertas e o usuário as apontou: **"quanto à entrega, como vamos saber os
horários?"** O cabeçalho dizia só *Manhã → Tarde*. Nome de turno não é horário: quem assume precisa
saber até quando responde, e quem entrega precisa saber que não está deixando buraco. `seguinte` no
envelope da passagem carregava apenas `kind` e `responsavelId`; agora carrega `inicio` e `fim`, e o
cabeçalho lê **entrega Manhã 06:00–14:00 → assume Tarde 14:00–22:00**.

E os cartões tinham alturas diferentes, porque três das treze pendências são refeições e trazem uma
terceira linha com a ração e a gramatura. Numa fileira de três, dois cartões de 60 px ao lado de um
de 74 px desalinham a fileira inteira. A primeira tentativa foi um `min-height` em rem — e a medição
devolveu `[58, 60]`, ainda dois valores, porque a base do rem não coincidia com a altura natural.
O que resolve sem número escrito à mão é `grid-auto-rows: 1fr`: a grade mede a fileira mais alta e
dá essa altura a todas. Medido de novo, `[60]` — um valor só.

Um efeito colateral de dois pixels: com as fileiras equalizadas a grade passou a somar 322 px, e o
teto de 20 rem cortava em 320. A lista inteira ganhava barra de rolagem para esconder nada. O teto
subiu para 26 rem.

### D17 · A prancheta do turno — **refeita, e três defeitos que ela escondia**

O pedido era de acabamento: *"a ideia dela é muito boa, mantém, só deixa mais bonito"*. A ideia
ficou inteira — eixo de horas à esquerda, tarefas à direita. O que a medição achou embaixo dela
não era acabamento.

**"Para agora" era três quartos ruído.** A seção que existe para responder *o que eu faço agora*
tinha, medidas na tela, **21 linhas das quais 16 já estavam feitas**. A causa: a classificação era
por **bloco de horário**, não por tarefa — bastava uma pendência às 07:00 para as outras vinte
daquele horário irem junto. Agora cada tarefa vai para o seu tempo, e um mesmo horário pode sair
em dois: o que falta em cima, o que foi resolvido no recolhido. A regra saiu da tela para o
domínio, como `repartirPorTempo`, com cinco testes — entre eles o de que recusada e pulada contam
como passado, e o de que horário sem linhas não vira bloco vazio.

**A etiqueta da hora tinha 220 px de altura.** No CSS ela é um chip de 22. `.horario__eixo` é uma
grade de duas fileiras automáticas, e `align-content` em grade vale `stretch` por padrão: as duas
fileiras cresciam para preencher o bloco, e a etiqueta crescia junto. O resultado era uma coluna
verde-escura descendo ao lado das tarefas — o "visualmente agressivo" da tela, e era um bug, não
uma escolha. `grid-template-rows: auto 1fr` deixa a hora do tamanho da hora e faz crescer o fio,
que é o que deve crescer.

**Num telefone, o botão "Feita" ficava fora da tela.** A linha media **510 px num viewport de
420**, e o `overflow: clip` do quadro da página cortava o excesso — justamente a borda direita,
onde moram os botões. A origem era o filtro: seis botões numa fileira flex que não quebra fixam um
piso de 566 px, e como a barra é irmã da lista na mesma grade, esse piso virava a largura da tela
inteira. Um controle que ninguém usa em pé derrubava a única coisa que se faz em pé. Com o filtro
quebrando linha, a linha caiu para 337 px e nada mais excede o viewport.

**O resto do acabamento.** A urgência saiu da linha e foi para o disco do ícone: cinco tarefas
atrasadas eram cinco faixas rosa de ponta a ponta, e agora a superfície é a mesma em todas as
linhas — uma só cor de fundo, medida. O botão principal passou a ser o último da fileira, porque à
esquerda do grupo ele nascia em dois `x` diferentes conforme a linha tivesse ou não o "Recusou" ao
lado; encostado na borda, cai sempre no mesmo lugar, e o teste fixa a ordem dizendo por quê. Saiu
o "Marcada às 07:00" repetido embaixo de cada tarefa de um bloco que já tem 07:00 escrito no eixo
— agora a hora só aparece quando discorda da prevista, que é quando ela é informação.

**O vão dentro da linha virou coluna — depois de uma tentativa errada.** Solta, a linha esticava
até a borda do monitor: o nome do animal à esquerda e o botão "Feita" quase mil pixels depois. A
primeira saída foi estreitar a prancheta a 58 rem, e ela trocou um defeito por outro — numa tela
larga sobrava um terço vazio à direita, e tela com um lado vazio lê como layout quebrado, não como
escolha. A saída que atende os dois é a lista em colunas: a largura vira **mais tarefas visíveis**
em vez de mais vão dentro da mesma tarefa. `auto-fill` com piso de 32 rem decide sozinho — uma
coluna no telefone, duas num monitor comum, três num muito largo. Dentro de um mesmo horário a
ordem entre as tarefas não carrega informação, então varrer em grade não perde nada.

**E o filtro aparecia sem estilo nenhum.** Relatado como "TodasRefeiçãoMedicação…", texto corrido
sem botão. No ambiente de teste ele renderizava certo, o que quase virou um "não reproduz". A
causa saiu de um experimento: apagando na página as 23 regras que o PrimeVue injeta para
`ToggleButton`, o filtro caiu de 566 px para **360** e a barra de progresso subiu para 559 — os
mesmos números da tela relatada, ao pixel. O estilo dos componentes do PrimeVue 4 é injetado em
**tempo de execução**, e numa sessão longa de desenvolvimento essa injeção pode se perder; um
recarregamento forte a traz de volta. Mas controle que fica ilegível quando isso acontece é
frágil, e o `clinic-tokens.css` já declarava metade da aparência do segmento — cor de borda, raio
e fundo. Faltavam as medidas da caixa. Agora estão escritas, com os mesmos valores do PrimeVue:
não mudam nada quando ele está lá, e mantêm o botão sendo um botão quando não está.

**O filtro acabou recolhido, depois de duas formas recusadas.** A barra segmentada foi julgada
"feia e nada profissional", e com razão: seis segmentos lado a lado ocupavam 566 px do topo e
pesavam mais que a lista que filtram. Agora é um `Select` de 13 rem que mostra **só os tipos que
existem hoje, com quantos são** — a contagem é o que decide se vale a pena filtrar antes de
filtrar —, e o primeiro item é "Todas as tarefas" escrito, porque antes o estado "sem filtro" era
a ausência de seleção, que não é um lugar que se saiba como alcançar. O preço são dois toques em
vez de um, cobrados só de quem filtra; o que se faz nesta tela é marcar tarefa, não filtrar. Uma
sutileza do recolhimento: o painel é teleportado para fora da página, então `:deep` a partir da
tela não alcança a linha dele — quem alcança é o conteúdo do slot, que leva o atributo de escopo
junto, e por isso a fileira de rótulo e contagem é montada dentro do que é nosso.

**O que mais foi acrescentado.** A barra de progresso mostra em forma o que a frase diz em
número, com a fatia atrasada marcada. O cabeçalho passou a dizer **qual turno é e até que horas
vai** — a tela se chama "Rotina do turno" e não dizia de que turno —, e disso veio uma régua em
"Mais tarde hoje" marcando onde o turno acaba: sem ela, quem lê às 13h planeja a tarde em cima de
um passeio das 16:00 que vai entregar na passagem.

E **marcar o horário inteiro de uma vez**. O trabalho acontece em ronda: às 08:00 alguém serve
dezoito comedouros e só depois pega o telefone. O comentário de `marcarTarefa` já falava em "quem
está marcando as dezoito da manhã", mas não havia como marcar as dezoito senão uma a uma — que é
a razão de prancheta ser preenchida de memória no fim do turno, e prancheta preenchida de memória
não vale nada. Só marca "feita", nunca "recusou": recusa é observação de um animal específico e
não se aplica em lote. E vai uma por vez, parando na primeira falha, porque metade marcada sem
dizer qual metade é pior que nenhuma.

### D18 · A prancheta não escalava para um hotel cheio — **agrupada em rondas**

A pergunta veio do usuário, não de uma medição: *"pensa que o hotel cuida de 30–50 pets
diariamente, essa tela ficaria organizada?"* Medido com a casa cheia — 17 hóspedes, que é metade
do que ele descreve — a resposta era não: **159 tarefas, 94 linhas na tela, 3740 px de altura,
quatro telas de rolagem para um dia**. E o maior bloco, às 18:00, tinha 29 linhas.

**A unidade de trabalho do canil não é a hora, é a ronda.** Às 18:00 alguém serve a ração de vinte
cães e só depois volta para trocar a água dos vinte — não faz uma coisa de cada animal antes de
passar ao seguinte. Com cinco hóspedes isso não aparecia, porque cinco linhas soltas num horário
se leem como uma lista. Com a casa cheia, o horário virou uma parede.

Agrupado por `(horário × tipo)`, o mesmo bloco das 18:00 vira duas linhas — "Refeição, 20 animais"
e "Água, 9" — e as vinte ficam a um toque para quem quiser conferir nome por nome. Medido de novo
com os mesmos 17 hóspedes: **1577 px, 1,7 tela**, 22 linhas visíveis em vez de 94. E, ao contrário
da versão anterior, a altura quase não cresce quando entram mais animais: o que cresce é a
contagem dentro do cabeçalho da ronda.

**A regra que serve aos dois tamanhos é o tamanho da própria ronda.** Ronda de até seis animais
nasce aberta; acima disso, recolhida. Num hotel de cinco, toda ronda cabe nesse limite e a tela
abre como sempre abriu — medido: doze rondas, **doze abertas, nenhuma recolhida**. Num hotel de
quarenta, só as curtas ficam abertas, e a ronda de medicação com dois animais continua à vista
enquanto a de ração com quarenta espera ser aberta. Nenhum número de configuração, nenhuma tela de
preferências: a mesma regra atende a casa pequena e a grande porque lê o que a casa tem.

**Dois detalhes que só apareceram depois de agrupar.** Ronda de **um** animal não ganha cabeçalho:
"Refeição · 1 animal" acima de uma linha que já diz tudo isso custa uma fileira para economizar
nenhuma, e num hotel pequeno quase toda ronda é assim — sem essa exceção, agrupar **alongaria** a
tela de quem tem cinco hóspedes para resolver o problema de quem tem quarenta. E dentro de uma
ronda aberta o nome do serviço sai da linha: vinte linhas começando por "Refeição" enterram a
única coisa que muda entre elas, que é de quem é. Aberta a ronda, o animal passa a ser o título.

O custo honesto: os cabeçalhos somam **259 px** à casa de cinco hóspedes (1642 contra 1383), seis
cabeçalhos a 43 px. É o preço de a casa de quarenta caber em duas telas em vez de dez.

**E o lote passou a ser da ronda, não do horário** — o que conserta um defeito da rodada anterior.
Marcar "todas as deste horário" às 18:00 seriam 29 tarefas de dois tipos num toque, e num horário
com medicação marcaria medicação junto. Ronda é um serviço só, que é o escopo que a pessoa de fato
executou. **Medicação não aceita lote, e o botão nem aparece nela:** servir quarenta comedouros é
um gesto repetido; dar remédio são quarenta decisões, cada uma com dose e animal próprios. Um
toque que grava "medicação dada" para doze animais produz exatamente o registro que ninguém pode
conferir depois.

De quebra, o tutorial da tela prometia que o atrasado "sobe para o topo **em vermelho**" — o
vermelho saiu quando a urgência migrou para o disco do ícone, rodadas atrás, e o texto ficou. Foi
corrigido nos seis idiomas, e ganhou um passo novo sobre a ronda.

### D19 · As telas eram corretas e frias — **ícones de domínio, e o que a escala ainda escondia**

Dois pedidos na mesma frase: que quem cuida de muitos animais não se perca, e que as telas
deixassem de ser "super frias, sem ícones fofos", mas continuassem profissionais.

**Os ícones não eram só frios: eram errados.** A primeira versão pegou emprestado o que o conjunto
genérico do framework tinha, e o resultado dizia **sacola de compras** para refeição, **nuvem**
para água, **sol** para banho e **gráfico de barras** para pesagem. Isso não é só falta de graça —
um ícone que mostra uma sacola onde há uma tigela ensina a não olhar para os ícones, e daí a
coluna inteira vira enfeite. Quem trabalha no canil varre a prancheta pelo desenho antes de ler a
palavra; se o desenho mente, a varredura morre.

A primeira tentativa de conserto foi desenhar o conjunto à mão em SVG, e foi recusada na hora, com
razão: *"não quero nenhum ícone criado por SVG ou HTML, instala libs de ícones de confiança"*.
Entrou o **`@phosphor-icons/vue`**, que tem o vocabulário deste domínio pronto e desenhado por quem
desenha ícones: tigela de comida, gota, cápsula, pata, bolinha, vassoura, banheira, tesoura,
ossinho, balança. O peso é `duotone` — a silhueta preenchida em transparência sob o contorno deixa
o ícone cheio e macio a 17 px, que é o tamanho dele dentro do disco, onde um traço fino vira risco
ilegível; e usa uma cor só, então continua obedecendo a regra de que o estado mora no disco.

Duas notas de engenharia. O mapa `TarefaKind → ícone` estava **copiado em dois componentes**, e
cópia de mapa diverge: agora é um `Record<TarefaKind, Component>` num lugar só, o que faz de
"serviço novo sem ícone" um erro de compilação em vez de um quadrado vazio em produção. E o medo
legítimo de importar de um barril de 1512 ícones foi medido: com importação nomeada, o chunk da
rotina inteiro ficou em **10,3 kB** (3,5 gzip) e o `index` não mudou de tamanho — o tree-shaking
do Vite leva só os dez.

O `PetAvatar` também tinha duas silhuetas de cão e gato escritas à mão; saíram pelas do mesmo
conjunto, e o gato do avatar passou a vir da mesma mão que a pata do passeio. **Um teste pegou um
erro meu no caminho:** eu tinha posto uma pata genérica para quem não é cão nem gato, e havia
teste guardando o contrário. O teste estava certo duas vezes — a silhueta genérica não distingue
nada, que é a única função dela, e mente sobre a ave, que não tem pata de almofadinha. De quebra,
o comentário antigo do arquivo prometia essa pata e o código nunca a desenhou; agora os dois dizem
a mesma coisa.

E o "nada pendente neste momento" deixou de ser um ícone de confirmação num retângulo: é o único
momento da tela em que ninguém está com pressa, e virou o lugar onde a tela respira.

**O filtro recolhido ganhou a mesma fileira das opções**: ícone, nome e quantos. Sem o ícone no
valor fechado, abrir a lista trocava a forma do que se estava lendo; sem a contagem, quem filtrou
por "Refeição" perdia de vista quantas são — que é justamente o número que fez escolher aquele
filtro. A largura subiu de 13 para 15,5 rem porque, medido, "Todas as tarefas" truncava em "Todas
as tar…" depois que o ícone entrou. Os ícones alcançam o painel mesmo teleportado porque moram
dentro do conteúdo do slot, que leva o atributo de escopo junto.

**Sobre não se perder com muitos animais**, duas coisas que só a escala revela. A ronda agora diz
**quantas já foram resolvidas**: quem marca doze de quarenta via a ronda encolher para vinte e
oito sem nada dizendo que as doze tinham sido suas, e num hotel grande é aí que se perde a conta e
se marca de novo o que já estava feito. E o **cabeçalho da ronda gruda no topo** enquanto ela
passa: aberta, uma ronda de quarenta ocupa mais de uma tela, e rolando some o nome do serviço —
fica só uma coluna de nomes de bicho igual à ronda de cima. Grudado, o "Refeição · 40 animais"
acompanha a rolagem, e com ele o botão de marcar a ronda inteira, que é o que se quer à mão
depois de percorrer o corredor todo.

## Fora do escopo desta rodada

- **O acompanhante é cobrado e não é operado.** A reserva aceita um segundo animal da mesma casa e
  o orçamento cobra a linha "acompanhante" — recalculada até no check-out. Mas o check-in cria
  **uma** estadia, com o pet principal: o segundo animal não tem peso de entrada, pertences, plano
  alimentar, rotina nem conferência de saída. Resolver exige decidir entre uma estadia por animal
  ou bloquear o acompanhante, e a decisão é de produto.

- **Um teste do módulo clínico falha, e não é deste trabalho.**
  `src/features/clinico/data/__tests__/estoque-dataset.spec.ts` quebra em "cobre as três situações
  de saldo por vacina". Verificado com `git stash`: falha igual numa árvore limpa. É
  sensibilidade a data — o dataset clínico é ancorado em *hoje*, e a virada do dia deixou de
  produzir um lote "abaixo do mínimo". Precisa de um plantio determinístico no seed clínico, como
  o hotel faz com os casos difíceis.

## Convenções destes documentos

- **Estado atual** é auditoria de código, não memória: cada afirmação aponta o arquivo.
- **Lacuna** é o que o requisito pede e o código não faz. O que já existe não vira tarefa.
- Checkbox marcado significa **implementado e visível no protótipo**, não "código escrito".
- Termo em texto visível pt: **"responsável"**, nunca "tutor". `tutorId` sobrevive como
  identificador de código e campo de API.

## Como abrir o módulo

Nasce desligado, como o clínico. Para ligar:

- **Link**: `?hotel=on` em qualquer rota do portal.
- **Teclado**: digitar `hotel` em qualquer tela, fora de campo de texto.

Para desligar: `?hotel=off`, ou digitar a sequência de novo. O desbloqueio pertence à conta que o
ligou — outra conta na mesma máquina não o herda. Os dois módulos são independentes: ligar o hotel
não acende a clínica.

Com o módulo ligado, o **painel de demonstração** aparece no canto inferior de toda tela do hotel:
latência, modo offline, erro por operação, e um botão para cada um dos cinco casos plantados.

## Os cinco casos plantados

Existem em qualquer semente, todo dia, sem ninguém precisar criá-los. Um protótipo em que o caso
difícil só aparece se o apresentador souber montá-lo é um protótipo que nunca mostra o caso
difícil.

| # | Caso | Onde |
|---|---|---|
| C1 | Saída às 16h30 com pertence pendente e sem pesagem | Hóspedes → Bento |
| C2 | Recusa alimentar grave sem contato: boletim retido e turno travado | Painel → Tofu |
| C3 | Chega hoje sem a vacina da tosse dos canis: check-in bloqueado | Reservas → Zeus |
| C4 | Antirrábica que vence no meio da estadia | Reservas → Bidu |
| C5 | Baia em reforma há três semanas | Acomodações → A7 |
