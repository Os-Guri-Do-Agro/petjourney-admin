<script setup lang="ts">
/**
 * Juntar dois cadastros duplicados (E2-01, seção 1.10; só DONO ou GESTOR).
 *
 * - **Paciente:** o desta ficha fica; o histórico do outro passa para ele, os campos vazios daqui
 *   herdam os de lá, e o outro fica inativo "duplicado". O pedido de horário pelo link vai junto.
 * - **Responsável:** o desta ficha fica; pacientes, autorizados e o CPF do outro vêm para cá. O
 *   contato, o documento e o endereço do outro são apagados: o que faltava aqui é copiado, e o que
 *   divergia se perde (o daqui vence). Por isso os dois aparecem lado a lado antes de confirmar.
 *
 * O outro paciente é achado pela busca de pacientes (nome do pet, do responsável ou telefone). O
 * outro responsável, pela lista de clientes (N54): o nome, ou o telefone com ou sem o 55 (o principal
 * ou o secundário), com os pacientes ativos de cada um e "Carregar mais"; o cliente sem paciente
 * ativo também aparece. Telefone com menos de 8 dígitos: 400 `TELEFONE_INVALIDO`, "incompleto".
 *
 * Juntar leva 6 a 7 s (N20/N55): a gaveta diz que está juntando. O limite de 30 por hora (429) e a
 * operação que ainda passa do prazo (503, nada mudou) dizem em quanto tempo tentar de novo; o
 * cadastro preso por outra operação (409 `CADASTRO_EM_USO`) mostra a frase da API.
 */
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { iniciais, useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { ApiError } from '@/service/api'
import {
  listarClientes,
  listarPacientes,
  mesclarCliente,
  mesclarPaciente,
  obterCliente,
  telefoneNaTela,
  termoDaBusca,
  type Cliente,
  type ClienteDaLista,
  type Paciente,
  type PacienteNaLista,
} from '@/service/parceiro/pacientes-service'
import { ESPECIE_DO_AVATAR } from '@/utils/parceiro/acesso-na-lista'

const props = defineProps<{ tipo: 'paciente' | 'cliente'; paciente: Paciente | null }>()
const emit = defineEmits<{ mesclado: [] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

const POR_PAGINA = 20

const termo = ref('')
/** Os pacientes da busca (juntar paciente). */
const resultados = ref<PacienteNaLista[]>([])
/** Os clientes da lista (juntar responsável), página a página. */
const clientes = ref<ClienteDaLista[]>([])
const proximoCursor = ref<string | null>(null)
const carregandoMais = ref(false)
const telefoneIncompleto = ref(false)
const buscando = ref(false)
/** O outro cadastro escolhido: o paciente, ou o responsável. */
const escolhido = ref<{ id: string; nome: string } | null>(null)
const outroCliente = ref<Cliente | null>(null)
const erro = ref('')
const mesclando = ref(false)

watch(visible, (aberta) => {
  if (!aberta) return

  termo.value = ''
  resultados.value = []
  clientes.value = []
  proximoCursor.value = null
  telefoneIncompleto.value = false
  escolhido.value = null
  outroCliente.value = null
  erro.value = ''
  listaAberta.value = false
})

let espera: ReturnType<typeof setTimeout> | undefined
let pedido = 0

/**
 * Clicou no campo: a lista aparece já, sem esperar a digitação (pedido do Luís, 17/11/2026). Sem
 * termo, vêm os primeiros da clínica; apagar o termo volta a eles.
 */
const listaAberta = ref(false)

function abrirLista() {
  if (listaAberta.value) return
  listaAberta.value = true
  if (!termoDaBusca(termo.value)) void procurar('')
}

watch(termo, (valor) => {
  clearTimeout(espera)
  escolhido.value = null
  outroCliente.value = null

  if (!termoDaBusca(valor) && !listaAberta.value) {
    resultados.value = []
    clientes.value = []
    proximoCursor.value = null
    telefoneIncompleto.value = false
    return
  }

  espera = setTimeout(() => void procurar(valor), 300)
})

/** O responsável se procura pelo nome (com letras) ou pelo telefone (só números). */
function filtroDoCliente(valor: string) {
  const filtro = termoDaBusca(valor)
  if (!filtro) return {}

  return /\p{L}/u.test(filtro) ? { q: filtro } : { telefone: filtro }
}

async function procurar(valor: string) {
  const atual = ++pedido
  buscando.value = true
  telefoneIncompleto.value = false

  try {
    if (props.tipo === 'paciente') {
      const pagina = await listarPacientes({ q: valor, limit: POR_PAGINA }, parceiroQuery())
      if (atual === pedido) resultados.value = pagina.itens
    } else {
      const pagina = await listarClientes(
        { ...filtroDoCliente(valor), limit: POR_PAGINA },
        parceiroQuery(),
      )
      if (atual !== pedido) return
      clientes.value = pagina.itens
      proximoCursor.value = pagina.proximoCursor
    }
  } catch (err) {
    if (atual !== pedido) return

    const lido = lerErroDoCadastro(err, t('cadastro.lista.erro'))
    if (lido.codigo === 'TELEFONE_INVALIDO') {
      telefoneIncompleto.value = true
      clientes.value = []
      proximoCursor.value = null
    } else {
      erro.value = lido.mensagem
    }
  } finally {
    if (atual === pedido) buscando.value = false
  }
}

async function carregarMais() {
  if (!proximoCursor.value || carregandoMais.value) return

  const atual = pedido
  carregandoMais.value = true

  try {
    const pagina = await listarClientes(
      { ...filtroDoCliente(termo.value), cursor: proximoCursor.value, limit: POR_PAGINA },
      parceiroQuery(),
    )
    if (atual !== pedido) return
    clientes.value = [...clientes.value, ...pagina.itens]
    proximoCursor.value = pagina.proximoCursor
  } catch (err) {
    if (atual === pedido) erro.value = lerErroDoCadastro(err, t('cadastro.lista.erro')).mensagem
  } finally {
    carregandoMais.value = false
  }
}

onUnmounted(() => clearTimeout(espera))

/** Os candidatos: os outros pacientes, ou os outros responsáveis. */
const pacientesCandidatos = computed(() =>
  props.paciente ? resultados.value.filter((item) => item.id !== props.paciente!.id) : [],
)
const clientesCandidatos = computed(() =>
  props.paciente ? clientes.value.filter((item) => item.id !== props.paciente!.cliente.id) : [],
)
const temCandidatos = computed(() =>
  props.tipo === 'paciente'
    ? pacientesCandidatos.value.length > 0
    : clientesCandidatos.value.length > 0,
)

/** "(11) 98411-2233 · Pacientes ativos: 2": os telefones mostram por que a busca achou. */
function metaDoCliente(cliente: ClienteDaLista) {
  return [
    telefoneNaTela(cliente.telefone),
    telefoneNaTela(cliente.telefoneSecundario),
    t('cadastro.mesclar.pacientesAtivos', { n: cliente.pacientesAtivos }),
  ]
    .filter(Boolean)
    .join(' · ')
}

function escolherPaciente(item: PacienteNaLista) {
  escolhido.value = { id: item.id, nome: item.nome }
  outroCliente.value = null
  erro.value = ''
}

async function escolherCliente(item: ClienteDaLista) {
  escolhido.value = { id: item.id, nome: item.nome }
  outroCliente.value = null
  erro.value = ''

  try {
    const lido = await obterCliente(item.id, parceiroQuery())
    if (escolhido.value?.id === item.id) outroCliente.value = lido
  } catch (err) {
    if (escolhido.value?.id === item.id) {
      erro.value = lerErroDoCadastro(err, t('cadastro.erros.carregar')).mensagem
    }
  }
}

/** Os campos do responsável lado a lado: o que fica, o que vem e o que se perde. */
const comparacao = computed(() => {
  const fica = props.paciente?.cliente
  const vem = outroCliente.value
  if (!fica || !vem) return []

  const linhas: { rotulo: string; fica: string; vem: string }[] = [
    { rotulo: t('cadastro.campos.nomeDoResponsavel'), fica: fica.nome, vem: vem.nome },
    {
      rotulo: t('cadastro.campos.telefone'),
      fica: telefoneNaTela(fica.telefone),
      vem: telefoneNaTela(vem.telefone),
    },
    { rotulo: t('cadastro.campos.email'), fica: fica.email ?? '', vem: vem.email ?? '' },
    { rotulo: t('cadastro.campos.cpf'), fica: fica.cpf ?? '', vem: vem.cpf ?? '' },
    {
      rotulo: t('cadastro.campos.endereco'),
      fica: [fica.logradouro, fica.numero, fica.cidade].filter(Boolean).join(', '),
      vem: [vem.logradouro, vem.numero, vem.cidade].filter(Boolean).join(', '),
    },
  ]

  return linhas.filter((linha) => linha.fica || linha.vem)
})

/** Divergiu e o daqui não está vazio: o do outro se perde. */
function perde(linha: { fica: string; vem: string }) {
  return Boolean(linha.fica && linha.vem && linha.fica !== linha.vem)
}

/** Em quanto tempo tentar de novo, no idioma da tela: "30 segundos", "50 minutos". */
function tempoParaTentar(err: unknown) {
  const segundos = err instanceof ApiError ? Number(err.detalhes.tenteDeNovoEmSegundos) : NaN
  if (!Number.isFinite(segundos) || segundos <= 0) return null

  const emMinutos = segundos >= 60

  return new Intl.NumberFormat(rotulos.intl(), {
    style: 'unit',
    unit: emMinutos ? 'minute' : 'second',
    unitDisplay: 'long',
  }).format(emMinutos ? Math.ceil(segundos / 60) : Math.ceil(segundos))
}

function erroDoMesclar(err: unknown) {
  const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
  const tempo = tempoParaTentar(err)

  switch (lido.codigo) {
    case 'ALERTAS_NO_LIMITE':
      return t('cadastro.alerta.noLimite')
    case 'MESCLA_TAXA_EXCEDIDA':
      return tempo ? t('cadastro.mesclar.taxa', { tempo }) : lido.mensagem
    case 'OPERACAO_DEMOROU_DEMAIS':
      return tempo ? t('cadastro.mesclar.demorou', { tempo }) : lido.mensagem
    default:
      return lido.mensagem
  }
}

async function mesclar() {
  const atual = props.paciente
  const outro = escolhido.value
  if (!atual || !outro || mesclando.value) return

  mesclando.value = true
  erro.value = ''

  try {
    if (props.tipo === 'paciente') {
      await mesclarPaciente(atual.id, outro.id, parceiroQuery())
    } else {
      await mesclarCliente(atual.cliente.id, outro.id, parceiroQuery())
    }

    emit('mesclado')
    visible.value = false
  } catch (err) {
    erro.value = erroDoMesclar(err)
  } finally {
    mesclando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="
      tipo === 'paciente'
        ? t('cadastro.mesclar.tituloPaciente')
        : t('cadastro.mesclar.tituloResponsavel')
    "
    icone="ph ph-git-merge"
    largura="34rem"
  >
    <p class="eg__dica">
      {{
        tipo === 'paciente'
          ? t('cadastro.mesclar.ledePaciente', { nome: paciente?.nome ?? '' })
          : t('cadastro.mesclar.ledeResponsavel', { nome: paciente?.cliente.nome ?? '' })
      }}
    </p>

    <section class="eg__secao">
      <label class="eg__rotulo" for="mesclar-busca">{{ t('cadastro.mesclar.procurar') }}</label>
      <IconField>
        <InputIcon :class="buscando ? 'ph ph-spinner-gap ms__girando' : 'ph ph-magnifying-glass'" />
        <InputText
          id="mesclar-busca"
          v-model="termo"
          type="search"
          autocomplete="off"
          :placeholder="
            tipo === 'paciente'
              ? t('cadastro.lista.buscar')
              : t('cadastro.mesclar.procurarResponsavel')
          "
          :invalid="telefoneIncompleto"
          :disabled="mesclando"
          @focus="abrirLista"
        />
      </IconField>
      <small v-if="telefoneIncompleto" class="eg__invalido">{{
        t('cadastro.mesclar.telefoneIncompleto')
      }}</small>
    </section>

    <!-- Juntar paciente: os outros pacientes da busca. -->
    <ul
      v-if="tipo === 'paciente' && pacientesCandidatos.length && !escolhido"
      class="ui-lista ms__lista"
    >
      <li v-for="item in pacientesCandidatos" :key="item.id">
        <Button
          unstyled
          type="button"
          class="ui-linha ui-linha--clicavel ms__linha"
          @click="escolherPaciente(item)"
        >
          <PetAvatar
            :nome="item.nome"
            :iniciais="iniciais(item.nome)"
            :especie="ESPECIE_DO_AVATAR[item.especie] ?? null"
            :foto-url="item.fotoUrl"
            tamanho="sm"
          />
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">{{ item.nome }}</strong>
            <span class="ui-linha__meta">
              {{ `${rotulos.especie(item)} · ${item.cliente.nome}` }}
            </span>
          </span>
          <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
        </Button>
      </li>
    </ul>

    <!-- Juntar responsável: os clientes da casa pelo nome ou pelo telefone (N54). -->
    <template v-else-if="tipo === 'cliente' && clientesCandidatos.length && !escolhido">
      <ul class="ui-lista ms__lista">
        <li v-for="item in clientesCandidatos" :key="item.id">
          <Button
            unstyled
            type="button"
            class="ui-linha ui-linha--clicavel ms__linha"
            @click="escolherCliente(item)"
          >
            <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
              ><i class="ph ph-user"
            /></span>
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ item.nome }}</strong>
              <span class="ui-linha__meta ui-num">{{ metaDoCliente(item) }}</span>
            </span>
            <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
          </Button>
        </li>
      </ul>
      <Button
        v-if="proximoCursor"
        type="button"
        size="small"
        severity="secondary"
        outlined
        class="ms__mais"
        :label="t('cadastro.lista.carregarMais')"
        :loading="carregandoMais"
        @click="carregarMais"
      />
    </template>
    <p
      v-else-if="termoDaBusca(termo) && !buscando && !temCandidatos && !telefoneIncompleto"
      class="eg__dica"
    >
      {{ t('cadastro.mesclar.nenhum') }}
    </p>

    <template v-if="escolhido">
      <div class="ms__previa" role="status">
        <i class="ph ph-arrow-right" aria-hidden="true" />
        <span>
          {{
            tipo === 'paciente'
              ? t('cadastro.mesclar.previaPaciente', {
                  de: escolhido.nome,
                  para: paciente?.nome ?? '',
                })
              : t('cadastro.mesclar.previaResponsavel', {
                  de: escolhido.nome,
                  para: paciente?.cliente.nome ?? '',
                })
          }}
        </span>
      </div>
      <table v-if="tipo === 'cliente' && comparacao.length" class="ms__comparacao">
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">{{ t('cadastro.mesclar.fica') }}</th>
            <th scope="col">{{ t('cadastro.mesclar.vem') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="linha in comparacao" :key="linha.rotulo">
            <th scope="row">{{ linha.rotulo }}</th>
            <td>{{ linha.fica || t('cadastro.mesclar.semDado') }}</td>
            <td :class="{ ms__perde: perde(linha) }">
              {{ linha.vem || t('cadastro.mesclar.semDado') }}
              <small v-if="perde(linha)">{{ t('cadastro.mesclar.sePerde') }}</small>
            </td>
          </tr>
        </tbody>
      </table>

      <p class="eg__aviso">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>
          {{
            tipo === 'paciente'
              ? t('cadastro.mesclar.semVoltaPaciente')
              : t('cadastro.mesclar.semVoltaResponsavel')
          }}
        </span>
      </p>
    </template>

    <!-- Juntar leva uns segundos (N55): quem está no balcão vê que está andando. -->
    <p v-if="mesclando" class="eg__dica ms__esperando" role="status" aria-live="polite">
      <i class="ph ph-spinner-gap ms__girando" aria-hidden="true" />
      <span>{{ t('cadastro.mesclar.esperando') }}</span>
    </p>

    <p v-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <template #pe>
      <Button
        v-if="escolhido"
        type="button"
        :label="t('cadastro.mesclar.trocar')"
        severity="secondary"
        outlined
        :disabled="mesclando"
        @click="escolhido = null"
      />
      <Button
        v-else
        type="button"
        :label="t('cadastro.cancelar')"
        severity="secondary"
        outlined
        @click="visible = false"
      />
      <Button
        type="button"
        icon="ph ph-git-merge"
        :label="t('cadastro.mesclar.confirmar')"
        :disabled="!escolhido || (tipo === 'cliente' && !outroCliente) || mesclando"
        :loading="mesclando"
        @click="mesclar"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ms__lista {
  max-height: 22rem;
  overflow-y: auto;
}

.ms__linha {
  width: 100%;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.ms__mais {
  justify-self: center;
}

.ms__esperando {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.ms__previa {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.ms__comparacao {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.ms__comparacao th,
.ms__comparacao td {
  padding: 8px 6px;
  border-bottom: 1px solid var(--linha-suave);
  color: var(--tinta);
  text-align: start;
  vertical-align: top;
}

.ms__comparacao thead th,
.ms__comparacao tbody th {
  color: var(--tinta-2);
  font-weight: 600;
}

.ms__perde {
  color: var(--tinta-2);
  text-decoration: line-through;
}

.ms__perde small {
  display: block;
  color: var(--atencao-tinta);
  text-decoration: none;
}

.ms__girando {
  animation: ms-girar 900ms linear infinite;
}

@keyframes ms-girar {
  to {
    rotate: 360deg;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ms__girando {
    animation: none;
  }
}
</style>
