<script setup lang="ts">
/**
 * Uma foto da estadia (E7-04b, guia e7 41): o momento (entrada, estadia, saída), a legenda (até
 * 120) e o arquivo (JPEG, PNG ou WebP até 8 MB; a API regrava em JPEG de até 1.600 px, sem GPS).
 * Até 6 por momento.
 */
import Button from 'primevue/button'
import FileUpload from 'primevue/fileupload'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  enviarFoto,
  FOTO_ACEITA,
  FOTO_MAX_BYTES,
  LEGENDA_MAX,
  MOMENTOS_DA_FOTO,
  type MomentoDaFoto,
} from '@/service/parceiro/hotel-estadia-service'

const props = defineProps<{ hospedagemId: string }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ enviada: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const momento = ref<MomentoDaFoto>('ESTADIA')
const legenda = ref('')
const arquivo = ref<File | null>(null)
const envio = ref<{ clear: () => void } | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  momento.value = 'ESTADIA'
  legenda.value = ''
  arquivo.value = null
  envio.value?.clear()
  tentou.value = false
  erro.value = ''
})

const opcoes = computed(() =>
  MOMENTOS_DA_FOTO.map((valor) => ({ valor, rotulo: t(`estadiaDoHotel.momento.${valor}`) })),
)

function escolher(evento: { files: File[] }) {
  arquivo.value = evento.files[0] ?? null
}

async function enviar() {
  tentou.value = true
  erro.value = ''
  if (!arquivo.value) return
  salvando.value = true
  try {
    await enviarFoto(
      props.hospedagemId,
      arquivo.value,
      momento.value,
      legenda.value,
      parceiroQuery(),
    )
    aberta.value = false
    emit('enviada')
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
    :titulo="t('estadiaDoHotel.fotos.enviar')"
    icone="ph ph-camera"
  >
    <form id="foto-da-estadia" class="eg" novalidate @submit.prevent="enviar">
      <section class="eg__secao">
        <span id="fo-momento" class="eg__rotulo">{{ t('estadiaDoHotel.fotos.momento') }}</span>
        <SelectButton
          v-model="momento"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="fo-momento"
          :disabled="salvando"
        />
      </section>
      <section class="eg__secao">
        <span class="eg__rotulo">{{ t('estadiaDoHotel.fotos.arquivo') }}</span>
        <FileUpload
          ref="envio"
          mode="basic"
          :accept="FOTO_ACEITA"
          :max-file-size="FOTO_MAX_BYTES"
          :choose-label="arquivo ? arquivo.name : t('reservasDoHotel.comprovante.escolher')"
          choose-icon="ph ph-image"
          custom-upload
          :disabled="salvando"
          @select="escolher"
        />
        <small :class="tentou && !arquivo ? 'eg__invalido' : 'eg__dica'">{{
          t('estadiaDoHotel.fotos.dica')
        }}</small>
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="fo-legenda"
          >{{ t('estadiaDoHotel.fotos.legenda') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span></label
        >
        <InputText
          id="fo-legenda"
          v-model="legenda"
          :maxlength="LEGENDA_MAX"
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
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="foto-da-estadia"
        icon="ph ph-upload-simple"
        :label="t('estadiaDoHotel.fotos.enviar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
