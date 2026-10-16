<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  EtapaLeituraReceita,
  LeituraReceitaParceiroEstado,
} from '@/composables/useLeituraReceitaParceiro'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { MAX_ITENS_LISTA } from '@/utils/parceiro/anotacao-estruturada'
import { ACCEPT_LEITURA, ehPdf, MAX_ANEXOS_ANOTACAO } from '@/utils/parceiro/leitura-receita'

/**
 * Bloco "Ler receita com IA", acima da lista de remédios da anotação de consulta. A leitura
 * em si mora em `useLeituraReceitaParceiro` (a tela precisa dela no envio e na conta de
 * anexos); aqui só a escolha dos arquivos e cada situação da leitura.
 *
 * A leitura leva segundos, e segundos parados num spinner leem como travado. Por isso o bloco
 * mostra o que está acontecendo: as páginas escolhidas, o feixe passando por elas, as três
 * etapas e o tempo. Quando os remédios caem na lista, a última etapa fecha antes de o resumo
 * entrar, para o olho ligar uma coisa à outra. Com movimento reduzido, tudo isso é instantâneo.
 *
 * Texto lido da imagem nunca entra como HTML: o que a IA leu chega aos campos do formulário.
 */
const props = defineProps<{
  leitura: LeituraReceitaParceiroEstado
  /** Anexos já escolhidos no formulário (para dizer quanto sobra). */
  anexosDoFormulario: number
  disabled?: boolean
}>()

const { t, locale } = useI18n()

const seletor = ref<HTMLInputElement | null>(null)

function movimentoReduzido() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * A etapa que a tela mostra. Segue a do composable, com uma exceção: de "lendo" para "pronta"
 * ela segura a caixa da leitura por um instante, com as três etapas cumpridas, enquanto os
 * remédios entram na lista logo abaixo. Sem isso o resumo trocava de lugar com a caixa no
 * mesmo quadro em que as linhas apareciam, e não se via de onde elas tinham vindo.
 */
const etapa = ref<EtapaLeituraReceita>(props.leitura.etapa)
const fechando = ref(false)
let atrasoDoFim: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.leitura.etapa,
  (nova, antiga) => {
    if (atrasoDoFim) {
      clearTimeout(atrasoDoFim)
      atrasoDoFim = null
    }

    if (
      nova === 'pronta' &&
      (antiga === 'lendo' || antiga === 'enviando') &&
      !movimentoReduzido()
    ) {
      fechando.value = true
      atrasoDoFim = setTimeout(() => {
        fechando.value = false
        etapa.value = 'pronta'
      }, 1100)
      return
    }

    fechando.value = false
    etapa.value = nova
  },
)

const emLeitura = computed(() => etapa.value === 'enviando' || etapa.value === 'lendo')

/** Etapas da leitura: 0 = enviando, 1 = lendo, 2 = pondo na prescrição (só no fechamento). */
const passoAtual = computed(() => {
  if (fechando.value) {
    return 3
  }

  return etapa.value === 'enviando' ? 0 : 1
})

const passos = computed(() =>
  (['passoEnviar', 'passoLer', 'passoLista'] as const).map((chave, indice) => ({
    chave,
    texto: t(`acessos.leituraReceita.${chave}`),
    estado: indice < passoAtual.value ? 'feito' : indice === passoAtual.value ? 'agora' : 'depois',
  })),
)

/** No fechamento o título já é o do resumo: a caixa que entra depois diz a mesma coisa. */
const tituloDaLeitura = computed(() => {
  const aplicados = props.leitura.resultado?.aplicados ?? 0

  if (!fechando.value) {
    return t('acessos.leituraReceita.lendo')
  }

  return aplicados > 0
    ? t('acessos.leituraReceita.prontaTitulo', { n: aplicados }, aplicados)
    : t('acessos.leituraReceita.semItens')
})

/* ------------------------------------------------------------ relógio da leitura */

const segundos = ref(0)
let relogio: ReturnType<typeof setInterval> | null = null

watch(
  emLeitura,
  (lendo) => {
    if (relogio) {
      clearInterval(relogio)
      relogio = null
    }

    if (lendo) {
      const inicio = Date.now()
      segundos.value = 0
      relogio = setInterval(() => {
        segundos.value = Math.floor((Date.now() - inicio) / 1000)
      }, 1000)
    }
  },
  { immediate: true },
)

