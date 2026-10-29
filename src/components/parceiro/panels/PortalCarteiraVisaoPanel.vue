<script setup lang="ts">
/**
 * O saldo da carteira: o disponível para saque em número grande, com a ação ao lado; embaixo, o
 * que está liberando, o que já foi sacado e a chave PIX. E os dois diálogos (saque e chave).
 *
 * A ação acompanha a situação: liberado, "Solicitar saque" é a primária; faltando a chave,
 * "Cadastrar chave PIX" é que é. Quem não é dono não vê nenhuma das duas — o saque e a chave são
 * do dono da conta. A página monta a frase do topo com o que este painel conta pelo evento
 * `estado`; `abrirSaque` e `abrirPix` continuam expostos para quem precisar abrir de fora.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Skeleton from 'primevue/skeleton'
import type { ToastMessageOptions } from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeedbackSaque } from '@/composables/useFeedbackSaque'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  getCarteira,
  solicitarSaque,
  updateCarteiraPix,
} from '@/service/parceiro/parceiro-portal-service'
import {
  capacidadeDeSaque,
  MIN_SAQUE_CENTAVOS,
  type CapacidadeDeSaque,
} from '@/service/parceiro/regras-de-saque'
import type { Carteira } from '@/service/parceiro/types'
import {
  formatCentavosToBrl,
  maskBrlCurrencyInput,
  parseBrlToCentavos,
} from '@/utils/format/money'
import { isValidChavePix } from '@/utils/validation/pix'

export type EstadoDaCarteira = {
  carregando: boolean
  saldoSacavelCentavos: number
  saldoTotalCentavos: number
  capacidade: CapacidadeDeSaque | null
  ehDono: boolean
}

const emit = defineEmits<{
  needsProgramas: []
  estado: [estado: EstadoDaCarteira]
}>()

const { t, locale } = useI18n()
const toast = useToast()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()
const feedbackSaque = useFeedbackSaque()

/**
 * O questionário pós-saque só entra depois que o diálogo do saque termina de sair. Dois `Dialog`
 * modais ao mesmo tempo brigam: o que sai solta a trava de rolagem do `body` e devolve o foco à
 * página por baixo do que entra. O `after-hide` do saque resolve esta promessa.
 */
let avisarSaqueFechado: () => void = () => {}
let montado = true

/** Valores em BRL escritos no formato do idioma da tela. */
function formatBrl(centavos: number) {
  return formatCentavosToBrl(centavos, INTL_LOCALE[locale.value as Locale])
}

const carteira = ref<Carteira | null>(null)
const loading = ref(true)
const error = ref('')
const chavePix = ref('')
const valorSaque = ref('')
const savingPix = ref(false)
/**
 * A chave que não é CPF, CNPJ, e-mail, telefone nem aleatória: recusada antes de ir à API, ou pela
 * API (400 `CHAVE_PIX_INVALIDA`), e as duas aparecem no campo.
 */
const erroDaChave = ref('')

watch(chavePix, () => {
  erroDaChave.value = ''
})
const requestingSaque = ref(false)
const saqueAberto = ref(false)
const pixAberto = ref(false)

/** A mesma regra que a visão geral usa para dizer se dá para sacar — ver `regras-de-saque`. */
const minSaqueCentavos = MIN_SAQUE_CENTAVOS
const comissaoIndicacaoEnabled = import.meta.env.VITE_COMISSAO_INDICACAO_ENABLED !== 'false'

const capacidade = computed(() =>
  carteira.value ? capacidadeDeSaque(carteira.value, store.isDono) : null,
)

/**
 * A chave na linha de fatos, com o meio escondido: "089…560" diz qual é a chave para quem a
 * cadastrou, sem expor o CPF ou o telefone inteiro para quem passa atrás do balcão.
 */
const chaveMascarada = computed(() => {
  const chave = carteira.value?.chavePix ?? ''
  const arroba = chave.indexOf('@')

  /* E-mail: o domínio não é segredo e é o que a pessoa reconhece ("fin…@vidaanimal.com.br"). */
  if (arroba > 0) {
    return `${chave.slice(0, Math.min(3, arroba))}…${chave.slice(arroba)}`
  }

  return chave.length > 8 ? `${chave.slice(0, 3)}…${chave.slice(-3)}` : chave
})

const retidoCentavos = computed(() =>
  carteira.value
    ? Math.max(0, carteira.value.saldoTotalCentavos - carteira.value.saldoSacavelCentavos)
    : 0,
)

