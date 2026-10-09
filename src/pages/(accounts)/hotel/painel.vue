<script setup lang="ts">
/**
 * Painel do dia.
 *
 * A primeira versão desta tela abria com quatro cartões de número e duas listas — a mesma forma
 * de todas as outras oito telas do módulo. Era a causa direta da crítica: "várias telas parecem a
 * mesma coisa, mesmo tendo outras utilidades".
 *
 * Ela tem a forma do que é: **um dia**. Um trilho de horas com as chegadas em cima e as saídas
 * embaixo, e uma linha vertical no agora. Quem abre às oito vê o dia inteiro de uma vez e sabe o
 * que vem primeiro — que é a única coisa que se pede a um painel de manhã.
 *
 * ## A forma (redesenho de 30/09/2026)
 *
 * A de Hoje na clínica, com o dia do hotel:
 *
 * 1. **A saudação** — a data e o turno (horário e quem está de plantão) na linha pequena, e os
 *    números do dia numa frase ("5 na casa · 2 chegam · 1 sai"), com as pílulas ao lado: abrir a
 *    rotina é a cheia, o próximo passo de quem abre o painel; passar o turno é contornada.
 * 2. **O que pede ação** — a pauta da Visão geral (`PautaTabela`). As faixas pintadas de ponta a
 *    ponta que abriam a tela viraram linhas com selo: ocorrência sem contato e chegada sem
 *    documento como urgentes, boletim retido como atenção, e a rotina atrasada pela mesma regra
 *    da Visão geral (`tomDaRotinaAtrasada`: urgente se há medicação atrasada). O contato com o
 *    responsável se registra na estadia; a tela não liga.
 * 3. **O dia** — o trilho, e as chegadas e saídas por extenso.
 * 4. **Bem-estar na casa** — como os bichos estão, que não tem hora marcada.
 */
import { PhArrowsLeftRight, PhClock, PhListChecks, PhSignIn, PhSignOut } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import PautaTabela from '@/components/home/PautaTabela.vue'
import { porGravidade, type LinhaDaTabela } from '@/components/home/pauta-tabela'
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
import { tomDaRotinaAtrasada } from '@/features/hotel/domain/rotina'
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
 * O que pede ação. Só entra o que **alguém precisa fazer agora**: ocorrência grave sem contato com
 * o responsável, boletim preso atrás dela, chegada de hoje sem documento, e — numa linha só — as
 * tarefas atrasadas da rotina, cuja lista mora na prancheta. Documento vencendo de uma reserva de
 * daqui a três dias é trabalho da véspera e mora na tela de reservas.
 */
const linhasDaPauta = computed<LinhaDaTabela[]>(() => {
  const linhas: LinhaDaTabela[] = []
  const estadia = t('hotel.painel.onde.estadia')

  for (const hospede of hospedagem.hospedes) {
    const to = `/hotel/hospedagem/${hospede.hospedagem.id}`
    const responsavel = t('hotel.painel.pauta.responsavel', {
      nome: hospede.tutorNome,
      telefone: hospede.tutorTelefone,
    })

    if (hospede.ocorrenciaTravada) {
      linhas.push({
        id: `ocor-${hospede.hospedagem.id}`,
        to,
        frase: t('hotel.painel.pauta.ocorrencia', { pet: hospede.petNome }),
        detalhe: responsavel,
        tom: 'risco',
        onde: estadia,
      })
    } else if (hospede.boletimRetido) {
      linhas.push({
        id: `bol-${hospede.hospedagem.id}`,
        to,
        frase: t('hotel.painel.pauta.boletim', { pet: hospede.petNome }),
        detalhe: responsavel,
        tom: 'atencao',
        onde: estadia,
      })
    }
  }

  for (const linha of chegamHoje.value) {
    if (linha.admissao === 'ausente' || linha.admissao === 'vencido') {
      linhas.push({
        id: `adm-${linha.reserva.id}`,
        to: `/hotel/reserva/${linha.reserva.id}`,
        frase: t('hotel.painel.travaAdmissao', {
          pet: linha.petNome,
          hora: formato.hora(linha.reserva.entradaPrevista),
        }),
        detalhe: t('hotel.painel.travaAdmissaoAcao'),
        tom: 'risco',
        onde: t('hotel.painel.onde.reserva'),
      })
    }
  }

  const atrasadas = hospedagem.atrasadasNaPrancheta
  const medicacoes = hospedagem.medicacoesAtrasadasNaPrancheta

  if (atrasadas > 0) {
    linhas.push({
      id: 'rotina',
      to: '/hotel/rotina',
      frase: t('inicio.pauta.rotina', { total: atrasadas }, atrasadas),
      detalhe:
        medicacoes > 0
          ? t('inicio.pauta.parte.medicacoesAtrasadas', { total: medicacoes }, medicacoes)
          : undefined,
      // A mesma regra da Visão geral: medicação atrasada torna a rotina urgente.
      tom: tomDaRotinaAtrasada(atrasadas, medicacoes),
      onde: t('inicio.pauta.onde.rotina'),
    })
  }

  return porGravidade(linhas)
})

