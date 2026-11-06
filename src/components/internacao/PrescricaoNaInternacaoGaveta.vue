<script setup lang="ts">
/**
 * Prescrever na internação (E5-02a, guia e5 13.1). Só o veterinário logado prescreve (sem
 * prescrição verbal), com CRMV.
 *
 * - Medicamento: do catálogo, a via e o mg/kg; a conta é do servidor, sempre sobre o peso de
 *   entrada (a gaveta mostra o peso e há quantos dias foi aferido).
 * - Fluido, alimentação, monitoramento e procedimento: a descrição. O fluido é contínuo: as linhas
 *   do checklist são conferências da bomba (de hora em hora sem frequência).
 * - O servidor pede o que falta confirmar (422 `CONFIRMACAO_PENDENTE`): a gaveta mostra cada aviso
 *   com a conta que veio e o "estou ciente". Mesmo princípio já ativo: 409, confirmar de propósito.
 * - "Trocar a dose" é prescrever de novo com `substituiPrescricaoId`: a antiga para na hora.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { motivoDaRecusa, useSeloDeAssinatura } from '@/composables/useSeloDeAssinatura'
import { ApiError } from '@/service/api'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  buscarMedicamentos,
  ESPECIES_DO_CATALOGO,
  type EspecieDoCatalogo,
  type Medicamento,
} from '@/service/parceiro/catalogos-service'
import { instanteComOffset } from '@/service/parceiro/internacao-service'
import {
  DESCRICAO_MAX,
  FREQUENCIAS_NA_INTERNACAO,
  KINDS_DO_ITEM,
  MG_POR_KG_MAX,
  prescreverNaInternacao,
  VIAS_NA_INTERNACAO,
  type KindDoItem,
  type ListaDePrescricoes,
  type NovaPrescricaoNaInternacao,
  type PrescricaoCriada,
  type PrescricaoDaInternacao,
  type ViaNaInternacao,
} from '@/service/parceiro/plantao-da-internacao-service'

const props = defineProps<{
  internacaoId: string
  especie: string
  peso: ListaDePrescricoes['peso'] | null
  /** A prescrição cuja dose se troca; `null` prescreve uma nova. */
  substitui: PrescricaoDaInternacao | null
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ prescrita: [prescricao: PrescricaoCriada] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const selo = useSeloDeAssinatura()
const chaveador = criarChaveadorDeIdempotencia()

const AGORA = 'AGORA'
const ESCOLHER = 'ESCOLHER'
const SEM_FIM = 'SEM_FIM'
const ATE = 'ATE'

const kind = ref<KindDoItem>('MEDICAMENTO')
const medicamento = ref<Medicamento | null>(null)
const sugestoes = ref<Medicamento[]>([])
const descricao = ref('')
const via = ref<ViaNaInternacao | null>(null)
const mgPorKg = ref<number | null>(null)
const frequenciaHoras = ref<number>(8)
const inicio = ref<typeof AGORA | typeof ESCOLHER>(AGORA)
const primeiroHorario = ref<Date | null>(null)
const fim = ref<typeof SEM_FIM | typeof ATE>(SEM_FIM)
const encerraEm = ref<Date | null>(null)
const observacao = ref('')

type Pendencia = { aviso: string; texto: string }
const pendencias = ref<Pendencia[]>([])
const ciente = ref<Record<string, boolean>>({})
const duplicada = ref(false)
const confirmoDuplicidade = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  const antiga = props.substitui
  kind.value = antiga?.kind ?? 'MEDICAMENTO'
  medicamento.value = null
  descricao.value = antiga && antiga.kind !== 'MEDICAMENTO' ? antiga.descricao : ''
  via.value = antiga?.via ?? null
  mgPorKg.value = antiga?.dose?.mgPorKg ?? null
  frequenciaHoras.value = antiga ? antiga.frequenciaHoras : 8
  inicio.value = AGORA
  primeiroHorario.value = null
  fim.value = SEM_FIM
  encerraEm.value = null
  observacao.value = antiga?.observacao ?? ''
  pendencias.value = []
  ciente.value = {}
  duplicada.value = false
  confirmoDuplicidade.value = false
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

