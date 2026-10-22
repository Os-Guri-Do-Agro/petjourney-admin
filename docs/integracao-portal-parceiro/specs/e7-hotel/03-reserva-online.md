# Spec: Reserva online do hotel (pedido pelo app e pela página pública)

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E7 hotel](../../../../../epicos/portal-parceiro-e7-hotel.md)
**Depende de:** [E7-02 reservas](02-reservas-e-disponibilidade.md), [E3-05 agendamento online](../e3-agenda/05-agendamento-online.md) (mesmo desenho, mesma infra pública), [E2-02 vínculo](../e2-pacientes-e-ponte/02-vinculo-e-consentimento.md)

---

## Visão Geral

A versão de hotel do agendamento online:
- **dois caminhos:** escolher a acomodação, ou o hotel escolhe a mais justa para o porte;
- **urgência** (entrada em menos de `antecedenciaMinimaHoras`) leva ao contato, não vira pedido;
- **dois pets da mesma casa** num pedido (cão e gato não dividem);
- **o pedido de tipo escolhido segura uma unidade do tipo** para quem pede depois;
- **o prazo de resposta conta só com o balcão aberto**;
- **aceitar cria a reserva PENDENTE**, à espera do sinal;
- **aviso de volta:** aceito, alocado (o hotel escolheu ou mexeu um dia) ou recusado com motivo.

## Motivação

Doc `hotel/03` do portal:
- tipos `PedidoDeReserva`, `ReservaOnline`, `ContatoDeUrgenciaDoHotel`, `AvisoDoPedidoDeReserva`, `CadastroMinimoDaReserva` (`petjourney-admin/src/features/hotel/data/types.ts:593-690`);
- regras em `domain/pedidos-de-reserva.ts` (`podemDividir`, `pedidosQueSeguram`, `melhoresAcomodacoes`, `prazoNoBalcao`, `ehUrgente`, `pedidoDeReservaPerdeuOSentido`);
- rotas `ROTAS_DA_RESERVA_ONLINE` (`hotel/contrato/responsavel.ts:174-183`);
- erros `SEM_VAGA_NO_TIPO`, `FORA_DA_ANTECEDENCIA`, `NAO_DIVIDEM_ACOMODACAO`, `PEDIDO_JA_RESPONDIDO`.

---

## Decisões

- **D1 Mesma infra do E3-05:** captcha, taxa no Postgres, idempotência, token de acompanhamento, e-mail opcional para o visitante do link, contadores e avisos. Diferem só as regras do hotel.
- **D2 Reservar segura o tipo, não a unidade** (`pedidosQueSeguram` por `criadoEm`); quem pediu primeiro leva.
- **D3 Aceite pelo app ativa o vínculo** (D-E2.3); pelo link cria cadastro sem vínculo.
- **D4 "Aceito mudar um dia"** permite a sugestão andar um dia, e o aviso diz que andou (`alocado`).
- **D5 Pagamento do sinal pelo app** fica no E9; a reserva aceita fica pendente até o balcão registrar o sinal.

## Modelo de dados (aditivo)

```prisma
model ConfiguracaoReservaOnline { parceiroId @id, ativo, permiteEscolherAcomodacao, permiteHotelEscolhe, tipoIds String[], antecedenciaMinimaHoras, horizonteDias, prazoDeRespostaHoras, balcaoAbre String, balcaoFecha String }
model PedidoDeReserva { id, parceiroId, canal (APP|LINK), modo (ACOMODACAO_ESCOLHIDA|HOTEL_ESCOLHE), petId?, acompanhantePetId?, tutorId?, pacienteId?, cadastroMinimo Json?, entrada, saida, tipoId?, aceitaMudarUmDia Boolean, servicos String[], observacao?, status, responderAte, respondidoEm?, respondidoPor?, reservaId?, recusaMotivo?, recusaMensagem?, tokenAcompanhamento? @unique, criadoEm }
```

## Rotas

**Balcão** (`@ExigeModulo(HOTEL)`, `hotel.reservar`): `GET /parceiro/portal/hotel/pedidos`, `GET .../pedidos/:id/sugestoes?inicio=&fim=`, `GET .../pedidos/:id/noites?de=&ate=`, `GET .../pedidos/:id/estimativa?acomodacaoId=&inicio=&fim=`, `POST .../pedidos/:id/aceitar { acomodacaoId, inicio?, fim? }`, `POST .../pedidos/:id/recusar { motivo, mensagem }`, `GET/PUT /parceiro/portal/hotel/reserva-online`.

**Responsável** (`/tutor/hotel`): `GET /tutor/hotel/estabelecimentos/:slug/reserva-online`, `GET .../disponibilidade?petIds=&entrada=&saida=`, `POST /tutor/hotel/pedidos`, `GET /tutor/hotel/pedidos`, `POST /tutor/hotel/pedidos/:id/cancelar`, `POST /tutor/hotel/pets/:petId/porte` (completa o porte, salva no perfil do pet).

**Público** (`// PUBLIC:`): `GET /public/estabelecimentos/:slug/hotel`, `GET .../hotel/disponibilidade?especie=&porte=&entrada=&saida=`, `POST .../hotel/pedidos`, `GET /public/reservas/:token`, `POST /public/reservas/:token/cancelar`.

Notificações: `RESERVA_PEDIDO_ACEITO`, `RESERVA_PEDIDO_ALOCADO`, `RESERVA_PEDIDO_RECUSADO` (responsável) e `PEDIDO_RESERVA_RECEBIDO` (equipe com `hotel.reservar`). Contador `pedidosDeReserva`.

## Acceptance Criteria

- [ ] **Given** entrada em 20 h com antecedência mínima de 24 h **Then** `GET` diz urgência e o `POST` dá 409 `FORA_DA_ANTECEDENCIA`.
- [ ] **Given** cão e gato no mesmo pedido **Then** 409 `NAO_DIVIDEM_ACOMODACAO`.
- [ ] **Given** a última suíte segurada por um pedido anterior **When** outro pede suíte **Then** 409 `SEM_VAGA_NO_TIPO`.
- [ ] **Given** pedido às 21:00 com prazo de 3 h e balcão das 08:00 às 20:00 **Then** `responderAte` às 11:00 do dia seguinte.
- [ ] **Given** aceite **Then** nasce `ReservaDeHotel` PENDENTE com o orçamento do servidor, e o aviso `RESERVA_PEDIDO_ACEITO` (ou `ALOCADO` se mudou o dia ou a acomodação).
- [ ] Casos difíceis do doc `hotel/03` (dois pets, tipo que esgota, primeira estadia) como testes.

## Estratégia de Testes

- Unit: golden tests de `pedidos-de-reserva.spec`.
- Integration: corrida de pedidos pelo último tipo.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/hotel/pedidos/` (controllers balcão, tutor e público; `regras/pedidos.ts`) | Criar |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Porte das regras
- [ ] **T3** Rotas do app e públicas (com a infra do E1-04)
- [ ] **T4** Caixa do balcão e aceite
- [ ] **T5** Avisos, expiração, contador, handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Robô enchendo a caixa do balcão pelo link | Mesma proteção da E3-05 (captcha, taxa no Postgres, teto por telefone) |
| Médio | Tipo vendido duas vezes por pedidos simultâneos | Segura o tipo por ordem de criação (D2) com checagem atômica no aceite |

## Rollout / Rollback

Atrás do módulo HOTEL e de `ativo=false` na configuração. Rollback: desligar a configuração por parceiro.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
