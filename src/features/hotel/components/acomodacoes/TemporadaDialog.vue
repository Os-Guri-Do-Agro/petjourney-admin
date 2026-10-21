<script setup lang="ts">
/**
 * Cadastro de uma temporada.
 *
 * ## Por que dia e mês, e não data cheia
 *
 * Dezembro é caro todo ano. Cadastrar "20/12/2026" obrigaria a casa a recadastrar tudo em janeiro,
 * e a primeira virada de ano em que alguém esquecesse deixaria a alta temporada com preço de baixa.
 * Sem ano, a regra é permanente e o cálculo a materializa no ano corrente.
 *
 * ## A virada do ano
 *
 * Um fim menor que o início significa que a faixa atravessa dezembro, e isso é caso legítimo e
 * comum — é justamente o fim de ano. A régua embaixo do formulário mostra a faixa desenhada no ano
 * enquanto a pessoa digita, que é a forma honesta de confirmar: dois campos de texto não deixam
 * ninguém ver que acabou de cadastrar onze meses de alta temporada por ter trocado a ordem.
 *
 * ## Por que percentual sobre a diária
 *
 * E não uma segunda tabela de preço: o que muda numa alta temporada é o multiplicador. Manter duas
 * tabelas faria a casa reajustar uma e esquecer a outra.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FaixaDoAno from './FaixaDoAno.vue'
import type { TemporadaSazonal } from '../../data/fixtures'

const props = defineProps<{
  aberto: boolean
  /** `null` cria; preenchido edita. */
  temporada: TemporadaSazonal | null
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  salvar: [
    payload: {
      nome: string
      inicioMesDia: string
      fimMesDia: string
      acrescimoPercentual: number
    },
  ]
  remover: []
}>()

const { t } = useI18n()
const idCampo = useId()

const nome = ref('')
const inicioMes = ref(1)
const inicioDia = ref(1)
const fimMes = ref(1)
const fimDia = ref(31)
const acrescimo = ref(20)
const confirmandoRemocao = ref(false)

const editando = computed(() => props.temporada !== null)

/** Dias de cada mês em ano comum. Fevereiro com 28: o cadastro é uma regra, não uma data. */
const DIAS_NO_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/*
 * O nome do mês sai do `Intl`, e não de doze chaves de tradução: os seis idiomas do projeto já
 * carregam o calendário do navegador, e um mapa próprio seria setenta e duas strings para dizer o
 * que o `Intl` já diz certo — inclusive em árabe.
 */
const { locale } = useI18n()

const meses = computed(() => {
  /*
   * Em UTC dos dois lados: a data é montada em UTC, e formatada no fuso do navegador o dia 1º à
   * meia-noite vira a noite do dia 30 no Brasil — a lista dizia "novembro" para dezembro.
   */
  const nomeDoMes = new Intl.DateTimeFormat(locale.value, { month: 'long', timeZone: 'UTC' })

  return DIAS_NO_MES.map((_, indice) => ({
    valor: indice + 1,
    rotulo: nomeDoMes.format(new Date(Date.UTC(2001, indice, 1))),
  }))
})

const diasDoInicio = computed(() => diasDe(inicioMes.value))
const diasDoFim = computed(() => diasDe(fimMes.value))

function diasDe(mes: number) {
  return Array.from({ length: DIAS_NO_MES[mes - 1] ?? 31 }, (_, i) => i + 1)
}

const dois = (valor: number) => String(valor).padStart(2, '0')

const inicioMesDia = computed(() => `${dois(inicioMes.value)}-${dois(inicioDia.value)}`)
const fimMesDia = computed(() => `${dois(fimMes.value)}-${dois(fimDia.value)}`)

watch(
  () => [props.aberto, props.temporada] as const,
  ([aberto]) => {
    if (!aberto) {
      return
    }

    const [im, id] = (props.temporada?.inicioMesDia ?? '01-01').split('-').map(Number)
    const [fm, fd] = (props.temporada?.fimMesDia ?? '01-31').split('-').map(Number)

    nome.value = props.temporada?.nome ?? ''
    inicioMes.value = im ?? 1
    inicioDia.value = id ?? 1
    fimMes.value = fm ?? 1
    fimDia.value = fd ?? 31
    acrescimo.value = props.temporada?.acrescimoPercentual ?? 20
    confirmandoRemocao.value = false
  },
  { immediate: true },
)

/* Trocar para um mês curto não pode deixar "31 de fevereiro" preso no formulário. */
watch(inicioMes, () => {
  inicioDia.value = Math.min(inicioDia.value, DIAS_NO_MES[inicioMes.value - 1] ?? 31)
})

watch(fimMes, () => {
  fimDia.value = Math.min(fimDia.value, DIAS_NO_MES[fimMes.value - 1] ?? 31)
})

