<script setup lang="ts">
/**
 * Como os bichos estão, agora.
 *
 * ## Por que este bloco existe
 *
 * O painel respondia "quem chega, quem sai, o que trava" — tudo movimento e papelada. A metade
 * inferior da tela estava vazia enquanto o domínio já sabia três coisas que não apareciam em tela
 * nenhuma do módulo: **quem está estressado**, **que medicação vence hoje** e **que cuidado está
 * em aberto**. Num hotel de animais esse é o dado que justifica o negócio; estava guardado no tipo
 * e invisível para quem abre o portal às sete da manhã.
 *
 * ## Por que adaptação vem primeiro, e por que só o que não está bem aparece por nome
 *
 * `tranquilo` é o estado esperado — listar cinco nomes tranquilos é ocupar a tela com ausência de
 * notícia. Estressado e em adaptação viram **nome, acomodação e caminho**; tranquilo vira só um
 * número, para que o total feche e ninguém ache que a contagem sumiu.
 *
 * ## Por que a medicação sai da prancheta, e não da estadia
 *
 * `MedicacaoDaEstadia` mora em `EstadiaDetalhada`, que é carregada **uma estadia por vez** — montar
 * a medicação da casa por ali obrigaria a buscar todas as estadias só para desenhar uma lista. A
 * prancheta do dia já está carregada, já é por casa, e já nasce de `TarefaKind`. A dose que a
 * prancheta mostra é a mesma que o canil executa; ler de outro lugar seria arriscar divergência
 * entre o que o painel promete e o que a prancheta cobra.
 *
 * ## Por que não são três cartões
 *
 * Porque a casa já sofre de achatamento: quando todo bloco tem a mesma borda, nada tem hierarquia.
 * Os três assuntos dividem um cartão e se separam por **título e respiro**, não por moldura.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { HospedeNaCasa, TarefaNaPrancheta } from '../../data/repositories'
import type { Adaptacao, ISODateTime } from '../../data/types'

const props = defineProps<{
  hospedes: HospedeNaCasa[]
  prancheta: TarefaNaPrancheta[]
  /** Instante de agora, para separar a dose que passou da que ainda vem. */
  agora: ISODateTime
}>()

const emit = defineEmits<{ abrir: [rota: string] }>()

const { t } = useI18n()
const formato = useHotelFormat()

/**
 * Os estados que ganham nome na tela, na ordem em que importam.
 *
 * `tranquilo` fica de fora de propósito: ele é contado no rodapé, não listado.
 */
const ESTADOS_DE_ATENCAO = ['estressado', 'em-adaptacao'] as const satisfies readonly Adaptacao[]

type GrupoDeAdaptacao = {
  estado: (typeof ESTADOS_DE_ATENCAO)[number]
  hospedes: HospedeNaCasa[]
}

const adaptacao = computed<GrupoDeAdaptacao[]>(() =>
  ESTADOS_DE_ATENCAO.map((estado) => ({
    estado,
    hospedes: props.hospedes.filter((h) => h.hospedagem.adaptacao === estado),
  })).filter((grupo) => grupo.hospedes.length > 0),
)

const tranquilos = computed(
  () => props.hospedes.filter((h) => h.hospedagem.adaptacao === 'tranquilo').length,
)

/**
 * As doses de hoje, em ordem de relógio.
 *
 * Recusada e pulada entram: a dose que alguém decidiu não dar é informação clínica, e sumir com
 * ela do painel é o mesmo que fingir que o dia correu limpo.
 */
const doses = computed(() =>
  props.prancheta
    .filter((linha) => linha.tarefa.kind === 'medicacao')
    .slice()
    .sort((a, b) => a.tarefa.previstaPara.localeCompare(b.tarefa.previstaPara)),
)

const dosesPendentes = computed(
  () => doses.value.filter((linha) => linha.tarefa.status === 'pendente').length,
)

/** Cuidado é o que não é remédio nem serviço: curativo, compressa, observação de ferida. */
const cuidados = computed(() =>
  props.prancheta.filter(
    (linha) => linha.tarefa.kind === 'cuidado' && linha.tarefa.status === 'pendente',
  ),
)

/**
 * O tom de cada dose. `atrasada` só existe para o que ainda está pendente **e** já passou da hora:
 * uma dose feita às 12:05 não é atraso, é o dia funcionando.
 */
function tomDaDose(linha: TarefaNaPrancheta): 'feita' | 'atrasada' | 'recusada' | 'pendente' {
  if (linha.tarefa.status === 'feita') return 'feita'
  if (linha.tarefa.status === 'recusada' || linha.tarefa.status === 'pulada') return 'recusada'
  return linha.tarefa.previstaPara < props.agora ? 'atrasada' : 'pendente'
}

