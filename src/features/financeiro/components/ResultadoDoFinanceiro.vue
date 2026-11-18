<script setup lang="ts">
/**
 * Financeiro › Resultado (protótipo): a clínica está ganhando dinheiro? Uma pergunta, respondida em
 * camadas, da mais rápida à mais funda:
 *
 * 1. a frase do alto e os quatro números do mês (faturamento, resultado, ticket médio, atraso);
 * 2. o mês a mês, com a previsão dos próximos 30 dias numa frase embaixo;
 * 3. de onde veio e para onde foi, lado a lado;
 * 4. o demonstrativo em linhas, recolhido (é para quem quer conferir a conta, não para todo dia).
 *
 * Pelo mês do atendimento. No mês em andamento, as despesas entram na proporção dos dias que
 * passaram (`resultado.ts`), para o dia 5 não fazer todo mês parecer prejuízo.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import ClinicChartRanking from '@/features/clinico/components/resumo/ClinicChartRanking.vue'
import type { Fatia } from '@/features/clinico/domain/resumo'

import { mesAnterior, nomeDoMes, porcento, reais, reaisCurtos } from '../dados'
import { useFinanceiro } from '../estado'
import {
  ALIQUOTA_DO_SIMPLES,
  demonstrativo,
  faturamentoAteODia,
  mesAMes,
  mesesDisponiveis,
  previsao,
} from '../resultado'

import AvisoDoFinanceiro from './AvisoDoFinanceiro.vue'
import GraficoMesAMes from './GraficoMesAMes.vue'
import SoParaQuemPode from './SoParaQuemPode.vue'

const fin = useFinanceiro()
const route = useRoute()
const router = useRouter()

const bloqueado = computed(() => fin.perfil.value.tipo !== 'gestao')
const meses = computed(() => mesesDisponiveis(fin.hoje.value))

const mes = computed<string>({
  get: () => {
    const pedido = route.query.mes
    return typeof pedido === 'string' && meses.value.includes(pedido) ? pedido : fin.mesAtual.value
  },
  set: (novo) => {
    const query = { ...route.query }
    if (novo === fin.mesAtual.value) delete query.mes
    else query.mes = novo
    void router.replace({ query })
  },
})

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

const opcoesDeMes = computed(() =>
  meses.value.map((m) => ({
    valor: m,
    rotulo: `${maiuscula(nomeDoMes(m))} de ${m.slice(0, 4)}${m === fin.mesAtual.value ? ' (até hoje)' : ''}`,
  })),
)

const d = computed(() =>
  demonstrativo(fin.mundo.value, fin.regras.value, mes.value, fin.hoje.value),
)
const pontos = computed(() => mesAMes(fin.mundo.value, fin.regras.value, fin.hoje.value))
const prev = computed(() => previsao(fin.mundo.value, fin.recebiveis.value, fin.hoje.value))

const margem = computed(() =>
  d.value.faturamento ? d.value.resultado / (d.value.faturamento - d.value.descontos) : 0,
)

/** O mês contra o anterior no mesmo período (no mês em andamento, até o mesmo dia). */
const comparacao = computed(() => {
  const anterior = mesAnterior(mes.value)
  const dia = d.value.diasPassados
  const agora = faturamentoAteODia(fin.mundo.value, mes.value, dia)
  const antes = faturamentoAteODia(fin.mundo.value, anterior, dia)
  if (!antes) return null
  const variacao = agora / antes - 1
  return {
    variacao,
    texto: `${variacao >= 0 ? 'mais' : 'menos'} ${porcento(Math.abs(variacao))} que ${nomeDoMes(anterior)}${d.value.parcial ? ' no mesmo período' : ''}`,
  }
})

const atraso = computed(() => {
  const vencidos = fin.devedores.value.filter((dv) => dv.atraso > 0)
  return { total: vencidos.reduce((s, dv) => s + dv.total, 0), clientes: vencidos.length }
})

