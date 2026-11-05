<script setup lang="ts">
/**
 * A fila de espera pela API (E3-04, PJ-07YV9I): quem aguarda, na ordem do servidor, com a posição,
 * as janelas agrupadas e a prioridade; quem está com oferta aberta, com o prazo e o comprovante; e
 * a aba "não responderam" (as ofertas que venceram nos últimos 7 dias: a recepção liga).
 *
 * As vagas liberadas moram numa gaveta, com os primeiros que cabem e o "Ofertar". O sim e o não do
 * telefone ficam na linha da oferta. Quem pode: ler é `agenda.ler`; gerir é `fila.gerir`; o sim
 * também pede `agenda.escrever`.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import EntrarNaFilaGaveta from '@/components/fila/EntrarNaFilaGaveta.vue'
import { quandoCurto, textoDaFaixa } from '@/components/fila/leitura-da-fila'
import VagasGaveta from '@/components/fila/VagasGaveta.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  listarTipos,
  obterPolitica,
  type TipoDeAtendimento,
} from '@/service/parceiro/agenda-config-service'
import {
  horaDoInstante,
  listarFila,
  listarVagas,
  registrarAceite,
  registrarRecusa,
  removerDaFila,
  SITUACOES_DA_FILA,
  type EntradaNaFila,
  type SituacaoDaFila,
} from '@/service/parceiro/fila-service'
import { listarProfissionais, type Profissional } from '@/service/parceiro/profissionais-service'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

const { t, locale } = useI18n()
const toast = useToast()
const { store, parceiroQuery } = useParceiroPortal()

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

/* ------------------------------------------------------------------------------ quem pode */

const clinicaEscreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
const podeGerir = computed(() => clinicaEscreve.value && store.temPermissao('fila.gerir'))
const podeAceitar = computed(() => podeGerir.value && store.temPermissao('agenda.escrever'))

/* ---------------------------------------------------------------------------- os dados */

const situacao = ref<SituacaoDaFila>('ATIVAS')
const itens = ref<EntradaNaFila[]>([])
const aguardando = ref(0)
const proximoCursor = ref<string | null>(null)
const carregando = ref(true)
const jaCarregou = ref(false)
const erro = ref('')

const tipos = ref<TipoDeAtendimento[]>([])
const profissionais = ref<Profissional[]>([])
const prazoMinutos = ref<number | null>(null)
const totalDeVagas = ref<number | null>(null)

/* Trocar de aba antes de a resposta chegar: a página da aba anterior não vale mais. */
const leitura = criarUltimaLeitura()

