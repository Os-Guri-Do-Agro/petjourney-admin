<!-- doc cmvtpgb541fz3rcazodz · "Handoff E6-02: portal-parceiro-e6.md" · atualizado 2026-10-29T15:35:33.908Z · card PJ-ZXGZ7P -->

# Guia do front: Portal do parceiro, E6 (estoque de vacinas)

**Para:** o Luís. Portal web do parceiro (`petjourney-admin`). O app (`petjourney-app`) **não ganha tela nem muda nada** nesta etapa: a carteirinha continua lendo o código e a validade do lote que a aplicação copia.
**Backend:**
- E6-01a (receber lote, editar lote, baixa, estorno, mínimo, geladeira, fornecedores e a ligação do lote com a aplicação de vacina) pronta e validada em dev em 2026-10-28: unit, integração contra o Postgres de dev (inclui a corrida do último frasco) e smoke por HTTP (`npx tsx scripts/smoke-estoque.ts`). **Não está em produção.** A auditoria voltou sem crítico nem alto e os achados médios e baixos estão corrigidos (seções 4, 8 e 9); está no `develop`.
- E6-02 (metas do mês e pedido de compra) pronta e validada em dev em 2026-10-28: unit, integração contra o Postgres de dev, smoke por HTTP (`npx tsx scripts/smoke-metas.ts`) e a medição de uma clínica de 2 anos. **Não está em produção** e ainda não passou pela auditoria. Seção 15 (salvar e ler as metas) e seção 16 (sugestão, simulação do pedido e o texto por fornecedor).
- E6-01b (movimentos, análise e o selo do menu `vacinasAbaixoDoMinimo`) pronta e validada em dev em 2026-10-28 (unit, integração contra o Postgres de dev e a medição de uma clínica de 2 anos): seções 11 a 13. A auditoria voltou com um médio e um baixo, já corrigidos (seções 2, 11, 12 e 13 e o erro `CATALOGO_VACINAS_NO_LIMITE`).

**Spec de origem:** `docs/specs/2026/q4/q4-1/portal-parceiro/e6-estoque/01-lotes-e-movimentos.md` (decisões do gerente de 2026-10-28, P1 a P13).

**Contrato:** `contrato/openapi.json`; gere os tipos dele. Convenções iguais às da onda 0 ([portal-parceiro-e0.md](portal-parceiro-e0.md), seção 1): envelope `{ statusCode, message, data }`; erro com `codigo` (para decidir a tela) e `message` localizada (para mostrar); `?parceiroId=` quando o usuário tem mais de um parceiro. **Datas de entrada e de saída são sempre `AAAA-MM-DD`** (nunca `DD/MM/AAAA`, nunca com hora); só os instantes (`criadoEm`) vêm em ISO com o offset do fuso da clínica. **Dinheiro é inteiro em centavos.**

---

## 1. Quem entra

Todas as rotas exigem o módulo **Clínica** (sem ele: 403 `MODULO_INATIVO`; suspenso: lê, mas a escrita dá 403 `MODULO_SOMENTE_LEITURA`). Sem a permissão: 403 `SEM_PERMISSAO` com `permissao`.

| O quê | Permissão | Quem tem |
|---|---|---|
| Geladeira, fornecedores, movimentos, análise | `estoque.ler` | DONO, GESTOR, VETERINÁRIO, ENFERMAGEM, RECEPÇÃO, FINANCEIRO |
| Receber lote, corrigir lote, dar baixa | `estoque.movimentar` | DONO, GESTOR, VETERINÁRIO, ENFERMAGEM |
| Definir o mínimo, estornar baixa | `estoque.planejar` | DONO, GESTOR |
| Aplicar vacina com lote | `vacina.aplicar` (a de sempre) | como antes |

- **Custo e valor ficam ocultos (P8)** de quem não tem `estoque.planejar` nem `financeiro.ler`: os campos `custoUnitarioCentavos`, `valorParadoCentavos` e `valorEmRiscoCentavos` **não vêm** (não vêm zerados, **não vêm**). Quem recebe digita o custo, mas a resposta dele não traz o custo de volta. Não mostre coluna de custo quando o campo for `undefined`.
- Esconda os botões pelo `GET /parceiro/portal/eu` (a RECEPÇÃO só lê).
- **Lote, baixa ou vacina de outra clínica, ou id que não existe:** 403 `OWNERSHIP_FORBIDDEN`, sempre o mesmo corpo.
- Ações: 120 por hora por pessoa; leituras: 600 por hora. Estourou: 429 `ESTOQUE_TAXA_EXCEDIDA` com `limite` e `tenteDeNovoEmSegundos`.

---

## 2. Geladeira

`GET /parceiro/portal/clinica/estoque/geladeira` (substitui `vacinaRepository.estoque()` e `resumirEstoque` de `domain/estoque-vacinas.ts`: a API decide saldo, situação e cobertura).

```json
{
  "hoje": "2026-10-28",
  "indicadores": {
    "dosesEmEstoque": 21, "dosesVencendo": 1, "lotesVencendo": 1, "dosesVencidas": 0, "lotesVencidos": 0,
    "vacinasAbaixoDoMinimo": 1, "valorParadoCentavos": 63000, "valorEmRiscoCentavos": 3000
  },
  "vacinas": [ VacinaNaGeladeiraDto ],
  "lotes": [ LoteDto ],
  "truncado": false
}
```

- **`vacinas`** são só as que a clínica **guarda** (P7): tem ao menos um lote **ou** um mínimo próprio (`PUT /minimos`). O catálogo inteiro **não** vira linha nem alerta. Vacina inativa no catálogo não aparece.
- `VacinaNaGeladeiraDto`: `{ vacinaId, nome, fabricante, saldo, minimo, minimoPadrao, minimoDaClinica, situacao, abaixoDoMinimo, zerado, pertoDeVencer, dosesVencendo, dosesVencidas, coberturaEmDias, consumoMensal, valorParadoCentavos?, valorEmRiscoCentavos? }`.
  - `saldo` é só o que **aplica hoje**: lote vencido fica de fora (P2). As doses em lote vencido saem em `dosesVencidas` (descarte pendente) e entram no valor em risco.
  - `situacao`: `ABAIXO_DO_MINIMO` (mínimo maior que zero e saldo **menor** que ele), `PERTO_DE_VENCER` (há dose em lote que vence em até 60 dias) ou `OK`. Prioridade nessa ordem; os booleanos `abaixoDoMinimo`, `zerado` e `pertoDeVencer` saem juntos para a tela não perder o segundo fato. **Mínimo 0 nunca alerta** ("não me avise").
  - `coberturaEmDias`: dias que o saldo aguenta no ritmo dos **últimos 90 dias** (P13); `null` sem consumo (escreva "sem consumo", nunca "infinito"). `consumoMensal` é a média de doses por mês na mesma janela.
  - A lista vem ordenada: zeradas, abaixo do mínimo, perto de vencer, ok; dentro, a de menor cobertura.
