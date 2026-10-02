<script setup lang="ts">
/**
 * Um hóspede na casa.
 *
 * ## A pergunta
 *
 * Esta tela não é um inventário para varrer por coluna: é a pergunta **"como está cada um dos meus
 * cinco?"**. A resposta é um rosto, uma coisa que cobra ação, e até quando ele fica.
 *
 * ## A anatomia, e por que ela é assim
 *
 * O cartão tem quatro faixas, e a ordem delas é a ordem em que se pergunta:
 *
 * 1. **Quem** — rosto, nome, onde dorme, de quem é.
 * 2. **O que cobra ação** — num bloco embutido, com fundo próprio.
 * 3. **Como vai o dia** — a barra da rotina.
 * 4. **Até quando, e o que fazer** — as datas e a única ação.
 *
 * A faixa 2 ser um **bloco embutido**, e não mais uma linha solta, é o que resolve a queixa de
 * "tela feia". A versão anterior era o retângulo do cartão com três linhas de texto flutuando
 * dentro, cada uma com o próprio vazio à direita — nada ancorava o olho, e a única coisa com peso
 * era o disco. Com o bloco, o cartão passa a ter um dentro: o que cobra ação tem superfície
 * própria, e o resto se organiza em volta dele.
 *
 * A faixa 3 é a **barra que o docstring da primeira versão prometia e nunca foi construída** —
 * "3. O que falta: a barra de rotina do dia". O número existia no repositório e não era desenhado.
 * Ela é também o que dá altura honesta ao cartão: quatro hóspedes numa tela larga deixavam metade
 * da página em branco, e a correção certa é o cartão ter o que mostrar, não inventar enfeite para
 * ocupar viewport.
 *
 * ## O que não mudou, e por quê
 *
 * O cartão continua sendo um `<li>` com link esticado no nome, e não um `<button>` envolvendo
 * tudo — aquilo era HTML inválido e era o que impedia qualquer ação dentro dele.
 *
 * E a superfície continua **nunca sendo pintada por estado**: medido, `--clinic-risk-bg` e
 * `--clinic-attention-bg` têm luminância praticamente idêntica, então em escala de cinza os dois
 * eram a mesma cor. O estado mora no disco, que vai de vazado a cheio — canal de forma, que
 * sobrevive ao cinza e ao daltonismo.
 */
import {
  PhChatCircleText,
  PhCheckCircle,
  PhDoorOpen,
  PhHouseLine,
  PhMapPin,
  PhMoon,
  PhPawPrint,
  PhWarningCircle,
  PhScales,
} from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import HotelSelo from '../base/HotelSelo.vue'
import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { HospedeNaCasa } from '../../data/repositories'
import { tomDaAdaptacao } from '../../domain/estadia'

const props = defineProps<{
  hospede: HospedeNaCasa
  /** O relógio da casa, que pulsa. É ele que faz o contador descer sem recarregar a lista. */
  agora: string
  blocoNome?: string
}>()

const emit = defineEmits<{ abrir: [hospedagemId: string] }>()

const { t } = useI18n()
const formato = useHotelFormat()

/**
 * O estado do cartão, num valor só.
 *
 * A ordem é a de quem larga o que está fazendo: ligação primeiro, porque é o único trabalho que
 * não se resolve andando pelo corredor; depois o atraso; depois o recado parado; depois a tarefa
 * que vem; e por fim a calma.
 */
type Estado = 'travado' | 'atrasada' | 'recado' | 'aguardando' | 'calmo'

const estado = computed<Estado>(() => {
  if (props.hospede.ocorrenciaTravada) return 'travado'
  if (props.hospede.foco?.atrasada) return 'atrasada'
  if (props.hospede.boletimRetido) return 'recado'
  if (props.hospede.foco) return 'aguardando'

  return 'calmo'
})

/**
 * O ícone do bloco quando o foco não é uma tarefa.
 *
 * Mapa `Record<Estado, …>` de propósito, como o do `IconeDeTarefa`: acrescentar um estado sem dar
 * ícone a ele passa a ser erro de compilação, e não um quadrado vazio descoberto em produção.
 */
const ICONE_DO_ESTADO: Record<Estado, Component> = {
  travado: PhWarningCircle,
  atrasada: PhCheckCircle,
  recado: PhChatCircleText,
  aguardando: PhCheckCircle,
  calmo: PhCheckCircle,
}

