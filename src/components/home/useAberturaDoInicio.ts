/**
 * Os números da abertura do Início: o mesmo painel do Hoje da Clínica e do Hoje do Hotel, com a
 * frase à esquerda e, à direita, os poucos números que dizem por onde começar.
 *
 * São os números dos blocos de cada espaço, na mesma ordem e com a mesma régua — o painel só os
 * reúne no alto. Com Clínica e Hotel, os dois primeiros de cada (quem espera na recepção, quem está
 * em consulta, quem está na casa, quem chega hoje); com um espaço só, os quatro dele. A conta só com
 * o Portal não ganha número no alto: o bloco do Portal já é o resumo inteiro.
 */

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { IndicadorDaAbertura } from '@/components/ui/UiAbertura.vue'
import type { TomDePendencia } from '@/features/clinico/composables/useClinicoPendencias'
import { useEspacos } from '@/navegacao/espacos'

import { contarPorEstado } from './linha-do-dia'
import type { CargaDaFaixa, DiaDaCasa } from './useLinhaDoDia'

/** Número que depende do dia: esqueleto carregando, traço se ele não veio. */
function doDia(carga: CargaDaFaixa, total: number) {
  if (carga === 'pronta') return total
  if (carga === 'falhou') return '–'

  return null
}

/** Só o que é alerta ganha o ponto no quadro; o neutro fica limpo. */
function pontoDo(total: number, tom: TomDePendencia): IndicadorDaAbertura['tom'] {
  return total > 0 && tom !== 'neutro' ? tom : undefined
}

export function useAberturaDoInicio(dia: DiaDaCasa) {
  const { t } = useI18n()
  const {
    clinicaNaDemonstracao: hasClinicalProfile,
    hotelNaDemonstracao: hasHotelProfile,
    pendenciasClinicas,
    pendenciasDoHotel,
  } = useEspacos()

  const daClinica = computed<IndicadorDaAbertura[]>(() => {
    const agenda = dia.clinica.value
    const contagem = contarPorEstado(agenda.contas)
    const agora = dia.agora.value
    /* O mesmo recorte do "A seguir" do Hoje: marcado e ainda por vir. */
    const porVir = agenda.contas.filter(
      (conta) => conta.estado === 'marcado' && (agora === null || conta.inicio > agora),
    ).length
    const pedidos = pendenciasClinicas.pedidos.value

    return [
      {
        id: 'recepcao',
        valor: doDia(agenda.carga, contagem.esperando),
        rotulo: t('inicio.espacos.clinica.recepcao'),
        icone: 'ph ph-door-open',
        to: '/clinica/meu-dia',
        tom: contagem.esperando > 0 ? 'atencao' : undefined,
      },
      {
        id: 'consulta',
        valor: doDia(agenda.carga, contagem.agora),
        rotulo: t('inicio.espacos.clinica.consulta'),
        icone: 'ph ph-stethoscope',
        to: '/clinica/meu-dia',
      },
      {
        id: 'pedidos',
        valor: pendenciasClinicas.carregado.value ? pedidos.total : null,
        rotulo: t('inicio.espacos.clinica.pedidos', { total: pedidos.total }, pedidos.total),
        icone: 'ph ph-calendar-plus',
        to: '/clinica/pedidos',
        tom: pontoDo(pedidos.total, pedidos.tom),
      },
      {
        id: 'aSeguir',
        valor: doDia(agenda.carga, porVir),
        rotulo: t('inicio.espacos.clinica.aSeguir'),
        icone: 'ph ph-clock',
        to: '/clinica/agenda',
      },
    ]
  })

  const doHotel = computed<IndicadorDaAbertura[]>(() => {
    const casa = dia.hotel.value
    const chegam = casa.movimentos.filter((movimento) => movimento.tipo === 'chegada')
    const saem = casa.movimentos.filter((movimento) => movimento.tipo === 'saida')
    const rotina = pendenciasDoHotel.rotina.value

    return [
      {
        id: 'casa',
        valor: doDia(casa.carga, casa.hospedes),
        rotulo: t('inicio.espacos.hotel.naCasa'),
        icone: 'ph ph-house-line',
        to: '/hotel/hospedes',
      },
      {
        id: 'chegam',
        valor: doDia(casa.carga, chegam.length),
        rotulo: t('inicio.espacos.hotel.chegam', { total: chegam.length }, chegam.length),
        icone: 'ph ph-sign-in',
        to: '/hotel/painel',
        /* Chegada sem documento não entra até alguém resolver: é o alerta do quadro. */
        tom: chegam.some((movimento) => movimento.travado) ? 'risco' : undefined,
      },
      {
        id: 'saem',
        valor: doDia(casa.carga, saem.length),
        rotulo: t('inicio.espacos.hotel.saem', { total: saem.length }, saem.length),
        icone: 'ph ph-sign-out',
        to: '/hotel/painel',
      },
      {
        id: 'rotina',
        valor: pendenciasDoHotel.carregado.value ? rotina.total : null,
        rotulo: t('inicio.espacos.hotel.rotina', { total: rotina.total }, rotina.total),
        icone: 'ph ph-list-checks',
        to: '/hotel/rotina',
        tom: pontoDo(rotina.total, rotina.tom),
      },
    ]
  })

  return computed<IndicadorDaAbertura[]>(() => {
    const clinica = hasClinicalProfile.value
    const hotel = hasHotelProfile.value

    if (clinica && hotel) {
      return [...daClinica.value.slice(0, 2), ...doHotel.value.slice(0, 2)]
    }

    if (clinica) return daClinica.value
    if (hotel) return doHotel.value

    return []
  })
}
