<script setup lang="ts">
/**
 * Hoje no Hotel — o painel do dia.
 *
 * É a irmã do Hoje da Clínica, no idioma do hotel. Quem abre o portal às sete não pergunta "que
 * acomodação está livre"; pergunta **quem entra, quem está e quem sai hoje, e o que não pode
 * esperar**. A tela responde no formato da própria casa: o caminho que o hóspede faz por ela.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * 1. **Chegam hoje** — hora, rosto, acomodação e a documentação num selo ("Pode entrar", "Não
 *    apresentado"). Dali se faz o check-in, na reserva.
 * 2. **Na casa** — quem está hospedado, com o que pede atenção agora: ocorrência sem contato,
 *    medicação, boletim retido. A linha abre a estadia.
 * 3. **Saem hoje** — hora e o que falta para liberar: pesar, conferir pertences, receber o saldo.
 *    Dali se faz o check-out, na estadia.
 *
 * Embaixo, **o que pede ação** (`UiPauta`): ocorrência sem contato e chegada sem documento como
 * urgentes, boletim retido como atenção, e a rotina atrasada pela mesma regra da Visão geral
 * (`tomDaRotinaAtrasada`: urgente se há medicação atrasada). Por último, calmo, **o bem-estar da
 * casa e a medicação de hoje** — o animal estressado não tem hora marcada, fica até alguém olhar.
 *
 * O trilho de horas que esta tela tinha ("Movimento do dia") saiu: a fita da casa, presa no alto
 * de todo o Hotel, já desenha o dia inteiro — rotina, chegadas, saídas e a agulha do agora.
 *
 * A ação cheia é abrir a rotina, o próximo passo de quem assume o turno; passar o turno é
 * contornada. O tutorial ("Como usar") é o botão de texto da moldura.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { porGravidade, type LinhaDaTabela } from '@/components/home/pauta-tabela'
import UiAbertura, { type IndicadorDaAbertura } from '@/components/ui/UiAbertura.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiPauta from '@/components/ui/UiPauta.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import BemEstarDaCasa from '@/features/hotel/components/painel/BemEstarDaCasa.vue'
import PassagemDialog from '@/features/hotel/components/rotina/PassagemDialog.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import {
  hospedagemRepository,
  type HospedeNaCasa,
  type ReservaNaLista,
  type TarefaNaPrancheta,
} from '@/features/hotel/data/repositories'
import type { ImpedimentoDeSaida } from '@/features/hotel/domain/estadia'
import { situacaoDaTarefa, tomDaRotinaAtrasada } from '@/features/hotel/domain/rotina'
import { hotelClock, useHotelStore } from '@/features/hotel/stores/hotel'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { useReservasStore } from '@/features/hotel/stores/reservas'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

const { t, locale } = useI18n()
const router = useRouter()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const hospedagem = useHospedagemStore()
const reservas = useReservasStore()

const passagemAberta = ref(false)
const hoje = hotelClock.today()

/** Quantos hóspedes a coluna "Na casa" mostra antes do link para a lista inteira. */
const LIMITE_NA_CASA = 6

/**
 * A primeira carga desenha a tela; as seguintes (quando outra tela muda algo) trocam os dados no
 * lugar, sem voltar ao "carregando".
 */
const carregou = ref(false)

async function carregar() {
  /* Os catálogos primeiro: as quatro leituras abaixo pedem o mesmo catálogo, e em paralelo cada
     uma o buscaria de novo. */
  await hotelStore.carregar()
  await Promise.all([
    hospedagem.carregarHospedes(),
    hospedagem.carregarPrancheta(hoje),
    hospedagem.carregarPassagem(),
    /* O recorte é só hoje: o painel responde pelo dia, e a semana tem o mapa. */
    reservas.carregarLista({ de: hoje, ate: hoje }),
  ])
  carregou.value = true
  await conferirSaidas()
}

onMounted(carregar)

watch(
  () => hotelStore.revisao,
  () => void carregar(),
)

// ------------------------------------------------------------------------------ o caminho

const chegamHoje = computed(() =>
  reservas.lista
    .filter(
      (linha) =>
        linha.reserva.entradaPrevista.slice(0, 10) === hoje &&
        (linha.reserva.status === 'confirmada' || linha.reserva.status === 'pendente'),
    )
    .sort((um, outro) => um.reserva.entradaPrevista.localeCompare(outro.reserva.entradaPrevista)),
)

const saemHoje = computed(() =>
  hospedagem.hospedes
    .filter((hospede) => hospede.saiHoje)
    .sort((um, outro) =>
      um.hospedagem.saidaPrevistaEm.localeCompare(outro.hospedagem.saidaPrevistaEm),
    ),
)

/** Documentação vencida ou não apresentada: o animal não entra até alguém resolver. */
function travada(linha: ReservaNaLista) {
  return linha.admissao === 'ausente' || linha.admissao === 'vencido'
}

type Tom = 'risco' | 'atencao' | 'ok' | 'neutro' | 'lugar'
type Selo = { id: string; tom: Tom; icone: string; texto: string }

