# Iniciativa: Acesso, Compartilhamento e Parcerias

Pasta-índice de tudo que essa frente precisa. O guarda-chuva é o épico
[../epicos/acesso-compartilhamento-e-parcerias.md](../epicos/acesso-compartilhamento-e-parcerias.md)
(decisões D1-D12). As specs filhas abaixo detalham cada parte para implementação.

## Status das specs

| Doc | Parte | Papel | Status |
|---|---|---|---|
| [../epicos/acesso-compartilhamento-e-parcerias.md](../epicos/acesso-compartilhamento-e-parcerias.md) | Épico | Visão geral + decisões D1-D12 | In Review |
| [00-fundacao-papeis-e-codigo.md](00-fundacao-papeis-e-codigo.md) | 0 | `@Roles`/RolesGuard + código público + catálogo i18n de erro + `trustProxy` | In Review (v2) |
| [01-compartilhamento-prestador.md](01-compartilhamento-prestador.md) | 1 | Compartilhamento temporário (snapshot + portal) | In Review (draft) |
| [02-plano-familia.md](02-plano-familia.md) | 2 | Plano família (membership + herança + delegação) | In Review (draft) |
| [03-parceiro-portal-auditado.md](03-parceiro-portal-auditado.md) | 3 | Parceiro: identidade, login, equipe, auditoria | In Review (v2) |
| [04-indicacao-comissoes-carteira.md](04-indicacao-comissoes-carteira.md) | 4 | Programa de indicação + carteira (comissões) | In Review (draft) |

## Documentos derivados (contrato de front + regras)

Produzidos do código real (controllers/services) após o service layer das Partes 1-4 ficar pronto:

| Doc | Papel | Público |
|---|---|---|
| [frontend.md](frontend.md) | Contrato de API auto-suficiente das 4 frentes (envelope, auth, i18n, dinheiro em centavos, flags, todas as rotas com shapes/enums/erros) | Time de front / IA do front |
| [regras.md](regras.md) | Regras de negócio em português claro de toda a iniciativa (conta/login, planos/trial, pets, parceiro, e as 4 partes), com comissão/carteira explicada do zero e perguntas em aberto | Humano + IA (produto e dev) |

## Ordem de execução

```
Parte 0 (Fundação) ──┬──▶ Parte 1 (Prestador)   [usa util de código]
                     ├──▶ Parte 2 (Família)      [usa util de código + RolesGuard + evolui OwnershipService]
                     └──▶ Parte 3 (Parceiro)     [usa RolesGuard]
```

Cada parte é shippable sozinha. A Fundação vai a produção sem mudar contrato de
nenhuma rota existente (com zero uso, comportamento idêntico ao de hoje).

## Contratos de front (input das specs)

- [../epicos/compartilhament-temporario.txt](../epicos/compartilhament-temporario.txt) — contrato do prestador (telas prontas com mock).
- [../epicos/compartilhamento-plano-familia.txt](../epicos/compartilhamento-plano-familia.txt) — contrato da família (telas prontas com mock).

## Decisões (atualizado 2026-06-24)

**Resolvidas:**
- **Comissão = programa de indicação** (não resgate de cupom): 5% por indicação, até 18 meses, carteira + saque. Virou a **Parte 4** (épico D13). Cupom é só desconto de loja, sem comissão.
- **403 vs 404:** 403 pra ownership autenticado; 404 genérico pra código público (D14).
- **Throttle/proxy:** habilitar `trustProxy` no Fastify (D14).
- **i18n de erro:** criar catálogo traduzido pt-BR/en-US/en-GB/es-419 na Fundação (D14).
- **Parte 2:** leitura de prontuário por família e carência da suspensão **entram agora**.
- **Parte 1:** `castrado` no header do snapshot; `uri` via signed URL; domínio via env (D14).

**Parte 4 (fintech) — resolvido 2026-06-24:** base = `Plano.preco`; anual na hora; clawback debita reembolso (cancelar = só futuro); saque PIX mín R$50, liquidação admin, ciclo 27 -> dia 5.

**Praticamente tudo decidido em D15** (anual = valor pago; `codigoIndicacao` na Parte 3; clawback = `CANCELLATION`+`cancel_reason=CUSTOMER_SUPPORT`; Throttler com Redis/lockout; carência 7d; feature flag de prontuário; domínios via env). Só falta confirmar os domínios reais antes do deploy.

> Cada spec filha tem a lista completa na sua seção "Perguntas em Aberto".

## Como estes drafts foram produzidos

Redigidos por um workflow multi-agente (1 agente por parte) com revisão
adversarial por spec (rascunho → juiz tenta refutar AC vago / BOLA / breaking
change / erro de schema → versão final). São **drafts In Review** para o Nicolas
revisar e iterar, não estão aprovados para implementação.
