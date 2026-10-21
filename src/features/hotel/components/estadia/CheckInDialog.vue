<script setup lang="ts">
/**
 * Check-in.
 *
 * O momento mais denso do dia e o que mais erra quando é feito de cabeça. O diálogo é o roteiro,
 * na ordem em que a recepção o executa com o cliente na frente — e a ordem importa: **pesar antes
 * de guardar pertence** significa que a balança não fica para depois, e "depois" é o carro indo
 * embora.
 *
 * Duas coisas que não são campos de formulário e sim decisões de produto:
 *
 * - **O botão de confirmar não existe enquanto a admissão bloquear.** O motivo fica escrito ao
 *   lado, com o caminho para resolver. Um botão desabilitado sem explicação faz a recepção clicar
 *   três vezes e ligar para o suporte.
 * - **Pertence é lista, não parágrafo.** Um campo de texto com "coleira, caminha e um brinquedo"
 *   não tem como ser conferido item a item na saída, e é na conferência que a regra R4 acontece.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatarTelefone } from '@/features/clinico/domain/cadastro'

import QuemPodeBuscar from '../reserva/QuemPodeBuscar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { AvaliacaoDeAdmissao } from '../../domain/admissao'
import { problemaDoVeterinario, veterinarioInformado } from '../../domain/contatos'
import { lerHorarios } from '../../domain/rotina-padrao'
import type {
  Autorizacao,
  AutorizacaoKind,
  PessoaAutorizada,
  PlanoAlimentar,
  ServicoKind,
  VeterinarioDoPet,
  ViaDeMedicacao,
} from '../../data/types'

const props = defineProps<{
  aberto: boolean
  petNome: string
  pesoCadastroKg: number | null
  /** O responsável: sempre pode buscar, e é a primeira linha da lista de quem busca. */
  responsavelNome: string
  telefoneResponsavel: string
  /** O cadastro da família — quem já foi autorizado a buscar alguma vez. */
  contatosConhecidos: PessoaAutorizada[]
  /** Quem a reserva autorizou. Chega marcado; o balcão confirma ou corrige com o responsável. */
  autorizadosDaReserva: PessoaAutorizada[]
  /**
   * O último veterinário conhecido do animal.
   *
   * Vem preenchido para ser **confirmado**, não redigitado: perguntar "ainda é a Dra. Helena?" leva
   * dois segundos, e ditar um telefone de clínica de cabeça é onde o número sai errado.
   */
  veterinarioConhecido: VeterinarioDoPet | null
  admissao: AvaliacaoDeAdmissao | null
  /**
   * O que foi vendido na reserva.
   *
   * Entra aqui porque autorização e serviço vendido **não podem se contradizer**: vender um
   * passeio extra e o responsável negar a saída à rua é uma conta que cobra por trabalho que a
   * casa não tem permissão de fazer. Antes as autorizações nasciam numa lista fixa, sem olhar a
   * reserva, e a contradição passava calada.
   */
  servicosVendidos: ServicoKind[]
  /** O que o responsável contou ao reservar. Quem recebe o animal precisa ler antes, não depois. */
  observacaoDaReserva: string
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  confirmar: [
    payload: {
      pesoEntradaKg: number
      inspecaoDeEntrada: string
      pertences: { descricao: string; quantidade: number }[]
      planoAlimentar: PlanoAlimentar
      autorizacoes: Autorizacao[]
      contatoEmergencia: string
      /** `null` quando os três campos ficaram vazios. */
      veterinario: VeterinarioDoPet | null
      /** Quem vale para esta estadia. Gente nova vai com id provisório — ver `QuemPodeBuscar`. */
      autorizadosARetirar: PessoaAutorizada[]
      medicacoes: MedicacaoNoCheckIn[]
    },
  ]
}>()

/**
 * A medicação que o animal já toma, na forma que o repositório espera.
 *
 * `inicio` e `fim` não são perguntados: o padrão é a estadia inteira, e um campo de data para o
 * caso raro faria a recepção preencher duas datas em toda entrada. Suspender no meio já existe na
 * tela da estadia, que é onde essa decisão de fato acontece.
 */
