<script setup lang="ts">
/**
 * A conta da dose pela API (E4-02, guia e4 1.5): o veterinário escolhe a dose em mg/kg, o
 * intervalo, a duração e, se quiser, o peso de hoje; o servidor faz a conta, mostra a faixa do
 * bulário e os avisos. O front só monta as frases. Usado no Bulário aberto para um paciente, e
 * depois na prescrição (E4-03).
 *
 * - A dose nunca vem sugerida pelo máximo: abre no mínimo da faixa, como o mock fazia.
 * - Sem peso, nenhum número aparece (`calculo: null`).
 * - Comprimido com fração aproximada pede a decisão do veterinário, não imprime em silêncio.
 * - A frase de responsabilidade aparece sempre junto da conta.
 */
import InputNumber from 'primevue/inputnumber'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import {
  calcularDose,
  doseDaEspecie,
  numeroDoPasso,
  type EspecieDoCatalogo,
  type Medicamento,
  type ResultadoDaDose,
} from '@/service/parceiro/catalogos-service'

const props = defineProps<{
  medicamento: Medicamento
  paciente: { id: string; nome: string; especie: EspecieDoCatalogo | null }
}>()

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()

const faixa = computed(() => doseDaEspecie(props.medicamento, props.paciente.especie))

const mgPorKg = ref<number | null>(faixa.value.mgKgMin)
const frequenciaHoras = ref<number | null>(faixa.value.frequenciaHoras ?? 12)
const duracaoDias = ref<number | null>(faixa.value.duracaoUsualDias ?? null)
const pesoKg = ref<number | null>(null)

const resultado = ref<ResultadoDaDose | null>(null)
const calculando = ref(false)
const erro = ref('')

let espera: ReturnType<typeof setTimeout> | undefined
let pedidoAtual = 0

async function calcular() {
  if (!mgPorKg.value || !frequenciaHoras.value) {
    resultado.value = null
    return
  }
  const numero = ++pedidoAtual
  calculando.value = true
  erro.value = ''
  try {
    const lido = await calcularDose(
      {
        medicamentoId: props.medicamento.id,
        pacienteId: props.paciente.id,
        mgPorKg: mgPorKg.value,
        frequenciaHoras: frequenciaHoras.value,
        ...(duracaoDias.value ? { duracaoDias: duracaoDias.value } : {}),
        ...(pesoKg.value ? { pesoKg: pesoKg.value } : {}),
      },
      parceiroQuery(),
    )
    if (numero === pedidoAtual) resultado.value = lido
  } catch (err) {
    if (numero !== pedidoAtual) return
    resultado.value = null
    erro.value =
      err instanceof ApiError && err.codigo === 'CRMV_OBRIGATORIO'
        ? t('clinico.bulario.api.dose.semCrmv')
        : err instanceof Error && err.message
          ? err.message
          : t('clinico.bulario.api.dose.erro')
  } finally {
    if (numero === pedidoAtual) calculando.value = false
  }
}

/* Cada mudança de dose, intervalo, duração ou peso pede a conta de novo, com uma pausa curta. */
watch(
  () => [
    props.medicamento.id,
    mgPorKg.value,
    frequenciaHoras.value,
    duracaoDias.value,
    pesoKg.value,
  ],
  () => {
    if (espera) clearTimeout(espera)
    espera = setTimeout(() => void calcular(), 300)
  },
  { immediate: true },
)

/* Outro medicamento: a dose volta ao mínimo da faixa dele. */
watch(
  () => props.medicamento.id,
  () => {
    mgPorKg.value = faixa.value.mgKgMin
    frequenciaHoras.value = faixa.value.frequenciaHoras ?? frequenciaHoras.value
    duracaoDias.value = faixa.value.duracaoUsualDias ?? null
  },
)

function num(valor: number | null, casas = 2) {
  if (valor === null) return ''
  return new Intl.NumberFormat(rotulos.intl(), { maximumFractionDigits: casas }).format(valor)
}

