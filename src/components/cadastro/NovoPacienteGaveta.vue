<script setup lang="ts">
/**
 * Cadastrar paciente pela API (E2-01, PJ-ECWI3Z, seção 1.4), numa gaveta lateral em passos, aberta
 * na própria lista de Pacientes (pedido do Luís, 17/11/2026: "cadastro de paciente deveria ser
 * modal lateral com step"). Antes era uma página inteira, `/clinica/paciente/novo`, que agora só
 * redireciona para cá (`/clinica/pacientes?novo=1`).
 *
 * Um assunto por passo:
 * 1. Responsável: um cliente que já é da casa, achado pela busca (a lista aparece ao clicar no
 *    campo), ou um cliente novo, criado junto. CPF que já é de um cliente desta casa (409
 *    `CPF_JA_CADASTRADO`): volta aqui e oferece usar aquele cliente.
 * 2. Pet: nome e espécie (obrigatórios), raça, sexo e castrado.
 * 3. Detalhes: nascimento, porte, peso, microchip e pelagem, todos opcionais.
 *
 * "Cadastrar" leva `Idempotency-Key`, uma por ação: o clique duplo não cria dois. Depois, a ficha
 * do paciente novo, de onde sai o que se faz com ele em seguida. Fechar pelo X guarda o que já foi
 * preenchido; "Cancelar" descarta.
 */
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import {
  camposVazios,
  clienteParaApi,
  clienteVazio,
  validarCliente,
  validarPaciente,
  type CamposDoCliente,
  type CamposDoPaciente,
  type ErrosDoCliente,
  type ErrosDoPaciente,
} from '@/components/cadastro/campos'
import ClienteCampos from '@/components/cadastro/ClienteCampos.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import PacienteCampos from '@/components/cadastro/PacienteCampos.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  criarPaciente,
  listarPacientes,
  obterCliente,
  telefoneNaTela,
  termoDaBusca,
  type NovoPaciente,
  type PacienteNaLista,
} from '@/service/parceiro/pacientes-service'

const aberta = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

/* -------------------------------------------------------------------------------- passos */

type IdDoPasso = 'responsavel' | 'pet' | 'detalhes'

const passos = computed(() =>
  (
    [
      ['responsavel', 'cadastro.novo.responsavelDica'],
      ['pet', 'cadastro.novo.petDica'],
      ['detalhes', 'cadastro.novo.detalhesDica'],
    ] as const
  ).map(([id, dica]) => ({
    id: id as IdDoPasso,
    rotulo: t(`cadastro.novo.passos.${id}`),
    dica: t(dica),
  })),
)

const passo = ref(0)
const ultimo = computed(() => passo.value === passos.value.length - 1)

/** Os campos do pet que moram no passo 2; o resto do pet é do passo 3. */
const CAMPOS_DO_PASSO_PET = new Set(['nome', 'especie', 'especieOutra', 'raca', 'sexo', 'castrado'])

const formulario = ref<HTMLFormElement | null>(null)

/* Trocar de passo volta a gaveta para o alto; no passo do pet, o cursor já vai para o nome. */
watch(passo, async (agora) => {
  await nextTick()
  formulario.value?.closest('.p-drawer-content')?.scrollTo({ top: 0 })
  if (passos.value[agora]?.id === 'pet') document.getElementById('np-nome')?.focus()
})

/* --------------------------------------------------------------------------- o paciente */

const paciente = ref<CamposDoPaciente>(camposVazios())
const errosDoPaciente = ref<ErrosDoPaciente>({})

type Responsavel = 'existente' | 'novo'
const responsavel = ref<Responsavel>('existente')

const opcoesDeResponsavel = computed(() => [
  { valor: 'existente', rotulo: t('cadastro.novo.clienteDaCasa') },
  { valor: 'novo', rotulo: t('cadastro.novo.clienteNovo') },
])

/* ------------------------------------------------------------- o cliente que já existe */

type ClienteEscolhido = { id: string; nome: string; telefone: string | null }

const termo = ref('')
const resultados = ref<PacienteNaLista[]>([])
const buscando = ref(false)
const escolhido = ref<ClienteEscolhido | null>(null)
const faltaCliente = ref(false)

let espera: ReturnType<typeof setTimeout> | undefined
let pedido = 0

/** Clicou no campo: os clientes da casa aparecem já, sem esperar a digitação. */
const listaAberta = ref(false)

function abrirLista() {
  if (listaAberta.value) return
  listaAberta.value = true
  if (!termoDaBusca(termo.value)) void procurar('')
}

watch(termo, (valor) => {
  clearTimeout(espera)

  if (!termoDaBusca(valor) && !listaAberta.value) {
    resultados.value = []
    return
  }

  espera = setTimeout(() => void procurar(valor), 300)
})

