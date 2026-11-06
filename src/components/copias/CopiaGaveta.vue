<script setup lang="ts">
/**
 * O pedido de cópia do prontuário (E4-06c, guia e4 10.2): quem pediu, o prazo e o que falta.
 *
 * - Gerar roda em segundo plano (202, `GERANDO`): a gaveta relê o pedido a cada 2,5 s até sair
 *   desse status. Falhou: volta ao aberto com `geracaoErro`. Mais de 500 atendimentos: 422
 *   `COPIA_GRANDE_DEMAIS`, e a gaveta pede um período.
 * - Pronto: o PDF abre por uma URL de 15 minutos; os laudos que não couberam vão à parte, listados
 *   abaixo do botão. O PDF fica 7 dias; depois disso, gera de novo.
 * - Entregar fecha o pedido (em mãos ou pelo e-mail do responsável). Do app, a entrega se registra
 *   sozinha quando o dono baixa.
 * - Prorrogar (uma vez, antes de vencer) e recusar são do responsável técnico: pedem o CRMV
 *   conferido de quem clica. O botão fica à vista com a explicação.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { motivoDaRecusa, useSeloDeAssinatura } from '@/composables/useSeloDeAssinatura'
import { ApiError } from '@/service/api'
import type { AtoLegal } from '@/service/contrato/openapi'
import {
  entregarCopia,
  gerarCopia,
  lerPedidoDeCopia,
  pdfDaCopia,
  pedidoAberto,
  prorrogarPedidoDeCopia,
  recusarPedidoDeCopia,
  RELER_GERACAO_MS,
  TEXTO_MAX,
  TEXTO_MIN,
  type PedidoDeCopia,
  type UrlDaCopia,
} from '@/service/parceiro/copias-service'
import { abrirAbaVazia, levarAoArquivo } from '@/utils/arquivo-assinado'

import { useFrasesDaCopia } from './useFrasesDaCopia'

const props = defineProps<{
  escolhido: PedidoDeCopia | null
  podeEscrever: boolean
  /** O recado de quem abriu (o pedido do balcão acabou de ser registrado). */
  recado?: string
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ mudou: [pedido: PedidoDeCopia] }>()

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const frases = useFrasesDaCopia()
const selo = useSeloDeAssinatura()
const { parceiroQuery } = useParceiroPortal()

type Modo = 'detalhe' | 'periodo' | 'prorrogar' | 'recusar'

const atual = ref<PedidoDeCopia | null>(null)
const modo = ref<Modo>('detalhe')
const texto = ref('')
const intervalo = ref<Date[] | null>(null)
const canal = ref<'MAOS' | 'EMAIL_DO_RESPONSAVEL'>('MAOS')
const arquivo = ref<UrlDaCopia | null>(null)
const tentou = ref(false)
const salvando = ref(false)
const baixando = ref(false)
const erro = ref('')
const conselho = ref('')

let relendo: ReturnType<typeof setTimeout> | null = null

function pararDeReler() {
  if (relendo) clearTimeout(relendo)
  relendo = null
}

function trocar(pedido: PedidoDeCopia) {
  atual.value = pedido
  emit('mudou', pedido)
  if (pedido.status === 'GERANDO') relerDepois()
  else pararDeReler()
}

/** Relê o pedido que está gerando até ele sair de `GERANDO` (ou a gaveta fechar). */
function relerDepois() {
  pararDeReler()
  relendo = setTimeout(async () => {
    relendo = null
    const id = atual.value?.id
    if (!aberta.value || !id) return
    try {
      const lido = await lerPedidoDeCopia(id, parceiroQuery())
      if (!aberta.value || atual.value?.id !== id) return
      trocar(lido)
    } catch {
      /* Uma leitura que caiu não para a espera: tenta de novo no mesmo ritmo. */
      if (aberta.value) relerDepois()
    }
  }, RELER_GERACAO_MS)
}

watch(aberta, (agora) => {
  if (!agora) {
    pararDeReler()
    return
  }
  atual.value = props.escolhido
  modo.value = 'detalhe'
  texto.value = ''
  intervalo.value = null
  canal.value = 'MAOS'
  arquivo.value = null
  tentou.value = false
  erro.value = ''
  conselho.value = ''
  if (props.escolhido?.status === 'GERANDO') relerDepois()
})

onBeforeUnmount(pararDeReler)

/* ------------------------------------------------------------------------- o que pode */

