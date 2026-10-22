# Spec: Equipe do parceiro completa (listar, convidar por e-mail, aceitar pela lista, trocar papel, sair)

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.2
**Épico:** [E0 consertos](../../../../../epicos/portal-parceiro-e0-consertos.md) · [guarda-chuva](../../../../../epicos/portal-do-parceiro.md)
**Depende de:** nada
**Handoff:** [front-portal-parceiro-e0.md](../../../../../../implementacao-por-superficie/front-portal-parceiro-e0.md)

---

## Visão Geral

Dar ao portal as rotas que faltam para a equipe se administrar sozinha:
- a lista de membros e convites;
- o convite para e-mail que ainda não tem conta;
- o aceite pelo link do e-mail, sem digitar ID;
- a troca de papel;
- a saída voluntária.

## Motivação

A tela de equipe do portal não lista ninguém e pede o ID do usuário para remover (`petjourney-admin/src/components/parceiro/sections/PortalEquipeSection.vue:140-160`). O aceite pede o ID do parceiro, digitado ou na query (`pages/(accounts)/parceiro/convite.vue:20-30`). A E1-03 depende de uma equipe administrável.

---

## Research Findings

**Estado atual na API (lido em 2026-10-20, conferido em 2026-10-21):**
- Rotas:
  - `POST /parceiro/portal/equipe/convites`;
  - `PATCH /parceiro/portal/equipe/convites/aceitar` (com `@SkipParceiroGuard`, `parceiroId` obrigatório);
  - `DELETE /parceiro/portal/equipe/:usuarioId`.
- `convidar` exige DONO e parceiro operável. Procura `Usuario` pelo e-mail e responde **404 "Usuário não encontrado"** quando não acha, o que enumera contas. Faz upsert no PK composto (reativa ex-membro) e não envia e-mail nem notificação.
- `aceitar` só muda o `status` para ACEITO. Não existe recusar: o enum `StatusConvite` tem `RECUSADO`, mas o fluxo não usa.
- **`remover` dava 500 ao remover qualquer DONO** (descoberto em 2026-10-21). O "lock" era `SELECT COUNT(*) ... FOR UPDATE`, que o Postgres recusa ("FOR UPDATE is not allowed with aggregate functions", 0A000, provado no banco de dev). Remover OPERADOR funcionava porque não passava pela consulta. A spec v0.1 mandava reaproveitar esse padrão.
- `ParceiroEquipe`: PK `(parceiroId, usuarioId)`, `papel`, `status`, `ativo`, `joinedAt`, `convidadoPorId`. Não guarda e-mail de quem ainda não tem conta.
- `Usuario` **não tem e-mail verificado** (o cadastro não verifica).
- E-mail transacional: SendGrid, com catálogo i18n em `src/sendgrid-mail/i18n/email-copy.ts`. O host do portal é `web.petjourney.health`.

**Front (lido, não editado):** `petjourney-admin/src/service/parceiro/parceiro-portal-service.ts:365-397` chama as três rotas atuais.

**Padrões seguidos:**
- membership pelo `ParceiroMembershipService`;
- erro com `LocalizedException` e chave nos 6 locales, com `codigo` no corpo (mesmo formato que a E1-04 vai padronizar);
- log `[ParceiroEquipe] ACAO chave=valor` sem e-mail;
- trava de linha-mãe (`SELECT id ... FOR UPDATE`), como em `lembrete` e `limite-pets`;
- cron diário às 03h com método exposto, como em `cupom-resgate-token.cron`.

**Breaking changes:**
- As três rotas atuais continuam, com o mesmo status HTTP para os mesmos casos. As mensagens passam a vir do catálogo localizado.
- O 404 do convite vira 201 com o mesmo corpo para os dois casos.
- **A rota antiga de aceite não aceita convite novo** (responde 403 `CONVITE_EXIGE_LINK`). Ver Rollout.

---

## Decisões

