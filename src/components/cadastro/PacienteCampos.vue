<script setup lang="ts">
/**
 * Os campos do paciente (E2-01, seção 1.4), os mesmos no cadastro novo e na gaveta de editar.
 *
 * Nome e espécie são obrigatórios; "Outra" pede qual. A data de nascimento pode vir de uma idade
 * dita no balcão ("uns 3 anos"): aí ela é marcada como estimada. O porte é escolhido, não sai do
 * peso. Castrado tem o "não informado", que é diferente de "não".
 */
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { CamposDoPaciente, ErrosDoPaciente } from '@/components/cadastro/campos'
import { ESPECIES, PORTES } from '@/service/parceiro/pacientes-service'

const campos = defineModel<CamposDoPaciente>({ required: true })

defineProps<{
  erros?: ErrosDoPaciente
  desabilitado?: boolean
  /** Prefixo dos ids, para duas instâncias na mesma página não repetirem. */
  id: string
}>()

const { t, locale } = useI18n()

const opcoesDeEspecie = computed(() =>
  ESPECIES.map((valor) => ({ valor, rotulo: t(`cadastro.especie.${valor}`) })),
)

/*
 * O PrimeVue lê `null` como "nada escolhido": "Não informado" ganha um valor próprio (`NI`) nos
 * botões, e o porte usa o texto de espera com o x para limpar.
 */
const NAO_INFORMADO = 'NI'

const opcoesDePorte = computed(() =>
  PORTES.map((valor) => ({ valor, rotulo: t(`cadastro.porte.${valor}`) })),
)

const opcoesDeSexo = computed(() => [
  { valor: 'MACHO', rotulo: t('cadastro.sexo.MACHO') },
  { valor: 'FEMEA', rotulo: t('cadastro.sexo.FEMEA') },
  { valor: NAO_INFORMADO, rotulo: t('cadastro.naoInformado') },
])

const opcoesDeCastrado = computed(() => [
  { valor: 'SIM', rotulo: t('cadastro.sim') },
  { valor: 'NAO', rotulo: t('cadastro.nao') },
  { valor: NAO_INFORMADO, rotulo: t('cadastro.naoInformado') },
])

const sexo = computed({
  get: () => campos.value.sexo ?? NAO_INFORMADO,
  set: (valor: string) => {
    campos.value.sexo = valor === 'MACHO' || valor === 'FEMEA' ? valor : null
  },
})

const castrado = computed({
  get: () =>
    campos.value.castrado === null ? NAO_INFORMADO : campos.value.castrado ? 'SIM' : 'NAO',
  set: (valor: string) => {
    campos.value.castrado = valor === 'SIM' ? true : valor === 'NAO' ? false : null
  },
})

/* O DatePicker trabalha com Date; a API, com `AAAA-MM-DD`. A conversão é pelo dia local. */
const nascimentoDate = computed<Date | null>({
  get() {
    const [ano, mes, dia] = campos.value.nascimento.split('-').map(Number)

    return ano && mes && dia ? new Date(ano, mes - 1, dia) : null
  },
  set(data) {
    campos.value.nascimento = data
      ? `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
          data.getDate(),
        ).padStart(2, '0')}`
      : ''
  },
})

const hoje = new Date()
const intl = computed(() => INTL_LOCALE[locale.value as Locale])
</script>

