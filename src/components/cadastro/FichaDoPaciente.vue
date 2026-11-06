<script setup lang="ts">
/**
 * A ficha do cadastro do paciente pela API (E2-01, PJ-ECWI3Z, seções 1.3 a 1.11), fora da
 * demonstração: `/clinica/ficha/:id`.
 *
 * Duas colunas. À esquerda, o animal: a foto, os dados e os alertas (os ativos à vista, os
 * encerrados recolhidos). À direita, quem responde por ele: o contato, o endereço, o contato de
 * emergência e as pessoas autorizadas a buscar. Cada parte se edita numa gaveta.
 *
 * As abas da ficha da demonstração (histórico, vacinas, tratamento, resumo) ficam de fora: elas
 * vêm com o prontuário, as vacinas e a leitura do app (E4 e E2-03).
 *
 * Quem pode o quê vem do `/eu`: escrever pede `paciente.escrever` e um módulo que não esteja só
 * para consulta; juntar duplicados e excluir a pedido do titular, DONO ou GESTOR (a exclusão vale
 * também com o módulo só para consulta).
 */
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import AlertaGaveta from '@/components/cadastro/AlertaGaveta.vue'
import AutorizadoGaveta from '@/components/cadastro/AutorizadoGaveta.vue'
import ClienteGaveta from '@/components/cadastro/ClienteGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import ExclusaoGaveta from '@/components/cadastro/ExclusaoGaveta.vue'
import InativarGaveta from '@/components/cadastro/InativarGaveta.vue'
import MesclarGaveta from '@/components/cadastro/MesclarGaveta.vue'
import PacienteGaveta from '@/components/cadastro/PacienteGaveta.vue'
import {
  alertasPorGravidade,
  ICONE_DO_ALERTA,
  iniciais,
  TOM_DA_SEVERIDADE,
  useRotulosDoCadastro,
} from '@/components/cadastro/useRotulosDoCadastro'
import ResumoDoApp from '@/components/cadastro/ResumoDoApp.vue'
import LinhaDoTempoDaFicha from '@/components/atendimento/LinhaDoTempoDaFicha.vue'
import TratamentosDaFicha from '@/components/tratamentos/TratamentosDaFicha.vue'
import DocumentosDoPaciente from '@/components/documentos/DocumentosDoPaciente.vue'
import VacinasDaFicha from '@/components/vacinas/VacinasDaFicha.vue'
import VinculoCartao from '@/components/cadastro/VinculoCartao.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { ApiError } from '@/service/api'
import {
  editarAlerta,
  enviarFoto,
  FOTO_TAMANHO_MAX,
  FOTO_TIPOS,
  obterPaciente,
  reativarPaciente,
  removerAutorizado,
  removerFoto,
  telefoneNaTela,
  type Alerta,
  type Autorizado,
  type Paciente,
} from '@/service/parceiro/pacientes-service'
import { ESPECIE_DO_AVATAR } from '@/utils/parceiro/acesso-na-lista'

