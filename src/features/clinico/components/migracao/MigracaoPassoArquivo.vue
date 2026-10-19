<script setup lang="ts">
/**
 * Passo 1 — de onde vêm os dados.
 *
 * Uma pergunta só, e uma área generosa para soltar o arquivo. A promessa que tira o medo de
 * começar (nada é gravado antes do fim) mora na página, ao lado dos passos, e fica à vista até o
 * botão de importar. Os exemplos ficam abaixo, numa lista, como alternativa — não competem com o
 * arquivo da pessoa.
 */
import Button from 'primevue/button'
import FileUpload, { type FileUploadUploaderEvent } from 'primevue/fileupload'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import {
  DEMONSTRACOES,
  gradeDaDemonstracao,
  type DemonstracaoId,
} from '../../data/fixtures/planilhas-de-demonstracao'
import { LIMITE_DO_ARQUIVO_MB } from '../../data/leitura-de-planilha'
import { escreverCsv } from '../../domain/planilha'
import { useMigracaoStore } from '../../stores/migracao'

const { t } = useI18n()
const migracao = useMigracaoStore()
const formato = useClinicFormat()

const arrastando = ref(false)
/* O `clear` existe no componente, mas não na tipagem exportada pelo PrimeVue. */
const escolha = ref<{ clear: () => void } | null>(null)

/** Conta de entradas e saídas: o `dragleave` dispara também ao passar por cima de um filho. */
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

  if (arquivo) {
    await migracao.abrirArquivo(arquivo)
  }
}

async function aoEscolher(evento: FileUploadUploaderEvent) {
  const arquivo = (Array.isArray(evento.files) ? evento.files : [evento.files])[0]

  escolha.value?.clear()

  if (arquivo) {
    await migracao.abrirArquivo(arquivo)
  }
}

