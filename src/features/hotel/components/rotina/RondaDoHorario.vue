<script setup lang="ts">
/**
 * Uma ronda da prancheta: o mesmo serviço, no mesmo horário, para vários animais.
 *
 * O cabeçalho responde **o que é e para quantos**; a lista, aberta, responde **para quais**. A
 * separação existe porque são duas perguntas que se fazem em momentos diferentes: a primeira
 * antes de sair andando pelo corredor, a segunda depois, com o balde na mão.
 *
 * Nada aqui se abre sozinho no meio do trabalho: a ronda nasce aberta ou fechada conforme o
 * tamanho (ver `RONDA_ABRE_ATE`) e só muda quando alguém clica. Uma lista que se reorganiza
 * enquanto se marca tarefa é uma lista que faz perder o lugar.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import TarefaLinha from './TarefaLinha.vue'
import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { TarefaKind, TarefaStatus } from '../../data/types'
import type { LinhaDaRonda } from './ronda-types'

const props = defineProps<{
  kind: TarefaKind
  linhas: LinhaDaRonda[]
  /** Quantas do mesmo serviço, no mesmo horário, já saíram desta lista por terem sido resolvidas. */
  resolvidas: number
  aberta: boolean
  salvando: boolean
}>()

const emit = defineEmits<{
  alternar: []
  marcar: [payload: { tarefaId: string; status: TarefaStatus }]
  marcarTodas: [ids: string[]]
}>()

const { t } = useI18n()
const formato = useHotelFormat()

/** Quantas da ronda já estão atrasadas: é o que decide se ela é a próxima a sair. */
const atrasadas = computed(
  () => props.linhas.filter((linha) => linha.situacao === 'atrasada').length,
)

/**
 * Medicação não se marca em lote.
 *
 * Servir quarenta comedouros é um gesto só, repetido; dar remédio é quarenta decisões, cada uma
 * com dose, animal e horário próprios. Um toque que grava "medicação dada" para doze animais
 * produz exatamente o registro que ninguém pode conferir depois — e medicação errada num animal
 * longe de casa é a falha mais cara que este módulo pode encobrir. O botão simplesmente não
 * existe aqui; marca-se uma a uma, que é como se faz.
 */
const aceitaLote = computed(() => props.kind !== 'medicacao' && props.linhas.length > 1)

/**
 * Uma ronda de um animal só não ganha cabeçalho.
 *
 * "Refeição · 1 animal" acima de uma linha que já diz Refeição, o nome e a baia é a mesma frase
 * duas vezes, e custa uma fileira para economizar nenhuma. Num hotel pequeno quase toda ronda é
 * assim — sem esta regra, agrupar **alongaria** a tela de quem tem cinco hóspedes para resolver o
 * problema de quem tem quarenta. A linha aparece sozinha, com o nome do serviço de volta, e o
 * horário à esquerda já diz quando.
 */
const comCabecalho = computed(() => props.linhas.length > 1)

const listaVisivel = computed(() => !comCabecalho.value || props.aberta)
</script>

<template>
  <li class="ronda" :class="{ 'ronda--aberta': aberta }">
    <div v-if="comCabecalho" class="ronda__cabecalho">
      <button
        type="button"
        class="ronda__abrir"
        :aria-expanded="aberta"
        @click="emit('alternar')"
      >
        <span class="ronda__icone" aria-hidden="true"><IconeDeTarefa :kind="kind" /></span>

        <span class="ronda__nome">{{ formato.tarefaKind(kind) }}</span>

        <span class="ronda__quantos">
          {{ t('hotel.rotina.animais', { total: linhas.length }, linhas.length) }}
        </span>

        <span v-if="resolvidas > 0" class="ronda__feitas">
          {{ t('hotel.rotina.jaResolvidas', { total: resolvidas }, resolvidas) }}
        </span>

        <span v-if="atrasadas > 0" class="ronda__atraso">
          {{ t('hotel.rotina.atrasadas', { total: atrasadas }, atrasadas) }}
        </span>

        <i
          class="ronda__seta"
          :class="aberta ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
          aria-hidden="true"
        />
      </button>

      <Button
        v-if="aceitaLote"
        :label="t('hotel.rotina.marcarRonda', { total: linhas.length }, linhas.length)"
        icon="pi pi-check-circle"
        severity="secondary"
        text
        size="small"
        :disabled="salvando"
        @click="emit('marcarTodas', linhas.map((linha) => linha.tarefa.id))"
      />
    </div>

    <ul v-if="listaVisivel" class="ronda__lista">
      <TarefaLinha
        v-for="linha in linhas"
        :key="linha.tarefa.id"
        :tarefa="linha.tarefa"
        :situacao="linha.situacao"
        :pet-nome="linha.petNome"
        :pet-iniciais="linha.petIniciais"
        :pet-especie="linha.petEspecie"
        :pet-foto-url="linha.petFotoUrl"
        :acomodacao-nome="linha.acomodacaoNome"
        :omitir-kind="comCabecalho"
        :salvando="salvando"
        @marcar="(payload) => emit('marcar', payload)"
      />
    </ul>
  </li>
</template>

<style scoped>
.ronda {
  display: grid;
  gap: var(--clinic-space-2);
}

/*
 * O cabeçalho gruda no topo enquanto a ronda passa.
 *
 * Uma ronda de quarenta animais aberta ocupa mais de uma tela: rolando, some o nome do serviço e
 * fica só uma coluna de nomes de bicho igual à ronda de cima e à de baixo. Grudado, o "Refeição ·
 * 40 animais" acompanha a rolagem, e com ele o botão de marcar a ronda inteira — que é
 * exatamente o que se quer ter à mão depois de percorrer o corredor todo.
 *
 * O fundo é obrigatório: sem ele as linhas apareceriam por baixo do texto grudado.
 */
.ronda__cabecalho {
  position: sticky;
  z-index: 1;
  top: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding-block: 0.15rem;
  gap: var(--clinic-space-2);
  background: var(--clinic-bg);
}

/*
 * O cabeçalho inteiro é o alvo do clique, e não só a setinha: com quarenta rondas num dia, mirar
 * um chevron de doze pixels em pé no corredor é o tipo de precisão que ninguém tem com uma mão.
 */
.ronda__abrir {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  padding: 0.3rem 0.1rem;
  border: 0;
  gap: var(--clinic-space-2);
  background: transparent;
  color: var(--clinic-text);
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.ronda__abrir:hover .ronda__nome {
  color: var(--clinic-accent-strong);
}

.ronda__icone {
  display: grid;
  width: 1.7rem;
  height: 1.7rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.55rem;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: 0.72rem;
}

.ronda__nome {
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.ronda__quantos {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

.ronda__feitas {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.ronda__atraso {
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

/* A seta fecha a fileira, encostada no fim do alvo de clique. */
.ronda__seta {
  margin-inline-start: auto;
  color: var(--clinic-faint);
  font-size: 0.7rem;
}

.ronda__lista {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fill, minmax(min(32rem, 100%), 1fr));
  list-style: none;
}
</style>
