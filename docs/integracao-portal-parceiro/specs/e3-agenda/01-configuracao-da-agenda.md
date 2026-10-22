# Spec: Configuração da agenda (tipos de atendimento, salas, expediente, bloqueios e política)

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.4
**Épico:** [E3 agenda](../../../../../epicos/portal-parceiro-e3-agenda.md)
**Depende de:** [E1-01 perfil](../e1-fundacao/01-perfil-publico-do-estabelecimento.md) (horários e feriados do estabelecimento), [E1-03 profissionais](../e1-fundacao/03-profissionais-e-papeis.md)

---

## Visão Geral

Tudo o que a agenda precisa saber antes do primeiro horário:
- **tipos de atendimento**: nome, duração, tipo, salas compatíveis, se permite encaixe e se aparece no pedido online;
- **salas**;
- **expediente por profissional**, quando difere do estabelecimento;
- **bloqueios**, únicos ou recorrentes, de profissional ou de sala;
- **granularidade da grade**;
- **política da clínica**: prazo de cancelamento pelo app, minutos de reserva, abertura da pré-consulta, prazo da oferta de vaga.

## Motivação

O portal tem tudo isso em mock (`Clinic.horarios`, `Clinic.slotMinutos`, `Room`, `AppointmentType`, `Block` com `BlockRecurrence`, `petjourney-admin/src/features/clinico/data/types.ts:33-111` e `:423-458`; política em `data/fixtures/clinic.ts:71-74`: cancelar até 2 h, reserva 5 min, pré-consulta 72 h, oferta 30 min). Sem isso no servidor, a agenda e o pedido online não calculam slot.

---

## Research Findings

- Horários da semana e dias especiais do estabelecimento já são da E1-01; esta spec só acrescenta o que é da agenda.
- `PoliticaDaClinica` do contrato (`contrato/responsavel.ts:435-444`): `cancelarAteHorasAntes`, `reservaMinutos`, `preConsultaAbreHorasAntes`, `ofertaDeVagaMinutos`; "o app nunca fixa este número".
- `BlockReason`: almoço, reunião, férias, manutenção, bloqueio pessoal, feriado; recorrência semanal com dias e data final (`types.ts:423-449`).
- `RoomKind`: consultório, cirurgia, banho, internação, exame. `AppointmentTypeKind`: consulta, retorno, vacina, exame, cirurgia, banho, emergência.
- Config de produto em tabela (memória); padrão singleton por parceiro como `OutreachConfiguracao` (`prisma/schema.prisma:2772-2783`), aqui com linha por parceiro.

**Breaking changes:** nenhuma.

## Decisões

- **D1 Política em tabela por parceiro, com default global.** `PoliticaDaAgenda` nasce com os defaults do protótipo e é editável por DONO ou GESTOR; mudar não reescreve agendamentos existentes.
- **D2 Expediente do profissional é exceção.** Sem linha própria, vale o horário do estabelecimento. Com linha, só os dias definidos mudam (ex.: Ana só às terças e quintas).
- **D3 Bloqueio recorrente é materializado na leitura.** O bloqueio guarda a regra; a agenda do dia o expande (como `materializarBloqueios` do portal, `domain/conflicts.ts:295`). Exceção de uma ocorrência é um bloqueio "cancelado naquele dia" (`excecoes Date[]`).
- **D4 Tipo de atendimento com `kind` fechado e nome livre.** O `kind` decide regra (o pedido online nunca oferece CIRURGIA nem EMERGENCIA; a publicação mapeia `kind` para `TipoConsulta`); o nome é da clínica ("Check-up felino 40 min").
- **D5 Feriado e dia especial vêm da E1-01.** A agenda não duplica.

### Decidido na implementação (v0.2)

- **D6 Ler é `agenda.ler`.** A tabela de rotas da v0.1 punha `estabelecimento.editar` também no GET de salas e tipos; o cabeçalho dela dizia "leitura `agenda.ler`". Vale o cabeçalho: a recepção e o veterinário leem salas e tipos para montar a agenda; só DONO e GESTOR configuram.
- **D7 Duas leituras a mais**, porque o front precisa ler o que edita:
  - `GET /parceiro/portal/profissionais/:id/expediente` devolve os 7 dias resolvidos, cada um com `origem` (`PROFISSIONAL` ou `ESTABELECIMENTO`);
  - `GET /parceiro/portal/clinica/bloqueios/:id` devolve a regra (dias, fim da série, exceções).
