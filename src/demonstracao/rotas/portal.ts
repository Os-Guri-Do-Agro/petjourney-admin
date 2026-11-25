/**
 * As rotas do Portal (o que não é Clínica): carteira, saques, indicação, cupons, indicados,
 * cadastro e programas; equipe e convites; profissionais e o expediente deles; estabelecimento;
 * módulos; identidade; ficha de emergência; acessos temporários; o perfil e a foto de quem entra;
 * e o sino de avisos. Os dados moram em `dados/portal*.ts`. A trilha de auditoria é do cadastro.
 *
 * Dashboard, status e `/eu` estão em `nucleo.ts`; as agregadoras (pendências, painel) são de quem
 * cruza as áreas.
 */
import QRCode from 'qrcode'

import type { ExtratoPage, CursorPage } from '@/service/api-envelope'
import type {
  ConsentimentoDaIdentidadeDto,
  ConviteAceitoDto,
  ConviteCriadoDto,
  EfeitoDoDesligarDto,
  EquipeParceiroDto,
  FeriadosCopiadosDto,
  FichaDeEmergenciaDto,
  IdentidadeDaPessoaDto,
  MembroAtualizadoDto,
  MeuConviteDto,
  ModuloDesligadoDto,
  ModuloLigadoDto,
  PaginaIndicadosParceiroDto,
  PapeisDoMembroDto,
  PreviaConviteDto,
  PropostaEnviadaDto,
  QrDaPaginaPublicaDto,
  RemocaoDeDiasEspeciaisDto,
  SalvarExpedienteDto,
  VerificacaoDaPessoaDto,
} from '@/service/contrato/openapi'
import type { NomeDoModulo } from '@/service/parceiro/acesso-service'
import type { Expediente } from '@/service/parceiro/agenda-config-service'
import type { PaginaDeAvisos } from '@/service/parceiro/avisos-service'
import type { PapelOperacional } from '@/service/parceiro/equipe-service'
import type {
  DadosDoEstabelecimento,
  DiaEspecial,
  Estabelecimento,
  HorarioDoDia,
  NovoDiaEspecial,
} from '@/service/parceiro/estabelecimento-service'
import type { DadosDoProfissional, Profissional } from '@/service/parceiro/profissionais-service'
import type {
  Anotacao,
  Carteira,
  CatalogoDiario,
  CompartilhamentoDetalhe,
  CompartilhamentoResumo,
  CupomParceiro,
  FeedbackSaqueRegistrado,
  IndicacaoMetricas,
  LeituraReceitaCriada,
  LeituraReceitaParceiro,
  ParceiroCadastro,
  ParceiroCadastroPatchPayload,
  PortalIndicacao,
  ReivindicacaoAcesso,
  ResgateParceiro,
  ResultadoReivindicacao,
  SaqueDetalhe,
  SaqueResumo,
  TransacaoCarteira,
  ValidarCupomResultado,
} from '@/service/parceiro/types'
import type { UpdateUsuarioPayload, UsuarioProfile } from '@/service/user/user-service'

import { idDe } from '../aleatorio'
import { AGENDAMENTOS } from '../base/agenda'
import { paciente } from '../base/cadastro'
import {
  EQUIPE,
  PARCEIRO_ID,
  PARCEIRO_NOME,
  PROFISSIONAIS,
  profissional,
  USUARIO_ID,
} from '../base/clinica'
import {
  AVISOS,
  CADASTRO,
  carteira,
  CONVITES,
  type ConviteDaDemo,
  CUPONS,
  estadoDaCarteira,
  EXTRATO,
  INDICACAO,
  INDICADOS,
  lerAviso,
  MEMBROS,
  metricasDoQr,
  PERFIL_DO_USUARIO,
  pedirSaque,
  reais,
  registrarResgate,
  RESGATES,
  SAQUE_MINIMO_CENTAVOS,
  SAQUES,
} from '../dados/portal'
import {
  acesso,
  ACESSOS,
  arquivoParaAbrir,
  CATALOGO_DO_DIARIO,
  criarAnotacaoDoFormulario,
  criarLeitura,
  detalheDoAcesso,
  LEITURAS,
  leituraAgora,
  resumoDoAcesso,
  statusDoAcesso,
  vincularPorCodigo,
} from '../dados/portal-acessos'
import {
  criarDiaEspecial,
  ESTADO,
  estabelecimento,
  expedienteDe,
  feriadosNacionais,
  pendenciasParaPublicar,
  salvarExpedienteDe,
} from '../dados/portal-estabelecimento'
import { agoraIso, hoje, jaPassou, somarMinutos } from '../relogio'
import { corpoDe, erro, normalizar, ok, paginar, rota, vazio, type Pedido } from '../roteador'

const P = '/parceiro/portal'

/* ============================================================== carteira e ganhos */

function resumoDoSaque(s: SaqueDetalhe): SaqueResumo {
  return {
    id: s.id,
    valorCentavos: s.valorCentavos,
    status: s.status,
    createdAt: s.createdAt,
    liquidadoEm: s.liquidadoEm,
    motivoFalha: s.motivoFalha,
  }
}

/** Normaliza a chave PIX como a API: CPF, CNPJ, e-mail, celular com +55 ou chave aleatória. */
function chavePixValida(bruta: string): string | null {
  const valor = bruta.trim()
  const digitos = valor.replace(/\D/g, '')
  if (/^[\d.\-/\s]+$/.test(valor) && (digitos.length === 11 || digitos.length === 14))
    return digitos
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor) && valor.length <= 77) return valor.toLowerCase()
  if (/^\+?55?\s?\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/.test(valor) && digitos.length >= 12) {
    return `+${digitos.startsWith('55') ? digitos : `55${digitos}`}`
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)) return valor
  return null
}

const feedbacks = new Set<string>()

let qrDaIndicacao: string | null = null

