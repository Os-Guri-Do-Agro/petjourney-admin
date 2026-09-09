# 07 · Internação com boletim ao responsável

> Mapa de leitos, prescrição por horário com checklist de enfermagem, evolução por plantão com
> passagem de turno, e o boletim que o responsável recebe no app sobre o pet internado.

## Por que existe

Internação é o momento de maior angústia do responsável, e hoje ele liga para a clínica quatro
vezes por dia. O boletim automático resolve dos dois lados: acalma o responsável e devolve o
telefone para a recepção. É diferencial puro — nenhum concorrente entrega isso.

## Pronto quando

Um plantão inteiro pode ser encenado no protótipo, e o responsável acompanha pelo celular sem
ligar para a clínica.

---

## Entregue

| O que o requisito pede | Situação |
|---|---|
| **Mapa de leitos com ocupação e estado do paciente** | Feito — 8 leitos, o vazio ocupa espaço na grade, marcação por **urgência** e não por gravidade |
| **Prescrição por horário** | Feito — `PrescricaoDeInternacao` com frequência, contínuo e aprazamento materializado |
| **Checklist de enfermagem** | Feito — agrupado por horário, com a linha do "agora" no meio da lista; checagem e recusa como desfechos distintos |
| **Registro de quem executou** | Feito — `executadaPor`, `executadaEm` e o plantão em que a execução caiu |
| **Evolução por plantão** | Feito — uma por paciente e por turno, com os vitais do turno anterior à vista |
| **Passagem de turno** | Feito — pendências congeladas na entrega, e trava enquanto houver dose sem dono |
| **Boletim ao responsável: texto** | Feito — montado no repositório, congelado no envio |
| **Boletim: foto opcional** | Feito — preferência por internação; no mock a foto é a marca do paciente |
| **Boletim: frequência configurável** | Feito — de 1 em 1 hora até 24 em 24, com o custo em mensagens/dia à vista |
| Prévia do que o responsável vê | Feito — a conversa do app ao lado da tela da clínica |
| **Cadastro de leitos** | Feito — a clínica cadastra, renomeia, tira de operação com motivo e devolve |
| **Alta hospitalar** | Feito — três desfechos, conferência do que fica para trás e a última mensagem ao responsável |

### Casos difíceis

| Caso | Situação |
|---|---|
| **Piora do quadro: notícia grave não pode chegar por aplicativo sem alguém falar antes** | Feito — o boletim nasce **retido**, e a regra é do repositório, não da tela |
| **Troca de plantão no meio de uma medicação** | Feito — `atravessaAPassagem`, marcada na linha do checklist e travando a entrega do turno |
| **Responsável que quer atualização de hora em hora** | Feito — frequência de 1 h existe, com silêncio noturno que **junta** em vez de pular |
| Gato que cospe o comprimido | Feito — `recusada` é desfecho próprio, distinto de `pulada` |
| Leito fora de operação | Feito — sai da conta de vagas sem sair do mapa, com motivo e data |
| Leito ocupado que alguém tenta desativar | Feito — recusado no repositório, com a frase que diz o que fazer antes |
| Leito criado por engano | Feito — some do cadastro; o que já recebeu paciente só se desativa |

---

## Decisões

- **Internação não é `Appointment`.** Agendamento tem começo e fim na grade; internação tem
  entrada e uma alta que ninguém sabe quando será. Forçá-la na agenda produziria um atendimento
  de 72 horas atravessando três colunas de profissional.

- **Atraso é lido, nunca gravado.** `AdministracaoStatus` não tem `atrasada`. Uma dose marcada
  como atrasada às 14h continuaria atrasada depois de dada às 14h10; o atraso nasce da comparação
  com o relógio, a cada leitura (`situacaoDaAdministracao`).

- **Os horários são materializados na prescrição, não derivados na leitura.** O registro de quem
  executou precisa de uma linha para morar. Derivar faria "dado por Helena às 14h05" pendurar em
  nada — e suspender a prescrição amanhã apagaria as doses de ontem, que é o que a auditoria de um
  óbito vai procurar.