- **D8 Sala padrão do profissional.** O `Profissional.salaPadraoId` (reservado na E1-03 "para a E3-01") vai no PUT do expediente (omitido mantém, `null` limpa) e ganhou FK para `Sala` (`SET NULL`). Sala desativada não vira padrão nem recebe bloqueio (409 `SALA_INATIVA`); desativar a sala tira ela de padrão de quem a tinha, na mesma transação.
- **D9 Nada de apagar sala ou tipo.** Sem `DELETE`: desativa por `PATCH` (`ativa`/`ativo: false`). Como o agendamento ainda não existe, nunca houve "sala sem agendamento para apagar", e a E3-02 não precisa reabrir a regra. Nome único entre os **ativos** do parceiro, sem caixa (índice parcial `lower(nome)` na migration): 409 `SALA_NOME_EM_USO` e `TIPO_NOME_EM_USO`.
- **D10 Modelo** (aditivo, migration `20261021120000_agenda_configuracao`):
  - `ExpedienteDoProfissional.parceiroId` (P1), com FK;
  - `criadoEm`/`atualizadoEm` em sala, tipo e bloqueio; `atualizadoPorId` na política;
  - `excecoes` e `diasDaSemana` com default `[]`;
  - CHECKs: `fim > inicio` no bloqueio, `diaSemana` de 0 a 6, duração do tipo positiva.
- **D11 Tipos.** Duração de 5 a 480 min, de 5 em 5. A resposta traz `podeSerOfertadoOnline` (a tela desliga o interruptor). A D4 confere o estado **final**: trocar o `kind` de um tipo online para CIRURGIA também é 400.
- **D12 Bloqueios** (`regras/recorrencia.ts`, `bloqueios.service.ts`):
  - **Instante com offset obrigatório** no corpo (sem offset, 400) e gravado ao minuto. A hora de parede da série é lida do instante no fuso do estabelecimento e reconstruída no mesmo fuso em cada dia (por isso o almoço das 12:00 fica às 12:00 dos dois lados da troca de horário).
  - **Leitura por período** (`de` e `ate`, até 62 dias), não por um dia: o bloqueio único de vários dias (férias) aparece em todo dia que cobre, e a ocorrência que atravessa a meia-noite aparece no dia seguinte. O `materializarBloqueios` do portal só olhava o dia de início. 400 `AGENDA_PERIODO_INVALIDO` fora disso.
  - **Limites:** ocorrência de série até 24 h; bloqueio único até 366 dias; 400 `BLOQUEIO_INVALIDO` com `reason`.
  - **Filtro** por profissional ou sala traz também os bloqueios da clínica toda (sem profissional e sem sala).
  - **"Só neste dia":** `DELETE ?somenteEm` grava a exceção (repetir o dia não faz nada); `PATCH ?somenteEm` grava a exceção e cria um bloqueio único com o que mudou, que é a resposta (outro `id`, `criadoPorId` de quem editou). `somenteEm` em bloqueio único: 400 `BLOQUEIO_NAO_RECORRENTE`; dia sem ocorrência: 400 `BLOQUEIO_SEM_OCORRENCIA`.
  - **Série inteira:** `PATCH` sem `somenteEm` muda a regra (inclusive o passado); `excecoes` no corpo substitui os dias cancelados (desfazer um dia apagado por engano). Virar único (`diasDaSemana: []`) limpa repetição e exceções.
  - **Concorrência:** toda escrita numa série trava a linha dela (`FOR UPDATE`) e relê na transação; duas exceções ao mesmo tempo ficam as duas (integração).
  - Ocorrência inteira dentro da hora que não existe (o relógio adianta) some, em vez de virar faixa de zero minuto.
  - Sem `FERIADO` em `MotivoBloqueio` (feriado é dia especial da E1-01, D5).
- **D13 Expediente** (`regras/expediente.ts`): sem intervalo próprio (o almoço do profissional é um bloqueio recorrente); dia especial fechado zera; dia especial com horário corta a faixa própria (interseção); a faixa própria pode passar do horário do estabelecimento (só avisa na E3-02, D-E3.1). `PUT` trava a linha do profissional antes de trocar as linhas.
- **D14 Política** (`regras/politica.ts`): limites que a v0.1 não tinha, `granularidadeMinutos` em 5, 10, 15, 20, 30 ou 60 (divide a hora) e `confirmacaoAbreHorasAntes` de 12 a 168 h. Os limites ficam no service, não no DTO, para o 400 sair com `codigo` (`POLITICA_FORA_DO_LIMITE` com `campo` e `min`/`max` ou `opcoes`). A resposta traz `personalizada` e `limites`. O `POLITICA_PADRAO` do código é conferido contra os defaults das colunas num teste.
- **D15 Sem trilha clínica.** Configuração não é registro clínico (E1-05); as escritas ficam no log `[Agenda]` sem texto livre.
- **D16 Seed de demonstração** na clínica do seed ("Clínicas PetJourney"): as 8 salas e os 7 tipos do protótipo, idempotente; `ofertadoOnline` decidido aqui (o mock não tinha o campo): consulta, retorno, vacinação e banho.

