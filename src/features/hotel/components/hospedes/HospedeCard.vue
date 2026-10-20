<script setup lang="ts">
/**
 * Um hóspede na casa, numa linha.
 *
 * ## A pergunta
 *
 * A lista responde **"como está cada um dos meus cinco?"**, andando pelo corredor: a placa da
 * acomodação, o rosto, quem é o responsável e como falar com ele, o que a rotina pede agora e
 * quanto do dia já foi feito.
 *
 * ## A anatomia (redesenho total, 19/10/2026)
 *
 * As colunas são as mesmas em toda linha, para a lista se ler de cima a baixo:
 *
 * 1. **A placa** — a acomodação, como a placa na porta.
 * 2. **Quem** — rosto (e o do acompanhante, quando a estadia é de dois), nome, adaptação, noites e
 *    a saída. Embaixo, em selos, o que trava: ocorrência sem contato, boletim retido, falta pesar.
 * 3. **O responsável** — nome e telefone; com ocorrência sem contato, o "Registrar contato".
 * 4. **Agora na rotina** — a tarefa em foco (a mais antiga atrasada, ou a próxima), com o relógio.
 * 5. **A rotina do dia** — "x de y" e a barra, com o atraso em vermelho.
 *
 * A gravidade aparece duas vezes, de propósito: na marca da borda esquerda (para quem passa os
 * olhos) e no selo com a palavra (para quem lê, e para quem não distingue a cor).
 *
 * ## O que não mudou
 *
 * Continua um `<li>` com o nome como único alvo de foco, e o `::after` dele cobre a linha inteira
 * (link esticado): um foco por hóspede para quem anda por teclado, a linha toda para o dedo. O
 * "Registrar contato" sobe acima do véu para continuar clicável.
 */
import { PhChatCircleText, PhCheckCircle, PhWarningCircle } from '@phosphor-icons/vue'
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
  /** O corredor da acomodação; vai no título da placa. */
  blocoNome?: string
}>()

const emit = defineEmits<{ abrir: [hospedagemId: string] }>()

const { t } = useI18n()
const formato = useHotelFormat()

/**
 * O estado da linha, num valor só.
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
 * A marca da borda: vermelha para a ligação que falta e para o remédio atrasado; âmbar para o
 * resto que atrasou ou parou; nenhuma para quem está em dia.
 */
const marca = computed(() => {
  if (estado.value === 'travado') return 'ui-marca ui-marca--risco'
  if (props.hospede.foco?.atrasada && props.hospede.foco.kind === 'medicacao') {
    return 'ui-marca ui-marca--risco'
  }
  if (estado.value === 'atrasada' || estado.value === 'recado' || faltaPesar.value) {
    return 'ui-marca ui-marca--atencao'
  }

  return ''
})

/** O ícone do disco quando não há tarefa em foco. */
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
 * congelaria no instante do carregamento.
 */
const quando = computed(() => {
  if (!props.hospede.foco) return ''

  const m = minutos.value

  if (m <= 0 && m > -2) return t('hotel.hospedes.foco.agora')
  if (m < 0) return t('hotel.hospedes.foco.atrasou', { tempo: duracaoCurta(-m) })

  return t('hotel.hospedes.foco.em', { tempo: duracaoCurta(m) })
})

/**
 * Acima de uma hora, só as horas: "atrasou 28 h" diz o que importa numa linha, e "28 h 55 min"
 * quebrava a coluna em duas linhas para dar um minuto que ninguém usa.
 */
function duracaoCurta(minutos: number) {
  return formato.duracao(minutos >= 60 ? Math.floor(minutos / 60) * 60 : minutos)
}

