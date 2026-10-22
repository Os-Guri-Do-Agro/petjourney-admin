# Spec: Profissionais com CRMV, papéis operacionais e permissão por recurso

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.5
**Épico:** [E1 fundação](../../../../../epicos/portal-parceiro-e1-fundacao.md)
**Depende de:** [E0-01 equipe completa](../e0-consertos/01-equipe-completa.md), [E1-02 módulos](02-modulos-do-parceiro.md)

---

## Visão Geral

Três peças juntas:
1. **`Profissional`**: quem atende, aplica, prescreve ou cuida, com nome, conselho (CRMV), número, UF, especialidades e cor de coluna. Existe com ou sem login.
2. **Papéis operacionais** na `ParceiroEquipe` (recepção, veterinário, enfermagem, cuidador, gestor, financeiro), somados ao DONO/OPERADOR que já existem.
3. **Matriz de permissão por recurso** e um guard único, `PermissaoParceiroGuard`, que toda rota do módulo usa.

## Motivação

- A Res. CFMV 1.321/2020, art. 9, inciso VIII (redação da 1.653/2025), pede o nome e o CRMV de cada profissional responsável por procedimento. Hoje a identidade de quem atende é texto livre (`AnotacaoPrestador.profissionalNome`, `Consulta.veterinarioNome`; inventário 1.4 e 1.5).
- O portal já trata profissional como entidade (`Professional`: `conselho`, `especialidade`, `corIndice`, `salaPadraoId`, `ativo`, em `petjourney-admin/src/features/clinico/data/types.ts:74-84`) e o hotel tem a equipe dele (`Cuidador` com `funcao`, `hotel/data/types.ts:284-307`).
- Sem permissão por recurso, a recepção lê o prontuário inteiro e o cuidador do hotel vê a receita controlada.

---

## Research Findings

- `ParceiroEquipe` (`prisma/schema.prisma:472-485`) só tem `papel` DONO/OPERADOR. `assertDono` está no `parceiro-portal.service.ts:890-893`. Regras herdadas: só DONO gere equipe, PIX e saque (`regras.md` 7.4); só APROVADO+ativo opera (7.5).
- `Parceiro.crmv` existe só como subsídio do cadastro, nunca obrigatório (D9.2) e nunca público (D9.14).
- O legado `ClinicaRole`/`ClinicaPermission` (`schema.prisma:169-188`) é o único RBAC fino do schema e fica dormente (D7). Não é reaproveitado (E1-07).
- Especialidade segue a regra da `Consulta.veterinarioEspecialidade`: chave da lista do app ou texto livre (inventário 4.2, item 17).

**Breaking changes:** nenhuma. DONO continua com tudo; OPERADOR sem papel operacional continua vendo só o portal comercial (o comportamento de hoje).

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Alto | Permissão errada vazar prontuário para quem não deve | Matriz como constante tipada (`Record<PapelOperacional, Permissao[]>`), teste de tabela verdade que falha se uma permissão nova não for classificada, cenários por papel |
| Médio | CRMV falso assinando receita | Assinar receita exige `conselho=CRMV`, número e UF preenchidos; o selo "CRMV conferido" (`crmvConferidoEm`) é dado pelo admin no CMS; a receita mostra o número do jeito que está cadastrado. Conferência automática com o CFMV fica no E9 |
| Médio | Profissional sem login usado para mascarar autoria | Todo ato registra também o `usuarioId` de quem clicou; o `profissionalId` diz em nome de quem. A trilha (E1-05) guarda os dois |

---

## Modelo de dados (aditivo)

```prisma
enum PapelOperacional { RECEPCAO VETERINARIO ENFERMAGEM CUIDADOR BANHISTA ADESTRADOR GESTOR FINANCEIRO } // BANHISTA e ADESTRADOR vêm do FuncaoDaEquipe do hotel; permissões de CUIDADOR
enum ConselhoProfissional { CRMV OUTRO NENHUM }

// em ParceiroEquipe (aditivo)
papeisOperacionais PapelOperacional[] @default([])

model Profissional {
  id              String               @id @default(cuid())
  parceiroId      String
  usuarioId       String?              // membro da equipe, quando tem login
  nome            String
  conselho        ConselhoProfissional @default(NENHUM)
  registro        String?              // número do CRMV, só dígitos
  uf              String?
  crmvConferidoEm DateTime?
  conferidoPorId  String?
  especialidades  String[]             // chave do app ou texto livre (até 5, 60 caracteres)
  corIndice       Int                  @default(0) // 0..5, nunca cor literal
  salaPadraoId    String?              // E3-01
  atendeNaAgenda  Boolean              @default(true)
  ativo           Boolean              @default(true)
  criadoEm        DateTime             @default(now())
  parceiro        Parceiro             @relation(fields: [parceiroId], references: [id], onDelete: Cascade)
  @@unique([parceiroId, usuarioId])
  @@unique([parceiroId, conselho, registro, uf])
  @@index([parceiroId, ativo])
}
```

