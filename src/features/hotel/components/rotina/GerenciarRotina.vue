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

/**
 * Há proposta em cena?
 *
 * É o que decide a forma do painel. Sem proposta ele é um cadastro curto — a rotina da casa em
 * leitura e a escolha de quem se vai falar. Com proposta, esses dois blocos encolhem: a rotina da
 * casa sairia **repetida**, porque a própria proposta já a mostra em "a casa já faz", e dizer a
 * mesma lista duas vezes numa coluna de 28 rem custa justamente a altura que falta lá embaixo.
 */
const temProposta = computed(
  () => Boolean(props.hospedagemId) && (Boolean(props.proposta) || props.gerando),
)
</script>

<template>
  <aside class="painel clinic-scope" :class="{ 'painel--proposta': temProposta }">
    <div class="painel__topo">
      <!-- ------------------------------------------------------------ a rotina da casa -->
      <!-- Some quando há proposta: ela já mostra esta mesma lista em "a casa já faz". -->
      <section v-if="!temProposta" class="bloco">
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
          <i class="ph ph-timer" aria-hidden="true" />
          {{ t('hotel.rotinaPadrao.titulo') }}
          <i class="ph ph-arrow-right atalho__seta" aria-hidden="true" />
        </RouterLink>
      </section>

      <!-- ------------------------------------------------------------ o que muda por hóspede -->
      <section class="bloco">
        <h2 class="bloco__titulo">{{ t('hotel.gerenciar.titulo') }}</h2>

        <!--
        Escolhido o hóspede, o seletor inteiro vira uma fileira: rosto, nome e um caminho de volta.
        Manter o campo aberto ocuparia meio painel para repetir uma escolha que já foi feita.
      -->
        <div v-if="temProposta && escolhido" class="atual">
          <PetAvatar
            :nome="escolhido.petNome"
            :iniciais="escolhido.petIniciais"
            :especie="escolhido.petEspecie"
            :foto-url="escolhido.petFotoUrl"
            tamanho="xs"
          />
          <span class="atual__nome">{{ escolhido.petNome }}</span>
          <span class="atual__onde">{{ escolhido.acomodacaoNome }}</span>

          <Button
            :label="t('hotel.gerenciar.trocar')"
            severity="secondary"
            text
            size="small"
            @click="emit('atualizar:hospedagemId', '')"
          />
        </div>

        <div v-if="!temProposta" class="campo">
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
            v-if="!temProposta"
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

          <!--
            Também depende do hóspede escolhido, e por duas razões.
            A primeira é que **as quatro portas dele precisam de um animal**: não há remédio, ajuste,
            serviço nem cuidado que exista sem alguém a quem pertença. Habilitado antes da escolha,
            o botão prometia uma ação que a tela não tinha como executar.
            A segunda é que o seletor está logo acima. Quem escolhe ali não deve escolher de novo
            dentro do diálogo — duas listas do mesmo hóspede na mesma tela é a forma de alguém
            registrar a medicação no animal errado.
          -->
          <Button
            :label="t('hotel.acrescentar.titulo')"
            icon="ph ph-plus-circle"
            severity="secondary"
            outlined
            size="small"
            :disabled="!hospedagemId"
            @click="emit('medicacao')"
          />
        </div>

        <p v-if="!temProposta" class="bloco__dica">{{ t('hotel.gerenciar.proporDica') }}</p>
      </section>
    </div>

    <!-- ------------------------------------------------------------ a proposta, no lugar -->
    <!--
      Quando há proposta, ela ocupa o resto da coluna — ao lado da lista que vai alterar, e não
      por cima dela. É a diferença entre revisar com a rotina de hoje à vista e revisar de memória.
    -->
    <section v-if="temProposta" class="bloco bloco--proposta">
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
  </aside>
</template>

