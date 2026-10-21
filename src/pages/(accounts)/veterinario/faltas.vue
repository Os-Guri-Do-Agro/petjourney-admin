<script setup lang="ts">
/**
 * Painel de faltas.
 *
 * A coluna que muda a conversa não é a contagem: é **quanto**. "Três faltas" é uma reclamação;
 * "três faltas, 90 minutos de agenda parados" é um dado que a clínica usa para decidir se
 * pede confirmação antes de reservar.
 *
 * Por isso a tela abre pelos três números que resumem o período, e a tabela **começa filtrada
 * nos reincidentes** — a lista completa traz dezenas de pacientes com uma falta só, que não
 * pedem nenhuma decisão e afogam os poucos que pedem. "Todas" fica a um clique.
 *
 * A política de reincidência é **sugestão**, e o toggle diz isso em voz alta. Regra que
 * proíbe vira regra contornada no papel.
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * No alto, três números grandes: faltas a justificar (a fila de trabalho), reincidentes (com quem
 * conversar sobre a política) e horas de agenda paradas (o tamanho do problema). A frase de estado
 * diz por onde começar, e a ação principal é exatamente essa — justificar a próxima.
 *
 * Embaixo, lista e detalhe: a tabela à esquerda e, ao lado, as faltas do responsável escolhido,
 * uma a uma, com o motivo e o que fazer. Em tela estreita o detalhe desce para baixo da tabela.
 * A política, que é configuração e muda uma vez, mora num popover atrás de um botão secundário.
 */
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import UiPagina from '@/components/ui/UiPagina.vue'
import ClinicPacienteCelula from '@/features/clinico/components/base/ClinicPacienteCelula.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import AgendaFaltaDialog from '@/features/clinico/components/agenda/AgendaFaltaDialog.vue'
import AgendaReagendarDialog from '@/features/clinico/components/agenda/AgendaReagendarDialog.vue'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import {
  agendaRepository,
  LIMITE_REINCIDENCIA,
  patientRepository,
  type FaltaDetalhada,
} from '@/features/clinico/data/repositories'
import type {
  Appointment,
  CanalDeContato,
  MotivoDeFalta,
  NoShowSummary,
  Pet,
  SlotSugestao,
  Tutor,
} from '@/features/clinico/data/types'
import { aceitaReagendamento } from '@/features/clinico/domain/faltas'
import { useAvisosStore } from '@/features/clinico/stores/avisos'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

type LinhaFalta = NoShowSummary & { pet: Pet | null; tutor: Tutor | null }
type Recorte = 'pendentes' | 'reincidentes' | 'todas'

const { t } = useI18n()
const clinico = useClinicoStore()
const avisos = useAvisosStore()
const formato = useClinicFormat()

const linhas = ref<LinhaFalta[]>([])
const carregando = ref(false)
const erro = ref('')
const politicaAtiva = ref(true)
const idPolitica = useId()
const idDetalhe = useId()
const recorte = ref<Recorte>('reincidentes')

/**
 * O detalhe por responsável.
 *
 * A tabela responde "quanto"; esta lista responde "quando, e o que aconteceu depois". Sem ela
 * não dá para distinguir três faltas em três anos de três faltas no mês — e as duas pedem
 * conversas completamente diferentes.
 *
 * Abre uma por vez: duas abertas transformariam a tabela numa rolagem sem fim.
 */
const responsavelAberto = ref<string | null>(null)
const detalhe = ref<FaltaDetalhada[]>([])
const carregandoDetalhe = ref(false)
const painel = ref<HTMLElement | null>(null)

/**
 * Lista e detalhe lado a lado quando a área tem largura para os dois (a mesma régua do
 * `@container` do estilo). A tabela precisa saber, porque ao lado do detalhe ela perde uma coluna.
 */
const LARGURA_LADO_A_LADO = 1040
const area = ref<HTMLElement | null>(null)
const ladoALado = ref(false)

watch(area, (elemento, _antes, aoLimpar) => {
  if (!elemento || typeof ResizeObserver === 'undefined') {
    return
  }

  const observador = new ResizeObserver(([entrada]) => {
    ladoALado.value = (entrada?.contentRect.width ?? 0) >= LARGURA_LADO_A_LADO
  })

  observador.observe(elemento)
  aoLimpar(() => observador.disconnect())
})

async function alternarDetalhe(linha: LinhaFalta) {
  if (responsavelAberto.value === linha.tutorId) {
    responsavelAberto.value = null

    return
  }

  responsavelAberto.value = linha.tutorId
  carregandoDetalhe.value = true
  detalhe.value = []
  void mostrarPainel()

  try {
    detalhe.value = await patientRepository.faltasDoResponsavel(linha.tutorId)
  } catch {
    detalhe.value = []
  } finally {
    carregandoDetalhe.value = false
  }
}

