<script setup lang="ts">
/**
 * A preferência do boletim, quando o responsável pede por telefone (E5-03, guia e5 17.1 e 18.1):
 * de quantas em quantas horas sai o automático, se quer foto quando der (desejo, nunca obrigação)
 * e o silêncio da noite (22h às 7h, um boletim só às 7h). O push nunca acorda ninguém.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  FREQUENCIAS_DO_BOLETIM,
  salvarPreferenciaDoBoletim,
  type PreferenciaDoBoletim,
} from '@/service/parceiro/boletins-da-internacao-service'

const props = defineProps<{ internacaoId: string; preferencia: PreferenciaDoBoletim | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salva: [preferencia: PreferenciaDoBoletim] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

type Frequencia = (typeof FREQUENCIAS_DO_BOLETIM)[number]

const frequencia = ref<Frequencia>(6)
const fotoSempre = ref(false)
const silencioNoturno = ref(true)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  frequencia.value = props.preferencia?.frequenciaHoras ?? 6
  fotoSempre.value = props.preferencia?.fotoSempre ?? false
  silencioNoturno.value = props.preferencia?.silencioNoturno ?? true
  erro.value = ''
})

const opcoes = computed(() =>
  FREQUENCIAS_DO_BOLETIM.map((valor) => ({
    valor,
    rotulo: t('internacao.prescricao.aCada', { n: valor }, valor),
  })),
)

async function salvar() {
  erro.value = ''
  salvando.value = true
  try {
    const salva = await salvarPreferenciaDoBoletim(
      props.internacaoId,
      {
        frequenciaHoras: frequencia.value,
        fotoSempre: fotoSempre.value,
        silencioNoturno: silencioNoturno.value,
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('salva', salva)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('internacao.boletim.preferencia')"
    icone="ph ph-sliders-horizontal"
  >
    <form id="preferencia-boletim" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">{{ t('internacao.boletim.preferenciaDica') }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="pb-frequencia">{{
          t('internacao.boletim.frequencia')
        }}</label>
        <Select
          v-model="frequencia"
          input-id="pb-frequencia"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :disabled="salvando"
        />
      </section>
      <label class="pb__chave" for="pb-silencio">
        <ToggleSwitch v-model="silencioNoturno" input-id="pb-silencio" :disabled="salvando" />
        <span>
          <strong>{{ t('internacao.boletim.silencio') }}</strong>
          <small>{{ t('internacao.boletim.silencioDica') }}</small>
        </span>
      </label>
      <label class="pb__chave" for="pb-foto">
        <ToggleSwitch v-model="fotoSempre" input-id="pb-foto" :disabled="salvando" />
        <span>
          <strong>{{ t('internacao.boletim.fotoSempre') }}</strong>
          <small>{{ t('internacao.boletim.fotoSempreDica') }}</small>
        </span>
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
        form="preferencia-boletim"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.pb__chave {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}

.pb__chave span {
  display: grid;
  gap: 2px;
}

.pb__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.pb__chave small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}
</style>
