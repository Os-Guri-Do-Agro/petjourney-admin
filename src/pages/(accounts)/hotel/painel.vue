<script setup lang="ts">
/**
 * Painel do dia.
 *
 * A primeira versão desta tela abria com quatro cartões de número e duas listas — a mesma forma
 * de todas as outras oito telas do módulo. Era a causa direta da crítica: "várias telas parecem a
 * mesma coisa, mesmo tendo outras utilidades".
 *
 * Agora ela tem a forma do que é: **um dia**. Um trilho de horas com as chegadas em cima e as
 * saídas embaixo, e uma linha vertical no agora. Quem abre às oito vê o dia inteiro de uma vez e
 * sabe o que vem primeiro — que é a única coisa que se pede a um painel de manhã.
 *
 * Os números não sumiram: viraram **uma frase**. "5 na casa, 2 chegam, 1 sai" cabe numa linha e
 * diz o mesmo que quatro cartões ocupando um terço da tela acima da dobra.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import HotelSelo from '@/features/hotel/components/base/HotelSelo.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import BemEstarDaCasa from '@/features/hotel/components/painel/BemEstarDaCasa.vue'
import LinhaDoDia from '@/features/hotel/components/painel/LinhaDoDia.vue'
import type { MarcaDoDia } from '@/features/hotel/components/painel/dia-types'
import PassagemDialog from '@/features/hotel/components/rotina/PassagemDialog.vue'
import { tomDaAdmissao, useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import { hotelClock, useHotelStore } from '@/features/hotel/stores/hotel'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { useReservasStore } from '@/features/hotel/stores/reservas'

const { t } = useI18n()
const router = useRouter()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const hospedagem = useHospedagemStore()
const reservas = useReservasStore()

const passagemAberta = ref(false)
const hoje = hotelClock.today()

onMounted(carregar)

async function carregar() {
  await hospedagem.carregarHospedes()
  await hospedagem.carregarPrancheta(hoje)
  await hospedagem.carregarPassagem()
  /* O recorte é só hoje: o painel responde pelo dia, e a semana tem o mapa. */
  await reservas.carregarLista({ de: hoje, ate: hoje })
}

watch(
  () => hotelStore.revisao,
  () => void carregar(),
)

const chegamHoje = computed(() =>
  reservas.lista
    .filter(
      (linha) =>
        linha.reserva.entradaPrevista.slice(0, 10) === hoje &&
        (linha.reserva.status === 'confirmada' || linha.reserva.status === 'pendente'),
    )
    .sort((um, outro) => um.reserva.entradaPrevista.localeCompare(outro.reserva.entradaPrevista)),
)

const saemHoje = computed(() =>
  hospedagem.hospedes
    .filter((hospede) => hospede.saiHoje)
    .sort((um, outro) =>
      um.hospedagem.saidaPrevistaEm.localeCompare(outro.hospedagem.saidaPrevistaEm),
    ),
)

/** As marcas do trilho: chegadas em cima, saídas embaixo, cada uma levando ao seu lugar. */
const marcas = computed<MarcaDoDia[]>(() => [
  ...chegamHoje.value.map<MarcaDoDia>((linha) => ({
    id: `chegada-${linha.reserva.id}`,
    tipo: 'chegada',
    quando: linha.reserva.entradaPrevista,
    petNome: linha.petNome,
    petIniciais: linha.petIniciais,
    petEspecie: linha.petEspecie,
    petFotoUrl: linha.petFotoUrl,
    detalhe: linha.acomodacaoNome,
    travado: linha.admissao === 'ausente' || linha.admissao === 'vencido',
    rota: `/hotel/reserva/${linha.reserva.id}`,
  })),
  ...saemHoje.value.map<MarcaDoDia>((hospede) => ({
    id: `saida-${hospede.hospedagem.id}`,
    tipo: 'saida',
    quando: hospede.hospedagem.saidaPrevistaEm,
    petNome: hospede.petNome,
    petIniciais: hospede.petIniciais,
    petEspecie: hospede.petEspecie,
    petFotoUrl: hospede.petFotoUrl,
    detalhe: hospede.acomodacaoNome,
    travado: hospede.hospedagem.pesoSaidaKg === null,
    rota: `/hotel/hospedagem/${hospede.hospedagem.id}`,
  })),
])

/**
 * O que trava. Cada item é um botão que leva ao lugar onde se resolve.
 *
 * Só entra aqui o que **alguém precisa fazer agora**: ligação pendente, boletim preso atrás dela,
 * chegada de hoje sem documento. Documento vencendo de uma reserva de daqui a três dias é trabalho
 * da véspera e mora na tela de reservas.
 */