/* A troca de dose de um medicamento fica no mesmo medicamento: o catálogo vem da antiga. */
const trocaDoMesmo = computed(
  () => Boolean(props.substitui?.medicamentoId) && props.substitui?.kind === 'MEDICAMENTO',
)
const ehMedicamento = computed(() => kind.value === 'MEDICAMENTO')
const ehFluido = computed(() => kind.value === 'FLUIDO')

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
  const vias = item.viasPermitidas as ViaNaInternacao[]
  if (vias.length === 1) via.value = vias[0]!
  else if (via.value && !vias.includes(via.value)) via.value = null
}

const viasPossiveis = computed<readonly ViaNaInternacao[]>(() =>
  medicamento.value?.viasPermitidas.length
    ? (medicamento.value.viasPermitidas as ViaNaInternacao[])
    : VIAS_NA_INTERNACAO,
)

const opcoesDeKind = computed(() =>
  KINDS_DO_ITEM.map((valor) => ({ valor, rotulo: t(`internacao.prescricao.kind.${valor}`) })),
)
const opcoesDeVia = computed(() =>
  viasPossiveis.value.map((valor) => ({ valor, rotulo: t(`clinico.bulario.api.via.${valor}`) })),
)
const opcoesDeFrequencia = computed(() => [
  ...(ehFluido.value ? [{ valor: 0, rotulo: t('internacao.prescricao.deHoraEmHora') }] : []),
  ...FREQUENCIAS_NA_INTERNACAO.map((valor) => ({
    valor,
    rotulo: t('internacao.prescricao.aCada', { n: valor }, valor),
  })),
])
const opcoesDeInicio = computed(() => [
  { valor: AGORA, rotulo: t('internacao.internar.agora') },
  { valor: ESCOLHER, rotulo: t('internacao.prescricao.outroHorario') },
])
const opcoesDeFim = computed(() => [
  { valor: SEM_FIM, rotulo: t('internacao.prescricao.semFim') },
  { valor: ATE, rotulo: t('internacao.prescricao.ate') },
])

watch(kind, (agora) => {
  if (agora === 'FLUIDO') frequenciaHoras.value = 0
  else if (!frequenciaHoras.value) frequenciaHoras.value = 8
})

const meiaHoraAtras = () => new Date(Date.now() - 30 * 60 * 1000)
const seteDias = () => new Date(Date.now() + 7 * 24 * 3600 * 1000)
const sessentaDias = () => new Date(Date.now() + 60 * 24 * 3600 * 1000)

const pesoTexto = computed(() => {
  if (!props.peso) return ''
  return t(
    'internacao.prescricao.peso',
    {
      kg: new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(
        props.peso.pesoBaseKg,
      ),
      dias: props.peso.aferidoHaDias,
    },
    props.peso.aferidoHaDias,
  )
})

const valido = computed(() => {
  if (ehMedicamento.value) {
    if (!trocaDoMesmo.value && !medicamento.value) return false
    if (!via.value || !mgPorKg.value) return false
  } else if (!descricao.value.trim()) return false
  if (!ehFluido.value && !frequenciaHoras.value) return false
  if (inicio.value === ESCOLHER && !primeiroHorario.value) return false
  if (fim.value === ATE && !encerraEm.value) return false
  return true
})

/* --------------------------------------------------------------------- as confirmações */

function numero(valor: unknown) {
  const n = Number(valor)
  return Number.isFinite(n)
    ? new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(n)
    : String(valor ?? '')
}

