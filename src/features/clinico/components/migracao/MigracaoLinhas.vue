<script setup lang="ts">
/**
 * Linha por linha — num painel lateral, só quando alguém pede.
 *
 * A página diz o resultado em três caixas; quem quer conferir uma linha abre este painel. Ele
 * segue o acabamento do resto do migrador e foi redesenhado depois de a primeira versão virar uma
 * pilha de cartões iguais, cada um com o mesmo selo "Entra" repetido 2.400 vezes:
 *
 * - **Lista, não cartões.** Um cartão branco só, com fio entre as linhas. Quem rola 2.400 linhas
 *   precisa de ritmo, não de 2.400 molduras.
 * - **A linha fechada já responde.** Ícone da situação (a cor ajuda; o formato decide), o animal e
 *   o responsável, e embaixo a frase do que acontece com ela e quantas correções houve. Abrir é
 *   para o detalhe, não para descobrir o básico.
 * - **Filtros e busca presos no topo**, com o número de cada filtro — o painel rola por baixo. O
 *   filtro é o controle segmentado da casa (`ClinicToggleGroup`): uma escolha por vez, com a
 *   contagem em pílula.
 * - **Abrir desliza.** A altura cresce em 200 ms, a seta gira junto, e se a linha abriu perto do
 *   fim do painel ele acompanha até ela caber. Sem movimento para quem pediu menos movimento.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import {
  ICONE_DA_SITUACAO,
  useRotulosDaMigracao,
  type TomDaFrase,
} from '../../composables/useRotulosDaMigracao'
import { ehDescarte, normalizarRotulo, type ItemDoPlano } from '../../domain/migracao'
import { letraDaColuna } from '../../domain/planilha'
import { useMigracaoStore } from '../../stores/migracao'

export type FiltroDasLinhas = 'todas' | 'entram' | 'corrigidas' | 'fora'

const visivel = defineModel<boolean>('visivel', { required: true })
const filtro = defineModel<FiltroDasLinhas>('filtro', { required: true })

const emit = defineEmits<{ abrir: [petId: string] }>()

const { t } = useI18n()
const migracao = useMigracaoStore()
const rotulos = useRotulosDaMigracao()
const formato = useClinicFormat()

const POR_VEZ = 50

const busca = ref('')
const quantas = ref(POR_VEZ)
const aberta = ref<number | null>(null)
const crusAbertos = ref(false)

const itens = computed(() => migracao.plano?.itens ?? [])
const decisoes = computed(
  () => new Map((migracao.plano?.decisoes ?? []).map((decisao) => [decisao.id, decisao])),
)

const REGRAS: Record<FiltroDasLinhas, (item: ItemDoPlano) => boolean> = {
  todas: () => true,
  entram: (item) => item.situacao !== 'fora' && item.situacao !== 'pendente',
  corrigidas: (item) => item.situacao !== 'fora' && item.ajustes.length > 0,
  fora: (item) => item.situacao === 'fora',
}

const FILTROS: FiltroDasLinhas[] = ['todas', 'entram', 'corrigidas', 'fora']

const contagem = computed(() =>
  Object.fromEntries(FILTROS.map((nome) => [nome, itens.value.filter(REGRAS[nome]).length])),
)

/** "Não vão entrar" acende em risco quando tem alguém: é o filtro que pede atenção. */
const opcoesDoFiltro = computed(() =>
  FILTROS.map((nome) => ({
    valor: nome,
    rotulo: t(`clinico.migracao.linhas.filtro.${nome}`),
    contagem: contagem.value[nome] ?? 0,
    tom:
      nome === 'fora' && (contagem.value[nome] ?? 0) > 0 ? ('risco' as const) : ('neutro' as const),
  })),
)

const filtradas = computed(() => {
  const alvo = normalizarRotulo(busca.value)
  const numero = /^\d+$/.test(busca.value.trim()) ? Number(busca.value.trim()) : null

  return itens.value.filter((item) => {
    if (!REGRAS[filtro.value](item)) {
      return false
    }

    if (!alvo) {
      return true
    }

    if (numero !== null) {
      return item.linha === numero
    }

    return (
      normalizarRotulo(item.animal?.nome ?? '').includes(alvo) ||
      normalizarRotulo(item.responsavel?.nome ?? '').includes(alvo)
    )
  })
})

const visiveis = computed(() => filtradas.value.slice(0, quantas.value))

watch([filtro, busca], () => {
  quantas.value = POR_VEZ
  aberta.value = null
})

