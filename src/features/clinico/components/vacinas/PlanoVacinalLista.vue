<script setup lang="ts">
/**
 * O protocolo do paciente, na ordem em que pede ação.
 *
 * Uma linha por vacina: o ícone no bloco, o nome (com "obrigatória" quando é lei), a série em que
 * ele está e, à direita, **o estado em selo com palavra** — "Atrasada há 16 dias", "Vence em 25
 * dias", "Série aberta", "Em dia". Na folha da ficha, a linha leva também a marca de gravidade na
 * borda: o atrasado salta da lista sem que a linha inteira vire vermelha.
 *
 * A sequência de doses só abre onde ela é a informação: série em andamento, e filhote que ainda
 * não começou. O adulto em dia é uma linha, com a data do reforço; desenhar para ele três bolinhas
 * já cheias seria enfeite. "Onde ele está" é a dose marcada como **agora** — a primeira que não foi
 * dada. É o que o vet confere antes de aplicar.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDaVacina } from '../../composables/useRotulosDaVacina'
import { diffDays } from '../../domain/clinic-time'
import type { PlanoVacinal, SituacaoNoPlano, VacinaNoPlano } from '../../domain/protocolo-vacinal'
import { clinicClock } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    plano: PlanoVacinal
    somenteLeitura?: boolean
    /**
     * A lista mora numa folha (a ficha): as linhas ganham recuo lateral e a marca de gravidade na
     * borda. Sem isso (o prontuário), a lista encosta no cartão de quem a usa.
     */
    folha?: boolean
  }>(),
  { somenteLeitura: false, folha: false },
)

const emit = defineEmits<{
  aplicar: [vacinaId: string]
}>()

const { t } = useI18n()
const rotulos = useRotulosDaVacina()
const formato = useClinicFormat()

type Tom = 'risco' | 'atencao' | 'ok' | 'neutro'

/**
 * O tom e o ícone de cada situação. Só o atrasado é risco; o que vence ou pode começar hoje é
 * atenção; quem aguarda a idade é neutro; em dia é ok. O ícone repete o tom em forma, para a
 * diferença sobreviver sem cor.
 */
const APARENCIA: Record<SituacaoNoPlano, { tom: Tom; icone: string }> = {
  atrasada: { tom: 'risco', icone: 'ph-warning-circle' },
  devida: { tom: 'atencao', icone: 'ph-syringe' },
  'a-vencer': { tom: 'atencao', icone: 'ph-clock' },
  'nao-iniciada': { tom: 'atencao', icone: 'ph-syringe' },
  'aguarda-idade': { tom: 'neutro', icone: 'ph-hourglass' },
  'em-dia': { tom: 'ok', icone: 'ph-check-circle' },
}

/** A sequência abre onde ela responde alguma coisa. */
function mostrarSequencia(item: VacinaNoPlano): boolean {
  if (item.total <= 1) {
    return false
  }

  return !item.serieCompleta
}

/** Série começada e ainda aberta, sem prazo vencendo: é o "Série aberta" do selo. */
function serieAberta(item: VacinaNoPlano): boolean {
  return item.total > 1 && item.aplicadasNaSerie > 0 && !item.serieCompleta
}

/** Onde a dose foi dada, quando não foi aqui. */
function localExterno(item: VacinaNoPlano, numero: number): string | null {
  const dose = item.doses.find((d) => d.numero === numero && d.tipo === 'serie')

  return dose?.aplicacao?.externa?.local ?? null
}

/** A dose que pede ação agora — é nela que o botão da linha aplica. */
function pedeAplicacao(item: VacinaNoPlano): boolean {
  return ['atrasada', 'devida', 'nao-iniciada'].includes(item.situacao)
}

/** O estado em palavra, no selo: o prazo quando há prazo, a situação quando não há. */
function textoDoSelo(item: VacinaNoPlano): string {
  const proxima = item.proxima

  switch (item.situacao) {
    case 'atrasada':
    case 'nao-iniciada':
    case 'aguarda-idade':
      return proxima ? rotulos.quando(proxima) : rotulos.situacao(item.situacao)
    case 'devida':
      return proxima && diffDays(clinicClock.today(), proxima.em) < 0
        ? rotulos.quando(proxima)
        : rotulos.situacao('devida')
    case 'a-vencer': {
      const dias = proxima ? diffDays(clinicClock.today(), proxima.em) : 0

      return t('clinico.vacinas.plano.venceEm', { dias }, dias)
    }
    default:
      return serieAberta(item)
        ? t('clinico.vacinas.situacao.serie-incompleta')
        : rotulos.situacao('em-dia')
  }
}

