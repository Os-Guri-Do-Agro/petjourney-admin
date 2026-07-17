# Spec Frontend: Parte 9 — Solicitação de Parceiro: Ciclo Completo (app)

**Status:** Backend LIVE em dev (migration aplicada, smoke 24/24 na API viva). Pronto pra integrar.
**Criado em:** 2026-07-16
**Spec backend:** [09-solicitacao-parceiro-ciclo-completo.md](09-solicitacao-parceiro-ciclo-completo.md)
**Contrato geral do épico:** [frontend.md](frontend.md) (envelope, auth, i18n, erros)
**Plataforma alvo:** **app mobile** (`petjourney-app`, Expo/React Native). O CMS (fila do admin) tem spec própria (follow-up).

> Este doc é auto-suficiente: uma IA de código implementa o funil do prestador 100% a partir daqui. A seção 1 diagnostica o que o app tem HOJE e por que está quebrado; da seção 2 em diante é o contrato e as telas.

---

## 0. O que é a feature (em 3 linhas)

Qualquer usuário (tutor ou conta nova) cadastra o próprio negócio como **parceiro** pelo app; o cadastro nasce **PENDENTE** e a equipe aprova/recusa (o prestador recebe e-mail em cada passo, automático do backend). Aprovado, ele completa os dados quando quiser e solicita os programas **Afiliado** e **Participativo**. Recusado (cadastro OU programa), ele vê o **motivo**, corrige e **reenvia pelo app**; suspenso fica travado (só o suporte reativa).

---

## 1. O que o app tem hoje e o que está errado (leia antes de codar)

Arquivos atuais do módulo:

- `services/parceiro/parceiro-service.ts`
- `app/screens/parceiro/solicitar-afiliacao.tsx`
- `src/features/parceiro/` (`types.ts`, `hooks.ts`, `components/AfiliacaoWizard.tsx`, `AfiliacaoInfoStep.tsx`, `AfiliacaoConfirmStep.tsx`, `ParceiroStatusPanel.tsx`)

Problemas confirmados (cada um vira item desta spec):

1. **Beco sem saída:** o wizard só aparece pra quem NÃO tem parceiro, e o submit chama `POST /modos/afiliado/solicitar`, que exige parceiro APROVADO existente. Pra usuário sem parceiro isso sempre dá 403. **Agora existe `POST /parceiro/portal/cadastro`** — é ele que o wizard deve chamar.
2. **Reasons fantasmas:** o toast trata `SOLICITATION_ALREADY_EXISTS` e `ALREADY_PARTNER_MEMBER`, que o backend NUNCA enviou. Os reasons reais estão na seção 5. Remover os fantasmas.
3. **Só lê `statusAuditoria`:** `normalizeSolicitacao` ignora os modos por completo. Modo recusado com credenciamento aprovado mostra painel verde ("aprovado") — informação errada. A tela deve ler os **blocos `afiliado`/`participativo`** novos do `GET /status`.
4. **Sem re-tentativa:** recusado não tem botão de corrigir/reenviar (o backend agora suporta re-submissão e expõe o motivo).
5. **Participativo não existe** no app (`MODO_AFILIADO` hardcoded). Os dois programas entram nesta onda.
6. **Signup "sou prestador" não existe:** o registro (`POST /usuario`) aceita conta SEM perfil tutor (`tutor` é opcional no body); falta a UI oferecer esse caminho.

Padrão de dados do módulo: manter o atual (`services/<mod>/<mod>-service.ts` + hook manual). NÃO migrar pra TanStack Query nesta onda sem confirmar com o Nicolas (migração é granular por módulo).

---

## 2. Convenções (vale pra todas as rotas)

- **Auth:** `Authorization: Bearer {token}` (JWT do login normal; NÃO existe login separado de parceiro).
- **`?parceiroId=`:** opcional; obrigatório se o usuário é membro de 2+ parceiros (400 se omitir). Com 1, pode omitir.
- **Papel:** cadastrar/editar/solicitar modo exigem **DONO** (quem cadastra vira DONO automaticamente). OPERADOR só lê (403 nas ações).
- **Envelope de sucesso:** `{ statusCode, message, data }` → corpo útil em `response.data.data`.
- **Envelope de erro (NOVO nesta parte):** os erros do funil trazem **`reason` estável no topo do JSON** (ex.: `{ statusCode: 409, message: '...', reason: 'PARCEIRO_CADASTRO_JA_EXISTE', ... }`). **Roteie a UX pelo `reason`**, nunca pela `message` (que é localizada). Erros antigos de outras rotas continuam sem reason.
- **Copy:** em-dash (`—`) proibido; i18n com en-GB explícito nas traduções.

