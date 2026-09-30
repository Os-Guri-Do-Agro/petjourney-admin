<script setup lang="ts">
/**
 * O cabeçalho da ficha do paciente, no molde da saudação da Visão geral.
 *
 * A mesma forma, com o conteúdo do paciente: a linha pequena de cima diz quem ele é (espécie, raça,
 * idade), o nome ocupa o lugar do "Olá", e a frase em degradê diz o estado **desta vista** — "V10
 * para hoje", "Nenhum atendimento ainda". Na mesma linha, as pílulas: a ação da página primeiro,
 * cheia quando é o próximo passo, e as outras duas vistas da ficha, com o número que faz alguém
 * clicar nelas (sinais do resumo, vacinas atrasadas) num selo dentro da própria pílula.
 *
 * Embaixo, o que o cabeçalho antigo do paciente mostrava e ninguém pode perder de vista: responsável
 * com telefone, peso e os alertas — risco primeiro, na cor da gravidade da Visão geral.
 *
 * Substitui o `ClinicPatientHeader` só nas três vistas da ficha. As outras telas (atendimento,
 * internação, drawer da agenda) continuam com ele.
 */
import {
  PhClockCounterClockwise,
  PhInfo,
  PhSyringe,
  PhTimer,
  PhWarning,
  PhWarningCircle,
} from '@phosphor-icons/vue'
import { computed, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useClinicFormat } from '../../../composables/useClinicFormat'
import { patientRepository, vacinaRepository } from '../../../data/repositories'
import type { AlertSeverity, Pet, Tutor } from '../../../data/types'
import { porteDoPaciente } from '../../../domain/porte'
import { montarResumoDoPaciente } from '../../../domain/resumo-do-paciente'

export type VistaDaFicha = 'resumo' | 'historico' | 'vacinas'

const props = withDefaults(
  defineProps<{
    pet: Pet
    tutor: Tutor | null
    atual: VistaDaFicha
    /** A frase de estado desta vista, em degradê. */
    frase: string
    /** Quando a vista não tem ação própria, qual das outras é o próximo passo (pílula cheia). */
    navCheia?: VistaDaFicha | null
    /** Peso em vigor, quando a vista sabe mais que o cadastro (o do atendimento de hoje). */
    pesoKg?: number | null
    /** O resumo lista os alertas no bloco Essencial: repeti-los aqui seria dizer duas vezes. */
    semAlertas?: boolean
  }>(),
  { navCheia: null, pesoKg: undefined, semAlertas: false },
)

const { t } = useI18n()
const formato = useClinicFormat()

// ------------------------------------------------------------------ quem é

const meta = computed(() => {
  const pet = props.pet
  const porte = porteDoPaciente(pet)

  return [
    formato.especie(pet.especie),
    pet.raca,
    porte ? t(`clinico.paciente.porte.${porte}`) : '',
    formato.idade(pet.nascimento),
    formato.sexo(pet.sexo),
    pet.castrado ? t('clinico.paciente.castrado') : t('clinico.paciente.inteiro'),
  ]
    .filter(Boolean)
    .join(' · ')
})

const peso = computed(() => (props.pesoKg === undefined ? props.pet.pesoKg : props.pesoKg))

const COR_DA_GRAVIDADE: Record<AlertSeverity, string> = {
  risco: 'coral',
  atencao: 'pessego',
  info: 'cinza',
}

const ICONE_DA_GRAVIDADE: Record<AlertSeverity, Component> = {
  risco: PhWarning,
  atencao: PhWarningCircle,
  info: PhInfo,
}

/** Alerta de risco primeiro: é o que muda conduta antes de a consulta começar. */
const alertas = computed(() => {
  if (props.semAlertas) {
    return []
  }

  const ordem = { risco: 0, atencao: 1, info: 2 } as const

  return [...props.pet.alertas].sort((a, b) => ordem[a.severidade] - ordem[b.severidade])
})

// ------------------------------------------------------------------ as outras vistas

/** Réptil e roedor não têm vacina no catálogo: sem vista de vacinas para eles. */
const temVacinas = computed(() =>
  vacinaRepository.catalogo().some((vacina) => vacina.especies.includes(props.pet.especie)),
)

const vacinasAtrasadas = ref(0)
const sinais = ref<{ total: number; risco: boolean } | null>(null)

async function conferir() {
  vacinasAtrasadas.value = temVacinas.value
    ? (vacinaRepository.plano(props.pet.id)?.atrasadas ?? 0)
    : 0

  /* Sem resumo, a pílula abre igual, só sem o selo: o cabeçalho não depende dele. */
  try {
    const fonte = await patientRepository.paraOResumo(props.pet.id)
    const resumo = montarResumoDoPaciente({ pet: props.pet, ...fonte })

    sinais.value = resumo.sinais.length
      ? {
          total: resumo.sinais.length,
          risco: resumo.sinais.some((sinal) => sinal.severidade === 'risco'),
        }
      : null
  } catch {
    sinais.value = null
  }
}

watch(() => props.pet.id, conferir, { immediate: true })

type Pilula = {
  vista: VistaDaFicha
  rotulo: string
  icone: Component
  selo: { valor: number; cor: string; aria: string } | null
}

