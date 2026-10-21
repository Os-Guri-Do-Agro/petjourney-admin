<script setup lang="ts">
/**
 * O paciente internado — onde o plantão trabalha.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * 1. **Quem é** — o cabeçalho da ficha (`FichaCabeca`): rosto, nome, responsável, peso de
 *    entrada e alertas, com as saídas para o resto da ficha. A frase grande diz o estado **do
 *    trabalho** com este paciente agora: boletim retido, item atrasado, o próximo horário.
 * 2. **Onde e como está** — o quadro da internação: leito, gravidade, há quanto tempo, previsão de
 *    alta, quem assina o caso, e o motivo e o diagnóstico de trabalho. Os quatro cartões de número
 *    viraram uma folha só, lida da esquerda para a direita.
 * 3. **O que fazer** — a ação cheia é a do momento (abrir o boletim retido, checar o item da hora,
 *    registrar a evolução do turno); "Encerrar internação" fica contornada ao lado: acontece uma
 *    vez e não se desfaz.
 * 4. **O trabalho** — quatro abas, na ordem do turno: executar (checklist), registrar (evolução),
 *    comunicar (boletim), mudar a conduta (prescrição). Cada uma com a contagem que faz alguém
 *    clicar nela.
 *
 * A aba vive na URL (`?aba=`): é o que permite ao painel de casos difíceis abrir a demonstração
 * direto no boletim retido, e ao plantonista mandar o link certo para quem vai assumir.
 *
 * O cabeçalho traz o **peso de entrada**, não o do cadastro. Toda dose do plantão foi calculada
 * sobre ele, e ver na tela um peso diferente do que multiplicou a dose é o tipo de incoerência
 * que corrói a confiança no resto do registro.
 */
import Button from 'primevue/button'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import FichaCabeca from '@/features/clinico/components/pacientes/ficha/FichaCabeca.vue'
import AltaDialog from '@/features/clinico/components/internacao/AltaDialog.vue'
import InternacaoBoletins from '@/features/clinico/components/internacao/InternacaoBoletins.vue'
import InternacaoChecklist from '@/features/clinico/components/internacao/InternacaoChecklist.vue'
import InternacaoEvolucoes from '@/features/clinico/components/internacao/InternacaoEvolucoes.vue'
import InternacaoGravidade from '@/features/clinico/components/internacao/InternacaoGravidade.vue'
import InternacaoPrescricoes from '@/features/clinico/components/internacao/InternacaoPrescricoes.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type {
  GravidadeClinica,
  ISODateTime,
  ItemDePrescricaoKind,
  Measurement,
  PreferenciaDeBoletim,
  PrescriptionRoute,
  VitalKey,
} from '@/features/clinico/data/types'
import { horasInternado, type DesfechoDaInternacao } from '@/features/clinico/domain/internacao'
import { useClinicoStore } from '@/features/clinico/stores/clinico'
import { useInternacaoStore } from '@/features/clinico/stores/internacao'

type Aba = 'checklist' | 'evolucao' | 'boletim' | 'prescricao'

const ABAS: Aba[] = ['checklist', 'evolucao', 'boletim', 'prescricao']

