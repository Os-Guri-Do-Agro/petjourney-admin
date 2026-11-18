/**
 * O aviso de quando a "prefeitura" do protótipo responde: a nota autorizada (com o número e por onde
 * chega ao responsável) ou recusada (com o motivo e onde corrigir). Usado pelo receber, pela fila "A
 * emitir" e pelo reenviar, para a resposta dizer a mesma coisa em todo lugar.
 *
 * Chama `useToast` no `setup` de quem usa; o aviso sai mesmo que a gaveta já tenha fechado.
 */
import { useToast } from 'primevue/usetoast'

import { useFinanceiro } from './estado'
import { numeroDaNota, porOndeChega, type NotaFiscal } from './notas'

const NADA_E_ENVIADO = 'No protótipo, nada é enviado.'

export function useRespostaDaPrefeitura() {
  const toast = useToast()
  const fin = useFinanceiro()

  function primeiroNome(nota: NotaFiscal) {
    return nota.tomador.nome.split(' ')[0] ?? nota.tomador.nome
  }

  function avisarUma(resposta: NotaFiscal) {
    if (resposta.situacao === 'autorizada' && resposta.numero !== null) {
      const onde = resposta.envio ? porOndeChega(resposta.envio, resposta.tomador.nome) : ''
      toast.add({
        severity: 'success',
        summary: `Nota fiscal nº ${numeroDaNota(resposta.numero)} autorizada`,
        detail: onde
          ? `A prefeitura autorizou. A nota chega ${onde}. ${NADA_E_ENVIADO}`
          : `A prefeitura autorizou. ${primeiroNome(resposta)} não tem app nem e-mail no cadastro: entregue a nota impressa. ${NADA_E_ENVIADO}`,
        life: 5500,
      })
    } else if (resposta.situacao === 'rejeitada') {
      toast.add({
        severity: 'warn',
        summary: `A prefeitura recusou a nota de ${primeiroNome(resposta)}`,
        detail: `${resposta.recusa ?? ''} Corrija e reenvie em Financeiro › Notas fiscais.`,
        life: 8000,
      })
    }
  }

  /** Um aviso só, quando todas responderem (emitir várias de uma vez não vira uma chuva de avisos). */
  function avisar(notas: readonly NotaFiscal[]) {
    if (!notas.length) return
    void Promise.all(notas.map((n) => fin.respostaDa(n.id))).then((respostas) => {
      if (respostas.length === 1) {
        avisarUma(respostas[0]!)
        return
      }
      const autorizadas = respostas.filter((r) => r.situacao === 'autorizada').length
      const recusadas = respostas.filter((r) => r.situacao === 'rejeitada')
      if (autorizadas) {
        toast.add({
          severity: 'success',
          summary: `${autorizadas} ${autorizadas === 1 ? 'nota autorizada' : 'notas autorizadas'}`,
          detail: `Cada responsável recebe a sua no app e no e-mail do cadastro. ${NADA_E_ENVIADO}`,
          life: 5500,
        })
      }
      if (recusadas.length) {
        toast.add({
          severity: 'warn',
          summary: `A prefeitura recusou ${recusadas.length} ${recusadas.length === 1 ? 'nota' : 'notas'}`,
          detail: `${recusadas.map((r) => r.tomador.nome).join(', ')}: veja o motivo e corrija em Financeiro › Notas fiscais.`,
          life: 8000,
        })
      }
    })
  }

  return { avisar }
}