<style scoped>
/*
 * A coluna gruda **e rola por conta própria**, e a segunda metade é o que a faz funcionar.
 *
 * Grudada e sem teto de altura, um painel mais alto que a janela fica com o pé inalcançável: o
 * `sticky` prende o topo, o resto transborda para fora da tela, e o fim da proposta — que é onde
 * está o `Aprovar` — só aparece depois que a pauta inteira da esquerda tiver rolado. Quem quer
 * revisar três sugestões acaba rolando cinquenta tarefas que não estava lendo.
 *
 * `overscroll-behavior: contain` completa: chegar ao fim da proposta não empurra a página junto.
 *
 * ## Por que o teto desconta tanta coisa
 *
 * `--painel-fora` é o que existe **acima da coluna** e não rola junto com ela: o cabeçalho fixo do
 * portal, o respiro da página e o bloco do título com as ações. A conta parece exagerada, e não é
 * — ela precisa valer **antes de a coluna grudar**.
 *
 * Um teto de `100vh` menos só o cabeçalho fixo acerta o caso em que a página já rolou e a coluna
 * subiu até o topo. No instante em que alguém abre a tela, porém, a coluna ainda está lá embaixo,
 * depois do título: o mesmo teto a faz terminar **abaixo da janela**, e o rodapé com o `Aprovar`
 * nasce fora de alcance — que é exatamente o defeito que este bloco existe para corrigir.
 * Descontando o que está acima, a coluna cabe **desde o primeiro quadro**, e continua cabendo
 * depois de grudar.
 *
 * O preço é uma faixa de folga embaixo quando a página já rolou. É um preço que se paga: espaço
 * ocioso é um incômodo, botão inalcançável é um defeito.
 */
.painel {
  --painel-fora: calc(var(--pj-shell-header-height, 4.25rem) + 9rem);

  position: sticky;
  top: calc(var(--pj-shell-header-height, 4.25rem) + var(--clinic-space-3));
  display: flex;
  overflow-y: auto;
  max-block-size: calc(100vh - var(--painel-fora));
  flex-direction: column;
  gap: var(--clinic-space-3);
  overscroll-behavior: contain;
  /* A barra de rolagem não encosta na borda dos cartões, e o lugar dela não faz a coluna saltar. */
  padding-inline-end: var(--clinic-space-2);
  scrollbar-gutter: stable;
}

.painel__topo {
  display: grid;
  flex: 0 0 auto;
  gap: var(--clinic-space-3);
}

/*
 * Com proposta em cena, quem rola é o miolo dela — não a coluna inteira.
 *
 * A coluna rolando por fora parecia resolver, e não resolvia: o cabeçalho com o nome do animal e o
 * rodapé com o `Aprovar` iam junto, então chegar ao fim da lista era perder de vista de quem era a
 * proposta e como aceitá-la. Aqui a coluna trava, a proposta recebe a altura que sobra, e ela
 * mesma segura as duas pontas. Ver `PropostaDeRotina`.
 */
.painel--proposta {
  overflow: hidden;
}

.painel--proposta .bloco--proposta {
  overflow: hidden;
  min-block-size: 0;
  flex: 1 1 auto;
}

/* O hóspede escolhido, em uma fileira: rosto, nome, onde está, e o caminho de volta. */
.atual {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
}

.atual__nome {
  overflow: hidden;
  font-size: var(--clinic-font-value);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atual__onde {
  margin-inline-start: auto;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
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

/* O título do cartão das telas novas (redesenho de 30/09/2026): caixa normal, na tinta. */
.bloco__titulo {
  margin: 0;
  color: var(--clinic-text);
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.01em;
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

/*
 * Abaixo de 1100 px a coluna deixa de grudar **e deixa de rolar sozinha**.
 *
 * Empilhada, o grudento cobriria a lista que ele deveria acompanhar. E uma região de rolagem
 * dentro de uma página que já rola é, num telefone, a pior coisa que se pode fazer com um polegar:
 * o dedo não sabe qual das duas vai se mover, e a resposta muda conforme onde ele encostou.
 * Empilhado e solto, há uma rolagem só. A grade de duas colunas quem desfaz é a página.
 */
/* O mesmo corte da página: as duas regras descrevem a mesma decisão e têm de virar juntas. */
@media (max-width: 1400px) {
  .painel,
  .painel--proposta,
  .painel--proposta .bloco--proposta {
    position: static;
    overflow: visible;
    max-block-size: none;
    padding-inline-end: 0;
  }
}
</style>
