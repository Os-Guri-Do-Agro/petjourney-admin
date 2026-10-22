# Spec: Atendimento e prontuário eletrônico estruturado

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E4 prontuário](../../../../../epicos/portal-parceiro-e4-prontuario.md)
**Depende de:** [E3-02 agenda](../e3-agenda/02-agenda-e-agendamentos.md) (iniciar), [E4-02 catálogos](02-catalogos-clinicos.md), [E2-04 publicação](../e2-pacientes-e-ponte/04-publicacao-no-app.md), [E1-05 trilha](../e1-fundacao/05-trilha-de-auditoria-clinica.md)

---

## Visão Geral

O atendimento ("encounter" do portal) nasce de um agendamento ou avulso e tem cinco etapas: anamnese, exame físico, diagnóstico, conduta e impressão. O servidor faz:
- **autosave** por seção, com versão e um dispositivo editando por vez (o segundo entra em leitura e pode assumir);
- **finalizar**, que fecha;
- **adendo** e **anulação** depois de finalizado;
- **liberar resumo** ao responsável, num passo separado;
- **retorno**, que cai na agenda;
- **atos executados**, como medicação aplicada na hora e curativo;
- **linha do tempo** do paciente, filtrável.

## Motivação

O doc 03 do portal considera o prontuário "a decisão mais importante do produto". O protótipo cobre:
- 5 etapas;
- revisão de sistemas;
- 8 sistemas no exame físico com `normal`, `alterado` e `nao-avaliado`;
- faixas de referência por espécie, porte e idade;
- `não aferido` como informação;
- mucosas e hidratação no exame;
- diagnósticos presuntivo, definitivo e diferencial;
- conduta com prescrição e dose calculada;
- pré-consulta como sugestão;
- autosave de 800 ms;
- rascunho local;
- disputa entre dispositivos;
- modo teclado.

Os tipos estão em `petjourney-admin/src/features/clinico/data/types.ts:703-1008` e `:1377-1425`, e o repositório em `data/repositories/encounter-repository.ts`.

---

## Research Findings

- **Do portal:**
  - `Anamnese`: queixa, história livre, duração, evolução, antecedentes tipados, apetite, evacuação, micção, ambiente, vacinação e vermifugação em dia (`types.ts:800-812`).
  - `ExameFisico`: vitais (`peso`, `temperatura`, `frequenciaCardiaca`, `frequenciaRespiratoria`, `tempoPreenchimentoCapilar`, `escoreCorporal`, `pressaoSistolica`) com `Measurement { valor, naoAferido }`, mucosas, hidratação, sistemas, observação (`:711-844`).
  - `Diagnosis { codigo, descricao, kind }`; `CarePlan { orientacoes, prescricoes, examesSolicitados, retorno { emDias, typeId, appointmentId } }`.
  - `EncounterLock { deviceId, deviceLabel, desde }`, `versao`, `resumoLiberadoEm`.
  - Defeito P7 do doc 03: "Agendar retorno" não criava o retorno. A API cria e liga.
  - `AtoClinico` com `realizadoEm` obrigatório e origem `clinica`, `internacao`, `vacina`, `avulso` (`:960-1008`).
  - O doc 06 lista as divergências com o contrato da anotação (máximo 10 prescrições, exames com nome, sem via). Elas não se aplicam aqui, porque este prontuário é da clínica e não passa pela anotação. A publicação (E2-04) é que mapeia para `ConsultaPrescricaoItem`.
- **API:** nada de prontuário da clínica. `Consulta` é o registro do app (escrito pelo responsável ou publicado). Enums do diário (`ConsumoDiario`, `AspectoFezes`, `EstadoUrina`, `VitalidadePet`) já existem e servem à anamnese (doc 06, seção 2).

**Breaking changes:** nenhuma.

## Decisões