const ICONE_DO_TOM: Record<TomDaFrase, string> = {
  ok: 'ph ph-check',
  corrigido: 'ph ph-pencil-simple',
  perdido: 'ph ph-eraser',
  fora: 'ph ph-arrow-right',
  aviso: 'ph ph-warning-circle',
}

function contas(item: ItemDoPlano) {
  const emBranco = item.ajustes.filter((ajuste) => ehDescarte(ajuste.tipo)).length

  return { correcoes: item.ajustes.length - emBranco, emBranco }
}

/** Linha sem animal é de uma pessoa: o nome dela vira o título, e "sem animal" o complemento. */
function quem(item: ItemDoPlano): { titulo: string; complemento: string } {
  if (!item.animal) {
    return {
      titulo: item.responsavel?.nome || t('clinico.migracao.linhas.semResponsavel'),
      complemento: t('clinico.migracao.linhas.soResponsavel'),
    }
  }

  return {
    titulo: item.animal.nome || t('clinico.migracao.comum.semNome'),
    complemento: item.responsavel?.nome ?? '',
  }
}

function celulasDe(item: ItemDoPlano) {
  const planilha = migracao.planilha

  if (!planilha) {
    return []
  }

  return planilha.cabecalhos
    .map((cabecalho, coluna) => ({
      letra: letraDaColuna(coluna),
      rotulo: rotulos.coluna(coluna, cabecalho),
      valor: planilha.linhas[item.indice]?.[coluna] ?? '',
    }))
    .filter((celula) => celula.valor !== '')
}

function alternar(linha: number) {
  crusAbertos.value = false
  aberta.value = aberta.value === linha ? null : linha
}

const reduzMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** A linha abriu perto do fim do painel: acompanha até ela caber, sem pular. */
function acompanhar(elemento: Element) {
  elemento.closest('.linha')?.scrollIntoView({
    block: 'nearest',
    behavior: reduzMovimento() ? 'auto' : 'smooth',
  })
}
</script>

