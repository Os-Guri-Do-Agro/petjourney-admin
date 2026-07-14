# Guia — Solicitar afiliação / modos de participação (parceiro)

**Status:** guia de implementação (contrato + fluxos)  
**Escopo:** solicitar, acompanhar e (no CMS) decidir os modos **AFILIADO** e **PARTICIPATIVO** de um `Parceiro` já existente.  
**Público:** portal web do parceiro + CMS admin (e qualquer cliente que espelhe o app).  
**Fora de escopo:** criar a empresa parceira (`POST /parceiro` — só admin); lógica de comissão/saque em si (Parte 4); perks operacionais do modo Participativo.

**Design e UI:** fora deste guia. Aqui: contrato de API, pré-condições, estados e fluxo funcional.

**Documentos relacionados:**
- Spec canônica (mais detalhada): [NOVAS-IMPLENTAÇÕES/05-modos-participacao-frontend.md](NOVAS-IMPLENTAÇÕES/05-modos-participacao-frontend.md)
- Cadastro da empresa / equipe: [GUIA-WEB-CADASTRO-VETERINARIO-PARCEIRO.md](GUIA-WEB-CADASTRO-VETERINARIO-PARCEIRO.md) §5
- Envelope, auth, centavos: [NOVAS-IMPLENTAÇÕES/frontend.md](NOVAS-IMPLENTAÇÕES/frontend.md)
- Comissões / carteira (pós-afiliado ativo): [NOVAS-IMPLENTAÇÕES/regras.md](NOVAS-IMPLENTAÇÕES/regras.md) §9
- Implementação de referência no app: `services/parceiro/parceiro-service.ts`, `app/screens/parceiro/programas-participacao.tsx`, `src/features/parceiro/components/ModoParticipacaoCard.tsx`

---

## 1. Resumo (não confundir os conceitos)

| Conceito | O que é | Como nasce |
|----------|---------|------------|
| **Parceiro (empresa)** | Entidade comercial (`Parceiro`) + membership (`ParceiroEquipe`) | **Admin CMS** via `POST /parceiro` (+ dono/equipe) |
| **Auditoria** (`statusAuditoria`) | Credenciamento da empresa: PENDENTE / APROVADO / REJEITADO / SUSPENSO | Admin no cadastro; `podeOperar` = APROVADO e ativo |
| **Modo AFILIADO** (`statusAfiliado`) | Opt-in: destrava **Carteira / comissões / saque PIX** | DONO solicita → admin aprova |
| **Modo PARTICIPATIVO** (`statusParticipativo`) | Opt-in: selo de status (perks fora do sistema) | Idem, independente do afiliado |

**Solicitar modo** é o caminho do usuário para entrar na fila (afiliado/participativo). Quem ainda
não tem membership operacional chega em Programas e chama
`POST /parceiro/portal/modos/{modo}/solicitar`; o admin também pode vincular a empresa manualmente
(`POST /parceiro`). Os dois modos são **independentes**: um pode estar `ATIVO` e o outro
`NAO_SOLICITADO`.

---

## 2. Pré-condições (portal)

Para `POST .../modos/{modo}/solicitar`:

1. `Authorization: Bearer` válido.
2. Preferencialmente membro **ACEITO e ativo** de um parceiro (`ParceiroGuard`).
3. Papel **DONO** quando já há membership (OPERADOR → **403**; UI deve esconder o botão).
4. Parceiro **operável**: `statusAuditoria === APROVADO` e `podeOperar === true` (senão **409**
   `Parceiro nao operavel`) — **exceto** o fluxo de entrada sem vínculo, em que a UI ainda oferece
   Solicitar e trata 403/409 com mensagem clara.
5. `?parceiroId=` **obrigatório** se o usuário tem **2+** parceiros; com 1 pode omitir; omitir com
   N>1 → **400**.

Sem membership operacional: outras rotas do portal respondem **403/404**, mas a tela **Programas**
permanece acessível para solicitar `afiliado` / `participativo`.

---

## 3. Enum de status do modo

Casar **literalmente**:

```ts
type StatusModoParceiro =
  | "NAO_SOLICITADO" // nunca pediu (inicial)
  | "SOLICITADO"     // aguardando admin
  | "ATIVO"          // aprovado e valendo
  | "REJEITADO"      // admin recusou (motivo no CMS; não exposto no GET /status nesta versão)
  | "SUSPENSO";      // admin suspendeu (idem)

type ModoParticipacao = "afiliado" | "participativo";
```

### 3.1 Máquina de estados (cada modo)