- **`lotes`**: até **300** (P11), com validade de até 180 dias para trás em diante (o vencido recente aparece como descarte pendente). Ordem: vencido com dose, vencendo, ativo, esgotado; dentro, o que vence primeiro. `truncado: true` se passou de 300 **ou de 256 KB de resposta** (saem primeiro os esgotados, depois os que vencem mais tarde; só se as vacinas sozinhas não couberem é que as do fim saem). O saldo da vacina e os `indicadores` são sempre de **todos** os lotes, não dos que sobraram. Em geral são ~170 KB; passa de 256 KB só com nomes e textos enormes.
- `LoteDto`: `{ id, vacina: { id, nome, fabricante }, codigo, fornecedor, notaFiscal, recebidoEm, validade, quantidadeRecebida, aplicadas, perdidas, saldo, situacao, diasParaVencer, conferidoPor, custoUnitarioCentavos?, valorParadoCentavos?, criadoEm }`.
  - `saldo = quantidadeRecebida - aplicadas - perdidas` (aplicações não anuladas; baixas não estornadas). Nunca negativo.
  - `situacao`: `VENCIDO` (com dose), `VENCENDO` (até 60 dias; **vence hoje ainda aplica**), `ATIVO`, `ESGOTADO`. `diasParaVencer` negativo = vencido.
  - `conferidoPor`: só o **nome**. Nunca o id nem o e-mail de quem recebeu.

---

## 3. Receber lote

`POST /parceiro/portal/clinica/estoque/lotes` (substitui `estoqueRepository.receberLote`). Aceita `Idempotency-Key`: o duplo toque devolve o **mesmo** lote, não `LOTE_DUPLICADO`.

```json
{
  "vacinaId": "...",
  "codigo": "v10-2505",
  "validade": "2027-06-30",
  "recebidoEm": "2026-10-28",
  "quantidade": 10,
  "custoUnitarioCentavos": 3000,
  "fornecedor": "Vetfarma",
  "notaFiscal": "NF-123",
  "conferidoPorProfissionalId": "..."
}
```

- Obrigatórios: `vacinaId`, `codigo`, `validade`, `quantidade`, `custoUnitarioCentavos`.
- `quantidade` é em **doses** (P4), de 1 a 999 (não é frasco). `custoUnitarioCentavos` de 0 a 1.000.000 (centavos por dose).
- `codigo`: letras A a Z (sem acento), números, espaço, `.`, `/`, `-`, `_`; até 40. A API grava em **maiúsculas** e sem espaços nas pontas. Único por clínica **e vacina** (P10): o mesmo código em vacinas diferentes é aceito.
- `recebidoEm`: padrão hoje (na parede da clínica); no futuro ou há mais de 60 dias dá 400 `LOTE_DATA_INVALIDA` (`reason`: `FUTURO`, `ANTIGA_DEMAIS`).
- `validade`: de hoje em diante (vale até o fim do dia). Antes de hoje: 409 `LOTE_JA_VENCIDO`.
- Resposta: 201 `LoteDto`.

Erros: 409 `LOTE_DUPLICADO`, 409 `LOTE_JA_VENCIDO` (`validade`, `hoje`), 409 `LOTES_NO_LIMITE` (`limite: 5000`), 409 `VACINA_INATIVA`, 400 de forma (`DD/MM/AAAA`, quantidade fora da faixa), 403 de vacina ou profissional de outra clínica.

Para o campo "fornecedor": `GET /estoque/fornecedores` devolve `{ itens: string[] }` (os 50 mais recentes, sem repetir e sem distinguir maiúsculas) para o autocompletar.

---

## 4. Corrigir o lote

`PATCH /estoque/lotes/:id` com `{ fornecedor?, notaFiscal?, custoUnitarioCentavos? }`. **Só esses três.** O **custo** só muda com `estoque.planejar` ou `financeiro.ler` (quem não vê o custo não o sobrescreve): sem isso, 403 `SEM_PERMISSAO` (`permissao: estoque.planejar`) e **nada** é gravado, nem o fornecedor que veio junto. Fornecedor e nota seguem com `estoque.movimentar`. Para a enfermagem, mande só `fornecedor` e `notaFiscal`. Código, validade e quantidade não se editam (mandar dá 400); a quantidade se corrige pela **contagem** (seção 5). `null` em fornecedor ou nota limpa; em custo dá 400. Corpo vazio dá 400. Devolve `LoteDto`. Quem tem `estoque.movimentar` corrige fornecedor e nota (inclui a enfermagem).

---

## 5. Dar baixa

`POST /estoque/lotes/:id/baixa` (substitui `estoqueRepository.registrarBaixa`). Aceita `Idempotency-Key`.

```json
{ "motivo": "QUEBRA", "quantidade": 2, "observacao": "caiu da bandeja" }
{ "motivo": "CONTAGEM", "contadas": 5 }
{ "motivo": "VENCIMENTO" }
```

- `motivo`: `QUEBRA`, `TEMPERATURA`, `VENCIMENTO`, `CONTAGEM`.
- `null` em `quantidade` ou em `contadas` dá 400 (não é "o saldo inteiro"). Omita o campo que não se aplica.
- **Exatamente um** entre `quantidade` (1 a 999) e `contadas` (0 a 999):
  - `CONTAGEM` exige `contadas` e não aceita `quantidade`: a pessoa diz **quantas doses achou** e a baixa é a diferença para o saldo. Contagem **maior** que o saldo: 409 `CONTAGEM_ACIMA_DO_SALDO` (`saldo`, `contadas`; dose a mais quase sempre é aplicação registrada no lote errado, então a mensagem manda conferir as aplicações). Contagem igual: 409 `CONTAGEM_SEM_DIFERENCA`.
  - `VENCIMENTO` só em lote **vencido** (409 `BAIXA_VENCIMENTO_PREMATURA` se ainda vale); sem número, é o **saldo inteiro** ("descartar" abre assim).
  - Os outros exigem `quantidade`.
  - Forma errada: 400 `BAIXA_DADOS_INVALIDOS` com `reason` (`QUANTIDADE_E_CONTADAS`, `CONTADAS_FORA_DA_CONTAGEM`, `CONTAGEM_SEM_CONTADAS`, `SEM_QUANTIDADE`).
