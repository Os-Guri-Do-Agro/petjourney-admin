<script setup lang="ts">
/**
 * Quem entrou pelo código do parceiro (E0-03): uma pessoa por linha, com a situação da assinatura
 * em selo, o plano, o dia e quanto rendeu de participação. O recorte é da API (`?status=`): trocar
 * o filtro recomeça a lista do zero, e "Carregar mais" segue o cursor opaco da página anterior.
 *
 * A lista mostra nome de cliente, por isso só o DONO a vê. OPERADOR recebe 403, parceiro fora de
 * operação recebe 409 e API sem a rota responde 404: cada um vira o estado da página, como no app.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import type { IndicadoDoParceiroDto } from '@/service/contrato/openapi'
import {
  getPortalIndicados,
  type StatusDoIndicado,
} from '@/service/parceiro/parceiro-portal-service'
import { formatCentavosToBrl } from '@/utils/format/money'

type Filtro = 'TODOS' | StatusDoIndicado
type Bloqueio = 'apenasDono' | 'naoOperacional' | 'indisponivel'

const FILTROS: Filtro[] = ['TODOS', 'COM_ASSINATURA', 'SEM_ASSINATURA', 'CANCELADO']
const TAMANHO_DA_PAGINA = 20

const BLOQUEIO_DO_STATUS: Partial<Record<number, Bloqueio>> = {
  403: 'apenasDono',
  404: 'indisponivel',
  409: 'naoOperacional',
}

const ICONE_DO_BLOQUEIO: Record<Bloqueio, string> = {
  apenasDono: 'ph ph-lock-simple',
  naoOperacional: 'ph ph-pause-circle',
  indisponivel: 'ph ph-hourglass-medium',
}

const SELO_DO_STATUS: Record<StatusDoIndicado, { classe: string; icone: string }> = {
  COM_ASSINATURA: { classe: 'ui-selo--ok', icone: 'ph ph-check-circle' },
  SEM_ASSINATURA: { classe: '', icone: 'ph ph-circle-dashed' },
  CANCELADO: { classe: 'ui-selo--contorno', icone: 'ph ph-x-circle' },
}

const { t, locale } = useI18n()
const router = useRouter()
const { store, bootstrapping, ensureContext, parceiroQuery } = useParceiroPortal()

const filtro = ref<Filtro>('TODOS')
const indicados = ref<IndicadoDoParceiroDto[]>([])
const total = ref<number | null>(null)
const proximoCursor = ref<string | null>(null)
const carregando = ref(true)
const carregandoMais = ref(false)
const erroAoCarregar = ref('')
const erroAoCarregarMais = ref(false)
const bloqueio = ref<Bloqueio | null>(null)

/** Cada recomeço ganha um número: resposta de um filtro antigo que chega atrasada é descartada. */
let geracao = 0

const opcoesDoFiltro = computed(() =>
  FILTROS.map((valor) => ({ valor, rotulo: t(`parceiro.indicados.filtros.${valor}`) })),
)

const statusDoFiltro = computed(() => (filtro.value === 'TODOS' ? undefined : filtro.value))

const erroDaPagina = computed(() => {
  if (store.loadState === 'error' && !store.semAcessoParceiro) {
    return store.errorMessage
  }

  return erroAoCarregar.value
})

/** Ninguém entrou ainda: sem filtro para trocar, a página inteira diz isso e leva ao código. */
const ninguemAinda = computed(
  () => !carregando.value && filtro.value === 'TODOS' && total.value === 0,
)

const vazioDaPagina = computed(() => {
  if (bloqueio.value) {
    return {
      titulo: t(`parceiro.indicados.${bloqueio.value}.titulo`),
      descricao: t(`parceiro.indicados.${bloqueio.value}.corpo`),
      icone: ICONE_DO_BLOQUEIO[bloqueio.value],
      acao: '',
    }
  }

  return {
    titulo: t('parceiro.indicados.vazio.titulo'),
    descricao: t('parceiro.indicados.vazio.corpo'),
    icone: 'ph ph-user-list',
    acao: t('parceiro.indicados.vazio.acao'),
  }
})

