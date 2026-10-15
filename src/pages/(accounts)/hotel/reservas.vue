<script setup lang="ts">
/**
 * Reservas — a lista do que está vendido.
 *
 * A coluna que a tela existe para ter é a de **exigências**, e ela é ordenável: é por ela que a
 * recepção trabalha na véspera, varrendo a semana atrás do que vai dar problema no balcão. Sem a
 * coluna, essa varredura custa abrir uma reserva de cada vez.
 *
 * A lista de espera vive no rodapé e não numa tela própria: ela só é consultada quando uma reserva
 * cai, e nesse momento quem está olhando já está aqui.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicFilterBar from '@/features/clinico/components/base/ClinicFilterBar.vue'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import HotelSelo from '@/features/hotel/components/base/HotelSelo.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { tomDaAdmissao, useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import type { ReservaNaLista } from '@/features/hotel/data/repositories'
import { addDays } from '@/features/hotel/domain/hotel-time'
import { hotelClock, useHotelStore } from '@/features/hotel/stores/hotel'
import { useReservasStore } from '@/features/hotel/stores/reservas'

const { t } = useI18n()
const router = useRouter()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const reservas = useReservasStore()

const busca = ref('')
const selecionados = ref<Record<string, string[]>>({})

/**
 * Até onde a lista olha.
 *
 * A tela abre no que está **por vir**, e não no arquivo inteiro. A pergunta dela é "o que está
 * vendido e o que vai dar trabalho": uma lista que abre em estadias encerradas há seis semanas
 * responde outra pergunta, e empurra a resposta para a terceira página de rolagem.
 *
 * O arquivo não some — muda de lugar. É aqui que se vai buscar a estadia do mês passado, e o
 * controle fica ao lado da lista para que ninguém conclua que ela se perdeu.
 */
const horizonte = ref<'proximas' | 'todas'>('proximas')

/* Ontem, e não hoje: quem saiu ontem de manhã ainda é assunto do balcão hoje. */
const recorteDoHorizonte = computed(() =>
  horizonte.value === 'proximas' ? { de: addDays(hotelClock.today(), -1) } : undefined,
)

const opcoesDeHorizonte = computed(() => [
  { valor: 'proximas' as const, rotulo: t('hotel.reservas.horizonteProximas') },
  { valor: 'todas' as const, rotulo: t('hotel.reservas.horizonteTodas') },
])

onMounted(async () => {
  await reservas.carregarLista(recorteDoHorizonte.value)
})

watch([() => hotelStore.revisao, horizonte], () => reservas.carregarLista(recorteDoHorizonte.value))

/**
 * Os filtros são os três eixos pelos quais a recepção pergunta: em que estado está, se tem
 * documento pendente, e de que bloco é. Nada de filtro por origem — isso é pergunta do resumo, e
 * um painel com seis facetas é um painel que ninguém abre.
 */
const grupos = computed(() => [
  {
    id: 'status',
    rotulo: t('hotel.reservas.filtroStatus'),
    opcoes: (
      ['pendente', 'confirmada', 'hospedado', 'encerrada', 'cancelada', 'nao-compareceu'] as const
    ).map((status) => ({
      valor: status,
      rotulo: formato.statusDaReserva(status),
      contagem: reservas.lista.filter((linha) => linha.reserva.status === status).length,
    })),
  },
  {
    id: 'admissao',
    rotulo: t('hotel.reservas.filtroAdmissao'),
    opcoes: (['ausente', 'vencido', 'vence-durante', 'dispensado', 'ok'] as const).map(
      (situacao) => ({
        valor: situacao,
        rotulo: formato.situacaoDaExigencia(situacao),
        contagem: reservas.lista.filter((linha) => linha.admissao === situacao).length,
      }),
    ),
  },
  {
    id: 'bloco',
    rotulo: t('hotel.reservas.filtroBloco'),
    opcoes: hotelStore.blocos.map((bloco) => ({
      valor: bloco.id,
      rotulo: bloco.nome,
      contagem: reservas.lista.filter((linha) => linha.blocoId === bloco.id).length,
    })),
  },
])

