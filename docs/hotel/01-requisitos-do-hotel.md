# 01 · O que um hotel para animais precisa

> Levantamento do domínio, escrito antes da primeira tela. Não é lista de funcionalidades: é a
> descrição do trabalho que acontece num hotel de hospedagem, na ordem em que ele acontece, com
> as regras que o software precisa segurar **porque ninguém consegue segurar de cabeça**.

Escopo desta rodada: **a visão do hotel**. O que o responsável vê no aplicativo entra depois, e
está marcado ao longo do texto como `→ app`. O que o hotel precisa registrar para que o app tenha
o que mostrar entra agora — a ordem inversa produziria um app bonito alimentado por nada.

---

## Por que o hotel não é a internação com outro nome

As duas hospedam um animal por dias, em um lugar nomeado, com rotina prescrita e alguém de
plantão. A tentação de reaproveitar a internação é grande e está errada, por quatro motivos que
mudam o modelo de dados inteiro:

1. **A internação começa hoje; a hospedagem começa em 22 de dezembro.** Internação é decidida
   dentro de uma consulta e executada no mesmo instante. Hospedagem é **vendida com antecedência**
   e o que se vende é um período futuro numa acomodação específica. Isso torna a **reserva** — e
   não a estadia — a entidade central, com tudo o que reserva implica: disponibilidade por
   intervalo, orçamento antes da entrada, sinal, cancelamento com política, não comparecimento.

2. **Na internação o animal está doente; no hotel ele está bem — e precisa continuar.** A
   internação mede sinais vitais porque eles mudam. O hotel observa **comportamento, apetite e
   eliminação**, porque a primeira notícia de que algo está errado num animal saudável longe de
   casa é ele parar de comer. A pergunta clínica é "melhorou?"; a pergunta do hotel é "está
   adaptado?".

3. **A internação não tem porta de entrada; o hotel tem, e ela é sanitária.** Um paciente grave
   entra na UTI com a vacina vencida, porque o risco de não entrar é maior. Um hóspede com a
   V10 vencida **não entra**, porque ele vai dividir o ar e o gramado com outros trinta. A
   exigência de admissão é a regra que mais gera conflito no balcão e a que mais precisa estar
   decidida antes de o carro chegar.

4. **A internação é um custo que o responsável aceita; a hospedagem é uma compra que ele
   compara.** Diária por porte, alta temporada, meia diária, taxa de saída tardia, banho de
   saída, transporte. Preço não é um campo no fim do cadastro: é metade da conversa da reserva,
   e é a conta que o balcão precisa fazer **na frente do cliente, sem calculadora**.

Há reaproveitamento real — e ele está na **fundação visual e no cadastro de pessoas**, não no
domínio. Pet e responsável são cadastro da casa, compartilhado. Tokens, tabela densa, barra de
filtros, cartão de número e as regras de acessibilidade do módulo clínico são a linguagem do
portal, e o hotel a consome em vez de inventar outra.

---

## As quatro regras que dão espinha ao módulo

Tudo o mais é tela. Estas quatro são **regra de servidor** — moram no domínio e no repositório,
nunca na apresentação, porque uma regra que vive na tela é contornada pela próxima tela.

### R1 · Carteira vencida não entra — e "vence durante" é vencida

A exigência de admissão não é checada contra **hoje**: é checada contra **o último dia da
estadia**. Uma antirrábica que vence no dia 27 não serve para uma reserva que sai no dia 30, e
descobrir isso no dia 27 significa telefonar para alguém que está a 600 km dali.

O estado derivado tem cinco valores, e os cinco aparecem na tela com palavra própria:

| Estado | O que é | Onde aparece |
|---|---|---|
| `ok` | Comprovante válido para todo o período | Verde discreto, sem alarme |
| `vence-durante` | Válido na entrada, vencido antes da saída | **Âmbar, na reserva, desde a criação** |
| `vencido` | Já vencido | Vermelho, bloqueia o check-in |
| `ausente` | Nunca apresentado | Vermelho, bloqueia o check-in |
| `dispensado` | Dispensa registrada, com motivo e quem autorizou | Cinza, com o nome de quem assinou |