function registrarCarteira() {
  rota('GET', `${P}/carteira`, () => ok<Carteira>(carteira()))

  rota('GET', `${P}/carteira/extrato`, ({ query }) => {
    const { itens, proximoCursor } = paginar(EXTRATO, query, 20)
    return ok<ExtratoPage & { items: TransacaoCarteira[] }>({
      items: itens,
      nextCursor: proximoCursor,
    })
  })

  rota('PATCH', `${P}/carteira/pix`, (pedido) => {
    const chave = chavePixValida(String(corpoDe<{ chavePix: string }>(pedido).chavePix ?? ''))
    if (!chave) {
      return erro(
        400,
        'CHAVE_PIX_INVALIDA',
        'Chave PIX inválida. Use CPF, CNPJ, e-mail, celular ou chave aleatória.',
      )
    }
    estadoDaCarteira.chavePix = chave
    return ok({ parceiroId: PARCEIRO_ID, chavePix: chave })
  })

  rota('GET', `${P}/saques`, () => ok<SaqueResumo[]>(SAQUES.map(resumoDoSaque)))

  rota('GET', `${P}/saques/:id`, ({ params }) => {
    const saque = SAQUES.find((s) => s.id === params.id)
    return saque
      ? ok<SaqueDetalhe>(saque)
      : erro(404, 'SAQUE_NAO_ENCONTRADO', 'Saque não encontrado.')
  })

  rota('POST', `${P}/saques`, (pedido) => {
    const valor = Math.round(Number(corpoDe<{ valorCentavos: number }>(pedido).valorCentavos))
    const agora = carteira()
    if (!agora.chavePix) {
      return erro(409, 'SEM_CHAVE_PIX', 'Cadastre a chave PIX antes de pedir o saque.')
    }
    if (!Number.isFinite(valor) || valor < SAQUE_MINIMO_CENTAVOS) {
      return erro(
        400,
        'SAQUE_ABAIXO_DO_MINIMO',
        `O saque mínimo é de ${reais(SAQUE_MINIMO_CENTAVOS)}.`,
      )
    }
    if (valor > agora.saldoSacavelCentavos) {
      return erro(
        409,
        'SALDO_INSUFICIENTE',
        `O saldo liberado é de ${reais(agora.saldoSacavelCentavos)}.`,
      )
    }
    return ok<SaqueResumo>(resumoDoSaque(pedirSaque(valor)), 201)
  })

  rota('GET', `${P}/feedback/elegibilidade`, () =>
    ok({ exibir: !estadoDaCarteira.feedbackRespondido }),
  )

  rota('POST', `${P}/feedback`, (pedido) => {
    const corpo = corpoDe<{ saqueId: string; status: FeedbackSaqueRegistrado['status'] }>(pedido)
    const saqueId = String(corpo.saqueId ?? '')
    if (feedbacks.has(saqueId)) {
      return erro(409, 'FEEDBACK_JA_REGISTRADO', 'Este saque já tem resposta.')
    }
    feedbacks.add(saqueId)
    estadoDaCarteira.feedbackRespondido = true
    return ok<FeedbackSaqueRegistrado>(
      {
        id: idDe('demo-feedback', feedbacks.size),
        status: corpo.status === 'DISPENSADO' ? 'DISPENSADO' : 'RESPONDIDO',
        createdAt: agoraIso(),
      },
      201,
    )
  })

  /* --------------------------------------------------------------- indicação */

  rota('GET', `${P}/indicacao`, async () => {
    qrDaIndicacao ??= await QRCode.toDataURL(INDICACAO.link, {
      margin: 1,
      width: 640,
      color: { dark: '#10302A', light: '#FFFFFF' },
    })
    return ok<PortalIndicacao>({
      codigoIndicacao: INDICACAO.codigo,
      link: INDICACAO.link,
      qrCode: INDICACAO.qrCode,
      qrImageUrl: qrDaIndicacao,
      podeIndicar: true,
    })
  })

  rota('GET', `${P}/indicacao/metricas`, () => ok<IndicacaoMetricas>(metricasDoQr()))

  rota('GET', `${P}/indicados`, ({ query }) => {
    const status = query.get('status')
    const lista = INDICADOS.filter((i) => {
      if (!status) return true
      /* COM_ASSINATURA traz também quem assinou e cancelou. */
      if (status === 'COM_ASSINATURA') return i.status !== 'SEM_ASSINATURA'
      return i.status === status
    })
    const { itens, proximoCursor } = paginar(lista, query, 20)
    return ok<PaginaIndicadosParceiroDto>({
      data: itens.map(({ id: _id, clienteId: _cliente, ...dto }) => dto),
      meta: proximoCursor ? { total: lista.length, proximoCursor } : { total: lista.length },
    })
  })

  /* --------------------------------------------------------- cupons e resgates */

  rota('GET', `${P}/cupons`, ({ query }) => {
    const { itens, proximoCursor } = paginar(CUPONS, query, 10)
    return ok<CursorPage<CupomParceiro>>({ data: itens, meta: { proximoCursor } })
  })

  rota('GET', `${P}/resgates`, ({ query }) => {
    const { itens, proximoCursor } = paginar(RESGATES, query, 10)
    return ok<CursorPage<ResgateParceiro>>({ data: itens, meta: { proximoCursor } })
  })

  rota('POST', `${P}/cupons/validar`, (pedido) => {
    const corpo = corpoDe<{ codigo: string; canal: ResgateParceiro['canal'] }>(pedido)
    const token = String(corpo.codigo ?? '')
      .toUpperCase()
      .replace(/\s+/g, '')
    if (!/^[A-Z2-9]{6,32}$/.test(token)) {
      return erro(404, 'CUPOM_NAO_ENCONTRADO', 'Código inválido. Confira com o cliente.')
    }
    const canal = corpo.canal === 'CODIGO_MANUAL' ? 'CODIGO_MANUAL' : 'QR'
    const { cupom, resgate, tutorPrimeiroNome } = registrarResgate(token, canal)
    return ok<ValidarCupomResultado>({
      valido: true,
      resgateId: resgate.resgateId,
      canal,
      cupom: {
        id: cupom.id,
        codigo: cupom.codigo,
        titulo: cupom.titulo,
        descontoPercentual: cupom.descontoPercentual,
      },
      tutorPrimeiroNome,
    })
  })

  /* ---------------------------------------------------------- cadastro e modos */

  rota('GET', `${P}/cadastro`, () => ok<ParceiroCadastro>({ ...CADASTRO }))

  rota('PATCH', `${P}/cadastro`, (pedido) => {
    const corpo = corpoDe<ParceiroCadastroPatchPayload>(pedido)
    if ('programas' in corpo) {
      return erro(400, 'CAMPO_NAO_PERMITIDO', 'Programas mudam pela tela de programas.')
    }
    if (corpo.nome !== undefined) CADASTRO.nome = String(corpo.nome).trim() || CADASTRO.nome
    if (corpo.categorias?.length) {
      CADASTRO.categorias = [...corpo.categorias]
      CADASTRO.categoria = corpo.categorias[0] ?? null
    }
    if (corpo.cnpj !== undefined) CADASTRO.cnpj = corpo.cnpj ? corpo.cnpj.replace(/\D/g, '') : null
    if (corpo.telefoneComercial !== undefined) CADASTRO.telefoneComercial = corpo.telefoneComercial
    if (corpo.crmv !== undefined) CADASTRO.crmv = corpo.crmv
    if (corpo.logoUrl !== undefined) CADASTRO.logoUrl = corpo.logoUrl
    return ok<ParceiroCadastro>({ ...CADASTRO })
  })

  rota('POST', `${P}/cadastro`, () =>
    erro(409, 'PARCEIRO_CADASTRO_JA_EXISTE', 'Esta conta já tem uma empresa cadastrada.', {
      reason: 'PARCEIRO_CADASTRO_JA_EXISTE',
    }),
  )

  rota('POST', `${P}/modos/:modo/solicitar`, () =>
    erro(409, 'PARCEIRO_MODO_JA_SOLICITADO', 'Este programa já está ativo para a empresa.', {
      reason: 'PARCEIRO_MODO_JA_SOLICITADO',
    }),
  )
}

/* ======================================================================== equipe */

function equipeAgora(): EquipeParceiroDto {
  return {
    membros: MEMBROS.map((m) => ({ ...m, papeisOperacionais: [...m.papeisOperacionais] })),
    convites: CONVITES.filter((c) => !c.expiraEm || !jaPassou(c.expiraEm)).map(
      ({ nome: _nome, ...c }) => c,
    ),
  }
}

function membro(usuarioId: string) {
  return MEMBROS.find((m) => m.usuarioId === usuarioId) ?? null
}

function semMembro() {
  return erro(404, 'EQUIPE_MEMBRO_NAO_ENCONTRADO', 'Essa pessoa não está na equipe.')
}

