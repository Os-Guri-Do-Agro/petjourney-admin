# Spec: Motivo e Protocolo em Ações Admin sobre Parceiro

**Status:** Em Implementação
**Autor:** Claude + Nicolas
**Criado em:** 2026-08-05
**Última atualização:** 2026-08-05
**Versão:** 0.2 (T1-T9 implementadas; migration, typecheck, testes e smoke ficam para o lote final, junto com a spec de lembrete)

**Specs relacionadas:**
- [04-indicacao-comissoes-carteira.md](../../q2/q2-3/acesso-compartilhamento-e-parcerias/04-indicacao-comissoes-carteira.md) - carteira, ledger e Regra 19 (ajuste manual)
- [09-solicitacao-parceiro-ciclo-completo.md](../../q2/q2-3/acesso-compartilhamento-e-parcerias/09-solicitacao-parceiro-ciclo-completo.md) - máquina de estados blindada do credenciamento, padrão de motivo persistido
- [09-solicitacao-parceiro-ciclo-completo-cms.md](../../q2/q2-3/acesso-compartilhamento-e-parcerias/09-solicitacao-parceiro-ciclo-completo-cms.md) - telas admin que consomem estas rotas
- [qr-tracking-wfqr.md](../q3-1/qr-tracking-wfqr.md) - revogação do QR de indicação

---

## Visão Geral

Toda ação administrativa que mexe em dinheiro ou existência de parceiro passa a exigir **motivo persistido** e a emitir um **protocolo rastreável** (`CRD-2026-000123`), consultável depois. No caminho, a exclusão de parceiro deixa de ser `DELETE` físico e vira exclusão lógica, porque hoje ela **apaga o ledger financeiro em cascata**.

## Motivação / Contexto de Negócio

Quando o Nicolas envia crédito para um parceiro, a pergunta que vem depois é sempre a mesma: *por que esse crédito entrou, quem autorizou, e como eu acho isso de novo daqui a seis meses?* Hoje não há resposta. O `motivo` já é obrigatório na request e é **descartado**: vai para `logger.log` e morre com a retenção do log. O único identificador é um UUID interno (`refEvento = ajuste:<uuid>`) que ninguém consegue ler no telefone com o parceiro.

O mesmo vale para a exclusão de parceiro, que hoje nem motivo tem.

O research achou um problema maior embaixo disso: `DELETE /parceiro/:id` executa `prisma.parceiro.delete`, e `ParceiroCarteira`, `ParceiroTransacao` e `ParceiroSaque` estão todos com `onDelete: Cascade`. O `ParceiroTransacao` é declarado no próprio schema como *"Ledger imutavel (append-only). Fonte de verdade."*. Ou seja: **um clique de exclusão apaga o extrato financeiro inteiro do parceiro**, incluindo comissões pagas e saques liquidados. Não há trilha, não há confirmação e não há como reconstruir.

---

## Research Findings

**Stack:** NestJS 11 (Fastify) + Prisma 7 + Postgres 16. Rotas admin atrás de `JwtAuthGuard + SystemAdminGuard`.

**Estado atual:**