function seloDaDocumentacao(linha: ReservaNaLista): Selo {
  if (linha.admissao === 'ok') {
    return {
      id: 'doc',
      tom: 'ok',
      icone: 'ph ph-check-circle',
      texto: t('hotel.painel.podeEntrar'),
    }
  }

  return {
    id: 'doc',
    tom: travada(linha) ? 'risco' : linha.admissao === 'vence-durante' ? 'atencao' : 'neutro',
    icone: travada(linha) ? 'ph ph-file-x' : 'ph ph-file-text',
    texto: formato.resumoDaAdmissao(linha.admissao),
  }
}

/** Minutos entre agora e um instante; negativo é passado. Lê o relógio que pulsa. */
function minutosAte(iso: string) {
  return Math.round((Date.parse(iso) - Date.parse(hospedagem.agora)) / 60_000)
}

/** Duração curta: acima de uma hora, só as horas — "atrasou 10 h" lê melhor que "10 h 22 min". */
function duracaoCurta(minutos: number) {
  return formato.duracao(minutos >= 60 ? Math.floor(minutos / 60) * 60 : minutos)
}

/**
 * O relógio de uma chegada ou saída: quanto falta, ou quanto atrasou. Meia hora de folga — o
 * trânsito de quem vem trazer o cachorro não é atraso.
 */
function relogio(iso: string) {
  const minutos = minutosAte(iso)

  if (minutos < -30) {
    return {
      texto: t('hotel.hoje.selo.atrasou', { tempo: duracaoCurta(-minutos) }),
      atrasado: true,
    }
  }

  if (minutos <= 5) {
    return { texto: t('hotel.hospedes.foco.agora'), atrasado: false }
  }

  return { texto: t('hotel.hospedes.foco.em', { tempo: duracaoCurta(minutos) }), atrasado: false }
}

function selosDaChegada(linha: ReservaNaLista): Selo[] {
  return [seloDaDocumentacao(linha)]
}

// ---- Saem hoje: o que falta para liberar, lido da estadia de cada um.

type ConferenciaDeSaida = { impedimentos: ImpedimentoDeSaida[]; saldoCentavos: number }

const conferencia = ref<Record<string, ConferenciaDeSaida>>({})

/**
 * O que trava cada saída mora no detalhe da estadia, carregado uma por vez. Quem sai hoje são
 * dois ou três: buscar o detalhe deles é barato, e é o que separa "Pronto para sair" de "falta
 * pesar e receber o saldo" antes de o responsável chegar ao balcão.
 */
async function conferirSaidas() {
  const ids = saemHoje.value.map((hospede) => hospede.hospedagem.id)
  const detalhes = await Promise.all(
    ids.map((id) => hospedagemRepository.abrir(id).catch(() => null)),
  )
  const mapa: Record<string, ConferenciaDeSaida> = {}

  detalhes.forEach((detalhe, indice) => {
    if (detalhe) {
      mapa[ids[indice]!] = {
        impedimentos: detalhe.impedimentos,
        saldoCentavos: detalhe.saldoCentavos,
      }
    }
  })

  conferencia.value = mapa
}

const SELO_DO_IMPEDIMENTO: Record<ImpedimentoDeSaida, { tom: Tom; icone: string; chave: string }> =
  {
    'peso-de-saida': { tom: 'atencao', icone: 'ph ph-scales', chave: 'hotel.painel.faltaPesar' },
    pertences: { tom: 'atencao', icone: 'ph ph-backpack', chave: 'hotel.hoje.selo.pertences' },
    'ocorrencia-sem-contato': {
      tom: 'risco',
      icone: 'ph ph-phone-call',
      chave: 'hotel.hoje.selo.ocorrencia',
    },
  }

function pendenciasDaSaida(hospede: HospedeNaCasa): Selo[] {
  const conferida = conferencia.value[hospede.hospedagem.id]
  /* Sem o detalhe (ainda carregando, ou falhou), vale o que a lista já sabe: a pesagem. */
  const impedimentos: ImpedimentoDeSaida[] =
    conferida?.impedimentos ?? (hospede.hospedagem.pesoSaidaKg === null ? ['peso-de-saida'] : [])

  const selos: Selo[] = impedimentos.map((kind) => ({
    id: kind,
    tom: SELO_DO_IMPEDIMENTO[kind].tom,
    icone: SELO_DO_IMPEDIMENTO[kind].icone,
    texto: t(SELO_DO_IMPEDIMENTO[kind].chave),
  }))

  if (conferida && conferida.saldoCentavos > 0) {
    selos.push({
      id: 'saldo',
      tom: 'neutro',
      icone: 'ph ph-money',
      texto: t('hotel.hoje.selo.saldo', { valor: formato.moeda(conferida.saldoCentavos) }),
    })
  }

  return selos
}

function prontoParaSair(hospede: HospedeNaCasa) {
  return pendenciasDaSaida(hospede).length === 0
}

function selosDaSaida(hospede: HospedeNaCasa): Selo[] {
  const pendencias = pendenciasDaSaida(hospede)

  return pendencias.length > 0
    ? pendencias
    : [
        {
          id: 'pronto',
          tom: 'ok',
          icone: 'ph ph-check-circle',
          texto: t('hotel.painel.prontoParaSair'),
        },
      ]
}

