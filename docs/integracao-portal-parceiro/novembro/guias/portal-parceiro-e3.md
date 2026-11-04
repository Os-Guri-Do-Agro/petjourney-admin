<!-- doc cmvrbpqgobg2wddy1hpf · "Handoff E3-05: portal-parceiro-e3.md" · atualizado 2026-10-30T13:33:07.467Z · card PJ-SVL85R -->

# Guia do front: Portal do parceiro, E3 (agenda)

**Para:** o Luís. Portal web do parceiro (`petjourney-admin`) e, na seção 2.10, o app (`petjourney-app`).
**Backend:** E3-01 (configuração da agenda) e E3-02 (agenda e agendamentos) prontas e validadas em dev em 2026-10-21; E3-03 (faltas) em dev em 2026-10-22; E3-06 (avisos ao responsável) em dev em 2026-10-27; E3-04 (fila de espera) em dev em 2026-10-27; E3-05 (agendamento online, seção 6) em dev em 2026-10-27; E3-07 (pré-consulta, seção 7) em dev em 2026-10-28: unit, integração contra o Postgres de dev e smoke por HTTP (`npm run script:smoke-agenda-config`, `npm run script:smoke-agenda`, `npm run script:smoke-faltas`, `npm run script:smoke-avisos`, `npm run script:smoke-fila` e `npm run script:smoke-agendamento-online` e `npx tsx scripts/smoke-pre-consulta.ts`). **Não estão em produção.** O pedido online (E3-05) está na seção 6, com o site.
**Specs de origem:** `docs/specs/2026/q4/q4-1/portal-parceiro/e3-agenda/01-configuracao-da-agenda.md` (v0.5; seção 1), `02-agenda-e-agendamentos.md` (v0.4; seção 2), `03-faltas.md` (v0.2; seção 3), `06-avisos-clinicos-ao-responsavel.md` (v0.2; seção 4), `04-fila-de-espera.md` (v0.2; seção 5) e `05-agendamento-online.md` (v0.2; seção 6)

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
- **Oferta automática da fila (E3-04, v0.4):** `ofertaAutomaticaFila` (booleano) vem no `GET` (padrão `true`) e vai no mesmo `PUT`, **opcional**: omitido, fica como está (a tela antiga não desliga sem querer); `null`, 400. Um interruptor "Ofertar vagas sozinho ao primeiro da fila" perto do campo do prazo da oferta. O que ele faz está na 5.6.
- **Pronto quando:** a tela de política mostra os seis números com as faixas da API e o interruptor da oferta automática, e `slotMinutos` e `politicaDaClinicaFixture` saem do mock.

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
- `reservas`: horários segurados por pedido online ainda valendo (`{ id, profissionalId, inicio, fim, expiraEm, donoTipo }`); mostre como "segurado" na grade. Quem cria reserva é a E3-05 (seção 6) e a oferta da fila (seção 5).

**`AgendamentoDaAgendaDto`:** `{ id, versao, status, origem, encaixe, inicio, fim, duracaoMinutos, paciente: { id, nome, especie, clienteId, clienteNome }, profissionalId, tipoId, salaIds, grupoId, observacao, confirmadoEm, confirmadoPor, chegadaEm, iniciadoEm, finalizadoEm, canceladoEm, motivoCancelamento, canceladoPor, atendimentoId, pedidoId, remarcadoDeId, faltaEm, reagendadoComoId, criadoPorId, criadoEm, atualizadoEm, conflitos }` (`faltaEm` e `reagendadoComoId` são da E3-03, seção 3).

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
- **Avisar o responsável:** `avisarResponsavel` e `mensagem` (no criar, no mover e no cancelar) **enviam o aviso desde a E3-06** e a resposta traz `aviso`, com o "sem canal no app": seção 4.

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
  - **O app não calcula prazo:** use `podeConfirmar`, `podeCancelar` e `cancelarAte` como vêm (eles já consideram quem olha). `podeRemarcar` liga com o pedido online (E3-05, seção 6.4): o dono, com o online da clínica ligado, dentro do prazo de cancelar.
  - `somenteLeitura: true`: pet da família. Mostre, sem os botões.
  - `especialidade`: a chave da lista do app (`CLINICO_GERAL`...) ou texto livre, como na `Consulta`.
  - Pré-consulta entra com a E3-07. A falta (`falta`, E3-03) está na seção 3.8.
- **Confirmar presença:** `POST /tutor/clinica/agendamentos/:id/confirmar` (sem corpo; **não mande `Content-Type` sem corpo**, o Fastify recusa com 400). Abre na janela da clínica (`confirmacaoAbreEm`, em geral 48 h antes) e só para `AGENDADO`. Fora dela: 409 `AGENDAMENTO_ENCERRADO` com `reason` (`AINDA_NAO_ABRIU`, `JA_COMECOU`, `STATUS`). Já confirmado: 200 (o toque duplo não é erro).
- **Cancelar:** `POST /tutor/clinica/agendamentos/:id/cancelar` `{ motivo? }` (`RESPONSAVEL_DESMARCOU`, o padrão, `PACIENTE_INDISPONIVEL` ou `OUTRO`). Depois de `cancelarAte`: 409 `FORA_DO_PRAZO_DE_CANCELAMENTO` com `cancelarAte`: mostre "ligue para a clínica" com o `clinica.telefone`.
- **Família:** confirmar e cancelar são só do dono: 403 `SOMENTE_LEITURA`. Pet inativo some para a família na lista, no detalhe e em "Minhas clínicas" (o dono continua vendo); corrigido na revisão v0.3, antes a lista sem `petId` ainda trazia.
- **Notificação:** a E3-02 não cria tipo novo. Os avisos da agenda (criado pela clínica, véspera, remarcado, cancelado) e a mensagem da clínica no app estão na seção 4.5 (E3-06), com os 14 tipos da leva única.
- **Pronto quando:** a aba de agendamentos da clínica lista próximos e passados, o detalhe mostra o horário da clínica e os botões seguem `podeConfirmar`/`podeCancelar`, e os 409 viram as mensagens da API.

### 2.11 Pendências (E1-06)

`GET /parceiro/portal/pendencias?modulo=CLINICA` ganhou `agendamentosSemConfirmacao` (tom ATENCAO, rota `/veterinario/agenda`): agendamentos que ninguém confirmou e começam nas próximas 48 h, para quem escreve na agenda. Paciente inativo ou com óbito não conta (desde a E3-03, o óbito cancela sozinho os agendamentos do dia do óbito em diante: seção 3.6). O número tem cache de 30 s (E1-06). O selo abre a agenda; um filtro "sem confirmação" na tela é bem-vindo.

### 2.12 Pronto quando (portal)

A agenda do dia, da semana e do mês lê a API (sem `agendaRepository` mock nem `detectarConflitos`/`slots`/`load` locais), o diálogo de marcar usa o `simular` e as `alternativas`, o arrastar manda o `destino` tipado com `versao`, o "Desfazer" usa o token, o 409 de versão atualiza o card, e as sugestões de retorno e reagendamento vêm da rota.

---

## 3. Faltas (E3-03)

O ciclo da falta com as regras no servidor: marcar (um a um e "fechar o turno"), justificar (motivo, canal, quem e quando), reagendar, o painel (minutos perdidos, reincidentes, quem nem foi procurado), o histórico do responsável e o óbito, que encerra o caso. Substitui no mock:
- no `agendaRepository`: `alterarStatus(id, 'falta', justificativa?)`, `justificarFalta` e o `sugerirReagendamento` (que já era a rota de sugestões, seção 2.5);
- no `patientRepository`: `resumoDeFaltas` e `faltasDoResponsavel`;
- as regras de `domain/faltas.ts` (`motivoEncerraOCaso`, `aceitaReagendamento`) e o `resumirFaltas` de `domain/load.ts`. **Apague a regra local quando ligar a rota**: o servidor devolve `situacao`, `aceitaReagendamento`, `reincidente` e `aConvidar` prontos. O `LIMITE_REINCIDENCIA` (3) vem no painel (`limiteReincidencia`).

Convenções das seções 1 e 2 valem aqui.

### 3.1 Quem entra

- **Módulo Clínica** em todas as rotas da clínica. **Ler** (a falta, o painel, o histórico): `agenda.ler`. **Escrever** (marcar, lote, justificar, reagendar): `agenda.escrever`. Enfermagem lê o painel e não marca.
- Agendamento, profissional ou cliente de outra clínica (ou que não existe): 403 **sem `codigo`**. No lote, **um** id de outra clínica recusa o lote inteiro.
- Marcar, o lote e justificar gastam o mesmo balde da agenda (600 por pessoa por hora, 429 `AGENDAMENTO_TAXA_EXCEDIDA`); reagendar é um `criar` (o mesmo balde e os mesmos tetos).
- **Óbito pede também `paciente.escrever`** (revisão v0.3): marcar ou justificar com `motivo: 'OBITO'` sem essa permissão dá 403 `SEM_PERMISSAO` com `permissao: 'paciente.escrever'`, nada gravado. Hoje todo papel que escreve na agenda tem as duas; mesmo assim, esconda a opção "óbito" quando o `GET /parceiro/portal/eu` não trouxer `paciente.escrever`.
- **Painel e histórico têm balde de leitura** (revisão v0.3): 300 por pessoa por hora em cada um; acima, 429 `FALTAS_LEITURA_TAXA_EXCEDIDA` com `limite` e `tenteDeNovoEmSegundos`. Não recarregue o painel em laço (nada de polling); recarregue depois de uma escrita.

### 3.2 Marcar a falta

`POST /parceiro/portal/clinica/agendamentos/:id/falta` `{ versao, justificativa? }` devolve `FaltaMarcadaDto`: o `MutacaoDaAgendaDto` da seção 2 (`agendamentos`, `desfazerToken`, `desfazerAte`) mais `falta` (3.4) e `obito` (3.6, nulo fora do óbito).

- **Só depois do início** (D1): antes, 409 `FALTA_ANTES_DO_HORARIO` com `inicio`. Só de quem não chegou (`AGENDADO` ou `CONFIRMADO`); aguardando, em atendimento ou encerrado: 409 `AGENDAMENTO_STATUS_INVALIDO` com `acao: 'falta'`.
- O grupo de duas salas falta inteiro. A resposta traz `faltaEm` em cada linha; o card fica no dia, riscado, sem conflitos (a falta libera o horário).
- **Com motivo na mesma ação** (o diálogo do portal): `justificativa: { motivo?, canal, observacao?, obitoEm? }` (3.3). É "uma mutação, um desfazer": o desfazer volta a falta **e** apaga a justificativa que nasceu com ela. Com `motivo: 'OBITO'` não há desfazer (`desfazerToken: null`): o caso se encerra (3.6). Deixe o óbito no fim da lista, como o diálogo já faz.
- **Desfazer:** o de sempre (2.8). Justificar depois da falta sobe a versão: a partir daí o desfazer da falta dá 409 `DESFAZER_EXPIRADO` (a falta nunca volta deixando uma justificativa solta). Esconda o "Desfazer" depois de justificar.
- **Fila (E3-04):** a falta libera o horário; quando a fila existir, ela é chamada para o resto do horário. Hoje nada muda na tela.

**Fechar o turno:** `POST /parceiro/portal/clinica/agendamentos/faltas-em-lote` `{ data, profissionalId?, agendamentoIds }` (até 100 ids; mais: 400) devolve `{ marcados, ignorados, desfazerToken, desfazerAte }`.
- Viram falta, numa transação, só os do `data` (e do `profissionalId`, se veio) que **já passaram do fim** e não chegaram. O resto volta em `ignorados: [{ agendamentoId, reason }]` com `reason` `FORA_DO_TURNO` (outro dia ou profissional), `STATUS` (já não estava por acontecer), `CHEGOU` ou `NAO_ENCERROU` (o horário ainda não acabou: quem chegou atrasado não vira falta por engano). Mostre quantos ficaram de fora e por quê.
- Um desfazer volta o lote inteiro. Sem nenhum marcado, `desfazerToken: null`.

### 3.3 Justificar

`POST /parceiro/portal/clinica/agendamentos/:id/justificativas` `{ motivo?, canal, observacao?, obitoEm? }` (201) devolve `{ falta, agendamento, obito }` (`agendamento` com a versão nova).

- `canal`: `TELEFONE`, `WHATSAPP`, `PRESENCIAL` ou `SEM_RESPOSTA` (a tentativa que não deu em nada). `APP` é só o responsável, pelo app.
- `motivo`: `ESQUECEU`, `IMPREVISTO`, `TRANSPORTE`, `PACIENTE_MELHOROU`, `EMERGENCIA`, `CUSTO`, `INSATISFACAO`, `OBITO`, `OUTRO` (o mock em maiúsculas e com `_`). **Obrigatório com contato; ausente em `SEM_RESPOSTA`.** Errou: 400 `JUSTIFICATIVA_INVALIDA` com `reason` (`MOTIVO_OBRIGATORIO`, `MOTIVO_EM_SEM_RESPOSTA`, `OBITO_EM_SEM_OBITO`, `OBITO_NO_FUTURO`).
- `observacao` (até 500, aparada) é **interna**: nunca vai ao app. Quem registrou (`profissionalId`, a ficha do usuário na clínica, e `usuarioId`) e quando saem do servidor: não mande.
- **Registro, não campo** (D3): cada justificativa fica, inclusive as `SEM_RESPOSTA`; **a última com contato vale** ("a segunda ligação sabe mais que a primeira"). Até 20 por falta: depois, 409 `JUSTIFICATIVAS_NO_LIMITE` com `maxJustificativas`.
- Justificar não desfaz a falta: ela continua contando no painel (faltas e minutos), só sai da fila de trabalho.
- Não é falta: 409 `AGENDAMENTO_STATUS_INVALIDO` com `acao: 'justificar'`. Caso encerrado (óbito): 409 `FALTA_ENCERRADA`.
- **Cliente anonimizado** (os dados pessoais apagados a pedido do titular): justificar, ou marcar a falta já com justificativa, dá 409 `CLIENTE_ANONIMIZADO`; nada é gravado. Mostre a `message` e esconda o diálogo de justificativa para esse cliente. Marcar a falta sem justificativa continua valendo.
- O paciente do agendamento mudou no meio (mesclado): 409 `AGENDAMENTO_ALTERADO`; releia como no 2.8.
- `obitoEm` (`AAAA-MM-DD`, só com `OBITO`): o dia do óbito; padrão, o dia da falta (ou o que o cadastro já tinha). Nunca depois de hoje.

### 3.4 A falta de um agendamento (o diálogo reaberto)

`GET /parceiro/portal/clinica/agendamentos/:id/falta` devolve `FaltaDoAgendamentoDto` `{ agendamentoId, faltaEm, situacao, aceitaReagendamento, reagendadoComoId, vigente, justificativas }`:
- `situacao`: `PENDENTE` (ninguém registrou nada), `SEM_RESPOSTA` (só tentativas), `JUSTIFICADA` (há contato) ou `ENCERRADA` (óbito);
- `vigente`: a que vale (a última com contato) ou `null`; `justificativas`: todas, da mais recente para a mais antiga, `{ id, motivo, canal, observacao, profissionalId, profissionalNome, usuarioId, registradaEm }`. A do app vem com `canal: 'APP'`, sem profissional e sem `usuarioId`;
- `aceitaReagendamento: false` só no óbito: esconda "reagendar" e "ligar". A falta e a justificativa são da perna principal do grupo (mande o id de qualquer perna).

### 3.5 Reagendar

`POST /parceiro/portal/clinica/agendamentos/:id/reagendar` `{ inicio, profissionalId, tipoId?, salaIds?, duracaoMinutos?, observacao?, confirmarConflitos? }` (201, `MutacaoDaAgendaDto`; mande `Idempotency-Key`):
- cria pelo `criar` da agenda (conflitos, `CONFLITO_BLOQUEANTE`, tetos, desfazer de criação) com `origem: 'RECEPCAO'`, `remarcadoDeId` = a falta; a falta ganha `reagendadoComoId`. Padrões: o tipo e as salas da falta;
- os horários: a rota de sugestões (2.5) com `aPartirDe` no dia seguinte ao da falta;
- já reagendada e o novo ainda vale: 409 `FALTA_JA_REAGENDADA` com `reagendadoComoId` (se o novo foi cancelado, pode reagendar de novo); caso encerrado: 409 `FALTA_ENCERRADA`; não é falta: 409 `AGENDAMENTO_STATUS_INVALIDO`; paciente inativo: 409 `PACIENTE_INATIVO`;
- o desfazer da criação apaga o novo e a falta volta sem `reagendadoComoId` (e volta a "convidar").

### 3.6 Óbito (D4)

