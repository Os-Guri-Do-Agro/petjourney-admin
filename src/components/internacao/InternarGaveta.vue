<script setup lang="ts">
/**
 * Internar pela API (E5-01, guia e5 3). O leito vem do ladrilho; a gaveta pede o paciente, o
 * motivo, a gravidade e o peso de entrada (a base das doses do plantão, que não muda o cadastro),
 * e deixa recolhido o resto: diagnóstico, veterinário responsável, entrada mais cedo, previsão de
 * alta e a observação interna.
 *
 * Dois avisos pedem confirmação e reenviam o mesmo corpo:
 * - leito incompatível (gato em leito comum, cão em leito felino): marcar e confirmar;
 * - peso divergente do cadastro: **redigitar** o peso (um "sim" confirmaria o 25 no lugar de 2,5).
 *
 * Internar exige o CRMV de quem interna (403 `CRMV_OBRIGATORIO`). O duplo toque leva a mesma
 * Idempotency-Key e devolve a mesma internação.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
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
  GRAVIDADES,
  instanteComOffset,
  internar,
  MOTIVO_DA_INTERNACAO_MAX,
  PESO_MAX,
  PESO_MIN,
  type AvisoDeLeito,
  type Gravidade,
  type Internacao,
  type KindDoLeito,
  type NovaInternacao,
} from '@/service/parceiro/internacao-service'
import { listarPacientes, type PacienteNaLista } from '@/service/parceiro/pacientes-service'
import { listarProfissionais, type Profissional } from '@/service/parceiro/profissionais-service'

const props = defineProps<{
  leito: { id: string; nome: string; kind: KindDoLeito } | null
  /** Os pacientes que já estão internados (somem da busca). */
  jaInternados: string[]
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ internado: [internacao: Internacao] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()
const selo = useSeloDeAssinatura()

/** Internar pede o CRMV conferido: o botão fica, com o que falta. */
const avisoDoSelo = computed(() =>
  selo.atoAguarda('INTERNAR') ? t(`internacao.selo.${selo.motivo.value ?? 'SEM_SELO'}`) : '',
)

/* O SelectButton não marca o valor nulo: "agora" e "eu" são palavras. */
const AGORA = 'AGORA'
const MAIS_CEDO = 'MAIS_CEDO'
const EU = 'EU'

const paciente = ref<PacienteNaLista | null>(null)
const sugestoes = ref<PacienteNaLista[]>([])
const motivo = ref('')
const gravidade = ref<Gravidade>('ESTAVEL')
const peso = ref<number | null>(null)
const diagnostico = ref('')
const responsavel = ref<string>(EU)
const entrada = ref<typeof AGORA | typeof MAIS_CEDO>(AGORA)
const entradaEm = ref<Date | null>(null)
const comPrevisao = ref(false)
const previsao = ref<Date | null>(null)
const observacao = ref('')
const maisAberto = ref(false)

const profissionais = ref<Profissional[]>([])
const avisos = ref<AvisoDeLeito[]>([])
const confirmoAvisos = ref(false)
const pesoDivergente = ref<{ ultimo: number; informado: number } | null>(null)
const pesoDeNovo = ref<number | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const erroNoResponsavel = ref(false)

watch(aberta, async (agora) => {
  if (!agora) return
  paciente.value = null
  motivo.value = ''
  gravidade.value = 'ESTAVEL'
  peso.value = null
  diagnostico.value = ''
  responsavel.value = EU
  entrada.value = AGORA
  entradaEm.value = null
  comPrevisao.value = false
  previsao.value = null
  observacao.value = ''
  maisAberto.value = false
  avisos.value = []
  confirmoAvisos.value = false
  pesoDivergente.value = null
  pesoDeNovo.value = null
  tentou.value = false
  erro.value = ''
  erroNoResponsavel.value = false
  chaveador.concluir()
  if (!profissionais.value.length) {
    profissionais.value = await listarProfissionais({ ...parceiroQuery(), ativo: true }).catch(
      () => [],
    )
  }
})

