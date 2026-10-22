<script setup lang="ts">
/**
 * A agenda que o responsável vê: o mês num calendário, e os horários do dia tocado embaixo.
 *
 * O calendário diz de relance onde há vaga (o ponto), onde está cheio e onde a clínica fecha —
 * a fileira de catorze botões que existia antes escondia o fim do mês e obrigava a rolar de lado.
 *
 * Os três estados que o pedido do produto lista moram aqui, cada um com a saída dele:
 *
 * - **Clínica fechada** (domingo, feriado): o dia aparece riscado e, tocado, diz o nome do
 *   feriado — some com ele e a pessoa acha que o app quebrou na segunda-feira de feriado.
 * - **Sem horário disponível**: o atalho para o próximo dia que tem, e a troca para "pedir o melhor
 *   horário" sem perder o que já foi escolhido.
 * - **O horário que some**: alguém pegou primeiro. A lista é relida (o horário sumiu de verdade) e
 *   a frase diz o que aconteceu, em vez de um erro genérico.
 */
import { PhSun, PhSunHorizon } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../../composables/useClinicFormat'
import { useRotulosDoPedido } from '../../../composables/useRotulosDoPedido'
import type { OpcaoDeHorario } from '../../../contrato/responsavel'
import { periodoDe } from '../../../domain/pedidos'
import { clinicClock } from '../../../stores/clinico'

import CalendarioDoPedido from '../CalendarioDoPedido.vue'

import { useFluxo } from './fluxo-do-pedido'

const { t } = useI18n()
const fluxo = useFluxo()
const formato = useClinicFormat()
const rotulos = useRotulosDoPedido()

const qualquer = computed(() => fluxo.pedido.profissionalId === null)

/**
 * Com qualquer profissional, um botão por horário — o primeiro que tem. Três botões de 09:00, um
 * por veterinário, são uma escolha só para quem disse que tanto faz.
 */
const horariosDoDia = computed(() => {
  const todos = fluxo.diaAtual.value?.horarios ?? []

  if (!qualquer.value) {
    return todos
  }

  const vistos = new Set<string>()

  return todos.filter((opcao) => {
    if (vistos.has(opcao.inicio)) {
      return false
    }

    vistos.add(opcao.inicio)

    return true
  })
})

const periodos = computed(() => {
  const horarios = horariosDoDia.value

  return (['manha', 'tarde'] as const)
    .map((periodo) => ({
      periodo,
      horarios: horarios.filter(
        (opcao) => periodoDe(clinicClock.minutesOf(opcao.inicio)) === periodo,
      ),
    }))
    .filter((grupo) => grupo.horarios.length > 0)
})

const ICONE_DO_PERIODO = { manha: PhSunHorizon, tarde: PhSun } as const

const nenhumNoHorizonte = computed(
  () =>
    !fluxo.carregando.value &&
    fluxo.dias.value.length > 0 &&
    fluxo.dias.value.every((dia) => dia.situacao !== 'COM_HORARIO'),
)

/** Com dois pets, o botão diz os dois horários: "13:00 e 13:30". */
function rotuloDoHorario(opcao: OpcaoDeHorario) {
  return rotulos.nomes(opcao.porPet.map((trecho) => formato.hora(trecho.inicio)))
}

function primeiroNome(nome: string) {
  return nome.split(/\s+/)[0] ?? nome
}
</script>

