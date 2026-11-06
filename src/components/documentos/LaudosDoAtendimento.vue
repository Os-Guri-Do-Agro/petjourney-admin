<script setup lang="ts">
/**
 * Os laudos recebidos do atendimento (E4-06b, guia e4 9.2): o PDF ou a foto do resultado de um
 * exame feito fora, anexado ao atendimento. Aparece ao responsável junto com o resumo (se veio antes
 * de liberar) ou com "liberar" (se veio depois). Remover é lógico: o arquivo fica.
 *
 * Anexar: 1 a 4 arquivos (PDF, JPEG, PNG ou WebP; HEIC não), o exame pelo nome e o dia do
 * resultado.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import FileUpload, { type FileUploadUploaderEvent } from 'primevue/fileupload'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  anexarLaudos,
  LAUDOS_POR_ENVIO,
  liberarLaudo,
  listarLaudos,
  MOTIVO_DE_REMOVER_MAX,
  MOTIVO_DE_REMOVER_MIN,
  removerLaudo,
  TIPOS_DE_LAUDO,
  urlDoLaudo,
  type Laudo,
} from '@/service/parceiro/documentos-service'
import { abrirAbaVazia, levarAoArquivo } from '@/utils/arquivo-assinado'

const props = defineProps<{ atendimentoId: string; anulado: boolean }>()

const { t } = useI18n()
const toast = useToast()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const clinicaEscreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
const podeAnexar = computed(
  () => clinicaEscreve.value && store.temPermissao('prontuario.escrever') && !props.anulado,
)
const podeLiberar = computed(() => clinicaEscreve.value && store.temPermissao('resumo.liberar'))

const itens = ref<Laudo[]>([])
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    itens.value = (await listarLaudos(props.atendimentoId, parceiroQuery())).itens
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('laudos.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)
watch(
  () => props.atendimentoId,
  () => void carregar(),
)

function meta(item: Laudo) {
  return [
    t('laudos.resultadoDe', { dia: rotulos.dia(item.dataDoResultado) }),
    item.mimetype === 'application/pdf' ? 'PDF' : t('laudos.imagem'),
    item.removido
      ? t('laudos.removido')
      : item.visivelAoResponsavel
        ? t('laudos.noApp')
        : t('laudos.soNaClinica'),
  ].join(' · ')
}

/* ------------------------------------------------------------------------------ abrir */

const abrindo = ref<string | null>(null)

async function abrir(item: Laudo) {
  abrindo.value = item.id
  const janela = abrirAbaVazia()
  try {
    const lido = await urlDoLaudo(item.id, parceiroQuery())
    levarAoArquivo(janela, lido.url)
  } catch (err) {
    janela?.close()
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('laudos.erro.abrir')).mensagem,
      life: 6000,
    })
  } finally {
    abrindo.value = null
  }
}

const liberando = ref<string | null>(null)

async function liberar(item: Laudo) {
  liberando.value = item.id
  try {
    await liberarLaudo(item.id, parceiroQuery())
    toast.add({ severity: 'success', summary: t('laudos.liberado'), life: 3000 })
    await carregar()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('laudos.erro.liberar')).mensagem,
      life: 6000,
    })
  } finally {
    liberando.value = null
  }
}

/* ----------------------------------------------------------------------------- anexar */

const anexarAberto = ref(false)
const arquivos = ref<File[]>([])
const nomeDoExame = ref('')
const dataDoResultado = ref<Date | null>(null)
const tentou = ref(false)
const enviando = ref(false)
const erroDoEnvio = ref('')
/* O `clear()` existe no FileUpload, mas o tipo do PrimeVue só declara o `upload()`. */
const escolha = ref<{ clear: () => void } | null>(null)

watch(anexarAberto, (agora) => {
  if (!agora) return
  arquivos.value = []
  nomeDoExame.value = ''
  dataDoResultado.value = new Date()
  tentou.value = false
  erroDoEnvio.value = ''
})

