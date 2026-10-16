# 03 · Reserva online pelo responsável

A versão de hotel do agendamento online da clínica ([clínico, doc 18](../clinico/18-agendamento-online.md)):
o responsável pede a hospedagem pelo app ou pela página pública do hotel, e o balcão responde. A
mesma forma — dois caminhos, desvio de urgência, link com cadastro mínimo, origem à vista — com as
regras de hotel no lugar das de agenda.

## Por que existe

Reserva de hotel hoje chega por telefone e WhatsApp, e o balcão copia para o sistema. Com o pedido
online, a reserva nasce no app com os pets, as datas e os extras já preenchidos, e o balcão só diz
sim. Quem não tem o app chega pelo link e vira cliente novo.

## Pronto quando

- [x] Um responsável pede do zero em menos de um minuto no protótipo, e a reserva aparece em
      **Reservas** como `pendente` (esperando o sinal), com a origem identificada (ícone de celular
      para o app, de globo para o link).
- [x] **Dois caminhos.** *Escolher a acomodação*: o responsável vê o que está livre nas datas, com
      a estimativa de preço, e o hotel confirma. *O hotel escolhe a melhor*: o balcão aloca a mais
      justa para o porte e avisa.
- [x] **Urgência.** Entrada em menos de 24 h (`antecedenciaMinimaHoras`) não vira pedido: "É para
      hoje ou amanhã?" leva ao contato do hotel — telefone com "Ligar agora", WhatsApp, como chegar
      e a orientação do hotel.
- [x] Estados: cão sem porte no cadastro (completa ali mesmo, salva no perfil), pet hospedado agora,
      tipo esgotado nas datas (o tipo fica visível e marcado "Esgotado"), nada livre (atalho para
      "Deixar o hotel escolher"), hotel que não recebe pedidos.
- [x] Link público do hotel com cadastro mínimo (nome, celular, nome, espécie e porte do pet) e
      endereço de acompanhamento.
- [x] Aviso de volta: aceito (tipo escolhido), alocado (o hotel escolheu ou mexeu um dia), recusado
      com o motivo.
- [x] Casos difíceis, todos no protótipo e cobertos por teste:
  - **Dois pets da mesma casa** — um pedido, a mesma acomodação, uma acomodação que comporte os dois
    (Bento e Açaí, Mel e Amora). Cão e gato não dividem: o app diz antes de enviar.
  - **O tipo que esgota enquanto a pessoa pede** — a chave "No próximo envio, outras pessoas pedem
    antes o tipo escolhido" faz o envio voltar com `SEM_VAGA_NO_TIPO`, e o app relê as vagas e
    oferece outra acomodação ou o hotel escolher. Na caixa, a Luna mostra o mesmo caso: pediu suíte
    depois de Thor e Cacau, não sobrou suíte, e a linha já sugere outra.
  - **Primeira estadia de um pet que o hotel não conhece** — o Fubá (Renata) chega com
    "Primeira estadia aqui"; o aceite cria o cadastro do pet e do responsável no hotel.

## Como demonstrar em um minuto

1. `?hotel=on` e abra **Hotel › 1 · Vender › Pedidos de reserva** (`/hotel/pedidos`).
2. Pílula **Como o responsável pede**: o celular abre numa gaveta ao lado.
3. No celular (Luciana): Pedir hospedagem → Mel e Amora → datas → Escolher a acomodação → Baia →
   Banho → Enviar. A linha aparece na caixa.
4. Na linha: **Reservar Baia A3** (o botão diz a acomodação que grava). O aviso chega no celular; a reserva aparece em Reservas com o ícone do app.
5. Pílula **Link do hotel › Abrir a página**: o mesmo pedido sem conta, em `/reservar/petjourney-hotel`.

Para a primeira estadia, troque para **Renata · primeira vez**.

## Onde mora

| Camada | Arquivo |
|---|---|
| Contrato (fio) | `src/features/hotel/contrato/responsavel.ts` |
| Regras | `src/features/hotel/domain/pedidos-de-reserva.ts` — quem divide acomodação, o tipo que um pedido anterior segura, a unidade mais justa para o porte, prazo no horário do balcão, urgência |
| Servidor de mentira | `src/features/hotel/data/reserva-online.ts` — `reservaOnlineDoResponsavel` (contrato) e `pedidoDeReservaRepository` (balcão) |
| Semente | `src/features/hotel/data/seed-pedidos-de-reserva.ts` |
| Caixa do balcão | `src/pages/(accounts)/hotel/pedidos.vue`; a linha em `PedidoDeReservaLinha.vue`, a resposta em `PedidoDeReservaGaveta.vue`, a configuração em `ReservaOnlineGaveta.vue` |
| Fluxo do responsável | `components/pedidos/fluxo/FluxoDaReserva.vue` (o mesmo no celular e no link; reaproveita o CSS do fluxo da clínica) |
| Página pública | `src/pages/reservar/[hotel].vue`, na moldura `src/components/publico/PaginaPublica.vue` |
| Reservas | ícone da origem na lista de `reservas.vue` |
| Menu e visão geral | selo em `useHotelPendencias` (`pedidos`), linha na pauta da visão geral |

