<script setup lang="ts">
/**
 * Vacinas — quem chamar de volta, e o que a clínica aplicou.
 *
 * Mora em Pendências, e a pergunta da tela é a da recepção às oito: **quem eu ligo hoje?** A chamada
 * é a única consulta que a clínica pode provocar — todo o resto do módulo reage a algo que já
 * aconteceu, e uma clínica que não chama perde a visita para o pet shop da esquina.
 *
 * Duas telas na mesma, num controle segmentado logo abaixo das abas do destino (outro nível, não
 * outra fileira de abas):
 *
 * - **Lista de chamada** (`?aba=atraso`) — três números grandes no alto, que são também o recorte da
 *   lista: **vencidas** liga hoje, **a vencer** entra na semana, **série aberta** é filhote que parou
 *   no meio — e esse último some de qualquer relatório que só olhe data de vencimento. Embaixo, um
 *   pet por linha (as vacinas do mesmo animal são uma ligação só), com o rosto, a situação em selo
 *   com palavra, o responsável com telefone e a ação "Agendar".
 * - **Aplicadas** (`?aba=aplicadas`) — o registro: o que saiu da geladeira, em quem, por quem e de
 *   que lote. É a lista que responde à farmacovigilância; busca por lote, vinte por vez.
 *
 * Sem aba na URL, a tela abre na lista de chamada quando há vencidas, e em Aplicadas quando não há.
 * A aba escolhida vai para a URL (as duas, sempre: recarregar não troca de aba). O endereço antigo
 * `?aba=estoque` leva ao Estoque de vacinas, que virou tela própria.
 */
import Button from 'primevue/button'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicFilterBar from '@/features/clinico/components/base/ClinicFilterBar.vue'
import ClinicPacienteCelula from '@/features/clinico/components/base/ClinicPacienteCelula.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import type { GrupoDeFiltro } from '@/features/clinico/components/base/filter-types'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import {
  vacinaRepository,
  type AplicacaoNaLista,
  type ChamadaDeVacina,
} from '@/features/clinico/data/repositories'
import { diffDays } from '@/features/clinico/domain/clinic-time'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

type Recorte = 'todos' | 'vencido' | 'proximo' | 'serie-incompleta'
type Aba = 'aplicadas' | 'atraso'
type Situacao = ChamadaDeVacina['situacao']

const ABAS: Aba[] = ['aplicadas', 'atraso']

/**
 * As janelas de tempo do filtro de aplicadas.
 *
 * Não é uma escolha de data livre de propósito: a pergunta real é sempre "o que saiu esta
 * semana / este mês / este ano", e um par de calendários custa quatro cliques para responder o
 * que três fichas respondem em um. Quem precisar de um intervalo exato tem a ordenação por data.
 */
const JANELAS = [30, 90, 365] as const

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const aba = ref<Aba>('aplicadas')
const linhas = ref<ChamadaDeVacina[]>([])
const aplicacoes = ref<AplicacaoNaLista[]>([])
const carregando = ref(false)
const erro = ref('')
const recorte = ref<Recorte>('vencido')
const busca = ref('')
const filtros = ref<Record<string, string[]>>({})

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const [chamada, historico] = await Promise.all([
      vacinaRepository.listaDeChamada(),
      vacinaRepository.aplicadas(),
    ])

    linhas.value = chamada
    aplicacoes.value = historico

    /** Sem nenhum vencido, abrir no recorte vazio esconderia o que existe. */
    if (porSituacao.value.vencido.length === 0) {
      recorte.value = 'todos'
    }

    /* Sem aba pedida na URL, quem tem vencida para chamar abre na lista de chamada. */
    if (!abaPedida && porSituacao.value.vencido.length > 0) {
      aba.value = 'atraso'
    }
  } catch {
    erro.value = t('clinico.erros.agenda')
  } finally {
    carregando.value = false
  }
}

/** A URL pediu uma aba: aí ela manda, e o "abrir na lista de chamada" não se aplica. */
let abaPedida = false

onMounted(() => {
  const daUrl = String(route.query.aba ?? '')

  if (daUrl === 'estoque') {
    void router.replace('/veterinario/estoque')
    return
  }

  if ((ABAS as string[]).includes(daUrl)) {
    aba.value = daUrl as Aba
    abaPedida = true
  }

  void carregar()
})

/*
 * A aba escolhida vira endereço — `replace` para não encher o histórico de voltas. As duas vão
 * escritas: sem `?aba=aplicadas`, recarregar a tela com vencidas devolvia a pessoa à chamada.
 */
