<script setup lang="ts">
/**
 * A Clínica no Início: quem está no prédio agora e o que espera resposta.
 *
 * Os quatro números são as perguntas de quem volta ao balcão — as mesmas da fita do dia e do Hoje
 * da Clínica, vistas de fora:
 *
 * - **na recepção** — quem chegou e espera (com os nomes);
 * - **em consulta** — quem está nas salas;
 * - **pedidos esperando resposta** — horários pedidos pelo app e pelo link, com quantos passaram do
 *   prazo prometido ao responsável;
 * - **por vir hoje** — o que ainda não começou, com a hora do próximo.
 *
 * O próximo passo segue a mesma ordem de quem precisa de alguém antes: pedido fora do prazo (do
 * outro lado há alguém esperando a resposta), quem espera na recepção, a consulta em andamento,
 * os pedidos no prazo, e o próximo horário.
 *
 * A agenda de hoje vem do dia que a página carrega uma vez (`useDiaDaCasa`); os pedidos, da mesma
 * contagem dos selos da barra (`pendenciasClinicas`) — um número em um lugar só.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useEspacos, type Espaco } from '@/navegacao/espacos'

import type { NumeroDoEspaco, PassoDoEspaco } from './espaco-da-home'
import HomeEspaco from './HomeEspaco.vue'
import { contarPorEstado, horaDaParede, type ContaDoDia } from './linha-do-dia'
import { useDiaDaCasa } from './useLinhaDoDia'

defineProps<{ espaco: Espaco }>()

const { t } = useI18n()
const dia = useDiaDaCasa()
const { pendenciasClinicas } = useEspacos()

const agenda = computed(() => dia.clinica.value)
const pronta = computed(() => agenda.value.carga === 'pronta')
const falhou = computed(() => agenda.value.carga === 'falhou')

const naRecepcao = computed(() =>
  agenda.value.contas
    .filter((conta) => conta.estado === 'esperando')
    .sort((uma, outra) =>
      (uma.chegadaEm ?? uma.inicio).localeCompare(outra.chegadaEm ?? outra.inicio),
    ),
)

const emConsulta = computed(() =>
  agenda.value.contas
    .filter((conta) => conta.estado === 'agora')
    .sort((uma, outra) => uma.inicio.localeCompare(outra.inicio)),
)

/** O que ainda não começou e ainda vem — o mesmo recorte do "A seguir" do Hoje. */
const aSeguir = computed(() => {
  const agora = dia.agora.value

  return agenda.value.contas
    .filter((conta) => conta.estado === 'marcado' && (agora === null || conta.inicio > agora))
    .sort((uma, outra) => uma.inicio.localeCompare(outra.inicio))
})

const pedidos = computed(() => pendenciasClinicas.pedidos.value)
const pedidosCarregados = computed(() => pendenciasClinicas.carregado.value)

function parte(chave: string) {
  return pedidos.value.partes?.find((item) => item.chave === chave)?.total ?? 0
}

/** "Ni, Nina e mais 2": quem é, sem abrir a outra tela. */
function nomes(contas: ContaDoDia[]) {
  const visiveis = contas
    .slice(0, 2)
    .map((conta) => conta.petNome)
    .filter(Boolean)
    .join(', ')
  const resto = contas.length - 2

  return resto > 0 ? t('clinico.meuDia.pauta.eMais', { nomes: visiveis, total: resto }) : visiveis
}

/** Número que depende da agenda: esqueleto carregando, traço se ela não veio. */
function daAgenda(total: number) {
  if (pronta.value) return total
  if (falhou.value) return '–'

  return null
}

