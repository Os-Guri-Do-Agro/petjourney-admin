<script setup lang="ts">
/**
 * Editar a reserva (E7-02a, guia e7 16): datas, horas, acomodação, serviços e observação, com a
 * `versao` que a tela abriu e só o que mudou. Mudar datas, baia ou serviços recalcula (o serviço
 * que já estava fica com o preço da venda): antes de salvar, a simulação com `reservaId` mostra a
 * diferença. Com o hóspede na casa só a saída, os serviços e a observação mudam (a troca de baia
 * do hospedado é outra rota). Se outra pessoa salvou no meio (`RESERVA_ALTERADA`), a tela relê.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputMask from 'primevue/inputmask'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { CasaDoHotel, KindDeServico } from '@/service/parceiro/hotel-casa-service'
import {
  editarReserva,
  lerMapa,
  OBSERVACAO_MAX,
  QUANTIDADE_MAX,
  SERVICOS_MAX,
  simularReserva,
  type ReservaDetalhe,
  type Simulacao,
  type VagaDoMapa,
} from '@/service/parceiro/hotel-reservas-service'

import { useRotulosDasReservas } from './useRotulosDasReservas'

const props = defineProps<{ reserva: ReservaDetalhe; casa: CasaDoHotel }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [recado: string]; alterado: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()
const veDinheiro = computed(() => store.temPermissao('hotel.valores'))

const hospedado = computed(() => props.reserva.status === 'HOSPEDADO')

const deData = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a!, m! - 1, d!)
}
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const periodo = ref<Date[] | null>(null)
const entradaHora = ref('')
const saidaHora = ref('')
const acomodacaoId = ref<string | null>(null)
const servicos = ref<{ servico: KindDeServico | null; quantidade: number | null }[]>([])
const observacao = ref('')
const vagas = ref<VagaDoMapa[]>([])
const simulacao = ref<Simulacao | null>(null)
const erroDaSimulacao = ref('')
const salvando = ref(false)
const erro = ref('')

const original = computed(() => ({
  entradaData: props.reserva.entradaPrevista.slice(0, 10),
  entradaHora: props.reserva.entradaPrevista.slice(11, 16),
  saidaData: props.reserva.saidaPrevista.slice(0, 10),
  saidaHora: props.reserva.saidaPrevista.slice(11, 16),
  acomodacaoId: props.reserva.acomodacaoId,
  servicos: JSON.stringify(
    props.reserva.servicos.map((s) => ({ servico: s.servico, quantidade: s.quantidade })),
  ),
  observacao: props.reserva.observacao ?? '',
}))

watch(aberta, (agora) => {
  if (!agora) return
  periodo.value = [deData(props.reserva.entradaPrevista), deData(props.reserva.saidaPrevista)]
  entradaHora.value = original.value.entradaHora
  saidaHora.value = original.value.saidaHora
  acomodacaoId.value = props.reserva.acomodacaoId
  servicos.value = props.reserva.servicos.map((s) => ({
    servico: s.servico,
    quantidade: s.quantidade,
  }))
  observacao.value = props.reserva.observacao ?? ''
  simulacao.value = null
  erroDaSimulacao.value = ''
  erro.value = ''
})

const entradaData = computed(() => (periodo.value?.[0] ? iso(periodo.value[0]) : null))
const saidaData = computed(() => (periodo.value?.[1] ? iso(periodo.value[1]) : null))
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const horaOk = (valor: string) => HORA.test(valor)

/* O mapa do período novo; a baia desta reserva continua escolhível. */
watch(
  () => (aberta.value && !hospedado.value ? [entradaData.value, saidaData.value] : null),
  async (par) => {
    if (!par || !par[0] || !par[1]) return
    try {
      const mapa = await lerMapa(
        {
          entradaData: par[0],
          saidaData: par[1],
          pacienteId: props.reserva.pacienteId,
          ocupantes: props.reserva.acompanhantePacienteId ? 2 : 1,
        },
        parceiroQuery(),
      )
      vagas.value = mapa.vagas
    } catch {
      vagas.value = []
    }
  },
)

const nomeDoBloco = computed(() => new Map(props.casa.blocos.map((b) => [b.id, b.nome])))
const opcoesDeVaga = computed(() => {
  const grupos = new Map<
    string,
    { rotulo: string; itens: { valor: string; rotulo: string; impedida: boolean }[] }
  >()
  const lista = vagas.value.length
    ? vagas.value
    : [
        {
          acomodacaoId: props.reserva.acomodacaoId,
          nome: props.reserva.acomodacao.nome,
          blocoId: '',
          impedimentos: [],
        } as unknown as VagaDoMapa,
      ]
  for (const v of lista) {
    const minha = v.acomodacaoId === props.reserva.acomodacaoId
    const impedida = !minha && v.impedimentos.length > 0
    const grupo = grupos.get(v.blocoId) ?? {
      rotulo: nomeDoBloco.value.get(v.blocoId) ?? props.reserva.acomodacao.blocoNome,
      itens: [],
    }
    grupo.itens.push({
      valor: v.acomodacaoId,
      rotulo: impedida
        ? `${v.nome} · ${v.impedimentos.map(rotulos.impedimento).join(', ')}`
        : v.nome,
      impedida,
    })
    grupos.set(v.blocoId, grupo)
  }
  return [...grupos.values()]
})