const tempoLegivel = computed(() =>
  new Intl.NumberFormat(INTL_LOCALE[locale.value as Locale], {
    style: 'unit',
    unit: 'second',
    unitDisplay: 'narrow',
  }).format(segundos.value),
)

/* ------------------------------------------------------------ miniaturas */

type Miniatura = { url: string | null; pdf: boolean; nome: string; tamanho: string }

const miniaturas = shallowRef<Miniatura[]>([])

function soltarMiniaturas() {
  for (const miniatura of miniaturas.value) {
    if (miniatura.url) {
      URL.revokeObjectURL(miniatura.url)
    }
  }
}

watch(
  () => props.leitura.arquivos,
  (lista) => {
    soltarMiniaturas()
    miniaturas.value = lista.map((arquivo) => ({
      url: ehPdf(arquivo) ? null : URL.createObjectURL(arquivo),
      pdf: ehPdf(arquivo),
      nome: arquivo.name,
      tamanho: tamanho(arquivo.size),
    }))
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  soltarMiniaturas()

  if (relogio) {
    clearInterval(relogio)
  }

  if (atrasoDoFim) {
    clearTimeout(atrasoDoFim)
  }
})

/* ------------------------------------------------------------ escolher e arrastar */

function abrirSeletor() {
  if (props.disabled) {
    return
  }

  if (props.leitura.vagas <= 0) {
    // Sem lugar para a receita: o aviso explica, o seletor nem abre.
    void props.leitura.adicionarArquivos([])
    return
  }

  seletor.value?.click()
}

function aoEscolher(evento: Event) {
  const input = evento.target as HTMLInputElement
  const lista = Array.from(input.files ?? [])
  input.value = ''

  if (lista.length) {
    void props.leitura.adicionarArquivos(lista)
  }
}

function tentarOutra() {
  props.leitura.limpar()
  abrirSeletor()
}

/** Arrastar só vale antes de mandar ler: no botão e com as páginas ainda na mesa. */
const aceitaSoltar = computed(
  () => !props.disabled && (etapa.value === 'inicial' || etapa.value === 'escolhendo'),
)

const arrastando = ref(false)
let profundidade = 0

function temArquivo(evento: DragEvent) {
  return Array.from(evento.dataTransfer?.types ?? []).includes('Files')
}

function aoEntrarArrastando(evento: DragEvent) {
  if (!aceitaSoltar.value || !temArquivo(evento)) {
    return
  }

  profundidade += 1
  arrastando.value = true
}

function aoSairArrastando() {
  profundidade = Math.max(0, profundidade - 1)

  if (profundidade === 0) {
    arrastando.value = false
  }
}

function aoArrastarPorCima(evento: DragEvent) {
  if (aceitaSoltar.value && temArquivo(evento) && evento.dataTransfer) {
    evento.dataTransfer.dropEffect = 'copy'
  }
}

function aoSoltar(evento: DragEvent) {
  profundidade = 0
  arrastando.value = false

  if (!aceitaSoltar.value) {
    return
  }

  const lista = Array.from(evento.dataTransfer?.files ?? [])

  if (lista.length) {
    void props.leitura.adicionarArquivos(lista)
  }
}

/* ------------------------------------------------------------ textos */

const textoDoAviso = computed(() => {
  const aviso = props.leitura.aviso

  if (!aviso) {
    return ''
  }

  if (aviso.tipo === 'semVaga') {
    return t('acessos.leituraReceita.semVaga', { n: MAX_ANEXOS_ANOTACAO })
  }

  if (aviso.tipo === 'mensagem') {
    return aviso.texto || t('acessos.leituraReceita.erroEnvio')
  }

  switch (aviso.problema) {
    case 'HEIC':
      return t('acessos.leituraReceita.erroArquivo.heic')
    case 'TIPO':
      return t('acessos.leituraReceita.erroArquivo.tipo')
    case 'MISTURA':
      return t('acessos.leituraReceita.erroArquivo.mistura')
    case 'PDF_GRANDE':
      return t('acessos.leituraReceita.erroArquivo.pdfGrande')
    case 'IMAGEM_GRANDE':
      return t('acessos.leituraReceita.erroArquivo.imagemGrande')
    default:
      return t('acessos.leituraReceita.erroArquivo.limite', { n: aviso.maximo }, aviso.maximo)
  }
})

