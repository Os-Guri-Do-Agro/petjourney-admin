# Spec: Leitos e internação (mapa, internar, gravidade, alta, óbito e transferência)

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E5 internação](../../../../../epicos/portal-parceiro-e5-internacao.md)
**Depende de:** [E3-01 salas](../e3-agenda/01-configuracao-da-agenda.md), [E4-01 atendimento](../e4-prontuario/01-atendimento-e-prontuario.md)

---

## Visão Geral

O que a clínica cadastra e como o animal entra e sai:
- **leitos** (nome, sala, tipo geral, felino, isolamento ou UTI; desativar com motivo e data; leito com história não se apaga);
- **internar**, a partir de um atendimento ou avulso, com motivo, diagnóstico de trabalho, responsável pelo caso, peso de entrada, gravidade e previsão de alta;
- **mapa de leitos** ordenado por urgência;
- **mudar de leito**;
- **encerrar** com um de três desfechos.

## Motivação

Tipos e regras do portal:
- `Leito`, `LeitoKind`, `LeitoInativoMotivo`, `Internacao`, `GravidadeClinica`, `InternacaoStatus` (`petjourney-admin/src/features/clinico/data/types.ts:1620-1724`);
- repositório `internacao-repository.ts` (1258 linhas) com `mapa`, `criarLeito`, `editarLeito`, `desativarLeito`, `reativarLeito`, `removerLeito`, `internar`, `darAlta` e os erros `LeitoIndisponivelError`, `AltaSemAvisoError`.

As decisões do doc 07 entram como regra:
- o cartão marca urgência, não gravidade;
- leito ocupado não sai de operação;
- leito criado por engano some, o que já recebeu paciente só se desativa;
- nenhuma pendência trava a alta;
- a orientação é obrigatória nos três desfechos;
- a internação encerrada continua alcançável, dizendo que está encerrada.

---

## Decisões

- **D1 Leito com `kind`** decide compatibilidade: felino separado de cão, isolamento para infeccioso. Internar em leito incompatível é aviso com confirmação (no espírito do "nada bloqueia" da agenda), exceto leito inativo ou ocupado, que bloqueia (`LEITO_INDISPONIVEL`).
- **D2 Urgência derivada.** O mapa calcula urgência pelas pendências (dose atrasada da E5-02, boletim retido da E5-03), não pela gravidade.
- **D3 Peso de entrada** é a base de toda dose do plantão, não o cadastro.
- **D4 Encerrar.**
  - `ALTA`: orientação obrigatória, boletim de alta liberado (E5-03), resumo opcional publicado (E2-04).
  - `OBITO` e `TRANSFERIDO`: exigem `avisadoPorTelefone { em, por }` e orientação (o registro do que foi dito); recusa com `ALTA_SEM_AVISO` sem isso; nenhuma notificação (P5). Óbito inativa o paciente (E2-01, D6).
  - A conferência de pendências é de números ("1 pendente agora, 1 a suspender"); não trava.
- **D5 Internação nasce da consulta** (`atendimentoId`) ou de fora (`null`, chegou de outro serviço).

## Modelo de dados (aditivo)

