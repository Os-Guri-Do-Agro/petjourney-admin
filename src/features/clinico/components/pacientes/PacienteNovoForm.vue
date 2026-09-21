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
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'

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
 * Dois títulos iguais empilhados — o do `PartnerPageFrame` e o do formulário — fazem a tela
 * parecer ter sido montada duas vezes. No diálogo não há cabeçalho de página, e o formulário
 * precisa se apresentar.
 */
const mostraTitulo = computed(() => props.modo === 'rapido')

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
  <form class="novo clinic-scope" @submit.prevent="salvar">
    <header v-if="mostraTitulo" class="novo__topo">
      <h3>{{ t('clinico.paciente.novo.titulo') }}</h3>
      <p>{{ t('clinico.paciente.novo.ajuda') }}</p>
    </header>

    <ClinicField :rotulo="t('clinico.paciente.novo.nome')" obrigatorio :erro="erroDe('nome')">
      <template #default="{ id, descrito }">
        <InputText :id="id" v-model="nome" fluid autofocus :aria-describedby="descrito" />
      </template>
    </ClinicField>

    <div class="novo__linha">
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
    </div>

    <div class="novo__linha">
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
    </div>

    <!-- Opcionais e rotulados como tal: campo em branco aqui é resposta honesta. -->
    <div class="novo__linha">
      <ClinicField :rotulo="t('clinico.paciente.novo.nascimento')" :erro="erroDe('nascimento')">
        <template #default="{ id, descrito }">
          <InputText
            :id="id"
            v-model="nascimento"
            type="date"
            fluid
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

    <!--
      O resto da ficha existe só no modo completo — ou seja, só na página.

      Não há sanfona aqui de propósito. Um bloco que abre vinte campos dentro de um diálogo
      resolve a primeira tela e quebra a segunda: o diálogo passa a rolar por dentro e o botão de
      salvar vai junto. Quem precisa do cadastro inteiro vai à página, que rola como página.
    -->
    <template v-if="mostraTudo">
      <section class="bloco">
        <h4 class="clinic-label">{{ t('clinico.paciente.novo.identificacao') }}</h4>

        <!--
          Microchip, pelagem e porte na mesma fileira.

          São as três perguntas curtas da identificação, e `auto-fit` deixa a fileira decidir:
          três colunas quando o diálogo é largo, duas quando o porte não se aplica (gato, ave,
          réptil), uma no celular. Porte sozinho numa linha inteira parecia um campo esquecido.
        -->
        <div class="identificacao">
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
      </section>

      <!--
        Alertas.

        Ficam no cadastro e não numa tela de edição posterior porque é aqui que a informação
        chega: quem entrega o animal no balcão é quem sabe da alergia, e é agora que ele está
        falando. Depois, a alergia vira um bilhete colado no monitor.
      -->
      <section class="bloco">
        <h4 class="clinic-label">{{ t('clinico.paciente.novo.alertas') }}</h4>
        <p class="bloco__ajuda">{{ t('clinico.paciente.novo.alertasAjuda') }}</p>

        <div class="fichas" role="group" :aria-label="t('clinico.paciente.novo.alertas')">
          <Button
            v-for="kind in ALERTAS_DO_CADASTRO"
            :key="kind"
            type="button"
            class="ficha"
            :class="{ 'ficha--ativa': alertaAtivo(kind) }"
            severity="secondary"
            outlined
            rounded
            size="small"
            :icon="alertaAtivo(kind) ? 'pi pi-check' : 'pi pi-plus'"
            :label="formato.alerta(kind)"
            :aria-pressed="alertaAtivo(kind)"
            @click="alternarAlerta(kind)"
          />
        </div>

        <div v-for="alerta in alertas" :key="alerta.kind" class="alerta">
          <div class="alerta__topo">
            <strong>{{ formato.alerta(alerta.kind) }}</strong>
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
            :aria-label="`${formato.alerta(alerta.kind)} — ${dicaDoAlerta(alerta.kind)}`"
          />
        </div>
      </section>
    </template>

    <section class="bloco">
      <h4 class="clinic-label">{{ t('clinico.paciente.responsavel') }}</h4>

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
          <i class="pi pi-check-circle" aria-hidden="true" />
          <span>
            <bdi dir="ltr">{{ responsavelEscolhido.telefone }}</bdi>
            <template v-if="responsavelEscolhido.documento">
              · {{ responsavelEscolhido.documento }}
            </template>
          </span>
        </p>
      </template>

      <template v-else>
        <div class="novo__linha">
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
        -->
        <div v-if="semelhantes.length > 0" class="repetido" role="status">
          <p class="repetido__titulo">
            <i class="pi pi-exclamation-triangle" aria-hidden="true" />
            {{ t('clinico.paciente.novo.semelhanteTitulo') }}
          </p>

          <div v-for="item in semelhantes" :key="item.tutor.id" class="repetido__linha">
            <span class="repetido__quem">
              <strong>{{ item.tutor.nome }}</strong>
              <small><bdi dir="ltr">{{ item.tutor.telefone }}</bdi> · {{ motivoDaSemelhanca(item.motivo) }}</small>
            </span>
            <Button
              size="small"
              severity="secondary"
              outlined
              :label="t('clinico.paciente.novo.usarEste')"
              @click="usarResponsavel(item.tutor.id)"
            />
          </div>
        </div>

        <div class="novo__linha">
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
        </div>

        <template v-if="mostraTudo">
          <div class="novo__linha">
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
          </div>

          <!--
            Endereço.

            Não é dado de cobrança: o receituário de controle especial identifica o comprador por
            nome, documento **e** endereço, e sem ele a farmácia recusa a retenção. Pedi-lo agora
            é o que evita a receita travada no balcão da farmácia meses depois.
          -->
          <p class="bloco__ajuda">{{ t('clinico.paciente.novo.enderecoAjuda') }}</p>

          <div class="endereco endereco--rua">
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

          <div class="novo__linha">
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

          <div class="endereco endereco--cidade">
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
        </template>
      </template>
    </section>

    <p v-if="erro" class="novo__erro">{{ erro }}</p>

    <footer class="novo__rodape">
      <Button
        severity="secondary"
        text
        :label="t('clinico.comum.cancelar')"
        @click="emit('cancelar')"
      />
      <Button
        type="submit"
        :loading="salvando"
        :label="
          modo === 'completo'
            ? t('clinico.paciente.novo.salvarCompleto')
            : t('clinico.paciente.novo.salvar')
        "
      />
    </footer>
  </form>