async function procurar(valor: string) {
  const atual = ++pedido
  buscando.value = true

  try {
    const pagina = await listarPacientes({ q: valor, limit: 30 }, parceiroQuery())
    if (atual === pedido) resultados.value = pagina.itens
  } catch {
    if (atual === pedido) resultados.value = []
  } finally {
    if (atual === pedido) buscando.value = false
  }
}

onUnmounted(() => clearTimeout(espera))

/** Um por cliente, com os pets dele para reconhecer ("Marina Prado · Bolota, Tofu"). */
const clientes = computed(() => {
  const porId = new Map<string, ClienteEscolhido & { pets: string[] }>()

  for (const item of resultados.value) {
    const atual = porId.get(item.cliente.id)

    if (atual) {
      atual.pets.push(item.nome)
    } else {
      porId.set(item.cliente.id, { ...item.cliente, pets: [item.nome] })
    }
  }

  return [...porId.values()]
})

function escolher(cliente: ClienteEscolhido) {
  escolhido.value = { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone }
  faltaCliente.value = false
}

/* ------------------------------------------------------------------- o cliente novo */

const cliente = ref<CamposDoCliente>(clienteVazio())
const errosDoCliente = ref<ErrosDoCliente>({})

/* ------------------------------------------------------------------------- cadastrar */

const salvando = ref(false)
const erroGeral = ref('')
/** O CPF já é de um cliente desta casa: o id dele, para "usar este cliente". */
const cpfDeOutroCliente = ref<string | null>(null)

/*
 * Depois da primeira tentativa de seguir, a validação acompanha o que se digita: o erro sai assim
 * que o campo fica certo, sem esperar o próximo clique.
 */
const tentouCliente = ref(false)
const tentouPaciente = ref(false)

watch(
  paciente,
  (campos) => {
    if (tentouPaciente.value) errosDoPaciente.value = validarPaciente(campos, t)
  },
  { deep: true },
)

watch(
  cliente,
  (campos) => {
    if (tentouCliente.value && responsavel.value === 'novo') {
      errosDoCliente.value = validarCliente(campos, t)
    }
  },
  { deep: true },
)

watch(escolhido, (valor) => {
  if (valor) faltaCliente.value = false
})

function corpo(): NovoPaciente {
  const campos = paciente.value
  const texto = (valor: string) => (valor.trim() ? valor.trim() : null)

  const base: NovoPaciente = {
    nome: campos.nome.trim(),
    especie: campos.especie!,
    especieOutra: campos.especie === 'OUTRO' ? texto(campos.especieOutra) : null,
    raca: texto(campos.raca),
    sexo: campos.sexo,
    nascimento: campos.nascimento || null,
    nascimentoEstimado: Boolean(campos.nascimento) && campos.nascimentoEstimado,
    castrado: campos.castrado,
    porte: campos.porte,
    pesoKg: campos.pesoKg,
    microchip: texto(campos.microchip),
    pelagem: texto(campos.pelagem),
  }

  return responsavel.value === 'existente' && escolhido.value
    ? { ...base, clienteId: escolhido.value.id }
    : { ...base, cliente: clienteParaApi(cliente.value) }
}

function responsavelPronto() {
  if (responsavel.value === 'existente') {
    faltaCliente.value = !escolhido.value
    return !faltaCliente.value
  }

  tentouCliente.value = true
  errosDoCliente.value = validarCliente(cliente.value, t)
  return !Object.keys(errosDoCliente.value).length
}

function petPronto() {
  tentouPaciente.value = true
  errosDoPaciente.value = validarPaciente(paciente.value, t)
  return !Object.keys(errosDoPaciente.value).length
}

function avancar() {
  erroGeral.value = ''
  const atual = passos.value[passo.value]?.id

  if (atual === 'responsavel') {
    if (responsavelPronto()) passo.value = 1
    return
  }

  if (atual === 'pet') {
    if (petPronto()) passo.value = 2
    return
  }

  void cadastrar()
}

