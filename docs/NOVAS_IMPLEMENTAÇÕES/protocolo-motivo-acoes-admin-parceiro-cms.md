# Spec Frontend (CMS): Motivo e Protocolo em Ações Admin sobre Parceiro

**Status:** Backend LIVE em dev (2026-08-05). Pronto para integrar.
**Autor:** Claude + Nicolas
**Criado em:** 2026-08-05
**Superfície:** `petjourney-cms` (Next.js, admin interno)
**Spec de backend:** [protocolo-motivo-acoes-admin-parceiro.md](protocolo-motivo-acoes-admin-parceiro.md)

> **Atenção, tem breaking:** o botão de excluir parceiro **quebra** assim que o backend subir, porque `DELETE /parceiro/:id` passou a exigir `{ motivo }` no corpo. Ver seção 6 (ordem de deploy).

---

## 0. O que mudou, em 3 linhas

Toda ação admin que mexe em dinheiro ou na existência do parceiro agora **exige motivo** e devolve um **protocolo** (`CRD-2026-000123`). O motivo, que antes era digitado e jogado fora, fica guardado e consultável pelo código. E excluir parceiro deixou de apagar a linha: vira exclusão lógica, preservando carteira e extrato.

---

## 1. Contrato: o que mudou em cada rota

### 1.1 Envio de crédito (ajuste de carteira)

`POST /admin/parceiro/:parceiroId/carteira/ajuste`

Request: **inalterado** (o CMS já manda `motivo`), com uma regra nova:

| Campo | Antes | Agora |
|---|---|---|
| `motivo` | qualquer string não vazia | **mínimo 5 caracteres**, máximo 500 |

Response ganha um campo:

```jsonc
{
  "parceiroId": "ckxxx",
  "valorCentavos": 5000,
  "protocolo": "CRD-2026-000123",   // <-- novo
  "refEvento": "ajuste:CRD-2026-000123"  // agora carrega o protocolo (antes era um uuid)
}
```

Ajuste em [`AjusteCarteiraResponse`](../../../../../../petjourney-cms/src/services/parceiro-admin.service.ts#L220):

```ts
export interface AjusteCarteiraResponse {
  parceiroId: string;
  valorCentavos: number;
  refEvento: string;
  protocolo: string; // novo
}
```

### 1.2 Revisão antifraude

`POST /admin/parceiro/:parceiroId/carteira/revisao`. Mesma história: `motivo` com mínimo de 5, response ganha `protocolo` (prefixo `REV`).

```ts
export interface RevisaoAntifraudeResponse {
  parceiroId: string;
  emRevisaoAntifraude: boolean;
  protocolo: string; // novo
}
```

### 1.3 Falha de saque

`POST /admin/parceiro/saques/:id/falhar`. `motivoFalha` com mínimo de 5, response ganha `protocolo` (prefixo `SAQ`).

```ts
export interface LiquidarSaqueResponse {
  id: string;
  status: StatusSaqueParceiro;
  liquidadoEm?: string | null;
  protocolo?: string; // novo (presente só no /falhar, não no /pagar)
}
```

> `POST .../pagar` **não** emite protocolo nesta rodada (não tem motivo hoje). Está registrado como pergunta em aberto na spec de backend.

### 1.4 Exclusão de parceiro (BREAKING)

`DELETE /parceiro/:id`

```ts
// ANTES
excluirParceiro: async (id: string): Promise<void> => {
  await fetchClient<void>(`parceiro/${id}`, { method: 'DELETE' });
}

// AGORA
excluirParceiro: async (id: string, motivo: string): Promise<ExcluirParceiroResponse> => {
  return await fetchClient<ExcluirParceiroResponse>(`parceiro/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo }),
  });
}

