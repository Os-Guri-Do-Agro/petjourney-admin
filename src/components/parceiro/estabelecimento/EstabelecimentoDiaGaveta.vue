<script setup lang="ts">
/**
 * Um dia especial novo: a data no calendário, o nome, e se a casa fecha o dia inteiro ou atende em
 * outro horário. O dia especial manda sobre a semana naquela data.
 *
 * A mesma data duas vezes a API recusa (`ESTABELECIMENTO_DIA_ESPECIAL_JA_EXISTE`); a mensagem dela
 * aparece aqui, na gaveta.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Drawer from 'primevue/drawer'
import InputMask from 'primevue/inputmask'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { isRTLLocale, type Locale } from '@/i18n/locales'
import type { NovoDiaEspecial } from '@/service/parceiro/estabelecimento-service'

import { dataCivil, problemaNoDia } from './horario'
import './gaveta.css'

const props = defineProps<{
  /** Hoje no fuso do estabelecimento, `AAAA-MM-DD`: o calendário começa nele. */
  hoje: string
  salvando: boolean
  erro: Error | null
}>()

const emit = defineEmits<{ salvar: [dia: NovoDiaEspecial] }>()

const visible = defineModel<boolean>('visible', { default: false })

const LARGURA = '26.5rem'

const { t, locale } = useI18n()
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

const drawerPosition = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))

const data = ref<Date | null>(null)
const nome = ref('')
const fechado = ref(true)
const abre = ref('')
const fecha = ref('')
const tentouSalvar = ref(false)

watch(visible, (aberta) => {
  if (!aberta) return

  data.value = null
  nome.value = ''
  fechado.value = true
  abre.value = ''
  fecha.value = ''
  tentouSalvar.value = false
})

/** O calendário devolve meia-noite local; a data civil é a do quadradinho escolhido. */
function paraTexto(valor: Date) {
  const ano = valor.getFullYear()
  const mes = String(valor.getMonth() + 1).padStart(2, '0')
  const dia = String(valor.getDate()).padStart(2, '0')

  return `${ano}-${mes}-${dia}`
}

const minimo = computed(() => {
  const hoje = dataCivil(props.hoje)

  return new Date(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate())
})

const problemaDoHorario = computed(() =>
  problemaNoDia({ fechado: fechado.value, abre: abre.value || null, fecha: fecha.value || null }),
)

/** O erro da API vale para o que foi enviado: mexeu no formulário, ele sai da tela. */
const mexeuDepoisDoErro = ref(false)

watch(
  () => props.erro,
  () => {
    mexeuDepoisDoErro.value = false
  },
)

watch([data, nome, fechado, abre, fecha], () => {
  mexeuDepoisDoErro.value = true
})

const erroVisivel = computed(() => (mexeuDepoisDoErro.value ? null : props.erro))

const faltaData = computed(() => tentouSalvar.value && !data.value)
const faltaNome = computed(() => tentouSalvar.value && nome.value.trim() === '')
const horarioInvalido = computed(() => tentouSalvar.value && problemaDoHorario.value !== null)

function salvar() {
  tentouSalvar.value = true

  if (!data.value || nome.value.trim() === '' || problemaDoHorario.value || props.salvando) return

  emit('salvar', {
    data: paraTexto(data.value),
    nome: nome.value.trim(),
    fechado: fechado.value,
    abre: fechado.value ? null : abre.value,
    fecha: fechado.value ? null : fecha.value,
  })
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="drawerPosition"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="estabelecimento-gaveta"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
  >
    <template #header>
      <h2 class="eg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i class="ph ph-calendar-star" />
        </span>
        {{ t('parceiro.estabelecimento.gaveta.titulo.dia') }}
      </h2>
    </template>

    <form id="estabelecimento-dia" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <span id="dia-data-rotulo" class="eg__rotulo">{{
          t('parceiro.estabelecimento.dia.data')
        }}</span>
        <DatePicker
          v-model="data"
          inline
          :min-date="minimo"
          aria-labelledby="dia-data-rotulo"
          :disabled="salvando"
        />
        <p v-if="faltaData" class="eg__invalido">
          {{ t('parceiro.estabelecimento.dia.faltaData') }}
        </p>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="dia-nome">{{
          t('parceiro.estabelecimento.dia.nome')
        }}</label>
        <InputText
          id="dia-nome"
          v-model="nome"
          maxlength="80"
          autocomplete="off"
          :placeholder="t('parceiro.estabelecimento.dia.nomeExemplo')"
          :invalid="faltaNome"
          :disabled="salvando"
        />
        <p v-if="faltaNome" class="eg__invalido">
          {{ t('parceiro.estabelecimento.dia.faltaNome') }}
        </p>
      </section>

      <section class="eg__secao">
        <div class="eg__chave">
          <label class="eg__rotulo" for="dia-fechado">{{
            t('parceiro.estabelecimento.dia.fechado')
          }}</label>
          <ToggleSwitch v-model="fechado" input-id="dia-fechado" :disabled="salvando" />
        </div>

        <div v-if="!fechado" class="dia-faixa">
          <InputMask
            v-model="abre"
            mask="99:99"
            placeholder="08:00"
            :aria-label="t('parceiro.estabelecimento.dia.abre')"
            :invalid="horarioInvalido"
            :disabled="salvando"
          />
          <span class="eg__dica">{{ t('parceiro.estabelecimento.horario.ate') }}</span>
          <InputMask
            v-model="fecha"
            mask="99:99"
            placeholder="12:00"
            :aria-label="t('parceiro.estabelecimento.dia.fecha')"
            :invalid="horarioInvalido"
            :disabled="salvando"
          />
        </div>
        <p v-if="horarioInvalido && problemaDoHorario" class="eg__invalido">
          {{ t(`parceiro.estabelecimento.horario.problema.${problemaDoHorario}`) }}
        </p>
        <p v-else class="eg__dica">
          {{
            fechado
              ? t('parceiro.estabelecimento.dia.fechadoDica')
              : t('parceiro.estabelecimento.dia.abertoDica')
          }}
        </p>
      </section>

      <p v-if="erroVisivel" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ erroVisivel.message }}
      </p>
    </form>

    <template #footer>
      <div class="eg__pe">
        <Button
          type="button"
          :label="t('parceiro.estabelecimento.gaveta.cancelar')"
          severity="secondary"
          outlined
          :disabled="salvando"
          @click="visible = false"
        />
        <Button
          type="submit"
          form="estabelecimento-dia"
          icon="ph ph-check"
          :label="t('parceiro.estabelecimento.dia.adicionar')"
          :loading="salvando"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.dia-faixa {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dia-faixa :deep(.p-inputmask) {
  width: 5.5rem;
  font-family: var(--font-dados);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.eg__secao :deep(.p-datepicker) {
  justify-self: start;
}
</style>
