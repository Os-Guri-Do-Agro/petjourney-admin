<script setup lang="ts">
/**
 * Tratamentos em casa — o remédio que saiu da clínica, visto de todos os pacientes de uma vez.
 *
 * É onde o alerta da clínica mora. A ficha de cada paciente mostra o tratamento dele; esta tela
 * responde a pergunta de quem abre o dia: **para quem a clínica precisa ligar?** Por isso abre
 * no recorte "Pedem atenção" — os tratamentos críticos cuja adesão caiu —, e o selo do menu e a
 * Visão geral contam o mesmo número.
 *
 * Cada linha traz a faixa dos últimos 14 dias, e a conta da mesma janela ao lado: um olhar diz se
 * o tratamento vai bem, e o clique leva à ficha, onde estão o histórico inteiro, quem registrou e
 * o registro da conversa.
 *
 * Acabamento do módulo clínico, não o da Visão geral: a variante só vale onde o usuário aprovou.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicStat from '@/features/clinico/components/base/ClinicStat.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import FaixaDeDoses from '@/features/clinico/components/tratamento/FaixaDeDoses.vue'
import LegendaDaFaixa from '@/features/clinico/components/tratamento/LegendaDaFaixa.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useRotulosDoTratamento } from '@/features/clinico/composables/useRotulosDoTratamento'
import { tratamentoRepository, type LinhaDeTratamento } from '@/features/clinico/data/repositories'
import { dosesNoPeriodo, resumirAdesao } from '@/features/clinico/domain/adesao'
import { epochToWall, wallToIso } from '@/features/clinico/domain/clinic-time'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

type Recorte = 'atencao' | 'emCurso' | 'encerrados'

/** A janela da faixa na lista: duas semanas cabem numa linha e mostram o ritmo. */
const JANELA_DIAS = 14

const { t } = useI18n()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoTratamento()

const linhas = ref<LinhaDeTratamento[]>([])
const carregando = ref(false)
const erro = ref('')
const recorte = ref<Recorte>('atencao')

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()
    linhas.value = await tratamentoRepository.daClinica()

    /* Sem nada pedindo atenção, abrir no recorte vazio esconderia o que existe. */
    if (porRecorte.value.atencao.length === 0) {
      recorte.value = 'emCurso'
    }
  } catch {
    erro.value = t('clinico.erros.agenda')
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)

const porRecorte = computed(() => ({
  atencao: linhas.value.filter((linha) => linha.alerta !== null),
  emCurso: linhas.value.filter((linha) => linha.emCurso),
  encerrados: linhas.value.filter((linha) => !linha.emCurso),
}))

const criticos = computed(
  () => porRecorte.value.emCurso.filter((linha) => linha.tratamento.critico).length,
)

const opcoesDoRecorte = computed(() => [
  {
    valor: 'atencao' as const,
    rotulo: `${t('clinico.adesao.lista.recorte.atencao')} · ${porRecorte.value.atencao.length}`,
    tom: porRecorte.value.atencao.length > 0 ? ('risco' as const) : ('neutro' as const),
  },
  {
    valor: 'emCurso' as const,
    rotulo: `${t('clinico.adesao.lista.recorte.emCurso')} · ${porRecorte.value.emCurso.length}`,
  },
  {
    valor: 'encerrados' as const,
    rotulo: `${t('clinico.adesao.lista.recorte.encerrados')} · ${porRecorte.value.encerrados.length}`,
  },
])

const visiveis = computed(() => porRecorte.value[recorte.value])

// ------------------------------------------------------------------ a janela da faixa

function somarDias(iso: string, dias: number): string {
  return wallToIso(
    epochToWall(Date.parse(iso) + dias * 86_400_000, clinicClock.utcOffset),
    clinicClock.utcOffset,
  )
}

/** A conta das duas semanas da faixa — a mesma janela que ela desenha, para os dois concordarem. */
function daJanela(linha: LinhaDeTratamento) {
  const fim = linha.emCurso
    ? clinicClock.nowIso()
    : (linha.doses[linha.doses.length - 1]?.previstaEm ?? clinicClock.nowIso())
  const inicio = somarDias(clinicClock.toIso(clinicClock.dateOf(fim), 0), -(JANELA_DIAS - 1))
  const doses = dosesNoPeriodo(linha.doses, inicio, somarDias(fim, 1))

  return {
    doses,
    resumo: resumirAdesao(doses, inicio, fim, linha.tratamento.frequenciaHoras),
  }
}

const janelas = computed(
  () => new Map(visiveis.value.map((linha) => [linha.tratamento.id, daJanela(linha)])),
)

// ------------------------------------------------------------------ tabela

const colunas = computed<ColunaTabela<LinhaDeTratamento>[]>(() => [
  {
    id: 'paciente',
    rotulo: t('clinico.adesao.lista.coluna.paciente'),
    largura: 'minmax(8.5rem, 1.1fr)',
    ordenarPor: (linha) => linha.petNome,
  },
  {
    id: 'remedio',
    rotulo: t('clinico.adesao.lista.coluna.remedio'),
    largura: 'minmax(0, 1.4fr)',
    ordenarPor: (linha) => rotulos.nome(linha.tratamento),
  },
  {
    id: 'janela',
    rotulo: t('clinico.adesao.lista.coluna.janela', { dias: JANELA_DIAS }),
    largura: 'minmax(0, 1.3fr)',
  },
  {
    id: 'responsavel',
    rotulo: t('clinico.adesao.lista.coluna.responsavel'),
    largura: 'minmax(0, 1fr)',
    ocultarEmTelaEstreita: true,
  },
  {
    id: 'situacao',
    rotulo: t('clinico.adesao.lista.coluna.situacao'),
    largura: '9.5rem',
  },
])

