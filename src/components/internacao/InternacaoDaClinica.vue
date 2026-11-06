<script setup lang="ts">
/**
 * Internação pela API (E5-01, PJ-7G0NQI; guia e5 9): o mapa da ala com as duas perguntas da
 * demonstração, **quem precisa de mim agora** e **onde há vaga**.
 *
 * - O resumo é o `cabecalho` da API (ocupação, quem cobra ação, críticos).
 * - "O que pede ação" segue `porUrgencia` (a ordem é da API: alergia nova, boletim retido, doses
 *   atrasadas, a próxima hora, a alta vencida), com o tom da urgência e sem texto clínico.
 * - A planta: um bloco por tipo de leito (a UTI primeiro), com "x de y ocupados" e as vagas; o
 *   leito livre interna, o ocupado abre a internação.
 *
 * O mapa se relê a cada 30 s (o teto de leitura é 1200 por hora por pessoa) e quando a aba volta
 * a ficar visível. O cadastro dos leitos mora na Configuração (aba Leitos).
 */
import Button from 'primevue/button'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import type { LinhaDaTabela } from '@/components/home/pauta-tabela'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiPauta from '@/components/ui/UiPauta.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import {
  KINDS_DO_LEITO,
  lerMapa,
  RELER_MAPA_MS,
  type CelulaDoMapa,
  type Internacao,
  type KindDoLeito,
  type Mapa,
} from '@/service/parceiro/internacao-service'

import InternarGaveta from './InternarGaveta.vue'
import LeitoDoMapa from './LeitoDoMapa.vue'
import { ICONE_DO_KIND, TOM_DA_URGENCIA } from './rotulos-da-internacao'

const { t } = useI18n()
const router = useRouter()
const { store, parceiroQuery } = useParceiroPortal()

const clinicaEscreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
const podeInternar = computed(
  () => clinicaEscreve.value && store.temPermissao('internacao.prescrever'),
)
const veLeitos = computed(
  () => store.temPermissao('estabelecimento.editar') || store.temPermissao('internacao.executar'),
)

const mapa = ref<Mapa | null>(null)
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  try {
    mapa.value = await lerMapa(parceiroQuery())
    erro.value = ''
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

let relendo: ReturnType<typeof setInterval> | null = null

function aoVoltar() {
  if (document.visibilityState === 'visible') void carregar()
}

onMounted(() => {
  void carregar()
  relendo = setInterval(() => {
    if (document.visibilityState === 'visible') void carregar()
  }, RELER_MAPA_MS)
  document.addEventListener('visibilitychange', aoVoltar)
})

onBeforeUnmount(() => {
  if (relendo) clearInterval(relendo)
  document.removeEventListener('visibilitychange', aoVoltar)
})

/* ------------------------------------------------------------------------- o resumo */

const resumo = computed(() => {
  const cabecalho = mapa.value?.cabecalho
  if (!cabecalho) return ''
  const partes = [
    t('internacao.resumo.ocupacao', { ocupados: cabecalho.ocupados, ativos: cabecalho.ativos }),
  ]
  if (cabecalho.cobramAcao)
    partes.push(
      t('internacao.resumo.cobramAcao', { n: cabecalho.cobramAcao }, cabecalho.cobramAcao),
    )
  if (cabecalho.criticos)
    partes.push(t('internacao.resumo.criticos', { n: cabecalho.criticos }, cabecalho.criticos))
  if (partes.length === 1 && cabecalho.ocupados) partes.push(t('internacao.resumo.emDia'))
  return partes.join(' · ')
})

/* ------------------------------------------------------------------- o que pede ação */

const linhasDaPauta = computed<LinhaDaTabela[]>(() => {
  const celulas = new Map(
    (mapa.value?.leitos ?? [])
      .filter((celula) => celula.internacao)
      .map((celula) => [celula.internacao!.id, celula] as const),
  )
  const linhas: LinhaDaTabela[] = []
  for (const id of mapa.value?.porUrgencia ?? []) {
    const celula = celulas.get(id)
    const item = celula?.internacao
    if (!celula || !item || item.urgencia.nivel === 'NENHUMA') continue
    const motivo = item.urgencia.motivos[0]
    linhas.push({
      id,
      to: `/clinica/internacao/${id}`,
      frase: motivo
        ? t(
            `internacao.pauta.${motivo}`,
            {
              pet: item.paciente.nome,
              n: item.sinais.dosesAtrasadas,
              minutos: item.sinais.proximaEmMinutos ?? 0,
            },
            motivo === 'DOSES_ATRASADAS' ? item.sinais.dosesAtrasadas : 1,
          )
        : item.paciente.nome,
      detalhe:
        item.urgencia.motivos.length > 1
          ? item.urgencia.motivos
              .slice(1)
              .map((outro) => t(`internacao.urgenciaCurta.${outro}`))
              .join(' · ')
          : '',
      tom: TOM_DA_URGENCIA[item.urgencia.nivel],
      onde: celula.leito.nome,
      pet: { nome: item.paciente.nome, iniciais: iniciais(item.paciente.nome) },
    })
  }
  return linhas
})

function iniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toLocaleUpperCase()
}

