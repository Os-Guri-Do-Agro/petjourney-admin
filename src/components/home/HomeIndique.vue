<script setup lang="ts">
/**
 * Indique e ganhe: o QR e o código de indicação, dentro do cartão de ganhos.
 *
 * Mora no rodapé do cartão de ganhos, no slot `indicacao` de `HomeSaldo`: o dinheiro em cima e,
 * embaixo, o que o gera, sem um cartão só para isso. É uma faixa clara no mesmo feitio da faixa de
 * "pronto para sacar" logo acima: o QR pequeno e clicável, o rótulo, o código e a pílula de copiar.
 *
 * ## O QR
 *
 * Branco puro, porque leitor de QR precisa de zona quieta. Clicado, abre um painel lateral com tudo
 * o que a indicação tem: o QR grande para mostrar ou imprimir, o código e o link para copiar, as
 * leituras do QR nos últimos dias e como a participação funciona. A pílula "Compartilhar código" do
 * cabeçalho abre o mesmo painel (`abrirQr`).
 *
 * O painel segue o acabamento da visão geral: fundo claro com o brilho de sálvia no topo, cantos
 * arredondados do lado de dentro da tela e o conteúdo em cartões brancos como os da página — o QR,
 * o link, as leituras e como funciona. Teleportado para o `body`, ele leva `.hc-tema` para ter as
 * mesmas variáveis da página.
 *
 * A dica de "ampliar" é irmã do botão, não filha: o botão do PrimeVue recorta o que passa da borda
 * (`overflow: hidden`), e a dica fica metade para fora, no canto.
 *
 * Sem código (programa não ativo) nada aparece: o cartão de ganhos já diz em que pé está o programa.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Skeleton from 'primevue/skeleton'
import {
  PhArrowsOutSimple,
  PhCopy,
  PhDownloadSimple,
  PhInfo,
  PhLink,
  PhPrinter,
  PhQrCode,
} from '@phosphor-icons/vue'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import IndicacaoMetricasCard from '@/components/parceiro/IndicacaoMetricasCard.vue'
import { useExportarQr } from '@/composables/useExportarQr'
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
const qrAberto = ref(false)
/** A URL do QR pode existir e a imagem não carregar (serviço de imagem fora): aí o quadro some. */
const qrFalhou = ref(false)
const imagemGrande = ref<HTMLImageElement | null>(null)

