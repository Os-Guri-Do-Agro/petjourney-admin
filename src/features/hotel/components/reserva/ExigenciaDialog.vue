<script setup lang="ts">
/**
 * Registrar um comprovante, ou dispensar a exigência.
 *
 * Um diálogo e dois modos, porque as duas ações acontecem no mesmo instante e sobre a mesma linha:
 * o responsável mandou a foto da carteira, ou não mandou e alguém decide assumir. Separá-los em
 * duas telas obrigaria a fechar uma para abrir a outra no meio da conversa com o cliente.
 *
 * **A validade não é digitada.** Quem tem a carteira na mão tem a data da aplicação, não a do
 * vencimento, e fazer a conta de cabeça em "doze meses a partir de 14 de março" é onde o erro
 * entra. O sistema calcula e mostra o resultado antes de salvar.
 *
 * O motivo da dispensa é obrigatório. Não é burocracia: é o que a mantém rara — e é o registro de
 * que alguém decidiu, que é a coisa toda que a dispensa nominal existe para preservar.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useHotelFormat } from '../../composables/useHotelFormat'
import { validadeDe } from '../../domain/admissao'
import type { Cuidador, Exigencia, ExigenciaKind, ISODate } from '../../data/types'

const props = defineProps<{
  /** `null` fecha. O par diz **qual** exigência e em que modo. */
  alvo: { kind: ExigenciaKind; modo: 'registrar' | 'dispensar' } | null
  exigencias: Exigencia[]
  cuidadores: Cuidador[]
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  registrar: [payload: { kind: ExigenciaKind; apresentadoEm: ISODate; documento: string }]
  dispensar: [payload: { kind: ExigenciaKind; motivo: string; autorizadaPor: string }]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

/*
 * Começa vazia: vir com hoje contradizia a dica ("não a de hoje") e quem tinha pressa registrava a
 * vacina de março com a data do balcão.
 */
const apresentadoEm = ref<Date | null>(null)
/** Aplicação no futuro não existe: o calendário para em hoje. */
const hojeLocal = new Date()
const documento = ref('')
const motivo = ref('')
const autorizadaPor = ref('')

const aberto = computed(() => props.alvo !== null)

const exigencia = computed(
  () => props.exigencias.find((item) => item.kind === props.alvo?.kind) ?? null,
)

