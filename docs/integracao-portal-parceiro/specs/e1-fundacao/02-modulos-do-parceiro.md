# Spec: Módulos do parceiro (Clínica e Hotel) ligados no servidor

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.3
**Épico:** [E1 fundação](../../../../../epicos/portal-parceiro-e1-fundacao.md)
**Depende de:** nada

---

## Visão Geral

Criar o conceito de **módulo ligado por parceiro** (CLINICA, HOTEL), com status decidido no servidor, uma rota para o portal montar o menu e um guard que toda rota clínica ou de hotel usa. É o que substitui o interruptor `?clinico=on` / `?hotel=on` do portal e o uso de `hasVeterinarioProfile()` para decidir o menu.

## Motivação

- O portal liga os módulos no cliente (`petjourney-admin/src/composables/useModuloOculto.ts`, guardado no `localStorage` por conta e máquina) e esconde as rotas com uma guarda de navegação. Qualquer conta que digite o parâmetro vê as telas, inclusive pet shop e farmácia. Foi assim que as telas apareceram para uma conta nova em produção (comentário do próprio arquivo, linhas 13-16).
- O `ParceiroGuard` libera por membership sem olhar categoria, auditoria ou papel (`src/parceiro-portal/parceiro.guard.ts:16-43`). Uma rota clínica atrás dele abriria para qualquer parceiro (a mesma lição do influenciador, `prisma/schema.prisma:3357-3362`).

---

## Research Findings

- `CategoriaParceiro` (`schema.prisma:350-363`): `CLINICA_VETERINARIA`, `VETERINARIO`, `PET_SHOP`, `BANHO_TOSA`, `ADESTRAMENTO`, `HOTEL_CRECHE`, `FARMACIA`, `OUTRO`, opcional no cadastro.
- `ParceiroMembershipService` (`src/parceiro-portal/parceiro-membership.service.ts:26-92`): `resolverParceiro`, `membership`, `isOperacional` (APROVADO + ativo). É onde o guard novo se apoia.
- `@Roles`/`RolesGuard` existem e nenhum controller usa (`src/auth/guards/roles.guard.ts:38`). Não servem aqui porque o papel é por parceiro, não global.
- Não existe plano nem cobrança de parceiro (`TipoEntidade` sem `PARCEIRO`, `schema.prisma:1380-1384`). A monetização é a Q1 do épico pai: esta spec deixa o gancho (`origem=PLANO`, `ativoAte`) sem cobrar nada.
- Feature flags hoje são env lidas por módulo (inventário 3.7); config de produto vai para tabela (memória).

**Breaking changes:** nenhuma na API. No portal, o menu clínico passa a depender de `GET /parceiro/portal/modulos` (handoff).

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Rota nova do módulo esquecer o guard | `ModuloGuard` aplicado na classe dos controllers de `src/clinica-*` e `src/hotel-*`; `audit:endpoints` ganha uma regra: controller sob `parceiro/portal/clinica` ou `parceiro/portal/hotel` sem `@ExigeModulo` reprova o CI |
| Médio | Desligar o módulo apagar acesso ao que a clínica já registrou | D-E1.6: módulo SUSPENSO ou DESLIGADO mantém leitura e exportação; só escrita e publicação param |
| Baixo | Demo comercial precisar do mock | A conta de demonstração ganha módulo TESTE com dados seed no ambiente de dev; o mock do portal deixa de ser alcançável em build de produção (handoff) |

---

## Modelo de dados (aditivo)

```prisma
enum ModuloParceiro { CLINICA HOTEL }
enum StatusModulo   { TESTE ATIVO SUSPENSO DESLIGADO }
enum OrigemModulo   { ADMIN TESTE_GRATUITO PLANO }

model ModuloDoParceiro {
  parceiroId     String
  modulo         ModuloParceiro
  status         StatusModulo
  origem         OrigemModulo
  ativoAte       DateTime?   // fim do teste ou do período pago; null = sem prazo
  decididoPorId  String?
  decididoEm     DateTime    @default(now())
  motivo         String?
  parceiro       Parceiro    @relation(fields: [parceiroId], references: [id], onDelete: Cascade)
  @@id([parceiroId, modulo])
}
```

Elegibilidade sugerida por categoria (só sugere, quem liga é o admin ou o self-service da Q1): CLINICA para `CLINICA_VETERINARIA` e `VETERINARIO`; HOTEL para `HOTEL_CRECHE`; os dois podem ser pedidos por qualquer categoria e o admin decide.

## Rotas

| Método e rota | Quem | Descrição |
|---|---|---|
| `GET /parceiro/portal/modulos` | membro | `[{ modulo, status, ativoAte, podeEscrever }]` + `elegiveis[]` |
| `POST /parceiro/portal/modulos/:modulo/solicitar` | DONO | Pede o módulo (status vira pendente de decisão do admin, no padrão dos modos de participação) |
| `GET /admin/parceiro/:parceiroId/modulos` | SystemAdmin | Lista |
| `POST /admin/parceiro/:parceiroId/modulos/:modulo` | SystemAdmin | `{ status, origem, ativoAte?, motivo }`, com `ProtocoloAdmin` |

