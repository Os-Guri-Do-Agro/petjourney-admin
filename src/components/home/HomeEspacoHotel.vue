<script setup lang="ts">
/**
 * O Hotel no Início: quem está na casa, quem entra e sai hoje, e quanto da rotina atrasou.
 *
 * Os mesmos quatro números da fita da casa, vistos de fora:
 *
 * - **na casa** — os animais hospedados (a estadia com acompanhante conta dois), com a ocupação;
 * - **chegam hoje** — as reservas de hoje que ainda não viraram estadia, com quantas estão sem
 *   documento (não entram até alguém resolver) ou atrasadas;
 * - **saem hoje** — quem sai hoje e ainda está na casa;
 * - **tarefas atrasadas** — a rotina que passou da janela, com as medicações à parte (é a mesma
 *   contagem do selo da barra, `pendenciasDoHotel`).
 *
 * O próximo passo: medicação atrasada primeiro, depois chegada sem documento, chegada ou saída
 * atrasadas, o resto da rotina atrasada e, por fim, o próximo movimento do dia.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEspacos, type Espaco } from '@/navegacao/espacos'

import type { NumeroDoEspaco, PassoDoEspaco } from './espaco-da-home'
import HomeEspaco from './HomeEspaco.vue'
import { horaDaParede, movimentoAtrasado, type MovimentoDoDia } from './linha-do-dia'
import { useDiaDaCasa } from './useLinhaDoDia'

defineProps<{ espaco: Espaco }>()

const { t } = useI18n()
const dia = useDiaDaCasa()
const { pendenciasDoHotel } = useEspacos()

const casa = computed(() => dia.hotel.value)
const pronta = computed(() => casa.value.carga === 'pronta')
const falhou = computed(() => casa.value.carga === 'falhou')

const chegadas = computed(() =>
  casa.value.movimentos.filter((movimento) => movimento.tipo === 'chegada'),
)
const saidas = computed(() =>
  casa.value.movimentos.filter((movimento) => movimento.tipo === 'saida'),
)

function atrasado(movimento: MovimentoDoDia) {
  return movimentoAtrasado(movimento, dia.agora.value)
}

const rotina = computed(() => pendenciasDoHotel.rotina.value)
const rotinaCarregada = computed(() => pendenciasDoHotel.carregado.value)

function daCasa(total: number) {
  if (pronta.value) return total
  if (falhou.value) return '–'

  return null
}

/**
 * A linha de apoio de chegadas e saídas: o que trava, o que atrasou, ou a hora do próximo. Uma
 * coisa só, a mais grave.
 */
function metaDosMovimentos(lista: MovimentoDoDia[], comTrava: boolean) {
  const travados = comTrava ? lista.filter((movimento) => movimento.travado).length : 0

  if (travados > 0) {
    return {
      texto: t('inicio.espacos.hotel.semDocumento', { total: travados }, travados),
      tom: 'risco' as const,
    }
  }

  const atrasados = lista.filter(atrasado).length

  if (atrasados > 0) {
    return {
      texto: t('inicio.espacos.hotel.atrasadas', { total: atrasados }, atrasados),
      tom: 'atencao' as const,
    }
  }

  const proximo = lista[0]

  return {
    texto: proximo
      ? t('inicio.espacos.hotel.proximaAs', { hora: horaDaParede(proximo.quando) })
      : '',
    tom: lista.length > 0 ? ('neutro' as const) : ('apagado' as const),
  }
}

