<script setup lang="ts">
/**
 * O resultado de um atendimento em campo, no detalhe dele (17/11/2026, "um lugar para anotar se
 * conseguiu ou não e o motivo"): como ficou cada procedimento e, em "Anotar resultado", o mesmo
 * editor do registro. Serve à castração que ficou para outro dia, à vacina que faltou e voltou: a
 * equipe abre o atendimento e anota, e o relatório passa a contar o novo resultado.
 */
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'

import ResultadoDosProcedimentos from '@/features/saude-publica/components/ResultadoDosProcedimentos.vue'
import {
  procedimento,
  situacaoDoAtendimento,
  type ResultadoDoProcedimento,
} from '@/features/saude-publica/dados'
import { faltasDoResultado, SITUACOES, textoDoMotivo } from '@/features/saude-publica/resultado'

const props = defineProps<{
  /** Prefixo dos ids. */
  id: string
  resultados: ResultadoDoProcedimento[]
}>()
const emit = defineEmits<{ salvar: [resultados: ResultadoDoProcedimento[]] }>()

const editando = ref(false)
const rascunho = ref<ResultadoDoProcedimento[]>([])
const tentou = ref(false)

/* Outro atendimento aberto na mesma gaveta: a edição recomeça. */
watch(
  () => props.id,
  () => {
    editando.value = false
    tentou.value = false
  },
)

const situacao = computed(() => SITUACOES[situacaoDoAtendimento(props.resultados)])

function anotar() {
  rascunho.value = props.resultados.map((item) => ({ ...item }))
  tentou.value = false
  editando.value = true
}

function salvar() {
  tentou.value = true
  if (faltasDoResultado(rascunho.value).length) return
  emit('salvar', rascunho.value)
  editando.value = false
}
</script>

<template>
  <section class="rda" :aria-labelledby="`${id}-titulo`">
    <header class="rda__cabeca">
      <h3 :id="`${id}-titulo`" class="eg__rotulo rda__titulo">Resultado do atendimento</h3>
      <span class="ui-selo" :class="situacao.classe">
        <i :class="situacao.icone" aria-hidden="true" />
        {{ situacao.rotulo }}
      </span>
    </header>

    <template v-if="!editando">
      <ul class="rda__lista">
        <li v-for="item in resultados" :key="item.procedimento" class="rda__item">
          <i
            :class="item.feito ? 'ph ph-check-circle rda__ok' : 'ph ph-x-circle rda__nao'"
            aria-hidden="true"
          />
          <span>
            <strong>{{ procedimento(item.procedimento).rotulo }}</strong>
            {{ item.feito ? 'feito' : `não deu: ${textoDoMotivo(item)}` }}
          </span>
        </li>
      </ul>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        class="rda__anotar"
        icon="ph ph-note-pencil"
        label="Anotar resultado"
        @click="anotar"
      />
    </template>

    <template v-else>
      <ResultadoDosProcedimentos :id="`${id}-editor`" v-model="rascunho" :mostrar-faltas="tentou" />
      <div class="rda__acoes">
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          label="Cancelar"
          @click="editando = false"
        />
        <Button
          type="button"
          size="small"
          icon="ph ph-check"
          label="Salvar resultado"
          @click="salvar"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.rda {
  display: grid;
  gap: 10px;
}

.rda__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.rda__titulo {
  margin: 0;
}

.rda__lista {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rda__item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.4;
}

.rda__item strong {
  color: var(--tinta);
}

.rda__item i {
  flex: none;
  margin-top: 1px;
  font-size: 17px;
}

.rda__ok {
  color: var(--ok-tinta);
}

.rda__nao {
  color: var(--risco-tinta);
}

.rda__anotar {
  justify-self: start;
}

.rda__acoes {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
