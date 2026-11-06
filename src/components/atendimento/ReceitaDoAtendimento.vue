<script setup lang="ts">
/**
 * A receita do atendimento (E4-03, PJ-L3V7JK; guia e4 6): as prescrições e as receitas, numa caixa
 * própria (a receita é o que sai do atendimento e vai para o responsável).
 *
 * - Prescrever, editar e remover no rascunho (a prescrição numa receita assinada fica congelada).
 * - "Fazer a receita" leva as prescrições livres a um rascunho com a prévia: o que sai no PDF e o
 *   que fica só na clínica, com a instrução do servidor (talonário oficial, SIPEAGRO, retenção).
 * - Assinar com a senha; abrir o PDF (URL de 15 minutos); cancelar com motivo; repetir num
 *   atendimento aberto do mesmo paciente.
 *
 * Receita só antes de finalizar (P1): o finalizar cobra a que falta (`PRESCRICAO_SEM_RECEITA`,
 * `RECEITA_EM_RASCUNHO`).
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { useSeloDeAssinatura } from '@/composables/useSeloDeAssinatura'
import type { Atendimento } from '@/service/parceiro/atendimentos-service'
import {
  criarReceita,
  descartarReceita,
  listarPrescricoes,
  listarReceitas,
  pdfDaReceita,
  PRESCRICOES_MAX,
  prescricoesLivres,
  removerPrescricao,
  type GravacaoDaPrescricao,
  type Prescricao,
  type Receita,
  type Repeticao,
} from '@/service/parceiro/receitas-service'

import AssinarReceitaGaveta from './AssinarReceitaGaveta.vue'
import CancelarReceitaGaveta from './CancelarReceitaGaveta.vue'
import PrescricaoGaveta from './PrescricaoGaveta.vue'
import RepetirReceitaGaveta from './RepetirReceitaGaveta.vue'
import './secao.css'
import { useRotulosDaReceita } from './useRotulosDaReceita'

const props = defineProps<{
  atendimento: Atendimento
  /** Esta aba tem o lock de um rascunho. */
  editando: boolean
  dispositivoId: string
  versao: () => number
  esperarGravar: () => Promise<boolean>
  /** O finalizar apontou a receita que falta. */
  falta?: boolean
}>()
const emit = defineEmits<{ versao: [versao: number]; mudou: [] }>()

const { t } = useI18n()
const toast = useToast()
const rotulos = useRotulosDoCadastro()
const receitaNaTela = useRotulosDaReceita()
const selo = useSeloDeAssinatura()
const { store, parceiroQuery } = useParceiroPortal()

const clinicaEscreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
const podePrescrever = computed(
  () => props.editando && clinicaEscreve.value && store.temPermissao('prontuario.escrever'),
)
const podeAssinar = computed(() => clinicaEscreve.value && store.temPermissao('receita.assinar'))
const podeRepetir = computed(
  () => clinicaEscreve.value && store.temPermissao('prontuario.escrever'),
)
const aguardaSelo = computed(() => selo.permissaoAguarda('receita.assinar'))

/* ------------------------------------------------------------------------------ leitura */

