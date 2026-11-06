<script setup lang="ts">
/**
 * Registrar uma dose de outro lugar (E4-04, guia e4 3.3): sem lote (a clínica não aplicou), pela
 * data do papel, com o local e a procedência. Conta para o protocolo e para a lista de chamada,
 * mas não vai ao app como vacina da clínica. Quem transcreve responde pelo registro.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import type { Vacina } from '@/service/parceiro/catalogos-service'
import { registrarExterna, type DoseExterna } from '@/service/parceiro/vacinacao-service'

const props = defineProps<{
  pacienteId: string
  vacinas: Vacina[]
  profissionais: { id: string; nome: string }[]
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ registrada: [] }>()

const { t } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const vacinaId = ref<string | null>(null)
const dia = ref<Date | null>(null)
const local = ref('')
const aplicador = ref('')
const procedencia = ref<DoseExterna['procedencia']>('COMPROVANTE')
const via = ref<string | null>(null)
const profissionalId = ref<string | null>(null)
const observacao = ref('')
const salvando = ref(false)
const tentou = ref(false)
const erro = ref('')

const hoje = new Date()

watch(aberta, (agora) => {
  if (!agora) return
  vacinaId.value = null
  dia.value = null
  local.value = ''
  aplicador.value = ''
  procedencia.value = 'COMPROVANTE'
  via.value = null
  profissionalId.value = store.eu?.profissional?.id ?? props.profissionais[0]?.id ?? null
  observacao.value = ''
  tentou.value = false
  erro.value = ''
})

const vacina = computed(() => props.vacinas.find((v) => v.id === vacinaId.value) ?? null)

const opcoesDeVacina = computed(() =>
  props.vacinas.map((v) => ({
    valor: v.id,
    rotulo: v.fabricante ? `${v.nome} · ${v.fabricante}` : v.nome,
  })),
)
const opcoesDeVia = computed(() => [
  { valor: null, rotulo: t('vacinas.externa.semVia') },
  ...(vacina.value?.vias ?? []).map((valor) => ({
    valor,
    rotulo: t(`clinico.bulario.api.via.${valor}`),
  })),
])
const opcoesDeProcedencia = computed(() => [
  { valor: 'COMPROVANTE', rotulo: t('vacinas.externa.procedencia.COMPROVANTE') },
  { valor: 'RELATO', rotulo: t('vacinas.externa.procedencia.RELATO') },
])
const opcoesDeProfissional = computed(() =>
  props.profissionais.map((p) => ({ valor: p.id, rotulo: p.nome })),
)

const valido = computed(
  () =>
    Boolean(vacinaId.value) &&
    Boolean(dia.value) &&
    local.value.trim().length >= 2 &&
    Boolean(profissionalId.value),
)

function iso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

async function registrar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  salvando.value = true
  const dados: DoseExterna = {
    vacinaId: vacinaId.value!,
    aplicadaEm: iso(dia.value!),
    local: local.value.trim(),
    procedencia: procedencia.value,
    profissionalId: profissionalId.value!,
    ...(aplicador.value.trim() ? { aplicador: aplicador.value.trim() } : {}),
    ...(via.value ? { via: via.value as DoseExterna['via'] } : {}),
    ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
  }
  try {
    await registrarExterna(props.pacienteId, dados, chaveador.para(dados), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('registrada')
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
    :titulo="t('vacinas.externa.titulo')"
    icone="ph ph-file-text"
    largura="34rem"
  >
    <form id="dose-externa" class="eg" novalidate @submit.prevent="registrar">
      <p class="eg__dica">{{ t('vacinas.externa.dica') }}</p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="ext-vacina">{{ t('vacinas.aplicar.vacina') }}</label>
        <Select
          v-model="vacinaId"
          input-id="ext-vacina"
          :options="opcoesDeVacina"
          option-label="rotulo"
          option-value="valor"
          filter
          :placeholder="t('vacinas.aplicar.escolher')"
          :invalid="tentou && !vacinaId"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="ext-dia" class="eg__rotulo">{{ t('vacinas.externa.dia') }}</span>
        <DatePicker
          v-model="dia"
          inline
          :max-date="hoje"
          aria-labelledby="ext-dia"
          :invalid="tentou && !dia"
          :disabled="salvando"
        />
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="ext-local">{{ t('vacinas.externa.local') }}</label>
          <InputText
            id="ext-local"
            v-model="local"
            maxlength="120"
            :invalid="tentou && local.trim().length < 2"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="ext-aplicador">
            {{ t('vacinas.externa.aplicador') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <InputText id="ext-aplicador" v-model="aplicador" maxlength="120" :disabled="salvando" />
        </section>
      </div>

      <section class="eg__secao">
        <span id="ext-procedencia" class="eg__rotulo">{{
          t('vacinas.externa.procedenciaRotulo')
        }}</span>
        <SelectButton
          v-model="procedencia"
          :options="opcoesDeProcedencia"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="ext-procedencia"
          :disabled="salvando"
        />
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="ext-via">{{ t('vacinas.aplicar.via') }}</label>
          <Select
            v-model="via"
            input-id="ext-via"
            :options="opcoesDeVia"
            option-label="rotulo"
            option-value="valor"
            :placeholder="t('vacinas.externa.semVia')"
            :disabled="salvando || !vacina"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="ext-quem">{{ t('vacinas.externa.quemTranscreve') }}</label>
          <Select
            v-model="profissionalId"
            input-id="ext-quem"
            :options="opcoesDeProfissional"
            option-label="rotulo"
            option-value="valor"
            :invalid="tentou && !profissionalId"
            :disabled="salvando"
          />
        </section>
      </div>

      <section class="eg__secao">
        <label class="eg__rotulo" for="ext-obs">
          {{ t('vacinas.aplicar.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea id="ext-obs" v-model="observacao" rows="2" auto-resize :disabled="salvando" />
      </section>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
      <p v-else-if="tentou && !valido" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ t('catalogo.erro.faltaCampo') }}</span>
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
        form="dose-externa"
        icon="ph ph-check"
        :label="t('vacinas.externa.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
