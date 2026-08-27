<script setup lang="ts">
/**
 * Prontuários.
 *
 * Lista os registros finalizados, do mais recente para o mais antigo, e destaca os que ainda
 * estão em rascunho — porque rascunho aberto é atendimento sem fecho, e é o que precisa de
 * atenção antes de qualquer histórico.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicFilterBar from '@/features/clinico/components/base/ClinicFilterBar.vue'
import type { GrupoDeFiltro } from '@/features/clinico/components/base/filter-types'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { encounterRepository } from '@/features/clinico/data/repositories'
import type { Encounter } from '@/features/clinico/data/types'
import { useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const rascunhos = ref<Encounter[]>([])
const finalizados = ref<Encounter[]>([])
const carregando = ref(false)
const erro = ref('')
const termo = ref('')
const selecionados = ref<Record<string, string[]>>({})

const linhas = computed(() => [...rascunhos.value, ...finalizados.value])

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * A busca aqui é por paciente ou diagnóstico — as duas formas de alguém procurar um
 * prontuário que já viu. Código de diagnóstico entra junto, para quem trabalha pelo catálogo.
 */
function atendeBusca(encounter: Encounter) {
  const alvo = normalizar(termo.value.trim())

  if (!alvo) {
    return true
  }

  const paciente = clinico.pet(encounter.petId)?.nome ?? ''
  const diagnosticos = encounter.diagnosticos
    .map((item) => `${item.codigo} ${clinico.descricaoDoDiagnostico(item)}`)
    .join(' ')

  return (
    normalizar(paciente).includes(alvo) ||
    normalizar(diagnosticos).includes(alvo) ||
    normalizar(encounter.anamnese.queixaPrincipal).includes(alvo)
  )
}

function atendeFiltros(encounter: Encounter) {
  const situacoes = selecionados.value.situacao ?? []
  const profissionais = selecionados.value.profissional ?? []

  return (
    (situacoes.length === 0 || situacoes.includes(encounter.status)) &&
    (profissionais.length === 0 || profissionais.includes(encounter.professionalId))
  )
}

const visiveis = computed(() =>
  linhas.value.filter((item) => atendeBusca(item) && atendeFiltros(item)),
)

function contar(regra: (item: Encounter) => boolean) {
  return linhas.value.filter(regra).length
}

const grupos = computed<GrupoDeFiltro[]>(() => [
  {
    id: 'situacao',
    rotulo: t('clinico.prontuario.filtro.situacao'),
    opcoes: [
      {
        valor: 'rascunho',
        rotulo: t('clinico.prontuario.rascunho'),
        contagem: contar((item) => item.status === 'rascunho'),
      },
      {
        valor: 'finalizado',
        rotulo: t('clinico.prontuario.finalizado'),
        contagem: contar((item) => item.status === 'finalizado'),
      },
    ],
  },
  {
    id: 'profissional',
    rotulo: t('clinico.prontuario.filtro.profissional'),
    opcoes: clinico.profissionais
      .map((profissional) => ({
        valor: profissional.id,
        rotulo: profissional.nome,
        contagem: contar((item) => item.professionalId === profissional.id),
      }))
      .filter((opcao) => opcao.contagem > 0),
  },
])

const colunas = computed<ColunaTabela[]>(() => [
  { id: 'data', rotulo: t('clinico.pacientes.colunaUltimo'), largura: '9rem' },
  { id: 'paciente', rotulo: t('clinico.pacientes.colunaPaciente'), largura: 'minmax(0, 1.5fr)' },
  {
    id: 'diagnostico',
    rotulo: t('clinico.prontuario.diagnostico.titulo'),
    largura: 'minmax(0, 1.8fr)',
  },
  {
    id: 'profissional',
    rotulo: t('clinico.agenda.mover.profissional'),
    largura: 'minmax(0, 1fr)',
    ocultarEmTelaEstreita: true,
  },
  { id: 'situacao', rotulo: '', largura: '8rem', alinharAoFim: true },
])



async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()
    const [emRascunho, concluidos] = await Promise.all([
      encounterRepository.listarRascunhos(null),
      encounterRepository.listarFinalizados(60),
    ])

    rascunhos.value = emRascunho
    finalizados.value = concluidos
  } catch {
    erro.value = t('clinico.erros.prontuario')
  } finally {
    carregando.value = false
  }
}

function abrir(encounter: Encounter) {
  void router.push(`/veterinario/atendimento/${encounter.id}`)
}

onMounted(carregar)
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('clinico.atendimentos.subtitulo')"
    :title="t('clinico.atendimentos.titulo')"
    :loading="carregando && linhas.length === 0"
    :error="erro"
    block-when-suspended
    @retry="carregar"
  >
    <div class="prontuarios clinic-scope">
      <ClinicFilterBar
        v-model:busca="termo"
        v-model:selecionados="selecionados"
        :grupos="grupos"
        :placeholder-busca="t('clinico.prontuario.buscar')"
        :resultado="visiveis.length"
      />

      <ClinicDataTable
        :colunas="colunas"
        :linhas="visiveis"
        :vazio-titulo="t('clinico.prontuario.vazioTitulo')"
        :vazio-descricao="t('clinico.prontuario.vazioDescricao')"
        :chave="(encounter) => encounter.id"
        :carregando="carregando"
        :rotulo="t('clinico.atendimentos.titulo')"
        @ativar="abrir"
        @selecionar="abrir"
      >
        <template #celula-data="{ linha }">
          {{ formato.dataCurta(encounterRepository.dataDe(linha)) }}
          <span class="prontuarios__meta clinic-value">
            {{ formato.hora(linha.finalizadoEm ?? linha.abertoEm) }}
          </span>
        </template>

        <template #celula-paciente="{ linha }">
          <strong class="prontuarios__nome">{{ clinico.pet(linha.petId)?.nome }}</strong>
          <span class="prontuarios__meta">{{ clinico.tutor(linha.tutorId)?.nome }}</span>
        </template>

        <template #celula-diagnostico="{ linha }">
          <span class="prontuarios__diagnostico">
            {{ clinico.diagnosticoPrincipal(linha) || linha.anamnese.queixaPrincipal || '—' }}
          </span>
          <span v-if="linha.diagnosticos.length > 1" class="prontuarios__meta">
            +{{ linha.diagnosticos.length - 1 }}
          </span>
        </template>

        <template #celula-profissional="{ linha }">
          {{ clinico.profissional(linha.professionalId)?.nome }}
        </template>

        <template #celula-situacao="{ linha }">
          <ClinicAlertChip
            v-if="linha.status === 'rascunho'"
            severidade="atencao"
            :rotulo="t('clinico.prontuario.rascunho')"
          />
          <span v-else class="prontuarios__meta">{{ t('clinico.prontuario.finalizado') }}</span>
        </template>
      </ClinicDataTable>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.prontuarios {
  display: grid;
  gap: var(--clinic-space-3);
}

.prontuarios__nome {
  display: block;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prontuarios__meta {
  display: block;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.prontuarios__diagnostico {
  display: block;
  overflow: hidden;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
