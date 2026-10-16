# 18 · Agendamento online pelo responsável

O responsável pede horário pelo app ou pela página pública da clínica, e a recepção responde. Dois
caminhos de pedido, um desvio de emergência, e o horário aceito aparece na agenda com a origem à
vista.

## Por que existe

É o elo que nenhum concorrente tem completo: o agendamento nasce no app do responsável e cai direto
na agenda da clínica, sem telefone no meio. Para a clínica, é menos trabalho de recepção e cliente
novo chegando — inclusive quem ainda não tem o app, pelo link.

Até aqui o contrato (doc 09, seção 4) previa o app **marcando** sozinho: reservar e gravar. O pedido
do produto mudou isso: o responsável **pede**, e a clínica aceita.

## Pronto quando

- [x] Um responsável pede do zero em menos de um minuto no protótipo, e o atendimento aparece na
      agenda da clínica com a origem identificada (ícone de celular para o app, de globo para o link,
      e "Aplicativo" / "Link da clínica" no detalhe).
- [x] **Dois caminhos.** *Escolher dia e horário*: o responsável vê a agenda livre, escolhe o
      profissional (ou qualquer um) e o horário; a clínica aceita aquele horário ou marca outro.
      *Pedir o melhor horário*: o responsável diz a semana e o período; a clínica marca no melhor
      horário que tiver.
