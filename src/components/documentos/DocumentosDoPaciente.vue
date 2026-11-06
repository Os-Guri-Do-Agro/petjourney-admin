<script setup lang="ts">
/**
 * Os documentos clínicos do paciente (E4-06, PJ-0EK0TY; guia e4 8 e 9.1): na ficha, todos; no
 * atendimento, os dele (e o novo nasce ligado a ele). Do mais novo, com a situação, o código e,
 * nos termos, o aceite.
 *
 * Rascunho continua na gaveta; emitido abre o PDF de 15 minutos; o termo pendente registra o aceite
 * no balcão; emitido se anula com motivo.
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  descartarDocumento,
  listarDocumentosDoPaciente,
  pdfDoDocumento,
  type Documento,
} from '@/service/parceiro/documentos-service'
import { abrirAbaVazia, levarAoArquivo } from '@/utils/arquivo-assinado'

import AceiteGaveta from './AceiteGaveta.vue'
import AnularDocumentoGaveta from './AnularDocumentoGaveta.vue'
import DocumentoGaveta from './DocumentoGaveta.vue'

/* Prop booleana ausente vira `false` no Vue: o padrão diz que a ficha cria. */
const props = withDefaults(
  defineProps<{
    pacienteId: string
    /** No atendimento: só os dele, e o novo nasce ligado a ele. */
    atendimentoId?: string | null
    /** O atendimento deixa criar (o rascunho com esta aba no lock, ou sem atendimento). */
    podeCriar?: boolean
  }>(),
  { atendimentoId: null, podeCriar: true },
)
const emit = defineEmits<{ versao: [versao: number] }>()

const { t } = useI18n()
const toast = useToast()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const clinicaEscreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
const podeEscrever = computed(
  () => clinicaEscreve.value && store.temPermissao('prontuario.escrever') && props.podeCriar,
)
const podeEmitir = computed(
  () => clinicaEscreve.value && store.temPermissao('prontuario.finalizar'),
)

const itens = ref<Documento[]>([])
const cursor = ref<string | null>(null)
const carregando = ref(false)
const lido = ref(false)
const erro = ref('')

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await listarDocumentosDoPaciente(
      props.pacienteId,
      { atendimentoId: props.atendimentoId, cursor: mais ? cursor.value : null },
      parceiroQuery(),
    )
    itens.value = mais ? [...itens.value, ...pagina.itens] : pagina.itens
    cursor.value = pagina.proximoCursor
    lido.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('documentos.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())
watch(
  () => [props.pacienteId, props.atendimentoId],
  () => void carregar(),
)

const TOM: Record<string, string> = { RASCUNHO: 'atencao', ANULADO: '' }

function meta(item: Documento) {
  return [
    item.emitidoEm
      ? t('documentos.emitidoEm', { data: rotulos.data(item.emitidoEm) })
      : t('documentos.criadoEm', { data: rotulos.data(item.criadoEm) }),
    item.codigoVerificador,
    item.autorNome,
    item.aceiteStatus !== 'NAO_SE_APLICA' && item.status === 'EMITIDO'
      ? t(`documentos.aceiteStatus.${item.aceiteStatus}`)
      : '',
    item.aceitePeloApp && item.aceiteStatus === 'PENDENTE' ? t('documentos.esperaNoApp') : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/* ------------------------------------------------------------------------------- ações */

const gavetaAberta = ref(false)
const emEdicao = ref<Documento | null>(null)

function abrir(item: Documento | null) {
  emEdicao.value = item
  gavetaAberta.value = true
}

function gravado(documento: Documento) {
  if (typeof documento.versaoDoAtendimento === 'number')
    emit('versao', documento.versaoDoAtendimento)
  toast.add({ severity: 'success', summary: t('documentos.gravado'), life: 3000 })
  void carregar()
}

function emitido() {
  toast.add({ severity: 'success', summary: t('documentos.emitido'), life: 3000 })
  void carregar()
}

const descartando = ref<string | null>(null)

/** O rascunho sai de vez (só o rascunho; o emitido se anula). */
async function descartar(item: Documento) {
  descartando.value = item.id
  try {
    await descartarDocumento(item.id, parceiroQuery())
    itens.value = itens.value.filter((outro) => outro.id !== item.id)
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('documentos.erro.descartar')).mensagem,
      life: 6000,
    })
  } finally {
    descartando.value = null
  }
}

