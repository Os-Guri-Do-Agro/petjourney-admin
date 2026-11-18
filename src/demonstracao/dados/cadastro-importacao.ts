/**
 * A importação da base da clínica (o migrador), em memória.
 *
 * O histórico tem duas: a planilha do hotel que a clínica descartou e a exportação do SimplesVet que
 * entrou há três semanas (o relatório aponta para os pacientes da base). Uma importação nova vai até
 * o fim: o portal manda cada célula como está; aqui as linhas são lidas pelo mesmo leitor da
 * demonstração antiga (`lerRegistros`, que conhece telefone sem nono dígito, data do Excel, peso em
 * gramas...) e o plano junta quem se repete, acha quem já é cliente e faz as perguntas que só a
 * clínica responde. Confirmar grava de verdade: os clientes e pacientes novos entram na base (e
 * aparecem na lista); desfazer tira o que ninguém usou.
 *
 * A gravação e o desfazer andam pelo relógio (uns 8 e 4 segundos), como o job do servidor.
 *
 * Exporta, para as agregadoras: `importacoesParadas()` (pausada ou parada no meio: a pendência
 * `importacoesPausadas`) e `importacoes()`.
 */
import { CODIGOS_DE_DESCARTE, CODIGOS_DE_FORA } from '@/components/importacao/leitura-da-importacao'
import type { PetSpecies } from '@/features/clinico/data/types'
import {
  CAMPOS_DO_ANIMAL,
  CAMPOS_DO_RESPONSAVEL,
  lerRegistros,
  normalizarRotulo,
  type Ajuste,
  type CampoDeDestino,
  type MapeamentoDaColuna,
  type Padronizacao,
  type RegistroDaLinha,
  type TipoDeAjuste,
} from '@/features/clinico/domain/migracao'
import type { PlanilhaLida } from '@/features/clinico/domain/planilha'
import type {
  AjusteDaLinha,
  CodigoDaLinha,
  DestinoDaLinha,
  Duvida,
  Importacao,
  LadoDaDuvida,
  LinhaDoRelatorio,
  LinhaEnviada,
  NovaImportacao,
  PropostasEmLote,
  RespostaDaDuvida,
  ResumoDaImportacao,
} from '@/service/parceiro/importacao-service'

import { agendamentosDoPaciente } from '../base/agenda'
import {
  CLIENTES,
  PACIENTES,
  cliente,
  paciente,
  pacientesDoCliente,
  type ClienteDaDemo,
  type PacienteDaDemo,
} from '../base/cadastro'
import { agoraIso, hoje, instante, somarDias } from '../relogio'
import {
  cancelarPropostasDoCliente,
  criarProposta,
  propostasDoCliente,
  vinculoDe,
} from './cadastro'

type Especie = PacienteDaDemo['especie']

/* -------------------------------------------------------------------------------- tipos */

type Grupo = {
  chave: number
  nome: string
  telefones: string[]
  email: string
  cpf: string
  linhas: number[]
  registro: RegistroDaLinha
  complemento: string
  codigo: string
  clienteId: string | null
  juncao: CodigoDaLinha | null
  pendente: boolean
  fora: boolean
}

type ItemDoPlano = LinhaDoRelatorio & {
  grupo: Grupo | null
  registro: RegistroDaLinha
  enviada: LinhaEnviada
  especie: Especie | null
  especieOutra: string | null
}

type Plano = {
  itens: ItemDoPlano[]
  duvidas: Duvida[]
  padronizacoes: Record<Padronizacao, number>
}

type Undo = () => void

type Desfazer = {
  desfechos: Map<number, NonNullable<LinhaDoRelatorio['desfecho']>>
  pacientes: string[]
  clientes: string[]
  preenchimentos: Undo[]
  ficaram: number
}

type ImportacaoDaDemo = {
  dto: Importacao
  hash: string
  ddd: string
  linhas: LinhaEnviada[]
  respostas: Map<string, RespostaDaDuvida>
  plano: Plano | null
  relatorio: LinhaDoRelatorio[] | null
  /** O relógio do job: quando andou pela última vez e quanto já tinha feito. */
  job: { desde: number; feitas: number } | null
  pausouNoDesfazer: boolean
  desfazer: Desfazer | null
  gravados: { clientes: string[]; pacientes: string[]; preenchimentos: Undo[] }
}

const SEGUNDOS_DA_GRAVACAO = 8
const SEGUNDOS_DO_DESFAZER = 4

/* ------------------------------------------------------------------------------ apoio */

const ESPECIE_DO_DOMINIO: Record<PetSpecies, Especie> = {
  canina: 'CACHORRO',
  felina: 'GATO',
  ave: 'AVE',
  roedor: 'ROEDOR',
  reptil: 'REPTIL',
  equina: 'OUTRO',
}

const TIPO_DA_API: Record<Exclude<TipoDeAjuste, 'nao-reconhecido'>, CodigoDaLinha> = {
  'data-ano-curto': 'DATA_ANO_CURTO',
  'data-da-planilha': 'DATA_DA_PLANILHA',
  'data-americana': 'DATA_AMERICANA',
  'data-sem-dia': 'DATA_SEM_DIA',
  'nascimento-pela-idade': 'NASCIMENTO_PELA_IDADE',
  'peso-em-gramas': 'PESO_EM_GRAMAS',
  'telefone-nono-digito': 'TELEFONE_NONO_DIGITO',
  'telefone-ddd-da-clinica': 'TELEFONE_SEM_DDD_CORRIGIDO',
  'telefone-dividido': 'TELEFONE_DIVIDIDO',
  'cpf-zeros': 'CPF_ZEROS',
  'cep-zero': 'CEP_ZERO',
  'especie-pela-raca': 'ESPECIE_PELA_RACA',
  'especie-escolhida': 'ESPECIE_ESCOLHIDA',
  'celula-mesclada': 'CELULA_MESCLADA',
  'responsavel-da-linha-anterior': 'RESPONSAVEL_DA_LINHA_ANTERIOR',
  'data-invalida': 'DATA_INVALIDA',
  'data-futura': 'DATA_FUTURA',
  'idade-invalida': 'IDADE_INVALIDA',
  'peso-invalido': 'PESO_INVALIDO',
  'telefone-invalido': 'TELEFONE_INVALIDO',
  'cpf-invalido': 'CPF_INVALIDO',
  'email-invalido': 'EMAIL_INVALIDO',
  'cep-invalido': 'CEP_INVALIDO',
  'uf-invalida': 'UF_INVALIDA',
  'microchip-invalido': 'MICROCHIP_INVALIDO',
  'microchip-cientifico': 'MICROCHIP_CIENTIFICO',
}

const ENTRAM: readonly DestinoDaLinha[] = ['ENTRA', 'JUNTA_EXISTENTE', 'JUNTA_LINHA', 'CONTATO']

const CAMPOS: CampoDeDestino[] = [...CAMPOS_DO_RESPONSAVEL, ...CAMPOS_DO_ANIMAL]

/** Telefone como a API guarda: só dígitos, com o 55. */
function telefoneDaApi(texto: string) {
  const digitos = texto.replace(/\D/g, '')
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos
}

/** Os últimos 10 ou 11 dígitos, para comparar telefones com e sem o 55. */
function finalDoTelefone(digitos: string | null | undefined) {
  const so = (digitos ?? '').replace(/\D/g, '')
  return so.startsWith('55') && so.length >= 12 ? so.slice(2) : so
}

function primeiroNome(nome: string) {
  return normalizarRotulo(nome).split(' ')[0] ?? ''
}

