<script setup lang="ts">
/**
 * Saúde pública › Campanhas › o dia da campanha (protótipo, 17/11/2026, "forma da equipe na
 * campanha conseguir registrar os dados"): a tela que a equipe abre no tablet, no ponto de
 * atendimento. Em cima, o dia em números (atendimentos, realizados, parciais, não realizados e o
 * motivo que mais aparece); "Registrar atendimento" abre o mesmo registro do Consultório Móvel, já
 * com o procedimento da campanha; embaixo, os atendimentos dela, do mais recente, com o filtro
 * rápido por situação. Clicar num atendimento abre o detalhe, onde se anota o resultado depois.
 *
 * A campanha agendada ainda não teve o dia: a tela diz que é aqui que a equipe vai registrar, e no
 * protótipo dá para simular agora. Os atendimentos das encerradas são os ilustrativos do período.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import {
  cepNaTela,
  resumirEquipe,
  resumirRegistros,
  situacaoDoRegistro,
  useCampo,
} from '@/features/saude-publica/campo'
import AtendimentoDeCampoGaveta from '@/features/saude-publica/components/AtendimentoDeCampoGaveta.vue'
import AvisoDoPrototipo from '@/features/saude-publica/components/AvisoDoPrototipo.vue'
import RegistrarAtendimentoGaveta from '@/features/saude-publica/components/RegistrarAtendimentoGaveta.vue'
import {
  dataPorExtenso,
  funcao,
  funcaoDaPessoa,
  motivo,
  numero,
  PROCEDIMENTO_DA_CAMPANHA,
  procedimento,
  regiao,
  tipoDeCampanha,
  type SituacaoDoAtendimento,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo } from '@/features/saude-publica/estado'
import { seloDoResultado, SITUACOES } from '@/features/saude-publica/resultado'

const route = useRoute()
const { campanhas } = useEstadoDoPrototipo()
const campo = useCampo()

const id = computed(() => String((route.params as Record<string, unknown>).id ?? ''))
const campanha = computed(() => campanhas.value.find((item) => item.id === id.value) ?? null)
const tipo = computed(() => (campanha.value ? tipoDeCampanha(campanha.value.tipo) : null))

const resumoDaPagina = computed(() => {
  const alvo = campanha.value
  if (!alvo) return ''
  return `${dataPorExtenso(alvo.data)} · ${alvo.regioes.map((item) => regiao(item).nome).join(' e ')} · ${alvo.local}`
})

/* ---------------------------------------------------------------------- os atendimentos */

/** Os registrados agora (com cadastro) vêm primeiro: a equipe vê o que acabou de fazer. */
const todos = computed(() => {
  const lista = campanha.value ? campo.registrosDaCampanha(campanha.value.id) : []
  return [
    ...lista.filter((item) => item.responsavelId),
    ...lista.filter((item) => !item.responsavelId),
  ]
})
const resumo = computed(() => resumirRegistros(todos.value))
const motivoMaisComum = computed(() => resumo.value.motivos[0] ?? null)

/** A equipe do dia: quem atendeu e quem acolheu, com quantos cada um, de quem fez mais. */
const equipeDoDia = computed(() =>
  resumirEquipe(todos.value).sort((uma, outra) => outra.total - uma.total),
)

type Filtro = SituacaoDoAtendimento | 'todas'
const filtro = ref<Filtro>('todas')
const LIMITE = 50
const limite = ref(LIMITE)

watch([filtro, id], () => {
  limite.value = LIMITE
})

const opcoesDoFiltro = computed(() => [
  { valor: 'todas' as Filtro, rotulo: `Todos (${numero(resumo.value.total)})` },
  {
    valor: 'realizado' as Filtro,
    rotulo: `${SITUACOES.realizado.rotulo} (${numero(resumo.value.realizados)})`,
  },
  {
    valor: 'parcial' as Filtro,
    rotulo: `${SITUACOES.parcial.rotulo} (${numero(resumo.value.parciais)})`,
  },
  {
    valor: 'nao-realizado' as Filtro,
    rotulo: `${SITUACOES['nao-realizado'].rotulo} (${numero(resumo.value.naoRealizados)})`,
  },
])

