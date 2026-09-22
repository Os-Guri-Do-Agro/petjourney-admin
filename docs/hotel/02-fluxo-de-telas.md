# 02 · Fluxo de telas do hotel

> As telas que o requisito [01](./01-requisitos-do-hotel.md) exige, por que cada uma existe, e o
> que decide se ela está pronta. Visão do hotel; o que é do responsável está marcado `→ app`.

## Princípio de corte

Uma tela existe quando responde a uma **pergunta que alguém faz em voz alta durante o
expediente**. "Tem vaga do 22 ao 30?", "quem chega hoje?", "o Thor já comeu?", "quanto vai dar?".
Tela que não responde a nenhuma é aba de outra tela.

O módulo clínico aprendeu isso da pior forma: dez destinos numa lista plana, todos aparentemente
vazios, e um usuário descrevendo o fluxo como confuso (ver `docs/clinico/08-orientacao-do-fluxo.md`).
O hotel nasce com o remédio já aplicado — **três blocos de menu, na ordem do dia**:

| Bloco | Telas | A pergunta |
|---|---|---|
| **1 · Vender** | Mapa, Reservas | Tem vaga? O que está vendido? |
| **2 · O dia** | Painel, Rotina, Hóspedes | O que acontece hoje, o que fazer agora, como cada um está |
| **A casa** | Acomodações, Resumo | Como o hotel é montado, e como ele foi |

> Receber, cuidar e entregar acontecem no mesmo dia e pelas mesmas mãos — por isso os três moram
> num bloco só. A separação em quatro momentos continua valendo onde ela ensina: no tutorial que
> cada tela traz no botão "Como usar".

---

## Cada tela tem uma forma própria

Esta é a correção central da segunda rodada, e vale antes da lista: **nenhuma tela do módulo pode
ter a silhueta de outra.** A primeira versão tinha nove telas idênticas à distância — fileira de
quatro números, lista embaixo — e a crítica foi direta: "várias telas parecem a mesma coisa, mesmo
tendo outras utilidades".

Uma tela que não *parece* o que faz obriga a ler o título para saber onde se está. Duas telas com a
mesma forma obrigam a ler o título **toda vez**.

| Tela | Forma |
|---|---|
| Mapa | Grade: linhas de acomodação × colunas de noite |
| Reservas | Faixa de véspera + tabela densa |
| Reserva | Documento em duas colunas: contrato e conta |
| Painel | Linha do tempo horizontal do dia |
| Rotina | Eixo vertical de horários, com cartões marcáveis |
| Hóspedes | Grade de cartões com avatar |
| Estadia | Dossiê: hero, checklist, diário, ficha |
| Acomodações | Planta da casa por bloco, mais tabelas de preço |
| Resumo | Gráfico de barras por dia |

A pergunta que cada tela responde **não é mais uma faixa no topo**. Ela existiu como cartão fixo
(`HotelCabecalho`), com a pergunta, o selo de etapa e um ícone, e saiu junto com a tela de ensino:
uma faixa decorativa acima de toda tela custa a primeira dobra de tela em troca de uma frase que só
serve na primeira visita. A frase continua, no primeiro passo do tutorial, que é onde alguém a
procura.

## O ensino mora dentro da tela

Houve uma tela `/hotel/como-funciona`, primeira do menu, que ensinava o fluxo inteiro num lugar
só. Ela **saiu**, e o motivo é o mesmo que derrubou a primeira rodada em outra escala: ensinava
longe do que ensinava. Quem lia "a coluna de documentação é ordenável" ainda não tinha visto coluna
nenhuma — e quando ia trabalhar, a tela de ensino tinha ficado para trás. O parágrafo de apoio atrás
de "Mostrar explicações" tinha o mesmo defeito, em menor escala.

