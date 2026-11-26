<script setup lang="ts">
/**
 * A falta de um horário (guia e3 3.3 a 3.6), numa caixa só: em que pé está (selo), o contato que
 * vale contado numa frase (a última com contato vale; sem ela, o registro mais novo), os anteriores
 * embaixo, registrar um contato e reagendar pelas sugestões a partir do dia seguinte, com quem
 * atendeu. Mora dentro de uma gaveta: a da agenda e a do histórico do painel.
 *
 * Reagendada, a caixa mostra o novo horário (lido pelo id, N24) com o atalho para abri-lo, e o
 * "Reagendar" sai; volta só se o novo foi cancelado ou não deu para lê-lo (a API decide, com 409).
 *
 * O óbito encerra o caso (sem reagendar nem contato novo) e diz quantos horários cancelou.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { lerErroDaAgenda, useFrasesDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import { somarDias } from '@/components/agendamentos/leitura-da-agenda'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import JustificativaCampos from '@/components/faltas/JustificativaCampos.vue'
import { diaCurto } from '@/components/pedidos/leitura-do-pedido'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  obterAgendamento,
  obterSugestoes,
  type Agendamento,
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

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
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
/** O horário que a reagenda marcou. */
const novo = ref<Agendamento | null>(null)
/** Reagendada, mas o novo não se deixou ler (de outro parceiro, apagado, sem rede). */
const novoIlegivel = ref(false)
/** Acabou de reagendar aqui: a caixa do novo diz "Pronto". */
const acabouDeReagendar = ref(false)
const caixaDoNovo = ref<HTMLElement | null>(null)

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
    novo.value = null
    novoIlegivel.value = false
    acabouDeReagendar.value = false
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

const SELO_DA_SITUACAO = {
  PENDENTE: 'ui-selo--atencao',
  SEM_RESPOSTA: 'ui-selo--atencao',
  JUSTIFICADA: 'ui-selo--ok',
  ENCERRADA: '',
} as const

/** "26/11" e "15:32", no fuso da clínica. */
function momento(iso: string) {
  try {
    const em = new Date(iso)
    const dia = new Intl.DateTimeFormat(rotulos.intl(), {
      day: '2-digit',
      month: '2-digit',
      timeZone: props.fuso,
    }).format(em)
    const hora = new Intl.DateTimeFormat(rotulos.intl(), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: props.fuso,
    }).format(em)
    return { dia, hora }
  } catch {
    return { dia: iso.slice(0, 10), hora: iso.slice(11, 16) }
  }
}

/** O registro numa frase: quem falou com o responsável, como e quando. */
function fraseDoRegistro(registro: Justificativa) {
  const chave = `faltas.registro.frase.${registro.canal}`
  const { dia, hora } = momento(registro.registradaEm)
  if (!te(chave)) return `${t(`faltas.canal.${registro.canal}`)} · ${dia}, ${hora}`
  const quem = registro.profissionalNome || t('faltas.registro.aClinica')
  return t(chave, { quem, dia, hora })
}

function motivoDoRegistro(registro: Justificativa) {
  return registro.motivo
    ? t('faltas.registro.motivo', { motivo: t(`faltas.motivo.${registro.motivo}`) })
    : ''
}

/** Do mais novo para o mais antigo. */
const registros = computed(() =>
  [...(lida.value?.justificativas ?? [])].sort(
    (a, b) => Date.parse(b.registradaEm) - Date.parse(a.registradaEm),
  ),
)

/** O que a caixa conta primeiro: o registro que vale; sem ele, o mais novo. */
const principal = computed(() => {
  const vigente = lida.value?.vigente
  return (
    (vigente && registros.value.find((item) => item.id === vigente.id)) ??
    registros.value[0] ??
    null
  )
})

const anteriores = computed(() => registros.value.filter((item) => item.id !== principal.value?.id))

/* --------------------------------------------------------------------- o novo horário */

async function lerNovo(id: string | null | undefined) {
  if (!id) {
    novo.value = null
    novoIlegivel.value = false
    return
  }
  if (novo.value?.id === id) return
  try {
    novo.value = await obterAgendamento(id, parceiroQuery())
    novoIlegivel.value = false
  } catch {
    novo.value = null
    novoIlegivel.value = true
  }
}

