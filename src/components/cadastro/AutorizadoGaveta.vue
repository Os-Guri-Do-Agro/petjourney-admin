<script setup lang="ts">
/**
 * Pessoa autorizada a buscar o pet (E2-01, seção 1.8): nome obrigatório; telefone, documento e a
 * relação ("vizinho", "filha", "motorista") opcionais. Criar leva `Idempotency-Key`.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  criarAutorizado,
  editarAutorizado,
  telefoneNaTela,
  type Autorizado,
} from '@/service/parceiro/pacientes-service'

const props = defineProps<{ clienteId: string; autorizado: Autorizado | null }>()
const emit = defineEmits<{ salvo: [autorizado: Autorizado] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const nome = ref('')
const telefone = ref('')
const documento = ref('')
const relacao = ref('')
const tentou = ref(false)
const erroDoTelefone = ref('')
const erro = ref('')
const salvando = ref(false)

watch(visible, (aberta) => {
  if (!aberta) return

  nome.value = props.autorizado?.nome ?? ''
  telefone.value = telefoneNaTela(props.autorizado?.telefone)
  documento.value = props.autorizado?.documento ?? ''
  relacao.value = props.autorizado?.relacao ?? ''
  tentou.value = false
  erro.value = ''
  erroDoTelefone.value = ''
})

async function salvar() {
  tentou.value = true
  erro.value = ''
  erroDoTelefone.value = ''
  if (!nome.value.trim()) return

  const ou = (valor: string) => (valor.trim() ? valor.trim() : null)
  const corpo = {
    nome: nome.value.trim(),
    telefone: ou(telefone.value),
    documento: ou(documento.value),
    relacao: ou(relacao.value),
  }

  salvando.value = true

  try {
    const salvo = props.autorizado
      ? await editarAutorizado(props.clienteId, props.autorizado.id, corpo, parceiroQuery())
      : await criarAutorizado(props.clienteId, corpo, chaveador.para(corpo), parceiroQuery())

    chaveador.concluir()
    emit('salvo', salvo)
    visible.value = false
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))

    if (lido.codigo === 'TELEFONE_INVALIDO') {
      erroDoTelefone.value = lido.mensagem
    } else {
      erro.value = lido.mensagem
    }
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="autorizado ? t('cadastro.autorizados.editar') : t('cadastro.autorizados.novo')"
    icone="ph ph-identification-badge"
  >
    <form id="autorizado-form" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">{{ t('cadastro.autorizados.lede') }}</p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="autorizado-nome">{{ t('cadastro.autorizados.nome') }}</label>
        <InputText
          id="autorizado-nome"
          v-model="nome"
          maxlength="120"
          :invalid="tentou && !nome.trim()"
          :disabled="salvando"
        />
        <small v-if="tentou && !nome.trim()" class="eg__invalido">
          {{ t('cadastro.autorizados.faltaNome') }}
        </small>
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="autorizado-relacao">
            {{ t('cadastro.autorizados.relacao') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <InputText
            id="autorizado-relacao"
            v-model="relacao"
            maxlength="60"
            :placeholder="t('cadastro.autorizados.relacaoExemplo')"
            :disabled="salvando"
          />
        </section>

        <section class="eg__secao">
          <label class="eg__rotulo" for="autorizado-telefone">
            {{ t('cadastro.campos.telefone') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <InputText
            id="autorizado-telefone"
            v-model="telefone"
            inputmode="tel"
            :invalid="Boolean(erroDoTelefone)"
            :disabled="salvando"
          />
          <small v-if="erroDoTelefone" class="eg__invalido">{{ erroDoTelefone }}</small>
        </section>
      </div>

      <section class="eg__secao">
        <label class="eg__rotulo" for="autorizado-documento">
          {{ t('cadastro.autorizados.documento') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <InputText
          id="autorizado-documento"
          v-model="documento"
          maxlength="40"
          :disabled="salvando"
        />
      </section>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
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
        form="autorizado-form"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