- **A regra do boletim retido é do servidor.** Se vivesse na tela, bastaria outra tela — ou uma
  rota de API amanhã — para a notícia grave escapar por push. Está em
  `internacao-repository.ts`, e `enviarBoletim` recusa com `BoletimBloqueadoError`.

- **Seguir crítico não cobra ligação nova a cada boletim.** Só a **piora** cobra, mais o primeiro
  boletim de quem já entrou crítico. Exigi-la de hora em hora faria a clínica desligar os boletins
  do paciente que mais precisa deles — que é como uma regra de segurança produz o dano que queria
  evitar.

- **O silêncio noturno junta, não pula.** Boletim que cairia às 3 da manhã sai às 7h. Pular
  deixaria um buraco de nove horas sem notícia; juntar entrega o mesmo conteúdo na hora em que ele
  pode ser lido. A piora nunca espera.

- **O texto do boletim é montado no repositório, em português, e congelado no envio.** Parece
  contradizer a disciplina do módulo (`kind` viaja, texto se traduz) e não contradiz: o boletim
  **não é interface**, é mensagem endereçada ao responsável, no idioma dele — como a receita
  congela a conduta. O idioma da tela da clínica não tem relação com o idioma em que a Rita lê que
  o gato dela piorou.

- **O cartão do leito marca urgência, não gravidade.** Um crítico com tudo em dia não precisa
  piscar; um estável com duas doses atrasadas precisa. Marcar por gravidade deixaria o mapa
  vermelho onde nada há para fazer e silencioso onde há.

- **A urgência contorna o cartão; não fica numa faixa à esquerda.** Fundo colorido derruba o
  contraste do texto clínico, então o estado vive na moldura — mas em **anel**, e não em tarja
  lateral: a tarja marca o cartão por uma aresta só, some quando a grade quebra em coluna única e
  depende de uma direção de leitura. A escada tem três degraus e cada um sobe um canal além do
  tom: moldura padrão, anel areia, anel terracota **com selo de ícone e texto** — que é o que
  mantém a informação de pé em escala de cinza.

- **O dataset gira em torno do plantão corrente, não do dia âncora.** A agenda tem um dia âncora;
  a internação é demonstrada às 9 da manhã e às 11 da noite. Um plantão preso ao dia âncora
  apareceria encerrado para quem abrisse a tela cedo. `seed-internacao.ts` ancora tudo em `agora`.

- **A passagem congela as pendências.** Recalculada depois, a lista mostraria a pendência já
  resolvida pelo turno seguinte, e a passagem viraria uma página em branco — que é a forma mais
  educada de apagar responsabilidade.

- **O sistema não adivinha quantos leitos a clínica tem.** O número é dela, e muda quando ela
  cresce ou reforma — então leito é dado editável, não constante de código. O cadastro fica num
  diálogo, e não no mapa: é configuração, acontece no dia da mudança e não volta a acontecer por
  meses.

- **Leito com história não se apaga.** A internação guarda o `leitoId`, e onde o animal ficou é a
  resposta que a clínica procura seis meses depois. Sai do cadastro apenas o leito que nunca
  recebeu ninguém; o resto se **desativa**, com motivo (`kind`, traduzível) e data. É a data que
  transforma "em manutenção" em informação: parado há duas horas é manutenção, parado há três
  semanas é uma vaga que a clínica esqueceu que tinha.

- **Leito ocupado não sai de operação, e a tela diz por quê.** Onde a regra impede, aparece o
  motivo em texto — não um botão apagado. Botão inerte só se explica pelo `title`, que não existe
  no toque nem no leitor de tela, e um controle que não responde é lido como defeito.

- **A janela de tolerância é de 30 minutos.** Apertada demais, o checklist vive vermelho num
  plantão que está indo bem — e um checklist que vive vermelho ninguém lê, que é o desfecho pior.

