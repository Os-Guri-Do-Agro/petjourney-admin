<script setup lang="ts">
/**
 * A grade de ocupação (E7-02b, guia e7 28): uma linha por acomodação, um dia por coluna, numa
 * janela de 14 dias (a API aceita até 45, mas 14 é o que cabe e o que ela recomenda). As barras já
 * vêm cortadas nas bordas; `comecaAntes` e `terminaDepois` dizem que continuam fora da janela. Os
 * animais vêm uma vez só, no topo da resposta. O selo da documentação é pedido aqui (fora do
 * polling); a barra sem selo, quando a API cortou a avaliação, diz "sem avaliação", nunca "ok".
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  GRADE_DIAS,
  lerGrade,
  type BarraDaGrade,
  type Grade,
} from '@/service/parceiro/hotel-reservas-service'

import { useRotulosDasReservas } from './useRotulosDasReservas'

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const somar = (base: string, dias: number) => {
  const [a, m, d] = base.split('-').map(Number)
  return iso(new Date(a!, m! - 1, d! + dias))
}

const hoje = iso(new Date())
const de = ref(hoje)
const ate = computed(() => somar(de.value, GRADE_DIAS - 1))
const grade = ref<Grade | null>(null)
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    grade.value = await lerGrade(de.value, ate.value, true, parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('reservasDoHotel.grade.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())
watch(de, () => void carregar())

const dias = computed(() =>
  Array.from({ length: GRADE_DIAS }, (_, i) => {
    const data = somar(de.value, i)
    const [a, m, d] = data.split('-').map(Number)
    const instante = new Date(Date.UTC(a!, m! - 1, d!))
    return {
      data,
      semana: new Intl.DateTimeFormat(rotulos.intl(), { weekday: 'short', timeZone: 'UTC' }).format(
        instante,
      ),
      numero: d!,
      hoje: data === hoje,
    }
  }),
)

const nomes = computed(
  () => new Map((grade.value?.animais ?? []).map((a) => [a.pacienteId, a.nome])),
)

/** A posição no dia: a data do ISO (a parede da casa) mais a fração da hora. */
function posicao(instante: string) {
  const data = instante.slice(0, 10)
  const [a, m, d] = data.split('-').map(Number)
  const [a0, m0, d0] = de.value.split('-').map(Number)
  const diasDesde = Math.round(
    (Date.UTC(a!, m! - 1, d!) - Date.UTC(a0!, m0! - 1, d0!)) / 86_400_000,
  )
  const [h, min] = instante.slice(11, 16).split(':').map(Number)
  return diasDesde + ((h ?? 0) * 60 + (min ?? 0)) / 1440
}

function estilo(barra: BarraDaGrade) {
  const inicio = barra.comecaAntes ? 0 : Math.max(0, posicao(barra.inicio))
  const fim = barra.terminaDepois ? GRADE_DIAS : Math.min(GRADE_DIAS, posicao(barra.fim))
  return {
    insetInlineStart: `${(inicio / GRADE_DIAS) * 100}%`,
    inlineSize: `${(Math.max(0.35, fim - inicio) / GRADE_DIAS) * 100}%`,
  }
}

function rotulo(barra: BarraDaGrade) {
  return barra.animais
    .map((a) => nomes.value.get(a.pacienteId) ?? '')
    .filter(Boolean)
    .join(' e ')
}

function selo(barra: BarraDaGrade) {
  if (barra.status === 'HOSPEDADO') return ''
  if (!barra.selo) return grade.value?.seloTruncado ? t('reservasDoHotel.grade.semAvaliacao') : ''
  return barra.selo === 'OK' || barra.selo === 'DISPENSADO' ? '' : rotulos.situacao(barra.selo)
}

const barrasPorAcomodacao = computed(() => {
  const mapa = new Map<string, BarraDaGrade[]>()
  for (const barra of grade.value?.barras ?? []) {
    mapa.set(barra.acomodacaoId, [...(mapa.get(barra.acomodacaoId) ?? []), barra])
  }
  return mapa
})

const titulo = computed(() =>
  t('reservasDoHotel.grade.janela', { de: rotulos.dia(de.value), ate: rotulos.dia(ate.value) }),
)
</script>

