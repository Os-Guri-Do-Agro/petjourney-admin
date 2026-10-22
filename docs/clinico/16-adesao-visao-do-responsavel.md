# 16 · Adesão ao tratamento — visão do responsável (para o `petjourney-app`)

**Para:** quem trabalha no `petjourney-app`.
**De:** o `petjourney-admin`, onde o lado da clínica existiu primeiro como protótipo
([15-adesao-ao-tratamento.md](./15-adesao-ao-tratamento.md)).

> **Atualização (22/10/2026): o contrato agora é o OpenAPI da API.** Como no doc 09: os tipos saem
> do `contrato/openapi.json` do `develop` do `petjourney-api`, e a referência de cada tela é o guia
> de handoff da onda (adesão ao tratamento: guia da E4). Onde este texto e o guia divergirem, vale o
> guia.

O vet prescreve; o app lembra na hora da dose; alguém da casa toca **Dei**; e o vet vê, no retorno,
se o tratamento foi feito. O app já faz metade disso: o "Criar lembretes" da receita (doc 09, seção
8) vira uma `LembreteSerie` `MEDICAMENTO`, e cada dose é uma `LembreteOcorrencia` que a pessoa
conclui. Este documento pede a outra metade:

- **Um toque:** "Dei" no próprio aviso, sem abrir o app.
- **Pulei, com motivo:** esqueci, o pet cuspiu, acabou. Três botões.
- **Quem deu:** com duas pessoas cuidando, o registro diz quem — e a segunda não dá de novo.
- **Sem virar spam:** remédio de 8 em 8 horas por 14 dias são 42 avisos; as regras abaixo fazem
  deles 42 avisos e nenhum a mais.
- **A clínica vê**, se a casa deixar — e a casa sabe disso antes de criar o lembrete.

O critério de pronto do requisito é **"dá para contar a história inteira numa demonstração:
prescrever, lembrar, confirmar e o vet ver o resultado no retorno"**. O portal tem uma prévia fiel
da tela do app, interativa, ao lado da ficha da clínica (`TratamentoNoApp.vue`) — use-a como
referência de **comportamento**, não de estilo: o estilo é o do app.

Onde está escrito **Decisão**, é um padrão escolhido aqui para você não precisar perguntar. Dá para
mudar, mas a mudança começa na API (a spec e o `contrato/openapi.json`), não no admin nem só no app.

---

## 0. Antes de começar

1. **Gere os tipos do contrato da API**, como no doc 09. Os nomes abaixo eram do contrato escrito
   à mão no admin e ficam como registro do que o protótipo pedia; no OpenAPI, valem os da API:
   - **"Depois da consulta"** — `ItemDaReceita.tratamentoId` (o item que já virou lembrete),
     `CriarLembretesDaReceita.compartilharComAClinica` e `LembreteCriadoDaReceita.tratamentoId`.
   - **"Adesão ao tratamento"**, a última seção — tudo o que este documento usa.
2. **Recopie os dados de demonstração** (`docs/clinico/contrato/demo-responsavel.json`). Chaves
   novas: `tratamentos` (os remédios de cada pet, vistos pela Fátima) e `avisosDeDose` (os avisos
   que ainda saem hoje, já agrupados). `atendimentos[].receita.itens[].tratamentoId` agora vem
   preenchido.
3. **Nada quebra o build.** O aviso da dose **não** é tipo novo de `TipoNotificacao`: é o aviso do
   lembrete que o app já manda, com botões. `TIPOS_DE_NOTIFICACAO_CLINICA` não mudou.
4. **Nada disto existe na API.** Protótipo sobre o JSON, atrás da mesma chave de mock do doc 09
   (seção 16). A seção 11 lista o que a API precisa ter.
5. Seis idiomas, como sempre (doc 09, seção 15). Em português, **responsável**, nunca "tutor".

### Onde cada coisa mora no app

| O quê | Onde |
|---|---|
| Tela do tratamento (nova) | `app/screens/clinica/tratamento.tsx` — `ROTA_DO_TRATAMENTO`, com `?petId=&id=` |
| "Criar lembretes" | a tela do resumo da consulta (`/screens/clinica/atendimento`, doc 09 seção 8) |
| Aviso da dose | o motor de lembretes que o app já tem, mais a categoria `DOSE_DO_REMEDIO` (seção 4) |
| Chaves de cache | `['clinica', 'tratamentos', petId]` e `['clinica', 'tratamento', id]` |
| Textos | `clinica.adesao.*` nos seis `src/locales/*.json` |

