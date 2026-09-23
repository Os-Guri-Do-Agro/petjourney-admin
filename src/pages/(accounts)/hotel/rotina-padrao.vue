<script setup lang="ts">
/**
 * Rotina padrão — o que a casa faz por todos os hóspedes, e a que horas.
 *
 * ## De onde isto veio
 *
 * Os horários de água, higiene e passeio eram três constantes dentro de `domain/rotina.ts`, com um
 * comentário dizendo por que ficaram assim: *"transformá-los em cadastro agora acrescentaria uma
 * tela de configuração antes de existir alguém pedindo para mudá-los"*. A razão era a ausência de
 * pedido. O pedido chegou, e esta tela é a dívida sendo paga.
 *
 * ## A forma: uma régua de relógio, não uma lista
 *
 * `docs/hotel/02-fluxo-de-telas.md` exige que nenhuma tela do módulo tenha a silhueta de outra, e
 * a razão é prática: num módulo de nove telas, duas que se parecem são duas que se confundem. A
 * prancheta do turno já é a lista vertical de horários; a de acomodações já é a planta por bloco.
 *
 * Aqui o dia inteiro é uma **faixa horizontal de 24 horas por serviço**, com os horários marcados
 * sobre ela. Isso responde de relance uma pergunta que uma lista não responde: *o dia está bem
 * distribuído, ou tudo cai de manhã?* Quatro trocas de água amontoadas entre 7h e 12h são um
 * problema de operação que se vê no desenho e não se vê numa coluna de texto.
 *
 * ## O que esta tela deliberadamente não faz
 *
 * **Não cadastra refeição nem medicação.** Refeição vem do plano alimentar que o responsável
 * ditou; medicação vem da receita, e o hotel não prescreve. Isso não é uma verificação escondida:
 * o tipo `TarefaDaCasaKind` torna atravessar essa linha um erro de compilação. A frase no rodapé
 * existe porque a ausência calada de duas linhas óbvias lê como defeito.
 *
 * **Não grava enquanto se edita.** Mexer nos horários mexe num rascunho; publicar é um ato
 * separado, com a previsão do que ele faz na casa cheia. Ver `PublicarRotinaDialog`.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import IconeDeTarefa from '@/features/hotel/components/base/IconeDeTarefa.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import ItemDoPadraoDialog from '@/features/hotel/components/rotina-padrao/ItemDoPadraoDialog.vue'
import PublicarRotinaDialog from '@/features/hotel/components/rotina-padrao/PublicarRotinaDialog.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import { amanhaNaCasa, rotinaPadraoRepository } from '@/features/hotel/data/repositories'
import type { ItemDeRotina, RotinaPadrao } from '@/features/hotel/data/types'
import { clockToMinutes } from '@/features/hotel/domain/hotel-time'
import { tarefasPorDia, type PrevisaoDaPublicacao } from '@/features/hotel/domain/rotina-padrao'
import { useHotelStore } from '@/features/hotel/stores/hotel'

const { t } = useI18n()
const formato = useHotelFormat()
const hotelStore = useHotelStore()

/** O que está publicado, e o rascunho em cima dele. */
const publicada = ref<RotinaPadrao | null>(null)
const itens = ref<ItemDeRotina[]>([])

const carregando = ref(true)
const salvando = ref(false)
const erro = ref('')

const emEdicao = ref<ItemDeRotina | null>(null)
const publicarAberto = ref(false)
const vigencia = ref<'amanha' | 'agora'>('amanha')
const previsao = ref<PrevisaoDaPublicacao | null>(null)
const calculando = ref(false)
const tourAberto = ref(false)

/** As marcas de hora da escala. De seis em seis: mais que isso vira uma régua ilegível. */
const ESCALA = [0, 6, 12, 18, 24]

function copiar(origem: ItemDeRotina[]): ItemDeRotina[] {
  return origem.map((item) => ({ ...item, horarios: [...item.horarios] }))
}

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    const atual = await rotinaPadraoRepository.atual()

    publicada.value = atual
    itens.value = copiar(atual.itens)
  } catch {
    erro.value = 'hotel.erros.rotinaPadrao'
  } finally {
    carregando.value = false
  }
}

onMounted(async () => {
  await hotelStore.carregar()
  await carregar()
})

/** Há rascunho por publicar? É o que decide se o botão de publicar existe. */
const sujo = computed(
  () =>
    !!publicada.value &&
    JSON.stringify(itens.value) !== JSON.stringify(publicada.value.itens),
)

