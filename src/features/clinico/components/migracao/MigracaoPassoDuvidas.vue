<script setup lang="ts">
/**
 * Passo 2 — as dúvidas, uma por vez.
 *
 * Cada pergunta ocupa o cartão inteiro: a pergunta em letra grande, uma frase dizendo por que ela
 * existe, os dois lados lado a lado quando é comparação, e as respostas como pílulas grandes. Não
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
        <span class="mg-chip hc--verde"
          ><i class="pi pi-check" aria-hidden="true" />{{
            t('clinico.migracao.duvidas.nenhumaChip')
          }}</span
        >
        <h2 id="mg-duvidas-titulo" class="mg-titulo">
          {{ t('clinico.migracao.duvidas.nenhumaTitulo') }}
        </h2>
        <p class="mg-texto">{{ t('clinico.migracao.duvidas.nenhumaTexto') }}</p>
      </header>
    </template>

    <template v-else>
      <div class="contador">
        <span class="mg-chip hc--lilas">
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

            <div class="lado">
              <span class="lado__rotulo">
                {{ t('clinico.migracao.duvidas.especie.animais', atual.animais.length) }}
              </span>
              <ul class="animais">
                <li v-for="animal in atual.animais" :key="animal.linha">
                  <strong
                    ><bdi>{{ animal.nome }}</bdi></strong
                  >
                  <span class="animais__linha">{{
                    t('clinico.migracao.comum.linha', { n: animal.linha })
                  }}</span>
                </li>
              </ul>
            </div>

            <div class="respostas respostas--grade">
              <Button
                v-for="especie in ESPECIES"
                :key="especie"
                class="mg-pilula mg-pilula--grande"
                :class="{ 'mg-pilula--escolhida': atual.resposta === especie }"
                :icon="atual.resposta === especie ? 'pi pi-check' : undefined"
                :label="formato.especie(especie)"
                @click="responderEspecie(atual.chave, especie)"
              />
              <Button
                class="mg-pilula mg-pilula--grande respostas__fora"
                :class="{ 'mg-pilula--escolhida': atual.resposta === 'fora' }"
                :icon="atual.resposta === 'fora' ? 'pi pi-check' : 'pi pi-times'"
                :label="t('clinico.migracao.duvidas.especie.deixarDeFora')"
                @click="responderEspecie(atual.chave, 'fora')"
              />
            </div>
          </template>

          <!-- ------------------------------------------------------------ coluna -->
          <template v-else-if="atual.tipo === 'coluna'">
            <h2 id="mg-duvidas-titulo" class="mg-titulo">
              {{ t(`clinico.migracao.duvidas.coluna.${atual.campo}`) }}
            </h2>
            <p class="mg-texto">{{ t('clinico.migracao.duvidas.coluna.texto') }}</p>

            <div class="opcoes" role="group" :aria-labelledby="'mg-duvidas-titulo'">
              <Button
                v-for="coluna in candidatas"
                :key="coluna.coluna"
                class="opcao"
                :class="{ 'opcao--escolhida': atual.resposta === coluna.coluna }"
                :aria-pressed="atual.resposta === coluna.coluna"
                @click="responderColuna(atual.campo, coluna.coluna)"
              >
                <span class="opcao__nome">
                  <span class="mg-chip hc--cinza">{{
                    t('clinico.migracao.colunas.coluna', { letra: coluna.letra })
                  }}</span>
                  <strong
                    ><bdi>{{ coluna.titulo }}</bdi></strong
                  >
                  <i
                    v-if="atual.resposta === coluna.coluna"
                    class="pi pi-check-circle opcao__marca"
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
              </Button>
            </div>

            <div class="sem-ela">
              <p class="sem-ela__texto">
                <i class="pi pi-info-circle" aria-hidden="true" />
                {{ t('clinico.migracao.duvidas.coluna.semEla') }}
              </p>
              <Button
                class="mg-pilula mg-pilula--pequena"
                icon="pi pi-refresh"
                :label="t('clinico.migracao.trocar')"
                @click="migracao.recomecar()"
              />
            </div>
          </template>

          <!-- ------------------------------------------------------------ decisão -->
          <template v-else>
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
                    <i class="pi pi-phone" aria-hidden="true" />
                    <bdi dir="ltr">{{
                      atual.decisao.daPlanilha.telefone || t('clinico.migracao.comum.semTelefone')
                    }}</bdi>
                  </span>
                  <span v-if="atual.decisao.daPlanilha.documento" class="lado__dado">
                    CPF <bdi dir="ltr">{{ atual.decisao.daPlanilha.documento }}</bdi>
                  </span>
                  <span v-if="atual.decisao.tipo === 'mesma-pessoa'" class="lado__dado">
                    <i class="pi pi-heart" aria-hidden="true" />
                    {{ animalDaLinha(atual.decisao.linhas[0]) }}
                  </span>
                </template>
              </div>

              <span class="comparar__meio" aria-hidden="true">
                <i :class="atual.decisao.tipo === 'orfao' ? 'pi pi-arrow-up' : 'pi pi-arrows-h'" />
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
                    <i class="pi pi-phone" aria-hidden="true" />
                    <bdi dir="ltr">{{
                      atual.decisao.outro.telefone || t('clinico.migracao.comum.semTelefone')
                    }}</bdi>
                  </span>
                  <span v-if="atual.decisao.outro.documento" class="lado__dado">
                    CPF <bdi dir="ltr">{{ atual.decisao.outro.documento }}</bdi>
                  </span>
                  <span v-if="atual.decisao.tipo === 'mesma-pessoa'" class="lado__dado">
                    <i class="pi pi-heart" aria-hidden="true" />
                    {{ animalDaLinha(atual.decisao.outro.linhas[0]) }}
                  </span>
                </template>
              </div>
            </div>

            <div class="respostas">
              <Button
                class="mg-pilula mg-pilula--grande"
                :class="{ 'mg-pilula--escolhida': atual.resposta === 'juntar' }"
                :icon="atual.resposta === 'juntar' ? 'pi pi-check' : 'pi pi-link'"
                :label="
                  t(`clinico.migracao.duvidas.${atual.decisao.tipo}.sim`, {
                    outro: atual.decisao.outro.nome,
                  })
                "
                @click="responderDecisao(atual.decisao, 'juntar')"
              />
              <Button
                class="mg-pilula mg-pilula--grande"
                :class="{ 'mg-pilula--escolhida': atual.resposta === 'manter' }"
                :icon="
                  atual.resposta === 'manter'
                    ? 'pi pi-check'
                    : atual.decisao.tipo === 'orfao'
                      ? 'pi pi-times'
                      : 'pi pi-clone'
                "
                :label="t(`clinico.migracao.duvidas.${atual.decisao.tipo}.nao`)"
                @click="responderDecisao(atual.decisao, 'manter')"
              />
            </div>

            <Button
              v-if="atual.decisao.tipo === 'orfao' && atual.resposta === null && outrosOrfaos > 0"
              class="mg-pilula mg-pilula--pequena todos"
              icon="pi pi-check-square"
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
        class="mg-pilula"
        icon="pi pi-arrow-left"
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
          class="mg-pilula"
          icon="pi pi-arrow-right"
          icon-pos="right"
          :label="t('clinico.migracao.duvidas.proxima')"
          @click="indice += 1"
        />
        <Button
          v-if="migracao.semResposta === 0"
          class="mg-pilula mg-pilula--cheia mg-pilula--grande"
          icon="pi pi-arrow-right"
          icon-pos="right"
          :label="t('clinico.migracao.duvidas.verResumo', { n: respondidas }, respondidas)"
          @click="migracao.abrirResumo()"
        />
      </div>
    </footer>
  </section>
</template>

<style scoped>
.cabeca {
  display: grid;
  justify-items: start;
  gap: 0.5rem;
}

.contador {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.bolinhas {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.bolinha {
  width: 0.55rem;
  height: 0.55rem;
  border: 1px solid var(--hc-borda);
  border-radius: 999px;
  background: var(--hc-cartao);
}

.bolinha--feita {
  border-color: var(--hc-marca);
  background: var(--hc-marca);
}

.bolinha--atual {
  box-shadow:
    0 0 0 2px var(--hc-cartao),
    0 0 0 3.5px var(--hc-marca);
}

.pergunta {
  display: grid;
  gap: 1.1rem;
}

/*
 * Os dois lados da comparação. Mesmo peso, mesma forma — a pessoa decide olhando os dois, e
 * nenhum pode parecer "o certo" antes da resposta.
 */
