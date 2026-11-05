<script setup lang="ts">
/**
 * Bloqueios (E3-01, seção 1.5): as ocorrências das próximas quatro semanas, já materializadas pela
 * API no fuso da clínica (a série vem uma linha por dia, sem os dias cancelados). Filtrar por
 * profissional ou sala traz também os da clínica toda, que valem para todos.
 *
 * O bloqueio de toda semana aparece uma vez só, com os dias da semana da regra (`GET
 * /bloqueios/:id`); o lápis e a lixeira dele valem para a série. Mudar ou tirar só um dia sai de
 * "Ver os dias", que abre as datas da série no período. O bloqueio único fica no dia em que começa.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Menu from 'primevue/menu'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BloqueioGaveta, { type ModoDaGaveta } from '@/components/agenda/BloqueioGaveta.vue'
import {
  diaDaSemanaDe,
  diasDaSemanaNoPeriodo,
  partesDosDias,
  separarBloqueios,
  type SerieDaLista,
} from '@/components/agenda/bloqueios'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  apagarBloqueio,
  diaLocal,
  listarBloqueios,
  listarSalas,
  obterBloqueio,
  type Bloqueio,
  type OcorrenciaDeBloqueio,
  type Sala,
} from '@/service/parceiro/agenda-config-service'
import { listarProfissionais } from '@/service/parceiro/profissionais-service'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

const props = defineProps<{ podeEditar: boolean }>()

const { t } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

/** As próximas quatro semanas: o que a recepção precisa ver para marcar. */
const DIAS_DO_PERIODO = 28

const ocorrencias = ref<OcorrenciaDeBloqueio[]>([])
const fuso = ref('America/Sao_Paulo')
const salas = ref<Sala[]>([])
const profissionais = ref<{ id: string; nome: string }[]>([])
const carregando = ref(true)
const erro = ref('')

/**
 * A regra de cada série (dias da semana e fim), lida uma vez por série. Trocar o filtro reaproveita;
 * qualquer escrita limpa, porque a regra pode ter mudado.
 */
const regras = ref<Record<string, Bloqueio>>({})

type Filtro = { tipo: 'todos' } | { tipo: 'profissional' | 'sala'; id: string }
const filtro = ref<string>('todos')

const opcoesDeFiltro = computed(() => [
  { valor: 'todos', rotulo: t('agenda.config.bloqueio.todos') },
  ...profissionais.value.map((item) => ({ valor: `p:${item.id}`, rotulo: item.nome })),
  ...salas.value
    .filter((sala) => sala.ativa)
    .map((sala) => ({ valor: `s:${sala.id}`, rotulo: sala.nome })),
])

function filtroAtual(): Filtro {
  if (filtro.value.startsWith('p:')) return { tipo: 'profissional', id: filtro.value.slice(2) }
  if (filtro.value.startsWith('s:')) return { tipo: 'sala', id: filtro.value.slice(2) }
  return { tipo: 'todos' }
}

async function carregarApoio() {
  const [listaDeSalas, listaDeProfissionais] = await Promise.all([
    listarSalas(parceiroQuery()).catch(() => [] as Sala[]),
    listarProfissionais({ ...parceiroQuery(), ativo: true }).catch(() => []),
  ])
  salas.value = listaDeSalas
  profissionais.value = listaDeProfissionais.map((item) => ({ id: item.id, nome: item.nome }))
}

/* Trocar o filtro antes de a resposta chegar: a lista do filtro anterior não vale mais. */
const leitura = criarUltimaLeitura()

/** As regras que faltam. A que não vier fica com o retrato do período (os dias em que aparece). */
async function lerRegras(lista: OcorrenciaDeBloqueio[]) {
  const faltam = [
    ...new Set(lista.filter((item) => item.recorrente).map((item) => item.bloqueioId)),
  ].filter((id) => !regras.value[id])

  if (!faltam.length) return {}

  const lidas = await Promise.allSettled(faltam.map((id) => obterBloqueio(id, parceiroQuery())))
  const novas: Record<string, Bloqueio> = {}

  for (const lida of lidas) {
    if (lida.status === 'fulfilled') novas[lida.value.id] = lida.value
  }

  return novas
}

