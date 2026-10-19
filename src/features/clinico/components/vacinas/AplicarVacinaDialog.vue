<script setup lang="ts">
/**
 * Aplicar uma vacina aqui.
 *
 * O diálogo abre **já preenchido com o que o protocolo manda**: a vacina da vez, a dose certa da
 * série, o lote que vence primeiro. Quem aplica confere e confirma — não monta a aplicação do
 * zero com o animal na mesa.
 *
 * Três coisas que ele decide para não deixar ninguém decidir errado:
 *
 * - **Lote vencido não é opção.** Aparece na lista, travado e com o motivo — um frasco que some
 *   da lista é um frasco que alguém digita à mão. O digitado à mão passa pela mesma trava.
 * - **Lote perto de vencer é o sugerido**, com a frase dizendo por quê. Assustar quem aplica com
 *   um frasco válido faria a clínica jogar fora a dose que ainda dava para usar.
 * - **A próxima dose sai marcada.** Dentro da série, o horário do mesmo profissional na data do
 *   protocolo já vem escolhido; quem aplica só desliga se o responsável preferir marcar depois.
 *   É o "já agendada" que faz o filhote voltar — a data sozinha, anotada num papel, não faz.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicDateField from '../base/ClinicDateField.vue'
import ClinicField from '../base/ClinicField.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDaVacina } from '../../composables/useRotulosDaVacina'
import {
  agendaRepository,
  AplicacaoRecusadaError,
  vacinaRepository,
  type ProximaNaAgenda,
} from '../../data/repositories'
import type { AplicacaoVacina, ISODate, Pet, SlotSugestao, ViaDeVacina } from '../../data/types'
import { diffDays } from '../../domain/clinic-time'
import { avaliarValidade, type LoteParaAplicar } from '../../domain/lote-na-aplicacao'
import { doseSeguinte, type PlanoVacinal } from '../../domain/protocolo-vacinal'
import { proximaDose, vacinasDaEspecie } from '../../domain/vacinacao'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    visivel: boolean
    pet: Pet
    plano: PlanoVacinal
    /** A vacina que abre escolhida — a da linha em que se clicou. */
    vacinaInicial?: string | null
    /** Quem aplica, quando a tela sabe (o profissional do atendimento). */
    profissionalInicial?: string | null
    encounterId?: string | null
    /**
     * Aberto da ficha do paciente. Hoje o diálogo tem um desenho só (o do Trilha) nos dois
     * lugares; a prop fica para quem já a passa.
     */
    ficha?: boolean
  }>(),
  { vacinaInicial: null, profissionalInicial: null, encounterId: null, ficha: false },
)

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  aplicada: [aplicacao: AplicacaoVacina]
}>()

/* As listas que o diálogo abre vão para o `body`: levam a classe dos painéis da clínica. */
const ptDoOverlay = { overlay: { class: 'clinic-overlay' } }

/** "Outro lote": o frasco que o estoque não conhece. */
const LOTE_DIGITADO = '__digitado__'

/** Horizonte em que a agenda aceita marcar — o mesmo teto da busca de horários do app. */
const HORIZONTE_DA_AGENDA_EM_DIAS = 60

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDaVacina()
const clinico = useClinicoStore()
const idDoAviso = useId()
const idDoTitulo = useId()

const vacinaId = ref<string | null>(null)
const dose = ref(1)
const total = ref(1)
const reforco = ref(false)
const loteEscolhido = ref<string | null>(null)
const loteDigitado = ref('')
const validadeDigitada = ref<ISODate>('')
const via = ref<ViaDeVacina | null>(null)
const aplicador = ref<string | null>(null)
const observacao = ref('')
const marcarProxima = ref(true)

const lotes = ref<LoteParaAplicar[]>([])
const carregandoLotes = ref(false)
const sugestao = ref<SlotSugestao | null>(null)
const buscandoHorario = ref(false)
const salvando = ref(false)
const tentouSalvar = ref(false)
const erro = ref('')

const hoje = computed(() => clinicClock.today())

const catalogo = computed(() => vacinasDaEspecie(vacinaRepository.catalogo(), props.pet.especie))
const vacina = computed(() => catalogo.value.find((item) => item.id === vacinaId.value) ?? null)

/** O que o protocolo diz de cada vacina, para a opção mostrar "dose 2 de 3 · hoje". */
const noPlano = computed(() => new Map(props.plano.vacinas.map((item) => [item.vacina.id, item])))