const navegacao = computed<Pilula[]>(() => {
  const todas: Pilula[] = [
    {
      vista: 'resumo',
      rotulo: t('clinico.resumoDoPaciente.verResumo'),
      icone: PhTimer,
      selo: sinais.value
        ? {
            valor: sinais.value.total,
            cor: sinais.value.risco ? 'coral' : 'pessego',
            aria: t('clinico.resumoDoPaciente.verResumoComSinais', { total: sinais.value.total }),
          }
        : null,
    },
    {
      vista: 'historico',
      rotulo: t('clinico.prontuario.timeline.titulo'),
      icone: PhClockCounterClockwise,
      selo: null,
    },
    {
      vista: 'vacinas',
      rotulo: t('clinico.vacinas.titulo'),
      icone: PhSyringe,
      selo:
        vacinasAtrasadas.value > 0
          ? {
              valor: vacinasAtrasadas.value,
              cor: 'coral',
              aria: t(
                'clinico.vacinas.carteira.comAtraso',
                { total: vacinasAtrasadas.value },
                vacinasAtrasadas.value,
              ),
            }
          : null,
    },
  ]

  const outras = todas.filter(
    (pilula) => pilula.vista !== props.atual && (pilula.vista !== 'vacinas' || temVacinas.value),
  )

  /* A cheia vai na frente: é o próximo passo, e a Visão geral a põe sempre em primeiro. */
  return props.navCheia
    ? [
        ...outras.filter((pilula) => pilula.vista === props.navCheia),
        ...outras.filter((pilula) => pilula.vista !== props.navCheia),
      ]
    : outras
})

function destino(vista: VistaDaFicha): string {
  return `/veterinario/paciente/${props.pet.id}/${vista}`
}
</script>

<template>
  <div class="cabeca">
    <p class="cabeca__meta">{{ meta }}</p>
    <h1 class="cabeca__nome">{{ pet.nome }}</h1>

    <div class="cabeca__linha">
      <p class="cabeca__frase" aria-live="polite">{{ frase }}</p>

      <nav class="cabeca__acoes" :aria-label="t('clinico.ficha.acoes')">
        <slot name="acoes" />

        <RouterLink
          v-for="pilula in navegacao"
          :key="pilula.vista"
          class="ficha-pilula"
          :class="{ 'ficha-pilula--cheia': pilula.vista === navCheia }"
          :to="destino(pilula.vista)"
          :aria-label="pilula.selo ? pilula.selo.aria : undefined"
        >
          <component
            :is="pilula.icone"
            class="ficha-pilula__icone"
            :weight="pilula.vista === navCheia ? 'fill' : 'duotone'"
            aria-hidden="true"
          />
          {{ pilula.rotulo }}
          <span
            v-if="pilula.selo"
            class="ficha-pilula__selo"
            :class="`hc--${pilula.selo.cor}`"
            aria-hidden="true"
          >
            {{ pilula.selo.valor }}
          </span>
        </RouterLink>
      </nav>
    </div>

    <!--
      O que o cabeçalho do paciente sempre mostrou, sem caixa em volta: quem responde, o peso de
      que toda dose sai, e os alertas. Alerta é selo com ícone e palavra — a cor sozinha não diz.
    -->
    <ul class="cabeca__dados">
      <li v-if="tutor" class="cabeca__dado">
        <span class="cabeca__rotulo">{{ t('clinico.paciente.responsavel') }}</span>
        <strong>{{ tutor.nome }}</strong>
        <a class="cabeca__telefone" :href="`tel:${tutor.telefone}`">
          <bdi dir="ltr">{{ tutor.telefone }}</bdi>
        </a>
      </li>
      <li v-if="peso !== null" class="cabeca__dado">
        <span class="cabeca__rotulo">{{ t('clinico.ficha.peso') }}</span>
        <strong class="cabeca__valor">
          {{ formato.numero(peso, 1) }} {{ t('clinico.formato.kg') }}
        </strong>
      </li>
      <li v-for="alerta in alertas" :key="alerta.id" class="cabeca__dado">
        <span
          class="hc-selo cabeca__alerta"
          :class="`hc--${COR_DA_GRAVIDADE[alerta.severidade]}`"
          :title="alerta.detalhe || undefined"
        >
          <component
            :is="ICONE_DA_GRAVIDADE[alerta.severidade]"
            class="cabeca__alerta-icone"
            weight="fill"
            aria-hidden="true"
          />
          {{ formato.alerta(alerta.kind) }}
          <template v-if="alerta.detalhe"> · {{ alerta.detalhe }}</template>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.cabeca {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.cabeca__meta {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  font-weight: 500;
}

.cabeca__nome {
  margin: 0.35rem 0 0;
  color: var(--hc-tinta);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
}

/* A frase e as pílulas dividem a linha, como o resumo e as ações da Visão geral. */
.cabeca__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.25rem;
}

.cabeca__frase {
  margin: 0;
  background: var(--hc-degrade);
  background-clip: text;
  color: transparent;
  font-size: 1.75rem;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.025em;
  -webkit-text-fill-color: transparent;
}

.cabeca__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.cabeca__dados {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0.85rem 0 0;
  padding: 0;
  gap: 0.5rem 1.25rem;
  list-style: none;
}

.cabeca__dado {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  color: var(--hc-tinta);
  font-size: 0.875rem;
}

.cabeca__rotulo {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.cabeca__valor {
  font-variant-numeric: tabular-nums;
}

.cabeca__telefone {
  color: var(--hc-marca-forte);
  font-weight: 600;
  text-decoration: none;
}

.cabeca__telefone:hover,
.cabeca__telefone:focus-visible {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cabeca__alerta {
  gap: 0.3rem;
}

.cabeca__alerta-icone {
  flex-shrink: 0;
  width: 0.9rem;
  height: 0.9rem;
}
</style>
