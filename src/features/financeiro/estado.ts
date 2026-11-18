/**
 * O estado do financeiro na sessão (protótipo): um só para as quatro telas, gerado na primeira
 * leitura e mexido pelas gavetas. Recarregar a página volta ao começo: nada é gravado.
 *
 * O "Ver como" (`perfil`) mostra o mesmo financeiro com os olhos de quem entra: a gestão vê tudo; a
 * recepção, só o caixa (e as notas fiscais, que ela emite e corrige); o veterinário, só os próprios
 * repasses ("Meus repasses"). É o desenho das permissões que a API já prevê (`financeiro.ler` e
 * `financeiro.gerir` para o dono, a gestão e o financeiro), mais as duas portas que faltam: o caixa
 * da recepção e o extrato de quem recebe.
 *
 * As notas fiscais (`notas.ts`) nascem do receber: a nota vai à "prefeitura" em processamento e,
 * alguns segundos depois (`ESPERA_DA_PREFEITURA`), volta autorizada, com número e código, ou
 * recusada, com o motivo.
 */
import { computed, ref, type Ref } from 'vue'

import { addDays, diffDays } from '@/features/clinico/domain/clinic-time'

import {
  CONDICOES_INICIAIS,
  devidoDaConta,
  gerarMundo,
  mesAnterior,
  mesDe,
  novoIdFinanceiro,
  horaDeMinutos,
  QUEM_USA,
  REGRAS_INICIAIS,
  TABELA_INICIAL,
  calcularRepasse,
  ultimoDoMes,
  nomeDoMes,
  nomeDoProfissional,
  type Centavos,
  type CondicaoDaForma,
  type Conta,
  type DataISO,
  type Despesa,
  type FormaDePagamento,
  type ItemDaConta,
  type ItemDePreco,
  type MundoDoFinanceiro,
  type Pagamento,
  type RegraDeRepasse,
  totalDaConta,
} from './dados'
import {
  canaisDoTomador,
  codigoDeVerificacao,
  configuracaoInicial,
  gerarNotas,
  momentoDoPagamento,
  montarNota,
  precisaDeNota,
  problemaDoTomador,
  temServico,
  tomadorDoCadastro,
  type ConfiguracaoDaNota,
  type NotaFiscal,
  type TipoDeCancelamento,
  type TomadorDaNota,
} from './notas'

/** Quanto a "prefeitura" do protótipo demora para responder. */
export const ESPERA_DA_PREFEITURA = 3500

export type Perfil = { tipo: 'gestao' } | { tipo: 'recepcao' } | { tipo: 'veterinario'; id: string }

export type ModoDoCaixa = 'abrir' | 'fechar' | 'retirada' | 'reforco'

export type PagamentoPedido = {
  forma: FormaDePagamento
  valor: Centavos
  parcelas: number
  vencimento?: DataISO
}

export type Recebivel = {
  data: DataISO
  forma: 'debito' | 'credito'
  vendas: number
  bruto: Centavos
  taxa: Centavos
  liquido: Centavos
}

export type Devedor = {
  tutorId: string
  tutorNome: string
  pets: string[]
  contas: Conta[]
  total: Centavos
  vencimento: DataISO
  /** Dias desde o vencimento mais antigo; negativo é "vence em". */
  atraso: number
  ultimoLembrete: DataISO | null
}

