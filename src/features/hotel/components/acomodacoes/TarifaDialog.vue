<script setup lang="ts">
/**
 * Cadastro de uma tabela de preço.
 *
 * ## Por que por porte, e não um preço só
 *
 * O gigante ocupa mais espaço e come mais. A casa que cobra o mesmo do mini e do são-bernardo está
 * financiando o segundo com o primeiro — e descobre isso no fim do ano, olhando a margem, sem
 * conseguir dizer de onde veio.
 *
 * ## Por que o acompanhante é percentual
 *
 * O segundo animal da mesma casa custa uma fração da diária cheia, e fração e não desconto fixo:
 * a diária varia por porte, e R$ 40 de abatimento viraria gratuidade no mini e quase nada no
 * gigante.
 *
 * ## O que este diálogo **não** faz
 *
 * Não reescreve reserva fechada. O orçamento é gravado no momento da venda, e reajustar em
 * dezembro não pode mexer no que o cliente pagou em julho. Quem edita aqui está mudando o preço
 * **daqui para a frente**, e a linha embaixo do formulário diz isso em voz alta — porque é a
 * primeira pergunta de quem mexe em preço, e uma tela que não responde faz a pessoa não mexer.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useHotelFormat } from '../../composables/useHotelFormat'
import type { PetPorte, Tarifa } from '../../data/types'

const props = defineProps<{
  aberto: boolean
  /** `null` cria; preenchido edita. */
  tarifa: Tarifa | null
  /** Quantas acomodações usam esta tabela. Zero é o único caso em que remover é honesto. */
  emUso: number
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  salvar: [
    payload: {
      nome: string
      diariaPorPorte: Record<PetPorte, number>
      acompanhantePercentual: number
    },
  ]
  remover: []
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

const PORTES: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']

/** Os preços em centavos, que é como o domínio os guarda — arredondar aqui é perder dinheiro. */
const VAZIO: Record<PetPorte, number> = {
  mini: 0,
  pequeno: 0,
  medio: 0,
  grande: 0,
  gigante: 0,
}

const nome = ref('')
const diarias = ref<Record<PetPorte, number>>({ ...VAZIO })
const acompanhante = ref(70)
const confirmandoRemocao = ref(false)

const editando = computed(() => props.tarifa !== null)

watch(
  () => [props.aberto, props.tarifa] as const,
  ([aberto]) => {
    if (!aberto) {
      return
    }

    nome.value = props.tarifa?.nome ?? ''
    diarias.value = { ...VAZIO, ...(props.tarifa?.diariaPorPorte ?? {}) }
    acompanhante.value = props.tarifa?.acompanhantePercentual ?? 70
    confirmandoRemocao.value = false
  },
  { immediate: true },
)

/*
 * O `InputNumber` trabalha em reais e o domínio guarda centavos. A conversão acontece na borda do
 * diálogo, nos dois sentidos, para nenhum outro arquivo precisar saber que existe uma borda.
 */
function emReais(porte: PetPorte) {
  return diarias.value[porte] / 100
}

function escreverReais(porte: PetPorte, valor: number | null) {
  diarias.value = { ...diarias.value, [porte]: Math.round((valor ?? 0) * 100) }
}

const podeSalvar = computed(
  () =>
    nome.value.trim().length > 0 &&
    PORTES.every((porte) => diarias.value[porte] > 0) &&
    !props.salvando,
)