const linhas = computed(() =>
  props.plano.vacinas.map((item) => {
    const proxima = item.proxima
    const aparencia =
      item.situacao === 'em-dia' && serieAberta(item)
        ? { tom: 'neutro' as Tom, icone: 'ph-syringe' }
        : APARENCIA[item.situacao]

    /* Dose única não é série: "série de filhote, 1 doses" dizia duas coisas erradas de uma vez. */
    if (item.total === 1) {
      return {
        item,
        proxima,
        aparencia,
        meta:
          item.aplicadasNaSerie === 0
            ? t('clinico.vacinas.plano.unicaNaoComecou')
            : t('clinico.vacinas.plano.unicaComReforco'),
      }
    }

    return {
      item,
      proxima,
      aparencia,
      meta: item.serieCompleta
        ? t('clinico.vacinas.plano.serieCompleta', { serie: rotulos.serie(item.tipoDeSerie) })
        : item.aplicadasNaSerie === 0
          ? t('clinico.vacinas.plano.naoComecou', {
              serie: rotulos.serie(item.tipoDeSerie),
              total: item.total,
            })
          : t('clinico.vacinas.plano.emAndamento', {
              serie: rotulos.serie(item.tipoDeSerie),
              feitas: item.aplicadasNaSerie,
              total: item.total,
            }),
    }
  }),
)
</script>

<template>
  <ul class="plano" :class="{ 'plano--folha': folha }">
    <li
      v-for="{ item, proxima, meta, aparencia } in linhas"
      :key="item.vacina.id"
      class="plano__linha"
      :class="
        folha && (aparencia.tom === 'risco' || aparencia.tom === 'atencao')
          ? ['ui-marca', `ui-marca--${aparencia.tom}`]
          : []
      "
      :data-situacao="item.situacao"
    >
      <span class="plano__bloco" :class="`plano__bloco--${aparencia.tom}`" aria-hidden="true">
        <i class="ph" :class="aparencia.icone" />
      </span>

      <div class="plano__corpo">
        <p class="plano__titulo">
          <strong>{{ item.vacina.nome }}</strong>
          <span v-if="item.vacina.obrigatoria" class="ui-selo ui-selo--contorno plano__obrigatoria">
            {{ t('clinico.vacinas.obrigatoria') }}
          </span>
        </p>
        <p class="plano__meta">{{ meta }}</p>

        <!--
          A sequência inteira, e a dose da vez marcada como "agora". Doses dadas fora levam o
          nome do lugar: é a primeira pergunta de quem vê uma dose sem lote.
        -->
        <ol
          v-if="mostrarSequencia(item)"
          class="sequencia"
          :aria-label="t('clinico.vacinas.plano.sequencia', { vacina: item.vacina.nome })"
        >
          <li
            v-for="(dose, indice) in item.doses"
            :key="`${dose.tipo}-${dose.numero}-${indice}`"
            class="sequencia__passo"
            :class="[
              `sequencia__passo--${dose.estado}`,
              { 'sequencia__passo--agora': dose === proxima },
            ]"
            :aria-current="dose === proxima ? 'step' : undefined"
          >
            <span class="sequencia__marca" aria-hidden="true">
              <i v-if="dose.estado === 'aplicada'" class="ph ph-check" />
              <i v-else-if="dose.estado === 'aguarda-idade'" class="ph ph-hourglass" />
              <i v-else-if="dose.tipo === 'reforco'" class="ph ph-arrow-counter-clockwise" />
            </span>
            <span class="sequencia__rotulo">
              <strong>{{ rotulos.numero(dose) }}</strong>
              <span class="ui-num">{{ rotulos.quando(dose) }}</span>
              <span v-if="dose === proxima" class="sequencia__agora">
                {{ t('clinico.vacinas.plano.agora') }}
              </span>
              <span
                v-else-if="dose.estado === 'aplicada' && localExterno(item, dose.numero)"
                class="sequencia__fora"
              >
                <i class="ph ph-map-pin" aria-hidden="true" />
                {{ localExterno(item, dose.numero) }}
              </span>
            </span>
          </li>
        </ol>
      </div>

      <div class="plano__estado">
        <span class="ui-selo" :class="`ui-selo--${aparencia.tom}`">
          <i class="ph" :class="aparencia.icone" aria-hidden="true" />
          {{ textoDoSelo(item) }}
        </span>
        <span v-if="proxima" class="plano__quando">
          {{ rotulos.numero(proxima) }} · <span class="ui-num">{{ rotulos.data(proxima.em) }}</span>
        </span>
        <span v-if="proxima?.agendamento" class="plano__marcada">
          <i class="ph ph-calendar-check" aria-hidden="true" />
          {{
            t('clinico.vacinas.plano.marcadaPara', {
              data: rotulos.data(proxima.agendamento.inicio.slice(0, 10)),
              hora: formato.hora(proxima.agendamento.inicio),
            })
          }}
        </span>
      </div>

      <!--
        Contornado, não cheio: a ação principal da tela é o "Aplicar vacina" do alto. Este é o
        atalho que já chega com a vacina da linha escolhida.
      -->
      <div class="plano__acao">
        <Button
          v-if="!somenteLeitura && pedeAplicacao(item)"
          type="button"
          icon="ph ph-syringe"
          :label="t('clinico.vacinas.aplicar.atalho')"
          :aria-label="`${t('clinico.vacinas.aplicar.atalho')}: ${item.vacina.nome}`"
          severity="secondary"
          outlined
          size="small"
          class="plano__aplicar"
          @click="emit('aplicar', item.vacina.id)"
        />
      </div>
    </li>

    <li v-if="plano.opcionaisNaoIniciadas.length > 0" class="plano__opcionais">
      <i class="ph ph-info" aria-hidden="true" />
      <span>
        {{
          t('clinico.vacinas.plano.opcionais', {
            lista: plano.opcionaisNaoIniciadas.map((vacina) => vacina.nome).join(', '),
          })
        }}
      </span>
    </li>
  </ul>
