/*
 * Sessão de captura do roteiro de apresentação (docs/apresentacao/README.md).
 *
 * Roda ANTES do app, em toda navegação (initScript do Chrome DevTools MCP, ou colado num
 * snippet do DevTools seguido de recarga). Faz quatro coisas:
 *
 *   1. Relógio: Date.now() deslocado para ?hora=HH:MM (padrão 10:40). ?hora=real desliga.
 *      Clínica e Hotel montam os estados pela hora da carga; às 10:40 o dia está cheio.
 *   2. Sessão local: token falso (alg none), Clínica e Hotel ligados, idioma (?idioma=ar) e
 *      tema (?tema=dark). ?sair=1 apaga o token, para a entrada e as páginas públicas.
 *   3. API: toda chamada ao petjourney-api passa por window.__MOCK_ROTAS; o que não tem
 *      resposta falha como rede (401 deslogaria).
 *   4. Respostas de exemplo do Portal: empresa "Vila Madalena Pet", aprovada, afiliado ativo,
 *      saldo, indicação com QR e quatro acessos compartilhados. Valores de demonstração.
 */
/* Sessão de captura do roteiro: relógio fixo, token local, módulos ligados, API respondida aqui. */
;(() => {
  const q = new URLSearchParams(location.search)

  /* 1 · Relógio. ?hora=HH:MM (padrão 10:40). ?hora=real desliga. */
  const hora = q.get('hora') || '10:40'
  if (hora !== 'real') {
    const [h, m] = hora.split(':').map(Number)
    const RealDate = Date
    const alvo = new RealDate()
    alvo.setHours(h, m, 0, 0)
    const delta = alvo.getTime() - RealDate.now()
    class D extends RealDate {
      constructor(...a) {
        if (a.length === 0) super(RealDate.now() + delta)
        else super(...a)
      }
      static now() {
        return RealDate.now() + delta
      }
    }
    window.Date = D
    window.__RealDate = RealDate
  }

  /* 2 · Sessão local. O token não vale em servidor nenhum. */
  const b64 = (o) =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  const agora = Math.floor(window.__RealDate ? window.__RealDate.now() / 1000 : Date.now() / 1000)
  const token =
    b64({ alg: 'none', typ: 'JWT' }) +
    '.' +
    b64({
      userId: 'user-demo',
      sub: 'user-demo',
      email: 'demonstracao@petjourney.app',
      nome: 'Marina Duarte',
      perfilAtivo: 'PARCEIRO',
      parceiroAtivoId: 'parceiro-demo',
      iat: agora,
      exp: agora + 43200,
    }) +
    '.demo'

  if (q.has('sair')) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    sessionStorage.clear()
  } else {
    localStorage.setItem('access_token', token)
    localStorage.setItem('refresh_token', token)
  }
  localStorage.setItem('clinic.moduleUnlocked', 'user-demo')
  localStorage.setItem('hotel.moduleUnlocked', 'user-demo')
  localStorage.setItem('APP_LOCALE', q.get('idioma') || 'pt')
  localStorage.setItem('petjourney-color-mode', q.get('tema') === 'dark' ? 'dark' : 'light')
  localStorage.setItem('petjourney-parceiro-id', 'parceiro-demo')

  /* 3 · API. Rotas conhecidas respondem com o envelope; o resto falha como rede. */
  const API = 'petjourney-api'
  window.__mock = { calls: [] }
  const realFetch = window.fetch.bind(window)

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url
    if (!url.includes(API)) return realFetch(input, init)
    const metodo = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase()
    const caminho = new URL(url).pathname
    window.__mock.calls.push({ metodo, caminho, url })
    for (const [m, re, resp] of window.__MOCK_ROTAS || []) {
      if (m !== metodo && m !== '*') continue
      const r = re instanceof RegExp ? re : new RegExp(re)
      if (!r.test(caminho)) continue
      const data = typeof resp === 'function' ? resp(caminho, url, init) : resp
      const status = data && data.__status ? data.__status : 200
      const corpo = data && data.__status ? data.corpo : { statusCode: status, message: 'ok', data }
      return new Response(JSON.stringify(corpo), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    }
    throw new TypeError('Failed to fetch')
  }

  /* 4 · Relógio da Linha do dia parado durante a captura. */
  if (q.has('parado')) {
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' })
  }
})()