<template>
  <Drawer
    v-model:visible="visivel"
    position="right"
    class="mg-tema mg-painel clinic-scope pj-lugar--clinica"
    :close-button-props="{ severity: 'secondary', text: false, rounded: false }"
    :pt="{ root: { style: 'width: min(46rem, 100vw)' } }"
  >
    <template #header>
      <div class="mg-painel__cabeca">
        <!-- O foco de abertura vem para o título, não para o fechar: o anel no X, sem ninguém ter
             usado o teclado, fazia do fechar a coisa mais chamativa do painel. -->
        <h2 class="mg-painel__titulo" tabindex="-1" autofocus>
          {{ t('clinico.migracao.linhas.titulo') }}
        </h2>
        <p v-if="migracao.planilha" class="mg-painel__arquivo">
          <i class="ph ph-file-text" aria-hidden="true" />
          <bdi>{{ migracao.planilha.arquivo }}</bdi>
          <span aria-hidden="true">·</span>
          <span class="ui-num">
            {{
              t(
                'clinico.migracao.comum.linhasN',
                { n: formato.numero(itens.length, 0) },
                itens.length,
              )
            }}
          </span>
        </p>
      </div>
    </template>

    <div class="corpo">
      <div class="ferramentas">
        <ClinicToggleGroup
          v-model="filtro"
          class="filtros"
          :opcoes="opcoesDoFiltro"
          :rotulo="t('clinico.migracao.linhas.filtroAria')"
        />

        <IconField class="busca">
          <InputIcon class="ph ph-magnifying-glass" />
          <InputText
            v-model="busca"
            type="search"
            fluid
            :placeholder="t('clinico.migracao.linhas.buscar')"
            :aria-label="t('clinico.migracao.linhas.buscar')"
          />
        </IconField>
      </div>

      <p v-if="filtradas.length === 0" class="vazio">
        <i class="ph ph-magnifying-glass" aria-hidden="true" />
        {{ t('clinico.migracao.linhas.vazio') }}
      </p>

      <ul v-else class="lista ui-folha">
        <li
          v-for="item in visiveis"
          :key="item.linha"
          class="linha"
          :class="{ 'linha--aberta': aberta === item.linha }"
        >
          <button
            type="button"
            class="linha__cabeca"
            :aria-expanded="aberta === item.linha"
            @click="alternar(item.linha)"
          >
            <span
              class="linha__icone"
              :class="`linha__icone--${item.situacao}`"
              :title="rotulos.situacao(item.situacao)"
            >
              <i :class="ICONE_DA_SITUACAO[item.situacao]" aria-hidden="true" />
              <span class="sr-only">{{ rotulos.situacao(item.situacao) }}</span>
            </span>

            <span class="linha__texto">
              <span class="linha__quem">
                <strong
                  ><bdi>{{ quem(item).titulo }}</bdi></strong
                >
                <span v-if="quem(item).complemento" class="linha__dono">
                  <bdi>{{ quem(item).complemento }}</bdi>
                </span>
              </span>
              <span class="linha__resumo">
                <span>{{ rotulos.oQueAcontece(item, decisoes) }}</span>
                <span v-if="contas(item).correcoes" class="ui-selo ui-selo--lugar linha__conta">
                  {{
                    t(
                      'clinico.migracao.linhas.correcoes',
                      { n: contas(item).correcoes },
                      contas(item).correcoes,
                    )
                  }}
                </span>
                <span v-if="contas(item).emBranco" class="ui-selo ui-selo--atencao linha__conta">
                  {{
                    t(
                      'clinico.migracao.linhas.emBranco',
                      { n: contas(item).emBranco },
                      contas(item).emBranco,
                    )
                  }}
                </span>
              </span>
            </span>

            <span class="linha__numero ui-num">
              {{ t('clinico.migracao.comum.linha', { n: item.linha }) }}
            </span>
            <i class="ph ph-caret-down linha__seta" aria-hidden="true" />
          </button>

          <Transition name="abre" @after-enter="acompanhar">
            <div v-if="aberta === item.linha" class="envelope">
              <div class="envelope__dentro">
                <div class="detalhe">
                  <ul v-if="rotulos.frasesDaLinha(item).length" class="frases">
                    <li
                      v-for="(frase, indice) in rotulos.frasesDaLinha(item)"
                      :key="indice"
                      class="frase"
                      :class="`frase--${frase.tom}`"
                    >
                      <span class="frase__marca" aria-hidden="true">
                        <i :class="ICONE_DO_TOM[frase.tom]" />
                      </span>
                      <span>{{ frase.texto }}</span>
                    </li>
                  </ul>
                  <p v-else class="frase frase--ok">
                    <span class="frase__marca" aria-hidden="true"><i class="ph ph-check" /></span>
                    <span>{{ t('clinico.migracao.linhas.semNada') }}</span>
                  </p>

                  <div class="detalhe__acoes">
                    <Button
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      :icon="crusAbertos ? 'ph ph-caret-up' : 'ph ph-table'"
                      :label="t('clinico.migracao.linhas.naPlanilha')"
                      :aria-expanded="crusAbertos"
                      @click="crusAbertos = !crusAbertos"
                    />
                    <Button
                      v-if="migracao.resultadoPorLinha.get(item.linha)?.petId"
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      icon="ph ph-arrow-square-out"
                      :label="t('clinico.migracao.linhas.abrirPaciente')"
                      @click="emit('abrir', migracao.resultadoPorLinha.get(item.linha)!.petId!)"
                    />
                  </div>

                  <Transition name="abre">
                    <div v-if="crusAbertos" class="envelope">
                      <div class="envelope__dentro">
                        <dl class="crus">
                          <template v-for="celula in celulasDe(item)" :key="celula.letra">
                            <dt>
                              <span class="mg-letra">{{ celula.letra }}</span>
                              {{ celula.rotulo }}
                            </dt>
                            <dd>
                              <bdi class="mg-celula">{{ celula.valor }}</bdi>
                            </dd>
                          </template>
                        </dl>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>
          </Transition>
        </li>
      </ul>

      <Button
        v-if="filtradas.length > visiveis.length"
        type="button"
        class="mais"
        severity="secondary"
        outlined
        icon="ph ph-caret-down"
        :label="
          t('clinico.migracao.linhas.mais', {
            n: Math.min(POR_VEZ, filtradas.length - visiveis.length),
          })
        "
        @click="quantas += POR_VEZ"
      />
    </div>
  </Drawer>
</template>

<style scoped>
.corpo {
  display: grid;
  align-content: start;
  gap: 14px;
}

/* Presos no topo: o painel rola por baixo, e o filtro continua à mão. */
.ferramentas {
  position: sticky;
  z-index: 1;
  top: 0;
  display: grid;
  gap: 10px;
  margin-bottom: -2px;
  padding: 2px 0 12px;
  background: var(--fundo);
}

.filtros {
  justify-self: start;
  max-width: 100%;
  overflow-x: auto;
}

