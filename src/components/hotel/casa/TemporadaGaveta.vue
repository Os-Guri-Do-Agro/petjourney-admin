<script setup lang="ts">
/**
 * Uma temporada (E7-01, guia e7 7): dia e mês sem ano, porque dezembro é caro todo ano. O fim
 * menor que o início atravessa a virada (20/12 a 05/01 é **uma** faixa, e o fim conta). A régua
 * embaixo desenha a faixa no ano enquanto a pessoa escolhe. O acréscimo é sobre a diária da
 * tabela; nos dias que duas temporadas dividem vale a de maior acréscimo, sem somar.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import FaixaDoAno from '@/features/hotel/components/acomodacoes/FaixaDoAno.vue'
import {
  ACRESCIMO_MAX,
  criarTemporada,
  editarTemporada,
  NOME_MAX,
  NOME_VALIDO,
  type TemporadaDaCasa,
} from '@/service/parceiro/hotel-casa-service'

import { useRotulosDaCasa } from './useRotulosDaCasa'

const props = defineProps<{ temporada: TemporadaDaCasa | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDaCasa()
const { parceiroQuery } = useParceiroPortal()

const nome = ref('')
const inicioMes = ref(12)
const inicioDia = ref(20)
const fimMes = ref(1)
const fimDia = ref(5)
const acrescimo = ref<number | null>(20)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const campoInvalido = ref<'inicioMesDia' | 'fimMesDia' | null>(null)

const separar = (mesDia: string) => mesDia.split('-').map(Number) as [number, number]
const juntar = (mes: number, dia: number) =>
  `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

watch(aberta, (agora) => {
  if (!agora) return
  const tp = props.temporada
  nome.value = tp?.nome ?? ''
  ;[inicioMes.value, inicioDia.value] = tp ? separar(tp.inicioMesDia) : [12, 20]
  ;[fimMes.value, fimDia.value] = tp ? separar(tp.fimMesDia) : [1, 5]
  acrescimo.value = tp?.acrescimoPercentual ?? 20
  tentou.value = false
  erro.value = ''
  campoInvalido.value = null
})

/* Fevereiro com 29: o 29/02 vale nos anos bissextos (a API aceita). */
const DIAS_NO_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const opcoesDeMes = computed(() =>
  Array.from({ length: 12 }, (_, i) => ({ valor: i + 1, rotulo: rotulos.nomeDoMes(i + 1) })),
)
const diasDe = (mes: number) =>
  Array.from({ length: DIAS_NO_MES[mes - 1] ?? 31 }, (_, i) => ({
    valor: i + 1,
    rotulo: String(i + 1),
  }))

watch(inicioMes, (mes) => {
  inicioDia.value = Math.min(inicioDia.value, DIAS_NO_MES[mes - 1] ?? 31)
})
watch(fimMes, (mes) => {
  fimDia.value = Math.min(fimDia.value, DIAS_NO_MES[mes - 1] ?? 31)
})

const inicio = computed(() => juntar(inicioMes.value, inicioDia.value))
const fim = computed(() => juntar(fimMes.value, fimDia.value))
const atravessa = computed(() => fim.value < inicio.value)

const nomeValido = computed(() => {
  const limpo = nome.value.trim()
  return limpo.length > 0 && limpo.length <= NOME_MAX && NOME_VALIDO.test(limpo)
})

async function salvar() {
  tentou.value = true
  erro.value = ''
  campoInvalido.value = null
  if (!nomeValido.value || acrescimo.value === null) return
  const corpo = {
    nome: nome.value.trim(),
    inicioMesDia: inicio.value,
    fimMesDia: fim.value,
    acrescimoPercentual: acrescimo.value,
  }
  salvando.value = true
  try {
    if (props.temporada) await editarTemporada(props.temporada.id, corpo, parceiroQuery())
    else await criarTemporada(corpo, parceiroQuery())
    aberta.value = false
    emit('salvo')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (
      lido.codigo === 'TEMPORADA_INVALIDA' &&
      (lido.campo === 'inicioMesDia' || lido.campo === 'fimMesDia')
    )
      campoInvalido.value = lido.campo
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="temporada ? t('casaDoHotel.temporada.editar') : t('casaDoHotel.temporada.nova')"
    icone="ph ph-sun-horizon"
  >
    <form id="temporada-da-casa" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="tp-nome">{{ t('casaDoHotel.temporada.nome') }}</label>
        <InputText
          id="tp-nome"
          v-model="nome"
          :maxlength="NOME_MAX"
          :placeholder="t('casaDoHotel.temporada.nomeDica')"
          :invalid="tentou && !nomeValido"
          :disabled="salvando"
        />
      </section>

      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('casaDoHotel.temporada.de') }}</h3>
        <div class="tp__data">
          <Select
            v-model="inicioMes"
            :options="opcoesDeMes"
            option-label="rotulo"
            option-value="valor"
            :aria-label="`${t('casaDoHotel.temporada.de')}: ${t('casaDoHotel.temporada.mes')}`"
            :invalid="campoInvalido === 'inicioMesDia'"
            :disabled="salvando"
          />
          <Select
            v-model="inicioDia"
            :options="diasDe(inicioMes)"
            option-label="rotulo"
            option-value="valor"
            :aria-label="`${t('casaDoHotel.temporada.de')}: ${t('casaDoHotel.temporada.dia')}`"
            :invalid="campoInvalido === 'inicioMesDia'"
            :disabled="salvando"
          />
        </div>
      </section>

      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('casaDoHotel.temporada.ate') }}</h3>
        <div class="tp__data">
          <Select
            v-model="fimMes"
            :options="opcoesDeMes"
            option-label="rotulo"
            option-value="valor"
            :aria-label="`${t('casaDoHotel.temporada.ate')}: ${t('casaDoHotel.temporada.mes')}`"
            :invalid="campoInvalido === 'fimMesDia'"
            :disabled="salvando"
          />
          <Select
            v-model="fimDia"
            :options="diasDe(fimMes)"
            option-label="rotulo"
            option-value="valor"
            :aria-label="`${t('casaDoHotel.temporada.ate')}: ${t('casaDoHotel.temporada.dia')}`"
            :invalid="campoInvalido === 'fimMesDia'"
            :disabled="salvando"
          />
        </div>
      </section>

      <div class="tp__regua">
        <FaixaDoAno :inicio="inicio" :fim="fim" />
        <small class="eg__dica">
          {{
            t('casaDoHotel.temporada.intervalo', {
              de: rotulos.mesDia(inicio),
              ate: rotulos.mesDia(fim),
            })
          }}
          <template v-if="atravessa"> · {{ t('casaDoHotel.temporada.atravessaOAno') }}</template>
        </small>
      </div>

      <section class="eg__secao">
        <label class="eg__rotulo" for="tp-acrescimo">{{
          t('casaDoHotel.temporada.acrescimo')
        }}</label>
        <InputNumber
          v-model="acrescimo"
          input-id="tp-acrescimo"
          :min="0"
          :max="ACRESCIMO_MAX"
          suffix=" %"
          :invalid="tentou && acrescimo === null"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('casaDoHotel.temporada.acrescimoDica') }}</small>
      </section>

      <p v-if="temporada" class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('casaDoHotel.temporada.naoMexe') }}</span>
      </p>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>
    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="temporada-da-casa"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.tp__data {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 10px;
}

.tp__regua {
  display: grid;
  gap: 8px;
}
</style>