async function buscar(evento: { query: string }) {
  try {
    const pagina = await listarPacientes({ q: evento.query, limit: 10 }, parceiroQuery())
    sugestoes.value = pagina.itens.filter(
      (item) => item.ativo && !props.jaInternados.includes(item.id),
    )
  } catch {
    sugestoes.value = []
  }
}

function rotuloDoPaciente(item: PacienteNaLista) {
  return `${item.nome} · ${item.cliente.nome}`
}

const opcoesDeGravidade = computed(() =>
  GRAVIDADES.map((valor) => ({ valor, rotulo: t(`internacao.gravidade.${valor}`) })),
)
const opcoesDeEntrada = computed(() => [
  { valor: AGORA, rotulo: t('internacao.internar.agora') },
  { valor: MAIS_CEDO, rotulo: t('internacao.internar.maisCedo') },
])
/** Só veterinário com CRMV pode responder pelo caso. */
const opcoesDeResponsavel = computed(() => [
  { valor: EU, rotulo: t('internacao.internar.eu') },
  ...profissionais.value
    .filter((item) => item.conselho === 'CRMV' && item.registro)
    .map((item) => ({ valor: item.id, rotulo: item.nome })),
])

const agora = () => new Date()
const vinteQuatroHorasAtras = computed(() => new Date(Date.now() - 24 * 3600 * 1000))
const sessentaDias = computed(() => {
  const base = entradaEm.value ?? new Date()
  return new Date(base.getTime() + 60 * 24 * 3600 * 1000)
})

const pacienteValido = computed(() => Boolean(paciente.value && typeof paciente.value === 'object'))
const motivoValido = computed(() => motivo.value.trim().length > 0)
const pesoValido = computed(
  () => typeof peso.value === 'number' && peso.value >= PESO_MIN && peso.value <= PESO_MAX,
)
const entradaValida = computed(() => entrada.value === AGORA || Boolean(entradaEm.value))
const previsaoValida = computed(() => !comPrevisao.value || Boolean(previsao.value))

const pesoFormatado = (kg: number) =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }).format(kg)

function corpo(): NovaInternacao {
  return {
    pacienteId: paciente.value!.id,
    leitoId: props.leito!.id,
    motivo: motivo.value.trim(),
    gravidade: gravidade.value,
    pesoEntradaKg: peso.value!,
    ...(diagnostico.value.trim() ? { diagnosticoDeTrabalho: diagnostico.value.trim() } : {}),
    ...(responsavel.value !== EU ? { responsavelProfissionalId: responsavel.value } : {}),
    ...(entrada.value === MAIS_CEDO && entradaEm.value
      ? { entradaEm: instanteComOffset(entradaEm.value) }
      : {}),
    ...(comPrevisao.value && previsao.value
      ? { altaPrevistaEm: instanteComOffset(previsao.value) }
      : {}),
    ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
    ...(avisos.value.length && confirmoAvisos.value ? { confirmarAvisos: avisos.value } : {}),
    ...(pesoDivergente.value && pesoDeNovo.value !== null
      ? { confirmarPesoKg: pesoDeNovo.value }
      : {}),
  }
}

