<script setup lang="ts">
/**
 * Passo 3 — o resumo, o botão, o progresso e o relatório. Um cartão só, que muda de estado.
 *
 * O resultado cabe em três colunas, as mesmas antes e depois de importar, cada uma com o número
 * grande, a palavra e a cor do estado:
 *
 * - **Vão entrar** (ok) — linhas, e o que elas viram: pacientes novos, pacientes que já
 *   existiam e recebem dados, responsáveis novos, clientes que já eram da clínica.
 * - **Arrumamos sozinhos** (cor do lugar) — o que foi corrigido na leitura e o que estava errado e
 *   ficou em branco. Depois de importar, vira "falta completar" (atenção) com a lista para baixar.
 * - **Não vão entrar** (risco) — por motivo, com a lista para baixar e corrigir no Excel.
 *
 * Cada caixa tem uma pílula "Ver quais" que abre o painel de linhas já filtrado. O botão diz o que
 * vai fazer, com número: "Importar 32 linhas".
 *
 * Embaixo das caixas, uma linha sobre as colunas ("usamos 18 de 20; ficaram de fora Obs e Sem
 * título"). As colunas não são mais uma etapa — o sistema as liga sozinho —, e esta linha é o que
 * garante que nada saiu da planilha calado. Quem quiser conferir abre o painel.
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useColunasDaPlanilha } from '../../composables/useColunasDaPlanilha'
import { useRotulosDaMigracao } from '../../composables/useRotulosDaMigracao'
import {
  agruparPorMotivo,
  ehDescarte,
  linhasParaRevisar,
  PADRONIZACOES,
  type ItemDoPlano,
} from '../../domain/migracao'
import { escreverCsv } from '../../domain/planilha'
import { TAMANHO_DO_LOTE, useMigracaoStore } from '../../stores/migracao'

import MigracaoLinhas, { type FiltroDasLinhas } from './MigracaoLinhas.vue'

const emit = defineEmits<{ colunas: [] }>()

const { t } = useI18n()
const router = useRouter()
const migracao = useMigracaoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDaMigracao()

const { comConteudo, deFora } = useColunasDaPlanilha()

/** "Usamos 18 de 20 colunas." e, se houver, quais ficaram de fora — três nomes no máximo. */
const notaDasColunas = computed(() => {
  const total = comConteudo.value.length
  const usadas = total - deFora.value.length
  const inicio =
    deFora.value.length === 0
      ? t('clinico.migracao.colunas.nota.todas', { n: total }, total)
      : t('clinico.migracao.colunas.nota.parte', { n: usadas, total })

  if (deFora.value.length === 0) {
    return { inicio, fora: '' }
  }

  const nomes = deFora.value.slice(0, 3).map((coluna) => coluna.titulo)
  const resto = deFora.value.length - nomes.length
  const lista =
    resto > 0
      ? t('clinico.migracao.colunas.nota.eMais', { lista: nomes.join(', '), n: resto }, resto)
      : nomes.join(', ')

  return {
    inicio,
    fora: t('clinico.migracao.colunas.nota.fora', { lista }, deFora.value.length),
  }
})

const painelAberto = ref(false)
const filtroDoPainel = ref<FiltroDasLinhas>('todas')

function verLinhas(filtro: FiltroDasLinhas) {
  filtroDoPainel.value = filtro
  painelAberto.value = true
}

const itens = computed(() => migracao.plano?.itens ?? [])
const contagem = computed(() => migracao.plano?.contagem)

const entram = computed(
  () =>
    itens.value.filter((item) => item.situacao !== 'fora' && item.situacao !== 'pendente').length,
)
const fora = computed(() => itens.value.filter((item) => item.situacao === 'fora'))
const corrigidas = computed(
  () =>
    itens.value.filter(
      (item) => item.situacao !== 'fora' && item.ajustes.some((ajuste) => !ehDescarte(ajuste.tipo)),
    ).length,
)
const paraCompletar = computed(() =>
  itens.value.filter(
    (item) =>
      item.situacao !== 'fora' &&
      (item.avisos.length > 0 || item.ajustes.some((ajuste) => ehDescarte(ajuste.tipo))),
  ),
)
const valoresEmBranco = computed(() =>
  itens.value
    .filter((item) => item.situacao !== 'fora')
    .reduce(
      (soma, item) => soma + item.ajustes.filter((ajuste) => ehDescarte(ajuste.tipo)).length,
      0,
    ),
)
const semContato = computed(
  () =>
    itens.value.filter((item) => item.situacao !== 'fora' && item.avisos.includes('sem-contato'))
      .length,
)
const porMotivo = computed(() => agruparPorMotivo(itens.value))

