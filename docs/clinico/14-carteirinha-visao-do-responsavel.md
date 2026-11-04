# 14 · Carteirinha conectada — visão do responsável (para o `petjourney-app`)

**Para:** quem trabalha no `petjourney-app`.
**De:** o `petjourney-admin`, onde o lado da clínica existiu primeiro como protótipo
([13-vacinas-e-carteirinha.md](./13-vacinas-e-carteirinha.md)).

> **Atualização (22/10/2026): o contrato agora é o OpenAPI da API.** Como no doc 09: os tipos saem
> do `contrato/openapi.json` do `develop` do `petjourney-api`, e a referência de cada tela é o guia
> de handoff da onda (vacinação conectada: guia da E4). Onde este texto e o guia divergirem, vale o
> guia.

A clínica aplica uma vacina e a carteirinha que o responsável **já usa** no app muda na mesma
hora — com o selo da clínica, o lote, a dose da série e a próxima dose já marcada. Mesma entidade,
dois lados. É a prova mais fácil de mostrar e a mais difícil de copiar: o concorrente precisaria
ter um app de responsável com base instalada.

Este documento pede ao app o que cabe a ele: **a carteira de vacina que já existe
(`/screens/vacina/lista`) passa a mostrar o que a clínica registrou**, e ganha o protocolo do pet.
Nenhuma tela nova.

O critério de pronto do requisito é **"aplicar na clínica e ver a carteirinha do responsável mudar,
nas duas telas lado a lado, na mesma demonstração"**. O portal já mostra uma prévia fiel dessa
carteirinha ao lado da tela da clínica (`CarteirinhaNoApp.vue`) — use-a como referência visual do
comportamento, não do estilo: o estilo é o do app.

Onde está escrito **Decisão**, é um padrão escolhido aqui para você não precisar perguntar. Dá para
mudar, mas a mudança começa na API (a spec e o `contrato/openapi.json`), não no admin nem só no app.

---

## 0. Antes de começar

1. **Gere os tipos do contrato da API**, como no doc 09. Os nomes abaixo eram do contrato escrito
   à mão no admin e ficam como registro do que o protótipo pedia; no OpenAPI, valem os da API:
   - **"Vacinas aplicadas na clínica"** — `VacinaAplicadaNaClinica` cresceu (seção 2.1) e três
     campos ficaram anuláveis: `lote`, `validadeLote` e `profissional`.
   - **"Carteirinha conectada"**, a última seção — o plano do protocolo e a notificação nova.
   Enums novos no topo: `CARENCIA_DE_ATRASO_DA_VACINA_DIAS`, `VIAS_DE_VACINA`,
   `ORIGENS_DA_VACINA`, `PROCEDENCIAS_DA_VACINA_EXTERNA`.
2. **Nada disso quebra o build.** O app ainda não consome `VacinaAplicadaNaClinica` (não existe
   `src/features/clinica/` no repositório), e a notificação `VACINA_REGISTRADA_PELA_CLINICA` fica
   **fora** de `TIPOS_DE_NOTIFICACAO_CLINICA`, pelo mesmo motivo da do vínculo (doc 12): aquele
   `Record` é fechado no app. Ela entra lá quando esta tela for feita — no admin primeiro.
3. **Nada disto existe na API.** Protótipo com os dados de demonstração, atrás da mesma chave de
   mock do doc 09 (seção 16).
4. **Seis idiomas**, como sempre: `pt`, `en`, `en-GB`, `es`, `sr`, `ar` (RTL). Os textos em pt
   estão na seção 6; os outros cinco já existem no portal, na chave `clinico.vacinas.app.*` de
   `src/locales/*.json`, e podem servir de base.

### Onde cada coisa mora no app

| O quê | Onde |
|---|---|
| Tipos | `src/features/clinica/contrato.ts` (a cópia) |
| A carteira (lista) | `app/screens/vacina/lista.tsx` — faixa de resumo, cartões por ano |
| O cartão | `components/VacinaCard.tsx` + `LembreteStatusInline` |
| O detalhe | `app/screens/vacina/detalhe.tsx` |
| Protocolo do responsável | `constants/vacina-protocols.ts` (continua valendo, com a ressalva da seção 4) |
| Carência de atraso | `constants/vacina-atraso.ts` (`VACINA_ATRASO_DIAS = 3`) |
| Dados de demonstração | `docs/clinico/contrato/demo-responsavel.json` e `demo-carteirinha-aplicacao.json`, no admin |

