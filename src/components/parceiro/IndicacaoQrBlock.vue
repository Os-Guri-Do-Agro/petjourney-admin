<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useExportarQr } from '@/composables/useExportarQr'
import { LightColors } from '@/theme/colors'
import { currentColors } from '@/theme/color-mode'

const props = withDefaults(
  defineProps<{
    imageUrl: string
    code: string
    disabled?: boolean
    /** `sm` = visão geral; `md` = divulgação */
    size?: 'sm' | 'md'
  }>(),
  {
    disabled: false,
    size: 'md',
  },
)

const { t } = useI18n()
const imgRef = ref<HTMLImageElement | null>(null)

/* Baixar o QR: a mesma lógica da janela de QR da visão geral — ver `useExportarQr`. */
const { exportando: exporting, exportar: exportQr } = useExportarQr({
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

const blockStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--iqr-card': colors.dashboard.surface,
    '--iqr-surface': colors.dashboard.surfaceSoft,
    '--iqr-line': colors.dashboard.lineSoft,
    '--iqr-text': colors.dashboard.text,
    '--iqr-muted': colors.dashboard.muted,
    '--iqr-primary': colors.vet.primary,
    '--iqr-primary-soft': colors.vet.secondary,
    '--iqr-primary-strong': colors.dashboard.primaryStrong,
    /** Quiet zone do QR: branco puro, para não tirar contraste de leitor nenhum. */
    '--iqr-img-bg': LightColors.text.inverse,
  }
})
</script>

<template>
  <figure
    class="indicacao-qr"
    :class="[`indicacao-qr--${props.size}`, { 'indicacao-qr--disabled': props.disabled }]"
    :style="blockStyle"
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
        <i class="pi pi-image" />
      </span>
    </div>
    <figcaption>
      {{
        imagemFalhou ? t('divulgacao.shareKit.qrIndisponivel') : t('divulgacao.shareKit.qrCaption')
      }}
    </figcaption>
    <!-- Exportar baixa a mesma URL que acabou de falhar: some em vez de prometer. -->
    <Button
      v-if="!imagemFalhou"
      type="button"
      class="indicacao-qr__export"
      size="small"
      severity="secondary"
      icon="pi pi-download"
      :label="t('divulgacao.shareKit.qrExport')"
      :disabled="props.disabled"
      :loading="exporting"
      @click="exportQr"
    />
  </figure>
</template>

<style scoped>
.indicacao-qr {
  display: grid;
  gap: 0.7rem;
  justify-items: center;
  align-content: center;
  height: 100%;
  /* Os dois donos deste bloco usam coluna `auto`, que cresce com o conteúdo.
     Sem teto, a legenda longa do estado indisponível esticava o QR e espremia
     o texto ao lado até virar uma coluna de duas palavras. */
  max-width: 14rem;
  margin: 0;
  padding: 1.1rem;
  border: 1px solid var(--iqr-line);
  border-radius: 1.1rem;
  background: linear-gradient(
    165deg,
    color-mix(in srgb, var(--iqr-primary-soft) 28%, var(--iqr-surface)) 0%,
    var(--iqr-surface) 60%
  );
  box-sizing: border-box;
}

.indicacao-qr__frame {
  display: grid;
  place-items: center;
  padding: 0.6rem;
  border-radius: 0.95rem;
  background: var(--iqr-img-bg);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--iqr-text) 8%, transparent);
}

/* Serviço de imagem fora: o quadro vira placeholder tracejado, não caixa branca. */
.indicacao-qr__frame--falhou {
  border: 1px dashed color-mix(in srgb, var(--iqr-text) 22%, transparent);
  background: color-mix(in srgb, var(--iqr-surface) 70%, var(--iqr-card));
  box-shadow: none;
}

.indicacao-qr__fallback {
  display: grid;
  width: 10rem;
  height: 10rem;
  place-items: center;
  color: var(--iqr-muted);
  font-size: 1.9rem;
}

.indicacao-qr--sm .indicacao-qr__fallback {
  width: 6.5rem;
  height: 6.5rem;
}

/* `md` é o QR da Divulgação: ali ele é o convite à ação, não um selo de canto. */
.indicacao-qr__img {
  display: block;
  width: 10rem;
  height: 10rem;
  object-fit: contain;
}

.indicacao-qr--sm .indicacao-qr__img {
  width: 6.5rem;
  height: 6.5rem;
}

/* `sm` é o selo do dashboard: some no canto do card, sem roubar a leitura. */
.indicacao-qr--sm {
  min-width: 9.75rem;
  max-width: 11.5rem;
  padding: 0.75rem;
  gap: 0.45rem;
}

.indicacao-qr--sm .indicacao-qr__frame {
  padding: 0.45rem;
  border-radius: 0.85rem;
}

.indicacao-qr figcaption {
  margin: 0;
  max-width: 100%;
  color: var(--iqr-muted);
  font-size: 0.7rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  text-align: center;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.indicacao-qr :deep(.indicacao-qr__export.p-button) {
  width: 100%;
  justify-content: center;
  min-height: 2.25rem;
  border-color: color-mix(in srgb, var(--iqr-primary) 28%, var(--iqr-line));
  background: color-mix(in srgb, var(--iqr-primary-soft) 40%, var(--iqr-card));
  color: var(--iqr-primary-strong);
  font-size: 0.78rem;
  font-weight: 700;
}

.indicacao-qr :deep(.indicacao-qr__export.p-button:not(:disabled):hover) {
  filter: brightness(1.03);
}

.indicacao-qr--disabled {
  opacity: 0.72;
}
</style>
