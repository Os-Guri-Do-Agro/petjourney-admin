<script setup lang="ts">
/**
 * O aviso de privacidade do envio da identidade, em camadas: a abertura (o que se pede e para quê)
 * fica à vista e os tópicos ("Por que pedimos", "Como conferimos"…) ficam recolhidos, cada um
 * abrindo no lugar. Embaixo, o link da Política de Privacidade do site.
 *
 * O texto é o da API, sem uma palavra trocada: `separarAviso` só corta nos parágrafos. O "Li e
 * entendi, enviar" do pé da gaveta é o que confirma a leitura.
 */
import Accordion from 'primevue/accordion'
import AccordionContent from 'primevue/accordioncontent'
import AccordionHeader from 'primevue/accordionheader'
import AccordionPanel from 'primevue/accordionpanel'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { separarAviso, trechosComEmail } from '@/components/settings/identidade-aviso'
import { SITE_PUBLICO } from '@/utils/parceiro/pagina-publica'

const props = defineProps<{ titulo: string | null; texto: string }>()

const { t } = useI18n()

const aviso = computed(() => separarAviso(props.texto))

const politica = `${SITE_PUBLICO}/privacidade`
</script>

<template>
  <section class="ia" aria-labelledby="identidade-aviso-titulo">
    <h3 id="identidade-aviso-titulo" class="ia__titulo">
      <i class="ph ph-shield-check" aria-hidden="true" />
      {{ titulo || t('settings.identidade.gaveta.aviso.titulo') }}
    </h3>

    <p v-for="(paragrafo, i) in aviso.abertura" :key="i" class="ia__abertura">
      {{ paragrafo }}
    </p>

    <Accordion v-if="aviso.topicos.length" multiple :value="[]" class="ia__topicos">
      <AccordionPanel v-for="(topico, i) in aviso.topicos" :key="i" :value="i">
        <AccordionHeader>{{ topico.titulo }}</AccordionHeader>
        <AccordionContent>
          <p class="ia__corpo">
            <template v-for="(trecho, j) in trechosComEmail(topico.corpo)" :key="j">
              <a v-if="trecho.email" :href="`mailto:${trecho.texto}`" class="ia__link">
                <bdi dir="ltr">{{ trecho.texto }}</bdi>
              </a>
              <template v-else>{{ trecho.texto }}</template>
            </template>
          </p>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <a :href="politica" target="_blank" rel="noopener" class="ia__politica">
      {{ t('settings.identidade.gaveta.aviso.politica') }}
      <i class="ph ph-arrow-square-out" aria-hidden="true" />
      <span class="sr-only">{{ t('settings.identidade.gaveta.aviso.novaAba') }}</span>
    </a>
  </section>
</template>

<style scoped>
.ia {
  display: grid;
  gap: 12px;
}

.ia__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.ia__titulo i {
  color: var(--tinta-2);
  font-size: 18px;
}

.ia__abertura {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.55;
}

/*
 * Os tópicos: linhas finas, sem caixa em volta, título à esquerda e a seta no fim. Abrir mostra o
 * texto no lugar (o movimento é o do PrimeVue, curto).
 */
.ia__topicos {
  border-top: 1px solid var(--linha-suave);
}

.ia__topicos :deep(.p-accordionpanel) {
  border: 0;
  border-bottom: 1px solid var(--linha-suave);
}

.ia__topicos :deep(.p-accordionheader) {
  padding: 12px 2px;
  border: 0;
  background: transparent;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.ia__topicos :deep(.p-accordionheader:hover) {
  color: var(--tinta);
}

.ia__topicos :deep(.p-accordionheader-toggle-icon) {
  color: var(--tinta-2);
}

.ia__topicos :deep(.p-accordioncontent-content) {
  padding: 0 2px 14px;
  border: 0;
  background: transparent;
}

.ia__corpo {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.55;
  white-space: pre-line;
}

.ia__link,
.ia__politica {
  color: var(--tinta);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: var(--linha);
  text-underline-offset: 3px;
}

.ia__link:hover,
.ia__politica:hover {
  text-decoration-color: currentcolor;
}

.ia__politica {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 6px;
  font-size: 13px;
}

.ia__politica i {
  font-size: 15px;
}
</style>
