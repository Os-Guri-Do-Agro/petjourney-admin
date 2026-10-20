<script setup lang="ts">
/**
 * Uma linha da caixa de pedidos de reserva: as noites, quem, o que pediu, quanto falta para
 * responder — e a resposta a um clique.
 *
 * A mesma leitura da caixa da clínica. À esquerda, grande, as noites pedidas ("28–31", com o mês
 * em cima e as diárias embaixo): "para quando?" antes de qualquer leitura. Depois o pet e quem
 * pede, o tipo escolhido (ou "o hotel escolhe") com o que muda a resposta, o prazo como contagem
 * regressiva e os botões. Porte, extras, observação, telefone de quem veio pelo link e a escolha
 * de outra unidade moram na gaveta que "Responder" abre.
 *
 * O botão cheio diz a unidade: "Reservar Suíte S1". Ninguém aceita sem saber onde o animal vai
 * dormir. O prazo tem tom — risco quando passou ou falta meia hora, atenção nas duas horas
 * seguintes, neutro no resto — e a palavra embaixo diz o mesmo para quem não vê a cor.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { PedidoDeReservaNaCaixa } from '../../data/reserva-online'
import { agoraIso, getDataset } from '../../data/store'
import { contarDiarias, dataDe } from '../../domain/hotel-time'
import { situacaoDoPrazoDaReserva } from '../../domain/pedidos-de-reserva'

const props = defineProps<{
  linha: PedidoDeReservaNaCaixa
  respondendo: boolean
  ocupado: boolean
  /** A gaveta está aberta nesta linha. */
  aberta: boolean
}>()

const emit = defineEmits<{
  aceitar: [escolha: { acomodacaoId: string; inicio: string; fim: string } | null]
  abrir: []
}>()

const { t, locale } = useI18n()
const formato = useHotelFormat()

/** Até duas horas para vencer, o prazo pede atenção: é a manhã de quem abriu a caixa agora. */
const MINUTOS_DE_ATENCAO = 120

const pedido = computed(() => props.linha.pedido)

const tag = computed(() => INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE])

function pet(id: string | null) {
  return id ? (getDataset().pets.find((item) => item.id === id) ?? null) : null
}

const pets = computed(() => {
  const lista = [pedido.value.petId, pedido.value.acompanhantePetId]
    .filter((id): id is string => Boolean(id))
    .map((id) => pet(id))
    .filter((item) => item !== null)
    .map((item) => ({
      id: item.id,
      nome: item.nome,
      iniciais: item.iniciais,
      especie: item.especie,
      fotoUrl: item.fotoUrl,
    }))

  if (lista.length === 0 && pedido.value.novoCadastro) {
    const nome = pedido.value.novoCadastro.petNome

    return [
      {
        id: pedido.value.id,
        nome,
        iniciais: nome.slice(0, 2).toUpperCase(),
        especie: pedido.value.novoCadastro.especie,
        fotoUrl: '',
      },
    ]
  }

  return lista
})

/* A conjunção do idioma de quem lê: Bento e Açaí, Bento and Açaí. */
const nomes = computed(() =>
  new Intl.ListFormat(tag.value, { type: 'conjunction' }).format(pets.value.map((item) => item.nome)),
)

const responsavel = computed(() => {
  const tutor = pedido.value.tutorId
    ? getDataset().tutores.find((item) => item.id === pedido.value.tutorId)
    : null

  return tutor?.nome ?? pedido.value.novoCadastro?.nome ?? ''
})

/** Primeira vez: o pet não está no cadastro do hotel — veio do link, ou do app sem vínculo. */
const primeiraVez = computed(
  () => pedido.value.novoCadastro !== null && !(pedido.value.petId && pet(pedido.value.petId)),
)

const diarias = computed(() => contarDiarias(pedido.value.entrada, pedido.value.saida))

/** As noites pedidas, como se lê numa folhinha: o mês em cima, "28–31" grande, as diárias embaixo. */
const quando = computed(() => {
  const de = dataDe(pedido.value.entrada)
  const ate = dataDe(pedido.value.saida)
  const mes = (iso: string) =>
    new Intl.DateTimeFormat(tag.value, { month: 'short', timeZone: 'UTC' })
      .format(new Date(`${iso}T12:00:00Z`))
      .replace(/\.$/, '')

  const mesDe = mes(de)
  const mesAte = mes(ate)

  return {
    mes: mesDe === mesAte ? mesDe : `${mesDe}–${mesAte}`,
    noites: `${Number(de.slice(8, 10))}–${Number(ate.slice(8, 10))}`,
    rotulo: formato.periodo(pedido.value.entrada, pedido.value.saida),
  }
})

