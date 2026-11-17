<script setup lang="ts">
/**
 * Nova campanha (protótipo, Ofício 001/2026, item 4d), numa gaveta em três passos:
 * 1. **Tipo**: antirrábica, encoleiramento, exame de leishmaniose ou castração.
 * 2. **Onde e quando**: as regiões (as mais atrasadas no indicador vêm primeiro), o dia no
 *    calendário e o local.
 * 3. **Aviso**: o texto, a prévia no celular do tutor e quantos tutores ele alcança. Só recebe quem
 *    está com o cuidado pendente, nas regiões escolhidas: o aviso não vira spam.
 *
 * "Agendar" põe a campanha na lista da sessão. Nada é enviado: é protótipo.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref, watch } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import PreviaDoAviso from '@/features/saude-publica/components/PreviaDoAviso.vue'
import {
  alcanceEstimado,
  dataPorExtenso,
  numero,
  REGIOES,
  tipoDeCampanha,
  TIPOS_DE_CAMPANHA,
  type IdDaRegiao,
  type TipoDeCampanha,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo } from '@/features/saude-publica/estado'

const props = defineProps<{ regiaoInicial?: IdDaRegiao | null }>()
const aberta = defineModel<boolean>('visible', { default: false })

const toast = useToast()
const { criarCampanha } = useEstadoDoPrototipo()

const PASSOS = ['Tipo', 'Onde e quando', 'Aviso']
const passo = ref(0)
const ultimo = computed(() => passo.value === PASSOS.length - 1)

const tipo = ref<TipoDeCampanha | null>(null)
const regioes = ref<IdDaRegiao[]>([])
const dia = ref<Date | null>(null)
const local = ref('')
const aviso = ref('')
const tentou = ref(false)

/* O primeiro dia possível é o seguinte ao fim da simulação (28/02/2027). */
const PRIMEIRO_DIA = new Date(2027, 2, 1)

watch(aberta, (agora) => {
  if (!agora) return
  passo.value = 0
  tipo.value = null
  regioes.value = props.regiaoInicial ? [props.regiaoInicial] : []
  dia.value = null
  local.value = ''
  aviso.value = ''
  tentou.value = false
})

const definicao = computed(() => (tipo.value ? tipoDeCampanha(tipo.value) : null))

/** As regiões, da mais atrasada à menos atrasada no indicador do tipo escolhido. */
const regioesOrdenadas = computed(() => {
  const indicador = definicao.value?.indicador ?? 'antirrabica'
  return [...REGIOES]
    .map((regiao) => ({ regiao, valor: regiao.cobertura[indicador] }))
    .sort((uma, outra) => uma.valor - outra.valor)
})

const diaIso = computed(() =>
  dia.value
    ? `${dia.value.getFullYear()}-${String(dia.value.getMonth() + 1).padStart(2, '0')}-${String(dia.value.getDate()).padStart(2, '0')}`
    : '',
)

/* O texto do aviso nasce do modelo do tipo, com o dia e o local; quem cria pode mudar. */
watch(passo, async (agora) => {
  if (agora === 2 && definicao.value) {
    aviso.value = definicao.value.aviso
      .replace('{data}', dataPorExtenso(diaIso.value))
      .replace('{local}', local.value.trim())
  }
  await nextTick()
  document.querySelector('.nc')?.closest('.p-drawer-content')?.scrollTo({ top: 0 })
})

const alcance = computed(() =>
  tipo.value ? alcanceEstimado(tipo.value, regioes.value) : { animais: 0, tutores: 0 },
)

const faltas = computed(() => {
  if (passo.value === 0) return tipo.value ? [] : ['Escolha o tipo da campanha.']
  if (passo.value === 1) {
    return [
      regioes.value.length ? '' : 'Escolha ao menos uma região.',
      dia.value ? '' : 'Escolha o dia no calendário.',
      local.value.trim() ? '' : 'Diga o local.',
    ].filter(Boolean)
  }
  return aviso.value.trim() ? [] : ['Escreva o aviso.']
})

function avancar() {
  tentou.value = true
  if (faltas.value.length) return
  tentou.value = false
  if (!ultimo.value) {
    passo.value += 1
    return
  }
  agendar()
}

function agendar() {
  if (!definicao.value) return
  criarCampanha({
    tipo: definicao.value.id,
    titulo: definicao.value.rotulo,
    regioes: regioes.value,
    data: diaIso.value,
    local: local.value.trim(),
    situacao: 'agendada',
    avisados: alcance.value.tutores,
    abriram: 0,
    atendidos: null,
  })
  toast.add({
    severity: 'success',
    summary: 'Campanha agendada',
    detail: `No programa, o aviso iria para ${numero(alcance.value.tutores)} tutores. No protótipo, nada é enviado.`,
    life: 5000,
  })
  aberta.value = false
}