const ICONE_DA_ABA: Record<Aba, string> = {
  checklist: 'ph ph-list-checks',
  evolucao: 'ph ph-note-pencil',
  boletim: 'ph ph-chat-circle-text',
  prescricao: 'ph ph-prescription',
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const internacao = useInternacaoStore()
const formato = useClinicFormat()

const aba = ref<Aba>('checklist')

const internacaoId = computed(() => String(route.params.internacaoId ?? ''))

function abaDaUrl(): Aba {
  const pedida = String(route.query.aba ?? '')

  return ABAS.includes(pedida as Aba) ? (pedida as Aba) : 'checklist'
}

async function carregar() {
  await internacao.carregarPaciente(internacaoId.value)
  await internacao.carregarMapa()
  await internacao.carregarPassagem()
}

onMounted(async () => {
  aba.value = abaDaUrl()

  await carregar()
})

watch(aba, (valor) => {
  void router.replace({ query: { ...route.query, aba: valor } })
})

const paciente = computed(() => internacao.paciente)
const pet = computed(() => (paciente.value ? clinico.pet(paciente.value.internacao.petId) : null))
const tutor = computed(() =>
  paciente.value ? clinico.tutor(paciente.value.internacao.tutorId) : null,
)

const plantao = computed(() => internacao.mapa?.plantaoAtual ?? null)

/** Quem registra é quem está de plantão — o nome não é escolhido num seletor a cada clique. */
const plantonistaId = computed(() => plantao.value?.responsavelId ?? '')

const naoEncontrado = computed(
  () => !internacao.carregando && !internacao.erro && paciente.value === null,
)

// ---------------------------------------------------------------------------
// O estado do trabalho
// ---------------------------------------------------------------------------

const atrasadas = computed(
  () => internacao.checklist.filter((linha) => linha.situacao === 'atrasada').length,
)

/** O primeiro item que cobra ação agora — na hora ou atrasado —, do mais antigo para o mais novo. */
const itemDaVez = computed(
  () =>
    internacao.checklist
      .filter((linha) => linha.situacao === 'na-janela' || linha.situacao === 'atrasada')
      .sort((a, b) =>
        a.administracao.previstaPara.localeCompare(b.administracao.previstaPara),
      )[0] ?? null,
)

/** O próximo item que ainda não chegou à hora. */
const proximoItem = computed(
  () =>
    internacao.checklist
      .filter((linha) => linha.situacao === 'futura')
      .sort((a, b) =>
        a.administracao.previstaPara.localeCompare(b.administracao.previstaPara),
      )[0] ?? null,
)

const retido = computed(() => internacao.boletinsRetidos[0] ?? null)

const jaEvoluiuNoTurno = computed(() =>
  plantao.value && paciente.value
    ? paciente.value.evolucoes.some((item) => item.plantaoId === plantao.value!.id)
    : true,
)

const ativas = computed(
  () => (paciente.value?.prescricoes ?? []).filter((item) => !item.suspensaEm).length,
)

const prontosParaEnviar = computed(
  () => (paciente.value?.boletins ?? []).filter((item) => item.status === 'liberado').length,
)

type Tom = 'risco' | 'atencao' | 'neutro'

/** O ladrilho do estado do paciente, no tom da gravidade — o mesmo do selo ao lado. */
const TOM_DA_GRAVIDADE: Record<GravidadeClinica, 'ok' | 'atencao' | 'risco'> = {
  estavel: 'ok',
  atencao: 'atencao',
  critico: 'risco',
}

const opcoesDeAba = computed(() =>
  ABAS.map((valor) => {
    let contagem = 0
    let tom: Tom = 'neutro'

    if (valor === 'checklist') {
      contagem = internacao.pendentesDoPaciente.length
      tom = atrasadas.value > 0 ? 'risco' : 'atencao'
    } else if (valor === 'evolucao') {
      contagem = paciente.value?.evolucoes.length ?? 0
    } else if (valor === 'boletim') {
      const retidos = internacao.boletinsRetidos.length

      contagem = retidos + prontosParaEnviar.value
      tom = retidos > 0 ? 'risco' : 'atencao'
    } else {
      contagem = ativas.value
    }

    return {
      valor,
      rotulo: t(`clinico.internacao.abas.${valor}`),
      icone: ICONE_DA_ABA[valor],
      contagem,
      tom,
    }
  }),
)

const tempo = computed(() =>
  paciente.value ? horasInternado(paciente.value.internacao, internacao.agora) : 0,
)

/** Dia e hora da entrada, na ordem em que a clínica escreve numa ficha. */
const entradaEm = computed(() => {
  const quando = paciente.value?.internacao.entradaEm

  return quando ? `${formato.dataCurta(quando.slice(0, 10))}, ${formato.hora(quando)}` : ''
})

/** A data da alta prevista, ou que não há previsão. */
const previsaoDeAlta = computed(() => {
  const alta = paciente.value?.internacao.altaPrevistaEm

  return alta ? formato.dataCurta(alta.slice(0, 10)) : t('clinico.internacao.paciente.semPrevisao')
})

/** Quanto falta para a alta prevista — "em 1 dia", "em 6 h". Vazio sem previsão ou já passada. */
const previsaoRelativa = computed(() => {
  const alta = paciente.value?.internacao.altaPrevistaEm

  if (!alta || encerrada.value || Date.parse(alta) <= Date.parse(internacao.agora)) {
    return ''
  }

  return formato.relativo(alta)
})

/**
 * O tipo do leito embaixo do nome — quando acrescenta alguma coisa. O leito de UTI se chama
 * "UTI", e repetir o tipo embaixo é ruído que ensina a não ler a célula.
 */
const tipoDoLeito = computed(() => {
  const leito = paciente.value?.leito

  if (!leito) {
    return ''
  }

  const tipo = t(`clinico.internacao.leitoKind.${leito.kind}`)

  return tipo.toLowerCase() === leito.nome.toLowerCase() ? '' : tipo
})

const responsavelClinico = computed(() =>
  paciente.value ? (clinico.profissional(paciente.value.internacao.responsavelId)?.nome ?? '') : '',
)

/**
 * A frase grande do cabeçalho: o estado do trabalho com este paciente, na ordem em que cobra
 * alguém. O estado clínico (gravidade, leito) mora no quadro logo abaixo; a frase diz o que fazer.
 */
const fraseDeEstado = computed(() => {
  if (!paciente.value) {
    return ''
  }

  if (encerrada.value) {
    return t('clinico.internacao.paciente.encerradaFrase')
  }

  if (retido.value) {
    return t('clinico.internacao.nova.frase.boletimRetido')
  }

  if (atrasadas.value > 0) {
    return t('clinico.internacao.nova.frase.atrasadas', { total: atrasadas.value }, atrasadas.value)
  }

  const pendentes = internacao.pendentesDoPaciente.length

  if (pendentes > 0) {
    return t('clinico.internacao.nova.frase.naHora', { total: pendentes }, pendentes)
  }

  if (proximoItem.value) {
    return t('clinico.internacao.nova.frase.proximo', {
      hora: formato.hora(proximoItem.value.administracao.previstaPara),
    })
  }

  return t('clinico.internacao.pauta.vazio')
})

type AcaoPrincipal = { rotulo: string; icone: string; executar: () => void }

/**
 * A ação cheia é a do momento, e muda com ele.
 *
 * Boletim retido vem antes de tudo — uma pessoa sem notícia do animal. Depois, o item do checklist
 * que está na hora (só esse: o futuro pede o segundo clique da linha, e não sai daqui num toque).
 * Sem nada na hora, a evolução do turno que ainda não foi escrita.
 */
const acaoPrincipal = computed<AcaoPrincipal | null>(() => {
  if (!paciente.value || encerrada.value) {
    return null
  }

  if (retido.value) {
    return {
      rotulo: retido.value.ligacaoEm
        ? t('clinico.internacao.nova.acao.enviarRetido')
        : t('clinico.internacao.nova.acao.boletimRetido'),
      icone: retido.value.ligacaoEm ? 'ph ph-paper-plane-tilt' : 'ph ph-phone',
      executar: () => irPara('boletim'),
    }
  }

  const item = itemDaVez.value

  if (item) {
    return {
      rotulo: t('clinico.internacao.nova.acao.checar', {
        item: item.prescricao?.descricao ?? '',
        hora: formato.hora(item.administracao.previstaPara),
      }),
      icone: 'ph ph-check',
      executar: () => void registrar(item.administracao.id, 'feita'),
    }
  }

  if (!jaEvoluiuNoTurno.value) {
    return {
      rotulo: t('clinico.internacao.nova.acao.evoluir'),
      icone: 'ph ph-note-pencil',
      executar: () => irPara('evolucao'),
    }
  }

  return null
})

// ---------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------

const abasEl = ref<HTMLElement | null>(null)

/**
 * Leva à aba da ação e traz a área de trabalho para a vista. A ação continua no cabeçalho em
 * qualquer aba (o cabeçalho não muda de forma a cada troca); já estando na aba, o clique só rola
 * até ela e põe o foco no primeiro campo, quando há um.
 */
function irPara(destino: Aba) {
  aba.value = destino
  void nextTick(() => {
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    abasEl.value?.scrollIntoView({ block: 'start', behavior: reduzir ? 'auto' : 'smooth' })
    document
      .querySelector<HTMLElement>(
        `#internado-painel-${destino} .retido button, #internado-painel-${destino} input, #internado-painel-${destino} textarea`,
      )
      ?.focus({ preventScroll: true })
  })
}

/** O padrão de `tablist`: setas andam e escolhem, Home e End vão às pontas. */
function aoTeclarNasAbas(evento: KeyboardEvent) {
  const atual = ABAS.indexOf(aba.value)
  const passos: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    Home: -atual,
    End: ABAS.length - 1 - atual,
  }
  const passo = passos[evento.key]

  if (passo === undefined) {
    return
  }

  evento.preventDefault()

  /* Em árabe a fileira inverte: a seta para a direita volta. */
  const rtl = getComputedStyle(evento.currentTarget as HTMLElement).direction === 'rtl'
  const sentido = rtl && evento.key.startsWith('Arrow') ? -passo : passo
  const proxima = ABAS[(atual + sentido + ABAS.length) % ABAS.length]!

  aba.value = proxima
  void nextTick(() => document.getElementById(`internado-aba-${proxima}`)?.focus())
}

