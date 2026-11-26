<script setup lang="ts">
/**
 * A auditoria (E1-05): quem da equipe leu, escreveu, publicou ou exportou dado clínico, quando e em
 * nome de quem. É a terceira aba de Equipe, ao lado de Pessoas e Profissionais, e abre para quem
 * tem `auditoria.ler` (dono e gestão).
 *
 * A trilha nunca traz conteúdo clínico: só a ação, o tipo do registro e o nome dos campos que
 * mudaram. Uma linha por evento, agrupada por dia, do mais novo para o mais antigo; os filtros são
 * os que a API oferece e que alguém usa para responder "quem mexeu nisso?": a ação, a pessoa e o
 * período. Evento do suporte vem sem nome de pessoa: é "Suporte PetJourney", com o protocolo.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import UiPagina from '@/components/ui/UiPagina.vue'
import type { PassoDoGuia } from '@/components/ui/UiPassos.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { useAcessoAosModulos } from '@/composables/useAcessoAosModulos'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import {
  ACOES_DA_TRILHA,
  listarTrilha,
  type AcaoDaTrilha,
  type EventoDaTrilha,
} from '@/service/parceiro/auditoria-service'
import { listarEquipe } from '@/service/parceiro/equipe-service'

const POR_PAGINA = 50

/**
 * Desde 25/11 (N7), a criação de alerta e de autorizado grava `CRIAR`, e a exclusão do cliente,
 * `EXCLUIR`. As linhas de antes ficaram como ALTERAR com um marcador em `campos` (`criado` ou
 * `excluido`): a linha lê o marcador como o verbo que ele é.
 */
type AcaoLida = AcaoDaTrilha

const MARCADORES = new Map<string, AcaoLida>([
  ['criado', 'CRIAR'],
  ['excluido', 'EXCLUIR'],
])

const ICONE_DA_ACAO: Record<AcaoLida, string> = {
  LER: 'ph ph-eye',
  CRIAR: 'ph ph-plus-circle',
  ALTERAR: 'ph ph-pencil-simple',
  FINALIZAR: 'ph ph-check-circle',
  ANULAR: 'ph ph-prohibit',
  PUBLICAR: 'ph ph-paper-plane-tilt',
  IMPRIMIR: 'ph ph-printer',
  EXPORTAR: 'ph ph-export',
  LER_DADO_DO_APP: 'ph ph-device-mobile',
  EXCLUIR: 'ph ph-trash',
}

/*
 * Os tipos de registro (`recursoTipo`, com hífen) têm o nome em `parceiro.auditoria.recurso`, com
 * sublinhado: os 71 que a API gravava em 24/11, inclusive os da leitura do app. Tipo novo, sem nome ainda, sai como "um registro (tipo)".
 */
const { t, te, locale } = useI18n()
const { store, bootstrapping, ensureContext, parceiroQuery } = useParceiroPortal()

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

const eventos = ref<EventoDaTrilha[]>([])
const proximoCursor = ref<string | null>(null)
const carregando = ref(false)
const carregandoMais = ref(false)
const carregado = ref(false)
const erro = ref('')
const semPermissao = ref(false)

/* ------------------------------------------------------------------------------ filtros */

const acao = ref<AcaoDaTrilha | null>(null)
const pessoa = ref<string | null>(null)
const periodo = ref<Array<Date | null> | null>(null)

const pessoas = ref<Array<{ valor: string; rotulo: string }>>([])

const acaoOptions = computed(() =>
  ACOES_DA_TRILHA.map((valor) => ({ valor, rotulo: t(`parceiro.auditoria.acao.${valor}`) })),
)

const comFiltro = computed(() => Boolean(acao.value || pessoa.value || periodo.value?.[0]))

/** O período vai como instantes: do começo do primeiro dia ao fim do último, no relógio de quem olha. */
function intervalo() {
  const [inicio, fim] = periodo.value ?? []

  if (!inicio) return { de: null, ate: null }

  const de = new Date(inicio)
  de.setHours(0, 0, 0, 0)

  const ate = new Date(fim ?? inicio)
  ate.setHours(23, 59, 59, 999)

  return { de: de.toISOString(), ate: ate.toISOString() }
}

function filtros() {
  return { acao: acao.value, usuarioId: pessoa.value, ...intervalo() }
}

function limparFiltros() {
  acao.value = null
  pessoa.value = null
  periodo.value = null
}

/* ------------------------------------------------------------------------------ leitura */

let pedido = 0

