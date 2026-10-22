<script setup lang="ts">
/**
 * A fita do dia: o expediente da clínica numa faixa só, no alto de toda tela da Clínica.
 *
 * Cada atendimento é um traço do tamanho da sua duração, na hora em que acontece, com a cor do
 * estado — feito, na sala, na recepção, por vir, falta. A agulha é agora. Quem passa os olhos
 * vê de uma vez o que já foi, quanto falta e onde o dia aperta, sem abrir a agenda.
 *
 * À direita, quantos estão na recepção, na sala e internados: as três perguntas que alguém faz
 * ao voltar para o balcão.
 *
 * A fita lê o dia **de hoje** direto do repositório, e não da agenda: a agenda pode estar em
 * outra data, e a fita é sempre hoje. Relê quando qualquer tela muda alguma coisa
 * (`clinico.revisao`).
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { agendaRepository, internacaoRepository } from '@/features/clinico/data/repositories'
import type { AgendaDia, Appointment, AppointmentStatus } from '@/features/clinico/data/types'
import { clockToMinutes } from '@/features/clinico/domain/clinic-time'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

const dia = ref<AgendaDia | null>(null)
const internados = ref(0)
const agora = ref(clinicClock.now())

let relogio: ReturnType<typeof setInterval> | undefined

async function carregar() {
  try {
    const [hoje, mapa] = await Promise.all([
      agendaRepository.obterDia(clinicClock.today()),
      internacaoRepository.mapa(),
    ])

    dia.value = hoje
    internados.value = mapa.ocupados
  } catch {
    /* A fita é contexto, não trabalho: se não carregar, some sem levar a tela junto. */
    dia.value = null
  }
}

onMounted(() => {
  void clinico.carregar()
  void carregar()
  relogio = setInterval(() => {
    agora.value = clinicClock.now()
  }, 30_000)
})

onUnmounted(() => clearInterval(relogio))

watch(() => clinico.revisao, () => void carregar())

/** O expediente arredondado para a hora cheia: a régua começa e termina em números redondos. */
const janela = computed(() => {
  const expediente = dia.value?.expediente
  const inicio = expediente ? clockToMinutes(expediente.inicio) : 8 * 60
  const fim = expediente ? clockToMinutes(expediente.fim) : 18 * 60

  return { inicio: Math.floor(inicio / 60) * 60, fim: Math.ceil(fim / 60) * 60 }
})

function posicao(minutos: number) {
  const { inicio, fim } = janela.value

  return Math.min(100, Math.max(0, ((minutos - inicio) / (fim - inicio)) * 100))
}

const horas = computed(() => {
  const lista: { rotulo: string; x: number }[] = []

  for (let minuto = janela.value.inicio; minuto <= janela.value.fim; minuto += 60) {
    lista.push({ rotulo: String(minuto / 60).padStart(2, '0'), x: posicao(minuto) })
  }

  return lista
})

const agoraX = computed(() => posicao(agora.value.minutes))
const agoraTexto = computed(() => formato.hora(clinicClock.nowIso()))
const dentroDoExpediente = computed(
  () => agora.value.minutes >= janela.value.inicio && agora.value.minutes <= janela.value.fim,
)

const almoco = computed(() => {
  const intervalo = dia.value?.almoco

  if (!intervalo) {
    return null
  }

  const x = posicao(clockToMinutes(intervalo.inicio))

  return { x, largura: posicao(clockToMinutes(intervalo.fim)) - x }
})

const ESTADOS_NA_FITA: AppointmentStatus[] = [
  'finalizado',
  'em-atendimento',
  'aguardando',
  'confirmado',
  'agendado',
  'falta',
]

const MAXIMO_DE_FAIXAS = 4

/**
 * Os traços, distribuídos em até quatro faixas: um atendimento vai para a primeira faixa que já
 * terminou antes de ele começar. Quando mais de quatro acontecem juntos, o excedente se sobrepõe
 * na última — a fita mostra densidade, e quem quer o detalhe abre a agenda.
 */