// ---------------------------------------------------------------------------
// Trabalho
// ---------------------------------------------------------------------------

async function registrar(administracaoId: string, status: 'feita' | 'recusada' | 'pulada') {
  await internacao.registrar({
    administracaoId,
    status,
    professionalId: plantonistaId.value,
  })
}

async function evoluir(entrada: {
  vitais: Record<VitalKey, Measurement>
  observado: string
  avaliacao: string
  plano: string
  gravidade: GravidadeClinica
}) {
  const boletim = await internacao.evoluir({
    ...entrada,
    professionalId: plantonistaId.value,
  })

  /*
   * A piora gerou um boletim retido: a tela salta para ele. Terminar a evolução e ficar parado
   * na mesma aba faria o profissional achar que o trabalho acabou — e o boletim ficaria retido
   * até alguém tropeçar nele.
   */
  if (boletim) {
    aba.value = 'boletim'
  }
}

/**
 * O que o plantão escreveu **é** a mensagem.
 *
 * Vai como `texto`, e não como `observado`: o campo agora guarda o boletim inteiro, e mandá-lo
 * como observação faria o repositório embrulhá-lo numa segunda moldura — com o estado do
 * paciente e a temperatura repetidos, porque o modelo já os trouxe.
 */
async function compor(texto: string) {
  await internacao.gerarBoletim({ autorId: plantonistaId.value, observado: '', texto })
}