function alternarRegiao(id: IdDaRegiao, marcada: boolean) {
  regioes.value = marcada ? [...regioes.value, id] : regioes.value.filter((item) => item !== id)
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    titulo="Nova campanha"
    icone="ph ph-megaphone"
    largura="36rem"
  >
    <ol class="nc__passos" aria-label="Passos da campanha">
      <li
        v-for="(nome, indice) in PASSOS"
        :key="nome"
        class="nc__passo"
        :class="{ 'nc__passo--feito': indice < passo, 'nc__passo--agora': indice === passo }"
      >
        <button
          type="button"
          class="nc__ir"
          :disabled="indice >= passo"
          :aria-current="indice === passo ? 'step' : undefined"
          @click="passo = indice"
        >
          <span class="nc__numero" aria-hidden="true">
            <i v-if="indice < passo" class="ph ph-check" />
            <template v-else>{{ indice + 1 }}</template>
          </span>
          <span class="nc__nome">{{ nome }}</span>
        </button>
      </li>
    </ol>

    <form id="nova-campanha" class="eg nc" novalidate @submit.prevent="avancar">
      <!-- 1. O tipo. -->
      <template v-if="passo === 0">
        <p class="nc__dica">Cada tipo avisa só quem está com aquele cuidado pendente.</p>
        <div class="nc__tipos" role="radiogroup" aria-label="Tipo da campanha">
          <button
            v-for="item in TIPOS_DE_CAMPANHA"
            :key="item.id"
            type="button"
            role="radio"
            class="nc__tipo"
            :class="[`nc__tipo--${item.tom}`, { 'nc__tipo--escolhido': tipo === item.id }]"
            :aria-checked="tipo === item.id"
            @click="tipo = item.id"
          >
            <span class="nc__tipo-icone" aria-hidden="true"><i :class="item.icone" /></span>
            <span class="nc__tipo-texto">
              <strong>{{ item.rotulo }}</strong>
              <small>{{ item.publicoAlvo }}</small>
            </span>
            <i
              class="nc__tipo-marca"
              :class="tipo === item.id ? 'ph ph-check-circle' : 'ph ph-circle'"
              aria-hidden="true"
            />
          </button>
        </div>
      </template>

      <!-- 2. Onde e quando. -->
      <template v-else-if="passo === 1">
        <section class="eg__secao">
          <span id="nc-regioes" class="eg__rotulo">Regiões</span>
          <small class="nc__dica">
            As mais atrasadas em {{ definicao?.rotulo.toLowerCase() }} vêm primeiro.
          </small>
          <ul class="nc__regioes" aria-labelledby="nc-regioes">
            <li v-for="item in regioesOrdenadas" :key="item.regiao.id">
              <label class="nc__regiao">
                <Checkbox
                  :model-value="regioes.includes(item.regiao.id)"
                  binary
                  :input-id="`nc-regiao-${item.regiao.id}`"
                  @update:model-value="alternarRegiao(item.regiao.id, Boolean($event))"
                />
                <span class="nc__regiao-nome">{{ item.regiao.nome }}</span>
                <span class="nc__regiao-valor ui-num">{{ item.valor }}% em dia</span>
              </label>
            </li>
          </ul>
        </section>

        <section class="eg__secao">
          <span id="nc-dia" class="eg__rotulo">Dia</span>
          <DatePicker
            v-model="dia"
            inline
            :min-date="PRIMEIRO_DIA"
            aria-labelledby="nc-dia"
            class="nc__calendario"
          />
        </section>

        <section class="eg__secao">
          <label class="eg__rotulo" for="nc-local">Local</label>
          <InputText
            id="nc-local"
            v-model="local"
            maxlength="90"
            placeholder="Ex.: Ponto de vacinação do bairro"
          />
        </section>
      </template>

      <!-- 3. O aviso, a prévia e o alcance. -->
      <template v-else>
        <div class="nc__alcance" role="status">
          <span class="ui-ladrilho nc__alcance-icone" aria-hidden="true">
            <i class="ph ph-users-three" />
          </span>
          <span>
            <strong class="ui-num">{{ numero(alcance.tutores) }} tutores</strong>
            recebem o aviso: os de {{ numero(alcance.animais) }} animais com
            {{ definicao?.rotulo.toLowerCase() }} pendente nas regiões escolhidas.
          </span>
        </div>

        <section class="eg__secao">
          <label class="eg__rotulo" for="nc-aviso">Aviso</label>
          <Textarea id="nc-aviso" v-model="aviso" rows="4" auto-resize maxlength="240" />
        </section>

        <PreviaDoAviso :titulo="definicao?.rotulo ?? ''" :texto="aviso" />
      </template>

      <ul v-if="tentou && faltas.length" class="eg__erro nc__faltas" role="alert">
        <li v-for="falta in faltas" :key="falta">{{ falta }}</li>
      </ul>
    </form>

    <template #pe>
      <Button
        v-if="passo === 0"
        type="button"
        severity="secondary"
        outlined
        label="Cancelar"
        @click="aberta = false"
      />
      <Button
        v-else
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        label="Voltar"
        @click="passo -= 1"
      />
      <Button
        type="submit"
        form="nova-campanha"
        :icon="ultimo ? 'ph ph-calendar-check' : 'ph ph-arrow-right'"
        :icon-pos="ultimo ? 'left' : 'right'"
        :label="ultimo ? 'Agendar campanha' : 'Continuar'"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
/* Os passos no alto da gaveta, no mesmo desenho do cadastro de paciente. */
.nc__passos {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  list-style: none;
}

.nc__passo {
  min-width: 0;
}

.nc__passo:not(:last-child) .nc__ir::after {
  flex: 1 0 10px;
  height: 2px;
  border-radius: 2px;
  background: var(--linha);
  content: '';
}

.nc__ir {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 2px 6px 2px 2px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--tinta-3);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: default;
}

