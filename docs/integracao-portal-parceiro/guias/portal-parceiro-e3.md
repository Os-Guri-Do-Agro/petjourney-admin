# Guia do front: Portal do parceiro, E3 (agenda)

**Para:** o Luís. Portal web do parceiro (`petjourney-admin`) e, na seção 2.10, o app (`petjourney-app`).
**Backend:** E3-01 (configuração da agenda) e E3-02 (agenda e agendamentos) prontas e validadas em dev em 2026-10-21: unit, integração contra o Postgres de dev e smoke por HTTP (`npm run script:smoke-agenda-config` e `npm run script:smoke-agenda`). **Não estão em produção.** As próximas partes do E3 (faltas, fila, pedido online, avisos) entram neste mesmo guia quando ficarem prontas.
**Specs de origem:** `docs/specs/2026/q4/q4-1/portal-parceiro/e3-agenda/01-configuracao-da-agenda.md` (v0.5; seção 1) e `02-agenda-e-agendamentos.md` (v0.2; seção 2)

**Contrato:** `contrato/openapi.json`; gere os tipos dele. Convenções iguais às da onda 0 ([portal-parceiro-e0.md](portal-parceiro-e0.md), seção 1):
- envelope `{ statusCode, message, data }`;
- erro com `codigo` (para decidir a tela) e `message` localizada (para mostrar);
- `?parceiroId=` quando o usuário tem mais de um parceiro;
- data-hora sempre com o offset do estabelecimento (`2026-10-19T12:00:00-03:00`), dia sempre `AAAA-MM-DD`. Não converta com `new Date()` para mostrar: o horário que vale é o da parede da clínica, não o do navegador.
- **Datas da agenda (seções 1 e 2) só do ano 2000 ao 2100:** `data`, `de`, `ate`, `aPartirDe`, `somenteEm`, `repeteAte` e `excecoes`. Fora disso: 400 `AGENDA_DATA_FORA_DO_LIMITE` com `campo` (o nome do parâmetro), `anoMinimo` e `anoMaximo`. Limite o seletor de data a esse intervalo; data malformada continua com o 400 do validador (sem `codigo`).

---

## 1. Configuração da agenda (E3-01)

Tudo o que a agenda precisa antes do primeiro horário. Substitui no mock:
- `Room`, `AppointmentType` e `Clinic.slotMinutos` (`features/clinico/data/types.ts:33-111`);
- `Block` com `BlockRecurrence` (`types.ts:423-458`) e o `materializarBloqueios` de `domain/conflicts.ts:295` (a API devolve as ocorrências prontas; apague a regra local quando ligar a rota);
- `politicaDaClinicaFixture` (`data/fixtures/clinic.ts:71-74`).

Horário da semana e feriados do estabelecimento continuam na E1-01 (`/parceiro/portal/estabelecimento`, guia e1 seção 1). A agenda não duplica.

### 1.1 Quem entra

- **Módulo:** todas as rotas desta seção exigem o módulo **Clínica** ligado (inclusive a do expediente, que fica em `/parceiro/portal/profissionais`).
  - Sem o módulo: 403 `MODULO_INATIVO`.
  - Módulo só de consulta (suspenso, desligado, vencido): lê, e a escrita dá 403 `MODULO_SOMENTE_LEITURA`.
  - Use `podeLer`/`podeEscrever` de `GET /parceiro/portal/eu` para mostrar ou esconder os botões.
- **Permissão** (sem ela: 403 `SEM_PERMISSAO` com `permissao`):

| O quê | Ler | Escrever |
|---|---|---|
| Salas, tipos de atendimento, política, expediente | `agenda.ler` (todos os papéis da clínica) | `estabelecimento.editar` (DONO ou GESTOR) |
| Bloqueios | `agenda.ler` | `agenda.escrever` (DONO, GESTOR, RECEPÇÃO, VETERINÁRIO) |

  Enfermagem lê e não bloqueia. Esconda os botões de configuração para quem não tem `estabelecimento.editar` em `GET /parceiro/portal/eu`.
- **Recurso de outra clínica** (sala, tipo, bloqueio ou profissional de outro parceiro, ou id que não existe): 403 de acesso negado, **sem `codigo`** e sem dizer se existe (o mesmo de pacientes, guia e2 seção 1.3). Trate 403 sem `codigo` como "não encontrado ou sem acesso".

### 1.2 Salas

- **Listar:** `GET /parceiro/portal/clinica/salas?ativas=true`
  - `SalaDto`: `{ id, nome, tipo, ativa, ordem }`.
  - `tipo`: `CONSULTORIO`, `CIRURGIA`, `BANHO`, `INTERNACAO`, `EXAME` (o `RoomKind` do mock em maiúsculas).
  - Ordem: ativas primeiro, depois `ordem`, depois nome. Sem `ativas`, vêm todas (tela de configuração); com `ativas=true`, só as ativas (agenda).
- **Criar:** `POST /parceiro/portal/clinica/salas` `{ nome, tipo, ordem? }` (aceita `Idempotency-Key`; mande uma por clique em "Salvar").
  - `nome`: 2 a 60 caracteres.
  - Sem `ordem`, entra depois da última.
  - Nome igual ao de outra sala **ativa** (sem diferenciar maiúscula): 409 `SALA_NOME_EM_USO`.
- **Editar:** `PATCH /parceiro/portal/clinica/salas/:id` com `nome`, `tipo`, `ordem` ou `ativa`.
  - **Não existe apagar.** A sala desativa (`ativa: false`), porque a agenda guarda o id dela. Desativar também tira a sala de "sala padrão" de quem a tinha.
  - Reativar com um nome que outra sala ativa já usa: 409 `SALA_NOME_EM_USO`.
  - `null` em `nome`, `tipo`, `ordem` ou `ativa`: 400.
- **Reordenar:** um `PATCH` com `ordem` por sala (não há rota de lote).
- **Pronto quando:** a tela de salas cria, renomeia, troca o tipo, reordena e desativa/reativa, e a agenda por sala usa `?ativas=true`.

### 1.3 Tipos de atendimento