watch(
  () => lida.value?.reagendadoComoId,
  (id) => void lerNovo(id),
)

const novoCancelado = computed(() => novo.value?.status === 'CANCELADO')

function quandoDoNovo(agendamento: Agendamento) {
  return t('faltas.novo.quando', {
    dia: frases.diaPorExtenso(agendamento.inicio.slice(0, 10)),
    hora: agendamento.inicio.slice(11, 16),
  })
}

function nomeDoProfissional(id: string) {
  return props.profissionais.find((item) => item.id === id)?.nome ?? ''
}

/** Abre o novo horário na agenda, no dia dele (a agenda lê `?horario` e abre a gaveta). */
function abrirNovo() {
  const alvo = novo.value
  if (!alvo) return
  const naAgenda = route.path === '/clinica/agenda'
  void router.push({
    path: '/clinica/agenda',
    query: { ...(naAgenda ? route.query : {}), data: alvo.inicio.slice(0, 10), horario: alvo.id },
  })
}

const encerrada = computed(() => lida.value?.situacao === 'ENCERRADA')
const podeContato = computed(
  () => props.podeEscrever && Boolean(lida.value) && !encerrada.value && !anonimizado.value,
)
/*
 * Guia E3-03 (3.4 e 3.5): só o óbito tira o "reagendar" (`aceitaReagendamento: false`). Já
 * reagendada, o botão sai enquanto o novo horário vale; volta se o novo foi cancelado ou não deu
 * para lê-lo. Nesse caso, se o novo ainda vale, a API responde 409 FALTA_JA_REAGENDADA, que o
 * `falhou` mostra e relê.
 */