watch(aba, (valor) => {
  void router.replace({ query: { ...route.query, aba: valor } })
})

const porSituacao = computed(() => ({
  vencido: linhas.value.filter((linha) => linha.situacao === 'vencido'),
  proximo: linhas.value.filter((linha) => linha.situacao === 'proximo'),
  'serie-incompleta': linhas.value.filter((linha) => linha.situacao === 'serie-incompleta'),
}))

const visiveis = computed(() =>
  recorte.value === 'todos' ? linhas.value : porSituacao.value[recorte.value],
)

/** O tom de cada situação: risco liga hoje, atenção entra na semana, série aberta é conversa. */
const TOM: Record<Situacao, 'risco' | 'atencao' | 'neutro' | 'ok'> = {
  vencido: 'risco',
  proximo: 'atencao',
  'serie-incompleta': 'neutro',
  'em-dia': 'ok',
}

const ICONE: Record<Situacao, string> = {
  vencido: 'ph ph-warning',
  proximo: 'ph ph-clock',
  'serie-incompleta': 'ph ph-syringe',
  'em-dia': 'ph ph-check',
}

/**
 * Os números do alto — e o recorte da lista.
 *
 * Eram duas coisas na mesma tela: três cartões de contagem e, embaixo, quatro fichas com as
 * mesmas contagens para filtrar. Agora o número é o filtro: clicar em "6 vacinas vencidas" mostra
 * as seis. A contagem é de vacinas; a lista embaixo junta as do mesmo pet numa linha só.
 */
const opcoesRecorte = computed(() => [
  {
    valor: 'vencido' as Recorte,
    total: porSituacao.value.vencido.length,
    rotulo: t(
      'clinico.vacinas.placar.vencido',
      { n: porSituacao.value.vencido.length },
      porSituacao.value.vencido.length,
    ),
    dica: t('clinico.vacinas.placar.dica.vencido'),
    tom: 'risco' as const,
  },
  {
    valor: 'proximo' as Recorte,
    total: porSituacao.value.proximo.length,
    rotulo: t(
      'clinico.vacinas.placar.proximo',
      { n: porSituacao.value.proximo.length },
      porSituacao.value.proximo.length,
    ),
    dica: t('clinico.vacinas.placar.dica.proximo'),
    tom: 'atencao' as const,
  },
  {
    valor: 'serie-incompleta' as Recorte,
    total: porSituacao.value['serie-incompleta'].length,
    rotulo: t(
      'clinico.vacinas.placar.serie-incompleta',
      { n: porSituacao.value['serie-incompleta'].length },
      porSituacao.value['serie-incompleta'].length,
    ),
    dica: t('clinico.vacinas.placar.dica.serie-incompleta'),
    tom: 'neutro' as const,
  },
  {
    valor: 'todos' as Recorte,
    total: linhas.value.length,
    rotulo: t('clinico.vacinas.placar.todos'),
    dica: t('clinico.vacinas.placar.dica.todos'),
    tom: 'todos' as const,
  },
])

/*
 * O placar é um `radiogroup` de verdade, com o teclado do `ClinicToggleGroup` que ele substitui:
 * uma parada de Tab, setas que movem e escolhem, Home/End e o número da opção (1 a 4).
 */
const placar = ref<HTMLElement | null>(null)

const indiceDoRecorte = computed(() =>
  Math.max(
    0,
    opcoesRecorte.value.findIndex((opcao) => opcao.valor === recorte.value),
  ),
)

function escolherRecorte(indice: number, focar = false) {
  const opcao = opcoesRecorte.value[indice]

  if (!opcao) {
    return
  }

  recorte.value = opcao.valor

  if (focar) {
    void nextTick(() =>
      placar.value?.querySelectorAll<HTMLElement>('[role="radio"]')[indice]?.focus(),
    )
  }
}

function aoTeclarNoPlacar(evento: KeyboardEvent) {
  const total = opcoesRecorte.value.length
  const atual = indiceDoRecorte.value
  const destinos: Record<string, number> = {
    ArrowRight: (atual + 1) % total,
    ArrowDown: (atual + 1) % total,
    ArrowLeft: (atual - 1 + total) % total,
    ArrowUp: (atual - 1 + total) % total,
    Home: 0,
    End: total - 1,
  }
  const numero = Number(evento.key)
  const destino =
    destinos[evento.key] ??
    (Number.isInteger(numero) && numero >= 1 && numero <= total ? numero - 1 : undefined)

  if (destino === undefined) {
    return
  }

  evento.preventDefault()
  escolherRecorte(destino, true)
}