// ---- Na casa: quem está, com o que pede atenção agora.

/** As doses ainda por dar hoje, por estadia, da mais cedo para a mais tarde. */
const remediosPorEstadia = computed(() => {
  const mapa = new Map<string, TarefaNaPrancheta[]>()

  for (const linha of hospedagem.prancheta) {
    if (linha.tarefa.kind !== 'medicacao' || linha.tarefa.status !== 'pendente') {
      continue
    }

    mapa.set(linha.hospedagemId, [...(mapa.get(linha.hospedagemId) ?? []), linha])
  }

  for (const doses of mapa.values()) {
    doses.sort((uma, outra) => uma.tarefa.previstaPara.localeCompare(outra.tarefa.previstaPara))
  }

  return mapa
})

type NaCasa = { hospede: HospedeNaCasa; selos: Selo[]; peso: number }

/**
 * O que pede atenção em cada hóspede, e o peso que o ordena: ligação primeiro (é o único
 * trabalho que não se resolve andando pelo corredor), remédio atrasado, boletim parado, remédio na
 * hora, e por fim quem está bem.
 */
function naCasa(hospede: HospedeNaCasa): NaCasa {
  const selos: Selo[] = []
  let peso = 5

  if (hospede.ocorrenciaTravada) {
    selos.push({
      id: 'ocorrencia',
      tom: 'risco',
      icone: 'ph ph-phone-call',
      texto: t('hotel.hoje.selo.ocorrencia'),
    })
    peso = 0
  }

  const remedio = remediosPorEstadia.value.get(hospede.hospedagem.id)?.[0]

  if (remedio) {
    const situacao = situacaoDaTarefa(remedio.tarefa, hospedagem.agora)
    const hora = formato.hora(remedio.tarefa.previstaPara)

    selos.push({
      id: 'remedio',
      tom: situacao === 'atrasada' ? 'risco' : situacao === 'na-janela' ? 'atencao' : 'neutro',
      icone: 'ph ph-pill',
      texto:
        situacao === 'atrasada'
          ? t('hotel.hoje.selo.remedioAtrasado', { hora })
          : t('hotel.hoje.selo.remedio', { hora }),
    })
    peso = Math.min(peso, situacao === 'atrasada' ? 1 : situacao === 'na-janela' ? 3 : 4)
  }

  if (hospede.boletimRetido) {
    selos.push({
      id: 'boletim',
      tom: 'atencao',
      icone: 'ph ph-envelope-simple',
      texto: t('hotel.hoje.selo.boletim'),
    })
    peso = Math.min(peso, 2)
  }

  if (hospede.saiHoje) {
    selos.push({
      id: 'sai',
      tom: 'lugar',
      icone: 'ph ph-sign-out',
      texto: t('hotel.hoje.selo.saiHoje', {
        hora: formato.hora(hospede.hospedagem.saidaPrevistaEm),
      }),
    })
  }

  return { hospede, selos, peso }
}

const naCasaOrdenados = computed(() =>
  hospedagem.hospedes.map(naCasa).sort(
    (um, outro) =>
      um.peso - outro.peso ||
      um.hospede.acomodacaoNome.localeCompare(outro.hospede.acomodacaoNome, undefined, {
        numeric: true,
      }),
  ),
)

const naCasaVisiveis = computed(() => naCasaOrdenados.value.slice(0, LIMITE_NA_CASA))

function metaDoHospede(hospede: HospedeNaCasa) {
  return [
    hospede.acomodacaoNome,
    hospede.acompanhante ? t('hotel.hospedes.cartao.com', { pet: hospede.acompanhante.nome }) : '',
    t('hotel.hospedes.cartao.noites', { total: hospede.noites }, hospede.noites),
  ]
    .filter(Boolean)
    .join(' · ')
}

function rotaDaEstadia(hospedagemId: string) {
  return `/hotel/hospedagem/${hospedagemId}`
}

function rotaDaReserva(reservaId: string) {
  return `/hotel/reserva/${reservaId}`
}

// ------------------------------------------------------------------------- o que pede ação

function rostoDoHospede(hospede: HospedeNaCasa): LinhaDaTabela['pet'] {
  return {
    nome: hospede.petNome,
    iniciais: hospede.petIniciais,
    especie: hospede.petEspecie,
    fotoUrl: hospede.petFotoUrl,
  }
}

/**
 * O que pede ação. Só entra o que **alguém precisa fazer agora**: ocorrência grave sem contato com
 * o responsável, boletim preso atrás dela, chegada de hoje sem documento, e — numa linha só — as
 * tarefas atrasadas da rotina, cuja lista mora na prancheta. Documento vencendo de uma reserva de
 * daqui a três dias é trabalho da véspera e mora na tela de reservas.
 */
