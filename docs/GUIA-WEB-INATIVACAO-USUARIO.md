# Guia — Inativação e reativação de usuário (perfil)

**Status:** guia de implementação (contrato + fluxos)  
**Escopo:** inativar / reativar **perfil** de tutor ou veterinário na mesma conta (`Usuario`).  
**Público:** time do painel web (e qualquer cliente que espelhe o app mobile).  
**Fora de escopo:** ciclo de vida de **pet** (ver [NOVAS-IMPLENTAÇÕES/ciclo_de_vida_pet.md](NOVAS-IMPLENTAÇÕES/ciclo_de_vida_pet.md)); exclusão definitiva de conta.

**Design e UI:** fora deste guia. Aqui: contrato de API, semântica de estados e fluxo funcional.

**Documentos relacionados:**
- [GUIA-WEB-CADASTRO-VETERINARIO-PARCEIRO.md](GUIA-WEB-CADASTRO-VETERINARIO-PARCEIRO.md) §7.4 — menção curta ban vs perfil.
- [NOVAS-IMPLENTAÇÕES/00-fundacao-papeis-e-codigo.md](NOVAS-IMPLENTAÇÕES/00-fundacao-papeis-e-codigo.md) — papéis JWT, `@Roles(TUTOR)`, staleness de `tutorActive`.
- Implementação de referência no app: `services/inativacao/inativacao-service.ts`, `app/(tabs)/profile.tsx`, `app/(auth)/login.tsx`, `app/(auth)/select-profile.tsx`.

---

## 1. Resumo

Inativar é **soft-disable do perfil**, não apagar a conta. Os dados permanecem; o usuário pode reativar depois.

Há **dois níveis** que não devem ser misturados:

| Nível | Campo | Efeito no login | Como “voltar” |
|-------|--------|-----------------|---------------|
| **Conta banida / desligada** | `Usuario.ativo = false` | Login **bloqueado** | Fluxo admin / política da API (não é o self-service deste guia) |
| **Perfil inativo** | `Tutor.ativo` ou `Veterinario.ativo = false` | Login **funciona**; JWT válido | `POST /users/me/reactivate` + refresh de token |

Perfil inativo continua **autenticado**, mas **não** tem o papel ativo (`@Roles(TUTOR)` exige `tutorId` **e** `tutorActive !== false`). O caminho de volta é só a rota de reativação (não pode exigir `@Roles(TUTOR)`).

**Inativar ≠ excluir.** Exclusão permanente (LGPD / encerramento): `DELETE /users/me` com senha — outro fluxo (`user-service.deleteAccount` no app).

**Inativar usuário ≠ inativar pet.** Pets usam `POST /pet/inativar-lote` / `POST /pet/reativar-lote`.

---

## 2. Endpoints (self-service)

Envelope padrão da API: sucesso em `{ statusCode, message, data }`. Trate erro por **statusCode** (e código se houver), não pela `message`.

Todas as rotas abaixo exigem JWT (usuário logado), **exceto** o efeito pós-inativação (app faz logout).

| Método | Rota | Body | Resposta útil |
|--------|------|------|---------------|
| `GET` | `/users/me/inactive-reasons` | — | Lista de motivos ativos |
| `POST` | `/users/me/inactivate` | `{ reasonId, customReason? }` | Ok; perfil fica inativo |
| `POST` | `/users/me/reactivate` | `{ profile: "tutor" \| "veterinario" }` | Ok; pedir refresh de token em seguida |

### 2.1 Motivos — `GET /users/me/inactive-reasons`

Shape consumido pelo app (campo em `data` ou envelope; no mobile: `response.data ?? []`):

```ts
type InactiveReason = {
  id: string;
  label: string;
  description?: string;
  isCustomAllowed: boolean; // se true, UI mostra campo de texto livre
};
```

### 2.2 Inativar — `POST /users/me/inactivate`

```ts
type InactivatePayload = {
  reasonId: string;
  /** Só quando o motivo selecionado tem `isCustomAllowed: true` */
  customReason?: string;
};
```

Comportamento esperado no cliente (espelho do app):

1. Carregar motivos.
2. Usuário escolhe um `reasonId`; se `isCustomAllowed`, preenche `customReason`.
3. Chamar inactivate.
4. **Encerrar sessão local** (logout) e redirecionar para login.
5. Não assumir que o access token antigo ainda reflete o estado (claims podem ficar stale até expirar / refresh).

### 2.3 Reativar — `POST /users/me/reactivate`

```ts
type ReactivatePayload = {
  profile: "tutor" | "veterinario";
};
```

Comportamento esperado no cliente:

1. Detectar que o perfil escolhido / único está inativo (ver §3).
2. Confirmar na UI → `POST /users/me/reactivate` com o `profile` correto.
3. **Obrigatório:** `POST /auth/refresh` (ou o helper equivalente de single-flight) e persistir o **novo** access token.
4. Só então seguir navegação normal (home / painel).

Sem o refresh, o JWT antiga pode ainda carregar `tutorActive: false` (ou o inverso após inativar) — janela de **staleness** documentada na fundação de papéis.

---

## 3. Como detectar perfil inativo no login

### 3.1 Conta com um perfil (ex.: só tutor)

No response de `POST /auth/login`:

- Campo `tutorInactive: true` → tutor inativo.
- **Ausência** do campo → tratar como ativo.

No app (`login.tsx`):

```ts
const tutorActive = responseData?.tutorInactive !== true;
```

Se inativo: **não** entrar na home; mostrar modal/tela de reativação com `profile: "tutor"` (ou `"veterinario"` no caso análogo).

### 3.2 Conta híbrida (tutor + veterinário)

Se o JWT/payload tiver `tutorId` **e** `veterinarioId`, o app manda para seleção de perfil. Lá:

- Claims / flags `tutorActive` / `veterinarioActive` (quando presentes) controlam se o card está habilitado.
- Toque em perfil inativo → modal → `POST /users/me/reactivate` → refresh → entrar.

> **Nota de contrato:** o app documenta que `tutorActive` / `veterinarioActive` **deixaram de ser a fonte preferida no JWT** por segurança (autoridade server-side); no login e-mail/senha o sinal canônico atual é `tutorInactive` no body do login. No fluxo híbrido / select-profile ainda pode haver flags no payload — **validar no backend real** o que o portal recebe em login e em refresh antes de fixar a UI.

### 3.3 Ban global

`Usuario.ativo === false` → login falha (usuário nem chega ao fluxo de reativação). Não oferecer “reativar perfil” nesse caso.

---

## 4. Fluxos (diagrama)

### 4.1 Inativar (self-service)

```
Usuário logado (perfil ativo)
  → abre “Desativar conta/perfil”
  → GET /users/me/inactive-reasons
  → escolhe motivo (+ texto se custom)
  → POST /users/me/inactivate { reasonId, customReason? }
  → logout local
  → tela de login
```

### 4.2 Reativar

```
POST /auth/login (sucesso, JWT emitido)
  → se perfil inativo (ex.: tutorInactive === true)
      → UI “Perfil inativo” + CTA Reativar
      → POST /users/me/reactivate { profile }
      → POST /auth/refresh → salvar novo token
      → entrar no app/painel
  → senão → fluxo normal pós-login
```

### 4.3 Exclusão (não é reativável por este guia)

```
POST/fluxo de confirmação com senha
  → DELETE /users/me { senha, reason? }
  → encerrar sessão
```

---

## 5. Regras para o portal web

1. **Reutilizar os mesmos endpoints** do app — não inventar `PATCH /tutor { ativo: true }` paralelo.
2. Após **reativar**, sempre **refresh** de token antes de chamar rotas que exigem papel ativo.
3. Rota de reativação deve funcionar com usuário autenticado **com perfil inativo** (sem gate de `@Roles(TUTOR)` no backend).
4. Distinguir copy de produto:
   - Desativar perfil = reversível (motivos + reativação).
   - Excluir conta = permanente / política legal (outro endpoint).
5. Conta banida (`Usuario.ativo=false`): mensagem de login genérica / suporte; sem CTA de reativação self-service.
6. Não misturar com inativação de pet ou de membership de parceiro (`ParceiroEquipe.ativo`).

---

## 6. Referência rápida — service mobile

Arquivo: `services/inativacao/inativacao-service.ts`

| Método app | HTTP |
|------------|------|
| `getUsersMeInactiveReasons()` | `GET /users/me/inactive-reasons` |
| `postUsersMeInactivate(data)` | `POST /users/me/inactivate` |
| `postUsersMeReactive(data)` | `POST /users/me/reactivate` |

Telas:

| Tela | Papel |
|------|--------|
| `app/(tabs)/profile.tsx` | Modal de motivos + inativar + logout |
| `app/screens/deactivation-details.tsx` | Copy educativa (o que acontece ao desativar) |
| `app/(auth)/login.tsx` | Detecta inativo pós-login + reativa |
| `app/(auth)/select-profile.tsx` | Híbrido: card desabilitado + modal reativar |

---

## 7. Checklist de implementação (portal)

- [x] Tela/modal de inativação com motivos de `GET /users/me/inactive-reasons`.
- [x] Campo texto só quando `isCustomAllowed`.
- [x] `POST /users/me/inactivate` e logout.
- [x] Pós-login: ler `tutorInactive` (e equivalente vet, se o backend expuser).
- [x] Modal/tela de reativação com `POST /users/me/reactivate { profile }`.
- [x] Refresh de token após reativar; persistir e usar o JWT novo.
- [ ] Conta híbrida: seleção de perfil + reativação por perfil.
- [x] Separar UX de “Excluir conta” (`DELETE /users/me`).
- [x] Não confundir com inativar pet / ban admin.

---

## 8. Prompt curto (copiar para o time web)

> Implemente inativação/reativação de **perfil** no portal, espelhando o app PetJourney. Endpoints: `GET /users/me/inactive-reasons`, `POST /users/me/inactivate { reasonId, customReason? }`, `POST /users/me/reactivate { profile: "tutor"|"veterinario" }`. Após reativar, chame `POST /auth/refresh` e grave o token novo. Login com perfil inativo: `tutorInactive === true` no body de `/auth/login` (ausência = ativo). `Usuario.ativo=false` é ban (login bloqueado) e não usa esse fluxo. Exclusão é `DELETE /users/me`, outro caminho. Detalhe: `docs/GUIA-WEB-INATIVACAO-USUARIO.md`.