function criar() {
  const mundo = ref(gerarMundo()) as Ref<MundoDoFinanceiro>
  const tabela = ref<ItemDePreco[]>(TABELA_INICIAL.map((item) => ({ ...item })))
  const condicoes = ref<CondicaoDaForma[]>(CONDICOES_INICIAIS.map((c) => ({ ...c })))
  const regras = ref<RegraDeRepasse[]>(
    REGRAS_INICIAIS.map((regra) => ({ ...regra, percentuais: { ...regra.percentuais } })),
  )
  const perfil = ref<Perfil>({ tipo: 'gestao' })

  /* As notas dos meses do protótipo saem das contas pagas (e marcam as que ficaram sem nota). */
  const configDaNota = ref<ConfiguracaoDaNota>(configuracaoInicial(mundo.value.hoje))
  const geradas = gerarNotas(mundo.value.contas, mundo.value.hoje, configDaNota.value)
  const notas = ref<NotaFiscal[]>(geradas.notas)
  configDaNota.value.proximoRps = geradas.proximoRps
  let proximoNumeroDaNota = geradas.proximoNumero

  const hoje = computed(() => mundo.value.hoje)
  const mesAtual = computed(() => mesDe(hoje.value))
  const agora = () => {
    const d = new Date()
    return horaDeMinutos(d.getHours() * 60 + d.getMinutes())
  }

  // ------------------------------------------------------------------------------- o caixa

  const paraReceber = computed(() =>
    mundo.value.contas
      .filter((conta) => conta.situacao === 'aberta')
      .sort((a, b) => a.hora.localeCompare(b.hora)),
  )

  const internados = computed(() => mundo.value.contas.filter((c) => c.situacao === 'correndo'))

  const pagamentosDeHoje = computed(() =>
    mundo.value.contas
      .flatMap((conta) => conta.pagamentos.map((pagamento) => ({ conta, pagamento })))
      .filter(({ pagamento }) => pagamento.data === hoje.value && pagamento.forma !== 'em-aberto')
      .sort((a, b) => b.pagamento.hora.localeCompare(a.pagamento.hora)),
  )

  const deixadasEmAbertoHoje = computed(() =>
    mundo.value.contas.filter((c) => c.data === hoje.value && c.situacao === 'em-aberto'),
  )

  const porForma = computed(() => {
    const somas = new Map<FormaDePagamento, { total: Centavos; vezes: number }>()
    for (const { pagamento } of pagamentosDeHoje.value) {
      const atual = somas.get(pagamento.forma) ?? { total: 0, vezes: 0 }
      somas.set(pagamento.forma, { total: atual.total + pagamento.valor, vezes: atual.vezes + 1 })
    }
    return condicoes.value
      .filter((c) => c.forma !== 'em-aberto')
      .map((c) => ({ ...c, ...(somas.get(c.forma) ?? { total: 0, vezes: 0 }) }))
  })

  const recebidoHoje = computed(() => porForma.value.reduce((soma, f) => soma + f.total, 0))

  /** O dinheiro que deveria estar na gaveta: troco, mais o que entrou, menos o que saiu. */
  const dinheiroNaGaveta = computed(() => {
    const caixa = mundo.value.caixa
    const entrou = porForma.value.find((f) => f.forma === 'dinheiro')?.total ?? 0
    const movimentos = caixa.movimentos.reduce(
      (soma, m) => soma + (m.tipo === 'reforco' ? m.valor : -m.valor),
      0,
    )
    return caixa.trocoInicial + entrou + movimentos
  })

  const caixaAberto = computed(
    () => Boolean(mundo.value.caixa.abertoEm) && !mundo.value.caixa.fechadoEm,
  )

  function abrirCaixa(troco: Centavos) {
    const caixa = mundo.value.caixa
    caixa.abertoEm = agora()
    caixa.abertoPor = QUEM_USA
    caixa.trocoInicial = troco
    caixa.fechadoEm = null
    caixa.movimentos = []
    caixa.contado = {}
  }

  function fecharCaixa(contado: Partial<Record<FormaDePagamento, Centavos>>, observacao: string) {
    const caixa = mundo.value.caixa
    caixa.contado = contado
    caixa.observacao = observacao
    caixa.fechadoEm = agora()
    caixa.fechadoPor = QUEM_USA
  }

  function movimentar(tipo: 'retirada' | 'reforco', valor: Centavos, motivo: string) {
    mundo.value.caixa.movimentos.push({
      id: novoIdFinanceiro('mov'),
      tipo,
      valor,
      motivo,
      hora: agora(),
      por: QUEM_USA,
    })
  }

  function conta(id: string) {
    return mundo.value.contas.find((c) => c.id === id) ?? null
  }

  function condicao(forma: FormaDePagamento) {
    return condicoes.value.find((c) => c.forma === forma) ?? condicoes.value[0]!
  }

  function taxaDe(forma: FormaDePagamento, parcelas: number) {
    const c = condicao(forma)
    return forma === 'credito' && parcelas > 1 ? (c.taxaParcelado ?? c.taxa) : c.taxa
  }

  /**
   * Recebe: os itens e o desconto finais (a recepção pode ter mexido), e um ou dois pagamentos. O
   * que for "deixar em aberto" vira vencimento, e a conta passa a ser débito do cliente.
   *
   * Com `nota` ligada e a conta quitada, a nota fiscal vai para a prefeitura e volta aqui (a
   * resposta chega por `respostaDa`). Conta que fica devendo tem a nota quando for paga
   * (`quitarDebito`); com `nota` desligada, a conta paga espera em "A emitir".
   */
  function receber(
    id: string,
    dados: {
      itens: ItemDaConta[]
      desconto: Centavos
      pagamentos: PagamentoPedido[]
      reciboNoApp: boolean
      nota: boolean
    },
  ): NotaFiscal | null {
    const alvo = conta(id)
    if (!alvo) return null
    alvo.itens = dados.itens
    alvo.desconto = dados.desconto
    alvo.reciboNoApp = dados.reciboNoApp
    alvo.nota = dados.nota
    const hora = agora()
    for (const pedido of dados.pagamentos) {
      if (pedido.forma === 'em-aberto') {
        alvo.vencimento = pedido.vencimento ?? addDays(hoje.value, 15)
        continue
      }
      alvo.pagamentos.push({
        id: novoIdFinanceiro('pag'),
        forma: pedido.forma,
        valor: pedido.valor,
        parcelas: pedido.parcelas,
        data: hoje.value,
        hora,
        taxa: taxaDe(pedido.forma, pedido.parcelas),
        por: QUEM_USA,
      })
    }
    alvo.situacao =
      devidoDaConta(alvo) > 0 ? (alvo.situacao === 'correndo' ? 'correndo' : 'em-aberto') : 'paga'
    return alvo.situacao === 'paga' && alvo.nota ? emitirNota(alvo.id) : null
  }

  /**
   * Quita de uma vez as contas em aberto de um responsável (o débito, em Contas). A conta que fica
   * paga e tinha pedido nota no receber ganha a nota agora; as notas emitidas voltam na lista.
   */
  function quitarDebito(tutorId: string, pagamentos: PagamentoPedido[]): NotaFiscal[] {
    const emitidas: NotaFiscal[] = []
    const hora = agora()
    const abertas = mundo.value.contas
      .filter((c) => c.tutorId === tutorId && c.situacao === 'em-aberto')
      .sort((a, b) => a.data.localeCompare(b.data))
    const fila = pagamentos
      .filter((p) => p.forma !== 'em-aberto')
      .map((p) => ({ ...p, sobra: p.valor }))
    for (const alvo of abertas) {
      let falta = devidoDaConta(alvo)
      for (const pedido of fila) {
        if (falta <= 0) break
        if (pedido.sobra <= 0) continue
        const parte = Math.min(falta, pedido.sobra)
        alvo.pagamentos.push({
          id: novoIdFinanceiro('pag'),
          forma: pedido.forma,
          valor: parte,
          parcelas: pedido.parcelas,
          data: hoje.value,
          hora,
          taxa: taxaDe(pedido.forma, pedido.parcelas),
          por: QUEM_USA,
        })
        pedido.sobra -= parte
        falta -= parte
      }
      if (devidoDaConta(alvo) <= 0) {
        alvo.situacao = 'paga'
        const emitida = alvo.nota ? emitirNota(alvo.id) : null
        if (emitida) emitidas.push(emitida)
      }
    }
    return emitidas
  }

  function criarConta(dados: {
    petId: string | null
    petNome: string
    especie: Conta['especie']
    fotoUrl: string
    tutorId: string | null
    tutorNome: string
    itens: ItemDaConta[]
  }): string {
    const nova: Conta = {
      id: novoIdFinanceiro('conta'),
      data: hoje.value,
      hora: agora(),
      origem: 'balcao',
      petId: dados.petId,
      petNome: dados.petNome,
      especie: dados.especie,
      fotoUrl: dados.fotoUrl,
      tutorId: dados.tutorId,
      tutorNome: dados.tutorNome,
      profissionalId: null,
      itens: dados.itens,
      desconto: 0,
      pagamentos: [],
      situacao: 'aberta',
      vencimento: null,
      lembretes: [],
      reciboNoApp: Boolean(dados.tutorId),
      nota: true,
    }
    mundo.value.contas.push(nova)
    return nova.id
  }

  // ------------------------------------------------------------------------------- contas

  /** O que a maquininha ainda vai depositar: o débito no dia seguinte, o crédito de 30 em 30. */
  const recebiveis = computed<Recebivel[]>(() => {
    const porDia = new Map<string, Recebivel>()
    for (const c of mundo.value.contas) {
      for (const p of c.pagamentos) {
        if (p.forma !== 'debito' && p.forma !== 'credito') continue
        const parcelas = p.forma === 'credito' ? p.parcelas : 1
        for (let k = 1; k <= parcelas; k++) {
          const data = p.forma === 'debito' ? addDays(p.data, 1) : addDays(p.data, 30 * k)
          if (data <= hoje.value) continue
          const bruto = Math.round(p.valor / parcelas)
          const taxa = Math.round(bruto * p.taxa)
          const chave = `${data}-${p.forma}`
          const atual = porDia.get(chave) ?? {
            data,
            forma: p.forma,
            vendas: 0,
            bruto: 0,
            taxa: 0,
            liquido: 0,
          }
          atual.vendas += 1
          atual.bruto += bruto
          atual.taxa += taxa
          atual.liquido += bruto - taxa
          porDia.set(chave, atual)
        }
      }
    }
    return [...porDia.values()].sort(
      (a, b) => a.data.localeCompare(b.data) || a.forma.localeCompare(b.forma),
    )
  })

  const devedores = computed<Devedor[]>(() => {
    const porTutor = new Map<string, Conta[]>()
    for (const c of mundo.value.contas) {
      if (c.situacao !== 'em-aberto' || !c.tutorId || devidoDaConta(c) <= 0) continue
      porTutor.set(c.tutorId, [...(porTutor.get(c.tutorId) ?? []), c])
    }
    return [...porTutor.entries()]
      .map(([tutorId, contas]) => {
        const vencimento = contas.map((c) => c.vencimento ?? c.data).sort()[0]!
        const lembretes = contas.flatMap((c) => c.lembretes.map((l) => l.data)).sort()
        return {
          tutorId,
          tutorNome: contas[0]!.tutorNome,
          pets: [...new Set(contas.map((c) => c.petNome))],
          contas: contas.sort((a, b) => a.data.localeCompare(b.data)),
          total: contas.reduce((soma, c) => soma + devidoDaConta(c), 0),
          vencimento,
          atraso: diffDays(vencimento, hoje.value),
          ultimoLembrete: lembretes.at(-1) ?? null,
        }
      })
      .sort((a, b) => b.atraso - a.atraso)
  })

  function lembrar(
    tutorId: string,
    canal: 'app' | 'telefone' | 'whatsapp' | 'presencial',
    nota: string,
  ) {
    for (const c of mundo.value.contas) {
      if (c.tutorId === tutorId && c.situacao === 'em-aberto') {
        c.lembretes.push({ data: hoje.value, canal, nota })
      }
    }
  }

  const aPagar = computed(() =>
    mundo.value.despesas
      .filter((d) => !d.pagaEm)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
  )

  const pagasNoMes = computed(() =>
    mundo.value.despesas
      .filter((d) => d.pagaEm && mesDe(d.pagaEm) === mesAtual.value)
      .sort((a, b) => (b.pagaEm ?? '').localeCompare(a.pagaEm ?? '')),
  )

  function salvarDespesa(despesa: Omit<Despesa, 'id'> & { id?: string }) {
    if (despesa.id) {
      const atual = mundo.value.despesas.find((d) => d.id === despesa.id)
      if (atual) Object.assign(atual, despesa)
      return
    }
    const nova: Despesa = { ...despesa, id: novoIdFinanceiro('desp') }
    mundo.value.despesas.push(nova)
    /* Repetir todo mês: as próximas duas já ficam na lista, para a previsão enxergar. */
    if (nova.recorrente) {
      for (const k of [1, 2]) {
        mundo.value.despesas.push({
          ...nova,
          id: novoIdFinanceiro('desp'),
          vencimento: addMeses(nova.vencimento, k),
          pagaEm: null,
        })
      }
    }
  }

  function pagarDespesa(id: string, data: DataISO) {
    const alvo = mundo.value.despesas.find((d) => d.id === id)
    if (!alvo) return
    alvo.pagaEm = data
    if (alvo.origem?.tipo === 'repasse') {
      const origem = alvo.origem
      const fechamento = mundo.value.fechamentos.find(
        (f) => f.profissionalId === origem.profissionalId && f.mes === origem.mes,
      )
      if (fechamento) fechamento.pagoEm = data
    }
  }

  function desfazerPagamento(id: string) {
    const alvo = mundo.value.despesas.find((d) => d.id === id)
    if (alvo) alvo.pagaEm = null
  }

  // ------------------------------------------------------------------------------ repasses

  function regraDe(id: string) {
    return regras.value.find((r) => r.profissionalId === id) ?? null
  }

  function repasse(id: string, mes: string) {
    const regra = regraDe(id)
    if (!regra) return null
    const fechamento =
      mundo.value.fechamentos.find((f) => f.profissionalId === id && f.mes === mes) ?? null
    const ate = mes === mesAtual.value ? hoje.value : ultimoDoMes(mes)
    return { regra, fechamento, calculo: calcularRepasse(regra, mes, mundo.value, ate) }
  }

  const mesAberto = computed(() => {
    /* O mês mais antigo que ainda não foi fechado (normalmente o atual). */
    for (let k = 5; k >= 0; k--) {
      const mes = mesAnterior(mesAtual.value, k)
      if (!mundo.value.fechamentos.some((f) => f.mes === mes)) return mes
    }
    return mesAtual.value
  })

  /** Fecha o mês de todos: congela os valores e cria as contas a pagar (dia 5 do mês seguinte). */
  function fecharMes(mes: string) {
    for (const regra of regras.value) {
      if (
        mundo.value.fechamentos.some(
          (f) => f.profissionalId === regra.profissionalId && f.mes === mes,
        )
      )
        continue
      const ate = mes === mesAtual.value ? hoje.value : ultimoDoMes(mes)
      const valor = calcularRepasse(regra, mes, mundo.value, ate).aReceber
      mundo.value.fechamentos.push({
        profissionalId: regra.profissionalId,
        mes,
        fechadoEm: hoje.value,
        valor,
        pagoEm: null,
      })
      const nome = nomeDoProfissional(regra.profissionalId)
      mundo.value.despesas.push({
        id: novoIdFinanceiro('desp'),
        descricao: `Repasse de ${nomeDoMes(mes)} · ${nome}`,
        fornecedor: nome,
        categoria: 'repasses',
        valor,
        vencimento:
          `${mesAnterior(mes, -1)}-05` < hoje.value
            ? addDays(hoje.value, 3)
            : `${mesAnterior(mes, -1)}-05`,
        pagaEm: null,
        recorrente: false,
        origem: {
          tipo: 'repasse',
          texto: `Fechado em ${hoje.value.slice(8)}/${hoje.value.slice(5, 7)}`,
          profissionalId: regra.profissionalId,
          mes,
        },
      })
    }
  }

  function pagarRepasse(id: string, mes: string) {
    const despesa = mundo.value.despesas.find(
      (d) => d.origem?.tipo === 'repasse' && d.origem.profissionalId === id && d.origem.mes === mes,
    )
    if (despesa) pagarDespesa(despesa.id, hoje.value)
    else {
      const fechamento = mundo.value.fechamentos.find(
        (f) => f.profissionalId === id && f.mes === mes,
      )
      if (fechamento) fechamento.pagoEm = hoje.value
    }
  }

  function adiantar(id: string, valor: Centavos, nota: string) {
    mundo.value.adiantamentos.push({
      id: novoIdFinanceiro('adi'),
      profissionalId: id,
      data: hoje.value,
      valor,
      nota,
    })
  }

  function salvarRegra(regra: RegraDeRepasse) {
    const indice = regras.value.findIndex((r) => r.profissionalId === regra.profissionalId)
    if (indice >= 0) regras.value[indice] = { ...regra, percentuais: { ...regra.percentuais } }
  }

  // -------------------------------------------------------------------------------- preços

  function salvarPreco(id: string, preco: Centavos) {
    const alvo = tabela.value.find((item) => item.id === id)
    if (alvo) alvo.preco = preco
  }

  function salvarCondicao(forma: FormaDePagamento, dados: Partial<CondicaoDaForma>) {
    const alvo = condicoes.value.find((c) => c.forma === forma)
    if (alvo) Object.assign(alvo, dados)
  }

  function itemDaTabela(
    id: string,
    profissionalId: string | null = null,
    quantidade = 1,
  ): ItemDaConta {
    const p = tabela.value.find((item) => item.id === id) ?? tabela.value[0]!
    return {
      id: novoIdFinanceiro('item'),
      precoId: p.id,
      nome: p.nome,
      tipo: p.tipo,
      quantidade,
      preco: p.preco,
      profissionalId,
    }
  }

  // ------------------------------------------------------------------------- notas fiscais

  function nota(id: string) {
    return notas.value.find((n) => n.id === id) ?? null
  }

  /** As notas de cada conta, na ordem em que foram pedidas (a última é a que vale). */
  const notasPorConta = computed(() => {
    const porConta = new Map<string, NotaFiscal[]>()
    for (const n of notas.value) porConta.set(n.contaId, [...(porConta.get(n.contaId) ?? []), n])
    return porConta
  })

  function notasDaConta(contaId: string) {
    return notasPorConta.value.get(contaId) ?? []
  }

  /** Contas pagas sem nota: a recepção desligou o "Emitir nota", ou a nota foi cancelada por erro. */
  const aEmitir = computed(() =>
    mundo.value.contas
      .filter((c) => precisaDeNota(c, notasPorConta.value.get(c.id)))
      .map((c) => ({ conta: c, pagaEm: momentoDoPagamento(c) }))
      .sort(
        (a, b) =>
          b.pagaEm.data.localeCompare(a.pagaEm.data) || b.pagaEm.hora.localeCompare(a.pagaEm.hora),
      ),
  )

  const recusadas = computed(() =>
    notas.value
      .filter((n) => n.situacao === 'rejeitada')
      .sort((a, b) => b.emitidaEm.localeCompare(a.emitidaEm) || b.hora.localeCompare(a.hora)),
  )

  const respostas = new Map<string, Promise<NotaFiscal>>()

  /**
   * A "prefeitura" do protótipo: responde depois de `espera`. Tomador sem CPF, ou com CPF que não
   * confere, é recusado; o resto sai autorizado, com número e código de verificação, e vai para o
   * app e o e-mail do responsável junto com o recibo.
   */
  function aguardarPrefeitura(id: string, espera = ESPERA_DA_PREFEITURA) {
    const resposta = new Promise<NotaFiscal>((resolver) => {
      globalThis.setTimeout(() => {
        const alvo = nota(id)
        if (!alvo) return
        if (alvo.situacao === 'processando') {
          const problema = problemaDoTomador(alvo.tomador)
          if (problema) {
            alvo.situacao = 'rejeitada'
            alvo.recusa = problema
          } else {
            alvo.situacao = 'autorizada'
            alvo.recusa = null
            alvo.numero = proximoNumeroDaNota++
            alvo.codigoDeVerificacao = codigoDeVerificacao(`${alvo.id}-${alvo.numero}`)
            const canais = canaisDoTomador(alvo.tomador, conta(alvo.contaId)?.reciboNoApp ?? false)
            alvo.envio = canais.app || canais.email ? { ...canais, data: hoje.value } : null
          }
        }
        resolver(alvo)
      }, espera)
    })
    respostas.set(id, resposta)
    return resposta
  }

  /** A resposta da prefeitura para uma nota (na hora, se ela já respondeu). */
  function respostaDa(id: string): Promise<NotaFiscal> {
    const alvo = nota(id)
    if (alvo && alvo.situacao !== 'processando') return Promise.resolve(alvo)
    return respostas.get(id) ?? aguardarPrefeitura(id)
  }

  /** Pede a nota da conta à prefeitura com o responsável do cadastro. */
  function emitirNota(contaId: string): NotaFiscal | null {
    const alvo = conta(contaId)
    if (!alvo || !temServico(alvo)) return null
    alvo.nota = true
    notas.value.push(
      montarNota(alvo, {
        id: novoIdFinanceiro('nota'),
        config: configDaNota.value,
        data: hoje.value,
        hora: agora(),
        numeroRps: configDaNota.value.proximoRps++,
        tomador: tomadorDoCadastro(alvo),
      }),
    )
    const nova = notas.value.at(-1)!
    void aguardarPrefeitura(nova.id)
    return nova
  }

  /** Recusada: o mesmo RPS volta à prefeitura com o tomador corrigido. */
  function reenviarNota(id: string, tomador: TomadorDaNota) {
    const alvo = nota(id)
    if (!alvo || alvo.situacao !== 'rejeitada') return null
    alvo.tomador = { ...tomador }
    alvo.situacao = 'processando'
    alvo.recusa = null
    alvo.emitidaEm = hoje.value
    alvo.hora = agora()
    void aguardarPrefeitura(alvo.id)
    return alvo
  }

  /** "Consultar agora" na nota que ficou em processamento: a prefeitura responde logo. */
  function consultarNota(id: string) {
    const alvo = nota(id)
    if (!alvo || alvo.situacao !== 'processando') return null
    return aguardarPrefeitura(id, 1200)
  }

  function cancelarNota(id: string, tipo: TipoDeCancelamento, motivo: string) {
    const alvo = nota(id)
    if (!alvo || alvo.situacao !== 'autorizada') return
    alvo.situacao = 'cancelada'
    alvo.cancelamento = { tipo, motivo, data: hoje.value, hora: agora(), por: QUEM_USA }
  }

  /** Manda de novo ao responsável, pelos canais que ele tem (o app e o e-mail). */
  function enviarNota(id: string) {
    const alvo = nota(id)
    if (!alvo) return null
    const canais = canaisDoTomador(alvo.tomador, true)
    alvo.envio = canais.app || canais.email ? { ...canais, data: hoje.value } : null
    return alvo.envio
  }

  function salvarConfiguracaoDaNota(dados: ConfiguracaoDaNota) {
    configDaNota.value = { ...dados, certificado: { ...dados.certificado } }
  }

  return {
    mundo,
    tabela,
    condicoes,
    regras,
    perfil,
    hoje,
    mesAtual,
    paraReceber,
    internados,
    pagamentosDeHoje,
    deixadasEmAbertoHoje,
    porForma,
    recebidoHoje,
    dinheiroNaGaveta,
    caixaAberto,
    abrirCaixa,
    fecharCaixa,
    movimentar,
    conta,
    condicao,
    taxaDe,
    receber,
    quitarDebito,
    criarConta,
    recebiveis,
    devedores,
    lembrar,
    aPagar,
    pagasNoMes,
    salvarDespesa,
    pagarDespesa,
    desfazerPagamento,
    regraDe,
    repasse,
    mesAberto,
    fecharMes,
    pagarRepasse,
    adiantar,
    salvarRegra,
    salvarPreco,
    salvarCondicao,
    itemDaTabela,
    notas,
    configDaNota,
    nota,
    notasDaConta,
    aEmitir,
    recusadas,
    respostaDa,
    emitirNota,
    reenviarNota,
    consultarNota,
    cancelarNota,
    enviarNota,
    salvarConfiguracaoDaNota,
  }
}

function addMeses(data: DataISO, meses: number): DataISO {
  const [ano, mes, dia] = data.split('-').map(Number)
  const alvo = new Date(Date.UTC(ano!, mes! - 1 + meses, Math.min(dia!, 28)))
  return alvo.toISOString().slice(0, 10)
}

export type EstadoDoFinanceiro = ReturnType<typeof criar>

let estado: EstadoDoFinanceiro | null = null

export function useFinanceiro(): EstadoDoFinanceiro {
  if (!estado) estado = criar()
  return estado
}

/** Total de uma lista de contas (para o cabeçalho das listas). */
export function somaDasContas(contas: Conta[]) {
  return contas.reduce((soma, c) => soma + totalDaConta(c), 0)
}

export type { Pagamento }