- **Listar:** `GET /parceiro/portal/clinica/tipos-de-atendimento?ativos=true&ofertadoOnline=true`
  - `TipoDeAtendimentoDto`: `{ id, nome, kind, duracaoMinutos, salasCompativeis, permiteEncaixe, ofertadoOnline, podeSerOfertadoOnline, ativo, ordem }`.
  - `kind`: `CONSULTA`, `RETORNO`, `VACINA`, `EXAME`, `CIRURGIA`, `BANHO`, `EMERGENCIA`. O `kind` decide a regra; o `nome` é da clínica ("Check-up felino").
  - `salasCompativeis`: lista de `tipo` de sala; vazia = qualquer sala.
  - `ordem` é a ordem da legenda da agenda (L1 do doc 01).
- **Criar:** `POST /parceiro/portal/clinica/tipos-de-atendimento` `{ nome, kind, duracaoMinutos, salasCompativeis?, permiteEncaixe?, ofertadoOnline?, ordem? }` (aceita `Idempotency-Key`).
  - `duracaoMinutos`: de 5 a 480, de 5 em 5. Fora disso: 400.
  - Padrões: `permiteEncaixe: true`, `ofertadoOnline: false`, `salasCompativeis: []`.
  - **`CIRURGIA` e `EMERGENCIA` nunca vão para o pedido online:** com `ofertadoOnline: true`, 400 `TIPO_NAO_OFERTAVEL_ONLINE` (com `kind`). Use `podeSerOfertadoOnline` para desligar o interruptor na tela em vez de deixar a pessoa errar.
  - Nome igual ao de outro tipo ativo: 409 `TIPO_NOME_EM_USO`.
- **Editar:** `PATCH /parceiro/portal/clinica/tipos-de-atendimento/:id` com qualquer campo do criar, mais `ativo`.
  - A API confere o estado **final**: trocar o `kind` de um tipo online para `CIRURGIA` também dá 400 `TIPO_NAO_OFERTAVEL_ONLINE`. Mande `ofertadoOnline: false` junto.
  - Não existe apagar: desative (`ativo: false`).
- **Pronto quando:** a tela cria e edita tipos com duração, salas compatíveis, encaixe e "aparece no pedido online" (desligado para cirurgia e emergência), e a legenda da agenda segue a `ordem`.

### 1.4 Expediente do profissional e sala padrão

O expediente do profissional é **exceção** ao horário do estabelecimento: só os dias que mudam têm linha própria. Ex.: Ana só às terças e quintas = folga nos outros cinco dias; terça e quinta seguem o horário da clínica.

- **Ver:** `GET /parceiro/portal/profissionais/:id/expediente`
  - `ExpedienteDto`: `{ profissionalId, salaPadraoId, fuso, estabelecimentoSemHorario, dias }`.
  - `dias`: os 7 dias (0 domingo a 6 sábado), cada um `{ diaSemana, origem, trabalha, inicio, fim, intervaloInicio, intervaloFim }`.
  - `origem`: `PROFISSIONAL` (linha própria) ou `ESTABELECIMENTO` (segue a clínica). Mostre "como a clínica" nos dias herdados.
  - `intervaloInicio`/`intervaloFim`: o almoço da clínica, só nos dias herdados. Almoço próprio do profissional é um bloqueio recorrente (seção 1.5).
  - `estabelecimentoSemHorario: true`: a clínica ainda não cadastrou a semana (E1-01). Avise e leve para lá.
- **Salvar:** `PUT /parceiro/portal/profissionais/:id/expediente` `{ dias, salaPadraoId? }`
  - `dias`: **só os dias que diferem**, cada um `{ diaSemana, trabalha, inicio?, fim? }` (`HH:mm`; `24:00` vale só como fim). Dia que não vier volta a seguir a clínica; `dias: []` volta tudo.
  - Folga (`trabalha: false`) não guarda hora.
  - Erro no dia: 400 `EXPEDIENTE_INVALIDO` com `diaSemana` e `problema` (`ABRE_E_FECHA_OBRIGATORIOS`, `HORA_INVALIDA`, `ABRE_DEPOIS_DE_FECHA`, `DIA_REPETIDO`). Marque o dia na tela.
  - O horário próprio pode passar do horário da clínica: a agenda só avisa (`outside-hours`, na E3-02).
  - `salaPadraoId`: a sala que a agenda propõe para o profissional. Omitido = fica como está; `null` = sem sala padrão. Sala desativada: 409 `SALA_INATIVA`.
  - Para tirar a sala padrão, mande `null`, nunca `""`: id vazio (ou com mais de 60 caracteres) é 400 do validador.
- Feriado e dia especial da clínica (E1-01) mandam sobre o expediente: dia fechado, ninguém atende; dia com horário especial, o profissional atende só dentro dele.
- **Pronto quando:** a ficha do profissional tem a semana com "como a clínica" e "próprio" por dia, e a sala padrão.

### 1.5 Bloqueios

Bloqueio é um horário em que não se marca: almoço, reunião, férias, manutenção de sala, bloqueio pessoal. Pode ser de um profissional, de uma sala, ou da clínica toda (sem os dois). Único ou semanal.

- **Ler as ocorrências de um período:** `GET /parceiro/portal/clinica/bloqueios?de=AAAA-MM-DD&ate=AAAA-MM-DD&profissionalId=&salaId=`
  - Resposta `{ fuso, de, ate, ocorrencias }`. Cada ocorrência: `{ bloqueioId, data, inicio, fim, profissionalId, salaId, motivo, detalhe, recorrente }`.
  - **Já materializadas** no fuso da clínica: a série semanal vem uma linha por dia, sem os dias cancelados; as férias de vários dias aparecem em todo dia que cobrem; a ocorrência que atravessa a meia-noite aparece no dia seguinte também.
  - `data` é o dia em que a ocorrência **começa** (na parede da clínica).
  - `profissionalId` ou `salaId` no filtro trazem também os bloqueios da clínica toda (eles valem para todo mundo).
  - Período de no máximo 62 dias, com `ate` igual ou depois de `de`. Senão: 400 `AGENDA_PERIODO_INVALIDO` (com `maxDias`).
  - No máximo **5.000 ocorrências** por leitura. Passou: 400 `BLOQUEIO_OCORRENCIAS_DEMAIS` (com `maxOcorrencias`). A agenda do dia e da semana nunca chega perto; na visão do mês, se vier esse 400, leia por semana ou filtre por profissional ou sala e mostre a mensagem da API.
  - Filtro vazio (`?salaId=`) é 400: omita o parâmetro para não filtrar.