function rotaDaEstadia(hospedagemId: string): string {
  return `/hotel/hospedagem/${hospedagemId}`
}
</script>

<template>
  <section class="bemEstar clinic-card">
    <h2 class="bemEstar__titulo">{{ t('hotel.painel.bemEstar.titulo') }}</h2>

    <div class="colunas">
      <!-- ---------------------------------------------------------------- adaptação -->
      <div class="coluna">
        <div class="assunto">
          <h3 class="assunto__titulo">{{ t('hotel.painel.bemEstar.adaptacao') }}</h3>

          <p v-if="adaptacao.length === 0" class="assunto__calmo">
            {{ t('hotel.painel.bemEstar.todosTranquilos', { total: tranquilos }, tranquilos) }}
          </p>

          <template v-else>
            <div v-for="grupo in adaptacao" :key="grupo.estado" class="grupo">
              <span class="grupo__estado" :class="`grupo__estado--${grupo.estado}`">
                <span class="grupo__ponto" aria-hidden="true" />
                <strong class="clinic-value">{{ grupo.hospedes.length }}</strong>
                {{ t(`hotel.painel.bemEstar.estado.${grupo.estado}`, {}, grupo.hospedes.length) }}
              </span>

              <ul class="bichos">
                <li v-for="hospede in grupo.hospedes" :key="hospede.hospedagem.id">
                  <button
                    type="button"
                    class="bicho"
                    @click="emit('abrir', rotaDaEstadia(hospede.hospedagem.id))"
                  >
                    <PetAvatar
                      :nome="hospede.petNome"
                      :iniciais="hospede.petIniciais"
                      :especie="hospede.petEspecie"
                      :foto-url="hospede.petFotoUrl"
                      tamanho="xs"
                    />
                    <span class="bicho__nome">{{ hospede.petNome }}</span>
                    <span class="bicho__onde">{{ hospede.acomodacaoNome }}</span>
                  </button>
                </li>
              </ul>
            </div>

            <p v-if="tranquilos > 0" class="assunto__rodape">
              {{ t('hotel.painel.bemEstar.demaisTranquilos', { total: tranquilos }, tranquilos) }}
            </p>
          </template>
        </div>
      </div>

      <!--
        Medicação e cuidado dividem a coluna da direita porque nascem da mesma fonte — a prancheta
        do dia — e se lêem do mesmo jeito: hora, ícone, quem, o quê. Adaptação é outra gramática,
        sem relógio, e por isso fica sozinha do outro lado.
      -->
      <div class="coluna">
        <!-- ---------------------------------------------------------------- medicação -->
        <div v-if="doses.length > 0" class="assunto">
          <h3 class="assunto__titulo">
            {{ t('hotel.painel.bemEstar.medicacao') }}
            <span class="assunto__contagem">
              {{
                t('hotel.painel.bemEstar.dosesPendentes', { total: dosesPendentes }, dosesPendentes)
              }}
            </span>
          </h3>

          <ul class="doses">
            <li
              v-for="linha in doses"
              :key="linha.tarefa.id"
              class="dose"
              :class="`dose--${tomDaDose(linha)}`"
            >
              <time class="dose__hora">{{ formato.hora(linha.tarefa.previstaPara) }}</time>
              <IconeDeTarefa kind="medicacao" class="dose__icone" />
              <button
                type="button"
                class="dose__corpo"
                @click="emit('abrir', rotaDaEstadia(linha.hospedagemId))"
              >
                <strong class="dose__quem">{{ linha.petNome }}</strong>
                <span class="dose__oque">{{ linha.tarefa.descricao }}</span>
              </button>
            </li>
          </ul>
        </div>

        <!-- ---------------------------------------------------------------- cuidados -->
        <div v-if="cuidados.length > 0" class="assunto">
          <h3 class="assunto__titulo">{{ t('hotel.painel.bemEstar.cuidados') }}</h3>

          <ul class="doses">
            <li v-for="linha in cuidados" :key="linha.tarefa.id" class="dose">
              <time class="dose__hora">{{ formato.hora(linha.tarefa.previstaPara) }}</time>
              <IconeDeTarefa kind="cuidado" class="dose__icone" />
              <button
                type="button"
                class="dose__corpo"
                @click="emit('abrir', rotaDaEstadia(linha.hospedagemId))"
              >
                <strong class="dose__quem">{{ linha.petNome }}</strong>
                <span class="dose__oque">{{ linha.tarefa.descricao }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bemEstar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.25rem 1.25rem 1.5rem;
}

.bemEstar__titulo {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--clinic-muted);
}