### A alta

O motor da alta existia desde o primeiro dia — `internacaoRepository.darAlta` — e **nenhuma tela o
chamava**. O animal entrava no mapa de leitos e não tinha por onde sair: o protótipo demonstrava
metade de um ciclo e parava exatamente onde a clínica precisa registrar o que aconteceu.

- **São três desfechos, e não dois.** "Transferido" não é alta nem óbito: o animal saiu vivo e o
  caso **continua** em outro lugar. Somá-lo à alta faria a clínica ler como sucesso um
  encaminhamento às 3 da manhã para um centro de referência; somá-lo ao óbito seria pior.

- **Óbito e transferência não saem por mensagem.** É a **mesma regra do boletim de piora**, no
  outro extremo da internação: notícia grave não chega por notificação. As duas exigem
  `avisadoPorTelefone`, e o repositório recusa o encerramento sem ele (`AltaSemAvisoError`). A
  regra mora lá, e não na tela, pelo motivo de sempre — tela se contorna, e uma rota de API amanhã
  contornaria sozinha.

- **A alta escreve a última mensagem ao responsável.** A conversa do aplicativo terminava no
  boletim das 14h, e quem estava do outro lado ficava com o celular na mão num sábado à noite sem
  saber se já podia parar de olhar. O boletim de alta fecha o ciclo que os outros abriram, e nasce
  **liberado** — `comporBoletim` não serve aqui porque decide a retenção pela gravidade, e um
  animal que passou a internação inteira crítico e teve alta cairia como notícia grave, preso
  esperando uma ligação que ninguém precisa dar.

- **Nenhuma pendência trava a alta.** Um animal pode ir para casa com a dose das 18h no bolso do
  responsável, e um óbito acontece com boletim retido na fila. Travar não faz a clínica resolver a
  pendência: faz o animal sair pela porta enquanto o sistema segue dizendo que ele está no leito
  R3 — e é assim que um mapa de leitos deixa de ser confiável. O diálogo **avisa** e deixa
  registrar.

- **A orientação é obrigatória nos três desfechos.** Na alta ela é o que o responsável vai ler no
  aplicativo e seguir em casa. No óbito e na transferência é o registro do que foi dito ao
  telefone — a única linha que responde, seis meses depois, ao que exatamente foi comunicado.

- **A conferência é de números, não de lista.** Quem chegou ao encerramento já viu o checklist. O
  que falta é a pergunta "ficou alguma coisa?" antes de um registro que não se desfaz. Pendentes
  agora e a suspender são contados **separados**: somar as duas colunas diria "1 pendente e 1 a
  suspender" sobre uma dose só.

- **Encerrar fica na migalha, não junto das abas.** As quatro abas são o trabalho do turno, que se
  repete a cada meia hora; a alta acontece uma vez e não se desfaz. Na mesma fileira, as duas
  coisas convidariam ao clique errado no fim de um plantão de doze horas.

- **A internação encerrada continua alcançável, e diz que está encerrada na primeira linha.** Sem
  a faixa, a tela de um animal que foi para casa é indistinguível da de um animal que está no
  leito — e alguém marca uma dose numa internação que acabou ontem. Prescrever some; a lista
  inteira continua legível. Registro fechado se lê, não se continua.

- **A faixa de encerramento é neutra nos três desfechos.** Verde de sucesso na linha que diz que o
  animal morreu seria a pior escolha possível de paleta.

### O boletim retido ganhou dono

O mapa contava os retidos num total no topo — "1 boletim retido" — e esse total não dizia **de
quem**. Achar o paciente custava abrir os cinco internados um a um, que é exatamente a busca que um
boletim retido não tem tempo de esperar. `LeitoNoMapa.boletimRetido` põe o selo no cartão, com
ícone de telefone e não de alerta: o que se pede ali não é atenção, é uma ligação.