function tamanho(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

const regra = computed(() => {
  const n = props.leitura.vagas

  return t('acessos.leituraReceita.regra', { n }, n)
})
</script>

<template>
  <div
    class="lrc"
    :aria-busy="emLeitura || leitura.preparando"
    @dragenter.prevent="aoEntrarArrastando"
    @dragleave="aoSairArrastando"
    @dragover.prevent="aoArrastarPorCima"
    @drop.prevent="aoSoltar"
  >
    <input
      ref="seletor"
      class="lrc__input"
      type="file"
      multiple
      :accept="ACCEPT_LEITURA"
      tabindex="-1"
      aria-hidden="true"
      @change="aoEscolher"
    />

    <!-- Camada por cima do bloco enquanto um arquivo passa: não muda a altura de nada. -->
    <Transition name="lrc-troca">
      <div v-if="arrastando" class="lrc__soltar" aria-hidden="true">
        <i class="ph ph-download-simple" />
        {{ t('acessos.leituraReceita.soltar') }}
      </div>
    </Transition>

    <Transition name="lrc-troca" mode="out-in">
      <!-- O botão, numa faixa que também recebe o arquivo arrastado -->
      <div v-if="etapa === 'inicial'" key="inicial" class="lrc__inicio">
        <Button
          :label="t('acessos.leituraReceita.botao')"
          icon="ph ph-sparkle"
          severity="secondary"
          outlined
          size="small"
          :loading="leitura.preparando"
          :disabled="disabled"
          @click="abrirSeletor"
        />
        <span class="lrc__apoio">
          {{ t('acessos.leituraReceita.apoio') }}
          <span class="lrc__arraste">{{ t('acessos.leituraReceita.arraste') }}</span>
        </span>
      </div>

      <!-- Páginas escolhidas, ainda na mesa -->
      <div v-else-if="etapa === 'escolhendo'" key="escolhendo" class="lrc__caixa">
        <div class="lrc__titulo">
          <i class="ph ph-sparkle" aria-hidden="true" />
          <span>{{ t('acessos.leituraReceita.escolhaTitulo') }}</span>
        </div>
        <p class="lrc__texto">
          {{ regra }}
          <template v-if="anexosDoFormulario > 0">
            {{
              t(
                'acessos.leituraReceita.anexosOcupam',
                { n: anexosDoFormulario, max: MAX_ANEXOS_ANOTACAO },
                anexosDoFormulario,
              )
            }}
          </template>
        </p>

        <TransitionGroup tag="ul" name="lrc-pagina" class="lrc__paginas">
          <li
            v-for="(miniatura, indice) in miniaturas"
            :key="`${miniatura.nome}-${indice}`"
            class="lrc__pagina"
            :title="`${miniatura.nome} · ${miniatura.tamanho}`"
          >
            <img
              v-if="miniatura.url"
              :src="miniatura.url"
              :alt="t('acessos.leituraReceita.pagina', { n: indice + 1 })"
            />
            <span v-else class="lrc__pdf">
              <i class="ph ph-file-pdf" aria-hidden="true" />
              <small>{{ miniatura.tamanho }}</small>
            </span>
            <Button
              class="lrc__tirar"
              icon="ph ph-x"
              severity="secondary"
              rounded
              size="small"
              :disabled="disabled"
              :aria-label="t('acessos.leituraReceita.remover', { nome: miniatura.nome })"
              @click="leitura.removerArquivo(indice)"
            />
          </li>
          <li v-if="leitura.podeAdicionar" key="mais" class="lrc__pagina lrc__pagina--mais">
            <Button
              class="lrc__mais"
              icon="ph ph-plus"
              severity="secondary"
              text
              :label="t('acessos.leituraReceita.adicionar')"
              :loading="leitura.preparando"
              :disabled="disabled"
              @click="abrirSeletor"
            />
          </li>
        </TransitionGroup>

        <div class="lrc__acoes">
          <span class="lrc__espaco" />
          <Button
            :label="t('acessos.leituraReceita.cancelar')"
            severity="secondary"
            text
            size="small"
            :disabled="disabled"
            @click="leitura.limpar()"
          />
          <Button
            :label="t('acessos.leituraReceita.ler')"
            icon="ph ph-sparkle"
            size="small"
            :disabled="disabled || leitura.preparando"
            @click="leitura.enviar()"
          />
        </div>
      </div>

      <!-- Lendo: as páginas sob o feixe, as etapas e o tempo -->
      <div
        v-else-if="emLeitura"
        key="lendo"
        class="lrc__caixa lrc__leitura"
        :class="{ 'lrc__leitura--fim': fechando }"
        role="status"
      >
        <ul class="lrc__folhas" aria-hidden="true">
          <li
            v-for="(miniatura, indice) in miniaturas"
            :key="`${miniatura.nome}-${indice}`"
            class="lrc__folha"
            :style="{ '--folha': indice }"
          >
            <img v-if="miniatura.url" :src="miniatura.url" alt="" />
            <span v-else class="lrc__pdf"><i class="ph ph-file-pdf" /></span>
          </li>
        </ul>

        <div class="lrc__progresso">
          <div class="lrc__titulo">
            <i
              :class="fechando ? 'ph ph-check-circle' : 'ph ph-sparkle lrc__brilho'"
              aria-hidden="true"
            />
            <span>{{ tituloDaLeitura }}</span>
            <span class="lrc__tempo" aria-hidden="true">{{ tempoLegivel }}</span>
          </div>

          <ol class="lrc__passos">
            <li
              v-for="passo in passos"
              :key="passo.chave"
              class="lrc__passo"
              :data-estado="passo.estado"
              :aria-current="passo.estado === 'agora' ? 'step' : undefined"
            >
              <span class="lrc__marca" aria-hidden="true">
                <i v-if="passo.estado === 'feito'" class="ph ph-check" />
              </span>
              {{ passo.texto }}
            </li>
          </ol>

          <div class="lrc__rodape">
            <p class="lrc__texto">{{ t('acessos.leituraReceita.continuar') }}</p>
            <Button
              v-if="!fechando"
              :label="t('acessos.leituraReceita.cancelarLeitura')"
              severity="secondary"
              text
              size="small"
              @click="leitura.limpar()"
            />
          </div>
        </div>
      </div>

      <!-- Demorou ou a consulta falhou -->
      <div
        v-else-if="etapa === 'demorou' || etapa === 'erroConsulta'"
        key="demorou"
        class="lrc__caixa"
        role="status"
      >
        <div class="lrc__titulo">
          <i class="ph ph-hourglass-medium" aria-hidden="true" />
          <span>
            {{
              etapa === 'demorou'
                ? t('acessos.leituraReceita.demorou')
                : t('acessos.leituraReceita.erroConsulta')
            }}
          </span>
        </div>
        <p v-if="etapa === 'erroConsulta' && leitura.erroConsulta" class="lrc__texto">
          {{ leitura.erroConsulta }}
        </p>
        <div class="lrc__acoes">
          <span class="lrc__espaco" />
          <Button
            :label="t('acessos.leituraReceita.cancelar')"
            severity="secondary"
            text
            size="small"
            @click="leitura.limpar()"
          />
          <Button
            :label="t('acessos.leituraReceita.verDeNovo')"
            icon="ph ph-arrow-clockwise"
            severity="secondary"
            outlined
            size="small"
            @click="leitura.verDeNovo()"
          />
        </div>
      </div>

      <!-- Falhou -->
      <div v-else-if="etapa === 'falhou'" key="falhou" class="lrc__caixa" role="alert">
        <div class="lrc__titulo lrc__titulo--erro">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ t('acessos.leituraReceita.falhouTitulo') }}</span>
        </div>
        <p class="lrc__texto">
          {{ leitura.mensagemFalha || t('acessos.leituraReceita.falhouGenerico') }}
        </p>
        <div class="lrc__acoes">
          <span class="lrc__espaco" />
          <Button
            :label="t('acessos.leituraReceita.cancelar')"
            severity="secondary"
            text
            size="small"
            @click="leitura.limpar()"
          />
          <Button
            :label="t('acessos.leituraReceita.outraFoto')"
            icon="ph ph-camera"
            severity="secondary"
            outlined
            size="small"
            :disabled="disabled"
            @click="tentarOutra"
          />
        </div>
      </div>

      <!-- Já usada em outra anotação -->
      <div v-else-if="etapa === 'jaUsada'" key="jaUsada" class="lrc__caixa" role="status">
        <div class="lrc__titulo">
          <i class="ph ph-info" aria-hidden="true" />
          <span>{{ t('acessos.leituraReceita.jaUsada') }}</span>
        </div>
        <div class="lrc__acoes">
          <span class="lrc__espaco" />
          <Button
            :label="t('acessos.leituraReceita.lerOutra')"
            icon="ph ph-sparkle"
            severity="secondary"
            outlined
            size="small"
            :disabled="disabled"
            @click="tentarOutra"
          />
        </div>
      </div>

      <!-- Pronta -->
      <div
        v-else-if="etapa === 'pronta' && leitura.resultado"
        key="pronta"
        class="lrc__caixa lrc__caixa--pronta"
        role="status"
      >
        <div class="lrc__titulo lrc__titulo--ok">
          <i class="ph ph-check-circle lrc__ok" aria-hidden="true" />
          <span>
            {{
              leitura.resultado.aplicados > 0
                ? t(
                    'acessos.leituraReceita.prontaTitulo',
                    { n: leitura.resultado.aplicados },
                    leitura.resultado.aplicados,
                  )
                : t('acessos.leituraReceita.semItens')
            }}
          </span>
        </div>
        <p v-if="leitura.resultado.cortados > 0" class="lrc__texto">
          {{
            t(
              'acessos.leituraReceita.cortados',
              { n: leitura.resultado.cortados, max: MAX_ITENS_LISTA },
              leitura.resultado.cortados,
            )
          }}
        </p>
        <p v-if="leitura.resultado.temConferir" class="lrc__confira">
          <i class="ph ph-eye" aria-hidden="true" />
          {{ t('acessos.leituraReceita.conferirCampos') }}
        </p>
        <p v-if="leitura.vinculo" class="lrc__texto">
          <i class="ph ph-paperclip" aria-hidden="true" />
          {{
            leitura.vinculo.pdf
              ? t('acessos.leituraReceita.anexoPdf')
              : t(
                  'acessos.leituraReceita.anexoFotos',
                  { n: leitura.vinculo.arquivos },
                  leitura.vinculo.arquivos,
                )
          }}
        </p>
        <div class="lrc__acoes">
          <span class="lrc__espaco" />
          <Button
            :label="t('acessos.leituraReceita.desvincular')"
            severity="secondary"
            text
            size="small"
            :disabled="disabled"
            @click="leitura.limpar()"
          />
        </div>
      </div>
    </Transition>

    <p v-if="textoDoAviso" class="lrc__aviso" role="alert">{{ textoDoAviso }}</p>
  </div>