type MedicacaoNoCheckIn = {
  descricao: string
  via: ViaDeMedicacao
  doseTexto: string
  horarios: string[]
  receita: string
  observacao: string
}

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

const AUTORIZACOES: AutorizacaoKind[] = [
  'banho',
  'passeio-externo',
  'recreacao-em-grupo',
  'foto-em-rede-social',
  'atendimento-veterinario',
  'transporte',
]

/** Pertences que quase todo hóspede traz. Sugestão, não obrigação: cada linha é removível. */
const SUGESTOES = ['Coleira e guia', 'Caminha', 'Pote de ração identificado', 'Brinquedo']

const peso = ref<number | null>(null)
const inspecao = ref('')
const pertences = ref<{ descricao: string; quantidade: number }[]>([])
const novoPertence = ref('')
const contatoEmergencia = ref('')

/** Quem pode buscar nesta estadia, além do responsável. */
const autorizados = ref<PessoaAutorizada[]>([])
/** Uma pessoa digitada e não acrescentada. Trava a confirmação — ver `QuemPodeBuscar`. */
const cadastroPendente = ref(false)

const veterinario = ref<VeterinarioDoPet>({ nome: '', clinica: '', telefone: '' })
/** O erro de telefone incompleto só depois de sair do campo: no meio da digitação, todo número é. */
const telefoneDoVetTocado = ref(false)

watch(
  () => veterinario.value.telefone,
  (valor) => {
    const formatado = formatarTelefone(valor)

    if (formatado !== valor) {
      veterinario.value.telefone = formatado
    }
  },
)

const problemaDoVet = computed(() => problemaDoVeterinario(veterinario.value))

/**
 * Por que o veterinário trava a confirmação, em palavras.
 *
 * "Falta o telefone" aparece na hora, porque é a próxima coisa a perguntar ao responsável. O
 * telefone incompleto espera o campo perder o foco — até o último dígito, todo número é incompleto.
 */
const erroDoVet = computed(() => {
  if (problemaDoVet.value === 'sem-telefone') {
    return t('hotel.checkin.vetSemTelefone')
  }

  return problemaDoVet.value === 'telefone-invalido' && telefoneDoVetTocado.value
    ? t('hotel.checkin.vetTelefoneInvalido')
    : ''
})

/** O preenchido ainda é o da última estadia: a tela pede confirmação em vez de fingir certeza. */
const vetDaUltimaVez = computed(() => {
  const conhecido = props.veterinarioConhecido

  return (
    conhecido !== null &&
    conhecido.nome === veterinario.value.nome &&
    conhecido.clinica === veterinario.value.clinica &&
    conhecido.telefone === veterinario.value.telefone
  )
})

const racaoPropria = ref(true)
const marca = ref('')
const porcao = ref<number | null>(null)
const horarios = ref('08:00, 18:00')
const restricoes = ref('')
const petiscos = ref('')

const concedidas = ref<AutorizacaoKind[]>([])

/**
 * A medicação que veio de casa.
 *
 * Existia um buraco aqui: o repositório aceitava `medicacoes` no check-in, a rotina gerava as
 * tarefas, a ficha mostrava a dose, e o serviço "medicação assistida" era vendido na reserva — mas
 * **não havia campo em tela nenhuma**. Só a semente criava medicação. Um animal que chegasse com
 * remédio não tinha onde ser registrado, e o remédio simplesmente não era dado.
 */
const VIAS: ViaDeMedicacao[] = ['oral', 'topica', 'otologica', 'oftalmica', 'subcutanea']

const medicacoes = ref<MedicacaoNoCheckIn[]>([])

function acrescentarMedicacao() {
  medicacoes.value = [
    ...medicacoes.value,
    { descricao: '', via: 'oral', doseTexto: '', horarios: [], receita: '', observacao: '' },
  ]
}

function removerMedicacao(indice: number) {
  medicacoes.value = medicacoes.value.filter((_, posicao) => posicao !== indice)
}

/** Os horários são digitados como se ditam ao telefone: "8:00, 20:00". */
const horariosPorMedicacao = ref<string[]>([])

