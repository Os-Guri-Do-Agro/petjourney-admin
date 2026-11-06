<script setup lang="ts">
/**
 * Prescrever no atendimento (E4-03, guia e4 6.2): do catálogo, por peso (o servidor faz a conta)
 * ou por quantidade; ou pelo nome livre, declarando que não é controlado (P3). Editar muda a dose,
 * a via, a posologia e as confirmações; o medicamento fica.
 *
 * O servidor confere e devolve o que falta confirmar (422 `CONFIRMACAO_PENDENTE`): alergia,
 * espécie contraindicada, dose arredondada, fora da faixa usual, peso acima do esperado. A gaveta
 * mostra cada um com a conta que veio e o "estou ciente", e manda de novo. Acima de 3x o teto, ou
 * sem peso nenhum, não há confirmação: corrige-se a dose ou o peso.
 *
 * A gravação usa a versão e a aba do atendimento: antes, o autosave termina; depois, a versão nova
 * volta para a tela.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  buscarMedicamentos,
  ESPECIES_DO_CATALOGO,
  type EspecieDoCatalogo,
  type Medicamento,
} from '@/service/parceiro/catalogos-service'
import {
  atualizarPrescricao,
  criarPrescricao,
  UNIDADES,
  VIAS,
  type GravacaoDaPrescricao,
  type NovaPrescricao,
  type Prescricao,
  type UnidadeDaDose,
  type ViaDaPrescricao,
} from '@/service/parceiro/receitas-service'

const props = defineProps<{
  atendimentoId: string
  especie: string
  /** A prescrição a editar; `null` prescreve uma nova. */
  prescricao: Prescricao | null
  dispositivoId: string
  versao: () => number
  esperarGravar: () => Promise<boolean>
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ gravada: [gravacao: GravacaoDaPrescricao]; alterado: [] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const intl = computed(() => INTL_LOCALE[locale.value as Locale])

type Origem = 'CATALOGO' | 'LIVRE'
type Modo = 'PESO' | 'QUANTIDADE'

const origem = ref<Origem>('CATALOGO')
const medicamento = ref<Medicamento | null>(null)
const sugestoes = ref<Medicamento[]>([])
const nomeLivre = ref('')
const declaraNaoControlado = ref(false)
const via = ref<ViaDaPrescricao | null>(null)
const modo = ref<Modo>('PESO')
const mgPorKg = ref<number | null>(null)
const pesoKg = ref<number | null>(null)
const quantidade = ref<number | null>(null)
const unidade = ref<UnidadeDaDose>('COMPRIMIDO')
const frequenciaHoras = ref<number>(12)
const duracaoDias = ref<number | null>(7)
const continuo = ref(false)
const instrucoes = ref('')
const critico = ref(false)

/** As confirmações do servidor: cada aviso que ele pediu e o "estou ciente" de cada um. */
type Pendencia = { aviso: string; texto: string }
const pendencias = ref<Pendencia[]>([])
const ciente = ref<Record<string, boolean>>({})
const faltaPeso = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const campoPeso = ref<{ $el?: HTMLElement } | null>(null)

const editando = computed(() => Boolean(props.prescricao))

watch(aberta, (agora) => {
  if (!agora) return
  const p = props.prescricao
  origem.value = p?.nomeLivre ? 'LIVRE' : 'CATALOGO'
  medicamento.value = null
  nomeLivre.value = p?.nomeLivre ?? ''
  declaraNaoControlado.value = Boolean(p?.nomeLivre)
  via.value = p?.via ?? null
  modo.value = p ? (p.mgPorKg ? 'PESO' : 'QUANTIDADE') : 'PESO'
  mgPorKg.value = p?.mgPorKg ?? null
  pesoKg.value = p?.pesoOrigem === 'INFORMADO' ? p.pesoKg : null
  quantidade.value = p && !p.mgPorKg ? p.quantidade : null
  unidade.value = p?.unidade ?? 'COMPRIMIDO'
  frequenciaHoras.value = p?.frequenciaHoras ?? 12
  continuo.value = Boolean(p && p.duracaoDias === null)
  duracaoDias.value = p ? p.duracaoDias : 7
  instrucoes.value = p?.instrucoes ?? ''
  critico.value = p?.critico ?? false
  pendencias.value = []
  ciente.value = {}
  faltaPeso.value = false
  tentou.value = false
  erro.value = ''
})

/* ------------------------------------------------------------------------------ opções */