/** Quanto falta (ou quanto passou) para a tarefa em foco, contra o relógio que pulsa. */
const minutos = computed(() => {
  if (!props.hospede.foco) return 0

  return Math.round(
    (Date.parse(props.hospede.foco.previstaPara) - Date.parse(props.agora)) / 60_000,
  )
})

/**
 * O contador, em palavras.
 *
 * Não usa `formato.relativo`: aquele lê o relógio por dentro, então não é reativo — o contador
 * congelaria no instante do carregamento, que é exatamente o defeito que esta linha existe para
 * não ter.
 */
const quando = computed(() => {
  if (!props.hospede.foco) return ''

  const m = minutos.value

  if (m <= 0 && m > -2) return t('hotel.hospedes.foco.agora')
  if (m < 0) return t('hotel.hospedes.foco.atrasou', { tempo: formato.duracao(-m) })

  return t('hotel.hospedes.foco.em', { tempo: formato.duracao(m) })
})

/**
 * O dia em três fatias: o que saiu do caminho, o que atrasou, e o que ainda vem.
 *
 * As larguras são percentuais do total e somam 100 por construção — barra com `flex` e três
 * pedaços que se disputam largura mente sobre a proporção assim que um deles tem texto dentro.
 */
const dia = computed(() => {
  const { total, resolvidas } = props.hospede.rotinaDoDia

  if (total === 0) {
    return null
  }

  const atrasadas = Math.min(props.hospede.atrasadas, total - resolvidas)

  return {
    total,
    resolvidas,
    feito: `${(resolvidas / total) * 100}%`,
    atraso: `${(atrasadas / total) * 100}%`,
  }
})

const faltaPesar = computed(
  () => props.hospede.saiHoje && props.hospede.hospedagem.pesoSaidaKg === null,
)

const saida = computed(() =>
  props.hospede.saiHoje
    ? t('hotel.hospedes.cartao.hojeAs', {
        hora: formato.hora(props.hospede.hospedagem.saidaPrevistaEm),
      })
    : formato.quando(props.hospede.hospedagem.saidaPrevistaEm),
)

const adaptacao = computed(() => props.hospede.hospedagem.adaptacao)
</script>

