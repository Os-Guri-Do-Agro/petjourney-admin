<script setup lang="ts">
/**
 * Passo 1: o arquivo, as perguntas que só a pessoa responde e o envio das linhas (guia e2, 4.1).
 *
 * O arquivo é lido aqui e as colunas se ligam sozinhas. Antes de mandar, uma pergunta por vez: a
 * coluna obrigatória que não se achou e a espécie que nem o nome nem a raça resolvem (coelho e peixe
 * a API já reconhece). Depois as linhas vão em lotes de 500; com erro no meio, o envio para no lote
 * que falhou e sai de novo com a mesma chave.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import FileUpload, { type FileUploadUploaderEvent } from 'primevue/fileupload'
import InputText from 'primevue/inputtext'
import ProgressBar from 'primevue/progressbar'
import RadioButton from 'primevue/radiobutton'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { chaveDoCampo } from '@/components/importacao/leitura-da-importacao'
import {
  ESPECIES_DA_API,
  colunasUsadas,
  exemplosDaColuna,
  type EscolhaDeEspecie,
} from '@/components/importacao/planilha-para-a-api'
import { DEMONSTRACAO_DISPONIVEL } from '@/composables/useModoDemonstracao'
import {
  DEMONSTRACOES,
  type DemonstracaoId,
} from '@/features/clinico/data/fixtures/planilhas-de-demonstracao'
import { LIMITE_DO_ARQUIVO_MB } from '@/features/clinico/data/leitura-de-planilha'
import { letraDaColuna } from '@/features/clinico/domain/planilha'
import {
  LINHAS_POR_IMPORTACAO,
  type EspecieDaApi,
  type Importacao,
} from '@/service/parceiro/importacao-service'
import { STATUS_FINAIS, useImportacaoStore } from '@/stores/importacao-da-base'

const { t } = useI18n()
const toast = useToast()
const store = useImportacaoStore()
const rotulos = useRotulosDoCadastro()

const erro = ref('')
const ocupado = ref(false)

/* ------------------------------------------------------------------------------ arquivo */

const arrastando = ref(false)
const escolha = ref<{ clear: () => void } | null>(null)
let profundidade = 0

function aoEntrar() {
  profundidade += 1
  arrastando.value = true
}

function aoSair() {
  profundidade = Math.max(0, profundidade - 1)
  arrastando.value = profundidade > 0
}

async function aoSoltar(evento: DragEvent) {
  profundidade = 0
  arrastando.value = false
  const arquivo = evento.dataTransfer?.files?.[0]
  if (arquivo) await store.abrirArquivo(arquivo)
}

async function aoEscolher(evento: FileUploadUploaderEvent) {
  const arquivo = (Array.isArray(evento.files) ? evento.files : [evento.files])[0]
  escolha.value?.clear()
  if (arquivo) await store.abrirArquivo(arquivo)
}

const LINHAS_DA_DEMONSTRACAO: Record<DemonstracaoId, number> = {
  clinica: 39,
  simplesvet: 120,
  vetus: 2400,
}

/* ---------------------------------------------------------------------- as perguntas */

const indice = ref(0)

watch(
  () => store.planilha,
  () => {
    indice.value = 0
    erro.value = ''
  },
)

const perguntas = computed(() => store.perguntasLocais)
const atual = computed(() => perguntas.value[Math.min(indice.value, perguntas.value.length - 1)])
const naUltima = computed(() => indice.value >= perguntas.value.length - 1)

/** Respondidas todas, a tela passa ao envio; a fila continua lá para quem voltar. */
const conferindo = ref(true)

watch(
  () => store.semResposta,
  (faltam) => {
    if (faltam > 0) conferindo.value = true
  },
)

const mostraPerguntas = computed(
  () => perguntas.value.length > 0 && (store.semResposta > 0 || conferindo.value),
)

function proxima() {
  if (naUltima.value) {
    conferindo.value = false
    return
  }
  indice.value += 1
}

function anterior() {
  indice.value = Math.max(0, indice.value - 1)
}

function voltarAsPerguntas() {
  indice.value = 0
  conferindo.value = true
}