Motivo `OBITO` (na falta ou na justificativa) **encerra o caso**, numa transação:
- o paciente fica inativo, motivo `OBITO`, com `obitoEm`;
- os agendamentos dele **do dia do óbito em diante** que ainda iam acontecer (`AGENDADO`, `CONFIRMADO`) são cancelados com `motivoCancelamento: 'OBITO'` (novo; a recepção não escolhe esse motivo no cancelar), sem aviso a ninguém;
- o vínculo com o app é encerrado pelo sistema (o app para de ver);
- nenhuma notificação sai. A resposta traz `obito: { obitoEm, agendamentosCancelados, vinculosEncerrados }`: mostre "N horários cancelados".
- **A inativação do paciente com motivo `OBITO` (E2-01) faz exatamente o mesmo** (o mesmo código). Reativar o paciente por engano não volta os horários cancelados: a recepção marca de novo.
- Como a inativação, o óbito pela falta pede `paciente.escrever` (3.1): sem ela, 403 `SEM_PERMISSAO`.
- Mostre `motivoCancelamento: 'OBITO'` no card riscado com o cuidado do mock ("caso encerrado").

### 3.7 Painel e histórico

**Painel:** `GET /parceiro/portal/clinica/faltas?de=&ate=&reincidentes=&semJustificativa=&cursor=&limit=` devolve `{ fuso, de, ate, limiteReincidencia, itens, proximoCursor }`.
- Período de até 366 dias (padrão: o ano que termina hoje); mais: 400 `FALTAS_PERIODO_INVALIDO` com `maxDias`. `limit` até 100 (padrão 50); siga o `proximoCursor`.
- Cada item (por responsável **e** paciente): `{ cliente: { id, nome }, paciente: { id, nome, especie, ativo, obito }, faltas, minutosPerdidos, ultimaFaltaEm, faltas12Meses, reincidente, semJustificativa, naoProcuradas, aConvidar }`. Ordem: mais faltas, depois mais minutos.
  - `reincidente`: 3 faltas ou mais nos **últimos 12 meses** (`faltas12Meses`, independe do período). O painel abre com `reincidentes=true` (D5).
  - `semJustificativa`: sem contato registrado (a fila de trabalho; inclui as só com `SEM_RESPOSTA`). `naoProcuradas`: sem registro nenhum ("quem ainda nem foi procurado").
  - `aConvidar`: a última falta do período ainda pede convite para remarcar (não encerrada, ninguém remarcou depois, paciente ativo). **Quem já remarcou não aparece como "a convidar"** (AC7).
- **Histórico de um responsável:** `GET /parceiro/portal/clientes/:id/faltas?cursor=&limit=` (`:id` é o cliente da clínica; até 50 por página) devolve `{ fuso, itens, proximoCursor }`, da mais recente: `{ agendamentoId, paciente, inicio, fim, minutosPerdidos, tipo: { id, nome, kind }, profissional: { id, nome }, faltaEm, situacao, vigente, registros, voltouDepois, aConvidar }`.
  - **Mudou na revisão v0.3: sem `justificativas`.** `vigente` é a que vale (a última com contato) ou `null`, `{ id, motivo, canal, observacao, observacaoCortada, profissionalId, usuarioId, registradaEm }`: a `observacao` vem cortada em 140 caracteres e `observacaoCortada: true` avisa (mostre "..." e um "ver tudo"); **não traz `profissionalNome`** (resolva o nome pelo `profissionalId` na lista de profissionais que a agenda já carrega). `registros` é quantos registros a falta tem (tentativas e justificativas). A lista inteira, com a observação completa e o nome de quem registrou, é o `GET .../agendamentos/:id/falta` (3.4): abra ao clicar na linha. `voltouDepois` (`{ agendamentoId, inicio, status, explicito }` ou `null`) é o "reagendado para" do mock: o reagendamento da recepção (`explicito: true`) ou o primeiro agendamento do paciente criado depois da falta, até 60 dias (a regra do mock).

### 3.8 App do responsável (`petjourney-app`)

- **Lista e detalhe** (2.10) ganham `falta`: `null` fora de `FALTA`; na falta, `{ faltaEm, justificada, podeJustificar, suaJustificativa }`. **Nada interno da clínica**: o motivo, o canal e a observação que a clínica registrou não vêm; `suaJustificativa` (`{ motivo, registradaEm }`) é o que o próprio responsável mandou, e **só para quem mandou** (revisão v0.3): a família que lê o pet recebe `null` mesmo quando o dono já justificou (use `justificada` para mostrar "já informado").
- **`motivoCancelamento` nunca é `OBITO` no app** (revisão v0.3): o cancelamento pelo óbito é da clínica e chega como `motivoCancelamento: null`, com `status: 'CANCELADO'` e `canceladoPor: 'RECEPCAO'`. O enum do contrato do app não tem mais `OBITO`: regenere os tipos e mostre o texto genérico de "cancelado pela clínica".
- **Justificar:** `POST /tutor/clinica/agendamentos/:id/justificar-falta` `{ motivo, observacao? }` devolve o agendamento (com `falta`). `motivo` como na 3.3, **sem `OBITO`** (o óbito é a clínica que registra, depois de falar com a família; o app oferece `OUTRO` com texto). Só o dono (`podeJustificar`); a família: 403 `SOMENTE_LEITURA`. Depois que a clínica registrou contato (ou ele já justificou): 409 `FALTA_JA_JUSTIFICADA` (esconda o botão: `podeJustificar` já vem `false`). Até 30 por pessoa por hora: 429 `FALTA_TAXA_EXCEDIDA`.
- **Notificação `AGENDAMENTO_FALTA`:** sai uma vez por falta, um a dois minutos depois da marcação (depois da janela do desfazer), para o dono ("Falta na consulta de Rex", com o convite para contar pelo app) e para a família que lê o pet (`paraMembro: true`, sem o convite). **Nunca** sai no óbito, para paciente inativo, para pet inativo no app (nem ao dono, desde a revisão v0.3: quem registrou o óbito do pet no app não recebe "falta na consulta"), sem vínculo ativo nem para horário de mais de 3 dias atrás; no máximo 2 por pet por clínica por dia (revisão v0.3 da E3-06: as faltas de outra clínica do mesmo pet não contam). Copy fixa, sem o nome da clínica. `dados`: `{ parceiroId, petId, petNome, agendamentoId, url }`.
  - **Rota (`src/notificacao/rotas-notificacao.ts` do app):** `AGENDAMENTO_FALTA` abre hoje o inbox (`/screens/notifications`, como os outros da clínica). Quando a tela do agendamento existir, mapeie para o detalhe com `dados.agendamentoId` (o mesmo `id` de `GET /tutor/clinica/agendamentos/:id`) e avise para a API trocar a rota no catálogo.
  - Canal Android `cuidado`; categoria de preferência `CLINICO` (o opt-out cala o push, o inbox fica); sem e-mail.
- **Pronto quando (app):** o detalhe de um agendamento em falta mostra a falta com o botão "Contar o que houve" seguindo `podeJustificar`, a família vê sem o botão, o 409 vira a mensagem da API e a notificação abre o inbox.

### 3.9 Pendências (E1-06)

`GET /parceiro/portal/pendencias?modulo=CLINICA` ganhou `faltasSemJustificativa` (tom ATENCAO, rota `/veterinario/faltas`, para quem escreve na agenda): faltas dos últimos 30 dias sem justificativa com contato, um por atendimento, de paciente ativo e sem óbito. O selo abre o painel de faltas com `semJustificativa=true`.

### 3.10 Erros desta seção

| `codigo` | Status | Quando | Extra |
|---|---|---|---|
| `FALTA_ANTES_DO_HORARIO` | 409 | Falta antes do início | `inicio` |
| `FALTA_JA_JUSTIFICADA` | 409 | App: a clínica já registrou contato (ou ele já justificou) | |
| `FALTA_ENCERRADA` | 409 | Óbito registrado: sem justificativa nova nem reagendar | |
| `FALTA_JA_REAGENDADA` | 409 | O reagendamento ainda vale | `reagendadoComoId` |
| `JUSTIFICATIVA_INVALIDA` | 400 | Motivo e canal não batem, data do óbito errada | `reason` |
| `JUSTIFICATIVAS_NO_LIMITE` | 409 | 20 registros na falta | `maxJustificativas` |
| `FALTAS_PERIODO_INVALIDO` | 400 | Painel invertido ou de mais de 366 dias | `maxDias` |
| `FALTA_TAXA_EXCEDIDA` | 429 | App: mais de 30 justificativas na hora | `limite`, `tenteDeNovoEmSegundos` |
| `FALTAS_LEITURA_TAXA_EXCEDIDA` | 429 | Painel ou histórico: mais de 300 leituras na hora (um balde cada) | `limite`, `tenteDeNovoEmSegundos` |
| `CLIENTE_ANONIMIZADO` | 409 | Justificar (ou marcar com justificativa) num cliente anonimizado | |
| `SEM_PERMISSAO` | 403 | Óbito sem `paciente.escrever` (e o de sempre, sem a permissão da rota) | `permissao` |
| `AGENDAMENTO_STATUS_INVALIDO` | 409 | Marcar, justificar ou reagendar na situação errada | `status`, `acao` (`falta`, `justificar`, `reagendar`, `ler-falta`) |
| `AGENDAMENTO_ALTERADO` | 409 | `versao` velha ao marcar, o paciente mesclado no meio, ou um agendamento que sumiu no meio do lote (`atual: []`) | `atual` |
| (sem `codigo`) | 403 | Recurso de outra clínica; no lote, um id alheio | |

### 3.11 Pronto quando (portal)

O botão "falta" do card (só depois do horário) usa a rota com `versao` e o diálogo manda a justificativa junto (o "óbito" só para quem tem `paciente.escrever`); o histórico mostra a vigente cortada e abre a falta inteira no clique; "Fechar o turno" manda os ids e mostra os `ignorados`; o diálogo reaberto lê `GET .../falta`; o painel e o histórico leem as rotas (sem `resumirFaltas`, `aceitaReagendamento` nem `LIMITE_REINCIDENCIA` locais); reagendar usa as sugestões e a rota nova; o óbito mostra os horários cancelados; o selo de pendência abre o painel.

---

## 4. Avisos ao responsável (E3-06)

O "avisar o responsável" da agenda passa a valer: a recepção marca a opção ao criar, mover ou cancelar, o aviso sai pelo app um a dois minutos depois (fora da janela do desfazer) e fica o **comprovante** (o que saiu, quando, por qual canal, o texto que a recepção escreveu e se o push chegou). Junto vêm a véspera automática às 18h e o "sem canal no app" para quem a clínica precisa ligar. Substitui no mock o texto da remarcação que "é digitado, confirmado e some" (L8 do doc 01).

Convenções das seções 1 e 2 valem aqui.

### 4.1 Pedir o aviso (portal)

- **Onde:** `POST /parceiro/portal/clinica/agendamentos` (criar), `POST .../:id/mover` e `POST .../:id/cancelar` aceitam `avisarResponsavel?: boolean` e `mensagem?: string` (até 500 caracteres; espaços e caracteres invisíveis são aparados). O agendamento da vacinação (E4-04) e o reagendar da falta (E3-03) nunca avisam por aqui.
- **Como contar os 500 (revisão v0.3):** a API conta como o banco, em code points, depois de aparar: emoji com seletor de variação ("❤️", "☺️") conta 2. O contador da tela conta com `[...texto.trim()].length` (nunca `texto.length`, que erra para os dois lados). Passou: 400 de validação (`message: ['mensagem deve ter no máximo 500 caracteres']`). Vale também para a `observacao` da agenda (2.6 e 2.7) e da falta (3.2, 3.3, 3.5 e a do app em 3.8).
- **Mensagem sem o pedido:** 400 `AGENDAMENTO_INVALIDO` com `reason: MENSAGEM_SEM_AVISO` (o texto não se perde calado). Habilite o campo de mensagem só com o interruptor ligado.
- **Mover que só troca de sala, com mensagem (revisão v0.3):** 400 `AGENDAMENTO_INVALIDO` com `reason: SEM_MUDANCA_A_AVISAR`, nada gravado (trocar de sala não muda nada para o responsável, e o texto se perderia calado). No arrastar entre colunas de sala (`destino.trocarSala`) e no mover que mantém dia, hora e profissional, esconda o interruptor e o campo. Com o interruptor ligado e sem mensagem, o mesmo mover segue gravando com `aviso: null`.
- **Resposta:** a `MutacaoDaAgendaDto` ganha `aviso`: `null` quando não pediu (ou quando o mover só trocou de sala, que não muda nada para o responsável); pedido, `{ id, tipo, situacao: 'PENDENTE', liberarEm, semCanalNoApp }`.
  - `tipo`: `AGENDAMENTO_CRIADO_PELA_CLINICA`, `AGENDAMENTO_REMARCADO` (mudou dia, hora ou profissional) ou `AGENDAMENTO_CANCELADO_PELA_CLINICA`.
  - `semCanalNoApp: true`: o paciente não tem vínculo ativo com o app (ou o pet está inativo, ou não há ninguém para receber). **Mostre na hora "Sem canal no app: ligue para o responsável"**, com o telefone do cliente.
  - `liberarEm`: quando ele sai. **O "Desfazer" (8 s na tela) cancela o aviso na hora**: o comprovante já volta `NAO_ENVIADO` com `SUPERADO` (revisão v0.3: antes ficava na fila até `liberarEm`, e mover de novo para o mesmo horário, ou cancelar de novo sem aviso, fazia o pedido desfeito sair). Repetir o gesto depois do desfazer só manda o pedido novo, se houver. Quando a recepção muda de novo o mesmo horário sem desfazer, também só sai o que ainda é verdade.
- **O push nunca leva a mensagem** (D2): o título e o corpo são fixos, no idioma do aparelho, só com o nome do pet e a hora da clínica ("O horário de Rex mudou. Agora é 27/10 às 09:00. A clínica deixou uma mensagem."). A mensagem aparece citada dentro do app e no comprovante. Diga isso na tela ("a mensagem aparece no app, não na notificação").
- **Teto:** no máximo 4 avisos por pet por clínica por dia (o cancelamento conta à parte). Passou: o comprovante diz `TETO_DO_DIA`.

### 4.2 O comprovante de um agendamento (portal)

`GET /parceiro/portal/clinica/agendamentos/:id/avisos?cursor=&limit=` (`agenda.ler`; até 20 por página) devolve `{ agendamentoId, fuso, semCanalNoApp, itens, proximoCursor }`, do mais recente.
- Os avisos são do **atendimento**: no grupo de duas salas, qualquer perna devolve os da principal (`agendamentoId`).
- `semCanalNoApp` é o estado de **agora** (o vínculo pode ter mudado desde o pedido). Use para o selo "sem canal no app" no drawer do agendamento.
- Cada item (`AvisoAoResponsavelDto`): `{ id, tipo, situacao, canal, motivoSemAviso, mensagemDaClinica, idiomaDaMensagem, inicioAvisado, inicioAnterior, automatico, enviadoPorId, criadoEm, liberarEm, processadoEm, entrega }`.
  - `situacao`: `PENDENTE` (na fila), `ENVIADO` (saiu pelo app, `canal: PUSH_INBOX`) ou `NAO_ENVIADO` (`canal: NENHUM`, com `motivoSemAviso`).
  - `motivoSemAviso`, com o texto sugerido: `SEM_CANAL_NO_APP` ("sem canal no app: ligue"), `NAO_AVISAR` ("não avisado: óbito ou paciente inativo"), `TETO_DO_DIA` ("limite de avisos do dia"), `SUPERADO` ("desfeito ou mudou antes de sair"), `FORA_DO_PRAZO` ("o horário já tinha passado"), `FALHOU` ("não foi possível avisar").
  - `entrega` (só do que saiu, o push do dono): `PENDENTE` (ainda saindo, ou segurado pela madrugada do aparelho), `SO_NA_CAIXA` (nenhum aparelho com push: está na caixa de avisos do app), `ENVIADO` (aceito, sem recibo ainda), `ENTREGUE` (recibo ok) ou `FALHOU`.
  - `automatico: true`: a véspera e a falta (ninguém da clínica pediu; `enviadoPorId: null`). `enviadoPorId` é o usuário da equipe; resolva o nome pela equipe que o portal já carrega.
  - `inicioAvisado` é o horário que o aviso conta; `inicioAnterior` só no remarcado.
- **A falta (E3-03) também deixa comprovante:** o aviso `AGENDAMENTO_FALTA` (automático) aparece aqui, inclusive o "não avisado" do óbito (`NAO_AVISAR`).

### 4.3 O rastro da clínica (portal)