const especieDoCatalogo = computed<EspecieDoCatalogo | null>(
  () => ESPECIES_DO_CATALOGO.find((item) => item === props.especie) ?? null,
)

async function buscar(evento: { query: string }) {
  if (evento.query.trim().length < 2) {
    sugestoes.value = []
    return
  }
  try {
    sugestoes.value = await buscarMedicamentos(
      { q: evento.query, especie: especieDoCatalogo.value, limite: 8 },
      parceiroQuery(),
    )
  } catch {
    sugestoes.value = []
  }
}

function escolher(item: Medicamento) {
  medicamento.value = item
  unidade.value = item.unidadeApresentacao
  if (item.viasPermitidas.length === 1) via.value = item.viasPermitidas[0]!
  else if (via.value && !item.viasPermitidas.includes(via.value)) via.value = null
}

const viasPossiveis = computed(() => {
  if (origem.value === 'CATALOGO' && medicamento.value?.viasPermitidas.length) {
    return medicamento.value.viasPermitidas
  }
  return VIAS
})

const opcoesDeOrigem = computed(() => [
  { valor: 'CATALOGO', rotulo: t('atendimento.receita.prescrever.catalogo') },
  { valor: 'LIVRE', rotulo: t('atendimento.receita.prescrever.livre') },
])
const opcoesDeModo = computed(() => [
  { valor: 'PESO', rotulo: t('atendimento.receita.prescrever.porPeso') },
  { valor: 'QUANTIDADE', rotulo: t('atendimento.receita.prescrever.porQuantidade') },
])
const opcoesDeVia = computed(() =>
  viasPossiveis.value.map((valor) => ({ valor, rotulo: t(`clinico.bulario.api.via.${valor}`) })),
)
const opcoesDeUnidade = computed(() =>
  UNIDADES.map((valor) => ({ valor, rotulo: t(`atendimento.receita.unidade.${valor}`) })),
)
const FREQUENCIAS = [4, 6, 8, 12, 24, 48, 72, 168] as const
const opcoesDeFrequencia = computed(() =>
  FREQUENCIAS.map((valor) => ({
    valor,
    rotulo:
      valor === 24
        ? t('atendimento.receita.frequencia.dia')
        : valor % 24 === 0
          ? t('atendimento.receita.frequencia.dias', { n: valor / 24 })
          : t('atendimento.receita.frequencia.horas', { n: valor }),
  })),
)

/** Por peso só do catálogo (P3: o nome livre não tem conta). */
const porPeso = computed(() => origem.value === 'CATALOGO' && modo.value === 'PESO')

const valido = computed(() => {
  if (!via.value) return false
  if (!editando.value && origem.value === 'CATALOGO' && !medicamento.value) return false
  if (origem.value === 'LIVRE' && (!nomeLivre.value.trim() || !declaraNaoControlado.value)) {
    return false
  }
  if (porPeso.value) return Boolean(mgPorKg.value)
  return Boolean(quantidade.value)
})

/* ------------------------------------------------------------------------- as confirmações */

function numero(valor: unknown, casas = 2) {
  const n = Number(valor)
  return Number.isFinite(n)
    ? new Intl.NumberFormat(intl.value, { maximumFractionDigits: casas }).format(n)
    : String(valor ?? '')
}

/** O texto de cada aviso com a conta que o servidor mandou. */
function textoDoAviso(aviso: string, detalhes: Record<string, unknown>) {
  const dose = (detalhes.dose ?? {}) as Record<string, unknown>
  const faixa = (detalhes.faixa ?? {}) as Record<string, unknown>
  const peso = (detalhes.peso ?? {}) as Record<string, unknown>
  const porQuantidade = (detalhes.porQuantidade ?? null) as Record<string, unknown> | null
  switch (aviso) {
    case 'ALERGIA':
      return t('atendimento.receita.aviso.ALERGIA')
    case 'ESPECIE_PROIBIDA':
      return t('atendimento.receita.aviso.ESPECIE_PROIBIDA')
    case 'DOSE_ARREDONDADA':
      return t('atendimento.receita.aviso.DOSE_ARREDONDADA', {
        real: numero(dose.mgReal),
        calculado: numero(dose.mgCalculado),
      })
    case 'FORA_DA_FAIXA': {
      const base = t(
        faixa.origem === 'ESPECIE'
          ? 'atendimento.receita.aviso.FORA_DA_FAIXA_ESPECIE'
          : 'atendimento.receita.aviso.FORA_DA_FAIXA',
        { min: numero(faixa.mgKgMin), max: numero(faixa.mgKgMax) },
      )
      return porQuantidade?.mgPorKg != null
        ? `${base} ${t('atendimento.receita.aviso.porQuantidade', { mgKg: numero(porQuantidade.mgPorKg) })}`
        : base
    }
    case 'PESO_IMPLAUSIVEL':
      return t('atendimento.receita.aviso.PESO_IMPLAUSIVEL', {
        kg: numero(peso.kg),
        limite: numero(peso.limiteKg),
      })
    default:
      return t('atendimento.receita.aviso.outro')
  }
}

