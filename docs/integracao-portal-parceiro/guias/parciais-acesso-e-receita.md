# Guia do front: parciais do texto do parceiro (doses antes do app, vínculo na aprovação, mensagens prontas)

**Para:** o Luís e o agente dele, nos repos `petjourney-app`, `petjourney-web` (site) e `petjourney-admin` (portal do parceiro).
**Backend:** no `develop` da API desde 2026-10-21, validado na API de dev (unit, integração contra o Postgres de dev e smoke HTTP). **Não está em produção** até o Nicolas subir o `develop` para o `master`.
**Spec de origem:** `docs/specs/2026/q4/q4-1/parciais-acesso-e-receita.md`.
**Contrato:** `contrato/openapi.json` do `petjourney-api`; gere os tipos dele. Envelope `{ statusCode, message, data }`; erro com `message` já traduzida.

Nada aqui quebra o app, o site ou o portal publicados: todo campo é novo, e a mensagem de hoje continua igual.

---

## 1. App (`petjourney-app`)

### 1.1 "Começou em" no calendário de medicação

O "Quando começou?" da leitura de receita agora fica guardado na série. Em `GET /lembrete/calendario-medicacao`, cada série ganhou:

```ts
antesDoApp: { inicio: string | null; doses: number | null } | null; // null = nada informado
progresso: { ...como hoje, antesDoApp: number };                    // 0 quando nada informado
```

- **`progresso.total` não mudou:** continua sendo só o que existe no app.
- **Para mostrar o tratamento inteiro, some nos dois lados:** "`dadas + antesDoApp` de `total + antesDoApp`". Exemplo: 4 dadas no app, 6 antes, total 8 no app = "10 de 14".
- **Linha de resumo** no topo do histórico da série:
  - quando `antesDoApp` não for `null`;
  - com a data, quando houver `inicio`;
  - com a contagem, quando houver `doses` (uso contínuo vem sem `doses`).
- **Essas doses não aparecem como dose dada nos dias.** É de propósito: o horário delas não é conhecido.

**Pronto quando:**
- Uma leitura confirmada com "Quando começou?" de 3 dias atrás (12/12h) mostra a linha "Começou em DD/MM. 6 doses antes do app." e o progresso somado.
- Uma série sem nada informado fica igual à de hoje.

### 1.2 Escolher a mensagem ao compartilhar o acesso

`GET /tutor/compartilhamentos-prestador/:id/handoff` agora traz `variantes`, além do `mensagem`/`texto` de sempre:

```ts
variantes: {
  COM_CONTA: { texto: string; linkWhatsApp: string }; // ele já usa a PetJourney: entra pelo portal
  SEM_CONTA: { texto: string; linkWhatsApp: string }; // ele não usa: registra pelo link, sem cadastro
  CONVITE:   { texto: string; linkWhatsApp: string }; // igual ao SEM_CONTA, mais o convite para criar conta
}
```

**Na tela de compartilhar:**
1. Pergunte antes de enviar: "Ele já usa a PetJourney?".
2. **Sim** usa `COM_CONTA`. **Não** usa `SEM_CONTA`. Com a opção "Convidar para criar a conta" ligada, usa `CONVITE`.
3. Abra o `linkWhatsApp` da variante escolhida, ou passe o `texto` dela para o share sheet. O telefone e o opt-in de alertas são os de hoje (`telefone`, `incluirAlertas`) e valem para as três.
4. Se `variantes` não vier (API antiga), use o `mensagem`, como hoje.

A API já decide sozinha se a mensagem fala de receita: só fala em acesso de consulta.

**Ordem de publicação:** a frase final do `CONVITE` ("depois da aprovação, este acesso aparece no seu portal") só é verdade depois do site da seção 2.2 no ar. Até lá, publique o seletor só com "Sim" e "Não", ou deixe a opção de convite desligada.

**Pronto quando:**
- Os três caminhos abrem o WhatsApp com o texto certo.
- A opção de convite só aparece no "Não".

### 1.3 Textos (6 locales, en-GB explícito)