const opcoesDeServico = computed(() =>
  props.casa.servicos
    .filter((s) => s.ativo || props.reserva.servicos.some((r) => r.servico === s.kind))
    .map((s) => ({ valor: s.kind, rotulo: rotulos.servico(s.kind) })),
)
const servicosDoCorpo = computed(() =>
  servicos.value
    .filter((s) => s.servico && s.quantidade)
    .map((s) => ({ servico: s.servico!, quantidade: s.quantidade! })),
)

/** Só o que mudou, com a versão aberta. */
const mudancas = computed(() => {
  if (
    !entradaData.value ||
    !saidaData.value ||
    !horaOk(entradaHora.value) ||
    !horaOk(saidaHora.value)
  )
    return null
  const o = original.value
  return {
    ...(!hospedado.value && entradaData.value !== o.entradaData
      ? { entradaData: entradaData.value }
      : {}),
    ...(!hospedado.value && entradaHora.value !== o.entradaHora
      ? { entradaHora: entradaHora.value }
      : {}),
    ...(saidaData.value !== o.saidaData ? { saidaData: saidaData.value } : {}),
    ...(saidaHora.value !== o.saidaHora ? { saidaHora: saidaHora.value } : {}),
    ...(!hospedado.value && acomodacaoId.value && acomodacaoId.value !== o.acomodacaoId
      ? { acomodacaoId: acomodacaoId.value }
      : {}),
    ...(JSON.stringify(servicosDoCorpo.value) !== o.servicos
      ? { servicos: servicosDoCorpo.value }
      : {}),
    ...(observacao.value.trim() !== o.observacao
      ? { observacao: observacao.value.trim() || null }
      : {}),
  }
})
const mudouPreco = computed(() =>
  Boolean(mudancas.value && Object.keys(mudancas.value).some((k) => k !== 'observacao')),
)

/* A diferença antes de salvar: a simulação da edição. */
let espera: ReturnType<typeof setTimeout> | null = null
let rodada = 0
watch(
  () => (aberta.value && mudouPreco.value ? JSON.stringify(mudancas.value) : null),
  (chave) => {
    if (espera) clearTimeout(espera)
    simulacao.value = null
    if (!chave || !entradaData.value || !saidaData.value || !acomodacaoId.value) return
    espera = setTimeout(async () => {
      const minha = ++rodada
      try {
        const resposta = await simularReserva(
          {
            reservaId: props.reserva.id,
            pacienteId: props.reserva.pacienteId,
            ...(props.reserva.acompanhantePacienteId
              ? { acompanhantePacienteId: props.reserva.acompanhantePacienteId }
              : {}),
            acomodacaoId: acomodacaoId.value!,
            entradaData: entradaData.value!,
            saidaData: saidaData.value!,
            entradaHora: entradaHora.value,
            saidaHora: saidaHora.value,
            servicos: servicosDoCorpo.value,
          },
          parceiroQuery(),
        )
        if (minha === rodada) {
          simulacao.value = resposta
          erroDaSimulacao.value = ''
        }
      } catch (err) {
        if (minha === rodada)
          erroDaSimulacao.value = lerErroDoCadastro(
            err,
            t('reservasDoHotel.nova.erroSimular'),
          ).mensagem
      }
    }, 400)
  },
)
onBeforeUnmount(() => {
  if (espera) clearTimeout(espera)
})

