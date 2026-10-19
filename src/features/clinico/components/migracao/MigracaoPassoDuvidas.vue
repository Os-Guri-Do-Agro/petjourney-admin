<script setup lang="ts">
/**
 * Passo 2 — as dúvidas, uma por vez.
 *
 * Cada pergunta ocupa o cartão inteiro: a pergunta em letra grande, uma frase dizendo por que ela
 * existe, os dois lados lado a lado quando é comparação, e as respostas como botões grandes de
 * escolha (a escolhida fica marcada com fundo, borda e visto). Não
 * há "talvez": toda pergunta tem uma resposta segura (pessoas diferentes, deixar de fora), e
 * ninguém fica preso nela.
 *
 * A primeira pergunta pode ser de coluna ("qual coluna tem o nome do animal?"): é o que sobrou da
 * antiga etapa de colunas, e só aparece quando o sistema não achou sozinho um obrigatório. As
 * opções são as colunas como a pessoa as vê — letra, título e o começo do conteúdo —, porque é
 * olhando "Rex, Mel, Thor" que se reconhece a coluna dos animais, não pelo nome dela.
 *
 * Responder leva à próxima **sem resposta**, não à seguinte da lista: uma espécie respondida pode
 * trazer de volta um animal que cria outra pergunta, e a fila se refaz sozinha. "Anterior" volta
 * uma casa, para mudar de ideia.
 */
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useColunasDaPlanilha } from '../../composables/useColunasDaPlanilha'
import { useRotulosDaMigracao } from '../../composables/useRotulosDaMigracao'
import type { PetSpecies } from '../../data/types'
import type {
  CampoDeDestino,
  Decisao,
  EscolhaDeEspecie,
  OpcaoDaDecisao,
} from '../../domain/migracao'
import { useMigracaoStore, type PerguntaDaMigracao } from '../../stores/migracao'

const { t } = useI18n()
const migracao = useMigracaoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDaMigracao()
const { comConteudo } = useColunasDaPlanilha()

/*
 * As candidatas: primeiro as que não vão para lugar nenhum — é quase sempre uma delas —, depois as
 * já usadas, que ficam como opção porque o palpite do sistema também erra. A coluna escolhida
 * como resposta conta como livre: responder não a faz pular de lugar debaixo do clique.
 */
const candidatas = computed(() => {
  const campo = atual.value?.tipo === 'coluna' ? atual.value.campo : null
  const livre = (coluna: (typeof comConteudo.value)[number]) =>
    coluna.destino === null || coluna.destino === campo

  return [
    ...comConteudo.value.filter(livre),
    ...comConteudo.value.filter((coluna) => !livre(coluna)),
  ]
})

const ESPECIES: PetSpecies[] = ['canina', 'felina', 'ave', 'roedor', 'reptil', 'equina']

const perguntas = computed(() => migracao.perguntas)

/* Começa na primeira sem resposta — voltando do resumo, na última. */
const primeiraSemResposta = () => {
  const indice = perguntas.value.findIndex((pergunta) => pergunta.resposta === null)

  return indice >= 0 ? indice : Math.max(0, perguntas.value.length - 1)
}

const indice = ref(primeiraSemResposta())

watch(
  () => perguntas.value.length,
  (tamanho) => {
    if (indice.value >= tamanho) {
      indice.value = Math.max(0, tamanho - 1)
    }
  },
)

const atual = computed<PerguntaDaMigracao | null>(() => perguntas.value[indice.value] ?? null)

const itemPorLinha = computed(
  () => new Map((migracao.plano?.itens ?? []).map((item) => [item.linha, item])),
)

let proxima: ReturnType<typeof setTimeout> | null = null

function avancarDepois() {
  if (proxima) {
    clearTimeout(proxima)
  }

  /* Um instante com a resposta marcada, para a pessoa ver o que escolheu antes de a tela trocar. */
  proxima = setTimeout(() => {
    const seguinte = perguntas.value.findIndex(
      (pergunta, posicao) => posicao > indice.value && pergunta.resposta === null,
    )
    const qualquer = perguntas.value.findIndex((pergunta) => pergunta.resposta === null)

    if (seguinte >= 0) {
      indice.value = seguinte
    } else if (qualquer >= 0) {
      indice.value = qualquer
    }
  }, 380)
}

function responderEspecie(chave: string, escolha: EscolhaDeEspecie) {
  migracao.escolherEspecie(chave, escolha)
  avancarDepois()
}

function responderColuna(campo: CampoDeDestino, coluna: number) {
  migracao.responderColuna(campo, coluna)
  avancarDepois()
}

