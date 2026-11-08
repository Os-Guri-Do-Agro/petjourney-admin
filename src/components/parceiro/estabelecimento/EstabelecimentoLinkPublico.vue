<script setup lang="ts">
/**
 * "Sua página pública": o link e o QR que apontam para a página no site (E1-01, PJ-KE667M).
 *
 * Aparece só com a página no ar: um link que não abre não serve para o balcão. O QR vem da API, que
 * o pede ao WFQR (o serviço de QR da casa): sage, arredondado, com a pata no centro, igual a todo QR
 * da PetJourney, e o WFQR conta as leituras e leva o QR já impresso para o endereço novo. Na tela ele
 * é uma miniatura que amplia: o clique (ou "Baixar ou imprimir") abre a gaveta com o QR grande, o
 * PNG, o SVG para a gráfica e a folha para imprimir.
 *
 * Com o WFQR fora (a API devolve `qrImageUrl` nulo, a chamada falha ou a imagem não carrega), a
 * miniatura cai no QR desenhado aqui no navegador (`qr-da-pagina.ts`). É só a reserva: sai fora do
 * padrão, mas a tela nunca fica em branco.
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { obterQrDaPagina } from '@/service/parceiro/estabelecimento-service'
import type { LinkDaPaginaPublica } from '@/utils/parceiro/pagina-publica'

import EstabelecimentoQrGaveta from './EstabelecimentoQrGaveta.vue'
import { imagemDoQr, TAMANHO_DO_QR, urlDoQr } from './qr-da-pagina'

const props = defineProps<{
  links: LinkDaPaginaPublica[]
  slug: string
  nome: string
  /** O mesmo `parceiroId` das outras rotas do estabelecimento (quem tem mais de um parceiro). */
  parceiroId?: string | null
}>()

const { t } = useI18n()
const toast = useToast()

/**
 * A imagem do WFQR de cada página, pelo `tipo` do link. `null` é "sem imagem do WFQR": a chamada
 * falhou (429 incluso) ou o WFQR está fora. Sem entrada ainda, a resposta não chegou.
 */
const qrDaApi = reactive<Record<string, string | null>>({})
/** Páginas cuja imagem do WFQR não carregou no navegador. */
const imagemFalhou = reactive<Record<string, boolean>>({})
/** A reserva desenhada no navegador, pelo endereço da página. */
const qrLocal = reactive<Record<string, string>>({})

/** Resposta velha (de antes da troca de endereço) não passa por cima da nova. */
let rodada = 0

function imagemDoWfqr(link: LinkDaPaginaPublica) {
  const base = qrDaApi[link.tipo]

  return base && !imagemFalhou[link.tipo] ? base : null
}

/**
 * Uma chamada por página ao abrir a aba e outra quando o endereço muda (o `url` novo vem da API; o
 * código e a imagem continuam os mesmos). Nunca em laço: a API corta com 429 depois de 300 por hora.
 */
watch(
  () => [props.parceiroId, ...props.links.map((link) => `${link.tipo}|${link.url}`)],
  async () => {
    const minha = ++rodada

    await Promise.all(
      props.links.map(async (link) => {
        let imagem: string | null = null

        try {
          const qr = await obterQrDaPagina(link.tipo === 'hotel' ? 'HOTEL' : 'CLINICA', {
            parceiroId: props.parceiroId,
          })

          imagem = qr.qrImageUrl ?? null
        } catch {
          imagem = null
        }

        if (minha !== rodada) return

        qrDaApi[link.tipo] = imagem
        imagemFalhou[link.tipo] = false
      }),
    )
  },
  { immediate: true },
)

/* Só desenha a reserva de quem não tem a imagem do WFQR (e já sabe que não tem). */
watch(
  () => [props.links, qrDaApi, imagemFalhou] as const,
  async () => {
    for (const link of props.links) {
      if (link.tipo in qrDaApi && !imagemDoWfqr(link) && !qrLocal[link.url]) {
        qrLocal[link.url] = await imagemDoQr(link.url, 280)
      }
    }
  },
  { immediate: true, deep: true },
)

/** O endereço sem o `https://`: é como a pessoa o escreve e o lê. */
function semProtocolo(url: string) {
  return url.replace(/^https?:\/\//, '')
}

async function copiar(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast.add({
      severity: 'success',
      summary: t('parceiro.estabelecimento.link.copiado'),
      life: 2500,
    })
  } catch {
    toast.add({
      severity: 'warn',
      summary: t('parceiro.estabelecimento.link.erroCopiar'),
      detail: url,
      life: 6000,
    })
  }
}

