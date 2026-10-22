# Spec: Faltas (marcar, justificar, painel, reincidência e reagendar)

**Status:** Em Implementação (API em dev, 2026-10-22; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.2
**Épico:** [E3 agenda](../../../../../epicos/portal-parceiro-e3-agenda.md)
**Depende de:** [E3-02 agenda](02-agenda-e-agendamentos.md)

---

## Visão Geral

O ciclo da falta:
1. A recepção marca a falta, um a um ou em lote no fim do turno.
2. O horário volta para a fila.
3. Alguém registra a justificativa (motivo, canal e quem), ou o próprio responsável justifica pelo app.
4. O painel mostra minutos perdidos, reincidentes e quem ainda nem foi procurado.
5. Reagendar parte da falta com os próximos horários.

Óbito encerra o caso com cuidado.

## Motivação

O doc 01 do portal fechou as lacunas L3 (reagendar da falta), L4 (histórico do responsável) e L11 (falta a um clique e em lote). O tipo `JustificativaDeFalta` (motivo, canal, observação, profissional, quando) e o `NoShowSummary` (faltas, minutos perdidos, reincidente, sem justificativa) estão em `petjourney-admin/src/features/clinico/data/types.ts:309-373` e `:1593-1609`. `LIMITE_REINCIDENCIA = 3` (`data/repositories/patient-repository.ts:45`). Regras em `domain/faltas.ts` (óbito encerra; quem já remarcou não recebe convite de novo).

---

## Decisões

- **D1 Falta só depois do horário.** Marcar falta antes do início dá 409 `FALTA_ANTES_DO_HORARIO` (a tela já só oferece para quem devia ter chegado).
- **D2 Falta libera o horário** e chama a fila (E3-04) para o resto do intervalo, se ainda houver tempo útil.
- **D3 Justificativa é um registro, não um campo solto.** Guarda motivo (`kind`), canal (`TELEFONE`, `WHATSAPP`, `PRESENCIAL`, `SEM_RESPOSTA`, `APP`), observação, quem e quando. Várias tentativas `SEM_RESPOSTA` ficam todas; a última com contato vale.
- **D4 Óbito encerra.** Motivo `OBITO` inativa o paciente (E2-01, D6), cancela agendamentos futuros dele sem aviso ao responsável e encerra o vínculo pelo sistema (E2-02, D6). Nenhuma notificação sai por isso (P5 do épico pai).
- **D5 Reincidente** é quem tem 3 faltas ou mais nos últimos 12 meses (`LIMITE_REINCIDENCIA`); o painel abre filtrado neles.
- **D6 O responsável justifica pelo app** enquanto a falta não tem justificativa com contato; canal `APP`, sem profissional.

### Decidido na implementação (v0.2)

- **D7 Modelo** (aditivo; migrations `20261022130000_agenda_faltas` e `20261022130100_faltas_motivo_obito_e_aviso`, aplicadas no dev, `migrate diff` vazio depois):
  - `JustificativaDeFalta` com `parceiroId` (P1), FK para o agendamento em `CASCADE` (a exclusão real a pedido do titular leva junto), para o parceiro em `CASCADE` e para o profissional em `SET NULL`; `usuarioId` sem FK (como o `criadoPorId` da agenda); índices `(agendamentoId, registradaEm)` e `(parceiroId, registradaEm)`;
  - `Agendamento` ganha `faltaEm`, `reagendadoComoId` (FK para o próprio agendamento em `SET NULL`, com índice: o desfazer de uma criação apaga o reagendamento e a ponte se limpa sozinha) e **`avisoFaltaEm`** (o marcador do aviso, D17);
  - CHECKs à mão: `status = FALTA` se e só se `faltaEm` preenchido; `SEM_RESPOSTA` se e só se `motivo` nulo; `APP` sem profissional; observação até 500. Índices parciais: as faltas por parceiro e início (`WHERE status = 'FALTA'`) e as faltas sem marcador de aviso;
  - `MotivoCancelamento.OBITO` e `TipoNotificacao.AGENDAMENTO_FALTA` numa migration à parte (`ADD VALUE` não se usa na mesma transação). A recepção não escolhe `OBITO` no cancelar (`MOTIVOS_DE_CANCELAR_DA_RECEPCAO` no DTO da E3-02).
  - O agendamento novo do reagendar aponta para a falta pelo `remarcadoDeId` que a E3-02 já tinha; a falta aponta para ele pelo `reagendadoComoId`.
- **D8 A falta é uma transição da E3-02** (`regras/transicoes.ts` ganhou a ação `falta`, só de `AGENDADO` e `CONFIRMADO`; `estadoDepoisDe('falta')` grava `faltaEm`): mesmas travas (parceiro, paciente só no óbito, linhas do grupo em ordem de id; nunca `COUNT ... FOR UPDATE`), mesma versão otimista (409 `AGENDAMENTO_ALTERADO` com `atual`), mesmo desfazer (token com hash, 15 s; o retrato ganhou `faltaEm`) e o mesmo balde de escrita (600 por usuário por hora). O grupo de duas salas falta inteiro. `travarParceiro`, `travarGrupo`, `guardarDesfazer` e `exigirTaxa` do `AgendamentosService` ficaram públicos para a E3-03, sem mudar o comportamento.
- **D9 "Uma mutação, um desfazer" (o teste do portal).** `POST .../falta` aceita `justificativa` opcional: a falta já nasce com o motivo e o desfazer volta a falta **e** apaga a justificativa criada junto (`EstadoAnterior.justificativaIds`). Justificar depois sobe a versão da perna principal: o desfazer da falta passa a dar 409 `DESFAZER_EXPIRADO` (a falta nunca volta deixando uma justificativa solta). Com `OBITO` não há desfazer (`desfazerToken: null`): o paciente, o vínculo e a agenda já mudaram.
- **D10 Lote ("fechar o turno")**: `{ data, profissionalId?, agendamentoIds }`, até 100 ids (`MAX_FALTAS_POR_LOTE`, 400 do validador acima disso), um id de outra clínica recusa o lote inteiro (`assertAgendamentosDoParceiro`, uma consulta). Entra só o do dia e profissional pedidos, sem chegada, que **já passou do fim** (o risco da spec: quem chegou atrasado não vira falta); o resto volta em `ignorados` com `reason` (`FORA_DO_TURNO`, `STATUS`, `CHEGOU`, `NAO_ENCERROU`). Um `UPDATE` para todas as linhas (com as pernas dos grupos) e um desfazer para o lote. **Tempo útil (D2):** no lote nunca há (só entra o que passou do fim); na falta um a um com o horário em curso, o log `VAGA_LIBERADA ... minutosUteis=N por=FALTA` marca o ponto da fila (E3-04), como a E3-02 fez no cancelar.
- **D11 Justificar** (`regras/faltas.ts`, `problemaNaJustificativa`): com contato, motivo obrigatório; `SEM_RESPOSTA` sem motivo; `obitoEm` só com `OBITO` e nunca depois de hoje (400 `JUSTIFICATIVA_INVALIDA` com `reason`). Quem registrou: a ficha do usuário no parceiro (`Profissional.usuarioId`), nunca o corpo; sem ficha, só o `usuarioId`. Até **20 registros por falta** (`MAX_JUSTIFICATIVAS_POR_FALTA`, 409 `JUSTIFICATIVAS_NO_LIMITE`), contados depois da trava da linha. Caso encerrado não recebe registro novo (409 `FALTA_ENCERRADA`). A justificativa é da perna principal do atendimento.
- **D12 Óbito em cascata, num helper único** (`src/pacientes-parceiro/regras/obito.ts`: `travarParaObito` e `encerrarPorObito`), usado pelos DOIS caminhos: a justificativa com `OBITO` (inclusive a que nasce com a falta) e o `PacientesParceiroService.inativar` com motivo `OBITO` (E2-01), que antes inativava e encerrava o vínculo mas deixava os agendamentos marcados. Numa transação: paciente inativo com `obitoEm`; vínculo encerrado pelo sistema; propostas pendentes canceladas; agendamentos **deste paciente** do **dia do óbito em diante** (parede da clínica) ainda por acontecer (`AGENDADO`, `CONFIRMADO`) cancelados com `motivoCancelamento: OBITO`, `canceladoPor: RECEPCAO` e versão nova, sem aviso; a trilha da alteração do paciente (E1-05). O corte é o dia do óbito, não "agora" (o teste do portal: "o paciente que morreu não tem nada na agenda depois do dia do óbito"). Travas na ordem da agenda: parceiro, paciente (`FOR UPDATE`), linhas em ordem de id. A data padrão do óbito pela falta: a que veio, a que o cadastro já tinha, ou o dia da falta. Reativar o paciente não devolve os horários. **Responde a Q2 da E3-02.**
- **D13 Reagendar** usa o `criar` da agenda (conflitos, `CONFLITO_BLOQUEANTE`, tetos, balde, desfazer de criação, `Idempotency-Key` com releitura) com `origem=RECEPCAO`, o tipo e as salas da falta por padrão; o `criar` ganhou `opcoes.remarcadoDeId` e `opcoes.naTransacao`, onde a falta é travada (a última trava) e ligada na mesma transação. Caso encerrado: 409 `FALTA_ENCERRADA`; o reagendamento anterior ainda vale (não cancelado): 409 `FALTA_JA_REAGENDADA` com `reagendadoComoId`.
- **D14 Painel** (`GET /parceiro/portal/clinica/faltas`): agregado no Postgres numa varredura só (o período e os 12 meses da reincidência, com as justificativas agregadas por hash join), uma linha por responsável e paciente, um por atendimento (a perna principal). Período de até 366 dias (padrão: o ano que termina hoje; 400 `FALTAS_PERIODO_INVALIDO`), até 100 por página por cursor cifrado (chave `faltas * 1e7 + minutos` e o paciente), ordem: mais faltas, depois mais minutos (a do `resumirFaltas`). Campos a mais que o `NoShowSummary`: `faltas12Meses`, `naoProcuradas` (sem registro nenhum, "quem ainda nem foi procurado") e `aConvidar`. `reincidente` olha os 12 meses (D5), não o período. Um teste de integração compara o painel do SQL com o `resumirFaltas` portado.
- **D15 "Voltou depois?" e "a convidar"** (porte do `faltasDoResponsavel` e de `aceitaReagendamento`): reagendado é o reagendamento explícito (não cancelado) ou o primeiro agendamento do mesmo paciente, depois da falta, criado depois dela, não cancelado, até 60 dias pela data da parede; a falta com óbito nunca aparece como reagendada. "A convidar" = a falta não encerrada, sem reagendamento, de paciente ativo e sem óbito (no painel, a última falta do período). Rota extra: `GET .../agendamentos/:id/falta` (o diálogo reaberto mostra o que já foi registrado, como o portal pede).
- **D16 App** (`POST /tutor/clinica/agendamentos/:id/justificar-falta`): só o dono (família: 403 `SOMENTE_LEITURA`), vínculo ATIVO pelo `assertAgendamentoDoTutor` (a regra única dos vínculos legíveis, que tira pet inativo da família), enquanto não há contato (409 `FALTA_JA_JUSTIFICADA`), canal `APP`, sem profissional, 30 por pessoa por hora (429 `FALTA_TAXA_EXCEDIDA`, antes do ownership). **`OBITO` não vem pelo app** (o DTO recusa): quem encerra o cadastro da clínica é a clínica, depois de falar com a família. O contrato do app (lista e detalhe da E3-02) ganhou `falta: { faltaEm, justificada, podeJustificar, suaJustificativa }`; nada interno da clínica (motivo, canal e observação da clínica não vão; a justificativa do APP chega à clínica sem a conta do responsável).
- **D17 Aviso `AGENDAMENTO_FALTA`** por cron de minuto em minuto (`FaltasAvisoCron`), não no ato: sai **depois da janela do desfazer** (60 s depois de `faltaEm`), uma vez por falta (o marcador `avisoFaltaEm`, gravado na mesma transação curta que reserva o lote com `FOR UPDATE SKIP LOCKED`: duas réplicas nunca avisam a mesma falta e a rodada nunca espera a recepção; as pernas do grupo são marcadas junto, também com `SKIP LOCKED`). Assim a falta desfeita em 5 s não vira push, e o óbito registrado no primeiro minuto também não. Nunca avisa: falta com justificativa `OBITO`, paciente inativo, com óbito ou mesclado, sem vínculo ATIVO, pet sem dono vivo, horário de mais de 72 h atrás; esses ficam só com o marcador. Dono com o convite para justificar; a família que lê o pet (o alcance reverso das notificações, a mesma regra do `OwnershipService`) com `paraMembro` e sem o convite; pet inativo, só o dono. No máximo 2 por pet por dia da clínica (`TaxaService`, como a B3 da E4-04). Copy fixa só com o nome do pet. Registrado nos 6 lugares (enum, catálogo com rota `/screens/notifications` até o app ter a tela, canal Android `cuidado`, sem e-mail, categoria `CLINICO`, `smoke-push-device.ts`).
- **D18 Contador da E1-06:** `faltasSemJustificativa` (módulo CLINICA, `agenda.escrever`, tom ATENCAO, rota `/veterinario/faltas`): faltas dos últimos 30 dias sem justificativa com contato, uma por atendimento, de paciente ativo e sem óbito (como o da agenda).
- **D19 Trilha e anonimização.** Falta e justificativa não são registro clínico (D22 da E3-02): ficam no log `[Agenda]`, sem dado pessoal; a trilha registra só a alteração do paciente no óbito. Na anonimização do cliente (E2-01, D8), a `observacao` das justificativas sai (a falta fica e continua contando).

Custo (as faltas numa clínica grande, Postgres de dev a partir da máquina local, ida e volta ao banco de 27 ms; `src/agenda/faltas/faltas-custo.integration.spec.ts`): 2.000 clientes, 4.000 pacientes, 40 profissionais, 31.300 faltas num ano (300 de um paciente só), 12.000 justificativas, 4.000 agendamentos depois de faltas.

| Leitura ou escrita | Tempo | Saída |
|---|---|---|
| Painel, primeira página (100 linhas, a primeira chamada) | 631 a 725 ms | 34 KB |
| Painel com `reincidentes=true` / `semJustificativa=true` | 341 ms / 299 ms | |
| Painel, 10 páginas seguidas por cursor | 2,7 s (270 ms cada; o agregado roda de novo a cada página) | |
| Varredura das faltas da clínica no servidor (`EXPLAIN ANALYZE`) | 11 ms (31.300 linhas; no dev a tabela é quase só dessa clínica, então o plano é `Seq Scan`) | |
| Histórico do pior responsável (50 de 300 faltas, com justificativas e "voltou depois") | 419 a 613 ms | 31 KB |
| Contador `faltasSemJustificativa` | 51 a 70 ms | |
| Lote no teto (100 faltas) | 469 a 499 ms | 85 KB |
| Cron do aviso com 1.000 pendentes (5 lotes de 200) | 673 a 707 ms | |

Cada leitura faz de 4 a 6 idas ao banco em sequência; o resto é o agregado de 31 mil linhas. Pelo HTTP na porta 3100 (smoke), tudo responde dentro de um segundo.

## Modelo de dados (aditivo)

```prisma
enum MotivoFalta { ESQUECEU IMPREVISTO TRANSPORTE PACIENTE_MELHOROU EMERGENCIA CUSTO INSATISFACAO OBITO OUTRO }
enum CanalContato { TELEFONE WHATSAPP PRESENCIAL SEM_RESPOSTA APP }

model JustificativaDeFalta {
  id             String        @id @default(cuid())
  parceiroId     String        // D7 (P1)
  agendamentoId  String        // a perna principal
  motivo         MotivoFalta?  // nulo em SEM_RESPOSTA
  canal          CanalContato
  observacao     String?       // até 500
  profissionalId String?       // nulo quando APP
  usuarioId      String?
  registradaEm   DateTime      @default(now())
  @@index([agendamentoId, registradaEm])
  @@index([parceiroId, registradaEm])
}
```

`Agendamento` ganha `faltaEm DateTime?`, `reagendadoComoId String?` e `avisoFaltaEm DateTime?` (D17). `MotivoCancelamento` ganha `OBITO`; `TipoNotificacao`, `AGENDAMENTO_FALTA`.

## Rotas

| Método e rota | Permissão | Descrição |
|---|---|---|
| `POST /parceiro/portal/clinica/agendamentos/:id/falta` | `agenda.escrever` | Marca falta (`versao`, `justificativa?`); devolve `desfazerToken` (nulo no óbito) |
| `POST /parceiro/portal/clinica/agendamentos/faltas-em-lote` | `agenda.escrever` | `{ data, profissionalId?, agendamentoIds[] }` (até 100): "fechar o turno" com os não iniciados que já passaram do fim; `ignorados` com o motivo |
| `POST /parceiro/portal/clinica/agendamentos/:id/justificativas` | `agenda.escrever` | `{ motivo?, canal, observacao?, obitoEm? }` |
| `GET /parceiro/portal/clinica/agendamentos/:id/falta` | `agenda.ler` | A falta com a vigente e os registros (D15) |
| `GET /parceiro/portal/clinica/faltas?reincidentes=&semJustificativa=&de=&ate=&cursor=&limit=` | `agenda.ler` | `NoShowSummary` por responsável e paciente, com minutos perdidos |
| `GET /parceiro/portal/clientes/:id/faltas` | `agenda.ler` | Histórico com data, tipo, minutos e "voltou depois?" |
| `POST /parceiro/portal/clinica/agendamentos/:id/reagendar` | `agenda.escrever` | `{ inicio, profissionalId, tipoId?, salaIds?, duracaoMinutos?, observacao?, confirmarConflitos? }`: cria o novo com `origem=RECEPCAO`, liga `reagendadoComoId`; `Idempotency-Key` |
| `POST /tutor/clinica/agendamentos/:id/justificar-falta` | dono | `{ motivo, observacao? }`; 409 `FALTA_JA_JUSTIFICADA` quando já há contato registrado |

Notificação `AGENDAMENTO_FALTA` ao responsável (com família `paraMembro`), nunca para motivo `OBITO` (D17). Contadores para a E1-06: `faltasSemJustificativa` (D18).

## Acceptance Criteria

- [x] **Given** agendamento às 10:00 **When** marca falta às 09:59 **Then** 409 `FALTA_ANTES_DO_HORARIO`. *Golden em `regras/faltas.spec.ts` ("AC1"), unit no service, integração no dev ("AC1", com o desfazer voltando tudo e o CHECK `FALTA` com hora) e smoke.*
- [x] **Given** fechar o turno com 5 agendamentos de antes de agora não iniciados **Then** os 5 viram falta numa transação e a fila é chamada para os horários que ainda têm tempo útil. *Integração ("AC2": 5 de outro profissional no mesmo pedido ficam fora, um que chegou e um em curso voltam em `ignorados`, um id de outra clínica recusa o lote sem gravar nada, um desfazer volta os 5) e smoke. A fila: no lote nunca há tempo útil por construção (D10); na falta um a um, o log `VAGA_LIBERADA` marca o ponto da E3-04.*
- [x] **Given** três tentativas `SEM_RESPOSTA` e depois `TELEFONE` com motivo **Then** o painel conta a falta como justificada e mostra as 4 linhas no histórico. *Golden ("AC3") e integração (painel com `semJustificativa: 0`, histórico com os 4 registros, o mais recente primeiro).*
- [x] **Given** motivo `OBITO` **Then** o paciente fica inativo com `obitoEm`, os agendamentos futuros dele são cancelados sem aviso, o vínculo é encerrado e nenhuma notificação sai. *Integração pelos dois caminhos ("AC4" pela justificativa, com a irmã intocada e a trilha; "obito pela inativacao (E2-01)"), o cron sem aviso para a falta com óbito registrado no primeiro minuto, unit do helper no spec de pacientes (ordem das travas) e smoke.*
- [x] **Given** o responsável justifica pelo app **Then** o painel mostra canal `APP` sem profissional. *Integração ("AC5 + D6", com família 403 `SOMENTE_LEITURA`, outro responsável 403 e 409 depois do contato) e smoke.*
- [x] **Given** paciente com 3 faltas nos últimos 12 meses **Then** `reincidente=true`. *Golden ("AC6") e integração (com uma falta de 13 meses atrás fora da conta).*
- [x] Quem já remarcou depois da falta não aparece como "a convidar" (regra de `domain/faltas.ts`). *Golden ("AC7") e integração (reagendar tira o convite, desfazer o reagendar devolve, e um agendamento novo até 60 dias tira de novo).*

## Estratégia de Testes

- Unit: regras de falta (golden tests de `domain/faltas.ts` e `resumirFaltas`, 23 casos), service (marcar, lote, justificar, reagendar, app), cron e contador (número e permissão), controller (módulo, permissões, idempotência, `audit:endpoints`), `assertAgendamentosDoParceiro` em spec próprio, óbito pela inativação no spec de pacientes.
- Integração no Postgres de dev (`faltas.integration.spec.ts`, 14 testes, resíduo zero): as travas (marcar e remarcar ao mesmo tempo; duas justificativas; óbito contra um criar), o CHECK, o desfazer que leva a justificativa, o `SET NULL` do reagendamento desfeito, o painel do SQL contra o `resumirFaltas`, a família de verdade, o grupo de duas salas, o aviso uma vez e nunca no óbito. Custo com clínica grande em `faltas-custo.integration.spec.ts`.
- HTTP: `npm run script:smoke-faltas` (39 passos, 7 logins).
- Cenários: 31 `REG-FALTAS-*` em `qa/cenarios/portal-parceiro.json` (outro parceiro, sem módulo, papel sem permissão, tutor errado e anônimo na rota do app, óbito, concorrência, custo).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + `prisma/migrations/20261022130000_agenda_faltas/`, `20261022130100_faltas_motivo_obito_e_aviso/` | Modificar / criar |
| `src/agenda/faltas/` (`faltas.module.ts`, `faltas.service.ts`, `faltas-leitura.service.ts`, `faltas-responsavel.service.ts`, `faltas.cron.ts`, `faltas-apoio.ts`, `faltas-parceiro.controller.ts`, `faltas-responsavel.controller.ts`, `dto/faltas.dto.ts`, `regras/faltas.ts`, testes) | Criar |
| `src/agenda/agendamentos/` (`regras/transicoes.ts`, `regras/desfazer.ts`, `agendamentos.service.ts`, `agenda-apoio.ts`, `agenda-responsavel.service.ts`, `dto/agenda.dto.ts`, `dto/responsavel.dto.ts`, `agenda.module.ts`, `contadores-da-agenda.ts`, testes) | A ação `falta`, o retrato com `faltaEm`, o desfazer da justificativa, o `criar` com opções, `faltaEm`/`reagendadoComoId` no contrato do portal, `falta` no do app, `OBITO` fora do cancelar |
| `src/pacientes-parceiro/regras/obito.ts`, `pacientes-parceiro.service.ts` (+ spec), `clientes-parceiro.service.ts` (+ spec) | O óbito único (D12) e a anonimização da observação (D19) |
| `src/auth/services/ownership.service.ts` + `ownership.agenda-faltas.spec.ts` | `assertAgendamentosDoParceiro` |
| `src/common/errors/error-catalog.ts`, `codigos-clinicos.ts` | 8 códigos nos 6 locales |
| `src/notificacao/catalogo/notificacao-catalogo.ts`, `canais/canais-android.ts`, `canais/canal-email.service.ts`, `services/notificacao-preferencia.service.ts`, `scripts/smoke-push-device.ts` | `AGENDAMENTO_FALTA` |
| `src/app.module.ts` | `FaltasModule` |
| `scripts/smoke-faltas.ts`, `package.json` | Smoke HTTP |
| `qa/cenarios/portal-parceiro.json` | 31 cenários `REG-FALTAS-*` |
| `contrato/openapi.json` | 8 rotas |
| `docs/frontend/novembro-2026/portal-parceiro-e3.md`, `README.md` | Handoff (seção 3) |

## Tasks

- [x] **T1** Migration (`20261022130000_agenda_faltas` e `20261022130100_faltas_motivo_obito_e_aviso`, aplicadas no dev, diff vazio)
- [x] **T2** Marcar (um e lote), justificar, reagendar *(E3-02)*
- [x] **T3** Painel e histórico
- [x] **T4** Óbito em cascata *(E2-01, E2-02)* (helper único nos dois caminhos)
- [x] **T5** Rota do app, notificação, contador, testes

## Perguntas em Aberto

- [ ] **Q1** O aviso `AGENDAMENTO_FALTA` sai um a dois minutos depois da marcação (D17). Se a clínica preferir ligar antes de o responsável saber pelo app (a ligação é onde se descobre um óbito), o atraso vira uma configuração da política (`PoliticaDaAgenda`, P10). Responsável: Nicolas, antes da E3-06.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Óbito em cascata cancelar agendamento do pet errado | Óbito só pelo motivo na justificativa de uma falta do próprio paciente (ou pela inativação dele); cascata limitada a esse `pacienteId` (o travado tem de ser o da linha, senão 409); teste dedicado (a irmã do mesmo responsável fica intocada) |
| Médio | Falta em lote marcar quem chegou atrasado | Lote só com os não iniciados, sem `chegadaEm`, que já passaram do fim do horário; desfazer disponível |
| Médio | Push de falta para quem acabou de perder o pet | Aviso só depois da janela do desfazer, conferindo o óbito na hora de mandar (D17); Q1 |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabela, colunas e valores de enum; rollback é reverter o código, e as tabelas ficam sem leitor. O cron do aviso só olha faltas (que só existem com o código novo).

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-22 | 0.2 | Implementação da API (T1 a T5) em dev: migrations `20261022130000_agenda_faltas` e `20261022130100_faltas_motivo_obito_e_aviso`, 8 rotas (7 da clínica, 1 do app), regras portadas com golden tests (23), integração no dev (14/14, resíduo zero), custo com clínica grande (31 mil faltas: painel em ~0,3 a 0,7 s, 34 KB), smoke 39/39 na 3100, 31 cenários `REG-FALTAS-*`, contador da E1-06, aviso `AGENDAMENTO_FALTA` e handoff. Decidido na implementação: D7 a D19 (modelo com `avisoFaltaEm`; a falta como transição da E3-02; "uma mutação, um desfazer"; lote só depois do fim; o óbito num helper único usado também pela inativação da E2-01, respondendo a Q2 da E3-02; reagendar pelo `criar`; painel agregado no SQL; app sem `OBITO`; aviso por cron depois da janela do desfazer). Q1 aberta | Claude |
