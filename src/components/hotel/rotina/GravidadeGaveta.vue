<script setup lang="ts">
/**
 * Mudar a gravidade de uma ocorrência (E7-05b, guia e7 43). Subir é livre; descer pede o motivo.
 * Descer uma GRAVE é do gestor ou do dono, só antes da primeira tentativa de ligação e nunca
 * depois do contato ou do "sem resposta" (a tela nem oferece). A ocorrência não se apaga nem se
 * reescreve: só muda de gravidade, com o histórico.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  GRAVIDADES,
  mudarGravidade,
  NOTA_SEM_RESPOSTA_MAX,
  type Gravidade,
  type Ocorrencia,
} from '@/service/parceiro/hotel-ocorrencias-service'

const props = defineProps<{ ocorrencia: Ocorrencia | null; podeRebaixarGrave: boolean }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ mudada: [ocorrencia: Ocorrencia] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const gravidade = ref<Gravidade>('LEVE')
const motivo = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  gravidade.value = props.ocorrencia?.gravidade ?? 'LEVE'
  motivo.value = ''
  tentou.value = false
  erro.value = ''
})

const PESO: Record<Gravidade, number> = { LEVE: 0, MODERADA: 1, GRAVE: 2 }
const atual = computed(() => props.ocorrencia?.gravidade ?? 'LEVE')
const desce = computed(() => PESO[gravidade.value] < PESO[atual.value])

const opcoes = computed(() =>
  GRAVIDADES.filter(
    (valor) => atual.value !== 'GRAVE' || valor === 'GRAVE' || props.podeRebaixarGrave,
  ).map((valor) => ({ valor, rotulo: t(`rotinaDoHotel.ocorrencia.gravidade.${valor}`) })),
)

const valido = computed(
  () => gravidade.value !== atual.value && (!desce.value || motivo.value.trim().length > 0),
)

async function salvar() {
  tentou.value = true
  erro.value = ''
  const ocorrencia = props.ocorrencia
  if (!ocorrencia || !valido.value) return
  salvando.value = true
  try {
    const salva = await mudarGravidade(
      ocorrencia.id,
      { gravidade: gravidade.value, ...(desce.value ? { motivo: motivo.value.trim() } : {}) },
      parceiroQuery(),
    )
    aberta.value = false
    emit('mudada', salva)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('rotinaDoHotel.gravidade.erro')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('rotinaDoHotel.gravidade.titulo')"
    icone="ph ph-arrows-down-up"
  >
    <form id="gravidade-hotel" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <span id="gv-gravidade" class="eg__rotulo">{{
          t('rotinaDoHotel.ocorrencia.gravidadeRotulo')
        }}</span>
        <SelectButton
          v-model="gravidade"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="gv-gravidade"
          :disabled="salvando"
        />
        <p v-if="gravidade === 'GRAVE' && atual !== 'GRAVE'" class="eg__aviso">
          <i class="ph ph-phone-call" aria-hidden="true" />
          <span>{{ t('rotinaDoHotel.ocorrencia.graveExigeContato') }}</span>
        </p>
      </section>
      <section v-if="desce" class="eg__secao">
        <label class="eg__rotulo" for="gv-motivo">{{ t('rotinaDoHotel.gravidade.motivo') }}</label>
        <Textarea
          id="gv-motivo"
          v-model="motivo"
          rows="2"
          auto-resize
          :maxlength="NOTA_SEM_RESPOSTA_MAX"
          :invalid="tentou && !motivo.trim()"
          :disabled="salvando"
        />
      </section>
      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>
    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="gravidade-hotel"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
        :disabled="gravidade === atual"
      />
    </template>
  </CadastroGaveta>
</template>