function salvar() {
  emit('salvar', {
    nome: nome.value,
    diariaPorPorte: { ...diarias.value },
    acompanhantePercentual: acompanhante.value,
  })
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="editando ? t('hotel.acomodacoes.preco.editar') : t('hotel.acomodacoes.preco.nova')"
    :style="{ width: 'min(34rem, 94vw)' }"
    class="clinic-scope"
    @update:visible="emit('fechar')"
  >
    <form class="forma" @submit.prevent="salvar">
      <div class="campo">
        <label :for="`${idCampo}-nome`">{{ t('hotel.acomodacoes.preco.nome') }}</label>
        <InputText
          :id="`${idCampo}-nome`"
          v-model="nome"
          :placeholder="t('hotel.acomodacoes.preco.nomeDica')"
          autocomplete="off"
        />
      </div>

      <fieldset class="portes">
        <legend class="portes__titulo">{{ t('hotel.acomodacoes.preco.diarias') }}</legend>

        <div v-for="porte in PORTES" :key="porte" class="porte">
          <label :for="`${idCampo}-${porte}`">{{ formato.porte(porte) }}</label>
          <InputNumber
            :input-id="`${idCampo}-${porte}`"
            :model-value="emReais(porte)"
            mode="currency"
            currency="BRL"
            :min="0"
            :max-fraction-digits="2"
            @update:model-value="(valor) => escreverReais(porte, valor)"
          />
        </div>
      </fieldset>

      <div class="campo">
        <label :for="`${idCampo}-acompanhante`">
          {{ t('hotel.acomodacoes.preco.acompanhante') }}
        </label>
        <InputNumber
          :input-id="`${idCampo}-acompanhante`"
          v-model="acompanhante"
          suffix="%"
          :min="0"
          :max="100"
        />
        <small class="campo__dica">{{ t('hotel.acomodacoes.preco.acompanhanteDica') }}</small>
      </div>

      <p class="aviso">
        <i class="ph ph-info" aria-hidden="true" />
        {{ t('hotel.acomodacoes.preco.daquiEmDiante') }}
      </p>

      <p v-if="erro" class="erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t(erro) }}
      </p>

      <section v-if="editando" class="perigo">
        <p v-if="emUso > 0" class="perigo__travado">
          <i class="ph ph-info" aria-hidden="true" />
          {{ t('hotel.acomodacoes.preco.emUso', { total: emUso }, emUso) }}
        </p>

        <template v-else-if="confirmandoRemocao">
          <p class="perigo__pergunta">{{ t('hotel.acomodacoes.preco.removerMesmo') }}</p>
          <div class="perigo__acoes">
            <Button
              :label="t('hotel.comum.cancelar')"
              severity="secondary"
              text
              size="small"
              @click="confirmandoRemocao = false"
            />
            <Button
              :label="t('hotel.acomodacoes.preco.remover')"
              icon="ph ph-trash"
              severity="danger"
              size="small"
              :loading="salvando"
              @click="emit('remover')"
            />
          </div>
        </template>

        <Button
          v-else
          :label="t('hotel.acomodacoes.preco.remover')"
          icon="ph ph-trash"
          severity="danger"
          text
          size="small"
          @click="confirmandoRemocao = true"
        />
      </section>
    </form>

    <template #footer>
      <Button
        :label="t('hotel.comum.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('hotel.comum.salvar')"
        icon="ph ph-check"
        :disabled="!podeSalvar"
        :loading="salvando"
        @click="salvar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.forma {
  display: grid;
  gap: 18px;
}

.campo {
  display: grid;
  align-content: start;
  gap: 6px;
}

.campo label {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.campo__dica {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
}

/* Remover mora no pé do formulário, separado por um fio: é a única ação que não se desfaz. */
.perigo {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding-block-start: 14px;
  border-block-start: 1px solid var(--linha);
}

.perigo__travado {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.perigo__travado i {
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 16px;
}

.perigo__pergunta {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 600;
}

.perigo__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.erro {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 500;
}

.erro i {
  flex: none;
  font-size: 18px;
}

.porte label {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 550;
}

.portes {
  display: grid;
  margin: 0;
  padding: 14px 16px 16px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  gap: 12px;
  background: var(--superficie-2);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8.5rem), 1fr));
}

.portes__titulo {
  padding-inline: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  grid-column: 1 / -1;
}

/*
 * ## Por que `min-width: 0`, e por que o campo precisa de largura explícita
 *
 * Item de grid nasce com `min-width: auto` ("não encolha abaixo do meu conteúdo"), e o `<input>` do
 * `InputNumber` tem largura intrínseca de uns 20 caracteres — maior que a coluna. `min-width: 0`
 * devolve ao item o direito de encolher; `width: 100%` faz o campo ocupar a célula. Um sem o outro
 * não resolve.
 */
.porte {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.porte :deep(.p-inputnumber),
.porte :deep(.p-inputnumber input) {
  width: 100%;
  min-width: 0;
}

.aviso {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.aviso i {
  margin-top: 2px;
  color: var(--hotel-tinta);
  font-size: 16px;
}
</style>