const props = defineProps<{ pacienteId: string }>()

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const { store, parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

const paciente = ref<Paciente | null>(null)
const carregando = ref(true)
const erro = ref('')
const semAcesso = ref(false)

async function carregar() {
  carregando.value = true
  erro.value = ''
  semAcesso.value = false

  try {
    paciente.value = await obterPaciente(props.pacienteId, parceiroQuery())
  } catch (err) {
    /* De outra clínica ou de cliente anonimizado: o mesmo 403, sem dizer se existe (1.3, 1.11). */
    if (err instanceof ApiError && err.statusCode === 403 && err.codigo === 'OWNERSHIP_FORBIDDEN') {
      semAcesso.value = true
      paciente.value = null
    } else {
      erro.value = err instanceof Error ? err.message : t('cadastro.erros.carregar')
    }
  } finally {
    carregando.value = false
  }
}

watch(
  () => props.pacienteId,
  () => void carregar(),
  { immediate: true },
)

/* --------------------------------------------------------------------------- quem pode o quê */

const podeEscrever = computed(
  () =>
    store.temPermissao('paciente.escrever') &&
    Boolean(store.modulo('CLINICA')?.podeEscrever || store.modulo('HOTEL')?.podeEscrever),
)

const donoOuGestor = computed(
  () => store.isDono || (store.eu?.papeisOperacionais ?? []).includes('GESTOR'),
)

const clienteAnonimizado = computed(() => Boolean(paciente.value?.cliente.anonimizadoEm))

/** "Este pet em 30 segundos" e o diário do app (E2-03): veterinário, enfermagem e o dono. */
/** As vacinas da ficha: o módulo Clínica e `paciente.ler` (E4-04). */
const leVacinas = computed(
  () => Boolean(store.modulo('CLINICA')?.podeLer) && store.temPermissao('paciente.ler'),
)

const leOApp = computed(
  () => Boolean(store.modulo('CLINICA')?.podeLer) && store.temPermissao('prontuario.ler'),
)

const editavel = computed(
  () => podeEscrever.value && Boolean(paciente.value?.ativo) && !clienteAnonimizado.value,
)

/* ------------------------------------------------------------------------------ as gavetas */

const editandoPaciente = ref(false)
const editandoCliente = ref(false)
const inativando = ref(false)
const inativarComoObito = ref(false)
const mesclando = ref<'paciente' | 'cliente' | null>(null)
const excluindo = ref(false)
const alertaAberto = ref(false)
const alertaEmEdicao = ref<Alerta | null>(null)
const autorizadoAberto = ref(false)
const autorizadoEmEdicao = ref<Autorizado | null>(null)

function aoSalvarPaciente(novo: Paciente) {
  paciente.value = novo
  toast.add({ severity: 'success', summary: t('cadastro.ficha.salvo'), life: 3000 })
}

function aoSalvarCliente(cliente: Paciente['cliente']) {
  if (paciente.value) paciente.value = { ...paciente.value, cliente }
  toast.add({ severity: 'success', summary: t('cadastro.ficha.salvo'), life: 3000 })
}

function abrirAlerta(alerta: Alerta | null) {
  alertaEmEdicao.value = alerta
  alertaAberto.value = true
}

function aoSalvarAlerta(alerta: Alerta) {
  const atual = paciente.value
  if (!atual) return

  const outros = atual.alertas.filter((item) => item.id !== alerta.id)
  paciente.value = { ...atual, alertas: [alerta, ...outros] }
}

function abrirAutorizado(autorizado: Autorizado | null) {
  autorizadoEmEdicao.value = autorizado
  autorizadoAberto.value = true
}

function aoSalvarAutorizado(autorizado: Autorizado) {
  const atual = paciente.value
  if (!atual) return

  const outros = atual.cliente.autorizados.filter((item) => item.id !== autorizado.id)
  paciente.value = {
    ...atual,
    cliente: { ...atual.cliente, autorizados: [...outros, autorizado] },
  }
}

/* ---------------------------------------------------------------------- alertas: encerrar */

const alterandoAlerta = ref<string | null>(null)

async function mudarAlerta(alerta: Alerta, ativo: boolean) {
  const atual = paciente.value
  if (!atual) return

  alterandoAlerta.value = alerta.id

  try {
    aoSalvarAlerta(await editarAlerta(atual.id, alerta.id, { ativo }, parceiroQuery()))
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    toast.add({
      severity: 'error',
      summary: lido.codigo === 'ALERTAS_NO_LIMITE' ? t('cadastro.alerta.noLimite') : lido.mensagem,
      life: 6000,
    })
  } finally {
    alterandoAlerta.value = null
  }
}

const ativos = computed(() => alertasPorGravidade(paciente.value?.alertas ?? []))
const encerrados = computed(() => (paciente.value?.alertas ?? []).filter((item) => !item.ativo))
const verEncerrados = ref(false)

/* ------------------------------------------------------------------- autorizados: remover */

const confirmandoRemocao = ref<string | null>(null)
const removendo = ref<string | null>(null)

async function remover(autorizado: Autorizado) {
  const atual = paciente.value
  if (!atual) return

  removendo.value = autorizado.id

  try {
    await removerAutorizado(atual.cliente.id, autorizado.id, parceiroQuery())
    paciente.value = {
      ...atual,
      cliente: {
        ...atual.cliente,
        autorizados: atual.cliente.autorizados.filter((item) => item.id !== autorizado.id),
      },
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    removendo.value = null
    confirmandoRemocao.value = null
  }
}

/* ------------------------------------------------------------------------------- a foto */

const entradaDaFoto = ref<HTMLInputElement | null>(null)
const enviandoFoto = ref(false)

async function aoEscolherFoto(evento: Event) {
  const entrada = evento.target as HTMLInputElement
  const arquivo = entrada.files?.[0]
  entrada.value = ''

  const atual = paciente.value
  if (!arquivo || !atual) return

  if (arquivo.size > FOTO_TAMANHO_MAX) {
    toast.add({ severity: 'warn', summary: t('cadastro.foto.grande'), life: 5000 })
    return
  }

  enviandoFoto.value = true

  try {
    paciente.value = await enviarFoto(atual.id, arquivo, parceiroQuery())
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    toast.add({
      severity: 'error',
      summary: lido.codigo === 'FOTO_INVALIDA' ? t('cadastro.foto.invalida') : lido.mensagem,
      life: 6000,
    })
  } finally {
    enviandoFoto.value = false
  }
}

async function tirarFoto() {
  const atual = paciente.value
  if (!atual) return

  enviandoFoto.value = true

  try {
    await removerFoto(atual.id, parceiroQuery())
    paciente.value = { ...atual, temFoto: false, fotoUrl: null }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    enviandoFoto.value = false
  }
}

/** A URL assinada vale 15 minutos: se a imagem falhar, a ficha vem de novo (seção 1.3). */
let fotoRecarregada = false

function aoFalharFoto() {
  if (fotoRecarregada) return
  fotoRecarregada = true
  void carregar()
}

/* --------------------------------------------------------------------------- reativar */

const reativando = ref(false)

async function reativar() {
  const atual = paciente.value
  if (!atual) return

  reativando.value = true

  try {
    paciente.value = await reativarPaciente(atual.id, parceiroQuery())
    toast.add({ severity: 'success', summary: t('cadastro.ficha.reativado'), life: 3000 })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    reativando.value = false
  }
}

/* ------------------------------------------------------------------------- o menu "Mais" */

const menu = ref<InstanceType<typeof Menu> | null>(null)

const itensDoMenu = computed(() => {
  const atual = paciente.value
  if (!atual) return []

  return [
    {
      label: atual.temFoto ? t('cadastro.foto.trocar') : t('cadastro.foto.por'),
      icon: 'ph ph-camera',
      command: () => entradaDaFoto.value?.click(),
    },
    ...(atual.temFoto
      ? [{ label: t('cadastro.foto.tirar'), icon: 'ph ph-image-broken', command: tirarFoto }]
      : []),
    { separator: true },
    {
      label: t('cadastro.inativo.registrarObito'),
      icon: 'ph ph-flower-lotus',
      command: () => {
        inativarComoObito.value = true
        inativando.value = true
      },
    },
    {
      label: t('cadastro.inativo.inativar'),
      icon: 'ph ph-archive',
      command: () => {
        inativarComoObito.value = false
        inativando.value = true
      },
    },
    ...(donoOuGestor.value
      ? [
          {
            label: t('cadastro.mesclar.acaoPaciente'),
            icon: 'ph ph-git-merge',
            command: () => (mesclando.value = 'paciente'),
          },
        ]
      : []),
  ]
})

const menuDoResponsavel = ref<InstanceType<typeof Menu> | null>(null)

const itensDoResponsavel = computed(() => [
  ...(podeEscrever.value
    ? [
        {
          label: t('cadastro.mesclar.acaoResponsavel'),
          icon: 'ph ph-git-merge',
          command: () => (mesclando.value = 'cliente'),
        },
      ]
    : []),
  {
    label: t('cadastro.exclusao.titulo'),
    icon: 'ph ph-user-minus',
    command: () => (excluindo.value = true),
  },
])

/* ---------------------------------------------------------------------------- o que mostrar */

const metaDoPaciente = computed(() => {
  const atual = paciente.value
  if (!atual) return ''

  return [
    rotulos.especie(atual),
    atual.raca,
    atual.sexo ? t(`cadastro.sexo.${atual.sexo}`) : '',
    atual.ativo ? rotulos.idade(atual.nascimento, atual.nascimentoEstimado) : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

const dados = computed(() => {
  const atual = paciente.value
  if (!atual) return []

  return [
    {
      rotulo: t('cadastro.campos.nascimento'),
      valor: atual.nascimento
        ? atual.nascimentoEstimado
          ? t('cadastro.ficha.nascimentoEstimado', { data: rotulos.dia(atual.nascimento) })
          : rotulos.dia(atual.nascimento)
        : '',
    },
    {
      rotulo: t('cadastro.campos.castrado'),
      valor: atual.castrado === null ? '' : atual.castrado ? t('cadastro.sim') : t('cadastro.nao'),
    },
    {
      rotulo: t('cadastro.campos.porte'),
      valor: atual.porte ? t(`cadastro.porte.${atual.porte}`) : '',
    },
    { rotulo: t('cadastro.campos.peso'), valor: rotulos.peso(atual.pesoKg) },
    { rotulo: t('cadastro.campos.microchip'), valor: atual.microchip ?? '', num: true },
    { rotulo: t('cadastro.campos.pelagem'), valor: atual.pelagem ?? '' },
    /* O código do sistema anterior só existe para quem veio pelo migrador. */
    ...(atual.codigoNaOrigem
      ? [{ rotulo: t('cadastro.ficha.codigoNaOrigem'), valor: atual.codigoNaOrigem, num: true }]
      : []),
  ]
})

const contatos = computed(() => {
  const cliente = paciente.value?.cliente
  if (!cliente) return []

  const endereco = [
    [cliente.logradouro, cliente.numero].filter(Boolean).join(', '),
    cliente.complemento,
    cliente.bairro,
    [cliente.cidade, cliente.uf].filter(Boolean).join(' / '),
  ]
    .filter(Boolean)
    .join(' · ')

  return [
    {
      rotulo: t('cadastro.campos.telefone'),
      valor: telefoneNaTela(cliente.telefone),
      num: true,
      preferido: cliente.contatoPreferido !== 'EMAIL',
    },
    {
      rotulo: t('cadastro.campos.telefoneSecundario'),
      valor: telefoneNaTela(cliente.telefoneSecundario),
      num: true,
    },
    {
      rotulo: t('cadastro.campos.email'),
      valor: cliente.email ?? '',
      preferido: cliente.contatoPreferido === 'EMAIL',
    },
    { rotulo: t('cadastro.campos.cpf'), valor: cpfNaTela(cliente.cpf), num: true },
    { rotulo: t('cadastro.campos.endereco'), valor: endereco },
    { rotulo: t('cadastro.campos.observacao'), valor: cliente.observacao ?? '' },
    {
      rotulo: t('cadastro.campos.emergencia'),
      valor: [cliente.emergenciaNome, telefoneNaTela(cliente.emergenciaTelefone)]
        .filter(Boolean)
        .join(' · '),
    },
  ].filter((linha) => linha.valor)
})

function cpfNaTela(cpf: string | null) {
  if (!cpf || cpf.length !== 11) return cpf ?? ''

  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}

const resumo = computed(() => {
  const atual = paciente.value
  if (!atual) return ''

  return atual.ativo ? metaDoPaciente.value : rotulos.situacao(atual)
})

function aposMesclar() {
  toast.add({ severity: 'success', summary: t('cadastro.mesclar.feito'), life: 3500 })
  void carregar()
}

/* Depois da exclusão a ficha não abre mais (403) ou some: a lista volta quando a gaveta fecha. */
const excluiu = ref(false)

function aposExcluir() {
  excluiu.value = true
}

watch(excluindo, (aberta) => {
  if (!aberta && excluiu.value) void router.push('/clinica/pacientes')
})
</script>

<template>
  <UiPagina
    class="tela-ficha"
    :titulo="paciente?.nome ?? ''"
    :resumo="resumo"
    icone="ph ph-paw-print"
    :carregando="carregando && !paciente"
    :erro="erro && !paciente ? erro : ''"
    @tentar-de-novo="carregar"
  >
    <template v-if="paciente" #acoes>
      <template v-if="editavel">
        <Button
          type="button"
          icon="ph ph-pencil-simple"
          :label="t('cadastro.ficha.editar')"
          @click="editandoPaciente = true"
        />
        <Button
          type="button"
          icon="ph ph-dots-three"
          :label="t('cadastro.ficha.mais')"
          severity="secondary"
          outlined
          aria-haspopup="menu"
          :loading="enviandoFoto"
          @click="menu?.toggle($event)"
        />
        <Menu ref="menu" :model="itensDoMenu" popup />
      </template>
      <Button
        v-else-if="
          podeEscrever &&
          !paciente.ativo &&
          paciente.inativoMotivo !== 'DUPLICADO' &&
          !clienteAnonimizado
        "
        type="button"
        icon="ph ph-arrow-counter-clockwise"
        :label="t('cadastro.ficha.reativar')"
        :loading="reativando"
        @click="reativar"
      />
    </template>

    <div v-if="semAcesso" class="ui-vazio fp__sem-acesso">
      <i class="ph ph-lock" aria-hidden="true" />
      <strong>{{ t('cadastro.ficha.semAcesso') }}</strong>
      <span>{{ t('cadastro.ficha.semAcessoDica') }}</span>
      <RouterLink
        class="p-button p-component p-button-secondary p-button-outlined"
        to="/clinica/pacientes"
      >
        {{ t('cadastro.ficha.voltarParaLista') }}
      </RouterLink>
    </div>

    <div v-else-if="paciente" class="fp">
      <p v-if="paciente.mescladoEmId" class="fp__faixa" role="status">
        <i class="ph ph-git-merge" aria-hidden="true" />
        <span>{{ t('cadastro.ficha.mesclado') }}</span>
        <RouterLink :to="`/clinica/ficha/${paciente.mescladoEmId}`">
          {{ t('cadastro.ficha.abrirOQueFicou') }}
        </RouterLink>
      </p>

      <div class="fp__colunas">
        <div class="fp__coluna">
          <!-- O animal. -->
          <section class="ui-folha ui-cartao fp__cartao" aria-labelledby="fp-paciente">
            <header class="fp__pet">
              <img
                v-if="paciente.fotoUrl"
                class="fp__foto"
                :src="paciente.fotoUrl"
                :alt="t('cadastro.foto.alt', { nome: paciente.nome })"
                @error="aoFalharFoto"
              />
              <PetAvatar
                v-else
                :nome="paciente.nome"
                :iniciais="iniciais(paciente.nome)"
                :especie="ESPECIE_DO_AVATAR[paciente.especie] ?? null"
                tamanho="xl"
              />
              <span class="fp__pet-texto">
                <h2 id="fp-paciente" class="fp__nome">{{ t('cadastro.ficha.dadosDoPaciente') }}</h2>
                <span class="fp__meta">{{ t('cadastro.ficha.dadosDica') }}</span>
                <span v-if="!paciente.ativo" class="ui-selo">
                  <i
                    :class="
                      paciente.inativoMotivo === 'OBITO' ? 'ph ph-flower-lotus' : 'ph ph-archive'
                    "
                    aria-hidden="true"
                  />
                  {{ rotulos.situacao(paciente) }}
                </span>
              </span>
            </header>

            <dl class="fp__dados">
              <div v-for="linha in dados" :key="linha.rotulo" class="fp__dado">
                <dt>{{ linha.rotulo }}</dt>
                <dd :class="{ 'ui-num': linha.num, fp__vazio: !linha.valor }">
                  {{ linha.valor || t('cadastro.naoInformado') }}
                </dd>
              </div>
            </dl>
          </section>

          <!-- Os alertas. -->
          <section class="ui-folha ui-cartao fp__cartao" aria-labelledby="fp-alertas">
            <header class="ui-cartao__cabeca">
              <span
                class="ui-ladrilho"
                :class="{
                  'ui-ladrilho--risco': ativos.some((alerta) => alerta.severidade === 'RISCO'),
                }"
                aria-hidden="true"
              >
                <i class="ph ph-warning" />
              </span>
              <span class="ui-cartao__titulos">
                <h2 id="fp-alertas" class="ui-cartao__titulo">{{ t('cadastro.alerta.titulo') }}</h2>
                <p class="ui-cartao__descricao">{{ t('cadastro.alerta.descricao') }}</p>
              </span>
              <Button
                v-if="editavel"
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-plus"
                :label="t('cadastro.alerta.novo')"
                @click="abrirAlerta(null)"
              />
            </header>

            <ul v-if="ativos.length" class="ui-lista">
              <li v-for="alerta in ativos" :key="alerta.id" class="ui-linha fp__alerta">
                <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
                  <i :class="ICONE_DO_ALERTA[alerta.tipo]" />
                </span>
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">
                    {{ rotulos.alerta(alerta.tipo) }}
                    <span class="ui-selo" :class="TOM_DA_SEVERIDADE[alerta.severidade]">
                      {{ rotulos.severidade(alerta.severidade) }}
                    </span>
                  </strong>
                  <span class="ui-linha__meta">{{ alerta.detalhe }}</span>
                </span>
                <span v-if="editavel" class="ui-linha__fim fp__acoes">
                  <Button
                    type="button"
                    size="small"
                    severity="secondary"
                    outlined
                    icon="ph ph-pencil-simple"
                    :aria-label="
                      t('cadastro.alerta.editarDe', { tipo: rotulos.alerta(alerta.tipo) })
                    "
                    @click="abrirAlerta(alerta)"
                  />
                  <Button
                    type="button"
                    size="small"
                    severity="secondary"
                    outlined
                    icon="ph ph-check"
                    :label="t('cadastro.alerta.encerrar')"
                    :loading="alterandoAlerta === alerta.id"
                    @click="mudarAlerta(alerta, false)"
                  />
                </span>
              </li>
            </ul>
            <p v-else class="fp__nada">{{ t('cadastro.alerta.nenhum') }}</p>

            <template v-if="encerrados.length">
              <Button
                type="button"
                size="small"
                severity="secondary"
                text
                class="fp__recolher"
                :icon="verEncerrados ? 'ph ph-caret-up' : 'ph ph-caret-down'"
                :label="t('cadastro.alerta.verEncerrados', { n: encerrados.length })"
                :aria-expanded="verEncerrados"
                @click="verEncerrados = !verEncerrados"
              />
              <ul v-if="verEncerrados" class="ui-lista fp__encerrados">
                <li v-for="alerta in encerrados" :key="alerta.id" class="ui-linha fp__alerta">
                  <span class="ui-ladrilho ui-ladrilho--p ui-ladrilho--neutro" aria-hidden="true">
                    <i :class="ICONE_DO_ALERTA[alerta.tipo]" />
                  </span>
                  <span class="ui-linha__texto">
                    <strong class="ui-linha__titulo">{{ rotulos.alerta(alerta.tipo) }}</strong>
                    <span class="ui-linha__meta">{{ alerta.detalhe }}</span>
                  </span>
                  <span v-if="editavel" class="ui-linha__fim">
                    <Button
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      icon="ph ph-arrow-counter-clockwise"
                      :label="t('cadastro.alerta.reativar')"
                      :loading="alterandoAlerta === alerta.id"
                      @click="mudarAlerta(alerta, true)"
                    />
                  </span>
                </li>
              </ul>
            </template>
          </section>

          <!-- As vacinas pela API (E4-04): o plano, o histórico, aplicar e anular. -->
          <VacinasDaFicha
            v-if="leVacinas"
            :paciente-id="paciente.id"
            :especie="paciente.especie"
            :ativo="paciente.ativo"
            :responsavel="paciente.cliente.nome"
          />

          <!-- O histórico clínico pela API (E4-01): atendimentos, atos, vacinas e faltas. -->
          <LinhaDoTempoDaFicha
            v-if="leOApp"
            :paciente-id="paciente.id"
            :ativo="paciente.ativo"
            :obito="Boolean(paciente.obitoEm)"
          />

          <!-- Os tratamentos em casa pela API (E4-05b): a faixa de doses, o alerta e o contato. -->
          <TratamentosDaFicha v-if="leOApp" :paciente-id="paciente.id" />

          <!-- Os documentos clínicos pela API (E4-06): emitir, aceite no balcão, PDF e anular. -->
          <DocumentosDoPaciente v-if="leOApp" :paciente-id="paciente.id" />
        </div>

        <div class="fp__coluna">
          <!-- Quem responde pelo animal. -->
          <section class="ui-folha ui-cartao fp__cartao" aria-labelledby="fp-responsavel">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-user" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="fp-responsavel" class="ui-cartao__titulo">
                  {{
                    clienteAnonimizado
                      ? t('cadastro.responsavel.anonimizado')
                      : paciente.cliente.nome
                  }}
                </h2>
                <p class="ui-cartao__descricao">
                  {{
                    clienteAnonimizado
                      ? paciente.cliente.bloqueadoAte
                        ? t('cadastro.responsavel.bloqueadoAte', {
                            data: rotulos.data(paciente.cliente.bloqueadoAte),
                          })
                        : t('cadastro.responsavel.semDados')
                      : t('cadastro.responsavel.prefere', {
                          contato: t(`cadastro.contato.${paciente.cliente.contatoPreferido}`),
                        })
                  }}
                </p>
              </span>
              <span v-if="!clienteAnonimizado" class="fp__acoes">
                <Button
                  v-if="podeEscrever"
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="ph ph-pencil-simple"
                  :label="t('cadastro.ficha.editar')"
                  @click="editandoCliente = true"
                />
                <template v-if="donoOuGestor">
                  <Button
                    type="button"
                    size="small"
                    severity="secondary"
                    outlined
                    icon="ph ph-dots-three"
                    :aria-label="t('cadastro.responsavel.mais')"
                    aria-haspopup="menu"
                    @click="menuDoResponsavel?.toggle($event)"
                  />
                  <Menu ref="menuDoResponsavel" :model="itensDoResponsavel" popup />
                </template>
              </span>
            </header>

            <dl v-if="contatos.length" class="fp__dados fp__dados--uma">
              <div v-for="linha in contatos" :key="linha.rotulo" class="fp__dado">
                <dt>
                  {{ linha.rotulo }}
                  <span v-if="linha.preferido" class="fp__preferido">{{
                    t('cadastro.responsavel.preferido')
                  }}</span>
                </dt>
                <dd :class="{ 'ui-num': linha.num }">
                  <bdi v-if="linha.num" dir="ltr">{{ linha.valor }}</bdi>
                  <template v-else>{{ linha.valor }}</template>
                </dd>
              </div>
            </dl>
          </section>

          <!-- O que o app conta, com o consentimento do responsável (E2-03). -->
          <ResumoDoApp
            v-if="!clienteAnonimizado && leOApp"
            :paciente-id="paciente.id"
            :nome="paciente.nome"
          />

          <!-- O app: o vínculo, as propostas e os pedidos de correção (E2-02). -->
          <VinculoCartao
            v-if="!clienteAnonimizado"
            :paciente="paciente"
            :pode-escrever="podeEscrever"
          />

          <!-- Quem pode buscar. -->
          <section
            v-if="!clienteAnonimizado"
            class="ui-folha ui-cartao fp__cartao"
            aria-labelledby="fp-autorizados"
          >
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true">
                <i class="ph ph-identification-badge" />
              </span>
              <span class="ui-cartao__titulos">
                <h2 id="fp-autorizados" class="ui-cartao__titulo">
                  {{ t('cadastro.autorizados.titulo') }}
                </h2>
                <p class="ui-cartao__descricao">{{ t('cadastro.autorizados.descricao') }}</p>
              </span>
              <Button
                v-if="podeEscrever"
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-plus"
                :label="t('cadastro.autorizados.adicionar')"
                @click="abrirAutorizado(null)"
              />
            </header>

            <ul v-if="paciente.cliente.autorizados.length" class="ui-lista">
              <li v-for="pessoa in paciente.cliente.autorizados" :key="pessoa.id" class="ui-linha">
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">{{ pessoa.nome }}</strong>
                  <span class="ui-linha__meta">
                    {{
                      [pessoa.relacao, telefoneNaTela(pessoa.telefone), pessoa.documento]
                        .filter(Boolean)
                        .join(' · ')
                    }}
                  </span>
                </span>
                <span v-if="podeEscrever" class="ui-linha__fim fp__acoes">
                  <template v-if="confirmandoRemocao === pessoa.id">
                    <Button
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      :label="t('cadastro.voltar')"
                      @click="confirmandoRemocao = null"
                    />
                    <Button
                      type="button"
                      size="small"
                      severity="danger"
                      :label="t('cadastro.autorizados.remover')"
                      :loading="removendo === pessoa.id"
                      @click="remover(pessoa)"
                    />
                  </template>
                  <template v-else>
                    <Button
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      icon="ph ph-pencil-simple"
                      :aria-label="t('cadastro.autorizados.editarDe', { nome: pessoa.nome })"
                      @click="abrirAutorizado(pessoa)"
                    />
                    <Button
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      icon="ph ph-trash"
                      :aria-label="t('cadastro.autorizados.removerDe', { nome: pessoa.nome })"
                      @click="confirmandoRemocao = pessoa.id"
                    />
                  </template>
                </span>
              </li>
            </ul>
            <p v-else class="fp__nada">{{ t('cadastro.autorizados.nenhum') }}</p>
          </section>
        </div>
      </div>

      <!-- Nativo e escondido: o item "Trocar foto" do menu é o controle. -->
      <input
        ref="entradaDaFoto"
        class="fp__entrada"
        type="file"
        :accept="FOTO_TIPOS.join(',')"
        tabindex="-1"
        aria-hidden="true"
        @change="aoEscolherFoto"
      />
    </div>

    <template #sempre>
      <PacienteGaveta
        v-model:visible="editandoPaciente"
        :paciente="paciente"
        @salvo="aoSalvarPaciente"
      />
      <ClienteGaveta
        v-model:visible="editandoCliente"
        :cliente="paciente?.cliente ?? null"
        @salvo="aoSalvarCliente"
      />
      <AlertaGaveta
        v-if="paciente"
        v-model:visible="alertaAberto"
        :paciente-id="paciente.id"
        :alerta="alertaEmEdicao"
        @salvo="aoSalvarAlerta"
      />
      <AutorizadoGaveta
        v-if="paciente"
        v-model:visible="autorizadoAberto"
        :cliente-id="paciente.cliente.id"
        :autorizado="autorizadoEmEdicao"
        @salvo="aoSalvarAutorizado"
      />
      <InativarGaveta
        v-model:visible="inativando"
        :paciente="paciente"
        :obito="inativarComoObito"
        @salvo="aoSalvarPaciente"
      />
      <MesclarGaveta
        :visible="mesclando !== null"
        :tipo="mesclando ?? 'paciente'"
        :paciente="paciente"
        @update:visible="(aberta: boolean) => !aberta && (mesclando = null)"
        @mesclado="aposMesclar"
      />
      <ExclusaoGaveta
        v-model:visible="excluindo"
        :cliente="paciente?.cliente ?? null"
        @excluido="aposExcluir"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.fp {
  display: grid;
  gap: 16px;
  container-type: inline-size;
}

.fp__colunas {
  display: grid;
  gap: 16px;
}

@container (min-width: 960px) {
  .fp__colunas {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    align-items: start;
  }
}

.fp__coluna {
  display: grid;
  gap: 16px;
}

.fp__cartao {
  display: grid;
  gap: 14px;
}

.fp__pet {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.fp__foto {
  flex: none;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
}

.fp__pet-texto {
  display: grid;
  justify-items: start;
  gap: 4px;
  min-width: 0;
}

.fp__nome {
  margin: 0;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 650;
}

.fp__meta {
  color: var(--tinta-2);
  font-size: 14px;
}

.fp__dados {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 12px 20px;
  margin: 0;
}

.fp__dados--uma {
  grid-template-columns: minmax(0, 1fr);
}

.fp__dado dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.fp__dado dd {
  margin: 2px 0 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  overflow-wrap: anywhere;
}

.fp__vazio {
  color: var(--tinta-3) !important;
  font-weight: 450 !important;
}

.fp__preferido {
  margin-inline-start: 6px;
  color: var(--ok-tinta);
  font-size: 11.5px;
  font-weight: 600;
}

.fp__alerta .ui-linha__titulo {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.fp__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.fp__nada {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.fp__recolher {
  justify-self: start;
}

.fp__encerrados {
  opacity: 0.85;
}

.fp__faixa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 16px;
  border-radius: 14px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 14px;
}

.fp__sem-acesso {
  justify-items: center;
  padding: 48px 16px;
  text-align: center;
}

.fp__sem-acesso > i {
  color: var(--tinta-3);
  font-size: 26px;
}

.fp__entrada {
  display: none;
}
</style>
