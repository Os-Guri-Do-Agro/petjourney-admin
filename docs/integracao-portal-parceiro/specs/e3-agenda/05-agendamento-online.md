# Spec: Agendamento online (pedido pelo app e pela página pública, caixa da recepção)

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E3 agenda](../../../../../epicos/portal-parceiro-e3-agenda.md)
**Depende de:** [E3-02 agenda](02-agenda-e-agendamentos.md), [E2-02 vínculo](../e2-pacientes-e-ponte/02-vinculo-e-consentimento.md) (`ativarPorPedido`), [E1-01 perfil](../e1-fundacao/01-perfil-publico-do-estabelecimento.md), [E1-04 rotas públicas](../e1-fundacao/04-contrato-erros-e-rotas-publicas.md)

---

## Visão Geral

O responsável **pede** horário, e a clínica responde (decisão de produto registrada no doc 18 do portal). Há dois caminhos:
- **escolher dia e horário**, com o horário segurado por alguns minutos enquanto revisa;
- **pedir o melhor horário**, informando semana, período e profissional opcional.

Emergência nunca vira pedido: vira o contato da clínica. O pedido chega pelo app (pet do app, até 3 pets seguidos) ou pela página pública com cadastro mínimo. A recepção responde numa caixa: aceitar aquele horário, marcar outro ou recusar com motivo. A clínica pode ligar o aceite automático.

## Motivação

"É o elo que nenhum concorrente tem completo: o agendamento nasce no app do responsável e cai direto na agenda da clínica" (doc 18). Tipos do portal:
- `PedidoDeHorario`, `AgendamentoOnline`, `ContatoDeEmergencia`, `CadastroMinimo`, `RecusaDoPedido`, `AvisoDoPedido` (`petjourney-admin/src/features/clinico/data/types.ts:525-701`);
- regras em `domain/pedidos.ts` (491 linhas): horários oferecidos, seguidos para vários pets, melhor horário, prazo contado só no expediente, clínica aberta agora, pedido que perdeu o sentido;
- rotas `ROTAS_DO_PEDIDO` (`contrato/responsavel.ts:2113-2127`).

---

## Research Findings

- **Regras a portar:**
  - `prazoEmExpediente`: "respondemos em até 4 h" dito às 22h vence no meio da manhã;
  - `pedidoPerdeuOSentido`: expira quando o horário escolhido passa ou a janela acaba, nunca por atraso da clínica;
  - `ocupacoesDosPedidos`: o pedido de horário escolhido segura o horário na conta de conflito;
  - `camposQueFaltam`: nascimento e sexo para completar o pet;
  - `TIPO_DO_MOTIVO`: motivo do pedido para `kind` do atendimento.
- **Decisões do portal mantidas:**
  - o pedido não expira por atraso da clínica;
  - a carga do dia não tira horário;
  - o botão diz o horário que grava;
  - o aceite automático nasce desligado;
  - link e app são origens diferentes;
  - pet internado não aparece para marcar;
  - primeira vez marcada, com opção de liberar o histórico.
- **Infra:** a rota pública precisa de captcha, taxa distribuída e idempotência (E1-04). O cadastro mínimo do link não tem e-mail no portal, e o canal de mensagem para quem veio pelo link não existe (Q3 do épico pai).

**Breaking changes:** nenhuma.

## Decisões

- **D1 Pedido pelo app ativa o vínculo no aceite** (D-E2.3): a tela de pedido diz que a clínica passa a acompanhar o pet. A chave `compartilharHistorico` liga o consentimento de diário e peso naquele momento (a tela pede explícito).
- **D2 Pedido pelo link cria cadastro na clínica no aceite**, sem vínculo (o visitante não tem app). A confirmação mostra o convite para o app; a clínica pode propor o vínculo depois (E2-02).
- **D3 Canal do visitante do link na v1:** a página de acompanhamento por token (o link fica na tela e na confirmação) e **e-mail opcional** no cadastro mínimo. SMS e WhatsApp ficam para o E9. Resolve a Q3 do épico pai pela recomendação; se o Nicolas decidir diferente, muda só o canal.
- **D4 Reserva de horário** de `politica.reservaMinutos` (5 min) para o caminho "escolher horário", com `ReservaDeHorario` (E3-02). Se perder a corrida, `HORARIO_INDISPONIVEL` e a lista é relida.
- **D5 Grupo de até 3 pets** do mesmo responsável, horários seguidos com o mesmo profissional. A recepção responde o grupo de uma vez.
- **D6 Aceite automático** só para "horário escolhido" com o horário ainda livre e sem conflito além de `info`.
- **D7 Emergência é estado, não pedido.** `GET .../agendamento-online` traz o contato de emergência e se a clínica está aberta agora, calculados no servidor.

## Modelo de dados (aditivo)