`GET /parceiro/portal/clinica/avisos?de=&ate=&tipo=&situacao=&cursor=&limit=` (`agenda.ler`; até 50 por página) devolve `{ fuso, de, ate, itens, proximoCursor }`, do mais recente.
- Período pelo dia em que o aviso foi pedido, na parede da clínica: padrão hoje; `ate` padrão o `de`; **até 31 dias** (400 `AVISOS_PERIODO_INVALIDO` com `maxDias`). Datas de 2000 a 2100, como a agenda.
- `tipo`: um dos 6 da agenda e da fila (os 3 do ato, `AGENDAMENTO_LEMBRETE_VESPERA`, `AGENDAMENTO_FALTA` e, desde a E3-04, `FILA_VAGA_OFERECIDA`); `situacao`: `PENDENTE`, `ENVIADO` ou `NAO_ENVIADO`. Mudou o filtro, descarte o cursor (o cursor de outro filtro dá 400 `CURSOR_INVALIDO`).
- Cada item é o do 4.2 mais `agendamentoId`, `filaId` (a oferta da fila, seção 5; `agendamentoId` nulo), `paciente: { id, nome }` e `mensagemCortada`: a mensagem vem **cortada em 140 caracteres** (mostre "..." e abra o comprovante do agendamento para ler inteira).
- **Taxa:** as duas leituras somam 300 por pessoa por hora: 429 `AVISOS_LEITURA_TAXA_EXCEDIDA` com `limite` e `tenteDeNovoEmSegundos`. Não releia em laço; atualize ao abrir o drawer e depois de uma escrita com aviso.

### 4.4 A véspera (automática)

Às 18h da véspera, no fuso da clínica, os agendamentos de amanhã **ainda não confirmados** recebem `AGENDAMENTO_LEMBRETE_VESPERA` (um por atendimento, uma vez). Não sai para quem já confirmou, para quem recebeu o "criado" ou o "remarcado" depois das 18h (seriam dois avisos do mesmo horário), nem para clínica com o módulo Clínica suspenso, desligado ou com o teste vencido. Não há tela para isso no portal: a véspera aparece no comprovante como automática.

### 4.5 App do responsável (`petjourney-app`)

- **14 tipos novos na leva única** (D1): os registros do app são `Record` fechados, então os tipos da agenda e do pedido online nascem juntos, mesmo os que só vão disparar com a spec dona.
  - Ao responsável (categoria `CLINICO`, canal Android `cuidado`, sem e-mail; disparam já): `AGENDAMENTO_CRIADO_PELA_CLINICA`, `AGENDAMENTO_LEMBRETE_VESPERA`, `AGENDAMENTO_REMARCADO` e `AGENDAMENTO_CANCELADO_PELA_CLINICA`.
  - Ao responsável, `FILA_VAGA_OFERECIDA` dispara desde a E3-04 (seção 5.7). `PEDIDO_ACEITO`, `PEDIDO_MARCADO_EM_OUTRO_HORARIO` e `PEDIDO_RECUSADO` disparam desde a E3-05 (seção 6.6). `PRE_CONSULTA_PENDENTE` dispara desde a E3-07 (seção 7.6). Ainda sem disparo (chega com a spec dona): `RETORNO_PENDENTE` (E4-01).
  - Para a equipe (categoria `PARCEIRO`, canal `conta`, sem e-mail): `FILA_OFERTA_ACEITA` dispara desde a E3-04 (5.8); `PRE_CONSULTA_RESPONDIDA` dispara desde a E3-07 (7.6); ainda sem disparo: `PEDIDO_HORARIO_RECEBIDO` e `AGENDAMENTO_CANCELADO_PELO_RESPONSAVEL`.
- **Registros em `services/notificacao/rotas-notificacao.ts`** (sem eles o `tsc` do app quebra e o `audit:notificacao-rotas` da API fica vermelho):
  - `ROTA_POR_TIPO`: os 14 abrem hoje o inbox (`/screens/notifications`), como os outros da clínica. Quando a tela do agendamento existir, mapeie os 4 da agenda para o detalhe com `dados.agendamentoId` e avise para a API trocar a rota no catálogo;
  - `AFETA_HOME_POR_TIPO`: `false` nos 14 (nenhum mexe no feed de lembretes da home);
  - `PERFIL_POR_TIPO`: `"tutor"` nos 10 ao responsável; `null` nos 4 da equipe (como os `PARCEIRO_*`, enquanto a rota for o inbox).
- **`dados`** dos 4 que disparam: `{ parceiroId, agendamentoId, avisoId, petId, petNome, inicio, temMensagem, url }`, mais `inicioAnterior` e `soProfissional` (só o profissional mudou, o horário é o mesmo) no remarcado, `motivo` no cancelado e `podeConfirmar` na véspera. A família que lê o pet recebe com `paraMembro: true` (sem o convite a confirmar, sem o "fale com a clínica"). `inicio` vem com o offset da clínica: mostre a hora como veio.
- **A mensagem da clínica (D2):** quando `temMensagem: true`, a tela do aviso pede `GET /tutor/clinica/avisos/:notificacaoId` (o `id` da notificação do inbox) e recebe `{ avisoId, tipo, agendamentoId, mensagem: { texto, idioma } | null, enviadoEm }`. **Mostre citada, como texto da clínica, no idioma em que ela escreveu (`idioma`), sem traduzir.** Só quem recebeu a notificação e ainda lê o agendamento: de outra pessoa, ou com o vínculo encerrado, 403 (mostre "esta mensagem não está mais disponível"). Até 300 por pessoa por hora: 429 `AVISOS_LEITURA_TAXA_EXCEDIDA`.
  - **Texto puro, sem link (revisão v0.3):** renderize `mensagem.texto` como texto simples. Não transforme endereço, telefone ou e-mail em link clicável (nada de autolink, `dataDetectorTypes` ou Markdown). O texto vem de um funcionário do parceiro e aparece com a marca da clínica: um link ali é um caminho de phishing.
  - **A família também lê (decidido pelo Nicolas em 2026-10-27):** quem recebe com `paraMembro: true` e lê o pet abre a mesma mensagem, inteira. A copy da família pode dizer "a clínica deixou uma mensagem".
- **Véspera:** com `podeConfirmar: true`, o toque deve levar a confirmar a presença (2.10); com `false`, só ao detalhe.
- **Pronto quando (app):** os 14 tipos estão nos três registros (o `tsc` do app passa e o `audit:notificacao-rotas` da API fica verde), os 4 da agenda abrem o inbox com a copy da API, e a tela do aviso com `temMensagem` mostra o texto citado da rota nova, como texto puro e sem link (e o 403 vira "não está mais disponível").

### 4.6 Erros desta seção

| `codigo` | Status | Quando | Extra |
|---|---|---|---|
| `AGENDAMENTO_INVALIDO` | 400 | `mensagem` sem `avisarResponsavel: true` | `reason: MENSAGEM_SEM_AVISO` |
| `AGENDAMENTO_INVALIDO` | 400 | Mover que só troca de sala, com `mensagem` (nada gravado) | `reason: SEM_MUDANCA_A_AVISAR` |
| (validação) | 400 | `mensagem` ou `observacao` com mais de 500 code points depois de aparar | `message` |
| `AVISOS_PERIODO_INVALIDO` | 400 | Rastro invertido ou de mais de 31 dias | `maxDias` |
| `AVISOS_LEITURA_TAXA_EXCEDIDA` | 429 | Mais de 300 leituras na hora (clínica: comprovante e rastro juntos; app: a mensagem) | `limite`, `tenteDeNovoEmSegundos` |
| `CURSOR_INVALIDO` | 400 | Cursor adulterado ou de outro filtro | |
| (sem `codigo`) | 403 | Agendamento de outra clínica ou inexistente; no app, notificação de outra pessoa ou vínculo encerrado | |

### 4.7 Pronto quando (portal)

O diálogo de marcar, o arrastar e o cancelar têm o interruptor "Avisar o responsável" com o campo de mensagem (só com ele ligado); depois de gravar, a tela mostra "sai em 1 a 2 minutos" ou, com `semCanalNoApp`, "sem canal no app: ligue"; o drawer do agendamento lista o comprovante (situação, motivo, a mensagem inteira, quem pediu e a entrega do push) e o selo "sem canal no app"; o rastro da clínica lê a lista com período e filtros, com a mensagem cortada.

## 5. Fila de espera (E3-04)

Quem não achou horário entra na fila com as janelas que aceita (dia da semana e horário), o serviço, o profissional (ou qualquer um) e a prioridade. Quando um horário vaga (cancelamento pela recepção ou pelo app, remarcação, falta com tempo útil), **a API guarda a vaga e mostra quem cabe nela, na ordem da fila**; a recepção revê a mensagem e oferta, **ou a API oferta sozinha** ao primeiro da fila que tem o app (v0.4, ligada por padrão, desligável na política: 5.6); o responsável aceita pelo app dentro do prazo e o aceite cria o agendamento de forma atômica (CONFIRMADO, origem `FILA`). A posição ("sou o quantos?") é do servidor. Substitui no mock:
- o `waitlistRepository` inteiro (`listar`, `elegiveisPara`, `ofertar`, `responder`, `remover`, `adicionar`) e o `aoLiberarHorario` do store `fila.ts` (a vaga agora vem do servidor: `GET .../fila/vagas`);
- as regras de `domain/waitlist.ts` (`ordenarFila`, `posicoesDaFila`, `aFrenteDe`, `agruparJanelas`). **Apague a regra local quando ligar a rota**: o servidor devolve `posicao`, `aFrente` e `janelasAgrupadas` prontos. O prazo da oferta (`OFERTA_MINUTOS`) é o `ofertaDeVagaMinutos` da política (seção 1.6), nunca fixo na tela.

Convenções das seções 1 e 2 valem aqui. As janelas usam `diaSemana` de 0 (domingo) a 6 (sábado), como o expediente (1.4), e horas `HH:mm` (o fim aceita `24:00`).

### 5.1 Quem entra

- **Módulo Clínica** em todas as rotas da clínica. **Ler** (lista, detalhe, quem cabe, vagas): `agenda.ler`. **Gerir a fila** (entrar, remover, ofertar, registrar o sim ou o não do telefone): `fila.gerir` (recepção, veterinário, gestor e dono; a enfermagem lê e não oferta).
- Entrada, paciente, profissional ou tipo de outra clínica (ou que não existe): 403 **sem `codigo`**.
- **Taxa:** as escritas gastam o balde da agenda (600 por pessoa por hora, 429 `AGENDAMENTO_TAXA_EXCEDIDA`); as leituras têm balde próprio, 300 por pessoa por hora (429 `FILA_TAXA_EXCEDIDA` com `limite` e `tenteDeNovoEmSegundos`). Não releia em laço: recarregue depois de uma escrita e quando a tela volta ao foco.

### 5.2 A fila (lista e detalhe)

`GET /parceiro/portal/clinica/fila?situacao=&tipoId=&profissionalId=&limit=&cursor=` devolve `{ fuso, itens, aguardando, proximoCursor }`.
- `situacao=ATIVAS` (padrão): quem aguarda e quem está com oferta aberta, **na ordem da fila** (prioridade, depois antiguidade). `NAO_RESPONDERAM`: as ofertas que venceram nos últimos 7 dias, da mais recente (a recepção liga). Até 50 por página, por cursor; mudou o filtro, descarte o cursor.
- `profissionalId`: quem pediu esse profissional **ou qualquer um**. `aguardando`: quantos aguardam na clínica inteira (sem filtro).
- Cada item (`EntradaNaFilaDto`): `{ id, status, prioridade, origem, posicao, aFrente, paciente, tipoId, profissionalId, janelas, janelasAgrupadas, observacao, observacaoCortada, oferta, ofertas, agendamentoId, aceitaPor, aceitaPorId, ultimaRecusa, criadoEm }`.
  - v0.4, quem respondeu: `aceitaPor` (`APP` ou `RECEPCAO`) e `aceitaPorId` (quem da equipe registrou o "sim" do telefone; `null` pelo app). `ultimaRecusa`: `{ em, por, porId }` da última recusa (a vez ficou), ou `null`. Mostre "recusou pelo app em 10/11 14:02" ou "recusou por telefone (registrado por Ana)": o nome sai da equipe (E1-03) pelo `porId`.
  - `status`: `AGUARDANDO`, `OFERTADO`, `ACEITO`, `EXPIRADO` (a oferta venceu sem resposta: **sai da contagem**; a recepção pode ofertar de novo) ou `REMOVIDO`. A oferta vencida já vem `EXPIRADO`, mesmo antes de o servidor gravar.
  - `posicao` e `aFrente`: só de quem aguarda; com oferta aberta, `null` (o horário dele está resolvido, D1). Mostre "posição 3" e, no telefone, "há 2 na frente". A posição é da clínica inteira, qualquer que seja o filtro.
  - `janelasAgrupadas`: as janelas ditas de uma vez (`{ de, ate, inicio, fim }`, "seg. a sex. 14:00 a 18:00"); a semana começa na segunda (sábado e domingo seguidos fecham a semana).
  - `observacao`: interna da clínica, **cortada em 140 caracteres** na lista (`observacaoCortada`); a inteira está no detalhe.
  - `oferta` (só `OFERTADO` e `EXPIRADO`): `{ inicio, fim, profissionalId, expiraEm, mensagem, mensagemCortada, ofertadaEm, automatica, ofertadaPorId, aviso }`, com o relógio correndo até `expiraEm`. `automatica: true` (v0.4): a API ofertou sozinha, sem autor (`ofertadaPorId: null`) e com a mensagem padrão; mostre o selo "oferta automática" na linha. `aviso` é o comprovante da oferta (E3-06): `{ id, situacao, canal, motivoSemAviso, processadoEm }`; com `motivoSemAviso: SEM_CANAL_NO_APP`, mostre "sem canal no app: ligue".
  - O prazo pode cair **no dia seguinte**: a oferta feita das 22h às 8h (no fuso da clínica) só começa a contar às 8h (Q4). Quando `expiraEm` não for hoje, mostre a data junto da hora ("até amanhã 08:30").
- `GET /parceiro/portal/clinica/fila/:id`: a entrada com os textos inteiros e `comprovantes` (os avisos das ofertas dela, até 20, do mais recente: `{ id, situacao, canal, motivoSemAviso, mensagemDaClinica, inicioAvisado, destinatarios, criadoEm, processadoEm }`).

### 5.3 Entrar e remover

- `POST /parceiro/portal/clinica/fila` `{ pacienteId, tipoId, profissionalId?, prioridade?, janelas, observacao? }` (201): `prioridade` `NORMAL` (padrão), `PREFERENCIAL` ou `URGENTE`; `janelas` de 1 a 14; `observacao` até 500 (conta em code points, como a 4.1).
  - **Uma entrada viva por paciente e serviço:** 409 `FILA_JA_NA_FILA` com `entradaId` (abra a que já existe). No máximo 5 vivas por paciente e 500 por clínica: 409 `FILA_NO_LIMITE` com `limite` e `escopo` (`PACIENTE` ou `CLINICA`).
  - Janela com fim antes do início ou repetida: 400 `FILA_INVALIDA` com `reason` (`JANELA_INVERTIDA`, `JANELA_REPETIDA`). Paciente inativo ou com óbito: 409 `PACIENTE_INATIVO`; serviço inativo: 409 `TIPO_INATIVO`; profissional que não atende na agenda: 409 `PROFISSIONAL_INDISPONIVEL`.
- `DELETE /parceiro/portal/clinica/fila/:id` (204): tira da fila e **retira a oferta aberta** (o aviso que ainda não saiu não sai). Já removida: 204 sem mudar nada. Aceita: 409 `FILA_ENCERRADA`.
- **Óbito e anonimização tiram o paciente da fila sozinhos** (a oferta aberta é retirada, sem aviso). O mesclar leva a fila do duplicado para o que fica.

### 5.4 As vagas e quem cabe

- `GET /parceiro/portal/clinica/fila/vagas?de=&ate=` (padrão: hoje e os 13 dias seguintes; até 31 dias): `{ fuso, de, ate, itens }`. São **os horários liberados** (cancelamento pela recepção ou pelo app, remarcação, falta com tempo útil) **ainda livres e no futuro**, com alguém na fila que cabe, do mais cedo (até 50). Cada vaga: `{ id, profissionalId, inicio, fim, origem, agendamentoId, livreAte, candidatos, totalCandidatos, ofertasAbertas, tentativasAutomaticas, ofertaManual }`.
  - Este é o "vaga aberta" do store, agora do servidor: a vaga liberada pelo **app** também aparece (antes a recepção nem ficava sabendo). O selo "vagas para a fila" do menu é o contador `vagasParaAFila` (5.8); em cada vaga, os 3 primeiros candidatos com o botão "Ofertar" (`totalCandidatos` diz quantos cabem ao todo).
  - v0.4: `tentativasAutomaticas` (quantas ofertas a API já fez sozinha para esta vaga, até 5) e `ofertaManual` (a recepção já ofertou este horário: a API não mexe mais nele). Mostre "oferta automática: 2 de 5" e, com `ofertaManual`, nada.
  - O desfazer (8 s) de um cancelamento devolve o horário: a vaga some sozinha da lista.
  - `ofertasAbertas`: quantas ofertas já estão abertas para esse horário (pode ofertar a mais de uma pessoa: quem aceitar primeiro leva, D2).