```json
{
  "pt-BR": {
    "calendario.antesDoApp.comDataEDoses": "Começou em {data}. {doses} doses antes do app.",
    "calendario.antesDoApp.soData": "Começou em {data}.",
    "calendario.antesDoApp.soDoses": "{doses} doses antes do app.",
    "compartilhar.perguntaUsa": "Ele já usa a PetJourney?",
    "compartilhar.sim": "Sim",
    "compartilhar.nao": "Não",
    "compartilhar.convidar": "Convidar para criar a conta"
  },
  "en-US": {
    "calendario.antesDoApp.comDataEDoses": "Started on {data}. {doses} doses before the app.",
    "calendario.antesDoApp.soData": "Started on {data}.",
    "calendario.antesDoApp.soDoses": "{doses} doses before the app.",
    "compartilhar.perguntaUsa": "Do they already use PetJourney?",
    "compartilhar.sim": "Yes",
    "compartilhar.nao": "No",
    "compartilhar.convidar": "Invite them to create an account"
  },
  "en-GB": {
    "calendario.antesDoApp.comDataEDoses": "Started on {data}. {doses} doses before the app.",
    "calendario.antesDoApp.soData": "Started on {data}.",
    "calendario.antesDoApp.soDoses": "{doses} doses before the app.",
    "compartilhar.perguntaUsa": "Do they already use PetJourney?",
    "compartilhar.sim": "Yes",
    "compartilhar.nao": "No",
    "compartilhar.convidar": "Invite them to create an account"
  },
  "es-419": {
    "calendario.antesDoApp.comDataEDoses": "Empezó el {data}. {doses} dosis antes de la app.",
    "calendario.antesDoApp.soData": "Empezó el {data}.",
    "calendario.antesDoApp.soDoses": "{doses} dosis antes de la app.",
    "compartilhar.perguntaUsa": "¿Ya usa PetJourney?",
    "compartilhar.sim": "Sí",
    "compartilhar.nao": "No",
    "compartilhar.convidar": "Invitar a crear la cuenta"
  },
  "sr-Latn": {
    "calendario.antesDoApp.comDataEDoses": "Počelo {data}. {doses} doza pre aplikacije.",
    "calendario.antesDoApp.soData": "Počelo {data}.",
    "calendario.antesDoApp.soDoses": "{doses} doza pre aplikacije.",
    "compartilhar.perguntaUsa": "Da li već koristi PetJourney?",
    "compartilhar.sim": "Da",
    "compartilhar.nao": "Ne",
    "compartilhar.convidar": "Pozovi da napravi nalog"
  },
  "ar": {
    "calendario.antesDoApp.comDataEDoses": "بدأ في {data}. {doses} جرعات قبل التطبيق.",
    "calendario.antesDoApp.soData": "بدأ في {data}.",
    "calendario.antesDoApp.soDoses": "{doses} جرعات قبل التطبيق.",
    "compartilhar.perguntaUsa": "هل يستخدم PetJourney بالفعل؟",
    "compartilhar.sim": "نعم",
    "compartilhar.nao": "لا",
    "compartilhar.convidar": "ادعه لإنشاء حساب"
  }
}
```

---

## 2. Site (`petjourney-web`)

As mensagens da seção 1.2 apontam para o site, que é quem sabe onde o portal mora.

### 2.1 `/prestador/<código>?entrar=portal`

É o link da mensagem `COM_CONTA`. Com `entrar=portal`, a página do acesso redireciona direto para `portalVincularCodigoUrl(codigo)` (`src/lib/parcerias-cta.ts`), que já leva ao login do portal com o "Vincular código" preenchido. Sem o parâmetro, a página fica como hoje.

**Pronto quando:** o link `COM_CONTA` cai no login do portal e, depois de entrar, o modal de vincular abre com o código.

### 2.2 `/cadastro?perfil=parceiro#acesso=<código>`

É o link da mensagem `CONVITE`.
- **O código vem no fragmento (`#acesso=`), não na query.** O fragmento não chega ao servidor do site nem ao Google Analytics (seção 2.4). Leia com `window.location.hash` no cliente.
- O formulário de cadastro de parceiro (`ParceiroSignupForm`) lê esse código e, **depois** do `POST /usuario` e do `POST /parceiro/portal/cadastro`, chama `POST /parceiro/portal/compartilhamentos/reivindicar?parceiroId=<parceiroId da resposta do cadastro>`, com o token novo e o corpo `{ "codigo": "<código>" }`.
- Mande sempre o `?parceiroId=`. Sem ele, quem já é membro de outro parceiro recebe 400, porque a API não sabe em qual parceiro guardar.

| Resposta | O que mostrar |
|---|---|
| 200 `{ reivindicado: true, vinculaNaAprovacao: true }` | "Quando o seu cadastro for aprovado, o acesso de {pet} aparece no seu portal." O nome do pet vem de `GET /prestador/acesso/<código>`, que a página já usa. |
| 200 `{ vinculado: true }` | Só acontece com parceiro já aprovado: o acesso já está no portal. |
| 404 | O código venceu ou não existe. O cadastro vale do mesmo jeito; diga para pedir um código novo ao responsável. |
| 409 | O acesso já está com outra clínica. |
| 429 | Muitos códigos guardados (20); aguarde a análise. |

