<script setup lang="ts">
/**
 * A proposta de rotina: onde a máquina fala, a pessoa discorda, e só então alguém aprova.
 *
 * É um **painel**, e não um diálogo: na prancheta do turno ele mora na coluna da direita, ao lado
 * da lista que ele vai alterar. Ver a rotina de hoje e a proposta ao mesmo tempo é o que permite
 * discordar com base em alguma coisa — uma camada modal por cima da lista esconderia justamente o
 * que a pessoa precisa consultar para decidir. `PropostaDeRotinaDialog` embrulha este painel para
 * a ficha da estadia, onde a casa já resolve decisão em diálogo.
 *
 * ## O que esta tela existe para provar
 *
 * Não é que a sugestão seja boa — é que ela é **revisável**. Uma proposta que chega como lista
 * pronta com um botão "aplicar" treina a casa a apertar o botão; e no dia em que o motor errar,
 * ninguém terá aprendido a olhar. Por isso três coisas são inegociáveis aqui:
 *
 * 1. **Nada nasce marcado.** As caixas começam todas vazias. Aprovar é um gesto que se faz item a
 *    item, e o número do rodapé anda junto com a mão de quem marca.
 * 2. **Todo item proposto carrega o porquê**, com o registro datado que o produziu — a frase da
 *    inspeção de entrada, a adaptação anotada, o número de noites. É o porquê que torna possível
 *    discordar; sem ele, resta obedecer.
 * 3. **Os horários são editáveis antes de aprovar**, no mesmo campo de texto ditado que o
 *    check-in e o cadastro da rotina já usam. Concordar com a ideia e mudar a hora é o desfecho
 *    mais comum de uma revisão de verdade, e ele tem de caber sem sair da tela.
 *
 * ## As três origens, e por que nenhuma delas tem cor
 *
 * O que a casa já faz, o que veio da ficha e o que se propõe mudar aparecem em seções separadas, e
 * a diferença entre elas é **ter ou não caixa de seleção**, mais um rótulo curto — nunca fundo
 * pintado. Três cores de fundo numa lista de dez linhas viram decoração, e a informação que
 * importa (isto eu posso aprovar, aquilo é contexto) é justamente a que o fundo não consegue
 * dizer sem legenda.
 *
 * ## A parede da medicação
 *
 * A medicação fica atrás de uma régua, com os horários como **texto**: sem campo, sem caixa de
 * seleção, sem caminho. Não é cautela de interface — é `TarefaDaCasaKind` não admitir medicação,
 * de modo que aprovar o que está marcado aqui é fisicamente incapaz de criar ou alterar dose. O
 * que se vê é a receita transcrita, para quem revisa enxergar o dia inteiro.
 *
 * ## Nada foi gravado
 *
 * O cabeçalho diz isso em cinza, junto do motor e da hora da leitura, e não em vermelho: uma
 * proposta ainda não gravada é o estado normal dela, não um alerta. E a nota que avisa que não há
 * modelo nem rede fica logo abaixo, **presa junto do cabeçalho**: ela não pode sumir enquanto for
 * verdade, nem rolar para fora de vista com o resto.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import HotelSelo from '../base/HotelSelo.vue'
import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { HospedeParaRotina } from '../../data/repositories'
import { ehTarefaDaCasa } from '../../data/types'
import type { Adaptacao, ClockTime, TarefaDaCasaKind } from '../../data/types'
import { escreverHorarios, lerHorarios } from '../../domain/rotina-padrao'
import { aprovaveis } from '../../domain/rotina-sugerida'
import type {
  FonteDaSugestao,
  PropostaDeRotina,
  RecusaKind,
  SugestaoDeRotina,
} from '../../domain/rotina-sugerida'

const props = defineProps<{
  hospedes: HospedeParaRotina[]
  /** Vazio enquanto ninguém escolheu de quem é a proposta. */
  hospedagemId: string
  proposta: PropostaDeRotina | null
  gerando: boolean
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  'atualizar:hospedagemId': [id: string]
  aprovar: [
    payload: {
      hospedagemId: string
      sugestoes: { kind: TarefaDaCasaKind; horarios: ClockTime[]; motivo: string }[]
    },
  ]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