- `quantidade` maior que o saldo (ou saldo 0): 409 `BAIXA_ACIMA_DO_SALDO`.
- **O dia da baixa é o de hoje na clínica, gravado pela API**: não mande data (mandar dá 400). Baixa não se retroage.
- Resposta 201 `BaixaDto`: `{ id, loteId, em, quantidade, motivo, observacao, estornada, saldoDoLote, criadaEm }`. `saldoDoLote` é o saldo **depois** da baixa; use para atualizar a linha sem reler a geladeira.

## 6. Estornar uma baixa

`POST /estoque/baixas/:id/estornar` com `{ motivo }` (10 a 300 caracteres). **Só `estoque.planejar`** (DONO e GESTOR): quem dá a baixa não a apaga. Devolve `BaixaDto` com `estornada: true` e o `saldoDoLote` já com as doses de volta. A baixa **não some**: continua na tabela (e nos movimentos da 01b), marcada. Estornar duas vezes: 409 `BAIXA_JA_ESTORNADA`.

---

## 7. Mínimo por vacina

`PUT /estoque/minimos/:vacinaId` com `{ minimo }` (0 a 9999; fora disso, 400 `MINIMO_INVALIDO`). **Só `estoque.planejar`.** Resposta `{ vacinaId, minimo, minimoPadrao }`.

- `0` é válido: "não me avise" (a vacina continua na geladeira, sem alerta).
- Não há `DELETE`. Para **voltar ao do catálogo**, envie o valor de `minimoPadrao` (P6).
- Definir o mínimo faz a vacina **uma das que a clínica guarda**: ela entra na geladeira e no alerta mesmo sem lote.

---

## 8. Aplicar vacina com o lote do estoque (muda a tela de aplicar)

Rota que já existe: `POST /parceiro/portal/pacientes/:id/vacinas/aplicar`. **Aditivo**, não quebra a build atual do portal.

1. **Escolher o lote:** `GET /parceiro/portal/clinica/vacinas/:vacinaId/lotes-para-aplicar` (conta no balde de leitura do estoque, 429 `ESTOQUE_TAXA_EXCEDIDA`; sob carga, 503 `ESTOQUE_OCUPADO`: tente de novo em 2 segundos) agora devolve, quando a clínica tem lotes **dessa vacina** no estoque, `estoque: true` e cada lote com `loteId`, `saldo` e `avaliacao`; **só os lotes com dose**. O que vence primeiro vem `sugerido: true`; o vencido (com dose) vem no fim, travado (`avaliacao.pode: false`, `motivo: VENCIDO`). Sem nenhum lote da vacina no estoque, continua como antes: `estoque: false`, `loteId: null`, `saldo: null`, os lotes já digitados.
2. **Aplicar:** mande `loteId` no lugar de `loteCodigo` + `validadeLote` (os dois ficam **opcionais**; sem `loteId`, os dois continuam obrigatórios, 400).
   - O **código e a validade da carteirinha saem do lote** na API, não do corpo.
   - A dose baixa do saldo **na mesma gravação**, sob trava. Quem digitou o último frasco depois de outro: 409 **`LOTE_SEM_SALDO`** (nada gravado, nada vai ao app): releia a lista de lotes.
   - Se digitarem em `loteCodigo` o código de um lote do estoque (sem `loteId`), a API trata como **aquele lote** (baixa a dose); se a `validadeLote` não bater com a dele: 409 `LOTE_VALIDADE_DIVERGENTE` (`validadeDoLote`).
   - Código **com letra fora do A a Z** (acento, ou um "O" cirílico no lugar do "O"), de uma clínica que já tem lotes dessa vacina: 409 **`LOTE_CODIGO_NAO_ASCII`** com `exigeConfirmacao: true` e a mensagem pedindo para conferir o frasco. Se a pessoa confirmar, mande de novo com `confirmarCodigoDoLote: true`: aplica como lote fora do estoque (aviso abaixo). Os lotes do estoque só têm A a Z e números, então um código assim nunca baixa uma dose do estoque.
   - Código que **não existe** no estoque, de uma clínica que já tem lotes dessa vacina: aplica normalmente (não bloqueia a vacina na mesa de exame, P3) e a resposta traz `avisos: ["LOTE_FORA_DO_ESTOQUE"]`. Mostre o aviso e leve a clínica a cadastrar o frasco.
3. Erros novos no aplicar: 409 `LOTE_SEM_SALDO`, `LOTE_DE_OUTRA_VACINA`, `LOTE_AINDA_NAO_RECEBIDO` (aplicação retroativa em lote que chegou depois do dia dela; `recebidoEm`, `aplicadaEm`), `LOTE_VALIDADE_DIVERGENTE`; 403 para lote de outra clínica. `LOTE_VENCIDO` é o de sempre.
4. A resposta e o histórico trazem `lote: { codigo, validade, loteId? }`; o `loteId` só vem quando a dose baixou do estoque.
5. **Anular a aplicação devolve a dose ao saldo sozinha** (o saldo é derivado das aplicações não anuladas). Não há chamada nova.
6. Dose **externa** (de outro lugar) nunca baixa estoque: a rota dela não aceita lote.

---

## 9. Erros novos (para decidir a tela)