---

## 3. Enums e máquinas de estado (literais — casar exatamente)

```ts
type StatusAuditoriaParceiro = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUSPENSO'
type StatusModoParceiro = 'NAO_SOLICITADO' | 'SOLICITADO' | 'ATIVO' | 'REJEITADO' | 'SUSPENSO'
type Modo = 'afiliado' | 'participativo'
type CategoriaParceiro =
  | 'CLINICA_VETERINARIA'
  | 'PET_SHOP'
  | 'BANHO_TOSA'
  | 'ADESTRAMENTO'
  | 'HOTEL_CRECHE'
  | 'FARMACIA'
  | 'OUTRO'
```

**Credenciamento (o cadastro da empresa):**

```
(sem parceiro) ──POST /cadastro──▶ PENDENTE ──admin aprova──▶ APROVADO ──admin suspende──▶ SUSPENSO
                                      │                                                       │
                                (admin rejeita)                                     (só admin reativa)
                                      ▼
                                  REJEITADO ──POST /cadastro (re-submissão, mesmos dados novos)──▶ PENDENTE
```

**Modos (Parte 9 mudou a máquina — decorar):**

- Solicitar: só de `NAO_SOLICITADO` ou `REJEITADO`. **`SUSPENSO` NÃO pode re-solicitar** (mudança vs Parte 5: antes podia; agora 409 `PARCEIRO_MODO_SUSPENSO`).
- `podeSolicitar` **vem calculado do backend** em cada bloco de modo. **NÃO reimplemente a máquina no front**: o CTA de solicitar liga/desliga por essa flag e ponto.

---

## 4. Endpoints

### 4.1 Auto-cadastro (a rota que destrava o wizard)

```http
POST /parceiro/portal/cadastro
Authorization: Bearer {token}
Content-Type: application/json

{ "nome": "Pet Shop do Bairro",          // ÚNICO obrigatório
  "categoria": "PET_SHOP",               // opcional (enum acima)
  "cnpj": "12345678000199",              // opcional
  "telefoneComercial": "(11) 99999-8888",// opcional (backend normaliza máscara)
  "crmv": "CRMV-SP 12345",               // opcional SEMPRE (mesmo pra clínica)
  "logoUrl": "https://..." }             // opcional
```

Resposta 201 (`data`): `{ parceiroId, statusAuditoria: 'PENDENTE' }`

- Funciona sem membership prévia (é a única rota do portal assim, além do aceite de convite).
- **Re-submissão:** se o usuário tem um cadastro REJEITADO, o MESMO `POST` reenvia (mesmo `parceiroId`, volta `PENDENTE`, motivo antigo limpo). O form deve ser pré-preenchido pelo `GET /cadastro` (4.2). Campos omitidos no re-envio são **apagados** (semântica replace); mande o form completo.
- Se o usuário tem `veterinarioPerfil` com CRMV e não mandar `crmv`, o backend copia do perfil.

Erros (todos 409 com `reason`, exceto o 400):
| `reason` | Quando | UX sugerida |
|---|---|---|
| `PARCEIRO_CADASTRO_JA_EXISTE` | já tem cadastro PENDENTE ou APROVADO | levar pra tela de status |
| `PARCEIRO_CADASTRO_SUSPENSO` | cadastro suspenso | tela travada + CTA suporte |
| `PARCEIRO_CADASTRO_NOME_EM_USO` | nome já registrado | destacar campo nome |
| `PARCEIRO_CADASTRO_CNPJ_EM_USO` | cnpj já registrado | destacar campo cnpj |
| (400, sem reason) | body sem `nome`, categoria inválida ou campo desconhecido | validação de form |

### 4.2 Ler o próprio cadastro (pré-preencher form)

```http
GET /parceiro/portal/cadastro?parceiroId={id}   (DONO; OPERADOR -> 403)
```

Resposta 200 (`data`):

```ts
{
  ;(parceiroId,
    nome,
    categoria,
    cnpj,
    telefoneComercial,
    crmv,
    logoUrl,
    statusAuditoria,
    motivoAuditoria)
} // motivoAuditoria = motivo da recusa/suspensão do CADASTRO
```

### 4.3 Editar o próprio cadastro (parcial)

```http
PATCH /parceiro/portal/cadastro?parceiroId={id}   (DONO)
{ "telefoneComercial": "(11) 91234-5678" }        // qualquer subconjunto dos campos do POST
```

Resposta 200: mesmo shape do GET. Só o que foi enviado muda; `statusAuditoria` NUNCA muda por aqui.

