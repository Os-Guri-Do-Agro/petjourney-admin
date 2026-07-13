# Spec Frontend: Parte 5 — Modos de Participação do Parceiro (AFILIADO + PARTICIPATIVO)

**Status:** Backend LIVE em dev (migration aplicada, envs setadas). Pronto pra integrar.
**Criado em:** 2026-06-30
**Spec backend:** [05-modos-participacao-parceiro.md](05-modos-participacao-parceiro.md)
**Contrato geral do épico:** [frontend.md](frontend.md) (envelope, auth, erros, dinheiro em centavos)
**Plataforma alvo:** **Portal web do parceiro** (`web.`/`admin.petjourney.health`) — não o app do tutor.

> Este doc é auto-suficiente: uma IA de código pode implementar a UI de modos 100% a partir daqui. Tudo que diz respeito a envelope/auth/erros está na seção 1; o resto é específico de modos.

---

## 0. O que é a feature (em 3 linhas)

O parceiro pode ativar **2 programas opt-in independentes**, cada um com seu status:
- **AFILIADO** — quando `ATIVO`, **destrava a Carteira/Comissões** (Parte 4). É o programa de transparência/saque.
- **PARTICIPATIVO** — quando `ATIVO`, é **só um selo de status** (perks/collab/comunidade são operacionais, fora do sistema).

Fluxo: o **DONO solicita** no portal → a gente **aprova/rejeita/suspende no CMS (admin)**.

---

## 1. Convenções (vale pra todas as rotas)

- **Auth:** `Authorization: Bearer {token}`. Rotas do portal exigem JWT + ser membro **ACEITO e ativo** de um parceiro.
- **`?parceiroId=<id>`:** query param **opcional**, mas **obrigatório se o usuário é membro de 2+ parceiros**. Com 1 só, pode omitir. Com 2+ e você omite → **400** (`parceiroId obrigatorio quando ha mais de um parceiro`).
- **Papel:** ações de gestão (solicitar modo) exigem papel **DONO**. OPERADOR só vê.
- **Envelope de sucesso:** `{ statusCode, message, data }` → o corpo útil está em `response.data.data`.
- **Envelope de erro:** `{ statusCode, timestamp, path, message }` (alguns trazem `error`). Trate pelo **statusCode + significado** descrito em cada rota (as mensagens são string, não chave estável).

---

## 2. Enum de status (literal — casar exatamente)

```ts
type StatusModoParceiro =
  | 'NAO_SOLICITADO'   // nunca pediu (estado inicial)
  | 'SOLICITADO'       // pediu, aguardando admin
  | 'ATIVO'            // aprovado e valendo
  | 'REJEITADO'        // admin recusou (tem motivo)
  | 'SUSPENSO';        // admin suspendeu (tem motivo)

type Modo = 'afiliado' | 'participativo';
```

Máquina de estados (cada modo, independente):
```
NAO_SOLICITADO ──(DONO solicita)──▶ SOLICITADO ──(admin aprova)──▶ ATIVO
       ▲                                │                            │
       │                          (admin rejeita)             (admin suspende)
       │                                ▼                            ▼
       └──────────────────────────  REJEITADO                   SUSPENSO
                       (DONO pode solicitar de novo a partir de NAO_SOLICITADO/REJEITADO/SUSPENSO)
```

---

## 3. Endpoints — Portal do parceiro

### 3.1 Ler status dos modos (a base da tela)
```http
GET /parceiro/portal/status?parceiroId={id}
Authorization: Bearer {token}
```
Resposta (`data`):
```ts
{
  statusAuditoria: 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUSPENSO';
  statusAfiliado: StatusModoParceiro;        // <-- Parte 5
  statusParticipativo: StatusModoParceiro;   // <-- Parte 5
  motivoAuditoria?: string;
  auditadoEm?: string;     // ISO
  podeOperar: boolean;     // statusAuditoria APROVADO && ativo
}
```
> A tela de modos lê **só isso**. Não há endpoint que devolva o "motivo" do modo (rejeição/suspensão) ao parceiro nesta versão — se precisar exibir, é follow-up.

### 3.2 Solicitar entrada num modo (DONO)
```http
POST /parceiro/portal/modos/{modo}/solicitar?parceiroId={id}
Authorization: Bearer {token}
```
`{modo}` = `afiliado` ou `participativo`. Body: vazio.

Resposta (201, `data`):
```ts
{ modo: 'afiliado' | 'participativo'; status: 'SOLICITADO' }
```
**Pré-condição:** o parceiro precisa estar **operável** (`statusAuditoria=APROVADO` e ativo).

| Status | Quando | UI |
|---|---|---|
| 403 | usuário não é DONO | esconder/disable o botão pra OPERADOR; toast "só o dono pode" |
| 409 (`Parceiro nao operavel`) | auditoria != APROVADO | mostrar "seu cadastro ainda está em análise" |
| 409 (`Modo ja solicitado ou ativo`) | já está SOLICITADO ou ATIVO | botão já deve estar em estado "em análise"/"ativo" |
| 400 | `modo` fora de afiliado/participativo | erro de dev (não deve acontecer pela UI) |

---

## 4. Endpoints — Admin (CMS)

> Exigem `Authorization: Bearer {token}` de usuário **SystemAdmin**.

