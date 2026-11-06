<script setup lang="ts">
/**
 * A falta de um horário (guia e3 3.3 a 3.6): em que pé está, cada registro (a última com contato
 * vale), registrar um contato e reagendar pelas sugestões a partir do dia seguinte, com quem
 * atendeu. Mora dentro de uma gaveta: a da agenda e a do histórico do painel.
 *
 * O óbito encerra o caso (sem reagendar nem contato novo) e diz quantos horários cancelou.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDaAgenda, useFrasesDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import { somarDias } from '@/components/agendamentos/leitura-da-agenda'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import JustificativaCampos from '@/components/faltas/JustificativaCampos.vue'
import { diaCurto } from '@/components/pedidos/leitura-do-pedido'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  obterSugestoes,
  type HorarioSugerido,
  type Mutacao,
} from '@/service/parceiro/agenda-service'
import {
  justificarFalta,
  justificativaParaEnviar,
  obterFalta,
  problemaDaJustificativa,
  reagendarFalta,
  type FaltaDoAgendamento,
  type Justificativa,
  type NovaJustificativa,
  type Obito,
} from '@/service/parceiro/faltas-service'

export type HorarioQueFaltou = {
  agendamentoId: string
  pacienteId: string
  pacienteNome: string
  inicio: string
  profissionalId: string
  tipoId: string
}

const props = defineProps<{
  falta: HorarioQueFaltou
  fuso: string
  profissionais: { id: string; nome: string }[]
  podeEscrever: boolean
  podeObito: boolean
  hoje: string
}>()

const emit = defineEmits<{
  /** Registrou um contato: a lista de quem chamou relê. */
  justificado: [obito: Obito | null]
  reagendado: [mutacao: Mutacao]
}>()

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const frases = useFrasesDaAgenda()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

type Modo = 'ver' | 'contato' | 'reagendar'