<template>
  <section class="ui-folha ui-cartao gr" aria-labelledby="grade-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-calendar-blank" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="grade-titulo" class="ui-cartao__titulo">{{ titulo }}</h2>
        <p class="ui-cartao__descricao">{{ t('reservasDoHotel.grade.descricao') }}</p>
      </span>
      <span class="ui-cartao__acoes gr__navegar">
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-caret-left"
          :aria-label="t('reservasDoHotel.grade.anterior')"
          @click="de = somar(de, -7)"
        />
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('reservasDoHotel.grade.hoje')"
          :disabled="de === hoje"
          @click="de = hoje"
        />
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-caret-right"
          :aria-label="t('reservasDoHotel.grade.seguinte')"
          @click="de = somar(de, 7)"
        />
      </span>
    </header>

    <p v-if="erro" class="gr__nota gr__nota--erro" role="alert">{{ erro }}</p>
    <p v-if="grade?.truncado" class="gr__nota">{{ t('reservasDoHotel.grade.truncado') }}</p>
    <p v-if="grade && !grade.acomodacoes.length" class="gr__nota">
      {{ t('reservasDoHotel.grade.semAcomodacao') }}
    </p>

    <div v-else-if="grade" class="gr__rolagem">
      <div class="gr__tabela" :style="{ '--dias': GRADE_DIAS }">
        <div class="gr__linha gr__linha--cabeca">
          <span class="gr__nome" />
          <span class="gr__dias">
            <span
              v-for="dia in dias"
              :key="dia.data"
              class="gr__dia"
              :class="{ 'gr__dia--hoje': dia.hoje }"
            >
              <small>{{ dia.semana }}</small>
              <strong>{{ dia.numero }}</strong>
            </span>
          </span>
        </div>
        <div
          v-for="a in grade.acomodacoes"
          :key="a.acomodacaoId"
          class="gr__linha"
          :class="{ 'gr__linha--inativa': !a.ativa }"
        >
          <span class="gr__nome">{{ a.nome }}</span>
          <span class="gr__dias gr__trilho">
            <RouterLink
              v-for="barra in barrasPorAcomodacao.get(a.acomodacaoId) ?? []"
              :key="barra.reservaId"
              :to="`/hotel/reserva/${barra.reservaId}`"
              class="gr__barra"
              :class="[
                `gr__barra--${barra.status.toLowerCase()}`,
                {
                  'gr__barra--atrasada': barra.atrasada,
                  'gr__barra--corte-inicio': barra.comecaAntes,
                  'gr__barra--corte-fim': barra.terminaDepois,
                },
              ]"
              :style="estilo(barra)"
              :title="`${rotulo(barra)} · ${rotulos.status(barra.status)}${barra.atrasada ? ` · ${t('reservasDoHotel.grade.atrasada')}` : ''}`"
            >
              <i v-if="selo(barra)" class="ph ph-warning gr__alerta" aria-hidden="true" />
              <span class="gr__rotulo">{{ rotulo(barra) }}</span>
              <span v-if="selo(barra)" class="sr-only">{{ selo(barra) }}</span>
            </RouterLink>
          </span>
        </div>
      </div>
    </div>

    <p v-if="grade" class="gr__legenda">
      <span class="gr__chip gr__barra--pendente">{{ rotulos.status('PENDENTE') }}</span>
      <span class="gr__chip gr__barra--confirmada">{{ rotulos.status('CONFIRMADA') }}</span>
      <span class="gr__chip gr__barra--hospedado">{{ rotulos.status('HOSPEDADO') }}</span>
      <span class="gr__legenda-item"
        ><i class="ph ph-warning" aria-hidden="true" />
        {{ t('reservasDoHotel.grade.documentacao') }}</span
      >
    </p>
  </section>
</template>

<style scoped>
.gr__navegar {
  display: inline-flex;
  gap: 6px;
}

.gr__nota {
  margin: 0;
  padding: 4px 10px 12px;
  color: var(--tinta-2);
  font-size: 14px;
}

.gr__nota--erro {
  color: var(--risco-tinta);
}

.gr__rolagem {
  overflow-x: auto;
  scrollbar-width: thin;
}

.gr__tabela {
  display: grid;
  min-width: 46rem;
}

.gr__linha {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  align-items: center;
  min-height: 40px;
  border-top: 1px solid var(--linha);
}

.gr__linha--cabeca {
  border-top: none;
}

.gr__linha--inativa .gr__nome {
  color: var(--tinta-3);
}

.gr__nome {
  overflow: hidden;
  padding-inline: 10px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gr__dias {
  display: grid;
  grid-template-columns: repeat(var(--dias), minmax(0, 1fr));
}

.gr__dia {
  display: grid;
  justify-items: center;
  padding-block: 4px;
  color: var(--tinta-2);
  font-size: 11.5px;
}

.gr__dia strong {
  color: var(--tinta);
  font-size: 13px;
}

.gr__dia--hoje strong {
  color: var(--hotel-tinta, var(--tinta));
  text-decoration: underline;
  text-underline-offset: 3px;
}

.gr__trilho {
  position: relative;
  display: block;
  height: 30px;
}

.gr__barra {
  position: absolute;
  inset-block: 3px;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  padding-inline: 8px;
  border-radius: 8px;
  color: var(--tinta);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.gr__barra--pendente {
  border: 1px dashed var(--atencao-tinta);
  background: var(--atencao-fundo, var(--superficie-3));
}

.gr__barra--confirmada {
  background: var(--hotel-fundo, var(--superficie-3));
}

.gr__barra--hospedado {
  background: var(--ok-fundo, var(--superficie-3));
}

.gr__barra--atrasada {
  box-shadow: inset 0 0 0 2px var(--risco);
}

.gr__barra--corte-inicio {
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}

.gr__barra--corte-fim {
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}

.gr__rotulo {
  overflow: hidden;
  text-overflow: ellipsis;
}

.gr__alerta {
  color: var(--atencao-tinta);
}

.gr__legenda {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  margin: 0;
  padding: 12px 10px 4px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.gr__chip {
  padding: 2px 8px;
  border-radius: 6px;
  color: var(--tinta);
  font-weight: 600;
}

.gr__legenda-item i {
  color: var(--atencao-tinta);
}
</style>
