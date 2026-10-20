<script setup lang="ts">
/**
 * A fita da casa: o dia do hotel numa faixa só, no alto de toda tela do Hotel.
 *
 * É a irmã da fita do dia da Clínica, com o relógio do canil: cada tarefa da rotina é um traço na
 * hora prevista, na cor da situação — feita, na janela, atrasada, por vir —, e as chegadas e
 * saídas do dia são marcas acima da régua. A agulha é agora.
 *
 * À direita, o que alguém pergunta ao chegar no turno: quantos estão na casa, quantos chegam,
 * quantos saem e quanto da rotina está atrasado.
 *
 * A fita lê o dia direto dos repositórios e relê quando qualquer tela muda algo
 * (`hotelStore.revisao`). Se não carregar, some sem levar a tela junto.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import {
  hospedagemRepository,
  reservaRepository,
  type HospedeNaCasa,
  type ReservaNaLista,
  type TarefaNaPrancheta,
} from '@/features/hotel/data/repositories'
import { situacaoDaTarefa } from '@/features/hotel/domain/rotina'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { hotelClock, useHotelStore } from '@/features/hotel/stores/hotel'

const { t, locale } = useI18n()
const formato = useHotelFormat()
const hotelStore = useHotelStore()

const hospedes = ref<HospedeNaCasa[]>([])
const tarefas = ref<TarefaNaPrancheta[]>([])
const reservasDeHoje = ref<ReservaNaLista[]>([])
const carregou = ref(false)
const agora = ref(hotelClock.now())

let relogio: ReturnType<typeof setInterval> | undefined

async function carregar() {
  const hoje = hotelClock.today()

  try {
    const [casa, rotina, reservas] = await Promise.all([
      hospedagemRepository.listar(),
      hospedagemRepository.rotina(hoje),
      reservaRepository.listar({ de: hoje, ate: hoje }),
    ])

    hospedes.value = casa
    tarefas.value = rotina
    reservasDeHoje.value = reservas
    carregou.value = true
  } catch {
    carregou.value = false
  }
}

onMounted(() => {
  void carregar()
  relogio = setInterval(() => {
    agora.value = hotelClock.now()
  }, 30_000)
})

onUnmounted(() => clearInterval(relogio))

watch(() => hotelStore.revisao, () => void carregar())

/** O dia do canil: das seis às vinte e duas, que é onde a rotina mora. */
const INICIO = 6 * 60
const FIM = 22 * 60

function posicao(minutos: number) {
  return Math.min(100, Math.max(0, ((minutos - INICIO) / (FIM - INICIO)) * 100))
}

const horas = computed(() => {
  const lista: { rotulo: string; x: number }[] = []

  for (let minuto = INICIO; minuto <= FIM; minuto += 120) {
    lista.push({ rotulo: String(minuto / 60).padStart(2, '0'), x: posicao(minuto) })
  }

  return lista
})

const agoraX = computed(() => posicao(agora.value.minutes))
const agoraTexto = computed(() => formato.hora(hotelClock.nowIso()))
const dentroDoDia = computed(() => agora.value.minutes >= INICIO && agora.value.minutes <= FIM)

const tracos = computed(() => {
  const instante = hotelClock.nowIso()

  return tarefas.value.map((item) => {
    const situacao = situacaoDaTarefa(item.tarefa, instante)

    return {
      id: item.tarefa.id,
      x: posicao(hotelClock.minutesOf(item.tarefa.previstaPara)),
      situacao,
      remedio: item.tarefa.kind === 'medicacao',
      titulo: t('hotel.fita.tarefa', {
        hora: formato.hora(item.tarefa.previstaPara),
        pet: item.petNome,
        tarefa: item.tarefa.descricao,
      }),
    }
  })
})

const chegam = computed(() =>
  reservasDeHoje.value.filter(
    (linha) =>
      linha.reserva.entradaPrevista.slice(0, 10) === hotelClock.today() &&
      (linha.reserva.status === 'confirmada' || linha.reserva.status === 'pendente'),
  ),
)

const saem = computed(() => hospedes.value.filter((hospede) => hospede.saiHoje))

const movimentos = computed(() => [
  ...chegam.value.map((linha) => ({
    id: `chega-${linha.reserva.id}`,
    tipo: 'chega' as const,
    x: posicao(hotelClock.minutesOf(linha.reserva.entradaPrevista)),
    titulo: t('hotel.fita.chega', {
      hora: formato.hora(linha.reserva.entradaPrevista),
      pet: linha.petNome,
    }),
  })),
  ...saem.value.map((hospede) => ({
    id: `sai-${hospede.hospedagem.id}`,
    tipo: 'sai' as const,
    x: posicao(hotelClock.minutesOf(hospede.hospedagem.saidaPrevistaEm)),
    titulo: t('hotel.fita.sai', {
      hora: formato.hora(hospede.hospedagem.saidaPrevistaEm),
      pet: hospede.petNome,
    }),
  })),
])

const atrasadas = computed(() => tracos.value.filter((traco) => traco.situacao === 'atrasada'))
const remedioAtrasado = computed(() => atrasadas.value.some((traco) => traco.remedio))

const resumoParaLeitor = computed(() =>
  t('hotel.fita.resumo', {
    feitas: tracos.value.filter((traco) => traco.situacao === 'feita').length,
    total: tracos.value.length,
    atrasadas: atrasadas.value.length,
  }),
)

