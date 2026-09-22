<script setup lang="ts">
/**
 * Acomodações e tarifas — o cadastro da casa.
 *
 * **O sistema não adivinha como o hotel é.** Quem monta a casa é a operação: cadastra o que tem,
 * dá nome, e mexe nesse número quando cresce ou reforma. Esta tela existe para que isso não dependa
 * de ninguém — nem de um chamado de suporte, nem de um deploy.
 *
 * Configuração acontece no dia da mudança, e é por isso que ela é uma tela e não um painel
 * permanente ao lado do mapa. A tabela de tarifas fica abaixo, junto: quem muda a baia costuma
 * estar mudando o preço dela.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import AcomodacaoDialog from '@/features/hotel/components/acomodacoes/AcomodacaoDialog.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import HotelSelo from '@/features/hotel/components/base/HotelSelo.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import { acomodacaoRepository, CadastroRecusadoError } from '@/features/hotel/data/repositories'
import type { Acomodacao, PetPorte } from '@/features/hotel/data/types'
import { useHotelStore } from '@/features/hotel/stores/hotel'

const { t } = useI18n()
const formato = useHotelFormat()
const hotelStore = useHotelStore()

const PORTES: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']

const dialogoAberto = ref(false)
const emEdicao = ref<Acomodacao | null>(null)
const salvando = ref(false)
const erro = ref('')

onMounted(async () => {
  await hotelStore.carregar()
})

const porBloco = computed(() =>
  hotelStore.blocos
    .map((bloco) => ({
      bloco,
      acomodacoes: hotelStore.acomodacoes.filter((item) => item.blocoId === bloco.id),
    }))
    .filter((grupo) => grupo.acomodacoes.length > 0),
)

const paradas = computed(() => hotelStore.acomodacoes.filter((item) => !item.ativa).length)

function abrir(acomodacao: Acomodacao | null) {
  emEdicao.value = acomodacao
  erro.value = ''
  dialogoAberto.value = true
}

/**
 * Envelope das mudanças de cadastro.
 *
 * O diálogo só fecha quando a mudança é **aceita**. Recusada por regra — nome repetido, acomodação
 * ocupada, histórico —, ele fica aberto com o motivo à vista. Sumir com ele deixaria a pessoa sem
 * saber por que nada mudou.
 */
async function mudar(acao: () => Promise<unknown>) {
  salvando.value = true
  erro.value = ''

  try {
    await acao()
    await hotelStore.carregar(true)
    hotelStore.invalidarTudo()
    dialogoAberto.value = false
  } catch (falha) {
    erro.value =
      falha instanceof CadastroRecusadoError
        ? `hotel.erros.cadastro.${falha.kind}`
        : 'hotel.erros.acao'
  } finally {
    salvando.value = false
  }
}

