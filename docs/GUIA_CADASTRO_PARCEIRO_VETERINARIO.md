# Guia de Cadastro — Painel Web (Veterinário e Parceiro)

**Status:** guia de implementação (contrato + fluxos)  
**Escopo:** cadastro, credenciamento e onboarding de **veterinário** e **parceiro comercial** no painel web.  
**Fora de escopo:** cadastro de **tutor** (fica no app mobile; referência mínima só onde impacta o parceiro).  
**Público:** time do painel web (admin CMS + portal do parceiro + futuro signup público de vet/parceiro).

**Design e UI:** fora deste guia. Cores, tipografia, componentes e layout seguem o **design system do projeto web onde o painel for implementado**. Aqui documentamos só contrato de API, fluxos, validações e estrutura **funcional** das telas (campos, etapas, estados).

**Documentos relacionados:**

- [GUIA-WEB-ADMIN-VETERINARIO.md](GUIA-WEB-ADMIN-VETERINARIO.md) — operação clínica pós-login (agenda, pacientes, prontuário).
- [NOVAS-IMPLENTAÇÕES/regras.md](NOVAS-IMPLENTAÇÕES/regras.md) — regras de negócio em português claro.
- [NOVAS-IMPLENTAÇÕES/frontend.md](NOVAS-IMPLENTAÇÕES/frontend.md) — contrato completo de API (parceiro, carteira, equipe).
- [NOVAS-IMPLENTAÇÕES/03-parceiro-portal-auditado.md](NOVAS-IMPLENTAÇÕES/03-parceiro-portal-auditado.md) — spec do parceiro.
- [specs/2026-05-29-cadastro-sem-cpf-telefone.md](specs/2026-05-29-cadastro-sem-cpf-telefone.md) — decisão de CPF/telefone opcionais no signup.
- [security/public-endpoints.md](security/public-endpoints.md) — rotas públicas da API.

---

## 1. Resumo executivo

O PetJourney usa **uma conta única (`Usuario`)** com **vários perfis acumuláveis**. Para o painel web com foco em veterinário/parceiro, existem **dois eixos distintos**:

| Eixo            | O que é                                                    | Como nasce hoje                                                                     | Onde o web entra                                                                              |
| --------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Veterinário** | Perfil clínico (`veterinarioPerfil`)                       | **Não** há signup de vet no app mobile; o fluxo foi removido do `register.tsx`      | Admin web cria conta com bloco `veterinario` via `POST /usuario`, ou evolui usuário existente |
| **Parceiro**    | Empresa comercial (`Parceiro`) + equipe (`ParceiroEquipe`) | Criado por **admin** (`POST /parceiro`); **não** existe auto-cadastro público ainda | CMS admin credencia parceiros; portal web é onde o parceiro opera depois de logado            |

**Vet autônomo** (decisão de produto já documentada): é um `Parceiro` com 1 membro `DONO` na mesma conta que pode **também** ter `veterinarioPerfil`. Não há entidade separada de “vet autônomo”.

---

## 2. Modelo mental (obrigatório antes de implementar)

```
                    ┌─────────────────────────────────────┐
                    │           Usuario (conta)            │
                    │     email + senha + dados base       │
                    └──────────────┬──────────────────────┘
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
   ┌───────────────┐      ┌────────────────┐      ┌──────────────────┐
   │  tutorPerfil  │      │ veterinarioPerfil │   │ ParceiroEquipe   │
   │  (app tutor)  │      │  (painel clínico) │   │ (portal parceiro)│
   └───────────────┘      └────────────────┘      └────────┬─────────┘
                                                            │
                                                            ▼
                                                   ┌────────────────┐
                                                   │    Parceiro    │
                                                   │ (empresa B2B)  │
                                                   └────────────────┘
```

### Regras que o front web **não pode violar**