<template>
  <section class="eg__secao">
    <label class="eg__rotulo" :for="`${id}-nome`">{{ t('cadastro.campos.nome') }}</label>
    <InputText
      :id="`${id}-nome`"
      v-model="campos.nome"
      autocomplete="off"
      maxlength="80"
      :invalid="Boolean(erros?.nome)"
      :disabled="desabilitado"
    />
    <small v-if="erros?.nome" class="eg__invalido">{{ erros.nome }}</small>
  </section>

  <div class="eg__linha">
    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-especie`">{{ t('cadastro.campos.especie') }}</label>
      <Select
        v-model="campos.especie"
        :input-id="`${id}-especie`"
        :options="opcoesDeEspecie"
        option-label="rotulo"
        option-value="valor"
        :placeholder="t('cadastro.campos.escolha')"
        :invalid="Boolean(erros?.especie)"
        :disabled="desabilitado"
      />
      <small v-if="erros?.especie" class="eg__invalido">{{ erros.especie }}</small>
    </section>

    <section v-if="campos.especie === 'OUTRO'" class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-especie-outra`">
        {{ t('cadastro.campos.especieOutra') }}
      </label>
      <InputText
        :id="`${id}-especie-outra`"
        v-model="campos.especieOutra"
        maxlength="40"
        :placeholder="t('cadastro.campos.especieOutraExemplo')"
        :invalid="Boolean(erros?.especieOutra)"
        :disabled="desabilitado"
      />
      <small v-if="erros?.especieOutra" class="eg__invalido">{{ erros.especieOutra }}</small>
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-raca`">
        {{ t('cadastro.campos.raca') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </label>
      <InputText :id="`${id}-raca`" v-model="campos.raca" maxlength="60" :disabled="desabilitado" />
    </section>
  </div>

  <section class="eg__secao">
    <span :id="`${id}-sexo`" class="eg__rotulo">{{ t('cadastro.campos.sexo') }}</span>
    <SelectButton
      v-model="sexo"
      :options="opcoesDeSexo"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
      :aria-labelledby="`${id}-sexo`"
      :disabled="desabilitado"
    />
  </section>

  <section class="eg__secao">
    <span :id="`${id}-castrado`" class="eg__rotulo">{{ t('cadastro.campos.castrado') }}</span>
    <SelectButton
      v-model="castrado"
      :options="opcoesDeCastrado"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
      :aria-labelledby="`${id}-castrado`"
      :disabled="desabilitado"
    />
  </section>

  <section class="eg__secao">
    <span :id="`${id}-nascimento`" class="eg__rotulo">
      {{ t('cadastro.campos.nascimento') }}
      <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
    </span>
    <DatePicker
      v-model="nascimentoDate"
      inline
      :max-date="hoje"
      :aria-labelledby="`${id}-nascimento`"
      :disabled="desabilitado"
      class="pc__calendario"
    />
    <label class="pc__estimada">
      <Checkbox
        v-model="campos.nascimentoEstimado"
        binary
        :input-id="`${id}-estimado`"
        :disabled="desabilitado || !campos.nascimento"
      />
      <span>{{ t('cadastro.campos.nascimentoEstimado') }}</span>
    </label>
  </section>

  <div class="eg__linha">
    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-porte`">{{ t('cadastro.campos.porte') }}</label>
      <Select
        v-model="campos.porte"
        :input-id="`${id}-porte`"
        :options="opcoesDePorte"
        option-label="rotulo"
        option-value="valor"
        :placeholder="t('cadastro.naoInformado')"
        show-clear
        :disabled="desabilitado"
      />
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-peso`">
        {{ t('cadastro.campos.peso') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </label>
      <InputNumber
        v-model="campos.pesoKg"
        :input-id="`${id}-peso`"
        :min="0"
        :max="999"
        :max-fraction-digits="2"
        :locale="intl"
        suffix=" kg"
        :disabled="desabilitado"
      />
    </section>
  </div>

  <div class="eg__linha">
    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-microchip`">
        {{ t('cadastro.campos.microchip') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </label>
      <InputText
        :id="`${id}-microchip`"
        v-model="campos.microchip"
        maxlength="30"
        spellcheck="false"
        :disabled="desabilitado"
      />
    </section>

    <section class="eg__secao">
      <label class="eg__rotulo" :for="`${id}-pelagem`">
        {{ t('cadastro.campos.pelagem') }}
        <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
      </label>
      <InputText
        :id="`${id}-pelagem`"
        v-model="campos.pelagem"
        maxlength="60"
        :disabled="desabilitado"
      />
    </section>
  </div>
</template>

<style scoped>
.pc__calendario {
  justify-self: start;
}

.pc__estimada {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13.5px;
}
</style>