const linhasDaPauta = computed<LinhaDaTabela[]>(() => {
  const linhas: LinhaDaTabela[] = []
  const estadia = t('hotel.painel.onde.estadia')

  for (const hospede of hospedagem.hospedes) {
    const to = rotaDaEstadia(hospede.hospedagem.id)
    const responsavel = t('hotel.painel.pauta.responsavel', {
      nome: hospede.tutorNome,
      telefone: hospede.tutorTelefone,
    })

    if (hospede.ocorrenciaTravada) {
      linhas.push({
        id: `ocor-${hospede.hospedagem.id}`,
        to,
        frase: t('hotel.painel.pauta.ocorrencia', { pet: hospede.petNome }),
        detalhe: responsavel,
        tom: 'risco',
        onde: estadia,
        pet: rostoDoHospede(hospede),
      })
    } else if (hospede.boletimRetido) {
      linhas.push({
        id: `bol-${hospede.hospedagem.id}`,
        to,
        frase: t('hotel.painel.pauta.boletim', { pet: hospede.petNome }),
        detalhe: responsavel,
        tom: 'atencao',
        onde: estadia,
        pet: rostoDoHospede(hospede),
      })
    }
  }

  for (const linha of chegamHoje.value) {
    if (travada(linha)) {
      linhas.push({
        id: `adm-${linha.reserva.id}`,
        to: rotaDaReserva(linha.reserva.id),
        frase: t('hotel.painel.travaAdmissao', {
          pet: linha.petNome,
          hora: formato.hora(linha.reserva.entradaPrevista),
        }),
        detalhe: t('hotel.painel.travaAdmissaoAcao'),
        tom: 'risco',
        onde: t('hotel.painel.onde.reserva'),
        pet: {
          nome: linha.petNome,
          iniciais: linha.petIniciais,
          especie: linha.petEspecie,
          fotoUrl: linha.petFotoUrl,
        },
      })
    }
  }

  const atrasadas = hospedagem.atrasadasNaPrancheta
  const medicacoes = hospedagem.medicacoesAtrasadasNaPrancheta

  if (atrasadas > 0) {
    linhas.push({
      id: 'rotina',
      to: '/hotel/rotina',
      frase: t('inicio.pauta.rotina', { total: atrasadas }, atrasadas),
      detalhe:
        medicacoes > 0
          ? t('inicio.pauta.parte.medicacoesAtrasadas', { total: medicacoes }, medicacoes)
          : undefined,
      // A mesma regra da Visão geral: medicação atrasada torna a rotina urgente.
      tom: tomDaRotinaAtrasada(atrasadas, medicacoes),
      onde: t('inicio.pauta.onde.rotina'),
    })
  }

  return porGravidade(linhas)
})

// ------------------------------------------------------------------------------ o cabeçalho

const urgentes = computed(() => linhasDaPauta.value.filter((linha) => linha.tom === 'risco').length)

const fraseDoResumo = computed(() => {
  const total = linhasDaPauta.value.length

  if (urgentes.value > 0) {
    return t('clinico.meuDia.resumo.urgentes', { total: urgentes.value }, urgentes.value)
  }

  if (total > 0) {
    return t('clinico.meuDia.resumo.pendentes', { total }, total)
  }

  return t('hotel.hoje.painel.emDia')
})

const dataDeHoje = computed(() => {
  const intl = INTL_LOCALE[locale.value as Locale]
  const rotulo = formato.dataLonga(hoje)

  return rotulo.charAt(0).toLocaleUpperCase(intl) + rotulo.slice(1)
})

const turno = computed(() => hospedagem.passagem?.turno ?? null)

const plantonista = computed(() =>
  turno.value ? hotelStore.cuidador(turno.value.responsavelId) : null,
)

/** O turno numa frase, como o plantão da internação: "Tarde, 14:00–22:00, com Taís." */
const fraseDoTurno = computed(() => {
  if (!turno.value) {
    return ''
  }

  const partes = {
    turno: formato.turno(turno.value.kind),
    horario: `${formato.hora(turno.value.inicio)}–${formato.hora(turno.value.fim)}`,
  }

  return plantonista.value
    ? t('clinico.internacao.nova.resumo.plantaoCom', { ...partes, nome: plantonista.value.nome })
    : t('clinico.internacao.nova.resumo.plantao', partes)
})

/** A linha de cima da abertura: a data e, com turno aberto, quem está nele. */
const sobreAAbertura = computed(() =>
  [dataDeHoje.value, fraseDoTurno.value].filter(Boolean).join(' · '),
)

/** "0 de 49 tarefas da rotina feitas": o ritmo do dia, embaixo da frase principal. */
const andamentoDaRotina = computed(() => {
  const { feitas, total } = hospedagem.hospedes.reduce(
    (soma, hospede) => ({
      feitas: soma.feitas + hospede.rotinaDoDia.resolvidas,
      total: soma.total + hospede.rotinaDoDia.total,
    }),
    { feitas: 0, total: 0 },
  )

  return total ? t('inicio.espacos.hotel.andamento', { feitas, total }, total) : ''
})

/**
 * Quantos animais estão na casa, com o acompanhante contado.
 *
 * A lista tem uma linha por estadia ("Mel · com Amora"), mas o número é de animais, como no
 * Início. Antes o painel dizia "5 Na casa" e o Início, no mesmo instante, "6 Na casa".
 */
const animaisNaCasa = computed(() =>
  hospedagem.hospedes.reduce((soma, hospede) => soma + (hospede.acompanhante ? 2 : 1), 0),
)

