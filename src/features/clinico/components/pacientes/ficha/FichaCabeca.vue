<script setup lang="ts">
/**
 * A capa da ficha do paciente — quem é, e as quatro vistas da ficha.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * 1. **Quem é** — o rosto grande, o nome e a linha espécie · raça · porte · idade · sexo ·
 *    castrado. Os alertas logo embaixo, como selo com palavra e ícone, risco primeiro: é o que
 *    muda a conduta antes de alguém tocar no animal.
 * 2. **Os dois dados que toda conduta usa** — o peso, em número grande (toda dose sai dele), e o
 *    responsável com o telefone que disca (`tel:`). Ficam à direita do nome em tela larga, como os
 *    números do Hoje; em tela estreita descem para baixo dele.
 * 3. **A ação da ficha** — o slot `acoes`, à direita da capa ("Abrir atendimento" quando há
 *    consulta hoje, "Aplicar vacina" na carteira). Uma cheia; o resto contornado.
 * 4. **As vistas** — Resumo | Histórico | Tratamento | Vacinas, como as abas de um destino
 *    (sublinhado na cor do lugar, contagem em pílula). Cada aba é um link de verdade. A contagem
 *    é a que faz alguém clicar: sinais do resumo, linhas do histórico, tratamento com a adesão
 *    em queda, vacina atrasada (ou para hoje).
 * 5. **A frase da vista** — logo abaixo das abas, o estado da vista aberta numa frase.
 *
 * Com `atual: null` (o paciente internado, `internacao/[id]`), a capa vem sem abas: a tela tem as
 * abas dela (checklist, evolução...) e duas fileiras de abas se confundiriam. As vistas da ficha
 * viram uma linha de saídas embaixo da frase.
 *
 * A API é a de antes: `navCheia` continua aceita, mas a aba já diz com a contagem qual vista
 * pede atenção — não há mais pílula cheia para escolher.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { useClinicFormat } from '../../../composables/useClinicFormat'
import {
  encounterRepository,
  patientRepository,
  tratamentoRepository,
  vacinaRepository,
} from '../../../data/repositories'
import type { AlertSeverity, Pet, PetAlert, Tutor } from '../../../data/types'
import { porteDoPaciente } from '../../../domain/porte'
import { montarResumoDoPaciente } from '../../../domain/resumo-do-paciente'
import { clinicClock, useClinicoStore } from '../../../stores/clinico'

import { contarHistorico } from './historico'

export type VistaDaFicha = 'resumo' | 'historico' | 'vacinas' | 'tratamento'

const props = withDefaults(
  defineProps<{
    pet: Pet
    tutor: Tutor | null
    /** A vista aberta: a aba acesa. `null` fora da ficha: sem abas, as vistas viram saídas. */
    atual: VistaDaFicha | null
    /** O estado desta vista numa frase, logo abaixo das abas. */
    frase: string
    /** Mantida por compatibilidade: a contagem da aba já aponta a vista que pede atenção. */
    navCheia?: VistaDaFicha | null
    /** Peso em vigor, quando a vista sabe mais que o cadastro (o peso de entrada da internação). */
    pesoKg?: number | null
    /** Esconde os alertas da capa (quem os mostra noutro lugar da mesma tela). */
    semAlertas?: boolean
  }>(),
  { navCheia: null, pesoKg: undefined, semAlertas: false },
)

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

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

/** Só dígitos (e o `+` do país): o discador do celular não entende parêntese. */
const telefoneDiscavel = computed(() => (props.tutor?.telefone ?? '').replace(/[^\d+]/g, ''))

const TOM_DO_ALERTA: Record<AlertSeverity, string> = {
  risco: 'risco',
  atencao: 'atencao',
  info: 'neutro',
}

const ICONE_DO_ALERTA: Record<AlertSeverity, string> = {
  risco: 'ph ph-warning',
  atencao: 'ph ph-warning-circle',
  info: 'ph ph-info',
}

/** Alerta de risco primeiro: é o que muda conduta antes de a consulta começar. */
const alertas = computed(() => {
  if (props.semAlertas) {
    return []
  }

  const ordem = { risco: 0, atencao: 1, info: 2 } as const

  return [...props.pet.alertas].sort((a, b) => ordem[a.severidade] - ordem[b.severidade])
})

