<script setup lang="ts">
/**
 * "Convidar para o app" (pedido 4 do guia `pedidos-luis-17-11.md`; antes "Ligar ao app", com três
 * abas). Sem abas: ao abrir, o convite por link já nasce (`ConviteParaOApp` com `criarAoAbrir`) e a
 * ação principal é mandar pelo WhatsApp; QR em tela cheia, copiar a mensagem e e-mail ao lado; o QR
 * da carteirinha fica em "Outras formas". Abrir de novo gera outro convite, e o anterior deixa de
 * valer.
 */
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import ConviteParaOApp from '@/components/cadastro/ConviteParaOApp.vue'
import type { Paciente } from '@/service/parceiro/pacientes-service'

defineProps<{ paciente: Paciente | null }>()
const emit = defineEmits<{ mudou: [] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="t('cadastro.convite.titulo')"
    icone="ph ph-device-mobile"
  >
    <!-- Um convite por abertura: a gaveta fechada desmonta o convite. -->
    <ConviteParaOApp
      v-if="visible && paciente"
      :paciente="paciente"
      criar-ao-abrir
      @mudou="emit('mudou')"
    />

    <template #pe>
      <Button type="button" :label="t('cadastro.fechar')" @click="visible = false" />
    </template>
  </CadastroGaveta>
</template>
