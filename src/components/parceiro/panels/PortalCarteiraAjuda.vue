<script setup lang="ts">
/**
 * "Como funciona a carteira", recolhido no fim da página.
 *
 * Quem já sabe como funciona vê só o título; a resposta está a um clique: o que entra, quando
 * libera, a chave PIX e o ciclo de pagamento, em quatro blocos curtos, e o contato do suporte.
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import UiSecao from '@/components/ui/UiSecao.vue'

const { t } = useI18n()

const CONTACT_EMAIL = 'atendimento@petjourney.health'
const CONTACT_WHATSAPP_DISPLAY = '55 67 9883-7848'
const CONTACT_WHATSAPP_HREF = 'https://wa.me/556798837848'

const aberta = ref(false)

const itens = computed(() => [
  {
    id: 'comissao',
    icon: 'ph ph-share-network',
    title: t('carteira.help.comissao.title'),
    description: t('carteira.help.comissao.body'),
  },
  {
    id: 'saldos',
    icon: 'ph ph-hourglass-medium',
    title: t('carteira.help.saldos.title'),
    description: t('carteira.help.saldos.body'),
  },
  {
    id: 'pix',
    icon: 'ph ph-key',
    title: t('carteira.help.pix.title'),
    description: t('carteira.help.pix.body'),
  },
  {
    id: 'ciclo',
    icon: 'ph ph-calendar-blank',
    title: t('carteira.help.ciclo.title'),
    description: t('carteira.help.ciclo.body'),
  },
])
</script>

<template>
  <UiSecao
    id="carteira-ajuda"
    :titulo="t('carteira.help.title')"
    :descricao="t('carteira.help.lede')"
    icone="ph ph-info"
  >
    <template #acoes>
      <Button
        type="button"
        :label="aberta ? t('carteira.ajuda.fechar') : t('carteira.ajuda.abrir')"
        :icon="aberta ? 'ph ph-caret-up' : 'ph ph-caret-down'"
        icon-pos="right"
        severity="secondary"
        text
        size="small"
        :aria-expanded="aberta"
        aria-controls="carteira-ajuda-corpo"
        @click="aberta = !aberta"
      />
    </template>

    <!-- v-show, não v-if: o alvo do `aria-controls` precisa existir sempre. -->
    <div v-show="aberta" id="carteira-ajuda-corpo" class="ajuda ui-folha">
      <ul class="ajuda__itens">
        <li v-for="item in itens" :key="item.id" class="ajuda__item">
          <span class="ajuda__icone" aria-hidden="true"><i :class="item.icon" /></span>
          <span class="ajuda__texto">
            <strong>{{ item.title }}</strong>
            <span>{{ item.description }}</span>
          </span>
        </li>
      </ul>

      <p class="ajuda__contato">
        <i class="ph ph-chat-circle" aria-hidden="true" />
        <span>
          {{ t('carteira.help.footerPrefix') }}
          <a class="ui-mais" :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>
          {{ t('carteira.help.footerOrWhatsapp') }}
          <a class="ui-mais" :href="CONTACT_WHATSAPP_HREF" target="_blank" rel="noopener noreferrer">
            <bdi dir="ltr">{{ CONTACT_WHATSAPP_DISPLAY }}</bdi>
          </a>
        </span>
      </p>
    </div>
  </UiSecao>
</template>

<style scoped>
.ajuda {
  display: grid;
  overflow: hidden;
}

.ajuda__itens {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
}

.ajuda__item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: -1px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--linha);
}

.ajuda__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 18px;
}

.ajuda__texto {
  display: grid;
  gap: 3px;
  min-width: 0;
  line-height: 1.45;
}

.ajuda__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.ajuda__texto span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ajuda__contato {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 14px 18px;
  border-top: 1px solid var(--linha);
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.ajuda__contato > i {
  color: var(--tinta-3);
  font-size: 17px;
}

.ajuda__contato .ui-mais {
  display: inline;
}
</style>
