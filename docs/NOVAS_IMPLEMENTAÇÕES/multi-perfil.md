# App + Portal — Multi-perfil: troca de conta, cadastro logado e token fresco

> **Superfícies:** app do tutor (Expo/React Native) **e** portal do parceiro (web). **Status backend:** LIVE em
> `develop` (suíte tocada 176/176 + smoke real 13/13 em dev). **Novo em 2026-07-16.** Tudo aditivo, zero
> breaking: app antigo segue funcionando sem tocar nas rotas novas.
> Envelope de sucesso: corpo útil em `response.data.data`. Envelope de erro: `{ statusCode, timestamp, path, message }`.
> Spec backend: [auth-multi-perfil-troca.md](../specs/auth-multi-perfil-troca.md).

## 1. O que mudou, em 1 minuto (leia isto primeiro)

O multi-perfil do produto tem **exatamente dois perfis: TUTOR e PARCEIRO.** Uma conta (login/senha) pode ter o
perfil de tutor e memberships de parceiro. **Veterinário NÃO é um perfil:** vet no PetJourney É um Parceiro
(categoria `CLINICA_VETERINARIA` + `crmv` no cadastro; Decisão D6 do épico). O que aparece como "veterinario"
em payloads de auth é um espelho de legado dormente que a UI **ignora sempre** (ver 2.1). Agora o front tem o
que faltava pro **botão de troca de conta**:

1. `GET /auth/perfis` lista os perfis da conta logada (fonte do botão).
2. `POST /auth/trocar-perfil` emite um token novo com o perfil ativo escolhido.
3. Cadastrar um perfil **enquanto logado** (`POST /tutor`, `POST /parceiro/portal/cadastro`) devolve
   `access_token` novo no próprio response: troque o token guardado na hora, **sem relogin e sem refresh**.
4. Com o claim `parceiroAtivoId` no token, as rotas de `/parceiro/portal/*` funcionam **sem `?parceiroId`**.

**Conceito central:** "perfil ativo" é **contexto de cliente**, não autorização. O backend continua derivando
papel e posse do banco a cada request. Os claims novos (`perfilAtivo`, `parceiroAtivoId`) são informativos:
servem pra UI saber o que renderizar e pro portal resolver o parceiro default. Trocar de perfil **não** liga nem
desliga permissão nenhuma no servidor.

## 2. Contratos — o que o backend expõe

### 2.1 `GET /auth/perfis` (novo; Bearer)

```jsonc
// 200 (corpo útil em response.data.data)
{
  "usuarioId": "u1",
  "tutor": { "id": "t1", "ativo": true }, // null se a conta não tem perfil tutor
  "veterinario": null, // LEGADO MORTO: ignore SEMPRE, nunca renderize (ver nota abaixo)
  "parceiros": [
    // só memberships ACEITO && ativas
    { "parceiroId": "p1", "nome": "Clinica X", "papel": "DONO", "status": "APROVADO" },
  ],
}
```

- **`veterinario`: ignore sempre.** É o espelho de um perfil 1-1 antigo (`model Veterinario`, stub dormente) que
  pouquíssimas contas legadas têm. O vet do produto se cadastra como **Parceiro** (categoria
  `CLINICA_VETERINARIA` + `crmv`) e aparece em `parceiros[]`. Não renderize o campo, não crie item de seletor,
  não construa fluxo nenhum sobre ele.
- **Semântica de `parceiros[]`** (por que é lista): 1 item por **membership**, não por "tipo de negócio".
  - `papel: "DONO"` = o negócio é seu. Via auto-cadastro só existe **1 negócio próprio por vez** (o backend
    devolve 409 ao tentar criar outro enquanto há um `PENDENTE`/`APROVADO`).
  - `papel: "OPERADOR"` = você foi convidado pra equipe do parceiro de outra pessoa.
  - Logo, N>1 itens = seu negócio + equipes em que você opera (ou multi-negócio criado por admin, caso raro).
