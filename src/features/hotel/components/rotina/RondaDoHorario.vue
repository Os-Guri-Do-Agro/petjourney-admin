<script setup lang="ts">
/**
 * Uma ronda da prancheta: o mesmo serviço, no mesmo horário, para vários animais.
 *
 * O cabeçalho responde **o que é, quando e para quantos**; a lista, aberta, responde **para
 * quais**. A separação existe porque são duas perguntas que se fazem em momentos diferentes: a
 * primeira antes de sair andando pelo corredor, a segunda depois, com o balde na mão.
 *
 * Nada aqui se abre sozinho no meio do trabalho: a ronda nasce aberta ou fechada conforme o
 * tamanho (ver `RONDA_ABRE_ATE`) e só muda quando alguém clica. Uma lista que se reorganiza
 * enquanto se marca tarefa é uma lista que faz perder o lugar.
 *
 * ## Por que a ronda é o cartão
 *
 * Antes cada **tarefa** era um cartão e a ronda era um cabeçalho solto flutuando sobre o fundo da
 * página. A moldura estava no nível errado: quarenta e nove molduras iguais para as tarefas de um
 * dia, e nenhuma para a coisa que a pessoa de fato executa, que é a ronda — às 8h alguém serve os
 * comedouros **todos** e só depois pega o telefone.
 *
 * Invertido, o cartão passa a ter duas formas, e é isso que faz a mesma tela servir aos dois
 * tamanhos de casa:
 *
 * - **Fechada**, a ronda é uma fileira só, com tudo dentro — hora, serviço, quantos, quantos
 *   atrasados e o botão de marcar o lote. Uma ronda inteira de trabalho, executável sem abrir
 *   nada. Num hotel de quarenta, o bloco das 18:00 deixa de ser 29 caixas e vira duas fileiras.
 * - **Aberta**, o mesmo cartão se desdobra: o cabeçalho vira faixa grudada no alto, as fileiras
 *   vêm na ordem de andar a casa, e a ação de lote desce para um rodapé grudado embaixo.
 *
 * Num hotel de cinco, `RONDA_ABRE_ATE` mantém tudo aberto e não há um toque a dar antes de
 * trabalhar — que é a promessa que a constante sempre fez e continua fazendo.
 *
 * ## Onde mora cada ação
 *
 * O botão de lote está **no cabeçalho quando a ronda está fechada e no rodapé quando está
 * aberta** — nunca nos dois. Fechada, a fileira é o objeto inteiro e a ação pertence a ela.
 * Aberta, a ronda pode ter quarenta fileiras e mais de uma tela de altura: a ação que encerra o
 * trabalho tem de estar onde o polegar está, que é embaixo, e não no topo de uma tela que se
 * segura com uma mão.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import TarefaLinha from './TarefaLinha.vue'
import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { TarefaKind, TarefaStatus } from '../../data/types'
import { agruparPelaCasa } from '../../domain/ronda-ordem'
import type { LinhaDaRonda } from './ronda-types'

/**
 * A partir de quantas fileiras a ronda aberta ganha as réguas de bloco.
 *
 * Abaixo disso a lista inteira cabe num olhar, e uma régua "CANIL A" acima de duas fileiras custa
 * mais altura do que economiza leitura. O número é próprio e não empresta o de `RONDA_ABRE_ATE`:
 * um decide se a ronda nasce aberta, o outro se a lista aberta precisa de subdivisão, e amarrar os
 * dois faria mexer num mudar o outro sem querer.
 */
const REGUA_DE_BLOCO_ACIMA_DE = 6