.comparar {
  display: grid;
  align-items: stretch;
  gap: 0.75rem;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

.comparar__meio {
  display: grid;
  color: var(--hc-tinta-3);
  font-size: 1.1rem;
  place-items: center;
}

.lado {
  display: grid;
  align-content: start;
  padding: 1rem 1.15rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.9rem;
  background: var(--hc-fundo);
  gap: 0.35rem;
}

.lado__rotulo {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.lado__nome {
  color: var(--hc-tinta);
  font-size: 1.125rem;
}

.lado__dado {
  display: inline-flex;
  align-items: center;
  color: var(--hc-tinta-2);
  font-size: 0.9375rem;
  gap: 0.4rem;
}

.lado__dado .pi {
  color: var(--hc-tinta-3);
  font-size: 0.8rem;
}

.animais {
  display: grid;
  margin: 0.25rem 0 0;
  padding: 0;
  gap: 0.3rem;
  list-style: none;
}

.animais li {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.animais__linha {
  color: var(--hc-tinta-3);
  font-size: 0.875rem;
}

.respostas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

/* Seis espécies em duas fileiras de três: nenhuma sobra sozinha numa linha. */
/*
 * As seis espécies: numa fileira só quando o cartão é largo, três e três no médio, duas e duas no
 * estreito. Nunca uma sozinha na última linha. Quem decide é a largura do cartão.
 */
.cartao {
  container-type: inline-size;
}

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
  .respostas--grade {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.respostas__fora {
  grid-column: 1 / -1;
  justify-self: start;
}

.todos {
  justify-self: start;
}

/*
 * As colunas como opção de resposta: cartões baixos, lado a lado, com o começo do conteúdo. Fundo
 * e borda visíveis desde o início — é um botão, e precisa parecer um antes do hover.
 */
.opcoes {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
}

.opcao.p-button {
  display: grid;
  align-content: start;
  justify-content: stretch;
  justify-items: start;
  grid-template-columns: minmax(0, 1fr);
  padding: 0.85rem 1rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.9rem;
  background: var(--hc-fundo);
  color: var(--hc-tinta);
  gap: 0.5rem;
  text-align: start;
  transition:
    background-color 150ms ease-out,
    border-color 150ms ease-out;
}

.opcao.p-button:not(:disabled):hover {
  border-color: var(--hc-marca);
  background: var(--hc-cartao);
  color: var(--hc-tinta);
}

.opcao.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: 2px;
}

.opcao--escolhida.p-button,
.opcao--escolhida.p-button:not(:disabled):hover {
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
  box-shadow: inset 0 0 0 1px var(--hc-marca);
}

.opcao__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  font-size: 0.9375rem;
  gap: 0.5rem;
}

.opcao__marca {
  color: var(--hc-marca-forte);
}

.opcao__exemplos {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
  gap: 0.35rem;
}

.opcao__hoje {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.sem-ela {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 1rem;
}

.sem-ela__texto {
  display: flex;
  align-items: flex-start;
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  gap: 0.45rem;
}

.sem-ela__texto .pi {
  margin-top: 0.15rem;
  color: var(--hc-tinta-3);
}

.faltam {
  color: var(--hc-tinta-2);
  font-size: 0.9375rem;
  font-weight: 600;
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
  .opcao.p-button {
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