### Revisão de segurança (v0.3, 2026-10-21)

Auditoria de 2026-10-21 (achados `SEG-2026-10-21-AGENDA-BLOQUEIOS-SEM-TETO`, ALTO, e parte de `SEG-2026-10-21-ONDA2-BAIXOS`, em `qa/seguranca/achados.json`). O `criar` não tinha teto por parceiro, a leitura não tinha `take` nem tamanho máximo, `ocorrencias()` (que a E3-02 chama direto) não conferia os 62 dias e o "só neste dia" acrescentava exceções sem fim. Com 500 séries diárias, um GET de 62 dias gastava ~2,9 s de CPU síncrona e devolvia 3,4 MB, travando o event loop da API inteira.

- **D17 Tetos dos bloqueios** (`regras/recorrencia.ts`, constantes com nome):
  - **300 séries vivas por parceiro** (`MAX_SERIES_ATIVAS`). Viva = se repete e não terminou antes de hoje no fuso do estabelecimento (`serieAtiva`): a série encerrada é histórico e não entra no teto, para a clínica de anos não ficar travada. Passa pelo teto: criar série viva, único que vira série, série encerrada que ganha fim novo. A 301ª: 409 `BLOQUEIO_SERIES_NO_LIMITE` com `maxSeries`. Concorrência: a escrita trava a linha do `Parceiro` (`FOR NO KEY UPDATE`, que serializa só quem conta e não barra as FKs para o parceiro) e conta depois, numa consulta separada (nunca `COUNT` com `FOR UPDATE`, incidente de 2026-10-21); no `PATCH`, a linha do bloqueio é travada antes da do parceiro, sempre na mesma ordem. Bloqueio único não tem teto próprio (o limite de escrita segura).
  - **5.000 ocorrências por leitura** (`MAX_OCORRENCIAS_POR_LEITURA`): passou, 400 `BLOQUEIO_OCORRENCIAS_DEMAIS` com `maxOcorrencias` (período menor ou filtro). A materialização para assim que passa, sem terminar a conta. O `findMany` lê no máximo 5.001 regras candidatas (mais que isso já é o mesmo 400).
  - **366 dias cancelados por série** (`MAX_EXCECOES_POR_SERIE`), no `DELETE` e no `PATCH ?somenteEm`: 409 `BLOQUEIO_EXCECOES_NO_LIMITE` com `maxExcecoes`. Repetir um dia já cancelado continua idempotente. O `PATCH` da série já limitava `excecoes` a 366 no DTO.
  - **120 escritas de bloqueio por usuário por hora** (`ESCRITAS_DE_BLOQUEIO_POR_HORA`; POST, PATCH e DELETE somados) no balde do Postgres (`TaxaService`, chave `agenda-bloqueio:<usuario>`, vale para todas as réplicas): 429 `BLOQUEIO_TAXA_EXCEDIDA` com `limite` e `tenteDeNovoEmSegundos`. Toda tentativa conta, antes do ownership. Ler não gasta o balde.
- **D18 Os limites da leitura moram em `ocorrencias()`**, não só no `listar`: 62 dias (inclusive data malformada, que antes passava como `NaN`), o `take` e as 5.000 ocorrências. A E3-02 chama `ocorrencias()` sem passar pelo HTTP e herda os três.
- **D19 Custo da materialização:** o `molde` (hora de parede e duração da série) é calculado uma vez por série, não a cada ocorrência; a materialização vai em lotes de 10 regras e o DTO em lotes de 500 ocorrências, cedendo o event loop (`setImmediate`) entre eles, para a leitura máxima não segurar as outras requisições de uma vez. Medição (`materializarBloqueios` + `isoNoFuso` + JSON, funções puras, a mesma máquina):

  | Cenário | Antes | Depois |
  |---|---|---|
  | 500 séries diárias, 61 dias | 2,8 s (1,8 s materializar + 1,0 s `isoNoFuso`), 30.500 ocorrências, 3,4 MB | recusa (400) em 0,2 a 0,33 s |
  | 2.000 séries diárias, 61 dias | ~11 s, 122.000 ocorrências, 13,8 MB | recusa (400) em 0,18 a 0,24 s |
  | Maior leitura aceita: 80 séries diárias, 61 dias (4.880 ocorrências, `detalhe` de 200 caracteres) | (sem teto) | 0,33 a 0,45 s de CPU no total, em blocos de 16 a 40 ms, 2,2 MB |

  Pelo banco de dev (integração e smoke na porta 3100): 4.787 a 4.795 ocorrências em 16 dias responderam em 0,7 a 1,05 s, 1,1 MB.
