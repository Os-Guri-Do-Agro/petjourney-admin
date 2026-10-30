<script setup lang="ts">
/**
 * As exigências de admissão de uma reserva — a regra R1 na tela, como lista de checagem.
 *
 * Uma linha por comprovante, e cada linha diz **três** coisas: o que é, qual é a situação e o que
 * fazer a respeito. O círculo à esquerda é o visto da lista (verde quando está em dia, âmbar
 * quando vence no meio da estadia, vermelho quando impede a entrada), o selo diz a mesma coisa em
 * palavra, e a ação de resolver mora na própria linha — uma lista de documentos vencidos sem ação
 * ao lado obriga quem lê a descobrir sozinho onde se registra o papel, e, na prática, a registrar
 * fora do sistema.
 *
 * A dispensa é uma ação de segunda classe de propósito: fica atrás de um botão discreto e exige
 * motivo. O que a mantém rara não é escondê-la, é ter de escrever por quê.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useHotelFormat } from '../../composables/useHotelFormat'
import type { AvaliacaoDeAdmissao, ExigenciaAvaliada } from '../../domain/admissao'
import type { ExigenciaKind } from '../../data/types'

const props = withDefaults(
  defineProps<{
    admissao: AvaliacaoDeAdmissao
    /** Sem ações: a lista vira leitura, no resumo do check-in e no histórico. */
    somenteLeitura?: boolean
  }>(),
  { somenteLeitura: false },
)

const emit = defineEmits<{
  registrar: [kind: ExigenciaKind]
  dispensar: [kind: ExigenciaKind]
}>()

const { t } = useI18n()
const formato = useHotelFormat()

/**
 * A ordem é a da urgência, não a do catálogo.
 *
 * Quem abre esta lista na véspera quer os problemas primeiro. Ordenar pelo cadastro faria a
 * antirrábica ausente aparecer no meio de seis linhas verdes.
 */
const ORDEM: Record<ExigenciaAvaliada['situacao'], number> = {
  ausente: 0,
  vencido: 1,
  'vence-durante': 2,
  dispensado: 3,
  ok: 4,
}

const itens = computed(() =>
  [...props.admissao.itens].sort((um, outro) => ORDEM[um.situacao] - ORDEM[outro.situacao]),
)

const resolvidos = computed(
  () => props.admissao.itens.filter((item) => item.situacao === 'ok' || item.situacao === 'dispensado').length,
)

/** O tom de cada linha: o que impede é risco; o que avisa é atenção; o resto, em dia. */
function tomDe(item: ExigenciaAvaliada): 'risco' | 'atencao' | 'ok' | 'neutro' {
  if (item.situacao === 'ok') {
    return 'ok'
  }

  if (item.situacao === 'dispensado') {
    return 'neutro'
  }

  if (item.situacao === 'vence-durante' || !item.bloqueia) {
    return 'atencao'
  }

  return 'risco'
}

const ICONE: Record<ReturnType<typeof tomDe>, string> = {
  ok: 'ph-check',
  neutro: 'ph-seal-check',
  atencao: 'ph-exclamation-mark',
  risco: 'ph-x',
}

function detalhe(item: ExigenciaAvaliada): string {
  if (item.situacao === 'dispensado') {
    return t('hotel.exigencias.dispensadaPor', { nome: item.dispensa?.autorizadaPor ?? '' })
  }

  if (item.situacao === 'ausente') {
    return t('hotel.exigencias.semComprovante')
  }

  if (!item.comprovante?.validoAte) {
    return t('hotel.exigencias.apresentadoEm', {
      data: formato.data(item.comprovante?.apresentadoEm ?? ''),
    })
  }

  if (item.situacao === 'vence-durante') {
    const dias = Math.abs(item.diasDeFolga ?? 0)

    return t(
      'hotel.exigencias.venceDurante',
      { data: formato.validade(item.comprovante.validoAte), dias },
      dias,
    )
  }

  return t('hotel.exigencias.valeAte', { data: formato.validade(item.comprovante.validoAte) })
}
</script>