</template>

<style scoped>
.lrc {
  --lrc-tinta: var(--hc-lilas-tinta);
  --lrc-fundo: color-mix(in srgb, var(--hc-lilas-fundo) 55%, var(--hc-cartao));
  --lrc-borda: color-mix(in srgb, var(--hc-lilas-tinta) 22%, transparent);

  position: relative;
  display: grid;
  gap: 0.45rem;
}

.lrc__input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ------------------------------------------------------------ o botão */

.lrc__inicio {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.8rem;
  padding: 0.55rem 0.7rem;
  border: 1px dashed var(--lrc-borda);
  border-radius: 0.75rem;
  transition:
    border-color 150ms ease-out,
    background-color 150ms ease-out;
}

.lrc__apoio {
  color: var(--folha-suave, var(--partner-muted));
  font-size: 0.78rem;
  line-height: 1.4;
}

/* Arrastar é de quem tem mouse: no toque a frase só ocuparia lugar. */
.lrc__arraste {
  display: none;
}

@media (pointer: fine) {
  .lrc__arraste {
    display: inline;
  }
}

.lrc__soltar {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1.5px solid var(--lrc-tinta);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--hc-lilas-fundo) 92%, var(--hc-cartao));
  color: var(--lrc-tinta);
  font-size: 0.85rem;
  font-weight: 700;
  pointer-events: none;
}