function textoDoAviso(aviso: string, detalhes: Record<string, unknown>) {
  const dose = (detalhes.dose ?? {}) as Record<string, unknown>
  const faixa = (detalhes.faixa ?? {}) as Record<string, unknown>
  const peso = (detalhes.peso ?? {}) as Record<string, unknown>
  switch (aviso) {
    case 'ALERGIA':
      return t('atendimento.receita.aviso.ALERGIA')
    case 'ESPECIE_PROIBIDA':
      return t('atendimento.receita.aviso.ESPECIE_PROIBIDA')
    case 'DOSE_ARREDONDADA':
      return t('atendimento.receita.aviso.DOSE_ARREDONDADA', {
        real: numero(dose.mgReal),
        calculado: numero(dose.mgCalculado),
      })
    case 'FORA_DA_FAIXA':
      return t(
        faixa.origem === 'ESPECIE'
          ? 'atendimento.receita.aviso.FORA_DA_FAIXA_ESPECIE'
          : 'atendimento.receita.aviso.FORA_DA_FAIXA',
        { min: numero(faixa.mgKgMin), max: numero(faixa.mgKgMax) },
      )
    case 'PESO_IMPLAUSIVEL':
      return t('atendimento.receita.aviso.PESO_IMPLAUSIVEL', {
        kg: numero(peso.kg),
        limite: numero(peso.limiteKg),
      })
    default:
      return t('atendimento.receita.aviso.outro')
  }
}

const CONFIRMACAO: Record<string, keyof NovaPrescricaoNaInternacao> = {
  ALERGIA: 'alergiaConfirmada',
  ESPECIE_PROIBIDA: 'proibidoConfirmado',
  DOSE_ARREDONDADA: 'arredondamentoConfirmado',
  FORA_DA_FAIXA: 'foraDaFaixaConfirmada',
  PESO_IMPLAUSIVEL: 'pesoImplausivelConfirmado',
}

const faltaCiente = computed(() => pendencias.value.some((p) => !ciente.value[p.aviso]))

/* Mudar a dose, a via ou o item apaga as confirmações: valiam para a conta antiga. */
watch([kind, medicamento, via, mgPorKg, descricao], () => {
  pendencias.value = []
  ciente.value = {}
  duplicada.value = false
  confirmoDuplicidade.value = false
})

const avisoDoSelo = computed(() =>
  selo.atoAguarda('PRESCREVER_INTERNACAO')
    ? t(`internacao.selo.${selo.motivo.value ?? 'SEM_SELO'}`)
    : '',
)

/* ------------------------------------------------------------------------------ gravar */

function corpo(): NovaPrescricaoNaInternacao {
  const confirmacoes = Object.fromEntries(
    pendencias.value
      .filter((p) => ciente.value[p.aviso] && CONFIRMACAO[p.aviso])
      .map((p) => [CONFIRMACAO[p.aviso], true]),
  )
  const antiga = props.substitui
  const medicamentoId = medicamento.value?.id ?? (trocaDoMesmo.value ? antiga!.medicamentoId! : '')
  return {
    kind: kind.value,
    ...(ehMedicamento.value
      ? { medicamentoId, via: via.value!, mgPorKg: mgPorKg.value! }
      : { descricao: descricao.value.trim() }),
    ...(frequenciaHoras.value ? { frequenciaHoras: frequenciaHoras.value } : {}),
    primeiroHorario: instanteComOffset(
      inicio.value === ESCOLHER && primeiroHorario.value ? primeiroHorario.value : new Date(),
    ),
    ...(fim.value === ATE && encerraEm.value
      ? { encerraEm: instanteComOffset(encerraEm.value) }
      : {}),
    ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
    ...(antiga ? { substituiPrescricaoId: antiga.id } : {}),
    ...(duplicada.value && confirmoDuplicidade.value ? { confirmarDuplicidade: true } : {}),
    ...confirmacoes,
  }
}