async function cadastrar() {
  cpfDeOutroCliente.value = null

  if (!responsavelPronto()) {
    passo.value = 0
    return
  }

  if (!petPronto()) {
    passo.value = 1
    return
  }

  const dados = corpo()
  salvando.value = true

  try {
    const criado = await criarPaciente(dados, chaveador.para(dados), parceiroQuery())

    chaveador.concluir()
    toast.add({
      severity: 'success',
      summary: t('cadastro.novo.criado', { nome: criado.nome }),
      life: 3500,
    })
    aberta.value = false
    limpar()
    void router.push(`/clinica/ficha/${criado.id}`)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))

    if (lido.codigo === 'CPF_JA_CADASTRADO' && lido.clienteId) {
      cpfDeOutroCliente.value = lido.clienteId
      errosDoCliente.value = { cpf: lido.mensagem }
      passo.value = 0
    } else if (lido.campo && responsavel.value === 'novo' && lido.campo in cliente.value) {
      errosDoCliente.value = { [lido.campo]: lido.mensagem }
      passo.value = 0
    } else if (lido.campo && lido.campo in paciente.value) {
      errosDoPaciente.value = { [lido.campo]: lido.mensagem }
      passo.value = CAMPOS_DO_PASSO_PET.has(lido.campo) ? 1 : 2
    } else {
      erroGeral.value = lido.mensagem
    }
  } finally {
    salvando.value = false
  }
}

async function usarClienteDoCpf() {
  const id = cpfDeOutroCliente.value
  if (!id) return

  try {
    const existente = await obterCliente(id, parceiroQuery())

    escolhido.value = { id: existente.id, nome: existente.nome, telefone: existente.telefone }
    responsavel.value = 'existente'
    cpfDeOutroCliente.value = null
    errosDoCliente.value = {}
  } catch (err) {
    erroGeral.value = lerErroDoCadastro(err, t('cadastro.erros.carregar')).mensagem
  }
}

/** Volta tudo ao começo: depois de cadastrar e no "Cancelar". */
function limpar() {
  clearTimeout(espera)
  passo.value = 0
  paciente.value = camposVazios()
  errosDoPaciente.value = {}
  responsavel.value = 'existente'
  termo.value = ''
  resultados.value = []
  escolhido.value = null
  faltaCliente.value = false
  listaAberta.value = false
  cliente.value = clienteVazio()
  errosDoCliente.value = {}
  erroGeral.value = ''
  cpfDeOutroCliente.value = null
  tentouCliente.value = false
  tentouPaciente.value = false
}

function cancelar() {
  aberta.value = false
  limpar()
}

function voltar() {
  erroGeral.value = ''
  passo.value = Math.max(0, passo.value - 1)
}