export interface ExcluirParceiroResponse {
  id: string;
  deletedAt: string;
  protocolo: string; // EXC-2026-000045
}
```

Sem o corpo, a resposta é **400** e o parceiro não é tocado.

### 1.5 Rotas novas: consulta da trilha

```
GET /admin/protocolo/:codigo          -> detalhe de um protocolo
GET /admin/parceiro/:id/protocolos    -> trilha do parceiro (mais recente primeiro, ?limit= default 50, max 100)
```

Shape do detalhe:

```jsonc
{
  "codigo": "CRD-2026-000123",
  "tipoAcao": "CREDITO_PARCEIRO",   // CREDITO_PARCEIRO | EXCLUSAO_PARCEIRO | REVISAO_ANTIFRAUDE | FALHA_SAQUE
  "entidade": "Parceiro",
  "entidadeId": "ckxxx",
  "adminId": "ckyyy",
  "motivo": "acordo comercial de agosto",
  "payload": { "valorCentavos": 5000, "saldoAnteriorCentavos": 10000, "saldoPosteriorCentavos": 15000 },
  "criadoEm": "2026-08-05T13:22:41.000Z"
}
```

O `payload` **varia por tipo de ação**:

| Tipo | Prefixo | `payload` |
|---|---|---|
| `CREDITO_PARCEIRO` | `CRD` | `valorCentavos`, `saldoAnteriorCentavos`, `saldoPosteriorCentavos` |
| `EXCLUSAO_PARCEIRO` | `EXC` | `nome`, `cnpj`, `codigoIndicacao`, `saldoTotalCentavos`, `cupons`, `usuariosIndicados` |
| `REVISAO_ANTIFRAUDE` | `REV` | `emRevisao` (boolean) |
| `FALHA_SAQUE` | `SAQ` | `saqueId`, `valorCentavos` |

A busca por código aceita minúsculas e espaços em volta (o backend normaliza). Código inexistente responde **404** com `errorKey: PROTOCOLO_NAO_ENCONTRADO`.

---

## 2. Erros novos a tratar

| Situação | Status | `errorKey` / `reason` | O que mostrar |
|---|---|---|---|
| Excluir parceiro já excluído | 409 | `PARCEIRO_JA_EXCLUIDO` | "Este parceiro já foi excluído." Fechar o modal e recarregar a grid |
| Excluir parceiro com cupons | 409 | `PARCEIRO_EXCLUSAO_BLOQUEADA_CUPONS` | "O parceiro tem cupons vinculados e não pode ser excluído." Sugerir desativar os cupons antes |
| Protocolo não encontrado | 404 | `PROTOCOLO_NAO_ENCONTRADO` | "Protocolo não encontrado." |
| Motivo ausente ou curto | 400 | (ValidationPipe, sem `errorKey`) | Validar no formulário antes de enviar: mínimo 5 caracteres |

As três primeiras vêm do `ERROR_CATALOG` traduzido, então **use a `message` que o backend devolve**, não uma string fixa no CMS. O `reason` vem no topo do payload para rotear a UX sem depender de texto.

---

## 3. Telas

### 3.1 Modal de exclusão de parceiro (novo)

Em `petjourney-cms/src/app/(private)/(app-shell)/(section-partners)/partners/page.tsx` (sem link: os parênteses do App Router quebram o markdown), a ação de excluir passa a abrir um modal em vez de executar direto.

```
┌─────────────────────────────────────────────────┐
│  Excluir parceiro                               │
│                                                 │
│  Rede PetJourney Partners                       │
│                                                 │
│  O parceiro sai das listagens, perde acesso ao  │
│  portal e o QR de indicação é revogado.         │
│  O histórico financeiro é preservado.           │
│                                                 │
│  Motivo da exclusão *                           │
│  ┌───────────────────────────────────────────┐  │
│  │                                           │  │
│  └───────────────────────────────────────────┘  │
│  Mínimo 5 caracteres. Fica registrado no        │
│  protocolo e não pode ser editado depois.       │
│                                                 │
│              [ Cancelar ]  [ Excluir parceiro ] │
└─────────────────────────────────────────────────┘
```

- Botão de confirmar desabilitado enquanto o motivo tiver menos de 5 caracteres.
- No sucesso: toast com o **protocolo copiável** (ver 3.3) e a grid recarrega.
- Copy sem em-dash, como todo o resto do produto.

### 3.2 Campo de motivo nas ações de dinheiro (ajuste)

Os 3 formulários (ajuste de carteira, revisão antifraude, falha de saque) já têm campo de motivo. Só falta:

- `minLength={5}` e mensagem de ajuda ("Mínimo 5 caracteres. Fica no protocolo.").
- Validar antes do envio, para não gastar um round-trip no 400.

### 3.3 Feedback com protocolo (novo, transversal)

Toda ação bem-sucedida das 4 mostra o protocolo em destaque, com botão de copiar:

```
┌────────────────────────────────────────────┐
│ ✓ Crédito de R$ 50,00 enviado              │
│   Protocolo CRD-2026-000123        [copiar]│
└────────────────────────────────────────────┘
```

O protocolo é o que o admin vai usar depois para achar a operação. Um toast que some em 3 segundos sem opção de copiar joga fora o valor da feature.

### 3.4 Aba "Histórico de ações" no detalhe do parceiro (novo)

Consumindo `GET /admin/parceiro/:id/protocolos`:

| Data | Ação | Protocolo | Motivo | Detalhe |
|---|---|---|---|---|
| 05/08/2026 13:22 | Crédito | `CRD-2026-000123` | acordo comercial de agosto | +R$ 50,00 (saldo 100,00 → 150,00) |
| 04/08/2026 09:10 | Revisão antifraude | `REV-2026-000004` | suspeita de laranja | Aplicada |

- A coluna "Detalhe" é renderizada a partir do `payload`, por tipo de ação (tabela da seção 1.5).
- Ordenação já vem do backend (mais recente primeiro). Não reordene no cliente.

### 3.5 Busca por protocolo (novo, opcional nesta rodada)

Um campo de busca global "Consultar protocolo" que chama `GET /admin/protocolo/:codigo` e abre o detalhe. É o fluxo "o parceiro me ligou citando o número".

Se o escopo apertar, esta é a parte que pode ficar para depois: a aba 3.4 já cobre o caso "quero ver o histórico deste parceiro".

---

## 4. O que muda sem você fazer nada

- **Parceiro excluído some sozinho** da grid, do detalhe (404), da fila de auditoria e das listas de modos. O backend filtra; o CMS não precisa de flag nova.
- **Não existe** rota para listar excluídos nem para restaurar. Se precisar, vira spec própria (está como follow-up no backend).
- O `refEvento` que aparece no extrato agora é legível (`ajuste:CRD-2026-000123`). Se alguma tela mostra esse campo cru, ele ficou mais útil, não menos.

---

## 5. Checklist de aceite (CMS)

- [ ] `excluirParceiro` manda `{ motivo }` e o modal valida mínimo de 5 caracteres.
- [ ] Excluir sem motivo é impossível pela UI (botão travado), e um 400 do backend não deixa a tela em estado quebrado.
- [ ] Sucesso da exclusão mostra o protocolo `EXC-...` copiável.
- [ ] 409 `PARCEIRO_JA_EXCLUIDO` e 409 `PARCEIRO_EXCLUSAO_BLOQUEADA_CUPONS` mostram a `message` do backend, sem string fixa no CMS.
- [ ] Parceiro excluído desaparece da grid depois do refresh.
- [ ] Ajuste de carteira, revisão antifraude e falha de saque mostram o protocolo no sucesso.
- [ ] Os 3 formulários validam motivo com mínimo de 5 caracteres antes de enviar.
- [ ] Aba "Histórico de ações" lista os protocolos do parceiro com motivo e detalhe por tipo.
- [ ] A aba funciona para um parceiro **já excluído** (a trilha sobrevive à exclusão).
- [ ] Nenhuma copy nova com em-dash.

---

## 6. Ordem de deploy (importante)

O backend já está em dev. Para produção, o caminho **sem janela quebrada** é:

1. **CMS primeiro**, mandando `{ motivo }` no DELETE. O backend atual ignora corpo desconhecido, então nada quebra.
2. **Backend depois**. Quando ele subir, o CMS já está mandando o que ele passou a exigir.

Se o backend subir primeiro, o botão de excluir parceiro responde 400 até o CMS ser atualizado. As outras 3 rotas são retrocompatíveis: só ganham um campo no response.

---

## 7. Fora do escopo desta entrega

- Restaurar parceiro excluído (não existe rota).
- Listar parceiros excluídos no CMS (não existe rota).
- Protocolo em `POST .../saques/:id/pagar` (não emite hoje).
- Protocolo para ações admin sobre tutor e pet (só parceiro nesta onda).
