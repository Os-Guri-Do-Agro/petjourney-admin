<script setup lang="ts">
/**
 * Atendimentos.
 *
 * Lista os registros finalizados, do mais recente para o mais antigo, e destaca os que ainda
 * estão em rascunho — porque rascunho aberto é atendimento sem fecho, e é o que precisa de
 * atenção antes de qualquer histórico.
 *
 * Em blocos: os rascunhos primeiro, num grupo próprio, e depois um bloco por dia ("Hoje",
 * "Ontem", "qua., 30/09"). Eram 63 linhas corridas com a data repetida em cada uma, numa coluna
 * chamada "Último atendimento" — que não era o último de ninguém, era a data daquele.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicPacienteCelula from '@/features/clinico/components/base/ClinicPacienteCelula.vue'
import ClinicFilterBar from '@/features/clinico/components/base/ClinicFilterBar.vue'
import type { GrupoDeFiltro } from '@/features/clinico/components/base/filter-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { encounterRepository } from '@/features/clinico/data/repositories'
import type { Encounter } from '@/features/clinico/data/types'
import { diffDays } from '@/features/clinico/domain/clinic-time'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

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

/** "Hoje", "Ontem", ou o dia da semana com a data: é como a recepção fala do dia. */
function rotuloDoDia(dia: string) {
  const distancia = diffDays(dia, clinicClock.today())

  if (distancia === 0) {
    return t('clinico.atendimentos.dia.hoje')
  }

  if (distancia === 1) {
    return t('clinico.atendimentos.dia.ontem')
  }

  return `${formato.diaDaSemanaCurto(dia)}, ${formato.dataCurta(dia)}`
}

type Bloco = { chave: string; titulo: string; rascunho: boolean; itens: Encounter[] }

/** Os rascunhos num grupo no topo; depois um bloco por dia, do mais recente para trás. */
const blocos = computed<Bloco[]>(() => {
  const lista: Bloco[] = []
  const emRascunho = visiveis.value.filter((item) => item.status === 'rascunho')

  if (emRascunho.length > 0) {
    lista.push({
      chave: 'rascunho',
      titulo: t('clinico.atendimentos.grupoRascunho', { n: emRascunho.length }, emRascunho.length),
      rascunho: true,
      itens: emRascunho,
    })
  }

  const assinados = visiveis.value
    .filter((item) => item.status !== 'rascunho')
    .sort((a, b) => (b.finalizadoEm ?? b.abertoEm).localeCompare(a.finalizadoEm ?? a.abertoEm))

  for (const item of assinados) {
    const dia = encounterRepository.dataDe(item)
    let bloco = lista.at(-1)

    if (!bloco || bloco.rascunho || bloco.chave !== dia) {
      bloco = { chave: dia, titulo: rotuloDoDia(dia), rascunho: false, itens: [] }
      lista.push(bloco)
    }

    bloco.itens.push(item)
  }

  return lista
})