const porDia = computed(() => tarefasPorDia(itens.value))

const quemPublicou = computed(() => {
  const id = publicada.value?.publicadaPor

  return hotelStore.cuidadores.find((pessoa) => pessoa.id === id)?.nome ?? ''
})

/** A posição de um horário na faixa de 24 horas, em porcentagem. */
function posicao(hora: string): number {
  return (clockToMinutes(hora) / 1440) * 100
}

function aplicarItem(item: ItemDeRotina) {
  itens.value = itens.value.map((atual) => (atual.id === item.id ? item : atual))
  emEdicao.value = null
}

async function calcularPrevisao() {
  if (!publicada.value) return

  calculando.value = true

  try {
    previsao.value = await rotinaPadraoRepository.previsao({
      itens: itens.value,
      vigenteDesde: vigencia.value === 'agora' ? new Date().toISOString() : amanhaNaCasa(),
    })
  } catch {
    previsao.value = null
  } finally {
    calculando.value = false
  }
}

async function abrirPublicacao() {
  publicarAberto.value = true
  await calcularPrevisao()
}

async function trocarVigencia(valor: 'amanha' | 'agora') {
  vigencia.value = valor
  await calcularPrevisao()
}

async function publicar() {
  salvando.value = true
  erro.value = ''

  try {
    const atual = await rotinaPadraoRepository.publicar({
      itens: itens.value,
      vigenteDesde: vigencia.value === 'agora' ? new Date().toISOString() : amanhaNaCasa(),
      por: hotelStore.operadorAtual(),
    })

    publicada.value = atual
    itens.value = copiar(atual.itens)
    publicarAberto.value = false

    /* A prancheta e o resto do módulo passam a ler o plano novo. */
    hotelStore.invalidarTudo()
  } catch {
    erro.value = 'hotel.erros.acao'
  } finally {
    salvando.value = false
  }
}

async function desfazer() {
  salvando.value = true

  try {
    const atual = await rotinaPadraoRepository.desfazer()

    publicada.value = atual
    itens.value = copiar(atual.itens)
    hotelStore.invalidarTudo()
  } finally {
    salvando.value = false
  }
}

