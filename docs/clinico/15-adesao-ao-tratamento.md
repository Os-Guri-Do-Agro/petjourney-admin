# 15 · Adesão ao tratamento

O vet prescreve, o app lembra o responsável na hora da dose, alguém da casa toca "dei" — e, no
retorno, o vet vê a adesão real. **O ciclo fechado entre a receita e a casa.**

O lado da clínica é protótipo navegável sobre a camada mocada, como o resto do módulo. O lado do
responsável é do `petjourney-app` e está especificado em
[16-adesao-visao-do-responsavel.md](./16-adesao-visao-do-responsavel.md); aqui ele aparece como
**prévia fiel**, ao lado da ficha, montada só com o que o contrato entrega — e interativa: tocar
"Dei" no celular da prévia muda a ficha na mesma hora.

## Por que existe

É o ciclo que muda desfecho clínico e o mais difícil de copiar, porque exige os dois lados: a
receita da clínica e o app que a casa já usa. Para o vet, é a resposta ao "o tratamento não
funcionou": agora dá para saber se ele foi feito — e são condutas opostas.

## Pronto quando

> Dá para contar a história inteira numa demonstração: prescrever, lembrar, confirmar e o vet ver o
> resultado no retorno.

Feito, e a história passa por quatro telas do portal:

1. **Prescrever** — no atendimento, a receita ganhou o interruptor **"Tratamento crítico: avisar a
   clínica se a adesão cair em casa"**, por item.
2. **Lembrar** — na aba **Tratamento** da ficha do paciente, o celular da prévia recebe a receita
   liberada, sugere o horário da primeira dose e cria os lembretes; o aviso da dose chega com
   **"Dei"** no próprio aviso.
3. **Confirmar** — um toque no celular da prévia, e a faixa de doses da ficha ganha o quadradinho,
   com quem deu.
4. **O vet vê no retorno** — no **Este pet em 30 segundos**, o cartão **Remédio em casa** mostra a
   faixa e a conta desde a última consulta; o botão **Abrir atendimento** leva a adesão para os
   antecedentes da anamnese, com a procedência.

Coberto por teste (`data/__tests__/adesao-conectada.spec.ts` e `domain/__tests__/adesao.spec.ts`).
**Ainda não verificado no navegador** — ver "O que falta conferir", no fim.

---

## O que foi entregue

- [x] **Lembrete de medicação no app do responsável, com confirmação de um toque** — a prévia do
      celular: o aviso da dose com **Dei** (registra todas as doses do aviso sem abrir o app) e, na
      tela, **Dei** / **Pulei** por dose.
- [x] **Registro de dose pulada com motivo simples** — **Pulei** abre três botões: **Esqueci**,
      **Cuspiu**, **Acabou**. Sem campo de texto: um toque a mais, não um formulário.
- [x] **Vista do vet: adesão do período em uma linha, sem tom de julgamento** — a **faixa de doses**
      (um quadradinho por dose, uma linha por horário do dia) e a frase "Desde a consulta de 19/08:
      39 dadas · 1 pulada (acabou o remédio) · 1 sem registro". Contagem, nunca nota ou porcentagem.
- [x] **Alerta para a clínica quando a adesão despenca em tratamento crítico** — no selo do menu
      **Tratamentos em casa**, na pauta da Visão geral, na lista da clínica ("Pedem atenção"), na
      pílula da ficha, como primeiro grupo de sinais do "Este pet em 30 segundos", e no tratamento,
      com o registro da conversa. A ligação a clínica faz como já faz, pelo telefone do cadastro:
      a tela não tem botão de ligar.

## Como usar

- **Na ficha do paciente:** `/veterinario/paciente/:petId/tratamento` — a pílula **Tratamento**
  aparece nas outras vistas da ficha para quem tem remédio de casa com lembrete, com selo coral
  quando um crítico perdeu o ritmo.
- **Na clínica toda:** menu **Pendências → Tratamentos em casa** (`/veterinario/tratamentos`), com o
  mesmo número no selo do menu e na Visão geral.