- `GET /parceiro/portal/clinica/fila/elegiveis?inicio=&profissionalId=`: quem cabe em qualquer horário (o arrastar para uma coluna vazia, por exemplo), até 20: `{ inicio, profissionalId, vagaLivre, livreAte, candidatos, totalCandidatos }`. O `+` do offset vai como `%2B` na URL (use `encodeURIComponent`).
- **Cada candidato:** `{ entradaId, paciente, prioridade, posicao, tipoId, profissionalId, janelasAgrupadas, ofertas, jaOfertadoNesteHorario, temCanalNoApp }`, na ordem da fila: janela do responsável com o início do horário, o profissional pedido (ou qualquer um), o serviço ativo cabendo no tempo livre (`livreAte`). Quem já recebeu oferta deste mesmo horário e não levou (recusou) vai para o fim, com `jaOfertadoNesteHorario: true`: "a vaga volta para o próximo da fila". Com `temCanalNoApp: false`, a oferta só chega por telefone.

### 5.5 Ofertar

`POST /parceiro/portal/clinica/fila/:id/ofertar` `{ inicio, profissionalId, mensagem? }` (200) devolve `{ entrada, aviso, conflitos }`.
- **A mensagem é da clínica (D5), revista na tela, com o prazo dentro do texto** (o `FilaOfertaDialog` já monta a prévia; use o `ofertaDeVagaMinutos` da política). Até 500 code points. Ela vai ao comprovante e à tela do app, **nunca ao push**.
- O prazo (`entrada.oferta.expiraEm`) é o da política e **nunca passa do início do horário**. **Q4 (v0.4):** os minutos do prazo não correm das 22h às 8h no fuso da clínica: a oferta feita às 23h com 30 min vence às 8h30; a das 21h50, às 8h20 (10 min antes das 22h, 20 depois das 8h). Na prévia do diálogo, use o `expiraEm` que a API devolver, não a conta da tela.
- Ofertar à mão **assume o horário**: as vagas liberadas que ele cobre saem da oferta automática de vez (`ofertaManual: true` na 5.4).
- Reofertar a vencida (`EXPIRADO`) de quem já entrou de novo no mesmo serviço: 409 `FILA_JA_NA_FILA` com `entradaId` (oferte a entrada nova).
- **A oferta não segura o horário (D2):** a recepção continua podendo marcar por cima (o dia mostra a reserva da oferta e o conflito `pedido-pendente`); se marcar, o aceite do responsável dá 409 `VAGA_JA_PREENCHIDA` e ele continua na fila. Ofertar o mesmo horário a duas pessoas é permitido: o primeiro aceite leva.
- `aviso`: `{ id, situacao: 'PENDENTE', liberarEm, semCanalNoApp }`. O aviso `FILA_VAGA_OFERECIDA` sai no próximo minuto, se a oferta ainda estiver aberta; com `semCanalNoApp: true`, mostre "sem canal no app: ligue para o responsável".
- `conflitos`: os avisos do horário (fora do expediente, sala, outra oferta); nada bloqueia, só o feriado fechado (409 `CONFLITO_BLOQUEANTE`, sem opção de contornar aqui: marque direto na agenda).
- **Erros:** oferta aberta e no prazo (D3, uma por entrada): 409 `OFERTA_JA_ABERTA` com `ofertaExpiraEm`; o profissional já tem agendamento no horário: 409 `VAGA_JA_PREENCHIDA`; horário que já passou: 400 `FILA_INVALIDA` `INICIO_NO_PASSADO`; entrada aceita ou removida: 409 `FILA_ENCERRADA`; com mensagem e cliente anonimizado: 409 `CLIENTE_ANONIMIZADO`. Oferta vencida (`EXPIRADO`) pode ser ofertada de novo.

### 5.6 O sim e o não pelo telefone (portal)

Para quem não tem o app (ou respondeu ligando):
- `POST /parceiro/portal/clinica/fila/:id/oferta/aceitar` (200) devolve `{ entrada, agendamento, remarcadoDe }` (o `MutacaoDaAgendaDto` da seção 2, **sem `desfazerToken`**: o aceite não se desfaz; cancela-se). O agendamento nasce `CONFIRMADO` pela recepção, origem `FILA`, e a entrada guarda quem registrou (`aceitaPorId`). Aceitar de novo devolve o mesmo. Com `agendamentoAtual`, o aceite troca o horário dele em vez de criar (G2, 5.11).
  - v0.4: pede **também `agenda.escrever`** (o aceite cria agendamento): sem ela, 403 `SEM_PERMISSAO` com `permissao: agenda.escrever`. Esconda o botão para quem não tem as duas. O balde da agenda conta antes de qualquer conferência (429 `AGENDAMENTO_TAXA_EXCEDIDA`).
- `POST /parceiro/portal/clinica/fila/:id/oferta/recusar` (200): volta a `AGUARDANDO` com a mesma vez (a antiguidade fica) e grava `ultimaRecusa` com quem registrou.

### 5.6b Oferta automática (v0.4, Q1)

Com `ofertaAutomaticaFila` ligada na política (1.6, padrão), **a API oferta sozinha** cada vaga liberada (a da 5.4) ao primeiro da fila que cabe nela, de minuto em minuto:
- só a quem **o push alcança**: vínculo ativo com a clínica, pet ativo e o dono com a conta ativa (v0.5; sem isso, a recepção liga: o urgente sem app continua na frente da lista, mas a API pula para o próximo com app). O `temCanalNoApp` dos candidatos usa a mesma regra;
- nunca de novo a quem já recebeu oferta daquele horário (recusou ou deixou vencer);
- uma oferta automática por vaga por vez; nenhuma se já há oferta aberta para o horário (manual ou automática); vencida ou recusada, passa ao próximo, **até 5 por vaga** (`tentativasAutomaticas`);
- só vaga livre, nos próximos 7 dias e com antecedência: o prazo inteiro mais 60 min antes do início; sem conflito além de `info` (fora do expediente, bloqueio, sala: a API não oferta sozinha, a recepção decide);
- **nada sai das 22h às 8h** no fuso da clínica: a vaga espera as 8h (Q4);
- a oferta manual tem precedência: o horário que a recepção ofertou sai do automático de vez (`ofertaManual`).

A oferta automática é igual à manual para o responsável (o mesmo push `FILA_VAGA_OFERECIDA`, o mesmo aceite e recusa), com `automatica: true`, sem autor, e com a **mensagem padrão no idioma em que a clínica escreve** (`idiomaDosTextos`), citada no app e guardada no comprovante. pt-BR: "Abriu um horário que combina com os dias e horários que você deixou na fila de espera. Se puder vir, aceite pelo app antes do prazo. Se não puder, recuse: você continua na fila, no mesmo lugar." (os 6 idiomas em `src/agenda/fila/fila-mensagens.ts`; en-GB próprio). A recepção vê a linha com o selo "oferta automática", o comprovante e o relógio, e pode retirar (DELETE) ou registrar o sim e o não do telefone como numa oferta dela.

**Vaga preenchida:** se a recepção marca alguém por cima de um horário ofertado (manual ou automático), o push da oferta não sai mais e, no minuto seguinte, a entrada **volta a aguardar sem perder a vez** (o mesmo do 409 `VAGA_JA_PREENCHIDA` no aceite, sem esperar o responsável tentar). Quem tocar "aceitar" depois disso (até 24 h, ou até a próxima oferta) recebe o **409 `VAGA_JA_PREENCHIDA`**, não o 410 (v0.5). A vaga que alguém ocupou só volta a ser olhada pela API em 1 h; a vaga sem ninguém que caiba, em 5, 15, 30 e depois 60 min: a oferta automática pode levar até 1 h para sair depois que alguém novo entra na fila.
- Erros do aceite: 410 `OFERTA_EXPIRADA` (venceu, foi retirada ou trocada); 409 `VAGA_JA_PREENCHIDA` com `reason` (`PREENCHIDA`, `PROFISSIONAL_INDISPONIVEL`, `TIPO_INATIVO`, `SALA_INATIVA`, `BLOQUEANTE`): o horário não existe mais e a entrada **volta a aguardar sem perder a vez**; 409 `PACIENTE_INATIVO`.
- A sala do agendamento é a padrão do profissional quando serve ao serviço; senão, a primeira que serve (o `salaPara` do portal, agora no servidor).

### 5.7 App do responsável (`petjourney-app`)

Rotas sob `/tutor/clinica/fila`, só para pets com **vínculo ATIVO** com a clínica. Dono e família leem; **entrar, sair, aceitar e recusar são do dono** (a família recebe 403 `SOMENTE_LEITURA`). Nada interno da clínica: sem observação, prioridade nem comprovante.
- `GET /tutor/clinica/fila?petId=`: `{ itens }` (até 50): aguardando, com oferta e as que venceram nos últimos 7 dias. Cada item (`EntradaDoResponsavelDto`): `{ id, clinica: { id, nome, fuso }, pet, servico: { id, nome, kind, duracaoMinutos }, profissional (null = qualquer), janelas, janelasAgrupadas, status, posicao, aFrente, origem, criadoEm, oferta, agendamentoId, podeAceitar, podeRecusar, podeSair, somenteLeitura }`.
  - `posicao` responde "sou o quantos?" na clínica; mostre também `aFrente` ("há 2 na frente").
  - `oferta`: `{ inicio, fim, expiraEm, profissional: { id, nome }, mensagemDaClinica: { texto, idioma } | null }`. **Mostre o relógio até `expiraEm`** e a mensagem citada, no idioma em que a clínica escreveu, **como texto puro, sem link** (a mesma regra da 4.5). Datas com o offset da clínica: mostre como vieram. Na oferta automática (v0.4) a mensagem é a padrão da clínica (5.6b); o contrato não muda. A oferta feita de madrugada vence na manhã seguinte (Q4): com `expiraEm` em outro dia, mostre a data ("responda até amanhã 08:30"); o push dela chega às 8h.
- `POST /tutor/clinica/fila` `{ petId, clinicaId, tipoId, profissionalId?, janelas }` (201, D6: o estado vazio da busca de horário): só serviços que a clínica oferece online (`ofertadoOnline`; outro: 400 `FILA_INVALIDA` `TIPO_FORA_DO_APP`); prioridade sempre normal. Pet inativo: 409 `PET_INATIVO`; clínica sem o módulo escrevendo: 403 `MODULO_INATIVO` ou `MODULO_SOMENTE_LEITURA`; os mesmos 409 da 5.3.
- `DELETE /tutor/clinica/fila/:id` (204): sair (retira a oferta aberta).
- `POST /tutor/clinica/fila/:id/oferta/aceitar` (200) devolve `{ entrada, agendamento, remarcadoDe }` (o `AgendamentoDoResponsavelDto` da 2.10): **o horário marcado e já confirmado**. Com `agendamentoAtual` na entrada, a oferta é uma troca ("trocar seu horário de X para Y") e o aceite muda o horário do agendamento que o pet já tinha (G2, 5.11). Leve à tela do agendamento. O duplo toque (ou dois aparelhos) devolve o mesmo agendamento. 410 `OFERTA_EXPIRADA`: "o prazo acabou" (a pessoa saiu da contagem; ofereça entrar de novo); 409 `VAGA_JA_PREENCHIDA`: "alguém ficou com este horário; você continua na fila, no mesmo lugar" (também quando a clínica já tinha retirado a oferta por esse motivo, v0.5).
- `POST /tutor/clinica/fila/:id/oferta/recusar` (200): volta a aguardar, sem perder a vez. Já aguardando: 200 sem mudar nada.
- **Taxa:** 30 ações por pessoa por hora (entrar, sair, aceitar, recusar) e 300 leituras: 429 `FILA_TAXA_EXCEDIDA` com `tenteDeNovoEmSegundos`.
- **Notificação `FILA_VAGA_OFERECIDA`** (já registrada na leva única da 4.5; agora dispara): `dados` `{ parceiroId, filaId, avisoId, petId, petNome, inicio, expiraEm, temMensagem, url }`; a família que lê o pet recebe com `paraMembro: true` (sem o "responda até"). Copy da API: "Abriu um horário para Rex. 10/11 às 10:00. Responda até 12:30.". **`ROTA_POR_TIPO` em `services/notificacao/rotas-notificacao.ts`:** hoje o inbox (`/screens/notifications`); quando a tela da fila existir, mapeie `FILA_VAGA_OFERECIDA` para ela com `dados.filaId` (o detalhe da oferta, com o relógio e o "Aceitar") e avise para a API trocar a rota no catálogo. A mensagem citada vem de `GET /tutor/clinica/avisos/:notificacaoId` (4.5), que agora devolve também `filaId`.
- **Pronto quando (app):** a lista mostra a posição, a oferta com o relógio e a mensagem citada (texto puro); aceitar leva ao agendamento confirmado; os 410 e 409 viram as mensagens acima; recusar e sair funcionam; a família vê e não tem os botões; o push de `FILA_VAGA_OFERECIDA` abre a oferta (ou o inbox, até a tela existir).

### 5.8 Pendências (E1-06)

Três contadores em `GET /parceiro/portal/pendencias` (módulo Clínica, `fila.gerir`, rota `/veterinario/fila`): `fila` (quem aguarda; tom neutro), `filaComOferta` (ofertas abertas no prazo, esperando resposta; tom de atenção) e, desde a v0.4 (Q2), `vagasParaAFila` (vagas liberadas ainda livres e no futuro, nas duas semanas da tela de vagas, com pelo menos um candidato; tom de atenção). **`vagasParaAFila` conta até 50**: com 50, mostre "50+". Texto do catálogo do portal: "vagas para a fila" (a chave é o nome do contador). A equipe com `fila.gerir` recebe `FILA_OFERTA_ACEITA` (categoria `PARCEIRO`) quando o responsável aceita pelo app (não quando a própria recepção registra o sim).

### 5.9 Erros desta seção

| `codigo` | Status | Quando | Extra |
|---|---|---|---|
| `FILA_INVALIDA` | 400 | Janela invertida ou repetida; oferta no passado ou além de 2 anos; serviço fora do app; período das vagas acima de 31 dias | `reason` (`JANELA_INVERTIDA`, `JANELA_REPETIDA`, `INICIO_NO_PASSADO`, `INICIO_FORA_DO_HORIZONTE`, `TIPO_FORA_DO_APP`, `PERIODO_INVALIDO`) |
| `FILA_JA_NA_FILA` | 409 | O paciente já espera esse serviço; ou reofertar a vencida de quem já entrou de novo nele (v0.4) | `entradaId` |
| `SEM_PERMISSAO` | 403 | O sim do telefone sem `agenda.escrever` (v0.4) | `permissao` |
| `FILA_NO_LIMITE` | 409 | 5 vivas por paciente ou 500 por clínica | `limite`, `escopo` |
| `FILA_ENCERRADA` | 409 | A entrada já foi aceita ou removida | `status` |
| `OFERTA_JA_ABERTA` | 409 | Ofertar com uma oferta aberta e no prazo (D3) | `ofertaExpiraEm` |
| `VAGA_JA_PREENCHIDA` | 409 | Ofertar horário ocupado (ou com um pedido online pendente, G2); aceitar quando alguém já ficou com ele (a entrada volta a aguardar) | `reason` (`PREENCHIDA`, `PEDIDO_PENDENTE` na oferta) |
| `FILA_HORARIO_NAO_E_MAIS_CEDO` | 409 | G2: ofertar (ou aceitar) um horário que não é antes do que o paciente já tem no serviço; no aceite, a entrada volta a aguardar | `agendamentoId`, `inicioAtual` |
| `OFERTA_EXPIRADA` | 410 | Aceitar ou recusar oferta vencida, retirada ou trocada | |
| `FILA_TAXA_EXCEDIDA` | 429 | Leituras da fila (300 por hora) ou ações do app (30 por hora) | `limite`, `tenteDeNovoEmSegundos` |
| `CONFLITO_BLOQUEANTE` | 409 | Ofertar num feriado fechado | `conflitos` |
| `PACIENTE_INATIVO`, `TIPO_INATIVO`, `PROFISSIONAL_INDISPONIVEL`, `CLIENTE_ANONIMIZADO`, `PET_INATIVO`, `SOMENTE_LEITURA` | 409/403 | Como nas seções 2 e 3 | |
| (sem `codigo`) | 403 | Entrada, paciente, profissional ou tipo de outra clínica; no app, entrada de pet que a pessoa não lê | |

### 5.10 Pronto quando (portal)