O selo é **cheio**, e o do atraso é contornado. Os dois podem aparecer no mesmo cartão, e com a
mesma marcação o olho os leria como duas linhas da mesma coisa — são dois pedidos diferentes: o
atraso chama a enfermagem, que está no corredor; o boletim chama alguém para pegar o telefone.

---

## Onde está o código

| Camada | Arquivo |
|---|---|
| Contratos | `data/types.ts` — seção **Internação** |
| Regras puras | `domain/internacao.ts` (+ `domain/__tests__/internacao.spec.ts`) |
| Leitos | `data/fixtures/internacao.ts` — só o **estado inicial**; daí em diante quem manda é o cadastro |
| Dataset | `data/seed-internacao.ts` (+ `data/__tests__/internacao-dataset.spec.ts`) |
| Repositório | `data/repositories/internacao-repository.ts` |
| Texto do boletim | `data/boletim-texto.ts` — usado pelo dataset **e** pelo repositório |
| Store | `stores/internacao.ts` |
| Componentes | `components/internacao/` |
| Telas | `pages/(accounts)/veterinario/internacao.vue` e `internacao/[internacaoId].vue` |

---

## Roteiro de demonstração (um plantão inteiro, ~6 minutos)

Os três casos difíceis estão plantados e têm rota própria no painel de desenvolvimento
(`internacao-piora`, `internacao-troca-plantao`, `internacao-boletim-horario`). Funcionam a
qualquer hora do dia.

1. **O mapa.** `/veterinario/internacao`. Cinco leitos ocupados de oito, a UTI tomada, e a faixa
   vermelha no topo dizendo que há boletim esperando ligação. Aponte o leito livre: a pergunta que
   o mapa responde é "onde ponho o próximo".

   Se perguntarem "e se a minha clínica tiver doze leitos?", abra **Gerenciar leitos**: cadastra,
   renomeia e tira de operação com motivo. O leito ocupado mostra "Ocupado" no lugar da ação, e o
   que já recebeu paciente não oferece "Remover" — só desativação.

2. **O turno.** Abra o Bento (R1). Checklist agrupado por horário, com a linha do "agora". Cheque
   duas doses — o nome de quem deu aparece na linha. Mostre a linha contornada: essa dose cai
   **no minuto da passagem de plantão**.

3. **A recusa.** No Sushi (F1), a alimentação está marcada como recusada, com a observação de quem
   tentou. Não é dose que ninguém deu: é informação clínica que faz o vet trocar a via.

4. **A piora.** Abra o Tofu (UTI) na aba **Boletim**. O boletim está escrito, está pronto, e não
   sai. A caixa vermelha diz por quê. Clique em **Registrar ligação** — só então o envio libera.
   Ao lado, a prévia do celular mostra a mensagem chegando com o selo "enviado após ligação".

5. **De hora em hora.** Abra a Cacau (R2), aba Boletim. Dezesseis mensagens desde a entrada, e a
   frequência em "a cada 1 h" com o custo escrito: são 16 por dia com silêncio noturno. É o
   responsável que hoje liga quatro vezes — e agora não liga nenhuma.

6. **A passagem.** Volte ao mapa e clique em **Passar plantão**. As três listas aparecem; a
   entrega fica travada até alguém decidir quem dá a dose em cima da troca. Escolha quem recebe,
   escreva a nota, entregue.

---

## O que ficou de fora

- **Alta com documento.** `darAlta` existe no repositório e devolve o leito ao mapa, mas não há
  tela nem relatório de alta. O relatório é do requisito de documentos, não deste.
- **Internação nascendo de dentro da consulta.** `Internacao.encounterId` está no contrato e o
  prontuário ainda não tem o botão "internar". Hoje a entrada é pelo mapa, que é onde a pergunta
  da vaga nasce.
- **Balanço hídrico e ficha anestésica.** Fora do escopo do requisito; a prescrição de fluido já
  existe como item contínuo com conferência por horário.