.lrc__soltar i {
  font-size: 1.1rem;
}

/* ------------------------------------------------------------ caixas */

/* O que a máquina propôs mora na pervinca: a caixa da leitura e os campos a conferir falam a mesma cor. */
.lrc__caixa {
  display: grid;
  gap: 0.45rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--lrc-borda);
  border-radius: 0.75rem;
  background: var(--lrc-fundo);
  transition:
    border-color 150ms ease-out,
    background-color 150ms ease-out;
}

/* Pronta: a única ação (não anexar) sobe para o lado do título em vez de ganhar linha própria. */
.lrc__caixa--pronta {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
}

.lrc__caixa--pronta > :not(.lrc__acoes) {
  grid-column: 1;
}

.lrc__caixa--pronta > .lrc__acoes {
  grid-column: 2;
  grid-row: 1 / span 4;
}

.lrc__caixa--pronta .lrc__espaco {
  display: none;
}

.lrc__titulo {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--hc-tinta, var(--partner-text));
  font-size: 0.82rem;
  font-weight: 750;
}

.lrc__titulo i {
  flex: 0 0 auto;
  color: var(--lrc-tinta);
  font-size: 1rem;
}

.lrc__titulo--ok i {
  color: var(--hc-verde-tinta, var(--partner-success-text));
}

