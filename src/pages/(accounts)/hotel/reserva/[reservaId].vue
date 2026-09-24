<script setup lang="ts">
/**
 * A reserva — o contrato, antes de virar estadia.
 *
 * É a tela em que a recepção precisa **fazer o check-in inteiro sem abrir outra**. Por isso ela
 * reúne quatro coisas que em outros sistemas moram em quatro lugares: o período, a conta, os
 * documentos e a ficha. Quem atende com o cliente na frente não navega.
 *
 * A ordem não é a do cadastro, é a da conversa: primeiro onde e quando, depois quanto, depois o
 * que falta de papel. O botão de check-in fica no rodapé de tudo isso, e só acende quando a regra
 * R1 deixa.
 */
import Button from 'primevue/button'
import Message from 'primevue/message'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import HotelSelo from '@/features/hotel/components/base/HotelSelo.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import CheckInDialog from '@/features/hotel/components/estadia/CheckInDialog.vue'
import ExigenciaDialog from '@/features/hotel/components/reserva/ExigenciaDialog.vue'
import ExigenciasLista from '@/features/hotel/components/reserva/ExigenciasLista.vue'
import OrcamentoTabela from '@/features/hotel/components/reserva/OrcamentoTabela.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import type { ExigenciaKind, MedicacaoDaEstadia } from '@/features/hotel/data/types'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { hotelClock, useHotelStore } from '@/features/hotel/stores/hotel'
import { useReservasStore } from '@/features/hotel/stores/reservas'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const reservas = useReservasStore()
const hospedagem = useHospedagemStore()

const reservaId = computed(() => String(route.params.reservaId ?? ''))
const alvoDaExigencia = ref<{ kind: ExigenciaKind; modo: 'registrar' | 'dispensar' } | null>(null)
const checkInAberto = ref(false)

onMounted(async () => {
  await reservas.abrir(reservaId.value)
})

watch(
  () => hotelStore.revisao,
  () => void reservas.abrir(reservaId.value),
)

const detalhe = computed(() => reservas.detalhe)
const reserva = computed(() => detalhe.value?.reserva ?? null)
const pet = computed(() => (reserva.value ? hotelStore.pet(reserva.value.petId) : null))
const acompanhante = computed(() =>
  reserva.value?.acompanhantePetId ? hotelStore.pet(reserva.value.acompanhantePetId) : null,
)
const tutor = computed(() => (reserva.value ? hotelStore.tutor(reserva.value.tutorId) : null))
const acomodacao = computed(() =>
  reserva.value ? hotelStore.acomodacao(reserva.value.acomodacaoId) : null,
)

const podeFazerCheckIn = computed(
  () =>
    reserva.value?.status === 'confirmada' ||
    (reserva.value?.status === 'pendente' && detalhe.value?.admissao.liberada === true),
)

/**
 * O acréscimo de saída, mostrado **na reserva** e não descoberto no balcão.
 *
 * É a regra que mais gera discussão, e discussão de balcão se resolve mostrando a regra na tela
 * antes de o cliente chegar.
 */
const acrescimoDeSaida = computed(
  () =>
    reserva.value?.orcamento.linhas.find((linha) => linha.kind === 'meia-diaria')?.totalCentavos ??
    0,
)

/**
 * Os tipos de serviço vendidos nesta reserva.
 *
 * O contrato guarda `servicoId`; quem recebe o animal precisa do **kind**, porque é ele que diz
 * qual autorização o serviço exige. A tradução mora aqui, que é quem tem o catálogo à mão.
 */
const servicosVendidos = computed(() =>
  (reserva.value?.servicos ?? [])
    .map((contratado) => hotelStore.servico(contratado.servicoId)?.kind)
    .filter((kind): kind is NonNullable<typeof kind> => Boolean(kind)),
)

/** Tudo o que o diálogo coleta; a reserva é acrescentada aqui, que é quem a conhece. */
type DadosDoCheckIn = Omit<Parameters<typeof hospedagem.checkIn>[0], 'reservaId' | 'medicacoes'> & {
  medicacoes: {
    descricao: string
    via: MedicacaoDaEstadia['via']
    doseTexto: string
    horarios: string[]
    receita: string
    observacao: string
  }[]
}

