# 12 · Base importada — visão do responsável (protótipo no app)

**Para:** o agente que trabalha no `petjourney-app` (`D:\PROJETOS\petjourney-app`).
**De:** o `petjourney-admin`, onde o migrador de dados da clínica já existe como protótipo
([11-migrador-de-dados.md](./11-migrador-de-dados.md)).

A clínica agora traz a base de outro sistema: centenas de responsáveis e pacientes entram de uma
vez, a partir de uma planilha. Isso cria uma situação que o app ainda não conhece — **a clínica
conhece o responsável e o pet antes de o responsável conhecer o app**, ou antes de ele saber que
aquela clínica está no PetJourney.

Até aqui, o vínculo clínica ↔ pet nascia de um gesto do responsável (agendar) ou de um
atendimento (doc 09, seção 20, item 2). A importação produz um vínculo **proposto**: a clínica
diz "este é o Thor, do Eduardo", e só o Eduardo pode dizer "sim, é o meu Thor". Este documento pede
a tela e o fluxo em que ele diz isso.

Onde está escrito **Decisão**, é um padrão escolhido aqui para você não precisar perguntar. Dá
para mudar — mas a mudança começa no contrato do admin, não só no app.

---

## 0. Antes de começar

1. **Recopie o contrato.** Fonte: `D:\PROJETOS\petjourney-admin\src\features\clinico\contrato\responsavel.ts`
   → `src/features/clinica/contrato.ts`, sem editar, como no doc 09. A seção nova é a última:
   **"Vínculo proposto pela clínica"**.
2. **Nada da seção nova quebra o build.** A notificação `VINCULO_PROPOSTO` e os erros
   `VINCULO_INCOMPLETO` / `VINCULO_EXPIRADO` estão **fora** de `TIPOS_DE_NOTIFICACAO_CLINICA` e de
   `CodigoDeErroClinico` de propósito: aqueles registros são fechados no app e obrigariam tudo a
   entrar na mesma leva. Quando esta tela for feita, eles entram lá — no admin primeiro, e
   recopiados.
3. **Nada disto existe na API.** Protótipo com dados imaginários, atrás da mesma chave de mock do
   doc 09 (seção 16).
4. **Seis idiomas**, como sempre: `pt`, `en`, `en-GB`, `es`, `sr`, `ar` (RTL).

### Onde cada coisa mora no app

| O quê | Onde |
|---|---|
| Tipos | `src/features/clinica/contrato.ts` (a cópia) |
| Mock das propostas | `src/features/clinica/mock-vinculo.ts` |
| Serviço | `services/clinica-responsavel/clinica-responsavel-service.ts` (o mesmo do doc 09) |
| Tela | `app/screens/clinica/vinculo.tsx` → rota `/screens/clinica/vinculo?id=` |
| Textos | `clinica.vinculo.*` nos seis `src/locales/*.json` |

---

## 1. O que a clínica fez, do lado dela

Para você entender o que chega, em uma frase por coisa:

- A clínica subiu uma planilha. Cada linha virou um responsável, um paciente, ou os dois.
- O que estava errado na planilha **ficou em branco**, não foi inventado: CPF inválido, e-mail sem
  domínio, data impossível. Sexo em branco continua em branco. Por isso `PetNaClinica.sexo`,
  `raca` e `nascimento` podem vir `null`.
- Animal falecido **não foi importado**. Nunca chega proposta de um pet que morreu.
- Quem já era cliente foi juntado ao cadastro existente. Para o app, isso não gera proposta
  nova se o vínculo já existia (seção 5).
- O telefone foi normalizado (DDD, nono dígito, máscara). É por ele — e pelo e-mail — que a API
  acha a conta do app.

---

## 2. Como a proposta chega

Dois caminhos, e o app só precisa tratar o segundo como caso especial de login:

1. **A pessoa já tem conta no app** com o mesmo telefone ou e-mail verificado que está na clínica.
   A API cria a proposta e manda a notificação `VINCULO_PROPOSTO` (`DadosDoVinculoProposto`), que
   abre `/screens/clinica/vinculo?id=…`. Texto em português em
   `TEXTO_PT_DA_NOTIFICACAO_DO_VINCULO`: "{Clínica} trouxe seu cadastro" / "Confirme os 2 pets que a
   clínica atende para ver tudo no app."