/**
 * O dia em fatias: o que saiu do caminho e o que atrasou. As larguras são percentuais do total e
 * somam no máximo 100 por construção.
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
  t('hotel.hoje.hospedes.sai', {
    quando: props.hospede.saiHoje
      ? t('hotel.hospedes.cartao.hojeAs', {
          hora: formato.hora(props.hospede.hospedagem.saidaPrevistaEm),
        })
      : formato.quando(props.hospede.hospedagem.saidaPrevistaEm),
  }),
)

const adaptacao = computed(() => props.hospede.hospedagem.adaptacao)

const placa = computed(() =>
  props.blocoNome
    ? `${props.hospede.acomodacaoNome} · ${props.blocoNome}`
    : props.hospede.acomodacaoNome,
)
</script>

<template>
  <li class="cartao" :class="[`cartao--${estado}`, marca]">
    <!-- 1 · A placa da porta. -->
    <span class="placa ui-num" :title="placa">{{ hospede.acomodacaoNome }}</span>

    <!-- 2 · Quem. O nome é o único focável, e o `::after` dele cobre a linha inteira. -->
    <div class="quem">
      <span class="quem__rostos" :class="{ 'quem__rostos--dupla': hospede.acompanhante }">
        <PetAvatar
          :nome="hospede.petNome"
          :iniciais="hospede.petIniciais"
          :especie="hospede.petEspecie"
          :foto-url="hospede.petFotoUrl"
          tamanho="md"
        />
        <PetAvatar
          v-if="hospede.acompanhante"
          class="quem__segundo"
          :nome="hospede.acompanhante.nome"
          :iniciais="hospede.acompanhante.iniciais"
          :especie="hospede.acompanhante.especie"
          :foto-url="hospede.acompanhante.fotoUrl"
          tamanho="sm"
        />
      </span>

      <div class="quem__texto">
        <p class="quem__linha">
          <button
            type="button"
            class="quem__nome"
            :aria-label="t('hotel.hospedes.acao.abrir', { pet: hospede.petNome })"
            @click="emit('abrir', hospede.hospedagem.id)"
          >
            {{ hospede.petNome }}
          </button>
          <span v-if="hospede.acompanhante" class="quem__dupla">
            {{ t('hotel.hospedes.cartao.com', { pet: hospede.acompanhante.nome }) }}
          </span>
          <HotelSelo
            v-if="adaptacao !== 'tranquilo'"
            :rotulo="formato.adaptacao(adaptacao)"
            :tom="tomDaAdaptacao(adaptacao)"
          />
        </p>

        <p class="quem__meta">
          <span>{{
            t('hotel.hospedes.cartao.noites', { total: hospede.noites }, hospede.noites)
          }}</span>
          <span aria-hidden="true">·</span>
          <span :class="{ 'quem__saida--hoje': hospede.saiHoje }">{{ saida }}</span>
        </p>

        <ul
          v-if="hospede.ocorrenciaTravada || hospede.boletimRetido || faltaPesar"
          class="quem__selos"
        >
          <li v-if="hospede.ocorrenciaTravada" class="ui-selo ui-selo--risco">
            <i class="ph ph-phone-call" aria-hidden="true" />
            {{ t('hotel.hoje.selo.ocorrencia') }}
          </li>
          <li v-if="hospede.boletimRetido" class="ui-selo ui-selo--atencao">
            <i class="ph ph-envelope-simple" aria-hidden="true" />
            {{ t('hotel.hoje.selo.boletim') }}
          </li>
          <li v-if="faltaPesar" class="ui-selo ui-selo--atencao">
            <i class="ph ph-scales" aria-hidden="true" />
            {{ t('hotel.painel.faltaPesar') }}
          </li>
        </ul>
      </div>
    </div>

    <!-- 3 · O responsável, com o telefone à vista: quem liga é a casa. -->
    <div class="tutor">
      <span class="tutor__nome">{{ hospede.tutorNome }}</span>
      <span class="tutor__tel ui-num"
        ><bdi dir="ltr">{{ hospede.tutorTelefone }}</bdi></span
      >
      <!--
        A ação é registrar o contato, e não ligar: o registro mora na estadia — é lá que a
        ocorrência destrava o boletim —, então o botão abre a estadia.
      -->
      <Button
        v-if="estado === 'travado'"
        type="button"
        class="tutor__acao"
        :label="t('hotel.hospedes.acao.registrarContato')"
        icon="ph ph-note-pencil"
        severity="secondary"
        outlined
        size="small"
        @click="emit('abrir', hospede.hospedagem.id)"
      />
    </div>

    <!-- 4 · Agora na rotina: a tarefa em foco e o relógio dela. -->
    <div class="foco" :class="{ 'foco--atrasada': hospede.foco?.atrasada }">
      <span
        class="foco__disco"
        :class="{ 'foco__disco--proxima': hospede.foco && !hospede.foco.atrasada }"
      >
        <IconeDeTarefa v-if="hospede.foco" :kind="hospede.foco.kind" />
        <component :is="ICONE_DO_ESTADO[estado]" v-else weight="duotone" aria-hidden="true" />
      </span>

      <span v-if="hospede.foco" class="foco__texto">
        <span class="foco__frase">
          <span class="ui-num foco__hora">{{ formato.hora(hospede.foco.previstaPara) }}</span>
          {{ formato.tarefaKind(hospede.foco.kind) }}
        </span>
        <span class="foco__nota">
          {{ quando }}
          <template v-if="hospede.atrasadas > 1">
            ·
            {{
              t('hotel.hospedes.cartao.atrasadas', { total: hospede.atrasadas }, hospede.atrasadas)
            }}
          </template>
        </span>
      </span>
      <span v-else class="foco__texto foco__texto--calmo">
        {{ t('hotel.hospedes.foco.nadaPendente') }}
      </span>
    </div>

    <!-- 5 · O dia: quanto da rotina já saiu do caminho. -->
    <div class="dia">
      <template v-if="dia">
        <span class="dia__conta ui-num">
          {{ t('hotel.hospedes.dia.contagem', { feitas: dia.resolvidas, total: dia.total }) }}
        </span>
        <span
          class="barra"
          role="img"
          :aria-label="
            t('hotel.hospedes.dia.rotulo') +
            ': ' +
            t('hotel.hospedes.dia.contagem', { feitas: dia.resolvidas, total: dia.total })
          "
        >
          <span class="barra__feito" :style="{ inlineSize: dia.feito }" />
          <span class="barra__atraso" :style="{ inlineSize: dia.atraso }" />
        </span>
      </template>
    </div>

    <i class="ph ph-caret-right seta" aria-hidden="true" />
  </li>
</template>

<style scoped>
/*
 * As colunas vêm da lista (`--hospede-colunas`), para o cabeçalho e as linhas de todos os corredores
 * baterem na mesma vertical. Sem a lista, vale o desenho padrão.
 */
