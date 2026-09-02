/**
 * Interruptor oculto do módulo clínico.
 *
 * As telas de `/veterinario/*` e a página de referência de `/design/clinico` rodam sobre uma
 * camada **mocada** — pacientes, prontuários e agenda são dados de demonstração. Elas existem
 * para apresentar e testar o módulo enquanto a API clínica não existe, e não devem aparecer
 * para quem abre o portal para trabalhar: um menu "Pacientes" com bichos que não existem é
 * indistinguível de um defeito.
 *
 * Por isso o módulo nasce **desligado** e só aparece quando alguém o liga de propósito.
 *
 * ## Como ligar
 *
 * Dois caminhos, porque servem a duas situações diferentes:
 *
 * 1. **Link**: `?clinico=on` em qualquer rota do portal. É o que se manda para alguém antes de
 *    uma demonstração — a pessoa clica e já entra com o módulo visível, sem instrução.
 * 2. **Teclado**: digitar `clinico` em qualquer tela, fora de campo de texto. É o caminho para
 *    quem já está com a tela aberta e não quer mexer na barra de endereço na frente de um
 *    cliente.
 *
 * Para desligar: `?clinico=off`, ou digitar a sequência de novo.
 *
 * ## Por que `localStorage` e não uma variável de ambiente
 *
 * Variável de ambiente é decidida no deploy e vale para todo mundo — exatamente o oposto do que
 * se quer aqui, que é uma pessoa ligar na própria máquina, para a própria sessão de
 * demonstração, sem republicar nada. E persiste porque quem ligou não quer religar a cada
 * recarga da página no meio da apresentação.
 *
 * ## Por que o interruptor tem dono
 *
 * `localStorage` é do **navegador**, não da conta. Enquanto o valor gravado era apenas `true`,
 * ele sobrevivia ao logout e à criação de uma conta nova na mesma máquina: quem ligasse o
 * módulo uma vez para demonstrar continuava vendo as telas mocadas depois, com qualquer conta —
 * e foi assim que elas apareceram numa conta recém-criada em produção.
 *
 * Por isso o que se grava é o **`userId` para quem o módulo foi ligado**, e não um booleano. O
 * módulo só existe quando esse dono é o usuário da sessão atual. Renovação de token não mexe em
 * nada (mesmo dono); logout apaga a sessão e o módulo some junto; outra conta na mesma máquina
 * nasce sem ele, que é a regra que este arquivo existe para garantir.
 *
 * O caso de ligar **antes** de entrar (o link `?clinico=on` que cai na tela de login) grava
 * `SEM_DONO`, e o primeiro usuário que entrar em seguida vira o dono. Sem isso, o link só
 * funcionaria depois do login — e é justamente antes que ele é usado.
 */

import { computed, ref, watch } from 'vue'

import { authSessionVersion, getAuthUser } from '@/service/auth/auth-session'

/** Guarda o `userId` dono do desbloqueio; ausente significa desligado. */
const CHAVE = 'clinic.moduleUnlocked'

/**
 * Ligado sem sessão: vale para quem entrar em seguida, e só para essa pessoa.
 *
 * Não é "vale para todo mundo": assim que alguém entra, o valor é reescrito com o `userId`
 * dela. Deixá-lo como coringa permanente recriaria exatamente o vazamento que este arquivo
 * corrige.
 */
const SEM_DONO = '*'
/** Nome do parâmetro e da sequência. Curto o bastante para digitar sem errar. */
export const PARAMETRO_DO_MODULO = 'clinico'
const SEQUENCIA = 'clinico'

/**
 * Prefixos de rota que pertencem ao módulo.
 *
 * A página de referência de design entra junto: ela existe para revisar os componentes
 * clínicos e não faz sentido fora do módulo.
 */
export const ROTAS_DO_MODULO = ['/veterinario', '/design/clinico']

function lerArmazenado(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(CHAVE)
  } catch {
    /* Navegador com armazenamento bloqueado: o módulo simplesmente fica desligado. */
    return null
  }
}

/**
 * Estado global do módulo, e não por componente: o menu, o guard de rota e a tela de ajustes
 * precisam ver o mesmo valor no mesmo instante.
 */
const dono = ref<string | null>(lerArmazenado())

function usuarioAtual(): string | null {
  return getAuthUser()?.userId ?? null
}