const urgentes = computed(() => linhasDaPauta.value.filter((linha) => linha.tom === 'risco').length)

/** A frase da saudação: os números do dia, e quantos assuntos são urgentes. */
const fraseDoDia = computed(() => {
  const partes = [
    `${hospedagem.hospedes.length} ${t('hotel.painel.resumo.naCasa')}`,
    `${chegamHoje.value.length} ${t('hotel.painel.resumo.chegam', {}, chegamHoje.value.length)}`,
    `${saemHoje.value.length} ${t('hotel.painel.resumo.saem', {}, saemHoje.value.length)}`,
  ]

  if (urgentes.value > 0) {
    partes.push(t('hotel.painel.frase.urgentes', { total: urgentes.value }, urgentes.value))
  }

  return partes.join(' · ')
})

const turno = computed(() => hospedagem.passagem?.turno ?? null)

const plantonista = computed(() =>
  turno.value ? hotelStore.cuidador(turno.value.responsavelId) : null,
)

/** A linha pequena da saudação: a data e, quando há, o turno e quem está nele. */
const linhaDoTurno = computed(() => {
  const data = formato.dataLonga(hoje)
  const partes = [data.charAt(0).toLocaleUpperCase() + data.slice(1)]

  if (turno.value) {
    partes.push(
      `${formato.turno(turno.value.kind)} ${formato.hora(turno.value.inicio)}–${formato.hora(turno.value.fim)}`,
    )
  }

  if (plantonista.value) {
    partes.push(plantonista.value.nome)
  }

  return partes.join(' · ')
})

type Acao = { id: string; rotulo: string; icone: Component; to?: string; executar?: () => void }