/** Os quatro números da casa, os mesmos da fita e do Início, cada um levando aonde se resolve. */
const indicadores = computed<IndicadorDaAbertura[]>(() => {
  const naCasaTotal = animaisNaCasa.value
  const chegam = chegamHoje.value.length
  const saem = saemHoje.value.length
  const atrasadas = hospedagem.atrasadasNaPrancheta
  const tomDaRotina = tomDaRotinaAtrasada(atrasadas, hospedagem.medicacoesAtrasadasNaPrancheta)

  return [
    {
      id: 'casa',
      valor: naCasaTotal,
      rotulo: t('inicio.espacos.hotel.naCasa'),
      icone: 'ph ph-house-line',
      to: '/hotel/hospedes',
    },
    {
      id: 'chegam',
      valor: chegam,
      rotulo: t('inicio.espacos.hotel.chegam', { total: chegam }, chegam),
      icone: 'ph ph-sign-in',
      to: '/hotel/reservas',
      tom: chegamHoje.value.some(travada) ? 'risco' : undefined,
    },
    {
      id: 'saem',
      valor: saem,
      rotulo: t('inicio.espacos.hotel.saem', { total: saem }, saem),
      icone: 'ph ph-sign-out',
      to: '/hotel/hospedes',
    },
    {
      id: 'rotina',
      valor: atrasadas,
      rotulo: t('inicio.espacos.hotel.rotina', { total: atrasadas }, atrasadas),
      icone: 'ph ph-list-checks',
      to: '/hotel/rotina',
      tom: tomDaRotina === 'neutro' ? undefined : tomDaRotina,
    },
  ]
})

/** A leitura do dia falhou: a abertura fica sem números, e o corpo mostra o erro. */
const falhouALeitura = computed(() => Boolean(hospedagem.erro))

const vazio = computed(
  () =>
    carregou.value &&
    !hospedagem.erro &&
    hospedagem.hospedes.length === 0 &&
    chegamHoje.value.length === 0,
)

async function entregarTurno(nota: string, recebidoPor: string) {
  if (await hospedagem.entregarTurno(nota, recebidoPor)) {
    passagemAberta.value = false
  }
}

// ------------------------------------------------------------------------------ o tutorial

/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.hoje.painel.tour.pergunta.titulo'),
    texto: t('hotel.hoje.painel.tour.pergunta.texto'),
  },
  {
    alvo: '.fita',
    titulo: t('hotel.hoje.painel.tour.fita.titulo'),
    texto: t('hotel.hoje.painel.tour.fita.texto'),
  },
  {
    alvo: '.posto--chegam',
    titulo: t('hotel.hoje.painel.tour.chegam.titulo'),
    texto: t('hotel.hoje.painel.tour.chegam.texto'),
  },
  {
    alvo: '.posto--casa',
    titulo: t('hotel.hoje.painel.tour.casa.titulo'),
    texto: t('hotel.hoje.painel.tour.casa.texto'),
  },
  {
    alvo: '.posto--saem',
    titulo: t('hotel.hoje.painel.tour.saem.titulo'),
    texto: t('hotel.hoje.painel.tour.saem.texto'),
  },
  {
    alvo: '.pauta-do-dia',
    titulo: t('hotel.hoje.painel.tour.pauta.titulo'),
    texto: t('hotel.hoje.painel.tour.pauta.texto'),
  },
  {
    alvo: '.bem-estar',
    titulo: t('hotel.hoje.painel.tour.bemEstar.titulo'),
    texto: t('hotel.hoje.painel.tour.bemEstar.texto'),
  },
  {
    alvo: '.acao-turno',
    titulo: t('hotel.hoje.painel.tour.turno.titulo'),
    texto: t('hotel.hoje.painel.tour.turno.texto'),
  },
])
</script>