const travas = computed(() => {
  const lista: {
    id: string
    texto: string
    acao: string
    rota: string
    tom: 'risco' | 'atencao'
  }[] = []

  for (const hospede of hospedagem.hospedes) {
    if (hospede.ocorrenciaTravada) {
      lista.push({
        id: `ocor-${hospede.hospedagem.id}`,
        texto: t('hotel.painel.travaOcorrencia', { pet: hospede.petNome }),
        acao: t('hotel.painel.travaOcorrenciaAcao', { telefone: hospede.tutorTelefone }),
        rota: `/hotel/hospedagem/${hospede.hospedagem.id}`,
        tom: 'risco',
      })
    } else if (hospede.boletimRetido) {
      lista.push({
        id: `bol-${hospede.hospedagem.id}`,
        texto: t('hotel.painel.travaBoletim', { pet: hospede.petNome }),
        acao: t('hotel.painel.travaBoletimAcao'),
        rota: `/hotel/hospedagem/${hospede.hospedagem.id}`,
        tom: 'atencao',
      })
    }
  }

  for (const linha of chegamHoje.value) {
    if (linha.admissao === 'ausente' || linha.admissao === 'vencido') {
      lista.push({
        id: `adm-${linha.reserva.id}`,
        texto: t('hotel.painel.travaAdmissao', {
          pet: linha.petNome,
          hora: formato.hora(linha.reserva.entradaPrevista),
        }),
        acao: t('hotel.painel.travaAdmissaoAcao'),
        rota: `/hotel/reserva/${linha.reserva.id}`,
        tom: 'risco',
      })
    }
  }

  return lista
})

const turno = computed(() => hospedagem.passagem?.turno ?? null)

const plantonista = computed(() =>
  turno.value ? hotelStore.cuidador(turno.value.responsavelId) : null,
)

const vazio = computed(
  () =>
    !hospedagem.carregando &&
    !hospedagem.erro &&
    hospedagem.hospedes.length === 0 &&
    chegamHoje.value.length === 0,
)