const numeros = computed<NumeroDoEspaco[]>(() => {
  const recepcao = naRecepcao.value.length
  const consulta = emConsulta.value.length
  const porVir = aSeguir.value.length
  const esperando = pedidos.value.total
  const proximo = aSeguir.value[0]

  return [
    {
      id: 'recepcao',
      valor: daAgenda(recepcao),
      rotulo: t('inicio.espacos.clinica.recepcao'),
      meta: nomes(naRecepcao.value),
      tom: recepcao > 0 ? 'atencao' : 'apagado',
      to: '/clinica/meu-dia',
    },
    {
      id: 'consulta',
      valor: daAgenda(consulta),
      rotulo: t('inicio.espacos.clinica.consulta'),
      meta: nomes(emConsulta.value),
      tom: consulta > 0 ? 'lugar' : 'apagado',
      to: '/clinica/meu-dia',
    },
    {
      id: 'pedidos',
      valor: pedidosCarregados.value ? esperando : null,
      rotulo: t('inicio.espacos.clinica.pedidos', { total: esperando }, esperando),
      meta: (pedidos.value.partes ?? [])
        .map((item) => t(`inicio.pauta.parte.${item.chave}`, { total: item.total }, item.total))
        .join(' · '),
      tom: esperando > 0 ? pedidos.value.tom : 'apagado',
      to: '/clinica/pedidos',
    },
    {
      id: 'aSeguir',
      valor: daAgenda(porVir),
      rotulo: t('inicio.espacos.clinica.aSeguir'),
      meta: proximo
        ? t('inicio.espacos.clinica.proximo', { hora: horaDaParede(proximo.inicio) })
        : '',
      tom: porVir > 0 ? 'neutro' : 'apagado',
      to: '/clinica/agenda',
    },
  ]
})

/** Quanto da agenda de hoje já foi atendido: a barra fina do bloco. */
const andamento = computed(() => {
  const contas = agenda.value.contas

  if (!pronta.value || agenda.value.fechada || contas.length === 0) {
    return null
  }

  const feitos = contarPorEstado(contas).feito

  return {
    texto: t('inicio.espacos.clinica.andamento', { feitos, total: contas.length }, contas.length),
    percentual: Math.round((feitos / contas.length) * 100),
  }
})

const aviso = computed(() => {
  if (falhou.value) return t('inicio.dia.falhouClinica')

  if (pronta.value && agenda.value.fechada) {
    return agenda.value.feriado
      ? t('inicio.dia.feriado', { nome: agenda.value.feriado })
      : t('inicio.dia.fechada')
  }

  return ''
})

const passo = computed<PassoDoEspaco | null>(() => {
  const atrasados = parte('pedidosAtrasados')

  if (atrasados > 0) {
    return {
      rotulo: t('inicio.passo.pedidosAtrasados', { total: atrasados }, atrasados),
      icone: 'ph ph-clock-countdown',
      to: '/clinica/pedidos',
    }
  }

  const esperando = naRecepcao.value[0]

  if (esperando) {
    return {
      rotulo: t('inicio.passo.recepcao', { pet: esperando.petNome }),
      icone: 'ph ph-door-open',
      to: '/clinica/meu-dia',
    }
  }

  const naSala = emConsulta.value[0]

  if (naSala) {
    return {
      rotulo: t('inicio.passo.consulta', { pet: naSala.petNome }),
      icone: 'ph ph-stethoscope',
      to: naSala.rota,
    }
  }

  const total = pedidos.value.total

  if (total > 0) {
    return {
      rotulo: t('inicio.passo.pedidos', { total }, total),
      icone: 'ph ph-calendar-plus',
      to: '/clinica/pedidos',
    }
  }

  const proximo = aSeguir.value[0]

  if (proximo) {
    return {
      rotulo: t('inicio.passo.receber', {
        pet: proximo.petNome,
        hora: horaDaParede(proximo.inicio),
      }),
      icone: 'ph ph-calendar-dots',
      to: { path: '/clinica/agenda', query: { foco: proximo.id } },
    }
  }

  return null
})
</script>

<template>
  <HomeEspaco
    lugar="clinica"
    :titulo="espaco.rotulo"
    :icone="espaco.icone"
    :to="espaco.to"
    :numeros="numeros"
    :atalho="{
      rotulo: t('inicio.acoes.agenda'),
      icone: 'ph ph-calendar-dots',
      to: '/clinica/agenda',
    }"
    :andamento="andamento"
    :passo="passo"
    :aviso="aviso"
    :pode-tentar="falhou"
    @tentar="dia.tentarDeNovo()"
  />
</template>