function ajusteDaApi(a: Ajuste): AjusteDaLinha {
  const tipo: CodigoDaLinha =
    a.tipo === 'nao-reconhecido'
      ? a.campo === 'sexo'
        ? 'SEXO_NAO_RECONHECIDO'
        : 'CASTRADO_NAO_RECONHECIDO'
      : TIPO_DA_API[a.tipo]
  let para = a.para
  if (para !== null) {
    if (a.campo === 'telefone' || a.campo === 'telefone2') para = telefoneDaApi(para)
    else if (a.campo === 'cpf' || a.campo === 'cep') para = para.replace(/\D/g, '')
    else if (a.campo === 'especie') para = ESPECIE_DO_DOMINIO[para as PetSpecies] ?? para
  }
  return { campo: a.campo, tipo, de: a.de, para }
}

function planilhaDe(linhas: LinhaEnviada[]): {
  planilha: PlanilhaLida
  mapeamento: MapeamentoDaColuna[]
} {
  const mescladas = new Set<string>()
  const grade = linhas.map((linha, indice) =>
    CAMPOS.map((campo, coluna) => {
      if (linha.mescladas?.includes(campo)) mescladas.add(`${indice}:${coluna}`)
      return linha.campos[campo] ?? ''
    }),
  )
  return {
    planilha: {
      arquivo: '',
      formato: 'demonstracao',
      linhaDoCabecalho: 0,
      cabecalhos: [...CAMPOS],
      linhas: grade,
      codificacao: null,
      mescladas,
    },
    mapeamento: CAMPOS.map((destino, coluna) => ({
      coluna,
      destino,
      confianca: 'certa',
      como: 'pessoa',
    })),
  }
}

/**
 * A espécie como a API decide: com a célula em branco, a raça vem antes da escolha para o em branco
 * (Poodle só pode ser cão); depois a escolha da pessoa, coelho e peixe pelo nome, e o leitor.
 */
function especieDa(
  linha: LinhaEnviada,
  registro: RegistroDaLinha,
): { especie: Especie | null; outra: string | null; escolhida: boolean } {
  const bruto = normalizarRotulo(linha.campos.especie ?? '')
  const lida = registro.animal?.especie
  const pelaLeitura = (especie: PetSpecies) => ({
    especie: ESPECIE_DO_DOMINIO[especie],
    outra: especie === 'equina' ? 'Equino' : null,
    escolhida: false,
  })
  if (!bruto && lida) return pelaLeitura(lida)
  if (linha.especieEscolhida === 'FORA') return { especie: null, outra: null, escolhida: false }
  if (linha.especieEscolhida) {
    return {
      especie: linha.especieEscolhida as Especie,
      outra: linha.especieOutra ?? null,
      escolhida: true,
    }
  }
  if (bruto.startsWith('coelh')) return { especie: 'COELHO', outra: null, escolhida: false }
  if (bruto.startsWith('peix')) return { especie: 'PEIXE', outra: null, escolhida: false }
  return lida ? pelaLeitura(lida) : { especie: null, outra: null, escolhida: false }
}

/* ---------------------------------------------------------------------------- o plano */