</template>

<style scoped>
.novo {
  display: grid;
  gap: var(--clinic-space-3);
}

.novo__topo h3 {
  margin: 0;
  color: var(--clinic-text);
  font-size: var(--clinic-font-value);
  font-weight: 750;
}

.novo__topo p {
  margin: 0.15rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.novo__linha {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.bloco {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface-soft);
}

.identificacao {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
}

.bloco__ajuda {
  margin: -0.35rem 0 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.fichas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

/*
 * Ficha de alerta: pílula contornada. A especificidade passa a regra global da clínica para botão
 * secundário contornado, que daria a toda ficha o texto cheio de um botão comum.
 */
.ficha.p-button {
  gap: 0.3rem;
  padding: 0.28rem 0.6rem;
  font-size: var(--clinic-font-label);
}

.ficha.p-button.p-button-secondary.p-button-outlined {
  color: var(--clinic-muted);
}

.ficha.p-button :deep(.p-button-icon) {
  font-size: 0.6rem;
}

/* Escolhido ganha anel, peso e fundo: três sinais, nenhum dependente de enxergar cor. */
.ficha--ativa.p-button.p-button-secondary.p-button-outlined,
.ficha--ativa.p-button.p-button-secondary.p-button-outlined:not(:disabled):hover {
  border-color: var(--clinic-accent-strong);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  box-shadow: inset 0 0 0 1px var(--clinic-accent-strong);
}

.ficha--ativa.p-button :deep(.p-button-label) {
  font-weight: 750;
}

.alerta {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.alerta__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.alerta__topo strong {
  color: var(--clinic-text);
  font-size: var(--clinic-font-label);
}

/*
 * Tom de atenção, e não de risco.
 *
 * Cadastro repetido não impede nada — pode muito bem haver duas pessoas com o mesmo nome, e o
 * telefone da casa é compartilhado por famílias inteiras. O aviso pergunta; quem decide é quem
 * está no balcão. Vermelho aqui gastaria o vermelho que o módulo reserva para alergia e
 * contenção.
 */
.repetido {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-attention-bg);
}

.repetido__titulo {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

.repetido__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.repetido__quem {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
}

.repetido__quem small {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

/*
 * Cada campo do endereço tem largura própria porque o conteúdo tem tamanho conhecido: CEP são
 * oito dígitos e UF são duas letras. Dar a eles a mesma coluna do logradouro faria uma fileira
 * de caixas idênticas onde a forma já dizia o que era cada uma.
 */
.endereco {
  display: grid;
  gap: var(--clinic-space-3);
}

.endereco--rua {
  grid-template-columns: 9rem minmax(0, 1fr) 6rem;
}

.endereco--cidade {
  grid-template-columns: minmax(0, 1fr) 7rem;
}

.escolhido {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: -0.2rem 0 0;
  color: var(--clinic-ok-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.escolhido i {
  font-size: 0.75rem;
}

.opcao {
  display: grid;
  gap: 0.05rem;
}

.opcao small {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.novo__erro {
  margin: 0;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.novo__rodape {
  display: flex;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
}

@media (max-width: 620px) {
  .novo__linha,
  .endereco {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