/** Quanto do saldo total já está livre, em %, para a barra do saldo. */
const parteLivre = computed(() => {
  const total = carteira.value?.saldoTotalCentavos ?? 0

  if (total <= 0) {
    return 0
  }

  return Math.min(100, Math.max(0, (carteira.value!.saldoSacavelCentavos / total) * 100))
})

/**
 * A ação primária do saldo: sacar quando dá; cadastrar a chave quando é só ela que falta. Fora
 * disso, nenhuma — o motivo está na frase do topo da página.
 */
const acaoPrimaria = computed<'sacar' | 'cadastrarPix' | null>(() => {
  if (!store.isDono) {
    return null
  }

  if (capacidade.value === 'liberado') {
    return 'sacar'
  }

  return capacidade.value === 'semChavePix' ? 'cadastrarPix' : null
})

/** Trocar (ou cadastrar) a chave ao lado dela, se não for já a ação primária. */
const mostraBotaoDaChave = computed(() => store.isDono && acaoPrimaria.value !== 'cadastrarPix')

const showComissaoDisabledNotice = computed(
  () =>
    comissaoIndicacaoEnabled === false &&
    carteira.value != null &&
    carteira.value.saldoTotalCentavos === 0,
)

watch(
  () => ({
    carregando: loading.value,
    saldoSacavelCentavos: carteira.value?.saldoSacavelCentavos ?? 0,
    saldoTotalCentavos: carteira.value?.saldoTotalCentavos ?? 0,
    capacidade: capacidade.value,
    ehDono: store.isDono,
  }),
  (estado) => emit('estado', estado),
  { immediate: true },
)

function onValorSaqueInput(value: string) {
  valorSaque.value = maskBrlCurrencyInput(value)
}

async function loadCarteira() {
  loading.value = true
  error.value = ''

  try {
    await ensureContext()

    if (!store.statusAfiliadoAtivo) {
      emit('needsProgramas')
      return
    }

    carteira.value = await getCarteira(parceiroQuery())
    chavePix.value = carteira.value.chavePix ?? ''
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      emit('needsProgramas')
      return
    }

    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    error.value = err instanceof Error ? err.message : t('carteira.visao.errorLoad')
  } finally {
    loading.value = false
  }
}

/** Põe o saldo inteiro no campo: sacar tudo é o caso comum. */
function sacarTudo() {
  valorSaque.value = carteira.value
    ? maskBrlCurrencyInput(String(carteira.value.saldoSacavelCentavos))
    : ''
}

/** O saque abre com o saldo inteiro: sacar tudo é o caso comum, e mudar o valor é um campo. */
function abrirSaque() {
  valorSaque.value = carteira.value
    ? maskBrlCurrencyInput(String(carteira.value.saldoSacavelCentavos))
    : ''
  saqueAberto.value = true
}

function abrirPix() {
  chavePix.value = carteira.value?.chavePix ?? ''
  pixAberto.value = true
}

defineExpose({ abrirSaque, abrirPix })

async function savePix() {
  if (!chavePix.value.trim()) {
    return
  }

  if (!isValidChavePix(chavePix.value)) {
    erroDaChave.value = t('carteira.visao.pix.invalida')
    return
  }

  savingPix.value = true

  try {
    await updateCarteiraPix(chavePix.value.trim(), parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('carteira.toast.pixSaved'),
      detail: t('carteira.toast.pixSavedDetail'),
      life: 3000,
    })
    pixAberto.value = false
    await loadCarteira()
  } catch (err) {
    if (err instanceof ApiError && err.codigo === 'CHAVE_PIX_INVALIDA') {
      erroDaChave.value = err.message
      return
    }

    toast.add({
      severity: 'error',
      summary: t('carteira.toast.pixSaveError'),
      detail: err instanceof Error ? err.message : t('carteira.toast.tryAgain'),
      life: 5000,
    })
  } finally {
    savingPix.value = false
  }
}