function registrarEquipe() {
  const E = `${P}/equipe`

  rota('GET', E, () => ok<EquipeParceiroDto>(equipeAgora()))

  rota('POST', `${E}/convites`, (pedido) => {
    const corpo = corpoDe<{ email: string; papel: 'DONO' | 'OPERADOR' }>(pedido)
    const email = String(corpo.email ?? '')
      .trim()
      .toLowerCase()
    if (MEMBROS.some((m) => m.email?.toLowerCase() === email)) {
      return erro(409, 'EQUIPE_JA_MEMBRO', 'Esse e-mail já é de alguém da equipe.')
    }
    if (CONVITES.some((c) => c.email?.toLowerCase() === email)) {
      return erro(
        409,
        'CONVITE_JA_PENDENTE',
        'Já existe um convite esperando resposta para esse e-mail.',
      )
    }
    const criadoEm = agoraIso()
    const convite: ConviteDaDemo = {
      id: idDe('demo-convite', CONVITES.length + 10),
      email,
      papel: corpo.papel === 'DONO' ? 'DONO' : 'OPERADOR',
      criadoEm,
      expiraEm: somarMinutos(criadoEm, 7 * 24 * 60),
      nome: null,
    }
    CONVITES.push(convite)
    return ok<ConviteCriadoDto>(
      {
        conviteId: convite.id,
        papel: convite.papel,
        status: 'PENDENTE',
        expiraEm: convite.expiraEm as string,
      },
      201,
    )
  })

  rota('DELETE', `${E}/convites/:id`, ({ params }) => {
    const indice = CONVITES.findIndex((c) => c.id === params.id)
    if (indice < 0) return erro(404, 'CONVITE_NAO_ENCONTRADO', 'Convite não encontrado.')
    CONVITES.splice(indice, 1)
    return vazio()
  })

  rota('POST', `${E}/convites/:id/reenviar`, ({ params }) => {
    const convite = CONVITES.find((c) => c.id === params.id)
    if (!convite) return erro(404, 'CONVITE_NAO_ENCONTRADO', 'Convite não encontrado.')
    convite.expiraEm = somarMinutos(agoraIso(), 7 * 24 * 60)
    return ok<ConviteCriadoDto>({
      conviteId: convite.id,
      papel: convite.papel,
      status: 'PENDENTE',
      expiraEm: convite.expiraEm,
    })
  })

  rota('PATCH', `${E}/:usuarioId`, (pedido) => {
    const alvo = membro(pedido.params.usuarioId ?? '')
    if (!alvo) return semMembro()
    const papel =
      corpoDe<{ papel: 'DONO' | 'OPERADOR' }>(pedido).papel === 'DONO' ? 'DONO' : 'OPERADOR'
    if (
      alvo.papel === 'DONO' &&
      papel === 'OPERADOR' &&
      MEMBROS.filter((m) => m.papel === 'DONO').length === 1
    ) {
      return erro(409, 'EQUIPE_ULTIMO_DONO', 'A empresa precisa de pelo menos um dono.')
    }
    alvo.papel = papel
    return ok<MembroAtualizadoDto>({
      usuarioId: alvo.usuarioId,
      nome: alvo.nome,
      papel: alvo.papel,
      desde: alvo.desde,
    })
  })

  rota('DELETE', `${E}/:usuarioId`, ({ params }) => {
    const indice = MEMBROS.findIndex((m) => m.usuarioId === params.usuarioId)
    if (indice < 0) return semMembro()
    if (params.usuarioId === USUARIO_ID) {
      return erro(409, 'EQUIPE_ULTIMO_DONO', 'Para sair da empresa, use "Sair da equipe".')
    }
    MEMBROS.splice(indice, 1)
    return vazio()
  })

  rota('POST', `${E}/sair`, () =>
    MEMBROS.filter((m) => m.papel === 'DONO').length <= 1
      ? erro(409, 'EQUIPE_ULTIMO_DONO', 'Passe o papel de dono a outra pessoa antes de sair.')
      : vazio(),
  )

  rota('PUT', `${E}/:usuarioId/papeis`, (pedido) => {
    const alvo = membro(pedido.params.usuarioId ?? '')
    if (!alvo) return semMembro()
    const papeis = corpoDe<{ papeisOperacionais: PapelOperacional[] }>(pedido).papeisOperacionais
    alvo.papeisOperacionais = [...new Set(papeis ?? [])]
    return ok<PapeisDoMembroDto>({
      usuarioId: alvo.usuarioId,
      papel: alvo.papel,
      papeisOperacionais: [...alvo.papeisOperacionais],
    })
  })

  /* Quem entra já é da equipe: a caixa de convites está vazia. */
  rota('GET', `${E}/meus-convites`, () => ok<MeuConviteDto[]>([]))
  rota('POST', `${E}/meus-convites/:id/aceitar`, () =>
    erro(404, 'CONVITE_NAO_ENCONTRADO', 'Convite não encontrado.'),
  )
  rota('POST', `${E}/meus-convites/:id/recusar`, () => vazio())

  rota('POST', `${E}/convites/previa-por-link`, () =>
    ok<PreviaConviteDto>({
      conviteId: CONVITES[0]?.id ?? 'demo-convite-ana',
      parceiro: { id: PARCEIRO_ID, nome: PARCEIRO_NOME, logoUrl: null },
      papel: 'OPERADOR',
      convidadoPorNome: membro(USUARIO_ID)?.nome ?? null,
      expiraEm: somarMinutos(agoraIso(), 5 * 24 * 60),
      contaConectada: { jaFazParte: true, papelAtual: 'DONO', paraEstaConta: false },
    }),
  )
  rota('POST', `${E}/convites/aceitar-por-link`, () =>
    ok<ConviteAceitoDto>({ parceiroId: PARCEIRO_ID, papel: 'DONO', jaEraMembro: true }),
  )
  rota('POST', `${E}/convites/recusar-por-link`, () => vazio())
}

/* ================================================================= profissionais */