const podeReagendar = computed(() => {
  const atual = lida.value
  if (!props.podeEscrever || !atual?.aceitaReagendamento) return false
  return !atual.reagendadoComoId || novoCancelado.value || novoIlegivel.value
})

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
    /* O novo vem na própria mutação: a caixa mostra "Pronto" sem esperar a releitura. */
    novo.value =
      mutacao.agendamentos.find(
        (item) => item.id !== props.falta.agendamentoId && item.status !== 'CANCELADO',
      ) ?? null
    novoIlegivel.value = false
    acabouDeReagendar.value = true
    modo.value = 'ver'
    emit('reagendado', mutacao)
    void carregar()
    await nextTick()
    caixaDoNovo.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
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
      <section
        v-if="modo === 'ver'"
        class="fdh__caixa"
        :aria-labelledby="`falta-${falta.agendamentoId}`"
      >
        <header class="fdh__cabeca">
          <h3 :id="`falta-${falta.agendamentoId}`" class="fdh__titulo">
            {{ t('faltas.titulo') }}
          </h3>
          <span class="ui-selo" :class="SELO_DA_SITUACAO[lida.situacao]">
            <i :class="ICONE_DA_SITUACAO[lida.situacao]" aria-hidden="true" />
            {{ t(`faltas.estado.${lida.situacao}`) }}
          </span>
        </header>

        <!-- O contato que vale, numa frase. -->
        <div v-if="principal" class="fdh__contato">
          <strong v-if="principal.motivo" class="fdh__motivo">{{
            motivoDoRegistro(principal)
          }}</strong>
          <p class="fdh__frase">{{ fraseDoRegistro(principal) }}</p>
          <p v-if="principal.observacao" class="fdh__observacao">{{ principal.observacao }}</p>
        </div>
        <p v-else class="fdh__frase">{{ t('faltas.registro.semContato') }}</p>

        <p v-if="anonimizado" class="fdh__nota">
          <i class="ph ph-user-circle-dashed" aria-hidden="true" />
          {{ t('faltas.anonimizado') }}
        </p>

        <!-- O novo horário: o que a reagenda marcou. -->
        <div
          v-if="novo && !novoCancelado"
          ref="caixaDoNovo"
          class="fdh__novo"
          :role="acabouDeReagendar ? 'status' : undefined"
        >
          <span class="fdh__disco" aria-hidden="true">
            <i class="ph ph-calendar-check" />
          </span>
          <span class="fdh__novo-textos">
            <strong>{{
              acabouDeReagendar ? t('faltas.novo.pronto') : t('faltas.novo.titulo')
            }}</strong>
            <span class="ui-num">
              {{ quandoDoNovo(novo) }}
              <template v-if="nomeDoProfissional(novo.profissionalId)">
                · {{ t('faltas.novo.com', { nome: nomeDoProfissional(novo.profissionalId) }) }}
              </template>
            </span>
          </span>
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-arrow-right"
            icon-pos="right"
            class="fdh__abrir"
            :label="t('faltas.novo.abrir')"
            @click="abrirNovo"
          />
        </div>
        <p v-else-if="novo && novoCancelado" class="fdh__nota fdh__nota--atencao">
          <i class="ph ph-calendar-x" aria-hidden="true" />
          {{ t('faltas.novo.cancelado', { quando: quandoDoNovo(novo) }) }}
        </p>
        <p v-else-if="lida.reagendadoComoId && novoIlegivel" class="fdh__nota">
          <i class="ph ph-calendar-check" aria-hidden="true" />
          {{ t('faltas.jaReagendada') }}
        </p>

        <!-- Os contatos de antes, do mais novo. -->
        <div v-if="anteriores.length" class="fdh__antes">
          <span class="fdh__subtitulo">{{ t('faltas.registro.antes') }}</span>
          <ul class="fdh__registros">
            <li v-for="registro in anteriores" :key="registro.id">
              <span>{{ fraseDoRegistro(registro) }}</span>
              <small v-if="registro.motivo">{{ motivoDoRegistro(registro) }}</small>
              <small v-if="registro.observacao" class="fdh__observacao">{{
                registro.observacao
              }}</small>
            </li>
          </ul>
        </div>

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
      </section>

      <!-- Registrar contato -->
      <form
        v-else-if="modo === 'contato'"
        class="fdh__form fdh__caixa"
        novalidate
        @submit.prevent="registrarContato"
      >
        <header class="fdh__cabeca">
          <h3 class="fdh__titulo">{{ t('faltas.acao.contato') }}</h3>
        </header>
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
      <div v-else class="fdh__form fdh__caixa">
        <header class="fdh__cabeca">
          <h3 class="fdh__titulo">{{ t('faltas.acao.reagendar') }}</h3>
        </header>
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

/* Um assunto, uma caixa: a falta inteira (e o contato e o reagendar) num véu com fio sob o título. */
.fdh__caixa {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--linha-suave);
  border-radius: 16px;
  background: var(--superficie-2);
}

.fdh__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--linha-suave);
}

.fdh__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
}

.fdh__contato {
  display: grid;
  gap: 4px;
}

.fdh__motivo {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.fdh__frase {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

/* A observação de quem registrou: citada, com o fio à esquerda. */
.fdh__observacao {
  margin: 4px 0 0;
  padding-inline-start: 10px;
  border-inline-start: 2px solid var(--linha-suave);
  color: var(--tinta);
  font-size: 13.5px;
  white-space: pre-line;
}

.fdh__nota {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.fdh__nota--atencao {
  color: var(--tinta);
}

.fdh__nota--atencao i {
  color: var(--atencao-tinta);
}

/* O novo horário: papel dentro do véu, com o disco em verde pastel. */
.fdh__novo {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px 12px;
  padding: 12px 14px;
  border: 1px solid var(--linha-suave);
  border-radius: 12px;
  background: var(--superficie);
}

.fdh__disco {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 50%;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 19px;
}

.fdh__novo-textos {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.fdh__novo-textos strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.fdh__novo-textos span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.fdh__abrir {
  grid-column: 2;
  justify-self: start;
}

.fdh__antes {
  display: grid;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--linha-suave);
}

.fdh__subtitulo {
  color: var(--tinta);
  font-size: 13px;
  font-weight: 600;
}

.fdh__registros {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fdh__registros li {
  display: grid;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13px;
}

.fdh__registros small {
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
