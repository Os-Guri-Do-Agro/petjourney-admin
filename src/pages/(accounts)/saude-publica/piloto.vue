<script setup lang="ts">
/**
 * Saúde pública › Piloto com a Subea (protótipo, Ofício 002/2026, 17/11/2026): 60 dias num bairro
 * atendido pelo Consultório Móvel. No atendimento, a equipe entrega ao tutor um QR Code que abre a
 * ficha do animal no celular; o tutor recebe os avisos e confirma com um toque; a Subea vê aqui
 * quantos abriram a ficha, quantos voltaram no prazo e as metas do anexo do ofício.
 *
 * Três caixas: como funciona (as quatro etapas do anexo), as metas com o andamento dos 60 dias, e
 * os atendimentos com o que aconteceu depois de cada um. "Registrar atendimento" abre a gaveta do
 * balcão, com o QR e a ficha no celular, e ao concluir abre o atendimento novo.
 *
 * Tudo responde (17/11, "a interação está simples demais"): o atendimento abre a ficha no celular,
 * onde quem apresenta faz o papel do tutor; a meta abre quem falta e o lembrete para eles. O que o
 * tutor faz muda as metas na hora: a barra anda e a linha brilha.
 */
import Button from 'primevue/button'
import { computed, nextTick, ref, watch } from 'vue'

import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiPassos, { type PassoDoGuia } from '@/components/ui/UiPassos.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import AtendimentoDoPilotoGaveta from '@/features/saude-publica/components/AtendimentoDoPilotoGaveta.vue'
import AvisoDoPrototipo from '@/features/saude-publica/components/AvisoDoPrototipo.vue'
import MetaDoPilotoGaveta from '@/features/saude-publica/components/MetaDoPilotoGaveta.vue'
import RegistrarAtendimentoGaveta from '@/features/saude-publica/components/RegistrarAtendimentoGaveta.vue'
import {
  ATENDIMENTOS_DO_PILOTO,
  dataCurta,
  diaDoPiloto,
  numero,
  PILOTO,
  procedimento,
  proximosCuidados,
  type AtendimentoDoPiloto,
  type MetaDoPiloto,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo, useMetasDoPiloto } from '@/features/saude-publica/estado'

const { atendimentos } = useEstadoDoPrototipo()

const dia = diaDoPiloto()
const andamento = Math.round((dia / PILOTO.dias) * 100)

/** Os do período mais os registrados na apresentação. */
const total = computed(
  () => PILOTO.atendimentos + atendimentos.value.length - ATENDIMENTOS_DO_PILOTO.length,
)

const resumo = computed(
  () =>
    `Consultório Móvel no ${PILOTO.bairro} · dia ${dia} de ${PILOTO.dias} · ${numero(total.value)} atendimentos`,
)

const aviso = `Dados ilustrativos: simulação do piloto de 60 dias (${dataCurta(PILOTO.inicio)} a ${dataCurta(PILOTO.fim)}) num bairro de exemplo; a Subea escolhe o bairro. As metas são as do Ofício 002/2026. Nenhum tutor é identificado.`

const PASSOS: PassoDoGuia[] = [
  {
    id: 'qr',
    icone: 'ph ph-qr-code',
    titulo: 'QR Code no atendimento',
    texto: 'A equipe registra o que fez, em cerca de 1 minuto, e entrega o QR impresso ao tutor.',
  },
  {
    id: 'ficha',
    icone: 'ph ph-device-mobile',
    titulo: 'A ficha no celular',
    texto: 'O QR abre o que foi feito e as datas dos próximos cuidados, sem app nem senha.',
  },
  {
    id: 'avisos',
    icone: 'ph ph-bell-ringing',
    titulo: 'Avisos e um toque',
    texto: 'O tutor recebe os avisos de retorno, vacina e coleira, e confirma quando cumprir.',
  },
  {
    id: 'painel',
    icone: 'ph ph-chart-bar',
    titulo: 'O painel da Subea',
    texto: 'Quem abriu a ficha, quem voltou no prazo e as metas, sem identificar ninguém.',
  },
]

const metas = useMetasDoPiloto()
const atingidas = computed(() => metas.value.filter((meta) => meta.atingida).length)

/* A meta que acabou de mudar brilha por um instante: o olho vai para onde o toque teve efeito. */
const mudou = ref<string[]>([])
let anteriores = new Map(metas.value.map((meta) => [meta.id, `${meta.feitos}/${meta.base}`]))
let apagar = 0

