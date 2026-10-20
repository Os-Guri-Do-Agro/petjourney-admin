<script setup lang="ts">
/**
 * Rotina padrão — o que a casa faz por todos os hóspedes, e a que horas.
 *
 * ## De onde isto veio
 *
 * Os horários de água, higiene e passeio eram três constantes dentro de `domain/rotina.ts`, com um
 * comentário dizendo que virariam cadastro quando alguém pedisse para mudá-los. O pedido chegou.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Uma **tabela de linha do tempo**: uma linha por serviço da casa, e um eixo de 24 horas comum a
 * todas. Os horários ficam escritos sobre o eixo, na posição deles — a pergunta "a que horas a
 * casa dá água?" se responde lendo, e a pergunta "o dia está bem distribuído, ou tudo cai de
 * manhã?" se responde olhando. Vale todos os dias: a rotina da casa não tem dia da semana.
 *
 * Embaixo, **quem foge do padrão**: os hóspedes com horário próprio ou sem um serviço, e o motivo.
 * O padrão e as exceções na mesma tela, porque quem muda o padrão precisa saber a quem ele não
 * se aplica.
 *
 * ## O que esta tela deliberadamente não faz
 *
 * **Não cadastra refeição nem medicação.** Refeição vem do plano alimentar que o responsável
 * ditou; medicação vem da receita, e o hotel não prescreve. O tipo `TarefaDaCasaKind` torna
 * atravessar essa linha um erro de compilação; a frase embaixo da tabela existe porque a ausência
 * calada de duas linhas óbvias lê como defeito.
 *
 * **Não grava enquanto se edita.** Mexer nos horários mexe num rascunho; publicar é um ato
 * separado, com a previsão do que ele faz na casa cheia. Ver `PublicarRotinaDialog`.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import IconeDeTarefa from '@/features/hotel/components/base/IconeDeTarefa.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import ItemDoPadraoDialog from '@/features/hotel/components/rotina-padrao/ItemDoPadraoDialog.vue'
import PublicarRotinaDialog from '@/features/hotel/components/rotina-padrao/PublicarRotinaDialog.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import {
  ajustesDoHospede,
  amanhaNaCasa,
  hospedesParaRotina,
  rotinaPadraoRepository,
  type HospedeParaRotina,
} from '@/features/hotel/data/repositories'
import type {
  AjusteDeRotina,
  ItemDeRotina,
  RotinaPadrao,
  TarefaDaCasaKind,
} from '@/features/hotel/data/types'
import { clockToMinutes } from '@/features/hotel/domain/hotel-time'
import {
  escreverHorarios,
  tarefasPorDia,
  type PrevisaoDaPublicacao,
} from '@/features/hotel/domain/rotina-padrao'
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

/** As marcas de hora do eixo, de três em três: o bastante para achar a hora de olho. */
const ESCALA = [0, 3, 6, 9, 12, 15, 18, 21, 24]

/**
 * Abaixo desta distância (em porcentagem do dia, perto de uma hora e quarenta e cinco) dois
 * horários vizinhos não cabem escritos na mesma altura: o segundo desce para baixo da pista, e
 * nenhum rótulo cobre o outro.
 */
const VIZINHO_PERTO = 7.5

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

/**
 * Quem foge do padrão: os ajustes vigentes dos hóspedes da casa.
 *
 * Um ajuste é sempre de um hóspede e de um serviço, e substitui a lista da casa inteira — ou a
 * suspende, que é substituir por nada. Lidos na abertura e a cada publicação.
 */
type Excecao = { hospede: HospedeParaRotina; ajuste: AjusteDeRotina }

const excecoes = ref<Excecao[]>([])

function carregarExcecoes() {
  excecoes.value = hospedesParaRotina()
    .filter((hospede) => hospede.ajustes > 0)
    .flatMap((hospede) =>
      ajustesDoHospede(hospede.hospedagemId).map((ajuste) => ({ hospede, ajuste })),
    )
}

onMounted(async () => {
  await hotelStore.carregar()
  await carregar()
  carregarExcecoes()
})

/** Há rascunho por publicar? É o que decide se o botão de publicar existe. */
const sujo = computed(
  () => !!publicada.value && JSON.stringify(itens.value) !== JSON.stringify(publicada.value.itens),
)

const porDia = computed(() => tarefasPorDia(itens.value))