async function carregar() {
  const meu = ++pedido

  carregando.value = true
  erro.value = ''
  semPermissao.value = false

  try {
    await ensureContext()
    const pagina = await listarTrilha({ ...filtros(), limit: POR_PAGINA }, parceiroQuery())

    /* Um filtro trocado no meio do caminho já pediu outra página: esta chegou tarde. */
    if (meu !== pedido) return

    eventos.value = pagina.eventos
    proximoCursor.value = pagina.proximoCursor
    carregado.value = true
  } catch (err) {
    if (meu !== pedido) return

    /* Sem `auditoria.ler` (a tela aberta pelo endereço): tentar de novo não muda o papel. */
    semPermissao.value = err instanceof ApiError && err.statusCode === 403
    erro.value = err instanceof Error ? err.message : t('parceiro.auditoria.erro')
  } finally {
    if (meu === pedido) carregando.value = false
  }
}

async function carregarMais() {
  if (!proximoCursor.value || carregandoMais.value) return

  const meu = pedido
  carregandoMais.value = true

  try {
    const pagina = await listarTrilha(
      { ...filtros(), cursor: proximoCursor.value, limit: POR_PAGINA },
      parceiroQuery(),
    )

    if (meu !== pedido) return

    eventos.value = [...eventos.value, ...pagina.eventos]
    proximoCursor.value = pagina.proximoCursor
  } catch (err) {
    erro.value = err instanceof Error ? err.message : t('parceiro.auditoria.erro')
  } finally {
    carregandoMais.value = false
  }
}

async function carregarPessoas() {
  try {
    const equipe = await listarEquipe(parceiroQuery())

    pessoas.value = equipe.membros.map((membro) => ({
      valor: membro.usuarioId,
      rotulo: membro.nome,
    }))
  } catch {
    /* Sem a lista, o filtro de pessoa some; a trilha continua. */
    pessoas.value = []
  }
}

watch([acao, pessoa], () => {
  void carregar()
})

/* O período pede a lista com as duas pontas escolhidas; com uma só, quando o calendário fecha. */
watch(periodo, (atual) => {
  if (!atual?.[0] || atual[1]) void carregar()
})

function aoFecharPeriodo() {
  if (periodo.value?.[0] && !periodo.value[1]) void carregar()
}

onMounted(async () => {
  await ensureContext()
  void carregarPessoas()
  void carregar()
})

/* ------------------------------------------------------------------------------ leitura das linhas */

function quem(evento: EventoDaTrilha) {
  if (evento.ator === 'SUPORTE') return t('parceiro.auditoria.ator.suporte')
  if (evento.ator === 'SISTEMA') return t('parceiro.auditoria.ator.sistema')

  return evento.usuario?.nome || t('parceiro.auditoria.ator.semNome')
}

function recurso(evento: EventoDaTrilha) {
  const chave = `parceiro.auditoria.recurso.${evento.recursoTipo.replace(/-/g, '_')}`

  return evento.recursoTipo !== 'outro' && te(chave)
    ? t(chave)
    : t('parceiro.auditoria.recurso.outro', { tipo: evento.recursoTipo })
}

function acaoLida(evento: EventoDaTrilha): AcaoLida {
  if (evento.acao !== 'ALTERAR') return evento.acao

  const marcador = evento.campos.find((campo) => MARCADORES.has(campo))

  return (marcador && MARCADORES.get(marcador)) || evento.acao
}

/** Os campos de verdade: o marcador de criação ou exclusão já virou o verbo da frase. */
function camposAlterados(evento: EventoDaTrilha) {
  return evento.campos.filter((campo) => !MARCADORES.has(campo))
}

/** O que fica embaixo da frase: em nome de quem, os campos, o protocolo do suporte. */
function detalhes(evento: EventoDaTrilha) {
  const partes: string[] = []
  const profissional = evento.profissional

  /*
   * A pessoa e a ficha de profissional têm ids de tabelas diferentes: quem clicou e quem assina são a
   * mesma pessoa quando o nome é o mesmo, e aí "em nome de" só repetiria o nome.
   */
  if (profissional?.nome && profissional.nome.trim() !== evento.usuario?.nome?.trim()) {
    partes.push(t('parceiro.auditoria.emNomeDe', { nome: profissional.nome }))
  }

  const campos = camposAlterados(evento)

  if (campos.length > 0) {
    partes.push(t('parceiro.auditoria.campos', { campos: campos.join(', ') }))
  }

  if (evento.protocolo) {
    partes.push(t('parceiro.auditoria.protocolo', { protocolo: evento.protocolo }))
  }

  return partes.join(' · ')
}

function hora(evento: EventoDaTrilha) {
  return new Date(evento.em).toLocaleTimeString(intl.value, { hour: '2-digit', minute: '2-digit' })
}

function chaveDoDia(data: Date) {
  return `${data.getFullYear()}-${data.getMonth()}-${data.getDate()}`
}

