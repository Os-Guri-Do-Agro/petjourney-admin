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
 * ## A forma (redesenho de 30/09/2026)
 *
 * A saudação da Visão geral. A fileira de quatro cartões de número saiu: o que é fila de trabalho
 * (faltas a justificar) e o tamanho do problema (agenda parada) viraram a frase de estado, e
 * reincidentes e "a justificar" já estão no recorte, com o número em selo. A pílula cheia é a fila
 * de trabalho — justificar a próxima falta sem motivo —, e a política, que é configuração e muda
 * uma vez, recolheu num popover atrás de uma pílula contornada.
 */
import { PhPhoneCall, PhSlidersHorizontal } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
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

async function alternarDetalhe(linha: LinhaFalta) {
  if (responsavelAberto.value === linha.tutorId) {
    responsavelAberto.value = null

    return
  }

  responsavelAberto.value = linha.tutorId
  carregandoDetalhe.value = true
  detalhe.value = []

  try {
    detalhe.value = await patientRepository.faltasDoResponsavel(linha.tutorId)
  } catch {
    detalhe.value = []
  } finally {
    carregandoDetalhe.value = false
  }
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
     * As duas listas precisam refletir na hora: a de baixo perde o botão de justificar, e a de
     * cima perde a linha da fila de pendências. Recarregar só uma deixaria a tela contradizendo
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
 * "quem falta mais", não "quem falta menos".
 */
const colunas = computed<ColunaTabela<LinhaFalta>[]>(() => [
  {
    id: 'paciente',
    rotulo: t('clinico.faltas.colunaPaciente'),
    largura: 'minmax(0, 1.5fr)',
    ordenarPor: (linha) => linha.pet?.nome ?? null,
  },
  {
    id: 'responsavel',
    rotulo: t('clinico.faltas.colunaResponsavel'),
    largura: 'minmax(0, 1.5fr)',
    ocultarEmTelaEstreita: true,
    ordenarPor: (linha) => linha.tutor?.nome ?? null,
  },
  {
    id: 'faltas',
    rotulo: t('clinico.faltas.colunaFaltas'),
    largura: '6rem',
    numerico: true,
    alinharAoFim: true,
    ordenarPor: (linha) => linha.faltas,
  },
  {
    id: 'minutos',
    rotulo: t('clinico.faltas.colunaMinutos'),
    largura: '9rem',
    numerico: true,
    alinharAoFim: true,
    ordenarPor: (linha) => linha.minutosPerdidos,
  },
  {
    id: 'ultima',
    rotulo: t('clinico.faltas.colunaUltima'),
    largura: '9rem',
    /** Ordena pelo instante real, não pelo "há 3 dias" que a célula escreve. */
    ordenarPor: (linha) => linha.ultimaFaltaEm,
    ordemInicial: 'desc',
  },
])

/** Nome de quem está com o histórico aberto — o título do painel não pode dizer só um id. */
const nomeDoResponsavelAberto = computed(
  () =>
    linhas.value.find((linha) => linha.tutorId === responsavelAberto.value)?.tutor?.nome ?? '',
)

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

/** Faltas sem motivo, somadas — o número do cartão, e não a contagem de responsáveis. */
const totalPendentes = computed(() =>
  linhas.value.reduce((total, linha) => total + linha.semJustificativa, 0),
)

/**
 * A frase da saudação: a fila de trabalho primeiro, depois o tamanho do problema.
 *
 * Diz faltas **e** pacientes. A aba "A justificar" conta pacientes (as linhas da tabela); só com
 * as faltas, a frase dizia 26 e a aba 14, e quem lia achava que uma das duas estava errada.
 */
const fraseDoResumo = computed(() => {
  const pacientes = pendentes.value.length
  const fila =
    totalPendentes.value > 0
      ? t('clinico.faltas.frase.pendentesDe', {
          faltas: t(
            'clinico.faltas.frase.pendentes',
            { total: totalPendentes.value },
            totalPendentes.value,
          ),
          pacientes: t('clinico.faltas.frase.dePacientes', { total: pacientes }, pacientes),
        })
      : t('clinico.faltas.frase.emDia')

  return `${fila} · ${t('clinico.faltas.frase.agenda', { tempo: formato.duracao(totalMinutos.value) })}`
})

const politica = ref<InstanceType<typeof Popover> | null>(null)
const buscandoProxima = ref(false)

/**
 * Abre a justificativa da falta sem motivo mais antiga — a fila de trabalho do painel, um toque
 * por vez. O histórico do responsável abre junto, para quem liga ter o resto das faltas à vista.
 */
async function justificarProxima() {
  const linha = [...pendentes.value].sort((uma, outra) =>
    (uma.ultimaFaltaEm ?? '').localeCompare(outra.ultimaFaltaEm ?? ''),
  )[0]

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
  <PartnerPageFrame
    class="hc-tema"
    :subtitle="t('clinico.faltas.subtitulo')"
    :title="t('clinico.faltas.titulo')"
    :loading="carregando && linhas.length === 0"
    :error="erro"
    :empty="vazio"
    :empty-title="t('clinico.faltas.vazioTitulo')"
    :empty-description="t('clinico.faltas.vazioDescricao')"
    block-when-suspended
    @retry="carregar"
  >
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('clinico.faltas.subtitulo') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('clinico.faltas.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p v-if="linhas.length > 0" class="hc-saudacao__resumo" aria-live="polite">
            {{ fraseDoResumo }}
          </p>

          <nav class="hc-acoes" :aria-label="t('clinico.faltas.acoes.rotulo')">
            <Button
              v-if="totalPendentes > 0"
              type="button"
              class="hc-pilula hc-pilula--cheia"
              :label="t('clinico.faltas.acoes.justificarProxima')"
              :loading="buscandoProxima"
              @click="justificarProxima"
            >
              <template #icon>
                <PhPhoneCall class="hc-pilula__icone" weight="fill" aria-hidden="true" />
              </template>
            </Button>
            <Button
              type="button"
              class="hc-pilula"
              :label="t('clinico.faltas.politica.titulo')"
              aria-haspopup="dialog"
              @click="politica?.toggle($event)"
            >
              <template #icon>
                <PhSlidersHorizontal class="hc-pilula__icone" weight="duotone" aria-hidden="true" />
              </template>
            </Button>
          </nav>
        </div>
      </div>
    </template>

    <div class="faltas clinic-scope">
      <div class="faltas__recorte">
        <ClinicToggleGroup
          v-model="recorte"
          :opcoes="opcoesRecorte"
          :rotulo="t('clinico.agenda.filtros')"
        />
      </div>

      <ClinicDataTable
        :colunas="colunas"
        :linhas="visiveis"
        :chave="(linha) => `${linha.tutorId}-${linha.petId}`"
        :selecionada-id="
          visiveis.find((linha) => linha.tutorId === responsavelAberto)
            ? `${responsavelAberto}-${visiveis.find((linha) => linha.tutorId === responsavelAberto)?.petId}`
            : null
        "
        :vazio-titulo="t('clinico.faltas.vazioTitulo')"
        :rotulo="t('clinico.faltas.titulo')"
        @selecionar="alternarDetalhe"
      >
        <template #celula-paciente="{ linha }">
          <strong class="faltas__nome">{{ linha.pet?.nome }}</strong>
          <span class="faltas__linha-meta">
            <span class="faltas__meta">
              {{ linha.pet ? formato.especie(linha.pet.especie) : '' }}
            </span>
            <!--
              O rótulo de reincidência mora aqui, e não na coluna de contagem: naquele espaço
              só cabia o ícone, e ícone sozinho não diz "reincidente".
            -->
            <ClinicAlertChip
              v-if="linha.reincidente"
              severidade="atencao"
              :rotulo="t('clinico.faltas.reincidente')"
            />
          </span>
        </template>

        <template #celula-responsavel="{ linha }">
          <span class="faltas__nome">{{ linha.tutor?.nome }}</span>
          <span class="faltas__meta"><bdi dir="ltr">{{ linha.tutor?.telefone }}</bdi></span>
        </template>

        <template #celula-faltas="{ linha }">
          <strong class="faltas__contagem">{{ linha.faltas }}</strong>
        </template>

        <template #celula-minutos="{ linha }">
          {{ formato.duracao(linha.minutosPerdidos) }}
        </template>

        <template #celula-ultima="{ linha }">
          <span v-if="linha.ultimaFaltaEm" class="clinic-value">
            {{ formato.relativo(linha.ultimaFaltaEm) }}
          </span>
          <span v-else class="faltas__meta">—</span>
        </template>
      </ClinicDataTable>

      <!--
        Histórico do responsável selecionado. Fica **fora** da tabela, e não como linha
        expandida: dentro dela, o detalhe herdaria as colunas e a data de cada falta cairia na
        trilha de "minutos perdidos".
      -->
      <section v-if="responsavelAberto" class="detalhe">
        <header class="detalhe__topo">
          <h2 class="detalhe__titulo">
            {{ t('clinico.faltas.historico.titulo', { nome: nomeDoResponsavelAberto }) }}
          </h2>
          <Button
            type="button"
            class="detalhe__fechar"
            text
            severity="secondary"
            icon="pi pi-times"
            :aria-label="t('clinico.atalhos.fechar')"
            @click="responsavelAberto = null"
          />
        </header>

        <p v-if="carregandoDetalhe" class="detalhe__estado" role="status">
          <i class="pi pi-spin pi-spinner" aria-hidden="true" />
          {{ t('clinico.tabela.carregando') }}
        </p>

        <ol v-else class="detalhe__lista">
          <li v-for="falta in detalhe" :key="falta.appointment.id" class="falta">
            <div class="falta__quando">
              <strong class="clinic-value">
                {{ formato.dataCurta(clinicClock.dateOf(falta.appointment.inicio)) }}
              </strong>
              <span class="falta__hora clinic-value">
                {{ formato.hora(falta.appointment.inicio) }}
              </span>
            </div>

            <div class="falta__corpo">
              <span class="falta__paciente">{{ falta.pet?.nome }}</span>
              <span class="falta__meta">
                {{ clinico.tipo(falta.appointment.typeId)?.nome }} ·
                {{ formato.duracao(falta.minutosPerdidos) }}
              </span>

              <!--
                O motivo, quando existe, vem embaixo do paciente e não numa coluna própria: é
                texto de tamanho variável, e o que se lê aqui é a frase inteira — "transporte,
                por WhatsApp" — não um campo a ser comparado linha a linha.
              -->
              <Button
                v-if="falta.appointment.justificativaDeFalta"
                type="button"
                class="falta__motivo"
                text
                :title="t('clinico.faltas.justificativa.editar')"
                @click.stop="faltaParaJustificar = falta"
              >
                <i class="pi pi-comment" aria-hidden="true" />
                <span>
                  {{ formato.motivoFalta(falta.appointment.justificativaDeFalta.motivo) }}
                  <span class="falta__canal">
                    · {{ formato.canalDeContato(falta.appointment.justificativaDeFalta.canal) }}
                  </span>
                </span>
              </Button>
              <span
                v-if="falta.appointment.justificativaDeFalta?.observacao"
                class="falta__observacao"
              >
                {{ falta.appointment.justificativaDeFalta.observacao }}
              </span>
            </div>

            <!--
              Duas ações, e a ordem importa: **apurar vem antes de reagendar**.

              Sem motivo, a recepção não sabe o que oferecer — quem faltou por transporte quer
              outro horário, quem faltou por custo quer outra conversa. Por isso a falta sem
              justificativa mostra "Justificar" em destaque, e o reagendamento fica para depois
              de se saber o porquê.
            -->
            <div class="falta__acoes">
              <Button
                v-if="!falta.appointment.justificativaDeFalta"
                :label="t('clinico.faltas.justificativa.acao')"
                icon="pi pi-phone"
                size="small"
                severity="warn"
                outlined
                @click.stop="faltaParaJustificar = falta"
              />

              <!--
                Óbito registrado: o botão de reagendar **some**, e não fica desabilitado.

                Botão cinza ainda é um convite — alguém passa o mouse, lê "Reagendar" e procura
                por que não dá. Aqui não há o que explicar nem o que tentar: o caso acabou, e a
                única coisa que a linha precisa dizer é isso.

                E vem **antes** da ficha de reagendado, de propósito. Se o dado disser as duas
                coisas — o que só acontece com histórico inconsistente —, a que a tela precisa
                mostrar é a que encerra.
              -->
              <ClinicAlertChip
                v-if="!aceitaReagendamento(falta.appointment)"
                severidade="info"
                :rotulo="t('clinico.faltas.historico.encerrado')"
              />
              <ClinicAlertChip
                v-else-if="falta.reagendadoPara"
                severidade="info"
                :rotulo="
                  t('clinico.faltas.historico.reagendado', {
                    data: formato.dataCurta(clinicClock.dateOf(falta.reagendadoPara)),
                  })
                "
              />
              <Button
                v-else
                :label="t('clinico.faltas.reagendar.titulo')"
                icon="pi pi-calendar-plus"
                size="small"
                severity="secondary"
                outlined
                @click="abrirReagendamento(falta)"
              />
            </div>
          </li>
        </ol>
      </section>

    </div>

    <!--
      A política é configuração: muda uma vez, e ocupava uma seção inteira no pé da tela. Recolhida
      atrás da pílula do topo, continua a um clique e diz em voz alta que é sugestão.
    -->
    <Popover ref="politica" class="hc-tema">
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
  </PartnerPageFrame>
</template>

<style scoped>
.faltas {
  display: grid;
  gap: var(--clinic-space-3);
}

.faltas__recorte {
  display: flex;
  justify-content: flex-start;
}

.faltas__nome {
  display: block;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.faltas__linha-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
}

.faltas__meta {
  display: block;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.faltas__contagem {
  display: block;
  font-size: 1.05rem;
  font-weight: 800;
}

.detalhe {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-accent);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.detalhe__topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.detalhe__titulo {
  margin: 0;
  font-size: var(--clinic-font-title);
  font-weight: 750;
  letter-spacing: -0.02em;
}

.detalhe__fechar.p-button {
  width: var(--clinic-hit-target);
  height: var(--clinic-hit-target);
  border-radius: var(--clinic-radius-control);
}

.detalhe__estado {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  margin: 0;
  color: var(--clinic-muted);
}

.detalhe__lista {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.falta {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.falta__quando {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.falta__quando strong {
  font-weight: 800;
}

.falta__hora {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.falta__corpo {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
}

.falta__paciente {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.falta__meta {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/*
 * O motivo é um botão, e não um chip.
 *
 * Quem lê "transporte" numa falta é exatamente quem pode querer corrigir para "custo" depois de
 * uma segunda ligação. Deixar o texto inerte obrigaria a inventar um segundo ponto de entrada
 * para a correção; assim o próprio motivo é o caminho de volta ao diálogo.
 */
/* Botão de texto do PrimeVue com a cara de link do motivo: sem o respiro nem o fundo do tema. */
.falta__motivo.p-button {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 0.3rem;
  min-height: 0;
  margin-top: 0.15rem;
  padding: 0;
  border: none;
  background: none;
  color: var(--clinic-accent-strong);
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  text-align: start;
}

.falta__motivo.p-button:not(:disabled):hover {
  background: none;
  color: var(--clinic-accent-strong);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.falta__motivo:hover {
  text-decoration: underline;
}

.falta__motivo:focus-visible {
  border-radius: var(--clinic-radius-chip);
  outline: none;
  box-shadow: var(--clinic-focus-ring);
}

.falta__canal {
  color: var(--clinic-faint);
  font-weight: 600;
}

.falta__observacao {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.4;
}

.falta__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
}

@media (max-width: 640px) {
  .falta {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Dentro do popover da pílula "Política de reincidência": sem moldura própria, o popover já é a caixa. */
.politica {
  display: grid;
  gap: 0.9rem;
  max-width: 24rem;
  padding: 0.35rem 0.25rem;
}

.politica__texto {
  max-width: 46ch;
}

.politica__titulo {
  margin: 0 0 0.3rem;
  font-size: 1rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.politica__texto p {
  margin: 0;
  color: var(--clinic-muted);
  line-height: 1.55;
}

.politica__toggle {
  display: flex;
  align-items: flex-start;
  gap: var(--clinic-space-2);
}

.politica__toggle label {
  display: grid;
  gap: 0.1rem;
  cursor: pointer;
}

.politica__toggle small {
  color: var(--clinic-faint);
  font-size: 0.75rem;
  font-weight: 600;
}
</style>
