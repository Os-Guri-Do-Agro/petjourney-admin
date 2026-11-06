<script setup lang="ts">
/**
 * Encerrar a internação (E5-01b, guia e5 10): alta, transferência ou óbito, nessa ordem (o
 * esperado primeiro, o grave por último). Exige `internacao.prescrever` com CRMV.
 *
 * - A orientação de saída é obrigatória nos três (10 a 2000). Na alta, com o paciente ligado ao
 *   app, ela vai inteira ao responsável: a gaveta diz isso perto do campo.
 * - Óbito e transferência pedem a ligação feita (quem ligou e quando): sem ela, nada se grava.
 * - O óbito vai ao cadastro na mesma operação (paciente inativo, vínculo com o app encerrado e a
 *   agenda cancelada, sem aviso): a gaveta avisa antes de confirmar.
 * - "Quando" é agora ou mais cedo (entre a entrada e agora): o óbito das 23h50 registrado à
 *   meia-noite grava o dia certo.
 *
 * O duplo toque leva a mesma Idempotency-Key e devolve a internação encerrada.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { motivoDaRecusa, useSeloDeAssinatura } from '@/composables/useSeloDeAssinatura'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  DESFECHOS,
  encerrarInternacao,
  instanteComOffset,
  ORIENTACAO_MAX,
  ORIENTACAO_MIN,
  type Desfecho,
  type Internacao,
} from '@/service/parceiro/internacao-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

const props = defineProps<{ internacao: Internacao | null; profissionais: Profissional[] }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ encerrada: [internacao: Internacao] }>()

const { t } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()
const selo = useSeloDeAssinatura()

const avisoDoSelo = computed(() =>
  selo.atoAguarda('ENCERRAR_INTERNACAO')
    ? t(`internacao.selo.${selo.motivo.value ?? 'SEM_SELO'}`)
    : '',
)

const AGORA = 'AGORA'
const MAIS_CEDO = 'MAIS_CEDO'
type Quando = typeof AGORA | typeof MAIS_CEDO

const desfecho = ref<Desfecho>('ALTA')
const orientacao = ref('')
const quando = ref<Quando>(AGORA)
const ocorreuEm = ref<Date | null>(null)
const quemLigou = ref<string | null>(null)
const ligouQuando = ref<Quando>(AGORA)
const ligouEm = ref<Date | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  desfecho.value = 'ALTA'
  orientacao.value = ''
  quando.value = AGORA
  ocorreuEm.value = null
  quemLigou.value = store.eu?.profissional?.ativo ? store.eu.profissional.id : null
  ligouQuando.value = AGORA
  ligouEm.value = null
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

const opcoesDeDesfecho = computed(() =>
  DESFECHOS.map((valor) => ({ valor, rotulo: t(`internacao.desfecho.${valor}`) })),
)
const opcoesDeQuando = computed(() => [
  { valor: AGORA, rotulo: t('internacao.internar.agora') },
  { valor: MAIS_CEDO, rotulo: t('internacao.internar.maisCedo') },
])
const opcoesDeQuemLigou = computed(() =>
  props.profissionais
    .filter((item) => item.ativo)
    .map((item) => ({ valor: item.id, rotulo: item.nome })),
)

const pedeLigacao = computed(() => desfecho.value !== 'ALTA')
const entrada = computed(() =>
  props.internacao ? new Date(props.internacao.entradaEm) : new Date(),
)
const agora = () => new Date()

const orientacaoValida = computed(() => {
  const tamanho = orientacao.value.trim().length
  return tamanho >= ORIENTACAO_MIN && tamanho <= ORIENTACAO_MAX
})
const quandoValido = computed(() => quando.value === AGORA || Boolean(ocorreuEm.value))
const ligacaoValida = computed(
  () =>
    !pedeLigacao.value ||
    (Boolean(quemLigou.value) && (ligouQuando.value === AGORA || Boolean(ligouEm.value))),
)

async function encerrar() {
  tentou.value = true
  erro.value = ''
  const atual = props.internacao
  if (!atual || !orientacaoValida.value || !quandoValido.value || !ligacaoValida.value) return

  const agoraMesmo = instanteComOffset(new Date())
  const corpo = {
    desfecho: desfecho.value,
    orientacao: orientacao.value.trim(),
    ...(quando.value === MAIS_CEDO && ocorreuEm.value
      ? { ocorreuEm: instanteComOffset(ocorreuEm.value) }
      : {}),
    ...(pedeLigacao.value && quemLigou.value
      ? {
          avisadoPorTelefone: {
            porProfissionalId: quemLigou.value,
            em:
              ligouQuando.value === MAIS_CEDO && ligouEm.value
                ? instanteComOffset(ligouEm.value)
                : agoraMesmo,
          },
        }
      : {}),
  }
  salvando.value = true
  try {
    /* O "agora" vai em minutos: o duplo toque do mesmo minuto leva a mesma chave. */
    const encerrada = await encerrarInternacao(
      atual.id,
      corpo,
      chaveador.para(corpo),
      parceiroQuery(),
    )
    chaveador.concluir()
    aberta.value = false
    emit('encerrada', encerrada)
  } catch (err) {
    const recusa = motivoDaRecusa(err)
    erro.value = recusa
      ? t(`internacao.selo.${recusa}`)
      : lerErroDoCadastro(err, t('internacao.encerrar.erro')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('internacao.encerrar.titulo')"
    icone="ph ph-sign-out"
    largura="36rem"
  >
    <form id="encerrar-form" class="eg" novalidate @submit.prevent="encerrar">
      <section class="eg__secao">
        <span id="enc-desfecho" class="eg__rotulo">{{ t('internacao.encerrar.desfecho') }}</span>
        <SelectButton
          v-model="desfecho"
          :options="opcoesDeDesfecho"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="enc-desfecho"
          :disabled="salvando"
        />
      </section>

      <p v-if="desfecho === 'OBITO'" class="eg__aviso">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>{{ t('internacao.encerrar.obitoDica') }}</span>
      </p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="enc-orientacao">{{
          t('internacao.encerrar.orientacao')
        }}</label>
        <Textarea
          id="enc-orientacao"
          v-model="orientacao"
          rows="4"
          auto-resize
          :maxlength="ORIENTACAO_MAX"
          :invalid="tentou && !orientacaoValida"
          :disabled="salvando"
        />
        <small class="eg__dica">{{
          desfecho === 'ALTA'
            ? t('internacao.encerrar.orientacaoAlta', { min: ORIENTACAO_MIN })
            : t('internacao.encerrar.orientacaoClinica', { min: ORIENTACAO_MIN })
        }}</small>
      </section>

      <section class="eg__secao">
        <span id="enc-quando" class="eg__rotulo">{{
          t(`internacao.encerrar.quando.${desfecho}`)
        }}</span>
        <SelectButton
          v-model="quando"
          :options="opcoesDeQuando"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="enc-quando"
          :disabled="salvando"
        />
        <DatePicker
          v-if="quando === MAIS_CEDO"
          v-model="ocorreuEm"
          inline
          show-time
          hour-format="24"
          :step-minute="5"
          :min-date="entrada"
          :max-date="agora()"
          aria-labelledby="enc-quando"
          :invalid="tentou && !quandoValido"
          :disabled="salvando"
        />
      </section>

      <template v-if="pedeLigacao">
        <p class="eg__dica">{{ t('internacao.encerrar.ligacaoDica') }}</p>
        <section class="eg__secao">
          <label class="eg__rotulo" for="enc-quem">{{ t('internacao.encerrar.quemLigou') }}</label>
          <Select
            v-model="quemLigou"
            input-id="enc-quem"
            :options="opcoesDeQuemLigou"
            option-label="rotulo"
            option-value="valor"
            :invalid="tentou && !quemLigou"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <span id="enc-ligou" class="eg__rotulo">{{ t('internacao.encerrar.quandoLigou') }}</span>
          <SelectButton
            v-model="ligouQuando"
            :options="opcoesDeQuando"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="enc-ligou"
            :disabled="salvando"
          />
          <DatePicker
            v-if="ligouQuando === MAIS_CEDO"
            v-model="ligouEm"
            inline
            show-time
            hour-format="24"
            :step-minute="5"
            :min-date="entrada"
            :max-date="agora()"
            aria-labelledby="enc-ligou"
            :invalid="tentou && !ligacaoValida"
            :disabled="salvando"
          />
        </section>
      </template>

      <p v-if="avisoDoSelo && !erro" class="eg__aviso">
        <i class="ph ph-seal-warning" aria-hidden="true" />
        <span>{{ avisoDoSelo }}</span>
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
        form="encerrar-form"
        :severity="desfecho === 'OBITO' ? 'danger' : undefined"
        icon="ph ph-sign-out"
        :label="t(`internacao.encerrar.confirmar.${desfecho}`)"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