---

## 1. O que a clínica faz, do lado dela

Para você saber de onde vem cada campo — não é preciso reproduzir nada disso no app.

- **Aplica** a vacina escolhendo o **lote do estoque** (o vencido aparece travado; o que vence
  primeiro vem sugerido), a **via** (subcutânea, intramuscular, intranasal ou oral, conforme a
  vacina) e **quem aplicou**. A dose da série e a data da próxima saem do protocolo e ficam
  **congeladas** na aplicação.
- **Marca a próxima dose na agenda** na mesma gravação, quando ela cai dentro de 60 dias (dose da
  série). O reforço anual não é marcado: entra na lista de chamada da clínica 30 dias antes.
- **Registra dose de outro lugar** (pet shop, campanha, outra clínica): **sem lote**, com o local,
  quem aplicou lá (se o papel disser), quem registrou aqui e a **procedência** — `COMPROVANTE` (a
  clínica viu o papel) ou `RELATO` (só a palavra do responsável). As duas contam para o protocolo.
- Monta o **protocolo por espécie e idade**: série de filhote (antes de 16 semanas, mais doses) ou
  de adulto sem histórico; idade mínima por vacina (V10 com 6 semanas, antirrábica com 12);
  opcionais (giárdia, gripe canina, FeLV) só entram quando alguém começa.

---

## 2. O que chega

### 2.1 `GET /tutor/clinica/vacinas?petId=` → `VacinaAplicadaNaClinica[]`

Uma por dose **registrada pela clínica** — aplicada nela ou transcrita de fora.

| Campo | O que é | Como aparece |
|---|---|---|
| `origem` | `CLINICA` ou `EXTERNA` | decide o selo (seção 3.3) |
| `clinica` | quem registrou | na `CLINICA`, é o selo "Aplicada · {nome}" |
| `profissional` | quem aplicou; `null` na `EXTERNA` | detalhe |
| `vacina` | `nome`, `fabricante`, `obrigatoria`, `essencial` | título do cartão |
| `aplicadaEm` | data e hora (na externa, meio-dia do dia do papel) | data do cartão / trilho |
| `lote`, `validadeLote` | `null` na `EXTERNA` | linha de lote |
| `via` | `null` quando o papel de fora não diz | linha de lote |
| `dose`, `dosesNaSerie` | "2 de 3" — o total é o **deste** pet, congelado | meta do cartão |
| `proximaDoseEm` | congelada na aplicação | linha de lembrete |
| `proximaDoseAgendada` | `{ agendamentoId, inicio }` ou `null` | "Marcada 27/10, 08:00" |
| `situacao` | `EM_DIA`, `PROXIMO`, `VENCIDO`, `SERIE_INCOMPLETA` | tom da linha de lembrete |
| `externa` | `local`, `aplicador`, `procedencia`, `registradaPor`, `registradaEm`; `null` na `CLINICA` | selo e detalhe |
| `vacinaDaCarteiraId` | a `Vacina` do app que esta aplicação fechou | uma linha só (seção 4) |

Duas regras de leitura que o servidor já resolve — o app **não recalcula**:

- **`VENCIDO` já é o atraso do app.** A situação só vira `VENCIDO` depois da carência de
  `CARENCIA_DE_ATRASO_DA_VACINA_DIAS` (3). Entre a data e a carência é `PROXIMO`.
- **Só a dose mais recente de cada vacina cobra.** A dose 1 de uma série já seguida pela dose 2
  vem com `situacao: 'EM_DIA'` e `proximaDoseAgendada: null` — a dose seguinte já foi dada.

### 2.2 `GET /tutor/clinica/vacinas/plano?petId=` → `PlanoVacinalDoPet`

O protocolo inteiro, com onde o pet está nele. Calculado na hora (muda com o calendário); o app
não guarda cópia.

- `vacinas[]` — uma por vacina **essencial** da espécie, mais as opcionais já iniciadas, ordenadas
  pelo que pede ação: `ATRASADA`, `DEVIDA`, `A_VENCER`, `NAO_INICIADA`, `AGUARDA_IDADE`, `EM_DIA`.
- Cada uma tem `tipoDeSerie` (`FILHOTE`/`ADULTO`), `aplicadasNaSerie`, `total` e `doses[]`: a série
  na ordem e, no fim, o reforço anual (`tipo: 'REFORCO'`).
