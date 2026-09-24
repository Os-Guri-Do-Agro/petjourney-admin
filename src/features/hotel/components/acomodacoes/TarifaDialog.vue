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
import Message from 'primevue/message'
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

      <p class="aviso">{{ t('hotel.acomodacoes.preco.daquiEmDiante') }}</p>

      <Message v-if="erro" severity="error" :closable="false">{{ t(erro) }}</Message>

      <section v-if="editando" class="perigo">
        <p v-if="emUso > 0" class="perigo__travado">
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
              icon="pi pi-trash"
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
          icon="pi pi-trash"
          severity="danger"
          text
          size="small"
          @click="confirmandoRemocao = true"
        />
      </section>
    </form>

    <template #footer>
      <Button :label="t('hotel.comum.cancelar')" severity="secondary" text @click="emit('fechar')" />
      <Button
        :label="t('hotel.comum.salvar')"
        icon="pi pi-check"
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
  gap: var(--clinic-space-4);
}

.campo {
  display: grid;
  gap: var(--clinic-space-2);
}

.campo label,
.porte label {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.campo__dica {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.portes {
  display: grid;
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface-soft);
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
}

.portes__titulo {
  padding-inline: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  grid-column: 1 / -1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.porte {
  display: grid;
  gap: var(--clinic-space-2);
}

.aviso {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.perigo {
  display: grid;
  justify-items: start;
  padding-block-start: var(--clinic-space-3);
  border-block-start: 1px solid var(--clinic-line-soft);
  gap: var(--clinic-space-2);
}

.perigo__travado {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.perigo__pergunta {
  margin: 0;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.perigo__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

/* Caixa-alta rastreada não roda em árabe: o `letter-spacing` desconecta as ligaduras. */
[dir='rtl'] .portes__titulo {
  letter-spacing: normal;
  text-transform: none;
}
</style>