const opcoesVacina = computed(() =>
  catalogo.value.map((item) => {
    const plano = noPlano.value.get(item.id)

    return {
      valor: item.id,
      rotulo: item.nome,
      detalhe: plano?.proxima
        ? `${rotulos.numero(plano.proxima)} · ${rotulos.quando(plano.proxima)}`
        : t('clinico.vacinas.aplicar.opcionalNaoIniciada'),
      situacao: plano?.situacao ?? null,
    }
  }),
)

const opcoesDose = computed(() => [
  ...Array.from({ length: total.value }, (_, indice) => ({
    valor: `serie-${indice + 1}`,
    rotulo: rotulos.numero({ numero: indice + 1, total: total.value, tipo: 'serie' }),
  })),
  { valor: 'reforco', rotulo: t('clinico.vacinas.plano.reforco') },
])

const doseEscolhida = computed({
  get: () => (reforco.value ? 'reforco' : `serie-${dose.value}`),
  set: (valor: string) => {
    reforco.value = valor === 'reforco'
    dose.value = reforco.value ? total.value : Number(valor.split('-')[1])
  },
})

const opcoesVia = computed(() =>
  (vacina.value?.vias ?? []).map((valor) => ({ valor, rotulo: rotulos.via(valor) })),
)

const opcoesAplicador = computed(() =>
  clinico.profissionais.map((item) => ({ valor: item.id, rotulo: item.nome })),
)

// ------------------------------------------------------------------ lote

const opcoesLote = computed(() => [
  ...lotes.value.map((lote) => ({
    valor: lote.codigo,
    lote,
    desabilitado: !lote.avaliacao.pode,
  })),
  { valor: LOTE_DIGITADO, lote: null, desabilitado: false },
])

const loteDoEstoque = computed(
  () => lotes.value.find((lote) => lote.codigo === loteEscolhido.value) ?? null,
)

const travados = computed(() => lotes.value.filter((lote) => !lote.avaliacao.pode))

/** A validade que vai para a carteira: a do lote do estoque, ou a digitada. */
const validade = computed<ISODate | null>(() => {
  if (loteEscolhido.value === LOTE_DIGITADO) {
    return validadeDigitada.value || null
  }

  return loteDoEstoque.value?.validade ?? null
})

const codigoDoLote = computed(() =>
  loteEscolhido.value === LOTE_DIGITADO ? loteDigitado.value.trim() : (loteEscolhido.value ?? ''),
)

const avaliacao = computed(() => avaliarValidade(validade.value, hoje.value))

/** A frase sob o lote. Só existe quando há algo a dizer. */
const avisoDoLote = computed<{ tom: 'risco' | 'atencao' | 'info'; texto: string } | null>(() => {
  const resultado = avaliacao.value

  if (!resultado.pode) {
    if (resultado.motivo === 'vencido' && validade.value) {
      return {
        tom: 'risco',
        texto: t('clinico.vacinas.aplicar.lote.vencido', { data: rotulos.data(validade.value) }),
      }
    }

    return null
  }

  if (resultado.aviso === 'vence-hoje') {
    return { tom: 'atencao', texto: t('clinico.vacinas.aplicar.lote.venceHoje') }
  }

  if (resultado.aviso === 'vencendo') {
    return {
      tom: 'atencao',
      texto: loteDoEstoque.value?.sugerido
        ? t(
            'clinico.vacinas.aplicar.lote.vencendoPrimeiro',
            { dias: resultado.dias },
            resultado.dias,
          )
        : t('clinico.vacinas.aplicar.lote.vencendo', { dias: resultado.dias }, resultado.dias),
    }
  }

  if (loteEscolhido.value === LOTE_DIGITADO && codigoDoLote.value) {
    return { tom: 'info', texto: t('clinico.vacinas.aplicar.lote.foraDoEstoque') }
  }

  return null
})

async function carregarLotes(id: string) {
  carregandoLotes.value = true

  try {
    lotes.value = await vacinaRepository.lotesParaAplicar(id)
  } finally {
    carregandoLotes.value = false
  }

  /* O que vence primeiro. Sem nenhum na geladeira, a pessoa digita o do frasco na mão. */
  loteEscolhido.value = lotes.value.find((lote) => lote.sugerido)?.codigo ?? LOTE_DIGITADO
}

