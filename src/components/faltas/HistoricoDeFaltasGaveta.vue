<script setup lang="ts">
/**
 * As faltas de um responsável (guia e3 3.7), da mais recente: o dia, o paciente, o atendimento, em
 * que pé está, o registro que vale (cortado em 140 caracteres, com "ver tudo"), se voltou depois e
 * se ainda falta convidar. Escolher uma falta abre ela inteira na mesma gaveta, com o contato e o
 * reagendar (`FaltaDoHorario`).
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDaAgenda, useFrasesDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import FaltaDoHorario from '@/components/faltas/FaltaDoHorario.vue'
import { diaCurto } from '@/components/pedidos/leitura-do-pedido'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { historicoDeFaltas, type FaltaNoHistorico } from '@/service/parceiro/faltas-service'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'
import { useToast } from 'primevue/usetoast'

const props = defineProps<{
  cliente: { id: string; nome: string } | null
  fuso: string
  profissionais: { id: string; nome: string }[]
  podeEscrever: boolean
  podeObito: boolean
  hoje: string
}>()
const emit = defineEmits<{ mudou: [] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const toast = useToast()
const rotulos = useRotulosDoCadastro()
const frases = useFrasesDaAgenda()
const { parceiroQuery } = useParceiroPortal()

const itens = ref<FaltaNoHistorico[]>([])
const proximoCursor = ref<string | null>(null)
const carregando = ref(false)
const carregandoMais = ref(false)
const erro = ref('')
const aberta = ref<FaltaNoHistorico | null>(null)

const leitura = criarUltimaLeitura()

async function carregar() {
  const cliente = props.cliente
  if (!cliente) return
  const vez = leitura.nova()
  carregando.value = true
  erro.value = ''

  try {
    const historico = await historicoDeFaltas(cliente.id, {}, parceiroQuery())
    if (!leitura.valendo(vez)) return
    itens.value = historico.itens
    proximoCursor.value = historico.proximoCursor
    /* A falta aberta pega a versão relida (situação, registros, reagendada). */
    if (aberta.value) {
      aberta.value =
        historico.itens.find((item) => item.agendamentoId === aberta.value?.agendamentoId) ??
        aberta.value
    }
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDaAgenda(err, t('faltas.erroAoCarregar')).mensagem
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

async function carregarMais() {
  const cliente = props.cliente
  if (!cliente || !proximoCursor.value) return
  const vez = leitura.atual()
  carregandoMais.value = true
  try {
    const historico = await historicoDeFaltas(
      cliente.id,
      { cursor: proximoCursor.value },
      parceiroQuery(),
    )
    if (!leitura.valendo(vez)) return
    itens.value = [...itens.value, ...historico.itens]
    proximoCursor.value = historico.proximoCursor
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDaAgenda(err, t('faltas.erroAoCarregar')).mensagem
  } finally {
    carregandoMais.value = false
  }
}

watch(
  () => [visible.value, props.cliente?.id] as const,
  ([aberto]) => {
    if (!aberto) return
    aberta.value = null
    itens.value = []
    void carregar()
  },
)

/* ------------------------------------------------------------------------------- linha */

function quando(item: FaltaNoHistorico) {
  return `${diaCurto(item.inicio.slice(0, 10), rotulos.intl())} · ${item.inicio.slice(11, 16)}`
}

function registroQueVale(item: FaltaNoHistorico) {
  const vigente = item.vigente
  if (!vigente) return ''
  const canal = t(`faltas.canal.${vigente.canal}`)
  return vigente.motivo ? `${canal} · ${t(`faltas.motivo.${vigente.motivo}`)}` : canal
}

const ICONE_DA_SITUACAO = {
  PENDENTE: 'ph ph-phone-x',
  SEM_RESPOSTA: 'ph ph-phone-disconnect',
  JUSTIFICADA: 'ph ph-check-circle',
  ENCERRADA: 'ph ph-flower-lotus',
} as const

/* ------------------------------------------------------------------------------- abrir */

const horarioAberto = computed(() => {
  const item = aberta.value
  if (!item) return null
  return {
    agendamentoId: item.agendamentoId,
    pacienteId: item.paciente.id,
    pacienteNome: item.paciente.nome,
    inicio: item.inicio,
    profissionalId: item.profissional.id,
    tipoId: item.tipo.id,
  }
})

function justificado() {
  toast.add({ severity: 'success', summary: t('faltas.feito.contato'), life: 3000 })
  emit('mudou')
  void carregar()
}

function reagendado() {
  toast.add({ severity: 'success', summary: t('faltas.feito.reagendada'), life: 4000 })
  emit('mudou')
  void carregar()
}