<template>
  <UiPagina
    :carregando="!carregou && !hospedagem.erro"
    :erro="hospedagem.erro ? t(hospedagem.erro) : ''"
    :vazio="vazio"
    :vazio-titulo="t('hotel.painel.vazioTitulo')"
    :vazio-descricao="t('hotel.painel.vazioDescricao')"
    vazio-icone="ph ph-sun-horizon"
    @tentar-de-novo="carregar"
  >
    <!--
      A abertura responde "como está a casa" antes de qualquer lista: a data e o turno em cima, a
      frase do momento, o ritmo da rotina e os quatro números da fita.
    -->
    <template #cabecalho>
      <!--
        Sem dados não há frase nem número: com a leitura falhando, a abertura dizia "0 Na casa ·
        0 Chegam hoje" em cima do "Não foi possível carregar", e o zero lia como casa vazia.
      -->
      <UiAbertura
        class="hoje__abertura"
        :sobre="sobreAAbertura"
        :titulo="falhouALeitura ? t('hotel.painel.titulo') : fraseDoResumo"
        :resumo="falhouALeitura ? '' : andamentoDaRotina"
        :indicadores="falhouALeitura ? [] : indicadores"
        :rotulo-dos-indicadores="t('clinico.meuDia.abertura.indicadores')"
      >
        <template #acoes>
          <Button
            :as="RouterLink"
            to="/hotel/rotina"
            icon="ph ph-list-checks"
            :label="t('hotel.painel.irParaRotina')"
          />
          <Button
            v-if="turno"
            type="button"
            class="acao-turno"
            icon="ph ph-arrows-left-right"
            :label="t('hotel.turno.passar')"
            severity="secondary"
            @click="passagemAberta = true"
          />
          <Button
            type="button"
            icon="ph ph-question"
            :label="t('shell.guidance.tour')"
            severity="secondary"
            text
            :title="t('shell.guidance.tourTitulo')"
            @click="tourAberto = true"
          />
        </template>
      </UiAbertura>
    </template>

    <div class="hoje">
      <!-- O caminho do hóspede pela casa: entra, fica, sai. -->
      <div class="caminho">
        <section class="posto posto--chegam ui-folha" aria-labelledby="posto-chegam">
          <header class="posto__cabeca">
            <span class="ui-ladrilho ui-ladrilho--ok" aria-hidden="true">
              <i class="ph ph-sign-in" />
            </span>
            <h2 id="posto-chegam">{{ t('hotel.hoje.painel.chegam') }}</h2>
            <span class="posto__total ui-num">{{ chegamHoje.length }}</span>
          </header>

          <ul v-if="chegamHoje.length" class="ui-lista">
            <li v-for="linha in chegamHoje" :key="linha.reserva.id" class="posto__item">
              <div class="posto__quem">
                <PetAvatar
                  :nome="linha.petNome"
                  :iniciais="linha.petIniciais"
                  :especie="linha.petEspecie"
                  :foto-url="linha.petFotoUrl"
                  tamanho="md"
                />
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">{{ linha.petNome }}</strong>
                  <span class="ui-linha__meta">
                    {{ linha.acomodacaoNome }} · {{ linha.tutorNome }}
                  </span>
                </span>
                <span
                  class="posto__tempo"
                  :class="{
                    'posto__tempo--atrasado': relogio(linha.reserva.entradaPrevista).atrasado,
                  }"
                >
                  <strong class="ui-num">{{ formato.hora(linha.reserva.entradaPrevista) }}</strong>
                  <small>{{ relogio(linha.reserva.entradaPrevista).texto }}</small>
                </span>
              </div>

              <ul class="posto__selos" :aria-label="t('hotel.hoje.painel.situacao')">
                <li
                  v-for="selo in selosDaChegada(linha)"
                  :key="selo.id"
                  class="ui-selo"
                  :class="`ui-selo--${selo.tom}`"
                >
                  <i :class="selo.icone" aria-hidden="true" />
                  {{ selo.texto }}
                </li>
              </ul>

              <div class="posto__acoes">
                <Button
                  :as="RouterLink"
                  :to="
                    travada(linha)
                      ? rotaDaReserva(linha.reserva.id)
                      : { path: rotaDaReserva(linha.reserva.id), query: { checkin: '1' } }
                  "
                  size="small"
                  :icon="travada(linha) ? 'ph ph-file-text' : 'ph ph-sign-in'"
                  :label="
                    travada(linha)
                      ? t('hotel.hoje.painel.verDocumentacao')
                      : t('hotel.reserva.fazerCheckIn')
                  "
                  :severity="travada(linha) ? 'secondary' : undefined"
                  :outlined="travada(linha)"
                />
              </div>
            </li>
          </ul>
          <p v-else class="ui-vazio">{{ t('hotel.painel.semChegadas') }}</p>
        </section>

        <section class="posto posto--casa ui-folha" aria-labelledby="posto-casa">
          <header class="posto__cabeca">
            <span class="ui-ladrilho" aria-hidden="true">
              <i class="ph ph-house-line" />
            </span>
            <h2 id="posto-casa">{{ t('hotel.hoje.painel.naCasa') }}</h2>
            <span class="posto__total ui-num">{{ animaisNaCasa }}</span>
          </header>

          <ul v-if="naCasaVisiveis.length" class="ui-lista">
            <li v-for="item in naCasaVisiveis" :key="item.hospede.hospedagem.id">
              <RouterLink
                class="posto__item posto__item--link"
                :to="rotaDaEstadia(item.hospede.hospedagem.id)"
              >
                <span class="posto__quem">
                  <span class="posto__rostos">
                    <PetAvatar
                      :nome="item.hospede.petNome"
                      :iniciais="item.hospede.petIniciais"
                      :especie="item.hospede.petEspecie"
                      :foto-url="item.hospede.petFotoUrl"
                      tamanho="md"
                    />
                    <PetAvatar
                      v-if="item.hospede.acompanhante"
                      class="posto__segundo"
                      :nome="item.hospede.acompanhante.nome"
                      :iniciais="item.hospede.acompanhante.iniciais"
                      :especie="item.hospede.acompanhante.especie"
                      :foto-url="item.hospede.acompanhante.fotoUrl"
                      tamanho="xs"
                    />
                  </span>
                  <span class="ui-linha__texto">
                    <strong class="ui-linha__titulo">{{ item.hospede.petNome }}</strong>
                    <span class="ui-linha__meta">{{ metaDoHospede(item.hospede) }}</span>
                  </span>
                  <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
                </span>

                <span v-if="item.selos.length" class="posto__selos">
                  <span
                    v-for="selo in item.selos"
                    :key="selo.id"
                    class="ui-selo"
                    :class="`ui-selo--${selo.tom}`"
                  >
                    <i :class="selo.icone" aria-hidden="true" />
                    {{ selo.texto }}
                  </span>
                </span>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="ui-vazio">{{ t('hotel.hospedes.vazioTitulo') }}</p>

          <footer v-if="hospedagem.hospedes.length" class="posto__pe">
            <RouterLink class="ui-mais" to="/hotel/hospedes">
              {{ t('hotel.hoje.painel.todosOsHospedes', { total: animaisNaCasa }, animaisNaCasa) }}
              <i class="ph ph-arrow-right" aria-hidden="true" />
            </RouterLink>
          </footer>
        </section>

        <section class="posto posto--saem ui-folha" aria-labelledby="posto-saem">
          <header class="posto__cabeca">
            <span class="ui-ladrilho ui-ladrilho--neutro" aria-hidden="true">
              <i class="ph ph-sign-out" />
            </span>
            <h2 id="posto-saem">{{ t('hotel.hoje.painel.saem') }}</h2>
            <span class="posto__total ui-num">{{ saemHoje.length }}</span>
          </header>

          <ul v-if="saemHoje.length" class="ui-lista">
            <li v-for="hospede in saemHoje" :key="hospede.hospedagem.id" class="posto__item">
              <div class="posto__quem">
                <PetAvatar
                  :nome="hospede.petNome"
                  :iniciais="hospede.petIniciais"
                  :especie="hospede.petEspecie"
                  :foto-url="hospede.petFotoUrl"
                  tamanho="md"
                />
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">{{ hospede.petNome }}</strong>
                  <span class="ui-linha__meta">
                    {{ hospede.acomodacaoNome }} · {{ hospede.tutorNome }}
                  </span>
                </span>
                <span
                  class="posto__tempo"
                  :class="{
                    'posto__tempo--atrasado': relogio(hospede.hospedagem.saidaPrevistaEm).atrasado,
                  }"
                >
                  <strong class="ui-num">{{
                    formato.hora(hospede.hospedagem.saidaPrevistaEm)
                  }}</strong>
                  <small>{{ relogio(hospede.hospedagem.saidaPrevistaEm).texto }}</small>
                </span>
              </div>

              <ul class="posto__selos" :aria-label="t('hotel.hoje.painel.faltaParaSair')">
                <li
                  v-for="selo in selosDaSaida(hospede)"
                  :key="selo.id"
                  class="ui-selo"
                  :class="`ui-selo--${selo.tom}`"
                >
                  <i :class="selo.icone" aria-hidden="true" />
                  {{ selo.texto }}
                </li>
              </ul>

              <div class="posto__acoes">
                <Button
                  :as="RouterLink"
                  :to="{ path: rotaDaEstadia(hospede.hospedagem.id), query: { checkout: '1' } }"
                  size="small"
                  icon="ph ph-sign-out"
                  :label="t('hotel.estadia.fazerCheckOut')"
                  :severity="prontoParaSair(hospede) ? undefined : 'secondary'"
                  :outlined="!prontoParaSair(hospede)"
                />
              </div>
            </li>
          </ul>
          <p v-else class="ui-vazio">{{ t('hotel.painel.semSaidas') }}</p>
        </section>
      </div>

      <UiSecao
        id="hoje-pauta"
        class="pauta-do-dia"
        :titulo="t('inicio.pauta.titulo')"
        :contagem="linhasDaPauta.length || null"
      >
        <UiPauta v-if="linhasDaPauta.length" :linhas="linhasDaPauta" />
        <p v-else class="ui-folha ui-vazio calma">
          <i class="ph ph-check-circle" aria-hidden="true" />
          <strong>{{ t('inicio.pauta.calma') }}</strong>
        </p>
      </UiSecao>

      <!--
        Como os bichos estão. Vem por último de propósito: chegada e saída têm hora marcada e por
        isso mandam na manhã, mas o animal estressado não tem hora — ele fica até alguém olhar.
      -->
      <BemEstarDaCasa
        class="bem-estar"
        :hospedes="hospedagem.hospedes"
        :prancheta="hospedagem.prancheta"
        :agora="hospedagem.agora"
      />
    </div>

    <template #sempre>
      <PassagemDialog
        :aberto="passagemAberta"
        :passagem="hospedagem.passagem"
        :cuidadores="hotelStore.cuidadores"
        :salvando="hospedagem.salvando"
        :erro="hospedagem.erroDeAcao"
        @fechar="passagemAberta = false"
        @entregar="({ nota, recebidoPor }) => entregarTurno(nota, recebidoPor)"
        @ir-para="(id) => router.push(rotaDaEstadia(id))"
      />

      <HotelDevPanel />

      <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
    </template>
  </UiPagina>