| `codigo` | Status | Quando |
|---|---|---|
| `LOTE_DUPLICADO` | 409 | código repetido na clínica e vacina |
| `LOTE_JA_VENCIDO` | 409 | receber lote com validade antes de hoje |
| `LOTE_DATA_INVALIDA` | 400 | `recebidoEm` no futuro ou há mais de 60 dias (`reason`) |
| `LOTES_NO_LIMITE` | 409 | 5000 lotes na clínica |
| `LOTE_SEM_SALDO` | 409 | aplicar em lote sem dose |
| `LOTE_AINDA_NAO_RECEBIDO` | 409 | aplicação retroativa em lote recebido depois |
| `LOTE_DE_OUTRA_VACINA` | 409 | lote da clínica, mas de outra vacina |
| `LOTE_VALIDADE_DIVERGENTE` | 409 | código do estoque com validade diferente |
| `LOTE_CODIGO_NAO_ASCII` | 409 | código digitado com letra fora do A a Z numa clínica que guarda a vacina (`exigeConfirmacao`; confirme com `confirmarCodigoDoLote`) |
| `CONTAGEM_ACIMA_DO_SALDO` | 409 | contou mais doses que o saldo |
| `CONTAGEM_SEM_DIFERENCA` | 409 | contou o mesmo que o saldo |
| `BAIXA_ACIMA_DO_SALDO` | 409 | quantidade maior que o saldo |
| `BAIXA_DADOS_INVALIDOS` | 400 | `quantidade` e `contadas` juntas ou faltando (`reason`) |
| `BAIXA_VENCIMENTO_PREMATURA` | 409 | VENCIMENTO em lote que ainda vale |
| `BAIXA_JA_ESTORNADA` | 409 | estornar duas vezes |
| `MINIMO_INVALIDO` | 400 | mínimo fora de 0 a 9999 |
| `ESTOQUE_PERIODO_INVALIDO` | 400 | período dos movimentos invertido ou com mais de 366 dias (`reason`: `INVERTIDO`, `LONGO_DEMAIS`; `maxDias`) |
| `ESTOQUE_TAXA_EXCEDIDA` | 429 | `limite`, `tenteDeNovoEmSegundos` |
| `CATALOGO_VACINAS_NO_LIMITE` | 409 | `POST` de vacina própria da clínica no catálogo (`/parceiro/portal/clinica/catalogos/vacinas`): a clínica já tem 200 vacinas próprias, ativas ou não (`limite: 200`). O catálogo não apaga e a desativada também conta: mande falar com o suporte |
| `ESTOQUE_OCUPADO` | 503 | as leituras do estoque (geladeira, lotes para aplicar) estão ocupadas; `motivo` (`FILA_CHEIA`, `ESPERA_ESGOTADA`, `CLINICA_NO_TETO`), `tenteDeNovoEmSegundos` (2). Uma clínica tem no máximo 3 leituras ao mesmo tempo: não abra a geladeira em polling rápido em várias abas |

Textos localizados nos 6 idiomas (en-GB explícito). **Nenhum tipo de notificação novo**: o estoque não fala com o responsável do pet, então nada entra em `rotas-notificacao.ts`.

## 10. O que sai do mock do portal

- `estoqueRepository.receberLote`, `registrarBaixa`, `ajustarMinimo`, `fornecedores` e a geladeira (`resumirEstoque`) passam a chamar as rotas acima. `LIMITE_DE_DOSES = 999` fica só como dica de campo; a API recusa.
- `EstoqueRecusadoError.kind` do mock vira o `codigo` do erro: `codigo-repetido` → `LOTE_DUPLICADO`, `validade-passada` → `LOTE_JA_VENCIDO`, `acima-do-saldo` → `BAIXA_ACIMA_DO_SALDO`, `contagem-acima-do-saldo` → `CONTAGEM_ACIMA_DO_SALDO`, `contagem-sem-diferenca` → `CONTAGEM_SEM_DIFERENCA`, `minimo-invalido` → `MINIMO_INVALIDO`.
- Duas diferenças de regra em relação ao mock: **lote que vence hoje é aceito** (o mock exigia validade depois de hoje), e **vacina zerada com mínimo 0 não alerta** (o mock contava `zerado`).

## 11. Movimentos

`GET /parceiro/portal/clinica/estoque/movimentos?tipo=&de=&ate=&cursor=&limit=` (substitui `estoqueRepository.movimentos()` e `movimentosDoEstoque`). `estoque.ler`. Entradas (lotes recebidos) e baixas, **da mais recente para a mais antiga**. A aplicação **não** entra: ela tem lista própria (`GET /clinica/vacinas/aplicadas`).

- `tipo`: `ENTRADA` ou `BAIXA`; sem ele, as duas. Outro valor: 400.
- `de` e `ate` em `AAAA-MM-DD` (parede da clínica, os dois inclusive). Sem nada: os últimos 30 dias. Só `de`: até hoje. Só `ate`: 30 dias para trás dele. **No máximo 366 dias**: mais que isso, ou `de` depois de `ate`, dá 400 `ESTOQUE_PERIODO_INVALIDO`. O período filtra o **dia em que o movimento foi registrado** (que também ordena a lista); a data do movimento em si vem em `em`.
- `limit` de 1 a 50 (padrão 20). `cursor` é o `proximoCursor` da página anterior; é opaco e **carrega o período que a primeira página resolveu**: nas páginas seguintes **não mande `de` e `ate`** (ou mande exatamente os mesmos). Sem período no pedido, o padrão ("os últimos 30 dias") fica fixo no cursor, então virar a meia-noite da clínica no meio da lista não quebra a paginação. O cursor vale só para o mesmo `tipo` (outro `tipo`, outro período ou outra clínica: 400 `CURSOR_INVALIDO`). Ao mudar o filtro, comece sem cursor.
- A página tem **no máximo 256 KB**: com textos enormes ela pode vir com **menos itens que o `limit`** e ainda assim com `proximoCursor`. Siga o cursor, não conte itens.
- Resposta `{ de, ate, itens, proximoCursor }` (`proximoCursor` nulo na última página). Cada item (`MovimentoDto`):

```json
{
  "id": "...", "tipo": "BAIXA", "em": "2026-10-28", "criadoEm": "2026-10-28T09:12:00-03:00",
  "loteId": "...", "codigo": "V10-2505", "vacina": { "id": "...", "nome": "V10" },
  "quantidade": 2, "motivo": "QUEBRA", "fornecedor": null, "notaFiscal": null, "observacao": "caiu",
  "quemNome": "Dra. Ana", "conferidoPor": null,
  "estorno": { "em": "2026-10-28T10:00:00-03:00", "quemNome": "Gestor", "motivo": "Lancei no lote errado" },
  "valorCentavos": 6000
}
```