async function requestWithdraw() {
  const centavos = parseBrlToCentavos(valorSaque.value)

  if (centavos == null || centavos < minSaqueCentavos) {
    toast.add({
      severity: 'warn',
      summary: t('carteira.toast.invalidValue'),
      detail: t('carteira.toast.minWithdraw'),
      life: 4000,
    })
    return
  }

  if (carteira.value && centavos > carteira.value.saldoSacavelCentavos) {
    toast.add({
      severity: 'warn',
      summary: t('carteira.toast.insufficient'),
      detail: t('carteira.toast.maxWithdraw', {
        valor: formatBrl(carteira.value.saldoSacavelCentavos),
      }),
      life: 4000,
    })
    return
  }

  if (!carteira.value?.chavePix) {
    toast.add({
      severity: 'warn',
      summary: t('carteira.toast.pixRequired'),
      detail: t('carteira.toast.pixRequiredDetail'),
      life: 4000,
    })
    return
  }

  requestingSaque.value = true

  try {
    const query = parceiroQuery()
    const saque = await solicitarSaque(centavos, query)
    const avisoDoSaque: ToastMessageOptions = {
      severity: 'success',
      summary: t('carteira.toast.withdrawRequested'),
      detail: t('carteira.toast.withdrawRequestedDetail'),
      life: 4000,
    }
    toast.add(avisoDoSaque)
    valorSaque.value = ''

    const saqueFechado = new Promise<void>((resolver) => {
      avisarSaqueFechado = resolver
    })
    saqueAberto.value = false

    // Sem await: a carteira recarrega sem esperar o questionário, e nada dele chega aqui.
    void feedbackSaque.oferecer(saque.id, query?.parceiroId ?? null, {
      depoisDe: saqueFechado,
      aindaNaTela: () => montado,
      // O título do questionário já confirma o saque, com o check. O toast vira eco e, por ficar
      // acima da máscara, tapava o X do diálogo em tablet.
      aoAbrir: () => toast.remove(avisoDoSaque),
    })
    await loadCarteira()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('carteira.toast.withdrawError'),
      detail:
        err instanceof Error ? err.message : t('carteira.toast.withdrawErrorDetail'),
      life: 5000,
    })
  } finally {
    requestingSaque.value = false
  }
}

onMounted(() => {
  void loadCarteira()
})

onBeforeUnmount(() => {
  montado = false
})
</script>