## Decisões

- **Mesma forma da clínica**: linha curta com a folhinha das noites ("22–25 · 3 diárias"), e a
  resposta numa gaveta lateral. Na gaveta, a estadia num calendário de período com um ponto nas
  noites em que sobra unidade do tipo pedido — a Luna mostra 23 e 24 sem ponto, que é o "sem suíte
  livre" dito no calendário. Tocar outras datas refaz as opções; o balcão pode propor a sexta em
  vez da quinta, e o aviso sai como "alocado". As unidades livres vêm como cartões com a
  estimativa.
- **No celular, a estadia é um calendário de período**: o primeiro toque é a entrada, o segundo a
  saída, e as noites aparecem pintadas entre os dois.
- **A página pública é a mesma da clínica, por construção** (15/10/2026): as duas usam
  `components/publico/PaginaPublica.vue`, a tela dividida como num checkout. No hotel, os passos ao
  lado são seis (o pet, as datas, a acomodação, os extras, os dados, a revisão) e a urgência sai em
  coral nas datas; no pé, no lugar da equipe, as regras da estadia (entrada e saída, sinal,
  cancelamento). O "Pedido enviado" é o comprovante da clínica (estilos em `fluxo.css`), com o
  sinal como último passo da linha do tempo.

- **O pedido de tipo escolhido segura uma unidade daquele tipo** enquanto o balcão não responde, e
  só para quem pede depois (`pedidosQueSeguram`, por `criadoEm`). Quem pediu primeiro leva.
- **O hotel escolhe pela unidade mais justa**: o cão pequeno não ocupa a baia de gigante; gato só vai
  para onde aceita gato. Com "Aceito mudar um dia", a sugestão pode andar um dia — e diz que andou.
- **O prazo de resposta (3 h) conta só com o balcão aberto**, 08:00–20:00: o pedido da noite vence
  na manhã seguinte.
- **Aceitar cria a reserva `pendente`**, não confirmada: o sinal continua sendo o que confirma, como
  em toda reserva do hotel.
- **A estimativa de preço é estimativa**: diárias do tipo mais extras por diária; o valor final é o
  da reserva.
- Abre **na mesma aba** pelo mesmo motivo da clínica: os dados de demonstração moram na memória da
  aba.

## Para o `petjourney-app`

Rotas em `ROTAS_DA_RESERVA_ONLINE`; notificações `RESERVA_PEDIDO_ACEITO`, `RESERVA_PEDIDO_ALOCADO` e
`RESERVA_PEDIDO_RECUSADO`, todas em `/screens/hotel/pedido`, com o texto em português de
`textoPtDaNotificacaoDaReserva`. A ordem do fluxo:

1. `GET /tutor/hotel/hoteis/:hotelId/reserva-online` → modos, antecedência, tipos, contato de urgência.
2. Pets da conta: só cães e gatos. Cão sem porte pede o porte antes de seguir.
3. Datas. Entrada antes da antecedência → tela de urgência, não pedido (`FORA_DA_ANTECEDENCIA`).
4. `GET .../disponibilidade` → os tipos com `livres` e a estimativa; tipo com zero aparece esgotado.
5. `POST /tutor/hotel/pedidos`. `SEM_VAGA_NO_TIPO`: reler a disponibilidade e dizer que outra
   pessoa pediu antes. `NAO_DIVIDEM_ACOMODACAO`: pedir um de cada vez.
6. Depois: `GET /tutor/hotel/pedidos`, desistir com `POST .../pedidos/:id/cancelar` enquanto
   pendente.

A página pública usa `/publico/hoteis/:slug/...` com espécie e porte no lugar de `petIds`, e
`/publico/reservas/:token` para acompanhar.

## O que ainda não existe

- API: nenhuma rota de `ROTAS_DA_RESERVA_ONLINE` no backend; nem o envio de mensagem para quem veio
  pelo link.
- Cancelar ou mudar a estadia já aceita pelo app: o protótipo cancela o pedido pendente; a reserva
  aceita segue a política do hotel (frase "Cancelamento sem custo até N dias antes"), pelo balcão.
- Pagamento do sinal pelo app.