```prisma
enum CanalPedido { APP LINK }
enum ModoPedido { HORARIO_ESCOLHIDO MELHOR_HORARIO }
enum MotivoPedido { CHECKUP VACINA SINTOMA RETORNO EXAME BANHO OUTRO }
enum StatusPedido { PENDENTE ACEITO RECUSADO DESISTIU EXPIRADO }
enum MotivoRecusaPedido { SEM_HORARIO SERVICO_INDISPONIVEL PRECISA_AVALIAR EMERGENCIA OUTRO }

model ConfiguracaoAgendamentoOnline {
  parceiroId              String   @id
  ativo                   Boolean  @default(false)
  permiteEscolherHorario  Boolean  @default(true)
  permiteMelhorHorario    Boolean  @default(true)
  aceitarSozinho          Boolean  @default(false)
  tipoIds                 String[]
  profissionalIds         String[]
  antecedenciaMinimaHoras Int      @default(2)
  horizonteDias           Int      @default(30)
  prazoDeRespostaHoras    Int      @default(4)
  atualizadoEm            DateTime @updatedAt
}

model PedidoDeHorario {
  id                   String        @id @default(cuid())
  parceiroId           String
  canal                CanalPedido
  modo                 ModoPedido
  petId                String?       // app
  tutorId              String?       // app
  pacienteId           String?       // preenchido no aceite (ou já conhecido)
  cadastroMinimo       Json?         // link: nome, telefone, email?, petNome, especie, nascimento?, sexo?
  tipoId               String
  motivo               MotivoPedido
  queixa               String?       // até 1000, nunca resumida
  profissionalId       String?
  inicio               DateTime?
  fim                  DateTime?
  preferencia          Json?         // { de, ate, periodos[], profissionalId? }
  grupoId              String?
  remarcaAgendamentoId String?
  compartilharHistorico Boolean      @default(false)
  status               StatusPedido  @default(PENDENTE)
  responderAte         DateTime
  respondidoEm         DateTime?
  respondidoPor        String?       // RECEPCAO | AUTOMATICO
  respondidoPorId      String?
  agendamentoId        String?
  recusaMotivo         MotivoRecusaPedido?
  recusaMensagem       String?
  tokenAcompanhamento  String?       @unique // link
  criadoEm             DateTime      @default(now())
  @@index([parceiroId, status, criadoEm])
  @@index([tutorId, status])
}
```

`AvisoDoPedido` vive na tabela de comprovantes da E3-06.

## Rotas

**Recepção** (`@ExigeModulo(CLINICA)`, `pedido.responder`):

| Método e rota | Descrição |
|---|---|
| `GET /parceiro/portal/clinica/pedidos?status=` | Caixa: grupo, folhinha do horário (riscado se sumiu), pet e quem pede, serviço, prazo (`no-prazo`, `vencendo` a 30 min, `atrasado`) |
| `GET /parceiro/portal/clinica/pedidos/:id` | Detalhe com queixa, telefone do link, histórico liberado (resumo do E2-03 quando houver consentimento) |
| `GET /parceiro/portal/clinica/pedidos/:id/sugestoes?limite=6` | Melhores horários (porte de `melhoresOpcoes`) |
| `POST /parceiro/portal/clinica/pedidos/:id/aceitar` | `{ inicio?, profissionalId? }` (vazio = o escolhido); cria agendamento(s), cadastro na primeira vez, vínculo pelo app; move o antigo na remarcação |
| `POST /parceiro/portal/clinica/pedidos/:id/recusar` | `{ motivo, mensagem }` |
| `GET/PUT /parceiro/portal/clinica/agendamento-online` | Configuração (ligar exige perfil publicado na E1-01) |

**Responsável no app** (`/tutor/clinica`, dono):

| Método e rota | Descrição |
|---|---|
| `GET /tutor/clinica/estabelecimentos/:slug/agendamento-online` e `GET /tutor/clinica/clinicas/:parceiroId/agendamento-online` | `AgendamentoOnlineDaClinica`: modos, prazo de resposta, serviços, profissionais, emergência com estado de agora |
| `GET .../dias-para-pedido?petIds=&tipoId=&profissionalId=&de=&ate=` | Dias com situação (`COM_HORARIO`, `SEM_HORARIO`, `FECHADA` com o feriado) e opções (um horário por pet, seguidos) |
| `POST /tutor/clinica/pedidos/reservas` e `DELETE /tutor/clinica/pedidos/reservas/:id` | Segura e libera; 409 `HORARIO_INDISPONIVEL` |
| `POST /tutor/clinica/pedidos` | Cria (`reservaId` ou `preferencia`); 409 `RESERVA_EXPIRADA`, 422 `CADASTRO_INCOMPLETO` (nascimento e sexo), 409 `MODO_INDISPONIVEL`, 409 `PET_INTERNADO` |
| `GET /tutor/clinica/pedidos` | Abertos e dos últimos 30 dias, com `responderAte` e `podeCancelar` |
| `POST /tutor/clinica/pedidos/:id/cancelar` | 409 `PEDIDO_JA_RESPONDIDO` |