- **D1 Convite para e-mail, resposta única.** 201 com `{ conviteId, papel, status, expiraEm }` com ou sem conta, e o e-mail sai nos dois casos.
- **D2 Aceite só pelo token do link** (v0.2; a v0.1 aceitava pela caixa quando a conta era anterior ao convite).
  - Ter uma conta com o e-mail convidado não prova nada: qualquer um cria a conta antes e espera o convite. A revisão de 2026-10-21 mostrou o furo, inclusive para DONO, com carteira e PIX.
  - A caixa (`meus-convites`) só avisa, com `aceitaPor: 'LINK'`. Aceitar ou recusar pela caixa um convite novo dá sempre 403 `CONVITE_EXIGE_LINK`, sem consulta, então o id não revela se o convite existe.
  - Recusar também é pelo link.
- **D3 Convite antigo** (linha `ParceiroEquipe` PENDENTE).
  - Continua aceito pela caixa (`legado:<parceiroId>`) e pela rota antiga.
  - Ganhou validade de 14 dias contada de quando nasceu.
  - Reenviar, ou convidar de novo, o transforma em convite novo, com link.
  - O furo antigo fecha sozinho 14 dias depois do deploy.
- **D4 Toda mudança de equipe trava a linha do `Parceiro`** e reconfere, já com a trava, que quem pede ainda é DONO ativo. Isso serializa:
  - convite repetido;
  - tetos;
  - reenvio;
  - a invariante "pelo menos um DONO", que também corrige o 500 do `remover`.
- **D5 Convite morre com o poder de quem o fez.** Remover, sair e rebaixar de DONO cancelam os convites pendentes da pessoa, e o aceite confere que quem convidou ainda é DONO ativo.
- **D6 Tetos de e-mail:**
  - 30 e-mails por parceiro em 24 h, contando convites e reenvios (`reenviosEm`);
  - 3 reenvios por convite;
  - 3 convites por e-mail por parceiro em 30 dias, contando os cancelados;
  - expirado há mais de 30 dias não reabre.
- **D7 E-mail:**
  - no idioma de quem convida (o convidado pode nem ter conta);
  - assunto só com o nome do negócio, porque `Usuario.nome` é texto livre;
  - click tracking desligado, porque o link leva o token.
- **D8 Retenção:** convite resolvido (aceito, recusado, cancelado ou expirado) é apagado 90 dias depois, pelo `ConviteEquipeCron`. O registro durável de quem entrou é a própria `ParceiroEquipe`.

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Enumeração de contas pelo convite (acontecia) | D1; `usuarioId` fora da resposta; 409 só para quem já é da equipe, que o DONO vê na lista |
| Alto | Tomada da equipe por conta com o e-mail do convidado, criada antes ou depois do convite (o cadastro não verifica e-mail) | D2 (só o token aceita), D3 (o antigo vence em 14 dias) |
| Médio | Ex-DONO volta por um convite que ele mesmo fez | D5 |
| Médio | Convite como disparador de e-mail com o nosso remetente | D6 e D7 |
| Médio | Corrida na troca de papel e na saída derrubando o último DONO | D4 (teste de integração com dois DONOs ao mesmo tempo) |
| Médio | Portal antigo sem página de token: convite novo sem como ser aceito entre o deploy da API e o do front | Rollout: a página sobe junto com a API |
| Baixo | E-mail digitado errado pelo DONO | Expiração de 14 dias, cancelar; o nome de quem aceitou aparece na lista |
| Baixo | E-mail de convite no spam | Remetente e molde dos transacionais; o reenvio existe |
| Baixo | E-mail de terceiro guardado sem prazo | D8 |

## Requisitos Não-Funcionais

- **Segurança:**
  - Gestão exige DONO, reconferido com a trava.
  - Listar exige membro ativo.
  - A caixa e o aceite por link ficam fora do `ParceiroGuard` e só devolvem convites do e-mail da conta.
- **Privacidade:**
  - A lista mostra nome e papel a todos; e-mail só para DONO.
  - Nenhum e-mail em log.
  - Retenção D8.
- **i18n:** e-mail e erros nos 6 locales, en-GB explícito, sem travessão.

