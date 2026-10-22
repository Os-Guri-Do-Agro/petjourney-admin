# Spec: Check-in, estadia e check-out

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E7 hotel](../../../../../epicos/portal-parceiro-e7-hotel.md)
**Depende de:** [E7-02 reservas](02-reservas-e-disponibilidade.md), [E2-03 leitura do app](../e2-pacientes-e-ponte/03-leitura-do-app-pela-clinica.md) (carteirinha), [E2-04 publicação](../e2-pacientes-e-ponte/04-publicacao-no-app.md)

---

## Visão Geral

**Check-in:**
- a R1 avaliada contra o último dia da estadia, lendo a carteirinha do app quando há vínculo;
- peso de entrada e inspeção (carrapato, ferida, claudicação);
- pertences;
- plano alimentar (ração própria ou da casa, marca, porção, horários, restrições, petiscos);
- medicações da estadia (descrição, via, dose, horários, receita) e cuidados;
- autorizações (banho, passeio externo, recreação em grupo, foto em rede social, atendimento veterinário com limite de gasto, transporte), pré-marcadas pelo que foi vendido;
- contato de emergência;
- **veterinário do pet pelas clínicas com vínculo**;
- adaptação.

**Estadia:** mudar a adaptação, acrescentar serviço.

**Check-out:**
- a R4 confere os pertences, pesa e aponta a variação, devolve a inspeção de entrada, confere quem retira com a lista de autorizados e recalcula a meia diária;
- grava o peso no cadastro;
- **publica a estadia no app**.

## Motivação

Tipos do portal: `Hospedagem`, `Pertence`, `PlanoAlimentar`, `MedicacaoDaEstadia`, `CuidadoDaEstadia`, `Autorizacao`, `AutorizacaoKind`, `Adaptacao` (`petjourney-admin/src/features/hotel/data/types.ts:690-855`). Repositório `hospedagem-repository.ts` (1275 linhas): `checkIn`, `registrarMedicacao`, `registrarCuidado`, `acrescentarServico`, `ajustarAdaptacao`, `pesarNaSaida`, `conferirPertence`, `checkOut` e `SaidaBloqueadaError`.

O D13 do hotel é a lista de costuras entre reserva, check-in e check-out que precisam atravessar:
- o serviço vendido vira tarefa;
- remédio sem horário trava;
- a venda pré-marca a autorização;
- a inspeção volta no check-out;
- o peso de saída volta ao cadastro;
- a hora real muda a meia diária;
- quem retira é registrado;
- a adaptação muda.

---

## Decisões

- **D1 R1 com a carteirinha** (D-E7.2). Com vínculo ativo, a avaliação usa as `Vacina` do app:
  - publicada por clínica com lote: `COMPROVADA`;
  - lançada pelo responsável: `DECLARADA`, que o hotel aceita ou não por exigência (`aceitaDeclarada`).

  Sem vínculo, só comprovantes do balcão. O hotel lê a carteirinha mesmo sem o consentimento do diário (D4 da E2-03). `vencido` e `ausente` em exigência que bloqueia **travam o check-in** no servidor (409 `ADMISSAO_BLOQUEADA` com a lista), salvo dispensa nominal.
- **D2 Medicação sem horário trava o check-in** (`MEDICACAO_SEM_HORARIO`), porque não vira tarefa.
- **D3 Autorização negada contra serviço vendido** acende um aviso com o nome do serviço; não trava.
- **D4 Veterinário do pet:** lista as clínicas com vínculo ativo (nome público, telefone público, plantão) e aceita um em texto livre para quem não está no PetJourney.
- **D5 R4 no servidor.** O check-out recusa com `SAIDA_BLOQUEADA` e a lista: pertence pendente sem registro, ocorrência grave sem contato (R3, E7-05), peso de saída ausente. Entregar a quem não está na lista é permitido e gravado (`retiradoPor`, `retiradoForaDaLista=true`).
- **D6 Peso de saída** atualiza o paciente (E2-01) e, com vínculo, publica a pesagem (E2-04); a variação maior que 5% (`PERDA_RELEVANTE`) entra no boletim de saída.
- **D7 Estadia encerrada publica** `ServicoRealizado` HOSPEDAGEM (datas, alimentação, intercorrências leves, prestador e profissional) pela E2-04.
- **D8 Acompanhante:** o check-in cria uma `Hospedagem` por animal (resolve a lacuna "acompanhante cobrado e não operado" do doc `hotel/README`). Recomendo assim; a decisão de produto continua aberta abaixo.

## Modelo de dados (aditivo, resumo)