/** `Enter` na linha (e o duplo clique) abre — nunca fecha o que já está aberto. */
function abrirDetalhe(linha: LinhaFalta) {
  if (responsavelAberto.value !== linha.tutorId) {
    void alternarDetalhe(linha)
  }
}

/**
 * Em tela estreita o detalhe fica embaixo da tabela, fora da vista de quem clicou na linha: a
 * página desce até ele. Ao lado da tabela ele já está à vista, e nada se mexe.
 */
async function mostrarPainel() {
  await nextTick()

  const alvo = painel.value

  if (!alvo || alvo.getBoundingClientRect().top < window.innerHeight - 120) {
    return
  }

  const calmo = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  alvo.scrollIntoView({ behavior: calmo ? 'auto' : 'smooth', block: 'start' })
}

// ------------------------------------------------------------------ justificativa

/**
 * Registrar por que o paciente não veio, a partir do painel.
 *
 * É o caminho normal e não a exceção: a falta é marcada quando o horário passa, e o motivo só
 * aparece quando alguém liga — o que costuma ser no fim do dia, com esta lista aberta. Por isso
 * o diálogo é o **mesmo** da agenda: ele traz o telefone do responsável junto, e uma segunda
 * caixa só para a mesma pergunta divergiria na primeira mudança de motivos.
 */
const faltaParaJustificar = ref<FaltaDetalhada | null>(null)
const justificando = ref(false)

const tutorDaJustificativa = computed(() =>
  faltaParaJustificar.value
    ? (clinico.tutor(faltaParaJustificar.value.appointment.tutorId) ?? null)
    : null,
)

async function registrarJustificativa(entrada: {
  motivo: MotivoDeFalta
  canal: CanalDeContato
  observacao: string
}) {
  const falta = faltaParaJustificar.value

  if (!falta) {
    return
  }

  justificando.value = true

  try {
    await agendaRepository.justificarFalta(falta.appointment.id, {
      ...entrada,
      /* Quem registra é quem está com o painel aberto — na API real, o usuário da sessão. */
      professionalId: falta.appointment.professionalId,
    })

    clinico.invalidarTudo()
    faltaParaJustificar.value = null

    /*
     * As duas listas precisam refletir na hora: a do detalhe perde o botão de justificar, e a
     * tabela perde a linha da fila de pendências. Recarregar só uma deixaria a tela contradizendo
     * a si mesma até o próximo F5.
     */
    linhas.value = await patientRepository.resumoDeFaltas()

    if (responsavelAberto.value) {
      detalhe.value = await patientRepository.faltasDoResponsavel(responsavelAberto.value)
    }
  } catch {
    erro.value = t('clinico.erros.mutacao')
  } finally {
    justificando.value = false
  }
}

// ------------------------------------------------------------------ reagendamento

const paraReagendar = ref<Appointment | null>(null)
const sugestoes = ref<SlotSugestao[]>([])
const buscando = ref(false)
const salvando = ref(false)

/**
 * Reagendar de dentro do painel.
 *
 * É aqui que a política vira ação: a tela que mostra quem falta é a mesma em que se oferece o
 * horário de volta. Mandar a recepção procurar o paciente na agenda para remarcar seria pedir
 * que ela decore o nome e mude de tela — e é assim que a lista de faltas vira relatório que
 * ninguém usa.
 */
async function abrirReagendamento(falta: FaltaDetalhada) {
  paraReagendar.value = falta.appointment
  sugestoes.value = []
  buscando.value = true

  try {
    sugestoes.value = await agendaRepository.sugerirReagendamento({
      petId: falta.appointment.petId,
      professionalId: falta.appointment.professionalId,
      typeId: falta.appointment.typeId,
      aPartirDe: clinicClock.today(),
    })
  } catch {
    sugestoes.value = []
  } finally {
    buscando.value = false
  }
}

async function confirmarReagendamento({
  slot,
  mensagem,
}: {
  slot: SlotSugestao
  mensagem: string
}) {
  const falta = paraReagendar.value

  if (!falta) {
    return
  }

  salvando.value = true

  try {
    const resultado = await agendaRepository.criar({
      petId: falta.petId,
      tutorId: falta.tutorId,
      professionalId: slot.professionalId,
      roomIds: falta.roomIds,
      typeId: falta.typeId,
      inicio: slot.inicio,
      fim: slot.fim,
      encaixe: false,
      observacao: '',
      origem: 'recepcao',
    })

    const criado = resultado.atendimentos[0]

    if (criado) {
      avisos.registrar({
        appointmentId: criado.id,
        tutorId: falta.tutorId,
        kind: 'reagendamento',
        texto: mensagem,
      })
    }

    clinico.invalidarTudo()
    paraReagendar.value = null

    /* A linha reagendada precisa refletir isso na hora, senão o botão continua convidando. */
    if (responsavelAberto.value) {
      detalhe.value = await patientRepository.faltasDoResponsavel(responsavelAberto.value)
    }
  } catch {
    erro.value = t('clinico.erros.mutacao')
  } finally {
    salvando.value = false
  }
}