- **D1 Tabelas** (D-E4.1): `Atendimento` (cabeçalho e conduta), `AnamneseDoAtendimento` 1:1 (colunas), `ExameFisicoDoAtendimento` 1:1 (uma coluna por vital com `naoAferido` por vital), `AchadoDeSistema` N, `AntecedenteDoAtendimento` N, `DiagnosticoDoAtendimento` N, `PrescricaoDoAtendimento` N (com o cálculo de dose), `ExameSolicitadoDoAtendimento` N, `AtoClinico` N.
- **D2 Enums do app onde já existem.** Apetite usa `ConsumoDiario`; evacuação, `AspectoFezes`; micção, `EstadoUrina`; evolução, `EvolucaoDaQueixa` (E3-07). O mapa do portal (`domain/pre-consulta.ts`) vira golden test. Isso fecha a recomendação do doc 06 do portal ("inventei escalas próprias onde o app já tem enums fechados").
- **D3 Autosave por seção com versão.** `PATCH .../atendimentos/:id` com `{ secao, dados, versao, dispositivoId }`; 409 `ATENDIMENTO_ALTERADO` com o estado atual quando a versão diverge.
- **D4 Edição exclusiva.** O primeiro dispositivo ganha o lock (TTL de 10 min, renovado a cada gravação). O segundo recebe `somenteLeitura: true` com `lock.dispositivoRotulo` e pode chamar `assumir-edicao`, que avisa o primeiro na próxima gravação dele (409 `EDICAO_ASSUMIDA`).
- **D5 Finalizar exige `prontuario.finalizar`** (profissional com CRMV) e as etapas mínimas: queixa, pelo menos um diagnóstico ou "sem diagnóstico" explícito, e conduta. Finalizado congela tudo; adendo cria `AdendoDoAtendimento`; anular exige motivo, retira a publicação (E2-04 `anular`) e mantém o registro visível como anulado.
- **D6 Liberar resumo é separado** (D-E4.2) e exige `resumo.liberar`. Publica a `Consulta` pelo E2-04.
- **D7 Retorno cria o agendamento.** `POST .../retorno` com `{ emDias, tipoId, inicio?, profissionalId? }`: sem `inicio`, usa as sugestões da E3-02 a partir da data; grava `retornoAgendamentoId`, e o aviso de pendência some. Sem horário, oferece a fila (E3-04).
- **D8 Atos executados** são registros próprios com hora obrigatória; vacina e internação entram na linha do tempo derivados dos registros deles, não duplicados (decisão do portal em `types.ts:962-975`).
- **D9 Linha do tempo da clínica** derivada (atendimentos, vacinas, exames, cirurgias, prescrições, faltas, internações, observações), com filtro por tipo e contagem (P4 do doc 03).

## Modelo de dados (principal, aditivo)

