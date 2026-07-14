# Guia — Esqueceu a senha (recuperação completa)

**Status:** guia de implementação (contrato + fluxos + rotas)  
**Escopo:** fluxo público de **recuperação de senha** (3 etapas API) e como o app / portal devem espelhar.  
**Público:** time do portal web e quem integra auth fora do app.  
**Fora de escopo:** troca de senha **logado** (`POST /auth/reset-password-authenticated` — §8, só contraste).

**Design e UI:** fora deste guia. Aqui: rotas de tela, endpoints, payloads, regras de senha, anti-enumeração e throttle.

**Documentos relacionados:**
- Endpoints públicos: [security/public-endpoints.md](security/public-endpoints.md)
- Migracão anti-enumeração: [security/frontend-migration.md](security/frontend-migration.md) §2.5
- Menção curta no cadastro web: [GUIA-WEB-CADASTRO-VETERINARIO-PARCEIRO.md](GUIA-WEB-CADASTRO-VETERINARIO-PARCEIRO.md) §7.3
- Implementação de referência: `app/(auth)/forgot-password.tsx`, `services/auth/auth-service.ts`, `app/(auth)/login.tsx`

---

## 1. Resumo

Recuperação é **pública** (sem JWT). Três chamadas em sequência:

1. Pedir código → email recebe PIN de 6 dígitos  
2. Validar PIN → API devolve `reset_token` (JWT ~10 min)  
3. Definir nova senha com o `reset_token`

Sucesso final → usuário volta ao **login** e entra com a senha nova. Não há auto-login neste fluxo.

---

## 2. Rotas de tela (app)

| Rota expo-router | Arquivo | Papel |
|------------------|---------|--------|
| `/(auth)/login` | `app/(auth)/login.tsx` | Link “Esqueceu a senha?” → push forgot |
| `/(auth)/forgot-password` | `app/(auth)/forgot-password.tsx` | Fluxo completo (UI em 2 steps + modal de PIN) |
| `/(auth)/login` (replace) | — | Destino após reset ok |

Registrada em `app/(auth)/_layout.tsx` (`Stack.Screen name="forgot-password"`).  
Faz parte de `PRE_LOGIN_ROUTES` (seletor de idioma no overlay).

Entrada:

```
Login → router.push("/(auth)/forgot-password")
```

Saída em sucesso:

```
router.replace("/(auth)/login")
```

No **portal web**, espelhar com rotas equivalentes (ex.: `/login`, `/forgot-password`) — o contrato HTTP é o mesmo.

---

## 3. Fluxo completo (diagrama)

```
[Login] ──"Esqueceu senha?"──▶ [Forgot — Step 1: email]
                                      │
                                      │ POST /auth/recovery-password { email }
                                      │ (sempre 200 se request ok — anti-enumeração)
                                      ▼
                               [Modal: digitar PIN 6 dígitos]
                                      │
                                      │ POST /auth/verify-recovery-pin { email, pin }
                                      │ ← data.reset_token
                                      ▼
                               [Forgot — Step 2: nova senha + confirmação]
                                      │
                                      │ POST /auth/reset-password
                                      │   { reset_token, newPassword }
                                      ▼
                               Toast sucesso → replace Login
```

No app a **UI** tem 2 “steps” de tela; a verificação do PIN é um **modal** entre eles. Na API são **3 etapas**.

---

## 4. Endpoints (API pública)

Todas sem `Authorization`. Lista oficial: [public-endpoints.md](security/public-endpoints.md).

| # | Método | Rota | Throttle (doc) | Body | Sucesso |
|---|--------|------|----------------|------|---------|
| 1 | `POST` | `/auth/recovery-password` | 3× / 15 min | `{ "email": string }` | **200** sempre (mesmo se email não existe) |
| 2 | `POST` | `/auth/verify-recovery-pin` | 5× / 15 min | `{ "email": string, "pin": string }` | 200 + `reset_token` |
| 3 | `POST` | `/auth/reset-password` | — | `{ "reset_token": string, "newPassword": string }` | 200 |

Envelope típico: `{ statusCode, message, data }`. No app, o token é lido como `response?.data?.reset_token` após o unwrap do service (`authService` retorna o body axios `data`).

### 4.1 Etapa 1 — pedir código

```http
POST /auth/recovery-password
Content-Type: application/json

{ "email": "user@example.com" }
```

**Anti-enumeração:** resposta **200** com mensagem neutra mesmo se o email não estiver cadastrado.  
Não mostrar “email não encontrado”. Copy sugerida (app):

> Se houver uma conta associada a {email}, enviamos um código de 6 dígitos. Confira a caixa de entrada e o spam.

Erro de rede / 429 → toast genérico (“Erro de conexão / tente novamente”), **sem** sugerir que o email está errado.

### 4.2 Etapa 2 — validar PIN

```http
POST /auth/verify-recovery-pin
Content-Type: application/json

{ "email": "user@example.com", "pin": "123456" }
```

PIN: **6 dígitos** (validação local no app: `code.length < 6`).

Resposta esperada (dentro de `data` ou envelope):

```ts
{ reset_token: string } // JWT de reset, TTL ~10 minutos
```

PIN inválido / expirado → erro; UI: mensagem no campo do código (“código inválido”), não enumerar conta.

