<script setup lang="ts">
/**
 * O QR da página pública em tamanho grande, numa gaveta: para mostrar a alguém na tela, e com as
 * três formas de levar para fora (PNG, SVG e a folha para imprimir) e o link.
 *
 * Abre pelo QR pequeno da aba Página pública ou pelo botão "Baixar ou imprimir" ao lado dele.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { isRTLLocale, type Locale } from '@/i18n/locales'
import type { LinkDaPaginaPublica } from '@/utils/parceiro/pagina-publica'

import EstabelecimentoFolhaDoBalcao from './EstabelecimentoFolhaDoBalcao.vue'
import { baixar, imagemDoQr, nomeDoArquivo, svgDoQr } from './qr-da-pagina'
import './gaveta.css'

const props = defineProps<{
  link: LinkDaPaginaPublica | null
  slug: string
  /** O nome público da casa: vai no alto da folha impressa. */
  nome: string
}>()

const visible = defineModel<boolean>('visible', { default: false })

const LARGURA = '27rem'

const { t, locale } = useI18n()
const toast = useToast()
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

const drawerPosition = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))

/** 1024 px: a mesma imagem serve para a tela grande, o PNG e a folha, sem borrar. */
const imagem = ref('')

watch(
  () => [visible.value, props.link?.url] as const,
  async ([aberta, url]) => {
    if (aberta && url) imagem.value = await imagemDoQr(url, 1024, 2)
  },
  { immediate: true },
)