const CONFIRMACAO: Record<string, keyof NovaPrescricao> = {
  ALERGIA: 'alergiaConfirmada',
  ESPECIE_PROIBIDA: 'proibidoConfirmado',
  DOSE_ARREDONDADA: 'arredondamentoConfirmado',
  FORA_DA_FAIXA: 'foraDaFaixaConfirmada',
  PESO_IMPLAUSIVEL: 'pesoImplausivelConfirmado',
}

const faltaCiente = computed(() => pendencias.value.some((p) => !ciente.value[p.aviso]))

async function corrigirPeso() {
  modo.value = porPeso.value ? 'PESO' : modo.value
  pendencias.value = pendencias.value.filter((p) => p.aviso !== 'PESO_IMPLAUSIVEL')
  await nextTick()
  campoPeso.value?.$el?.querySelector('input')?.focus()
}

/* ----------------------------------------------------------------------------- gravar */

function corpoDaDose() {
  const confirmacoes = Object.fromEntries(
    pendencias.value
      .filter((p) => ciente.value[p.aviso] && CONFIRMACAO[p.aviso])
      .map((p) => [CONFIRMACAO[p.aviso], true]),
  )
  return {
    via: via.value!,
    ...(porPeso.value
      ? { mgPorKg: mgPorKg.value! }
      : { quantidade: quantidade.value!, unidade: unidade.value }),
    ...(pesoKg.value ? { pesoKg: pesoKg.value } : {}),
    frequenciaHoras: frequenciaHoras.value,
    duracaoDias: continuo.value ? null : duracaoDias.value,
    ...(instrucoes.value.trim() ? { instrucoes: instrucoes.value.trim() as never } : {}),
    critico: critico.value,
    ...confirmacoes,
  }
}