/** Com BOM e ponto e vírgula: é o que o Excel em português abre sem perguntar nada. */
function baixar(id: DemonstracaoId) {
  const arquivo = DEMONSTRACOES.find((item) => item.id === id)!.arquivo
  const blob = new Blob([`﻿${escreverCsv(gradeDaDemonstracao(id))}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = arquivo
  link.click()
  URL.revokeObjectURL(url)
}

const LINHAS: Record<DemonstracaoId, number> = { clinica: 39, simplesvet: 120, vetus: 2400 }

/** Cada exemplo com o desenho do que ele é: a planilha da clínica, o export, a base grande. */
const ICONE: Record<DemonstracaoId, string> = {
  clinica: 'ph ph-table',
  simplesvet: 'ph ph-export',
  vetus: 'ph ph-database',
}
</script>

<template>
  <section class="mg-cartao" aria-labelledby="mg-arquivo-titulo">
    <header class="cabeca">
      <h2 id="mg-arquivo-titulo" class="mg-titulo">{{ t('clinico.migracao.arquivo.titulo') }}</h2>
      <p class="mg-texto">{{ t('clinico.migracao.arquivo.texto') }}</p>
    </header>

    <!--
      A área de soltar: tracejado sobre o fundo, o botão cheio no meio. Arrastando por cima, o
      tracejado vira linha e o fundo ganha o tom do lugar — o sinal de que soltar ali funciona.
    -->
    <div
      class="soltar"
      :class="{ 'soltar--ativo': arrastando, 'soltar--lendo': migracao.lendo }"
      @dragenter.prevent="aoEntrar"
      @dragover.prevent
      @dragleave.prevent="aoSair"
      @drop.prevent="aoSoltar"
    >
      <span class="soltar__icone" aria-hidden="true">
        <i :class="migracao.lendo ? 'ph ph-spin ph-circle-notch' : 'ph ph-upload-simple'" />
      </span>
      <strong class="soltar__frase">
        {{
          migracao.lendo
            ? t('clinico.migracao.arquivo.lendo')
            : t('clinico.migracao.arquivo.soltar')
        }}
      </strong>
      <span class="soltar__ou">{{ t('clinico.migracao.arquivo.ou') }}</span>
      <FileUpload
        ref="escolha"
        class="soltar__escolha"
        mode="basic"
        accept=".xlsx,.csv,.txt,.xls"
        auto
        custom-upload
        choose-icon="ph ph-folder-open"
        :choose-label="t('clinico.migracao.arquivo.escolher')"
        :choose-button-props="{ class: 'mg-adiante' }"
        :disabled="migracao.lendo || migracao.emAndamento"
        @uploader="aoEscolher"
      />
      <span class="soltar__formatos">
        <i class="ph ph-file-xls" aria-hidden="true" />
        {{ t('clinico.migracao.arquivo.formatos', { mb: LIMITE_DO_ARQUIVO_MB }) }}
      </span>
    </div>

    <p v-if="migracao.erroDeLeitura" class="mg-aviso mg-aviso--risco" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ t(`clinico.migracao.arquivo.erro.${migracao.erroDeLeitura}`) }}</span>
    </p>
  </section>

  <section class="exemplos" aria-labelledby="mg-exemplos-titulo">
    <header class="exemplos__cabeca">
      <h3 id="mg-exemplos-titulo" class="exemplos__titulo">
        {{ t('clinico.migracao.arquivo.exemplosTitulo') }}
      </h3>
      <p class="exemplos__texto">{{ t('clinico.migracao.arquivo.exemplosTexto') }}</p>
    </header>

    <ul class="ui-folha ui-lista">
      <li v-for="demonstracao in DEMONSTRACOES" :key="demonstracao.id" class="exemplo">
        <span class="exemplo__icone" aria-hidden="true">
          <i :class="ICONE[demonstracao.id]" />
        </span>
        <span class="exemplo__texto">
          <strong class="exemplo__nome">
            {{ t(`clinico.migracao.arquivo.demo.${demonstracao.id}.titulo`) }}
            <span class="ui-selo ui-selo--contorno exemplo__linhas ui-num">
              {{
                t(
                  'clinico.migracao.comum.linhasN',
                  { n: formato.numero(LINHAS[demonstracao.id], 0) },
                  LINHAS[demonstracao.id],
                )
              }}
            </span>
          </strong>
          <span class="exemplo__descricao">
            {{ t(`clinico.migracao.arquivo.demo.${demonstracao.id}.descricao`) }}
          </span>
        </span>
        <span class="exemplo__acoes">
          <Button
            v-if="demonstracao.id === 'clinica'"
            type="button"
            size="small"
            severity="secondary"
            text
            icon="ph ph-download-simple"
            :label="t('clinico.migracao.arquivo.baixar')"
            @click="baixar(demonstracao.id)"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-play"
            :label="t('clinico.migracao.arquivo.usar')"
            :disabled="migracao.emAndamento"
            @click="migracao.usarDemonstracao(demonstracao.id)"
          />
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.cabeca {
  display: grid;
  gap: 6px;
}

.soltar {
  display: grid;
  min-height: 280px;
  align-content: center;
  justify-items: center;
  gap: 10px;
  padding: 36px 24px;
  border: 2px dashed var(--linha-forte);
  border-radius: 16px;
  background: var(--fundo);
  text-align: center;
  transition:
    background-color var(--pj-tempo-medio, 200ms) ease-out,
    border-color var(--pj-tempo-medio, 200ms) ease-out;
}

.soltar--ativo {
  border-style: solid;
  border-color: var(--pj-lugar, var(--musgo));
  background: var(--pj-lugar-fundo, var(--musgo-fundo));
}

.soltar__icone {
  display: grid;
  width: 60px;
  height: 60px;
  margin-bottom: 4px;
  place-items: center;
  border-radius: 18px;
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 28px;
}

.soltar--ativo .soltar__icone {
  background: var(--superficie);
}

.soltar__frase {
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.soltar__ou {
  color: var(--tinta-2);
  font-size: 14px;
}

.soltar__formatos {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.soltar__formatos i {
  color: var(--tinta-3);
  font-size: 17px;
}

/* ------------------------------------------------------------------------------- exemplos */

.exemplos {
  display: grid;
  gap: 12px;
}

.exemplos__cabeca {
  display: grid;
  gap: 2px;
}

.exemplos__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.exemplos__texto {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.exemplo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 14px 18px;
}

.exemplo__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 20px;
}

.exemplo__texto {
  display: grid;
  flex: 1 1 22rem;
  min-width: 0;
  gap: 2px;
}

.exemplo__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.exemplo__linhas {
  height: 22px;
  font-size: 12px;
}

.exemplo__descricao {
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.exemplo__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-inline-start: auto;
}

.exemplo__acoes :deep(.p-button) {
  min-height: 36px;
}

@media (prefers-reduced-motion: reduce) {
  .soltar {
    transition: none;
  }
}

@media (max-width: 720px) {
  .soltar {
    min-height: 220px;
    padding: 28px 16px;
  }
}
</style>