function rotuloDoDia(data: Date) {
  const hoje = new Date()
  const ontem = new Date()
  ontem.setDate(hoje.getDate() - 1)

  const extenso = data.toLocaleDateString(intl.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: data.getFullYear() === hoje.getFullYear() ? undefined : 'numeric',
  })

  if (chaveDoDia(data) === chaveDoDia(hoje)) {
    return t('parceiro.auditoria.dia.hoje', { data: extenso })
  }

  if (chaveDoDia(data) === chaveDoDia(ontem)) {
    return t('parceiro.auditoria.dia.ontem', { data: extenso })
  }

  return extenso.charAt(0).toLocaleUpperCase(intl.value) + extenso.slice(1)
}

/** Os eventos por dia, na ordem em que a API mandou (do mais novo para o mais antigo). */
const dias = computed(() => {
  const grupos: Array<{ chave: string; rotulo: string; eventos: EventoDaTrilha[] }> = []

  for (const evento of eventos.value) {
    const data = new Date(evento.em)
    const chave = chaveDoDia(data)
    const ultimo = grupos[grupos.length - 1]

    if (ultimo?.chave === chave) {
      ultimo.eventos.push(evento)
    } else {
      grupos.push({ chave, rotulo: rotuloDoDia(data), eventos: [evento] })
    }
  }

  return grupos
})

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

/*
 * O vazio que ensina (o desenho de Acessos, 17/11/2026): sem nenhum evento, como a trilha se enche,
 * em três etapas. A trilha se escreve sozinha quando a equipe usa o prontuário: a primeira etapa
 * leva aos Pacientes, para quem abre a Clínica (17/11/2026, "o sistema deve chamar o usuário"); o
 * portal anota sozinho e a consulta é nesta tela, sem botão. Com filtro, o vazio é do filtro, e a
 * saída é limpar.
 */
const { podeAbrir } = useAcessoAosModulos()

const passosDaAuditoria = computed<PassoDoGuia[]>(() =>
  [
    { id: 'acao', icone: 'ph ph-clipboard-text' },
    { id: 'anota', icone: 'ph ph-scroll' },
    { id: 'consulta', icone: 'ph ph-funnel' },
  ].map(({ id, icone }) => ({
    id,
    icone,
    titulo: t(`parceiro.auditoria.guia.${id}.titulo`),
    texto: t(`parceiro.auditoria.guia.${id}.texto`),
    acao:
      id === 'acao' && podeAbrir('/clinica/pacientes')
        ? {
            rotulo: t('parceiro.auditoria.guia.abrirPacientes'),
            icone: 'ph ph-users',
            to: '/clinica/pacientes',
          }
        : undefined,
  })),
)
</script>

