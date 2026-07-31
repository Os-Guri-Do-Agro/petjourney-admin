# 03 — Integração no CMS-Backoffice + Portal do Parceiro

Público: time do **portal do parceiro** e do **CMS-backoffice (admin)**. Leia o
[README](README.md) primeiro (envelope + shape das métricas).

Dois consumidores logados (web), papéis diferentes:

- **Portal do parceiro** — o parceiro (petshop, banho e tosa, farmácia, vet
  autônomo, etc.) vê o **próprio** QR de indicação e as métricas de leitura dele.
- **CMS-backoffice (admin)** — o admin vê métricas por recurso (ex.: de um pet).

---

## Parte A — Portal do Parceiro

### 1. Trocar a exibição do QR de indicação ⚠️ (breaking)

**Por quê:** o endpoint mudou de forma. Antes devolvia `qrCodeDataUrl` (um PNG
base64 estático, sem métrica). Agora devolve `qrCode` + `qrImageUrl` (o QR
rastreável do WFQR). **Se o front não trocar, a imagem some.**

```ts
// GET /parceiro/portal/indicacao          (JWT do parceiro)
// GET /parceiro/portal/indicacao?parceiroId=xxx   (se o usuário tem +1 parceiro)
const { data } = await api.get('/parceiro/portal/indicacao')
const ind = data.data
// { codigoIndicacao, link, qrCode, qrImageUrl, podeIndicar, aviso? }
```

```html
<!-- ANTES:  <img :src="ind.qrCodeDataUrl">  (removido)          -->
<!-- AGORA:                                                       -->
<img :src="ind.qrImageUrl" alt="QR de indicação" width="200" />
<p>Seu link: {{ ind.link }}</p>
```

- **Parceiro APROVADO e ativo:** `codigoIndicacao` e `link` sempre vêm;
  `qrImageUrl` pode ser `null` (WFQR estava fora): esconda a imagem, mas mostre
  o `link` e o código.
- **⚠️ Parceiro NÃO aprovado (pendente/rejeitado/suspenso) — mudou 2026-07-29:**
  a resposta vem com `codigoIndicacao`, `link`, `qrCode` e `qrImageUrl` todos
  **`null`**, `podeIndicar: false` e o `aviso`. **Não existe QR/código antes da
  aprovação** (decisão de segurança: negócio não auditado não imprime QR da
  marca, e cadastros feitos antes da aprovação não seriam atribuídos). O front
  mostra o **estado de espera** com o `aviso`, sem tela de QR.
  - O `aviso` agora é **por status** (em análise / recusado / suspenso) — exiba
    o texto que vier, sem copy própria.
  - **Suspensão revoga o QR físico:** quando o admin suspende um parceiro, o
    backend também desativa o redirect do QR já impresso (no WFQR) e religa na
    reaprovação. Nada a fazer no front — é automático; citado aqui só pra
    ninguém estranhar QR de suspenso "parar de funcionar".

### 2. Mostrar as métricas de leitura

**Por quê:** é o valor pro parceiro — "quantas pessoas escanearam meu QR e quando".

```ts
// GET /parceiro/portal/indicacao/metricas   (JWT do parceiro; ?parceiroId= se +1)
const { data } = await api.get('/parceiro/portal/indicacao/metricas')
const m = data.data
// { qrCode, scanCount, byDay: [{day,count}], recent: [{at, userAgent}] }
```

Sugestão de UI:

- **`scanCount`** — número grande ("42 leituras").
- **`byDay`** — gráfico de linha/barra (data × contagem).
- **`recent`** — lista das últimas leituras (data + dispositivo). **Não há IP** (LGPD).

Trate `503` (`QR_INDISPONIVEL`): mostre "métricas indisponíveis, tente mais tarde"
sem quebrar o dashboard.

### 3. Parceiro com mais de um negócio

**Por quê:** um `Usuario` pode ser dono/operador de vários parceiros; sem escolher,
a API responde `400`.

Quando o usuário tem >1 parceiro, mande `?parceiroId=<id>` nas duas rotas acima
(pegue os ids do dashboard: `GET /parceiro/portal/dashboard`).

---

## Parte B — CMS-Backoffice (admin)

### 4. Métricas de QR por recurso (admin)

**Por quê:** o admin consegue auditar a leitura de qualquer pet (o guard de admin
bypassa o dono).

```ts
// GET /pet/:id/qr/metricas   com o JWT de um admin (isSystemAdmin)
const { data } = await api.get(`/pet/${petId}/qr/metricas`)
// mesmo shape: { scanCount, byDay, recent }
```

O mesmo vale pras métricas do parceiro/tutor via as rotas dos donos — o admin não
tem uma rota agregada dedicada ainda (ver passo 5).

### 5. Dashboard admin agregado — **ainda não existe (follow-up)**

**Por quê registrar aqui:** pra o time não tentar consumir algo que não existe e
pra saber o que pedir ao backend.

Hoje **não há** endpoint que liste "todos os QRs da empresa + totais" num só lugar
(isso vive no painel do próprio WFQR, que usa o token — que é **backend-only**,
nunca exposto ao CMS). Se o CMS precisar dessa visão consolidada, é uma tarefa de
backend nova (ex.: `GET /admin/qr/overview`). Abra a demanda referenciando a spec
[../specs/qr-tracking-wfqr.md](../specs/qr-tracking-wfqr.md) (Pergunta em Aberto 4).

> **Nunca** coloque o `WFQR_TOKEN` no front (CMS incluso). Ele dá acesso a todos os
> QRs da empresa. Todo dado de QR pro front passa pela nossa API.

---

## Checklist de verificação (marque conforme testa)

### Portal do parceiro — QR

- [ ] O QR exibido vem de `qrImageUrl` (URL), **não** mais de `qrCodeDataUrl` — _teste: inspecionar o `<img src>`; deve ser `srhub.up.railway.app/q/image/...`._
- [ ] Com `qrImageUrl: null`, a tela não quebra e ainda mostra `link` + `codigoIndicacao`.
- [ ] Parceiro não-aprovado (`podeIndicar:false`) mostra o **estado de espera** com o `aviso` e **sem** QR/código/link (vêm `null` — gate 2026-07-29). Métricas para não-aprovado respondem **409**.
- [ ] Usuário com >1 parceiro consegue escolher e as rotas recebem `?parceiroId=`.

### Portal do parceiro — métricas

- [ ] `scanCount`, gráfico `byDay` e lista `recent` renderizam de `GET /parceiro/portal/indicacao/metricas`.
- [ ] A lista de leituras recentes **não mostra IP** (só data + user-agent) — _por quê: LGPD; se apareceu IP, tem bug no front (o backend não manda)._
- [ ] Escanear o QR de indicação (câmera) e recarregar as métricas mostra o `scanCount` **subindo** — _teste ponta a ponta._
- [ ] Resposta `503` mostra "indisponível" sem derrubar o dashboard.

### CMS admin

- [ ] Admin consegue ver `GET /pet/:id/qr/metricas` de qualquer pet — _por quê: bypass de admin._
- [ ] Confirmado que o `WFQR_TOKEN` **não** aparece em nenhum lugar do front do CMS.
- [ ] Demanda do dashboard agregado (passo 5) registrada como follow-up, se necessária.
