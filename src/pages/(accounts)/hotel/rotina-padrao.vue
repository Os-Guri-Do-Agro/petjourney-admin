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
import { PhListChecks } from '@phosphor-icons/vue'
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
    alvo: '.servicos',
    titulo: t('hotel.tour.rotinaPadrao.regua.titulo'),
    texto: t('hotel.tour.rotinaPadrao.regua.texto'),
  },
  {
    alvo: '.limite',
    titulo: t('hotel.tour.rotinaPadrao.limite.titulo'),
    texto: t('hotel.tour.rotinaPadrao.limite.texto'),
  },
  {
    alvo: '.topo',
    titulo: t('hotel.tour.rotinaPadrao.publicar.titulo'),
    texto: t('hotel.tour.rotinaPadrao.publicar.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :title="t('hotel.rotinaPadrao.titulo')"
    :subtitle="t('hotel.rotinaPadrao.subtitulo')"
    measure="72rem"
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
      <!--
        O cabeçalho diz de uma vez o tamanho do plano e de quem ele é.

        Antes era uma tira fina com a contagem de um lado e a versão do outro, do tamanho da letra
        do resto — informação de cabeçalho com peso de rodapé.
      -->
      <header class="topo">
        <span class="topo__marca"><PhListChecks weight="duotone" aria-hidden="true" /></span>

        <div class="topo__texto">
          <!--
            O número mora **dentro** da frase, e não num `strong` ao lado dela. Separá-los dizia o
            mesmo número duas vezes em português ("8 8 tarefas por hóspede") e, em árabe, brigava
            com a forma plural, que já carrega o numeral por escrito.
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

        <span v-if="sujo" class="topo__rascunho">
          <i class="ph ph-pencil-simple" aria-hidden="true" />
          {{ t('hotel.rotinaPadrao.rascunho') }}
        </span>
      </header>

      <!--
        Um cartão por serviço, e os horários **escritos**.

        A versão anterior guardava os horários só como marcas de três pixels numa régua sem rótulo:
        a pergunta que traz alguém a esta tela — *a que horas a casa dá água?* — não tinha resposta
        sem abrir o diálogo de edição. "4 horários" diz quantos e nunca quais.

        A régua continua, porque a leitura que ela dá é real e uma lista não dá: *o dia está bem
        distribuído, ou tudo cai de manhã?* Mas ela virou o rodapé do cartão, e não o conteúdo dele.
      -->
      <ul class="servicos">
        <li
          v-for="item in itens"
          :key="item.id"
          class="servico"
          :class="{ 'servico--off': !item.ativo }"
        >
          <header class="servico__cabeca">
            <span class="servico__marca">
              <IconeDeTarefa :kind="item.kind" />
            </span>

            <div class="servico__texto">
              <strong class="servico__nome">{{ formato.tarefaKind(item.kind) }}</strong>
              <span class="servico__conta">
                <template v-if="!item.ativo">{{ t('hotel.rotinaPadrao.desligada') }}</template>
                <template v-else-if="item.horarios.length === 0">
                  {{ t('hotel.rotinaPadrao.semHorario') }}
                </template>
                <template v-else>
                  {{
                    t(
                      'hotel.rotinaPadrao.horarios',
                      { total: item.horarios.length },
                      item.horarios.length,
                    )
                  }}
                </template>
              </span>
            </div>

            <Button
              :label="t('hotel.rotinaPadrao.editar')"
              icon="ph ph-pencil-simple"
              severity="secondary"
              outlined
              size="small"
              @click="emEdicao = item"
            />
          </header>

          <!-- O conteúdo: as horas, por extenso e em tabular. -->
          <p v-if="item.ativo && item.horarios.length > 0" class="horas">
            <span v-for="hora in item.horarios" :key="hora" class="hora clinic-value">
              {{ hora }}
            </span>
          </p>

          <p v-else class="servico__vazio">
            {{
              item.ativo
                ? t('hotel.rotinaPadrao.semHorarioDica')
                : t('hotel.rotinaPadrao.desligadaDica')
            }}
          </p>

          <!--
            A régua do dia, agora como rodapé. As marcas são posicionadas em porcentagem do dia,
            com propriedade lógica, para que ela se inverta junto com a página no árabe.
          -->
          <div class="regua">
            <div class="pista">
              <span
                v-for="hora in ESCALA.slice(1, -1)"
                :key="`guia-${hora}`"
                class="pista__guia"
                :style="{ insetInlineStart: `${(hora / 24) * 100}%` }"
                aria-hidden="true"
              />

              <span
                v-for="hora in item.ativo ? item.horarios : []"
                :key="hora"
                class="pista__marca"
                :style="{ insetInlineStart: `${posicao(hora)}%` }"
                :title="hora"
              />
            </div>

            <div class="escala" aria-hidden="true">
              <span
                v-for="hora in ESCALA"
                :key="hora"
                class="escala__marca"
                :style="{ insetInlineStart: `${(hora / 24) * 100}%` }"
              >
                {{ hora }}h
              </span>
            </div>
          </div>

          <p v-if="item.exigeAutorizacao" class="servico__nota">
            <i class="ph ph-shield" aria-hidden="true" />
            {{ t('hotel.rotinaPadrao.exigeAutorizacao') }}
          </p>
        </li>
      </ul>

      <p class="limite">
        <i class="ph ph-lock" aria-hidden="true" />
        {{ t('hotel.rotinaPadrao.naoMexe') }}
      </p>

      <div v-if="temDesfazer || sujo" class="rodape">
        <Button
          v-if="temDesfazer && !sujo"
          :label="t('hotel.rotinaPadrao.desfazer')"
          icon="ph ph-arrow-u-up-left"
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
          icon="ph ph-paper-plane-tilt"
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
  align-items: center;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.topo__marca {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.8rem;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.topo__marca :deep(svg) {
  width: 1.4rem;
  height: 1.4rem;
}

.topo__texto {
  display: grid;
  min-width: 0;
  flex: 1 1 14rem;
  gap: 0.1rem;
}

.topo__conta {
  margin: 0;
  color: var(--clinic-text);
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.topo__versao {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

/* O rascunho por publicar precisa ser dito antes de alguém sair da tela achando que gravou. */
.topo__rascunho {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.6rem;
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-chip);
  gap: 0.3rem;
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

/* --------------------------------------------------------------- serviços */

/*
 * Teto de duas colunas, e não `auto-fill`.
 *
 * A casa tem quatro serviços no plano — água, higiene, passeio, pesagem —, e num teto de três
 * sobrava sempre um cartão sozinho na segunda fileira. Duas colunas fecham 2 + 2, e dão a cada
 * cartão largura suficiente para a régua de 24 horas ser lida sem apertar as etiquetas.
 */
.servicos {
  display: grid;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-3);
  grid-template-columns: minmax(0, 1fr);
  list-style: none;
}

@media (min-width: 60rem) {
  .servicos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.servico {
  display: grid;
  align-content: start;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

/*
 * Desligada não é erro: é uma decisão da casa. Fica recolhida — superfície afundada e tinta
 * apagada —, e não riscada nem em vermelho.
 */
.servico--off {
  border-style: dashed;
  background: var(--clinic-surface-soft);
}

.servico__cabeca {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-3);
}

.servico__marca {
  display: grid;
  width: 2.3rem;
  height: 2.3rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  background: var(--clinic-surface-soft);
  color: var(--clinic-accent-strong);
}

.servico--off .servico__marca {
  background: var(--clinic-surface);
  color: var(--clinic-faint);
}

.servico__marca :deep(svg) {
  width: 1.2rem;
  height: 1.2rem;
}

.servico__texto {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0;
}

.servico__nome {
  font-size: var(--clinic-font-value);
  font-weight: 800;
  letter-spacing: -0.01em;
}

.servico__conta {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ horas */

/*
 * As horas, que são o conteúdo desta tela.
 *
 * Tabular porque são uma coluna de números que se compara na vertical entre cartões: dígito que
 * dança na horizontal obriga a reler, e reler horário é onde o erro entra.
 */
.horas {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  gap: var(--clinic-space-2);
}

.hora {
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--clinic-accent-soft);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-value);
  font-variant-numeric: tabular-nums;
  font-weight: 750;
}

.servico__vazio {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ régua */

/*
 * A régua responde o que a lista de horas não responde: *o dia está bem distribuído, ou tudo cai
 * de manhã?* Quatro trocas de água amontoadas entre 7h e 12h são um problema de operação que se vê
 * no desenho e some numa coluna de texto.
 *
 * Por isso ela ficou — mas como **rodapé** do cartão, e não como o conteúdo dele. Sozinha, ela
 * escondia os horários que existia para resumir.
 */
.regua {
  display: grid;
  gap: 0.25rem;
}

.pista {
  position: relative;
  height: 0.5rem;
  border-radius: 999px;
  background: var(--clinic-surface-sunken);
}

.servico--off .pista {
  background: var(--clinic-surface);
}

.pista__guia {
  position: absolute;
  inset-block: 0;
  width: 1px;
  background: var(--clinic-surface);
}

.pista__marca {
  position: absolute;
  inset-block: -0.15rem;
  width: 0.28rem;
  border-radius: 999px;
  background: var(--clinic-accent-deep);
  transform: translateX(-50%);
}

/* Em árabe a régua inverte, e a marca precisa recuar para o outro lado do próprio centro. */
[dir='rtl'] .pista__marca {
  transform: translateX(50%);
}

.escala {
  position: relative;
  height: 1em;
  color: var(--clinic-faint);
  font-size: 0.65rem;
  font-variant-numeric: tabular-nums;
}

.escala__marca {
  position: absolute;
  transform: translateX(-50%);
}

[dir='rtl'] .escala__marca {
  transform: translateX(50%);
}

/* As pontas não passam da borda da régua: a primeira encosta, a última recua. */
.escala__marca:first-child {
  transform: none;
}

.escala__marca:last-child {
  transform: translateX(-100%);
}

[dir='rtl'] .escala__marca:first-child {
  transform: none;
}

[dir='rtl'] .escala__marca:last-child {
  transform: translateX(100%);
}

/* ------------------------------------------------------------------ notas */

.servico__nota {
  display: flex;
  align-items: center;
  margin: 0;
  padding-block-start: var(--clinic-space-2);
  border-block-start: 1px solid var(--clinic-line-soft);
  gap: 0.35rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.servico__nota .ph {
  color: var(--clinic-faint);
  font-size: 0.75rem;
}

/*
 * A fronteira do que esta tela não cadastra.
 *
 * Refeição vem do plano alimentar que o responsável ditou; medicação vem da receita, e o hotel não
 * prescreve. A frase existe porque a ausência calada de duas linhas óbvias lê como defeito.
 */
.limite {
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.limite .ph {
  color: var(--clinic-faint);
}

.rodape {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
}
</style>
