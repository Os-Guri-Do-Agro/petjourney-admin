<script setup lang="ts">
/**
 * Registrar um comprovante de exigência (E7-02b, guia e7 30): a data da aplicação ou da emissão
 * (a validade a API calcula), a referência (lote, número) e, se houver, a foto ou o PDF (até
 * 8 MB). Numa exigência que bloqueia, o "visto no balcão" sem arquivo não conta: a API recusa com
 * `COMPROVANTE_EXIGE_DOCUMENTO`, e a gaveta diz para anexar ou pedir a dispensa à gestão. O
 * comprovante é do animal: vale também para as próximas estadias.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import FileUpload from 'primevue/fileupload'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  DOCUMENTO_ACEITO,
  DOCUMENTO_MAX_BYTES,
  registrarComprovante,
  registrarComprovanteComDocumento,
  type ItemDaAdmissao,
} from '@/service/parceiro/hotel-reservas-service'

import { useRotulosDasReservas } from './useRotulosDasReservas'

const props = defineProps<{
  reservaId: string
  pacienteId: string
  animal: string
  item: ItemDaAdmissao | null
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ registrado: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

const apresentadoEm = ref<Date | null>(null)
const referencia = ref('')
const observacao = ref('')
const arquivo = ref<File | null>(null)
const envio = ref<{ clear: () => void } | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  apresentadoEm.value = null
  referencia.value = ''
  observacao.value = ''
  arquivo.value = null
  envio.value?.clear()
  tentou.value = false
  erro.value = ''
})

const hoje = new Date()
const cincoAnos = new Date(hoje.getFullYear() - 5, hoje.getMonth(), hoje.getDate() + 1)
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const exigeDocumento = computed(() => Boolean(props.item?.bloqueia))

function escolher(evento: { files: File[] }) {
  arquivo.value = evento.files[0] ?? null
}

async function registrar() {
  tentou.value = true
  erro.value = ''
  if (!props.item || !apresentadoEm.value) return
  const corpo = {
    kind: props.item.kind,
    apresentadoEm: iso(apresentadoEm.value),
    pacienteId: props.pacienteId,
    ...(referencia.value.trim() ? { referencia: referencia.value.trim() } : {}),
    ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
  }
  salvando.value = true
  try {
    if (arquivo.value)
      await registrarComprovanteComDocumento(props.reservaId, corpo, arquivo.value, parceiroQuery())
    else await registrarComprovante(props.reservaId, corpo, parceiroQuery())
    aberta.value = false
    emit('registrado')
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
      item
        ? t('reservasDoHotel.comprovante.titulo', {
            exigencia: rotulos.exigencia(item.kind),
            animal,
          })
        : ''
    "
    icone="ph ph-file-arrow-up"
  >
    <form id="comprovante-da-reserva" class="eg" novalidate @submit.prevent="registrar">
      <section class="eg__secao">
        <span id="cp-data" class="eg__rotulo">{{ t('reservasDoHotel.comprovante.data') }}</span>
        <DatePicker
          v-model="apresentadoEm"
          inline
          :min-date="cincoAnos"
          :max-date="hoje"
          aria-labelledby="cp-data"
          :invalid="tentou && !apresentadoEm"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('reservasDoHotel.comprovante.dataDica') }}</small>
      </section>
      <section class="eg__secao">
        <span class="eg__rotulo">
          {{ t('reservasDoHotel.comprovante.arquivo') }}
          <span v-if="!exigeDocumento" class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </span>
        <FileUpload
          ref="envio"
          mode="basic"
          :accept="DOCUMENTO_ACEITO"
          :max-file-size="DOCUMENTO_MAX_BYTES"
          :choose-label="arquivo ? arquivo.name : t('reservasDoHotel.comprovante.escolher')"
          choose-icon="ph ph-paperclip"
          custom-upload
          :disabled="salvando"
          @select="escolher"
        />
        <small class="eg__dica">{{
          exigeDocumento
            ? t('reservasDoHotel.comprovante.exige')
            : t('reservasDoHotel.comprovante.arquivoDica')
        }}</small>
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="cp-ref">
          {{ t('reservasDoHotel.comprovante.referencia') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <InputText id="cp-ref" v-model="referencia" :disabled="salvando" />
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="cp-obs">
          {{ t('reservasDoHotel.nova.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea id="cp-obs" v-model="observacao" rows="2" auto-resize :disabled="salvando" />
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
        form="comprovante-da-reserva"
        icon="ph ph-check"
        :label="t('reservasDoHotel.comprovante.registrar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