// --------------------------------------------------------------------- aplicadas

const opcoesAba = computed(() => [
  {
    /*
     * A contagem viaja no selo da aba porque o número de vencidas é o que faz a clínica trocar de
     * aba — e um selo que só aparece depois do clique chega tarde demais para provocar o clique.
     */
    valor: 'atraso' as Aba,
    rotulo: t('clinico.vacinas.aba.chamada'),
    contagem: porSituacao.value.vencido.length,
    tom: porSituacao.value.vencido.length > 0 ? ('risco' as const) : ('neutro' as const),
  },
  {
    valor: 'aplicadas' as Aba,
    rotulo: t('clinico.vacinas.aba.aplicadas'),
    contagem: aplicacoes.value.length,
    tom: 'neutro' as const,
  },
])

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** Dias inteiros desde a aplicação. É por este número que a janela do filtro corta. */
function diasDesde(aplicadaEm: string): number {
  return diffDays(clinicClock.dateOf(aplicadaEm), clinicClock.today())
}

function dentroDaJanela(aplicacao: AplicacaoNaLista, dias: number): boolean {
  return diasDesde(aplicacao.aplicadaEm) <= dias
}

/**
 * Os grupos do filtro: quando e qual.
 *
 * "Qual vacina" lista **só as que a clínica aplicou**, e não o catálogo inteiro: uma ficha com
 * contagem zero é uma ficha que só serve para esvaziar a lista, e o catálogo tem vacinas que
 * esta clínica talvez nunca tenha usado.
 */
const gruposDeFiltro = computed<GrupoDeFiltro[]>(() => {
  const vacinasUsadas = [...new Set(aplicacoes.value.map((item) => item.vacinaNome))].sort((a, b) =>
    a.localeCompare(b, INTL_LOCALE[locale.value as Locale]),
  )

  return [
    {
      id: 'janela',
      rotulo: t('clinico.vacinas.filtro.quando'),
      opcoes: JANELAS.map((dias) => ({
        valor: `janela:${dias}`,
        rotulo: t('clinico.vacinas.filtro.ultimosDias', { dias }, dias),
        contagem: aplicacoes.value.filter((item) => dentroDaJanela(item, dias)).length,
      })),
    },
    {
      id: 'vacina',
      rotulo: t('clinico.vacinas.colunaVacina'),
      opcoes: vacinasUsadas.map((nome) => ({
        valor: nome,
        rotulo: nome,
        contagem: aplicacoes.value.filter((item) => item.vacinaNome === nome).length,
      })),
    },
  ]
})

/**
 * A busca é a mesma que a recepção faz no balcão: paciente, responsável, vacina ou **lote**.
 *
 * O lote entra porque é a busca que ninguém faz até precisar — e quando precisa, é urgente:
 * chegou um alerta de lote e é preciso saber em quais animais ele entrou.
 */
const aplicadasVisiveis = computed(() => {
  const termo = semAcento(busca.value)
  const janelas = (filtros.value.janela ?? []).map((valor) => Number(valor.split(':')[1]))
  const vacinas = filtros.value.vacina ?? []

  return aplicacoes.value.filter((item) => {
    if (janelas.length > 0 && !janelas.some((dias) => dentroDaJanela(item, dias))) {
      return false
    }

    if (vacinas.length > 0 && !vacinas.includes(item.vacinaNome)) {
      return false
    }

    if (!termo) {
      return true
    }

    return [
      item.petNome,
      item.tutorNome,
      item.vacinaNome,
      item.lote ?? '',
      item.externa?.local ?? '',
    ].some((campo) => semAcento(campo).includes(termo))
  })
})

const aplicadasDaPagina = computed(() => aplicadasVisiveis.value.slice(0, limiteDoHistorico.value))

const restamNoHistorico = computed(
  () => aplicadasVisiveis.value.length - aplicadasDaPagina.value.length,
)

const colunasAplicadas = computed<ColunaTabela<AplicacaoNaLista>[]>(() => [
  {
    id: 'quando',
    rotulo: t('clinico.paciente.atos.colunaQuando'),
    largura: '7.5rem',
    ordenarPor: (linha) => linha.aplicadaEm,
    ordemInicial: 'desc',
  },
  {
    id: 'paciente',
    rotulo: t('clinico.pacientes.colunaPaciente'),
    largura: 'minmax(12rem, 1.3fr)',
    ordenarPor: (linha) => linha.petNome,
  },
  {
    id: 'vacina',
    rotulo: t('clinico.vacinas.colunaVacina'),
    largura: 'minmax(11rem, 1.3fr)',
    ordenarPor: (linha) => linha.vacinaNome,
  },
  {
    id: 'lote',
    rotulo: t('clinico.vacinas.lote'),
    largura: '9rem',
    ocultarEmTelaEstreita: true,
    ordenarPor: (linha) => linha.lote,
  },
  {
    id: 'quem',
    rotulo: t('clinico.paciente.atos.colunaQuem'),
    largura: 'minmax(0, 1fr)',
    ocultarEmTelaEstreita: true,
  },
])