.nc__passo--feito .nc__ir {
  color: var(--tinta-2);
  cursor: pointer;
}

.nc__passo--agora .nc__ir {
  color: var(--tinta);
  font-weight: 700;
}

.nc__numero {
  display: grid;
  flex: none;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1.5px solid var(--linha);
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
}

.nc__passo--agora .nc__numero {
  border-color: var(--p-primary-color);
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.nc__passo--feito .nc__numero {
  border-color: color-mix(in oklab, var(--p-primary-color) 55%, var(--linha));
  background: color-mix(in oklab, var(--p-primary-color) 18%, transparent);
  color: var(--tinta);
}

.nc__nome {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nc__dica {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

/* -------------------------------------------------------------------------------- tipos */

.nc__tipos {
  display: grid;
  gap: 10px;
}

.nc__tipo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1.5px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.nc__tipo:hover {
  border-color: var(--linha-media);
}

.nc__tipo:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

.nc__tipo--escolhido,
.nc__tipo--escolhido:hover {
  border-color: var(--tom-tinta);
  background: color-mix(in oklab, var(--tom-fundo) 35%, var(--superficie));
}

.nc__tipo--pets {
  --tom-fundo: var(--pets-fundo);
  --tom-tinta: var(--pets-tinta);
}

.nc__tipo--clinica {
  --tom-fundo: var(--clinica-fundo);
  --tom-tinta: var(--clinica-tinta);
}

.nc__tipo--hotel {
  --tom-fundo: var(--hotel-fundo);
  --tom-tinta: var(--hotel-tinta);
}

.nc__tipo--portal {
  --tom-fundo: var(--portal-fundo);
  --tom-tinta: var(--portal-tinta);
}

.nc__tipo-icone {
  display: grid;
  flex: none;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--tom-fundo);
  color: var(--tom-tinta);
  font-size: 20px;
}

.nc__tipo-texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.nc__tipo-texto strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.nc__tipo-texto small {
  font-size: 12.5px;
}

.nc__tipo-marca {
  flex: none;
  color: var(--tom-tinta);
  font-size: 20px;
}

/* ------------------------------------------------------------------------------ regiões */

.nc__regioes {
  display: grid;
  gap: 2px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.nc__regiao {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px;
  border-radius: 10px;
  cursor: pointer;
}

.nc__regiao:hover {
  background: var(--superficie-2);
}

.nc__regiao-nome {
  flex: 1;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.nc__regiao-valor {
  color: var(--tinta-3);
  font-size: 12.5px;
}

.nc__calendario {
  justify-self: start;
}

/* ------------------------------------------------------------------------------- alcance */

.nc__alcance {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  background: color-mix(in oklab, var(--pets-fundo) 40%, var(--superficie));
  color: var(--tinta-2);
  font-size: 13.5px;
}

.nc__alcance strong {
  color: var(--tinta);
}

.nc__alcance-icone {
  background: var(--pets-fundo);
  color: var(--pets-tinta);
}

.nc__faltas {
  display: grid;
  gap: 2px;
  margin: 0;
  padding-inline-start: 18px;
}
</style>