/** Os passos já feitos podem ser revistos pelo número; os da frente, só pelo "Continuar". */
function irPara(indice: number) {
  if (indice < passo.value && !salvando.value) passo.value = indice
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('cadastro.novo.titulo')"
    icone="ph ph-paw-print"
    largura="34rem"
  >
    <ol class="np__passos" :aria-label="t('cadastro.novo.passos.rotulo')">
      <li
        v-for="(item, indice) in passos"
        :key="item.id"
        class="np__passo"
        :class="{
          'np__passo--feito': indice < passo,
          'np__passo--agora': indice === passo,
        }"
      >
        <button
          type="button"
          class="np__ir"
          :disabled="indice >= passo || salvando"
          :aria-current="indice === passo ? 'step' : undefined"
          @click="irPara(indice)"
        >
          <span class="np__numero" aria-hidden="true">
            <i v-if="indice < passo" class="ph ph-check" />
            <template v-else>{{ indice + 1 }}</template>
          </span>
          <span class="np__nome">{{ item.rotulo }}</span>
        </button>
      </li>
    </ol>

    <form
      id="novo-paciente"
      ref="formulario"
      class="eg np__form"
      novalidate
      @submit.prevent="avancar"
    >
      <p class="np__dica">{{ passos[passo]?.dica }}</p>

      <!-- 1. Quem responde pelo pet. -->
      <template v-if="passo === 0">
        <SelectButton
          v-model="responsavel"
          :options="opcoesDeResponsavel"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('cadastro.novo.responsavel')"
          :disabled="salvando"
        />

        <template v-if="responsavel === 'existente'">
          <div v-if="escolhido" class="np__escolhido">
            <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
              ><i class="ph ph-user"
            /></span>
            <span class="np__escolhido-texto">
              <strong>{{ escolhido.nome }}</strong>
              <span v-if="escolhido.telefone" class="ui-num">
                <bdi dir="ltr">{{ telefoneNaTela(escolhido.telefone) }}</bdi>
              </span>
            </span>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('cadastro.novo.trocar')"
              :disabled="salvando"
              @click="escolhido = null"
            />
          </div>

          <template v-else>
            <section class="eg__secao">
              <label class="eg__rotulo" for="np-busca">{{
                t('cadastro.novo.procurarCliente')
              }}</label>
              <IconField>
                <InputIcon :class="buscando ? 'ph ph-spinner-gap' : 'ph ph-magnifying-glass'" />
                <InputText
                  id="np-busca"
                  v-model="termo"
                  type="search"
                  autocomplete="off"
                  :placeholder="t('cadastro.novo.procurarExemplo')"
                  :invalid="faltaCliente"
                  @focus="abrirLista"
                />
              </IconField>
              <small v-if="faltaCliente" class="eg__invalido">{{
                t('cadastro.novo.faltaCliente')
              }}</small>
            </section>

            <ul v-if="clientes.length" class="ui-lista np__clientes">
              <li v-for="item in clientes" :key="item.id">
                <Button
                  unstyled
                  type="button"
                  class="ui-linha ui-linha--clicavel np__cliente"
                  @click="escolher(item)"
                >
                  <span class="ui-linha__texto">
                    <strong class="ui-linha__titulo">{{ item.nome }}</strong>
                    <span class="ui-linha__meta">
                      {{
                        [telefoneNaTela(item.telefone), item.pets.join(', ')]
                          .filter(Boolean)
                          .join(' · ')
                      }}
                    </span>
                  </span>
                  <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
                </Button>
              </li>
            </ul>
            <p v-else-if="termoDaBusca(termo) && !buscando" class="eg__dica">
              {{ t('cadastro.novo.nenhumCliente') }}
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('cadastro.novo.cadastrarNovo')"
                @click="responsavel = 'novo'"
              />
            </p>
          </template>
        </template>

        <template v-else>
          <ClienteCampos
            id="npc"
            v-model="cliente"
            :erros="errosDoCliente"
            :desabilitado="salvando"
          />
          <p v-if="cpfDeOutroCliente" class="eg__aviso" role="alert">
            <i class="ph ph-info" aria-hidden="true" />
            <span>{{ t('cadastro.novo.cpfDeOutro') }}</span>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('cadastro.novo.usarEsteCliente')"
              @click="usarClienteDoCpf"
            />
          </p>
        </template>
      </template>

      <!-- 2. O pet: o essencial. 3. Os detalhes, todos opcionais. -->
      <PacienteCampos
        v-else
        id="np"
        v-model="paciente"
        :parte="passo === 1 ? 'essencial' : 'detalhes'"
        :erros="errosDoPaciente"
        :desabilitado="salvando"
      />

      <p v-if="erroGeral" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroGeral }}</span>
      </p>
    </form>

    <template #pe>
      <Button
        v-if="passo === 0"
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="cancelar"
      />
      <Button
        v-else
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        :label="t('cadastro.novo.voltar')"
        :disabled="salvando"
        @click="voltar"
      />
      <Button
        type="submit"
        form="novo-paciente"
        :icon="ultimo ? 'ph ph-check' : 'ph ph-arrow-right'"
        :icon-pos="ultimo ? 'left' : 'right'"
        :label="ultimo ? t('cadastro.novo.cadastrar') : t('cadastro.novo.continuar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
/*
 * Os passos no alto da gaveta: número na bolinha e o nome ao lado, ligados por um fio. O passo de
 * agora fica na cor principal; os feitos, com o visto, voltam pelo clique.
 */
.np__passos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.np__passo {
  min-width: 0;
}

/* O fio até o passo seguinte, depois do nome, ocupando o que sobra da coluna. */
.np__passo:not(:last-child) .np__ir::after {
  flex: 1 0 10px;
  height: 2px;
  border-radius: 2px;
  background: var(--linha);
  content: '';
}

.np__passo--feito:not(:last-child) .np__ir::after {
  background: color-mix(in oklab, var(--p-primary-color) 55%, var(--linha));
}

.np__ir {
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
  font-size: 13.5px;
  font-weight: 600;
  text-align: start;
  cursor: default;
}

.np__passo--feito .np__ir {
  color: var(--tinta-2);
  cursor: pointer;
}

.np__passo--feito .np__ir:hover {
  background: color-mix(in oklab, var(--linha) 60%, transparent);
}

.np__ir:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

.np__passo--agora .np__ir {
  color: var(--tinta);
  font-weight: 700;
}

.np__numero {
  display: grid;
  flex: none;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1.5px solid var(--linha);
  border-radius: 50%;
  font-family: var(--font-dados);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.np__passo--agora .np__numero {
  border-color: var(--p-primary-color);
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.np__passo--feito .np__numero {
  border-color: color-mix(in oklab, var(--p-primary-color) 55%, var(--linha));
  background: color-mix(in oklab, var(--p-primary-color) 18%, transparent);
  color: var(--tinta);
  font-size: 15px;
}

.np__nome {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np__dica {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.np__escolhido {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: 14px;
}

.np__escolhido-texto {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.np__escolhido-texto strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.np__clientes {
  max-height: 22rem;
  overflow-y: auto;
}

.np__cliente {
  width: 100%;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
</style>
