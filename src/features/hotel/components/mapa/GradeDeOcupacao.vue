<script setup lang="ts">
/**
 * A grade de ocupação — linhas são acomodações, colunas são **noites**.
 *
 * É a tela que faz um sistema de hotel fazer sentido, e a primeira versão deste módulo não a
 * tinha: havia uma fileira de cartões dizendo "8 livres", que é a resposta certa para uma
 * pergunta que ninguém faz. A pergunta do telefone é "tem vaga do dia 22 ao dia 30?", e ela não
 * se responde com um número — se responde **olhando o buraco** entre duas barras.
 *
 * Três decisões de desenho que vêm disso:
 *
 * 1. **O vazio é a informação.** As barras são o que está vendido; o que se procura é o espaço
 *    entre elas. Por isso a célula livre tem fundo próprio e a barra é sólida: o olho varre a
 *    linha atrás da lacuna, não atrás da cor.
 * 2. **A noite da saída não é ocupada.** Quem sai dia 30 ao meio-dia libera aquela noite. Pintar
 *    o dia 30 mostraria à recepção uma diária cheia que está à venda — e é assim que um hotel
 *    perde receita sem saber.
 * 3. **A barra diz de quem é.** Um retângulo colorido sem nome obriga a clicar para saber quem
 *    está lá, e quem opera pergunta pelo nome do animal, nunca pelo número da baia.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { FaixaNaGrade, GradeDeOcupacao, LinhaDaGrade } from '../../data/repositories'
import type { Bloco, ISODate } from '../../data/types'
import { useHotelStore } from '../../stores/hotel'

const props = defineProps<{
  grade: GradeDeOcupacao
  blocos: Bloco[]
  hoje: ISODate
  /** Intervalo que o usuário procura, para a grade destacar o que serve. `null` desliga o realce. */
  procura: { de: ISODate; ate: ISODate } | null
}>()

const emit = defineEmits<{
  abrirReserva: [reservaId: string]
  reservar: [payload: { acomodacaoId: string; dia: ISODate }]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
/* O nome do tipo é cadastro da casa, não tradução nossa: sai da store, não do formatador. */
const hotelStore = useHotelStore()

/** Agrupa por bloco, na ordem física da casa. */
const grupos = computed(() =>
  props.blocos
    .map((bloco) => ({
      bloco,
      linhas: props.grade.linhas.filter((linha) => linha.acomodacao.blocoId === bloco.id),
    }))
    .filter((grupo) => grupo.linhas.length > 0),
)

const colunas = computed(() => props.grade.dias.length)

/** Recorte da procura em índices de coluna, para pintar a faixa que o usuário pediu. */
const recorte = computed(() => {
  if (!props.procura) {
    return null
  }

  const de = props.grade.dias.indexOf(props.procura.de)
  const ate = props.grade.dias.indexOf(props.procura.ate)

  return de < 0 || ate < 0 ? null : { de, ate }
})

/**
 * A linha serve para o que se procura?
 *
 * Serve quando **todas** as noites do intervalo pedido estão livres. É o que permite a grade
 * apagar o ruído e deixar acesas só as linhas que respondem ao telefone.
 */
function serveParaAProcura(linha: LinhaDaGrade): boolean {
  const alvo = recorte.value

  if (!alvo || !linha.acomodacao.ativa) {
    return false
  }

  for (let dia = alvo.de; dia < alvo.ate; dia += 1) {
    if (linha.faixas.some((faixa) => faixa.de <= dia && dia < faixa.ate)) {
      return false
    }
  }

  return true
}

function ehFimDeSemana(data: ISODate): boolean {
  const dia = new Date(`${data}T12:00:00Z`).getUTCDay()

  return dia === 0 || dia === 6
}

/** Texto do dia no cabeçalho: `qua` em cima, `24` embaixo. */
function diaDaSemana(data: ISODate): string {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(`${data}T12:00:00Z`))
    .replace('.', '')
}

function numeroDoDia(data: ISODate): string {
  return data.slice(8, 10)
}

