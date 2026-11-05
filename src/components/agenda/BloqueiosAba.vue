<script setup lang="ts">
/**
 * Bloqueios (E3-01, seção 1.5): as ocorrências das próximas quatro semanas, já materializadas pela
 * API no fuso da clínica (a série vem uma linha por dia, sem os dias cancelados). Filtrar por
 * profissional ou sala traz também os da clínica toda, que valem para todos.
 *
 * Editar ou apagar uma ocorrência de série pergunta "só neste dia" ou "a série inteira". O
 * bloqueio único se edita e se apaga inteiro.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BloqueioGaveta, { type ModoDaGaveta } from '@/components/agenda/BloqueioGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  apagarBloqueio,
  diaLocal,
  listarBloqueios,
  listarSalas,
  obterBloqueio,
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
    fuso.value = periodo.fuso
    ocorrencias.value = periodo.ocorrencias
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDoCadastro(err, t('agenda.config.erroAoCarregar')).mensagem
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

onMounted(async () => {
  await carregarApoio()
  await carregar()
})

watch(filtro, () => void carregar())

/** Por dia, na ordem do relógio. */
const porDia = computed(() => {
  const grupos = new Map<string, OcorrenciaDeBloqueio[]>()

  for (const item of [...ocorrencias.value].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const lista = grupos.get(item.data) ?? []
    lista.push(item)
    grupos.set(item.data, lista)
  }

  return [...grupos.entries()].map(([data, itens]) => ({ data, itens }))
})

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

function diaDaSemana(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Intl.DateTimeFormat(rotulos.intl(), { weekday: 'long', timeZone: 'UTC' }).format(
    Date.UTC(ano!, mes! - 1, dia!),
  )
}

/* ------------------------------------------------------------------ criar e editar */

const gaveta = ref(false)
const modo = ref<ModoDaGaveta>({ tipo: 'novo' })

function novo() {
  modo.value = { tipo: 'novo' }
  gaveta.value = true
}

/* "Só neste dia" ou "a série": a mesma pergunta para editar e apagar. */
const pergunta = ref<{ acao: 'editar' | 'apagar'; ocorrencia: OcorrenciaDeBloqueio } | null>(null)
const ocupado = ref(false)

function editar(item: OcorrenciaDeBloqueio) {
  if (item.recorrente) {
    pergunta.value = { acao: 'editar', ocorrencia: item }
  } else {
    void abrirSerie(item)
  }
}

function apagar(item: OcorrenciaDeBloqueio) {
  pergunta.value = { acao: 'apagar', ocorrencia: item }
}

async function abrirSerie(item: OcorrenciaDeBloqueio) {
  ocupado.value = true

  try {
    modo.value = { tipo: 'serie', bloqueio: await obterBloqueio(item.bloqueioId, parceiroQuery()) }
    pergunta.value = null
    gaveta.value = true
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('agenda.config.erroAoCarregar')).mensagem,
      life: 6000,
    })
  } finally {
    ocupado.value = false
  }
}

async function responder(alcance: 'dia' | 'serie' | 'unico') {
  const atual = pergunta.value
  if (!atual) return

  if (atual.acao === 'editar') {
    if (alcance === 'dia') {
      modo.value = { tipo: 'dia', ocorrencia: atual.ocorrencia }
      pergunta.value = null
      gaveta.value = true
    } else {
      await abrirSerie(atual.ocorrencia)
    }
    return
  }

  ocupado.value = true

  try {
    await apagarBloqueio(
      atual.ocorrencia.bloqueioId,
      alcance === 'dia' ? atual.ocorrencia.data : null,
      parceiroQuery(),
    )
    pergunta.value = null
    toast.add({ severity: 'success', summary: t('agenda.config.bloqueio.apagado'), life: 3000 })
    await carregar()
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
        v-for="grupo in porDia"
        :key="grupo.data"
        class="blq__dia"
        :aria-label="rotulos.dia(grupo.data)"
      >
        <h3 class="eg__grupo-titulo">
          {{ diaDaSemana(grupo.data) }}, {{ rotulos.dia(grupo.data) }}
        </h3>
        <ul class="ui-lista">
          <li v-for="item in grupo.itens" :key="`${item.bloqueioId}-${item.data}`" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo blq__titulo">
                <span class="ui-num">{{ horas(item) }}</span>
                · {{ t(`agenda.config.bloqueio.motivo.${item.motivo}`) }}
                <span v-if="item.recorrente" class="ui-selo">
                  <i class="ph ph-repeat" aria-hidden="true" />
                  {{ t('agenda.config.bloqueio.todaSemana') }}
                </span>
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
                :aria-label="t('agenda.config.bloqueio.editar')"
                @click="editar(item)"
              />
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-trash"
                :aria-label="t('agenda.config.bloqueio.apagar')"
                @click="apagar(item)"
              />
            </span>
          </li>
        </ul>
      </section>
    </div>

    <BloqueioGaveta
      v-model:visible="gaveta"
      :modo="modo"
      :fuso="fuso"
      :salas="salas"
      :profissionais="profissionais"
      @salvo="carregar"
    />

    <Dialog
      :visible="pergunta !== null"
      modal
      :closable="!ocupado"
      :header="
        pergunta?.acao === 'apagar'
          ? t('agenda.config.bloqueio.apagarTitulo')
          : t('agenda.config.bloqueio.editarTitulo')
      "
      class="blq__pergunta"
      @update:visible="(aberto: boolean) => !aberto && (pergunta = null)"
    >
      <p class="blq__pergunta-texto">
        {{
          pergunta?.ocorrencia.recorrente
            ? t('agenda.config.bloqueio.qualParte', { dia: rotulos.dia(pergunta.ocorrencia.data) })
            : t('agenda.config.bloqueio.apagarUnico')
        }}
      </p>
      <template #footer>
        <Button
          type="button"
          :label="t('cadastro.voltar')"
          severity="secondary"
          outlined
          :disabled="ocupado"
          @click="pergunta = null"
        />
        <template v-if="pergunta?.ocorrencia.recorrente">
          <Button
            type="button"
            severity="secondary"
            outlined
            :label="t('agenda.config.bloqueio.soNesteDia')"
            :loading="ocupado"
            @click="responder('dia')"
          />
          <Button
            type="button"
            :severity="pergunta.acao === 'apagar' ? 'danger' : undefined"
            :label="t('agenda.config.bloqueio.aSerie')"
            :loading="ocupado"
            @click="responder('serie')"
          />
        </template>
        <Button
          v-else
          type="button"
          severity="danger"
          :label="t('agenda.config.bloqueio.apagar')"
          :loading="ocupado"
          @click="responder('unico')"
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

.blq__titulo {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.blq__acoes {
  display: inline-flex;
  gap: 6px;
}

.blq__pergunta-texto {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}
</style>