function responderDecisao(decisao: Decisao, opcao: OpcaoDaDecisao) {
  migracao.escolher(decisao.id, opcao)
  avancarDepois()
}

/** Os outros animais sem responsável que esperam resposta, além deste. */
const outrosOrfaos = computed(
  () =>
    perguntas.value.filter(
      (pergunta) =>
        pergunta.tipo === 'decisao' &&
        pergunta.decisao.tipo === 'orfao' &&
        pergunta.resposta === null &&
        pergunta.id !== atual.value?.id,
    ).length,
)

function ligarTodos() {
  migracao.escolherPendentes('orfao', 'juntar')
  avancarDepois()
}

function animalDaLinha(linha: number | undefined): string {
  const item = linha === undefined ? undefined : itemPorLinha.value.get(linha)

  if (!item?.animal) {
    return t('clinico.migracao.duvidas.semAnimal')
  }

  return `${item.animal.nome || t('clinico.migracao.comum.semNome')} · ${rotulos.especie(item.animal.especie)}`
}

function linhas(numeros: number[]): string {
  return t('clinico.migracao.comum.linhasLista', { lista: numeros.join(', ') }, numeros.length)
}

const respondidas = computed(
  () => perguntas.value.filter((pergunta) => pergunta.resposta !== null).length,
)
</script>