// ------------------------------------------------------------------ próxima dose

/** Depois desta dose, a próxima — a data que vai para a carteira, mostrada antes de gravar. */
const proxima = computed<ISODate | null>(() =>
  vacina.value ? proximaDose(vacina.value, dose.value, hoje.value, total.value) : null,
)

const proximaNaSerie = computed(() => !reforco.value && dose.value < total.value)

/** Dá para marcar agora: dentro do horizonte da agenda. O reforço anual fica para o recall. */
const podeMarcar = computed(
  () =>
    proxima.value !== null && diffDays(hoje.value, proxima.value) <= HORIZONTE_DA_AGENDA_EM_DIAS,
)

async function buscarHorario() {
  sugestao.value = null

  if (!podeMarcar.value || !proxima.value || !aplicador.value) {
    return
  }

  buscandoHorario.value = true

  try {
    const [primeira] = await agendaRepository.sugerirRetorno({
      petId: props.pet.id,
      professionalId: aplicador.value,
      typeId: 'tipo-vacina',
      aPartirDe: hoje.value,
      emDias: diffDays(hoje.value, proxima.value),
      tolerancia: 4,
      limite: 1,
    })

    sugestao.value = primeira ?? null
  } catch {
    sugestao.value = null
  } finally {
    buscandoHorario.value = false
  }
}

// ------------------------------------------------------------------ ciclo

function prepararVacina(id: string | null) {
  if (!id) {
    return
  }

  const doPlano = noPlano.value.get(id)
  const aplicadas = doPlano?.doses.flatMap((item) => (item.aplicacao ? [item.aplicacao] : [])) ?? []
  const seguinte = doseSeguinte(
    catalogo.value.find((item) => item.id === id)!,
    props.pet.nascimento,
    aplicadas,
    hoje.value,
  )

  total.value = seguinte.total
  dose.value = seguinte.dose
  reforco.value = seguinte.reforco
  via.value = catalogo.value.find((item) => item.id === id)?.vias[0] ?? null
  loteDigitado.value = ''
  validadeDigitada.value = ''
  void carregarLotes(id)
}

watch(vacinaId, (id) => prepararVacina(id))

watch([proxima, aplicador], () => {
  marcarProxima.value = proximaNaSerie.value && podeMarcar.value
  void buscarHorario()
})

/** A vacina que o protocolo pede primeiro: atrasada, depois a de hoje, depois a que não começou. */
function vacinaDaVez(): string | null {
  const pedem = props.plano.vacinas.find((item) =>
    ['atrasada', 'devida', 'nao-iniciada', 'a-vencer'].includes(item.situacao),
  )

  return pedem?.vacina.id ?? catalogo.value[0]?.id ?? null
}

watch(
  () => props.visivel,
  (visivel) => {
    if (!visivel) {
      return
    }

    erro.value = ''
    tentouSalvar.value = false
    observacao.value = ''
    aplicador.value =
      props.profissionalInicial ?? clinico.profissionais.find((item) => item.ativo)?.id ?? null
    const inicial = props.vacinaInicial ?? vacinaDaVez()

    /* Reabrir na mesma vacina não dispara o `watch`: prepara à mão. */
    if (vacinaId.value === inicial) {
      prepararVacina(inicial)
    } else {
      vacinaId.value = inicial
    }
  },
  { immediate: true },
)

// ------------------------------------------------------------------ gravar

const erroLote = computed(() => {
  if (!tentouSalvar.value) {
    return ''
  }

  if (!codigoDoLote.value) {
    return t('clinico.vacinas.aplicar.erros.lote')
  }

  if (!validade.value) {
    return t('clinico.vacinas.aplicar.erros.validade')
  }

  return ''
})

const completo = computed(
  () =>
    Boolean(vacina.value) &&
    Boolean(codigoDoLote.value) &&
    avaliacao.value.pode &&
    Boolean(via.value) &&
    Boolean(aplicador.value),
)