/**
 * Medicação registrada sem horário não vira tarefa nenhuma — e some.
 *
 * Por isso ela trava a confirmação em vez de ser ignorada em silêncio: a recepção escreveu o nome
 * do remédio, e o silêncio faria o animal passar a estadia sem tomá-lo.
 */
const medicacaoIncompleta = computed(() =>
  medicacoes.value.some(
    (item, indice) =>
      item.descricao.trim() !== '' &&
      lerHorarios(horariosPorMedicacao.value[indice] ?? '').length === 0,
  ),
)

const bloqueado = computed(() => (props.admissao?.impedimentos.length ?? 0) > 0)

/**
 * A autorização que cada serviço vendido exige para poder ser executado.
 *
 * Recreação individual e adestramento não entram: acontecem dentro da casa, sem exposição e sem
 * saída à rua. Medicação assistida é taxa de administração — o que ela exige é a medicação
 * registrada logo acima, não uma permissão à parte.
 */
const AUTORIZACAO_EXIGIDA: Partial<Record<ServicoKind, AutorizacaoKind>> = {
  banho: 'banho',
  tosa: 'banho',
  'passeio-extra': 'passeio-externo',
  transporte: 'transporte',
}

const exigidasPelaVenda = computed(() => [
  ...new Set(
    props.servicosVendidos
      .map((kind) => AUTORIZACAO_EXIGIDA[kind])
      .filter((item): item is AutorizacaoKind => Boolean(item)),
  ),
])

/** O que foi vendido e o responsável acabou de negar. É contradição, e a tela diz qual. */
const negadasComServicoVendido = computed(() =>
  exigidasPelaVenda.value.filter((kind) => !concedidas.value.includes(kind)),
)

const podeConfirmar = computed(
  () =>
    !bloqueado.value &&
    (peso.value ?? 0) > 0 &&
    !medicacaoIncompleta.value &&
    !cadastroPendente.value &&
    problemaDoVet.value === null,
)

watch(
  () => props.aberto,
  (aberto) => {
    if (!aberto) {
      return
    }

    /*
     * O peso começa vazio: é o que a balança mostrou agora. O do cadastro fica embaixo do campo,
     * como referência. Preenchido, ele virava o "peso de entrada" de quem não pesou — e é esse
     * número que a saída compara para dizer se o animal perdeu peso na estadia.
     */
    peso.value = null
    inspecao.value = ''
    pertences.value = SUGESTOES.map((descricao) => ({ descricao, quantidade: 1 }))
    novoPertence.value = ''
    contatoEmergencia.value = props.telefoneResponsavel
    /* Cópias: desmarcar alguém aqui não pode mexer na reserva antes de o check-in ser gravado. */
    autorizados.value = props.autorizadosDaReserva.map((pessoa) => ({ ...pessoa }))
    cadastroPendente.value = false
    veterinario.value = props.veterinarioConhecido
      ? { ...props.veterinarioConhecido }
      : { nome: '', clinica: '', telefone: '' }
    telefoneDoVetTocado.value = false
    racaoPropria.value = true
    marca.value = ''
    porcao.value = null
    horarios.value = '08:00, 18:00'
    restricoes.value = ''
    petiscos.value = ''
    medicacoes.value = []
    horariosPorMedicacao.value = []

    /*
     * Nasce com o mínimo que todo hotel precisa — atendimento veterinário de urgência — mais o que
     * a venda exige. Marcar banho por padrão numa reserva sem banho é ensinar a recepção a passar
     * batido pela lista; não marcar o que foi vendido é vender o que não se pode fazer.
     */
    concedidas.value = [
      ...new Set<AutorizacaoKind>(['atendimento-veterinario', ...exigidasPelaVenda.value]),
    ]
  },
)

function acrescentarPertence() {
  const descricao = novoPertence.value.trim()

  if (!descricao) {
    return
  }

  pertences.value = [...pertences.value, { descricao, quantidade: 1 }]
  novoPertence.value = ''
}

function removerPertence(indice: number) {
  pertences.value = pertences.value.filter((_, posicao) => posicao !== indice)
}

