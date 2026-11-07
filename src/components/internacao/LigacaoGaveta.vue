<script setup lang="ts">
/**
 * Registrar a ligação ao responsável (E5-03, guia e5 17.1 e 19.2). A ligação é autodeclaração:
 * quem ligou (um profissional ativo, pode não ser quem registra) e quando (sem hora, "liguei
 * agora"). Ela libera o boletim retido; o paciente sem app não tem boletim e a ligação vai na
 * internação. A tela não liga: a clínica liga pelo telefone do cadastro, aqui só se registra.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  registrarLigacaoDaInternacao,
  registrarLigacaoDoBoletim,
} from '@/service/parceiro/boletins-da-internacao-service'
import { instanteComOffset } from '@/service/parceiro/internacao-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

export type AlvoDaLigacao = {
  /** O boletim retido; sem ele, a ligação vai na internação (paciente sem app). */
  boletimId: string | null
  internacaoId: string
  paciente: string
  /** A ligação precisa ser depois disto (a piora ou a entrada crítica). */
  desde: string | null
  /** Para quem ligar, do cadastro (texto, sem botão de ligar). */
  telefones: string[]
}

const props = defineProps<{ alvo: AlvoDaLigacao | null; profissionais: Profissional[] }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ registrada: [] }>()

const { t } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()

const AGORA = 'AGORA'
const MAIS_CEDO = 'MAIS_CEDO'

const quemLigou = ref<string | null>(null)
const quando = ref<typeof AGORA | typeof MAIS_CEDO>(AGORA)
const em = ref<Date | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const recado = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  quemLigou.value = store.eu?.profissional?.ativo ? store.eu.profissional.id : null
  quando.value = AGORA
  em.value = null
  tentou.value = false
  erro.value = ''
  recado.value = ''
})

const opcoesDePessoas = computed(() =>
  props.profissionais
    .filter((item) => item.ativo)
    .map((item) => ({ valor: item.id, rotulo: item.nome })),
)
const opcoesDeQuando = computed(() => [
  { valor: AGORA, rotulo: t('internacao.boletim.ligueiAgora') },
  { valor: MAIS_CEDO, rotulo: t('internacao.internar.maisCedo') },
])

const minimo = computed(() => (props.alvo?.desde ? new Date(props.alvo.desde) : undefined))
const agora = () => new Date()

async function registrar() {
  tentou.value = true
  erro.value = ''
  const alvo = props.alvo
  if (!alvo || !quemLigou.value || (quando.value === MAIS_CEDO && !em.value)) return
  const corpo = {
    porProfissionalId: quemLigou.value,
    ...(quando.value === MAIS_CEDO && em.value ? { em: instanteComOffset(em.value) } : {}),
  }
  salvando.value = true
  try {
    if (alvo.boletimId) {
      await registrarLigacaoDoBoletim(alvo.boletimId, corpo, parceiroQuery())
    } else {
      const feita = await registrarLigacaoDaInternacao(alvo.internacaoId, corpo, parceiroQuery())
      if (!feita.registrada) {
        recado.value = t('internacao.boletim.nadaDevido')
        return
      }
    }
    aberta.value = false
    emit('registrada')
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.boletim.erroLigacao')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('internacao.boletim.registrarLigacao')"
    icone="ph ph-phone"
  >
    <form id="ligacao-form" class="eg" novalidate @submit.prevent="registrar">
      <p v-if="alvo" class="eg__dica">
        {{ t('internacao.boletim.ligacaoDica', { pet: alvo.paciente }) }}
      </p>
      <p v-if="alvo?.telefones.length" class="lg__telefones">
        <i class="ph ph-phone" aria-hidden="true" />
        <span>{{ alvo.telefones.join(' · ') }}</span>
      </p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="lg-quem">{{ t('internacao.encerrar.quemLigou') }}</label>
        <Select
          v-model="quemLigou"
          input-id="lg-quem"
          :options="opcoesDePessoas"
          option-label="rotulo"
          option-value="valor"
          :invalid="tentou && !quemLigou"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <span id="lg-quando" class="eg__rotulo">{{ t('internacao.encerrar.quandoLigou') }}</span>
        <SelectButton
          v-model="quando"
          :options="opcoesDeQuando"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="lg-quando"
          :disabled="salvando"
        />
        <DatePicker
          v-if="quando === MAIS_CEDO"
          v-model="em"
          inline
          show-time
          hour-format="24"
          :step-minute="5"
          :min-date="minimo"
          :max-date="agora()"
          aria-labelledby="lg-quando"
          :invalid="tentou && !em"
          :disabled="salvando"
        />
      </section>

      <p v-if="recado" class="eg__aviso" role="status">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ recado }}</span>
      </p>
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
        form="ligacao-form"
        icon="ph ph-check"
        :label="t('internacao.boletim.registrarLigacao')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.lg__telefones {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}
</style>
