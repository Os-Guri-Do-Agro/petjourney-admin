# Guia do front: Portal do parceiro, onda 0 (equipe pela lista e capacidade de saque)

**Para:** o Luís. Portal web do parceiro (`petjourney-admin`, `portal.petjourney.health`) e perfil parceiro do app (`petjourney-app`).
**Backend:** pronto e validado em dev em 2026-10-21 (unit, integração em Postgres real e smoke HTTP de 41 passos). **Não está em produção.**
**Specs de origem:**
- `docs/specs/2026/q4/q4-1/portal-parceiro/e0-consertos/01-equipe-completa.md` (v0.2)
- `docs/specs/2026/q4/q4-1/portal-parceiro/e0-consertos/02-capacidade-de-saque-pronta.md`
- `docs/specs/2026/q4/q4-1/portal-parceiro/e0-consertos/03-pendencias-de-front-com-api-pronta.md` (só front; a API já entrega)

**Contrato:** `contrato/openapi.json` (versionado na API). Gere os tipos dele; os schemas novos têm nome (`EquipeParceiroDto`, `MeuConviteDto`, `CarteiraPortalResponseDto`...).

---

## 0. Resumo em 30 segundos

| # | O que muda | Onde |
|---|---|---|
| A | A equipe passa a ter **lista** (membros e convites pendentes), **convite por e-mail para quem ainda não tem conta**, cancelar, reenviar, **trocar papel**, **sair** e remover pela lista. Nada mais de digitar ID de usuário ou de parceiro. | Portal (principal) e app |
| B | **Convite só se aceita pelo link do e-mail.** Página nova `/parceiro/convite?token=...` no portal. A "caixa de convites" é só aviso. | Portal |
| C | A carteira devolve **`capacidadeDeSaque`** e **`saqueMinimoCentavos`** prontos: apagar a regra local de saque. | Portal e app |
| D | Para OPERADOR, a **chave PIX vem mascarada** (`*******8901`). | Portal e app |

> **Ordem de deploy (importante):** com a API nova no ar, convite NOVO só é aceito pela página com token (item B). A tela atual de aceite, que pede o ID do parceiro, passa a responder 403 `CONVITE_EXIGE_LINK` para esses convites. Por isso **a página `/parceiro/convite?token=` precisa subir junto com a API, ou logo depois**. Até lá, só o convite antigo (anterior ao deploy) aceita pela tela atual, e ele vence 14 dias depois de criado.

---

## 1. Convenções da API

- **Sucesso:** `{ statusCode, message, data }`. O corpo útil está em `response.data.data` (axios).
- **Erro:** `{ statusCode, message, codigo?, timestamp, path }`. A `message` já vem no idioma do `Accept-Language`, nos 6 locales. **Decida a tela pelo `codigo`**, nunca pelo texto. Os códigos desta onda estão na seção 4.
- **`parceiroId`:** query `?parceiroId=` quando o usuário tem mais de um parceiro (como no resto do portal).
- **Copy:** sem travessão longo (em-dash); em pt nunca "tutor" (é "responsável"); nunca "comissão" (é "participação").

---

## 2. Equipe (E0-01)

### 2.1 Tela de equipe

`GET /parceiro/portal/equipe` (qualquer membro ativo):

```json
{
  "membros": [
    { "usuarioId": "c...", "nome": "Bia Souza", "email": "bia@clinica.com", "papel": "DONO", "desde": "2026-10-01T12:00:00.000Z", "convidadoPor": null },
    { "usuarioId": "c...", "nome": "Caio Lima", "papel": "OPERADOR", "desde": "2026-10-10T12:00:00.000Z", "convidadoPor": "Bia Souza" }
  ],
  "convites": [
    { "id": "c...", "email": "nova@clinica.com", "papel": "OPERADOR", "criadoEm": "...", "expiraEm": "..." },
    { "id": "legado:c...", "email": "antiga@clinica.com", "papel": "OPERADOR", "criadoEm": "...", "expiraEm": null }
  ]
}
```