function registrarProfissionais() {
  const B = `${P}/profissionais`

  rota('GET', B, ({ query }) => {
    const ativo = query.get('ativo')
    const naAgenda = query.get('atendeNaAgenda')
    return ok<Profissional[]>(
      PROFISSIONAIS.filter(
        (p) =>
          (ativo == null || String(p.ativo) === ativo) &&
          (naAgenda == null || String(p.atendeNaAgenda) === naAgenda),
      ).map((p) => ({ ...p, especialidades: [...p.especialidades] })),
    )
  })

  function conferir(dados: DadosDoProfissional, id: string | null) {
    if (dados.conselho === 'CRMV' && (!dados.registro?.trim() || !dados.uf?.trim())) {
      return erro(400, 'PROFISSIONAL_REGISTRO_INCOMPLETO', 'Informe o número e a UF do CRMV.')
    }
    if (
      dados.registro &&
      PROFISSIONAIS.some(
        (p) => p.id !== id && p.registro === dados.registro?.trim() && p.uf === dados.uf,
      )
    ) {
      return erro(409, 'PROFISSIONAL_DUPLICADO', 'Já existe um profissional com este registro.')
    }
    if (dados.usuarioId && !membro(dados.usuarioId)) {
      return erro(409, 'PROFISSIONAL_USUARIO_FORA_DA_EQUIPE', 'Essa pessoa não está na equipe.')
    }
    return null
  }

  rota('POST', B, (pedido) => {
    const dados = corpoDe<DadosDoProfissional>(pedido) as DadosDoProfissional
    const falha = conferir(dados, null)
    if (falha) return falha
    const novo: Profissional = {
      id: idDe('demo-prof-novo', PROFISSIONAIS.length + 1),
      nome: String(dados.nome ?? '').trim(),
      conselho: dados.conselho ?? 'CRMV',
      registro: dados.registro?.trim() || null,
      uf: dados.uf ?? null,
      crmvConferidoEm: null,
      especialidades: dados.especialidades ?? [],
      corIndice: dados.corIndice ?? PROFISSIONAIS.length % 8,
      atendeNaAgenda: dados.atendeNaAgenda ?? true,
      ativo: true,
      usuarioId: dados.usuarioId ?? null,
    }
    PROFISSIONAIS.push(novo)
    return ok<Profissional>(novo, 201)
  })

  rota('PATCH', `${B}/:id`, (pedido) => {
    const alvo = profissional(pedido.params.id ?? '')
    if (!alvo) return erro(404, 'PROFISSIONAL_NAO_ENCONTRADO', 'Profissional não encontrado.')
    const dados = corpoDe<DadosDoProfissional>(pedido) as DadosDoProfissional
    const falha = conferir({ ...alvo, ...dados }, alvo.id)
    if (falha) return falha
    /* Trocar o número, a UF ou o login tira o selo de CRMV conferido. */
    const perdeSelo =
      (dados.registro !== undefined && dados.registro !== alvo.registro) ||
      (dados.uf !== undefined && dados.uf !== alvo.uf) ||
      (dados.usuarioId !== undefined && !alvo.usuarioId && Boolean(dados.usuarioId))
    Object.assign(alvo, {
      ...(dados.nome !== undefined && { nome: dados.nome.trim() }),
      ...(dados.conselho !== undefined && { conselho: dados.conselho }),
      ...(dados.registro !== undefined && { registro: dados.registro?.trim() || null }),
      ...(dados.uf !== undefined && { uf: dados.uf }),
      ...(dados.especialidades !== undefined && { especialidades: [...dados.especialidades] }),
      ...(dados.corIndice !== undefined && { corIndice: dados.corIndice }),
      ...(dados.atendeNaAgenda !== undefined && { atendeNaAgenda: dados.atendeNaAgenda }),
      ...(dados.usuarioId !== undefined && { usuarioId: dados.usuarioId }),
      ...(dados.ativo !== undefined && { ativo: dados.ativo }),
    })
    if (perdeSelo) alvo.crmvConferidoEm = null
    return ok<Profissional>({ ...alvo })
  })

  rota('POST', `${B}/:id/desativar`, ({ params }) => {
    const alvo = profissional(params.id ?? '')
    if (!alvo) return erro(404, 'PROFISSIONAL_NAO_ENCONTRADO', 'Profissional não encontrado.')
    alvo.ativo = false
    return ok<Profissional>({ ...alvo })
  })

  rota('GET', `${B}/:id/expediente`, ({ params }) =>
    profissional(params.id ?? '')
      ? ok<Expediente>(expedienteDe(params.id ?? ''))
      : erro(404, 'PROFISSIONAL_NAO_ENCONTRADO', 'Profissional não encontrado.'),
  )

  rota('PUT', `${B}/:id/expediente`, (pedido) => {
    const id = pedido.params.id ?? ''
    if (!profissional(id)) {
      return erro(404, 'PROFISSIONAL_NAO_ENCONTRADO', 'Profissional não encontrado.')
    }
    const corpo = corpoDe<SalvarExpedienteDto>(pedido)
    const dias = corpo.dias ?? []
    const invalido = dias.some(
      (d) => d.trabalha && (!d.inicio || !d.fim || (d.fim !== '24:00' && d.inicio >= d.fim)),
    )
    if (invalido) {
      return erro(400, 'EXPEDIENTE_INVALIDO', 'O fim do expediente precisa ser depois do início.')
    }
    return ok<Expediente>(salvarExpedienteDe(id, dias, corpo.salaPadraoId))
  })
}

/* ================================================================ estabelecimento */

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

