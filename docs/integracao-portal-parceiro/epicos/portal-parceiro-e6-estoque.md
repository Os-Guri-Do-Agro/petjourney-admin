# Épico E6: Estoque

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico pai:** [portal-do-parceiro.md](portal-do-parceiro.md)
**Partes (cada uma entregável sozinha):**
1. [01-lotes-e-movimentos.md](../2026/q4/q4-1/portal-parceiro/e6-estoque/01-lotes-e-movimentos.md): receber lote, dar baixa (quebra, temperatura, vencimento, contagem), saldo derivado das aplicações, mínimo por vacina e movimentos
2. [02-metas-e-pedido-de-compra.md](../2026/q4/q4-1/portal-parceiro/e6-estoque/02-metas-e-pedido-de-compra.md): metas do mês (aplicações, perdas, compras), planejamento do próximo mês com sugestão e o pedido de compra

---

## Visão Geral

O estoque de vacinas do portal (doc 17): geladeira com saldo e mínimo, lote com validade, baixa com motivo, metas do mês e pedido de compra. O mock é só de vacina; estoque de medicamentos e insumos é lacuna do E9.

## Decisões do épico

- **D-E6.1 O que saiu do lote não é campo do lote.** As doses consumidas são contadas das aplicações que citam o lote (decisão do portal em `types.ts:1163-1170`). Perdas são registros. O saldo é derivado; não há contador que diverge.
- **D-E6.2 Código de lote não repete por parceiro e frasco vencido não entra** (decisão 6 do doc 17).
- **D-E6.3 Contagem maior que o sistema é recusada**, porque dose a mais quase sempre é aplicação no lote errado (decisão 5).
- **D-E6.4 Dinheiro em centavos** inteiros.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
