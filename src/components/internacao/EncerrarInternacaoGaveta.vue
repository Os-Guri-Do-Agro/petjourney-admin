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
 *
 * Ao abrir, a prévia (N36, `GET .../encerramento`): o que fica para trás (doses, boletins) e os
 * avisos, os mesmos que o encerrar devolveria agora, sem gravar nada. Aviso nunca trava: o botão
 * continua disponível. Já encerrada (409 `INTERNACAO_ENCERRADA`, outra pessoa encerrou com a gaveta
 * aberta): a gaveta diz isso, o botão sai e a tela relê a internação.
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
import { ApiError } from '@/service/api'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  DESFECHOS,
  encerrarInternacao,
  instanteComOffset,
  ORIENTACAO_MAX,
  ORIENTACAO_MIN,
  previaDoEncerramento,
  type AvisoDoEncerramento,
  type Desfecho,
  type Internacao,
  type PreviaDoEncerramento,
} from '@/service/parceiro/internacao-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

const props = defineProps<{ internacao: Internacao | null; profissionais: Profissional[] }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ encerrada: [internacao: Internacao]; desatualizada: [] }>()

const { t, locale } = useI18n()
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
  void lerPrevia()
})

/* ------------------------------------------------------------------------------ a prévia */

const previa = ref<PreviaDoEncerramento | null>(null)
const lendoPrevia = ref(false)
const erroDaPrevia = ref(false)
const jaEncerrada = ref(false)
let leituraDaPrevia = 0

async function lerPrevia() {
  const atual = props.internacao
  previa.value = null
  erroDaPrevia.value = false
  jaEncerrada.value = false
  if (!atual) return
  const vez = ++leituraDaPrevia
  lendoPrevia.value = true
  try {
    const lida = await previaDoEncerramento(atual.id, parceiroQuery())
    if (vez === leituraDaPrevia) previa.value = lida
  } catch (err) {
    if (vez !== leituraDaPrevia) return
    if (err instanceof ApiError && err.codigo === 'INTERNACAO_ENCERRADA') {
      jaEncerrada.value = true
      emit('desatualizada')
    } else {
      erroDaPrevia.value = true
    }
  } finally {
    if (vez === leituraDaPrevia) lendoPrevia.value = false
  }
}

/** O que ficou para trás, numa linha: horas, doses dadas e não dadas, boletins enviados. */
const linhaDaPrevia = computed(() => {
  const r = previa.value?.resumo
  if (!r) return ''
  return [
    t('internacao.encerrar.previa.horas', { n: r.horas }),
    t('internacao.encerrar.previa.feitas', { n: r.feitas }, r.feitas),
    r.naoFeitas ? t('internacao.encerrar.previa.naoFeitas', { n: r.naoFeitas }, r.naoFeitas) : '',
    r.boletinsEnviados
      ? t('internacao.encerrar.previa.enviados', { n: r.boletinsEnviados }, r.boletinsEnviados)
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

const QUANTOS: Record<AvisoDoEncerramento, keyof PreviaDoEncerramento['resumo']> = {
  DOSE_PENDENTE: 'pendentesAgora',
  DOSE_FUTURA: 'aSuspender',
  BOLETIM_RETIDO: 'boletinsRetidos',
}

const avisosDaPrevia = computed(() =>
  (previa.value?.avisos ?? []).map((aviso) => {
    const n = previa.value?.resumo[QUANTOS[aviso]] ?? 0
    return { aviso, texto: t(`internacao.encerrar.previa.aviso.${aviso}`, { n }, n) }
  }),
)

const calculadoAs = computed(() =>
  previa.value
    ? new Date(previa.value.calculadoEm).toLocaleTimeString(locale.value, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '',
)

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
    <p v-if="jaEncerrada" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ t('internacao.encerrar.previa.jaEncerrada') }}</span>
    </p>

    <form v-else id="encerrar-form" class="eg" novalidate @submit.prevent="encerrar">
      <!-- A prévia: o que fica para trás, antes de escolher e confirmar. Nada se grava aqui. -->
      <section
        class="eg__secao ui-poco enc__previa"
        aria-labelledby="enc-previa"
        :aria-busy="lendoPrevia"
      >
        <span id="enc-previa" class="eg__rotulo">{{ t('internacao.encerrar.previa.titulo') }}</span>
        <p v-if="lendoPrevia" class="eg__dica">{{ t('internacao.encerrar.previa.lendo') }}</p>
        <p v-else-if="erroDaPrevia" class="eg__dica">{{ t('internacao.encerrar.previa.erro') }}</p>
        <template v-else-if="previa">
          <p class="eg__dica enc__linha">{{ linhaDaPrevia }}</p>
          <p v-for="item in avisosDaPrevia" :key="item.aviso" class="eg__aviso">
            <i class="ph ph-warning" aria-hidden="true" />
            <span>{{ item.texto }}</span>
          </p>
          <p v-if="!avisosDaPrevia.length" class="eg__aviso enc__em-dia">
            <i class="ph ph-check-circle" aria-hidden="true" />
            <span>{{ t('internacao.encerrar.previa.emDia') }}</span>
          </p>
          <small class="eg__dica">{{
            t('internacao.encerrar.previa.calculadoEm', { hora: calculadoAs })
          }}</small>
        </template>
      </section>

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
        v-if="!jaEncerrada"
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

<style scoped>
/* A prévia num poço: o que fica para trás se lê antes do formulário, sem competir com ele. */
.enc__previa {
  padding: 14px 16px;
}

.enc__linha {
  color: var(--tinta);
}

.enc__em-dia i {
  color: var(--ok-tinta);
}
</style>