async function confirmar() {
  tentou.value = true
  erro.value = ''
  erroNoResponsavel.value = false
  if (
    !props.leito ||
    !pacienteValido.value ||
    !motivoValido.value ||
    !pesoValido.value ||
    !entradaValida.value ||
    !previsaoValida.value
  )
    return
  if (avisos.value.length && !confirmoAvisos.value) {
    erro.value = t('internacao.internar.confirmeAviso')
    return
  }
  if (pesoDivergente.value && pesoDeNovo.value === null) {
    erro.value = t('internacao.internar.redigiteOPeso')
    return
  }

  salvando.value = true
  const pedido = corpo()
  try {
    const criada = await internar(pedido, chaveador.para(pedido), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('internado', criada)
  } catch (err) {
    const recusa = motivoDaRecusa(err)
    if (recusa) {
      erro.value = t(`internacao.selo.${recusa}`)
      return
    }
    const lido = lerErroDoCadastro(err, t('internacao.internar.erro'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    if (lido.codigo === 'LEITO_INCOMPATIVEL' && Array.isArray(detalhes.avisos)) {
      avisos.value = detalhes.avisos as AvisoDeLeito[]
      confirmoAvisos.value = false
      return
    }
    if (lido.codigo === 'PESO_DIVERGENTE') {
      pesoDivergente.value = {
        ultimo: Number(detalhes.ultimoPesoKg) || 0,
        informado: Number(detalhes.informadoKg) || peso.value || 0,
      }
      pesoDeNovo.value = null
      return
    }
    if (lido.codigo === 'CRMV_OBRIGATORIO' && detalhes.campo === 'responsavelProfissionalId') {
      erroNoResponsavel.value = true
      maisAberto.value = true
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}

/* Trocar o peso apaga a confirmação antiga: ela vale só para o número confirmado. */
watch(peso, () => {
  pesoDivergente.value = null
  pesoDeNovo.value = null
})
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('internacao.internar.titulo', { leito: leito?.nome ?? '' })"
    icone="ph ph-bed"
    largura="36rem"
  >
    <form id="internar-form" class="eg" novalidate @submit.prevent="confirmar">
      <p v-if="leito" class="eg__dica">
        {{
          t('internacao.internar.noLeito', {
            leito: leito.nome,
            tipo: t(`internacao.kind.${leito.kind}`),
          })
        }}
      </p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="int-paciente">{{ t('internacao.paciente') }}</label>
        <AutoComplete
          v-model="paciente"
          input-id="int-paciente"
          :suggestions="sugestoes"
          :option-label="rotuloDoPaciente"
          :placeholder="t('fila.buscarPaciente')"
          :invalid="tentou && !pacienteValido"
          :disabled="salvando"
          force-selection
          @complete="buscar"
        />
        <small v-if="tentou && !pacienteValido" class="eg__invalido">{{
          t('fila.pacienteObrigatorio')
        }}</small>
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="int-motivo">{{ t('internacao.motivo') }}</label>
        <InputText
          id="int-motivo"
          v-model="motivo"
          :maxlength="MOTIVO_DA_INTERNACAO_MAX"
          :placeholder="t('internacao.internar.motivoExemplo')"
          :invalid="tentou && !motivoValido"
          :disabled="salvando"
        />
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <span id="int-gravidade" class="eg__rotulo">{{ t('internacao.gravidadeRotulo') }}</span>
          <SelectButton
            v-model="gravidade"
            :options="opcoesDeGravidade"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="int-gravidade"
            :disabled="salvando"
          />
        </section>
      </div>

      <section class="eg__secao">
        <label class="eg__rotulo" for="int-peso">{{ t('internacao.internar.peso') }}</label>
        <InputNumber
          v-model="peso"
          input-id="int-peso"
          :min-fraction-digits="0"
          :max-fraction-digits="2"
          :min="0"
          :max="PESO_MAX"
          suffix=" kg"
          :locale="locale"
          :invalid="tentou && !pesoValido"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('internacao.internar.pesoDica') }}</small>
      </section>

      <!-- O 409 do peso: redigitar, nunca só "sim". -->
      <section v-if="pesoDivergente" class="eg__secao int__confirmar">
        <p class="eg__aviso">
          <i class="ph ph-warning" aria-hidden="true" />
          <span>{{
            t('internacao.internar.pesoDivergente', {
              ultimo: pesoFormatado(pesoDivergente.ultimo),
              informado: pesoFormatado(pesoDivergente.informado),
            })
          }}</span>
        </p>
        <label class="eg__rotulo" for="int-peso-de-novo">{{
          t('internacao.internar.pesoDeNovo')
        }}</label>
        <InputNumber
          v-model="pesoDeNovo"
          input-id="int-peso-de-novo"
          :min-fraction-digits="0"
          :max-fraction-digits="2"
          :min="0"
          :max="PESO_MAX"
          suffix=" kg"
          :locale="locale"
          :disabled="salvando"
        />
      </section>

      <!-- O 409 do leito: gato em leito comum, cão em leito felino. -->
      <section v-if="avisos.length" class="eg__secao int__confirmar">
        <p v-for="aviso in avisos" :key="aviso" class="eg__aviso">
          <i class="ph ph-warning" aria-hidden="true" />
          <span>{{ t(`internacao.aviso.${aviso}`) }}</span>
        </p>
        <label class="int__marcar" for="int-aviso">
          <Checkbox v-model="confirmoAvisos" input-id="int-aviso" binary :disabled="salvando" />
          <span>{{ t('internacao.internar.confirmoAviso') }}</span>
        </label>
      </section>

      <Button
        type="button"
        class="int__mais"
        severity="secondary"
        outlined
        size="small"
        :icon="maisAberto ? 'ph ph-caret-up' : 'ph ph-caret-down'"
        :label="t('internacao.internar.mais')"
        :aria-expanded="maisAberto"
        aria-controls="int-mais"
        @click="maisAberto = !maisAberto"
      />

      <div v-show="maisAberto" id="int-mais" class="eg int__grupo">
        <section class="eg__secao">
          <label class="eg__rotulo" for="int-diagnostico">
            {{ t('internacao.diagnostico') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <InputText id="int-diagnostico" v-model="diagnostico" :disabled="salvando" />
        </section>

        <section class="eg__secao">
          <label class="eg__rotulo" for="int-responsavel">{{ t('internacao.responsavel') }}</label>
          <Select
            v-model="responsavel"
            input-id="int-responsavel"
            :options="opcoesDeResponsavel"
            option-label="rotulo"
            option-value="valor"
            :invalid="erroNoResponsavel"
            :disabled="salvando"
          />
        </section>

        <section class="eg__secao">
          <span id="int-entrada" class="eg__rotulo">{{ t('internacao.internar.entrada') }}</span>
          <SelectButton
            v-model="entrada"
            :options="opcoesDeEntrada"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="int-entrada"
            :disabled="salvando"
          />
          <DatePicker
            v-if="entrada === MAIS_CEDO"
            v-model="entradaEm"
            inline
            show-time
            hour-format="24"
            :step-minute="5"
            :min-date="vinteQuatroHorasAtras"
            :max-date="agora()"
            aria-labelledby="int-entrada"
            :invalid="tentou && !entradaValida"
            :disabled="salvando"
          />
          <small v-if="entrada === MAIS_CEDO" class="eg__dica">{{
            t('internacao.internar.entradaDica')
          }}</small>
        </section>

        <section class="eg__secao">
          <label class="int__marcar" for="int-com-previsao">
            <Checkbox
              v-model="comPrevisao"
              input-id="int-com-previsao"
              binary
              :disabled="salvando"
            />
            <span>{{ t('internacao.internar.comPrevisao') }}</span>
          </label>
          <DatePicker
            v-if="comPrevisao"
            v-model="previsao"
            inline
            show-time
            hour-format="24"
            :step-minute="15"
            :min-date="agora()"
            :max-date="sessentaDias"
            :aria-label="t('internacao.previsao')"
            :invalid="tentou && !previsaoValida"
            :disabled="salvando"
          />
        </section>

        <section class="eg__secao">
          <label class="eg__rotulo" for="int-observacao">
            {{ t('internacao.observacao') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <Textarea
            id="int-observacao"
            v-model="observacao"
            rows="2"
            auto-resize
            :disabled="salvando"
          />
          <small class="eg__dica">{{ t('internacao.observacaoDica') }}</small>
        </section>
      </div>

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
        form="internar-form"
        icon="ph ph-bed"
        :label="t('internacao.internar.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.int__confirmar {
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-controle);
  background: color-mix(in oklab, var(--atencao-fundo) 45%, transparent);
}

.int__marcar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
  cursor: pointer;
}

.int__mais {
  justify-self: start;
}

.int__grupo {
  padding-bottom: 0;
}
</style>