- [x] **Emergência.** Primeira linha do motivo, e os sinais de alerta no "está com algum sintoma":
      qualquer um leva ao contato da clínica (aberta ou fechada agora, telefone grande com "Ligar
      agora", WhatsApp, como chegar, a mensagem da clínica para fora do horário). Não vira pedido.
- [x] Estados: clínica fechada no dia (domingo, feriado com o nome), dia sem horário (atalho para o
      próximo dia e para "pedir o melhor horário"), pet com cadastro incompleto (completa ali mesmo),
      pet em internação (não aparece para marcar), clínica que não recebe pedidos.
- [x] Link público da clínica, com cadastro mínimo no fim (nome, celular, nome e espécie do pet;
      idade e sexo opcionais) e endereço de acompanhamento.
- [x] Confirmação e aviso: push no app / mensagem para quem veio pelo link, com o texto em
      `TEXTOS_PT_DO_PEDIDO`. O lembrete da véspera é o `AGENDAMENTO_LEMBRETE_VESPERA` que já existia.
- [x] Cancelamento e remarcação pelo responsável respeitando o prazo da clínica
      (`politica.cancelarAteHorasAntes`): passou do prazo, o botão some e a frase manda ligar.
      Remarcar é pedir de novo com pet e serviço já sabidos; o horário antigo é movido no aceite.
- [x] Casos difíceis do requisito, todos no protótipo e cobertos por teste:
  - **Responsável com vários pets marcando para dois no mesmo dia** — até três pets por pedido, em
    horários seguidos com o mesmo profissional; a recepção responde o grupo de uma vez.
  - **Horário que some enquanto a pessoa preenche** — o horário escolhido fica segurado por 5 min
    na revisão (relógio na tela); a chave "No próximo horário escolhido, outra pessoa chega antes"
    na gaveta do celular faz a recepção marcar ali por telefone, e o app diz "Alguém pediu o horário
    das 08:00 antes de você" e relê a lista. Do lado da clínica, a Luna mostra o mesmo caso: o
    horário escolhido foi ocupado depois do pedido, e a linha já sugere o mais perto dele.
  - **Primeira consulta em clínica onde o pet não tem histórico** — o pet que só existe no app (Fubá,
    da Renata) ou que vem pelo link (Tobias) chega marcado "Primeira vez"; a pessoa pode liberar o
    histórico do app; o aceite cria o cadastro na clínica.

## Como demonstrar em um minuto

1. `?clinico=on` e abra **Clínica › Pedidos de horário** (`/veterinario/pedidos`).
2. Pílula **Como o responsável pede**: o celular abre numa gaveta que empurra a página.
3. No celular (Fátima): Pedir horário → Pérola e Brunilda → Check-up → a clínica → Escolher dia e
   horário → Qualquer profissional → um horário → Enviar. A linha aparece na caixa ao lado.
4. Na linha: **Aceitar** (ou **Responder**, para ver o pedido inteiro e o calendário na gaveta). O
   aviso chega no celular; "Ver na agenda" abre o atendimento com a origem.
5. Pílula **Link da clínica › Abrir a página**: a mesma coisa sem conta, pela página pública.

Para a primeira consulta, troque a pessoa para **Renata · primeira vez** (cadastro incompleto do
Fubá, histórico, "Primeira vez" na linha).

## Onde mora

| Camada | Arquivo |
|---|---|
| Contrato (fio) | `src/features/clinico/contrato/responsavel.ts`, seção "Agendamento online" |
| Regras | `src/features/clinico/domain/pedidos.ts` — horários oferecidos, seguidos, melhor horário, prazo no expediente, clínica aberta agora |
| Servidor de mentira | `src/features/clinico/data/agendamento-online.ts` — os dois lados: `agendamentoOnlineDoResponsavel` (contrato) e `pedidoRepository` (recepção) |
| Semente | `src/features/clinico/data/seed-pedidos.ts` |
| Caixa da recepção | `src/pages/(accounts)/veterinario/pedidos.vue`; a linha em `PedidoLinha.vue`, a resposta em `PedidoGaveta.vue`, a configuração em `AgendamentoOnlineGaveta.vue` |
| Peças de calendário | `CalendarioDoPedido.vue` (o mês com os dias livres, no celular, na gaveta e no hotel) e `FolhaDoDia.vue` (a folhinha do dia na linha, na revisão e na confirmação) |
| Fluxo do responsável | `components/pedidos/fluxo/*` (o mesmo no celular e no link) |
| Página pública | `src/pages/agendar/[clinica].vue` → `/agendar/petjourney-vila-madalena`, na moldura `src/components/publico/PaginaPublica.vue` (a mesma do hotel) |
| Agenda | ícone da origem em `AgendaTabelaDia.vue` e `AgendaAppointmentCard.vue` |
| Menu e visão geral | selo em `useClinicoPendencias` (`pedidos`), linha na pauta da visão geral |

## Decisões

- **A linha só tem o que decide a triagem**: a folhinha do dia (o horário que sumiu aparece
  riscado), o pet e quem pede, o serviço e com quem, o prazo, "Responder" e o botão que grava. A
  queixa, o telefone de quem veio pelo link, o histórico liberado e a escolha de outro horário
  moram na gaveta. A primeira versão empilhava cinco linhas de ícone e texto e três botões por
  pedido, e a caixa virava parede.
- **Responder é uma gaveta lateral, não um diálogo no meio da tela.** A caixa fica à vista e a linha
  aberta fica tingida. Em tela larga a gaveta empurra a página; abaixo de 1280 px passa por cima,
  sem véu. A gaveta do celular mora do mesmo lado: abrir a de resposta guarda o celular, e fechá-la
  o devolve.
- **Dia se escolhe em calendário.** No celular, o mês com um ponto nos dias com horário (fechado
  riscado, cheio apagado — nenhum desabilitado, para tocar e saber por quê); no melhor horário, um
  calendário de período com atalhos; na gaveta da recepção, o mesmo mês com o dia pedido num anel e
  a janela em que a pessoa pode tingida, e os horários de um profissional de cada vez.

- **O pedido de horário escolhido segura o horário** enquanto a clínica não responde: entra na conta
  de conflito como um atendimento (`ocupacoesDosPedidos`). Sem isso, dois responsáveis pediriam o
  mesmo 10:30.
- **O prazo de resposta conta só o expediente** (`prazoEmExpediente`): "respondemos em até 4 h" dito
  às 22h vence no meio da manhã, não às 2h.
- **O pedido não expira por atraso da clínica.** Só perde o sentido quando o horário escolhido passa
  ou a janela do melhor horário acaba.
- **A carga do dia não tira horário.** O aviso de capacidade é planejamento (a barra da agenda), não
  ocupação; contado como conflito, um aceite de manhã fazia o pedido da tarde parecer "ocupado".
- **O botão cheio diz o horário que grava:** "Aceitar" quando o escolhido continua livre, "Marcar
  13:00" quando a clínica precisa escolher. Ninguém aceita às cegas um horário que já não existe.
- **Aceite automático** existe e nasce desligado (Como recebemos pedidos): horário escolhido e livre
  vira atendimento na hora.
- **Link e app são origens diferentes** (`link` / `LINK_PUBLICO`): a confirmação vai por canal
  diferente, e quem veio pelo link é o cliente a trazer para o app.
- **Ligar só na emergência.** É o único "ligar" do fluxo, e é o responsável ligando para a clínica.
  No portal a regra continua: a clínica registra o contato, não disca.
- **A página pública é uma tela dividida, como um checkout** (15/10/2026). A primeira versão era a
  coluna do celular solta no meio da tela, e no computador sobrava tudo. Agora a metade da clínica,
  em teal com a pata da marca no canto, tem nome, endereço, aberta/fechada, o prazo de resposta, os
  cinco passos do pedido com o que já foi escolhido, quem atende e o contato; a metade do pedido,
  clara com a grade das telas do portal, tem o fluxo solto na página, com "Passo 2 de 5" e o título
  na escala da página. Só dado do contrato — o horário da semana não está nele, então não aparece.
  Abaixo de 1024 px vira uma coluna e os passos saem. O fluxo é o mesmo componente do celular; a
  página só muda a escala do título e solta a ação do pé da tela (ela vem logo depois do conteúdo).
- O link abre **na mesma aba**: os dados são de demonstração e moram na memória da aba; numa aba
  nova o pedido nunca chegaria à caixa. A faixa "Página pública da clínica (demonstração)" só
  aparece com sessão.

## Para o `petjourney-app`

A tela 2 do doc 09 (**Agendar**) muda de fluxo. O que vale agora:

1. `GET /tutor/clinica/clinicas/:clinicaId/agendamento-online` → `AgendamentoOnlineDaClinica`:
   modos aceitos, prazo de resposta, serviços, profissionais e o contato de emergência com o estado
   de agora calculado no servidor.
2. Motivo antes de tudo, com **Emergência** na primeira linha e os `SINAIS_DE_EMERGENCIA` em
   "sintoma". Qualquer sinal marcado leva à tela de emergência, não ao horário.
3. Pet com nascimento ou sexo em branco: pedir os dois ali (`CAMPOS_DO_PET_PARA_PEDIDO`) e salvar no
   perfil do pet antes de seguir. Pet internado não aparece para marcar.
4. **Escolher dia e horário:** `GET .../dias-para-pedido` (`BuscarDiasParaPedido`, com 1 a 3
   `petIds`) devolve os dias com situação (`COM_HORARIO`, `SEM_HORARIO`, `FECHADA` com o feriado) e
   as `OpcaoDeHorario` — com dois pets, cada opção traz um horário por pet, seguidos. Escolhido:
   `POST /tutor/clinica/pedidos/reservas` (5 min) → `POST /tutor/clinica/pedidos` com `reservaId`.
   `HORARIO_INDISPONIVEL` na reserva: reler os dias e dizer que outra pessoa pegou.
5. **Pedir o melhor horário:** `POST /tutor/clinica/pedidos` com `preferencia` (de, até, períodos,
   profissional opcional).
6. Primeira vez na clínica: perguntar se libera o histórico (`compartilharHistorico`).
7. Depois de enviar: o pedido em `GET /tutor/clinica/pedidos`, com `responderAte`; desistir com
   `POST .../pedidos/:id/cancelar` enquanto `podeCancelar`. A resposta chega pelos três tipos de
   `TIPOS_DE_NOTIFICACAO_DO_PEDIDO` (rota `/screens/clinica/pedido`), fora do `Record` fechado — entram
   lá junto com a tela.
8. Remarcar um agendamento é um pedido com `remarcaAgendamentoId`; o agendamento antigo continua até
   a clínica aceitar.

A página pública fala as rotas `/publico/...` de `ROTAS_DO_PEDIDO`, com `VisitanteDoLink` no lugar
de `petIds` e um `token` para acompanhar sem conta.

## O que ainda não existe

- API: nenhuma rota de `ROTAS_DO_PEDIDO` existe no backend; o envio de mensagem para quem veio pelo
  link (SMS/WhatsApp) também não.
- A tela do app em si (o protótipo é a prévia do celular no portal).
- QR do link: o QR que o portal já mostra vem da API de indicação; o link de agendamento ainda não
  tem um.
- Conflito na agenda da recepção ao marcar por cima de um horário pedido e pendente: hoje a linha do
  pedido avisa depois ("ocupado depois do pedido"); a agenda não avisa antes.