const filtrados = computed(() =>
  filtro.value === 'todas'
    ? todos.value
    : todos.value.filter((item) => situacaoDoRegistro(item) === filtro.value),
)
const visiveis = computed(() => filtrados.value.slice(0, limite.value))

/* ---------------------------------------------------------------------------- as gavetas */

/* Uma gaveta por vez: abrir uma fecha a outra. */
const registrando = ref(false)
const registroAberto = ref<string | null>(null)
const detalheVisivel = ref(false)

function registrar() {
  detalheVisivel.value = false
  registrando.value = true
}

function abrirDetalhe(registroId: string) {
  registrando.value = false
  registroAberto.value = registroId
  detalheVisivel.value = true
}

/* O atendimento recém-registrado abre depois que a gaveta do registro termina de sair. */
function aoRegistrar(registroId: string) {
  filtro.value = 'todas'
  window.setTimeout(() => abrirDetalhe(registroId), 320)
}

const ESPECIE: Record<string, string> = {
  CACHORRO: 'Cachorro',
  GATO: 'Gato',
  OUTRO: 'Outra espécie',
}
</script>

<template>
  <UiPagina
    :titulo="campanha?.titulo ?? 'Campanha'"
    icone="ph ph-megaphone"
    :resumo="resumoDaPagina"
  >
    <template #voltar>
      <RouterLink to="/saude-publica/campanhas" class="voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        Campanhas
      </RouterLink>
    </template>

    <template v-if="campanha" #acoes>
      <Button type="button" icon="ph ph-qr-code" label="Registrar atendimento" @click="registrar" />
    </template>

    <UiVazioIlustrado
      v-if="!campanha"
      icone="ph ph-megaphone"
      titulo="Campanha não encontrada"
      texto="Ela pode ter sido criada em outra sessão da apresentação. Volte para a lista e escolha uma."
    >
      <template #acao>
        <Button
          :as="RouterLink"
          to="/saude-publica/campanhas"
          icon="ph ph-arrow-left"
          label="Voltar para Campanhas"
        />
      </template>
    </UiVazioIlustrado>

    <div v-else class="dc">
      <AvisoDoPrototipo />

      <!-- Agendada: o dia ainda não chegou, mas a equipe já sabe onde vai registrar. -->
      <p v-if="campanha.situacao === 'agendada'" class="dc__agendada ui-poco" role="status">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-calendar-dots" /></span>
        <span>
          <strong
            >No dia da campanha ({{ dataPorExtenso(campanha.data) }}), a equipe registra
            aqui</strong
          >
          cada animal atendido no ponto, no tablet, com o resultado e o motivo do que não deu. No
          protótipo, dá para simular agora em "Registrar atendimento".
        </span>
      </p>

      <!-- O dia em números. -->
      <section
        v-if="resumo.total"
        class="ui-folha ui-cartao dc__caixa"
        aria-labelledby="dc-numeros"
      >
        <header class="ui-cartao__cabeca dc__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i :class="tipo?.icone" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="dc-numeros" class="ui-cartao__titulo">O dia em números</h2>
            <p class="ui-cartao__descricao">
              {{ procedimento(PROCEDIMENTO_DA_CAMPANHA[campanha.tipo]).rotulo }}:
              {{ numero(campanha.avisados) }} tutores avisados pelo app.
              <template v-if="resumo.total">
                {{ resumo.taxa }}% dos atendimentos saíram com tudo feito.
              </template>
            </p>
          </span>
        </header>
        <ul class="dc__numeros">
          <li class="dc__numero">
            <strong class="dc__valor ui-num">{{ numero(resumo.total) }}</strong>
            <span class="dc__rotulo">Atendimentos registrados</span>
          </li>
          <li class="dc__numero">
            <strong class="dc__valor ui-num">{{ numero(resumo.realizados) }}</strong>
            <span class="dc__rotulo">
              <i class="ph ph-check-circle dc__ok" aria-hidden="true" /> Realizados
            </span>
          </li>
          <li class="dc__numero">
            <strong class="dc__valor ui-num">{{ numero(resumo.parciais) }}</strong>
            <span class="dc__rotulo">
              <i class="ph ph-circle-half dc__parcial" aria-hidden="true" /> Parciais
            </span>
          </li>
          <li class="dc__numero">
            <strong class="dc__valor ui-num">{{ numero(resumo.naoRealizados) }}</strong>
            <span class="dc__rotulo">
              <i class="ph ph-x-circle dc__nao" aria-hidden="true" /> Não realizados
            </span>
          </li>
          <li class="dc__numero">
            <strong class="dc__valor dc__valor--texto">
              {{ motivoMaisComum ? motivo(motivoMaisComum.motivo).rotulo : '—' }}
            </strong>
            <span class="dc__rotulo">
              Motivo mais comum
              <template v-if="motivoMaisComum">
                ({{ numero(motivoMaisComum.vezes) }} vezes)
              </template>
            </span>
          </li>
        </ul>
      </section>

      <!-- A equipe do dia: quem atendeu e quem acolheu, com quantos cada um. -->
      <section
        v-if="equipeDoDia.length"
        class="ui-folha ui-cartao dc__caixa"
        aria-labelledby="dc-equipe"
      >
        <header class="ui-cartao__cabeca dc__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-users-three" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="dc-equipe" class="ui-cartao__titulo">
              Equipe do dia
              <span class="ui-contagem">{{ numero(equipeDoDia.length) }}</span>
            </h2>
            <p class="ui-cartao__descricao">
              Equipe de exemplo: cada pessoa responde por um posto, com os voluntários dele.
            </p>
          </span>
        </header>
        <ul class="dc__equipe">
          <li v-for="linha in equipeDoDia" :key="linha.pessoa.id" class="dc__pessoa">
            <span class="ui-ladrilho dc__pessoa-icone" aria-hidden="true">
              <i :class="funcao(linha.pessoa.funcao).icone" />
            </span>
            <span class="dc__pessoa-texto">
              <strong>{{ linha.pessoa.nome }}</strong>
              <small>{{ funcaoDaPessoa(linha.pessoa) }}</small>
            </span>
            <span class="dc__pessoa-numero">
              <strong class="ui-num">{{ numero(linha.total) }}</strong>
              <small>{{ linha.pessoa.funcao === 'cadastro' ? 'acolhidos' : 'atendidos' }}</small>
            </span>
          </li>
        </ul>
      </section>

      <!-- Os atendimentos da campanha, do mais recente. -->
      <section class="ui-folha ui-cartao dc__caixa" aria-labelledby="dc-lista">
        <header class="ui-cartao__cabeca dc__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-list-checks" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="dc-lista" class="ui-cartao__titulo">
              Atendimentos
              <span class="ui-contagem">{{ numero(filtrados.length) }}</span>
            </h2>
            <p class="ui-cartao__descricao">
              Do mais recente. Abra um para ver o cadastro e anotar o resultado.
            </p>
          </span>
        </header>

        <SelectButton
          v-if="todos.length"
          v-model="filtro"
          class="dc__filtro"
          :options="opcoesDoFiltro"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-label="Situação do atendimento"
        />

        <UiVazioIlustrado
          v-if="!todos.length"
          aninhado
          icone="ph ph-qr-code"
          titulo="Nenhum atendimento registrado ainda"
          texto="Cada animal atendido no ponto entra aqui, com o resultado e o motivo do que não deu."
        >
          <template #acao>
            <Button
              type="button"
              icon="ph ph-qr-code"
              label="Registrar atendimento"
              @click="registrar"
            />
          </template>
        </UiVazioIlustrado>

        <p v-else-if="!filtrados.length" class="eg__dica dc__nada">
          Nenhum atendimento com esta situação.
        </p>

        <ul v-else class="dc__lista">
          <li v-for="registro in visiveis" :key="registro.id">
            <button
              type="button"
              class="dc__linha"
              :class="{ 'dc__linha--aberta': detalheVisivel && registroAberto === registro.id }"
              @click="abrirDetalhe(registro.id)"
            >
              <PetAvatar
                :nome="registro.animal"
                :iniciais="iniciais(registro.animal)"
                :especie="registro.especie === 'GATO' ? 'felina' : 'canina'"
                tamanho="sm"
              />
              <span class="dc__texto">
                <strong>{{ registro.animal }}</strong>
                <span>
                  {{ ESPECIE[registro.especie] }} · Tutor {{ registro.tutor }} ·
                  {{ registro.hora }}
                </span>
                <small>
                  {{ registro.bairro ?? 'Bairro não informado' }}
                  <template v-if="registro.cep"> · CEP {{ cepNaTela(registro.cep) }}</template>
                </small>
              </span>
              <span class="ui-selo dc__selo" :class="seloDoResultado(registro.resultados).classe">
                <i :class="seloDoResultado(registro.resultados).icone" aria-hidden="true" />
                {{ seloDoResultado(registro.resultados).texto }}
              </span>
              <i class="ph ph-caret-right dc__seta" aria-hidden="true" />
            </button>
          </li>
        </ul>

        <Button
          v-if="filtrados.length > limite"
          type="button"
          severity="secondary"
          outlined
          class="dc__mais"
          icon="ph ph-caret-down"
          :label="`Mostrar mais (${numero(filtrados.length - limite)} restantes)`"
          @click="limite += LIMITE"
        />
      </section>
    </div>

    <template #sempre>
      <RegistrarAtendimentoGaveta
        v-model:visible="registrando"
        :campanha="campanha"
        @registrado="aoRegistrar"
      />
      <AtendimentoDeCampoGaveta v-model:visible="detalheVisivel" :registro-id="registroAberto" />
    </template>
  </UiPagina>