---

## Modelo de dados (aditivo)

```prisma
model ConviteEquipeParceiro {
  id             String              @id @default(cuid())
  parceiroId     String
  email          String              // normalizado em minúsculas
  papel          PapelParceiro
  status         StatusConviteEquipe @default(PENDENTE)
  tokenHash      String              @unique // sha256 do token do link; o token não é guardado
  expiraEm       DateTime
  reenviosEm     DateTime[]          @default([]) // teto de 3 e conta no teto diário
  convidadoPorId String
  respondidoEm   DateTime?
  usuarioId      String?             // preenchido no aceite
  createdAt      DateTime            @default(now())
  parceiro       Parceiro            @relation(fields: [parceiroId], references: [id], onDelete: Cascade)

  @@index([email, status])
  @@index([parceiroId, status])
  @@index([parceiroId, createdAt])
}

enum StatusConviteEquipe { PENDENTE ACEITO RECUSADO CANCELADO EXPIRADO }
```

Migration `prisma/migrations/20261021050000_convite_equipe_parceiro/` (só `CREATE`). `ParceiroEquipe` não muda.

## Rotas

| Método e rota | Quem | Corpo / query | Resposta |
|---|---|---|---|
| `GET /parceiro/portal/equipe` | membro ativo | `?parceiroId=` | `{ membros: [{ usuarioId, nome, email?, papel, desde, convidadoPor }], convites: [{ id, email?, papel, criadoEm, expiraEm }] }` (`email` só para DONO; convite antigo com `id: legado:<usuarioId>` e `expiraEm: null`) |
| `POST /parceiro/portal/equipe/convites` | DONO | `{ email, papel }` | **201** `{ conviteId, papel, status: 'PENDENTE', expiraEm }` com ou sem conta |
| `DELETE /parceiro/portal/equipe/convites/:conviteId` | DONO | | 204 (cancela; aceita `legado:`) |
| `POST /parceiro/portal/equipe/convites/:conviteId/reenviar` | DONO | | 200, novo token e novo prazo; `legado:` vira convite novo |
| `POST /parceiro/portal/equipe/convites/aceitar-por-link` | usuário logado | `{ token }` | 200 `{ parceiroId, papel }` |
| `POST /parceiro/portal/equipe/convites/recusar-por-link` | usuário logado | `{ token }` | 204 |
| `GET /parceiro/portal/equipe/meus-convites` | usuário logado | | `[{ conviteId, parceiro, papel, convidadoPorNome, expiraEm, aceitaPor: 'LINK' \| 'CAIXA' }]` |
| `POST /parceiro/portal/equipe/meus-convites/:conviteId/aceitar` e `/recusar` | usuário logado | | só convite antigo (`legado:<parceiroId>`); convite novo: 403 `CONVITE_EXIGE_LINK` |
| `PATCH /parceiro/portal/equipe/convites/aceitar` (antiga) | usuário logado | `?parceiroId=` | convite antigo como antes; convite novo: 403 `CONVITE_EXIGE_LINK` |
| `PATCH /parceiro/portal/equipe/:usuarioId` | DONO | `{ papel }` | `{ usuarioId, nome, papel, desde }`; 409 se tirar o último DONO |
| `DELETE /parceiro/portal/equipe/:usuarioId` | DONO | | 204; 409 se for o último DONO |
| `POST /parceiro/portal/equipe/sair` | membro ativo | `?parceiroId=` | 204; 409 se for o último DONO |

O link é `https://web.petjourney.health/parceiro/convite?token=...`. O host vem de `PARCEIRO_PORTAL_BASE_URL`; o valor padrão é esse.

## Acceptance Criteria (validados em 2026-10-21)