const temDesfazer = computed(() => rotinaPadraoRepository.temDesfazer())

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.rotinaPadrao.pergunta.titulo'),
    texto: t('hotel.tour.rotinaPadrao.pergunta.texto'),
  },
  {
    alvo: '.faixas',
    titulo: t('hotel.tour.rotinaPadrao.regua.titulo'),
    texto: t('hotel.tour.rotinaPadrao.regua.texto'),
  },
  {
    alvo: '.limite',
    titulo: t('hotel.tour.rotinaPadrao.limite.titulo'),
    texto: t('hotel.tour.rotinaPadrao.limite.texto'),
  },
  {
    alvo: '.rodape',
    titulo: t('hotel.tour.rotinaPadrao.publicar.titulo'),
    texto: t('hotel.tour.rotinaPadrao.publicar.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    :title="t('hotel.rotinaPadrao.titulo')"
    :subtitle="t('hotel.rotinaPadrao.subtitulo')"
    measure="60rem"
    tour
    :loading="carregando && !publicada"
    :error="erro && !publicarAberto ? t(erro) : ''"
    :empty="!carregando && itens.length === 0"
    :empty-title="t('hotel.rotinaPadrao.vazioTitulo')"
    :empty-description="t('hotel.rotinaPadrao.vazioDescricao')"
    @tour="tourAberto = true"
    @retry="carregar()"
  >
    <div class="padrao clinic-scope">
      <div class="topo">
<!--
          O número mora **dentro** da frase, e não num `strong` ao lado dela. Separá-los dizia o
          mesmo número duas vezes em português ("8 8 tarefas por hóspede") e, em árabe, brigava com
          a forma plural, que já carrega o numeral por escrito.
        -->
        <p class="topo__conta clinic-value">
          {{ t('hotel.rotinaPadrao.porDia', { total: porDia }, porDia) }}
        </p>

        <p v-if="publicada" class="topo__versao">
          {{
            t('hotel.rotinaPadrao.versao', {
              versao: publicada.versao,
              pessoa: quemPublicou || '—',
            })
          }}
        </p>
      </div>

      <ul class="faixas">
        <!--
          A escala de horas é a **primeira fileira da própria lista**, e não um bloco acima dela.
          Fora da lista ela era outra grade, com outras colunas, e as etiquetas caíam em lugares que
          não correspondiam às marcas: medido, "6h" pousava sobre o início da pista em vez de sobre
          as seis horas. Dentro, as duas partilham a mesma grade e o alinhamento deixa de depender
          de alguém manter dois cálculos iguais.
        -->
        <li class="faixa faixa--escala" aria-hidden="true">
          <span />

          <span class="escala">
            <span
              v-for="hora in ESCALA"
              :key="hora"
              class="escala__marca"
              :style="{ insetInlineStart: `${(hora / 24) * 100}%` }"
            >
              {{ hora }}h
            </span>
          </span>

          <span />
        </li>

        <li v-for="item in itens" :key="item.id" class="faixa" :class="{ 'faixa--off': !item.ativo }">
          <div class="faixa__nome">
            <IconeDeTarefa :kind="item.kind" class="faixa__icone" />
            <span class="faixa__servico">{{ formato.tarefaKind(item.kind) }}</span>
          </div>

          <!--
            A pista de 24 horas. As marcas são posicionadas em porcentagem do dia, com propriedade
            lógica, para que a régua se inverta junto com a página no árabe.
          -->
          <div class="pista">
            <span
              v-for="hora in ESCALA.slice(1, -1)"
              :key="`guia-${hora}`"
              class="pista__guia"
              :style="{ insetInlineStart: `${(hora / 24) * 100}%` }"
              aria-hidden="true"
            />

            <span
              v-for="hora in item.horarios"
              :key="hora"
              class="pista__marca"
              :style="{ insetInlineStart: `${posicao(hora)}%` }"
              :title="hora"
            />

            <span v-if="!item.ativo" class="pista__vazia">
              {{ t('hotel.rotinaPadrao.desligada') }}
            </span>

            <span v-else-if="item.horarios.length === 0" class="pista__vazia">
              {{ t('hotel.rotinaPadrao.semHorario') }}
            </span>
          </div>

          <div class="faixa__fim">
            <span class="faixa__conta">
              {{ t('hotel.rotinaPadrao.horarios', { total: item.horarios.length }, item.horarios.length) }}
            </span>

            <Button
              :label="t('hotel.rotinaPadrao.editar')"
              icon="pi pi-pencil"
              severity="secondary"
              text
              size="small"
              @click="emEdicao = item"
            />
          </div>

          <p v-if="item.exigeAutorizacao" class="faixa__nota">
            {{ t('hotel.rotinaPadrao.exigeAutorizacao') }}
          </p>
        </li>
      </ul>

      <p class="limite">
        <i class="pi pi-lock" aria-hidden="true" />
        {{ t('hotel.rotinaPadrao.naoMexe') }}
      </p>

      <div class="rodape">
        <Button
          v-if="temDesfazer && !sujo"
          :label="t('hotel.rotinaPadrao.desfazer')"
          icon="pi pi-undo"
          severity="secondary"
          text
          size="small"
          :disabled="salvando"
          @click="desfazer"
        />

        <Button
          v-if="sujo"
          class="rodape__publicar"
          :label="t('hotel.rotinaPadrao.publicar')"
          icon="pi pi-send"
          size="small"
          @click="abrirPublicacao"
        />
      </div>
    </div>

    <ItemDoPadraoDialog :item="emEdicao" @fechar="emEdicao = null" @aplicar="aplicarItem" />

    <PublicarRotinaDialog
      :aberto="publicarAberto"
      :vigencia="vigencia"
      :previsao="previsao"
      :calculando="calculando"
      :salvando="salvando"
      :erro="erro ? t(erro) : ''"
      @fechar="publicarAberto = false"
      @atualizar:vigencia="trocarVigencia"
      @publicar="publicar"
    />

    <HotelDevPanel />

    <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
  </PartnerPageFrame>
</template>

<style scoped>
.padrao {
  display: grid;
  gap: var(--clinic-space-4);
}

/* ------------------------------------------------------------------ o topo */

.topo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
}

.topo__conta {
  margin: 0;
  color: var(--clinic-text);
  font-size: var(--clinic-font-value);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.topo__versao {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

/* ------------------------------------------------------------------ a régua */

/*
 * A terceira coluna tem largura **fixa**, e não .
 *
 * Cada fileira é uma grade própria — não há subgrade aqui —, então com  cada uma media a
 * própria coluna de ações pelo próprio conteúdo. A fileira da escala, que tem essa célula vazia,
 * ficava com a coluna em zero e a pista dela nascia mais larga que as outras: medido, a etiqueta
 * "6h" caía sobre as sete horas. Largura fixa faz as quatro fileiras medirem igual.
 */
.faixa {
  display: grid;
  align-items: center;
  gap: var(--clinic-space-3);
  grid-template-columns: 9rem minmax(0, 1fr) 10.5rem;
}

/*
 * A escala ocupa a **mesma célula** que as pistas ocupam nas outras fileiras, e é só isso que
 * garante o alinhamento: "12h" cai sobre a marca do meio-dia porque as duas medem a partir da
 * mesma borda. A versão anterior era um bloco acima da lista, com grade própria, e as etiquetas
 * pousavam sobre o começo da pista — uma régua que mente sobre onde as marcas estão é pior do que
 * régua nenhuma.
 */
.faixa--escala {
  padding-block: var(--clinic-space-2) 0;
}

.escala {
  position: relative;
  display: block;
  height: 1em;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

.escala__marca {
  position: absolute;
  transform: translateX(-50%);
}

/* As pontas não passam da borda da régua: a primeira encosta, a última recua. */
.escala__marca:first-child {
  transform: none;
}

.escala__marca:last-child {
  transform: translateX(-100%);
}

.faixas {
  display: grid;
  margin: 0;
  padding: 0;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  list-style: none;
}

.faixa {
  padding: var(--clinic-space-3) var(--clinic-space-4);
}

.faixa + .faixa:not(.faixa--escala) {
  border-block-start: 1px solid var(--clinic-line-soft);
}

.faixa--off {
  color: var(--clinic-faint);
}

.faixa__nome {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--clinic-space-2);
}

.faixa .faixa__icone {
  width: 1.05rem;
  height: 1.05rem;
  flex: 0 0 auto;
  color: var(--clinic-accent-strong);
}

.faixa--off .faixa__icone {
  color: var(--clinic-faint);
}

.faixa__servico {
  overflow: hidden;
  font-size: var(--clinic-font-value);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * A pista do dia: 24 horas de ponta a ponta.
 *
 * As marcas são posicionadas por `inset-inline-start` em porcentagem — propriedade lógica, para
 * que a régua se inverta junto com a página no árabe sem uma segunda folha de estilo.
 */
.pista {
  position: relative;
  height: 1.6rem;
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-sunken);
}

.pista__guia {
  position: absolute;
  top: 0.35rem;
  bottom: 0.35rem;
  width: 1px;
  background: var(--clinic-line-soft);
}

/* Cada horário cadastrado. O `title` dá a hora exata sem precisar de rótulo em cada marca. */
.pista__marca {
  position: absolute;
  top: 0.3rem;
  bottom: 0.3rem;
  width: 0.34rem;
  border-radius: var(--clinic-radius-chip);
  margin-inline-start: -0.17rem;
  background: var(--clinic-accent-deep);
}

.faixa--off .pista__marca {
  background: var(--clinic-line);
}

.pista__vazia {
  position: absolute;
  inset-inline-start: var(--clinic-space-3);
  top: 50%;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  transform: translateY(-50%);
}

.faixa__fim {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
}

.faixa__conta {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

/* A nota da autorização fica sob a faixa inteira, e não espremida na coluna do nome. */
.faixa__nota {
  margin: 0.15rem 0 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  grid-column: 2 / -1;
}

/* ------------------------------------------------------------------ o limite e o rodapé */

/*
 * A parede, escrita. Refeição e medicação não aparecem na régua, e a ausência calada de duas
 * linhas óbvias lê como defeito — não como a regra que é.
 */
.limite {
  display: flex;
  align-items: flex-start;
  margin: 0;
  gap: var(--clinic-space-2);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.limite .pi {
  margin-block-start: 0.1rem;
  font-size: 0.7rem;
}

.rodape {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
  min-height: 2rem;
}

@media (max-width: 720px) {
  /*
   * No telefone a coluna do nome sai da frente da pista: com 9 rem reservados, a régua de 24 horas
   * ficava com menos de 200 px e as marcas da manhã encostavam umas nas outras.
   */
  .faixa {
    grid-template-columns: minmax(0, 1fr) 10.5rem;
  }

  .pista {
    grid-column: 1 / -1;
  }

  .faixa__nota {
    grid-column: 1 / -1;
  }
}
</style>
