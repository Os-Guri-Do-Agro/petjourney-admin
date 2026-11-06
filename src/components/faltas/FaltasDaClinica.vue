<script setup lang="ts">
/**
 * Faltas da Clínica pela API (E3-03, PJ-MVMNOZ; guia e3 3.7): por responsável e paciente, mais
 * faltas primeiro, com o tempo de agenda perdido. Abre nos reincidentes (D5); "A justificar" é a
 * fila de trabalho (quem ainda não teve contato registrado) e é onde o selo de pendência leva
 * (`?semJustificativa=true`). Reincidência, "a convidar" e o limite vêm prontos do servidor.
 *
 * Escolher uma linha abre o histórico do responsável numa gaveta, e dali cada falta inteira, com o
 * contato e o reagendar. O painel tem balde de leitura: só relê depois de uma escrita.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { lerErroDaAgenda, useFrasesDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import HistoricoDeFaltasGaveta from '@/components/faltas/HistoricoDeFaltasGaveta.vue'
import { hojeNoFuso } from '@/components/parceiro/estabelecimento/horario'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { listarFaltas, type ResumoDeFaltas } from '@/service/parceiro/faltas-service'
import { listarProfissionais } from '@/service/parceiro/profissionais-service'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const rotulos = useRotulosDoCadastro()
const frases = useFrasesDaAgenda()
const { store, parceiroQuery } = useParceiroPortal()

const podeEscrever = computed(
  () => Boolean(store.modulo('CLINICA')?.podeEscrever) && store.temPermissao('agenda.escrever'),
)
const podeObito = computed(() => podeEscrever.value && store.temPermissao('paciente.escrever'))

/* ----------------------------------------------------------------------------- recorte */

const RECORTES = ['reincidentes', 'pendentes', 'todas'] as const
type Recorte = (typeof RECORTES)[number]

const recorte = computed<Recorte>(() => {
  if (route.query.semJustificativa === 'true') return 'pendentes'
  const pedido = route.query.recorte
  return typeof pedido === 'string' && (RECORTES as readonly string[]).includes(pedido)
    ? (pedido as Recorte)
    : 'reincidentes'
})

const opcoesDeRecorte = computed(() =>
  RECORTES.map((valor) => ({ valor, rotulo: t(`faltas.recorte.${valor}`) })),
)

function trocarRecorte(novo: Recorte | null) {
  if (!novo || novo === recorte.value) return
  const query = { ...route.query }
  delete query.semJustificativa
  if (novo === 'reincidentes') delete query.recorte
  else query.recorte = novo
  void router.replace({ query })
}

/* ------------------------------------------------------------------------------ leitura */

const itens = ref<ResumoDeFaltas[]>([])
const proximoCursor = ref<string | null>(null)
const limite = ref(3)
const fuso = ref(Intl.DateTimeFormat().resolvedOptions().timeZone)
const carregando = ref(true)
const carregandoMais = ref(false)
const jaCarregou = ref(false)
const erro = ref('')

const leitura = criarUltimaLeitura()

function filtro() {
  return {
    reincidentes: recorte.value === 'reincidentes',
    semJustificativa: recorte.value === 'pendentes',
  }
}

