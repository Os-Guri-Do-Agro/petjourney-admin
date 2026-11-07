<script setup lang="ts">
/**
 * O mínimo de uma vacina (E6-01a, guia e6 7): abaixo dele, a geladeira e o selo do menu avisam.
 * `0` é "não me avise". Voltar ao do catálogo é mandar o padrão (não há apagar). Definir o mínimo
 * faz da vacina uma das que a clínica guarda. `estoque.planejar` (DONO e GESTOR).
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  definirMinimo,
  MINIMO_MAX,
  type VacinaNaGeladeira,
} from '@/service/parceiro/estoque-service'

const props = defineProps<{ vacina: VacinaNaGeladeira | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ definido: [] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const minimo = ref<number | null>(null)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  minimo.value = props.vacina?.minimo ?? 0
  erro.value = ''
})

async function gravar(valor: number) {
  if (!props.vacina) return
  erro.value = ''
  salvando.value = true
  try {
    await definirMinimo(props.vacina.vacinaId, valor, parceiroQuery())
    aberta.value = false
    emit('definido')
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}

function salvar() {
  if (minimo.value === null) return
  void gravar(minimo.value)
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="vacina ? t('estoque.minimo.titulo', { vacina: vacina.nome }) : ''"
    icone="ph ph-gauge"
  >
    <form id="minimo-vacina" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">{{ t('estoque.minimo.dica') }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="mn-minimo">{{ t('estoque.minimo.rotulo') }}</label>
        <InputNumber
          v-model="minimo"
          input-id="mn-minimo"
          :min="0"
          :max="MINIMO_MAX"
          :locale="locale"
          :suffix="` ${t('estoque.doses')}`"
          :disabled="salvando"
        />
        <small v-if="vacina" class="eg__dica">{{
          t('estoque.minimo.padrao', { n: vacina.minimoPadrao }, vacina.minimoPadrao)
        }}</small>
      </section>
      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>
    <template #pe>
      <Button
        v-if="vacina?.minimoDaClinica && vacina.minimo !== vacina.minimoPadrao"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-arrow-counter-clockwise"
        :label="t('estoque.minimo.voltar')"
        :disabled="salvando"
        @click="gravar(vacina.minimoPadrao)"
      />
      <Button
        type="submit"
        form="minimo-vacina"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
