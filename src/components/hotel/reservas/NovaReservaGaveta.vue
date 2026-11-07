<script setup lang="ts">
/**
 * Uma reserva nova no balcão (E7-02a, guia e7 14 a 17): o hóspede (e o acompanhante, da mesma
 * casa), o período no calendário (horas opcionais: faltando, valem as da política), a acomodação
 * escolhida no mapa daquele período para aquele animal (as impedidas aparecem com o porquê), os
 * serviços, a origem e a observação.
 *
 * O orçamento é sempre o do servidor: a simulação roda a cada mudança (debounce) e mostra as
 * diárias, o total e o sinal (para quem vê dinheiro) e se o animal já está hospedado no período.
 * Criar manda `Idempotency-Key`; vinda da lista de espera, leva o `esperaId`.
 */
import AutoComplete from 'primevue/autocomplete'
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
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import type { CasaDoHotel, KindDeServico } from '@/service/parceiro/hotel-casa-service'
import {
  criarReserva,
  lerMapa,
  OBSERVACAO_MAX,
  ORIGENS_DO_BALCAO,
  QUANTIDADE_MAX,
  SERVICOS_MAX,
  simularReserva,
  type OrigemDoBalcao,
  type Reserva,
  type Simulacao,
  type VagaDoMapa,
} from '@/service/parceiro/hotel-reservas-service'
import { listarPacientes, type PacienteNaLista } from '@/service/parceiro/pacientes-service'

import { useRotulosDasReservas } from './useRotulosDasReservas'

/** O que a lista de espera traz para a reserva nascer preenchida. */
export type InicioDaReserva = {
  esperaId: string
  paciente: { id: string; nome: string }
  entrada: string
  saida: string
}

const props = defineProps<{ casa: CasaDoHotel; inicio: InicioDaReserva | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ criada: [reserva: Reserva] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()
const veDinheiro = computed(() => store.temPermissao('hotel.valores'))

type Hospede = Pick<PacienteNaLista, 'id' | 'nome'> & { cliente?: { id?: string; nome?: string } }

const paciente = ref<Hospede | string | null>(null)
const acompanhante = ref<Hospede | string | null>(null)
const sugestoes = ref<PacienteNaLista[]>([])
const periodo = ref<Date[] | null>(null)
const entradaHora = ref('')
const saidaHora = ref('')
const acomodacaoId = ref<string | null>(null)
const servicos = ref<{ servico: KindDeServico | null; quantidade: number | null }[]>([])
const origem = ref<OrigemDoBalcao>('BALCAO')
const observacao = ref('')
const vagas = ref<VagaDoMapa[]>([])
const carregandoMapa = ref(false)
const simulacao = ref<Simulacao | null>(null)
const erroDaSimulacao = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

const deData = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(a!, m! - 1, d!)
}
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hoje = new Date()