async function carregar() {
  const vez = leitura.nova()
  carregando.value = true
  erro.value = ''

  try {
    const painel = await listarFaltas(filtro(), parceiroQuery())
    if (!leitura.valendo(vez)) return
    itens.value = painel.itens
    proximoCursor.value = painel.proximoCursor
    limite.value = painel.limiteReincidencia
    fuso.value = painel.fuso
    jaCarregou.value = true
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDaAgenda(err, t('faltas.erroAoCarregar')).mensagem
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

async function carregarMais() {
  if (!proximoCursor.value) return
  const vez = leitura.atual()
  carregandoMais.value = true

  try {
    const painel = await listarFaltas({ ...filtro(), cursor: proximoCursor.value }, parceiroQuery())
    if (!leitura.valendo(vez)) return
    itens.value = [...itens.value, ...painel.itens]
    proximoCursor.value = painel.proximoCursor
  } catch (err) {
    if (!leitura.valendo(vez)) return
    const lido = lerErroDaAgenda(err, t('faltas.erroAoCarregar'))
    if (lido.codigo === 'CURSOR_INVALIDO') await carregar()
    else erro.value = lido.mensagem
  } finally {
    carregandoMais.value = false
  }
}

watch(recorte, () => {
  itens.value = []
  void carregar()
})

const profissionais = ref<{ id: string; nome: string }[]>([])

onMounted(() => {
  void carregar()
  void listarProfissionais({ ...parceiroQuery(), atendeNaAgenda: true })
    .then((lista) => {
      profissionais.value = lista.map((item) => ({ id: item.id, nome: item.nome }))
    })
    .catch(() => {
      profissionais.value = []
    })
})

const hoje = computed(() => hojeNoFuso(fuso.value))

/* ------------------------------------------------------------------------------- linha */

const fraseDoResumo = computed(() => {
  if (!jaCarregou.value) return ''
  if (recorte.value === 'reincidentes') return t('faltas.resumo.reincidentes', { n: limite.value })
  if (recorte.value === 'pendentes') return t('faltas.resumo.pendentes')
  return t('faltas.resumo.todas')
})

function diaDe(iso: string) {
  try {
    return new Intl.DateTimeFormat(rotulos.intl(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: fuso.value,
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

/* ------------------------------------------------------------------------------- abrir */

const aberto = ref<{ id: string; nome: string } | null>(null)
const historicoAberto = ref(false)

function abrir(item: ResumoDeFaltas) {
  aberto.value = { id: item.cliente.id, nome: item.cliente.nome }
  historicoAberto.value = true
}

/** Uma escrita no histórico (contato, reagendar): o painel e o selo de pendência releem. */
function mudou() {
  invalidarPendenciasDoPortal()
  void carregar()
}
</script>

<template>
  <UiPagina
    class="tela-faltas"
    :titulo="t('clinico.faltas.titulo')"
    :carregando="carregando && !jaCarregou"
    :erro="erro && !jaCarregou ? erro : ''"
    @tentar-de-novo="carregar"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <div class="fa">
      <SelectButton
        :model-value="recorte"
        :options="opcoesDeRecorte"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        :aria-label="t('faltas.recorte.rotulo')"
        class="fa__recorte"
        @update:model-value="trocarRecorte"
      />

      <p v-if="erro && jaCarregou" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>

      <ul v-if="carregando && !itens.length" class="ui-lista ui-folha" aria-busy="true">
        <li v-for="n in 3" :key="n" class="ui-linha">
          <Skeleton width="2.5rem" height="2.5rem" />
          <span class="ui-linha__texto">
            <Skeleton width="12rem" height="0.9rem" />
            <Skeleton width="16rem" height="0.8rem" />
          </span>
        </li>
      </ul>

      <div v-else-if="!itens.length" class="ui-folha ui-vazio fa__vazio">
        <i class="ph ph-calendar-check" aria-hidden="true" />
        <strong>{{ t(`faltas.vazio.${recorte}`) }}</strong>
        <span>{{ t('faltas.vazio.descricao') }}</span>
      </div>

      <ul v-else class="ui-lista ui-folha" :aria-busy="carregando">
        <li v-for="item in itens" :key="`${item.cliente.id}-${item.paciente.id}`" class="fa__item">
          <button type="button" class="ui-linha ui-linha--clicavel fa__linha" @click="abrir(item)">
            <span
              class="ui-ladrilho"
              :class="item.semJustificativa ? 'ui-ladrilho--atencao' : 'ui-ladrilho--neutro'"
              aria-hidden="true"
            >
              <i :class="item.semJustificativa ? 'ph ph-phone-x' : 'ph ph-user-minus'" />
            </span>

            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">
                <bdi>{{ item.paciente.nome }}</bdi>
                <span v-if="item.paciente.obito" class="ui-selo">{{ t('faltas.selo.obito') }}</span>
                <span v-else-if="!item.paciente.ativo" class="ui-selo">{{
                  t('faltas.selo.inativo')
                }}</span>
              </strong>
              <span class="ui-linha__meta">
                <bdi>{{ item.cliente.nome }}</bdi> ·
                {{ t('faltas.ultima', { dia: diaDe(item.ultimaFaltaEm) }) }}
              </span>
            </span>

            <span class="ui-linha__fim fa__fim">
              <span class="fa__selos">
                <span v-if="item.semJustificativa" class="ui-selo ui-selo--atencao">
                  {{
                    t(
                      'faltas.selo.aJustificar',
                      { n: item.semJustificativa },
                      item.semJustificativa,
                    )
                  }}
                </span>
                <span v-if="item.aConvidar" class="ui-selo">{{ t('faltas.selo.aConvidar') }}</span>
                <span v-if="item.reincidente && recorte !== 'reincidentes'" class="ui-selo">
                  <i class="ph ph-repeat" aria-hidden="true" />
                  {{ t('faltas.selo.reincidente') }}
                </span>
              </span>
              <span class="fa__conta ui-num">
                <strong>{{ t('faltas.contagem', { n: item.faltas }, item.faltas) }}</strong>
                <span>{{ frases.duracao(item.minutosPerdidos) }}</span>
              </span>
              <i class="ph ph-caret-right fa__seta" aria-hidden="true" />
            </span>
          </button>
        </li>
      </ul>

      <Button
        v-if="proximoCursor && itens.length"
        type="button"
        severity="secondary"
        outlined
        class="fa__mais"
        :label="t('faltas.verMais')"
        :loading="carregandoMais"
        @click="carregarMais"
      />
    </div>

    <template #sempre>
      <HistoricoDeFaltasGaveta
        v-model:visible="historicoAberto"
        :cliente="aberto"
        :fuso="fuso"
        :profissionais="profissionais"
        :pode-escrever="podeEscrever"
        :pode-obito="podeObito"
        :hoje="hoje"
        @mudou="mudou"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.fa {
  display: grid;
  gap: 16px;
}

.fa__recorte {
  justify-self: start;
}

.fa__item {
  display: grid;
}

.fa__linha {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.fa__linha:focus-visible {
  outline: 2px solid var(--tinta);
  outline-offset: -2px;
}

.ui-linha__titulo {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.fa__fim {
  display: flex;
  align-items: center;
  gap: 14px;
}

.fa__selos {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.fa__conta {
  display: grid;
  min-width: 6.5rem;
  justify-items: end;
  gap: 1px;
  font-size: 12.5px;
}

.fa__conta strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.fa__conta span {
  color: var(--tinta-2);
}

.fa__seta {
  color: var(--tinta-2);
}

[dir='rtl'] .fa__seta {
  transform: scaleX(-1);
}

.fa__mais {
  justify-self: center;
}
</style>