## Matriz de permissão (v1)

| Permissão | DONO | GESTOR | RECEPCAO | VETERINARIO | ENFERMAGEM | CUIDADOR | FINANCEIRO |
|---|---|---|---|---|---|---|---|
| `equipe.gerir`, `estabelecimento.editar`, `modulos.solicitar` | sim | `estabelecimento.editar` | | | | | |
| `paciente.ler` (cadastro) | sim | sim | sim | sim | sim | sim (só hóspedes) | |
| `paciente.escrever` | sim | sim | sim | sim | | | |
| `agenda.ler`, `agenda.escrever`, `pedido.responder`, `fila.gerir` | sim | sim | sim | sim | `agenda.ler` | | |
| `prontuario.ler` | sim | | | sim | sim | | |
| `prontuario.escrever`, `prontuario.finalizar`, `resumo.liberar` | sim (se for profissional CRMV) | | | sim | | | |
| `receita.assinar` | se CRMV | | | se CRMV | | | |
| `vacina.aplicar` | sim | | | sim | sim | | |
| `internacao.prescrever` | se CRMV | | | sim | | | |
| `internacao.executar`, `boletim.compor` | sim | | | sim | sim | | |
| `boletim.enviar` (após ligação) | sim | | sim | sim | sim | | |
| `estoque.ler`, `estoque.movimentar` | sim | sim | `estoque.ler` | sim | sim | | `estoque.ler` |
| `estoque.planejar` | sim | sim | | | | | |
| `hotel.*` (reserva, check-in, rotina, check-out) | sim | sim | sim | `hotel.ler` | | sim | |
| `importacao.executar` | sim | sim | | | | | |
| `auditoria.ler` | sim | sim | | | | | |
| `financeiro.*` (E9) | sim | | | | | | sim |

BANHISTA e ADESTRADOR (funções do hotel no portal, `FuncaoDaEquipe` em `hotel/data/types.ts:284-297`) têm as mesmas permissões de CUIDADOR. OPERADOR sem papel operacional: nenhuma permissão de módulo. DONO: tudo do módulo ligado, exceto o que exige CRMV (assinar receita, prescrever internação, finalizar prontuário), que exige o DONO ser também um `Profissional` com CRMV.

## Rotas

| Método e rota | Quem | Descrição |
|---|---|---|
| `GET /parceiro/portal/profissionais` | membro | Lista (com filtro `ativo`, `atendeNaAgenda`) |
| `POST /parceiro/portal/profissionais` | `equipe.gerir` | Cria (com ou sem `usuarioId` de um membro ativo) |
| `PATCH /parceiro/portal/profissionais/:id` | `equipe.gerir` (e o próprio, só cor e especialidades) | Atualiza. `ativo: true` reativa (só com o login ativo na equipe). Ficha com conselho ligada a um login não passa para outro (409) |
| `POST /parceiro/portal/profissionais/:id/desativar` | `equipe.gerir` | Desativa (nunca apaga: há atos ligados) |
| `PUT /parceiro/portal/equipe/:usuarioId/papeis` | `equipe.gerir` | `{ papeisOperacionais: [] }` |
| `GET /parceiro/portal/eu` | membro | `{ parceiroId, papel, papeisOperacionais, profissional, permissoes[], aguardandoCrmv[], modulos[], elegiveis[] }`: o portal monta o menu daqui. `aguardandoCrmv` = das `permissoes`, as que o guard ainda recusa com `CRMV_OBRIGATORIO` (mesma função `crmvEmDia` do guard) |
| `POST /admin/parceiro/:parceiroId/profissionais/:id/conferir-crmv` | SystemAdmin | `{ motivo }` (10 a 500). Marca `crmvConferidoEm` e emite o protocolo `CRM` na mesma transação. Só ficha CRMV com número e UF (400 `PROFISSIONAL_REGISTRO_INCOMPLETO`) |