function registrarEstabelecimento() {
  const B = `${P}/estabelecimento`

  rota('GET', B, () => ok<Estabelecimento>(estabelecimento()))

  rota('PUT', B, (pedido) => {
    const dados = corpoDe<DadosDoEstabelecimento>(pedido)
    const atual = ESTADO.perfil
    ESTADO.perfil = {
      ...atual,
      nomePublico: String(dados.nomePublico ?? '').trim(),
      descricao: dados.descricao ?? null,
      idiomaDosTextos: dados.idiomaDosTextos ?? atual.idiomaDosTextos,
      fusoHorario: dados.fusoHorario ?? atual.fusoHorario,
      telefonePublico: dados.telefonePublico ?? null,
      whatsappPublico: dados.whatsappPublico ?? null,
      telefonePlantao: dados.telefonePlantao ?? null,
      emailPublico: dados.emailPublico ?? null,
      site: dados.site ?? null,
      cep: dados.cep ?? null,
      logradouro: dados.logradouro ?? null,
      numero: dados.numero ?? null,
      complemento: dados.complemento ?? null,
      bairro: dados.bairro ?? null,
      cidade: dados.cidade ?? null,
      uf: dados.uf ?? null,
      pais: dados.pais ?? 'BR',
      latitude: dados.latitude ?? null,
      longitude: dados.longitude ?? null,
      mostrarMapa: dados.mostrarMapa ?? atual.mostrarMapa,
      mostrarEndereco: dados.mostrarEndereco ?? atual.mostrarEndereco,
      mensagemForaDoHorario: dados.mensagemForaDoHorario ?? null,
      orientacaoEmergencia: dados.orientacaoEmergencia ?? null,
    }
    return ok<Estabelecimento>(estabelecimento())
  })

  rota('PUT', `${B}/horarios`, (pedido) => {
    const dias = corpoDe<{ dias: HorarioDoDia[] }>(pedido).dias ?? []
    const invalido =
      dias.length !== 7 ||
      dias.some(
        (d) =>
          !d.fechado &&
          (!d.abre || !d.fecha || !HORA.test(d.abre) || !HORA.test(d.fecha) || d.abre >= d.fecha),
      )
    if (invalido) {
      return erro(
        400,
        'ESTABELECIMENTO_HORARIO_INVALIDO',
        'Confira os horários: o fechamento vem depois da abertura.',
      )
    }
    ESTADO.horarios = dias
      .map((d) => ({
        diaSemana: d.diaSemana,
        fechado: d.fechado,
        abre: d.fechado ? null : d.abre,
        fecha: d.fechado ? null : d.fecha,
        intervaloInicio: d.fechado ? null : (d.intervaloInicio ?? null),
        intervaloFim: d.fechado ? null : (d.intervaloFim ?? null),
      }))
      .sort((a, b) => a.diaSemana - b.diaSemana)
    return ok<Estabelecimento>(estabelecimento())
  })

  rota('POST', `${B}/dias-especiais`, (pedido) => {
    const dia = corpoDe<NovoDiaEspecial>(pedido)
    if (!dia.data || !/^\d{4}-\d{2}-\d{2}$/.test(dia.data)) {
      return erro(400, 'ESTABELECIMENTO_HORARIO_INVALIDO', 'Escolha a data do dia especial.')
    }
    if (ESTADO.diasEspeciais.some((d) => d.data === dia.data)) {
      return erro(
        409,
        'ESTABELECIMENTO_DIA_ESPECIAL_JA_EXISTE',
        'Essa data já tem um dia especial.',
      )
    }
    const criado = criarDiaEspecial({
      data: dia.data,
      nome: String(dia.nome ?? '').trim(),
      fechado: Boolean(dia.fechado),
      abre: dia.fechado ? null : (dia.abre ?? null),
      fecha: dia.fechado ? null : (dia.fecha ?? null),
    })
    return ok<DiaEspecial>(criado, 201)
  })

  rota('DELETE', `${B}/dias-especiais/:id`, ({ params }) => {
    const indice = ESTADO.diasEspeciais.findIndex((d) => d.id === params.id)
    if (indice < 0) {
      return erro(
        404,
        'ESTABELECIMENTO_DIA_ESPECIAL_NAO_ENCONTRADO',
        'Dia especial não encontrado.',
      )
    }
    ESTADO.diasEspeciais.splice(indice, 1)
    return vazio()
  })

  rota('POST', `${B}/dias-especiais/remover`, (pedido) => {
    const ids = corpoDe<{ ids: string[] }>(pedido).ids ?? []
    const removidos: string[] = []
    const naoEncontrados: string[] = []
    for (const id of new Set(ids)) {
      const indice = ESTADO.diasEspeciais.findIndex((d) => d.id === id)
      if (indice < 0) {
        naoEncontrados.push(id)
      } else {
        ESTADO.diasEspeciais.splice(indice, 1)
        removidos.push(id)
      }
    }
    return ok<RemocaoDeDiasEspeciaisDto>({ removidos, naoEncontrados })
  })

  rota('POST', `${B}/dias-especiais/feriados-nacionais`, (pedido) => {
    const ano = Number(corpoDe<{ ano: number }>(pedido).ano)
    const atual = Number(hoje().slice(0, 4))
    if (!Number.isInteger(ano) || ano < atual - 1 || ano > atual + 2) {
      return erro(
        400,
        'ESTABELECIMENTO_FERIADOS_INDISPONIVEIS',
        'Os feriados desse ano ainda não estão disponíveis.',
      )
    }
    let copiados = 0
    let jaExistiam = 0
    for (const feriado of feriadosNacionais(ano)) {
      if (ESTADO.diasEspeciais.some((d) => d.data === feriado.data)) {
        jaExistiam++
        continue
      }
      criarDiaEspecial({
        data: feriado.data,
        nome: feriado.nome,
        fechado: true,
        abre: null,
        fecha: null,
      })
      copiados++
    }
    return ok<FeriadosCopiadosDto>({ copiados, jaExistiam })
  })

  rota('PUT', `${B}/slug`, (pedido) => {
    const slug = String(corpoDe<{ slug: string }>(pedido).slug ?? '')
      .trim()
      .toLowerCase()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 60) {
      return erro(400, 'ESTABELECIMENTO_SLUG_INVALIDO', 'Use letras minúsculas, números e hífen.')
    }
    if (['petjourney', 'clinica', 'hotel', 'admin'].includes(slug)) {
      return erro(409, 'ESTABELECIMENTO_SLUG_EM_USO', 'Esse endereço já está em uso.')
    }
    ESTADO.slug = slug
    return ok<Estabelecimento>(estabelecimento())
  })

  rota('POST', `${B}/publicar`, () => {
    if (pendenciasParaPublicar().length) {
      return erro(409, 'ESTABELECIMENTO_INCOMPLETO', 'Falta informação para publicar a página.')
    }
    ESTADO.perfil.publicado = true
    ESTADO.perfil.publicadoEm = agoraIso()
    return ok<Estabelecimento>(estabelecimento())
  })

  rota('POST', `${B}/despublicar`, () => {
    ESTADO.perfil.publicado = false
    return ok<Estabelecimento>(estabelecimento())
  })

  /* Sem a imagem do WFQR: a tela desenha o QR pelo endereço (a reserva dela). */
  rota('GET', `${B}/qr`, ({ query }) => {
    const tipo = query.get('tipo') === 'HOTEL' ? 'HOTEL' : 'CLINICA'
    const caminho = tipo === 'HOTEL' ? 'reservar' : 'agendar'
    return ok<QrDaPaginaPublicaDto>({
      tipo,
      url: `https://petjourney.health/${caminho}/${ESTADO.slug}`,
      qrCode: `wfqr-${ESTADO.slug}-${tipo.toLowerCase()}`,
      qrImageUrl: null,
    })
  })
}

/* ======================================================================= módulos */

const desligados = new Set<NomeDoModulo>()

function efeitoDoDesligar(modulo: NomeDoModulo): EfeitoDoDesligarDto {
  if (modulo === 'HOTEL') {
    return {
      modulo,
      agendamentosFuturos: 0,
      internacoesAbertas: 0,
      reservasFuturas: 0,
      hospedagensAbertas: 0,
      total: 0,
    }
  }
  const agora = agoraIso()
  const agendamentosFuturos = AGENDAMENTOS.filter(
    (a) =>
      ((a.status === 'AGENDADO' || a.status === 'CONFIRMADO') && a.inicio >= agora) ||
      a.status === 'AGUARDANDO' ||
      a.status === 'EM_ATENDIMENTO',
  ).length
  /* A internação é de outra área: dois internados, como o mapa da internação costuma mostrar. */
  const internacoesAbertas = 2
  return {
    modulo,
    agendamentosFuturos,
    internacoesAbertas,
    reservasFuturas: 0,
    hospedagensAbertas: 0,
    total: agendamentosFuturos + internacoesAbertas,
  }
}

function moduloDe(pedido: Pedido): NomeDoModulo | null {
  const nome = (pedido.params.modulo ?? '').toUpperCase()
  return nome === 'CLINICA' || nome === 'HOTEL' ? nome : null
}

function registrarModulos() {
  const M = `${P}/modulos/:modulo`
  const foraDaCategoria = () =>
    erro(
      409,
      'MODULO_FORA_DA_CATEGORIA',
      'O Hotel não está disponível para a categoria da empresa.',
    )

  rota('POST', `${M}/solicitar`, (pedido) => {
    const modulo = moduloDe(pedido)
    if (!modulo) return erro(404, 'MODULO_INATIVO', 'Módulo desconhecido.')
    return modulo === 'HOTEL'
      ? foraDaCategoria()
      : erro(409, 'MODULO_JA_ATIVO', 'A Clínica já está ligada.')
  })

  rota('POST', `${M}/ligar`, (pedido) => {
    const modulo = moduloDe(pedido)
    if (!modulo) return erro(404, 'MODULO_INATIVO', 'Módulo desconhecido.')
    if (modulo === 'HOTEL') return foraDaCategoria()
    if (!desligados.has(modulo)) return erro(409, 'MODULO_JA_ATIVO', 'A Clínica já está ligada.')
    desligados.delete(modulo)
    return ok<ModuloLigadoDto>({
      modulo,
      status: 'ATIVO',
      origem: 'PLANO',
      ativoAte: null,
      acao: 'RELIGADO',
    })
  })

  rota('GET', `${M}/efeito-do-desligar`, (pedido) => {
    const modulo = moduloDe(pedido)
    if (!modulo) return erro(404, 'MODULO_INATIVO', 'Módulo desconhecido.')
    return ok<EfeitoDoDesligarDto>(efeitoDoDesligar(modulo))
  })

  rota('POST', `${M}/desligar`, (pedido) => {
    const modulo = moduloDe(pedido)
    if (!modulo) return erro(404, 'MODULO_INATIVO', 'Módulo desconhecido.')
    if (modulo === 'HOTEL') return erro(409, 'MODULO_NAO_ESTA_LIGADO', 'O Hotel não está ligado.')
    if (desligados.has(modulo))
      return erro(409, 'MODULO_JA_DESLIGADO', 'A Clínica já está desligada.')
    desligados.add(modulo)
    return ok<ModuloDesligadoDto>({ modulo, status: 'DESLIGADO', efeito: efeitoDoDesligar(modulo) })
  })
}