- **Ver a regra (para editar a série):** `GET /parceiro/portal/clinica/bloqueios/:id` devolve `BloqueioDto` `{ id, profissionalId, salaId, inicio, fim, motivo, detalhe, recorrente, diasDaSemana, repeteAte, excecoes, criadoPorId, criadoEm, atualizadoEm }`.
- **Criar:** `POST /parceiro/portal/clinica/bloqueios` (aceita `Idempotency-Key`)
  - `{ profissionalId?, salaId?, inicio, fim, motivo, detalhe?, diasDaSemana?, repeteAte? }`.
  - `inicio`/`fim`: a **primeira** ocorrência, em ISO **com offset** (`2026-10-19T12:00:00-03:00`). Sem offset: 400. Monte com o `fuso` que a leitura devolve.
  - `motivo`: `ALMOCO`, `REUNIAO`, `FERIAS`, `MANUTENCAO`, `BLOQUEIO_PESSOAL`, `OUTRO`. O mock tinha `feriado`: feriado é dia especial da E1-01, não bloqueio.
  - `detalhe`: até 200 caracteres.
  - **Semanal:** `diasDaSemana` (0 domingo a 6 sábado) e, se tiver fim, `repeteAte` (`AAAA-MM-DD`, inclusive). Ex.: almoço de segunda a sexta = `inicio 12:00`, `fim 13:00` do primeiro dia, `diasDaSemana: [1,2,3,4,5]`. Vazio = bloqueio único.
  - Regras (400 `BLOQUEIO_INVALIDO`, com `reason`):
    - `FIM_ANTES_DO_INICIO`;
    - `RECORRENTE_MAIS_DE_24H`: cada ocorrência de série dura até 24 h;
    - `LONGO_DEMAIS`: bloqueio único de mais de 366 dias;
    - `REPETE_ATE_ANTES_DO_INICIO`;
    - `REPETE_ATE_SEM_RECORRENCIA` e `EXCECAO_SEM_RECORRENCIA`: repetição em bloqueio único.
  - Sala desativada: 409 `SALA_INATIVA`.
  - "Clínica toda" = sem `profissionalId` e sem `salaId` (omitidos ou `null`). Id vazio (`""`) ou com mais de 60 caracteres: 400 do validador.
- **Tetos** (revisão de segurança v0.3; os números chegam no corpo do erro, para a tela não fixar):
  - **300 séries vivas por clínica** (bloqueios que se repetem e não terminaram antes de hoje). A 301ª, ou um único que vira série, ou uma série encerrada que ganha fim novo: 409 `BLOQUEIO_SERIES_NO_LIMITE` (com `maxSeries`). Bloqueio único continua entrando. Mostre a mensagem e sugira encerrar ou apagar séries antigas.
  - **366 dias cancelados por série** ("só neste dia", apagando ou editando). O 367º: 409 `BLOQUEIO_EXCECOES_NO_LIMITE` (com `maxExcecoes`); a saída é encerrar a série (`repeteAte`) e criar outra. Repetir um dia já cancelado continua sem erro.
  - **120 escritas de bloqueio por usuário por hora** (POST, PATCH e DELETE somados, contados no banco, valem para todas as réplicas). A 121ª: 429 `BLOQUEIO_TAXA_EXCEDIDA` com `limite` e `tenteDeNovoEmSegundos`. Gente montando a agenda não chega lá; não repita a chamada sozinho, mostre a mensagem e o tempo.
- **"Só neste dia" e "a série inteira":** o diálogo de editar ou apagar uma ocorrência de série pergunta qual dos dois.
  - **Apagar só o dia:** `DELETE /parceiro/portal/clinica/bloqueios/:id?somenteEm=AAAA-MM-DD` (204). Vira uma exceção na série. Repetir o mesmo dia não faz nada.
  - **Editar só o dia:** `PATCH /parceiro/portal/clinica/bloqueios/:id?somenteEm=AAAA-MM-DD` com o que muda (`inicio`, `fim`, `motivo`, `detalhe`, `profissionalId`, `salaId`). O dia sai da série e volta como **bloqueio único novo**, que é a resposta (outro `id`). Campo de repetição aqui: 400 `BLOQUEIO_INVALIDO` (`reason: RECORRENCIA_NA_OCORRENCIA`).
  - **A série inteira:** `PATCH /parceiro/portal/clinica/bloqueios/:id` (sem `somenteEm`) muda a regra, inclusive o que já passou. `diasDaSemana: []` vira bloqueio único (sai a repetição e as exceções). `excecoes` substitui a lista de dias cancelados: é o "desfazer" de um dia apagado por engano.
  - `DELETE /parceiro/portal/clinica/bloqueios/:id` (sem `somenteEm`) apaga a série inteira.
  - `somenteEm` num bloqueio único: 400 `BLOQUEIO_NAO_RECORRENTE` (edite ou apague o bloqueio inteiro). Num dia em que a série não acontece (ou já cancelado, no PATCH): 400 `BLOQUEIO_SEM_OCORRENCIA` com `data`.
- **Pronto quando:** a agenda mostra os bloqueios pela rota de período (sem `materializarBloqueios` local), o diálogo de bloqueio cria único e semanal, e editar/apagar uma ocorrência pergunta "só neste dia" ou "a série".

### 1.6 Política da clínica

Os prazos que a clínica combina com quem marca pelo app. O app recebe os números prontos e nunca os fixa.

