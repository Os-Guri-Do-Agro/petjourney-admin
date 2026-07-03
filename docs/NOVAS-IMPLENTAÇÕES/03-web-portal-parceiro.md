# 03 — Web / Portal do Parceiro (plataforma nova, B2B)

Superfície: **portal logado do parceiro** (web), em `web.` / `admin.petjourney.health`. **Não é o app do tutor.**
Auth: `Bearer {token}` + **ParceiroGuard** (o usuário tem que ser membro **ACEITO e ativo** de um parceiro).
Envelope: `response.data.data`. **Todo dinheiro em centavos** (÷100 pra exibir).

Cobre 3 features:
- **A. Portal base** (P3): dashboard, status, equipe, indicação, cupons/resgates
- **B. Carteira e saque** (P4)
- **C. Modos de participação** (P5): solicitar AFILIADO / PARTICIPATIVO

### Regras transversais (valem pra todas as telas)
- **`?parceiroId=<id>` é obrigatório se o usuário é membro de 2+ parceiros** (senão **400**). Com 1 só, pode omitir.
- **Papel:** ações de gestão exigem **`DONO`**; `OPERADOR` só visualiza. O `data` traz o `papel`.
- Erros por **statusCode + significado** (mensagem é string, não chave).

---

## A. Portal base (P3) — prefixo `/parceiro/portal`

### Telas
1. **Dashboard** · 2. **Status/credenciamento** · 3. **Equipe** · 4. **Indicação** (código + link + QR) · 5. **Cupons** · 6. **Resgates**.

### Rotas
| Tela | Rota | Resposta (`data`) |
|---|---|---|
| Dashboard | `GET /parceiro/portal/dashboard` | `{ parceiro:{id,nome,logoUrl,statusAuditoria,motivoAuditoria,cnpj}, papel, totais:{cuponsAtivos,resgatesTotal,resgatesUltimos30d} }` |
| Status | `GET /parceiro/portal/status` | `{ statusAuditoria, statusAfiliado, statusParticipativo, motivoAuditoria?, auditadoEm?, podeOperar }` |
| Indicação | `GET /parceiro/portal/indicacao` | `{ codigoIndicacao, link, qrCodeDataUrl, podeIndicar, aviso? }` |
| Cupons | `GET /parceiro/portal/cupons?cursor=&limit=` | `{ data: CupomParceiro[], meta:{proximoCursor?} }` |
| Resgates | `GET /parceiro/portal/resgates?cursor=&limit=` | `{ data: ResgateParceiro[], meta:{proximoCursor?} }` |

### Fluxo — credenciamento (o gate de tudo)
```
Login → GET /parceiro/portal/status
  statusAuditoria == 'APROVADO' && podeOperar → libera o portal
  senão → tela "cadastro em análise" (bloqueia ações; mostra motivoAuditoria se REJEITADO/SUSPENSO)
```
> Enquanto **não** aprovado, `podeIndicar=false` e a indicação vem com `aviso` ("cadastro em análise…").

### Fluxo — indicação
```
GET /parceiro/portal/indicacao → { codigoIndicacao, link, qrCodeDataUrl, podeIndicar, aviso? }
  exibe o código (~10 chars base32), o link pronto (app.petjourney.health/r/{codigo}) e o QR (data URL PNG; pode vir null)
  se podeIndicar=false → mostra o aviso, não incentiva o compartilhamento
```
O **consumo** desse link (tutor se cadastra) e a **comissão** são a Parte 4 (carteira).

### Fluxo — equipe (DONO)
```
Convidar: POST /parceiro/portal/equipe/convites { email, papel: 'DONO'|'OPERADOR' }  (exige DONO + parceiro operável)
  409 'Parceiro nao operavel' | 'Parceiro ja tem esse membro' ; 404 usuário inexistente
Aceitar (o convidado, ainda PENDENTE, FORA do guard): PATCH /parceiro/portal/equipe/convites/aceitar  (parceiroId OBRIGATÓRIO aqui)
Remover: DELETE /parceiro/portal/equipe/:usuarioId  (DONO) — 204; 409 se for o ÚLTIMO DONO
```

### Cupons / Resgates
- `CupomParceiro`: `{ codigo, titulo, descontoPercentual, categoria, validoAte, ativo, usoUnico, totalResgates, usosRestantes? }`.
- `ResgateParceiro`: `{ resgateId, cupomCodigo, canal, descontoPercentualSnapshot?, resgatadoEm }` — **sem PII do tutor** (por design).
- Paginação **cursor-based** (`meta.proximoCursor`).

---

## B. Carteira e saque (P4) — prefixo `/parceiro/portal`

> ⚠️ **Gate:** enquanto `statusAfiliado != ATIVO` (ou auditoria não operável), **todas** as rotas de carteira/saque
> retornam **409 `AFILIADO_NAO_ATIVO`** (exceto `GET /saques/:id`). A tela deve mostrar o CTA "solicitar afiliado" (ver §C).

### Telas
1. **Carteira** (saldo total, sacável, PIX) · 2. **Extrato** · 3. **Solicitar saque** · 4. **Saques** (lista + detalhe).

