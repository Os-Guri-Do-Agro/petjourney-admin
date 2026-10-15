<script setup lang="ts">
/**
 * Uma linha da caixa de pedidos de reserva: as noites, quem, o que pediu — e a resposta a um clique.
 *
 * A mesma leitura da caixa da clínica. A folhinha à esquerda dá o período ("22–25 · 3 diárias")
 * antes de qualquer leitura; depois o pet e quem pede, o tipo escolhido (ou "o hotel escolhe") com
 * o que muda a resposta, o prazo e os botões. Porte, extras, observação, telefone de quem veio pelo
 * link e a escolha de outra unidade moram na gaveta que "Responder" abre — a versão anterior
 * empilhava seis linhas de ícone e texto por pedido.
 *
 * O botão cheio diz a unidade: "Reservar Suíte S1". Ninguém aceita sem saber onde o animal vai
 * dormir. O tipo que esgotou aparece com o ícone de atenção, não com a linha pintada.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import FolhaDoDia from '@/features/clinico/components/pedidos/FolhaDoDia.vue'
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

const pedido = computed(() => props.linha.pedido)

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
  new Intl.ListFormat(INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE], {
    type: 'conjunction',
  }).format(pets.value.map((item) => item.nome)),
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

const prazo = computed(() => situacaoDoPrazoDaReserva(pedido.value, agoraIso()))

const fraseDoPrazo = computed(() => {
  const ate = pedido.value.responderAte

  if (prazo.value === 'atrasado') {
    return t('hotel.pedidos.prazo.atrasado', { valor: formato.relativo(ate) })
  }

  return t('hotel.pedidos.linha.ate', {
    quando: dataDe(ate) === dataDe(agoraIso()) ? formato.hora(ate) : formato.quando(ate),
  })
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
    :class="{ 'pedido--respondendo': respondendo, 'pedido--aberta': aberta }"
    :aria-busy="respondendo"
    @click="emit('abrir')"
  >
    <FolhaDoDia
      class="pedido__folha"
      :dia="dataDe(pedido.entrada)"
      :ate="dataDe(pedido.saida)"
      :rodape="t('hotel.pedidos.diarias', { n: diarias }, diarias)"
    />

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
          tamanho="sm"
        />
      </span>

      <span class="pedido__identidade">
        <span class="pedido__nomes">
          <strong>{{ nomes }}</strong>
          <span v-if="primeiraVez" class="pedido__selo">
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
          class="ph"
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
        <i class="ph ph-bed" aria-hidden="true" />
        {{ t('hotel.pedidos.semSugestao') }}
      </span>
      <span v-else class="pedido__detalhe">{{ detalhe }}</span>
    </div>

    <!-- A resposta -->
    <p class="pedido__prazo" :class="`pedido__prazo--${prazo}`">
      <i
        class="ph"
        :class="prazo === 'no-prazo' ? 'ph-clock' : 'ph-clock-countdown'"
        aria-hidden="true"
      />
      {{ fraseDoPrazo }}
    </p>

    <div class="pedido__botoes">
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('hotel.pedidos.linha.responder')"
        :aria-expanded="aberta"
        :disabled="ocupado && !aberta"
        @click.stop="emit('abrir')"
      />
      <Button
        v-if="acaoPrincipal"
        type="button"
        size="small"
        icon="ph ph-check"
        :label="acaoPrincipal.rotulo"
        :loading="respondendo"
        :disabled="ocupado && !respondendo"
        @click.stop="emit('aceitar', acaoPrincipal.escolha)"
      />
    </div>
  </li>
</template>

<style scoped>
.pedido {
  display: grid;
  align-items: center;
  margin-inline: -0.75rem;
  padding: 0.8rem 0.75rem;
  border-radius: 0.8rem;
  gap: 0.5rem 1.25rem;
  /* Larguras fixas no prazo e nos botões: cada linha é uma grade própria, e colunas medidas pelo
     conteúdo desalinhavam o tipo de uma linha para a outra. */
  grid-template-columns: 4.25rem minmax(0, 1.1fr) minmax(0, 1fr) 10.75rem 16rem;
  cursor: pointer;
  transition: background-color 150ms ease-out;
}

.pedido + .pedido {
  box-shadow: 0 -1px 0 var(--hc-linha);
}

.pedido:hover {
  background: color-mix(in srgb, var(--hc-marca-clara) 45%, transparent);
}

/* A linha que está na gaveta: tingida, para o olho voltar a ela ao fechar. */
.pedido--aberta,
.pedido--aberta:hover {
  background: var(--hc-marca-clara);
  box-shadow: none;
}

.pedido--aberta + .pedido {
  box-shadow: none;
}

.pedido--respondendo {
  opacity: 0.6;
}

.pedido__quem {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.pedido__rostos {
  display: inline-flex;
  flex: 0 0 auto;
}

/* Dois pets da mesma casa: os rostos se sobrepõem, como uma ficha só. */
.pedido__rostos--grupo > * + * {
  margin-inline-start: -0.6rem;
  box-shadow: 0 0 0 2px var(--hc-cartao);
  border-radius: 50%;
}

.pedido__identidade,
.pedido__oque {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.pedido__nomes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.45rem;
}

.pedido__nomes strong {
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  font-weight: 700;
}

.pedido__selo {
  display: inline-flex;
  align-items: center;
  padding: 0.05rem 0.45rem;
  border-radius: 6px;
  gap: 0.25rem;
  /* Ciano: "cliente novo" é categoria própria — o lilás da casa é o do que a máquina propôs. */
  background: var(--hc-ciano-fundo);
  color: var(--hc-ciano-tinta);
  font-size: 0.6875rem;
  font-weight: 700;
}

.pedido__meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.pedido__meta > i {
  flex: 0 0 auto;
  color: var(--hc-tinta-3);
}

.pedido__responsavel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pedido__tipo {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  font-size: 0.875rem;
}

.pedido__tipo > i:first-child {
  color: var(--hc-marca);
}

.pedido__tipo strong {
  overflow: hidden;
  color: var(--hc-tinta);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pedido__flexivel {
  color: var(--hc-tinta-3);
}

.pedido__detalhe {
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pedido__detalhe--atencao {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-attention-text);
  font-weight: 650;
}

.pedido__prazo {
  display: inline-flex;
  align-items: center;
  margin: 0;
  gap: 0.35rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.pedido__prazo--vencendo i {
  color: var(--clinic-attention-text);
}

.pedido__prazo--atrasado {
  color: var(--clinic-risk-text);
}

.pedido__botoes {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}

/* Pela largura da lista, não da janela: com a gaveta aberta, a página perde 30 rem. */
@container (max-width: 62rem) {
  .pedido {
    align-items: start;
    grid-template-columns: 4.25rem minmax(0, 1fr) auto;
  }

  .pedido__folha {
    grid-row: span 2;
  }

  .pedido__oque {
    grid-column: 2;
  }

  .pedido__prazo {
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
  }

  .pedido__botoes {
    grid-column: 3;
    grid-row: 2;
    align-self: end;
  }
}

@container (max-width: 36rem) {
  .pedido {
    grid-template-columns: 4.25rem minmax(0, 1fr);
  }

  .pedido__folha {
    grid-row: span 3;
  }

  .pedido__prazo,
  .pedido__botoes {
    grid-column: 2;
    grid-row: auto;
    justify-self: start;
  }
}

@media (pointer: coarse) {
  .pedido__botoes :deep(.p-button) {
    min-height: 2.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pedido {
    transition: none;
  }
}
</style>
