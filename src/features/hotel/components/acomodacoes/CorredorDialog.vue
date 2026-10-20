<script setup lang="ts">
/**
 * Cadastro de um corredor da casa.
 *
 * O corredor não é agrupamento de tela: é o caminho que a pessoa faz de manhã com o balde na mão.
 *
 * **O nome e o desenho são da casa.** Ele tinha um tipo fechado — canil, gatil, área externa,
 * isolamento —, e aquelas quatro palavras eram nossas: pressupunham que a casa hospeda cão e gato,
 * e apareciam ao lado do nome que a operação escolheu, contradizendo-o. Agora a casa escreve o
 * nome e escolhe a forma; o que separa gato de cão continua sendo o dado de espécies aceitas da
 * acomodação, que é onde essa regra sempre morou de verdade.
 *
 * **Remover fica atrás de um segundo toque, e só quando o corredor está vazio.** Um corredor com
 * baia dentro não pode sumir: as acomodações passariam a apontar para um identificador morto, e o
 * defeito não apareceria aqui — apareceria na próxima reserva.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import EscolhaDeDesenho from './EscolhaDeDesenho.vue'
import type { Bloco, IconeDeAcomodacao } from '../../data/types'

const props = defineProps<{
  aberto: boolean
  /** `null` cria; preenchido edita. */
  corredor: Bloco | null
  /** Quantas acomodações moram nele. Zero é o único caso em que remover é honesto. */
  vagas: number
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  salvar: [payload: { nome: string; icone: IconeDeAcomodacao }]
  remover: []
}>()

const { t } = useI18n()
const idCampo = useId()

const nome = ref('')
const icone = ref<IconeDeAcomodacao>('casa')
const confirmandoRemocao = ref(false)

const editando = computed(() => props.corredor !== null)

/*
 * O formulário volta ao estado do corredor toda vez que o diálogo abre — e não só quando o
 * corredor muda. Sem isto, fechar no meio de uma edição e reabrir traria o rascunho abandonado
 * como se fosse o cadastro, que é o jeito mais silencioso de salvar o que ninguém quis salvar.
 */
watch(
  () => [props.aberto, props.corredor] as const,
  ([aberto]) => {
    if (!aberto) {
      return
    }

    nome.value = props.corredor?.nome ?? ''
    icone.value = props.corredor?.icone ?? 'casa'
    confirmandoRemocao.value = false
  },
  { immediate: true },
)

const podeSalvar = computed(() => nome.value.trim().length > 0 && !props.salvando)
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="editando ? t('hotel.acomodacoes.corredor.editar') : t('hotel.acomodacoes.corredor.novo')"
    :style="{ width: 'min(30rem, 94vw)' }"
    class="clinic-scope"
    @update:visible="emit('fechar')"
  >
    <form class="forma" @submit.prevent="emit('salvar', { nome, icone })">
      <div class="campo">
        <label :for="`${idCampo}-nome`">{{ t('hotel.acomodacoes.corredor.nome') }}</label>
        <InputText
          :id="`${idCampo}-nome`"
          v-model="nome"
          :placeholder="t('hotel.acomodacoes.corredor.nomeDica')"
          autocomplete="off"
        />
        <small class="campo__dica">{{ t('hotel.acomodacoes.corredor.nomeExplica') }}</small>
      </div>

      <EscolhaDeDesenho
        v-model="icone"
        :grupo="`${idCampo}-desenho`"
        :rotulo="t('hotel.acomodacoes.corredor.desenho')"
      />

      <p v-if="erro" class="erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t(erro) }}
      </p>

      <!--
        Remover só aparece no corredor vazio. Com vaga dentro, o que a pessoa quer é mover as vagas
        primeiro — e um botão que sempre recusa ensina a ignorar o aviso, não a resolver o problema.
      -->
      <section v-if="editando" class="perigo">
        <p v-if="vagas > 0" class="perigo__travado">
          <i class="ph ph-info" aria-hidden="true" />
          {{ t('hotel.acomodacoes.corredor.temVagas', { total: vagas }, vagas) }}
        </p>

        <template v-else-if="confirmandoRemocao">
          <p class="perigo__pergunta">{{ t('hotel.acomodacoes.corredor.removerMesmo') }}</p>
          <div class="perigo__acoes">
            <Button
              :label="t('hotel.comum.cancelar')"
              severity="secondary"
              text
              size="small"
              @click="confirmandoRemocao = false"
            />
            <Button
              :label="t('hotel.acomodacoes.corredor.remover')"
              icon="ph ph-trash"
              severity="danger"
              size="small"
              :loading="salvando"
              @click="emit('remover')"
            />
          </div>
        </template>

        <Button
          v-else
          :label="t('hotel.acomodacoes.corredor.remover')"
          icon="ph ph-trash"
          severity="danger"
          text
          size="small"
          @click="confirmandoRemocao = true"
        />
      </section>
    </form>

    <template #footer>
      <Button :label="t('hotel.comum.cancelar')" severity="secondary" text @click="emit('fechar')" />
      <Button
        :label="t('hotel.comum.salvar')"
        icon="ph ph-check"
        :disabled="!podeSalvar"
        :loading="salvando"
        @click="emit('salvar', { nome, icone })"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.forma {
  display: grid;
  gap: 18px;
}

.campo {
  display: grid;
  align-content: start;
  gap: 6px;
}

.campo label {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.campo__dica {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
}

/* Remover mora no pé do formulário, separado por um fio: é a única ação que não se desfaz. */
.perigo {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding-block-start: 14px;
  border-block-start: 1px solid var(--linha);
}

.perigo__travado {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.perigo__travado i {
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 16px;
}

.perigo__pergunta {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 600;
}

.perigo__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.erro {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 500;
}

.erro i {
  flex: none;
  font-size: 18px;
}
</style>