**Público** (`// PUBLIC:`, captcha, `@ThrottlePublico`, `Idempotency-Key`):

| Método e rota | Descrição |
|---|---|
| `GET /public/estabelecimentos/:slug/agendamento` | Igual ao do app, sem dado de pet |
| `GET /public/estabelecimentos/:slug/agendamento/dias?especie=&tipoId=&de=&ate=` | Dias e opções |
| `POST /public/estabelecimentos/:slug/agendamento/reservas` | Segura (teto por IP) |
| `POST /public/estabelecimentos/:slug/agendamento/pedidos` | `CriarPedidoPeloLink` com `cadastroMinimo` (telefone com DDD obrigatório, e-mail opcional) → `{ token, responderAte }` |
| `GET /public/pedidos/:token` e `POST /public/pedidos/:token/cancelar` | Acompanhar e desistir; 404 genérico para token desconhecido |

Notificações e avisos (detalhe na E3-06): `PEDIDO_HORARIO_RECEBIDO` (equipe com `pedido.responder`), `PEDIDO_ACEITO`, `PEDIDO_MARCADO_EM_OUTRO_HORARIO`, `PEDIDO_RECUSADO` (responsável). E-mail para o visitante do link quando ele deixou e-mail. Cron de 10 min marca `EXPIRADO` o que perdeu o sentido.

## Acceptance Criteria

- [ ] **Given** pedido às 22:00 com prazo de 4 h e expediente das 08:00 às 18:00 **Then** `responderAte` é 12:00 do dia seguinte (golden test de `prazoEmExpediente`).
- [ ] **Given** dois responsáveis reservando o mesmo horário **Then** o segundo recebe 409 `HORARIO_INDISPONIVEL`.
- [ ] **Given** reserva expirada **When** cria o pedido **Then** 409 `RESERVA_EXPIRADA`.
- [ ] **Given** pedido pelo app aceito **Then** nasce o agendamento `origem=APP` e o vínculo ATIVO (`ativarPorPedido`) com consentimento de diário e peso conforme `compartilharHistorico`.
- [ ] **Given** pedido pelo link aceito **Then** nascem cliente e paciente na clínica com o cadastro mínimo, o agendamento `origem=LINK` e nenhum vínculo.
- [ ] **Given** grupo de 2 pets **When** a recepção aceita **Then** os 2 agendamentos são criados juntos ou nenhum (transação).
- [ ] **Given** aceite automático ligado e horário escolhido livre **Then** vira agendamento sem ninguém da recepção, com `respondidoPor=AUTOMATICO`.
- [ ] **Given** o horário escolhido passou sem resposta **Then** o pedido vira `EXPIRADO`; atraso da clínica sozinho nunca expira.
- [ ] **Given** captcha ligado sem token **Then** 400 `CAPTCHA_INVALIDO` e nada gravado.
- [ ] **Given** pet do app com internação ativa na clínica **Then** 409 `PET_INTERNADO`.
- [ ] Os casos difíceis do doc 18 (vários pets no mesmo dia, horário que some enquanto preenche, primeira consulta) passam como testes.

## Estratégia de Testes

- Unit: porte de `domain/pedidos.ts` com golden tests, D1 a D7.
- Integration: corrida de reservas; aceite de grupo; cron de expiração.
- Cenários: outro tutor cancelando pedido (403), token público inexistente (404 genérico), outro parceiro aceitando (403).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/agenda/pedidos/` (controllers recepção, tutor e público; service; cron; `regras/pedidos.ts`) | Criar |
| `src/notificacao/catalogo/*`, `src/sendgrid-mail/*` | 4 tipos + e-mail do visitante |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Porte das regras + golden tests
- [ ] **T3** Leituras de configuração e dias (app e público)
- [ ] **T4** Reservas e criação de pedido (app e público, com captcha, taxa e idempotência)
- [ ] **T5** Caixa da recepção: aceitar, marcar outro, recusar, aceite automático
- [ ] **T6** Expiração, avisos, contadores (`pedidos`), testes e handoff (`/publico` vira `/public`)

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Robô enchendo a caixa pelo link | Captcha, taxa por IP e por slug no Postgres, teto por telefone por dia, telefone com DDD validado |
| Médio | Visitante do link sem resposta (sem canal) | Página com token + e-mail opcional + a clínica liga; WhatsApp no E9 |

## Rollout / Rollback

Aditivo e atrás do módulo e da configuração (`ativo=false` por padrão). A página pública só responde com perfil publicado (E1-01) e agendamento online ligado. Rollback: desligar a configuração por parceiro; o código pode ser revertido sem perder pedidos já respondidos.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