A tela da fila lista as ativas na ordem com a posição e as janelas agrupadas, e a aba "não responderam"; "entrar na fila" funciona pela tela (L7) com os 409 tratados; o selo "vagas para a fila" abre as vagas liberadas com os primeiros candidatos; o diálogo de oferta tem a prévia da mensagem com o prazo (L6), mostra "sai em 1 minuto" ou "sem canal no app: ligue" e os conflitos; a linha ofertada mostra o relógio e o comprovante; o sim e o não do telefone funcionam; nenhuma regra de `domain/waitlist.ts` ficou no portal. v0.4: a linha da oferta automática tem o selo "oferta automática"; a vaga mostra "oferta automática: N de 5"; a política tem o interruptor; o selo do menu usa `vagasParaAFila` (com "50+"); o prazo que cai no dia seguinte mostra a data; a linha mostra quem recusou ou aceitou pelo telefone; o botão "registrar o sim" some sem `agenda.escrever`. G2 (5.11): a linha de quem já tem horário mostra "tem horário em X, quer antes"; o diálogo de oferta diz "trocar de X para Y"; o 409 `FILA_HORARIO_NAO_E_MAIS_CEDO` vira a mensagem da tabela; o "sim" do telefone mostra a troca.

### 5.11 Correção do G2 (28/10): só horário mais cedo, e o aceite troca o horário

Decisão do gerente (opção B, "me avise se abrir antes"): o paciente que **já tem um agendamento do mesmo serviço** continua na fila, mas só recebe horário **mais cedo** que ele. Vale para a oferta manual, para a automática, para a lista de vagas e para o contador `vagasParaAFila`.
- **`agendamentoAtual`** (novo, nas entradas vivas do portal e do app): `{ agendamentoId, inicio }` ou `null`. É o agendamento mais cedo, futuro e ainda não começado (AGENDADO ou CONFIRMADO) do mesmo paciente e serviço, fora os de origem `RETORNO`. A API calcula na leitura, nada é guardado: se a clínica cancela esse agendamento, o campo volta `null` e a entrada passa a valer para qualquer horário.
  - Portal, na linha: "tem horário em 12/11 10:00; quer antes". Nas vagas e no "quem cabe", ele só aparece nas vagas que começam antes de `agendamentoAtual.inicio`.
  - Ofertar no mesmo horário ou depois: 409 **`FILA_HORARIO_NAO_E_MAIS_CEDO`** com `agendamentoId` e `inicioAtual`.
- **A oferta mostra as duas datas.** Com `agendamentoAtual`, o diálogo e a linha da oferta dizem "trocar o horário de `agendamentoAtual.inicio` para `oferta.inicio`". O push `FILA_VAGA_OFERECIDA` traz `dados.inicioAtual` e a copy da API vira "Trocar seu horário de 12/11 às 10:00 para 10/11 às 09:00. Responda até 12:30." nos 6 idiomas (en-GB: "Move your appointment from ... to .... Reply by 12:30."). Sem horário atual, nada muda.
- **O aceite remarca, não cria.** Com `agendamentoAtual`, aceitar (pelo app ou pelo "sim" do telefone) **troca o horário do agendamento que já existe**, com o mesmo id. A pré-consulta, a confirmação e o histórico vão junto, e ele fica **CONFIRMADO** (aceitar já é confirmar). O horário de antes vira vaga para a fila.
  - Pelo app não sai aviso de remarcação: a tela já confirma.
  - Pelo telefone (portal), o responsável recebe o `AGENDAMENTO_REMARCADO` normal (4.5).
  - As respostas do aceite ganham **`remarcadoDe`**: o início de antes (com o offset da clínica), ou `null` quando o aceite criou um agendamento novo. Portal: `{ entrada, agendamento, remarcadoDe }`, e mostre "trocado de X para Y". App: `{ entrada, agendamento, remarcadoDe }`, e mostre "seu horário mudou para Y" na tela do agendamento (`agendamento.id` é o mesmo de antes).
  - Se o horário atual mudou no meio, a API refaz sozinha. Se ele passou a ser antes da oferta, o aceite responde 409 `FILA_HORARIO_NAO_E_MAIS_CEDO` e a entrada volta a aguardar sem perder a vez. App: "você já tem um horário antes deste; continua na fila".
- **Retorno e próxima dose tiram da fila.** Um agendamento de origem `RETORNO` (a próxima dose da vacina, o retorno do prontuário) tira o paciente da fila **daquele serviço**, sem aviso. A data é decisão clínica e a fila nunca a antecipa. A entrada some da lista (`REMOVIDO`, `removidaPor: null`).
- **O serviço aconteceu, a entrada sai.** Quando um atendimento do mesmo serviço é finalizado depois que a entrada nasceu, ela sai da fila sozinha (sem aviso, em até 5 minutos). Antes disso a API já não oferta vaga a ela.
- **Outras correções do G2 que a tela sente:**
  - M1: o pedido online pendente (a reserva da E3-05) **ocupa o horário**: a vaga não aparece na lista nem no contador, e ofertar ali dá 409 `VAGA_JA_PREENCHIDA` com `reason: PEDIDO_PENDENTE`.
  - BAIXO 5: quem sai da fila com oferta aberta devolve a vez da vaga à oferta automática na hora.
  - BAIXO 7: `PET_INATIVO` é **409** na fila e nos pedidos, e **403** nas rotas do prontuário do app. Trate pelo `codigo`, não pelo status.

Copy nova (6 idiomas, en-GB próprio) do erro `FILA_HORARIO_NAO_E_MAIS_CEDO`, pt-BR: "Este paciente já tem um horário deste serviço mais cedo. A fila só oferece um horário antes dele."

## 6. Agendamento online (E3-05)

O responsável **pede** horário e a clínica responde. Três superfícies: o **portal** (a configuração e a caixa da recepção), o **app** (quem tem a PetJourney pede pelo pet do app, e o aceite liga a clínica ao pet) e o **site** (`petjourney.health/agendar/<slug>` e `/pedido/<token>`, sem conta, com captcha). Substitui no mock: `PedidoDeHorario`, `AgendamentoOnline`, `ContatoDeEmergencia`, `CadastroMinimo`, `RecusaDoPedido`, `AvisoDoPedido` (`features/clinico/data/types.ts:525-701`), o `data/agendamento-online.ts` e as regras de `domain/pedidos.ts` (a API faz a conta: apague a regra local quando ligar a rota). **O `/publico` do portal vira `/public`.**

### 6.1 Quem entra

- **Portal:** módulo **Clínica**. A caixa (`GET /parceiro/portal/clinica/pedidos`, o detalhe, as sugestões, aceitar e recusar) pede `pedido.responder`; **aceitar pede também `agenda.escrever`** (cria agendamento; sem ela, 403 `SEM_PERMISSAO` com `permissao`). A configuração: ler com `agenda.ler`, salvar com `estabelecimento.editar` (DONO ou GESTOR).
- **App:** JWT. Só pets do **próprio responsável** (o dono). A família vê os pedidos do pet (com `?petId=`) e não age: 403 `SOMENTE_LEITURA`.
- **Site:** sem login. Escritas com captcha (Turnstile, header `X-Captcha-Token`), um balde por origem (IPv4 ou /64) e um por estabelecimento, e `Idempotency-Key` no pedido. **Chame a API pelo navegador do visitante**, não pelo servidor do site: o balde é por origem, e pelo proxy do Next todo visitante seria um IP só (a clínica travaria para todos).

### 6.2 Configuração (portal, "Agendamento online")

`GET /parceiro/portal/clinica/agendamento-online` e `PUT` (substitui tudo):
`{ ativo, permiteEscolherHorario, permiteMelhorHorario, aceitaPeloLink, aceitarSozinho, mostrarProfissionais, tipoIds[], profissionalIds[], antecedenciaMinimaHoras (0 a 168), horizonteDias (1 a 90), prazoDeRespostaHoras (1 a 72) }`; o GET traz também `perfilPublicado`, `slug` e `atualizadoEm`.
- Nasce **desligado**. Ligar exige a página publicada (E1-01), um serviço e um profissional e um dos dois modos: senão 400 `AGENDAMENTO_ONLINE_INVALIDO` com `reason` (`PERFIL_NAO_PUBLICADO`, `SEM_SERVICO`, `SEM_PROFISSIONAL`, `SEM_MODO`).
- Serviços: ativos, com "aparece no pedido online" (`ofertadoOnline`, 1.3) e nunca cirurgia nem emergência (`TIPO_FORA_DO_ONLINE` com `tipoId`). Profissionais: ativos e atendendo na agenda (`PROFISSIONAL_INDISPONIVEL` com `profissionalId`). Até 30 de cada; a ordem é a do app.
- `aceitaPeloLink: false`: só o app pede (a página do site some). `mostrarProfissionais: false`: o app e o site não veem quem atende; os horários saem por hora e a API escolhe o primeiro livre. `aceitarSozinho` (D6): o horário escolhido, ainda livre e sem aviso além de `info`, vira agendamento sem ninguém da recepção (`respondidoPor: AUTOMATICO`). **Desde 29/10 (6.12), só para o cliente da casa**; o texto da chave na tela de configuração muda.
- O link e o QR da página apontam para o site (`https://petjourney.health/agendar/<slug>`).

### 6.3 A clínica e os dias (app e site)

- **App:** `GET /tutor/clinica/estabelecimentos/:slug/agendamento-online` (o app abre pelo esquema `petjourneyapp://agendar/<slug>`, o botão "Peça pelo app" do site) ou `GET /tutor/clinica/clinicas/:parceiroId/agendamento-online` (de "Minhas clínicas"). **Site:** `GET /public/estabelecimentos/:slug/agendamento`.
  - `AgendamentoOnlineDaClinicaDto`: `{ clinicaId (null no site), slug, nome, fuso, escolherHorario, melhorHorario, aceitaPeloLink, prazoDeRespostaHoras, antecedenciaMinimaHoras, horizonteDias, maxPets (3), reservaMinutos, mostrarProfissionais, servicos[], profissionais[], kindDoMotivo, emergencia, pets? }`.
  - **Emergência é estado, não pedido (D7):** `emergencia` `{ abertoAgora, fechaEm, proximaAbertura, telefone, whatsapp, telefonePlantao, orientacao, mensagemForaDoHorario, idiomaDosTextos }`, calculado agora no fuso da clínica. O motivo "emergência" nunca vira pedido: mostre o contato.
  - `pets` (só no app): os pets do dono com `camposQueFaltam` (`NASCIMENTO`, `SEXO`) e `jaAcompanhado`. **Pergunte o que falta antes de seguir** (o pedido dá 422 `CADASTRO_INCOMPLETO` com `campos` e `petId`).
  - `kindDoMotivo`: o tipo de atendimento que cada motivo sugere (check-up, sintoma e outro são consulta; vacina, retorno, exame e banho têm o seu). Use para pré-selecionar o serviço.
  - **Sem oráculo:** inexistente, não publicada, fora do ar, sem o online (ou sem o link, no site): o mesmo 404 `CLINICA_NAO_AGENDA_PELO_APP`. O slug com forma inválida (no site) dá o mesmo 404 sem gastar o limite (nas escritas, depois do captcha); maiúsculas e espaços valem como o slug normal (e dividem o limite da clínica).
- **Dias:** app `GET /tutor/clinica/clinicas/:parceiroId/dias-para-pedido?tipoId=&petIds=a,b&profissionalId=&de=&ate=`; site `GET /public/estabelecimentos/:slug/agendamento/dias?tipoId=&quantidadeDePets=&profissionalId=&de=&ate=`.
  - Até **14 dias por leitura no app e 7 no site** (v0.3; o site pede a semana seguinte numa nova chamada), recortados a hoje e ao horizonte da clínica. No máximo 48 opções por dia. Cada dia: `{ data, situacao: COM_HORARIO | SEM_HORARIO | FECHADA, feriado, opcoes[] }`; cada opção `{ profissionalId, profissionalNome (null se a clínica não mostra), inicio, fim, porPet: [{ inicio, fim }] }`.
  - Só disponibilidade: nunca quem ocupa. O horário oferecido é um que a recepção marcaria sem aviso (nem o almoço; a carga do dia não tira horário); ~~o pedido pendente de outra pessoa já ocupa~~ **(mudou em 29/10, 6.12: pedido e reserva de ninguém tiram horário)**; dois ou três pets saem seguidos com o mesmo profissional; de meia em meia hora (15 min para serviço curto).
  - `buscaInterrompida: true`: o teto de avaliações acabou; leia os dias seguintes numa nova chamada. Cache de 15 s: depois de um 409 `HORARIO_INDISPONIVEL`, releia.

### 6.4 Reservar e pedir

1. **Reservar** (só no "escolher horário"): app `POST /tutor/clinica/pedidos/reservas` `{ clinicaId, tipoId, profissionalId?, inicio, petIds[] }`; site `POST /public/estabelecimentos/:slug/agendamento/reservas` `{ tipoId, profissionalId?, inicio, quantidadeDePets }`. 201 `{ reserva, expiraEm, profissionalId, porPet }`.
   - ~~Segura o horário por `reservaMinutos` (5 min) enquanto a pessoa revisa: mostre o relógio até `expiraEm`.~~ **Mudou em 29/10 (6.12):** a reserva confere o horário e o guarda para o pedido até `expiraEm`, **sem segurar contra os outros**; não mostre "horário reservado" nem o relógio como garantia. No app, uma reserva viva por pessoa por clínica: a nova solta a anterior.
   - **Site (v0.3):** a nova reserva só solta a anterior se o corpo trouxer `reservaAnterior` (o token da reserva que **este** visitante tinha; 43 caracteres). Mande sempre que o visitante trocar de horário; sem ele, a anterior fica presa até vencer. Motivo: atrás de um IP compartilhado (CGNAT da operadora) há várias pessoas, e a reserva de uma não pode apagar a da outra. No máximo 3 reservas vivas por origem (409 `RESERVAS_NO_LIMITE` com `escopo: ORIGEM`) e 30 por dia.
   - 409 `HORARIO_INDISPONIVEL`: a clínica marcou o horário (agendamento, bloqueio ou oferta da fila); releia os dias. 409 `RESERVAS_NO_LIMITE` (site): só `escopo: ORIGEM` (3 vivas ou 30 por dia da mesma origem; o teto da clínica saiu em 29/10). 400 `PEDIDO_INVALIDO` `FORA_DA_JANELA`.
   - Soltar: app `DELETE /tutor/clinica/pedidos/reservas/:reserva` (204); site `POST .../agendamento/reservas/liberar` `{ reservaToken }` (204). Sempre 204.
   - No site, `reserva` é um **token** (43 caracteres): guarde só na memória da página, nunca na URL.
2. **Pedir:** app `POST /tutor/clinica/pedidos`; site `POST /public/estabelecimentos/:slug/agendamento/pedidos`. Sempre com `Idempotency-Key` (UUID v4).
   - Corpo comum: `{ tipoId, motivo (CHECKUP, VACINA, SINTOMA, RETORNO, EXAME, BANHO, OUTRO), queixa? (até 1000), modo }`. `HORARIO_ESCOLHIDO`: `reservaId` (app) ou `reservaToken` (site). `MELHOR_HORARIO`: `preferencia { de, ate (até 31 dias), periodos: [MANHA, TARDE] (vazio = qualquer), profissionalId? }`.
   - App: `{ clinicaId, petIds[] (até 3, do dono), compartilharHistorico?, remarcaAgendamentoId? }`. **A tela diz que a clínica passa a acompanhar o pet quando aceitar (D1)**, e pede explícito para liberar diário e peso (`compartilharHistorico`). Devolve o `PedidoDoResponsavelDto` (6.6); com o aceite automático, já pode voltar `ACEITO`.
   - Site: `{ responsavel: { nome, telefone (com DDD), email? }, pets: [{ nome, especie, especieOutra? (obrigatório em OUTRO), nascimento?, sexo? }] (até 3), idioma? }`. Devolve `{ id, token, link, responderAte, status }`: **o `link` (`https://petjourney.health/pedido/<token>`) só aparece aqui** (no banco fica o hash). Mostre e ofereça copiar; o e-mail, se a pessoa deixou, recebe o mesmo link. Na repetição com a mesma `Idempotency-Key`, `token` e `link` vêm `null`. O e-mail é opcional e **não liga a cadastro nenhum** (não prova nada). `responsavel` e `pets` são obrigatórios (sem eles, 400 do validador).
   - Erros: 409 `RESERVA_EXPIRADA` (o tempo da reserva acabou: escolha de novo), `HORARIO_INDISPONIVEL` (29/10: a clínica marcou o horário entre a reserva e o pedido; escolha outro), `MODO_INDISPONIVEL` (`modo`), `PEDIDOS_NO_LIMITE` (`limite`: 3 abertos por clínica e 10 no total no app; no site, 3 por telefone por dia na clínica, 10 por telefone e 10 por origem por dia (`escopo: ORIGEM`), e `escopo: CLINICA` com `contato` quando a caixa da clínica já tem 30 pedidos pela internet para o dia ou a janela (6.12; antes eram 50 do site no total)), `CLINICA_BLOQUEADA_PELO_RESPONSAVEL` (app: "você bloqueou esta clínica; desbloqueie em Minhas clínicas"), `PET_INATIVO`; 422 `CADASTRO_INCOMPLETO`; 400 `TELEFONE_INVALIDO`, `ESPECIE_OUTRA_OBRIGATORIA`, `PEDIDO_INVALIDO` com `reason`; 400 `CAPTCHA_INVALIDO` (site, nada gravado); 503 `CAPTCHA_NAO_CONFIGURADO` (site, só em produção se o captcha não estiver configurado no servidor: "o pedido pelo site está indisponível, ligue para a clínica"); 429 `TAXA_PUBLICA_EXCEDIDA` (site, com `Retry-After`) ou `PEDIDO_TAXA_EXCEDIDA` (app: 30 ações e 300 leituras por hora).
   - **Remarcar pelo app:** o agendamento do app ganhou `podeRemarcar` (o dono, com o online da clínica ligado, dentro do prazo de cancelar). O botão abre o pedido de um pet com `remarcaAgendamentoId`: o horário antigo continua até a clínica aceitar (aí ele cai e a vaga vai para a fila). 409 `FORA_DO_PRAZO_DE_CANCELAMENTO`; 400 `REMARCACAO_PENDENTE`.
   - `PET_INTERNADO` (409) existe no catálogo, mas a internação na clínica é da E5: ainda não sai.

