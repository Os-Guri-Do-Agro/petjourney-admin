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
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicStat from '@/features/clinico/components/base/ClinicStat.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { LIMITE_REINCIDENCIA, patientRepository } from '@/features/clinico/data/repositories'
import type { NoShowSummary, Pet, Tutor } from '@/features/clinico/data/types'
import { useClinicoStore } from '@/features/clinico/stores/clinico'

type LinhaFalta = NoShowSummary & { pet: Pet | null; tutor: Tutor | null }
type Recorte = 'reincidentes' | 'todas'

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const linhas = ref<LinhaFalta[]>([])
const carregando = ref(false)
const erro = ref('')
const politicaAtiva = ref(true)
const recorte = ref<Recorte>('reincidentes')

const colunas = computed<ColunaTabela[]>(() => [
  { id: 'paciente', rotulo: t('clinico.faltas.colunaPaciente'), largura: 'minmax(0, 1.5fr)' },
  {
    id: 'responsavel',
    rotulo: t('clinico.faltas.colunaResponsavel'),
    largura: 'minmax(0, 1.5fr)',
    ocultarEmTelaEstreita: true,
  },
  {
    id: 'faltas',
    rotulo: t('clinico.faltas.colunaFaltas'),
    largura: '6rem',
    numerico: true,
    alinharAoFim: true,
  },
  {
    id: 'minutos',
    rotulo: t('clinico.faltas.colunaMinutos'),
    largura: '9rem',
    numerico: true,
    alinharAoFim: true,
  },
  { id: 'ultima', rotulo: t('clinico.faltas.colunaUltima'), largura: '9rem' },
])

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
        :vazio-titulo="t('clinico.faltas.vazioTitulo')"
        :rotulo="t('clinico.faltas.titulo')"
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
          <span class="faltas__meta">{{ linha.tutor?.telefone }}</span>
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

      <section class="politica">
        <div class="politica__texto">
          <h2 class="politica__titulo">{{ t('clinico.faltas.politica.titulo') }}</h2>
          <p>{{ t('clinico.faltas.politica.descricao', { limite: LIMITE_REINCIDENCIA }) }}</p>
        </div>

        <label class="politica__toggle">
          <input v-model="politicaAtiva" type="checkbox" />
          <span>
            <strong>{{ t('clinico.faltas.politica.ativar') }}</strong>
            <small>
              {{
                politicaAtiva
                  ? t('clinico.faltas.politica.ativo')
                  : t('clinico.faltas.politica.inativo')
              }}
            </small>
          </span>
        </label>
      </section>
    </div>
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
  cursor: pointer;
}

.politica__toggle span {
  display: grid;
  gap: 0.1rem;
}

.politica__toggle small {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
</style>