async function prescrever() {
  tentou.value = true
  erro.value = ''
  if (!valido.value || faltaCiente.value) return
  if (duplicada.value && !confirmoDuplicidade.value) {
    erro.value = t('internacao.prescricao.confirmeDuplicidade')
    return
  }
  salvando.value = true
  const pedido = corpo()
  try {
    const criada = await prescreverNaInternacao(
      props.internacaoId,
      pedido,
      chaveador.para({ ...pedido, primeiroHorario: undefined }),
      parceiroQuery(),
    )
    chaveador.concluir()
    aberta.value = false
    emit('prescrita', criada)
  } catch (err) {
    const recusa = motivoDaRecusa(err)
    if (recusa) {
      erro.value = t(`internacao.selo.${recusa}`)
      return
    }
    const lido = lerErroDoCadastro(err, t('internacao.prescricao.erro'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    if (lido.codigo === 'CONFIRMACAO_PENDENTE') {
      const avisos = Array.isArray(detalhes.avisos) ? (detalhes.avisos as string[]) : []
      pendencias.value = avisos.map((aviso) => ({ aviso, texto: textoDoAviso(aviso, detalhes) }))
      await nextTick()
      document.querySelector('.pi__pendencias')?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (lido.codigo === 'PRESCRICAO_DUPLICADA') {
      duplicada.value = true
      confirmoDuplicidade.value = false
      return
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="
      substitui
        ? t('internacao.prescricao.trocarTitulo', { nome: substitui.descricao })
        : t('internacao.prescricao.titulo')
    "
    icone="ph ph-prescription"
    largura="38rem"
  >
    <form id="prescricao-internacao" class="eg" novalidate @submit.prevent="prescrever">
      <p v-if="pesoTexto" class="eg__dica">{{ pesoTexto }}</p>

      <section v-if="!substitui" class="eg__secao">
        <label class="eg__rotulo" for="pi-kind">{{ t('internacao.prescricao.oQue') }}</label>
        <Select
          v-model="kind"
          input-id="pi-kind"
          :options="opcoesDeKind"
          option-label="rotulo"
          option-value="valor"
          :disabled="salvando"
        />
      </section>

      <template v-if="ehMedicamento">
        <section v-if="!trocaDoMesmo" class="eg__secao">
          <label class="eg__rotulo" for="pi-medicamento">{{
            t('internacao.prescricao.medicamento')
          }}</label>
          <AutoComplete
            :model-value="medicamento"
            input-id="pi-medicamento"
            :suggestions="sugestoes"
            option-label="nome"
            :placeholder="t('internacao.prescricao.buscarMedicamento')"
            :invalid="tentou && !medicamento"
            :disabled="salvando"
            force-selection
            @complete="buscar"
            @update:model-value="
              (valor: unknown) =>
                typeof valor === 'object' ? escolher(valor as Medicamento) : (medicamento = null)
            "
          >
            <template #option="{ option }">
              <span class="pi__opcao">
                <strong>{{ (option as Medicamento).nome }}</strong>
                <small>{{ (option as Medicamento).principioAtivo }}</small>
              </span>
            </template>
          </AutoComplete>
        </section>

        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="pi-via">{{ t('internacao.prescricao.via') }}</label>
            <Select
              v-model="via"
              input-id="pi-via"
              :options="opcoesDeVia"
              option-label="rotulo"
              option-value="valor"
              :invalid="tentou && !via"
              :disabled="salvando"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="pi-mgkg">{{ t('internacao.prescricao.mgPorKg') }}</label>
            <InputNumber
              v-model="mgPorKg"
              input-id="pi-mgkg"
              :min="0"
              :max="MG_POR_KG_MAX"
              :max-fraction-digits="3"
              suffix=" mg/kg"
              :locale="locale"
              :invalid="tentou && !mgPorKg"
              :disabled="salvando"
            />
          </section>
        </div>
      </template>

      <section v-else class="eg__secao">
        <label class="eg__rotulo" for="pi-descricao">{{
          t('internacao.prescricao.descricao')
        }}</label>
        <InputText
          id="pi-descricao"
          v-model="descricao"
          :maxlength="DESCRICAO_MAX"
          :placeholder="t(`internacao.prescricao.exemplo.${kind}`)"
          :invalid="tentou && !descricao.trim()"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="pi-frequencia">{{
          ehFluido ? t('internacao.prescricao.conferencia') : t('internacao.prescricao.frequencia')
        }}</label>
        <Select
          v-model="frequenciaHoras"
          input-id="pi-frequencia"
          :options="opcoesDeFrequencia"
          option-label="rotulo"
          option-value="valor"
          :invalid="tentou && !ehFluido && !frequenciaHoras"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="pi-inicio" class="eg__rotulo">{{ t('internacao.prescricao.primeira') }}</span>
        <SelectButton
          v-model="inicio"
          :options="opcoesDeInicio"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="pi-inicio"
          :disabled="salvando"
        />
        <DatePicker
          v-if="inicio === ESCOLHER"
          v-model="primeiroHorario"
          inline
          show-time
          hour-format="24"
          :step-minute="15"
          :min-date="meiaHoraAtras()"
          :max-date="seteDias()"
          aria-labelledby="pi-inicio"
          :invalid="tentou && !primeiroHorario"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="pi-fim" class="eg__rotulo">{{ t('internacao.prescricao.duracao') }}</span>
        <SelectButton
          v-model="fim"
          :options="opcoesDeFim"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="pi-fim"
          :disabled="salvando"
        />
        <DatePicker
          v-if="fim === ATE"
          v-model="encerraEm"
          inline
          show-time
          hour-format="24"
          :step-minute="15"
          :min-date="primeiroHorario ?? new Date()"
          :max-date="sessentaDias()"
          aria-labelledby="pi-fim"
          :invalid="tentou && !encerraEm"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="pi-observacao">
          {{ t('internacao.prescricao.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="pi-observacao"
          v-model="observacao"
          rows="2"
          auto-resize
          :disabled="salvando"
        />
      </section>

      <section v-if="pendencias.length" class="eg__secao pi__pendencias">
        <span class="eg__rotulo">{{ t('internacao.prescricao.confirme') }}</span>
        <label
          v-for="item in pendencias"
          :key="item.aviso"
          class="pi__marcar"
          :for="`pi-ciente-${item.aviso}`"
        >
          <Checkbox
            v-model="ciente[item.aviso]"
            :input-id="`pi-ciente-${item.aviso}`"
            binary
            :disabled="salvando"
          />
          <span>{{ item.texto }}</span>
        </label>
      </section>

      <section v-if="duplicada" class="eg__secao pi__pendencias">
        <p class="eg__aviso">
          <i class="ph ph-warning" aria-hidden="true" />
          <span>{{ t('internacao.prescricao.duplicada') }}</span>
        </p>
        <label class="pi__marcar" for="pi-duplicada">
          <Checkbox
            v-model="confirmoDuplicidade"
            input-id="pi-duplicada"
            binary
            :disabled="salvando"
          />
          <span>{{ t('internacao.prescricao.confirmoDuplicidade') }}</span>
        </label>
      </section>

      <p v-if="avisoDoSelo && !erro" class="eg__aviso">
        <i class="ph ph-seal-warning" aria-hidden="true" />
        <span>{{ avisoDoSelo }}</span>
      </p>
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
        form="prescricao-internacao"
        icon="ph ph-check"
        :label="
          substitui ? t('internacao.prescricao.trocar') : t('internacao.prescricao.confirmar')
        "
        :loading="salvando"
        :disabled="faltaCiente"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.pi__opcao {
  display: grid;
  gap: 2px;
}

.pi__opcao small {
  color: var(--tinta-2);
}

.pi__pendencias {
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-controle);
  background: color-mix(in oklab, var(--atencao-fundo) 45%, transparent);
}

.pi__marcar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
  cursor: pointer;
}
</style>