- **No atendimento:** etapa Conduta → Receita → "Como o responsável vê", o interruptor de crítico em
  cada item.
- **No resumo:** `/veterinario/paciente/:petId/resumo`, cartão **Remédio em casa**.
- **Painel de desenvolvimento:** os três casos difíceis (`adesao-sem-registro`, `adesao-critico`,
  `adesao-varias-vezes`) abrem direto a aba do paciente.

## Roteiro de demonstração (3 minutos)

1. **O alerta.** Visão geral: "1 tratamento crítico com a adesão em queda" (urgente). Abrir →
   **Tratamentos em casa**, recorte **Pedem atenção · 1**: **Duna · Furosemida**, com a faixa dos
   últimos 14 dias terminando em pêssego.
2. **Duna → Tratamento** (Cavalier com doença de válvula mitral, furosemida desde a consulta de 60 dias atrás, marcada como crítica). Frase do topo: "Furosemida 40 mg: a adesão caiu". No bloco: "2 doses
   puladas desde {ontem}, 08:00 · Motivo: acabou o remédio. Na semana anterior, 14 de 14."
   - A clínica liga pelo telefone do cadastro (no cabeçalho da ficha) e **Registra contato** →
     Helena Vasconcelos Prado, "Caixa acabou; receita nova enviada" → o alerta sai da ficha, do
     menu e da Visão geral.
   - Mostrar as duas pessoas: "Registrado por Lúcia (59) e Eduardo (56)" — Lúcia de manhã, Eduardo
     à noite, visível na faixa (duas linhas: 08:00 e 20:00).
3. **Pérola → Tratamento** (a consulta de hoje da Fátima). Meloxicam, uso contínuo: "Desde a
   consulta de {-42 dias}: 39 dadas · 1 pulada (acabou o remédio) · 1 sem registro".
   - Na faixa, os **domingos do começo** estão cinza: **sem registro**. A legenda diz em voz alta:
     "Sem registro não quer dizer que não deu". Não há alerta, nem se o tratamento for marcado como
     crítico.
4. **O celular, à direita.** "Celular de: **Fátima · responsável**". O aviso das 08:00 está no topo
   ("Hora do remédio de Pérola · Meloxicam 2 mg/mL · 0,12 mL"). Tocar **Dei** → a faixa da ficha
   ganha o quadradinho de hoje, "Dada por você às 15:02".
   - Trocar para **Rafael · família**: a mesma dose aparece "Dada por Fátima às 15:02", sem botão —
     é o que evita a dose dobrada.
   - Trocar para **Clara · só leitura**: vê tudo, e a tela explica por que não registra.
   - (Alternativa) **Pulei → Cuspiu**: a ficha mostra a pulada em pêssego, com o motivo.
5. **Prescrever.** Na mesma Pérola, abrir o atendimento de hoje, prescrever, marcar **Tratamento
   crítico**, finalizar e **liberar o resumo**. Voltar à aba Tratamento: o celular mostra **"Receita
   de hoje · 1 remédio ainda sem lembrete"**, com o horário sugerido ("para nenhuma dose cair de
   madrugada") e **"PetJourney Clínica Veterinária vê o que vocês registrarem"** ligado. **Criar
   lembretes** → o remédio entra dos dois lados, com o selo **Crítico** na ficha.
6. **O retorno.** Pérola → **Este pet em 30 s**: o cartão **Remédio em casa** mostra o meloxicam
   dado quase todo dia desde a última consulta — numa gata idosa que perde peso e bebe mais água. É
   a adesão virando dado clínico. **Abrir atendimento** leva para a anamnese:
   "Meloxicam (receitado, uso contínuo) · no app desde {data}: 39 dadas · 1 pulada (acabou o
   remédio) · 1 sem registro".
7. (Opcional) **Cacau → Tratamento**: tramadol de 8 em 8 horas por 10 dias. "A dose das 23:00 é a
   que menos aparece como dada: 1 de 6." No celular, **Como os avisos funcionam**: um por horário,
   sem segundo aviso, ninguém é cobrado.

## Como a tela se organiza

