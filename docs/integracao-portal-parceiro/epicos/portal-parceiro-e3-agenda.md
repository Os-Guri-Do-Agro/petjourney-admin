# Épico E3: Agenda e atendimento na recepção

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico pai:** [portal-do-parceiro.md](portal-do-parceiro.md)
**Partes (cada uma entregável sozinha):**
1. [01-configuracao-da-agenda.md](../2026/q4/q4-1/portal-parceiro/e3-agenda/01-configuracao-da-agenda.md): tipos de atendimento, salas, expediente por profissional, bloqueios recorrentes e a política da clínica
2. [02-agenda-e-agendamentos.md](../2026/q4/q4-1/portal-parceiro/e3-agenda/02-agenda-e-agendamentos.md): dia, semana, carga, criar, mover, encaixar, cancelar, confirmar presença, chegada e conflitos tipados, com reserva de horário e concorrência
3. [03-faltas.md](../2026/q4/q4-1/portal-parceiro/e3-agenda/03-faltas.md): marcar falta (inclusive em lote), justificativa, painel de faltas, reincidência e reagendar
4. [04-fila-de-espera.md](../2026/q4/q4-1/portal-parceiro/e3-agenda/04-fila-de-espera.md): entrar na fila, posição, oferta de vaga com prazo e aceite atômico
5. [05-agendamento-online.md](../2026/q4/q4-1/portal-parceiro/e3-agenda/05-agendamento-online.md): pedido de horário pelo app e pela página pública, caixa da recepção, aceite, aceite automático e acompanhamento por token
6. [06-avisos-clinicos-ao-responsavel.md](../2026/q4/q4-1/portal-parceiro/e3-agenda/06-avisos-clinicos-ao-responsavel.md): os tipos de notificação da agenda, a véspera, o comprovante de aviso enviado e o canal de quem não tem app
7. [07-pre-consulta.md](../2026/q4/q4-1/portal-parceiro/e3-agenda/07-pre-consulta.md): o formulário que o responsável responde antes da consulta, preenchido pelo diário
8. [08-painel-do-dia-e-resumo-da-clinica.md](../2026/q4/q4-1/portal-parceiro/e3-agenda/08-painel-do-dia-e-resumo-da-clinica.md): "Meu dia", "Atividades" e o resumo da clínica com os números do período

---

## Visão Geral

A agenda é "a tela onde a recepção vive, e é ela que decide se a clínica migra de sistema" (doc 01 do portal). O protótipo cobre um dia de clínica de três veterinários: grade por profissional e por sala, encaixe, bloqueio, arrastar para remarcar, desfazer, semana com carga, faltas, fila de espera com oferta de vaga, pedidos de horário pelo app e pelo link público, pré-consulta e o painel do dia. Este épico leva tudo isso para o servidor.

## Decisões do épico

- **D-E3.1 Nada bloqueia, tudo avisa.** Decisão do portal (doc 01): sobreposição, sala ocupada e horário fora do expediente seguem agendáveis, com conflito tipado (`kind` + `params`, nunca texto). A única exceção que **bloqueia** é a reserva concorrente do mesmo horário vinda de canal online (pedido, fila), porque ali não há ninguém da clínica decidindo.
- **D-E3.2 Agendamento não é internação.** Internação tem entrada e alta sem hora marcada e mora no E5 (decisão do doc 07 do portal).
- **D-E3.3 Agendamento não vira registro no app.** Ele tem os avisos próprios (véspera, pré-consulta). Um `LembreteSerie` CONSULTA seria o mesmo aviso duas vezes (doc 09 do portal, seção 2).
- **D-E3.4 Concorrência com versão e reserva.** Toda edição de agendamento carrega `versao` (otimista, 409 `AGENDAMENTO_ALTERADO` com o estado atual); toda escolha de horário em canal online passa por reserva (`ReservaDeHorario`) de minutos configuráveis.
- **D-E3.5 Desfazer da recepção é do servidor.** O "desfazer 8 s" do portal vira um token de desfazer com validade curta, guardado no servidor, que reverte a última mutação daquele usuário naquele agendamento se nada mudou depois.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