function confirmar() {
  if (!podeConfirmar.value) {
    return
  }

  const agora = new Date().toISOString()

  emit('confirmar', {
    pesoEntradaKg: peso.value ?? 0,
    inspecaoDeEntrada: inspecao.value,
    pertences: pertences.value,
    planoAlimentar: {
      racaoPropria: racaoPropria.value,
      marca: marca.value,
      porcaoGramas: porcao.value ?? 0,
      /* Horários chegam como texto porque é assim que se dita ao telefone: "oito e dezoito". */
      horarios: horarios.value
        .split(/[,;]/)
        .map((item) => item.trim())
        .filter((item) => /^\d{1,2}:\d{2}$/.test(item))
        .map((item) => item.padStart(5, '0')),
      restricoes: restricoes.value,
      petiscos: petiscos.value,
    },
    autorizacoes: AUTORIZACOES.map<Autorizacao>((kind) => ({
      kind,
      concedida: concedidas.value.includes(kind),
      limiteCentavos: kind === 'atendimento-veterinario' ? 50_000 : null,
      registradaEm: agora,
    })),
    contatoEmergencia: contatoEmergencia.value,
    veterinario: veterinarioInformado(veterinario.value),
    autorizadosARetirar: autorizados.value,
    medicacoes: medicacoes.value
      .filter((item) => item.descricao.trim() !== '')
      .map((item, indice) => ({
        ...item,
        descricao: item.descricao.trim(),
        horarios: lerHorarios(horariosPorMedicacao.value[indice] ?? ''),
      })),
  })
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.checkin.titulo', { pet: petNome })"
    :style="{ width: 'min(50rem, 94vw)' }"
    class="clinic-scope pj-lugar--hotel"
    @update:visible="emit('fechar')"
  >
    <div class="checkin">
      <!--
        O impedimento abre a tela, acima de tudo. Não é um aviso: é a razão pela qual o botão do
        rodapé não vai funcionar, e ela precisa estar visível antes de alguém preencher trinta
        campos para descobrir isso no fim.
      -->
      <Message v-if="bloqueado" severity="error" :closable="false">
        {{
          t('hotel.checkin.bloqueado', {
            itens: (admissao?.impedimentos ?? [])
              .map((item) => formato.exigencia(item.kind))
              .join(', '),
          })
        }}
      </Message>

      <!--
        O que o responsável contou ao reservar chega aqui, e não três telas adiante.
        "Tem medo de trovão" é informação de quem recebe o animal, e ela era escrita na reserva e
        só reaparecia depois do check-in, na tela da estadia — tarde para quem está com o carro na
        porta.
      -->
      <p v-if="observacaoDaReserva" class="recado">
        <i class="ph ph-chat-circle" aria-hidden="true" />
        <span>
          <strong>{{ t('hotel.checkin.recadoDaReserva') }}</strong>
          {{ observacaoDaReserva }}
        </span>
      </p>

      <section class="bloco">
        <h3 class="bloco__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"><i class="ph ph-sign-in" /></span>
          {{ t('hotel.checkin.chegada') }}
        </h3>

        <div class="grade">
          <div class="campo">
            <label :for="`${idCampo}-peso`">{{ t('hotel.checkin.peso') }}</label>
            <InputNumber
              :input-id="`${idCampo}-peso`"
              v-model="peso"
              :min="0"
              :max-fraction-digits="1"
              suffix=" kg"
              fluid
            />
            <small v-if="pesoCadastroKg !== null" class="campo__dica">
              {{ t('hotel.checkin.pesoCadastro', { valor: formato.peso(pesoCadastroKg) }) }}
            </small>
          </div>

          <div class="campo campo--largo">
            <label :for="`${idCampo}-inspecao`">{{ t('hotel.checkin.inspecao') }}</label>
            <Textarea
              :id="`${idCampo}-inspecao`"
              v-model="inspecao"
              rows="2"
              auto-resize
              fluid
              :placeholder="t('hotel.checkin.inspecaoDica')"
            />
          </div>
        </div>
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"><i class="ph ph-backpack" /></span>
          {{ t('hotel.checkin.pertences') }}
        </h3>

        <ul class="pertences">
          <li v-for="(item, indice) in pertences" :key="`${item.descricao}-${indice}`">
            <span>{{ item.descricao }}</span>
            <Button
              icon="ph ph-x"
              severity="secondary"
              text
              rounded
              size="small"
              :aria-label="t('hotel.checkin.removerPertence', { item: item.descricao })"
              @click="removerPertence(indice)"
            />
          </li>
        </ul>

        <div class="pertences__novo">
          <InputText
            v-model="novoPertence"
            :placeholder="t('hotel.checkin.novoPertence')"
            :aria-label="t('hotel.checkin.novoPertence')"
            fluid
            @keyup.enter="acrescentarPertence"
          />
          <Button
            icon="ph ph-plus"
            severity="secondary"
            outlined
            :aria-label="t('hotel.checkin.acrescentar')"
            @click="acrescentarPertence"
          />
        </div>
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"><i class="ph ph-bowl-food" /></span>
          {{ t('hotel.checkin.alimentacao') }}
        </h3>

        <div class="grade">
          <div class="campo campo--linha">
            <label :for="`${idCampo}-racao`">{{ t('hotel.checkin.racaoPropria') }}</label>
            <ToggleSwitch :input-id="`${idCampo}-racao`" v-model="racaoPropria" />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-marca`">{{ t('hotel.checkin.marca') }}</label>
            <InputText :id="`${idCampo}-marca`" v-model="marca" fluid />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-porcao`">{{ t('hotel.checkin.porcao') }}</label>
            <InputNumber
              :input-id="`${idCampo}-porcao`"
              v-model="porcao"
              :min="0"
              suffix=" g"
              fluid
            />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-horarios`">{{ t('hotel.checkin.horarios') }}</label>
            <InputText
              :id="`${idCampo}-horarios`"
              v-model="horarios"
              fluid
              placeholder="08:00, 18:00"
            />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-restricoes`">{{ t('hotel.checkin.restricoes') }}</label>
            <InputText :id="`${idCampo}-restricoes`" v-model="restricoes" fluid />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-petiscos`">{{ t('hotel.checkin.petiscos') }}</label>
            <InputText :id="`${idCampo}-petiscos`" v-model="petiscos" fluid />
          </div>
        </div>
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"><i class="ph ph-seal-check" /></span>
          {{ t('hotel.checkin.autorizacoes') }}
        </h3>

        <!--
          Cada autorização é um sim ou não registrado, com data — e não um parágrafo de termo que
          ninguém lê. É a diferença entre "o termo dizia" e "ele marcou não no dia 12".
        -->
        <ul class="autorizacoes">
          <li v-for="kind in AUTORIZACOES" :key="kind">
            <Checkbox :input-id="`${idCampo}-${kind}`" v-model="concedidas" :value="kind" />
            <label :for="`${idCampo}-${kind}`">
              {{ formato.autorizacao(kind) }}
              <!-- O serviço já vendido aparece ao lado: negar aqui é desfazer o que foi cobrado. -->
              <span v-if="exigidasPelaVenda.includes(kind)" class="autorizacoes__vendido">
                {{ t('hotel.checkin.exigidaPelaVenda') }}
              </span>
            </label>
          </li>
        </ul>

        <!--
          A contradição fica escrita, e não trava.
          Quem decide é o responsável, e ele pode muito bem estar desistindo do passeio no balcão —
          o que não pode é a conta seguir cobrando sem ninguém ter percebido.
        -->
        <Message v-if="negadasComServicoVendido.length > 0" severity="warn" :closable="false">
          {{
            t('hotel.checkin.vendaSemAutorizacao', {
              itens: negadasComServicoVendido.map((kind) => formato.autorizacao(kind)).join(', '),
            })
          }}
        </Message>
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"><i class="ph ph-pill" /></span>
          {{ t('hotel.checkin.medicacao') }}
        </h3>

        <p class="bloco__lede">{{ t('hotel.checkin.medicacaoLede') }}</p>

        <ul v-if="medicacoes.length > 0" class="medicacoes">
          <li v-for="(item, indice) in medicacoes" :key="indice" class="medicacao">
            <div class="grade">
              <div class="campo">
                <label :for="`${idCampo}-med-${indice}`">{{ t('hotel.checkin.remedio') }}</label>
                <InputText
                  :id="`${idCampo}-med-${indice}`"
                  v-model="item.descricao"
                  :placeholder="t('hotel.checkin.remedioDica')"
                  fluid
                />
              </div>

              <div class="campo">
                <label :for="`${idCampo}-dose-${indice}`">{{ t('hotel.checkin.dose') }}</label>
                <InputText
                  :id="`${idCampo}-dose-${indice}`"
                  v-model="item.doseTexto"
                  :placeholder="t('hotel.checkin.doseDica')"
                  fluid
                />
              </div>

              <div class="campo">
                <label :for="`${idCampo}-via-${indice}`">{{ t('hotel.checkin.via') }}</label>
                <Select
                  :input-id="`${idCampo}-via-${indice}`"
                  v-model="item.via"
                  :options="VIAS.map((item) => ({ valor: item, rotulo: formato.via(item) }))"
                  option-label="rotulo"
                  option-value="valor"
                  fluid
                />
              </div>

              <div class="campo">
                <label :for="`${idCampo}-medh-${indice}`">{{ t('hotel.checkin.horarios') }}</label>
                <InputText
                  :id="`${idCampo}-medh-${indice}`"
                  v-model="horariosPorMedicacao[indice]"
                  placeholder="08:00, 20:00"
                  fluid
                />
              </div>

              <div class="campo campo--largo">
                <label :for="`${idCampo}-receita-${indice}`">
                  {{ t('hotel.checkin.receita') }}
                </label>
                <InputText
                  :id="`${idCampo}-receita-${indice}`"
                  v-model="item.receita"
                  :placeholder="t('hotel.checkin.receitaDica')"
                  fluid
                />
              </div>
            </div>

            <Button
              icon="ph ph-x"
              severity="secondary"
              text
              rounded
              size="small"
              :aria-label="t('hotel.checkin.removerRemedio')"
              @click="removerMedicacao(indice)"
            />
          </li>
        </ul>

        <Message v-if="medicacaoIncompleta" severity="warn" :closable="false">
          {{ t('hotel.checkin.medicacaoSemHorario') }}
        </Message>

        <Button
          :label="t('hotel.checkin.acrescentarRemedio')"
          icon="ph ph-plus"
          severity="secondary"
          outlined
          size="small"
          class="medicacoes__acao"
          @click="acrescentarMedicacao"
        />
      </section>

      <!--
        Quem pode buscar vem no fim do roteiro, colado à emergência, de propósito: as duas são
        perguntas sobre **gente**, e o responsável responde as duas com o celular na mão, abrindo
        os contatos uma vez só. O que é do animal — peso, pertences, comida, remédio — vem antes,
        enquanto ele ainda está no colo de alguém.
      -->
      <section class="bloco">
        <h3 :id="`${idCampo}-quem`" class="bloco__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"><i class="ph ph-users" /></span>
          {{ t('hotel.checkin.quemBusca', { pet: petNome }) }}
        </h3>

        <p class="bloco__lede">{{ t('hotel.checkin.quemBuscaLede') }}</p>

        <QuemPodeBuscar
          v-model="autorizados"
          v-model:pendente="cadastroPendente"
          :responsavel="{ nome: responsavelNome, telefone: telefoneResponsavel }"
          :conhecidos="contatosConhecidos"
          :aria-labelledby="`${idCampo}-quem`"
        />
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"><i class="ph ph-first-aid-kit" /></span>
          {{ t('hotel.checkin.emergencia') }}
        </h3>

        <div class="grade grade--colunas-fixas">
          <div class="campo">
            <label :for="`${idCampo}-contato`">{{ t('hotel.checkin.contato') }}</label>
            <InputText :id="`${idCampo}-contato`" v-model="contatoEmergencia" fluid />
          </div>
        </div>

        <!--
          O veterinário em três campos, e não numa linha de texto livre. A linha aceitava "Clínica
          do bairro" sem número, e a ficha parecia completa até a madrugada em que alguém precisou
          ligar. Opcional, mas com nome e sem telefone não passa — ver `problemaDoVeterinario`.
        -->
        <fieldset class="vet" :aria-describedby="`${idCampo}-vet-dica`">
          <legend class="vet__titulo">{{ t('hotel.checkin.veterinario') }}</legend>

          <div class="grade">
            <div class="campo">
              <label :for="`${idCampo}-vet-nome`">{{ t('hotel.checkin.vetNome') }}</label>
              <InputText
                :id="`${idCampo}-vet-nome`"
                v-model="veterinario.nome"
                autocomplete="off"
                fluid
              />
            </div>

            <div class="campo">
              <label :for="`${idCampo}-vet-clinica`">{{ t('hotel.checkin.vetClinica') }}</label>
              <InputText
                :id="`${idCampo}-vet-clinica`"
                v-model="veterinario.clinica"
                autocomplete="off"
                fluid
              />
            </div>

            <div class="campo">
              <label :for="`${idCampo}-vet-telefone`">{{ t('hotel.checkin.vetTelefone') }}</label>
              <InputText
                :id="`${idCampo}-vet-telefone`"
                v-model="veterinario.telefone"
                inputmode="tel"
                autocomplete="off"
                :invalid="Boolean(erroDoVet)"
                :aria-describedby="erroDoVet ? `${idCampo}-vet-erro` : undefined"
                fluid
                @blur="telefoneDoVetTocado = true"
              />
              <small v-if="erroDoVet" :id="`${idCampo}-vet-erro`" class="campo__erro" role="alert">
                {{ erroDoVet }}
              </small>
            </div>
          </div>

          <small :id="`${idCampo}-vet-dica`" class="campo__dica">
            {{ vetDaUltimaVez ? t('hotel.checkin.vetDaUltimaVez') : t('hotel.checkin.vetDica') }}
          </small>
        </fieldset>
      </section>

      <Message v-if="erro" severity="error" :closable="false">{{ t(erro) }}</Message>
    </div>

    <template #footer>
      <Button
        :label="t('hotel.comum.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('hotel.checkin.confirmar')"
        icon="ph ph-sign-in"
        :loading="salvando"
        :disabled="!podeConfirmar"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.checkin {
  display: grid;
  gap: 20px;
}

/* Cada bloco é um assunto do balcão: chegada, pertences, alimentação, medicação, autorizações. */
.bloco {
  display: grid;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--linha-suave);
}

.bloco:first-of-type {
  padding-top: 0;
  border-top: none;
}

.bloco__titulo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.bloco__lede {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

/* O grupo do veterinário é um subtítulo dentro da emergência, não uma caixa dentro da seção. */
.vet {
  display: grid;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
}

.vet__titulo {
  margin-block-end: 8px;
  padding: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.grade {
  display: grid;
  gap: 14px 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
}

/*
 * Um campo sozinho numa fileira não estica: com `auto-fit`, o contato de emergência ocuparia a
 * largura do diálogo inteiro para guardar um telefone. Com `auto-fill`, ele fica na primeira
 * coluna, alinhado ao nome do veterinário logo abaixo.
 */
.grade--colunas-fixas {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
}

.campo {
  display: grid;
  /* Linhas no topo: sem isto, o campo ao lado de um mais alto desce e a fileira sai torta. */
  align-content: start;
  gap: 6px;
}

.campo--largo {
  grid-column: 1 / -1;
}

.campo--linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.campo label {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.campo__dica {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
}

.campo__erro {
  color: var(--risco-tinta);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.pertences {
  display: grid;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 12px;
  list-style: none;
}

.pertences li {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 6px 4px 14px;
  color: var(--tinta);
  font-size: 14px;
}

.pertences li + li {
  border-top: 1px solid var(--linha);
}

.pertences__novo {
  display: flex;
  gap: 8px;
}

/*
 * O "+" não encolhe: o campo ao lado ocupa 100% e o flex espremia o botão só-ícone até 34 px de
 * largura por 42 de altura — uma tira com o "+" que parecia fora do lugar.
 */
.pertences__novo > .p-button {
  flex: none;
}

.autorizacoes {
  display: grid;
  gap: 10px 16px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  list-style: none;
}

.autorizacoes li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.autorizacoes label {
  color: var(--tinta);
  font-size: 14px;
}
</style>