function rotaDasVacinas(petId: string) {
  return `/veterinario/paciente/${petId}/vacinas`
}

/** A linha abre a carteira do paciente — é lá que está a sequência e a prévia do app. */
function abrirPaciente(linha: { petId: string }) {
  void router.push(rotaDasVacinas(linha.petId))
}

// --------------------------------------------------------------------- lista de chamada

/**
 * Um pet, uma linha: as vacinas atrasadas do mesmo animal viajam juntas.
 *
 * A Nina aparecia três vezes — traqueobronquite, V10 e antirrábica — e é uma ligação só para a
 * Camila. A linha leva todas as vacinas do pet no recorte, e o prazo dela é o da mais urgente.
 */
type ChamadaDoPet = {
  petId: string
  petNome: string
  tutorNome: string
  tutorTelefone: string
  vacinas: ChamadaDeVacina[]
  diasParaVencer: number
  proximaDoseEm: string
  situacao: Situacao
}

const chamadasPorPet = computed<ChamadaDoPet[]>(() => {
  const mapa = new Map<string, ChamadaDoPet>()

  for (const linha of visiveis.value) {
    const grupo = mapa.get(linha.petId)

    if (!grupo) {
      mapa.set(linha.petId, {
        petId: linha.petId,
        petNome: linha.petNome,
        tutorNome: linha.tutorNome,
        tutorTelefone: linha.tutorTelefone,
        vacinas: [linha],
        diasParaVencer: linha.diasParaVencer,
        proximaDoseEm: linha.proximaDoseEm,
        situacao: linha.situacao,
      })
      continue
    }

    grupo.vacinas.push(linha)

    if (linha.diasParaVencer < grupo.diasParaVencer) {
      grupo.diasParaVencer = linha.diasParaVencer
      grupo.proximaDoseEm = linha.proximaDoseEm
      grupo.situacao = linha.situacao
    }
  }

  return [...mapa.values()]
})

/** "155 d atrasada", "vence hoje", "vence em 12 d": o prazo em palavra, no selo. */
function prazo(dias: number): string {
  if (dias < 0) {
    return t('clinico.vacinas.chamada.atrasada', { dias: Math.abs(dias) })
  }

  return dias === 0
    ? t('clinico.vacinas.chamada.venceHoje')
    : t('clinico.vacinas.chamada.venceEm', { dias })
}

/*
 * Agendar é o desfecho da ligação, e a única ação da linha. Sem "Ligar": a clínica liga pelo
 * telefone do cadastro, que está escrito na linha. A tela não disca — leva à agenda, onde a
 * recepção escolhe o horário olhando a grade.
 */
function agendar() {
  void router.push({ path: '/veterinario/agenda' })
}

/*
 * Setas andam de linha em linha, como na tabela que esta lista substitui: a recepção percorre a
 * chamada pelo teclado e abre a carteira com Enter.
 */
const listaDeChamada = ref<HTMLElement | null>(null)

function aoTeclarNaLista(evento: KeyboardEvent) {
  const alvos = [...(listaDeChamada.value?.querySelectorAll<HTMLElement>('[data-linha]') ?? [])]
  const atual = alvos.indexOf(document.activeElement as HTMLElement)

  if (atual < 0) {
    return
  }

  const destinos: Record<string, number> = {
    ArrowDown: Math.min(atual + 1, alvos.length - 1),
    ArrowUp: Math.max(atual - 1, 0),
    Home: 0,
    End: alvos.length - 1,
  }
  const destino = destinos[evento.key]

  if (destino === undefined) {
    return
  }

  evento.preventDefault()
  alvos[destino]?.focus()
}

/*
 * Vazio é vazio nas **duas** listas.
 *
 * Antes, sem ninguém para chamar, a tela inteira virava o estado vazio — e escondia junto o
 * registro do que a clínica aplicou, que continua existindo. Uma clínica em dia com os reforços
 * é a melhor notícia possível, e não pode apagar a própria carteira.
 */