function planejar(imp: ImportacaoDaDemo): Plano {
  const { planilha, mapeamento } = planilhaDe(imp.linhas)
  const { registros, padronizacoes } = lerRegistros(planilha, mapeamento, {
    hoje: hoje(),
    ddd: imp.ddd,
    especies: {},
  })

  const grupos: Grupo[] = []
  const porNumero = new Map<number, ItemDoPlano>()
  const itens: ItemDoPlano[] = []
  const resposta = (id: string) => imp.respostas.get(id) ?? null
  type Pergunta =
    | { tipo: 'ORFAO'; id: string; item: ItemDoPlano; dono: Grupo; acima: number }
    | { tipo: 'MESMA_PESSOA'; id: string; motivo: Duvida['motivo']; a: Grupo; b: Grupo }
  const perguntas: Pergunta[] = []

  registros.forEach((registro, indice) => {
    const enviada = imp.linhas[indice] as LinhaEnviada
    const { especie, outra, escolhida } = especieDa(enviada, registro)
    const ajustes = registro.ajustes.map(ajusteDaApi)
    if (escolhida && enviada.especieEscolhida && registro.animal) {
      ajustes.push({
        campo: 'especie',
        tipo: 'ESPECIE_ESCOLHIDA',
        de: enviada.campos.especie ?? '',
        para: enviada.especieEscolhida,
      })
    }
    const item: ItemDoPlano = {
      numeroLinha: enviada.numeroLinha,
      destino: 'ENTRA',
      motivos: [...new Set(ajustes.map((a) => a.tipo))],
      grupoLinha: null,
      juntaComLinha: null,
      clienteId: null,
      pacienteId: null,
      gravadaEm: null,
      desfecho: null,
      camposPreenchidos: [],
      responsavel: registro.responsavel?.nome || null,
      animal: registro.animal?.nome || null,
      ajustes,
      grupo: null,
      registro,
      enviada,
      especie,
      especieOutra: outra,
    }
    itens.push(item)
    porNumero.set(item.numeroLinha, item)
  })

  const fora = (item: ItemDoPlano, codigo: CodigoDaLinha) => {
    item.destino = 'FORA'
    if (!item.motivos.includes(codigo)) item.motivos.push(codigo)
  }

  const novoGrupo = (item: ItemDoPlano): Grupo => {
    const r = item.registro.responsavel
    const g: Grupo = {
      chave: item.numeroLinha,
      nome: r?.nome ?? '',
      telefones: [r?.telefone, r?.telefoneSecundario]
        .filter(Boolean)
        .map((t) => telefoneDaApi(t as string)),
      email: r?.email ?? '',
      cpf: (r?.documento ?? '').replace(/\D/g, ''),
      linhas: [item.numeroLinha],
      registro: item.registro,
      complemento: item.enviada.campos.complemento ?? '',
      codigo: item.enviada.campos.codigoCliente ?? '',
      clienteId: null,
      juncao: null,
      pendente: false,
      fora: false,
    }
    grupos.push(g)
    return g
  }

  const juntar = (g: Grupo, item: ItemDoPlano) => {
    const r = item.registro.responsavel
    g.linhas.push(item.numeroLinha)
    for (const t of [r?.telefone, r?.telefoneSecundario]) {
      if (t && !g.telefones.includes(telefoneDaApi(t))) g.telefones.push(telefoneDaApi(t))
    }
    if (!g.email && r?.email) g.email = r.email
    if (!g.cpf && r?.documento) g.cpf = r.documento.replace(/\D/g, '')
    return g
  }

  /* 1. Quem é quem dentro da planilha. */
  let deCima: Grupo | null = null
  let linhaDeCima = 0

  for (const item of itens) {
    const r = item.registro
    if (r.vazia) {
      fora(item, 'LINHA_EM_BRANCO')
      deCima = null
      continue
    }

    if (!r.responsavel) {
      if (r.animal && deCima) {
        const id = `orfao-${item.numeroLinha}`
        perguntas.push({ tipo: 'ORFAO', id, item, dono: deCima, acima: linhaDeCima })
        const escolha = resposta(id)?.resposta
        if (escolha === 'JUNTAR_AO') {
          item.grupo = juntar(deCima, item)
          item.responsavel = deCima.nome
          item.ajustes.push({
            campo: 'responsavelNome',
            tipo: 'RESPONSAVEL_DA_LINHA_ANTERIOR',
            de: '',
            para: deCima.nome,
          })
          item.motivos.push('RESPONSAVEL_DA_LINHA_ANTERIOR')
        } else if (escolha === 'DEIXAR_DE_FORA') {
          fora(item, 'DEIXADA_DE_FORA')
        } else {
          item.destino = 'DUVIDA'
        }
      } else {
        fora(item, r.animal ? 'ANIMAL_SEM_RESPONSAVEL' : 'RESPONSAVEL_SEM_NOME')
      }
      linhaDeCima = item.numeroLinha
      continue
    }

    if (!r.responsavel.nome) {
      fora(item, 'RESPONSAVEL_SEM_NOME')
      deCima = null
      continue
    }

    const nome = normalizarRotulo(r.responsavel.nome)
    const cpf = r.responsavel.documento.replace(/\D/g, '')
    const telefones = [r.responsavel.telefone, r.responsavel.telefoneSecundario]
      .filter(Boolean)
      .map(telefoneDaApi)
    let grupo: Grupo | null = null

    const mesmoCpf = cpf ? grupos.find((g) => g.cpf === cpf) : undefined
    const mesmoNome = grupos.filter((g) => normalizarRotulo(g.nome) === nome)
    const compativel = mesmoNome.find(
      (g) =>
        !g.telefones.length || !telefones.length || g.telefones.some((t) => telefones.includes(t)),
    )

    if (mesmoCpf && normalizarRotulo(mesmoCpf.nome) === nome) {
      grupo = juntar(mesmoCpf, item)
    } else if (compativel && !(mesmoCpf && mesmoCpf !== compativel)) {
      grupo = juntar(compativel, item)
    } else {
      const outro = mesmoCpf ?? mesmoNome[0]
      if (outro) {
        const id = `mesma-${outro.chave}-${item.numeroLinha}`
        const escolha = resposta(id)?.resposta
        if (escolha === 'MESMA_PESSOA') {
          grupo = juntar(outro, item)
        } else {
          grupo = novoGrupo(item)
          if (escolha === 'DEIXAR_DE_FORA') grupo.fora = true
          else if (escolha !== 'PESSOAS_DIFERENTES') grupo.pendente = true
          else if (mesmoCpf) grupo.cpf = ''
        }
        perguntas.push({
          tipo: 'MESMA_PESSOA',
          id,
          motivo: mesmoCpf ? 'CPF_NOME_DIVERGE' : 'MESMO_NOME',
          a: outro,
          b: grupo === outro ? novoGrupoSombra(item) : grupo,
        })
      } else {
        grupo = novoGrupo(item)
      }
    }

    item.grupo = grupo
    deCima = grupo
    linhaDeCima = item.numeroLinha
  }

  /* 2. Cada pessoa da planilha contra a base da clínica. */
  const ativos = CLIENTES.filter((c) => c.ativo && !c.anonimizadoEm && !c.mescladoEmId)
  type PerguntaDeCliente = {
    id: string
    grupo: Grupo
    motivo: Duvida['motivo']
    candidatos: ClienteDaDemo[]
  }
  const perguntasDeCliente: PerguntaDeCliente[] = []

  for (const g of grupos) {
    if (g.pendente || g.fora) continue
    const id = `cliente-${g.chave}`
    const finais = g.telefones.map(finalDoTelefone)
    const porCpf = g.cpf ? ativos.find((c) => c.cpf === g.cpf) : undefined
    const porTelefone = ativos.find((c) =>
      [c.telefone, c.telefoneSecundario].some((t) => t && finais.includes(finalDoTelefone(t))),
    )
    const porNome = ativos.filter((c) => normalizarRotulo(c.nome) === normalizarRotulo(g.nome))

    let pergunta: PerguntaDeCliente | null = null
    if (porCpf && normalizarRotulo(porCpf.nome) === normalizarRotulo(g.nome)) {
      g.clienteId = porCpf.id
      g.juncao = 'JUNTOU_POR_CPF'
    } else if (porCpf) {
      pergunta = { id, grupo: g, motivo: 'CPF_NOME_DIVERGE', candidatos: [porCpf] }
    } else if (porTelefone && primeiroNome(porTelefone.nome) === primeiroNome(g.nome)) {
      g.clienteId = porTelefone.id
      g.juncao = 'JUNTOU_POR_TELEFONE'
    } else if (porTelefone) {
      pergunta = { id, grupo: g, motivo: 'TELEFONE', candidatos: [porTelefone] }
    } else if (porNome.length) {
      pergunta = { id, grupo: g, motivo: 'NOME', candidatos: porNome }
    }

    if (!pergunta) continue
    perguntasDeCliente.push(pergunta)
    const escolha = resposta(id)
    if (escolha?.resposta === 'JUNTAR_AO' && escolha.clienteId) {
      g.clienteId = escolha.clienteId
      g.juncao =
        pergunta.motivo === 'CPF_NOME_DIVERGE'
          ? 'JUNTOU_POR_CPF'
          : pergunta.motivo === 'TELEFONE'
            ? 'JUNTOU_POR_TELEFONE'
            : 'JUNTOU_POR_NOME'
    } else if (escolha?.resposta === 'DEIXAR_DE_FORA') {
      g.fora = true
    } else if (escolha?.resposta === 'PESSOAS_DIFERENTES') {
      if (pergunta.motivo === 'CPF_NOME_DIVERGE') {
        g.cpf = ''
        porNumero.get(g.chave)?.motivos.push('CPF_DE_OUTRO_CADASTRO')
      }
    } else {
      g.pendente = true
    }
  }

  /* 3. O destino de cada linha. */
  const animais = new Map<Grupo, Array<{ chave: string; linha: number; peso: number | null }>>()

  for (const item of itens) {
    const g = item.grupo
    if (!g || item.destino === 'FORA' || item.destino === 'DUVIDA') continue
    if (g.pendente) {
      item.destino = 'DUVIDA'
      continue
    }
    if (g.fora) {
      fora(item, 'DEIXADA_DE_FORA')
      continue
    }
    item.responsavel = g.nome
    item.grupoLinha = item.numeroLinha !== g.chave ? g.chave : null
    if (g.juncao && item.numeroLinha === g.chave) item.motivos.push(g.juncao)

    const animal = item.registro.animal
    if (!animal) {
      const temAnimal = g.linhas.some((n) => porNumero.get(n)?.registro.animal)
      item.destino = temAnimal ? 'JUNTA_LINHA' : g.clienteId ? 'JUNTA_EXISTENTE' : 'CONTATO'
      if (!g.telefones.length && !g.email) item.motivos.push('SEM_CONTATO')
      continue
    }
    if (!animal.nome) {
      fora(item, 'ANIMAL_SEM_NOME')
      continue
    }
    if (!item.especie) {
      fora(item, 'ESPECIE_DESCONHECIDA')
      continue
    }
    if (item.registro.falecido) {
      fora(item, 'ANIMAL_FALECIDO')
      continue
    }

    const chave = `${normalizarRotulo(animal.nome)}|${item.especie}`
    const lista = animais.get(g) ?? []
    animais.set(g, lista)
    const repetido = lista.find((a) => a.chave === chave)
    if (repetido) {
      item.destino = 'JUNTA_LINHA'
      item.juntaComLinha = repetido.linha
      if (
        repetido.peso &&
        animal.pesoKg &&
        Math.abs(repetido.peso - animal.pesoKg) > 0.05 * repetido.peso
      ) {
        item.motivos.push('DIVERGE_PESO')
      }
      continue
    }
    lista.push({ chave, linha: item.numeroLinha, peso: animal.pesoKg })

    const existente = g.clienteId
      ? PACIENTES.find(
          (p) =>
            p.clienteId === g.clienteId &&
            p.especie === item.especie &&
            normalizarRotulo(p.nome) === normalizarRotulo(animal.nome),
        )
      : undefined
    if (existente) {
      item.destino = 'JUNTA_EXISTENTE'
      item.pacienteId = existente.id
      item.motivos.push('JUNTOU_AO_PACIENTE')
      if (
        existente.pesoKg &&
        animal.pesoKg &&
        Math.abs(existente.pesoKg - animal.pesoKg) > 0.05 * existente.pesoKg
      ) {
        item.motivos.push('DIVERGE_PESO')
      }
      if (
        existente.raca &&
        animal.raca &&
        normalizarRotulo(existente.raca) !== normalizarRotulo(animal.raca)
      ) {
        item.motivos.push('DIVERGE_RACA')
      }
      item.camposPreenchidos = [
        ...(!existente.microchip && animal.microchip ? ['microchip'] : []),
        ...(!existente.pelagem && animal.pelagem ? ['pelagem'] : []),
        ...(!existente.nascimento && animal.nascimento ? ['nascimento'] : []),
      ]
      continue
    }
    item.destino = 'ENTRA'
  }

  /* As perguntas, na forma da API e na ordem da planilha. */
  const ladoDo = (g: Grupo): LadoDaDuvida => {
    const linhas = g.linhas.slice().sort((a, b) => a - b)
    const bichos = linhas
      .map((n) => porNumero.get(n))
      .filter((i): i is ItemDoPlano => Boolean(i?.registro.animal?.nome))
    return {
      nome: g.nome,
      telefone: g.telefones[0] ?? null,
      animais: [...new Set(bichos.map((i) => i.registro.animal?.nome ?? ''))],
      especie: bichos[0]?.especie ?? null,
      linhas: linhas.slice(0, 10),
      totalLinhas: linhas.length,
    }
  }

  const comResposta = (id: string) => {
    const r = resposta(id)
    return { resposta: r?.resposta ?? null, clienteEscolhidoId: r?.clienteId ?? null }
  }

  const duvidas: Duvida[] = [
    ...perguntas.map((p): Duvida => {
      if (p.tipo === 'ORFAO') {
        const nome = p.item.registro.animal?.nome || `#${p.item.numeroLinha}`
        return {
          id: p.id,
          tipo: 'ORFAO',
          motivo: 'LINHA_ANTERIOR',
          numeroLinha: p.item.numeroLinha,
          respostasAceitas: ['DEIXAR_DE_FORA', 'JUNTAR_AO'],
          ...comResposta(p.id),
          daPlanilha: {
            nome,
            telefone: null,
            animais: [nome],
            especie: p.item.especie,
            linhas: [p.item.numeroLinha],
            totalLinhas: 1,
          },
          outro: { ...ladoDo(p.dono), linhas: [p.acima], totalLinhas: 1 },
          candidatos: [],
        }
      }
      return {
        id: p.id,
        tipo: 'MESMA_PESSOA',
        motivo: p.motivo,
        numeroLinha: p.b.chave,
        respostasAceitas: ['PESSOAS_DIFERENTES', 'MESMA_PESSOA', 'DEIXAR_DE_FORA'],
        ...comResposta(p.id),
        daPlanilha: ladoDo(p.b),
        outro: ladoDo(p.a),
        candidatos: [],
      }
    }),
    ...perguntasDeCliente.map(
      (p): Duvida => ({
        id: p.id,
        tipo: 'RESPONSAVEL_EXISTENTE',
        motivo: p.motivo,
        numeroLinha: p.grupo.chave,
        respostasAceitas: ['PESSOAS_DIFERENTES', 'JUNTAR_AO', 'DEIXAR_DE_FORA'],
        ...comResposta(p.id),
        daPlanilha: ladoDo(p.grupo),
        outro: null,
        candidatos: p.candidatos.map((c) => {
          const pets = pacientesDoCliente(c.id).filter((x) => x.ativo)
          return {
            nome: c.nome,
            telefone: c.telefone,
            animais: pets.map((x) => x.nome),
            especie: pets[0]?.especie ?? null,
            linhas: [],
            totalLinhas: 0,
            clienteId: c.id,
          }
        }),
      }),
    ),
  ].sort((a, b) => a.numeroLinha - b.numeroLinha)

  return { itens, duvidas, padronizacoes }

  /** O "outro lado" de uma pergunta já respondida com "é a mesma": a linha nova, sozinha. */
  function novoGrupoSombra(item: ItemDoPlano): Grupo {
    const r = item.registro.responsavel
    return {
      chave: item.numeroLinha,
      nome: r?.nome ?? '',
      telefones: [r?.telefone].filter(Boolean).map((t) => telefoneDaApi(t as string)),
      email: '',
      cpf: '',
      linhas: [item.numeroLinha],
      registro: item.registro,
      complemento: '',
      codigo: '',
      clienteId: null,
      juncao: null,
      pendente: false,
      fora: false,
    }
  }
}

