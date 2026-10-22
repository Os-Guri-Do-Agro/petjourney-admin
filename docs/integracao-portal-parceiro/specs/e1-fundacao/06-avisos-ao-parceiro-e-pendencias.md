# Spec: Avisos à equipe do parceiro e contadores de pendência

**Status:** Concluído (API em dev, 2026-10-21; front em novembro com o Luís)
**Autor:** Nicolas (via Claude)
**Criado em:** 2026-10-20
**Versão:** 0.3
**Épico:** [E1 fundação](../../../../../epicos/portal-parceiro-e1-fundacao.md)
**Depende de:** [E1-03 profissionais e papéis](03-profissionais-e-papeis.md)

---

## Visão Geral

Duas peças que todo módulo usa:
1. **Aviso para a equipe por permissão.** Um evento do estabelecimento (pedido de horário novo, pré-consulta respondida, vínculo aceito, adesão em queda, reserva pedida) vira notificação para os membros que têm a permissão daquele trabalho, na inbox que já existe, filtrável por parceiro, e por e-mail quando o tipo pedir.
2. **Contadores de pendência.** Uma rota que devolve, por módulo, os números que o menu e o Início do portal mostram ("3 pedidos", "2 doses atrasadas", "1 boletim retido"), calculados no servidor.

## Motivação

- O motor de notificações só endereça `Usuario` (inventário 1.10): não há fan-out para "o parceiro". A clínica precisa saber que chegou pedido sem ficar com a tela aberta.
- O portal calcula os selos do menu no cliente (`useClinicoPendencias`, doc 08 do portal) e o Início da `redesign/portal` mostra "números do agora" por espaço (`components/home/espaco-da-home.ts`, `HomeEspacoClinica.vue`, `HomeEspacoHotel.vue`). Na API, cada número tem de vir de uma regra do servidor.

---

## Research Findings

- `NotificacaoEmissorService.emitir(usuarioIds, tipo, dados, adiarPushPara?)` (`src/notificacao/services/notificacao-emissor.service.ts:37`); tipo novo exige enum, `CATEGORIA_POR_TIPO`, `EMAIL_POR_TIPO`, `ROTA_POR_TIPO`, catálogo nos 6 locales e passa no `audit:notificacao-rotas` (inventário 3.3).
- `GET /notificacao` lista a inbox do usuário (`notificacao.controller.ts:45`), sem filtro por parceiro.
- Categoria `PARCEIRO` já existe em `CategoriaNotificacao`; e-mail hoje só para os 5 tipos do funil do parceiro (`canal-email.service.ts:30-63`).
- O portal é web: push do Expo não chega. Inbox + e-mail + contadores com polling resolvem a v1.
- `CacheService` em memória (`src/common/services/cache.service.ts`).

**Breaking changes:** nenhuma. O filtro `?parceiroId=` no `GET /notificacao` é opcional.

## Decisões

- **D1 Fan-out por permissão.** `AvisoDaEquipeService.avisar(parceiroId, permissao, tipo, dados)` resolve os membros ativos com aquela permissão (matriz da E1-03) e chama `emitir`. `dados` sempre leva `parceiroId`, para o filtro da inbox.
- **D2 Cada módulo registra os seus contadores.** Interface `ContadorDePendencia { chave, modulo, permissao, contar(parceiroId, agora) }` registrada por cada spec de domínio (a agenda registra `pedidos`, a internação registra `boletinsRetidos` etc.). Esta spec entrega o registro, a rota e os contadores que já existem (convites de equipe pendentes, acessos temporários ativos).
- **D3 Cada número em um lugar só e zero não é selo.** Regra do doc 08 do portal: o contador conta só o que alguém precisa fazer; a rota devolve todos, e o front omite os zerados.
- **D4 Cache de 30 s por parceiro e usuário**, invalidado pelos eventos que mudam o número (mesmo evento do aviso).

### Decisões da implementação (v0.2)