- **D20 Ids no corpo e na query** (`profissionalId`, `salaId`, `salaPadraoId`, `parceiroId`): `@Length(1, 60)`; vazio é 400 do validador. Os services comparam com `undefined`/`null`, não com "falsy": `salaPadraoId: ""` pulava o ownership e dava 500 na FK (P2003); `profissionalId: ""` no bloqueio virava "clínica toda". No `deny()` do `OwnershipService`, o id que não é `[\w.:-]{1,100}` sai entre aspas, escapado (JSON, não-ASCII como `\uXXXX`) e cortado em 100 caracteres: quebra de linha ou `reason=` no id não forjam linha nem campo no log.

## Modelo de dados (aditivo)

```prisma
enum TipoSala { CONSULTORIO CIRURGIA BANHO INTERNACAO EXAME }
enum KindAtendimento { CONSULTA RETORNO VACINA EXAME CIRURGIA BANHO EMERGENCIA }
enum MotivoBloqueio { ALMOCO REUNIAO FERIAS MANUTENCAO BLOQUEIO_PESSOAL OUTRO }

model Sala {
  id         String   @id @default(cuid())
  parceiroId String
  nome       String
  tipo       TipoSala
  ativa      Boolean  @default(true)
  ordem      Int      @default(0)
}

model TipoDeAtendimento {
  id                 String          @id @default(cuid())
  parceiroId         String
  nome               String
  kind               KindAtendimento
  duracaoMinutos     Int
  salasCompativeis   TipoSala[]      // vazio = qualquer sala
  permiteEncaixe     Boolean         @default(true)
  ofertadoOnline     Boolean         @default(false)
  ativo              Boolean         @default(true)
  ordem              Int             @default(0)
}

model ExpedienteDoProfissional {
  id              String  @id @default(cuid())
  profissionalId  String
  diaSemana       Int
  trabalha        Boolean @default(true)
  inicio          String? // HH:mm
  fim             String?
  @@unique([profissionalId, diaSemana])
}

model BloqueioDeAgenda {
  id              String         @id @default(cuid())
  parceiroId      String
  profissionalId  String?
  salaId          String?
  inicio          DateTime       // instante (com fuso do estabelecimento na leitura)
  fim             DateTime
  motivo          MotivoBloqueio
  detalhe         String?
  diasDaSemana    Int[]          // recorrência semanal; vazio = único
  repeteAte       DateTime?      @db.Date
  excecoes        DateTime[]     @db.Date
  criadoPorId     String
  @@index([parceiroId, inicio])
}

model PoliticaDaAgenda {
  parceiroId                String @id
  granularidadeMinutos      Int    @default(10)
  cancelarAteHorasAntes     Int    @default(2)
  reservaMinutos            Int    @default(5)
  preConsultaAbreHorasAntes Int    @default(72)
  ofertaDeVagaMinutos       Int    @default(30)
  confirmacaoAbreHorasAntes Int    @default(48)
  atualizadoEm              DateTime @updatedAt
}
```

## Rotas (`@ExigeModulo(CLINICA)`; leitura `agenda.ler`, escrita `estabelecimento.editar` ou `agenda.escrever` conforme abaixo)

