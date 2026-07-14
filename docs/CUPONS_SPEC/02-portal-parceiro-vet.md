# 02 — App do Parceiro/Vet + Portal Web: a tela "validar cupom"

Público: times do **app do parceiro/vet** e do **portal web do parceiro**. Leia o
[README](README.md) primeiro (fluxo + envelope + tabela de erros).

Os dois clientes fazem **a mesma coisa** contra **o mesmo endpoint** — a única
diferença é o input:
- **App (celular):** câmera escaneia o QR do tutor → `canal: "QR"`.
- **Portal web (desktop/celular sem câmera):** balconista **digita** o código →
  `canal: "CODIGO_MANUAL"`.

> Um cliente pode oferecer os dois inputs (ex.: app com campo manual de
> fallback). O `canal` reflete **como o código foi obtido naquela validação**.

---

## Passo a passo (nesta ordem)

### 1. A chamada de validação

```ts
// POST /parceiro/portal/cupons/validar        (JWT do parceiro)
// ?parceiroId=xxx obrigatório SE o usuário for membro de 2+ parceiros
const res = await api.post(
  '/parceiro/portal/cupons/validar',
  { codigo: 'ABCDEF1234', canal: 'QR' }, // ou 'CODIGO_MANUAL'
  { params: { parceiroId } },            // omita se o usuário só tem 1 parceiro
);
const r = res.data.data; // envelope!
```

**Resposta de sucesso (`200`)** — o resgate já foi **efetivado** neste momento
(estoque decrementado, auditoria gravada; não existe passo de "confirmar"):

```json
{
  "valido": true,
  "resgateId": "cmr...",
  "canal": "QR",
  "cupom": {
    "id": "cmr...",
    "codigo": "PETJOURNEY20",
    "titulo": "20% para PetShops",
    "descontoPercentual": 20
  },
  "tutorPrimeiroNome": "Maria"
}
```

> ⚠️ **Um POST de sucesso = um resgate consumido.** Não reenvie por retry
> automático em timeout sem avisar o usuário: se o primeiro chegou, o segundo
> devolve `409` ("já validado") — trate esse 409 pós-timeout como *provável
> sucesso* e confira no histórico (passo 4).

### 2. Input por câmera (app / web com getUserMedia)

- O QR contém **só o código** (ex.: `ABCDEF1234`) — string crua, sem URL.
- Se o scanner ler algo que **não** tem entre 6 e 32 chars, é QR de outra coisa
  (carteirinha de pet, indicação etc.) — mostre "este não é um QR de cupom" e
  **não** chame a API.
- Leu → envia com `canal: "QR"`.

```ts
function aoLerQr(valorLido: string) {
  const codigo = normalizar(valorLido);
  if (!/^[A-Z2-9]{6,32}$/.test(codigo)) return alertar('Este não é um QR de cupom.');
  validar(codigo, 'QR');
}
```

### 3. Input manual (digitação) — normalize ANTES de enviar

O código é **maiúsculo** e usa um alfabeto sem caracteres ambíguos
(**não existem** `0`, `O`, `1`, `I`, `L`). O balconista vai digitar minúsculo e
com espaços — normalize:

```ts
function normalizar(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '');
}
// "abcde f1234"  ->  "ABCDEF1234"
```

- Não tente "corrigir" `0→O` ou `1→I`: esses caracteres **nunca** ocorrem num
  código legítimo; se o usuário digitou, ele leu errado — deixe o `404` guiar
  ("confira o código").
- Envia com `canal: "CODIGO_MANUAL"`.

### 4. Telas de resultado

**Sucesso** — mostre grande e inequívoco (o balconista decide o desconto na hora):

```
✅ Cupom válido
   20% de desconto — "20% para PetShops"
   Cliente: Maria
   [OK, aplicar desconto]
```

- `tutorPrimeiroNome` pode vir `null` — mostre só o cupom nesse caso.
- **LGPD:** o backend manda **só o primeiro nome**, de propósito. Não peça CPF,
  não peça sobrenome, não adicione campo de "documento do cliente" nessa tela.

**Erros** — mapeie por `statusCode` e **exiba o `message` do servidor** (vem
traduzido):

