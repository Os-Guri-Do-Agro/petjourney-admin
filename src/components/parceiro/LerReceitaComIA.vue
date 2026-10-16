<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LeituraReceitaParceiroEstado } from '@/composables/useLeituraReceitaParceiro'
import { MAX_ITENS_LISTA } from '@/utils/parceiro/anotacao-estruturada'
import { ACCEPT_LEITURA, ehPdf, MAX_ANEXOS_ANOTACAO } from '@/utils/parceiro/leitura-receita'

/**
 * Bloco "Ler receita com IA", acima da lista de remédios da anotação de consulta. A leitura
 * em si mora em `useLeituraReceitaParceiro` (a tela precisa dela no envio e na conta de
 * anexos); aqui só a escolha dos arquivos e cada situação da leitura.
 *
 * Texto lido da imagem nunca entra como HTML: o que a IA leu chega aos campos do formulário.
 */
const props = defineProps<{
  leitura: LeituraReceitaParceiroEstado
  /** Anexos já escolhidos no formulário (para dizer quanto sobra). */
  anexosDoFormulario: number
  disabled?: boolean
}>()

const { t } = useI18n()

const seletor = ref<HTMLInputElement | null>(null)

const etapa = computed(() => props.leitura.etapa)
const emLeitura = computed(() => etapa.value === 'enviando' || etapa.value === 'lendo')

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
  <div class="lrc" :aria-busy="emLeitura || leitura.preparando">
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

    <!-- O botão -->
    <div v-if="etapa === 'inicial'" class="lrc__inicio">
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
      <span class="lrc__apoio">{{ t('acessos.leituraReceita.apoio') }}</span>
    </div>

    <!-- Arquivos escolhidos -->
    <div v-else-if="etapa === 'escolhendo'" class="lrc__caixa">
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

      <ul class="lrc__arquivos">
        <li v-for="(arquivo, indice) in leitura.arquivos" :key="`${arquivo.name}-${indice}`">
          <i :class="ehPdf(arquivo) ? 'ph ph-file-pdf' : 'ph ph-image'" aria-hidden="true" />
          <span class="lrc__nome">{{ arquivo.name }}</span>
          <small>{{ tamanho(arquivo.size) }}</small>
          <Button
            icon="ph ph-x"
            severity="secondary"
            text
            rounded
            size="small"
            :disabled="disabled"
            :aria-label="t('acessos.leituraReceita.remover', { nome: arquivo.name })"
            @click="leitura.removerArquivo(indice)"
          />
        </li>
      </ul>

      <div class="lrc__acoes">
        <Button
          v-if="leitura.podeAdicionar"
          :label="t('acessos.leituraReceita.adicionar')"
          icon="ph ph-plus"
          severity="secondary"
          text
          size="small"
          :loading="leitura.preparando"
          :disabled="disabled"
          @click="abrirSeletor"
        />
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

    <!-- Lendo -->
    <div v-else-if="emLeitura" class="lrc__caixa" role="status">
      <div class="lrc__titulo">
        <i class="ph ph-circle-notch ph-spin" aria-hidden="true" />
        <span>{{ t('acessos.leituraReceita.lendo') }}</span>
      </div>
      <p class="lrc__texto">{{ t('acessos.leituraReceita.continuar') }}</p>
    </div>

    <!-- Demorou ou a consulta falhou -->
    <div
      v-else-if="etapa === 'demorou' || etapa === 'erroConsulta'"
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
    <div v-else-if="etapa === 'falhou'" class="lrc__caixa" role="alert">
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
    <div v-else-if="etapa === 'jaUsada'" class="lrc__caixa" role="status">
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
    <div v-else-if="etapa === 'pronta' && leitura.resultado" class="lrc__caixa" role="status">
      <div class="lrc__titulo lrc__titulo--ok">
        <i class="ph ph-check-circle" aria-hidden="true" />
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

    <p v-if="textoDoAviso" class="lrc__aviso" role="alert">{{ textoDoAviso }}</p>
  </div>
</template>

<style scoped>
.lrc {
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

.lrc__inicio {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.7rem;
}

.lrc__apoio {
  color: var(--partner-muted);
  font-size: 0.74rem;
  line-height: 1.4;
}

.lrc__caixa {
  display: grid;
  gap: 0.45rem;
  padding: 0.65rem 0.7rem 0.6rem;
  border: 1px solid var(--partner-line);
  border-radius: 0.8rem;
  background: var(--partner-card);
}

.lrc__titulo {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--partner-text);
  font-size: 0.8rem;
  font-weight: 750;
}

.lrc__titulo i {
  flex: 0 0 auto;
  color: var(--partner-primary-strong);
  font-size: 1rem;
}

.lrc__titulo--ok i {
  color: var(--partner-success-text);
}

.lrc__titulo--erro i {
  color: var(--partner-warm-text);
}

.lrc__texto {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.74rem;
  line-height: 1.45;
}

/* "A máquina propôs e ninguém aprovou ainda": a pervinca da casa (DESIGN.md, Secondary). */
.lrc__confira {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  margin: 0;
  color: var(--clinic-maquina);
  font-size: 0.74rem;
  font-weight: 650;
  line-height: 1.45;
}

.lrc__arquivos {
  display: grid;
  gap: 0.15rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lrc__arquivos li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  color: var(--partner-text);
  font-size: 0.76rem;
}

.lrc__arquivos li > i {
  flex: 0 0 auto;
  color: var(--partner-muted);
}

.lrc__nome {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lrc__arquivos small {
  flex: 0 0 auto;
  color: var(--partner-faint);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
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
  color: var(--partner-warm-text);
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.35;
}
</style>