/**
 * Colunas do painel de faltas, todas ordenáveis.
 *
 * `ordenarPor` devolve o valor que a coluna **significa**, não o que ela desenha: a coluna de
 * paciente mostra nome, espécie e uma ficha de reincidência, e ordenar pelo texto renderizado
 * ordenaria por acaso de composição.
 *
 * As três numéricas abrem em decrescente (padrão da tabela): a pergunta que se faz aqui é
 * "quem falta mais", não "quem falta menos". As larguras são as de uma tabela que divide a linha
 * com o detalhe: as colunas de número só do tamanho do número.
 */
const colunas = computed<ColunaTabela<LinhaFalta>[]>(() => [
  {
    id: 'paciente',
    rotulo: t('clinico.faltas.colunaPaciente'),
    /* Nunca abaixo do nome: em tela de celular a tabela rola dentro de si, e o nome fica. */
    largura: 'minmax(11rem, 1.3fr)',
    ordenarPor: (linha) => linha.pet?.nome ?? null,
  },
  /*
   * Com o detalhe ao lado, a coluna do responsável sai e o nome dele desce para a linha de apoio
   * do paciente: o telefone e o resto estão no detalhe, e duas colunas de nome espremidas viravam
   * "Eduardo Bitten…" e "Açaí Nho…".
   */
  ...(ladoALado.value
    ? []
    : [
        {
          id: 'responsavel',
          rotulo: t('clinico.faltas.colunaResponsavel'),
          largura: 'minmax(0, 1.2fr)',
          ocultarEmTelaEstreita: true,
          ordenarPor: (linha: LinhaFalta) => linha.tutor?.nome ?? null,
        },
      ]),
  {
    id: 'faltas',
    rotulo: t('clinico.faltas.colunaFaltas'),
    largura: '6.5rem',
    numerico: true,
    alinharAoFim: true,
    ordenarPor: (linha) => linha.faltas,
  },
  {
    id: 'minutos',
    rotulo: t('clinico.faltas.colunaMinutos'),
    largura: '8rem',
    numerico: true,
    alinharAoFim: true,
    ordenarPor: (linha) => linha.minutosPerdidos,
  },
  {
    id: 'ultima',
    rotulo: t('clinico.faltas.colunaUltima'),
    largura: '7.5rem',
    /** Ordena pelo instante real, não pelo "há 3 dias" que a célula escreve. */
    ordenarPor: (linha) => linha.ultimaFaltaEm,
    ordemInicial: 'desc',
  },
])

/** Nome de quem está com o histórico aberto — o título do painel não pode dizer só um id. */
const nomeDoResponsavelAberto = computed(
  () => linhas.value.find((linha) => linha.tutorId === responsavelAberto.value)?.tutor?.nome ?? '',
)

/** As contas do responsável aberto, somando os pacientes dele: o cabeçalho do detalhe. */
const doResponsavelAberto = computed(() => {
  const dele = linhas.value.filter((linha) => linha.tutorId === responsavelAberto.value)

  return {
    telefone: dele[0]?.tutor?.telefone ?? '',
    faltas: dele.reduce((total, linha) => total + linha.faltas, 0),
    minutos: dele.reduce((total, linha) => total + linha.minutosPerdidos, 0),
    semMotivo: dele.reduce((total, linha) => total + linha.semJustificativa, 0),
  }
})

/** A linha da tabela que corresponde ao responsável aberto (a primeira, se ele tiver mais pets). */
const chaveSelecionada = computed(() => {
  const linha = visiveis.value.find((item) => item.tutorId === responsavelAberto.value)

  return linha ? `${linha.tutorId}-${linha.petId}` : null
})

function hrefDoTelefone(telefone: string) {
  return `tel:${telefone.replace(/[^\d+]/g, '')}`
}

const reincidentes = computed(() => linhas.value.filter((linha) => linha.reincidente))

/**
 * Quem ainda tem falta sem motivo apurado.
 *
 * É a fila de trabalho da tela, e é diferente de reincidência: reincidente é com quem
 * **conversar** sobre a política; pendente é quem ainda nem foi procurado. Um responsável com
 * cinco faltas todas justificadas por transporte não precisa de ligação — precisa de outro
 * horário.
 */
const pendentes = computed(() => linhas.value.filter((linha) => linha.semJustificativa > 0))

const visiveis = computed(() => {
  if (recorte.value === 'pendentes') {
    return pendentes.value
  }

  return recorte.value === 'reincidentes' ? reincidentes.value : linhas.value
})

/** Faltas sem motivo, somadas — o número grande, e não a contagem de responsáveis. */
const totalPendentes = computed(() =>
  linhas.value.reduce((total, linha) => total + linha.semJustificativa, 0),
)

const totalFaltas = computed(() => linhas.value.reduce((total, linha) => total + linha.faltas, 0))