- `email` só vem para o **DONO** (membro e convite). O OPERADOR vê nomes e papéis.
- `membros` vem com o DONO primeiro.
- O convite com `id` começando por `legado:` é o do fluxo antigo. Para o DONO ele aparece igual aos outros, mas tem duas diferenças:
  - não tem `expiraEm`;
  - "Reenviar" transforma esse convite num convite novo, com link.

| Ação (só DONO) | Rota | Resposta |
|---|---|---|
| Convidar | `POST /parceiro/portal/equipe/convites` `{ email, papel }` | 201 `{ conviteId, papel, status: 'PENDENTE', expiraEm }`. **Igual com ou sem conta**: não mostre "usuário não encontrado", porque esse caso não existe mais |
| Cancelar convite | `DELETE /parceiro/portal/equipe/convites/:conviteId` | 204 |
| Reenviar convite | `POST /parceiro/portal/equipe/convites/:conviteId/reenviar` | 200, mesmo formato do convidar. Novo link e novo prazo (o link antigo para de valer). Até 3 por convite |
| Trocar papel | `PATCH /parceiro/portal/equipe/:usuarioId` `{ papel }` | 200 `{ usuarioId, nome, papel, desde }` |
| Remover | `DELETE /parceiro/portal/equipe/:usuarioId` | 204 |

| Ação (qualquer membro) | Rota | Resposta |
|---|---|---|
| Sair da equipe | `POST /parceiro/portal/equipe/sair` | 204. O último DONO recebe 409 `EQUIPE_ULTIMO_DONO`: mostre "torne outra pessoa dona antes" |

**O que apagar no portal:**
- o campo "ID do usuário" de `PortalEquipeSection.vue` (remover agora é pela lista);
- o "ID do parceiro" de `pages/(accounts)/parceiro/convite.vue`;
- o texto que manda o convidado "criar a conta antes".

O convite vai para qualquer e-mail.

### 2.2 Página do convite: `/parceiro/convite?token=...` (nova)

É o link que chega no e-mail: `https://portal.petjourney.health/parceiro/convite?token=<token>`.

1. **Primeira coisa ao abrir:** guarde o `token` em memória ou `sessionStorage` e tire-o da URL com `history.replaceState`, para ele não vazar por Referer, analytics ou histórico. Sirva a página com `Referrer-Policy: no-referrer`.
2. **Sem login:** mande para entrar ou criar conta e volte para esta página depois. O e-mail diz "pelo mesmo link você cria a sua conta e aceita".
3. **Com login:** mostre Aceitar e Recusar.
   - `POST /parceiro/portal/equipe/convites/aceitar-por-link` `{ token }` responde 200 `{ parceiroId, papel }`. Depois, `store.setParceiroId(parceiroId)`, `bootstrap` e a home do portal, como a página atual já faz.
   - `POST /parceiro/portal/equipe/convites/recusar-por-link` `{ token }` responde 204.
4. **Qualquer conta logada aceita.** O token prova que a pessoa abriu o e-mail convidado; a conta não precisa ter esse mesmo e-mail.
5. **Erros:**
   - `CONVITE_EXPIRADO` (410): "peça um novo convite";
   - `CONVITE_NAO_ENCONTRADO` (404): link já usado, cancelado ou trocado por um reenvio;
   - `EQUIPE_JA_MEMBRO` (409): a pessoa já está na equipe; leve para o portal;
   - `PARCEIRO_NAO_OPERACIONAL` (409): parceiro suspenso ou em análise.

### 2.3 Caixa de convites (aviso, não botão de aceite)

`GET /parceiro/portal/equipe/meus-convites` (usuário logado, mesmo sem ser membro de nenhum parceiro):

```json
[
  { "conviteId": "c...", "parceiro": { "id": "...", "nome": "Clínica Boa Vista", "logoUrl": null }, "papel": "OPERADOR", "convidadoPorNome": "Bia Souza", "expiraEm": "...", "aceitaPor": "LINK" },
  { "conviteId": "legado:<parceiroId>", "parceiro": { ... }, "papel": "DONO", "convidadoPorNome": null, "expiraEm": null, "aceitaPor": "CAIXA" }
]
```

