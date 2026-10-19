<script setup lang="ts">
/**
 * Cadastro de paciente — um formulário, dois momentos.
 *
 * A clínica cadastra em duas situações que não se parecem em nada:
 *
 * - **No telefone, no meio de um agendamento.** Alguém está na linha esperando o horário. Aqui
 *   vale o mínimo para o atendimento acontecer: nome, espécie e alguém por quem chamar. Pedir
 *   data de nascimento e peso a quem está ligando é convidar a recepção a inventar — e o peso
 *   inventado volta como dose errada, porque o bulário calcula em cima dele.
 * - **No balcão, com a pessoa na frente e o documento na mão.** É a única hora em que a clínica
 *   consegue endereço, CPF e número de microchip sem custo nenhum, e não vai ter outra chance
 *   tão boa. Perder essa janela é o que faz, meses depois, a receita de controle especial
 *   travar na farmácia por falta do endereço do comprador.
 *
 * Os dois usam este componente, e é `modo` que os separa: `rapido` é o formulário curto que
 * cabe num diálogo sem rolagem; `completo` é a ficha inteira, e **mora numa página**. Não é
 * detalhe de layout. Vinte campos dentro de um modal criam uma caixa de rolagem dentro de outra,
 * com o botão de salvar sumindo junto com o resto — e a saída para isso costuma ser um rodapé
 * grudado na mão, que é remendo em cima de uma escolha errada. Formulário longo é página.
 *
 * **O obrigatório é o mesmo nos dois** — nome do paciente e alguém por quem chamar. Um campo a
 * mais no balcão não pode virar um campo a mais no telefone, senão a recepção aprende a
 * preencher qualquer coisa.
 *
 * Duas coisas aqui não são de formulário, e é por isso que valem:
 *
 * - **O cadastro repetido é avisado antes de nascer.** Cliente antigo com bicho novo é o caso
 *   comum; recadastrar a pessoa parte o histórico em dois — as faltas deixam de somar e a
 *   vacina vencida fica no cadastro que ninguém abre. Ao digitar telefone, CPF ou nome que já
 *   existe, a caixa mostra quem é e oferece usar aquele cadastro.
 * - **Alerta clínico entra aqui, não depois.** Alergia medicamentosa é o dado mais caro do
 *   cadastro e, até agora, não havia onde escrevê-lo: o paciente nascia com a lista vazia e
 *   alguém anotava "alérgica a amoxicilina" num campo de observação que o vet não lê antes de
 *   prescrever.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'

import ClinicDateField from '../base/ClinicDateField.vue'
import ClinicField from '../base/ClinicField.vue'
import ClinicToggleGroup, { type TomDaOpcao } from '../base/ClinicToggleGroup.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { patientRepository } from '../../data/repositories'
import type {
  AlertSeverity,
  ContatoPreferido,
  EnderecoPostal,
  ISODate,
  Pet,
  PetAlertKind,
  PetPorte,
  PetSex,
  PetSpecies,
  Tutor,
} from '../../data/types'
import {
  ALERTAS_DO_CADASTRO,
  SEVERIDADE_PADRAO,
  UFS,
  formatarCep,
  formatarCpf,
  formatarTelefone,
  responsaveisSemelhantes,
  somenteDigitos,
  validarCadastro,
  type CampoDoCadastro,
  type MotivoDeSemelhanca,
} from '../../domain/cadastro'
import { ESPECIES_COM_PORTE } from '../../domain/porte'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    /**
     * `rapido` é o balcão no meio do agendamento; `completo` é a ficha inteira.
     *
     * A diferença é só de exposição: o mesmo rascunho, as mesmas regras, o mesmo salvar.
     */
    modo?: 'rapido' | 'completo'
  }>(),
  { modo: 'rapido' },
)

const emit = defineEmits<{
  criado: [pet: Pet]
  cancelar: []
  /**
   * O cadastro como ele ficaria se fosse salvo agora.
   *
   * Sai daqui em vez de a prévia ler o formulário por dentro: assim quem desenha a prévia não
   * precisa saber que existe um `ref` chamado `pelagem`. No diálogo ninguém escuta, e emitir
   * para o vazio não custa nada.
   */
  rascunho: [valor: RascunhoDoPaciente]
}>()

const { t, locale } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const ESPECIES: PetSpecies[] = ['canina', 'felina', 'ave', 'roedor', 'reptil', 'equina']
const PORTES: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']
const CANAIS: ContatoPreferido[] = ['whatsapp', 'ligacao', 'email']

/**
 * O paciente e o responsável como ficariam depois de salvos.
 *
 * São `Pet` e `Tutor` de verdade, com identificadores de mentira, e é de propósito: a prévia
 * monta com eles o **mesmo** `ClinicPatientHeader` que o prontuário usa. Um cartão parecido,
 * desenhado à parte, mentiria no dia em que o cabeçalho de verdade mudasse.
 */
export type RascunhoDoPaciente = {
  pet: Pet
  tutor: Tutor | null
}

/**
 * Duas letras para o avatar, como o repositório as faz.
 *
 * Repetida aqui de propósito: a prévia precisa delas **antes** de o paciente existir, e importar
 * a função do repositório faria um componente de formulário depender da camada de dados só para
 * desenhar um círculo.
 */
function iniciaisDe(valor: string): string {
  const partes = valor.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? ''
  const segunda = partes[1]?.[0] ?? partes[0]?.[1] ?? ''

  return (primeira + segunda).toUpperCase()
}

/** Um alerta em edição. Sem `id`: o identificador é do repositório, não de quem digita. */
type AlertaEmEdicao = {
  kind: PetAlertKind
  severidade: AlertSeverity
  detalhe: string
}