const pedido = computed(() => atual.value)
const status = computed(() => pedido.value?.status ?? null)
const emAberto = computed(() => Boolean(status.value && pedidoAberto(status.value)))
const gerando = computed(() => status.value === 'GERANDO')

const podeGerar = computed(
  () =>
    props.podeEscrever &&
    (status.value === 'ABERTO' ||
      status.value === 'PRORROGADO' ||
      (status.value === 'PRONTO' && !pedido.value?.pdfDisponivel)),
)
const podeBaixar = computed(() => status.value === 'PRONTO' && Boolean(pedido.value?.pdfDisponivel))
const podeEntregar = computed(() => props.podeEscrever && podeBaixar.value)
const podeProrrogar = computed(
  () =>
    props.podeEscrever &&
    status.value === 'ABERTO' &&
    !pedido.value?.venceEmProrrogado &&
    !pedido.value?.vencido,
)
const podeRecusar = computed(() => props.podeEscrever && emAberto.value && !gerando.value)

function aguarda(ato: AtoLegal) {
  return selo.atoAguarda(ato)
}

const avisoDoSelo = computed(() => {
  const prorrogar = podeProrrogar.value && aguarda('PRORROGAR_COPIA')
  const recusar = podeRecusar.value && aguarda('RECUSAR_COPIA')
  if (!prorrogar && !recusar) return ''
  return t(`copias.selo.${selo.motivo.value ?? 'SEM_SELO'}`)
})

const opcoesDeCanal = computed(() => [
  { valor: 'MAOS', rotulo: t('copias.canal.MAOS') },
  { valor: 'EMAIL_DO_RESPONSAVEL', rotulo: t('copias.canal.EMAIL_DO_RESPONSAVEL') },
])

const hoje = new Date()

/* ------------------------------------------------------------------------- os fatos */

const fatos = computed(() => {
  const item = pedido.value
  if (!item) return []
  const linhas: { rotulo: string; valor: string; tom?: string }[] = [
    { rotulo: t('copias.fato.quem'), valor: frases.quemPediu(item) },
    { rotulo: t('copias.fato.recebido'), valor: rotulos.data(item.recebidoEm) },
    { rotulo: t('copias.fato.periodo'), valor: frases.periodo(item) },
  ]
  if (pedidoAberto(item.status)) {
    linhas.push({
      rotulo: item.venceEmProrrogado ? t('copias.fato.prazoProrrogado') : t('copias.fato.prazo'),
      valor: item.vencido
        ? t('copias.venceuEm', { dia: rotulos.dia(item.prazo) })
        : rotulos.dia(item.prazo),
      tom: item.vencido ? 'risco' : undefined,
    })
  }
  if (item.atendimentosIncluidos !== null && item.status !== 'RECUSADO') {
    linhas.push({
      rotulo: t('copias.fato.conteudo'),
      valor: [
        t('copias.atendimentos', { n: item.atendimentosIncluidos }, item.atendimentosIncluidos),
        item.laudosEmbutidos
          ? t('copias.laudosNoPdf', { n: item.laudosEmbutidos }, item.laudosEmbutidos)
          : '',
        item.laudosForaDoPdf
          ? t('copias.laudosAParte', { n: item.laudosForaDoPdf }, item.laudosForaDoPdf)
          : '',
      ]
        .filter(Boolean)
        .join(' · '),
    })
  }
  if (item.guardarAte && item.pdfDisponivel) {
    linhas.push({ rotulo: t('copias.fato.guardado'), valor: rotulos.data(item.guardarAte) })
  }
  if (item.entregueEm) {
    linhas.push({
      rotulo: t('copias.fato.entregue'),
      valor: [
        rotulos.data(item.entregueEm),
        item.canalDeEntrega ? t(`copias.canal.${item.canalDeEntrega}`) : '',
      ]
        .filter(Boolean)
        .join(' · '),
    })
  }
  if (item.justificativa) {
    linhas.push({ rotulo: t('copias.fato.justificativa'), valor: item.justificativa })
  }
  if (item.motivoRecusa) {
    linhas.push({ rotulo: t('copias.fato.motivo'), valor: item.motivoRecusa })
  }
  return linhas
})

/* ------------------------------------------------------------------------- as ações */

function lerFalha(err: unknown, generico: string) {
  const recusa = motivoDaRecusa(err)
  if (recusa) return t(`copias.selo.${recusa}`)
  return lerErroDoCadastro(err, generico).mensagem
}