### Rotas
| Tela | Rota | Body | Resposta |
|---|---|---|---|
| Carteira | `GET /parceiro/portal/carteira` | — | `Carteira` |
| Extrato | `GET /parceiro/portal/carteira/extrato?cursor=&limit=` | — | `{ items: Transacao[], nextCursor }` |
| Cadastrar PIX | `PATCH /parceiro/portal/carteira/pix` | `{ chavePix }` | `{ parceiroId, chavePix }` |
| Solicitar saque | `POST /parceiro/portal/saques` | `{ valorCentavos }` | `{ id, valorCentavos, status:'PENDENTE', createdAt }` |
| Lista saques | `GET /parceiro/portal/saques` | — | `SaqueResumo[]` |
| Detalhe saque | `GET /parceiro/portal/saques/:id` | — | `SaqueDetalhe` |

```ts
Carteira = { saldoTotalCentavos, saldoSacavelCentavos, chavePix|null, totalSacadoCentavos, bloqueadoParaSaque }
```

### Fluxo — solicitar saque (DONO)
```
Pré-condições (a UI valida antes, o backend valida em ordem):
  valorCentavos >= 5000 (R$50)  · chavePix cadastrada · sem revisão antifraude · saldo não-negativo · valor <= saldoSacavelCentavos
POST /parceiro/portal/saques { valorCentavos }
  → 201 saque PENDENTE (débito atômico já aplicado)
Erros: 400 (valor < mínimo / PIX ausente / saldo insuficiente / saldo negativo) · 403 (saque bloqueado p/ revisão)
```
- **Bloqueie a UI de saque** quando `bloqueadoParaSaque=true`, `saldoSacavelCentavos=0` (tudo em hold), ou `chavePix=null`.
- **Hold de 14 dias** por crédito (chargeback) já está refletido em `saldoSacavelCentavos` (≠ saldoTotal).
- O saque é **liquidado manualmente pelo admin** (CMS) — o status vira PAGO/FALHA lá. Aqui só acompanha.
- Ciclo (corte dia 27, pagamento até dia 5) é **orientacional** (mostre como aviso).

### Detalhes
- **Tudo em centavos** — divida por 100 pra exibir (`5000` → `R$ 50,00`).
- `Transacao`: `{ tipo: CREDITO_COMISSAO|ESTORNO|DEBITO_SAQUE|AJUSTE, valorCentavos (negativo=débito), periodicidade?, origem?, createdAt }`.
- Se `COMISSAO_INDICACAO_ENABLED=false`, a carteira fica **zerada** mesmo com indicações — avise o parceiro (não é bug).

---

## C. Modos de participação (P5) — solicitar (DONO)

**O quê:** o DONO pede pra ativar **AFILIADO** (destrava carteira/comissão) ou **PARTICIPATIVO** (só selo).
O admin decide no CMS. Prefixo: `/parceiro/portal`.

| Ação | Rota | Auth |
|---|---|---|
| Solicitar modo | `POST /parceiro/portal/modos/:modo/solicitar` | JWT + ParceiroGuard (**DONO**) |
| Ler status | `GET /parceiro/portal/status` | expõe `statusAfiliado` / `statusParticipativo` |

`:modo` = `afiliado` | `participativo` (outro → 400). `StatusModoParceiro = NAO_SOLICITADO|SOLICITADO|ATIVO|REJEITADO|SUSPENSO`.

### Fluxo — "página de vantagens"
```
GET /parceiro/portal/status → { statusAfiliado, statusParticipativo, ... }
  statusAfiliado:
    NAO_SOLICITADO/REJEITADO/SUSPENSO → botão "Quero ser afiliado" → POST /modos/afiliado/solicitar
    SOLICITADO → "em análise"
    ATIVO → carteira destravada (some o gate 409)
  idem participativo (mas participativo não destrava nada — só selo)
Erros do solicitar: 403 (não é DONO) · 409 'Parceiro nao operavel' (auditoria != APROVADO) · 409 'Modo ja solicitado ou ativo'
```

---

## Checklist do portal
- [ ] `?parceiroId` quando 2+ parceiros (senão 400); gatekeep de ações por `papel === 'DONO'`.
- [ ] Gate de credenciamento: `GET /status` → só opera se `APROVADO && podeOperar`.
- [ ] Indicação: exibir `codigoIndicacao` + `link` + `qrCodeDataUrl`; respeitar `podeIndicar`/`aviso`.
- [ ] Equipe: convidar/aceitar (parceiroId no aceite)/remover (409 último dono).
- [ ] Carteira/extrato/saque em **centavos**; paginação `nextCursor`.
- [ ] Saque: bloquear por `bloqueadoParaSaque` / `saldoSacavelCentavos=0` / `chavePix=null`; mínimo R$50.
- [ ] Gate `AFILIADO_NAO_ATIVO` (409) → CTA "solicitar afiliado".
- [ ] Modos: página de vantagens lendo `statusAfiliado/statusParticipativo`.