- **D5 `contar` recebe `{ parceiroId, usuarioId, agora }`**, e não `(parceiroId, agora)`: contador por pessoa ("meus rascunhos", E4-01) precisa de quem pede, e o cache já é por usuário (D4).
- **D6 `permissao: Permissao | null`.** `null` = qualquer membro ativo, só para o que todo membro já abre hoje. Usado por `acessosTemporariosAtivos`: a lista da Parte 8 (`/parceiro/portal/compartilhamentos`) abre para qualquer membro, inclusive o OPERADOR sem papel operacional, que não tem permissão de módulo nenhuma.
- **D7 Ato de veterinário segue o guard.** Contador e aviso de permissão que `exigeCrmv` só chegam a quem tem `Profissional` ativo com CRMV, número e UF (inclusive o DONO), pela mesma `crmvEmDia` do `PermissaoParceiroGuard`. A ficha só é lida quando algum contador visível precisa.
- **D8 `?modulo=` opcional.** Ausente devolve todos (o menu inteiro numa chamada); cada item traz `modulo`; aceita minúsculas. Ordem: CLINICA, HOTEL, PORTAL e, dentro do módulo, a ordem de registro.
- **D9 Idempotência sem schema.** `avisar(..., { chaveEvento })` grava `dados.chaveEvento`; quem já tem notificação do mesmo tipo, parceiro e chave não recebe de novo. Dois disparos simultâneos são serializados por `pg_advisory_xact_lock(hashtext('aviso-equipe:<parceiro>:<tipo>:<chave>'))`. A trava, a conferência e a gravação correm na MESMA conexão (`NotificacaoEmissorService.emitirUmaVez`, que lê as preferências antes da transação e despacha depois do commit): a primeira versão travava numa transação e gravava pelo pool, segurando duas conexões por evento, e eventos simultâneos em número igual ao pool travavam a réplica e perdiam os avisos (achado do `security-auditor`; regressão coberta com pool de 2 conexões e 3 eventos). Limite declarado: a retenção do inbox (e o "limpar" do usuário) apaga o marcador junto; a chave é do evento, que não se repete meses depois. Sem `chaveEvento`, cada chamada é um evento.
- **D10 Contrato do `avisar`.** Best-effort como o emissor (nunca lança, chamar depois do commit). `dados.parceiroId` é sempre o do parceiro avisado (sobrescreve o que vier); `parceiroNome` vem do cadastro se o produtor não mandar. `excetoUsuarioIds` tira quem causou o evento; `adiarPushPara` repassa ao emissor. Todo `avisar` invalida o cache do parceiro, mesmo sem destinatário.
- **D11 Inbox por parceiro.** O recorte é `dados.parceiroId` e o `usuarioId` do JWT continua no where: sem conferência de membership (id alheio devolve lista vazia; ex-membro continua vendo o que recebeu). `naoLidas` continua o total do inbox (é o badge do app, definição única); com o filtro vem também `naoLidasDoParceiro`. `PATCH /notificacao/read-all` continua global.
- **D12 Contador que falha.** Exceção (síncrona ou não), demora acima de 1,5 s ou número inválido (negativo, fracionado, NaN) viram `valor: null` com log `CONTADOR_FALHOU`; os outros seguem. O nulo também fica no cache pelos 30 s, para o contador quebrado não rodar a cada polling. O contador pode devolver `{ valor, tom }` quando a gravidade depende do que achou.
- **D13 Cache.** `CacheService` comum, chave `pendencias:<parceiroId>:<usuarioId>:<chave>` (só o número; membership, permissão, CRMV e módulo são conferidos a cada requisição). Invalidação por parceiro em todo `avisar` e em toda mudança de convite ou de equipe (`ParceiroEquipeService`). Cada réplica tem o seu cache: em outra réplica o número velho vive no máximo 30 s. Vínculo e revogação de acesso temporário (`compartilhamento-prestador`) não invalidam nesta entrega: o contador acompanha pelo TTL.
- **D14 Aviso do convite (`PARCEIRO_CONVITE_EQUIPE`).** Vai para a conta que já existe com o e-mail convidado (igualdade exata do e-mail normalizado, como `assertNaoEhMembro`), disparado sem await para a resposta do convite não mudar de forma nem de tempo conforme a conta exista. Snapshot `{ parceiroId, parceiroNome, conviteId, papel, expiraEm }`: sem token, sem link de aceite e sem o nome de quem convidou. A COPY é fixa e não lê texto de usuário nenhum, nem o nome do negócio: o DONO troca o `nome` do parceiro depois de aprovado sem nova auditoria (`atualizarCadastro`) e escolhe para quem o push vai, então "PetJourney: conta bloqueada, acesse x.com" viraria push de phishing com o nosso remetente (achado do `security-auditor`). Quem convida, a pessoa lê no e-mail, junto do link. Categoria PARCEIRO, canal Android CONTA, `EMAIL_POR_TIPO` false (o e-mail com o link já sai pela E0-01), rota do app `/screens/notifications`. O reenvio (link novo) também avisa.
- **D15 Contadores desta spec.** `convitesPendentes` (PORTAL, `equipe.gerir`, NEUTRO, `/parceiro/equipe`): convite por e-mail PENDENTE com `expiraEm` no futuro mais convite antigo (`ParceiroEquipe` PENDENTE e ativa), o mesmo que a tela da equipe lista. `acessosTemporariosAtivos` (PORTAL, `null`, NEUTRO, `/parceiro/acessos`): `CompartilhamentoPrestador` ATIVO do parceiro com `expiraEm` no futuro. As rotas são as do portal na `redesign/portal`.
- **D16 Registro.** `RegistroDeContadores` é exportado pelo `ParceiroPortalModule` (que o `PermissoesModule` @Global reexporta); o módulo de domínio registra no próprio `onModuleInit`. Chave camelCase única, módulo, permissão da matriz, tom e rota validados no registro: contador mal formado derruba o boot, nunca vira selo errado.
- **D17 Para quem for usar o `avisar` (módulos de domínio).** O serviço grava o que recebe em `dados` (`...dados`), e o inbox devolve esse snapshot cru por até 180 dias, inclusive a ex-membro (D11). Cada tipo novo declara a sua interface `Dados*` no catálogo, sem PII do cliente final (nome do responsável, telefone, e-mail): só ids e o que a copy precisa. E o prazo de 1,5 s do contador não cancela a consulta, que segue ocupando conexão até o `statement_timeout` (15 s): contador novo precisa de índice que o deixe abaixo de 100 ms.

