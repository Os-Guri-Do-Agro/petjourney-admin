<script setup lang="ts">
/**
 * Editar os dados do paciente (E2-01, seção 1.5): `PATCH` só com o que mudou. Texto apagado vai
 * como `null` (limpa o campo opcional). A espécie só muda enquanto não houver atendimento; depois,
 * 409 `ESPECIE_IMUTAVEL`, que fica no campo.
 */
import Button from 'primevue/button'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import {
  camposVazios,
  validarPaciente,
  type CamposDoPaciente,
  type ErrosDoPaciente,
} from '@/components/cadastro/campos'
import PacienteCampos from '@/components/cadastro/PacienteCampos.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  editarPaciente,
  type EdicaoDoPaciente,
  type Paciente,
} from '@/service/parceiro/pacientes-service'

const props = defineProps<{ paciente: Paciente | null }>()
const emit = defineEmits<{ salvo: [paciente: Paciente] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const campos = ref<CamposDoPaciente>(camposVazios())
const erros = ref<ErrosDoPaciente>({})
const erroGeral = ref('')
const salvando = ref(false)
/* Depois de tentar salvar, o erro do campo sai assim que ele fica certo. */
let tentou = false

function doPaciente(paciente: Paciente): CamposDoPaciente {
  return {
    nome: paciente.nome,
    especie: paciente.especie,
    especieOutra: paciente.especieOutra ?? '',
    raca: paciente.raca ?? '',
    sexo: paciente.sexo,
    nascimento: paciente.nascimento ?? '',
    nascimentoEstimado: paciente.nascimentoEstimado,
    castrado: paciente.castrado,
    porte: paciente.porte,
    pesoKg: paciente.pesoKg,
    microchip: paciente.microchip ?? '',
    pelagem: paciente.pelagem ?? '',
  }
}

watch(visible, (aberta) => {
  if (aberta && props.paciente) {
    tentou = false
    campos.value = doPaciente(props.paciente)
    erros.value = {}
    erroGeral.value = ''
  }
})

/** Só o que mudou: o `PATCH` não reescreve o que a outra pessoa acabou de salvar. */
function mudancas(original: CamposDoPaciente, atual: CamposDoPaciente): EdicaoDoPaciente {
  const edicao: EdicaoDoPaciente = {}
  const texto = (valor: string) => (valor.trim() ? valor.trim() : null)

  if (atual.nome.trim() !== original.nome) edicao.nome = atual.nome.trim()
  if (atual.especie && atual.especie !== original.especie) edicao.especie = atual.especie
  if (atual.especieOutra !== original.especieOutra || edicao.especie) {
    edicao.especieOutra = atual.especie === 'OUTRO' ? texto(atual.especieOutra) : null
  }
  if (atual.raca !== original.raca) edicao.raca = texto(atual.raca)
  if (atual.sexo !== original.sexo) edicao.sexo = atual.sexo
  if (atual.nascimento !== original.nascimento) edicao.nascimento = atual.nascimento || null
  if (atual.nascimentoEstimado !== original.nascimentoEstimado || edicao.nascimento !== undefined) {
    edicao.nascimentoEstimado = Boolean(atual.nascimento) && atual.nascimentoEstimado
  }
  if (atual.castrado !== original.castrado) edicao.castrado = atual.castrado
  if (atual.porte !== original.porte) edicao.porte = atual.porte
  if (atual.pesoKg !== original.pesoKg) edicao.pesoKg = atual.pesoKg
  if (atual.microchip !== original.microchip) edicao.microchip = texto(atual.microchip)
  if (atual.pelagem !== original.pelagem) edicao.pelagem = texto(atual.pelagem)

  return edicao
}

watch(
  campos,
  (atuais) => {
    if (tentou) erros.value = validarPaciente(atuais, t)
  },
  { deep: true },
)

async function salvar() {
  tentou = true
  if (!props.paciente) return

  erros.value = validarPaciente(campos.value, t)
  erroGeral.value = ''
  if (Object.keys(erros.value).length) return

  const edicao = mudancas(doPaciente(props.paciente), campos.value)

  if (!Object.keys(edicao).length) {
    visible.value = false
    return
  }

  salvando.value = true

  try {
    emit('salvo', await editarPaciente(props.paciente.id, edicao, parceiroQuery()))
    visible.value = false
  } catch (err) {
    const erro = lerErroDoCadastro(err, t('cadastro.erros.salvar'))

    if (erro.codigo === 'ESPECIE_IMUTAVEL') {
      erros.value = { especie: erro.mensagem }
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
    :titulo="t('cadastro.ficha.editarPaciente')"
    icone="ph ph-paw-print"
  >
    <form id="paciente-edicao" class="eg" novalidate @submit.prevent="salvar">
      <PacienteCampos id="pe" v-model="campos" :erros="erros" :desabilitado="salvando" />
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
        form="paciente-edicao"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
