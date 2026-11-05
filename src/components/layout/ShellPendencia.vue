<script setup lang="ts">
/**
 * O pedido do pé da barra: o que falta à pessoa para assinar receitas e prontuários (a identidade
 * confirmada e o CRMV na ficha), com o botão que leva até lá. Mora acima de "Avisos" e
 * aparece em todas as telas até que a pendência se resolva. Também aparece na gaveta do tablet.
 *
 * Tudo sai do `/parceiro/portal/eu` que a store já carrega, sem pedido novo:
 * - falta o CRMV quando `aguardandoCrmv` não está vazio (alguma permissão da pessoa exige o CRMV);
 * - falta a identidade quando ela não está aprovada nem em análise e a pessoa assina, ou passaria a
 *   assinar: o motivo do selo é `SEM_IDENTIDADE` ou falta o CRMV. Quem não assina nada (recepção,
 *   hotel) não vê o pedido.
 *
 * Com as duas faltando, o botão leva ao primeiro passo (a identidade). Depois do envio, o pedido
 * passa a ser só o do CRMV.
 *
 * O pedido é sóbrio, sem cor de alerta: o ícone diz do que se trata e a frase pede. Fechar vale até
 * o fim da sessão (`sessionStorage`), por pessoa e por pedido: quando o que falta muda, o pedido
 * novo volta a aparecer.
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { ROTA_DA_IDENTIDADE } from '@/composables/useSeloDeAssinatura'
import { authSessionVersion, getAuthUser } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'

const props = defineProps<{ recolhida: boolean }>()

const emit = defineEmits<{ navegou: [] }>()

type Pedido = 'ambos' | 'identidade' | 'crmv'

const CHAVE = 'pj:pendencia-fechada'
const ROTA_DA_FICHA = '/parceiro/profissionais'

const { t } = useI18n()
const store = useParceiroStore()

const eu = computed(() => (store.loadState === 'ready' ? store.eu : null))
const statusDaIdentidade = computed(() => eu.value?.identidade?.status ?? null)

const faltaCrmv = computed(() => (eu.value?.aguardandoCrmv?.length ?? 0) > 0)

const faltaIdentidade = computed(() => {
  const status = statusDaIdentidade.value

  if (status === 'APROVADA' || status === 'EM_ANALISE') return false

  return eu.value?.motivoDaConferencia === 'SEM_IDENTIDADE' || faltaCrmv.value
})

const pedido = computed<Pedido | null>(() => {
  if (faltaIdentidade.value && faltaCrmv.value) return 'ambos'
  if (faltaIdentidade.value) return 'identidade'
  if (faltaCrmv.value) return 'crmv'

  return null
})

/** O que identifica o pedido fechado: mudou o que falta (ou o envio foi recusado), volta. */
const assinatura = computed(() =>
  pedido.value ? `${pedido.value}:${statusDaIdentidade.value ?? 'nenhum'}` : '',
)

function chave() {
  void authSessionVersion.value
  return `${CHAVE}:${getAuthUser()?.userId ?? 'anonimo'}`
}

function lerFechado() {
  try {
    return window.sessionStorage.getItem(chave())
  } catch {
    return null
  }
}

/* O `sessionStorage` não avisa quando muda: fechar conta uma versão para a leitura refazer. */
const versao = ref(0)
/* Sem armazenamento (aba privada, dados bloqueados), fecha só até recarregar. */
const fechadoSemArmazenamento = ref('')

const fechado = computed(() => {
  void versao.value
  return lerFechado() ?? fechadoSemArmazenamento.value
})

const visivel = computed(() => Boolean(pedido.value) && fechado.value !== assinatura.value)

/** Já mandou uma vez e não valeu (recusada, revogada, cancelada): o pedido é para mandar de novo. */
const jaEnviou = computed(() => statusDaIdentidade.value !== null)

const destino = computed(() => (pedido.value === 'crmv' ? ROTA_DA_FICHA : ROTA_DA_IDENTIDADE))

const icone = computed(() =>
  pedido.value === 'crmv' ? 'ph ph-stethoscope' : 'ph ph-identification-card',
)

const titulo = computed(() => (pedido.value ? t(`shell.pendencia.${pedido.value}.titulo`) : ''))

const frase = computed(() => {
  if ((pedido.value === 'identidade' || pedido.value === 'ambos') && jaEnviou.value) {
    return t(`shell.pendencia.${pedido.value}.reenviar`)
  }

  return pedido.value ? t(`shell.pendencia.${pedido.value}.frase`) : ''
})

const acao = computed(() => {
  if (pedido.value === 'crmv') return t('shell.pendencia.crmv.acao')

  return jaEnviou.value ? t('shell.pendencia.enviarDeNovo') : t('shell.pendencia.verificar')
})