```prisma
enum Adaptacao { TRANQUILO EM_ADAPTACAO ESTRESSADO }
enum AutorizacaoKind { BANHO PASSEIO_EXTERNO RECREACAO_EM_GRUPO FOTO_EM_REDE_SOCIAL ATENDIMENTO_VETERINARIO TRANSPORTE } // = AutorizacaoKind do portal; ATENDIMENTO_VETERINARIO leva limiteCentavos
enum StatusHospedagem { HOSPEDADO ENCERRADA }

model Hospedagem { id, parceiroId, reservaId, pacienteId, acomodacaoId, entradaEm, saidaPrevistaEm, saidaEm?, status, pesoEntradaKg, pesoSaidaKg?, inspecaoDeEntrada?, planoAlimentar Json, autorizacoes Json, contatoEmergencia?, veterinarioParceiroId?, veterinarioTexto Json?, adaptacao, observacao?, recebidoPorId, entreguePorId?, retiradoPor?, retiradoForaDaLista Boolean }
model PertenceDaHospedagem { id, hospedagemId, descricao, quantidade, devolvido Boolean, observacao? }
model MedicacaoDaEstadia { id, hospedagemId, descricao, via, doseTexto, horarios String[], inicio Date, fim Date?, receita?, observacao?, suspensaEm? }
model CuidadoDaEstadia { id, hospedagemId, descricao, horarios String[], inicio Date, fim Date?, observacao?, encerradoEm? }
```

## Rotas (`@ExigeModulo(HOTEL)`, `hotel.*`)

| Método e rota | Descrição |
|---|---|
| `GET /parceiro/portal/hotel/reservas/:id/admissao` | Avaliação da R1 com a fonte de cada item (comprovante, app comprovada, app declarada, dispensa) |
| `POST /parceiro/portal/hotel/reservas/:id/check-in` | D1 a D4; cria a(s) hospedagem(ns) e a rotina (E7-05) |
| `GET /parceiro/portal/hotel/hospedes` | Na casa, com adaptação, tom e alertas |
| `GET /parceiro/portal/hotel/hospedagens/:id` | Estadia detalhada |
| `POST .../hospedagens/:id/medicacoes`, `/cuidados`, `/servicos`, `PATCH .../adaptacao` | Durante a estadia |
| `POST .../hospedagens/:id/pertences/:pid/conferir` | `{ devolvido, observacao? }` |
| `POST .../hospedagens/:id/pesar-na-saida` | `{ pesoKg }` |
| `POST .../hospedagens/:id/check-out` | `{ saidaEm, retiradoPor, pagoCentavos? }` → orçamento final; D5 a D7 |

## Acceptance Criteria

- [ ] **Given** antirrábica no app publicada por clínica válida até depois da saída **Then** exigência `ok` com fonte `APP_COMPROVADA`, sem comprovante no balcão.
- [ ] **Given** tosse dos canis ausente e exigência que bloqueia **When** check-in **Then** 409 `ADMISSAO_BLOQUEADA`; com dispensa nominal **Then** entra e a dispensa fica com quem e por quê.
- [ ] **Given** medicação sem horário **Then** 409 `MEDICACAO_SEM_HORARIO`.
- [ ] **Given** pertence não devolvido sem observação **When** check-out **Then** 409 `SAIDA_BLOQUEADA` com `pertences`.
- [ ] **Given** saída às 16:30 **Then** o orçamento final tem a meia diária; o total vem do servidor.
- [ ] **Given** vínculo ativo **When** encerra **Then** nasce `ServicoRealizado` HOSPEDAGEM no app com `origem=PARCEIRO`, e o peso de saída publicado.
- [ ] **Given** reserva com acompanhante **Then** nascem duas hospedagens, cada uma com peso, pertences e plano.

## Estratégia de Testes

- Unit: golden tests de `admissao.spec`, `estadia.spec`, `contatos.spec`, `ligacao-do-fluxo.spec` (as costuras do D13).
- Integration: check-in e check-out com publicação na mesma transação.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/hotel/estadia/` (controllers, service, `regras/admissao.ts`, `regras/saida.ts`) | Criar |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Admissão com a carteirinha do app
- [ ] **T3** Check-in (com rotina da E7-05) e estadia
- [ ] **T4** Check-out com R4, peso e publicação
- [ ] **T5** Testes e handoff

## Perguntas em Aberto

- [ ] Acompanhante: uma estadia por animal (recomendado, D8) ou bloquear acompanhante? Responsável: Nicolas.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Hóspede sem vacina entrar por falha de leitura da carteirinha | R1 no servidor; sem vínculo ou sem dado, vale o comprovante do balcão; dispensa nominal registrada |
| Médio | Entrega do animal a pessoa não autorizada | Lista de autorizados conferida no check-out e registro de quem retirou, marcado quando fora da lista |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
