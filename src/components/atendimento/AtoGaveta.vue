<script setup lang="ts">
/**
 * Registrar um ato na consulta (E4-01, guia e4 5.8): a medicação aplicada aqui (do catálogo, com a
 * via e a dose) ou um procedimento (curativo, limpeza). Só no rascunho; conta para o mínimo da
 * conduta. A resposta traz `versaoDoAtendimento`: o próximo autosave usa esta versão, sem perder o
 * que se digitava.
 *
 * A hora é a de agora; "foi mais cedo" troca a hora (nunca no futuro). Vacina não é ato: tem o
 * registro dela.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import { registrarAto, type Ato, type NovoAto } from '@/service/parceiro/atendimentos-service'
import {
  buscarMedicamentos,
  ESPECIES_DO_CATALOGO,
  type EspecieDoCatalogo,
  type Medicamento,
} from '@/service/parceiro/catalogos-service'

const props = defineProps<{ atendimentoId: string; especie: string }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ registrado: [ato: Ato]; mesclado: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const VIAS = [
  'ORAL',
  'SUBCUTANEA',
  'INTRAMUSCULAR',
  'INTRAVENOSA',
  'TOPICA',
  'OTOLOGICA',
  'OFTALMICA',
  'INTRANASAL',
] as const

const kind = ref<NovoAto['kind']>('MEDICAMENTO')
const medicamento = ref<Medicamento | null>(null)
const sugestoes = ref<Medicamento[]>([])
const descricao = ref('')
const via = ref<NovoAto['via'] | null>(null)
const doseTexto = ref('')
const observacao = ref('')
const maisCedo = ref(false)
const hora = ref<Date | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  kind.value = 'MEDICAMENTO'
  medicamento.value = null
  descricao.value = ''
  via.value = null
  doseTexto.value = ''
  observacao.value = ''
  maisCedo.value = false
  hora.value = new Date()
  tentou.value = false
  erro.value = ''
})

const opcoesDeKind = computed(() => [
  { valor: 'MEDICAMENTO', rotulo: t('atendimento.atos.kind.MEDICAMENTO') },
  { valor: 'PROCEDIMENTO', rotulo: t('atendimento.atos.kind.PROCEDIMENTO') },
])

const opcoesDeVia = computed(() =>
  (medicamento.value?.viasPermitidas.length ? medicamento.value.viasPermitidas : VIAS).map(
    (valor) => ({ valor, rotulo: t(`clinico.bulario.api.via.${valor}`) }),
  ),
)

const especieDoCatalogo = computed<EspecieDoCatalogo | null>(
  () => ESPECIES_DO_CATALOGO.find((item) => item === props.especie) ?? null,
)

async function buscar(evento: { query: string }) {
  if (evento.query.trim().length < 2) {
    sugestoes.value = []
    return
  }
  try {
    sugestoes.value = await buscarMedicamentos(
      { q: evento.query, especie: especieDoCatalogo.value, limite: 8 },
      parceiroQuery(),
    )
  } catch {
    sugestoes.value = []
  }
}

function escolher(item: Medicamento) {
  medicamento.value = item
  if (!descricao.value.trim()) descricao.value = item.nome
  if (item.viasPermitidas.length === 1) via.value = item.viasPermitidas[0]!
  else if (via.value && !item.viasPermitidas.includes(via.value)) via.value = null
}

/** ISO com o offset do relógio de quem registra ("2026-10-27T10:40:00-03:00"). */
function comOffset(data: Date) {
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0')
  const offset = -data.getTimezoneOffset()
  const sinal = offset >= 0 ? '+' : '-'
  return (
    `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}` +
    `T${pad(data.getHours())}:${pad(data.getMinutes())}:00` +
    `${sinal}${pad(offset / 60)}:${pad(offset % 60)}`
  )
}

/** A hora escolhida, hoje; sem "mais cedo", agora. */
function instante() {
  const agora = new Date()
  if (!maisCedo.value || !hora.value) return agora
  const escolhida = new Date(agora)
  escolhida.setHours(hora.value.getHours(), hora.value.getMinutes(), 0, 0)
  return escolhida
}

const noFuturo = computed(
  () => maisCedo.value && hora.value !== null && instante().getTime() > Date.now() + 5 * 60_000,
)

const valido = computed(() => descricao.value.trim().length > 0 && !noFuturo.value)

