# 17 · Estoque de vacinas e metas do mês

Dar entrada em lote, dar baixa no frasco, ajustar o mínimo de cada vacina e combinar metas para o
próximo mês com os números do atual — com o pedido de compra saindo das metas.

## Por que existe

O estoque morava numa aba de Vacinas e só lia: gráficos e uma tabela de lotes, sem um botão. A
clínica comprava e não tinha onde dar entrada (lote só existia se a semente o plantasse); quebrava um
frasco e ele continuava "na geladeira"; o mínimo de cada vacina vinha de fábrica. E não havia como
dizer "em novembro queremos aplicar X e gastar no máximo Y" e acompanhar o mês contra isso.

## Pronto quando

- [x] Receber lote: vacina, código, validade, quantidade, custo por dose, fornecedor, nota, data e
      quem conferiu. O lote novo aparece na geladeira **e** no diálogo de aplicar vacina.
- [x] Dar baixa: quebra, temperatura, vencimento e **contagem** (a pessoa diz quantas doses achou; a
      diferença vira a baixa). O lote vencido tem "Descartar", que abre já no saldo inteiro.
- [x] Mínimo por vacina ajustável, com o giro mensal ao lado do campo.
- [x] Metas do mês em três tipos: aplicações (por vacina ou da clínica inteira, é piso), teto de
      perdas e orçamento de compra (são teto). O mês em curso mostra o realizado, o ritmo e a
      situação de cada meta.
- [x] Planejar o próximo mês com os dados do atual: o diálogo abre preenchido, cada meta mostra de
      onde veio o número, e dá para mudar, tirar e acrescentar metas.
- [x] Pedido de compra do próximo mês, com a conta escrita por linha, "Copiar pedido" agrupado por
      fornecedor e "Receber lote" direto da linha.
- [x] Movimentos: toda entrada e toda baixa, com quem e quando.
- [x] Selo no menu com as vacinas abaixo do mínimo.

## Como a tela se organiza

`/veterinario/estoque` (menu Pendências, logo abaixo de Vacinas). O endereço antigo
`/veterinario/vacinas?aba=estoque` leva para cá.

- **Geladeira** — uma linha por vacina (saldo e mínimo, cobertura em dias, situação; ações
  "Receber lote" e ajustar mínimo) e uma por lote (validade, saídas, valor parado; "Dar baixa" ou
  "Descartar").
- **Metas** — o mês em curso contra o combinado; o próximo mês (plano ou convite para planejar) com
  o pedido de compra; os meses fechados, recolhidos.
- **Movimentos** — entradas e baixas, filtráveis. A aplicação fica de fora: tem lista própria em
  Vacinas → Aplicadas.
- **Análise** — os quatro gráficos da aba antiga (giro, saldo contra o mínimo, perdas, validade).

## Decisões

1. **Tela própria, e não aba de Vacinas.** Quatro segmentos dentro de uma aba de outra tela seria a
   hierarquia que ninguém acha. Vacinas ganhou uma pílula "Estoque de vacinas" no lugar da aba.
2. **A sugestão é o maior de três números** — o mês atual no ritmo de hoje, a média do trimestre e
   os reforços que já vencem no mês planejado. O ritmo sozinho erra no começo do mês (seis dias não
   falam pelo mês); a média sozinha ignora o recall que a clínica pode provocar.
3. **Piso e teto se leem diferente.** Aplicação é julgada pelo ritmo enquanto o mês corre; perda e
   compra estouram na hora, sem diluir no mês.
4. **O pedido fecha o mês no mínimo depois da meta:** `comprar = meta + mínimo − sobra`, onde a sobra
   é o saldo que ainda vale no começo do mês menos o que sai até lá no ritmo de hoje.
5. **Contagem maior que o sistema é recusada,** e não vira entrada: dose a mais quase sempre é
   aplicação registrada no lote errado.
6. **Código de lote não repete** (é a chave que liga a dose ao frasco) e **frasco vencido não entra**.

## Defeitos encontrados no caminho (e corrigidos)

1. **Todo campo de data mostrava mês/dia.** O PrimeVue não tinha `dateFormat`, e 7 de outubro
   aparecia como "10/07/2026" em português. Na validade de um lote, isso é três meses de prateleira
   a mais. Agora o formato segue o idioma (`src/i18n/primevue.ts`).
2. **O mês corrente nunca tinha aplicação no começo.** O reforço da rotina era sorteado a partir de
   cinco dias atrás; no dia 7 o mês aparecia zerado no gráfico e nas metas. Alguns pares já sorteados
   passam para dentro do mês, sem criar dose nenhuma.

## Onde está

| O quê | Arquivo |
|-------|---------|
| Tela | `src/pages/(accounts)/veterinario/estoque.vue` |
| Diálogos | `src/features/clinico/components/estoque/` (`ReceberLoteDialog`, `BaixaDeLoteDialog`, `MinimoDialog`, `PlanoDoMesDialog`, `MetasDoMes`) |
| Conta das metas, sugestão e pedido | `src/features/clinico/domain/metas-de-estoque.ts` |
| Movimentos | `movimentosDoEstoque` em `src/features/clinico/domain/estoque-vacinas.ts` |
| Escritas | `src/features/clinico/data/repositories/estoque-repository.ts` |
| Cenário (plano do mês passado e do atual) | `src/features/clinico/data/seed-estoque.ts` |
| Testes | `domain/__tests__/metas-de-estoque.spec.ts`, `data/__tests__/estoque-repository.spec.ts` |

## Mudança no modelo

- `MotivoDePerda` ganhou `contagem`; `PerdaDeLote` ganhou `registradaPor` e `observacao` (opcionais).
- `LoteDeVacina` ganhou `notaFiscal` e `recebidoPor` (opcionais).
- Novos: `MetaDeEstoque`, `PlanoDeEstoque`, `TipoDeMeta`. O dataset ganhou `planosDeEstoque` e
  `estoqueMinimo` (o mínimo ajustado, por cima do catálogo).

## O que ainda não existe

- Estoque de outros insumos (medicamento, seringa): o modelo é só de vacina.
- Editar ou estornar uma entrada ou baixa já gravada.
- Cadastrar uma vacina nova no catálogo pela tela.
- A meta de faturamento: depende de preço e agenda, que esta tela não controla.
