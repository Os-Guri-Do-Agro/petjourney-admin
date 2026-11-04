<script setup lang="ts">
/**
 * A semana de relance: um dia por linha, com o horário escrito e uma régua de 0 h a 24 h com o
 * trecho em que a casa atende. A régua mostra o que o texto demora a dizer: o sábado mais curto, a
 * pausa do almoço, o domingo vazio, o dia de 24 horas. Hoje (no fuso da casa) vem marcado.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { HorarioDoDia } from '@/service/parceiro/estabelecimento-service'

import { ORDEM_DA_SEMANA, dataCivil, faixasDoDia, faixasEmMinutos, semanaCompleta } from './horario'

const props = defineProps<{
  horarios: HorarioDoDia[]
  /** Hoje no fuso da casa, `AAAA-MM-DD`. */
  hoje: string
}>()

const { t, locale } = useI18n()

const UM_DOMINGO = '2026-10-18'
const DIA_EM_MINUTOS = 24 * 60
const MARCAS = [0, 6, 12, 18, 24]

function nomeDoDia(diaSemana: number, formato: 'long' | 'short') {
  const data = dataCivil(UM_DOMINGO)
  data.setUTCDate(data.getUTCDate() + diaSemana)

  const nome = data
    .toLocaleDateString(INTL_LOCALE[locale.value as Locale], { weekday: formato, timeZone: 'UTC' })
    .replace(/\.$/, '')

  return nome.charAt(0).toLocaleUpperCase() + nome.slice(1)
}

const diaDeHoje = computed(() => dataCivil(props.hoje).getUTCDay())

const dias = computed(() => {
  const semana = semanaCompleta(props.horarios)

  return ORDEM_DA_SEMANA.map((diaSemana) => {
    const dia = semana.find((item) => item.diaSemana === diaSemana)!

    return {
      diaSemana,
      nome: nomeDoDia(diaSemana, 'long'),
      curto: nomeDoDia(diaSemana, 'short'),
      texto: faixasDoDia(dia).join(' · '),
      trechos: faixasEmMinutos(dia).map(([inicio, fim]) => ({
        inicio: `${(inicio / DIA_EM_MINUTOS) * 100}%`,
        largura: `${((fim - inicio) / DIA_EM_MINUTOS) * 100}%`,
      })),
      hoje: diaSemana === diaDeHoje.value,
    }
  })
})
</script>

<template>
  <div class="semana">
    <div class="semana__grade">
      <!-- As horas da régua, alinhadas com ela: a primeira coluna é a do nome do dia. -->
      <div class="semana__linha semana__linha--marcas" aria-hidden="true">
        <span />
        <span class="semana__marcas">
          <span
            v-for="hora in MARCAS"
            :key="hora"
            class="semana__marca ui-num"
            :style="{ insetInlineStart: `${(hora / 24) * 100}%` }"
            >{{ hora }}h</span
          >
        </span>
        <span />
      </div>

      <ul class="semana__dias">
        <li
          v-for="dia in dias"
          :key="dia.diaSemana"
          class="semana__linha"
          :class="{ 'semana__linha--hoje': dia.hoje, 'semana__linha--fechado': !dia.texto }"
        >
          <span class="semana__nome">
            <span class="semana__nome-longo">{{ dia.nome }}</span>
            <span class="semana__nome-curto" aria-hidden="true">{{ dia.curto }}</span>
            <span v-if="dia.hoje" class="semana__hoje">{{
              t('parceiro.estabelecimento.horario.hoje')
            }}</span>
          </span>
          <span class="semana__regua" aria-hidden="true">
            <span
              v-for="(trecho, indice) in dia.trechos"
              :key="indice"
              class="semana__trecho"
              :style="{ insetInlineStart: trecho.inicio, width: trecho.largura }"
            />
          </span>
          <!-- A hora corre da esquerda para a direita também no árabe: sem o bdi, 08:00–18:00 virava 18:00–08:00. -->
          <span class="semana__texto ui-num">
            <bdi v-if="dia.texto" dir="ltr">{{ dia.texto }}</bdi>
            <template v-else>{{ t('parceiro.estabelecimento.horario.fechado') }}</template>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.semana {
  container-type: inline-size;
}

/*
 * Nome, régua e texto em três colunas, as mesmas em todas as linhas (subgrid): o nome e o texto do
 * tamanho do maior, e a régua com todo o resto.
 */
.semana__grade {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) max-content;
  gap: 2px 20px;
}

.semana__dias {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  row-gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.semana__linha {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: center;
  min-height: 40px;
  padding: 0 10px;
  border-radius: 10px;
}

.semana__linha--marcas {
  min-height: 20px;
}

.semana__linha--hoje {
  background: var(--app-veu, var(--superficie-2));
}

.semana__nome {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 500;
}

.semana__linha--hoje .semana__nome {
  font-weight: 650;
}

.semana__nome-curto {
  display: none;
}

.semana__hoje {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--app-veu-forte, var(--superficie-3));
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 11.5px;
  font-weight: 650;
}

.semana__marcas,
.semana__regua {
  position: relative;
  display: block;
  height: 100%;
}

.semana__marca {
  position: absolute;
  top: 2px;
  color: var(--tinta-3);
  font-size: 11px;
  transform: translateX(-50%);
}

.semana__marca:first-child {
  transform: none;
}

.semana__marca:last-child {
  transform: translateX(-100%);
}

/*
 * RTL: a régua corre da direita para a esquerda, e o rótulo se ancora do outro lado. Sem
 * `:global()`: no CSS com escopo ele engoliria o resto do seletor.
 */
[dir='rtl'] .semana__marca {
  transform: translateX(50%);
}

[dir='rtl'] .semana__marca:first-child {
  transform: none;
}

[dir='rtl'] .semana__marca:last-child {
  transform: translateX(100%);
}

.semana__regua {
  height: 10px;
  border-radius: 999px;
  background: var(--app-veu-forte, var(--superficie-2));
}

.semana__trecho {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: 999px;
  background: var(--app-salvia, var(--musgo));
}

.semana__texto {
  color: var(--tinta);
  font-size: 13.5px;
  text-align: end;
  white-space: nowrap;
}

.semana__linha--fechado .semana__texto {
  color: var(--tinta-3);
}

/* Coluna estreita (tablet em pé com a gaveta aberta): nome curto e texto menor. */
@container (max-width: 520px) {
  .semana__grade {
    column-gap: 12px;
  }

  .semana__nome-longo {
    display: none;
  }

  .semana__nome-curto {
    display: inline;
  }

  .semana__hoje {
    display: none;
  }

  .semana__texto {
    font-size: 12.5px;
  }
}
</style>