No lugar dos dois, o botão **"Como usar"** no cabeçalho de cada tela abre um tutorial passo a passo
(`HotelTour`): o resto da página escurece, uma parte acende de cada vez, e o cartão com a frase fica
encostado nela. Quatro a cinco passos por tela, na ordem em que a página se lê, com "Anterior",
"Próximo" e Esc.

Duas decisões que o componente carrega:

- **Passo sem alvo na tela não entra no roteiro.** As telas têm seções condicionais — a faixa de
  véspera só existe quando há documento pendente. O roteiro é montado a cada abertura, e o contador
  fala do que sobrou: nunca "3 de 5" com o destaque pousado no vazio.
- **Não roda sozinho, e não guarda "já viu".** Tutorial que só aparece na primeira visita é
  tutorial que ninguém reencontra no dia em que precisa — e a pergunta "o que é esse selo âmbar?"
  chega no segundo mês, não no primeiro minuto.

---

## As telas

### `/hotel/painel` — Painel do dia

A primeira tela de quem abre o portal de manhã. Não é um resumo: é a **lista do que fazer hoje**,
com a forma de um dia.

- Faixa de travamento no topo, acima de tudo: ocorrência grave sem contato, boletim preso atrás
  dela, chegada de hoje sem documento. Cada uma é botão **com a ação escrita** — "ligue para (11)
  98003-1188 e registre a ligação". Um alerta que diz "resolva" sem levar ao lugar onde se resolve
  transfere o trabalho de achar.
- Os números viraram **uma frase**: "5 na casa · 2 chegam · 1 sai · 3 tarefas para agora". Quatro
  cartões diziam o mesmo ocupando um terço da tela acima da dobra — e eram a forma que fazia esta
  tela parecer todas as outras.
- **A linha do tempo do dia**: chegadas em cima, saídas embaixo, e uma marca vertical em "agora".
  Quem abre às oito vê o dia inteiro de uma vez e sabe o que vem primeiro.
- **Chegam hoje** e **saem hoje**, com "pode entrar" ou "falta pesar" ao lado de cada um.
- **Turno atual** e o botão de passar o turno.

**Pronto quando** quem abre às oito sabe, sem rolar, quantos carros vão chegar, quantos vão sair
e o que vai dar problema.

### `/hotel/rotina` — Rotina do turno

A prancheta. Todas as tarefas de todos os hóspedes do turno, num **eixo vertical de horários**,
marcáveis em um toque. É a tela que fica aberta numa tela fixa ou no celular de quem está no canil.

- Agrupada por horário, não por hóspede: às 8h alguém alimenta os dezoito, não percorre dezoito
  fichas.
- Dividida em três tempos: **para agora**, **mais tarde hoje** e **já resolvido** — este último
  recolhido, porque quem está no corredor não relê o café da manhã.
- Filtro por tipo (refeição, medicação, passeio, higiene).
- Atrasada é calculada contra o relógio, nunca gravada — o mesmo cuidado que a internação teve
  com `AdministracaoStatus`: uma tarefa gravada como atrasada continuaria atrasada depois de
  feita.
- Recusa é um botão próprio e não "pular": **não comeu é informação**, e alimenta o boletim e a
  ocorrência.

**Pronto quando** o turno inteiro cabe numa tela sem busca, e marcar uma refeição custa um toque.

### `/hotel/mapa` — Mapa de ocupação

Responde "tem vaga do dia 22 ao dia 30?" — e a resposta **não é um número**, é o buraco entre duas
estadias num calendário. A primeira versão era uma fileira de cartões dizendo "8 livres": a
resposta certa para uma pergunta que ninguém faz.

- **Linhas são acomodações, colunas são noites.** Barras são o que está vendido; o vazio é a
  informação.
- **A noite da saída não é ocupada.** Quem sai ao meio-dia libera a diária daquela noite. Pintá-la
  esconderia uma diária vendável por estadia.
- A procura no topo é uma **frase** — "tenho um cão de porte grande, de tal dia a tal dia" — e a
  resposta fica ao lado dela, inteira.