function paradaHaDias(acomodacao: Acomodacao) {
  return acomodacao.inativaDesde
    ? Math.floor((Date.now() - Date.parse(acomodacao.inativaDesde)) / 86_400_000)
    : null
}
/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.acomodacoes.pergunta.titulo'),
    texto: t('hotel.tour.acomodacoes.pergunta.texto'),
  },
  {
    alvo: '.bloco',
    titulo: t('hotel.tour.acomodacoes.blocos.titulo'),
    texto: t('hotel.tour.acomodacoes.blocos.texto'),
  },
  {
    alvo: '.item--parada',
    titulo: t('hotel.tour.acomodacoes.parada.titulo'),
    texto: t('hotel.tour.acomodacoes.parada.texto'),
  },
  {
    alvo: '.tarifas',
    titulo: t('hotel.tour.acomodacoes.tarifas.titulo'),
    texto: t('hotel.tour.acomodacoes.tarifas.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    :title="t('hotel.acomodacoes.titulo')"
    :subtitle="t('hotel.acomodacoes.subtitulo')"
    tour
    @tour="tourAberto = true"
    :loading="hotelStore.carregando && hotelStore.acomodacoes.length === 0"
    :error="hotelStore.erro ? t(hotelStore.erro) : ''"
    @retry="hotelStore.carregar(true)"
  >
    <div class="cadastro clinic-scope">
      <p class="cadastro__resumo">
        {{
          t(
            'hotel.acomodacoes.resumo',
            { total: hotelStore.acomodacoes.length },
            hotelStore.acomodacoes.length,
          )
        }}
        <template v-if="paradas > 0">
          · {{ t('hotel.acomodacoes.paradas', { total: paradas }) }}
        </template>
      </p>

      <section v-for="grupo in porBloco" :key="grupo.bloco.id" class="bloco">
        <h2 class="bloco__titulo">{{ grupo.bloco.nome }}</h2>

        <ul class="grade">
          <li v-for="acomodacao in grupo.acomodacoes" :key="acomodacao.id">
            <button
              type="button"
              class="item"
              :class="{ 'item--parada': !acomodacao.ativa }"
              @click="abrir(acomodacao)"
            >
              <div class="item__topo">
                <strong>{{ acomodacao.nome }}</strong>
                <HotelSelo
                  v-if="!acomodacao.ativa"
                  :rotulo="formato.motivoInativa(acomodacao.motivoInativa ?? 'outro')"
                  tom="atencao"
                  icone="pi pi-wrench"
                />
              </div>

              <span class="item__perfil">
                {{ formato.acomodacaoKind(acomodacao.kind) }} ·
                {{ formato.porte(acomodacao.porteMaximo) }} ·
                {{
                  t(
                    'hotel.acomodacoes.cabem',
                    { total: acomodacao.capacidade },
                    acomodacao.capacidade,
                  )
                }}
              </span>

              <span class="item__tarifa">
                {{ hotelStore.tarifa(acomodacao.tarifaId)?.nome }} ·
                {{
                  formato.moeda(
                    hotelStore.tarifa(acomodacao.tarifaId)?.diariaPorPorte[
                      acomodacao.porteMaximo
                    ] ?? 0,
                  )
                }}
              </span>

              <!-- Há quanto tempo é a informação, não o rótulo de "em manutenção". -->
              <span
                v-if="!acomodacao.ativa && paradaHaDias(acomodacao) !== null"
                class="item__parada"
              >
                {{ formato.haDias(paradaHaDias(acomodacao) ?? 0) }}
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section class="tarifas">
        <h2 class="bloco__titulo">{{ t('hotel.acomodacoes.tarifas') }}</h2>

        <table class="tabela">
          <thead>
            <tr>
              <th scope="col">{{ t('hotel.acomodacoes.tarifa') }}</th>
              <th v-for="porte in PORTES" :key="porte" scope="col" class="tabela__num">
                {{ formato.porte(porte) }}
              </th>
              <th scope="col" class="tabela__num">{{ t('hotel.acomodacoes.acompanhante') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tarifa in hotelStore.tarifas" :key="tarifa.id">
              <th scope="row">{{ tarifa.nome }}</th>
              <td v-for="porte in PORTES" :key="porte" class="tabela__num clinic-value">
                {{ formato.moeda(tarifa.diariaPorPorte[porte]) }}
              </td>
              <td class="tabela__num clinic-value">{{ tarifa.acompanhantePercentual }}%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="temporadas">
        <h2 class="bloco__titulo">{{ t('hotel.acomodacoes.temporadas') }}</h2>

        <ul class="temporadas__lista">
          <!--
            A lista é das temporadas **cadastradas**, não das materializadas.
            A virada do ano vira três faixas no cálculo de preço, e mostrá-las aqui repetia "Fim de
            ano" três vezes, com intervalos que se contradiziam aos olhos de quem lê.
          -->
          <li v-for="temporada in hotelStore.temporadasSazonais" :key="temporada.id">
            <strong>{{ temporada.nome }}</strong>
            <span>
              {{ formato.mesDia(temporada.inicioMesDia) }} →
              {{ formato.mesDia(temporada.fimMesDia) }}
            </span>
            <HotelSelo :rotulo="`+${temporada.acrescimoPercentual}%`" tom="acento" />
          </li>
        </ul>
      </section>
    </div>

    <AcomodacaoDialog
      :aberto="dialogoAberto"
      :acomodacao="emEdicao"
      :blocos="hotelStore.blocos"
      :tarifas="hotelStore.tarifas"
      :salvando="salvando"
      :erro="erro"
      @fechar="dialogoAberto = false"
      @salvar="
        (payload) =>
          mudar(() =>
            emEdicao
              ? acomodacaoRepository.editar({ ...payload, acomodacaoId: emEdicao.id })
              : acomodacaoRepository.criar(payload),
          )
      "
      @desativar="
        (payload) =>
          mudar(() =>
            acomodacaoRepository.desativar({ ...payload, acomodacaoId: emEdicao?.id ?? '' }),
          )
      "
      @reativar="() => mudar(() => acomodacaoRepository.reativar(emEdicao?.id ?? ''))"
      @remover="() => mudar(() => acomodacaoRepository.remover(emEdicao?.id ?? ''))"
    />

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />

    <template #actions>
      <Button
        :label="t('hotel.acomodacoes.nova')"
        icon="pi pi-plus"
        size="small"
        @click="abrir(null)"
      />
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
.cadastro {
  display: grid;
  gap: var(--clinic-space-5);
}

.cadastro__resumo {
  margin: 0;
  color: var(--clinic-muted);
}

.bloco {
  display: grid;
  gap: var(--clinic-space-3);
}

.bloco__titulo {
  margin: 0;
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.grade {
  display: grid;
  gap: var(--clinic-space-3);
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  list-style: none;
}

.item {
  display: grid;
  width: 100%;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: 0.15rem;
  background: var(--clinic-surface);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.item:hover,
.item:focus-visible {
  border-color: var(--clinic-accent-soft);
  background: var(--clinic-accent-tint);
}

.item--parada {
  border-style: dashed;
  background: var(--clinic-surface-sunken);
}

.item__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.item__topo strong {
  font-weight: 750;
}

.item__perfil,
.item__tarifa,
.item__parada {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.item__tarifa {
  color: var(--clinic-muted);
}

.item__parada {
  color: var(--clinic-attention-text);
  font-weight: 650;
}

.tarifas,
.temporadas {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  overflow-x: auto;
}

.tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--clinic-font-label);
}

.tabela th,
.tabela td {
  padding: 0.35rem 0.6rem;
  text-align: start;
  white-space: nowrap;
}

.tabela thead th {
  border-bottom: 1px solid var(--clinic-line);
  color: var(--clinic-faint);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tabela tbody tr + tr th,
.tabela tbody tr + tr td {
  border-top: 1px solid var(--clinic-line-soft);
}

.tabela__num {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.temporadas__lista {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.temporadas__lista li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-3);
}

.temporadas__lista span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}
</style>