async function aplicar() {
  tentouSalvar.value = true
  erro.value = ''

  if (!completo.value || !vacina.value || !via.value || !aplicador.value || !validade.value) {
    return
  }

  const agendar: ProximaNaAgenda | null =
    marcarProxima.value && sugestao.value
      ? {
          professionalId: sugestao.value.professionalId,
          inicio: sugestao.value.inicio,
          fim: sugestao.value.fim,
        }
      : null

  salvando.value = true

  try {
    const aplicacao = await vacinaRepository.aplicar({
      petId: props.pet.id,
      vacinaId: vacina.value.id,
      professionalId: aplicador.value,
      lote: codigoDoLote.value,
      validadeLote: validade.value,
      dose: dose.value,
      dosesNaSerie: total.value,
      via: via.value,
      observacao: observacao.value,
      encounterId: props.encounterId,
      proximaNaAgenda: agendar,
    })

    emit('aplicada', aplicacao)
    emit('update:visivel', false)
  } catch (falha) {
    erro.value =
      falha instanceof AplicacaoRecusadaError
        ? t(`clinico.vacinas.aplicar.recusa.${falha.kind}`)
        : t('clinico.vacinas.aplicar.erros.salvar')
  } finally {
    salvando.value = false
  }
}

/**
 * A linha de baixo do título: o que o protocolo diz da vacina escolhida — "V10 · 2 de 3 · hoje".
 * É o "sobre o quê" do diálogo, que muda quando alguém troca a vacina.
 */
const subtitulo = computed(() => {
  const escolhida = opcoesVacina.value.find((item) => item.valor === vacinaId.value)

  return escolhida ? `${escolhida.rotulo} · ${escolhida.detalhe}` : ''
})

