<script setup lang="ts">
/**
 * O vazio útil: paciente que nunca passou pela clínica e cujo responsável ainda não abriu o app.
 *
 * Uma tela em branco diria "nada a ver aqui" — e há muito a fazer. Em vez do vazio, a lista do
 * que esta primeira consulta precisa levantar, montada a partir do pouco que o cadastro já
 * sabe: sem peso, pesar; filhote, perguntar origem e desmame. O último item é o que faz a
 * próxima abertura desta tela não ser vazia.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import '../ficha/ficha.css'
import type { Pet } from '../../../data/types'
import { faixaEtariaDoPaciente } from '../../../domain/porte'
import { clinicClock } from '../../../stores/clinico'

const props = defineProps<{
  pet: Pet
}>()

const { t } = useI18n()

const itens = computed(() => {
  const filhote = faixaEtariaDoPaciente(props.pet, clinicClock.today()) === 'filhote'

  return [
    props.pet.pesoKg === null ? 'pesar' : '',
    'vacinas',
    filhote ? 'filhote' : '',
    'antecedentes',
    'diario',
  ].filter(Boolean)
})
</script>

<template>
  <section class="ficha-cartao ui-folha" aria-labelledby="resumo-primeira-titulo">
    <header class="ficha-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-stethoscope" /></span>
      <div class="ficha-cartao__titulos">
        <h2 id="resumo-primeira-titulo" class="ficha-cartao__titulo">
          {{ t('clinico.resumoDoPaciente.primeira.titulo') }}
        </h2>
        <p class="ficha-cartao__descricao">
          {{ t('clinico.resumoDoPaciente.primeira.descricao') }}
        </p>
      </div>
    </header>

    <ol class="primeira">
      <li v-for="(item, indice) in itens" :key="item" class="primeira__item">
        <span class="primeira__numero ui-num" aria-hidden="true">{{ indice + 1 }}</span>
        <span class="primeira__texto">
          <strong>{{ t(`clinico.resumoDoPaciente.primeira.${item}.titulo`) }}</strong>
          <span>{{ t(`clinico.resumoDoPaciente.primeira.${item}.detalhe`) }}</span>
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.primeira {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.primeira__item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 24px;
}

.primeira__item + .primeira__item {
  border-top: 1px solid var(--linha-suave);
}

.primeira__numero {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 13px;
  font-weight: 650;
}

.primeira__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
  padding-top: 3px;
}

.primeira__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.primeira__texto span {
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}
</style>