- `id` é o do **lote** na entrada e o da **baixa** na baixa (use `tipo` + `id` como chave da linha). `quantidade` é sempre positivo: o sentido é o `tipo`.
- `quemNome`: o nome do **profissional da clínica** ligado à conta de quem registrou, ou o nome da conta. **Nunca o id nem o e-mail.** Pode vir `null` (conta que não existe mais). `conferidoPor` é só na entrada (quem conferiu o frasco).
- `estorno` vem na baixa estornada: ela **continua na lista**, marcada, com quando, quem e por quê. Mostre riscada, não esconda: é a trilha do desvio.
- `valorCentavos`: o custo da caixa na entrada e o prejuízo na baixa. **Ausente** sem `estoque.planejar` ou `financeiro.ler`.
- Na entrada, `fornecedor` e `notaFiscal`; na baixa, `observacao`.

---

## 12. Análise

`GET /parceiro/portal/clinica/estoque/analise?meses=` (substitui `resumirEstoque` na parte do gráfico de consumo, saldo e perdas; a conta é no banco, não no navegador). `estoque.ler`. `meses` de **1 a 12** (padrão 6, o corrente conta); 0, 13 ou texto: 400.

```json
{
  "hoje": "2026-10-28", "meses": 6, "de": "2026-05-01",
  "giro": {
    "meses": [{ "mes": "2026-10", "parcial": true, "total": 15, "porVacina": [{ "vacinaId": "...", "doses": 9 }] }],
    "vacinas": [{ "vacinaId": "...", "nome": "V10", "doses": 31, "mediaMensal": 5.2 }]
  },
  "saldoContraMinimo": [{ "vacinaId": "...", "nome": "V10", "saldo": 3, "minimo": 10, "situacao": "ABAIXO_DO_MINIMO", "abaixoDoMinimo": true, "zerado": false, "coberturaEmDias": null }],
  "perdas": { "dosesRecebidas": 120, "dosesPerdidas": 4, "perdaPercentual": 0.0333, "porMotivo": [{ "motivo": "QUEBRA", "doses": 3, "valorCentavos": 9000 }], "valorPerdidoCentavos": 12000 },
  "validade": { "faixas": [{ "faixa": "VENCIDO", "lotes": 1, "doses": 2, "valorCentavos": 6000 }], "valorEmRiscoCentavos": 33000 }
}
```

- **Giro:** doses que a **clínica aplicou** (as anuladas e as doses de outro lugar ficam de fora), por vacina e por **mês da parede da clínica** (uma aplicação às 23h30 do último dia do mês cai nesse mês, não no seguinte). `meses` vem do mais antigo ao mais novo, **todos os meses da janela** (o sem dose vem com `total: 0`); o mês corrente vem `parcial: true` (desenhe tracejado ou avise "mês em andamento"). Só entram em `porVacina` as vacinas com dose no mês. `mediaMensal` é doses / `meses` pedidos.
- **Saldo contra o mínimo:** só as vacinas que a clínica **guarda** (as mesmas da geladeira), as abaixo do mínimo primeiro. `coberturaEmDias` usa o consumo da janela pedida; `null` sem consumo.
- **Perdas:** as baixas **não estornadas** do período, por motivo (só os que tiveram perda, do maior para o menor), e `perdaPercentual` sobre as doses que **entraram** no mesmo período (de 0 a 1; sem entrada, 0). "Período" aqui é o registrado dentro da janela.
- **Validade:** as quatro faixas sempre presentes, na ordem `VENCIDO`, `ATE_30_DIAS`, `DE_31_A_60_DIAS`, `ACIMA_DE_60_DIAS`, contando só lote **com dose**. `valorEmRiscoCentavos` é vencido + até 60 dias (o que pode virar descarte). O vencido com dose é **descarte pendente** (P2): ofereça "descartar" (baixa `VENCIMENTO` sem número).
- `truncado` (novo, aditivo): a resposta passou de 256 KB e as listas **por vacina** (`giro.vacinas`, `saldoContraMinimo` e a lista de cada mês) perderam as vacinas do fim (ficam as de maior giro). Os totais por mês, as perdas e a validade seguem **exatos**. Use para mostrar "mostrando as vacinas de maior giro".
- Todo valor em centavos fica **ausente** sem `estoque.planejar` ou `financeiro.ler`.

## 13. Selo do menu

`GET /parceiro/portal/pendencias` ganha o contador **`vacinasAbaixoDoMinimo`** (módulo Clínica, rota `/clinica/estoque`). **Só aparece para quem tem `estoque.planejar`** (DONO e GESTOR; veterinário e enfermagem veem a situação na geladeira, sem selo). Tom `ATENCAO`; **`RISCO`** quando uma vacina **essencial** do catálogo está zerada. Conta só as vacinas que a clínica guarda, ativas, com mínimo maior que zero e saldo menor que ele: **a clínica que nunca guardou frasco vê 0**, não "40 vacinas". É a mesma conta de `geladeira.indicadores.vacinasAbaixoDoMinimo`, então o selo nunca discorda da tela. O número é calculado **uma vez por clínica** e guardado 30 s para todos que podem vê-lo (cache por clínica, não por pessoa); quem **não** tem `estoque.planejar` continua sem o selo mesmo com o número quente. Se a clínica estiver com a leitura ocupada, o contador vem `valor: null` (some o selo, volta no próximo polling). `lotesPertoDeVencer` **não** é contador (fica na geladeira e na análise).

## 14. Fica para depois

O pedido de compra não é enviado nem gravado: o texto sai para copiar, e a integração com o fornecedor é a E9.

---

## 15. Metas do mês (E6-02a)

Substitui `estoqueRepository.metas()/salvarPlano()` e a leitura de `domain/metas-de-estoque.ts` para **ler e salvar**. A conta de situação, ritmo e placar passa a ser do servidor; apague a cópia local quando as rotas estiverem ligadas. A sugestão do próximo mês, o pedido de compra e o texto por fornecedor estão na seção 16.

| Rota | Permissão | Quem tem |
|---|---|---|
| `GET /parceiro/portal/clinica/estoque/metas` | `estoque.ler` | DONO, GESTOR, VETERINÁRIO, ENFERMAGEM, RECEPÇÃO, FINANCEIRO |
| `PUT /parceiro/portal/clinica/estoque/metas/:mes` | `estoque.planejar` | DONO, GESTOR (planejar **não** exige CRMV nem selo) |