watch(metas, (lista) => {
  const ids = lista
    .filter((meta) => anteriores.get(meta.id) !== `${meta.feitos}/${meta.base}`)
    .map((meta) => meta.id)
  anteriores = new Map(lista.map((meta) => [meta.id, `${meta.feitos}/${meta.base}`]))
  if (!ids.length) return
  mudou.value = ids
  /* Com a gaveta aberta, a meta pode estar fora da vista: a tela rola até ela. */
  void nextTick(() =>
    document.querySelector('.pl-meta--mudou')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    }),
  )
  window.clearTimeout(apagar)
  apagar = window.setTimeout(() => {
    mudou.value = []
  }, 2600)
})

/** O que aconteceu depois do atendimento, com o cuidado mais perto. */
function depois(atendimento: AtendimentoDoPiloto) {
  const cuidado = proximosCuidados(atendimento.data, atendimento.procedimentos)[0]
  const quando = cuidado ? `${cuidado.rotulo} em ${dataCurta(cuidado.data)}` : ''

  switch (atendimento.situacao) {
    case 'cumpriu':
      return { selo: 'Voltou no prazo', classe: 'ui-selo--ok', icone: 'ph ph-check', frase: quando }
    case 'atrasado':
      return {
        selo: 'Passou da data',
        classe: 'ui-selo--atencao',
        icone: 'ph ph-clock-countdown',
        frase: cuidado ? `${cuidado.rotulo} era em ${dataCurta(cuidado.data)}` : '',
      }
    case 'abriu':
      return { selo: 'Abriu a ficha', classe: 'ui-selo--lugar', icone: 'ph ph-eye', frase: quando }
    default:
      return { selo: 'Não abriu a ficha', classe: '', icone: 'ph ph-eye-slash', frase: quando }
  }
}

/* --------------------------------------------------------------------------- as gavetas */

/* Uma gaveta por vez: abrir uma fecha a outra, para não empilharem do lado da tela. */
const gavetaAberta = ref(false)
const atendimentoAberto = ref<string | null>(null)
const atendimentoVisivel = ref(false)
const metaAberta = ref<MetaDoPiloto['id'] | null>(null)
const metaVisivel = ref(false)

function abrirAtendimento(id: string) {
  metaVisivel.value = false
  gavetaAberta.value = false
  atendimentoAberto.value = id
  atendimentoVisivel.value = true
}

function abrirMeta(id: MetaDoPiloto['id']) {
  atendimentoVisivel.value = false
  gavetaAberta.value = false
  metaAberta.value = id
  metaVisivel.value = true
}

function registrar() {
  atendimentoVisivel.value = false
  metaVisivel.value = false
  gavetaAberta.value = true
}

/* O atendimento recém-registrado abre depois que a gaveta do registro termina de sair. */
function aoRegistrar(id: string) {
  window.setTimeout(() => abrirAtendimento(id), 320)
}
</script>