`dispensado` existe porque a alternativa é pior. Sem ele, o hotel que decide aceitar um hóspede
sem o comprovante de giárdia faz isso **fora do sistema** — e some o registro de que alguém
decidiu, quem decidiu e por quê. A dispensa nominal transforma uma burla numa decisão auditável.

### R2 · Duas estadias não ocupam a mesma acomodação — e entre elas existe higienização

Sobreposição de reserva é o defeito que destrói a confiança num sistema de hospedagem, e ele
quase nunca é "duas reservas exatamente no mesmo dia": é a saída do dia 20 às 18h contra a
entrada do dia 20 às 8h. Por isso a checagem é por **instante**, não por data, e soma a **janela
de higienização** da acomodação — o tempo que a baia leva para ser lavada e secar.

A vaga oferecida ao telefone é a vaga que o mapa mostra. Não há segunda fonte.

### R3 · Ocorrência grave não fica no diário

Briga com lesão, recusa alimentar por mais de 24 h, vômito com sangue, tentativa de fuga: o
responsável fica sabendo **por voz**, antes do fim do turno. Mesma regra do boletim de internação,
pelo mesmo motivo: notícia ruim que chega por notificação de aplicativo transforma um diferencial
de produto num processo. O registro trava o encerramento do turno enquanto não houver contato
registrado, com quem falou e a que horas.

Ocorrência leve — comeu metade, fez xixi fora, latiu à noite — vai para o diário e vira conteúdo
do boletim do dia. A diferença entre as duas é `gravidade`, e ela é escolhida por quem registra.

### R4 · O que entrou tem que sair

Coleira, caminha, brinquedo, cobertor, pote, a ração em saco marcado com o nome, a medicação com
a receita. Pertence perdido é a reclamação mais barata de evitar e a mais cara de resolver: custa
uma linha no check-in e uma conferência no check-out, e sem elas custa um cliente.

O check-out não fecha com pertence pendente sem alguém registrar o que houve.

---

## O fluxo, na ordem em que acontece

### 1 · Reserva

A pergunta que chega por telefone é sempre a mesma: **"tem vaga do dia 22 ao dia 30 para um
labrador?"**. Responder exige, na mesma tela e antes de cadastrar nada:

- disponibilidade no intervalo, **por acomodação compatível** (porte, espécie, capacidade);
- o preço do período, já com temporada e serviços;
- o que falta de documento para esse animal poder entrar.

O que a reserva guarda:

| Campo | Por quê |
|---|---|
| Pet, responsável, acomodação | A reserva é de um lugar, não de "uma vaga" |
| Entrada e saída **previstas**, com hora | Hora decide meia diária e ordem do dia |
| Nº de diárias calculado | Regra de contagem explícita, nunca "dias entre datas" |
| Origem (telefone, balcão, app, WhatsApp, retorno) | Diz onde investir; retorno é o número que importa |
| Serviços contratados | Banho de saída, passeio extra, transporte, adestramento |
| Orçamento congelado | Preço mudou depois não altera o que foi combinado |
| Sinal pago | O que separa reserva de intenção em alta temporada |
| Observação do responsável | "Ele tem medo de trovão" precisa de um lugar |
| Exigências e comprovantes | R1, desde a criação da reserva |

Estados: `pendente` → `confirmada` → `hospedado` → `encerrada`; e as saídas `cancelada` (com
motivo) e `nao-compareceu`. Não comparecimento é distinto de cancelamento pelo mesmo motivo que
falta é distinta de cancelamento na agenda clínica: um é aviso, o outro é vaga queimada, e só o
segundo tem política de sinal.

**Acompanhante.** Dois animais da mesma casa dividem acomodação e a cobrança é diferente. A
capacidade da acomodação e a diária de acompanhante existem por isso.