async function ligar(boletimId: string) {
  await internacao.registrarLigacao(boletimId, plantonistaId.value)
}

async function salvarPreferencia(preferencia: PreferenciaDeBoletim) {
  await internacao.atualizarPreferencia(preferencia)
}

async function prescrever(entrada: {
  kind: ItemDePrescricaoKind
  medicamentoId: string | null
  descricao: string
  via: PrescriptionRoute | null
  doseTexto: string
  frequenciaHoras: number
  continuo: boolean
  primeiroHorario: ISODateTime
  prescritoPor: string
}) {
  await internacao.prescrever(entrada)
}

async function suspender(prescricaoId: string, motivo: string) {
  await internacao.suspender(prescricaoId, motivo)
}

// ---------------------------------------------------------------------------
// Encerramento
// ---------------------------------------------------------------------------

const altaAberta = ref(false)

/**
 * A internação já encerrada continua alcançável — pelo link que alguém mandou, pelo histórico do
 * paciente, pela auditoria de seis meses depois. O que muda é que o registro vira leitura: o
 * checklist de um animal que foi para casa não recebe dose nova.
 */
const encerrada = computed(() => paciente.value?.internacao.status !== 'internado')

const desfechoRegistrado = computed(() =>
  paciente.value && encerrada.value
    ? (paciente.value.internacao.status as DesfechoDaInternacao)
    : null,
)