- **Ver:** `GET /parceiro/portal/clinica/politica`
  - `{ granularidadeMinutos, cancelarAteHorasAntes, reservaMinutos, preConsultaAbreHorasAntes, ofertaDeVagaMinutos, confirmacaoAbreHorasAntes, personalizada, atualizadoEm, limites }`.
  - `personalizada: false` = a clínica nunca salvou; valem os padrões (grade de 10 min, cancelar até 2 h antes, reserva de 5 min, pré-consulta 72 h antes, oferta de vaga de 30 min, confirmação 48 h antes).
  - `limites`: as faixas aceitas, para montar os campos (`granularidadeMinutos` é a lista de opções).
- **Salvar:** `PUT /parceiro/portal/clinica/politica` com os seis números (todos obrigatórios).
  - Faixas: grade 5, 10, 15, 20, 30 ou 60 min; cancelar 0 a 72 h; reserva 2 a 15 min; pré-consulta 12 a 168 h; oferta de vaga 10 a 240 min; confirmação 12 a 168 h.
  - Fora da faixa: 400 `POLITICA_FORA_DO_LIMITE` com `campo` e `min`/`max` (ou `opcoes`, na grade). Marque o campo.
  - Mudar a política **não reescreve** agendamento já marcado: vale para o que for criado depois. Diga isso na tela, perto do botão salvar.
- **Pronto quando:** a tela de política mostra os seis números com as faixas da API, e `slotMinutos` e `politicaDaClinicaFixture` saem do mock.

### 1.7 Erros desta seção

| `codigo` | Status | Quando | Extra |
|---|---|---|---|
| `TIPO_NAO_OFERTAVEL_ONLINE` | 400 | Cirurgia ou emergência no pedido online | `kind` |
| `TIPO_NOME_EM_USO` | 409 | Outro tipo ativo com o mesmo nome | |
| `SALA_NOME_EM_USO` | 409 | Outra sala ativa com o mesmo nome | |
| `SALA_INATIVA` | 409 | Sala desativada como padrão ou num bloqueio | `salaId` |
| `POLITICA_FORA_DO_LIMITE` | 400 | Número fora da faixa | `campo`, `min`/`max` ou `opcoes` |
| `EXPEDIENTE_INVALIDO` | 400 | Dia do expediente inválido | `diaSemana`, `problema` |
| `BLOQUEIO_INVALIDO` | 400 | Início, fim ou repetição inválidos | `reason` |
| `BLOQUEIO_NAO_RECORRENTE` | 400 | "Só neste dia" num bloqueio único | |
| `BLOQUEIO_SEM_OCORRENCIA` | 400 | "Só neste dia" num dia sem ocorrência | `data` |
| `AGENDA_PERIODO_INVALIDO` | 400 | Período invertido ou de mais de 62 dias | `maxDias` |
| `AGENDA_DATA_FORA_DO_LIMITE` | 400 | Data com o ano fora de 2000 a 2100 | `campo`, `anoMinimo`, `anoMaximo` |
| `BLOQUEIO_OCORRENCIAS_DEMAIS` | 400 | A leitura passaria de 5.000 ocorrências: período menor ou filtro | `maxOcorrencias` |
| `BLOQUEIO_SERIES_NO_LIMITE` | 409 | A clínica já tem 300 séries vivas | `maxSeries` |
| `BLOQUEIO_EXCECOES_NO_LIMITE` | 409 | A série já tem 366 dias cancelados | `maxExcecoes` |
| `BLOQUEIO_TAXA_EXCEDIDA` | 429 | Mais de 120 escritas de bloqueio do usuário na hora | `limite`, `tenteDeNovoEmSegundos` |
| (sem `codigo`) | 400 | Id vazio ou com mais de 60 caracteres no corpo ou na query (validador) | `message` com o campo |
| (sem `codigo`) | 403 | Recurso de outra clínica ou inexistente | |
| `SEM_PERMISSAO` | 403 | Papel sem a permissão | `permissao` |
| `MODULO_INATIVO` / `MODULO_SOMENTE_LEITURA` | 403 | Módulo Clínica desligado ou só de consulta | `modulo`, `reason` |

### 1.8 Conta de demonstração

O seed da API (`prisma/seed.ts`) cria na clínica de demonstração ("Clínicas PetJourney") as 8 salas e os 7 tipos do protótipo, os mesmos de `data/fixtures/clinic.ts`. O módulo Clínica dela continua desligado até o admin ligar no CMS (guia e1, seção 2.2).

---

## 2. Agenda e agendamentos (E3-02)

O núcleo da recepção, com as regras no servidor. Substitui no mock:
- o `agendaRepository` (`data/repositories/agenda-repository.ts`): `obterDia`, `obterSemana`, `obterIntervalo`, `sugerirRetorno`, `sugerirReagendamento`, `criar`, `mover`, `editar`, `alterarStatus`, `confirmarPresenca`, `cancelar`, `desfazer` e `reservasAtivas`;
- as regras de `domain/conflicts.ts` (`detectarConflitos`), `domain/slots.ts`, `domain/load.ts` e `domain/politica.ts`. **Apague a regra local quando ligar a rota**: o servidor devolve conflitos, carga, sugestões e prazos prontos. O `domain/overlap.ts` (`layoutSpans`, faixas lado a lado) é apresentação e fica no front.

Convenções da seção 1 valem aqui: envelope, `codigo`, `?parceiroId=`, data-hora com o offset da clínica.

### 2.1 Quem entra

- **Módulo Clínica** em todas as rotas (sem ele: 403 `MODULO_INATIVO`; só consulta: a escrita dá 403 `MODULO_SOMENTE_LEITURA`).
- **Ler** (`dia`, `semana`, `intervalo`, `sugestoes`): `agenda.ler`. **Escrever** (inclusive `simular` e `desfazer`): `agenda.escrever` (DONO, GESTOR, RECEPÇÃO, VETERINÁRIO). Enfermagem lê e não marca: esconda os botões pelo `GET /parceiro/portal/eu`.
- Agendamento, paciente, sala, tipo ou profissional de outra clínica (ou id que não existe): 403 **sem `codigo`**, sem dizer se existe.

### 2.2 O dia