/* ===================================================================== identidade */

const VERSAO_DO_AVISO = '2026-10-31'

const VERIFICACAO_APROVADA: VerificacaoDaPessoaDto = {
  status: 'APROVADA',
  cpfMascarado: '***.418.257-**',
  nomeCompleto: 'Marina Albuquerque',
  enviadaEm: '2025-03-10T19:22:00-03:00',
  decididaEm: '2025-03-11T09:40:00-03:00',
  motivoDecisao: 'Documento e selfie conferidos.',
  revogadaEm: null,
  motivoRevogacao: null,
  motivoDoSistema: null,
  analiseExpiraEm: null,
}

let verificacao: VerificacaoDaPessoaDto = VERIFICACAO_APROVADA

function identidade(): IdentidadeDaPessoaDto {
  const aprovada = verificacao.status === 'APROVADA'
  return {
    verificacao: { ...verificacao },
    exigencias: [
      {
        parceiroId: PARCEIRO_ID,
        nome: PARCEIRO_NOME,
        categoria: 'CLINICA_VETERINARIA',
        categorias: ['CLINICA_VETERINARIA'],
        itens: [
          { item: 'IDENTIDADE', obrigatorio: true, ok: aprovada },
          { item: 'CNPJ', obrigatorio: true, ok: true },
          { item: 'CRMV', obrigatorio: true, ok: true },
        ],
      },
    ],
    consentimentoVersaoAtual: VERSAO_DO_AVISO,
  }
}

function registrarIdentidade() {
  const B = `${P}/eu/identidade`

  rota('GET', B, () => ok<IdentidadeDaPessoaDto>(identidade()))

  rota('GET', `${B}/consentimento/:versao`, ({ params }) =>
    ok<ConsentimentoDaIdentidadeDto>({
      versao: params.versao ?? VERSAO_DO_AVISO,
      vigente: params.versao === VERSAO_DO_AVISO,
      tipo: 'AVISO',
      titulo: 'Como usamos o seu documento e a sua selfie',
      botao: 'Li e entendi, enviar',
      idioma: 'pt-BR',
      finalidade:
        'Confirmar que é você quem assina receitas, prontuários e documentos clínicos na PetJourney.',
      texto:
        'Uma pessoa da equipe da PetJourney confere o documento com foto, a selfie segurando o documento e o CPF. A conferência serve só para liberar a sua assinatura nos atos clínicos.\n\nOs arquivos ficam guardados de forma restrita e saem do sistema assim que a análise termina. O resultado fica registrado na sua conta e vale em todas as empresas em que você trabalha.\n\nVocê pode cancelar o envio enquanto ele estiver em análise.',
    }),
  )

  rota('POST', B, () => {
    if (verificacao.status === 'APROVADA') {
      return erro(409, 'IDENTIDADE_JA_APROVADA', 'A sua identidade já está aprovada.')
    }
    if (verificacao.status === 'EM_ANALISE') {
      return erro(409, 'IDENTIDADE_JA_EM_ANALISE', 'Já existe um envio em análise.')
    }
    const enviadaEm = agoraIso()
    verificacao = {
      ...VERIFICACAO_APROVADA,
      status: 'EM_ANALISE',
      enviadaEm,
      decididaEm: null,
      motivoDecisao: null,
      analiseExpiraEm: somarMinutos(enviadaEm, 14 * 24 * 60),
    }
    return ok<IdentidadeDaPessoaDto>(identidade(), 201)
  })

  rota('DELETE', B, () => {
    if (verificacao.status !== 'EM_ANALISE') {
      return erro(409, 'IDENTIDADE_SEM_ENVIO_EM_ANALISE', 'Não há envio em análise para cancelar.')
    }
    verificacao = { ...verificacao, status: 'CANCELADA', decididaEm: agoraIso() }
    return vazio()
  })
}

/* ===================================================================== emergência */

type FichaDaTabela = Pick<FichaDeEmergenciaDto, 'alergias' | 'tratamentosContinuos' | 'condicoes'>
type CondicaoDaFicha = FichaDeEmergenciaDto['condicoes'][number]

/** O título que a API monta (contrato de 24/11): "Rótulo: subtipo"; nunca "Outra". */
const ROTULO_DA_CONDICAO: Partial<Record<CondicaoDaFicha['categoria'], string>> = {
  DERMATOLOGICA: 'Dermatológica',
  RENAL: 'Renal',
  CARDIO: 'Cardíaca',
  FIV: 'FIV',
  ENDOCRINA: 'Endócrina',
}

function condicao(
  categoria: CondicaoDaFicha['categoria'],
  subtipo: string | null,
): CondicaoDaFicha {
  const rotulo = ROTULO_DA_CONDICAO[categoria]
  const titulo = rotulo && subtipo ? `${rotulo}: ${subtipo}` : (subtipo ?? rotulo ?? '')
  return { categoria, subtipo, tituloCompleto: titulo, tituloCurto: titulo.slice(0, 48) }
}

/** A ficha curta dos pets com o que importa numa emergência. */
const FICHAS: Record<string, FichaDaTabela> = {
  'demo-pac-005': {
    alergias: [
      {
        gatilho: 'Dipirona',
        categoria: 'MEDICAMENTOSA',
        reacao: 'Inchaço no focinho e vômito',
        severidade: 'GRAVE',
      },
      { gatilho: 'Picada de pulga', categoria: 'INSETO', reacao: 'Dermatite', severidade: 'LEVE' },
    ],
    tratamentosContinuos: [],
    condicoes: [condicao('DERMATOLOGICA', 'Dermatite atópica')],
  },
  'demo-pac-007-2': {
    alergias: [],
    tratamentosContinuos: [
      {
        medicamento: 'Benazepril',
        dose: '1,25',
        unidade: 'mg',
        frequencia: '1x ao dia',
        via: 'Oral',
      },
      {
        medicamento: 'Ipakitine',
        dose: '1',
        unidade: 'medida',
        frequencia: '2x ao dia',
        via: 'Oral',
      },
    ],
    condicoes: [condicao('RENAL', 'Doença renal crônica, estágio 2')],
  },
  'demo-pac-010': {
    alergias: [
      {
        gatilho: 'Frango',
        categoria: 'ALIMENTAR',
        reacao: 'Coceira e otite',
        severidade: 'MODERADA',
      },
    ],
    tratamentosContinuos: [
      {
        medicamento: 'Pimobendan',
        dose: '2,5',
        unidade: 'mg',
        frequencia: 'A cada 12 horas',
        via: 'Oral',
      },
    ],
    condicoes: [condicao('CARDIO', 'Doença da valva mitral, estágio B2')],
  },
  'demo-pac-024': {
    alergias: [],
    tratamentosContinuos: [],
    condicoes: [condicao('FIV', null), condicao('OUTRA', 'Gengivoestomatite crônica')],
  },
  'demo-pac-039': {
    alergias: [],
    tratamentosContinuos: [
      {
        medicamento: 'Metimazol',
        dose: '2,5',
        unidade: 'mg',
        frequencia: 'A cada 12 horas',
        via: 'Oral',
      },
    ],
    condicoes: [condicao('ENDOCRINA', 'Hipertireoidismo')],
  },
  'demo-pac-008': {
    alergias: [],
    tratamentosContinuos: [],
    condicoes: [condicao('OUTRA', 'Síndrome braquicefálica: cuidado na sedação')],
  },
}