```prisma
enum StatusAtendimento { RASCUNHO FINALIZADO ANULADO }
enum KindDiagnostico { PRESUNTIVO DEFINITIVO DIFERENCIAL }
enum StatusAchado { NORMAL ALTERADO NAO_AVALIADO }
enum SistemaClinico { CARDIOVASCULAR RESPIRATORIO DIGESTORIO URINARIO TEGUMENTAR LOCOMOTOR NEUROLOGICO LINFONODOS }
enum Mucosa { NORMOCORADAS PALIDAS ICTERICAS CIANOTICAS CONGESTAS NAO_AVALIADO }
enum GrauHidratacao { NORMAL LEVE MODERADA GRAVE }
enum KindAntecedente { CIRURGIA DOENCA_PREVIA ALERGIA MEDICACAO_CONTINUA REACAO_VACINAL TRAUMA OUTRO }

model Atendimento {
  id                   String            @id @default(cuid())
  parceiroId           String
  pacienteId           String
  agendamentoId        String?           @unique
  profissionalId       String
  status               StatusAtendimento @default(RASCUNHO)
  abertoEm             DateTime          @default(now())
  finalizadoEm         DateTime?
  finalizadoPorId      String?
  anuladoEm            DateTime?
  motivoAnulacao       String?
  resumoLiberadoEm     DateTime?
  orientacoes          String?           // vai ao responsável
  observacaoInterna    String?           // nunca vai
  retornoEmDias        Int?
  retornoTipoId        String?
  retornoAgendamentoId String?
  versao               Int               @default(1)
  lockDispositivoId    String?
  lockDispositivoRotulo String?
  lockUsuarioId        String?
  lockAte              DateTime?
  @@index([parceiroId, status])
  @@index([pacienteId, abertoEm])
}

model AnamneseDoAtendimento {
  atendimentoId     String  @id
  queixaPrincipal   String?
  historia          String?
  duracao           String?
  evolucao          EvolucaoDaQueixa?
  apetite           ConsumoDiario?
  evacuacao         AspectoFezes?
  miccao            EstadoUrina?
  ambiente          String? // DOMICILIAR | EXTERNO | MISTO
  vacinacaoEmDia    Boolean?
  vermifugacaoEmDia Boolean?
  origemDosCampos   Json?   // procedência por campo: VET | PRE_CONSULTA | ESCUTA (P8 do épico pai)
}

model ExameFisicoDoAtendimento {
  atendimentoId         String   @id
  pesoKg                Decimal? @db.Decimal(6, 2)
  pesoNaoAferido        Boolean  @default(false)
  temperaturaC          Decimal? @db.Decimal(4, 1)
  temperaturaNaoAferida Boolean  @default(false)
  // idem para FC, FR, TPC, escore corporal, pressão sistólica
  mucosas               Mucosa?
  hidratacao            GrauHidratacao?
  observacao            String?
}

model AchadoDeSistema { atendimentoId String; sistema SistemaClinico; status StatusAchado; nota String?; @@id([atendimentoId, sistema]) }
model DiagnosticoDoAtendimento { id String @id @default(cuid()); atendimentoId String; codigo String?; descricao String; kind KindDiagnostico }
model AntecedenteDoAtendimento { id String @id @default(cuid()); atendimentoId String; kind KindAntecedente; descricao String; quando String? }
model AdendoDoAtendimento { id String @id @default(cuid()); atendimentoId String; texto String; autorProfissionalId String; autorUsuarioId String; em DateTime @default(now()) }
model AtoClinico { id String @id @default(cuid()); parceiroId String; pacienteId String; atendimentoId String?; internacaoId String?; kind String; medicamentoId String?; descricao String; via String?; doseTexto String?; realizadoEm DateTime; profissionalId String?; origem String; observacao String? }
```

(As linhas de modelo em uma linha só são abreviação desta spec; na migration, um campo por linha.)

`PrescricaoDoAtendimento` e `ExameSolicitadoDoAtendimento` estão na E4-03 e na E4-06.

## Rotas (`@ExigeModulo(CLINICA)`)

| Método e rota | Permissão | Descrição |
|---|---|---|
| `POST /parceiro/portal/clinica/atendimentos` | `prontuario.escrever` | Avulso `{ pacienteId, profissionalId }`; o de agendamento nasce pelo `iniciar` da E3-02 |
| `GET /parceiro/portal/clinica/atendimentos/:id` | `prontuario.ler` | Tudo + `somenteLeitura`, `lock`, pré-consulta (E3-07), consulta anterior resumida, faixas de referência aplicáveis (E4-02) com o status calculado de cada vital |
| `PATCH /parceiro/portal/clinica/atendimentos/:id` | `prontuario.escrever` | D3 |
| `POST .../atendimentos/:id/assumir-edicao` e `/liberar-edicao` | `prontuario.escrever` | D4 |
| `POST .../atendimentos/:id/finalizar` | `prontuario.finalizar` | D5 |
| `POST .../atendimentos/:id/adendos` | `prontuario.escrever` | Depois de finalizado |
| `POST .../atendimentos/:id/anular` | `prontuario.finalizar` | `{ motivo }` |
| `POST .../atendimentos/:id/liberar-resumo` | `resumo.liberar` | D6 (publica) |
| `POST .../atendimentos/:id/retorno` | `agenda.escrever` | D7 |
| `POST .../atendimentos/:id/atos` e `POST /parceiro/portal/pacientes/:id/atos` | `prontuario.escrever` | Ato na consulta ou avulso (com `origem=AVULSO` quando a clínica não viu) |
| `GET /parceiro/portal/pacientes/:id/linha-do-tempo?tipos=` | `prontuario.ler` | D9 |
| `GET /parceiro/portal/clinica/atendimentos?status=RASCUNHO&profissionalId=` | `prontuario.ler` | Rascunhos abertos (contador da E1-06) |
| `GET /parceiro/portal/clinica/retornos-pendentes` | `agenda.ler` | Retornos sugeridos sem agendamento |