<template>
  <section class="exig">
    <!--
      O veredito vem antes da lista: quem abre a reserva na véspera quer saber se vai dar problema,
      e só depois quais. Sem ele, a resposta exige ler oito linhas.
    -->
    <div class="exig__cabeca">
      <p
        v-if="admissao.impedimentos.length > 0"
        class="exig__resumo exig__resumo--risco"
        role="alert"
      >
        <i class="ph ph-prohibit" aria-hidden="true" />
        {{
          t(
            'hotel.exigencias.bloqueado',
            { total: admissao.impedimentos.length },
            admissao.impedimentos.length,
          )
        }}
      </p>

      <p v-else-if="admissao.avisos.length > 0" class="exig__resumo exig__resumo--atencao">
        <i class="ph ph-warning" aria-hidden="true" />
        {{
          t('hotel.exigencias.comAviso', { total: admissao.avisos.length }, admissao.avisos.length)
        }}
      </p>

      <p v-else class="exig__resumo exig__resumo--ok">
        <i class="ph ph-check-circle" aria-hidden="true" />
        {{ t('hotel.exigencias.tudoEmDia') }}
      </p>

      <span v-if="admissao.itens.length > 0" class="exig__progresso">
        <span class="ui-num">
          {{ t('hotel.reserva.tela.emDia', { ok: resolvidos, total: admissao.itens.length }) }}
        </span>
        <span class="exig__barra" aria-hidden="true">
          <span :style="{ width: `${Math.round((resolvidos / admissao.itens.length) * 100)}%` }" />
        </span>
      </span>
    </div>

    <ul class="exig__lista">
      <li
        v-for="item in itens"
        :key="item.kind"
        class="exig__linha"
        :class="[`exig__linha--${tomDe(item)}`, { 'ui-marca ui-marca--risco': tomDe(item) === 'risco' }]"
      >
        <span class="exig__visto" :class="`exig__visto--${tomDe(item)}`" aria-hidden="true">
          <i class="ph" :class="ICONE[tomDe(item)]" />
        </span>

        <div class="exig__texto">
          <strong>{{ formato.exigencia(item.kind) }}</strong>
          <span class="exig__detalhe">{{ detalhe(item) }}</span>
        </div>

        <span class="ui-selo exig__selo" :class="`ui-selo--${tomDe(item)}`">
          {{ formato.situacaoDaExigencia(item.situacao) }}
        </span>

        <div
          v-if="!somenteLeitura && item.situacao !== 'ok' && item.situacao !== 'dispensado'"
          class="exig__acoes"
        >
          <Button
            :label="t('hotel.exigencias.registrar')"
            icon="ph ph-file-plus"
            severity="secondary"
            outlined
            size="small"
            @click="emit('registrar', item.kind)"
          />

          <!--
            Dispensar só aparece onde faz sentido: no que bloqueia. Oferecê-la ao lado de um
            documento em dia é convidar ao clique errado.
          -->
          <Button
            v-if="item.bloqueia && (item.situacao === 'ausente' || item.situacao === 'vencido')"
            :label="t('hotel.exigencias.dispensar')"
            severity="secondary"
            outlined
            size="small"
            @click="emit('dispensar', item.kind)"
          />
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.exig {
  display: grid;
  container-type: inline-size;
}

/* ------------------------------------------------------------------ o veredito */

.exig__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--linha);
}

.exig__resumo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
}

.exig__resumo i {
  font-size: 19px;
}

.exig__resumo--risco {
  color: var(--risco-tinta);
}

.exig__resumo--atencao {
  color: var(--atencao-tinta);
}

.exig__resumo--ok {
  color: var(--ok-tinta);
}

.exig__progresso {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13px;
  white-space: nowrap;
}

.exig__barra {
  display: block;
  width: 64px;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--superficie-3);
}

.exig__barra span {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--ok);
}

/* ------------------------------------------------------------------ a lista */

.exig__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.exig__linha {
  position: relative;
  display: grid;
  min-height: 60px;
  align-items: center;
  gap: 8px 14px;
  grid-template-columns: 26px minmax(0, 1fr) auto auto;
  padding: 10px 18px;
}

.exig__linha + .exig__linha {
  border-top: 1px solid var(--linha);
}

/* O visto da lista: um círculo na cor do estado, com o glifo que diz o mesmo sem a cor. */
.exig__visto {
  display: grid;
  width: 26px;
  height: 26px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  font-size: 13px;
}

.exig__visto--ok {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.exig__visto--neutro {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.exig__visto--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.exig__visto--risco {
  background: var(--risco);
  color: var(--superficie);
}

.exig__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.exig__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.exig__detalhe {
  color: var(--tinta-2);
  font-size: 13px;
}

/* O que já está em dia lê mais leve: o olho pula direto para o que falta. */
.exig__linha--ok .exig__texto strong {
  font-weight: 500;
}

.exig__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.exig__acoes :deep(.p-button) {
  min-height: 34px;
}

/*
 * Na coluna estreita (a reserva no celular, ou ao lado da conta numa janela menor), as ações descem
 * para baixo do nome, alinhadas com ele: o selo fica na mesma linha do que ele qualifica.
 */
@container (max-width: 42rem) {
  .exig__linha {
    grid-template-columns: 26px minmax(0, 1fr) auto;
  }

  .exig__acoes {
    grid-column: 2 / -1;
  }
}
</style>