async function salvar() {
  erro.value = ''
  if (!mudancas.value || !Object.keys(mudancas.value).length) {
    aberta.value = false
    return
  }
  salvando.value = true
  try {
    const feita = await editarReserva(
      props.reserva.id,
      { versao: props.reserva.versao, ...mudancas.value },
      parceiroQuery(),
    )
    aberta.value = false
    emit(
      'salvo',
      feita.reprecificada && feita.diferenca && veDinheiro.value
        ? t('reservasDoHotel.editar.reprecificada', {
            antes: rotulos.dinheiro(feita.diferenca.antesCentavos),
            depois: rotulos.dinheiro(feita.diferenca.depoisCentavos),
          })
        : t('reservasDoHotel.editar.salva'),
    )
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    erro.value = lido.mensagem
    if (lido.codigo === 'RESERVA_ALTERADA') emit('alterado')
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('reservasDoHotel.editar.titulo')"
    icone="ph ph-pencil-simple"
    largura="40rem"
  >
    <form id="editar-reserva" class="eg" novalidate @submit.prevent="salvar">
      <p v-if="hospedado" class="eg__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('reservasDoHotel.editar.soSaida') }}</span>
      </p>
      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('reservasDoHotel.nova.quando') }}</h3>
        <DatePicker
          v-model="periodo"
          selection-mode="range"
          inline
          :aria-label="t('reservasDoHotel.nova.quando')"
          :disabled="salvando"
        />
        <div class="eg__linha">
          <div class="eg__secao">
            <label class="eg__rotulo" for="er-entrada">{{
              t('reservasDoHotel.nova.entradaHora')
            }}</label>
            <InputMask
              id="er-entrada"
              v-model="entradaHora"
              mask="99:99"
              :invalid="!horaOk(entradaHora)"
              :disabled="salvando || hospedado"
            />
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="er-saida">{{
              t('reservasDoHotel.nova.saidaHora')
            }}</label>
            <InputMask
              id="er-saida"
              v-model="saidaHora"
              mask="99:99"
              :invalid="!horaOk(saidaHora)"
              :disabled="salvando"
            />
          </div>
        </div>
      </section>

      <section v-if="!hospedado" class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('reservasDoHotel.nova.onde') }}</h3>
        <Select
          v-model="acomodacaoId"
          :options="opcoesDeVaga"
          option-label="rotulo"
          option-value="valor"
          option-group-label="rotulo"
          option-group-children="itens"
          option-disabled="impedida"
          :aria-label="t('reservasDoHotel.nova.onde')"
          :disabled="salvando"
        />
      </section>

      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('reservasDoHotel.nova.servicos') }}</h3>
        <div v-for="(s, i) in servicos" :key="i" class="er__servico">
          <Select
            v-model="s.servico"
            :options="opcoesDeServico"
            option-label="rotulo"
            option-value="valor"
            :aria-label="t('reservasDoHotel.nova.servico')"
            :disabled="salvando"
          />
          <InputNumber
            v-model="s.quantidade"
            :min="1"
            :max="QUANTIDADE_MAX"
            show-buttons
            :aria-label="t('reservasDoHotel.nova.quantidade')"
            :disabled="salvando"
          />
          <Button
            type="button"
            icon="ph ph-x"
            severity="secondary"
            outlined
            rounded
            size="small"
            :aria-label="t('reservasDoHotel.nova.tirarServico')"
            :disabled="salvando"
            @click="servicos.splice(i, 1)"
          />
        </div>
        <Button
          v-if="opcoesDeServico.length"
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-plus"
          :label="t('reservasDoHotel.nova.acrescentarServico')"
          :disabled="salvando || servicos.length >= SERVICOS_MAX"
          class="er__mais"
          @click="servicos.push({ servico: null, quantidade: 1 })"
        />
      </section>

      <div class="eg__secao">
        <label class="eg__rotulo" for="er-obs">
          {{ t('reservasDoHotel.nova.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="er-obs"
          v-model="observacao"
          rows="2"
          auto-resize
          :maxlength="OBSERVACAO_MAX"
          :disabled="salvando"
        />
      </div>

      <section v-if="simulacao || erroDaSimulacao" class="eg__grupo er__previa" aria-live="polite">
        <p v-if="erroDaSimulacao" class="eg__aviso">
          <i class="ph ph-warning" aria-hidden="true" />
          <span>{{ erroDaSimulacao }}</span>
        </p>
        <template v-else-if="simulacao">
          <p class="er__resumo">
            <i class="ph ph-receipt" aria-hidden="true" />
            <span>{{
              [
                rotulos.diarias(simulacao.diarias),
                veDinheiro && simulacao.diferenca
                  ? t('reservasDoHotel.editar.diferenca', {
                      antes: rotulos.dinheiro(simulacao.diferenca.antesCentavos),
                      depois: rotulos.dinheiro(simulacao.diferenca.depoisCentavos),
                    })
                  : '',
              ]
                .filter(Boolean)
                .join(' · ')
            }}</span>
          </p>
          <p v-if="!simulacao.disponivel" class="eg__aviso">
            <i class="ph ph-warning" aria-hidden="true" />
            <span>{{
              t('reservasDoHotel.nova.indisponivel', {
                motivos: simulacao.impedimentos.map(rotulos.impedimento).join(', '),
              })
            }}</span>
          </p>
        </template>
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
        form="editar-reserva"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.er__servico {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 8rem auto;
  align-items: center;
  gap: 10px;
}

.er__mais {
  justify-self: start;
}

.er__previa {
  padding-top: 16px;
  border-top: 1px solid var(--linha);
}

.er__resumo {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.er__resumo i {
  margin-top: 3px;
  color: var(--tinta-2);
}
</style>