### 6.5 Caixa da recepção (portal)

- `GET /parceiro/portal/clinica/pedidos?status=PENDENTES|ACEITOS|RECUSADOS|ENCERRADOS&cursor=`: um item por grupo (até 3 pets), 50 por página. PENDENTES do mais antigo; o resto do mais recente. `PedidoNaCaixaDto`: `{ id, status, canal (APP, LINK), modo, motivo, servico, profissionalId, profissionalNome, quemPede, pets: [{ pedidoId, nome, especie, pacienteId, inicio, fim, horarioSumiu, agendamentoId }], preferencia, criadoEm, responderAte, prazo (NO_PRAZO, VENCENDO nos 30 min finais, ATRASADO), respondidoEm, respondidoPor (RECEPCAO, AUTOMATICO), recusa, remarcacao, ativaVinculo }`.
  - **`horarioSumiu`**: a folhinha riscada (alguém encaixou por cima do horário escolhido). **`prazo`** conta só o expediente: "respondemos em até 4 h" dito às 22h vence no meio da manhã. O atraso da clínica **não** expira o pedido; ele expira quando o horário escolhido passa ou a janela acaba (ENCERRADOS).
  - `ativaVinculo: true` (pedido pelo app): diga "ao aceitar, a clínica passa a acompanhar o pet no app".
- `GET .../pedidos/:id`: o detalhe com `queixa` inteira, `telefone` e `email` do link, `compartilharHistorico` e os comprovantes dos avisos (`avisos[]`).
- `GET .../pedidos/:id/sugestoes?limite=6`: `{ sugestoes: [{ profissionalId, profissionalNome, inicio, fim, porPet, foraDaPreferencia }], buscaInterrompida }`. Dentro do que a pessoa pediu (ou perto do horário escolhido que sumiu), quem já atende o pet primeiro, um por profissional por dia; sem nada, até 7 dias depois com `foraDaPreferencia: true` (ofereça, não marque calado).
- `POST .../pedidos/:id/aceitar` `{ inicio?, profissionalId?, mensagem?, confirmarConflitos?, vincularA? }`: vazio aceita o horário escolhido; com `inicio` (e `profissionalId`) marca outro horário (o responsável recebe "marcado em outro horário"). O melhor horário exige `inicio`. Devolve `{ pedido, agendamentoIds, conflitos }`.
  - Cria os agendamentos do grupo **juntos ou nenhum** (origem `APP` ou `LINK`), o cadastro na primeira vez (o paciente nasce do pet do app ou do cadastro mínimo), o vínculo ATIVO pelo app e o consentimento pedido. Na remarcação, troca o horário do agendamento antigo no lugar (G2, 6.11).
  - Pelo link, `vincularA { clienteId?, pacientes: [{ pedidoId, pacienteId }] }`: use o cliente ou o paciente que a clínica já tem (em vez de um cadastro novo). Nunca pelo app.
  - Nada bloqueia, tudo avisa (D-E3.1): os `conflitos` voltam como na seção 2; o feriado fechado pede `confirmarConflitos: ['holiday-closed']`. **Exceção desde 29/10 (6.12):** o horário que o profissional já tem agendamento dá 409 `HORARIO_JA_TOMADO`; para encaixar de propósito, `confirmarConflitos: ['professional-overlap']`.
  - 409 `PEDIDO_JA_RESPONDIDO` com `status` (`DESISTIU` quando o pet saiu do dono ou ele bloqueou a clínica depois de pedir).
- `POST .../pedidos/:id/recusar` `{ motivo (SEM_HORARIO, SERVICO_INDISPONIVEL, PRECISA_AVALIAR, EMERGENCIA, OUTRO), mensagem? }`. A mensagem vai citada na tela do app, na página do token e no e-mail; nunca no push.

### 6.6 App do responsável (`petjourney-app`)

- `GET /tutor/clinica/pedidos?petId=`: os abertos e os dos últimos 30 dias (até 50). `GET /tutor/clinica/pedidos/:id`: um. `POST /tutor/clinica/pedidos/:id/cancelar`: desiste do pendente (409 `PEDIDO_JA_RESPONDIDO`).
- `PedidoDoResponsavelDto`: `{ id, status (EXPIRADO calculado), canal, modo, clinica: { id, nome, telefone, whatsapp, fuso }, servico, motivo, profissionalNome, pets: [{ pedidoId, petId, nome, inicio, fim, agendamentoId }], preferencia, criadoEm, responderAte, respondidoEm, outroHorario, recusa, podeCancelar, somenteLeitura, remarcaAgendamentoId }`. Aceito: leve ao agendamento (`agendamentoId`, seção 2.10); `outroHorario: true`: "a clínica marcou em outro horário".
- **Família (v0.3):** no pedido de um grupo, a família vê só os pets que ela lê (o grupo pode vir com menos pets do que o dono vê), e a recusa chega com `motivo` e sem `mensagem` (`null`). Mostre o motivo; o texto da clínica é só para quem pediu.
- **Notificações (já registradas na leva única da 4.5; agora disparam):** `PEDIDO_ACEITO`, `PEDIDO_MARCADO_EM_OUTRO_HORARIO` e `PEDIDO_RECUSADO`, `dados` `{ parceiroId, pedidoId, agendamentoId, avisoId, petId, petNome, inicio, temMensagem }`. O aceito vai ao dono e à família (`paraMembro`); **a recusa só a quem pediu**. A mensagem da clínica vem de `GET /tutor/clinica/avisos/:notificacaoId` (4.5), que aceita também a recusa (sem agendamento). **`ROTA_POR_TIPO` em `services/notificacao/rotas-notificacao.ts`:** hoje o inbox; quando a tela do pedido existir, mapeie os três para ela com `dados.pedidoId` (o aceito pode abrir o agendamento por `dados.agendamentoId`) e avise para a API trocar a rota no catálogo.
- **Pronto quando (app):** pedir pelo slug e por "Minhas clínicas"; as perguntas do que falta; o aviso "a clínica passa a acompanhar" e a chave de diário e peso; o relógio da reserva; o melhor horário com semana e período; a lista com o prazo e cancelar; remarcar pelo agendamento; os pushes abrindo o pedido; a família vê e não tem os botões.

### 6.7 Site (`petjourney-web`)

- `/agendar/<slug>`: a página do estabelecimento (E1-01) com o pedido: serviços, os dias e horários, "escolher horário" ou "melhor horário", o cadastro mínimo (telefone com DDD; e-mail opcional, com o texto "só para receber o link e a resposta"), o widget do Turnstile (um token novo para a reserva e outro para o pedido) e o botão **"Já usa a PetJourney? Peça pelo app"** (`petjourneyapp://agendar/<slug>`, e `/baixar-app` se o app não abrir). Emergência: o contato e o "aberto agora", nunca um pedido.
- `/pedido/<token>`: `GET /public/pedidos/:token` (o estado, a clínica, os horários, a recusa; sem dado pessoal) e `POST /public/pedidos/:token/cancelar`. Token desconhecido: 404 `PEDIDO_NAO_ENCONTRADO`. **Esta página precisa de `Referrer-Policy: no-referrer` e não pode carregar analytics nem pixel** (o token está no caminho; a API já responde com `no-referrer` e `no-store`). Sem cache no ISR para ela.
- **Para o Luís (repo do site, v0.3 da auditoria):** a rota `/pedido/<token>` precisa responder com o header `Referrer-Policy: no-referrer` (no `headers()` do `next.config` ou no middleware, só para `/pedido/:path*`) e não pode carregar Google Analytics, Meta Pixel, Hotjar, Clarity nem nenhum script de terceiro, nem links externos sem `rel="noreferrer"`. O token está no caminho: qualquer terceiro que veja a URL pode ver e desistir do pedido. A API já mascara o token no log e no Sentry dela.
- **Pronto quando (site):** o pedido sem conta chega à caixa da clínica; o link do pedido abre o estado; desistir funciona; o 404 é genérico; o captcha falho mostra "confirme que você não é um robô"; a página do token não tem analytics.

### 6.8 Pendências (E1-06)

Contador `pedidos` em `GET /parceiro/portal/pendencias` (módulo Clínica, `pedido.responder`, rota `/veterinario/pedidos`, tom de atenção): os pendentes no sentido, um por grupo. A equipe com `pedido.responder` recebe `PEDIDO_HORARIO_RECEBIDO` (categoria `PARCEIRO`) a cada pedido novo (`dados` `{ pedidoId, canal, aceitoAutomaticamente }`), até 20 por clínica por hora; passou disso, o push para e só o selo `pedidos` conta (v0.3).

### 6.9 Erros desta seção

| `codigo` | Status | Quando | Extra |
|---|---|---|---|
| `CLINICA_NAO_AGENDA_PELO_APP` | 404 | Clínica inexistente, não publicada, fora do ar ou sem o online (o mesmo para todos) | |
| `HORARIO_INDISPONIVEL` | 409 | A clínica ocupou o horário entre a lista e a reserva, ou entre a reserva e o pedido (29/10) | |
| `HORARIO_JA_TOMADO` | 409 | Portal, aceitar: o profissional já tem agendamento no horário do pedido (29/10, 6.12) | |
| `RESERVA_EXPIRADA` | 409 | A reserva venceu (ou não é desta pessoa) | |
| `RESERVAS_NO_LIMITE` | 409 | 3 vivas ou 30 por dia da mesma origem (o teto da clínica saiu em 29/10) | `limite`, `escopo` (`ORIGEM`) |
| `MODO_INDISPONIVEL` | 409 | A clínica desligou o modo ou o site | `modo` |
| `CADASTRO_INCOMPLETO` | 422 | Pet sem nascimento ou sexo | `campos`, `petId` |
| `PEDIDOS_NO_LIMITE` | 409 | Pendentes demais (app), o telefone ou a origem no dia (site), ou a caixa da clínica com 30 pedidos pela internet para o dia ou a janela (29/10) | `limite`, `escopo` (`CLINICA`, `ORIGEM`); com `CLINICA`: `contato`, `modo`, `data` |
| `CLINICA_BLOQUEADA_PELO_RESPONSAVEL` | 409 | O dono bloqueou a clínica (E2-02) | |
| `PEDIDO_JA_RESPONDIDO` | 409 | Responder, aceitar ou cancelar o que já saiu de pendente | `status` |
| `PEDIDO_INVALIDO` | 400 | O corpo não fecha | `reason` |
| `PEDIDO_NAO_ENCONTRADO` | 404 | Token desconhecido | |
| `PEDIDO_TAXA_EXCEDIDA` | 429 | App (30 ações, 300 leituras por hora) ou caixa (600 leituras por hora) | `limite`, `tenteDeNovoEmSegundos` |
| `AGENDAMENTO_ONLINE_INVALIDO` | 400 | A configuração não fecha | `reason` |
| `CAPTCHA_INVALIDO`, `TAXA_PUBLICA_EXCEDIDA` | 400/429 | Escritas do site (E1-04) | |
| `CAPTCHA_NAO_CONFIGURADO` | 503 | Produção sem o captcha configurado no servidor (escritas do site) | |
| `SEM_PERMISSAO` | 403 | Aceitar sem `agenda.escrever` | `permissao` |

### 6.10 Pronto quando (portal)

A configuração liga e desliga o online com os erros tratados e mostra o link do site; a caixa lista com o prazo e a folhinha riscada; o detalhe mostra a queixa e o telefone; as sugestões aparecem; aceitar (o escolhido, outro horário, o melhor horário, o grupo) e recusar funcionam; o selo `pedidos` aparece; nenhuma regra de `domain/pedidos.ts` ficou no portal; o `/publico` virou `/public` (ou a página saiu para o site).

### 6.11 Correção do G2 (28/10): a remarcação troca no lugar

- **Aceitar a remarcação pelo app** (`remarcacao: true` na caixa) agora **troca o horário do agendamento que já existe**, com o mesmo id: `agendamentoIds` volta com o id antigo, e a pré-consulta e o histórico vão junto. Antes nascia um agendamento novo e o antigo era cancelado. Isso vale quando o antigo ainda vai acontecer e é do mesmo serviço; senão, o caminho de antes (o antigo cancelado antes de o novo nascer). O horário que ficou livre vira vaga para a fila (só o pedaço livre).
- **A remarcação pendente vence quando o horário antigo chega** (M5): se a clínica não respondeu até o início do agendamento antigo, o pedido vira `EXPIRADO` e o agendamento antigo segue valendo. App: "a clínica não respondeu a tempo; seu horário continua o de antes".
- **Óbito, anonimização e exclusão** (M4): o pedido pendente do paciente vira `DESISTIU`, sem aviso a ninguém, e o horário reservado é solto. Aceitar ou recusar depois: 409 `PEDIDO_JA_RESPONDIDO` com `status: DESISTIU`.
- **Véspera** (BAIXO 1): quem recebeu `PEDIDO_ACEITO` ou `PEDIDO_MARCADO_EM_OUTRO_HORARIO` depois das 18h não recebe também o lembrete da véspera do mesmo horário.
- **App, confirmar e cancelar presença** (BAIXO 2, seção 2.10): agora têm limite, 60 por pessoa por hora (429 `AGENDAMENTO_TAXA_EXCEDIDA` com `tenteDeNovoEmSegundos`). Toque duplo continua sem erro.

### 6.12 Decisão 25 (29/10): o pedido não segura o horário

Spec: decisão D25 de `05-agendamento-online.md`. É a decisão 23 do hotel (E7-03) trazida para a clínica. **No develop desde 30/10 (`f35487da`).** **A E3 está como feita no board: se as telas já existem, esta é a lista do que muda.**

**Por quê.** Conta é grátis (o cadastro não verifica e-mail). Com o pedido segurando o horário até a hora dele, 13 contas criadas uma vez prendiam a semana inteira de um profissional no app, no site, na fila e na agenda, sem conta nova nenhuma depois. Agora, nenhum pedido e nenhuma reserva tiram horário de ninguém. A vaga só fica garantida no aceite da clínica.

**O que muda para o front**

1. **App e site: a copy do pedido não promete horário.**
   - Tire "horário reservado", "garantido", o relógio de "segurado por 5 min" e qualquer texto que diga que o horário é da pessoa antes do aceite. A reserva continua existindo (`expiraEm` é até quando o pedido pode usá-la), mas só como passo técnico.
   - Mostre **"Sujeito à confirmação da clínica."** antes de enviar (na escolha do horário e no resumo) e na confirmação do pedido criado. Os 6 locales, com o en-GB explícito:

     | Locale | Texto |
     |---|---|
     | pt-BR | Sujeito à confirmação da clínica. |
     | en-US | Subject to confirmation by the clinic. |
     | en-GB | Subject to confirmation by the clinic. |
     | es-419 | Sujeto a la confirmación de la clínica. |
     | sr-Latn | Podložno potvrdi klinike. |
     | ar | يخضع لتأكيد العيادة. |
   - O e-mail de confirmação ao visitante do site já diz isso (a API manda).
2. **Dois podem pedir o mesmo horário.** A reserva de outra pessoa não dá mais 409. O `HORARIO_INDISPONIVEL` agora só aparece quando a clínica ocupou o horário: na reserva ou no pedido, se ela marcou entre um e outro. Nos dois casos, releia os dias.
3. **Dias (`dias-para-pedido` e `/agendamento/dias`): dois campos novos.**
   - `dias[].pedidosNoLimite` (boolean): a caixa da clínica já tem 30 pedidos pela internet esperando resposta para o dia. Os horários continuam na lista, porque existem. Mostre "a clínica já tem muitos pedidos pela internet para este dia" com os botões de telefone e WhatsApp da clínica (`emergencia.telefone` e `emergencia.whatsapp` da clínica) e não deixe enviar o pedido.
   - `clienteDaCasa` (boolean, no topo): no app, a pessoa já é cliente desta clínica e fica fora desse teto (os avisos dela vêm `false`). No site é sempre `false`.
