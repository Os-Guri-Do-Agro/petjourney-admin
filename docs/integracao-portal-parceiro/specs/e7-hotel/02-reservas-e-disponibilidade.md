# Spec: Reservas e disponibilidade do hotel

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E7 hotel](../../../../../epicos/portal-parceiro-e7-hotel.md)
**Depende de:** [E7-01 a casa](01-casa-acomodacoes-e-tarifas.md), [E2-01 pacientes](../e2-pacientes-e-ponte/01-clientes-e-pacientes.md)

---

## Visão Geral

A reserva é a entidade central do hotel:
- **vaga por instante**, somando a higienização (R2);
- **grade de ocupação** (acomodações por noites, com os vazios entre as barras);
- **simular orçamento** no servidor: diárias por porte, temporada, acompanhante, serviços, meia diária da saída tardia, sinal e saldo;
- **criar e editar** com hora de entrada e saída e contador de noites;
- **confirmar** com o sinal pago, **cancelar** com motivo e política, **não comparecimento**;
- **comprovantes e dispensas** de exigência (R1 avaliada desde a reserva);
- **autorizados a retirar**;
- **lista de espera**.

## Motivação

Tipos do portal:
- `Reserva`, `ReservaStatus` (pendente, confirmada, hospedado, encerrada, cancelada, não compareceu), `ReservaOrigem`, `Orcamento`, `LinhaDoOrcamento`, `PessoaAutorizada`, `Comprovante`, `DispensaDeExigencia`, `EntradaDeEspera` (`petjourney-admin/src/features/hotel/data/types.ts:383-590`);
- repositório `reserva-repository.ts` (907 linhas): `mapa`, `simular`, `vaga`, `criar`, `editar`, `confirmar`, `cancelar`, `registrarComprovante`, `dispensar`, `grade`, `espera`;
- domínio `disponibilidade.ts`, `tarifas.ts` (`montarOrcamento`, `cobrancaDaSaida`, `sinalReembolsavel`), `admissao.ts` (5 estados da R1).

Defeitos do hotel que viram testes:
- D4: noite contada por meia-noite atravessada, não por 24 h;
- D7: o mesmo animal em quatro baias ao mesmo tempo, que pede invariante por animal além de por acomodação;
- D11: cancelamento datado depois da estadia.

---

## Decisões

- **D1 R2 no banco.** Exclusion constraint no Postgres (`btree_gist`) sobre `(acomodacaoId, tstzrange(entrada, saida + higienizacao))` para reservas ativas (pendente, confirmada, hospedado), e outra sobre `(pacienteId, tstzrange(entrada, saida))`, o que resolve o defeito D7. A vaga mostrada é a que o banco aceita: "não há segunda fonte" (doc `hotel/01`).
- **D2 Orçamento no servidor** (D-E7.4), congelado na reserva com as linhas; editar recalcula e mostra a diferença; o check-out recalcula a meia diária pela hora real.
- **D3 R1 desde a reserva.** A reserva já mostra a situação de cada exigência contra o **último dia da estadia** (`vence-durante` é vencida); a leitura da carteirinha do app entra pela E7-04 (D-E7.2).
- **D4 Pendente até o sinal.** A reserva nasce `PENDENTE` e só vira `CONFIRMADA` com `pagoCentavos` maior ou igual ao sinal. O pagamento é registrado, não processado (E9).
- **D5 Cancelamento com política.** O servidor diz se o sinal é reembolsável (`sinalReembolsavel` pela antecedência) e grava o motivo; não comparecimento é status próprio, marcado depois do horário de entrada mais tolerância.
- **D6 Autorizados a retirar** vêm do cadastro do cliente (`PessoaAutorizadaDoCliente`, E2-01) e da reserva; entregar a alguém fora da lista continua possível e fica registrado (decisão D13 do hotel).

## Modelo de dados (aditivo, resumo)

```prisma
enum StatusReserva { PENDENTE CONFIRMADA HOSPEDADO ENCERRADA CANCELADA NAO_COMPARECEU }
enum OrigemReserva { BALCAO TELEFONE WHATSAPP APP LINK RETORNO INDICACAO }
enum MotivoCancelamentoReserva { RESPONSAVEL_DESISTIU VIAGEM_CANCELADA ANIMAL_DOENTE HOTEL_INDISPONIVEL PRECO OUTRO }

model ReservaDeHotel { id, parceiroId, pacienteId, acompanhantePacienteId?, acomodacaoId, entradaPrevista DateTime, saidaPrevista DateTime, diarias Int, status, origem, servicos Json, orcamento Json (linhas e totais em centavos, congelado), pagoCentavos Int, observacao?, canceladaEm?, motivoCancelamento?, pedidoId?, versao Int, criadoPorId?, criadoEm, atualizadoEm }
model AutorizadoNaReserva { reservaId, pessoaAutorizadaId?, nome, telefone?, documento?, relacao? }
model ComprovanteDeExigencia { id, parceiroId, pacienteId, kind ExigenciaKind, apresentadoEm Date, validoAte Date?, documento?, observacao?, fonte (BALCAO | APP_CLINICA | APP_RESPONSAVEL) }
model DispensaDeExigencia { id, reservaId, kind, motivo, autorizadaPorId, autorizadaEm }
model EsperaDoHotel { id, parceiroId, pacienteId, entradaDesejada Date, saidaDesejada Date, tiposAceitos String[], status, ofertadaEm?, ofertaExpiraEm?, observacao? }
```

