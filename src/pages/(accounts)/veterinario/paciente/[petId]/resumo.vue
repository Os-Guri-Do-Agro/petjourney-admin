<script setup lang="ts">
/**
 * Este pet em 30 segundos — o que o vet lê antes de entrar na sala.
 *
 * O critério de pronto é cronometrado: alguém que nunca viu o paciente entende a situação dele
 * em menos de trinta segundos. A página é organizada na ordem dessa leitura:
 *
 * 1. **Quem é** — o cabeçalho de sempre, com a ação da vez (abrir o atendimento).
 * 2. **O que chama atenção** — os sinais, risco primeiro. Ou "nada fora do comum".
 * 3. **O que aconteceu em casa** e **para onde vai o peso** — o diário do responsável, que só
 *    este produto tem, ao lado do essencial do prontuário.
 *
 * O botão de abrir o atendimento leva o resumo junto: a anamnese já abre com o que o diário
 * registrou, as medicações em uso e as alergias — só nos campos ainda vazios. Quem assina o
 * prontuário continua sendo o vet, e o texto diz de onde veio.
 */
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicPatientHeader from '@/features/clinico/components/base/ClinicPatientHeader.vue'
import ResumoEmCasa from '@/features/clinico/components/pacientes/resumo/ResumoEmCasa.vue'
import ResumoEssencial from '@/features/clinico/components/pacientes/resumo/ResumoEssencial.vue'
import ResumoPeso from '@/features/clinico/components/pacientes/resumo/ResumoPeso.vue'
import ResumoPrimeiraConsulta from '@/features/clinico/components/pacientes/resumo/ResumoPrimeiraConsulta.vue'
import ResumoSinais from '@/features/clinico/components/pacientes/resumo/ResumoSinais.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useClinicPrefs } from '@/features/clinico/composables/useClinicPrefs'
import { patientRepository } from '@/features/clinico/data/repositories'
import type { Anamnese, Antecedente, Appointment, Pet, Tutor } from '@/features/clinico/data/types'
import {
  montarResumoDoPaciente,
  type ResumoDoPaciente,
} from '@/features/clinico/domain/resumo-do-paciente'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useProntuarioStore } from '@/features/clinico/stores/prontuario'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const prontuario = useProntuarioStore()
const formato = useClinicFormat()
/** A sugestão do histórico se religa aqui: é onde quem a desligou vem procurar. */
const { sugerirResumo } = useClinicPrefs()
const idDaPreferencia = useId()

const pet = ref<Pet | null>(null)
const tutor = ref<Tutor | null>(null)
const resumo = ref<ResumoDoPaciente | null>(null)
const atendimentoDeHoje = ref<Appointment | null>(null)
const carregando = ref(false)
const erro = ref('')
const abrindo = ref(false)
const erroAoAbrir = ref('')

const petId = computed(() => String(route.params.petId ?? ''))

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const [dados, fonte] = await Promise.all([
      patientRepository.obter(petId.value),
      patientRepository.paraOResumo(petId.value),
    ])

    pet.value = dados?.pet ?? null
    tutor.value = dados?.tutor ?? null
    atendimentoDeHoje.value = fonte.atendimentoDeHoje
    resumo.value = dados
      ? montarResumoDoPaciente({
          pet: dados.pet,
          consultas: fonte.consultas,
          diario: fonte.diario,
          agora: fonte.agora,
        })
      : null
  } catch {
    erro.value = t('clinico.erros.prontuario')
  } finally {
    carregando.value = false
  }
}

const perdaEmRisco = computed(
  () =>
    resumo.value?.sinais.some(
      (sinal) => sinal.tipo === 'perda-de-peso' && sinal.severidade === 'risco',
    ) ?? false,
)

const mostrarDiario = computed(
  () =>
    resumo.value !== null && (!resumo.value.primeiraVez || resumo.value.diario.entradas.length > 0),
)

const mostrarPeso = computed(
  () => resumo.value !== null && (!resumo.value.primeiraVez || resumo.value.peso.serie.length > 0),
)

const linhaDeHoje = computed(() => {
  const appointment = atendimentoDeHoje.value

  if (!appointment) {
    return ''
  }

  return t('clinico.resumoDoPaciente.hojeAs', {
    hora: formato.hora(appointment.inicio),
    tipo: clinico.tipo(appointment.typeId)?.nome ?? '',
    profissional: clinico.profissional(appointment.professionalId)?.nome ?? '',
  })
})

// ------------------------------------------------------------------ anamnese

function kg(valor: number): string {
  return formato.numero(valor, Number.isInteger(Math.round(valor * 100) / 10) ? 1 : 2)
}