</template>

<style scoped>
.voltar .ph {
  font-size: 13px;
}

.dc {
  display: grid;
  gap: 18px;
}

.dc__agendada {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.dc__agendada strong {
  color: var(--tinta);
}

.dc__caixa {
  container: dia / inline-size;
  display: grid;
  align-content: start;
  gap: 16px;
}

.dc__cabeca {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.dc__numeros {
  display: grid;
  gap: 12px 14px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  list-style: none;
}

.dc__numero {
  display: grid;
  align-content: start;
  gap: 2px;
}

.dc__valor {
  color: var(--tinta);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.dc__valor--texto {
  font-size: 15px;
  letter-spacing: 0;
  line-height: 1.3;
}

.dc__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.dc__ok {
  color: var(--ok-tinta);
}

.dc__parcial {
  color: var(--atencao-tinta);
}

.dc__nao {
  color: var(--risco-tinta);
}

.dc__filtro {
  justify-self: start;
}

.dc__nada {
  margin: 0;
}

/* A equipe do dia: uma linha de pessoas, cada uma com o número dela. */
.dc__equipe {
  display: grid;
  gap: 10px 18px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  list-style: none;
}

.dc__pessoa {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dc__pessoa-icone {
  flex: none;
}

.dc__pessoa-texto {
  display: grid;
  flex: 1;
  gap: 1px;
  min-width: 0;
}

.dc__pessoa-texto strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dc__pessoa-texto small,
.dc__pessoa-numero small {
  color: var(--tinta-2);
  font-size: 12px;
}

.dc__pessoa-numero {
  display: grid;
  justify-items: end;
  gap: 1px;
}

.dc__pessoa-numero strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 700;
}

.dc__lista {
  display: grid;
  margin: 0 -12px;
  padding: 0;
  list-style: none;
}

.dc__lista > li + li {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

/* A linha inteira abre o atendimento. Tablet: 56 px de alto, sem ação escondida em hover. */
.dc__linha {
  display: grid;
  width: 100%;
  min-height: 56px;
  align-items: center;
  gap: 8px 14px;
  padding: 10px 12px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  transition: background-color var(--pj-tempo-curto, 0.15s) ease;
}

.dc__linha:hover,
.dc__linha--aberta {
  background: var(--app-veu, var(--superficie-2));
}

.dc__linha:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: -2px;
}

.dc__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
  color: var(--tinta-2);
  font-size: 13px;
}

.dc__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.dc__texto small {
  color: var(--tinta-3);
  font-size: 12px;
}

.dc__selo {
  max-width: 18rem;
  white-space: normal;
}

.dc__seta {
  color: var(--tinta-3);
}

.dc__mais {
  justify-self: center;
}

@container dia (max-width: 760px) {
  .dc__numeros {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .dc__linha {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .dc__selo {
    grid-row: 2;
    grid-column: 2 / 4;
    justify-self: start;
  }

  .dc__seta {
    grid-row: 1;
    grid-column: 3;
  }
}
</style>