<template>
  <UiPagina titulo="Piloto com a Subea" icone="ph ph-van" :resumo="resumo">
    <template #acoes>
      <Button type="button" icon="ph ph-qr-code" label="Registrar atendimento" @click="registrar" />
    </template>

    <div class="pl">
      <AvisoDoPrototipo :texto="aviso" />

      <section class="ui-folha ui-cartao pl-caixa" aria-labelledby="pl-como">
        <header class="ui-cartao__cabeca pl-cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-path" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="pl-como" class="ui-cartao__titulo">Como funciona</h2>
            <p class="ui-cartao__descricao">
              O que o Ofício 002/2026 propõe à Subea: sem custo para o Município, sem integração com
              os sistemas da Prefeitura e sem compra de equipamento.
            </p>
          </span>
        </header>
        <UiPassos :passos="PASSOS" />
      </section>

      <section class="ui-folha ui-cartao pl-caixa" aria-labelledby="pl-metas">
        <header class="ui-cartao__cabeca pl-cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-target" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="pl-metas" class="ui-cartao__titulo">
              Metas do piloto
              <span class="ui-contagem">{{ atingidas }} de {{ metas.length }}</span>
            </h2>
            <p class="ui-cartao__descricao">
              As do ofício, uma sugestão inicial a ajustar com a Subea. No prazo, só conta quem já
              chegou na data.
            </p>
          </span>
          <!-- O andamento dos 60 dias, no canto da caixa das metas: é contra ele que elas se leem. -->
          <span class="pl-andamento">
            <span class="pl-andamento__texto">
              <strong class="ui-num">Dia {{ dia }} de {{ PILOTO.dias }}</strong>
              <small>termina em {{ dataCurta(PILOTO.fim) }}</small>
            </span>
            <span class="pl-andamento__regua" aria-hidden="true">
              <span :style="{ width: `${andamento}%` }" />
            </span>
          </span>
        </header>

        <ul class="pl-metas">
          <li v-for="meta in metas" :key="meta.id">
            <button
              type="button"
              class="pl-meta"
              :class="{ 'pl-meta--mudou': mudou.includes(meta.id) }"
              :aria-label="`${meta.rotulo}: ${meta.valor}%. Ver quem falta`"
              @click="abrirMeta(meta.id)"
            >
              <span class="pl-meta__rotulo">
                <i :class="meta.icone" aria-hidden="true" />
                {{ meta.rotulo }}
              </span>
              <span class="pl-meta__valor">
                <span class="ui-num">{{ meta.valor }}%</span>
                <i class="ph ph-caret-right pl-seta" aria-hidden="true" />
              </span>
              <!-- O feito (barra) e a meta (traço) na mesma régua de 0 a 100%. -->
              <span class="pl-meta__regua" aria-hidden="true">
                <span
                  class="pl-meta__barra"
                  :class="{ 'pl-meta__barra--abaixo': !meta.atingida }"
                  :style="{ width: `${meta.valor}%` }"
                />
                <span class="pl-meta__alvo" :style="{ insetInlineStart: `${meta.meta}%` }" />
              </span>
              <span class="pl-meta__frase">
                {{ numero(meta.feitos) }} de {{ numero(meta.base) }} {{ meta.regra }}. Meta:
                {{ meta.meta }}%.
              </span>
              <span
                class="ui-selo pl-meta__selo"
                :class="meta.atingida ? 'ui-selo--ok' : 'ui-selo--atencao'"
              >
                <i :class="meta.atingida ? 'ph ph-check' : 'ph ph-trend-up'" aria-hidden="true" />
                {{ meta.atingida ? 'Meta atingida' : 'Abaixo da meta' }}
              </span>
            </button>
          </li>
        </ul>

        <p class="pl-fim">
          <i class="ph ph-flag-checkered" aria-hidden="true" />
          Ao fim dos 60 dias, a Subea recebe o relatório por bairro e decide se amplia, ajusta ou
          encerra o piloto.
        </p>
      </section>

      <section class="ui-folha ui-cartao pl-caixa" aria-labelledby="pl-atendimentos">
        <header class="ui-cartao__cabeca pl-cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-list-checks" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="pl-atendimentos" class="ui-cartao__titulo">
              Atendimentos recentes
              <span class="ui-contagem">{{ atendimentos.length }}</span>
            </h2>
            <p class="ui-cartao__descricao">
              Cada um saiu com o QR Code da ficha. Aqui, o que aconteceu depois.
            </p>
          </span>
        </header>

        <ul class="pl-lista">
          <li v-for="atendimento in atendimentos" :key="atendimento.id">
            <button
              type="button"
              class="pl-linha"
              :class="{
                'pl-linha--aberta': atendimentoVisivel && atendimentoAberto === atendimento.id,
              }"
              @click="abrirAtendimento(atendimento.id)"
            >
              <PetAvatar
                :nome="atendimento.animal"
                :iniciais="iniciais(atendimento.animal)"
                :especie="atendimento.especie === 'GATO' ? 'felina' : 'canina'"
                tamanho="sm"
              />
              <span class="pl-linha__texto">
                <strong>{{ atendimento.animal }}</strong>
                <span>
                  {{ atendimento.procedimentos.map((id) => procedimento(id).rotulo).join(' · ') }}
                </span>
                <small>Tutor {{ atendimento.tutor }} · {{ dataCurta(atendimento.data) }}</small>
              </span>
              <span class="pl-linha__depois">
                <span class="pl-linha__selos">
                  <span
                    v-if="atendimento.sinpatinhas"
                    class="ui-selo ui-selo--contorno"
                    title="O tutor disse que cadastrou o animal no SinPatinhas"
                  >
                    <i class="ph ph-identification-card" aria-hidden="true" />
                    SinPatinhas
                  </span>
                  <span class="ui-selo" :class="depois(atendimento).classe">
                    <i :class="depois(atendimento).icone" aria-hidden="true" />
                    {{ depois(atendimento).selo }}
                  </span>
                </span>
                <small v-if="depois(atendimento).frase">{{ depois(atendimento).frase }}</small>
              </span>
              <i class="ph ph-caret-right pl-seta" aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>
    </div>

    <template #sempre>
      <RegistrarAtendimentoGaveta v-model:visible="gavetaAberta" @registrado="aoRegistrar" />
      <AtendimentoDoPilotoGaveta
        v-model:visible="atendimentoVisivel"
        :atendimento-id="atendimentoAberto"
      />
      <MetaDoPilotoGaveta v-model:visible="metaVisivel" :meta-id="metaAberta" />
    </template>
  </UiPagina>
