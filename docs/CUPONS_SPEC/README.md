# Integração — Resgate de Cupom Validado pelo Parceiro

Guia de integração da feature de **resgate de cupom validado no atendimento**
para os times de frontend. A engine (backend) já está pronta em `develop`; aqui
está o passo a passo de cada consumidor.

> **Spec técnica (fonte de verdade):** [../specs/cupom-resgate-validacao-parceiro.md](../specs/cupom-resgate-validacao-parceiro.md)
> · **Cupons (listagem/detalhe, já integrado):** [../specs/cupons-frontend.md](../specs/cupons-frontend.md)

## Os guias (comece pelo teu)

| Doc | Quem | O que faz |
|---|---|---|
| [01-app-tutor.md](01-app-tutor.md) | **App do tutor (Expo)** | Botão "usar cupom": pedir o token, desenhar o QR **local**, mostrar o código digitável, countdown, regenerar |
| [02-portal-parceiro-vet.md](02-portal-parceiro-vet.md) | **App do parceiro/vet + Portal web** | Tela "validar cupom": escanear ou digitar o código, aprovar, mostrar resultado |
| — | **CMS-backoffice** | **Nada a fazer nesta onda.** O CRUD admin de cupom não mudou. Não invente tela nova. |
| — | **Landing / web público** | **Nada a fazer nesta onda.** Cupom não tem página pública. |

---

## O que é essa feature (em 30 segundos)

Antes, o tutor "resgatava" o cupom **sozinho no app** — sem o parceiro confirmar
nada, o número de resgates não valia nada. Agora o resgate é **validado no
balcão**:

```
1. Tutor abre o cupom no app e toca "usar"
      → app chama POST /tutor/cupons/:id/resgate-token
      → recebe { codigo: "ABCDEF1234", expiraEm } (vale ~5 min, uso único)

2. App exibe esse codigo de DUAS formas ao mesmo tempo:
      → um QR desenhado LOCALMENTE (conteúdo do QR = o codigo cru)
      → o código em texto grande (pro parceiro digitar se não tiver câmera)

3. Parceiro (logado no app do vet OU no portal web) escaneia ou digita
      → chama POST /parceiro/portal/cupons/validar { codigo, canal }
      → backend confere tudo e EFETIVA o resgate (uma única vez)
      → resposta: "válido, 20% de desconto, tutor Maria"

4. O token morre. Print de tela não vale. Segundo bip dá erro claro.
```

## ⚠️ As 3 regras de ouro (erre isso e a feature quebra)

1. **O QR é desenhado NO CLIENTE, com lib local (ex.: `react-native-qrcode-svg`).**
   NÃO existe `qrImageUrl` pra esse QR. NÃO use o WFQR (`srhub.up.railway.app`)
   — aquele integrador é só pros QRs públicos de pet/tutor/indicação. O token de
   resgate é uma credencial efêmera, não um link público rastreado.

2. **O conteúdo do QR é o `codigo` CRU** (ex.: `ABCDEF1234`) — sem URL, sem
   prefixo, sem JSON em volta. O scanner do parceiro lê a string e manda ela
   inteira no `POST /validar`. Se você embrulhar em `https://...` ou
   `petjourney://...`, a validação **falha** (o backend espera 6–32 chars).

3. **O QR antigo do cupom (`petjourney://cupom/{codigo}`) está MORTO para
   resgate.** Aquele usava o código da **campanha** (igual pra todo mundo,
   imprimível, sem expiração — inseguro). O § 9 do
   [cupons-frontend.md](../specs/cupons-frontend.md) está **superado** por este guia.

---

## Contrato de API (vale pros dois docs)

**Base URL:** a mesma da API PetJourney.

**Envelope de sucesso** — todo endpoint responde envelopado:
```json
{ "statusCode": 200, "message": "Operation successful", "data": { /* o payload */ } }
```
> No front, o payload real está em `response.data.data` (axios) ou `body.data` (fetch).

**Envelope de erro:**
```json
{ "statusCode": 410, "timestamp": "2026-07-13T...", "path": "/parceiro/portal/cupons/validar", "message": "Codigo de resgate expirado. Peca um novo no app." }
```
> O erro **não** traz código de máquina (`errorKey` é removido pelo filtro). Você
> distingue pelo `statusCode` e, quando o mesmo status tem várias causas (os 409),
> **exibe o `message` do servidor** — ele já vem traduzido no locale da request.