const nome = ref('')
const especie = ref<PetSpecies>('canina')
const raca = ref('')
const sexo = ref<PetSex>('macho')
const nascimento = ref('')
const pesoKg = ref<number | null>(null)
const porte = ref<PetPorte | null>(null)
const castrado = ref(false)
const microchip = ref('')
const pelagem = ref('')
const alertas = ref<AlertaEmEdicao[]>([])

/**
 * Os dois caminhos que o cadastro aceita, e só eles: responsável novo, ou paciente novo ligado a
 * alguém que já está na base.
 *
 * Antes isso morava escondido num seletor cuja primeira opção era "Cadastrar novo responsável" —
 * quem abria a tela via um campo preenchido e não tinha motivo nenhum para desconfiar de que ali
 * dentro havia uma **escolha**. O caso mais comum da clínica é o segundo (cliente antigo com
 * bicho novo), e ele estava atrás de um clique que ninguém sabia dar. Com dois botões à vista,
 * a pergunta é feita em vez de suposta.
 */
const origemResponsavel = ref<'novo' | 'existente'>('novo')
const responsavelExistente = ref<string | null>(null)
const novoNome = ref('')
const novoTelefone = ref('')
const novoTelefoneSecundario = ref('')
const novoDocumento = ref('')
const novoEmail = ref('')
const novoCanal = ref<ContatoPreferido>('whatsapp')
const cep = ref('')
const logradouro = ref('')
const numero = ref('')
const complemento = ref('')
const bairro = ref('')
const cidade = ref('')
const uf = ref<string | null>(null)

/**
 * Quem já apertou "Cadastrar" uma vez vê todos os erros; quem está digitando, nenhum.
 *
 * Acusar erro de CPF na terceira tecla é acusar erro em quem ainda está no meio da frase — e o
 * campo em vermelho durante a digitação inteira ensina a ignorar vermelho.
 */
const tentouSalvar = ref(false)
const salvando = ref(false)
const erro = ref('')

const mostraTudo = computed(() => props.modo === 'completo')

/**
 * Na página, o título é do cabeçalho da página.
 *
 * Dois títulos iguais empilhados — o da `UiPagina` e o do formulário — fazem a tela
 * parecer ter sido montada duas vezes. No diálogo não há cabeçalho de página, e o formulário
 * precisa se apresentar.
 */
const mostraTitulo = computed(() => props.modo === 'rapido')

/** Os títulos das partes, para cada `section` dizer ao leitor de tela qual parte é. */
const idBase = useId()

/** A categoria do alerta, no mesmo ícone que a lista de pacientes usa no selo. */
const ICONE_DO_ALERTA: Record<PetAlertKind, string> = {
  alergia: 'ph ph-warning-diamond',
  agressivo: 'ph ph-hand-palm',
  cronico: 'ph ph-heartbeat',
  'medicacao-continua': 'ph ph-pill',
  imunossuprimido: 'ph ph-shield-warning',
  gestante: 'ph ph-baby',
  inadimplente: 'ph ph-wallet',
}

/** A marca de gravidade na borda do alerta em edição: a mesma régua da lista. */
const MARCA_DA_SEVERIDADE: Record<AlertSeverity, string> = {
  risco: 'ui-marca--risco',
  atencao: 'ui-marca--atencao',
  info: 'ui-marca--neutro',
}

const opcoesEspecie = computed(() =>
  ESPECIES.map((valor) => ({ valor, rotulo: formato.especie(valor) })),
)

const opcoesSexo = computed(() => [
  { valor: 'macho' as PetSex, rotulo: t('clinico.sexo.macho') },
  { valor: 'femea' as PetSex, rotulo: t('clinico.sexo.femea') },
])

/**
 * Pergunta com resposta, e não dois termos para escolher entre si.
 *
 * "Inteiro | Castrado" obriga quem preenche a reconhecer o vocabulário antes de responder — e
 * "inteiro" é palavra de clínica, não de balcão. Como pergunta fechada, a resposta é a mesma que
 * a pessoa acabou de dar em voz alta. O "Sim" vem primeiro, como no resto do módulo.
 */
const opcoesCastrado = computed(() => [
  { valor: true, rotulo: t('clinico.paciente.novo.sim') },
  { valor: false, rotulo: t('clinico.paciente.novo.nao') },
])

const opcoesPorte = computed(() => [
  { valor: null as PetPorte | null, rotulo: t('clinico.paciente.novo.porteNaoInformado') },
  ...PORTES.map((valor) => ({
    valor: valor as PetPorte | null,
    rotulo: t(`clinico.paciente.porte.${valor}`),
  })),
])

const opcoesCanal = computed(() =>
  CANAIS.map((valor) => ({ valor, rotulo: t(`clinico.paciente.novo.canal.${valor}`) })),
)

const opcoesUf = computed(() => UFS.map((sigla) => ({ valor: sigla, rotulo: sigla })))

const opcoesOrigem = computed(() => [
  { valor: 'novo' as const, rotulo: t('clinico.paciente.novo.origem.novo') },
  { valor: 'existente' as const, rotulo: t('clinico.paciente.novo.origem.existente') },
])

const opcoesResponsavel = computed(() =>
  clinico.tutores
    .map((tutor) => ({
      valor: tutor.id as string | null,
      rotulo: tutor.nome,
      detalhe: [tutor.telefone, tutor.documento].filter(Boolean).join(' · '),
    }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, INTL_LOCALE[locale.value as Locale])),
)

const usaResponsavelNovo = computed(() => origemResponsavel.value === 'novo')

const responsavelEscolhido = computed(() =>
  usaResponsavelNovo.value ? null : clinico.tutor(responsavelExistente.value ?? ''),
)

/**
 * Porte só aparece em cão.
 *
 * É o único lugar onde ele muda alguma coisa: a faixa de referência de frequência cardíaca de um
 * yorkshire e a de um são-bernardo não são a mesma. Perguntar o porte de uma calopsita é pedir
 * um dado que nenhuma tela vai ler.
 */