</template>

<style scoped>
.hoje {
  display: grid;
  gap: 40px;
  grid-template-columns: minmax(0, 1fr);
}

.hoje__abertura {
  flex: 1;
  min-width: 0;
}

/*
 * As três colunas são o caminho do hóspede: da esquerda (chega) para a direita (sai). Um nó entre
 * elas diz que é um caminho, e não três listas soltas — o mesmo desenho do Hoje da Clínica.
 */
.caminho {
  display: grid;
  align-items: start;
  gap: 28px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.posto {
  position: relative;
  display: flex;
  flex-direction: column;
}

.caminho > .posto:not(:last-child)::after {
  position: absolute;
  z-index: 1;
  top: 30px;
  right: -23px;
  width: 18px;
  height: 18px;
  border: 1px solid var(--linha);
  border-radius: 50%;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  content: '';
}

.caminho > .posto:not(:last-child)::before {
  position: absolute;
  z-index: 2;
  top: 36px;
  right: -16px;
  width: 5px;
  height: 5px;
  border-top: 1.5px solid var(--tinta-3);
  border-right: 1.5px solid var(--tinta-3);
  content: '';
  transform: rotate(45deg);
}

.posto__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 24px 16px;
  border-radius: var(--raio-cartao) var(--raio-cartao) 0 0;
}