## Rotas

| Método e rota | Quem | Descrição |
|---|---|---|
| `GET /notificacao?parceiroId=` | usuário | Filtro novo: só as notificações com `dados.parceiroId` igual. Com o filtro, a resposta soma `naoLidasDoParceiro` (D11) |
| `GET /parceiro/portal/pendencias?modulo=CLINICA\|HOTEL\|PORTAL&parceiroId=` | membro | `[{ chave, modulo, valor: number \| null, tom: 'NEUTRO'\|'ATENCAO'\|'RISCO', rota }]`, só dos contadores cuja permissão o usuário tem, do módulo com leitura (PORTAL sempre). `modulo` opcional (D8) |

Tipos de notificação desta spec (os de domínio nascem em cada spec): `PARCEIRO_CONVITE_EQUIPE` (para o convidado, da E0-01) e `PARCEIRO_AVISO_GENERICO` não existe de propósito (todo aviso tem tipo próprio, para preferência e rota funcionarem).

## Acceptance Criteria

- [x] **Given** um evento com permissão `agenda.escrever` **When** `avisar` roda **Then** só os membros ativos com essa permissão recebem, e ex-membros não. (`aviso-da-equipe.service.spec.ts`; contra o Postgres em `avisos.integration.spec.ts`: ex-membro, convite pendente, enfermagem, operador sem papel e parceiro excluído não recebem)
- [x] **Given** dois parceiros do mesmo usuário **When** `GET /notificacao?parceiroId=A` **Then** só aparecem as de A. (`notificacao-inbox.service.spec.ts` e `avisos.integration.spec.ts`)
- [x] **Given** RECEPCAO **When** `GET /pendencias?modulo=CLINICA` **Then** não aparece contador de prontuário (`prontuario.ler`). (`pendencias.service.spec.ts` e `avisos.integration.spec.ts`, com o módulo ligado no banco)
- [x] Cada contador novo registrado vem com teste do número e da permissão (molde no registro). (Molde em `contadores-do-portal.spec.ts`; `contadorVisivelPara` é a função que a rota usa)
- [x] p95 de `GET /pendencias` abaixo de 200 ms com 10 contadores, medido no `route-metrics`. *Gate G1, `scripts/smoke-pendencias-parceiro.ts` com a API de dev: 40 chamadas, p50 133 ms, p95 149 ms.* (Medição indicativa no serviço, 10 contadores com consulta real e sem cache, daqui ao Supabase de dev: p50 93 ms, p95 107 ms. O `route-metrics` é lido pelo `scripts/smoke-pendencias-parceiro.ts` no gate G1, com a API de pé)

## Estratégia de Testes