- Cada dose tem `estado`: `APLICADA` (com `aplicacaoId`), `DEVIDA`, `ATRASADA`, `PREVISTA`,
  `AGUARDA_IDADE` (o `em` é o dia em que o pet completa a idade mínima) ou `PENDENTE` (essencial
  nunca começada, pet já com idade). E `agendamento` quando a clínica marcou.
- `opcionaisNaoIniciadas[]` — só nome e fabricante. **Nunca** viram pendência.
- `atrasadas` — a contagem, igual à da faixa de resumo.

Pet de espécie sem vacina no catálogo da clínica (réptil, roedor) recebe `vacinas: []`.

### 2.3 Notificação `VACINA_REGISTRADA_PELA_CLINICA`

Sai quando a clínica registra uma dose — é o "na hora" da carteirinha. Dados em
`DadosDaVacinaRegistrada`; rota `ROTA_DA_NOTIFICACAO_DA_VACINA` (`/screens/vacina/lista`), com
`petId` e `id` (a aplicação) na query; texto em `TEXTO_PT_DA_NOTIFICACAO_DA_VACINA`:

| Caso | Título | Corpo |
|---|---|---|
| Aplicada, próxima marcada | Biscoito tomou V10 (múltipla canina) (dose 2 de 3) | PetJourney Clínica Veterinária. A próxima já está marcada: 27/10 às 08:00. |
| Aplicada, sem horário | Pérola tomou Antirrábica | PetJourney Clínica Veterinária. Próxima dose até 29/09/2027. |
| Externa | V10 (múltipla canina) (dose 1 de 3) na carteirinha de Biscoito | Registrada por PetJourney Clínica Veterinária como dose de outro local. |

**Decisão:** quando a próxima dose é marcada na mesma gravação da aplicação, a API **não** manda
também `AGENDAMENTO_CRIADO_PELA_CLINICA`. O corpo acima já diz o horário; dois pushes no mesmo
segundo sobre o mesmo ato é o tipo de ruído que ensina a desligar notificação.

### 2.4 Como isso encosta no que o app já tem

Continua valendo a tabela do doc 09, seção 2: a aplicação da clínica vira **uma** `Vacina` na
carteira (`vacinaDaCarteiraId`) e a próxima dose vira a `LembreteSerie` `VACINA` com a
`dataPrevista` = `proximaDoseEm`. A novidade é só que a linha agora carrega o que a clínica sabe.

---

## 3. A tela: a carteira que já existe

```
┌─────────────────────────────────────┐
│ 🔔 PetJourney · agora            ✕  │  ← o aviso, quando acabou de chegar
│ Biscoito tomou V10 (dose 2 de 3)    │
│ … A próxima já está marcada: 27/10  │
├─────────────────────────────────────┤
│ Carteira de vacinação · Biscoito    │
│  VACINAS 3 │ PRÓXIMA 03/10 │ (ATRASADAS só se > 0)
├─────────────────────────────────────┤
│ PROTOCOLO · PETJOURNEY CLÍNICA …    │  ← bloco novo
│ V10 (múltipla canina)        ● ● ○  │
│ Próxima dose 27/10                  │
│ 📅 Marcada 27/10, 08:00             │
│ ─────────────────────────────────── │
│ Giárdia                      ● ○    │
│ Próxima dose 07/10                  │
│ ─────────────────────────────────── │
│ Antirrábica                         │
│ A partir de 03/10                   │
│ Opcionais não iniciadas: Traqueo…   │
├─────────────────────────────────────┤
│ 2026                                │
│ ┌ 🛡 V10 (múltipla canina)  NOVA ──┐│
│ │ 2 de 3 · 29/09                   ││
│ │ ✔ Aplicada · PetJourney Clínica  ││  ← o selo
│ │ Lote V10-2505 · val. 16/06/2027 · Subcutânea
│ │ 📅 Marcada 27/10, 08:00          ││
│ └──────────────────────────────────┘│
│ ┌ 🛡 Giárdia ───────────────────────┐│
│ │ 1 de 2 · 09/09                   ││
│ │ 📍 Outro local · Canil de origem ││
│ │ Registrada por … · sem comprovante (tom de atenção)
│ │ 🕒 Próxima dose 07/10            ││
│ └──────────────────────────────────┘│
└─────────────────────────────────────┘
```

### 3.1 Faixa de resumo

A que existe, com as regras que ela já tem — e o que vem da clínica entra nas mesmas contas:

- **Vacinas:** as da carteira, contando as da clínica (sem duplicar — seção 4).
- **Próxima:** a primeira dose por vir que **não** está atrasada. Além dos lembretes, entram as
  doses do plano em `PREVISTA`, `DEVIDA`, `AGUARDA_IDADE` e `PENDENTE` — é assim que a antirrábica
  do Biscoito, que ainda não tem lembrete, aparece como próxima.
- **Atrasadas:** só aparece quando há atraso, como hoje. A contagem da clínica (`plano.atrasadas`)
  e a do app (lembretes além de `VACINA_ATRASO_DIAS`) dão o mesmo número porque usam a mesma
  carência. Se divergirem, é defeito — avise.

### 3.2 Bloco de protocolo (novo)

Acima dos cartões, com o título `Protocolo · {clínica}`. Uma linha por vacina do plano **em
andamento ou que pede ação** (`situacao !== 'EM_DIA'` ou `aplicadasNaSerie < total`). O adulto
em dia não aparece aqui: o reforço dele já está na faixa.

- **Nome** e, quando a série tem mais de uma dose, os **pontos**: `total` pontos, cheios até
  `aplicadasNaSerie`, o seguinte com anel (é "onde ele está").
- **A frase da dose da vez**, pelo `estado` (seção 6).
- **"Marcada {data}, {hora}"** quando `agendamento` existe.
- No fim, uma linha pequena: `Opcionais não iniciadas: …`.

Toque numa linha abre o detalhe da vacina (3.4) com a sequência completa. **Decisão:** o bloco não
tem botão "Agendar" próprio; quem agenda é o botão que a linha de lembrete já tem hoje.

### 3.3 O cartão — o selo

| Origem | Linha do selo | Linha de baixo |
|---|---|---|
| `CLINICA` | ícone `shield-check` + **Aplicada · {clínica}**, na cor do perfil | `Lote {lote} · val. {validade} · {via}` |
| `EXTERNA` + `COMPROVANTE` | ícone de lugar + **Outro local · {local}**, neutro | `Registrada por {clínica} · comprovante conferido` |
| `EXTERNA` + `RELATO` | igual | `Registrada por {clínica} · ` **`sem comprovante`** (tom de atenção) |
| registrada pelo responsável | nada novo — o cartão de hoje | — |

**O selo é só da `CLINICA`.** A clínica não pode assinar o que não aplicou; a externa diz onde foi
e quem a transcreveu.

A **linha de lembrete** (o `LembreteStatusInline`) passa a dizer, em ordem de prioridade:
`VENCIDO` → "Atrasada há N dias" (tom negativo); com `proximaDoseAgendada` → "Marcada {data},
{hora}"; data de hoje ou passada dentro da carência → "Dose para hoje"; senão → "Próxima dose
{data}".

### 3.4 O detalhe

`/screens/vacina/detalhe`, para uma vacina da clínica, ganha uma seção **"Da clínica"**:

- Aplicada aqui: quem aplicou (`profissional.nome`), lote, validade, fabricante, via, dose X de Y.
- De outro lugar: onde, quem aplicou lá (se houver), a procedência, quem registrou e quando — e
  "sem lote" dito em texto, não um campo vazio.
- A **sequência** da vacina, do plano: cada dose com data e estado, e a da vez marcada.
- A próxima dose, com o horário quando marcado.

### 3.5 A linha nova

Aberta pela notificação (`?id=` na rota), a tela **rola até a aplicação** e marca o cartão com
borda na cor do perfil e o rótulo **Nova** até a pessoa sair da tela. É o que a plateia procura
na demonstração — sem pintar o cartão inteiro.

Movimento: a linha que entra aparece com 150–200 ms de opacidade e deslocamento curto, e nada mais.
Respeite a preferência de movimento reduzido do sistema.

### Estados

| Situação | Mostra |
|---|---|
| Carteira sem nada da clínica | a carteira de hoje; sem bloco de protocolo se `plano.vacinas` vier vazio |
| Filhote sem nenhuma dose | o bloco de protocolo com "Ainda não começou" e "A partir de {data}" — a carteira não fica vazia de sentido |
| Espécie sem protocolo | sem bloco; a carteira de hoje |
| Plano falhou ao carregar | a carteira sem o bloco, sem erro na tela (o bloco é complemento) |

---

## 4. Regras que o app não pode quebrar