const quemPublicou = computed(() => {
  const id = publicada.value?.publicadaPor

  return hotelStore.cuidadores.find((pessoa) => pessoa.id === id)?.nome ?? ''
})

/** De quem é o plano em vigor: a versão e quem a publicou. */
const fraseDaVersao = computed(() => {
  if (!publicada.value) return ''

  return quemPublicou.value
    ? t('hotel.rotinaPadrao.nova.versao', {
        versao: publicada.value.versao,
        pessoa: quemPublicou.value,
      })
    : t('hotel.rotinaPadrao.nova.versaoSemPessoa', { versao: publicada.value.versao })
})

/** A posição de um horário na faixa de 24 horas, em porcentagem. */
function posicao(hora: string): number {
  return (clockToMinutes(hora) / 1440) * 100
}

/**
 * Os horários de um serviço como marcas no eixo, cada uma com a sua altura: em cima da pista, ou
 * embaixo quando o horário anterior está perto demais para os dois rótulos caberem lado a lado.
 */
function marcasDe(item: ItemDeRotina) {
  let ultimaEmCima = -Infinity

  return (item.ativo ? item.horarios : []).map((hora) => {
    const x = posicao(hora)
    const embaixo = x - ultimaEmCima < VIZINHO_PERTO

    if (!embaixo) ultimaEmCima = x

    return { hora, x, embaixo }
  })
}

function excecoesDe(kind: TarefaDaCasaKind) {
  return excecoes.value.filter((excecao) => excecao.ajuste.kind === kind)
}

function suspende(ajuste: AjusteDeRotina) {
  return ajuste.acao === 'suspende' || ajuste.horarios.length === 0
}

/** O que muda para aquele hóspede: os horários dele, ou que ele não tem o serviço. */
function oQueMuda(ajuste: AjusteDeRotina) {
  return suspende(ajuste)
    ? t('hotel.rotinaPadrao.nova.suspenso')
    : escreverHorarios(ajuste.horarios)
}

function aplicarItem(item: ItemDeRotina) {
  itens.value = itens.value.map((atual) => (atual.id === item.id ? item : atual))
  emEdicao.value = null
}

/** Descarta o rascunho: os itens voltam a ser os publicados, sem gravar nada. */
function descartarRascunho() {
  if (publicada.value) itens.value = copiar(publicada.value.itens)
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
    carregarExcecoes()
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

/*
 * Lê `publicada` antes de perguntar ao repositório: sem uma dependência reativa o `computed`
 * guardava a primeira resposta para sempre, e o "Desfazer" não aparecia depois de publicar.
 */
const temDesfazer = computed(() => !!publicada.value && rotinaPadraoRepository.temDesfazer())

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.rotinaPadrao.pergunta.titulo'),
    texto: t('hotel.tour.rotinaPadrao.pergunta.texto'),
  },
  {
    alvo: '.grade-da-casa',
    titulo: t('hotel.tour.rotinaPadrao.regua.titulo'),
    texto: t('hotel.tour.rotinaPadrao.regua.texto'),
  },
  {
    alvo: '.limite',
    titulo: t('hotel.tour.rotinaPadrao.limite.titulo'),
    texto: t('hotel.tour.rotinaPadrao.limite.texto'),
  },
  {
    alvo: '.fora-do-padrao',
    titulo: t('hotel.rotinaPadrao.nova.tour.excecoes.titulo'),
    texto: t('hotel.rotinaPadrao.nova.tour.excecoes.texto'),
  },
  {
    alvo: '.plano-estado',
    titulo: t('hotel.tour.rotinaPadrao.publicar.titulo'),
    texto: t('hotel.tour.rotinaPadrao.publicar.texto'),
  },
])
</script>