</template>

<style scoped>
.pl {
  display: grid;
  gap: 18px;
}

.pl-caixa {
  container: piloto / inline-size;
  display: grid;
  align-content: start;
  gap: 14px;
}

.pl-cabeca {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

/* -------------------------------------------------------------------------- o andamento */

.pl-andamento {
  display: grid;
  flex: none;
  gap: 6px;
  width: 240px;
  margin-inline-start: auto;
}

.pl-andamento__texto {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.pl-andamento__texto strong {
  white-space: nowrap;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 750;
}

.pl-andamento__texto small {
  color: var(--tinta-2);
  font-size: 12px;
}

.pl-andamento__regua {
  position: relative;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--superficie-3);
}

.pl-andamento__regua span {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--tinta-2);
}

/* ------------------------------------------------------------------------------ as metas */

.pl-metas {
  display: grid;
  gap: 4px;
  margin: 0 -12px;
  padding: 0;
  list-style: none;
}

/* Cada meta é um botão: a linha inteira abre a gaveta dela, com a seta dizendo que abre. */
.pl-meta {
  display: grid;
  width: 100%;
  align-items: center;
  gap: 6px 12px;
  padding: 12px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
  grid-template-columns: minmax(0, 1fr) auto;
  transition: background-color var(--pj-tempo-curto, 0.15s) ease;
}

.pl-meta:hover,
.pl-linha:hover,
.pl-linha--aberta {
  background: color-mix(in oklab, var(--tinta) 4.5%, transparent);
}

.pl-meta:focus-visible,
.pl-linha:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: -2px;
}

/* O que o toque do tutor mudou: um brilho verde que some sozinho. */
.pl-meta--mudou {
  animation: pl-brilho 2.6s ease-out;
}

@keyframes pl-brilho {
  0%,
  35% {
    background: color-mix(in oklab, var(--ok-fundo) 85%, transparent);
  }

  100% {
    background: transparent;
  }
}

.pl-seta {
  color: var(--tinta-3);
  font-size: 15px;
  transition: transform var(--pj-tempo-curto, 0.15s) ease;
}

.pl-meta:hover .pl-seta,
.pl-linha:hover .pl-seta {
  color: var(--tinta-2);
  transform: translateX(2px);
}

.pl-meta__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.pl-meta__rotulo i {
  color: var(--tinta-2);
  font-size: 17px;
}

.pl-meta__valor {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  justify-self: end;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 750;
}

.pl-meta__regua {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: var(--superficie-3);
  grid-column: 1 / -1;
}

.pl-meta__barra {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--ok);
  transition:
    width 0.6s cubic-bezier(0.32, 0.72, 0, 1),
    background-color 0.3s ease;
}

.pl-meta__barra--abaixo {
  background: var(--atencao);
}

/* A meta: um traço que atravessa a régua, onde a barra tem de chegar. */
.pl-meta__alvo {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  margin-inline-start: -1px;
  border-radius: 2px;
  background: var(--tinta);
}

.pl-meta__frase {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.pl-meta__selo {
  justify-self: end;
}

.pl-fim {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid var(--app-regua, var(--linha-suave));
  color: var(--tinta-2);
  font-size: 13px;
}

.pl-fim i {
  color: var(--tinta-2);
  font-size: 16px;
}

/* ------------------------------------------------------------------------ atendimentos */

.pl-lista {
  display: grid;
  margin: 0 -12px;
  padding: 0;
  list-style: none;
}

.pl-lista > li + li {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

/* A linha inteira abre a ficha do atendimento. */
.pl-linha {
  display: grid;
  width: 100%;
  align-items: center;
  gap: 8px 14px;
  padding: 12px;
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

.pl-linha__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
  color: var(--tinta-2);
  font-size: 13px;
}

.pl-linha__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.pl-linha__texto small {
  color: var(--tinta-3);
  font-size: 12px;
}

.pl-linha__depois {
  display: grid;
  justify-items: end;
  gap: 4px;
}

.pl-linha__depois small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.pl-linha__selos {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

@container piloto (max-width: 720px) {
  .pl-cabeca {
    flex-wrap: wrap;
  }

  .pl-andamento {
    width: 100%;
  }

  .pl-linha {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .pl-linha .pl-seta {
    grid-row: 1;
    grid-column: 3;
  }

  .pl-linha__depois {
    justify-items: start;
    grid-column: 2;
  }

  .pl-linha__selos {
    justify-content: flex-start;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pl-meta--mudou {
    animation: none;
  }

  .pl-meta__barra,
  .pl-seta {
    transition: none;
  }
}
</style>