Módulo Clínica; suspenso lê e não salva. Taxa: o `PUT` usa as 120 ações por hora, o `GET` as 600 leituras (mesmo 429 `ESTOQUE_TAXA_EXCEDIDA`); 503 `ESTOQUE_OCUPADO` quando a leitura está ocupada.

### 15.1 Ler: `GET /metas`

```json
{
  "hoje": "2026-10-28",
  "dinheiro": true,
  "atual": {
    "mes": "2026-10", "diasNoMes": 31, "diasCorridos": 28, "diasRestantes": 3,
    "plano": {
      "mes": "2026-10", "versao": 3, "baseadoEm": "2026-09", "atualizadoEm": "2026-10-20T15:00:00-03:00",
      "metas": [
        { "id": "...", "tipo": "APLICACOES", "vacinaId": null, "vacinaNome": null, "alvo": 120 },
        { "id": "...", "tipo": "APLICACOES", "vacinaId": "...", "vacinaNome": "V10", "alvo": 30 },
        { "id": "...", "tipo": "PERDAS", "vacinaId": null, "vacinaNome": null, "alvo": 5 },
        { "id": "...", "tipo": "COMPRAS", "vacinaId": null, "vacinaNome": null, "alvo": 500000 }
      ]
    },
    "realizado": { "aplicacoes": 96, "perdas": 2, "dosesRecebidas": 100, "comprasCentavos": 300000 },
    "progresso": [
      { "meta": { "id": "...", "tipo": "APLICACOES", "vacinaId": "...", "vacinaNome": "V10", "alvo": 30 },
        "sentido": "piso", "realizado": 24, "projecao": 26, "parte": 0.8, "situacao": "atencao" }
    ],
    "placar": { "total": 4, "bem": 2, "falhou": 0, "atencao": 2 }
  },
  "proximo": { "mes": "2026-11", "plano": null, "convite": true },
  "historico": [
    { "mes": "2026-09", "versao": 2, "baseadoEm": null, "atualizadoEm": "...", "realizado": { "aplicacoes": 110, "perdas": 1, "dosesRecebidas": 90, "comprasCentavos": 270000 }, "progresso": [], "placar": { "total": 3, "bem": 3, "falhou": 0, "atencao": 0 } }
  ],
  "truncado": false
}
```

- **Quem não vê dinheiro (RECEPÇÃO, VETERINÁRIO, ENFERMAGEM: sem `estoque.planejar` nem `financeiro.ler`) recebe `dinheiro: false`**, e então: a meta de `COMPRAS` **não vem** em `plano.metas` nem em `progresso`; `realizado.comprasCentavos` **não vem** (ausente, não zero: não trate ausência como R$ 0,00); e o **`placar` já vem sem ela** (use o placar da API, não recalcule contando o `progresso`). **`versao` e `atualizadoEm` também não vêm** (em `plano` e em cada mês do `historico`): eles mudam a cada gravação, inclusive a que mexe só no orçamento, e quem não planeja nunca faz PUT. Não trate a ausência como zero nem como erro. DONO, GESTOR e FINANCEIRO recebem tudo.
- **Mês em curso e próximo, na parede da clínica.** `atual.plano` é nulo se a clínica ainda não combinou nada (`progresso` vem vazio, o `realizado` vem do mesmo jeito). `proximo.convite` é `true` quando ainda não há plano do mês seguinte: mostre o convite (só quem tem `estoque.planejar` pode aceitar). `proximo.plano` traz as metas, sem progresso (o mês não começou).
- **`historico`**: até 6 meses **fechados que tiveram plano**, do mais recente (só `mes`, `versao`, `baseadoEm`, `atualizadoEm`, `realizado`, `progresso` e `placar`; as metas estão dentro do `progresso`). Mês fechado julga o piso e o teto pelo fim do mês.
- **Situação (`situacao`)**: `cumprida`, `no-ritmo`, `atencao`, `falhou`; mesma cor nos dois sentidos (bom, atenção, ruim).
  - `sentido: "piso"` (aplicações): é julgada pelo **ritmo** enquanto o mês corre (`projecao` = realizado ÷ dias corridos × dias do mês); fechado e não batido: `falhou`.
  - `sentido: "teto"` (perdas e compras): **estoura na hora**, o ritmo não salva (`projecao` é o próprio realizado); a partir de 80% do teto: `atencao`; passou: `falhou`. Só se diz `cumprida` quando o mês fecha.
  - **O último dia do mês ainda é mês em curso** (o portal tratava o dia 31 como fechado): só vira "fechado" no dia 1.
- `parte` é realizado ÷ alvo (4 casas); **`null` quando o alvo é 0 e já houve realizado** (barra além do cheio). Alvo 0 no piso nasce `cumprida`; no teto, a primeira dose perdida já é `falhou`.
- `progresso` vem na ordem em que se lê: `falhou`, `atencao`, `no-ritmo`, `cumprida`. `plano.metas` vem por tipo (aplicações, perdas, compras), a da clínica inteira antes de cada vacina, depois pelo nome.
- **Realizado:** `aplicacoes` são as doses que a **clínica aplicou** no mês da parede dela (a dose de outro lugar e a anulada não contam; às 23h30 do último dia conta nesse mês); `perdas` são as baixas **não estornadas** pelo dia da baixa; `comprasCentavos` é quantidade × custo dos lotes pelo **dia do recebimento**. Estornar uma baixa de mês fechado muda o resultado dele (é a correção de um erro).
- Até 256 KB: `truncado: true` quando o histórico perdeu os meses mais antigos para caber.
- Nunca vem id de usuário nem e-mail (nem "atualizado por").

### 15.2 Salvar: `PUT /metas/:mes`

`:mes` é `AAAA-MM`. **Só o mês em curso e o seguinte** (na parede da clínica; às 23h50 do dia 31 ainda é o mês velho). Corpo:

```json
{
  "metas": [
    { "tipo": "APLICACOES", "vacinaId": "...", "alvo": 30 },
    { "tipo": "APLICACOES", "alvo": 120 },
    { "tipo": "PERDAS", "alvo": 5 },
    { "tipo": "COMPRAS", "alvo": 500000 }
  ],
  "baseadoEm": "2026-10",
  "versao": 3
}
```