const numeros = computed<NumeroDoEspaco[]>(() => {
  const hospedes = casa.value.hospedes
  const ocupacao = casa.value.ocupacao
  const entram = metaDosMovimentos(chegadas.value, true)
  const saem = metaDosMovimentos(saidas.value, false)
  const atrasadas = rotina.value.total

  return [
    {
      id: 'casa',
      valor: daCasa(hospedes),
      rotulo: t('inicio.espacos.hotel.naCasa'),
      meta:
        ocupacao && ocupacao.operando > 0
          ? t(
              'inicio.espacos.hotel.ocupacao',
              { ocupadas: ocupacao.ocupadas, total: ocupacao.operando },
              ocupacao.operando,
            )
          : '',
      tom: hospedes > 0 ? 'lugar' : 'apagado',
      to: '/hotel/hospedes',
    },
    {
      id: 'chegam',
      valor: daCasa(chegadas.value.length),
      rotulo: t(
        'inicio.espacos.hotel.chegam',
        { total: chegadas.value.length },
        chegadas.value.length,
      ),
      meta: entram.texto,
      tom: entram.tom,
      to: '/hotel/painel',
    },
    {
      id: 'saem',
      valor: daCasa(saidas.value.length),
      rotulo: t('inicio.espacos.hotel.saem', { total: saidas.value.length }, saidas.value.length),
      meta: saem.texto,
      tom: saem.tom,
      to: '/hotel/painel',
    },
    {
      id: 'rotina',
      valor: rotinaCarregada.value ? atrasadas : null,
      rotulo: t('inicio.espacos.hotel.rotina', { total: atrasadas }, atrasadas),
      meta: (rotina.value.partes ?? [])
        .map((item) => t(`inicio.pauta.parte.${item.chave}`, { total: item.total }, item.total))
        .join(' · '),
      tom: atrasadas > 0 ? rotina.value.tom : 'apagado',
      to: '/hotel/rotina',
    },
  ]
})

/** Quanto da rotina de hoje já foi feito. */
const andamento = computed(() => {
  const { feitas, total } = casa.value.rotina

  if (!pronta.value || total === 0) {
    return null
  }

  return {
    texto: t('inicio.espacos.hotel.andamento', { feitas, total }, total),
    percentual: Math.round((feitas / total) * 100),
  }
})

function rotaComPedido(rota: string, pedido: 'checkin' | 'checkout') {
  return { path: rota, query: { [pedido]: '1' } }
}

const passo = computed<PassoDoEspaco | null>(() => {
  const atrasadas = rotina.value.total
  const passoDaRotina = {
    rotulo: t('inicio.passo.rotina', { total: atrasadas }, atrasadas),
    icone: 'ph ph-list-checks',
    to: '/hotel/rotina',
  }

  if (atrasadas > 0 && rotina.value.tom === 'risco') {
    return passoDaRotina
  }

  const travada = chegadas.value.find((movimento) => movimento.travado)

  if (travada) {
    return {
      rotulo: t('inicio.passo.documento', { pet: travada.petNome }),
      icone: 'ph ph-file-x',
      to: travada.rota,
    }
  }

  const emAtraso = casa.value.movimentos.find(atrasado)

  if (emAtraso) {
    return emAtraso.tipo === 'chegada'
      ? {
          rotulo: t('inicio.passo.checkin', { pet: emAtraso.petNome }),
          icone: 'ph ph-sign-in',
          to: rotaComPedido(emAtraso.rota, 'checkin'),
        }
      : {
          rotulo: t('inicio.passo.checkout', { pet: emAtraso.petNome }),
          icone: 'ph ph-sign-out',
          to: rotaComPedido(emAtraso.rota, 'checkout'),
        }
  }

  if (atrasadas > 0) {
    return passoDaRotina
  }

  const proximo = casa.value.movimentos[0]

  if (proximo) {
    const hora = horaDaParede(proximo.quando)

    return proximo.tipo === 'chegada'
      ? {
          rotulo: t('inicio.passo.receber', { pet: proximo.petNome, hora }),
          icone: 'ph ph-sign-in',
          to: proximo.rota,
        }
      : {
          rotulo: t('inicio.passo.entregar', { pet: proximo.petNome, hora }),
          icone: 'ph ph-sign-out',
          to: proximo.rota,
        }
  }

  return null
})
</script>

<template>
  <HomeEspaco
    lugar="hotel"
    :titulo="espaco.rotulo"
    :icone="espaco.icone"
    :to="espaco.to"
    :numeros="numeros"
    :atalho="{ rotulo: t('inicio.acoes.mapa'), icone: 'ph ph-map-trifold', to: '/hotel/mapa' }"
    :andamento="andamento"
    :passo="passo"
    :aviso="falhou ? t('inicio.dia.falhouHotel') : ''"
    :pode-tentar="falhou"
    @tentar="dia.tentarDeNovo()"
  />
</template>