4. **Novo 409 no pedido (app e site): `PEDIDOS_NO_LIMITE` com `escopo: CLINICA`.**
   - Vem com `contato: { telefone, whatsapp }` (públicos), `modo`, `data` (no horário escolhido) e `limite` (30). A `message` já vem no idioma ("A clínica já tem muitos pedidos pela internet para estas datas. Fale com a clínica pelo telefone ou pelo WhatsApp.").
   - Tela: a mensagem e os dois botões. O `escopo: ORIGEM` e o do app sem `escopo` (3 abertos da pessoa) continuam como antes.
   - Vale também para o melhor horário (30 pedidos de melhor horário cuja janela cruza a pedida).
5. **Portal, caixa: aceitar pode dar 409 `HORARIO_JA_TOMADO`.** O pedido não segura o horário, então outro pedido, um encaixe ou um telefonema podem ter levado. A tela abre as sugestões (`GET .../sugestoes`) para marcar em outro horário, ou a recusa. Para encaixar de propósito, mande `confirmarConflitos: ['professional-overlap']`, com uma confirmação explícita ("o profissional já tem atendimento neste horário; marcar mesmo assim?"). A folhinha riscada (`horarioSumiu`) continua avisando antes.
6. **Portal, configuração: `aceitarSozinho` agora é "aceitar sozinho os pedidos de quem já é cliente".**
   - Conta nova e pedido pelo site sempre vão para a caixa. Cliente da casa é quem tem pet com vínculo ativo na clínica (de dono atual, conta viva) ou um pedido aceito antes pela recepção.
   - **Com teto:** o automático aceita no máximo 2 horários futuros por cliente. Do terceiro em diante, o pedido vai para a caixa como qualquer outro. Cancelar um agendamento que o automático aceitou não devolve a vez: o próximo pedido também vai para a caixa.
   - Sugestão de texto: "Aceitar sozinho os pedidos de horário livre de quem já é cliente da clínica (até 2 horários marcados por cliente)".
   - No app, o pedido de cliente da casa pode voltar `ACEITO` ou `PENDENTE`. Trate os dois.
7. **Portal, agenda e fila:** o aviso `pedido-pendente` não aparece mais por causa de pedido online. Só a oferta da fila gera esse aviso. As vagas da fila também não somem mais por pedido pendente. `ReservaNaAgendaDto.donoTipo` hoje só vem `FILA`; o enum ficou igual.
7b. **App, novo 429 no pedido:** `POST /tutor/clinica/pedidos` também conta pela origem, com 20 pedidos por hora do mesmo IP (ou /64), qualquer conta. A resposta é o mesmo 429 `PEDIDO_TAXA_EXCEDIDA` com `limite` (20) e `tenteDeNovoEmSegundos`; a tela que já trata o 429 do app não muda.
8. **Saiu:** o 409 `RESERVAS_NO_LIMITE` sem `escopo` (o teto de reservas da clínica pelo site) e o teto de 50 pendentes do site por clínica. Se a tela tinha um texto para eles, ele não é mais usado.

**O que não muda:** as rotas e os corpos são os mesmos, a reserva continua obrigatória no horário escolhido, e os tetos da pessoa (3 abertos por clínica no app), do telefone e da origem continuam. O cliente da casa também respeita o teto da pessoa.

**Pronto quando:**
- nenhuma tela do pedido promete horário;
- o "Sujeito à confirmação da clínica." aparece antes de enviar e na confirmação;
- o dia com `pedidosNoLimite` mostra o contato e não envia;
- o 409 `escopo: CLINICA` mostra a mensagem e os botões;
- o aceite com `HORARIO_JA_TOMADO` leva às sugestões ou à recusa, e o encaixe de propósito pede confirmação;
- o texto do `aceitarSozinho` diz "de quem já é cliente".

## 7. Pré-consulta (E3-07)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e3-agenda/07-pre-consulta.md` (decisões do gerente de 27/10). O responsável responde no app antes do horário; a clínica lê como **sugestão**, com a procedência de cada valor. Uma pré-consulta por atendimento (a perna principal: pelo id da perna secundária, a API usa a principal).

### 7.1 Rotas

| Rota | Quem | Resposta |
|---|---|---|
| `GET /tutor/clinica/agendamentos/:id/pre-consulta` | dono ou família com leitura (vínculo ATIVO) | 200 `PreConsultaDoResponsavelDto` |
| `PUT /tutor/clinica/agendamentos/:id/pre-consulta` | **só o dono** | 200 `PreConsultaDoResponsavelDto` |
| `POST /tutor/clinica/agendamentos/:id/pre-consulta/fotos` | só o dono | 201 `{ fotoId }` (multipart, campo `file`) |
| `DELETE /tutor/clinica/agendamentos/:id/pre-consulta/fotos/:fotoId` | só o dono, janela aberta | 204 |
| `GET /parceiro/portal/clinica/agendamentos/:id/pre-consulta` | `agenda.ler` (módulo CLINICA); recorte por `prontuario.ler` | 200 `PreConsultaDaClinicaDto` |

Agendamento alheio, sem vínculo ativo ou inexistente: o mesmo 403 (`OWNERSHIP_FORBIDDEN`), sem dizer qual. Família no PUT, na foto e no DELETE: 403 `SOMENTE_LEITURA`. O app só vê a pré-consulta e as fotos do pet do vínculo de hoje: se o paciente passou para outro pet, o dono novo vê o formulário vazio, e a resposta dele substitui a do dono antigo.

### 7.2 O que o app recebe (`GET` e retorno do `PUT`)

- `agendamentoId` (a perna principal), `situacao` (`AINDA_NAO_ABRIU`, `ABERTA`, `RESPONDIDA`, `FECHADA`), `abreEm`, `fechaEm` (o início do agendamento), `respondidaEm`, sempre com o offset da **clínica**.
- Acréscimos ao contrato do portal: `atualizadaEm`, `podeEditar` (o dono com a janela aberta; família: `false`), `sugestaoDatas` (a data de cada valor sugerido, `AAAA-MM-DD`) e `fotos: [{ fotoId, url, expiraEm }]` (URL assinada de 15 min; `url: null` se o armazenamento falhou na hora).
- `resposta`: `motivo`, `queixaPrincipal`, `sintomas`, `desdeQuando`, `evolucao`, `alimentacao`, `hidratacao`, `fezes`, `urina`, `vitalidade`, `pesoKg`, `pesadoEm` (`AAAA-MM-DD`), `observacao` (`''` quando vazia), `fotoIds`, `camposDoDiario`.
- `sugestao`: do diário dos últimos 3 dias (dia civil da clínica, até amanhã) e do último peso de casa de até 30 dias. Vem só para o dono com a janela aberta e só com o diário no plano do **dono do pet** (Premium ou Freemium); senão `null`, e o formulário abre vazio, sem "do seu diário". Nunca `{}`.
- A janela abre `preConsultaAbreHorasAntes` antes (política da clínica, lida na hora; padrão 72 h) e fecha no início ou quando o paciente chega. **Respondida, fica editável até fechar**, mesmo se a clínica remarcar para depois da nova abertura.

### 7.3 Responder (`PUT`)

- Corpo = `ResponderPreConsulta` do contrato. `motivo` e `queixaPrincipal` obrigatórios (só brancos: 400). Queixa até 1000 e observação até 2000 caracteres (contados como o banco conta: emoji com seletor vale 2). Até 5 sintomas, sem repetir. `desdeQuando` com os literais do contrato (`HOJE`, `UM_A_DOIS_DIAS`, `TRES_A_SETE_DIAS`, `UMA_A_DUAS_SEMANAS`, `MAIS_DE_DUAS_SEMANAS`).
- Peso: 0,01 a 199,99 kg, até duas casas. `pesadoEm` só com `pesoKg`, e não depois de amanhã no fuso da clínica (400 `PRE_CONSULTA_INVALIDA` com `reason`: `PESADO_EM_SEM_PESO`, `PESADO_EM_NO_FUTURO`). O peso da pré-consulta **não** vira registro de peso do pet.
- `camposDoDiario` é aceito e **ignorado**: a API recalcula a procedência (campo igual à sugestão do momento). Mande o que o contrato manda; não precisa calcular.
- `fotoIds`: as fotos que ficam. As que não estão na lista são apagadas (linha e arquivo). Omitido: as fotos ficam como estão. Id de outra pré-consulta: 400 `PRE_CONSULTA_INVALIDA` `reason: FOTO_DESCONHECIDA`.
- **Não ecoe o GET:** `situacao`, `sugestao`, `abreEm` ou qualquer campo fora do contrato dá 400 (whitelist).
- Fora da janela: 409 `PRE_CONSULTA_FECHADA` com `reason` (`AINDA_NAO_ABRIU`, `FECHADA`, `AGENDAMENTO_ENCERRADO`) e `abreEm`. Use o `reason` para a frase: "abre em", "a consulta já começou", "este agendamento foi encerrado".
- Editar depois de responder não gera aviso novo à clínica; o portal mostra `atualizadaEm`.

### 7.4 Fotos

- Multipart com o campo `file`; até 3 por atendimento; até 8 MB; **só JPEG, PNG e WebP**, com o tipo lido dos bytes (o tipo declarado não vale). **HEIC dá 400: o app converte para JPEG antes de enviar** (no iOS, a foto da câmera vem em HEIC).
- A API regrava a foto sem metadados (sem GPS da casa), já girada.
- A foto sobe antes da resposta: suba, guarde o `fotoId` e mande em `fotoIds` no PUT. Para trocar uma foto errada, `DELETE .../fotos/:fotoId` (sem esperar o PUT).
- Erros: 400 `FOTO_INVALIDA` com `reason` `TIPO`, `TAMANHO`, `ILEGIVEL` ou `LIMITE` (`maxFotos: 3`); 409 `PRE_CONSULTA_FECHADA`; 503 `PRE_CONSULTA_FOTO_INDISPONIVEL` (armazenamento fora: tente de novo) e 503 `UPLOAD_PROCESSAMENTO_OCUPADO` (com `tenteDeNovoEmSegundos`).

### 7.5 Na agenda do app

Cada item de `GET /tutor/clinica/agendamentos` (e o detalhe) traz `preConsulta: { situacao, abreEm, fechaEm, respondidaEm } | null` (`null` no cancelado). Use para o cartão "responder pré-consulta" sem chamar a rota da pré-consulta item a item. Build antiga ignora o campo.

### 7.6 Notificações

- `PRE_CONSULTA_PENDENTE` (ao dono e à família que lê o pet): sai uma vez por horário, 24 h antes do início se ainda não respondida. Se o alvo cair entre 22h e 8h no fuso da clínica, sai às 20h da véspera (ou às 8h, se a janela ainda não estava aberta às 20h e faltarem 2 h ou mais). Política que abre menos de 24 h antes: sai na abertura. Agendamento criado (ou remarcado) depois do alvo: não sai (o aviso de criado ou remarcado basta). Remarcar para outro dia rearma. Não sai se a véspera do mesmo agendamento saiu nas últimas 6 h, nem depois de respondida. Conta no teto de 4 avisos da agenda por pet por clínica por dia. `dados`: `{ parceiroId, agendamentoId, avisoId, petId, petNome, inicio, fechaEm, temMensagem }`. Deep link: o inbox (`/screens/notifications`) até o app publicar `/screens/clinica/pre-consulta`; a API troca quando a tela existir. **Mapear o tipo em `rotas-notificacao.ts` do app.**
- `PRE_CONSULTA_RESPONDIDA` (à equipe com `prontuario.ler`, categoria `PARCEIRO`, sem e-mail): só na primeira resposta. `dados`: `{ parceiroId, parceiroNome, agendamentoId, inicio, chaveEvento }`. **Mapear o tipo em `rotas-notificacao.ts` do app também.** Membro da equipe que usa o app recebe esse aviso no inbox; sem a entrada no mapa, o toque cai em Unmatched Route. Destino: o inbox (`/screens/notifications`).

### 7.7 Portal (`GET .../clinica/agendamentos/:id/pre-consulta`)

- Com `prontuario.ler` (VETERINARIO, ENFERMAGEM, DONO): `completa: true`, `situacao`, `abreEm`, `fechaEm`, `respondidaEm`, `atualizadaEm`, os campos da resposta, `camposDoDiario` (mostre "do diário" nesses campos) e `fotos: [{ fotoId, url, expiraEm }]` (15 min; peça de novo ao expirar).
- Sem `prontuario.ler` (RECEPCAO, GESTOR): `completa: false` e só `situacao`, `respondidaEm`, `motivo` e `queixaPrincipal`. Os outros campos nem aparecem.
- Sem resposta: 200 com a `situacao` e `motivo`/`queixaPrincipal` nulos (mostre "ainda não respondeu").
- O peso de casa é sugestão: **nunca** preencha os vitais com ele. Editada depois de lida: `atualizadaEm` maior que `respondidaEm` (marque "editada").
- Cada leitura com resposta fica na trilha (`LER_DADO_DO_APP`), e o responsável a vê em `/acessos`.
- FINANCEIRO e papéis do hotel: 403 `SEM_PERMISSAO`. Agendamento de outra clínica ou inexistente: 403.
- A anamnese (E4-01) recebe a pré-consulta pela API como sugestão com `procedencia` por campo (`PRE_CONSULTA` ou `DIARIO`) e o peso em `pesoDeCasa`.

### 7.8 Códigos de erro

| Código | Status | Quando | Extra |
|---|---|---|---|
| `PRE_CONSULTA_FECHADA` | 409 | PUT, foto ou DELETE fora da janela | `reason`, `abreEm` |
| `PRE_CONSULTA_INVALIDA` | 400 | Peso sem valor, pesagem no futuro, foto desconhecida | `reason` |
| `FOTO_INVALIDA` | 400 | Tipo, tamanho, ilegível ou a quarta foto | `reason`, `maxFotos` |
| `PRE_CONSULTA_FOTO_INDISPONIVEL` | 503 | Armazenamento fora | |
| `PRE_CONSULTA_TAXA_EXCEDIDA` | 429 | 30 PUT/DELETE, 20 fotos ou 600 leituras por pessoa por hora (portal: 600 leituras por usuário) | `limite`, `tenteDeNovoEmSegundos` |
| `SOMENTE_LEITURA` | 403 | Família tentando escrever | |

### 7.9 Pronto quando

App: o cartão da agenda abre a pré-consulta pela situação; o formulário abre com a sugestão (e "do seu diário" só quando ela vem); a foto da câmera sobe convertida para JPEG; trocar e apagar foto funcionam; os 409 têm a frase pelo `reason`; a família vê a resposta sem editar; o tipo `PRE_CONSULTA_PENDENTE` abre o inbox. Portal: o painel da pré-consulta no agendamento com "do diário" por campo, as fotos, o "editada" e o recorte da recepção.

## 8. Painel do dia e resumo da clínica (E3-08)

Spec: `docs/specs/2026/q4/q4-1/portal-parceiro/e3-agenda/08-painel-do-dia-e-resumo-da-clinica.md` (v0.2; decisões do gerente de 27/10). **Em dev desde 2026-10-28**, não em produção. Só leitura: nenhuma escrita, nenhuma migration, nenhuma notificação nova (**não há tipo novo para o `rotas-notificacao.ts` do app**). O front troca a conta que hoje faz no navegador (`domain/resumo.ts`) por estas três rotas: o shape do resumo é o mesmo do `ResumoDaClinica` do portal, com os acréscimos da seção 8.3.

### 8.1 Rotas

Todas são `GET`, em `/parceiro/portal/clinica/…`, módulo CLINICA e `agenda.ler`. **Módulo suspenso ou desligado mantém a leitura** (200); módulo nunca ligado: 403 `MODULO_INATIVO`. FINANCEIRO e papéis do hotel: 403 `SEM_PERMISSAO`. Quem não é da equipe: 403.

| Rota | Query | Resposta |
|---|---|---|
| `meu-dia` | `escopo?` (`PROFISSIONAL` ou `CLINICA`), `profissionalId?` | `MeuDiaDto` |
| `atividades` | nenhuma | `AtividadesDto` |
| `resumo` | `periodo?`, `de?`, `ate?`, `profissionalId?`, `tipoId?` | `ResumoDaClinicaDto` |

Limite de leituras por usuário por hora: 600 no Meu dia (a tela fica aberta e atualiza sozinha), 300 em atividades e no resumo. **O resumo tem também um teto de rajada de 10 por minuto por usuário.** Passou de qualquer um: 429 `PAINEL_LEITURA_TAXA_EXCEDIDA` com `limite`, `janela` (`HORA` ou `MINUTO`) e `tenteDeNovoEmSegundos`. Atualize o Meu dia no máximo de 10 em 10 segundos, e não dispare um resumo a cada tecla: espere o usuário escolher o período (e use o `geradoEm` em vez de repetir o pedido).

### 8.2 Resumo: período e filtros