<template>
  <div class="carteira-saldo">
    <div
      v-if="loading"
      class="carteira-saldo__grade"
      role="status"
      aria-live="polite"
      aria-busy="true"
      :aria-label="t('carteira.visao.loadingAria')"
    >
      <div class="saldo ui-folha" aria-hidden="true">
        <div class="saldo__topo">
          <div class="saldo__principal">
            <Skeleton width="11rem" height="2.2rem" border-radius="10px" />
            <Skeleton width="15rem" height="3rem" border-radius="12px" />
            <Skeleton width="100%" height="0.7rem" border-radius="999px" />
          </div>
        </div>
      </div>
      <div class="ui-indicadores saldo__indicadores" aria-hidden="true">
        <div v-for="n in 3" :key="n" class="ui-indicador">
          <Skeleton width="8rem" height="1.8rem" border-radius="8px" />
          <Skeleton width="6rem" height="0.8rem" border-radius="6px" />
          <Skeleton width="10rem" height="0.7rem" border-radius="6px" />
        </div>
      </div>
    </div>

    <div v-else-if="error" class="saldo-erro ui-folha" role="alert">
      <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--risco" aria-hidden="true">
        <i class="ph ph-warning-circle" />
      </span>
      <p>{{ error }}</p>
      <Button
        type="button"
        :label="t('carteira.visao.retry')"
        icon="ph ph-arrow-clockwise"
        severity="secondary"
        outlined
        @click="loadCarteira"
      />
    </div>

    <template v-else-if="carteira">
      <section class="carteira-saldo__grade" :aria-label="t('carteira.resumo.aria')">
        <!-- O saldo: o que dá para sacar agora, grande, e a barra do saldo total (livre e liberando). -->
        <div class="saldo ui-folha">
          <div class="saldo__topo">
            <div class="saldo__principal">
              <span class="saldo__rotulo">
                <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
                  <i class="ph ph-wallet" />
                </span>
                {{ t('carteira.tela.disponivel') }}
              </span>
              <strong class="saldo__valor ui-num">
                {{ formatBrl(carteira.saldoSacavelCentavos) }}
              </strong>
            </div>

            <div v-if="acaoPrimaria" class="saldo__acoes">
              <Button
                v-if="acaoPrimaria === 'sacar'"
                type="button"
                class="saldo__acao"
                icon="ph ph-hand-coins"
                :label="t('carteira.visao.saque.submit')"
                @click="abrirSaque"
              />
              <Button
                v-else
                type="button"
                class="saldo__acao"
                icon="ph ph-key"
                :label="t('carteira.saudacao.cadastrarPix')"
                @click="abrirPix"
              />
            </div>
          </div>

          <div v-if="carteira.saldoTotalCentavos > 0" class="saldo__composicao">
            <div
              class="saldo__barra"
              role="img"
              :aria-label="
                t('inicio.saldo.barraAria', {
                  liberado: formatBrl(carteira.saldoSacavelCentavos),
                  total: formatBrl(carteira.saldoTotalCentavos),
                })
              "
            >
              <span
                v-if="parteLivre > 0"
                class="saldo__barra-livre"
                :style="{ width: `${parteLivre}%` }"
              />
              <span
                v-if="parteLivre < 100"
                class="saldo__barra-retida"
                :style="{ width: `${100 - parteLivre}%` }"
              />
            </div>
            <div class="saldo__legenda">
              <span class="saldo__chave saldo__chave--livre">{{ t('carteira.tela.disponivel') }}</span>
              <span v-if="retidoCentavos > 0" class="saldo__chave saldo__chave--retida">
                {{ t('carteira.tela.liberando') }}
              </span>
              <span class="saldo__total">
                {{ t('inicio.saldo.total') }}
                <strong class="ui-num">{{ formatBrl(carteira.saldoTotalCentavos) }}</strong>
              </span>
            </div>
          </div>
        </div>

        <ul class="ui-indicadores saldo__indicadores">
          <li class="ui-indicador ui-indicador--topo saldo__indicador">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-hourglass-medium" /></span>
            <span class="ui-indicador__valor ui-num">{{ formatBrl(retidoCentavos) }}</span>
            <span class="ui-indicador__rotulo">{{ t('carteira.tela.liberando') }}</span>
            <span class="ui-indicador__nota">
              {{ retidoCentavos > 0 ? t('carteira.tela.liberandoNota') : t('carteira.tela.nadaLiberando') }}
            </span>
          </li>

          <li class="ui-indicador ui-indicador--topo saldo__indicador">
            <span class="ui-ladrilho" aria-hidden="true">
              <i class="ph ph-arrow-circle-up-right" />
            </span>
            <span class="ui-indicador__valor ui-num">
              {{ formatBrl(carteira.totalSacadoCentavos) }}
            </span>
            <span class="ui-indicador__rotulo">{{ t('inicio.saldo.sacado') }}</span>
            <span class="ui-indicador__nota">{{ t('carteira.resumo.ciclo') }}</span>
          </li>

          <li class="ui-indicador ui-indicador--topo saldo__indicador saldo__indicador--chave">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-key" /></span>
            <span class="ui-indicador__valor saldo__chave-pix">
              <bdi v-if="carteira.chavePix" dir="ltr" :title="carteira.chavePix">
                {{ chaveMascarada }}
              </bdi>
              <span v-else class="saldo__sem-chave">{{ t('carteira.tela.semPix') }}</span>
            </span>
            <span class="ui-indicador__rotulo saldo__rotulo-chave">
              {{ t('carteira.visao.pix.label') }}
              <!-- Botão visível: sem saldo, é o único caminho para cadastrar a chave. -->
              <Button
                v-if="mostraBotaoDaChave"
                type="button"
                class="fato__trocar"
                severity="secondary"
                size="small"
                :label="carteira.chavePix ? t('carteira.tela.trocarPix') : t('carteira.tela.cadastrarPix')"
                @click="abrirPix"
              />
            </span>
            <span class="ui-indicador__nota">
              {{ t('carteira.resumo.minimo') }}
              <span class="ui-num">{{ formatBrl(minSaqueCentavos) }}</span>
            </span>
          </li>
        </ul>
      </section>

      <p v-if="showComissaoDisabledNotice" class="saldo-aviso" role="status">
        <i class="ph ph-info" aria-hidden="true" />
        {{ t('carteira.visao.alertComissaoDisabled') }}
      </p>
    </template>

    <!-- ------------------------------------------------------------ solicitar saque -->
    <Dialog
      v-model:visible="saqueAberto"
      modal
      dismissable-mask
      :draggable="false"
      class="carteira-dialogo"
      :pt="{ root: { class: 'carteira-dialogo' } }"
      @after-hide="avisarSaqueFechado()"
    >
      <template #container="{ closeCallback }">
        <div class="cd" role="document" aria-labelledby="saque-titulo">
          <Button
            class="cd__fechar"
            type="button"
            icon="ph ph-x"
            severity="secondary"
            text
            :aria-label="t('common.close')"
            :disabled="requestingSaque"
            @click="closeCallback"
          />

          <span class="cd__selo" aria-hidden="true"><i class="ph ph-hand-coins" /></span>
          <h2 id="saque-titulo" class="cd__titulo">{{ t('carteira.visao.saque.title') }}</h2>

          <div v-if="carteira" class="cd__corpo">
            <p class="cd__disponivel">
              <span>{{ t('carteira.tela.disponivel') }}</span>
              <strong class="ui-num">{{ formatBrl(carteira.saldoSacavelCentavos) }}</strong>
            </p>

            <div class="cd__campo">
              <label for="valor-saque">{{ t('carteira.visao.saque.valorLabel') }}</label>
              <div class="cd__valor">
                <span class="cd__moeda" aria-hidden="true">{{ t('carteira.visao.saque.currency') }}</span>
                <InputText
                  id="valor-saque"
                  :model-value="valorSaque"
                  class="cd__entrada ui-num"
                  size="6"
                  :disabled="requestingSaque"
                  inputmode="numeric"
                  autocomplete="off"
                  :placeholder="t('carteira.visao.saque.valorPlaceholder')"
                  aria-describedby="valor-saque-dica"
                  @update:model-value="onValorSaqueInput($event ?? '')"
                  @keydown.enter.prevent="requestWithdraw"
                />
                <Button
                  type="button"
                  class="cd__tudo"
                  :label="t('carteira.tela.sacarTudo')"
                  severity="secondary"
                  text
                  size="small"
                  :disabled="requestingSaque"
                  @click="sacarTudo"
                />
              </div>
            </div>

            <ul id="valor-saque-dica" class="cd__dicas">
              <li>
                <i class="ph ph-key" aria-hidden="true" />
                <span>{{ t('carteira.dialogo.paraPix', { chave: chaveMascarada }) }}</span>
              </li>
              <li>
                <i class="ph ph-calendar-check" aria-hidden="true" />
                <span>{{ t('carteira.visao.saque.hint', { valor: formatBrl(minSaqueCentavos) }) }}</span>
              </li>
            </ul>
          </div>

          <div class="cd__pe">
            <Button
              type="button"
              :label="t('carteira.dialogo.cancelar')"
              severity="secondary"
              text
              :disabled="requestingSaque"
              @click="saqueAberto = false"
            />
            <Button
              type="button"
              icon="ph ph-check"
              :label="t('carteira.visao.saque.submit')"
              :loading="requestingSaque"
              :disabled="capacidade !== 'liberado'"
              @click="requestWithdraw"
            />
          </div>
        </div>
      </template>
    </Dialog>

    <!-- ------------------------------------------------------------ chave PIX -->
    <Dialog
      v-model:visible="pixAberto"
      modal
      dismissable-mask
      :draggable="false"
      class="carteira-dialogo"
      :pt="{ root: { class: 'carteira-dialogo' } }"
    >
      <template #container="{ closeCallback }">
        <div class="cd" role="document" aria-labelledby="pix-titulo">
          <Button
            class="cd__fechar"
            type="button"
            icon="ph ph-x"
            severity="secondary"
            text
            :aria-label="t('common.close')"
            :disabled="savingPix"
            @click="closeCallback"
          />

          <span class="cd__selo" aria-hidden="true"><i class="ph ph-key" /></span>
          <h2 id="pix-titulo" class="cd__titulo">{{ t('carteira.visao.pix.title') }}</h2>

          <div class="cd__corpo">
            <div class="cd__campo">
              <label for="chave-pix">{{ t('carteira.visao.pix.label') }}</label>
              <InputText
                id="chave-pix"
                v-model="chavePix"
                class="cd__entrada cd__entrada--texto"
                :disabled="!store.isDono || savingPix"
                autocomplete="off"
                spellcheck="false"
                :placeholder="t('carteira.visao.pix.placeholder')"
                aria-describedby="chave-pix-dica"
                :invalid="Boolean(erroDaChave)"
                :aria-invalid="erroDaChave ? 'true' : undefined"
                @keydown.enter.prevent="savePix"
              />
              <small v-if="erroDaChave" id="chave-pix-dica" class="cd__erro" role="alert">
                <i class="ph ph-warning-circle" aria-hidden="true" />
                {{ erroDaChave }}
              </small>
              <!-- O exemplo inteiro numa linha e da esquerda para a direita, também em árabe. -->
              <i18n-t
                v-else
                id="chave-pix-dica"
                keypath="carteira.visao.pix.hint"
                tag="small"
                class="cd__dica"
              >
                <template #exemplo>
                  <bdi dir="ltr" class="cd__exemplo">+55 11 98765-4321</bdi>
                </template>
              </i18n-t>
            </div>
          </div>

          <div class="cd__pe">
            <Button
              type="button"
              :label="t('carteira.dialogo.cancelar')"
              severity="secondary"
              text
              :disabled="savingPix"
              @click="pixAberto = false"
            />
            <Button
              type="button"
              icon="ph ph-check"
              :label="t('carteira.visao.pix.save')"
              :disabled="!store.isDono || !chavePix.trim()"
              :loading="savingPix"
              @click="savePix"
            />
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.carteira-saldo {
  display: grid;
  gap: 12px;
}