- [comissao-admin.controller.ts:38](../../../../../src/comissao/comissao-admin.controller.ts#L38) - `POST /admin/parceiro/:parceiroId/carteira/ajuste`. Note o prefixo real: `admin/parceiro`, não `admin/comissao`.
- [carteira.service.ts:350](../../../../../src/comissao/carteira.service.ts#L350) - `ajuste()`. O `motivo` chega, é usado só no `logger.log` e **não é persistido**. Grava `ParceiroTransacao` com `refEvento = ajuste:<randomUUID>`. Guard-rails atuais: valor diferente de zero e teto `AJUSTE_MAX_CENTAVOS` (default R$ 10.000).
- [carteira.service.ts:372](../../../../../src/comissao/carteira.service.ts#L372) - `revisao()`. Mesmo padrão: motivo obrigatório no DTO, descartado no log.
- [carteira.service.ts:321](../../../../../src/comissao/carteira.service.ts#L321) - `falharSaque()`. Aqui o motivo **é** persistido (`ParceiroSaque.motivoFalha`), mas sem protocolo.
- [parceiro.service.ts:223](../../../../../src/cupom/parceiro.service.ts#L223) - `remove()`: `ensureExists`, bloqueia se houver cupons vinculados (409) e faz `prisma.parceiro.delete`. Sem motivo, sem trilha, sem revogação de QR.
- [schema.prisma:1959](../../../../../prisma/schema.prisma#L1959), [1971](../../../../../prisma/schema.prisma#L1971), [1998](../../../../../prisma/schema.prisma#L1998) - `ParceiroCarteira`, `ParceiroTransacao` e `ParceiroSaque` com `onDelete: Cascade`. `ParceiroEquipe` idem ([418](../../../../../prisma/schema.prisma#L418)).
- [schema.prisma:44](../../../../../prisma/schema.prisma#L44) - `Usuario.referidoPorParceiroId` **sem** `onDelete`, ou seja Restrict. Parceiro com indicados faz o delete estourar P2003, que o `mapConflict` ([parceiro.service.ts:237](../../../../../src/cupom/parceiro.service.ts#L237)) não trata: só cobre P2002. Hoje isso vaza como erro cru.
- O `delete` também não chama `sincronizarQrIndicacao`, então o QR impresso na rua continua apontando para um parceiro que não existe mais.

**Padrões a seguir (já no repo):**

- **Motivo persistido + autor + data:** `Parceiro.motivoAuditoria` / `auditadoPorId` / `auditadoEm`, usado por rejeitar e suspender ([parceiro.service.ts:312](../../../../../src/cupom/parceiro.service.ts#L312)).
- **Trilha em tabela dedicada:** `PetInativacaoLog` ([schema.prisma:1104](../../../../../prisma/schema.prisma#L1104)) e `InactivationLog` ([schema.prisma:1118](../../../../../prisma/schema.prisma#L1118)), com `performedById`, `reasonCode`/`reasonCustom` e `createdAt`.
- **Transição condicional na origem:** `updateMany` com o status esperado no `where`; `count === 0` vira 409 com `reason` estável ([parceiro.service.ts:263](../../../../../src/cupom/parceiro.service.ts#L263)). Elimina corrida entre dois admins.
- **Lock pessimista:** `$queryRaw ... FOR UPDATE` já é usado no mesmo módulo ([carteira.service.ts:197](../../../../../src/comissao/carteira.service.ts#L197)).
- **DTO de motivo:** `MotivoAuditoriaDto` com `@MinLength(3)` ([motivo-auditoria.dto.ts](../../../../../src/cupom/dto/motivo-auditoria.dto.ts)).
- **Erro i18n:** `LocalizedException` + chave no `ERROR_CATALOG`, 4 locales, `en-GB` explícito.
- **Geração de código único:** `PublicCodeService.gerarComInsert` ([public-code.service.ts:42](../../../../../src/common/public-code/public-code.service.ts#L42)) é o precedente de "gera, tenta inserir, regenera em P2002". Serve de referência de padrão, mas não de implementação: aquele código é aleatório, anti-enumeração e com expiração. Protocolo é o oposto: sequencial, legível e permanente.

**Consumidor externo (CMS):**

- [parceiro-admin.service.ts:493](../../../../../../petjourney-cms/src/services/parceiro-admin.service.ts#L493) - `ajustarCarteira` **já envia `motivo`**. Zero breaking.
- [parceiro-admin.service.ts:508](../../../../../../petjourney-cms/src/services/parceiro-admin.service.ts#L508) - `alterarRevisaoAntifraude` já envia `motivo`. Zero breaking.
- [parceiro-admin.service.ts:485](../../../../../../petjourney-cms/src/services/parceiro-admin.service.ts#L485) - `falharSaque` já envia `motivoFalha`. Zero breaking.
- [parceiro-admin.service.ts:409](../../../../../../petjourney-cms/src/services/parceiro-admin.service.ts#L409) - `excluirParceiro` faz `DELETE` **sem body**. **Quebra** quando o motivo virar obrigatório.

**Breaking Changes:**

1. `DELETE /parceiro/:id` passa a exigir `{ motivo }` e a responder `200` com corpo (antes retornava o parceiro deletado). CMS precisa de ajuste. É o único breaking real.
2. `DELETE /parceiro/:id` passa a **não apagar** o registro: o parceiro some das listagens mas continua no banco. Qualquer consumidor que dependa do sumiço físico muda de comportamento.
3. `motivo` do ajuste sobe de `@IsNotEmpty` para `@MinLength(5)`. Um admin que digitava "ok" passa a receber 400.

---

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| **Alto** | Alguma leitura esquecer o filtro `deletedAt: null` e o parceiro excluído continuar aparecendo em cupom público, fila de auditoria, lookup de indicação ou login do portal. É falha de autorização, não só de UI. | T5 é um **audit grep com lista fechada de 9 arquivos** (levantada no research, ver Tasks), não uma varredura genérica. Teste de guard cobrindo "membro de parceiro excluído recebe 403". `security-auditor` obrigatório no diff. |
| **Alto** | Migration que passa o `delete` para exclusão lógica sem cobrir as FKs deixa dado inconsistente se alguém rodar delete físico direto no banco. | A mudança é aditiva (colunas novas) e o `delete` sai do código. Cascade permanece no schema como rede para operação manual consciente, e o risco fica documentado aqui. |
| Médio | Corrida entre dois admins gerando o mesmo número de sequência. | `SELECT ... FOR UPDATE` no contador dentro da transação, mais `@@unique([tipoAcao, ano, sequencia])` como rede final. Precedente direto no mesmo módulo. |
| Médio | `DELETE` com body pode ser descartado por proxy/CDN em algum ponto do caminho. | Fastify e Railway aceitam. Validado por smoke HTTP real (T9) antes de fechar. Alternativa registrada em Considerações de Arquitetura caso o smoke mostre problema. |
| Médio | CMS quebra ao excluir parceiro assim que o backend subir. | Breaking documentado e comunicado; spec de CMS vira follow-up. Deploy do backend não derruba nada mais: as outras 3 rotas já mandam motivo. |
| Baixo | Virada de ano gerando sequência duplicada entre `2026` e `2027`. | Sequência é por `(tipoAcao, ano)` com o ano em UTC, e o unique composto cobre. |

---

## Requisitos Não-Funcionais

- **Segurança:** todas as rotas seguem atrás de `JwtAuthGuard + SystemAdminGuard`. Parceiro com `deletedAt` preenchido perde acesso ao portal, à carteira e ao claim `parceiroAtivoId` do multi-perfil.
- **Privacidade / LGPD:** exclusão lógica preserva dado pessoal do parceiro (CNPJ, e-mails da equipe). Uma rota de expurgo definitivo por pedido de titular **não existe hoje e não nasce aqui**: fica registrada como follow-up, com o protocolo servindo justamente de trilha de quem pediu.
- **Observabilidade:** log estruturado com o código do protocolo em toda emissão.
- **Internacionalização:** chaves novas no `ERROR_CATALOG`, 4 locales, `en-GB` explícito, sem em-dash.
- **Compatibilidade:** as 3 rotas de dinheiro ganham só um campo novo no response. A rota de exclusão é breaking (ver acima).

---

## User Stories

- Como **admin**, quero informar o motivo ao enviar crédito e receber um protocolo, para achar essa operação depois e explicar ela para o parceiro.
- Como **admin**, quero que excluir um parceiro exija motivo e gere protocolo, porque é uma ação sem volta na prática.
- Como **operação financeira**, quero que o extrato de um parceiro sobreviva à exclusão dele, porque comissão paga é obrigação contábil, não estado de UI.
- Como **admin**, quero consultar um protocolo pelo código e ver o que aconteceu, quem fez e por quê.

---

## Acceptance Criteria

### Protocolo (transversal)

- [ ] **AC1** O código segue `<PREFIXO>-<ANO>-<SEQ6>`, com prefixo por tipo de ação: `CRD` (crédito), `EXC` (exclusão), `REV` (revisão antifraude), `SAQ` (falha de saque). Exemplo: `CRD-2026-000123`.
- [ ] **AC2** A sequência é por `(tipoAcao, ano)`, começa em 1 e é zero-padded em 6 dígitos. Ano em UTC.
- [ ] **AC3 Given** duas emissões concorrentes do mesmo tipo no mesmo ano
      **Then** os códigos são distintos e consecutivos, sem buraco e sem colisão (`FOR UPDATE` no contador + unique composto).
- [ ] **AC4** O protocolo é emitido **dentro da mesma transação** da ação. Se a ação falha, nenhum protocolo sobra; se o protocolo falha, a ação não acontece.
- [ ] **AC5** `ProtocoloAdmin` guarda `codigo`, `tipoAcao`, `entidade`, `entidadeId`, `adminId`, `motivo`, `payload` (snapshot) e `criadoEm`.

### Envio de crédito

- [ ] **AC6 Given** `POST /admin/parceiro/:id/carteira/ajuste` com `{valorCentavos: 5000, motivo: "acordo comercial de agosto"}`
      **Then** 201 com `{parceiroId, valorCentavos, protocolo: "CRD-2026-000123", refEvento}`
      **And** existe `ProtocoloAdmin` com o motivo persistido
      **And** a `ParceiroTransacao` criada tem `refEvento = "ajuste:CRD-2026-000123"` (liga ledger e protocolo sem coluna nova).
- [ ] **AC7 Given** motivo ausente, vazio ou com menos de 5 caracteres
      **Then** 400 e **nenhum** crédito é aplicado.
- [ ] **AC8** Guard-rails atuais continuam valendo e testados: `valorCentavos = 0` recusa, e valor acima de `AJUSTE_MAX_CENTAVOS` recusa. Nesses casos nenhum protocolo é consumido.
- [ ] **AC9** Valor negativo (débito) segue funcionando e emite protocolo `CRD` normalmente.

### Exclusão de parceiro

- [ ] **AC10 Given** `DELETE /parceiro/:id` com `{motivo: "encerrou as atividades"}`
      **Then** 200 com `{id, deletedAt, protocolo: "EXC-2026-000045"}`
      **And** `Parceiro.deletedAt`, `deletadoPorId`, `motivoExclusao` e `protocoloExclusao` preenchidos
      **And** `ativo` vira `false`
      **And** o registro **continua no banco**, com carteira, ledger e saques intactos.
- [ ] **AC11 Given** a mesma exclusão
      **Then** o QR de indicação é revogado (`sincronizarQrIndicacao(id, false)`), igual ao que a suspensão já faz.
- [ ] **AC12 Given** `DELETE /parceiro/:id` sem `motivo`
      **Then** 400 e o parceiro segue intacto.
- [ ] **AC13 Given** parceiro já excluído
      **When** exclusão é repetida
      **Then** 409 com `errorKey: PARCEIRO_JA_EXCLUIDO` (transição condicional na origem, mesmo padrão da auditoria).
- [ ] **AC14 Given** parceiro com cupons vinculados
      **Then** segue 409, agora com `errorKey: PARCEIRO_EXCLUSAO_BLOQUEADA_CUPONS` em vez de string pt-BR fixa. Regra de negócio inalterada.
- [ ] **AC15 Given** parceiro com usuários indicados (`referidoPorParceiroId`)
      **Then** a exclusão **funciona** (é lógica, não física) e o vínculo de indicação é preservado. O P2003 que existia deixa de ser possível.
- [ ] **AC16 Given** parceiro excluído
      **Then** ele **não** aparece em: `GET /parceiro`, `GET /parceiro/:id` (404), `GET /parceiro/auditoria/fila`, listagem de cupom do tutor, lookup de código de indicação, e resolução de parceiro do portal.
- [ ] **AC17 Given** usuário que era DONO de um parceiro excluído
      **When** tenta acessar portal, carteira ou trocar para o perfil de parceiro
      **Then** 403, e o parceiro não aparece na lista de perfis do token.
- [ ] **AC18** O `payload` do protocolo de exclusão guarda snapshot com `nome`, `cnpj`, `codigoIndicacao`, `saldoTotalCentavos` no momento, quantidade de cupons e de indicados.

### Revisão antifraude e falha de saque

- [ ] **AC19 Given** `POST /admin/parceiro/:id/carteira/revisao` com motivo
      **Then** response inclui `protocolo: "REV-..."` e o motivo fica persistido no `ProtocoloAdmin` (hoje ele só ia para o log).
- [ ] **AC20 Given** `POST /admin/parceiro/saques/:id/falhar` com `motivoFalha`
      **Then** response inclui `protocolo: "SAQ-..."`, o `ParceiroSaque.motivoFalha` continua sendo gravado, e o estorno na carteira continua acontecendo na mesma transação.

### Consulta

- [ ] **AC21 Given** `GET /admin/protocolo/:codigo` com código existente
      **Then** 200 com tipo de ação, entidade, admin, motivo, payload e data.
- [ ] **AC22 Given** código inexistente ou malformado
      **Then** 404 com `errorKey: PROTOCOLO_NAO_ENCONTRADO`.
- [ ] **AC23 Given** `GET /admin/parceiro/:id/protocolos`
      **Then** lista os protocolos daquele parceiro em ordem decrescente de data, inclusive os de um parceiro já excluído.
- [ ] **AC24** Ambas as rotas exigem `SystemAdminGuard`. Um JWT de tutor ou de parceiro recebe 403.

### Observáveis

- [ ] **AC25** `prisma.parceiro.delete` **não existe mais** em `src/`.
- [ ] **AC26** Log estruturado com o código em cada emissão: `[ProtocoloAdmin] EMITIDO codigo=<x> tipo=<y> entidadeId=<z> admin=<w>`. O motivo **não** vai para o log (fica no banco).
- [ ] **AC27** `npx tsc --noEmit` limpo, `npm test` sem regressão além do baseline conhecido.

---

## Estratégia de Testes

### Unitários

- [ ] `protocolo.service.spec.ts` - formato do código por tipo; zero-padding; sequência incrementa; ano vem em UTC.
- [ ] `protocolo.service.spec.ts` - primeira emissão do ano começa em 1 (contador criado sob demanda).
- [ ] `carteira.service.spec.ts` - ajuste emite protocolo, persiste motivo, usa o código no `refEvento` (AC6).
- [ ] `carteira.service.spec.ts` - regressão dos guard-rails: valor zero e acima do teto continuam recusando, sem consumir sequência (AC8).
- [ ] `carteira.service.spec.ts` - revisão e falha de saque emitem protocolo (AC19, AC20).
- [ ] `parceiro.service.spec.ts` - exclusão lógica preenche os 4 campos, desativa, revoga QR e emite `EXC` (AC10, AC11).
- [ ] `parceiro.service.spec.ts` - segunda exclusão vira 409 (AC13); cupons vinculados viram 409 com chave (AC14).
- [ ] `parceiro.service.spec.ts` - listagens e `findOne` filtram `deletedAt: null` (AC16).
- [ ] `protocolo-admin.controller.spec.ts` - consulta por código existente devolve motivo e payload; código inexistente e malformado viram 404 com `PROTOCOLO_NAO_ENCONTRADO` (AC21, AC22).
- [ ] `protocolo-admin.controller.spec.ts` - listagem por parceiro vem em ordem decrescente e inclui parceiro já excluído (AC23).

### Integração

- [ ] Postgres real: excluir parceiro que tem carteira com saldo, transações e um saque pago. Conferir que **as três tabelas continuam com as linhas** e que o protocolo aponta para o parceiro.
- [ ] Postgres real: duas emissões concorrentes do mesmo tipo produzem códigos distintos e consecutivos (AC3).

### E2E

- [ ] Membro de parceiro excluído recebe 403 no portal e na carteira (AC17).
- [ ] JWT de tutor e JWT de parceiro recebem 403 nas duas rotas de consulta de protocolo; admin recebe 200 (AC24).

### Manuais (happy path)

- [ ] Servidor local + token admin: enviar crédito com motivo, anotar o protocolo, consultar por `GET /admin/protocolo/:codigo`, conferir o motivo. Depois excluir um parceiro de teste com motivo, conferir que ele sumiu de `GET /parceiro`, que o extrato dele continua consultável e que o protocolo aparece em `GET /admin/parceiro/:id/protocolos`.

### Regressão

- [ ] Fluxo de saque completo (solicitar, pagar, falhar) intacto.
- [ ] Auditoria de credenciamento (aprovar, rejeitar, suspender) intacta: esta spec **não** mexe nela.
- [ ] Cupom do tutor não passa a mostrar parceiro excluído nem deixa de mostrar parceiro ativo.

---

## Arquivos Impactados

| Arquivo | Ação | Descrição |
|---|---|---|
| [prisma/schema.prisma](../../../../../prisma/schema.prisma) | Modificar | `ProtocoloAdmin`, `ProtocoloSequencia`, enum `TipoAcaoAdminParceiro`; 4 colunas novas em `Parceiro` |
| `prisma/migrations/<ts>_protocolo_admin_parceiro/migration.sql` | Criar | Aditiva: 2 tabelas, 1 enum, 4 colunas nullable |
| `src/common/protocolo/protocolo.service.ts` | Criar | Emissão transacional do código com lock no contador |
| `src/common/protocolo/protocolo.module.ts` | Criar | Módulo exportando o service |
| `src/common/protocolo/protocolo-admin.controller.ts` | Criar | `GET /admin/protocolo/:codigo` e `GET /admin/parceiro/:id/protocolos` |
| [src/comissao/carteira.service.ts](../../../../../src/comissao/carteira.service.ts) | Modificar | `ajuste`, `revisao` e `falharSaque` emitem protocolo na mesma tx |
| [src/comissao/dto/comissao.dto.ts](../../../../../src/comissao/dto/comissao.dto.ts) | Modificar | `@MinLength(5) @MaxLength(500)` nos motivos |
| [src/cupom/parceiro.service.ts](../../../../../src/cupom/parceiro.service.ts) | Modificar | `remove` vira `excluir(id, adminId, motivo)`; leituras filtram `deletedAt` |
| [src/cupom/parceiro.controller.ts](../../../../../src/cupom/parceiro.controller.ts) | Modificar | `DELETE /parceiro/:id` recebe body e o `userId` do admin |
| `src/cupom/dto/excluir-parceiro.dto.ts` | Criar | `{ motivo }` com `@MinLength(5) @MaxLength(500)` |
| [src/common/errors/error-catalog.ts](../../../../../src/common/errors/error-catalog.ts) | Modificar | 3 chaves novas, 4 locales |
| [src/parceiro-portal/parceiro.guard.ts](../../../../../src/parceiro-portal/parceiro.guard.ts) | Modificar | Barrar parceiro com `deletedAt` |
| Callsites do audit (T5) | Modificar | Filtro `deletedAt: null` onde couber |
| Specs `*.spec.ts` dos arquivos acima | Modificar | Conforme Estratégia de Testes |
| `scripts/test-protocolo-admin-smoke.ts` | Criar | Smoke HTTP com `process.exit` explícito |
| [docs/CHANGELOG.md](../../../../CHANGELOG.md) | Modificar | Entry da mudança |

---

## Tasks Técnicas

- [x] **T1 - Schema e migration**
  - [ ] T1.1 - `npx prisma migrate status` antes de tudo
  - [x] T1.2 - Modelar `ProtocoloAdmin`, `ProtocoloSequencia` e `TipoAcaoAdminParceiro`
  - [x] T1.3 - `Parceiro`: `deletedAt DateTime?`, `deletadoPorId String?`, `motivoExclusao String?`, `protocoloExclusao String?`
  - [x] T1.4 - Índices: `@@unique([tipoAcao, ano, sequencia])`, `@@index([entidade, entidadeId, criadoEm])`, `@@index([deletedAt])` em `Parceiro`
  - [ ] T1.5 - Migration por `migrate diff --from-config-datasource --to-schema`, aplicada com `migrate deploy` (Prisma 7 sem shadow DB)

- [x] **T2 - `ProtocoloService`** *(depende de T1)*
  - [x] T2.1 - `emitir(tx, {tipoAcao, entidade, entidadeId, adminId, motivo, payload?})` recebendo a transação de fora
  - [x] T2.2 - Contador com `SELECT ... FOR UPDATE` (upsert do par `(tipoAcao, ano)` antes)
  - [x] T2.3 - Formatação do código a partir do mapa de prefixos
  - [x] T2.4 - Log estruturado sem motivo

- [x] **T3 - Rotas de dinheiro** *(depende de T2)*
  - [x] T3.1 - `ajuste`: emitir dentro da tx, usar o código no `refEvento`, devolver `protocolo`
  - [x] T3.2 - `revisao`: envolver em `$transaction` (hoje é update solto) e emitir
  - [x] T3.3 - `falharSaque`: emitir dentro da tx que já existe
  - [x] T3.4 - Endurecer os DTOs de motivo

- [x] **T4 - Exclusão lógica** *(depende de T2)*
  - [x] T4.1 - `excluir(id, adminId, motivo)` com `updateMany` condicional em `deletedAt: null` (409 quando `count === 0`)
  - [x] T4.2 - Snapshot no payload antes de marcar
  - [x] T4.3 - Revogar QR depois da persistência, best-effort como no `decidirAuditoria`
  - [x] T4.4 - Remover `prisma.parceiro.delete`; controller passa a receber body e `req.user.userId`
  - [x] T4.5 - Migrar o 409 de cupons para chave do catálogo

- [x] **T5 - Audit grep do `deletedAt`** *(depende de T4, lista fechada do research)*
  - [x] T5.1 - [src/cupom/parceiro.service.ts](../../../../../src/cupom/parceiro.service.ts) (listar, listarPaginado, findOne, `ensureExists`, filas de auditoria e de modos)
  - [x] T5.2 - [src/cupom/cupom.service.ts:360](../../../../../src/cupom/cupom.service.ts#L360)
  - [x] T5.3 - [src/parceiro-portal/parceiro-portal.service.ts](../../../../../src/parceiro-portal/parceiro-portal.service.ts) (12 pontos, inclui cadastro e resolução de membership)
  - [x] T5.4 - [src/comissao/carteira.service.ts:88](../../../../../src/comissao/carteira.service.ts#L88) (`assertAfiliadoAtivo`) e `resolverParceiro`/`membership`
  - [x] T5.5 - [src/comissao/parceiro-indicacao-lookup.service.ts:27](../../../../../src/comissao/parceiro-indicacao-lookup.service.ts#L27) e [comissao.service.ts:117](../../../../../src/comissao/comissao.service.ts#L117)
  - [x] T5.6 - [src/qr/qr.service.ts](../../../../../src/qr/qr.service.ts) (4 pontos)
  - [x] T5.7 - [src/compartilhamento-prestador/compartilhamento-prestador-parceiro.service.ts:69](../../../../../src/compartilhamento-prestador/compartilhamento-prestador-parceiro.service.ts#L69)
  - [x] T5.8 - [src/parceiro-portal/parceiro.guard.ts](../../../../../src/parceiro-portal/parceiro.guard.ts) e a resolução de perfis do token (multi-perfil)
  - [x] T5.9 - Outreach ([dispatcher](../../../../../src/outreach/services/outreach-dispatcher.service.ts) e [campanha](../../../../../src/outreach/services/outreach-campanha.service.ts)): decidir se lead de parceiro excluído volta a ser lead. Default: **não filtrar** (medição de conversão histórica), decisão registrada no PR
  - [ ] T5.10 - Rodar `npm run audit:endpoints` e o agent `security-auditor` no diff
  - [x] T5.11 *(fora da lista original, achado na implementação)* - `src/auth/auth.service.ts`: `getPerfis` e a troca de perfil do multi-perfil listavam/aceitavam parceiro excluído
  - [x] T5.12 *(idem)* - `src/auth/services/parceiro-role.resolver.impl.ts`: o papel PARCEIRO saía de membership em parceiro excluído
  - [x] T5.13 *(idem)* - `parceiro-portal.service.ts` auto-cadastro: sem o filtro, um parceiro APROVADO já excluído travava um cadastro novo do mesmo dono com `PARCEIRO_CADASTRO_JA_EXISTE`
  - [x] T5.14 - Pontos auditados e **deixados sem filtro**, de propósito: `qr.service.ts` (precisa ler o parceiro já marcado para revogar o QR), `compartilhamento-prestador` (coberto pelo `ativo: false` que a exclusão grava, via `isOperacional`) e `outreach` (lead de parceiro excluído continua contando na medição histórica de conversão)

- [x] **T6 - Consulta** *(depende de T2)* - `GET /admin/protocolo/:codigo` e `GET /admin/parceiro/:id/protocolos`, ambas com `SystemAdminGuard`

- [x] **T7 - Catálogo i18n** - `PARCEIRO_JA_EXCLUIDO`, `PARCEIRO_EXCLUSAO_BLOQUEADA_CUPONS`, `PROTOCOLO_NAO_ENCONTRADO` nos 4 locales

- [x] **T8 - Testes** *(depende de T2-T7)* - conforme Estratégia de Testes

- [x] **T9 - Smoke** - `scripts/test-protocolo-admin-smoke.ts`: crédito com motivo, consulta pelo protocolo, exclusão, verificação de que o ledger sobreviveu, cleanup e `process.exit`

- [ ] **T10 - Fechamento** - `tsc --noEmit`, `npm test`, `/code-review`, CHANGELOG, contrato do CMS documentado, status da spec

---

## Considerações de Arquitetura

### Decisão 1 - Tabela de trilha genérica, não campos por tabela
- **Decisão:** um `ProtocoloAdmin` polimórfico (`entidade` + `entidadeId`) serve as 4 ações.
- **Motivo:** as ações moram em módulos diferentes (`comissao` e `cupom`) e o formato do protocolo precisa ser um só. Segue o precedente de `PetInativacaoLog`/`InactivationLog`.
- **Alternativa rejeitada:** `motivoCredito`/`protocoloCredito` em cada tabela. Não dá para consultar "todos os protocolos deste parceiro" sem varrer N tabelas, e a exclusão precisaria de trilha externa de qualquer jeito.
- **Nota:** a exclusão do parceiro **também** grava `motivoExclusao` e `protocoloExclusao` na própria tabela. Redundância proposital: a linha do parceiro se explica sozinha, sem join, no lugar onde o admin olha primeiro.

### Decisão 2 - Sequência serializada no banco, não retry otimista
- **Decisão (revisada na implementação, v0.2):** um único `INSERT ... ON CONFLICT ("tipoAcao","ano") DO UPDATE SET ultimo = ultimo + 1 RETURNING ultimo`.
- **Motivo:** entrega a mesma garantia do `SELECT ... FOR UPDATE` planejado (a segunda transação bloqueia no lock de linha e sai com o número seguinte), em uma ida ao banco em vez de três, e sem precisar criar a linha do contador antes. `ON CONFLICT DO UPDATE` não aborta a transação, que é o requisito real: a emissão roda dentro da transação do crédito.
- **Alternativa rejeitada:** `MAX(sequencia) + 1` com retry em P2002 (padrão do `PublicCodeService`). No Postgres, o P2002 **aborta a transação inteira**, então o retry obrigaria a reexecutar o crédito e o débito junto. Correto para código aleatório fora de transação, errado aqui.
- **Alternativa rejeitada:** SEQUENCE nativa do Postgres. Não reinicia por ano e vira DDL fora do controle do Prisma.
- **Rede de segurança mantida:** `@@unique([tipoAcao, ano, sequencia])` continua no schema.

### Decisão 3 - Exclusão lógica
- **Decisão:** `DELETE /parceiro/:id` marca `deletedAt` em vez de apagar.
- **Motivo:** o ledger é declarado append-only e fonte de verdade no próprio schema, e hoje o delete o destrói em cascata junto com carteira e saques. Comissão paga é obrigação contábil. Também elimina o P2003 não tratado de parceiro com indicados.
- **Alternativa rejeitada:** hard delete com trilha externa. O protocolo sobreviveria, o extrato não. Um snapshot em JSON não substitui o ledger.
- **Alternativa rejeitada:** híbrido (delete físico quando "limpo"). Dois caminhos, dois contratos para o CMS e uma regra que muda conforme o histórico do parceiro.

### Decisão 4 - `DELETE` com body, e não `POST /:id/excluir`
- **Decisão:** manter o verbo, exigir `{ motivo }` no corpo.
- **Motivo:** o CMS já chama `DELETE`; a mudança lá é acrescentar corpo, não trocar rota. Fastify suporta body em DELETE.
- **Alternativa rejeitada:** `POST /parceiro/:id/excluir`, que seria mais parecido com `POST /:id/auditoria/suspender`. Fica registrada como plano B se o smoke HTTP mostrar corpo sendo descartado no caminho até o Railway.

### Decisão 5 - Motivo ausente é 400 do `ValidationPipe`, não chave do catálogo
- **Decisão:** validação de presença e tamanho fica no DTO; chaves do `ERROR_CATALOG` cobrem só erro de negócio.
- **Motivo:** é o padrão do repo (`MotivoAuditoriaDto`) e evita duplicar validação no service só para trocar o formato do erro. Superfície é 100% admin interna.
- **Contraponto assumido:** a mensagem do `ValidationPipe` não é traduzida. Aceitável aqui, seria inaceitável em rota de tutor.

### Decisão 6 - `refEvento` passa a carregar o protocolo
- **Decisão:** `refEvento = "ajuste:CRD-2026-000123"` em vez de `ajuste:<uuid>`.
- **Motivo:** `refEvento` já é a chave de idempotência única do ledger. Reaproveitar liga extrato e protocolo sem coluna nova nem join extra.
- **Nota:** só afeta registros novos. Os `ajuste:<uuid>` históricos continuam válidos e legíveis.

---

## Plano de Rollout

- [ ] Trabalho direto em `develop`
- [ ] `prisma migrate status` limpo, migration aditiva aplicada em dev
- [ ] Deploy do backend. As 3 rotas de dinheiro são retrocompatíveis
- [ ] **Combinar com o CMS antes de considerar concluído:** o botão de excluir parceiro fica quebrado entre o deploy do backend e o ajuste do CMS. Se preferir, o ajuste do CMS entra primeiro mandando `{motivo}` (o backend antigo ignora corpo desconhecido) e o backend sobe depois, sem janela quebrada. **Caminho recomendado.**
- [ ] Smoke em dev antes de prod

## Plano de Rollback

- Código: revert do commit e redeploy. As rotas voltam a não emitir protocolo.
- Tabelas `ProtocoloAdmin` e `ProtocoloSequencia`: podem ficar no banco sem uso; drop só se houver limpeza deliberada.
- **Atenção:** as 4 colunas de exclusão em `Parceiro` **devem permanecer** mesmo em rollback. Se o código voltar a fazer delete físico com linhas já marcadas como excluídas, um parceiro logicamente excluído volta a aparecer nas listagens. Antes de reverter, conferir `SELECT id, nome FROM "Parceiro" WHERE "deletedAt" IS NOT NULL` e decidir o destino de cada linha.

---

## Observabilidade

| Log | Severity | Quando |
|---|---|---|
| `[ProtocoloAdmin] EMITIDO codigo=<x> tipo=<y> entidadeId=<z> admin=<w>` | info | Toda emissão. Sem o motivo (fica no banco) |
| `[Parceiro] EXCLUSAO_LOGICA parceiroId=<x> protocolo=<y> admin=<z>` | warn | Exclusão. Ação sem volta prática |
| `[Carteira][AJUSTE]` (existente) | info | Passa a incluir o código e a **parar de logar o motivo** |

Sem alerta dedicado: volume é de operação manual.

---

## Definition of Done

- [ ] AC1 a AC27 verificados um a um
- [ ] Testes da Estratégia implementados e passando
- [ ] `npx tsc --noEmit` e lint limpos
- [ ] `npm test` sem regressão além do baseline conhecido
- [ ] `/code-review` rodado, findings de correção resolvidos
- [ ] `security-auditor` rodado (mexe em rota admin, guard e filtro de leitura)
- [ ] Audit grep T5 completo, com os 9 arquivos conferidos um a um
- [ ] Fluxo exercitado de verdade: crédito emitido, protocolo consultado, parceiro excluído, ledger conferido no banco
- [ ] Contrato do CMS documentado e combinado
- [ ] CHANGELOG atualizado
- [ ] Spec com status `Concluído` + Change Log
- [ ] `/spec-sync` rodado

## Perguntas em Aberto

- [ ] **Parceiro excluído pode ser restaurado?** O dado permite (basta zerar `deletedAt`), mas nenhuma rota faz isso nesta spec. Se for desejado, vira `POST /parceiro/:id/restaurar` com motivo e protocolo próprio (prefixo `RST`). Responsável: Nicolas.
- [ ] **Pagamento de saque (`POST /admin/parceiro/saques/:id/pagar`) entra na trilha?** Ficou fora porque não tem motivo hoje (só `comprovante` opcional), mas é a ação que mais mexe em dinheiro real. Responsável: Nicolas.

## Follow-ups (fora desta spec)

- Spec de CMS: campo de motivo no modal de exclusão, exibição do protocolo no recibo do ajuste e tela de consulta por protocolo.
- Expurgo definitivo de parceiro por pedido de titular (LGPD), com o protocolo servindo de trilha.
- Estender o protocolo para ações admin sobre tutor e pet, se o padrão pegar.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-08-05 | 0.1 | Criação. Research achou que a exclusão de parceiro apaga carteira, ledger e saques em cascata, e que o motivo do ajuste nunca foi persistido. Decisões fechadas com o Nicolas: exclusão lógica, protocolo `PREFIXO-ANO-SEQ` e escopo incluindo revisão antifraude e falha de saque. | Claude + Nicolas |
| 2026-08-05 | 0.2 | T1 a T9 implementadas. Dois desvios conscientes em relação ao texto original, ambos detalhados abaixo: a reserva de sequência virou UPSERT atômico com `RETURNING` (em vez de `SELECT ... FOR UPDATE` em duas idas ao banco) e o audit de `deletedAt` cobriu 4 pontos a mais do que a lista da T5. Migration, typecheck, testes e smoke ficaram para o lote final. | Claude |
