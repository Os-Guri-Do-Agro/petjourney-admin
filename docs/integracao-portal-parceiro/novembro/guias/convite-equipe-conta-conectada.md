<!-- doc cmw1iyea50001pcd26w5vejyx · "Handoff de front: convite com a conta conectada" · atualizado 2026-11-04T02:55:48.941Z · card PJ-VK5P13 -->

# Portal: convite de equipe aberto com a conta errada

**Para:** o Luís e o agente dele, no `petjourney-admin` (portal do parceiro).
**Tela:** `/parceiro/convite` (`src/pages/(accounts)/parceiro/convite.vue`), a página que abre pelo link do e-mail.
**API:** no `develop` desde 04/11/2026. Contrato em `contrato/openapi.json` do `petjourney-api`: copie e gere os tipos de novo.
**Spec da API:** `docs/specs/2026/q4/q4-2/convite-equipe-conta-ja-na-equipe.md`.

---

## O que aconteceu

No teste de 04/11, o convite foi para o e-mail do Luís. O link foi aberto no navegador onde a conta do DONO da PetJourney Clinic estava logada.

- O aceite deu 409 e a tela disse "Você já faz parte da equipe da PetJourney Clinic. É só seguir para o portal.". Isso é verdade para o DONO, mas o convite era para outra pessoa, e a tela esqueceu o token.
- Com a conta certa, o aceite passou. O aviso de sucesso disse "Convite aceito: Você já faz parte da equipe.", que em português também se lê como reclamação ("já", de novo).

Ninguém é barrado por já ter uma empresa: uma conta pode estar em várias equipes. O que faltava era a tela saber qual conta está conectada e para quem é o convite.

## O que a API mudou

### 1. A prévia diz quem está conectado

`POST /parceiro/portal/equipe/convites/previa-por-link` `{ token }` ganhou um campo:

```json
{
  "conviteId": "...",
  "parceiro": { "id": "...", "nome": "PetJourney Clinic", "logoUrl": null },
  "papel": "OPERADOR",
  "convidadoPorNome": "Nicolas",
  "expiraEm": "2026-11-11T05:40:01.001Z",
  "contaConectada": { "jaFazParte": true, "papelAtual": "DONO", "paraEstaConta": false }
}
```

- `jaFazParte`: a conta logada já é membro desta equipe.
- `papelAtual`: o papel dela na equipe (`DONO`/`OPERADOR`), ou `null`.
- `paraEstaConta`: **só quando `jaFazParte`**. `true` se o convite foi para o e-mail desta conta, `false` se foi para outro. Para quem não é da equipe vem sempre `null`, de propósito: com um link vazado e contas novas, daria para confirmar um palpite do e-mail convidado. O endereço nunca vem na resposta.

### 2. O aceite diferencia os dois casos de "já é da equipe"

`POST /parceiro/portal/equipe/convites/aceitar-por-link` `{ token }`:

| Caso | Resposta |
|---|---|
| Conta que não é da equipe (com o e-mail convidado ou outro) | 200 `{ parceiroId, papel, jaEraMembro: false }`, como antes |
| Conta já da equipe, convite para o e-mail dela | 200 `{ parceiroId, papel, jaEraMembro: true }`. O convite fecha; `papel` é o papel atual, que não muda |
| Conta já da equipe, convite para outro e-mail | 409 `codigo: CONVITE_CONTA_JA_NA_EQUIPE`. O convite **continua valendo** para quem foi convidado |

O aceite **não devolve mais `EQUIPE_JA_MEMBRO`**. Esse código continua só no convidar e no reenviar, para quem convida.

`POST .../meus-convites/:conviteId/aceitar` (convite antigo da caixa) também devolve `jaEraMembro: false`.

## O que mudar na tela

Use `contaConectada` assim que a prévia chegar, antes do clique:

1. **`jaFazParte` e `!paraEstaConta`** (o caso do teste): estado novo `contaErrada`.
   - Título "Este convite é para outra conta"; corpo `contaErrada.corpo` com o nome da empresa.
   - Botão principal "Entrar com outra conta": sai da sessão **sem esquecer o token**, e o login volta para `/parceiro/convite`.
   - Botão secundário "Ir para o portal".
   - Sem o botão "Aceitar convite".
   - Confira que o logout não limpa o `sessionStorage`, onde fica `pj.convite-equipe.token` (`convite-pendente.ts`). Se limpar, guarde o token de novo depois do logout.
2. **`jaFazParte` e `paraEstaConta`:** o estado `jaMembro` que já existe ("Você já faz parte da equipe da {empresa}").
   - O botão "Ir para o portal" chama `aceitar-por-link` antes de navegar. A resposta vem com `jaEraMembro: true` e fecha o convite, que some da lista de pendentes do DONO.
3. **`!jaFazParte`** (`paraEstaConta` é `null`): como hoje, com Aceitar e Recusar. Qualquer conta aceita, porque o token prova que a pessoa abriu o e-mail.

No aceite:

- 409 `CONVITE_CONTA_JA_NA_EQUIPE`: vai para o estado `contaErrada` **sem** `esquecerTokenDoConvite()`. Acontece quando a prévia falhou e a tela não sabia.
- 200 com `jaEraMembro: true`: aviso com o resumo `jaNaEquipe` ("Já está na equipe") e o detalhe `jaEraMembroDetalhe`, e depois o portal.
- 200 com `jaEraMembro: false`: aviso "Convite aceito" com o detalhe `aceitoDetalheComEmpresa`.
- Pode tirar o ramo `EQUIPE_JA_MEMBRO` do `decidirPeloLink`: o aceite não devolve mais esse código.