/**
 * O parágrafo que entra na história da anamnese.
 *
 * Começa dizendo de onde veio — "do Diário Pet, registrado pelo responsável" — porque o vet vai
 * assinar em cima dele, e texto sem procedência vira afirmação da clínica. Só o que tem
 * alteração entra; "tudo normal" vira uma frase só.
 */
function historiaDoDiario(dados: ResumoDoPaciente): string {
  const diario = dados.diario

  if (diario.entradas.length === 0) {
    return ''
  }

  const linhas: string[] = []
  const nomeDoSintoma = (sintoma: string) =>
    t(`clinico.resumoDoPaciente.diario.sintoma.${sintoma}`).toLowerCase()

  for (const sinal of dados.sinais) {
    if (sinal.tipo === 'perda-de-peso') {
      linhas.push(
        t('clinico.resumoDoPaciente.anamnese.perda', {
          de: kg(sinal.variacao.deKg),
          para: kg(sinal.variacao.paraKg),
          percentual: formato.numero(sinal.variacao.percentual, 1),
          semanas: sinal.variacao.semanas,
        }),
      )
    }

    if (sinal.tipo === 'sintoma-de-alarme') {
      linhas.push(
        t('clinico.resumoDoPaciente.anamnese.alarme', {
          sintomas: sinal.sintomas.map(nomeDoSintoma).join(', '),
          data: formato.dataCurta(clinicClock.dateOf(sinal.em)),
          nota: sinal.nota,
        }),
      )
    }
  }

  if (diario.peso) {
    linhas.push(
      t('clinico.resumoDoPaciente.anamnese.pesoCasa', {
        de: kg(diario.peso.deKg),
        para: kg(diario.peso.paraKg),
      }),
    )
  }

  for (const campo of ['apetite', 'comportamento'] as const) {
    const contagem = diario[campo]

    if (contagem && contagem.alterados > 0) {
      linhas.push(
        t(`clinico.resumoDoPaciente.anamnese.${campo}`, {
          alterados: contagem.alterados,
          total: contagem.total,
        }),
      )
    }
  }

  const comuns = diario.sintomas.filter((item) => !item.alarme)

  if (comuns.length > 0) {
    linhas.push(
      t('clinico.resumoDoPaciente.anamnese.sintomas', {
        lista: comuns.map((item) => `${nomeDoSintoma(item.sintoma)} (${item.vezes}×)`).join(', '),
      }),
    )
  }

  const cabecalho = t('clinico.resumoDoPaciente.anamnese.cabecalho', {
    data: formato.dataCurta(clinicClock.dateOf(diario.desde)),
    total: diario.entradas.length,
  })

  if (linhas.length === 0) {
    return `${cabecalho} ${t('clinico.resumoDoPaciente.anamnese.semAlteracao')}`
  }

  return [cabecalho, ...linhas.map((linha) => `- ${linha}`)].join('\n')
}

/** Só acrescenta: campo que alguém já preencheu fica como está. */
function preencherAnamnese(atual: Anamnese, dados: ResumoDoPaciente): Partial<Anamnese> {
  const acrescimo: Partial<Anamnese> = {}
  const historia = historiaDoDiario(dados)

  if (historia && !atual.historia.trim()) {
    acrescimo.historia = historia
  }

  if (!atual.apetite && dados.diario.apetite) {
    acrescimo.apetite = dados.diario.apetite.ultimo
  }

  const jaListados = new Set(atual.antecedentes.map((item) => item.descricao.trim().toLowerCase()))
  const novos: Antecedente[] = []

  const acrescentar = (kind: Antecedente['kind'], descricao: string) => {
    if (descricao && !jaListados.has(descricao.trim().toLowerCase())) {
      jaListados.add(descricao.trim().toLowerCase())
      novos.push({ id: `ant-resumo-${novos.length + 1}`, kind, descricao, quando: '' })
    }
  }

  for (const medicacao of dados.medicacoes) {
    acrescentar(
      'medicacao-continua',
      medicacao.origem === 'continua'
        ? medicacao.descricao
        : t('clinico.resumoDoPaciente.anamnese.prescricao', {
            nome: clinico.medicamento(medicacao.medicamentoId)?.nome ?? medicacao.medicamentoId,
            data: medicacao.ate
              ? formato.dataCurta(clinicClock.dateOf(medicacao.ate))
              : t('clinico.resumoDoPaciente.essencial.usoContinuo'),
          }),
    )
  }

  for (const alerta of dados.alertas.filter((item) => item.kind === 'alergia')) {
    acrescentar('alergia', alerta.detalhe)
  }

  if (novos.length > 0) {
    acrescimo.antecedentes = [...atual.antecedentes, ...novos]
  }

  return acrescimo
}