const textoDaSugestao = computed(() => {
  if (!sugestao.value) {
    return ''
  }

  return t('clinico.vacinas.aplicar.proxima.sugestao', {
    data: rotulos.data(sugestao.value.inicio.slice(0, 10)),
    hora: formato.hora(sugestao.value.inicio),
    profissional: clinico.profissional(sugestao.value.professionalId)?.nome ?? '',
  })
})
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(40rem, 94vw)' }"
    :aria-labelledby="idDoTitulo"
    :dismissable-mask="!salvando"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <div class="topo">
        <span class="topo__icone" aria-hidden="true"><i class="ph ph-syringe" /></span>
        <span class="topo__texto">
          <h2 :id="idDoTitulo" class="topo__titulo">
            {{ t('clinico.vacinas.aplicar.titulo', { pet: pet.nome }) }}
          </h2>
          <span v-if="subtitulo" class="topo__sub">{{ subtitulo }}</span>
        </span>
      </div>
    </template>

    <form class="aplicar clinic-scope" @submit.prevent="aplicar">
      <div class="aplicar__linha aplicar__linha--vacina">
        <ClinicField :rotulo="t('clinico.vacinas.colunaVacina')" obrigatorio>
          <template #default="{ id }">
            <Select
              v-model="vacinaId"
              :input-id="id"
              :options="opcoesVacina"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="ptDoOverlay"
            >
              <template #option="{ option }">
                <span class="opcao">
                  <strong>{{ option.rotulo }}</strong>
                  <small :class="option.situacao ? `opcao--${option.situacao}` : ''">
                    {{ option.detalhe }}
                  </small>
                </span>
              </template>
            </Select>
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.vacinas.dose')">
          <template #default="{ id }">
            <Select
              v-model="doseEscolhida"
              :input-id="id"
              :options="opcoesDose"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="ptDoOverlay"
            />
          </template>
        </ClinicField>
      </div>

      <p v-if="vacina && total > 1" class="aplicar__serie">
        {{
          t('clinico.vacinas.aplicar.serieDoPaciente', {
            serie: rotulos.serie(noPlano.get(vacina.id)?.tipoDeSerie ?? plano.faixa),
            total,
          })
        }}
      </p>

      <ClinicField :rotulo="t('clinico.vacinas.lote')" obrigatorio :erro="erroLote">
        <template #default="{ id, descrito }">
          <Select
            v-model="loteEscolhido"
            :input-id="id"
            :options="opcoesLote"
            option-value="valor"
            option-disabled="desabilitado"
            :loading="carregandoLotes"
            fluid
            :aria-describedby="[descrito, avisoDoLote ? idDoAviso : ''].filter(Boolean).join(' ')"
            :pt="ptDoOverlay"
          >
            <template #value="{ value }">
              <span v-if="value === LOTE_DIGITADO">{{
                t('clinico.vacinas.aplicar.lote.digitar')
              }}</span>
              <span v-else-if="loteDoEstoque" class="lote__valor">
                <strong class="ui-num">{{ loteDoEstoque.codigo }}</strong>
                <span>{{
                  t('clinico.vacinas.validade', { data: rotulos.data(loteDoEstoque.validade) })
                }}</span>
              </span>
              <span v-else class="lote__vazio">{{
                t('clinico.vacinas.aplicar.lote.escolher')
              }}</span>
            </template>

            <template #option="{ option }">
              <span v-if="option.lote" class="lote">
                <span class="lote__codigo">
                  <strong class="ui-num">{{ option.lote.codigo }}</strong>
                  <span v-if="!option.lote.avaliacao.pode" class="ui-selo ui-selo--risco lote__selo">
                    <i class="ph ph-prohibit" aria-hidden="true" />
                    {{ t('clinico.vacinas.estoque.situacaoLote.vencido') }}
                  </span>
                  <span v-else-if="option.lote.sugerido" class="ui-selo ui-selo--ok lote__selo">
                    <i class="ph ph-arrow-circle-up" aria-hidden="true" />
                    {{ t('clinico.vacinas.aplicar.lote.usarPrimeiro') }}
                  </span>
                </span>
                <small>
                  {{ t('clinico.vacinas.validade', { data: rotulos.data(option.lote.validade) }) }}
                  ·
                  {{
                    t(
                      'clinico.vacinas.aplicar.lote.saldo',
                      { doses: option.lote.saldo },
                      option.lote.saldo,
                    )
                  }}
                </small>
              </span>
              <span v-else class="lote lote--digitar">
                <strong>{{ t('clinico.vacinas.aplicar.lote.digitar') }}</strong>
                <small>{{ t('clinico.vacinas.aplicar.lote.digitarDica') }}</small>
              </span>
            </template>
          </Select>
        </template>
      </ClinicField>

      <div v-if="loteEscolhido === LOTE_DIGITADO" class="aplicar__linha">
        <ClinicField :rotulo="t('clinico.vacinas.aplicar.lote.codigo')" obrigatorio>
          <template #default="{ id }">
            <InputText :id="id" v-model="loteDigitado" fluid placeholder="L2026-014" />
          </template>
        </ClinicField>
        <ClinicField :rotulo="t('clinico.vacinas.validadeLote')" obrigatorio>
          <template #default="{ id }">
            <ClinicDateField v-model="validadeDigitada" :input-id="id" />
          </template>
        </ClinicField>
      </div>

      <!--
        O aviso do lote em frase inteira, e no tom da regra: vencido trava (risco), perto de vencer
        orienta (atenção). O ícone vai junto para a diferença sobreviver em escala de cinza.
      -->
      <p
        v-if="avisoDoLote"
        :id="idDoAviso"
        class="aviso"
        :class="`aviso--${avisoDoLote.tom}`"
        :role="avisoDoLote.tom === 'risco' ? 'alert' : undefined"
      >
        <i
          :class="
            avisoDoLote.tom === 'risco'
              ? 'ph ph-prohibit'
              : avisoDoLote.tom === 'atencao'
                ? 'ph ph-hourglass'
                : 'ph ph-info'
          "
          aria-hidden="true"
        />
        <span>{{ avisoDoLote.texto }}</span>
      </p>

      <p v-if="travados.length > 0 && loteEscolhido !== LOTE_DIGITADO" class="aplicar__travados">
        <i class="ph ph-lock" aria-hidden="true" />
        {{
          t(
            'clinico.vacinas.aplicar.lote.travados',
            { lotes: travados.map((lote) => lote.codigo).join(', ') },
            travados.length,
          )
        }}
      </p>

      <div class="aplicar__linha">
        <ClinicField :rotulo="t('clinico.vacinas.aplicar.via')" obrigatorio>
          <template #default="{ id }">
            <Select
              v-model="via"
              :input-id="id"
              :options="opcoesVia"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="ptDoOverlay"
            />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.vacinas.aplicar.aplicador')" obrigatorio>
          <template #default="{ id }">
            <Select
              v-model="aplicador"
              :input-id="id"
              :options="opcoesAplicador"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="ptDoOverlay"
            />
          </template>
        </ClinicField>
      </div>

      <!--
        A próxima dose, antes de gravar: é a data que vai para a carteira, e o horário que o
        responsável leva para casa. Conferir depois é conferir tarde.
      -->
      <section
        v-if="proxima"
        class="proxima"
        :aria-label="t('clinico.vacinas.aplicar.proxima.titulo')"
      >
        <div class="proxima__data">
          <span class="proxima__icone" aria-hidden="true"><i class="ph ph-calendar-blank" /></span>
          <span>
            <strong>
              {{
                proximaNaSerie
                  ? t('clinico.vacinas.aplicar.proxima.naSerie', {
                      dose: dose + 1,
                      total,
                      data: rotulos.data(proxima),
                    })
                  : t('clinico.vacinas.aplicar.proxima.reforco', { data: rotulos.data(proxima) })
              }}
            </strong>
          </span>
        </div>

        <label v-if="podeMarcar" class="proxima__marcar">
          <ToggleSwitch v-model="marcarProxima" :disabled="!sugestao" />
          <span>
            <strong>{{ t('clinico.vacinas.aplicar.proxima.marcar') }}</strong>
            <small v-if="buscandoHorario">{{
              t('clinico.vacinas.aplicar.proxima.buscando')
            }}</small>
            <small v-else-if="sugestao">{{ textoDaSugestao }}</small>
            <small v-else>{{ t('clinico.vacinas.aplicar.proxima.semHorario') }}</small>
          </span>
        </label>
        <p v-else class="proxima__recall">{{ t('clinico.vacinas.aplicar.proxima.recall') }}</p>
      </section>

      <ClinicField :rotulo="t('clinico.vacinas.aplicar.observacao')">
        <template #default="{ id }">
          <InputText :id="id" v-model="observacao" fluid />
        </template>
      </ClinicField>

      <Message v-if="erro" severity="error" :closable="false">{{ erro }}</Message>
    </form>

    <template #footer>
      <Button
        type="button"
        :label="t('clinico.comum.cancelar')"
        severity="secondary"
        text
        :disabled="salvando"
        @click="emit('update:visivel', false)"
      />
      <Button
        type="button"
        :label="t('clinico.vacinas.aplicar.confirmar')"
        icon="ph ph-check"
        :loading="salvando"
        :disabled="!completo"
        @click="aplicar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
