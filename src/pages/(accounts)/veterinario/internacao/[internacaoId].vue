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
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicPatientHeader from '@/features/clinico/components/base/ClinicPatientHeader.vue'
import ClinicStat from '@/features/clinico/components/base/ClinicStat.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
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
      rotulo:
        total > 0
          ? `${t(`clinico.internacao.abas.${valor}`)} · ${total}`
          : t(`clinico.internacao.abas.${valor}`),
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

/**
 * Gravidade e leito viram **um indicador do resumo**, e não dois selos soltos ao lado do cartão.
 *
 * Eles não são identidade do paciente — o Bento continua sendo o Bento fora da internação. São
 * estado *desta* internação, como "internado há" e "a fazer agora", e é nessa fileira que a
 * pergunta deles é feita. Soltos à direita do cartão, não pertenciam nem ao cabeçalho nem ao
 * resumo: sobravam num vão entre os dois, e o topo da tela parecia desalinhado.
 */
const TOM_DA_GRAVIDADE: Record<GravidadeClinica, 'neutro' | 'atencao' | 'risco'> = {
  estavel: 'neutro',
  atencao: 'atencao',
  critico: 'risco',
}

const ICONE_DA_GRAVIDADE: Record<GravidadeClinica, string> = {
  estavel: 'pi pi-check-circle',
  atencao: 'pi pi-eye',
  critico: 'pi pi-exclamation-triangle',
}

/**
 * O leito, e o tipo dele quando o tipo muda o que se faz ao chegar.
 *
 * "Leito R1" basta num leito geral. Em isolamento não basta: quem vai até lá precisa saber antes
 * de abrir a porta, e é a única informação desta linha que muda o comportamento de quem a lê.
 */
/** Entrada e alta contadas juntas: é a mesma pergunta de planejamento. */
const previsaoDeAlta = computed(() => {
  const alta = paciente.value?.internacao.altaPrevistaEm

  return alta
    ? t('clinico.internacao.paciente.altaEm', {
        data: formato.dataCurta(alta.slice(0, 10)),
      })
    : t('clinico.internacao.paciente.semPrevisaoDeAlta')
})

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