- **`aceitaPor: 'LINK'`:** mostre "Você tem um convite da Clínica Boa Vista. Abra o link que enviamos para o seu e-mail". **Sem botão de aceitar.** Pode haver um "pedir para reenviar", que é avisar quem convidou. Não há rota para o convidado reenviar.
- **`aceitaPor: 'CAIXA'`:** só o convite antigo. Aceitar e recusar ficam aqui:
  - `POST /parceiro/portal/equipe/meus-convites/:conviteId/aceitar` responde 200 `{ parceiroId, papel }`;
  - `POST /parceiro/portal/equipe/meus-convites/:conviteId/recusar` responde 204.
- Chamar aceitar ou recusar da caixa com um convite novo dá sempre 403 `CONVITE_EXIGE_LINK`.

> **Por que só pelo link:** o cadastro não verifica e-mail. Se a caixa aceitasse, qualquer pessoa criava hoje uma conta com `recepcao@clinica.com` e, quando a clínica convidasse esse endereço, entrava na equipe, até como DONO, com carteira e PIX. O link só chega na caixa de entrada de verdade.

### 2.4 App (perfil parceiro)

- Mesmas rotas da 2.1 para a tela de equipe, se o app tiver uma.
- Caixa de convites: só o aviso da 2.3. O link do e-mail abre o portal web, não o app.

---

## 3. Carteira (E0-02)

`GET /parceiro/portal/carteira` (aditivo; os campos de hoje não mudaram de nome nem de valor):

```ts
type CapacidadeDeSaque =
  | 'BLOQUEADO' | 'SEM_SALDO' | 'TUDO_RETIDO' | 'SO_DONO'
  | 'SEM_CHAVE_PIX' | 'ABAIXO_DO_MINIMO' | 'LIBERADO'

type Carteira = {
  saldoTotalCentavos: number
  saldoSacavelCentavos: number
  chavePix: string | null              // OPERADOR recebe mascarada: '*******8901'
  totalSacadoCentavos: number
  bloqueadoParaSaque: boolean
  saqueMinimoCentavos: number          // hoje 5000; nunca usar constante local
  capacidadeDeSaque: CapacidadeDeSaque // já considera o papel de quem está logado
}
```

A ordem de avaliação é a do portal hoje: BLOQUEADO, SEM_SALDO, TUDO_RETIDO, SO_DONO, SEM_CHAVE_PIX, ABAIXO_DO_MINIMO, LIBERADO. O `POST /parceiro/portal/saques` usa a mesma regra antes de debitar, e as respostas de erro dele não mudaram.

| `capacidadeDeSaque` | Chave i18n de hoje no portal | Frase | Tom (Início) | Ação |
|---|---|---|---|---|
| `BLOQUEADO` | `bloqueado` | "O saque desta conta está bloqueado." | risco | "Ver o motivo" |
| `SEM_SALDO` | `semSaldo` | "Ainda não há ganhos. A participação entra aqui quando um responsável assina com o seu código." | apagado | nenhuma |
| `TUDO_RETIDO` | `tudoRetido` | "Todo o saldo ainda está na janela de segurança." | apagado | nenhuma |
| `SO_DONO` | `soDono` | "Só o dono da conta pede o saque." | neutro | nenhuma |
| `SEM_CHAVE_PIX` | `semChavePix` | "Falta a chave PIX para sacar." | atenção | "Cadastrar chave PIX" |
| `ABAIXO_DO_MINIMO` | `abaixoDoMinimo` | "O saque começa em {minimo}.", com `minimo = saqueMinimoCentavos` | neutro | nenhuma |
| `LIBERADO` | `liberado` | "Pronto para sacar." | ok | "Pedir saque" |

Sugestão: um mapa `Record<CapacidadeDeSaque, string>` para as chaves camelCase atuais, sem renomear nos 6 locales.

**Portal: o que apagar ou trocar**
- **Apagar:** `src/service/parceiro/regras-de-saque.ts` e `src/service/parceiro/__tests__/regras-de-saque.spec.ts`. São iguais em `main` e em `redesign/portal`.
- **Tipo `Carteira`** em `src/service/parceiro/types.ts`: os dois campos novos, de preferência gerados do contrato.
- **`redesign/portal`:**
  - `src/components/home/HomeEspacoPortal.vue`: o import nas linhas 32 a 35 e `capacidade`/`fraseDaCapacidade` nas linhas 112 a 131;
  - `src/components/parceiro/panels/PortalCarteiraVisaoPanel.vue`: o import nas linhas 30 a 33 e as linhas 83 e 87;
  - `src/pages/(accounts)/parceiro/carteira/index.vue`: `MIN_SAQUE_CENTAVOS` nas linhas 18 e 87.
