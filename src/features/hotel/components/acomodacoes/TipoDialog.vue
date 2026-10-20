<script setup lang="ts">
/**
 * Cadastro de um tipo de acomodação.
 *
 * ## Por que este diálogo existe
 *
 * Porque o tipo era **nosso**. Cinco palavras numa união fechada do código — suíte, baia, gatil,
 * coletiva, isolamento —, moldadas em cão e gato e impostas a quem abre a tela. Um hotel que chama
 * as unidades de "chalé" lia "Baia" e não se reconhecia. Um que hospeda aves ou coelhos não tinha
 * vocabulário nenhum: "gatil" e "canil" não são nomes neutros, são a nossa suposição sobre que
 * animais existem no mundo.
 *
 * ## O que continua sendo nosso
 *
 * Só o **desenho**. A casa escolhe entre as formas que a biblioteca oferece, e a palavra é dela.
 * É a divisão que mantém a regra da casa de que toda tela tem ícone sem impor junto o vocabulário:
 * o traço é nosso, o nome é de quem trabalha ali.
 *
 * ## O que o tipo **não** decide
 *
 * Quem pode ficar onde. Isso é decidido pelas espécies aceitas e pelo porte máximo da acomodação,
 * que são dado — e é por isso que abrir o tipo foi seguro: a regra de vaga nunca ramificou pela
 * palavra, só a usava para filtrar.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import EscolhaDeDesenho from './EscolhaDeDesenho.vue'
import type { IconeDeAcomodacao, TipoDeAcomodacao } from '../../data/types'

const props = defineProps<{
  aberto: boolean
  /** `null` cria; preenchido edita. */
  tipo: TipoDeAcomodacao | null
  /** Quantas acomodações usam este tipo. Zero é o único caso em que remover é honesto. */
  emUso: number
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

const editando = computed(() => props.tipo !== null)

watch(
  () => [props.aberto, props.tipo] as const,
  ([aberto]) => {
    if (!aberto) {
      return
    }

    nome.value = props.tipo?.nome ?? ''
    icone.value = props.tipo?.icone ?? 'casa'
    confirmandoRemocao.value = false
  },
  { immediate: true },
)

const podeSalvar = computed(() => nome.value.trim().length > 0 && !props.salvando)

function salvar() {
  emit('salvar', { nome: nome.value, icone: icone.value })
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="editando ? t('hotel.acomodacoes.tipo.editar') : t('hotel.acomodacoes.tipo.novo')"
    :style="{ width: 'min(30rem, 94vw)' }"
    class="clinic-scope pj-lugar--hotel"
    @update:visible="emit('fechar')"
  >
    <form class="forma" @submit.prevent="salvar">
      <div class="campo">
        <label :for="`${idCampo}-nome`">{{ t('hotel.acomodacoes.tipo.nome') }}</label>
        <InputText
          :id="`${idCampo}-nome`"
          v-model="nome"
          :placeholder="t('hotel.acomodacoes.tipo.nomeDica')"
          autocomplete="off"
        />
        <small class="campo__dica">{{ t('hotel.acomodacoes.tipo.nomeExplica') }}</small>
      </div>

      <!--
        O desenho é escolhido numa grade e não num `Select`: são nove formas, e escolher forma
        lendo o nome dela é escolher errado. Cada botão é rádio de verdade para o teclado.
      -->
      <EscolhaDeDesenho
        v-model="icone"
        :grupo="`${idCampo}-desenho`"
        :rotulo="t('hotel.acomodacoes.tipo.desenho')"
      />

      <p v-if="erro" class="erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t(erro) }}
      </p>

      <section v-if="editando" class="perigo">
        <p v-if="emUso > 0" class="perigo__travado">
          <i class="ph ph-info" aria-hidden="true" />
          {{ t('hotel.acomodacoes.tipo.emUso', { total: emUso }, emUso) }}
        </p>

        <template v-else-if="confirmandoRemocao">
          <p class="perigo__pergunta">{{ t('hotel.acomodacoes.tipo.removerMesmo') }}</p>
          <div class="perigo__acoes">
            <Button
              :label="t('hotel.comum.cancelar')"
              severity="secondary"
              text
              size="small"
              @click="confirmandoRemocao = false"
            />
            <Button
              :label="t('hotel.acomodacoes.tipo.remover')"
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
          :label="t('hotel.acomodacoes.tipo.remover')"
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
        @click="salvar"
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
