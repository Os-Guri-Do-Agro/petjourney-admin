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
 *
 * **Com os números já no alto** (`numerosNoAlto`: a Clínica é o único espaço, e a abertura do Início
 * mostra os quatro dela), o bloco não os repete (17/11/2026, "melhorar toda essa seção": eram os
 * mesmos zeros duas vezes). No lugar entram as áreas da Clínica, as mesmas da barra, cada uma com o
 * que espera nela pelos selos do menu, ou "Em dia"; o Hoje diz quantos horários há e o próximo. E,
 * com nada parado, o pé propõe marcar um horário em vez de só dizer que está calmo.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useAtalhosDoDia } from '@/components/meu-dia/atalhos-do-dia'
import { useEspacos, type Espaco } from '@/navegacao/espacos'

import type { NumeroDoEspaco, PassoDoEspaco } from './espaco-da-home'
import HomeEspaco from './HomeEspaco.vue'
import { contarPorEstado, horaDaParede, type ContaDoDia } from './linha-do-dia'
import { useDiaDaCasa } from './useLinhaDoDia'

const props = defineProps<{
  espaco: Espaco
  /** A abertura do Início já mostra os quatro números da Clínica: o bloco mostra as áreas. */
  numerosNoAlto?: boolean
}>()

const { t } = useI18n()
const dia = useDiaDaCasa()
const { pedidosDaClinica, pedidosDaClinicaCarregados } = useEspacos()
const { podeMarcar } = useAtalhosDoDia()

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

const pedidos = computed(() => pedidosDaClinica.value)
const pedidosCarregados = computed(() => pedidosDaClinicaCarregados.value)

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

/* ------------------------------------------------------------------- as áreas da Clínica */

/** O Hoje diz o dia: quantos horários e o próximo, ou que nada está marcado. */
function frasedoHoje() {
  if (!pronta.value) return ''
  const total = agenda.value.contas.length
  if (!total) return t('inicio.espacos.clinica.areas.hojeVazio')
  const proximo = aSeguir.value[0]
  return proximo
    ? t('inicio.espacos.clinica.areas.hoje', { total, hora: horaDaParede(proximo.inicio) })
    : t('inicio.espacos.clinica.areas.hojeComecou', { total })
}

const areas = computed(() =>
  props.espaco.destinos
    /* As de trabalho: Relatórios e Configuração (a Gestão) não têm o que esperar nelas. */
    .filter((destino) => !destino.bloqueado && destino.secao !== 'gestao')
    .map((destino) => {
      const esperando = destino.selo ?? 0
      let frase = ''
      if (destino.id === 'hoje') frase = frasedoHoje()
      if (!frase && esperando) {
        /* Onde está cada coisa: "2 em Atendimentos · 2 em Cópias do prontuário". */
        const porAba = destino.abas
          .filter((aba) => aba.selo)
          .map((aba) =>
            t('inicio.espacos.clinica.areas.naAba', { total: aba.selo, aba: aba.rotulo }),
          )
        frase =
          destino.tituloDoSelo ||
          porAba.join(' · ') ||
          t('inicio.espacos.clinica.areas.esperam', { total: esperando })
      }
      return {
        id: destino.id,
        rotulo: destino.rotulo,
        icone: destino.icone,
        to: destino.to,
        selo: esperando,
        tom: esperando ? (destino.tom ?? 'neutro') : 'ok',
        frase: frase || t('inicio.espacos.clinica.areas.emDia'),
      }
    }),
)

/** Quanto da agenda de hoje já foi atendido: a barra fina do bloco. */
const andamento = computed(() => {
  const contas = agenda.value.contas

  if (!pronta.value || agenda.value.fechada || contas.length === 0) {
    return null
  }

  /* Falta não vira "feito" nunca: contada no total, a barra não chegava a 100% no fim do dia. */
  const contagem = contarPorEstado(contas)
  const feitos = contagem.feito
  const total = contas.length - contagem.falta

  if (total === 0) {
    return null
  }

  return {
    texto: t('inicio.espacos.clinica.andamento', { feitos, total }, total),
    percentual: Math.round((feitos / total) * 100),
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

  if (podeMarcar.value) {
    return {
      rotulo: t('inicio.passo.calmaMarcar'),
      icone: 'ph ph-calendar-plus',
      to: { path: '/clinica/agenda', query: { novo: '1' } },
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
    :numeros="numerosNoAlto ? [] : numeros"
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
  >
    <!-- Com os números no alto, as áreas da Clínica: cada uma com o que espera nela. -->
    <ul v-if="numerosNoAlto" class="areas" :aria-label="t('inicio.espacos.clinica.areas.rotulo')">
      <li v-for="area in areas" :key="area.id">
        <RouterLink class="area" :class="`area--${area.tom}`" :to="area.to">
          <span class="area__icone" aria-hidden="true"><i :class="area.icone" /></span>
          <span class="area__texto">
            <strong>{{ area.rotulo }}</strong>
            <small :title="area.frase">{{ area.frase }}</small>
          </span>
          <i class="ph ph-caret-right area__seta" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
  </HomeEspaco>
</template>

<style scoped>
/*
 * As áreas em ladrilhos baixos, quantos couberem por linha: o ícone na cor da Clínica, o nome e a
 * frase do que espera (no tom do selo) ou "Em dia".
 */
.areas {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  list-style: none;
}

.area {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--app-cartao, var(--superficie));
  color: inherit;
  text-decoration: none;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.area:hover {
  background: color-mix(in oklab, var(--pj-lugar-fundo) 45%, var(--app-cartao, var(--superficie)));
}

.area:focus-visible {
  outline: 2px solid var(--pj-lugar-tinta);
  outline-offset: 2px;
}

.area__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 18px;
}

.area__texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 1px;
}

.area__texto strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.area__texto small {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.area--ok .area__texto small {
  color: var(--ok-tinta);
}

.area--atencao .area__texto small {
  color: var(--atencao-tinta);
}

.area--risco .area__texto small {
  color: var(--risco-tinta);
}

.area__seta {
  color: var(--tinta-3);
  font-size: 14px;
}
</style>