<template>
  <UiPagina
    :carregando="carregando && !publicada"
    :erro="erro && !publicarAberto ? t(erro) : ''"
    :vazio="!carregando && itens.length === 0"
    :vazio-titulo="t('hotel.rotinaPadrao.vazioTitulo')"
    :vazio-descricao="t('hotel.rotinaPadrao.vazioDescricao')"
    vazio-icone="ph ph-clock-clockwise"
    tour
    @tour="tourAberto = true"
    @tentar-de-novo="carregar()"
  >
    <template #resumo>
      <span class="plano-estado">
        <!-- O número mora dentro da frase: separado, ele se repetia ("8 8 tarefas"). -->
        {{ t('hotel.rotinaPadrao.porDia', { total: porDia }, porDia) }}{{ '. ' }}
        <template v-if="fraseDaVersao">{{ fraseDaVersao }}{{ ' ' }}</template>
        <span v-if="sujo" class="ui-selo ui-selo--atencao plano-estado__rascunho">
          <i class="ph ph-pencil-simple" aria-hidden="true" />
          {{ t('hotel.rotinaPadrao.rascunho') }}
        </span>
      </span>
    </template>

    <!--
      Publicar é a ação cheia, e só existe quando há o que publicar. Sem rascunho, a única ação é
      desfazer a última publicação — contornada, porque mexe na casa inteira.
    -->
    <template #acoes>
      <Button
        v-if="sujo"
        type="button"
        :label="t('hotel.rotinaPadrao.nova.descartar')"
        severity="secondary"
        text
        :disabled="salvando"
        @click="descartarRascunho"
      />
      <Button
        v-if="sujo"
        type="button"
        :label="t('hotel.rotinaPadrao.publicar')"
        icon="ph ph-paper-plane-tilt"
        @click="abrirPublicacao"
      />
      <Button
        v-else-if="temDesfazer"
        type="button"
        :label="t('hotel.rotinaPadrao.desfazer')"
        icon="ph ph-arrow-counter-clockwise"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="desfazer"
      />
    </template>

    <div class="padrao">
      <UiSecao
        id="padrao-horarios"
        :titulo="t('hotel.rotinaPadrao.nova.horariosDaCasa')"
        :descricao="t('hotel.rotinaPadrao.nova.todosOsDias')"
        icone="ph ph-clock"
      >
        <div class="grade-da-casa ui-folha">
          <!-- O eixo do dia, comum a todas as linhas. -->
          <div class="grade__cabeca" aria-hidden="true">
            <span class="grade__rotulo">{{ t('hotel.rotinaPadrao.nova.servico') }}</span>
            <span class="grade__eixo">
              <span
                v-for="hora in ESCALA"
                :key="hora"
                class="grade__marca-hora ui-num"
                :style="{ insetInlineStart: `${(hora / 24) * 100}%` }"
              >
                {{ String(hora).padStart(2, '0') }}
              </span>
            </span>
            <span />
          </div>

          <ul class="grade__linhas">
            <li
              v-for="item in itens"
              :key="item.id"
              class="servico"
              :class="{ 'servico--off': !item.ativo }"
            >
              <div class="servico__quem">
                <span class="servico__icone" aria-hidden="true">
                  <IconeDeTarefa :kind="item.kind" />
                </span>
                <span class="servico__texto">
                  <strong>{{ formato.tarefaKind(item.kind) }}</strong>
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
                  <span v-if="excecoesDe(item.kind).length > 0" class="servico__fora">
                    <i class="ph ph-shuffle" aria-hidden="true" />
                    {{
                      t(
                        'hotel.rotinaPadrao.nova.foraDoPadrao',
                        { total: excecoesDe(item.kind).length },
                        excecoesDe(item.kind).length,
                      )
                    }}
                  </span>
                </span>
              </div>

              <!--
                O dia do serviço: a pista de 24 horas com cada horário escrito no lugar dele. As
                marcas usam propriedade lógica, para a pista se inverter com a página no árabe.
              -->
              <div class="servico__dia">
                <div class="pista" :class="{ 'pista--vazia': marcasDe(item).length === 0 }">
                  <span
                    v-for="hora in ESCALA.slice(1, -1)"
                    :key="`guia-${hora}`"
                    class="pista__guia"
                    :style="{ insetInlineStart: `${(hora / 24) * 100}%` }"
                    aria-hidden="true"
                  />
                  <span
                    v-for="marca in marcasDe(item)"
                    :key="marca.hora"
                    class="pista__marca"
                    :class="{ 'pista__marca--embaixo': marca.embaixo }"
                    :style="{ insetInlineStart: `${marca.x}%` }"
                  >
                    <span class="pista__ponto" aria-hidden="true" />
                    <span class="pista__hora ui-hora">{{ marca.hora }}</span>
                  </span>
                </div>

                <p v-if="!item.ativo" class="servico__vazio">
                  {{ t('hotel.rotinaPadrao.desligadaDica') }}
                </p>
                <p v-else-if="item.horarios.length === 0" class="servico__vazio">
                  {{ t('hotel.rotinaPadrao.semHorarioDica') }}
                </p>
                <p v-if="item.exigeAutorizacao && item.ativo" class="servico__nota">
                  <i class="ph ph-shield-check" aria-hidden="true" />
                  {{ t('hotel.rotinaPadrao.exigeAutorizacao') }}
                </p>
              </div>

              <div class="servico__acao">
                <Button
                  type="button"
                  :label="t('hotel.rotinaPadrao.editar')"
                  icon="ph ph-pencil-simple"
                  severity="secondary"
                  outlined
                  size="small"
                  :title="
                    t('hotel.rotinaPadrao.editarTitulo', { servico: formato.tarefaKind(item.kind) })
                  "
                  @click="emEdicao = item"
                />
              </div>
            </li>
          </ul>
        </div>

        <p class="limite">
          <i class="ph ph-lock-simple" aria-hidden="true" />
          {{ t('hotel.rotinaPadrao.naoMexe') }}
        </p>
      </UiSecao>

      <!-- ------------------------------------------------------------ quem foge do padrão -->
      <UiSecao
        id="padrao-excecoes"
        class="fora-do-padrao"
        :titulo="t('hotel.rotinaPadrao.nova.excecoes')"
        :descricao="t('hotel.rotinaPadrao.nova.excecoesDescricao')"
        :contagem="excecoes.length"
        icone="ph ph-shuffle"
      >
        <ul v-if="excecoes.length > 0" class="ui-folha ui-lista excecoes">
          <li v-for="excecao in excecoes" :key="excecao.ajuste.id" class="excecao">
            <PetAvatar
              :nome="excecao.hospede.petNome"
              :iniciais="excecao.hospede.petIniciais"
              :especie="excecao.hospede.petEspecie"
              :foto-url="excecao.hospede.petFotoUrl"
              tamanho="md"
            />
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ excecao.hospede.petNome }}</strong>
              <span class="ui-linha__meta">
                {{ excecao.hospede.acomodacaoNome }} · {{ excecao.ajuste.motivo }}
              </span>
            </span>
            <span class="excecao__servico">
              <IconeDeTarefa :kind="excecao.ajuste.kind" class="excecao__icone" />
              {{ formato.tarefaKind(excecao.ajuste.kind) }}
            </span>
            <span
              class="excecao__muda"
              :class="{ 'excecao__muda--suspenso': suspende(excecao.ajuste) }"
            >
              {{ oQueMuda(excecao.ajuste) }}
            </span>
          </li>
        </ul>

        <div v-else class="ui-folha ui-vazio excecoes__vazio">
          <strong>{{ t('hotel.rotinaPadrao.nova.semExcecoes') }}</strong>
          <span>{{ t('hotel.rotinaPadrao.nova.semExcecoesDica') }}</span>
          <RouterLink class="ui-mais" to="/hotel/rotina">
            {{ t('hotel.rotinaPadrao.nova.irParaRotina') }}
            <i class="ph ph-arrow-right ui-mais__seta" aria-hidden="true" />
          </RouterLink>
        </div>
      </UiSecao>
    </div>

    <template #sempre>
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
    </template>
  </UiPagina>
