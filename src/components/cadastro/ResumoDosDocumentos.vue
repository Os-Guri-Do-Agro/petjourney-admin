<script setup lang="ts">
/**
 * "Resumo dos documentos (feito por IA)" na ficha (PJ-87WIZU, guia do resumo, parte 2): a versão
 * do veterinário que a IA escreveu a partir dos documentos que o responsável guardou no app. A
 * clínica só lê a última versão; quem gera e atualiza é o responsável, no app.
 *
 * Sem vínculo, ou com a chave `documentos` desligada no consentimento, o cartão não aparece e a
 * rota nem é chamada: o "não liberado" já está no cartão do app. A recusa que chega mesmo assim (a
 * chave desligada entre uma leitura e outra) vira uma linha, sem botão. Nada se guarda: cada
 * abertura da ficha lê de novo.
 *
 * Em destaque, o panorama e os achados; os exames repetidos, os remédios citados e a linha do
 * tempo ficam recolhidos. A `ref` é opaca: só liga o achado ao documento da linha do tempo. O
 * `aviso` do servidor vai sempre no pé.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  lerRecusa,
  lerResumoDosDocumentos,
  type ConteudoDoResumoDosDocumentos,
  type RecusaDaLeitura,
  type ResumoDosDocumentos,
} from '@/service/parceiro/leitura-do-app-service'
import { obterVinculo } from '@/service/parceiro/vinculo-service'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

type ItemDaLinha = ConteudoDoResumoDosDocumentos['linhaDoTempo'][number]

const props = defineProps<{ pacienteId: string }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

const liberado = ref(false)
const resumo = ref<ResumoDosDocumentos | null>(null)
const recusa = ref<RecusaDaLeitura | null>(null)
const carregando = ref(false)
const aberto = ref(false)
const leitura = criarUltimaLeitura()

async function lerResumo() {
  const vez = leitura.nova()
  carregando.value = true
  recusa.value = null

  try {
    const lido = await lerResumoDosDocumentos(props.pacienteId, parceiroQuery())
    if (!leitura.valendo(vez)) return
    resumo.value = lido
  } catch (err) {
    if (!leitura.valendo(vez)) return
    resumo.value = null
    recusa.value = lerRecusa(err, t('leituraApp.erro'))
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

/** O vínculo diz se a chave está ligada; só então a leitura sai. Falhou o vínculo: o cartão do app diz. */
async function carregar() {
  const vez = leitura.nova()
  liberado.value = false
  resumo.value = null
  recusa.value = null
  aberto.value = false

  try {
    const vinculo = await obterVinculo(props.pacienteId, parceiroQuery())
    if (!leitura.valendo(vez)) return
    liberado.value = Boolean(vinculo?.consentimento.documentos)
  } catch {
    if (!leitura.valendo(vez)) return
    liberado.value = false
  }

  if (liberado.value) await lerResumo()
}

/* A ficha troca de paciente sem remontar (o "abrir o que ficou" de um mesclado): lê de novo. */
watch(
  () => props.pacienteId,
  () => void carregar(),
  { immediate: true },
)

/* ------------------------------------------------------------------------------ o conteúdo */

const conteudo = computed(() =>
  resumo.value && resumo.value.estado !== 'SEM_RESUMO' ? resumo.value.conteudo : null,
)

const descricao = computed(() =>
  conteudo.value && resumo.value?.geradoEm
    ? t('leituraApp.resumoDocumentos.feitoEm', { data: rotulos.data(resumo.value.geradoEm) })
    : '',
)

/** "Desatualizado" sem documento novo é só nome, tipo ou data que mudou: a frase geral. */
const desatualizado = computed(() => {
  if (resumo.value?.estado !== 'DESATUALIZADO') return ''
  const novos = resumo.value.mudancas?.novos ?? 0

  return novos > 0
    ? t('leituraApp.resumoDocumentos.desatualizado', { n: novos }, novos)
    : t('leituraApp.resumoDocumentos.mudou')
})

const tipo = (valor: ItemDaLinha['tipo']) => t(`leituraApp.resumoDocumentos.tipo.${valor}`)

/** O título do documento pela `ref` (o da ficha, nunca o nome que o responsável deu). */
const porRef = computed(() => {
  const mapa = new Map<string, string>()
  for (const item of conteudo.value?.linhaDoTempo ?? []) {
    mapa.set(item.ref, item.titulo || tipo(item.tipo))
  }
  return mapa
})

function detalheDoAchado(data: string | null, refs: readonly string[]) {
  const fontes = [...new Set(refs.map((r) => porRef.value.get(r)).filter(Boolean))]
  return [rotulos.dia(data), ...fontes].filter(Boolean).join(' · ')
}

/** Os que chegaram depois do resumo: sem título, só a data. */
const novos = computed(() =>
  conteudo.value ? (resumo.value?.documentos ?? []).filter((doc) => doc.situacao === 'NOVO') : [],
)