const lida = ref<FaltaDoAgendamento | null>(null)
const carregando = ref(false)
const erro = ref('')
const modo = ref<Modo>('ver')
const enviando = ref(false)
const erroDaAcao = ref('')
/** Cliente anonimizado: o contato não se registra mais (guia 3.3). */
const anonimizado = ref(false)

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    lida.value = await obterFalta(props.falta.agendamentoId, parceiroQuery())
  } catch (err) {
    erro.value = lerErroDaAgenda(err, t('faltas.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

watch(
  () => props.falta.agendamentoId,
  () => {
    modo.value = 'ver'
    lida.value = null
    anonimizado.value = false
    erroDaAcao.value = ''
    void carregar()
  },
  { immediate: true },
)

/* ----------------------------------------------------------------------------- leitura */

const ICONE_DA_SITUACAO = {
  PENDENTE: 'ph ph-phone-x',
  SEM_RESPOSTA: 'ph ph-phone-disconnect',
  JUSTIFICADA: 'ph ph-check-circle',
  ENCERRADA: 'ph ph-flower-lotus',
} as const

function momento(iso: string) {
  try {
    return new Intl.DateTimeFormat(rotulos.intl(), {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: props.fuso,
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16).replace('T', ' ')
  }
}

function tituloDoRegistro(registro: Justificativa) {
  const canal = t(`faltas.canal.${registro.canal}`)
  return registro.motivo ? `${canal} · ${t(`faltas.motivo.${registro.motivo}`)}` : canal
}

function quemRegistrou(registro: Justificativa) {
  if (registro.canal === 'APP')
    return t('faltas.registro.peloApp', { quando: momento(registro.registradaEm) })
  return registro.profissionalNome
    ? t('faltas.registro.por', {
        nome: registro.profissionalNome,
        quando: momento(registro.registradaEm),
      })
    : momento(registro.registradaEm)
}

const encerrada = computed(() => lida.value?.situacao === 'ENCERRADA')
const podeContato = computed(
  () => props.podeEscrever && Boolean(lida.value) && !encerrada.value && !anonimizado.value,
)
const podeReagendar = computed(
  () =>
    props.podeEscrever && Boolean(lida.value?.aceitaReagendamento) && !lida.value?.reagendadoComoId,
)

/* ---------------------------------------------------------------------------- contato */

const justificativa = ref<NovaJustificativa>({ canal: 'TELEFONE', motivo: null })
const tentou = ref(false)

function abrirContato() {
  justificativa.value = { canal: 'TELEFONE', motivo: null }
  tentou.value = false
  erroDaAcao.value = ''
  modo.value = 'contato'
}

function falhou(err: unknown) {
  const lido = lerErroDaAgenda(err, t('agendamentos.erros.salvar'))
  if (lido.codigo === 'CLIENTE_ANONIMIZADO') {
    anonimizado.value = true
    modo.value = 'ver'
  }
  if (['FALTA_ENCERRADA', 'FALTA_JA_REAGENDADA', 'AGENDAMENTO_ALTERADO'].includes(lido.codigo)) {
    modo.value = 'ver'
    void carregar()
  }
  erroDaAcao.value = lido.mensagem
}

async function registrarContato() {
  tentou.value = true
  erroDaAcao.value = ''
  if (problemaDaJustificativa(justificativa.value, props.hoje)) return

  enviando.value = true
  try {
    const registrada = await justificarFalta(
      props.falta.agendamentoId,
      justificativaParaEnviar(justificativa.value),
      parceiroQuery(),
    )
    lida.value = registrada.falta
    modo.value = 'ver'
    emit('justificado', registrada.obito)
  } catch (err) {
    falhou(err)
  } finally {
    enviando.value = false
  }
}

/* -------------------------------------------------------------------------- reagendar */

const profissionalDoRetorno = ref('')
const sugestoes = ref<HorarioSugerido[] | null>(null)
const interrompida = ref(false)
const sugerindo = ref(false)
const escolhida = ref<HorarioSugerido | null>(null)
const bloqueante = ref('')

async function sugerir() {
  sugerindo.value = true
  erroDaAcao.value = ''
  escolhida.value = null
  try {
    const lidas = await obterSugestoes(
      {
        pacienteId: props.falta.pacienteId,
        tipoId: props.falta.tipoId,
        profissionalId: profissionalDoRetorno.value || null,
        aPartirDe: somarDias(props.falta.inicio.slice(0, 10), 1),
      },
      parceiroQuery(),
    )
    sugestoes.value = lidas.sugestoes
    interrompida.value = lidas.buscaInterrompida
  } catch (err) {
    sugestoes.value = []
    erroDaAcao.value = lerErroDaAgenda(err, t('agendamentos.marcar.erroDasSugestoes')).mensagem
  } finally {
    sugerindo.value = false
  }
}

/* Abrir o reagendar e trocar o profissional são os gestos que buscam (a rota tem teto por hora). */
function abrirReagendar() {
  profissionalDoRetorno.value = props.falta.profissionalId
  bloqueante.value = ''
  erroDaAcao.value = ''
  chaveador.concluir()
  modo.value = 'reagendar'
  void sugerir()
}

function trocarProfissional(id: string) {
  profissionalDoRetorno.value = id
  void sugerir()
}

function rotuloDaSugestao(sugestao: HorarioSugerido) {
  return `${diaCurto(sugestao.data, rotulos.intl())} · ${sugestao.inicio.slice(11, 16)}`
}

async function reagendar(confirmar = false) {
  const sugestao = escolhida.value
  if (!sugestao) return
  enviando.value = true
  erroDaAcao.value = ''

  const corpo = {
    inicio: sugestao.inicio,
    profissionalId: sugestao.profissionalId,
    ...(confirmar ? { confirmarConflitos: ['holiday-closed' as const] } : {}),
  }
  try {
    const mutacao = await reagendarFalta(
      props.falta.agendamentoId,
      corpo,
      chaveador.para(corpo),
      parceiroQuery(),
    )
    chaveador.concluir()
    bloqueante.value = ''
    modo.value = 'ver'
    emit('reagendado', mutacao)
    void carregar()
  } catch (err) {
    const lido = lerErroDaAgenda(err, t('agendamentos.erros.salvar'))
    if (lido.codigo === 'CONFLITO_BLOQUEANTE') {
      const fechado = lido.conflitos.find((conflito) => conflito.severity === 'blocking')
      bloqueante.value = fechado ? frases.frase(fechado) : lido.mensagem
    } else {
      falhou(err)
    }
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="fdh">
    <div v-if="carregando && !lida" class="fdh__esqueleto" aria-busy="true">
      <Skeleton v-for="n in 3" :key="n" height="2.25rem" />
    </div>

    <p v-else-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <template v-else-if="lida">
      <!-- Ver -->
      <template v-if="modo === 'ver'">
        <section class="eg__secao">
          <span class="eg__rotulo">{{ t('faltas.titulo') }}</span>
          <p class="fdh__situacao" :class="`fdh__situacao--${lida.situacao.toLowerCase()}`">
            <i :class="ICONE_DA_SITUACAO[lida.situacao]" aria-hidden="true" />
            <span>{{ t(`faltas.situacao.${lida.situacao}`) }}</span>
          </p>
          <p v-if="lida.reagendadoComoId" class="fdh__nota">
            <i class="ph ph-calendar-check" aria-hidden="true" />
            {{ t('faltas.jaReagendada') }}
          </p>
          <p v-if="anonimizado" class="fdh__nota">
            <i class="ph ph-user-circle-dashed" aria-hidden="true" />
            {{ t('faltas.anonimizado') }}
          </p>
        </section>

        <section class="eg__secao">
          <span class="eg__rotulo">{{ t('faltas.registro.titulo') }}</span>
          <p v-if="!lida.justificativas.length" class="fdh__nota">
            {{ t('faltas.registro.nenhum') }}
          </p>
          <ol v-else class="fdh__registros">
            <li v-for="registro in lida.justificativas" :key="registro.id">
              <span class="fdh__registro-topo">
                <strong>{{ tituloDoRegistro(registro) }}</strong>
                <span v-if="lida.vigente?.id === registro.id" class="ui-selo">
                  {{ t('faltas.registro.vale') }}
                </span>
              </span>
              <span v-if="registro.observacao" class="fdh__observacao">{{
                registro.observacao
              }}</span>
              <small>{{ quemRegistrou(registro) }}</small>
            </li>
          </ol>
        </section>

        <div v-if="podeContato || podeReagendar" class="fdh__acoes">
          <Button
            v-if="podeContato"
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-phone-call"
            :label="t('faltas.acao.contato')"
            @click="abrirContato"
          />
          <Button
            v-if="podeReagendar"
            type="button"
            icon="ph ph-calendar-plus"
            :label="t('faltas.acao.reagendar')"
            @click="abrirReagendar"
          />
        </div>
      </template>

      <!-- Registrar contato -->
      <form
        v-else-if="modo === 'contato'"
        class="fdh__form"
        novalidate
        @submit.prevent="registrarContato"
      >
        <JustificativaCampos
          v-model="justificativa"
          :prefixo="`contato-${falta.agendamentoId}`"
          :pode-obito="podeObito"
          :tentou="tentou"
          :desabilitado="enviando"
          :hoje="hoje"
        />
        <div class="fdh__acoes">
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="t('agendamentos.voltar')"
            :disabled="enviando"
            @click="modo = 'ver'"
          />
          <Button
            type="submit"
            icon="ph ph-check"
            :label="t('faltas.acao.registrar')"
            :loading="enviando"
          />
        </div>
      </form>

      <!-- Reagendar -->
      <div v-else class="fdh__form">
        <section class="eg__secao">
          <label class="eg__rotulo" :for="`reagendar-${falta.agendamentoId}`">{{
            t('agendamentos.detalhe.profissional')
          }}</label>
          <Select
            :model-value="profissionalDoRetorno"
            :input-id="`reagendar-${falta.agendamentoId}`"
            :options="profissionais"
            option-label="nome"
            option-value="id"
            :disabled="enviando || sugerindo"
            @update:model-value="trocarProfissional"
          />
          <small class="eg__dica">{{ t('faltas.reagendar.dica') }}</small>
        </section>

        <section class="eg__secao" aria-live="polite">
          <span class="eg__rotulo">{{ t('faltas.reagendar.horarios') }}</span>
          <div v-if="sugerindo" class="fdh__esqueleto" aria-busy="true">
            <Skeleton v-for="n in 3" :key="n" height="2.25rem" />
          </div>
          <p v-else-if="sugestoes && !sugestoes.length" class="fdh__nota">
            {{ t('agendamentos.marcar.semSugestao') }}
          </p>
          <ul v-else-if="sugestoes" class="fdh__sugestoes">
            <li
              v-for="sugestao in sugestoes"
              :key="`${sugestao.profissionalId}-${sugestao.inicio}`"
            >
              <Button
                type="button"
                size="small"
                :severity="escolhida === sugestao ? undefined : 'secondary'"
                :outlined="escolhida !== sugestao"
                class="fdh__sugestao"
                :aria-pressed="escolhida === sugestao"
                :disabled="enviando"
                @click="escolhida = sugestao"
              >
                <span class="ui-num">{{ rotuloDaSugestao(sugestao) }}</span>
                <span class="fdh__com">{{ sugestao.profissionalNome }}</span>
              </Button>
            </li>
          </ul>
          <small v-if="interrompida" class="eg__dica">{{
            t('agendamentos.marcar.buscaInterrompida')
          }}</small>
        </section>

        <div v-if="bloqueante" class="fdh__confirmar" role="alert">
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
            :loading="enviando"
            @click="reagendar(true)"
          />
        </div>

        <div class="fdh__acoes">
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="t('agendamentos.voltar')"
            :disabled="enviando"
            @click="modo = 'ver'"
          />
          <Button
            type="button"
            icon="ph ph-check"
            :label="t('faltas.acao.reagendar')"
            :disabled="!escolhida || Boolean(bloqueante)"
            :loading="enviando && !bloqueante"
            @click="reagendar()"
          />
        </div>
      </div>

      <p v-if="erroDaAcao" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroDaAcao }}</span>
      </p>
    </template>
  </div>
</template>

<style scoped>
.fdh,
.fdh__form {
  display: grid;
  gap: 18px;
}

.fdh__esqueleto {
  display: grid;
  gap: 8px;
}

.fdh__situacao {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.fdh__situacao i {
  font-size: 17px;
}

.fdh__situacao--pendente i,
.fdh__situacao--sem_resposta i {
  color: var(--atencao-tinta);
}

.fdh__situacao--justificada i {
  color: var(--ok-tinta);
}

.fdh__situacao--encerrada i {
  color: var(--tinta-2);
}

.fdh__nota {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.fdh__registros {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fdh__registros li {
  display: grid;
  gap: 3px;
  padding: 10px 0;
}

.fdh__registros li + li {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.fdh__registro-topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  color: var(--tinta);
  font-size: 14px;
}

.fdh__registro-topo strong {
  font-weight: 600;
}

.fdh__observacao {
  color: var(--tinta);
  font-size: 13.5px;
  white-space: pre-line;
}

.fdh__registros small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.fdh__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.fdh__sugestoes {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fdh__sugestao {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 12px;
  text-align: start;
}

.fdh__sugestao .ui-num {
  white-space: nowrap;
}

.fdh__com {
  overflow: hidden;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fdh__confirmar {
  display: grid;
  gap: 8px;
}

.fdh__confirmar p {
  display: flex;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
}

.fdh__confirmar i {
  margin-top: 2px;
  color: var(--risco-tinta);
}

.fdh__confirmar :deep(.p-button) {
  justify-self: start;
}
</style>