</template>

<style scoped>
.padrao {
  display: grid;
  gap: 36px;
}

.plano-estado__rascunho {
  margin-inline-start: 4px;
  vertical-align: 1px;
}

/* ------------------------------------------------------------------ a tabela do dia */

/*
 * Três colunas: o serviço, o dia dele, e a ação. A coluna do dia é a única elástica, e o eixo do
 * cabeçalho usa exatamente a mesma, para cada horário cair embaixo da hora certa.
 */
.grade-da-casa {
  --col-servico: 210px;
  --col-acao: 100px;

  display: grid;
  overflow: hidden;
  container-type: inline-size;
}

.grade__cabeca,
.servico {
  display: grid;
  column-gap: 28px;
  grid-template-columns: var(--col-servico) minmax(0, 1fr) var(--col-acao);
}

.grade__cabeca {
  align-items: end;
  padding: 12px 20px 10px;
  border-bottom: 1px solid var(--linha);
  background: var(--superficie-2);
}

.grade__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.grade__eixo {
  position: relative;
  height: 18px;
}

.grade__marca-hora {
  position: absolute;
  bottom: 0;
  color: var(--tinta-2);
  font-size: 12px;
  transform: translateX(-50%);
}

[dir='rtl'] .grade__marca-hora {
  transform: translateX(50%);
}