const temDetalhes = computed(() => {
  const atual = conteudo.value
  if (!atual) return false
  return Boolean(
    atual.series.length ||
    atual.remediosCitados.length ||
    atual.linhaDoTempo.length ||
    novos.value.length ||
    atual.naoEntraram,
  )
})

const foraDaFaixa = (situacao: string) => situacao === 'ACIMA' || situacao === 'ABAIXO'
</script>

<template>
  <section v-if="liberado" class="ui-folha ui-cartao rd" aria-labelledby="rd-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-files" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="rd-titulo" class="ui-cartao__titulo">
          {{ t('leituraApp.resumoDocumentos.titulo') }}
        </h2>
        <p v-if="descricao" class="ui-cartao__descricao">{{ descricao }}</p>
      </span>
    </header>

    <div v-if="carregando && !resumo" class="rd__esqueleto" aria-busy="true">
      <Skeleton v-for="n in 3" :key="n" height="1.25rem" />
    </div>

    <p v-else-if="recusa?.tipo === 'semConsentimento'" class="rd__linha">
      <i class="ph ph-lock-simple" aria-hidden="true" />
      <span>{{ t('leituraApp.resumoDocumentos.semConsentimento') }}</span>
    </p>
    <p v-else-if="recusa?.tipo === 'semVinculo'" class="rd__linha">
      <i class="ph ph-link-break" aria-hidden="true" />
      <span>{{ t('leituraApp.resumoDocumentos.semVinculo') }}</span>
    </p>
    <p v-else-if="recusa?.tipo === 'taxa'" class="rd__linha" role="alert">
      <i class="ph ph-hourglass" aria-hidden="true" />
      <span>{{ t('leituraApp.taxa', { segundos: recusa.segundos ?? 60 }) }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="lerResumo"
      />
    </p>
    <p v-else-if="recusa" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{
        recusa.tipo === 'outro'
          ? recusa.mensagem
          : recusa.tipo === 'semAcesso'
            ? t('cadastro.ficha.semAcesso')
            : t('leituraApp.erro')
      }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="lerResumo"
      />
    </p>

    <template v-else-if="resumo">
      <p v-if="!conteudo" class="rd__linha">
        <i class="ph ph-file-dashed" aria-hidden="true" />
        <span>{{ t('leituraApp.resumoDocumentos.semResumo') }}</span>
      </p>

      <template v-else>
        <p v-if="desatualizado" class="rd__linha" role="status">
          <i class="ph ph-clock-counter-clockwise" aria-hidden="true" />
          <span>{{ desatualizado }}</span>
        </p>

        <p class="rd__panorama">{{ conteudo.panorama }}</p>

        <!-- Os achados: o que o veterinário procura de relance. -->
        <section class="rd__bloco" aria-labelledby="rd-achados">
          <h3 id="rd-achados" class="rd__subtitulo">
            {{ t('leituraApp.resumoDocumentos.achados') }}
          </h3>
          <ul v-if="conteudo.achados.length" class="rd__lista">
            <li v-for="(achado, indice) in conteudo.achados" :key="indice" class="rd__item">
              <span class="rd__texto">{{ achado.texto }}</span>
              <span class="rd__meta">
                <span
                  class="ui-selo"
                  :class="{ 'ui-selo--atencao': achado.categoria === 'FORA_DA_FAIXA' }"
                >
                  {{ t(`leituraApp.resumoDocumentos.categoria.${achado.categoria}`) }}
                </span>
                <small>{{ detalheDoAchado(achado.data, achado.refs) }}</small>
              </span>
            </li>
          </ul>
          <p v-else class="rd__nada">{{ t('leituraApp.resumoDocumentos.nenhumAchado') }}</p>
        </section>

        <template v-if="temDetalhes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            text
            class="rd__recolher"
            :icon="aberto ? 'ph ph-caret-up' : 'ph ph-caret-down'"
            :label="
              aberto
                ? t('leituraApp.resumoDocumentos.verMenos')
                : t('leituraApp.resumoDocumentos.verMais')
            "
            :aria-expanded="aberto"
            aria-controls="rd-detalhes"
            @click="aberto = !aberto"
          />

          <div v-if="aberto" id="rd-detalhes" class="rd__detalhes">
            <!-- Exames repetidos: o valor como está no papel, contra a faixa impressa nele. -->
            <section v-if="conteudo.series.length" class="rd__bloco" aria-labelledby="rd-series">
              <h3 id="rd-series" class="rd__subtitulo">
                {{ t('leituraApp.resumoDocumentos.series') }}
              </h3>
              <div v-for="serie in conteudo.series" :key="serie.item" class="rd__serie">
                <strong>
                  {{ serie.item }}
                  <small v-if="serie.unidade">{{ serie.unidade }}</small>
                </strong>
                <ul class="rd__lista">
                  <li
                    v-for="(ponto, indice) in serie.pontos"
                    :key="`${ponto.ref}-${indice}`"
                    class="rd__ponto"
                  >
                    <span class="ui-num">{{ rotulos.dia(ponto.data) }}</span>
                    <strong class="ui-num">{{ ponto.valor }}</strong>
                    <span v-if="foraDaFaixa(ponto.situacao)" class="ui-selo ui-selo--atencao">
                      {{ t(`leituraApp.resumoDocumentos.situacao.${ponto.situacao}`) }}
                    </span>
                    <small v-else>
                      {{ t(`leituraApp.resumoDocumentos.situacao.${ponto.situacao}`) }}
                    </small>
                    <small v-if="ponto.referencia">
                      {{ t('leituraApp.resumoDocumentos.faixa', { faixa: ponto.referencia }) }}
                    </small>
                  </li>
                </ul>
              </div>
            </section>

            <!-- Remédios citados: só o nome, a dose está no documento. -->
            <section
              v-if="conteudo.remediosCitados.length"
              class="rd__bloco"
              aria-labelledby="rd-remedios"
            >
              <h3 id="rd-remedios" class="rd__subtitulo">
                {{ t('leituraApp.resumoDocumentos.remedios') }}
              </h3>
              <ul class="rd__lista">
                <li
                  v-for="(remedio, indice) in conteudo.remediosCitados"
                  :key="`${remedio.ref}-${indice}`"
                  class="rd__ponto"
                >
                  <strong>{{ remedio.nome }}</strong>
                  <small v-if="remedio.data">{{ rotulos.dia(remedio.data) }}</small>
                </li>
              </ul>
              <small class="rd__nada">{{ t('leituraApp.resumoDocumentos.remediosDica') }}</small>
            </section>

            <!-- A linha do tempo dos documentos lidos e, por último, os que chegaram depois. -->
            <section
              v-if="conteudo.linhaDoTempo.length || novos.length"
              class="rd__bloco"
              aria-labelledby="rd-linha"
            >
              <h3 id="rd-linha" class="rd__subtitulo">
                {{ t('leituraApp.resumoDocumentos.linhaDoTempo') }}
              </h3>
              <ul class="rd__lista">
                <li
                  v-for="(item, indice) in conteudo.linhaDoTempo"
                  :key="`${item.ref}-${indice}`"
                  class="rd__ponto"
                >
                  <span class="ui-num">{{ rotulos.dia(item.data) }}</span>
                  <strong>{{ item.titulo || tipo(item.tipo) }}</strong>
                  <small v-if="item.titulo && item.titulo !== tipo(item.tipo)">
                    {{ tipo(item.tipo) }}
                  </small>
                </li>
                <li v-for="doc in novos" :key="doc.ref" class="rd__ponto">
                  <span class="ui-num">{{ rotulos.dia(doc.data) }}</span>
                  <strong>{{ t('leituraApp.resumoDocumentos.documentoNovo') }}</strong>
                  <span class="ui-selo">{{ t('leituraApp.resumoDocumentos.foraDoResumo') }}</span>
                </li>
              </ul>
            </section>

            <p v-if="conteudo.naoEntraram" class="rd__nada">
              {{
                t(
                  'leituraApp.resumoDocumentos.naoEntraram',
                  { n: conteudo.naoEntraram },
                  conteudo.naoEntraram,
                )
              }}
            </p>
          </div>
        </template>
      </template>

      <p class="rd__aviso">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ resumo.aviso }}</span>
      </p>
    </template>
  </section>
</template>

<style scoped>
.rd {
  display: grid;
  gap: 14px;
}

.rd__esqueleto {
  display: grid;
  gap: 8px;
}

.rd__linha,
.rd__nada {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.rd__linha > span {
  flex: 1 1 14rem;
}

.rd__linha > i {
  align-self: flex-start;
  margin-top: 3px;
}

.rd__panorama {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
}

.rd__bloco {
  display: grid;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--linha-suave);
}

.rd__subtitulo {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
}

.rd__lista {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rd__item {
  display: grid;
  gap: 3px;
}

.rd__texto {
  color: var(--tinta);
  font-size: 13.5px;
}

.rd__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.rd__meta small,
.rd__ponto small,
.rd__serie strong small {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 400;
}

.rd__recolher {
  justify-self: start;
}

.rd__detalhes {
  display: grid;
  gap: 14px;
}

.rd__serie {
  display: grid;
  gap: 4px;
}

.rd__serie > strong {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.rd__ponto {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.rd__ponto strong {
  color: var(--tinta);
  font-weight: 600;
}

.rd__aviso {
  display: flex;
  gap: 8px;
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid var(--linha-suave);
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.45;
}

.rd__aviso i {
  margin-top: 2px;
}
</style>