.carteira-saldo__grade {
  display: grid;
  gap: 14px;
}

/* ------------------------------------------------------------------ o saldo
 * O cartão do saldo: o número da tela, a ação e a barra do saldo total. O alto ganha a luz do
 * Portal, num degradê que some no branco, como a cabeça dos cartões de estado.
 */

.saldo {
  display: grid;
  overflow: hidden;
}

.saldo__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px 24px;
  padding: 24px 28px 20px;
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--pj-lugar-fundo) 62%, var(--superficie)),
    var(--superficie)
  );
}

.saldo__principal {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.saldo__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--tinta-2);
  font-size: 14.5px;
  font-weight: 600;
}

/* O número da tela: o que dá para sacar agora. */
.saldo__valor {
  color: var(--tinta);
  font-size: 48px;
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1;
}

.saldo__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.saldo__acao.p-button {
  min-height: 46px;
  padding-inline: 22px;
  font-size: 15px;
}

/* A barra do saldo total: o livre na cor do Portal, o que ainda libera em listras. */
.saldo__composicao {
  display: grid;
  gap: 10px;
  padding: 4px 28px 22px;
}

.saldo__barra {
  display: flex;
  overflow: hidden;
  height: 10px;
  gap: 3px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.saldo__barra span {
  height: 100%;
  border-radius: 999px;
}

.saldo__barra-livre {
  background: linear-gradient(90deg, var(--pj-lugar-claro), var(--pj-lugar));
}

.saldo__barra-retida {
  background: repeating-linear-gradient(
      -45deg,
      color-mix(in oklab, var(--pj-lugar) 38%, transparent) 0 3px,
      transparent 3px 7px
    ),
    var(--pj-lugar-fundo);
}

.saldo__legenda {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 20px;
  color: var(--tinta-2);
  font-size: 13px;
}

.saldo__chave {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.saldo__chave::before {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  content: '';
}

.saldo__chave--livre::before {
  background: var(--pj-lugar);
}

.saldo__chave--retida::before {
  background: repeating-linear-gradient(
      -45deg,
      color-mix(in oklab, var(--pj-lugar) 50%, transparent) 0 2px,
      transparent 2px 4px
    ),
    var(--pj-lugar-fundo);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--pj-lugar) 40%, transparent);
}