<template>
  <div class="fx-etapa">
    <div class="fx-corpo">
      <p class="fx-linha fx-linha--suave">
        <i class="ph ph-user" aria-hidden="true" />
        {{
          qualquer ? t('clinico.pedidos.app.qualquerProfissional') : fluxo.profissional.value?.nome
        }}
        <template v-if="fluxo.pedido.petIds.length > 1">
          ·
          {{
            t('clinico.pedidos.app.seguidosPara', {
              nomes: rotulos.nomes(fluxo.petsEscolhidos.value.map((pet) => pet.nome)),
            })
          }}
        </template>
      </p>

      <!-- Alguém foi mais rápido. Dito como notícia, não como erro de sistema. -->
      <p
        v-if="fluxo.horarioSumiu.value"
        class="fx-linha fx-linha--atencao horario__aviso"
        role="alert"
      >
        <i class="ph ph-user-switch" aria-hidden="true" />
        {{
          t('clinico.pedidos.app.horarioSumiu', {
            hora: formato.hora(fluxo.horarioSumiu.value.inicio),
          })
        }}
      </p>
      <p
        v-else-if="fluxo.erro.value === 'RESERVA_EXPIRADA'"
        class="fx-linha fx-linha--atencao horario__aviso"
        role="alert"
      >
        <i class="ph ph-timer" aria-hidden="true" />
        {{ t('clinico.pedidos.app.reservaVenceu') }}
      </p>

      <CalendarioDoPedido
        v-model:dia="fluxo.pedido.dia"
        :min="fluxo.limitesDoCalendario.value.min"
        :max="fluxo.limitesDoCalendario.value.max"
        :situacoes="fluxo.situacoesDosDias.value"
        :rotulo="t('clinico.pedidos.app.dias')"
      />

      <p class="horario__legenda" aria-hidden="true">
        <span><span class="horario__ponto" />{{ t('clinico.pedidos.app.legenda.livre') }}</span>
        <span class="horario__legenda--fechado">{{
          t('clinico.pedidos.app.legenda.fechado')
        }}</span>
      </p>

      <p v-if="fluxo.carregando.value" class="fx-linha fx-linha--suave" role="status">
        <i class="ph ph-circle-notch ph-spin" aria-hidden="true" />
        {{ t('clinico.pedidos.app.procurando') }}
      </p>

      <template v-else-if="fluxo.diaAtual.value">
        <template v-if="fluxo.diaAtual.value.situacao === 'COM_HORARIO'">
          <p class="horario__dia">{{ rotulos.dia(fluxo.diaAtual.value.data) }}</p>
          <section v-for="grupo in periodos" :key="grupo.periodo" class="horario__periodo">
            <p class="fx-rotulo horario__rotulo">
              <component
                :is="ICONE_DO_PERIODO[grupo.periodo]"
                weight="duotone"
                aria-hidden="true"
              />
              {{ t(`clinico.pedidos.periodoTitulo.${grupo.periodo}`) }}
            </p>
            <div class="fx-horarios">
              <Button
                v-for="opcao in grupo.horarios"
                :key="`${opcao.profissional.id}|${opcao.inicio}`"
                class="fx-horario"
                :aria-label="`${rotuloDoHorario(opcao)}, ${opcao.profissional.nome}`"
                @click="fluxo.escolherHorario(opcao)"
              >
                <span class="fx-horario__hora">{{ rotuloDoHorario(opcao) }}</span>
                <span v-if="qualquer" class="fx-horario__quem">
                  {{ primeiroNome(opcao.profissional.nome) }}
                </span>
              </Button>
            </div>
          </section>
        </template>

        <!-- Fechada ou cheia: a frase, e as duas saídas. -->
        <section v-else class="fx-bloco">
          <p class="fx-linha">
            <i
              class="ph"
              :class="fluxo.diaAtual.value.situacao === 'FECHADA' ? 'ph-door' : 'ph-calendar-x'"
              aria-hidden="true"
            />
            <span v-if="fluxo.diaAtual.value.situacao === 'FECHADA'">
              {{
                fluxo.diaAtual.value.feriado
                  ? t('clinico.pedidos.app.fechadaFeriado', {
                      feriado: fluxo.diaAtual.value.feriado,
                    })
                  : t('clinico.pedidos.app.fechadaNoDia')
              }}
            </span>
            <span v-else>{{ t('clinico.pedidos.app.semHorarioNoDia') }}</span>
          </p>
          <Button
            v-if="fluxo.proximoDiaComHorario.value"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-arrow-right"
            icon-pos="right"
            :label="
              t('clinico.pedidos.app.irParaDia', {
                dia: rotulos.dia(fluxo.proximoDiaComHorario.value.data),
              })
            "
            @click="fluxo.pedido.dia = fluxo.proximoDiaComHorario.value!.data"
          />
        </section>
      </template>

      <p v-if="nenhumNoHorizonte" class="fx-ajuda">{{ t('clinico.pedidos.app.nadaNaQuinzena') }}</p>
    </div>

    <div v-if="fluxo.modos.value.includes('MELHOR_HORARIO')" class="fx-rodape">
      <Button
        severity="secondary"
        outlined
        icon="ph ph-hand-tap"
        :label="t('clinico.pedidos.app.trocarParaMelhor')"
        @click="fluxo.trocarParaMelhorHorario()"
      />
    </div>
  </div>
</template>

<style scoped>
.horario__aviso {
  font-weight: 650;
}

.horario__periodo {
  display: grid;
  gap: 0.4rem;
}

.horario__dia {
  margin: 4px 0 0;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.horario__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.horario__rotulo svg {
  width: 1rem;
  height: 1rem;
  color: var(--musgo);
}

.horario__legenda {
  display: flex;
  flex-wrap: wrap;
  margin: -0.25rem 0 0;
  gap: 0.9rem;
  color: var(--tinta-2);
  font-size: 13px;
}

.horario__legenda > span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.horario__ponto {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--musgo);
}

.horario__legenda--fechado {
  color: var(--tinta-3);
  text-decoration: line-through;
}
</style>