const tipoPedido = computed(() =>
  pedido.value.tipoId
    ? (getDataset().tiposDeAcomodacao.find((item) => item.id === pedido.value.tipoId)?.nome ?? '')
    : '',
)

/** A segunda linha do pedido: os extras, ou "na mesma acomodação" para dois da mesma casa. */
const detalhe = computed(() => {
  if (pedido.value.servicos.length > 0) {
    return pedido.value.servicos.map((servico) => t(`hotel.servico.${servico}`)).join(' · ')
  }

  return pets.value.length > 1
    ? t('hotel.pedidos.linha.juntos')
    : t('hotel.pedidos.linha.semExtras')
})

// ------------------------------------------------------------------ o prazo

const prazo = computed(() => situacaoDoPrazoDaReserva(pedido.value, agoraIso()))

const minutosAteOPrazo = computed(() =>
  Math.round((Date.parse(pedido.value.responderAte) - Date.parse(agoraIso())) / 60_000),
)

const tom = computed(() => {
  if (prazo.value !== 'no-prazo') {
    return 'risco'
  }

  return minutosAteOPrazo.value <= MINUTOS_DE_ATENCAO ? 'atencao' : 'neutro'
})

/**
 * O número grande: quanto falta, ou quanto passou. Precisão proporcional à distância — passadas
 * seis horas o minuto deixa de ser informação, e passados dois dias, a hora.
 */
const contagem = computed(() => {
  const total = Math.abs(minutosAteOPrazo.value)

  if (total >= 48 * 60) {
    const dias = Math.round(total / (24 * 60))

    return t('hotel.formato.dias', { valor: dias }, dias)
  }

  if (total >= 6 * 60) {
    return t('hotel.formato.horas', { valor: Math.floor(total / 60) })
  }

  return formato.duracao(total)
})

const legendaDoPrazo = computed(() => {
  const ate = pedido.value.responderAte
  /* Prazo de outro dia diz o dia: "até 08:26" lido às 18h parece daqui a pouco. */
  const quandoVence = dataDe(ate) === dataDe(agoraIso()) ? formato.hora(ate) : formato.quando(ate)

  return prazo.value === 'atrasado'
    ? t('clinico.pedidos.tela.prazoPassou', { quando: quandoVence })
    : t('clinico.pedidos.tela.prazoNoTempo', { quando: quandoVence })
})

const sugestao = computed(() => props.linha.sugestao)

const acaoPrincipal = computed(() => {
  if (!sugestao.value) {
    return null
  }

  return {
    rotulo: t('hotel.pedidos.reservarEm', { acomodacao: sugestao.value.acomodacao.nome }),
    escolha: {
      acomodacaoId: sugestao.value.acomodacao.id,
      inicio: sugestao.value.inicio,
      fim: sugestao.value.fim,
    },
  }
})

const semVagaNoTipo = computed(
  () => pedido.value.modo === 'acomodacao-escolhida' && !props.linha.tipoTemVaga,
)

const rotuloDoCanal = computed(() => t(`hotel.pedidos.canal.${pedido.value.canal}`))
</script>