const atravessaOAno = computed(() => fimMesDia.value < inicioMesDia.value)

const podeSalvar = computed(() => nome.value.trim().length > 0 && !props.salvando)

function salvar() {
  emit('salvar', {
    nome: nome.value,
    inicioMesDia: inicioMesDia.value,
    fimMesDia: fimMesDia.value,
    acrescimoPercentual: acrescimo.value,
  })
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="
      editando ? t('hotel.acomodacoes.temporada.editar') : t('hotel.acomodacoes.temporada.nova')
    "
    :style="{ width: 'min(34rem, 94vw)' }"
    class="clinic-scope pj-lugar--hotel"
    @update:visible="emit('fechar')"
  >
    <form class="forma" @submit.prevent="salvar">
      <div class="campo">
        <label :for="`${idCampo}-nome`">{{ t('hotel.acomodacoes.temporada.nome') }}</label>
        <InputText
          :id="`${idCampo}-nome`"
          v-model="nome"
          :placeholder="t('hotel.acomodacoes.temporada.nomeDica')"
          autocomplete="off"
        />
      </div>

      <div class="periodo">
        <div class="campo">
          <label :for="`${idCampo}-inicio-mes`">{{ t('hotel.acomodacoes.temporada.de') }}</label>
          <div class="par">
            <Select
              :input-id="`${idCampo}-inicio-dia`"
              v-model="inicioDia"
              :options="diasDoInicio"
              class="par__dia"
              :aria-label="t('hotel.acomodacoes.temporada.dia')"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
            <Select
              :input-id="`${idCampo}-inicio-mes`"
              v-model="inicioMes"
              :options="meses"
              option-label="rotulo"
              option-value="valor"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
          </div>
        </div>

        <div class="campo">
          <label :for="`${idCampo}-fim-mes`">{{ t('hotel.acomodacoes.temporada.ate') }}</label>
          <div class="par">
            <Select
              :input-id="`${idCampo}-fim-dia`"
              v-model="fimDia"
              :options="diasDoFim"
              class="par__dia"
              :aria-label="t('hotel.acomodacoes.temporada.dia')"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
            <Select
              :input-id="`${idCampo}-fim-mes`"
              v-model="fimMes"
              :options="meses"
              option-label="rotulo"
              option-value="valor"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
          </div>
        </div>
      </div>

      <!-- A régua confirma o que dois campos de texto escondem: onde a faixa cai no ano. -->
      <div class="previa">
        <FaixaDoAno :inicio="inicioMesDia" :fim="fimMesDia" />
        <p v-if="atravessaOAno" class="previa__nota">
          {{ t('hotel.acomodacoes.temporada.atravessaOAno') }}
        </p>
      </div>

      <div class="campo">
        <label :for="`${idCampo}-acrescimo`">
          {{ t('hotel.acomodacoes.temporada.acrescimo') }}
        </label>
        <InputNumber
          :input-id="`${idCampo}-acrescimo`"
          v-model="acrescimo"
          suffix="%"
          :min="0"
          :max="300"
        />
        <small class="campo__dica">{{ t('hotel.acomodacoes.temporada.acrescimoDica') }}</small>
      </div>

      <p v-if="erro" class="erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t(erro) }}
      </p>

      <section v-if="editando" class="perigo">
        <template v-if="confirmandoRemocao">
          <p class="perigo__pergunta">{{ t('hotel.acomodacoes.temporada.removerMesmo') }}</p>
          <div class="perigo__acoes">
            <Button
              :label="t('hotel.comum.cancelar')"
              severity="secondary"
              text
              size="small"
              @click="confirmandoRemocao = false"
            />
            <Button
              :label="t('hotel.acomodacoes.temporada.remover')"
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
          :label="t('hotel.acomodacoes.temporada.remover')"
          icon="ph ph-trash"
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

.periodo {
  display: grid;
  gap: 14px 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
}

.par {
  display: flex;
  gap: 8px;
}

.par__dia {
  flex: 0 0 5.5rem;
}

.par > :last-child {
  flex: 1 1 auto;
  min-width: 0;
}

/*
 * O rótulo do Select vem do PrimeVue em 1rem, por cima do tamanho do `.clinic-scope` que os
 * outros campos do diálogo usam: o "20" e o "dezembro" saíam maiores e mais altos que o nome e o
 * acréscimo. Herdar devolve a mesma letra e a mesma altura a todos os campos.
 */
.forma :deep(.p-select-label) {
  font-size: inherit;
}

/* A prévia: onde a faixa cai no ano, antes de salvar. */
.previa {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie-2);
}

.previa :deep(.regua) {
  block-size: 10px;
}

.previa__nota {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}
</style>
