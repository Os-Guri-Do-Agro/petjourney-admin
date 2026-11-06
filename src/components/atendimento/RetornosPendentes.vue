<script setup lang="ts">
/**
 * Retornos pendentes (E4-01, guia e4 5.7): o retorno que o veterinário indicou e ninguém marcou,
 * ou cujo horário foi cancelado ou virou falta. Por vencimento, contado da data da consulta, sem
 * texto clínico (a recepção não lê prontuário). Ler é `agenda.ler`; marcar, `agenda.escrever`.
 *
 * "Marcar" é um toque: a API escolhe o primeiro horário livre de quem atendeu a partir do
 * vencimento, e a faixa do "Desfazer" fica oito segundos. Sem horário em cinco semanas, a linha
 * oferece a fila de espera ou outro horário (as sugestões da agenda). Sem tipo escolhido pelo
 * veterinário, o toque abre a escolha do horário, onde a recepção escolhe o tipo.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import DesfazerNaAgenda from '@/components/agendamentos/DesfazerNaAgenda.vue'
import { lerErroDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import RetornoGaveta from '@/components/atendimento/RetornoGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import EntrarNaFilaGaveta from '@/components/fila/EntrarNaFilaGaveta.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { ApiError } from '@/service/api'
import { novaChaveDeIdempotencia } from '@/service/idempotencia'
import { listarTipos, type TipoDeAtendimento } from '@/service/parceiro/agenda-config-service'
import { DESFAZER_NA_TELA_MS, desfazerNaAgenda } from '@/service/parceiro/agenda-service'
import {
  listarRetornosPendentes,
  marcarRetorno,
  type Mutacao,
  type RetornoPendente,
} from '@/service/parceiro/atendimentos-service'
import { listarProfissionais, type Profissional } from '@/service/parceiro/profissionais-service'

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const podeMarcar = computed(
  () => store.temPermissao('agenda.escrever') && Boolean(store.modulo('CLINICA')?.podeEscrever),
)
const podeFila = computed(() => podeMarcar.value && store.temPermissao('fila.gerir'))

const somenteVencidos = ref(false)
const itens = ref<RetornoPendente[]>([])
const cursor = ref<string | null>(null)
const hoje = ref('')
const carregando = ref(false)
const lido = ref(false)
const erro = ref('')

const opcoesDeFiltro = computed(() => [
  { valor: false, rotulo: t('atendimento.retornos.todos') },
  { valor: true, rotulo: t('atendimento.retornos.vencidos') },
])

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await listarRetornosPendentes(
      { somenteVencidos: somenteVencidos.value || undefined, cursor: mais ? cursor.value : null },
      parceiroQuery(),
    )
    itens.value = mais ? [...itens.value, ...pagina.itens] : pagina.itens
    cursor.value = pagina.proximoCursor
    hoje.value = pagina.hoje
    lido.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('atendimento.retornos.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

watch(somenteVencidos, () => void carregar())

/* Tipos e profissionais: só para escolher outro horário e para a fila. */
const tipos = ref<TipoDeAtendimento[]>([])
const profissionais = ref<Profissional[]>([])

onMounted(async () => {
  void carregar()
  if (!podeMarcar.value) return
  const [listaDeTipos, listaDeProfissionais] = await Promise.all([
    listarTipos({ ...parceiroQuery(), ativos: true }).catch(() => []),
    listarProfissionais({ ...parceiroQuery(), ativo: true }).catch(() => []),
  ])
  tipos.value = listaDeTipos
  profissionais.value = listaDeProfissionais
})

function vencimento(item: RetornoPendente) {
  const dias = item.diasDeAtraso
  if (dias > 0)
    return { texto: t('atendimento.retornos.venceuHa', { n: dias }, dias), tom: 'atencao' }
  if (dias === 0) return { texto: t('atendimento.retornos.venceHoje'), tom: 'atencao' }
  return { texto: t('atendimento.retornos.venceEm', { n: -dias }, -dias), tom: '' }
}

function meta(item: RetornoPendente) {
  return [
    item.tipoNome ?? t('atendimento.retornos.semTipo'),
    item.profissionalNome,
    t('atendimento.retornos.daConsulta', {
      dia: rotulos.dia(item.dataDoAtendimento),
      n: item.emDias,
    }),
  ].join(' · ')
}

/* ------------------------------------------------------------------- marcar com um toque */

/** O que deu errado numa linha (sem horário, sem dias, já marcado), com o que fazer. */
type Recado = { codigo: string | null; texto: string; agendamentoId?: string; dia?: string }
const recados = ref<Record<string, Recado>>({})
const marcando = ref<string | null>(null)
const chaves = new Map<string, string>()