/* ------------------------------------------------------------------ alto */

.topo {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
}

.topo__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-size: 20px;
}

.topo__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.topo__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.topo__sub {
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.35;
}

/* ------------------------------------------------------------------ formulário */

.aplicar {
  display: grid;
  gap: 16px;
}

.aplicar__linha {
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.aplicar__linha--vacina {
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
}

.aplicar__serie,
.aplicar__travados {
  display: flex;
  align-items: baseline;
  margin: -8px 0 0;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.aplicar__travados {
  margin: 0;
}

.opcao {
  display: grid;
  gap: 1px;
}

.opcao small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.opcao small.opcao--atrasada {
  color: var(--risco-tinta);
  font-weight: 600;
}

.opcao small.opcao--devida {
  color: var(--atencao-tinta);
  font-weight: 600;
}

.lote {
  display: grid;
  gap: 2px;
}

.lote__codigo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.lote__selo.ui-selo {
  height: 20px;
  padding-inline: 7px;
  font-size: 11.5px;
}

.lote small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.lote__valor {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}

.lote__valor span,
.lote__vazio {
  color: var(--tinta-2);
}

.aviso {
  display: flex;
  align-items: baseline;
  margin: -8px 0 0;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
}

.aviso--risco {
  color: var(--risco-tinta);
}

.aviso--atencao {
  color: var(--atencao-tinta);
}

.aviso--info {
  color: var(--tinta-2);
}

/* A próxima dose, numa faixa tingida: é a data que vai para a carteira, conferida antes. */
.proxima {
  display: grid;
  padding: 14px 16px;
  border-radius: 14px;
  gap: 12px;
  background: var(--superficie-2);
}

.proxima__data {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 15px;
}

.proxima__data strong {
  font-weight: 600;
}

.proxima__icone {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie);
  color: var(--musgo);
  font-size: 17px;
}

.proxima__marcar {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.proxima__marcar span {
  display: grid;
  gap: 1px;
  color: var(--tinta);
  font-size: 14px;
}

.proxima__marcar strong {
  font-weight: 600;
}

.proxima__marcar small,
.proxima__recall {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

@media (max-width: 620px) {
  .aplicar__linha,
  .aplicar__linha--vacina {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