const tracos = computed(() => {
  const ordenados = (dia.value?.atendimentos ?? [])
    .filter((item) => ESTADOS_NA_FITA.includes(item.status))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))

  const fimDaFaixa: number[] = []

  return ordenados.map((item) => {
    const inicio = clinicClock.minutesOf(item.inicio)
    const fim = Math.max(inicio + 10, clinicClock.minutesOf(item.fim))
    let faixa = fimDaFaixa.findIndex((ocupadaAte) => ocupadaAte <= inicio)

    if (faixa === -1) {
      faixa = Math.min(fimDaFaixa.length, MAXIMO_DE_FAIXAS - 1)
    }

    fimDaFaixa[faixa] = fim

    const x = posicao(inicio)

    return {
      id: item.id,
      x,
      largura: Math.max(0.5, posicao(fim) - x),
      faixa,
      status: item.status,
      titulo: descricao(item),
    }
  })
})

function descricao(item: Appointment) {
  const pet = clinico.pet(item.petId)

  return t('clinico.fita.traco', {
    hora: formato.hora(item.inicio),
    pet: pet?.nome ?? '',
    estado: formato.status(item.status),
  })
}

/** Conta pacientes, não linhas: a cirurgia em duas salas é um animal só. */
function contar(status: AppointmentStatus) {
  const grupos = (dia.value?.atendimentos ?? [])
    .filter((item) => item.status === status)
    .map((item) => item.linkedGroupId ?? item.id)

  return new Set(grupos).size
}

const naRecepcao = computed(() => contar('aguardando'))
const naSala = computed(() => contar('em-atendimento'))
const restantes = computed(
  () =>
    (dia.value?.atendimentos ?? []).filter(
      (item) => item.status === 'agendado' || item.status === 'confirmado',
    ).length,
)

const resumoParaLeitor = computed(() =>
  t('clinico.fita.resumo', {
    feitos: contar('finalizado'),
    restantes: restantes.value,
    recepcao: naRecepcao.value,
  }),
)

const dataCurta = computed(() => formato.dataLonga(clinicClock.today()))
</script>

<template>
  <section class="fita" :aria-label="t('clinico.fita.rotulo')">
    <div class="fita__hora">
      <strong>{{ agoraTexto }}</strong>
      <span>{{ dataCurta }}</span>
    </div>

    <RouterLink
      v-if="dia && !dia.clinicaFechada"
      class="fita__regua"
      to="/clinica/agenda"
      :aria-label="resumoParaLeitor"
    >
      <span class="fita__passado" :style="{ width: `${agoraX}%` }" aria-hidden="true" />
      <span
        v-if="almoco"
        class="fita__almoco"
        :style="{ left: `${almoco.x}%`, width: `${almoco.largura}%` }"
        aria-hidden="true"
      />
      <span
        v-for="hora in horas"
        :key="hora.rotulo"
        class="fita__marca-hora"
        :style="{ left: `${hora.x}%` }"
        aria-hidden="true"
      >
        {{ hora.rotulo }}
      </span>
      <span class="fita__tracos" aria-hidden="true">
        <span
          v-for="traco in tracos"
          :key="traco.id"
          class="fita__traco"
          :class="`fita__traco--${traco.status}`"
          :style="{
            left: `${traco.x}%`,
            width: `${traco.largura}%`,
            top: `${traco.faixa * 6}px`,
          }"
          :title="traco.titulo"
        />
      </span>
      <span
        v-if="dentroDoExpediente"
        class="fita__agulha"
        :style="{ left: `${agoraX}%` }"
        aria-hidden="true"
      />
    </RouterLink>
    <p v-else-if="dia" class="fita__fechada">{{ t('clinico.fita.fechada') }}</p>
    <span v-else class="fita__regua fita__regua--vazia" aria-hidden="true" />

    <nav class="fita__contas" :aria-label="t('clinico.fita.contas')">
      <RouterLink class="fita__conta fita__conta--recepcao" to="/clinica/meu-dia">
        <span class="fita__ponto" aria-hidden="true" />
        {{ t('clinico.fita.recepcao', { n: naRecepcao }, naRecepcao) }}
      </RouterLink>
      <RouterLink class="fita__conta fita__conta--sala" to="/clinica/meu-dia">
        <span class="fita__ponto" aria-hidden="true" />
        {{ t('clinico.fita.sala', { n: naSala }, naSala) }}
      </RouterLink>
      <RouterLink class="fita__conta fita__conta--internados" to="/clinica/internacao">
        <span class="fita__ponto" aria-hidden="true" />
        {{ t('clinico.fita.internados', { n: internados }, internados) }}
      </RouterLink>
    </nav>
  </section>
</template>

