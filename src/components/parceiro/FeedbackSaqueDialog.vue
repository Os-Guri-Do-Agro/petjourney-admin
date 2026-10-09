<script setup lang="ts">
/**
 * O questionário opcional que abre logo depois de um saque concluído.
 *
 * Montado uma vez no `AppShell`; quem abre é a carteira, por `useFeedbackSaque().oferecer`, e as
 * regras de dispensa, envio e erro moram lá. Aqui fica só o formulário.
 *
 * O título repete "Saque solicitado", com o check na tinta de sucesso, porque o diálogo cobre o
 * toast do saque: quem acabou de mexer com dinheiro precisa ler que deu certo antes de qualquer
 * pergunta. As perguntas são blocos soltos, sem cartão em volta; quem separa é o espaço.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import EscalaDeNota from '@/components/parceiro/EscalaDeNota.vue'
import {
  INCENTIVOS_INDICACAO,
  PONTOS_POSITIVOS,
  SUGESTAO_MAX_LENGTH,
  useFeedbackSaque,
} from '@/composables/useFeedbackSaque'
import type { IncentivoIndicacaoFeedback, PontoPositivoFeedback } from '@/service/parceiro/types'

const { t } = useI18n()
const toast = useToast()
const { aberto, pedido, enviando, erro, fechar, enviar } = useFeedbackSaque()

const nota = ref<number | null>(null)
const pontos = ref<PontoPositivoFeedback[]>([])
const incentivos = ref<IncentivoIndicacaoFeedback[]>([])
const sugestao = ref('')

/** Saque novo, questionário zerado. */
watch(
  () => pedido.value?.saqueId,
  () => {
    nota.value = null
    pontos.value = []
    incentivos.value = []
    sugestao.value = ''
  },
)

/** A API encerrou o saque (fora do prazo): reenviar não adianta. */
const encerrado = computed(() => erro.value?.tipo === 'prazo')

const aviso = computed(() => {
  if (erro.value?.tipo === 'prazo') {
    return erro.value.mensagem
  }

  return erro.value?.tipo === 'envio' ? t('carteira.feedbackSaque.erroEnvio') : ''
})

const pedeNota = computed(() => nota.value === null && !aviso.value)

/** X, clique fora e Esc chegam aqui; "Agora não" chama `fechar` direto. */
function aoMudarVisibilidade(visivel: boolean) {
  if (!visivel) {
    fechar()
  }
}