Guardar o `reset_token` em memória de tela até a etapa 3. **Não** usar como `access_token` de sessão.

### 4.3 Etapa 3 — nova senha

```http
POST /auth/reset-password
Content-Type: application/json

{
  "reset_token": "<jwt da etapa 2>",
  "newPassword": "Senha@1"
}
```

| Campo | Regra |
|-------|--------|
| `reset_token` | Obrigatório; JWT da verify; ~**10 min** de validade |
| `newPassword` | Mesmas regras do cadastro (abaixo) |

Sucesso → toast + redirecionar ao login.  
Falha (token expirado, senha fraca no backend, etc.) → toast de erro; usuário pode pedir código de novo (volta à etapa 1).

---

## 5. Regras de senha (client + alinhamento com register)

Validação local no app (espelhar no portal):

| Regra | Check |
|-------|--------|
| Mínimo 6 caracteres | `length >= 6` |
| Pelo menos 1 número | `/\d/` |
| Pelo menos 1 maiúscula | `/[A-Z]/` |
| Pelo menos 1 caractere especial | `/[^a-zA-Z0-9]/` |
| Confirmação igual | `newPassword === confirmPassword` |

Validação inline + haptic warning; Toast só para sucesso/erro de API.

UI de apoio no app: `PasswordStrengthIndicator` no step 2.

---

## 6. Mapa mental tela ↔ API (como o app faz)

| UI | Handler | Service | Endpoint |
|----|---------|---------|----------|
| Step 1 — email + “Enviar código” | `handleSendCode` | `authService.recoveryPassword(email)` | `POST /auth/recovery-password` |
| Modal — PIN + “Verificar” | `handleVerifyCode` | `authService.postVerificarCodigo({ email, pin })` | `POST /auth/verify-recovery-pin` |
| Step 2 — senha + confirmar + “Redefinir” | `handleResetPassword` | `authService.resetPassword(resetToken, newPassword)` | `POST /auth/reset-password` |

Trecho do service (`services/auth/auth-service.ts`):

```ts
recoveryPassword(email)           → POST /auth/recovery-password { email }
postVerificarCodigo({ email, pin }) → POST /auth/verify-recovery-pin
resetPassword(reset_token, newPassword) → POST /auth/reset-password { reset_token, newPassword }
```

---

## 7. Estados e edge cases

| Caso | Comportamento |
|------|----------------|
| Email vazio / inválido | Erro inline; não chama API |
| Email inexistente | Continua 200; modal abre com copy neutra |
| PIN &lt; 6 dígitos | Erro inline no modal |
| PIN errado | Erro no campo código |
| `reset_token` expirado (&gt; ~10 min) | Etapa 3 falha; pedir código de novo |
| Senha fraca | Erro inline com lista do que falta |
| Senhas diferentes | Erro no campo confirmação |
| Throttle recovery / verify | 429 / erro de rede genérico; copy neutra |
| Sucesso | Login; usuário digita email + senha nova |

Não empilhar modais nativos: no app o PIN é o único `Modal` nesta tela.

---

## 8. Contraste — “Alterar senha” (logado)

**Não** é o fluxo esqueceu senha.

| | Esqueci senha | Alterar senha logado |
|--|---------------|----------------------|
| Auth | Público | JWT obrigatório |
| Rota app | `/(auth)/forgot-password` | `/screens/changePassword` (via Segurança) |
| Endpoint | `/auth/reset-password` | `/auth/reset-password-authenticated` |
| Body | `reset_token` + `newPassword` | `oldPassword` + `newPassword` (**sem** `email`) |

Se enviar `email` no authenticated → **400** (`forbidNonWhitelisted`). Ver [frontend-migration.md](security/frontend-migration.md) §2.4.

---

## 9. Checklist portal web

- [ ] Rota pública `/forgot-password` (ou equivalente) linkada a partir do login.
- [ ] Etapa 1: `POST /auth/recovery-password` + copy **anti-enumeração** (sempre tratar 200 como “código enviado se existir conta”).
- [ ] Etapa 2: PIN 6 dígitos → `POST /auth/verify-recovery-pin` → guardar `reset_token`.
- [ ] Etapa 3: regras de senha iguais ao cadastro → `POST /auth/reset-password`.
- [ ] Sucesso → `/login` (sem auto-login).
- [ ] Tratar token expirado / throttle com mensagens neutras.
- [ ] Separar tela “alterar senha” autenticada (outro endpoint).
- [ ] Respeitar throttle documentado (3/15min recovery, 5/15min verify).

---

## 10. Prompt curto

> Implemente o fluxo Esqueci senha em 3 etapas públicas: (1) `POST /auth/recovery-password { email }` — sempre 200 anti-enumeração, copy neutra; (2) `POST /auth/verify-recovery-pin { email, pin }` — PIN 6 dígitos, retorna `reset_token` (JWT ~10 min); (3) `POST /auth/reset-password { reset_token, newPassword }` — senha: mín. 6, 1 número, 1 maiúscula, 1 especial; confirmar igual. Sucesso vai para login. Referência app: `app/(auth)/forgot-password.tsx` + `services/auth/auth-service.ts`. Detalhe: `docs/GUIA-WEB-ESQUECEU-SENHA.md`.
