<script setup lang="ts">
/**
 * Os documentos da clínica toda (N35, `GET /parceiro/portal/clinica/documentos`): para onde leva o
 * selo de termos pendentes do menu (`/clinica/documentos?aceite=PENDENTE`). Abre em "Esperando
 * aceite", o mesmo recorte do contador (só os emitidos); "Todos" traz o resto, do mais novo.
 *
 * Cada linha traz o paciente (nome e espécie) e nunca o conteúdo do documento: a lista não o
 * recebe. O termo pendente registra o aceite no balcão ali mesmo; o emitido abre o PDF; o resto se
 * faz na ficha do paciente, pelo nome dele.
 *
 * O cursor é amarrado aos filtros: trocar qualquer um recomeça a lista do início, sem cursor
 * (reaproveitar dá 400 `CURSOR_INVALIDO`). A resposta de um filtro que já mudou é descartada.
 */
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import OpcaoDoPaciente from '@/components/cadastro/OpcaoDoPaciente.vue'
import { useListaAoClicar } from '@/components/cadastro/useListaAoClicar'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import type { PassoDoGuia } from '@/components/ui/UiPassos.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import {
  listarDocumentosDaClinica,
  pdfDoDocumento,
  STATUS_DO_DOCUMENTO,
  TERMOS,
  TIPOS_QUE_EMITEM,
  type DocumentoDaClinica,
  type FiltroDosDocumentosDaClinica,
  type StatusDoDocumento,
  type TipoDeDocumento,
} from '@/service/parceiro/documentos-service'
import { listarPacientes, type PacienteNaLista } from '@/service/parceiro/pacientes-service'
import { abrirAbaVazia, levarAoArquivo } from '@/utils/arquivo-assinado'

import AceiteGaveta from './AceiteGaveta.vue'

type Recorte = 'PENDENTE' | 'TODOS'

const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const podeEscrever = computed(
  () => Boolean(store.modulo('CLINICA')?.podeEscrever) && store.temPermissao('prontuario.escrever'),
)

/* ------------------------------------------------------------------------------ filtros */

function daRota<T extends string>(valor: unknown, validos: readonly T[]): T | null {
  return typeof valor === 'string' && (validos as readonly string[]).includes(valor)
    ? (valor as T)
    : null
}

/** Sem filtro na rota, abre em "Esperando aceite": é para isso que o selo traz alguém aqui. */
const recorte = computed<Recorte>(() => (route.query.aceite === 'TODOS' ? 'TODOS' : 'PENDENTE'))
const tipo = computed(() => daRota<TipoDeDocumento>(route.query.tipo, tiposDoRecorte.value))
const status = computed(() =>
  recorte.value === 'PENDENTE'
    ? null
    : daRota<StatusDoDocumento>(route.query.status, STATUS_DO_DOCUMENTO),
)
const paciente = ref<PacienteNaLista | null>(null)

/* Esperando aceite só existe nos termos, e só emitidos: os outros filtros encolhem junto. */
const tiposDoRecorte = computed(() => (recorte.value === 'PENDENTE' ? TERMOS : TIPOS_QUE_EMITEM))

function mudarQuery(mudanca: Record<string, string | undefined>) {
  const query = { ...route.query, ...mudanca }
  for (const [chave, valor] of Object.entries(query)) if (valor === undefined) delete query[chave]
  void router.replace({ query })
}

function trocarRecorte(valor: Recorte) {
  mudarQuery({ aceite: valor, status: undefined, tipo: undefined })
}

const opcoesDeRecorte = computed(() => [
  { valor: 'PENDENTE', rotulo: t('documentos.daClinica.recorte.PENDENTE') },
  { valor: 'TODOS', rotulo: t('documentos.daClinica.recorte.TODOS') },
])
const opcoesDeTipo = computed(() =>
  tiposDoRecorte.value.map((valor) => ({ valor, rotulo: t(`documentos.tipo.${valor}`) })),
)
const opcoesDeStatus = computed(() =>
  STATUS_DO_DOCUMENTO.map((valor) => ({ valor, rotulo: t(`documentos.status.${valor}`) })),
)