1. **Papéis não vão no body autenticado.** O servidor resolve `userId`, `veterinarioId`, membership de parceiro e `isSystemAdmin` a partir do JWT. O client **nunca** envia esses IDs em mutações de “quem sou eu”.
2. **Parceiro não está no JWT.** O token carrega `veterinarioId`, mas **não** `parceiroId`. O portal resolve membership consultando `ParceiroEquipe` em cada request.
3. **Login é sempre o mesmo:** `POST /auth/login` com email **ou** CPF + senha. Não existe “login de parceiro” separado.
4. **CPF e telefone são opcionais** no cadastro (desde 2026-05-29). Podem ser preenchidos depois no perfil.
5. **Trial Freemium (3 meses)** é efeito colateral do cadastro **com perfil tutor**. Cadastro só com `veterinario` **não** deve disparar trial de tutor (ver seção 4.1).

---

## 3. O que o app mobile faz hoje (referência)

### 3.1 Cadastro no app = só tutor

O `register.tsx` atual envia **apenas** perfil tutor:

```json
{
  "email": "vet@clinica.com",
  "nome": "Dr. João",
  "senha": "Senha@1",
  "ativo": true,
  "tutor": {
    "foto": "https://.../new_user.jpeg"
  }
}
```

- Wizard de **2 passos:** (1) nome + email, (2) senha + termos.
- Valida email com `GET /usuario/verificar?email=`.
- Após sucesso: `setActiveProfile("tutor")` e navega para `addPet?postRegister=1`.
- Campo opcional `codigoIndicacao` (programa de indicação de **parceiro** para **tutores** — irrelevante no cadastro vet/parceiro).

### 3.2 Cadastro de veterinário existiu e foi removido

Antes da spec `2026-05-29-cadastro-sem-cpf-telefone`, o app suportava branch `Veterinário` com payload:

```json
{
  "veterinario": {
    "crmv": "CRMV-SP 12345",
    "especialidade": "Clínica Geral",
    "foto": "https://.../new_user.jpeg"
  }
}
```

Esse caminho era **código morto** (perfil sempre iniciava `"Tutor"`). Foi removido de propósito. **O painel web é o lugar certo para reintroduzir cadastro de vet**, não o app tutor.

### 3.3 Pós-login com múltiplos perfis

Se o JWT tiver `tutorId` **e** `veterinarioId`, o app abre `select-profile.tsx` para escolher tutor ou veterinário. Perfis inativos exibem modal de reativação (`POST /users/me/reactivate`).

### 3.4 Serviços existentes no app (somente leitura)

| Service               | Rotas                                                           | Uso                        |
| --------------------- | --------------------------------------------------------------- | -------------------------- |
| `user-service`        | `POST /usuario`, `GET /usuario/verificar`, `PATCH /usuario/:id` | Cadastro e perfil          |
| `auth-service`        | `POST /auth/login`, refresh, recovery                           | Sessão                     |
| `veterinario-service` | `GET /veterinario`, search                                      | Listagem pública/discovery |
| `clinica-service`     | `GET /clinica`, search                                          | Listagem de clínicas       |

Não há service de criação de clínica ou parceiro no app mobile.

---

## 4. Fluxo A — Cadastrar veterinário (painel web)

### 4.1 Objetivo

Criar **conta + perfil veterinário** para acesso ao painel clínico (ver [GUIA-WEB-ADMIN-VETERINARIO.md](GUIA-WEB-ADMIN-VETERINARIO.md)).

### 4.2 Endpoint

`POST /usuario` — **público** (sem JWT). Ver [public-endpoints.md](security/public-endpoints.md).

### 4.3 Payload recomendado (vet puro, sem tutor)

```json
{
  "email": "dra.maria@clinica.com",
  "nome": "Dra. Maria Silva",
  "senha": "Senha@1",
  "ativo": true,
  "telefone": "11999998888",
  "telefoneWhatsApp": "11999998888",
  "cpf": "12345678901",
  "veterinario": {
    "crmv": "CRMV-SP 12345",
    "especialidade": "Clínica Geral",
    "foto": "https://.../default-vet.jpeg"
  }
}
```