const codigo = computed(() => indicacao.value?.codigoIndicacao ?? '')
const link = computed(() => indicacao.value?.link ?? '')
/** O link como se lê: sem o protocolo, para caber numa linha. A cópia leva o endereço inteiro. */
const linkLegivel = computed(() => link.value.replace(/^https?:\/\//, ''))
const qrUrl = computed(() => indicacao.value?.qrImageUrl ?? '')
const podeIndicar = computed(() => Boolean(indicacao.value?.podeIndicar))

/** Há QR para mostrar — é o que decide se o quadro e a pílula do cabeçalho existem. */
const temQr = computed(() => podeIndicar.value && Boolean(qrUrl.value) && !qrFalhou.value)

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

function abrirQr() {
  if (temQr.value) {
    qrAberto.value = true
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

/* As leituras só são pedidas quando o painel abre: é informação de quem foi ver, não da página. */
watch(qrAberto, (aberto) => {
  if (aberto && !metricas.value && !metricasCarregando.value) {
    void carregarMetricas()
  }
})

onMounted(() => {
  void carregar()
})

defineExpose({ abrirQr, temQr })
</script>

<template>
  <div class="indicacao">
    <!--
      `contents`: sem faixa (programa não ativo), o componente não ocupa lugar na grade do cartão. O
      comentário mora dentro da raiz: acima dela, o componente viraria fragmento.
    -->
    <div
      v-if="carregando"
      class="faixa"
      role="status"
      aria-busy="true"
      :aria-label="t('inicio.indique.carregando')"
    >
      <Skeleton width="3.5rem" height="3.5rem" border-radius="0.6rem" />
      <span class="faixa__texto">
        <Skeleton width="10rem" height="0.8rem" border-radius="6px" />
        <Skeleton width="6rem" height="1.1rem" border-radius="6px" />
      </span>
    </div>

    <div v-else-if="falhou" class="faixa" role="alert">
      <p class="faixa__falha">{{ t('inicio.indique.falhou') }}</p>
      <Button
        type="button"
        class="faixa__pilula"
        :label="t('inicio.saldo.tentar')"
        rounded
        size="small"
        @click="carregar"
      />
    </div>

    <!-- Gate: sem cadastro aprovado ou sem Programa de Afiliados ativo não há código nem QR. -->
    <section v-else-if="podeIndicar" class="faixa" :aria-label="t('inicio.indique.titulo')">
      <span v-if="temQr" class="faixa__quadro">
        <Button
          type="button"
          class="faixa__qr"
          :aria-label="t('inicio.indique.ampliarQr')"
          :title="t('inicio.indique.ampliarQr')"
          @click="abrirQr"
        >
          <img
            :src="qrUrl"
            alt=""
            class="faixa__qr-imagem"
            referrerpolicy="no-referrer"
            @error="qrFalhou = true"
          />
        </Button>
        <span class="faixa__dica" aria-hidden="true">
          <PhArrowsOutSimple weight="bold" />
        </span>
      </span>

      <span class="faixa__texto">
        <span class="faixa__rotulo">{{ t('inicio.indique.seuCodigo') }}</span>
        <!-- O código é dado, não enfeite: tabular e espaçado para ser ditado ao telefone. -->
        <bdi class="faixa__codigo" dir="ltr">{{ codigo }}</bdi>
      </span>

      <Button
        type="button"
        class="faixa__pilula"
        rounded
        size="small"
        :label="t('inicio.indique.copiar')"
        @click="copiar"
      >
        <template #icon>
          <PhCopy class="faixa__pilula-icone" weight="bold" aria-hidden="true" />
        </template>
      </Button>
    </section>

    <!--
      O painel lateral da indicação: o QR grande para mostrar ou imprimir e, embaixo, o que só
      interessa a quem foi ver — o link, as leituras do QR e como a participação funciona.
    -->
    <Drawer
      v-model:visible="qrAberto"
      position="right"
      class="qr-painel hc-tema"
      :style="{ width: 'min(100vw, 27rem)' }"
    >
      <template #header>
        <h2 class="qr-painel__titulo">
          <PhQrCode class="hc__icone" weight="duotone" aria-hidden="true" />
          {{ t('inicio.indique.janelaTitulo') }}
        </h2>
      </template>

      <div class="qr-painel__corpo">
        <figure class="hc qr-grande">
          <div class="qr-grande__quadro">
            <img
              ref="imagemGrande"
              :src="qrUrl"
              :alt="t('divulgacao.shareKit.qrAlt')"
              class="qr-grande__imagem"
              referrerpolicy="no-referrer"
            />
          </div>
          <figcaption class="qr-grande__legenda">
            <strong class="qr-grande__codigo">
              <bdi dir="ltr">{{ codigo }}</bdi>
            </strong>
            <span>{{ t('inicio.indique.instrucao') }}</span>
          </figcaption>

          <div class="qr-painel__acoes">
            <Button
              type="button"
              class="qr-pilula qr-pilula--cheia"
              rounded
              :label="t('inicio.indique.baixar')"
              :loading="exportando"
              @click="exportar"
            >
              <template #icon>
                <PhDownloadSimple class="qr-pilula__icone" weight="bold" aria-hidden="true" />
              </template>
            </Button>
            <Button
              type="button"
              class="qr-pilula"
              rounded
              :label="t('inicio.indique.imprimir')"
              @click="imprimir(t('inicio.indique.instrucao'))"
            >
              <template #icon>
                <PhPrinter class="qr-pilula__icone" weight="duotone" aria-hidden="true" />
              </template>
            </Button>
            <Button
              type="button"
              class="qr-pilula"
              rounded
              :label="t('inicio.indique.copiar')"
              @click="copiar"
            >
              <template #icon>
                <PhCopy class="qr-pilula__icone" weight="duotone" aria-hidden="true" />
              </template>
            </Button>
          </div>
        </figure>

        <section v-if="link" class="hc" aria-labelledby="qr-painel-link">
          <h3 id="qr-painel-link" class="hc__titulo">
            <PhLink class="hc__icone" weight="duotone" aria-hidden="true" />
            {{ t('inicio.indique.link') }}
          </h3>
          <div class="qr-link">
            <bdi class="qr-link__endereco" dir="ltr" :title="link">{{ linkLegivel }}</bdi>
            <Button
              type="button"
              class="qr-pilula"
              rounded
              size="small"
              :label="t('divulgacao.shareKit.copyLink')"
              @click="copiarLink"
            >
              <template #icon>
                <PhCopy class="qr-pilula__icone" weight="duotone" aria-hidden="true" />
              </template>
            </Button>
          </div>
        </section>

        <IndicacaoMetricasCard
          class="qr-painel__metricas"
          :metricas="metricas"
          :loading="metricasCarregando"
          :erro="metricasErro"
          @retry="carregarMetricas"
        />

        <section class="hc" aria-labelledby="qr-painel-como">
          <h3 id="qr-painel-como" class="hc__titulo">
            <PhInfo class="hc__icone" weight="duotone" aria-hidden="true" />
            {{ t('inicio.indique.comoFunciona') }}
          </h3>
          <p class="qr-painel__texto">{{ t('inicio.indique.descricao') }}</p>
          <p class="qr-painel__texto">{{ t('inicio.saldo.nota') }}</p>
        </section>
      </div>
    </Drawer>
  </div>
</template>

<style scoped>
.indicacao {
  display: contents;
}

/* A faixa do rodapé, no feitio da faixa de "pronto para sacar": fundo claro, raio igual. */
.faixa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 0.9rem;
  padding: 0.65rem 0.75rem 0.65rem 0.65rem;
  border-radius: 0.8rem;
  background: var(--hc-fundo);
}

.faixa__quadro {
  position: relative;
  flex-shrink: 0;
}

/* Branco puro por exigência do leitor (zona quieta); o contorno fino o separa da faixa. */
.faixa__qr.p-button {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  padding: 0.25rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.6rem;
  background: #ffffff;
  transition: border-color 150ms ease-out;
}

.faixa__qr.p-button:not(:disabled):hover {
  border-color: var(--hc-marca);
  background: #ffffff;
}

.faixa__qr.p-button:focus-visible,
.faixa__pilula.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: 2px;
  box-shadow: none;
}

.faixa__qr-imagem {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* A dica de ampliar, metade para fora no canto: irmã do botão para não ser recortada por ele. */
.faixa__dica {
  position: absolute;
  inset-block-end: -0.3rem;
  inset-inline-end: -0.3rem;
  display: grid;
  place-items: center;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 999px;
  background: var(--hc-degrade-botao);
  box-shadow: 0 0 0 2px var(--hc-fundo);
  color: var(--hc-sobre-marca);
  font-size: 0.625rem;
  pointer-events: none;
}

.faixa__texto {
  display: grid;
  flex: 1 1 8rem;
  gap: 0.2rem;
  min-width: 0;
}

.faixa__rotulo {
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-weight: 500;
}

.faixa__codigo {
  color: var(--hc-tinta);
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
}

.faixa__falha {
  flex: 1 1 12rem;
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

/* A pílula clara de borda fina: a mesma do "Ver extrato" em forma de botão. */
.faixa__pilula.p-button {
  gap: 0.4rem;
  min-height: 2.1rem;
  padding: 0 0.95rem;
  border: 1px solid var(--hc-borda);
  background: var(--hc-cartao);
  color: var(--hc-tinta);
  font-size: 0.8125rem;
  font-weight: 600;
  transition: background-color 150ms ease-out;
}

.faixa__pilula.p-button:not(:disabled):hover {
  border-color: var(--hc-borda);
  background: var(--hc-linha);
  color: var(--hc-tinta);
}

.faixa__pilula-icone {
  width: 0.85rem;
  height: 0.85rem;
  color: var(--hc-marca);
}

@media (prefers-reduced-motion: reduce) {
  .faixa__qr.p-button,
  .faixa__pilula.p-button {
    transition: none;
  }
}

/* ------------------------------------------------------------------ painel lateral
 * O conteúdo é deste componente, então o estilo com escopo chega nele mesmo teleportado. A casca
 * do painel (fundo, cantos, cabeçalho) fica no bloco sem escopo lá embaixo.
 */
.qr-painel__titulo {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1.0625rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.qr-painel__corpo {
  /*
   * As leituras do QR são o painel da tela de Divulgação, que lê as cores de lá (`--div-*`). Aqui
   * elas vêm da home: o bloco vira um cartão branco como os outros, e os degraus dele, o cinza claro.
   */
  --div-card: var(--hc-cartao);
  --div-surface: var(--hc-fundo);
  --div-line: var(--hc-borda);
  --div-text: var(--hc-tinta);
  --div-muted: var(--hc-tinta-2);
  --div-faint: var(--hc-tinta-3);
  --div-primary: var(--hc-marca);
  --div-primary-strong: var(--hc-marca-forte);

  display: grid;
  gap: 0.9rem;
}

.qr-painel__corpo .qr-painel__metricas {
  border-radius: 1rem;
  box-shadow: var(--hc-sombra);
}

/* O cartão do QR: o quadro branco, o código grande, a instrução e as ações, tudo centrado. */
.qr-grande {
  justify-items: center;
  gap: 0.9rem;
  margin: 0;
  padding-block: 1.4rem;
  text-align: center;
}

.qr-grande__quadro {
  display: grid;
  place-items: center;
  padding: 0.85rem;
  border: 1px solid var(--hc-borda);
  border-radius: 1.1rem;
  background: #ffffff;
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
  gap: 0.35rem;
  max-width: 19rem;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  line-height: 1.45;
}

.qr-grande__codigo {
  color: var(--hc-tinta);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
}

.qr-painel__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}

/* As pílulas da página: branca de borda fina e, a principal, cheia em degradê. */
.qr-pilula.p-button {
  --qr-pilula-sombra: 0 1px 2px rgb(20 32 28 / 5%);

  gap: 0.4rem;
  min-height: 2.25rem;
  padding: 0 1rem;
  border: 1px solid var(--hc-borda);
  background: var(--hc-cartao);
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: var(--qr-pilula-sombra);
  transition:
    background-color 150ms ease-out,
    border-color 150ms ease-out,
    box-shadow 150ms ease-out;
}

.qr-pilula.p-button:not(:disabled):hover {
  border-color: var(--hc-marca);
  background: var(--hc-cartao);
  color: var(--hc-tinta);
}

.qr-pilula.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: 2px;
  box-shadow: var(--qr-pilula-sombra);
}

.qr-pilula--cheia.p-button,
.qr-pilula--cheia.p-button:not(:disabled):hover {
  border-color: transparent;
  background: var(--hc-degrade-botao);
  color: var(--hc-sobre-marca);
}

.qr-pilula--cheia.p-button {
  --qr-pilula-sombra: 0 6px 16px -8px var(--hc-marca-sombra);
}

.qr-pilula--cheia.p-button:not(:disabled):hover {
  --qr-pilula-sombra: 0 10px 22px -8px var(--hc-marca-sombra-forte);
}

.qr-pilula__icone {
  width: 1rem;
  height: 1rem;
  color: var(--hc-marca);
}

.qr-pilula--cheia .qr-pilula__icone {
  color: currentColor;
}

.qr-pilula.p-button-sm {
  min-height: 2rem;
  padding: 0 0.85rem;
  font-size: 0.8125rem;
}

/* O link numa faixa clara, como a do código no cartão de ganhos. */
.qr-link {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.75rem;
  padding: 0.6rem 0.6rem 0.6rem 0.85rem;
  border-radius: 0.8rem;
  background: var(--hc-fundo);
}

.qr-link__endereco {
  flex: 1 1 8rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--hc-tinta);
  font-size: 0.8125rem;
  font-weight: 500;
}

.qr-painel__texto {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  line-height: 1.55;
}

.qr-painel__texto + .qr-painel__texto {
  margin-block-start: -0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .qr-pilula.p-button {
    transition: none;
  }
}
</style>

<style>
/*
 * A casca do painel lateral da indicação. O PrimeVue a teleporta para o `body`, fora do alcance do
 * estilo com escopo: por isso mora aqui, presa à classe própria do painel. A largura vai na prop
 * `style` do painel, que vence a regra do tema para o lado direito.
 *
 * Os cantos arredondados são só os de dentro da tela (o lado de início, à esquerda; no árabe o
 * painel abre do outro lado e os cantos acompanham): os outros encostam na borda da janela. O fundo é o da visão geral, com o brilho de sálvia no topo.
 */
.qr-painel.p-drawer {
  overflow: hidden;
  border: 0;
  border-start-start-radius: 1.25rem;
  border-end-start-radius: 1.25rem;
  background:
    radial-gradient(34rem 16rem at 100% -4rem, rgb(120 196 178 / 26%), transparent 70%),
    var(--hc-fundo);
  box-shadow: -24px 0 60px -28px rgb(20 32 28 / 40%);
  color: var(--hc-tinta);
}

.app-dark .qr-painel.p-drawer {
  background:
    radial-gradient(34rem 16rem at 100% -4rem, rgb(108 201 181 / 12%), transparent 70%),
    var(--hc-fundo);
  box-shadow: -24px 0 60px -28px rgb(0 0 0 / 70%);
}

.qr-painel .p-drawer-header {
  padding: 1.15rem 1.25rem 0.6rem;
}

/* O fechar como as setas do carrossel: redondo, branco, borda fina. */
.qr-painel .p-drawer-close-button {
  width: 2.1rem;
  height: 2.1rem;
  border: 1px solid var(--hc-borda);
  background: var(--hc-cartao);
  color: var(--hc-tinta-2);
}

.qr-painel .p-drawer-close-button:hover {
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
  color: var(--hc-tinta);
}

.qr-painel .p-drawer-close-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: 2px;
  box-shadow: none;
}

.qr-painel .p-drawer-content {
  padding: 0.5rem 1.25rem 1.5rem;
  /* Rola sem barra à vista, como a página que abre o painel. */
  scrollbar-width: none;
}

.qr-painel .p-drawer-content::-webkit-scrollbar {
  display: none;
}
</style>