const vazio = computed(
  () =>
    !carregando.value && !erro.value && linhas.value.length === 0 && aplicacoes.value.length === 0,
)

/** Minutos de agenda que a chamada pode recuperar, a 20 min por aplicação. */
const potencial = computed(() => linhas.value.length * 20)

/**
 * A frase de estado: quantas vencidas há para chamar hoje e quantas vencem no mês. É o número
 * que fazia a pessoa trocar de aba; agora é a primeira coisa lida na tela.
 */
const fraseDoResumo = computed(() => {
  if (carregando.value && linhas.value.length === 0) {
    return ''
  }

  const vencidas = porSituacao.value.vencido.length
  const aVencer = porSituacao.value.proximo.length
  const primeira =
    vencidas > 0
      ? t('clinico.vacinas.saudacao.vencidas', { n: vencidas }, vencidas)
      : t('clinico.vacinas.saudacao.nenhumaVencida')

  return aVencer > 0
    ? t('clinico.vacinas.par', {
        a: primeira,
        b: t('clinico.vacinas.saudacao.aVencer', { n: aVencer }, aVencer),
      })
    : primeira
})

/** Quantas aplicações o histórico mostra por vez. */
const PASSO_DO_HISTORICO = 20
const limiteDoHistorico = ref(PASSO_DO_HISTORICO)

/* Trocar a busca ou o filtro recomeça do topo: o "mostrar mais" é da lista de agora. */
watch([busca, filtros], () => {
  limiteDoHistorico.value = PASSO_DO_HISTORICO
})
</script>