**Responsável:** `GET /tutor/clinica/atendimentos?petId=` e `GET /tutor/clinica/atendimentos/:id`. Devolvem o `ResumoDoAtendimento` do contrato, só os liberados: orientações, diagnósticos não diferenciais, receita (E4-03), exames solicitados, retorno sugerido, documentos (E4-06) e `consultaId` da publicação.

## Acceptance Criteria

- [ ] **Given** dois dispositivos abrindo o mesmo atendimento **Then** o segundo recebe `somenteLeitura: true` com o rótulo do primeiro; ao assumir, a próxima gravação do primeiro dá 409 `EDICAO_ASSUMIDA`.
- [ ] **Given** `PATCH` com versão velha **Then** 409 `ATENDIMENTO_ALTERADO` com o estado atual.
- [ ] **Given** temperatura 39,8 °C em cão médio adulto **Then** a leitura traz o vital com status `acima` calculado pela faixa mais específica (E4-02); com `naoAferido=true` **Then** `nao-aferido`, nunca "dentro".
- [ ] **Given** finalizar sem queixa **Then** 422 `ATENDIMENTO_INCOMPLETO` com a lista do que falta.
- [ ] **Given** finalizado **When** `PATCH` **Then** 409 `ATENDIMENTO_FINALIZADO`; adendo cria registro com autor e hora.
- [ ] **Given** anular um atendimento com resumo liberado **Then** a `Consulta` do app some e sai `CLINICA_ANULOU_REGISTRO` (E2-04).
- [ ] **Given** retorno em 15 dias **When** chama `retorno` sem `inicio` **Then** nasce o agendamento no primeiro horário livre do mesmo profissional a partir do 15º dia (avançando dia fechado), e `retornoAgendamentoId` é gravado.
- [ ] **Given** RECEPCAO **When** lê o atendimento **Then** 403 (matriz da E1-03).
- [ ] O resumo do app nunca tem `observacaoInterna`, diagnóstico diferencial nem mg/kg (teste de forma, junto da D7 da E2-04).
- [ ] Toda leitura e escrita gera trilha (E1-05), com os nomes dos campos alterados no `PATCH`.

## Estratégia de Testes

- Unit: validação por seção, lock e assumir, finalizar com mínimos, adendo, anulação, retorno, linha do tempo com filtro, mapa da pré-consulta.
- Integration: dois `PATCH` concorrentes; finalizar e liberar na mesma transação de publicação.
- Cenários: outro parceiro, recepção, ex-membro.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/prontuario-clinico/` (controller, service por seção, lock, `regras/finalizacao.ts`, `regras/linha-do-tempo.ts`) | Criar |
| `src/auth/services/ownership.service.ts` | `assertAtendimentoDoParceiro` |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Abrir, ler, autosave por seção com versão
- [ ] **T3** Lock de dispositivo
- [ ] **T4** Finalizar, adendo, anular
- [ ] **T5** Liberar resumo (E2-04) e rotas do responsável
- [ ] **T6** Retorno, atos, linha do tempo, rascunhos, retornos pendentes
- [ ] **T7** Testes, cenários, contadores, handoff

## Rollout / Rollback

Aditivo, atrás do módulo. Gate de produção do épico pai: parecer sobre prontuário (Q-JUR1) antes de ligar para cliente real.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Prontuário de um parceiro lido por outro ou pela recepção | `assertAtendimentoDoParceiro`, matriz da E1-03 e cenários por papel |
| Alto | Perda de digitação por conflito entre dispositivos | Lock com TTL e "assumir edição" explícito; a versão otimista devolve o estado atual para o portal oferecer a mescla |
| Médio | Resumo liberado com informação interna | D7 da E2-04 (teste de forma) e `observacaoInterna` separada de `orientacoes` |

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
