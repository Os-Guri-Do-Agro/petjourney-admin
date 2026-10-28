<script setup lang="ts">
/**
 * A capa da ficha do paciente — quem é, e as quatro vistas da ficha.
 *
 * ## A forma (acabamento de 20/10/2026)
 *
 * A capa é o **cartão de identidade** do paciente: uma folha só, que flutua sobre o fundo.
 *
 * 1. **Quem é** — o rosto grande (88 px, com o anel do lugar), o nome em 28 px e a linha
 *    espécie · raça · porte · idade · sexo · castrado. Os alertas logo embaixo, como selo com
 *    palavra e ícone, risco primeiro: é o que muda a conduta antes de alguém tocar no animal.
 * 2. **Os dois dados que toda conduta usa** — o peso (toda dose sai dele) e o responsável com o
 *    telefone que disca (`tel:`), cada um num bloco rente (`ui-poco`) com o ladrilho do assunto.
 *    Ficam à direita do nome em tela larga; em tela estreita descem para baixo dele.
 * 3. **As vistas** — Resumo | Histórico | Tratamento | Vacinas, no pé do cartão, como as abas de
 *    um destino (sublinhado na cor do lugar, contagem em pílula). Cada aba é um link de verdade.
 *    A contagem é a que faz alguém clicar: sinais do resumo, linhas do histórico, tratamento com
 *    a adesão em queda, vacina atrasada (ou para hoje).
 * 4. **A ação da ficha** — o slot `acoes`, na ponta direita da fileira das abas ("Abrir
 *    atendimento" quando há consulta hoje, "Aplicar vacina" na carteira). Uma cheia; o resto
 *    contornado. Em tela estreita sobe para cima das abas.
 * 5. **A frase da vista** — logo abaixo do cartão, o estado da vista aberta numa frase.
 *
 * Com `atual: null` (o prontuário, o paciente internado), as mesmas abas aparecem sem nenhuma
 * acesa — levam à vista da ficha — e as ações da tela continuam na ponta direita, como na ficha.
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
    /* Concorda com o sexo: "Fêmea · Castrada", nunca "Fêmea · Castrado". */
    t(`clinico.paciente.${pet.castrado ? 'castrad' : 'inteir'}${pet.sexo === 'femea' ? 'a' : 'o'}`),
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
    <div class="capa ui-folha">
      <div class="capa__corpo">
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
          <div class="capa__dado ui-poco">
            <dt>
              <span class="ui-ladrilho ui-ladrilho--p capa__dado-icone" aria-hidden="true">
                <i class="ph ph-scales" />
              </span>
              {{ t('clinico.ficha.peso') }}
            </dt>
            <dd v-if="peso !== null" class="capa__peso">
              <strong class="ui-num">{{ formato.numero(peso, 1) }}</strong>
              <span>{{ t('clinico.formato.kg') }}</span>
            </dd>
            <dd v-else class="capa__sem">{{ t('clinico.resumoDoPaciente.casa.semRegistro') }}</dd>
          </div>

          <div v-if="tutor" class="capa__dado capa__dado--tutor ui-poco">
            <dt>
              <span class="ui-ladrilho ui-ladrilho--p capa__dado-icone" aria-hidden="true">
                <i class="ph ph-user" />
              </span>
              {{ t('clinico.paciente.responsavel') }}
            </dt>
            <dd class="capa__tutor">
              <strong :title="tutor.nome">{{ tutor.nome }}</strong>
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

      <!-- O pé do cartão: as vistas da ficha à esquerda, a ação da vez na ponta direita. -->
      <div class="capa__barra">
        <!--
          As quatro vistas da ficha, com o desenho das abas de um destino. Fora da ficha (o
          prontuário, o internado) elas vêm iguais, só que nenhuma acesa: a ficha tem a mesma cara
          em todo lugar onde o paciente aparece, e as ações ficam na mesma ponta direita.
        -->
        <nav class="capa__abas" :aria-label="t('clinico.ficha.abas.aria', { nome: pet.nome })">
          <RouterLink
            v-for="item in vistas"
            :key="item.vista"
            class="capa__aba"
            :class="{ 'capa__aba--atual': atual !== null && item.vista === atual }"
            :to="destino(item.vista)"
            active-class=""
            exact-active-class=""
            :aria-current="atual !== null && item.vista === atual ? 'page' : undefined"
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

        <div v-if="$slots.acoes" class="capa__acoes">
          <slot name="acoes" />
        </div>
      </div>
    </div>

    <p v-if="frase" class="capa__frase" aria-live="polite">{{ frase }}</p>
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
  gap: 18px;
  container: ficha-capa / inline-size;
}