const pedePorte = computed(() => ESPECIES_COM_PORTE.includes(especie.value))

const erros = computed(() =>
  validarCadastro({
    nome: nome.value,
    nascimento: nascimento.value,
    responsavelNovo: usaResponsavelNovo.value,
    responsavelId: responsavelExistente.value ?? '',
    responsavelNome: novoNome.value,
    telefone: novoTelefone.value,
    telefoneSecundario: novoTelefoneSecundario.value,
    documento: novoDocumento.value,
    email: novoEmail.value,
    cep: cep.value,
    hoje: clinicClock.today(),
  }),
)

/** Frase do erro só depois da primeira tentativa — ver `tentouSalvar`. */
function erroDe(campo: CampoDoCadastro): string {
  const kind = tentouSalvar.value ? erros.value.get(campo) : undefined

  return kind ? t(`clinico.paciente.novo.erros.${kind}`) : ''
}

const completo = computed(() => erros.value.size === 0)

/**
 * O que já existe e parece ser esta pessoa.
 *
 * Só faz sentido enquanto se cadastra alguém novo: escolhido um responsável da lista, não há
 * duplicata a evitar.
 */
const semelhantes = computed(() => {
  if (!usaResponsavelNovo.value) {
    return []
  }

  return responsaveisSemelhantes(clinico.tutores, {
    nome: novoNome.value,
    telefone: novoTelefone.value,
    documento: novoDocumento.value,
  })
})

function motivoDaSemelhanca(motivo: MotivoDeSemelhanca): string {
  return t(`clinico.paciente.novo.semelhante.${motivo}`)
}

/** O botão do aviso de repetido: troca de caminho **e** já escolhe quem o aviso apontou. */
function usarResponsavel(tutorId: string) {
  origemResponsavel.value = 'existente'
  responsavelExistente.value = tutorId
}

// ------------------------------------------------------------------ alertas

function alertaAtivo(kind: PetAlertKind): boolean {
  return alertas.value.some((alerta) => alerta.kind === kind)
}

/** Clicar na ficha liga o alerta na gravidade padrão; clicar de novo desliga e apaga o detalhe. */
function alternarAlerta(kind: PetAlertKind) {
  const indice = alertas.value.findIndex((alerta) => alerta.kind === kind)

  if (indice >= 0) {
    alertas.value.splice(indice, 1)

    return
  }

  alertas.value.push({ kind, severidade: SEVERIDADE_PADRAO[kind], detalhe: '' })
}

const opcoesSeveridade = computed(() => [
  {
    valor: 'info' as AlertSeverity,
    rotulo: t('clinico.severidade.info'),
    tom: 'neutro' as TomDaOpcao,
  },
  {
    valor: 'atencao' as AlertSeverity,
    rotulo: t('clinico.severidade.atencao'),
    tom: 'atencao' as TomDaOpcao,
  },
  {
    valor: 'risco' as AlertSeverity,
    rotulo: t('clinico.severidade.risco'),
    tom: 'risco' as TomDaOpcao,
  },
])

/** A dica muda por tipo: "qual princípio ativo" e "qual comorbidade" não são a mesma pergunta. */
function dicaDoAlerta(kind: PetAlertKind): string {
  return t(`clinico.paciente.novo.alertaDica.${kind}`)
}

// ------------------------------------------------------------------ máscaras

watch(novoTelefone, (valor) => {
  novoTelefone.value = formatarTelefone(valor)
})

watch(novoTelefoneSecundario, (valor) => {
  novoTelefoneSecundario.value = formatarTelefone(valor)
})

watch(novoDocumento, (valor) => {
  novoDocumento.value = formatarCpf(valor)
})

watch(cep, (valor) => {
  cep.value = formatarCep(valor)
})

/** Trocar de caminho limpa o rascunho do outro — senão ele volta sozinho ao trocar de novo. */
watch(origemResponsavel, (origem) => {
  if (origem === 'novo') {
    responsavelExistente.value = null

    return
  }

  novoNome.value = ''
  novoTelefone.value = ''
  novoTelefoneSecundario.value = ''
  novoDocumento.value = ''
  novoEmail.value = ''
  cep.value = ''
  logradouro.value = ''
  numero.value = ''
  complemento.value = ''
  bairro.value = ''
  cidade.value = ''
  uf.value = null
})

/** Porte de espécie que não tem porte é dado morto: some junto com a pergunta. */
watch(pedePorte, (pede) => {
  if (!pede) {
    porte.value = null
  }
})

/**
 * O endereço, ou `null` quando ninguém escreveu nada.
 *
 * Guardar `{ cep: '', logradouro: '', ... }` seria dizer que a pessoa mora num endereço em branco.
 * A diferença importa no dia em que a receita de controle especial perguntar se há endereço.
 */
const enderecoRascunho = computed<EnderecoPostal | null>(() => {
  const partes = {
    cep: cep.value.trim(),
    logradouro: logradouro.value.trim(),
    numero: numero.value.trim(),
    complemento: complemento.value.trim(),
    bairro: bairro.value.trim(),
    cidade: cidade.value.trim(),
    uf: uf.value ?? '',
  }

  return Object.values(partes).some(Boolean) ? partes : null
})

/**
 * O cadastro como ficaria salvo — a mesma forma que a prévia desenha e que o repositório grava.
 *
 * Os identificadores são de mentira porque ainda não existem; nada do que a prévia mostra os usa.
 * Montá-lo aqui, e não na prévia, é o que garante que o cartão à direita e o registro que nasce
 * ao apertar "Cadastrar" sejam a mesma coisa.
 */