/**
 * O catálogo do porquê.
 *
 * A fonte viaja como identificador o caminho inteiro e a frase nasce aqui — o domínio não redige,
 * para que a mesma proposta se leia em espanhol sem passar por ele de novo.
 */
const CHAVE_DO_PORQUE: Record<FonteDaSugestao, string> = {
  'inspecao-de-entrada': 'hotel.proposta.porqueInspecao',
  adaptacao: 'hotel.proposta.porqueAdaptacao',
  'estadia-longa': 'hotel.proposta.porqueEstadiaLonga',
  'medicacao-registrada': 'hotel.proposta.porqueMedicacao',
  'plano-alimentar': 'hotel.proposta.porquePlano',
  'rotina-da-casa': 'hotel.proposta.porqueCasa',
}

const CHAVE_DA_RECUSA: Record<RecusaKind, string> = {
  'medicacao-nao-se-propoe': 'hotel.proposta.recusaMedicacao',
  'refeicao-combina-com-responsavel': 'hotel.proposta.recusaRefeicao',
}

/** O que está marcado e o que foi digitado, por sugestão. Vive aqui: nada disso é gravado ainda. */
const marcadas = ref<Record<string, boolean>>({})
const textos = ref<Record<string, string>>({})

const mostrarRecusas = ref(false)

/*
 * Proposta nova, estado zerado — e **zerado quer dizer desmarcado**. Reaproveitar as marcas da
 * proposta anterior faria a segunda revisão herdar decisões tomadas sobre outro animal.
 */
watch(
  () => props.proposta,
  (proposta) => {
    marcadas.value = {}
    textos.value = {}
    mostrarRecusas.value = false

    for (const sugestao of proposta ? aprovaveis(proposta) : []) {
      marcadas.value[sugestao.id] = false
      textos.value[sugestao.id] = escreverHorarios(sugestao.horarios)
    }
  },
  { immediate: true },
)

const sugestoes = computed(() => props.proposta?.sugestoes ?? [])

/** Contexto: o cadastro da casa. Aparece para quem revisa ver o dia inteiro, e não se aprova. */
const herdadas = computed(() => sugestoes.value.filter((item) => item.estado === 'herdada'))

/** Também contexto: o que foi copiado da ficha. A medicação sai daqui e vai para trás da régua. */
const daFicha = computed(() =>
  sugestoes.value.filter((item) => item.estado === 'transcrita' && item.kind !== 'medicacao'),
)

const remedios = computed(() => sugestoes.value.filter((item) => item.kind === 'medicacao'))

const mudancas = computed(() => (props.proposta ? aprovaveis(props.proposta) : []))

const hospede = computed(() =>
  props.hospedes.find((item) => item.hospedagemId === props.hospedagemId),
)

const total = computed(() => mudancas.value.filter((item) => marcadas.value[item.id]).length)

/**
 * O porquê, em frase.
 *
 * `adaptacao` é a única fonte cujo valor é um identificador do domínio, e por isso a única que
 * passa pela tradução antes de entrar na frase: sem isso, quem abre a tela em inglês leria
 * "received as estressado".
 */
function porqueEmTexto(porque: { fonte: FonteDaSugestao; valor: string }): string {
  const valor =
    porque.fonte === 'adaptacao' ? formato.adaptacao(porque.valor as Adaptacao) : porque.valor

  return t(CHAVE_DO_PORQUE[porque.fonte], { valor })
}

/**
 * O motivo que viaja junto do ajuste gravado.
 *
 * Nunca vazio por descuido: é a única linha que, em dezembro, explica por que a água daquele
 * hóspede tem uma troca a mais que a da casa.
 */
function motivoDe(sugestao: SugestaoDeRotina): string {
  const primeira = sugestao.porque[0]

  return primeira ? porqueEmTexto(primeira) : ''
}

function aprovar() {
  const escolhidas = mudancas.value.filter((item) => marcadas.value[item.id])

  emit('aprovar', {
    hospedagemId: props.hospedagemId,
    /*
     * O `flatMap` com a guarda é a parede escrita em TypeScript: o que não for tarefa da casa não
     * tem como entrar no payload, nem por engano de quem editar esta tela depois.
     */
    sugestoes: escolhidas.flatMap((sugestao) =>
      ehTarefaDaCasa(sugestao.kind)
        ? [
            {
              kind: sugestao.kind,
              horarios: lerHorarios(textos.value[sugestao.id] ?? ''),
              motivo: motivoDe(sugestao),
            },
          ]
        : [],
    ),
  })
}
</script>