async function registrar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  salvando.value = true
  const medicamentoDoAto = kind.value === 'MEDICAMENTO'
  const corpo: NovoAto = {
    kind: kind.value,
    descricao: descricao.value.trim(),
    realizadoEm: comOffset(instante()),
    ...(medicamentoDoAto && medicamento.value ? { medicamentoId: medicamento.value.id } : {}),
    ...(medicamentoDoAto && via.value ? { via: via.value } : {}),
    ...(medicamentoDoAto && doseTexto.value.trim() ? { doseTexto: doseTexto.value.trim() } : {}),
    ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
  }
  try {
    const ato = await registrarAto(
      props.atendimentoId,
      corpo,
      chaveador.para(corpo),
      parceiroQuery(),
    )
    chaveador.concluir()
    aberta.value = false
    emit('registrado', ato)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('atendimento.atos.erro'))
    if (lido.codigo === 'CADASTRO_MESCLADO') {
      /* O paciente foi mesclado agora (guia 11.2): relê e tenta de novo no cadastro que ficou. */
      emit('mesclado')
    }
    erro.value =
      lido.codigo === 'MEDICAMENTO_INATIVO' ? t('atendimento.atos.inativo') : lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('atendimento.atos.registrar')"
    icone="ph ph-bandaids"
    largura="34rem"
  >
    <form id="ato-atendimento" class="eg" novalidate @submit.prevent="registrar">
      <section class="eg__secao">
        <span id="ato-kind" class="eg__rotulo">{{ t('atendimento.atos.oQue') }}</span>
        <SelectButton
          v-model="kind"
          :options="opcoesDeKind"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="ato-kind"
          :disabled="salvando"
        />
      </section>

      <section v-if="kind === 'MEDICAMENTO'" class="eg__secao">
        <label class="eg__rotulo" for="ato-medicamento">
          {{ t('atendimento.atos.medicamento') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <AutoComplete
          v-model="medicamento"
          input-id="ato-medicamento"
          :suggestions="sugestoes"
          option-label="nome"
          force-selection
          :placeholder="t('atendimento.atos.buscarMedicamento')"
          :disabled="salvando"
          @complete="buscar"
          @option-select="escolher($event.value)"
        >
          <template #option="{ option }">
            <span class="ag__opcao">
              <span>{{ option.nome }}</span>
              <small>{{ option.principioAtivo }} · {{ option.apresentacao }}</small>
            </span>
          </template>
        </AutoComplete>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="ato-descricao">{{ t('atendimento.atos.descricao') }}</label>
        <InputText
          id="ato-descricao"
          v-model="descricao"
          :placeholder="
            kind === 'MEDICAMENTO'
              ? t('atendimento.atos.descricaoMedicamento')
              : t('atendimento.atos.descricaoProcedimento')
          "
          :invalid="tentou && !descricao.trim()"
          :disabled="salvando"
        />
      </section>

      <div v-if="kind === 'MEDICAMENTO'" class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="ato-via">{{ t('atendimento.atos.via') }}</label>
          <Select
            v-model="via"
            input-id="ato-via"
            :options="opcoesDeVia"
            option-label="rotulo"
            option-value="valor"
            show-clear
            :placeholder="t('atendimento.atos.semVia')"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="ato-dose">{{ t('atendimento.atos.dose') }}</label>
          <InputText
            id="ato-dose"
            v-model="doseTexto"
            :placeholder="t('atendimento.atos.doseDica')"
            :disabled="salvando"
          />
        </section>
      </div>

      <section class="eg__secao">
        <span class="eg__rotulo">{{ t('atendimento.atos.quando') }}</span>
        <SelectButton
          v-model="maisCedo"
          :options="[
            { valor: false, rotulo: t('atendimento.atos.agora') },
            { valor: true, rotulo: t('atendimento.atos.maisCedo') },
          ]"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('atendimento.atos.quando')"
          :disabled="salvando"
        />
        <DatePicker
          v-if="maisCedo"
          v-model="hora"
          time-only
          hour-format="24"
          :aria-label="t('atendimento.atos.hora')"
          :invalid="noFuturo"
          :disabled="salvando"
        />
        <small v-if="noFuturo" class="eg__invalido">{{ t('atendimento.atos.noFuturo') }}</small>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="ato-obs">
          {{ t('atendimento.atos.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea id="ato-obs" v-model="observacao" rows="2" auto-resize :disabled="salvando" />
      </section>

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
        form="ato-atendimento"
        icon="ph ph-check"
        :label="t('atendimento.atos.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ag__opcao {
  display: grid;
  gap: 2px;
}

.ag__opcao small {
  color: var(--tinta-2);
  font-size: 12px;
}
</style>
