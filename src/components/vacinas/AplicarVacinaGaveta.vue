<script setup lang="ts">
/**
 * Aplicar uma vacina (E4-04, guia e4 3.2 e 3.4). A dose não vem da tela: a API calcula e congela.
 *
 * - O lote: os do estoque (E6-01: com o saldo, vão por `loteId` e baixam a dose na mesma gravação;
 *   o último frasco disputado volta com `LOTE_SEM_SALDO` e a lista se relê) ou, sem estoque, os já
 *   usados nesta clínica (o que vence antes vem sugerido; o vencido aparece travado,
 *   para ninguém digitá-lo à mão), ou digitado. O lote vencido trava no servidor.
 * - A idade mínima: antes dela, a API pergunta; o veterinário confirma e a tela reenvia.
 * - A próxima dose na agenda, no mesmo gesto, só para quem tem `agenda.escrever` (até 60 dias).
 * - O CRMV de outro aplicador só vai ao app se quem grava é ele, o DONO ou o GESTOR.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputMask from 'primevue/inputmask'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import type { Vacina } from '@/service/parceiro/catalogos-service'
import {
  aplicarVacina,
  APLICACAO_DIAS_PARA_TRAS,
  CODIGO_DO_LOTE,
  lotesParaAplicar,
  type LoteParaAplicar,
  type NovaAplicacao,
  type ResultadoDaAplicacao,
} from '@/service/parceiro/vacinacao-service'

const props = defineProps<{
  pacienteId: string
  vacinas: Vacina[]
  profissionais: { id: string; nome: string }[]
  vacinaInicial?: string | null
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ aplicada: [resultado: ResultadoDaAplicacao] }>()

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const vacinaId = ref<string | null>(null)
const loteCodigo = ref('')
const validade = ref<Date | null>(null)
const via = ref<string | null>(null)
const profissionalId = ref<string | null>(null)
const outroDia = ref(false)
const dia = ref<Date | null>(null)
const observacao = ref('')
const marcar = ref(false)
const proximoDia = ref<Date | null>(null)
const proximaHora = ref('09:00')

const lotes = ref<LoteParaAplicar[]>([])
/** A clínica guarda lotes desta vacina no estoque (E6-01): o lote vai por `loteId` e baixa a dose. */
const doEstoque = ref(false)
const loteId = ref<string | null>(null)
/** O código digitado tem letra fora do A a Z numa clínica que guarda a vacina: conferir o frasco. */
const codigoEstranho = ref(false)
const confirmoCodigo = ref(false)
const salvando = ref(false)
const tentou = ref(false)
const erro = ref('')
/** A API pediu a confirmação da idade mínima: "só a partir de {data}". */
const idadeMinima = ref<string | null>(null)

const euProfissional = computed(() => store.eu?.profissional?.id ?? null)
const confirmaCrmv = computed(
  () => store.eu?.papel === 'DONO' || (store.eu?.papeisOperacionais ?? []).includes('GESTOR'),
)
const podeMarcar = computed(() => store.temPermissao('agenda.escrever'))

const vacina = computed(() => props.vacinas.find((v) => v.id === vacinaId.value) ?? null)

watch(aberta, (agora) => {
  if (!agora) return
  vacinaId.value = props.vacinaInicial ?? null
  loteCodigo.value = ''
  validade.value = null
  profissionalId.value = euProfissional.value ?? props.profissionais[0]?.id ?? null
  outroDia.value = false
  dia.value = null
  observacao.value = ''
  marcar.value = false
  proximoDia.value = null
  proximaHora.value = '09:00'
  tentou.value = false
  erro.value = ''
  idadeMinima.value = null
  loteId.value = null
  codigoEstranho.value = false
  confirmoCodigo.value = false
})

/* Outra vacina: as vias dela (a de rotina primeiro) e os lotes (do estoque, ou os já usados). */
watch(vacinaId, async (id) => {
  via.value = vacina.value?.vias[0] ?? null
  void lerLotes(id)
})