/**
 * Por onde a fila começa: o paciente com falta sem motivo há mais tempo. É o mesmo que
 * "Justificar a próxima" abre, e o mesmo que a frase de estado nomeia.
 */
const proximaLinha = computed(
  () =>
    [...pendentes.value].sort((uma, outra) =>
      (uma.ultimaFaltaEm ?? '').localeCompare(outra.ultimaFaltaEm ?? ''),
    )[0] ?? null,
)

/**
 * A frase de estado: quantos ainda esperam uma ligação, e por quem começar.
 *
 * Os números do alto já dizem quanto; a frase diz o que fazer agora — e nomeia o mesmo paciente
 * que a ação principal abre.
 */
const fraseDoResumo = computed(() => {
  if (linhas.value.length === 0) {
    return ''
  }

  const linha = proximaLinha.value

  if (!linha) {
    return t('clinico.faltas.resumo.emDia')
  }

  const pacientes = pendentes.value.length
  const quantos = t('clinico.faltas.resumo.pendentes', { total: pacientes }, pacientes)

  return linha.ultimaFaltaEm && linha.pet
    ? `${quantos} ${t('clinico.faltas.resumo.comecePor', {
        pet: linha.pet.nome,
        quando: formato.relativo(linha.ultimaFaltaEm),
      })}`
    : quantos
})

const politica = ref<InstanceType<typeof Popover> | null>(null)
const buscandoProxima = ref(false)

/**
 * Abre a justificativa da falta sem motivo mais antiga — a fila de trabalho do painel, um toque
 * por vez. O histórico do responsável abre junto, para quem liga ter o resto das faltas à vista.
 */
async function justificarProxima() {
  const linha = proximaLinha.value

  if (!linha) {
    return
  }

  buscandoProxima.value = true

  try {
    if (responsavelAberto.value !== linha.tutorId) {
      await alternarDetalhe(linha)
    }

    const proxima = detalhe.value
      .filter((falta) => !falta.appointment.justificativaDeFalta)
      .sort((uma, outra) => uma.appointment.inicio.localeCompare(outra.appointment.inicio))[0]

    if (proxima) {
      faltaParaJustificar.value = proxima
    }
  } finally {
    buscandoProxima.value = false
  }
}

const totalMinutos = computed(() =>
  linhas.value.reduce((total, linha) => total + linha.minutosPerdidos, 0),
)

const opcoesRecorte = computed(() => [
  {
    valor: 'pendentes' as Recorte,
    rotulo: t('clinico.faltas.filtro.pendentes'),
    contagem: pendentes.value.length,
    tom: pendentes.value.length > 0 ? ('atencao' as const) : ('neutro' as const),
  },
  {
    valor: 'reincidentes' as Recorte,
    rotulo: t('clinico.faltas.filtro.reincidentes'),
    contagem: reincidentes.value.length,
    tom: 'neutro' as const,
  },
  {
    valor: 'todas' as Recorte,
    rotulo: t('clinico.faltas.filtro.todas'),
    contagem: linhas.value.length,
    tom: 'neutro' as const,
  },
])

const vazio = computed(() => !carregando.value && !erro.value && linhas.value.length === 0)

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()
    linhas.value = await patientRepository.resumoDeFaltas()

    /** Sem reincidente algum, abrir num recorte vazio seria esconder o que existe. */
    if (reincidentes.value.length === 0) {
      recorte.value = 'todas'
    }
  } catch {
    erro.value = t('clinico.erros.agenda')
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)
</script>