<template>
  <div class="proposta">
    <!--
        Sem hóspede escolhido não há o que revisar, e a tela não finge que há: o diálogo é só a
        pergunta de quem é a rotina.
      -->
    <div v-if="!hospedagemId" class="campo">
      <label :for="`${idCampo}-hospede`">{{ t('hotel.proposta.escolherHospede') }}</label>

      <Select
        :input-id="`${idCampo}-hospede`"
        :model-value="hospedagemId"
        :options="hospedes"
        option-label="petNome"
        option-value="hospedagemId"
        fluid
        @update:model-value="(id: string) => emit('atualizar:hospedagemId', id)"
      >
        <!--
            O painel do Select é teleportado para fora da página, então `:deep` daqui não alcança
            a fileira dele. O que alcança é o conteúdo do slot, que carrega o atributo de escopo
            consigo — então o rosto do animal é montado dentro do que é meu.
          -->
        <template #option="{ option }">
          <span class="opcao">
            <PetAvatar
              :nome="option.petNome"
              :iniciais="option.petIniciais"
              :especie="option.petEspecie"
              :foto-url="option.petFotoUrl"
              tamanho="xs"
            />
            <span class="opcao__nome">{{ option.petNome }}</span>
            <span class="opcao__onde">{{ option.acomodacaoNome }}</span>
          </span>
        </template>
      </Select>
    </div>

    <p v-else-if="gerando" class="estado">
      <i class="ph ph-spin ph-circle-notch" aria-hidden="true" />
      {{ t('hotel.proposta.gerando') }}
    </p>

    <template v-else-if="proposta">
      <!--
          De quem é, de quando é, quem falou, e que nada disso existe ainda no banco. Em cinza:
          uma proposta não gravada é o estado normal dela, e não um alerta.
        -->
      <div class="proposta__cabecalho">
        <header class="cabecalho">
          <strong v-if="hospede" class="cabecalho__pet">
            <PetAvatar
              :nome="hospede.petNome"
              :iniciais="hospede.petIniciais"
              :especie="hospede.petEspecie"
              :foto-url="hospede.petFotoUrl"
              tamanho="xs"
            />
            {{ hospede.petNome }}
            <template v-if="hospede.acomodacaoNome"> · {{ hospede.acomodacaoNome }}</template>
          </strong>

          <p class="cabecalho__meta">
            {{ t('hotel.proposta.lidaEm', { hora: formato.hora(proposta.geradaEm) }) }} ·
            {{ t('hotel.proposta.motorLocal') }} · {{ t('hotel.proposta.nadaGravado') }}
          </p>
        </header>

        <!-- A frase que não pode sumir enquanto for verdade: não há modelo e não há rede. -->
        <p class="aviso">
          <i class="ph ph-info" aria-hidden="true" />
          {{ t('hotel.proposta.aviso') }}
        </p>
      </div>

      <!--
          O miolo é a única parte que rola. Cabeçalho e ações ficam presos nas pontas: numa
          revisão, as duas coisas que não podem sumir de vista são **de quem é** a proposta e
          **como aceitá-la** — e eram exatamente as duas que sumiam quando a lista ficava longa.
        -->
      <div class="proposta__corpo">
        <!-- ---------------------------------------------------------- contexto: a casa -->
        <section v-if="herdadas.length > 0" class="secao">
          <h3 class="secao__titulo">{{ t('hotel.proposta.casaJaFaz') }}</h3>

          <ul class="contexto">
            <li v-for="item in herdadas" :key="item.id" class="contexto__linha">
              <span class="disco" aria-hidden="true"><IconeDeTarefa :kind="item.kind" /></span>
              <span class="contexto__nome">{{ formato.tarefaKind(item.kind) }}</span>
              <span class="contexto__horarios clinic-value">
                {{ escreverHorarios(item.horarios) }}
              </span>
            </li>
          </ul>
        </section>

        <!-- ---------------------------------------------------------- contexto: a ficha -->
        <section v-if="daFicha.length > 0" class="secao">
          <h3 class="secao__titulo">{{ t('hotel.proposta.daFicha') }}</h3>

          <ul class="contexto">
            <li v-for="item in daFicha" :key="item.id" class="contexto__linha">
              <span class="disco" aria-hidden="true"><IconeDeTarefa :kind="item.kind" /></span>
              <span class="contexto__nome">{{ formato.tarefaKind(item.kind) }}</span>
              <span class="contexto__horarios clinic-value">
                {{ escreverHorarios(item.horarios) }}
              </span>
            </li>
          </ul>
        </section>

        <!-- ---------------------------------------------------------- o que se propõe mudar -->
        <section v-if="mudancas.length > 0" class="secao">
          <h3 class="secao__titulo">{{ t('hotel.proposta.proponhoMudar') }}</h3>

          <ul class="mudancas">
            <li v-for="item in mudancas" :key="item.id" class="mudanca">
              <Checkbox
                v-model="marcadas[item.id]"
                binary
                :input-id="`${idCampo}-${item.id}`"
                :disabled="salvando"
              />

              <span class="disco" aria-hidden="true"><IconeDeTarefa :kind="item.kind" /></span>

              <div class="mudanca__corpo">
                <label class="mudanca__nome" :for="`${idCampo}-${item.id}`">
                  {{ formato.tarefaKind(item.kind) }}
                </label>

                <!--
                  Concordar com a ideia e mudar a hora é o desfecho mais comum de uma revisão de
                  verdade. O campo é o mesmo texto ditado do check-in e do cadastro da rotina —
                  "8:00, 15:00" —, e quem o lê é `lerHorarios`, no domínio, uma vez só.
                -->
                <InputText
                  v-model="textos[item.id]"
                  :aria-label="t('hotel.rotinaPadrao.campoHorarios')"
                  autocomplete="off"
                  size="small"
                  class="mudanca__horarios"
                />

                <p v-for="(porque, indice) in item.porque" :key="indice" class="mudanca__porque">
                  {{ porqueEmTexto(porque) }}
                </p>
              </div>
            </li>
          </ul>
        </section>

        <p v-else class="estado">{{ t('hotel.proposta.semMudancas') }}</p>

        <!-- ---------------------------------------------------------- a parede da medicação -->
        <!--
          Atrás de uma régua, e do lado de fora de tudo que se aprova: sem campo, sem caixa, sem
          caminho. O ícone sai de `IconeDeTarefa` — que para `medicacao` é a cápsula do Phosphor —
          porque o mapa de ícones da casa existe num lugar só; o que muda aqui é o disco.
        -->
        <section v-if="remedios.length > 0" class="secao medicacao">
          <ul class="contexto">
            <li v-for="item in remedios" :key="item.id" class="medicacao__linha">
              <span class="disco disco--atencao" aria-hidden="true">
                <IconeDeTarefa :kind="item.kind" />
              </span>

              <div class="medicacao__corpo">
                <span class="medicacao__topo">
                  <strong>{{ formato.tarefaKind(item.kind) }}</strong>
                  <span class="medicacao__horarios clinic-value">
                    {{ escreverHorarios(item.horarios) }}
                  </span>
                  <HotelSelo :rotulo="t('hotel.proposta.transcrita')" tom="atencao" />
                </span>

                <p v-for="(porque, indice) in item.porque" :key="indice" class="medicacao__porque">
                  {{ porqueEmTexto(porque) }}
                </p>

                <p class="medicacao__parede">{{ t('hotel.proposta.naoEdita') }}</p>
              </div>
            </li>
          </ul>
        </section>

        <!-- ---------------------------------------------------------- o que não se propõe -->
        <!--
          Recolhido, porque é a mesma lista toda vez. Mas escrito, porque a ausência calada faria
          quem aprova supor que a máquina olhou a medicação e não achou nada a dizer.
        -->
        <section class="secao">
          <button type="button" class="recolhido" @click="mostrarRecusas = !mostrarRecusas">
            <i
              :class="mostrarRecusas ? 'ph ph-caret-down' : 'ph ph-caret-right'"
              aria-hidden="true"
            />
            {{ t('hotel.proposta.naoProponho') }}
          </button>

          <ul v-if="mostrarRecusas" class="recusas">
            <li v-for="recusa in proposta.recusas" :key="recusa" class="recusas__linha">
              {{ t(CHAVE_DA_RECUSA[recusa]) }}
            </li>
          </ul>
        </section>

        <!-- A prova de que o validador da volta funcionou: o motor tentou, e não passou. -->
        <p v-if="proposta.descartadas > 0" class="descartadas">
          <i class="ph ph-shield" aria-hidden="true" />
          {{
            t('hotel.proposta.descartadas', { total: proposta.descartadas }, proposta.descartadas)
          }}
        </p>
      </div>
    </template>

    <p v-if="erro" class="erro">{{ t(erro) }}</p>

    <!--
        As ações moram **dentro** do painel, e não num rodapé de diálogo: aqui não há diálogo.
        Ficam encostadas no fim, que é onde a leitura termina.
      -->
    <div class="proposta__rodape">
      <Button
        :label="t('hotel.proposta.descartar')"
        severity="secondary"
        text
        size="small"
        @click="emit('fechar')"
      />

      <!-- O número anda com a mão de quem marca: é ele que diz o tamanho do que se está aprovando. -->
      <Button
        :label="
          total > 0
            ? t('hotel.proposta.aprovar', { total }, total)
            : t('hotel.proposta.aprovarNenhuma')
        "
        icon="ph ph-check"
        size="small"
        :loading="salvando"
        :disabled="total === 0"
        @click="aprovar"
      />
    </div>
  </div>
