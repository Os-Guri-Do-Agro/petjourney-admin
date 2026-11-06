<script setup lang="ts">
/**
 * Marcar um horário (E3-02, guia e3 2.5 e 2.6): quem, o quê, com quem e quando.
 *
 * Enquanto a pessoa escolhe, o `simular` diz os avisos daquele horário e devolve as melhores
 * alternativas do mesmo dia com o mesmo profissional (nada impede: o aviso aparece, quem decide é
 * a recepção). "Sugerir horários" pede ao servidor os próximos horários sem aviso nenhum, só no
 * gesto (a rota tem teto por hora). Dia especial fechado (`holiday-closed`, o único que bloqueia)
 * pede o segundo passo e vai com `confirmarConflitos`.
 *
 * O clique duplo não cria dois horários: a mesma `Idempotency-Key` enquanto o corpo for o mesmo.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputMask from 'primevue/inputmask'
import InputNumber from 'primevue/inputnumber'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { ordenarConflitos } from '@/components/agendamentos/leitura-da-agenda'
import { lerErroDaAgenda, useFrasesDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { diaCurto } from '@/components/pedidos/leitura-do-pedido'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  diaLocal,
  DURACAO_MAX,
  DURACAO_MIN,
  DURACAO_PASSO,
  instanteNoFuso,
  type Sala,
  type TipoDeAtendimento,
} from '@/service/parceiro/agenda-config-service'
import {
  criarAgendamento,
  obterSugestoes,
  simularAgendamento,
  type Alternativa,
  type HorarioSugerido,
  type Mutacao,
  type NovoAgendamento,
  type Simulacao,
} from '@/service/parceiro/agenda-service'
import { listarPacientes } from '@/service/parceiro/pacientes-service'

export type PacienteEscolhido = { id: string; nome: string; responsavel: string }

export type InicioDaMarcacao = {
  data: string
  hora: string
  profissionalId: string | null
  salaId?: string | null
  paciente?: PacienteEscolhido | null
  tipoId?: string | null
  /** O retorno: a origem e as sugestões com quem atendeu, já ao abrir. */
  retorno?: boolean
}

const OBSERVACAO_MAX = 500
const ESPERA_DA_SIMULACAO_MS = 500