function aoEscolher(evento: FileUploadUploaderEvent) {
  const lista = Array.isArray(evento.files) ? evento.files : [evento.files]
  escolha.value?.clear()
  arquivos.value = [...arquivos.value, ...lista].slice(0, LAUDOS_POR_ENVIO)
}

function tirar(indice: number) {
  arquivos.value = arquivos.value.filter((_, i) => i !== indice)
}

const hoje = new Date()

function iso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

const validoParaEnviar = computed(
  () =>
    arquivos.value.length > 0 &&
    nomeDoExame.value.trim().length > 1 &&
    Boolean(dataDoResultado.value),
)

async function enviar() {
  tentou.value = true
  erroDoEnvio.value = ''
  if (!validoParaEnviar.value) return
  enviando.value = true
  try {
    const lista = await anexarLaudos(
      props.atendimentoId,
      {
        arquivos: arquivos.value,
        nomeDoExame: nomeDoExame.value.trim(),
        dataDoResultado: iso(dataDoResultado.value!),
      },
      parceiroQuery(),
    )
    itens.value = lista.itens
    anexarAberto.value = false
    toast.add({ severity: 'success', summary: t('laudos.anexado'), life: 3000 })
  } catch (err) {
    erroDoEnvio.value = lerErroDoCadastro(err, t('laudos.erro.anexar')).mensagem
  } finally {
    enviando.value = false
  }
}

/* ---------------------------------------------------------------------------- remover */

const removerAberto = ref(false)
const paraRemover = ref<Laudo | null>(null)
const motivo = ref('')
const removendo = ref(false)
const erroDoRemover = ref('')

function abrirRemover(item: Laudo) {
  paraRemover.value = item
  motivo.value = ''
  erroDoRemover.value = ''
  removerAberto.value = true
}

async function confirmarRemover() {
  if (!paraRemover.value || motivo.value.trim().length < MOTIVO_DE_REMOVER_MIN) {
    erroDoRemover.value = t('atendimento.anular.motivoDica', { min: MOTIVO_DE_REMOVER_MIN })
    return
  }
  removendo.value = true
  try {
    await removerLaudo(paraRemover.value.id, motivo.value.trim(), parceiroQuery())
    removerAberto.value = false
    await carregar()
  } catch (err) {
    erroDoRemover.value = lerErroDoCadastro(err, t('laudos.erro.remover')).mensagem
  } finally {
    removendo.value = false
  }
}
</script>