const { campo: campoDoPaciente, abrirLista } = useListaAoClicar()
const sugestoes = ref<PacienteNaLista[]>([])

async function buscarPaciente(evento: { query: string }) {
  try {
    const pagina = await listarPacientes({ q: evento.query, limit: 20 }, parceiroQuery())
    sugestoes.value = pagina.itens
  } catch {
    sugestoes.value = []
  }
}

function rotuloDoPaciente(item: PacienteNaLista) {
  return `${item.nome} · ${item.cliente.nome}`
}

/** O que vai à API agora; a chave diz se uma resposta ainda é deste filtro. */
const filtro = computed<FiltroDosDocumentosDaClinica>(() => ({
  aceite: recorte.value === 'PENDENTE' ? 'PENDENTE' : null,
  tipo: tipo.value,
  status: status.value,
  /* Enquanto se digita, o modelo do AutoComplete é o texto: só o paciente escolhido filtra. */
  pacienteId: typeof paciente.value === 'object' ? (paciente.value?.id ?? null) : null,
}))
const chaveDoFiltro = computed(() => JSON.stringify(filtro.value))

/* -------------------------------------------------------------------------------- lista */

const itens = ref<DocumentoDaClinica[]>([])
/** O cursor e o filtro em que ele nasceu: com outro filtro, ele não serve. */
const cursor = ref<{ valor: string; chave: string } | null>(null)
const carregando = ref(false)
const lido = ref(false)
const erro = ref('')
let leitura = 0

async function carregar(mais = false) {
  const chave = chaveDoFiltro.value
  const continuar = mais && cursor.value?.chave === chave ? cursor.value.valor : null
  if (mais && !continuar) return
  const vez = ++leitura
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await listarDocumentosDaClinica(
      filtro.value,
      { cursor: continuar },
      parceiroQuery(),
    )
    if (vez !== leitura) return
    itens.value = continuar ? [...itens.value, ...pagina.itens] : pagina.itens
    cursor.value = pagina.proximoCursor ? { valor: pagina.proximoCursor, chave } : null
    lido.value = true
  } catch (err) {
    if (vez !== leitura) return
    erro.value = lerErroDoCadastro(err, t('documentos.erro.carregar')).mensagem
  } finally {
    if (vez === leitura) carregando.value = false
  }
}

onMounted(() => void carregar())
/* Outro filtro: a lista recomeça do início e o cursor de antes some na hora. */
watch(chaveDoFiltro, () => {
  cursor.value = null
  void carregar()
})

const resumo = computed(() =>
  recorte.value === 'PENDENTE'
    ? t('documentos.daClinica.resumo.PENDENTE')
    : t('documentos.daClinica.resumo.TODOS'),
)

const filtrado = computed(() => Boolean(tipo.value || status.value || filtro.value.pacienteId))

/** O selo da linha: a situação do documento ou, no termo emitido, a do aceite. */
function seloDe(item: DocumentoDaClinica): { texto: string; tom: string } | null {
  if (item.status === 'RASCUNHO') return { texto: t('documentos.status.RASCUNHO'), tom: 'atencao' }
  if (item.status === 'ANULADO') return { texto: t('documentos.status.ANULADO'), tom: '' }
  if (item.aceiteStatus === 'NAO_SE_APLICA') return null
  const tom = { PENDENTE: 'atencao', ACEITO: 'ok', RECUSADO: '' }[item.aceiteStatus]
  return { texto: t(`documentos.daClinica.aceite.${item.aceiteStatus}`), tom }
}