<template>
  <UiPagina
    :resumo="fraseDoResumo"
    :carregando="carregando && linhas.length === 0"
    :erro="erro"
    :vazio="vazio"
    :vazio-titulo="t('clinico.vacinas.vazioTitulo')"
    :vazio-descricao="t('clinico.vacinas.vazioDescricao')"
    vazio-icone="ph ph-syringe"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <div class="vacinas clinic-scope">
      <!--
        As duas telas desta, num controle segmentado: outro nível que as abas do destino em cima.
        A lista de chamada vem primeiro e carrega no selo o número que faz alguém trocar de aba.
      -->
      <div class="vacinas__barra">
        <ClinicToggleGroup
          v-model="aba"
          :opcoes="opcoesAba"
          :rotulo="t('clinico.vacinas.titulo')"
        />

        <!-- O estoque saiu daqui para a própria tela; o caminho para ele fica à mão. -->
        <RouterLink class="ui-mais" to="/veterinario/estoque">
          <i class="ph ph-package" aria-hidden="true" />
          {{ t('clinico.estoque.titulo') }}
        </RouterLink>
      </div>

      <!-- ============================================================ lista de chamada -->
      <template v-if="aba === 'atraso'">
        <div
          ref="placar"
          class="placar ui-folha"
          role="radiogroup"
          :aria-label="t('clinico.agenda.filtros')"
          @keydown="aoTeclarNoPlacar"
        >
          <button
            v-for="(opcao, indice) in opcoesRecorte"
            :key="opcao.valor"
            type="button"
            role="radio"
            class="placar__opcao"
            :class="[
              `placar__opcao--${opcao.tom}`,
              { 'placar__opcao--zero': opcao.total === 0 },
            ]"
            :aria-checked="recorte === opcao.valor"
            :tabindex="indice === indiceDoRecorte ? 0 : -1"
            @click="escolherRecorte(indice)"
          >
            <strong class="placar__numero ui-num">{{ opcao.total }}</strong>
            <span class="placar__rotulo">{{ opcao.rotulo }}</span>
            <span class="placar__dica">{{ opcao.dica }}</span>
          </button>
        </div>

        <UiSecao
          id="vacinas-chamada"
          :titulo="t('clinico.vacinas.chamada.titulo')"
          :contagem="chamadasPorPet.length"
          :descricao="
            linhas.length > 0
              ? t('clinico.vacinas.potencialFrase', { duracao: formato.duracao(potencial) })
              : ''
          "
        >
          <ul
            v-if="chamadasPorPet.length"
            ref="listaDeChamada"
            class="ui-folha ui-lista chamada"
            @keydown="aoTeclarNaLista"
          >
            <li
              v-for="linha in chamadasPorPet"
              :key="linha.petId"
              class="chamada__linha ui-marca"
              :class="`ui-marca--${TOM[linha.situacao]}`"
            >
              <!-- A linha inteira abre a carteira do paciente; "Agendar" fica por cima dela. -->
              <RouterLink class="chamada__quem" :to="rotaDasVacinas(linha.petId)" data-linha>
                <PetAvatar
                  :nome="clinico.pet(linha.petId)?.nome ?? linha.petNome"
                  :iniciais="
                    clinico.pet(linha.petId)?.iniciais ?? linha.petNome.slice(0, 2).toUpperCase()
                  "
                  :especie="clinico.pet(linha.petId)?.especie ?? null"
                  :foto-url="clinico.pet(linha.petId)?.fotoUrl ?? ''"
                  tamanho="md"
                />
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">{{ linha.petNome }}</strong>
                  <span v-if="clinico.pet(linha.petId)" class="ui-linha__meta">
                    {{ formato.especie(clinico.pet(linha.petId)!.especie) }}
                  </span>
                </span>
              </RouterLink>

              <ul class="chamada__vacinas">
                <li v-for="vacina in linha.vacinas" :key="vacina.vacinaId">
                  <span class="chamada__vacina">
                    {{ vacina.vacinaNome }}
                    <!-- Obrigatória muda o tom da conversa: é exigência legal, não sugestão. -->
                    <span v-if="vacina.obrigatoria" class="ui-selo ui-selo--contorno">
                      {{ t('clinico.vacinas.obrigatoria') }}
                    </span>
                  </span>
                  <span v-if="vacina.doseSeguinte" class="chamada__meta">
                    {{ t('clinico.vacinas.doseSeguinte', { dose: vacina.doseSeguinte }) }}
                  </span>
                </li>
              </ul>

              <span class="chamada__situacao">
                <span class="ui-selo" :class="`ui-selo--${TOM[linha.situacao]}`">
                  <i :class="ICONE[linha.situacao]" aria-hidden="true" />
                  {{ prazo(linha.diasParaVencer) }}
                </span>
                <span class="chamada__meta">
                  {{ t(`clinico.vacinas.situacao.${linha.situacao}`) }} ·
                  <span class="ui-num">{{ formato.dataCurta(linha.proximaDoseEm) }}</span>
                </span>
              </span>

              <span class="chamada__responsavel">
                <span class="chamada__tutor">{{ linha.tutorNome }}</span>
                <span class="chamada__telefone ui-num">
                  <i class="ph ph-phone" aria-hidden="true" />
                  {{ linha.tutorTelefone }}
                </span>
              </span>

              <Button
                type="button"
                class="chamada__agendar"
                icon="ph ph-calendar-plus"
                :label="t('clinico.vacinas.agendar')"
                severity="secondary"
                outlined
                size="small"
                :aria-label="`${t('clinico.vacinas.agendar')}: ${linha.petNome}`"
                @click="agendar"
              />
            </li>
          </ul>

          <p v-else class="ui-folha ui-vazio">
            <strong>{{ t('clinico.vacinas.vazioTitulo') }}</strong>
            {{ t('clinico.vacinas.vazioDescricao') }}
          </p>
        </UiSecao>
      </template>

      <!-- ============================================================ aplicadas -->
      <template v-else>
        <ClinicFilterBar
          v-model:busca="busca"
          v-model:selecionados="filtros"
          :grupos="gruposDeFiltro"
          :placeholder-busca="t('clinico.vacinas.buscar')"
          :resultado="aplicadasVisiveis.length"
        />

        <ClinicDataTable
          class="tabela-rola"
          :colunas="colunasAplicadas"
          :linhas="aplicadasDaPagina"
          :chave="(linha) => linha.id"
          :carregando="carregando"
          :vazio-titulo="t('clinico.vacinas.aplicadasVazioTitulo')"
          :vazio-descricao="t('clinico.vacinas.aplicadasVazioDescricao')"
          :rotulo="t('clinico.vacinas.aba.aplicadas')"
          @ativar="abrirPaciente"
        >
          <template #celula-quando="{ linha }">
            <span class="celula__forte ui-num">
              {{ formato.dataCurta(clinicClock.dateOf(linha.aplicadaEm)) }}
            </span>
            <span class="celula__meta ui-num">
              {{ clinicClock.dateOf(linha.aplicadaEm).slice(0, 4) }}
            </span>
          </template>

          <template #celula-paciente="{ linha }">
            <ClinicPacienteCelula :pet="clinico.pet(linha.petId)" :nome="linha.petNome">
              {{ formato.especie(linha.especie) }} · {{ linha.tutorNome }}
            </ClinicPacienteCelula>
          </template>

          <template #celula-vacina="{ linha }">
            <span class="celula__titulo">
              <span class="celula__forte">{{ linha.vacinaNome }}</span>
              <span v-if="linha.obrigatoria" class="ui-selo ui-selo--contorno">
                {{ t('clinico.vacinas.obrigatoria') }}
              </span>
            </span>
            <span class="celula__meta">
              {{
                t('clinico.vacinas.doseDeTotal', { dose: linha.dose, total: linha.dosesNaSerie })
              }}
            </span>
          </template>

          <!--
            Lote e validade juntos, e nunca só o lote: é o par que a farmacovigilância pede. A dose
            de fora não tem lote, e a célula diz isso em vez de ficar vazia.
          -->
          <template #celula-lote="{ linha }">
            <template v-if="linha.externa">
              <span class="celula__forte">{{ t('clinico.vacinas.externa.semLote') }}</span>
              <span class="celula__meta">{{ linha.externa.local }}</span>
            </template>
            <template v-else>
              <span class="celula__forte ui-num">{{ linha.lote }}</span>
              <span v-if="linha.validadeLote" class="celula__meta">
                {{ t('clinico.vacinas.validade', { data: formato.dataCurta(linha.validadeLote) }) }}
              </span>
            </template>
          </template>

          <template #celula-quem="{ linha }">
            <template v-if="linha.externa">
              <span class="celula__forte">{{ t('clinico.vacinas.externa.outroLocal') }}</span>
              <span class="celula__meta">
                {{
                  t('clinico.vacinas.externa.registradaPor', {
                    nome: clinico.profissional(linha.externa.registradaPor)?.nome ?? '',
                  })
                }}
              </span>
            </template>
            <template v-else>
              <span class="celula__texto">
                {{ clinico.profissional(linha.professionalId)?.nome }}
              </span>
              <span v-if="linha.observacao" class="celula__meta">{{ linha.observacao }}</span>
            </template>
          </template>
        </ClinicDataTable>

        <div v-if="restamNoHistorico > 0" class="vacinas__mais">
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-caret-down"
            :label="
              t('clinico.vacinas.mostrarMais', {
                n: Math.min(PASSO_DO_HISTORICO, restamNoHistorico),
                total: restamNoHistorico,
              })
            "
            @click="limiteDoHistorico += PASSO_DO_HISTORICO"
          />
        </div>
      </template>
    </div>
  </UiPagina>