`GET /parceiro/portal/clinica/agenda/dia?data=AAAA-MM-DD&agrupar=PROFISSIONAL|SALA` devolve `AgendaDiaDto`:

- `fuso`, `clinicaFechada`, `feriado` (`{ nome, fechado, abre, fecha }` ou `null`), `expediente` (`{ inicio, fim }` da clínica no dia) e `almoco`.
- `colunas`: na ordem de mostrar. Por profissional: quem trabalha no dia ou tem agendamento nele. Por sala: as ativas e as desativadas que têm agendamento no dia. **Uma coluna = um `id` tipado** (`tipo: PROFISSIONAL | SALA`): é o que vai no `destino` do mover (2.7), nunca "a coluna".
- `profissionais`: `{ id, nome, corIndice, salaPadraoId, ativo, trabalhaNoDia, origemDoExpediente, faixas }`. `faixas` é o expediente dele no dia (`[{ inicio: '08:00', fim: '12:00' }, ...]`); o que fica fora delas é "fora do expediente" na grade. Sem faixa (`trabalhaNoDia: false`), a agenda não oferece horário dele (é o AC2 da E3-01).
- `salas`: `{ id, nome, tipo, ativa, ordem }`.
- `agendamentos`: `AgendamentoDaAgendaDto` (abaixo), já com `conflitos`.
- `bloqueios`: as ocorrências do dia, no mesmo formato da leitura de bloqueios da seção 1.5.
- `reservas`: horários segurados por pedido online ainda valendo (`{ id, profissionalId, inicio, fim, expiraEm, donoTipo }`); mostre como "segurado" na grade. Quem cria reserva é a E3-05.

**`AgendamentoDaAgendaDto`:** `{ id, versao, status, origem, encaixe, inicio, fim, duracaoMinutos, paciente: { id, nome, especie, clienteId, clienteNome }, profissionalId, tipoId, salaIds, grupoId, observacao, confirmadoEm, confirmadoPor, chegadaEm, iniciadoEm, finalizadoEm, canceladoEm, motivoCancelamento, canceladoPor, atendimentoId, pedidoId, remarcadoDeId, criadoPorId, criadoEm, atualizadoEm, conflitos }`.

- `status`: `AGENDADO`, `CONFIRMADO`, `AGUARDANDO` (chegou), `EM_ATENDIMENTO`, `FINALIZADO`, `FALTA`, `CANCELADO` (o mock em maiúsculas e com `_`).
- `origem`: `RECEPCAO`, `APP`, `LINK` (o `link`/`LINK_PUBLICO` do mock), `TELEFONE`, `ENCAIXE`, `RETORNO`, `FILA`.
- `versao`: **guarde e mande de volta** em toda edição e ação (2.8).
- `grupoId`: o atendimento em duas salas (cirurgia e recuperação). É o `id` da perna principal; as pernas têm o mesmo `grupoId`.
- `confirmadoPor` e `canceladoPor`: `APP` (o responsável) ou `RECEPCAO`.
- `atendimentoId` fica `null` até a E4-01.
- Cancelado e falta **continuam no dia** (riscados) e vêm sem conflitos.

### 2.3 Conflitos

Sempre `{ kind, severity, params }`, **nunca texto**: traduza pelo `kind` (o catálogo `clinico.conflitos.<kind>` do portal). Horas em `params` vêm em `HH:mm` da parede da clínica (o mock usava minutos do dia). Nada bloqueia: só `holiday-closed` é `blocking` (2.6).

**Conflito agregado (revisão de segurança v0.3; muda do mock e da versão anterior deste guia):** os conflitos de lista vêm **um por tipo**, não um por agendamento sobreposto. `professional-overlap`, `room-overlap` (um por sala do agendamento), `pet-double-book`, `block-invasion` e `pedido-pendente` trazem `quantidade` (todos os sobrepostos) e **no máximo 5 ids** (`agendamentoIds`, `bloqueioIds` ou `reservaIds`, do mais cedo ao mais tarde); os outros `params` (`paciente`, `hora`, `minutos`, `motivo`, `origem`, `expiraEm`) descrevem **o primeiro**, o mais cedo. Mostre o primeiro e **"+N" quando `quantidade` passar de `agendamentoIds.length`** (ex.: "Sobrepõe com Rex às 09:00 e mais 3"); para ver todos, abra o dia. Não existe mais `agendamentoId`, `bloqueioId` ou `reservaId` no singular nesses cinco. Uma linha tem no máximo 15 conflitos.

| `kind` | `severity` | `params` |
|---|---|---|
| `professional-overlap` | warning | `quantidade`, `agendamentoIds` (até 5), `paciente`, `hora`, `minutos` (do primeiro) |
| `room-overlap` | warning | um por sala: `salaId`, `sala`, `quantidade`, `agendamentoIds` (até 5), `paciente` (do primeiro) |
| `pet-double-book` | warning | `quantidade`, `agendamentoIds` (até 5), `paciente`, `hora` (do primeiro) |
| `block-invasion` | warning | `quantidade` (séries distintas), `bloqueioIds` (até 5), `motivo`, `minutos` (do primeiro) |
| `lunch-overlap` | info | `minutos` (e `bloqueioId` quando é o almoço do profissional; um só) |
| `outside-hours` | warning | `motivo`: `FECHADO`, `FOLGA` (o profissional não trabalha no dia), `FORA_DO_EXPEDIENTE` (com `abre`, `fecha`), `FORA_DO_ESTABELECIMENTO` (a faixa própria passa do horário da clínica; com `abre`, `fecha` da clínica) ou `ESTABELECIMENTO_FECHADO` |
| `holiday-closed` | **blocking** | `feriado` |
| `over-capacity` | info | `minutos`, `capacidade` (a faixa do profissional no dia, no máximo 8 h) |
| `type-room-mismatch` | info ou warning | `motivo`: `SALA_INCOMPATIVEL` (info; com `sala`, `salaId`, `tipo`) ou `SALA_INATIVA` (warning; a sala foi desativada depois) |
| `pedido-pendente` | warning | `quantidade`, `reservaIds` (até 5), `origem` (`PEDIDO_APP`, `PEDIDO_LINK`, `FILA`) e `expiraEm` (do primeiro). **Novo:** o horário está segurado por um pedido online |

