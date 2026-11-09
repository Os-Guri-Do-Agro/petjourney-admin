<script setup lang="ts">
/**
 * Registrar uma ocorrência da estadia (E7-05b, guia e7 43): o tipo, a gravidade, o que houve
 * (1 a 500) e a conduta da casa (1 a 300, obrigatória). **Só a gravidade decide**: a GRAVE exige
 * contato por voz com o responsável antes da passagem do turno, do check-out e do boletim. A
 * ocorrência não avisa o responsável pelo app: a ligação é humana.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  CONDUTA_MAX,
  DESCRICAO_DA_OCORRENCIA_MAX,
  GRAVIDADES,
  KINDS_DA_OCORRENCIA,
  registrarOcorrencia,
  type Gravidade,
  type KindDaOcorrencia,
  type Ocorrencia,
} from '@/service/parceiro/hotel-ocorrencias-service'

const props = defineProps<{ hospedagemId: string }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ registrada: [ocorrencia: Ocorrencia] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const kind = ref<KindDaOcorrencia | null>(null)
const gravidade = ref<Gravidade>('LEVE')
const descricao = ref('')
const conduta = ref('')
const encaminhada = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  kind.value = null
  gravidade.value = 'LEVE'
  descricao.value = ''
  conduta.value = ''
  encaminhada.value = false
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

const opcoesDeKind = computed(() =>
  KINDS_DA_OCORRENCIA.map((valor) => ({
    valor,
    rotulo: t(`rotinaDoHotel.ocorrencia.kind.${valor}`),
  })),
)
const opcoesDeGravidade = computed(() =>
  GRAVIDADES.map((valor) => ({ valor, rotulo: t(`rotinaDoHotel.ocorrencia.gravidade.${valor}`) })),
)

const valido = computed(
  () => Boolean(kind.value) && descricao.value.trim().length > 0 && conduta.value.trim().length > 0,
)

async function registrar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  const corpo = {
    kind: kind.value!,
    gravidade: gravidade.value,
    descricao: descricao.value.trim(),
    conduta: conduta.value.trim(),
    encaminhadaAoVeterinario: encaminhada.value,
  }
  salvando.value = true
  try {
    const ocorrencia = await registrarOcorrencia(
      props.hospedagemId,
      corpo,
      chaveador.para(corpo),
      parceiroQuery(),
    )
    chaveador.concluir()
    aberta.value = false
    emit('registrada', ocorrencia)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('rotinaDoHotel.ocorrencia.erro'))
    erro.value =
      lido.codigo === 'PROFISSIONAL_OBRIGATORIO' ? t('rotinaDoHotel.semFicha') : lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('rotinaDoHotel.ocorrencia.registrar')"
    icone="ph ph-warning-diamond"
  >
    <form id="ocorrencia-hotel" class="eg" novalidate @submit.prevent="registrar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="oc-kind">{{ t('rotinaDoHotel.ocorrencia.tipo') }}</label>
        <Select
          v-model="kind"
          input-id="oc-kind"
          :options="opcoesDeKind"
          option-label="rotulo"
          option-value="valor"
          :invalid="tentou && !kind"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="oc-gravidade" class="eg__rotulo">{{
          t('rotinaDoHotel.ocorrencia.gravidadeRotulo')
        }}</span>
        <SelectButton
          v-model="gravidade"
          :options="opcoesDeGravidade"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="oc-gravidade"
          :disabled="salvando"
        />
        <p v-if="gravidade === 'GRAVE'" class="eg__aviso">
          <i class="ph ph-phone-call" aria-hidden="true" />
          <span>{{ t('rotinaDoHotel.ocorrencia.graveExigeContato') }}</span>
        </p>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="oc-descricao">{{
          t('rotinaDoHotel.ocorrencia.oQueHouve')
        }}</label>
        <Textarea
          id="oc-descricao"
          v-model="descricao"
          rows="3"
          auto-resize
          :maxlength="DESCRICAO_DA_OCORRENCIA_MAX"
          :invalid="tentou && !descricao.trim()"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="oc-conduta">{{
          t('rotinaDoHotel.ocorrencia.conduta')
        }}</label>
        <Textarea
          id="oc-conduta"
          v-model="conduta"
          rows="2"
          auto-resize
          :maxlength="CONDUTA_MAX"
          :invalid="tentou && !conduta.trim()"
          :disabled="salvando"
        />
      </section>

      <label class="oc__marcar" for="oc-vet">
        <Checkbox v-model="encaminhada" input-id="oc-vet" binary :disabled="salvando" />
        <span>{{ t('rotinaDoHotel.ocorrencia.encaminhada') }}</span>
      </label>

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
        form="ocorrencia-hotel"
        icon="ph ph-check"
        :label="t('rotinaDoHotel.ocorrencia.registrar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.oc__marcar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}
</style>
