<script setup lang="ts">
/**
 * O endereço da página pública (o slug): de 3 a 60 letras minúsculas, números e hífen. O antigo
 * continua levando à página; a API guarda os 5 últimos e o sexto libera o mais antigo.
 *
 * Palavra reservada e endereço de outra casa a API recusa (`ESTABELECIMENTO_SLUG_INVALIDO`,
 * `ESTABELECIMENTO_SLUG_EM_USO`); a mensagem dela aparece aqui.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { isRTLLocale, type Locale } from '@/i18n/locales'

import { paraSlug, slugValido } from './slug'
import './gaveta.css'

const props = defineProps<{
  atual: string | null
  salvando: boolean
  erro: Error | null
}>()

const emit = defineEmits<{ salvar: [slug: string] }>()

const visible = defineModel<boolean>('visible', { default: false })

const LARGURA = '26.5rem'

const { t, locale } = useI18n()
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

const drawerPosition = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))

const slug = ref('')
const tentouSalvar = ref(false)

watch(visible, (aberta) => {
  if (aberta) {
    slug.value = props.atual ?? ''
    tentouSalvar.value = false
  }
})

/** O erro da API vale para o endereço enviado: mexeu no campo, ele sai da tela. */
const mexeuDepoisDoErro = ref(false)

watch(
  () => props.erro,
  () => {
    mexeuDepoisDoErro.value = false
  },
)

watch(slug, () => {
  mexeuDepoisDoErro.value = true
})

const erroVisivel = computed(() => (mexeuDepoisDoErro.value ? null : props.erro))

const invalido = computed(() => tentouSalvar.value && !slugValido(slug.value))
const igual = computed(() => slug.value === props.atual)

function aoDigitar(valor: string | undefined) {
  /* Maiúscula e espaço viram o que o endereço aceita enquanto se digita; o resto, ao salvar. */
  slug.value = (valor ?? '').toLowerCase().replace(/\s+/g, '-')
}

function salvar() {
  slug.value = paraSlug(slug.value)
  tentouSalvar.value = true

  if (!slugValido(slug.value) || igual.value || props.salvando) return

  emit('salvar', slug.value)
}
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="drawerPosition"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="estabelecimento-gaveta"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
  >
    <template #header>
      <h2 class="eg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i class="ph ph-link-simple" />
        </span>
        {{ t('parceiro.estabelecimento.gaveta.titulo.slug') }}
      </h2>
    </template>

    <form id="estabelecimento-slug" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="est-slug">{{
          t('parceiro.estabelecimento.slug.rotulo')
        }}</label>
        <InputText
          id="est-slug"
          :model-value="slug"
          maxlength="60"
          autocomplete="off"
          spellcheck="false"
          dir="ltr"
          :invalid="invalido"
          :disabled="salvando"
          @update:model-value="aoDigitar"
        />
        <p v-if="invalido" class="eg__invalido">
          {{ t('parceiro.estabelecimento.slug.invalido') }}
        </p>
        <p v-else class="eg__dica">{{ t('parceiro.estabelecimento.slug.regras') }}</p>
      </section>

      <p v-if="atual" class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        {{ t('parceiro.estabelecimento.slug.antigoContinua') }}
      </p>

      <p v-if="erroVisivel" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ erroVisivel.message }}
      </p>
    </form>

    <template #footer>
      <div class="eg__pe">
        <Button
          type="button"
          :label="t('parceiro.estabelecimento.gaveta.cancelar')"
          severity="secondary"
          outlined
          :disabled="salvando"
          @click="visible = false"
        />
        <Button
          type="submit"
          form="estabelecimento-slug"
          icon="ph ph-check"
          :label="t('parceiro.estabelecimento.slug.trocar')"
          :loading="salvando"
          :disabled="igual"
        />
      </div>
    </template>
  </Drawer>
</template>