| Método e rota | Permissão | Descrição |
|---|---|---|
| `GET /parceiro/portal/clinica/salas` | `agenda.ler` (D6) | Salas; `?ativas=true` |
| `POST/PATCH /parceiro/portal/clinica/salas[/:id]` | `estabelecimento.editar` | Salas (desativam, nunca se apagam, D9); `Idempotency-Key` no POST |
| `GET /parceiro/portal/clinica/tipos-de-atendimento` | `agenda.ler` (D6) | Tipos; `?ativos=true&ofertadoOnline=true` |
| `POST/PATCH /parceiro/portal/clinica/tipos-de-atendimento[/:id]` | `estabelecimento.editar` | Tipos; `ordem` para a legenda (L1 do doc 01); `Idempotency-Key` no POST |
| `GET /parceiro/portal/profissionais/:id/expediente` | `agenda.ler` (D7) | Os 7 dias resolvidos e a sala padrão |
| `PUT /parceiro/portal/profissionais/:id/expediente` | `estabelecimento.editar` | Só os dias que diferem (D2) e a sala padrão (D8); módulo CLINICA também aqui |
| `GET /parceiro/portal/clinica/bloqueios?de=&ate=&profissionalId=&salaId=` | `agenda.ler` | Já materializados no período (até 62 dias, D12) |
| `GET /parceiro/portal/clinica/bloqueios/:id` | `agenda.ler` (D7) | A regra, para editar |
| `POST /parceiro/portal/clinica/bloqueios` | `agenda.escrever` | Único ou recorrente; `Idempotency-Key` |
| `PATCH/DELETE /parceiro/portal/clinica/bloqueios/:id` | `agenda.escrever` | `?somenteEm=YYYY-MM-DD` cria exceção em vez de mexer na série (D12) |
| `GET/PUT /parceiro/portal/clinica/politica` | `agenda.ler` / `estabelecimento.editar` | Política com limites (cancelar 0 a 72 h; reserva 2 a 15 min; pré-consulta 12 a 168 h; oferta 10 a 240 min; confirmação 12 a 168 h; grade 5 a 60 min, D14) |

## Acceptance Criteria

- [x] **Given** bloqueio de almoço recorrente de segunda a sexta, 12:00 a 13:00, com exceção na quarta **When** lê a semana **Then** aparecem 4 ocorrências. *Golden test em `regras/recorrencia.spec.ts` ("AC1"), service em `bloqueios.service.spec.ts`, integração no Postgres de dev ("AC1 no banco", com a exceção gravada pelo `DELETE ?somenteEm`) e HTTP no `scripts/smoke-agenda-config.ts`.*
- [ ] **Given** expediente da Ana só terça e quinta **Then** a agenda de segunda não a oferece no pedido online e não gera slot dela. *Parcial: a regra está pronta e testada (`faixasDoProfissional` devolve nenhuma faixa na segunda, em `regras/expediente.spec.ts` "AC2"; expediente gravado e lido na integração e no smoke). Gerar slot e oferecer no pedido online é da E3-02 e da E3-05, que têm de chamar `faixasDoProfissional` com `ExpedienteService.linhas`.*
- [x] **Given** um tipo com `kind=CIRURGIA` **When** marcado `ofertadoOnline=true` **Then** 400 `TIPO_NAO_OFERTAVEL_ONLINE`. *`salas-e-tipos.service.spec.ts` (criar e PATCH pelo estado final), integração e smoke.*
- [x] **Given** política nova com `reservaMinutos=20` **Then** 400 (fora do limite). *400 `POLITICA_FORA_DO_LIMITE` com `campo`, `min`, `max`: `regras/politica.spec.ts`, `politica-e-expediente.service.spec.ts`, integração e smoke.*
- [ ] Sala com agendamento futuro não se apaga: só se desativa, e a agenda avisa os agendamentos dela (conflito `type-room-mismatch`). *Parcial: sala nunca se apaga (sem `DELETE`, D9; desativar por `PATCH` testado no service, na integração e no smoke). O aviso `type-room-mismatch` é da E3-02 (o agendamento ainda não existe).*

## Estratégia de Testes

- Unit:
  - golden tests de `materializarBloqueios` (porte do `conflicts.spec` do portal mais exceção, fim da série, virada de dia, férias de vários dias, `Europe/London` nas duas trocas de horário, `America/Manaus`, `Asia/Dubai`, `America/Noronha`);
  - validação da política (e `POLITICA_PADRAO` contra o schema);
  - expediente do profissional sobre o do estabelecimento, com dia especial e feriado;
  - services (ownership, "só neste dia", contrato de datas com offset por `datasEmUtc`);
  - metadados dos controllers (módulo, permissão por rota, idempotência, `audit:endpoints`);
  - os três `assert*DoParceiro` (`src/auth/services/ownership.agenda-parceiro.spec.ts`).
