<script setup lang="ts">
/**
 * Encerramento administrativo (E5-01, guia e5 12, decisão 14 do gerente): só quando a clínica não
 * tem nenhum veterinário ativo com CRMV em dia. DONO ou GESTOR (`estabelecimento.editar`), sem
 * CRMV, com o motivo (20 a 500). Nada de orientação clínica, ligação ou óbito; nada sai por
 * notificação. Se o animal morreu, o óbito se registra no cadastro depois.
 *
 * Havendo veterinário apto, a API recusa (`ENCERRAMENTO_ADMINISTRATIVO_COM_VETERINARIO`) e a
 * gaveta mostra a frase dela.
 */
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  encerrarAdministrativo,
  MOTIVO_ADMINISTRATIVO_MAX,
  MOTIVO_ADMINISTRATIVO_MIN,
  type Internacao,
} from '@/service/parceiro/internacao-service'

const props = defineProps<{ internacao: Internacao | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ encerrada: [internacao: Internacao] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const motivo = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  motivo.value = ''
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

const valido = computed(() => {
  const tamanho = motivo.value.trim().length
  return tamanho >= MOTIVO_ADMINISTRATIVO_MIN && tamanho <= MOTIVO_ADMINISTRATIVO_MAX
})

async function encerrar() {
  tentou.value = true
  erro.value = ''
  if (!props.internacao || !valido.value) return
  salvando.value = true
  const texto = motivo.value.trim()
  try {
    const encerrada = await encerrarAdministrativo(
      props.internacao.id,
      texto,
      chaveador.para({ motivo: texto }),
      parceiroQuery(),
    )
    chaveador.concluir()
    aberta.value = false
    emit('encerrada', encerrada)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.encerrar.erro')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('internacao.administrativo.titulo')"
    icone="ph ph-clipboard-text"
  >
    <form id="administrativo-form" class="eg" novalidate @submit.prevent="encerrar">
      <p class="eg__dica">{{ t('internacao.administrativo.dica') }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="adm-motivo">{{
          t('internacao.administrativo.motivo')
        }}</label>
        <Textarea
          id="adm-motivo"
          v-model="motivo"
          rows="4"
          auto-resize
          :maxlength="MOTIVO_ADMINISTRATIVO_MAX"
          :invalid="tentou && !valido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{
          t('internacao.administrativo.motivoDica', {
            min: MOTIVO_ADMINISTRATIVO_MIN,
            max: MOTIVO_ADMINISTRATIVO_MAX,
          })
        }}</small>
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
        form="administrativo-form"
        icon="ph ph-clipboard-text"
        :label="t('internacao.administrativo.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
