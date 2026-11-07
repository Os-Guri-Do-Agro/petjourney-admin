<script setup lang="ts">
/**
 * A foto do boletim (E5-03b, guia e5 18.3 e 18.5): uma por boletim aberto (enviar de novo troca),
 * JPEG, PNG ou WebP de até 12 MB. O servidor regrava sem localização. A foto pode mostrar pessoas
 * e outros animais: a gaveta avisa. O boletim de alta não recebe foto.
 */
import Button from 'primevue/button'
import FileUpload, { type FileUploadUploaderEvent } from 'primevue/fileupload'
import InputText from 'primevue/inputtext'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  enviarFotoDoBoletim,
  FOTO_MAX_BYTES,
  LEGENDA_DA_FOTO_MAX,
  lerFotoDoBoletim,
  tirarFotoDoBoletim,
  TIPOS_DE_FOTO,
  type Boletim,
} from '@/service/parceiro/boletins-da-internacao-service'

const props = defineProps<{ boletim: Boletim | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ mudou: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const arquivo = ref<File | null>(null)
const legenda = ref('')
const atual = ref<string | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const escolha = ref<{ clear: () => void } | null>(null)

watch(aberta, async (agora) => {
  if (!agora) return
  arquivo.value = null
  legenda.value = props.boletim?.fotoLegenda ?? ''
  atual.value = null
  tentou.value = false
  erro.value = ''
  if (props.boletim?.temFoto) {
    try {
      atual.value = (await lerFotoDoBoletim(props.boletim.id, parceiroQuery())).url
    } catch {
      atual.value = null
    }
  }
})

function aoEscolher(evento: FileUploadUploaderEvent) {
  const lista = Array.isArray(evento.files) ? evento.files : [evento.files]
  escolha.value?.clear()
  arquivo.value = lista[0] ?? null
}

async function enviar() {
  tentou.value = true
  erro.value = ''
  if (!props.boletim || !arquivo.value) return
  salvando.value = true
  try {
    await enviarFotoDoBoletim(props.boletim.id, arquivo.value, legenda.value, parceiroQuery())
    aberta.value = false
    emit('mudou')
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.boletim.erroFoto')).mensagem
  } finally {
    salvando.value = false
  }
}

async function tirar() {
  if (!props.boletim) return
  salvando.value = true
  try {
    await tirarFotoDoBoletim(props.boletim.id, parceiroQuery())
    aberta.value = false
    emit('mudou')
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.boletim.erroFoto')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('internacao.boletim.foto')"
    icone="ph ph-camera"
  >
    <form id="foto-boletim" class="eg" novalidate @submit.prevent="enviar">
      <p class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('internacao.boletim.fotoDica') }}</span>
      </p>
      <img
        v-if="atual"
        :src="atual"
        :alt="legenda || t('internacao.boletim.foto')"
        class="fb__foto"
      />

      <section class="eg__secao">
        <span class="eg__rotulo">{{
          atual ? t('internacao.boletim.trocarFoto') : t('internacao.boletim.escolherFoto')
        }}</span>
        <FileUpload
          ref="escolha"
          mode="basic"
          custom-upload
          auto
          :accept="TIPOS_DE_FOTO.join(',')"
          :max-file-size="FOTO_MAX_BYTES"
          :choose-label="t('internacao.boletim.escolherFoto')"
          :disabled="salvando"
          @uploader="aoEscolher"
        />
        <small v-if="arquivo" class="eg__dica">{{ arquivo.name }}</small>
        <small v-else-if="tentou" class="eg__invalido">{{ t('internacao.boletim.semFoto') }}</small>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="fb-legenda">
          {{ t('internacao.boletim.legenda') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <InputText
          id="fb-legenda"
          v-model="legenda"
          :maxlength="LEGENDA_DA_FOTO_MAX"
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
        v-if="boletim?.temFoto"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-trash"
        :label="t('internacao.boletim.tirarFoto')"
        :disabled="salvando"
        @click="tirar"
      />
      <Button
        type="submit"
        form="foto-boletim"
        icon="ph ph-upload-simple"
        :label="t('internacao.boletim.enviarFoto')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.fb__foto {
  width: 100%;
  max-height: 280px;
  border-radius: var(--raio-controle);
  object-fit: contain;
  background: var(--superficie-2);
}
</style>