const linkAberto = ref<LinkDaPaginaPublica | null>(null)
const gavetaAberta = ref(false)

function abrir(link: LinkDaPaginaPublica) {
  linkAberto.value = link
  gavetaAberta.value = true
}
</script>

<template>
  <ul class="links" :aria-label="t('parceiro.estabelecimento.link.titulo')">
    <li v-for="link in links" :key="link.url" class="link">
      <!-- A miniatura amplia: o selinho no canto e o cursor de lupa dizem que ela abre. -->
      <Button
        unstyled
        type="button"
        class="link__qr"
        :aria-label="t('parceiro.estabelecimento.qr.ampliar')"
        :title="t('parceiro.estabelecimento.qr.ampliar')"
        @click="abrir(link)"
      >
        <img
          v-if="imagemDoWfqr(link)"
          class="link__imagem"
          :src="urlDoQr(imagemDoWfqr(link)!, { size: TAMANHO_DO_QR.miniatura })"
          :alt="t('parceiro.estabelecimento.link.qrAlt', { endereco: semProtocolo(link.url) })"
          width="112"
          height="112"
          @error="imagemFalhou[link.tipo] = true"
        />
        <img
          v-else-if="qrLocal[link.url]"
          class="link__imagem"
          :src="qrLocal[link.url]"
          :alt="t('parceiro.estabelecimento.link.qrAlt', { endereco: semProtocolo(link.url) })"
          width="112"
          height="112"
        />
        <span v-else class="link__imagem link__imagem--vazia" aria-hidden="true" />
        <span class="link__ampliar" aria-hidden="true"><i class="ph ph-arrows-out-simple" /></span>
      </Button>

      <div class="link__texto">
        <span class="link__rotulo">{{ t(`parceiro.estabelecimento.link.${link.tipo}`) }}</span>
        <a class="link__endereco" :href="link.url" target="_blank" rel="noopener" dir="ltr">
          {{ semProtocolo(link.url) }}
          <i class="ph ph-arrow-square-out" aria-hidden="true" />
        </a>
        <div class="link__acoes">
          <Button
            icon="ph ph-copy"
            :label="t('parceiro.estabelecimento.link.copiar')"
            severity="secondary"
            outlined
            size="small"
            @click="copiar(link.url)"
          />
          <Button
            icon="ph ph-qr-code"
            :label="t('parceiro.estabelecimento.qr.abrir')"
            severity="secondary"
            outlined
            size="small"
            @click="abrir(link)"
          />
        </div>
      </div>
    </li>
  </ul>

  <EstabelecimentoQrGaveta
    v-model:visible="gavetaAberta"
    :link="linkAberto"
    :slug
    :nome
    :qr-image-url="linkAberto ? imagemDoWfqr(linkAberto) : null"
  />
</template>

<style scoped>
.links {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.link {
  display: flex;
  align-items: center;
  gap: 18px;
}

/* O QR em papel branco, com a borda fina para não se perder no véu da seção. */
.link__qr {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  padding: 6px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: #fff;
  cursor: zoom-in;
  transition: border-color var(--pj-tempo-curto, 150ms) ease-out;
}

.link__qr:hover {
  border-color: var(--app-salvia, var(--musgo));
}

.link__qr:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.link__imagem {
  display: block;
  width: 112px;
  height: 112px;
}

.link__imagem--vazia {
  border-radius: 8px;
  background: var(--superficie-2);
}

/* O selinho de ampliar, sólido: em véu translúcido ele sumia em cima do papel branco no escuro. */
.link__ampliar {
  position: absolute;
  inset-block-end: -7px;
  inset-inline-end: -7px;
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 999px;
  background: var(--superficie-3);
  box-shadow: 0 0 0 3px var(--superficie-2);
  color: var(--tinta-2);
  font-size: 14px;
}

.link__texto {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.link__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 650;
}

.link__endereco {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow-wrap: anywhere;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: var(--linha-media);
  text-underline-offset: 3px;
}

.link__endereco:hover {
  text-decoration-color: currentColor;
}

.link__endereco:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
  border-radius: 4px;
}

.link__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}
</style>