<template>
  <li class="cartao" :class="`cartao--${estado}`">
    <!-- 1 · Quem. O nome é o único focável, e o `::after` dele cobre o cartão inteiro. -->
    <header class="quem">
      <!--
        Dois rostos quando são dois animais. A estadia é uma só — eles dividem acomodação e rotina
        —, então é um cartão só; mas esconder o segundo fazia a casa ter seis hóspedes e a tela
        mostrar cinco.
      -->
      <span class="quem__rostos" :class="{ 'quem__rostos--dupla': hospede.acompanhante }">
        <PetAvatar
          class="quem__rosto"
          :nome="hospede.petNome"
          :iniciais="hospede.petIniciais"
          :especie="hospede.petEspecie"
          :foto-url="hospede.petFotoUrl"
          tamanho="lg"
        />
        <PetAvatar
          v-if="hospede.acompanhante"
          class="quem__rosto quem__rosto--segundo"
          :nome="hospede.acompanhante.nome"
          :iniciais="hospede.acompanhante.iniciais"
          :especie="hospede.acompanhante.especie"
          :foto-url="hospede.acompanhante.fotoUrl"
          tamanho="sm"
        />
      </span>

      <div class="quem__texto">
        <p class="quem__linha">
          <Button
            type="button"
            class="quem__nome"
            text
            :aria-label="t('hotel.hospedes.acao.abrir', { pet: hospede.petNome })"
            @click="emit('abrir', hospede.hospedagem.id)"
          >
            {{ hospede.petNome }}
          </Button>

          <span v-if="hospede.acompanhante" class="quem__dupla">
            <PhPawPrint weight="duotone" aria-hidden="true" />
            {{ t('hotel.hospedes.cartao.com', { pet: hospede.acompanhante.nome }) }}
          </span>

          <HotelSelo
            v-if="adaptacao !== 'tranquilo'"
            :rotulo="formato.adaptacao(adaptacao)"
            :tom="tomDaAdaptacao(adaptacao)"
          />
        </p>

        <p class="quem__onde">
          <span class="dado">
            <PhMapPin weight="duotone" aria-hidden="true" />{{ hospede.acomodacaoNome }}
          </span>
          <span v-if="blocoNome" class="dado">
            <PhHouseLine weight="duotone" aria-hidden="true" />{{ blocoNome }}
          </span>
          <span class="dado">
            <i class="pi pi-user" aria-hidden="true" />{{ hospede.tutorNome }}
          </span>
        </p>
      </div>
    </header>

    <!--
      2 · O que cobra ação, num bloco com superfície própria.
      É o que ancora o olho: sem ele o cartão é um retângulo com linhas soltas dentro.
    -->
    <section class="foco">
      <span class="foco__disco">
        <IconeDeTarefa v-if="hospede.foco && estado !== 'travado'" :kind="hospede.foco.kind" />
        <component :is="ICONE_DO_ESTADO[estado]" v-else weight="duotone" aria-hidden="true" />
      </span>

      <div class="foco__texto">
        <template v-if="estado === 'travado'">
          <p class="foco__frase">
            {{ t('hotel.hospedes.foco.ocorrencia', { tutor: hospede.tutorNome }) }}
          </p>
          <p v-if="hospede.atrasadas > 0" class="foco__nota foco__nota--risco">
            {{
              t('hotel.hospedes.cartao.atrasadas', { total: hospede.atrasadas }, hospede.atrasadas)
            }}
          </p>
        </template>

        <template v-else-if="hospede.foco">
          <p class="foco__frase">
            <span class="foco__hora clinic-value">{{
              formato.hora(hospede.foco.previstaPara)
            }}</span>
            {{ formato.tarefaKind(hospede.foco.kind) }}
          </p>
          <p class="foco__nota" :class="{ 'foco__nota--risco': estado === 'atrasada' }">
            {{ quando }}
            <template v-if="hospede.atrasadas > 1">
              ·
              {{
                t(
                  'hotel.hospedes.cartao.atrasadas',
                  { total: hospede.atrasadas },
                  hospede.atrasadas,
                )
              }}
            </template>
          </p>
        </template>

        <template v-else-if="estado === 'recado'">
          <p class="foco__frase">{{ t('hotel.hospedes.cartao.boletimRetido') }}</p>
        </template>

        <template v-else>
          <p class="foco__frase foco__frase--calma">
            {{ t('hotel.hospedes.foco.nadaPendente') }}
          </p>
        </template>
      </div>
    </section>

    <!--
      3 · O dia. A barra que a primeira versão deste cartão prometia no próprio comentário e nunca
      construiu — o número já vinha do repositório e era descartado.
    -->
    <section v-if="dia" class="dia">
      <p class="dia__topo">
        <span class="dia__rotulo">{{ t('hotel.hospedes.dia.rotulo') }}</span>
        <span class="dia__conta clinic-value">
          {{ t('hotel.hospedes.dia.contagem', { feitas: dia.resolvidas, total: dia.total }) }}
        </span>
      </p>

      <span
        class="barra"
        role="img"
        :aria-label="t('hotel.hospedes.dia.contagem', { feitas: dia.resolvidas, total: dia.total })"
      >
        <span class="barra__feito" :style="{ inlineSize: dia.feito }" />
        <span class="barra__atraso" :style="{ inlineSize: dia.atraso }" />
      </span>
    </section>

    <!-- 4 · Até quando, e a única ação. O ícone é o rótulo: sem calha, sem caixa-alta miúda. -->
    <footer class="pe">
      <span class="dado">
        <PhMoon weight="duotone" aria-hidden="true" />
        {{ t('hotel.hospedes.cartao.noites', { total: hospede.noites }, hospede.noites) }}
      </span>

      <span class="dado" :class="{ 'dado--hoje': hospede.saiHoje }">
        <PhDoorOpen weight="duotone" aria-hidden="true" />{{ saida }}
      </span>

      <HotelSelo v-if="faltaPesar" :rotulo="t('hotel.hospedes.cartao.faltaPesar')" tom="atencao">
        <template #icone><PhScales weight="duotone" aria-hidden="true" /></template>
      </HotelSelo>

      <!--
        A ação é registrar o contato, e não ligar (30/09/2026): quem liga é a casa, pelo telefone do
        cadastro, que continua à vista ao lado. O registro mora na estadia — é lá que a ocorrência
        destrava o boletim —, então o botão abre a estadia.
      -->
      <span v-if="estado === 'travado'" class="pe__acao">
        <Button
          type="button"
          :label="t('hotel.hospedes.acao.registrarContato')"
          icon="pi pi-pen-to-square"
          severity="secondary"
          outlined
          size="small"
          @click="emit('abrir', hospede.hospedagem.id)"
        />
        <span class="pe__tel clinic-value">
          <bdi dir="ltr">{{ hospede.tutorTelefone }}</bdi>
        </span>
      </span>
    </footer>
  </li>