- A procura **acende** as linhas que servem e apaga o resto, sem esconder: quem está no telefone
  precisa enxergar as outras opções quando a primeira não dá.
- Clicar num espaço vazio abre a reserva já com acomodação e dia preenchidos.

**Pronto quando** a pergunta do telefone é respondida em um gesto, com o período que o cliente
disse.

### `/hotel/reservas` — Reservas

A lista do que está vendido. Filtros por estado, período, bloco e pendência de documento.

- Coluna de exigências com o estado derivado (R1), ordenável: é a coluna pela qual a recepção
  trabalha na véspera.
- Ação de criar reserva, que abre o mesmo formulário do mapa.
- Lista de espera como bloco próprio: quem quer um intervalo que está lotado.

**Pronto quando** dá para varrer a semana e saber quais reservas vão dar trabalho.

### `/hotel/reserva/[reservaId]` — A reserva

O contrato, antes de virar estadia. Quatro blocos:

1. **Período e acomodação**, com a conta de diárias explícita e o aviso de saída tardia.
2. **Orçamento**: diárias, acompanhante, serviços, temporada, sinal, saldo. Cada linha visível —
   um total sozinho é uma conta que o cliente não confere e a recepção não defende.
3. **Exigências**, uma linha por comprovante, com data de validade, o estado e a dispensa nominal.
4. **Ficha de hospedagem**: plano alimentar, medicação, autorizações, contato de emergência.

E o botão de **check-in**, que só habilita quando R1 permite.

**Pronto quando** a recepção consegue fazer o check-in inteiro desta tela, sem abrir outra.

### `/hotel/hospedes` — Hóspedes na casa

Quem está hospedado agora — em **cartões**, não em tabela. A pergunta não é de varredura por
coluna: é "como está cada um dos meus cinco?", e a resposta é um rosto, um estado e o que falta
fazer.

- O **cartão inteiro** muda de cor quando algo trava. Um selo pequeno no canto não sobrevive a uma
  tela com doze cartões, porque o olho não lê canto.
- Três recortes em vez de barra de filtros: **todos**, **precisam de mim**, **saem hoje**. Cinco a
  vinte hóspedes não pedem busca nem facetas.

**Pronto quando** responde "quantos estão e quem precisa de mim" sem abrir nenhum.

### `/hotel/hospedagem/[hospedagemId]` — A estadia

O trabalho de dias sobre um animal. Abas:

- **Rotina**: o checklist só dele, do dia.
- **Diário**: o que foi registrado, com foto, e o botão de registrar.
- **Medicação**: o que foi prescrito para a estadia e o que foi dado.
- **Ocorrências**: com o travamento de contato (R3).
- **Boletim**: o que sai para o responsável, e o histórico do que saiu. `→ app`
- **Ficha**: pertences, plano alimentar, autorizações, pesos.

E o botão de **check-out**, que só habilita quando R4 permite.

**Pronto quando** quem assume o turno entende o animal em trinta segundos.

### `/hotel/acomodacoes` — Acomodações e tarifas

Configuração. Acontece no dia da mudança, não todo dia — por isso é tela, e não painel fixo.

- Cadastro de acomodação: nome, bloco, tipo, capacidade, porte máximo, espécies, recursos,
  janela de higienização, tarifa.
- Tirar de operação, com motivo e desde quando; e devolver.
- Remover só o que nunca hospedou — o resto vira inativo, porque apagar acomodação apagaria
  história.
- Tarifas por porte e temporadas.

**Pronto quando** o hotel monta a própria casa sem pedir nada a ninguém.

### `/hotel/resumo` — Resumo

Análise. Olha-se depois que o mês acabou, não durante o dia.

- Ocupação por dia no período, por bloco.
- Receita por origem de reserva e por serviço.
- Taxa de retorno, cancelamento e não comparecimento.
- Ocorrências por tipo — o número que muda o processo.