As exclusion constraints da D1 ficam no SQL da migration.

## Rotas (`@ExigeModulo(HOTEL)`; `hotel.ler` / `hotel.reservar`)

| Método e rota | Descrição |
|---|---|
| `GET /parceiro/portal/hotel/grade?de=&ate=` | Grade de ocupação |
| `GET /parceiro/portal/hotel/mapa?entrada=&saida=&pacienteId=` | Vagas no período, com impedimentos (porte, espécie, ocupada, higienização, inativa) |
| `POST /parceiro/portal/hotel/reservas/simular` | Orçamento e vaga sem gravar |
| `POST /parceiro/portal/hotel/reservas` | Cria (`Idempotency-Key`); 409 `ACOMODACAO_OCUPADA_NO_PERIODO`, `PET_JA_HOSPEDADO_NO_PERIODO` |
| `GET /parceiro/portal/hotel/reservas?de=&ate=&historico=` | Abre em "a partir de ontem" (defeito D8 do hotel) |
| `GET/PATCH /parceiro/portal/hotel/reservas/:id` | Detalhe com exigências avaliadas; editar recalcula |
| `POST .../reservas/:id/confirmar` | `{ pagoCentavos }` |
| `POST .../reservas/:id/cancelar` | `{ motivo }` → `{ sinalReembolsavel }` |
| `POST .../reservas/:id/nao-compareceu` | Depois da tolerância |
| `POST .../reservas/:id/comprovantes`, `POST .../reservas/:id/dispensas` | R1 |
| `GET/POST/DELETE /parceiro/portal/hotel/espera` + `POST .../espera/:id/ofertar` | Lista de espera |
| `GET /tutor/hotel/reservas?petId=` | Responsável: reservas com orçamento, sinal, política e exigências pendentes |

Contadores (E1-06): `chegadasSemDocumentacao` (faixa de véspera: o que chega em 3 dias e não pode entrar), `reservasPendentesDeSinal`.

## Acceptance Criteria

- [ ] **Given** saída do dia 20 às 18:00 e higienização de 2 h **When** cria entrada no dia 20 às 19:00 na mesma acomodação **Then** 409; às 20:00 **Then** cria.
- [ ] **Given** o mesmo pet com reserva ativa no período em outra acomodação **Then** 409 `PET_JA_HOSPEDADO_NO_PERIODO`.
- [ ] **Given** entrada ontem às 14:00 **When** agora é 01:00 **Then** `noites=1` (defeito D4).
- [ ] **Given** saída às 16:30 com limite da meia diária às 12:00 **Then** o orçamento traz a linha de meia diária.
- [ ] **Given** antirrábica que vence no meio da estadia **Then** a reserva mostra `vence-durante` desde a criação.
- [ ] **Given** cancelamento com 10 dias e política de 7 **Then** `sinalReembolsavel=true`.
- [ ] Total gravado é sempre o do servidor (o corpo do cliente não tem campo de total).

## Estratégia de Testes

- Unit: golden tests de `disponibilidade.spec`, `tarifas.spec`, `admissao.spec` e `dataset.spec` (invariante por animal).
- Integration: exclusion constraints com duas criações simultâneas.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration (com `btree_gist` e as constraints) | Modificar |
| `src/hotel/reservas/` (controllers, service, `regras/tarifas.ts`, `regras/admissao.ts`, `regras/disponibilidade.ts`) | Criar |

## Tasks

- [ ] **T1** Migration com exclusion constraints (conferir `btree_gist` disponível no Supabase)
- [ ] **T2** Porte das regras com golden tests
- [ ] **T3** Grade, mapa, simular
- [ ] **T4** Criar, editar, confirmar, cancelar, não comparecimento
- [ ] **T5** Comprovantes, dispensas, autorizados, espera
- [ ] **T6** Rota do responsável, contadores, handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Duas reservas na mesma acomodação ou o mesmo pet em duas | Exclusion constraints no banco (D1) e teste de corrida |
| Médio | `btree_gist` indisponível no Supabase | Conferir na T1; alternativa com advisory lock por acomodação e checagem na transação |
| Médio | Preço digitado no balcão divergir do servidor | Total só do servidor (D-E7.4); o corpo do cliente não tem campo de total |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