function abrir(linha: LinhaDeTratamento) {
  void router.push(`/veterinario/paciente/${linha.tratamento.petId}/tratamento`)
}
</script>

<template>
  <PartnerPageFrame
    :title="t('clinico.adesao.titulo')"
    :subtitle="t('clinico.adesao.subtitulo')"
    :loading="carregando && linhas.length === 0"
    :error="erro"
    :empty="!carregando && !erro && linhas.length === 0"
    :empty-title="t('clinico.adesao.lista.vazioTitulo')"
    :empty-description="t('clinico.adesao.lista.vazioDescricao')"
    block-when-suspended
    @retry="carregar"
  >
    <div class="tratamentos clinic-scope">
      <div class="resumo">
        <ClinicStat
          icone="pi pi-exclamation-triangle"
          :tom="porRecorte.atencao.length > 0 ? 'risco' : 'neutro'"
          :rotulo="t('clinico.adesao.lista.stat.alertas')"
          :valor="String(porRecorte.atencao.length)"
          :detalhe="t('clinico.adesao.lista.stat.alertasDetalhe')"
        />
        <ClinicStat
          icone="pi pi-calendar-clock"
          :rotulo="t('clinico.adesao.lista.stat.emCurso')"
          :valor="String(porRecorte.emCurso.length)"
          :detalhe="t('clinico.adesao.lista.stat.emCursoDetalhe')"
        />
        <ClinicStat
          icone="pi pi-heart"
          :rotulo="t('clinico.adesao.lista.stat.criticos')"
          :valor="String(criticos)"
          :detalhe="t('clinico.adesao.lista.stat.criticosDetalhe')"
        />
      </div>

      <div class="tratamentos__barra">
        <ClinicToggleGroup
          v-model="recorte"
          :opcoes="opcoesDoRecorte"
          :rotulo="t('clinico.adesao.titulo')"
        />
        <LegendaDaFaixa />
      </div>

      <ClinicDataTable
        :colunas="colunas"
        :linhas="visiveis"
        :chave="(linha) => linha.tratamento.id"
        :carregando="carregando"
        :vazio-titulo="t(`clinico.adesao.lista.vazioRecorte.${recorte}`)"
        :rotulo="t('clinico.adesao.titulo')"
        @ativar="abrir"
      >
        <template #celula-paciente="{ linha }">
          <span class="tratamentos__paciente">
            <PetAvatar
              :nome="linha.petNome"
              :iniciais="linha.petIniciais"
              :especie="linha.especie"
              :foto-url="linha.petFotoUrl"
              tamanho="md"
            />
            <span class="tratamentos__quem">
              <strong class="tratamentos__nome">{{ linha.petNome }}</strong>
              <span class="tratamentos__meta">{{ formato.especie(linha.especie) }}</span>
            </span>
          </span>
        </template>

        <template #celula-remedio="{ linha }">
          <span class="tratamentos__nome">{{ rotulos.nome(linha.tratamento) }}</span>
          <span class="tratamentos__meta">{{ rotulos.posologia(linha.tratamento) }}</span>
        </template>

        <template #celula-janela="{ linha }">
          <template v-if="linha.compartilhado && janelas.get(linha.tratamento.id)">
            <FaixaDeDoses
              :doses="janelas.get(linha.tratamento.id)!.doses"
              :frequencia-horas="linha.tratamento.frequenciaHoras"
              :dias="JANELA_DIAS"
              :nomes="linha.nomes"
              :rotulo="`${rotulos.nome(linha.tratamento)}: ${rotulos.contagem(janelas.get(linha.tratamento.id)!.resumo)}`"
              compacta
            />
            <span class="tratamentos__meta tratamentos__contagem">
              {{ rotulos.contagem(janelas.get(linha.tratamento.id)!.resumo) }}
            </span>
          </template>
          <span v-else class="tratamentos__meta">{{ t('clinico.adesao.naoCompartilhado') }}</span>
        </template>

        <template #celula-responsavel="{ linha }">
          <span class="tratamentos__nome">{{ linha.tutorNome }}</span>
          <span class="tratamentos__meta clinic-value">{{ linha.tutorTelefone }}</span>
        </template>

        <template #celula-situacao="{ linha }">
          <ClinicAlertChip
            v-if="linha.alerta"
            severidade="risco"
            :rotulo="t('clinico.adesao.alerta.selo')"
          />
          <ClinicAlertChip
            v-else-if="linha.tratamento.critico && linha.emCurso"
            severidade="info"
            :rotulo="t('clinico.adesao.critico.selo')"
          />
          <span v-else class="tratamentos__meta">
            {{
              linha.emCurso
                ? t('clinico.adesao.lista.situacaoEmCurso')
                : t('clinico.adesao.lista.situacaoEncerrado')
            }}
          </span>
        </template>
      </ClinicDataTable>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.tratamentos {
  display: grid;
  gap: var(--clinic-space-3);
}

.resumo {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  gap: var(--clinic-space-3);
}

.tratamentos__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.tratamentos__barra > :last-child {
  max-width: 34rem;
}

.tratamentos__paciente {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  min-width: 0;
}

.tratamentos__quem {
  display: grid;
  min-width: 0;
}

.tratamentos__quem .tratamentos__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tratamentos__nome {
  display: block;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tratamentos__meta {
  display: block;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.tratamentos__contagem {
  margin-top: 0.3rem;
  font-variant-numeric: tabular-nums;
}
</style>
