<script setup lang="ts">
/**
 * Depois da gravação: concluída, desfeita ou cancelada (guia e2, 4.4 a 4.8).
 *
 * - **Concluída:** o que entrou, as linhas que não entraram para baixar e corrigir, propor vínculo
 *   com o app a quem a importação criou (com o teto de 50 por dia) e desfazer.
 * - **Desfeita:** o que saiu e o que ficou, com o porquê no relatório.
 * - **Cancelada:** ficou pausada 30 dias; o que foi gravado ficou, e o desfazer continua valendo.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import ImportacaoRelatorio from '@/components/importacao/ImportacaoRelatorio.vue'
import { CODIGOS_DE_FORA, tituloDoCodigo } from '@/components/importacao/leitura-da-importacao'
import { csvDasLinhas } from '@/components/importacao/planilha-para-a-api'
import { escreverCsv } from '@/features/clinico/domain/planilha'
import {
  listarLinhas,
  type LinhaDoRelatorio,
  type PropostasEmLote,
} from '@/service/parceiro/importacao-service'
import { useImportacaoStore } from '@/stores/importacao-da-base'
import { useParceiroStore } from '@/stores/parceiro'

const { t } = useI18n()
const toast = useToast()
const store = useImportacaoStore()
const rotulos = useRotulosDoCadastro()
const parceiro = useParceiroStore()
const router = useRouter()

const importacao = computed(() => store.importacao)
const status = computed(() => importacao.value?.status)

function query() {
  return parceiro.parceiroId ? { parceiroId: parceiro.parceiroId } : undefined
}

const entraram = computed(
  () => (importacao.value?.criados ?? 0) + (importacao.value?.juntados ?? 0),
)

/* --------------------------------------------------------------------------- desfazer */

const perguntandoDesfazer = ref(false)
const desfazendo = ref(false)

async function desfazer() {
  desfazendo.value = true

  try {
    await store.desfazer()
    perguntandoDesfazer.value = false
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    desfazendo.value = false
  }
}

/* --------------------------------------------------------------------------- propor */

const propondo = ref(false)
const propostas = ref<PropostasEmLote | null>(null)
const pelaFicha = ref<
  Array<{ clienteId: string; nome: string; pacienteId: string | null; motivo: string }>
>([])

/**
 * Quem ficou para conferir na ficha vem pelo cliente; a ficha do portal é a do paciente. O relatório
 * diz qual paciente cada cliente ganhou (até 20 páginas de 100 linhas).
 */
async function acharFichas(lote: PropostasEmLote) {
  const id = importacao.value?.id
  if (!id || !lote.clientesPelaFicha.length) {
    pelaFicha.value = []
    return
  }

  const faltam = new Map(lote.clientesPelaFicha.map((item) => [item.clienteId, item.motivo]))
  const achados = new Map<string, { nome: string; pacienteId: string | null }>()
  let cursor: number | null = null

  for (let pagina = 0; pagina < 20 && faltam.size > achados.size; pagina += 1) {
    const resposta = await listarLinhas(id, { cursor, limite: 100 }, query())
    for (const linha of resposta.itens) {
      if (!linha.clienteId || !faltam.has(linha.clienteId)) continue
      const atual = achados.get(linha.clienteId)
      if (!atual || (!atual.pacienteId && linha.pacienteId)) {
        achados.set(linha.clienteId, {
          nome: linha.responsavel ?? atual?.nome ?? '',
          pacienteId: linha.pacienteId ?? atual?.pacienteId ?? null,
        })
      }
    }
    cursor = resposta.proximoCursor ?? null
    if (cursor === null) break
  }

  pelaFicha.value = lote.clientesPelaFicha.map((item) => ({
    clienteId: item.clienteId,
    nome: achados.get(item.clienteId)?.nome || t('importacao.propostas.semNome'),
    pacienteId: achados.get(item.clienteId)?.pacienteId ?? null,
    motivo: t(`importacao.propostas.motivo.${item.motivo}`),
  }))
}

async function propor() {
  propondo.value = true

  try {
    const lote = await store.propor()
    if (!lote) return
    propostas.value = lote
    await acharFichas(lote).catch(() => undefined)
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    propondo.value = false
  }
}

/* ------------------------------------------------------------------- baixar as de fora */

const baixando = ref(false)

function motivoDa(linha: LinhaDoRelatorio) {
  const codigos = linha.motivos.filter((codigo) => CODIGOS_DE_FORA.includes(codigo))
  return codigos.map((codigo) => t(tituloDoCodigo(codigo))).join('; ')
}

/**
 * Com o arquivo na memória, as células como vieram; recarregada a página, só a linha e o motivo.
 * Toda célula passa pela neutralização de fórmula.
 */