Guard: `@ExigePermissao('prontuario.escrever')` + `PermissaoParceiroGuard` (resolve parceiro, membership, papéis, profissional, módulo). Ownership novo no `OwnershipService`: `assertProfissionalDoParceiro(profissionalId, parceiroId)`.

Vet autônomo (`categoria=VETERINARIO`): ao ligar o módulo CLINICA, nasce um `Profissional` para o DONO, sem conselho (v0.3, D-A3), e papel VETERINARIO, para ele não precisar cadastrar a si mesmo; o CRMV ele informa na ficha.

Decidido na implementação (v0.2), em `src/profissional/regras/vet-autonomo.ts`:
- **Função pura com a transação de quem liga** (`garantirVetAutonomo(tx, parceiroId)`), chamada no `decidir` do E1-02 quando CLINICA vai para TESTE ou ATIVO. Não é método de service: o `ProfissionalModule` já depende do módulo do portal, e o contrário faria ciclo.
- **Só com exatamente um DONO ativo.** Com dois, não adivinha qual deles é o veterinário autônomo.
- **Nunca lança erro de banco na transação** (`createMany` com `skipDuplicates`): ficha que já existe para o DONO fica como está.
- ~~**`Parceiro.crmv` é texto livre**: `lerCrmvDoCadastro` lia "CRMV-SP 12345" e a ficha nascia com esse CRMV.~~ Revogado na v0.3 (D-A3): a ficha nasce com conselho NENHUM e o `eu` lista em `aguardandoCrmv` o que espera o CRMV.

### Decisões da auditoria de segurança da onda 1 (2026-10-21)

- **D-A1 Ficha desativada na saída da equipe; reativação pelo PATCH** (achado A1). Sair ou ser removido desativa a ficha ligada ao login (E0-01, D9). `PATCH .../profissionais/:id` ganhou `ativo` (só `equipe.gerir`): `true` reativa, e ficha com login só reativa com o login ativo na equipe (400 `PROFISSIONAL_USUARIO_FORA_DA_EQUIPE`). Sem isso, o veterinário que saiu e voltou ficava sem ficha que assinasse e sem como ganhar outra (o índice único por login e por CRMV recusava a nova).
- **D-A2 O selo "CRMV conferido" é da pessoa, não da ficha** (achado M2).
  - Ficha com conselho (CRMV ou OUTRO) já ligada a um login não passa para outro login: 409 `PROFISSIONAL_DUPLICADO` com `reason: FICHA_LIGADA_A_OUTRO_LOGIN`. Outra pessoa ganha outra ficha. Era o caminho de quem tem `equipe.gerir` para ligar a ficha da Dra. Y ao próprio login e assinar com o CRMV conferido dela.
  - Ficha sem login (o plantonista) ligada a um login continua permitida, mas o selo cai (`crmvConferidoEm` e `conferidoPorId` nulos): o admin confere de novo. Desligar (`usuarioId: null`) e religar cai na mesma regra, então o selo nunca acompanha a troca de pessoa.
  - Ficha sem conselho troca de login à vontade (não há número nem selo).
  - O `crmvEmDia` do guard ainda não exige o selo (assina com CRMV, número e UF preenchidos); a recusa de troca é o que impede herdar o CRMV de outra pessoa sem digitar.
- **D-A3 Vet autônomo sem o CRMV do cadastro** (achado M4). Nada no schema prova que o DONO de hoje digitou o `Parceiro.crmv`: o `Parceiro` não guarda quem o criou, a linha DONO do autocadastro é igual à do DONO nomeado pelo admin (`convidadoPorId` nulo nas duas), o campo é regravado por qualquer DONO (`PATCH /parceiro/portal/cadastro`, re-submissão) e pelo admin sem registro de autoria, e o `joinedAt` muda na reativação. A vet A cadastrava "CRMV-SP 12345", o negócio passava para B e B ganhava ficha que assinava com o CRMV de A. A ficha nasce com conselho NENHUM.
- **D-A4 Conferência de CRMV atômica sobre o número** (achado B5). O selo é gravado por `updateMany` com conselho, número e UF lidos no `where`: se a clínica trocou o registro entre a tela do admin e o clique, nada muda, o protocolo não sai (rollback) e a resposta é 409 (`PROFISSIONAL_NAO_ENCONTRADO`, `reason: REGISTRO_MUDOU`; chave própria pedida ao catálogo).
- **D-A5 Escrita só com o parceiro operável** (achado B7). Criar, atualizar e desativar profissional, e definir papéis na equipe, respondem 409 `PARCEIRO_NAO_OPERACIONAL` com o parceiro suspenso, em análise ou inativo, como o `trocarPapel`.