const resumo = computed(() => {
  if (bloqueado.value) return 'A clínica está ganhando dinheiro?'
  const quando = d.value.parcial
    ? `${maiuscula(nomeDoMes(mes.value))} até hoje`
    : maiuscula(nomeDoMes(mes.value))
  return `${quando}: resultado de ${reaisCurtos(d.value.resultado)}, ${porcento(margem.value)} do que a clínica faturou`
})

const numeros = computed(() => [
  {
    id: 'faturamento',
    icone: 'ph ph-trend-up',
    valor: reaisCurtos(d.value.faturamento - d.value.descontos),
    rotulo: 'Faturamento',
    nota: comparacao.value?.texto ?? `${d.value.contas} contas`,
    tom: comparacao.value && comparacao.value.variacao < -0.05 ? 'atencao' : '',
  },
  {
    id: 'resultado',
    icone: 'ph ph-piggy-bank',
    valor: reaisCurtos(d.value.resultado),
    rotulo: 'Resultado',
    nota: `margem de ${porcento(margem.value)}`,
    tom: d.value.resultado < 0 ? 'risco' : '',
  },
  {
    id: 'ticket',
    icone: 'ph ph-receipt',
    valor: reais(d.value.ticketMedio),
    rotulo: 'Ticket médio',
    nota: `em ${d.value.contas} contas`,
    tom: '',
  },
  {
    id: 'atraso',
    icone: 'ph ph-hourglass-medium',
    valor: reaisCurtos(atraso.value.total),
    rotulo: 'Em atraso com clientes',
    nota: atraso.value.clientes
      ? `de ${atraso.value.clientes} ${atraso.value.clientes === 1 ? 'cliente' : 'clientes'}`
      : 'ninguém atrasado',
    tom: atraso.value.total > 0 ? 'atencao' : '',
  },
])

/* O ranking já põe a parte do total entre parênteses: aqui vai só o dinheiro. */
const escreverReais = (fatia: Fatia) => reaisCurtos(fatia.valor)

const verDemonstrativo = ref(false)

const linhasDoDemonstrativo = computed(() => {
  const x = d.value
  return [
    { id: 'fat', rotulo: 'Faturamento', valor: x.faturamento, tipo: 'base' },
    { id: 'desc', rotulo: 'Descontos dados', valor: -x.descontos, tipo: 'menos' },
    { id: 'tax', rotulo: 'Taxas do cartão', valor: -x.taxas, tipo: 'menos' },
    {
      id: 'imp',
      rotulo: `Impostos (Simples Nacional, ${porcento(ALIQUOTA_DO_SIMPLES)})`,
      valor: -x.impostos,
      tipo: 'menos',
    },
    { id: 'liq', rotulo: 'Receita líquida', valor: x.receitaLiquida, tipo: 'subtotal' },
    { id: 'rep', rotulo: 'Repasses aos veterinários', valor: -x.repasses, tipo: 'menos' },
    { id: 'cus', rotulo: 'Vacinas, remédios e laboratório', valor: -x.custos, tipo: 'menos' },
    { id: 'mar', rotulo: 'Margem dos atendimentos', valor: x.margem, tipo: 'subtotal' },
    {
      id: 'fix',
      rotulo: 'Despesas fixas (aluguel, equipe, contas)',
      valor: -x.fixas,
      tipo: 'menos',
    },
    { id: 'res', rotulo: 'Resultado', valor: x.resultado, tipo: 'total' },
  ]
})
</script>

