<script setup lang="ts">
/**
 * Pôr alguém na lista de espera (E7-02b, guia e7 32): o animal, o período desejado e, se quiser,
 * os tipos de acomodação que servem. A oferta depois não segura a baia: o primeiro que reservar leva.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { TipoDaCasa } from '@/service/parceiro/hotel-casa-service'
import { criarEspera } from '@/service/parceiro/hotel-reservas-service'
import { listarPacientes, type PacienteNaLista } from '@/service/parceiro/pacientes-service'

const props = defineProps<{ tipos: TipoDaCasa[] }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ criada: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const paciente = ref<PacienteNaLista | string | null>(null)
const sugestoes = ref<PacienteNaLista[]>([])
const periodo = ref<Date[] | null>(null)
const escolhidos = ref<string[]>([])
const observacao = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  paciente.value = null
  periodo.value = null
  escolhidos.value = []
  observacao.value = ''
  tentou.value = false
  erro.value = ''
})

async function buscar(evento: { query: string }) {
  try {
    const pagina = await listarPacientes({ q: evento.query, limit: 10 }, parceiroQuery())
    sugestoes.value = pagina.itens.filter((item) => item.ativo)
  } catch {
    sugestoes.value = []
  }
}

const rotuloDoPaciente = (item: PacienteNaLista) => `${item.nome} · ${item.cliente.nome}`
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hoje = new Date()

const opcoesDeTipo = computed(() => props.tipos.map((tp) => ({ valor: tp.id, rotulo: tp.nome })))
const pacienteValido = computed(() => Boolean(paciente.value && typeof paciente.value === 'object'))
const periodoValido = computed(() => Boolean(periodo.value?.[0] && periodo.value?.[1]))

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!pacienteValido.value || !periodoValido.value) return
  salvando.value = true
  try {
    await criarEspera(
      {
        pacienteId: (paciente.value as PacienteNaLista).id,
        entradaDesejada: iso(periodo.value![0]!),
        saidaDesejada: iso(periodo.value![1]!),
        ...(escolhidos.value.length ? { tiposAceitos: escolhidos.value } : {}),
        ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('criada')
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
    :titulo="t('reservasDoHotel.espera.nova')"
    icone="ph ph-hourglass"
    largura="34rem"
  >
    <form id="espera-do-hotel" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="es-paciente">{{ t('reservasDoHotel.nova.hospede') }}</label>
        <AutoComplete
          v-model="paciente"
          input-id="es-paciente"
          :suggestions="sugestoes"
          :option-label="rotuloDoPaciente"
          :placeholder="t('fila.buscarPaciente')"
          :invalid="tentou && !pacienteValido"
          :disabled="salvando"
          force-selection
          @complete="buscar"
        />
      </section>
      <section class="eg__secao">
        <span id="es-periodo" class="eg__rotulo">{{ t('reservasDoHotel.espera.periodo') }}</span>
        <DatePicker
          v-model="periodo"
          selection-mode="range"
          inline
          :min-date="hoje"
          aria-labelledby="es-periodo"
          :invalid="tentou && !periodoValido"
          :disabled="salvando"
        />
      </section>
      <section v-if="opcoesDeTipo.length" class="eg__secao">
        <span id="es-tipos" class="eg__rotulo">
          {{ t('reservasDoHotel.espera.tipos') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </span>
        <SelectButton
          v-model="escolhidos"
          :options="opcoesDeTipo"
          option-label="rotulo"
          option-value="valor"
          multiple
          aria-labelledby="es-tipos"
          :disabled="salvando"
          class="es__tipos"
        />
        <small class="eg__dica">{{ t('reservasDoHotel.espera.tiposDica') }}</small>
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="es-obs">
          {{ t('reservasDoHotel.nova.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea id="es-obs" v-model="observacao" rows="2" auto-resize :disabled="salvando" />
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
        form="espera-do-hotel"
        icon="ph ph-check"
        :label="t('reservasDoHotel.espera.criar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.es__tipos {
  flex-wrap: wrap;
}
</style>
