<script setup lang="ts">
/**
 * Registrar atendimento em campo: o mesmo registro no Consultório Móvel do piloto com a Subea
 * (Ofício 002/2026) e no ponto de uma campanha (`campanha`), "em cerca de 1 minuto", numa gaveta em
 * quatro passos (17/11/2026, "cadastro detalhado como no módulo clínico" e "a equipe da campanha
 * registrar os dados").
 * 1. **Quem leva**: a busca de quem já foi atendido (CPF, telefone ou nome) preenche tudo; senão o
 *    tutor ou a ONG, com os campos do responsável do módulo clínico (`ClienteCampos`: telefone, CPF
 *    opcional, endereço pelo CEP). O CEP diz o bairro oficial e a região, que vão para o relatório;
 *    sem o CEP na tabela, vale o bairro do ViaCEP ou a escolha à mão. O aceite dos avisos (LGPD).
 * 2. **O animal**: um dos pets do responsável, ou o cadastro do paciente do módulo clínico
 *    (`PacienteCampos`), com os detalhes opcionais recolhidos. O programa atende cães e gatos.
 * 3. **O que foi feito**: o que a equipe fez ou tentou (na campanha, o dela já vem marcado), cada
 *    um "Feito" ou "Não deu" com o motivo num toque.
 * 4. **QR Code**: o QR que o tutor leva, a etiqueta e a ficha no celular, só com o que foi feito.
 *    Nada feito: sem QR, o resumo do que não deu.
 *
 * O relógio corre desde que a gaveta abre: é a prova do "1 minuto" na frente de quem decide. Nada é
 * enviado: é protótipo, e o QR abre o site da PetJourney.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import {
  camposVazios,
  clienteVazio,
  validarCliente,
  validarPaciente,
  type CamposDoCliente,
  type CamposDoPaciente,
  type ErrosDoCliente,
  type ErrosDoPaciente,
} from '@/components/cadastro/campos'
import ClienteCampos from '@/components/cadastro/ClienteCampos.vue'
import PacienteCampos from '@/components/cadastro/PacienteCampos.vue'
import { imagemDoQr } from '@/components/parceiro/estabelecimento/qr-da-pagina'
import {
  BAIRROS_EM_ORDEM,
  buscarResponsaveis,
  iniciaisDe,
  lugarDoEndereco,
  regiaoDoBairro,
  useCampo,
  type Lugar,
  type ResponsavelDoCampo,
} from '@/features/saude-publica/campo'
import EtiquetaDoAtendimento from '@/features/saude-publica/components/EtiquetaDoAtendimento.vue'
import FichaNoCelular from '@/features/saude-publica/components/FichaNoCelular.vue'
import ResultadoDosProcedimentos from '@/features/saude-publica/components/ResultadoDosProcedimentos.vue'
import {
  dataCurta,
  PERIODO,
  PROCEDIMENTO_DA_CAMPANHA,
  PROCEDIMENTOS,
  procedimento,
  proximosCuidados,
  regiao as regiaoDe,
  tipoDeCampanha,
  type Campanha,
  type Procedimento,
  type ResultadoDoProcedimento,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo, type QuemLeva } from '@/features/saude-publica/estado'
import { faltasDoResultado, textoDoMotivo } from '@/features/saude-publica/resultado'
import { SITE_PUBLICO } from '@/utils/parceiro/pagina-publica'
import { formatCnpj, isValidCnpj, stripCnpj } from '@/utils/validation/cnpj'
import { isValidCpf, stripCpf } from '@/utils/validation/cpf'

const props = defineProps<{
  /** A campanha em que a equipe registra; sem ela, é o Consultório Móvel do piloto. */
  campanha?: Campanha | null
}>()
const aberta = defineModel<boolean>('visible', { default: false })
/** O atendimento entrou na lista: a tela abre ele. */
const emit = defineEmits<{ registrado: [id: string] }>()

const { t } = useI18n()
const toast = useToast()
const { registrarAtendimento } = useEstadoDoPrototipo()
const campo = useCampo()

const QUEM_LEVA: { id: QuemLeva; rotulo: string; icone: string }[] = [
  { id: 'tutor', rotulo: 'Tutor', icone: 'ph ph-user' },
  { id: 'ong', rotulo: 'ONG', icone: 'ph ph-hand-heart' },
]

const passo = ref(0)
const formulario = ref<HTMLFormElement | null>(null)
const tentou = ref(false)
const qr = ref('')
const abertaEm = ref(0)
const levou = ref('')

/** A data do atendimento: o dia da campanha, ou hoje no piloto. */
const dataDoAtendimento = computed(() => props.campanha?.data ?? PERIODO.hoje)

/* ------------------------------------------------------------------- 1. quem leva o animal */

const busca = ref('')
/** O responsável achado na busca; `null` é um cadastro novo. */
const escolhidoId = ref<string | null>(null)
const editandoCadastro = ref(false)
const quem = ref<QuemLeva>('tutor')
const ong = ref('')
const cnpj = ref('')
const cliente = ref<CamposDoCliente>(clienteNovo())
const errosDoCliente = ref<ErrosDoCliente>({})
const conferirCnpj = ref(false)
/** O bairro oficial escolhido à mão: vale por cima do que o CEP e o ViaCEP dizem. */
const bairroEscolhido = ref<string | null>(null)
const corrigindoBairro = ref(false)
const aceite = ref(false)

function clienteNovo(): CamposDoCliente {
  return { ...clienteVazio(), cidade: 'Campo Grande', uf: 'MS' }
}

const deOng = computed(() => quem.value === 'ong')
const escolhido = computed(() => campo.responsavel(escolhidoId.value ?? undefined))
/** Os campos aparecem no cadastro novo e ao editar o de quem já veio. */
const mostraCampos = computed(() => !escolhidoId.value || editandoCadastro.value)