function planoDe(imp: ImportacaoDaDemo) {
  imp.plano ??= planejar(imp)
  return imp.plano
}

function abertas(plano: Plano) {
  return plano.duvidas.filter((d) => !d.resposta).length
}

function linhaDoItem(item: ItemDoPlano): LinhaDoRelatorio {
  const { grupo: _g, registro: _r, enviada: _e, especie: _es, especieOutra: _eo, ...linha } = item
  return { ...linha, motivos: [...linha.motivos], ajustes: [...linha.ajustes] }
}

function contar(codigos: CodigoDaLinha[]) {
  const mapa = new Map<CodigoDaLinha, number>()
  for (const c of codigos) mapa.set(c, (mapa.get(c) ?? 0) + 1)
  return [...mapa]
    .map(([codigo, linhas]) => ({ codigo, linhas }))
    .sort((a, b) => b.linhas - a.linhas)
}

function resumoDasLinhas(
  linhas: LinhaDoRelatorio[],
  duvidasAbertas: number,
  padronizacoes: Partial<Record<Padronizacao, number>>,
): Omit<ResumoDaImportacao, 'status'> {
  const emBranco = linhas.filter((l) => l.motivos.includes('LINHA_EM_BRANCO'))
  const entram = linhas.filter((l) => ENTRAM.includes(l.destino))
  const fora = linhas.filter((l) => l.destino === 'FORA' && !l.motivos.includes('LINHA_EM_BRANCO'))
  const descarte = (c: CodigoDaLinha) => CODIGOS_DE_DESCARTE.includes(c)
  const grupos = new Map<number, LinhaDoRelatorio[]>()
  for (const l of entram) {
    const chave = l.grupoLinha ?? l.numeroLinha
    grupos.set(chave, [...(grupos.get(chave) ?? []), l])
  }
  const existentes = [...grupos.values()].filter((g) =>
    g.some((l) => l.motivos.some((m) => m.startsWith('JUNTOU_POR_'))),
  ).length

  return {
    linhas: linhas.length,
    emBranco: emBranco.length,
    entram: entram.length,
    corrigidas: entram.filter((l) => l.ajustes.some((a) => !descarte(a.tipo))).length,
    paraCompletar: entram.filter((l) => l.ajustes.some((a) => descarte(a.tipo))).length,
    naoEntram: fora.length,
    emDuvida: linhas.filter((l) => l.destino === 'DUVIDA').length,
    duvidasAbertas,
    responsaveisNovos: grupos.size - existentes,
    responsaveisExistentes: existentes,
    pacientesNovos: entram.filter((l) => l.destino === 'ENTRA' && l.animal).length,
    pacientesExistentes: entram.filter((l) => l.destino === 'JUNTA_EXISTENTE' && l.pacienteId)
      .length,
    foraPorMotivo: contar(
      fora.flatMap((l) => l.motivos.filter((m) => CODIGOS_DE_FORA.includes(m))),
    ),
    ajustesPorMotivo: contar(entram.flatMap((l) => l.ajustes.map((a) => a.tipo))),
    padronizacoes: (Object.entries(padronizacoes) as Array<[Padronizacao, number]>)
      .filter(([, n]) => n > 0)
      .map(([tipo, n]) => ({ tipo, n })),
  }
}

/* --------------------------------------------------------------------------- a memória */

const IMPORTACOES: ImportacaoDaDemo[] = []
let historicoMontado = false
let sequencia = 2
let sequenciaDeCadastro = 0