.cartao {
  position: relative;
  display: grid;
  align-items: center;
  gap: 16px;
  min-height: 68px;
  padding: 12px 18px 12px 20px;
  color: var(--tinta);
  grid-template-columns: var(
    --hospede-colunas,
    84px minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 1.15fr) 112px 16px
  );
  transition: background-color var(--pj-tempo-curto) ease;
}

.cartao:hover {
  background: var(--superficie-2);
}

.cartao:has(.quem__nome:focus-visible) {
  outline: 2px solid var(--pj-lugar, var(--hotel));
  outline-offset: -2px;
}

/* --------------------------------------------------------------- 1 · a placa */

/* A placa da porta: o "onde" leva a cor do lugar, como a acomodação em todo o Hotel. */
.placa {
  justify-self: start;
  max-width: 100%;
  overflow: hidden;
  padding: 4px 9px;
  border-radius: 7px;
  background: var(--pj-lugar-fundo, var(--hotel-fundo));
  color: var(--pj-lugar-tinta, var(--hotel-tinta));
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --------------------------------------------------------------- 2 · quem */

.quem {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.quem__rostos {
  position: relative;
  display: inline-flex;
  flex: none;
}

/*
 * O segundo encosta no canto do primeiro e não o cobre: quem nomeia a linha é o titular da
 * estadia, e um acompanhante que esconde o rosto dele troca a identidade da fileira.
 */
.quem__segundo {
  position: absolute;
  inset-block-end: -4px;
  inset-inline-end: -10px;
  box-shadow: 0 0 0 2px var(--superficie);
}

.quem__rostos--dupla {
  margin-inline-end: 8px;
}

.quem__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.quem__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 0;
}

/* O nome é o alvo da linha inteira (link esticado). */
.quem__nome {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  text-align: start;
}

.quem__nome::after {
  position: absolute;
  z-index: 0;
  content: '';
  inset: 0;
}

.quem__nome:focus-visible {
  outline: none;
}

.quem__dupla {
  color: var(--tinta-2);
  font-size: 13px;
}

.quem__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.quem__saida--hoje {
  color: var(--pj-lugar-tinta, var(--hotel-tinta));
  font-weight: 600;
}

.quem__selos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

/* --------------------------------------------------------------- 3 · o responsável */

.tutor {
  display: grid;
  justify-items: start;
  min-width: 0;
  gap: 1px;
}

.tutor__nome {
  max-width: 100%;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tutor__tel {
  color: var(--tinta-2);
  font-size: 13px;
}

/* Sobe acima do véu do nome: sem o `z-index`, o link esticado engoliria o toque. */
.tutor__acao.p-button {
  position: relative;
  z-index: 1;
  margin-top: 6px;
}

/* --------------------------------------------------------------- 4 · agora na rotina */

.foco {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

/*
 * O disco diz o estado pela cor de fundo: vermelho quando a tarefa atrasou, a cor do lugar quando
 * ela é a próxima, neutro quando não há nada. O texto ao lado diz a mesma coisa em palavras.
 */
.foco__disco {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie-3);
  color: var(--tinta-2);
}

.foco__disco :deep(svg) {
  width: 18px;
  height: 18px;
}

.foco--atrasada .foco__disco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.foco__disco--proxima {
  background: var(--pj-lugar-fundo, var(--hotel-fundo));
  color: var(--pj-lugar-tinta, var(--hotel-tinta));
}

.foco__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.foco__texto--calmo {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.foco__frase {
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.foco__hora {
  margin-inline-end: 4px;
}

.foco__nota {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.foco--atrasada .foco__nota {
  color: var(--risco-tinta);
  font-weight: 600;
}

/* --------------------------------------------------------------- 5 · o dia */

.dia {
  display: grid;
  gap: 6px;
}

.dia__conta {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.barra {
  display: flex;
  overflow: hidden;
  height: 6px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.barra__feito {
  background: var(--pj-lugar, var(--hotel));
}

.barra__atraso {
  background: var(--risco);
}

.seta {
  color: var(--tinta-3);
  font-size: 16px;
}

[dir='rtl'] .seta {
  transform: scaleX(-1);
}

/*
 * Estreita, a linha vira um bloco de três andares: quem (com a placa à direita), a rotina, e o
 * responsável. A lista é o contêiner (`casa`), então a troca acompanha a largura da folha, e não
 * a da janela.
 */
@container casa (max-width: 820px) {
  .cartao {
    align-items: start;
    gap: 12px 14px;
    padding: 14px 16px 16px 18px;
    grid-template-areas:
      'quem placa'
      'foco dia'
      'tutor tutor';
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .placa {
    grid-area: placa;
    justify-self: end;
  }

  .quem {
    grid-area: quem;
  }

  .tutor {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 10px;
    grid-area: tutor;
    padding-inline-start: 50px;
  }

  .tutor__acao.p-button {
    margin-top: 0;
  }

  .foco {
    grid-area: foco;
    padding-inline-start: 50px;
  }

  .dia {
    width: 96px;
    grid-area: dia;
    align-self: center;
  }

  .seta {
    display: none;
  }
}

@container casa (max-width: 460px) {
  .cartao {
    grid-template-areas:
      'quem placa'
      'foco foco'
      'dia dia'
      'tutor tutor';
  }

  .foco,
  .dia,
  .tutor {
    padding-inline-start: 50px;
  }

  .dia {
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cartao {
    transition: none;
  }
}
</style>
