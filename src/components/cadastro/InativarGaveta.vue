<script setup lang="ts">
/**
 * Inativar o paciente ou registrar o óbito (E2-01, seção 1.6). O óbito pede a data; paciente com
 * óbito não recebe agendamento, lembrete, oferta nem convite da clínica. "Duplicado" não está
 * aqui: sai só pelo mesclar. Reativar desfaz por engano, na ficha.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import RadioButton from 'primevue/radiobutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  inativarPaciente,
  MOTIVOS_DE_INATIVACAO,
  type MotivoDeInativacao,
  type Paciente,
} from '@/service/parceiro/pacientes-service'

const props = defineProps<{ paciente: Paciente | null; obito?: boolean }>()
const emit = defineEmits<{ salvo: [paciente: Paciente] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const motivo = ref<MotivoDeInativacao>('OBITO')
const dataDoObito = ref<Date | null>(new Date())
const erro = ref('')
const salvando = ref(false)
const hoje = new Date()

watch(visible, (aberta) => {
  if (!aberta) return

  motivo.value = props.obito ? 'OBITO' : 'TRANSFERIDO'
  dataDoObito.value = new Date()
  erro.value = ''
})

const valido = computed(() => motivo.value !== 'OBITO' || Boolean(dataDoObito.value))

function aaaammdd(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`
}

async function salvar() {
  if (!props.paciente || !valido.value) return

  salvando.value = true
  erro.value = ''

  try {
    const salvo = await inativarPaciente(
      props.paciente.id,
      motivo.value === 'OBITO' && dataDoObito.value
        ? { motivo: 'OBITO', obitoEm: aaaammdd(dataDoObito.value) }
        : { motivo: motivo.value },
      parceiroQuery(),
    )

    emit('salvo', salvo)
    visible.value = false
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="t('cadastro.inativo.titulo', { nome: paciente?.nome ?? '' })"
    icone="ph ph-archive"
  >
    <form id="inativar-form" class="eg" novalidate @submit.prevent="salvar">
      <fieldset class="in__motivos">
        <legend class="eg__rotulo">{{ t('cadastro.inativo.porque') }}</legend>
        <label v-for="item in MOTIVOS_DE_INATIVACAO" :key="item" class="in__motivo">
          <RadioButton
            v-model="motivo"
            :value="item"
            :input-id="`inativar-${item}`"
            name="motivo"
            :disabled="salvando"
          />
          <span>{{ t(`cadastro.inativo.motivo.${item}`) }}</span>
        </label>
      </fieldset>

      <section v-if="motivo === 'OBITO'" class="eg__secao">
        <span id="inativar-data" class="eg__rotulo">{{ t('cadastro.inativo.dataDoObito') }}</span>
        <DatePicker
          v-model="dataDoObito"
          inline
          :max-date="hoje"
          aria-labelledby="inativar-data"
          :disabled="salvando"
          class="in__calendario"
        />
        <small class="eg__dica">{{ t('cadastro.inativo.obitoDica') }}</small>
      </section>
      <p v-else class="eg__dica">{{ t('cadastro.inativo.dica') }}</p>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>

    <template #pe>
      <Button
        type="button"
        :label="t('cadastro.cancelar')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="visible = false"
      />
      <Button
        type="submit"
        form="inativar-form"
        :icon="motivo === 'OBITO' ? 'ph ph-flower-lotus' : 'ph ph-archive'"
        :label="
          motivo === 'OBITO' ? t('cadastro.inativo.registrarObito') : t('cadastro.inativo.inativar')
        "
        :loading="salvando"
        :disabled="!valido"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.in__motivos {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
}

.in__motivo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
}

.in__calendario {
  justify-self: center;
}
</style>