async function lerLotes(id: string | null) {
  lotes.value = []
  doEstoque.value = false
  loteId.value = null
  if (!id) return
  try {
    const lidos = await lotesParaAplicar(id, parceiroQuery())
    lotes.value = lidos.lotes
    doEstoque.value = lidos.estoque
    const sugerido = lidos.lotes.find((lote) => lote.sugerido && lote.avaliacao.pode)
    if (sugerido && !loteCodigo.value) usarLote(sugerido)
  } catch {
    lotes.value = []
  }
}

function usarLote(lote: LoteParaAplicar) {
  if (!lote.avaliacao.pode) return
  loteId.value = lote.loteId
  loteCodigo.value = lote.codigo
  const [a, m, d] = lote.validade.split('-').map(Number)
  validade.value = new Date(a!, m! - 1, d!)
}

/* Digitou outro código: deixa de ser o lote escolhido do estoque. */
watch(loteCodigo, (agora) => {
  const escolhido = lotes.value.find((lote) => lote.loteId === loteId.value)
  if (escolhido && escolhido.codigo !== agora.trim()) loteId.value = null
  codigoEstranho.value = false
  confirmoCodigo.value = false
})

const opcoesDeVacina = computed(() =>
  props.vacinas.map((v) => ({
    valor: v.id,
    rotulo: v.fabricante ? `${v.nome} · ${v.fabricante}` : v.nome,
  })),
)
const opcoesDeVia = computed(() =>
  (vacina.value?.vias ?? []).map((valor) => ({
    valor,
    rotulo: t(`clinico.bulario.api.via.${valor}`),
  })),
)
const opcoesDeProfissional = computed(() =>
  props.profissionais.map((p) => ({ valor: p.id, rotulo: p.nome })),
)

/** Outro aplicador, gravado por quem não confirma CRMV: a dose vai ao app sem o CRMV dele. */
const semCrmvNoApp = computed(
  () =>
    Boolean(profissionalId.value) &&
    profissionalId.value !== euProfissional.value &&
    !confirmaCrmv.value,
)

const hoje = new Date()
const minimoDaAplicacao = new Date(hoje.getTime() - APLICACAO_DIAS_PARA_TRAS * 86_400_000)
const maximoDaProxima = new Date(hoje.getTime() + 60 * 86_400_000)

