<script setup lang="ts">
/**
 * Um remédio de casa na ficha do paciente — um bloco por remédio.
 *
 * A ordem da leitura é a do retorno:
 *
 * 1. **O que é e como dar** — o nome, e embaixo a receita em quatro dados (dose, via, intervalo,
 *    duração), cada um com o rótulo dele. É o que se confere antes de qualquer conversa.
 * 2. **Como foi** — a faixa das últimas duas semanas em tamanho de leitura (um quadrado por dose,
 *    o número do dia embaixo de cada coluna) e, ao lado, a conta desde a última consulta em
 *    número grande: "8 de 12 doses dadas". O selo diz o estado em palavra quando há uma a dizer
 *    ("Adesão caiu", "Todas dadas"); a regra da casa continua — sem nota, sem porcentagem.
 * 3. **O que fazer** — o alerta, quando há, com o motivo que a própria casa deu; e embaixo, os
 *    botões do bloco: registrar a dose da vez (em nome de quem cuida, como no app), registrar o
 *    contato com a casa, marcar como crítico e ver os registros um a um.
 *
 * Os registros ficam recolhidos. Abertos, são a versão sem cor da faixa — a tabela que o leitor de
 * tela e a impressão leem.
 *
 * Encerrado, o bloco vira uma linha: nome, período, a faixa compacta e a conta.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicDataTable from '../base/ClinicDataTable.vue'
import type { ColunaTabela } from '../base/table-types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoTratamento } from '../../composables/useRotulosDoTratamento'
import type { TratamentoNaFicha } from '../../data/repositories'
import {
  ANTECEDENCIA_DO_REGISTRO_MIN,
  MOTIVOS_DA_DOSE_PULADA,
  horarioDestoante,
  type DoseNaGrade,
  type MotivoDaDosePulada,
} from '../../domain/adesao'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

import FaixaDeDoses from './FaixaDeDoses.vue'

/** Duas semanas: cabem em tamanho de leitura numa folha e mostram o ritmo da casa. */
const JANELA_DIAS = 14

/** Encerrado: três semanas, em célula pequena — é registro, não conversa. */
const JANELA_DO_ENCERRADO = 21

const props = withDefaults(
  defineProps<{
    lido: TratamentoNaFicha
    ultimaConsultaEm: string | null
    /** Quem cuida, pelo id: o nome que aparece no registro. */
    nomes: Record<string, string>
    /** Encerrado: sem alerta, sem controle, só a conta. */
    encerrado?: boolean
    salvando?: boolean
    /**
     * Em nome de quem a ficha registra a dose da vez — quem está com o celular na gaveta, ou o
     * responsável quando esse só acompanha. Sem ninguém, o bloco não oferece o registro.
     */
    quemRegistra?: { id: string; nome: string } | null
    /** A recusa da última tentativa, na dose em que aconteceu. */
    recusa?: { tratamentoId: string; numero: number; texto: string } | null
  }>(),
  { encerrado: false, salvando: false, quemRegistra: null, recusa: null },
)

