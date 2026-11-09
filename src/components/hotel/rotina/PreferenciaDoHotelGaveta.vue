<script setup lang="ts">
/**
 * A preferência do boletim do hotel, quando o responsável pede no balcão (E7-05c, guia e7 44): de
 * 12 em 12 horas (07:00 e 19:00), de 24 em 24 (07:00) ou de 48 em 48 (07:00, dia sim, dia não),
 * sempre no relógio da casa, e se ele quer foto quando houver (desejo, nunca obrigação). O boletim
 * de rotina nunca nasce nem sai entre 22:00 e 07:00.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  FREQUENCIAS_DO_BOLETIM_DO_HOTEL,
  salvarPreferenciaDoHotel,
  type PreferenciaDoBoletimDoHotel,
} from '@/service/parceiro/hotel-boletim-service'

const props = defineProps<{
  hospedagemId: string
  preferencia: PreferenciaDoBoletimDoHotel | null
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salva: [preferencia: PreferenciaDoBoletimDoHotel] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

type Frequencia = (typeof FREQUENCIAS_DO_BOLETIM_DO_HOTEL)[number]

const frequencia = ref<Frequencia>(24)
const fotoSempre = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  frequencia.value = props.preferencia?.frequenciaHoras ?? 24
  fotoSempre.value = props.preferencia?.fotoSempre ?? false
  erro.value = ''
})

const opcoes = computed(() =>
  FREQUENCIAS_DO_BOLETIM_DO_HOTEL.map((valor) => ({
    valor,
    rotulo: t('boletimDoHotel.aCada', { n: valor }),
  })),
)

async function salvar() {
  erro.value = ''
  salvando.value = true
  try {
    const salva = await salvarPreferenciaDoHotel(
      props.hospedagemId,
      { frequenciaHoras: frequencia.value, fotoSempre: fotoSempre.value },
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
    :titulo="t('boletimDoHotel.preferencia')"
    icone="ph ph-sliders-horizontal"
  >
    <form id="preferencia-hotel" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">{{ t('boletimDoHotel.preferenciaDica') }}</p>
      <section class="eg__secao">
        <span id="ph-frequencia" class="eg__rotulo">{{ t('boletimDoHotel.frequencia') }}</span>
        <SelectButton
          v-model="frequencia"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="ph-frequencia"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t(`boletimDoHotel.horarios.h${frequencia}`) }}</small>
      </section>
      <label class="ph__chave" for="ph-foto">
        <ToggleSwitch v-model="fotoSempre" input-id="ph-foto" :disabled="salvando" />
        <span>
          <strong>{{ t('boletimDoHotel.fotoSempre') }}</strong>
          <small>{{ t('boletimDoHotel.fotoSempreDica') }}</small>
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
        form="preferencia-hotel"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ph__chave {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}

.ph__chave span {
  display: grid;
  gap: 2px;
}

.ph__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.ph__chave small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}
</style>