/* Respostas de exemplo do Portal do parceiro, para capturar sem backend. Valores de demonstração. */
;(() => {
  const D = () => (window.Date || Date)
  const dia = 86400000
  const iso = (deltaDias, hora = 10) => {
    const d = new (D())()
    d.setHours(hora, 0, 0, 0)
    return new (D())(d.getTime() + deltaDias * dia).toISOString()
  }
  const diaISO = (deltaDias) => iso(deltaDias).slice(0, 10)
  const q = new URLSearchParams(location.search)
  const cenario = q.get('cenario') || 'cheio'

  const EMPRESA = 'Vila Madalena Pet'
  const parceiro = {
    id: 'parceiro-demo',
    nome: EMPRESA,
    logoUrl: null,
    statusAuditoria: 'APROVADO',
    cnpj: '12.345.678/0001-90',
  }

  const status = {
    statusAuditoria: 'APROVADO',
    auditadoEm: iso(-60),
    podeOperar: true,
    afiliado: { status: 'ATIVO', motivo: null, decididoEm: iso(-58), podeSolicitar: false },
    participativo: { status: 'NAO_SOLICITADO', motivo: null, decididoEm: null, podeSolicitar: true },
    statusAfiliado: 'ATIVO',
    statusParticipativo: 'NAO_SOLICITADO',
  }

  const extrato = [
    { id: 't1', tipo: 'CREDITO_COMISSAO', valorCentavos: 1495, periodicidade: 'ANUAL', origem: 'INITIAL_PURCHASE', createdAt: iso(-2, 14) },
    { id: 't2', tipo: 'CREDITO_COMISSAO', valorCentavos: 150, periodicidade: 'MENSAL', origem: 'RENEWAL', createdAt: iso(-4, 9) },
    { id: 't3', tipo: 'CREDITO_COMISSAO', valorCentavos: 150, periodicidade: 'MENSAL', origem: 'RENEWAL', createdAt: iso(-6, 16) },
    { id: 't4', tipo: 'CREDITO_COMISSAO', valorCentavos: 1495, periodicidade: 'ANUAL', origem: 'INITIAL_PURCHASE', createdAt: iso(-9, 11) },
    { id: 't5', tipo: 'CREDITO_COMISSAO', valorCentavos: 150, periodicidade: 'MENSAL', origem: 'INITIAL_PURCHASE', createdAt: iso(-12, 10) },
    { id: 't6', tipo: 'DEBITO_SAQUE', valorCentavos: -10000, periodicidade: null, origem: null, createdAt: iso(-15, 15) },
    { id: 't7', tipo: 'CREDITO_COMISSAO', valorCentavos: 1495, periodicidade: 'ANUAL', origem: 'RENEWAL', createdAt: iso(-19, 10) },
    { id: 't8', tipo: 'CREDITO_COMISSAO', valorCentavos: 150, periodicidade: 'MENSAL', origem: 'RENEWAL', createdAt: iso(-24, 13) },
  ]

  const saques = [
    { id: 's2', valorCentavos: 10000, status: 'PAGO', createdAt: iso(-15, 15), liquidadoEm: iso(-11, 11), motivoFalha: null },
    { id: 's1', valorCentavos: 15000, status: 'PAGO', createdAt: iso(-46, 10), liquidadoEm: iso(-41, 10), motivoFalha: null },
  ]

  const metricasDias = Array.from({ length: 14 }, (_, i) => ({
    day: diaISO(i - 13),
    count: [2, 3, 1, 4, 6, 2, 0, 3, 5, 7, 4, 3, 6, 5][i],
  }))
  const agentes = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)',
    'Mozilla/5.0 (Linux; Android 15; SM-S921B)',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X)',
    'Mozilla/5.0 (Linux; Android 14; moto g84)',
  ]

  const resumo = (o) => ({
    especieLabel: o.especie === 'GATO' ? 'Gato' : 'Cachorro',
    servicoOutroLabel: null,
    status: 'ATIVO',
    snapshotAtualizadoEm: null,
    ...o,
  })

  const ativos = [
    resumo({ id: 'c1', petNome: 'Mel', especie: 'CACHORRO', petFoto: '/demo/pacientes/mel.jpg', tipoServico: 'CONSULTA', expiraEm: iso(5, 18), vinculadoEm: iso(-2, 9), criadoEm: iso(-2, 8), totalAnotacoes: 1, totalDocumentos: 2, temDiario: true }),
    resumo({ id: 'c2', petNome: 'Cacau', especie: 'CACHORRO', petFoto: '/demo/pacientes/cacau.jpg', tipoServico: 'BANHO', expiraEm: iso(0, 17), vinculadoEm: iso(0, 8), criadoEm: iso(0, 8), totalAnotacoes: 0, totalDocumentos: 0, temDiario: false }),
    resumo({ id: 'c3', petNome: 'Amora', especie: 'GATO', petFoto: null, tipoServico: 'HOTEL', expiraEm: iso(9, 12), vinculadoEm: iso(-1, 15), criadoEm: iso(-1, 14), totalAnotacoes: 2, totalDocumentos: 1, temDiario: true }),
    resumo({ id: 'c4', petNome: 'Thor', especie: 'CACHORRO', petFoto: null, tipoServico: 'EXAME', expiraEm: iso(2, 20), vinculadoEm: iso(-1, 10), criadoEm: iso(-1, 10), totalAnotacoes: 0, totalDocumentos: 1, temDiario: false }),
  ]
  const encerrados = [
    resumo({ id: 'c9', petNome: 'Nina', especie: 'GATO', petFoto: null, tipoServico: 'CONSULTA', status: 'ENCERRADO', expiraEm: iso(-6, 18), vinculadoEm: iso(-13, 10), criadoEm: iso(-13, 9), totalAnotacoes: 1, totalDocumentos: 0, temDiario: false }),
  ]

  const vazioEstruturado = {
    motivo: null, diagnostico: null, pesoKg: null, tipoExame: null, laudoTexto: null, dataResultado: null,
    produtos: null, condicaoPele: null, comportamento: null, dataEntrada: null, dataSaida: null,
    alimentacao: null, intercorrencias: null, prescricaoItens: [], examesSolicitados: [],
  }

  const detalheMel = {
    ...ativos[0],
    codigo: '482915',
    petCastrado: true,
    empresaNome: EMPRESA,
    mensagemTutor:
      'Ela anda se coçando muito nas patas desde a semana passada e lambendo sem parar. Trouxe o último hemograma.',
    categorias: ['ALERGIAS', 'VACINAS', 'MEDICAMENTOS', 'TRATAMENTOS', 'DIAGNOSTICOS', 'DIARIO', 'DOCUMENTOS'],
    snapshot: {
      pesoKg: 28.4,
      alergias: [
        { titulo: 'Frango', detalhe: 'Alimentar', destaque: true },
        { titulo: 'Dipirona', detalhe: 'Medicamento', destaque: true },
      ],
      vacinas: [
        { titulo: 'V10', detalhe: 'Reforço em 12/03/2026' },
        { titulo: 'Antirrábica', detalhe: 'Reforço em 12/03/2026' },
      ],
      medicamentos: [{ titulo: 'Simparic 40 mg', detalhe: '1 comprimido por mês' }],
      diagnosticos: [{ titulo: 'Dermatite atópica', detalhe: 'Desde 2024' }],
      tratamentosContinuos: [
        {
          titulo: 'Apoquel 16 mg',
          detalhe: '1/2 comprimido · 1x ao dia · oral',
          detalheLabel: '1/2 comprimido · 1x ao dia · oral',
          destaque: true,
          motivo: 'para a coceira',
          diagnostico: 'Dermatite atópica',
          desde: iso(-120),
          observacoes: 'Dar junto com a ração da manhã.',
        },
      ],
      observacoesTutor: 'Não gosta que mexam nas orelhas. Fica calma com petisco.',
      diario: [
        { data: iso(-1), sintomas: ['Coceira', 'Lambedura das patas'], doencas: [], vitalidade: 'Normal', alimentacao: 'Normal', observacoes: 'Coçou a noite toda.' },
        { data: iso(-4), sintomas: ['Coceira'], doencas: [], vitalidade: 'Normal', alimentacao: 'Comeu menos' },
      ],
      documentos: [
        { origemId: 'd1', nome: 'Hemograma completo', tipo: 'Exame de Sangue', dataEmissao: iso(-20), arquivoIds: ['a1'] },
        { origemId: 'd2', nome: 'Receita · Apoquel', tipo: 'Receita Medica', dataEmissao: iso(-120), arquivoIds: ['a2'] },
      ],
    },
    anotacoes: [
      {
        ...vazioEstruturado,
        id: 'n1',
        empresaNome: EMPRESA,
        profissionalNome: 'Helena Vasconcelos Prado',
        profissionalEspecialidade: 'Dermatologia',
        servicoRealizado: 'CONSULTA',
        texto: 'Pele das patas com eritema leve. Mantido Apoquel. Retorno em 15 dias se a coceira não ceder.',
        criadaEm: iso(-2, 11),
        motivo: 'Coceira nas patas',
        diagnostico: 'Dermatite atópica em crise leve',
        pesoKg: 28.4,
        anexos: [],
      },
    ],
  }

  const detalhes = { c1: detalheMel }
  const detalheDe = (id) => {
    if (detalhes[id]) return detalhes[id]
    const r = [...ativos, ...encerrados].find((c) => c.id === id) || ativos[1]
    return { ...r, codigo: '771204', petCastrado: false, empresaNome: EMPRESA, mensagemTutor: null, categorias: ['VACINAS'], snapshot: { pesoKg: 9.2, vacinas: [{ titulo: 'V10' }] }, anotacoes: [] }
  }

  const carteira = {
    saldoTotalCentavos: 41250,
    saldoSacavelCentavos: 28650,
    chavePix: 'financeiro@vilamadalena.vet',
    totalSacadoCentavos: 25000,
    bloqueadoParaSaque: false,
  }

  const indicacao = {
    codigoIndicacao: 'VILA24',
    link: 'https://www.petjourney.health/c/VILA24',
    qrCode: 'q1',
    qrImageUrl: 'data:image/png;base64,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',
    podeIndicar: true,
  }

  const listaCompartilhamentos = (caminho, url) => {
    const st = new URL(url).searchParams.get('status')
    const itens = st === 'ENCERRADO' ? encerrados : ativos
    return { data: itens, meta: { proximoCursor: null } }
  }

  window.__MOCK_ROTAS = [
    ['GET', /\/usuario\/allInformations\//, { id: 'user-demo', nome: 'Marina Duarte', email: 'demonstracao@petjourney.app', telefone: '(11) 98888-1234' }],
    ['GET', /\/auth\/perfis$/, {
      usuarioId: 'user-demo',
      tutor: null,
      parceiros: [
        { parceiroId: 'parceiro-demo', nome: EMPRESA, papel: 'DONO', status: 'APROVADO' },
        { parceiroId: 'parceiro-2', nome: 'Banho & Tosa Pinheiros', papel: 'OPERADOR', status: 'APROVADO' },
      ],
    }],
    ['GET', /\/parceiro\/portal\/dashboard$/, cenario === 'sem-empresa'
      ? { __status: 403, corpo: { statusCode: 403, message: 'Forbidden' } }
      : { parceiro, papel: 'DONO', totais: { cuponsAtivos: 0, resgatesTotal: 0, resgatesUltimos30d: 0 } }],
    ['GET', /\/parceiro\/portal\/status$/, status],
    ['GET', /\/parceiro\/portal\/cadastro$/, {
      parceiroId: 'parceiro-demo', nome: EMPRESA, categoria: 'CLINICA_VETERINARIA', cnpj: '12.345.678/0001-90',
      telefoneComercial: '(11) 3333-4455', crmv: null, logoUrl: null, statusAuditoria: 'APROVADO', motivoAuditoria: null,
    }],
    ['GET', /\/parceiro\/portal\/carteira$/, carteira],
    ['GET', /\/parceiro\/portal\/carteira\/extrato$/, { __status: 200, corpo: { statusCode: 200, message: 'ok', data: { items: extrato, nextCursor: null } } }],
    ['GET', /\/parceiro\/portal\/saques$/, saques],
    ['GET', /\/parceiro\/portal\/saques\/[^/]+$/, (c) => ({ ...(saques.find((s) => c.endsWith(s.id)) || saques[0]), chavePixSnapshot: carteira.chavePix, comprovante: null })],
    ['GET', /\/parceiro\/portal\/feedback\/elegibilidade$/, { exibir: false }],
    ['GET', /\/parceiro\/portal\/indicacao$/, indicacao],
    ['GET', /\/parceiro\/portal\/indicacao\/metricas$/, {
      qrCode: 'q1',
      scanCount: 186,
      byDay: metricasDias,
      recent: [0, 1, 2, 3, 4].map((i) => ({ at: iso(-i * 0.3, 18 - i), userAgent: agentes[i % agentes.length] })),
    }],
    ['GET', /\/parceiro\/portal\/compartilhamentos\/reivindicacoes$/, { itens: [] }],
    ['GET', /\/parceiro\/portal\/compartilhamentos\/[^/]+\/(arquivos|anexos)\/[^/]+\/url$/, { signedUrl: '/demo/pacientes/mel.jpg', expiresIn: 900 }],
    ['GET', /\/parceiro\/portal\/compartilhamentos\/[^/]+\/leitura-receita\/[^/]+$/, {
      id: 'l1', status: 'AGUARDANDO_CONFIRMACAO', anotacaoId: null, motivoFalha: null, mensagemFalha: null,
      itensFormulario: [
        { nome: 'Apoquel 16 mg', dose: '1/2', unidade: 'comprimido', frequencia: '1x ao dia', duracaoDias: 30, instrucoes: 'Junto com a ração' },
        { nome: 'Shampoo de clorexidina 2%', dose: null, unidade: null, frequencia: '2x por semana', duracaoDias: 21, instrucoes: 'Deixar agir 10 minutos' },
      ],
      confianca: [{}, { dose: 'BAIXA' }],
      avisos: [],
      arquivos: [],
    }],
    ['POST', /\/parceiro\/portal\/compartilhamentos\/[^/]+\/leitura-receita$/, { id: 'l1', status: 'PROCESSANDO' }],
    ['GET', /\/parceiro\/portal\/compartilhamentos\/[^/]+$/, (c) => detalheDe(c.split('/').pop())],
    ['GET', /\/parceiro\/portal\/compartilhamentos$/, listaCompartilhamentos],
  ]
})()