function unidade(codigo: string, quantidade: number | null) {
  return t(`clinico.bulario.api.unidade.${codigo}`, quantidade ?? 2)
}

/** "12,4 kg × 10 mg/kg = 124 mg", e os outros dois passos. */
const passos = computed(() =>
  (resultado.value?.passos ?? []).map((passo) => {
    const p = passo.params
    if (passo.tipo === 'PESO_POR_DOSE') {
      return t('clinico.bulario.api.dose.passoPeso', {
        peso: num(numeroDoPasso(p, 'pesoKg')),
        dose: num(numeroDoPasso(p, 'mgPorKg')),
        mg: num(numeroDoPasso(p, 'mg')),
      })
    }
    if (passo.tipo === 'DOSE_POR_CONCENTRACAO') {
      const quantidade = numeroDoPasso(p, 'quantidade')
      const codigo = typeof p.unidade === 'string' ? p.unidade : 'ML'
      return t('clinico.bulario.api.dose.passoConcentracao', {
        mg: num(numeroDoPasso(p, 'mg')),
        concentracao: num(numeroDoPasso(p, 'concentracao')),
        unidade: unidade(codigo, 1),
        quantidade: num(quantidade),
        unidades: unidade(codigo, quantidade),
      })
    }
    return t('clinico.bulario.api.dose.passoTotal', {
      porDia: num(numeroDoPasso(p, 'porDia')),
      dias: num(numeroDoPasso(p, 'dias'), 0),
      total: num(numeroDoPasso(p, 'total'), 0),
    })
  }),
)

const fracao = computed(() => {
  const f = resultado.value?.fracionamento
  if (!f) return ''
  const nome = t(`clinico.bulario.api.fracao.${f.tipo}`, { n: num(f.quantidade) })
  return f.aproximado
    ? t('clinico.bulario.api.dose.aproximado', {
        conta: num(resultado.value?.calculo?.quantidadeApresentacao ?? null),
        fracao: nome,
      })
    : t('clinico.bulario.api.dose.fracao', { fracao: nome })
})

const textoDaFaixa = computed(() => {
  const f = resultado.value?.faixaDeReferencia
  if (!f) return ''
  return t(
    f.origem === 'ESPECIE'
      ? 'clinico.bulario.api.dose.faixaEspecie'
      : 'clinico.bulario.api.dose.faixaGeral',
    { min: num(f.mgKgMin), max: num(f.mgKgMax) },
  )
})

function textoDoAviso(aviso: ResultadoDaDose['avisos'][number]) {
  const base = t(`clinico.bulario.api.aviso.${aviso.codigo}`, {
    cuidado: aviso.cuidado ? t(`clinico.bulario.api.cuidado.${aviso.cuidado}`) : '',
  })
  return aviso.detalhe ? `${base}: ${aviso.detalhe}` : base
}
</script>