async function aoEnviar() {
  if (nota.value === null) {
    return
  }

  const gravou = await enviar({
    notaRecomendacao: nota.value,
    pontosPositivos: [...pontos.value],
    incentivos: [...incentivos.value],
    sugestao: sugestao.value,
  })

  if (gravou) {
    toast.add({
      severity: 'success',
      summary: t('carteira.feedbackSaque.obrigado.titulo'),
      detail: t('carteira.feedbackSaque.obrigado.texto'),
      life: 4000,
    })
  }
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    dismissable-mask
    :draggable="false"
    class="clinic-dialog clinic-scope hc-tema"
    :style="{ width: 'min(36rem, 94vw)' }"
    aria-labelledby="feedback-saque-titulo"
    aria-describedby="feedback-saque-intro"
    @update:visible="aoMudarVisibilidade"
  >
    <template #header>
      <h2 id="feedback-saque-titulo" class="feedback-saque__titulo">
        <i class="ph ph-check-circle" aria-hidden="true" />
        {{ t('carteira.feedbackSaque.titulo') }}
      </h2>
    </template>

    <div class="feedback-saque">
      <p id="feedback-saque-intro" class="feedback-saque__intro">
        {{ t('carteira.feedbackSaque.intro') }}
      </p>

      <section class="feedback-saque__pergunta">
        <h3 id="feedback-saque-nps" class="feedback-saque__enunciado">
          {{ t('carteira.feedbackSaque.nps.pergunta') }}
        </h3>
        <p id="feedback-saque-nps-legenda" class="feedback-saque__dica">
          {{ t('carteira.feedbackSaque.nps.legenda') }}
        </p>
        <EscalaDeNota
          v-model="nota"
          aria-labelledby="feedback-saque-nps"
          aria-describedby="feedback-saque-nps-legenda"
          :rotulo-de="(n) => t('carteira.feedbackSaque.nps.a11y', { nota: n })"
        />
      </section>

      <fieldset class="feedback-saque__pergunta">
        <legend class="feedback-saque__enunciado">
          {{ t('carteira.feedbackSaque.pontos.pergunta') }}
        </legend>
        <p class="feedback-saque__dica">{{ t('carteira.feedbackSaque.multiplaEscolha') }}</p>
        <div class="feedback-saque__opcoes">
          <label
            v-for="ponto in PONTOS_POSITIVOS"
            :key="ponto"
            class="feedback-saque__opcao"
            :for="`feedback-ponto-${ponto}`"
          >
            <Checkbox v-model="pontos" :input-id="`feedback-ponto-${ponto}`" :value="ponto" />
            <span>{{ t(`carteira.feedbackSaque.pontos.opcoes.${ponto}`) }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="feedback-saque__pergunta">
        <legend class="feedback-saque__enunciado">
          {{ t('carteira.feedbackSaque.incentivos.pergunta') }}
        </legend>
        <p class="feedback-saque__dica">{{ t('carteira.feedbackSaque.multiplaEscolha') }}</p>
        <div class="feedback-saque__opcoes">
          <label
            v-for="incentivo in INCENTIVOS_INDICACAO"
            :key="incentivo"
            class="feedback-saque__opcao"
            :for="`feedback-incentivo-${incentivo}`"
          >
            <Checkbox
              v-model="incentivos"
              :input-id="`feedback-incentivo-${incentivo}`"
              :value="incentivo"
            />
            <span>{{ t(`carteira.feedbackSaque.incentivos.opcoes.${incentivo}`) }}</span>
          </label>
        </div>
      </fieldset>

      <div class="feedback-saque__pergunta">
        <label class="feedback-saque__enunciado" for="feedback-saque-sugestao">
          {{ t('carteira.feedbackSaque.sugestao.label') }}
        </label>
        <Textarea
          id="feedback-saque-sugestao"
          v-model="sugestao"
          rows="3"
          auto-resize
          class="feedback-saque__texto"
          :maxlength="SUGESTAO_MAX_LENGTH"
          :placeholder="t('carteira.feedbackSaque.sugestao.placeholder')"
          aria-describedby="feedback-saque-contador"
        />
        <p id="feedback-saque-contador" class="feedback-saque__contador">
          {{
            t('carteira.feedbackSaque.sugestao.contador', {
              atual: sugestao.length,
              max: SUGESTAO_MAX_LENGTH,
            })
          }}
        </p>
      </div>
    </div>

    <template #footer>
      <div class="feedback-saque__rodape">
        <p v-if="aviso" class="feedback-saque__aviso feedback-saque__aviso--erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          {{ aviso }}
        </p>
        <p v-else-if="pedeNota" id="feedback-saque-pede-nota" class="feedback-saque__aviso">
          {{ t('carteira.feedbackSaque.notaObrigatoria') }}
        </p>

        <div class="feedback-saque__acoes">
          <Button
            type="button"
            :label="encerrado ? t('common.close') : t('carteira.feedbackSaque.agoraNao')"
            severity="secondary"
            text
            @click="fechar"
          />
          <Button
            type="button"
            :label="t('common.send')"
            icon="ph ph-paper-plane-tilt"
            :loading="enviando"
            :disabled="nota === null || enviando || encerrado"
            :aria-describedby="pedeNota ? 'feedback-saque-pede-nota' : undefined"
            @click="aoEnviar"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
/* O diálogo vai para o `body`, fora da página: só tokens `--hc-*` aqui. */
.feedback-saque__titulo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1.125rem;
  font-weight: 700;
}

.feedback-saque__titulo .ph {
  color: var(--hc-verde-tinta);
  font-size: 1.15rem;
}

.feedback-saque {
  display: grid;
  gap: 1.5rem;
}

.feedback-saque__intro {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.feedback-saque__pergunta {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.feedback-saque__enunciado {
  margin: 0;
  padding: 0;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.4;
}

.feedback-saque__dica {
  margin: 0 0 0.35rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.feedback-saque__opcoes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.15rem 1rem;
}

/* A linha inteira marca: no tablet o dedo não precisa acertar a caixinha. */
.feedback-saque__opcao {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  min-height: 2.5rem;
  padding: 0.55rem 0;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  line-height: 1.35;
  cursor: pointer;
}

.feedback-saque__opcao :deep(.p-checkbox) {
  flex-shrink: 0;
}

.feedback-saque__texto {
  width: 100%;
}

/* O terceiro cinza fica abaixo de 4,5:1 a 12 px: o apagado aqui é o segundo. */
.feedback-saque__contador {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.feedback-saque__rodape {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  width: 100%;
}

.feedback-saque__aviso {
  display: flex;
  flex: 1 1 14rem;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.4;
}

/* Erro em linha com ícone na tinta do estado, sem faixa pintada. */
.feedback-saque__aviso--erro {
  color: var(--hc-coral-tinta);
  font-weight: 600;
}

.feedback-saque__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-inline-start: auto;
}

/* O avião aponta para onde a leitura vai: em árabe, para a esquerda. */
[dir='rtl'] .feedback-saque__acoes :deep(.ph-paper-plane-tilt) {
  transform: scaleX(-1);
}

@media (max-width: 34rem) {
  .feedback-saque__opcoes {
    grid-template-columns: 1fr;
  }
}
</style>
