<script setup lang="ts">
/**
 * Criar ou editar um alerta do paciente (E2-01, seção 1.7): tipo, severidade e o detalhe (o
 * princípio ativo da alergia, o que o deixa agressivo). Criar leva `Idempotency-Key`, uma por
 * ação. Acima de 50 ativos, 409 `ALERTAS_NO_LIMITE`: a mensagem pede para encerrar os que não
 * valem mais.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { ICONE_DO_ALERTA } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  criarAlerta,
  editarAlerta,
  SEVERIDADES,
  TIPOS_DE_ALERTA,
  type Alerta,
  type SeveridadeDoAlerta,
  type TipoDeAlerta,
} from '@/service/parceiro/pacientes-service'

const props = defineProps<{ pacienteId: string; alerta: Alerta | null }>()
const emit = defineEmits<{ salvo: [alerta: Alerta] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const tipo = ref<TipoDeAlerta | null>(null)
const severidade = ref<SeveridadeDoAlerta>('ATENCAO')
const detalhe = ref('')
const tentou = ref(false)
const erro = ref('')
const salvando = ref(false)

const opcoesDeTipo = computed(() =>
  TIPOS_DE_ALERTA.map((valor) => ({
    valor,
    rotulo: t(`cadastro.alerta.tipo.${valor}`),
    icone: ICONE_DO_ALERTA[valor],
  })),
)

const opcoesDeSeveridade = computed(() =>
  SEVERIDADES.map((valor) => ({ valor, rotulo: t(`cadastro.alerta.severidade.${valor}`) })),
)

watch(visible, (aberta) => {
  if (!aberta) return

  tipo.value = props.alerta?.tipo ?? null
  severidade.value = props.alerta?.severidade ?? 'ATENCAO'
  detalhe.value = props.alerta?.detalhe ?? ''
  tentou.value = false
  erro.value = ''
})

const valido = computed(() => Boolean(tipo.value && detalhe.value.trim()))

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value || !tipo.value) return

  salvando.value = true
  const corpo = { tipo: tipo.value, severidade: severidade.value, detalhe: detalhe.value.trim() }

  try {
    const salvo = props.alerta
      ? await editarAlerta(props.pacienteId, props.alerta.id, corpo, parceiroQuery())
      : await criarAlerta(props.pacienteId, corpo, chaveador.para(corpo), parceiroQuery())

    chaveador.concluir()
    emit('salvo', salvo)
    visible.value = false
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    erro.value = lido.codigo === 'ALERTAS_NO_LIMITE' ? t('cadastro.alerta.noLimite') : lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="alerta ? t('cadastro.alerta.editar') : t('cadastro.alerta.novo')"
    icone="ph ph-warning"
  >
    <form id="alerta-form" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="alerta-tipo">{{ t('cadastro.alerta.tipoRotulo') }}</label>
        <Select
          v-model="tipo"
          input-id="alerta-tipo"
          :options="opcoesDeTipo"
          option-label="rotulo"
          option-value="valor"
          :placeholder="t('cadastro.campos.escolha')"
          :invalid="tentou && !tipo"
          :disabled="salvando"
        >
          <template #option="{ option }">
            <span class="ag__opcao">
              <i :class="option.icone" aria-hidden="true" />
              {{ option.rotulo }}
            </span>
          </template>
        </Select>
        <small v-if="tentou && !tipo" class="eg__invalido">{{
          t('cadastro.alerta.faltaTipo')
        }}</small>
      </section>

      <section class="eg__secao">
        <span id="alerta-severidade" class="eg__rotulo">
          {{ t('cadastro.alerta.severidadeRotulo') }}
        </span>
        <SelectButton
          v-model="severidade"
          :options="opcoesDeSeveridade"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="alerta-severidade"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="alerta-detalhe">{{ t('cadastro.alerta.detalhe') }}</label>
        <Textarea
          id="alerta-detalhe"
          v-model="detalhe"
          rows="3"
          auto-resize
          maxlength="300"
          :placeholder="t('cadastro.alerta.detalheExemplo')"
          :invalid="tentou && !detalhe.trim()"
          :disabled="salvando"
        />
        <small v-if="tentou && !detalhe.trim()" class="eg__invalido">
          {{ t('cadastro.alerta.faltaDetalhe') }}
        </small>
      </section>

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
        form="alerta-form"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ag__opcao {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