/*
 * Duas colunas, no mesmo `auto-fit` que o painel já usa nas listas de chegada e saída: quando a
 * largura não dá para duas faixas de 20rem, elas empilham sozinhas, sem breakpoint escrito à mão.
 *
 * `align-items: start` porque as colunas não têm o mesmo tamanho e nunca terão — adaptação é curta
 * num dia calmo, medicação é longa num dia de muitos remédios. Esticada à altura da vizinha, a
 * curta ficaria com metade do corpo vazio, e vazio emparelhado com conteúdo lê como dado faltando.
 */
.colunas {
  display: grid;
  /*
   * `stretch`, e não `start`: o filete que separa as colunas é desenhado na borda da coluna, então
   * com `start` ele para onde a coluna mais curta acaba — e um traço que morre no meio do cartão
   * lê como falha de renderização, não como divisória. Esticadas, as duas têm a mesma altura e o
   * filete vai de ponta a ponta. Aqui não há o risco que `start` evita nas listas do painel: lá
   * cada coluna é um cartão com borda, e esticar deixaria moldura vazia ao lado de conteúdo; aqui
   * o que sobra é fundo do mesmo cartão, que não lê como dado faltando.
   */
  align-items: stretch;
  gap: var(--clinic-space-5);
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
}

.coluna {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/*
 * Os assuntos se separam por respiro e por um filete, não por moldura — o cartão já é a moldura, e
 * caixa dentro de caixa é exatamente o empilhamento de bordas que deixa a tela achatada.
 *
 * Dentro de uma coluna o filete é horizontal (medicação sobre cuidados); entre as colunas ele é
 * vertical, e só existe quando elas estão de fato lado a lado — empilhadas, um filete à esquerda
 * seria um risco solto no meio do cartão.
 */
.assunto + .assunto {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--clinic-line-soft);
}

@media (min-width: 64rem) {
  .coluna + .coluna {
    padding-left: var(--clinic-space-5);
    border-left: 1px solid var(--clinic-line-soft);
  }
}

.assunto__titulo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--clinic-text);
}

.assunto__contagem,
.assunto__rodape,
.assunto__calmo {
  font-size: 0.8125rem;
  font-weight: 400;
  color: var(--clinic-muted);
}

.assunto__rodape {
  margin: 0.75rem 0 0;
}

.assunto__calmo {
  margin: 0;
}

/* ------------------------------------------------------------------ adaptação */

.grupo + .grupo {
  margin-top: 0.875rem;
}

.grupo__estado {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  color: var(--clinic-muted);
}

/*
 * O ponto carrega o estado, como na legenda do mapa de ocupação. Mesma gramática em duas telas: a
 * pessoa aprende a ler a cor uma vez.
 */
.grupo__ponto {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: currentColor;
}

.grupo__estado--estressado {
  color: var(--clinic-risk-text);
}

.grupo__estado--em-adaptacao {
  color: var(--clinic-attention-text);
}

.bichos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0.5rem 0 0;
  padding: 0;
  list-style: none;
}

.bicho {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.625rem 0.3rem 0.3rem;
  border: 1px solid var(--clinic-line);
  border-radius: 999px;
  background: var(--clinic-surface);
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: border-color 150ms ease-out;
}

.bicho:hover,
.bicho:focus-visible {
  border-color: var(--clinic-accent);
}

.bicho__nome {
  font-size: 0.8125rem;
  font-weight: 600;
}

.bicho__onde {
  font-size: 0.75rem;
  color: var(--clinic-muted);
}

/* ------------------------------------------------------------------ doses e cuidados */

.doses {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dose {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: 0.625rem;
  padding: 0.4rem 0;
}

.dose + .dose {
  border-top: 1px solid var(--clinic-line-soft);
}

.dose__hora {
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: var(--clinic-muted);
}

.dose__icone {
  font-size: 0.875rem;
  color: var(--clinic-muted);
}

.dose__corpo {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  font: inherit;
  color: inherit;
  text-align: start;
}

.dose__quem {
  font-size: 0.8125rem;
  font-weight: 600;
}

.dose__oque {
  font-size: 0.8125rem;
  color: var(--clinic-muted);
}

/*
 * O estado da dose mora na hora e no ícone — não no fundo da linha. Pintar a linha inteira de
 * vermelho num painel que já tem avisos vermelhos no topo ensina a ignorar o vermelho de cima.
 */
.dose--feita .dose__hora,
.dose--feita .dose__icone {
  opacity: 0.45;
}

.dose--feita .dose__quem,
.dose--feita .dose__oque {
  color: var(--clinic-muted);
}

.dose--atrasada .dose__hora,
.dose--atrasada .dose__icone {
  color: var(--clinic-risk-text);
  font-weight: 700;
}

.dose--recusada .dose__hora {
  text-decoration: line-through;
}
</style>