</template>

<style scoped>
/*
 * Três faixas: cabeçalho preso, miolo que rola, ações presas.
 *
 * A primeira versão era uma coluna só, e o defeito aparecia quando a proposta ficava longa: o nome
 * do animal e o botão de aprovar saíam de vista, e o `Aprovar` — que é o ponto inteiro da tela —
 * só voltava depois de rolar a lista toda.
 *
 * `min-block-size: 0` é o que faz isso funcionar, e é a linha que se esquece: sem ela um item
 * flexível se recusa a encolher abaixo do próprio conteúdo, o miolo nunca ganha altura limitada, e
 * ninguém rola nada.
 */
.proposta {
  display: flex;
  min-block-size: 0;
  flex-direction: column;
  gap: var(--clinic-space-3);
}

.proposta__cabecalho {
  display: grid;
  flex: 0 0 auto;
  gap: var(--clinic-space-2);
}

.proposta__corpo {
  display: grid;
  overflow-y: auto;
  min-block-size: 0;
  flex: 1 1 auto;
  align-content: start;
  gap: var(--clinic-space-4);
  overscroll-behavior: contain;
}

/*
 * O aviso de que não há modelo nem rede, em nota e não em caixa.
 *
 * Como `Message` do PrimeVue ele custava perto de cem pixels de uma coluna de 28 rem — e aparece
 * em **toda** proposta, sempre com o mesmo texto. Nota compacta diz o mesmo e devolve o espaço a
 * quem precisa dele, que são as sugestões. O que não pode é desaparecer: enquanto for verdade que
 * a inteligência é encenada, a tela tem de dizer isso sem ninguém precisar procurar.
 */