const emit = defineEmits<{
  critico: [valor: boolean]
  contato: [dados: { professionalId: string; nota: string }]
  registrar: [
    dose: {
      tratamentoId: string
      numero: number
      situacao: 'dada' | 'pulada'
      motivo: MotivoDaDosePulada | null
    },
  ]
  desfazer: [dose: { tratamentoId: string; numero: number }]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoTratamento()
const clinico = useClinicoStore()
const idDoCritico = useId()
const idDaNota = useId()
const idDeQuem = useId()
const idDoNome = useId()

const tratamento = computed(() => props.lido.tratamento)
const nome = computed(() => rotulos.nome(tratamento.value))
const alerta = computed(() => (props.lido.alerta ? rotulos.alerta(props.lido.alerta) : null))
const destoante = computed(() => horarioDestoante(props.lido.periodo))
const periodo = computed(() => props.lido.periodo)

const rotuloDaFaixa = computed(
  () =>
    `${nome.value}: ${rotulos.periodo(periodo.value, props.ultimaConsultaEm)}, ${rotulos.contagem(periodo.value)}`,
)

const periodoDoEncerrado = computed(() =>
  t('clinico.adesao.ficha.encerradosPeriodo', {
    inicio: formato.dataCurta(clinicClock.dateOf(tratamento.value.inicioEm)),
    fim: formato.dataCurta(
      clinicClock.dateOf(
        tratamento.value.encerradoEm ?? props.lido.ultimaDoseEm ?? tratamento.value.inicioEm,
      ),
    ),
  }),
)

// ------------------------------------------------------------------ como dar

/** A receita em quatro dados, cada um com o rótulo: lida de relance, conferida item a item. */
const comoDar = computed(() => {
  const item = tratamento.value
  const fim = props.lido.ultimaDoseEm

  return [
    {
      id: 'dose',
      rotulo: t('clinico.internacao.prescricao.dose'),
      valor: rotulos.dose(item.quantidade, item.unidade),
    },
    {
      id: 'via',
      rotulo: t('clinico.internacao.prescricao.via'),
      valor: t(`clinico.prontuario.conduta.via_.${item.via}`),
    },
    {
      id: 'intervalo',
      rotulo: t('clinico.bulario.doseIntervalo'),
      valor: t('clinico.adesao.posologia.aCada', { horas: item.frequenciaHoras }),
    },
    {
      id: 'duracao',
      rotulo: t('clinico.ficha.tratamento.como.duracao'),
      valor:
        item.duracaoDias === null
          ? t('clinico.adesao.posologia.continuo')
          : [
              t('clinico.ficha.tratamento.como.dias', { dias: item.duracaoDias }, item.duracaoDias),
              fim
                ? t('clinico.ficha.tratamento.como.ate', {
                    data: formato.dataCurta(clinicClock.dateOf(fim)),
                  })
                : '',
            ]
              .filter(Boolean)
              .join(' · '),
    },
  ]
})

// ------------------------------------------------------------------ a conta

/**
 * O estado em palavra, quando há uma que não seja nota: a queda que o alerta já mediu, ou "todas
 * dadas". Entre um e outro, o número fala sozinho — "9 de 12" não precisa de adjetivo.
 */
const seloDaAdesao = computed<{ tom: 'risco' | 'ok'; icone: string; texto: string } | null>(() => {
  if (props.encerrado || !props.lido.compartilhado) {
    return null
  }

  if (props.lido.alerta) {
    return { tom: 'risco', icone: 'ph ph-warning', texto: t('clinico.adesao.alerta.selo') }
  }

  if (periodo.value.fechadas > 0 && periodo.value.dadas === periodo.value.fechadas) {
    return {
      tom: 'ok',
      icone: 'ph ph-check-circle',
      texto: t('clinico.ficha.tratamento.conta.todasDadas'),
    }
  }

  return null
})

/** O resto da conta, depois das dadas: "1 pulada (esquecimento) · 3 sem registro". */
const restoDaConta = computed(() => {
  const resumo = periodo.value
  const partes: string[] = []

  if (resumo.puladas > 0) {
    const puladas = t('clinico.adesao.contagem.puladas', { total: resumo.puladas }, resumo.puladas)
    const motivos = rotulos.lista(
      resumo.motivos.map((item) => t(`clinico.adesao.motivoNaFrase.${item.motivo}`)),
    )

    partes.push(resumo.motivos.length > 0 ? `${puladas} (${motivos})` : puladas)
  }

  if (resumo.semRegistro > 0) {
    partes.push(
      t('clinico.adesao.contagem.semRegistro', { total: resumo.semRegistro }, resumo.semRegistro),
    )
  }

  return partes.join(' · ')
})

const quemRegistrou = computed(() => rotulos.quem(periodo.value, props.nomes))

// ------------------------------------------------------------------ a dose da vez

/**
 * A dose que ainda dá para registrar agora: a janela dela abriu (uma hora antes do horário) e
 * ainda não fechou (o horário da seguinte). Com duas abertas — a das 15h que ninguém marcou e a
 * das 23h que já se aproxima —, a mais antiga primeiro: é a que fecha antes.
 */
const daVez = computed<DoseNaGrade | null>(() => {
  if (props.encerrado || !props.lido.compartilhado) {
    return null
  }

  const agora = Date.parse(clinicClock.nowIso())
  const naJanela = props.lido.doses.filter(
    (dose) =>
      Date.parse(dose.registravelAte) > agora &&
      Date.parse(dose.previstaEm) - ANTECEDENCIA_DO_REGISTRO_MIN * 60_000 <= agora,
  )

  return (
    naJanela.find((dose) => dose.situacao === 'aberta') ?? naJanela[naJanela.length - 1] ?? null
  )
})

const tituloDaVez = computed(() => {
  const dose = daVez.value

  if (!dose) {
    return ''
  }

  return clinicClock.dateOf(dose.previstaEm) === clinicClock.today()
    ? t('clinico.ficha.tratamento.vez.titulo', { hora: formato.hora(dose.previstaEm) })
    : t('clinico.ficha.tratamento.vez.tituloDia', { quando: rotulos.diaEHora(dose.previstaEm) })
})

/** Já registrada: quem marcou, e quando — a mesma frase que o celular mostra. */
const registroDaVez = computed(() => {
  const registro = daVez.value?.registro

  if (!registro) {
    return null
  }

  const quem = rotulos.primeiroNome(props.nomes[registro.cuidadorId] ?? '')

  return {
    texto:
      registro.situacao === 'dada'
        ? t('clinico.adesao.app.dadaPor', { nome: quem, hora: formato.hora(registro.registradaEm) })
        : t('clinico.adesao.app.puladaPor', {
            nome: quem,
            motivo: t(`clinico.adesao.motivo.${registro.motivo ?? 'esqueci'}`),
          }),
    situacao: registro.situacao,
    /* Só quem marcou desfaz: desfazer o registro de outra pessoa apagaria o que ela viu. */
    podeDesfazer: props.quemRegistra?.id === registro.cuidadorId,
  }
})

/** O segundo passo do "Registrar como pulada": o motivo, em três botões, como no app. */
const pulando = ref(false)

function registrarDaVez(situacao: 'dada' | 'pulada', motivo: MotivoDaDosePulada | null = null) {
  if (!daVez.value) {
    return
  }

  pulando.value = false
  emit('registrar', {
    tratamentoId: tratamento.value.id,
    numero: daVez.value.numero,
    situacao,
    motivo,
  })
}

const recusaDaVez = computed(() =>
  props.recusa &&
  daVez.value &&
  props.recusa.tratamentoId === tratamento.value.id &&
  props.recusa.numero === daVez.value.numero
    ? props.recusa.texto
    : '',
)

// ------------------------------------------------------------------ contato

const registrandoContato = ref(false)
const quemFalou = ref<string>(tratamento.value.prescritoPor)
const nota = ref('')

const profissionais = computed(() =>
  clinico.profissionais
    .filter((item) => item.ativo)
    .map((item) => ({ valor: item.id, rotulo: item.nome })),
)

const contato = computed(() => {
  const registrado = tratamento.value.contato

  if (!registrado) {
    return null
  }

  return {
    texto: t('clinico.adesao.alerta.contato', {
      nome: clinico.profissional(registrado.professionalId)?.nome ?? '',
      quando: formato.relativo(registrado.em),
    }),
    nota: registrado.nota,
  }
})

function salvarContato() {
  emit('contato', { professionalId: quemFalou.value, nota: nota.value })
  registrandoContato.value = false
  nota.value = ''
}

// ------------------------------------------------------------------ registros

const verRegistros = ref(false)

type LinhaDeRegistro = DoseNaGrade

const registros = computed<LinhaDeRegistro[]>(() =>
  props.lido.doses
    .filter((dose) => dose.situacao !== 'prevista')
    .filter((dose) => Date.parse(dose.previstaEm) >= Date.parse(props.lido.periodo.desde))
    .reverse(),
)

const colunas = computed<ColunaTabela<LinhaDeRegistro>[]>(() => [
  {
    id: 'quando',
    rotulo: t('clinico.adesao.registros.colunaQuando'),
    largura: '8.5rem',
    ordenarPor: (linha) => linha.previstaEm,
    ordemInicial: 'desc',
  },
  {
    id: 'situacao',
    rotulo: t('clinico.adesao.registros.colunaSituacao'),
    largura: 'minmax(0, 1.2fr)',
  },
  { id: 'quem', rotulo: t('clinico.adesao.registros.colunaQuem'), largura: 'minmax(0, 1fr)' },
])

function textoDaSituacao(dose: DoseNaGrade): string {
  const situacao = t(`clinico.adesao.situacao.${dose.situacao}`)

  return dose.situacao === 'pulada' && dose.registro?.motivo
    ? `${situacao} · ${t(`clinico.adesao.motivoNaFrase.${dose.registro.motivo}`)}`
    : situacao
}
</script>

<template>
  <!-- ============================================================ encerrado: uma linha -->
  <article v-if="encerrado" class="trat trat--encerrado" :aria-labelledby="idDoNome">
    <div class="trat__fim">
      <h3 :id="idDoNome" class="trat__fim-nome">{{ nome }}</h3>
      <p class="trat__fim-meta">
        {{ rotulos.posologia(tratamento) }} · <span class="ui-num">{{ periodoDoEncerrado }}</span>
      </p>
    </div>

    <template v-if="lido.compartilhado">
      <FaixaDeDoses
        class="trat__fim-faixa"
        :doses="lido.doses"
        :frequencia-horas="tratamento.frequenciaHoras"
        :rotulo="rotuloDaFaixa"
        :nomes="nomes"
        :dias="JANELA_DO_ENCERRADO"
        compacta
      />
      <p class="trat__fim-conta ui-num">{{ rotulos.contagem(lido.periodo) }}</p>
    </template>
    <p v-else class="trat__fim-conta">
      <i class="ph ph-eye-slash" aria-hidden="true" />
      {{ t('clinico.adesao.naoCompartilhado') }}
    </p>
  </article>

  <!-- ============================================================ em curso: o bloco -->
  <article
    v-else
    class="trat ui-folha"
    :class="{ 'ui-marca ui-marca--risco': lido.alerta }"
    :aria-labelledby="idDoNome"
  >
    <header class="trat__cabeca">
      <span class="trat__icone" aria-hidden="true"><i class="ph ph-pill" /></span>
      <div class="trat__identidade">
        <h3 :id="idDoNome" class="trat__nome">{{ nome }}</h3>
        <p v-if="tratamento.instrucoes" class="trat__instrucoes">{{ tratamento.instrucoes }}</p>
      </div>
      <div class="trat__selos">
        <span v-if="tratamento.critico" class="ui-selo ui-selo--atencao">
          <i class="ph ph-first-aid" aria-hidden="true" />
          {{ t('clinico.adesao.critico.selo') }}
        </span>
        <span v-if="!lido.compartilhado" class="ui-selo">
          <i class="ph ph-eye-slash" aria-hidden="true" />
          {{ t('clinico.adesao.app.naoCompartilhado') }}
        </span>
      </div>
    </header>

    <!-- Como dar: os quatro dados da receita, cada um com o rótulo dele. -->
    <dl class="trat__como">
      <div v-for="item in comoDar" :key="item.id" class="trat__dado">
        <dt>{{ item.rotulo }}</dt>
        <dd class="ui-num">{{ item.valor }}</dd>
      </div>
    </dl>

    <!-- O que a casa registrou: a faixa à esquerda, a conta à direita. -->
    <div v-if="lido.compartilhado" class="trat__leitura">
      <div class="trat__janela">
        <span class="trat__rotulo">
          {{ t('clinico.adesao.lista.coluna.janela', { dias: JANELA_DIAS }) }}
        </span>
        <FaixaDeDoses
          class="trat__faixa"
          :doses="lido.doses"
          :frequencia-horas="tratamento.frequenciaHoras"
          :rotulo="rotuloDaFaixa"
          :marco="ultimaConsultaEm"
          :nomes="nomes"
          :dias="JANELA_DIAS"
          dias-no-eixo
        />
      </div>

      <div class="trat__conta">
        <span v-if="seloDaAdesao" class="ui-selo" :class="`ui-selo--${seloDaAdesao.tom}`">
          <i :class="seloDaAdesao.icone" aria-hidden="true" />
          {{ seloDaAdesao.texto }}
        </span>

        <template v-if="periodo.fechadas > 0">
          <p class="trat__numero">
            <strong class="ui-num">{{
              t('clinico.ficha.tratamento.conta.numero', {
                dadas: periodo.dadas,
                fechadas: periodo.fechadas,
              })
            }}</strong>
            <span>{{
              t(
                'clinico.ficha.tratamento.conta.legenda',
                { total: periodo.fechadas },
                periodo.fechadas,
              )
            }}</span>
          </p>
          <p class="trat__periodo">{{ rotulos.periodo(periodo, ultimaConsultaEm) }}</p>
          <p v-if="restoDaConta" class="trat__resto ui-num">{{ restoDaConta }}</p>
        </template>
        <p v-else class="trat__periodo">{{ t('clinico.adesao.contagem.nenhuma') }}</p>

        <p v-if="quemRegistrou" class="trat__meta">{{ quemRegistrou }}</p>
        <p v-if="destoante" class="trat__destoante">{{ rotulos.horarioDestoante(destoante) }}</p>
      </div>
    </div>

    <p v-else class="trat__nao-compartilhado">
      <i class="ph ph-lock-simple" aria-hidden="true" />
      <span>
        <strong>{{ t('clinico.adesao.naoCompartilhado') }}</strong>
        {{ t('clinico.adesao.naoCompartilhadoDetalhe') }}
      </span>
    </p>

    <!--
      O alerta: ícone e palavra no tom de risco, numa faixa tingida dentro do bloco. A ligação a
      clínica faz como já faz, pelo telefone do cadastro; o registro da conversa é o que apaga o
      alerta, não o tempo.
    -->
    <section v-if="alerta" class="trat__alerta" role="status">
      <i class="ph ph-warning trat__alerta-icone" aria-hidden="true" />
      <div class="trat__alerta-texto">
        <strong>{{ alerta.titulo }}</strong>
        <span v-if="alerta.detalhe">{{ alerta.detalhe }}</span>
      </div>
    </section>

    <p v-if="contato && !registrandoContato" class="trat__contato">
      <i class="ph ph-chat-circle-text" aria-hidden="true" />
      <span>
        {{ contato.texto }}
        <q v-if="contato.nota">{{ contato.nota }}</q>
      </span>
    </p>

    <form v-if="registrandoContato" class="trat__contato-form" @submit.prevent="salvarContato">
      <div class="trat__campo">
        <label :for="idDeQuem">{{ t('clinico.adesao.alerta.quemFalou') }}</label>
        <Select
          v-model="quemFalou"
          :input-id="idDeQuem"
          :options="profissionais"
          option-label="rotulo"
          option-value="valor"
          :pt="{ overlay: { class: 'clinic-overlay' } }"
        />
      </div>
      <div class="trat__campo trat__campo--nota">
        <label :for="idDaNota">{{ t('clinico.adesao.alerta.nota') }}</label>
        <InputText
          :id="idDaNota"
          v-model="nota"
          :placeholder="t('clinico.adesao.alerta.notaPlaceholder')"
          maxlength="280"
        />
      </div>
      <div class="trat__contato-acoes">
        <Button
          type="button"
          :label="t('clinico.adesao.alerta.cancelar')"
          severity="secondary"
          text
          @click="registrandoContato = false"
        />
        <Button
          type="submit"
          icon="ph ph-check"
          :label="t('clinico.adesao.alerta.salvar')"
          :loading="salvando"
        />
      </div>
    </form>

    <!--
      A dose da vez, registrada daqui em nome de quem cuida — a mesma dose, a mesma regra e a mesma
      frase do celular. É o "a Ana ligou dizendo que deu", resolvido sem pedir o celular dela.
    -->
    <div v-if="daVez" class="trat__vez">
      <span class="trat__vez-icone" aria-hidden="true"><i class="ph ph-clock" /></span>
      <div class="trat__vez-texto">
        <strong>{{ tituloDaVez }}</strong>
        <span v-if="registroDaVez" :class="`trat__vez-feita--${registroDaVez.situacao}`">
          {{ registroDaVez.texto }}
        </span>
        <span v-else-if="quemRegistra">
          {{
            t('clinico.ficha.tratamento.vez.emNomeDe', {
              nome: rotulos.primeiroNome(quemRegistra.nome),
            })
          }}
        </span>
        <span v-if="recusaDaVez" class="trat__vez-recusa" role="alert">{{ recusaDaVez }}</span>
      </div>

      <div v-if="registroDaVez" class="trat__vez-acoes">
        <Button
          v-if="registroDaVez.podeDesfazer"
          type="button"
          icon="ph ph-arrow-counter-clockwise"
          :label="t('clinico.adesao.app.desfazer')"
          severity="secondary"
          text
          size="small"
          :disabled="salvando"
          @click="emit('desfazer', { tratamentoId: tratamento.id, numero: daVez.numero })"
        />
      </div>

      <div v-else-if="quemRegistra && pulando" class="trat__vez-acoes">
        <span class="trat__vez-pergunta">{{ t('clinico.adesao.app.porQue') }}</span>
        <Button
          v-for="motivo in MOTIVOS_DA_DOSE_PULADA"
          :key="motivo"
          type="button"
          :label="t(`clinico.adesao.motivo.${motivo}`)"
          severity="secondary"
          outlined
          size="small"
          :disabled="salvando"
          @click="registrarDaVez('pulada', motivo)"
        />
        <Button
          type="button"
          icon="ph ph-x"
          severity="secondary"
          text
          size="small"
          :aria-label="t('clinico.adesao.app.voltar')"
          :title="t('clinico.adesao.app.voltar')"
          @click="pulando = false"
        />
      </div>

      <div v-else-if="quemRegistra" class="trat__vez-acoes">
        <Button
          type="button"
          :label="t('clinico.ficha.tratamento.vez.pular')"
          severity="secondary"
          text
          size="small"
          :disabled="salvando"
          @click="pulando = true"
        />
        <Button
          type="button"
          icon="ph ph-check"
          :label="t('clinico.ficha.tratamento.vez.registrar')"
          severity="secondary"
          outlined
          size="small"
          :loading="salvando"
          @click="registrarDaVez('dada')"
        />
      </div>
    </div>

    <!-- As ações do bloco: falar com a casa, a marca de crítico e os registros um a um. -->
    <footer class="trat__acoes">
      <Button
        v-if="!registrandoContato"
        type="button"
        icon="ph ph-chat-circle-text"
        :label="t('clinico.adesao.alerta.registrarContato')"
        :severity="alerta ? undefined : 'secondary'"
        :outlined="!alerta"
        size="small"
        @click="registrandoContato = true"
      />

      <div class="trat__critico">
        <ToggleSwitch
          :model-value="tratamento.critico"
          :input-id="idDoCritico"
          :disabled="salvando"
          @update:model-value="emit('critico', Boolean($event))"
        />
        <label :for="idDoCritico">{{ t('clinico.adesao.critico.alternar') }}</label>
      </div>

      <Button
        v-if="lido.compartilhado"
        type="button"
        class="trat__registros"
        :icon="verRegistros ? 'ph ph-caret-up' : 'ph ph-list-bullets'"
        :label="
          verRegistros ? t('clinico.adesao.registros.esconder') : t('clinico.adesao.registros.ver')
        "
        severity="secondary"
        text
        size="small"
        :aria-expanded="verRegistros"
        @click="verRegistros = !verRegistros"
      />
    </footer>

    <ClinicDataTable
      v-if="verRegistros && lido.compartilhado"
      class="trat__tabela"
      :colunas="colunas"
      :linhas="registros"
      :chave="(linha) => String(linha.numero)"
      :vazio-titulo="t('clinico.adesao.registros.vazio')"
      :rotulo="t('clinico.adesao.registros.rotulo', { medicamento: nome })"
    >
      <template #celula-quando="{ linha }">
        <strong class="ui-num trat__celula-forte">{{ rotulos.diaEHora(linha.previstaEm) }}</strong>
      </template>
      <template #celula-situacao="{ linha }">
        <span class="trat__situacao faixa-cores">
          <span
            class="trat__amostra"
            :class="`trat__amostra--${linha.situacao}`"
            aria-hidden="true"
          />
          {{ textoDaSituacao(linha) }}
        </span>
      </template>
      <template #celula-quem="{ linha }">
        <template v-if="linha.registro">
          <span class="trat__quem">{{ nomes[linha.registro.cuidadorId] ?? '' }}</span>
          <span class="trat__meta ui-num">
            {{
              t('clinico.adesao.registros.registradaAs', {
                quando: rotulos.diaEHora(linha.registro.registradaEm),
              })
            }}
          </span>
        </template>
        <span v-else class="trat__meta">{{ t('clinico.ficha.tratamento.semQuem') }}</span>
      </template>
    </ClinicDataTable>
  </article>
</template>

<style scoped>
/* ------------------------------------------------------------------ o bloco */

.trat {
  position: relative;
  display: grid;
  min-width: 0;
  gap: 18px;
  padding: 20px 22px;
}

.trat__cabeca {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

/* O ladrilho do remédio, no tom do lugar: o mesmo dos cartões da ficha. */
.trat__icone {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 22px;
}

.trat__identidade {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
  padding-top: 2px;
}

.trat__nome {
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.trat__instrucoes {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.trat__selos {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

/* ------------------------------------------------------------------ como dar */

/* Os quatro dados lado a lado, separados por um fio: lê-se como a linha da receita. */
.trat__como {
  display: grid;
  margin: 0;
  gap: 12px 0;
  grid-template-columns: repeat(4, minmax(0, max-content));
  padding-inline-start: 58px;
}

.trat__dado {
  display: grid;
  min-width: 0;
  gap: 2px;
  padding-inline: 22px;
  border-inline-start: 1px solid var(--linha);
}

.trat__dado:first-child {
  padding-inline-start: 0;
  border-inline-start: 0;
}

.trat__dado dt {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.trat__dado dd {
  margin: 0;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
}

/* ------------------------------------------------------------------ a faixa e a conta */

/*
 * A faixa numa trilha de largura fixa e a conta ao lado: com dois remédios, os dias de um caem
 * embaixo dos dias do outro. A faixa cresce para 20 px por dose — de longe, do outro lado da mesa.
 */
.trat__leitura {
  display: grid;
  align-items: start;
  gap: 18px 36px;
  grid-template-columns: max-content minmax(0, 1fr);
  padding: 16px 18px;
  border-radius: 14px;
  background: var(--superficie-2);
}

.trat__janela {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 10px;
}

.trat__janela :deep(.faixa) {
  --faixa-celula: 20px;
  --faixa-vao: 4px;

  gap: 10px;
}

.trat__janela :deep(.faixa__horarios),
.trat__janela :deep(.faixa__eixo) {
  font-size: 12px;
}

.trat__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.trat__conta {
  display: grid;
  min-width: 0;
  align-content: start;
  justify-items: start;
  gap: 4px;
}

.trat__conta .ui-selo {
  margin-bottom: 6px;
}

/* O número que importa: grande, com a legenda pequena embaixo, como o "46 min esperando". */
.trat__numero {
  display: grid;
  margin: 0;
  line-height: 1.1;
}

.trat__numero strong {
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.trat__numero span {
  color: var(--tinta-2);
  font-size: 13px;
}

.trat__periodo {
  margin: 4px 0 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
}

.trat__resto,
.trat__meta,
.trat__destoante {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.trat__destoante {
  max-width: 52ch;
  color: var(--tinta);
}

.trat__nao-compartilhado,
.trat__contato {
  display: flex;
  align-items: flex-start;
  margin: 0;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.trat__nao-compartilhado {
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--superficie-2);
}

.trat__nao-compartilhado i,
.trat__contato i {
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 17px;
}

.trat__nao-compartilhado strong {
  display: block;
  color: var(--tinta);
  font-weight: 600;
}

.trat__contato q {
  margin-inline-start: 4px;
  color: var(--tinta);
  font-style: italic;
}

/* ------------------------------------------------------------------ alerta */

.trat__alerta {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--risco-fundo);
}

.trat__alerta-icone {
  margin-top: 1px;
  color: var(--risco-tinta);
  font-size: 20px;
}

.trat__alerta-texto {
  display: grid;
  gap: 2px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.trat__alerta-texto strong {
  color: var(--risco-tinta);
  font-weight: 600;
}

/* ------------------------------------------------------------------ contato */

.trat__contato-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 14px;
}

.trat__campo {
  display: grid;
  gap: 6px;
  min-width: 12rem;
}

.trat__campo--nota {
  flex: 1 1 16rem;
}

.trat__campo label {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.trat__contato-acoes {
  display: flex;
  gap: 8px;
}

/* ------------------------------------------------------------------ dose da vez */

/* A dose da vez é a ação do bloco: um poço levemente tingido na cor do lugar. */
.trat__vez {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 12px 14px;
  border: 1px solid color-mix(in oklab, var(--pj-lugar, var(--clinica)) 22%, var(--linha-suave));
  border-radius: var(--raio-cartao-pequeno);
  background: color-mix(
    in oklab,
    var(--pj-lugar-fundo, var(--clinica-fundo)) 40%,
    var(--superficie)
  );
}

.trat__vez-icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 18px;
}

.trat__vez-texto {
  display: grid;
  flex: 1 1 14rem;
  min-width: 0;
  gap: 1px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.trat__vez-texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.trat__vez-feita--dada {
  color: var(--tinta);
  font-weight: 550;
}

.trat__vez-recusa {
  color: var(--atencao-tinta);
  font-weight: 600;
}

.trat__vez-acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.trat__vez-pergunta {
  margin-inline-end: 4px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

/* ------------------------------------------------------------------ ações */

/* O pé do bloco, rente e tingido como o pé dos cartões da ficha. */
.trat__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 20px;
  margin: 0 -22px -20px;
  padding: 12px 22px;
  border-top: 1px solid var(--linha-suave);
  border-radius: 0 0 calc(var(--raio-cartao) - 1px) calc(var(--raio-cartao) - 1px);
  background: color-mix(in oklab, var(--superficie-2) 55%, var(--superficie));
}

/* Com os registros abertos embaixo, o pé deixa de ser o fim do bloco. */
.trat__acoes:not(:last-child) {
  margin-bottom: 0;
  border-bottom: 1px solid var(--linha-suave);
  border-radius: 0;
}

.trat__critico {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.trat__critico label {
  cursor: pointer;
}

.trat__registros {
  margin-inline-start: auto;
}

/* ------------------------------------------------------------------ registros */

/* Os registros moram dentro do bloco: a tabela fica rente, sem a sombra de cartão dela. */
.trat__tabela.tabela {
  border-color: var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  box-shadow: none;
}

.trat__situacao {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.trat__amostra {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border-radius: 3px;
}

.trat__amostra--dada {
  background: var(--faixa-dada);
}

.trat__amostra--pulada {
  background: var(--faixa-pulada);
}

.trat__amostra--sem-registro {
  background: var(--faixa-sem-registro);
}

.trat__amostra--aberta {
  box-shadow: inset 0 0 0 2px var(--faixa-agora);
}

.trat__celula-forte {
  font-weight: 600;
}

.trat__quem {
  display: block;
  font-weight: 600;
}

/* ------------------------------------------------------------------ encerrado */

.trat--encerrado {
  display: grid;
  align-items: center;
  gap: 8px 24px;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 0.9fr);
  min-height: 60px;
  padding: 12px 18px;
}

.trat__fim {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.trat__fim-nome {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.trat__fim-meta,
.trat__fim-conta {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.trat__fim-conta {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ------------------------------------------------------------------ estreito */

@media (max-width: 1100px) {
  .trat__leitura {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .trat {
    padding: 16px;
  }

  .trat__acoes {
    margin-inline: -16px;
    margin-bottom: -16px;
    padding-inline: 16px;
  }

  .trat__como {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-inline-start: 0;
  }

  .trat__dado:nth-child(odd) {
    padding-inline-start: 0;
    border-inline-start: 0;
  }

  .trat__janela :deep(.faixa) {
    --faixa-celula: 16px;
    --faixa-vao: 3px;
  }

  .trat--encerrado {
    grid-template-columns: minmax(0, 1fr);
  }

  /* No estreito, os botões da dose descem para baixo da frase, alinhados com ela. */
  .trat__vez-acoes {
    width: 100%;
    padding-inline-start: 48px;
  }

  .trat__registros {
    margin-inline-start: 0;
  }
}
</style>