const formatacao = computed(() => {
  const soma = migracao.leitura?.padronizacoes

  if (!soma) {
    return ''
  }

  return PADRONIZACOES.filter((tipo) => soma[tipo] > 0)
    .map((tipo) => t(`clinico.migracao.padronizacao.${tipo}`, { n: soma[tipo] }, soma[tipo]))
    .join(', ')
})

/** Linhas do "vão entrar", sem as que não se aplicam. */
const oQueEntra = computed(() => {
  const numeros = contagem.value

  if (!numeros) {
    return []
  }

  const linhas: string[] = []
  const somar = (chave: string, n: number) => {
    if (n > 0) {
      linhas.push(t(`clinico.migracao.resumo.entram.${chave}`, { n: formato.numero(n, 0) }, n))
    }
  }

  somar('pacientesNovos', numeros.animaisNovos)
  somar('pacientesExistentes', numeros.animaisExistentes)
  somar('responsaveisNovos', numeros.responsaveisNovos)
  somar('responsaveisExistentes', numeros.responsaveisExistentes)
  somar('soContato', numeros.contatos)

  return linhas
})

// ------------------------------------------------------------------ progresso

const percentual = computed(() =>
  migracao.total === 0 ? 100 : Math.round((migracao.cursor / migracao.total) * 100),
)

const lote = computed(() => ({
  atual: Math.min(
    Math.floor(migracao.cursor / TAMANHO_DO_LOTE) + 1,
    Math.max(1, Math.ceil(migracao.total / TAMANHO_DO_LOTE)),
  ),
  total: Math.max(1, Math.ceil(migracao.total / TAMANHO_DO_LOTE)),
}))

// ------------------------------------------------------------------ baixar

