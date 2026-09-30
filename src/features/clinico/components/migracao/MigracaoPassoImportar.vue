<script setup lang="ts">
/**
 * Passo 3 — o resumo, o botão, o progresso e o relatório. Um cartão só, que muda de estado.
 *
 * O resultado cabe em três caixas, as mesmas antes e depois de importar:
 *
 * - **Vão entrar** (verde) — linhas, e o que elas viram: pacientes novos, pacientes que já
 *   existiam e recebem dados, responsáveis novos, clientes que já eram da clínica.
 * - **Arrumamos sozinhos** (azul) — o que foi corrigido na leitura e o que estava errado e ficou em
 *   branco. Depois de importar, a caixa vira "falta completar" (pêssego) com a lista para baixar.
 * - **Não vão entrar** (coral) — por motivo, com a lista para baixar e corrigir no Excel.
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
        <span class="mg-chip hc--verde"
          ><i class="pi pi-check" aria-hidden="true" />{{
            t('clinico.migracao.relatorio.chip')
          }}</span
        >
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
        <strong>
          {{
            t('clinico.migracao.importacao.feitas', {
              feitas: formato.numero(migracao.cursor, 0),
              total: formato.numero(migracao.total, 0),
            })
          }}
        </strong>
        <span>{{ formato.percentual(percentual / 100) }}</span>
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
      <p v-if="migracao.estado === 'falhou'" class="mg-caixa mg-caixa--coral falha" role="alert">
        <i class="pi pi-exclamation-triangle" aria-hidden="true" />
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

    <!-- -------------------------------------------------------------- as três caixas -->
    <div v-else class="caixas">
      <div class="mg-caixa mg-caixa--verde">
        <span class="mg-caixa__rotulo">
          <i class="pi pi-check-circle" aria-hidden="true" />
          {{
            migracao.estado === 'concluida'
              ? t('clinico.migracao.relatorio.entraram')
              : t('clinico.migracao.resumo.entram.titulo')
          }}
        </span>
        <strong class="mg-caixa__numero">{{ formato.numero(entram, 0) }}</strong>
        <span class="caixa__unidade">{{ t('clinico.migracao.comum.linhasPalavra', entram) }}</span>
        <ul class="mg-caixa__lista">
          <li v-for="linha in oQueEntra" :key="linha">{{ linha }}</li>
        </ul>
        <Button
          class="mg-pilula mg-pilula--pequena caixa__ver"
          icon="pi pi-list"
          :label="t('clinico.migracao.resumo.verQuais')"
          @click="verLinhas('entram')"
        />
      </div>

      <div
        v-if="migracao.estado === 'concluida'"
        class="mg-caixa"
        :class="paraCompletar.length ? 'mg-caixa--pessego' : 'mg-caixa--cinza'"
      >
        <span class="mg-caixa__rotulo">
          <i class="pi pi-pencil" aria-hidden="true" />
          {{ t('clinico.migracao.relatorio.completar') }}
        </span>
        <strong class="mg-caixa__numero">{{ formato.numero(paraCompletar.length, 0) }}</strong>
        <span class="caixa__unidade">{{
          t('clinico.migracao.comum.linhasPalavra', paraCompletar.length)
        }}</span>
        <ul class="mg-caixa__lista">
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
        <Button
          v-if="paraCompletar.length"
          class="mg-pilula mg-pilula--pequena caixa__ver"
          icon="pi pi-download"
          :label="t('clinico.migracao.relatorio.baixarCompletar')"
          @click="baixarCompletar"
        />
      </div>

      <div v-else class="mg-caixa mg-caixa--azul">
        <span class="mg-caixa__rotulo">
          <i class="pi pi-pencil" aria-hidden="true" />
          {{ t('clinico.migracao.resumo.arrumamos.titulo') }}
        </span>
        <strong class="mg-caixa__numero">{{ formato.numero(corrigidas, 0) }}</strong>
        <span class="caixa__unidade">{{
          t('clinico.migracao.comum.linhasPalavra', corrigidas)
        }}</span>
        <ul class="mg-caixa__lista">
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
        <Button
          v-if="corrigidas"
          class="mg-pilula mg-pilula--pequena caixa__ver"
          icon="pi pi-list"
          :label="t('clinico.migracao.resumo.verQuais')"
          @click="verLinhas('corrigidas')"
        />
      </div>

      <div class="mg-caixa" :class="fora.length ? 'mg-caixa--coral' : 'mg-caixa--cinza'">
        <span class="mg-caixa__rotulo">
          <i class="pi pi-times-circle" aria-hidden="true" />
          {{
            migracao.estado === 'concluida'
              ? t('clinico.migracao.relatorio.ficaram')
              : t('clinico.migracao.resumo.fora.titulo')
          }}
        </span>
        <strong class="mg-caixa__numero">{{ formato.numero(fora.length, 0) }}</strong>
        <span class="caixa__unidade">{{
          t('clinico.migracao.comum.linhasPalavra', fora.length)
        }}</span>
        <ul class="mg-caixa__lista">
          <li v-for="grupo in porMotivo" :key="grupo.motivo">
            <strong>{{ grupo.linhas.length }}</strong> · {{ rotulos.motivo(grupo.motivo) }}
          </li>
          <li v-if="fora.length === 0">{{ t('clinico.migracao.resumo.fora.nenhuma') }}</li>
        </ul>
        <div v-if="fora.length" class="caixa__acoes">
          <Button
            class="mg-pilula mg-pilula--pequena caixa__ver"
            icon="pi pi-list"
            :label="t('clinico.migracao.resumo.verQuais')"
            @click="verLinhas('fora')"
          />
          <Button
            class="mg-pilula mg-pilula--pequena caixa__ver"
            icon="pi pi-download"
            :label="t('clinico.migracao.relatorio.baixarFora')"
            @click="baixarFora"
          />
        </div>
      </div>
    </div>

    <div v-if="migracao.estado === 'parada' || migracao.estado === 'concluida'" class="colunas">
      <span class="colunas__icone" aria-hidden="true"><i class="pi pi-table" /></span>
      <p class="colunas__texto">
        <strong>{{ notaDasColunas.inicio }}</strong>
        <template v-if="notaDasColunas.fora">{{ ` ${notaDasColunas.fora}` }}</template>
      </p>
      <Button
        v-if="notaDasColunas.fora"
        class="mg-pilula mg-pilula--pequena"
        icon="pi pi-table"
        :label="t('clinico.migracao.colunas.ver')"
        @click="emit('colunas')"
      />
    </div>

    <p v-if="migracao.estado === 'parada'" class="promessa">
      <i class="pi pi-lock" aria-hidden="true" />
      {{ t('clinico.migracao.resumo.promessa') }}
    </p>

    <!-- -------------------------------------------------------------- rodapé -->
    <footer class="mg-rodape">
      <template v-if="migracao.estado === 'parada'">
        <Button
          v-if="migracao.perguntas.length > 0"
          class="mg-pilula"
          icon="pi pi-arrow-left"
          :label="t('clinico.migracao.resumo.voltar')"
          @click="migracao.irPara('duvidas')"
        />
        <div class="mg-rodape__direita">
          <Button
            class="mg-pilula mg-pilula--cheia mg-pilula--grande"
            icon="pi pi-file-import"
            :label="t('clinico.migracao.resumo.importar', { n: formato.numero(entram, 0) }, entram)"
            @click="migracao.importar()"
          />
        </div>
      </template>

      <template v-else-if="migracao.estado === 'concluida'">
        <Button
          class="mg-pilula"
          icon="pi pi-list"
          :label="t('clinico.migracao.relatorio.verLinhas')"
          @click="verLinhas('todas')"
        />
        <div class="mg-rodape__direita">
          <Button
            class="mg-pilula"
            icon="pi pi-refresh"
            :label="t('clinico.migracao.relatorio.outra')"
            @click="migracao.recomecar()"
          />
          <Button
            class="mg-pilula mg-pilula--cheia mg-pilula--grande"
            icon="pi pi-users"
            :label="t('clinico.migracao.relatorio.verPacientes')"
            @click="router.push('/veterinario/pacientes')"
          />
        </div>
      </template>

      <template v-else>
        <span class="lote">{{
          t('clinico.migracao.importacao.lote', { atual: lote.atual, total: lote.total })
        }}</span>
        <div class="mg-rodape__direita">
          <Button
            v-if="migracao.estado === 'rodando'"
            class="mg-pilula mg-pilula--grande"
            icon="pi pi-pause"
            :label="t('clinico.migracao.importacao.pausar')"
            @click="migracao.pausar()"
          />
          <Button
            v-else
            class="mg-pilula mg-pilula--cheia mg-pilula--grande"
            :icon="migracao.estado === 'falhou' ? 'pi pi-replay' : 'pi pi-play'"
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
.cabeca {
  display: grid;
  justify-items: start;
  gap: 0.5rem;
}

/*
 * Três lado a lado quando o cartão comporta, uma embaixo da outra quando não — nunca duas e uma
 * sobrando, que fazia a caixa vermelha parecer um apêndice. Quem decide é a largura do cartão, não
 * a da janela: com trilho e painel abertos, um tablet deixa ~600 px para ele.
 */