async function fazerCheckIn(payload: DadosDoCheckIn) {
  if (!reserva.value) {
    return
  }

  const criada = await hospedagem.checkIn({
    ...payload,
    reservaId: reserva.value.id,
    /*
     * A janela da medicação é a estadia inteira, e é decidida aqui e não no diálogo: perguntar
     * duas datas em toda entrada para atender o caso raro é o tipo de campo que a recepção passa a
     * preencher no automático. Suspender no meio já existe na tela da estadia.
     */
    medicacoes: payload.medicacoes.map((item) => ({
      ...item,
      horarios: item.horarios as MedicacaoDaEstadia['horarios'],
      inicio: hotelClock.today(),
      fim: null,
      suspensaEm: null,
    })),
  })

  if (criada) {
    checkInAberto.value = false
    await router.push(`/hotel/hospedagem/${criada.id}`)
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
    titulo: t('hotel.tour.reserva.pergunta.titulo'),
    texto: t('hotel.tour.reserva.pergunta.texto'),
  },
  {
    alvo: '.periodo',
    titulo: t('hotel.tour.reserva.periodo.titulo'),
    texto: t('hotel.tour.reserva.periodo.texto'),
  },
  {
    alvo: '.exig',
    titulo: t('hotel.tour.reserva.exigencias.titulo'),
    texto: t('hotel.tour.reserva.exigencias.texto'),
  },
  {
    alvo: '.coluna--acao, .cartao',
    titulo: t('hotel.tour.reserva.checkin.titulo'),
    texto: t('hotel.tour.reserva.checkin.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    :title="pet?.nome ?? t('hotel.reserva.titulo')"
    :subtitle="t('hotel.reserva.subtitulo')"
    tour
    @tour="tourAberto = true"
    :loading="reservas.carregando && !detalhe"
    :error="reservas.erro ? t(reservas.erro) : ''"
    @retry="reservas.abrir(reservaId)"
  >
    <div v-if="detalhe && reserva" class="reserva clinic-scope">
      <section class="topo">
        <!--
          Os retratos abrem a tela. Dois quando a reserva tem acompanhante: é a única pista visual
          de que a baia recebe dois animais, e ela precisa aparecer antes da conta.
        -->
        <span class="topo__retratos">
          <PetAvatar
            v-if="pet"
            :nome="pet.nome"
            :iniciais="pet.iniciais"
            :especie="pet.especie"
            :foto-url="pet.fotoUrl"
            tamanho="lg"
          />
          <PetAvatar
            v-if="acompanhante"
            class="topo__acompanha"
            :nome="acompanhante.nome"
            :iniciais="acompanhante.iniciais"
            :especie="acompanhante.especie"
            :foto-url="acompanhante.fotoUrl"
            tamanho="md"
          />
        </span>

        <div class="topo__quem">
          <h2 class="topo__nome">
            {{ pet?.nome }}
            <span v-if="acompanhante" class="topo__acompanhante"> + {{ acompanhante.nome }} </span>
          </h2>
          <p class="topo__linha">
            {{ pet ? formato.especie(pet.especie) : '' }}
            <template v-if="pet?.porte"> · {{ formato.porte(pet.porte) }}</template>
            · {{ pet?.raca }}
          </p>
          <p class="topo__linha">{{ tutor?.nome }} · {{ tutor?.telefone }}</p>
        </div>

        <div class="topo__estado">
          <HotelSelo
            :rotulo="formato.statusDaReserva(reserva.status)"
            :tom="reserva.status === 'hospedado' ? 'positivo' : 'neutro'"
          />
          <HotelSelo :rotulo="formato.origem(reserva.origem)" tom="neutro" icone="pi pi-tag" />
        </div>
      </section>

      <div class="colunas">
        <div class="coluna">
          <section class="cartao">
            <h3 class="cartao__titulo">{{ t('hotel.reserva.periodo') }}</h3>

            <p class="periodo">
              <strong class="clinic-value">{{ formato.quando(reserva.entradaPrevista) }}</strong>
              <i class="pi pi-arrow-right" aria-hidden="true" />
              <strong class="clinic-value">{{ formato.quando(reserva.saidaPrevista) }}</strong>
            </p>

            <p class="periodo__detalhe">
              {{ t('hotel.reserva.diarias', { total: reserva.diarias }, reserva.diarias) }}
              · {{ acomodacao?.nome }}
              <template v-if="acomodacao">
                ({{ hotelStore.tipoDeAcomodacao(acomodacao.tipoId)?.nome }})
              </template>
            </p>

            <!--
              A saída tardia é dita aqui, com o valor, e não no balcão. É a regra que mais gera
              discussão — e discussão de balcão se resolve mostrando a regra antes.
            -->
            <p v-if="acrescimoDeSaida > 0" class="aviso aviso--atencao">
              <i class="pi pi-clock" aria-hidden="true" />
              {{ t('hotel.reserva.saidaTardia', { valor: formato.moeda(acrescimoDeSaida) }) }}
            </p>

            <!--
              A vaga é reavaliada agora: a acomodação pode ter saído de operação depois da venda,
              e descobrir isso no dia da chegada é descobrir tarde.
            -->
            <p v-if="detalhe.vaga.impedimentos.length > 0" class="aviso aviso--risco">
              <i class="pi pi-exclamation-triangle" aria-hidden="true" />
              {{ t(`hotel.impedimento.${detalhe.vaga.impedimentos[0]}`) }}
            </p>

            <p v-if="reserva.observacao" class="observacao">
              <i class="pi pi-comment" aria-hidden="true" />
              {{ reserva.observacao }}
            </p>
          </section>

          <section class="cartao">
            <h3 class="cartao__titulo">{{ t('hotel.reserva.exigencias') }}</h3>

            <ExigenciasLista
              :admissao="detalhe.admissao"
              @registrar="(kind) => (alvoDaExigencia = { kind, modo: 'registrar' })"
              @dispensar="(kind) => (alvoDaExigencia = { kind, modo: 'dispensar' })"
            />
          </section>
        </div>

        <div class="coluna">
          <section class="cartao">
            <OrcamentoTabela :orcamento="reserva.orcamento" :pago-centavos="reserva.pagoCentavos" />

            <div class="conta__acoes">
              <Button
                v-if="reserva.status === 'pendente'"
                :label="t('hotel.reserva.confirmarSinal')"
                icon="pi pi-check"
                :loading="reservas.salvando"
                @click="reservas.confirmar(reserva.id, reserva.orcamento.sinalCentavos)"
              />

              <p v-if="reserva.status !== 'encerrada'" class="conta__politica">
                {{
                  detalhe.sinalDevolve
                    ? t('hotel.reserva.sinalDevolve')
                    : t('hotel.reserva.sinalNaoDevolve')
                }}
              </p>
            </div>
          </section>

          <section v-if="detalhe.hospedagemId" class="cartao cartao--acao">
            <p>{{ t('hotel.reserva.jaHospedado') }}</p>
            <Button
              :label="t('hotel.reserva.irParaEstadia')"
              icon="pi pi-arrow-right"
              icon-pos="right"
              @click="router.push(`/hotel/hospedagem/${detalhe.hospedagemId}`)"
            />
          </section>

          <section v-else-if="podeFazerCheckIn" class="cartao cartao--acao">
            <Message v-if="!detalhe.admissao.liberada" severity="error" :closable="false">
              {{ t('hotel.reserva.checkInBloqueado') }}
            </Message>

            <Button
              :label="t('hotel.reserva.fazerCheckIn')"
              icon="pi pi-sign-in"
              :disabled="!detalhe.admissao.liberada"
              @click="checkInAberto = true"
            />
          </section>
        </div>
      </div>
    </div>

    <ExigenciaDialog
      :alvo="alvoDaExigencia"
      :exigencias="hotelStore.exigencias"
      :cuidadores="hotelStore.cuidadores"
      :salvando="reservas.salvando"
      :erro="reservas.erroDeAcao"
      @fechar="alvoDaExigencia = null"
      @registrar="
        async (payload) => {
          if (!reserva) return
          await reservas.registrarComprovante({ ...payload, petId: reserva.petId })
          alvoDaExigencia = null
        }
      "
      @dispensar="
        async (payload) => {
          if (!reserva) return
          await reservas.dispensar({ ...payload, reservaId: reserva.id })
          alvoDaExigencia = null
        }
      "
    />

    <CheckInDialog
      :aberto="checkInAberto"
      :pet-nome="pet?.nome ?? ''"
      :peso-cadastro-kg="pet?.pesoKg ?? null"
      :telefone-responsavel="tutor?.telefone ?? ''"
      :admissao="detalhe?.admissao ?? null"
      :servicos-vendidos="servicosVendidos"
      :observacao-da-reserva="reserva?.observacao ?? ''"
      :salvando="hospedagem.salvando"
      :erro="hospedagem.erroDeAcao"
      @fechar="checkInAberto = false"
      @confirmar="fazerCheckIn"
    />

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
  </PartnerPageFrame>
</template>

<style scoped>
.reserva {
  display: grid;
  gap: var(--clinic-space-4);
}

.topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
}

.topo__nome {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.topo__acompanhante {
  color: var(--clinic-accent-strong);
  font-size: 1rem;
  font-weight: 700;
}

.topo__linha {
  margin: 0.1rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.topo__estado {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

.colunas {
  display: grid;
  gap: var(--clinic-space-4);
  grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr));
}

.coluna {
  display: grid;
  gap: var(--clinic-space-4);
  align-content: start;
}

.cartao {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.cartao--acao {
  justify-items: start;
}

.cartao__titulo {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.periodo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-body);
}

.periodo strong {
  font-weight: 800;
}

.periodo__detalhe,
.observacao {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.observacao {
  display: flex;
  align-items: flex-start;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface-soft);
}

.aviso {
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid transparent;
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.aviso--atencao {
  border-color: var(--clinic-attention-line);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.aviso--risco {
  border-color: var(--clinic-risk-line);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

.conta__acoes {
  display: grid;
  gap: var(--clinic-space-2);
  justify-items: start;
}

.conta__politica {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}
.topo__retratos {
  display: flex;
  align-items: center;
}

/* O acompanhante encosta no principal, sobrepondo de leve: são um par, não dois hóspedes. */
.topo__acompanha {
  margin-inline-start: -0.7rem;
  box-shadow: 0 0 0 2px var(--clinic-surface);
}
/* O nome cresce; o retrato à esquerda e os selos à direita ficam onde estão. */
.topo__quem {
  flex: 1;
  min-width: 12rem;
}
</style>