| Campo                       | Obrigatório    | Regra                                                                  |
| --------------------------- | -------------- | ---------------------------------------------------------------------- |
| `email`                     | Sim            | Válido e único (`GET /usuario/verificar`)                              |
| `nome`                      | Sim            | Mín. 3 caracteres                                                      |
| `senha`                     | Sim            | Mín. 6, 1 número, 1 maiúscula, 1 especial (mesma regra do app)         |
| `veterinario.crmv`          | Recomendado    | Identificação profissional; era obrigatório no fluxo vet antigo do app |
| `veterinario.especialidade` | Recomendado    | Texto livre                                                            |
| `veterinario.foto`          | Opcional       | URL; usar avatar padrão se omitido                                     |
| `cpf`, `telefone*`          | Opcional       | Sem máscara no payload (só dígitos)                                    |
| `tutor`                     | **Não enviar** | Evita criar perfil tutor + trial Freemium indesejado                   |
| `codigoIndicacao`           | **Não enviar** | Campo do programa de indicação **tutor→parceiro**                      |

### 4.4 Resposta de sucesso

Envelope padrão `{ statusCode, message, data }`. O `data` inclui `access_token` (e tipicamente `refresh_token`). O painel pode:

- **Opção A (admin):** não fazer auto-login; só exibir “conta criada” e entregar credenciais por canal seguro.
- **Opção B (self-signup futuro):** gravar tokens e redirecionar para onboarding do painel vet.

### 4.5 Pós-cadastro — edição de perfil

`PATCH /usuario/:id` (autenticado) aceita os mesmos campos opcionais de usuário (`nome`, `telefone`, `cpf`, blocos aninhados). O app hoje edita sobretudo `tutor.foto`; o painel vet deve enviar `veterinario: { foto, crmv, especialidade }` conforme contrato da API.

`GET /usuario/allInformations/:id` retorna `veterinarioPerfil` para pré-preencher formulários.

### 4.6 Wizard sugerido no painel web

| Etapa            | Campos                                   | Validação                                                                  |
| ---------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| 1 — Identidade   | Nome, email                              | Email disponível on-blur (`409` → “E-mail já cadastrado”)                  |
| 2 — Profissional | CRMV, especialidade, foto (upload)       | CRMV não vazio; upload via service de arquivo existente                    |
| 3 — Conta        | Senha, confirmar senha, aceite de termos | Mesmas regras de força do app; checklist visível                           |
| 4 — Opcional     | CPF, telefone, WhatsApp                  | CPF: validar dígito + `verificar`; lock read-only após setado (padrão app) |

### 4.7 Estados da tela

- **Loading:** verificação de email / submit.
- **Empty:** N/A (form).
- **Error:** inline em campo (validação) + feedback global em erro de API/rede.
- **Success:** redirect para login ou dashboard vet.

---

## 5. Fluxo B — Cadastrar parceiro comercial (painel web)

### 5.1 Objetivo

Credenciar **empresa parceira** (pet shop, clínica, farmácia, etc.) para: cupons de desconto, código de indicação, carteira/comissões e equipe operacional.

### 5.2 Quem cria

| Ator                              | Rota                   | Guard                                   |
| --------------------------------- | ---------------------- | --------------------------------------- |
| **Admin CMS**                     | `POST /parceiro`       | `JwtAuthGuard` + `SystemAdminGuard`     |
| **Parceiro (futuro self-signup)** | Ainda **não definido** | Nasceria `PENDENTE` + fila de auditoria |

Hoje: **só admin**. Auto-cadastro de parceiro está em aberto ([regras.md §11](NOVAS-IMPLENTAÇÕES/regras.md)).

### 5.3 Criar parceiro (admin)

`POST /parceiro`

```json
{
  "nome": "Clínica Vet Center",
  "logoUrl": "https://.../logo.png",
  "cnpj": "12345678000199",
  "donoUsuarioId": "uuid-do-usuario-dono",
  "comissaoPercentual": 5
}
```

