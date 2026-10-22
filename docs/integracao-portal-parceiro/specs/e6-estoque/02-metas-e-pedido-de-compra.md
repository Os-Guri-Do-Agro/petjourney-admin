# Spec: Metas do mês e pedido de compra

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E6 estoque](../../../../../epicos/portal-parceiro-e6-estoque.md)
**Depende de:** [E6-01 lotes](01-lotes-e-movimentos.md), [E4-04 vacinação](../e4-prontuario/04-vacinacao-conectada.md) (reforços que vencem no mês)

---

## Visão Geral

Combinar metas para um mês, acompanhar o mês contra elas e gerar o pedido de compra do próximo:
- **aplicações** é piso (por vacina ou da clínica inteira);
- **perdas** é teto;
- **compras** é orçamento em centavos e também teto.

O mês em curso mostra o realizado, o ritmo e a situação. O próximo mês abre preenchido com a sugestão, que diz de onde veio cada número.

## Motivação

Doc 17 do portal, decisões:
- **a sugestão é o maior de três números:** o mês no ritmo de hoje, a média do trimestre e os reforços que vencem no mês;
- **piso e teto se leem diferente:** aplicação é julgada pelo ritmo; perda e compra estouram na hora;
- **pedido = meta + mínimo − sobra**, onde a sobra é o saldo válido no começo do mês menos o que sai até lá no ritmo de hoje.

Tipos `TipoDeMeta`, `MetaDeEstoque`, `PlanoDeEstoque` (`types.ts:1189-1229`); regras em `domain/metas-de-estoque.ts` com testes.

---

## Decisões

- **D1 Um plano por mês** (`YYYY-MM`) com metas; `baseadoEm` guarda o mês de origem das sugestões.
- **D2 Regras portadas** do domínio do portal como funções puras (golden tests); o servidor devolve a conta escrita por linha do pedido.
- **D3 "Copiar pedido"** volta agrupado por fornecedor (texto pronto); integração com fornecedor é E9.

## Modelo de dados (aditivo)

```prisma
enum TipoMeta { APLICACOES PERDAS COMPRAS }

model PlanoDeEstoque {
  parceiroId   String
  mes          String   // YYYY-MM
  baseadoEm    String?
  criadoPorId  String
  atualizadoEm DateTime @updatedAt
  @@id([parceiroId, mes])
}

model MetaDeEstoque {
  id         String   @id @default(cuid())
  parceiroId String
  mes        String
  tipo       TipoMeta
  vacinaId   String?  // nulo = clínica inteira (único aceito em PERDAS e COMPRAS)
  alvo       Int      // doses ou centavos
}
```

## Rotas (`@ExigeModulo(CLINICA)`)

| Método e rota | Permissão | Descrição |
|---|---|---|
| `GET /parceiro/portal/clinica/estoque/metas` | `estoque.ler` | Mês em curso (realizado, ritmo, situação), próximo mês (plano ou convite), meses fechados |
| `GET /parceiro/portal/clinica/estoque/metas/sugestao?mes=` | `estoque.planejar` | Sugestão com a origem de cada número |
| `PUT /parceiro/portal/clinica/estoque/metas/:mes` | `estoque.planejar` | Salva o plano |
| `POST /parceiro/portal/clinica/estoque/metas/:mes/simular-pedido` | `estoque.planejar` | Pedido com a conta por linha e o texto agrupado por fornecedor |

## Acceptance Criteria

- [ ] **Given** dia 7 do mês com 6 aplicações de V10 **Then** a sugestão para o mês usa o maior entre o ritmo (6 ÷ 7 × dias do mês), a média do trimestre e os reforços que vencem no mês, e diz qual venceu (casos de `metas-de-estoque.spec`).
- [ ] **Given** meta de perdas 5 e 6 perdas no dia 10 **Then** situação `ESTOUROU` na hora (teto não dilui).
- [ ] **Given** meta 20, mínimo 10 e sobra 8 **Then** pedido de 22.
- [ ] Meta de PERDAS ou COMPRAS com `vacinaId` dá 400.

## Estratégia de Testes

- Unit: golden tests das regras do portal.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/estoque-clinico/metas/` (service, `regras/metas.ts`) | Criar |

## Tasks

- [ ] **T1** Migration
- [ ] **T2** Porte das regras + golden tests
- [ ] **T3** Rotas e handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Baixo | Sugestão de compra errada levar a desperdício | A sugestão diz de onde veio cada número e a clínica edita antes de salvar; nada é comprado pelo sistema |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. Migration só cria tabelas e colunas; rollback é reverter o código, e as tabelas ficam sem leitor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
