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
 * - **Filtros e busca presos no topo**, com o número de cada filtro — o painel rola por baixo.
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
  ok: 'pi pi-check',
  corrigido: 'pi pi-pencil',
  perdido: 'pi pi-eraser',
  fora: 'pi pi-arrow-right',
  aviso: 'pi pi-exclamation-circle',
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
    class="mg-tema hc-tema mg-painel"
    :close-button-props="{ severity: 'secondary', text: false, rounded: true }"
    :pt="{ root: { style: 'width: min(46rem, 100vw)' } }"
  >
    <template #header>
      <div class="cabeca">
        <!-- O foco de abertura vem para o título, não para o fechar: o anel no X, sem ninguém ter
             usado o teclado, fazia do fechar a coisa mais chamativa do painel. -->
        <h2 class="cabeca__titulo" tabindex="-1" autofocus>
          {{ t('clinico.migracao.linhas.titulo') }}
        </h2>
        <p v-if="migracao.planilha" class="cabeca__arquivo">
          <i class="pi pi-file" aria-hidden="true" />
          <bdi>{{ migracao.planilha.arquivo }}</bdi>
          <span>·</span>
          <span>
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
        <div class="filtros" role="group" :aria-label="t('clinico.migracao.linhas.filtroAria')">
          <Button
            v-for="nome in FILTROS"
            :key="nome"
            class="mg-pilula mg-pilula--pequena filtro"
            :class="{ 'mg-pilula--escolhida': filtro === nome }"
            :aria-pressed="filtro === nome"
            @click="filtro = nome"
          >
            <span>{{ t(`clinico.migracao.linhas.filtro.${nome}`) }}</span>
            <span class="filtro__numero">{{ formato.numero(contagem[nome] ?? 0, 0) }}</span>
          </Button>
        </div>

        <IconField class="busca">
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="busca"
            fluid
            :placeholder="t('clinico.migracao.linhas.buscar')"
            :aria-label="t('clinico.migracao.linhas.buscar')"
          />
        </IconField>
      </div>

      <p v-if="filtradas.length === 0" class="vazio">
        <i class="pi pi-search" aria-hidden="true" />
        {{ t('clinico.migracao.linhas.vazio') }}
      </p>

      <ul v-else class="lista">
        <li
          v-for="item in visiveis"
          :key="item.linha"
          class="linha"
          :class="{ 'linha--aberta': aberta === item.linha }"
        >
          <Button
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
                <span v-if="contas(item).correcoes" class="linha__conta linha__conta--azul">
                  {{
                    t(
                      'clinico.migracao.linhas.correcoes',
                      { n: contas(item).correcoes },
                      contas(item).correcoes,
                    )
                  }}
                </span>
                <span v-if="contas(item).emBranco" class="linha__conta linha__conta--pessego">
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

            <span class="linha__numero">
              {{ t('clinico.migracao.comum.linha', { n: item.linha }) }}
            </span>
            <i class="pi pi-chevron-down linha__seta" aria-hidden="true" />
          </Button>

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
                    <span class="frase__marca" aria-hidden="true"><i class="pi pi-check" /></span>
                    <span>{{ t('clinico.migracao.linhas.semNada') }}</span>
                  </p>

                  <div class="detalhe__acoes">
                    <Button
                      class="mg-pilula mg-pilula--pequena"
                      :icon="crusAbertos ? 'pi pi-chevron-up' : 'pi pi-table'"
                      :label="t('clinico.migracao.linhas.naPlanilha')"
                      :aria-expanded="crusAbertos"
                      @click="crusAbertos = !crusAbertos"
                    />
                    <Button
                      v-if="migracao.resultadoPorLinha.get(item.linha)?.petId"
                      class="mg-pilula mg-pilula--pequena mg-pilula--cheia"
                      icon="pi pi-external-link"
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
                              <span class="crus__letra">{{ celula.letra }}</span>
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
        class="mg-pilula mais"
        icon="pi pi-chevron-down"
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
.cabeca {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.cabeca__titulo:focus {
  outline: none;
}

.cabeca__titulo {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.cabeca__arquivo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  gap: 0.4rem;
}

.cabeca__arquivo .pi {
  color: var(--hc-marca);
  font-size: 0.8rem;
}

.corpo {
  display: grid;
  align-content: start;
  gap: 1rem;
}

/* Presos no topo: o painel rola por baixo, e o filtro continua à mão. */
.ferramentas {
  position: sticky;
  z-index: 1;
  top: 0;
  display: grid;
  padding: 0.25rem 0 0.75rem;
  margin-bottom: -0.75rem;
  background: var(--hc-fundo);
  box-shadow: 0 10px 12px -12px rgb(20 32 28 / 18%);
  gap: 0.75rem;
}

.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filtro__numero {
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--hc-linha);
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.mg-pilula--escolhida .filtro__numero {
  background: var(--hc-cartao);
  color: var(--hc-marca-forte);
}

.busca :deep(.p-inputtext) {
  height: 2.6rem;
  border-color: #b7d6cc;
  border-radius: 999px;
  background: var(--hc-cartao);
  color: var(--hc-tinta);
  font-size: 0.9375rem;
}

/* No escuro, a borda clara do claro vira um contorno aceso: a mesma borda escura das pílulas. */
.app-dark .busca :deep(.p-inputtext) {
  border-color: #2f5249;
}

.busca :deep(.p-inputtext:enabled:focus) {
  border-color: var(--hc-marca);
  box-shadow: 0 0 0 3px var(--hc-marca-clara);
}

.busca :deep(.p-inputicon) {
  color: var(--hc-tinta-3);
}

.vazio {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 2rem 1rem;
  border: 1px dashed var(--hc-borda);
  border-radius: 1rem;
  color: var(--hc-tinta-2);
  gap: 0.5rem;
}

/* Um cartão só, com fio entre as linhas. */
.lista {
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: 1px solid var(--hc-borda);
  border-radius: 1rem;
  background: var(--hc-cartao);
  box-shadow: var(--hc-sombra);
  list-style: none;
}

.linha + .linha {
  border-top: 1px solid var(--hc-linha);
}

.linha__cabeca.p-button {
  display: grid;
  align-items: center;
  width: 100%;
  padding: 0.8rem 1rem;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--hc-tinta);
  gap: 0.85rem;
  grid-template-columns: 2rem minmax(0, 1fr) auto auto;
  text-align: start;
  transition: background-color 150ms ease-out;
}

