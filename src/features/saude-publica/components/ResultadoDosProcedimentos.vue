<script setup lang="ts">
/**
 * O resultado de cada procedimento do atendimento em campo (17/11/2026, "anotar se conseguiu ou não
 * e o motivo, em opções rápidas"): "Feito" ou "Não deu" em dois botões grandes, e no "Não deu" os
 * motivos que valem para aquele procedimento, num toque só. "Outro motivo" pede a frase.
 *
 * O mesmo editor no registro (passo "O que foi feito") e depois, no "Anotar resultado" do detalhe
 * do atendimento: a equipe que volta ao caso (a castração que ficou para outro dia) anota ali.
 * Pensado para tablet: alvos de 44 px e nada escondido em hover.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'

import {
  motivosDo,
  procedimento,
  situacaoDoAtendimento,
  type MotivoDeNaoFeito,
  type ResultadoDoProcedimento,
} from '@/features/saude-publica/dados'
import { faltasDoResultado, SITUACOES } from '@/features/saude-publica/resultado'

const resultados = defineModel<ResultadoDoProcedimento[]>({ required: true })

const props = withDefaults(
  defineProps<{
    /** Prefixo dos ids, para dois editores na mesma página não repetirem. */
    id: string
    /** Depois do primeiro "Continuar": o motivo que falta aparece no lugar dele. */
    mostrarFaltas?: boolean
    desabilitado?: boolean
  }>(),
  { mostrarFaltas: false, desabilitado: false },
)

const OPCOES = [
  { valor: true, rotulo: 'Feito', icone: 'ph ph-check' },
  { valor: false, rotulo: 'Não deu', icone: 'ph ph-x' },
]

function trocar(indice: number, mudanca: Partial<ResultadoDoProcedimento>) {
  resultados.value = resultados.value.map((item, posicao) => {
    if (posicao !== indice) return item
    const novo = { ...item, ...mudanca }
    /* Feito não tem motivo: limpar evita levar um motivo velho para o relatório. */
    if (novo.feito) return { procedimento: novo.procedimento, feito: true }
    return novo
  })
}

function escolherMotivo(indice: number, id: MotivoDeNaoFeito) {
  const atual = resultados.value[indice]
  trocar(indice, {
    motivo: id,
    observacao: id === 'outro' ? (atual?.observacao ?? '') : undefined,
  })
}

const situacao = computed(() =>
  resultados.value.length ? SITUACOES[situacaoDoAtendimento(resultados.value)] : null,
)

/** A falta de cada linha, para o aviso morar embaixo dela. */
const faltaDe = (item: ResultadoDoProcedimento) =>
  props.mostrarFaltas ? (faltasDoResultado([item])[0] ?? '') : ''
</script>

<template>
  <div class="rdp">
    <section
      v-for="(item, indice) in resultados"
      :key="item.procedimento"
      class="rdp__linha"
      :class="{ 'rdp__linha--nao': !item.feito }"
      :aria-labelledby="`${id}-${item.procedimento}`"
    >
      <header class="rdp__cabeca">
        <span class="rdp__icone" aria-hidden="true">
          <i :class="procedimento(item.procedimento).icone" />
        </span>
        <strong :id="`${id}-${item.procedimento}`" class="rdp__nome">
          {{ procedimento(item.procedimento).rotulo }}
        </strong>
        <SelectButton
          class="rdp__escolha"
          :model-value="item.feito"
          :options="OPCOES"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :disabled="desabilitado"
          :aria-label="`${procedimento(item.procedimento).rotulo}: feito ou não deu`"
          @update:model-value="(valor: boolean) => trocar(indice, { feito: valor })"
        >
          <template #option="{ option }">
            <i :class="option.icone" aria-hidden="true" />
            <span>{{ option.rotulo }}</span>
          </template>
        </SelectButton>
      </header>

      <div v-if="!item.feito" class="rdp__motivos">
        <span :id="`${id}-${item.procedimento}-motivo`" class="rdp__pergunta">Por quê?</span>
        <div
          class="rdp__pilulas"
          role="radiogroup"
          :aria-labelledby="`${id}-${item.procedimento}-motivo`"
        >
          <Button
            v-for="opcao in motivosDo(item.procedimento)"
            :key="opcao.id"
            type="button"
            role="radio"
            size="small"
            class="rdp__pilula"
            :class="{ 'rdp__pilula--marcada': item.motivo === opcao.id }"
            :severity="item.motivo === opcao.id ? undefined : 'secondary'"
            :outlined="item.motivo !== opcao.id"
            :icon="opcao.icone"
            :label="opcao.rotulo"
            :aria-checked="item.motivo === opcao.id"
            :disabled="desabilitado"
            @click="escolherMotivo(indice, opcao.id)"
          />
        </div>
        <InputText
          v-if="item.motivo === 'outro'"
          :id="`${id}-${item.procedimento}-outro`"
          :model-value="item.observacao ?? ''"
          class="rdp__outro"
          maxlength="120"
          placeholder="Qual foi o motivo?"
          aria-label="Qual foi o motivo?"
          :invalid="Boolean(faltaDe(item))"
          :disabled="desabilitado"
          @update:model-value="(valor?: string) => trocar(indice, { observacao: valor ?? '' })"
        />
        <small v-if="faltaDe(item)" class="eg__invalido">{{ faltaDe(item) }}</small>
      </div>
    </section>

    <p v-if="situacao" class="rdp__situacao">
      Situação do atendimento:
      <span class="ui-selo" :class="situacao.classe">
        <i :class="situacao.icone" aria-hidden="true" />
        {{ situacao.rotulo }}
      </span>
    </p>
  </div>
</template>

<style scoped>
.rdp {
  display: grid;
  gap: 10px;
}

.rdp__linha {
  display: grid;
  gap: 12px;
  padding: 12px 14px;
  border: 1.5px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
}

/* O que não deu ganha a borda da atenção: a forma avisa, não a cor de fundo. */
.rdp__linha--nao {
  border-color: color-mix(in oklab, var(--atencao-tinta) 45%, var(--linha));
}

.rdp__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}

.rdp__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--pets-fundo);
  color: var(--pets-tinta);
  font-size: 18px;
}

.rdp__nome {
  flex: 1;
  min-width: 8rem;
  color: var(--tinta);
  font-size: 14.5px;
}

/* Os dois botões grandes: alvo de tablet. */
.rdp__escolha :deep(.p-togglebutton) {
  min-height: 44px;
}

.rdp__escolha :deep(.p-togglebutton-content) {
  gap: 6px;
  padding-inline: 14px;
  font-weight: 650;
}

.rdp__motivos {
  display: grid;
  gap: 8px;
}

.rdp__pergunta {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 650;
}

.rdp__pilulas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rdp__pilula.p-button {
  min-height: 40px;
  border-radius: 999px;
}

.rdp__situacao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 2px 0 0;
  color: var(--tinta-2);
  font-size: 13px;
}
</style>