async function carregar() {
  const vez = leitura.nova()
  carregando.value = true
  erro.value = ''

  try {
    const pagina = await listarFila({ situacao: situacao.value }, parceiroQuery())
    if (!leitura.valendo(vez)) return
    itens.value = pagina.itens
    aguardando.value = pagina.aguardando
    proximoCursor.value = pagina.proximoCursor
    jaCarregou.value = true
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDoCadastro(err, t('fila.erroAoCarregar')).mensagem
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

async function carregarMais() {
  if (!proximoCursor.value) return

  const vez = leitura.atual()

  try {
    const pagina = await listarFila(
      { situacao: situacao.value, cursor: proximoCursor.value },
      parceiroQuery(),
    )
    if (!leitura.valendo(vez)) return
    itens.value = [...itens.value, ...pagina.itens]
    proximoCursor.value = pagina.proximoCursor
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDoCadastro(err, t('fila.erroAoCarregar')).mensagem
  }
}

async function carregarVagas() {
  try {
    totalDeVagas.value = (await listarVagas({}, parceiroQuery())).itens.length
  } catch {
    totalDeVagas.value = null
  }
}

async function carregarApoio() {
  const [listaDeTipos, listaDeProfissionais, politica] = await Promise.all([
    listarTipos({ ...parceiroQuery(), ativos: true }).catch(() => []),
    listarProfissionais({ ...parceiroQuery(), ativo: true }).catch(() => []),
    obterPolitica(parceiroQuery()).catch(() => null),
  ])
  tipos.value = listaDeTipos
  profissionais.value = listaDeProfissionais
  prazoMinutos.value = politica?.ofertaDeVagaMinutos ?? null
}

onMounted(() => {
  void carregar()
  void carregarApoio()
  void carregarVagas()
})

watch(situacao, () => {
  itens.value = []
  void carregar()
})

function recarregarTudo() {
  invalidarPendenciasDoPortal()
  void carregar()
  void carregarVagas()
}

/* ------------------------------------------------------------------------------- a linha */

const opcoesDeSituacao = computed(() =>
  SITUACOES_DA_FILA.map((valor) => ({ valor, rotulo: t(`fila.situacoes.${valor}`) })),
)

const nomeDoTipo = (id: string) => tipos.value.find((tipo) => tipo.id === id)?.nome ?? ''
const nomeDoProfissional = (id: string | null) =>
  id
    ? (profissionais.value.find((item) => item.id === id)?.nome ?? '')
    : t('clinico.fila.qualquerProfissional')

function janelasDe(entrada: EntradaNaFila) {
  return entrada.janelasAgrupadas
    .map((faixa) => textoDaFaixa(faixa, intl.value, (chave, valores) => t(chave, valores)))
    .join(' · ')
}

/** O prazo cai no dia seguinte quando a oferta foi feita das 22h às 8h: aí vai a data junto. */
function prazoDa(entrada: EntradaNaFila) {
  const oferta = entrada.oferta
  if (!oferta) return ''

  return oferta.expiraEm.slice(0, 10) === oferta.ofertadaEm.slice(0, 10)
    ? horaDoInstante(oferta.expiraEm)
    : quandoCurto(oferta.expiraEm, intl.value)
}

function recusaDe(entrada: EntradaNaFila) {
  const recusa = entrada.ultimaRecusa
  if (!recusa) return ''

  return t(recusa.por === 'APP' ? 'fila.recusouPeloApp' : 'fila.recusouPorTelefone', {
    quando: quandoCurto(recusa.em, intl.value),
  })
}

const fraseDoResumo = computed(() =>
  jaCarregou.value
    ? t('clinico.fila.saudacao.aguardando', { n: aguardando.value }, aguardando.value)
    : '',
)

/* ------------------------------------------------------------------- o sim, o não, remover */

const ocupado = ref<string | null>(null)

async function aceitar(entrada: EntradaNaFila) {
  ocupado.value = entrada.id

  try {
    const resposta = await registrarAceite(entrada.id, parceiroQuery())
    const oferta = entrada.oferta
    /* G2: quem já tinha horário no serviço tem o agendamento trocado, não um novo. */
    const resumoDoAceite =
      resposta.remarcadoDe && oferta
        ? t('fila.trocado', {
            paciente: entrada.paciente.nome,
            de: quandoCurto(resposta.remarcadoDe, intl.value),
            para: quandoCurto(oferta.inicio, intl.value),
          })
        : oferta
          ? t('clinico.fila.aceite.marcado', {
              paciente: entrada.paciente.nome,
              data: (
                quandoCurto(oferta.inicio, intl.value).split(' · ')[0] ?? ''
              ).toLocaleLowerCase(),
              hora: horaDoInstante(oferta.inicio),
              profissional: nomeDoProfissional(oferta.profissionalId),
            })
          : t('fila.aceiteRegistrado')
    toast.add({ severity: 'success', summary: resumoDoAceite, life: 5000 })
    recarregarTudo()
  } catch (err) {
    avisarErroDaOferta(err, entrada)
  } finally {
    ocupado.value = null
  }
}

async function recusar(entrada: EntradaNaFila) {
  ocupado.value = entrada.id

  try {
    await registrarRecusa(entrada.id, parceiroQuery())
    toast.add({ severity: 'success', summary: t('fila.recusaRegistrada'), life: 3500 })
    recarregarTudo()
  } catch (err) {
    avisarErroDaOferta(err, entrada)
  } finally {
    ocupado.value = null
  }
}

function avisarErroDaOferta(err: unknown, entrada: EntradaNaFila) {
  const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
  const textos: Record<string, string> = {
    OFERTA_EXPIRADA: t('clinico.fila.aceite.ofertaExpirada', { paciente: entrada.paciente.nome }),
    VAGA_JA_PREENCHIDA: t('clinico.fila.aceite.vagaPreenchida', {
      paciente: entrada.paciente.nome,
    }),
    FILA_HORARIO_NAO_E_MAIS_CEDO: t('fila.erro.FILA_HORARIO_NAO_E_MAIS_CEDO'),
    FILA_ENCERRADA: t('fila.erro.FILA_ENCERRADA'),
  }
  toast.add({ severity: 'error', summary: textos[lido.codigo] ?? lido.mensagem, life: 7000 })
  recarregarTudo()
}

const paraRemover = ref<EntradaNaFila | null>(null)
const confirmandoRemocao = ref(false)

function pedirRemocao(entrada: EntradaNaFila) {
  paraRemover.value = entrada
  confirmandoRemocao.value = true
}

async function remover() {
  const alvo = paraRemover.value
  if (!alvo) return

  ocupado.value = alvo.id
  confirmandoRemocao.value = false

  try {
    await removerDaFila(alvo.id, parceiroQuery())
    toast.add({ severity: 'success', summary: t('fila.removido'), life: 3000 })
    recarregarTudo()
  } catch (err) {
    avisarErroDaOferta(err, alvo)
  } finally {
    ocupado.value = null
  }
}

/* -------------------------------------------------------------------------------- gavetas */

const entrarAberta = ref(false)
const vagasAbertas = ref(false)
</script>

<template>
  <UiPagina
    class="tela-fila"
    :titulo="t('clinico.fila.titulo')"
    :carregando="carregando && !jaCarregou"
    :erro="erro && !jaCarregou ? erro : ''"
    @tentar-de-novo="carregar"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template #acoes>
      <Button
        type="button"
        icon="ph ph-calendar-check"
        severity="secondary"
        :label="totalDeVagas ? t('fila.vagasComTotal', { n: totalDeVagas }) : t('fila.vagas')"
        @click="vagasAbertas = true"
      />
      <Button
        v-if="podeGerir"
        type="button"
        icon="ph ph-plus"
        :label="t('clinico.fila.adicionar')"
        @click="entrarAberta = true"
      />
    </template>

    <div class="fl">
      <SelectButton
        v-model="situacao"
        :options="opcoesDeSituacao"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('fila.situacaoRotulo')"
        class="fl__abas"
      />

      <p v-if="erro && jaCarregou" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>

      <ul v-if="carregando && !itens.length" class="ui-lista ui-folha" aria-busy="true">
        <li v-for="n in 3" :key="n" class="ui-linha">
          <Skeleton width="2.5rem" height="2.5rem" />
          <span class="ui-linha__texto">
            <Skeleton width="12rem" height="0.9rem" />
            <Skeleton width="16rem" height="0.8rem" />
          </span>
        </li>
      </ul>

      <div v-else-if="!itens.length" class="fl__vazio ui-folha">
        <strong>{{
          situacao === 'ATIVAS' ? t('clinico.fila.vazioTitulo') : t('fila.semNaoResponderam')
        }}</strong>
        <span v-if="situacao === 'ATIVAS'">{{ t('clinico.fila.vazioDescricao') }}</span>
      </div>

      <ul v-else class="ui-lista ui-folha">
        <li v-for="entrada in itens" :key="entrada.id" class="ui-linha fl__linha">
          <span
            class="fl__posicao"
            :class="{ 'fl__posicao--oferta': entrada.status !== 'AGUARDANDO' }"
          >
            <template v-if="entrada.posicao">
              <strong class="ui-num">{{ entrada.posicao }}º</strong>
            </template>
            <i
              v-else
              :class="entrada.status === 'EXPIRADO' ? 'ph ph-phone-x' : 'ph ph-paper-plane-tilt'"
              aria-hidden="true"
            />
          </span>

          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">
              {{ entrada.paciente.nome }} · {{ nomeDoTipo(entrada.tipoId) }}
            </strong>
            <span class="ui-linha__meta">
              {{ entrada.paciente.clienteNome }} ·
              {{ nomeDoProfissional(entrada.profissionalId) }} · {{ janelasDe(entrada) }}
            </span>
            <span v-if="entrada.agendamentoAtual" class="ui-linha__meta">
              {{
                t('fila.temHorario', { quando: quandoCurto(entrada.agendamentoAtual.inicio, intl) })
              }}
            </span>
            <span v-if="entrada.oferta" class="fl__oferta">
              <i class="ph ph-paper-plane-tilt" aria-hidden="true" />
              {{
                t(entrada.status === 'EXPIRADO' ? 'fila.ofertaVenceu' : 'fila.ofertaAte', {
                  horario: quandoCurto(entrada.oferta.inicio, intl),
                  prazo: prazoDa(entrada),
                })
              }}
              <span v-if="entrada.oferta.automatica" class="ui-selo">{{
                t('fila.automatica')
              }}</span>
              <span
                v-if="entrada.oferta.aviso?.motivoSemAviso === 'SEM_CANAL_NO_APP'"
                class="ui-selo ui-selo--atencao"
              >
                <i class="ph ph-phone" aria-hidden="true" />
                {{ t('fila.semCanalCurto') }}
              </span>
            </span>
            <span v-if="recusaDe(entrada)" class="ui-linha__meta">{{ recusaDe(entrada) }}</span>
          </span>

          <span class="ui-linha__fim fl__fim">
            <span
              v-if="entrada.prioridade !== 'NORMAL'"
              class="ui-selo"
              :class="entrada.prioridade === 'URGENTE' ? 'ui-selo--risco' : 'ui-selo--atencao'"
            >
              {{ t(`clinico.fila.prioridade.${entrada.prioridade.toLowerCase()}`) }}
            </span>
            <template v-if="entrada.status === 'OFERTADO' && podeGerir">
              <Button
                v-if="podeAceitar"
                type="button"
                size="small"
                :label="t('clinico.fila.aceitar')"
                :loading="ocupado === entrada.id"
                @click="aceitar(entrada)"
              />
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('clinico.fila.recusar')"
                :disabled="ocupado === entrada.id"
                @click="recusar(entrada)"
              />
            </template>
            <Button
              v-if="podeGerir"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-x"
              :aria-label="t('fila.removerDe', { nome: entrada.paciente.nome })"
              :title="t('clinico.fila.remover')"
              :disabled="ocupado === entrada.id"
              @click="pedirRemocao(entrada)"
            />
          </span>
        </li>
      </ul>

      <Button
        v-if="proximoCursor"
        type="button"
        severity="secondary"
        outlined
        class="fl__mais"
        :label="t('pedidos.caixa.verMais')"
        @click="carregarMais"
      />
    </div>

    <EntrarNaFilaGaveta
      v-model:visible="entrarAberta"
      :tipos="tipos"
      :profissionais="profissionais.filter((item) => item.atendeNaAgenda)"
      @entrou="recarregarTudo"
    />

    <VagasGaveta
      v-model:visible="vagasAbertas"
      :tipos="tipos"
      :profissionais="profissionais"
      :prazo-minutos="prazoMinutos"
      :pode-ofertar="podeGerir"
      @ofertou="recarregarTudo"
    />

    <ConfirmActionDialog
      v-model:visible="confirmandoRemocao"
      :title="t('fila.removerTitulo', { nome: paraRemover?.paciente.nome ?? '' })"
      :message="t('fila.removerTexto')"
      :confirm-label="t('clinico.fila.remover')"
      :cancel-label="t('cadastro.cancelar')"
      severity="danger"
      @confirm="remover"
    />
  </UiPagina>
</template>

<style scoped>
.fl {
  display: grid;
  gap: 16px;
}

.fl__abas {
  justify-self: start;
}

.fl__vazio {
  display: grid;
  gap: 4px;
  color: var(--tinta-2);
  font-size: 14px;
}

.fl__vazio strong {
  color: var(--tinta);
}

.fl__linha {
  flex-wrap: wrap;
}

.fl__linha > .ui-linha__texto {
  flex: 1 1 16rem;
  min-width: 12rem;
}

.fl__posicao {
  display: inline-grid;
  place-items: center;
  flex: 0 0 2.5rem;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  background: var(--superficie-2, var(--linha-suave));
  color: var(--tinta);
  font-size: 14px;
}

.fl__posicao--oferta {
  color: var(--atencao-tinta);
}

.fl__oferta {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  color: var(--tinta);
  font-size: 13px;
}

.fl__fim {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-inline-start: auto;
}

.fl__mais {
  justify-self: center;
}
</style>