/** A frase da saudação: o que falta assinar. É a única coisa desta tela que pede ação. */
const fraseDoResumo = computed(() => {
  if (carregando.value && linhas.value.length === 0) {
    return ''
  }

  const n = rascunhos.value.length

  return n > 0
    ? t('clinico.atendimentos.saudacao.rascunhos', { n }, n)
    : t('clinico.atendimentos.saudacao.todosAssinados')
})

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
    class="hc-tema"
    :subtitle="t('clinico.atendimentos.subtitulo')"
    :title="t('clinico.atendimentos.titulo')"
    :loading="carregando && linhas.length === 0"
    :error="erro"
    block-when-suspended
    @retry="carregar"
  >
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('clinico.atendimentos.subtitulo') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('clinico.atendimentos.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p v-if="fraseDoResumo" class="hc-saudacao__resumo" aria-live="polite">
            {{ fraseDoResumo }}
          </p>
        </div>
      </div>
    </template>

    <div class="prontuarios clinic-scope">
      <ClinicFilterBar
        v-model:busca="termo"
        v-model:selecionados="selecionados"
        :grupos="grupos"
        :placeholder-busca="t('clinico.prontuario.buscar')"
        :resultado="visiveis.length"
      />

      <div v-if="!carregando && blocos.length === 0" class="hc prontuarios__vazio">
        <strong>{{ t('clinico.prontuario.vazioTitulo') }}</strong>
        <p>{{ t('clinico.prontuario.vazioDescricao') }}</p>
      </div>

      <!-- A lista inteira num cartão; os dias se separam por título, não por moldura. -->
      <div v-else class="hc prontuarios__lista">
        <section
          v-for="bloco in blocos"
          :key="bloco.chave"
          class="prontuarios__bloco"
          :aria-label="bloco.titulo"
        >
          <h2 class="prontuarios__dia" :class="{ 'prontuarios__dia--rascunho': bloco.rascunho }">
            <i v-if="bloco.rascunho" class="ph ph-pencil-simple" aria-hidden="true" />
            {{ bloco.titulo }}
          </h2>

          <ol class="prontuarios__itens">
            <li v-for="item in bloco.itens" :key="item.id">
              <Button type="button" class="prontuario-linha" @click="abrir(item)">
                <span class="prontuario-linha__quando">
                  <!-- No rascunho a data importa: um rascunho de 11/09 é atendimento esquecido. -->
                  <strong v-if="bloco.rascunho">
                    {{ formato.dataCurta(encounterRepository.dataDe(item)) }}
                  </strong>
                  <span :class="{ 'prontuario-linha__hora': !bloco.rascunho }">
                    {{ formato.hora(item.finalizadoEm ?? item.abertoEm) }}
                  </span>
                </span>

                <ClinicPacienteCelula :pet="clinico.pet(item.petId)">
                  {{ clinico.tutor(item.tutorId)?.nome }}
                </ClinicPacienteCelula>

                <span class="prontuario-linha__diagnostico">
                  <span class="prontuario-linha__texto">
                    {{ clinico.diagnosticoPrincipal(item) || item.anamnese.queixaPrincipal || '—' }}
                  </span>
                  <span v-if="item.diagnosticos.length > 1" class="prontuario-linha__mais">
                    +{{ item.diagnosticos.length - 1 }}
                  </span>
                </span>

                <span class="prontuario-linha__profissional">
                  {{ clinico.profissional(item.professionalId)?.nome }}
                </span>

                <i class="ph ph-caret-right prontuario-linha__seta" aria-hidden="true" />
              </Button>
            </li>
          </ol>
        </section>
      </div>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.prontuarios {
  display: grid;
  gap: 0.85rem;
}

.prontuarios__vazio {
  justify-items: center;
  color: var(--hc-tinta-2);
  text-align: center;
}

.prontuarios__vazio strong {
  color: var(--hc-tinta);
}

.prontuarios__vazio p {
  margin: 0;
  font-size: 0.875rem;
}

.prontuarios__lista {
  gap: 1.1rem;
  padding-block: 1rem 0.75rem;
}

.prontuarios__bloco {
  display: grid;
  gap: 0.15rem;
}

.prontuarios__dia {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding-bottom: 0.35rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 650;
}

.prontuarios__dia::first-letter {
  text-transform: uppercase;
}

/* Rascunho é o grupo que pede ação: o ícone na tinta de atenção, o título na do texto. */
.prontuarios__dia--rascunho {
  color: var(--hc-tinta);
}

.prontuarios__dia--rascunho i {
  color: var(--hc-pessego-tinta);
  font-size: 0.8rem;
}

.prontuarios__itens {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.prontuarios__itens > li + li {
  border-top: 1px solid var(--hc-linha);
}

.prontuario-linha.p-button {
  display: grid;
  align-items: center;
  gap: 1rem;
  grid-template-columns: 4.25rem minmax(0, 1.2fr) minmax(0, 1.8fr) minmax(0, 1fr) auto;
  width: 100%;
  padding: 0.65rem 0.35rem;
  border: 0;
  border-radius: 0.6rem;
  background: transparent;
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
  text-align: start;
  transition: background-color 0.15s ease-out;
}

.prontuarios__itens .prontuario-linha.p-button,
.prontuarios__itens .prontuario-linha.p-button:not(:disabled):hover,
.prontuarios__itens .prontuario-linha.p-button:focus-visible {
  box-shadow: none;
}

.prontuario-linha.p-button:not(:disabled):hover,
.prontuario-linha.p-button:not(:disabled):active {
  background: color-mix(in srgb, var(--hc-marca-clara) 45%, transparent);
  color: inherit;
}

.prontuario-linha.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: -2px;
}

.prontuario-linha__quando {
  display: grid;
  gap: 0.05rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.prontuario-linha__quando strong {
  color: var(--hc-tinta);
  font-weight: 650;
}

.prontuario-linha__hora {
  color: var(--hc-tinta);
  font-weight: 600;
}

.prontuario-linha__paciente {
  display: grid;
  min-width: 0;
}

.prontuario-linha__paciente strong {
  overflow: hidden;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prontuario-linha__paciente span {
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prontuario-linha__diagnostico {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  min-width: 0;
}

.prontuario-linha__texto {
  overflow: hidden;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prontuario-linha__mais {
  flex-shrink: 0;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: var(--hc-cinza-fundo);
  color: var(--hc-cinza-tinta);
  font-size: 0.75rem;
  font-weight: 700;
}

.prontuario-linha__profissional {
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prontuario-linha__seta {
  color: var(--hc-tinta-2);
  font-size: 0.78rem;
}

/* Tablet em pé: o profissional sai da linha (continua no prontuário e no filtro). */
@media (max-width: 900px) {
  .prontuario-linha.p-button {
    grid-template-columns: 4.25rem minmax(0, 1fr) minmax(0, 1.4fr) auto;
  }

  .prontuario-linha__profissional {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .prontuario-linha.p-button {
    transition: none;
  }
}
</style>