async function abrirAtendimento() {
  const appointment = atendimentoDeHoje.value
  const dados = resumo.value

  if (!appointment || !dados || abrindo.value) {
    return
  }

  abrindo.value = true
  erroAoAbrir.value = ''

  const encounterId = await prontuario.abrirComAnamnese(appointment.id, (atual) =>
    preencherAnamnese(atual, dados),
  )

  abrindo.value = false

  if (!encounterId) {
    erroAoAbrir.value = t('clinico.resumoDoPaciente.erroAoAbrir')

    return
  }

  void router.push({
    path: `/veterinario/atendimento/${encounterId}`,
    query: { etapa: 'anamnese' },
  })
}

onMounted(carregar)
watch(petId, carregar)
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('clinico.resumoDoPaciente.titulo')"
    :title="pet?.nome ?? t('clinico.resumoDoPaciente.titulo')"
    :loading="carregando && !pet"
    :error="erro"
    :empty="!carregando && !erro && !pet"
    :empty-title="t('clinico.resumoDoPaciente.naoEncontrado')"
    block-when-suspended
    @retry="carregar"
  >
    <div v-if="pet && resumo" class="resumo clinic-scope">
      <div class="resumo__cabeca">
        <ClinicPatientHeader :pet="pet" :tutor="tutor" sem-alertas>
          <template #acoes>
            <Button
              v-if="atendimentoDeHoje"
              :label="t('clinico.resumoDoPaciente.abrirAtendimento')"
              icon="pi pi-file-edit"
              :loading="abrindo"
              @click="abrirAtendimento"
            />
            <Button
              :label="t('clinico.resumoDoPaciente.verHistorico')"
              icon="pi pi-history"
              severity="secondary"
              text
              size="small"
              @click="router.push(`/veterinario/paciente/${pet.id}/historico`)"
            />
          </template>
        </ClinicPatientHeader>

        <p v-if="linhaDeHoje" class="resumo__hoje">
          <i class="pi pi-calendar" aria-hidden="true" />
          {{ linhaDeHoje }}
          <span class="resumo__dica"
            >· {{ t('clinico.resumoDoPaciente.abrirAtendimentoDica') }}</span
          >
        </p>
        <p v-if="erroAoAbrir" class="resumo__erro" role="alert">{{ erroAoAbrir }}</p>
      </div>

      <ResumoSinais
        v-if="!resumo.primeiraVez || resumo.sinais.length > 0"
        :sinais="resumo.sinais"
      />

      <div class="resumo__corpo">
        <div class="resumo__principal">
          <ResumoPrimeiraConsulta v-if="resumo.primeiraVez" :pet="pet" />
          <ResumoEmCasa
            v-if="mostrarDiario"
            :diario="resumo.diario"
            :tem-consulta="!resumo.primeiraVez"
          />
          <ResumoPeso v-if="mostrarPeso" :peso="resumo.peso" :em-risco="perdaEmRisco" />
        </div>

        <ResumoEssencial :resumo="resumo" />
      </div>

      <div class="resumo__preferencia">
        <ToggleSwitch v-model="sugerirResumo" :input-id="idDaPreferencia" />
        <label :for="idDaPreferencia">{{ t('clinico.resumoDoPaciente.preferencia') }}</label>
      </div>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.resumo {
  display: grid;
  gap: var(--clinic-space-3);
}

.resumo__cabeca {
  display: grid;
  gap: var(--clinic-space-2);
}

.resumo__hoje {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin: 0;
  gap: var(--clinic-space-1) var(--clinic-space-2);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 600;
}

.resumo__hoje .pi {
  color: var(--clinic-faint);
}

.resumo__dica {
  color: var(--clinic-faint);
  font-weight: 500;
}

.resumo__erro {
  margin: 0;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.resumo__preferencia {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 600;
}

.resumo__preferencia label {
  cursor: pointer;
}

.resumo__corpo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  align-items: start;
  gap: var(--clinic-space-3);
}

.resumo__principal {
  display: grid;
  gap: var(--clinic-space-3);
  min-width: 0;
}

@media (max-width: 1100px) {
  .resumo__corpo {
    grid-template-columns: minmax(0, 1fr);
  }

  /* No estreito o essencial sobe: é mais curto e responde antes. */
  .resumo__corpo > :last-child {
    order: -1;
  }
}
</style>