.aviso {
  display: flex;
  align-items: flex-start;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.aviso .ph {
  margin-block-start: 0.1rem;
  color: var(--clinic-faint);
  font-size: 0.7rem;
}

.proposta__rodape {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  padding-block-start: var(--clinic-space-3);
  border-block-start: 1px solid var(--clinic-line-soft);
  gap: var(--clinic-space-2);
}

/* ------------------------------------------------------------------ escolher o hóspede */

.campo {
  display: grid;
  gap: var(--clinic-space-2);
}

.campo label {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.opcao {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--clinic-space-2);
}

.opcao__nome {
  font-weight: 700;
}

.opcao__onde {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ o cabeçalho */

.cabecalho {
  display: grid;
  justify-items: start;
  gap: 0.15rem;
}

.cabecalho__pet {
  display: inline-flex;
  align-items: center;
  gap: var(--clinic-space-2);
  color: var(--clinic-text);
  font-size: var(--clinic-font-value);
  font-weight: 700;
}

/*
 * A procedência inteira numa linha apagada: hora da leitura, quem falou, e que nada foi gravado.
 * Em vermelho isso viraria um erro; é o estado normal de uma proposta que ainda não foi aprovada.
 */
.cabecalho__meta {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.estado {
  display: flex;
  align-items: center;
  margin: 0;
  gap: 0.4rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-base);
}

/* ------------------------------------------------------------------ as seções */

.secao {
  display: grid;
  gap: var(--clinic-space-2);
}

/*
 * O rótulo da seção vai de ponta a ponta — texto no começo e um filete correndo até a borda. É o
 * mesmo idioma dos tempos da prancheta, e é o que faz estas listas se lerem como origens
 * diferentes sem que nenhuma delas precise de fundo pintado.
 */
.secao__titulo {
  display: flex;
  align-items: center;
  margin: 0;
  gap: 0.4rem;
  color: var(--clinic-text);
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.secao__titulo::after {
  height: 1px;
  flex: 1;
  background: var(--clinic-line-soft);
  content: '';
}

/* ------------------------------------------------------------------ o contexto */

.contexto {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.15rem;
  list-style: none;
}

/*
 * Contexto não tem caixa de seleção, e essa ausência é a informação: a coluna onde as caixas da
 * seção de baixo aparecem fica visivelmente vazia aqui, sem precisar de cor nenhuma para dizê-lo.
 */
.contexto__linha {
  display: flex;
  align-items: center;
  padding-block: 0.15rem;
  gap: var(--clinic-space-2);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-base);
}

.contexto__nome {
  min-width: 0;
  flex: 1;
}

.contexto__horarios {
  color: var(--clinic-muted);
  font-variant-numeric: tabular-nums;
}

.disco {
  display: grid;
  width: 1.6rem;
  height: 1.6rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--clinic-line);
  border-radius: 0.55rem;
  background: transparent;
  color: var(--clinic-muted);
  font-size: 0.7rem;
}

/* ------------------------------------------------------------------ o que se propõe mudar */

.mudancas {
  display: grid;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-3);
  list-style: none;
}