- **`main`:**
  - `PortalCarteiraVisaoPanel.vue`: linhas 32 a 35, 85 e 89;
  - `src/components/home/HomeSaldo.vue`: linhas 43, 112 e 267.
- `store.isDono` continua valendo para mostrar os botões de PIX. Ele só sai da regra de saque.

**App (`petjourney-app`)**
- **`app/screens/parceiro/carteira.tsx`:**
  - `MIN_SAQUE_CENTAVOS` (linha 49) vira `carteira.saqueMinimoCentavos`;
  - `canRequestSaque` (linhas 177 a 182) vira `capacidadeDeSaque === 'LIBERADO'`;
  - a validação do submit (linha 221) usa o mínimo da API;
  - a cascata das linhas 640 a 720 vira um `switch` em `capacidadeDeSaque`.
- **Mudança de comportamento:** o app passa a distinguir SEM_SALDO, TUDO_RETIDO e ABAIXO_DO_MINIMO, que hoje mostram o formulário desabilitado. Um operador com saldo zero vê SEM_SALDO, não SO_DONO, pela ordem da API.
- **Tipo `ParceiroCarteira`** em `src/features/parceiro/types.ts` (linhas 148 a 156): os dois campos novos. O `motivoBloqueioSaque` desse tipo nunca veio da API; é anterior a esta onda.

---

## 4. Códigos de erro desta onda

| `codigo` | Status | Quando | Tela |
|---|---|---|---|
| `EQUIPE_APENAS_DONO` | 403 | OPERADOR tentando gerir a equipe | esconder as ações para OPERADOR |
| `EQUIPE_ULTIMO_DONO` | 409 | rebaixar, remover ou sair sendo o único DONO | "Torne outra pessoa dona antes" |
| `EQUIPE_MEMBRO_NAO_ENCONTRADO` | 404 | alvo que não é membro ativo | recarregar a lista |
| `EQUIPE_JA_MEMBRO` | 409 | convidar quem já está; aceitar já sendo membro | "Esta pessoa já faz parte da equipe" |
| `CONVITE_JA_PENDENTE` | 409 | já há convite pendente para o e-mail | oferecer "Reenviar" naquele convite |
| `CONVITE_LIMITE_DIARIO` | 429 | 30 e-mails de convite em 24 h (convites e reenvios) | "Tente amanhã" |
| `CONVITE_LIMITE_DESTINATARIO` | 429 | 3 convites para o mesmo e-mail em 30 dias | "Confira o endereço com a pessoa" |
| `CONVITE_REENVIO_LIMITE` | 429 | 3 reenvios no mesmo convite | "Cancele e convide de novo" |
| `CONVITE_NAO_ENCONTRADO` | 404 | link usado, cancelado, trocado ou convite de outro parceiro | "Este convite não vale mais" |
| `CONVITE_EXPIRADO` | 410 | passou de 14 dias | "Peça um novo convite" |
| `CONVITE_EXIGE_LINK` | 403 | aceitar sem o token (caixa ou tela antiga) | "Abra o link enviado para o seu e-mail" |
| `PARCEIRO_NAO_OPERACIONAL` | 409 | parceiro suspenso ou em análise | aviso do estado do cadastro |

---

## 5. E0-03 (só front)

A lista do que o portal ainda não consome e a API já entrega está na spec `03-pendencias-de-front-com-api-pronta.md`, item por item, com a rota e a evidência no portal. Não depende desta onda.

---

## 6. Como conferir contra a API de dev

- `scripts/smoke-equipe-parceiro.ts` (na API) percorre tudo isto por HTTP: os 41 passos de equipe, convite, link e carteira. É a referência do comportamento esperado.
- Em dev, o e-mail de convite sai de verdade pelo SendGrid. Para testar o link sem caixa de entrada real, use um e-mail seu.
