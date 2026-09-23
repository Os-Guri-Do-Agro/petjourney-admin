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

import { useHotelFormat } from '../../composables/useHotelFormat'
import type { AvaliacaoDeAdmissao } from '../../domain/admissao'
import { lerHorarios } from '../../domain/rotina-padrao'
import type {
  Autorizacao,
  AutorizacaoKind,
  PlanoAlimentar,
  ServicoKind,
  ViaDeMedicacao,
} from '../../data/types'

const props = defineProps<{
  aberto: boolean
  petNome: string
  pesoCadastroKg: number | null
  telefoneResponsavel: string
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
      veterinarioDeConfianca: string
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
const veterinario = ref('')

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
  () => !bloqueado.value && (peso.value ?? 0) > 0 && !medicacaoIncompleta.value,
)

watch(
  () => props.aberto,
  (aberto) => {
    if (!aberto) {
      return
    }

    /* O peso do cadastro entra como sugestão, e a balança confirma. Nunca como valor final. */
    peso.value = props.pesoCadastroKg
    inspecao.value = ''
    pertences.value = SUGESTOES.map((descricao) => ({ descricao, quantidade: 1 }))
    novoPertence.value = ''
    contatoEmergencia.value = props.telefoneResponsavel
    veterinario.value = ''
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
    veterinarioDeConfianca: veterinario.value,
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
    class="clinic-scope"
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
        <i class="pi pi-comment" aria-hidden="true" />
        <span>
          <strong>{{ t('hotel.checkin.recadoDaReserva') }}</strong>
          {{ observacaoDaReserva }}
        </span>
      </p>

      <section class="bloco">
        <h3 class="bloco__titulo">{{ t('hotel.checkin.chegada') }}</h3>

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
        <h3 class="bloco__titulo">{{ t('hotel.checkin.pertences') }}</h3>

        <ul class="pertences">
          <li v-for="(item, indice) in pertences" :key="`${item.descricao}-${indice}`">
            <span>{{ item.descricao }}</span>
            <Button
              icon="pi pi-times"
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
            icon="pi pi-plus"
            severity="secondary"
            outlined
            :aria-label="t('hotel.checkin.acrescentar')"
            @click="acrescentarPertence"
          />
        </div>
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">{{ t('hotel.checkin.alimentacao') }}</h3>

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
        <h3 class="bloco__titulo">{{ t('hotel.checkin.autorizacoes') }}</h3>

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
        <h3 class="bloco__titulo">{{ t('hotel.checkin.medicacao') }}</h3>

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
              icon="pi pi-times"
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
          icon="pi pi-plus"
          severity="secondary"
          outlined
          size="small"
          class="medicacoes__acao"
          @click="acrescentarMedicacao"
        />
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">{{ t('hotel.checkin.emergencia') }}</h3>

        <div class="grade">
          <div class="campo">
            <label :for="`${idCampo}-contato`">{{ t('hotel.checkin.contato') }}</label>
            <InputText :id="`${idCampo}-contato`" v-model="contatoEmergencia" fluid />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-vet`">{{ t('hotel.checkin.veterinario') }}</label>
            <InputText :id="`${idCampo}-vet`" v-model="veterinario" fluid />
          </div>
        </div>
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
        icon="pi pi-sign-in"
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
  gap: var(--clinic-space-4);
}

.bloco {
  display: grid;
  gap: var(--clinic-space-3);
  padding-top: var(--clinic-space-3);
  border-top: 1px solid var(--clinic-line-soft);
}

.bloco:first-of-type {
  padding-top: 0;
  border-top: none;
}

.bloco__titulo {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.grade {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.campo {
  display: grid;
  /* Linhas no topo: sem isto, o campo ao lado de um mais alto desce e a fileira sai torta. */
  align-content: start;
  gap: 0.25rem;
}

.campo--largo {
  grid-column: 1 / -1;
}

.campo--linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.campo label {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.campo__dica {
  color: var(--clinic-faint);
  font-size: 0.7rem;
}

.pertences {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pertences li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.15rem 0.6rem;
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface-soft);
  font-size: var(--clinic-font-label);
}

.pertences__novo {
  display: flex;
  gap: var(--clinic-space-2);
}

.autorizacoes {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  list-style: none;
}

.autorizacoes li {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
}

.autorizacoes label {
  font-size: var(--clinic-font-label);
}
</style>
