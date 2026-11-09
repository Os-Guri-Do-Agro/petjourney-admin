<script setup lang="ts">
/**
 * Uma ronda da prancheta (E7-05a, guia e7 42): o mesmo tipo no mesmo horário para vários animais,
 * na ordem de andar a casa (bloco pela ordem cadastrada, baia pelo nome natural, como a API manda).
 *
 * Cada linha mostra a situação que o servidor calculou (na hora, atrasada, feita por quem e quando)
 * e, enquanto pede registro, "Não feito" e "Feito". "Marcar as N" manda só os ids que a tela
 * mostrou, já na janela, e nunca aparece na medicação. Desfazer só na linha de quem registrou.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import IconeDeTarefa from '@/features/hotel/components/base/IconeDeTarefa.vue'
import type { TarefaKind as KindLocal } from '@/features/hotel/data/types'
import type { RondaDaPrancheta, TarefaDaPrancheta } from '@/service/parceiro/hotel-rotina-service'

import { idsParaARonda, linhasDaRonda, pedeRegistro, podeDesfazerTarefa } from './rotina-do-hotel'

const props = defineProps<{
  ronda: RondaDaPrancheta
  /** "ontem", "amanhã" ou a data, quando a ronda não é do dia da prancheta. */
  outroDia: string
  podeMarcar: boolean
  meuNome: string | null
  agoraMs: number
  ocupada: string | null
}>()
const emit = defineEmits<{
  feito: [tarefa: TarefaDaPrancheta]
  naoFeito: [tarefa: TarefaDaPrancheta]
  desfazer: [tarefa: TarefaDaPrancheta]
  ronda: [ids: string[]]
}>()

const { t } = useI18n()

const kindLocal = computed(() => props.ronda.kind.toLowerCase() as KindLocal)
const linhas = computed(() => linhasDaRonda(props.ronda))
const resolvidas = computed(() => linhas.value.filter((linha) => !pedeRegistro(linha)).length)
const idsDaRonda = computed(() => (props.podeMarcar ? idsParaARonda(props.ronda) : []))
const rotuloDoKind = computed(() => t(`rotinaDoHotel.kind.${props.ronda.kind}`))
/** "ontem 22:00": o dia só aparece quando a ronda não é do dia da prancheta. */
const quando = computed(() =>
  props.outroDia ? `${props.outroDia} ${props.ronda.hora}` : props.ronda.hora,
)

const TOM: Record<TarefaDaPrancheta['situacao'], string> = {
  ATRASADA: 'atencao',
  NA_JANELA: 'lugar',
  FUTURA: '',
  FEITA: 'ok',
  RECUSADA: 'contorno',
  PULADA: 'contorno',
  SUSPENSA: 'contorno',
}

/** A medicação atrasada é o único atraso em vermelho; o resto atrasado é âmbar. */
function tom(linha: TarefaDaPrancheta) {
  if (linha.situacao === 'ATRASADA' && linha.kind === 'MEDICACAO') return 'risco'
  return TOM[linha.situacao]
}

const hora = (iso: string | null) => (iso ? iso.slice(11, 16) : '')

function situacao(linha: TarefaDaPrancheta) {
  switch (linha.situacao) {
    case 'FUTURA':
      return ''
    case 'FEITA':
      return linha.executadaPorNome
        ? t('rotinaDoHotel.situacao.feitaPor', {
            nome: linha.executadaPorNome,
            hora: hora(linha.executadaEm),
          })
        : t('rotinaDoHotel.situacao.FEITA')
    default:
      return t(`rotinaDoHotel.situacao.${linha.situacao}`)
  }
}