watch(aberta, (agora) => {
  if (!agora) return
  const inicio = props.inicio
  paciente.value = inicio ? { id: inicio.paciente.id, nome: inicio.paciente.nome } : null
  acompanhante.value = null
  periodo.value = inicio ? [deData(inicio.entrada), deData(inicio.saida)] : null
  entradaHora.value = ''
  saidaHora.value = ''
  acomodacaoId.value = null
  servicos.value = []
  origem.value = 'BALCAO'
  observacao.value = ''
  vagas.value = []
  simulacao.value = null
  erroDaSimulacao.value = ''
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

async function buscar(evento: { query: string }) {
  try {
    const pagina = await listarPacientes({ q: evento.query, limit: 10 }, parceiroQuery())
    sugestoes.value = pagina.itens.filter((item) => item.ativo)
  } catch {
    sugestoes.value = []
  }
}

/** O acompanhante é da mesma casa: só os animais do mesmo responsável. */
async function buscarAcompanhante(evento: { query: string }) {
  await buscar(evento)
  const dono = hospede.value?.cliente?.id
  sugestoes.value = sugestoes.value.filter(
    (item) => item.id !== hospede.value?.id && (!dono || item.cliente.id === dono),
  )
}

const rotuloDoPaciente = (item: Hospede) =>
  item.cliente?.nome ? `${item.nome} · ${item.cliente.nome}` : item.nome

const hospede = computed(() =>
  paciente.value && typeof paciente.value === 'object' ? paciente.value : null,
)
const segundo = computed(() =>
  acompanhante.value && typeof acompanhante.value === 'object' ? acompanhante.value : null,
)
const entradaData = computed(() => (periodo.value?.[0] ? iso(periodo.value[0]) : null))
const saidaData = computed(() => (periodo.value?.[1] ? iso(periodo.value[1]) : null))
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const horaOk = (valor: string) => !valor || HORA.test(valor)

/* ------------------------------------------------------------------------------- o mapa */

watch(
  () => [hospede.value?.id, segundo.value?.id, entradaData.value, saidaData.value],
  async () => {
    vagas.value = []
    if (!hospede.value || !entradaData.value || !saidaData.value) return
    carregandoMapa.value = true
    try {
      const mapa = await lerMapa(
        {
          entradaData: entradaData.value,
          saidaData: saidaData.value,
          pacienteId: hospede.value.id,
          ocupantes: segundo.value ? 2 : 1,
        },
        parceiroQuery(),
      )
      vagas.value = mapa.vagas
      if (
        acomodacaoId.value &&
        !vagas.value.some((v) => v.acomodacaoId === acomodacaoId.value && !v.impedimentos.length)
      )
        acomodacaoId.value = null
    } catch (err) {
      erroDaSimulacao.value = lerErroDoCadastro(err, t('reservasDoHotel.nova.erroMapa')).mensagem
    } finally {
      carregandoMapa.value = false
    }
  },
)

const nomeDoBloco = computed(() => new Map(props.casa.blocos.map((b) => [b.id, b.nome])))
const opcoesDeVaga = computed(() => {
  const grupos = new Map<
    string,
    { rotulo: string; itens: { valor: string; rotulo: string; impedida: boolean }[] }
  >()
  for (const v of vagas.value) {
    const grupo = grupos.get(v.blocoId) ?? {
      rotulo: nomeDoBloco.value.get(v.blocoId) ?? '',
      itens: [],
    }
    grupo.itens.push({
      valor: v.acomodacaoId,
      rotulo: v.impedimentos.length
        ? `${v.nome} · ${v.impedimentos.map(rotulos.impedimento).join(', ')}`
        : v.nome,
      impedida: v.impedimentos.length > 0,
    })
    grupos.set(v.blocoId, grupo)
  }
  return [...grupos.values()]
})
const livres = computed(() => vagas.value.filter((v) => !v.impedimentos.length).length)

/* ------------------------------------------------------------------------- os serviços */

const ativos = computed(() => props.casa.servicos.filter((s) => s.ativo))
const opcoesDeServico = computed(() =>
  ativos.value.map((s) => ({ valor: s.kind, rotulo: rotulos.servico(s.kind) })),
)
function acrescentarServico() {
  if (servicos.value.length < SERVICOS_MAX) servicos.value.push({ servico: null, quantidade: 1 })
}

const servicosDoCorpo = computed(() =>
  servicos.value
    .filter((s) => s.servico && s.quantidade)
    .map((s) => ({ servico: s.servico!, quantidade: s.quantidade! })),
)

/* ------------------------------------------------------------------------- a simulação */

const base = computed(() => {
  if (!hospede.value || !entradaData.value || !saidaData.value || !acomodacaoId.value) return null
  if (!horaOk(entradaHora.value) || !horaOk(saidaHora.value)) return null
  return {
    pacienteId: hospede.value.id,
    ...(segundo.value ? { acompanhantePacienteId: segundo.value.id } : {}),
    acomodacaoId: acomodacaoId.value,
    entradaData: entradaData.value,
    saidaData: saidaData.value,
    ...(entradaHora.value ? { entradaHora: entradaHora.value } : {}),
    ...(saidaHora.value ? { saidaHora: saidaHora.value } : {}),
    ...(servicosDoCorpo.value.length ? { servicos: servicosDoCorpo.value } : {}),
  }
})

let espera: ReturnType<typeof setTimeout> | null = null
let rodada = 0
watch(
  () => (aberta.value && base.value ? JSON.stringify(base.value) : null),
  (chave) => {
    if (espera) clearTimeout(espera)
    simulacao.value = null
    if (!chave) return
    espera = setTimeout(async () => {
      const minha = ++rodada
      try {
        const resposta = await simularReserva(base.value!, parceiroQuery())
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

/* ------------------------------------------------------------------------------- criar */

const opcoesDeOrigem = computed(() =>
  ORIGENS_DO_BALCAO.map((valor) => ({ valor, rotulo: rotulos.origem(valor) })),
)

async function criar() {
  tentou.value = true
  erro.value = ''
  if (!base.value) return
  const corpo = {
    ...base.value,
    origem: origem.value,
    ...(observacao.value.trim() ? { observacao: observacao.value.trim() } : {}),
    ...(props.inicio ? { esperaId: props.inicio.esperaId } : {}),
  }
  salvando.value = true
  try {
    const reserva = await criarReserva(corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('criada', reserva)
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
    :titulo="t('reservasDoHotel.nova.titulo')"
    icone="ph ph-calendar-plus"
    largura="40rem"
  >
    <form id="nova-reserva" class="eg" novalidate @submit.prevent="criar">
      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('reservasDoHotel.nova.quem') }}</h3>
        <div class="eg__secao">
          <label class="eg__rotulo" for="nr-hospede">{{ t('reservasDoHotel.nova.hospede') }}</label>
          <AutoComplete
            v-model="paciente"
            input-id="nr-hospede"
            :suggestions="sugestoes"
            :option-label="rotuloDoPaciente"
            :placeholder="t('fila.buscarPaciente')"
            :invalid="tentou && !hospede"
            :disabled="salvando || Boolean(inicio)"
            force-selection
            @complete="buscar"
          />
        </div>
        <div class="eg__secao">
          <label class="eg__rotulo" for="nr-acompanhante">
            {{ t('reservasDoHotel.nova.acompanhante') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <AutoComplete
            v-model="acompanhante"
            input-id="nr-acompanhante"
            :suggestions="sugestoes"
            :option-label="rotuloDoPaciente"
            :placeholder="t('fila.buscarPaciente')"
            :disabled="salvando || !hospede"
            force-selection
            @complete="buscarAcompanhante"
          />
          <small class="eg__dica">{{ t('reservasDoHotel.nova.acompanhanteDica') }}</small>
        </div>
      </section>

      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('reservasDoHotel.nova.quando') }}</h3>
        <DatePicker
          v-model="periodo"
          selection-mode="range"
          inline
          :min-date="hoje"
          :aria-label="t('reservasDoHotel.nova.quando')"
          :invalid="tentou && !(entradaData && saidaData)"
          :disabled="salvando"
        />
        <div class="eg__linha">
          <div class="eg__secao">
            <label class="eg__rotulo" for="nr-entrada">{{
              t('reservasDoHotel.nova.entradaHora')
            }}</label>
            <InputMask
              id="nr-entrada"
              v-model="entradaHora"
              mask="99:99"
              :placeholder="casa.politica.horarioDeEntrada"
              :invalid="!horaOk(entradaHora)"
              :disabled="salvando"
            />
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="nr-saida">{{
              t('reservasDoHotel.nova.saidaHora')
            }}</label>
            <InputMask
              id="nr-saida"
              v-model="saidaHora"
              mask="99:99"
              :placeholder="casa.politica.horarioDeSaida"
              :invalid="!horaOk(saidaHora)"
              :disabled="salvando"
            />
          </div>
        </div>
        <small class="eg__dica">{{ t('reservasDoHotel.nova.horasDica') }}</small>
      </section>

      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('reservasDoHotel.nova.onde') }}</h3>
        <Select
          v-model="acomodacaoId"
          :options="opcoesDeVaga"
          option-label="rotulo"
          option-value="valor"
          option-group-label="rotulo"
          option-group-children="itens"
          option-disabled="impedida"
          :placeholder="
            !hospede || !entradaData || !saidaData
              ? t('reservasDoHotel.nova.antesDaVaga')
              : t('reservasDoHotel.nova.escolhaVaga')
          "
          :loading="carregandoMapa"
          :aria-label="t('reservasDoHotel.nova.onde')"
          :invalid="tentou && !acomodacaoId"
          :disabled="salvando || !vagas.length"
        />
        <small v-if="vagas.length" class="eg__dica">{{
          t('reservasDoHotel.nova.livres', { n: livres }, livres)
        }}</small>
      </section>

      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('reservasDoHotel.nova.servicos') }}</h3>
        <div v-for="(s, i) in servicos" :key="i" class="nr__servico">
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
          class="nr__mais"
          @click="acrescentarServico"
        />
        <small v-else class="eg__dica">{{ t('reservasDoHotel.nova.semServicos') }}</small>
      </section>

      <div class="eg__linha">
        <div class="eg__secao">
          <label class="eg__rotulo" for="nr-origem">{{ t('reservasDoHotel.nova.origem') }}</label>
          <Select
            v-model="origem"
            input-id="nr-origem"
            :options="opcoesDeOrigem"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </div>
      </div>
      <div class="eg__secao">
        <label class="eg__rotulo" for="nr-obs">
          {{ t('reservasDoHotel.nova.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="nr-obs"
          v-model="observacao"
          rows="2"
          auto-resize
          :maxlength="OBSERVACAO_MAX"
          :disabled="salvando"
        />
      </div>

      <section v-if="simulacao || erroDaSimulacao" class="eg__grupo nr__previa" aria-live="polite">
        <p v-if="erroDaSimulacao" class="eg__aviso">
          <i class="ph ph-warning" aria-hidden="true" />
          <span>{{ erroDaSimulacao }}</span>
        </p>
        <template v-else-if="simulacao">
          <p class="nr__resumo">
            <i class="ph ph-receipt" aria-hidden="true" />
            <span>{{
              [
                rotulos.periodo(simulacao.entrada, simulacao.saida),
                rotulos.diarias(simulacao.diarias),
                veDinheiro && simulacao.orcamento
                  ? t('reservasDoHotel.nova.total', {
                      total: rotulos.dinheiro(simulacao.orcamento.totalCentavos),
                      sinal: rotulos.dinheiro(simulacao.orcamento.sinalCentavos),
                    })
                  : '',
              ]
                .filter(Boolean)
                .join(' · ')
            }}</span>
          </p>
          <p v-if="simulacao.petJaHospedado" class="eg__aviso">
            <i class="ph ph-warning" aria-hidden="true" />
            <span>{{ t('reservasDoHotel.nova.jaHospedado') }}</span>
          </p>
          <p v-else-if="!simulacao.disponivel" class="eg__aviso">
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
        form="nova-reserva"
        icon="ph ph-check"
        :label="t('reservasDoHotel.nova.criar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.nr__servico {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 8rem auto;
  align-items: center;
  gap: 10px;
}

.nr__mais {
  justify-self: start;
}

.nr__previa {
  padding-top: 16px;
  border-top: 1px solid var(--linha);
}

.nr__resumo {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
}

.nr__resumo i {
  margin-top: 3px;
  color: var(--tinta-2);
}
</style>