const rascunho = computed<RascunhoDoPaciente>(() => {
  const escolhido = responsavelEscolhido.value

  const tutor: Tutor | null = usaResponsavelNovo.value
    ? {
        id: 'rascunho-tutor',
        nome: novoNome.value.trim(),
        telefone: novoTelefone.value.trim(),
        telefoneSecundario: novoTelefoneSecundario.value.trim(),
        email: novoEmail.value.trim(),
        documento: novoDocumento.value.trim(),
        preferenciaContato: novoCanal.value,
        endereco: enderecoRascunho.value,
      }
    : escolhido

  const pet: Pet = {
    id: 'rascunho-pet',
    nome: nome.value.trim(),
    especie: especie.value,
    raca: raca.value.trim(),
    sexo: sexo.value,
    nascimento: (nascimento.value || null) as ISODate | null,
    castrado: castrado.value,
    porte: porte.value,
    pesoKg: pesoKg.value,
    microchip: microchip.value,
    pelagem: pelagem.value.trim(),
    tutorId: escolhido?.id ?? 'rascunho-tutor',
    alertas: alertas.value.map((alerta, indice) => ({
      id: `rascunho-alerta-${indice}`,
      kind: alerta.kind,
      severidade: alerta.severidade,
      detalhe: alerta.detalhe.trim(),
    })),
    iniciais: iniciaisDe(nome.value),
    fotoUrl: '',
  }

  return { pet, tutor }
})

watch(rascunho, (valor) => emit('rascunho', valor), { immediate: true, deep: true })

async function salvar() {
  tentouSalvar.value = true

  if (!completo.value || salvando.value) {
    return
  }

  salvando.value = true
  erro.value = ''

  try {
    const { pet } = await patientRepository.criarPaciente({
      nome: nome.value,
      especie: especie.value,
      raca: raca.value,
      sexo: sexo.value,
      nascimento: (nascimento.value || null) as ISODate | null,
      pesoKg: pesoKg.value,
      porte: porte.value,
      castrado: castrado.value,
      microchip: microchip.value,
      pelagem: pelagem.value,
      alertas: alertas.value,
      tutorId: responsavelExistente.value,
      novoTutor: usaResponsavelNovo.value
        ? {
            nome: novoNome.value,
            telefone: novoTelefone.value,
            telefoneSecundario: novoTelefoneSecundario.value,
            documento: novoDocumento.value,
            email: novoEmail.value,
            preferenciaContato: novoCanal.value,
            endereco: enderecoRascunho.value,
          }
        : null,
    })

    /** O catálogo em memória precisa enxergar o paciente novo antes de a agenda o selecionar. */
    await clinico.carregar(true)

    emit('criado', pet)
  } catch {
    erro.value = t('clinico.paciente.novo.erro')
  } finally {
    salvando.value = false
  }
}
</script>


