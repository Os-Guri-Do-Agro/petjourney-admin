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
import Button from 'primevue/button'
import { computed } from 'vue'
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
  <section v-if="itens.length > 0" class="legenda">
    <Button
      class="legenda__alternar"
      severity="secondary"
      text
      size="small"
      :icon="legendaAberta ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
      :label="t('clinico.agenda.legenda.titulo')"
      :badge="temFiltro ? String(agenda.filtroTipos.length) : undefined"
      :aria-expanded="legendaAberta"
      @click="alternarLegenda()"
    />

    <ul v-if="legendaAberta" class="legenda__lista">
      <li v-for="item in itens" :key="item.kind">
        <Button
          class="chave"
          :class="{ 'chave--ativa': item.ativo, 'chave--ausente': item.ausente }"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-pressed="item.ativo"
          :title="t('clinico.agenda.legenda.filtrar', { tipo: item.nome })"
          :style="{ '--chave-cor': item.cor }"
          @click="agenda.alternarFiltroTipo(item.kind)"
        >
          <!--
            Amostra e ícone juntos. A amostra sozinha seria a codificação por cor que o
            requisito proíbe; o ícone sozinho perderia o vínculo com a faixa do card.
          -->
          <span class="chave__amostra" aria-hidden="true">
            <i v-if="item.icone" :class="item.icone" />
          </span>
          <span class="chave__nome">{{ item.nome }}</span>
          <span v-if="!item.ausente" class="chave__contagem clinic-value">
            {{ item.contagem }}
          </span>
        </Button>
      </li>

      <li v-if="temFiltro">
        <Button
          link
          size="small"
          class="legenda__limpar"
          :label="t('clinico.agenda.limparFiltros')"
          @click="agenda.filtroTipos = []"
        />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.legenda {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2) var(--clinic-space-3);
}

/* Rótulo de seção, não ação principal: caixa alta e corpo de etiqueta, como os títulos do módulo. */
.legenda__alternar.p-button {
  gap: 0.3rem;
  padding-inline: var(--clinic-space-1);
  font-size: var(--clinic-font-label);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.legenda__alternar :deep(.p-button-icon) {
  font-size: 0.6rem;
}

.legenda__lista {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.chave.p-button {
  gap: 0.35rem;
  padding-block: 0.15rem;
  padding-inline: 0.25rem 0.5rem;
  border: 1px solid transparent;
  font-size: var(--clinic-font-label);
  font-weight: 400;
}

/*
 * Filtro ligado é estado, não ênfase: ganha contorno e fundo, e não só uma cor mais forte.
 * Quem olha a barra precisa ver que **há um filtro** antes de descobrir qual.
 * O seletor repete as classes do botão para vencer a regra de botão de texto do módulo.
 */
.chave--ativa.p-button.p-button-secondary.p-button-text,
.chave--ativa.p-button.p-button-secondary.p-button-text:not(:disabled):hover {
  border-color: color-mix(in srgb, var(--chave-cor) 60%, var(--clinic-line));
  background: color-mix(in srgb, var(--chave-cor) 16%, var(--clinic-surface));
  color: var(--clinic-text);
  font-weight: 700;
}

/* Tipo sem atendimento no dia: continua clicável, mas não disputa atenção. */
.chave--ausente.p-button {
  opacity: 0.45;
}

.chave__amostra {
  display: inline-grid;
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.35rem;
  background: color-mix(in srgb, var(--chave-cor) 24%, var(--clinic-surface));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--chave-cor) 70%, transparent);
  color: var(--chave-cor);
  font-size: 0.62rem;
}

.chave__nome {
  white-space: nowrap;
}

.chave__contagem {
  color: var(--clinic-faint);
  font-weight: 750;
}

.chave--ativa .chave__contagem {
  color: var(--clinic-muted);
}

.legenda__limpar.p-button {
  padding: 0.15rem 0.4rem;
  font-size: var(--clinic-font-label);
}
</style>
