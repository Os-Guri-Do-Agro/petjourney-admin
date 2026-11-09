<script setup lang="ts">
/**
 * O responsável não atende (E7-05b, guia e7 43, decisão 8): o gestor ou o dono registra o
 * `SEM_RESPOSTA` com uma nota (10 a 300), depois de 3 tentativas sem resposta com pelo menos 30
 * minutos entre a primeira e a última, e da ligação ao contato de emergência quando a estadia tem
 * um. Libera a passagem e o check-out; o boletim continua retido até o contato de verdade.
 */
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import {
  NOTA_SEM_RESPOSTA_MAX,
  NOTA_SEM_RESPOSTA_MIN,
  registrarSemResposta,
  type Ocorrencia,
} from '@/service/parceiro/hotel-ocorrencias-service'

const props = defineProps<{ ocorrencia: Ocorrencia | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ registrada: [ocorrencia: Ocorrencia] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const nota = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  nota.value = ''
  tentou.value = false
  erro.value = ''
})

const valido = computed(() => nota.value.trim().length >= NOTA_SEM_RESPOSTA_MIN)

/** "Tente de novo às 15:40": a hora da parede da casa no ISO. */
const hora = (iso: string) => iso.slice(11, 16)

async function registrar() {
  tentou.value = true
  erro.value = ''
  const ocorrencia = props.ocorrencia
  if (!ocorrencia || !valido.value) return
  salvando.value = true
  try {
    const salva = await registrarSemResposta(ocorrencia.id, nota.value.trim(), parceiroQuery())
    aberta.value = false
    emit('registrada', salva)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('rotinaDoHotel.semResposta.erro'))
    const detalhes = err instanceof ApiError ? err.detalhes : {}
    if (lido.codigo !== 'SEM_RESPOSTA_INSUFICIENTE') {
      erro.value = lido.mensagem
      return
    }
    const partes: string[] = []
    const feitas = Number(detalhes.tentativasSemResposta ?? 0)
    const minimo = Number(detalhes.minimo ?? 3)
    if (feitas < minimo)
      partes.push(t('rotinaDoHotel.semResposta.faltamTentativas', { feitas, minimo }))
    if (detalhes.faltaContatoDeEmergencia)
      partes.push(t('rotinaDoHotel.semResposta.faltaEmergencia'))
    if (typeof detalhes.liberaEm === 'string' && detalhes.liberaEm)
      partes.push(t('rotinaDoHotel.semResposta.liberaEm', { hora: hora(detalhes.liberaEm) }))
    erro.value = partes.length ? partes.join(' ') : lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('rotinaDoHotel.semResposta.titulo')"
    icone="ph ph-phone-x"
  >
    <form id="sem-resposta-hotel" class="eg" novalidate @submit.prevent="registrar">
      <p class="eg__dica">{{ t('rotinaDoHotel.semResposta.dica') }}</p>
      <p v-if="ocorrencia" class="eg__dica">
        {{
          t(
            'rotinaDoHotel.ocorrencia.tentativasSemResposta',
            { n: ocorrencia.tentativas, m: ocorrencia.tentativasSemResposta },
            ocorrencia.tentativas,
          )
        }}
      </p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="sr-nota">{{ t('rotinaDoHotel.semResposta.nota') }}</label>
        <Textarea
          id="sr-nota"
          v-model="nota"
          rows="3"
          auto-resize
          :maxlength="NOTA_SEM_RESPOSTA_MAX"
          :invalid="tentou && !valido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{
          t('rotinaDoHotel.semResposta.notaDica', { min: NOTA_SEM_RESPOSTA_MIN })
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
        form="sem-resposta-hotel"
        icon="ph ph-check"
        :label="t('rotinaDoHotel.semResposta.registrar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