A aba **Tratamento** está no **acabamento da Visão geral**, como toda a ficha do paciente (ver
`DESIGN.md`): o nome do pet no lugar da saudação, a frase do estado em degradê, pílulas e cartões
brancos com título e ícone. A lista **Tratamentos em casa** está no acabamento do módulo clínico —
a variante só vale onde foi aprovada.

- **Remédios em curso** — um bloco por remédio, separados por fio (não cartão dentro de cartão):
  nome e posologia; a **faixa**; a frase do período; quem registrou e o horário que destoa; o
  alerta, quando há; e, no rodapé, o interruptor de **crítico** e **Ver registros**, que abre a
  tabela dose a dose — a versão sem cor da faixa.
- **Encerrados** — o mesmo bloco, compacto, sem alerta e sem controle.
- **No celular de …** — a prévia, presa ao topo ao rolar, com o seletor de quem está com o celular.
- **A faixa de doses** — dada em sálvia, pulada em pêssego, sem registro no cinza do trilho vazio,
  a dose da vez só com contorno, a última consulta como um fio. O par sálvia × pêssego foi conferido
  para daltonismo (ΔE 12 no claro, 14,4 no escuro — o pêssego do tema escuro foi escurecido para
  isso). Ao passar o ponteiro, cada dose diz dia, hora, situação e quem registrou.
- **O alerta** mora no ícone e na palavra, em coral — nunca numa faixa pintada em volta do bloco.

Movimento só onde explica mudança: o quadradinho muda de cor em 160 ms, o aviso desce do topo do
celular em 180 ms. Nada disso acontece com movimento reduzido.

## O que é real e o que é encenado

| Real (roda, com teste) | Encenado |
|---|---|
| A grade de doses, a situação de cada uma, a dose que fecha sozinha, o resumo e o alerta (`domain/adesao.ts`) | Os registros de antes de hoje são plantados pelo roteiro de cada caso (`seed-adesao.ts`) |
| Registrar, pular com motivo, desfazer, recusar a dose já registrada e quem só tem leitura | O "celular" é a prévia no portal; o toque é do apresentador |
| Criar o lembrete a partir da receita liberada, com o crítico da prescrição | O aviso é a projeção do contrato, não um push de verdade |
| A sugestão do primeiro horário que poupa a madrugada | A família (Rafael, Clara, Lúcia) é plantada; no app ela vem do compartilhamento que já existe |
| A prévia do celular lê o contrato (`projecao-do-responsavel.ts`), a mesma projeção que gera o JSON do app | O app real ainda não existe para esta tela (doc 16) |

## Casos difíceis

| Caso | Como o protótipo mostra |
|---|---|
| **Tutor que dá o remédio mas não registra: não pode parecer acusação** | A dose sem registro tem **estado próprio** — o cinza do trilho vazio, nunca a cor da pulada — e fica **fora** das contas de "deu" e de "não deu". A frase diz "1 sem registro", separado de "1 pulada". A legenda carrega a frase "Sem registro não quer dizer que não deu". Não há porcentagem em lugar nenhum. E o alerta **nunca** dispara em quem simplesmente não registra: ele mede **queda** em relação ao próprio padrão. No cenário: os domingos do começo do meloxicam da Pérola. |
| **Medicação várias vezes ao dia por muitos dias, sem virar spam** | Um aviso por horário; remédios a menos de 15 min um do outro (de qualquer pet da casa) saem **num aviso só**; **sem segundo aviso** quando o intervalo é menor que 24 h — a próxima dose já é o lembrete; a dose que passa sem registro **fecha calada** na hora da seguinte, sem "você esqueceu"; o primeiro horário é sugerido para nenhuma dose cair de madrugada. A faixa por horário mostra ao vet a dose que fica para trás, e a frase sugere a conversa certa (trocar o horário). No cenário: tramadol da Cacau de 8 em 8 horas por 10 dias — 30 doses. |
| **Mais de uma pessoa cuidando do mesmo pet** | Cada registro diz quem: "Registrado por Fátima (34) e Rafael (6)", e cada dose na faixa, ao passar o ponteiro. No celular, trocar de pessoa mostra a dose marcada pela outra como "Dada por Fátima às 15:02", **sem botão**; tentar de novo devolve `DOSE_JA_REGISTRADA` com quem e quando — é o que evita a dose dobrada. Só quem tocou desfaz. Quem tem só leitura vê e não registra, e a tela explica por quê. No cenário: Fátima e Rafael (Pérola), Clara só leitura, Lúcia e Eduardo (Duna). |