2. **A pessoa ainda não tem conta.** A clínica manda o convite por SMS ou WhatsApp (lado do
   backend) com um link para a loja / deep link `petjourney://screens/clinica/vinculo?id=…`.
   **Decisão:** o app guarda o `id` do deep link, deixa a pessoa criar conta ou entrar como hoje,
   e abre a tela da proposta **depois** do login — nunca antes.

Além da notificação, **Decisão:** um cartão na Home enquanto houver proposta `PENDENTE` ("A
Clínica X trouxe o cadastro do Thor e da Mel"), no mesmo lugar dos cartões com prazo do doc 09
(seção 3). A proposta vence (`expiraEm`); o cartão some junto.

---

## 3. A tela da proposta

`GET /tutor/clinica/vinculos-propostos/:id` → `VinculoProposto`.

De cima para baixo:

1. **Quem está propondo.** Foto, nome e telefone da clínica (`clinica`), e a frase "trouxe seu
   cadastro do sistema que ela usava antes". Sem jargão de importação.
2. **Como a clínica tem você.** `dadosNaClinica.nome`, telefone e e-mail **mascarados** — como a
   API manda. Link "Algo errado? Avise a clínica" → `pedirCorrecao` (seção 4).
3. **Os pets.** Um bloco por `PetNaClinica`: nome, espécie, raça, nascimento, sexo (ou "não
   informado"). Para cada um, uma escolha só, entre três:
   - **"É o meu {pet do app}"** — ligar a um pet que já existe no app. Se `sugestaoDoApp` vier,
     a opção nasce apontando para ele; a pessoa pode trocar por outro pet dela da mesma espécie.
   - **"Adicionar ao app"** — criar um pet novo no app com os dados da clínica.
   - **"Não é meu"**.
   **Decisão:** nada nasce escolhido, **nem com sugestão** — a sugestão preenche o seletor do "É o
   meu…", mas a pessoa ainda toca. Ligar o pet errado mistura históricos, e é o mesmo erro que o
   lado da clínica evita perguntando.
4. **O que a clínica vai poder ver.** O mesmo bloco de consentimento de "Minhas clínicas" (doc 09,
   seção 7): diário completo, peso, notas — tudo começa desligado.
5. **Confirmar** (desligado até todos os pets terem escolha; diz quantos faltam) e, discreto,
   **"Não sou eu"** / **"Não quero vincular"** → `recusar`.

`POST .../responder` com `ResponderVinculo` devolve a `ClinicaDoResponsavel` já com os `petIds`.
Depois de confirmar, a tela vai para a Clínica do pet (tela 1 do doc 09) do primeiro pet ligado.

### Estados

| `situacao` / erro | A tela |
|---|---|
| `PENDENTE` | A tela acima |
| `RESPONDIDO` | "Você já respondeu" e o atalho para a clínica. Aberta de novo pela notificação antiga, não refaz nada |
| `RECUSADO` | "Você recusou este convite em {data}". Sem ação: um convite novo depende da clínica |
| `EXPIRADO` / `VINCULO_EXPIRADO` | "Este convite venceu. Peça à clínica um novo" e o telefone dela |
| `VINCULO_INCOMPLETO` | Não deveria acontecer (o botão só liga com tudo escolhido); se acontecer, recarregar a proposta |
| `PET_SEM_ACESSO` | O pet escolhido em "É o meu…" não é da pessoa (membro da família com leitura). Mensagem e voltar à escolha |

---

## 4. Casos difíceis

| Caso | O que fazer |
|---|---|
| **Pet com o mesmo nome no app** ("Luna" na clínica, "Luna" no app) | É o caso da `sugestaoDoApp`. A escolha nasce apontando para ela, e a pessoa confirma |
| **Nome diferente, mesmo bicho** ("Bob" na clínica, "Bobinho" no app) | Sem sugestão. "É o meu…" abre a lista de pets da pessoa da **mesma espécie**. Ligar não renomeia nada: cada lado fica com o nome dele |
| **O pet não está no app** | "Adicionar ao app" cria com os dados da clínica. Campo `null` fica em branco no app também — não pergunte agora o que a clínica não sabia |
| **Um pet da proposta não é da pessoa** (a clínica ligou o gato do vizinho ao responsável errado) | "Não é meu". A API avisa a clínica; o resto da proposta segue |
| **A pessoa não é quem a clínica acha** (telefone reciclado) | "Não sou eu" → `recusar` com `NAO_SOU_EU`. Nenhum dado da clínica fica na conta |
| **Dados errados** ("meu telefone mudou", "a Mel é fêmea") | "Avise a clínica" → `pedirCorrecao`, texto livre até 500 caracteres. **O app não edita o cadastro da clínica** — pede, e a clínica corrige |
| **Proposta sem pets** (a clínica tinha só o contato) | A tela mostra só a clínica e os dados; confirmar liga a pessoa à clínica, sem pets. A clínica aparece em "Minhas clínicas" |
| **Duas propostas da mesma clínica** | Não acontece: a API junta numa só. Duas clínicas diferentes são duas propostas |
| **Membro da família** | A proposta é do titular dos dados; membro não vê. Depois de ligado, o membro vê o pet como sempre (doc 09, seção 13) |
| **Pet ligado que depois é desativado por plano** | Como no resto do módulo: `PET_INATIVO` nas escritas. A proposta em si não depende de plano |

---

## 5. O que muda no vínculo

- **Decisão:** a origem do vínculo (`OrigemDoVinculo`) é informação da API, não do app — o app
  não mostra "importado" em lugar nenhum depois de confirmado. Uma vez ligado, é uma clínica como
  outra qualquer.
- Se o pet **já estava** vinculado a essa clínica por agendamento ou atendimento, a importação só
  enriquece o cadastro do lado da clínica e **não gera proposta**. O app não fica sabendo, e está
  certo: nada mudou para a pessoa.
- **Consentimento começa desligado**, como em todo vínculo. A clínica que importou 15 anos de base
  não ganha o diário de ninguém por isso.

---

## 6. Textos (pt)

Chaves sugeridas em `clinica.vinculo`, para você traduzir nos seis idiomas:

| Chave | pt |
|---|---|
| `titulo` | {clinica} trouxe seu cadastro |
| `explicacao` | A clínica usava outro sistema e trouxe o cadastro dos pacientes para o PetJourney. Confirme o que é seu. |
| `comoTemVoce` | Como a clínica tem você |
| `algoErrado` | Algo errado? Avise a clínica |
| `pets` | Os pets que a clínica atende |
| `ehOMeu` | É o meu {pet} |
| `escolherPet` | Escolher qual |
| `adicionar` | Adicionar ao app |
| `naoEhMeu` | Não é meu |
| `sexoNaoInformado` | Sexo não informado |
| `consentimento` | O que a clínica pode ver entre as consultas |
| `confirmar` | Confirmar |
| `faltam` | Escolha o que fazer com {n} pet \| Escolha o que fazer com {n} pets |
| `naoSouEu` | Não sou eu |
| `naoQuero` | Não quero vincular |
| `respondido` | Você já respondeu este convite. |
| `recusado` | Você recusou este convite em {data}. |
| `vencido` | Este convite venceu. Peça um novo à clínica. |
| `correcaoTitulo` | O que está errado? |
| `correcaoEnviada` | A clínica recebeu seu aviso. |

Termo: **responsável**, nunca "tutor", em texto visível em português.

---

## 7. Como fazer o mock

O `demo-responsavel.json` do doc 09 **não** traz propostas (a responsável da demonstração já é
cliente). Monte `mock-vinculo.ts` com estas três, que cobrem os casos da seção 4:

```ts
import type { VinculoProposto } from './contrato'

export const PROPOSTAS_DE_DEMONSTRACAO: VinculoProposto[] = [
  {
    id: 'vp-bicho-feliz',
    clinica: { id: 'clinica-demo', nome: 'Clínica Veterinária Bicho Feliz', telefone: '(11) 3555-0142', utcOffset: '-03:00' },
    origem: 'IMPORTACAO',
    situacao: 'PENDENTE',
    propostoEm: '2026-09-29T10:00:00-03:00',
    expiraEm: '2026-10-29T10:00:00-03:00',
    dadosNaClinica: { nome: 'Carla Menezes', telefoneMascarado: '(11) 9••••-4321', emailMascarado: 'ca•••@exemplo.com' },
    pets: [
      // Com sugestão: o app já tem uma "Pipoca" canina desta pessoa.
      { id: 'pc-pipoca', nome: 'Pipoca', especie: 'CANINA', raca: 'Shih Tzu', sexo: 'FEMEA', nascimento: '2021-03-01', sugestaoDoApp: { id: '<pet do app>', nome: 'Pipoca', fotoUrl: null } },
      // Sem sugestão, sexo e nascimento em branco: "Adicionar ao app".
      { id: 'pc-nino', nome: 'Nino', especie: 'FELINA', raca: 'SRD', sexo: null, nascimento: null, sugestaoDoApp: null },
      // O "não é meu" da demonstração.
      { id: 'pc-pingo', nome: 'Pingo', especie: 'CANINA', raca: 'Poodle', sexo: 'MACHO', nascimento: '2018-07-22', sugestaoDoApp: null },
    ],
  },
  { /* igual, situacao: 'EXPIRADO' — para a tela de vencido */ } as VinculoProposto,
  { /* igual, pets: [] — o responsável que era só contato */ } as VinculoProposto,
]
```

Os nomes são os da planilha de demonstração do portal (linhas 9 a 11 da "Planilha feita na
clínica"): a mesma história nos dois lados. O mock simula a API — `responder` muda a `situacao`
para `RESPONDIDO` e acrescenta a clínica em "Minhas clínicas"; `recusar`, para `RECUSADO`.

---

## 8. O que a API precisa ter quando sair do mock

Registro para o time da API.

1. As rotas de `ROTAS_DO_VINCULO`, sob `tutor/clinica`.
2. **Achar a conta** pelo telefone normalizado ou pelo e-mail que a importação gravou — só
   contato **verificado** da conta; sem isso, o convite vai por SMS/WhatsApp com deep link.
3. **Uma proposta por responsável e clínica**, com `expiraEm` (Decisão: 30 dias) e os pets que
   ainda não têm vínculo com a clínica. Pet já vinculado não entra.
4. `sugestaoDoApp`: mesmo nome normalizado (sem acento, minúsculo) e mesma espécie, entre os pets
   do dono sem vínculo com essa clínica. Só sugere; nunca liga.
5. `responder` atômico: todos os pets com ação, ou `VINCULO_INCOMPLETO`. `LIGAR` confere que o
   `petId` é do dono (`PET_SEM_ACESSO`); `CRIAR` cria o `Pet` do app com os dados da clínica;
   `NAO_E_MEU` avisa a clínica (aparece para ela como pendência no paciente).
6. `recusar` com `NAO_SOU_EU` avisa a clínica de que aquele contato não é daquele responsável.
7. `pedirCorrecao` vira aviso para a clínica, com o texto da pessoa.
8. Notificação `VINCULO_PROPOSTO` (entra em `TipoNotificacao`, `NOTIFICACAO_CATALOG`,
   `ROTA_POR_TIPO`) com o texto de `TEXTO_PT_DA_NOTIFICACAO_DO_VINCULO`. Sem `petId` na url: a
   proposta é da pessoa.
9. LGPD: a clínica é a controladora dos dados que importou; o convite é o momento de a pessoa
   saber disso. O texto da tela ("trouxe seu cadastro do sistema que ela usava antes") é a
   transparência mínima — o jurídico pode querer mais.

## 9. Fora deste protótipo

- O **botão de convidar** do lado da clínica (o portal ainda não manda convite nenhum).
- Histórico clínico importado (vacinas, consultas): a importação hoje só traz cadastro.
- Recusar um pet e pedir para a clínica apagá-lo: "não é meu" avisa; apagar é decisão da clínica.
