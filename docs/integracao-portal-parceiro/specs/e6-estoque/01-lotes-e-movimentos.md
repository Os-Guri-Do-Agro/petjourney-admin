# Spec: Lotes de vacina e movimentos de estoque

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E6 estoque](../../../../../epicos/portal-parceiro-e6-estoque.md)
**Depende de:** [E4-02 catálogos](../e4-prontuario/02-catalogos-clinicos.md) (vacinas); a [E4-04](../e4-prontuario/04-vacinacao-conectada.md) consome os lotes

---

## Visão Geral

- **Receber lote:** vacina, código, validade, quantidade, custo por dose, fornecedor, nota fiscal, data e quem conferiu.
- **Dar baixa:** quebra, temperatura, vencimento ou contagem (a pessoa diz quantas doses achou e a diferença vira baixa); "descartar" no lote vencido abre no saldo inteiro.
- **Mínimo por vacina:** ajustável, com o giro mensal ao lado.
- **Leituras:** geladeira por vacina (saldo, mínimo, cobertura em dias, situação) e por lote (validade, saídas, valor parado); movimentos com quem e quando; e a análise (giro, saldo contra mínimo, perdas, validade).

## Motivação

O doc 17 do portal: "O estoque morava numa aba de Vacinas e só lia... A clínica comprava e não tinha onde dar entrada". Tipos: `LoteDeVacina`, `PerdaDeLote`, `MotivoDePerda` (`petjourney-admin/src/features/clinico/data/types.ts:1136-1187`); repositório `estoque-repository.ts` (`receberLote`, `registrarBaixa`, `ajustarMinimo`, `movimentos`, `fornecedores`; `LIMITE_DE_DOSES = 999`); domínio `estoque-vacinas.ts` (`movimentosDoEstoque`) e a janela de validade de 60 dias compartilhada com a aplicação.

---

## Decisões

- **D1 Saldo derivado** (D-E6.1): `saldo = recebida − aplicações com o lote (não anuladas) − perdas`. Consulta indexada; sem coluna de saldo.
- **D2 Baixa por contagem** grava a diferença como perda `CONTAGEM`; contagem maior que o saldo dá 409 `CONTAGEM_ACIMA_DO_SALDO`.
- **D3 Lote vencido não recebe** (`LOTE_JA_VENCIDO`) e não se aplica (E4-04).
- **D4 Concorrência na aplicação.** Aplicar com lote confere saldo maior que zero na mesma transação (lock de linha do lote).
- **D5 Situação da vacina** derivada: `ABAIXO_DO_MINIMO`, `PERTO_DE_VENCER` (60 dias), `OK`; contador `vacinasAbaixoDoMinimo` para o selo do menu (E1-06).

## Modelo de dados (aditivo)

```prisma
enum MotivoPerda { QUEBRA TEMPERATURA VENCIMENTO CONTAGEM }

model LoteDeVacina {
  id                 String   @id @default(cuid())
  parceiroId         String
  vacinaId           String
  codigo             String
  fornecedor         String?
  notaFiscal         String?
  recebidoEm         DateTime @db.Date
  recebidoPorId      String?
  validade           DateTime @db.Date
  quantidadeRecebida Int      // até 999
  custoUnitarioCentavos Int
  @@unique([parceiroId, codigo])
  @@index([parceiroId, vacinaId, validade])
}

model PerdaDeLote {
  id            String      @id @default(cuid())
  loteId        String
  em            DateTime    @db.Date
  quantidade    Int
  motivo        MotivoPerda
  registradaPorId String?
  observacao    String?
}

model MinimoDeEstoque {
  parceiroId String
  vacinaId   String
  minimo     Int
  @@id([parceiroId, vacinaId])
}
```

## Rotas (`@ExigeModulo(CLINICA)`)

| Método e rota | Permissão | Descrição |
|---|---|---|
| `GET /parceiro/portal/clinica/estoque/geladeira` | `estoque.ler` | Por vacina e por lote, com situação e valor parado |
| `POST /parceiro/portal/clinica/estoque/lotes` | `estoque.movimentar` | Receber |
| `POST /parceiro/portal/clinica/estoque/lotes/:id/baixa` | `estoque.movimentar` | `{ motivo, quantidade? , contadas? , observacao? }` |
| `PUT /parceiro/portal/clinica/estoque/minimos/:vacinaId` | `estoque.planejar` | Mínimo |
| `GET /parceiro/portal/clinica/estoque/movimentos?tipo=&de=&ate=` | `estoque.ler` | Entradas e baixas (aplicações têm lista própria na E4-04) |
| `GET /parceiro/portal/clinica/estoque/analise?meses=` | `estoque.ler` | Giro, saldo contra mínimo, perdas por motivo, validade |
| `GET /parceiro/portal/clinica/estoque/fornecedores` | `estoque.ler` | Nomes já usados (autocompletar) |

## Acceptance Criteria

- [ ] **Given** lote de 10 doses, 3 aplicações e 1 quebra **Then** saldo 6; anular uma aplicação **Then** 7.
- [ ] **Given** código de lote repetido no parceiro **Then** 409 `LOTE_DUPLICADO`.
- [ ] **Given** contagem de 8 com saldo 6 **Then** 409 `CONTAGEM_ACIMA_DO_SALDO`; contagem de 5 **Then** perda `CONTAGEM` de 1.
- [ ] **Given** duas aplicações simultâneas com o último frasco **Then** uma passa e a outra recebe 409 `LOTE_SEM_SALDO`.
- [ ] Datas em formato do idioma não se aplicam à API: tudo `YYYY-MM-DD` (o defeito 1 do doc 17 era do front).

## Estratégia de Testes

- Unit: saldo derivado, baixa por contagem, situação (golden tests de `estoque-repository.spec` do portal).
- Integration: corrida do último frasco.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/estoque-clinico/` (controller, service, `regras/saldo.ts`) | Criar |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Receber, baixa, mínimo
- [ ] **T3** Leituras (geladeira, movimentos, análise)
- [ ] **T4** Integração com a aplicação (E4-04), contador, handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Médio | Saldo derivado ficar lento com histórico grande | Índice por lote nas aplicações e perdas; consulta agregada por vacina; medir com seed de 2 anos |
| Médio | Último frasco usado duas vezes | Lock de linha do lote na aplicação (D4) e teste de corrida |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