</template>

<style scoped>
/*
 * Coluna flex, e não grade: é o que permite ao pé descer com `margin-block-start: auto`.
 *
 * Numa fileira de dois cartões, o de quem tem botão de ligar ficava mais alto e o vizinho
 * terminava no ar — as duas datas de saída, que são a mesma informação, saíam em alturas
 * diferentes. Com o pé ancorado embaixo, os cartões da fileira fecham na mesma linha.
 */
.cartao {
  position: relative;
  display: flex;
  height: 100%;
  flex-direction: column;
  padding: var(--clinic-space-5);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-4);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
  transition:
    box-shadow 160ms ease,
    border-color 160ms ease;
}

.cartao:hover {
  border-color: var(--clinic-line-strong);
  box-shadow: var(--clinic-shadow-float);
}

/* O anel de foco é do teclado, e é o token que o módulo já tinha e não usava. */
.cartao:has(.quem__nome:focus-visible) {
  box-shadow: var(--clinic-focus-ring);
}

/* --------------------------------------------------------------- 1 · quem */

.quem {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-3);
}

/*
 * O rosto ganha um halo da própria superfície, e não uma borda: o anel separa o avatar do cartão
 * sem desenhar mais uma linha numa tela que já tem muitas.
 */
/*
 * Os rostos. Quando são dois, o segundo encaixa no canto do primeiro em vez de ocupar uma coluna
 * própria: eles dividem a acomodação, e o desenho diz isso antes da palavra.
 */
.quem__rostos {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
}

.quem__rosto {
  box-shadow: 0 0 0 3px var(--clinic-surface-soft);
}

/*
 * O segundo encosta no canto do primeiro e não o cobre: quem nomeia o cartão é o titular da
 * estadia, e um acompanhante que esconde o rosto dele troca a identidade da fileira. Daí o
 * tamanho `sm` contra o `lg` do titular e o deslocamento para fora do círculo.
 */
.quem__rosto--segundo {
  position: absolute;
  inset-block-end: -0.2rem;
  inset-inline-end: -0.6rem;
  box-shadow: 0 0 0 2px var(--clinic-surface);
}

/* O par ocupa mais largura que um rosto só; sem a folga ele encosta no nome. */
.quem__rostos--dupla {
  margin-inline-end: 0.5rem;
}

.quem__dupla {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.45rem;
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-chip);
  gap: 0.25rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.quem__dupla :deep(svg),
.quem__dupla > svg {
  width: 0.9em;
  height: 0.9em;
}

.quem__texto {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.quem__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
}

/*
 * O nome é um botão, e o `::after` faz dele o alvo do cartão inteiro. É o padrão de link
 * esticado: um foco por cartão para quem anda por teclado, superfície toda para quem usa o dedo.
 */
/*
 * Botão de texto do PrimeVue com a cara do nome. `position: static` e `overflow: visible` desfazem
 * dois padrões do `.p-button`: com eles o `::after` se ancoraria no próprio botão e seria cortado
 * por ele, e o cartão deixaria de ser alvo inteiro.
 */
.quem__nome.p-button,
.quem__nome.p-button:not(:disabled):hover,
.quem__nome.p-button:not(:disabled):active {
  position: static;
  min-height: 0;
  padding: 0;
  border: 0;
  overflow: visible;
  background: transparent;
  box-shadow: none;
  color: var(--clinic-text);
  font: inherit;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  text-align: start;
}

.quem__nome::after {
  position: absolute;
  content: '';
  inset: 0;
}

.quem__nome:focus-visible {
  outline: none;
}

.quem__onde {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  gap: 0.15rem var(--clinic-space-3);
}

/* -------------------------------------------------------------- 2 · o foco */

/*
 * A superfície própria é o que transforma "três linhas soltas" em "um cartão com um dentro".
 * Continua sendo superfície neutra, nunca tinta de estado: quem diz o estado é o disco.
 */