.mudanca {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-2) var(--clinic-space-3);
  grid-template-columns: auto auto minmax(0, 1fr);
}

.mudanca__corpo {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: var(--clinic-space-2);
}

.mudanca__nome {
  color: var(--clinic-text);
  cursor: pointer;
  font-size: var(--clinic-font-base);
  font-weight: 700;
}

.mudanca__horarios {
  width: min(14rem, 100%);
  font-variant-numeric: tabular-nums;
}

/*
 * O porquê, e ele é obrigatório: é o que transforma uma lista de ordens numa lista de argumentos.
 * Fica abaixo do campo porque se lê depois de ver o que está sendo proposto, não antes.
 */
.mudanca__porque {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ a parede da medicação */

/* A régua é a parede desenhada: daqui para baixo não há nada que se aprove. */
.medicacao {
  padding-block-start: var(--clinic-space-3);
  border-block-start: 1px solid var(--clinic-line);
}

.medicacao__linha {
  display: flex;
  align-items: start;
  gap: var(--clinic-space-3);
}

.disco--atencao {
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.medicacao__corpo {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.medicacao__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-base);
}

/* Texto, e não campo: a receita é lida aqui, e mudada onde ela é registrada. */
.medicacao__horarios {
  color: var(--clinic-text);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.medicacao__porque {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.medicacao__parede {
  margin: 0;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

/* ------------------------------------------------------------------ o que não se propõe */

.recolhido {
  display: flex;
  align-items: center;
  justify-self: start;
  padding: 0.25rem 0;
  border: 0;
  gap: 0.4rem;
  background: transparent;
  color: var(--clinic-faint);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.recolhido:hover {
  color: var(--clinic-accent-strong);
}

.recusas {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.2rem;
  list-style: none;
}

.recusas__linha {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ o resto */

.descartadas {
  display: flex;
  align-items: center;
  margin: 0;
  gap: 0.4rem;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.erro {
  margin: 0;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

/*
 * No telefone as três colunas não cabem sem espremer o campo de horários a largura de ícone.
 * A caixa e o disco seguem na frente, anunciando que a linha é aprovável, e o corpo desce.
 */
@media (max-width: 620px) {
  .mudanca {
    grid-template-columns: auto auto;
  }

  .mudanca__corpo {
    grid-column: 1 / -1;
  }
}
</style>