**Lista de espera.** Alta temporada lota. Quando uma reserva cai, quem estava esperando por
aquele intervalo e aquele porte precisa ser chamado — em ordem, com prazo de resposta.

`→ app` Solicitação de reserva pelo responsável, com aprovação do hotel.

### 2 · Pré-chegada

Entre a reserva e a entrada há uma janela em que o hotel ainda consegue resolver problema sem
ninguém no balcão. O que ela contém:

- **Confirmação de véspera**, com o que trazer.
- **Pendência de documento** que ainda não chegou — e o tempo que ela tem de vida.
- **Ficha de hospedagem**: plano alimentar, medicação em uso, rotina de casa, medos, comandos que
  o animal conhece, contato de emergência e o **veterinário de confiança**.
- **Autorizações**: banho, passeio fora do hotel, recreação em grupo, foto em rede social,
  atendimento veterinário de urgência com teto de gasto. Cada uma é um sim ou não registrado, com
  data — não um parágrafo de termo que ninguém lê.

### 3 · Check-in

É o momento mais denso do dia e o que mais erra quando é feito de cabeça. O roteiro:

1. Conferir exigências (R1). Vencido para, ou é dispensado por alguém com nome.
2. **Pesar.** O peso de entrada é a referência do que vai ser cobrado de dose e é a prova de
   quanto o animal perdeu ou ganhou na estadia.
3. Inspeção rápida: carrapato, pulga, ferida, claudicação, estado de pelo. O que está errado
   **antes** de entrar precisa estar escrito antes de entrar.
4. **Pertences**, item a item (R4).
5. Plano alimentar: ração própria ou da casa, marca, gramatura, horários, petiscos, restrições.
6. Medicação: o que dar, dose, via, horários, até quando, e com qual receita.
7. Autorizações e termo, assinados.
8. Acomodação atribuída e ocupada. Reserva vira **hospedagem**.

### 4 · A estadia

O trabalho de todo dia, que é o que o hotel de fato vende:

- **Rotina prevista**, gerada da ficha: refeições nos horários, medicação nos horários, passeios,
  recreação, higiene da acomodação, troca de água. Cada uma é uma tarefa com hora e alguém que a
  marca como feita — e uma tarefa recusada (não comeu) é informação clínica, não um item pendente.
- **Diário do hóspede**: o que ele fez, com foto. É o conteúdo do boletim e é o motivo pelo qual o
  responsável recontrata.
- **Ocorrências** (R3).
- **Grupos de recreação**: quem sai com quem. Porte e temperamento decidem, e há incompatibilidade
  registrada — dois animais que brigaram não voltam a sair juntos.
- **Passagem de turno**: o que ficou pendente, quem assume, o que o próximo turno precisa saber.
- **Boletim ao responsável**, na frequência combinada, com foto. `→ app`

**Prorrogação e antecipação.** O voo atrasou; a saída muda. Prorrogar exige a acomodação livre no
período novo (R2) e recalcula o orçamento. É a operação que mais acontece e a que menos costuma
estar prevista.

### 5 · Check-out

1. Conferência de pertences (R4).
2. **Pesagem de saída**, comparada com a de entrada.
3. Relatório da estadia: como foi, o que comeu, o que aconteceu, com as fotos. É o documento que
   o responsável lê no carro e manda para a família. `→ app`
4. Fechamento financeiro: diárias, serviços, extras, taxa de saída tardia, menos o sinal.
5. Acomodação vai para **higienização** — e só depois volta a ser oferecida (R2).
6. Próxima reserva: quem acabou de ter uma boa experiência é quem mais marca de novo.

**Saída tardia.** Há um horário de saída. Depois dele, cobra-se meia diária; depois de um segundo
limite, a diária inteira. A regra precisa estar visível **na reserva**, não descoberta no balcão.

---

## Cadastro da casa — o que a operação configura