### 4.1 Listar parceiros (pra montar a fila de solicitações)
```http
GET /parceiro              # lista todos (admin)
```
Cada parceiro vem com `statusAfiliado` e `statusParticipativo`. **A "fila de modos" do CMS é montada filtrando no cliente** os parceiros com `statusAfiliado === 'SOLICITADO'` (e/ou `statusParticipativo === 'SOLICITADO'`). *(Não há endpoint dedicado de fila de modos nesta versão.)*

### 4.2 Decidir um modo
```http
POST /parceiro/{id}/modos/{modo}/aprovar
POST /parceiro/{id}/modos/{modo}/rejeitar    Body: { "motivo": "..." }   (min 3 chars)
POST /parceiro/{id}/modos/{modo}/suspender   Body: { "motivo": "..." }   (min 3 chars)
```
- **aprovar afiliado** → `statusAfiliado='ATIVO'` + grava data de ativação (corte do crédito).
- **aprovar participativo** → `statusParticipativo='ATIVO'`.
- Resposta: o objeto `Parceiro` atualizado.
- `rejeitar`/`suspender` sem `motivo` ou < 3 chars → **400**.

---

## 5. As telas (UX)

### 5.1 Tela "Programas de Participação" (parceiro logado)
Carrega `GET /parceiro/portal/status`. Mostra **2 cards** (Afiliado e Participativo). Cada card: título, descrição das vantagens (cópia estática do front), **badge de status** e **CTA conforme o status**:

| status do modo | Badge | CTA (DONO) | CTA (OPERADOR) |
|---|---|---|---|
| `NAO_SOLICITADO` | "Não ativo" | **Solicitar** | — (só vê) |
| `SOLICITADO` | "Em análise" | desabilitado ("aguardando") | — |
| `ATIVO` | "Ativo" ✓ | afiliado → **Ir pra Carteira**; participativo → nada | — |
| `REJEITADO` | "Recusado" | **Solicitar de novo** | — |
| `SUSPENSO` | "Suspenso" | **Solicitar de novo** | — |

Regras de UI:
- **OPERADOR** vê os status mas **não** vê os botões de ação (a API retorna 403; esconda proativamente).
- Se `statusAuditoria != APROVADO` (`podeOperar=false`): mostrar aviso "cadastro em análise" e **desabilitar** o Solicitar (a API rejeita com 409 mesmo).
- Após `POST .../solicitar` 201 → atualizar o card pra "Em análise" (status SOLICITADO) sem precisar refetch (ou refetch o status).

**Conteúdo dos cards (cópia sugerida — ajuste livre):**
- **Afiliado:** "Receba comissão por cada indicação que vira assinante. Acesse sua carteira, acompanhe saldo e saque via PIX."
- **Participativo:** "Faça parte da comunidade PetJourney: perks exclusivos e collabs. (Em breve.)"

### 5.2 Gate da Carteira (importante)
As rotas de carteira/saque (Parte 4: `GET /parceiro/portal/carteira`, `/carteira/extrato`, `PATCH /carteira/pix`, `POST /saques`, `GET /saques`) retornam **409 `AFILIADO_NAO_ATIVO`** enquanto `statusAfiliado != 'ATIVO'`.
→ No portal: **só mostre o menu/aba "Carteira" se `statusAfiliado === 'ATIVO'`**. Senão, leve o usuário pra tela de Programas com CTA de solicitar afiliado.

### 5.3 Tela admin (CMS) — Fila de modos
- Lista parceiros (`GET /parceiro`) filtrando `statusAfiliado === 'SOLICITADO'` ou `statusParticipativo === 'SOLICITADO'`.
- Cada item: nome do parceiro, qual modo pediu, botões **Aprovar** / **Rejeitar (com motivo)** / **Suspender (com motivo)**.
- Após a ação → refetch a lista (o item sai da fila).

---

## 6. Checklist de integração (frontend)
- [x] Service: `getStatus()` → `GET /parceiro/portal/status`; `solicitarModo(modo)` → `POST .../modos/:modo/solicitar`.
- [x] Mandar `?parceiroId` quando o usuário tem 2+ parceiros (senão 400).
- [x] Tela de Programas: 2 cards lendo `statusAfiliado`/`statusParticipativo`; CTA por status (tabela 5.1).
- [x] Botões de ação só pra **DONO** (esconder pra OPERADOR).
- [x] Bloquear "Solicitar" se `podeOperar=false`; tratar 409 (`Parceiro nao operavel` / `Modo ja solicitado ou ativo`).
- [x] Aba **Carteira** só visível com `statusAfiliado === 'ATIVO'` (senão 409).
- [ ] CMS: fila por `statusAfiliado/Participativo === 'SOLICITADO'` via `GET /parceiro`; aprovar/rejeitar/suspender (motivo min 3). **Fora deste repositório** (projeto CMS / `isSystemAdmin` — ver `docs/PORTAL_PARCEIRO.md`).
- [x] Atualizar UI após cada ação (refetch status / lista).

---

## 7. Fora do escopo desta entrega
- Endpoint dedicado de "fila de modos" no admin (hoje filtra no cliente via `GET /parceiro`).
- Exibir ao parceiro o **motivo** de rejeição/suspensão do modo (não há campo exposto no `GET /status`).
- Qualquer lógica de perks/collab do Participativo (é operacional, fora do backend).
- Deferred deep link / app — esta tela é do **portal web** do parceiro.
