<script setup lang="ts">
/**
 * A reserva no celular do responsável — a outra metade da demonstração do hotel.
 *
 * O balcão responde à esquerda, o aviso chega aqui; a pessoa pede aqui, a linha aparece na caixa
 * ao lado. Lê só o contrato, como as prévias do app no módulo clínico. Especificação para o app em
 * `docs/hotel/03-reserva-online.md`.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { agoraIso } from '../../data/store'
import { usePedidosDeReservaStore } from '../../stores/pedidos-de-reserva'

import FluxoDaReserva from './fluxo/FluxoDaReserva.vue'
import { criarFluxoDaReserva, proverFluxoDaReserva } from './fluxo/fluxo-da-reserva'

const props = defineProps<{ tutorId: string }>()

const emit = defineEmits<{ mudou: [] }>()

const { t } = useI18n()
const pedidosStore = usePedidosDeReservaStore()

const fluxo = criarFluxoDaReserva({
  canal: 'app',
  tutorId: () => props.tutorId,
  aoMudar: () => emit('mudou'),
})

proverFluxoDaReserva(fluxo)

onMounted(() => fluxo.iniciar())

watch(
  () => props.tutorId,
  () => {
    avisoFechado.value = null
    void fluxo.recomecar()
  },
)

watch(
  () => pedidosStore.versao,
  () => void fluxo.recarregarConta(),
)

const avisoFechado = ref<string | null>(null)

const avisoRecente = computed(() => {
  const [aviso] = fluxo.avisos.value

  if (!aviso || aviso.id === avisoFechado.value) {
    return null
  }

  return Date.parse(agoraIso()) - Date.parse(aviso.criadoEm) <= 30 * 60_000 ? aviso : null
})

function abrirAviso() {
  avisoFechado.value = avisoRecente.value?.id ?? null
  void fluxo.recomecar()
}
</script>

<template>
  <div class="celular">
    <div class="celular__moldura">
      <Transition name="fx-aviso">
        <div v-if="avisoRecente" :key="avisoRecente.id" class="fx-push celular__push" role="status">
          <span class="fx-push__marca" aria-hidden="true"><i class="ph ph-bell" /></span>
          <Button class="celular__push-abrir" text @click="abrirAviso">
            <span class="fx-push__texto">
              <small>{{ t('hotel.pedidos.app.pushOrigem') }}</small>
              <strong>{{ avisoRecente.titulo }}</strong>
              <span>{{ avisoRecente.corpo }}</span>
            </span>
          </Button>
          <Button
            icon="ph ph-x"
            severity="secondary"
            text
            rounded
            size="small"
            :aria-label="t('hotel.pedidos.app.fecharAviso')"
            @click="avisoFechado = avisoRecente.id"
          />
        </div>
      </Transition>

      <FluxoDaReserva />
    </div>
  </div>
</template>

<style scoped>
.celular {
  display: flex;
  justify-content: center;
}

.celular__moldura {
  position: relative;
  display: flex;
  overflow: hidden;
  width: min(22rem, 100%);
  /* A gaveta tem o cabeçalho e o ensaio em cima: o celular cabe no que sobra da janela. */
  height: min(44rem, calc(100dvh - 16.5rem));
  min-height: 28rem;
  flex-direction: column;
  padding: 0.9rem;
  border: 1px solid var(--clinic-line-strong);
  border-radius: 1.6rem;
  gap: 0.6rem;
  background: var(--hc-fundo);
  box-shadow: var(--clinic-shadow-card);
}

.celular__push {
  flex: 0 0 auto;
}

/* Raio zero e nada escondido: o raio de pílula do tema com `overflow: hidden` comia as pontas das linhas. */
.celular__push-abrir.p-button {
  min-width: 0;
  overflow: visible;
  border-radius: 0.4rem;
  height: auto;
  flex: 1;
  justify-content: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--hc-tinta);
  text-align: start;
  white-space: normal;
}

.celular__push-abrir.p-button:not(:disabled):hover {
  background: transparent;
}
</style>
