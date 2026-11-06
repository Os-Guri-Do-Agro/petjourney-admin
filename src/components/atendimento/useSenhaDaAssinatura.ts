/**
 * A senha da conta ao finalizar e ao anular o prontuário (parecer de 30/10; guia e4 6.8). Sem a
 * senha e sem a janela de 15 minutos da sessão, a API responde 401 `ASSINATURA_SENHA_EXIGIDA`: a
 * gaveta mostra o campo e reenvia com a senha. Não é sessão expirada (o serviço mantém a sessão
 * nesses 401).
 *
 * A senha nunca fica guardada: some ao fechar a gaveta e depois de cada envio que deu certo.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { ApiError } from '@/service/api'

export function useSenhaDaAssinatura() {
  const { t } = useI18n()

  /** O campo aparece depois do primeiro 401, e fica até a gaveta fechar. */
  const pedindo = ref(false)
  const senha = ref('')
  const erroDaSenha = ref('')
  /** A conta entra sem senha própria (login social): não há o que digitar aqui. */
  const semSenhaPropria = ref(false)

  function limpar() {
    pedindo.value = false
    senha.value = ''
    erroDaSenha.value = ''
    semSenhaPropria.value = false
  }

  /** O corpo leva a senha só quando o campo está à vista e preenchido. */
  function campo() {
    return pedindo.value && senha.value ? { senha: senha.value } : {}
  }

  /** Trata o erro da senha; devolve `false` quando o erro é de outra coisa. */
  function tratar(err: unknown): boolean {
    if (!(err instanceof ApiError)) return false
    const detalhes = err.detalhes ?? {}

    switch (err.codigo) {
      case 'ASSINATURA_SENHA_EXIGIDA':
        pedindo.value = true
        erroDaSenha.value = ''
        return true
      case 'ASSINATURA_SENHA_INCORRETA':
        pedindo.value = true
        senha.value = ''
        erroDaSenha.value = t('atendimento.senha.incorreta')
        return true
      case 'ASSINATURA_SENHA_BLOQUEADA': {
        pedindo.value = true
        senha.value = ''
        const segundos = Number(detalhes.tenteDeNovoEmSegundos)
        const minutos = Number.isFinite(segundos) ? Math.max(1, Math.ceil(segundos / 60)) : 15
        erroDaSenha.value = t('atendimento.senha.bloqueada', { n: minutos }, minutos)
        return true
      }
      case 'ASSINATURA_SENHA_NECESSARIA':
        semSenhaPropria.value = true
        return true
      default:
        return false
    }
  }

  /** Deu certo: a janela de 15 minutos está aberta, o campo some. */
  function concluir() {
    senha.value = ''
    erroDaSenha.value = ''
  }

  return { pedindo, senha, erroDaSenha, semSenhaPropria, limpar, campo, tratar, concluir }
}
