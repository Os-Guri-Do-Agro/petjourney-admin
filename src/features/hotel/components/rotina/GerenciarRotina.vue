<script setup lang="ts">
/**
 * O gerenciamento de rotina, **na coluna da direita da prancheta**.
 *
 * ## Por que ao lado, e não atrás de um botão
 *
 * A primeira versão disto era um cartão no rodapé com três botões que abriam diálogos. Estava
 * errado por um motivo que só aparece quando se olha a tela inteira: **a rotina e o gerenciamento
 * dela são a mesma conversa**. Quem decide mudar o horário da água está olhando a água atrasada
 * das 07:00; quem aprova um passeio a mais está vendo que o passeio de hoje não foi feito. Uma
 * camada modal por cima da lista esconde exatamente o que a pessoa precisa consultar para decidir,
 * e um cartão no rodapé obriga a rolar para longe do que se está julgando.
 *
 * Lado a lado, a coluna da esquerda é o **que está acontecendo** e a da direita é o **que se pode
 * mudar**. Nenhuma das duas some para a outra existir.
 *
 * ## O que este painel não faz
 *
 * Não edita os horários da casa. Publicar um template mexe no trabalho de todos os hóspedes de uma
 * vez, e essa decisão pede a previsão do que ela vai fazer — que é uma tela inteira, com números
 * antes de salvar. Aqui a rotina da casa aparece em **leitura**, para dar contexto ao que se
 * propõe, com um caminho até onde ela se edita.
 */
import { PhSparkle } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import PropostaDeRotina from './PropostaDeRotina.vue'
import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { HospedeParaRotina } from '../../data/repositories'
import type { ClockTime, ItemDeRotina, TarefaDaCasaKind } from '../../data/types'
import { escreverHorarios } from '../../domain/rotina-padrao'
import type { PropostaDeRotina as Proposta } from '../../domain/rotina-sugerida'