O sistema não adivinha como o hotel é. Ele pergunta.

### Acomodações

Unidade de ocupação, com nome próprio. `kind` não é decoração: decide quem pode ficar onde.

- `suite` — individual, com espaço e, em geral, câmera.
- `baia` — individual padrão.
- `gatil` — vertical, isolado de cães, sem som de latido.
- `coletiva` — convivência, para animais sociáveis.
- `isolamento` — chegada com suspeita, ou quarentena de retorno.

Cada uma declara: bloco, capacidade (quantos animais da **mesma casa** cabem), porte máximo,
espécies aceitas, recursos (câmera, climatização, área externa, piso aquecido), janela de
higienização e tarifa. E o estado de operação — ativa, ou fora por manutenção/reforma/
desinfecção, com desde quando (uma acomodação parada há três semanas é uma vaga esquecida, não
uma manutenção).

### Tarifas e temporadas

- Diária **por porte** — o gigante ocupa mais e come mais.
- Diária de acompanhante, em percentual da cheia.
- Meia diária, e os dois horários que a acionam.
- Serviços avulsos, com preço próprio.
- **Temporada**: intervalo com acréscimo percentual. Dezembro, julho, feriado prolongado.
- Política de sinal e de cancelamento: quanto, e até quando devolve.

### Equipe

Quem cuida, quem recepciona, quem banha, quem adestra, e o veterinário de retaguarda. Toda
execução de tarefa, toda ocorrência e toda passagem de turno carregam um nome — é o que permite
responder "quem estava com ele às 3 da manhã".

### Exigências de admissão

Quais comprovantes esta casa exige, com validade em meses e se bloqueiam ou apenas avisam. A lista
varia entre hotéis e muda com a legislação local; ela é **dado**, não constante de código.

Padrão da casa: polivalente (V8/V10), antirrábica, tosse dos canis, giárdia, vermífugo,
antipulgas, e termo de responsabilidade assinado.

---

## O que o hotel precisa ver sem clicar

Três perguntas, três vezes ao dia:

1. **O que acontece hoje?** Quem chega, quem sai, quantos estão na casa, o que está pendente.
2. **Onde há vaga?** Por período, não por hoje — a venda é futura.
3. **O que está travado?** Documento vencendo, ocorrência sem contato, pertence não devolvido,
   boletim não enviado, saída tardia sem cobrança lançada.

Selo no menu só para o que **alguém precisa fazer**. "18 hóspedes" não é pendência, é rotina;
"2 carteiras vencendo durante a estadia" é.

---

## O que este módulo **não** faz nesta rodada

Dito em voz alta para não ser cobrado como esquecimento:

- **Emissão fiscal.** O fechamento calcula e registra; nota é outro sistema.
- **Pagamento.** Registra-se o que foi pago e como; não se processa cartão.
- **Câmera ao vivo.** O recurso existe como atributo da acomodação; o vídeo não.
- **Creche (daycare).** Entrada e saída no mesmo dia é outro produto, com outra grade e outro
  preço. Compartilha acomodação e rotina, e por isso o modelo foi desenhado para recebê-la — mas
  ela não entra agora.
- **Adestramento como serviço com plano próprio.** Entra como serviço contratado, sem trilha.
- **Transporte com rota.** Entra como serviço; roteirização não.

---

## Terminologia

| Em código | Em texto visível (pt) |
|---|---|
| `tutorId`, `Tutor` | **responsável** — nunca "tutor" |
| `Hospedagem` | **estadia** |
| `Acomodacao` | **acomodação** (suíte, baia, gatil, coletiva) |
| `Cuidador` | **equipe** |
| `TarefaDeRotina` | **rotina** |
| `Ocorrencia` | **ocorrência** |
| `Boletim` | **boletim** |

Nenhum texto fixo em português no código: tudo passa por `t('hotel.…')`, nos seis idiomas do
portal. `kind` viaja, a tela traduz.