function vazia(dto: Partial<Importacao> & Pick<Importacao, 'id' | 'criadaEm'>): ImportacaoDaDemo {
  return {
    dto: {
      arquivoNome: '',
      origemDetectada: 'PLANILHA',
      status: 'RECEBENDO_LINHAS',
      totalLinhas: 0,
      recebidas: 0,
      aGravar: 0,
      processadas: 0,
      criados: 0,
      juntados: 0,
      foraCount: 0,
      ultimoErro: null,
      confirmadaEm: null,
      concluidaEm: null,
      desfeitaEm: null,
      canceladaEm: null,
      dadosApagadosEm: null,
      desfazer: null,
      ...dto,
    },
    hash: '',
    ddd: '11',
    linhas: [],
    respostas: new Map(),
    plano: null,
    relatorio: null,
    job: null,
    pausouNoDesfazer: false,
    desfazer: null,
    gravados: { clientes: [], pacientes: [], preenchimentos: [] },
  }
}

/**
 * A exportação do SimplesVet que trouxe a base da clínica há três semanas: as linhas apontam para os
 * clientes e pacientes da base, com os ajustes de uma planilha de verdade e as que não entraram.
 */
function montarHistorico() {
  if (historicoMontado) return
  historicoMontado = true

  const dia = somarDias(hoje(), -23)
  IMPORTACOES.push(
    vazia({
      id: 'demo-imp-0001',
      criadaEm: instante(dia, '09:40'),
      status: 'CANCELADA',
      totalLinhas: 214,
      recebidas: 214,
      canceladaEm: instante(dia, '09:52'),
      dadosApagadosEm: instante(dia, '09:52'),
    }),
  )

  const diaDaImportacao = somarDias(hoje(), -21)
  const gravadaEm = instante(diaDaImportacao, '14:21')
  const linhas: LinhaDoRelatorio[] = []
  let n = 3
  const ajustesDe: Record<string, AjusteDaLinha[]> = {
    'demo-pac-001': [
      {
        campo: 'telefone',
        tipo: 'TELEFONE_NONO_DIGITO',
        de: '(11) 8770-1373',
        para: '5511987701373',
      },
    ],
    'demo-pac-001-2': [{ campo: 'peso', tipo: 'PESO_EM_GRAMAS', de: '900g', para: '0.9' }],
    'demo-pac-005': [
      { campo: 'especie', tipo: 'ESPECIE_PELA_RACA', de: 'Shih-tzu', para: 'CACHORRO' },
      { campo: 'email', tipo: 'EMAIL_INVALIDO', de: 'tania.moreira@', para: null },
    ],
    'demo-pac-006': [{ campo: 'nascimento', tipo: 'DATA_SEM_DIA', de: '2008', para: '2008-01-01' }],
    'demo-pac-007': [
      { campo: 'nascimento', tipo: 'DATA_ANO_CURTO', de: '08/09/17', para: '2017-09-08' },
    ],
    'demo-pac-011': [
      { campo: 'nascimento', tipo: 'DATA_DA_PLANILHA', de: '44107', para: '2020-10-03' },
    ],
    'demo-pac-014': [
      { campo: 'microchip', tipo: 'MICROCHIP_CIENTIFICO', de: '9,82E+14', para: null },
    ],
    'demo-pac-019': [{ campo: 'cpf', tipo: 'CPF_ZEROS', de: '8412357609', para: '08412357609' }],
    'demo-pac-028': [{ campo: 'peso', tipo: 'PESO_EM_GRAMAS', de: '150 g', para: '0.15' }],
    'demo-pac-030': [
      {
        campo: 'telefone',
        tipo: 'TELEFONE_SEM_DDD_CORRIGIDO',
        de: '98765-1180',
        para: '5511987651180',
      },
    ],
  }
  const jaExistiam = new Set([
    'demo-pac-004',
    'demo-pac-012',
    'demo-pac-020',
    'demo-pac-027',
    'demo-pac-033',
  ])

  for (const c of CLIENTES.slice(0, 40)) {
    const pets = pacientesDoCliente(c.id).filter((p) => p.ativo)
    pets.forEach((p, i) => {
      const ajustes = ajustesDe[p.id] ?? []
      const existia = jaExistiam.has(p.id)
      const primeira = i === 0 ? n : (linhas.find((l) => l.clienteId === c.id)?.numeroLinha ?? n)
      linhas.push({
        numeroLinha: n,
        destino: existia ? 'JUNTA_EXISTENTE' : 'ENTRA',
        motivos: [
          ...ajustes.map((a) => a.tipo),
          ...(existia ? (['JUNTOU_POR_TELEFONE', 'JUNTOU_AO_PACIENTE'] as const) : []),
        ],
        grupoLinha: i === 0 ? null : primeira,
        juntaComLinha: null,
        clienteId: c.id,
        pacienteId: p.id,
        gravadaEm,
        desfecho: null,
        camposPreenchidos: existia ? ['microchip', 'pelagem'].slice(0, 1 + (n % 2)) : [],
        responsavel: c.nome,
        animal: p.nome,
        ajustes,
      })
      n += 1
    })

    if (c.id === 'demo-cli-012') {
      const anterior = linhas.find((l) => l.clienteId === c.id)
      linhas.push({
        numeroLinha: n++,
        destino: 'JUNTA_LINHA',
        motivos: ['DIVERGE_PESO'],
        grupoLinha: anterior?.numeroLinha ?? null,
        juntaComLinha: anterior?.numeroLinha ?? null,
        clienteId: c.id,
        pacienteId: anterior?.pacienteId ?? null,
        gravadaEm,
        desfecho: null,
        camposPreenchidos: [],
        responsavel: c.nome,
        animal: anterior?.animal ?? null,
        ajustes: [],
      })
    }
    if (c.id === 'demo-cli-020') {
      linhas.push(foraDoHistorico(n++, 'LINHA_EM_BRANCO', null, null))
      linhas.push(foraDoHistorico(n++, 'ANIMAL_SEM_RESPONSAVEL', null, 'Thor'))
    }
    if (c.id === 'demo-cli-027') {
      linhas.push(foraDoHistorico(n++, 'ANIMAL_FALECIDO', 'Rosana Queiroz', 'Fumaça'))
      linhas.push({
        numeroLinha: n++,
        destino: 'CONTATO',
        motivos: [],
        grupoLinha: null,
        juntaComLinha: null,
        clienteId: null,
        pacienteId: null,
        gravadaEm,
        desfecho: null,
        camposPreenchidos: [],
        responsavel: 'Rosana Queiroz',
        animal: null,
        ajustes: [],
      })
    }
    if (c.id === 'demo-cli-035') {
      linhas.push(foraDoHistorico(n++, 'ANIMAL_SEM_NOME', 'Valter Domingues', null))
      linhas.push(foraDoHistorico(n++, 'ESPECIE_DESCONHECIDA', 'Irene Bastos', 'Nino'))
    }
  }

  const fora = linhas.filter((l) => l.destino === 'FORA' && !l.motivos.includes('LINHA_EM_BRANCO'))
  const juntadas = linhas.filter(
    (l) => l.destino === 'JUNTA_EXISTENTE' || l.destino === 'JUNTA_LINHA',
  )
  const criadas = linhas.filter((l) => l.destino === 'ENTRA' || l.destino === 'CONTATO')
  const antiga = vazia({
    id: 'demo-imp-0002',
    arquivoNome: 'simplesvet-clientes-e-animais.csv',
    origemDetectada: 'SIMPLESVET',
    status: 'CONCLUIDA',
    criadaEm: instante(diaDaImportacao, '14:02'),
    confirmadaEm: instante(diaDaImportacao, '14:19'),
    concluidaEm: gravadaEm,
    totalLinhas: linhas.length,
    recebidas: linhas.length,
    aGravar: criadas.length + juntadas.length,
    processadas: criadas.length + juntadas.length,
    criados: criadas.length,
    juntados: juntadas.length,
    foraCount: fora.length,
  })
  antiga.hash = 'demo-hash-simplesvet-2026-10'
  antiga.relatorio = linhas
  IMPORTACOES.push(antiga)
}