function meta(item: DocumentoDaClinica) {
  return [
    t(`documentos.tipo.${item.tipo}`),
    item.emitidoEm
      ? t('documentos.emitidoEm', { data: rotulos.data(item.emitidoEm) })
      : t('documentos.criadoEm', { data: rotulos.data(item.criadoEm) }),
    item.autorNome,
    item.aceitePeloApp && item.aceiteStatus === 'PENDENTE' && item.status === 'EMITIDO'
      ? t('documentos.esperaNoApp')
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/* -------------------------------------------------------------------------------- ações */

const abrindo = ref<string | null>(null)

async function abrirPdf(item: DocumentoDaClinica) {
  abrindo.value = item.id
  const janela = abrirAbaVazia()
  try {
    const lido = await pdfDoDocumento(item.id, parceiroQuery())
    levarAoArquivo(janela, lido.url)
  } catch (err) {
    janela?.close()
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('documentos.erro.pdf')).mensagem,
      life: 6000,
    })
  } finally {
    abrindo.value = null
  }
}

const aceiteAberto = ref(false)
const alvo = ref<DocumentoDaClinica | null>(null)

function abrirAceite(item: DocumentoDaClinica) {
  alvo.value = item
  aceiteAberto.value = true
}

/* O termo respondido sai do "Esperando aceite" e do selo do menu. */
function aceiteRegistrado() {
  toast.add({ severity: 'success', summary: t('documentos.aceite.feito'), life: 3000 })
  invalidarPendenciasDoPortal()
  cursor.value = null
  void carregar()
}

/*
 * O vazio que ensina (o desenho de Acessos, 17/11/2026): nenhum termo esperando, como um termo
 * chega aqui e sai daqui. Emitir é na ficha do paciente (o botão leva aos Pacientes); responder é do
 * responsável, no balcão ou pelo app, e fica registrado no documento.
 */
const passosDoTermo = computed<PassoDoGuia[]>(() =>
  [
    { id: 'emitir', icone: 'ph ph-file-text' },
    { id: 'responder', icone: 'ph ph-signature' },
    { id: 'registrar', icone: 'ph ph-check-circle' },
  ].map(({ id, icone }) => ({
    id,
    icone,
    titulo: t(`documentos.daClinica.guia.${id}.titulo`),
    texto: t(`documentos.daClinica.guia.${id}.texto`),
    acao:
      id === 'emitir'
        ? {
            rotulo: t('documentos.daClinica.guia.emitir.acao'),
            icone: 'ph ph-paw-print',
            to: '/clinica/pacientes',
          }
        : undefined,
  })),
)
</script>

