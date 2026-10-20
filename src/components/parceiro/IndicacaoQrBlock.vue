<script setup lang="ts">
/**
 * O QR de indicação com o que se faz com ele: baixar a imagem e imprimir o cartaz do balcão.
 *
 * O quadro em volta do QR é branco nos dois temas: é a zona de silêncio que o leitor de QR precisa
 * para achar as bordas, e no escuro um QR sobre fundo escuro não lê em câmera nenhuma.
 */
import Button from 'primevue/button'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useExportarQr } from '@/composables/useExportarQr'
import { LightColors } from '@/theme/colors'

const props = withDefaults(
  defineProps<{
    imageUrl: string
    code: string
    disabled?: boolean
    /** `sm` = selo pequeno; `md` = divulgação */
    size?: 'sm' | 'md'
  }>(),
  {
    disabled: false,
    size: 'md',
  },
)

const { t } = useI18n()

/** A zona de silêncio do QR: branco de verdade nos dois temas (o leitor precisa do contraste). */
const estiloDoQuadro = { '--qr-papel': LightColors.text.inverse }

const imgRef = ref<HTMLImageElement | null>(null)

/* Baixar e imprimir: a mesma lógica da janela de QR do Início — ver `useExportarQr`. */
const {
  exportando: exporting,
  exportar: exportQr,
  imprimir,
} = useExportarQr({
  imageUrl: () => props.imageUrl,
  code: () => props.code,
  imgRef,
  disabled: () => props.disabled,
})

/**
 * A URL do QR pode existir e mesmo assim não carregar: o backend cacheia
 * `qrImageUrl` e tem circuit breaker, então segue devolvendo o endereço mesmo
 * com o serviço de imagem fora. Sem isto, a tela mostra um quadrado branco mudo
 * e um botão de exportar que baixaria o mesmo erro.
 */
const imagemFalhou = ref(false)

// Trocar de parceiro (ou o backend religar o QR) merece nova tentativa.
watch(
  () => props.imageUrl,
  () => {
    imagemFalhou.value = false
  },
)
</script>

<template>
  <figure
    class="indicacao-qr"
    :class="[`indicacao-qr--${props.size}`, { 'indicacao-qr--disabled': props.disabled }]"
    :style="estiloDoQuadro"
  >
    <div class="indicacao-qr__frame" :class="{ 'indicacao-qr__frame--falhou': imagemFalhou }">
      <img
        v-show="!imagemFalhou"
        ref="imgRef"
        :src="props.imageUrl"
        :alt="t('divulgacao.shareKit.qrAlt')"
        class="indicacao-qr__img"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
        @error="imagemFalhou = true"
        @load="imagemFalhou = false"
      />
      <span v-if="imagemFalhou" class="indicacao-qr__fallback" aria-hidden="true">
        <i class="ph ph-image-broken" />
      </span>
    </div>

    <figcaption>
      <i v-if="!imagemFalhou" class="ph ph-printer" aria-hidden="true" />
      {{ imagemFalhou ? t('divulgacao.shareKit.qrIndisponivel') : t('divulgacao.kit.qr') }}
    </figcaption>

    <!-- Exportar baixaria a mesma URL que acabou de falhar: as ações somem em vez de prometer. -->
    <div v-if="!imagemFalhou" class="indicacao-qr__acoes">
      <Button
        type="button"
        class="indicacao-qr__export"
        severity="secondary"
        outlined
        icon="ph ph-download-simple"
        :label="t('inicio.indique.baixar')"
        :disabled="props.disabled"
        :loading="exporting"
        @click="exportQr"
      />
      <Button
        type="button"
        class="indicacao-qr__imprimir"
        severity="secondary"
        outlined
        icon="ph ph-printer"
        :label="t('inicio.indique.imprimir')"
        :disabled="props.disabled"
        @click="imprimir(t('inicio.indique.instrucao'))"
      />
    </div>
  </figure>
</template>

<style scoped>
.indicacao-qr {
  display: grid;
  justify-items: center;
  gap: 12px;
  width: 100%;
  max-width: 15rem;
  margin: 0;
}

.indicacao-qr__frame {
  display: grid;
  place-items: center;
  padding: 10px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--qr-papel);
}

/* Serviço de imagem fora: o quadro vira um espaço tracejado, não uma caixa branca muda. */
.indicacao-qr__frame--falhou {
  border-style: dashed;
  border-color: var(--linha-forte);
  background: var(--superficie);
}

.indicacao-qr__img,
.indicacao-qr__fallback {
  display: block;
  width: 168px;
  height: 168px;
  object-fit: contain;
}

.indicacao-qr__fallback {
  display: grid;
  place-items: center;
  color: var(--tinta-3);
  font-size: 32px;
}

.indicacao-qr--sm .indicacao-qr__img,
.indicacao-qr--sm .indicacao-qr__fallback {
  width: 104px;
  height: 104px;
}

.indicacao-qr figcaption {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.35;
  text-align: center;
  overflow-wrap: anywhere;
}

.indicacao-qr figcaption i {
  color: var(--pj-lugar, var(--portal));
  font-size: 16px;
}

.indicacao-qr__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  width: 100%;
}

.indicacao-qr__acoes :deep(.p-button) {
  flex: 1 1 auto;
  justify-content: center;
}

.indicacao-qr--disabled {
  opacity: 0.72;
}
</style>