### Comportamentais
- [x] **Given** um DONO **When** chama `GET /parceiro/portal/equipe` **Then** recebe os membros ativos ACEITO com nome, e-mail e papel, e os convites PENDENTE não expirados. **Atendido** (unit, smoke).
- [x] **Given** um OPERADOR **When** chama a mesma rota **Then** recebe nomes e papéis sem nenhum campo `email`. **Atendido** (unit, smoke).
- [x] **Given** um e-mail sem conta **When** o DONO convida **Then** a resposta é 201 com o mesmo formato do caso com conta, e um e-mail de convite é enviado. **Atendido** (unit, smoke).
- [x] *(revisto na v0.2)* **Given** um convite PENDENTE para `ana@x.com` e uma conta com esse e-mail, criada antes ou depois **When** ela chama `GET .../meus-convites` **Then** o convite aparece com `aceitaPor: 'LINK'`, e aceitar ou recusar pela caixa responde 403 `CONVITE_EXIGE_LINK`. **Atendido** (integração, smoke).
- [x] *(revisto)* **Given** o token do e-mail **When** qualquer conta logada chama `aceitar-por-link` **Then** nasce `ParceiroEquipe` ACEITO ativo com o papel do convite, o convite fica ACEITO com `usuarioId`, e o mesmo token não aceita de novo. **Atendido** (integração, smoke).
- [x] *(revisto)* **Given** um id de convite novo, existente ou não **When** alguém tenta aceitar pela caixa **Then** recebe o mesmo 403 e nada muda. **Atendido** (unit, smoke).
- [x] **Given** o único DONO **When** tenta virar OPERADOR, sair ou ser removido **Then** recebe 409 `EQUIPE_ULTIMO_DONO` localizado. **Atendido** (unit, integração, smoke).
- [x] **Given** um convite expirado **When** alguém tenta aceitar **Then** recebe 410 com `codigo: CONVITE_EXPIRADO`. **Atendido** (unit, smoke).
- [x] *(novo)* **Given** dois DONOs **When** um remove o outro **Then** 204. Antes dava 500. **Atendido** (integração, smoke).
- [x] *(novo)* **Given** um DONO removido **When** alguém usa um link de convite que ele fez **Then** 404 e ninguém entra. **Atendido** (integração).

### Observáveis
- [x] A resposta do convite não contém `usuarioId`. **Atendido**.
- [x] Log `[ParceiroEquipe] CONVITE_CRIADO parceiroId=... conviteId=...` sem e-mail. **Atendido** (unit; smoke: 0 linhas da equipe com `@` no log da API).
- [x] PENDENTE com `expiraEm` no passado vira EXPIRADO na leitura e no `ConviteEquipeCron` diário, que também apaga o resolvido há mais de 90 dias. **Atendido** (integração).

## Estratégia de Testes (feita)

- **Unit** `parceiro-equipe.service.spec.ts`, 54 testes:
  - listar (DONO com e-mail, OPERADOR sem);
  - convite com e sem conta;
  - tetos;
  - caixa só aviso;
  - link;
  - rota antiga;
  - trava e reconferência do DONO;
  - invariante;
  - defesas da revisão.
- **E-mail** `sendgrid-mail.i18n.spec.ts`: pt-BR e en-GB renderizados, escape, assunto sem quebra de linha e sem o nome de quem convida, click tracking desligado.
- **Integration** `parceiro-equipe.integration.spec.ts`, 11 testes contra Postgres real:
  - conta "squatada";
  - conta posterior;
  - convite duplo simultâneo;
  - teto com `unnest` e fuso;
  - remover DONO;
  - ex-membro e outro parceiro;
  - ex-DONO;
  - corrida dos dois DONOs;
  - último DONO;
  - cron.