<template>
  <UiPagina
    :resumo="fraseDoResumo"
    :carregando="carregando && linhas.length === 0"
    :erro="erro"
    :vazio="vazio"
    :vazio-titulo="t('clinico.faltas.vazioTitulo')"
    :vazio-descricao="t('clinico.faltas.vazioDescricao')"
    vazio-icone="ph ph-calendar-check"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template #acoes>
      <Button
        v-if="totalPendentes > 0"
        type="button"
        icon="ph ph-phone-call"
        :label="t('clinico.faltas.acoes.justificarProxima')"
        :loading="buscandoProxima"
        @click="justificarProxima"
      />
    </template>

    <div class="faltas">
      <!-- Os três números do período: a fila de trabalho, com quem conversar, e quanto custou. -->
      <ul class="ui-indicadores numeros" :aria-label="t('clinico.faltas.numeros.rotulo')">
        <li class="ui-indicador" :class="{ 'ui-indicador--atencao': totalPendentes > 0 }">
          <span
            class="ui-ladrilho"
            :class="{ 'ui-ladrilho--atencao': totalPendentes > 0 }"
            aria-hidden="true"
          >
            <i class="ph ph-phone-x" />
          </span>
          <strong class="ui-indicador__valor">{{ totalPendentes }}</strong>
          <span class="ui-indicador__rotulo">
            {{ t('clinico.faltas.numeros.pendentes', totalPendentes) }}
          </span>
          <span class="ui-indicador__nota">
            {{
              t('clinico.faltas.frase.dePacientes', { total: pendentes.length }, pendentes.length)
            }}
          </span>
        </li>

        <li class="ui-indicador">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-repeat" /></span>
          <strong class="ui-indicador__valor">{{ reincidentes.length }}</strong>
          <span class="ui-indicador__rotulo">
            {{ t('clinico.faltas.numeros.reincidentes', reincidentes.length) }}
          </span>
          <span class="ui-indicador__nota">
            {{
              t('clinico.faltas.numeros.limite', { total: LIMITE_REINCIDENCIA }, LIMITE_REINCIDENCIA)
            }}
          </span>
        </li>

        <li class="ui-indicador">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-hourglass-medium" /></span>
          <strong class="ui-indicador__valor">{{ formato.duracao(totalMinutos) }}</strong>
          <span class="ui-indicador__rotulo">{{ t('clinico.faltas.numeros.agenda') }}</span>
          <span class="ui-indicador__nota">
            {{ t('clinico.faltas.numeros.emFaltas', { total: totalFaltas }, totalFaltas) }}
          </span>
        </li>
      </ul>

      <div ref="area" class="faltas__area">
        <div class="faltas__lado" :class="{ 'faltas__lado--aberto': responsavelAberto }">
          <!--
            A lista é um cartão com cabeçalho: o ladrilho, o nome, quantos aparecem e, à direita, a
            política (configuração, discreta). O recorte mora rente no alto, como filtro do cartão.
          -->
          <section class="ui-folha ui-cartao lista" aria-labelledby="faltas-lista-titulo">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-user-minus" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="faltas-lista-titulo" class="ui-cartao__titulo">
                  {{ t('clinico.faltas.titulo') }}
                  <span class="ui-contagem">{{ visiveis.length }}</span>
                </h2>
              </span>
              <span class="ui-cartao__acoes">
                <!-- A política mora ao lado do recorte: é dela que sai quem conta como reincidente. -->
                <Button
                  type="button"
                  class="faltas__politica"
                  icon="ph ph-sliders-horizontal"
                  :label="t('clinico.faltas.politica.titulo')"
                  severity="secondary"
                  text
                  size="small"
                  aria-haspopup="dialog"
                  @click="politica?.toggle($event)"
                />
              </span>
            </header>

            <div class="ui-cartao__ferramentas">
              <ClinicToggleGroup
                v-model="recorte"
                :opcoes="opcoesRecorte"
                :rotulo="t('clinico.agenda.filtros')"
              />
            </div>

            <ClinicDataTable
              class="faltas__tabela"
              :colunas="colunas"
              :linhas="visiveis"
              :chave="(linha) => `${linha.tutorId}-${linha.petId}`"
              :selecionada-id="chaveSelecionada"
              :vazio-titulo="t('clinico.faltas.vazioTitulo')"
              :rotulo="t('clinico.faltas.titulo')"
              @selecionar="alternarDetalhe"
              @ativar="abrirDetalhe"
            >
              <template #celula-paciente="{ linha }">
                <ClinicPacienteCelula :pet="linha.pet ?? null">
                  <template #selo>
                    <!--
                    O rótulo de reincidência mora aqui, e não na coluna de contagem: ali só cabia o
                    ícone, e ícone sozinho não diz "reincidente". Na aba Reincidentes ele some: ali
                    toda linha é reincidente, e o selo repetido dez vezes vira textura.
                  -->
                    <span
                      v-if="linha.reincidente && recorte !== 'reincidentes'"
                      class="ui-selo ui-selo--contorno faltas__selo"
                    >
                      <i class="ph ph-repeat" aria-hidden="true" />
                      {{ t('clinico.faltas.reincidente') }}
                    </span>
                  </template>
                  {{
                    [
                      linha.pet ? formato.especie(linha.pet.especie) : '',
                      ladoALado ? (linha.tutor?.nome ?? '') : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }}
                </ClinicPacienteCelula>
              </template>

              <template #celula-responsavel="{ linha }">
                <span class="faltas__nome">{{ linha.tutor?.nome }}</span>
                <span class="faltas__meta ui-num"
                  ><bdi dir="ltr">{{ linha.tutor?.telefone }}</bdi></span
                >
              </template>

              <template #celula-faltas="{ linha }">
                <strong class="faltas__contagem ui-num">{{ linha.faltas }}</strong>
                <span v-if="linha.semJustificativa > 0" class="faltas__sem-motivo">
                  {{
                    t(
                      'clinico.faltas.detalhe.semMotivo',
                      { total: linha.semJustificativa },
                      linha.semJustificativa,
                    )
                  }}
                </span>
              </template>

              <template #celula-minutos="{ linha }">
                <span class="ui-num">{{ formato.duracao(linha.minutosPerdidos) }}</span>
              </template>

              <template #celula-ultima="{ linha }">
                <span v-if="linha.ultimaFaltaEm" class="ui-num">
                  {{ formato.relativo(linha.ultimaFaltaEm) }}
                </span>
                <span v-else class="faltas__meta">{{ t('clinico.formato.semvalor') }}</span>
              </template>
            </ClinicDataTable>
          </section>

          <!--
            O detalhe do responsável escolhido. Fica **fora** da tabela, e não como linha
            expandida: dentro dela, o detalhe herdaria as colunas e a data de cada falta cairia na
            trilha de "minutos perdidos".
          -->
          <section
            ref="painel"
            class="detalhe ui-folha ui-cartao"
            :class="{ 'detalhe--convite': !responsavelAberto }"
            :aria-labelledby="responsavelAberto ? idDetalhe : undefined"
          >
            <template v-if="responsavelAberto">
              <header class="ui-cartao__cabeca detalhe__topo">
                <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-user" /></span>
                <div class="detalhe__quem">
                  <h2 :id="idDetalhe" class="ui-cartao__titulo detalhe__titulo">
                    {{ t('clinico.faltas.historico.titulo', { nome: nomeDoResponsavelAberto }) }}
                  </h2>
                  <a
                    v-if="doResponsavelAberto.telefone"
                    class="ui-mais detalhe__telefone"
                    :href="hrefDoTelefone(doResponsavelAberto.telefone)"
                    :title="
                      t('clinico.faltas.detalhe.ligar', { telefone: doResponsavelAberto.telefone })
                    "
                  >
                    <i class="ph ph-phone" aria-hidden="true" />
                    <bdi dir="ltr" class="ui-num">{{ doResponsavelAberto.telefone }}</bdi>
                  </a>
                </div>
                <Button
                  type="button"
                  class="detalhe__fechar"
                  text
                  severity="secondary"
                  icon="ph ph-x"
                  :aria-label="t('clinico.atalhos.fechar')"
                  @click="responsavelAberto = null"
                />
              </header>

              <p class="ui-cartao__ferramentas detalhe__contas">
                <span class="ui-num">{{
                  t(
                    'clinico.faltas.detalhe.contagem',
                    { total: doResponsavelAberto.faltas },
                    doResponsavelAberto.faltas,
                  )
                }}</span>
                <span aria-hidden="true">·</span>
                <span class="ui-num">{{
                  t('clinico.faltas.frase.agenda', {
                    tempo: formato.duracao(doResponsavelAberto.minutos),
                  })
                }}</span>
                <template v-if="doResponsavelAberto.semMotivo > 0">
                  <span aria-hidden="true">·</span>
                  <span class="ui-num detalhe__pendentes">{{
                    t(
                      'clinico.faltas.detalhe.semMotivo',
                      { total: doResponsavelAberto.semMotivo },
                      doResponsavelAberto.semMotivo,
                    )
                  }}</span>
                </template>
              </p>

              <p v-if="carregandoDetalhe" class="detalhe__estado" role="status">
                <i class="ph ph-spin ph-circle-notch" aria-hidden="true" />
                {{ t('clinico.tabela.carregando') }}
              </p>

              <ol v-else class="ui-lista detalhe__lista">
                <li
                  v-for="falta in detalhe"
                  :key="falta.appointment.id"
                  class="falta"
                  :class="{
                    'ui-marca ui-marca--atencao': !falta.appointment.justificativaDeFalta,
                  }"
                >
                  <div class="falta__quando">
                    <strong class="ui-num">
                      {{ formato.dataCurta(clinicClock.dateOf(falta.appointment.inicio)) }}
                    </strong>
                    <span class="ui-hora falta__hora">
                      {{ formato.hora(falta.appointment.inicio) }}
                    </span>
                  </div>

                  <div class="falta__corpo">
                    <span class="falta__linha">
                      <span class="falta__paciente">{{ falta.pet?.nome }}</span>
                      <span
                        v-if="!falta.appointment.justificativaDeFalta"
                        class="ui-selo ui-selo--atencao falta__selo"
                      >
                        <i class="ph ph-phone-x" aria-hidden="true" />
                        {{ t('clinico.faltas.justificativa.pendente') }}
                      </span>
                    </span>
                    <span class="falta__meta">
                      {{ clinico.tipo(falta.appointment.typeId)?.nome }} ·
                      <span class="ui-num">{{ formato.duracao(falta.minutosPerdidos) }}</span>
                    </span>

                    <!--
                      O motivo, quando existe, vem embaixo do paciente: é texto de tamanho
                      variável, e o que se lê aqui é a frase inteira — "transporte, por WhatsApp".

                      E é um botão, e não um selo: quem lê "transporte" é quem pode querer corrigir
                      para "custo" depois de uma segunda ligação. O próprio motivo é o caminho de
                      volta ao diálogo.
                    -->
                    <button
                      v-if="falta.appointment.justificativaDeFalta"
                      type="button"
                      class="falta__motivo"
                      :title="t('clinico.faltas.justificativa.editar')"
                      @click.stop="faltaParaJustificar = falta"
                    >
                      <i class="ph ph-chat-circle-text" aria-hidden="true" />
                      <span>
                        {{ formato.motivoFalta(falta.appointment.justificativaDeFalta.motivo) }}
                        <span class="falta__canal">
                          ·
                          {{
                            formato.canalDeContato(falta.appointment.justificativaDeFalta.canal)
                          }}
                        </span>
                      </span>
                    </button>

                    <span
                      v-if="falta.appointment.justificativaDeFalta?.observacao"
                      class="falta__observacao"
                    >
                      {{ falta.appointment.justificativaDeFalta.observacao }}
                    </span>

                    <!--
                      Duas ações, e a ordem importa: **apurar vem antes de reagendar**. Sem motivo,
                      a recepção não sabe o que oferecer — quem faltou por transporte quer outro
                      horário, quem faltou por custo quer outra conversa.

                      Óbito registrado: o botão de reagendar **some**, e não fica desabilitado.
                      Botão cinza ainda é um convite. E vem **antes** do selo de reagendado: se o
                      dado disser as duas coisas, a que a tela mostra é a que encerra.
                    -->
                    <div class="falta__acoes">
                      <Button
                        v-if="!falta.appointment.justificativaDeFalta"
                        type="button"
                        :label="t('clinico.faltas.justificativa.acao')"
                        icon="ph ph-phone"
                        size="small"
                        severity="secondary"
                        outlined
                        @click.stop="faltaParaJustificar = falta"
                      />

                      <span
                        v-if="!aceitaReagendamento(falta.appointment)"
                        class="ui-selo falta__selo"
                      >
                        {{ t('clinico.faltas.historico.encerrado') }}
                      </span>
                      <span v-else-if="falta.reagendadoPara" class="ui-selo ui-selo--ok falta__selo">
                        <i class="ph ph-calendar-check" aria-hidden="true" />
                        {{
                          t('clinico.faltas.historico.reagendado', {
                            data: formato.dataCurta(clinicClock.dateOf(falta.reagendadoPara)),
                          })
                        }}
                      </span>
                      <Button
                        v-else
                        type="button"
                        :label="t('clinico.faltas.reagendar.titulo')"
                        icon="ph ph-calendar-plus"
                        size="small"
                        severity="secondary"
                        outlined
                        @click="abrirReagendamento(falta)"
                      />
                    </div>
                  </div>
                </li>
              </ol>
            </template>

            <div v-else class="detalhe__convite">
              <span class="ui-ladrilho ui-ladrilho--g" aria-hidden="true">
                <i class="ph ph-cursor-click" />
              </span>
              <strong>{{ t('clinico.faltas.detalhe.convite') }}</strong>
              <p>{{ t('clinico.faltas.detalhe.conviteTexto') }}</p>
            </div>
          </section>
        </div>
      </div>
    </div>

    <template #sempre>
      <!--
        A política é configuração: muda uma vez. Recolhida atrás do botão do topo, continua a um
        clique e diz em voz alta que é sugestão.
      -->
      <Popover ref="politica">
        <section class="politica" :aria-label="t('clinico.faltas.politica.titulo')">
          <div class="politica__texto">
            <h2 class="politica__titulo">{{ t('clinico.faltas.politica.titulo') }}</h2>
            <p>{{ t('clinico.faltas.politica.descricao', { limite: LIMITE_REINCIDENCIA }) }}</p>
          </div>

          <div class="politica__toggle">
            <ToggleSwitch v-model="politicaAtiva" :input-id="idPolitica" />
            <label :for="idPolitica">
              <strong>{{ t('clinico.faltas.politica.ativar') }}</strong>
              <small>
                {{
                  politicaAtiva
                    ? t('clinico.faltas.politica.ativo')
                    : t('clinico.faltas.politica.inativo')
                }}
              </small>
            </label>
          </div>
        </section>
      </Popover>

      <AgendaReagendarDialog
        :appointment="paraReagendar"
        :sugestoes="sugestoes"
        :buscando="buscando"
        :salvando="salvando"
        @confirmar="confirmarReagendamento"
        @fechar="paraReagendar = null"
      />

      <!--
        O mesmo diálogo da agenda. Aqui ele nunca adia — a falta já existe e o painel é exatamente
        o lugar de apurar —, então fechar é desistir, não "deixar para depois".
      -->
      <AgendaFaltaDialog
        :appointment="faltaParaJustificar?.appointment ?? null"
        :tutor="tutorDaJustificativa"
        :salvando="justificando"
        @confirmar="registrarJustificativa"
        @adiar="faltaParaJustificar = null"
        @fechar="faltaParaJustificar = null"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.faltas {
  display: grid;
  gap: 20px;
}