const props = defineProps<{
  kind: TarefaKind
  /** O horário desta ronda, em `HH:MM`. É a primeira célula do cartão. */
  hora: string
  linhas: LinhaDaRonda[]
  /** Quantas do mesmo serviço, no mesmo horário, já estão resolvidas. */
  resolvidas: number
  /** Os blocos da casa, para ordenar as fileiras pelo caminho que se anda. */
  blocos: ReadonlyMap<string, { nome: string; ordem: number }>
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

/**
 * O que ainda falta fazer nesta ronda.
 *
 * Não é o mesmo que `linhas`: uma fileira marcada **continua na lista** até a ronda ser fechada,
 * para não evaporar sob o dedo de quem está marcando (ver `repartirPorTempo` e a página). Então
 * todas as contas de trabalho — quantos faltam, o que o lote marca, se o lote ainda faz sentido —
 * saem daqui, e não do tamanho da lista desenhada.
 */
const pendentes = computed(() => props.linhas.filter((linha) => linha.tarefa.status === 'pendente'))

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
 * longe de casa é a falha mais cara que este módulo pode encobrir. O botão não existe aqui; no
 * lugar dele ficam as palavras "uma a uma", porque a ausência calada de um botão que todas as
 * outras rondas têm lê como defeito, e não como decisão.
 */
const ehMedicacao = computed(() => props.kind === 'medicacao')

const aceitaLote = computed(() => !ehMedicacao.value && pendentes.value.length > 1)

/**
 * Uma ronda de um animal só não ganha cabeçalho.
 *
 * "Refeição · 1 animal" acima de uma linha que já diz Refeição, o nome e a baia é a mesma frase
 * duas vezes, e custa uma fileira para economizar nenhuma. Num hotel pequeno quase toda ronda é
 * assim — sem esta regra, agrupar **alongaria** a tela de quem tem cinco hóspedes para resolver o
 * problema de quem tem quarenta. A fileira aparece sozinha, com o nome do serviço de volta e a
 * hora na frente, e o cartão em volta já diz que ela é um grupo inteiro.
 */
const comCabecalho = computed(() => props.linhas.length > 1)

const listaVisivel = computed(() => !comCabecalho.value || props.aberta)

/** A ronda aberta tem rodapé; a fechada não tem onde pô-lo, e a ação fica no cabeçalho. */
const comRodape = computed(() => comCabecalho.value && listaVisivel.value)

/**
 * As fileiras na ordem de andar a casa, agrupadas por bloco.
 *
 * As réguas só aparecem quando há **mais de um bloco e lista longa o bastante** para o olho se
 * perder. A ordenação, essa, vale sempre: mesmo sem régua desenhada, percorrer o canil inteiro
 * antes de atravessar para o gatil é o que poupa a caminhada.
 */
const grupos = computed(() => agruparPelaCasa(props.linhas, props.blocos))

const comRegua = computed(
  () => grupos.value.length > 1 && props.linhas.length > REGUA_DE_BLOCO_ACIMA_DE,
)

function marcarPendentes() {
  emit(
    'marcarTodas',
    pendentes.value.map((linha) => linha.tarefa.id),
  )
}
</script>

<template>
  <li
    class="ronda"
    :class="{
      'ronda--aberta': comRodape,
      'ronda--atrasada': atrasadas > 0,
    }"
  >
    <div v-if="comCabecalho" class="ronda__cabecalho">
      <span class="ronda__hora clinic-value">{{ hora }}</span>

      <button
        type="button"
        class="ronda__abrir"
        :aria-expanded="aberta"
        @click="emit('alternar')"
      >
        <IconeDeTarefa :kind="kind" class="ronda__icone" />

        <span class="ronda__nome">{{ formato.tarefaKind(kind) }}</span>

        <span class="ronda__quantos">
          {{ t('hotel.rotina.animais', { total: pendentes.length }, pendentes.length) }}
        </span>

        <span v-if="resolvidas > 0" class="ronda__feitas">
          {{ t('hotel.rotina.jaResolvidas', { total: resolvidas }, resolvidas) }}
        </span>

        <!--
          O atraso da ronda é dito aqui, uma vez, e some das fileiras: dentro de uma ronda todas
          as pendentes partilham o horário, logo partilham a situação. Ver `TarefaLinha`.
        -->
        <span v-if="atrasadas > 0" class="ronda__atraso">
          {{ t('hotel.rotina.atrasadas', { total: atrasadas }, atrasadas) }}
        </span>

        <i
          class="ronda__seta"
          :class="aberta ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
          aria-hidden="true"
        />
      </button>

      <!-- Fechada, a ação mora aqui. Aberta, ela desce para o rodapé — nunca nos dois lugares. -->
      <template v-if="!comRodape">
        <Button
          v-if="aceitaLote"
          class="ronda__lote"
          :label="t('hotel.rotina.marcarRonda', { total: pendentes.length }, pendentes.length)"
          icon="pi pi-check-circle"
          severity="secondary"
          text
          size="small"
          :disabled="salvando"
          @click="marcarPendentes"
        />

        <span v-else-if="ehMedicacao && pendentes.length > 1" class="ronda__umaAUma">
          {{ t('hotel.rotina.umaAUma') }}
        </span>
      </template>
    </div>

    <ul v-if="listaVisivel" class="ronda__lista">
      <template v-for="grupo in grupos" :key="grupo.blocoId">
        <li v-if="comRegua && grupo.nome" class="regua">{{ grupo.nome }}</li>

        <TarefaLinha
          v-for="linha in grupo.linhas"
          :key="linha.tarefa.id"
          :tarefa="linha.tarefa"
          :situacao="linha.situacao"
          :hora="comCabecalho ? '' : hora"
          :pet-nome="linha.petNome"
          :pet-iniciais="linha.petIniciais"
          :pet-especie="linha.petEspecie"
          :pet-foto-url="linha.petFotoUrl"
          :acomodacao-nome="linha.acomodacaoNome"
          :dentro-da-ronda="comCabecalho"
          :salvando="salvando"
          @marcar="(payload) => emit('marcar', payload)"
        />
      </template>
    </ul>

    <!--
      O rodapé grudado: a ação que encerra a ronda, onde o polegar alcança.
      Some quando não há mais nada a marcar em lote — um botão "marcar as 0" é ruído.
    -->
    <div v-if="comRodape && (aceitaLote || ehMedicacao)" class="ronda__rodape">
      <Button
        v-if="aceitaLote"
        class="ronda__lote"
        :label="t('hotel.rotina.marcarRonda', { total: pendentes.length }, pendentes.length)"
        icon="pi pi-check-circle"
        severity="secondary"
        text
        size="small"
        :disabled="salvando"
        @click="marcarPendentes"
      />

      <span v-else class="ronda__umaAUma">{{ t('hotel.rotina.umaAUma') }}</span>
    </div>
  </li>