Se a prévia falhou (`previa === null`), a tela não tem `contaConectada`: siga como hoje e trate o 409 acima.

## Textos (`parceiro.convite`, nos 6 arquivos)

`aceitoDetalhe` muda em pt (o en e o en-GB já dizem "You are now part of the team"). As outras chaves são novas.

| Chave | pt | en | en-GB | es | sr | ar |
|---|---|---|---|---|---|---|
| `aceitoDetalhe` | Agora você faz parte da equipe. | You are now part of the team. | You are now part of the team. | Ahora formas parte del equipo. | Sada ste deo tima. | أصبحت الآن جزءًا من الفريق. |
| `aceitoDetalheComEmpresa` | Agora você faz parte da equipe da {empresa}. | You are now part of the {empresa} team. | You are now part of the {empresa} team. | Ahora formas parte del equipo de {empresa}. | Sada ste deo tima: {empresa}. | أصبحت الآن جزءًا من فريق {empresa}. |
| `jaEraMembroDetalhe` | Você já fazia parte desta equipe. O convite foi fechado e seu acesso continua o mesmo. | You were already on this team. The invitation is now closed and your access stays the same. | You were already part of this team. The invitation is now closed and your access stays the same. | Ya formabas parte de este equipo. La invitación se cerró y tu acceso sigue igual. | Već ste bili deo ovog tima. Pozivnica je zatvorena, a vaš pristup ostaje isti. | كنت بالفعل ضمن هذا الفريق. أُغلقت الدعوة ويبقى وصولك كما هو. |
| `contaErrada.titulo` | Este convite é para outra conta | This invitation is for another account | This invitation is for another account | Esta invitación es para otra cuenta | Ova pozivnica je za drugi nalog | هذه الدعوة لحساب آخر |
| `contaErrada.corpo` | Você entrou com uma conta que já faz parte da equipe da {empresa}, e o convite foi enviado para outro e-mail. Para aceitar, entre com a conta desse e-mail. | You are signed in with an account that is already on the {empresa} team, and the invitation was sent to a different email. To accept it, sign in with the account for that email. | You are signed in with an account that is already part of the {empresa} team, and the invitation was sent to a different email address. To accept it, sign in with the account for that email address. | Entraste con una cuenta que ya forma parte del equipo de {empresa}, y la invitación se envió a otro correo. Para aceptarla, entra con la cuenta de ese correo. | Prijavljeni ste nalogom koji je već deo tima {empresa}, a pozivnica je poslata na drugu e-poštu. Da biste je prihvatili, prijavite se nalogom te e-pošte. | لقد سجّلت الدخول بحساب ينتمي بالفعل إلى فريق {empresa}، وأُرسلت الدعوة إلى بريد إلكتروني آخر. لقبولها، ادخل بحساب ذلك البريد. |
| `contaErrada.corpoSemEmpresa` | Você entrou com uma conta que já faz parte desta equipe, e o convite foi enviado para outro e-mail. Para aceitar, entre com a conta desse e-mail. | You are signed in with an account that is already on this team, and the invitation was sent to a different email. To accept it, sign in with the account for that email. | You are signed in with an account that is already part of this team, and the invitation was sent to a different email address. To accept it, sign in with the account for that email address. | Entraste con una cuenta que ya forma parte de este equipo, y la invitación se envió a otro correo. Para aceptarla, entra con la cuenta de ese correo. | Prijavljeni ste nalogom koji je već deo ovog tima, a pozivnica je poslata na drugu e-poštu. Da biste je prihvatili, prijavite se nalogom te e-pošte. | لقد سجّلت الدخول بحساب ينتمي بالفعل إلى هذا الفريق، وأُرسلت الدعوة إلى بريد إلكتروني آخر. لقبولها، ادخل بحساب ذلك البريد. |
| `contaErrada.trocarConta` | Entrar com outra conta | Sign in with another account | Sign in with another account | Entrar con otra cuenta | Prijavite se drugim nalogom | الدخول بحساب آخر |

Sem travessão (—) e sem "tutor" em nenhum texto.

## Pronto quando

Confira contra a API de dev (`https://petjourney-api-dev.up.railway.app`), com a conta DONO de uma empresa e outra conta convidada como OPERADOR:

- [ ] O DONO convida a outra conta e abre o link no próprio navegador. A tela diz "Este convite é para outra conta", sem o botão de aceitar.
- [ ] "Entrar com outra conta" sai da sessão. Depois do login com a conta convidada, a tela do convite volta com a empresa e o botão de aceitar, sem abrir o e-mail de novo.
- [ ] A conta convidada aceita: aviso "Convite aceito" e "Agora você faz parte da equipe da {empresa}". O portal abre nessa empresa.
- [ ] O convite some da lista de pendentes do DONO.
- [ ] Quem já entrou na equipe e abre o próprio link de novo vê "Você já faz parte da equipe da {empresa}". O "Ir para o portal" funciona e o convite sai da lista do DONO.
- [ ] `vue-tsc`, `vitest` e `check:i18n` limpos. Atualize o `convite.spec.ts`, que hoje testa `EQUIPE_JA_MEMBRO`.