<style scoped>
.fita {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 28px;
  min-height: 66px;
  padding: 0 28px 0 36px;
  border-bottom: 1px solid var(--linha);
  background: color-mix(in oklab, var(--superficie) 82%, transparent);
  backdrop-filter: blur(12px);
}

.fita__hora {
  display: grid;
  line-height: 1.15;
}

.fita__hora strong {
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 20px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.fita__hora span {
  color: var(--tinta-3);
  font-size: 12px;
  white-space: nowrap;
}

/* A régua: horas em cima, traços embaixo, o passado num tom mais fundo. */
.fita__regua {
  position: relative;
  display: block;
  height: 42px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}

.fita__regua:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 3px;
}

.fita__regua::before {
  position: absolute;
  top: 16px;
  right: 0;
  bottom: 0;
  left: 0;
  border-radius: 8px;
  background: var(--superficie-2);
  box-shadow: inset 0 0 0 1px var(--linha-suave);
  content: '';
}

.fita__passado {
  position: absolute;
  top: 16px;
  bottom: 0;
  left: 0;
  border-radius: 8px 0 0 8px;
  background: color-mix(in oklab, var(--superficie-3) 80%, transparent);
}

.fita__almoco {
  position: absolute;
  top: 16px;
  bottom: 0;
  background: repeating-linear-gradient(
    -45deg,
    transparent 0 3px,
    color-mix(in oklab, var(--linha-forte) 22%, transparent) 3px 4px
  );
}

.fita__marca-hora {
  position: absolute;
  top: 0;
  color: var(--tinta-3);
  font-family: var(--font-dados);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 12px;
  transform: translateX(-50%);
}

.fita__marca-hora::after {
  position: absolute;
  top: 16px;
  left: 50%;
  width: 1px;
  height: 26px;
  background: color-mix(in oklab, var(--linha) 70%, transparent);
  content: '';
}

.fita__tracos {
  position: absolute;
  top: 19px;
  right: 0;
  left: 0;
  height: 24px;
}

.fita__traco {
  position: absolute;
  height: 4px;
  min-width: 4px;
  border-radius: 999px;
  background: var(--clinica);
}

.fita__traco--finalizado {
  background: color-mix(in oklab, var(--tinta-3) 45%, transparent);
}

.fita__traco--em-atendimento {
  background: var(--clinica);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--clinica) 25%, transparent);
}

.fita__traco--aguardando {
  background: var(--atencao);
}

.fita__traco--confirmado {
  background: color-mix(in oklab, var(--clinica) 60%, transparent);
}

.fita__traco--agendado {
  background: color-mix(in oklab, var(--clinica) 30%, transparent);
}

.fita__traco--falta {
  background: var(--risco);
}

.fita__agulha {
  position: absolute;
  top: 12px;
  bottom: -4px;
  width: 2px;
  margin-left: -1px;
  border-radius: 2px;
  background: var(--clinica-tinta);
}

.fita__agulha::before {
  position: absolute;
  top: -3px;
  left: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--clinica-tinta);
  content: '';
  transform: translateX(-50%);
}

.fita__fechada {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.fita__contas {
  display: flex;
  gap: 6px;
}

.fita__conta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px 0 12px;
  border: 1px solid var(--linha);
  border-radius: 999px;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--tinta);
  font-size: 13px;
  font-weight: 550;
  text-decoration: none;
  white-space: nowrap;
  transition:
    border-color var(--pj-tempo-curto) var(--pj-curva-chega),
    background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.fita__conta:hover {
  border-color: var(--linha-media);
  background: var(--superficie-2);
}

.fita__conta:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 2px;
}

.fita__ponto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tinta-3);
}

.fita__conta--recepcao .fita__ponto {
  background: var(--atencao);
}

.fita__conta--sala .fita__ponto {
  background: var(--clinica);
}

.fita__conta--internados .fita__ponto {
  background: var(--pets);
}

@media (max-width: 1180px) {
  .fita {
    gap: 16px;
    padding: 0 20px;
  }

  .fita__conta--internados {
    display: none;
  }
}

@media (max-width: 900px) {
  .fita {
    grid-template-columns: auto 1fr;
    min-height: 52px;
    padding: 0 16px;
  }

  .fita__regua {
    display: none;
  }

  .fita__contas {
    justify-content: flex-end;
    overflow-x: auto;
  }

  .fita__hora span {
    display: none;
  }
}
</style>