## Acceptance Criteria

- [x] **Given** membro com papel RECEPCAO **When** chama `GET .../clinica/atendimentos/:id` (E4-01) **Then** 403 `SEM_PERMISSAO` (o teste de matriz cobre esse par). *Coberto pelo guard contra o Postgres (`profissional.integration.spec.ts`); a rota do E4-01 herda o `@ExigePermissao('prontuario.ler')`.*
- [x] **Given** profissional sem CRMV **When** tenta assinar receita **Then** 403 `CRMV_OBRIGATORIO`.
- [x] **Given** dois profissionais com o mesmo CRMV e UF no mesmo parceiro **Then** 409.
- [x] **Given** profissional desativado **Then** some da lista de agenda e continua aparecendo como autor nos atos antigos. *A linha nunca é apagada (integração); os atos que apontam para ela chegam no E4.*
- [x] `GET /parceiro/portal/eu` devolve `permissoes` iguais às da matriz para cada combinação de papéis (teste de tabela).
- [x] Teste de matriz falha se uma `Permissao` nova não estiver em nenhuma coluna.

## Estratégia de Testes

- Unit: matriz (tabela verdade), guard (sem módulo, sem papel, papel certo, DONO sem CRMV), unicidade de CRMV, criação automática do vet autônomo.
- Cenários `qa/cenarios/`: recepção lê prontuário (403), cuidador lê receita (403), ex-membro (403).

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` + migration | Modificar (`Profissional`, enums, coluna em `ParceiroEquipe`) |
| `src/parceiro-portal/permissoes/` (matriz, guard, decorator) | Criar |
| `src/profissional/` (module, controller, service, dto) | Criar |
| `src/auth/services/ownership.service.ts` | Modificar (assert novo + teste dedicado, regra do repo) |
| `src/parceiro-portal/parceiro-equipe.service.ts` (da E0-01) | Modificar (papéis) |

## Tasks

- [x] **T1** Migration (`20261021094000`)
- [x] **T2** Matriz + guard + decorator + teste de tabela *(T1)*
- [x] **T3** CRUD de profissional + `eu` + conferência no admin *(T1)*
- [x] **T4** Papéis na equipe *(T1, E0-01)*
- [x] **T5** Vet autônomo automático ao ligar o módulo *(T3, E1-02)*. A chamada está no `decidir` (`modulo-parceiro.service.ts`, na transação da decisão)
- [x] **T6** Testes, cenários, handoff (tela de equipe com papéis, cadastro de profissionais). Testes e handoff (seção 4 de `docs/frontend/novembro-2026/portal-parceiro-e1.md`) prontos; cenários HTTP verdes no gate G1

## Rollout / Rollback

Aditivo. Rollback reverte código; a coluna `papeisOperacionais` fica com o default vazio.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementação: `eu` com `aguardandoCrmv` (regra única `crmvEmDia` com o guard), conferência de CRMV com protocolo, regras do vet autônomo | Claude |
| 2026-10-21 | 0.3 | Auditoria de segurança da onda 1: D-A1 (ficha desativada na saída, `ativo` no PATCH; A1), D-A2 (troca de login de ficha com conselho; M2), D-A3 (vet autônomo sem o CRMV do cadastro, `lerCrmvDoCadastro` removida; M4), D-A4 (conferência atômica; B5), D-A5 (parceiro operável; B7) | Claude |
| 2026-10-21 | 0.4 | Auditoria da onda 1, parte da matriz: `prontuario.escrever` e `resumo.liberar` exigem CRMV de qualquer papel, não só do DONO (M3); CUIDADOR, BANHISTA e ADESTRADOR sem `paciente.ler` até o E7 trazer a leitura recortada para hóspedes (M6). Aberto para decisão: exigir o selo `crmvConferidoEm` em `receita.assinar` (achado SEG-2026-10-21-CRMV-SEM-SELO) | Claude |
| 2026-10-21 | 0.5 | Gate G1: T5 (o `decidir` do E1-02 chama `garantirVetAutonomo` ao ligar a Clínica) e T6 (cenários HTTP verdes no `qa:cenarios`) fechadas; concluída do lado da API. Segue aberta a decisão do selo em `receita.assinar` | Claude |