const prescricoes = ref<Prescricao[]>([])
const receitas = ref<Receita[]>([])
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const [lista, listaDeReceitas] = await Promise.all([
      listarPrescricoes(props.atendimento.id, parceiroQuery()),
      listarReceitas(props.atendimento.id, parceiroQuery()),
    ])
    prescricoes.value = lista.itens
    receitas.value = listaDeReceitas.itens
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('atendimento.receita.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)
watch(
  () => props.atendimento.id,
  () => void carregar(),
)

const livres = computed(() => prescricoesLivres(prescricoes.value))
const rascunho = computed(() => receitas.value.find((r) => r.status === 'RASCUNHO') ?? null)
const fechadas = computed(() => receitas.value.filter((r) => r.status !== 'RASCUNHO'))

function situacaoDa(item: Prescricao) {
  if (item.receitaStatus === 'ASSINADA') return t('atendimento.receita.naReceitaAssinada')
  if (item.receitaStatus === 'RASCUNHO') return t('atendimento.receita.noRascunho')
  if (item.receitaStatus === 'CANCELADA') return t('atendimento.receita.naCancelada')
  return null
}

function meta(item: Prescricao) {
  return [
    item.dose,
    t(`clinico.bulario.api.via.${item.via}`),
    receitaNaTela.frequencia(item.frequenciaHoras),
    receitaNaTela.duracao(item.duracaoDias),
  ].join(' · ')
}

function avisos(item: Prescricao) {
  return item.avisosNoAto
    .map((codigo) => receitaNaTela.avisoNoAto(codigo))
    .filter((texto): texto is string => Boolean(texto))
}

/* ------------------------------------------------------------------------- prescrever */

const prescricaoAberta = ref(false)
const emEdicao = ref<Prescricao | null>(null)

function prescrever(item: Prescricao | null = null) {
  emEdicao.value = item
  prescricaoAberta.value = true
}

function gravada(gravacao: GravacaoDaPrescricao) {
  emit('versao', gravacao.versao)
  const avisosDaConta = gravacao.avisos.filter((aviso) => !aviso.bloqueante)
  toast.add({
    severity: avisosDaConta.length ? 'warn' : 'success',
    summary: t('atendimento.receita.prescrever.feito'),
    detail: avisosDaConta
      .map((aviso) => receitaNaTela.avisoNoAto(aviso.codigo) ?? aviso.detalhe)
      .filter(Boolean)
      .join(' · '),
    life: 4000,
  })
  void carregar()
  emit('mudou')
}

const removendo = ref<string | null>(null)

async function remover(item: Prescricao) {
  removendo.value = item.id
  try {
    const gravou = await props.esperarGravar()
    if (!gravou) return
    const { versao } = await removerPrescricao(
      props.atendimento.id,
      item.id,
      { versao: props.versao(), dispositivoId: props.dispositivoId },
      parceiroQuery(),
    )
    emit('versao', versao)
    void carregar()
    emit('mudou')
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('atendimento.receita.erroRemover')).mensagem,
      life: 6000,
    })
  } finally {
    removendo.value = null
  }
}

/* ---------------------------------------------------------------------------- receita */

const fazendo = ref(false)
const assinarAberta = ref(false)
const paraAssinar = ref<Receita | null>(null)

async function fazerReceita() {
  fazendo.value = true
  try {
    const nova = await criarReceita(
      props.atendimento.id,
      livres.value.map((item) => item.id),
      parceiroQuery(),
    )
    emit('versao', nova.versaoDoAtendimento)
    await carregar()
    emit('mudou')
    if (podeAssinar.value) abrirAssinar(nova)
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('atendimento.receita.erroFazer')).mensagem,
      life: 6000,
    })
  } finally {
    fazendo.value = false
  }
}

function abrirAssinar(receita: Receita) {
  paraAssinar.value = receita
  assinarAberta.value = true
}

function assinada(receita: Receita) {
  emit('versao', receita.versaoDoAtendimento)
  toast.add({ severity: 'success', summary: t('atendimento.receita.assinar.feito'), life: 4000 })
  void carregar()
  emit('mudou')
}

const descartando = ref(false)

async function descartar(receita: Receita) {
  descartando.value = true
  try {
    const { versao } = await descartarReceita(receita.id, parceiroQuery())
    emit('versao', versao)
    assinarAberta.value = false
    await carregar()
    emit('mudou')
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('atendimento.receita.erroDescartar')).mensagem,
      life: 6000,
    })
  } finally {
    descartando.value = false
  }
}

const abrindoPdf = ref<string | null>(null)

/** A janela abre no toque (o navegador bloqueia a que abre depois de esperar a rede). */
async function abrirPdf(receita: Receita) {
  abrindoPdf.value = receita.id
  const janela = window.open('', '_blank')
  try {
    const lido = await pdfDaReceita(receita.id, parceiroQuery())
    if (lido.url && janela) janela.location.href = lido.url
    else janela?.close()
  } catch (err) {
    janela?.close()
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('atendimento.receita.erroPdf')).mensagem,
      life: 6000,
    })
  } finally {
    abrindoPdf.value = null
  }
}

const cancelarAberta = ref(false)
const paraCancelar = ref<Receita | null>(null)

function abrirCancelar(receita: Receita) {
  paraCancelar.value = receita
  cancelarAberta.value = true
}

function cancelada() {
  toast.add({ severity: 'success', summary: t('atendimento.receita.cancelar.feito'), life: 4000 })
  void carregar()
  emit('mudou')
}

const repetirAberta = ref(false)
const paraRepetir = ref<Receita | null>(null)

function abrirRepetir(receita: Receita) {
  paraRepetir.value = receita
  repetirAberta.value = true
}

function repetida(repeticao: Repeticao) {
  toast.add({
    severity: repeticao.omitidos.length ? 'warn' : 'success',
    summary: t(
      'atendimento.receita.repetir.feito',
      { n: repeticao.criadas.length },
      repeticao.criadas.length,
    ),
    detail: repeticao.omitidos.length
      ? t('atendimento.receita.repetir.omitidos', {
          nomes: repeticao.omitidos.map((item) => item.nome).join(', '),
        })
      : undefined,
    life: 8000,
  })
}