| Campo                | Obrigatório | Comportamento                                                                                      |
| -------------------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `nome`               | Sim         | Único (`@unique`)                                                                                  |
| `logoUrl`            | Não         | URL da logo                                                                                        |
| `cnpj`               | Não         | Único quando presente                                                                              |
| `donoUsuarioId`      | Não         | Se informado: cria `ParceiroEquipe` com `papel=DONO`, `status=ACEITO`. Usuário inexistente → `404` |
| `comissaoPercentual` | Não         | `null` = default global 5% (Parte 4)                                                               |

**Efeitos automáticos no fluxo admin:**

- `statusAuditoria = APROVADO` (já credenciado).
- `codigoIndicacao` gerado (base32 ~10 chars, único).
- Sem `donoUsuarioId`: parceiro “órfão” APROVADO — admin liga dono depois via convite.

### 5.4 Vincular pessoas à empresa

#### Cenário 1 — Dono já tem conta

1. Admin cria parceiro com `donoUsuarioId`.
2. Dono faz login normal e acessa `/parceiro/portal/*`.

#### Cenário 2 — Dono ainda não tem conta

1. Admin cria **primeiro** o `Usuario` (pode ser só com `tutor` ou sem perfil específico, ou com `veterinario` se for vet autônomo).
2. Admin cria `Parceiro` com `donoUsuarioId` **ou** cria parceiro órfão e convida depois.

#### Convite de equipe (portal, autenticado)

| Ação     | Método                                                  | Quem                                                   |
| -------- | ------------------------------------------------------- | ------------------------------------------------------ |
| Convidar | `POST /parceiro/portal/equipe/convites?parceiroId=`     | `DONO`                                                 |
| Aceitar  | `PATCH /parceiro/portal/equipe/convites/aceitar`        | Convidado (`parceiroId` **obrigatório** no body/query) |
| Remover  | `DELETE /parceiro/portal/equipe/:usuarioId?parceiroId=` | `DONO` (não pode remover último DONO → `409`)          |

Body do convite:

```json
{
  "email": "operador@empresa.com",
  "papel": "OPERADOR"
}
```

Papéis: `DONO` | `OPERADOR`. Só `DONO` gerencia equipe, PIX e saque.

### 5.5 Auditoria (admin)

| Método                                   | Uso                              |
| ---------------------------------------- | -------------------------------- |
| `GET /parceiro/auditoria/fila?status=`   | Fila de credenciamento           |
| `POST /parceiro/:id/auditoria/aprovar`   | Aprovar (exige ≥1 DONO ativo)    |
| `POST /parceiro/:id/auditoria/rejeitar`  | Body `{ motivo }` (mín. 3 chars) |
| `POST /parceiro/:id/auditoria/suspender` | Body `{ motivo }`                |

Status: `PENDENTE` | `APROVADO` | `REJEITADO` | `SUSPENSO`.

Para parceiros **não operáveis** (`PENDENTE`/`REJEITADO`/`SUSPENSO` ou `ativo=false`): cupons somem do app tutor; mutações de equipe retornam `409 Parceiro não operável`.

### 5.6 Wizard sugerido — Admin “Novo parceiro”

| Etapa         | Conteúdo                                           |
| ------------- | -------------------------------------------------- |
| 1 — Empresa   | Nome, CNPJ (opcional), logo                        |
| 2 — Dono      | Buscar usuário por email **ou** criar conta inline |
| 3 — Comercial | `comissaoPercentual` (opcional; default 5%)        |
| 4 — Revisão   | Resumo + criar                                     |

Pós-criação: exibir `codigoIndicacao` e link (`GET /parceiro/portal/indicacao` quando logado como dono).

### 5.7 Wizard sugerido — Portal do parceiro (pós-login)

| Área                    | Rotas principais                     |
| ----------------------- | ------------------------------------ |
| Dashboard               | `GET /parceiro/portal/dashboard`     |
| Status / credenciamento | `GET /parceiro/portal/status`        |
| Indicação (link + QR)   | `GET /parceiro/portal/indicacao`     |
| Cupons e resgates       | `GET .../cupons`, `GET .../resgates` |
| Equipe                  | convites / aceite / remoção          |
| Carteira (Parte 4)      | `GET .../carteira`, saques, PIX      |