async function compor(observado: string) {
  await internacao.gerarBoletim({ autorId: plantonistaId.value, observado })
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

function voltar() {
  void router.push('/veterinario/internacao')
}

function verHistorico() {
  const petId = paciente.value?.internacao.petId

  if (petId) {
    void router.push(`/veterinario/paciente/${petId}/historico`)
  }
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
    :title="t('clinico.internacao.paciente.titulo')"
    :subtitle="paciente?.internacao.motivo ?? ''"
    :loading="internacao.carregando && !paciente"
    :error="internacao.erro ? t(internacao.erro) : ''"
    :empty="naoEncontrado"
    :empty-title="t('clinico.internacao.paciente.naoEncontradoTitulo')"
    :empty-description="t('clinico.internacao.paciente.naoEncontradoDescricao')"
  >
    <div v-if="paciente" class="internado clinic-scope">
      <!--
        A volta ao mapa é navegação, não conteúdo: fica sozinha na linha de cima, como migalha.
        Dividindo a linha com o cartão do paciente, ela espremia a identidade no meio da tela e
        se lia como se fosse parte dela.
      -->
      <header class="topo">
        <div class="topo__linha">
          <Button
            class="topo__voltar"
            :label="t('clinico.internacao.paciente.voltar')"
            icon="pi pi-arrow-left"
            severity="secondary"
            text
            @click="voltar"
          />

          <!--
            Encerrar fica na migalha, e não junto das abas.

            As quatro abas são o trabalho do turno, que se repete a cada meia hora; a alta
            acontece uma vez e não se desfaz. Pôr as duas coisas na mesma fileira convidaria ao
            clique errado no fim de um plantão de doze horas.
          -->
          <Button
            v-if="!encerrada"
            :label="t('clinico.internacao.alta.abrir')"
            icon="pi pi-sign-out"
            severity="secondary"
            outlined
            size="small"
            @click="altaAberta = true"
          />
        </div>

        <ClinicPatientHeader :pet="pet" :tutor="tutor" :peso-kg="paciente.internacao.pesoEntradaKg">
          <!--
            A saída para o histórico do paciente.

            A internação era um beco: entrava-se pelo mapa de leitos e a única saída era voltar
            para ele. Quem precisava saber o que aconteceu com este animal antes de ele ser
            internado — a cirurgia de anteontem, a alergia registrada no ano passado — tinha de
            achar Pacientes no menu e buscar pelo nome, com o paciente aberto na tela ao lado.
          -->
          <template #acoes>
            <Button
              :label="t('clinico.internacao.paciente.verHistorico')"
              icon="pi pi-history"
              severity="secondary"
              outlined
              size="small"
              @click="verHistorico"
            />
          </template>
        </ClinicPatientHeader>
      </header>

      <!--
        A internação encerrada continua alcançável, e precisa dizer isso na primeira linha. Sem
        esta faixa, a tela de um animal que foi para casa é indistinguível da de um animal que
        está no leito — e alguém marca uma dose numa internação que acabou ontem.
      -->
      <p v-if="desfechoRegistrado" class="encerrada" role="status">
        <i class="pi pi-check-circle" aria-hidden="true" />
        {{ t(`clinico.internacao.alta.encerrada.${desfechoRegistrado}`, { quando: encerradaEm }) }}
      </p>

      <section class="numeros">
        <ClinicStat
          :rotulo="t('clinico.internacao.paciente.estado')"
          :valor="t(`clinico.internacao.gravidade.${paciente.internacao.gravidade}`)"
          :detalhe="leitoDescrito"
          :icone="ICONE_DA_GRAVIDADE[paciente.internacao.gravidade]"
          :tom="TOM_DA_GRAVIDADE[paciente.internacao.gravidade]"
        />
        <!--
          Entrada e alta são a mesma pergunta — quanto tempo este animal fica — e por isso moram
          no mesmo indicador. Em cartões separados, os dois ocupavam metade da fileira para dizer
          duas datas, e a fileira de cinco quebrava em 4+1 na largura de tablet.
        -->
        <ClinicStat
          :rotulo="t('clinico.internacao.paciente.internadoHa')"
          :valor="t('clinico.internacao.leito.horas', { horas: tempo })"
          :detalhe="previsaoDeAlta"
          icone="pi pi-clock"
        />
        <!--
          Sem detalhe: o diagnóstico morava aqui e lia como credencial de quem assina o caso.
          Ele passou para o bloco de contexto, junto da observação do plantão.
        -->
        <ClinicStat
          :rotulo="t('clinico.internacao.paciente.responsavelClinico')"
          :valor="clinico.profissional(paciente.internacao.responsavelId)?.nome ?? '—'"
          icone="pi pi-user"
        />
        <ClinicStat
          :rotulo="t('clinico.internacao.paciente.pendentes')"
          :valor="String(internacao.pendentesDoPaciente.length)"
          :detalhe="t('clinico.internacao.paciente.pendentesDetalhe')"
          icone="pi pi-list-check"
          :tom="internacao.pendentesDoPaciente.length > 0 ? 'atencao' : 'neutro'"
        />
      </section>

      <div
        v-if="paciente.internacao.diagnostico || paciente.internacao.observacao"
        class="contexto"
      >
        <p v-if="paciente.internacao.diagnostico" class="contexto__linha">
          <span class="clinic-label">{{ t('clinico.internacao.paciente.diagnostico') }}</span>
          {{ paciente.internacao.diagnostico }}
        </p>
        <p v-if="paciente.internacao.observacao" class="contexto__linha">
          {{ paciente.internacao.observacao }}
        </p>
      </div>

      <!--
        A dose em cima da troca aparece **fora** da aba do checklist. Quem abre a tela na aba do
        boletim precisa saber que existe uma dose sem dono acontecendo agora, e não descobrir
        depois de trocar de aba.
      -->
      <p v-if="internacao.naTrocaDePlantao.length > 0" class="troca" role="status">
        <i class="pi pi-arrow-right-arrow-left" aria-hidden="true" />
        {{
          t('clinico.internacao.paciente.naTroca', {
            total: internacao.naTrocaDePlantao.length,
          })
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
  gap: var(--clinic-space-4);
}

/* Migalha em cima, identidade embaixo — e o cartão do paciente ocupa a largura inteira. */
.topo {
  display: grid;
  gap: var(--clinic-space-2);
}

.topo__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.topo__voltar {
  justify-self: start;
}

/*
 * A faixa de encerramento é neutra de propósito, e não verde de sucesso nem vermelha de alarme:
 * ela cobre alta, transferência e óbito com a mesma marcação, e pintar de verde a linha que diz
 * que o animal morreu seria a pior escolha possível de paleta.
 */
.encerrada {
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
  font-weight: 700;
}

.encerrada i {
  color: var(--clinic-faint);
}

.numeros {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

/*
 * Bloco de contexto clínico: o que o paciente tem e o que o plantão observou.
 *
 * Moldura fechada e fundo rebaixado já o distinguem do resto da página — o filete à esquerda o
 * fazia parecer citação de outra tela.
 */
.contexto {
  display: grid;
  gap: var(--clinic-space-1);
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.contexto__linha {
  margin: 0;
  line-height: 1.5;
}

.contexto__linha .clinic-label {
  margin-right: var(--clinic-space-2);
}

.troca {
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px dashed var(--clinic-accent-strong);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.erroAcao {
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-risk-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
  font-weight: 700;
}
</style>