function textoDoAlerta(alerta: PetAlert) {
  return alerta.detalhe
    ? `${formato.alerta(alerta.kind)}: ${alerta.detalhe}`
    : formato.alerta(alerta.kind)
}

// ------------------------------------------------------------------ as contagens das vistas

/** Réptil e roedor não têm vacina no catálogo: a aba existe, mas não tem atraso para contar. */
const temVacinas = computed(() =>
  vacinaRepository.catalogo().some((vacina) => vacina.especies.includes(props.pet.especie)),
)

const vacinas = ref({ atrasadas: 0, devidas: 0 })
const sinais = ref<{ total: number; risco: boolean } | null>(null)
const tratamentos = ref({ total: 0, alertas: 0 })
const noHistorico = ref<number | null>(null)

async function conferir() {
  const petId = props.pet.id
  const plano = temVacinas.value ? vacinaRepository.plano(petId) : null

  vacinas.value = { atrasadas: plano?.atrasadas ?? 0, devidas: plano?.devidas ?? 0 }
  tratamentos.value = tratamentoRepository.contagem(petId)

  /* Sem resumo ou sem histórico, a aba abre igual, só sem o número: a capa não depende deles. */
  const [resumo, linhas] = await Promise.all([
    patientRepository
      .paraOResumo(petId)
      .then((fonte) => montarResumoDoPaciente({ pet: props.pet, ...fonte }))
      .catch(() => null),
    Promise.all([encounterRepository.historico(petId), patientRepository.atendimentosDoPet(petId)])
      .then(([eventos, atendimentos]) =>
        contarHistorico(eventos, atendimentos, clinicClock.nowIso()),
      )
      .catch(() => null),
  ])

  /* Trocou de paciente no meio do caminho: a resposta é do anterior. */
  if (petId !== props.pet.id) {
    return
  }

  sinais.value = resumo?.sinais.length
    ? {
        total: resumo.sinais.length,
        risco: resumo.sinais.some((sinal) => sinal.severidade === 'risco'),
      }
    : null
  noHistorico.value = linhas
}

watch(() => props.pet.id, conferir, { immediate: true })

/* Uma dose marcada ou um contato registrado muda as contagens: a store avisa quando o mundo mudou. */
watch(() => clinico.revisao, conferir)

type Tom = 'neutro' | 'atencao' | 'risco'

type Vista = {
  vista: VistaDaFicha
  rotulo: string
  icone: string
  /** O número da pílula; nulo quando não há o que contar. */
  contagem: number | null
  tom: Tom
  /** O número em palavras, para o leitor de tela e a dica do ponteiro. */
  descricao: string
}

const vistas = computed<Vista[]>(() => {
  const { atrasadas, devidas } = vacinas.value
  const vacinaConta = atrasadas > 0 ? atrasadas : devidas > 0 ? devidas : null

  return [
    {
      vista: 'resumo',
      rotulo: t('clinico.ficha.abas.resumo'),
      icone: 'ph ph-timer',
      contagem: sinais.value?.total ?? null,
      tom: sinais.value?.risco ? 'risco' : 'atencao',
      descricao: sinais.value
        ? t('clinico.ficha.resumo.sinais', { total: sinais.value.total }, sinais.value.total)
        : '',
    },
    {
      vista: 'historico',
      rotulo: t('clinico.ficha.historico.titulo'),
      icone: 'ph ph-clock-counter-clockwise',
      contagem: noHistorico.value || null,
      tom: 'neutro',
      descricao: noHistorico.value
        ? t('clinico.ficha.abas.noHistorico', { total: noHistorico.value }, noHistorico.value)
        : '',
    },
    {
      vista: 'tratamento',
      rotulo: t('clinico.ficha.tratamento.pilula'),
      icone: 'ph ph-pill',
      contagem: tratamentos.value.alertas || null,
      tom: 'risco',
      descricao: tratamentos.value.alertas
        ? t(
            'clinico.ficha.tratamento.alertas',
            { total: tratamentos.value.alertas },
            tratamentos.value.alertas,
          )
        : '',
    },
    {
      vista: 'vacinas',
      rotulo: t('clinico.vacinas.titulo'),
      icone: 'ph ph-syringe',
      contagem: vacinaConta,
      tom: atrasadas > 0 ? 'risco' : 'atencao',
      descricao:
        atrasadas > 0
          ? t('clinico.ficha.vacinas.atrasadas', { total: atrasadas }, atrasadas)
          : devidas > 0
            ? t('clinico.ficha.vacinas.hojeVarias', { total: devidas }, devidas)
            : '',
    },
  ]
})

