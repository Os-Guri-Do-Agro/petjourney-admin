/**
 * Catálogos do hotel: a casa, quem trabalha nela e quanto custa.
 *
 * Uma chamada só, porque é isso que o backend vai entregar: seis listas pequenas e estáveis que
 * toda tela precisa antes de mostrar qualquer coisa. Seis requisições para montar um cabeçalho
 * seria seis oportunidades de a tela abrir pela metade.
 */

import type { Pet, Tutor } from '@/features/clinico/data/types'

import type { TemporadaSazonal } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { materializarTemporadas } from '../seed'
import { getDataset } from '../store'
import { CadastroRecusadoError } from './acomodacao-repository'
import type {
  Acomodacao,
  Bloco,
  Comprovante,
  Cuidador,
  Exigencia,
  Hotel,
  IconeDeAcomodacao,
  PetPorte,
  Servico,
  Tarifa,
  Temporada,
  TipoDeAcomodacao,
} from '../types'

export type CatalogosDoHotel = {
  hotel: Hotel
  blocos: Bloco[]
  /** Os tipos que a casa cadastrou: o nome de cada um é dela, não nosso. */
  tiposDeAcomodacao: TipoDeAcomodacao[]
  acomodacoes: Acomodacao[]
  tarifas: Tarifa[]
  temporadas: Temporada[]
  /** As temporadas como foram cadastradas, para a tela de configuração. Ver `SeedResult`. */
  temporadasSazonais: TemporadaSazonal[]
  servicos: Servico[]
  exigencias: Exigencia[]
  cuidadores: Cuidador[]
  /**
   * Os comprovantes da casa inteira.
   *
   * Vêm com os catálogos e não por reserva porque a carteira é do **animal**, não da estadia: o
   * mesmo comprovante responde pela reserva de julho e pela de dezembro, e buscá-lo uma vez por
   * reserva faria a lista da véspera disparar vinte chamadas para reler os mesmos papéis.
   */
  comprovantes: Comprovante[]
  pets: Pet[]
  tutores: Tutor[]
}

/**
 * Nome já usado por outro item da mesma lista.
 *
 * Comparado em minúsculas do pt-BR: "Canil A" e "canil a" são o mesmo corredor para quem trabalha
 * nele, e deixar os dois existirem cria uma casa onde metade das baias está no corredor errado e
 * ninguém consegue explicar por quê.
 */
function nomeExiste(lista: { id: string; nome: string }[], nome: string, exceto?: string) {
  const alvo = nome.trim().toLocaleLowerCase('pt-BR')

  return lista.some(
    (item) => item.id !== exceto && item.nome.trim().toLocaleLowerCase('pt-BR') === alvo,
  )
}

