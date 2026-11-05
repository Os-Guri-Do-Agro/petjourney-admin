<script setup lang="ts">
/**
 * Editar o responsável (E2-01, seção 1.5): `PATCH /parceiro/portal/clientes/:id` só com o que
 * mudou. Telefone e CPF inválidos voltam para o campo; cliente mesclado (409 `CADASTRO_MESCLADO`)
 * e anonimizado (409 `CLIENTE_ANONIMIZADO`) mostram a mensagem da API.
 */
import Button from 'primevue/button'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import {
  camposDoCliente,
  clienteParaApi,
  clienteVazio,
  validarCliente,
  type CamposDoCliente,
  type ErrosDoCliente,
} from '@/components/cadastro/campos'
import ClienteCampos from '@/components/cadastro/ClienteCampos.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  editarCliente,
  type Cliente,
  type EdicaoDoCliente,
} from '@/service/parceiro/pacientes-service'

const props = defineProps<{ cliente: Cliente | null }>()
const emit = defineEmits<{ salvo: [cliente: Cliente] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const campos = ref<CamposDoCliente>(clienteVazio())
const erros = ref<ErrosDoCliente>({})
const erroGeral = ref('')
const salvando = ref(false)
/* Depois de tentar salvar, o erro do campo sai assim que ele fica certo. */
let tentou = false

watch(visible, (aberta) => {
  if (aberta && props.cliente) {
    tentou = false
    campos.value = camposDoCliente(props.cliente)
    erros.value = {}
    erroGeral.value = ''
  }
})

watch(
  campos,
  (atuais) => {
    if (tentou) erros.value = validarCliente(atuais, t)
  },
  { deep: true },
)

async function salvar() {
  tentou = true
  if (!props.cliente) return

  erros.value = validarCliente(campos.value, t)
  erroGeral.value = ''
  if (Object.keys(erros.value).length) return

  const antes = clienteParaApi(camposDoCliente(props.cliente))
  const depois = clienteParaApi(campos.value)
  const edicao: EdicaoDoCliente = {}

  for (const chave of Object.keys(depois) as (keyof typeof depois)[]) {
    if (depois[chave] !== antes[chave]) {
      ;(edicao as Record<string, unknown>)[chave] = depois[chave]
    }
  }

  if (!Object.keys(edicao).length) {
    visible.value = false
    return
  }

  salvando.value = true

  try {
    emit('salvo', await editarCliente(props.cliente.id, edicao, parceiroQuery()))
    visible.value = false
  } catch (err) {
    const erro = lerErroDoCadastro(err, t('cadastro.erros.salvar'))

    if (erro.campo && erro.campo in campos.value) {
      erros.value = { [erro.campo]: erro.mensagem }
    } else {
      erroGeral.value = erro.mensagem
    }
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="t('cadastro.ficha.editarResponsavel')"
    icone="ph ph-user"
  >
    <form id="cliente-edicao" class="eg" novalidate @submit.prevent="salvar">
      <ClienteCampos id="ce" v-model="campos" :erros="erros" :desabilitado="salvando" />
      <p v-if="erroGeral" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroGeral }}</span>
      </p>
    </form>

    <template #pe>
      <Button
        type="button"
        :label="t('cadastro.cancelar')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="visible = false"
      />
      <Button
        type="submit"
        form="cliente-edicao"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