/**
 * O que cabe dentro da barra.
 *
 * Uma estadia de uma noite tem 35 px de largura, e "Bento" vira "B…" — que não é o nome de
 * ninguém. Abaixo de duas noites a barra mostra as iniciais, que ao menos identificam; o nome
 * inteiro continua no `title` e na tela da reserva.
 */
function rotuloDaBarra(faixa: FaixaNaGrade): string {
  const noites = faixa.ate - faixa.de

  if (noites <= 1) {
    return faixa.petIniciais
  }

  return faixa.acompanhanteNome && noites > 3
    ? `${faixa.petNome} + ${faixa.acompanhanteNome}`
    : faixa.petNome
}

/** Primeiro dia de cada mês ganha o rótulo do mês — a grade atravessa a virada. */
function inicioDeMes(data: ISODate, indice: number): string {
  if (indice > 0 && data.slice(8, 10) !== '01') {
    return ''
  }

  return new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
    .format(new Date(`${data}T12:00:00Z`))
    .replace('.', '')
}
</script>

<template>
  <div class="grade">
    <div class="grade__rolagem">
      <table class="tabela">
        <caption class="sr-only">
          {{
            t('hotel.grade.legendaTabela')
          }}
        </caption>

        <thead>
          <tr>
            <th scope="col" class="tabela__canto">{{ t('hotel.grade.acomodacao') }}</th>

            <th
              v-for="(dia, indice) in grade.dias"
              :key="dia"
              scope="col"
              class="dia"
              :class="{
                'dia--fim-de-semana': ehFimDeSemana(dia),
                'dia--hoje': dia === hoje,
                'dia--procurado': recorte !== null && indice >= recorte.de && indice < recorte.ate,
              }"
            >
              <span class="dia__mes">{{ inicioDeMes(dia, indice) }}</span>
              <span class="dia__semana">{{ diaDaSemana(dia) }}</span>
              <span class="dia__numero clinic-value">{{ numeroDoDia(dia) }}</span>
            </th>
          </tr>
        </thead>

        <tbody v-for="grupo in grupos" :key="grupo.bloco.id">
          <tr class="bloco">
            <th scope="colgroup" :colspan="colunas + 1">{{ grupo.bloco.nome }}</th>
          </tr>

          <tr
            v-for="linha in grupo.linhas"
            :key="linha.acomodacao.id"
            class="linha"
            :class="{
              'linha--parada': !linha.acomodacao.ativa,
              'linha--serve': serveParaAProcura(linha),
              'linha--apagada': recorte !== null && !serveParaAProcura(linha),
            }"
          >
            <th scope="row" class="acom">
              <span class="acom__nome">{{ linha.acomodacao.nome }}</span>
              <span class="acom__tipo">
                {{ hotelStore.tipoDeAcomodacao(linha.acomodacao.tipoId)?.nome }} ·
                {{ formato.porte(linha.acomodacao.porteMaximo) }}
              </span>
            </th>

            <!--
              Uma célula por noite, e as barras por cima com `grid-column`. Célula por dia — em vez
              de uma faixa absoluta — é o que mantém o clique no vazio significando "reservar a
              partir deste dia", que é como se vende no telefone.
            -->
            <td :colspan="colunas" class="faixa">
              <div class="faixa__grade" :style="{ '--colunas': colunas }">
                <button
                  v-for="(dia, indice) in grade.dias"
                  :key="dia"
                  type="button"
                  class="celula"
                  :class="{
                    'celula--fim-de-semana': ehFimDeSemana(dia),
                    'celula--hoje': dia === hoje,
                    'celula--procurada':
                      recorte !== null && indice >= recorte.de && indice < recorte.ate,
                  }"
                  :style="{ gridColumn: `${indice + 1} / span 1` }"
                  :disabled="!linha.acomodacao.ativa"
                  :aria-label="
                    t('hotel.grade.reservarEm', {
                      acomodacao: linha.acomodacao.nome,
                      data: formato.data(dia),
                    })
                  "
                  @click="emit('reservar', { acomodacaoId: linha.acomodacao.id, dia })"
                />

                <button
                  v-for="faixa in linha.faixas"
                  :key="faixa.reservaId"
                  type="button"
                  class="barra"
                  :class="[
                    `barra--${faixa.status}`,
                    {
                      'barra--entra-antes': faixa.entraAntes,
                      'barra--sai-depois': faixa.saiDepois,
                      'barra--atencao': faixa.admissao !== 'ok' && faixa.admissao !== 'dispensado',
                    },
                  ]"
                  :style="{ gridColumn: `${faixa.de + 1} / ${faixa.ate + 1}` }"
                  :title="
                    t('hotel.grade.barraTitulo', {
                      pet: faixa.petNome,
                      tutor: faixa.tutorNome,
                      periodo: formato.periodo(faixa.entradaPrevista, faixa.saidaPrevista),
                    })
                  "
                  @click="emit('abrirReserva', faixa.reservaId)"
                >
                  <i
                    v-if="faixa.admissao !== 'ok' && faixa.admissao !== 'dispensado'"
                    class="ph ph-warning"
                    aria-hidden="true"
                  />
                  <PetAvatar
                    v-if="faixa.ate - faixa.de > 1"
                    :nome="faixa.petNome"
                    :iniciais="faixa.petIniciais"
                    :especie="faixa.petEspecie"
                    :foto-url="faixa.petFotoUrl"
                    tamanho="xs"
                  />
                  <span class="barra__nome">{{ rotuloDaBarra(faixa) }}</span>
                </button>

                <!-- Fora de operação: hachura por cima da linha inteira, sem esconder o nome. -->
                <span
                  v-if="!linha.acomodacao.ativa"
                  class="parada"
                  :style="{ gridColumn: `1 / ${colunas + 1}` }"
                >
                  {{ formato.motivoInativa(linha.acomodacao.motivoInativa ?? 'outro') }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!--
      Legenda fixa embaixo. Uma grade colorida sem legenda obriga quem chega a inferir o
      significado das cores pelo contexto — e a inferir errado na primeira vez que importa.
    -->
    <ul class="legenda">
      <li>
        <span class="amostra amostra--livre" aria-hidden="true" />{{
          t('hotel.grade.legenda.livre')
        }}
      </li>
      <li>
        <span class="amostra amostra--hospedado" aria-hidden="true" />{{
          t('hotel.grade.legenda.hospedado')
        }}
      </li>
      <li>
        <span class="amostra amostra--confirmada" aria-hidden="true" />{{
          t('hotel.grade.legenda.confirmada')
        }}
      </li>
      <li>
        <span class="amostra amostra--pendente" aria-hidden="true" />{{
          t('hotel.grade.legenda.pendente')
        }}
      </li>
      <li>
        <span class="amostra amostra--atencao" aria-hidden="true" />{{
          t('hotel.grade.legenda.atencao')
        }}
      </li>
      <li>
        <span class="amostra amostra--parada" aria-hidden="true" />{{
          t('hotel.grade.legenda.parada')
        }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.grade {
  display: grid;
  gap: var(--clinic-space-3);
}

.grade__rolagem {
  overflow-x: auto;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.tabela {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ------------------------------------------------------------------ cabeçalho de dias */

.tabela__canto {
  position: sticky;
  z-index: 3;
  width: 11rem;
  min-width: 11rem;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-bottom: 1px solid var(--clinic-line);
  background: var(--clinic-surface);
  color: var(--clinic-faint);
  font-size: 0.75rem;
  font-weight: 600;
  inset-inline-start: 0;
  text-align: start;
}

.dia {
  min-width: 2.35rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--clinic-line);
  border-inline-start: 1px solid var(--clinic-line-soft);
  background: var(--clinic-surface);
  font-weight: 600;
  line-height: 1.1;
}

.dia--fim-de-semana {
  background: var(--clinic-surface-soft);
}

.dia--procurado {
  background: var(--clinic-accent-soft);
  box-shadow: inset 0 -3px 0 var(--clinic-accent-deep);
}

.dia--hoje {
  box-shadow: inset 0 -2px 0 var(--clinic-accent-strong);
}

.dia__mes,
.dia__semana,
.dia__numero {
  display: block;
  text-align: center;
}

.dia__mes {
  height: 0.8rem;
  color: var(--clinic-accent-strong);
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
}

.dia__semana {
  color: var(--clinic-faint);
  font-size: 0.58rem;
  text-transform: lowercase;
}

.dia__numero {
  font-size: 0.78rem;
  font-weight: 750;
}

/* ------------------------------------------------------------------ linhas */

.bloco th {
  position: sticky;
  z-index: 2;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-block: 1px solid var(--clinic-line-soft);
  background: var(--clinic-surface-sunken);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  inset-inline-start: 0;
  text-align: start;
}

.acom {
  position: sticky;
  z-index: 2;
  display: table-cell;
  padding: 0.3rem var(--clinic-space-3);
  border-bottom: 1px solid var(--clinic-line-soft);
  background: var(--clinic-surface);
  inset-inline-start: 0;
  text-align: start;
}

.acom__nome {
  display: block;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.acom__tipo {
  display: block;
  color: var(--clinic-faint);
  font-size: 0.62rem;
}

.linha--parada .acom__nome {
  color: var(--clinic-faint);
}

/*
 * Apagar, e não esconder: quando há uma procura ativa, as linhas que não servem continuam
 * legíveis — some o peso, não a informação. Esconder faria a recepção achar que a casa encolheu.
 *
 * ## Por que dessaturar, e não baixar a opacidade
 *
 * A versão anterior usava `opacity: 0.38`, e o resultado contrariava o próprio parágrafo acima: a
 * opacidade atravessa tudo, inclusive o nome do hóspede dentro da barra, e a 0.38 o nome sumia no
 * fundo. Quem procurava "tem baia grande livre?" perdia de vista **quem estava nas outras baias**
 * — que é exatamente a informação que se usa para negociar uma troca.
 *
 * Dessaturar separa as duas coisas. A **cor** é o que diz "esta linha entrou na sua busca", então
 * é a cor que precisa sumir; a **luminância** é o que sustenta a leitura do texto, e ela fica.
 * Perto do cinza, a linha deixa de competir por atenção sem deixar de ser legível.
 */
.linha--apagada .acom,
.linha--apagada .faixa {
  filter: saturate(0.18) opacity(0.78);
}

/*
 * Apontar devolve a linha inteira. Procurar acomodação é justamente o momento em que se precisa
 * ler quem já está nas que não servem, e obrigar a limpar o filtro para isso é obrigar a perder o
 * resultado da busca para consultar o que está do lado dele.
 */
.linha--apagada:hover .acom,
.linha--apagada:hover .faixa,
.linha--apagada:focus-within .acom,
.linha--apagada:focus-within .faixa {
  filter: none;
}

/*
 * A acomodação que serve para a busca ganha o fundo verde-claro de "escolhido", na célula do nome.
 * Era uma faixa de 3 px na borda esquerda — o acento lateral que o design da casa recusa —, e as
 * que não servem já saem apagadas: o contraste entre as duas é o que se lê.
 */
.linha--serve .acom {
  background: var(--clinic-accent-tint);
}

.faixa {
  padding: 0;
  border-bottom: 1px solid var(--clinic-line-soft);
}

.faixa__grade {
  display: grid;
  height: 2.1rem;
  grid-template-columns: repeat(var(--colunas), minmax(2.35rem, 1fr));
  grid-template-rows: 1fr;
}

/* ------------------------------------------------------------------ células e barras */

.celula {
  grid-row: 1;
  border: 0;
  border-inline-start: 1px solid var(--clinic-line-soft);
  background: transparent;
  cursor: cell;
}

.celula--fim-de-semana {
  background: color-mix(in srgb, var(--clinic-surface-soft) 70%, transparent);
}

.celula--procurada {
  background: color-mix(in srgb, var(--clinic-accent-soft) 85%, transparent);
}

.celula--hoje {
  box-shadow: inset 1px 0 0 var(--clinic-accent-strong);
}

.celula:disabled {
  cursor: default;
}

.celula:not(:disabled):hover {
  background: var(--clinic-accent-tint);
  box-shadow: inset 0 0 0 1px var(--clinic-accent-soft);
}

.barra {
  z-index: 1;
  display: flex;
  overflow: hidden;
  align-items: center;
  margin: 0.22rem 1px;
  padding: 0 0.4rem;
  border: 1px solid transparent;
  border-radius: 0.35rem;
  gap: 0.25rem;
  grid-row: 1;
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  text-align: start;
  white-space: nowrap;
  /*
   * O anel já nasce aqui, transparente. Declará-lo só no `:hover` faria a largura ir de zero a dois
   * — a cor não teria de onde transicionar, e o realce apareceria de estalo. Reservado desde o
   * início, o hover troca apenas a cor, que é o que `transition` sabe animar.
   */
  outline: 2px solid transparent;
  outline-offset: 1px;
  transition: outline-color 150ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .barra {
    transition: none;
  }
}

.barra__nome {
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * O realce é um anel, e não um clareamento.
 *
 * O hover anterior era `brightness(0.94)`, que funciona num fundo cheio e desaparece nos outros
 * dois: a barra `--pendente` é quase branca com contorno tracejado, e escurecê-la 6% não produz
 * diferença que alguém perceba. Um anel lê igual nas três variantes, porque não depende da cor
 * que a barra já tem.
 *
 * `outline`, e não `box-shadow`, porque `--atencao` usa `box-shadow: inset` para o contorno âmbar:
 * declarar sombra aqui apagaria o aviso justo na barra em que ele mais importa. E `z-index` sobe
 * porque as barras se encostam — sem isso o anel fica por baixo da vizinha.
 */
.barra:hover,
.barra:focus-visible {
  z-index: 2;
  outline-color: var(--clinic-accent-strong);
}

/* Quem está dentro da casa: cor cheia. Quem vem chegando: mais leve. Quem não pagou: contorno. */
.barra--hospedado {
  background: var(--clinic-accent-deep);
  color: var(--clinic-on-accent);
}

.barra--confirmada {
  background: var(--clinic-accent);
  color: var(--clinic-heat-ink);
}

.barra--pendente {
  border-color: var(--clinic-accent-deep);
  border-style: dashed;
  background: var(--clinic-surface);
  color: var(--clinic-accent-strong);
}

.barra--atencao {
  box-shadow: inset 0 0 0 2px var(--clinic-attention-text);
}

.barra--atencao i {
  color: var(--clinic-attention-text);
  font-size: 0.6rem;
}

.barra--hospedado.barra--atencao i {
  color: var(--clinic-attention-bg);
}

/* Seta na ponta: a estadia continua fora do intervalo que está à vista. */
.barra--entra-antes {
  margin-inline-start: 0;
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}

.barra--sai-depois {
  margin-inline-end: 0;
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}

.parada {
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.22rem 1px;
  border-radius: 0.35rem;
  background: repeating-linear-gradient(
    45deg,
    var(--clinic-surface-sunken),
    var(--clinic-surface-sunken) 4px,
    var(--clinic-line-soft) 4px,
    var(--clinic-line-soft) 8px
  );
  color: var(--clinic-muted);
  font-size: 0.62rem;
  font-weight: 700;
  grid-row: 1;
  pointer-events: none;
}

/* ------------------------------------------------------------------ legenda */

.legenda {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-3);
  margin: 0;
  padding: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  list-style: none;
}

.legenda li {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.amostra {
  width: 1.1rem;
  height: 0.7rem;
  border: 1px solid transparent;
  border-radius: 0.25rem;
}

.amostra--livre {
  border-color: var(--clinic-line);
  background: var(--clinic-surface);
}

.amostra--hospedado {
  background: var(--clinic-accent-deep);
}

.amostra--confirmada {
  background: var(--clinic-accent);
}

.amostra--pendente {
  border-color: var(--clinic-accent-deep);
  border-style: dashed;
  background: var(--clinic-surface);
}

.amostra--atencao {
  background: var(--clinic-accent);
  box-shadow: inset 0 0 0 2px var(--clinic-attention-text);
}

.amostra--parada {
  background: repeating-linear-gradient(
    45deg,
    var(--clinic-surface-sunken),
    var(--clinic-surface-sunken) 3px,
    var(--clinic-line-soft) 3px,
    var(--clinic-line-soft) 6px
  );
}
</style>
