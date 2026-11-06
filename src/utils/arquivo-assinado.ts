/**
 * Os PDFs e laudos vêm por uma URL assinada de 15 minutos, pedida depois do toque. Para o bloqueio
 * de pop-up não barrar a aba, ela abre vazia antes do pedido (`abrirAbaVazia`) e recebe o endereço
 * depois (`levarAoArquivo`).
 *
 * A URL de download (a do armazenamento com `?download`, como a da cópia do prontuário) responde
 * como anexo: a aba ficaria em branco. Nesse caso a aba vazia fecha e o arquivo baixa daqui mesmo,
 * sem sair da tela (um anexo não troca a página).
 */
export function abrirAbaVazia() {
  return window.open('', '_blank')
}

export function ehDownload(url: string) {
  try {
    return new URL(url).searchParams.has('download')
  } catch {
    return false
  }
}

export function levarAoArquivo(janela: Window | null, url: string) {
  if (!ehDownload(url)) {
    if (janela) janela.location.href = url
    else window.open(url, '_blank', 'noopener')
    return
  }
  janela?.close()
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}