/* A coluna obrigatória: cada coluna com o título e o começo do conteúdo. */
const opcoesDeColuna = computed(() => {
  const lida = store.planilha
  if (!lida) return []
  return lida.cabecalhos.map((cabecalho, coluna) => ({
    coluna,
    titulo: cabecalho || t('clinico.migracao.colunas.semTitulo'),
    letra: letraDaColuna(coluna),
    exemplos: exemplosDaColuna(lida, coluna).join(' · '),
    hoje: store.colunas.find((item) => item.coluna === coluna)?.campo ?? null,
  }))
})

/* A espécie: o enum da API, "outra" com o nome, e deixar de fora (a resposta segura). */
const outra = ref('')

watch(atual, (pergunta) => {
  outra.value =
    pergunta?.tipo === 'especie' && pergunta.resposta?.especie === 'OUTRO'
      ? (pergunta.resposta.outra ?? '')
      : ''
})

const especieEscolhida = computed<EspecieDaApi | null>(() =>
  atual.value?.tipo === 'especie' ? (atual.value.resposta?.especie ?? null) : null,
)

function escolherEspecie(especie: EspecieDaApi) {
  if (atual.value?.tipo !== 'especie') return
  const chave = atual.value.pergunta.chave
  const escolha: EscolhaDeEspecie =
    especie === 'OUTRO' ? { especie, outra: outra.value.trim() || undefined } : { especie }
  store.escolherEspecie(chave, escolha)
}

function digitarOutra() {
  if (especieEscolhida.value === 'OUTRO') escolherEspecie('OUTRO')
}

const tituloDaEspecie = computed(() => {
  const pergunta = atual.value
  if (pergunta?.tipo !== 'especie') return ''
  if (pergunta.pergunta.chave) {
    return t('clinico.migracao.duvidas.especie.pergunta', { valor: pergunta.pergunta.exemplo })
  }
  const [unico] = pergunta.pergunta.animais
  return pergunta.pergunta.animais.length === 1 && unico
    ? t('clinico.migracao.duvidas.especie.perguntaBrancoUm', { nome: unico.nome })
    : t('clinico.migracao.duvidas.especie.perguntaBranco')
})

const ANIMAIS_A_MOSTRAR = 6

/* --------------------------------------------------------------------------- o envio */

const notaDasColunas = computed(() => {
  const total = store.planilha?.cabecalhos.length ?? 0
  const usadas = colunasUsadas(store.colunas)
  return usadas === total
    ? t('clinico.migracao.colunas.nota.todas', { n: total }, total)
    : t('clinico.migracao.colunas.nota.parte', { n: usadas, total })
})

async function enviar() {
  erro.value = ''
  ocupado.value = true

  try {
    await store.enviar()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('importacao.envio.erro')).mensagem
  } finally {
    ocupado.value = false
  }
}

async function tentarDeNovo() {
  erro.value = ''
  ocupado.value = true

  try {
    await store.mandarLinhas()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('importacao.envio.erro')).mensagem
  } finally {
    ocupado.value = false
  }
}

async function descartar() {
  ocupado.value = true

  try {
    await store.descartar()
    erro.value = ''
    toast.add({ severity: 'success', summary: t('importacao.descartada'), life: 3000 })
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    ocupado.value = false
  }
}

async function responderReimportacao(importar: boolean) {
  ocupado.value = true

  try {
    await store.responderReimportacao(importar)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('importacao.envio.erro')).mensagem
  } finally {
    ocupado.value = false
  }
}

/** Recarregou no meio do envio: sem o arquivo, não há como seguir. */
const envioSemArquivo = computed(
  () => store.importacao?.status === 'RECEBENDO_LINHAS' && !store.planilha,
)

/* -------------------------------------------------------------------------- histórico */

const anteriores = computed(() =>
  store.historico.filter((item) => item.id !== store.importacao?.id),
)

/**
 * A API guarda a descartada (antes de importar) como CANCELADA, sem as linhas e sem o nome do
 * arquivo; a que nunca foi confirmada não tem o que abrir. A cancelada depois de 30 dias pausada
 * tem `confirmadaEm`, e o desfazer continua valendo para ela.
 */
function descartada(item: Importacao) {
  return item.status === 'CANCELADA' && !item.confirmadaEm
}

function rotuloDoStatus(item: Importacao) {
  return descartada(item)
    ? t('importacao.historico.descartada')
    : t(`importacao.status.${item.status}`)
}