const titulo = computed(() =>
  aberta.value
    ? t('faltas.historico.falta', {
        paciente: aberta.value.paciente.nome,
        dia: diaCurto(aberta.value.inicio.slice(0, 10), rotulos.intl()),
      })
    : t('faltas.historico.titulo', { nome: props.cliente?.nome ?? '' }),
)
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="titulo"
    icone="ph ph-user-minus"
    largura="34rem"
  >
    <!-- Uma falta inteira -->
    <template v-if="aberta && horarioAberto">
      <p class="hf__quando">
        <strong class="ui-num">{{ quando(aberta) }}</strong>
        <span>{{ aberta.tipo.nome }} · {{ aberta.profissional.nome }}</span>
      </p>
      <FaltaDoHorario
        :falta="horarioAberto"
        :fuso="fuso"
        :profissionais="profissionais"
        :pode-escrever="podeEscrever"
        :pode-obito="podeObito"
        :hoje="hoje"
        @justificado="justificado"
        @reagendado="reagendado"
      />
    </template>

    <!-- O histórico -->
    <template v-else>
      <div v-if="carregando && !itens.length" class="hf__esqueleto" aria-busy="true">
        <Skeleton v-for="n in 4" :key="n" height="3.25rem" />
      </div>

      <p v-else-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>

      <p v-else-if="!itens.length" class="eg__dica">{{ t('faltas.historico.vazio') }}</p>

      <ol v-else class="hf__lista">
        <li v-for="item in itens" :key="item.agendamentoId">
          <button type="button" class="hf__linha" @click="aberta = item">
            <span class="hf__topo">
              <strong class="ui-num">{{ quando(item) }}</strong>
              <span class="hf__situacao" :class="`hf__situacao--${item.situacao.toLowerCase()}`">
                <i :class="ICONE_DA_SITUACAO[item.situacao]" aria-hidden="true" />
                {{ t(`faltas.situacao.${item.situacao}`) }}
              </span>
            </span>
            <span class="hf__meta">
              <bdi>{{ item.paciente.nome }}</bdi> · {{ item.tipo.nome }} ·
              {{ item.profissional.nome }} · {{ frases.duracao(item.minutosPerdidos) }}
            </span>
            <span v-if="item.vigente" class="hf__vigente">
              <strong>{{ registroQueVale(item) }}</strong>
              <template v-if="item.vigente.observacao">
                : {{ item.vigente.observacao
                }}<template v-if="item.vigente.observacaoCortada">…</template>
              </template>
              <span v-if="item.vigente.observacaoCortada" class="hf__ver">{{
                t('faltas.historico.verTudo')
              }}</span>
            </span>
            <span v-if="item.voltouDepois || item.aConvidar || item.registros" class="hf__selos">
              <span v-if="item.voltouDepois" class="ui-selo ui-selo--ok">
                <i class="ph ph-calendar-check" aria-hidden="true" />
                {{
                  t('faltas.historico.voltou', {
                    dia: diaCurto(item.voltouDepois.inicio.slice(0, 10), rotulos.intl()),
                  })
                }}
              </span>
              <span v-else-if="item.aConvidar" class="ui-selo">{{
                t('faltas.selo.aConvidar')
              }}</span>
              <span v-if="item.registros" class="hf__registros">
                {{ t('faltas.historico.registros', { n: item.registros }, item.registros) }}
              </span>
            </span>
          </button>
        </li>
      </ol>

      <Button
        v-if="proximoCursor && itens.length"
        type="button"
        severity="secondary"
        outlined
        class="hf__mais"
        :label="t('faltas.verMais')"
        :loading="carregandoMais"
        @click="carregarMais"
      />
    </template>

    <template #pe>
      <Button
        v-if="aberta"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        :label="t('faltas.historico.voltar')"
        @click="aberta = null"
      />
      <Button
        v-else
        type="button"
        severity="secondary"
        outlined
        :label="t('agenda.config.expediente.fechar')"
        @click="visible = false"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.hf__esqueleto {
  display: grid;
  gap: 8px;
}

.hf__quando {
  display: grid;
  gap: 2px;
  margin: 0;
}

.hf__quando strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.hf__quando span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.hf__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.hf__lista li + li {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.hf__linha {
  display: grid;
  width: 100%;
  gap: 4px;
  padding: 12px 10px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition: background-color 150ms ease-out;
}

.hf__linha:hover {
  background: var(--app-toque, var(--superficie-2));
}

.hf__linha:focus-visible {
  outline: 2px solid var(--tinta);
  outline-offset: -2px;
}

.hf__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
  font-size: 14px;
}

.hf__topo strong {
  font-weight: 650;
}

.hf__situacao {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
}

.hf__situacao--pendente i,
.hf__situacao--sem_resposta i {
  color: var(--atencao-tinta);
}

.hf__situacao--justificada i {
  color: var(--ok-tinta);
}

.hf__meta,
.hf__registros {
  color: var(--tinta-2);
  font-size: 13px;
}

.hf__vigente {
  color: var(--tinta);
  font-size: 13.5px;
}

.hf__vigente strong {
  font-weight: 600;
}

.hf__ver {
  margin-inline-start: 6px;
  color: var(--tinta);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.hf__selos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.hf__mais {
  justify-self: center;
}

@media (prefers-reduced-motion: reduce) {
  .hf__linha {
    transition: none;
  }
}
</style>
