<script setup lang="ts">
/**
 * Legenda dos tipos de atendimento.
 *
 * A grade colore o card pela **coluna** (o profissional, ou a sala) e marca o tipo na faixa da
 * esquerda mais um ícone. Sem esta legenda a faixa é decoração: sete pastéis que ninguém sabe
 * ler. Com ela, a grade fica decifrável de longe — que é como a recepção olha a agenda entre
 * um telefonema e outro.
 *
 * Três decisões que a fazem valer a altura que ocupa:
 *
 * - **Cor, ícone e nome, sempre juntos.** Cor localiza, ícone confirma, nome resolve. A cor
 *   nunca aparece sozinha aqui nem no card, e é isso que sustenta o "sem depender só de cor"
 *   do requisito — em escala de cinza a legenda continua inteira.
 * - **Só os tipos que existem no dia, com a contagem.** Listar os sete todo dia obrigaria a
 *   procurar; listando os presentes, a legenda vira também o resumo do dia ("18 consultas,
 *   1 cirurgia"). Quando um filtro está ligado, os ausentes reaparecem esmaecidos — senão a
 *   entrada que a pessoa acabou de clicar sumiria por baixo do próprio filtro.
 * - **Clicar filtra.** A legenda já é a lista de tipos do dia; obrigar a abrir outro painel
 *   para filtrar por tipo seria pedir duas vezes a mesma informação.
 */
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicPrefs } from '../../composables/useClinicPrefs'
import type { AppointmentTypeKind } from '../../data/types'
import { aparenciaDoTipo, TIPOS_EM_ORDEM } from '../../domain/appointment-kind'
import { ocupaHorario } from '../../domain/conflicts'
import { useAgendaStore } from '../../stores/agenda'
import { useClinicoStore } from '../../stores/clinico'

type ItemDaLegenda = {
  kind: AppointmentTypeKind
  nome: string
  icone: string
  cor: string
  contagem: number
  ativo: boolean
  /** Sem atendimento do tipo no dia: fica visível, mas apagado e sem contagem. */
  ausente: boolean
}

const { t } = useI18n()
const idDaLista = useId()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const { legendaAberta, alternarLegenda } = useClinicPrefs()

/**
 * Contagem por `kind`, sobre o dia **inteiro** — não sobre o recorte visível.
 *
 * Contar o que passou pelo filtro faria os números caírem para zero assim que alguém
 * filtrasse, e a legenda deixaria de responder "o que tem hoje" exatamente quando é mais
 * usada. Cancelado e falta ficam de fora da contagem porque não ocupam horário: o card segue
 * na grade riscado, mas contá-lo aqui inflaria o dia com atendimento que não aconteceu.
 */
const contagemPorTipo = computed(() => {
  const mapa = new Map<AppointmentTypeKind, number>()

  for (const appointment of agenda.atendimentos) {
    if (!ocupaHorario(appointment)) {
      continue
    }

    const kind = clinico.tipo(appointment.typeId)?.kind

    if (kind) {
      mapa.set(kind, (mapa.get(kind) ?? 0) + 1)
    }
  }

  return mapa
})

/** Nome do tipo vem do catálogo traduzido; a legenda não guarda texto próprio. */
function nomeDoTipo(kind: AppointmentTypeKind): string {
  return clinico.tipos.find((tipo) => tipo.kind === kind)?.nome ?? kind
}

const temFiltro = computed(() => agenda.filtroTipos.length > 0)

const itens = computed<ItemDaLegenda[]>(() =>
  TIPOS_EM_ORDEM.map((kind) => {
    const contagem = contagemPorTipo.value.get(kind) ?? 0
    const aparencia = aparenciaDoTipo(kind)

    return {
      kind,
      nome: nomeDoTipo(kind),
      icone: aparencia.icone,
      cor: aparencia.cor,
      contagem,
      ativo: agenda.filtroTipos.includes(kind),
      ausente: contagem === 0,
    }
  }).filter((item) => !item.ausente || temFiltro.value),
)
</script>