<template>
  <section class="mg-cartao cartao" aria-labelledby="mg-duvidas-titulo" aria-live="polite">
    <!-- ---------------------------------------------------------------- sem perguntas -->
    <template v-if="!atual">
      <header class="cabeca">
        <span class="ui-selo ui-selo--ok">
          <i class="ph ph-check-circle" aria-hidden="true" />
          {{ t('clinico.migracao.duvidas.nenhumaChip') }}
        </span>
        <h2 id="mg-duvidas-titulo" class="mg-titulo">
          {{ t('clinico.migracao.duvidas.nenhumaTitulo') }}
        </h2>
        <p class="mg-texto">{{ t('clinico.migracao.duvidas.nenhumaTexto') }}</p>
      </header>
    </template>

    <template v-else>
      <div class="contador">
        <span class="contador__texto ui-num">
          {{ t('clinico.migracao.duvidas.contador', { n: indice + 1, total: perguntas.length }) }}
        </span>
        <span class="bolinhas" aria-hidden="true">
          <span
            v-for="(pergunta, posicao) in perguntas"
            :key="pergunta.id"
            class="bolinha"
            :class="{
              'bolinha--feita': pergunta.resposta !== null,
              'bolinha--atual': posicao === indice,
            }"
          />
        </span>
      </div>

      <Transition name="troca" mode="out-in">
        <div :key="atual.id" class="pergunta">
          <!-- ------------------------------------------------------------ espécie -->
          <template v-if="atual.tipo === 'especie'">
            <header class="cabeca">
              <h2 id="mg-duvidas-titulo" class="mg-titulo">
                {{
                  atual.chave
                    ? t('clinico.migracao.duvidas.especie.pergunta', { valor: atual.exemplo })
                    : atual.animais.length === 1
                      ? t('clinico.migracao.duvidas.especie.perguntaBrancoUm', {
                          nome: atual.animais[0]!.nome,
                        })
                      : t('clinico.migracao.duvidas.especie.perguntaBranco')
                }}
              </h2>
              <p class="mg-texto">
                {{
                  atual.chave
                    ? t('clinico.migracao.duvidas.especie.texto')
                    : t('clinico.migracao.duvidas.especie.textoBranco')
                }}
              </p>
            </header>

            <div class="lado">
              <span class="lado__rotulo">
                {{ t('clinico.migracao.duvidas.especie.animais', atual.animais.length) }}
              </span>
              <ul class="animais">
                <li v-for="animal in atual.animais" :key="animal.linha">
                  <strong
                    ><bdi>{{ animal.nome }}</bdi></strong
                  >
                  <span class="animais__linha ui-num">{{
                    t('clinico.migracao.comum.linha', { n: animal.linha })
                  }}</span>
                </li>
              </ul>
            </div>

            <div class="respostas respostas--grade">
              <button
                v-for="especie in ESPECIES"
                :key="especie"
                type="button"
                class="mg-resposta"
                :class="{ 'mg-resposta--escolhida': atual.resposta === especie }"
                :aria-pressed="atual.resposta === especie"
                @click="responderEspecie(atual.chave, especie)"
              >
                <i v-if="atual.resposta === especie" class="ph ph-check" aria-hidden="true" />
                {{ formato.especie(especie) }}
              </button>
              <button
                type="button"
                class="mg-resposta respostas__fora"
                :class="{ 'mg-resposta--escolhida': atual.resposta === 'fora' }"
                :aria-pressed="atual.resposta === 'fora'"
                @click="responderEspecie(atual.chave, 'fora')"
              >
                <i
                  :class="atual.resposta === 'fora' ? 'ph ph-check' : 'ph ph-prohibit'"
                  aria-hidden="true"
                />
                {{ t('clinico.migracao.duvidas.especie.deixarDeFora') }}
              </button>
            </div>
          </template>

          <!-- ------------------------------------------------------------ coluna -->
          <template v-else-if="atual.tipo === 'coluna'">
            <header class="cabeca">
              <h2 id="mg-duvidas-titulo" class="mg-titulo">
                {{ t(`clinico.migracao.duvidas.coluna.${atual.campo}`) }}
              </h2>
              <p class="mg-texto">{{ t('clinico.migracao.duvidas.coluna.texto') }}</p>
            </header>

            <div class="opcoes" role="group" aria-labelledby="mg-duvidas-titulo">
              <button
                v-for="coluna in candidatas"
                :key="coluna.coluna"
                type="button"
                class="opcao"
                :class="{ 'opcao--escolhida': atual.resposta === coluna.coluna }"
                :aria-pressed="atual.resposta === coluna.coluna"
                @click="responderColuna(atual.campo, coluna.coluna)"
              >
                <span class="opcao__nome">
                  <span class="mg-letra">{{
                    t('clinico.migracao.colunas.coluna', { letra: coluna.letra })
                  }}</span>
                  <strong
                    ><bdi>{{ coluna.titulo }}</bdi></strong
                  >
                  <i
                    v-if="atual.resposta === coluna.coluna"
                    class="ph ph-check-circle opcao__marca"
                    aria-hidden="true"
                  />
                </span>
                <span class="opcao__exemplos">
                  <bdi v-for="exemplo in coluna.exemplos" :key="exemplo" class="mg-celula">{{
                    exemplo
                  }}</bdi>
                </span>
                <span
                  v-if="coluna.destino !== null && coluna.destino !== atual.campo"
                  class="opcao__hoje"
                >
                  {{
                    t('clinico.migracao.duvidas.coluna.hoje', {
                      campo: rotulos.campo(coluna.destino),
                    })
                  }}
                </span>
              </button>
            </div>

            <div class="sem-ela">
              <p class="sem-ela__texto">
                <i class="ph ph-info" aria-hidden="true" />
                {{ t('clinico.migracao.duvidas.coluna.semEla') }}
              </p>
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-arrow-clockwise"
                :label="t('clinico.migracao.trocar')"
                @click="migracao.recomecar()"
              />
            </div>
          </template>

          <!-- ------------------------------------------------------------ decisão -->
          <template v-else>
            <header class="cabeca">
              <h2 id="mg-duvidas-titulo" class="mg-titulo">
                {{
                  t(`clinico.migracao.duvidas.${atual.decisao.tipo}.pergunta`, {
                    nome: atual.decisao.daPlanilha.nome,
                    outro: atual.decisao.outro.nome,
                  })
                }}
              </h2>
              <p class="mg-texto">
                {{
                  t(`clinico.migracao.duvidas.${atual.decisao.tipo}.texto`, {
                    nome: atual.decisao.daPlanilha.nome,
                    outro: atual.decisao.outro.nome,
                    linha: atual.decisao.linhas[0],
                  })
                }}
              </p>
            </header>

            <!--
              Os dois lados da comparação. Mesmo peso, mesma forma — a pessoa decide olhando os
              dois, e nenhum pode parecer "o certo" antes da resposta.
            -->
            <div class="comparar">
              <div class="lado">
                <span class="lado__rotulo">
                  {{
                    atual.decisao.tipo === 'orfao'
                      ? t('clinico.migracao.duvidas.oAnimal', { n: atual.decisao.linhas[0] })
                      : linhas(atual.decisao.linhas)
                  }}
                </span>
                <strong class="lado__nome"
                  ><bdi>{{ atual.decisao.daPlanilha.nome }}</bdi></strong
                >
                <span
                  v-if="atual.decisao.tipo === 'orfao' || atual.decisao.tipo.startsWith('animal')"
                  class="lado__dado"
                >
                  {{ rotulos.especie(atual.decisao.daPlanilha.especie) }}
                </span>
                <template v-else>
                  <span class="lado__dado">
                    <i class="ph ph-phone" aria-hidden="true" />
                    <bdi dir="ltr" class="ui-num">{{
                      atual.decisao.daPlanilha.telefone || t('clinico.migracao.comum.semTelefone')
                    }}</bdi>
                  </span>
                  <span v-if="atual.decisao.daPlanilha.documento" class="lado__dado">
                    <i class="ph ph-identification-card" aria-hidden="true" />
                    CPF <bdi dir="ltr" class="ui-num">{{ atual.decisao.daPlanilha.documento }}</bdi>
                  </span>
                  <span v-if="atual.decisao.tipo === 'mesma-pessoa'" class="lado__dado">
                    <i class="ph ph-paw-print" aria-hidden="true" />
                    {{ animalDaLinha(atual.decisao.linhas[0]) }}
                  </span>
                </template>
              </div>

              <span class="comparar__meio" aria-hidden="true">
                <i
                  :class="
                    atual.decisao.tipo === 'orfao' ? 'ph ph-arrow-up' : 'ph ph-arrows-left-right'
                  "
                />
              </span>

              <div class="lado">
                <span class="lado__rotulo">
                  {{
                    atual.decisao.outro.existente
                      ? t('clinico.migracao.duvidas.jaCadastrado')
                      : atual.decisao.tipo === 'orfao'
                        ? t('clinico.migracao.duvidas.linhaDeCima', {
                            n: atual.decisao.outro.linhas[0],
                          })
                        : linhas(atual.decisao.outro.linhas)
                  }}
                </span>
                <strong class="lado__nome"
                  ><bdi>{{ atual.decisao.outro.nome }}</bdi></strong
                >
                <span v-if="atual.decisao.tipo.startsWith('animal')" class="lado__dado">
                  {{ rotulos.especie(atual.decisao.outro.especie) }}
                </span>
                <template v-else>
                  <span class="lado__dado">
                    <i class="ph ph-phone" aria-hidden="true" />
                    <bdi dir="ltr" class="ui-num">{{
                      atual.decisao.outro.telefone || t('clinico.migracao.comum.semTelefone')
                    }}</bdi>
                  </span>
                  <span v-if="atual.decisao.outro.documento" class="lado__dado">
                    <i class="ph ph-identification-card" aria-hidden="true" />
                    CPF <bdi dir="ltr" class="ui-num">{{ atual.decisao.outro.documento }}</bdi>
                  </span>
                  <span v-if="atual.decisao.tipo === 'mesma-pessoa'" class="lado__dado">
                    <i class="ph ph-paw-print" aria-hidden="true" />
                    {{ animalDaLinha(atual.decisao.outro.linhas[0]) }}
                  </span>
                </template>
              </div>
            </div>

            <div class="respostas respostas--duas">
              <button
                type="button"
                class="mg-resposta"
                :class="{ 'mg-resposta--escolhida': atual.resposta === 'juntar' }"
                :aria-pressed="atual.resposta === 'juntar'"
                @click="responderDecisao(atual.decisao, 'juntar')"
              >
                <i
                  :class="atual.resposta === 'juntar' ? 'ph ph-check' : 'ph ph-link'"
                  aria-hidden="true"
                />
                {{
                  t(`clinico.migracao.duvidas.${atual.decisao.tipo}.sim`, {
                    outro: atual.decisao.outro.nome,
                  })
                }}
              </button>
              <button
                type="button"
                class="mg-resposta"
                :class="{ 'mg-resposta--escolhida': atual.resposta === 'manter' }"
                :aria-pressed="atual.resposta === 'manter'"
                @click="responderDecisao(atual.decisao, 'manter')"
              >
                <i
                  :class="
                    atual.resposta === 'manter'
                      ? 'ph ph-check'
                      : atual.decisao.tipo === 'orfao'
                        ? 'ph ph-prohibit'
                        : 'ph ph-copy-simple'
                  "
                  aria-hidden="true"
                />
                {{ t(`clinico.migracao.duvidas.${atual.decisao.tipo}.nao`) }}
              </button>
            </div>

            <Button
              v-if="atual.decisao.tipo === 'orfao' && atual.resposta === null && outrosOrfaos > 0"
              type="button"
              class="todos"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-check-square"
              :label="
                t('clinico.migracao.duvidas.orfao.todos', { n: outrosOrfaos + 1 }, outrosOrfaos + 1)
              "
              @click="ligarTodos"
            />
          </template>
        </div>
      </Transition>
    </template>

    <footer class="mg-rodape">
      <Button
        v-if="atual && indice > 0"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        :label="t('clinico.migracao.duvidas.anterior')"
        @click="indice -= 1"
      />

      <div class="mg-rodape__direita">
        <span v-if="migracao.semResposta > 0" class="faltam">
          {{
            t('clinico.migracao.duvidas.faltam', { n: migracao.semResposta }, migracao.semResposta)
          }}
        </span>
        <Button
          v-if="
            atual &&
            migracao.semResposta > 0 &&
            indice < perguntas.length - 1 &&
            atual.resposta !== null
          "
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-arrow-right"
          icon-pos="right"
          :label="t('clinico.migracao.duvidas.proxima')"
          @click="indice += 1"
        />
        <Button
          v-if="migracao.semResposta === 0"
          type="button"
          class="mg-adiante"
          icon="ph ph-arrow-right"
          icon-pos="right"
          :label="t('clinico.migracao.duvidas.verResumo', { n: respondidas }, respondidas)"
          @click="migracao.abrirResumo()"
        />
      </div>
    </footer>
  </section>
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