const linhas = computed(() => {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR')

  return reservas.lista.filter((linha) => {
    const status = selecionados.value.status ?? []
    const admissao = selecionados.value.admissao ?? []
    const bloco = selecionados.value.bloco ?? []

    if (status.length > 0 && !status.includes(linha.reserva.status)) {
      return false
    }

    if (admissao.length > 0 && !admissao.includes(linha.admissao)) {
      return false
    }

    if (bloco.length > 0 && !bloco.includes(linha.blocoId)) {
      return false
    }

    if (!termo) {
      return true
    }

    return (
      linha.petNome.toLocaleLowerCase('pt-BR').includes(termo) ||
      linha.tutorNome.toLocaleLowerCase('pt-BR').includes(termo) ||
      linha.acomodacaoNome.toLocaleLowerCase('pt-BR').includes(termo)
    )
  })
})

/**
 * As colunas ordenáveis são as que respondem a uma pergunta de varredura: quando chega, quem é,
 * qual é a situação do documento e quanto falta receber. A de acomodação não ordena — ninguém
 * varre reservas por nome de baia.
 */
const colunas = computed<ColunaTabela<ReservaNaLista>[]>(() => [
  {
    id: 'entrada',
    rotulo: t('hotel.reservas.coluna.entrada'),
    largura: 'minmax(8rem, 0.8fr)',
    ordenarPor: (linha) => linha.reserva.entradaPrevista,
    ordemInicial: 'asc',
  },
  {
    id: 'pet',
    rotulo: t('hotel.reservas.coluna.hospede'),
    largura: 'minmax(10rem, 1.4fr)',
    ordenarPor: (linha) => linha.petNome,
  },
  {
    id: 'acomodacao',
    rotulo: t('hotel.reservas.coluna.acomodacao'),
    largura: 'minmax(8rem, 1fr)',
    ocultarEmTelaEstreita: true,
  },
  {
    id: 'noites',
    rotulo: t('hotel.reservas.coluna.diarias'),
    largura: 'minmax(4rem, 0.4fr)',
    numerico: true,
    ordenarPor: (linha) => linha.reserva.diarias,
  },
  {
    id: 'status',
    rotulo: t('hotel.reservas.coluna.status'),
    largura: 'minmax(7rem, 0.7fr)',
    ordenarPor: (linha) => formato.statusDaReserva(linha.reserva.status),
  },
  {
    id: 'admissao',
    rotulo: t('hotel.reservas.coluna.admissao'),
    largura: 'minmax(8rem, 0.8fr)',
    /* A ordem é a da urgência, não a alfabética: o que trava precisa subir. */
    ordenarPor: (linha) =>
      ['ausente', 'vencido', 'vence-durante', 'dispensado', 'ok'].indexOf(linha.admissao),
    ordemInicial: 'asc',
  },
  {
    id: 'saldo',
    rotulo: t('hotel.reservas.coluna.saldo'),
    largura: 'minmax(7rem, 0.6fr)',
    numerico: true,
    ordenarPor: (linha) => linha.reserva.orcamento.saldoCentavos,
    ocultarEmTelaEstreita: true,
  },
])

const vazio = computed(() => !reservas.carregando && !reservas.erro && reservas.lista.length === 0)

/**
 * A véspera: o que chega nos próximos três dias e ainda não pode entrar.
 *
 * Três dias porque é o prazo em que ainda dá para pedir o papel e o responsável consegue trazer.
 * Uma faixa que avisasse com trinta dias seria ignorada; uma que avisasse no dia da chegada
 * avisaria tarde.
 */
