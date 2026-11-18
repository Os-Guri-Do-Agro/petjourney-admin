/**
 * Os números da abertura do Início: o mesmo painel do Hoje da Clínica e do Hoje do Hotel, com a
 * frase à esquerda e, à direita, os poucos números que dizem por onde começar.
 *
 * São os números do bloco da Clínica, com a mesma régua — o painel só os reúne no alto: quem
 * espera na recepção, quem está em consulta, os pedidos e o que vem a seguir. O Hotel entra quando
 * a rota do dia dele chegar à API. A conta só com o Portal não ganha número no alto: as áreas do
 * Portal, logo embaixo, já são o resumo inteiro.
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
    clinicaNoInicio: hasClinicalProfile,
    pedidosDaClinica,
    pedidosDaClinicaCarregados,
  } = useEspacos()

  const daClinica = computed<IndicadorDaAbertura[]>(() => {
    const agenda = dia.clinica.value
    const contagem = contarPorEstado(agenda.contas)
    const agora = dia.agora.value
    /* O mesmo recorte do "A seguir" do Hoje: marcado e ainda por vir. */
    const porVir = agenda.contas.filter(
      (conta) => conta.estado === 'marcado' && (agora === null || conta.inicio > agora),
    ).length
    const pedidos = pedidosDaClinica.value

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
        valor: pedidosDaClinicaCarregados.value ? pedidos.total : null,
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

  return computed<IndicadorDaAbertura[]>(() => (hasClinicalProfile.value ? daClinica.value : []))
}