```
NAO_SOLICITADO ──(DONO solicita)──▶ SOLICITADO ──(admin aprova)──▶ ATIVO
       ▲                                │                            │
       │                          (admin rejeita)             (admin suspende)
       │                                ▼                            ▼
       └──────────────────────────  REJEITADO                   SUSPENSO
         (DONO pode solicitar de novo a partir de
          NAO_SOLICITADO / REJEITADO / SUSPENSO)
```

**Não** solicitar de novo se já está `SOLICITADO` ou `ATIVO` → **409** `Modo ja solicitado ou ativo`.

---

## 4. Endpoints — portal do parceiro

Envelope de sucesso: `{ statusCode, message, data }` → corpo útil em `data`.  
Erro: trate por **statusCode + significado**; `message` é string, não chave estável.

### 4.1 Ler status (base da tela)

```http
GET /parceiro/portal/status?parceiroId={id}
```

```ts
type ParceiroPortalStatus = {
  statusAuditoria: "PENDENTE" | "APROVADO" | "REJEITADO" | "SUSPENSO";
  statusAfiliado: StatusModoParceiro;
  statusParticipativo: StatusModoParceiro;
  motivoAuditoria?: string | null; // motivo da AUDITORIA da empresa, não do modo
  auditadoEm?: string | null;
  podeOperar: boolean; // APROVADO && ativo
};
```

> Nesta versão **não** há campo de motivo de rejeição/suspensão do **modo** no `/status`. Só o motivo de auditoria da empresa.

Complementar (papel, nome, totais): `GET /parceiro/portal/dashboard` — no app, `getPortalContext()` faz status + dashboard em paralelo.

### 4.2 Solicitar modo (DONO)

```http
POST /parceiro/portal/modos/{modo}/solicitar?parceiroId={id}
```

`{modo}` = `afiliado` | `participativo`. Body: objeto JSON vazio `{}` (Nest exige body quando
`Content-Type: application/json`).

Resposta **201** (`data`):

```ts
{ modo: "afiliado" | "participativo"; status: "SOLICITADO" }
```

| Status HTTP | Quando | UI |
|-------------|--------|-----|
| 403 | Não é DONO | Esconder CTA; toast “só o dono pode” |
| 409 | Parceiro não operável | Aviso “cadastro em análise” / `podeOperar=false` |
| 409 | Já SOLICITADO ou ATIVO | Card já em “em análise” / “ativo” |
| 400 | `modo` inválido | Erro de integração |
| 400 | Falta `parceiroId` com N>1 | Seletor de parceiro |

---

## 5. Endpoints — admin (CMS)

Exigem SystemAdmin.

### 5.1 Fila de solicitações

```http
GET /parceiro
```

Cada parceiro traz `statusAfiliado` e `statusParticipativo`.  
**Fila = filtro no cliente** (`=== "SOLICITADO"`). Não há endpoint dedicado de fila nesta versão.

### 5.2 Decidir

```http
POST /parceiro/{id}/modos/{modo}/aprovar
POST /parceiro/{id}/modos/{modo}/rejeitar   Body: { "motivo": "..." }  // min 3 chars
POST /parceiro/{id}/modos/{modo}/suspender  Body: { "motivo": "..." }  // min 3 chars
```

- Aprovar **afiliado** → `statusAfiliado = ATIVO` + data de ativação (corte de crédito).
- Aprovar **participativo** → `statusParticipativo = ATIVO`.
- Motivo ausente ou &lt; 3 chars → **400**.
- Após ação → refetch da lista (item some da fila).

---

## 6. Fluxos

### 6.1 Parceiro — solicitar afiliado

```
Login portal (membro ACEITO)
  → GET /parceiro/portal/status (+ dashboard)
  → se podeOperar === false: banner auditoria; desabilitar Solicitar
  → se papel !== DONO: só leitura
  → CTA Solicitar (status NAO_SOLICITADO | REJEITADO | SUSPENSO)
  → POST /parceiro/portal/modos/afiliado/solicitar
  → 201 → atualizar card pra SOLICITADO (“Em análise”)
  → aguardar admin
  → (poll / refetch) statusAfiliado === ATIVO → liberar menu Carteira
```

### 6.2 Gate da Carteira (obrigatório)

Enquanto `statusAfiliado !== "ATIVO"`, rotas Parte 4 retornam **409** `AFILIADO_NAO_ATIVO`:

- `GET /parceiro/portal/carteira`
- `GET .../carteira/extrato`
- `PATCH .../carteira/pix`
- `POST/GET /parceiro/portal/saques`

**Regra de UI:** menu/aba **Carteira** só aparece se `statusAfiliado === "ATIVO"`. Caso contrário, CTA para a tela de Programas / solicitar afiliado.

### 6.3 Admin — aprovar/rejeitar