/** Dia e hora do encerramento, na ordem em que a clínica escreve numa ficha. */
const encerradaEm = computed(() => {
  const quando = paciente.value?.internacao.altaEm

  return quando ? `${formato.dataCurta(quando.slice(0, 10))} · ${formato.hora(quando)}` : ''
})

async function encerrar(entrada: {
  status: DesfechoDaInternacao
  observacao: string
  avisadoPorTelefone: boolean
}) {
  const aceita = await internacao.darAlta({ internacaoId: internacaoId.value, ...entrada })

  /*
   * Fecha **só quando passou**. Recusado por regra — óbito sem ligação registrada —, o diálogo
   * fica aberto com o motivo à vista: sumir com ele deixaria o usuário sem saber por que nada
   * mudou, que é a forma mais rápida de a regra parecer um defeito.
   */
  if (aceita) {
    altaAberta.value = false
  }
}
</script>

<template>
  <UiPagina
    :titulo="t('clinico.internacao.paciente.titulo')"
    :carregando="internacao.carregando && !paciente"
    :erro="internacao.erro ? t(internacao.erro) : ''"
    :vazio="naoEncontrado"
    :vazio-titulo="t('clinico.internacao.paciente.naoEncontradoTitulo')"
    :vazio-descricao="t('clinico.internacao.paciente.naoEncontradoDescricao')"
    vazio-icone="ph ph-bed"
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <RouterLink to="/veterinario/internacao" class="voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('clinico.internacao.titulo') }}
      </RouterLink>
    </template>

    <template #cabecalho>
      <!--
        O cabeçalho da ficha, igual ao da ficha do paciente: as vistas dela (resumo, histórico,
        tratamento, vacinas) no pé do cartão e as ações desta tela na ponta direita, onde a ficha
        põe as dela. Encerrar fica contornado — acontece uma vez e não se desfaz —; a cheia é a do
        momento.
      -->
      <div class="cabeca">
        <FichaCabeca
          v-if="pet && paciente"
          :pet="pet"
          :tutor="tutor"
          :atual="null"
          :frase="fraseDeEstado"
          :peso-kg="paciente.internacao.pesoEntradaKg"
        >
          <template #acoes>
            <Button
              v-if="!encerrada"
              type="button"
              icon="ph ph-sign-out"
              :label="t('clinico.internacao.alta.abrir')"
              severity="secondary"
              outlined
              @click="altaAberta = true"
            />
            <Button
              v-if="acaoPrincipal"
              type="button"
              class="acao-principal"
              :icon="acaoPrincipal.icone"
              :label="acaoPrincipal.rotulo"
              :disabled="internacao.salvando"
              @click="acaoPrincipal.executar()"
            />
          </template>
        </FichaCabeca>
        <h1 v-else class="cabeca__reserva">{{ t('clinico.internacao.paciente.titulo') }}</h1>
      </div>
    </template>

    <div v-if="paciente" class="internado">
      <!--
        A internação encerrada continua alcançável, e precisa dizer isso na primeira linha. Sem
        esta faixa, a tela de um animal que foi para casa é indistinguível da de um animal que
        está no leito — e alguém marca uma dose numa internação que acabou ontem.
      -->
      <p v-if="desfechoRegistrado" class="aviso aviso--encerrada ui-folha" role="status">
        <span class="ui-ladrilho ui-ladrilho--p ui-ladrilho--neutro" aria-hidden="true">
          <i class="ph ph-check-circle" />
        </span>
        {{ t(`clinico.internacao.alta.encerrada.${desfechoRegistrado}`, { quando: encerradaEm }) }}
      </p>

      <!-- O quadro da internação: onde está, como está, há quanto tempo, até quando, com quem. -->
      <section class="quadro ui-folha" :aria-label="t('clinico.internacao.nova.quadro.rotulo')">
        <dl class="quadro__numeros">
          <div class="dado">
            <dt>
              {{ t('clinico.internacao.nova.quadro.leito') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-bed" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande ui-num">{{ paciente.leito?.nome ?? '' }}</strong>
              <small v-if="tipoDoLeito">{{ tipoDoLeito }}</small>
            </dd>
          </div>
          <div class="dado">
            <dt>
              {{ t('clinico.internacao.evolucao.gravidade') }}
              <span
                class="ui-ladrilho ui-ladrilho--p dado__icone"
                :class="`ui-ladrilho--${TOM_DA_GRAVIDADE[paciente.internacao.gravidade]}`"
                aria-hidden="true"
              >
                <i class="ph ph-heartbeat" />
              </span>
            </dt>
            <dd>
              <InternacaoGravidade
                class="dado__gravidade"
                :gravidade="paciente.internacao.gravidade"
              />
            </dd>
          </div>
          <div class="dado">
            <dt>
              {{ t('clinico.internacao.paciente.internadoHa') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-clock" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande ui-num">
                {{ t('clinico.internacao.leito.horas', { horas: tempo }) }}
              </strong>
              <small class="ui-num">
                {{ t('clinico.internacao.nova.quadro.desde', { quando: entradaEm }) }}
              </small>
            </dd>
          </div>
          <div class="dado">
            <dt>
              {{ t('clinico.internacao.paciente.previsaoDeAlta') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-calendar-check" />
              </span>
            </dt>
            <dd>
              <strong
                :class="paciente.internacao.altaPrevistaEm ? 'dado__grande ui-num' : 'dado__nome'"
              >
                {{ previsaoDeAlta }}
              </strong>
              <small v-if="previsaoRelativa">{{ previsaoRelativa }}</small>
            </dd>
          </div>
          <div class="dado">
            <dt>
              {{ t('clinico.internacao.paciente.responsavelClinico') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-stethoscope" />
              </span>
            </dt>
            <dd>
              <strong class="dado__nome">{{ responsavelClinico }}</strong>
            </dd>
          </div>
        </dl>

        <dl class="quadro__textos">
          <div class="texto">
            <dt>{{ t('clinico.internacao.internar.motivo') }}</dt>
            <dd>{{ paciente.internacao.motivo }}</dd>
          </div>
          <div v-if="paciente.internacao.diagnostico" class="texto">
            <dt>{{ t('clinico.internacao.paciente.diagnostico') }}</dt>
            <dd>{{ paciente.internacao.diagnostico }}</dd>
          </div>
          <div v-if="paciente.internacao.observacao" class="texto">
            <dt>{{ t('clinico.internacao.paciente.observacao') }}</dt>
            <dd>{{ paciente.internacao.observacao }}</dd>
          </div>
        </dl>
      </section>

      <!--
        A dose em cima da troca aparece **fora** da aba do checklist. Quem abre a tela na aba do
        boletim precisa saber que existe uma dose sem dono acontecendo agora, e não descobrir
        depois de trocar de aba.
      -->
      <p
        v-if="internacao.naTrocaDePlantao.length > 0"
        class="aviso aviso--troca ui-folha ui-marca ui-marca--atencao"
        role="status"
      >
        <span class="ui-ladrilho ui-ladrilho--p ui-ladrilho--atencao" aria-hidden="true">
          <i class="ph ph-arrows-left-right" />
        </span>
        {{
          t(
            'clinico.internacao.paciente.naTroca',
            { total: internacao.naTrocaDePlantao.length },
            internacao.naTrocaDePlantao.length,
          )
        }}
      </p>

      <p
        v-if="internacao.erroDeAcao"
        class="aviso aviso--erro ui-folha ui-marca ui-marca--risco"
        role="alert"
      >
        <span class="ui-ladrilho ui-ladrilho--p ui-ladrilho--risco" aria-hidden="true">
          <i class="ph ph-warning-circle" />
        </span>
        {{ t(internacao.erroDeAcao) }}
      </p>

      <!-- As quatro áreas do turno, como abas da página. -->
      <div class="trabalho">
        <div
          ref="abasEl"
          class="abas"
          role="tablist"
          :aria-label="t('clinico.internacao.paciente.abasRotulo')"
          @keydown="aoTeclarNasAbas"
        >
          <button
            v-for="opcao in opcoesDeAba"
            :id="`internado-aba-${opcao.valor}`"
            :key="opcao.valor"
            type="button"
            role="tab"
            class="abas__aba"
            :class="{ 'abas__aba--atual': aba === opcao.valor }"
            :aria-selected="aba === opcao.valor"
            :aria-controls="`internado-painel-${opcao.valor}`"
            :tabindex="aba === opcao.valor ? 0 : -1"
            @click="aba = opcao.valor"
          >
            <i :class="opcao.icone" aria-hidden="true" />
            <span>{{ opcao.rotulo }}</span>
            <span
              v-if="opcao.contagem > 0"
              class="abas__selo ui-num"
              :class="`abas__selo--${opcao.tom}`"
            >
              {{ opcao.contagem }}
            </span>
          </button>
        </div>

        <div
          :id="`internado-painel-${aba}`"
          class="painel"
          role="tabpanel"
          :aria-labelledby="`internado-aba-${aba}`"
        >
          <InternacaoChecklist
            v-if="aba === 'checklist'"
            :linhas="internacao.checklist"
            :agora="internacao.agora"
            :salvando="internacao.salvando"
            :fim-do-plantao="plantao?.fim ?? null"
            @registrar="registrar"
            @desfazer="internacao.desfazer"
          />

          <InternacaoEvolucoes
            v-else-if="aba === 'evolucao'"
            :evolucoes="paciente.evolucoes"
            :plantoes="paciente.plantoes"
            :plantao-atual-id="plantao?.id ?? null"
            :pet="pet"
            :gravidade-atual="paciente.internacao.gravidade"
            :salvando="internacao.salvando"
            @registrar="evoluir"
          />

          <InternacaoBoletins
            v-else-if="aba === 'boletim'"
            :boletins="paciente.boletins"
            :preferencia="paciente.preferencia"
            :pet="pet"
            :tutor="tutor"
            :salvando="internacao.salvando"
            :modelos="internacao.modelosDeBoletim"
            @ligar="ligar"
            @enviar="internacao.enviarBoletim"
            @compor="compor"
            @preferencia="salvarPreferencia"
          />

          <InternacaoPrescricoes
            v-else
            :prescricoes="paciente.prescricoes"
            :administracoes="paciente.administracoes"
            :agora="internacao.agora"
            :salvando="internacao.salvando"
            :prescritor-id="plantonistaId"
            :encerrada="encerrada"
            @prescrever="prescrever"
            @suspender="suspender"
          />
        </div>
      </div>
    </div>

    <template #sempre>
      <AltaDialog
        :aberto="altaAberta"
        :pet="pet"
        :resumo="internacao.resumoDaAlta"
        :salvando="internacao.salvando"
        :erro="internacao.erroDeAcao"
        @fechar="altaAberta = false"
        @confirmar="encerrar"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.internado {
  display: grid;
  gap: 20px;
}

/* ------------------------------------------------------------------ topo */

.voltar .ph {
  font-size: 13px;
}

[dir='rtl'] .voltar .ph {
  scale: -1 1;
}

/* O cabeçalho do paciente encolhe para as ações caberem ao lado, e não embaixo. */
.cabeca {
  min-width: 0;
  flex: 1 1 560px;
}

.cabeca__reserva {
  margin: 0;
  color: var(--tinta);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

/* A ação do momento nomeia o item: pode ser longa, e quebra em vez de empurrar a página. */
.acao-principal {
  max-width: 100%;
  white-space: normal;
  text-align: start;
}

/* ------------------------------------------------------------------ quadro
 * Os números da internação numa faixa, lidos da esquerda para a direita, cada um com o ladrilho do
 * assunto no canto — o mesmo quadro da estadia do Hotel. Embaixo, numa faixa rente, os textos.
 */

.quadro {
  display: grid;
  overflow: hidden;
}

/*
 * Fileira que quebra: cada célula traz a divisória à esquerda e em cima, deslocada um pixel para
 * fora — a primeira de cada linha e as da primeira fileira caem fora do recorte, e o fio só
 * aparece **entre** células, em qualquer largura.
 */
.quadro__numeros {
  display: flex;
  flex-wrap: wrap;
  overflow: hidden;
  margin: 0;
}

.dado {
  position: relative;
  display: grid;
  min-width: 0;
  flex: 1 1 170px;
  align-content: start;
  gap: 6px;
  margin-block-start: -1px;
  margin-inline-start: -1px;
  padding: 18px 24px;
  border-block-start: 1px solid var(--linha);
  border-inline-start: 1px solid var(--linha);
}

.dado dt {
  padding-inline-end: 34px;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.dado__icone {
  position: absolute;
  top: 14px;
  inset-inline-end: 14px;
}

.dado dd {
  display: grid;
  min-width: 0;
  gap: 3px;
  margin: 0;
}

.dado__grande {
  overflow: hidden;
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dado__nome {
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
  line-height: 1.35;
}

.dado dd small {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.35;
}

.dado__gravidade.ui-selo {
  justify-self: start;
  height: 30px;
  margin-top: 2px;
  padding-inline: 11px;
  font-size: 14px;
}

.quadro__textos {
  display: grid;
  margin: 0;
  padding: 14px 24px 16px;
  gap: 12px 28px;
  border-top: 1px solid var(--linha-suave);
  background: color-mix(in oklab, var(--superficie-2) 55%, var(--superficie));
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
}

.texto {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 3px;
}

.texto dt {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.texto dd {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

/* ------------------------------------------------------------------ avisos
 * Uma linha em folha, com o ladrilho do tom e a frase. O encerramento é neutro de propósito, e não
 * verde de sucesso nem vermelho de alarme: cobre alta, transferência e óbito com a mesma marcação.
 */
.aviso {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 12px 18px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  line-height: 1.45;
}

.aviso--erro {
  color: var(--risco-tinta);
  font-weight: 600;
}

/* ------------------------------------------------------------------ abas */

.trabalho {
  display: grid;
  gap: 18px;
  margin-top: 8px;
}

.abas {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 1px solid var(--linha);
  scroll-margin-top: 16px;
  scrollbar-width: none;
}

.abas::-webkit-scrollbar {
  display: none;
}

.abas__aba {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 14px;
  border: 0;
  background: none;
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
}

.abas__aba:first-child {
  padding-inline-start: 2px;
}

.abas__aba i {
  font-size: 18px;
}

.abas__aba:hover {
  color: var(--tinta);
}

.abas__aba:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -4px;
}

.abas__aba--atual {
  color: var(--tinta);
  font-weight: 600;
}

.abas__aba--atual i {
  color: var(--pj-lugar-tinta, var(--musgo));
}

.abas__aba--atual::after {
  position: absolute;
  right: 14px;
  bottom: -1px;
  left: 14px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--pj-lugar, var(--musgo));
  content: '';
}

.abas__aba--atual:first-child::after {
  left: 2px;
}

[dir='rtl'] .abas__aba--atual:first-child::after {
  right: 2px;
  left: 14px;
}

.abas__selo {
  display: inline-grid;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  place-items: center;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 650;
}

.abas__selo--neutro {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.abas__selo--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.abas__selo--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.painel {
  min-width: 0;
}

@media (max-width: 900px) {
  .dado {
    flex-basis: 140px;
    padding: 14px 16px;
  }

  .dado__grande {
    font-size: 22px;
  }
}
</style>