- **Sem `periodo` e sem `de`/`ate`, vale `HOJE`** (o dia de hoje na parede da clínica, não do navegador).
- Mapa dos literais do portal para o enum da API (maiúsculo): `hoje` → `HOJE`, `semana` → `SEMANA` (segunda a domingo da semana de hoje), `semana-passada` → `SEMANA_PASSADA`, `trinta-dias` → `TRINTA_DIAS` (**30 dias civis terminando hoje, inclusive**). Literal em minúsculo dá 400.
- Período livre: `de` e `ate` juntos (`AAAA-MM-DD`, ano de 2000 a 2100, inclusive nos dois lados), **até 90 dias**: 90 passam, 91 não. `periodo` junto com `de`/`ate`, só um dos dois, `de` depois de `ate`: 400 `RESUMO_PERIODO_INVALIDO` com `motivo` (`PERIODO_DESCONHECIDO`, `PERIODO_E_DATAS`, `DATA_FALTANDO`, `DATA_INVERTIDA`, `MUITOS_DIAS`) e `maxDias: 90`. Data inexistente (`2026-02-30`) dá o 400 do validador; ano fora do limite, `AGENDA_DATA_FORA_DO_LIMITE`.
- `profissionalId` e `tipoId`: confira que são da clínica (id de outra clínica: 403, o mesmo de um id inexistente). **Quem não tem `auditoria.ler` só pode filtrar por si mesmo**: o `profissionalId` de um colega dá 403 `SEM_PERMISSAO` (`permissao: "auditoria.ler"`).
- **Um resumo por vez por clínica.** Se outro resumo **diferente** da mesma clínica está sendo calculado, o pedido volta 429 `RESUMO_EM_ANDAMENTO` (`tenteDeNovoEmSegundos: 2`): espere e peça de novo, uma vez (não em laço). O mesmo pedido de outra pessoa não dá erro: espera o que está rodando e recebe o mesmo resultado.
- **Teto de 20.000 atendimentos lidos por pedido.** Passou: 400 `RESUMO_LEITURA_EXCEDIDA` com `maxLinhas`, `maxDias` e **`diasQueCabem`** (a partir de `de`). Ofereça o período menor: "esta clínica tem atendimentos demais para 60 dias; tente 28". Nunca vem resposta parcial.

### 8.3 Resumo: o que vem na resposta

Campos como no `ResumoDaClinica` do portal, com estas diferenças (o front ainda não consome, é a hora de ajustar):

- `intervalo: { inicio, fim, dias }`.
- `indicadores`: `finalizados`, `previstos`, `faltas`, `cancelados`, `encaixes`, `comparecimento`, `ocupacaoMedia`, `novosPacientes` e os novos **`semDesfecho`**, **`total`** e **`horasAgendadas`**.
  - `horasAtendidas` do portal virou **`horasAgendadas`**: é a soma das durações **marcadas** dos finalizados, não o tempo de relógio. Rotule assim na tela ("horas agendadas").
  - `previstos` é o que ainda não aconteceu: o AGUARDANDO e o EM_ATENDIMENTO de hoje, e o AGENDADO ainda dentro do horário (paciente atrasado), mais o futuro. `semDesfecho` é o ativo de dia anterior, ou o AGENDADO/CONFIRMADO de hoje cujo **fim já passou**: é o que a recepção esqueceu de fechar. Não entra no comparecimento nem na falta. `finalizados + previstos + semDesfecho + faltas + cancelados = total`.
  - **`comparecimento` e `ocupacaoMedia` vêm `null`** quando não há denominador (sem finalizado e sem falta) ou capacidade (nenhum dia com expediente). Mostre "sem dados", nunca 0%. **A ocupação pode passar de 1 (100%)**: não limite a barra a 100% sem avisar. Nunca vem `NaN` nem `Infinity`.
  - Cancelado não conta como falta. O atendimento com várias pernas conta **uma vez**, pela perna principal; se a principal foi cancelada e a ligada segue ativa, conta com o status da ativa.
  - `novosPacientes`: primeiro atendimento não cancelado do paciente na clínica. **Paciente da base importada (E2-05) não conta** (o migrador não cria agendamento).
- `porDia[]`: `data`, `finalizados`, `previstos`, `semDesfecho`, `faltas`, `cancelados`, `ocupacao` (`number | null`) e `fechado` (sem capacidade: feriado, ninguém com expediente; fora da média de ocupação). Até 90 itens.
- `porTipo[]`, `porOrigem[]`: fatias `{ id, rotulo, valor, parte }` **sem cancelados**, as 20 maiores e uma fatia `id: "OUTROS"` com o resto. `rotulo` do tipo é o nome; trate `OUTROS` como texto seu (idioma da tela).
- `porProfissional[]`: fatia `+ finalizados, faltas, comparecimento (null), horasAgendadas, ocupacao (null)`. **Só com `auditoria.ler` (GESTOR e DONO) vem a lista completa** (`porProfissionalCompleto: true`), as 20 maiores mais `OUTROS`. Sem essa permissão: **só a linha de quem pede** (se tiver ficha) e `porProfissionalCompleto: false`; os totais da clínica seguem inteiros. **Sem ranking**: não ordene nem destaque pessoas na tela.
- `porHora[]`: `{ diaSemana (0 domingo a 6 sábado), hora (0 a 23), valor }`, só as células com valor, no máximo 168. O portal chamava `weekday`. `picoDaHora` é o maior valor (escala de cor).
- **`diagnosticos` só vem com `prontuario.ler`** (VETERINARIO, ENFERMAGEM, DONO). Sem a permissão, **a chave não vem** (não vem `[]`): distinga "sem permissão" de "sem dado". Forma: `{ itens: Fatia[], semDiagnostico, avulsos }`.
  - `itens`: os 6 diagnósticos principais mais frequentes por **código do catálogo** (`id` é o código, `rotulo` o nome do catálogo), mais a fatia `id: "SEM_CODIGO"` quando houver diagnóstico sem código (texto digitado nunca aparece no painel). Trate `SEM_CODIGO` como texto seu.
  - Só atendimento **finalizado e não anulado**, na **data do atendimento** (o dia do agendamento, igual aos indicadores). `semDiagnostico`: finalizados marcados "sem diagnóstico". `avulsos`: quantos dos contados não têm agendamento (o atendimento avulso está em `itens` e não está nos indicadores).
- **`geradoEm`** (data-hora no fuso da clínica) e **`emCache`**. Período fechado (termina antes de hoje) pode vir da memória por até 5 minutos; **período aberto (hoje, semana atual) por até 45 segundos**. Mostre "atualizado às 10:42" quando `emCache` for `true`; um atendimento finalizado agora pode levar até 45 s para aparecer no resumo de hoje (o Meu dia não tem cache). Duas réplicas da API podem mostrar números de até 5 minutos de diferença: o `geradoEm` explica. Mudar o horário ou o fuso da clínica e concluir uma importação limpam o guardado da clínica.
- `fuso`: o IANA da clínica.

### 8.4 Meu dia

`GET meu-dia`. De quem é o dia (`escopo` e `profissionalId`/`profissionalNome` na resposta dizem o que valeu):

- Sem parâmetros: quem tem **ficha de profissional ativa** vê o dia dela (`PROFISSIONAL`; com duas fichas na clínica, a mais antiga); quem não tem (recepção, gestor sem ficha) vê a clínica (`CLINICA`).
- `escopo=CLINICA` explícito vale para quem tem `agenda.ler`, inclusive DONO e GESTOR que também atendem (use no seletor "Minha agenda / Clínica").
- `profissionalId=` de um colega da mesma clínica mostra o dia dele (quem tem `agenda.ler` já vê a agenda dele). De outra clínica: 403.
- `escopo=CLINICA` com `profissionalId`, ou `escopo=PROFISSIONAL` sem ficha e sem `profissionalId`: 400 `MEU_DIA_FILTRO_INVALIDO` (`motivo`: `ESCOPO_E_PROFISSIONAL` ou `SEM_FICHA`).

Resposta: `data`, `fuso`, `escopo`, `profissionalId`, `profissionalNome`, `geradoEm`, **`blocos`** (objeto por chave) e **`blocosIndisponiveis`** (lista de chaves).

- **`blocos` traz só os blocos que a sua permissão alcança. Bloco ausente NÃO é zero**: não mostre "0 rascunhos" quando a chave não veio. `blocosIndisponiveis` lista o que a spec prevê e ainda não tem dono (hoje, `internados`, da internação): esconda ou mostre "em breve".
- Cada bloco: `{ total, itens[], truncado, falhou }`. **`falhou: true` com `total: null`**: a leitura passou de 2 segundos (a espera por uma vaga de leitura conta nesses 2 s), o painel estava ocupado ou deu erro; só aquele bloco, os outros vêm normais. Mostre "não foi possível carregar" com tentar de novo. `truncado: true`: tem mais do que a leitura alcançou (o `total` é "pelo menos").
- Os `itens` não têm texto livre, telefone, CPF, observação interna nem o nome do responsável: só o nome do animal e ids.

| Chave | Permissão | O que é | Campos do item (`id` é o do que a chave nomeia) |
|---|---|---|---|
| `atendimentos` | `agenda.ler` | Os atendimentos de hoje (cancelado fora), por início. Até 500; mais que isso: `truncado: true` (a rota não falha) | `id` (agendamento), `pacienteId`, `pacienteNome`, `profissionalId`, `tipoId`, `quando`, `fim`, `status`, `encaixe`, `atendimentoId` (o prontuário, quando aberto) |
| `salaDeEspera` | `agenda.ler` | AGUARDANDO de hoje por chegada (consulta própria: o tamanho do dia não a esconde) | `id`, `pacienteId`, `pacienteNome`, `profissionalId`, `quando` (a chegada), `esperaMinutos` |
| `faltasSemJustificativa` | `agenda.escrever` | Só o número, o **mesmo do selo `faltasSemJustificativa`** (da clínica toda) | `total` (sem itens) |
| `retornosPendentes` | `agenda.escrever` | Retornos vencidos ou que vencem hoje. No escopo `PROFISSIONAL`, os dos atendimentos dele | `id` (atendimento), `pacienteId`, `pacienteNome`, `profissionalId`, `profissionalNome`, `tipoId`, `tipoNome`, `data` (o vencimento), `diasDeAtraso` |
| `preConsultasNovas` | `agenda.ler` | Pré-consultas respondidas dos atendimentos de hoje que ainda não terminaram. **Nunca traz a queixa** (a leitura de verdade grava a trilha da E3-07) | `id` (agendamento), `pacienteId`, `pacienteNome`, `profissionalId`, `quando`, `respondidaEm` |
| `rascunhos` | `prontuario.ler` ou `auditoria.ler` | Rascunhos de prontuário abertos: os do profissional no escopo `PROFISSIONAL`, os da clínica no `CLINICA`. Só paciente, profissional e idade | `id` (atendimento), `pacienteId`, `pacienteNome`, `profissionalId`, `profissionalNome`, `quando` (abertura), `horas`, `nuncaAberto` |

### 8.5 Atividades

`GET atividades`: as pilhas do que ficou para trás, **da clínica toda** (sem escopo). Resposta: `data`, `fuso`, `geradoEm`, **`pilhas`** (objeto por chave) e **`pilhasIndisponiveis`** (hoje `tratamentosEmQueda`, da E4-05). Mesmo bloco `{ total, itens, truncado, falhou }`, **até 20 itens** e o `total` real (a lista inteira mora na tela do assunto). Mesma regra: pilha ausente não é zero.

| Chave | Permissão | O que é | Campos do item |
|---|---|---|---|
| `faltasSemJustificativa` | `agenda.escrever` | Faltas dos últimos 30 dias sem justificativa com contato, as 20 mais antigas; `total` é o do selo | `id` (agendamento), `pacienteId`, `pacienteNome`, `profissionalId`, `quando`, `diasDeAtraso` |
| `retornosVencidos` | `agenda.escrever` | Retornos vencidos (a mesma lista da rota de retornos pendentes), do mais atrasado | como `retornosPendentes` acima |
| `pedidosAtrasados` | `pedido.responder` | Pedidos online pendentes cujo prazo de resposta passou | `id` (pedido), `pacienteId?`, `pacienteNome?`, `quando` (o prazo), `minutosDeAtraso`. Sem telefone, nome do responsável nem queixa |
| `vacinasAtrasadas` | `agenda.ler` | Doses vencidas da lista de chamada (a mesma regra e o mesmo número do selo `vacinasAtrasadas`) | `id` (aplicação), `pacienteId`, `pacienteNome`, `vacinaId`, `vacinaNome`, `data` (a dose), `diasDeAtraso`. O telefone fica na lista de chamada |
| `rascunhosSemFecho` | `prontuario.ler` ou `auditoria.ler` | Rascunhos **com conteúdo** da clínica toda, do mais antigo (o vazio está em `iniciadosNuncaAbertos`) | como `rascunhos` acima |
| `iniciadosNuncaAbertos` | **`agenda.escrever`** (recepção, gestor, dono, veterinário) | Rascunhos **vazios** (`versao = 1`, o responsável nunca abriu a edição): a recepção iniciou o atendimento e cobra o veterinário. Só paciente, profissional e horário (`quando`); nunca traz rascunho com conteúdo | `id` (atendimento), `pacienteId`, `pacienteNome`, `profissionalId`, `profissionalNome`, `quando`, `horas`, `nuncaAberto` (sempre `true`) |
| `resumosNaoPublicados` | `prontuario.ler` | Atendimentos finalizados nos últimos 30 dias cujo resumo não chegou ao app | `id` (atendimento), `pacienteId`, `pacienteNome`, `profissionalId`, `quando` (finalização), `motivo` (`REMOVIDO_PELO_RESPONSAVEL`, `OBITO`, `SEM_VINCULO`, `NAO_LIBERADO`) |

Quem vê o quê: RECEPCAO fica com faltas, retornos, pedidos, vacinas e **iniciados e nunca abertos** (nenhuma pilha com conteúdo clínico); ENFERMAGEM, com vacinas e as pilhas do prontuário com conteúdo (rascunhos e resumos; sem faltas, retornos, pedidos nem iniciados); GESTOR, com tudo o que a recepção vê mais `rascunhosSemFecho` (por `auditoria.ler`), sem `resumosNaoPublicados`; VETERINARIO e DONO, todas.

O selo `rascunhosDeProntuario` segue sendo de quem escreve prontuário.

### 8.6 Códigos de erro

| Código | Status | Quando | Extra |
|---|---|---|---|
| `RESUMO_PERIODO_INVALIDO` | 400 | `periodo` desconhecido ou em minúsculo, `periodo` com datas, uma data só, `de` depois de `ate`, mais de 90 dias | `motivo`, `maxDias`, `aceitos` (no desconhecido), `dias` (no excesso) |
| `RESUMO_LEITURA_EXCEDIDA` | 400 | Mais de 20.000 atendimentos no período | `maxLinhas`, `maxDias`, `diasQueCabem` |
| `MEU_DIA_FILTRO_INVALIDO` | 400 | `escopo=CLINICA` com `profissionalId`, ou `PROFISSIONAL` sem ficha | `motivo` |
| `PAINEL_LEITURA_TAXA_EXCEDIDA` | 429 | 600 (Meu dia) ou 300 (atividades e resumo) leituras por usuário por hora; ou mais de 10 resumos por minuto | `limite`, `janela` (`HORA`, `MINUTO`), `tenteDeNovoEmSegundos` |
| `RESUMO_EM_ANDAMENTO` | 429 | Outro resumo diferente desta clínica está sendo calculado | `tenteDeNovoEmSegundos` |
| `PAINEL_OCUPADO` | 503 | Resumo sem vaga de leitura (fila cheia ou prazo de espera esgotado). No Meu dia e nas atividades isso vira `falhou: true` no bloco, não 503 | `motivo` (`FILA_CHEIA`, `ESPERA_ESGOTADA`), `tenteDeNovoEmSegundos` |
| `AGENDA_DATA_FORA_DO_LIMITE` | 400 | `de`/`ate` fora de 2000 a 2100 | `campo`, `anoMinimo`, `anoMaximo` |
| `SEM_PERMISSAO` | 403 | Sem `agenda.ler`; ou filtrar o resumo por colega sem `auditoria.ler` | `permissao` |
| `MODULO_INATIVO` | 403 | Módulo CLINICA nunca ligado | |

### 8.7 Pronto quando

O "Meu dia" lê de `meu-dia` (seletor "Minha agenda / Clínica" pelo `escopo`), trata `falhou`, `truncado`, bloco ausente e `blocosIndisponiveis` sem mostrar zero; "Atividades" lê das pilhas com os mesmos cuidados; o resumo troca `domain/resumo.ts` pela rota, com os literais mapeados, `comparecimento` e ocupação `null` como "sem dados", ocupação acima de 100% tratada, "horas agendadas" no lugar de "horas atendidas", `semDesfecho` visível, `geradoEm` quando `emCache`, o 400 de 20.000 oferecendo `diasQueCabem`, `porProfissional` sem ranking e a chave `diagnosticos` ausente tratada como "sem permissão". Nenhuma conta do resumo ficou no navegador.