async function baixarFora() {
  const atual = importacao.value
  if (!atual) return
  baixando.value = true

  try {
    const fora: LinhaDoRelatorio[] = []
    let cursor: number | null = null
    do {
      const pagina = await listarLinhas(atual.id, { destino: 'FORA', cursor, limite: 100 }, query())
      fora.push(...pagina.itens)
      cursor = pagina.proximoCursor ?? null
    } while (cursor !== null)

    const itens = fora
      .filter((linha) => !linha.motivos.includes('LINHA_EM_BRANCO'))
      .map((linha) => ({ numeroLinha: linha.numeroLinha, motivo: motivoDa(linha) }))
    const rotulos = {
      linha: t('clinico.migracao.relatorio.colunaLinha'),
      motivo: t('clinico.migracao.relatorio.colunaOQueHouve'),
    }

    const conteudo = store.planilha
      ? csvDasLinhas(store.planilha, itens, rotulos)
      : `﻿${escreverCsv([
          [rotulos.linha, rotulos.motivo],
          ...itens.map((item) => [String(item.numeroLinha), item.motivo]),
        ])}`

    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${atual.arquivoNome.replace(/\.[^.]+$/, '')}-${t('clinico.migracao.relatorio.sufixoFora')}.csv`
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('importacao.erroAoCarregar')).mensagem,
      life: 6000,
    })
  } finally {
    baixando.value = false
  }
}
</script>

<template>
  <div v-if="importacao" class="fim">
    <section class="ui-folha ui-cartao" aria-labelledby="fim-titulo">
      <header class="ui-cartao__cabeca">
        <span
          class="ui-ladrilho"
          :class="status === 'CONCLUIDA' ? 'ui-ladrilho--ok' : 'ui-ladrilho--neutro'"
          aria-hidden="true"
        >
          <i
            :class="
              status === 'CONCLUIDA'
                ? 'ph ph-check-circle'
                : status === 'DESFEITA'
                  ? 'ph ph-arrow-counter-clockwise'
                  : 'ph ph-prohibit'
            "
          />
        </span>
        <span class="ui-cartao__titulos">
          <h2 id="fim-titulo" class="ui-cartao__titulo">
            {{ t(`importacao.fim.titulo.${status}`) }}
          </h2>
          <p class="ui-cartao__descricao">
            <template v-if="status === 'CONCLUIDA'">
              {{
                t('clinico.migracao.conclusao.frase', {
                  entraram: rotulos.numero(entraram),
                  total: rotulos.numero(entraram + importacao.foraCount),
                })
              }}
            </template>
            <template v-else-if="status === 'DESFEITA'">{{
              t('importacao.fim.desfeitaTexto')
            }}</template>
            <template v-else>{{ t('importacao.fim.canceladaTexto') }}</template>
          </p>
        </span>
      </header>

      <ul v-if="status === 'CONCLUIDA'" class="fim__numeros">
        <li>
          <strong class="ui-num">{{ rotulos.numero(importacao.criados) }}</strong>
          {{ t('importacao.fim.criados', importacao.criados) }}
        </li>
        <li>
          <strong class="ui-num">{{ rotulos.numero(importacao.juntados) }}</strong>
          {{ t('importacao.fim.juntados', importacao.juntados) }}
        </li>
        <li>
          <strong class="ui-num">{{ rotulos.numero(importacao.foraCount) }}</strong>
          {{ t('importacao.fim.fora', importacao.foraCount) }}
        </li>
      </ul>

      <ul v-else-if="importacao.desfazer" class="fim__numeros">
        <li>
          <strong class="ui-num">{{
            rotulos.numero(importacao.desfazer.pacientesRemovidos)
          }}</strong>
          {{ t('importacao.fim.pacientesRemovidos', importacao.desfazer.pacientesRemovidos) }}
        </li>
        <li>
          <strong class="ui-num">{{
            rotulos.numero(importacao.desfazer.clientesRemovidos)
          }}</strong>
          {{ t('importacao.fim.clientesRemovidos', importacao.desfazer.clientesRemovidos) }}
        </li>
        <li>
          <strong class="ui-num">{{
            rotulos.numero(importacao.desfazer.preenchimentosDesfeitos)
          }}</strong>
          {{ t('importacao.fim.preenchimentos', importacao.desfazer.preenchimentosDesfeitos) }}
        </li>
        <li>
          <strong class="ui-num">{{ rotulos.numero(importacao.desfazer.ficaram) }}</strong>
          {{ t('importacao.fim.ficaram', importacao.desfazer.ficaram) }}
        </li>
      </ul>
      <p v-if="importacao.desfazer?.propostasCanceladas" class="eg__dica">
        {{
          t(
            'importacao.fim.propostasCanceladas',
            { n: rotulos.numero(importacao.desfazer.propostasCanceladas) },
            importacao.desfazer.propostasCanceladas,
          )
        }}
      </p>

      <!-- O resultado das propostas -->
      <div v-if="propostas" class="fim__propostas" role="status">
        <strong>{{
          t(
            'importacao.propostas.enviadas',
            { n: rotulos.numero(propostas.propostas) },
            propostas.propostas,
          )
        }}</strong>
        <ul>
          <li v-if="propostas.jaPropostos">
            {{
              t(
                'importacao.propostas.jaPropostos',
                { n: rotulos.numero(propostas.jaPropostos) },
                propostas.jaPropostos,
              )
            }}
          </li>
          <li v-if="propostas.semEmail">
            {{
              t(
                'importacao.propostas.semEmail',
                { n: rotulos.numero(propostas.semEmail) },
                propostas.semEmail,
              )
            }}
          </li>
          <li v-if="propostas.emailRepetido">
            {{
              t(
                'importacao.propostas.emailRepetido',
                { n: rotulos.numero(propostas.emailRepetido) },
                propostas.emailRepetido,
              )
            }}
          </li>
          <li v-if="propostas.semPaciente">
            {{
              t(
                'importacao.propostas.semPaciente',
                { n: rotulos.numero(propostas.semPaciente) },
                propostas.semPaciente,
              )
            }}
          </li>
          <li v-if="propostas.paraDepois" class="fim__atencao">
            {{
              t(
                'importacao.propostas.paraDepois',
                { n: rotulos.numero(propostas.paraDepois) },
                propostas.paraDepois,
              )
            }}
          </li>
        </ul>
        <template v-if="propostas.pelaFicha">
          <p class="fim__atencao">
            {{
              t(
                'importacao.propostas.pelaFicha',
                { n: rotulos.numero(propostas.pelaFicha) },
                propostas.pelaFicha,
              )
            }}
          </p>
          <ul class="fim__fichas">
            <li v-for="item in pelaFicha" :key="item.clienteId">
              <RouterLink v-if="item.pacienteId" :to="`/clinica/ficha/${item.pacienteId}`">
                <bdi>{{ item.nome }}</bdi>
              </RouterLink>
              <bdi v-else>{{ item.nome }}</bdi>
              <span class="eg__dica"> · {{ item.motivo }}</span>
            </li>
          </ul>
        </template>
      </div>

      <footer class="ui-cartao__pe fim__pe">
        <Button
          v-if="status === 'CONCLUIDA'"
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-paw-print"
          :label="t('clinico.migracao.relatorio.verPacientes')"
          @click="router.push('/clinica/pacientes')"
        />
        <Button
          v-if="store.podeTrocarArquivo"
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-file-plus"
          :label="t('clinico.migracao.relatorio.outra')"
          @click="store.recomecar()"
        />
        <span class="fim__espaco" />
        <Button
          v-if="status === 'CONCLUIDA' && importacao.foraCount > 0"
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-download-simple"
          :label="t('clinico.migracao.relatorio.baixarFora')"
          :loading="baixando"
          @click="baixarFora"
        />
        <Button
          v-if="
            status === 'CONCLUIDA' ||
            status === 'CANCELADA' ||
            (status === 'DESFEITA' && importacao.desfazer?.ficaram)
          "
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-arrow-counter-clockwise"
          :label="
            status === 'DESFEITA'
              ? t('importacao.fim.desfazerDeNovo')
              : t('importacao.fim.desfazer')
          "
          @click="perguntandoDesfazer = true"
        />
        <Button
          v-if="status === 'CONCLUIDA' && !propostas"
          type="button"
          icon="ph ph-device-mobile"
          :label="t('importacao.propostas.botao')"
          :loading="propondo"
          @click="propor"
        />
      </footer>
    </section>

    <ImportacaoRelatorio />

    <Dialog
      :visible="perguntandoDesfazer"
      modal
      :closable="!desfazendo"
      :header="t('importacao.fim.desfazerTitulo')"
      class="fim__dialogo"
      @update:visible="(aberto: boolean) => !aberto && (perguntandoDesfazer = false)"
    >
      <p class="fim__dialogo-texto">{{ t('importacao.fim.desfazerTexto') }}</p>
      <p class="fim__dialogo-texto">{{ t('importacao.fim.desfazerPropostas') }}</p>
      <template #footer>
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.voltar')"
          :disabled="desfazendo"
          @click="perguntandoDesfazer = false"
        />
        <Button
          type="button"
          severity="danger"
          :label="t('importacao.fim.desfazer')"
          :loading="desfazendo"
          @click="desfazer"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.fim {
  display: grid;
  gap: 20px;
}

.fim__numeros {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 28px;
  margin: 0;
  padding: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  list-style: none;
}

.fim__numeros strong {
  margin-inline-end: 4px;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 650;
}

.fim__propostas {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--app-cartao, var(--superficie));
  color: var(--tinta);
  font-size: 13.5px;
}

.fim__propostas ul {
  display: grid;
  gap: 3px;
  margin: 0;
  padding: 0;
  color: var(--tinta-2);
  list-style: none;
}

.fim__propostas p {
  margin: 4px 0 0;
}

.fim__atencao {
  color: var(--atencao-tinta);
}

.fim__fichas a {
  color: var(--tinta);
  font-weight: 600;
}

.fim__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.fim__espaco {
  flex: 1;
}

.fim__dialogo-texto {
  margin: 0 0 8px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}
</style>