- Permitido em `PENDENTE` e `APROVADO` (o e-mail de aprovação convida a completar o cadastro: essa é a tela).
- Em `REJEITADO`, editar-e-reenviar é o `POST` (4.1), não o PATCH.
- `SUSPENSO` → 409 `PARCEIRO_CADASTRO_SUSPENSO`. Nome/CNPJ em uso → mesmos reasons de 4.1. Campo de admin no body → 400.

### 4.4 Status (a fonte da tela inteira — MUDOU)

```http
GET /parceiro/portal/status?parceiroId={id}   (qualquer membro ACEITO)
```

Resposta 200 (`data`):

```ts
{
  statusAuditoria: StatusAuditoriaParceiro;
  motivoAuditoria?: string;          // motivo de recusa/suspensão do CADASTRO
  auditadoEm?: string;               // ISO
  podeOperar: boolean;               // APROVADO && ativo
  // ---- NOVO (Parte 9): use ESTES blocos; os campos crus abaixo são legado ----
  afiliado:      { status: StatusModoParceiro; motivo: string | null;
                   decididoEm: string | null; podeSolicitar: boolean };
  participativo: { status: StatusModoParceiro; motivo: string | null;
                   decididoEm: string | null; podeSolicitar: boolean };
  statusAfiliado: StatusModoParceiro;        // legado, ignorar
  statusParticipativo: StatusModoParceiro;   // legado, ignorar
}
```

- `motivo`/`decididoEm` do bloco só vêm preenchidos quando o status do modo é `REJEITADO`/`SUSPENSO` (motivo órfão de recusa antiga não vaza depois de re-solicitar).
- 403 = o usuário não tem parceiro nenhum → é o gatilho pra mostrar o funil de cadastro (wizard).

### 4.5 Solicitar programa (DONO)

```http
POST /parceiro/portal/modos/{afiliado|participativo}/solicitar?parceiroId={id}
```

Resposta 201 (`data`): `{ modo, status: 'SOLICITADO' }`

Erros: 403 (não é DONO) · 409 sem reason `Parceiro nao operavel` (cadastro não aprovado; a UI nem deve mostrar o CTA nesse caso) · 409 `reason: 'PARCEIRO_MODO_JA_SOLICITADO'` · 409 `reason: 'PARCEIRO_MODO_SUSPENSO'` (travado; CTA suporte).

### 4.6 Registro de conta sem perfil (signup "sou prestador")

```http
POST /usuario
{ "email": "...", "nome": "...", "senha": "..." }   // SEM o objeto tutor e SEM veterinario
```

Já funciona no backend: conta nasce sem perfil tutor (sem plano Freemium, `tutorId: null` no JWT) e entra no funil de parceiro normalmente. O que falta é a UI de signup oferecer o caminho.

---

## 5. Telas e fluxos

### 5.1 Signup: caminho "sou prestador"

No registro, oferecer a escolha "sou tutor" (fluxo atual) vs "sou prestador de serviços". Prestador: registro mínimo (nome/email/senha, sem criação de perfil tutor) → login → cai direto no funil 5.2. Tutor existente NÃO precisa disso: entra no funil 5.2 pela conta que já tem (mesma conta, perfis coexistem).

### 5.2 Funil do cadastro (substitui o miolo de `solicitar-afiliacao.tsx`)

Roteamento pela resposta do `GET /status`:

- **403 (sem parceiro)** → wizard de cadastro: passos informativos (reaproveitar `AfiliacaoInfoStep`) + **form** com `nome` (obrigatório) e os opcionais (categoria como picker do enum, cnpj, telefone, crmv, logo). Deixar claro na UI que só o nome é obrigatório. Submit → `POST /cadastro` → tela de status.
- **`statusAuditoria: 'PENDENTE'`** → painel "em análise" (você recebe e-mail com o resultado) + botão "revisar meus dados" (5.4).
- **`'APROVADO'`** → painel central do parceiro: card do cadastro (com CTA completar dados se categoria/telefone vazios) + os **2 cards de programa** (5.3).
- **`'REJEITADO'`** → painel de recusa: exibir `motivoAuditoria`, form pré-preenchido via `GET /cadastro` e CTA **"Corrigir e reenviar"** → `POST /cadastro` (mesma rota do wizard).
- **`'SUSPENSO'`** → painel travado: `motivoAuditoria` + CTA mailto suporte. Sem edição, sem re-envio.

### 5.3 Cards de programa (afiliado + participativo, ambos)

Para cada bloco (`afiliado`, `participativo`) do status:

- `NAO_SOLICITADO` + `podeSolicitar: true` → card com pitch + botão "Participar".
- `SOLICITADO` → badge "em análise".
- `ATIVO` → badge ativo; no afiliado, atalho pra carteira (Parte 4).
- `REJEITADO` → badge recusado + **`motivo`** + `decididoEm` + botão "Solicitar novamente" (`podeSolicitar` já vem `true`).
- `SUSPENSO` → badge suspenso + `motivo` + CTA suporte (sem botão de re-pedido; `podeSolicitar` vem `false`).
  Regra de ouro: **o botão de solicitar renderiza SE `podeSolicitar === true`**, e mais nada.

### 5.4 Editar cadastro

Tela de form pré-preenchida (`GET /cadastro`), salvar via `PATCH` (parcial). Disponível em PENDENTE e APROVADO. Toast de sucesso; erros de unique destacam o campo (reasons de 4.1).

### 5.5 Tratamento de erro (service)

`getErrorReason` deve ler o campo `reason` do body de erro. Mapear TODOS os reasons novos pra chaves i18n próprias; reason desconhecido → mensagem genérica com a `message` do backend. **Apagar** os handlers de `SOLICITATION_ALREADY_EXISTS`/`ALREADY_PARTNER_MEMBER`.

---

## 6. Arquivos do app impactados (mapa)

| Arquivo                                        | Ação                                                                                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/parceiro/parceiro-service.ts`        | Reescrever: `getStatus` (blocos novos), `cadastrar`, `getCadastro`, `atualizarCadastro`, `solicitarModo(modo)`; normalização não pode mais defaultar `statusAuditoria: 'PENDENTE'` |
| `src/features/parceiro/types.ts`               | Tipos da seção 3 + shape do status (4.4) e do cadastro (4.2)                                                                                                                       |
| `src/features/parceiro/hooks.ts`               | Hook de status distinguindo 403-sem-parceiro (wizard) de erro real                                                                                                                 |
| `app/screens/parceiro/solicitar-afiliacao.tsx` | Vira o funil 5.2 (renomear rota/tela pra refletir "parceiro", não só afiliação)                                                                                                    |
| `src/features/parceiro/components/*`           | Wizard ganha o form de cadastro; `ParceiroStatusPanel` passa a renderizar credenciamento + 2 cards de modo com motivo                                                              |
| Signup (auth)                                  | Caminho "sou prestador" (registro sem perfil tutor)                                                                                                                                |
| i18n (locales)                                 | Chaves novas: cadastro (form, estados), programas (2 cards), reasons; en-GB explícito; sem em-dash                                                                                 |

---

## 7. Acceptance Criteria (front)

- **ACF-1:** usuário sem parceiro vê o wizard; submit só com nome cria o cadastro e a tela vira "em análise" SEM refresh manual.
- **ACF-2:** usuário com cadastro PENDENTE nunca vê o wizard nem botão de programa; vê "em análise" + revisar dados.
- **ACF-3:** cadastro REJEITADO mostra o `motivoAuditoria` e o CTA "Corrigir e reenviar" pré-preenchido; reenvio volta pra "em análise".
- **ACF-4:** cadastro SUSPENSO não tem botão de edição nem re-envio; mostra motivo + suporte.
- **ACF-5:** APROVADO mostra os DOIS cards de programa lendo os blocos novos; botão de solicitar aparece exatamente quando `podeSolicitar === true`.
- **ACF-6:** modo REJEITADO exibe `motivo` + `decididoEm` e permite re-solicitar; após re-solicitar, o motivo some (o backend já manda `null`).
- **ACF-7:** modo SUSPENSO exibe motivo e NÃO oferece re-pedido.
- **ACF-8:** todos os 409 do funil roteiam por `reason` (toast/tela específicos); nenhum reason fantasma antigo sobra no código.
- **ACF-9:** signup "sou prestador" cria conta sem perfil tutor e o funil 5.2 funciona de ponta a ponta pra ela.
- **ACF-10:** tutor existente entra no funil pela conta atual e o perfil tutor segue intacto (pets/assinatura inalterados).

---

## 8. Fora de escopo desta entrega

- CMS/admin (fila de credenciamento e de modos) — spec própria.
- Carteira/saque (Parte 4) além do atalho no card de afiliado ATIVO.
- Push notification das decisões (e-mail já sai do backend).
- Migração do módulo pra TanStack Query (confirmar com o Nicolas antes).

## Change Log

| Data       | Mudança                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------- |
| 2026-07-16 | Criação, com o backend da Parte 9 verificado em dev (integration 9/9 + smoke HTTP 24/24). |