</template>

<style scoped>
.vacinas {
  display: grid;
  gap: 24px;
}

.vacinas__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
}

.vacinas__mais {
  display: flex;
  justify-content: center;
}

/* ------------------------------------------------------------------ placar
 * Os três números grandes, que são também o recorte da lista. Uma folha só, dividida em
 * colunas: um placar, e não quatro cartões iguais lado a lado.
 */
.placar {
  display: grid;
  overflow: hidden;
  grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(0, 0.8fr);
}

.placar__opcao {
  --placar-tinta: var(--tinta);
  --placar-cor: var(--linha-forte);
  --placar-fundo: var(--superficie-2);

  position: relative;
  display: grid;
  align-content: start;
  gap: 2px;
  min-height: 112px;
  padding: 18px 20px 20px;
  border: 0;
  border-inline-start: 1px solid var(--linha);
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition: background-color var(--pj-tempo-curto) ease;
}

.placar__opcao:first-child {
  border-inline-start: 0;
}

.placar__opcao--risco {
  --placar-tinta: var(--risco-tinta);
  --placar-cor: var(--risco);
  --placar-fundo: color-mix(in oklab, var(--risco-fundo) 70%, var(--superficie));
}

.placar__opcao--atencao {
  --placar-tinta: var(--atencao-tinta);
  --placar-cor: var(--atencao);
  --placar-fundo: color-mix(in oklab, var(--atencao-fundo) 70%, var(--superficie));
}

.placar__opcao--neutro {
  --placar-tinta: var(--tinta);
  --placar-cor: var(--tinta-3);
  --placar-fundo: var(--superficie-2);
}

.placar__opcao--todos {
  --placar-tinta: var(--tinta-2);
  --placar-cor: var(--pj-lugar, var(--musgo));
  --placar-fundo: var(--superficie-2);
}

.placar__opcao:hover {
  background: var(--superficie-2);
}

/* Escolhido: fundo no tom, traço embaixo e o número cheio — três sinais, nenhum só de cor. */
.placar__opcao[aria-checked='true'] {
  background: var(--placar-fundo);
  box-shadow: inset 0 -3px 0 var(--placar-cor);
}

.placar__opcao[aria-checked='true'] .placar__rotulo {
  color: var(--tinta);
  font-weight: 600;
}

.placar__opcao:focus-visible {
  z-index: 1;
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -2px;
}

