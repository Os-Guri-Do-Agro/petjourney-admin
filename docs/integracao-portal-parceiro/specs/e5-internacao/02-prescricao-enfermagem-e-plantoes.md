# Spec: Prescrição de internação, checklist de enfermagem, evolução e passagem de plantão

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E5 internação](../../../../../epicos/portal-parceiro-e5-internacao.md)
**Depende de:** [E5-01 leitos e internação](01-leitos-e-internacao.md), [E4-02 catálogos](../e4-prontuario/02-catalogos-clinicos.md) (medicamentos)

---

## Visão Geral

O trabalho do plantão:
- **prescrever por horário** (medicamento, fluido contínuo, monitoramento, alimentação, procedimento), com os horários materializados;
- **checklist** agrupado por horário, com a linha do agora;
- **registrar** feita, pulada, recusada (o gato que cospe o comprimido) ou desfazer, com quem executou e em que plantão;
- **suspender** com motivo;
- **evolução** por paciente e por plantão, com os vitais do turno;
- **plantões** com passagem de turno: pendências congeladas na entrega e trava enquanto houver dose sem dono na troca.

## Motivação

Tipos do portal: `PrescricaoDeInternacao` (kind, medicamento, descrição, via, dose em texto, frequência, `continuo`, primeiro horário, encerra em, suspensa em e motivo), `AdministracaoAgendada` (prevista, status `pendente`, `feita`, `pulada`, `recusada`, `suspensa`; executada em e por; plantão), `Plantao` (kind manhã, tarde ou noite, responsável, entregue em, recebido por, nota, pendências entregues) e `EvolucaoDeInternacao` (`types.ts:1726-1864`).

Decisões do doc 07 do portal:
- tolerância de 30 minutos;
- `atravessaAPassagem`: a dose em cima da troca trava a entrega;
- a passagem congela as pendências;
- o atraso é lido, nunca gravado.

---

## Decisões

- **D1 Materializar os horários na criação da prescrição** até 72 h à frente, e completar por cron de hora em hora (advisory lock) enquanto a prescrição estiver ativa. Suspender marca as futuras como `SUSPENSA` e não toca nas passadas.
- **D2 Fluido contínuo** gera **conferências** de hora em hora (não administrações).
- **D3 Dose recalculada sobre o peso de entrada** da internação, com o cálculo da E4-02.
- **D4 Plantão é o `Turno` comum** (`contexto=INTERNACAO`), o mesmo modelo do hotel (E7-05), com os horários de início e fim do turno que entrega e do que assume (lacuna D16 do hotel, resolvida aqui para os dois).
- **D5 Passagem.** Entregar grava as pendências **daquele instante** (ids), exige quem recebe e a nota, e recusa com `DOSE_SEM_DONO_NA_PASSAGEM` enquanto houver administração na janela da troca sem atribuição.
- **D6 Execução fora do plantão previsto** registra o plantão em que caiu (`plantaoId` da execução), que pode diferir do previsto.

## Modelo de dados (aditivo)

```prisma
enum KindItemInternacao { MEDICAMENTO FLUIDO MONITORAMENTO ALIMENTACAO PROCEDIMENTO }
enum StatusAdministracao { PENDENTE FEITA PULADA RECUSADA SUSPENSA }
enum ContextoTurno { INTERNACAO HOTEL }
enum KindTurno { MANHA TARDE NOITE }

model PrescricaoDeInternacao {
  id              String             @id @default(cuid())
  internacaoId    String
  kind            KindItemInternacao
  medicamentoId   String?
  descricao       String
  via             String?
  doseTexto       String?
  frequenciaHoras Int
  continuo        Boolean            @default(false)
  primeiroHorario DateTime
  encerraEm       DateTime?
  prescritoPorId  String             // profissional com CRMV
  prescritoEm     DateTime           @default(now())
  suspensaEm      DateTime?
  motivoSuspensao String?
  observacao      String?
}

model AdministracaoDeInternacao {
  id            String              @id @default(cuid())
  internacaoId  String
  prescricaoId  String
  previstaPara  DateTime
  conferencia   Boolean             @default(false) // fluido contínuo
  status        StatusAdministracao @default(PENDENTE)
  executadaEm   DateTime?
  executadaPorId String?
  turnoId       String?
  observacao    String?
  @@unique([prescricaoId, previstaPara])
  @@index([internacaoId, previstaPara])
}

model Turno {
  id                  String        @id @default(cuid())
  parceiroId          String
  contexto            ContextoTurno
  kind                KindTurno
  inicio              DateTime
  fim                 DateTime
  responsavelId       String
  entregueEm          DateTime?
  recebidoPorId       String?
  notaDePassagem      String?
  pendenciasEntregues String[]
  @@index([parceiroId, contexto, inicio])
}

model EvolucaoDeInternacao {
  id             String   @id @default(cuid())
  internacaoId   String
  turnoId        String
  profissionalId String
  registradoEm   DateTime @default(now())
  vitais         Json     // mesmos vitais do exame físico, com naoAferido
  observado      String?  // o que o responsável quer ouvir
  avaliacao      String?
  plano          String?
  gravidade      Gravidade
  @@unique([internacaoId, turnoId])
}
```