Muda do mock: bloqueio de **sala** só pesa para quem usa a sala (no mock, atingia todo profissional).

### 2.4 Semana e intervalo

- `GET /parceiro/portal/clinica/agenda/semana?data=AAAA-MM-DD`: segunda a domingo da semana de `data`. `{ fuso, de, ate, dias, agendamentos }`; cada dia é `DiaCarga` `{ data, clinicaFechada, feriado, agendados, capacidadeMinutos, ocupadoMinutos, ocupacao, faltas, encaixes, porProfissional }` e cada profissional `{ profissionalId, agendados, ocupadoMinutos, capacidadeMinutos, ocupacao, ocupacaoManha, ocupacaoTarde }` (0 a 2; acima de 1, vendido além do expediente). O período sai do início do atendimento; o grupo conta uma vez. As faixas da barra (`vazio`, `tranquilo`, `cheio`, `excedido`) continuam na tela com os limites de `load.ts`.
- `GET /parceiro/portal/clinica/agenda/intervalo?de=&ate=&profissionalId=&cursor=`: para a gaveta de pedidos e o retorno. Até 31 dias (senão 400 `AGENDA_PERIODO_INVALIDO` com `maxDias`), 200 por página: siga o `proximoCursor` até vir `null`.
- **Grade do mês:** leia cinco `semana` (ou o `intervalo` por página). Nunca peça mais de 62 dias de bloqueios de uma vez (o teto de 5.000 ocorrências da seção 1.5 continua valendo).
- Tetos: dia com mais de 1.000 agendamentos ou semana com mais de 3.000: 400 `AGENDA_LEITURA_EXCEDIDA` (mostre a mensagem e filtre).

### 2.5 Sugestões de horário

`GET /parceiro/portal/clinica/agenda/sugestoes?pacienteId=&tipoId=&profissionalId=&aPartirDe=AAAA-MM-DD&quantidade=` devolve `{ fuso, sugestoes: [{ profissionalId, profissionalNome, data, inicio, fim }], buscaInterrompida, profissionaisAvaliados, profissionaisLimitados }`.

- Só horários **sem aviso nenhum**, do mais cedo ao mais tarde, na faixa de cada profissional, no passo da grade da política. Avança dias fechados, por até 5 semanas.
- `profissionalId`: o retorno é com quem atendeu (substitui o `sugerirRetorno`). Sem ele, todos que atendem na agenda.
- Reagendar (o `sugerirReagendamento`): a mesma rota com `aPartirDe` no dia seguinte ao da falta.
- `quantidade`: padrão 6, até 20. Paciente inativo: 409 `PACIENTE_INATIVO`.
- **Tetos (revisão v0.3):**
  - a busca avalia no máximo 20.000 horários por pedido. Passou, volta o que achou com **`buscaInterrompida: true`** (pode até vir lista vazia): mostre "não achamos tudo; tente a partir de outro dia ou com um profissional" e ofereça o `aPartirDe`;
  - sem `profissionalId`, entram no máximo **30 profissionais** (por nome, a ordem da agenda). Com mais de 30, **`profissionaisLimitados: true`**: diga que a busca olhou os 30 primeiros e ofereça escolher o profissional. `profissionaisAvaliados` diz quantos entraram;
  - **300 buscas por pessoa por hora**: 429 `AGENDA_SUGESTOES_TAXA_EXCEDIDA` com `limite` e `tenteDeNovoEmSegundos`. Não dispare a busca a cada tecla nem em laço: só no gesto (abrir o diálogo, trocar o dia ou o profissional).

### 2.6 Criar, simular e o grupo

- **Criar:** `POST /parceiro/portal/clinica/agendamentos` (mande `Idempotency-Key`: o clique duplo não cria dois horários)
  - `{ pacienteId, profissionalId, tipoId, inicio, duracaoMinutos?, salaIds?, origem?, encaixe?, observacao?, pernasLigadas?, confirmarConflitos? }`;
  - `inicio` com offset; `duracaoMinutos` de 5 a 480 (padrão: a do tipo); `salaIds` até 4;
  - `origem`: `RECEPCAO` (padrão), `TELEFONE`, `ENCAIXE` (marca `encaixe`) ou `RETORNO`;
  - `observacao` (até 500) é **interna**: nunca vai ao app;
  - resposta `MutacaoDaAgendaDto` `{ id, agendamentos, desfazerToken, desfazerAte, removidos }`; os conflitos vêm em cada agendamento: **mostre os avisos depois de gravar**, não impeça.
- **Dia especial fechado:** 409 `CONFLITO_BLOQUEANTE` com `conflitos`. É o "confirmar em dois passos" do mock: mostre o aviso e, se a pessoa confirmar, mande de novo com `confirmarConflitos: ['holiday-closed']`.
- **Simular antes de gravar:** `POST /parceiro/portal/clinica/agendamentos/simular`, mesmo corpo, devolve `{ pernas: [{ tipoId, salaIds, conflitos }], bloqueante, alternativas }` sem gravar. `alternativas` são as 5 melhores do mesmo dia com o mesmo profissional, com os avisos de cada uma (o `buscarAlternativas` do mock).
- **Grupo (duas salas):** `pernasLigadas: [{ salaIds, tipoId?, observacao? }]` (até 3): mesmo horário, paciente e profissional; a resposta traz todas as pernas com o mesmo `grupoId`.
- Recusas antes de gravar: paciente inativo, com óbito ou mesclado, inclusive se isso aconteceu enquanto a tela estava aberta (409 `PACIENTE_INATIVO` com `obito` e, se mesclado, `mescladoEmId`: abra o cadastro que ficou), profissional inativo ou fora da agenda (409 `PROFISSIONAL_INDISPONIVEL` com `reason`), tipo desativado (409 `TIPO_INATIVO`), sala desativada (409 `SALA_INATIVA`), início a mais de 30 dias atrás ou 730 à frente, sala repetida no grupo ou perna sem sala (400 `AGENDAMENTO_INVALIDO` com `reason`).