const vespera = computed(() =>
  reservas.lista
    .filter(
      (linha) =>
        linha.diasAteEntrada >= 0 &&
        linha.diasAteEntrada <= 3 &&
        (linha.reserva.status === 'confirmada' || linha.reserva.status === 'pendente') &&
        (linha.admissao === 'ausente' || linha.admissao === 'vencido'),
    )
    .sort((um, outro) => um.diasAteEntrada - outro.diasAteEntrada),
)
/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.reservas.pergunta.titulo'),
    texto: t('hotel.tour.reservas.pergunta.texto'),
  },
  {
    alvo: '.vespera',
    titulo: t('hotel.tour.reservas.vespera.titulo'),
    texto: t('hotel.tour.reservas.vespera.texto'),
  },
  {
    alvo: '.horizonte',
    titulo: t('hotel.tour.reservas.horizonte.titulo'),
    texto: t('hotel.tour.reservas.horizonte.texto'),
  },
  {
    alvo: '.clinic-table, .tabela',
    titulo: t('hotel.tour.reservas.tabela.titulo'),
    texto: t('hotel.tour.reservas.tabela.texto'),
  },
  {
    alvo: '.espera',
    titulo: t('hotel.tour.reservas.espera.titulo'),
    texto: t('hotel.tour.reservas.espera.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :title="t('hotel.reservas.titulo')"
    :subtitle="t('hotel.reservas.subtitulo')"
    :loading="reservas.carregando && reservas.lista.length === 0"
    :error="reservas.erro ? t(reservas.erro) : ''"
    :empty="vazio"
    :empty-title="t('hotel.reservas.vazioTitulo')"
    tour
    @tour="tourAberto = true"
    :empty-description="t('hotel.reservas.vazioDescricao')"
    @retry="reservas.carregarLista()"
  >
    <div class="reservas clinic-scope">
      <!--
        A véspera abre a tela. É a única coisa aqui que tem prazo: depois que o carro chega, a
        conversa sobre documento acontece no balcão, com o cliente na frente.
      -->
      <section v-if="vespera.length > 0" class="vespera">
        <h2 class="vespera__titulo">
          <i class="ph ph-warning" aria-hidden="true" />
          {{ t('hotel.reservas.vesperaTitulo', { total: vespera.length }, vespera.length) }}
        </h2>

        <p class="vespera__lede">{{ t('hotel.reservas.vesperaLede') }}</p>

        <ul class="vespera__lista">
          <li v-for="linha in vespera" :key="linha.reserva.id">
            <RouterLink class="vespera__item" :to="`/hotel/reserva/${linha.reserva.id}`">
              <PetAvatar
                :nome="linha.petNome"
                :iniciais="linha.petIniciais"
                :especie="linha.petEspecie"
                :foto-url="linha.petFotoUrl"
                tamanho="sm"
              />
              <strong>{{ linha.petNome }}</strong>
              <span class="vespera__quando">
                {{
                  linha.diasAteEntrada === 0
                    ? t('hotel.reservas.chegaHoje')
                    : t(
                        'hotel.reservas.chegaEm',
                        { dias: linha.diasAteEntrada },
                        linha.diasAteEntrada,
                      )
                }}
              </span>
              <HotelSelo
                :rotulo="formato.situacaoDaExigencia(linha.admissao)"
                :tom="tomDaAdmissao(linha.admissao)"
              />
              <i class="ph ph-arrow-right" aria-hidden="true" />
            </RouterLink>
          </li>
        </ul>
      </section>

      <div class="horizonte">
        <span class="horizonte__rotulo">{{ t('hotel.reservas.horizonte') }}</span>
        <SelectButton
          v-model="horizonte"
          :options="opcoesDeHorizonte"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          size="small"
          :aria-label="t('hotel.reservas.horizonte')"
        />
      </div>

      <ClinicFilterBar
        v-model:busca="busca"
        v-model:selecionados="selecionados"
        :grupos="grupos"
        :placeholder-busca="t('hotel.reservas.buscar')"
        :resultado="linhas.length"
      />

      <ClinicDataTable
        :colunas="colunas"
        :linhas="linhas"
        :chave="(linha: ReservaNaLista) => linha.reserva.id"
        :rotulo="t('hotel.reservas.titulo')"
        :vazio-titulo="t('hotel.reservas.semResultadoTitulo')"
        :vazio-descricao="t('hotel.reservas.semResultadoDescricao')"
        @ativar="(linha: ReservaNaLista) => router.push(`/hotel/reserva/${linha.reserva.id}`)"
      >
        <template #celula-entrada="{ linha }">
          <span class="clinic-value">{{ formato.quando(linha.reserva.entradaPrevista) }}</span>
        </template>

        <template #celula-pet="{ linha }">
          <span class="celula__pet">
            <PetAvatar
              :nome="linha.petNome"
              :iniciais="linha.petIniciais"
              :especie="linha.petEspecie"
              :foto-url="linha.petFotoUrl"
              tamanho="sm"
            />
            <span class="celula__quem">
              <strong>{{ linha.petNome }}</strong>
              <small>
                {{ linha.tutorNome }}
                <!-- Pedida pelo responsável, no app ou no link: a origem à vista, como na agenda. -->
                <i
                  v-if="linha.reserva.origem === 'app' || linha.reserva.origem === 'link'"
                  class="ph celula__origem"
                  :class="linha.reserva.origem === 'app' ? 'ph-device-mobile' : 'ph-globe-simple'"
                  :title="t(`hotel.origem.${linha.reserva.origem}`)"
                  :aria-label="t(`hotel.origem.${linha.reserva.origem}`)"
                />
              </small>
            </span>
          </span>
        </template>

        <template #celula-acomodacao="{ linha }">{{ linha.acomodacaoNome }}</template>

        <template #celula-noites="{ linha }">{{ linha.reserva.diarias }}</template>

        <template #celula-status="{ linha }">
          <HotelSelo
            :rotulo="formato.statusDaReserva(linha.reserva.status)"
            :tom="
              linha.reserva.status === 'cancelada' || linha.reserva.status === 'nao-compareceu'
                ? 'atencao'
                : linha.reserva.status === 'hospedado'
                  ? 'positivo'
                  : 'neutro'
            "
          />
        </template>

        <template #celula-admissao="{ linha }">
          <HotelSelo
            :rotulo="formato.situacaoDaExigencia(linha.admissao)"
            :tom="linha.admissao === 'ok' ? 'positivo' : tomDaAdmissao(linha.admissao)"
          />
        </template>

        <template #celula-saldo="{ linha }">
          {{ formato.moeda(linha.reserva.orcamento.saldoCentavos) }}
        </template>
      </ClinicDataTable>

      <!--
        A lista de espera mora aqui, no rodapé, e não numa tela própria: ela só é consultada quando
        uma reserva cai — e nesse momento quem está olhando já está nesta página.
      -->
      <section v-if="reservas.espera.length > 0" class="espera">
        <h2 class="espera__titulo">
          {{ t('hotel.reservas.espera', { total: reservas.espera.length }) }}
        </h2>

        <ul class="espera__lista">
          <li v-for="item in reservas.espera" :key="item.entrada.id">
            <PetAvatar
              :nome="item.petNome"
              :iniciais="item.petIniciais"
              :especie="item.petEspecie"
              :foto-url="item.petFotoUrl"
              tamanho="sm"
            />

            <div class="espera__texto">
              <strong>{{ item.petNome }}</strong>
              <span>
                {{ formato.data(item.entrada.entradaDesejada) }} →
                {{ formato.data(item.entrada.saidaDesejada) }} · {{ item.tutorNome }}
              </span>
            </div>

            <HotelSelo
              :rotulo="formato.haDias(item.esperandoHaDias)"
              :tom="item.esperandoHaDias > 7 ? 'atencao' : 'neutro'"
              icone="ph ph-hourglass"
            />
          </li>
        </ul>
      </section>
    </div>

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />

    <template #actions>
      <Button
        :label="t('hotel.reservas.novaNoMapa')"
        icon="ph ph-plus"
        size="small"
        @click="router.push('/hotel/mapa')"
      />
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
.reservas {
  display: grid;
  gap: var(--clinic-space-4);
}

/* ------------------------------------------------------------------ véspera */

.horizonte {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.horizonte__rotulo {
  font-size: 0.8125rem;
  color: var(--clinic-text-muted);
}

/*
 * Um cartão branco como os outros (redesenho de 30/09/2026), e não uma faixa pintada de pêssego de
 * ponta a ponta: a atenção mora no ícone e no título, e a superfície fica quieta.
 */
.vespera {
  display: grid;
  gap: var(--clinic-space-2);
  padding: 1.1rem 1.35rem 1.25rem;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.vespera__titulo {
  display: flex;
  align-items: center;
  margin: 0;
  gap: 0.4rem;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-body);
  font-weight: 800;
}

.vespera__lede {
  margin: 0;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  opacity: 0.9;
}

.vespera__lista {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  list-style: none;
}

.vespera__item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface);
  color: inherit;
  font: inherit;
  text-align: start;
  text-decoration: none;
}

.vespera__item:hover,
.vespera__item:focus-visible {
  border-color: var(--clinic-attention-text);
}

.vespera__item strong {
  font-weight: 750;
}

/*
 * Só o "chega em N dias" cresce para empurrar o selo à direita. O seletor era `.vespera__item
 * span` e alcançava também a raiz do selo, que é um `span` — e o selo saía esticado de ponta a
 * ponta da faixa.
 */
.vespera__quando {
  flex: 1;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.celula__pet {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
}

.celula__quem {
  display: grid;
  gap: 0;
  min-width: 0;
}

.celula__origem {
  margin-inline-start: 0.25rem;
  color: var(--hc-tinta-3);
}

.celula__pet strong {
  font-weight: 700;
}

.celula__pet small {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.espera {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.espera__titulo {
  margin: 0;
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.espera__lista {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.espera__lista li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.espera__texto {
  display: grid;
  gap: 0;
}

.espera__texto span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}
.espera__texto {
  flex: 1;
  min-width: 10rem;
}
</style>
