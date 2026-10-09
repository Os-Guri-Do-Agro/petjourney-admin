<script setup lang="ts">
/**
 * O paciente internado — onde o plantão trabalha.
 *
 * Quatro abas, e a ordem é a do turno: **executar** (checklist), **registrar** (evolução),
 * **comunicar** (boletim), **mudar a conduta** (prescrição). A última é a menos frequente e por
 * isso é a última; abas ordenadas por importância abstrata deixariam a tarefa de cada meia hora
 * atrás de uma que acontece uma vez por dia.
 *
 * A aba vive na URL. Não é preciosismo: é o que permite ao painel de casos difíceis abrir a
 * demonstração direto no boletim retido, e ao plantonista mandar o link certo pelo WhatsApp para
 * quem vai assumir.
 *
 * O cabeçalho traz o **peso de entrada**, não o do cadastro. Toda dose do plantão foi calculada
 * sobre ele, e ver na tela um peso diferente do que multiplicou a dose é o tipo de incoerência
 * que corrói a confiança no resto do registro.
 *
 * ## A forma (redesenho de 30/09/2026)
 *
 * A saudação da ficha (`FichaCabeca`): o rosto e o nome como título, a frase de estado em degradê
 * — gravidade, leito e o que falta fazer — e as pílulas. As vistas da ficha (resumo, histórico,
 * vacinas) viram as saídas daqui, e "Encerrar internação" é a ação da página, contornada: acontece
 * uma vez e não se desfaz. Os quatro cartões de número saíram; internado há, previsão de alta,
 * veterinário responsável e diagnóstico ficam no cartão "Internação", um dado por linha.
 */
import { PhBed } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import FichaCabeca from '@/features/clinico/components/pacientes/ficha/FichaCabeca.vue'
import AltaDialog from '@/features/clinico/components/internacao/AltaDialog.vue'
import InternacaoBoletins from '@/features/clinico/components/internacao/InternacaoBoletins.vue'
import InternacaoChecklist from '@/features/clinico/components/internacao/InternacaoChecklist.vue'
import InternacaoEvolucoes from '@/features/clinico/components/internacao/InternacaoEvolucoes.vue'
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

