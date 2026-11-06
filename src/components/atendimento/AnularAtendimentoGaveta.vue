<script setup lang="ts">
/**
 * Anular o atendimento (E4-01, guia e4 5.5 e 15.1). Nada se apaga: o motivo fica no registro, com
 * quem anulou e quando. O rascunho com conteúdo devolve o horário a "Aguardando"; o finalizado
 * mantém o horário e tira a consulta do app do responsável. Retificar é abrir um avulso novo.
 *
 * Também é o caminho do rascunho que não se descarta (com uma gravação da escuta): o 409
 * `ATENDIMENTO_COM_CONTEUDO` do descartar abre esta gaveta.
 *
 * Pede a senha da conta como o finalizar e a confirmação ao anular o registro de outro
 * veterinário.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { motivoDaRecusa } from '@/composables/useSeloDeAssinatura'
import {
  anularAtendimento,
  MOTIVO_MAX,
  MOTIVO_MIN,
  type Atendimento,
} from '@/service/parceiro/atendimentos-service'

import SenhaDaAssinatura from './SenhaDaAssinatura.vue'
import { useSenhaDaAssinatura } from './useSenhaDaAssinatura'

const props = defineProps<{
  atendimento: Atendimento
  /** Por que a gaveta abriu sozinha (o descartar que não passou): dentro dela, não num aviso que a cobre. */
  aviso?: string
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ anulado: [atendimento: Atendimento] }>()

const { t } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()
const senha = useSenhaDaAssinatura()

const motivo = ref('')
const confirmarOutro = ref(false)
const pedirConfirmacao = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

const deOutro = computed(
  () =>
    props.atendimento.status === 'FINALIZADO' &&
    Boolean(store.eu?.profissional?.id) &&
    store.eu?.profissional?.id !== props.atendimento.profissional.id,
)

watch(aberta, (agora) => {
  if (agora) {
    motivo.value = ''
    confirmarOutro.value = false
    pedirConfirmacao.value = deOutro.value
    tentou.value = false
    erro.value = ''
  } else {
    senha.limpar()
  }
})

const valido = computed(() => motivo.value.trim().length >= MOTIVO_MIN)

async function anular() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  if (pedirConfirmacao.value && !confirmarOutro.value) {
    erro.value = t('atendimento.anular.confirmeOutro')
    return
  }
  salvando.value = true
  try {
    const novo = await anularAtendimento(
      props.atendimento.id,
      {
        motivo: motivo.value.trim(),
        ...(confirmarOutro.value ? { confirmarOutroResponsavel: true } : {}),
        ...senha.campo(),
      },
      parceiroQuery(),
    )
    senha.concluir()
    aberta.value = false
    emit('anulado', novo)
  } catch (err) {
    if (senha.tratar(err)) return
    if (motivoDaRecusa(err)) {
      erro.value = t(`atendimento.selo.${motivoDaRecusa(err)}`)
      return
    }
    const lido = lerErroDoCadastro(err, t('atendimento.anular.erro'))
    if (lido.codigo === 'ATENDIMENTO_DE_OUTRO_PROFISSIONAL') {
      pedirConfirmacao.value = true
      erro.value = t('atendimento.anular.confirmeOutro')
      return
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('atendimento.anular.titulo')"
    icone="ph ph-prohibit"
  >
    <form id="anular-atendimento" class="eg" novalidate @submit.prevent="anular">
      <p v-if="aviso" class="eg__aviso" role="status">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ aviso }}</span>
      </p>
      <p class="eg__dica">
        {{
          atendimento.status === 'FINALIZADO'
            ? t('atendimento.anular.dicaFinalizado')
            : t('atendimento.anular.dicaRascunho')
        }}
      </p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="an-motivo">{{ t('atendimento.anular.motivo') }}</label>
        <Textarea
          id="an-motivo"
          v-model="motivo"
          rows="3"
          auto-resize
          :maxlength="MOTIVO_MAX"
          :invalid="tentou && !valido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{
          t('atendimento.anular.motivoDica', { min: MOTIVO_MIN })
        }}</small>
      </section>

      <label v-if="pedirConfirmacao" class="aa__confirmar" for="aa-outro">
        <Checkbox v-model="confirmarOutro" input-id="aa-outro" binary :disabled="salvando" />
        <span>{{
          t('atendimento.anular.outroResponsavel', { nome: atendimento.profissional.nome })
        }}</span>
      </label>

      <SenhaDaAssinatura
        v-if="senha.pedindo.value || senha.semSenhaPropria.value"
        id="aa-senha"
        v-model="senha.senha.value"
        :erro="senha.erroDaSenha.value"
        :sem-senha-propria="senha.semSenhaPropria.value"
        :desabilitado="salvando"
      />

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
        form="anular-atendimento"
        severity="danger"
        icon="ph ph-prohibit"
        :label="t('atendimento.anular.confirmar')"
        :loading="salvando"
        :disabled="senha.semSenhaPropria.value || (senha.pedindo.value && !senha.senha.value)"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.aa__confirmar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
  cursor: pointer;
}
</style>