const encontrados = computed(() =>
  escolhidoId.value
    ? []
    : buscarResponsaveis(busca.value).map((item) => ({
        item,
        pets: campo
          .petsDo(item.id)
          .map((pet) => pet.campos.nome)
          .join(', '),
      })),
)
const buscou = computed(
  () => busca.value.replace(/\D/g, '').length >= 4 || busca.value.trim().length >= 3,
)

function copiaDe<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

function escolher(item: ResponsavelDoCampo) {
  escolhidoId.value = item.id
  editandoCadastro.value = false
  quem.value = item.quem
  ong.value = item.ong
  cnpj.value = formatCnpj(item.cnpj)
  cliente.value = copiaDe(item.campos)
  bairroEscolhido.value = item.lugar.como === 'escolhido' ? item.lugar.bairro : null
  corrigindoBairro.value = false
  /* O aceite foi dado no primeiro atendimento; fica marcado, e dá para desmarcar. */
  aceite.value = true
  errosDoCliente.value = {}
  escolhaDoPet.value = null
  paciente.value = camposVazios()
  editandoPet.value = false
}

function trocarResponsavel() {
  escolhidoId.value = null
  editandoCadastro.value = false
  busca.value = ''
  quem.value = 'tutor'
  ong.value = ''
  cnpj.value = ''
  cliente.value = clienteNovo()
  bairroEscolhido.value = null
  aceite.value = false
  errosDoCliente.value = {}
  escolhaDoPet.value = null
  paciente.value = camposVazios()
  editandoPet.value = false
}

/* Um CEP novo desfaz a escolha à mão: o bairro volta a sair dele. Síncrono, para a escolha que
 * vem junto do cadastro achado na busca não ser apagada logo depois. */
watch(
  () => cliente.value.cep,
  (agora, antes) => {
    if (agora.replace(/\D/g, '') === (antes ?? '').replace(/\D/g, '')) return
    bairroEscolhido.value = null
    corrigindoBairro.value = false
  },
  { flush: 'sync' },
)

watch(bairroEscolhido, (valor) => {
  if (valor) corrigindoBairro.value = false
})

const lugarPeloEndereco = computed(() => lugarDoEndereco(cliente.value.cep, cliente.value.bairro))

const lugar = computed<Lugar>(() =>
  bairroEscolhido.value
    ? {
        cep: lugarPeloEndereco.value.cep,
        bairro: bairroEscolhido.value,
        regiao: regiaoDoBairro(bairroEscolhido.value),
        como: 'escolhido',
      }
    : lugarPeloEndereco.value,
)

const COMO_ACHOU = { cep: 'pelo CEP', nome: 'pelo nome do bairro', escolhido: 'escolhido à mão' }

const cepCompleto = computed(() => cliente.value.cep.replace(/\D/g, '').length === 8)

function escolherQuem(id: QuemLeva) {
  quem.value = id
  conferirCnpj.value = false
}

const erroNoCnpj = computed(() =>
  deOng.value && stripCnpj(cnpj.value) && !isValidCnpj(cnpj.value)
    ? 'Este CNPJ não confere. Corrija ou deixe em branco.'
    : '',
)

function escreverCnpj(valor: string | undefined) {
  cnpj.value = formatCnpj(valor ?? '')
}

/** Os erros do responsável, embaixo de cada campo do `ClienteCampos`. */
function errosDoResponsavel(): ErrosDoCliente {
  const erros: ErrosDoCliente = validarCliente(cliente.value, t)
  if (cliente.value.telefone.replace(/\D/g, '').length < 10) {
    erros.telefone = 'Diga o celular com DDD: é por ele que chegam os avisos.'
  }
  if (stripCpf(cliente.value.cpf) && !isValidCpf(cliente.value.cpf)) {
    erros.cpf = 'Este CPF não confere. Corrija ou deixe em branco.'
  }
  return erros
}

watch(
  cliente,
  () => {
    if (tentou.value && mostraCampos.value) errosDoCliente.value = errosDoResponsavel()
  },
  { deep: true },
)

/* -------------------------------------------------------------------------- 2. o animal */

/** O pet escolhido entre os do responsável, `'novo'` para cadastrar, `null` ainda sem escolha. */
const escolhaDoPet = ref<string | 'novo' | null>(null)
const paciente = ref<CamposDoPaciente>(camposVazios())
const errosDoPaciente = ref<ErrosDoPaciente>({})
const maisDetalhes = ref(false)
const editandoPet = ref(false)

const petsDoResponsavel = computed(() => (escolhidoId.value ? campo.petsDo(escolhidoId.value) : []))
const mostraCamposDoPet = computed(
  () => escolhaDoPet.value === 'novo' || (Boolean(escolhaDoPet.value) && editandoPet.value),
)

const ROTULO_DA_ESPECIE: Record<string, string> = { CACHORRO: 'Cachorro', GATO: 'Gato' }