### 2.7 Editar, mover e mudar a situação

Toda ação manda `versao` (2.8).

- **Editar:** `PATCH /parceiro/portal/clinica/agendamentos/:id` `{ versao, tipoId?, observacao?, salaIds?, duracaoMinutos?, encaixe? }`. Só o alvo (as outras pernas do grupo ficam). Paciente não se troca: é outro agendamento. `null` em `tipoId`, `salaIds`, `duracaoMinutos` ou `encaixe`: 400; `observacao: null` apaga. Sala que já estava pode ficar mesmo desativada; sala nova desativada: 409.
- **Mover (arrastar):** `POST .../:id/mover` `{ inicio, versao, destino?, confirmarConflitos?, avisarResponsavel?, mensagem? }`:
  - arrastar no agrupamento **por profissional**: `destino: { profissionalId }`;
  - arrastar no agrupamento **por sala**: `destino: { trocarSala: { de: <sala da coluna de origem>, para: <sala da coluna de destino> } }`. Troca **só** essa sala e nunca o profissional (era o defeito D1 do doc 01: a coluna de sala ia parar no profissional);
  - trocar as salas inteiras: `destino: { salaIds }` (não junto com `trocarSala`: 400);
  - o grupo anda junto pelo mesmo deslocamento; só o alvo troca de sala;
  - paciente inativo, com óbito ou mesclado não se move (409 `PACIENTE_INATIVO`): cancele.
- **Cancelar:** `POST .../:id/cancelar` `{ versao, motivo, avisarResponsavel?, mensagem? }` (`motivo`: `RESPONSAVEL_DESMARCOU`, `CLINICA_REMARCOU`, `PACIENTE_INDISPONIVEL`, `DUPLICADO`, `OUTRO`). Vale para o grupo inteiro; o card fica no dia, riscado.
- **Confirmar presença** (a recepção ligou): `POST .../:id/confirmar-presenca` `{ versao }`. **Chegada** (sala de espera): `POST .../:id/chegada` `{ versao }`. **Iniciar**: `POST .../:id/iniciar` `{ versao }` (só a perna; grava a chegada se faltava). Confirmar, chegada e cancelar valem para o grupo.
- Ação que não vale na situação (ex.: cancelar em atendimento): 409 `AGENDAMENTO_STATUS_INVALIDO` com `status` e `acao`. Use a tabela: antes de chegar, tudo; aguardando, editar, mover, cancelar e iniciar; em atendimento, só editar; encerrado, nada.
- **Avisar o responsável:** `avisarResponsavel` e `mensagem` já são aceitos, mas **ainda não enviam nada**: os avisos da agenda (e o comprovante) chegam com a E3-06. Deixe o interruptor desligado até lá.

### 2.8 Versão e desfazer

- **Versão:** toda resposta traz `versao`. Duas recepções mexendo no mesmo agendamento: a segunda recebe 409 `AGENDAMENTO_ALTERADO` com `atual` (`[{ id, versao, status, inicio, fim, profissionalId, tipoId, salaIds, observacao, atualizadoEm }]`). Mostre "mudou enquanto você editava", atualize o card com `atual` e releia o dia.
- **Desfazer:** toda mutação devolve `desfazerToken` e `desfazerAte` (15 s no servidor; mantenha os 8 s da tela). `POST /parceiro/portal/clinica/agenda/desfazer` `{ token }` volta o estado (com versão nova) ou, na criação, apaga o que foi criado (`removidos`). Passou do prazo, outra pessoa, já usado ou o agendamento mudou depois: 409 `DESFAZER_EXPIRADO` (esconda o "Desfazer"). Não há desfazer do desfazer.
- **O desfazer não devolve o que a escrita recusaria (revisão v0.3):** desfazer um cancelamento confere tudo de novo (paciente, profissional, tipo e salas); desfazer um mover confere o paciente; nos outros, só o que volta diferente (profissional, tipo, sala que sai e volta). Recusou: o mesmo 409 da escrita (`PACIENTE_INATIVO`, `PROFISSIONAL_INDISPONIVEL`, `TIPO_INATIVO`, `SALA_INATIVA`), nada muda e o token continua valendo até os 15 s. Mostre a mensagem e esconda o "Desfazer" (ex.: o pet morreu entre o cancelar e o desfazer: o agendamento fica cancelado).
- **Taxa:** 600 escritas por pessoa por hora na agenda: 429 `AGENDAMENTO_TAXA_EXCEDIDA` com `tenteDeNovoEmSegundos`. Não repita sozinho.

### 2.9 Erros desta seção

| `codigo` | Status | Quando | Extra |
|---|---|---|---|
| `CONFLITO_BLOQUEANTE` | 409 | Dia especial fechado sem `confirmarConflitos` | `conflitos` |
| `AGENDAMENTO_ALTERADO` | 409 | A `versao` da tela ficou velha | `atual` |
| `DESFAZER_EXPIRADO` | 409 | Token vencido, alheio, usado ou o agendamento mudou depois | |
| `AGENDAMENTO_STATUS_INVALIDO` | 409 | Ação que não vale na situação | `status`, `acao` |
| `AGENDAMENTO_INVALIDO` | 400 | Dado que a regra não aceita | `reason` (`INICIO_FORA_DO_HORIZONTE`, `SALA_REPETIDA_NO_GRUPO`, `PERNA_SEM_SALA`, `SALAS_E_TROCA_JUNTAS`, `SALA_DE_ORIGEM_AUSENTE`) |
| `PROFISSIONAL_INDISPONIVEL` | 409 | Profissional inativo ou que não atende na agenda | `reason` (`INATIVO`, `NAO_ATENDE_NA_AGENDA`) |
| `TIPO_INATIVO` | 409 | Tipo de atendimento desativado | `tipoId` |
| `SALA_INATIVA` | 409 | Sala desativada no agendamento novo | `salaId` |
| `PACIENTE_INATIVO` | 409 | Paciente inativo, com óbito ou mesclado (E2-01), no criar, mover, sugestões ou desfazer | `obito`, `mescladoEmId` (se mesclado) |
| `AGENDA_PERIODO_INVALIDO` | 400 | Intervalo invertido ou de mais de 31 dias | `maxDias` |
| `AGENDA_LEITURA_EXCEDIDA` | 400 | Dia ou semana com agendamentos demais | `maxAgendamentos` |
| `AGENDAMENTO_TAXA_EXCEDIDA` | 429 | Mais de 600 escritas na hora | `limite`, `tenteDeNovoEmSegundos` |
| `AGENDA_SUGESTOES_TAXA_EXCEDIDA` | 429 | Mais de 300 buscas de sugestão na hora | `limite`, `tenteDeNovoEmSegundos` |
| `AGENDA_DATA_FORA_DO_LIMITE` | 400 | `data`, `de`, `ate` ou `aPartirDe` com o ano fora de 2000 a 2100 | `campo`, `anoMinimo`, `anoMaximo` |
| `CURSOR_INVALIDO` | 400 | Cursor de outra consulta ou adulterado: recarregue a lista | |
| (sem `codigo`) | 403 | Recurso de outra clínica ou inexistente | |
| `SEM_PERMISSAO` / `MODULO_INATIVO` / `MODULO_SOMENTE_LEITURA` | 403 | Seção 2.1 | |

