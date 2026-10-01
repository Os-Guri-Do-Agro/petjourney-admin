<script setup lang="ts">
/**
 * As exigências de admissão de uma reserva — a regra R1 na tela.
 *
 * Uma linha por comprovante, e cada linha diz **três** coisas: o que é, qual é a situação e o que
 * fazer a respeito. A terceira é a que costuma faltar: uma lista de documentos vencidos sem ação
 * ao lado obriga quem lê a descobrir sozinho onde se registra o papel — e, na prática, a registrar
 * fora do sistema.
 *
 * A dispensa é uma ação de segunda classe de propósito: fica atrás de um botão discreto e exige
 * motivo. O que a mantém rara não é escondê-la, é ter de escrever por quê.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import HotelSelo from '../base/HotelSelo.vue'
import { tomDaAdmissao, useHotelFormat } from '../../composables/useHotelFormat'
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
      { data: formato.data(item.comprovante.validoAte), dias },
      dias,
    )
  }

  return t('hotel.exigencias.valeAte', { data: formato.data(item.comprovante.validoAte) })
}
</script>

<template>
  <section class="exig">
    <!--
      O resumo vem antes da lista: quem abre a reserva na véspera quer saber se vai dar problema,
      e só depois quais. Sem ele, a resposta exige ler seis linhas.
    -->
    <p
      v-if="admissao.impedimentos.length > 0"
      class="exig__resumo exig__resumo--risco"
      role="alert"
    >
      <i class="pi pi-ban" aria-hidden="true" />
      {{
        t(
          'hotel.exigencias.bloqueado',
          { total: admissao.impedimentos.length },
          admissao.impedimentos.length,
        )
      }}
    </p>

    <p v-else-if="admissao.avisos.length > 0" class="exig__resumo exig__resumo--atencao">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      {{
        t('hotel.exigencias.comAviso', { total: admissao.avisos.length }, admissao.avisos.length)
      }}
    </p>

    <p v-else class="exig__resumo exig__resumo--ok">
      <i class="pi pi-check-circle" aria-hidden="true" />
      {{ t('hotel.exigencias.tudoEmDia') }}
    </p>

    <ul class="exig__lista">
      <li v-for="item in itens" :key="item.kind" class="exig__linha">
        <div class="exig__texto">
          <strong>{{ formato.exigencia(item.kind) }}</strong>
          <span class="exig__detalhe">{{ detalhe(item) }}</span>
        </div>

        <HotelSelo
          :rotulo="formato.situacaoDaExigencia(item.situacao)"
          :tom="item.situacao === 'ok' ? 'positivo' : tomDaAdmissao(item.situacao)"
        />

        <div v-if="!somenteLeitura" class="exig__acoes">
          <Button
            v-if="item.situacao !== 'ok' && item.situacao !== 'dispensado'"
            :label="t('hotel.exigencias.registrar')"
            icon="pi pi-file-plus"
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
            text
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
  gap: var(--clinic-space-3);
}

/* O veredito é uma linha com ícone na cor do estado — a faixa pintada não volta. */
.exig__resumo {
  display: flex;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.exig__resumo--risco {
  color: var(--clinic-risk-text);
}

.exig__resumo--atencao {
  color: var(--clinic-attention-text);
}

.exig__resumo--ok {
  color: var(--clinic-accent-strong);
}

.exig__lista {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.exig__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: var(--clinic-space-2) 0;
  border-bottom: 1px solid var(--clinic-line-soft);
  gap: var(--clinic-space-3);
}

.exig__linha:last-child {
  border-bottom: none;
}

.exig__texto {
  display: grid;
  min-width: 11rem;
  flex: 1;
  gap: 0.05rem;
}

.exig__texto strong {
  font-size: var(--clinic-font-body);
  font-weight: 700;
}

.exig__detalhe {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.exig__acoes {
  display: flex;
  gap: var(--clinic-space-2);
}
</style>