<template>
  <section class="ui-folha ui-cartao lc" aria-labelledby="lc-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-paperclip" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="lc-titulo" class="ui-cartao__titulo">{{ t('laudos.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ t('laudos.descricao') }}</p>
      </span>
      <Button
        v-if="podeAnexar"
        type="button"
        size="small"
        icon="ph ph-upload-simple"
        :label="t('laudos.anexar')"
        @click="anexarAberto = true"
      />
    </header>

    <p v-if="erro" class="lc__nota lc__erro" role="alert">{{ erro }}</p>

    <ul v-if="itens.length" class="ui-lista">
      <li v-for="item in itens" :key="item.id">
        <div class="ui-linha" :class="{ 'lc__linha--removida': item.removido }">
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo lc__nome">{{ item.tipoExameNome }}</strong>
            <span class="ui-linha__meta">{{ meta(item) }}</span>
          </span>
          <span v-if="!item.removido" class="ui-linha__fim lc__acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-download-simple"
              :label="t('laudos.abrir')"
              :loading="abrindo === item.id"
              @click="abrir(item)"
            />
            <Button
              v-if="!item.visivelAoResponsavel && podeLiberar"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-paper-plane-tilt"
              :label="t('laudos.liberar')"
              :loading="liberando === item.id"
              @click="liberar(item)"
            />
            <Button
              v-if="podeAnexar"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-trash"
              :aria-label="t('laudos.removerDe', { nome: item.tipoExameNome })"
              @click="abrirRemover(item)"
            />
          </span>
        </div>
      </li>
    </ul>
    <p v-else-if="!carregando && !erro" class="lc__nota">{{ t('laudos.vazio') }}</p>

    <CadastroGaveta
      v-model:visible="anexarAberto"
      :titulo="t('laudos.anexar')"
      icone="ph ph-paperclip"
      largura="34rem"
    >
      <form id="anexar-laudo" class="eg" novalidate @submit.prevent="enviar">
        <section class="eg__secao">
          <span class="eg__rotulo">{{ t('laudos.arquivos') }}</span>
          <ul v-if="arquivos.length" class="lc__arquivos">
            <li v-for="(arquivo, indice) in arquivos" :key="`${arquivo.name}-${indice}`">
              <span>{{ arquivo.name }}</span>
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-x"
                :aria-label="t('laudos.tirar', { nome: arquivo.name })"
                @click="tirar(indice)"
              />
            </li>
          </ul>
          <FileUpload
            v-if="arquivos.length < LAUDOS_POR_ENVIO"
            ref="escolha"
            mode="basic"
            :accept="TIPOS_DE_LAUDO.join(',')"
            multiple
            auto
            custom-upload
            choose-icon="ph ph-folder-open"
            :choose-label="t('laudos.escolher')"
            :disabled="enviando"
            @uploader="aoEscolher"
          />
          <small class="eg__dica">{{ t('laudos.arquivosDica') }}</small>
          <small v-if="tentou && !arquivos.length" class="eg__invalido">{{
            t('laudos.semArquivo')
          }}</small>
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="laudo-exame">{{ t('laudos.exame') }}</label>
          <InputText
            id="laudo-exame"
            v-model="nomeDoExame"
            :placeholder="t('laudos.exameDica')"
            :invalid="tentou && nomeDoExame.trim().length < 2"
            :disabled="enviando"
          />
        </section>
        <section class="eg__secao">
          <span id="laudo-data" class="eg__rotulo">{{ t('laudos.dataDoResultado') }}</span>
          <DatePicker
            v-model="dataDoResultado"
            inline
            :max-date="hoje"
            aria-labelledby="laudo-data"
            :disabled="enviando"
          />
        </section>
        <p v-if="erroDoEnvio" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroDoEnvio }}</span>
        </p>
      </form>
      <template #pe>
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.cancelar')"
          :disabled="enviando"
          @click="anexarAberto = false"
        />
        <Button
          type="submit"
          form="anexar-laudo"
          icon="ph ph-upload-simple"
          :label="t('laudos.enviar')"
          :loading="enviando"
        />
      </template>
    </CadastroGaveta>

    <CadastroGaveta
      v-model:visible="removerAberto"
      :titulo="t('laudos.remover')"
      icone="ph ph-trash"
    >
      <form id="remover-laudo" class="eg" novalidate @submit.prevent="confirmarRemover">
        <p class="eg__dica">
          {{ t('laudos.removerDica', { nome: paraRemover?.tipoExameNome ?? '' }) }}
        </p>
        <section class="eg__secao">
          <label class="eg__rotulo" for="laudo-motivo">{{ t('atendimento.anular.motivo') }}</label>
          <Textarea
            id="laudo-motivo"
            v-model="motivo"
            rows="3"
            auto-resize
            :maxlength="MOTIVO_DE_REMOVER_MAX"
            :disabled="removendo"
          />
        </section>
        <p v-if="erroDoRemover" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erroDoRemover }}</span>
        </p>
      </form>
      <template #pe>
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.cancelar')"
          :disabled="removendo"
          @click="removerAberto = false"
        />
        <Button
          type="submit"
          form="remover-laudo"
          severity="danger"
          icon="ph ph-trash"
          :label="t('laudos.remover')"
          :loading="removendo"
        />
      </template>
    </CadastroGaveta>
  </section>
</template>

<style scoped>
.lc__nota {
  margin: 0;
  padding: 14px 24px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.lc__erro {
  color: var(--risco-tinta);
}

.lc__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.lc__linha--removida .lc__nome,
.lc__linha--removida .ui-linha__meta {
  text-decoration: line-through;
}

.lc__arquivos {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lc__arquivos li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--tinta);
  font-size: 14px;
  overflow-wrap: anywhere;
}
</style>