- **O PUT substitui o plano inteiro**: meta omitida é meta apagada. `metas: []` é aceito e esvazia o plano (é assim que o botão "limpar" funciona; não há `DELETE`). Resposta 200: o plano na forma de `atual.plano`, com a **nova `versao`** e o orçamento (quem salva vê dinheiro).
- `vacinaId` ausente ou `null` = a clínica inteira (o único valor aceito em `PERDAS` e `COMPRAS`). Uma meta por `(tipo, vacinaId)`; no máximo **120** metas.
- **`versao`**: mande a que a tela abriu (`plano.versao`); `0` ou ausente quando o plano ainda não existe. Se outra pessoa salvou no meio: **409 `PLANO_ALTERADO`** com `versao` (a atual). Recarregue (`GET`), mostre o que mudou e deixe a pessoa refazer. **O duplo toque é seguro:** se as metas e o `baseadoEm` do corpo já são os salvos, é 200 com o plano atual, na mesma versão, qualquer que seja a `versao` enviada.
- `baseadoEm` (`AAAA-MM`, anterior ao mês do plano) é só um rótulo de onde veio a sugestão; omitido = sem rótulo (o PUT substitui, então reenvie-o ao editar).
- **Faixas do alvo (apague o `LIMITE_DE_DOSES = 999` do portal):** por vacina de 0 a **9.999** doses; clínica inteira (aplicações ou perdas) de 0 a **99.999**; compras de 0 a **1.000.000.000 centavos (R$ 10 milhões)**. Sempre inteiro (nada de 1,5 nem texto).
- **Vacina desativada:** uma meta que já está no plano do mês continua nele (e continua legível); não dá para colocar uma desativada numa meta nova (403 `OWNERSHIP_FORBIDDEN`). Vacina de outra clínica ou que não existe: o mesmo 403, sempre.
- O PUT é uma ação por clique em "Salvar" e conta nas 120 ações por hora por pessoa: não salve a cada tecla.

### 15.3 Erros novos

| `codigo` | Status | Quando |
|---|---|---|
| `META_MES_INVALIDO` | 400 | `:mes` fora de `AAAA-MM` (2000-01 a 2099-12), ou `baseadoEm` mal formado ou não anterior ao mês (`campo: "baseadoEm"`) |
| `META_MES_FORA_DA_JANELA` | 409 | mês fechado ou daqui a 2 meses ou mais; vem `mesAtual` e `mesSeguinte` (desenhe o seletor só com os dois) |
| `META_INVALIDA` | 400 | `reason`: `ALVO_FORA_DA_FAIXA`, `VACINA_NAO_SE_APLICA` (perdas ou compras com `vacinaId`); `indice` é a posição da meta no corpo |
| `META_REPETIDA` | 400 | o mesmo `(tipo, vacinaId)` duas vezes, ou duas metas da clínica inteira do mesmo tipo; `indice` |
| `PLANO_METAS_DEMAIS` | 400 | mais de 120 metas (`limite: 120`) |
| `PLANO_ALTERADO` | 409 | `versao` diferente da atual; `versao` é a atual |
| `OWNERSHIP_FORBIDDEN` | 403 | vacina de outra clínica, inexistente, ou desativada e nova na meta |
| `ESTOQUE_TAXA_EXCEDIDA` | 429 | 120 ações ou 600 leituras por hora |

Textos localizados nos 6 idiomas (en-GB explícito). Corpo com `alvo` em texto, `1.5` ou `null`, `tipo` desconhecido, `metas` ausente ou mais de 300 itens: 400 comum do validador (sem `codigo` próprio). **Nenhum tipo de notificação novo**, nenhum selo, nenhum aviso à equipe nesta etapa.

---

## 16. Sugestão do mês e pedido de compra (E6-02b)

Substitui `sugerirPlano`, `pedidoDeCompra`, `custoDoPedido` e o texto do botão "Copiar pedido" de `domain/metas-de-estoque.ts`: **apague a regra local** quando as rotas estiverem ligadas (junto com `LIMITE_DE_DOSES` e o resto da seção 15). As duas rotas levam **custo**, então são só de quem tem `estoque.planejar` (DONO e GESTOR; recepção, veterinário, enfermagem e financeiro dão 403 `SEM_PERMISSAO`). Nenhuma grava.

| Rota | Permissão | Balde |
|---|---|---|
| `GET /parceiro/portal/clinica/estoque/metas/sugestao?mes=` | `estoque.planejar` | leitura (600 por hora) |
| `POST /parceiro/portal/clinica/estoque/metas/:mes/simular-pedido` | `estoque.planejar` | **simulação (300 por hora por pessoa)** |

`mes`: `AAAA-MM`, o mês em curso ou o seguinte (na parede da clínica); sem `mes` na sugestão, o seguinte. Outro mês: 409 `META_MES_FORA_DA_JANELA` (com `mesAtual` e `mesSeguinte`); mal formado: 400 `META_MES_INVALIDO`.

### 16.1 Sugestão: `GET /metas/sugestao`

```json
{
  "mes": "2026-11", "mesBase": "2026-10", "hoje": "2026-10-28",
  "referencias": [
    { "vacinaId": "...", "nome": "V10", "noMesBase": 6, "projecaoDoMesBase": 27, "mediaDoTrimestre": 11.3,
      "reforcosNoMes": 18, "sugestao": 27, "origem": "RITMO" }
  ],
  "perdasNoMesBase": 4, "mediaDePerdas": 2.7, "mesesComDado": 3,
  "metas": [
    { "tipo": "APLICACOES", "vacinaId": "...", "vacinaNome": "V10", "alvo": 27 },
    { "tipo": "PERDAS", "vacinaId": null, "vacinaNome": null, "alvo": 2 },
    { "tipo": "COMPRAS", "vacinaId": null, "vacinaNome": null, "alvo": 510000 }
  ],
  "orcamentoSugeridoCentavos": 510000,
  "pedido": { "mes": "2026-11", "hoje": "2026-10-28", "linhas": [], "custoTotalCentavos": 510000, "vacinasSemCusto": [], "truncado": false },
  "truncado": false
}
```