function destino(vista: VistaDaFicha): string {
  return `/veterinario/paciente/${props.pet.id}/${vista}`
}
</script>

<template>
  <div class="ficha-capa" :class="{ 'ficha-capa--solta': atual === null }">
    <div class="capa">
      <div class="capa__corpo">
        <div class="capa__linha">
          <!--
            O rosto ao lado do nome: quem está na recepção reconhece o animal antes de ler. Sem
            foto, o avatar desenhado (iniciais, silhueta da espécie e cor fixa) — o mesmo do hotel.
          -->
          <div class="capa__quem">
            <PetAvatar
              class="capa__rosto"
              :nome="pet.nome"
              :iniciais="pet.iniciais"
              :especie="pet.especie"
              :foto-url="pet.fotoUrl"
              tamanho="xl"
            />
            <div class="capa__identidade">
              <h1 class="capa__nome">{{ pet.nome }}</h1>
              <p class="capa__meta">{{ meta }}</p>
              <ul
                v-if="alertas.length"
                class="capa__alertas"
                :aria-label="t('clinico.resumoDoPaciente.essencial.alertas')"
              >
                <li
                  v-for="alerta in alertas"
                  :key="alerta.id"
                  class="ui-selo capa__alerta"
                  :class="`ui-selo--${TOM_DO_ALERTA[alerta.severidade]}`"
                >
                  <i :class="ICONE_DO_ALERTA[alerta.severidade]" aria-hidden="true" />
                  <span>{{ textoDoAlerta(alerta) }}</span>
                  <span class="sr-only">({{ formato.severidade(alerta.severidade) }})</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- O peso de que toda dose sai, e quem responde pelo animal, com o telefone que disca. -->
          <dl class="capa__dados">
            <div class="capa__dado">
              <dt>{{ t('clinico.ficha.peso') }}</dt>
              <dd v-if="peso !== null" class="capa__peso">
                <strong class="ui-num">{{ formato.numero(peso, 1) }}</strong>
                <span>{{ t('clinico.formato.kg') }}</span>
              </dd>
              <dd v-else class="capa__sem">{{ t('clinico.resumoDoPaciente.casa.semRegistro') }}</dd>
            </div>

            <div v-if="tutor" class="capa__dado">
              <dt>{{ t('clinico.paciente.responsavel') }}</dt>
              <dd class="capa__tutor">
                <strong>{{ tutor.nome }}</strong>
                <a
                  v-if="telefoneDiscavel"
                  class="capa__telefone ui-num"
                  :href="`tel:${telefoneDiscavel}`"
                  :aria-label="
                    t('clinico.ficha.capa.ligar', { nome: tutor.nome, telefone: tutor.telefone })
                  "
                >
                  <i class="ph ph-phone" aria-hidden="true" />
                  <bdi dir="ltr">{{ tutor.telefone }}</bdi>
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div v-if="$slots.acoes" class="capa__acoes">
        <slot name="acoes" />
      </div>
    </div>

    <!-- As quatro vistas da ficha, com o desenho das abas de um destino. -->
    <nav
      v-if="atual"
      class="capa__abas"
      :aria-label="t('clinico.ficha.abas.aria', { nome: pet.nome })"
    >
      <RouterLink
        v-for="item in vistas"
        :key="item.vista"
        class="capa__aba"
        :class="{ 'capa__aba--atual': item.vista === atual }"
        :to="destino(item.vista)"
        active-class=""
        exact-active-class=""
        :aria-current="item.vista === atual ? 'page' : undefined"
        :title="item.descricao || undefined"
      >
        <i :class="item.icone" aria-hidden="true" />
        <span>{{ item.rotulo }}</span>
        <span
          v-if="item.contagem"
          class="capa__selo ui-num"
          :class="`capa__selo--${item.tom}`"
          aria-hidden="true"
        >
          {{ item.contagem }}
        </span>
        <span v-if="item.descricao" class="sr-only">{{ item.descricao }}</span>
      </RouterLink>
    </nav>

    <p v-if="frase" class="capa__frase" aria-live="polite">{{ frase }}</p>

    <!-- Fora da ficha (o internado): as vistas viram saídas, numa linha só. -->
    <nav
      v-if="!atual"
      class="capa__saidas"
      :aria-label="t('clinico.ficha.abas.aria', { nome: pet.nome })"
    >
      <RouterLink
        v-for="item in vistas"
        :key="item.vista"
        class="capa__saida"
        :to="destino(item.vista)"
        :title="item.descricao || undefined"
      >
        <i :class="item.icone" aria-hidden="true" />
        <span>{{ item.rotulo }}</span>
        <span
          v-if="item.contagem"
          class="capa__selo ui-num"
          :class="`capa__selo--${item.tom}`"
          aria-hidden="true"
        >
          {{ item.contagem }}
        </span>
        <span v-if="item.descricao" class="sr-only">{{ item.descricao }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
/*
 * A capa decide a própria forma pela largura que tem, e não pela da janela: no internado ela
 * divide a linha com as ações da tela, e na ficha ocupa a largura toda.
 */
.ficha-capa {
  display: grid;
  min-width: 0;
  flex: 1 1 100%;
  container: ficha-capa / inline-size;
}

.capa {
  display: grid;
  align-items: start;
  gap: 16px 24px;
  grid-template-columns: minmax(0, 1fr) auto;
}

/*
 * Quem é, e os dois dados. Com espaço, os dados ficam à direita do nome, separados por um fio;
 * sem espaço, descem para baixo dele, alinhados com o texto — e o primeiro perde o fio, que à
 * esquerda de tudo não separaria nada.
 */
.capa__corpo {
  min-width: 0;
  container: capa-corpo / inline-size;
}

.capa__linha {
  display: grid;
  align-items: center;
  gap: 16px 32px;
  grid-template-columns: minmax(0, 1fr);
}

.capa__quem {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 18px;
}

.ficha-capa .capa__rosto {
  box-shadow:
    0 0 0 3px var(--fundo),
    0 0 0 4px var(--linha);
}

.capa__identidade {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.capa__nome {
  margin: 0;
  color: var(--tinta);
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.capa__meta {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.45;
}

.capa__alertas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

/* O detalhe do alerta pode ser longo ("Gabapentina 10 mg/kg, 12/12 h"): quebra, não corta. */
.capa__alerta.ui-selo {
  max-width: 100%;
  height: auto;
  min-height: 26px;
  padding-block: 4px;
  font-size: 13px;
  line-height: 1.3;
  white-space: normal;
}

/* ------------------------------------------------------------------ peso e responsável */

.capa__dados {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 12px 0;
  margin: 0;
  padding-inline-start: 90px;
}

.capa__dado {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 4px;
  padding-inline: 24px;
  border-inline-start: 1px solid var(--linha);
}

.capa__dado:first-child {
  padding-inline-start: 0;
  border-inline-start: 0;
}

@container capa-corpo (min-width: 800px) {
  .capa__linha {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .capa__dados {
    padding-inline-start: 0;
  }

  .capa__dado:first-child {
    padding-inline-start: 24px;
    border-inline-start: 1px solid var(--linha);
  }
}

.capa__dado dt {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.capa__dado dd {
  min-width: 0;
  margin: 0;
}

/* O número que importa, grande, como os minutos de espera do Hoje. */
.capa__peso {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--tinta-2);
  font-size: 14px;
}

.capa__peso strong {
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.capa__sem {
  color: var(--tinta-3);
  font-size: 14px;
  line-height: 2;
}

.capa__tutor {
  display: grid;
  gap: 2px;
}

.capa__tutor strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.capa__telefone {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 6px;
  min-height: 24px;
  border-radius: 6px;
  color: var(--pj-lugar-tinta, var(--musgo));
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.capa__telefone i {
  font-size: 15px;
}

.capa__telefone:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.capa__telefone:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.capa__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

/* ------------------------------------------------------------------ abas da ficha
 * O desenho das abas de um destino (`UiAbas`): sublinhado de 3 px na cor do lugar, contagem em
 * pílula. O ícone ajuda a achar a vista sem ler — as quatro têm nomes curtos e parecidos.
 */
.capa__abas {
  display: flex;
  gap: 4px;
  margin-top: 22px;
  overflow-x: auto;
  border-bottom: 1px solid var(--linha);
  scrollbar-width: none;
}

.capa__abas::-webkit-scrollbar {
  display: none;
}

.capa__aba {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  color: var(--tinta-2);
  font-size: 14.5px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}

.capa__aba:first-child {
  padding-inline-start: 2px;
}

.capa__aba i {
  font-size: 17px;
}

.capa__aba:hover {
  color: var(--tinta);
}

.capa__aba:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -4px;
}

.capa__aba--atual {
  color: var(--tinta);
  font-weight: 600;
}

.capa__aba--atual i {
  color: var(--pj-lugar-tinta, var(--musgo));
}

.capa__aba--atual::after {
  position: absolute;
  right: 14px;
  bottom: -1px;
  left: 14px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--pj-lugar, var(--musgo));
  content: '';
}

.capa__aba--atual:first-child::after {
  left: 2px;
}

[dir='rtl'] .capa__aba--atual:first-child::after {
  right: 2px;
  left: 14px;
}

.capa__selo {
  display: inline-grid;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  place-items: center;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 650;
}

.capa__selo--neutro {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.capa__selo--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.capa__selo--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

/* A frase da vista aberta: o "resumo" da tela, logo abaixo das abas. */
.capa__frase {
  max-width: 72ch;
  margin: 16px 0 0;
  color: var(--tinta-2);
  font-size: 15px;
  line-height: 1.45;
}

/* ------------------------------------------------------------------ fora da ficha */

.ficha-capa--solta .capa__frase {
  margin-top: 14px;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 550;
}

.capa__saidas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 18px;
  margin-top: 8px;
}

.capa__saida {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  color: var(--pj-lugar-tinta, var(--musgo));
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
}

.capa__saida i {
  font-size: 16px;
}

.capa__saida:hover span:not(.capa__selo) {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.capa__saida:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

/* ------------------------------------------------------------------ estreito */

/* Capa de largura média: a ação desce para baixo de quem é, em vez de espremer o nome. */
@container ficha-capa (max-width: 900px) {
  .capa {
    grid-template-columns: minmax(0, 1fr);
  }

  .capa__acoes {
    justify-content: flex-start;
  }
}

@container ficha-capa (max-width: 620px) {
  .ficha-capa .capa__rosto {
    width: 56px;
    height: 56px;
    font-size: 1.1rem;
  }

  .capa__quem {
    gap: 14px;
  }

  .capa__nome {
    font-size: 24px;
  }

  .capa__dados {
    padding-inline-start: 0;
  }

  .capa__peso strong {
    font-size: 24px;
  }

  /* As quatro abas cabem numa linha sem os ícones: a palavra é o que se lê. */
  .capa__aba {
    gap: 6px;
    padding-inline: 10px;
  }

  .capa__aba i {
    display: none;
  }

  .capa__aba--atual::after {
    right: 10px;
    left: 10px;
  }
}

/* No celular as quatro dividem a largura: a aba acesa nunca fica escondida fora da tela. */
@media (max-width: 480px) {
  .capa__abas {
    gap: 0;
  }

  .capa__aba,
  .capa__aba:first-child {
    flex: 1 1 auto;
    justify-content: center;
    gap: 4px;
    padding-inline: 4px;
    font-size: 13.5px;
  }

  .capa__aba--atual::after,
  .capa__aba--atual:first-child::after {
    right: 4px;
    left: 4px;
  }
}
</style>