- `parceiros[].status` = status de **auditoria do parceiro**: `"PENDENTE" | "APROVADO" | "REJEITADO" | "SUSPENSO"`.
  Só `APROVADO` opera o portal por completo; os demais caem na tela de status do portal
  ([03-web-portal-parceiro.md](03-web-portal-parceiro.md)).
- `tutor.ativo: false` = perfil tutor desativado (conta em inativação); mostre badge, não esconda.

### 2.2 `POST /auth/trocar-perfil` (novo; Bearer)

Body:

```jsonc
{ "perfil": "TUTOR" | "PARCEIRO", "parceiroId": "p1" }
```

O enum do backend também aceita `"VETERINARIO"` (espelho de legado): **o front NUNCA envia esse valor.** Os
únicos perfis do produto são `TUTOR` e `PARCEIRO`.

`parceiroId` só é obrigatório quando `perfil = "PARCEIRO"` **e** a conta tem mais de um parceiro (com um só,
auto-resolve). Regra prática: se `GET /auth/perfis` listou 2+ parceiros, **sempre mande** o `parceiroId` do
item tocado.

**200** → `{ "access_token": "eyJ...", "refresh_token": "abc..." }` (mesmo shape do login). O refresh antigo do
device **continua válido** (o novo par soma, não substitui no servidor); no client, guarde o par novo.

| Status | Quando                                                                       | Observação                                                                                             |
| ------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 400    | `perfil = PARCEIRO` sem `parceiroId` com N>1 memberships                     | `message`: `parceiroId obrigatorio quando ha mais de um parceiro` (fixa pt-BR; use copy própria na UI) |
| 400    | `perfil` fora do enum                                                        | erro de validação padrão do ValidationPipe                                                             |
| 403    | perfil que a conta não tem / `parceiroId` que não é seu / membership inativa | `message` localizada: `Este perfil nao esta disponivel para a sua conta.`                              |

### 2.3 Payload do JWT (decodifique com `jwt-decode`, padrão já usado no app)

```jsonc
{
  "userId": "u1",
  "email": "...",
  "nome": "...",
  "tutorId": "t1", // null se não tem perfil tutor
  "veterinarioId": null, // legado morto: ignore, não construa nada sobre ele
  "perfilAtivo": "PARCEIRO", // OPCIONAL: ausente em token de login normal e em tokens antigos
  "parceiroAtivoId": "p1", // OPCIONAL: só quando perfilAtivo = PARCEIRO
}
```

- **Claim ausente = comportamento de sempre.** Login normal emite token **sem** `perfilAtivo`; no app do tutor,
  trate ausência como contexto TUTOR.
- Tokens antigos (emitidos antes desta feature) seguem 100% válidos em todas as rotas.
- O `refresh_token` é **opaco** (string aleatória): nunca tente decodificar.
- TTL: access = `JWT_ACCESS_TTL` do ambiente (hoje 30d); refresh = 30d, rotativo.

### 2.4 `POST /auth/refresh` (alterado, aditivo; público)

Body: `{ "refresh_token": "...", "perfil"?: "TUTOR"|"PARCEIRO", "parceiroId"?: "p1" }` (mesma regra do
trocar-perfil: o backend aceita `"VETERINARIO"` por legado, o front nunca envia).

- Sem os opcionais → comportamento de sempre (token novo **sem** claim de perfil).
- Com `perfil` (+ `parceiroId` se preciso) → o token renovado **preserva o perfil ativo**.
- **200** → `{ access_token, refresh_token }` (rotação: o refresh usado é invalidado; guarde o novo par).
- **401** → refresh inválido/expirado/revogado: sessão morreu, mande pro login.
- **403 / 400** → o perfil pedido é inválido (perdeu a membership, etc). **O refresh NÃO foi consumido:**
  repita a chamada **sem** `perfil` pra renovar a sessão, limpe o perfil ativo persistido e caia no contexto
  default (TUTOR no app).

### 2.5 Cadastro logado devolve token novo (aditivo)