/* ------------------------------------------------------------------------- lista e detalhe */

.numeros {
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista {
  min-width: 0;
}

/* Estreito, a política desce para baixo do título em vez de encostar na contagem. */
.lista > .ui-cartao__cabeca {
  flex-wrap: wrap;
}

.lista > .ui-cartao__cabeca > .ui-cartao__titulos {
  flex: 1 0 auto;
}

.lista :deep(.tabela__cabecalho),
.lista :deep(.tabela__linha) {
  padding-inline: 20px;
}

.faltas__area {
  container: faltas / inline-size;
}

.faltas__lado {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr);
}

.faltas__nome {
  display: block;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.faltas__meta {
  display: block;
  color: var(--tinta-2);
  font-size: 13px;
}

.faltas__selo {
  height: 22px;
  padding-inline: 7px;
  font-size: 12px;
}

.faltas__contagem {
  display: block;
  font-size: 16px;
  font-weight: 650;
}

.faltas__sem-motivo {
  display: block;
  color: var(--atencao-tinta);
  font-size: 12px;
  font-weight: 550;
  white-space: nowrap;
}

/* O detalhe: em tela estreita, embaixo da tabela, e só quando há alguém escolhido. */
.detalhe {
  display: grid;
  min-width: 0;
  align-content: start;
}

.detalhe--convite {
  display: none;
}

.detalhe__topo {
  align-items: flex-start;
  padding-inline-end: 12px;
}

.detalhe__quem {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 4px;
}

.detalhe__titulo {
  line-height: 1.3;
}

.detalhe__telefone {
  justify-self: start;
  font-size: 14px;
}

.detalhe__fechar.p-button {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 10px;
}

.detalhe__contas {
  gap: 4px 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.detalhe__pendentes {
  color: var(--atencao-tinta);
  font-weight: 600;
}

.detalhe__estado {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 22px 18px;
  color: var(--tinta-2);
}

.falta {
  position: relative;
  display: grid;
  align-items: start;
  gap: 14px;
  grid-template-columns: 56px minmax(0, 1fr);
  padding: 14px 20px;
}

.falta__quando {
  display: grid;
  gap: 2px;
  padding-top: 1px;
}

.falta__quando strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.falta__hora {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
}

.falta__corpo {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 3px;
}

.falta__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  max-width: 100%;
}

.falta__paciente {
  overflow: hidden;
  max-width: 100%;
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.falta__meta {
  color: var(--tinta-2);
  font-size: 13px;
}

.falta__selo {
  height: 22px;
  padding-inline: 7px;
  font-size: 12px;
}

/* O motivo é um link para o diálogo: corrige-se clicando no que está escrito. */
.falta__motivo {
  display: inline-flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 4px;
  padding: 2px 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--pj-lugar-tinta, var(--musgo));
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  text-align: start;
}

.falta__motivo i {
  margin-top: 1px;
  font-size: 16px;
}

.falta__motivo:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.falta__motivo:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.falta__canal {
  color: var(--tinta-2);
  font-weight: 500;
}

.falta__observacao {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.falta__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

/*
 * Lado a lado quando cabe: a tabela à esquerda, o detalhe preso ao lado enquanto a lista rola.
 * Só acontece em tela larga, onde quem rola é o `main#conteudo` (a fita do dia fica fora dele): o
 * `top` é a folga dentro da folha, e a altura desconta a fita e o respiro da moldura.
 */
@container faltas (min-width: 1040px) {
  .faltas__lado {
    grid-template-columns: minmax(0, 1fr) 340px;
  }

  .detalhe {
    position: sticky;
    top: 16px;
    max-height: calc(100vh - 140px);
    overflow-y: auto;
  }

  .detalhe--convite {
    display: grid;
  }
}

/* O convite, no padrão do vazio: centrado, o ladrilho grande, uma frase. */
.detalhe__convite {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 32px 24px 34px;
  text-align: center;
}

.detalhe__convite .ui-ladrilho {
  margin-bottom: 8px;
}

.detalhe__convite strong {
  font-size: 15px;
  font-weight: 650;
}

.detalhe__convite p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

/* ------------------------------------------------------------------------------- política */

.politica {
  display: grid;
  gap: 14px;
  max-width: 24rem;
  padding: 4px;
}

.politica__titulo {
  margin: 0 0 6px;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.politica__texto p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.55;
}

.politica__toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.politica__toggle label {
  display: grid;
  gap: 2px;
  cursor: pointer;
}

.politica__toggle strong {
  font-size: 14px;
  font-weight: 600;
}

.politica__toggle small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

@media (max-width: 760px) {
  .numeros.ui-indicadores {
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .numeros .ui-indicador {
    padding: 14px 16px;
  }

  .numeros .ui-indicador__valor {
    font-size: 24px;
  }

  .lista :deep(.tabela__cabecalho),
  .lista :deep(.tabela__linha) {
    padding-inline: 14px;
  }

  .falta {
    padding-inline: 16px;
  }
}
</style>