---

## 1. O que a clínica faz, do lado dela

Para você saber o que a pessoa do outro lado está vendo (tudo no portal, doc 15):

- **Prescreve** e, por item, pode marcar **tratamento crítico** ("avisar a clínica se a adesão
  cair"). O app **não** recebe essa marca — ela não muda nada para a casa, e dizer "seu tratamento
  é vigiado" seria o tom que o requisito proíbe.
- **Vê a adesão** de cada remédio: uma faixa com um quadradinho por dose (dada, pulada, sem
  registro) e a frase "Desde a consulta de 19/08: 39 dadas · 1 pulada (acabou o remédio) · 1 sem
  registro". Sem nota, sem porcentagem.
- **Recebe um alerta** quando um crítico perde o ritmo (duas doses puladas em 3 dias, ou o registro
  despencando em quem registrava tudo). O alerta é da clínica: **não vira aviso no celular**.
- **Liga** para a casa e **registra a conversa**. Nada disso chega ao app.

## 2. Onde encosta no que o app já tem

| O que existe | O que muda |
|---|---|
| `LembreteSerie` `MEDICAMENTO` criada pelo "Criar lembretes" da receita | Ganha o `TratamentoDoPet` por cima: o mesmo lembrete, visto dose a dose. `TratamentoDoPet.lembreteSerieId` liga os dois. |
| `LembreteOcorrencia` `CONCLUIDO` | É a dose `DADA`. **Novo:** `PULADA` com motivo, e quem registrou (seção 11). |
| `PATCH /lembrete/:id/status` | Continua existindo para os lembretes avulsos. Para o tratamento, use as rotas de `ROTAS_DA_ADESAO` — elas carregam o motivo e recusam a dose já registrada por outra pessoa. |
| Reaviso (`reavisadoEm`, o segundo e último aviso) | Só em intervalo de 24 h ou mais (seção 4). |
| Família com escopo `LEITURA` / `LEITURA_ESCRITA` | É o mesmo acesso: `LEITURA_ESCRITA` registra, `LEITURA` só vê (seção 5). |

**Decisão:** a tela de lembretes que já existe (`/screens/lembrete/detalhe`) continua mostrando a
série como hoje. O tratamento é uma tela a mais, em `/screens/clinica/`, porque é dela que o aviso
e o "Lembrete ativo" do resumo da consulta partem.

---

## 3. As telas

### 3.1 "Criar lembretes" (a que já existe no resumo da consulta)

Três acréscimos:

- **O horário da primeira dose vem sugerido** — a próxima hora cheia, **a menos que** esperar um
  pouco tire uma dose da madrugada (00h–06h). De 12 em 12 h às 14h10, sugere 18h (a segunda cai às
  6h, não às 3h). De 8 em 8 h, 15h (15h, 23h, 7h). De 6 em 6 h não há como, e a sugestão não finge.
  Procura até 8 horas à frente; a pessoa muda se quiser. A regra de referência é
  `sugerirPrimeiraDose` em `src/features/clinico/domain/adesao.ts` (admin) — copie a lógica, é curta.
- **Compartilhar com a clínica**, um interruptor **ligado**, com a frase: "{clínica} vê o que vocês
  registrarem". Vai em `CriarLembretesDaReceita.compartilharComAClinica`.
- A resposta traz `tratamentoId`: o item passa a mostrar **Lembrete ativo**, que abre a tela do
  tratamento.

### 3.2 A tela do tratamento — `GET /tutor/clinica/tratamentos?petId=` → `TratamentosDoPet`

Uma tela por pet, com os remédios em curso primeiro e os encerrados nos últimos 30 dias depois. Para
cada remédio:

- **Cabeça:** nome, e a posologia em palavras, montada no app como a receita (doc 09, seção 8):
  "meio comprimido · a cada 12 h · por 10 dias", "0,12 mL · a cada 24 h · uso contínuo".
- **Hoje** — `doses`: as doses de hoje e a de ontem que ainda dá para registrar, em ordem. Cada uma:
  - `ABERTA` com `podeRegistrar`: **Dei** (principal) e **Pulei** (secundário). **Pulei** troca os
    dois botões por "Por quê?" e três botões: **Esqueci**, **Cuspiu**, **Acabou** — e um de voltar.
    Nunca campo de texto.
  - `DADA` / `PULADA`: "Dada por você às 08:12", "Dada por Rafael às 09:40", "Pulada por você ·
    Cuspiu". Com `podeDesfazer`, um **Desfazer** discreto (visível, não transparente).
  - `PREVISTA`: o horário, apagado.
  - `SEM_REGISTRO`: "Sem registro", no cinza neutro. **Nunca** "esquecida", nunca em vermelho.
  - A dose de ontem aberta aparece como "Ontem, 08:00".
- **A faixa** — `ultimosDias`: os últimos 14 dias, a mesma que a clínica vê (seção 7). Um quadradinho
  por dose; tocar num dia mostra quem registrou.
- **Desde o início** — `historico`: "Desde 28/06: 86 dadas · 2 puladas · 6 sem registro". Mais para
  trás: `GET …/tratamentos/:id/doses?desde=&ate=`.
- **Compartilhado com a clínica** — com `podeAlterarCompartilhamento` (só o dono), um interruptor;
  sem, a frase ("{clínica} vê estes registros" / "Só a família vê estes registros").
- **Receber avisos deste remédio** — por pessoa (`avisos.recebo`, `PATCH … { receberAvisos }`).
  Desligar os avisos não encerra o tratamento nem para os avisos dos outros.

Quem tem só leitura (`eu.acesso === 'LEITURA'`) vê tudo e não tem botão; uma linha no topo diz por
quê: "Você acompanha os remédios da Pérola; só quem tem acesso de edição registra as doses".

### 3.3 Estados

| Estado | O que a tela mostra |
|---|---|
| Carregando | a estrutura da tela, sem números inventados |
| Sem tratamento | "Nenhum remédio com lembrete para {pet}." — e, se houver receita sem lembrete, o atalho para ela |
| Erro ao registrar | na própria dose: "Não foi possível registrar. Tente de novo." O toque não some em silêncio |
| `DOSE_JA_REGISTRADA` | na própria dose, com o corpo do erro: "Rafael já registrou às 09:40. Não precisa dar de novo." — e a tela recarrega |
| `DOSE_FORA_DA_JANELA` | "Esta dose já fechou. A próxima aparece no horário dela." |
| `SOMENTE_LEITURA` | a linha do topo da seção 3.2 |

---

## 4. O aviso da dose — um toque

- **Categoria** `CATEGORIA_DO_AVISO_DE_DOSE` (`DOSE_DO_REMEDIO`), registrada com
  `Notifications.setNotificationCategoryAsync`, com as ações de `ACOES_DO_AVISO_DE_DOSE`:
  - **Dei** — registra **todas** as doses do aviso (`POST /tutor/clinica/tratamentos/doses`,
    `RegistrarDoses`) **sem abrir o app** (`opensAppToForeground: false`). As que alguém já
    registrou voltam como estão; o aviso some.
  - **Abrir** — leva à tela do tratamento (`AvisoDeDose.url`). Pular fica lá dentro: pular pede
    uma escolha, e escolha não cabe num botão de notificação.
- **Texto** — `TEXTO_PT_DO_AVISO_DE_DOSE` (o backend põe no catálogo, nos idiomas dele; o mock usa
  este):
  - um remédio: "Hora do remédio de Pérola" / "Meloxicam 2 mg/mL · 0,12 mL";
  - dois ou mais, do mesmo pet: "2 remédios de Pérola às 08:00" / "Meloxicam, Omeprazol";
  - de pets diferentes: "Remédios das 08:00" / "Pérola: Meloxicam · Biscoito: Metronidazol".
- **Quando alguém da casa registra**, o aviso some dos celulares dos outros (push silencioso que
  remove a notificação pelo identificador da dose). Ninguém recebe aviso de uma dose já dada.

## 5. Sem virar spam — as regras (`REGRAS_DA_DOSE`)

1. **Um aviso por horário.** Doses de qualquer pet da conta a menos de **15 min** uma da outra saem
   **num aviso só**, no horário da primeira.
2. **Segundo aviso só com intervalo de 24 h ou mais** (uma vez por dia, semanal…), e só um — o
   `reavisadoEm` que a série já tem. De 8 em 8 horas, a próxima dose já é o lembrete; repetir a de
   agora dobraria os avisos do dia.
3. **A dose não cobra.** O registro abre **uma hora antes** da dose e fecha **na hora da dose
   seguinte**; aí ela vira `SEM_REGISTRO`, calada. Não existe aviso de "atrasada", "esquecida" ou
   "você não registrou". Nenhum.
4. **A madrugada fica livre** quando a frequência deixa (seção 3.1).
5. **Cada pessoa desliga os próprios avisos** sem mexer no tratamento nem nos avisos dos outros.

A tela do tratamento diz essas regras para quem recebe, num quadro "Como os avisos funcionam" —
quem sabe que o app não vai insistir não o desliga antes.

## 6. Mais de uma pessoa cuidando

- **Quem recebe:** o dono e quem tem `LEITURA_ESCRITA` no pet, cada um com o seu "receber avisos".
  Quem tem `LEITURA` não recebe aviso de dose — não pode registrar, e um aviso sem ação é ruído.
- **O primeiro que registra fecha a dose para todos.** A segunda tentativa recebe
  `DOSE_JA_REGISTRADA` com o registro de quem veio antes (`ErroDaDose.registroExistente`). A tela
  diz quem e quando. É o que evita a dose dobrada — num diurético ou num anticonvulsivante, dar duas
  vezes também é problema.
- **Só quem registrou desfaz**, e só enquanto a janela está aberta. Desfazer o registro de outra
  pessoa apagaria o que ela viu acontecer.
- **"Você" e nomes:** `QuemRegistrou.eu` diz quando é a própria pessoa. Use o primeiro nome.

## 7. Quem dá e não registra — o caso que não pode parecer acusação

- A dose que passou sem ninguém marcar é `SEM_REGISTRO`: cinza neutro, "Sem registro". Não é
  pulada, não é vermelha, não gera aviso.
- A contagem separa: "86 dadas · 2 puladas · 6 sem registro". **Nunca** some "sem registro" com
  "puladas", e **nunca** mostre porcentagem.
- A faixa usa as mesmas cores da clínica: dada em sálvia, pulada em pêssego, sem registro no cinza
  do trilho vazio, a dose da vez só com contorno. Um par que o daltonismo não confunde (o portal
  conferiu o pêssego escuro do tema escuro — `faixa-cores.css`).
- A casa não sabe que um tratamento é crítico, e não recebe o alerta da clínica.

## 8. Regras que o app não pode quebrar

1. Nenhum texto de cobrança. Nenhum "esqueceu", "atrasou", "não deu".
2. `SEM_REGISTRO` ≠ `PULADA`, em contagem, cor e palavra.
3. Pular sempre com um dos três motivos; dar sempre sem motivo.
4. O servidor decide a janela (`registravelAte`, `podeRegistrar`, `podeDesfazer`) — o app não
   recalcula prazo.
5. Uso contínuo é a **ausência** de `duracaoDias` e de `ultimaDoseEm`. Nunca 365.
6. A marca de crítico e o alerta da clínica não aparecem no app.
7. Compartilhar com a clínica é escolha do dono e aparece na hora de criar o lembrete.

---

## 9. Casos difíceis — e onde estão no JSON

### Quem dá e não registra — Pérola, meloxicam

`tratamentos[0].tratamentos[0]` (Pérola). `historico` traz 6 **sem registro** — os domingos das
primeiras semanas e um dia do mês passado. A dose de hoje às 08:00 está `ABERTA` às 07:30 (o JSON
é uma foto das 07:30); `avisosDeDose` tem o aviso das 08:00.

### Mais de uma pessoa — Pérola

Aos sábados quem registrou foi o **Rafael** (`registradaPor.nome`, `eu: false` para a Fátima) — é o
que `ultimosDias` mostra na faixa. No portal, a **Clara** tem só leitura; no app, ela é um membro
com `LEITURA` no pet.

### Várias vezes ao dia — Cacau (no portal)

O tramadol de 8 em 8 horas da Cacau não é da Fátima e não está no JSON. Para exercitar as regras
da seção 5 no mock, use o gesto da seção 10 ("Criar tratamento de 8 em 8 horas").

### Encerrado — Pérola, omeprazol

`situacao: 'ENCERRADO'`, sem `doses`, com `ultimosDias` terminando no dia da última dose.

## 10. Como fazer o mock

Siga o doc 09, seção 16. O que é novo:

- `tratamentos` do JSON responde `GET /tutor/clinica/tratamentos?petId=`. O mock recalcula a
  situação de cada dose pelo relógio da demonstração, com a regra de `dosesDoTratamento` e
  `REGRAS_DA_DOSE` (`src/features/clinico/domain/adesao.ts` no admin é a referência).
- Registrar, pular, desfazer e o compartilhamento ficam no `AsyncStorage`, e voltam ao JSON no
  "Recomeçar a demonstração".
- `avisosDeDose` vira notificação **local** agendada (`scheduleNotificationAsync`) na hora de cada
  aviso, com a categoria e as ações da seção 4 — é o "um toque" na tela bloqueada.

**Decisão — os gestos da demonstração:** no menu de desenvolvimento, com o mock ligado:

- **"Registrar como Rafael"** — marca a dose aberta de hoje como dada pelo Rafael. Na tela da
  Fátima, a dose vira "Dada por Rafael às …", sem botão: o caso da família, num celular só.
- **"Disparar o aviso agora"** — agenda o próximo `AvisoDeDose` para daqui a 5 segundos.
- **"Criar tratamento de 8 em 8 horas"** — cria um tratamento de teste, para ver as regras de
  agrupamento e de sem-segundo-aviso funcionando.

## 11. O que a API precisa ter quando sair do mock

Registro para o time da API — nada aqui é tarefa do app.

1. **`LembreteOcorrencia`** ganha: status `PULADO` (ou equivalente), `motivoPulo`
   (`ESQUECI | CUSPIU | ACABOU`) e `registradoPorId` (o usuário que tocou — dono ou membro).
2. **`LembreteSerie`** ganha `compartilhadoComAClinica` e a ligação com o item da receita
   (`ConsultaPrescricaoItem.lembreteSerieId` já existe, doc 09).
3. As rotas de `ROTAS_DA_ADESAO`, com os erros `DOSE_JA_REGISTRADA` (409, com o registro de quem
   veio antes) e `DOSE_FORA_DA_JANELA`, e o `SOMENTE_LEITURA` que já existe.
4. **Motor de avisos:** agrupar por 15 min na conta; reaviso só com intervalo ≥ 24 h; nenhum aviso
   para ocorrência fechada ou já registrada; a categoria com ações; remover o aviso dos outros
   aparelhos quando alguém registra.
5. **Janela da dose:** abre 1 h antes, fecha na hora da ocorrência seguinte.
6. **Lado da clínica:** `GET /parceiro/portal/pacientes/:petId/tratamentos` → `AdesaoParaClinica[]`
   — os registros crus, só dos tratamentos que a clínica prescreveu e que a casa compartilha. A
   grade, o resumo e o alerta são conta do portal sobre isso.
7. **Crítico** mora na prescrição da clínica e não é exposto ao app.

## 12. Pronto quando

- A Fátima recebe o aviso das 08:00 da Pérola e toca **Dei** na tela bloqueada; a tela do tratamento
  mostra "Dada por você às 08:0x".
- Com o gesto "Registrar como Rafael", a dose aparece "Dada por Rafael", sem botão.
- **Pulei → Cuspiu** aparece como pulada, com o motivo, e **Desfazer** volta a dose.
- A faixa dos 14 dias bate com a da prévia no portal para o mesmo instante.
- Nenhum texto do app fala em esquecer, atrasar ou falhar.

## 13. Fora deste protótipo

- Renovar a receita pelo app quando o motivo é "acabou".
- Mudar o horário da grade depois de criada.
- Registrar dose fora da janela.
- Estoque do remédio em casa (prever quando acaba).
- Mostrar à casa qualquer coisa do alerta da clínica.
