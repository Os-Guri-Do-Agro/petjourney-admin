<script setup lang="ts">
/**
 * O sino do portal (E1-06): "Avisos" no pé da barra, com quantos deste parceiro estão por ler, e a
 * lista numa gaveta ao lado.
 *
 * Só os avisos do parceiro aberto: quem é membro de dois vê em cada um só o que é dele. Abrir um
 * aviso marca como lido; o que leva a uma tela do portal leva até ela. "Marcar como lidos" marca os
 * da lista um por um, porque o "marcar todas" da API marcaria também os avisos dos pets no app.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Skeleton from 'primevue/skeleton'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useAvisosDoParceiro } from '@/composables/useAvisosDoParceiro'
import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { INTL_LOCALE, isRTLLocale, type Locale } from '@/i18n/locales'
import type { Aviso } from '@/service/parceiro/avisos-service'
import { useParceiroStore } from '@/stores/parceiro'

defineProps<{ recolhida: boolean }>()

const aberta = defineModel<boolean>('aberta', { default: false })

const LARGURA = '26.5rem'

/** A tela do portal que resolve o aviso. Tipo sem entrada aqui só se lê. */
const ROTA_DO_AVISO: Record<string, string> = {
  PARCEIRO_MODULO_VENCENDO: '/inicio',
  PARCEIRO_MODULO_SUSPENSO: '/inicio',
}

const ICONE_DO_AVISO: Record<string, string> = {
  PARCEIRO_MODULO_VENCENDO: 'ph ph-hourglass-medium',
  PARCEIRO_MODULO_SUSPENSO: 'ph ph-pause-circle',
  PARCEIRO_CONVITE_EQUIPE: 'ph ph-envelope-simple',
}

const { t, locale } = useI18n()
const store = useParceiroStore()
const telaLarga = useTelaLarga()

const ativo = computed(
  () => store.loadState === 'ready' && !store.semAcessoParceiro && !store.cadastroSuspenso,
)

const {
  naoLidas,
  avisos,
  proximoCursor,
  carregandoLista,
  carregandoMais,
  erroDaLista,
  listaCarregada,
  marcandoTodas,
  naoLidasNaLista,
  carregarLista,
  carregarMais,
  abrir,
  marcarTodasComoLidas,
} = useAvisosDoParceiro(() => ativo.value)

useSidePanelOffset(
  computed(() => aberta.value && telaLarga.value),
  LARGURA,
)

const posicao = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))

const rotulo = computed(() =>
  naoLidas.value
    ? t('shell.avisos.rotuloComNaoLidas', { total: naoLidas.value }, naoLidas.value)
    : t('shell.avisos.titulo'),
)

/* A lista é pedida a cada abertura: o número do sino pode ter mudado desde a última. */
watch(aberta, (agora) => {
  if (agora) void carregarLista()
})

function quando(iso: string) {
  const data = new Date(iso)
  const hoje = new Date()
  const intl = INTL_LOCALE[locale.value as Locale]

  if (data.toDateString() === hoje.toDateString()) {
    return data.toLocaleTimeString(intl, { hour: '2-digit', minute: '2-digit' })
  }

  return data.toLocaleDateString(intl, {
    day: 'numeric',
    month: 'short',
    year: data.getFullYear() === hoje.getFullYear() ? undefined : 'numeric',
  })
}

function irPara(aviso: Aviso) {
  abrir(aviso)
  aberta.value = false
}
</script>