async function gravar() {
  tentou.value = true
  erro.value = ''
  faltaPeso.value = false
  if (!valido.value || faltaCiente.value) return
  salvando.value = true
  try {
    const gravou = await props.esperarGravar()
    if (!gravou) {
      erro.value = t('atendimento.finalizar.naoGravou')
      return
    }
    const lock = { versao: props.versao(), dispositivoId: props.dispositivoId }
    const gravacao = props.prescricao
      ? await atualizarPrescricao(
          props.atendimentoId,
          props.prescricao.id,
          { ...corpoDaDose(), ...lock },
          parceiroQuery(),
        )
      : await criarPrescricao(
          props.atendimentoId,
          {
            ...corpoDaDose(),
            ...lock,
            ...(origem.value === 'CATALOGO'
              ? { medicamentoId: medicamento.value!.id }
              : { nomeLivre: nomeLivre.value.trim(), declaraNaoControlado: true }),
          },
          parceiroQuery(),
        )
    aberta.value = false
    emit('gravada', gravacao)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('atendimento.receita.prescrever.erro'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    if (lido.codigo === 'CONFIRMACAO_PENDENTE') {
      const avisos = Array.isArray(detalhes.avisos) ? (detalhes.avisos as string[]) : []
      pendencias.value = avisos.map((aviso) => ({ aviso, texto: textoDoAviso(aviso, detalhes) }))
      /* O pedido aparece no pé do formulário: a gaveta rola até ele. */
      await nextTick()
      document.querySelector('.pg__pendencias')?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (lido.codigo === 'PESO_AUSENTE') {
      faltaPeso.value = true
      erro.value = t('atendimento.receita.prescrever.semPeso')
      return
    }
    if (lido.codigo === 'DOSE_MUITO_ACIMA_DA_FAIXA') {
      erro.value = t('atendimento.receita.prescrever.muitoAcima', {
        mgKg: numero(detalhes.mgPorKg),
        limite: numero(detalhes.limiteMgKg),
      })
      return
    }
    if (lido.codigo === 'ATENDIMENTO_ALTERADO') {
      emit('alterado')
      erro.value = t('atendimento.receita.prescrever.alterado')
      return
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}

/* Trocar a dose pede confirmar de novo: o que foi confirmado não vale para a dose nova. */
watch([mgPorKg, quantidade, unidade, pesoKg, modo], () => {
  if (pendencias.value.length) {
    pendencias.value = []
    ciente.value = {}
  }
})
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="
      editando
        ? t('atendimento.receita.prescrever.editar')
        : t('atendimento.receita.prescrever.titulo')
    "
    icone="ph ph-prescription"
    largura="36rem"
  >
    <form id="prescricao-form" class="eg" novalidate @submit.prevent="gravar">
      <!-- O medicamento: do catálogo ou pelo nome (fixo ao editar). -->
      <section v-if="editando" class="eg__secao">
        <span class="eg__rotulo">{{ t('atendimento.receita.prescrever.medicamento') }}</span>
        <strong class="pg__fixo">{{ prescricao?.medicamentoNome }}</strong>
        <small v-if="prescricao?.apresentacao" class="eg__dica">{{
          prescricao.apresentacao
        }}</small>
      </section>
      <template v-else>
        <SelectButton
          v-model="origem"
          :options="opcoesDeOrigem"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('atendimento.receita.prescrever.origem')"
          :disabled="salvando"
        />
        <section v-if="origem === 'CATALOGO'" class="eg__secao">
          <label class="eg__rotulo" for="pg-medicamento">{{
            t('atendimento.receita.prescrever.medicamento')
          }}</label>
          <AutoComplete
            v-model="medicamento"
            input-id="pg-medicamento"
            :suggestions="sugestoes"
            option-label="nome"
            force-selection
            :placeholder="t('atendimento.atos.buscarMedicamento')"
            :invalid="tentou && !medicamento"
            :disabled="salvando"
            @complete="buscar"
            @option-select="escolher($event.value)"
          >
            <template #option="{ option }">
              <span class="pg__opcao">
                <span>{{ option.nome }}</span>
                <small>{{ option.principioAtivo }} · {{ option.apresentacao }}</small>
              </span>
            </template>
          </AutoComplete>
        </section>
        <template v-else>
          <section class="eg__secao">
            <label class="eg__rotulo" for="pg-livre">{{
              t('atendimento.receita.prescrever.nomeLivre')
            }}</label>
            <InputText
              id="pg-livre"
              v-model="nomeLivre"
              :invalid="tentou && !nomeLivre.trim()"
              :disabled="salvando"
            />
            <small class="eg__dica">{{ t('atendimento.receita.prescrever.nomeLivreDica') }}</small>
          </section>
          <label class="pg__check" for="pg-declara">
            <Checkbox
              v-model="declaraNaoControlado"
              input-id="pg-declara"
              binary
              :disabled="salvando"
            />
            <span>{{ t('atendimento.receita.prescrever.declara') }}</span>
          </label>
        </template>
      </template>

      <!-- A dose. -->
      <section v-if="origem === 'CATALOGO'" class="eg__secao">
        <span id="pg-modo" class="eg__rotulo">{{ t('atendimento.receita.prescrever.dose') }}</span>
        <SelectButton
          v-model="modo"
          :options="opcoesDeModo"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="pg-modo"
          :disabled="salvando"
        />
      </section>
      <div class="eg__linha">
        <section v-if="porPeso" class="eg__secao">
          <label class="eg__rotulo" for="pg-mgkg">{{
            t('atendimento.receita.prescrever.mgPorKg')
          }}</label>
          <InputNumber
            v-model="mgPorKg"
            input-id="pg-mgkg"
            :min-fraction-digits="0"
            :max-fraction-digits="3"
            :min="0"
            suffix=" mg/kg"
            :locale="intl"
            :invalid="tentou && !mgPorKg"
            :disabled="salvando"
          />
        </section>
        <template v-else>
          <section class="eg__secao">
            <label class="eg__rotulo" for="pg-qtd">{{
              t('atendimento.receita.prescrever.quantidade')
            }}</label>
            <InputNumber
              v-model="quantidade"
              input-id="pg-qtd"
              :min-fraction-digits="0"
              :max-fraction-digits="3"
              :min="0"
              :locale="intl"
              :invalid="tentou && !quantidade"
              :disabled="salvando"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="pg-unidade">{{
              t('atendimento.receita.prescrever.unidade')
            }}</label>
            <Select
              v-model="unidade"
              input-id="pg-unidade"
              :options="opcoesDeUnidade"
              option-label="rotulo"
              option-value="valor"
              :disabled="salvando"
            />
          </section>
        </template>
        <section v-if="origem === 'CATALOGO'" class="eg__secao">
          <label class="eg__rotulo" for="pg-peso">
            {{ t('atendimento.receita.prescrever.peso') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <InputNumber
            ref="campoPeso"
            v-model="pesoKg"
            input-id="pg-peso"
            :min-fraction-digits="0"
            :max-fraction-digits="2"
            :min="0"
            suffix=" kg"
            :locale="intl"
            :placeholder="t('atendimento.receita.prescrever.pesoDica')"
            :invalid="faltaPeso"
            :disabled="salvando"
          />
        </section>
      </div>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="pg-via">{{ t('atendimento.atos.via') }}</label>
          <Select
            v-model="via"
            input-id="pg-via"
            :options="opcoesDeVia"
            option-label="rotulo"
            option-value="valor"
            :placeholder="t('atendimento.receita.prescrever.escolherVia')"
            :invalid="tentou && !via"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="pg-freq">{{
            t('atendimento.receita.prescrever.frequencia')
          }}</label>
          <Select
            v-model="frequenciaHoras"
            input-id="pg-freq"
            :options="opcoesDeFrequencia"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </section>
      </div>

      <section class="eg__secao">
        <label class="eg__rotulo" for="pg-dias">{{
          t('atendimento.receita.prescrever.duracao')
        }}</label>
        <div class="pg__duracao">
          <InputNumber
            v-model="duracaoDias"
            input-id="pg-dias"
            :min="1"
            :suffix="` ${t('atendimento.conduta.dias')}`"
            :disabled="salvando || continuo"
          />
          <label class="pg__check" for="pg-continuo">
            <Checkbox v-model="continuo" input-id="pg-continuo" binary :disabled="salvando" />
            <span>{{ t('atendimento.receita.prescrever.continuo') }}</span>
          </label>
        </div>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="pg-instrucoes">
          {{ t('atendimento.receita.prescrever.instrucoes') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="pg-instrucoes"
          v-model="instrucoes"
          rows="2"
          auto-resize
          :disabled="salvando"
        />
      </section>

      <label class="pg__critico" for="pg-critico">
        <ToggleSwitch v-model="critico" input-id="pg-critico" :disabled="salvando" />
        <span>
          <strong>{{ t('atendimento.receita.prescrever.critico') }}</strong>
          <small>{{ t('atendimento.receita.prescrever.criticoDica') }}</small>
        </span>
      </label>

      <!-- O que o servidor pede para confirmar, com a conta. -->
      <section v-if="pendencias.length" class="eg__secao pg__pendencias" role="alert">
        <span class="eg__rotulo">{{ t('atendimento.receita.prescrever.confirme') }}</span>
        <div v-for="item in pendencias" :key="item.aviso" class="pg__pendencia">
          <p class="eg__aviso">
            <i class="ph ph-warning" aria-hidden="true" />
            <span>{{ item.texto }}</span>
          </p>
          <div class="pg__acoes">
            <label class="pg__check" :for="`pg-ciente-${item.aviso}`">
              <Checkbox
                v-model="ciente[item.aviso]"
                :input-id="`pg-ciente-${item.aviso}`"
                binary
                :disabled="salvando"
              />
              <span>{{ t('atendimento.receita.prescrever.ciente') }}</span>
            </label>
            <Button
              v-if="item.aviso === 'PESO_IMPLAUSIVEL' && origem === 'CATALOGO'"
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('atendimento.receita.prescrever.corrigirPeso')"
              @click="corrigirPeso"
            />
          </div>
        </div>
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
        form="prescricao-form"
        icon="ph ph-check"
        :label="t('atendimento.receita.prescrever.confirmar')"
        :disabled="faltaCiente"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.pg__fixo {
  color: var(--tinta);
  font-size: 15px;
}

.pg__opcao {
  display: grid;
  gap: 2px;
}

.pg__opcao small {
  color: var(--tinta-2);
  font-size: 12px;
}

.pg__check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}

.pg__duracao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}

.pg__critico {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}

.pg__critico span {
  display: grid;
  gap: 2px;
}

.pg__critico strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.pg__critico small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.pg__pendencias {
  gap: 12px;
}

.pg__pendencia {
  display: grid;
  gap: 6px;
}

.pg__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding-inline-start: 24px;
}
</style>