/* O cabeçalho de cada coluna desce do tom do estado para o papel: entrar, estar, sair. */
.posto--chegam .posto__cabeca {
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--ok-fundo) 70%, var(--superficie)),
    var(--superficie)
  );
}

.posto--casa .posto__cabeca {
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--pj-lugar-fundo) 75%, var(--superficie)),
    var(--superficie)
  );
}

.posto--saem .posto__cabeca {
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--superficie-3) 70%, var(--superficie)),
    var(--superficie)
  );
}

.posto__cabeca h2 {
  flex: 1;
  margin: 0;
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.posto__total {
  color: var(--tinta);
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.posto > .ui-lista {
  border-top: 1px solid var(--linha-suave);
}

.posto__item {
  display: grid;
  gap: 12px;
  padding: 16px 24px 18px;
}

.posto__item--link {
  gap: 10px;
  padding-block: 14px 16px;
  color: var(--tinta);
  text-decoration: none;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.posto__item--link:hover {
  background: var(--superficie-2);
}

.posto__item--link:hover .ui-linha__seta {
  color: var(--tinta);
  transform: translateX(2px);
}

.posto__item--link:focus-visible {
  outline: 2px solid var(--pj-lugar);
  outline-offset: -2px;
}

.posto .ui-lista > li:last-child > .posto__item--link {
  border-radius: 0 0 calc(var(--raio-cartao) - 1px) calc(var(--raio-cartao) - 1px);
}

.posto__quem {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

/*
 * O número grande é a hora marcada, como o tempo de espera no Hoje da Clínica; embaixo, quanto
 * falta ou quanto atrasou. Atraso pinta o número e a legenda de âmbar — e a legenda diz em
 * palavra.
 */
.posto__tempo {
  display: grid;
  flex: none;
  justify-items: end;
  line-height: 1.05;
}

.posto__tempo strong {
  color: var(--tinta);
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.posto--chegam .posto__tempo strong {
  color: var(--ok-tinta);
}

.posto__tempo small {
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 11.5px;
  white-space: nowrap;
}

.posto .posto__tempo--atrasado strong,
.posto .posto__tempo--atrasado small {
  color: var(--atencao-tinta);
}

.posto__tempo--atrasado small {
  font-weight: 600;
}

/* O par divide a acomodação: o segundo rosto encosta no canto do primeiro. */
.posto__rostos {
  position: relative;
  display: inline-flex;
  flex: none;
}

.posto__segundo {
  position: absolute;
  inset-block-end: -3px;
  inset-inline-end: -5px;
  box-shadow: 0 0 0 2px var(--superficie);
}

.posto__selos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0 0 0 51px;
  list-style: none;
}

.posto__selos .ui-selo {
  flex: 0 1 auto;
  max-width: 100%;
  height: auto;
  min-height: 24px;
  padding-block: 4px;
  white-space: normal;
}

.posto__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding-inline-start: 51px;
}

.posto__acoes :deep(a.p-button) {
  text-decoration: none;
}

.posto .ui-vazio {
  flex: 1;
  align-content: center;
  justify-items: center;
  border-top: 1px solid var(--linha-suave);
  color: var(--tinta-3);
  text-align: center;
}

.posto__pe {
  margin-top: auto;
  padding: 14px 24px 18px;
  border-top: 1px solid var(--linha-suave);
}

.calma {
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
  gap: 10px;
}

.calma i {
  color: var(--ok-tinta);
  font-size: 20px;
}

@media (max-width: 1240px) {
  .caminho {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .posto--casa {
    grid-row: span 2;
  }

  .caminho > .posto:nth-child(2)::before,
  .caminho > .posto:nth-child(2)::after {
    display: none;
  }
}

@media (max-width: 760px) {
  .caminho {
    grid-template-columns: minmax(0, 1fr);
  }

  .posto--casa {
    grid-row: auto;
  }

  .caminho > .posto::before,
  .caminho > .posto::after {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .posto__item--link {
    transition: none;
  }
}
</style>