const feito = ref<{ texto: string; token: string; ate: number } | null>(null)
const desfazendo = ref(false)

function horarioDe(mutacao: Mutacao) {
  return mutacao.agendamentos.find((item) => item.id === mutacao.id) ?? mutacao.agendamentos[0]
}

function depoisDeMarcar(mutacao: Mutacao, texto: string, atendimentoId: string) {
  itens.value = itens.value.filter((item) => item.atendimentoId !== atendimentoId)
  delete recados.value[atendimentoId]
  feito.value = mutacao.desfazerToken
    ? { texto, token: mutacao.desfazerToken, ate: Date.now() + DESFAZER_NA_TELA_MS }
    : null
  invalidarPendenciasDoPortal()
}

async function marcar(item: RetornoPendente) {
  if (!item.tipoId) {
    abrirEscolha(item)
    return
  }
  marcando.value = item.atendimentoId
  delete recados.value[item.atendimentoId]
  /* Uma chave por pedido de marcar: o duplo toque repete a resposta, não marca dois. */
  const chave = chaves.get(item.atendimentoId) ?? novaChaveDeIdempotencia()
  chaves.set(item.atendimentoId, chave)
  try {
    const mutacao = await marcarRetorno(item.atendimentoId, {}, chave, parceiroQuery())
    chaves.delete(item.atendimentoId)
    const horario = horarioDe(mutacao)
    depoisDeMarcar(
      mutacao,
      t('atendimento.retornos.marcado', {
        pet: item.pacienteNome,
        quando: horario
          ? `${rotulos.dia(horario.inicio.slice(0, 10))} ${horario.inicio.slice(11, 16)}`
          : '',
      }),
      item.atendimentoId,
    )
  } catch (err) {
    chaves.delete(item.atendimentoId)
    const lido = lerErroDaAgenda(err, t('cadastro.erros.salvar'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    if (lido.codigo === 'RETORNO_JA_MARCADO' && typeof detalhes.agendamentoId === 'string') {
      recados.value[item.atendimentoId] = {
        codigo: lido.codigo,
        texto: t('atendimento.retornos.jaMarcado'),
        agendamentoId: detalhes.agendamentoId,
      }
    } else if (lido.codigo === 'RETORNO_SEM_HORARIO') {
      recados.value[item.atendimentoId] = {
        codigo: lido.codigo,
        texto: t('atendimento.retornos.semHorario'),
      }
    } else if (lido.codigo === 'RETORNO_NAO_DEFINIDO') {
      recados.value[item.atendimentoId] = {
        codigo: lido.codigo,
        texto: t('atendimento.retornos.naoDefinido'),
      }
    } else {
      recados.value[item.atendimentoId] = { codigo: lido.codigo, texto: lido.mensagem }
    }
  } finally {
    marcando.value = null
  }
}

async function desfazer() {
  const atual = feito.value
  if (!atual) return
  desfazendo.value = true
  try {
    await desfazerNaAgenda(atual.token, parceiroQuery())
    feito.value = null
    invalidarPendenciasDoPortal()
    void carregar()
  } catch (err) {
    feito.value = null
    const lido = lerErroDaAgenda(err, t('agendamentos.erros.salvar'))
    erro.value =
      lido.codigo === 'DESFAZER_EXPIRADO' ? t('agendamentos.desfazer.expirado') : lido.mensagem
  } finally {
    desfazendo.value = false
  }
}

/* ------------------------------------------------------------------- outro horário, fila */

const escolhendo = ref<RetornoPendente | null>(null)
const escolhaAberta = ref(false)

function abrirEscolha(item: RetornoPendente) {
  escolhendo.value = item
  escolhaAberta.value = true
}

function marcadoNaGaveta(mutacao: Mutacao, texto: string) {
  if (escolhendo.value) depoisDeMarcar(mutacao, texto, escolhendo.value.atendimentoId)
}

const paraFila = ref<RetornoPendente | null>(null)
const filaAberta = ref(false)

function abrirFila(item: RetornoPendente) {
  paraFila.value = item
  filaAberta.value = true
}

const naFila = computed(() =>
  paraFila.value
    ? {
        pacienteId: paraFila.value.pacienteId,
        nome: paraFila.value.pacienteNome,
        tipoId: paraFila.value.tipoId,
        profissionalId: paraFila.value.profissionalId,
      }
    : null,
)

function entrouNaFila() {
  if (paraFila.value) delete recados.value[paraFila.value.atendimentoId]
}

const resumo = computed(() => {
  if (!lido.value) return ''
  const vencidos = itens.value.filter((item) => item.diasDeAtraso >= 0).length
  return vencidos
    ? t('atendimento.retornos.resumo', { n: vencidos }, vencidos)
    : t('atendimento.retornos.resumoEmDia')
})
</script>

<template>
  <UiPagina
    :resumo="resumo"
    :carregando="carregando && !lido"
    :erro="lido ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <div class="rp">
      <div class="rp__filtros">
        <SelectButton
          v-model="somenteVencidos"
          :options="opcoesDeFiltro"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('atendimento.retornos.filtro')"
        />
      </div>

      <p v-if="erro && lido" class="rp__erro" role="alert">{{ erro }}</p>

      <section class="ui-folha ui-lista" :aria-busy="carregando">
        <ul v-if="itens.length" class="ui-lista">
          <li v-for="item in itens" :key="item.atendimentoId" class="rp__item">
            <div class="ui-linha">
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo rp__nome">
                  <RouterLink :to="`/clinica/ficha/${item.pacienteId}`">{{
                    item.pacienteNome
                  }}</RouterLink>
                  <span
                    class="ui-selo"
                    :class="vencimento(item).tom ? `ui-selo--${vencimento(item).tom}` : ''"
                    >{{ vencimento(item).texto }}</span
                  >
                  <span v-if="item.retornoAnteriorId" class="ui-selo ui-selo--contorno">{{
                    t('atendimento.retornos.desmarcado')
                  }}</span>
                </strong>
                <span class="ui-linha__meta">{{ meta(item) }}</span>
              </span>
              <span v-if="podeMarcar" class="ui-linha__fim rp__acoes">
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  :label="t('atendimento.retornos.outroHorario')"
                  :disabled="marcando === item.atendimentoId"
                  @click="abrirEscolha(item)"
                />
                <Button
                  type="button"
                  size="small"
                  icon="ph ph-calendar-check"
                  :label="t('atendimento.retornos.marcar')"
                  :loading="marcando === item.atendimentoId"
                  @click="marcar(item)"
                />
              </span>
            </div>

            <p v-if="recados[item.atendimentoId]" class="rp__recado" role="status">
              <i class="ph ph-info" aria-hidden="true" />
              <span>{{ recados[item.atendimentoId]?.texto }}</span>
              <RouterLink
                v-if="recados[item.atendimentoId]?.agendamentoId"
                class="p-button p-component p-button-secondary p-button-outlined p-button-sm"
                :to="{
                  path: '/clinica/agenda',
                  query: { horario: recados[item.atendimentoId]?.agendamentoId },
                }"
              >
                {{ t('atendimento.retornos.abrirHorario') }}
              </RouterLink>
              <Button
                v-if="recados[item.atendimentoId]?.codigo === 'RETORNO_SEM_HORARIO' && podeFila"
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-hourglass-medium"
                :label="t('atendimento.retornos.porNaFila')"
                @click="abrirFila(item)"
              />
            </p>
          </li>
        </ul>
        <p v-else-if="lido && !carregando" class="ui-vazio rp__vazio">
          {{
            somenteVencidos
              ? t('atendimento.retornos.vazioVencidos')
              : t('atendimento.retornos.vazio')
          }}
        </p>
      </section>

      <Button
        v-if="cursor"
        type="button"
        severity="secondary"
        outlined
        class="rp__mais"
        :label="t('atendimento.retornos.verMais')"
        :loading="carregando"
        @click="carregar(true)"
      />
    </div>

    <template #sempre>
      <RetornoGaveta
        v-model:visible="escolhaAberta"
        :retorno="escolhendo"
        :hoje="hoje"
        :tipos="tipos"
        :profissionais="profissionais"
        @marcado="marcadoNaGaveta"
      />
      <EntrarNaFilaGaveta
        v-model:visible="filaAberta"
        :tipos="tipos"
        :profissionais="profissionais"
        :para-quem="naFila"
        @entrou="entrouNaFila"
      />
      <DesfazerNaAgenda
        :feito="feito"
        :desfazendo="desfazendo"
        @desfazer="desfazer"
        @sumiu="feito = null"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.rp {
  display: grid;
  gap: 16px;
}

.rp__filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.rp__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.rp__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.rp__nome a {
  color: var(--tinta);
  text-decoration: none;
}

.rp__nome a:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.rp__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.rp__recado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin: 0;
  padding: 0 24px 14px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.rp__vazio {
  margin: 0;
  padding: 24px 16px;
  color: var(--tinta-2);
}

.rp__mais {
  justify-self: start;
}
</style>
