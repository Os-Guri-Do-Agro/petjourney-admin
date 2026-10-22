# Épico E0: Portal atual, consertos com a API que já existe

**Status:** In Review
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.1
**Épico pai:** [portal-do-parceiro.md](portal-do-parceiro.md)
**Partes (cada uma entregável sozinha):**
1. [01-equipe-completa.md](../2026/q4/q4-1/portal-parceiro/e0-consertos/01-equipe-completa.md): listar a equipe, convidar por e-mail sem conta, aceitar e recusar pela lista de convites, trocar papel, sair da equipe
2. [02-capacidade-de-saque-pronta.md](../2026/q4/q4-1/portal-parceiro/e0-consertos/02-capacidade-de-saque-pronta.md): a carteira devolve a capacidade de saque calculada, e o portal e o app apagam a regra local
3. [03-pendencias-de-front-com-api-pronta.md](../2026/q4/q4-1/portal-parceiro/e0-consertos/03-pendencias-de-front-com-api-pronta.md): o que o portal ainda não consome e a API já entrega (spec de integração, sem código de API)

---

## Visão Geral

Antes de construir o módulo clínico, o portal que está em produção tem buracos que dependem do backend. O pior é a equipe: a tela não lista os membros, e para remover alguém o dono precisa digitar "o ID do usuário (fornecido pelo suporte)" (`petjourney-admin/src/components/parceiro/sections/PortalEquipeSection.vue:142`). Para aceitar um convite, o convidado digita o ID do parceiro (`pages/(accounts)/parceiro/convite.vue`). Isso acontece porque a API não tem rota de listagem (`src/parceiro-portal/parceiro-portal.controller.ts:152-170` só tem convidar, aceitar e remover).

## Motivação

- A E1-03 (profissionais e papéis) precisa de uma equipe que se administra sozinha: sem listagem e convite por e-mail, nenhuma clínica de três veterinários e duas recepcionistas monta a equipe no portal.
- O convite hoje responde 404 quando o e-mail não tem conta (`parceiro-portal.service.ts:906-907`), o que revela ao dono quais e-mails existem na base e obriga o convidado a criar conta antes, sem saber por quê.
- Regra duplicada no cliente vira divergência (`regras-de-saque.ts` do portal espelha `comissao.config.ts:25` da API).

## Decisões do épico

- **D-E0.1** Convite por e-mail nasce como registro próprio, ligado ao e-mail, e vira `ParceiroEquipe` quando a pessoa entra com aquele e-mail (com conta nova ou existente). A resposta do convite é a mesma com ou sem conta (não revela existência).
- **D-E0.2** Os papéis continuam DONO e OPERADOR nesta onda. A E1-03 acrescenta os papéis operacionais sem quebrar estas rotas (o campo `papel` do contrato vira lista de papéis lá, com compatibilidade).
- **D-E0.3** Toda capacidade derivada de regra de negócio sai pronta da API (`capacidadeDeSaque`), no padrão "o servidor calcula, o cliente obedece" do épico pai (P2).

## Fora do escopo

- Papéis operacionais e permissões por recurso (E1-03).
- Trilha de auditoria geral (E1-05). Aqui as ações da equipe ganham log estruturado, e a E1-05 as passa para a trilha.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