/* ---------------------------------------------------------------------- a planta */

type Setor = { kind: KindDoLeito; celulas: CelulaDoMapa[]; ocupados: number; ativos: number }

const setores = computed<Setor[]>(() => {
  const porKind = new Map<KindDoLeito, Setor>()
  for (const celula of mapa.value?.leitos ?? []) {
    const kind = celula.leito.kind
    const setor = porKind.get(kind) ?? { kind, celulas: [], ocupados: 0, ativos: 0 }
    setor.celulas.push(celula)
    setor.ocupados += celula.internacao ? 1 : 0
    setor.ativos += celula.leito.ativo ? 1 : 0
    porKind.set(kind, setor)
  }
  return KINDS_DO_LEITO.map((kind) => porKind.get(kind)).filter((setor): setor is Setor =>
    Boolean(setor),
  )
})

function vagasDo(setor: Setor) {
  return Math.max(0, setor.ativos - setor.ocupados)
}

const vazio = computed(() => Boolean(mapa.value) && !mapa.value!.leitos.length)

/* ----------------------------------------------------------------------- internar */

const internarAberta = ref(false)
const leitoParaInternar = ref<{ id: string; nome: string; kind: KindDoLeito } | null>(null)

const jaInternados = computed(() =>
  (mapa.value?.leitos ?? [])
    .map((celula) => celula.internacao?.paciente.id)
    .filter((id): id is string => Boolean(id)),
)

function abrirInternar(leitoId: string) {
  const celula = mapa.value?.leitos.find((item) => item.leito.id === leitoId)
  if (!celula) return
  leitoParaInternar.value = {
    id: celula.leito.id,
    nome: celula.leito.nome,
    kind: celula.leito.kind,
  }
  internarAberta.value = true
}

function internado(internacao: Internacao) {
  invalidarPendenciasDoPortal()
  void router.push(`/clinica/internacao/${internacao.id}`)
}

function abrir(id: string) {
  void router.push(`/clinica/internacao/${id}`)
}
</script>