function foraDoHistorico(
  numeroLinha: number,
  codigo: CodigoDaLinha,
  responsavel: string | null,
  animal: string | null,
): LinhaDoRelatorio {
  return {
    numeroLinha,
    destino: 'FORA',
    motivos: [codigo],
    grupoLinha: null,
    juntaComLinha: null,
    clienteId: null,
    pacienteId: null,
    gravadaEm: null,
    desfecho: null,
    camposPreenchidos: [],
    responsavel,
    animal,
    ajustes: [],
  }
}

/* -------------------------------------------------------------------------- o job */

function avancar(imp: ImportacaoDaDemo) {
  const d = imp.dto
  if (!imp.job || (d.status !== 'PROCESSANDO' && d.status !== 'DESFAZENDO')) return
  const segundos = (Date.now() - imp.job.desde) / 1000

  if (d.status === 'PROCESSANDO') {
    const porSegundo = Math.max(d.aGravar / SEGUNDOS_DA_GRAVACAO, 2)
    d.processadas = Math.min(d.aGravar, imp.job.feitas + Math.floor(segundos * porSegundo))
    if (d.processadas >= d.aGravar) {
      imp.job = null
      gravar(imp)
    }
    return
  }

  const fracao = Math.min(1, imp.job.feitas + segundos / SEGUNDOS_DO_DESFAZER)
  const plano = imp.desfazer
  if (!plano) return
  d.desfazer = {
    fase:
      fracao < 0.3
        ? 'PREENCHIMENTOS'
        : fracao < 0.75
          ? 'PACIENTES'
          : fracao < 1
            ? 'CLIENTES'
            : 'FIM',
    pacientesRemovidos: Math.round(plano.pacientes.length * Math.min(1, fracao / 0.75)),
    clientesRemovidos:
      fracao < 0.75 ? 0 : Math.round(plano.clientes.length * Math.min(1, (fracao - 0.75) / 0.25)),
    preenchimentosDesfeitos: Math.round(plano.preenchimentos.length * Math.min(1, fracao / 0.3)),
    ficaram: plano.ficaram,
    propostasCanceladas: 0,
  }
  if (fracao >= 1) {
    imp.job = null
    aplicarDesfazer(imp)
  }
}

function fracaoDoJob(imp: ImportacaoDaDemo) {
  if (!imp.job) return 0
  const segundos = (Date.now() - imp.job.desde) / 1000
  return imp.dto.status === 'DESFAZENDO'
    ? Math.min(1, imp.job.feitas + segundos / SEGUNDOS_DO_DESFAZER)
    : imp.dto.processadas
}

/* ------------------------------------------------------------------------- gravar */

function portePeloPeso(especie: Especie | null, peso: number | null): PacienteDaDemo['porte'] {
  if (especie !== 'CACHORRO' || !peso) return null
  if (peso <= 4) return 'MINI'
  if (peso <= 10) return 'PEQUENO'
  if (peso <= 25) return 'MEDIO'
  if (peso <= 45) return 'GRANDE'
  return 'GIGANTE'
}

function criarClienteDoGrupo(g: Grupo): string {
  const r = g.registro.responsavel
  const e = r?.endereco
  const id = `demo-cli-imp-${String(++sequenciaDeCadastro).padStart(3, '0')}`
  CLIENTES.push({
    id,
    nome: g.nome,
    cpf: g.cpf || null,
    telefone: g.telefones[0] ?? null,
    telefoneSecundario: g.telefones[1] ?? null,
    email: g.email || null,
    contatoPreferido: g.telefones.length ? 'WHATSAPP' : 'EMAIL',
    cep: e?.cep ? e.cep.replace(/\D/g, '') : null,
    logradouro: e?.logradouro || null,
    numero: e?.numero || null,
    complemento: g.complemento || null,
    bairro: e?.bairro || null,
    cidade: e?.cidade || null,
    uf: e?.uf || null,
    observacao: null,
    emergenciaNome: null,
    emergenciaTelefone: null,
    codigoNaOrigem: g.codigo || null,
    ativo: true,
    inativoMotivo: null,
    mescladoEmId: null,
    anonimizadoEm: null,
    bloqueadoAte: null,
    autorizados: [],
    criadoEm: agoraIso(),
  })
  return id
}

function criarPacienteDoItem(item: ItemDoPlano, clienteId: string): string {
  const a = item.registro.animal
  const id = `demo-pac-imp-${String(++sequenciaDeCadastro).padStart(3, '0')}`
  const estimado = item.ajustes.some(
    (x) => x.tipo === 'NASCIMENTO_PELA_IDADE' || x.tipo === 'DATA_SEM_DIA',
  )
  PACIENTES.push({
    id,
    nome: a?.nome ?? '',
    especie: item.especie ?? 'OUTRO',
    especieOutra: item.especieOutra,
    raca: a?.raca || null,
    sexo: a?.sexo === 'macho' ? 'MACHO' : a?.sexo === 'femea' ? 'FEMEA' : null,
    nascimento: a?.nascimento ?? null,
    nascimentoEstimado: estimado,
    porte: portePeloPeso(item.especie, a?.pesoKg ?? null),
    ativo: true,
    inativoMotivo: null,
    obitoEm: null,
    temFoto: false,
    fotoUrl: null,
    codigoNaOrigem: item.enviada.campos.codigoAnimal ?? null,
    castrado: a?.castrado ?? null,
    pesoKg: a?.pesoKg ?? null,
    microchip: a?.microchip || null,
    pelagem: a?.pelagem || null,
    mescladoEmId: null,
    alertas: a?.alergia
      ? [
          {
            id: `${id}-alerta-1`,
            tipo: 'ALERGIA',
            severidade: 'ATENCAO',
            detalhe: a.alergia,
            ativo: true,
          },
        ]
      : [],
    clienteId,
    noApp: false,
    criadoEm: agoraIso(),
  })
  return id
}

/** Preenche o que estava em branco e guarda como voltar. */
function preencher<T extends object>(alvo: T, campos: Partial<T>): Undo | null {
  const antes: Partial<T> = {}
  let mudou = false
  for (const [chave, valor] of Object.entries(campos) as Array<[keyof T, T[keyof T]]>) {
    if (valor == null || valor === '' || (alvo[chave] != null && alvo[chave] !== '')) continue
    antes[chave] = alvo[chave]
    alvo[chave] = valor
    mudou = true
  }
  return mudou ? () => Object.assign(alvo, antes) : null
}

