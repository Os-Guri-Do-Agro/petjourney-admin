/**
 * As frases do migrador.
 *
 * O domínio devolve `tipo`; a tela precisa de **frase de balcão**. "Telefone (11) 8411-2299 virou
 * (11) 98411-2299: faltava o 9 do celular" diz o que aconteceu e por quê; "telefone-nono-digito"
 * não diz nada a quem opera. Toda explicação de linha sai daqui, montada como sentença inteira,
 * com o valor de antes e o de depois já formatados.
 */
import { useI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

import type { PetSpecies } from '../data/types'
import {
  ehDescarte,
  type Ajuste,
  type CampoDeDestino,
  type ConflitoDaMescla,
  type Decisao,
  type ItemDoPlano,
  type MotivoDeFora,
  type SituacaoDaLinha,
} from '../domain/migracao'
import { letraDaColuna } from '../domain/planilha'

import { useClinicFormat } from './useClinicFormat'

/** O ícone de cada situação. É ele, e não a cor, que carrega o estado em escala de cinza. */
export const ICONE_DA_SITUACAO: Record<SituacaoDaLinha, string> = {
  entra: 'pi pi-check-circle',
  junta: 'pi pi-link',
  contato: 'pi pi-user',
  pendente: 'pi pi-question-circle',
  fora: 'pi pi-times-circle',
}

export type TomDaFrase = 'ok' | 'corrigido' | 'perdido' | 'fora' | 'aviso'

export type FraseDaLinha = { tom: TomDaFrase; texto: string }

export function useRotulosDaMigracao() {
  const { t, locale } = useI18n()
  const formato = useClinicFormat()

  function campo(nome: CampoDeDestino): string {
    return t(`clinico.migracao.campo.${nome}`)
  }

  function coluna(indice: number, cabecalho: string): string {
    return cabecalho || t('clinico.migracao.colunas.semTitulo', { letra: letraDaColuna(indice) })
  }

  function situacao(nome: SituacaoDaLinha): string {
    return t(`clinico.migracao.situacao.${nome}`)
  }

  function motivo(nome: MotivoDeFora): string {
    return t(`clinico.migracao.motivo.${nome}.titulo`)
  }

  function acaoDoMotivo(nome: MotivoDeFora): string {
    return t(`clinico.migracao.motivo.${nome}.acao`)
  }

  function data(iso: string): string {
    const intl = INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE]

    return new Intl.DateTimeFormat(intl, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T12:00:00Z`))
  }

  function especie(valor: PetSpecies | null): string {
    return valor ? formato.especie(valor) : t('clinico.migracao.comum.semEspecie')
  }

  /** O valor como a clínica vai vê-lo no cadastro — não como está guardado. */
  function valor(nome: CampoDeDestino, texto: string | null): string {
    if (texto === null || texto === '') {
      return t('clinico.migracao.comum.emBranco')
    }

    if ((nome === 'nascimento' || nome === 'idade') && /^\d{4}-\d{2}-\d{2}$/.test(texto)) {
      return data(texto)
    }

    if (nome === 'peso' && Number.isFinite(Number(texto))) {
      return formato.peso(Number(texto))
    }

    if (nome === 'especie') {
      return formato.especie(texto as PetSpecies)
    }

    if (nome === 'sexo' && (texto === 'macho' || texto === 'femea')) {
      return t(`clinico.sexo.${texto}`)
    }

    return texto
  }

  /** Uma frase inteira para um ajuste: o que estava, o que ficou, e por quê. */
  function fraseDoAjuste(ajuste: Ajuste): FraseDaLinha {
    const parametros = {
      campo: campo(ajuste.campo),
      de: ajuste.de,
      para: ajuste.para === null ? '' : valor(ajuste.campo, ajuste.para),
    }
    const chave =
      ajuste.tipo === 'especie-escolhida' && !ajuste.de ? 'especie-escolhida-branco' : ajuste.tipo

    return {
      tom: ehDescarte(ajuste.tipo) ? 'perdido' : 'corrigido',
      texto: t(`clinico.migracao.ajuste.${chave}`, parametros),
    }
  }

  function fraseDoConflito(conflito: ConflitoDaMescla): string {
    return t('clinico.migracao.linhas.conflito', {
      campo: campo(conflito.campo),
      mantido: valor(conflito.campo, conflito.mantido),
      ignorado: valor(conflito.campo, conflito.ignorado),
    })
  }

  /** A primeira frase de uma linha: o que vai acontecer (ou aconteceu) com ela. */
  function oQueAcontece(item: ItemDoPlano, decisoes?: Map<string, Decisao>): string {
    if (item.situacao === 'fora') {
      return item.motivos.map(motivo).join(' · ')
    }

    if (item.situacao === 'pendente') {
      const pendente = item.decisoes
        .map((id) => decisoes?.get(id))
        .find((decisao) => decisao && decisao.escolha === null)

      return pendente ? t(`clinico.migracao.duvidas.${pendente.tipo}.curta`) : situacao('pendente')
    }

    if (item.situacao === 'contato') {
      return item.tutorExistente
        ? t('clinico.migracao.acontece.contatoExistente', { nome: item.tutorExistente.nome })
        : t('clinico.migracao.acontece.contato')
    }

    if (item.juntaComLinha !== null) {
      return t('clinico.migracao.acontece.mesmaLinha', { linha: item.juntaComLinha })
    }

    if (item.petExistente) {
      return t('clinico.migracao.acontece.animalExistente', { nome: item.petExistente.nome })
    }

    return item.tutorExistente
      ? t('clinico.migracao.acontece.novoDeExistente', { nome: item.tutorExistente.nome })
      : t('clinico.migracao.acontece.novo')
  }

  /**
   * A explicação completa de uma linha, frase por frase, na ordem em que se pergunta: por que
   * ficou de fora (e o que fazer), o que foi corrigido, o que não foi aproveitado, onde a planilha
   * discordou do cadastro, e o que falta completar.
   */
  function frasesDaLinha(item: ItemDoPlano): FraseDaLinha[] {
    const frases: FraseDaLinha[] = []

    for (const nome of item.motivos) {
      /* O título do motivo já é a primeira frase da linha (`oQueAcontece`); aqui vem o que fazer. */
      frases.push({ tom: 'fora', texto: acaoDoMotivo(nome) })
    }

    for (const ajuste of item.ajustes) {
      frases.push(fraseDoAjuste(ajuste))
    }

    for (const mescla of [item.mesclaDoResponsavel, item.mesclaDoAnimal]) {
      for (const nome of mescla?.preenche ?? []) {
        frases.push({
          tom: 'ok',
          texto: t('clinico.migracao.linhas.preenche', { campo: campo(nome) }),
        })
      }

      for (const conflito of mescla?.conflitos ?? []) {
        frases.push({ tom: 'aviso', texto: fraseDoConflito(conflito) })
      }
    }

    if (item.avisos.includes('sem-contato')) {
      frases.push({ tom: 'aviso', texto: t('clinico.migracao.linhas.semContato') })
    }

    return frases
  }

  return {
    campo,
    coluna,
    situacao,
    motivo,
    acaoDoMotivo,
    valor,
    data,
    especie,
    oQueAcontece,
    frasesDaLinha,
  }
}