/** A cheia é abrir a rotina: quem abre o painel vai executar. Passar o turno fica contornada. */
const acoes = computed<Acao[]>(() => {
  const lista: Acao[] = [
    { id: 'rotina', rotulo: t('hotel.painel.irParaRotina'), icone: PhListChecks, to: '/hotel/rotina' },
  ]

  if (turno.value) {
    lista.push({
      id: 'turno',
      rotulo: t('hotel.turno.passar'),
      icone: PhArrowsLeftRight,
      executar: () => (passagemAberta.value = true),
    })
  }

  return lista
})

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
    alvo: '.hc-saudacao__resumo',
    titulo: t('hotel.tour.painel.resumo.titulo'),
    texto: t('hotel.tour.painel.resumo.texto'),
  },
  {
    alvo: '.pauta',
    titulo: t('hotel.tour.painel.travas.titulo'),
    texto: t('hotel.tour.painel.travas.texto'),
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
    class="hc-tema"
    :title="t('hotel.painel.titulo')"
    tour
    @tour="tourAberto = true"
    :loading="hospedagem.carregando && hospedagem.hospedes.length === 0"
    :error="hospedagem.erro ? t(hospedagem.erro) : ''"
    :empty="vazio"
    :empty-title="t('hotel.painel.vazioTitulo')"
    :empty-description="t('hotel.painel.vazioDescricao')"
    @retry="carregar"
  >
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ linhaDoTurno }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('hotel.painel.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p class="hc-saudacao__resumo" aria-live="polite">{{ fraseDoDia }}</p>

          <nav class="hc-acoes" :aria-label="t('hotel.painel.acoesRotulo')">
            <template v-for="(acao, indice) in acoes" :key="acao.id">
              <RouterLink
                v-if="acao.to"
                class="hc-pilula"
                :class="{ 'hc-pilula--cheia': indice === 0 }"
                :to="acao.to"
              >
                <component
                  :is="acao.icone"
                  class="hc-pilula__icone"
                  :weight="indice === 0 ? 'fill' : 'duotone'"
                  aria-hidden="true"
                />
                {{ acao.rotulo }}
              </RouterLink>
              <Button
                v-else
                type="button"
                class="hc-pilula"
                :label="acao.rotulo"
                @click="acao.executar?.()"
              >
                <template #icon>
                  <component
                    :is="acao.icone"
                    class="hc-pilula__icone"
                    weight="duotone"
                    aria-hidden="true"
                  />
                </template>
              </Button>
            </template>
          </nav>
        </div>
      </div>
    </template>

    <div class="painel clinic-scope">
      <!--
        O que trava abre a página, acima do próprio dia: são tarefas que seguram uma notícia dentro
        da casa, com um responsável do outro lado sem resposta.
      -->
      <section v-if="linhasDaPauta.length > 0" class="hc pauta" aria-labelledby="painel-pauta">
        <header class="hc__cabeca">
          <h2 id="painel-pauta" class="hc__titulo">
            <PhListChecks class="hc__icone" weight="duotone" aria-hidden="true" />
            {{ t('inicio.pauta.titulo') }}
          </h2>
        </header>

        <PautaTabela :linhas="linhasDaPauta" />
      </section>

      <!--
        O título do cartão do dia: além de dizer o que ele é, é o cabeçalho que reserva o espaço do
        rótulo do agora, que sobe acima do trilho — sem ele, o rótulo vazava por cima do cartão de
        cima.
      -->
      <LinhaDoDia :marcas="marcas" :agora="hospedagem.agora" @abrir="(rota) => router.push(rota)">
        <template #resumo>
          <h2 class="hc__titulo">
            <PhClock class="hc__icone" weight="duotone" aria-hidden="true" />
            {{ t('hotel.painel.movimentoDoDia') }}
          </h2>
        </template>
      </LinhaDoDia>

      <div class="colunas">
        <section class="hc coluna" aria-labelledby="painel-chegam">
          <header class="hc__cabeca">
            <h2 id="painel-chegam" class="hc__titulo">
              <PhSignIn class="hc__icone" weight="duotone" aria-hidden="true" />
              {{ t('hotel.painel.chegamHoje', { total: chegamHoje.length }) }}
            </h2>
          </header>

          <p v-if="chegamHoje.length === 0" class="coluna__vazio">
            {{ t('hotel.painel.semChegadas') }}
          </p>

          <ul v-else class="lista">
            <li v-for="linha in chegamHoje" :key="linha.reserva.id">
              <RouterLink class="linha" :to="`/hotel/reserva/${linha.reserva.id}`">
                <span class="linha__hora">{{ formato.hora(linha.reserva.entradaPrevista) }}</span>
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
              </RouterLink>
            </li>
          </ul>
        </section>

        <section class="hc coluna" aria-labelledby="painel-saem">
          <header class="hc__cabeca">
            <h2 id="painel-saem" class="hc__titulo">
              <PhSignOut class="hc__icone" weight="duotone" aria-hidden="true" />
              {{ t('hotel.painel.saemHoje', { total: saemHoje.length }) }}
            </h2>
          </header>

          <p v-if="saemHoje.length === 0" class="coluna__vazio">
            {{ t('hotel.painel.semSaidas') }}
          </p>

          <ul v-else class="lista">
            <li v-for="hospede in saemHoje" :key="hospede.hospedagem.id">
              <RouterLink class="linha" :to="`/hotel/hospedagem/${hospede.hospedagem.id}`">
                <span class="linha__hora">{{ formato.hora(hospede.hospedagem.saidaPrevistaEm) }}</span>
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
                  icone="ph ph-warning"
                />
                <HotelSelo
                  v-else
                  :rotulo="t('hotel.painel.prontoParaSair')"
                  tom="positivo"
                  icone="ph ph-check"
                />
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>

      <!--
        Como os bichos estão. Vem depois do movimento do dia de propósito: chegada e saída têm
        hora marcada e por isso mandam na manhã, mas o animal estressado não tem hora — ele fica
        até alguém olhar.
      -->
      <BemEstarDaCasa
        :hospedes="hospedagem.hospedes"
        :prancheta="hospedagem.prancheta"
        :agora="hospedagem.agora"
      />
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
  gap: 1.25rem;
}

.pauta {
  gap: 0.75rem;
}

/* ------------------------------------------------------------------ colunas */

.colunas {
  display: grid;
  /*
   * Cada cartão tem a altura do que carrega. Esticados à altura do vizinho, o que tem uma saída
   * ficava com metade do corpo vazio ao lado do que tem duas chegadas — e vazio emparelhado com
   * conteúdo lê como informação faltando.
   */
  align-items: start;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
}

.coluna {
  gap: 0.5rem;
}

.coluna__vazio {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

/* As linhas se separam por fio, como qualquer lista de verdade: uma moldura só, a do cartão. */
.lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista li + li {
  border-block-start: 1px solid var(--hc-linha);
}

.linha {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.25rem;
  padding: 0.55rem 0.5rem;
  border-radius: 0.5rem;
  color: var(--hc-tinta);
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.linha:hover {
  background: var(--hc-fundo);
}

.linha:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: -2px;
}

/*
 * A hora ganha coluna fixa e alinhamento tabular. Sem largura fixa, "09:30" e "16:30" empurravam
 * os nomes para posições diferentes, e a lista perdia a coluna vertical dos horários.
 */
.linha__hora {
  width: 2.9rem;
  flex: 0 0 auto;
  color: var(--hc-marca-forte);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.linha__corpo {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.05rem;
}

.linha__corpo strong {
  font-size: 0.875rem;
  font-weight: 600;
}

.linha__corpo span {
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .linha {
    transition: none;
  }
}
</style>