async function entregarTurno(nota: string, recebidoPor: string) {
  if (await hospedagem.entregarTurno(nota, recebidoPor)) {
    passagemAberta.value = false
  }
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
    titulo: t('hotel.tour.painel.pergunta.titulo'),
    texto: t('hotel.tour.painel.pergunta.texto'),
  },
  {
    alvo: '.travas',
    titulo: t('hotel.tour.painel.travas.titulo'),
    texto: t('hotel.tour.painel.travas.texto'),
  },
  {
    alvo: '.resumo',
    titulo: t('hotel.tour.painel.resumo.titulo'),
    texto: t('hotel.tour.painel.resumo.texto'),
  },
  {
    alvo: '.trilho',
    titulo: t('hotel.tour.painel.trilho.titulo'),
    texto: t('hotel.tour.painel.trilho.texto'),
  },
  {
    alvo: '.colunas',
    titulo: t('hotel.tour.painel.colunas.titulo'),
    texto: t('hotel.tour.painel.colunas.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    :title="t('hotel.painel.titulo')"
    :subtitle="formato.dataLonga(hoje)"
    tour
    @tour="tourAberto = true"
    :loading="hospedagem.carregando && hospedagem.hospedes.length === 0"
    :error="hospedagem.erro ? t(hospedagem.erro) : ''"
    :empty="vazio"
    :empty-title="t('hotel.painel.vazioTitulo')"
    :empty-description="t('hotel.painel.vazioDescricao')"
    @retry="carregar"
  >
    <div class="painel clinic-scope">
      <!--
        O que trava abre a página, acima do próprio dia. Não é indicador: é uma lista de tarefas
        que seguram uma notícia dentro da casa, com um responsável do outro lado sem resposta.
      -->
      <section v-if="travas.length > 0" class="travas" aria-live="polite">
        <h2 class="travas__titulo">
          <i class="pi pi-bell" aria-hidden="true" />
          {{ t('hotel.painel.precisaAgora', { total: travas.length }) }}
        </h2>

        <button
          v-for="trava in travas"
          :key="trava.id"
          type="button"
          class="trava"
          :class="`trava--${trava.tom}`"
          @click="router.push(trava.rota)"
        >
          <i class="pi pi-exclamation-circle" aria-hidden="true" />
          <span class="trava__corpo">
            <strong>{{ trava.texto }}</strong>
            <span>{{ trava.acao }}</span>
          </span>
          <i class="pi pi-arrow-right" aria-hidden="true" />
        </button>
      </section>

      <!--
        A frase-resumo mora **dentro** do cartão do dia, como cabeçalho dele.
        Solta entre os avisos e o trilho, ela era um terceiro bloco flutuando entre dois blocos —
        e o olho lia três coisas onde havia duas.
      -->
      <LinhaDoDia :marcas="marcas" :agora="hospedagem.agora" @abrir="(rota) => router.push(rota)">
        <template #resumo>
          <p class="resumo">
            <span class="resumo__item">
              <strong class="clinic-value">{{ hospedagem.hospedes.length }}</strong>
              {{ t('hotel.painel.resumo.naCasa') }}
            </span>
            <span class="resumo__sep" aria-hidden="true">·</span>
            <span class="resumo__item">
              <strong class="clinic-value">{{ chegamHoje.length }}</strong>
              {{ t('hotel.painel.resumo.chegam', {}, chegamHoje.length) }}
            </span>
            <span class="resumo__sep" aria-hidden="true">·</span>
            <span class="resumo__item">
              <strong class="clinic-value">{{ saemHoje.length }}</strong>
              {{ t('hotel.painel.resumo.saem', {}, saemHoje.length) }}
            </span>
            <span class="resumo__sep" aria-hidden="true">·</span>
            <span
              class="resumo__item"
              :class="{ 'resumo__item--alerta': hospedagem.atrasadasNaPrancheta > 0 }"
            >
              <strong class="clinic-value">{{ hospedagem.pendentesNaPrancheta }}</strong>
              {{ t('hotel.painel.resumo.tarefas', {}, hospedagem.pendentesNaPrancheta) }}
              <template v-if="hospedagem.atrasadasNaPrancheta > 0">
                ({{
                  t(
                    'hotel.painel.resumo.atrasadas',
                    { total: hospedagem.atrasadasNaPrancheta },
                    hospedagem.atrasadasNaPrancheta,
                  )
                }})
              </template>
            </span>
          </p>
        </template>
      </LinhaDoDia>

      <div class="colunas">
        <!--
          As duas listas são cartões, e não títulos soltos sobre caixas soltas.
          Cada linha era uma caixa com borda própria: três bordas empilhadas onde bastava uma, e o
          olho contava molduras em vez de ler nomes.
        -->
        <section class="coluna">
          <h2 class="coluna__titulo">
            <span class="coluna__icone coluna__icone--entra" aria-hidden="true">
              <i class="pi pi-arrow-down-left" />
            </span>
            {{ t('hotel.painel.chegamHoje', { total: chegamHoje.length }) }}
          </h2>

          <p v-if="chegamHoje.length === 0" class="coluna__vazio">
            {{ t('hotel.painel.semChegadas') }}
          </p>

          <ul v-else class="lista">
            <li v-for="linha in chegamHoje" :key="linha.reserva.id">
              <button
                type="button"
                class="linha"
                @click="router.push(`/hotel/reserva/${linha.reserva.id}`)"
              >
                <span class="linha__hora clinic-value">
                  {{ formato.hora(linha.reserva.entradaPrevista) }}
                </span>

                <PetAvatar
                  :nome="linha.petNome"
                  :iniciais="linha.petIniciais"
                  :especie="linha.petEspecie"
                  :foto-url="linha.petFotoUrl"
                  tamanho="sm"
                />

                <span class="linha__corpo">
                  <strong>{{ linha.petNome }}</strong>
                  <span>{{ linha.acomodacaoNome }} · {{ linha.tutorNome }}</span>
                </span>

                <HotelSelo
                  :rotulo="
                    linha.admissao === 'ok'
                      ? t('hotel.painel.podeEntrar')
                      : formato.situacaoDaExigencia(linha.admissao)
                  "
                  :tom="linha.admissao === 'ok' ? 'positivo' : tomDaAdmissao(linha.admissao)"
                />
              </button>
            </li>
          </ul>
        </section>

        <section class="coluna">
          <h2 class="coluna__titulo">
            <span class="coluna__icone coluna__icone--sai" aria-hidden="true">
              <i class="pi pi-arrow-up-right" />
            </span>
            {{ t('hotel.painel.saemHoje', { total: saemHoje.length }) }}
          </h2>

          <p v-if="saemHoje.length === 0" class="coluna__vazio">
            {{ t('hotel.painel.semSaidas') }}
          </p>

          <ul v-else class="lista">
            <li v-for="hospede in saemHoje" :key="hospede.hospedagem.id">
              <button
                type="button"
                class="linha"
                @click="router.push(`/hotel/hospedagem/${hospede.hospedagem.id}`)"
              >
                <span class="linha__hora clinic-value">
                  {{ formato.hora(hospede.hospedagem.saidaPrevistaEm) }}
                </span>

                <PetAvatar
                  :nome="hospede.petNome"
                  :iniciais="hospede.petIniciais"
                  :especie="hospede.petEspecie"
                  :foto-url="hospede.petFotoUrl"
                  tamanho="sm"
                />

                <span class="linha__corpo">
                  <strong>{{ hospede.petNome }}</strong>
                  <span>{{ hospede.acomodacaoNome }} · {{ hospede.tutorNome }}</span>
                </span>

                <HotelSelo
                  v-if="hospede.hospedagem.pesoSaidaKg === null"
                  :rotulo="t('hotel.painel.faltaPesar')"
                  tom="atencao"
                  icone="pi pi-exclamation-triangle"
                />
                <HotelSelo
                  v-else
                  :rotulo="t('hotel.painel.prontoParaSair')"
                  tom="positivo"
                  icone="pi pi-check"
                />
              </button>
            </li>
          </ul>
        </section>
      </div>

      <!--
        Como os bichos estão. Vem depois do movimento do dia de propósito: chegada e saída têm
        hora marcada e por isso mandam na manhã, mas o animal estressado não tem hora — ele fica
        até alguém olhar. Abaixo da dobra do movimento, acima do fechamento do turno.
      -->
      <BemEstarDaCasa
        :hospedes="hospedagem.hospedes"
        :prancheta="hospedagem.prancheta"
        :agora="hospedagem.agora"
        @abrir="(rota) => router.push(rota)"
      />

      <section v-if="turno" class="turno">
        <div class="turno__quem">
          <strong>
            {{ formato.turno(turno.kind) }} · {{ formato.hora(turno.inicio) }}–{{
              formato.hora(turno.fim)
            }}
          </strong>
          <span>{{ t('hotel.painel.responsavel', { nome: plantonista?.nome ?? '' }) }}</span>
        </div>

        <div class="turno__acoes">
          <Button
            :label="t('hotel.painel.irParaRotina')"
            icon="pi pi-list-check"
            severity="secondary"
            outlined
            @click="router.push('/hotel/rotina')"
          />
          <Button
            :label="t('hotel.turno.passar')"
            icon="pi pi-sign-out"
            severity="secondary"
            outlined
            @click="passagemAberta = true"
          />
        </div>
      </section>
    </div>

    <PassagemDialog
      :aberto="passagemAberta"
      :passagem="hospedagem.passagem"
      :cuidadores="hotelStore.cuidadores"
      :salvando="hospedagem.salvando"
      :erro="hospedagem.erroDeAcao"
      @fechar="passagemAberta = false"
      @entregar="({ nota, recebidoPor }) => entregarTurno(nota, recebidoPor)"
      @ir-para="(id) => router.push(`/hotel/hospedagem/${id}`)"
    />

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
  </PartnerPageFrame>
</template>

<style scoped>
.painel {
  display: grid;
  gap: var(--clinic-space-4);
}

/* ------------------------------------------------------------------ travas */

.travas {
  display: grid;
  gap: var(--clinic-space-2);
}

.travas__titulo {
  display: flex;
  align-items: center;
  margin: 0;
  gap: 0.35rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.travas__titulo .pi {
  color: var(--clinic-risk-text);
  font-size: 0.7rem;
}

/*
 * O aviso: cartão comum, urgência no ícone.
 *
 * Passou por duas versões erradas. A primeira era uma faixa rosa de ponta a ponta — "visualmente
 * agressiva". A segunda trocou o preenchimento por uma **barra colorida na lateral**, e a barra é
 * um clichê: aparece em todo aviso de todo template, não diz nada que o ícone já não diga, e deixa
 * a tela com cara de peça pronta.
 *
 * O que sobrou é o que de fato informa: um cartão igual aos outros, e um **disco cheio** com o
 * ícone da urgência. Disco cheio, e não contorno — é o que separa "isto exige ação" de "isto é uma
 * nota", sem pintar nada além de 28 px.
 */
.trava {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
  color: var(--clinic-text);
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease;
  --trava-tom: var(--clinic-risk-text);
}

.trava:hover,
.trava:focus-visible {
  border-color: var(--trava-tom);
  box-shadow: 0 2px 10px rgb(31 47 43 / 0.08);
  outline: none;
}

.trava--atencao {
  --trava-tom: var(--clinic-attention-text);
}

/* O disco é o único lugar onde o tom preenche — e é o que faz a urgência ser vista de longe. */
.trava > .pi-exclamation-circle {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  background: var(--trava-tom);
  color: var(--clinic-surface);
  font-size: 0.82rem;
}

/* A seta some no repouso: ela é confirmação de que dá para clicar, não um elemento da frase. */
.trava > .pi-arrow-right {
  flex: 0 0 auto;
  color: var(--clinic-faint);
  font-size: 0.75rem;
  transition:
    color 120ms ease,
    transform 120ms ease;
}

.trava:hover > .pi-arrow-right,
.trava:focus-visible > .pi-arrow-right {
  color: var(--trava-tom);
  transform: translateX(2px);
}

.trava__corpo {
  display: grid;
  flex: 1;
  gap: 0.05rem;
}

.trava__corpo strong {
  color: var(--trava-tom);
  font-weight: 750;
}

.trava__corpo span {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.trava__corpo span {
  font-size: var(--clinic-font-label);
  opacity: 0.9;
}

/* ------------------------------------------------------------------ resumo em frase */

.resumo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin: 0;
  gap: 0.5rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-body);
}

.resumo__item strong {
  margin-inline-end: 0.2rem;
  color: var(--clinic-text);
  font-size: 1.15rem;
  font-weight: 800;
}

.resumo__item--alerta strong {
  color: var(--clinic-attention-text);
}

.resumo__sep {
  color: var(--clinic-line-strong);
}

/* ------------------------------------------------------------------ colunas */

.colunas {
  display: grid;
  /*
   * Cada cartão tem a altura do que carrega.
   * Esticados à altura do vizinho, o que tem uma saída ficava com metade do corpo vazio ao lado do
   * que tem duas chegadas — e vazio emparelhado com conteúdo lê como informação faltando.
   */
  align-items: start;
  gap: var(--clinic-space-4);
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
}

/*
 * Cada coluna é **um** cartão, e as linhas vivem dentro dele.
 *
 * Antes cada linha era uma caixa com borda própria, sobre um título solto: para ler dois hóspedes
 * o olho atravessava três molduras. Agora a moldura é uma só, e as linhas se separam por um filete
 * — que é como qualquer lista de verdade se separa.
 */
.coluna {
  display: grid;
  align-content: start;
  overflow: hidden;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.coluna__titulo {
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border-block-end: 1px solid var(--clinic-line-soft);
  gap: 0.5rem;
  background: var(--clinic-surface-soft);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  letter-spacing: 0.01em;
}

/*
 * A seta entra e a seta sai, em discos de tom oposto.
 * São os dois movimentos da casa, e dá para saber de qual coluna se trata sem ler o título — que
 * é o que se pede de um cabeçalho quando a tela tem duas listas parecidas lado a lado.
 */
.coluna__icone {
  display: grid;
  width: 1.4rem;
  height: 1.4rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 50%;
  font-size: 0.62rem;
}

.coluna__icone--entra {
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.coluna__icone--sai {
  background: var(--clinic-surface-sunken);
  color: var(--clinic-muted);
}

.coluna__vazio {
  margin: 0;
  padding: var(--clinic-space-4);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista li + li .linha {
  border-block-start: 1px solid var(--clinic-line-soft);
}

.linha {
  display: flex;
  align-items: center;
  width: 100%;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 0;
  gap: var(--clinic-space-3);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition: background 120ms ease;
}

.linha:hover,
.linha:focus-visible {
  background: var(--clinic-accent-tint);
  outline: none;
}

/*
 * A hora ganha coluna fixa e alinhamento tabular.
 * Sem largura fixa, "09:30" e "16:30" empurravam os nomes para posições diferentes, e a lista
 * perdia a coluna vertical que faz uma lista de horários ser lida de cima para baixo.
 */
.linha__hora {
  width: 2.9rem;
  flex: 0 0 auto;
  color: var(--clinic-text);
  font-size: 0.82rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
}

.linha__corpo {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.05rem;
}

.linha__corpo strong {
  font-weight: 700;
}

.linha__corpo span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ turno */

.turno {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface-soft);
}

.turno__quem {
  display: grid;
  gap: 0.1rem;
}

.turno__quem span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.turno__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}
</style>
