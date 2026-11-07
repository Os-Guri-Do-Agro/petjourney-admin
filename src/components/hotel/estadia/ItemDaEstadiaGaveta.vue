<script setup lang="ts">
/**
 * Um remédio trazido de casa ou um cuidado durante a estadia (E7-04a, guia e7 27): a descrição, os
 * horários ("08:00, 20:00") e, no remédio, a via, a dose em texto (o hotel não calcula dose) e a
 * receita, ou o motivo de não ter (10 a 300). Começa hoje na casa.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  HORARIOS_MAX,
  MOTIVO_SEM_RECEITA_MAX,
  MOTIVO_SEM_RECEITA_MIN,
  registrarCuidado,
  registrarMedicacao,
  TEXTO_MAX,
  VIAS,
  type Via,
} from '@/service/parceiro/hotel-estadia-service'

const props = defineProps<{ hospedagemId: string; tipo: 'MEDICACAO' | 'CUIDADO' }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const descricao = ref('')
const via = ref<Via>('ORAL')
const dose = ref('')
const horarios = ref('')
const receita = ref('')
const semReceita = ref(false)
const motivoSemReceita = ref('')
const observacao = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  descricao.value = ''
  via.value = 'ORAL'
  dose.value = ''
  horarios.value = ''
  receita.value = ''
  semReceita.value = false
  motivoSemReceita.value = ''
  observacao.value = ''
  tentou.value = false
  erro.value = ''
})

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const lista = computed(() => {
  const l = [
    ...new Set(
      horarios.value
        .split(/[\s,;]+/)
        .map((h) => h.trim())
        .filter(Boolean),
    ),
  ]
  return l.length && l.length <= HORARIOS_MAX && l.every((h) => HORA.test(h)) ? l : null
})
const remedio = computed(() => props.tipo === 'MEDICACAO')
const valido = computed(
  () =>
    descricao.value.trim().length > 0 &&
    Boolean(lista.value) &&
    (!remedio.value ||
      (dose.value.trim().length > 0 &&
        (semReceita.value
          ? motivoSemReceita.value.trim().length >= MOTIVO_SEM_RECEITA_MIN
          : receita.value.trim().length > 0))),
)
const opcoesDeVia = computed(() =>
  VIAS.map((valor) => ({ valor, rotulo: t(`estadiaDoHotel.via.${valor}`) })),
)

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  salvando.value = true
  try {
    if (remedio.value)
      await registrarMedicacao(
        props.hospedagemId,
        {
          descricao: descricao.value.trim(),
          via: via.value,
          doseTexto: dose.value.trim(),
          horarios: lista.value!,
          ...(semReceita.value
            ? { semReceita: true, motivoSemReceita: motivoSemReceita.value.trim() }
            : { receita: receita.value.trim() }),
          ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
        },
        parceiroQuery(),
      )
    else
      await registrarCuidado(
        props.hospedagemId,
        {
          descricao: descricao.value.trim(),
          horarios: lista.value!,
          ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
        },
        parceiroQuery(),
      )
    aberta.value = false
    emit('salvo')
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
    :titulo="
      remedio
        ? t('estadiaDoHotel.checkin.acrescentarRemedio')
        : t('estadiaDoHotel.checkin.acrescentarCuidado')
    "
    :icone="remedio ? 'ph ph-pill' : 'ph ph-first-aid-kit'"
  >
    <form id="item-da-estadia" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="it-desc">{{
          remedio ? t('estadiaDoHotel.checkin.remedio') : t('estadiaDoHotel.checkin.cuidado')
        }}</label>
        <InputText
          id="it-desc"
          v-model="descricao"
          :invalid="tentou && !descricao.trim()"
          :disabled="salvando"
        />
      </section>
      <div v-if="remedio" class="eg__linha">
        <div class="eg__secao">
          <label class="eg__rotulo" for="it-via">{{ t('estadiaDoHotel.checkin.via') }}</label>
          <Select
            v-model="via"
            input-id="it-via"
            :options="opcoesDeVia"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </div>
        <div class="eg__secao">
          <label class="eg__rotulo" for="it-dose">{{ t('estadiaDoHotel.checkin.dose') }}</label>
          <InputText
            id="it-dose"
            v-model="dose"
            :invalid="tentou && !dose.trim()"
            :disabled="salvando"
          />
        </div>
      </div>
      <section class="eg__secao">
        <label class="eg__rotulo" for="it-horarios">{{
          t('estadiaDoHotel.checkin.horarios')
        }}</label>
        <InputText
          id="it-horarios"
          v-model="horarios"
          :invalid="tentou && !lista"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('estadiaDoHotel.checkin.horariosDica') }}</small>
      </section>
      <template v-if="remedio">
        <label class="it__chave">
          <Checkbox v-model="semReceita" binary :disabled="salvando" />
          <span>{{ t('estadiaDoHotel.checkin.semReceita') }}</span>
        </label>
        <section class="eg__secao">
          <label class="eg__rotulo" for="it-rec">{{
            semReceita
              ? t('estadiaDoHotel.checkin.motivoSemReceita')
              : t('estadiaDoHotel.checkin.receita')
          }}</label>
          <InputText
            v-if="!semReceita"
            id="it-rec"
            v-model="receita"
            :invalid="tentou && !receita.trim()"
            :disabled="salvando"
          />
          <Textarea
            v-else
            id="it-rec"
            v-model="motivoSemReceita"
            rows="2"
            auto-resize
            :maxlength="MOTIVO_SEM_RECEITA_MAX"
            :invalid="tentou && motivoSemReceita.trim().length < MOTIVO_SEM_RECEITA_MIN"
            :disabled="salvando"
          />
        </section>
      </template>
      <section class="eg__secao">
        <label class="eg__rotulo" for="it-obs"
          >{{ t('estadiaDoHotel.checkin.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span></label
        >
        <Textarea
          id="it-obs"
          v-model="observacao"
          rows="2"
          auto-resize
          :maxlength="TEXTO_MAX"
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
        form="item-da-estadia"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.it__chave {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}
</style>