<template>
  <UiPagina :resumo="resumo">
    <div class="fin">
      <AvisoDoFinanceiro />

      <SoParaQuemPode v-if="bloqueado" />

      <template v-else>
        <div class="rs__barra">
          <Select
            v-model="mes"
            :options="opcoesDeMes"
            option-label="rotulo"
            option-value="valor"
            aria-label="Mês"
            class="rs__mes"
          />
          <p v-if="d.parcial" class="rs__parcial">
            <i class="ph ph-calendar-dots" aria-hidden="true" />
            Mês em andamento: {{ d.diasPassados }} de {{ d.diasDoMes }} dias. As despesas entram na
            proporção dos dias que passaram.
          </p>
        </div>

        <ul class="ui-indicadores rs__numeros" aria-label="Os números do mês">
          <li
            v-for="n in numeros"
            :key="n.id"
            class="ui-indicador"
            :class="{
              'ui-indicador--risco': n.tom === 'risco',
              'ui-indicador--atencao': n.tom === 'atencao',
            }"
          >
            <span
              class="ui-ladrilho"
              :class="{
                'ui-ladrilho--risco': n.tom === 'risco',
                'ui-ladrilho--atencao': n.tom === 'atencao',
              }"
              aria-hidden="true"
            >
              <i :class="n.icone" />
            </span>
            <strong class="ui-indicador__valor ui-num">{{ n.valor }}</strong>
            <span class="ui-indicador__rotulo">{{ n.rotulo }}</span>
            <span class="ui-indicador__nota">{{ n.nota }}</span>
          </li>
        </ul>

        <section class="ui-folha ui-cartao" aria-labelledby="rs-mes-a-mes">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-chart-bar" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="rs-mes-a-mes" class="ui-cartao__titulo">Mês a mês</h2>
              <p class="ui-cartao__descricao">
                O que entrou, o que saiu e o que sobrou, nos últimos seis meses.
              </p>
            </span>
          </header>
          <div class="rs__grafico">
            <GraficoMesAMes :pontos="pontos" />
            <p class="rs__previsao ui-poco">
              <i class="ph ph-crystal-ball" aria-hidden="true" />
              <span>
                Do que já está marcado para os próximos 30 dias, entram
                <strong class="ui-num">{{ reais(prev.entra) }}</strong> ({{
                  reais(prev.entraCartao)
                }}
                dos cartões e {{ reais(prev.entraClientes) }} de clientes) e saem
                <strong class="ui-num">{{ reais(prev.sai) }}</strong
                ><template v-if="prev.saiVencido"
                  >, sendo {{ reais(prev.saiVencido) }} já vencidos</template
                >.
                <template v-if="prev.saldo < 0">
                  As vendas novas do período precisam cobrir
                  <strong class="ui-num rs__atencao">{{ reais(-prev.saldo) }}</strong
                  >.
                </template>
                <template v-else>
                  Sobram <strong class="ui-num rs__pos">{{ reais(prev.saldo) }}</strong> antes das
                  vendas novas.
                </template>
              </span>
            </p>
          </div>
        </section>

        <div class="rs__par">
          <section
            class="ui-folha ui-cartao rs__painel rs__painel--entrou"
            aria-labelledby="rs-veio"
          >
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho rs__ladrilho" aria-hidden="true"
                ><i class="ph ph-arrow-down-left"
              /></span>
              <span class="ui-cartao__titulos">
                <h2 id="rs-veio" class="ui-cartao__titulo">De onde veio</h2>
                <p class="ui-cartao__descricao">O faturamento por tipo de serviço.</p>
              </span>
            </header>
            <div class="ui-cartao__corpo">
              <ClinicChartRanking
                :fatias="d.porTipo"
                :escrever-valor="escreverReais"
                vazio="Nada faturado neste mês."
              />
            </div>
          </section>

          <section class="ui-folha ui-cartao rs__painel rs__painel--saiu" aria-labelledby="rs-foi">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho rs__ladrilho" aria-hidden="true"
                ><i class="ph ph-arrow-up-right"
              /></span>
              <span class="ui-cartao__titulos">
                <h2 id="rs-foi" class="ui-cartao__titulo">Para onde foi</h2>
                <p class="ui-cartao__descricao">
                  Tudo o que custou para atender, do repasse à taxa do cartão.
                </p>
              </span>
            </header>
            <div class="ui-cartao__corpo">
              <ClinicChartRanking
                :fatias="d.paraOndeFoi"
                :escrever-valor="escreverReais"
                vazio="Nenhuma despesa neste mês."
              />
            </div>
          </section>
        </div>

        <section class="ui-folha ui-cartao" aria-labelledby="rs-dre">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-list-numbers" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="rs-dre" class="ui-cartao__titulo">Demonstrativo do mês</h2>
              <p class="ui-cartao__descricao">
                A conta inteira, linha a linha, do faturamento ao resultado.
              </p>
            </span>
            <span class="ui-cartao__acoes">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :icon="verDemonstrativo ? 'ph ph-caret-up' : 'ph ph-caret-down'"
                :label="verDemonstrativo ? 'Recolher' : 'Ver o demonstrativo'"
                :aria-expanded="verDemonstrativo"
                aria-controls="rs-dre-tabela"
                @click="verDemonstrativo = !verDemonstrativo"
              />
            </span>
          </header>
          <table v-if="verDemonstrativo" id="rs-dre-tabela" class="rs__dre">
            <tbody>
              <tr
                v-for="linha in linhasDoDemonstrativo"
                :key="linha.id"
                :class="`rs__dre--${linha.tipo}`"
              >
                <th scope="row">
                  {{
                    linha.tipo === 'menos'
                      ? '(−) '
                      : linha.tipo === 'subtotal' || linha.tipo === 'total'
                        ? '(=) '
                        : ''
                  }}{{ linha.rotulo }}
                </th>
                <td class="ui-num">{{ reais(Math.abs(linha.valor)) }}</td>
                <td class="ui-num rs__dre-parte">
                  {{ d.faturamento ? porcento(Math.abs(linha.valor) / d.faturamento, 1) : '' }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>
    </div>
  </UiPagina>
</template>

<style scoped>
/* As colunas seguem a largura do conteúdo (a gaveta aberta estreita a página), não a da janela. */
.fin {
  display: grid;
  gap: 20px;
  container-type: inline-size;
}

.rs__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
}