function dia(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const d = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${d}`
}

async function gerar() {
  const item = pedido.value
  if (!item) return
  tentou.value = true
  erro.value = ''
  conselho.value = ''
  let periodo: { de?: string; ate?: string } = {}
  if (modo.value === 'periodo') {
    const [de, ate] = intervalo.value ?? []
    if (!de || !ate) return
    periodo = { de: dia(de), ate: dia(ate) }
  }
  salvando.value = true
  try {
    const depois = await gerarCopia(item.id, periodo, parceiroQuery())
    modo.value = 'detalhe'
    tentou.value = false
    arquivo.value = null
    trocar(depois)
  } catch (err) {
    if (err instanceof ApiError && err.codigo === 'COPIA_GRANDE_DEMAIS') {
      const detalhes = err.detalhes ?? {}
      conselho.value = t('copias.grandeDemais', {
        n: Number(detalhes.atendimentos) || 0,
        maximo: Number(detalhes.maximo) || 500,
      })
      modo.value = 'periodo'
      tentou.value = false
      return
    }
    erro.value = lerFalha(err, t('copias.erro.gerar'))
  } finally {
    salvando.value = false
  }
}

async function baixar() {
  const item = pedido.value
  if (!item) return
  baixando.value = true
  erro.value = ''
  const janela = abrirAbaVazia()
  try {
    const lido = await pdfDaCopia(item.id, parceiroQuery())
    arquivo.value = lido
    levarAoArquivo(janela, lido.url)
  } catch (err) {
    janela?.close()
    if (err instanceof ApiError && err.codigo === 'COPIA_PDF_EXPIRADO') {
      /* O PDF saiu da guarda: o pedido segue pronto e pode gerar de novo. */
      trocar({ ...item, pdfDisponivel: false })
    }
    erro.value = lerFalha(err, t('copias.erro.pdf'))
  } finally {
    baixando.value = false
  }
}

async function entregar() {
  const item = pedido.value
  if (!item) return
  erro.value = ''
  salvando.value = true
  try {
    trocar(await entregarCopia(item.id, canal.value, parceiroQuery()))
  } catch (err) {
    erro.value = lerFalha(err, t('copias.erro.entregar'))
  } finally {
    salvando.value = false
  }
}

const textoValido = computed(() => texto.value.trim().length >= TEXTO_MIN)

async function confirmarTexto() {
  const item = pedido.value
  if (!item) return
  tentou.value = true
  erro.value = ''
  if (!textoValido.value) return
  salvando.value = true
  try {
    const depois =
      modo.value === 'prorrogar'
        ? await prorrogarPedidoDeCopia(item.id, texto.value.trim(), parceiroQuery())
        : await recusarPedidoDeCopia(item.id, texto.value.trim(), parceiroQuery())
    modo.value = 'detalhe'
    texto.value = ''
    tentou.value = false
    trocar(depois)
  } catch (err) {
    erro.value = lerFalha(
      err,
      modo.value === 'prorrogar' ? t('copias.erro.prorrogar') : t('copias.erro.recusar'),
    )
  } finally {
    salvando.value = false
  }
}

function entrarNoModo(novo: Modo) {
  modo.value = novo
  texto.value = ''
  tentou.value = false
  erro.value = ''
  if (novo === 'periodo' && !intervalo.value) {
    const item = pedido.value
    const de = item?.de ? new Date(`${item.de}T12:00:00`) : null
    const ate = item?.ate ? new Date(`${item.ate}T12:00:00`) : null
    intervalo.value = de && ate ? [de, ate] : null
  }
}

const tituloDoModo = computed(() => {
  if (modo.value === 'prorrogar') return t('copias.prorrogar.titulo')
  if (modo.value === 'recusar') return t('copias.recusar.titulo')
  return pedido.value?.pacienteNome ?? t('copias.titulo')
})
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="tituloDoModo"
    icone="ph ph-copy"
    largura="34rem"
  >
    <div v-if="pedido" class="eg cg">
      <!-- O pedido: quem, quando, prazo, conteúdo. -->
      <template v-if="modo === 'detalhe' || modo === 'periodo'">
        <p v-if="recado" class="eg__aviso cg__recado" role="status">
          <i class="ph ph-check-circle" aria-hidden="true" />
          <span>{{ recado }}</span>
        </p>
        <p class="cg__estado">
          <span
            class="ui-selo"
            :class="{
              'ui-selo--ok': pedido.status === 'ENTREGUE',
              'ui-selo--risco': pedido.vencido && emAberto,
            }"
            >{{ t(`copias.status.${pedido.status}`) }}</span
          >
        </p>

        <dl class="cg__fatos">
          <div v-for="fato in fatos" :key="fato.rotulo" class="cg__fato">
            <dt>{{ fato.rotulo }}</dt>
            <dd :class="fato.tom ? `cg__fato--${fato.tom}` : ''">{{ fato.valor }}</dd>
          </div>
        </dl>

        <p
          v-if="pedido.vinculoAnteriorComOutroDono && pedido.origem === 'BALCAO'"
          class="eg__aviso"
        >
          <i class="ph ph-warning" aria-hidden="true" />
          <span>{{ t('copias.outroDono') }}</span>
        </p>
        <p v-if="pedido.historicoDesde" class="eg__dica">
          {{ t('copias.historicoDesde', { dia: rotulos.dia(pedido.historicoDesde.slice(0, 10)) }) }}
        </p>
        <p v-if="pedido.status === 'ENCERRADO_NA_EXCLUSAO'" class="eg__dica">
          {{ t('copias.encerradoNaExclusao') }}
        </p>
        <p v-if="pedido.origem === 'APP' && podeBaixar" class="eg__dica">
          {{ t('copias.entregaPeloApp') }}
        </p>

        <p v-if="gerando" class="eg__aviso cg__gerando" role="status">
          <i class="ph ph-spinner-gap cg__girando" aria-hidden="true" />
          <span>{{ t('copias.gerando') }}</span>
        </p>
        <p v-else-if="pedido.geracaoErro && podeGerar" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ frases.falha(pedido.geracaoErro) }}</span>
        </p>
        <p v-if="status === 'PRONTO' && !pedido.pdfDisponivel" class="eg__dica">
          {{ t('copias.pdfSaiu') }}
        </p>

        <!-- Gerar com outro período (ou o período que o 422 pediu). -->
        <section v-if="modo === 'periodo'" class="eg__secao">
          <span id="cg-periodo" class="eg__rotulo">{{ t('copias.escolherPeriodo') }}</span>
          <p v-if="conselho" class="eg__aviso">
            <i class="ph ph-info" aria-hidden="true" />
            <span>{{ conselho }}</span>
          </p>
          <DatePicker
            v-model="intervalo"
            inline
            selection-mode="range"
            :manual-input="false"
            :max-date="hoje"
            aria-labelledby="cg-periodo"
            :invalid="tentou && !(intervalo?.[0] && intervalo?.[1])"
            :disabled="salvando"
          />
          <small v-if="tentou && !(intervalo?.[0] && intervalo?.[1])" class="eg__invalido">{{
            t('copias.periodoObrigatorio')
          }}</small>
        </section>

        <!-- O PDF pronto e os laudos que vão à parte. -->
        <section v-if="podeBaixar" class="eg__secao">
          <span class="eg__rotulo">{{ t('copias.arquivo') }}</span>
          <div class="cg__botoes">
            <Button
              type="button"
              icon="ph ph-file-pdf"
              severity="secondary"
              outlined
              :label="t('copias.baixar')"
              :loading="baixando"
              @click="baixar"
            />
          </div>
          <ul v-if="arquivo?.laudosForaDoPdf.length" class="cg__laudos">
            <li v-for="laudo in arquivo.laudosForaDoPdf" :key="laudo.id">
              <a :href="laudo.url" target="_blank" rel="noopener">
                <i class="ph ph-file" aria-hidden="true" />
                {{ laudo.exame }}
              </a>
              <span class="cg__laudo-dia">{{ rotulos.dia(laudo.dataDoResultado) }}</span>
            </li>
          </ul>
          <small v-else-if="pedido.laudosForaDoPdf" class="eg__dica">{{
            t('copias.laudosAParteDica', { n: pedido.laudosForaDoPdf }, pedido.laudosForaDoPdf)
          }}</small>
        </section>

        <section v-if="podeEntregar" class="eg__secao">
          <span id="cg-canal" class="eg__rotulo">{{ t('copias.comoEntregou') }}</span>
          <SelectButton
            v-model="canal"
            :options="opcoesDeCanal"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="cg-canal"
            :disabled="salvando"
          />
        </section>

        <!-- Prorrogar e recusar: do responsável técnico. -->
        <section v-if="(podeProrrogar || podeRecusar) && modo === 'detalhe'" class="eg__secao">
          <span class="eg__rotulo">{{ t('copias.doResponsavel') }}</span>
          <div class="cg__botoes">
            <Button
              v-if="podeProrrogar"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-calendar-plus"
              :label="t('copias.prorrogar.acao')"
              :disabled="salvando"
              @click="entrarNoModo('prorrogar')"
            />
            <Button
              v-if="podeRecusar"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-x-circle"
              :label="t('copias.recusar.acao')"
              :disabled="salvando"
              @click="entrarNoModo('recusar')"
            />
          </div>
          <small v-if="avisoDoSelo" class="eg__dica cg__selo">
            <i class="ph ph-seal-warning" aria-hidden="true" />
            {{ avisoDoSelo }}
          </small>
        </section>
      </template>

      <!-- Prorrogar ou recusar: o texto que fica no pedido. -->
      <template v-else>
        <p class="eg__dica">
          {{
            modo === 'prorrogar'
              ? t('copias.prorrogar.dica')
              : t('copias.recusar.dica', { nome: pedido.pacienteNome })
          }}
        </p>
        <section class="eg__secao">
          <label class="eg__rotulo" for="cg-texto">{{
            modo === 'prorrogar' ? t('copias.prorrogar.justificativa') : t('copias.recusar.motivo')
          }}</label>
          <Textarea
            id="cg-texto"
            v-model="texto"
            rows="4"
            auto-resize
            :maxlength="TEXTO_MAX"
            :invalid="tentou && !textoValido"
            :disabled="salvando"
          />
          <small class="eg__dica">{{ t('copias.textoDica', { min: TEXTO_MIN }) }}</small>
        </section>
      </template>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </div>

    <template #pe>
      <template v-if="modo === 'prorrogar' || modo === 'recusar'">
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.voltar')"
          :disabled="salvando"
          @click="entrarNoModo('detalhe')"
        />
        <Button
          type="button"
          :severity="modo === 'recusar' ? 'danger' : undefined"
          :icon="modo === 'recusar' ? 'ph ph-x-circle' : 'ph ph-calendar-plus'"
          :label="
            modo === 'recusar' ? t('copias.recusar.confirmar') : t('copias.prorrogar.confirmar')
          "
          :loading="salvando"
          @click="confirmarTexto"
        />
      </template>
      <template v-else>
        <Button
          v-if="modo === 'periodo'"
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.voltar')"
          :disabled="salvando"
          @click="entrarNoModo('detalhe')"
        />
        <Button
          v-else
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.fechar')"
          @click="aberta = false"
        />
        <Button
          v-if="podeGerar && modo === 'detalhe'"
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-calendar-dots"
          :label="t('copias.outroPeriodo')"
          :disabled="salvando"
          @click="entrarNoModo('periodo')"
        />
        <Button
          v-if="podeGerar"
          type="button"
          icon="ph ph-file-arrow-down"
          :label="status === 'PRONTO' ? t('copias.gerarDeNovo') : t('copias.gerar')"
          :loading="salvando"
          @click="gerar"
        />
        <Button
          v-else-if="gerando"
          type="button"
          icon="ph ph-file-arrow-down"
          :label="t('copias.gerar')"
          loading
          disabled
        />
        <Button
          v-else-if="podeEntregar"
          type="button"
          icon="ph ph-hand-arrow-up"
          :label="t('copias.entregar')"
          :loading="salvando"
          @click="entregar"
        />
      </template>
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.cg__recado i {
  color: var(--ok-tinta);
}

.cg__estado {
  margin: 0;
}

.cg__fatos {
  display: grid;
  gap: 0;
  margin: 0;
}

.cg__fato {
  display: grid;
  grid-template-columns: minmax(8rem, 11rem) 1fr;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--linha);
  font-size: 14px;
  line-height: 1.45;
}

.cg__fato:first-child {
  padding-top: 0;
}

.cg__fato dt {
  color: var(--tinta-2);
}

.cg__fato dd {
  margin: 0;
  color: var(--tinta);
  overflow-wrap: anywhere;
}

.cg__fato--risco {
  color: var(--risco-tinta);
  font-weight: 600;
}

.cg__botoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cg__laudos {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}

.cg__laudos li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cg__laudos a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
}

.cg__laudo-dia {
  color: var(--tinta-2);
  font-size: 13px;
}

.cg__selo {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.cg__selo i {
  margin-top: 2px;
  color: var(--atencao-tinta);
}

.cg__girando {
  animation: cg-girar 1s linear infinite;
}

@keyframes cg-girar {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cg__girando {
    animation: none;
  }
}
</style>
