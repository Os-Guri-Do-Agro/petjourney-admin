<script setup lang="ts">
/**
 * O agendamento no celular do responsável — a outra metade da demonstração.
 *
 * A recepção responde à esquerda e o aviso chega aqui, na mesma hora; a pessoa pede aqui e a linha
 * aparece na caixa de pedidos ao lado. Lê **só o contrato**, como a carteirinha e o boletim no
 * app: se a prévia mostrasse o que a clínica sabe, a demonstração mentiria sobre o que chega ao
 * celular. A especificação para o app está em `docs/clinico/18-*.md`.
 *
 * Moldura sóbria, como as outras prévias do app: o que se julga aqui é o fluxo.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePedidosStore } from '../../stores/pedidos'
import { clinicClock } from '../../stores/clinico'

import FluxoDoPedido from './fluxo/FluxoDoPedido.vue'
import { criarFluxoDoPedido, proverFluxo } from './fluxo/fluxo-do-pedido'

const props = defineProps<{
  tutorId: string
}>()

const emit = defineEmits<{
  /** O celular mudou alguma coisa na clínica: um pedido novo, uma desistência, um cancelamento. */
  mudou: []
}>()

const { t } = useI18n()
const pedidosStore = usePedidosStore()

const fluxo = criarFluxoDoPedido({
  canal: 'app',
  tutorId: () => props.tutorId,
  aoMudar: () => emit('mudou'),
})

proverFluxo(fluxo)

onMounted(() => fluxo.iniciar())

/* Trocar de pessoa é outro celular: começa do zero. */
watch(
  () => props.tutorId,
  () => {
    avisoFechado.value = null
    void fluxo.recomecar()
  },
)

/* A recepção respondeu: o celular busca o aviso, como o push faria. */
watch(
  () => pedidosStore.versao,
  () => void fluxo.recarregarConta(),
)

/** Quanto tempo o aviso fica no topo depois de a clínica responder. */
const AVISO_RECENTE_EM_MINUTOS = 30

const avisoFechado = ref<string | null>(null)

const avisoRecente = computed(() => {
  const [aviso] = fluxo.avisos.value

  if (!aviso || aviso.id === avisoFechado.value) {
    return null
  }

  const idade = Date.parse(clinicClock.nowIso()) - Date.parse(aviso.criadoEm)

  return idade <= AVISO_RECENTE_EM_MINUTOS * 60_000 ? aviso : null
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
              <small>{{ t('clinico.pedidos.app.pushOrigem') }}</small>
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
            :aria-label="t('clinico.pedidos.app.fecharAviso')"
            @click="avisoFechado = avisoRecente.id"
          />
        </div>
      </Transition>

      <FluxoDoPedido />
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

/*
 * Raio zero e nada escondido: com o raio de pílula do tema e `overflow: hidden`, os cantos
 * arredondados comiam o começo da primeira e da última linha do aviso ("Journey", "terinária").
 */
.celular__push-abrir.p-button {
  min-width: 0;
  overflow: visible;
  border-radius: 0.4rem;
  height: auto;
  flex: 1;
  justify-content: flex-start;
  padding: 0;
  white-space: normal;
  border: 0;
  background: transparent;
  color: var(--hc-tinta);
  text-align: start;
}

.celular__push-abrir.p-button:not(:disabled):hover {
  background: transparent;
}
</style>
