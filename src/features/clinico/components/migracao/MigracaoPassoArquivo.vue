<script setup lang="ts">
/**
 * Passo 1 — de onde vêm os dados.
 *
 * Uma pergunta só, e a promessa que tira o medo de começar: nada é gravado antes do fim. Os
 * exemplos ficam abaixo do cartão, como alternativa — não competem com o arquivo da pessoa.
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
</script>

<template>
  <section class="mg-cartao" aria-labelledby="mg-arquivo-titulo">
    <header class="cabeca">
      <h2 id="mg-arquivo-titulo" class="mg-titulo">{{ t('clinico.migracao.arquivo.titulo') }}</h2>
      <p class="mg-texto">{{ t('clinico.migracao.arquivo.texto') }}</p>
    </header>

    <div
      class="soltar"
      :class="{ 'soltar--ativo': arrastando }"
      @dragenter.prevent="aoEntrar"
      @dragover.prevent
      @dragleave.prevent="aoSair"
      @drop.prevent="aoSoltar"
    >
      <span class="soltar__icone" aria-hidden="true">
        <i :class="migracao.lendo ? 'pi pi-spin pi-spinner' : 'pi pi-upload'" />
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
        mode="basic"
        accept=".xlsx,.csv,.txt,.xls"
        auto
        custom-upload
        choose-icon="pi pi-folder-open"
        :choose-label="t('clinico.migracao.arquivo.escolher')"
        :choose-button-props="{ class: 'mg-pilula mg-pilula--cheia mg-pilula--grande' }"
        :disabled="migracao.lendo || migracao.emAndamento"
        @uploader="aoEscolher"
      />
      <span class="soltar__formatos">
        {{ t('clinico.migracao.arquivo.formatos', { mb: LIMITE_DO_ARQUIVO_MB }) }}
      </span>
    </div>

    <p v-if="migracao.erroDeLeitura" class="mg-caixa mg-caixa--coral erro" role="alert">
      <i class="pi pi-exclamation-circle" aria-hidden="true" />
      <span>{{ t(`clinico.migracao.arquivo.erro.${migracao.erroDeLeitura}`) }}</span>
    </p>

    <p class="promessa">
      <i class="pi pi-lock" aria-hidden="true" />
      {{ t('clinico.migracao.arquivo.promessa') }}
    </p>
  </section>

  <section class="exemplos" aria-labelledby="mg-exemplos-titulo">
    <header class="cabeca">
      <h3 id="mg-exemplos-titulo" class="exemplos__titulo">
        {{ t('clinico.migracao.arquivo.exemplosTitulo') }}
      </h3>
      <p class="mg-texto">{{ t('clinico.migracao.arquivo.exemplosTexto') }}</p>
    </header>

    <ul class="exemplos__lista">
      <li v-for="demonstracao in DEMONSTRACOES" :key="demonstracao.id" class="exemplo">
        <span class="mg-chip hc--cinza">
          {{
            t(
              'clinico.migracao.comum.linhasN',
              { n: formato.numero(LINHAS[demonstracao.id], 0) },
              LINHAS[demonstracao.id],
            )
          }}
        </span>
        <strong class="exemplo__nome">
          {{ t(`clinico.migracao.arquivo.demo.${demonstracao.id}.titulo`) }}
        </strong>
        <p class="exemplo__descricao">
          {{ t(`clinico.migracao.arquivo.demo.${demonstracao.id}.descricao`) }}
        </p>
        <div class="exemplo__acoes">
          <Button
            class="mg-pilula mg-pilula--pequena"
            icon="pi pi-play"
            :label="t('clinico.migracao.arquivo.usar')"
            :disabled="migracao.emAndamento"
            @click="migracao.usarDemonstracao(demonstracao.id)"
          />
          <Button
            v-if="demonstracao.id === 'clinica'"
            class="mg-pilula mg-pilula--pequena"
            icon="pi pi-download"
            :label="t('clinico.migracao.arquivo.baixar')"
            @click="baixar(demonstracao.id)"
          />
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.cabeca {
  display: grid;
  gap: 0.4rem;
}

/*
 * A área de soltar: tracejado sálvia sobre o fundo da página, o botão cheio no meio. Arrastando
 * por cima, o tracejado vira linha e o fundo ganha o véu — o sinal de que soltar ali funciona.
 */
.soltar {
  display: grid;
  justify-items: center;
  padding: 2.25rem 1.5rem;
  border: 2px dashed #b7d6cc;
  border-radius: 1rem;
  background: var(--hc-fundo);
  gap: 0.6rem;
  text-align: center;
  transition:
    background-color 160ms ease-out,
    border-color 160ms ease-out;
}

.soltar--ativo {
  border-style: solid;
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
}

.soltar__icone {
  display: inline-grid;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 999px;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
  font-size: 1.35rem;
  place-items: center;
}

.soltar__frase {
  color: var(--hc-tinta);
  font-size: 1.0625rem;
}

.soltar__ou,
.soltar__formatos {
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

.erro {
  display: flex;
  align-items: flex-start;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  gap: 0.6rem;
}

.erro .pi {
  margin-top: 0.2rem;
}

.promessa {
  display: flex;
  align-items: center;
  margin: 0;
  color: var(--hc-marca-forte);
  font-size: 0.9375rem;
  font-weight: 600;
  gap: 0.5rem;
}

.exemplos {
  display: grid;
  gap: 1rem;
}

.exemplos__titulo {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1.0625rem;
  font-weight: 700;
}

.exemplos__lista {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  list-style: none;
}

.exemplo {
  display: grid;
  align-content: start;
  justify-items: start;
  padding: 1.1rem 1.2rem 1.2rem;
  border: 1px solid var(--hc-borda);
  border-radius: 1rem;
  background: var(--hc-cartao);
  box-shadow: var(--hc-sombra);
  gap: 0.5rem;
}

.exemplo__nome {
  color: var(--hc-tinta);
  font-size: 1rem;
}

.exemplo__descricao {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  line-height: 1.5;
}

.exemplo__acoes {
  display: flex;
  flex-wrap: wrap;
  margin-top: 0.35rem;
  gap: 0.5rem;
}

@media (prefers-reduced-motion: reduce) {
  .soltar {
    transition: none;
  }
}
</style>