- **Cenários:** `qa/cenarios/portal-parceiro.json`, 10 entradas.
- **Smoke HTTP:** `scripts/smoke-equipe-parceiro.ts`, 41 passos (E0-01 e E0-02), contra a API de dev com envio de e-mail desligado.
- **Manual (pendente, com e-mail real):** convidar um e-mail novo, abrir o link, criar a conta e aceitar. Depende da página de token do portal.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + `migrations/20261021050000_convite_equipe_parceiro` | `ConviteEquipeParceiro`, `StatusConviteEquipe` |
| `src/parceiro-portal/parceiro-equipe.service.ts` (+ spec, + integration) | Criado: a equipe saiu do `parceiro-portal.service.ts` |
| `src/parceiro-portal/parceiro-equipe.config.ts`, `convite-equipe.cron.ts` | Criados |
| `src/parceiro-portal/parceiro-portal.controller.ts`, `.module.ts`, `.service.ts` | Rotas novas; os três métodos antigos saíram do service do portal |
| `src/parceiro-portal/dto/equipe.dto.ts`, `dto/convidar-membro.dto.ts` | DTOs com `@ApiProperty` (o de convite saía vazio no contrato) |
| `src/sendgrid-mail/sendgrid-mail.service.ts`, `i18n/email-copy.ts` | E-mail do convite nos 6 locales |
| `src/common/errors/error-catalog.ts` | 11 chaves `EQUIPE_*` e `CONVITE_*` |
| `.env.example` | `PARCEIRO_PORTAL_BASE_URL` |
| `contrato/openapi.json` | Regenerado |
| `qa/cenarios/portal-parceiro.json`, `qa/seguranca/achados.json` | Cenários e achados |
| `scripts/smoke-equipe-parceiro.ts` | Criado |

## Tasks Técnicas

- [x] **T1** Migration aditiva (`migrate diff --from-config-datasource`)
- [x] **T2** `ParceiroEquipeService` com listar, convidar (resposta única), cancelar, reenviar
- [x] **T3** Caixa (aviso), aceitar e recusar por link, rota antiga e convite antigo
- [x] **T4** Trocar papel, sair e remover com a trava e a invariante (corrige o 500)
- [x] **T5** E-mail do convite nos 6 locales
- [x] **T6** Testes da estratégia + cenários + smoke
- [x] **T7** `openapi:exportar` e handoff [front-portal-parceiro-e0.md](../../../../../../implementacao-por-superficie/front-portal-parceiro-e0.md)

## Rollout / Rollback

- **Aditivo:** só `CREATE` na migration.
- **Ordem:** API e a página `/parceiro/convite?token=` do portal sobem juntas, ou a página logo depois. Com a API nova no ar, o convite novo só é aceito pelo link; a tela atual, que pede o ID do parceiro, responde 403 `CONVITE_EXIGE_LINK` para ele. O convite antigo segue aceito pela tela atual por até 14 dias da criação.
- **Rollback:** reverter o código. A tabela nova fica sem uso; convites novos criados nesse meio-tempo deixam de existir para o código antigo, e quem foi convidado precisa de um convite novo.

## Follow-up

- `SEG-2026-10-21-SAQUE-PIX-SNAPSHOT-OPERADOR`: o detalhe do saque devolve a chave PIX inteira a qualquer membro.
- `SEG-2026-10-21-NOME-USUARIO-SEM-LIMITE`: `Usuario.nome` sem `MaxLength`; nome do parceiro editável depois da aprovação.
- `SEG-2026-10-21-EXCLUSAO-CONTA-ULTIMO-DONO`: excluir a conta pode deixar o parceiro sem DONO.
- E-mail verificado no cadastro (`emailVerificadoEm`) liberaria o aceite pela caixa. É spec própria, e também ajuda outros fluxos.
- Avisar os DONOs quando alguém entra na equipe e quando a chave PIX muda (E1-06).

## Perguntas em Aberto

- [x] ~~O convite deve exigir e-mail verificado?~~ v0.1: a caixa valia para conta anterior ao convite. **v0.2: aceite só pelo token do link** (D2), porque conta anterior não prova posse.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementada. A revisão (`/code-review` e `security-auditor`) mudou: aceite só pelo link (D2), convite antigo com validade (D3), trava com reconferência do DONO (D4), convite morre com o poder de quem o fez (D5), tetos por e-mail (D6), assunto e click tracking (D7), retenção de 90 dias (D8). Corrigido o 500 do `remover` (`COUNT ... FOR UPDATE`). `reenvios Int` virou `reenviosEm DateTime[]` antes de qualquer deploy | Claude |
