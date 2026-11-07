<script setup lang="ts">
/**
 * A casa do hotel pela API (E7-01, PJ-OG9YPX, guia e7 1 a 11): a planta (corredores e
 * acomodações), os tipos, as tarifas, as temporadas, os serviços, a política e as exigências de
 * admissão, num controle logo abaixo do título. A vista vive na URL (`?vista=`; a planta é o
 * endereço limpo).
 *
 * Uma leitura só (`GET /catalogos`) ao abrir e depois de cada gravação. Quem não vê dinheiro
 * (`hotel.valores`) não tem as vistas de tarifas e temporadas (a API nem manda as chaves) e vê os
 * serviços e a política sem preço nem percentual. Quem edita a casa (`estabelecimento.editar`)
 * sempre vê dinheiro; quem cuida da rotina (`hotel.rotina`) só tira acomodação de operação.
 */
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { lerCasa, type CasaDoHotel } from '@/service/parceiro/hotel-casa-service'

import ExigenciasDaCasa from './ExigenciasDaCasa.vue'
import PlantaDaCasa from './PlantaDaCasa.vue'
import PoliticaDaCasa from './PoliticaDaCasa.vue'
import ServicosDaCasa from './ServicosDaCasa.vue'
import TarifasDaCasa from './TarifasDaCasa.vue'
import TemporadasDaCasa from './TemporadasDaCasa.vue'
import TiposDaCasa from './TiposDaCasa.vue'

type Vista =
  | 'acomodacoes'
  | 'tipos'
  | 'tarifas'
  | 'temporadas'
  | 'servicos'
  | 'politica'
  | 'exigencias'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { store, parceiroQuery } = useParceiroPortal()

const escreve = computed(() => Boolean(store.modulo('HOTEL')?.podeEscrever))
const editaCasa = computed(() => escreve.value && store.temPermissao('estabelecimento.editar'))
const veDinheiro = computed(() => store.temPermissao('hotel.valores'))
const podeDesativar = computed(
  () =>
    escreve.value &&
    (store.temPermissao('estabelecimento.editar') || store.temPermissao('hotel.rotina')),
)

const vistas = computed<Vista[]>(() => [
  'acomodacoes',
  'tipos',
  ...(veDinheiro.value ? (['tarifas', 'temporadas'] as const) : []),
  'servicos',
  'politica',
  'exigencias',
])

const vista = computed<Vista>({
  get: () => {
    const pedida = route.query.vista
    return typeof pedida === 'string' && (vistas.value as string[]).includes(pedida)
      ? (pedida as Vista)
      : 'acomodacoes'
  },
  set: (nova) => {
    const query = { ...route.query }
    if (nova === 'acomodacoes') delete query.vista
    else query.vista = nova
    void router.replace({ query })
  },
})

const opcoes = computed(() =>
  vistas.value.map((valor) => ({ valor, rotulo: t(`casaDoHotel.vistas.${valor}`) })),
)

const casa = ref<CasaDoHotel | null>(null)
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    casa.value = await lerCasa(parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('casaDoHotel.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())

const resumo = computed(() => {
  if (!casa.value || vista.value !== 'acomodacoes') return ''
  const todas = casa.value.acomodacoes
  const paradas = todas.filter((a) => !a.ativa).length
  const ocupadas = todas.filter((a) => a.ativa && a.ocupadaAgora).length
  return [
    t('casaDoHotel.resumo.acomodacoes', { total: todas.length }, todas.length),
    ocupadas ? t('casaDoHotel.resumo.ocupadas', { total: ocupadas }, ocupadas) : '',
    paradas ? t('casaDoHotel.resumo.paradas', { total: paradas }) : '',
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <UiPagina :titulo="t('casaDoHotel.titulo')" :resumo="resumo" icone="ph ph-building">
    <div class="cd">
      <SelectButton
        v-model="vista"
        :options="opcoes"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('casaDoHotel.vistas.rotulo')"
        class="cd__vistas"
      />

      <p v-if="erro" class="cd__erro" role="alert">{{ erro }}</p>
      <div v-if="carregando && !casa" class="cd__esqueleto" aria-busy="true">
        <Skeleton v-for="n in 3" :key="n" height="6rem" />
      </div>

      <template v-else-if="casa">
        <PlantaDaCasa
          v-if="vista === 'acomodacoes'"
          :casa="casa"
          :pode-editar="editaCasa"
          :pode-desativar="podeDesativar"
          @mudou="carregar"
        />
        <TiposDaCasa
          v-else-if="vista === 'tipos'"
          :casa="casa"
          :pode-editar="editaCasa"
          @mudou="carregar"
        />
        <TarifasDaCasa
          v-else-if="vista === 'tarifas'"
          :casa="casa"
          :pode-editar="editaCasa"
          @mudou="carregar"
        />
        <TemporadasDaCasa
          v-else-if="vista === 'temporadas'"
          :casa="casa"
          :pode-editar="editaCasa"
          @mudou="carregar"
        />
        <ServicosDaCasa
          v-else-if="vista === 'servicos'"
          :casa="casa"
          :pode-editar="editaCasa"
          @mudou="carregar"
        />
        <PoliticaDaCasa
          v-else-if="vista === 'politica'"
          :politica="casa.politica"
          :pode-editar="editaCasa"
          @salva="carregar"
        />
        <ExigenciasDaCasa v-else :casa="casa" :pode-editar="editaCasa" @mudou="carregar" />
      </template>
    </div>
  </UiPagina>
</template>

<style scoped>
.cd {
  display: grid;
  gap: 20px;
}

.cd__vistas {
  justify-self: start;
  flex-wrap: wrap;
}

.cd__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.cd__esqueleto {
  display: grid;
  gap: 16px;
}
</style>