function sobreOPet(campos: CamposDoPaciente) {
  return [
    ROTULO_DA_ESPECIE[campos.especie ?? ''] ?? 'Outra espécie',
    campos.raca,
    campos.sexo === 'MACHO' ? 'macho' : campos.sexo === 'FEMEA' ? 'fêmea' : '',
    campos.castrado === true ? 'castrado' : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function escolherPet(id: string | 'novo') {
  escolhaDoPet.value = id
  editandoPet.value = false
  errosDoPaciente.value = {}
  const existente = id === 'novo' ? null : campo.pet(id)
  paciente.value = existente ? copiaDe(existente.campos) : camposVazios()
  if (id === 'novo') {
    void nextTick(() => document.getElementById('rat-pet-nome')?.focus())
  }
}

function errosDoAnimal(): ErrosDoPaciente {
  const erros = validarPaciente(paciente.value, t)
  if (
    !erros.especie &&
    paciente.value.especie !== 'CACHORRO' &&
    paciente.value.especie !== 'GATO'
  ) {
    erros.especie = 'O programa da Subea atende cães e gatos: escolha Cachorro ou Gato.'
  }
  return erros
}

watch(
  paciente,
  () => {
    if (tentou.value && passo.value === 1) errosDoPaciente.value = errosDoAnimal()
  },
  { deep: true },
)

/* ------------------------------------------------------------------ 3. o que foi feito */

const resultados = ref<ResultadoDoProcedimento[]>([])

/** Na ordem da lista, para a ficha e o relatório saírem iguais não importa a ordem do toque. */
function marcar(id: Procedimento) {
  const marcado = resultados.value.some((item) => item.procedimento === id)
  const lista = marcado
    ? resultados.value.filter((item) => item.procedimento !== id)
    : [...resultados.value, { procedimento: id, feito: true }]
  const ordem = PROCEDIMENTOS.map((item) => item.id)
  resultados.value = lista.sort(
    (um, outro) => ordem.indexOf(um.procedimento) - ordem.indexOf(outro.procedimento),
  )
}

const marcados = computed(() => resultados.value.map((item) => item.procedimento))
const feitos = computed(() =>
  resultados.value.filter((item) => item.feito).map((item) => item.procedimento),
)
const naoDeram = computed(() => resultados.value.filter((item) => !item.feito))
const cuidados = computed(() => proximosCuidados(dataDoAtendimento.value, feitos.value))

const procedimentoDaCampanha = computed(() =>
  props.campanha ? PROCEDIMENTO_DA_CAMPANHA[props.campanha.tipo] : null,
)

/* ------------------------------------------------------------------------- os passos */

watch(aberta, (agora) => {
  if (!agora) return
  passo.value = 0
  tentou.value = false
  levou.value = ''
  trocarResponsavel()
  paciente.value = camposVazios()
  errosDoPaciente.value = {}
  maisDetalhes.value = false
  editandoPet.value = false
  resultados.value = procedimentoDaCampanha.value
    ? [{ procedimento: procedimentoDaCampanha.value, feito: true }]
    : []
  abertaEm.value = Date.now()
})

/* Trocar de passo volta a gaveta para o alto. */
watch(passo, async () => {
  await nextTick()
  formulario.value?.closest('.p-drawer-content')?.scrollTo({ top: 0 })
})

/** O último passo é o QR; sem nada feito, não há QR: é o resumo do que não deu. */
const PASSOS = computed(() => [
  'Quem leva',
  'O animal',
  'O que foi feito',
  feitos.value.length || !resultados.value.length ? 'QR Code' : 'Resumo',
])

const ultimo = computed(() => passo.value === PASSOS.value.length - 1)

/** O que falta e não aparece embaixo de um campo: vai para a lista do pé. */
const faltasNoPe = computed(() => {
  if (passo.value === 0) {
    return [
      deOng.value && !ong.value.trim() ? 'Diga o nome da ONG.' : '',
      lugar.value.bairro
        ? ''
        : 'Escolha o bairro oficial: é ele que entra no relatório por bairro.',
      aceite.value
        ? ''
        : deOng.value
          ? 'Confirme que a ONG aceita receber os avisos.'
          : 'Confirme que o tutor aceita receber os avisos.',
    ].filter(Boolean)
  }
  if (passo.value === 1) {
    return escolhaDoPet.value ? [] : ['Escolha o animal, ou cadastre outro.']
  }
  if (passo.value === 2) {
    return resultados.value.length ? [] : ['Marque o que a equipe fez ou tentou fazer.']
  }
  return []
})

function passoPronto() {
  if (passo.value === 0) {
    errosDoCliente.value = mostraCampos.value ? errosDoResponsavel() : {}
    return (
      !Object.keys(errosDoCliente.value).length && !erroNoCnpj.value && !faltasNoPe.value.length
    )
  }
  if (passo.value === 1) {
    if (!escolhaDoPet.value) return false
    errosDoPaciente.value = errosDoAnimal()
    if (Object.keys(errosDoPaciente.value).length && !mostraCamposDoPet.value) {
      editandoPet.value = true
    }
    return !Object.keys(errosDoPaciente.value).length
  }
  if (passo.value === 2) {
    return resultados.value.length > 0 && !faltasDoResultado(resultados.value).length
  }
  return true
}

function tempoDesde(inicio: number) {
  const segundos = Math.max(1, Math.round((Date.now() - inicio) / 1000))
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
}

async function avancar() {
  tentou.value = true
  if (!passoPronto()) {
    if (passo.value === 0 && Object.keys(errosDoCliente.value).length && !mostraCampos.value) {
      editandoCadastro.value = true
    }
    /* No tablet a falta pode estar fora da vista: a gaveta rola até a primeira. */
    await nextTick()
    formulario.value
      ?.querySelector('.eg__invalido, .p-invalid, .rat__faltas')
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return
  }
  tentou.value = false

  if (passo.value === 0 && !escolhidoId.value) escolhaDoPet.value = 'novo'
  if (passo.value === 0 && escolhidoId.value && !petsDoResponsavel.value.length) {
    escolherPet('novo')
  }

  if (!ultimo.value) {
    passo.value += 1
    if (ultimo.value) {
      levou.value = tempoDesde(abertaEm.value)
      qr.value = feitos.value.length ? await imagemDoQr(SITE_PUBLICO, 320).catch(() => '') : ''
    }
    return
  }

  registrar()
}

function voltar() {
  tentou.value = false
  passo.value = Math.max(0, passo.value - 1)
}

/* ------------------------------------------------------------------------- registrar */

/** O nome de quem leva, como sai no QR e na etiqueta: a ONG pelo nome, o tutor pelo dele. */
const nomeDeQuemLeva = computed(() => (deOng.value ? ong.value.trim() : cliente.value.nome.trim()))
const quemSai = computed(() =>
  deOng.value ? `A ONG ${nomeDeQuemLeva.value}` : nomeDeQuemLeva.value.split(' ')[0],
)
const especieDoPet = computed(() => (paciente.value.especie === 'GATO' ? 'GATO' : 'CACHORRO'))

function registrar() {
  const responsavelId = campo.salvarResponsavel({
    id: escolhidoId.value ?? undefined,
    quem: quem.value,
    ong: deOng.value ? ong.value.trim() : '',
    cnpj: deOng.value ? stripCnpj(cnpj.value) : '',
    campos: copiaDe(cliente.value),
    lugar: lugar.value,
  })
  const petId = campo.salvarPet({
    id: escolhaDoPet.value && escolhaDoPet.value !== 'novo' ? escolhaDoPet.value : undefined,
    responsavelId,
    campos: copiaDe(paciente.value),
  })
  const nome = paciente.value.nome.trim()

  const id = props.campanha
    ? campo.registrarNaCampanha(props.campanha, {
        responsavelId,
        petId,
        resultados: resultados.value,
      })
    : registrarAtendimento(
        {
          animal: nome,
          especie: especieDoPet.value,
          tutor: iniciaisDe(nomeDeQuemLeva.value),
          data: PERIODO.hoje,
          procedimentos: feitos.value,
          situacao: 'nao-abriu',
          sinpatinhas: false,
          resultados: resultados.value,
        },
        {
          quem: quem.value,
          ong: deOng.value ? ong.value.trim() : undefined,
          cpf: deOng.value ? undefined : stripCpf(cliente.value.cpf) || undefined,
          cnpj: deOng.value ? stripCnpj(cnpj.value) || undefined : undefined,
          responsavelId,
          petId,
        },
      )

  const proximo = cuidados.value[0]
  toast.add({
    severity: feitos.value.length ? 'success' : 'info',
    summary: feitos.value.length
      ? `Atendimento de ${nome} registrado em ${levou.value}`
      : `${nome}: atendimento não realizado, registrado em ${levou.value}`,
    detail: !feitos.value.length
      ? `O motivo entra no relatório. O cadastro fica salvo: na próxima vez, a busca acha ${nomeDeQuemLeva.value}.`
      : proximo
        ? `${quemSai.value} sai com o QR Code e recebe o aviso de ${proximo.rotulo.toLowerCase()} no celular. No protótipo, nada é enviado.`
        : `${quemSai.value} sai com o QR Code da ficha. No protótipo, nada é enviado.`,
    life: 6000,
  })
  aberta.value = false
  emit('registrado', id)
}

/* ------------------------------------------------------------------ a etiqueta impressa */

const imprimindo = ref(false)
/** O QR da etiqueta, maior que o da tela: no papel, 46 mm sem borrar. */
const qrDoPapel = ref('')

/**
 * Imprime a etiqueta (QR, animal, quem leva, próximos cuidados) pela regra de impressão do portal:
 * a etiqueta entra no `body` como `clinic-print-root` só agora e sai depois do `afterprint`. O
 * título da aba vira o nome do PDF salvo.
 */
async function imprimir() {
  if (imprimindo.value) return
  imprimindo.value = true
  qrDoPapel.value = await imagemDoQr(SITE_PUBLICO, 720).catch(() => qr.value)
  await nextTick()
  await Promise.all(
    [...document.querySelectorAll<HTMLImageElement>('.clinic-print-root img')].map((img) =>
      img.complete ? Promise.resolve() : img.decode().catch(() => undefined),
    ),
  )

  const tituloAntes = document.title
  document.title = `${paciente.value.nome.trim()} - QR Code`
  window.addEventListener(
    'afterprint',
    () => {
      document.title = tituloAntes
      imprimindo.value = false
    },
    { once: true },
  )
  window.print()
}

const sobreACampanha = computed(() =>
  props.campanha
    ? `${tipoDeCampanha(props.campanha.tipo).rotulo} · ${dataCurta(props.campanha.data)} · ${props.campanha.regioes.map((id) => regiaoDe(id).nome).join(' e ')}`
    : '',
)

function prazoEmTexto(dias: number) {
  if (dias >= 365) return '1 ano'
  if (dias >= 30) return `${Math.round(dias / 30)} meses`
  return `${dias} dias`
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="campanha ? 'Registrar atendimento na campanha' : 'Registrar atendimento'"
    icone="ph ph-qr-code"
    largura="38rem"
  >
    <p v-if="campanha" class="rat__campanha">
      <i :class="tipoDeCampanha(campanha.tipo).icone" aria-hidden="true" />
      {{ sobreACampanha }}
    </p>

    <ol class="rat__passos" aria-label="Passos do atendimento">
      <li
        v-for="(nome, indice) in PASSOS"
        :key="nome"
        class="rat__passo"
        :class="{ 'rat__passo--feito': indice < passo, 'rat__passo--agora': indice === passo }"
      >
        <button
          type="button"
          class="rat__ir"
          :disabled="indice >= passo"
          :aria-current="indice === passo ? 'step' : undefined"
          @click="passo = indice"
        >
          <span class="rat__numero" aria-hidden="true">
            <i v-if="indice < passo" class="ph ph-check" />
            <template v-else>{{ indice + 1 }}</template>
          </span>
          <span class="rat__nome">{{ nome }}</span>
        </button>
      </li>
    </ol>

    <form
      id="registrar-atendimento"
      ref="formulario"
      class="eg rat"
      novalidate
      @submit.prevent="avancar"
    >
      <!-- 1. Quem leva o animal: a busca, ou o cadastro do responsável. -->
      <template v-if="passo === 0">
        <p class="rat__dica">
          <i class="ph ph-timer" aria-hidden="true" />
          {{
            campanha
              ? 'No ponto da campanha, o registro leva cerca de 1 minuto.'
              : 'No balcão do Consultório Móvel, o registro leva cerca de 1 minuto.'
          }}
          Quem já foi atendido volta pela busca.
        </p>

        <!-- Quem já veio: o cartão, com editar e trocar. -->
        <div v-if="escolhido" class="rat__achado">
          <span class="ui-ladrilho" aria-hidden="true">
            <i :class="escolhido.quem === 'ong' ? 'ph ph-hand-heart' : 'ph ph-user'" />
          </span>
          <span class="rat__achado-texto">
            <strong>{{ escolhido.quem === 'ong' ? escolhido.ong : escolhido.campos.nome }}</strong>
            <span>
              {{
                [
                  escolhido.quem === 'ong' ? escolhido.campos.nome : '',
                  escolhido.campos.telefone,
                  [escolhido.campos.logradouro, escolhido.campos.numero].filter(Boolean).join(', '),
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}
            </span>
          </span>
          <span class="rat__achado-acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-pencil-simple"
              :label="editandoCadastro ? 'Fechar a edição' : 'Editar'"
              @click="editandoCadastro = !editandoCadastro"
            />
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrows-clockwise"
              label="Trocar"
              @click="trocarResponsavel"
            />
          </span>
        </div>

        <template v-else>
          <section class="eg__secao">
            <label class="eg__rotulo" for="rat-busca">
              Já foi atendido? Busque por CPF, telefone ou nome
            </label>
            <IconField>
              <InputIcon class="ph ph-magnifying-glass" />
              <InputText
                id="rat-busca"
                v-model="busca"
                type="search"
                autocomplete="off"
                placeholder="Ex.: 529.982, 99812 ou Maria"
              />
            </IconField>
          </section>

          <ul v-if="encontrados.length" class="ui-lista rat__encontrados">
            <li v-for="{ item, pets } in encontrados" :key="item.id">
              <Button
                unstyled
                type="button"
                class="ui-linha ui-linha--clicavel rat__encontrado"
                @click="escolher(item)"
              >
                <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
                  <i :class="item.quem === 'ong' ? 'ph ph-hand-heart' : 'ph ph-user'" />
                </span>
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">
                    {{ item.quem === 'ong' ? item.ong : item.campos.nome }}
                  </strong>
                  <span class="ui-linha__meta">
                    {{
                      [item.campos.telefone, item.lugar.bairro, pets].filter(Boolean).join(' · ')
                    }}
                  </span>
                </span>
                <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
              </Button>
            </li>
          </ul>
          <p v-else-if="buscou" class="eg__dica">
            Ninguém com esses dados ainda: preencha o cadastro abaixo.
          </p>

          <!-- Quem leva: o tutor, ou uma ONG (com o nome dela e o CNPJ, opcional). -->
          <section class="eg__secao">
            <span id="rat-quem" class="eg__rotulo">Quem leva o animal</span>
            <div class="rat__especies" role="radiogroup" aria-labelledby="rat-quem">
              <button
                v-for="item in QUEM_LEVA"
                :key="item.id"
                type="button"
                role="radio"
                class="rat__escolha"
                :class="{ 'rat__escolha--marcada': quem === item.id }"
                :aria-checked="quem === item.id"
                :data-quem="item.id"
                @click="escolherQuem(item.id)"
              >
                <i :class="item.icone" aria-hidden="true" />
                {{ item.rotulo }}
              </button>
            </div>
          </section>
        </template>

        <template v-if="mostraCampos">
          <div v-if="deOng" class="rat__dupla">
            <section class="eg__secao">
              <label class="eg__rotulo" for="rat-ong">Nome da ONG</label>
              <InputText
                id="rat-ong"
                v-model="ong"
                autocomplete="off"
                maxlength="80"
                :invalid="tentou && !ong.trim()"
              />
            </section>
            <section class="eg__secao">
              <label class="eg__rotulo" for="rat-cnpj">
                CNPJ da ONG <span class="eg__opcional">(opcional)</span>
              </label>
              <InputText
                id="rat-cnpj"
                :model-value="cnpj"
                autocomplete="off"
                autocapitalize="characters"
                placeholder="00.000.000/0000-00"
                maxlength="18"
                :invalid="(tentou || conferirCnpj) && Boolean(erroNoCnpj)"
                :aria-describedby="
                  (tentou || conferirCnpj) && erroNoCnpj ? 'rat-cnpj-erro' : undefined
                "
                @update:model-value="escreverCnpj"
                @blur="conferirCnpj = true"
              />
              <small
                v-if="(tentou || conferirCnpj) && erroNoCnpj"
                id="rat-cnpj-erro"
                class="eg__invalido"
              >
                {{ erroNoCnpj }}
              </small>
            </section>
          </div>

          <h3 v-if="deOng" class="eg__grupo-titulo">Quem responde pela ONG</h3>

          <!-- Os campos do responsável do módulo clínico: telefone, CPF, e-mail e o endereço. -->
          <ClienteCampos id="rat-cli" v-model="cliente" :erros="errosDoCliente" sem-emergencia />
        </template>

        <!-- O lugar que entra no relatório: o bairro oficial (dos 74) e a região dele. -->
        <section class="eg__secao rat__lugar" aria-labelledby="rat-lugar">
          <span id="rat-lugar" class="eg__rotulo">
            Bairro oficial e região <span class="eg__opcional">(para o relatório)</span>
          </span>
          <div v-if="lugar.bairro && !corrigindoBairro" class="rat__lugar-linha">
            <span class="rat__lugar-icone" aria-hidden="true"
              ><i class="ph ph-map-pin-area"
            /></span>
            <span class="rat__lugar-texto">
              <strong>{{ lugar.bairro }}</strong>
              <span>
                Região {{ lugar.regiao ? regiaoDe(lugar.regiao).nome : 'não encontrada' }}
                <template v-if="lugar.como"> · {{ COMO_ACHOU[lugar.como] }}</template>
              </span>
            </span>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-pencil-simple"
              label="Corrigir"
              @click="corrigindoBairro = true"
            />
          </div>
          <template v-else>
            <small class="eg__dica">
              {{
                corrigindoBairro
                  ? 'Escolha o bairro oficial certo:'
                  : cepCompleto
                    ? 'O CEP não diz o bairro oficial: escolha na lista.'
                    : 'Digite o CEP no endereço, ou escolha o bairro oficial:'
              }}
            </small>
            <Select
              v-model="bairroEscolhido"
              input-id="rat-bairro"
              :options="BAIRROS_EM_ORDEM"
              filter
              filter-placeholder="Procurar o bairro"
              placeholder="Escolha o bairro oficial"
              aria-labelledby="rat-lugar"
              :invalid="tentou && !lugar.bairro"
            />
          </template>
        </section>

        <label class="rat__aceite">
          <Checkbox v-model="aceite" binary input-id="rat-aceite" />
          <span>
            {{ deOng ? 'A ONG aceita' : 'O tutor aceita' }} receber no celular os avisos dos
            próximos cuidados. Os dados seguem a Lei nº 13.709/2018 e não são cedidos a ninguém.
          </span>
        </label>
      </template>

      <!-- 2. O animal: um dos pets de quem leva, ou o cadastro do paciente do módulo clínico. -->
      <template v-else-if="passo === 1">
        <p class="rat__dica">
          <i class="ph ph-paw-print" aria-hidden="true" />
          {{
            petsDoResponsavel.length
              ? `Os animais de ${nomeDeQuemLeva.split(' ')[0]} que já vieram. Escolha um, ou cadastre outro.`
              : 'O cadastro do animal, como no módulo clínico: nome e espécie bastam; o resto ajuda.'
          }}
        </p>

        <div
          v-if="petsDoResponsavel.length"
          class="rat__pets"
          role="radiogroup"
          aria-label="Qual animal"
        >
          <button
            v-for="pet in petsDoResponsavel"
            :key="pet.id"
            type="button"
            role="radio"
            class="rat__escolha rat__pet"
            :class="{ 'rat__escolha--marcada': escolhaDoPet === pet.id }"
            :aria-checked="escolhaDoPet === pet.id"
            @click="escolherPet(pet.id)"
          >
            <i
              :class="pet.campos.especie === 'GATO' ? 'ph ph-cat' : 'ph ph-dog'"
              aria-hidden="true"
            />
            <span class="rat__pet-texto">
              <strong>{{ pet.campos.nome }}</strong>
              <small>{{ sobreOPet(pet.campos) }}</small>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            class="rat__escolha rat__pet"
            :class="{ 'rat__escolha--marcada': escolhaDoPet === 'novo' }"
            :aria-checked="escolhaDoPet === 'novo'"
            @click="escolherPet('novo')"
          >
            <i class="ph ph-plus" aria-hidden="true" />
            <span class="rat__pet-texto">
              <strong>Outro animal</strong>
              <small>Cadastrar agora</small>
            </span>
          </button>
        </div>

        <Button
          v-if="escolhaDoPet && escolhaDoPet !== 'novo'"
          type="button"
          size="small"
          severity="secondary"
          outlined
          class="rat__editar-pet"
          icon="ph ph-pencil-simple"
          :label="editandoPet ? 'Fechar a edição' : 'Editar o cadastro do animal'"
          @click="editandoPet = !editandoPet"
        />

        <template v-if="mostraCamposDoPet">
          <PacienteCampos
            id="rat-pet"
            v-model="paciente"
            parte="essencial"
            :erros="errosDoPaciente"
          />

          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            class="rat__mais"
            :icon="maisDetalhes ? 'ph ph-caret-up' : 'ph ph-caret-down'"
            :label="maisDetalhes ? 'Menos detalhes' : 'Mais detalhes (opcional)'"
            :aria-expanded="maisDetalhes"
            @click="maisDetalhes = !maisDetalhes"
          />
          <PacienteCampos
            v-if="maisDetalhes"
            id="rat-pet-mais"
            v-model="paciente"
            parte="detalhes"
            :erros="errosDoPaciente"
          />
        </template>
      </template>

      <!-- 3. O que foi feito: o que a equipe fez ou tentou, e o resultado de cada um. -->
      <template v-else-if="passo === 2">
        <p class="rat__dica">
          <i class="ph ph-list-checks" aria-hidden="true" />
          {{
            campanha
              ? 'O procedimento da campanha já vem marcado: diga se deu certo, e marque o que mais a equipe fez ou tentou.'
              : 'Marque o que a equipe fez ou tentou, e diga se deu certo. Cada cuidado feito com data vira um aviso.'
          }}
        </p>

        <!-- O resultado do que está marcado vem primeiro: na campanha, é a ação do minuto. -->
        <ResultadoDosProcedimentos
          v-if="resultados.length"
          id="rat-res"
          v-model="resultados"
          :mostrar-faltas="tentou"
        />

        <h3 v-if="resultados.length" class="eg__grupo-titulo">Também fez ou tentou</h3>
        <div class="rat__feitos" role="group" aria-label="O que a equipe fez ou tentou">
          <button
            v-for="item in PROCEDIMENTOS"
            :key="item.id"
            type="button"
            role="checkbox"
            class="rat__feito"
            :class="{ 'rat__feito--marcado': marcados.includes(item.id) }"
            :aria-checked="marcados.includes(item.id)"
            @click="marcar(item.id)"
          >
            <span class="rat__feito-icone" aria-hidden="true"><i :class="item.icone" /></span>
            <span class="rat__feito-texto">
              <strong>
                {{ item.rotulo }}
                <span v-if="item.id === procedimentoDaCampanha" class="ui-selo rat__da-campanha">
                  Da campanha
                </span>
              </strong>
              <small v-if="item.proximo">
                {{ item.proximo.rotulo }} em {{ prazoEmTexto(item.proximo.dias) }}
              </small>
              <small v-else>Não marca cuidado</small>
            </span>
            <i
              class="rat__marca"
              :class="marcados.includes(item.id) ? 'ph ph-check-square' : 'ph ph-square'"
              aria-hidden="true"
            />
          </button>
        </div>
      </template>

      <!-- 4. O QR Code e a ficha; sem nada feito, o resumo do que não deu. -->
      <template v-else>
        <template v-if="feitos.length">
          <section class="rat__qr" aria-labelledby="rat-qr">
            <img
              v-if="qr"
              :src="qr"
              width="132"
              height="132"
              class="rat__qr-imagem"
              alt="QR Code da ficha (exemplo)"
            />
            <span class="rat__qr-texto">
              <strong id="rat-qr">
                {{
                  deOng
                    ? `Entregue o QR Code à ONG ${nomeDeQuemLeva}`
                    : `Entregue o QR Code a ${nomeDeQuemLeva.split(' ')[0]}`
                }}
              </strong>
              <span>
                Impresso na etiqueta, com os próximos cuidados. Ele abre a ficha de
                {{ paciente.nome.trim() }} no celular.
              </span>
              <small>No protótipo, o QR abre o site da PetJourney.</small>
              <span class="rat__qr-acoes">
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  class="rat__imprimir"
                  icon="ph ph-printer"
                  label="Imprimir QR Code"
                  :loading="imprimindo"
                  @click="imprimir"
                />
                <span class="ui-selo ui-selo--ok rat__tempo">
                  <i class="ph ph-timer" aria-hidden="true" />
                  Registrado em {{ levou }}
                </span>
              </span>
            </span>
          </section>

          <p v-if="naoDeram.length" class="eg__aviso rat__parcial">
            <i class="ph ph-info" aria-hidden="true" />
            <span>
              Não deu:
              {{
                naoDeram
                  .map(
                    (item) => `${procedimento(item.procedimento).rotulo} (${textoDoMotivo(item)})`,
                  )
                  .join('; ')
              }}. Fica no atendimento e no relatório.
            </span>
          </p>

          <FichaNoCelular
            :animal="paciente.nome"
            :especie="especieDoPet"
            :data="dataDoAtendimento"
            :procedimentos="feitos"
          />
        </template>

        <section v-else class="rat__nada" aria-labelledby="rat-nada">
          <span class="rat__nada-icone" aria-hidden="true"><i class="ph ph-x-circle" /></span>
          <span class="rat__nada-texto">
            <strong id="rat-nada">Atendimento não realizado</strong>
            <span v-for="item in naoDeram" :key="item.procedimento">
              {{ procedimento(item.procedimento).rotulo }}: {{ textoDoMotivo(item) }}
            </span>
            <small>
              Sem QR Code: nada foi feito. O motivo entra no relatório, e o cadastro de
              {{ paciente.nome.trim() }} fica salvo para a próxima vez.
            </small>
            <span class="ui-selo rat__tempo">
              <i class="ph ph-timer" aria-hidden="true" />
              Registrado em {{ levou }}
            </span>
          </span>
        </section>
      </template>

      <ul v-if="tentou && faltasNoPe.length" class="eg__erro rat__faltas" role="alert">
        <li v-for="falta in faltasNoPe" :key="falta">{{ falta }}</li>
      </ul>
    </form>

    <template #pe>
      <Button
        v-if="passo === 0"
        type="button"
        severity="secondary"
        outlined
        label="Cancelar"
        @click="aberta = false"
      />
      <Button
        v-else
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        label="Voltar"
        @click="voltar"
      />
      <Button
        type="submit"
        form="registrar-atendimento"
        :icon="
          ultimo
            ? 'ph ph-check'
            : passo === 2 && feitos.length
              ? 'ph ph-qr-code'
              : 'ph ph-arrow-right'
        "
        :icon-pos="ultimo || (passo === 2 && feitos.length) ? 'left' : 'right'"
        :label="
          ultimo
            ? 'Concluir atendimento'
            : passo === 2 && feitos.length
              ? 'Gerar QR Code'
              : 'Continuar'
        "
      />
    </template>
  </CadastroGaveta>

  <!-- Só existe durante a impressão: no papel, só ela (`clinic-print-root`). -->
  <EtiquetaDoAtendimento
    v-if="imprimindo && qrDoPapel"
    :animal="paciente.nome.trim()"
    :especie="especieDoPet"
    :data="dataDoAtendimento"
    :procedimentos="feitos"
    :quem="quem"
    :responsavel="nomeDeQuemLeva"
    :cpf="deOng ? '' : stripCpf(cliente.cpf)"
    :cnpj="deOng ? stripCnpj(cnpj) : ''"
    :imagem="qrDoPapel"
  />
</template>

<style scoped>
.rat__campanha {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.rat__campanha i {
  color: var(--pets-tinta);
  font-size: 17px;
}

/* Os passos no alto da gaveta, no mesmo desenho da nova campanha e do cadastro de paciente. */
.rat__passos {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  list-style: none;
}

.rat__passo {
  min-width: 0;
}

.rat__passo:not(:last-child) .rat__ir::after {
  flex: 1 0 10px;
  height: 2px;
  border-radius: 2px;
  background: var(--linha);
  content: '';
}

.rat__ir {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 2px 6px 2px 2px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--tinta-3);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: default;
}

.rat__passo--feito .rat__ir {
  color: var(--tinta-2);
  cursor: pointer;
}

.rat__passo--agora .rat__ir {
  color: var(--tinta);
  font-weight: 700;
}

.rat__numero {
  display: grid;
  flex: none;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1.5px solid var(--linha);
  border-radius: 50%;
  font-size: 13px;
  font-weight: 700;
}

.rat__passo--agora .rat__numero {
  border-color: var(--p-primary-color);
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.rat__passo--feito .rat__numero {
  border-color: color-mix(in oklab, var(--p-primary-color) 55%, var(--linha));
  background: color-mix(in oklab, var(--p-primary-color) 18%, transparent);
  color: var(--tinta);
}

.rat__nome {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rat__dica {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.rat__dica i {
  flex: none;
  color: var(--pets-tinta);
  font-size: 16px;
}

/* Quem já veio: o cartão achado na busca, com editar e trocar. */
.rat__achado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  padding: 12px 14px;
  border: 1.5px solid var(--pets);
  border-radius: 14px;
  background: color-mix(in oklab, var(--pets-fundo) 35%, var(--superficie));
}

.rat__achado-texto {
  display: grid;
  flex: 1;
  min-width: 12rem;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13px;
}

.rat__achado-texto strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.rat__achado-acoes {
  display: flex;
  gap: 8px;
}

.rat__achado-acoes .p-button {
  background: var(--superficie);
}

.rat__encontrados {
  margin: -4px 0 0;
}

.rat__encontrado {
  width: 100%;
}

/* Alinhada no alto: o aviso embaixo do documento não estica o campo do lado. */
.rat__dupla {
  display: grid;
  align-items: start;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* Quem leva, o pet e os procedimentos: cartões de escolha, no desenho da gaveta da campanha. */
.rat__especies {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.rat__escolha,
.rat__feito {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: 1.5px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-weight: 650;
  text-align: start;
}

.rat__escolha i {
  color: var(--tinta-2);
  font-size: 20px;
}

.rat__escolha:hover,
.rat__feito:hover {
  border-color: var(--linha-media);
}

.rat__escolha:focus-visible,
.rat__feito:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

.rat__escolha--marcada,
.rat__escolha--marcada:hover,
.rat__feito--marcado,
.rat__feito--marcado:hover {
  border-color: var(--pets);
  background: color-mix(in oklab, var(--pets-fundo) 35%, var(--superficie));
}

.rat__escolha--marcada i {
  color: var(--pets-tinta);
}

/* O lugar do relatório: bairro oficial e região, com o "Corrigir". */
.rat__lugar-linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  padding: 10px 12px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--superficie);
}

.rat__lugar-icone {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--pets-fundo);
  color: var(--pets-tinta);
  font-size: 17px;
}

.rat__lugar-texto {
  display: grid;
  flex: 1;
  min-width: 10rem;
  gap: 1px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.rat__lugar-texto strong {
  color: var(--tinta);
  font-size: 14px;
}

.rat__aceite {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
  cursor: pointer;
}

.rat__pets {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
}

.rat__pet-texto {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.rat__pet-texto small {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rat__editar-pet,
.rat__mais {
  justify-self: start;
}

.rat__feitos {
  display: grid;
  gap: 8px;
}

.rat__feito-icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--pets-fundo);
  color: var(--pets-tinta);
  font-size: 18px;
}

.rat__feito-texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 1px;
}

.rat__feito-texto strong {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.rat__feito-texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 500;
}

.rat__da-campanha {
  font-size: 11px;
}

.rat__marca {
  flex: none;
  color: var(--tinta-3);
  font-size: 21px;
}

.rat__feito--marcado .rat__marca {
  color: var(--pets-tinta);
}

/* O QR que o tutor leva: papel branco nos dois temas, para ler na câmera. */
.rat__qr {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: color-mix(in oklab, var(--pets-fundo) 30%, var(--superficie));
}

.rat__qr-imagem {
  flex: none;
  padding: 6px;
  border-radius: 12px;
  background: #fff;
}

.rat__qr-texto,
.rat__nada-texto {
  display: grid;
  justify-items: start;
  gap: 4px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.rat__qr-texto strong,
.rat__nada-texto strong {
  color: var(--tinta);
  font-size: 15px;
}

.rat__qr-texto small,
.rat__nada-texto small {
  color: var(--tinta-3);
  font-size: 12px;
}

/* Imprimir e o tempo, lado a lado embaixo do texto. O botão leva o papel por baixo: sobre o
 * cartão tingido, o contorno sozinho ficava transparente. */
.rat__qr-acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin-top: 6px;
}

.rat__imprimir.p-button {
  background: var(--superficie);
}

.rat__tempo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

/* Nada feito: sem QR, o resumo do que não deu, com a borda da atenção. */
.rat__nada {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  border: 1.5px solid color-mix(in oklab, var(--risco-tinta) 40%, var(--linha));
  border-radius: 16px;
  background: var(--superficie);
}

.rat__nada-icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 21px;
}

.rat__parcial {
  margin: 0;
}

.rat__faltas {
  display: grid;
  gap: 2px;
  margin: 0;
  padding-inline-start: 18px;
}
</style>