<template>
  <form class="novo clinic-scope" :class="`novo--${modo}`" novalidate @submit.prevent="salvar">
    <header v-if="mostraTitulo" class="novo__topo">
      <h3>{{ t('clinico.paciente.novo.titulo') }}</h3>
      <p>{{ t('clinico.paciente.novo.ajuda') }}</p>
    </header>

    <!-- ============================================================ o pet -->
    <section class="parte" :aria-labelledby="mostraTudo ? `${idBase}-pet` : undefined">
      <header v-if="mostraTudo" class="parte__cabeca">
        <span class="parte__icone" aria-hidden="true"><i class="ph ph-paw-print" /></span>
        <span class="parte__titulos">
          <h2 :id="`${idBase}-pet`" class="parte__titulo">
            {{ t('clinico.paciente.novo.secao.pet.titulo') }}
          </h2>
          <p class="parte__descricao">{{ t('clinico.paciente.novo.secao.pet.descricao') }}</p>
        </span>
      </header>

      <div class="parte__corpo" :class="{ 'ui-folha': mostraTudo }">
        <div class="grade">
          <ClinicField
            :rotulo="t('clinico.paciente.novo.nome')"
            obrigatorio
            largo
            :erro="erroDe('nome')"
          >
            <template #default="{ id, descrito }">
              <InputText :id="id" v-model="nome" fluid autofocus :aria-describedby="descrito" />
            </template>
          </ClinicField>

          <ClinicField :rotulo="t('clinico.pacientes.filtro.especie')">
            <template #default="{ id }">
              <Select
                :input-id="id"
                v-model="especie"
                fluid
                option-label="rotulo"
                option-value="valor"
                :options="opcoesEspecie"
                :pt="{ overlay: { class: 'clinic-overlay' } }"
              />
            </template>
          </ClinicField>

          <ClinicField :rotulo="t('clinico.paciente.novo.raca')">
            <template #default="{ id }">
              <InputText :id="id" v-model="raca" fluid />
            </template>
          </ClinicField>

          <ClinicField :rotulo="t('clinico.paciente.novo.sexo')">
            <ClinicToggleGroup
              v-model="sexo"
              :opcoes="opcoesSexo"
              :rotulo="t('clinico.paciente.novo.sexo')"
            />
          </ClinicField>

          <ClinicField :rotulo="t('clinico.paciente.novo.castrado')">
            <ClinicToggleGroup
              v-model="castrado"
              :opcoes="opcoesCastrado"
              :rotulo="t('clinico.paciente.novo.castrado')"
            />
          </ClinicField>

          <!-- Opcionais e rotulados como tal: campo em branco aqui é resposta honesta. -->
          <ClinicField :rotulo="t('clinico.paciente.novo.nascimento')" :erro="erroDe('nascimento')">
            <template #default="{ id, descrito }">
              <ClinicDateField
                v-model="nascimento"
                :input-id="id"
                :max="clinicClock.today()"
                :aria-describedby="descrito"
              />
            </template>
          </ClinicField>

          <ClinicField
            :rotulo="t('clinico.paciente.novo.peso')"
            :dica="t('clinico.paciente.novo.pesoDica')"
          >
            <template #default="{ id, descrito }">
              <InputNumber
                :input-id="id"
                v-model="pesoKg"
                fluid
                suffix=" kg"
                :min-fraction-digits="1"
                :max-fraction-digits="2"
                :aria-describedby="descrito"
              />
            </template>
          </ClinicField>
        </div>
      </div>
    </section>

    <!--
      O resto da ficha existe só no modo completo — ou seja, só na página.

      Não há sanfona aqui de propósito. Um bloco que abre vinte campos dentro de um diálogo
      resolve a primeira tela e quebra a segunda: o diálogo passa a rolar por dentro e o botão de
      salvar vai junto. Quem precisa do cadastro inteiro vai à página, que rola como página.
    -->
    <template v-if="mostraTudo">
      <!-- ========================================================== identificação -->
      <section class="parte" :aria-labelledby="`${idBase}-identificacao`">
        <header class="parte__cabeca">
          <span class="parte__icone" aria-hidden="true">
            <i class="ph ph-identification-card" />
          </span>
          <span class="parte__titulos">
            <h2 :id="`${idBase}-identificacao`" class="parte__titulo">
              {{ t('clinico.paciente.novo.identificacao') }}
            </h2>
            <p class="parte__descricao">
              {{ t('clinico.paciente.novo.secao.identificacao.descricao') }}
            </p>
          </span>
        </header>

        <!--
          Microchip, pelagem e porte na mesma fileira.

          São as três perguntas curtas da identificação, e `auto-fit` deixa a fileira decidir:
          três colunas quando há largura, duas quando o porte não se aplica (gato, ave, réptil),
          uma no celular. Porte sozinho numa linha inteira parecia um campo esquecido.
        -->
        <div class="parte__corpo ui-folha">
          <div class="grade grade--tres">
            <ClinicField
              :rotulo="t('clinico.paciente.novo.microchip')"
              :dica="t('clinico.paciente.novo.microchipDica')"
            >
              <template #default="{ id, descrito }">
                <InputText
                  :id="id"
                  :model-value="microchip"
                  fluid
                  inputmode="numeric"
                  maxlength="15"
                  class="ui-num"
                  :aria-describedby="descrito"
                  @update:model-value="microchip = somenteDigitos($event ?? '')"
                />
              </template>
            </ClinicField>

            <ClinicField
              :rotulo="t('clinico.paciente.novo.pelagem')"
              :dica="t('clinico.paciente.novo.pelagemDica')"
            >
              <template #default="{ id, descrito }">
                <InputText :id="id" v-model="pelagem" fluid :aria-describedby="descrito" />
              </template>
            </ClinicField>

            <ClinicField
              v-if="pedePorte"
              :rotulo="t('clinico.paciente.novo.porte')"
              :dica="t('clinico.paciente.novo.porteDica')"
            >
              <template #default="{ id, descrito }">
                <Select
                  :input-id="id"
                  v-model="porte"
                  fluid
                  option-label="rotulo"
                  option-value="valor"
                  :options="opcoesPorte"
                  :aria-describedby="descrito"
                  :pt="{ overlay: { class: 'clinic-overlay' } }"
                />
              </template>
            </ClinicField>
          </div>
        </div>
      </section>

      <!--
        Alertas.

        Ficam no cadastro e não numa tela de edição posterior porque é aqui que a informação
        chega: quem entrega o animal no balcão é quem sabe da alergia, e é agora que ele está
        falando. Depois, a alergia vira um bilhete colado no monitor.
      -->
      <section class="parte" :aria-labelledby="`${idBase}-alertas`">
        <header class="parte__cabeca">
          <span class="parte__icone parte__icone--alerta" aria-hidden="true">
            <i class="ph ph-warning-diamond" />
          </span>
          <span class="parte__titulos">
            <h2 :id="`${idBase}-alertas`" class="parte__titulo">
              {{ t('clinico.paciente.novo.alertas') }}
            </h2>
            <p class="parte__descricao">{{ t('clinico.paciente.novo.alertasAjuda') }}</p>
          </span>
        </header>

        <div class="parte__corpo ui-folha">
          <div class="fichas" role="group" :aria-label="t('clinico.paciente.novo.alertas')">
            <button
              v-for="kind in ALERTAS_DO_CADASTRO"
              :key="kind"
              type="button"
              class="ficha"
              :class="{ 'ficha--ativa': alertaAtivo(kind) }"
              :aria-pressed="alertaAtivo(kind)"
              @click="alternarAlerta(kind)"
            >
              <i
                :class="alertaAtivo(kind) ? 'ph ph-check' : ICONE_DO_ALERTA[kind]"
                class="ficha__icone"
                aria-hidden="true"
              />
              <span>{{ formato.alerta(kind) }}</span>
            </button>
          </div>

          <ul v-if="alertas.length > 0" class="alertas">
            <li
              v-for="alerta in alertas"
              :key="alerta.kind"
              class="alerta ui-marca"
              :class="MARCA_DA_SEVERIDADE[alerta.severidade]"
            >
              <div class="alerta__topo">
                <strong class="alerta__nome">
                  <i :class="ICONE_DO_ALERTA[alerta.kind]" aria-hidden="true" />
                  {{ formato.alerta(alerta.kind) }}
                </strong>
                <ClinicToggleGroup
                  v-model="alerta.severidade"
                  :opcoes="opcoesSeveridade"
                  :rotulo="t('clinico.paciente.novo.gravidade')"
                />
              </div>

              <InputText
                v-model="alerta.detalhe"
                fluid
                :placeholder="dicaDoAlerta(alerta.kind)"
                :aria-label="`${formato.alerta(alerta.kind)}: ${dicaDoAlerta(alerta.kind)}`"
              />
            </li>
          </ul>
        </div>
      </section>
    </template>

    <!-- ============================================================ responsável -->
    <section class="parte" :aria-labelledby="`${idBase}-responsavel`">
      <header class="parte__cabeca">
        <span v-if="mostraTudo" class="parte__icone" aria-hidden="true">
          <i class="ph ph-user" />
        </span>
        <span class="parte__titulos">
          <component
            :is="mostraTudo ? 'h2' : 'h4'"
            :id="`${idBase}-responsavel`"
            class="parte__titulo"
          >
            {{ t('clinico.paciente.responsavel') }}
          </component>
          <p v-if="mostraTudo" class="parte__descricao">
            {{ t('clinico.paciente.novo.secao.responsavel.descricao') }}
          </p>
        </span>
      </header>

      <div class="parte__corpo" :class="{ 'ui-folha': mostraTudo }">
        <!--
          Os dois caminhos que o cadastro aceita, e só eles.

          Antes a escolha morava dentro do próprio seletor, cuja primeira opção era "Cadastrar novo
          responsável": quem abria a tela via um campo já preenchido e não tinha por que desconfiar
          de que ali havia uma decisão a tomar. O caso mais comum da clínica — cliente antigo com
          bicho novo — ficava atrás de um clique que ninguém sabia dar, e o resultado era a mesma
          pessoa cadastrada duas vezes.
        -->
        <ClinicToggleGroup
          v-model="origemResponsavel"
          class="origem"
          :opcoes="opcoesOrigem"
          :rotulo="t('clinico.paciente.responsavel')"
        />

        <template v-if="!usaResponsavelNovo">
          <ClinicField
            :rotulo="t('clinico.paciente.novo.quemResponde')"
            obrigatorio
            :erro="erroDe('responsavelEscolhido')"
          >
            <template #default="{ id, descrito }">
              <Select
                :input-id="id"
                v-model="responsavelExistente"
                filter
                fluid
                option-label="rotulo"
                option-value="valor"
                :options="opcoesResponsavel"
                :filter-placeholder="t('clinico.paciente.novo.buscarResponsavel')"
                :placeholder="t('clinico.paciente.novo.escolhaResponsavel')"
                :aria-describedby="descrito"
                :pt="{ overlay: { class: 'clinic-overlay' } }"
              >
                <template #option="{ option }">
                  <span class="opcao">
                    <strong>{{ option.rotulo }}</strong>
                    <small v-if="option.detalhe">{{ option.detalhe }}</small>
                  </span>
                </template>
              </Select>
            </template>
          </ClinicField>

          <!--
            O que já se sabe da pessoa escolhida.

            Sem isto, "Ana Paula Souza" escolhida numa lista de sessenta nomes é um nome e nenhuma
            confirmação de que é a Ana Paula certa. O telefone é o que quem está no balcão consegue
            conferir em voz alta.
          -->
          <p v-if="responsavelEscolhido" class="escolhido">
            <i class="ph ph-check-circle" aria-hidden="true" />
            <span class="escolhido__nome">{{ responsavelEscolhido.nome }}</span>
            <span class="escolhido__dados ui-num">
              <bdi dir="ltr">{{ responsavelEscolhido.telefone }}</bdi>
              <template v-if="responsavelEscolhido.documento">
                · {{ responsavelEscolhido.documento }}
              </template>
            </span>
          </p>
        </template>

        <template v-else>
          <div class="grade">
            <ClinicField
              :rotulo="t('clinico.paciente.novo.nomeResponsavel')"
              obrigatorio
              :erro="erroDe('responsavelNome')"
            >
              <template #default="{ id, descrito }">
                <InputText :id="id" v-model="novoNome" fluid :aria-describedby="descrito" />
              </template>
            </ClinicField>

            <ClinicField
              :rotulo="t('clinico.paciente.novo.telefone')"
              obrigatorio
              :erro="erroDe('telefone')"
            >
              <template #default="{ id, descrito }">
                <InputText
                  :id="id"
                  v-model="novoTelefone"
                  fluid
                  inputmode="tel"
                  placeholder="(11) 90000-0000"
                  :aria-describedby="descrito"
                />
              </template>
            </ClinicField>
          </div>

          <!--
            Quem já existe e parece ser esta pessoa.

            Aparece **enquanto** se digita, e não ao salvar: descobrir a duplicata depois de
            apertar o botão significa já ter dois cadastros e precisar de alguém para fundi-los.
            Tom de atenção, e não de risco: cadastro repetido não impede nada — duas pessoas
            podem ter o mesmo nome, e o telefone da casa é de uma família inteira.
          -->
          <div v-if="semelhantes.length > 0" class="repetido" role="status">
            <p class="repetido__titulo">
              <i class="ph ph-users-three" aria-hidden="true" />
              {{ t('clinico.paciente.novo.semelhanteTitulo') }}
            </p>

            <ul class="repetido__lista">
              <li v-for="item in semelhantes" :key="item.tutor.id" class="repetido__linha">
                <span class="repetido__quem">
                  <strong>{{ item.tutor.nome }}</strong>
                  <small>
                    <bdi dir="ltr" class="ui-num">{{ item.tutor.telefone }}</bdi>
                    <span class="repetido__motivo">{{ motivoDaSemelhanca(item.motivo) }}</span>
                  </small>
                </span>
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="ph ph-check"
                  :label="t('clinico.paciente.novo.usarEste')"
                  @click="usarResponsavel(item.tutor.id)"
                />
              </li>
            </ul>
          </div>

          <div class="grade">
            <ClinicField :rotulo="t('clinico.paciente.novo.documento')" :erro="erroDe('documento')">
              <template #default="{ id, descrito }">
                <InputText
                  :id="id"
                  v-model="novoDocumento"
                  fluid
                  inputmode="numeric"
                  placeholder="000.000.000-00"
                  :aria-describedby="descrito"
                />
              </template>
            </ClinicField>

            <ClinicField :rotulo="t('clinico.paciente.novo.email')" :erro="erroDe('email')">
              <template #default="{ id, descrito }">
                <InputText
                  :id="id"
                  v-model="novoEmail"
                  fluid
                  inputmode="email"
                  :aria-describedby="descrito"
                />
              </template>
            </ClinicField>

            <template v-if="mostraTudo">
              <ClinicField
                :rotulo="t('clinico.paciente.novo.telefoneSecundario')"
                :dica="t('clinico.paciente.novo.telefoneSecundarioDica')"
                :erro="erroDe('telefoneSecundario')"
              >
                <template #default="{ id, descrito }">
                  <InputText
                    :id="id"
                    v-model="novoTelefoneSecundario"
                    fluid
                    inputmode="tel"
                    :aria-describedby="descrito"
                  />
                </template>
              </ClinicField>

              <ClinicField
                :rotulo="t('clinico.paciente.novo.canalPreferido')"
                :dica="t('clinico.paciente.novo.canalDica')"
              >
                <ClinicToggleGroup
                  v-model="novoCanal"
                  :opcoes="opcoesCanal"
                  :rotulo="t('clinico.paciente.novo.canalPreferido')"
                />
              </ClinicField>
            </template>
          </div>

          <!--
            Endereço.

            Não é dado de cobrança: o receituário de controle especial identifica o comprador por
            nome, documento **e** endereço, e sem ele a farmácia recusa a retenção. Pedi-lo agora
            é o que evita a receita travada no balcão da farmácia meses depois.

            Cada campo tem largura própria porque o conteúdo tem tamanho conhecido: CEP são oito
            dígitos e UF são duas letras.
          -->
          <div
            v-if="mostraTudo"
            class="endereco"
            role="group"
            :aria-labelledby="`${idBase}-endereco`"
          >
            <p :id="`${idBase}-endereco`" class="endereco__titulo">
              <i class="ph ph-map-pin" aria-hidden="true" />
              {{ t('clinico.paciente.novo.enderecoCurto') }}
            </p>
            <p class="endereco__ajuda">{{ t('clinico.paciente.novo.enderecoDica') }}</p>

            <div class="grade grade--rua">
              <ClinicField :rotulo="t('clinico.paciente.novo.cep')" :erro="erroDe('cep')">
                <template #default="{ id, descrito }">
                  <InputText
                    :id="id"
                    v-model="cep"
                    fluid
                    inputmode="numeric"
                    placeholder="00000-000"
                    :aria-describedby="descrito"
                  />
                </template>
              </ClinicField>

              <ClinicField :rotulo="t('clinico.paciente.novo.logradouro')">
                <template #default="{ id }">
                  <InputText :id="id" v-model="logradouro" fluid />
                </template>
              </ClinicField>

              <ClinicField :rotulo="t('clinico.paciente.novo.numero')">
                <template #default="{ id }">
                  <InputText :id="id" v-model="numero" fluid inputmode="numeric" />
                </template>
              </ClinicField>
            </div>

            <div class="grade">
              <ClinicField :rotulo="t('clinico.paciente.novo.complemento')">
                <template #default="{ id }">
                  <InputText :id="id" v-model="complemento" fluid />
                </template>
              </ClinicField>

              <ClinicField :rotulo="t('clinico.paciente.novo.bairro')">
                <template #default="{ id }">
                  <InputText :id="id" v-model="bairro" fluid />
                </template>
              </ClinicField>
            </div>

            <div class="grade grade--cidade">
              <ClinicField :rotulo="t('clinico.paciente.novo.cidade')">
                <template #default="{ id }">
                  <InputText :id="id" v-model="cidade" fluid />
                </template>
              </ClinicField>

              <ClinicField :rotulo="t('clinico.paciente.novo.uf')">
                <template #default="{ id }">
                  <Select
                    :input-id="id"
                    v-model="uf"
                    fluid
                    filter
                    option-label="rotulo"
                    option-value="valor"
                    :options="opcoesUf"
                    :pt="{ overlay: { class: 'clinic-overlay' } }"
                  />
                </template>
              </ClinicField>
            </div>
          </div>
        </template>
      </div>
    </section>

    <p v-if="erro" class="novo__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      {{ erro }}
    </p>

    <footer class="novo__rodape">
      <p v-if="mostraTudo" class="novo__obrigatorios">
        <span class="novo__asterisco" aria-hidden="true">*</span>
        {{ t('clinico.paciente.novo.obrigatorios') }}
      </p>
      <div class="novo__botoes">
        <Button
          type="button"
          severity="secondary"
          text
          :label="t('clinico.comum.cancelar')"
          @click="emit('cancelar')"
        />
        <Button
          type="submit"
          icon="ph ph-check"
          :loading="salvando"
          :label="
            modo === 'completo'
              ? t('clinico.paciente.novo.salvarCompleto')
              : t('clinico.paciente.novo.salvar')
          "
        />
      </div>
    </footer>
  </form>