- Unit: fan-out (permissão, membro inativo, parceiro excluído), filtro da inbox, registro de contadores, cache e invalidação.
- Integração (Postgres de dev, `avisos.integration.spec.ts`): fan-out com membros e permissões vindos do banco, idempotência com dois disparos simultâneos (trava real), filtro JSON da inbox, contadores com o módulo ligado no banco, aviso do convite na inbox da conta convidada.
- Smoke HTTP (`npx tsx scripts/smoke-pendencias-parceiro.ts`, API de pé, banco de dev): pendências por papel, 400 de módulo inválido, 403 de BOLA, invalidação pelo convite, aviso do convite sem token, inbox por parceiro e o p95 no `/__metrics`.

## Arquivos Impactados

| Arquivo | Ação |
|---|---|
| `src/parceiro-portal/avisos/` (`aviso-da-equipe.service.ts`, `contador-de-pendencia.ts`, `registro-de-contadores.ts`, `cache-de-pendencias.ts`, `contadores-do-portal.ts`, `pendencias.service.ts`, `pendencias.controller.ts`, `dto/pendencias.dto.ts` e specs) | Criar |
| `src/parceiro-portal/parceiro-portal.module.ts` | Modificar (providers, controller, exports) |
| `src/parceiro-portal/parceiro-equipe.service.ts` + specs | Modificar (aviso ao convidado, invalidação do contador) |
| `src/notificacao/notificacao.controller.ts`, `dto/query-notificacao.dto.ts`, `services/notificacao-inbox.service.ts` | Modificar (filtro) |
| `src/notificacao/services/notificacao-emissor.service.ts` | Modificar (`emitirUmaVez`: trava, conferência e gravação numa conexão; `emitir` sem mudança de comportamento) |
| `src/notificacao/catalogo/notificacao-catalogo.ts`, `canais/canais-android.ts`, `canais/canal-email.service.ts`, `services/notificacao-preferencia.service.ts`, `scripts/smoke-push-device.ts` | Modificar (1 tipo novo) |
| `scripts/smoke-pendencias-parceiro.ts` | Criar |

## Tasks

- [x] **T1** Fan-out por permissão
- [x] **T2** Filtro da inbox
- [x] **T3** Registro de contadores + rota + cache
- [x] **T4** Tipo `PARCEIRO_CONVITE_EQUIPE` nos 6 locales
- [x] **T5** Testes e handoff (selos do menu e Início pelo servidor)

## Riscos e Mitigações

| Nível | Risco | Mitigação |
|---|---|---|
| Médio | Fan-out para equipe grande gerar avalanche de notificação | Um aviso por evento por usuário, com marcador de idempotência; tipos de alto volume (pedido novo) entram no digest do motor atual |
| Baixo | Contador lento derrubar o menu | Cache de 30 s e p95 medido no AC; contador que falha devolve `null` em vez de derrubar a rota |

## Rollout / Rollback

Aditivo e atrás do módulo (E1-02): nada aparece para parceiro sem o módulo ligado. A única migration é o valor `PARCEIRO_CONVITE_EQUIPE` no enum `TipoNotificacao` (`20261021101000_notificacao_convite_equipe`); o resto é código. Ordem de deploy: a migration antes da API (a réplica antiga que ler uma notificação do tipo novo cai na copy genérica, AC17 do motor). Rollback é reverter o código; o valor do enum fica sem produtor.

## Change Log

| Data | Versão | Mudança | Autor |
|---|---|---|---|
| 2026-10-20 | 0.1 | Criação | Nicolas (via Claude) |
| 2026-10-21 | 0.2 | Implementada (T1 a T5), sem schema novo além do enum que já existia. Decisões D5 a D17: `contar` com usuário, permissão `null`, CRMV como no guard, `?modulo=` opcional, idempotência por `dados.chaveEvento` com trava e gravação na mesma conexão, `naoLidasDoParceiro`, contador que falha vira `null` (também em cache), aviso do convite com copy fixa. A revisão do `security-auditor` mudou: gravação idempotente numa conexão só (a versão anterior esgotava o pool), copy do convite sem o nome do negócio (phishing por nome trocado depois da aprovação) e `definirPapeis` invalidando o contador. AC5 (p95 no `route-metrics`) fica para o gate G1 | Claude |
| 2026-10-21 | 0.3 | Gate G1: AC5 medido pelo smoke contra a API de dev (40 chamadas, `route-metrics` p50 133 ms, p95 149 ms); concluída do lado da API | Claude |
