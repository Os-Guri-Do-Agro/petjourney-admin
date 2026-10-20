<script setup lang="ts">
/**
 * Indique e ganhe: o código de indicação, o QR e as leituras dele.
 *
 * ## No Início
 *
 * Uma seção calma, embaixo: o QR pequeno (clicável), o código em letra grande para ser ditado ao
 * telefone e as duas ações de quem vai divulgar — copiar o código e abrir o painel com o resto.
 * Sem cadastro aprovado ou sem o Programa de Afiliados ativo não há código, e a seção não aparece:
 * o bloco do Portal, lá em cima, já diz em que pé está o programa.
 *
 * ## O painel lateral
 *
 * Tudo o que a indicação tem: o QR grande para mostrar ou imprimir, o código e o link para copiar,
 * as leituras do QR nos últimos dias e como a participação funciona. Abre pelo QR, pelo botão da
 * seção e pelo atalho "Compartilhar código" do bloco do Portal (`abrirQr`). Sem a imagem do QR
 * (serviço de imagem fora), o painel abre do mesmo jeito, só sem o quadro.
 *
 * O QR fica sempre sobre papel claro (`--sobre-rail`, igual nos dois temas): leitor de QR precisa
 * de zona quieta clara, e no tema escuro a folha é escura.
 *
 * ## As leituras
 *
 * São pedidas junto com o código, e não só quando o painel abre: o bloco do Portal mostra quantas
 * leituras houve na semana (`resumo`, exposto para a página).
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import UiSecao from '@/components/ui/UiSecao.vue'
import IndicacaoMetricasCard from '@/components/parceiro/IndicacaoMetricasCard.vue'
import { useExportarQr } from '@/composables/useExportarQr'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  getPortalIndicacao,
  getPortalIndicacaoMetricas,
} from '@/service/parceiro/parceiro-portal-service'
import type { IndicacaoMetricas, PortalIndicacao } from '@/service/parceiro/types'
import { resolveMetricasErro, type MetricasEstadoErro } from '@/utils/parceiro/indicacao-metricas'

const { t } = useI18n()
const toast = useToast()
const { ensureContext, parceiroQuery } = useParceiroPortal()

const indicacao = ref<PortalIndicacao | null>(null)
const carregando = ref(true)
const falhou = ref(false)
const painelAberto = ref(false)
/** A URL do QR pode existir e a imagem não carregar (serviço de imagem fora): aí o quadro some. */
const qrFalhou = ref(false)
const imagemGrande = ref<HTMLImageElement | null>(null)