1. **A próxima dose da clínica não é recalculada.** `intervaloProximaDose`
   (`constants/vacina-protocols.ts`) continua valendo só para o que o responsável registra
   sozinho. Para a aplicação da clínica, a data é `proximaDoseEm`. Os dois protocolos não batem de
   propósito (o do app usa 30 dias na série; o da clínica, 28) e é a clínica que aplica.
2. **Atraso é um relógio só.** `VENCIDO` e `ATRASADA` já incluem a carência de 3 dias. Não aplique
   `vacinaEstaAtrasada` de novo sobre eles — seria contar a carência duas vezes.
3. **Uma linha por aplicação.** A `Vacina` que `vacinaDaCarteiraId` aponta é a mesma linha: ela
   ganha os dados da clínica, não aparece de novo.
4. **Selo só na `CLINICA`.** Nunca na externa, nunca na registrada pelo responsável.
5. **`AGUARDA_IDADE` não é atraso nem pendência.** A antirrábica de um filhote de oito semanas diz
   "A partir de {data}". Uma carteira que cobra o que ainda não cabe ensina o responsável a
   ignorá-la.
6. **Opcional não iniciada não é pendência** e não entra em contagem nenhuma.
7. **A série é a que veio.** "2 de 3" é o que está escrito na aplicação (`dose`/`dosesNaSerie`),
   mesmo que o pet já tenha crescido e uma série nova dele fosse menor.
8. **Data com ano quando não é deste ano.** O reforço anual cai no mesmo dia e mês de hoje, um ano
   depois: sem o ano, "29/09" lê como hoje.

---

## 5. Casos difíceis — e onde estão no JSON

### Filhote em protocolo múltiplo — o Biscoito

Onze semanas. A V10 1 de 3 foi no pet shop (externa, com comprovante), a 2 de 3 **vence hoje**, a
antirrábica só cabe **a partir de 03/10**. No JSON: `vacinas` (duas externas), `planosVacinais`
(`pet-biscoito`). A tela precisa mostrar a sequência inteira e onde ele está: pontos `● ○ ○` na
V10 com o segundo em anel, "Dose para hoje", e a antirrábica em "A partir de".

Depois que a clínica aplica: `demo-carteirinha-aplicacao.json` (seção 7) — pontos `● ● ○`,
"Marcada 27/10, 08:00", o cartão novo com selo e lote.

### Dose de outro lugar — com e sem comprovante

As duas externas do Biscoito: a V10 com `procedencia: 'COMPROVANTE'` e a giárdia com
`procedencia: 'RELATO'`. Sem lote nas duas. A diferença entre elas é só a palavra no fim da linha
("comprovante conferido" / "sem comprovante", este no tom de atenção) — as duas contam para o
protocolo.

### Lote vencido ou perto de vencer

É trava do lado da clínica: **o app nunca recebe dose de lote vencido** (a API recusa a aplicação
com o lote vencido). O que chega ao app é a validade do lote na linha do cartão, que é o que a
companhia aérea e o hotel conferem. Nada a fazer além de mostrá-la.

### Atraso nos dois lados — a Pérola

A antirrábica da Pérola passou da data há 16 dias: `situacao: 'VENCIDO'`, plano em `ATRASADA`,
`atrasadas: 1`. A faixa mostra **Atrasadas 1**; o cartão, "Atrasada há 16 dias"; e o push que já
existe (`VACINA_ATRASADA`) é o do backend, sem mudança. Quando a clínica aplica (a consulta dela é
hoje), os três somem juntos.

---

## 6. Textos (pt)

Os mesmos da prévia do portal (`clinico.vacinas.app.*` em `src/locales/pt.json`). "Responsável",
nunca "tutor"; sem preposição antes do nome da clínica.

| Onde | Texto |
|---|---|
| Título do bloco | `Protocolo · {clínica}` |
| Opcionais | `Opcionais não iniciadas: {lista}` |
| Selo — aplicada | `Aplicada · {clínica}` |
| Selo — externa | `Outro local · {local}` |
| Registro da externa | `Registrada por {clínica}` |
| Procedência | `comprovante conferido` / `sem comprovante` |
| Linha de lote | `Lote {lote} · val. {data} · {via}` |
| Vias | `Subcutânea`, `Intramuscular`, `Intranasal`, `Oral` |
| Estado — atrasada | `Atrasada há {n} dia` / `Atrasada há {n} dias` |
| Estado — devida | `Dose para hoje` |
| Estado — aguarda idade | `A partir de {data}` |
| Estado — pendente | `Ainda não começou` |
| Estado — prevista | `Próxima dose {data}` |
| Marcada | `Marcada {data}, {hora}` |
| Dose | `{dose} de {total}` / `Dose única` / `Reforço anual` |
| Rótulo da linha nova | `Nova` |
| Faixa | `Vacinas` · `Próxima` · `Atrasadas` |