| Rota                                      | Response (aditivo)                                          | Claims do token novo                                          |
| ----------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| `POST /tutor` (Bearer)                    | `{ ...tutor, pets: [], access_token }`                      | `tutorId` preenchido; sem `perfilAtivo`                       |
| `POST /parceiro/portal/cadastro` (Bearer) | `{ parceiroId, statusAuditoria: "PENDENTE", access_token }` | `perfilAtivo: "PARCEIRO"` + `parceiroAtivoId` do recém-criado |

**Troque o `access_token` guardado imediatamente** ao receber esses responses. O refresh do device não muda
(continua o mesmo, válido). Os 409 do cadastro de parceiro (já existe pendente/aprovado; conta suspensa) seguem
o contrato da Parte 9 (doc [03-web-portal-parceiro.md](03-web-portal-parceiro.md)).

### 2.6 Portal do parceiro sem `?parceiroId`

Ordem de resolução nas rotas `/parceiro/portal/*` (cadastro GET/PATCH, dashboard, status, indicação e métricas,
cupons etc):

```
?parceiroId na query (override explícito, sempre vence)
  → claim parceiroAtivoId do token (REVALIDADO no banco a cada request)
    → auto-resolve se a conta tem 1 parceiro só
      → 400 se tem N>1 (sem query e sem claim)
```

- Membership desativada depois da troca? O claim é **ignorado** pelo backend e a resolução cai na regra
  seguinte. Nunca opera num parceiro inválido.
- ⚠️ **Exceções (follow-up do backend):** as telas de **carteira** (`/parceiro/portal/carteira*`) e de
  **compartilhamento com prestador** ainda NÃO leem o claim. Com N>1 parceiros, **continue mandando
  `?parceiroId` explícito nessas telas**, senão 400. Nas demais, pode omitir.
- Mandar `?parceiroId` explícito em tudo continua funcionando (é o override): se o portal já faz isso hoje,
  nada quebra; a migração pra confiar no claim é opcional e pode ser gradual.

## 3. Telas e fluxos — passo a passo

### Tela A — Seletor de conta ("Trocar de conta" no menu/perfil; app e portal)

1. **Entrada:** item "Trocar de conta" no menu de perfil/configurações. Badge com o perfil atual.
2. **Ao abrir:** `GET /auth/perfis`. Render (só TUTOR e PARCEIRO; o campo `veterinario` do payload é ignorado):
   - **Tutor** (se `tutor != null`): "Minha conta de tutor"; badge `Desativada` se `ativo: false`.
   - **Um item por parceiro** (`parceiros[]`): nome do parceiro + papel (`DONO` = seu negócio; `OPERADOR` =
     "Equipe · {nome}") + badge pelo `status`
     (`PENDENTE` = "Em análise", `REJEITADO` = "Rejeitado", `SUSPENSO` = "Suspenso"; sem badge se `APROVADO`).
   - **CTAs de criação** quando o perfil não existe: "Criar perfil de tutor" (Tela C) e
     "Cadastrar meu negócio" (Tela B; só quando NÃO há membership `DONO` com status `PENDENTE`/`APROVADO`,
     senão o backend responde 409).
3. **Perfil atual:** decodifique o `access_token` (`jwt-decode`): `perfilAtivo` (+ `parceiroAtivoId` pra saber
   QUAL parceiro). Claim ausente = TUTOR. Marque o item ativo (check) e não dispare troca ao tocá-lo.
4. **Tocar em outro perfil:** `POST /auth/trocar-perfil { perfil, parceiroId? }` (mande `parceiroId` sempre que
   houver 2+ parceiros). No **200**:
   a) substitua o **par** access+refresh no storage seguro;
   b) persista o perfil ativo escolhido (ex.: `{ perfil, parceiroId }`) pra usar no refresh (Fluxo D);
   c) **limpe/invalide os caches de dados** da sessão (query cache, stores) — o contexto mudou;
   d) navegue pra home do perfil (home do tutor, ou dashboard do portal).
