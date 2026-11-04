<script setup lang="ts">
/**
 * "Sua página pública": o link e o QR que apontam para a página no site (E1-01, PJ-KE667M).
 *
 * Aparece só com a página no ar: um link que não abre não serve para o balcão. O QR é gerado aqui
 * mesmo, no navegador (o endereço não passa por serviço de terceiro), pequeno na tela e grande no
 * arquivo que se baixa para imprimir.
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import QRCode from 'qrcode'
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LinkDaPaginaPublica } from '@/utils/parceiro/pagina-publica'

const props = defineProps<{ links: LinkDaPaginaPublica[]; slug: string }>()

const { t } = useI18n()
const toast = useToast()

/* Tinta da casa sobre papel branco: o QR precisa de fundo claro nos dois temas para ler. */
const CORES = { dark: '#10302A', light: '#FFFFFF' }

const qrDaTela = reactive<Record<string, string>>({})

watch(
  () => props.links.map((link) => link.url),
  async (urls) => {
    for (const url of urls) {
      if (!qrDaTela[url]) {
        qrDaTela[url] = await QRCode.toDataURL(url, { margin: 1, width: 240, color: CORES })
      }
    }
  },
  { immediate: true },
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

/** O arquivo para imprimir: 1024 px, para o QR do balcão não sair borrado. */
async function baixarQr(link: LinkDaPaginaPublica) {
  const imagem = await QRCode.toDataURL(link.url, { margin: 2, width: 1024, color: CORES })
  const ancora = document.createElement('a')
  ancora.href = imagem
  ancora.download = `petjourney-${props.slug}-${link.tipo}.png`
  ancora.click()
}
</script>

<template>
  <ul class="links" :aria-label="t('parceiro.estabelecimento.link.titulo')">
    <li v-for="link in links" :key="link.url" class="link">
      <img
        v-if="qrDaTela[link.url]"
        class="link__qr"
        :src="qrDaTela[link.url]"
        :alt="t('parceiro.estabelecimento.link.qrAlt', { endereco: semProtocolo(link.url) })"
        width="88"
        height="88"
      />
      <span v-else class="link__qr link__qr--vazio" aria-hidden="true" />

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
            icon="ph ph-download-simple"
            :label="t('parceiro.estabelecimento.link.baixarQr')"
            severity="secondary"
            outlined
            size="small"
            @click="baixarQr(link)"
          />
        </div>
      </div>
    </li>
  </ul>
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
  gap: 16px;
}

/* O QR em papel branco, com a borda fina para não se perder no véu da seção. */
.link__qr {
  flex: none;
  width: 88px;
  height: 88px;
  padding: 4px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: #fff;
}

.link__qr--vazio {
  background: var(--superficie-2);
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