let aberturas = 0

function registrarEmergencia() {
  rota('POST', `${P}/emergencia/ficha`, (pedido) => {
    const corpo = corpoDe<{ publicSlug: string; motivo: string }>(pedido)
    const motivo = String(corpo.motivo ?? '').trim()
    if (motivo.length < 10 || motivo.length > 300) {
      return erro(400, 'MOTIVO_OBRIGATORIO', 'O motivo precisa ter de 10 a 300 caracteres.')
    }
    const ids = Object.keys(FICHAS)
    let soma = 0
    for (const letra of String(corpo.publicSlug ?? '')) soma += letra.charCodeAt(0)
    const pacienteId = ids[soma % ids.length] as string
    const p = paciente(pacienteId)
    const ficha = FICHAS[pacienteId]
    if (!p || !ficha) {
      return erro(404, 'EMERGENCIA_FICHA_INDISPONIVEL', 'A ficha deste pet não está disponível.')
    }
    return ok<FichaDeEmergenciaDto>({
      acessoId: idDe('demo-emergencia', ++aberturas),
      petNome: p.nome,
      foto: p.fotoUrl,
      especie: p.especie,
      tipoEspecie: p.especie === 'OUTRO' ? p.especieOutra : null,
      sexo: p.sexo,
      castrado: p.castrado,
      nascimento: p.nascimento,
      peso: p.pesoKg ? { kg: p.pesoKg, em: somarMinutos(agoraIso(), -21 * 24 * 60) } : null,
      ...ficha,
      avisosDeManejo: [],
      avisosDeManejoLabels: [],
      avisoDeManejoObs: null,
    })
  })
}

/* ====================================================================== acessos */

const ORDEM_DO_STATUS: Record<string, (s: string) => boolean> = {
  ATIVO: (s) => s === 'ATIVO',
  EXPIRADO: (s) => s === 'EXPIRADO',
  REVOGADO: (s) => s === 'REVOGADO',
  ENCERRADO: (s) => s === 'EXPIRADO' || s === 'REVOGADO',
}

function listarAcessos(query: URLSearchParams): CompartilhamentoResumo[] {
  const status = query.get('status')
  const busca = normalizar(query.get('q'))
  const especie = query.get('especie')
  const tipo = query.get('tipoServico')
  const comProntuario = query.get('comProntuario') === 'true'
  const de = query.get('vinculadoDe')
  const ate = query.get('vinculadoAte')
  const ordem = query.get('ordenarPor') ?? 'recentes'

  const lista = ACESSOS.filter((a) => {
    const s = statusDoAcesso(a)
    if (status && !(ORDEM_DO_STATUS[status]?.(s) ?? false)) return false
    if (especie && paciente(a.pacienteId)?.especie !== especie) return false
    if (tipo && a.tipoServico !== tipo) return false
    if (busca && !normalizar(paciente(a.pacienteId)?.nome).includes(busca)) return false
    if (comProntuario && !a.categorias.some((c) => c === 'DIARIO' || c === 'DOCUMENTOS'))
      return false
    if (de && Date.parse(a.vinculadoEm) < Date.parse(de)) return false
    if (ate && Date.parse(a.vinculadoEm) > Date.parse(ate)) return false
    return true
  }).map(resumoDoAcesso)

  if (ordem === 'nome') {
    lista.sort(
      (a, b) =>
        a.petNome.localeCompare(b.petNome, 'pt-BR') || b.vinculadoEm.localeCompare(a.vinculadoEm),
    )
  } else if (ordem === 'expiraEm') {
    lista.sort((a, b) => a.expiraEm.localeCompare(b.expiraEm))
  } else {
    lista.sort((a, b) => b.vinculadoEm.localeCompare(a.vinculadoEm))
  }
  return lista
}

function acessoOu404(id: string | undefined) {
  return acesso(id ?? '')
}

const semAcesso = () => erro(404, 'COMPARTILHAMENTO_NAO_ENCONTRADO', 'Acesso não encontrado.')

const encerrado = () =>
  erro(
    409,
    'COMPARTILHAMENTO_ENCERRADO',
    'Este acesso já foi encerrado pelo responsável ou venceu.',
  )

let propostas = 0

function registrarAcessos() {
  const C = `${P}/compartilhamentos`

  rota('GET', C, ({ query }) => {
    const { itens, proximoCursor } = paginar(listarAcessos(query), query, 20)
    return ok<CursorPage<CompartilhamentoResumo>>({ data: itens, meta: { proximoCursor } })
  })

  /* O cadastro está aprovado: os códigos vinculam na hora e nada fica guardado. */
  rota('GET', `${C}/reivindicacoes`, () => ok<{ itens: ReivindicacaoAcesso[] }>({ itens: [] }))

  function codigoDe(pedido: Pedido) {
    return String(corpoDe<{ codigo: string }>(pedido).codigo ?? '').replace(/\D/g, '')
  }

  rota('POST', `${C}/vincular`, (pedido) => {
    const codigo = codigoDe(pedido)
    if (!/^\d{6}$/.test(codigo)) {
      return erro(400, 'COMPARTILHAMENTO_CODIGO_INVALIDO', 'O código tem 6 números.')
    }
    const alvo = vincularPorCodigo(codigo)
    if (statusDoAcesso(alvo) !== 'ATIVO') return encerrado()
    return ok<CompartilhamentoDetalhe>(detalheDoAcesso(alvo))
  })

  rota('POST', `${C}/reivindicar`, (pedido) => {
    const codigo = codigoDe(pedido)
    if (!/^\d{6}$/.test(codigo)) {
      return erro(400, 'COMPARTILHAMENTO_CODIGO_INVALIDO', 'O código tem 6 números.')
    }
    const alvo = vincularPorCodigo(codigo)
    if (statusDoAcesso(alvo) !== 'ATIVO') return encerrado()
    return ok<ResultadoReivindicacao>({
      reivindicado: true,
      vinculado: true,
      vinculaNaAprovacao: false,
      compartilhamento: detalheDoAcesso(alvo),
    })
  })

  rota('GET', `${C}/:id`, ({ params }) => {
    const alvo = acessoOu404(params.id)
    return alvo ? ok<CompartilhamentoDetalhe>(detalheDoAcesso(alvo)) : semAcesso()
  })

  rota('POST', `${C}/:id/anotacoes`, (pedido) => {
    const alvo = acessoOu404(pedido.params.id)
    if (!alvo) return semAcesso()
    if (statusDoAcesso(alvo) !== 'ATIVO') return encerrado()
    if (!(pedido.corpo instanceof FormData)) {
      return erro(400, 'ANOTACAO_INVALIDA', 'A anotação chega como formulário.')
    }
    return ok<Anotacao>(criarAnotacaoDoFormulario(alvo, pedido.corpo), 201)
  })

  rota('POST', `${C}/:id/leitura-receita`, (pedido) => {
    const alvo = acessoOu404(pedido.params.id)
    if (!alvo) return semAcesso()
    if (statusDoAcesso(alvo) !== 'ATIVO') return encerrado()
    if (alvo.tipoServico !== 'CONSULTA') {
      return erro(400, 'LEITURA_RECEITA_TIPO', 'A leitura de receita é só para acesso de consulta.')
    }
    const arquivos =
      pedido.corpo instanceof FormData
        ? pedido.corpo.getAll('arquivos').filter((f): f is File => f instanceof File)
        : []
    if (!arquivos.length) {
      return erro(400, 'LEITURA_RECEITA_SEM_ARQUIVO', 'Mande a foto ou o PDF da receita.')
    }
    return ok<LeituraReceitaCriada>(
      { id: criarLeitura(alvo.id, arquivos), status: 'PROCESSANDO' },
      201,
    )
  })

  rota('GET', `${C}/:id/leitura-receita/:leituraId`, ({ params }) => {
    const leitura = LEITURAS.get(params.leituraId ?? '')
    if (!leitura || leitura.acessoId !== params.id) {
      return erro(404, 'LEITURA_RECEITA_NAO_ENCONTRADA', 'Leitura não encontrada.')
    }
    return ok<LeituraReceitaParceiro>(leituraAgora(leitura))
  })

  rota('GET', `${C}/:id/anexos/:anexoId/url`, ({ params }) => {
    if (!acessoOu404(params.id)) return semAcesso()
    const url = arquivoParaAbrir('anexo', params.anexoId ?? '')
    return url
      ? ok({ signedUrl: url, expiresIn: 900 })
      : erro(404, 'ANEXO_NAO_ENCONTRADO', 'Arquivo não encontrado.')
  })

  rota('GET', `${C}/:id/arquivos/:arquivoId/url`, ({ params }) => {
    const alvo = acessoOu404(params.id)
    if (!alvo) return semAcesso()
    if (statusDoAcesso(alvo) !== 'ATIVO') return encerrado()
    const url = arquivoParaAbrir('arquivo', params.arquivoId ?? '')
    return url
      ? ok({ signedUrl: url, expiresIn: 900 })
      : erro(404, 'ARQUIVO_NAO_ENCONTRADO', 'Arquivo não encontrado.')
  })

  rota('POST', `${C}/:id/propor-vinculo`, ({ params }) => {
    const alvo = acessoOu404(params.id)
    if (!alvo) return semAcesso()
    if (statusDoAcesso(alvo) !== 'ATIVO') return encerrado()
    return ok<PropostaEnviadaDto>({ propostaId: idDe('demo-proposta-acesso', ++propostas) }, 201)
  })

  rota('POST', `${P}/vinculos/por-qr`, () =>
    ok<PropostaEnviadaDto>({ propostaId: idDe('demo-proposta-qr', ++propostas) }, 201),
  )

  rota('GET', '/diario-pet/enums', () => ok<CatalogoDiario>(CATALOGO_DO_DIARIO))
}