## Decisões

Marcadas as que valem discutir antes de virar regra de produto.

1. **Sem registro não é dose perdida.** Estado próprio, contagem própria, cor neutra. Nenhuma tela
   soma "sem registro" com "pulada", e nenhuma mostra porcentagem de adesão.
   *Discutível:* uma taxa "dos registros, quantas foram dadas" seria honesta — mas é o número que
   vira nota no primeiro relatório.
2. **A dose não cobra.** O registro abre uma hora antes e fecha na hora da dose seguinte; aí a dose
   vira "sem registro" em silêncio. *Discutível:* registrar a dose da noite na manhã seguinte hoje
   não é possível — a de 1× ao dia tem 24 h de janela, a de 8 em 8 h tem 8 h.
3. **Crítico é decisão do vet, na receita.** O interruptor mora onde a prescrição é feita, e pode
   ser mudado depois na ficha. Ausente é "não crítico": a receita que já existia continua como era.
4. **O alerta tem duas portas, as duas sobre doses fechadas nas últimas 72 horas:**
   - **puladas:** duas ou mais — a casa disse que não deu, com motivo;
   - **queda:** menos da metade dada, em quem deu ao menos 80% nos 7 dias anteriores (com ao menos 4
     doses para chamar de padrão).
   *Discutível:* os números (72 h, 2 puladas, 50%/80%). Um crítico em que a casa **nunca**
   registrou não alerta — a clínica vê "sem registro" na lista, mas não há queda onde nunca houve
   registro.
5. **A conversa apaga o alerta**, até a próxima dose que não aparecer como dada. O tempo sozinho
   não apaga — a dose que volta a ser dada tira o tratamento da janela em três dias.
6. **A clínica vê o que a casa escolheu mostrar, por tratamento.** Na hora de criar o lembrete, o app
   diz com todas as letras que a clínica vai ver, e o interruptor vem **ligado**; só o dono muda
   depois. Não é o consentimento do diário, que é por clínica e começa desligado.
   *Discutível:* ligado por padrão. O argumento: o lembrete nasce da receita dessa clínica, e a tela
   diz isso antes de criar.
7. **O primeiro que registra fecha a dose para todos.** A segunda tentativa recebe o registro de
   quem veio antes — com nome e hora — em vez de gravar outra dose.
8. **A posologia é copiada ao criar o lembrete**, como a receita copia a conduta. Mudar a dose numa
   consulta seguinte é outro tratamento; o histórico deste continua lendo certo.
9. **O período do retorno começa na última consulta finalizada antes de hoje** — não no início do
   tratamento. É a pergunta da consulta: "desde a última vez".
10. **Pulada é pêssego, não vermelho.** É um fato que a casa contou, não um erro de ninguém. Coral
    fica para o alerta, que é da clínica.

## Onde está

