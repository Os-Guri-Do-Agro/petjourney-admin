<script setup lang="ts">
/**
 * Cadastrar paciente pela API (E2-01, PJ-ECWI3Z, seção 1.4), fora da demonstração.
 *
 * Uma folha em duas partes: o pet e quem responde por ele. O responsável é um cliente da casa,
 * achado pela busca (nome, telefone ou CPF do cliente; a API não tem lista de clientes, ele vem
 * na linha do paciente), ou um cliente novo, criado junto. CPF que já é de um cliente desta casa
 * (409 `CPF_JA_CADASTRADO`): a tela oferece usar aquele cliente.
 *
 * "Cadastrar" leva `Idempotency-Key`, uma por ação: o clique duplo não cria dois. Depois, a ficha
 * do paciente novo, de onde sai o que se faz com ele em seguida.
 */
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import {
  clienteParaApi,
  clienteVazio,
  validarCliente,
  type CamposDoCliente,
  type ErrosDoCliente,
} from '@/components/cadastro/campos'
import ClienteCampos from '@/components/cadastro/ClienteCampos.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import {
  camposVazios,
  validarPaciente,
  type CamposDoPaciente,
  type ErrosDoPaciente,
} from '@/components/cadastro/campos'
import PacienteCampos from '@/components/cadastro/PacienteCampos.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
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

import '@/components/parceiro/estabelecimento/gaveta.css'
import '@/components/settings/configuracoes.css'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

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

watch(termo, (valor) => {
  clearTimeout(espera)

  if (!termoDaBusca(valor)) {
    resultados.value = []
    return
  }

  espera = setTimeout(async () => {
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
  }, 300)
})

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

/*
 * Depois da primeira tentativa, a validação acompanha o que se digita: o erro sai assim que o
 * campo fica certo, sem esperar o próximo clique.
 */
const tentou = ref(false)

watch(
  paciente,
  (campos) => {
    if (tentou.value) errosDoPaciente.value = validarPaciente(campos, t)
  },
  { deep: true },
)

watch(
  cliente,
  (campos) => {
    if (tentou.value && responsavel.value === 'novo')
      errosDoCliente.value = validarCliente(campos, t)
  },
  { deep: true },
)

watch(escolhido, (valor) => {
  if (valor) faltaCliente.value = false
})

async function cadastrar() {
  tentou.value = true
  erroGeral.value = ''
  cpfDeOutroCliente.value = null
  errosDoPaciente.value = validarPaciente(paciente.value, t)
  errosDoCliente.value = responsavel.value === 'novo' ? validarCliente(cliente.value, t) : {}
  faltaCliente.value = responsavel.value === 'existente' && !escolhido.value

  if (
    Object.keys(errosDoPaciente.value).length ||
    Object.keys(errosDoCliente.value).length ||
    faltaCliente.value
  ) {
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
    void router.replace(`/clinica/ficha/${criado.id}`)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))

    if (lido.codigo === 'CPF_JA_CADASTRADO' && lido.clienteId) {
      cpfDeOutroCliente.value = lido.clienteId
      errosDoCliente.value = { cpf: lido.mensagem }
    } else if (lido.campo && responsavel.value === 'novo' && lido.campo in cliente.value) {
      errosDoCliente.value = { [lido.campo]: lido.mensagem }
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
</script>

<template>
  <UiPagina class="tela-paciente-novo" :titulo="t('cadastro.novo.titulo')" icone="ph ph-paw-print">
    <template #resumo>
      <RouterLink class="pn__voltar" to="/clinica/pacientes">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('cadastro.lista.titulo') }}
      </RouterLink>
    </template>

    <form class="ui-folha cfg-folha" novalidate @submit.prevent="cadastrar">
      <section class="cfg-secao" aria-labelledby="pn-pet">
        <header class="cfg-secao__cabeca">
          <span class="ui-ladrilho cfg-secao__ladrilho" aria-hidden="true">
            <i class="ph ph-paw-print" />
          </span>
          <h2 id="pn-pet" class="cfg-secao__titulo">{{ t('cadastro.novo.pet') }}</h2>
          <p class="cfg-secao__descricao">{{ t('cadastro.novo.petDica') }}</p>
        </header>
        <div class="cfg-secao__corpo eg">
          <PacienteCampos
            id="pn"
            v-model="paciente"
            :erros="errosDoPaciente"
            :desabilitado="salvando"
          />
        </div>
      </section>

      <section class="cfg-secao" aria-labelledby="pn-responsavel">
        <header class="cfg-secao__cabeca">
          <span class="ui-ladrilho cfg-secao__ladrilho" aria-hidden="true">
            <i class="ph ph-user" />
          </span>
          <h2 id="pn-responsavel" class="cfg-secao__titulo">
            {{ t('cadastro.novo.responsavel') }}
          </h2>
          <p class="cfg-secao__descricao">{{ t('cadastro.novo.responsavelDica') }}</p>
        </header>
        <div class="cfg-secao__corpo eg">
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
            <div v-if="escolhido" class="pn__escolhido">
              <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"
                ><i class="ph ph-user"
              /></span>
              <span class="pn__escolhido-texto">
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
                <label class="eg__rotulo" for="pn-busca">{{
                  t('cadastro.novo.procurarCliente')
                }}</label>
                <IconField>
                  <InputIcon :class="buscando ? 'ph ph-spinner-gap' : 'ph ph-magnifying-glass'" />
                  <InputText
                    id="pn-busca"
                    v-model="termo"
                    type="search"
                    autocomplete="off"
                    :placeholder="t('cadastro.novo.procurarExemplo')"
                    :invalid="faltaCliente"
                  />
                </IconField>
                <small v-if="faltaCliente" class="eg__invalido">{{
                  t('cadastro.novo.faltaCliente')
                }}</small>
              </section>

              <ul v-if="clientes.length" class="ui-lista pn__clientes">
                <li v-for="item in clientes" :key="item.id">
                  <Button
                    unstyled
                    type="button"
                    class="ui-linha ui-linha--clicavel pn__cliente"
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
              id="pnc"
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
        </div>
      </section>

      <footer class="cfg-rodape">
        <p v-if="erroGeral" class="eg__erro pn__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroGeral }}</span>
        </p>
        <RouterLink
          class="p-button p-component p-button-secondary p-button-outlined"
          to="/clinica/pacientes"
        >
          {{ t('cadastro.cancelar') }}
        </RouterLink>
        <Button
          type="submit"
          icon="ph ph-check"
          :label="t('cadastro.novo.cadastrar')"
          :loading="salvando"
        />
      </footer>
    </form>
  </UiPagina>
</template>

<style scoped>
.pn__voltar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: inherit;
  font-weight: 600;
  text-decoration: none;
}

.pn__voltar:hover {
  text-decoration: underline;
}

.pn__escolhido {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: 14px;
}

.pn__escolhido-texto {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.pn__escolhido-texto strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.pn__clientes {
  max-height: 20rem;
  overflow-y: auto;
}

.pn__cliente {
  width: 100%;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.pn__erro {
  flex: 1 1 16rem;
}
</style>
