/**
 * Os rótulos da anamnese por voz: nome do campo, valor por extenso, alerta e relógio.
 *
 * Os nomes dos campos e das opções são **os mesmos da anamnese** (`clinico.prontuario.anamnese.*`)
 * — a proposta e o formulário embaixo dela precisam chamar a mesma coisa pelo mesmo nome, senão
 * a revisão vira um exercício de tradução entre duas telas.
 */
import { useI18n } from 'vue-i18n'

import type { AntecedenteKind } from '../data/types'
import type {
  AlertaDaProposta,
  CampoDaEscuta,
  PropostaDaEscuta,
  ValorDaEscuta,
} from '../domain/escuta'

/** A chave do rótulo de cada campo na anamnese. */
const CHAVE_DO_CAMPO: Record<Exclude<CampoDaEscuta, 'antecedente'>, string> = {
  queixaPrincipal: 'queixaPrincipal',
  duracaoSintomas: 'duracaoSintomas',
  evolucao: 'evolucao',
  historia: 'historia',
  apetite: 'apetite',
  evacuacao: 'evacuacao',
  miccao: 'miccao',
  ambiente: 'ambiente',
  vacinacaoEmDia: 'vacinacao',
  vermifugacaoEmDia: 'vermifugacao',
}

export function useRotulosDaEscuta() {
  const { t } = useI18n()

  function campo(nome: CampoDaEscuta, tipo: AntecedenteKind | null = null): string {
    if (nome === 'antecedente') {
      return tipo
        ? t(`clinico.prontuario.anamnese.antecedenteKind.${tipo}`)
        : t('clinico.escuta.proposta.antecedente')
    }

    return t(`clinico.prontuario.anamnese.${CHAVE_DO_CAMPO[nome]}`)
  }

  function valor(nome: CampoDaEscuta, bruto: ValorDaEscuta, quando = ''): string {
    if (typeof bruto === 'boolean') {
      return t(`clinico.prontuario.anamnese.opcoes.${bruto ? 'sim' : 'nao'}`)
    }

    if (nome === 'evolucao') {
      return bruto ? t(`clinico.prontuario.anamnese.evolucaoOpcoes.${bruto}`) : ''
    }

    if (nome === 'apetite' || nome === 'evacuacao' || nome === 'miccao' || nome === 'ambiente') {
      return bruto ? t(`clinico.prontuario.anamnese.opcoes.${bruto}`) : ''
    }

    return nome === 'antecedente' && quando ? `${bruto} · ${quando}` : bruto
  }

  function alerta(nome: AlertaDaProposta, proposta: PropostaDaEscuta): string {
    if (nome === 'divergencia') {
      const outros = proposta.divergencias.map((item) => valor(proposta.campo, item.valor))

      return t('clinico.escuta.alerta.divergencia', { valor: outros.join(' · ') })
    }

    return t(`clinico.escuta.alerta.${nome}`)
  }

  /** Relógio da gravação, "01:07". Passa de uma hora sem quebrar, embora consulta não passe. */
  function relogio(ms: number): string {
    const segundos = Math.max(0, Math.floor(ms / 1000))
    const minutos = Math.floor(segundos / 60)

    return `${String(minutos).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`
  }

  return { campo, valor, alerta, relogio }
}
