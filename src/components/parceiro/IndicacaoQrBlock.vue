<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { LightColors } from '@/theme/colors'
import { currentColors } from '@/theme/color-mode'
import {
  downloadFromHtmlImage,
  downloadImageFromUrl,
  pickImageSaveTarget,
} from '@/utils/parceiro/download-image'

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
const toast = useToast()
const exporting = ref(false)
const imgRef = ref<HTMLImageElement | null>(null)

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
    '--iqr-img-bg': LightColors.auth.white,
  }
})

const filename = computed(() => {
  const safe = props.code.replace(/[^a-zA-Z0-9_-]/g, '') || 'indicacao'
  return `petjourney-qr-${safe}.png`
})

function reserveFallbackWindow(): Window | null {
  // Sem `noopener` nas features — senão `window.open` devolve null e não dá para
  // navegar depois do await (CORS). Cortamos o opener manualmente.
  const popup = window.open('about:blank', '_blank')
  if (popup) {
    popup.opener = null
    try {
      popup.document.title = t('divulgacao.shareKit.qrExport')
      popup.document.body.innerHTML =
        '<p style="font-family:system-ui,sans-serif;padding:1.5rem;color:#444">…</p>'
    } catch {
      // ignore
    }
  }
  return popup
}

function toastExportOk(kind: 'saved' | 'downloaded') {
  toast.add({
    severity: 'success',
    summary: t('divulgacao.shareKit.qrExportOk'),
    detail:
      kind === 'saved'
        ? t('divulgacao.shareKit.qrExportSavedDetail')
        : t('divulgacao.shareKit.qrExportOkDetail'),
    life: 2800,
  })
}

async function exportQr() {
  if (props.disabled || exporting.value) {
    return
  }

  exporting.value = true

  try {
    // “Salvar como…” precisa rodar no gesto do clique (antes do fetch).
    const saveTarget = await pickImageSaveTarget(filename.value)
    if (saveTarget === 'cancelled') {
      return
    }

    if (imgRef.value) {
      const fromImg = await downloadFromHtmlImage(imgRef.value, filename.value, saveTarget)
      if (fromImg === 'cancelled') {
        return
      }
      if (fromImg === 'saved' || fromImg === 'downloaded') {
        toastExportOk(fromImg)
        return
      }
    }

    const fallbackWindow = reserveFallbackWindow()

    try {
      const result = await downloadImageFromUrl(props.imageUrl, filename.value, {
        fallbackWindow,
        saveTarget,
      })

      if (result === 'cancelled') {
        return
      }

      if (result === 'saved' || result === 'downloaded') {
        toastExportOk(result)
        return
      }

      toast.add({
        severity: 'info',
        summary: t('divulgacao.shareKit.qrExportOpened'),
        detail: t('divulgacao.shareKit.qrExportOpenedDetail'),
        life: 2800,
      })
    } catch {
      fallbackWindow?.close()
      toast.add({
        severity: 'error',
        summary: t('divulgacao.shareKit.qrExportFail'),
        detail: t('divulgacao.shareKit.qrExportFailDetail'),
        life: 3600,
      })
    }
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <figure
    class="indicacao-qr"
    :class="[`indicacao-qr--${props.size}`, { 'indicacao-qr--disabled': props.disabled }]"
    :style="blockStyle"
  >
    <div class="indicacao-qr__frame">
      <img
        ref="imgRef"
        :src="props.imageUrl"
        :alt="t('divulgacao.shareKit.qrAlt')"
        class="indicacao-qr__img"
        loading="lazy"
        decoding="async"
        referrerpolicy="no-referrer"
      />
    </div>
    <figcaption>{{ t('divulgacao.shareKit.qrCaption') }}</figcaption>
    <Button
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
  gap: 0.55rem;
  justify-items: center;
  align-content: center;
  height: 100%;
  margin: 0;
  padding: 0.9rem;
  border: 1px solid var(--iqr-line);
  border-radius: 1.1rem;
  background:
    linear-gradient(
      165deg,
      color-mix(in srgb, var(--iqr-primary-soft) 28%, var(--iqr-surface)) 0%,
      var(--iqr-surface) 60%
    );
  box-sizing: border-box;
}

.indicacao-qr__frame {
  display: grid;
  place-items: center;
  padding: 0.45rem;
  border-radius: 0.85rem;
  background: var(--iqr-img-bg);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--iqr-text) 8%, transparent);
}

.indicacao-qr__img {
  display: block;
  width: 7.75rem;
  height: 7.75rem;
  object-fit: contain;
}

.indicacao-qr--sm .indicacao-qr__img {
  width: 6.5rem;
  height: 6.5rem;
}

.indicacao-qr--sm {
  min-width: 9.75rem;
  padding: 0.75rem;
  gap: 0.45rem;
}

.indicacao-qr figcaption {
  margin: 0;
  color: var(--iqr-muted);
  font-size: 0.7rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  text-align: center;
  line-height: 1.3;
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