function gravar(valor: string | null) {
  dono.value = valor

  if (typeof window === 'undefined') {
    return
  }

  try {
    if (valor) {
      window.localStorage.setItem(CHAVE, valor)
    } else {
      window.localStorage.removeItem(CHAVE)
    }
  } catch {
    /* Sem armazenamento, vale só para esta aba — melhor que quebrar a navegação. */
  }
}

/**
 * `true` só quando o dono gravado é quem está na sessão agora.
 *
 * Depende de `authSessionVersion` de propósito: é o sinal que o `auth-session` emite a cada
 * login, logout e troca de perfil, e sem ele o menu continuaria montado com o valor de antes
 * até alguma outra coisa forçar o recálculo.
 */
const ativoParaSessao = computed(() => {
  void authSessionVersion.value

  if (!dono.value) {
    return false
  }

  return dono.value === SEM_DONO || dono.value === usuarioAtual()
})

/**
 * Promove o desbloqueio anônimo assim que alguém entra.
 *
 * É o que faz o link `?clinico=on` clicado na tela de login continuar valendo depois do login,
 * sem que o desbloqueio fique valendo para todas as contas seguintes.
 */
watch(authSessionVersion, () => {
  const usuario = usuarioAtual()

  if (dono.value === SEM_DONO && usuario) {
    gravar(usuario)
  }
})

export function definirModuloClinico(valor: boolean) {
  gravar(valor ? (usuarioAtual() ?? SEM_DONO) : null)
}

export function alternarModuloClinico() {
  definirModuloClinico(!ativoParaSessao.value)

  return ativoParaSessao.value
}

/**
 * Lê o parâmetro da URL, quando presente.
 *
 * Devolve `true` quando o parâmetro **decidiu** alguma coisa, para que o guard saiba que
 * precisa limpar a query — deixar `?clinico=on` colado na barra de endereço transformaria o
 * caminho oculto numa placa.
 */
export function aplicarParametroDaUrl(valor: unknown): boolean {
  const bruto = Array.isArray(valor) ? valor[0] : valor

  if (typeof bruto !== 'string') {
    return false
  }

  const normalizado = bruto.toLowerCase()

  if (['on', '1', 'true', 'sim'].includes(normalizado)) {
    definirModuloClinico(true)

    return true
  }

  if (['off', '0', 'false', 'nao'].includes(normalizado)) {
    definirModuloClinico(false)

    return true
  }

  return false
}

export function rotaPertenceAoModulo(caminho: string): boolean {
  return ROTAS_DO_MODULO.some(
    (prefixo) => caminho === prefixo || caminho.startsWith(`${prefixo}/`),
  )
}

/**
 * Escuta a sequência de teclas.
 *
 * Ignora o que é digitado dentro de campo, `textarea` ou elemento editável — senão escrever
 * "clínico" numa anamnese ligaria e desligaria o módulo, e a agenda tem atalhos de uma letra
 * que colidiriam com qualquer buffer global.
 *
 * O buffer esquece depois de 1,5 s sem tecla: sem isso, letras digitadas ao longo de uma hora
 * acabariam formando a palavra por acidente.
 */
export function instalarSequenciaSecreta(aoAtivar?: (ativo: boolean) => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  let buffer = ''
  let ultimaTecla = 0

  function aoTeclar(evento: KeyboardEvent) {
    const alvo = evento.target as HTMLElement | null

    if (
      evento.ctrlKey ||
      evento.metaKey ||
      evento.altKey ||
      alvo?.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo?.tagName ?? '')
    ) {
      return
    }

    if (evento.key.length !== 1) {
      return
    }

    const agora = Date.now()

    buffer = agora - ultimaTecla > 1500 ? '' : buffer
    ultimaTecla = agora
    buffer = `${buffer}${evento.key.toLowerCase()}`.slice(-SEQUENCIA.length)

    if (buffer === SEQUENCIA) {
      buffer = ''
      aoAtivar?.(alternarModuloClinico())
    }
  }

  window.addEventListener('keydown', aoTeclar)

  return () => window.removeEventListener('keydown', aoTeclar)
}

export function useModuloClinico() {
  return {
    /** `true` quando as telas clínicas devem existir para **esta conta**, nesta máquina. */
    ativo: ativoParaSessao,
    definir: definirModuloClinico,
    alternar: alternarModuloClinico,
  }
}