Guard e decorator: `@ExigeModulo(ModuloParceiro.CLINICA)` + `ModuloGuard`, depois do `ParceiroGuard`. Leitura passa com TESTE, ATIVO, SUSPENSO, DESLIGADO (só do que já existe); escrita exige TESTE ou ATIVO, `ativoAte` no futuro e parceiro operável. Recusa com 403 `codigo: MODULO_INATIVO` ou `MODULO_SOMENTE_LEITURA`.

Cron diário (advisory lock, padrão `notificacao/helpers/advisory-lock.helper.ts`) passa para SUSPENSO o módulo com `ativoAte` vencido e avisa o DONO (tipo novo `PARCEIRO_MODULO_VENCENDO`, 7 dias antes, e `PARCEIRO_MODULO_SUSPENSO`).

## Acceptance Criteria

- [x] **Given** um pet shop sem módulo **When** chama qualquer rota de `parceiro/portal/clinica/*` **Then** 403 `MODULO_INATIVO`. *`modulo.guard.spec.ts` (controller de teste sob `parceiro/portal/clinica`, Fastify real) e o smoke de pacientes (403 `MODULO_INATIVO` no cadastro).*
- [x] **Given** módulo CLINICA SUSPENSO **When** lê a agenda **Then** 200; **When** cria agendamento **Then** 403 `MODULO_SOMENTE_LEITURA`. *`modulo.guard.spec.ts` (AC2) e o smoke de módulos (SUSPENSO lê e não escreve).*
- [x] **Given** `ativoAte` vencido **When** o cron roda **Then** o status vira SUSPENSO e o DONO recebe a notificação, uma vez só (marcador de idempotência). *`modulo-parceiro.cron.spec.ts` (AC3 idempotência, outra réplica com o lock).*
- [x] **Given** decisão do admin **Then** fica um `ProtocoloAdmin` com motivo. *Smoke de módulos: protocolo MOD com tipo, parceiro e motivo, um por decisão aceita.*
- [x] O CI reprova controller sob `parceiro/portal/clinica` ou `parceiro/portal/hotel` sem `@ExigeModulo`. *`audit-endpoints-modulo.spec.ts` e `npm run audit:endpoints` verde no G1.*

## Estratégia de Testes

- Unit do guard (matriz status x leitura/escrita), do cron (vencido, ainda no prazo, idempotência), do `audit:endpoints` com um controller de teste sem decorator.
- Cenários: parceiro sem módulo, módulo suspenso.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar |
| `src/parceiro-portal/modulos/` (service, controller, guard, decorator, cron) | Criar |
| `src/notificacao/catalogo/notificacao-catalogo.ts` e registros exaustivos | Modificar (2 tipos novos, 6 locales) |
| `scripts/audit-endpoints.ts` | Modificar (regra nova) |

## Tasks

- [x] **T1** Migration
- [x] **T2** Service + guard + decorator *(T1)*
- [x] **T3** Rotas do parceiro e do admin com protocolo *(T2)*
- [x] **T4** Cron de vencimento + 2 notificações *(T2)*
- [x] **T5** Regra no `audit:endpoints` *(T2)*
- [x] **T6** Testes + handoff (menu pelo servidor; mock fora do build de produção). Handoff na seção 2 de `docs/frontend/novembro-2026/portal-parceiro-e1.md`; tirar o mock do build é do portal (Luís)

## Rollout / Rollback

Aditivo. Nenhum parceiro nasce com módulo. Rollback: reverter o código; os controllers clínicos não existem ainda nesta onda.

## Decisões da auditoria de segurança da onda 1 (2026-10-21)

- **A1 A regra do `audit:endpoints` cobre o cadastro de pacientes e clientes** (achado B11). Além de `parceiro/portal/clinica` e `parceiro/portal/hotel`, toda rota sob `parceiro/portal/pacientes` e `parceiro/portal/clientes` (o cadastro que Clínica e Hotel dividem, E2-01) precisa de `@ExigeModulo` e do `ModuloGuard` (`ROTA_DE_MODULO_RE` em `scripts/lib/audit-endpoints-regras.ts`).
  - As rotas de pacientes e clientes já usavam `@ExigeModulo(QUALQUER_MODULO)`; a regra nova pegou a trilha do paciente (`GET /parceiro/portal/pacientes/:pacienteId/auditoria`, E1-05), que ganhou `ModuloGuard` + `@ExigeModulo(QUALQUER_MODULO)` (leitura: vale com o módulo suspenso ou desligado, D-E1.6).

## Perguntas em Aberto

- [ ] **Q1 do épico pai** (monetização): enquanto não decidir, só o admin liga módulo, com `origem=ADMIN` ou `TESTE_GRATUITO`.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Auditoria de segurança da onda 1: regra do `audit:endpoints` estendida a `parceiro/portal/pacientes` e `parceiro/portal/clientes` (A1; achado B11) | Claude |
| 2026-10-21 | 0.3 | Gate G1: AC1 a AC5 conferidos (guard pela rota com Fastify real, cron com idempotência, protocolo MOD no smoke 27/27, regra do `audit:endpoints`); T6 fechada; concluída do lado da API | Claude |
