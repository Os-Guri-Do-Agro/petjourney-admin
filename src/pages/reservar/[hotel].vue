<script setup lang="ts">
/**
 * A página pública de reserva do hotel — para quem ainda não tem o app.
 *
 * Irmã da página de agendamento da clínica (`/agendar/:clinica`): sem conta e sem senha, o mesmo
 * fluxo do app, o cadastro mínimo no fim e, com `?pedido=<código>`, o acompanhamento do pedido — o
 * endereço que vai na mensagem de confirmação.
 *
 * **Protótipo:** os dados moram na memória desta aba, e a faixa de demonstração leva de volta ao
 * portal só para quem tem sessão.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import LanguageSwitcher from '@/components/common/LanguageSwitcher.vue'
import FluxoDaReserva from '@/features/hotel/components/pedidos/fluxo/FluxoDaReserva.vue'
import {
  criarFluxoDaReserva,
  proverFluxoDaReserva,
} from '@/features/hotel/components/pedidos/fluxo/fluxo-da-reserva'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import type { PedidoDeReservaPeloLink } from '@/features/hotel/contrato/responsavel'
import {
  pedidoDeReservaRepository,
  reservaOnlineDoResponsavel,
} from '@/features/hotel/data/reserva-online'
import { usePedidosDeReservaStore } from '@/features/hotel/stores/pedidos-de-reserva'
import { isAuthenticated } from '@/service/auth/auth-session'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const formato = useHotelFormat()
const pedidosStore = usePedidosDeReservaStore()

const fluxo = criarFluxoDaReserva({
  canal: 'link',
  tutorId: () => null,
  aoMudar: () => void pedidosStore.avisarMudanca(),
})

proverFluxoDaReserva(fluxo)

const hotel = computed(() => fluxo.hotel.value)
const encontrado = computed(
  () => pedidoDeReservaRepository.configuracao().slug === String(route.params.hotel ?? ''),
)
const endereco = computed(
  () => `${window.location.origin}/reservar/${String(route.params.hotel ?? '')}`,
)

onMounted(() => {
  if (encontrado.value) {
    void fluxo.iniciar()
  }
})

const token = computed(() => (typeof route.query.pedido === 'string' ? route.query.pedido : ''))
const acompanhado = ref<PedidoDeReservaPeloLink | null>(null)
const desistindo = ref(false)

async function carregarAcompanhado() {
  acompanhado.value = token.value
    ? await reservaOnlineDoResponsavel.pedidoPorToken(token.value)
    : null
}

watch(token, carregarAcompanhado, { immediate: true })
watch(() => pedidosStore.versao, carregarAcompanhado)

async function desistir() {
  if (!acompanhado.value) {
    return
  }

  desistindo.value = true

  try {
    await reservaOnlineDoResponsavel.cancelarPedido(acompanhado.value.id)
    await pedidosStore.avisarMudanca()
    await carregarAcompanhado()
  } finally {
    desistindo.value = false
  }
}

function novoPedido() {
  void router.replace({ path: route.path })
}

const temSessao = computed(() => isAuthenticated())
</script>

<template>
  <div class="publica hc-tema">
    <div v-if="temSessao" class="publica__demo">
      <span>
        <i class="ph ph-flask" aria-hidden="true" />
        {{ t('hotel.pedidos.link.demo') }}
      </span>
      <Button
        size="small"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        :label="t('hotel.pedidos.link.voltarAoPortal')"
        @click="router.push('/hotel/pedidos')"
      />
    </div>

    <main class="publica__miolo">
      <header class="publica__topo">
        <div class="publica__marca">
          <span class="publica__icone" aria-hidden="true"><i class="ph ph-house-line" /></span>
          <div v-if="hotel">
            <h1>{{ hotel.hotel.nome }}</h1>
            <p>{{ hotel.hotel.endereco }}</p>
            <p class="publica__estado">
              <i class="ph ph-clock" aria-hidden="true" />
              {{
                t('hotel.pedidos.app.balcao', {
                  abre: hotel.balcao.abre,
                  fecha: hotel.balcao.fecha,
                })
              }}
            </p>
          </div>
        </div>
        <LanguageSwitcher variant="auth" tone="surface" />
      </header>

      <section v-if="!encontrado" class="publica__cartao publica__vazio">
        <i class="ph ph-magnifying-glass" aria-hidden="true" />
        <h2>{{ t('hotel.pedidos.link.naoEncontrado') }}</h2>
        <p>{{ t('hotel.pedidos.link.naoEncontradoAjuda') }}</p>
      </section>

      <section v-else-if="token" class="publica__cartao publica__acompanhar">
        <template v-if="acompanhado">
          <p class="fx-rotulo">{{ t('hotel.pedidos.link.seuPedido') }}</p>
          <h2>{{ acompanhado.pets.map((pet) => pet.nome).join(' · ') }}</h2>
          <p>{{ formato.periodo(acompanhado.entrada, acompanhado.saida) }}</p>
          <p class="publica__situacao" :class="`publica__situacao--${acompanhado.status}`">
            {{ t(`hotel.pedidos.link.situacao.${acompanhado.status}`) }}
          </p>
          <p v-if="acompanhado.reserva" class="publica__marcado">
            {{ acompanhado.reserva.acomodacao }} ·
            {{ formato.moeda(acompanhado.reserva.totalCentavos) }}
          </p>
          <p v-if="acompanhado.reserva" class="fx-ajuda">
            {{
              t('hotel.pedidos.link.sinal', {
                valor: formato.moeda(acompanhado.reserva.sinalCentavos),
              })
            }}
          </p>
          <blockquote v-if="acompanhado.recusa" class="publica__mensagem">
            {{ acompanhado.recusa.mensagemDoHotel }}
          </blockquote>
          <div class="publica__acoes">
            <Button
              v-if="acompanhado.podeCancelar"
              severity="secondary"
              outlined
              :label="t('hotel.pedidos.app.desistir')"
              :loading="desistindo"
              @click="desistir"
            />
            <Button
              :label="t('hotel.pedidos.link.outroPedido')"
              icon="ph ph-calendar-plus"
              @click="novoPedido"
            />
          </div>
        </template>
        <template v-else>
          <h2>{{ t('hotel.pedidos.link.pedidoNaoEncontrado') }}</h2>
          <Button :label="t('hotel.pedidos.link.outroPedido')" @click="novoPedido" />
        </template>
      </section>

      <section v-else class="publica__cartao publica__fluxo">
        <FluxoDaReserva :endereco-do-link="endereco" />
      </section>

      <footer class="publica__rodape">{{ t('hotel.pedidos.link.rodape') }}</footer>
    </main>
  </div>
</template>

<style scoped>
.publica {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--hc-pagina);
  color: var(--hc-tinta);
}

.publica__demo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px dashed var(--hc-borda);
  gap: 0.5rem;
  background: var(--hc-cartao);
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.publica__demo > span {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.publica__miolo {
  display: grid;
  width: min(32rem, 100%);
  margin: 0 auto;
  padding: 1.25rem 1rem 2rem;
  gap: 1rem;
}

.publica__topo {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.publica__marca {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.publica__marca h1 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.2;
}

.publica__marca p {
  margin: 0.15rem 0 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.publica__icone {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  flex: 0 0 auto;
  border-radius: 0.8rem;
  background: var(--hc-marca-forte);
  color: #ffffff;
  font-size: 1.3rem;
  place-items: center;
}

.publica__estado {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 650;
}

.publica__cartao {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  border: 1px solid var(--hc-borda);
  border-radius: 1.1rem;
  gap: 0.75rem;
  background: var(--hc-cartao);
  box-shadow: var(--hc-sombra);
}

.publica__fluxo {
  min-height: 34rem;
}

.publica__vazio,
.publica__acompanhar {
  align-items: flex-start;
}

.publica__vazio > i {
  color: var(--hc-tinta-3);
  font-size: 1.6rem;
}

.publica__cartao h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 750;
}

.publica__cartao p {
  margin: 0;
}

.publica__situacao {
  font-weight: 700;
}

.publica__situacao--ACEITO {
  color: var(--hc-marca-forte);
}

.publica__situacao--RECUSADO,
.publica__situacao--EXPIRADO {
  color: var(--clinic-attention-text);
}

.publica__marcado {
  font-size: 1rem;
  font-weight: 700;
}

.publica__mensagem {
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-radius: 0.7rem;
  background: var(--hc-fundo);
  color: var(--hc-tinta-2);
  line-height: 1.5;
}

.publica__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.publica__rodape {
  color: var(--hc-tinta-3);
  font-size: 0.75rem;
  text-align: center;
}
</style>