const dataLonga = computed(() =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale.value as Locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${hotelClock.today()}T12:00:00Z`)),
)
</script>

<template>
  <section class="fita" :aria-label="t('hotel.fita.rotulo')">
    <div class="fita__hora">
      <strong>{{ agoraTexto }}</strong>
      <span>{{ dataLonga }}</span>
    </div>

    <RouterLink
      v-if="carregou"
      class="fita__regua"
      to="/hotel/rotina"
      :aria-label="resumoParaLeitor"
    >
      <span class="fita__passado" :style="{ width: `${agoraX}%` }" aria-hidden="true" />
      <span
        v-for="hora in horas"
        :key="hora.rotulo"
        class="fita__marca-hora"
        :style="{ left: `${hora.x}%` }"
        aria-hidden="true"
      >
        {{ hora.rotulo }}
      </span>
      <span class="fita__movimentos" aria-hidden="true">
        <i
          v-for="movimento in movimentos"
          :key="movimento.id"
          class="fita__movimento"
          :class="[
            `fita__movimento--${movimento.tipo}`,
            movimento.tipo === 'chega' ? 'ph ph-sign-in' : 'ph ph-sign-out',
          ]"
          :style="{ left: `${movimento.x}%` }"
          :title="movimento.titulo"
        />
      </span>
      <span class="fita__tracos" aria-hidden="true">
        <span
          v-for="traco in tracos"
          :key="traco.id"
          class="fita__traco"
          :class="[`fita__traco--${traco.situacao}`, { 'fita__traco--remedio': traco.remedio }]"
          :style="{ left: `${traco.x}%` }"
          :title="traco.titulo"
        />
      </span>
      <span
        v-if="dentroDoDia"
        class="fita__agulha"
        :style="{ left: `${agoraX}%` }"
        aria-hidden="true"
      />
    </RouterLink>
    <span v-else class="fita__regua" aria-hidden="true" />

    <nav class="fita__contas" :aria-label="t('hotel.fita.contas')">
      <RouterLink class="fita__conta" to="/hotel/hospedes">
        <span class="fita__ponto fita__ponto--casa" aria-hidden="true" />
        {{ t('hotel.fita.naCasa', { n: hospedes.length }, hospedes.length) }}
      </RouterLink>
      <RouterLink class="fita__conta" to="/hotel/painel">
        <i class="ph ph-sign-in" aria-hidden="true" />
        {{ t('hotel.fita.chegam', { n: chegam.length }, chegam.length) }}
      </RouterLink>
      <RouterLink class="fita__conta fita__conta--sai" to="/hotel/painel">
        <i class="ph ph-sign-out" aria-hidden="true" />
        {{ t('hotel.fita.saem', { n: saem.length }, saem.length) }}
      </RouterLink>
      <RouterLink
        v-if="atrasadas.length"
        class="fita__conta"
        :class="remedioAtrasado ? 'fita__conta--risco' : 'fita__conta--atencao'"
        to="/hotel/rotina"
      >
        <span class="fita__ponto" aria-hidden="true" />
        {{ t('hotel.fita.atrasadas', { n: atrasadas.length }, atrasadas.length) }}
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

.fita__hora span::first-letter {
  text-transform: uppercase;
}

.fita__regua {
  position: relative;
  display: block;
  height: 44px;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}

.fita__regua:focus-visible {
  outline: 2px solid var(--hotel);
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
  height: 28px;
  background: var(--linha);
  content: '';
}

/* Chegadas e saídas: o ícone em cima da régua, na hora prevista. */
.fita__movimentos {
  position: absolute;
  top: 15px;
  right: 0;
  left: 0;
  height: 14px;
}

.fita__movimento {
  position: absolute;
  font-size: 13px;
  transform: translateX(-50%);
}

.fita__movimento--chega {
  color: var(--ok);
}

.fita__movimento--sai {
  color: var(--hotel);
}

/* As tarefas: um traço curto por tarefa, empilhado pela densidade. */
.fita__tracos {
  position: absolute;
  right: 0;
  bottom: 3px;
  left: 0;
  height: 12px;
}

.fita__traco {
  position: absolute;
  bottom: 0;
  width: 3px;
  height: 12px;
  margin-left: -1.5px;
  border-radius: 2px;
  background: color-mix(in oklab, var(--hotel) 35%, transparent);
}

.fita__traco--feita,
.fita__traco--pulada,
.fita__traco--recusada {
  background: color-mix(in oklab, var(--tinta-3) 40%, transparent);
}

.fita__traco--na-janela {
  background: var(--hotel);
}

.fita__traco--atrasada {
  background: var(--atencao);
}

.fita__traco--atrasada.fita__traco--remedio {
  background: var(--risco);
}

.fita__agulha {
  position: absolute;
  top: 12px;
  bottom: -4px;
  width: 2px;
  margin-left: -1px;
  border-radius: 2px;
  background: var(--hotel-tinta);
}

.fita__agulha::before {
  position: absolute;
  top: -3px;
  left: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--hotel-tinta);
  content: '';
  transform: translateX(-50%);
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
}

.fita__conta:hover {
  border-color: var(--linha-media);
  background: var(--superficie-2);
}

.fita__conta:focus-visible {
  outline: 2px solid var(--hotel);
  outline-offset: 2px;
}

.fita__conta i {
  color: var(--ok);
  font-size: 15px;
}

.fita__conta--sai i {
  color: var(--hotel);
}

.fita__ponto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tinta-3);
}

.fita__ponto--casa {
  background: var(--hotel);
}

.fita__conta--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.fita__conta--atencao .fita__ponto {
  background: var(--atencao);
}

.fita__conta--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.fita__conta--risco .fita__ponto {
  background: var(--risco);
}

@media (max-width: 1240px) {
  .fita {
    gap: 16px;
    padding: 0 20px;
  }

  .fita__conta--sai {
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