.foco {
  display: flex;
  align-items: center;
  min-block-size: 3.4rem;
  padding: var(--clinic-space-3);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface-soft);
}

.foco__disco {
  display: grid;
  width: 2.3rem;
  height: 2.3rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--clinic-line);
  border-radius: 0.7rem;
  background: var(--clinic-surface);
  color: var(--clinic-muted);
}

.foco__disco :deep(svg) {
  width: 1.2rem;
  height: 1.2rem;
}

/*
 * O disco enche quando tem o que dizer. É a única troca de cor da faixa, e é troca de **forma**
 * antes de ser de matiz: vazado contra cheio sobrevive ao cinza.
 */
/*
 * Só o travado enche (redesenho de 30/09/2026), como o bloco urgente da pauta da Visão geral:
 * numa casa de cinco, cinco discos cheios eram uma parede, e o que é grave deixava de saltar.
 * Atraso e recado ficam no pêssego suave; o que aguarda, na sálvia clara.
 */
.cartao--travado .foco__disco {
  border-color: transparent;
  background: var(--clinic-risk-text);
  color: var(--clinic-on-accent);
}

.cartao--atrasada .foco__disco,
.cartao--recado .foco__disco {
  border-color: transparent;
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.cartao--aguardando .foco__disco {
  border-color: transparent;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

/*
 * Sem aresta colorida (redesenho de 30/09/2026). A faixa de 3 px na borda esquerda do bloco dizia o
 * estado pela lateral — o acento que o design da casa recusa —, e repetia o que o disco já diz: ele
 * enche na cor do estado, que é canal de forma (vazado contra cheio) e sobrevive ao cinza.
 */

.foco__texto {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.foco__frase {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin: 0;
  gap: var(--clinic-space-2);
  color: var(--clinic-text);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.foco__frase--calma {
  color: var(--clinic-muted);
  font-weight: 500;
}

.cartao--travado .foco__frase {
  color: var(--clinic-risk-text);
}

.foco__hora {
  color: var(--clinic-text);
  font-variant-numeric: tabular-nums;
}

.foco__nota {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

.foco__nota--risco {
  color: var(--clinic-risk-text);
  font-weight: 700;
}

/* --------------------------------------------------------------- 3 · o dia */

.dia {
  display: grid;
  gap: var(--clinic-space-2);
}

.dia__topo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0;
  gap: var(--clinic-space-2);
}

/* Rótulo em caixa normal, como os da pauta: a caixa alta espaçada era o rótulo do linho. */
.dia__rotulo {
  color: var(--clinic-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.dia__conta {
  color: var(--clinic-muted);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

/*
 * A barra é uma peça só, com duas fatias que crescem da mesma borda. `flex` e não `grid` porque a
 * fatia de atraso encosta na de feito e as duas precisam somar sem calcular a sobra.
 */
.barra {
  display: flex;
  overflow: hidden;
  height: 0.4rem;
  border-radius: 999px;
  background: var(--clinic-surface-sunken);
}

.barra__feito {
  background: var(--clinic-accent-deep);
}

.barra__atraso {
  background: var(--clinic-risk-text);
}

/* ----------------------------------------------------------------- 4 · o pé */

.pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-block-start: auto;
  padding-block-start: var(--clinic-space-3);
  border-block-start: 1px solid var(--clinic-line-soft);
  gap: var(--clinic-space-2) var(--clinic-space-4);
}

/*
 * Escapa do `::after` do nome, que cobre o cartão inteiro. Sem o `z-index` o botão existiria e
 * não seria clicável — o link esticado engoliria o toque.
 */
.pe__acao {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  margin-inline-start: auto;
  gap: var(--clinic-space-2);
}

.pe__tel {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

/* ------------------------------------------------------------- compartilhado */

.dado {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 0.3rem;
  overflow: hidden;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dado :deep(svg),
.dado .pi {
  flex: 0 0 auto;
  color: var(--clinic-faint);
  font-size: 0.85em;
}

.dado :deep(svg) {
  width: 1em;
  height: 1em;
}

.dado--hoje {
  color: var(--clinic-accent-strong);
  font-weight: 750;
}

.dado--hoje :deep(svg) {
  color: currentcolor;
}

@media (prefers-reduced-motion: reduce) {
  .cartao {
    transition: none;
  }
}
</style>
