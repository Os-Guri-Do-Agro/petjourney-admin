/**
 * Os filtros do protótipo de Saúde pública, os mesmos em todas as telas do espaço: escolher uma
 * região no Painel e abrir as Campanhas mostra as campanhas daquela região. Ficam na memória da aba,
 * como o resto da demonstração (recarregar volta ao programa inteiro, na cidade toda).
 *
 * - **Período**: os 90 dias, os últimos 30 ou 7, ou as datas escolhidas no calendário.
 * - **Região**: uma ou mais das 7 regiões urbanas; nenhuma é a cidade inteira.
 * - **Campanha**: um atalho que aponta para a campanha (as regiões dela, o cuidado dela e as semanas
 *   em volta da data) e mostra o que ela rendeu. Mexer à mão em outro filtro desfaz o atalho.
 * - **Espécie**: cães e gatos, só cães ou só gatos.
 */
import { computed, ref } from 'vue'

import {
  dataCurta,
  PERIODO,
  regiao as regiaoDe,
  tipoDeCampanha,
  type IdDaRegiao,
  type Indicador,
} from '@/features/saude-publica/dados'
import {
  CAMPANHAS_DO_PERIODO,
  dataDoDia,
  diaDaManha,
  diaDaNoite,
  seAplica,
  type Especie,
  type Recorte,
} from '@/features/saude-publica/serie'

export type AtalhoDoPeriodo = '90' | '30' | '7' | 'datas'

const atalho = ref<AtalhoDoPeriodo>('90')
const de = ref(PERIODO.inicio)
const ate = ref(PERIODO.fim)
const regioes = ref<IdDaRegiao[]>([])
const campanha = ref<string | null>(null)
const especie = ref<Especie>('todos')
/** O cuidado que o Painel pinta; a campanha troca para o dela. */
const indicador = ref<Indicador>('leishmaniose')

function aplicarAtalho(valor: Exclude<AtalhoDoPeriodo, 'datas'>) {
  const dias = Number(valor)
  atalho.value = valor
  ate.value = PERIODO.fim
  de.value = dataDoDia(PERIODO.dias - dias)
}

const recorte = computed<Recorte>(() => ({
  de: diaDaManha(de.value),
  ate: diaDaNoite(ate.value),
  regioes: regioes.value,
  especie: especie.value,
}))

const campanhaEscolhida = computed(
  () => CAMPANHAS_DO_PERIODO.find((item) => item.id === campanha.value) ?? null,
)

/** "Do dia 01/12/2026 a 28/02/2027": o "de quando" de todos os números. */
const intervalo = computed(() => `${dataCurta(de.value)} a ${dataCurta(ate.value)}`)

/** O período numa frase curta: "nos 90 dias", "nos últimos 30 dias", "de 05/01 a 20/01". */
const periodoNaFrase = computed(() => {
  if (atalho.value === '90') return 'nos 90 dias'
  if (atalho.value !== 'datas') return `nos últimos ${atalho.value} dias`
  return `de ${dataCurta(de.value).slice(0, 5)} a ${dataCurta(ate.value).slice(0, 5)}`
})

/** "na cidade", "no Prosa", "no Segredo e no Prosa", "em 3 regiões". */
const lugarNaFrase = computed(() => {
  const nomes = regioes.value.map((id) => `no ${regiaoDe(id).nome}`)
  if (!nomes.length) return 'na cidade'
  if (nomes.length === 1) return nomes[0]!
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`
  return `em ${nomes.length} regiões`
})

const especieNaFrase = computed(() =>
  especie.value === 'caes' ? 'cães' : especie.value === 'gatos' ? 'gatos' : 'cães e gatos',
)

/** Quantos filtros saem do padrão (programa inteiro, cidade, cães e gatos). */
const ativos = computed(
  () =>
    Number(atalho.value !== '90') +
    Number(regioes.value.length > 0) +
    Number(campanha.value !== null) +
    Number(especie.value !== 'todos'),
)

export function useFiltrosDoPrototipo() {
  return {
    atalho: computed(() => atalho.value),
    de: computed(() => de.value),
    ate: computed(() => ate.value),
    regioes: computed(() => regioes.value),
    campanha: computed(() => campanha.value),
    especie: computed(() => especie.value),
    indicador: computed(() => indicador.value),
    recorte,
    campanhaEscolhida,
    intervalo,
    periodoNaFrase,
    lugarNaFrase,
    especieNaFrase,
    ativos,

    escolherAtalho(valor: Exclude<AtalhoDoPeriodo, 'datas'>) {
      campanha.value = null
      aplicarAtalho(valor)
    },
    escolherDatas(inicio: string, fim: string) {
      campanha.value = null
      atalho.value = 'datas'
      de.value = inicio <= fim ? inicio : fim
      ate.value = inicio <= fim ? fim : inicio
    },
    escolherRegioes(ids: IdDaRegiao[]) {
      campanha.value = null
      regioes.value = [...ids]
    },
    /** Gatos com um cuidado que é só de cães: o painel passa para a antirrábica. */
    escolherEspecie(valor: Especie) {
      campanha.value = null
      especie.value = valor
      if (!seAplica(indicador.value, valor)) indicador.value = 'antirrabica'
    },
    /** Um cuidado que é só de cães, com "Gatos" escolhido: a espécie volta para cães e gatos. */
    escolherIndicador(valor: Indicador) {
      indicador.value = valor
      if (!seAplica(valor, especie.value)) especie.value = 'todos'
    },

    /**
     * A campanha como atalho: as regiões dela, o cuidado dela, de duas semanas antes a três depois
     * da data (dentro dos 90 dias), e a espécie de quem ela atende. Escolher de novo desfaz.
     */
    escolherCampanha(id: string | null) {
      const alvo = CAMPANHAS_DO_PERIODO.find((item) => item.id === id)
      if (!alvo) {
        campanha.value = null
        return
      }
      const tipo = tipoDeCampanha(alvo.tipo)
      const dia = diaDaManha(alvo.data)
      campanha.value = alvo.id
      regioes.value = [...alvo.regioes]
      indicador.value = tipo.indicador
      especie.value = 'todos'
      atalho.value = 'datas'
      de.value = dataDoDia(Math.max(0, dia - 14))
      ate.value = dataDoDia(Math.min(PERIODO.dias - 1, dia + 21))
    },

    limpar() {
      campanha.value = null
      regioes.value = []
      especie.value = 'todos'
      aplicarAtalho('90')
    },
  }
}