const abrindo = ref<string | null>(null)

async function abrirPdf(item: Documento) {
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
const anularAberto = ref(false)
const alvo = ref<Documento | null>(null)

function abrirAceite(item: Documento) {
  alvo.value = item
  aceiteAberto.value = true
}

function abrirAnular(item: Documento) {
  alvo.value = item
  anularAberto.value = true
}

function depoisDeMudar(chave: string) {
  toast.add({ severity: 'success', summary: t(chave), life: 3000 })
  void carregar()
}
</script>

<template>
  <section class="ui-folha ui-cartao dc" aria-labelledby="dc-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-files" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="dc-titulo" class="ui-cartao__titulo">{{ t('documentos.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ t('documentos.descricao') }}</p>
      </span>
      <Button
        v-if="podeEscrever"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('documentos.novo')"
        @click="abrir(null)"
      />
    </header>

    <p v-if="erro" class="dc__nota dc__erro" role="alert">{{ erro }}</p>

    <ul v-if="itens.length" class="ui-lista">
      <li v-for="item in itens" :key="item.id">
        <div
          class="ui-linha dc__linha"
          :class="{ 'dc__linha--anulada': item.status === 'ANULADO' }"
        >
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo dc__nome">
              <span class="dc__tipo">{{ t(`documentos.tipo.${item.tipo}`) }}</span>
              <span
                v-if="item.status !== 'EMITIDO'"
                class="ui-selo"
                :class="TOM[item.status] ? `ui-selo--${TOM[item.status]}` : ''"
                >{{ t(`documentos.status.${item.status}`) }}</span
              >
            </strong>
            <span class="ui-linha__meta">{{ meta(item) }}</span>
          </span>
          <span class="ui-linha__fim dc__acoes">
            <Button
              v-if="item.status === 'RASCUNHO' && podeEscrever"
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('documentos.descartar')"
              :loading="descartando === item.id"
              @click="descartar(item)"
            />
            <Button
              v-if="item.status === 'RASCUNHO' && podeEscrever"
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('documentos.continuar')"
              @click="abrir(item)"
            />
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
              v-if="item.status === 'EMITIDO' && item.aceiteStatus === 'PENDENTE' && podeEscrever"
              type="button"
              size="small"
              icon="ph ph-signature"
              :label="t('documentos.aceite.acao')"
              @click="abrirAceite(item)"
            />
            <Button
              v-if="item.status === 'EMITIDO' && podeEmitir"
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('documentos.anular.acao')"
              @click="abrirAnular(item)"
            />
          </span>
        </div>
      </li>
    </ul>
    <p v-else-if="lido && !carregando && !erro" class="dc__nota">{{ t('documentos.vazio') }}</p>

    <Button
      v-if="cursor"
      type="button"
      size="small"
      severity="secondary"
      outlined
      class="dc__mais"
      :label="t('documentos.verMais')"
      :loading="carregando"
      @click="carregar(true)"
    />

    <DocumentoGaveta
      v-model:visible="gavetaAberta"
      :paciente-id="pacienteId"
      :atendimento-id="atendimentoId"
      :documento="emEdicao"
      :pode-emitir="podeEmitir"
      @gravado="gravado"
      @emitido="emitido"
    />
    <AceiteGaveta
      v-model:visible="aceiteAberto"
      :documento="alvo"
      @registrado="depoisDeMudar('documentos.aceite.feito')"
    />
    <AnularDocumentoGaveta
      v-model:visible="anularAberto"
      :documento="alvo"
      @anulado="depoisDeMudar('documentos.anular.feito')"
    />
  </section>
</template>

<style scoped>
.dc__nota {
  margin: 0;
  padding: 14px 24px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.dc__erro {
  color: var(--risco-tinta);
}

.dc__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.dc__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.dc__linha--anulada .dc__tipo,
.dc__linha--anulada .ui-linha__meta {
  text-decoration: line-through;
}

.dc__mais {
  justify-self: start;
  margin: 0 24px 16px;
}
</style>