.lrc__titulo--erro i {
  color: var(--hc-coral-tinta, var(--partner-warm-text));
}

.lrc__texto {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  margin: 0;
  color: var(--folha-suave, var(--partner-muted));
  font-size: 0.76rem;
  line-height: 1.45;
}

.lrc__confira {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  margin: 0;
  color: var(--lrc-tinta);
  font-size: 0.76rem;
  font-weight: 650;
  line-height: 1.45;
}

.lrc__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.lrc__espaco {
  flex: 1 1 auto;
}

.lrc__aviso {
  margin: 0;
  color: var(--hc-coral-tinta, var(--partner-warm-text));
  font-size: 0.75rem;
  font-weight: 650;
  line-height: 1.35;
}

/* ------------------------------------------------------------ páginas escolhidas */

.lrc__paginas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin: 0.15rem 0 0;
  padding: 0;
  list-style: none;
}

.lrc__pagina {
  position: relative;
  display: grid;
  width: 4.75rem;
  height: 6.25rem;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--lrc-borda);
  border-radius: 0.6rem;
  background: var(--hc-cartao);
  box-shadow: 0 1px 2px rgb(20 32 28 / 8%);
}

.lrc__pagina img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lrc__pdf {
  display: grid;
  gap: 0.2rem;
  place-items: center;
  color: var(--lrc-tinta);
  font-size: 1.6rem;
}

.lrc__pdf small {
  color: var(--folha-suave, var(--partner-muted));
  font-size: 0.65rem;
  font-weight: 650;
}

.lrc__tirar.p-button {
  position: absolute;
  top: 0.25rem;
  inset-inline-end: 0.25rem;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  background: color-mix(in srgb, var(--hc-tinta) 72%, transparent);
  color: var(--hc-cartao);
  font-size: 0.7rem;
}

.lrc__tirar.p-button:not(:disabled):hover {
  background: var(--hc-coral-tinta);
  color: #ffffff;
}

.lrc__pagina--mais {
  border-style: dashed;
  background: transparent;
  box-shadow: none;
}

.lrc__mais.p-button {
  flex-direction: column;
  width: 100%;
  height: 100%;
  gap: 0.25rem;
  padding: 0.35rem;
  border-radius: 0;
  color: var(--lrc-tinta);
  font-size: 0.68rem;
  line-height: 1.2;
  text-align: center;
}

/* ------------------------------------------------------------ lendo */

.lrc__leitura {
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.lrc__folhas {
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Mais de uma página: em leque, uma por cima da outra. */
.lrc__folha {
  position: relative;
  display: grid;
  width: 3.9rem;
  height: 5.2rem;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--lrc-borda);
  border-radius: 0.5rem;
  background: var(--hc-cartao);
  box-shadow: 0 2px 6px rgb(20 32 28 / 12%);
  transform: rotate(calc((var(--folha) - 0.5) * 4deg));
}

.lrc__folha + .lrc__folha {
  margin-inline-start: -2.4rem;
}

.lrc__folha img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* O feixe: uma faixa pervinca que desce a página, uma folha de cada vez. */
.lrc__folha::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  top: 0;
  height: 40%;
  background: linear-gradient(
    to bottom,
    transparent,
    color-mix(in srgb, var(--lrc-tinta) 22%, transparent) 70%,
    color-mix(in srgb, var(--lrc-tinta) 75%, transparent) 97%,
    transparent
  );
  transform: translateY(-100%);
  animation: lrc-feixe 1.8s cubic-bezier(0.45, 0, 0.55, 1) infinite;
  animation-delay: calc(var(--folha) * 0.45s);
}