.grade__linhas {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.servico {
  align-items: center;
  min-height: 96px;
  padding: 14px 20px;
}

.servico + .servico {
  border-top: 1px solid var(--linha);
}

.servico__quem {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.servico__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
  font-size: 15px;
}

.servico__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.servico__texto strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.servico__conta {
  color: var(--tinta-2);
  font-size: 13px;
}

.servico__fora {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--atencao-tinta);
  font-size: 13px;
  font-weight: 550;
}

/* Desligada não é erro: é uma decisão da casa. Fica recolhida, não riscada nem em vermelho. */
.servico--off .servico__icone {
  background: var(--superficie-2);
  color: var(--tinta-3);
}

.servico--off .servico__texto strong {
  color: var(--tinta-2);
}

.servico__dia {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.servico__acao {
  display: flex;
  justify-content: flex-end;
}

/* ------------------------------------------------------------------ a pista */

/*
 * A pista do dia: um trilho fino de 24 horas, as guias de três em três, e cada horário como um
 * ponto com a hora escrita em cima — ou embaixo, quando o vizinho está perto demais.
 */
.pista {
  position: relative;
  height: 60px;
}

.pista::before {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  height: 4px;
  margin-top: -2px;
  border-radius: 999px;
  background: var(--superficie-3);
  content: '';
}

.pista--vazia {
  height: 24px;
}

.servico--off .pista::before {
  height: 0;
  border-top: 2px dashed var(--linha-forte);
  background: transparent;
}

.pista__guia {
  position: absolute;
  top: calc(50% - 7px);
  width: 1px;
  height: 14px;
  background: var(--linha-forte);
  opacity: 0.6;
}

.pista__marca {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
}

.pista__ponto {
  position: absolute;
  top: 50%;
  left: 0;
  width: 14px;
  height: 14px;
  border: 3px solid var(--superficie);
  border-radius: 50%;
  background: var(--hotel);
  box-shadow: 0 0 0 1px var(--hotel);
  transform: translate(-50%, -50%);
}

.pista__hora {
  position: absolute;
  top: 0;
  left: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 18px;
  white-space: nowrap;
  transform: translateX(-50%);
}

.pista__marca--embaixo .pista__hora {
  top: auto;
  bottom: 0;
}

[dir='rtl'] .pista__ponto,
[dir='rtl'] .pista__hora {
  right: 0;
  left: auto;
}

[dir='rtl'] .pista__ponto {
  transform: translate(50%, -50%);
}

[dir='rtl'] .pista__hora {
  transform: translateX(50%);
}

.servico__vazio,
.servico__nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.servico__nota {
  display: flex;
  align-items: center;
  gap: 6px;
}

.servico__nota i {
  color: var(--hotel-tinta);
  font-size: 15px;
}

/* ------------------------------------------------------------------ o limite */

.limite {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 2px 0 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.limite i {
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 16px;
}

/* ------------------------------------------------------------------ fora do padrão */

.excecao {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 64px;
  padding: 10px 18px;
}

.excecao__servico {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.excecao__icone {
  width: 18px;
  height: 18px;
}

.excecao__muda {
  flex: none;
  min-width: 96px;
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  text-align: end;
}

.excecao__muda--suspenso {
  color: var(--atencao-tinta);
  font-family: var(--font-texto);
}

.excecoes__vazio {
  gap: 6px;
}

.ui-mais__seta {
  font-size: 13px;
}

[dir='rtl'] .ui-mais__seta {
  scale: -1 1;
}

/*
 * Estreita, a tabela vira uma lista: o serviço e a ação em cima, a pista inteira embaixo. O eixo
 * do cabeçalho some — com a pista sozinha na largura, a hora escrita em cada ponto basta.
 */
@container (max-width: 760px) {
  .grade__cabeca {
    display: none;
  }

  .servico {
    gap: 10px 12px;
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 14px 16px;
  }

  .servico__dia {
    grid-column: 1 / -1;
    grid-row: 2;
    padding-inline: 14px;
  }
}

@media (max-width: 640px) {
  .excecao {
    flex-wrap: wrap;
  }

  .excecao__muda {
    min-width: 0;
    text-align: start;
  }
}
</style>