const endereco = computed(() => props.link?.url.replace(/^https?:\/\//, '') ?? '')
const instrucao = computed(() =>
  props.link ? t(`parceiro.estabelecimento.qr.instrucao.${props.link.tipo}`) : '',
)

function baixarPng() {
  if (props.link && imagem.value) baixar(imagem.value, nomeDoArquivo(props.slug, props.link, 'png'))
}

async function baixarSvg() {
  if (!props.link) return

  const svg = await svgDoQr(props.link.url)

  baixar(new Blob([svg], { type: 'image/svg+xml' }), nomeDoArquivo(props.slug, props.link, 'svg'))
}

/* ------------------------------------------------------------------- a folha do balcão */

const imprimindo = ref(false)

/** Espera as imagens da folha (o QR, a pata, o nome PetJourney): sem isso a página sai sem elas. */
async function imagensProntas() {
  await nextTick()

  const imagens = [...document.querySelectorAll<HTMLImageElement>('.fb img')]

  await Promise.all(
    imagens.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
  )
}

/**
 * Imprime a própria página com só a folha à mostra. A margem zero do `@page` entra só agora (e sai
 * depois): sem margem, o navegador não põe data, título e "about:blank" no papel, e as outras
 * impressões do portal seguem com a margem delas. O título da aba vira o nome do PDF salvo.
 */
async function imprimir() {
  if (!imagem.value || !props.link || imprimindo.value) return

  imprimindo.value = true
  await imagensProntas()

  const pagina = document.createElement('style')
  pagina.textContent = '@page { size: A4 portrait; margin: 0; }'
  document.head.append(pagina)

  const tituloAntes = document.title
  document.title = `${props.nome} - QR`
  document.documentElement.classList.add('imprimindo-folha')

  window.addEventListener(
    'afterprint',
    () => {
      document.documentElement.classList.remove('imprimindo-folha')
      document.title = tituloAntes
      pagina.remove()
      imprimindo.value = false
    },
    { once: true },
  )

  window.print()
}

async function copiar() {
  if (!props.link) return

  try {
    await navigator.clipboard.writeText(props.link.url)
    toast.add({
      severity: 'success',
      summary: t('parceiro.estabelecimento.link.copiado'),
      life: 2500,
    })
  } catch {
    toast.add({
      severity: 'warn',
      summary: t('parceiro.estabelecimento.link.erroCopiar'),
      detail: props.link.url,
      life: 6000,
    })
  }
}

const OPCOES = [
  { id: 'png', icone: 'ph ph-image', acao: baixarPng },
  { id: 'svg', icone: 'ph ph-bezier-curve', acao: baixarSvg },
  { id: 'imprimir', icone: 'ph ph-printer', acao: imprimir },
] as const
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="drawerPosition"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="estabelecimento-gaveta"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
  >
    <template #header>
      <h2 class="eg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i class="ph ph-qr-code" />
        </span>
        {{ t('parceiro.estabelecimento.qr.titulo') }}
      </h2>
    </template>

    <div v-if="link" class="eg">
      <!-- O QR grande, para alguém apontar a câmera direto na tela. -->
      <figure class="qr">
        <span class="qr__papel">
          <img
            v-if="imagem"
            :src="imagem"
            :alt="t('parceiro.estabelecimento.link.qrAlt', { endereco })"
            class="qr__imagem"
          />
          <span v-else class="qr__imagem qr__imagem--vazio" aria-hidden="true" />
        </span>
        <figcaption class="qr__legenda">
          <strong>{{ nome }}</strong>
          <span>{{ instrucao }}</span>
          <a class="qr__endereco" :href="link.url" target="_blank" rel="noopener" dir="ltr">
            {{ endereco }}
            <i class="ph ph-arrow-square-out" aria-hidden="true" />
          </a>
        </figcaption>
        <Button
          icon="ph ph-copy"
          :label="t('parceiro.estabelecimento.link.copiar')"
          severity="secondary"
          outlined
          size="small"
          @click="copiar"
        />
      </figure>

      <div class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('parceiro.estabelecimento.qr.levar') }}</h3>

        <ul class="opcoes">
          <li v-for="opcao in OPCOES" :key="opcao.id">
            <Button
              type="button"
              severity="secondary"
              outlined
              class="opcao"
              :disabled="!imagem"
              @click="opcao.acao"
            >
              <span class="ui-ladrilho opcao__icone" aria-hidden="true">
                <i :class="opcao.icone" />
              </span>
              <span class="opcao__texto">
                <strong>{{ t(`parceiro.estabelecimento.qr.${opcao.id}.titulo`) }}</strong>
                <small>{{ t(`parceiro.estabelecimento.qr.${opcao.id}.dica`) }}</small>
              </span>
              <i
                :class="opcao.id === 'imprimir' ? 'ph ph-printer' : 'ph ph-download-simple'"
                class="opcao__seta"
                aria-hidden="true"
              />
            </Button>
          </li>
        </ul>
      </div>
    </div>
  </Drawer>

  <!-- Só existe durante a impressão: escondida, ela fica fora da tela e do leitor de tela. -->
  <EstabelecimentoFolhaDoBalcao
    v-if="imprimindo && link && imagem"
    :nome
    :tipo="link.tipo"
    :endereco
    :imagem
  />
</template>

<style scoped>
.qr {
  display: grid;
  justify-items: center;
  gap: 14px;
  margin: 0;
  text-align: center;
}

/* Papel branco nos dois temas: o QR escuro sobre fundo claro é o que a câmera lê. */
.qr__papel {
  display: grid;
  place-items: center;
  padding: 12px;
  border: 1px solid var(--linha);
  border-radius: 18px;
  background: #fff;
}

.qr__imagem {
  display: block;
  width: min(16rem, 62vw);
  height: min(16rem, 62vw);
}

.qr__imagem--vazio {
  border-radius: 10px;
  background: var(--superficie-2);
}

.qr__legenda {
  display: grid;
  gap: 4px;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.45;
}

.qr__legenda strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
}

.qr__endereco {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  overflow-wrap: anywhere;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: var(--linha-media);
  text-underline-offset: 3px;
}

.qr__endereco:hover {
  text-decoration-color: currentColor;
}

.opcoes {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Cada forma de levar o QR numa linha que é um botão inteiro: o ícone, o que é e para quê. */
.opcao.p-button {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 14px;
  text-align: start;
}

.opcao__icone {
  flex: none;
}

.opcao__texto {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.opcao__texto strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.opcao__texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 400;
  line-height: 1.4;
}

.opcao__seta {
  flex: none;
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 18px;
}
</style>