**Idioma:** header `Accept-Language: pt-BR | en-US | en-GB | es-419` (ou `?lang=`).
Sem nada → `pt-BR`.

**Auth:** `Authorization: Bearer <access_token>` (JWT) nos dois endpoints. Não há
rota pública nesta feature.

## Tabela de endpoints

| Método | Rota | Quem chama | Retorna (`data`) |
|---|---|---|---|
| POST | `/tutor/cupons/:id/resgate-token` | app do tutor | `{ codigo, expiraEm }` |
| POST | `/parceiro/portal/cupons/validar` | app do vet / portal web | `{ valido, resgateId, canal, cupom{...}, tutorPrimeiroNome }` |
| GET | `/parceiro/portal/resgates` | portal (já existia) | histórico de resgates do parceiro (sem PII) |
| POST | `/tutor/cupons/:id/resgatar` | **NINGUÉM (deprecated)** | self-service antigo. Vai passar a responder **410** quando `CUPOM_RESGATE_VALIDADO_ENABLED=true`. **Remova a chamada do app.** |

## Tabela de erros (a IA DEVE mapear todos)

| Código | Endpoint | Quando | O que o front faz |
|---|---|---|---|
| `404` | resgate-token | cupom inexistente/inelegível/expirado, ou usuário sem perfil de tutor | "cupom indisponível", volta pra lista |
| `409` | resgate-token | cupom de **uso único já resgatado** por esse tutor | mostra o `message`; esconde o botão "usar" |
| `404` | validar | código inexistente **ou de cupom de outro parceiro** (anti-enumeração: mesmo 404) | "código inválido, confira e tente de novo" |
| `410` | validar | token **expirado** | "código expirado — peça pro cliente gerar outro no app" |
| `409` | validar | 3 causas possíveis (já validado / cupom esgotado ou inativo / uso único já resgatado) | **exibir o `message` do servidor** (já traduzido); não inventar copy própria |
| `403` | validar | parceiro não é membro do negócio dono do cupom (BOLA) ou não credenciado | "sem acesso a este cupom" — não deveria ocorrer no fluxo normal |
| `400` | validar | usuário com >1 parceiro sem `?parceiroId=`, ou body inválido | mandar `?parceiroId=` (pegue do dashboard) |
| `410` | resgatar (deprecated) | kill-switch ligado | o app NÃO deve mais chamar essa rota; se o legado chamar, tratar como "apresente ao parceiro" |

## Kill-switch (importante pro rollout)

O backend tem a env `CUPOM_RESGATE_VALIDADO_ENABLED` (hoje **off**):
- **off** = o self-service antigo ainda funciona (compatibilidade com o app publicado).
- **on** = `POST /resgatar` responde **410** e o resgate passa a ser **só** validado pelo parceiro.

Ela será ligada **quando os dois fronts deste guia estiverem no ar**. Ou seja: o
app do tutor deve **parar de chamar `/resgatar`** nesta mesma entrega, senão o
usuário com app velho verá erro quando a flag ligar (comportamento aceito, mas
quanto menos gente no app velho, melhor).

## Checklist ponta-a-ponta (integração 100%)

- [ ] App do tutor: tela "usar cupom" gera QR **local** + código digitável, com countdown ([doc 01](01-app-tutor.md)).
- [ ] App do tutor: chamada antiga a `POST /resgatar` **removida**.
- [ ] Portal parceiro/vet: tela de validação com **scan E digitação** ([doc 02](02-portal-parceiro-vet.md)).
- [ ] Teste real: tutor gera token → parceiro valida → resposta `valido: true` com desconto e 1º nome.
- [ ] Teste real: validar o MESMO código de novo → `409` com mensagem clara.
- [ ] Teste real: esperar >5 min e validar → `410` → tutor gera outro → funciona.
- [ ] `GET /parceiro/portal/resgates` mostra o resgate novo no histórico.
- [ ] Avisar o backend pra ligar `CUPOM_RESGATE_VALIDADO_ENABLED=true` quando tudo acima passar.