function gravar(imp: ImportacaoDaDemo) {
  const plano = planoDe(imp)
  const clienteDoGrupo = new Map<Grupo, string>()
  const pacienteDaLinha = new Map<number, string>()
  const em = agoraIso()
  const relatorio: LinhaDoRelatorio[] = []

  for (const item of plano.itens) {
    const linha = linhaDoItem(item)
    const g = item.grupo
    if (g && ENTRAM.includes(item.destino)) {
      let clienteId = g.clienteId ?? clienteDoGrupo.get(g) ?? null
      if (!clienteId) {
        clienteId = criarClienteDoGrupo(g)
        imp.gravados.clientes.push(clienteId)
      } else if (g.clienteId && !clienteDoGrupo.has(g)) {
        const c = cliente(g.clienteId)
        const r = g.registro.responsavel
        const desfaz = c
          ? preencher(c, {
              email: g.email || null,
              cpf: g.cpf || null,
              telefoneSecundario:
                g.telefones.find((t) => finalDoTelefone(t) !== finalDoTelefone(c.telefone)) ?? null,
              logradouro: r?.endereco?.logradouro || null,
              bairro: r?.endereco?.bairro || null,
            })
          : null
        if (desfaz) imp.gravados.preenchimentos.push(desfaz)
      }
      clienteDoGrupo.set(g, clienteId)
      linha.clienteId = clienteId
      linha.gravadaEm = em

      if (item.destino === 'ENTRA' && item.registro.animal) {
        const id = criarPacienteDoItem(item, clienteId)
        imp.gravados.pacientes.push(id)
        pacienteDaLinha.set(item.numeroLinha, id)
        linha.pacienteId = id
      } else if (item.destino === 'JUNTA_EXISTENTE' && item.pacienteId) {
        const p = paciente(item.pacienteId)
        const a = item.registro.animal
        const desfaz =
          p && a
            ? preencher(p, {
                microchip: a.microchip || null,
                pelagem: a.pelagem || null,
                nascimento: a.nascimento,
              })
            : null
        if (desfaz) imp.gravados.preenchimentos.push(desfaz)
        pacienteDaLinha.set(item.numeroLinha, item.pacienteId)
      } else if (item.destino === 'JUNTA_LINHA' && item.juntaComLinha) {
        linha.pacienteId = pacienteDaLinha.get(item.juntaComLinha) ?? null
      }
    }
    relatorio.push(linha)
  }

  const d = imp.dto
  imp.relatorio = relatorio
  d.status = 'CONCLUIDA'
  d.concluidaEm = em
  d.processadas = d.aGravar
  d.criados = relatorio.filter((l) => l.destino === 'ENTRA' || l.destino === 'CONTATO').length
  d.juntados = relatorio.filter(
    (l) => l.destino === 'JUNTA_EXISTENTE' || l.destino === 'JUNTA_LINHA',
  ).length
  d.foraCount = relatorio.filter(
    (l) => l.destino === 'FORA' && !l.motivos.includes('LINHA_EM_BRANCO'),
  ).length
}

/* ----------------------------------------------------------------------- desfazer */

/** O que sai e o que fica: fica quem já tem agendamento, vínculo com o app ou foi editado. */
function planejarDesfazer(imp: ImportacaoDaDemo): Desfazer {
  const desfechos = new Map<number, NonNullable<LinhaDoRelatorio['desfecho']>>()
  const pacientes: string[] = []
  const nossos = new Set(imp.gravados.pacientes)
  let ficaram = 0

  const ficou = (id: string): NonNullable<LinhaDoRelatorio['desfecho']> | null => {
    if (agendamentosDoPaciente(id).length) return 'FICOU_REGISTRO_POSTERIOR'
    if (vinculoDe(id)) return 'FICOU_VINCULO'
    if (!nossos.has(id)) return 'FICOU_EDITADO'
    return null
  }

  for (const l of imp.relatorio ?? []) {
    if (!ENTRAM.includes(l.destino)) {
      desfechos.set(l.numeroLinha, 'NADA_A_DESFAZER')
    } else if (l.destino === 'ENTRA' && l.pacienteId) {
      const motivo = ficou(l.pacienteId)
      if (motivo) ficaram += 1
      else pacientes.push(l.pacienteId)
      desfechos.set(l.numeroLinha, motivo ?? 'DESFEITA')
    } else if (l.destino === 'JUNTA_EXISTENTE') {
      const nosso = imp.gravados.preenchimentos.length > 0
      desfechos.set(
        l.numeroLinha,
        nosso && l.camposPreenchidos.length ? 'DESFEITA' : 'NADA_A_DESFAZER',
      )
    }
  }
  for (const l of imp.relatorio ?? []) {
    if (l.destino === 'JUNTA_LINHA') {
      desfechos.set(
        l.numeroLinha,
        (l.juntaComLinha && desfechos.get(l.juntaComLinha)) || 'NADA_A_DESFAZER',
      )
    }
  }

  const clientes = imp.gravados.clientes.filter((id) =>
    pacientesDoCliente(id).every((p) => pacientes.includes(p.id)),
  )
  for (const l of imp.relatorio ?? []) {
    if (l.destino === 'CONTATO') {
      const sai = Boolean(l.clienteId && clientes.includes(l.clienteId))
      if (!sai) ficaram += 1
      desfechos.set(l.numeroLinha, sai ? 'DESFEITA' : 'FICOU_CLIENTE_EM_USO')
    }
  }

  return {
    desfechos,
    pacientes,
    clientes,
    preenchimentos: [...imp.gravados.preenchimentos],
    ficaram,
  }
}

function aplicarDesfazer(imp: ImportacaoDaDemo) {
  const plano = imp.desfazer
  if (!plano) return
  for (const id of plano.pacientes) {
    const i = PACIENTES.findIndex((p) => p.id === id)
    if (i >= 0) PACIENTES.splice(i, 1)
  }
  let propostasCanceladas = 0
  for (const id of plano.clientes) {
    propostasCanceladas += cancelarPropostasDoCliente(id)
    const i = CLIENTES.findIndex((c) => c.id === id)
    if (i >= 0) CLIENTES.splice(i, 1)
  }
  for (const desfaz of plano.preenchimentos) desfaz()
  imp.gravados = { clientes: [], pacientes: [], preenchimentos: [] }

  imp.relatorio = (imp.relatorio ?? []).map((l) => ({
    ...l,
    desfecho: plano.desfechos.get(l.numeroLinha) ?? 'NADA_A_DESFAZER',
  }))
  imp.dto.status = 'DESFEITA'
  imp.dto.desfeitaEm = agoraIso()
  imp.dto.desfazer = {
    fase: 'FIM',
    pacientesRemovidos: plano.pacientes.length,
    clientesRemovidos: plano.clientes.length,
    preenchimentosDesfeitos: plano.preenchimentos.length,
    ficaram: plano.ficaram,
    propostasCanceladas,
  }
}

/* ------------------------------------------------------------------------ consultas */

export function importacoes(): ImportacaoDaDemo[] {
  montarHistorico()
  for (const imp of IMPORTACOES) avancar(imp)
  return [...IMPORTACOES].sort((a, b) => b.dto.criadaEm.localeCompare(a.dto.criadaEm))
}

export function importacao(id: string) {
  montarHistorico()
  const imp = IMPORTACOES.find((i) => i.dto.id === id) ?? null
  if (imp) avancar(imp)
  return imp
}

/** Pendência da área: importação pausada ou parada no meio (`importacoesPausadas`). */
export function importacoesParadas(): number {
  return importacoes().filter((i) => i.dto.status === 'PAUSADA' || i.dto.status === 'FALHOU').length
}

export function dtoDa(imp: ImportacaoDaDemo): Importacao {
  return { ...imp.dto, desfazer: imp.dto.desfazer ? { ...imp.dto.desfazer } : null }
}

/* -------------------------------------------------------------------------- ações */

export function criarImportacao(nova: NovaImportacao) {
  montarHistorico()
  const id = `demo-imp-${String(++sequencia).padStart(4, '0')}`
  const imp = vazia({
    id,
    criadaEm: agoraIso(),
    arquivoNome: nova.arquivoNome,
    origemDetectada: nova.origemDetectada ?? 'PLANILHA',
    totalLinhas: nova.totalLinhas,
  })
  imp.hash = nova.hashArquivo
  imp.ddd = nova.ddd || '11'
  IMPORTACOES.push(imp)
  const mesma = IMPORTACOES.find(
    (i) => i !== imp && i.hash === nova.hashArquivo && i.dto.status === 'CONCLUIDA',
  )
  return { id, status: imp.dto.status, jaImportadoEm: mesma?.dto.concluidaEm ?? null }
}