async function carregar() {
  const vez = leitura.nova()
  carregando.value = true
  erro.value = ''

  const hoje = new Date()
  const ate = new Date(hoje)
  ate.setDate(ate.getDate() + DIAS_DO_PERIODO - 1)
  const atual = filtroAtual()

  try {
    const periodo = await listarBloqueios(
      {
        de: diaLocal(hoje),
        ate: diaLocal(ate),
        profissionalId: atual.tipo === 'profissional' ? atual.id : null,
        salaId: atual.tipo === 'sala' ? atual.id : null,
      },
      parceiroQuery(),
    )
    if (!leitura.valendo(vez)) return
    const novas = await lerRegras(periodo.ocorrencias)
    if (!leitura.valendo(vez)) return
    regras.value = { ...regras.value, ...novas }
    fuso.value = periodo.fuso
    ocorrencias.value = periodo.ocorrencias
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDoCadastro(err, t('agenda.config.erroAoCarregar')).mensagem
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

/** Depois de criar, editar ou apagar: a regra de qualquer série pode ter mudado. */
function recarregar() {
  regras.value = {}
  return carregar()
}

onMounted(async () => {
  await carregarApoio()
  await carregar()
})

watch(filtro, () => void carregar())

const lista = computed(() => separarBloqueios(ocorrencias.value))

/* ------------------------------------------------------------------------------- leitura */

function horas(item: OcorrenciaDeBloqueio) {
  const inicio = item.inicio.slice(11, 16)
  const fim = item.fim.slice(11, 16)
  const outroDia = item.fim.slice(0, 10) !== item.inicio.slice(0, 10)

  return outroDia
    ? t('agenda.config.bloqueio.ateOutroDia', {
        inicio,
        fim,
        dia: rotulos.dia(item.fim.slice(0, 10)),
      })
    : t('agenda.config.bloqueio.horas', { inicio, fim })
}

/** A série que passa da meia-noite termina sempre no dia seguinte ao de cada ocorrência. */
function horasDaSerie(item: OcorrenciaDeBloqueio) {
  const inicio = item.inicio.slice(11, 16)
  const fim = item.fim.slice(11, 16)

  return item.fim.slice(0, 10) !== item.inicio.slice(0, 10)
    ? t('agenda.config.bloqueio.ateDiaSeguinte', { inicio, fim })
    : t('agenda.config.bloqueio.horas', { inicio, fim })
}

function alcanceDe(item: OcorrenciaDeBloqueio) {
  if (item.profissionalId) {
    return (
      profissionais.value.find((p) => p.id === item.profissionalId)?.nome ??
      t('agenda.config.bloqueio.alcance.profissional')
    )
  }
  if (item.salaId)
    return (
      salas.value.find((s) => s.id === item.salaId)?.nome ??
      t('agenda.config.bloqueio.alcance.sala')
    )
  return t('agenda.config.bloqueio.alcance.clinica')
}

function diaCurto(diaDaSemana: number) {
  return t(`agenda.config.bloqueio.diaCurto.${diaDaSemana}`)
}

/** "Seg a Sex", "Seg, Qua e Sex", "Todos os dias", na forma de lista do idioma. */
function textoDosDias(dias: readonly number[]) {
  const partes = partesDosDias(dias)

  if (partes[0]?.tipo === 'todos') return t('agenda.config.bloqueio.semana.todos')

  const textos = partes.map((parte) =>
    parte.tipo === 'faixa'
      ? t('agenda.config.bloqueio.semana.faixa', {
          de: diaCurto(parte.de),
          ate: diaCurto(parte.ate),
        })
      : parte.tipo === 'dia'
        ? diaCurto(parte.dia)
        : '',
  )

  return new Intl.ListFormat(rotulos.intl(), { type: 'conjunction' }).format(textos)
}

function quandoDaSerie(serie: SerieDaLista) {
  const regra = regras.value[serie.bloqueioId]
  const dias = textoDosDias(regra?.diasDaSemana ?? diasDaSemanaNoPeriodo(serie))

  return regra?.repeteAte
    ? t('agenda.config.bloqueio.diasAte', { dias, dia: rotulos.dia(regra.repeteAte) })
    : dias
}

function metaDaSerie(serie: SerieDaLista) {
  return [quandoDaSerie(serie), alcanceDe(serie.primeira), serie.primeira.detalhe]
    .filter(Boolean)
    .join(' · ')
}

function diaDaSemana(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Intl.DateTimeFormat(rotulos.intl(), { weekday: 'long', timeZone: 'UTC' }).format(
    Date.UTC(ano!, mes! - 1, dia!),
  )
}

/** "Sex 06/11": o botão do dia dentro da série. */
function diaDoBotao(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  const numeros = new Intl.DateTimeFormat(rotulos.intl(), {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(Date.UTC(ano!, mes! - 1, dia!))

  return `${diaCurto(diaDaSemanaDe(data))} ${numeros}`
}

function diaPorExtenso(data: string) {
  return `${diaDaSemana(data)}, ${rotulos.dia(data)}`
}

/* ------------------------------------------------------------------- os dias da série */

const abertas = reactive(new Set<string>())

function alternarDias(bloqueioId: string) {
  if (abertas.has(bloqueioId)) abertas.delete(bloqueioId)
  else abertas.add(bloqueioId)
}

const menuDoDia = ref<InstanceType<typeof Menu> | null>(null)
const doMenu = ref<OcorrenciaDeBloqueio | null>(null)

const itensDoMenu = computed(() => {
  const dia = doMenu.value
  if (!dia) return []

  return [
    {
      label: t('agenda.config.bloqueio.editarDia'),
      icon: 'ph ph-pencil-simple',
      command: () => editarDia(dia),
    },
    {
      label: t('agenda.config.bloqueio.tirarDia'),
      icon: 'ph ph-calendar-minus',
      command: () => pedirApagar('dia', dia),
    },
  ]
})

function abrirMenuDoDia(evento: Event, dia: OcorrenciaDeBloqueio) {
  doMenu.value = dia
  menuDoDia.value?.toggle(evento)
}

/* ------------------------------------------------------------------ criar e editar */

const gaveta = ref(false)
const modo = ref<ModoDaGaveta>({ tipo: 'novo' })

function novo() {
  modo.value = { tipo: 'novo' }
  gaveta.value = true
}

function editarDia(dia: OcorrenciaDeBloqueio) {
  modo.value = { tipo: 'dia', ocorrencia: dia }
  gaveta.value = true
}

/** A série ou o bloqueio único inteiro: a regra vem fresca da API para não sobrescrever nada. */
const abrindo = ref<string | null>(null)

async function abrirSerie(item: OcorrenciaDeBloqueio) {
  abrindo.value = item.bloqueioId

  try {
    modo.value = { tipo: 'serie', bloqueio: await obterBloqueio(item.bloqueioId, parceiroQuery()) }
    gaveta.value = true
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('agenda.config.erroAoCarregar')).mensagem,
      life: 6000,
    })
  } finally {
    abrindo.value = null
  }
}

/* ------------------------------------------------------------------------------ apagar */

type AlcanceDoApagar = 'serie' | 'dia' | 'unico'

const pergunta = ref<{ alcance: AlcanceDoApagar; ocorrencia: OcorrenciaDeBloqueio } | null>(null)
const ocupado = ref(false)

function pedirApagar(alcance: AlcanceDoApagar, ocorrencia: OcorrenciaDeBloqueio) {
  pergunta.value = { alcance, ocorrencia }
}

const textoDaPergunta = computed(() => {
  const atual = pergunta.value
  if (!atual) return ''
  if (atual.alcance === 'dia') {
    return t('agenda.config.bloqueio.tirarDiaTexto', { dia: diaPorExtenso(atual.ocorrencia.data) })
  }
  return atual.alcance === 'serie'
    ? t('agenda.config.bloqueio.apagarSerieTexto')
    : t('agenda.config.bloqueio.apagarUnico')
})

async function confirmarApagar() {
  const atual = pergunta.value
  if (!atual) return

  ocupado.value = true

  try {
    await apagarBloqueio(
      atual.ocorrencia.bloqueioId,
      atual.alcance === 'dia' ? atual.ocorrencia.data : null,
      parceiroQuery(),
    )
    pergunta.value = null
    toast.add({
      severity: 'success',
      summary:
        atual.alcance === 'dia'
          ? t('agenda.config.bloqueio.diaTirado')
          : t('agenda.config.bloqueio.apagado'),
      life: 3000,
    })
    await recarregar()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    ocupado.value = false
  }
}
</script>

<template>
  <section class="ui-folha ui-cartao blq" aria-labelledby="bloqueios-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-calendar-x" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="bloqueios-titulo" class="ui-cartao__titulo">
          {{ t('agenda.config.bloqueio.titulo') }}
        </h2>
        <p class="ui-cartao__descricao">{{ t('agenda.config.bloqueio.descricao') }}</p>
      </span>
      <Button
        v-if="props.podeEditar"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('agenda.config.bloqueio.novo')"
        @click="novo"
      />
    </header>

    <div class="blq__filtro">
      <Select
        v-model="filtro"
        :options="opcoesDeFiltro"
        option-label="rotulo"
        option-value="valor"
        :aria-label="t('agenda.config.bloqueio.filtro')"
      />
      <span class="blq__periodo">{{
        t('agenda.config.bloqueio.periodo', { n: DIAS_DO_PERIODO })
      }}</span>
    </div>

    <p v-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="carregar"
      />
    </p>

    <div v-if="carregando && !ocorrencias.length" class="blq__esqueleto" aria-busy="true">
      <Skeleton v-for="n in 3" :key="n" height="3rem" />
    </div>

    <p v-else-if="!ocorrencias.length" class="blq__vazio">
      {{ t('agenda.config.bloqueio.vazio') }}
    </p>

    <div v-else class="blq__dias">
      <section
        v-if="lista.series.length"
        class="blq__dia"
        :aria-label="t('agenda.config.bloqueio.todaSemana')"
      >
        <h3 class="eg__grupo-titulo">{{ t('agenda.config.bloqueio.todaSemana') }}</h3>
        <ul class="ui-lista">
          <li v-for="serie in lista.series" :key="serie.bloqueioId">
            <div class="ui-linha">
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo">
                  <span class="ui-num">{{ horasDaSerie(serie.primeira) }}</span>
                  · {{ t(`agenda.config.bloqueio.motivo.${serie.primeira.motivo}`) }}
                </strong>
                <span class="ui-linha__meta">{{ metaDaSerie(serie) }}</span>
              </span>
              <span v-if="props.podeEditar" class="ui-linha__fim blq__acoes">
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  :icon="abertas.has(serie.bloqueioId) ? 'ph ph-caret-up' : 'ph ph-caret-down'"
                  icon-pos="right"
                  :label="t('agenda.config.bloqueio.verDias')"
                  :aria-expanded="abertas.has(serie.bloqueioId)"
                  :aria-controls="`blq-dias-${serie.bloqueioId}`"
                  @click="alternarDias(serie.bloqueioId)"
                />
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="ph ph-pencil-simple"
                  :loading="abrindo === serie.bloqueioId"
                  :aria-label="t('agenda.config.bloqueio.editarSerie')"
                  @click="abrirSerie(serie.primeira)"
                />
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  icon="ph ph-trash"
                  :aria-label="t('agenda.config.bloqueio.apagar')"
                  @click="pedirApagar('serie', serie.primeira)"
                />
              </span>
            </div>
            <Transition name="blq-abre">
              <div
                v-if="props.podeEditar && abertas.has(serie.bloqueioId)"
                :id="`blq-dias-${serie.bloqueioId}`"
                class="blq__datas"
              >
                <p class="blq__datas-dica">{{ t('agenda.config.bloqueio.diasDica') }}</p>
                <div class="blq__datas-lista">
                  <Button
                    v-for="dia in serie.dias"
                    :key="dia.data"
                    type="button"
                    size="small"
                    severity="secondary"
                    outlined
                    class="ui-num"
                    :label="diaDoBotao(dia.data)"
                    :aria-label="diaPorExtenso(dia.data)"
                    aria-haspopup="menu"
                    @click="abrirMenuDoDia($event, dia)"
                  />
                </div>
              </div>
            </Transition>
          </li>
        </ul>
      </section>

      <section
        v-for="grupo in lista.dias"
        :key="grupo.data"
        class="blq__dia"
        :aria-label="rotulos.dia(grupo.data)"
      >
        <h3 class="eg__grupo-titulo">{{ diaPorExtenso(grupo.data) }}</h3>
        <ul class="ui-lista">
          <li v-for="item in grupo.itens" :key="item.bloqueioId" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">
                <span class="ui-num">{{ horas(item) }}</span>
                · {{ t(`agenda.config.bloqueio.motivo.${item.motivo}`) }}
              </strong>
              <span class="ui-linha__meta">
                {{ [alcanceDe(item), item.detalhe].filter(Boolean).join(' · ') }}
              </span>
            </span>
            <span v-if="props.podeEditar" class="ui-linha__fim blq__acoes">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-pencil-simple"
                :loading="abrindo === item.bloqueioId"
                :aria-label="t('agenda.config.bloqueio.editar')"
                @click="abrirSerie(item)"
              />
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-trash"
                :aria-label="t('agenda.config.bloqueio.apagar')"
                @click="pedirApagar('unico', item)"
              />
            </span>
          </li>
        </ul>
      </section>
    </div>

    <Menu ref="menuDoDia" :model="itensDoMenu" popup />

    <BloqueioGaveta
      v-model:visible="gaveta"
      :modo="modo"
      :fuso="fuso"
      :salas="salas"
      :profissionais="profissionais"
      @salvo="recarregar"
    />

    <Dialog
      :visible="pergunta !== null"
      modal
      :closable="!ocupado"
      :header="
        pergunta?.alcance === 'dia'
          ? t('agenda.config.bloqueio.tirarDiaTitulo')
          : t('agenda.config.bloqueio.apagarTitulo')
      "
      class="blq__pergunta"
      @update:visible="(aberto: boolean) => !aberto && (pergunta = null)"
    >
      <p class="blq__pergunta-texto">{{ textoDaPergunta }}</p>
      <template #footer>
        <Button
          type="button"
          :label="t('cadastro.voltar')"
          severity="secondary"
          outlined
          :disabled="ocupado"
          @click="pergunta = null"
        />
        <Button
          type="button"
          severity="danger"
          :label="
            pergunta?.alcance === 'dia'
              ? t('agenda.config.bloqueio.tirarEsteDia')
              : t('agenda.config.bloqueio.apagar')
          "
          :loading="ocupado"
          @click="confirmarApagar"
        />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.blq {
  display: grid;
  gap: 14px;
}

.blq__filtro {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.blq__filtro :deep(.p-select) {
  min-width: 14rem;
}

.blq__periodo,
.blq__vazio {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.blq__esqueleto,
.blq__dias {
  display: grid;
  gap: 16px;
}

.blq__dia {
  display: grid;
  gap: 6px;
}

.blq__acoes {
  display: inline-flex;
  gap: 6px;
}

/* Os dias da série, embaixo dela e no mesmo recuo do texto da linha. */
.blq__datas {
  display: grid;
  gap: 8px;
  padding: 0 10px 14px;
}

.blq__datas-dica {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.blq__datas-lista {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.blq-abre-enter-active,
.blq-abre-leave-active {
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out;
}

.blq-abre-enter-from,
.blq-abre-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .blq-abre-enter-active,
  .blq-abre-leave-active {
    transition: none;
  }
}

.blq__pergunta-texto {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}
</style>