function fechar() {
  fechadoSemArmazenamento.value = assinatura.value

  try {
    window.sessionStorage.setItem(chave(), assinatura.value)
  } catch {
    /* fica valendo o `fechadoSemArmazenamento` */
  }

  versao.value += 1
}
</script>

<template>
  <Transition name="pendencia">
    <!-- Recolhida: só o ícone, que leva ao lugar; o título vai no `title`. -->
    <Button
      v-if="visivel && props.recolhida"
      :as="RouterLink"
      :to="destino"
      unstyled
      class="pendencia-icone"
      :aria-label="`${titulo}. ${acao}`"
      :title="`${titulo}\n${frase}`"
      @click="emit('navegou')"
    >
      <i :class="icone" aria-hidden="true" />
      <span class="pendencia-icone__ponto" aria-hidden="true" />
    </Button>

    <section v-else-if="visivel" class="pendencia" aria-labelledby="pendencia-titulo">
      <div class="pendencia__cabeca">
        <span class="pendencia__ladrilho" aria-hidden="true"><i :class="icone" /></span>
        <strong id="pendencia-titulo" class="pendencia__titulo">{{ titulo }}</strong>
        <Button
          unstyled
          type="button"
          class="pendencia__fechar"
          :aria-label="t('shell.pendencia.fechar')"
          :title="t('shell.pendencia.fecharDica')"
          @click="fechar"
        >
          <i class="ph ph-x" aria-hidden="true" />
        </Button>
      </div>
      <p class="pendencia__frase">{{ frase }}</p>
      <Button
        :as="RouterLink"
        :to="destino"
        size="small"
        severity="secondary"
        outlined
        class="pendencia__acao"
        :label="acao"
        @click="emit('navegou')"
      />
    </section>
  </Transition>
</template>

<style scoped>
/*
 * Uma folha lisa no pé da barra, separada do menu por uma régua fina: nada de cor de alerta nem de
 * superfície pintada. Os tokens são os do menu do app; os de depois da vírgula, os da barra
 * escura do portal.
 */
.pendencia {
  display: grid;
  gap: 8px;
  margin-bottom: 4px;
  padding: 12px;
  border: 1px solid var(--app-regua, rgb(255 255 255 / 10%));
  border-radius: 14px;
  background: var(--app-fundo, rgb(255 255 255 / 4%));
  color: var(--app-tinta, var(--sobre-rail));
}

.pendencia__cabeca {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.pendencia__ladrilho {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  background: var(--app-veu, rgb(255 255 255 / 7%));
  color: var(--app-salvia-texto, var(--sobre-rail-2));
  font-size: 17px;
}

.pendencia__titulo {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  font-weight: 650;
  line-height: 1.3;
}

.pendencia__fechar {
  display: grid;
  flex: none;
  width: 28px;
  height: 28px;
  margin-inline-end: -4px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--app-apagado, var(--sobre-rail-2));
  cursor: pointer;
  font-size: 15px;
  transition:
    background-color 150ms ease-out,
    color 150ms ease-out;
}

.pendencia__fechar:hover {
  background: var(--app-veu, rgb(255 255 255 / 8%));
  color: var(--app-tinta, var(--sobre-rail));
}

.pendencia__fechar:focus-visible,
.pendencia-icone:focus-visible {
  outline: 2px solid var(--app-tinta, var(--sobre-rail));
  outline-offset: 2px;
}

.pendencia__frase {
  margin: 0;
  color: var(--app-texto-2, var(--sobre-rail-2));
  font-size: 12.5px;
  line-height: 1.45;
}

.pendencia__acao {
  justify-self: start;
  margin-top: 2px;
  text-decoration: none;
}

/* Recolhida: o quadradinho do menu, com o ponto no canto (a urgência mora no ícone). */
.pendencia-icone {
  position: relative;
  display: grid;
  width: 40px;
  height: 40px;
  margin: 0 auto 4px;
  place-items: center;
  border-radius: 13px;
  background: var(--app-veu, rgb(255 255 255 / 7%));
  color: var(--app-salvia-texto, var(--sobre-rail-2));
  font-size: 19px;
  text-decoration: none;
}

.pendencia-icone:hover {
  background: var(--app-veu-forte, rgb(255 255 255 / 12%));
  color: var(--app-tinta, var(--sobre-rail));
}

.pendencia-icone__ponto {
  position: absolute;
  top: 5px;
  inset-inline-end: 5px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--app-tinta, var(--sobre-rail));
  box-shadow: 0 0 0 2px var(--app-fundo, transparent);
}

/* Fechar é mudança de estado: o pedido sai em 160 ms, sem espetáculo (Regra 4). */
.pendencia-leave-active {
  transition: opacity 160ms ease-out;
}

.pendencia-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pendencia-leave-active,
  .pendencia__fechar {
    transition: none;
  }
}
</style>