---

## 7. Como fazer o mock

Os dois arquivos saem do mesmo dataset do portal (`npm run contrato:demo`, no admin), e as datas
se deslocam pela diferença entre `hojeDaClinica` e hoje, como no doc 09 (seção 16):

- **`demo-responsavel.json`** — o "antes". Campos novos: `vacinas` (agora com as externas),
  `planosVacinais` (um por pet com protocolo) e `notificacoesDaCarteirinha` (as
  `VACINA_REGISTRADA_PELA_CLINICA` dos últimos sete dias; fora de `notificacoes` pelo motivo da
  seção 0).
- **`demo-carteirinha-aplicacao.json`** — o "depois": a clínica aplicou a 2ª V10 do Biscoito.
  Traz a `vacina` nova, o `plano` inteiro já avançado, a `notificacao` e o `agendamento` da
  terceira dose (no formato `Agendamento`, para entrar também na lista de horários).

**Decisão — o gesto da demonstração:** com o mock ligado, um item no menu de desenvolvimento
("Simular aplicação da clínica") troca o antes pelo depois: acrescenta a `vacina`, substitui o
plano do Biscoito, acrescenta o `agendamento` e dispara a `notificacao` como notificação local
(`scheduleNotificationAsync`, com os mesmos `dados`). É o que permite a demonstração lado a lado
com o portal numa tela e o celular na outra, sem API.

---

## 8. Pronto quando

- [ ] A carteira do Biscoito mostra o bloco de protocolo com a V10 em `● ○ ○`, "Dose para hoje", e
      a antirrábica em "A partir de 03/10".
- [ ] As duas doses externas aparecem com "Outro local", sem selo e sem lote; a giárdia diz
      "sem comprovante".
- [ ] "Simular aplicação da clínica" faz, na mesma tela aberta: o push chegar, o cartão novo entrar
      com **Nova**, selo e lote, os pontos virarem `● ● ○` e "Marcada 27/10, 08:00" aparecer.
- [ ] A Pérola mostra **Atrasadas 1** e "Atrasada há 16 dias" — o mesmo número que o portal mostra
      ao lado.
- [ ] Nenhuma vacina aparece duas vezes, e o app não calcula data de próxima dose para o que veio
      da clínica.
- [ ] Os textos existem nos seis idiomas e o árabe espelha.

---

## 9. O que a API precisa ter quando sair do mock

- `GET /tutor/clinica/vacinas?petId=` com os campos novos, e `GET /tutor/clinica/vacinas/plano?petId=`
  calculando o plano pela mesma regra do portal (`domain/protocolo-vacinal.ts` no admin é a
  referência, com teste).
- A carência de atraso lida de `AJUSTES.vacinaAtrasoDias`, não de um número próprio.
- Recusar aplicação com lote vencido (a clínica já trava na tela; a regra mora no servidor).
- Ao registrar: criar/atualizar a `Vacina` da carteira e a `LembreteSerie` `VACINA` (doc 09,
  seção 2), e mandar **um** push — `VACINA_REGISTRADA_PELA_CLINICA` —, nunca junto com
  `AGENDAMENTO_CRIADO_PELA_CLINICA` para o mesmo ato.
- `TIPOS_DE_NOTIFICACAO_CLINICA` e `ROTA_POR_TIPO` ganham `VACINA_REGISTRADA_PELA_CLINICA` na mesma
  release, no app e na API.

## 10. Fora deste protótipo

- O responsável **pedir** à clínica que registre uma dose que ele mesmo lançou no app (o caminho
  inverso da externa). A clínica hoje transcreve do papel.
- Foto do comprovante anexada à dose externa.
- Comprovante de vacinação assinado pela clínica dentro do app (o PDF já existe no portal; a
  entrega segue o "Salvar nos documentos" do doc 09).
- Regra das 16 semanas para a última dose do filhote (quem começa com 6 semanas precisaria de uma
  quarta dose). O protótipo usa série fixa por faixa — ver o doc 13, "Decisões".
