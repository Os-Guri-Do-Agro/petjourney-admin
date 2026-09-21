/**
 * O ApexCharts do módulo clínico — só as peças que as telas desenham.
 *
 * A entrada padrão (`import VueApexCharts from 'vue3-apexcharts'`) traz a biblioteca inteira:
 * dezoito tipos de gráfico, barra de ferramentas, exportação, anotação editável, e ainda o
 * pacote de renderização em servidor que o componente `ApexChartsServer` arrasta junto. No
 * build isso apareceu como 508 kB de SSR num painel que nunca renderiza fora do navegador,
 * mais meio megabyte de tipos de gráfico que esta tela não usa.
 *
 * Aqui a montagem é explícita: o núcleo, quatro famílias de gráfico e três recursos. Quem
 * acrescentar um gráfico novo precisa vir a este arquivo declarar o que ele usa — o que é
 * exatamente o ponto, porque é o único lugar onde o custo fica visível.
 *
 * A dica ao passar o mouse já vem no núcleo e não precisa ser importada.
 */

/* Colunas empilhadas e barras horizontais do ranking e do saldo de estoque. */
import 'apexcharts/bar'
/* A linha de ocupação sobre as colunas — o gráfico misto é registrado como `line`. */
import 'apexcharts/line'
/* O mapa de calor de hora × dia. */
import 'apexcharts/heatmap'
/*
 * A linha do tempo de validade dos lotes: cada barra vai do recebimento ao vencimento.
 *
 * Custou 38 kB no pacote (10 kB comprimidos), e é o único tipo aqui que não dava para resolver
 * com o que já havia: uma barra com começo **e** fim próprios não se desenha com `bar`, que
 * parte sempre da linha de base.
 */
import 'apexcharts/rangeBar'
/* Legenda clicável: é ela que permite isolar uma série no gráfico de colunas. */
import 'apexcharts/features/legend'
/* A marca do dia de hoje sobre o gráfico de colunas. */
import 'apexcharts/features/annotations'
/* Navegação por setas entre os pontos, para quem anda sem mouse. */
import 'apexcharts/features/keyboard'

import VueApexCharts from 'vue3-apexcharts/core'

export default VueApexCharts