async function carregar() {
  const minha = ++geracao

  carregando.value = true
  carregandoMais.value = false
  erroAoCarregar.value = ''
  erroAoCarregarMais.value = false
  bloqueio.value = null

  try {
    const pagina = await getPortalIndicados({
      ...parceiroQuery(),
      status: statusDoFiltro.value,
      limit: TAMANHO_DA_PAGINA,
    })

    if (minha !== geracao) {
      return
    }

    indicados.value = pagina.data
    total.value = pagina.meta.total
    proximoCursor.value = pagina.meta.proximoCursor ?? null
  } catch (err) {
    if (minha !== geracao) {
      return
    }

    indicados.value = []
    total.value = null
    proximoCursor.value = null
    bloqueio.value = err instanceof ApiError ? (BLOQUEIO_DO_STATUS[err.statusCode] ?? null) : null

    if (!bloqueio.value) {
      erroAoCarregar.value =
        err instanceof Error && err.message ? err.message : t('parceiro.indicados.erroCarregar')
    }
  } finally {
    if (minha === geracao) {
      carregando.value = false
    }
  }
}

async function carregarMais() {
  if (!proximoCursor.value || carregandoMais.value) {
    return
  }

  const minha = geracao

  carregandoMais.value = true
  erroAoCarregarMais.value = false

  try {
    const pagina = await getPortalIndicados({
      ...parceiroQuery(),
      status: statusDoFiltro.value,
      cursor: proximoCursor.value,
      limit: TAMANHO_DA_PAGINA,
    })

    if (minha !== geracao) {
      return
    }

    indicados.value = [...indicados.value, ...pagina.data]
    total.value = pagina.meta.total
    proximoCursor.value = pagina.meta.proximoCursor ?? null
  } catch (err) {
    if (minha !== geracao) {
      return
    }

    /* 400 é o cursor que a API não aceita mais: recomeçar do topo é o único jeito de seguir. */
    if (err instanceof ApiError && err.statusCode === 400) {
      void carregar()
      return
    }

    erroAoCarregarMais.value = true
  } finally {
    if (minha === geracao) {
      carregandoMais.value = false
    }
  }
}

function escolherFiltro(valor: Filtro | null) {
  if (!valor || valor === filtro.value) {
    return
  }

  filtro.value = valor
  void carregar()
}

async function tentarDeNovo() {
  await ensureContext(true)
  await carregar()
}

function verMeuCodigo() {
  void router.push({ path: '/parceiro/divulgacao', hash: '#indicacao' })
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function iniciais(nome: string | null) {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean)

  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}

/** "Plano anual · Assinou em 3 de set. de 2026" ou "Entrou em 1 de set. de 2026". */
function metaDe(indicado: IndicadoDoParceiroDto) {
  const partes: string[] = []

  if (indicado.plano) {
    partes.push(t(`parceiro.indicados.planos.${indicado.plano}`))
  }

  partes.push(
    indicado.assinouEm
      ? t('parceiro.indicados.assinouEm', { data: formatarData(indicado.assinouEm) })
      : t('parceiro.indicados.entrouEm', { data: formatarData(indicado.cadastradoEm) }),
  )

  return partes.join(' · ')
}

function participacaoDe(indicado: IndicadoDoParceiroDto) {
  return formatCentavosToBrl(indicado.participacaoCentavos, INTL_LOCALE[locale.value as Locale])
}

onMounted(async () => {
  await ensureContext()
  await carregar()
})
</script>