<template>
  <UiPagina
    :resumo="resumo"
    :carregando="carregando && !mapa"
    :erro="mapa ? '' : erro"
    :vazio="vazio"
    :vazio-titulo="t('internacao.vazioTitulo')"
    :vazio-descricao="veLeitos ? t('internacao.vazioDescricao') : t('internacao.vazioSemCadastro')"
    :vazio-acao="veLeitos ? t('internacao.irParaLeitos') : ''"
    vazio-icone="ph ph-bed"
    @tentar-de-novo="carregar"
    @acao-do-vazio="router.push({ path: '/clinica/configuracao', query: { aba: 'leitos' } })"
  >
    <template #acoes>
      <Button
        v-if="veLeitos"
        type="button"
        icon="ph ph-gear-six"
        :label="t('internacao.leitos.titulo')"
        severity="secondary"
        outlined
        @click="router.push({ path: '/clinica/configuracao', query: { aba: 'leitos' } })"
      />
    </template>

    <div v-if="mapa && !vazio" class="ic">
      <p v-if="erro" class="ic__erro" role="alert">{{ erro }}</p>

      <UiSecao
        id="internacao-pauta"
        :titulo="t('internacao.pauta.titulo')"
        :contagem="linhasDaPauta.length || null"
        icone="ph ph-bell-ringing"
      >
        <UiPauta v-if="linhasDaPauta.length" :linhas="linhasDaPauta" />
        <p v-else class="ui-folha ic__calma">
          <span class="ui-ladrilho ui-ladrilho--ok" aria-hidden="true">
            <i class="ph ph-check-circle" />
          </span>
          <strong>{{
            mapa.cabecalho.ocupados ? t('internacao.pauta.vazio') : t('internacao.pauta.ninguem')
          }}</strong>
        </p>
      </UiSecao>

      <UiSecao
        id="internacao-planta"
        :titulo="t('internacao.planta.titulo')"
        :descricao="t('internacao.planta.descricao')"
        icone="ph ph-bed"
      >
        <div class="ic__planta">
          <section
            v-for="setor in setores"
            :key="setor.kind"
            class="ic__setor"
            :style="{ '--setor-leitos': setor.celulas.length }"
            :aria-labelledby="`internacao-setor-${setor.kind}`"
          >
            <header class="ic__cabeca">
              <span
                class="ui-ladrilho"
                :class="{ 'ui-ladrilho--risco': setor.kind === 'UTI' }"
                aria-hidden="true"
              >
                <i :class="ICONE_DO_KIND[setor.kind]" />
              </span>
              <span class="ic__titulos">
                <h3 :id="`internacao-setor-${setor.kind}`" class="ic__nome">
                  {{ t(`internacao.kind.${setor.kind}`) }}
                </h3>
                <span class="ic__conta ui-num">{{
                  t('internacao.planta.ocupados', {
                    ocupados: setor.ocupados,
                    ativos: setor.ativos,
                  })
                }}</span>
              </span>
              <span
                class="ui-selo"
                :class="vagasDo(setor) > 0 ? 'ui-selo--ok' : 'ui-selo--contorno'"
              >
                <i
                  :class="vagasDo(setor) > 0 ? 'ph ph-check-circle' : 'ph ph-prohibit'"
                  aria-hidden="true"
                />
                {{
                  vagasDo(setor) > 0
                    ? t('internacao.planta.vagas', { n: vagasDo(setor) }, vagasDo(setor))
                    : t('internacao.planta.semVaga')
                }}
              </span>
            </header>
            <div class="ic__leitos">
              <LeitoDoMapa
                v-for="celula in setor.celulas"
                :key="celula.leito.id"
                :celula="celula"
                :pode-internar="podeInternar"
                @abrir="abrir"
                @internar="abrirInternar"
              />
            </div>
          </section>
        </div>
      </UiSecao>
    </div>

    <template #sempre>
      <InternarGaveta
        v-model:visible="internarAberta"
        :leito="leitoParaInternar"
        :ja-internados="jaInternados"
        @internado="internado"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.ic {
  display: grid;
  gap: 36px;
}

.ic__erro {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
}

.ic__calma {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0;
  padding: 16px 24px;
  color: var(--tinta);
  font-size: 14.5px;
}

.ic__calma strong {
  font-weight: 600;
}

.ic__planta {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 20px;
}

/* Cada setor é um cômodo: chão rente e tingido, o nome na porta. Os leitos são os cartões. */
.ic__setor {
  --ladrilho: 220px;
  --vao: 12px;

  display: grid;
  min-width: min(100%, 290px);
  flex: var(--setor-leitos) 1 calc(var(--setor-leitos) * (var(--ladrilho) + var(--vao)) + 24px);
  align-content: start;
  gap: 16px;
  padding: 16px 16px 18px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-painel);
  background: color-mix(in oklab, var(--superficie-3) 50%, transparent);
}

.app-dark .ic__setor {
  background: color-mix(in oklab, var(--superficie-2) 40%, transparent);
}

.ic__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ic__titulos {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 3px;
}

.ic__nome {
  margin: 0;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
}

.ic__conta {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ic__leitos {
  display: grid;
  gap: var(--vao);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--ladrilho)), 1fr));
}

@media (max-width: 900px) {
  .ic__setor {
    flex-basis: 100%;
  }
}
</style>
