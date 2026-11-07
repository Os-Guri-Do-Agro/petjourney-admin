<script setup lang="ts">
/**
 * Uma exigência de admissão (E7-01, guia e7 10 e 27): uma por tipo (o tipo não muda; para trocar,
 * apague e crie), se sem ela o hóspede não entra ou só avisa (obrigatório e explícito), para quais
 * espécies (**nenhuma marcada vale para todas**, o contrário da acomodação), a validade (ou não
 * vence) e, nos tipos de vacina, a vacina do catálogo por onde a entrada lê a carteirinha e se
 * aceita a vacina que o responsável lançou no app.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  criarExigencia,
  editarExigencia,
  ESPECIES,
  KINDS_DE_EXIGENCIA,
  VALIDADE_MAX_MESES,
  type EspecieDaCasa,
  type ExigenciaDaCasa,
  type KindDeExigencia,
  type VacinaParaExigencia,
} from '@/service/parceiro/hotel-casa-service'

import { useRotulosDaCasa } from './useRotulosDaCasa'

const props = defineProps<{
  exigencia: ExigenciaDaCasa | null
  existentes: KindDeExigencia[]
  vacinas: VacinaParaExigencia[]
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDaCasa()
const { parceiroQuery } = useParceiroPortal()

const kind = ref<KindDeExigencia | null>(null)
const bloqueia = ref(true)
const especies = ref<EspecieDaCasa[]>([])
const vence = ref(true)
const meses = ref<number | null>(12)
const vacinaId = ref<string | null>(null)
const aceitaDeclarada = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  const e = props.exigencia
  kind.value = e?.kind ?? null
  bloqueia.value = e?.bloqueia ?? true
  especies.value = e ? [...e.especies] : []
  vence.value = e ? e.validadeMeses !== null : true
  meses.value = e?.validadeMeses ?? 12
  vacinaId.value = e?.vacinaDoCatalogoId ?? null
  aceitaDeclarada.value = e?.aceitaDeclarada ?? false
  tentou.value = false
  erro.value = ''
})

const ehVacina = computed(() => Boolean(kind.value?.startsWith('VACINA_')))

const opcoesDeKind = computed(() =>
  KINDS_DE_EXIGENCIA.filter((k) => !props.existentes.includes(k)).map((valor) => ({
    valor,
    rotulo: rotulos.exigencia(valor),
  })),
)
const opcoesDeBloqueio = computed(() => [
  { valor: true, rotulo: t('casaDoHotel.exigencia.naoEntra') },
  { valor: false, rotulo: t('casaDoHotel.exigencia.entraComAviso') },
])
const opcoesDeValidade = computed(() => [
  { valor: true, rotulo: t('casaDoHotel.exigencia.vence') },
  { valor: false, rotulo: t('casaDoHotel.exigencia.naoVence') },
])
const opcoesDeEspecie = computed(() =>
  ESPECIES.map((valor) => ({ valor, rotulo: rotulos.especie(valor) })),
)
/** A ativa; a já escolhida continua na lista mesmo se desativada depois. */
const opcoesDeVacina = computed(() =>
  props.vacinas
    .filter((v) => v.ativo || v.id === vacinaId.value)
    .map((v) => ({ valor: v.id, rotulo: v.nome })),
)

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!kind.value || (vence.value && meses.value === null)) return
  const comum = {
    bloqueia: bloqueia.value,
    especies: especies.value,
    validadeMeses: vence.value ? meses.value : null,
    ...(ehVacina.value
      ? { vacinaDoCatalogoId: vacinaId.value, aceitaDeclarada: aceitaDeclarada.value }
      : {}),
  }
  salvando.value = true
  try {
    if (props.exigencia) await editarExigencia(props.exigencia.id, comum, parceiroQuery())
    else await criarExigencia({ kind: kind.value, ...comum }, parceiroQuery())
    aberta.value = false
    emit('salvo')
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="exigencia ? t('casaDoHotel.exigencia.editar') : t('casaDoHotel.exigencia.nova')"
    icone="ph ph-identification-card"
  >
    <form id="exigencia-da-casa" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="ex-kind">{{ t('casaDoHotel.exigencia.qual') }}</label>
        <p v-if="exigencia" id="ex-kind" class="ex__fixo">
          {{ rotulos.exigencia(exigencia.kind) }}
        </p>
        <Select
          v-else
          v-model="kind"
          input-id="ex-kind"
          :options="opcoesDeKind"
          option-label="rotulo"
          option-value="valor"
          :invalid="tentou && !kind"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="ex-bloqueia" class="eg__rotulo">{{ t('casaDoHotel.exigencia.semEla') }}</span>
        <SelectButton
          v-model="bloqueia"
          :options="opcoesDeBloqueio"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="ex-bloqueia"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="ex-especies" class="eg__rotulo">{{ t('casaDoHotel.exigencia.especies') }}</span>
        <SelectButton
          v-model="especies"
          :options="opcoesDeEspecie"
          option-label="rotulo"
          option-value="valor"
          multiple
          aria-labelledby="ex-especies"
          :disabled="salvando"
          class="ex__opcoes"
        />
        <small class="eg__dica">{{ t('casaDoHotel.exigencia.especiesDica') }}</small>
      </section>

      <section class="eg__secao">
        <span id="ex-validade" class="eg__rotulo">{{ t('casaDoHotel.exigencia.validade') }}</span>
        <SelectButton
          v-model="vence"
          :options="opcoesDeValidade"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="ex-validade"
          :disabled="salvando"
        />
        <InputNumber
          v-if="vence"
          v-model="meses"
          :min="1"
          :max="VALIDADE_MAX_MESES"
          show-buttons
          :aria-label="t('casaDoHotel.exigencia.mesesRotulo')"
          :invalid="tentou && meses === null"
          :disabled="salvando"
          class="ex__meses"
        />
      </section>

      <template v-if="ehVacina">
        <section class="eg__secao">
          <label class="eg__rotulo" for="ex-vacina">
            {{ t('casaDoHotel.exigencia.vacina') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <Select
            v-model="vacinaId"
            input-id="ex-vacina"
            :options="opcoesDeVacina"
            option-label="rotulo"
            option-value="valor"
            filter
            show-clear
            :disabled="salvando"
          />
          <small class="eg__dica">{{ t('casaDoHotel.exigencia.vacinaDica') }}</small>
        </section>
        <label class="ex__chave">
          <Checkbox v-model="aceitaDeclarada" binary :disabled="salvando" />
          <span>
            <strong>{{ t('casaDoHotel.exigencia.aceitaDeclarada') }}</strong>
            <small>{{ t('casaDoHotel.exigencia.aceitaDeclaradaDica') }}</small>
          </span>
        </label>
      </template>

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
        form="exigencia-da-casa"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ex__fixo {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.ex__opcoes {
  flex-wrap: wrap;
}

.ex__meses {
  max-width: 10rem;
}

.ex__chave {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.ex__chave span {
  display: grid;
  gap: 2px;
}

.ex__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.ex__chave small {
  color: var(--tinta-2);
  font-size: 13px;
}
</style>