```prisma
enum KindLeito { GERAL FELINO ISOLAMENTO UTI }
enum MotivoLeitoInativo { MANUTENCAO DESINFECCAO REFORMA EQUIPAMENTO OUTRO }
enum Gravidade { ESTAVEL ATENCAO CRITICO }
enum StatusInternacao { INTERNADO ALTA OBITO TRANSFERIDO }

model Leito {
  id             String    @id @default(cuid())
  parceiroId     String
  salaId         String
  nome           String
  kind           KindLeito
  ativo          Boolean   @default(true)
  motivoInativo  MotivoLeitoInativo?
  detalheInativo String?
  inativoDesde   DateTime?
  jaRecebeuPaciente Boolean @default(false)
}

model InternacaoNoParceiro {
  id                  String           @id @default(cuid())
  parceiroId          String
  pacienteId          String
  leitoId             String
  responsavelProfissionalId String
  atendimentoId       String?
  motivo              String
  diagnosticoDeTrabalho String?
  entradaEm           DateTime
  altaPrevistaEm      DateTime?
  altaEm              DateTime?
  status              StatusInternacao @default(INTERNADO)
  gravidade           Gravidade
  pesoEntradaKg       Decimal          @db.Decimal(6, 2)
  observacao          String?
  orientacaoDeSaida   String?
  avisadoPorTelefoneEm DateTime?
  avisadoPorId        String?
  @@index([parceiroId, status])
}

model MudancaDeLeito { id String @id @default(cuid()); internacaoId String; deLeitoId String; paraLeitoId String; em DateTime @default(now()); porId String; motivo String? }
model MudancaDeGravidade { id String @id @default(cuid()); internacaoId String; de Gravidade; para Gravidade; em DateTime @default(now()); porId String }
```

## Rotas (`@ExigeModulo(CLINICA)`)

| Método e rota | Permissão | Descrição |
|---|---|---|
| `GET/POST/PATCH /parceiro/portal/clinica/leitos[/:id]` | `estabelecimento.editar` | Cadastro |
| `POST .../leitos/:id/desativar` e `/reativar` | `estabelecimento.editar` | 409 `LEITO_OCUPADO` com a frase do que fazer antes |
| `DELETE .../leitos/:id` | `estabelecimento.editar` | Só se `jaRecebeuPaciente=false` |
| `GET /parceiro/portal/clinica/internacao/mapa` | `prontuario.ler` | Leitos (inclusive inativos, ocupando espaço), internados com urgência, boletim retido, doses atrasadas, vagas por kind |
| `POST /parceiro/portal/clinica/internacoes` | `internacao.prescrever` | Internar |
| `GET /parceiro/portal/clinica/internacoes/:id` | `prontuario.ler` | Paciente internado com tudo do plantão |
| `POST .../internacoes/:id/mudar-leito`, `/gravidade`, `/previsao-de-alta` | `internacao.executar` | Com trilha |
| `POST .../internacoes/:id/encerrar` | `internacao.prescrever` | `{ desfecho, orientacao, avisadoPorTelefone? }` (D4) |

Mudar gravidade para pior grava `MudancaDeGravidade` e marca o próximo boletim como "exige ligação" (E5-03). Contadores (E1-06): `internados`, `vagas`.

## Acceptance Criteria

- [ ] **Given** leito ocupado **When** desativa **Then** 409 `LEITO_OCUPADO`.
- [ ] **Given** leito que já recebeu paciente **When** apaga **Then** 409; só desativa.
- [ ] **Given** óbito sem `avisadoPorTelefone` **Then** 422 `ALTA_SEM_AVISO`; com o aviso **Then** encerra, inativa o paciente e não notifica ninguém.
- [ ] **Given** alta com dose pendente **Then** encerra e devolve `{ pendentesAgora: 1, aSuspender: 1 }` contados separados.
- [ ] **Given** estável com 2 doses atrasadas e crítico em dia **Then** o mapa marca o estável como mais urgente.
- [ ] Internação encerrada continua legível e recusa prescrição nova (409 `INTERNACAO_ENCERRADA`).

## Estratégia de Testes

- Unit: regras de leito, urgência, encerramento (golden tests de `domain/internacao.ts` e `internacao-dataset.spec`).
- Cenários: outro parceiro (403), recepção prescrevendo (403).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/internacao-clinica/` (leitos, internação, mapa, `regras/urgencia.ts`) | Criar |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Leitos
- [ ] **T3** Internar, mudar leito, gravidade, previsão
- [ ] **T4** Mapa com urgência
- [ ] **T5** Encerrar com os três desfechos; testes; handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Óbito comunicado por notificação | D4: sem push, com `avisadoPorTelefone` obrigatório; cenário dedicado |
| Médio | Mapa mostrar vaga que não existe | Leito inativo ou ocupado bloqueia a internação no servidor (D1) |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