const codigo = computed(() => indicacao.value?.codigoIndicacao ?? '')
const link = computed(() => indicacao.value?.link ?? '')
/** O link como se lê: sem o protocolo, para caber numa linha. A cópia leva o endereço inteiro. */
const linkLegivel = computed(() => link.value.replace(/^https?:\/\//, ''))
const qrUrl = computed(() => indicacao.value?.qrImageUrl ?? '')
const podeIndicar = computed(() => Boolean(indicacao.value?.podeIndicar))

/** Há QR para mostrar — é o que decide se o quadro e o atalho "Compartilhar código" existem. */
const temQr = computed(() => podeIndicar.value && Boolean(qrUrl.value) && !qrFalhou.value)

/** A seção aparece carregando, com falha, ou com código; sem programa ativo, não. */
const visivel = computed(() => carregando.value || falhou.value || podeIndicar.value)

watch(qrUrl, () => {
  qrFalhou.value = false
})

const { exportando, exportar, imprimir } = useExportarQr({
  imageUrl: () => qrUrl.value,
  code: () => codigo.value,
  imgRef: imagemGrande,
})

async function carregar() {
  falhou.value = false
  carregando.value = true

  try {
    await ensureContext()
    indicacao.value = await getPortalIndicacao(parceiroQuery())
  } catch {
    falhou.value = true
  } finally {
    carregando.value = false
  }

  if (podeIndicar.value && !metricas.value) {
    void carregarMetricas()
  }
}

async function copiarTexto(texto: string, resumo: string) {
  if (!texto) return

  try {
    await navigator.clipboard.writeText(texto)
    toast.add({ severity: 'success', summary: resumo, detail: texto, life: 2500 })
  } catch {
    toast.add({
      severity: 'warn',
      summary: t('inicio.dash.referral.toastCopyFail'),
      detail: t('inicio.dash.referral.toastCopyFailDetail'),
      life: 3500,
    })
  }
}

function copiar() {
  return copiarTexto(codigo.value, t('inicio.dash.referral.toastCopied'))
}

function copiarLink() {
  return copiarTexto(link.value, t('inicio.indique.linkCopiado'))
}

/** O painel inteiro (link, leituras, como funciona), com ou sem a imagem do QR. */
function abrirPainel() {
  if (podeIndicar.value) {
    painelAberto.value = true
  }
}

/** O atalho "Compartilhar código": só existe com QR, e abre o mesmo painel. */
function abrirQr() {
  if (temQr.value) {
    painelAberto.value = true
  }
}

/* ------------------------------------------------------------------ leituras do QR */

const metricas = ref<IndicacaoMetricas | null>(null)
const metricasCarregando = ref(false)
const metricasErro = ref<MetricasEstadoErro | null>(null)

async function carregarMetricas() {
  if (metricasCarregando.value) return

  metricasCarregando.value = true
  metricasErro.value = null

  try {
    metricas.value = await getPortalIndicacaoMetricas(parceiroQuery())
  } catch (erro) {
    metricasErro.value = resolveMetricasErro(erro)
  } finally {
    metricasCarregando.value = false
  }
}

/* Abrir o painel depois de uma falha das leituras tenta de novo: é quem foi ver que precisa delas. */
watch(painelAberto, (aberto) => {
  if (aberto && !metricas.value && !metricasCarregando.value) {
    void carregarMetricas()
  }
})

function diaLocal(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')

  return `${data.getFullYear()}-${mes}-${dia}`
}

/**
 * O que o bloco do Portal mostra: as leituras dos últimos sete dias (hoje incluído) e o total.
 * `null` enquanto carrega; `indisponivel` quando a fonte não respondeu.
 */
const resumo = computed(() => {
  if (!metricas.value) {
    return {
      semana: null,
      total: null,
      indisponivel: !metricasCarregando.value && metricasErro.value !== null,
    }
  }

  const inicio = new Date()
  inicio.setDate(inicio.getDate() - 6)
  const desde = diaLocal(inicio)

  return {
    semana: metricas.value.byDay
      .filter((item) => item.day.slice(0, 10) >= desde)
      .reduce((soma, item) => soma + item.count, 0),
    total: metricas.value.scanCount,
    indisponivel: false,
  }
})

onMounted(() => {
  void carregar()
})

defineExpose({ abrirQr, temQr, podeIndicar, visivel, resumo, carregando })
</script>

<template>
  <UiSecao
    v-if="visivel"
    id="inicio-indique"
    class="indique"
    :titulo="t('inicio.indique.titulo')"
    :descricao="isGuidanceVisible ? t('inicio.indique.descricao') : undefined"
  >
    <template v-if="podeIndicar" #acoes>
      <RouterLink class="ui-mais indique__divulgacao" to="/parceiro/divulgacao">
        {{ t('inicio.indique.abrir') }}
        <i class="ph ph-arrow-right indique__seta" aria-hidden="true" />
      </RouterLink>
    </template>

    <div
      v-if="carregando"
      class="indique__folha ui-folha"
      role="status"
      aria-busy="true"
      :aria-label="t('inicio.indique.carregando')"
    >
      <div class="indique__linha">
        <Skeleton width="64px" height="64px" border-radius="12px" />
        <span class="indique__texto">
          <Skeleton width="9rem" height="0.8rem" border-radius="6px" />
          <Skeleton width="7rem" height="1.4rem" border-radius="6px" />
        </span>
      </div>
    </div>

    <div v-else-if="falhou" class="indique__folha ui-folha" role="alert">
      <p class="indique__falha">{{ t('inicio.indique.falhou') }}</p>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        icon="ph ph-arrow-clockwise"
        :label="t('inicio.saldo.tentar')"
        @click="carregar"
      />
    </div>

    <div v-else class="indique__folha ui-folha">
      <div class="indique__linha">
        <button
          v-if="temQr"
          type="button"
          class="indique__qr"
          :aria-label="t('inicio.indique.ampliarQr')"
          :title="t('inicio.indique.ampliarQr')"
          @click="abrirQr"
        >
          <img
            :src="qrUrl"
            alt=""
            class="indique__qr-imagem"
            referrerpolicy="no-referrer"
            @error="qrFalhou = true"
          />
          <span class="indique__ampliar" aria-hidden="true">
            <i class="ph ph-arrows-out-simple" />
          </span>
        </button>
        <span v-else class="indique__marca" aria-hidden="true">
          <i class="ph ph-qr-code" />
        </span>

        <span class="indique__texto">
          <span class="indique__rotulo">{{ t('inicio.indique.seuCodigo') }}</span>
          <!-- O código é dado, não enfeite: algarismos de mesma largura, para ser ditado ao telefone. -->
          <bdi class="indique__codigo ui-num" dir="ltr">{{ codigo }}</bdi>
        </span>
      </div>

      <div class="indique__acoes">
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-copy"
          :label="t('inicio.indique.copiar')"
          @click="copiar"
        />
        <Button
          type="button"
          size="small"
          severity="secondary"
          text
          :icon="temQr ? 'ph ph-qr-code' : 'ph ph-link'"
          :label="t('inicio.indique.maisDoCodigo')"
          @click="abrirPainel"
        />
      </div>
    </div>
  </UiSecao>

  <!--
    O painel lateral da indicação: o QR grande para mostrar ou imprimir e, embaixo, o que só
    interessa a quem foi ver — o link, as leituras do QR e como a participação funciona.
  -->
  <Drawer
    v-model:visible="painelAberto"
    position="right"
    class="qr-painel"
    :style="{ width: 'min(100vw, 27rem)' }"
  >
    <template #header>
      <h2 class="qr-painel__titulo">
        <i class="ph ph-qr-code" aria-hidden="true" />
        {{ t('inicio.indique.janelaTitulo') }}
      </h2>
    </template>

    <div class="qr-painel__corpo">
      <figure class="qr-grande ui-folha">
        <div v-if="temQr" class="qr-grande__quadro">
          <img
            ref="imagemGrande"
            :src="qrUrl"
            :alt="t('divulgacao.shareKit.qrAlt')"
            class="qr-grande__imagem"
            referrerpolicy="no-referrer"
          />
        </div>
        <figcaption class="qr-grande__legenda">
          <strong class="qr-grande__codigo ui-num">
            <bdi dir="ltr">{{ codigo }}</bdi>
          </strong>
          <span>{{ t('inicio.indique.instrucao') }}</span>
        </figcaption>

        <div class="qr-painel__acoes">
          <Button
            v-if="temQr"
            type="button"
            icon="ph ph-download-simple"
            :label="t('inicio.indique.baixar')"
            :loading="exportando"
            @click="exportar"
          />
          <Button
            v-if="temQr"
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-printer"
            :label="t('inicio.indique.imprimir')"
            @click="imprimir(t('inicio.indique.instrucao'))"
          />
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-copy"
            :label="t('inicio.indique.copiar')"
            @click="copiar"
          />
        </div>
      </figure>

      <section v-if="link" class="qr-painel__secao" aria-labelledby="qr-painel-link">
        <h3 id="qr-painel-link" class="qr-painel__subtitulo">
          <i class="ph ph-link" aria-hidden="true" />
          {{ t('inicio.indique.link') }}
        </h3>
        <div class="qr-link ui-folha">
          <bdi class="qr-link__endereco" dir="ltr" :title="link">{{ linkLegivel }}</bdi>
          <Button
            type="button"
            size="small"
            severity="secondary"
            text
            icon="ph ph-copy"
            :label="t('divulgacao.shareKit.copyLink')"
            @click="copiarLink"
          />
        </div>
      </section>

      <IndicacaoMetricasCard
        class="qr-painel__metricas"
        :metricas="metricas"
        :loading="metricasCarregando"
        :erro="metricasErro"
        @retry="carregarMetricas"
      />

      <section class="qr-painel__secao" aria-labelledby="qr-painel-como">
        <h3 id="qr-painel-como" class="qr-painel__subtitulo">
          <i class="ph ph-info" aria-hidden="true" />
          {{ t('inicio.indique.comoFunciona') }}
        </h3>
        <p class="qr-painel__texto">{{ t('inicio.indique.descricao') }}</p>
        <p class="qr-painel__texto">{{ t('inicio.saldo.nota') }}</p>
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.indique {
  --qr-papel: var(--sobre-rail);
}

.indique__folha {
  display: grid;
  gap: 16px;
  padding: 18px;
}

.indique__linha {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

/* O QR sobre papel claro nos dois temas, com a dica de ampliar no canto. */
.indique__qr {
  position: relative;
  display: grid;
  width: 64px;
  height: 64px;
  flex: none;
  place-items: center;
  padding: 5px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--qr-papel);
  cursor: zoom-in;
  transition: border-color var(--pj-tempo-curto) ease;
}

.indique__qr:hover {
  border-color: var(--portal);
}

.indique__qr:focus-visible {
  outline: 2px solid var(--portal);
  outline-offset: 2px;
}

.indique__qr-imagem {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.indique__ampliar {
  position: absolute;
  inset-block-end: -6px;
  inset-inline-end: -6px;
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 999px;
  background: var(--portal);
  box-shadow: 0 0 0 2px var(--superficie);
  color: var(--superficie);
  font-size: 11px;
}

/* Sem a imagem do QR: o ícone no lugar dele, na cor do Portal. */
.indique__marca {
  display: grid;
  width: 64px;
  height: 64px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--portal-fundo);
  color: var(--portal-tinta);
  font-size: 30px;
}

.indique__texto {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.indique__rotulo {
  color: var(--tinta-2);
  font-size: 13px;
}

.indique__codigo {
  overflow: hidden;
  color: var(--tinta);
  font-size: 24px;
  font-weight: 650;
  letter-spacing: 0.02em;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.indique__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.indique__falha {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.indique__folha[role='alert'] {
  justify-items: start;
}

/* A altura das setas da agenda ao lado: os dois títulos ficam na mesma linha. */
.indique__divulgacao {
  min-height: 36px;
}

.indique__seta {
  font-size: 14px;
}

[dir='rtl'] .indique__seta {
  scale: -1 1;
}

/* ------------------------------------------------------------------ painel lateral
 * O conteúdo é deste componente, então o estilo com escopo chega nele mesmo teleportado. A casca do
 * painel (fundo, cabeçalho, fechar) fica no bloco sem escopo lá embaixo.
 */
.qr-painel__titulo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.qr-painel__titulo i {
  color: var(--portal-tinta);
  font-size: 22px;
}

.qr-painel__corpo {
  /*
   * As leituras do QR são o painel da tela de Divulgação, que lê as cores de lá (`--div-*`). Aqui
   * elas vêm do Trilha: o bloco vira uma folha como as outras, e o destaque, a cor do Portal.
   */
  --div-card: var(--superficie);
  --div-surface: var(--superficie-2);
  --div-line: var(--linha);
  --div-text: var(--tinta);
  --div-muted: var(--tinta-2);
  --div-faint: var(--tinta-3);
  --div-primary: var(--portal);
  --div-primary-strong: var(--portal-tinta);

  display: grid;
  gap: 20px;
}

.qr-painel__corpo .qr-painel__metricas {
  border-radius: 16px;
  box-shadow: none;
}

/* O QR grande, o código e as ações, tudo centrado. */
.qr-grande {
  display: grid;
  justify-items: center;
  gap: 16px;
  margin: 0;
  padding: 22px 18px;
  text-align: center;
}

.qr-grande__quadro {
  display: grid;
  place-items: center;
  padding: 14px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--sobre-rail);
}

.qr-grande__imagem {
  display: block;
  width: 13rem;
  height: 13rem;
  max-width: 100%;
  object-fit: contain;
}

.qr-grande__legenda {
  display: grid;
  gap: 6px;
  max-width: 19rem;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.45;
}

.qr-grande__codigo {
  color: var(--tinta);
  font-size: 26px;
  font-weight: 650;
  letter-spacing: 0.02em;
}

.qr-painel__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.qr-painel__secao {
  display: grid;
  gap: 10px;
}

.qr-painel__subtitulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.qr-painel__subtitulo i {
  color: var(--tinta-2);
  font-size: 18px;
}

.qr-link {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  padding: 8px 8px 8px 14px;
}

.qr-link__endereco {
  flex: 1 1 8rem;
  min-width: 0;
  overflow: hidden;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qr-painel__texto {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.55;
}

@media (prefers-reduced-motion: reduce) {
  .indique__qr {
    transition: none;
  }
}
</style>

<style>
/*
 * A casca do painel lateral da indicação. O PrimeVue a teleporta para o `body`, fora do alcance do
 * estilo com escopo: por isso mora aqui, presa à classe própria do painel. Os tokens do Trilha
 * valem no `body` (a raiz leva `.trilha`), então os dois temas seguem sozinhos.
 */
.qr-painel.p-drawer {
  border: 0;
  border-inline-start: 1px solid var(--linha);
  background: var(--fundo);
  box-shadow: var(--sombra-3);
  color: var(--tinta);
  font-family: var(--font-texto);
}

.qr-painel .p-drawer-header {
  padding: 20px 20px 12px;
}

.qr-painel .p-drawer-close-button {
  width: 36px;
  height: 36px;
  border: 1px solid var(--linha);
  border-radius: 10px;
  background: var(--superficie);
  color: var(--tinta-2);
}

.qr-painel .p-drawer-close-button:hover {
  background: var(--superficie-2);
  color: var(--tinta);
}

.qr-painel .p-drawer-close-button:focus-visible {
  outline: 2px solid var(--portal);
  outline-offset: 2px;
  box-shadow: none;
}

.qr-painel .p-drawer-content {
  padding: 4px 20px 28px;
}
</style>