function podeAbrir(item: Importacao) {
  return STATUS_FINAIS.includes(item.status) && !descartada(item)
}

async function abrir(id: string) {
  try {
    await store.abrir(id)
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('importacao.erroAoCarregar')).mensagem,
      life: 6000,
    })
  }
}
</script>

<template>
  <div class="arq">
    <!-- Recarregou no meio do envio -->
    <section v-if="envioSemArquivo" class="ui-folha ui-cartao" aria-labelledby="arq-interrompido">
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-cloud-slash" /></span>
        <span class="ui-cartao__titulos">
          <h2 id="arq-interrompido" class="ui-cartao__titulo">
            {{ t('importacao.interrompido.titulo') }}
          </h2>
          <p class="ui-cartao__descricao">{{ t('importacao.interrompido.texto') }}</p>
        </span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-trash"
          :label="t('importacao.descartar')"
          :loading="ocupado"
          @click="descartar"
        />
      </header>
    </section>

    <!-- O arquivo -->
    <template v-else-if="!store.planilha">
      <section class="ui-folha ui-cartao" aria-labelledby="arq-titulo">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-upload-simple" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="arq-titulo" class="ui-cartao__titulo">
              {{ t('clinico.migracao.arquivo.titulo') }}
            </h2>
            <p class="ui-cartao__descricao">{{ t('clinico.migracao.arquivo.texto') }}</p>
          </span>
        </header>

        <div
          class="arq__soltar"
          :class="{ 'arq__soltar--ativo': arrastando }"
          @dragenter.prevent="aoEntrar"
          @dragover.prevent
          @dragleave.prevent="aoSair"
          @drop.prevent="aoSoltar"
        >
          <i
            class="arq__soltar-icone"
            :class="store.lendo ? 'ph ph-spin ph-circle-notch' : 'ph ph-file-arrow-up'"
            aria-hidden="true"
          />
          <strong>{{
            store.lendo ? t('clinico.migracao.arquivo.lendo') : t('clinico.migracao.arquivo.soltar')
          }}</strong>
          <FileUpload
            ref="escolha"
            mode="basic"
            accept=".xlsx,.csv,.txt,.xls"
            auto
            custom-upload
            choose-icon="ph ph-folder-open"
            :choose-label="t('clinico.migracao.arquivo.escolher')"
            :disabled="store.lendo || !store.podeTrocarArquivo"
            @uploader="aoEscolher"
          />
          <span class="arq__formatos">
            {{ t('clinico.migracao.arquivo.formatos', { mb: LIMITE_DO_ARQUIVO_MB }) }}
          </span>
        </div>

        <p v-if="store.erroDeLeitura" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ t(`clinico.migracao.arquivo.erro.${store.erroDeLeitura}`) }}</span>
        </p>
      </section>

      <section
        v-if="DEMONSTRACAO_DISPONIVEL"
        class="ui-folha ui-cartao"
        aria-labelledby="arq-exemplos"
      >
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-flask" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="arq-exemplos" class="ui-cartao__titulo">
              {{ t('importacao.exemplos.titulo') }}
            </h2>
            <p class="ui-cartao__descricao">{{ t('importacao.exemplos.texto') }}</p>
          </span>
        </header>
        <ul class="ui-lista">
          <li v-for="item in DEMONSTRACOES" :key="item.id" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">
                {{ t(`clinico.migracao.arquivo.demo.${item.id}.titulo`) }}
              </strong>
              <span class="ui-linha__meta">
                {{
                  t(
                    'clinico.migracao.comum.linhasN',
                    { n: rotulos.numero(LINHAS_DA_DEMONSTRACAO[item.id]) },
                    LINHAS_DA_DEMONSTRACAO[item.id],
                  )
                }}
                · {{ t(`clinico.migracao.arquivo.demo.${item.id}.descricao`) }}
              </span>
            </span>
            <span class="ui-linha__fim">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-play"
                :label="t('clinico.migracao.arquivo.usar')"
                :disabled="!store.podeTrocarArquivo"
                @click="store.usarDemonstracao(item.id)"
              />
            </span>
          </li>
        </ul>
      </section>
    </template>

    <!-- As perguntas sobre a planilha -->
    <section
      v-else-if="mostraPerguntas && atual"
      class="ui-folha ui-cartao"
      aria-labelledby="arq-pergunta"
    >
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true">
          <i :class="atual.tipo === 'coluna' ? 'ph ph-columns' : 'ph ph-paw-print'" />
        </span>
        <span class="ui-cartao__titulos">
          <span class="arq__contador ui-num">
            {{
              t('clinico.migracao.duvidas.contador', {
                n: Math.min(indice, perguntas.length - 1) + 1,
                total: perguntas.length,
              })
            }}
          </span>
          <h2 id="arq-pergunta" class="ui-cartao__titulo">
            <template v-if="atual.tipo === 'coluna'">
              {{ t(`clinico.migracao.duvidas.coluna.${atual.campo}`) }}
            </template>
            <template v-else>{{ tituloDaEspecie }}</template>
          </h2>
          <p class="ui-cartao__descricao">
            <template v-if="atual.tipo === 'coluna'">
              {{ t('clinico.migracao.duvidas.coluna.texto') }}
            </template>
            <template v-else-if="atual.pergunta.chave">
              {{ t('clinico.migracao.duvidas.especie.texto') }}
            </template>
            <template v-else>{{ t('clinico.migracao.duvidas.especie.textoBranco') }}</template>
          </p>
        </span>
      </header>

      <!-- Qual coluna -->
      <div
        v-if="atual.tipo === 'coluna'"
        class="arq__opcoes"
        role="radiogroup"
        :aria-labelledby="'arq-pergunta'"
      >
        <label
          v-for="opcao in opcoesDeColuna"
          :key="opcao.coluna"
          class="arq__opcao"
          :class="{ 'arq__opcao--escolhida': atual.resposta === opcao.coluna }"
        >
          <RadioButton
            :model-value="atual.resposta"
            :value="opcao.coluna"
            :name="`coluna-${atual.campo}`"
            @update:model-value="store.ligarColuna(opcao.coluna, atual.campo)"
          />
          <span class="arq__opcao-texto">
            <strong
              >{{ t('clinico.migracao.colunas.coluna', { letra: opcao.letra }) }} ·
              <bdi>{{ opcao.titulo }}</bdi></strong
            >
            <span>{{ opcao.exemplos || t('clinico.migracao.colunas.vazia') }}</span>
            <span v-if="opcao.hoje && opcao.hoje !== atual.campo" class="arq__hoje">
              {{
                t('clinico.migracao.duvidas.coluna.hoje', { campo: t(chaveDoCampo(opcao.hoje)) })
              }}
            </span>
          </span>
        </label>
        <p class="eg__dica">{{ t('clinico.migracao.duvidas.coluna.semEla') }}</p>
      </div>

      <!-- Que espécie -->
      <div v-else class="arq__especie">
        <div
          class="arq__opcoes arq__opcoes--especie"
          role="radiogroup"
          aria-labelledby="arq-pergunta"
        >
          <label
            v-for="especie in ESPECIES_DA_API"
            :key="especie"
            class="arq__opcao arq__opcao--curta"
            :class="{ 'arq__opcao--escolhida': especieEscolhida === especie }"
          >
            <RadioButton
              :model-value="especieEscolhida"
              :value="especie"
              :name="`especie-${atual.pergunta.chave}`"
              @update:model-value="escolherEspecie(especie)"
            />
            <span>{{ t(`cadastro.especie.${especie}`) }}</span>
          </label>
          <label
            class="arq__opcao arq__opcao--curta"
            :class="{ 'arq__opcao--escolhida': especieEscolhida === 'FORA' }"
          >
            <RadioButton
              :model-value="especieEscolhida"
              value="FORA"
              :name="`especie-${atual.pergunta.chave}`"
              @update:model-value="escolherEspecie('FORA')"
            />
            <span>{{ t('clinico.migracao.duvidas.especie.deixarDeFora') }}</span>
          </label>
        </div>

        <div v-if="especieEscolhida === 'OUTRO'" class="eg__secao arq__outra">
          <label class="eg__rotulo" for="arq-outra">{{ t('importacao.especieOutra') }}</label>
          <InputText
            id="arq-outra"
            v-model="outra"
            :maxlength="60"
            :placeholder="t('importacao.especieOutraExemplo')"
            @update:model-value="digitarOutra"
          />
        </div>

        <div class="arq__animais">
          <span class="eg__rotulo">
            {{ t('clinico.migracao.duvidas.especie.animais', atual.pergunta.animais.length) }}
          </span>
          <span class="arq__animais-lista">
            <span
              v-for="animal in atual.pergunta.animais.slice(0, ANIMAIS_A_MOSTRAR)"
              :key="animal.linha"
              class="ui-selo"
            >
              <bdi>{{ animal.nome }}</bdi> ·
              {{ t('clinico.migracao.comum.linha', { n: rotulos.numero(animal.linha) }) }}
            </span>
            <span v-if="atual.pergunta.animais.length > ANIMAIS_A_MOSTRAR" class="eg__dica">
              {{
                t('importacao.eMais', {
                  n: atual.pergunta.animais.length - ANIMAIS_A_MOSTRAR,
                })
              }}
            </span>
          </span>
        </div>
      </div>

      <footer class="ui-cartao__pe arq__pe">
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-arrow-left"
          :label="t('clinico.migracao.duvidas.anterior')"
          :disabled="indice === 0"
          @click="anterior"
        />
        <Button
          type="button"
          icon="ph ph-arrow-right"
          icon-pos="right"
          :label="naUltima ? t('importacao.envio.ver') : t('clinico.migracao.duvidas.proxima')"
          :disabled="
            atual.resposta === null ||
            (atual.tipo === 'especie' && especieEscolhida === 'OUTRO' && !outra.trim())
          "
          @click="proxima"
        />
      </footer>
    </section>

    <!-- Pronto para enviar, e o envio -->
    <section v-else class="ui-folha ui-cartao" aria-labelledby="arq-enviar">
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-paper-plane-tilt" /></span>
        <span class="ui-cartao__titulos">
          <h2 id="arq-enviar" class="ui-cartao__titulo">{{ t('importacao.envio.titulo') }}</h2>
          <p class="ui-cartao__descricao">{{ t('importacao.envio.texto') }}</p>
        </span>
      </header>

      <div class="arq__envio">
        <p class="arq__nota">
          <span class="ui-num">{{
            t(
              'clinico.migracao.comum.linhasN',
              { n: rotulos.numero(store.planilha.linhas.length) },
              store.planilha.linhas.length,
            )
          }}</span>
          · {{ notaDasColunas }}
        </p>

        <p v-if="store.grandeDemais" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{
            t('importacao.envio.grandeDemais', {
              n: rotulos.numero(store.planilha.linhas.length),
              max: rotulos.numero(LINHAS_POR_IMPORTACAO),
            })
          }}</span>
        </p>

        <div v-if="store.envio" class="arq__progresso" role="status">
          <span class="ui-num">
            {{
              t('importacao.envio.andando', {
                feitas: rotulos.numero(store.envio.feitas),
                total: rotulos.numero(store.envio.total),
              })
            }}
          </span>
          <ProgressBar
            :value="
              store.envio.total ? Math.round((store.envio.feitas / store.envio.total) * 100) : 0
            "
            :show-value="false"
            :aria-label="t('importacao.envio.titulo')"
          />
        </div>

        <p v-if="erro" class="eg__erro" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ erro }}</span>
        </p>
      </div>

      <footer class="ui-cartao__pe arq__pe">
        <Button
          v-if="perguntas.length && !store.importacao"
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-arrow-left"
          :label="t('importacao.envio.rever')"
          @click="voltarAsPerguntas"
        />
        <span class="arq__espaco" />
        <Button
          v-if="store.importacao && store.envio?.parado && !store.jaImportadoEm"
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-trash"
          :label="t('importacao.descartar')"
          :disabled="ocupado"
          @click="descartar"
        />
        <Button
          v-if="store.importacao && store.envio?.parado && !store.jaImportadoEm"
          type="button"
          icon="ph ph-arrow-clockwise"
          :label="t('cadastro.tentarDeNovo')"
          :loading="ocupado"
          @click="tentarDeNovo"
        />
        <Button
          v-else-if="!store.importacao"
          type="button"
          icon="ph ph-paper-plane-tilt"
          :label="t('importacao.envio.enviar')"
          :loading="ocupado"
          :disabled="store.grandeDemais || store.semResposta > 0"
          @click="enviar"
        />
      </footer>
    </section>

    <!-- As importações anteriores -->
    <section
      v-if="!store.planilha && anteriores.length"
      class="ui-folha ui-cartao"
      aria-labelledby="arq-historico"
    >
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true"
          ><i class="ph ph-clock-counter-clockwise"
        /></span>
        <span class="ui-cartao__titulos">
          <h2 id="arq-historico" class="ui-cartao__titulo">
            {{ t('importacao.historico.titulo') }}
          </h2>
          <p class="ui-cartao__descricao">{{ t('importacao.historico.texto') }}</p>
        </span>
      </header>
      <ul class="ui-lista">
        <li v-for="item in anteriores" :key="item.id" class="ui-linha">
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">
              <bdi>{{ item.arquivoNome || t('importacao.historico.semNome') }}</bdi>
              <span class="ui-selo">{{ rotuloDoStatus(item) }}</span>
            </strong>
            <span class="ui-linha__meta ui-num">
              {{ rotulos.data(item.criadaEm) }} ·
              {{
                t(
                  'importacao.linhasDoArquivo',
                  { n: rotulos.numero(item.totalLinhas) },
                  item.totalLinhas,
                )
              }}
              <template v-if="item.status === 'CONCLUIDA'">
                ·
                {{
                  t('importacao.historico.entraram', {
                    n: rotulos.numero(item.criados + item.juntados),
                  })
                }}
              </template>
            </span>
          </span>
          <span v-if="podeAbrir(item)" class="ui-linha__fim">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('importacao.historico.abrir')"
              @click="abrir(item.id)"
            />
          </span>
        </li>
      </ul>
    </section>

    <Dialog
      :visible="store.jaImportadoEm !== null"
      modal
      :closable="false"
      :header="t('importacao.jaImportado.titulo')"
      class="arq__dialogo"
    >
      <p class="arq__dialogo-texto">
        {{
          t('importacao.jaImportado.texto', {
            data: store.jaImportadoEm ? rotulos.data(store.jaImportadoEm) : '',
          })
        }}
      </p>
      <template #footer>
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('importacao.jaImportado.nao')"
          :disabled="ocupado"
          @click="responderReimportacao(false)"
        />
        <Button
          type="button"
          :label="t('importacao.jaImportado.sim')"
          :loading="ocupado"
          @click="responderReimportacao(true)"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.arq {
  display: grid;
  gap: 20px;
}