<template>
  <UiPagina
    :resumo="resumo"
    :carregando="carregando && !lido"
    :erro="lido ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <div class="dl">
      <div class="dl__filtros">
        <SelectButton
          :model-value="recorte"
          :options="opcoesDeRecorte"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('documentos.daClinica.filtro.aceite')"
          @update:model-value="trocarRecorte"
        />
        <Select
          :model-value="tipo"
          :options="opcoesDeTipo"
          option-label="rotulo"
          option-value="valor"
          show-clear
          :placeholder="t('documentos.daClinica.filtro.todosOsTipos')"
          :aria-label="t('documentos.daClinica.filtro.tipo')"
          class="dl__campo"
          @update:model-value="
            (valor: TipoDeDocumento | null) => mudarQuery({ tipo: valor ?? undefined })
          "
        />
        <Select
          v-if="recorte === 'TODOS'"
          :model-value="status"
          :options="opcoesDeStatus"
          option-label="rotulo"
          option-value="valor"
          show-clear
          :placeholder="t('documentos.daClinica.filtro.todasAsSituacoes')"
          :aria-label="t('documentos.daClinica.filtro.situacao')"
          class="dl__campo"
          @update:model-value="
            (valor: StatusDoDocumento | null) => mudarQuery({ status: valor ?? undefined })
          "
        />
        <AutoComplete
          ref="campoDoPaciente"
          v-model="paciente"
          :suggestions="sugestoes"
          :option-label="rotuloDoPaciente"
          :placeholder="t('documentos.daClinica.filtro.todosOsPacientes')"
          :aria-label="t('documentos.daClinica.filtro.paciente')"
          force-selection
          class="dl__campo dl__campo--paciente"
          @complete="buscarPaciente"
          @click="abrirLista"
          @keydown.down="abrirLista"
        >
          <template #option="{ option }">
            <OpcaoDoPaciente :paciente="option">{{ rotuloDoPaciente(option) }}</OpcaoDoPaciente>
          </template>
        </AutoComplete>
      </div>

      <p v-if="erro && lido" class="dl__erro" role="alert">{{ erro }}</p>

      <UiVazioIlustrado
        v-if="lido && !carregando && !itens.length && recorte === 'PENDENTE' && !filtrado"
        icone="ph ph-signature"
        :titulo="t('documentos.daClinica.vazio.PENDENTE')"
        :texto="t('documentos.daClinica.guia.texto')"
        :guia-titulo="t('documentos.daClinica.guia.titulo')"
        :passos="passosDoTermo"
      >
        <template #acao>
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-files"
            :label="t('documentos.daClinica.verTodos')"
            @click="trocarRecorte('TODOS')"
          />
        </template>
      </UiVazioIlustrado>

      <UiVazioIlustrado
        v-else-if="lido && !carregando && !itens.length"
        icone="ph ph-files"
        :titulo="
          filtrado ? t('documentos.daClinica.vazio.filtro') : t('documentos.daClinica.vazio.TODOS')
        "
        :texto="filtrado ? '' : t('documentos.daClinica.vazio.todosTexto')"
      />

      <section v-else-if="itens.length" class="ui-folha ui-lista" :aria-busy="carregando">
        <ul class="ui-lista">
          <li v-for="item in itens" :key="item.id">
            <div class="ui-linha" :class="{ 'dl__linha--anulada': item.status === 'ANULADO' }">
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo dl__nome">
                  <RouterLink :to="`/clinica/ficha/${item.paciente.id}`">{{
                    item.paciente.nome
                  }}</RouterLink>
                  <span class="dl__especie">{{
                    t(`cadastro.especie.${item.paciente.especie}`)
                  }}</span>
                  <span
                    v-if="seloDe(item)"
                    class="ui-selo"
                    :class="seloDe(item)?.tom ? `ui-selo--${seloDe(item)?.tom}` : ''"
                    >{{ seloDe(item)?.texto }}</span
                  >
                </strong>
                <span class="ui-linha__meta dl__meta">{{ meta(item) }}</span>
              </span>
              <span class="ui-linha__fim dl__acoes">
                <Button
                  v-if="item.pdfDisponivel"
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="ph ph-file-pdf"
                  :label="t('documentos.abrirPdf')"
                  :loading="abrindo === item.id"
                  @click="abrirPdf(item)"
                />
                <Button
                  v-if="
                    item.status === 'EMITIDO' && item.aceiteStatus === 'PENDENTE' && podeEscrever
                  "
                  type="button"
                  size="small"
                  icon="ph ph-signature"
                  :label="t('documentos.aceite.acao')"
                  @click="abrirAceite(item)"
                />
              </span>
            </div>
          </li>
        </ul>
      </section>

      <Button
        v-if="cursor"
        type="button"
        severity="secondary"
        outlined
        class="dl__mais"
        :label="t('documentos.verMais')"
        :loading="carregando"
        @click="carregar(true)"
      />
    </div>

    <template #sempre>
      <AceiteGaveta
        v-model:visible="aceiteAberto"
        :documento="alvo"
        @registrado="aceiteRegistrado"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.dl {
  display: grid;
  gap: 16px;
}

.dl__filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.dl__campo {
  min-width: 13rem;
}

.dl__campo--paciente {
  min-width: 16rem;
}

.dl__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.dl__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.dl__nome a {
  color: var(--tinta);
  text-decoration: none;
}

.dl__nome a:hover,
.dl__nome a:focus-visible {
  text-decoration: underline;
}

.dl__especie {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
}

.dl__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.dl__linha--anulada .dl__meta {
  text-decoration: line-through;
}

.dl__mais {
  justify-self: start;
}
</style>
