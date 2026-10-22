# Spec: Pré-consulta (o responsável responde antes, preenchida pelo diário)

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E3 agenda](../../../../../epicos/portal-parceiro-e3-agenda.md)
**Depende de:** [E3-02 agenda](02-agenda-e-agendamentos.md), [E2-03 leitura do app](../e2-pacientes-e-ponte/03-leitura-do-app-pela-clinica.md) (para a sugestão vinda do diário)

---

## Visão Geral

Um formulário curto que o responsável responde no app antes da consulta:
- motivo e queixa obrigatórios;
- o resto opcional: sintomas, desde quando, evolução, alimentação, hidratação, fezes, urina, vitalidade, peso de casa, observação e até 3 fotos.

Ele abre preenchido com o diário dos últimos 3 dias e o último peso. A clínica lê na anamnese como **sugestão**, com a procedência de cada valor.

## Motivação

"É o ponto onde o diferencial do produto aterrissa no prontuário" (doc 03 do portal, P6). O contrato está pronto:
- `RespostaDaPreConsulta`, `PreConsulta` e rotas `GET/PUT /tutor/clinica/agendamentos/:id/pre-consulta` e `POST .../pre-consulta/fotos` (`petjourney-admin/src/features/clinico/contrato/responsavel.ts:687-724`, `:1122-1124`; doc 09, seção 6);
- enums novos `DuracaoDaQueixa` e `EvolucaoDaQueixa` (`:286-297`);
- limites (`LIMITES_CLINICOS`: queixa 1000, observação 2000, 5 sintomas, 3 fotos de até 8 MB nos tipos da foto do diário).

O doc 06 confirma que 4 campos já são enums do Diário (`ConsumoDiario`, `AspectoFezes`, `EstadoUrina`, `VitalidadePet`).

---

## Decisões

- **D1 Modelo próprio, ligado ao agendamento.** Situação derivada da política: `AINDA_NAO_ABRIU`, `ABERTA` (72 h antes, `preConsultaAbreHorasAntes`), `RESPONDIDA`, `FECHADA` no início do agendamento. Editável até fechar.
- **D2 Sugestão só com diário no plano.** Sem plano com diário (`REQUIRED_NIVEL_DIARIO_PET = 3` no app), `sugestao: null` e o formulário vem vazio, sem "do seu diário".
- **D3 Procedência.** `camposDoDiario` lista o que veio da sugestão sem mudança; a clínica vê "do diário" nesses campos. Peso de casa nunca vira peso aferido (doc 03, P6).
- **D4 A pré-consulta não depende do consentimento do diário.** É o responsável enviando, no momento, para a consulta marcada. O consentimento contínuo (E2-02) é outra coisa.
- **D5 Fotos no bucket privado da clínica**, com URL assinada de 15 min para o portal; validação de tipo e tamanho como a foto do diário.

## Modelo de dados (aditivo)

```prisma
enum DuracaoDaQueixa { HOJE ALGUNS_DIAS UMA_SEMANA MAIS_DE_UMA_SEMANA MAIS_DE_UM_MES }
enum EvolucaoDaQueixa { PIORANDO ESTAVEL MELHORANDO VAI_E_VOLTA }

model PreConsulta {
  agendamentoId  String          @id
  parceiroId     String
  petId          String
  respondidaPorId String
  motivo         MotivoVisita
  queixaPrincipal String         // até 1000
  sintomas       SintomaPet[]    // até 5
  desdeQuando    DuracaoDaQueixa?
  evolucao       EvolucaoDaQueixa?
  alimentacao    ConsumoDiario?
  hidratacao     ConsumoDiario?
  fezes          AspectoFezes?
  urina          EstadoUrina?
  vitalidade     VitalidadePet?
  pesoKg         Decimal?        @db.Decimal(6, 2)
  pesadoEm       DateTime?
  observacao     String?         // até 2000
  fotoCaminhos   String[]        // até 3
  camposDoDiario String[]
  respondidaEm   DateTime        @default(now())
  atualizadaEm   DateTime        @updatedAt
}
```

Os valores de `DuracaoDaQueixa` seguem o `DURACOES_DA_QUEIXA` do contrato (conferir os literais na implementação, `contrato/responsavel.ts:286-293`).

## Rotas

| Método e rota | Quem | Descrição |
|---|---|---|
| `GET /tutor/clinica/agendamentos/:id/pre-consulta` | dono ou família | `PreConsulta` com `situacao`, `abreEm`, `fechaEm`, `sugestao` (diário dos últimos 3 dias e último peso de casa) e a resposta atual |
| `PUT /tutor/clinica/agendamentos/:id/pre-consulta` | dono (ou família com edição) | Grava; 409 `PRE_CONSULTA_FECHADA`; 403 `SOMENTE_LEITURA` |
| `POST /tutor/clinica/agendamentos/:id/pre-consulta/fotos` | idem | Multipart `file` → `{ fotoId }`; 400 `FOTO_INVALIDA` |
| `GET /parceiro/portal/clinica/agendamentos/:id/pre-consulta` | `prontuario.ler` ou `agenda.ler` (sem fotos para a recepção) | Resposta com procedência; fotos por URL assinada |

Notificação `PRE_CONSULTA_PENDENTE` 24 h antes se não respondida (E3-06, cron) e `PRE_CONSULTA_RESPONDIDA` à equipe com `prontuario.ler`.

## Acceptance Criteria

- [ ] **Given** consulta daqui a 80 h **Then** `situacao=AINDA_NAO_ABRIU` e `abreEm` 72 h antes; o `PUT` dá 409.
- [ ] **Given** diário de ontem com alimentação `POUCO` **Then** a sugestão traz alimentação `POUCO` com a data; enviada sem mudança, `camposDoDiario` contém `alimentacao`.
- [ ] **Given** plano sem diário **Then** `sugestao: null`.
- [ ] **Given** 4 fotos **Then** a quarta dá 400 `FOTO_INVALIDA`.
- [ ] **Given** o atendimento aberto (E4-01) **Then** a pré-consulta aparece na anamnese como sugestão, e o peso de casa não entra nos vitais.
- [ ] Recepção lê a pré-consulta sem as fotos e sem a observação clínica (só motivo e queixa), conforme a matriz.

## Estratégia de Testes

- Unit: situação por tempo e fuso, sugestão (3 dias, valor mais recente por campo), procedência, limites.
- Cenários: outro tutor (403), família só leitura (403 no PUT).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/agenda/pre-consulta/` (controllers tutor e parceiro, service, regras) | Criar |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Regras de situação e sugestão + testes
- [ ] **T3** Rotas do app e upload de foto
- [ ] **T4** Leitura pela clínica com permissões e trilha
- [ ] **T5** Notificações (pendente, respondida), handoff do app

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Médio | Foto da pré-consulta com dado sensível exposta | Bucket privado do parceiro e URL assinada de 15 min; a recepção não recebe foto |
| Baixo | Sugestão do diário confundida com valor aferido | Procedência por campo (`camposDoDiario`); o peso de casa nunca entra nos vitais |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