.capa {
  display: grid;
  min-width: 0;
}

/*
 * Quem é, e os dois dados. Com espaço, os dados ficam à direita do nome; sem espaço, descem
 * para baixo dele, alinhados com o texto.
 */
.capa__corpo {
  display: grid;
  min-width: 0;
  align-items: center;
  gap: 18px 32px;
  grid-template-columns: minmax(0, 1fr);
  padding: 24px 26px 22px;
}

.capa__quem {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 22px;
}

/* O rosto grande, com um anel na cor do lugar: é o retrato do cartão. */
.ficha-capa .capa__rosto {
  width: 88px;
  height: 88px;
  box-shadow:
    0 0 0 3px var(--superficie),
    0 0 0 5px color-mix(in oklab, var(--pj-lugar, var(--musgo)) 30%, var(--linha)),
    var(--sombra-1);
  font-size: 1.65rem;
}

.capa__identidade {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.capa__nome {
  margin: 0;
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.15;

  /* Quebra entre palavras; só parte a palavra que sozinha não cabe na linha. */
  overflow-wrap: break-word;
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
  margin: 8px 0 0;
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
  gap: 12px;
  margin: 0;
}

.capa__dado {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 74px;
  align-content: center;
  gap: 3px;

  /* Lógico, como o ícone (`inset-inline-start`): no árabe o ícone vai à direita e cobria o texto. */
  padding-block: 12px;
  padding-inline: 62px 24px;
}

.capa__dado--tutor {
  flex: 0 1 auto;
}

.capa__dado dt {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.capa__dado-icone {
  position: absolute;
  top: 50%;
  inset-inline-start: 16px;
  transform: translateY(-50%);
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
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.025em;
  line-height: 1.05;
}

.capa__sem {
  color: var(--tinta-3);
  font-size: 14px;
  line-height: 1.6;
}

.capa__tutor {
  display: grid;
  gap: 1px;
}

.capa__tutor strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.capa__telefone {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 6px;
  min-height: 22px;
  border-radius: 6px;
  color: var(--pj-lugar-tinta, var(--musgo));
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
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

/* ------------------------------------------------------------------ o pé do cartão */

/*
 * As abas embaixo à esquerda, as ações à direita, numa linha. Quando as ações não cabem ao lado
 * das abas (duas ações longas, como na internação), elas sobem para uma linha própria acima das
 * abas, alinhadas à direita — as abas continuam rentes à borda de baixo, inteiras.
 */
.capa__barra {
  display: flex;
  min-width: 0;
  min-height: 58px;
  flex-wrap: wrap-reverse;
  align-items: center;
  gap: 0 16px;
  padding: 0 20px 0 12px;
  border-top: 1px solid var(--linha-suave);
}

.capa__acoes {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-inline-start: auto;
  padding-block: 10px;
}

/* ------------------------------------------------------------------ abas da ficha
 * O desenho das abas de um destino (`UiAbas`): sublinhado de 3 px na cor do lugar, rente à borda
 * de baixo do cartão, contagem em pílula. O ícone ajuda a achar a vista sem ler — as quatro têm
 * nomes curtos e parecidos.
 */
.capa__abas {
  display: flex;
  max-width: 100%;
  min-width: 0;
  flex: 0 0 auto;
  align-self: stretch;
  gap: 2px;
  overflow-x: auto;
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
  min-height: 58px;
  padding: 0 14px;
  color: var(--tinta-2);
  font-size: 14.5px;
  font-weight: 550;
  text-decoration: none;
  white-space: nowrap;
  transition: color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.capa__aba i {
  color: var(--tinta-3);
  font-size: 18px;
  transition: color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.capa__aba:hover {
  color: var(--tinta);
}

.capa__aba:hover::after {
  position: absolute;
  right: 14px;
  bottom: 0;
  left: 14px;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--linha-media);
  content: '';
}

.capa__aba:focus-visible {
  border-radius: 10px;
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -8px;
}

.capa__aba--atual,
.capa__aba--atual:hover {
  color: var(--tinta);
  font-weight: 650;
}

.capa__aba--atual i {
  color: var(--pj-lugar-tinta, var(--musgo));
}

.capa__aba--atual::after,
.capa__aba--atual:hover::after {
  position: absolute;
  right: 14px;
  bottom: 0;
  left: 14px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--pj-lugar, var(--musgo));
  content: '';
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

/* A frase da vista aberta: o "resumo" da tela, logo abaixo do cartão. */
.capa__frase {
  max-width: 72ch;
  margin: 0;
  padding-inline: 4px;
  color: var(--tinta-2);
  font-size: 15px;
  line-height: 1.45;
}

/* ------------------------------------------------------------------ fora da ficha */

.ficha-capa--solta .capa__frase {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 550;
}

/* ------------------------------------------------------------------ larguras */

/* Com espaço, os dados vão para a direita de quem é. */
@container ficha-capa (min-width: 900px) {
  .capa__corpo {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .capa__dados {
    flex-wrap: nowrap;
    justify-content: flex-end;
  }

  /*
   * Responsável de nome comprido corta (o nome inteiro fica na dica): sem teto, a coluna dos
   * dados crescia até espremer o nome do paciente numa palavra por linha.
   */
  .capa__dado--tutor {
    max-width: 360px;
  }
}

/* Sem espaço, descem para baixo do nome, alinhados com o texto. */
@container ficha-capa (max-width: 899px) {
  .capa__dados {
    padding-inline-start: 110px;
  }
}

/*
 * Capa de largura média: a ação sobe para cima das abas, em vez de espremê-las. A ordem de
 * leitura continua a mesma (as vistas, depois a ação); só o desenho muda.
 */
@container ficha-capa (max-width: 760px) {
  .capa__barra {
    flex-direction: column-reverse;
    align-items: stretch;
    gap: 0;
    padding: 0 12px;
  }

  .capa__acoes {
    flex-wrap: wrap;
    justify-content: flex-start;
    margin-inline-start: 0;
    padding: 4px 6px 14px;
  }

  /* Botão que desce para a linha de baixo ocupa a largura: duas larguras soltas parecem erro. */
  .capa__acoes > :deep(*) {
    flex: 1 1 auto;
  }
}

@container ficha-capa (max-width: 620px) {
  .capa__corpo {
    padding: 18px 16px 16px;
  }

  .ficha-capa .capa__rosto {
    width: 64px;
    height: 64px;
    font-size: 1.2rem;
  }

  /*
   * O rosto ao lado do nome e da linha de dados; os alertas descem para a largura inteira do
   * cartão, embaixo dos dois — espremidos ao lado do rosto, quebravam em três linhas.
   */
  .capa__quem {
    display: grid;
    align-items: center;
    gap: 4px 16px;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .capa__identidade {
    display: contents;
  }

  .ficha-capa .capa__rosto {
    grid-row: 1 / span 2;
  }

  .capa__nome {
    align-self: end;
    font-size: 24px;
  }

  .capa__meta {
    align-self: start;
  }

  .capa__alertas {
    grid-column: 1 / -1;
    margin-top: 10px;
  }

  .capa__dados {
    display: grid;
    padding-inline-start: 0;
    grid-template-columns: minmax(0, auto) minmax(0, 1fr);
    gap: 8px;
  }

  .capa__dado {
    min-height: 64px;
    padding-block: 10px;
    padding-inline: 54px 14px;
  }

  .capa__dado-icone {
    inset-inline-start: 12px;
  }

  .capa__peso strong {
    font-size: 22px;
  }

  /* As quatro abas cabem numa linha sem os ícones: a palavra é o que se lê. */
  .capa__aba {
    gap: 6px;
    padding-inline: 10px;
  }

  .capa__aba i {
    display: none;
  }

  .capa__aba--atual::after,
  .capa__aba:hover::after {
    right: 10px;
    left: 10px;
  }
}

/* No celular as quatro dividem a largura: a aba acesa nunca fica escondida fora da tela. */
@media (max-width: 480px) {
  .capa__barra {
    padding-inline: 4px;
  }

  .capa__abas {
    gap: 0;
  }

  .capa__aba {
    min-height: 52px;
    flex: 1 1 auto;
    justify-content: center;
    gap: 4px;
    padding-inline: 4px;
    font-size: 13.5px;
  }

  .capa__aba--atual::after,
  .capa__aba:hover::after {
    right: 4px;
    left: 4px;
  }

  /* Os dois dados lado a lado, sem o ladrilho: a palavra em cima já diz o que é. */
  .capa__dado {
    min-height: 0;
    padding: 10px 14px;
  }

  .capa__dado-icone {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .capa__aba,
  .capa__aba i {
    transition: none;
  }
}
</style>