<template>
  <UiPagina
    class="tela-indicados"
    :titulo="t('parceiro.indicados.titulo')"
    :resumo="t('parceiro.indicados.resumo')"
    :carregando="bootstrapping || (store.loadState === 'loading' && !store.dashboard)"
    :erro="erroDaPagina"
    :sem-acesso-de-parceiro="store.semAcessoParceiro"
    bloquear-se-suspenso
    :vazio="Boolean(bloqueio) || ninguemAinda"
    :vazio-titulo="vazioDaPagina.titulo"
    :vazio-descricao="vazioDaPagina.descricao"
    :vazio-icone="vazioDaPagina.icone"
    :vazio-acao="vazioDaPagina.acao"
    vazio-acao-icone="ph ph-qr-code"
    @tentar-de-novo="tentarDeNovo"
    @acao-do-vazio="verMeuCodigo"
  >
    <div class="indicados">
      <div class="indicados__barra">
        <SelectButton
          class="indicados__filtros"
          :model-value="filtro"
          :options="opcoesDoFiltro"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('parceiro.indicados.filtroRotulo')"
          @update:model-value="escolherFiltro"
        />
        <span v-if="total !== null && !carregando" class="ui-num indicados__total" role="status">
          {{ t('parceiro.indicados.contador', total) }}
        </span>
      </div>

      <ul v-if="carregando" class="ui-lista ui-folha" aria-hidden="true">
        <li v-for="n in 4" :key="n" class="ui-linha">
          <Skeleton shape="circle" size="2.5rem" />
          <span class="ui-linha__texto">
            <Skeleton width="11rem" height="0.9rem" border-radius="6px" />
            <Skeleton width="16rem" height="0.8rem" border-radius="6px" />
          </span>
          <Skeleton width="6rem" height="1.5rem" border-radius="999px" />
        </li>
      </ul>

      <div v-else-if="!indicados.length" class="indicados__vazio" role="status">
        <i class="ph ph-funnel-simple" aria-hidden="true" />
        <span>
          <strong>{{ t(`parceiro.indicados.vazioFiltro.${filtro}.titulo`) }}</strong>
          {{ t(`parceiro.indicados.vazioFiltro.${filtro}.corpo`) }}
        </span>
      </div>

      <ul v-else class="ui-lista ui-folha">
        <li
          v-for="(indicado, i) in indicados"
          :key="`${indicado.cadastradoEm}-${i}`"
          class="ui-linha indicado"
        >
          <span class="indicado__avatar" aria-hidden="true">{{ iniciais(indicado.nome) }}</span>

          <span class="ui-linha__texto">
            <span class="ui-linha__titulo" :class="{ 'indicado__sem-nome': !indicado.nome }">
              {{ indicado.nome ?? t('parceiro.indicados.semNome') }}
            </span>
            <span class="ui-linha__meta">{{ metaDe(indicado) }}</span>
          </span>

          <span class="ui-linha__fim">
            <span class="ui-selo" :class="SELO_DO_STATUS[indicado.status].classe">
              <i :class="SELO_DO_STATUS[indicado.status].icone" aria-hidden="true" />
              {{ t(`parceiro.indicados.status.${indicado.status}`) }}
            </span>
            <span class="indicado__participacao">
              <template v-if="indicado.participacaoCentavos > 0">
                <strong class="ui-num">{{ participacaoDe(indicado) }}</strong>
                <small>{{ t('parceiro.indicados.participacao') }}</small>
              </template>
            </span>
          </span>
        </li>
      </ul>

      <div v-if="!carregando && erroAoCarregarMais" class="indicados__erro-mais" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ t('parceiro.indicados.maisErro') }}</span>
        <Button
          type="button"
          icon="ph ph-arrow-clockwise"
          :label="t('common.retry')"
          severity="secondary"
          outlined
          size="small"
          @click="carregarMais"
        />
      </div>

      <div v-else-if="!carregando && proximoCursor" class="indicados__mais">
        <Button
          type="button"
          :label="t('parceiro.indicados.carregarMais')"
          severity="secondary"
          outlined
          :loading="carregandoMais"
          @click="carregarMais"
        />
      </div>

      <p v-if="!carregando && indicados.length" class="indicados__nota">
        <i class="ph ph-info" aria-hidden="true" />
        {{ t('parceiro.indicados.rodape') }}
      </p>
    </div>
  </UiPagina>
</template>

<style scoped>
.indicados {
  display: grid;
  gap: 16px;
}

.indicados__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}

.indicados__filtros :deep(.p-togglebutton-content) {
  min-height: 38px;
  padding-inline: 16px;
  font-size: 14.5px;
}

.indicados__total {
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 500;
}

.indicado__avatar {
  display: grid;
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 999px;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-size: 14px;
  font-weight: 650;
  letter-spacing: 0.02em;
}

.indicado__sem-nome {
  color: var(--tinta-2);
  font-style: italic;
  font-weight: 500;
}

/*
 * A participação é uma coluna de largura fixa, vazia quando não há valor: os selos ficam na mesma
 * linha vertical e os valores alinham pela direita, como numa tabela.
 */
.indicado__participacao {
  display: grid;
  width: 8.5rem;
  justify-items: end;
  gap: 2px;
  white-space: nowrap;
}

/* Mesma medida do nome e da data ao lado: a linha tem a mesma altura com ou sem valor. */
.indicado__participacao strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
}

.indicado__participacao small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

/* Recorte vazio é uma frase, não uma caixa: os filtros acima continuam sendo o assunto. */
.indicados__vazio {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.45;
}

.indicados__vazio > i {
  margin-top: 1px;
  color: var(--tinta-3);
  font-size: 18px;
}

.indicados__vazio strong {
  display: block;
  margin-bottom: 2px;
  color: var(--tinta);
  font-weight: 600;
}

.indicados__mais {
  display: flex;
  justify-content: center;
}

.indicados__erro-mais {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
}

.indicados__erro-mais > i {
  color: var(--risco-tinta);
  font-size: 18px;
}

.indicados__nota {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.indicados__nota i {
  color: var(--tinta-3);
  font-size: 16px;
}

@media (max-width: 48rem) {
  .indicados__filtros {
    width: 100%;
  }

  .indicados__filtros :deep(.p-togglebutton) {
    flex: 1 1 0;
  }
}
</style>