.placar__numero {
  color: var(--placar-tinta);
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.placar__opcao--todos .placar__numero {
  font-size: 24px;
  line-height: 1.35;
}

.placar__opcao--zero .placar__numero {
  color: var(--tinta-3);
}

.placar__rotulo {
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.35;
}

.placar__dica {
  margin-top: 4px;
  color: var(--tinta-3);
  font-size: 12.5px;
  line-height: 1.35;
}

/* ------------------------------------------------------------------ lista de chamada */

.chamada__linha {
  position: relative;
  display: grid;
  align-items: center;
  gap: 12px 20px;
  grid-template-columns:
    minmax(160px, 1fr) minmax(0, 1.5fr) minmax(150px, 0.9fr) minmax(0, 1.1fr)
    auto;
  min-height: 72px;
  padding: 12px 18px 12px 20px;
  transition: background-color var(--pj-tempo-curto) ease;
}

.chamada__linha:hover {
  background: var(--superficie-2);
}

.chamada__linha:first-child {
  border-top-left-radius: 15px;
  border-top-right-radius: 15px;
}

.chamada__linha:last-child {
  border-bottom-left-radius: 15px;
  border-bottom-right-radius: 15px;
}

.chamada__quem {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  color: var(--tinta);
  text-decoration: none;
}

/* A linha inteira é o alvo do link: o `::after` cobre a linha, e o botão sobe por cima dele. */
.chamada__quem::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  content: '';
}

.chamada__quem:focus-visible {
  outline: none;
}

.chamada__quem:focus-visible::after {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -2px;
}

.chamada__vacinas {
  display: grid;
  min-width: 0;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chamada__vacinas li {
  display: grid;
  min-width: 0;
}

.chamada__vacina {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.35;
}

.chamada__vacina .ui-selo {
  height: 20px;
  padding-inline: 7px;
  font-size: 11.5px;
}

.chamada__meta {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.chamada__situacao,
.chamada__responsavel {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 4px;
}

.chamada__tutor {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chamada__telefone {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--tinta-2);
  font-size: 13px;
  white-space: nowrap;
}

.chamada__telefone i {
  color: var(--tinta-3);
  font-size: 14px;
}

.chamada__agendar.p-button {
  position: relative;
  z-index: 1;
  min-height: 36px;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ células da tabela */

/*
 * Tabela larga rola dentro de si no estreito. As colunas têm piso, e a grade cresce até ele em vez
 * de espremer o nome do paciente num fio de uma letra por linha.
 */
.tabela-rola :deep(.tabela__grade) {
  width: min-content;
  min-width: 100%;
}

.celula__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.celula__titulo .ui-selo {
  height: 20px;
  padding-inline: 7px;
  font-size: 11.5px;
}

.celula__forte {
  display: block;
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.celula__titulo .celula__forte {
  display: inline;
}

.celula__texto {
  display: block;
  color: var(--tinta);
  font-size: 14px;
}

.celula__meta {
  display: block;
  color: var(--tinta-2);
  font-size: 13px;
}

/* ------------------------------------------------------------------ estreito */

@media (max-width: 1180px) {
  .chamada__linha {
    grid-template-columns: minmax(150px, 1fr) minmax(0, 1.4fr) minmax(140px, 0.9fr) auto;
  }

  .chamada__responsavel {
    grid-column: 2 / 4;
    grid-row: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
  }

  .chamada__agendar.p-button {
    grid-column: 4;
    grid-row: 1 / 3;
  }
}

@media (max-width: 760px) {
  .placar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .placar__opcao {
    min-height: 0;
    padding: 14px 16px 16px;
  }

  .placar__opcao:nth-child(3) {
    border-inline-start: 0;
  }

  .placar__opcao:nth-child(n + 3) {
    border-top: 1px solid var(--linha);
  }

  .placar__numero {
    font-size: 26px;
  }

  .chamada__linha {
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 14px 16px 14px 18px;
  }

  .chamada__quem {
    grid-column: 1;
    grid-row: 1;
  }

  .chamada__situacao {
    grid-column: 2;
    grid-row: 1;
    justify-items: end;
    text-align: end;
  }

  .chamada__vacinas,
  .chamada__responsavel {
    grid-column: 1 / -1;
    grid-row: auto;
    padding-inline-start: 52px;
  }

  .chamada__agendar.p-button {
    grid-column: 1 / -1;
    grid-row: auto;
    justify-self: start;
    margin-inline-start: 52px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .placar__opcao,
  .chamada__linha {
    transition: none;
  }
}
</style>
