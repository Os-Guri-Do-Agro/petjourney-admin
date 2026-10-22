# Spec: Resumo do hotel

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico:** [E7 hotel](../../../../../epicos/portal-parceiro-e7-hotel.md)
**Depende de:** [E7-02 reservas](02-reservas-e-disponibilidade.md), [E7-04 estadia](04-check-in-estadia-e-check-out.md)

---

## Visão Geral

O que aconteceu no período (padrão: últimos 30 dias):
- ocupação média e por dia;
- diárias vendidas;
- receita registrada (orçamentos encerrados, em centavos);
- retorno (responsáveis que voltaram);
- cancelamento e não comparecimento (com as perdas em diárias);
- origem das reservas;
- serviços mais vendidos;
- ocorrências por gravidade.

## Motivação

Repositório `resumo-repository.ts` do portal (`carregar(de, ate)`, `periodoPadrao()`). Os defeitos D6 e D8 do hotel mostraram que número de painel sem passado real "nasce degenerado" (5% de ocupação, retorno 0%). Na API, o número sai do banco.

---

## Decisões

- **D1 Uma função, todos os números**, como no resumo da clínica (E3-08).
- **D2 Receita é a registrada, não a processada**: soma de orçamentos encerrados e sinais retidos de cancelamento; pagamento real é E9.
- **D3 Cache de 5 min** para períodos fechados.

## Rotas

| Método e rota | Permissão | Descrição |
|---|---|---|
| `GET /parceiro/portal/hotel/resumo?de=&ate=` | `hotel.ler` (receita só para DONO, GESTOR e FINANCEIRO) | Indicadores e séries |

## Acceptance Criteria

- [ ] **Given** 10 noites ocupadas de 20 disponíveis no período **Then** ocupação 50%.
- [ ] **Given** responsável com a segunda estadia no período e a primeira antes dele **Then** conta como retorno.
- [ ] Receita não aparece para CUIDADOR nem RECEPCAO.
- [ ] Os números batem com a soma no banco (teste de propriedade com seed).

## Estratégia de Testes

- Unit: indicadores (golden tests do `resumo-repository.spec` do portal), permissão da receita.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `src/hotel/resumo/` (service, controller) | Criar |

## Tasks

- [ ] **T1** Indicadores e séries
- [ ] **T2** Permissões, cache, handoff

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Baixo | Receita exposta a quem não deve | Campo de receita só para DONO, GESTOR e FINANCEIRO |

## Rollout / Rollback

Somente leitura, atrás do módulo. Rollback é reverter o código.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