<template>
  <li
    class="pedido"
    :class="[
      tom !== 'neutro' ? `ui-marca ui-marca--${tom}` : '',
      { 'pedido--respondendo': respondendo, 'pedido--aberta': aberta },
    ]"
    :aria-busy="respondendo"
    @click="emit('abrir')"
  >
    <!-- Para quando: as noites pedidas, lidas antes de qualquer outra coisa da linha. -->
    <span class="pedido__quando quando" role="img" :aria-label="quando.rotulo">
      <span class="quando__mes" aria-hidden="true">{{ quando.mes }}</span>
      <span class="quando__noites ui-num" aria-hidden="true">{{ quando.noites }}</span>
      <span class="quando__diarias" aria-hidden="true">
        {{ t('hotel.pedidos.diarias', { n: diarias }, diarias) }}
      </span>
    </span>

    <!-- Quem -->
    <div class="pedido__quem">
      <span class="pedido__rostos" :class="{ 'pedido__rostos--grupo': pets.length > 1 }">
        <PetAvatar
          v-for="item in pets"
          :key="item.id"
          :nome="item.nome"
          :iniciais="item.iniciais"
          :especie="item.especie"
          :foto-url="item.fotoUrl"
          tamanho="md"
        />
      </span>

      <span class="pedido__identidade">
        <span class="pedido__nomes">
          <strong>{{ nomes }}</strong>
          <span v-if="primeiraVez" class="ui-selo ui-selo--lugar">
            <i class="ph ph-sparkle" aria-hidden="true" />
            {{ t('hotel.pedidos.primeiraVez') }}
          </span>
        </span>
        <span class="pedido__meta">
          <i
            class="ph"
            :class="pedido.canal === 'app' ? 'ph-device-mobile' : 'ph-globe-simple'"
            :title="rotuloDoCanal"
            aria-hidden="true"
          />
          <span class="sr-only">{{ rotuloDoCanal }}:</span>
          <span class="pedido__responsavel">{{ responsavel }}</span>
        </span>
      </span>
    </div>

    <!-- O pedido -->
    <div class="pedido__oque">
      <span class="pedido__tipo">
        <i
          class="ph pedido__tipo-icone"
          :class="pedido.modo === 'acomodacao-escolhida' ? 'ph-bed' : 'ph-magic-wand'"
          aria-hidden="true"
        />
        <strong>
          {{
            pedido.modo === 'acomodacao-escolhida'
              ? tipoPedido
              : t('hotel.pedidos.linha.hotelEscolhe')
          }}
        </strong>
        <i
          v-if="pedido.aceitaMudarUmDia"
          class="ph ph-arrows-left-right pedido__flexivel"
          :title="t('hotel.pedidos.aceitaMudar')"
          :aria-label="t('hotel.pedidos.aceitaMudar')"
        />
      </span>

      <span v-if="semVagaNoTipo" class="pedido__detalhe pedido__detalhe--atencao">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t('hotel.pedidos.linha.semVaga', { tipo: tipoPedido }) }}
      </span>
      <span v-else-if="!sugestao" class="pedido__detalhe pedido__detalhe--atencao">
        <i class="ph ph-calendar-x" aria-hidden="true" />
        {{ t('hotel.pedidos.semSugestao') }}
      </span>
      <span v-else class="pedido__detalhe">{{ detalhe }}</span>
    </div>

    <!-- O prazo, contando -->
    <p class="pedido__prazo" :class="`pedido__prazo--${tom}`">
      <strong class="ui-num">
        <i
          class="ph"
          :class="tom === 'neutro' ? 'ph-clock' : 'ph-clock-countdown'"
          aria-hidden="true"
        />
        {{ contagem }}
      </strong>
      <small>{{ legendaDoPrazo }}</small>
    </p>

    <div class="pedido__botoes">
      <Button
        type="button"
        size="small"
        :severity="acaoPrincipal ? 'secondary' : undefined"
        :outlined="Boolean(acaoPrincipal)"
        :label="t('hotel.pedidos.linha.responder')"
        :aria-expanded="aberta"
        :disabled="ocupado && !aberta"
        @click.stop="emit('abrir')"
      />
      <Button
        v-if="acaoPrincipal"
        type="button"
        size="small"
        class="pedido__reservar"
        icon="ph ph-check"
        :label="acaoPrincipal.rotulo"
        :title="acaoPrincipal.rotulo"
        :loading="respondendo"
        :disabled="ocupado && !respondendo"
        @click.stop="emit('aceitar', acaoPrincipal.escolha)"
      />
    </div>
  </li>
</template>

<style scoped>
.pedido {
  position: relative;
  display: grid;
  min-height: 76px;
  align-items: center;
  gap: 10px 20px;
  /* Larguras fixas no começo e no fim: cada linha é uma grade própria, e colunas medidas pelo
     conteúdo desalinhavam as noites e os botões de uma linha para a outra. */
  grid-template-columns: 5.5rem minmax(0, 1.15fr) minmax(0, 1fr) 10.5rem 18.5rem;
  padding: 12px 18px 12px 22px;
  cursor: pointer;
  transition: background-color var(--pj-tempo-curto) ease-out;
}

.pedido:hover {
  background: var(--superficie-2);
}

/* A linha que está na gaveta: tingida na cor da casa, para o olho voltar a ela ao fechar. */
.pedido--aberta,
.pedido--aberta:hover {
  background: color-mix(in oklab, var(--hotel-fundo) 70%, var(--superficie));
}