const props = defineProps<{
  /** A rotina que a casa faz por todos. Aqui é só leitura. */
  rotinaDaCasa: ItemDeRotina[]
  hospedes: HospedeParaRotina[]
  /** Vazio enquanto ninguém escolheu de quem se está falando. */
  hospedagemId: string
  proposta: Proposta | null
  gerando: boolean
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  'atualizar:hospedagemId': [id: string]
  propor: []
  medicacao: []
  descartar: []
  aprovar: [
    payload: {
      hospedagemId: string
      sugestoes: { kind: TarefaDaCasaKind; horarios: ClockTime[]; motivo: string }[]
    },
  ]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

const ativos = computed(() =>
  props.rotinaDaCasa.filter((item) => item.ativo && item.horarios.length > 0),
)

const escolhido = computed(() =>
  props.hospedes.find((item) => item.hospedagemId === props.hospedagemId),
)

/** Quantos hóspedes já saíram do padrão da casa. É o que diz se a exceção virou regra. */
const foraDoPadrao = computed(() => props.hospedes.filter((item) => item.ajustes > 0).length)
</script>

<template>
  <aside class="painel clinic-scope">
    <!-- ------------------------------------------------------------ a rotina da casa -->
    <section class="bloco">
      <h2 class="bloco__titulo">{{ t('hotel.gerenciar.padrao') }}</h2>

      <ul class="casa">
        <li v-for="item in ativos" :key="item.id" class="casa__linha">
          <IconeDeTarefa :kind="item.kind" class="casa__icone" />
          <span class="casa__nome">{{ formato.tarefaKind(item.kind) }}</span>
          <span class="casa__horarios clinic-value">{{ escreverHorarios(item.horarios) }}</span>
        </li>
      </ul>

      <p class="bloco__dica">{{ t('hotel.gerenciar.padraoDica') }}</p>

      <RouterLink class="atalho" to="/hotel/rotina-padrao">
        <i class="pi pi-stopwatch" aria-hidden="true" />
        {{ t('hotel.rotinaPadrao.titulo') }}
        <i class="pi pi-arrow-right atalho__seta" aria-hidden="true" />
      </RouterLink>
    </section>

    <!-- ------------------------------------------------------------ o que muda por hóspede -->
    <section class="bloco">
      <h2 class="bloco__titulo">{{ t('hotel.gerenciar.titulo') }}</h2>

      <div class="campo">
        <label :for="`${idCampo}-hospede`">{{ t('hotel.proposta.escolherHospede') }}</label>

        <Select
          :input-id="`${idCampo}-hospede`"
          :model-value="hospedagemId"
          :options="hospedes"
          option-label="petNome"
          option-value="hospedagemId"
          size="small"
          fluid
          :pt="{ overlay: { class: 'clinic-overlay' } }"
          @update:model-value="(id: string) => emit('atualizar:hospedagemId', id)"
        >
          <!--
            O painel do Select é teleportado para fora da página, então `:deep` daqui não alcança
            a fileira dele. O que alcança é o conteúdo do slot, que leva o atributo de escopo junto.
          -->
          <template #value>
            <span v-if="escolhido" class="opcao">
              <PetAvatar
                :nome="escolhido.petNome"
                :iniciais="escolhido.petIniciais"
                :especie="escolhido.petEspecie"
                :foto-url="escolhido.petFotoUrl"
                tamanho="xs"
              />
              <span class="opcao__nome">{{ escolhido.petNome }}</span>
              <span class="opcao__onde">{{ escolhido.acomodacaoNome }}</span>
            </span>

            <span v-else class="opcao opcao--vazia">
              {{ t('hotel.proposta.escolherHospede') }}
            </span>
          </template>

          <template #option="{ option }">
            <span class="opcao">
              <PetAvatar
                :nome="option.petNome"
                :iniciais="option.petIniciais"
                :especie="option.petEspecie"
                :foto-url="option.petFotoUrl"
                tamanho="xs"
              />
              <span class="opcao__nome">{{ option.petNome }}</span>
              <span class="opcao__onde">{{ option.acomodacaoNome }}</span>
            </span>
          </template>
        </Select>
      </div>

      <div class="acoes">
        <Button
          class="acoes__propor"
          :label="t('hotel.gerenciar.propor')"
          size="small"
          :disabled="!hospedagemId || gerando"
          @click="emit('propor')"
        >
          <template #icon>
            <PhSparkle class="acoes__icone" weight="duotone" aria-hidden="true" />
          </template>
        </Button>

        <Button
          :label="t('hotel.gerenciar.medicacao')"
          icon="pi pi-plus-circle"
          severity="secondary"
          outlined
          size="small"
          @click="emit('medicacao')"
        />
      </div>

      <p class="bloco__dica">{{ t('hotel.gerenciar.proporDica') }}</p>
    </section>

    <!-- ------------------------------------------------------------ a proposta, no lugar -->
    <!--
      Quando há proposta, ela ocupa o resto da coluna — ao lado da lista que vai alterar, e não
      por cima dela. É a diferença entre revisar com a rotina de hoje à vista e revisar de memória.
    -->
    <section v-if="hospedagemId && (proposta || gerando)" class="bloco bloco--proposta">
      <PropostaDeRotina
        :hospedes="hospedes"
        :hospedagem-id="hospedagemId"
        :proposta="proposta"
        :gerando="gerando"
        :salvando="salvando"
        :erro="erro"
        @fechar="emit('descartar')"
        @atualizar:hospedagem-id="(id: string) => emit('atualizar:hospedagemId', id)"
        @aprovar="(payload) => emit('aprovar', payload)"
      />
    </section>

    <p v-else-if="foraDoPadrao > 0" class="fora">
      <i class="pi pi-info-circle" aria-hidden="true" />
      {{ t('hotel.gerenciar.medicacaoDica') }}
    </p>
  </aside>
</template>

<style scoped>
/*
 * A coluna gruda: rolando a pauta de cinquenta tarefas, o gerenciamento continua à vista. É o que
 * faz as duas colunas serem uma conversa em vez de duas telas coladas.
 */
/*
 * A coluna gruda **e rola por conta própria**, e a segunda metade é o que a faz funcionar.
 *
 * Grudada e sem altura máxima, um painel mais alto que a janela fica com o pé inaccessível: o
 * `sticky` prende o topo dele, o resto transborda para fora da tela, e o fim da proposta — que é
 * onde está o botão de aprovar — só aparece depois que a pauta inteira da esquerda tiver rolado.
 * Quem quer revisar dez sugestões acaba rolando cinquenta tarefas que não estava lendo.
 *
 * Com teto de altura e rolagem própria, as duas colunas passam a rolar de forma independente, que
 * é o que uma tela de dois painéis promete quando alguém a vê. `overscroll-behavior: contain`
 * completa: chegar ao fim da proposta não empurra a página junto.
 *
 * O teto desconta o cabeçalho fixo do portal e a folga de cima e de baixo — assim o painel termina
 * onde a janela termina, e não um pedaço depois.
 */
.painel {
  position: sticky;
  top: calc(var(--pj-shell-header-height, 4.25rem) + var(--clinic-space-3));
  display: grid;
  overflow-y: auto;
  max-block-size: calc(100vh - var(--pj-shell-header-height, 4.25rem) - var(--clinic-space-6));
  align-content: start;
  gap: var(--clinic-space-3);
  overscroll-behavior: contain;
  /* A barra de rolagem não encosta na borda dos cartões, e o lugar dela não faz a coluna saltar. */
  padding-inline-end: var(--clinic-space-2);
  scrollbar-gutter: stable;
}

.bloco {
  display: grid;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
}

/* A proposta é conteúdo de trabalho, e não configuração: superfície de cartão, sem recuo extra. */
.bloco--proposta {
  gap: var(--clinic-space-4);
}

.bloco__titulo {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.bloco__dica {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ a rotina da casa */

.casa {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.15rem;
  list-style: none;
}

.casa__linha {
  display: grid;
  align-items: center;
  gap: var(--clinic-space-2);
  grid-template-columns: auto auto minmax(0, 1fr);
}

.casa .casa__icone {
  width: 1rem;
  height: 1rem;
  color: var(--clinic-accent-strong);
}

.casa__nome {
  font-size: var(--clinic-font-base);
  font-weight: 700;
}

/* Os horários encostam no fim: viram uma coluna de números que se confere de cima a baixo. */
.casa__horarios {
  color: var(--clinic-muted);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.atalho {
  display: flex;
  align-items: center;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface-soft);
  color: var(--clinic-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  text-decoration: none;
}

.atalho:hover {
  border-color: var(--clinic-accent);
  color: var(--clinic-accent-strong);
}

.atalho__seta {
  margin-inline-start: auto;
  font-size: 0.7rem;
}

/* ------------------------------------------------------------------ o hóspede e as ações */

.campo {
  display: grid;
  gap: var(--clinic-space-2);
}

.campo label {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.opcao {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--clinic-space-2);
}

.opcao--vazia {
  color: var(--clinic-faint);
}

.opcao__nome {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opcao__onde {
  margin-inline-start: auto;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

.acoes__propor {
  flex: 1 1 10rem;
}

.acoes__icone {
  width: 0.95rem;
  height: 0.95rem;
}

.fora {
  display: flex;
  align-items: flex-start;
  margin: 0;
  gap: var(--clinic-space-2);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.fora .pi {
  margin-block-start: 0.1rem;
  font-size: 0.7rem;
}

/*
 * Abaixo de 1100 px a coluna deixa de grudar **e deixa de rolar sozinha**.
 *
 * Empilhada, o grudento cobriria a lista que ele deveria acompanhar. E uma região de rolagem
 * dentro de uma página que já rola é, num telefone, a pior coisa que se pode fazer com um polegar:
 * o dedo não sabe qual das duas vai se mover, e a resposta muda conforme onde ele encostou.
 * Empilhado e solto, há uma rolagem só. A grade de duas colunas quem desfaz é a página.
 */
@media (max-width: 1100px) {
  .painel {
    position: static;
    overflow: visible;
    max-block-size: none;
    padding-inline-end: 0;
  }
}
</style>
