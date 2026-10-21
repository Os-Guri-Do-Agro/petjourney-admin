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
  <section
    id="carteira-ajuda"
    class="ajuda ui-folha ui-cartao"
    :class="{ 'ajuda--aberta': aberta }"
    aria-labelledby="carteira-ajuda-titulo"
  >
    <header class="ui-cartao__cabeca ajuda__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-info" /></span>
      <div class="ui-cartao__titulos">
        <h2 id="carteira-ajuda-titulo" class="ui-cartao__titulo">{{ t('carteira.help.title') }}</h2>
        <p class="ui-cartao__descricao">{{ t('carteira.help.lede') }}</p>
      </div>
      <div class="ui-cartao__acoes">
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
      </div>
    </header>

    <!-- v-show, não v-if: o alvo do `aria-controls` precisa existir sempre. -->
    <div v-show="aberta" id="carteira-ajuda-corpo" class="ajuda__corpo">
      <ul class="ajuda__itens">
        <li v-for="item in itens" :key="item.id" class="ajuda__item ui-poco">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true"><i :class="item.icon" /></span>
          <span class="ajuda__texto">
            <strong>{{ item.title }}</strong>
            <span>{{ item.description }}</span>
          </span>
        </li>
      </ul>

      <p class="ajuda__contato ui-cartao__pe">
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
  </section>
</template>

<style scoped>
.ajuda {
  overflow: clip;
}

/* Fechada, a cabeça é o cartão inteiro: sem o fio de baixo. */
.ajuda:not(.ajuda--aberta) .ajuda__cabeca {
  padding-bottom: 16px;
}

.ajuda__itens {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 18px 24px;
  list-style: none;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 760px) {
  .ajuda__itens {
    grid-template-columns: minmax(0, 1fr);
    padding: 16px;
  }
}

@media (max-width: 640px) {
  /* No estreito o botão de abrir desce para baixo do título, alinhado com o texto. */
  .ajuda__cabeca {
    flex-wrap: wrap;
  }

  .ajuda__cabeca .ui-cartao__titulos {
    flex-basis: 0;
  }

  .ajuda__cabeca .ui-cartao__acoes {
    flex-basis: 100%;
    justify-content: flex-start;
    margin-top: -4px;
    padding-inline-start: 42px;
  }
}

.ajuda__item.ui-poco {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
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

.ajuda__contato.ui-cartao__pe {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  margin: 0;
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