/** O identificador legível, derivado do nome — pelo mesmo motivo das acomodações. */
function identificador(nome: string) {
  return nome
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Reconstrói as faixas de preço a partir das temporadas cadastradas.
 *
 * O dataset guarda as duas formas: a **cadastrada** (`temporadasSazonais`, em `MM-DD`) e a
 * **materializada** (`temporadas`, com datas cheias), porque "fim de ano" vira até três faixas
 * quando atravessa a virada do ano. Mexer numa sem remontar a outra deixaria a tela mostrando o
 * cadastro novo e o cálculo de preço usando o antigo — divergência silenciosa, e do tipo que só
 * aparece na fatura.
 */
function remontarTemporadas() {
  const dataset = getDataset()

  dataset.temporadas = materializarTemporadas(dataset.temporadasSazonais, dataset.ancora)
}

export const catalogoRepository = {
  carregar(): Promise<CatalogosDoHotel> {
    return simularChamada('catalogo.carregar', () => {
      const dataset = getDataset()

      return {
        hotel: dataset.hotel,
        blocos: [...dataset.blocos].sort((um, outro) => um.ordem - outro.ordem),
        tiposDeAcomodacao: [...dataset.tiposDeAcomodacao].sort((um, outro) => um.ordem - outro.ordem),
        acomodacoes: [...dataset.acomodacoes],
        tarifas: [...dataset.tarifas],
        temporadas: [...dataset.temporadas],
        temporadasSazonais: [...dataset.temporadasSazonais],
        servicos: dataset.servicos.filter((servico) => servico.ativo),
        exigencias: [...dataset.exigencias],
        cuidadores: dataset.cuidadores.filter((cuidador) => cuidador.ativo),
        comprovantes: [...dataset.comprovantes],
        pets: [...dataset.pets],
        tutores: [...dataset.tutores],
      }
    })
  },

  /** Os casos plantados, para o painel de desenvolvimento. Não passa pelo envelope de latência. */
  casos() {
    return getDataset().casos
  },

  // -------------------------------------------------------------------- corredores

  criarBloco(entrada: { nome: string; icone: IconeDeAcomodacao }): Promise<Bloco> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()

      if (!entrada.nome.trim() || nomeExiste(dataset.blocos, entrada.nome)) {
        throw new CadastroRecusadoError('nome-repetido')
      }

      const bloco: Bloco = {
        id: `bloco-${identificador(entrada.nome)}`,
        nome: entrada.nome.trim(),
        icone: entrada.icone,
        /* Entra no fim da casa. Quem quiser antes usa a reordenação, que é um gesto e não um campo. */
        ordem: Math.max(0, ...dataset.blocos.map((item) => item.ordem)) + 1,
      }

      dataset.blocos.push(bloco)

      return bloco
    })
  },

  editarBloco(entrada: { blocoId: string; nome: string; icone: IconeDeAcomodacao }): Promise<Bloco> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()
      const bloco = dataset.blocos.find((item) => item.id === entrada.blocoId)

      if (!bloco) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      if (!entrada.nome.trim() || nomeExiste(dataset.blocos, entrada.nome, bloco.id)) {
        throw new CadastroRecusadoError('nome-repetido')
      }

      bloco.nome = entrada.nome.trim()
      bloco.icone = entrada.icone

      return bloco
    })
  },

  removerBloco(blocoId: string): Promise<void> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()
      const bloco = dataset.blocos.find((item) => item.id === blocoId)

      if (!bloco) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      if (dataset.acomodacoes.some((item) => item.blocoId === blocoId)) {
        throw new CadastroRecusadoError('em-uso')
      }

      if (dataset.blocos.length <= 1) {
        throw new CadastroRecusadoError('ultimo')
      }

      dataset.blocos = dataset.blocos.filter((item) => item.id !== blocoId)
    })
  },

  /**
   * Troca de lugar com o vizinho.
   *
   * A ordem dos corredores não é preferência de tela: é a ordem física em que a pessoa caminha
   * pela casa, e o mapa e a prancheta a respeitam. Por isso o gesto é "sobe um" e não um campo de
   * número — quem arruma a lista está pensando no caminho, não em aritmética.
   */
  moverBloco(entrada: { blocoId: string; direcao: 'sobe' | 'desce' }): Promise<Bloco[]> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()
      const ordenados = [...dataset.blocos].sort((um, outro) => um.ordem - outro.ordem)
      const posicao = ordenados.findIndex((item) => item.id === entrada.blocoId)

      if (posicao < 0) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      const vizinho = posicao + (entrada.direcao === 'sobe' ? -1 : 1)

      if (vizinho >= 0 && vizinho < ordenados.length) {
        const aqui = ordenados[posicao]!
        const ali = ordenados[vizinho]!
        const guardada = aqui.ordem

        aqui.ordem = ali.ordem
        ali.ordem = guardada
      }

      return [...dataset.blocos].sort((um, outro) => um.ordem - outro.ordem)
    })
  },

  // --------------------------------------------------- tipos de acomodação

  criarTipo(entrada: { nome: string; icone: IconeDeAcomodacao }): Promise<TipoDeAcomodacao> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()

      if (!entrada.nome.trim() || nomeExiste(dataset.tiposDeAcomodacao, entrada.nome)) {
        throw new CadastroRecusadoError('nome-repetido')
      }

      const tipo: TipoDeAcomodacao = {
        id: `tipo-${identificador(entrada.nome)}`,
        nome: entrada.nome.trim(),
        icone: entrada.icone,
        ordem: Math.max(0, ...dataset.tiposDeAcomodacao.map((item) => item.ordem)) + 1,
      }

      dataset.tiposDeAcomodacao.push(tipo)

      return tipo
    })
  },

  editarTipo(entrada: {
    tipoId: string
    nome: string
    icone: IconeDeAcomodacao
  }): Promise<TipoDeAcomodacao> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()
      const tipo = dataset.tiposDeAcomodacao.find((item) => item.id === entrada.tipoId)

      if (!tipo) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      if (!entrada.nome.trim() || nomeExiste(dataset.tiposDeAcomodacao, entrada.nome, tipo.id)) {
        throw new CadastroRecusadoError('nome-repetido')
      }

      /*
       * Renomear é livre, e de propósito: a casa que decide chamar "baia" de "box" está corrigindo
       * o vocabulário dela, não mudando o que a acomodação é. As vagas continuam apontando para o
       * mesmo id, e nenhuma reserva sente.
       */
      tipo.nome = entrada.nome.trim()
      tipo.icone = entrada.icone

      return tipo
    })
  },

  removerTipo(tipoId: string): Promise<void> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()

      if (!dataset.tiposDeAcomodacao.some((item) => item.id === tipoId)) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      if (dataset.acomodacoes.some((item) => item.tipoId === tipoId)) {
        throw new CadastroRecusadoError('em-uso')
      }

      if (dataset.tiposDeAcomodacao.length <= 1) {
        throw new CadastroRecusadoError('ultimo')
      }

      dataset.tiposDeAcomodacao = dataset.tiposDeAcomodacao.filter((item) => item.id !== tipoId)
    })
  },

  moverTipo(entrada: { tipoId: string; direcao: 'sobe' | 'desce' }): Promise<TipoDeAcomodacao[]> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()
      const ordenados = [...dataset.tiposDeAcomodacao].sort((um, outro) => um.ordem - outro.ordem)
      const posicao = ordenados.findIndex((item) => item.id === entrada.tipoId)

      if (posicao < 0) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      const vizinho = posicao + (entrada.direcao === 'sobe' ? -1 : 1)

      if (vizinho >= 0 && vizinho < ordenados.length) {
        const aqui = ordenados[posicao]!
        const ali = ordenados[vizinho]!
        const guardada = aqui.ordem

        aqui.ordem = ali.ordem
        ali.ordem = guardada
      }

      return [...dataset.tiposDeAcomodacao].sort((um, outro) => um.ordem - outro.ordem)
    })
  },

  // ----------------------------------------------------------------------- preços

  criarTarifa(entrada: {
    nome: string
    diariaPorPorte: Record<PetPorte, number>
    acompanhantePercentual: number
  }): Promise<Tarifa> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()

      if (!entrada.nome.trim() || nomeExiste(dataset.tarifas, entrada.nome)) {
        throw new CadastroRecusadoError('nome-repetido')
      }

      const tarifa: Tarifa = {
        id: `tarifa-${identificador(entrada.nome)}`,
        nome: entrada.nome.trim(),
        diariaPorPorte: { ...entrada.diariaPorPorte },
        acompanhantePercentual: entrada.acompanhantePercentual,
      }

      dataset.tarifas.push(tarifa)

      return tarifa
    })
  },

  editarTarifa(entrada: {
    tarifaId: string
    nome: string
    diariaPorPorte: Record<PetPorte, number>
    acompanhantePercentual: number
  }): Promise<Tarifa> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()
      const tarifa = dataset.tarifas.find((item) => item.id === entrada.tarifaId)

      if (!tarifa) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      if (!entrada.nome.trim() || nomeExiste(dataset.tarifas, entrada.nome, tarifa.id)) {
        throw new CadastroRecusadoError('nome-repetido')
      }

      tarifa.nome = entrada.nome.trim()
      tarifa.diariaPorPorte = { ...entrada.diariaPorPorte }
      tarifa.acompanhantePercentual = entrada.acompanhantePercentual

      /*
       * O preço muda daqui para a frente, e **não** reescreve reserva já fechada: o orçamento é
       * gravado no momento da venda. Reajustar em dezembro não pode reescrever o que o cliente
       * pagou em julho — e é por isso que este método não toca em `reservas`.
       */
      return tarifa
    })
  },

  removerTarifa(tarifaId: string): Promise<void> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()

      if (!dataset.tarifas.some((item) => item.id === tarifaId)) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      if (dataset.acomodacoes.some((item) => item.tarifaId === tarifaId)) {
        throw new CadastroRecusadoError('em-uso')
      }

      if (dataset.tarifas.length <= 1) {
        throw new CadastroRecusadoError('ultimo')
      }

      dataset.tarifas = dataset.tarifas.filter((item) => item.id !== tarifaId)
    })
  },

  // ------------------------------------------------------------------- temporadas

  criarTemporada(entrada: {
    nome: string
    inicioMesDia: string
    fimMesDia: string
    acrescimoPercentual: number
  }): Promise<TemporadaSazonal> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()

      if (!entrada.nome.trim() || nomeExiste(dataset.temporadasSazonais, entrada.nome)) {
        throw new CadastroRecusadoError('nome-repetido')
      }

      const temporada: TemporadaSazonal = {
        id: `temporada-${identificador(entrada.nome)}`,
        nome: entrada.nome.trim(),
        inicioMesDia: entrada.inicioMesDia,
        fimMesDia: entrada.fimMesDia,
        acrescimoPercentual: entrada.acrescimoPercentual,
      }

      dataset.temporadasSazonais.push(temporada)
      remontarTemporadas()

      return temporada
    })
  },

  editarTemporada(entrada: {
    temporadaId: string
    nome: string
    inicioMesDia: string
    fimMesDia: string
    acrescimoPercentual: number
  }): Promise<TemporadaSazonal> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()
      const temporada = dataset.temporadasSazonais.find((item) => item.id === entrada.temporadaId)

      if (!temporada) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      if (!entrada.nome.trim() || nomeExiste(dataset.temporadasSazonais, entrada.nome, temporada.id)) {
        throw new CadastroRecusadoError('nome-repetido')
      }

      temporada.nome = entrada.nome.trim()
      temporada.inicioMesDia = entrada.inicioMesDia
      temporada.fimMesDia = entrada.fimMesDia
      temporada.acrescimoPercentual = entrada.acrescimoPercentual

      remontarTemporadas()

      return temporada
    })
  },

  removerTemporada(temporadaId: string): Promise<void> {
    return simularChamada('catalogo.salvar', () => {
      const dataset = getDataset()

      if (!dataset.temporadasSazonais.some((item) => item.id === temporadaId)) {
        throw new CadastroRecusadoError('nao-encontrada')
      }

      /* Temporada não tem quem aponte para ela: o preço a consulta por data, não por referência. */
      dataset.temporadasSazonais = dataset.temporadasSazonais.filter(
        (item) => item.id !== temporadaId,
      )
      remontarTemporadas()
    })
  },
}