```
GET /parceiro → filtrar statusAfiliado | statusParticipativo === SOLICITADO
  → Aprovar | Rejeitar(motivo) | Suspender(motivo)
  → refetch
```

---

## 7. Tela “Programas de participação” (UX funcional)

Dois cards (Afiliado e Participativo). Badge + CTA:

| Status do modo | Badge | CTA DONO | CTA OPERADOR |
|----------------|-------|----------|--------------|
| `NAO_SOLICITADO` | Não ativo | **Solicitar** | — |
| `SOLICITADO` | Em análise | desabilitado / “aguardando” | — |
| `ATIVO` | Ativo | afiliado → **Ir pra Carteira**; participativo → nada | — |
| `REJEITADO` | Recusado | **Solicitar de novo** | — |
| `SUSPENSO` | Suspenso | **Solicitar de novo** | — |

Copy sugerida (ajustável):

- **Afiliado:** comissão por indicação que vira assinante; carteira, saldo, saque PIX.
- **Participativo:** comunidade / perks / collabs (em breve no produto).

Após 201: atualizar o card para `SOLICITADO` (optimistic ou refetch do status).

---

## 8. Referência no app mobile (o que espelhar)

**Canônico (Parte 5) — use isto no portal:**

| Arquivo | Papel |
|---------|--------|
| `parceiro-service.solicitarModo(modo, parceiroId?)` | `POST .../modos/:modo/solicitar` |
| `parceiro-service.getStatus` / `getPortalContext` | status + dashboard |
| `app/screens/parceiro/programas-participacao.tsx` | Tela dos 2 cards |
| `ModoParticipacaoCard` | Regras de CTA (`isDono` + `podeOperar` + status) |
| `useParceiroCarteiraGate` | Menu Carteira só com afiliado `ATIVO` |
| `PartnerModesPromoBanner` | Atalho para Programas |

**Legado — não copiar como modelo de produto no portal:**

| Arquivo | Problema |
|---------|----------|
| `app/screens/parceiro/solicitar-afiliacao.tsx` + `AfiliacaoWizard` | Wizard educativo; pós-submit mostra `statusAuditoria` (empresa), não `statusAfiliado` |
| Toasts `SOLICITATION_ALREADY_EXISTS` / `ALREADY_PARTNER_MEMBER` | Reasons antigos; a Parte 5 usa 409 com mensagens de “dono” / “operavel” / “ja solicitado” |

Se `getPortalContext()` retorna `null` (sem membership), a tela de Programas no app oferece CTA para o wizard legado — no **portal web** o caminho correto é onboarding de equipe / convite / cadastro admin, **não** fingir que solicitar modo cria a empresa.

---

## 9. Checklist de implementação (portal + CMS)

**Portal**

- [ ] `GET /status` (+ `?parceiroId` quando N>1).
- [ ] Tela Programas: 2 cards com `statusAfiliado` / `statusParticipativo`.
- [ ] CTA só para **DONO**; respeitar tabela §7.
- [ ] Bloquear Solicitar se `podeOperar === false`.
- [ ] `POST .../modos/{modo}/solicitar` body vazio; tratar 403/409.
- [ ] Menu **Carteira** somente com `statusAfiliado === ATIVO`.
- [ ] Após solicitar: UI → `SOLICITADO` (refetch ou patch).

**CMS**

- [ ] Lista `GET /parceiro` filtrada por `SOLICITADO` em qualquer modo.
- [ ] Aprovar / rejeitar / suspender (motivo ≥ 3 chars).
- [ ] Refetch após decisão.
- [ ] Não misturar com tela de auditoria de cadastro (`statusAuditoria`), embora sejam rotas admin vizinhas.

---

## 10. Prompt curto (copiar para o time web)

> Implemente Programas de Participação no portal do parceiro (Parte 5). Dois modos independentes: `afiliado` e `participativo`, status `NAO_SOLICITADO | SOLICITADO | ATIVO | REJEITADO | SUSPENSO`. Ler `GET /parceiro/portal/status`; solicitar com `POST /parceiro/portal/modos/{modo}/solicitar` (body vazio, só DONO, exige `podeOperar`). Passar `?parceiroId` se o user tem 2+ parceiros. Carteira/saques só se `statusAfiliado === ATIVO` (senão 409 `AFILIADO_NAO_ATIVO`). CMS: filtrar `GET /parceiro` por SOLICITADO; aprovar/rejeitar/suspender com motivo. Isto **não** cria parceiro — cadastro da empresa é admin (`POST /parceiro`). Spec: `docs/NOVAS-IMPLENTAÇÕES/05-modos-participacao-frontend.md`. Guia: `docs/GUIA-WEB-SOLICITAR-AFILIACAO.md`.