</template>

<style scoped>
.plano {
  --plano-recuo: 0px;

  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.plano--folha {
  --plano-recuo: 20px;
}

.plano > li + li {
  border-top: 1px solid var(--linha);
}

.plano__linha {
  position: relative;
  display: grid;
  align-items: center;
  gap: 8px 16px;
  grid-template-columns: auto minmax(0, 1fr) minmax(11rem, auto) minmax(6.5rem, auto);
  min-height: 72px;
  padding: 14px var(--plano-recuo);
}

/* O bloco do ícone, no tom da situação. Só o atrasado é cheio: numa lista de seis, seis blocos
   cheios seriam uma parede e o atrasado deixaria de saltar. */
.plano__bloco {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-size: 21px;
}

.plano__bloco--risco {
  background: var(--risco);
  color: var(--superficie);
}

.plano__bloco--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.plano__bloco--ok {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.plano__corpo {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.plano__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  gap: 4px 8px;
  color: var(--tinta);
  font-size: 15px;
}

.plano__titulo strong {
  font-weight: 600;
}

.plano__obrigatoria.ui-selo {
  height: 20px;
  padding-inline: 7px;
  font-size: 11.5px;
}

.plano__meta {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.plano__estado {
  display: grid;
  justify-items: end;
  gap: 4px;
  text-align: end;
}

.plano__quando {
  color: var(--tinta-2);
  font-size: 13px;
}

.plano__marcada {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--musgo);
  font-size: 13px;
  font-weight: 600;
}

.plano__acao {
  display: flex;
  justify-content: flex-end;
}

.plano__aplicar.p-button {
  min-height: 36px;
  white-space: nowrap;
}

.plano__opcionais {
  display: flex;
  align-items: baseline;
  padding: 12px var(--plano-recuo) 14px;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

/* ------------------------------------------------------------------ sequência */

.sequencia {
  display: flex;
  flex-wrap: wrap;
  margin: 10px 0 2px;
  padding: 0;
  gap: 10px 0;
  list-style: none;
}

.sequencia__passo {
  position: relative;
  display: grid;
  min-width: 7.5rem;
  align-items: start;
  padding-inline-end: 16px;
  gap: 8px;
  grid-template-columns: auto minmax(0, 1fr);
}

/* O fio entre um passo e o seguinte. */
.sequencia__passo:not(:last-child)::after {
  position: absolute;
  top: 10px;
  width: 12px;
  height: 2px;
  border-radius: 2px;
  background: var(--linha);
  content: '';
  inset-inline-end: 2px;
}

.sequencia__marca {
  display: grid;
  width: 20px;
  height: 20px;
  border: 2px solid var(--linha-forte);
  border-radius: 50%;
  background: var(--superficie);
  color: var(--tinta-2);
  font-size: 11px;
  place-items: center;
}

.sequencia__passo--aplicada .sequencia__marca {
  border-color: var(--musgo);
  background: var(--musgo);
  color: var(--sobre-musgo);
}

.sequencia__passo--agora .sequencia__marca {
  border-color: var(--clinica);
  box-shadow: 0 0 0 3px var(--clinica-fundo);
}

.sequencia__passo--atrasada.sequencia__passo--agora .sequencia__marca {
  border-color: var(--risco);
  box-shadow: 0 0 0 3px var(--risco-fundo);
}

.sequencia__rotulo {
  display: grid;
  gap: 1px;
  color: var(--tinta);
  font-size: 13px;
  line-height: 1.35;
}

.sequencia__rotulo strong {
  font-weight: 600;
}

.sequencia__rotulo > span {
  color: var(--tinta-2);
}

.sequencia__passo--agora .sequencia__rotulo > span:first-of-type {
  color: var(--tinta);
  font-weight: 550;
}

.sequencia__agora {
  width: fit-content;
  margin-top: 2px;
  padding: 1px 7px;
  border-radius: 6px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta) !important;
  font-size: 11.5px;
  font-weight: 600;
}

.sequencia__passo--atrasada .sequencia__agora {
  background: var(--risco-fundo);
  color: var(--risco-tinta) !important;
}

.sequencia__fora {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

@media (max-width: 860px) {
  .plano__linha {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .plano__estado {
    grid-column: 2;
    grid-row: 2;
    justify-items: start;
    text-align: start;
  }

  .plano__acao {
    grid-column: 3;
    grid-row: 1 / 3;
    align-self: center;
  }
}

@media (max-width: 560px) {
  .plano__linha {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .plano__acao {
    grid-column: 2;
    grid-row: auto;
    justify-content: flex-start;
  }
}
</style>