</template>

<style scoped>
/*
 * Botões secundários (contorno e texto) nas cores do Trilha: o formulário aparece na página e
 * dentro dos diálogos da agenda, e nos dois o cinza do preset parecia botão desabilitado no escuro.
 */
.novo {
  --p-button-outlined-secondary-border-color: var(--linha-forte);
  --p-button-outlined-secondary-color: var(--tinta);
  --p-button-outlined-secondary-hover-background: var(--superficie-2);
  --p-button-outlined-secondary-active-background: var(--superficie-3);
  --p-button-text-secondary-color: var(--tinta-2);
  --p-button-text-secondary-hover-background: var(--superficie-2);
  --p-button-text-secondary-active-background: var(--superficie-3);

  display: grid;
  min-width: 0;
  gap: 18px;
  color: var(--tinta);
}

.novo--completo {
  gap: 28px;
}

/* Caixa de texto e seletor com a mesma altura: lado a lado, "Espécie" e "Raça" são um par. */
.novo :deep(.p-inputtext),
.novo :deep(.p-select) {
  min-height: 42px;
}

.novo :deep(.p-select) {
  align-items: center;
}

.novo__topo h3 {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.novo__topo p {
  margin: 3px 0 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

/* --------------------------------------------------------------------------------- as partes */

.parte {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.parte__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
}

.parte__icone {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 18px;
}

.parte__icone--alerta {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.parte__titulos {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.parte__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.parte__descricao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.parte__corpo {
  display: grid;
  min-width: 0;
  gap: 16px;
}

.parte__corpo.ui-folha {
  padding: 20px 22px 22px;
}

/* No diálogo, o responsável é separado do animal por um fio, sem folha dentro da folha. */
.novo--rapido .parte + .parte {
  padding-top: 16px;
  border-top: 1px solid var(--linha);
}

.novo--rapido .parte__titulo {
  font-size: 15px;
}

/* ---------------------------------------------------------------------------------- a grade */

.grade {
  display: grid;
  gap: 16px 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.grade--tres {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
}

.grade--rua {
  grid-template-columns: 9rem minmax(0, 1fr) 6.5rem;
}

.grade--cidade {
  grid-template-columns: minmax(0, 1fr) 7.5rem;
}

.origem {
  justify-self: start;
}

/* --------------------------------------------------------------------------------- alertas */

.fichas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/*
 * Ficha de alerta: um botão de alternar do tamanho da palavra, com o ícone da categoria. Marcada,
 * ganha o fundo de musgo e o visto no lugar do ícone — forma, fundo e peso, três sinais além da cor.
 */
.ficha {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 7px;
  padding: 0 13px 0 11px;
  border: 1px solid var(--linha-forte);
  border-radius: 10px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.2;
  transition:
    background-color var(--pj-tempo-curto, 140ms) ease,
    border-color var(--pj-tempo-curto, 140ms) ease;
}

.ficha:hover {
  border-color: var(--tinta-3);
  background: var(--superficie-2);
}

.ficha:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.ficha__icone {
  color: var(--tinta-2);
  font-size: 16px;
}

.ficha--ativa,
.ficha--ativa:hover {
  border-color: color-mix(in oklab, var(--musgo) 55%, var(--linha));
  background: var(--musgo-fundo);
  color: var(--musgo);
  font-weight: 600;
}

.ficha--ativa .ficha__icone {
  color: inherit;
}

.alertas {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--linha);
  list-style: none;
}

.alerta {
  position: relative;
  display: grid;
  gap: 10px;
  padding: 14px 0 14px 16px;
}

.alerta + .alerta {
  border-top: 1px solid var(--linha);
}

.alerta__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.alerta__nome {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.alerta__nome i {
  color: var(--tinta-2);
  font-size: 17px;
}

.alerta.ui-marca--risco .alerta__nome i {
  color: var(--risco-tinta);
}

.alerta.ui-marca--atencao .alerta__nome i {
  color: var(--atencao-tinta);
}

/* ----------------------------------------------------------------------------- responsável */

/*
 * Cadastro repetido em tom de atenção, e não de risco: o aviso pergunta, quem decide é quem está
 * no balcão. Vermelho aqui gastaria o vermelho que o módulo reserva para alergia e contenção.
 */
.repetido {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid color-mix(in oklab, var(--atencao) 35%, transparent);
  border-radius: 12px;
  background: var(--atencao-fundo);
}

.repetido__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--atencao-tinta);
  font-size: 14px;
  font-weight: 600;
}

.repetido__titulo i {
  font-size: 18px;
}

.repetido__lista {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.repetido__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 10px 10px 10px 14px;
  border-radius: 10px;
  background: var(--superficie);
}

.repetido__quem {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.repetido__quem strong {
  font-size: 14px;
  font-weight: 600;
}

.repetido__quem small {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  color: var(--tinta-2);
  font-size: 13px;
}

.repetido__motivo {
  color: var(--atencao-tinta);
  font-weight: 550;
}

.repetido__linha :deep(.p-button) {
  min-height: 36px;
}

.escolhido {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: -4px 0 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 13.5px;
}

.escolhido i {
  font-size: 17px;
}

.escolhido__nome {
  font-weight: 600;
}

.escolhido__dados {
  color: var(--tinta-2);
}

.opcao {
  display: grid;
  gap: 1px;
}

.opcao small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.endereco {
  display: grid;
  min-width: 0;
  gap: 14px;
  margin-top: 4px;
  padding-top: 18px;
  border-top: 1px solid var(--linha);
}

.endereco__titulo {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  padding: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.endereco__titulo i {
  color: var(--tinta-2);
  font-size: 17px;
}

.endereco__ajuda {
  margin: -8px 0 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

/* -------------------------------------------------------------------------------- o rodapé */

.novo__erro {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 550;
}

.novo__rodape {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px 16px;
}

.novo--completo .novo__rodape {
  justify-content: space-between;
  padding-top: 4px;
}

.novo__obrigatorios {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.novo__asterisco {
  color: var(--risco-tinta);
  font-weight: 600;
}

.novo__botoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-inline-start: auto;
}

.novo--completo .novo__botoes :deep(.p-button) {
  min-height: 42px;
}

@media (prefers-reduced-motion: reduce) {
  .ficha {
    transition: none;
  }
}

@media (max-width: 620px) {
  .grade,
  .grade--rua,
  .grade--cidade {
    grid-template-columns: minmax(0, 1fr);
  }

  .parte__corpo.ui-folha {
    padding: 16px;
  }
}
</style>