function nomeDoItem(receita: Receita) {
  return receita.itens.map((item) => item.nome).join(', ')
}
</script>

<template>
  <section class="ui-folha ui-cartao sa rc" aria-labelledby="sa-receita" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-prescription" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="sa-receita" class="ui-cartao__titulo">{{ t('atendimento.secao.RECEITA') }}</h2>
        <p class="ui-cartao__descricao">{{ t('atendimento.receita.descricao') }}</p>
      </span>
      <span class="ui-cartao__acoes">
        <Button
          v-if="podePrescrever && prescricoes.length < PRESCRICOES_MAX"
          type="button"
          size="small"
          icon="ph ph-plus"
          :label="t('atendimento.receita.prescrever.titulo')"
          @click="prescrever()"
        />
      </span>
    </header>

    <div class="sa__form">
      <p v-if="erro" class="sa__erro rc__nota" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ erro }}
      </p>
      <p v-if="falta" class="sa__erro rc__nota" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t('atendimento.receita.falta') }}
      </p>

      <!-- As prescrições. -->
      <section class="sa__grupo" aria-labelledby="rc-prescricoes">
        <div class="sa__sobre">
          <h3 id="rc-prescricoes" class="sa__titulo">{{ t('atendimento.receita.prescricoes') }}</h3>
          <p class="sa__descricao">{{ t('atendimento.receita.prescricoesDica') }}</p>
        </div>
        <div class="sa__campos">
          <ul v-if="prescricoes.length" class="sa__lista rc__lista">
            <li v-for="item in prescricoes" :key="item.id" class="rc__item">
              <span class="rc__texto">
                <strong class="rc__nome">
                  {{ item.medicamentoNome }}
                  <span v-if="item.critico" class="ui-selo ui-selo--atencao">{{
                    t('atendimento.receita.critico')
                  }}</span>
                  <span v-if="situacaoDa(item)" class="ui-selo ui-selo--contorno">{{
                    situacaoDa(item)
                  }}</span>
                </strong>
                <span class="rc__meta">{{ meta(item) }}</span>
                <small v-if="item.instrucoes" class="rc__instrucoes">{{ item.instrucoes }}</small>
                <small v-if="avisos(item).length" class="rc__avisos">
                  <i class="ph ph-warning" aria-hidden="true" />
                  {{ avisos(item).join(' · ') }}
                </small>
              </span>
              <span v-if="item.editavel && podePrescrever" class="rc__acoes">
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="ph ph-pencil-simple"
                  :aria-label="t('atendimento.receita.editarDe', { nome: item.medicamentoNome })"
                  @click="prescrever(item)"
                />
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="ph ph-trash"
                  :aria-label="t('atendimento.receita.removerDe', { nome: item.medicamentoNome })"
                  :loading="removendo === item.id"
                  @click="remover(item)"
                />
              </span>
            </li>
          </ul>
          <p v-else-if="!carregando" class="sa__vazio">{{ t('atendimento.receita.nenhuma') }}</p>

          <div v-if="livres.length && !rascunho && podePrescrever" class="rc__fazer">
            <Button
              type="button"
              size="small"
              icon="ph ph-file-text"
              :label="t('atendimento.receita.fazer')"
              :loading="fazendo"
              @click="fazerReceita"
            />
            <small class="eg__dica">{{ t('atendimento.receita.fazerDica') }}</small>
          </div>
        </div>
      </section>

      <!-- As receitas. -->
      <section v-if="rascunho || fechadas.length" class="sa__grupo" aria-labelledby="rc-receitas">
        <div class="sa__sobre">
          <h3 id="rc-receitas" class="sa__titulo">{{ t('atendimento.receita.receitas') }}</h3>
          <p class="sa__descricao">{{ t('atendimento.receita.receitasDica') }}</p>
        </div>
        <ul class="sa__campos sa__lista">
          <li v-if="rascunho" class="rc__receita">
            <span class="rc__texto">
              <strong class="rc__nome">
                {{ t('atendimento.receita.rascunho') }}
                <span class="ui-selo ui-selo--atencao">{{
                  t('atendimento.receita.porAssinar')
                }}</span>
              </strong>
              <span class="rc__meta">{{ nomeDoItem(rascunho) }}</span>
              <small v-for="fora in rascunho.foraDoPdf" :key="fora.prescricaoId" class="rc__fora">
                <i class="ph ph-info" aria-hidden="true" />
                {{ fora.instrucao }}
              </small>
              <small v-if="aguardaSelo && podeAssinar" class="rc__fora">
                <i class="ph ph-seal-warning" aria-hidden="true" />
                {{ t(`settings.identidade.selo.${selo.motivo.value ?? 'SEM_SELO'}`) }}
              </small>
            </span>
            <span class="rc__acoes">
              <Button
                v-if="podePrescrever"
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('atendimento.receita.descartar')"
                :loading="descartando"
                @click="descartar(rascunho)"
              />
              <Button
                v-if="podeAssinar"
                type="button"
                size="small"
                icon="ph ph-signature"
                :label="t('atendimento.receita.assinar.acao')"
                @click="abrirAssinar(rascunho)"
              />
            </span>
          </li>
          <li
            v-for="receita in fechadas"
            :key="receita.id"
            class="rc__receita"
            :class="{ 'rc__receita--cancelada': receita.status === 'CANCELADA' }"
          >
            <span class="rc__texto">
              <strong class="rc__nome">
                <span class="rc__titulo-da-receita">
                  {{ t('atendimento.receita.codigo', { codigo: receita.codigoVerificador ?? '' }) }}
                </span>
                <span v-if="receita.status === 'CANCELADA'" class="ui-selo">{{
                  t('atendimento.receita.cancelada')
                }}</span>
              </strong>
              <span class="rc__meta">
                {{
                  [
                    receita.emitidaEm
                      ? t('atendimento.receita.emitida', {
                          dia: rotulos.dia(receita.emitidaEm.slice(0, 10)),
                        })
                      : '',
                    receita.validaAte
                      ? t('atendimento.receita.validaAte', { dia: rotulos.dia(receita.validaAte) })
                      : '',
                    receita.prescritorNome,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }}
              </span>
              <span class="rc__meta">{{ nomeDoItem(receita) }}</span>
              <small v-if="receita.cancelamento" class="rc__fora">
                {{
                  t('atendimento.receita.motivoDoCancelamento', {
                    motivo: receita.cancelamento.motivo,
                  })
                }}
              </small>
            </span>
            <span v-if="receita.status === 'ASSINADA'" class="rc__acoes">
              <Button
                v-if="receita.pdfDisponivel"
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-file-pdf"
                :label="t('atendimento.receita.abrirPdf')"
                :loading="abrindoPdf === receita.id"
                @click="abrirPdf(receita)"
              />
              <Button
                v-if="podeRepetir"
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-arrows-clockwise"
                :label="t('atendimento.receita.repetir.acao')"
                @click="abrirRepetir(receita)"
              />
              <Button
                v-if="podeAssinar"
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('atendimento.receita.cancelar.acao')"
                @click="abrirCancelar(receita)"
              />
            </span>
          </li>
        </ul>
      </section>
    </div>

    <PrescricaoGaveta
      v-model:visible="prescricaoAberta"
      :atendimento-id="atendimento.id"
      :especie="atendimento.paciente.especie"
      :prescricao="emEdicao"
      :dispositivo-id="dispositivoId"
      :versao="versao"
      :esperar-gravar="esperarGravar"
      @gravada="gravada"
      @alterado="emit('mudou')"
    />
    <AssinarReceitaGaveta
      v-model:visible="assinarAberta"
      :receita="paraAssinar"
      :paciente-id="atendimento.paciente.id"
      @assinada="assinada"
      @descartar="paraAssinar && descartar(paraAssinar)"
    />
    <CancelarReceitaGaveta
      v-model:visible="cancelarAberta"
      :receita="paraCancelar"
      @cancelada="cancelada"
    />
    <RepetirReceitaGaveta
      v-model:visible="repetirAberta"
      :receita="paraRepetir"
      :paciente-id="atendimento.paciente.id"
      @repetida="repetida"
    />
  </section>
</template>

<style scoped>
.rc__nota {
  padding-top: 16px;
}

.rc__item,
.rc__receita {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 16px;
}

.rc__texto {
  display: grid;
  min-width: 0;
  flex: 1 1 18rem;
  gap: 3px;
}

.rc__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 14.5px;
}

.rc__meta {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.rc__instrucoes {
  color: var(--tinta-2);
  font-size: 13px;
  white-space: pre-line;
}

.rc__avisos,
.rc__fora {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
}

.rc__avisos i,
.rc__fora i {
  margin-top: 2px;
  color: var(--atencao-tinta);
}

.rc__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rc__fazer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.rc__receita--cancelada .rc__titulo-da-receita,
.rc__receita--cancelada .rc__meta {
  text-decoration: line-through;
}
</style>