.linha__cabeca.p-button:not(:disabled):hover {
  border: none;
  background: var(--hc-fundo);
  color: var(--hc-tinta);
}

.linha--aberta .linha__cabeca.p-button,
.linha--aberta .linha__cabeca.p-button:not(:disabled):hover {
  background: var(--hc-marca-clara);
}

.linha__cabeca.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: -2px;
}

/* A situação no ícone: formato próprio para cada uma, a cor só confirma. */
.linha__icone {
  display: inline-grid;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  font-size: 0.85rem;
  place-items: center;
}

.linha__icone--entra,
.linha__icone--junta {
  background: var(--hc-verde-fundo);
  color: var(--hc-verde-tinta);
}

.linha__icone--contato {
  background: var(--hc-cinza-fundo);
  color: var(--hc-cinza-tinta);
}

.linha__icone--pendente {
  background: var(--hc-pessego-fundo);
  color: var(--hc-pessego-tinta);
}

.linha__icone--fora {
  background: var(--hc-coral-fundo);
  color: var(--hc-coral-tinta);
}

.linha__texto {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.linha__quem {
  display: flex;
  align-items: baseline;
  min-width: 0;
  gap: 0.5rem;
}

.linha__quem strong {
  overflow: hidden;
  flex-shrink: 0;
  max-width: 55%;
  font-size: 0.9375rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linha__dono {
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linha__resumo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  gap: 0.2rem 0.5rem;
}

.linha__conta {
  padding: 0.05rem 0.45rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.linha__conta--azul {
  background: var(--hc-azul-fundo);
  color: var(--hc-azul-tinta);
}

.linha__conta--pessego {
  background: var(--hc-pessego-fundo);
  color: var(--hc-pessego-tinta);
}

.linha__numero {
  color: var(--hc-tinta-3);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.linha__seta {
  color: var(--hc-tinta-3);
  font-size: 0.8rem;
  transition: transform 200ms ease-out;
}

.linha--aberta .linha__seta {
  color: var(--hc-marca);
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
    grid-template-rows 200ms ease-out,
    opacity 200ms ease-out;
}

.abre-enter-from,
.abre-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

.detalhe {
  display: grid;
  padding: 0.25rem 1rem 1.1rem 3.85rem;
  gap: 0.85rem;
}

.frases {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.55rem;
  list-style: none;
}

.frase {
  display: grid;
  align-items: start;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.9rem;
  gap: 0.6rem;
  grid-template-columns: 1.35rem minmax(0, 1fr);
  line-height: 1.45;
}

.frase__marca {
  display: inline-grid;
  width: 1.35rem;
  height: 1.35rem;
  margin-top: 0.05rem;
  border-radius: 999px;
  font-size: 0.65rem;
  place-items: center;
}

.frase--ok .frase__marca {
  background: var(--hc-verde-fundo);
  color: var(--hc-verde-tinta);
}

.frase--corrigido .frase__marca {
  background: var(--hc-azul-fundo);
  color: var(--hc-azul-tinta);
}

.frase--perdido .frase__marca,
.frase--aviso .frase__marca {
  background: var(--hc-pessego-fundo);
  color: var(--hc-pessego-tinta);
}

.frase--fora .frase__marca {
  background: var(--hc-coral-fundo);
  color: var(--hc-coral-tinta);
}

.detalhe__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.crus {
  display: grid;
  margin: 0;
  padding: 0.85rem 1rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.8rem;
  background: var(--hc-fundo);
  gap: 0.4rem 0.9rem;
  grid-template-columns: minmax(8rem, auto) minmax(0, 1fr);
}

.crus dt {
  display: inline-flex;
  align-items: center;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  gap: 0.4rem;
}

.crus__letra {
  display: inline-grid;
  min-width: 1.4rem;
  height: 1.3rem;
  padding: 0 0.25rem;
  border-radius: 0.35rem;
  background: var(--hc-cartao);
  color: var(--hc-tinta-3);
  font-size: 0.7rem;
  font-weight: 700;
  place-items: center;
}

.crus dd {
  margin: 0;
}

.mais {
  justify-self: center;
}

.sr-only {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .abre-enter-active,
  .abre-leave-active,
  .linha__seta,
  .linha__cabeca.p-button {
    transition: none;
  }
}

@media (max-width: 560px) {
  .linha__cabeca.p-button {
    grid-template-columns: 2rem minmax(0, 1fr) auto;
  }

  .linha__numero {
    display: none;
  }

  .detalhe {
    padding-inline-start: 1rem;
  }
}
</style>