<template>
  <UiPagina
    class="tela-auditoria"
    :titulo="t('parceiro.equipe.titulo')"
    :resumo="t('parceiro.auditoria.resumo')"
    :carregando="bootstrapping || (store.loadState === 'loading' && !store.dashboard)"
    :erro="loadError"
    :sem-acesso-de-parceiro="store.semAcessoParceiro"
    @tentar-de-novo="ensureContext(true)"
  >
    <div class="auditoria">
      <div
        v-if="!semPermissao"
        class="filtros"
        role="search"
        :aria-label="t('parceiro.auditoria.filtros.rotulo')"
      >
        <div class="filtro">
          <span id="filtro-acao" class="filtro__rotulo">{{
            t('parceiro.auditoria.filtros.acao')
          }}</span>
          <Select
            v-model="acao"
            :options="acaoOptions"
            option-label="rotulo"
            option-value="valor"
            show-clear
            :placeholder="t('parceiro.auditoria.filtros.todas')"
            aria-labelledby="filtro-acao"
          />
        </div>

        <div v-if="pessoas.length > 0" class="filtro">
          <span id="filtro-pessoa" class="filtro__rotulo">{{
            t('parceiro.auditoria.filtros.pessoa')
          }}</span>
          <Select
            v-model="pessoa"
            :options="pessoas"
            option-label="rotulo"
            option-value="valor"
            show-clear
            filter
            :placeholder="t('parceiro.auditoria.filtros.todos')"
            aria-labelledby="filtro-pessoa"
          />
        </div>

        <div class="filtro">
          <label class="filtro__rotulo" for="filtro-periodo">{{
            t('parceiro.auditoria.filtros.periodo')
          }}</label>
          <DatePicker
            v-model="periodo"
            input-id="filtro-periodo"
            selection-mode="range"
            :manual-input="false"
            :max-date="new Date()"
            show-icon
            icon-display="input"
            show-button-bar
            :placeholder="t('parceiro.auditoria.filtros.qualquerData')"
            @hide="aoFecharPeriodo"
          />
        </div>

        <Button
          v-if="comFiltro"
          class="filtros__limpar"
          icon="ph ph-x"
          :label="t('parceiro.auditoria.filtros.limpar')"
          severity="secondary"
          outlined
          size="small"
          @click="limparFiltros"
        />
      </div>

      <div v-if="erro" class="aviso ui-folha" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <p>{{ erro }}</p>
        <Button
          v-if="!semPermissao"
          :label="t('parceiro.auditoria.tentar')"
          severity="secondary"
          outlined
          size="small"
          @click="carregar"
        />
      </div>

      <div
        v-else-if="!carregado"
        class="dias"
        role="status"
        aria-busy="true"
        :aria-label="t('parceiro.auditoria.carregando')"
      >
        <Skeleton v-for="n in 4" :key="n" height="3.5rem" border-radius="12px" />
      </div>

      <UiVazioIlustrado
        v-else-if="eventos.length === 0 && !comFiltro"
        icone="ph ph-list-magnifying-glass"
        :titulo="t('parceiro.auditoria.vazio.titulo')"
        :texto="t('parceiro.auditoria.vazio.texto')"
        :guia-titulo="t('parceiro.auditoria.guia.titulo')"
        :passos="passosDaAuditoria"
      />

      <!-- Vazio por filtro é outro problema: a saída é limpar o filtro. -->
      <div v-else-if="eventos.length === 0" class="ui-folha ui-vazio vazio">
        <i class="ph ph-list-magnifying-glass" aria-hidden="true" />
        <strong>{{ t('parceiro.auditoria.vazio.filtrado') }}</strong>
        <Button
          :label="t('parceiro.auditoria.filtros.limpar')"
          severity="secondary"
          outlined
          size="small"
          @click="limparFiltros"
        />
      </div>

      <div v-else class="dias" :aria-busy="carregando">
        <section v-for="dia in dias" :key="dia.chave" class="dia">
          <h2 class="dia__titulo">{{ dia.rotulo }}</h2>
          <ol class="eventos ui-folha">
            <li v-for="evento in dia.eventos" :key="evento.id" class="evento">
              <time class="evento__hora ui-num" :datetime="evento.em">{{ hora(evento) }}</time>
              <span class="evento__icone" aria-hidden="true">
                <i :class="ICONE_DA_ACAO[acaoLida(evento)]" />
              </span>
              <span class="evento__texto">
                <span class="evento__frase">
                  <strong>{{ quem(evento) }}</strong>
                  {{
                    t(`parceiro.auditoria.frase.${acaoLida(evento)}`, { recurso: recurso(evento) })
                  }}
                </span>
                <small v-if="detalhes(evento)" class="evento__detalhe">{{
                  detalhes(evento)
                }}</small>
              </span>
              <span v-if="evento.ator !== 'EQUIPE'" class="ui-selo evento__ator">
                {{ t(`parceiro.auditoria.ator.selo.${evento.ator}`) }}
              </span>
            </li>
          </ol>
        </section>

        <Button
          v-if="proximoCursor"
          class="dias__mais"
          :label="t('parceiro.auditoria.mais')"
          severity="secondary"
          outlined
          :loading="carregandoMais"
          @click="carregarMais"
        />
      </div>
    </div>
  </UiPagina>
</template>

<style scoped>
.auditoria {
  display: grid;
  gap: 22px;
}

/* ------------------------------------------------------------------------------ filtros */

.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 16px;
}

.filtro {
  display: grid;
  gap: 6px;
  min-width: 12rem;
}

.filtro__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.filtros__limpar {
  margin-bottom: 2px;
}

/* ------------------------------------------------------------------------------ lista */

.dias {
  display: grid;
  gap: 22px;
}

.dias__mais {
  justify-self: center;
}

.dia {
  display: grid;
  gap: 10px;
}

.dia__titulo {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 650;
}

.eventos {
  display: grid;
  margin: 0;
  padding: 4px 18px;
  list-style: none;
}

.evento {
  display: grid;
  grid-template-columns: 3.25rem 32px minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--linha);
}

.evento:first-child {
  border-top: 0;
}

.evento__hora {
  padding-top: 7px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.evento__icone {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 16px;
}

.evento__texto {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding-top: 5px;
}

.evento__frase {
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.evento__frase strong {
  font-weight: 650;
}

.evento__detalhe {
  overflow-wrap: anywhere;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.45;
}

.evento__ator {
  margin-top: 5px;
}

.aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 14px 18px;
  color: var(--tinta);
  font-size: 14px;
}

.aviso p {
  flex: 1;
  margin: 0;
}

.aviso > i {
  color: var(--risco-tinta);
  font-size: 18px;
}

.vazio > i {
  color: var(--tinta-3);
  font-size: 22px;
}
</style>