| O quê | Arquivo |
|---|---|
| A regra (grade, situação, resumo, alerta, primeiro horário) | `src/features/clinico/domain/adesao.ts` |
| Repositório (ficha, lista, contagem, celular, registrar, criar lembretes, crítico, contato) | `src/features/clinico/data/repositories/tratamento-repository.ts` |
| Cenário (Pérola, Duna, Cacau, Chico; a família) | `src/features/clinico/data/seed-adesao.ts` |
| Projeção para o app | `src/features/clinico/data/projecao-do-responsavel.ts` — `projetarTratamentos`, `projetarAvisosDeDose` |
| Contrato | `src/features/clinico/contrato/responsavel.ts` — "Adesão ao tratamento", a última seção |
| Aba da ficha | `src/pages/(accounts)/veterinario/paciente/[petId]/tratamento.vue` |
| Lista da clínica | `src/pages/(accounts)/veterinario/tratamentos.vue` |
| Componentes | `src/features/clinico/components/tratamento/` — `FaixaDeDoses`, `LegendaDaFaixa`, `TratamentoNaFicha`, `TratamentoNoApp` |
| No resumo | `components/pacientes/resumo/ResumoTratamentos.vue`; sinal `adesao` em `domain/resumo-do-paciente.ts` |
| Na receita | `components/prontuario/ProntuarioReceita.vue` (interruptor de crítico) |
| Contadores | `composables/useClinicoPendencias.ts` (`tratamentos`), `components/home/usePautaDaHome.ts` |
| Palavras | `composables/useRotulosDoTratamento.ts`; `clinico.adesao.*` nos seis idiomas |
| Testes | `domain/__tests__/adesao.spec.ts`; `data/__tests__/adesao-conectada.spec.ts` |
| Dados do app | `docs/clinico/contrato/demo-responsavel.json` — `tratamentos` e `avisosDeDose` (`npm run contrato:demo`) |

## Mudança no modelo

- `Prescription` ganhou `critico?: boolean`.
- Tipos novos: `Cuidador` (dono e família, com acesso de leitura ou edição), `TratamentoEmCasa`
  (o item da receita que virou lembrete, com a posologia copiada, `critico`,
  `compartilhadoComAClinica` e o `contato` da clínica) e `RegistroDeDose` (só o que alguém marcou —
  a dose sem registro é a ausência de linha).
- O dataset ganhou `cuidadores`, `tratamentos` e `registrosDeDose`.
- Contrato: `ItemDaReceita.tratamentoId`, `CriarLembretesDaReceita.compartilharComAClinica`,
  `LembreteCriadoDaReceita.tratamentoId`, e a seção nova "Adesão ao tratamento".
- O resumo "Este pet em 30 segundos" recebe `tratamentos` e ganhou o sinal `adesao` (risco).
- Operações novas de mock: `tratamento.listar` e `tratamento.registrar`, que falham sozinhas.

## Do lado do responsável

Em [16-adesao-visao-do-responsavel.md](./16-adesao-visao-do-responsavel.md): a tela de remédios do
pet, o aviso com **Dei**, **Pulei** com os três motivos, a família, as regras de "sem virar spam",
o compartilhamento com a clínica e o que a API precisa ter. O cenário da Fátima ganhou o Rafael
(família, edição) e a Clara (só leitura), e os registros do meloxicam e do omeprazol da Pérola.

## O que falta conferir

- **Visto no navegador:** as abas Tratamento da Duna e da Pérola (tema claro, tela larga); a lista
  **Tratamentos em casa** em 1024 px; o cartão **Remédio em casa** do resumo no tema escuro.
- **Falta olhar:** as abas Tratamento no tema escuro e em tela de celular, e o interruptor de
  crítico na receita.

As fotos dos pacientes do roteiro (Duna, Pérola, Cacau, Chico e outros) são de demonstração, com
autoria e licença em `public/demo/pacientes/CREDITOS.md`. Pet sem `fotoUrl` mostra o avatar
desenhado da espécie.

## O que ainda não existe

- **Meu dia** ainda não mostra o alerta — ele está no menu, na Visão geral, na lista e na ficha.
- **Renovar a receita a partir do alerta.** Hoje: ligar e registrar a conversa; a receita nova sai
  de um atendimento.
- **Suspender o tratamento pela ficha.** O modelo tem `encerradoEm`; a tela não tem o botão.
- **Mudar o horário da grade** depois de criada (trocar 23h por 22h) — é do app, e o contrato ainda
  não tem a rota.
- **Registrar a dose depois da janela** (decisão 2).
- **Prever quando o remédio acaba** pela quantidade dispensada — "acabou" hoje é só o motivo que a
  casa conta.
- A apresentação e o roteiro falado (`apresentacao/`) ainda não têm esta cena.