A reivindicação não deve travar o cadastro: se ela falhar, o cadastro continua valendo.

### 2.3 "Criar minha conta grátis" da página do acesso

Hoje o `ParceiroCta.tsx` chama só `POST /usuario`: a pessoa vira usuária, mas não parceira, e o acesso se perde. Troque o botão para levar a `/cadastro?perfil=parceiro#acesso=<código>`, que cria o parceiro e reivindica (seção 2.2).

**Pronto quando:**
- O "Criar minha conta grátis" e o link `CONVITE` terminam em um parceiro em análise com o código reivindicado.
- Quando o Nicolas aprova no admin, o acesso aparece na tela de Acessos do portal.

### 2.4 Tirar o código do Google Analytics (segurança, prazo 20/11)

O código do acesso é a credencial do prontuário enquanto o acesso vale. Hoje o site manda `pathname + searchParams` para o Google Analytics (`src/components/GoogleAnalytics.tsx`), então todo `/prestador/<código>` já vai para o relatório do GA. Isso está registrado como achado `SEG-2026-10-21-CODIGO-ACESSO-NO-ANALYTICS` (MÉDIO, prazo 30 dias).

- Antes de qualquer `gtag`, troque o código por um marcador: `/prestador/<código>` vira `/prestador/:codigo`, e o parâmetro `acesso`, se aparecer, sai.
- Confira o `page_location` do `gtag('config')` inicial. Se ele levar a URL inteira, use `send_page_view: false` e mande o `page_view` só pelo componente, já redigido.

**Pronto quando:** abrindo `/prestador/123456`, o tempo real do GA mostra `/prestador/:codigo`, nunca o número.

---

## 3. Portal (`petjourney-admin`)

### 3.1 Aviso das reivindicações na tela de Acessos

`GET /parceiro/portal/compartilhamentos/reivindicacoes` devolve `{ itens: [{ id, petNome, situacao, criadaEm, resolvidaEm }] }`. Vêm as abertas e as fechadas nos últimos 30 dias.

| `situacao` | Aviso |
|---|---|
| `AGUARDANDO_APROVACAO` | "O acesso de {pet} aparece aqui quando o seu cadastro for aprovado." |
| `VINCULADO` | Nenhum: o acesso já está na lista. |
| `VENCIDO` | "O acesso de {pet} venceu antes da aprovação do seu cadastro. Peça um novo código ao responsável." |
| `ENCERRADO` | "O responsável encerrou o acesso de {pet} antes da aprovação do seu cadastro." |
| `JA_VINCULADO` | "O acesso de {pet} já foi aberto por outro estabelecimento." |

### 3.2 Vincular código com o cadastro ainda em análise

Hoje o modal "Vincular código" só abre com o cadastro operando. Para o parceiro em análise, ofereça o mesmo modal chamando `reivindicar` em vez de `vincular`, e mostre o aviso `AGUARDANDO_APROVACAO`. Para o parceiro aprovado, nada muda: as duas rotas vinculam na hora.

As duas rotas têm limite por origem: 10 tentativas por minuto, com bloqueio de 15 minutos. Passou disso, a API responde 429; mostre "Muitas tentativas. Tente de novo em alguns minutos." 

**Pronto quando:**
- Parceiro em análise guarda um código e vê o aviso.
- Depois da aprovação, o acesso está na lista e o aviso some.
- Um código vencido antes da aprovação mostra o aviso de vencido.

---

## 4. Resumo do contrato

| Rota | Quem | O que mudou |
|---|---|---|
| `GET /lembrete/calendario-medicacao` | responsável | `antesDoApp` na série e `progresso.antesDoApp` (novos) |
| `GET /tutor/compartilhamentos-prestador/:id/handoff` | responsável | `variantes` (novo); `mensagem`/`texto` iguais |
| `POST /parceiro/portal/compartilhamentos/reivindicar` | parceiro (em análise ou aprovado) | nova; corpo `{ codigo }`; mande `?parceiroId=` |
| `POST /parceiro/portal/compartilhamentos/vincular` | parceiro aprovado | sem mudança de contrato; ganhou o limite por origem (429 com bloqueio) |
| `GET /parceiro/portal/compartilhamentos/reivindicacoes` | parceiro | nova |