const dataIso = computed<ISODate | null>(() => {
  const data = apresentadoEm.value

  if (!data) {
    return null
  }

  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`
})

/** O resultado da conta, antes de salvar: é o que evita a carteira registrada com validade errada. */
const validade = computed(() =>
  dataIso.value ? validadeDe(dataIso.value, exigencia.value?.validadeMeses ?? null) : null,
)

const podeSalvar = computed(() =>
  props.alvo?.modo === 'dispensar'
    ? motivo.value.trim().length >= 10 && autorizadaPor.value !== ''
    : dataIso.value !== null && documento.value.trim() !== '',
)

watch(
  () => props.alvo,
  (alvo) => {
    if (!alvo) {
      return
    }

    apresentadoEm.value = null
    documento.value = ''
    motivo.value = ''
    autorizadaPor.value = props.cuidadores[0]?.id ?? ''
  },
)

function confirmar() {
  const alvo = props.alvo

  const data = dataIso.value

  if (!alvo || !podeSalvar.value) {
    return
  }

  if (alvo.modo === 'dispensar') {
    emit('dispensar', {
      kind: alvo.kind,
      motivo: motivo.value,
      autorizadaPor: autorizadaPor.value,
    })

    return
  }

  if (!data) {
    return
  }

  emit('registrar', {
    kind: alvo.kind,
    apresentadoEm: data,
    documento: documento.value,
  })
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="
      alvo?.modo === 'dispensar'
        ? t('hotel.exigencias.dispensarTitulo', { item: formato.exigencia(alvo.kind) })
        : t('hotel.exigencias.registrarTitulo', {
            item: alvo ? formato.exigencia(alvo.kind) : '',
          })
    "
    :style="{ width: 'min(34rem, 94vw)' }"
    class="clinic-scope pj-lugar--hotel"
    @update:visible="emit('fechar')"
  >
    <div v-if="alvo" class="exig">
      <template v-if="alvo.modo === 'registrar'">
        <div class="campo">
          <!--
            A data que conta a validade é a da aplicação (ou da emissão), a que está na carteira.
            Com o rótulo "data da apresentação", a recepção punha o dia de hoje e a vacina de
            março ganhava sete meses a mais de validade.
          -->
          <label :for="`${idCampo}-data`">{{ t('hotel.exigencias.apresentacao') }}</label>
          <DatePicker
            :input-id="`${idCampo}-data`"
            v-model="apresentadoEm"
            date-format="dd/mm/yy"
            :max-date="hojeLocal"
            show-icon
            fluid
            :aria-describedby="`${idCampo}-data-dica`"
          />
          <small :id="`${idCampo}-data-dica`" class="exig__dica">
            {{ t('hotel.exigencias.apresentacaoDica') }}
          </small>
        </div>

        <div class="campo">
          <label :for="`${idCampo}-doc`">{{ t('hotel.exigencias.documento') }}</label>
          <InputText
            :id="`${idCampo}-doc`"
            v-model="documento"
            fluid
            :placeholder="t('hotel.exigencias.documentoDica')"
          />
        </div>

        <!--
          A validade calculada, à vista, antes de salvar. Quem digita a data da aplicação não
          deveria precisar fazer a conta — e quando precisa, erra.
        -->
        <p
          class="exig__validade"
          :class="{ 'exig__validade--pendente': !dataIso }"
          aria-live="polite"
        >
          <i class="ph ph-calendar-check" aria-hidden="true" />
          <template v-if="validade">
            {{ t('hotel.exigencias.validadeCalculada', { data: formato.validade(validade) }) }}
          </template>
          <template v-else-if="!dataIso">{{ t('hotel.exigencias.escolhaAData') }}</template>
          <template v-else>{{ t('hotel.exigencias.semValidade') }}</template>
        </p>
      </template>

      <template v-else>
        <Message severity="warn" :closable="false">
          {{ t('hotel.exigencias.dispensaAviso') }}
        </Message>

        <div class="campo">
          <label :for="`${idCampo}-motivo`">{{ t('hotel.exigencias.motivo') }}</label>
          <Textarea
            :id="`${idCampo}-motivo`"
            v-model="motivo"
            rows="3"
            auto-resize
            fluid
            :placeholder="t('hotel.exigencias.motivoDica')"
          />
        </div>

        <div class="campo">
          <label :for="`${idCampo}-quem`">{{ t('hotel.exigencias.autorizadaPor') }}</label>
          <Select
            :input-id="`${idCampo}-quem`"
            v-model="autorizadaPor"
            :options="cuidadores.map((item) => ({ valor: item.id, rotulo: item.nome }))"
            option-label="rotulo"
            option-value="valor"
            fluid
          />
        </div>
      </template>

      <Message v-if="erro" severity="error" :closable="false">{{ t(erro) }}</Message>
    </div>

    <template #footer>
      <Button
        :label="t('hotel.comum.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="
          alvo?.modo === 'dispensar'
            ? t('hotel.exigencias.confirmarDispensa')
            : t('hotel.exigencias.confirmarRegistro')
        "
        icon="ph ph-check"
        :severity="alvo?.modo === 'dispensar' ? 'warn' : undefined"
        :loading="salvando"
        :disabled="!podeSalvar"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.exig {
  display: grid;
  gap: 16px;
}

.campo {
  display: grid;
  /* Linhas no topo: sem isto, o campo ao lado de um mais alto desce e a fileira sai torta. */
  align-content: start;
  gap: 6px;
}

.campo label {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

/* A validade calculada: o resultado da conta, em destaque, antes de salvar. */
.exig__validade {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 14px;
  font-weight: 600;
}

.exig__validade i {
  font-size: 18px;
}

/* Sem data ainda não há validade a festejar: o verde fica para quando a conta existe. */
.exig__validade--pendente {
  background: var(--superficie-2);
  color: var(--tinta-2);
}

.exig__dica {
  color: var(--tinta-2);
  font-size: 13px;
}
</style>
