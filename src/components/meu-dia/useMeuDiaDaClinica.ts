/**
 * O Meu dia da clínica de verdade, pela rota `meu-dia` (E3-08, PJ-W2RB1D; guia e3 8.4).
 *
 * Monta o mesmo modelo que a demonstração (`ModeloDoMeuDia`), para o desenho do app
 * (`MeuDiaFoco`) servir aos dois. A conta sai do servidor: quem está na sala, na recepção e por vir
 * vem dos blocos `atendimentos` e `salaDeEspera`; o que pede ação, dos outros blocos. Bloco ausente
 * é falta de permissão e não aparece (nunca "0"); bloco que falhou entra na lista de falhas, com o
 * tentar de novo, e o resto da tela vale.
 *
 * A tela fica aberta o dia todo: relê de 30 em 30 segundos enquanto está visível (o teto é de 600
 * leituras por hora, e a guia pede no máximo uma a cada 10 s) e ao voltar para a aba.
 */
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, type RouteLocationRaw } from 'vue-router'

import { porGravidade, type LinhaDaTabela } from '@/components/home/pauta-tabela'
import type { IndicadorDaAbertura } from '@/components/ui/UiAbertura.vue'
import { lerErroDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type {
  HorarioDoDia,
  ModeloDoMeuDia,
  PacienteDoDia,
} from '@/features/clinico/composables/modelo-do-meu-dia'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { rotaDoModulo } from '@/navegacao/rotas-dos-modulos'
import { listarTipos } from '@/service/parceiro/agenda-config-service'
import {
  lerMeuDia,
  STATUS_DO_PAINEL,
  type BlocoDoPainel,
  type EscopoDoMeuDia,
  type ItemDoPainel,
  type MeuDiaDaClinica,
} from '@/service/parceiro/painel-service'
import { listarProfissionais } from '@/service/parceiro/profissionais-service'

const RELER_A_CADA_MS = 30_000
const MENOR_INTERVALO_MS = 10_000

/** A ordem dos blocos na frase de falha. */
const BLOCOS = [
  'atendimentos',
  'salaDeEspera',
  'faltasSemJustificativa',
  'retornosPendentes',
  'preConsultasNovas',
  'rascunhos',
  'internados',
] as const

export function iniciaisDe(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const letras =
    partes.length > 1 ? [partes[0]![0], partes[partes.length - 1]![0]] : [partes[0]?.[0]]
  return letras.filter(Boolean).join('').toLocaleUpperCase()
}

/** O item do bloco `atendimentos` como o desenho lê; a chegada vem da sala de espera. */
export function horarioDoItem(item: ItemDoPainel, chegadas: Map<string, string>): HorarioDoDia {
  const status =
    STATUS_DO_PAINEL[(item.status ?? 'AGENDADO') as keyof typeof STATUS_DO_PAINEL] ?? 'agendado'
  return {
    id: item.id,
    petId: item.pacienteId ?? item.id,
    status,
    inicio: item.quando ?? '',
    chegadaEm: chegadas.get(item.id) ?? null,
    iniciadoEm: null,
  }
}

/** A tela do assunto, se já fala com a API; senão, a alternativa que abre (a guarda barraria). */
function seIntegrada(caminho: string, senao: RouteLocationRaw): RouteLocationRaw {
  return rotaDoModulo(caminho)?.integrada ? caminho : senao
}

export function useMeuDiaDaClinica() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const { parceiroQuery } = useParceiroPortal()

  const resposta = ref<MeuDiaDaClinica | null>(null)
  const erro = ref('')
  const escolhido = ref<EscopoDoMeuDia | null>(null)
  /** Teve ficha de profissional em alguma leitura: o seletor "Minha agenda / Clínica" cabe. */
  const temFicha = ref(false)
  const agora = ref(Date.now())
  const tipos = ref(new Map<string, string>())
  const profissionais = ref(new Map<string, string>())
  let ultimaLeitura = 0
  let lendo = false

  function bloco(chave: string): BlocoDoPainel | undefined {
    return resposta.value?.blocos[chave]
  }

  /** Os itens de um bloco que veio inteiro; falhou ou ausente, nada. */
  function itensDe(chave: string): ItemDoPainel[] {
    const lido = bloco(chave)
    return lido && !lido.falhou ? lido.itens : []
  }

  const porId = computed(() => new Map(itensDe('atendimentos').map((item) => [item.id, item])))

  const chegadas = computed(
    () =>
      new Map(
        itensDe('salaDeEspera')
          .filter((item) => item.quando)
          .map((item) => [item.id, item.quando!]),
      ),
  )

  const horarios = computed(() =>
    itensDe('atendimentos').map((item) => horarioDoItem(item, chegadas.value)),
  )

  const pacientes = computed(() => {
    const mapa = new Map<string, PacienteDoDia>()
    for (const chave of BLOCOS) {
      for (const item of itensDe(chave)) {
        if (!item.pacienteId || !item.pacienteNome || mapa.has(item.pacienteId)) continue
        mapa.set(item.pacienteId, {
          nome: item.pacienteNome,
          iniciais: iniciaisDe(item.pacienteNome),
          especie: null,
          fotoUrl: '',
          alertas: [],
        })
      }
    }
    return mapa
  })

  const emConsulta = computed(() => horarios.value.filter((h) => h.status === 'em-atendimento'))

  /** A recepção na ordem da chegada (a da sala de espera), com quem ainda não está na lista do dia. */
  const naRecepcao = computed(() => {
    const doDia = new Map(horarios.value.map((h) => [h.id, h]))
    return itensDe('salaDeEspera').map(
      (item) =>
        doDia.get(item.id) ?? {
          ...horarioDoItem({ ...item, status: 'AGUARDANDO' }, chegadas.value),
          inicio: item.quando ?? '',
        },
    )
  })

  /** O que ainda vem: marcado ou confirmado cujo fim não passou (o atrasado continua aqui). */
  const aSeguir = computed(() =>
    horarios.value
      .filter((h) => {
        if (h.status !== 'agendado' && h.status !== 'confirmado') return false
        const fim = porId.value.get(h.id)?.fim ?? h.inicio
        return Date.parse(fim) > agora.value
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio)),
  )

  const destaque = computed(
    () => emConsulta.value[0] ?? naRecepcao.value[0] ?? aSeguir.value[0] ?? null,
  )

  /* -------------------------------------------------------------------- o que pede ação */

  function nomesComResto(nomes: string[], mostrar = 2) {
    const visiveis = nomes.filter(Boolean).slice(0, mostrar).join(', ')
    const resto = nomes.length - mostrar
    return resto > 0 ? t('clinico.meuDia.pauta.eMais', { nomes: visiveis, total: resto }) : visiveis
  }

  function quantos(chave: string) {
    const lido = bloco(chave)
    if (!lido || lido.falhou || !lido.total) return null
    return { total: lido.total, mais: lido.truncado }
  }

  const linhasDaPauta = computed<LinhaDaTabela[]>(() => {
    const linhas: LinhaDaTabela[] = []

    /* Internados que cobram ação, pintados pela urgência (nunca pela gravidade). */
    for (const item of itensDe('internados')) {
      const urgencia = item.urgencia
      linhas.push({
        id: `internado-${item.id}`,
        to: seIntegrada('/clinica/internacao', `/clinica/ficha/${item.pacienteId ?? ''}`),
        frase: t('clinico.meuDia.pautaApi.internado', { pet: item.pacienteNome ?? '' }),
        detalhe: item.leitoNome ?? '',
        tom: urgencia === 'URGENTE' ? 'risco' : urgencia === 'ATENCAO' ? 'atencao' : 'neutro',
        onde: t('inicio.pauta.onde.internacao'),
      })
    }

    const faltas = quantos('faltasSemJustificativa')
    if (faltas) {
      linhas.push({
        id: 'faltas',
        to: { path: '/clinica/faltas', query: { semJustificativa: 'true' } },
        frase: t(
          faltas.mais ? 'clinico.meuDia.pautaApi.faltasMais' : 'clinico.meuDia.pautaApi.faltas',
          { total: faltas.total },
          faltas.total,
        ),
        tom: 'atencao',
        onde: t('clinico.meuDia.onde.faltas'),
      })
    }

    const retornos = quantos('retornosPendentes')
    if (retornos) {
      linhas.push({
        id: 'retornos',
        to: seIntegrada('/clinica/atividades', '/clinica/agenda'),
        frase: t('clinico.meuDia.pauta.retornos', { total: retornos.total }, retornos.total),
        detalhe: nomesComResto(itensDe('retornosPendentes').map((item) => item.pacienteNome ?? '')),
        tom: 'neutro',
        onde: t('inicio.pauta.onde.atividades'),
      })
    }

    const preConsultas = quantos('preConsultasNovas')
    if (preConsultas) {
      linhas.push({
        id: 'pre-consultas',
        to: '/clinica/agenda',
        frase: t(
          'clinico.meuDia.pautaApi.preConsultas',
          { total: preConsultas.total },
          preConsultas.total,
        ),
        detalhe: nomesComResto(itensDe('preConsultasNovas').map((item) => item.pacienteNome ?? '')),
        tom: 'neutro',
        onde: t('clinico.meuDia.onde.agenda'),
      })
    }

    const rascunhos = quantos('rascunhos')
    if (rascunhos) {
      linhas.push({
        id: 'rascunhos',
        to: seIntegrada('/clinica/atividades', '/clinica/agenda'),
        frase: t('clinico.meuDia.pautaApi.rascunhos', { total: rascunhos.total }, rascunhos.total),
        detalhe: nomesComResto(itensDe('rascunhos').map((item) => item.pacienteNome ?? '')),
        tom: 'neutro',
        onde: t('inicio.pauta.onde.atividades'),
      })
    }

    return porGravidade(linhas)
  })

  const falhas = computed(() =>
    BLOCOS.filter((chave) => bloco(chave)?.falhou).map((chave) =>
      t(`clinico.meuDia.bloco.${chave}`),
    ),
  )

  /* --------------------------------------------------------------------------- o resumo */

  const urgentes = computed(() => linhasDaPauta.value.filter((linha) => linha.tom === 'risco'))

  const fraseDoResumo = computed(() => {
    const total = linhasDaPauta.value.length + naRecepcao.value.length
    if (urgentes.value.length) {
      return t(
        'clinico.meuDia.resumo.urgentes',
        { total: urgentes.value.length },
        urgentes.value.length,
      )
    }
    if (total > 0) return t('clinico.meuDia.resumo.pendentes', { total }, total)
    return t('clinico.meuDia.resumo.emDia')
  })

  const dataDeHoje = computed(() => {
    const dia = resposta.value?.data
    if (!dia) return ''
    const intl = INTL_LOCALE[locale.value as Locale]
    const [a, m, d] = dia.split('-').map(Number)
    const rotulo = new Date(a!, m! - 1, d!, 12).toLocaleDateString(intl, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    const deQuem =
      resposta.value?.escopo === 'PROFISSIONAL' && resposta.value.profissionalNome
        ? ` · ${resposta.value.profissionalNome}`
        : ''
    return rotulo.charAt(0).toLocaleUpperCase(intl) + rotulo.slice(1) + deQuem
  })

  /** Sem cancelados (a rota já tira) e sem faltas, a mesma conta da agenda. */
  const progressoDoDia = computed(() => {
    const doDia = horarios.value.filter((h) => h.status !== 'falta' && h.status !== 'cancelado')
    return { feitos: doDia.filter((h) => h.status === 'finalizado').length, total: doDia.length }
  })

  const andamentoDoDia = computed(() => {
    const { feitos, total } = progressoDoDia.value
    return total ? t('inicio.espacos.clinica.andamento', { feitos, total }, total) : ''
  })

  const indicadores = computed<IndicadorDaAbertura[]>(() => {
    const lista: IndicadorDaAbertura[] = []
    const sala = bloco('salaDeEspera')
    if (sala) {
      lista.push({
        id: 'recepcao',
        valor: sala.falhou ? null : naRecepcao.value.length,
        rotulo: t('inicio.espacos.clinica.recepcao'),
        icone: 'ph ph-door-open',
        to: '/clinica/agenda',
        tom: naRecepcao.value.length ? 'atencao' : undefined,
      })
    }
    if (bloco('atendimentos')) {
      lista.push({
        id: 'consulta',
        valor: bloco('atendimentos')!.falhou ? null : emConsulta.value.length,
        rotulo: t('inicio.espacos.clinica.consulta'),
        icone: 'ph ph-stethoscope',
        to: '/clinica/agenda',
      })
    }
    const internados = bloco('internados')
    if (internados) {
      const valor = internados.falhou ? null : (internados.total ?? 0)
      lista.push({
        id: 'internados',
        valor,
        rotulo: t('clinico.meuDia.abertura.internados', valor ?? 0),
        icone: 'ph ph-bed',
        to: seIntegrada('/clinica/internacao', '/clinica/pacientes'),
        tom: itensDe('internados').length ? 'risco' : undefined,
      })
    }
    return lista
  })

  /* ----------------------------------------------------------------------- as linhas */

  function minutosDesde(iso: string | null | undefined) {
    if (!iso) return null
    return Math.max(0, Math.round((agora.value - Date.parse(iso)) / 60_000))
  }

  function linhaDoAtendimento(item: HorarioDoDia) {
    const lido = porId.value.get(item.id)
    if (!lido) return ''
    return [
      lido.tipoNome ?? tipos.value.get(lido.tipoId ?? ''),
      lido.profissionalNome ?? profissionais.value.get(lido.profissionalId ?? ''),
    ]
      .filter(Boolean)
      .join(' · ')
  }

  /** O horário na agenda, com a gaveta dele aberta (`?horario=`). */
  function focoNaAgenda(id: string): RouteLocationRaw {
    return { path: '/clinica/agenda', query: { horario: id } }
  }

  /**
   * Chamar e continuar levam ao horário na agenda, onde estão a chegada e o iniciar: o prontuário
   * pela API entra com o E4-01.
   */
  function rotaDoProntuario(item: HorarioDoDia): RouteLocationRaw {
    return focoNaAgenda(item.id)
  }

  function rotaDoResumo(item: HorarioDoDia): RouteLocationRaw {
    return `/clinica/ficha/${item.petId}`
  }

  function abrirProntuario(item: HorarioDoDia) {
    void router.push(rotaDoProntuario(item))
  }

  /* ---------------------------------------------------------------------------- ler */

  async function carregarNomes() {
    try {
      const [listaDeTipos, listaDeProfissionais] = await Promise.all([
        listarTipos(parceiroQuery()),
        listarProfissionais(parceiroQuery()),
      ])
      tipos.value = new Map(listaDeTipos.map((tipo) => [tipo.id, tipo.nome]))
      profissionais.value = new Map(listaDeProfissionais.map((p) => [p.id, p.nome]))
    } catch {
      /* Sem os nomes, a linha fica sem o serviço e o profissional: o resto da tela vale. */
    }
  }

  async function carregar() {
    if (lendo) return
    lendo = true
    try {
      const lido = await lerMeuDia({ escopo: escolhido.value }, parceiroQuery())
      resposta.value = lido
      if (lido.escopo === 'PROFISSIONAL') temFicha.value = true
      erro.value = ''
    } catch (err) {
      /* Já havia um dia na tela: fica, e a próxima releitura tenta de novo. */
      if (!resposta.value) erro.value = lerErroDaAgenda(err, t('clinico.meuDia.erro')).mensagem
    } finally {
      ultimaLeitura = Date.now()
      agora.value = Date.now()
      lendo = false
    }
  }

  function trocar(escopo: EscopoDoMeuDia) {
    escolhido.value = escopo === 'CLINICA' ? 'CLINICA' : null
    void carregar()
  }

  const escopo = computed(() =>
    temFicha.value && resposta.value
      ? {
          atual: resposta.value.escopo,
          profissionalNome: resposta.value.profissionalNome,
          trocar,
        }
      : null,
  )

  let relogio: ReturnType<typeof setInterval> | undefined

  function voltouParaAba() {
    if (
      document.visibilityState === 'visible' &&
      Date.now() - ultimaLeitura >= MENOR_INTERVALO_MS
    ) {
      void carregar()
    }
  }

  onMounted(() => {
    void carregarNomes()
    void carregar()
    relogio = setInterval(() => {
      if (document.visibilityState === 'visible') void carregar()
    }, RELER_A_CADA_MS)
    document.addEventListener('visibilitychange', voltouParaAba)
  })

  onUnmounted(() => {
    if (relogio) clearInterval(relogio)
    document.removeEventListener('visibilitychange', voltouParaAba)
  })

  const modelo: ModeloDoMeuDia = reactive({
    carregando: computed(() => !resposta.value && !erro.value),
    erro,
    emConsulta,
    naRecepcao,
    aSeguir,
    destaque,
    linhasDaPauta,
    fraseDoResumo,
    dataDeHoje,
    andamentoDoDia,
    progressoDoDia,
    indicadores,
    escopo,
    falhas,
    pet: (id: string) => pacientes.value.get(id) ?? null,
    alertasRelevantes: () => [],
    textoDoAlerta: () => '',
    minutosDesde,
    linhaDoAtendimento,
    linhaCurtaDoAtendimento: linhaDoAtendimento,
    linhaDoPaciente: () => '',
    rotaDoProntuario,
    rotaDoResumo,
    abrirProntuario,
    focoNaAgenda,
    carregar,
  })

  return modelo
}