</template>

<style scoped>
/*
 * O cartão.
 *
 * Sem `overflow: clip` de propósito: o cabeçalho e o rodapé são grudentos, e recortar o cartão
 * mata os dois — é a armadilha clássica de `overflow` com `position: sticky`. Quem arredonda os
 * cantos é cada faixa, na ponta em que ela encosta.
 */
.ronda {
  display: grid;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

/* ------------------------------------------------------------------ o cabeçalho */

/*
 * O cabeçalho gruda no topo enquanto a ronda passa.
 *
 * Uma ronda de quarenta animais aberta ocupa mais de uma tela: rolando, some o nome do serviço e
 * fica só uma coluna de nomes de bicho igual à ronda de cima e à de baixo. Grudado, o "Refeição ·
 * 40 animais" acompanha a rolagem, junto com quantas já foram e quantas atrasaram.
 *
 * O `top` desconta o cabeçalho fixo do portal. Com `top: 0` — que era o valor — o grudento
 * encostava **debaixo** da barra fixa do aplicativo e nunca aparecia: a única coisa que ele
 * sabe fazer nunca chegou a acontecer uma vez.
 */
.ronda__cabecalho {
  position: sticky;
  z-index: 2;
  top: calc(var(--pj-shell-header-height, 4.25rem) + var(--clinic-space-2));
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  gap: var(--clinic-space-2);
  border-radius: calc(var(--clinic-radius-card) - 1px);
  background: var(--clinic-surface-soft);
}

/* Aberta, a faixa encosta nas fileiras: perde o raio de baixo e ganha o filete que as separa. */
.ronda--aberta .ronda__cabecalho {
  border-end-start-radius: 0;
  border-end-end-radius: 0;
  border-block-end: 1px solid var(--clinic-line-soft);
}

/*
 * A hora, tabular, na primeira célula do cartão.
 *
 * Substituiu a calha de 3,6 rem que descia ao lado da página inteira. A calha cobrava largura de
 * toda fileira, o dia inteiro, para desenhar um chip e um fio — e no telefone cobrava 2,9 rem dos
 * 390 disponíveis. Como todos os cartões têm a mesma largura, a coluna de horas continua
 * existindo; ela é desenhada pelas próprias fileiras, e não por uma coluna vazia.
 */
.ronda__hora {
  min-width: 3.1rem;
  flex: 0 0 auto;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-value);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

/* A hora em vermelho é a marca do atraso da ronda: uma por ronda, não uma por animal. */
.ronda--atrasada .ronda__hora {
  color: var(--clinic-risk-text);
}

/*
 * O cabeçalho é o alvo do clique, e não só a setinha: com quarenta rondas num dia, mirar um
 * chevron de doze pixels em pé no corredor é o tipo de precisão que ninguém tem com uma mão.
 *
 * Mas ele **não estica**. Esticando, o alvo ia de ponta a ponta e empurrava o botão de lote para
 * a borda direita da página — medido, quase 700 px de vazio entre o nome da ronda e o botão que
 * a marca, duas partes do mesmo controle em pontas opostas da tela. Agora ele tem a largura do
 * próprio texto e ganha fundo no hover para continuar se anunciando como alvo.
 */
.ronda__abrir {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: center;
  padding: 0.3rem var(--clinic-space-2);
  border: 0;
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: transparent;
  color: var(--clinic-text);
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.ronda__abrir:hover {
  background: var(--clinic-surface);
}

.ronda__abrir:hover .ronda__nome {
  color: var(--clinic-accent-strong);
}

/*
 * O ícone acompanha o texto, sem pastilha.
 *
 * Tinha disco próprio de 1,7 rem — maior e mais chamativo que nada em volta, e competindo com o
 * disco de 2,1 rem da fileira lá embaixo, que é seu filho. Dois discos, dois tamanhos, nenhuma
 * regra. Aqui o glifo fica do tamanho do texto que acompanha, como já é no filtro do topo.
 *
 * O seletor é descendente para ganhar do `.icone` de `IconeDeTarefa`, que dimensiona em `em`.
 */
.ronda__abrir .ronda__icone {
  width: 1.05rem;
  height: 1.05rem;
  flex: 0 0 auto;
}

/* Um degrau acima da fileira: o token existe, e agora vale. */
.ronda__nome {
  font-size: var(--clinic-font-value);
  font-weight: 700;
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
  font-weight: 600;
}

.ronda__atraso {
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

/* A seta fecha a fileira, colada no último número — e não a 700 px dele. */
.ronda__seta {
  margin-inline-start: var(--clinic-space-1);
  color: var(--clinic-faint);
  font-size: 0.7rem;
}

/* O lote encosta no fim da faixa, que é a borda do próprio grupo que ele marca. */
.ronda__lote {
  margin-inline-start: auto;
}

/*
 * "uma a uma", no lugar exato onde as outras rondas têm o botão de lote.
 *
 * Sem isto, a ronda de medicação é a única sem o botão e nada explica por quê — e um controle que
 * falta sem explicação lê como tela quebrada, não como regra. Dito, vira a própria instrução.
 */
.ronda__umaAUma {
  margin-inline-start: auto;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-style: italic;
}

/* ------------------------------------------------------------------ as fileiras */

/*
 * Coluna única, explícita.
 *
 * Era `repeat(auto-fill, minmax(min(32rem, 100%), 1fr))`, que em tela larga abria duas colunas: a
 * ronda de cinco terminava com meia fileira vazia, a de um ocupava metade da largura, e a borda
 * direita do conteúdo ficava serrilhada de cima a baixo — larga, estreita, larga. Pior, a leitura
 * em Z brigava com o eixo do tempo, que é vertical.
 *
 * Não trocar por `auto-fit`: ele estica o cartão único até a borda, que é o defeito oposto.
 */
.ronda__lista {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  grid-template-columns: minmax(0, 1fr);
  list-style: none;
}

/* O filete que separa uma fileira da seguinte, de borda a borda do cartão. */
.ronda__lista > li + li {
  border-block-start: 1px solid var(--clinic-line-soft);
}

/*
 * A régua do bloco da casa.
 *
 * Não é um cabeçalho de seção — é uma placa de corredor. Por isso é pequena, apagada e sem fundo:
 * ela informa onde a pessoa está andando sem disputar com o nome do animal, que é o que ela lê.
 */
.regua {
  padding: var(--clinic-space-2) var(--clinic-space-4) 0.15rem;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* ------------------------------------------------------------------ o rodapé */

/*
 * A ação de lote desce para cá quando a ronda está aberta, e gruda na borda de baixo da janela.
 *
 * Quem abre uma ronda de quarenta animais sai andando e volta com os quarenta comedouros servidos.
 * Nesse momento a ação que ele quer é uma só, e ela precisa estar embaixo: o alto da tela de um
 * telefone que se segura com uma mão não se alcança com o polegar, e rolar até o topo para achar
 * o botão é exatamente o atrito que faz a prancheta ser preenchida de memória no fim do turno.
 */
.ronda__rodape {
  position: sticky;
  z-index: 1;
  bottom: 0;
  display: flex;
  align-items: center;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-block-start: 1px solid var(--clinic-line-soft);
  border-end-start-radius: calc(var(--clinic-radius-card) - 1px);
  border-end-end-radius: calc(var(--clinic-radius-card) - 1px);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface-soft);
}
</style>