function iso(data: Date) {
  const mm = String(data.getMonth() + 1).padStart(2, '0')
  const dd = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mm}-${dd}`
}

function momento(data: Date, hora: string) {
  const [h, m] = hora.split(':').map(Number)
  const local = new Date(data.getFullYear(), data.getMonth(), data.getDate(), h ?? 9, m ?? 0)
  return local.toISOString()
}

const valido = computed(
  () =>
    Boolean(vacinaId.value) &&
    CODIGO_DO_LOTE.test(loteCodigo.value.trim()) &&
    Boolean(validade.value) &&
    Boolean(via.value) &&
    Boolean(profissionalId.value) &&
    (!outroDia.value || Boolean(dia.value)) &&
    (!marcar.value || (Boolean(proximoDia.value) && /^\d{2}:\d{2}$/.test(proximaHora.value))),
)

function corpo(confirmarIdade: boolean): NovaAplicacao {
  return {
    vacinaId: vacinaId.value!,
    ...(loteId.value
      ? { loteId: loteId.value }
      : { loteCodigo: loteCodigo.value.trim(), validadeLote: iso(validade.value!) }),
    ...(codigoEstranho.value && confirmoCodigo.value ? { confirmarCodigoDoLote: true } : {}),
    via: via.value as NovaAplicacao['via'],
    profissionalId: profissionalId.value!,
    ...(outroDia.value && dia.value ? { aplicadaEm: momento(dia.value, '12:00') } : {}),
    ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
    ...(confirmarIdade ? { confirmarIdadeMinima: true } : {}),
    ...(marcar.value && proximoDia.value
      ? {
          marcarProxima: {
            inicio: momento(proximoDia.value, proximaHora.value),
            profissionalId: profissionalId.value!,
          },
        }
      : {}),
  }
}

function frase(err: unknown) {
  const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
  const d = err instanceof ApiError ? err.detalhes : {}
  switch (lido.codigo) {
    case 'LOTE_VENCIDO':
      return t('vacinas.erro.loteVencido')
    case 'LOTE_SEM_SALDO':
      return t('vacinas.erro.semSaldo')
    case 'VIA_INVALIDA':
      return t('vacinas.erro.via')
    case 'APLICACAO_REPETIDA':
      return t('vacinas.erro.repetida')
    case 'APLICACAO_FORA_DE_ORDEM':
      return t('vacinas.erro.foraDeOrdem', {
        data: rotulos.dia(String(d.ultimaEm ?? '').slice(0, 10)),
      })
    case 'PROXIMA_DOSE_FORA_DA_JANELA':
      return t('vacinas.erro.foraDaJanela')
    case 'MARCAR_PROXIMA_SEM_TIPO':
      return t('vacinas.erro.semTipo')
    case 'VACINA_FORA_DA_ESPECIE':
      return t('vacinas.erro.especie')
    default:
      return lido.mensagem
  }
}

async function aplicar(confirmarIdade = false) {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  salvando.value = true
  const dados = corpo(confirmarIdade)
  try {
    const resultado = await aplicarVacina(
      props.pacienteId,
      dados,
      chaveador.para(dados),
      parceiroQuery(),
    )
    chaveador.concluir()
    aberta.value = false
    emit('aplicada', resultado)
  } catch (err) {
    if (err instanceof ApiError && err.codigo === 'LOTE_CODIGO_NAO_ASCII') {
      codigoEstranho.value = true
      erro.value = t('vacinas.erro.codigoEstranho')
    } else if (err instanceof ApiError && err.codigo === 'LOTE_SEM_SALDO') {
      erro.value = frase(err)
      void lerLotes(vacinaId.value)
    } else if (err instanceof ApiError && err.codigo === 'IDADE_MINIMA_NAO_ATINGIDA') {
      idadeMinima.value = rotulos.dia(String(err.detalhes.aPartirDe ?? '').slice(0, 10))
    } else {
      erro.value = frase(err)
    }
  } finally {
    salvando.value = false
  }
}

function avisoDoLote(lote: LoteParaAplicar) {
  if (!lote.avaliacao.pode) return t(`vacinas.lote.${lote.avaliacao.motivo ?? 'VENCIDO'}`)
  if (lote.avaliacao.aviso) return t(`vacinas.lote.${lote.avaliacao.aviso}`)
  return ''
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('vacinas.aplicar.titulo')"
    icone="ph ph-syringe"
    largura="36rem"
  >
    <form id="aplicar-vacina" class="eg" novalidate @submit.prevent="aplicar(false)">
      <section class="eg__secao">
        <label class="eg__rotulo" for="apl-vacina">{{ t('vacinas.aplicar.vacina') }}</label>
        <Select
          v-model="vacinaId"
          input-id="apl-vacina"
          :options="opcoesDeVacina"
          option-label="rotulo"
          option-value="valor"
          filter
          :placeholder="t('vacinas.aplicar.escolher')"
          :invalid="tentou && !vacinaId"
          :disabled="salvando"
        />
      </section>

      <div class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('vacinas.aplicar.lote') }}</h3>
        <ul v-if="lotes.length" class="apl__lotes" :aria-label="t('vacinas.aplicar.lotesUsados')">
          <li v-for="lote in lotes" :key="lote.codigo">
            <Button
              type="button"
              size="small"
              severity="secondary"
              :outlined="loteCodigo !== lote.codigo"
              :disabled="!lote.avaliacao.pode || salvando"
              :label="
                lote.saldo !== null
                  ? `${lote.codigo} · ${rotulos.dia(lote.validade)} · ${t('vacinas.aplicar.saldo', { n: lote.saldo }, lote.saldo)}`
                  : `${lote.codigo} · ${rotulos.dia(lote.validade)}`
              "
              @click="usarLote(lote)"
            />
            <small v-if="avisoDoLote(lote)">{{ avisoDoLote(lote) }}</small>
          </li>
        </ul>
        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="apl-lote">{{ t('vacinas.aplicar.codigo') }}</label>
            <InputText
              id="apl-lote"
              v-model="loteCodigo"
              maxlength="40"
              :invalid="tentou && !CODIGO_DO_LOTE.test(loteCodigo.trim())"
              :disabled="salvando"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="apl-validade">{{ t('vacinas.aplicar.validade') }}</label>
            <DatePicker
              v-model="validade"
              input-id="apl-validade"
              date-format="dd/mm/yy"
              :invalid="tentou && !validade"
              :disabled="salvando"
            />
          </section>
        </div>
        <small v-if="doEstoque && !loteId" class="eg__dica">{{
          t('vacinas.aplicar.foraDoEstoque')
        }}</small>
        <label v-if="codigoEstranho" class="apl__confirmar" for="apl-codigo-confere">
          <Checkbox
            v-model="confirmoCodigo"
            input-id="apl-codigo-confere"
            binary
            :disabled="salvando"
          />
          <span>{{ t('vacinas.aplicar.confirmoCodigo') }}</span>
        </label>
      </div>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="apl-via">{{ t('vacinas.aplicar.via') }}</label>
          <Select
            v-model="via"
            input-id="apl-via"
            :options="opcoesDeVia"
            option-label="rotulo"
            option-value="valor"
            :invalid="tentou && !via"
            :disabled="salvando || !vacina"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="apl-quem">{{ t('vacinas.aplicar.quem') }}</label>
          <Select
            v-model="profissionalId"
            input-id="apl-quem"
            :options="opcoesDeProfissional"
            option-label="rotulo"
            option-value="valor"
            :invalid="tentou && !profissionalId"
            :disabled="salvando"
          />
        </section>
      </div>
      <small v-if="semCrmvNoApp" class="eg__dica">{{ t('vacinas.aplicar.semCrmvNoApp') }}</small>

      <label class="apl__chave">
        <ToggleSwitch v-model="outroDia" :disabled="salvando" />
        <span>{{ t('vacinas.aplicar.outroDia') }}</span>
      </label>
      <DatePicker
        v-if="outroDia"
        v-model="dia"
        inline
        :min-date="minimoDaAplicacao"
        :max-date="hoje"
        :aria-label="t('vacinas.aplicar.dia')"
        :disabled="salvando"
      />

      <section class="eg__secao">
        <label class="eg__rotulo" for="apl-obs">
          {{ t('vacinas.aplicar.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea id="apl-obs" v-model="observacao" rows="2" auto-resize :disabled="salvando" />
      </section>

      <!-- A próxima dose na agenda, no mesmo gesto: só para quem marca horário. -->
      <template v-if="podeMarcar">
        <label class="apl__chave">
          <ToggleSwitch v-model="marcar" :disabled="salvando" />
          <span>{{ t('vacinas.aplicar.marcar') }}</span>
        </label>
        <template v-if="marcar">
          <small class="eg__dica">{{ t('vacinas.aplicar.marcarDica') }}</small>
          <DatePicker
            v-model="proximoDia"
            inline
            :min-date="hoje"
            :max-date="maximoDaProxima"
            :aria-label="t('vacinas.aplicar.proximoDia')"
            :disabled="salvando"
          />
          <section class="eg__secao">
            <label class="eg__rotulo" for="apl-hora">{{ t('vacinas.aplicar.hora') }}</label>
            <InputMask
              id="apl-hora"
              v-model="proximaHora"
              mask="99:99"
              :auto-clear="false"
              :disabled="salvando"
            />
          </section>
        </template>
      </template>

      <!-- A idade mínima: a API perguntou; a decisão é do veterinário. -->
      <div v-if="idadeMinima" class="apl__idade" role="alert">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>{{ t('vacinas.aplicar.idadeMinima', { data: idadeMinima }) }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('vacinas.aplicar.mesmoAssim')"
          :loading="salvando"
          @click="aplicar(true)"
        />
      </div>

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
        form="aplicar-vacina"
        icon="ph ph-syringe"
        :label="t('vacinas.aplicar.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.apl__confirmar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}

.apl__lotes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.apl__lotes li {
  display: grid;
  gap: 2px;
}

.apl__lotes small {
  color: var(--tinta-2);
  font-size: 12px;
}

.apl__chave {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  cursor: pointer;
}

.apl__idade {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  color: var(--atencao-tinta);
  font-size: 13.5px;
}
</style>
