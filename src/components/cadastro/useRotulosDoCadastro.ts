/**
 * Os rótulos do cadastro de clientes e pacientes pela API (E2-01): espécie, sexo, porte, idade,
 * alertas, motivos de inativação e contato preferido, nos 6 idiomas (`cadastro.*`).
 *
 * As datas de dia (`AAAA-MM-DD`) são lidas como texto, sem `new Date()`: no fuso do Brasil, a
 * meia-noite UTC cai no dia anterior.
 */
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  idadeEmMeses,
  type Alerta,
  type PacienteNaLista,
  type SeveridadeDoAlerta,
  type TipoDeAlerta,
} from '@/service/parceiro/pacientes-service'

export const ICONE_DO_ALERTA: Record<TipoDeAlerta, string> = {
  ALERGIA: 'ph ph-warning-octagon',
  AGRESSIVO: 'ph ph-hand-palm',
  CRONICO: 'ph ph-heartbeat',
  MEDICACAO_CONTINUA: 'ph ph-pill',
  IMUNOSSUPRIMIDO: 'ph ph-shield-warning',
  GESTANTE: 'ph ph-baby',
  INADIMPLENTE: 'ph ph-currency-circle-dollar',
}

/** O tom do selo: o risco pinta o selo, a atenção também; a informação fica neutra. */
export const TOM_DA_SEVERIDADE: Record<SeveridadeDoAlerta, string> = {
  RISCO: 'ui-selo--risco',
  ATENCAO: 'ui-selo--atencao',
  INFO: '',
}

const PESO_DA_SEVERIDADE: Record<SeveridadeDoAlerta, number> = { RISCO: 0, ATENCAO: 1, INFO: 2 }

/** Os ativos, do mais grave para o mais leve. */
export function alertasPorGravidade(alertas: readonly Alerta[]): Alerta[] {
  return alertas
    .filter((alerta) => alerta.ativo)
    .sort((a, b) => PESO_DA_SEVERIDADE[a.severidade] - PESO_DA_SEVERIDADE[b.severidade])
}

export function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .map((parte) => parte[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase()
}

export function useRotulosDoCadastro() {
  const { t, locale } = useI18n()

  function intl() {
    return INTL_LOCALE[locale.value as Locale]
  }

  function especie(paciente: Pick<PacienteNaLista, 'especie' | 'especieOutra'>) {
    if (paciente.especie === 'OUTRO') {
      return paciente.especieOutra || t('cadastro.especie.OUTRO')
    }

    return t(`cadastro.especie.${paciente.especie}`)
  }

  /** "6 anos", "8 meses"; com "cerca de" quando a data veio de uma idade dita no balcão. */
  function idade(nascimento: string | null, estimado = false) {
    const meses = idadeEmMeses(nascimento)
    if (meses === null) return ''

    const texto =
      meses >= 12
        ? t('cadastro.idade.anos', { n: Math.floor(meses / 12) }, Math.floor(meses / 12))
        : t('cadastro.idade.meses', { n: meses }, meses)

    return estimado ? t('cadastro.idade.estimada', { idade: texto }) : texto
  }

  /** `AAAA-MM-DD` por extenso, sem passar pelo fuso. */
  function dia(valor: string | null) {
    if (!valor) return ''

    const [ano, mes, d] = valor.split('-').map(Number)
    if (!ano || !mes || !d) return valor

    return new Intl.DateTimeFormat(intl(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(Date.UTC(ano, mes - 1, d))
  }

  /** Instante (`date-time`) em data por extenso, no fuso de quem olha. */
  function data(instante: string | null) {
    if (!instante) return ''

    return new Date(instante).toLocaleDateString(intl(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  function peso(kg: number | null) {
    if (kg === null || kg === undefined) return ''

    return t('cadastro.pesoKg', {
      kg: new Intl.NumberFormat(intl(), { maximumFractionDigits: 2 }).format(kg),
    })
  }

  function alerta(tipo: TipoDeAlerta) {
    return t(`cadastro.alerta.tipo.${tipo}`)
  }

  function severidade(valor: SeveridadeDoAlerta) {
    return t(`cadastro.alerta.severidade.${valor}`)
  }

  /** "Óbito em 3 de nov. de 2026", "Transferido", "Mesclado com outro cadastro"... */
  function situacao(paciente: Pick<PacienteNaLista, 'ativo' | 'inativoMotivo' | 'obitoEm'>) {
    if (paciente.ativo) return ''
    if (paciente.inativoMotivo === 'OBITO' && paciente.obitoEm) {
      return t('cadastro.inativo.obitoEm', { data: dia(paciente.obitoEm) })
    }

    return t(`cadastro.inativo.motivo.${paciente.inativoMotivo ?? 'OUTRO'}`)
  }

  return { especie, idade, dia, data, peso, alerta, severidade, situacao, intl }
}