onMounted(async () => {
  aba.value = abaDaUrl()

  await internacao.carregarPaciente(internacaoId.value)
  await internacao.carregarMapa()
  await internacao.carregarPassagem()
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

const opcoesDeAba = computed(() =>
  ABAS.map((valor) => {
    const pendentes = valor === 'checklist' ? internacao.pendentesDoPaciente.length : 0
    const retidos = valor === 'boletim' ? internacao.boletinsRetidos.length : 0
    const total = pendentes + retidos

    return {
      valor,
      rotulo: t(`clinico.internacao.abas.${valor}`),
      contagem: total > 0 ? total : undefined,
      tom: (retidos > 0 ? 'risco' : pendentes > 0 ? 'atencao' : 'neutro') as
        | 'risco'
        | 'atencao'
        | 'neutro',
    }
  }),
)

const tempo = computed(() =>
  paciente.value ? horasInternado(paciente.value.internacao, internacao.agora) : 0,
)

/** A data da alta prevista, ou que não há previsão. */
const previsaoDeAlta = computed(() => {
  const alta = paciente.value?.internacao.altaPrevistaEm

  return alta ? formato.dataCurta(alta.slice(0, 10)) : t('clinico.internacao.paciente.semPrevisao')
})

/**
 * O leito, e o tipo dele quando o tipo muda o que se faz ao chegar.
 *
 * "Leito R1" basta num leito geral. Em isolamento não basta: quem vai até lá precisa saber antes
 * de abrir a porta, e é a única informação desta linha que muda o comportamento de quem a lê.
 */
const leitoDescrito = computed(() => {
  const leito = paciente.value?.leito

  if (!leito) {
    return ''
  }

  const nome = t('clinico.internacao.paciente.noLeito', { leito: leito.nome })
  const kind = t(`clinico.internacao.leitoKind.${leito.kind}`)

  /*
   * O tipo só entra quando acrescenta alguma coisa. O leito de UTI se chama "UTI", e repetir o
   * tipo produzia "Leito UTI · UTI" — ruído que ensina a não ler a linha.
   */
  if (leito.kind === 'geral' || kind.toLowerCase() === leito.nome.toLowerCase()) {
    return nome
  }

  return `${nome} · ${kind}`
})

/**
 * A frase da saudação: o estado desta internação, na ordem em que se pergunta — como ele está,
 * onde, e o que falta fazer. Encerrada, ela diz só isso.
 */
const fraseDeEstado = computed(() => {
  if (!paciente.value) {
    return ''
  }

  if (encerrada.value) {
    return t('clinico.internacao.paciente.encerradaFrase')
  }

  const pendentes = internacao.pendentesDoPaciente.length

  return [
    t(`clinico.internacao.gravidade.${paciente.value.internacao.gravidade}`),
    leitoDescrito.value,
    pendentes > 0
      ? t('clinico.internacao.pauta.aFazer', { total: pendentes })
      : t('clinico.internacao.resumo.emDia'),
  ]
    .filter(Boolean)
    .join(' · ')
})

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
  <PartnerPageFrame
    class="hc-tema"
    :title="t('clinico.internacao.paciente.titulo')"
    :loading="internacao.carregando && !paciente"
    :error="internacao.erro ? t(internacao.erro) : ''"
    :empty="naoEncontrado"
    :empty-title="t('clinico.internacao.paciente.naoEncontradoTitulo')"
    :empty-description="t('clinico.internacao.paciente.naoEncontradoDescricao')"
  >
    <template #cabecalho>
      <div class="internado__topo">
        <!-- A volta ao mapa é navegação, não conteúdo: fica sozinha acima, como migalha. -->
        <RouterLink class="hc__link internado__voltar" to="/veterinario/internacao">
          <i class="ph ph-arrow-left" aria-hidden="true" />
          {{ t('clinico.internacao.paciente.voltar') }}
        </RouterLink>

        <!--
          As vistas da ficha são as saídas daqui: a internação era um beco, e quem precisava saber
          o que aconteceu antes — a cirurgia de anteontem, a alergia do ano passado — tinha de
          buscar o paciente pelo menu.
        -->
        <FichaCabeca
          v-if="pet && paciente"
          :pet="pet"
          :tutor="tutor"
          :atual="null"
          :frase="fraseDeEstado"
          :peso-kg="paciente.internacao.pesoEntradaKg"
        />

        <h1 v-else class="hc-saudacao__titulo">{{ t('clinico.internacao.paciente.titulo') }}</h1>
      </div>
    </template>

    <div v-if="paciente" class="internado clinic-scope">
      <!--
        A internação encerrada continua alcançável, e precisa dizer isso na primeira linha. Sem
        esta faixa, a tela de um animal que foi para casa é indistinguível da de um animal que
        está no leito — e alguém marca uma dose numa internação que acabou ontem.
      -->
      <p v-if="desfechoRegistrado" class="encerrada" role="status">
        <i class="ph ph-check-circle" aria-hidden="true" />
        {{ t(`clinico.internacao.alta.encerrada.${desfechoRegistrado}`, { quando: encerradaEm }) }}
      </p>

      <!--
        O que eram quatro cartões de número, um dado por linha: quanto tempo o animal está e vai
        ficar, quem assina o caso e o que ele tem. Gravidade e leito subiram para a frase de estado.
      -->
      <section class="hc dados" aria-labelledby="internado-dados">
        <header class="hc__cabeca">
          <h2 id="internado-dados" class="hc__titulo">
            <PhBed class="hc__icone" weight="duotone" aria-hidden="true" />
            {{ t('clinico.internacao.titulo') }}
          </h2>

          <!--
            Encerrar mora no cartão do que ele encerra, contornado: acontece uma vez e não se
            desfaz. Não abre a fileira de pílulas do topo nem divide a linha com as abas, que são
            o trabalho de cada meia hora — para não convidar ao clique errado no fim de um plantão
            de doze horas.
          -->
          <Button
            v-if="!encerrada"
            type="button"
            :label="t('clinico.internacao.alta.abrir')"
            icon="ph ph-sign-out"
            severity="secondary"
            outlined
            size="small"
            @click="altaAberta = true"
          />
        </header>

        <dl class="dados__lista">
          <div class="dados__item">
            <dt>{{ t('clinico.internacao.paciente.internadoHa') }}</dt>
            <dd>{{ t('clinico.internacao.leito.horas', { horas: tempo }) }}</dd>
          </div>
          <div class="dados__item">
            <dt>{{ t('clinico.internacao.paciente.previsaoDeAlta') }}</dt>
            <dd>{{ previsaoDeAlta }}</dd>
          </div>
          <div class="dados__item">
            <dt>{{ t('clinico.internacao.paciente.responsavelClinico') }}</dt>
            <dd>{{ clinico.profissional(paciente.internacao.responsavelId)?.nome ?? '—' }}</dd>
          </div>
          <div v-if="paciente.internacao.diagnostico" class="dados__item dados__item--largo">
            <dt>{{ t('clinico.internacao.paciente.diagnostico') }}</dt>
            <dd>{{ paciente.internacao.diagnostico }}</dd>
          </div>
          <div v-if="paciente.internacao.observacao" class="dados__item dados__item--largo">
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
      <p v-if="internacao.naTrocaDePlantao.length > 0" class="troca" role="status">
        <i class="ph ph-arrows-left-right" aria-hidden="true" />
        {{
          t(
            'clinico.internacao.paciente.naTroca',
            { total: internacao.naTrocaDePlantao.length },
            internacao.naTrocaDePlantao.length,
          )
        }}
      </p>

      <p v-if="internacao.erroDeAcao" class="erroAcao" role="alert">
        {{ t(internacao.erroDeAcao) }}
      </p>

      <ClinicToggleGroup
        v-model="aba"
        :opcoes="opcoesDeAba"
        :rotulo="t('clinico.internacao.paciente.abasRotulo')"
      />

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

    <AltaDialog
      :aberto="altaAberta"
      :pet="pet"
      :resumo="internacao.resumoDaAlta"
      :salvando="internacao.salvando"
      :erro="internacao.erroDeAcao"
      @fechar="altaAberta = false"
      @confirmar="encerrar"
    />
  </PartnerPageFrame>
</template>

<style scoped>
.internado {
  display: grid;
  gap: 1.25rem;
}

/* ------------------------------------------------------------------ topo */

.internado__topo {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}

.internado__voltar {
  justify-self: start;
  margin-inline-start: -0.55rem;
}

.internado__voltar .ph {
  font-size: 0.75rem;
}

[dir='rtl'] .internado__voltar .ph {
  scale: -1 1;
}

/* ------------------------------------------------------------------ dados da internação */

.dados__lista {
  display: grid;
  gap: 0.85rem 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  margin: 0;
}

.dados__item {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.dados__item--largo {
  grid-column: 1 / -1;
}

.dados__item dt {
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-weight: 600;
}

.dados__item dd {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 1.45;
}

.dados__item--largo dd {
  font-weight: 500;
}

/* ------------------------------------------------------------------ avisos
 * Uma linha, como o aviso da pauta da Visão geral: ícone e frase, sem moldura pintada.
 */

/*
 * O encerramento é neutro de propósito, e não verde de sucesso nem vermelho de alarme: ele cobre
 * alta, transferência e óbito com a mesma marcação, e pintar de verde a linha que diz que o animal
 * morreu seria a pior escolha possível de paleta.
 */
.encerrada,
.troca,
.erroAcao {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0;
  padding: 0.7rem 0.9rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.45;
}

.encerrada {
  background: var(--hc-cinza-fundo);
  color: var(--hc-tinta);
}

.encerrada i {
  color: var(--hc-tinta-2);
}

/*
 * A dose em cima da troca de plantão pede atenção, e a atenção mora no ícone: linha, não tarja.
 * A faixa pêssego de ponta a ponta disputava com o checklist logo abaixo.
 */
.troca {
  padding: 0.15rem 0;
  background: transparent;
  color: var(--hc-tinta);
}

.troca i {
  color: var(--hc-pessego-tinta);
}

.erroAcao {
  background: var(--hc-coral-fundo);
  color: var(--hc-coral-tinta);
}
</style>