const props = defineProps<{
  inicio: InicioDaMarcacao
  fuso: string
  profissionais: { id: string; nome: string }[]
  salas: Sala[]
  tipos: TipoDeAtendimento[]
}>()
const emit = defineEmits<{ marcado: [mutacao: Mutacao] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const frases = useFrasesDaAgenda()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const paciente = ref<PacienteEscolhido | null>(null)
const sugestoesDePaciente = ref<PacienteEscolhido[]>([])
const tipoId = ref<string | null>(null)
const profissionalId = ref<string | null>(null)
const dia = ref(new Date())
const hora = ref('09:00')
const duracao = ref(30)
const salaIds = ref<string[]>([])
const origem = ref<'RECEPCAO' | 'TELEFONE' | 'RETORNO'>('RECEPCAO')
const encaixe = ref(false)
const observacao = ref('')

const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const mescladoEmId = ref<string | null>(null)
/** O dia especial fechado que pede o segundo passo (a frase do aviso). */
const bloqueante = ref<string | null>(null)

function dataDe(texto: string) {
  const [ano, mes, d] = texto.split('-').map(Number)
  return new Date(ano!, mes! - 1, d!)
}

watch(visible, (aberta) => {
  if (!aberta) {
    clearTimeout(espera)
    return
  }

  const inicio = props.inicio
  paciente.value = inicio.paciente ?? null
  tipoId.value = inicio.tipoId ?? null
  profissionalId.value = inicio.profissionalId
  dia.value = dataDe(inicio.data)
  hora.value = inicio.hora
  duracao.value = props.tipos.find((tipo) => tipo.id === inicio.tipoId)?.duracaoMinutos ?? 30
  salaIds.value = inicio.salaId ? [inicio.salaId] : []
  origem.value = inicio.retorno ? 'RETORNO' : 'RECEPCAO'
  encaixe.value = false
  observacao.value = ''
  tentou.value = false
  erro.value = ''
  mescladoEmId.value = null
  bloqueante.value = null
  simulacao.value = null
  sugestoes.value = null
  erroDasSugestoes.value = ''
  chaveador.concluir()

  if (inicio.retorno && paciente.value && tipoId.value) void sugerir()
})

/* ---------------------------------------------------------------------------- opções */

async function buscarPaciente(evento: { query: string }) {
  try {
    const pagina = await listarPacientes({ q: evento.query, limit: 10 }, parceiroQuery())
    sugestoesDePaciente.value = pagina.itens
      .filter((item) => item.ativo)
      .map((item) => ({ id: item.id, nome: item.nome, responsavel: item.cliente.nome }))
  } catch {
    sugestoesDePaciente.value = []
  }
}

function rotuloDoPaciente(item: PacienteEscolhido) {
  return `${item.nome} · ${item.responsavel}`
}

const tiposAtivos = computed(() => props.tipos.filter((tipo) => tipo.ativo))
const tipo = computed(() => props.tipos.find((item) => item.id === tipoId.value) ?? null)

const opcoesDeSala = computed(() =>
  props.salas.filter((sala) => sala.ativa).map((sala) => ({ valor: sala.id, rotulo: sala.nome })),
)

const opcoesDeOrigem = computed(() =>
  (['RECEPCAO', 'TELEFONE', 'RETORNO'] as const).map((valor) => ({
    valor,
    rotulo: t(`agendamentos.origem.${valor}`),
  })),
)

/** Trocar o tipo traz a duração dele. */
function trocarTipo(novo: string) {
  tipoId.value = novo
  const escolhido = props.tipos.find((item) => item.id === novo)
  if (escolhido) duracao.value = escolhido.duracaoMinutos
  if (escolhido && !escolhido.permiteEncaixe) encaixe.value = false
}

/* ------------------------------------------------------------------------------ corpo */

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

const problema = computed(() => {
  if (!paciente.value) return t('agendamentos.marcar.semPaciente')
  if (!tipoId.value) return t('agendamentos.marcar.semTipo')
  if (!profissionalId.value) return t('agendamentos.marcar.semProfissional')
  if (!HORA.test(hora.value)) return t('agendamentos.marcar.horaInvalida')
  if (duracao.value < DURACAO_MIN || duracao.value > DURACAO_MAX)
    return t('agendamentos.editar.duracaoInvalida')
  return ''
})

function corpo(confirmar = false): NovoAgendamento | null {
  if (problema.value || !paciente.value || !tipoId.value || !profissionalId.value) return null
  const texto = observacao.value.trim()
  return {
    pacienteId: paciente.value.id,
    profissionalId: profissionalId.value,
    tipoId: tipoId.value,
    inicio: instanteNoFuso(props.fuso, diaLocal(dia.value), hora.value),
    duracaoMinutos: duracao.value,
    ...(salaIds.value.length ? { salaIds: salaIds.value } : {}),
    origem: origem.value,
    ...(encaixe.value ? { encaixe: true } : {}),
    ...(texto ? { observacao: texto } : {}),
    ...(confirmar ? { confirmarConflitos: ['holiday-closed' as const] } : {}),
  }
}

/* --------------------------------------------------------------------------- simular */

const simulacao = ref<Simulacao | null>(null)
const simulando = ref(false)
let espera: ReturnType<typeof setTimeout> | undefined
let vezDaSimulacao = 0

const chaveDaSimulacao = computed(() => {
  const pronto = corpo()
  return pronto ? JSON.stringify(pronto) : ''
})

watch(chaveDaSimulacao, (chave) => {
  clearTimeout(espera)
  bloqueante.value = null
  if (!chave || !visible.value) {
    simulacao.value = null
    simulando.value = false
    return
  }
  /* Os avisos do horário anterior esmaecem até chegar a leitura do novo. */
  simulando.value = true
  espera = setTimeout(() => void simular(), ESPERA_DA_SIMULACAO_MS)
})

async function simular() {
  const pronto = corpo()
  if (!pronto) return
  const vez = ++vezDaSimulacao
  simulando.value = true

  try {
    const lida = await simularAgendamento(pronto, parceiroQuery())
    if (vez === vezDaSimulacao) simulacao.value = lida
  } catch {
    /* Sem a simulação, marca-se do mesmo jeito: os avisos vêm depois de gravar. */
    if (vez === vezDaSimulacao) simulacao.value = null
  } finally {
    if (vez === vezDaSimulacao) simulando.value = false
  }
}

onBeforeUnmount(() => clearTimeout(espera))

const avisosDoHorario = computed(() =>
  ordenarConflitos(simulacao.value?.pernas.flatMap((perna) => perna.conflitos) ?? []),
)

const alternativas = computed(() => simulacao.value?.alternativas ?? [])

function usarAlternativa(alternativa: Alternativa) {
  profissionalId.value = alternativa.profissionalId
  dia.value = dataDe(alternativa.inicio.slice(0, 10))
  hora.value = alternativa.inicio.slice(11, 16)
}

function avisaNaAlternativa(alternativa: Alternativa) {
  return alternativa.conflitos.some((conflito) => conflito.severity !== 'info')
}

/* -------------------------------------------------------------------------- sugestões */

const sugestoes = ref<{
  lista: HorarioSugerido[]
  interrompida: boolean
  limitados: boolean
} | null>(null)
const sugerindo = ref(false)
const erroDasSugestoes = ref('')

async function sugerir() {
  if (!paciente.value || !tipoId.value) {
    tentou.value = true
    return
  }
  sugerindo.value = true
  erroDasSugestoes.value = ''

  try {
    const lidas = await obterSugestoes(
      {
        pacienteId: paciente.value.id,
        tipoId: tipoId.value,
        profissionalId: profissionalId.value,
        aPartirDe: diaLocal(dia.value),
      },
      parceiroQuery(),
    )
    sugestoes.value = {
      lista: lidas.sugestoes,
      interrompida: lidas.buscaInterrompida,
      limitados: lidas.profissionaisLimitados,
    }
  } catch (err) {
    sugestoes.value = null
    erroDasSugestoes.value = lerErroDaAgenda(
      err,
      t('agendamentos.marcar.erroDasSugestoes'),
    ).mensagem
  } finally {
    sugerindo.value = false
  }
}

function usarSugestao(sugestao: HorarioSugerido) {
  profissionalId.value = sugestao.profissionalId
  dia.value = dataDe(sugestao.data)
  hora.value = sugestao.inicio.slice(11, 16)
}

function rotuloDaSugestao(sugestao: HorarioSugerido) {
  return `${diaCurto(sugestao.data, rotulos.intl())} · ${sugestao.inicio.slice(11, 16)}`
}

function escolhida(sugestao: HorarioSugerido) {
  return (
    sugestao.profissionalId === profissionalId.value &&
    sugestao.data === diaLocal(dia.value) &&
    sugestao.inicio.slice(11, 16) === hora.value
  )
}

/* ----------------------------------------------------------------------------- marcar */

async function marcar(confirmar = false) {
  tentou.value = true
  erro.value = ''
  mescladoEmId.value = null
  const pronto = corpo(confirmar)
  if (!pronto) return

  /* O dia fechado já apareceu na simulação: o primeiro clique só mostra o aviso. */
  if (!confirmar && simulacao.value?.bloqueante) {
    const fechado = avisosDoHorario.value.find((conflito) => conflito.severity === 'blocking')
    bloqueante.value = fechado ? frases.frase(fechado) : t('agendamentos.conflito.holiday-closed')
    return
  }

  salvando.value = true
  try {
    const mutacao = await criarAgendamento(pronto, chaveador.para(pronto), parceiroQuery())
    chaveador.concluir()
    emit('marcado', mutacao)
    visible.value = false
  } catch (err) {
    const lido = lerErroDaAgenda(err, t('agendamentos.erros.salvar'))
    if (lido.codigo === 'CONFLITO_BLOQUEANTE') {
      const fechado = lido.conflitos.find((conflito) => conflito.severity === 'blocking')
      bloqueante.value = fechado ? frases.frase(fechado) : lido.mensagem
    } else {
      erro.value = lido.mensagem
      mescladoEmId.value = lido.codigo === 'PACIENTE_INATIVO' ? lido.mescladoEmId : null
    }
  } finally {
    salvando.value = false
  }
}

const nomeDoProfissional = (id: string) =>
  props.profissionais.find((item) => item.id === id)?.nome ?? ''
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="
      inicio.retorno ? t('agendamentos.marcar.tituloRetorno') : t('agendamentos.marcar.titulo')
    "
    icone="ph ph-calendar-plus"
    largura="34rem"
  >
    <form id="marcar-form" class="eg" novalidate @submit.prevent="marcar()">
      <section class="eg__secao">
        <label class="eg__rotulo" for="marcar-paciente">{{
          t('agendamentos.marcar.paciente')
        }}</label>
        <AutoComplete
          v-model="paciente"
          input-id="marcar-paciente"
          :suggestions="sugestoesDePaciente"
          :option-label="rotuloDoPaciente"
          :placeholder="t('agendamentos.marcar.buscarPaciente')"
          :invalid="tentou && !paciente"
          :disabled="salvando"
          force-selection
          @complete="buscarPaciente"
        />
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="marcar-tipo">{{ t('agendamentos.detalhe.tipo') }}</label>
          <Select
            :model-value="tipoId"
            input-id="marcar-tipo"
            :options="tiposAtivos"
            option-label="nome"
            option-value="id"
            :placeholder="t('agendamentos.marcar.escolha')"
            :invalid="tentou && !tipoId"
            :disabled="salvando"
            @update:model-value="trocarTipo"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="marcar-profissional">{{
            t('agendamentos.detalhe.profissional')
          }}</label>
          <Select
            v-model="profissionalId"
            input-id="marcar-profissional"
            :options="profissionais"
            option-label="nome"
            option-value="id"
            :placeholder="t('agendamentos.marcar.escolha')"
            :invalid="tentou && !profissionalId"
            :disabled="salvando"
          />
        </section>
      </div>

      <section class="eg__secao">
        <span id="marcar-dia" class="eg__rotulo">{{ t('agendamentos.marcar.dia') }}</span>
        <DatePicker
          v-model="dia"
          inline
          aria-labelledby="marcar-dia"
          class="mg__calendario"
          :disabled="salvando"
        />
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="marcar-hora">{{ t('agendamentos.marcar.hora') }}</label>
          <InputMask
            id="marcar-hora"
            v-model="hora"
            mask="99:99"
            :auto-clear="false"
            :invalid="tentou && !HORA.test(hora)"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="marcar-duracao">{{
            t('agendamentos.marcar.duracao')
          }}</label>
          <InputNumber
            v-model="duracao"
            input-id="marcar-duracao"
            :min="DURACAO_MIN"
            :max="DURACAO_MAX"
            :step="DURACAO_PASSO"
            :suffix="` ${t('agendamentos.duracao.sufixo')}`"
            show-buttons
            :disabled="salvando"
          />
        </section>
      </div>

      <!-- O que o servidor diz deste horário. -->
      <section
        v-if="chaveDaSimulacao"
        class="eg__secao mg__simulacao"
        :class="{ 'mg__simulacao--lendo': simulando && simulacao }"
        :aria-busy="simulando"
        aria-live="polite"
      >
        <span class="eg__rotulo">{{ t('agendamentos.marcar.nesteHorario') }}</span>
        <Skeleton v-if="simulando && !simulacao" height="2rem" />
        <template v-else-if="simulacao">
          <p v-if="!avisosDoHorario.length" class="mg__livre">
            <i class="ph ph-check-circle" aria-hidden="true" />
            {{ t('agendamentos.marcar.semAviso') }}
          </p>
          <ul v-else class="mg__avisos">
            <li
              v-for="(aviso, indice) in avisosDoHorario"
              :key="`${aviso.kind}-${indice}`"
              :class="`mg__aviso--${aviso.severity}`"
            >
              <i
                :class="
                  aviso.severity === 'blocking'
                    ? 'ph ph-prohibit'
                    : aviso.severity === 'warning'
                      ? 'ph ph-warning'
                      : 'ph ph-info'
                "
                aria-hidden="true"
              />
              <span>{{ frases.frase(aviso) }}</span>
            </li>
          </ul>

          <div v-if="avisosDoHorario.length && alternativas.length" class="mg__alternativas">
            <span class="mg__subrotulo">
              {{
                t('agendamentos.marcar.alternativas', {
                  nome: nomeDoProfissional(alternativas[0]!.profissionalId),
                })
              }}
            </span>
            <div class="mg__horarios">
              <Button
                v-for="alternativa in alternativas"
                :key="alternativa.inicio"
                type="button"
                size="small"
                severity="secondary"
                outlined
                class="ui-num"
                :icon="avisaNaAlternativa(alternativa) ? 'ph ph-warning' : undefined"
                :label="alternativa.inicio.slice(11, 16)"
                :aria-label="
                  avisaNaAlternativa(alternativa)
                    ? t('agendamentos.marcar.alternativaComAviso', {
                        hora: alternativa.inicio.slice(11, 16),
                      })
                    : alternativa.inicio.slice(11, 16)
                "
                :disabled="salvando"
                @click="usarAlternativa(alternativa)"
              />
            </div>
          </div>
        </template>

        <div v-if="bloqueante" class="mg__confirmar" role="alert">
          <p>
            <i class="ph ph-prohibit" aria-hidden="true" />
            <span>{{ bloqueante }}</span>
          </p>
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('agendamentos.marcar.mesmoAssim')"
            :loading="salvando"
            @click="marcar(true)"
          />
        </div>
      </section>

      <!-- Os próximos horários sem aviso, só quando a pessoa pede. -->
      <section class="eg__secao">
        <div class="mg__sugerir">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-magic-wand"
            :label="t('agendamentos.marcar.sugerir')"
            :loading="sugerindo"
            :disabled="salvando || !paciente || !tipoId"
            @click="sugerir"
          />
          <small v-if="!paciente || !tipoId" class="eg__dica">{{
            t('agendamentos.marcar.sugerirDica')
          }}</small>
        </div>
        <p v-if="erroDasSugestoes" class="eg__invalido">{{ erroDasSugestoes }}</p>
        <template v-else-if="sugestoes">
          <p v-if="!sugestoes.lista.length" class="eg__dica">
            {{ t('agendamentos.marcar.semSugestao') }}
          </p>
          <ul v-else class="mg__sugestoes">
            <li
              v-for="sugestao in sugestoes.lista"
              :key="`${sugestao.profissionalId}-${sugestao.inicio}`"
            >
              <Button
                type="button"
                size="small"
                :severity="escolhida(sugestao) ? undefined : 'secondary'"
                :outlined="!escolhida(sugestao)"
                class="mg__sugestao"
                :disabled="salvando"
                @click="usarSugestao(sugestao)"
              >
                <span class="ui-num">{{ rotuloDaSugestao(sugestao) }}</span>
                <span class="mg__com">{{ sugestao.profissionalNome }}</span>
              </Button>
            </li>
          </ul>
          <small v-if="sugestoes.interrompida" class="eg__dica">{{
            t('agendamentos.marcar.buscaInterrompida')
          }}</small>
          <small v-if="sugestoes.limitados" class="eg__dica">{{
            t('agendamentos.marcar.profissionaisLimitados')
          }}</small>
        </template>
      </section>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="marcar-salas">
            {{ t('agendamentos.marcar.salas') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <MultiSelect
            v-model="salaIds"
            input-id="marcar-salas"
            :options="opcoesDeSala"
            option-label="rotulo"
            option-value="valor"
            :selection-limit="4"
            display="chip"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="marcar-origem">{{
            t('agendamentos.marcar.origem')
          }}</label>
          <Select
            v-model="origem"
            input-id="marcar-origem"
            :options="opcoesDeOrigem"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </section>
      </div>

      <label class="mg__chave">
        <span>
          <strong>{{ t('agendamentos.encaixe') }}</strong>
          <small>{{
            tipo && !tipo.permiteEncaixe
              ? t('agendamentos.marcar.semEncaixe')
              : t('agendamentos.marcar.encaixeDica')
          }}</small>
        </span>
        <ToggleSwitch
          v-model="encaixe"
          :disabled="salvando || Boolean(tipo && !tipo.permiteEncaixe)"
        />
      </label>

      <section class="eg__secao">
        <label class="eg__rotulo" for="marcar-observacao">
          {{ t('agendamentos.detalhe.observacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="marcar-observacao"
          v-model="observacao"
          rows="2"
          auto-resize
          :maxlength="OBSERVACAO_MAX"
          :disabled="salvando"
        />
        <small class="eg__dica">{{ t('agendamentos.marcar.observacaoDica') }}</small>
      </section>

      <p v-if="(tentou && problema) || erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>
          {{ erro || problema }}
          <RouterLink v-if="mescladoEmId" :to="`/clinica/ficha/${mescladoEmId}`" class="mg__link">
            {{ t('agendamentos.marcar.abrirOQueFicou') }}
          </RouterLink>
        </span>
      </p>
    </form>

    <template #pe>
      <Button
        type="button"
        :label="t('cadastro.cancelar')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="visible = false"
      />
      <Button
        type="submit"
        form="marcar-form"
        icon="ph ph-check"
        :label="t('agendamentos.marcar.salvar')"
        :loading="salvando && !bloqueante"
        :disabled="Boolean(bloqueante)"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.mg__calendario {
  justify-self: start;
}

.mg__simulacao {
  gap: 8px;
  transition: opacity 150ms ease-out;
}

.mg__simulacao--lendo {
  opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
  .mg__simulacao {
    transition: none;
  }
}

.mg__livre {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
}

.mg__livre i {
  color: var(--ok-tinta);
  font-size: 16px;
}

.mg__avisos {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13.5px;
}

.mg__avisos li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--tinta);
}

.mg__avisos i {
  margin-top: 2px;
  font-size: 15px;
}

.mg__aviso--blocking i {
  color: var(--risco-tinta);
}

.mg__aviso--warning i {
  color: var(--atencao-tinta);
}

.mg__aviso--info i {
  color: var(--tinta-2);
}

.mg__alternativas {
  display: grid;
  gap: 6px;
}

.mg__subrotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.mg__horarios {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mg__confirmar {
  display: grid;
  gap: 8px;
}

.mg__confirmar p {
  display: flex;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
}

.mg__confirmar i {
  margin-top: 2px;
  color: var(--risco-tinta);
}

.mg__confirmar :deep(.p-button) {
  justify-self: start;
}

.mg__sugerir {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.mg__sugestoes {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mg__sugestao {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 12px;
  text-align: start;
}

.mg__sugestao .ui-num {
  white-space: nowrap;
}

.mg__com {
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mg__chave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.mg__chave span {
  display: grid;
  gap: 2px;
}

.mg__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.mg__chave small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.mg__link {
  margin-inline-start: 6px;
  color: inherit;
  font-weight: 600;
  text-decoration: underline;
}
</style>