(`vitais` em JSON aqui é exceção consciente à D-E4.1: é a foto do turno, consultada como bloco; os vitais do exame físico do atendimento continuam em colunas.)

## Rotas (`@ExigeModulo(CLINICA)`)

| Método e rota | Permissão | Descrição |
|---|---|---|
| `POST /parceiro/portal/clinica/internacoes/:id/prescricoes` | `internacao.prescrever` | Cria e materializa |
| `POST .../prescricoes/:pid/suspender` | `internacao.prescrever` | `{ motivo }` |
| `GET /parceiro/portal/clinica/internacoes/:id/checklist?de=&ate=` | `internacao.executar` | Agrupado por horário, com situação lida contra o relógio (`futura`, `na-janela`, `atrasada`, `feita`, `pulada`, `recusada`, `suspensa`) e `atravessaAPassagem` |
| `POST /parceiro/portal/clinica/administracoes/:id/registrar` | `internacao.executar` | `{ status: FEITA \| PULADA \| RECUSADA, observacao? }` |
| `POST /parceiro/portal/clinica/administracoes/:id/desfazer` | `internacao.executar` | Só quem registrou, no mesmo plantão |
| `POST /parceiro/portal/clinica/internacoes/:id/evolucoes` | `internacao.executar` | Uma por plantão (upsert) |
| `GET /parceiro/portal/clinica/turnos/atual?contexto=INTERNACAO` | `internacao.executar` | Plantão corrente, próximo, pendências |
| `POST /parceiro/portal/clinica/turnos/:id/entregar` | `internacao.executar` | `{ recebidoPorId, nota, atribuicoes[] }` (D5) |

Contador (E1-06): `dosesAtrasadasInternacao`.

## Acceptance Criteria

- [ ] **Given** prescrição de 8 em 8 h a partir das 06:00 **Then** existem administrações às 06:00, 14:00 e 22:00 de hoje e dos próximos 3 dias, sem duplicar no cron (unique).
- [ ] **Given** dose prevista às 14:00 e agora 14:31 **Then** a leitura diz `atrasada` sem que nada tenha sido gravado (tolerância de 30 min).
- [ ] **Given** recusa **Then** status `RECUSADA` distinto de `PULADA`.
- [ ] **Given** dose às 14:00 com passagem às 14:00 sem atribuição **When** entrega **Then** 409 `DOSE_SEM_DONO_NA_PASSAGEM`.
- [ ] **Given** a passagem entregue **Then** a lista congelada não muda mesmo depois que o turno seguinte resolve a pendência.
- [ ] **Given** suspender **Then** as futuras ficam `SUSPENSA` e as passadas mantêm o status e o executor.
- [ ] Prescrever exige CRMV (matriz da E1-03).

## Estratégia de Testes

- Unit: materialização, situação contra o relógio, passagem (golden tests de `internacao.spec`), evolução por turno.
- Integration: cron de materialização concorrente em 3 réplicas.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/internacao-clinica/prescricao/`, `src/turnos/` (compartilhado com o hotel) | Criar |

## Tasks

- [ ] **T1** Migration (inclui `Turno` comum)
- [ ] **T2** Prescrever, materializar, suspender, cron
- [ ] **T3** Checklist e registro
- [ ] **T4** Evolução
- [ ] **T5** Turnos e passagem; testes; handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Dose dada duas vezes ou não dada por erro de registro | Administração materializada única por horário (unique), registro com executor e plantão, desfazer só por quem registrou |
| Médio | Cron de materialização duplicar horários em 3 réplicas | Unique `(prescricaoId, previstaPara)` e advisory lock |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
