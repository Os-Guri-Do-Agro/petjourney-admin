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
 */
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onMounted, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicStat from '@/features/clinico/components/base/ClinicStat.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
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
  NoShowSummary,
  Pet,
  SlotSugestao,
  Tutor,
} from '@/features/clinico/data/types'
import { useAvisosStore } from '@/features/clinico/stores/avisos'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

type LinhaFalta = NoShowSummary & { pet: Pet | null; tutor: Tutor | null }
type Recorte = 'reincidentes' | 'todas'

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

const visiveis = computed(() =>
  recorte.value === 'reincidentes' ? reincidentes.value : linhas.value,
)

const totalFaltas = computed(() =>
  linhas.value.reduce((total, linha) => total + linha.faltas, 0),
)

const totalMinutos = computed(() =>
  linhas.value.reduce((total, linha) => total + linha.minutosPerdidos, 0),
)

const opcoesRecorte = computed(() => [
  {
    valor: 'reincidentes' as Recorte,
    rotulo: `${t('clinico.faltas.filtro.reincidentes')} · ${reincidentes.value.length}`,
  },
  {
    valor: 'todas' as Recorte,
    rotulo: `${t('clinico.faltas.filtro.todas')} · ${linhas.value.length}`,
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
    <div class="faltas clinic-scope">
      <!-- Os três números que dispensam ler a tabela para saber o tamanho do problema. -->
      <div class="resumo">
        <ClinicStat
          icone="pi pi-user-minus"
          :rotulo="t('clinico.faltas.resumo.total')"
          :valor="String(totalFaltas)"
          :detalhe="
            t('clinico.faltas.resumo.pacientes', { contagem: linhas.length }, linhas.length)
          "
        />
        <ClinicStat
          icone="pi pi-clock"
          tom="atencao"
          :rotulo="t('clinico.faltas.resumo.agenda')"
          :valor="formato.duracao(totalMinutos)"
        />
        <ClinicStat
          icone="pi pi-replay"
          :tom="reincidentes.length > 0 ? 'risco' : 'neutro'"
          :rotulo="t('clinico.faltas.resumo.reincidentes')"
          :valor="String(reincidentes.length)"
          :detalhe="t('clinico.faltas.resumo.limite', { limite: LIMITE_REINCIDENCIA })"
        />
      </div>

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
            </div>

            <!--
              Falta que já voltou não pede ação; falta que nunca voltou pede. Dizer qual é qual
              é o que impede a recepção de ligar para quem já remarcou.
            -->
            <ClinicAlertChip
              v-if="falta.reagendadoPara"
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
          </li>
        </ol>
      </section>

      <section class="politica">
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
    </div>

    <AgendaReagendarDialog
      :appointment="paraReagendar"
      :sugestoes="sugestoes"
      :buscando="buscando"
      :salvando="salvando"
      @confirmar="confirmarReagendamento"
      @fechar="paraReagendar = null"
    />
  </PartnerPageFrame>
</template>

<style scoped>
.faltas {
  display: grid;
  gap: var(--clinic-space-3);
}

.resumo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
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

@media (max-width: 640px) {
  .falta {
    grid-template-columns: minmax(0, 1fr);
  }
}

.politica {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--clinic-space-4);
  padding: var(--clinic-space-5);
  border: 1px dashed var(--clinic-line-strong);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.politica__texto {
  max-width: 46ch;
}

.politica__titulo {
  margin: 0 0 0.3rem;
  font-size: var(--clinic-font-title);
  font-weight: 750;
  letter-spacing: -0.02em;
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
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
</style>
