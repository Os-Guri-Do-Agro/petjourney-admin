<script setup lang="ts">
/**
 * "Como funciona a carteira", recolhido numa linha no fim da página.
 *
 * Antes eram quatro cartões abertos embaixo dos formulários de PIX e de saque, todo dia, para
 * quem já sabe como funciona. A pergunta continua respondida a um clique; a tela de todo dia fica
 * com o saldo e as movimentações.
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
    icon: 'ph ph-wallet',
    title: t('carteira.help.saldos.title'),
    description: t('carteira.help.saldos.body'),
  },
  {
    id: 'pix',
    icon: 'ph ph-qr-code',
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
  <section class="hc ajuda" aria-labelledby="carteira-ajuda-rotulo">
    <div class="ajuda__linha">
      <p class="ajuda__frase">
        <strong id="carteira-ajuda-rotulo">{{ t('carteira.ajuda.rotulo') }}</strong>
        {{ t('carteira.ajuda.frase') }}
      </p>
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

    <!-- v-show, não v-if: o alvo do `aria-controls` precisa existir sempre. -->
    <div v-show="aberta" id="carteira-ajuda-corpo" class="ajuda__corpo">
      <ul class="ajuda__itens">
        <li v-for="item in itens" :key="item.id" class="ajuda__item">
          <span class="ajuda__icone" aria-hidden="true"><i :class="item.icon" /></span>
          <div class="ajuda__texto">
            <strong>{{ item.title }}</strong>
            <p>{{ item.description }}</p>
          </div>
        </li>
      </ul>

      <p class="ajuda__contato">
        {{ t('carteira.help.footerPrefix') }}
        <a :href="`mailto:${CONTACT_EMAIL}`">{{ CONTACT_EMAIL }}</a>
        {{ t('carteira.help.footerOrWhatsapp') }}
        <a :href="CONTACT_WHATSAPP_HREF" target="_blank" rel="noopener noreferrer">
          {{ CONTACT_WHATSAPP_DISPLAY }}
        </a>
      </p>
    </div>
  </section>
</template>

<style scoped>
.ajuda {
  display: grid;
  gap: 0.85rem;
  padding-block: 0.9rem;
}

.ajuda__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.ajuda__frase {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.ajuda__frase strong {
  color: var(--partner-text);
}

.ajuda__corpo {
  display: grid;
  gap: 0.85rem;
}

.ajuda__itens {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 1.5rem;
}

.ajuda__item {
  display: grid;
  grid-template-columns: 2.2rem minmax(0, 1fr);
  gap: 0.7rem;
  align-items: start;
  padding: 0.75rem 0;
  border-top: 1px solid var(--partner-line);
}

.ajuda__icone {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  border-radius: 0.7rem;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
  font-size: 0.9rem;
}

.ajuda__texto {
  display: grid;
  gap: 0.22rem;
  min-width: 0;
}

.ajuda__texto strong {
  font-size: 0.875rem;
}

.ajuda__texto p,
.ajuda__contato {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.ajuda__contato a {
  color: var(--hc-marca-forte);
  font-weight: 650;
  text-decoration: none;
}

.ajuda__contato a:hover,
.ajuda__contato a:focus-visible {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .ajuda__itens {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