.busca :deep(.p-inputtext) {
  min-height: 42px;
  padding-inline-start: 40px;
  border-color: var(--linha-forte);
  border-radius: 10px;
  background: var(--superficie);
  color: var(--tinta);
  font-size: 14.5px;
}

.busca :deep(.p-inputtext:enabled:focus) {
  border-color: var(--musgo);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--musgo) 22%, transparent);
}

.busca :deep(.p-inputicon) {
  inset-inline-start: 14px;
  color: var(--tinta-3);
  font-size: 16px;
}

.vazio {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 32px 16px;
  border: 1px dashed var(--linha-forte);
  border-radius: 16px;
  color: var(--tinta-2);
}

.lista {
  overflow: hidden;
  margin: 0;
  padding: 0;
  list-style: none;
}

.linha + .linha {
  border-top: 1px solid var(--linha);
}

.linha__cabeca {
  display: grid;
  width: 100%;
  min-height: 64px;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  border: 0;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  grid-template-columns: 34px minmax(0, 1fr) auto auto;
  text-align: start;
  transition: background-color var(--pj-tempo-curto, 140ms) ease;
}

.linha__cabeca:hover {
  background: var(--superficie-2);
}

.linha--aberta .linha__cabeca,
.linha--aberta .linha__cabeca:hover {
  background: var(--musgo-fundo);
}

.linha__cabeca:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -2px;
}

/* A situação no ícone: formato próprio para cada uma, a cor só confirma. */
.linha__icone {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-size: 16px;
}

.linha__icone--entra,
.linha__icone--junta {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.linha__icone--pendente {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.linha__icone--fora {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.linha__texto {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.linha__quem {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}

.linha__quem strong {
  overflow: hidden;
  max-width: 55%;
  flex-shrink: 0;
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linha__dono {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linha__resumo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  color: var(--tinta-2);
  font-size: 13px;
}

.linha__conta {
  height: 20px;
  padding-inline: 7px;
  font-size: 11.5px;
}

.linha__numero {
  color: var(--tinta-2);
  font-size: 13px;
  white-space: nowrap;
}

.linha__seta {
  color: var(--tinta-3);
  font-size: 15px;
  transition: transform var(--pj-tempo-medio, 200ms) ease-out;
}

.linha--aberta .linha__seta {
  color: var(--musgo);
  transform: rotate(180deg);
}

/*
 * Abrir e fechar deslizando. A grade de uma linha só vai de 0fr a 1fr: é o jeito de animar até a
 * altura do conteúdo sem medir nada em JavaScript.
 */
.envelope {
  display: grid;
  grid-template-rows: 1fr;
}

.envelope__dentro {
  overflow: hidden;
  min-height: 0;
}

.abre-enter-active,
.abre-leave-active {
  transition:
    grid-template-rows var(--pj-tempo-medio, 200ms) ease-out,
    opacity var(--pj-tempo-medio, 200ms) ease-out;
}

.abre-enter-from,
.abre-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

.detalhe {
  display: grid;
  gap: 12px;
  padding: 6px 16px 18px 64px;
}

.frases {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.frase {
  display: grid;
  align-items: start;
  gap: 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  grid-template-columns: 22px minmax(0, 1fr);
  line-height: 1.5;
}

.frase__marca {
  display: grid;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  place-items: center;
  border-radius: 50%;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-size: 12px;
}

.frase--ok .frase__marca {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.frase--corrigido .frase__marca {
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
}

.frase--perdido .frase__marca,
.frase--aviso .frase__marca {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.frase--fora .frase__marca {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.detalhe__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detalhe__acoes :deep(.p-button) {
  min-height: 36px;
}

.crus {
  display: grid;
  gap: 6px 14px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--superficie-2);
  grid-template-columns: minmax(8rem, auto) minmax(0, 1fr);
}

.crus dt {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--tinta-2);
  font-size: 13px;
}

.crus dd {
  min-width: 0;
  margin: 0;
}

.crus .mg-celula {
  background: var(--superficie);
}

.mais.p-button {
  justify-self: center;
}

.sr-only {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .abre-enter-active,
  .abre-leave-active,
  .linha__seta,
  .linha__cabeca {
    transition: none;
  }
}

@media (max-width: 560px) {
  .linha__cabeca {
    grid-template-columns: 34px minmax(0, 1fr) auto;
  }

  .linha__numero {
    display: none;
  }

  .detalhe {
    padding-inline-start: 16px;
  }
}
</style>