**Pronto quando** responde se valeu a pena abrir no feriado.

---

## Arquitetura

Mesma disciplina do módulo clínico, e pelos mesmos motivos:

- **Protótipo navegável sem API.** Tudo vive em `src/features/hotel/data/`, com a forma que o
  backend terá. Os repositórios devolvem a assinatura definitiva; trocar por HTTP é substituir o
  repositório, não a tela. Componente nenhum conhece `fixtures`.
- **Dataset determinístico.** Mesma semente, mesmos hóspedes, ancorado em **hoje** — dataset preso
  a data fixa morre na semana seguinte.
- **Regra no domínio, não na tela.** As quatro regras do requisito 01 moram em
  `features/hotel/domain/` e são exercidas por teste. O repositório as aplica; a tela apenas
  mostra o motivo da recusa.
- **`kind` viaja, a tela traduz.** Nenhum texto pronto em português sai do dado. Seis idiomas.
- **Interruptor oculto.** O módulo nasce desligado, como o clínico e pelo mesmo motivo: um menu
  "Hóspedes" com animais que não existem é indistinguível de um defeito. Liga com `?hotel=on` ou
  digitando `hotel` fora de campo de texto, e o desbloqueio **pertence à conta** que o ligou.
- **Fundação visual compartilhada.** Tokens (`clinic-tokens.css`) e os componentes-base do módulo
  clínico são a linguagem do portal, não propriedade da clínica. O hotel os consome. Duplicá-los
  produziria duas tabelas densas que divergem no terceiro mês.

## Ordem de construção

1. Domínio e dados (tipos, regras, seed, repositórios) — sem isso, tela é maquete.
2. Mapa, Reservas, Reserva — o eixo da venda.
3. Painel, Rotina, Hóspedes, Estadia — o eixo da operação.
4. Acomodações, Resumo — configuração e análise.

## Entregue

As nove telas existem e navegam sobre a camada mocada. Situação por tela:

| Tela | Situação |
|---|---|
| `/hotel/mapa` | Completa — grade de ocupação de três semanas, procura em frase, reserva por clique no vazio |
| `/hotel/reservas` | Completa — faixa de véspera, tabela densa ordenável, lista de espera |
| `/hotel/reserva/[id]` | Completa — período, orçamento linha a linha, exigências com dispensa nominal, check-in |
| `/hotel/painel` | Completa — travas com a ação escrita, linha do tempo do dia, chegadas e saídas |
| `/hotel/rotina` | Completa — eixo de horários em três tempos, marcação em um toque |
| `/hotel/hospedes` | Completa — cartões ordenados por quem cobra ação, com três recortes |
| `/hotel/hospedagem/[id]` | Completa — rotina, diário, ocorrências, boletim, ficha, check-out |
| `/hotel/acomodacoes` | Completa — cadastro, operação, remoção guardada, tarifas e temporadas |
| `/hotel/resumo` | Completa — ocupação por dia, receita por origem e serviço, perdas |

Todas com capturas no [documento de apresentação](./apresentacao/).

### O que ficou de fora desta rodada, e está dito no requisito 01

Emissão fiscal, processamento de pagamento, câmera ao vivo, creche, adestramento com plano
próprio e roteirização de transporte. Nenhum deles é lacuna descoberta: os seis estão listados em
[01 · O que este módulo **não** faz nesta rodada](./01-requisitos-do-hotel.md).

### Duas coisas que o protótipo simula e a API vai mudar

- **Foto** é a inicial do hóspede, não uma imagem. O mock não carrega arquivo, e fingir que carrega
  criaria uma tela que muda de forma quando a API chegar.
- **Quem está operando** é o primeiro cuidador ativo (`hotelStore.operadorAtual()`). Com a API vem
  da sessão — e existe como função justamente para que trocar a origem seja trocar uma linha.