.cartao {
  container-type: inline-size;
}

.caixas {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@container (max-width: 44rem) {
  .caixas {
    grid-template-columns: minmax(0, 1fr);
  }
}

.caixa__unidade {
  margin-top: -0.2rem;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  font-weight: 600;
}

.caixa__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.caixa__ver {
  justify-self: start;
  margin-top: 0.5rem;
}

/* Uma linha, não uma caixa: é informação de conferência, não um quarto resultado. */
.colunas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--hc-linha);
  border-radius: 0.9rem;
  gap: 0.6rem 0.85rem;
}

.colunas__icone {
  display: inline-grid;
  width: 2rem;
  height: 2rem;
  flex: none;
  border-radius: 0.6rem;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
  font-size: 0.85rem;
  place-items: center;
}

.colunas__texto {
  min-width: 14rem;
  flex: 1;
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.colunas__texto strong {
  color: var(--hc-tinta);
  font-weight: 600;
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

.progresso {
  display: grid;
  gap: 0.85rem;
}

.progresso__numero {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 1rem;
  gap: 0.75rem;
}

.progresso__numero strong {
  color: var(--hc-tinta);
  font-size: 1.75rem;
  font-variant-numeric: tabular-nums;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.progresso__barra {
  overflow: hidden;
  height: 0.85rem;
  border-radius: 999px;
  background: var(--hc-linha);
}

.progresso__cheia {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--hc-degrade-botao);
  transition: inline-size 200ms ease-out;
}

.progresso__barra--pausada .progresso__cheia {
  background: var(--hc-tinta-3);
}

.progresso__barra--falhou .progresso__cheia {
  background: var(--hc-coral-tinta);
}

.falha {
  display: flex;
  align-items: flex-start;
  margin: 0;
  font-weight: 600;
  gap: 0.6rem;
}

.lote {
  color: var(--hc-tinta-2);
  font-size: 0.9375rem;
}

@media (prefers-reduced-motion: reduce) {
  .progresso__cheia {
    transition: none;
  }
}
</style>