export function receberLinhas(imp: ImportacaoDaDemo, linhas: LinhaEnviada[]) {
  const numeros = new Set(linhas.map((l) => l.numeroLinha))
  imp.linhas = [...imp.linhas.filter((l) => !numeros.has(l.numeroLinha)), ...linhas].sort(
    (a, b) => a.numeroLinha - b.numeroLinha,
  )
  imp.plano = null
  const plano = planoDe(imp)
  const d = imp.dto
  d.recebidas = imp.linhas.length
  if (d.recebidas >= d.totalLinhas) atualizarPlano(imp)
  const doLote = plano.itens.filter((i) => numeros.has(i.numeroLinha))
  return {
    status: d.status,
    recebidas: d.recebidas,
    totalLinhas: d.totalLinhas,
    duvidasAbertas: abertas(plano),
    linhas: doLote.map((i) => ({
      numeroLinha: i.numeroLinha,
      destino: i.destino,
      motivos: [...i.motivos],
      repetida: false,
    })),
  }
}

/** Refaz o plano e acerta o status e as contagens antes de importar. */
function atualizarPlano(imp: ImportacaoDaDemo) {
  imp.plano = null
  const plano = planoDe(imp)
  const d = imp.dto
  const linhas = plano.itens.map(linhaDoItem)
  d.status = abertas(plano) > 0 ? 'COM_DUVIDAS' : 'PRONTA'
  d.aGravar = linhas.filter((l) => ENTRAM.includes(l.destino)).length
  d.foraCount = linhas.filter(
    (l) => l.destino === 'FORA' && !l.motivos.includes('LINHA_EM_BRANCO'),
  ).length
}

export function duvidasDa(imp: ImportacaoDaDemo) {
  return imp.linhas.length ? planoDe(imp).duvidas : []
}

export function responder(imp: ImportacaoDaDemo, respostas: RespostaDaDuvida[]) {
  const ids = new Set(duvidasDa(imp).map((d) => d.id))
  const desconhecida = respostas.find((r) => !ids.has(r.duvidaId))
  if (desconhecida) return { erro: 'IMPORTACAO_DUVIDA_INEXISTENTE' as const }
  for (const r of respostas) imp.respostas.set(r.duvidaId, r)
  atualizarPlano(imp)
  return { status: imp.dto.status, duvidasAbertas: abertas(planoDe(imp)) }
}

export function resumoDa(imp: ImportacaoDaDemo): ResumoDaImportacao {
  if (imp.relatorio) {
    return { status: imp.dto.status, ...resumoDasLinhas(imp.relatorio, 0, {}) }
  }
  const plano = planoDe(imp)
  return {
    status: imp.dto.status,
    ...resumoDasLinhas(plano.itens.map(linhaDoItem), abertas(plano), plano.padronizacoes),
  }
}

export function linhasDa(imp: ImportacaoDaDemo): LinhaDoRelatorio[] {
  if (imp.dto.dadosApagadosEm && imp.dto.status === 'CANCELADA' && !imp.dto.confirmadaEm) return []
  if (imp.relatorio) return imp.relatorio
  return imp.linhas.length ? planoDe(imp).itens.map(linhaDoItem) : []
}

export function confirmar(imp: ImportacaoDaDemo) {
  atualizarPlano(imp)
  if (imp.dto.status === 'COM_DUVIDAS') return false
  const d = imp.dto
  d.status = 'PROCESSANDO'
  d.confirmadaEm = agoraIso()
  d.processadas = 0
  imp.job = { desde: Date.now(), feitas: 0 }
  return true
}

export function pausar(imp: ImportacaoDaDemo) {
  avancar(imp)
  const d = imp.dto
  if (d.status !== 'PROCESSANDO' && d.status !== 'DESFAZENDO') return false
  const feitas = fracaoDoJob(imp)
  imp.pausouNoDesfazer = d.status === 'DESFAZENDO'
  imp.job = { desde: 0, feitas }
  d.status = 'PAUSADA'
  return true
}

export function continuar(imp: ImportacaoDaDemo) {
  const d = imp.dto
  if (d.status !== 'PAUSADA' && d.status !== 'FALHOU') return false
  d.status = imp.pausouNoDesfazer ? 'DESFAZENDO' : 'PROCESSANDO'
  d.ultimoErro = null
  imp.job = { desde: Date.now(), feitas: imp.job?.feitas ?? 0 }
  return true
}

export function descartar(imp: ImportacaoDaDemo) {
  const d = imp.dto
  if (!['RECEBENDO_LINHAS', 'COM_DUVIDAS', 'PRONTA'].includes(d.status)) return false
  d.status = 'CANCELADA'
  d.canceladaEm = agoraIso()
  d.dadosApagadosEm = d.canceladaEm
  d.arquivoNome = ''
  imp.linhas = []
  imp.plano = null
  imp.respostas.clear()
  return true
}

export function desfazer(imp: ImportacaoDaDemo) {
  const d = imp.dto
  const pode = d.status === 'CONCLUIDA' || (d.status === 'CANCELADA' && d.confirmadaEm)
  if (!pode && !(d.status === 'DESFEITA' && d.desfazer?.ficaram)) return false
  imp.desfazer = planejarDesfazer(imp)
  d.status = 'DESFAZENDO'
  d.desfazer = {
    fase: 'PREENCHIMENTOS',
    pacientesRemovidos: 0,
    clientesRemovidos: 0,
    preenchimentosDesfeitos: 0,
    ficaram: 0,
    propostasCanceladas: 0,
  }
  imp.job = { desde: Date.now(), feitas: 0 }
  return true
}

/**
 * Proposta por e-mail a cada cliente que a importação criou, com paciente ativo e sem proposta desta
 * clínica; o resto vai contado. Quem já era cliente (ou ganhou o e-mail da planilha) fica para a
 * ficha.
 */
export function proporVinculos(imp: ImportacaoDaDemo): PropostasEmLote {
  const lote: PropostasEmLote = {
    propostas: 0,
    semEmail: 0,
    jaPropostos: 0,
    emailRepetido: 0,
    semPaciente: 0,
    paraDepois: 0,
    pelaFicha: 0,
    clientesPelaFicha: [],
  }
  const vistos = new Set<string>()
  const emails = new Set<string>()

  for (const l of imp.relatorio ?? []) {
    if (!l.clienteId || vistos.has(l.clienteId) || !ENTRAM.includes(l.destino)) continue
    vistos.add(l.clienteId)
    const c = cliente(l.clienteId)
    if (!c) continue
    const pets = pacientesDoCliente(c.id).filter((p) => p.ativo && !vinculoDe(p.id))
    const doGrupo = (imp.relatorio ?? []).filter(
      (x) => (x.grupoLinha ?? x.numeroLinha) === (l.grupoLinha ?? l.numeroLinha),
    )

    if (doGrupo.some((x) => x.destino === 'JUNTA_EXISTENTE')) {
      lote.clientesPelaFicha.push({ clienteId: c.id, motivo: 'PACIENTE_JA_EXISTIA' })
    } else if (l.camposPreenchidos.includes('email')) {
      lote.clientesPelaFicha.push({ clienteId: c.id, motivo: 'EMAIL_PREENCHIDO_NA_IMPORTACAO' })
    } else if (!pacientesDoCliente(c.id).some((p) => p.ativo)) {
      lote.semPaciente += 1
    } else if (!pets.length || propostasDoCliente(c.id).length) {
      lote.jaPropostos += 1
    } else if (!c.email) {
      lote.semEmail += 1
    } else if (emails.has(c.email)) {
      lote.emailRepetido += 1
    } else if (lote.propostas >= 50) {
      lote.paraDepois += 1
    } else {
      emails.add(c.email)
      criarProposta(
        c.id,
        pets.map((p) => p.id),
        'PROPOSTA_EMAIL',
      )
      lote.propostas += 1
    }
  }
  lote.pelaFicha = lote.clientesPelaFicha.length
  return lote
}

export type { ImportacaoDaDemo }