/** A descrição só aparece quando diz mais que o tipo (a dose escrita, a refeição com a porção). */
function meta(linha: TarefaDaPrancheta) {
  const partes = [linha.acomodacaoNome]
  if (linha.descricao && linha.descricao !== rotuloDoKind.value) partes.push(linha.descricao)
  if (linha.status === 'RECUSADA' || linha.status === 'PULADA')
    partes.push(
      [linha.motivo ? t(`rotinaDoHotel.motivo.${linha.motivo}`) : '', linha.executadaPorNome ?? '']
        .filter(Boolean)
        .join(', '),
    )
  return partes.filter(Boolean).join(' · ')
}
</script>

<template>
  <div class="rd">
    <header class="rd__cabeca">
      <IconeDeTarefa :kind="kindLocal" class="rd__icone" />
      <span class="rd__titulos">
        <strong class="rd__titulo">{{ rotuloDoKind }}</strong>
        <span class="ui-hora rd__hora">{{ quando }}</span>
        <span class="rd__conta ui-num">{{
          t('rotinaDoHotel.ronda.resolvidas', { feitas: resolvidas, total: linhas.length })
        }}</span>
      </span>
      <Button
        v-if="idsDaRonda.length"
        type="button"
        size="small"
        icon="ph ph-checks"
        :label="t('rotinaDoHotel.ronda.marcarTodas', { n: idsDaRonda.length })"
        :loading="ocupada === ronda.chave"
        :disabled="ocupada !== null && ocupada !== ronda.chave"
        @click="emit('ronda', idsDaRonda)"
      />
    </header>

    <template v-for="grupo in ronda.grupos" :key="grupo.blocoId">
      <p v-if="ronda.grupos.length > 1" class="rd__bloco">{{ grupo.nome }}</p>
      <ul class="ui-lista rd__lista">
        <li
          v-for="linha in grupo.linhas"
          :key="linha.id"
          class="ui-linha rd__linha"
          :class="{
            'ui-marca ui-marca--risco': tom(linha) === 'risco',
            'ui-marca ui-marca--atencao': tom(linha) === 'atencao',
            'rd__linha--resolvida': !pedeRegistro(linha),
          }"
        >
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo rd__nome">
              {{ linha.pacienteNome }}
              <span
                v-if="situacao(linha)"
                class="ui-selo"
                :class="tom(linha) ? `ui-selo--${tom(linha)}` : ''"
                >{{ situacao(linha) }}</span
              >
            </strong>
            <span class="ui-linha__meta">{{ meta(linha) }}</span>
            <span v-if="linha.observacao" class="ui-linha__meta">{{ linha.observacao }}</span>
          </span>
          <span v-if="podeMarcar && pedeRegistro(linha)" class="ui-linha__fim rd__acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('rotinaDoHotel.tarefa.naoFeito')"
              :disabled="ocupada !== null"
              @click="emit('naoFeito', linha)"
            />
            <Button
              type="button"
              size="small"
              icon="ph ph-check"
              :label="t('rotinaDoHotel.tarefa.feito')"
              :loading="ocupada === linha.id"
              :disabled="ocupada !== null && ocupada !== linha.id"
              @click="emit('feito', linha)"
            />
          </span>
          <span
            v-else-if="podeMarcar && podeDesfazerTarefa(linha, meuNome, agoraMs)"
            class="ui-linha__fim"
          >
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrow-counter-clockwise"
              :label="t('rotinaDoHotel.tarefa.desfazer')"
              :loading="ocupada === linha.id"
              :disabled="ocupada !== null && ocupada !== linha.id"
              @click="emit('desfazer', linha)"
            />
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.rd {
  display: grid;
}

.rd + .rd {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.rd__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  padding: 14px 10px 6px;
}

.rd__icone {
  color: var(--tinta-2);
  font-size: 15px;
}

.rd__titulos {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  min-width: 0;
}

.rd__titulo {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.rd__hora {
  color: var(--tinta);
  font-size: 14px;
}

.rd__conta {
  color: var(--tinta-2);
  font-size: 13px;
}

.rd__bloco {
  margin: 6px 0 0;
  padding: 0 10px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.rd__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.rd__linha--resolvida .rd__nome {
  color: var(--tinta-2);
}

.rd__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}
</style>
