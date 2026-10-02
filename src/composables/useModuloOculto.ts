/**
 * O mecanismo dos módulos ocultos do portal.
 *
 * Nasceu como `useModuloClinico`, arquivo único, quando havia um módulo só. Com o hotel, copiá-lo
 * seria duplicar duzentas linhas cuja parte delicada — **o desbloqueio pertence à conta que o
 * ligou** — foi escrita depois de um vazamento em produção. Duas cópias dessa regra são duas
 * chances de corrigir uma e esquecer a outra.
 *
 * O que esta fábrica guarda, e que nenhum dos dois módulos pode perder:
 *
 * ## Por que o interruptor tem dono
 *
 * `localStorage` é do **navegador**, não da conta. Enquanto o valor gravado era apenas `true`, ele
 * sobrevivia ao logout e à criação de uma conta nova na mesma máquina: quem ligasse o módulo uma
 * vez para demonstrar continuava vendo as telas mocadas depois, com qualquer conta — e foi assim
 * que elas apareceram numa conta recém-criada em produção.
 *
 * Por isso o que se grava é o **`userId` para quem o módulo foi ligado**, e não um booleano. O
 * módulo só existe quando esse dono é o usuário da sessão atual. Renovação de token não mexe em
 * nada (mesmo dono); logout apaga a sessão e o módulo some junto; outra conta na mesma máquina
 * nasce sem ele.
 *
 * O caso de ligar **antes** de entrar (o link que cai na tela de login) grava `SEM_DONO`, e o
 * primeiro usuário que entrar em seguida vira o dono. Sem isso, o link só funcionaria depois do
 * login — e é justamente antes que ele é usado.
 *
 * ## Por que `localStorage` e não uma variável de ambiente
 *
 * Variável de ambiente é decidida no deploy e vale para todo mundo — exatamente o oposto do que se
 * quer aqui, que é uma pessoa ligar na própria máquina, para a própria sessão de demonstração, sem
 * republicar nada. E persiste porque quem ligou não quer religar a cada recarga da página no meio
 * da apresentação.
 */

import { computed, ref, watch, type ComputedRef } from 'vue'

import { authSessionVersion, getAuthUser } from '@/service/auth/auth-session'

/**
 * Ligado sem sessão: vale para quem entrar em seguida, e só para essa pessoa.
 *
 * Não é "vale para todo mundo": assim que alguém entra, o valor é reescrito com o `userId` dela.
 * Deixá-lo como coringa permanente recriaria exatamente o vazamento que este arquivo corrige.
 */
const SEM_DONO = '*'

/** O buffer da sequência esquece depois disto. Sem o limite, letras digitadas ao longo de uma
 * hora acabariam formando a palavra por acidente. */
const ESQUECE_APOS_MS = 1500

export type ModuloOculto = {
  /** `true` quando as telas devem existir para **esta conta**, nesta máquina. */
  ativo: ComputedRef<boolean>
  definir: (valor: boolean) => void
  alternar: () => boolean
  /**
   * Lê o parâmetro da URL, quando presente.
   *
   * Devolve `true` quando o parâmetro **decidiu** alguma coisa, para que o guard saiba que precisa
   * limpar a query — deixar `?clinico=on` colado na barra de endereço transformaria o caminho
   * oculto numa placa, e qualquer captura de tela o entregaria.
   */
  aplicarParametroDaUrl: (valor: unknown) => boolean
  rotaPertenceAoModulo: (caminho: string) => boolean
  /** O nome do parâmetro e da sequência de teclas. */
  readonly parametro: string
  /** Prefixos de rota que pertencem ao módulo. */
  readonly rotas: readonly string[]
}

export type DefinicaoDeModulo = {
  /** Chave no `localStorage`. Guarda o dono do desbloqueio; ausente significa desligado. */
  chave: string
  /** Nome do parâmetro e da sequência de teclas. Curto o bastante para digitar sem errar. */
  parametro: string
  rotas: readonly string[]
}