/* A área de soltar: tracejado no véu; arrastando por cima, o tracejado vira linha. */
.arq__soltar {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 32px 16px;
  border: 1.5px dashed var(--tinta-3);
  border-radius: 18px;
  background: var(--app-cartao, var(--superficie));
  text-align: center;
  transition: border-color 160ms ease-out;
}

.arq__soltar--ativo {
  border-style: solid;
  border-color: var(--tinta-2);
}

.arq__soltar-icone {
  color: var(--tinta-2);
  font-size: 28px;
}

.arq__formatos {
  color: var(--tinta-2);
  font-size: 13px;
}

.arq__contador {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.arq__opcoes {
  display: grid;
  gap: 8px;
}

.arq__opcoes--especie {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 11rem), 1fr));
}

.arq__opcao {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--app-regua, var(--linha-suave));
  border-radius: 14px;
  background: var(--app-cartao, var(--superficie));
  cursor: pointer;
}

.arq__opcao--curta {
  align-items: center;
}

.arq__opcao--escolhida {
  border-color: var(--tinta-2);
}

.arq__opcao-texto {
  display: grid;
  min-width: 0;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13px;
}

.arq__opcao-texto strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.arq__hoje {
  color: var(--atencao-tinta);
}

.arq__especie {
  display: grid;
  gap: 14px;
}

.arq__outra {
  max-width: 22rem;
}

.arq__animais {
  display: grid;
  gap: 6px;
}

.arq__animais-lista {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.arq__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.arq__espaco {
  flex: 1;
}

.arq__envio {
  display: grid;
  gap: 12px;
}

.arq__nota {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.arq__progresso {
  display: grid;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.arq__progresso :deep(.p-progressbar) {
  height: 8px;
}

.arq__dialogo-texto {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

@media (prefers-reduced-motion: reduce) {
  .arq__soltar {
    transition: none;
  }
}
</style>