function baixar(lista: ItemDoPlano[], explicar: (item: ItemDoPlano) => string, sufixo: string) {
  const planilha = migracao.planilha

  if (!planilha) {
    return
  }

  const grade = linhasParaRevisar(
    planilha,
    lista,
    {
      linha: t('clinico.migracao.relatorio.colunaLinha'),
      oQueHouve: t('clinico.migracao.relatorio.colunaOQueHouve'),
    },
    explicar,
  )
  const blob = new Blob([`﻿${escreverCsv(grade)}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `${planilha.arquivo.replace(/\.[^.]+$/, '')}-${sufixo}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

/** A coluna "O que houve" do arquivo baixado: o que aconteceu e o que falta fazer, em frases. */
const explicar = (item: ItemDoPlano) =>
  [
    rotulos.oQueAcontece(item),
    ...rotulos
      .frasesDaLinha(item)
      .filter((frase) => frase.tom !== 'ok' && frase.tom !== 'corrigido')
      .map((frase) => frase.texto),
  ].join(' | ')

function baixarFora() {
  baixar(fora.value, explicar, t('clinico.migracao.relatorio.sufixoFora'))
}

function baixarCompletar() {
  baixar(paraCompletar.value, explicar, t('clinico.migracao.relatorio.sufixoCompletar'))
}

function abrirPaciente(petId: string) {
  void router.push(`/veterinario/paciente/${petId}/historico`)
}
</script>

<template>
  <section
    v-if="migracao.plano && contagem"
    class="mg-cartao cartao"
    aria-labelledby="mg-importar-titulo"
    aria-live="polite"
  >
    <!-- -------------------------------------------------------------- cabeçalho -->
    <header class="cabeca">
      <template v-if="migracao.estado === 'parada'">
        <h2 id="mg-importar-titulo" class="mg-titulo">{{ t('clinico.migracao.resumo.titulo') }}</h2>
        <p class="mg-texto">{{ t('clinico.migracao.resumo.texto') }}</p>
      </template>

      <template v-else-if="migracao.estado === 'concluida'">
        <span class="ui-selo ui-selo--ok">
          <i class="ph ph-check-circle" aria-hidden="true" />
          {{ t('clinico.migracao.relatorio.chip') }}
        </span>
        <h2 id="mg-importar-titulo" class="mg-titulo">
          {{
            t('clinico.migracao.relatorio.titulo', {
              entraram: formato.numero(entram, 0),
              total: formato.numero(itens.length, 0),
            })
          }}
        </h2>
        <p class="mg-texto">
          {{
            fora.length > 0
              ? t('clinico.migracao.relatorio.texto', { n: fora.length }, fora.length)
              : t('clinico.migracao.relatorio.textoTudo')
          }}
        </p>
      </template>

      <template v-else>
        <h2 id="mg-importar-titulo" class="mg-titulo">
          {{ t(`clinico.migracao.importacao.titulo.${migracao.estado}`) }}
        </h2>
      </template>
    </header>

    <!-- -------------------------------------------------------------- progresso -->
    <div v-if="migracao.estado !== 'parada' && migracao.estado !== 'concluida'" class="progresso">
      <p class="progresso__numero">
        <strong class="ui-num">
          {{
            t('clinico.migracao.importacao.feitas', {
              feitas: formato.numero(migracao.cursor, 0),
              total: formato.numero(migracao.total, 0),
            })
          }}
        </strong>
        <span class="ui-num">{{ formato.percentual(percentual / 100) }}</span>
      </p>
      <div
        class="progresso__barra"
        :class="`progresso__barra--${migracao.estado}`"
        role="progressbar"
        :aria-valuenow="percentual"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="t('clinico.migracao.importacao.progressoAria')"
      >
        <span class="progresso__cheia" :style="{ inlineSize: `${percentual}%` }" />
      </div>
      <p v-if="migracao.estado === 'falhou'" class="mg-aviso mg-aviso--risco" role="alert">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>{{ t('clinico.migracao.importacao.falha', { lote: lote.atual }) }}</span>
      </p>
      <p class="mg-texto">
        {{
          migracao.estado === 'rodando'
            ? t('clinico.migracao.importacao.podeSair')
            : migracao.loteEmVoo
              ? t('clinico.migracao.importacao.terminandoLote')
              : t('clinico.migracao.importacao.continuaDoPonto')
        }}
      </p>
    </div>

    <!-- -------------------------------------------------------------- as três colunas -->
    <div v-else class="caixas">
      <div class="caixa caixa--ok">
        <span class="caixa__rotulo">
          <span class="caixa__icone" aria-hidden="true"><i class="ph ph-check-circle" /></span>
          {{
            migracao.estado === 'concluida'
              ? t('clinico.migracao.relatorio.entraram')
              : t('clinico.migracao.resumo.entram.titulo')
          }}
        </span>
        <span class="caixa__conta">
          <strong class="caixa__numero ui-num">{{ formato.numero(entram, 0) }}</strong>
          <span class="caixa__unidade">{{ t('clinico.migracao.comum.linhasPalavra', entram) }}</span>
        </span>
        <ul class="caixa__lista">
          <li v-for="linha in oQueEntra" :key="linha">{{ linha }}</li>
        </ul>
        <div class="caixa__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-list-bullets"
            :label="t('clinico.migracao.resumo.verQuais')"
            @click="verLinhas('entram')"
          />
        </div>
      </div>

      <div
        v-if="migracao.estado === 'concluida'"
        class="caixa"
        :class="paraCompletar.length ? 'caixa--atencao' : 'caixa--neutro'"
      >
        <span class="caixa__rotulo">
          <span class="caixa__icone" aria-hidden="true"><i class="ph ph-pencil-simple" /></span>
          {{ t('clinico.migracao.relatorio.completar') }}
        </span>
        <span class="caixa__conta">
          <strong class="caixa__numero ui-num">{{ formato.numero(paraCompletar.length, 0) }}</strong>
          <span class="caixa__unidade">{{
            t('clinico.migracao.comum.linhasPalavra', paraCompletar.length)
          }}</span>
        </span>
        <ul class="caixa__lista">
          <li v-if="valoresEmBranco">
            {{ t('clinico.migracao.relatorio.emBranco', { n: valoresEmBranco }, valoresEmBranco) }}
          </li>
          <li v-if="semContato">
            {{ t('clinico.migracao.resumo.arrumamos.semContato', { n: semContato }, semContato) }}
          </li>
          <li v-if="paraCompletar.length === 0">
            {{ t('clinico.migracao.relatorio.nadaACompletar') }}
          </li>
        </ul>
        <div v-if="paraCompletar.length" class="caixa__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-download-simple"
            :label="t('clinico.migracao.relatorio.baixarCompletar')"
            @click="baixarCompletar"
          />
        </div>
      </div>

      <div v-else class="caixa caixa--lugar">
        <span class="caixa__rotulo">
          <span class="caixa__icone" aria-hidden="true"><i class="ph ph-magic-wand" /></span>
          {{ t('clinico.migracao.resumo.arrumamos.titulo') }}
        </span>
        <span class="caixa__conta">
          <strong class="caixa__numero ui-num">{{ formato.numero(corrigidas, 0) }}</strong>
          <span class="caixa__unidade">{{
            t('clinico.migracao.comum.linhasPalavra', corrigidas)
          }}</span>
        </span>
        <ul class="caixa__lista">
          <li>{{ t('clinico.migracao.resumo.arrumamos.corrigidas') }}</li>
          <li v-if="valoresEmBranco">
            {{
              t(
                'clinico.migracao.resumo.arrumamos.emBranco',
                { n: valoresEmBranco },
                valoresEmBranco,
              )
            }}
          </li>
          <li v-if="formatacao">
            {{ t('clinico.migracao.resumo.arrumamos.formatacao', { lista: formatacao }) }}
          </li>
        </ul>
        <div v-if="corrigidas" class="caixa__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-list-bullets"
            :label="t('clinico.migracao.resumo.verQuais')"
            @click="verLinhas('corrigidas')"
          />
        </div>
      </div>

      <div class="caixa" :class="fora.length ? 'caixa--risco' : 'caixa--neutro'">
        <span class="caixa__rotulo">
          <span class="caixa__icone" aria-hidden="true"><i class="ph ph-x-circle" /></span>
          {{
            migracao.estado === 'concluida'
              ? t('clinico.migracao.relatorio.ficaram')
              : t('clinico.migracao.resumo.fora.titulo')
          }}
        </span>
        <span class="caixa__conta">
          <strong class="caixa__numero ui-num">{{ formato.numero(fora.length, 0) }}</strong>
          <span class="caixa__unidade">{{
            t('clinico.migracao.comum.linhasPalavra', fora.length)
          }}</span>
        </span>
        <ul class="caixa__lista">
          <li v-for="grupo in porMotivo" :key="grupo.motivo" class="caixa__motivo">
            <strong class="ui-num">{{ grupo.linhas.length }}</strong>
            <span>{{ rotulos.motivo(grupo.motivo) }}</span>
          </li>
          <li v-if="fora.length === 0">{{ t('clinico.migracao.resumo.fora.nenhuma') }}</li>
        </ul>
        <div v-if="fora.length" class="caixa__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-list-bullets"
            :label="t('clinico.migracao.resumo.verQuais')"
            @click="verLinhas('fora')"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            text
            icon="ph ph-download-simple"
            :label="t('clinico.migracao.relatorio.baixarFora')"
            @click="baixarFora"
          />
        </div>
      </div>
    </div>

    <!-- Uma linha, não uma caixa: é conferência, não um quarto resultado. -->
    <div v-if="migracao.estado === 'parada' || migracao.estado === 'concluida'" class="colunas">
      <i class="ph ph-table colunas__icone" aria-hidden="true" />
      <p class="colunas__texto">
        <strong>{{ notaDasColunas.inicio }}</strong>
        <template v-if="notaDasColunas.fora">{{ ` ${notaDasColunas.fora}` }}</template>
      </p>
      <Button
        v-if="notaDasColunas.fora"
        type="button"
        size="small"
        severity="secondary"
        text
        icon="ph ph-table"
        :label="t('clinico.migracao.colunas.ver')"
        @click="emit('colunas')"
      />
    </div>

    <p v-if="migracao.estado === 'parada'" class="promessa">
      <i class="ph ph-shield-check" aria-hidden="true" />
      {{ t('clinico.migracao.resumo.promessa') }}
    </p>

    <!-- -------------------------------------------------------------- rodapé -->
    <footer class="mg-rodape">
      <template v-if="migracao.estado === 'parada'">
        <Button
          v-if="migracao.perguntas.length > 0"
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-arrow-left"
          :label="t('clinico.migracao.resumo.voltar')"
          @click="migracao.irPara('duvidas')"
        />
        <div class="mg-rodape__direita">
          <Button
            type="button"
            class="mg-adiante"
            icon="ph ph-file-arrow-up"
            :label="t('clinico.migracao.resumo.importar', { n: formato.numero(entram, 0) }, entram)"
            @click="migracao.importar()"
          />
        </div>
      </template>

      <template v-else-if="migracao.estado === 'concluida'">
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-list-bullets"
          :label="t('clinico.migracao.relatorio.verLinhas')"
          @click="verLinhas('todas')"
        />
        <div class="mg-rodape__direita">
          <Button
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-arrow-clockwise"
            :label="t('clinico.migracao.relatorio.outra')"
            @click="migracao.recomecar()"
          />
          <Button
            type="button"
            class="mg-adiante"
            icon="ph ph-users"
            :label="t('clinico.migracao.relatorio.verPacientes')"
            @click="router.push('/veterinario/pacientes')"
          />
        </div>
      </template>

      <template v-else>
        <span class="lote ui-num">{{
          t('clinico.migracao.importacao.lote', { atual: lote.atual, total: lote.total })
        }}</span>
        <div class="mg-rodape__direita">
          <Button
            v-if="migracao.estado === 'rodando'"
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-pause"
            :label="t('clinico.migracao.importacao.pausar')"
            @click="migracao.pausar()"
          />
          <Button
            v-else
            type="button"
            class="mg-adiante"
            :icon="migracao.estado === 'falhou' ? 'ph ph-arrow-counter-clockwise' : 'ph ph-play'"
            :label="
              migracao.estado === 'falhou'
                ? t('clinico.migracao.importacao.tentarDeNovo')
                : t('clinico.migracao.importacao.continuar')
            "
            @click="migracao.continuar()"
          />
        </div>
      </template>
    </footer>
  </section>

  <MigracaoLinhas
    v-model:visivel="painelAberto"
    v-model:filtro="filtroDoPainel"
    @abrir="abrirPaciente"
  />
</template>

<style scoped>
.cartao {
  container-type: inline-size;
}

.cabeca {
  display: grid;
  justify-items: start;
  gap: 6px;
}

/*
 * Três lado a lado quando o cartão comporta, uma embaixo da outra quando não — nunca duas e uma
 * sobrando, que fazia a coluna vermelha parecer um apêndice. Quem decide é a largura do cartão.
 * Uma faixa só, dividida por fios: nada de cartão dentro do cartão.
 */
.caixas {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.caixa {
  --caixa-fundo: var(--neutro-fundo);
  --caixa-tinta: var(--neutro-tinta);

  display: grid;
  align-content: start;
  gap: 10px;
  padding: 18px 20px 20px;
}

.caixa + .caixa {
  border-inline-start: 1px solid var(--linha);
}

.caixa--ok {
  --caixa-fundo: var(--ok-fundo);
  --caixa-tinta: var(--ok-tinta);
}

.caixa--lugar {
  --caixa-fundo: var(--pj-lugar-fundo, var(--clinica-fundo));
  --caixa-tinta: var(--pj-lugar-tinta, var(--clinica-tinta));
}

.caixa--atencao {
  --caixa-fundo: var(--atencao-fundo);
  --caixa-tinta: var(--atencao-tinta);
}

.caixa--risco {
  --caixa-fundo: var(--risco-fundo);
  --caixa-tinta: var(--risco-tinta);
}

@container (max-width: 44rem) {
  .caixas {
    grid-template-columns: minmax(0, 1fr);
  }

  .caixa + .caixa {
    border-top: 1px solid var(--linha);
    border-inline-start: 0;
  }
}

.caixa__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.caixa__icone {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  background: var(--caixa-fundo);
  color: var(--caixa-tinta);
  font-size: 17px;
}

.caixa__conta {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.caixa__numero {
  color: var(--tinta);
  font-size: 32px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.caixa--risco .caixa__numero,
.caixa--atencao .caixa__numero {
  color: var(--caixa-tinta);
}

.caixa__unidade {
  color: var(--tinta-2);
  font-size: 14px;
}

.caixa__lista {
  display: grid;
  gap: 5px;
  margin: 0;
  padding: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
  list-style: none;
}

.caixa__motivo {
  display: flex;
  gap: 8px;
}

.caixa__motivo strong {
  min-width: 1.5em;
  color: var(--caixa-tinta);
  font-weight: 650;
}

.caixa__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.caixa__acoes :deep(.p-button) {
  min-height: 36px;
}

.colunas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.colunas__icone {
  color: var(--tinta-3);
  font-size: 18px;
}

.colunas__texto {
  flex: 1 1 16rem;
  min-width: 0;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.colunas__texto strong {
  color: var(--tinta);
  font-weight: 550;
}

.promessa {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ok-tinta);
  font-size: 14px;
  font-weight: 550;
}

.promessa i {
  font-size: 18px;
}

/* ------------------------------------------------------------------------------ progresso */

.progresso {
  display: grid;
  gap: 12px;
}

.progresso__numero {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 14px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 16px;
}

.progresso__numero strong {
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.progresso__barra {
  overflow: hidden;
  height: 10px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.progresso__cheia {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--musgo);
  transition: inline-size var(--pj-tempo-medio, 200ms) ease-out;
}

.progresso__barra--pausada .progresso__cheia {
  background: var(--atencao);
}

.progresso__barra--falhou .progresso__cheia {
  background: var(--risco);
}

.lote {
  color: var(--tinta-2);
  font-size: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .progresso__cheia {
    transition: none;
  }
}
</style>