.contador {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
}

.contador__texto {
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 550;
}

.bolinhas {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 5px;
}

.bolinha {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--linha-forte);
}

.bolinha--feita {
  background: var(--musgo);
}

.bolinha--atual {
  box-shadow:
    0 0 0 2px var(--superficie),
    0 0 0 3.5px var(--musgo);
}

.pergunta {
  display: grid;
  gap: 20px;
}

.comparar {
  display: grid;
  align-items: stretch;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

.comparar__meio {
  display: grid;
  place-items: center;
  color: var(--tinta-3);
  font-size: 20px;
}

.lado {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 16px 18px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--superficie-2);
}

.lado__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.lado__nome {
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.lado__dado {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--tinta-2);
  font-size: 14px;
}

.lado__dado .ph {
  color: var(--tinta-3);
  font-size: 15px;
}

.animais {
  display: grid;
  gap: 4px;
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.animais li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 14.5px;
}

.animais li strong {
  font-weight: 600;
}

.animais__linha {
  color: var(--tinta-2);
  font-size: 13px;
}

.respostas {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.respostas--duas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/*
 * As seis espécies: numa fileira só quando o cartão é largo, três e três no médio, duas e duas no
 * estreito. Nunca uma sozinha na última linha. Quem decide é a largura do cartão.
 */
.respostas--grade {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@container (min-width: 62rem) {
  .respostas--grade {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@container (max-width: 34rem) {
  .respostas--grade,
  .respostas--duas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.respostas__fora {
  grid-column: 1 / -1;
  justify-self: start;
}

.todos.p-button {
  justify-self: start;
}

/*
 * As colunas como opção de resposta: lado a lado, com o começo do conteúdo — é olhando "Rex, Mel,
 * Thor" que se reconhece a coluna dos animais, não pelo nome dela. Borda visível desde o início:
 * é um botão, e precisa parecer um antes do hover.
 */
.opcoes {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
}

.opcao {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--linha-forte);
  border-radius: 12px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition:
    background-color var(--pj-tempo-curto, 140ms) ease,
    border-color var(--pj-tempo-curto, 140ms) ease;
}

.opcao:hover {
  border-color: var(--tinta-3);
  background: var(--superficie-2);
}

.opcao:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.opcao--escolhida,
.opcao--escolhida:hover {
  border-color: var(--musgo);
  background: var(--musgo-fundo);
  box-shadow: inset 0 0 0 1px var(--musgo);
}

.opcao__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 15px;
}

.opcao__nome strong {
  font-weight: 600;
}

.opcao__marca {
  color: var(--musgo);
  font-size: 18px;
}

.opcao__exemplos {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
  gap: 5px;
}

.opcao__hoje {
  color: var(--tinta-2);
  font-size: 13px;
}

.sem-ela {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}

.sem-ela__texto {
  display: flex;
  flex: 1 1 20rem;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.sem-ela__texto .ph {
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 16px;
}

.faltam {
  color: var(--atencao-tinta);
  font-size: 14px;
  font-weight: 550;
}

.troca-enter-active,
.troca-leave-active {
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out;
}

.troca-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.troca-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

@media (prefers-reduced-motion: reduce) {
  .troca-enter-active,
  .troca-leave-active,
  .opcao {
    transition: none;
  }
}

@media (max-width: 720px) {
  .comparar {
    grid-template-columns: minmax(0, 1fr);
  }

  .comparar__meio {
    display: none;
  }
}
</style>