.rs__mes {
  min-width: 15rem;
}

.rs__parcial {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.rs__numeros {
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.rs__grafico {
  display: grid;
  gap: 12px;
  padding: 10px 16px 18px;
}

.rs__previsao {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 4px;
  padding: 12px 14px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.55;
}

.rs__previsao i {
  margin-top: 3px;
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 17px;
}

.rs__previsao strong {
  color: var(--tinta);
}

.rs__pos {
  color: var(--ok-tinta) !important;
}

.rs__atencao {
  color: var(--atencao-tinta) !important;
}

.rs__par {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* Cada ranking na cor do que mede: o que entrou na sálvia, o que saiu no barro. */
.rs__painel--entrou {
  --ranking-cor: var(--pets);
}

.rs__painel--entrou .rs__ladrilho {
  background: var(--pets-fundo);
  color: var(--pets-tinta);
}

.rs__painel--saiu {
  --ranking-cor: var(--dado-barro);
}

.rs__painel--saiu .rs__ladrilho {
  background: var(--dado-barro-fundo);
  color: var(--dado-barro-tinta);
}

.rs__dre {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.rs__dre th,
.rs__dre td {
  padding: 10px 24px;
  border-top: 1px solid var(--linha-suave);
  color: var(--tinta);
  font-weight: 500;
  text-align: start;
}

.rs__dre td {
  text-align: end;
  white-space: nowrap;
}

.rs__dre--menos th,
.rs__dre--menos td {
  color: var(--tinta-2);
}

.rs__dre--menos th {
  padding-inline-start: 40px;
}

.rs__dre--subtotal th,
.rs__dre--subtotal td {
  font-weight: 650;
  background: color-mix(in oklab, var(--superficie-2) 60%, var(--superficie));
}

.rs__dre--total th,
.rs__dre--total td {
  font-size: 15.5px;
  font-weight: 700;
  background: color-mix(in oklab, var(--pets-fundo) 45%, var(--superficie));
}

.rs__dre-parte {
  width: 6rem;
  color: var(--tinta-2) !important;
  font-size: 13px;
}

@container (max-width: 760px) {
  .rs__numeros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container (max-width: 940px) {
  .rs__par {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