| Código | Significado | UX sugerida |
|---|---|---|
| `404` | código inválido (não existe **ou** é de cupom de outro negócio — o servidor não diferencia de propósito) | "Código inválido. Confira com o cliente." |
| `410` | token expirou (passou dos ~5 min) | "Código expirado. Peça pro cliente gerar um novo no app (leva 2 toques)." |
| `409` | já validado / cupom esgotado ou inativo / uso único já resgatado — **3 causas, mesmo status** | Exiba o `message` do servidor. NÃO escreva copy fixa pro 409. |
| `403` | usuário não é membro ativo deste parceiro, ou parceiro não credenciado | "Sem acesso." Verificar cadastro/aprovação do parceiro. |
| `400` | faltou `?parceiroId=` (usuário com 2+ negócios) ou body malformado | Selecionar o negócio (ver passo 5) e reenviar. |

### 5. Usuário com mais de um negócio

Igual ao resto do portal: se o usuário é membro de 2+ parceiros, **toda** chamada
precisa de `?parceiroId=`. Pegue a lista pelo `GET /parceiro/portal/dashboard`
(um por vez) ou pelo seletor de negócio que o portal já tem. Sem isso → `400`.

> A validação é **por negócio**: o token só valida se o cupom pertence ao
> parceiro selecionado. Balconista da loja A não valida cupom da loja B (`404`).

### 6. Histórico (já existia — só conferir)

`GET /parceiro/portal/resgates` lista os resgates do parceiro (sem PII do tutor):
`{ resgateId, cupomCodigo, canal, descontoPercentualSnapshot, resgatadoEm }`.
Os resgates validados por esta tela aparecem aí na hora — use pra conferência
pós-timeout (passo 1) e pro relatório do dono.

---

## Pegadinhas conhecidas (a IA VAI tentar fazer isso — não deixe)

| Tentação | Por que está errado |
|---|---|
| Validar o QR "offline" comparando com algo local | Impossível por design: só o backend sabe se o token existe/expirou/já foi usado. Toda validação é o POST. |
| Chamar `GET /tutor/cupons/...` pra "conferir o cupom antes" | Rotas `/tutor/*` são do tutor (JWT de tutor). O parceiro só usa `/parceiro/portal/*`. |
| Tela de "confirmar resgate" em 2 passos (validar → confirmar) | O POST **já efetiva**. Um segundo POST daria 409. Se quiser UX de confirmação, ela vem ANTES do POST. |
| Retry automático silencioso em timeout | Pode dar 409 falso-negativo. Trate 409 pós-timeout como provável sucesso + confira no histórico. |
| Exibir copy própria fixa para `409` | São 3 causas distintas no mesmo status; a copy do servidor é a certa (e já vem no idioma do usuário). |
| Pedir CPF/telefone do cliente na tela | LGPD: o contrato manda só o 1º nome. O desconto não precisa de mais nada. |
| Aceitar o código com espaços/minúsculas como veio | Normalize (`toUpperCase` + remover espaços) ou o lookup falha. |

---

## Checklist de verificação (marque conforme testa)

### Input
- [ ] Scan de um QR gerado pelo app do tutor (doc 01) preenche o código e valida com `canal: "QR"`.
- [ ] Digitar o mesmo código **minúsculo e com espaços** também valida (normalização) com `canal: "CODIGO_MANUAL"`.
- [ ] QR de outra coisa (carteirinha de pet) é rejeitado no cliente, sem chamada à API.

### Resultado
- [ ] Sucesso mostra desconto %, título do cupom e primeiro nome; `tutorPrimeiroNome: null` não quebra a tela.
- [ ] Validar o MESMO código de novo → `409` com a mensagem do servidor na tela.
- [ ] Código com >5 min → `410` com orientação de gerar novo.
- [ ] Código inventado (ex.: `AAAAAAAAAA`) → `404` genérico.
- [ ] Usuário com 2 parceiros sem seletor → `400`; com `?parceiroId=` → funciona.
- [ ] Tentar validar token de cupom de OUTRO parceiro → `404` (não vaza que existe).

### Pós-validação
- [ ] O resgate aparece em `GET /parceiro/portal/resgates` imediatamente.
- [ ] Nenhum dado além do 1º nome do tutor aparece em lugar nenhum da tela/DOM — *LGPD; se aparecer sobrenome/CPF, é bug.*
- [ ] Mensagens testadas nos 4 locales (`Accept-Language`).
