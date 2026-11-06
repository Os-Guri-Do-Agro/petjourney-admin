<script setup lang="ts">
/**
 * Editar o caso da internação (E5-01, guia e5 4): o diagnóstico de trabalho, a observação interna
 * e o veterinário responsável. Campo esvaziado vai `null` (limpa); o responsável não se limpa.
 * Exige `internacao.prescrever` com CRMV; outro responsável precisa de CRMV em dia.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { editarInternacao, type Internacao } from '@/service/parceiro/internacao-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

const props = defineProps<{ internacao: Internacao | null; profissionais: Profissional[] }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [internacao: Internacao] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const diagnostico = ref('')
const observacao = ref('')
const responsavel = ref<string | null>(null)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora || !props.internacao) return
  diagnostico.value = props.internacao.diagnosticoDeTrabalho ?? ''
  observacao.value = props.internacao.observacao ?? ''
  responsavel.value = props.internacao.responsavel.id
  erro.value = ''
})

const opcoesDeResponsavel = computed(() => {
  const lista = props.profissionais
    .filter((item) => item.conselho === 'CRMV' && item.registro)
    .map((item) => ({ valor: item.id, rotulo: item.nome }))
  const atual = props.internacao?.responsavel
  if (atual && !lista.some((item) => item.valor === atual.id))
    lista.unshift({ valor: atual.id, rotulo: atual.nome })
  return lista
})

async function salvar() {
  const atual = props.internacao
  if (!atual) return
  erro.value = ''
  const corpo: Parameters<typeof editarInternacao>[1] = {}
  const novoDiagnostico = diagnostico.value.trim() || null
  const novaObservacao = observacao.value.trim() || null
  if (novoDiagnostico !== atual.diagnosticoDeTrabalho) corpo.diagnosticoDeTrabalho = novoDiagnostico
  if (novaObservacao !== atual.observacao) corpo.observacao = novaObservacao
  if (responsavel.value && responsavel.value !== atual.responsavel.id)
    corpo.responsavelProfissionalId = responsavel.value
  if (!Object.keys(corpo).length) {
    aberta.value = false
    return
  }
  salvando.value = true
  try {
    const salva = await editarInternacao(atual.id, corpo, parceiroQuery())
    aberta.value = false
    emit('salvo', salva)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('internacao.caso.editar')"
    icone="ph ph-pencil-simple"
  >
    <form id="caso-form" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="caso-diagnostico">
          {{ t('internacao.diagnostico') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <InputText id="caso-diagnostico" v-model="diagnostico" :disabled="salvando" />
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="caso-responsavel">{{ t('internacao.responsavel') }}</label>
        <Select
          v-model="responsavel"
          input-id="caso-responsavel"
          :options="opcoesDeResponsavel"
          option-label="rotulo"
          option-value="valor"
          :disabled="salvando"
        />
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="caso-observacao">
          {{ t('internacao.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="caso-observacao"
          v-model="observacao"
          rows="3"
          auto-resize
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('internacao.observacaoDica') }}</small>
      </section>
      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>
    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="caso-form"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
