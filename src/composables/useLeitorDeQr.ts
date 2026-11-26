/**
 * A câmera lendo um QR (N19, guia de 25/11): o vídeo da câmera de trás e o leitor de códigos do
 * próprio navegador (`BarcodeDetector`), a cada quarto de segundo, até achar um QR com texto.
 *
 * Sem biblioteca de leitura: onde o navegador não tem o leitor (Chrome no Windows e no Linux,
 * Safari), `disponivel` fica falso e a tela não oferece a câmera. O campo continua recebendo o
 * endereço colado ou o que o leitor de QR de mão digita, e o texto segue o mesmo caminho.
 *
 * O texto lido sai como veio (`aoLer`): quem resolve o que ele é, é a API. A câmera desliga ao
 * ler, ao fechar e quando o componente sai da tela.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

type CodigoLido = { rawValue: string }

type Detector = { detect(imagem: HTMLVideoElement): Promise<CodigoLido[]> }

type ClasseDoDetector = {
  new (opcoes: { formats: string[] }): Detector
  getSupportedFormats?: () => Promise<string[]>
}

export type ProblemaDaCamera = 'semPermissao' | 'semCamera' | 'falhou'

/** Entre uma leitura e a próxima: o bastante para o PC fraco e rápido para quem segura o pet. */
export const INTERVALO_DA_LEITURA_MS = 250

function classeDoDetector(): ClasseDoDetector | null {
  const classe = (globalThis as { BarcodeDetector?: ClasseDoDetector }).BarcodeDetector
  const temCamera =
    typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'

  return classe && temCamera ? classe : null
}

function problemaDe(erro: unknown): ProblemaDaCamera {
  const nome = (erro as { name?: unknown } | null)?.name

  if (nome === 'NotAllowedError' || nome === 'SecurityError') return 'semPermissao'
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') return 'semCamera'

  return 'falhou'
}

export function useLeitorDeQr(aoLer: (texto: string) => void) {
  const disponivel = ref(false)
  const ligada = ref(false)
  const abrindo = ref(false)
  const problema = ref<ProblemaDaCamera | null>(null)
  /** O `<video>` da tela, ligado por `ref` no template. */
  const video = ref<HTMLVideoElement | null>(null)

  let fluxo: MediaStream | null = null
  let detector: Detector | null = null
  let proxima: ReturnType<typeof setTimeout> | null = null
  let ativo = true

  onMounted(async () => {
    const classe = classeDoDetector()

    if (!classe) return

    try {
      const formatos = classe.getSupportedFormats ? await classe.getSupportedFormats() : ['qr_code']
      disponivel.value = ativo && formatos.includes('qr_code')
    } catch {
      disponivel.value = false
    }
  })

  function desligar() {
    ligada.value = false
    if (proxima) clearTimeout(proxima)
    proxima = null
    fluxo?.getTracks().forEach((faixa) => faixa.stop())
    fluxo = null
    detector = null
    if (video.value) video.value.srcObject = null
  }

  function procurar() {
    proxima = setTimeout(async () => {
      const quadro = video.value

      if (!ligada.value || !detector || !quadro) return

      try {
        if (quadro.readyState >= 2) {
          const achados = await detector.detect(quadro)
          const texto = achados.map((achado) => achado.rawValue?.trim()).find(Boolean)

          if (texto && ligada.value) {
            desligar()
            aoLer(texto)
            return
          }
        }
      } catch {
        /* Um quadro que o leitor não conseguiu ler: tenta o próximo. */
      }

      if (ligada.value) procurar()
    }, INTERVALO_DA_LEITURA_MS)
  }

  async function ligar() {
    const classe = classeDoDetector()

    if (!classe || ligada.value || abrindo.value) return

    problema.value = null
    abrindo.value = true

    try {
      fluxo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
    } catch (erro) {
      problema.value = problemaDe(erro)
      return
    } finally {
      abrindo.value = false
    }

    if (!ativo) {
      desligar()
      return
    }

    detector = new classe({ formats: ['qr_code'] })
    ligada.value = true
    await nextTick()

    if (!video.value) {
      desligar()
      return
    }

    video.value.srcObject = fluxo
    await video.value.play().catch(() => undefined)
    procurar()
  }

  onBeforeUnmount(() => {
    ativo = false
    desligar()
  })

  return { disponivel, ligada, abrindo, problema, video, ligar, desligar }
}