- **Cada número diz de onde veio.** A sugestão de uma vacina é o **maior** de três: o mês anterior ao planejado no ritmo de hoje (`projecaoDoMesBase`, que no mês fechado é o próprio realizado), a média dos 3 meses fechados antes dele (`mediaDoTrimestre`, sempre dividida por 3) e os reforços que vencem no mês planejado (`reforcosNoMes`). **`origem`** diz qual venceu (`RITMO`, `MEDIA`, `REFORCOS`; no empate vale essa ordem; `null` quando a sugestão é 0). Mostre os três ao lado do número. `mesesComDado` (0 a 3) é quantos dos 3 meses da média tiveram aplicação: com menos de 3, avise "poucos meses de histórico".
- **Reforço** é a próxima dose das doses vigentes (a de outro lugar transcrita conta) de pacientes ativos, vivos e não mesclados, de vacina ativa.
- **`metas`** é o plano sugerido: dá para enviar como está no `PUT` (a forma e as faixas sempre passam), depois de a pessoa editar. O teto de perdas é metade da perda de referência (arredondada para baixo; **0 é meta válida**). `COMPRAS` só vai quando o pedido tem custo conhecido. Mande `baseadoEm` no PUT com o `mesBase`.
- **Quais vacinas:** as que a clínica guarda, as com aplicação nos 4 meses e as com reforço, ativas; nunca o catálogo inteiro. **No máximo 118**, as de maior sugestão (`truncado: true` quando houve corte; o plano aceita 120 metas). Ordenadas por sugestão e depois pelo nome.
- **`pedido`** é o pedido que essa sugestão custa (forma da 16.2, **sem `texto`**). Para o texto, simule.
- Até 256 KB; `pedido.truncado` quer dizer que a lista detalhada `linhas` perdeu as do fim (as de `comprar` 0 primeiro). `custoTotalCentavos` e `vacinasSemCusto` são sempre do pedido inteiro.

### 16.2 Simular o pedido: `POST /metas/:mes/simular-pedido`

Corpo: as mesmas metas do `PUT` (`{ "metas": [...] }`, até 120; sem `versao` nem `baseadoEm`). **Só as metas de `APLICACOES` com `vacinaId` entram na conta**; `PERDAS`, `COMPRAS` e a meta da clínica inteira são **ignoradas** (200, não recusadas). Chame com as metas que estão na tela (salvas ou não), com **debounce de 400 ms**; a 301ª chamada na hora é 429 `ESTOQUE_TAXA_EXCEDIDA` (`limite: 300`). Responde **200** (não 201) e **não grava nada**.

```json
{
  "mes": "2026-11", "hoje": "2026-10-28",
  "linhas": [
    { "vacinaId": "...", "nome": "V10", "saldoUtil": 15, "saidaAteVirar": 8, "sobra": 7, "meta": 12, "minimo": 10,
      "comprar": 15, "conta": "12 + 10 - 7 = 15", "fornecedor": "Vetfarma",
      "custoUnitarioCentavos": 3390, "custoEstimadoCentavos": 50850, "semCusto": false }
  ],
  "custoTotalCentavos": 50850,
  "vacinasSemCusto": [{ "vacinaId": "...", "nome": "Giardia", "comprar": 7 }],
  "texto": "Pedido de vacinas para novembro de 2026\nQuantidades em doses.\n\nVetfarma\n- V10: 15",
  "truncado": false
}
```

- **A conta do pedido:** `comprar = max(0, meta + minimo - sobra)`, com `sobra = max(0, saldoUtil - saidaAteVirar)`. `saldoUtil` é o saldo dos lotes que **ainda valem quando o mês planejado começa** (no mês em curso, que ainda valem hoje); o lote que vence durante o mês conta. `saidaAteVirar` é o que ainda sai até virar o mês no ritmo de hoje (só no mês seguinte). `conta` é a mesma conta escrita, neutra de idioma (o resultado pode ser negativo; `comprar` nunca é): mostre-a sob a linha. `minimo` é o da clínica ou o padrão do catálogo.
- **Custo e fornecedor** vêm do **lote mais recente** da vacina (o de recebimento mais novo, vencido ou não). **`semCusto: true`** = a vacina nunca teve lote: `fornecedor` nulo, custo 0, e o `custoTotalCentavos` **não** a soma. `vacinasSemCusto` lista o que o pedido manda comprar nessa situação: avise "orçamento sem estas vacinas". Dinheiro em centavos inteiros.
- **`texto`** é o que o botão "Copiar pedido" copia: agrupado por fornecedor (o maior pedido primeiro; "sem fornecedor" por último), só as linhas com `comprar > 0`, **sem preço**, no idioma da requisição (`Accept-Language`, 6 idiomas), com o mês por extenso. Cole como está. Se não há nada a comprar, o texto diz isso. **O texto vem sempre inteiro**, também quando `truncado` é verdadeiro: a resposta passa de 256 KB e o que sai é só a lista detalhada `linhas` (as de `comprar` 0 primeiro). Não use `linhas` para montar a compra; use o `texto`. `vacinasSemCusto` e `custoTotalCentavos` também são do pedido inteiro.
- **Pedido enorme: 422 `PEDIDO_GRANDE_DEMAIS`** (`limiteKb`): só o texto já passa de 256 KB (centenas de vacinas com nomes e fornecedores enormes). Mostre a mensagem e deixe a pessoa simular em partes, por exemplo por fornecedor, e juntar os textos.
- As linhas vêm de `comprar` maior para menor, depois pelo nome; entram as vacinas que a clínica guarda e as das metas do corpo (a desativada que ainda está no plano também).
- Erros: 403 `OWNERSHIP_FORBIDDEN` (vacina de outra clínica ou inexistente, o mesmo corpo), 400 `META_INVALIDA` / `META_REPETIDA` / `PLANO_METAS_DEMAIS` (só sobre as metas de aplicação por vacina), 409 `META_MES_FORA_DA_JANELA`, 422 `PEDIDO_GRANDE_DEMAIS`, 429, 503 `ESTOQUE_OCUPADO`.
- **Não há `pedido` dentro do `GET /metas`.** Para mostrar o pedido do plano salvo do próximo mês, chame a simulação com as metas dele.
- Nenhum tipo de notificação novo, nenhum selo.