@keyframes lrc-feixe {
  0% {
    transform: translateY(-100%);
  }

  100% {
    transform: translateY(250%);
  }
}

.lrc__leitura--fim .lrc__folha::after {
  animation: none;
  opacity: 0;
}

.lrc__progresso {
  display: grid;
  gap: 0.55rem;
  min-width: 0;
}

.lrc__brilho {
  animation: lrc-brilho 1.6s ease-in-out infinite;
}

@keyframes lrc-brilho {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.55;
    transform: scale(0.86);
  }
}

.lrc__tempo {
  margin-inline-start: auto;
  color: var(--folha-suave, var(--partner-muted));
  font-size: 0.74rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.lrc__passos {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lrc__passo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--folha-suave, var(--partner-muted));
  font-size: 0.8rem;
  transition: color 200ms ease-out;
}

.lrc__passo[data-estado='agora'] {
  color: var(--hc-tinta, var(--partner-text));
  font-weight: 650;
}

.lrc__passo[data-estado='depois'] {
  opacity: 0.6;
}

.lrc__marca {
  position: relative;
  display: grid;
  width: 1.1rem;
  height: 1.1rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1.5px solid color-mix(in srgb, var(--lrc-tinta) 40%, transparent);
  border-radius: 999px;
  color: var(--hc-cartao);
  font-size: 0.62rem;
  transition:
    background-color 200ms ease-out,
    border-color 200ms ease-out;
}

/* Etapa de agora: um anel que gira, na tinta da máquina. */
.lrc__passo[data-estado='agora'] .lrc__marca {
  border-color: color-mix(in srgb, var(--lrc-tinta) 25%, transparent);
  border-top-color: var(--lrc-tinta);
  animation: lrc-gira 0.9s linear infinite;
}

.lrc__passo[data-estado='feito'] .lrc__marca {
  border-color: var(--lrc-tinta);
  background: var(--lrc-tinta);
}

.lrc__passo[data-estado='feito'] .lrc__marca i {
  animation: lrc-marca 220ms ease-out both;
}

@keyframes lrc-gira {
  to {
    transform: rotate(360deg);
  }
}

@keyframes lrc-marca {
  from {
    opacity: 0;
    transform: scale(0.4);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.lrc__rodape {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
}

/* Pronta: o check entra com um leve pulo, uma vez. */
.lrc__ok {
  animation: lrc-ok 320ms cubic-bezier(0.3, 1.4, 0.5, 1) both;
}

@keyframes lrc-ok {
  from {
    opacity: 0;
    transform: scale(0.5);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ------------------------------------------------------------ transições */

.lrc-troca-enter-active,
.lrc-troca-leave-active {
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out;
}

.lrc-troca-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.lrc-troca-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.lrc-pagina-enter-active,
.lrc-pagina-leave-active {
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out;
}

.lrc-pagina-enter-from,
.lrc-pagina-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

.lrc-pagina-move {
  transition: transform 180ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .lrc__inicio,
  .lrc__caixa,
  .lrc__passo,
  .lrc__marca,
  .lrc-troca-enter-active,
  .lrc-troca-leave-active,
  .lrc-pagina-enter-active,
  .lrc-pagina-leave-active,
  .lrc-pagina-move {
    transition: none;
  }

  .lrc__folha::after,
  .lrc__brilho,
  .lrc__ok,
  .lrc__passo[data-estado] .lrc__marca,
  .lrc__passo[data-estado] .lrc__marca i {
    animation: none;
  }

  /* Sem o feixe, a página em leitura ganha só um véu fixo. */
  .lrc__folha::after {
    top: 0;
    height: 100%;
    background: color-mix(in srgb, var(--lrc-tinta) 12%, transparent);
    transform: none;
  }
}

@media (max-width: 640px) {
  .lrc__leitura {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