<template>
  <Button
    v-if="ativo"
    unstyled
    type="button"
    class="sino"
    :aria-label="rotulo"
    :title="recolhida ? rotulo : undefined"
    aria-haspopup="dialog"
    :aria-expanded="aberta"
    @click="aberta = true"
  >
    <span class="sino__icone" aria-hidden="true"><i class="ph ph-bell" /></span>
    <span class="sino__texto shell-rotulo">{{ t('shell.avisos.titulo') }}</span>
    <span v-if="naoLidas" class="sino__selo" :class="{ 'sino__selo--recolhida': recolhida }">
      {{ naoLidas }}
    </span>
  </Button>

  <Drawer
    v-model:visible="aberta"
    :position="posicao"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="avisos-gaveta"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
  >
    <template #header>
      <div class="avisos__cabeca">
        <h2 class="avisos__titulo">
          <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
            <i class="ph ph-bell" />
          </span>
          {{ t('shell.avisos.titulo') }}
        </h2>
        <p class="avisos__de">{{ t('shell.avisos.de', { parceiro: store.parceiroNome }) }}</p>
      </div>
    </template>

    <div class="avisos">
      <div v-if="naoLidasNaLista > 0" class="avisos__barra">
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-checks"
          :label="t('shell.avisos.marcarLidos')"
          :loading="marcandoTodas"
          @click="marcarTodasComoLidas"
        />
      </div>

      <div
        v-if="carregandoLista && !listaCarregada"
        class="avisos__esqueleto"
        role="status"
        aria-busy="true"
        :aria-label="t('shell.avisos.carregando')"
      >
        <div v-for="n in 4" :key="n" class="avisos__esqueleto-linha">
          <Skeleton shape="circle" size="34px" />
          <div class="avisos__esqueleto-texto">
            <Skeleton width="70%" height="13px" border-radius="6px" />
            <Skeleton width="90%" height="12px" border-radius="6px" />
          </div>
        </div>
      </div>

      <div v-else-if="erroDaLista && avisos.length === 0" class="avisos__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <p>{{ t('shell.avisos.erro') }}</p>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('shell.avisos.tentar')"
          :loading="carregandoLista"
          @click="carregarLista"
        />
      </div>

      <p v-else-if="listaCarregada && avisos.length === 0" class="ui-vazio avisos__vazio">
        <i class="ph ph-bell-simple" aria-hidden="true" />
        <strong>{{ t('shell.avisos.vazioTitulo') }}</strong>
        <span>{{ t('shell.avisos.vazio') }}</span>
      </p>

      <ul v-else class="avisos__lista">
        <li v-for="aviso in avisos" :key="aviso.id">
          <component
            :is="ROTA_DO_AVISO[aviso.tipo] ? RouterLink : Button"
            v-bind="
              ROTA_DO_AVISO[aviso.tipo]
                ? { to: ROTA_DO_AVISO[aviso.tipo] }
                : { unstyled: true, type: 'button' }
            "
            class="aviso"
            :class="{ 'aviso--nova': !aviso.lidaEm }"
            @click="ROTA_DO_AVISO[aviso.tipo] ? irPara(aviso) : abrir(aviso)"
          >
            <span class="aviso__icone" aria-hidden="true">
              <i :class="ICONE_DO_AVISO[aviso.tipo] ?? 'ph ph-bell'" />
            </span>
            <span class="aviso__texto">
              <strong class="aviso__titulo">{{ aviso.titulo }}</strong>
              <span class="aviso__corpo">{{ aviso.corpo }}</span>
              <time class="aviso__quando" :datetime="aviso.criadoEm">{{
                quando(aviso.criadoEm)
              }}</time>
            </span>
            <span v-if="!aviso.lidaEm" class="aviso__ponto">
              <span class="sr-only">{{ t('shell.avisos.naoLido') }}</span>
            </span>
          </component>
        </li>
      </ul>

      <Button
        v-if="proximoCursor && avisos.length > 0"
        type="button"
        class="avisos__mais"
        size="small"
        severity="secondary"
        outlined
        :label="t('shell.avisos.mais')"
        :loading="carregandoMais"
        @click="carregarMais"
      />
    </div>
  </Drawer>
</template>

<style scoped>
/* ------------------------------------------------------------------------------ o gatilho
 * Uma linha do pé da barra, irmã de "Validar cupom": o mesmo ícone em ladrilho e a mesma altura.
 */
.sino {
  position: relative;
  display: flex;
  height: 42px;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  padding: 0 10px 0 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--sobre-rail-2);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  text-align: start;
  white-space: nowrap;
}

.sino:hover {
  background: rgb(255 255 255 / 6%);
  color: var(--sobre-rail);
}

.sino:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: 2px;
}

.sino__icone {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  background: rgb(255 255 255 / 7%);
  font-size: 18px;
}

.sino__texto {
  flex: 1;
}

/* O mesmo selo neutro dos destinos da barra: aviso é informação, não urgência. */
.sino__selo {
  display: inline-grid;
  flex: none;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  place-items: center;
  border-radius: 999px;
  background: rgb(255 255 255 / 14%);
  color: var(--sobre-rail);
  font-family: var(--font-dados);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  line-height: 1;
}

/* Recolhida: as palavras somem e o selo vai para o canto do ícone, como nos destinos. */
.sino__selo--recolhida {
  position: absolute;
  top: 3px;
  inset-inline-start: 30px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
}

/* ------------------------------------------------------------------------------- a gaveta */

.avisos__cabeca {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.avisos__titulo {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.avisos__de {
  margin: 0;
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avisos {
  display: grid;
  gap: 14px;
  padding-bottom: 8px;
}

.avisos__barra {
  display: flex;
  justify-content: flex-end;
}

.avisos__lista {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.aviso {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  text-align: start;
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.aviso:hover {
  background: var(--superficie-2);
}

.aviso:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -2px;
}

.aviso__icone {
  display: grid;
  flex: none;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 17px;
}

.aviso--nova .aviso__icone {
  background: color-mix(
    in oklab,
    var(--pj-lugar-fundo, var(--superficie-2)) 80%,
    var(--superficie)
  );
  color: var(--pj-lugar-tinta, var(--tinta));
}

.aviso__texto {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
}

.aviso__titulo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.35;
}

.aviso--nova .aviso__titulo {
  font-weight: 650;
}

.aviso__corpo {
  font-size: 13px;
  line-height: 1.45;
}

.aviso__quando {
  color: var(--tinta-3);
  font-family: var(--font-dados);
  font-size: 11.5px;
}

.aviso__ponto {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 999px;
  background: var(--pj-lugar, var(--musgo));
}

.avisos__vazio {
  justify-items: start;
  padding: 24px 4px;
}

.avisos__vazio > i {
  color: var(--tinta-3);
  font-size: 22px;
}

.avisos__erro {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 16px 4px;
  color: var(--tinta-2);
  font-size: 14px;
}

.avisos__erro > i {
  color: var(--risco-tinta);
  font-size: 20px;
}

.avisos__erro p {
  margin: 0;
}

.avisos__esqueleto {
  display: grid;
  gap: 18px;
  padding: 12px;
}

.avisos__esqueleto-linha {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.avisos__esqueleto-texto {
  display: grid;
  flex: 1;
  gap: 8px;
}

.avisos__mais {
  justify-self: center;
}

@media (prefers-reduced-motion: reduce) {
  .aviso {
    transition: none;
  }
}
</style>