**Multi-parceiro:** se o usuário é membro de 2+ empresas, **toda** rota do portal exige `?parceiroId=`; omitir → `400`.

---

## 6. Fluxo C — Veterinário + Parceiro na mesma conta (vet autônomo)

Caso frequente: profissional é **ao mesmo tempo** operador clínico e parceiro comercial.

**Sequência recomendada no admin:**

1. `POST /usuario` com bloco `veterinario` (e **sem** `tutor`).
2. `POST /parceiro` com `donoUsuarioId` = id do passo 1.
3. Opcional: `comissaoPercentual` negociado por parceiro.

No login:

- JWT terá `veterinarioId`.
- Membership de parceiro é resolvida server-side.
- UI web pode ter **seletor de contexto**: “Painel clínico” vs “Portal parceiro” (produto ainda em aberto — [regras.md §11.2](NOVAS-IMPLENTAÇÕES/regras.md)).

---

## 7. Autenticação e sessão (compartilhado)

### 7.1 Login

`POST /auth/login`

```json
{
  "email": "dra.maria@clinica.com",
  "senha": "Senha@1"
}
```

Alternativa: login por **CPF** (quem não tem CPF usa email).

### 7.2 JWT (`req.user`)

| Claim                    | Uso no web                                               |
| ------------------------ | -------------------------------------------------------- |
| `userId`                 | Identidade da conta                                      |
| `email`, `nome`          | Header / perfil                                          |
| `veterinarioId`          | Habilita rotas do painel clínico                         |
| `tutorId`, `tutorActive` | Ignorar no foco vet/parceiro (salvo conta híbrida)       |
| `isSystemAdmin`          | Habilita CMS admin (`POST /parceiro`, auditoria, saques) |

**Não vem no token:** `parceiroId`, papel `DONO`/`OPERADOR` — derivados por query de membership.

### 7.3 Recuperação de senha

Fluxo público em 3 etapas:

1. `POST /auth/recovery-password` — envia PIN por email.
2. `POST /auth/verify-recovery-pin`
3. `POST /auth/reset-password` — com `reset_token` (JWT 10 min).

O painel web deve reutilizar as mesmas regras de força de senha do cadastro.

### 7.4 Inativação de perfil

- Conta banida (`Usuario.ativo=false`): login bloqueado.
- Perfil vet/tutor inativo: login funciona; UI trata reativação via `POST /users/me/reactivate`.

---

## 8. Clínica (contexto, cadastro ainda limitado)

O app lista clínicas (`GET /clinica`, `GET /clinica/search`) com campos como `nome`, `endereco`, `cidade`, `especialidades`, `avaliacao`.

No backend existe modelagem de **equipe de clínica** (`ClinicasEquipe`) espelhando o padrão do parceiro, mas o **service de clínica ainda é stub** — cadastro/gestão de clínica no web admin está previsto na **Fase 5** do [GUIA-WEB-ADMIN-VETERINARIO.md](GUIA-WEB-ADMIN-VETERINARIO.md) (profissionais, salas, horários).

**Para este guia de cadastro:** trate clínica como **módulo futuro**; o cadastro imediato é `Usuario` + `veterinario` e/ou `Parceiro`.

---

## 9. Mapa de rotas (cadastro e onboarding)

### Públicas (sem token)

| Método | Rota                        | Uso                                    |
| ------ | --------------------------- | -------------------------------------- |
| `POST` | `/usuario`                  | Signup                                 |
| `GET`  | `/usuario/verificar`        | Disponibilidade `?email=` e/ou `?cpf=` |
| `POST` | `/auth/login`               | Login                                  |
| `POST` | `/auth/refresh`             | Renovar sessão                         |
| `POST` | `/auth/recovery-password`   | Esqueci senha                          |
| `POST` | `/auth/verify-recovery-pin` | Validar PIN                            |
| `POST` | `/auth/reset-password`      | Nova senha                             |