export function criarModuloOculto(definicao: DefinicaoDeModulo): ModuloOculto {
  function lerArmazenado(): string | null {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      return window.localStorage.getItem(definicao.chave)
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
        window.localStorage.setItem(definicao.chave, valor)
      } else {
        window.localStorage.removeItem(definicao.chave)
      }
    } catch {
      /* Sem armazenamento, vale só para esta aba — melhor que quebrar a navegação. */
    }
  }

  /**
   * `true` só quando o dono gravado é quem está na sessão agora.
   *
   * Depende de `authSessionVersion` de propósito: é o sinal que o `auth-session` emite a cada
   * login, logout e troca de perfil, e sem ele o menu continuaria montado com o valor de antes até
   * alguma outra coisa forçar o recálculo.
   */
  const ativo = computed(() => {
    void authSessionVersion.value

    if (!dono.value) {
      return false
    }

    return dono.value === SEM_DONO || dono.value === usuarioAtual()
  })

  /**
   * Promove o desbloqueio anônimo assim que alguém entra.
   *
   * É o que faz o link clicado na tela de login continuar valendo depois do login, sem que o
   * desbloqueio fique valendo para todas as contas seguintes.
   */
  watch(authSessionVersion, () => {
    const usuario = usuarioAtual()

    if (dono.value === SEM_DONO && usuario) {
      gravar(usuario)
    }
  })

  function definir(valor: boolean) {
    gravar(valor ? (usuarioAtual() ?? SEM_DONO) : null)
  }

  function alternar() {
    definir(!ativo.value)

    return ativo.value
  }

  function aplicarParametroDaUrl(valor: unknown): boolean {
    const bruto = Array.isArray(valor) ? valor[0] : valor

    if (typeof bruto !== 'string') {
      return false
    }

    const normalizado = bruto.toLowerCase()

    if (['on', '1', 'true', 'sim'].includes(normalizado)) {
      definir(true)

      return true
    }

    if (['off', '0', 'false', 'nao'].includes(normalizado)) {
      definir(false)

      return true
    }

    return false
  }

  function rotaPertenceAoModulo(caminho: string): boolean {
    /*
     * Comparação por segmento e não `startsWith` cru: `/veterinarios` (plural) e
     * `/design/clinicoteste` não são do módulo, e pegá-los esconderia telas do portal por engano.
     */
    return definicao.rotas.some(
      (prefixo) => caminho === prefixo || caminho.startsWith(`${prefixo}/`),
    )
  }

  return {
    ativo,
    definir,
    alternar,
    aplicarParametroDaUrl,
    rotaPertenceAoModulo,
    parametro: definicao.parametro,
    rotas: definicao.rotas,
  }
}

/**
 * Escuta a sequência de teclas de um ou mais módulos.
 *
 * Ignora o que é digitado dentro de campo, `textarea` ou elemento editável — senão escrever
 * "clínico" numa anamnese ligaria e desligaria o módulo, e a agenda tem atalhos de uma letra que
 * colidiriam com qualquer buffer global.
 *
 * Um ouvinte só para todos os módulos, e não um por módulo: dois `keydown` globais sobre o mesmo
 * buffer seriam dois lugares para esquecer a guarda de campo de texto.
 */
export function instalarSequenciasSecretas(
  modulos: readonly { modulo: ModuloOculto; aoAlternar?: (ativo: boolean) => void }[],
) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const maior = Math.max(...modulos.map((item) => item.modulo.parametro.length), 0)
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

    buffer = agora - ultimaTecla > ESQUECE_APOS_MS ? '' : buffer
    ultimaTecla = agora
    buffer = `${buffer}${evento.key.toLowerCase()}`.slice(-maior)

    for (const item of modulos) {
      if (buffer.endsWith(item.modulo.parametro)) {
        buffer = ''

        /*
         * Alterna **antes** de avisar, em duas linhas, e isso não é estilo.
         *
         * `item.aoAlternar?.(item.modulo.alternar())` parece equivalente e não é: o encadeamento
         * opcional curto-circuita a chamada **inteira**, argumentos inclusive. Sem `aoAlternar`,
         * `alternar()` simplesmente não roda — a sequência de teclas deixa de funcionar para quem
         * não passou callback, que é exatamente o caso de quem só quer ligar o módulo.
         *
         * O defeito veio junto do código original e nunca apareceu porque o único chamador sempre
         * passava callback. O teste de `useModuloHotel` o encontrou ao instalar sem um.
         */
        const ativo = item.modulo.alternar()

        item.aoAlternar?.(ativo)

        return
      }
    }
  }

  window.addEventListener('keydown', aoTeclar)

  return () => window.removeEventListener('keydown', aoTeclar)
}
