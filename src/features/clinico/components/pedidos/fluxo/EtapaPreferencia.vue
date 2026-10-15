<script setup lang="ts">
/**
 * Quando a pessoa pode — o pedido de melhor horário.
 *
 * Três perguntas curtas, todas com resposta pronta: os dias, o período e com quem. Nada aqui é
 * obrigatório além dos dias; "qualquer período" e "qualquer profissional" são respostas, não
 * campos em branco, e são as que mais deixam a clínica encaixar cedo.
 *
 * Os dias são um calendário de período com três atalhos em cima: "esta semana" resolve a maioria,
 * e quem só pode de quinta a sábado toca a quinta e o sábado. O calendário mostra o período
 * escolhido de qualquer jeito — o atalho também pinta os dias, para a pessoa ver o que disse.
 */
import { PhSun, PhSunHorizon } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../../composables/useClinicFormat'
import CalendarioDoPedido from '../CalendarioDoPedido.vue'

import { useFluxo, type QuandoPode } from './fluxo-do-pedido'

const { t } = useI18n()
const fluxo = useFluxo()
const formato = useClinicFormat()

const atalhos = computed(() => [
  { valor: 'amanha', rotulo: t('clinico.pedidos.app.quando.amanha') },
  { valor: 'semana', rotulo: t('clinico.pedidos.app.quando.semana') },
  { valor: 'proxima', rotulo: t('clinico.pedidos.app.quando.proxima') },
])

/** O atalho aceso; nenhum, quando o período veio do toque no calendário. */
const atalho = computed({
  get: () => (fluxo.pedido.quando === 'periodo' ? null : fluxo.pedido.quando),
  set: (valor: QuandoPode | null) => {
    if (!valor) {
      return
    }

    rascunho.value = null
    fluxo.pedido.quando = valor
    fluxo.pedido.periodoEscolhido = null
  },
})

/**
 * O primeiro toque no calendário marca só o começo; o período vale no segundo. Enquanto isso, o
 * pedido continua com a janela de antes — a pessoa não fica sem resposta no meio do gesto.
 */
const rascunho = ref<{ de: string; ate: string | null } | null>(null)

const periodoNoCalendario = computed({
  get: () => rascunho.value ?? { ...fluxo.janela.value },
  set: (novo: { de: string; ate: string | null } | null) => {
    if (!novo) {
      rascunho.value = null

      return
    }

    if (!novo.ate) {
      rascunho.value = novo

      return
    }

    rascunho.value = null
    fluxo.pedido.quando = 'periodo'
    fluxo.pedido.periodoEscolhido = { de: novo.de, ate: novo.ate }
  },
})

const periodos = computed(() => [
  {
    valor: 'MANHA',
    rotulo: t('clinico.pedidos.periodoTitulo.manha'),
    faixa: t('clinico.pedidos.app.faixa.manha'),
    icone: PhSunHorizon,
  },
  {
    valor: 'TARDE',
    rotulo: t('clinico.pedidos.periodoTitulo.tarde'),
    faixa: t('clinico.pedidos.app.faixa.tarde'),
    icone: PhSun,
  },
])

/**
 * O `Select` lê `null` e texto vazio como "nada escolhido" e mostra a caixa em branco: "qualquer
 * profissional" viaja como `QUALQUER` aqui e vira `null` no pedido.
 */
const QUALQUER = 'qualquer'

const profissionais = computed(() => [
  { valor: QUALQUER, rotulo: t('clinico.pedidos.app.qualquerProfissional') },
  ...(fluxo.clinica.value?.profissionais ?? []).map((item) => ({
    valor: item.id,
    rotulo: item.nome,
  })),
])

const profissionalEscolhido = computed({
  get: () => fluxo.pedido.profissionalId ?? QUALQUER,
  set: (valor: string) => {
    fluxo.pedido.profissionalId = valor === QUALQUER ? null : valor
  },
})

const janela = computed(() =>
  fluxo.janela.value.de === fluxo.janela.value.ate
    ? formato.dataCurta(fluxo.janela.value.de)
    : t('clinico.pedidos.janela', {
        de: formato.dataCurta(fluxo.janela.value.de),
        ate: formato.dataCurta(fluxo.janela.value.ate),
      }),
)
</script>

<template>
  <div class="fx-etapa">
    <div class="fx-corpo">
      <div class="fx-campo">
        <span id="pref-quando">{{ t('clinico.pedidos.app.quandoRotulo') }}</span>
        <SelectButton
          v-model="atalho"
          :options="atalhos"
          option-label="rotulo"
          option-value="valor"
          aria-labelledby="pref-quando"
          class="grupo fx-escolhas"
          style="--fx-colunas: 3"
        />
        <CalendarioDoPedido
          v-model:periodo="periodoNoCalendario"
          modo="periodo"
          :min="fluxo.limitesDoCalendario.value.min"
          :max="fluxo.limitesDoCalendario.value.max"
          :rotulo="t('clinico.pedidos.app.quandoRotulo')"
        />
        <p class="fx-linha fx-linha--suave" aria-live="polite">
          <i class="ph ph-calendar-check" aria-hidden="true" />
          <span v-if="rascunho">{{ t('clinico.pedidos.app.quandoAjuda') }}</span>
          <span v-else>{{ janela }}</span>
        </p>
      </div>

      <div class="fx-campo">
        <span id="pref-periodo">{{ t('clinico.pedidos.app.periodoRotulo') }}</span>
        <SelectButton
          v-model="fluxo.pedido.periodos"
          :options="periodos"
          option-label="rotulo"
          option-value="valor"
          multiple
          aria-labelledby="pref-periodo"
          class="grupo fx-escolhas"
        >
          <template #option="{ option }">
            <span class="fx-escolha">
              <component :is="option.icone" weight="duotone" aria-hidden="true" />
              <strong>{{ option.rotulo }}</strong>
              <span>{{ option.faixa }}</span>
            </span>
          </template>
        </SelectButton>
        <p class="fx-linha fx-linha--suave">
          <i class="ph ph-info" aria-hidden="true" />
          {{ t('clinico.pedidos.app.periodoAjuda') }}
        </p>
      </div>

      <label class="fx-campo">
        <span>{{ t('clinico.pedidos.app.comQuem') }}</span>
        <Select
          v-model="profissionalEscolhido"
          :options="profissionais"
          option-label="rotulo"
          option-value="valor"
          fluid
        />
      </label>
    </div>

    <div class="fx-rodape">
      <Button
        :label="t('clinico.pedidos.app.continuar')"
        icon="ph ph-arrow-right"
        icon-pos="right"
        :disabled="rascunho !== null"
        @click="fluxo.confirmarPreferencia()"
      />
    </div>
  </div>
</template>