5. **403** na troca: a lista estava stale (perfil removido em outro device). Toast neutro ("Este perfil não está
   mais disponível nesta conta.") + refetch de `GET /auth/perfis`.
6. Parceiro `PENDENTE`/`REJEITADO`/`SUSPENSO`: a troca **funciona** (posse é membership, não status); o destino
   é a tela de status do portal, que já explica a situação (doc 03).

### Tela B — Cadastrar parceiro estando logado (tutor vira parceiro)

1. Form de auto-cadastro (campos conforme doc 03 / Parte 9).
2. `POST /parceiro/portal/cadastro` → **201** `{ parceiroId, statusAuditoria: "PENDENTE", access_token }`.
3. **Na hora:** substitua o `access_token` guardado (o refresh não muda). O token novo já vem com
   `perfilAtivo: "PARCEIRO"` e `parceiroAtivoId`; as chamadas do portal já funcionam **sem** `?parceiroId`.
4. Persista o perfil ativo (`{ perfil: "PARCEIRO", parceiroId }`) e navegue pra tela "cadastro em análise".
5. Não crie fluxo de "aguardar aprovação pra entrar": o portal em estado `PENDENTE` mostra o status e libera o
   que for permitido (doc 03 manda).

### Tela C — Criar perfil de tutor estando logado (parceiro vira tutor)

1. `POST /tutor` (Bearer; body com os dados do perfil) → response `{ ...tutor, access_token }`.
2. Substitua o `access_token` na hora: o payload novo traz o `tutorId` (o token velho tinha `tutorId: null` e o
   app não enxergava o perfil sem relogar; era o bug).
3. Persista `{ perfil: "TUTOR" }` se a intenção é já entrar como tutor, e navegue pro onboarding de pets.

### Fluxo D — Boot, refresh e biometria (o que muda na sessão)

1. **Nada muda na biometria:** o refresh de 30d no SecureStore que o FaceID destrava continua válido. Troca de
   perfil e cadastro logado **nunca** revogam refresh existente; só a rotação normal do próprio refresh o
   substitui.
2. **Ao renovar a sessão** (boot/401): mande o perfil ativo persistido junto:
   `POST /auth/refresh { refresh_token, perfil, parceiroId }` → o token renovado mantém o claim.
3. **Recuperação:** se o refresh responder 400/403 (perfil ficou inválido), o refresh **não foi consumido**:
   repita **sem** `perfil`, limpe o perfil persistido e caia no contexto TUTOR. Se responder **401**, sessão
   expirou: login de novo.
4. **Fonte de verdade do contexto na UI:** o claim do access_token atual (decodificado), com o valor persistido
   como fallback pro corpo do refresh. Não confie em estado solto de tela.

## 4. Tabela de estados — o que renderizar quando

| Situação (campo que te diz)                                  | O que a UI faz                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Token sem `perfilAtivo` (login normal, token antigo)         | Contexto TUTOR no app; portal resolve por auto/`?parceiroId`                                                                         |
| `perfis.veterinario != null` (conta legada rara)             | **Ignorar.** Nenhum item no seletor, nenhum fluxo; vet do produto está em `parceiros[]`                                              |
| `perfis.tutor == null`                                       | Seletor mostra "Criar perfil de tutor" (Tela C); app sem home de tutor até criar                                                     |
| `perfis.parceiros = []`                                      | Seletor mostra "Cadastrar meu negócio" (Tela B)                                                                                      |
| Já existe membership `DONO` com status `PENDENTE`/`APROVADO` | Esconder o CTA "Cadastrar meu negócio" (o backend nega com 409); só 1 negócio próprio por vez                                        |
| 2+ parceiros                                                 | Cada um é um item; toda troca manda `parceiroId`; telas de carteira/prestador do portal mandam `?parceiroId` explícito (exceção 2.6) |
| `parceiros[].status != "APROVADO"`                           | Troca permitida; destino é a tela de status do portal (badge no seletor)                                                             |
| `tutor.ativo: false`                                         | Badge "Desativada" no seletor; fluxo de reativação de conta é outro doc                                                              |
| 403 em `trocar-perfil`                                       | Lista stale: toast + refetch `GET /auth/perfis`                                                                                      |
| 400/403 no `refresh` com `perfil`                            | Refresh NÃO consumido: repetir sem `perfil`, limpar contexto persistido                                                              |
| 401 no `refresh`                                             | Sessão morta: login (biometria pede credenciais de novo)                                                                             |
| Rota de tutor chamada com token `perfilAtivo: "PARCEIRO"`    | **Funciona** (claim não retira papel). É a UI que decide não mostrar; não trate como erro                                            |

## 5. Pegadinhas

- **Só existem dois perfis no produto: TUTOR e PARCEIRO.** Tudo que se chama "veterinario" em payloads de auth
  (`perfis.veterinario`, `veterinarioId` do JWT, `perfil: VETERINARIO` do enum) é espelho de legado dormente:
  a UI ignora, nunca renderiza e nunca envia. Vet de verdade = Parceiro com categoria `CLINICA_VETERINARIA`.
- **Claims não autorizam nada.** Não construa lógica de permissão em cima de `perfilAtivo` (nem esconda dados
  por ele). Ele só diz qual "chapéu" a UI veste. Posse/papel continuam validados pelo backend por recurso.
- **Sempre substitua o PAR de tokens** quando o response trouxer `refresh_token` (login, troca, refresh). Nos
  cadastros logados vem **só** `access_token`: troque só ele e mantenha o refresh atual.
- **Nunca decodifique o refresh_token** (é opaco, não é JWT).
- A `message` de erro vem localizada (`?lang=`/`Accept-Language`, fallback pt-BR): pode exibir, **nunca** usar
  em `if`. Decida por `statusCode` + contexto da chamada (as tabelas acima cobrem todos os casos).
- O 400 de "parceiroId obrigatorio" é evitável a 100%: se a lista de perfis tem 2+ parceiros, mande o id. Se o
  claim ficou stale (membership desativada) o backend também cai nesse 400 em rotas do portal; o tratamento é
  refazer a troca de perfil (Tela A) ou mandar `?parceiroId` explícito.
- **Depois de trocar de perfil, invalide os caches de dados.** Pull de dados do perfil anterior vazando na tela
  do novo perfil é o bug mais provável desse fluxo.
- Copy visível: **proibido em-dash** em qualquer string nova (regra global do produto).

## 6. Como testar (roteiro manual, 1 conta em dev)

1. **Signup/login tutor** → decodifique o token: `tutorId` preenchido, **sem** `perfilAtivo`. ✅
2. `GET /auth/perfis` → `tutor` preenchido, `parceiros: []` (o campo `veterinario` existe no payload e a UI o
   ignora); seletor mostra só o tutor + CTA de cadastrar negócio. ✅
3. **Cadastro de parceiro logado** (Tela B) → 201 com `access_token`; decodifique: `perfilAtivo: "PARCEIRO"`,
   `parceiroAtivoId` novo. `GET /parceiro/portal/status` **sem** `?parceiroId` → 200 do parceiro certo. ✅
4. **Trocar de volta pra TUTOR** → 200; token novo com `perfilAtivo: "TUTOR"`; home do tutor normal. ✅
5. **Refresh preservando perfil:** `POST /auth/refresh { refresh_token, perfil: "PARCEIRO", parceiroId }` →
   token com claims; sem os opcionais → token sem claims. ✅
6. **Refresh antigo continua válido:** guarde o refresh de antes da troca; use-o em `POST /auth/refresh` → 200
   (a troca não revogou; biometria de outro device seguiria logando). ✅
7. **BOLA:** `POST /auth/trocar-perfil` com `parceiroId` de outra conta → 403 com a copy do catálogo. (Só via
   API: o backend também nega `perfil: VETERINARIO` com 403 pra quem não tem o legado; o front nunca envia
   esse valor.) ✅
8. Automatizado de referência do backend: `npx tsx scripts/smoke-multi-perfil.ts` (13/13).

## 7. Checklist (app e portal)

- [ ] Seletor de conta (Tela A): `GET /auth/perfis`, perfil atual pelo claim, badges de status, CTAs de criação.
- [ ] Nenhuma menção a "veterinário" na UI: campo `veterinario`/`veterinarioId` ignorados; `VETERINARIO` nunca
      enviado em `trocar-perfil`/`refresh`.
- [ ] `POST /auth/trocar-perfil` com swap do par de tokens + persistência do perfil + reset de caches + navegação.
- [ ] 403 da troca tratado com refetch da lista (nunca crash).
- [ ] Cadastro de parceiro logado consome o `access_token` do response na hora (sem relogin/refresh).
- [ ] `POST /tutor` logado idem (o `tutorId` aparece sem relogar).
- [ ] Refresh manda `perfil`/`parceiroId` persistidos; recuperação 400/403 (retry sem perfil) e 401 (login).
- [ ] Portal: `?parceiroId` omitido nas rotas cobertas pelo claim; mantido nas telas de carteira e
      compartilhamento-prestador (exceção 2.6) e como override na troca rápida entre parceiros.
- [ ] Nenhuma lógica de permissão baseada em `perfilAtivo`; nenhuma decisão por `message`; sem em-dash em copy.

## 8. Prompt pronto pra IA (copie daqui pra baixo no agente do repo do app/portal)

```text
Implemente a troca de conta multi-perfil. O backend JÁ está pronto e é aditivo (nada do fluxo
atual quebra). Envelope axios: corpo útil em response.data.data. Erros chegam como
{ statusCode, timestamp, path, message } SEM código de máquina; a message é localizada e NUNCA
pode ser usada em if/switch (decida por statusCode + contexto da chamada).

CONCEITO
O produto tem EXATAMENTE dois perfis: TUTOR e PARCEIRO. Veterinário NÃO é um perfil: vet no
PetJourney é um Parceiro (categoria CLINICA_VETERINARIA). Campos "veterinario"/"veterinarioId"
e o valor de enum "VETERINARIO" que aparecem nos payloads de auth são espelho de um legado
dormente: IGNORE-os por completo (não renderize, não envie, não construa nada sobre eles).
"Perfil ativo" é contexto de CLIENTE: claims informativos no JWT (perfilAtivo, parceiroAtivoId)
que dizem qual chapéu a UI veste. Eles NÃO concedem nem retiram permissão; o backend valida
posse por recurso em toda request. Não construa lógica de permissão sobre esses claims.

CONTRATOS
- GET /auth/perfis (Bearer) → { usuarioId, tutor: {id, ativo}|null, veterinario (IGNORAR),
  parceiros: [{ parceiroId, nome, papel: 'DONO'|'OPERADOR',
  status: 'PENDENTE'|'APROVADO'|'REJEITADO'|'SUSPENSO' }] }.
  parceiros[] tem 1 item por membership: DONO = negócio próprio (só 1 por vez em
  PENDENTE/APROVADO; o backend nega um 2º cadastro com 409), OPERADOR = equipe de outro
  parceiro em que o usuário opera.
- POST /auth/trocar-perfil (Bearer) body { perfil: 'TUTOR'|'PARCEIRO',
  parceiroId?: string } → 200 { access_token, refresh_token }. NUNCA envie 'VETERINARIO'
  (o backend aceita por legado; o front não usa). Mande parceiroId SEMPRE que a
  conta tiver 2+ parceiros. 400 = parceiroId faltando com N>1; 403 = perfil que a conta não
  tem (lista stale: refetch de /auth/perfis). O refresh antigo do device continua válido.
- JWT payload (jwt-decode no access_token): { userId, email, nome, tutorId,
  veterinarioId (legado, ignore), perfilAtivo?, parceiroAtivoId? }. Claim ausente = contexto
  TUTOR (login normal e tokens antigos não têm o claim). refresh_token é opaco: nunca decodificar.
- POST /auth/refresh body { refresh_token, perfil?, parceiroId? } → 200 { access_token,
  refresh_token } (rotação: substitua o par). Com perfil, o token renovado preserva o claim.
  401 = sessão morta (login). 400/403 = perfil inválido e o refresh NÃO foi consumido: repita
  a chamada sem perfil, limpe o perfil persistido e caia no contexto TUTOR.
- Cadastro logado devolve token fresco (troque o access_token guardado NA HORA, sem
  relogin/refresh; o refresh do device não muda):
  POST /tutor → { ...tutor, access_token } (tutorId novo no payload);
  POST /parceiro/portal/cadastro → { parceiroId, statusAuditoria: 'PENDENTE', access_token }
  (payload com perfilAtivo PARCEIRO + parceiroAtivoId).
- Portal /parceiro/portal/*: resolução do parceiro = ?parceiroId (override, sempre vence) →
  claim parceiroAtivoId (revalidado no servidor) → auto se 1 membership → 400 se N>1. EXCEÇÃO:
  telas de carteira e de compartilhamento-prestador ainda NÃO leem o claim; com N>1 parceiros,
  continue mandando ?parceiroId explícito nelas.

TAREFAS DE UI
1) Tela "Trocar de conta" no menu de perfil: GET /auth/perfis ao abrir; itens = tutor + um por
   parceiro, NADA de veterinário (tutor com badge Desativada se ativo:false; parceiro rotulado
   pelo nome quando papel=DONO e como "Equipe · {nome}" quando papel=OPERADOR, com badge Em
   análise/Rejeitado/Suspenso quando status != APROVADO); item atual marcado via claim do token
   (ausente = TUTOR); CTAs "Criar perfil de tutor" quando tutor == null e "Cadastrar meu
   negócio" quando NÃO existe membership DONO em PENDENTE/APROVADO.
2) Ao tocar em outro perfil: POST /auth/trocar-perfil → no 200, (a) substitua access+refresh no
   storage seguro, (b) persista { perfil, parceiroId } pro corpo do refresh, (c) invalide TODOS
   os caches de dados da sessão, (d) navegue pra home do perfil. No 403: toast neutro + refetch
   da lista.
3) Cadastro de parceiro logado: consumir o access_token do response na hora; navegar pra tela
   de status (o parceiro nasce PENDENTE); chamadas do portal já funcionam sem ?parceiroId.
4) Cadastro de tutor logado (conta que só tinha parceiro): POST /tutor, trocar o access_token,
   seguir pro onboarding de pets.
5) Sessão: no refresh de boot/401, incluir { perfil, parceiroId } persistidos; implementar a
   recuperação descrita (400/403 = retry sem perfil; 401 = login). Biometria não muda: troca e
   cadastro nunca revogam o refresh guardado no SecureStore.
6) Não esconder nem bloquear rotas de tutor quando perfilAtivo = PARCEIRO (elas continuam
   funcionando; a UI só muda o que apresenta).

CRITÉRIOS DE ACEITE (1 conta dev)
- Login tutor: token sem perfilAtivo; seletor mostra tutor + CTA de cadastrar negócio.
- Cadastro de parceiro logado: sem relogin, o portal abre e opera sem ?parceiroId.
- Troca PARCEIRO → TUTOR → PARCEIRO funciona com swap de par + reset de cache (nenhum dado de
  um perfil vaza na tela do outro).
- Matar o app e reabrir com biometria: sessão volta já no último perfil ativo (refresh com
  perfil persistido).
- Simular perda da membership (backend nega): app se recupera sozinho caindo pra TUTOR, sem
  loop de erro e sem deslogar.
- Nenhuma menção a veterinário em tela nenhuma; grep no diff por 'VETERINARIO'/'veterinario'
  só pode aparecer em código que IGNORA o campo.
- Nenhum if/switch sobre message de erro no diff; nenhuma copy nova com em-dash.
```