/* ================================================================ perfil e conta */

/** A foto enviada fica no navegador; a URL "pública" só existe para passar pelo serviço. */
const FOTOS = new Map<string, string>()

function perfilDe(usuarioId: string): UsuarioProfile | null {
  if (usuarioId === USUARIO_ID) return PERFIL_DO_USUARIO
  const pessoa = EQUIPE.find((p) => p.usuarioId === usuarioId)
  if (!pessoa) return null
  return {
    id: pessoa.usuarioId,
    email: pessoa.email,
    nome: pessoa.nome,
    telefone: pessoa.telefone,
    telefoneWhatsApp: pessoa.telefone,
    cpf: null,
    ativo: true,
    veterinarioPerfil: null,
  }
}

function registrarConta() {
  rota('GET', '/usuario/allInformations/:id', ({ params }) => {
    const perfil = perfilDe(params.id ?? '')
    return perfil
      ? ok<UsuarioProfile>(perfil)
      : erro(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.')
  })

  rota('PATCH', '/usuario/:id', (pedido) => {
    const perfil = perfilDe(pedido.params.id ?? '')
    if (!perfil) return erro(404, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado.')
    const dados = corpoDe<UpdateUsuarioPayload>(pedido)
    if (dados.nome !== undefined) perfil.nome = dados.nome.trim() || perfil.nome
    if (dados.telefone !== undefined) perfil.telefone = dados.telefone || null
    if (dados.telefoneWhatsApp !== undefined)
      perfil.telefoneWhatsApp = dados.telefoneWhatsApp || null
    if (dados.cpf !== undefined) perfil.cpf = dados.cpf || null
    if (dados.veterinario) {
      const vet = (perfil.veterinarioPerfil ??= { id: `demo-vet-${perfil.id}` })
      if (dados.veterinario.crmv !== undefined) vet.crmv = dados.veterinario.crmv || null
      if (dados.veterinario.especialidade !== undefined) {
        vet.especialidade = dados.veterinario.especialidade || null
      }
      if (dados.veterinario.foto !== undefined) {
        vet.foto = FOTOS.get(dados.veterinario.foto) ?? (dados.veterinario.foto || null)
      }
    }
    return ok<UsuarioProfile>(perfil)
  })

  rota('POST', '/upload/file-usuario', (pedido) => {
    const arquivo = pedido.corpo instanceof FormData ? pedido.corpo.get('file') : null
    if (!(arquivo instanceof File)) return erro(400, 'ARQUIVO_OBRIGATORIO', 'Escolha um arquivo.')
    const publica = `https://arquivos.demonstracao.example.com/usuario/${FOTOS.size + 1}-${encodeURIComponent(arquivo.name)}`
    FOTOS.set(publica, URL.createObjectURL(arquivo))
    return ok({ url: publica }, 201)
  })

  rota('GET', '/users/me/inactive-reasons', () =>
    ok([
      { id: 'demo-motivo-1', label: 'Não uso mais a PetJourney', isCustomAllowed: false },
      { id: 'demo-motivo-2', label: 'Mudei de clínica ou de profissão', isCustomAllowed: false },
      { id: 'demo-motivo-3', label: 'Tive dificuldade para usar', isCustomAllowed: false },
      { id: 'demo-motivo-4', label: 'Preocupação com os meus dados', isCustomAllowed: false },
      {
        id: 'demo-motivo-5',
        label: 'Outro motivo',
        description: 'Conte em poucas palavras.',
        isCustomAllowed: true,
      },
    ]),
  )

  rota('POST', '/auth/reset-password-authenticated', () => ok({ alterada: true }))
}

/* ========================================================================= avisos */

function naoLidas() {
  return AVISOS.filter((a) => !a.lidaEm).length
}

function registrarAvisos() {
  /* Todos os avisos são desta clínica, e a dona não tem perfil de responsável no app. */
  rota('GET', '/notificacao', ({ query }) => {
    const { itens, proximoCursor } = paginar(AVISOS, query, 20)
    const total = naoLidas()
    return ok<PaginaDeAvisos>({ itens, proximoCursor, naoLidas: total, naoLidasDoParceiro: total })
  })

  rota('PATCH', '/notificacao/:id/toque', ({ params }) => {
    lerAviso(params.id ?? '')
    return ok({ naoLidas: naoLidas() })
  })

  rota('PATCH', '/notificacao/:id/read', ({ params }) => {
    const aviso = lerAviso(params.id ?? '')
    if (!aviso) return erro(404, 'NOTIFICACAO_NAO_ENCONTRADA', 'Aviso não encontrado.')
    return ok({ id: aviso.id, lidaEm: aviso.lidaEm as string, naoLidas: naoLidas() })
  })
}

/* ======================================================================== registro */

export function registrarPortal() {
  registrarCarteira()
  registrarEquipe()
  registrarProfissionais()
  registrarEstabelecimento()
  registrarModulos()
  registrarIdentidade()
  registrarEmergencia()
  registrarAcessos()
  registrarConta()
  registrarAvisos()
}
