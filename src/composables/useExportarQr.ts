/**
 * Baixar e imprimir o QR de indicação.
 *
 * Morava dentro de `IndicacaoQrBlock`, que era o único dono. A visão geral passou a mostrar o QR
 * numa janela própria, com os mesmos botões — e duas cópias desta lógica ("Salvar como…" no gesto
 * do clique, a janela reserva do fallback, os três avisos) divergiriam na primeira correção.
 */

import { useToast } from 'primevue/usetoast'
import { computed, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  downloadFromHtmlImage,
  downloadImageFromUrl,
  pickImageSaveTarget,
} from '@/utils/parceiro/download-image'

type OpcoesDoQr = {
  imageUrl: () => string
  code: () => string
  /** A imagem já carregada na tela: exportar dela evita baixar de novo (e o CORS do fetch). */
  imgRef: Ref<HTMLImageElement | null>
  disabled?: () => boolean
}

export function useExportarQr(opcoes: OpcoesDoQr) {
  const { t } = useI18n()
  const toast = useToast()
  const exportando = ref(false)

  const nomeDoArquivo = computed(() => {
    const seguro = opcoes.code().replace(/[^a-zA-Z0-9_-]/g, '') || 'indicacao'
    return `petjourney-qr-${seguro}.png`
  })

  function reservarJanela(): Window | null {
    // Sem `noopener` nas features — senão `window.open` devolve null e não dá para
    // navegar depois do await (CORS). Cortamos o opener manualmente.
    const janela = window.open('about:blank', '_blank')
    if (janela) {
      janela.opener = null
      try {
        janela.document.title = t('divulgacao.shareKit.qrExport')
        janela.document.body.innerHTML =
          '<p style="font-family:system-ui,sans-serif;padding:1.5rem;color:#444">…</p>'
      } catch {
        // ignore
      }
    }
    return janela
  }

  function avisarExportado(kind: 'saved' | 'downloaded') {
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

  async function exportar() {
    if (opcoes.disabled?.() || exportando.value) {
      return
    }

    exportando.value = true

    try {
      // "Salvar como…" precisa rodar no gesto do clique (antes do fetch).
      const destino = await pickImageSaveTarget(nomeDoArquivo.value)
      if (destino === 'cancelled') {
        return
      }

      if (opcoes.imgRef.value) {
        const daImagem = await downloadFromHtmlImage(
          opcoes.imgRef.value,
          nomeDoArquivo.value,
          destino,
        )
        if (daImagem === 'cancelled') {
          return
        }
        if (daImagem === 'saved' || daImagem === 'downloaded') {
          avisarExportado(daImagem)
          return
        }
      }

      const janelaReserva = reservarJanela()

      try {
        const resultado = await downloadImageFromUrl(opcoes.imageUrl(), nomeDoArquivo.value, {
          fallbackWindow: janelaReserva,
          saveTarget: destino,
        })

        if (resultado === 'cancelled') {
          return
        }

        if (resultado === 'saved' || resultado === 'downloaded') {
          avisarExportado(resultado)
          return
        }

        toast.add({
          severity: 'info',
          summary: t('divulgacao.shareKit.qrExportOpened'),
          detail: t('divulgacao.shareKit.qrExportOpenedDetail'),
          life: 2800,
        })
      } catch {
        janelaReserva?.close()
        toast.add({
          severity: 'error',
          summary: t('divulgacao.shareKit.qrExportFail'),
          detail: t('divulgacao.shareKit.qrExportFailDetail'),
          life: 3600,
        })
      }
    } finally {
      exportando.value = false
    }
  }

  /**
   * Imprime o QR sozinho, numa janela própria: QR, código e uma linha de instrução, em preto sobre
   * branco — o cartaz do balcão, não a tela do portal impressa.
   *
   * A página é montada com DOM, nunca com HTML em texto: o código vem da API e não é marcação.
   */
  function imprimir(instrucao: string) {
    const url = opcoes.imageUrl()
    if (!url) return

    const janela = window.open('', '_blank')

    if (!janela) {
      toast.add({
        severity: 'warn',
        summary: t('inicio.indique.impressaoBloqueada'),
        detail: t('inicio.indique.impressaoBloqueadaDetalhe'),
        life: 4000,
      })
      return
    }

    const documento = janela.document
    documento.title = opcoes.code()
    documento.body.style.cssText =
      'margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#1F2F2B;background:#fff'

    const figura = documento.createElement('figure')
    figura.style.cssText = 'margin:0;display:grid;gap:16px;justify-items:center;text-align:center'

    const imagem = documento.createElement('img')
    imagem.src = url
    imagem.alt = t('divulgacao.shareKit.qrAlt')
    imagem.referrerPolicy = 'no-referrer'
    imagem.style.cssText = 'width:320px;height:320px;object-fit:contain'

    const codigo = documento.createElement('strong')
    codigo.textContent = opcoes.code()
    codigo.style.cssText = 'font-size:32px;letter-spacing:0.12em'

    const legenda = documento.createElement('figcaption')
    legenda.textContent = instrucao
    legenda.style.cssText = 'font-size:16px;max-width:320px;line-height:1.4'

    figura.append(imagem, codigo, legenda)
    documento.body.append(figura)

    janela.addEventListener('afterprint', () => janela.close())

    const disparar = () => {
      janela.focus()
      janela.print()
    }

    if (imagem.complete) {
      disparar()
    } else {
      imagem.addEventListener('load', disparar, { once: true })
      imagem.addEventListener('error', disparar, { once: true })
    }
  }

  return { exportando, exportar, imprimir }
}