<template>
  <section v-if="itens.length > 0" class="legenda clinic-scope">
    <button
      type="button"
      class="legenda__alternar"
      :aria-expanded="legendaAberta"
      :aria-controls="idDaLista"
      @click="alternarLegenda()"
    >
      <i
        class="ph"
        :class="legendaAberta ? 'ph-caret-down' : 'ph-caret-right'"
        aria-hidden="true"
      />
      {{ t('clinico.agenda.legenda.titulo') }}
      <span v-if="temFiltro" class="ui-contagem legenda__contagem">
        {{ agenda.filtroTipos.length }}
      </span>
    </button>

    <ul v-if="legendaAberta" :id="idDaLista" class="legenda__lista">
      <li v-for="item in itens" :key="item.kind">
        <button
          type="button"
          class="chave"
          :class="{ 'chave--ativa': item.ativo, 'chave--ausente': item.ausente }"
          :aria-pressed="item.ativo"
          :title="t('clinico.agenda.legenda.filtrar', { tipo: item.nome })"
          :style="{ '--chave-cor': item.cor }"
          @click="agenda.alternarFiltroTipo(item.kind)"
        >
          <!--
            Amostra e ícone juntos: a cor sozinha seria a codificação que não se lê em escala de
            cinza; o ícone sozinho perderia o vínculo com o cartão.
          -->
          <span class="chave__amostra" aria-hidden="true">
            <i v-if="item.icone" :class="item.icone" />
          </span>
          <span class="chave__nome">{{ item.nome }}</span>
          <span v-if="!item.ausente" class="chave__contagem ui-num">{{ item.contagem }}</span>
        </button>
      </li>

      <li v-if="temFiltro">
        <button type="button" class="ui-mais legenda__limpar" @click="agenda.filtroTipos = []">
          <i class="ph ph-x" aria-hidden="true" />
          {{ t('clinico.agenda.limparFiltros') }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.legenda {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.legenda__alternar {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 12px 0 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.legenda__alternar:hover,
.legenda__alternar[aria-expanded='true'] {
  border-color: var(--linha-suave);
  background: var(--superficie-2);
  color: var(--tinta);
}

.legenda__alternar i {
  color: var(--tinta-3);
  font-size: 13px;
}

.legenda__contagem {
  height: 20px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
}

.legenda__lista {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chave {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 7px;
  padding: 0 12px 0 4px;
  border: 1px solid var(--linha);
  border-radius: 999px;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  transition:
    border-color var(--pj-tempo-curto) var(--pj-curva-chega),
    box-shadow var(--pj-tempo-curto) var(--pj-curva-chega);
}

.chave:hover {
  border-color: var(--linha-media);
  box-shadow: var(--sombra-1);
}

.legenda__alternar:focus-visible,
.chave:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 2px;
}

/*
 * Filtro ligado é estado, não ênfase: ganha contorno e fundo, e não só uma cor mais forte. Quem
 * olha a barra precisa ver que **há um filtro** antes de descobrir qual.
 */
.chave--ativa {
  border-color: var(--clinica);
  background: var(--clinica-fundo);
  font-weight: 600;
}

/* Tipo sem atendimento no dia: continua clicável, mas não disputa atenção. */
.chave--ausente {
  opacity: 0.5;
}

.chave__amostra {
  display: inline-grid;
  width: 24px;
  height: 24px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in oklab, var(--chave-cor) 22%, var(--superficie));
  color: var(--chave-cor);
  font-size: 13px;
}

.chave__nome {
  white-space: nowrap;
}

.chave__contagem {
  color: var(--tinta-3);
  font-size: 12.5px;
  font-weight: 600;
}

.chave--ativa .chave__contagem {
  color: var(--clinica-tinta);
}

.legenda__limpar {
  padding: 0 6px;
}
</style>