### Admin (JWT + `isSystemAdmin`)

| Método     | Rota                        | Uso                                   |
| ---------- | --------------------------- | ------------------------------------- |
| `POST`     | `/parceiro`                 | Criar parceiro                        |
| `GET`      | `/parceiro/auditoria/fila`  | Fila de credenciamento                |
| `POST`     | `/parceiro/:id/auditoria/*` | Aprovar / rejeitar / suspender        |
| `GET/POST` | `/admin/parceiro/*`         | Saques, ajustes de carteira (Parte 4) |

### Portal parceiro (JWT + membership ativa)

Prefixo: `/parceiro/portal/*` — ver seção 5.7 e [frontend.md §5](NOVAS-IMPLENTAÇÕES/frontend.md).

### Autenticado — usuário

| Método  | Rota                                 | Uso                                         |
| ------- | ------------------------------------ | ------------------------------------------- |
| `GET`   | `/usuario/:id`                       | Dados básicos                               |
| `GET`   | `/usuario/allInformations/:id`       | Perfil completo (incl. `veterinarioPerfil`) |
| `PATCH` | `/usuario/:id`                       | Atualizar perfil                            |
| `POST`  | `/auth/reset-password-authenticated` | Trocar senha logado                         |

---

## 10. Validações e erros (checklist implementação)

### 10.1 Disponibilidade

- `GET /usuario/verificar?email=x` → `409` se email já existe.
- `GET /usuario/verificar?cpf=x` → `409` se CPF já existe.
- Ao editar CPF: só quando ainda não há CPF salvo (read-only depois).

### 10.2 Senha

Espelhar o app (`register.tsx`):

- Mínimo 6 caracteres.
- Pelo menos 1 número, 1 letra maiúscula, 1 caractere especial.
- Exibir checklist dos requisitos em tempo real (padrão de feedback do projeto web).

### 10.3 Envelope e erros

- Sucesso: `response.data.data`.
- Erro: `{ statusCode, message, error }` — usar `message` no feedback ao usuário; não confiar só em status HTTP.
- ValidationPipe: campos não declarados no DTO → `400` (`forbidNonWhitelisted`). Ao adicionar campos novos no CMS, o DTO da API precisa declará-los.

### 10.4 Parceiro — erros frequentes

| Status | Situação                                                                |
| ------ | ----------------------------------------------------------------------- |
| `400`  | `parceiroId` obrigatório com múltiplas memberships                      |
| `403`  | Sem membership / não é DONO na ação                                     |
| `404`  | Usuário do convite não existe; convite pendente não encontrado          |
| `409`  | Nome/CNPJ duplicado; último DONO; parceiro não operável; cupom esgotado |

---

## 11. Telas recomendadas no painel web

### 11.1 Superfície Admin (CMS)

1. **Usuários → Novo veterinário** — Fluxo A (wizard 4 etapas).
2. **Parceiros → Novo parceiro** — Fluxo B (wizard empresa + dono).
3. **Parceiros → Fila de auditoria** — Para futuro self-signup `PENDENTE`.
4. **Parceiros → Detalhe** — Status, equipe, código de indicação, cupons, comissão %.
5. **Usuários → Detalhe** — Perfis acumulados (vet / parceiro / admin).

### 11.2 Superfície Portal do Parceiro

1. **Login** — Mesma tela de auth; após login, detectar memberships.
2. **Seletor de empresa** — Se N > 1 parceiro.
3. **Onboarding pós-primeiro-login** — Completar PIX, ver código de indicação, convidar equipe.
4. **Bloqueio por auditoria** — Se `podeOperar=false`, exibir `motivoAuditoria` e desabilitar ações.

### 11.3 Superfície Painel Veterinário (pós-cadastro)

Não é cadastro, mas completa o onboarding:

1. Completar CRMV/foto se criado pelo admin com dados mínimos.
2. Redirecionar para dashboard clínico ([GUIA-WEB-ADMIN-VETERINARIO.md](GUIA-WEB-ADMIN-VETERINARIO.md)) — módulos e rotas funcionais; visual conforme o DS do projeto web.

---

## 12. O que NÃO implementar neste escopo

| Item                                                       | Motivo                                       |
| ---------------------------------------------------------- | -------------------------------------------- |
| Cadastro de tutor / pet                                    | Produto mobile; fora do foco                 |
| `codigoIndicacao` no signup de vet/parceiro                | É código do parceiro para captar **tutores** |
| Trial Freemium no cadastro vet                             | Efeito do bloco `tutor` no `POST /usuario`   |
| Login separado para parceiro                               | Não existe na API                            |
| Gestão completa de clínica                                 | Stub no backend; Fase 5 do guia clínico      |
| Auto-cadastro público de parceiro                          | Decisão de produto em aberto                 |
| Enviar `parceiroId`/`userId` no body de rotas autenticadas | Anti-pattern de segurança                    |

---

## 13. Cenários de teste (QA)

### Veterinário

- [ ] Criar vet só com `veterinario` (sem `tutor`) → login → JWT com `veterinarioId`, sem `tutorId`.
- [ ] Email duplicado → erro inline antes do submit.
- [ ] Senha fraca → bloqueio com checklist.
- [ ] Editar CRMV/foto via `PATCH /usuario/:id`.
- [ ] Login por email após cadastro sem CPF.

### Parceiro

- [ ] Admin cria parceiro com `donoUsuarioId` → dono acessa portal.
- [ ] Admin cria parceiro órfão → convite → aceite → dashboard ok.
- [ ] Convidar OPERADOR; DONO remove membro (não o último DONO).
- [ ] Parceiro `SUSPENSO` → `podeOperar=false`; convites bloqueados.
- [ ] Usuário com 2 parceiros sem `?parceiroId=` → `400`.
- [ ] `GET /parceiro/portal/indicacao` retorna link + QR quando APROVADO.

### Híbrido

- [ ] Mesma conta com `veterinarioId` + membership DONO → alternar contextos sem logout.

---

## 14. Referência rápida — payloads

### Tutor (app mobile — não implementar no web focado vet)

```json
{
  "email": "tutor@email.com",
  "nome": "Ana",
  "senha": "Senha@1",
  "ativo": true,
  "tutor": { "foto": "https://.../new_user.jpeg" },
  "codigoIndicacao": "ABC2345678"
}
```

### Veterinário (painel web)

```json
{
  "email": "vet@clinica.com",
  "nome": "Dr. João",
  "senha": "Senha@1",
  "ativo": true,
  "veterinario": {
    "crmv": "CRMV-SP 12345",
    "especialidade": "Dermatologia",
    "foto": "https://.../avatar.jpeg"
  }
}
```

### Parceiro (admin CMS)

```json
{
  "nome": "Pet Shop Amigo",
  "logoUrl": "https://.../logo.png",
  "cnpj": "12345678000199",
  "donoUsuarioId": "uuid-usuario",
  "comissaoPercentual": 5
}
```

---

## 15. Próximos passos de produto (em aberto)

1. **Auto-cadastro de parceiro** com `statusAuditoria=PENDENTE` antes de operar.
2. **Signup público de veterinário** (self-service) vs só admin.
3. **Onde o parceiro opera** — só portal web ou também app (rotas já aceitam ambos).
4. **Cadastro de clínica + equipe** (`ClinicasEquipe`) integrado ao painel vet.
5. **Vet com conta no compartilhamento prestador** — follow-up da Parte 1 do épico.

---

## Change Log

| Data       | Versão | Mudança                                                                                                                   |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-01 | 1.0    | Criação a partir da análise do app (`register.tsx`, auth, services), specs de cadastro e épico parceiro/regras de negócio |
| 2026-07-01 | 1.1    | Design/UI removido do escopo; painel web segue o DS do projeto de destino                                                 |