### 2.10 App do responsável (`petjourney-app`)

As telas de agendamento do protótipo (`origin/modulo-clinico`) passam a ler a API. O app só vê agendamento de pet **ligado à clínica por vínculo ativo** (guia e2, seção 2.4): sem vínculo, nada aparece; vínculo encerrado, some na hora.

- **Lista:** `GET /tutor/clinica/agendamentos?petId=&quando=PROXIMOS|PASSADOS&cursor=&limit=` devolve `{ itens, proximoCursor }`. `PROXIMOS` (padrão) do mais cedo; `PASSADOS` do mais recente; `limit` até 50. `petId` de pet que a pessoa não lê: 403. Um item por atendimento (o grupo de duas salas vem uma vez).
- **Detalhe:** `GET /tutor/clinica/agendamentos/:id`. De outra pessoa ou sem vínculo: 403.
- **`AgendamentoDoResponsavelDto`:** `{ id, clinica: { id, nome, telefone, fuso }, pet: { id, nome }, servico: { id, nome, kind, duracaoMinutos }, profissional: { id, nome, especialidade }, salas, inicio, fim, status, origem, criadoEm, confirmadoEm, confirmadoPor, canceladoEm, motivoCancelamento, canceladoPor, podeConfirmar, podeCancelar, podeRemarcar, cancelarAte, confirmacaoAbreEm, somenteLeitura }`.
  - **Horário da clínica:** `inicio` e `fim` vêm com o offset da clínica, mesmo com o aparelho em outro fuso. Mostre a hora como veio e escreva "horário da clínica" quando o fuso do aparelho for outro (`clinica.fuso`).
  - **O app não calcula prazo:** use `podeConfirmar`, `podeCancelar` e `cancelarAte` como vêm (eles já consideram quem olha). `podeRemarcar` é sempre `false` até o pedido online (E3-05): não mostre "remarcar" ainda.
  - `somenteLeitura: true`: pet da família. Mostre, sem os botões.
  - `especialidade`: a chave da lista do app (`CLINICO_GERAL`...) ou texto livre, como na `Consulta`.
  - Pré-consulta e falta entram com a E3-07 e a E3-03.
- **Confirmar presença:** `POST /tutor/clinica/agendamentos/:id/confirmar` (sem corpo; **não mande `Content-Type` sem corpo**, o Fastify recusa com 400). Abre na janela da clínica (`confirmacaoAbreEm`, em geral 48 h antes) e só para `AGENDADO`. Fora dela: 409 `AGENDAMENTO_ENCERRADO` com `reason` (`AINDA_NAO_ABRIU`, `JA_COMECOU`, `STATUS`). Já confirmado: 200 (o toque duplo não é erro).
- **Cancelar:** `POST /tutor/clinica/agendamentos/:id/cancelar` `{ motivo? }` (`RESPONSAVEL_DESMARCOU`, o padrão, `PACIENTE_INDISPONIVEL` ou `OUTRO`). Depois de `cancelarAte`: 409 `FORA_DO_PRAZO_DE_CANCELAMENTO` com `cancelarAte`: mostre "ligue para a clínica" com o `clinica.telefone`.
- **Família:** confirmar e cancelar são só do dono: 403 `SOMENTE_LEITURA`. Pet inativo some para a família na lista, no detalhe e em "Minhas clínicas" (o dono continua vendo); corrigido na revisão v0.3, antes a lista sem `petId` ainda trazia.
- **Notificação:** a E3-02 não cria tipo novo. Os avisos da agenda (criado pela clínica, véspera, remarcado, cancelado) chegam numa leva só com a E3-06, com as rotas do app.
- **Pronto quando:** a aba de agendamentos da clínica lista próximos e passados, o detalhe mostra o horário da clínica e os botões seguem `podeConfirmar`/`podeCancelar`, e os 409 viram as mensagens da API.

### 2.11 Pendências (E1-06)

`GET /parceiro/portal/pendencias?modulo=CLINICA` ganhou `agendamentosSemConfirmacao` (tom ATENCAO, rota `/veterinario/agenda`): agendamentos que ninguém confirmou e começam nas próximas 48 h, para quem escreve na agenda. Paciente inativo ou com óbito não conta (o agendamento continua na agenda até a recepção cancelar). O número tem cache de 30 s (E1-06). O selo abre a agenda; um filtro "sem confirmação" na tela é bem-vindo.

### 2.12 Pronto quando (portal)

A agenda do dia, da semana e do mês lê a API (sem `agendaRepository` mock nem `detectarConflitos`/`slots`/`load` locais), o diálogo de marcar usa o `simular` e as `alternativas`, o arrastar manda o `destino` tipado com `versao`, o "Desfazer" usa o token, o 409 de versão atualiza o card, e as sugestões de retorno e reagendamento vêm da rota.
