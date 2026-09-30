/**
 * As palavras da adesão ao tratamento, num lugar só.
 *
 * A regra do requisito mora mais no texto do que no desenho: **sem tom de julgamento.** Por isso
 * a tela conta ("39 dadas · 1 pulada · 1 sem registro") e não dá nota — nem porcentagem, nem
 * "adesão boa/ruim", nem "falhou". E a dose sem registro nunca é somada com a pulada: são duas
 * frases diferentes, porque são dois fatos diferentes.
 *
 * Cada tela da adesão (ficha, lista da clínica, "Este pet em 30 segundos", prévia do celular)
 * passa por aqui, para que "pulada" e "sem registro" queiram dizer a mesma coisa em todas.
 */
import { useI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

import type { Medication, TratamentoEmCasa } from '../data/types'
import type {
  AlertaDeAdesao,
  ContagemDeMotivo,
  HorarioDaGrade,
  ResumoDaAdesao,
} from '../domain/adesao'
import { fracionar } from '../domain/receita'
import { clinicClock, useClinicoStore } from '../stores/clinico'

import { useClinicFormat } from './useClinicFormat'

type Posologia = Pick<
  TratamentoEmCasa,
  'medicamentoId' | 'medicamento' | 'quantidade' | 'unidade' | 'frequenciaHoras' | 'duracaoDias'
>

export function useRotulosDoTratamento() {
  const { t, locale } = useI18n()
  const formato = useClinicFormat()
  const clinico = useClinicoStore()

  function lista(itens: string[]): string {
    const tag = INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE]

    return new Intl.ListFormat(tag, { type: 'conjunction' }).format(itens)
  }

  /** O nome do bulário, no idioma da tela; o da receita quando o bulário não o conhece. */
  function nome(tratamento: Pick<TratamentoEmCasa, 'medicamentoId' | 'medicamento'>): string {
    return (
      (tratamento.medicamentoId && clinico.medicamento(tratamento.medicamentoId)?.nome) ||
      tratamento.medicamento
    )
  }

  /** "meio comprimido", "0,36 mL" — nunca "0,5 comprimido". */
  function dose(quantidade: number, unidade: Medication['unidadeApresentacao']): string {
    if (unidade === 'ml') {
      return t('clinico.adesao.dose.ml', { quantidade: formato.numero(quantidade, 2) })
    }

    const fracao = fracionar(quantidade, unidade)

    if (fracao && ['meio', 'quarto', 'tres-quartos', 'um-e-meio'].includes(fracao.kind)) {
      return t(`clinico.adesao.dose.${fracao.kind}`)
    }

    const inteiro = fracao?.quantidade ?? quantidade

    /* A própria quantidade escolhe a forma: sérvio e árabe têm mais de duas, e 0,37 é "other". */
    return t(
      'clinico.adesao.dose.comprimido',
      { quantidade: formato.numero(inteiro, Number.isInteger(inteiro) ? 0 : 2) },
      inteiro,
    )
  }

  /** "meio comprimido · a cada 24 h · uso contínuo". */
  function posologia(tratamento: Posologia): string {
    return [
      dose(tratamento.quantidade, tratamento.unidade),
      t('clinico.adesao.posologia.aCada', { horas: tratamento.frequenciaHoras }),
      tratamento.duracaoDias === null
        ? t('clinico.adesao.posologia.continuo')
        : t(
            'clinico.adesao.posologia.porDias',
            { dias: tratamento.duracaoDias },
            tratamento.duracaoDias,
          ),
    ].join(' · ')
  }

  function motivos(lista_: ContagemDeMotivo[]): string {
    return lista(lista_.map((item) => t(`clinico.adesao.motivoNaFrase.${item.motivo}`)))
  }

  /**
   * "39 dadas · 1 pulada (acabou o remédio) · 1 sem registro".
   *
   * As partes zeradas somem, menos "dadas": "0 dadas" é informação, e sumir com ela deixaria a
   * frase começando por "pulada", que é justamente o tom que a tela não pode ter.
   */
  function contagem(resumo: ResumoDaAdesao): string {
    if (resumo.fechadas === 0) {
      return t('clinico.adesao.contagem.nenhuma')
    }

    const partes = [t('clinico.adesao.contagem.dadas', { total: resumo.dadas }, resumo.dadas)]

    if (resumo.puladas > 0) {
      const puladas = t(
        'clinico.adesao.contagem.puladas',
        { total: resumo.puladas },
        resumo.puladas,
      )

      partes.push(resumo.motivos.length > 0 ? `${puladas} (${motivos(resumo.motivos)})` : puladas)
    }

    if (resumo.semRegistro > 0) {
      partes.push(
        t('clinico.adesao.contagem.semRegistro', { total: resumo.semRegistro }, resumo.semRegistro),
      )
    }

    return partes.join(' · ')
  }

  /** "Desde a consulta de 19/08" ou "Desde o início, 26/09". */
  function periodo(resumo: ResumoDaAdesao, ultimaConsultaEm: string | null): string {
    const data = formato.dataCurta(clinicClock.dateOf(resumo.desde))

    return ultimaConsultaEm && resumo.desde === ultimaConsultaEm
      ? t('clinico.adesao.periodo.desdeConsulta', { data })
      : t('clinico.adesao.periodo.desdeInicio', { data })
  }

  /** "Registrado por Fátima (31) e Rafael (9)". Vazio quando ninguém registrou nada. */
  function quem(resumo: ResumoDaAdesao, nomes: Record<string, string>): string {
    if (resumo.porCuidador.length === 0) {
      return ''
    }

    return t('clinico.adesao.quem', {
      lista: lista(
        resumo.porCuidador.map(
          (item) => `${primeiroNome(nomes[item.cuidadorId] ?? '')} (${item.registros})`,
        ),
      ),
    })
  }

  function horarioDestoante(horario: HorarioDaGrade): string {
    return t('clinico.adesao.horarioDestoante', {
      horario: horario.horario,
      dadas: horario.dadas,
      fechadas: horario.fechadas,
    })
  }

  /**
   * O alerta em duas linhas: o que aconteceu, e o que havia antes.
   *
   * O motivo da casa vem junto, nas palavras dela — "acabou o remédio" é a frase que diz à
   * clínica o que fazer.
   */
  function alerta(item: AlertaDeAdesao): { titulo: string; detalhe: string } {
    const quando = diaEHora(item.desde)
    const titulo =
      item.motivo === 'puladas'
        ? t(
            'clinico.adesao.alerta.puladas',
            { total: item.janela.puladas, quando },
            item.janela.puladas,
          )
        : t('clinico.adesao.alerta.queda', {
            dadas: item.janela.dadas,
            fechadas: item.janela.fechadas,
            quando,
          })

    const detalhe = [
      item.motivos.length > 0
        ? t('clinico.adesao.alerta.motivos', { motivos: motivos(item.motivos) })
        : '',
      item.antes
        ? t('clinico.adesao.alerta.antes', {
            dadas: item.antes.dadas,
            fechadas: item.antes.fechadas,
          })
        : '',
    ]
      .filter(Boolean)
      .join(' ')

    return { titulo, detalhe }
  }

  function primeiroNome(completo: string): string {
    return completo.trim().split(/\s+/)[0] ?? completo
  }

  /** "29/09, 08:00" — o dia e a hora da dose, no relógio da clínica. */
  function diaEHora(iso: string): string {
    return t('clinico.adesao.faixa.quando', {
      data: formato.dataCurta(clinicClock.dateOf(iso)),
      hora: formato.hora(iso),
    })
  }

  return {
    diaEHora,
    nome,
    dose,
    posologia,
    contagem,
    periodo,
    quem,
    horarioDestoante,
    alerta,
    lista,
    primeiroNome,
  }
}
