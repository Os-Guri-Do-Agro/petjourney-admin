<script setup lang="ts">
/**
 * Juntar dois cadastros duplicados (E2-01, seção 1.10; só DONO ou GESTOR).
 *
 * - **Paciente:** o desta ficha fica; o histórico do outro passa para ele, os campos vazios daqui
 *   herdam os de lá, e o outro fica inativo "duplicado".
 * - **Responsável:** o desta ficha fica; pacientes, autorizados e o CPF do outro vêm para cá. O
 *   contato, o documento e o endereço do outro são apagados: o que faltava aqui é copiado, e o que
 *   divergia se perde (o daqui vence). Por isso os dois aparecem lado a lado antes de confirmar.
 *
 * O outro é achado pela busca de pacientes (nome do pet, do responsável ou telefone): a API não
 * tem lista de clientes, e o cliente vem na linha do paciente.
 */
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  listarPacientes,
  mesclarCliente,
  mesclarPaciente,
  obterCliente,
  telefoneNaTela,
  termoDaBusca,
  type Cliente,
  type Paciente,
  type PacienteNaLista,
} from '@/service/parceiro/pacientes-service'

const props = defineProps<{ tipo: 'paciente' | 'cliente'; paciente: Paciente | null }>()
const emit = defineEmits<{ mesclado: [] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

const termo = ref('')
const resultados = ref<PacienteNaLista[]>([])
const buscando = ref(false)
const escolhido = ref<PacienteNaLista | null>(null)
const outroCliente = ref<Cliente | null>(null)
const erro = ref('')
const mesclando = ref(false)

watch(visible, (aberta) => {
  if (!aberta) return

  termo.value = ''
  resultados.value = []
  escolhido.value = null
  outroCliente.value = null
  erro.value = ''
})

let espera: ReturnType<typeof setTimeout> | undefined
let pedido = 0

watch(termo, (valor) => {
  clearTimeout(espera)
  escolhido.value = null
  outroCliente.value = null

  if (!termoDaBusca(valor)) {
    resultados.value = []
    return
  }

  espera = setTimeout(async () => {
    const atual = ++pedido
    buscando.value = true

    try {
      const pagina = await listarPacientes({ q: valor, limit: 20 }, parceiroQuery())
      if (atual === pedido) resultados.value = pagina.itens
    } catch (err) {
      if (atual === pedido) erro.value = lerErroDoCadastro(err, t('cadastro.lista.erro')).mensagem
    } finally {
      if (atual === pedido) buscando.value = false
    }
  }, 300)
})

onUnmounted(() => clearTimeout(espera))

/** Os candidatos: outros pacientes, ou os outros responsáveis (um por cliente). */
const candidatos = computed(() => {
  const atual = props.paciente
  if (!atual) return []

  if (props.tipo === 'paciente') {
    return resultados.value.filter((item) => item.id !== atual.id)
  }

  const vistos = new Set<string>([atual.cliente.id])

  return resultados.value.filter((item) => {
    if (vistos.has(item.cliente.id)) return false
    vistos.add(item.cliente.id)
    return true
  })
})

async function escolher(item: PacienteNaLista) {
  escolhido.value = item
  outroCliente.value = null
  erro.value = ''

  if (props.tipo === 'cliente') {
    try {
      outroCliente.value = await obterCliente(item.cliente.id, parceiroQuery())
    } catch (err) {
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

async function mesclar() {
  const atual = props.paciente
  const outro = escolhido.value
  if (!atual || !outro) return

  mesclando.value = true
  erro.value = ''

  try {
    if (props.tipo === 'paciente') {
      await mesclarPaciente(atual.id, outro.id, parceiroQuery())
    } else {
      await mesclarCliente(atual.cliente.id, outro.cliente.id, parceiroQuery())
    }

    emit('mesclado')
    visible.value = false
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    erro.value = lido.codigo === 'ALERTAS_NO_LIMITE' ? t('cadastro.alerta.noLimite') : lido.mensagem
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
          :placeholder="t('cadastro.lista.buscar')"
          :disabled="mesclando"
        />
      </IconField>
    </section>

    <ul v-if="candidatos.length && !escolhido" class="ui-lista ms__lista">
      <li v-for="item in candidatos" :key="item.id">
        <Button
          unstyled
          type="button"
          class="ui-linha ui-linha--clicavel ms__linha"
          @click="escolher(item)"
        >
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">
              {{ tipo === 'paciente' ? item.nome : item.cliente.nome }}
            </strong>
            <span class="ui-linha__meta">
              {{
                tipo === 'paciente'
                  ? `${rotulos.especie(item)} · ${item.cliente.nome}`
                  : [telefoneNaTela(item.cliente.telefone), item.nome].filter(Boolean).join(' · ')
              }}
            </span>
          </span>
          <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
        </Button>
      </li>
    </ul>
    <p v-else-if="termoDaBusca(termo) && !buscando && !candidatos.length" class="eg__dica">
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
                  de: escolhido.cliente.nome,
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
        :disabled="!escolhido || (tipo === 'cliente' && !outroCliente)"
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