.saldo__total {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  margin-inline-start: auto;
}

.saldo__total strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

/* ------------------------------------------------------------------ os indicadores */

.saldo__indicadores {
  margin: 0;
  padding: 0;
  list-style: none;
}

.saldo__indicador .ui-indicador__valor {
  font-size: 26px;
}

.saldo__chave-pix.ui-indicador__valor {
  overflow: hidden;
  font-size: 19px;
  letter-spacing: -0.01em;
  line-height: 1.55;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saldo__sem-chave {
  color: var(--tinta-2);
  font-family: var(--font-texto);
  font-size: 16px;
  font-weight: 500;
}

.saldo__rotulo-chave {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
}

.fato__trocar.p-button {
  margin-inline-start: 8px;
  padding-block: 2px;
  font-size: 13px;
}

.saldo-erro {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 32px 24px;
  text-align: center;
}

.saldo-erro p {
  margin: 0;
  color: var(--tinta-2);
}

.saldo-aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 16px;
  border-radius: var(--raio-cartao-pequeno);
  background: var(--atencao-fundo);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.saldo-aviso i {
  margin-top: 2px;
  color: var(--atencao-tinta);
  font-size: 17px;
}

@media (max-width: 760px) {
  .saldo__topo {
    padding: 20px 18px 16px;
  }

  .saldo__composicao {
    padding: 2px 18px 18px;
  }

  .saldo__valor {
    font-size: 40px;
  }

  .saldo__acoes,
  .saldo__acao.p-button {
    width: 100%;
  }

  .saldo__total {
    margin-inline-start: 0;
  }

  .saldo__indicador .ui-indicador__valor {
    font-size: 21px;
  }

  /* Os dois valores lado a lado; a chave, que é longa, na linha de baixo inteira. */
  .saldo__indicadores.ui-indicadores {
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .saldo__indicador.ui-indicador {
    padding: 16px;
  }

  .saldo__indicador--chave {
    grid-column: 1 / -1;
  }
}

/* ------------------------------------------------------------------ os diálogos
 * O painel é desenhado aqui (slot `#container`), nos tokens do Trilha: o overlay vai para o
 * `body`, e a raiz `html.trilha` leva os dois temas até ele.
 */
.cd {
  position: relative;
  display: grid;
  justify-items: center;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  width: min(28rem, calc(100vw - 2rem));
  padding: 30px 26px 22px;
  border: 1px solid var(--linha);
  border-radius: 20px;
  background: var(--superficie);
  box-shadow: var(--sombra-3);
  color: var(--tinta);

  --p-button-text-secondary-color: var(--tinta-2);
  --p-button-text-secondary-hover-background: var(--superficie-2);
  --p-button-text-secondary-active-background: var(--superficie-3);
}

.cd__fechar.p-button {
  position: absolute;
  top: 12px;
  inset-inline-end: 12px;
  width: 36px;
  height: 36px;
  border-radius: 10px;
}

/* O ladrilho do Portal, no degradê do lugar, como o título das telas. */
.cd__selo {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: 16px;
  background: var(--pj-lugar-degrade, var(--portal));
  box-shadow:
    var(--pj-lugar-sombra, var(--sombra-1)),
    inset 0 1px 0 rgb(255 255 255 / 22%);
  color: #fff;
  font-size: 25px;
}

.app-dark .cd__selo {
  color: var(--rail);
}

.cd__titulo {
  margin: 6px 0 0;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-align: center;
}

.cd__corpo {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  margin-top: 8px;
}

.cd__disponivel {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.cd__disponivel strong {
  color: var(--tinta);
  font-size: 17px;
  font-weight: 650;
}

.cd__campo {
  display: grid;
  gap: 6px;
  grid-template-columns: minmax(0, 1fr);
}

.cd__campo label {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
}

/* O valor: "R$" fixo à esquerda, o número grande no meio e "Sacar tudo" à direita. */
.cd__valor {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-inline: 14px 6px;
  border: 1px solid var(--linha-forte);
  border-radius: 12px;
  background: var(--superficie);
}

.cd__valor:focus-within {
  border-color: var(--musgo);
  box-shadow: var(--anel-foco);
}

.cd__moeda {
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 20px;
  font-weight: 600;
}

.cd__valor .cd__entrada.p-inputtext {
  min-width: 0;
  flex: 1;
  height: 56px;
  padding: 0 6px;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--tinta);
  font-size: 26px;
  font-weight: 650;
  outline: none;
}

.cd__entrada--texto.p-inputtext {
  width: 100%;
  min-height: 46px;
  font-size: 15px;
}

.cd__dica {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.cd__exemplo {
  white-space: nowrap;
}

.cd__erro {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--risco-tinta);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
}

.cd__erro .ph {
  margin-top: 2px;
  font-size: 15px;
}

.cd__dicas {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
  list-style: none;
}

.cd__dicas li span {
  min-width: 0;
}

.cd__dicas li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.cd__dicas i {
  margin-top: 1px;
  color: var(--tinta-3);
  font-size: 15px;
}

.cd__pe {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
  margin-top: 16px;
}

@media (max-width: 520px) {
  .cd__pe {
    flex-direction: column-reverse;
  }

  .cd__pe :deep(.p-button) {
    width: 100%;
  }
}
</style>

<style>
/* O painel é o `.cd`; o do PrimeVue fica transparente em volta dele. */
.carteira-dialogo.p-dialog,
.carteira-dialogo .p-dialog {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}
</style>