.pedido--respondendo {
  opacity: 0.6;
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

/* ------------------------------------------------------------------ quando */

/* As noites pedidas numa folhinha de calendário: o mês em cima, as noites grandes, as diárias. */
.quando {
  display: grid;
  min-width: 0;
  align-content: center;
  justify-items: center;
  gap: 1px;
  padding: 8px 4px 9px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
  line-height: 1.15;
  text-align: center;
}

.quando__mes {
  color: var(--pj-lugar-tinta, var(--hotel-tinta));
  font-size: 11.5px;
  font-weight: 650;
  white-space: nowrap;
}

.quando__diarias {
  color: var(--tinta-2);
  font-size: 11.5px;
  font-weight: 500;
  white-space: nowrap;
}

.quando__noites {
  color: var(--tinta);
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ quem */

.pedido__quem {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.pedido__rostos {
  display: inline-flex;
  flex: none;
}

/* Dois pets da mesma casa: os rostos se sobrepõem, como uma ficha só. */
.pedido__rostos--grupo > * + * {
  margin-inline-start: -12px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--superficie);
}

.pedido__identidade,
.pedido__oque {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.pedido__nomes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.pedido__nomes strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.pedido__nomes .ui-selo {
  height: 22px;
  font-size: 12px;
}

.pedido__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
}

.pedido__meta > i {
  flex: none;
  color: var(--tinta-3);
  font-size: 15px;
}

.pedido__responsavel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ o pedido */

.pedido__tipo {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.pedido__tipo-icone {
  flex: none;
  color: var(--hotel-tinta);
  font-size: 16px;
}

.pedido__tipo strong {
  overflow: hidden;
  color: var(--tinta);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pedido__flexivel {
  flex: none;
  color: var(--tinta-3);
}

.pedido__detalhe {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pedido__detalhe--atencao {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--atencao-tinta);
  font-weight: 550;
}

/* ------------------------------------------------------------------ o prazo */

.pedido__prazo {
  display: grid;
  min-width: 0;
  gap: 2px;
  margin: 0;
  line-height: 1.15;
}

.pedido__prazo strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 19px;
  font-weight: 650;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.pedido__prazo strong i {
  color: var(--tinta-3);
  font-size: 17px;
}

.pedido__prazo small {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.35;
}

.pedido__prazo--risco strong,
.pedido__prazo--risco strong i {
  color: var(--risco-tinta);
}

.pedido__prazo--atencao strong,
.pedido__prazo--atencao strong i {
  color: var(--atencao-tinta);
}

/* ------------------------------------------------------------------ botões */

.pedido__botoes {
  display: flex;
  min-width: 0;
  justify-content: flex-end;
  gap: 8px;
}

/* Botão de linha no tamanho pequeno, mas com o alvo de toque de 36 px. */
.pedido__botoes :deep(.p-button) {
  min-height: 36px;
  flex: none;
  white-space: nowrap;
}

/* O nome da unidade pode ser longo ("Convivência Norte"): encolhe com reticências, sem empurrar. */
.pedido__botoes .pedido__reservar.p-button {
  min-width: 0;
  flex: 0 1 auto;
}

.pedido__reservar :deep(.p-button-label) {
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * Pela largura da lista, não da janela: com a gaveta aberta a página perde 30 rem, e uma linha
 * medida pela janela continuava em cinco colunas espremidas. O pedido desce para baixo de quem, e
 * a resposta para baixo do prazo — as noites ficam à esquerda, ocupando a altura.
 */
@container (max-width: 62rem) {
  .pedido {
    align-items: start;
    grid-template-columns: 5rem minmax(0, 1fr) auto;
  }

  .pedido__quando {
    grid-row: span 2;
    align-self: center;
  }

  .pedido__oque {
    grid-column: 2;
  }

  .pedido__prazo {
    grid-column: 3;
    grid-row: 1;
    justify-items: end;
    text-align: end;
  }

  .pedido__botoes {
    grid-column: 3;
    grid-row: 2;
    align-self: end;
  }

  .pedido__detalhe {
    white-space: normal;
  }
}

@container (max-width: 36rem) {
  .pedido {
    grid-template-columns: 4.5rem minmax(0, 1fr);
    padding-inline: 14px 14px;
  }

  .pedido__quando {
    grid-row: span 4;
    align-self: start;
  }

  .pedido__prazo,
  .pedido__botoes {
    grid-column: 2;
    grid-row: auto;
    justify-items: start;
    justify-content: flex-start;
    text-align: start;
  }

  .pedido__botoes {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pedido {
    transition: none;
  }
}
</style>