- Integração (`agenda-configuracao.integration.spec.ts`, Postgres de dev): índice parcial do nome, `DATE[]` de ida e volta, filtro de candidatos, `FOR UPDATE` com duas exceções simultâneas, dois PUT de expediente simultâneos, isolamento entre parceiros, upsert da política, seed; resíduo zero no `afterAll`.
- HTTP: `npm run script:smoke-agenda-config` (sem módulo, papel sem permissão, recurso de outro parceiro, `Idempotency-Key`, en-GB).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + `prisma/migrations/20261021120000_agenda_configuracao/` | Modificar / criar |
| `src/agenda/configuracao/` (controllers, services, `apoio.ts`, `dto/`, `regras/recorrencia.ts`, `regras/expediente.ts`, `regras/politica.ts`, `regras/catalogo.ts`, `regras/demonstracao.ts`, testes) | Criar |
| `src/auth/services/ownership.service.ts` + `ownership.agenda-parceiro.spec.ts` | `assertSalaDoParceiro`, `assertTipoDoParceiro`, `assertBloqueioDoParceiro` |
| `src/common/errors/error-catalog.ts`, `codigos-clinicos.ts` | 10 códigos novos nos 6 locales |
| `src/app.module.ts` | `AgendaConfiguracaoModule` |
| `prisma/seed.ts` | Tipos e salas de exemplo para a conta de demonstração |
| `scripts/smoke-agenda-config.ts`, `package.json` | Smoke HTTP |
| `qa/cenarios/portal-parceiro.json` | Cenários `REG-AGENDA-*` |
| `docs/frontend/novembro-2026/portal-parceiro-e3.md` | Handoff do portal |

## Tasks

- [x] **T1** Migration + seed de demonstração
- [x] **T2** CRUDs com permissões e ownership (`assertSalaDoParceiro`, `assertTipoDoParceiro`, `assertBloqueioDoParceiro`)
- [x] **T3** Recorrência com exceções (golden tests de `materializarBloqueios`)
- [x] **T4** Política com limites
- [x] **T5** Testes e handoff (telas de configuração)

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Médio | Recorrência de bloqueio errada no horário de verão ou na virada de semana | Materialização com fuso IANA e testes com `Europe/London`; exceção por dia em vez de editar a série |
| Baixo | Mudança de política surpreender agendamentos existentes | D1: a política nova vale para o que for criado depois; o handoff documenta como o app mostra o prazo |
| Baixo | Estabelecimento trocar o fuso depois de criar séries: a hora de parede é lida do instante gravado no fuso atual, então a série desliza pela diferença | Troca de fuso é correção rara de cadastro; se virar caso real, a E1-01 avisa e oferece reancorar as séries (pergunta Q1 abaixo) |

## Perguntas em Aberto

- [ ] **Q2** O teto de 5.000 ocorrências por leitura vale para a grade do mês da E3-02? Uma clínica com 80 séries diárias chega perto em 62 dias; se a E3-02 precisar de mais, o caminho é ler por semana, não subir o teto (a leitura máxima já custa até ~0,45 s de CPU). Responsável: Nicolas, na E3-02.

- [ ] **Q1** Quando o DONO troca o fuso do estabelecimento, as séries de bloqueio devem manter a hora de parede (reancorar) ou o instante (como hoje)? Responsável: Nicolas, antes de ligar o módulo para clínica fora de `America/Sao_Paulo`.

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.3 | Revisão de segurança (achado ALTO dos bloqueios e baixos): D17 a D20 (tetos de 300 séries vivas, 5.000 ocorrências por leitura, 366 dias cancelados e 120 escritas por usuário por hora; limites dentro de `ocorrencias()`; molde por série e materialização em lotes; ids com tamanho e log do DENY escapado), medição antes e depois, Q2. Integração e smoke com os tetos; handoff atualizado | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementação da API (T1 a T5) em dev: migration `20261021120000_agenda_configuracao`, rotas, regras com golden tests, integração no Postgres de dev, smoke 41/41 e handoff `docs/frontend/novembro-2026/portal-parceiro-e3.md`. Decidido na implementação: D6 a D16; AC2 e AC5 parciais (o consumo é da E3-02 e da E3-05); Q1 aberta | Nicolas (via Claude) |
| 2026-10-21 | 0.4 | Fechada do lado da API depois da revisão de segurança (achados corrigidos e conferidos: `npm test` 6378, integração 21/21 no dev, smoke 52/52). AC2 e AC5 seguem parciais até a E3-02; Q1 e Q2 com o Nicolas | Claude |