<template>
  <section class="dose" :aria-busy="calculando" aria-labelledby="dose-titulo">
    <h3 id="dose-titulo" class="dose__titulo">
      {{ t('clinico.bulario.api.dose.titulo', { pet: paciente.nome }) }}
    </h3>

    <div class="dose__campos">
      <label class="dose__campo">
        <span>{{ t('clinico.bulario.api.dose.mgPorKg') }}</span>
        <InputNumber
          v-model="mgPorKg"
          :min="0"
          :max-fraction-digits="2"
          suffix=" mg/kg"
          :input-props="{ 'aria-describedby': 'dose-faixa' }"
        />
      </label>
      <label class="dose__campo">
        <span>{{ t('clinico.bulario.api.dose.intervalo') }}</span>
        <InputNumber v-model="frequenciaHoras" :min="1" :max="168" suffix=" h" />
      </label>
      <label class="dose__campo">
        <span>{{ t('clinico.bulario.api.dose.duracao') }}</span>
        <InputNumber
          v-model="duracaoDias"
          :min="1"
          :max="365"
          :suffix="` ${t('clinico.bulario.api.dose.dias')}`"
          :placeholder="t('clinico.bulario.api.dose.continuo')"
        />
      </label>
      <label class="dose__campo">
        <span>{{ t('clinico.bulario.api.dose.peso') }}</span>
        <InputNumber
          v-model="pesoKg"
          :min="0.01"
          :max="999"
          :max-fraction-digits="2"
          suffix=" kg"
          :placeholder="t('clinico.bulario.api.dose.pesoDoCadastro')"
        />
      </label>
    </div>

    <p id="dose-faixa" class="dose__faixa">{{ textoDaFaixa }}</p>

    <p v-if="erro" class="dose__erro" role="alert">{{ erro }}</p>

    <template v-else-if="resultado">
      <!-- Os avisos, do mais grave para o menos grave; o bloqueante pede confirmação na receita. -->
      <ul v-if="resultado.avisos.length" class="dose__avisos">
        <li
          v-for="aviso in resultado.avisos"
          :key="`${aviso.codigo}-${aviso.cuidado ?? ''}`"
          :class="{ 'dose__aviso--bloqueante': aviso.bloqueante }"
        >
          <i
            :class="aviso.bloqueante ? 'ph ph-warning-octagon' : 'ph ph-warning'"
            aria-hidden="true"
          />
          <span>{{ textoDoAviso(aviso) }}</span>
        </li>
      </ul>

      <p v-if="!resultado.calculo" class="dose__dica">
        {{ t('clinico.bulario.api.dose.semPeso') }}
      </p>

      <template v-else>
        <p class="dose__resultado">
          <strong class="ui-num">
            {{ num(resultado.calculo.mgPorAdministracao) }} mg ·
            {{ num(resultado.calculo.quantidadeApresentacao) }}
            {{
              unidade(
                resultado.calculo.unidadeApresentacao,
                resultado.calculo.quantidadeApresentacao,
              )
            }}
          </strong>
          <span>{{
            t('clinico.bulario.api.dose.porAdministracao', {
              horas: num(resultado.calculo.frequenciaHoras, 0),
            })
          }}</span>
        </p>
        <ol class="dose__passos">
          <li v-for="(passo, indice) in passos" :key="indice" class="ui-num">{{ passo }}</li>
        </ol>
        <p
          v-if="fracao"
          class="dose__fracao"
          :class="{ 'dose__fracao--aproximada': resultado.fracionamento?.aproximado }"
        >
          <i class="ph ph-pill" aria-hidden="true" />
          {{ fracao }}
        </p>
      </template>

      <p class="dose__responsabilidade">{{ resultado.responsabilidade }}</p>
    </template>
  </section>
</template>

<style scoped>
.dose {
  display: grid;
  gap: 12px;
}

.dose__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.dose__campos {
  display: grid;
  gap: 10px 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dose__campo {
  display: grid;
  gap: 4px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.dose__campo :deep(.p-inputnumber),
.dose__campo :deep(.p-inputnumber-input) {
  width: 100%;
}

.dose__faixa,
.dose__dica,
.dose__responsabilidade {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.dose__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.dose__avisos {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13.5px;
}

.dose__avisos li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--tinta);
}

.dose__avisos i {
  margin-top: 2px;
  color: var(--atencao-tinta);
}

.dose__aviso--bloqueante i {
  color: var(--risco-tinta);
}

.dose__resultado {
  display: grid;
  gap: 2px;
  margin: 0;
}

.dose__resultado strong {
  color: var(--tinta);
  font-size: 18px;
  font-weight: 700;
}

.dose__resultado span {
  color: var(--tinta-2);
  font-size: 13px;
}

.dose__passos {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-left: 18px;
  color: var(--tinta);
  font-size: 13.5px;
}

.dose__fracao {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
}

.dose__fracao--aproximada {
  color: var(--atencao-tinta);
  font-weight: 600;
}

@media (max-width: 560px) {
  .dose__campos {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
