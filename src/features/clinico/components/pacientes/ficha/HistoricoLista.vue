<script setup lang="ts">
/**
 * O histórico do paciente numa lista só, do mais recente para trás.
 *
 * Eram duas listas lado a lado com os mesmos acontecimentos: a tabela de atendimentos (que ainda
 * abria pelos agendamentos **futuros**) e a linha do tempo. A auditoria mediu 3,9 telas de rolagem
 * para responder "o que aconteceu com este bicho". Agora:
 *
 * - **Uma linha por acontecimento**, com o que a tabela sabia (tipo, profissional, falta,
 *   cancelamento) e o que a linha do tempo sabia (diagnóstico, resumo, exame, vacina, internação).
 *   O elo é o `appointmentId` do evento; atendimento sem evento (o cancelado, a consulta sem
 *   diagnóstico) entra pela própria data.
 * - **Agrupada por mês**, para a pessoa se localizar sem ler data por data.
 * - **O futuro sai da lista.** O próximo agendamento vira uma linha no topo, e os demais ficam
 *   recolhidos atrás dela: histórico é o que já aconteceu.
 * - **Filtro por tipo** com a contagem, que responde "já operou?" antes de qualquer clique.
 *
 * Acabamento (20/10/2026): a linha do tempo é um cartão com cabeçalho (`ficha.css`), o total no
 * canto e o filtro numa faixa rente. Redesenho (19/10/2026): a data à esquerda (dia grande, hora embaixo), o ícone do tipo num fio
 * que liga os acontecimentos do mês, título e quem atendeu; falta e cancelamento com selo de
 * palavra. O filtro virou controle segmentado, com "Tudo" para voltar.
 */
import SelectButton from 'primevue/selectbutton'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'

import { useClinicFormat } from '../../../composables/useClinicFormat'
import type { Appointment, TimelineEvent, TimelineEventKind } from '../../../data/types'
import { clinicClock, useClinicoStore } from '../../../stores/clinico'

import './ficha.css'
import { ATENDIMENTO_ABERTO, atendimentosSemEvento } from './historico'

const props = defineProps<{
  eventos: TimelineEvent[]
  atendimentos: Appointment[]
}>()

const emit = defineEmits<{
  abrir: [encounterId: string]
}>()

const { t, locale } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

type Tipo = TimelineEventKind | 'cancelado'

type Item = {
  id: string
  tipo: Tipo
  em: string
  titulo: string
  /** "Consulta · Caio Nogueira": o tipo do atendimento e quem atendeu, quando há atendimento. */
  contexto: string
  resumo: string
  encounterId: string | null
  /** Falta e cancelado ganham selo: é o desfecho que muda a leitura da linha. */
  desfecho: 'falta' | 'cancelado' | null
}

const ICONE: Record<Tipo, string> = {
  consulta: 'ph ph-stethoscope',
  vacina: 'ph ph-syringe',
  exame: 'ph ph-test-tube',
  cirurgia: 'ph ph-scissors',
  internacao: 'ph ph-bed',
  prescricao: 'ph ph-pill',
  falta: 'ph ph-user-minus',
  observacao: 'ph ph-chat-text',
  cancelado: 'ph ph-calendar-x',
}

function contextoDo(atendimento: Appointment | undefined) {
  if (!atendimento) {
    return ''
  }

  return [
    clinico.tipo(atendimento.typeId)?.nome,
    clinico.profissional(atendimento.professionalId)?.nome,
  ]
    .filter(Boolean)
    .join(' · ')
}

function nomeDoTipo(tipo: Tipo) {
  return tipo === 'cancelado'
    ? formato.status('cancelado')
    : t(`clinico.prontuario.timeline.kind.${tipo}`)
}

const agoraIso = computed(() => clinicClock.nowIso())

/** O que já aconteceu: os eventos, mais o atendimento passado que não virou evento. */
const itens = computed<Item[]>(() => {
  const porId = new Map(props.atendimentos.map((item) => [item.id, item]))

  const doHistorico: Item[] = props.eventos.map((evento) => {
    const atendimento = evento.appointmentId ? porId.get(evento.appointmentId) : undefined

    return {
      id: evento.id,
      tipo: evento.kind,
      em: evento.em,
      titulo: evento.titulo || nomeDoTipo(evento.kind),
      contexto: contextoDo(atendimento),
      resumo: evento.resumo,
      encounterId: evento.encounterId,
      desfecho: evento.kind === 'falta' ? 'falta' : null,
    }
  })

  const semEvento: Item[] = atendimentosSemEvento(
    props.eventos,
    props.atendimentos,
    agoraIso.value,
  ).map((atendimento) => {
    const tipo: Tipo =
      atendimento.status === 'cancelado'
        ? 'cancelado'
        : atendimento.status === 'falta'
          ? 'falta'
          : 'consulta'

    return {
      id: atendimento.id,
      tipo,
      em: atendimento.inicio,
      titulo: clinico.tipo(atendimento.typeId)?.nome ?? nomeDoTipo(tipo),
      contexto: clinico.profissional(atendimento.professionalId)?.nome ?? '',
      resumo: atendimento.observacao,
      encounterId: atendimento.encounterId ?? null,
      desfecho: tipo === 'falta' || tipo === 'cancelado' ? tipo : null,
    }
  })

  return [...doHistorico, ...semEvento].sort((a, b) => b.em.localeCompare(a.em))
})

/** O que ainda vai acontecer, do mais próximo ao mais distante. */
const proximos = computed(() =>
  props.atendimentos
    .filter((item) => item.inicio > agoraIso.value && ATENDIMENTO_ABERTO.includes(item.status))
    .sort((a, b) => a.inicio.localeCompare(b.inicio)),
)

const proximosAbertos = ref(false)

function quando(iso: string) {
  return t('clinico.ficha.historico.quando', {
    data: formato.dataCurta(clinicClock.dateOf(iso)),
    hora: formato.hora(iso),
  })
}

type Filtro = Tipo | 'todos'

const filtro = ref<Filtro>('todos')

const tiposPresentes = computed(() => {
  const contagem = new Map<Tipo, number>()

  for (const item of itens.value) {
    contagem.set(item.tipo, (contagem.get(item.tipo) ?? 0) + 1)
  }

  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, total]) => ({ tipo, total }))
})

/**
 * "Tudo" primeiro, depois os tipos do mais frequente ao mais raro — com a contagem na opção. Sem
 * ícone: a palavra e o número cabem numa linha, e o ícone já está em cada acontecimento.
 */
const opcoesDoFiltro = computed(() => [
  {
    valor: 'todos' as Filtro,
    rotulo: t('clinico.paciente.atos.filtro.todos'),
    total: itens.value.length,
  },
  ...tiposPresentes.value.map((item) => ({
    valor: item.tipo as Filtro,
    rotulo: nomeDoTipo(item.tipo),
    total: item.total,
  })),
])

const nomeDoMes = computed(
  () =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale.value as Locale], {
      month: 'long',
      year: 'numeric',
    }),
)

/** O `Intl` escreve o mês em minúscula; o nome do bloco começa com maiúscula, como frase. */
function comInicial(texto: string) {
  return texto.charAt(0).toLocaleUpperCase(INTL_LOCALE[locale.value as Locale]) + texto.slice(1)
}

/** Os itens filtrados, em blocos de mês. */
const meses = computed(() => {
  const blocos: { chave: string; nome: string; itens: Item[] }[] = []
  const visiveis =
    filtro.value === 'todos'
      ? itens.value
      : itens.value.filter((item) => item.tipo === filtro.value)

  for (const item of visiveis) {
    const data = clinicClock.dateOf(item.em)
    const chave = data.slice(0, 7)
    let bloco = blocos.at(-1)

    if (!bloco || bloco.chave !== chave) {
      const [ano, mes] = chave.split('-').map(Number)
      bloco = {
        chave,
        nome: comInicial(nomeDoMes.value.format(new Date(ano!, mes! - 1, 1))),
        itens: [],
      }
      blocos.push(bloco)
    }

    bloco.itens.push(item)
  }

  return blocos
})

function abrir(item: Item) {
  if (item.encounterId) {
    emit('abrir', item.encounterId)
  }
}
</script>

<template>
  <div class="historico-lista">
    <!-- O próximo agendamento numa linha; os outros recolhidos atrás dela. -->
    <section
      v-if="proximos.length > 0"
      class="proximos ui-folha ui-marca ui-marca--lugar"
      :aria-label="t('clinico.ficha.historico.proximo')"
    >
      <div class="proximos__linha">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-calendar-plus" /></span>
        <span class="proximos__texto">
          <span class="proximos__rotulo">{{ t('clinico.ficha.historico.proximo') }}</span>
          <strong class="ui-num">{{ quando(proximos[0]!.inicio) }}</strong>
          <span class="proximos__contexto">{{ contextoDo(proximos[0]) }}</span>
        </span>
        <button
          v-if="proximos.length > 1"
          type="button"
          class="ui-mais proximos__alternar"
          :aria-expanded="proximosAbertos"
          aria-controls="historico-agendados"
          @click="proximosAbertos = !proximosAbertos"
        >
          {{
            proximosAbertos
              ? t('clinico.ficha.historico.ocultarAgendados')
              : t('clinico.ficha.historico.verAgendados', { n: proximos.length }, proximos.length)
          }}
          <i :class="proximosAbertos ? 'ph ph-caret-up' : 'ph ph-caret-down'" aria-hidden="true" />
        </button>
      </div>

      <ul v-show="proximosAbertos" id="historico-agendados" class="proximos__lista">
        <li v-for="item in proximos.slice(1)" :key="item.id">
          <span class="proximos__quando ui-num">{{ quando(item.inicio) }}</span>
          <span class="proximos__contexto">{{ contextoDo(item) }}</span>
          <span class="proximos__status">{{ formato.status(item.status) }}</span>
        </li>
      </ul>
    </section>

    <section class="ficha-cartao linha-do-tempo ui-folha" aria-labelledby="historico-linha-titulo">
      <header class="ficha-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true">
          <i class="ph ph-clock-counter-clockwise" />
        </span>
        <div class="ficha-cartao__titulos">
          <h2 id="historico-linha-titulo" class="ficha-cartao__titulo">
            {{ t('clinico.ficha.historico.linhaDoTempo') }}
          </h2>
        </div>
        <span v-if="itens.length" class="ficha-cartao__total ui-num">{{ itens.length }}</span>
      </header>

      <div v-if="tiposPresentes.length > 1" class="ficha-cartao__ferramentas filtro">
        <SelectButton
          v-model="filtro"
          :options="opcoesDoFiltro"
          option-label="rotulo"
          option-value="valor"
          data-key="valor"
          :allow-empty="false"
          size="small"
          :aria-label="t('clinico.ficha.historico.filtroAria')"
        >
          <template #option="{ option }">
            <span class="filtro__opcao">
              <span>{{ option.rotulo }}</span>
              <span class="filtro__total ui-num">{{ option.total }}</span>
            </span>
          </template>
        </SelectButton>
      </div>

      <p v-if="meses.length === 0" class="ui-vazio linha-do-tempo__vazio">
        {{ t('clinico.prontuario.timeline.vazio') }}
      </p>

      <div v-else class="linha-do-tempo__meses">
        <section
          v-for="mes in meses"
          :key="mes.chave"
          class="mes"
          :aria-labelledby="`historico-mes-${mes.chave}`"
        >
          <h3 :id="`historico-mes-${mes.chave}`" class="mes__nome">
            {{ mes.nome }}
            <span class="ui-contagem">{{ mes.itens.length }}</span>
          </h3>

          <ol class="mes__itens">
            <li v-for="item in mes.itens" :key="item.id" class="mes__item">
              <component
                :is="item.encounterId ? 'button' : 'div'"
                :type="item.encounterId ? 'button' : undefined"
                class="evento"
                :class="{
                  'evento--abre': item.encounterId,
                  'evento--apagado': item.desfecho === 'cancelado',
                }"
                @click="abrir(item)"
              >
                <span class="evento__data">
                  <strong class="ui-hora">{{
                    formato.dataCurta(clinicClock.dateOf(item.em))
                  }}</strong>
                  <span class="ui-num">{{ formato.hora(item.em) }}</span>
                </span>

                <span class="evento__trilho" aria-hidden="true">
                  <span class="evento__marca" :class="`evento__marca--${item.tipo}`">
                    <i :class="ICONE[item.tipo]" />
                  </span>
                </span>

                <span class="evento__corpo">
                  <span class="evento__titulo">{{ item.titulo }}</span>
                  <span v-if="item.contexto" class="evento__contexto">{{ item.contexto }}</span>
                  <span v-if="item.resumo" class="evento__resumo">{{ item.resumo }}</span>
                </span>

                <span v-if="item.desfecho || item.encounterId" class="evento__lado">
                  <span
                    v-if="item.desfecho"
                    class="ui-selo"
                    :class="item.desfecho === 'falta' ? 'ui-selo--risco' : 'ui-selo--contorno'"
                  >
                    {{ formato.status(item.desfecho) }}
                  </span>
                  <i
                    v-if="item.encounterId"
                    class="ph ph-caret-right ui-linha__seta evento__seta"
                    aria-hidden="true"
                  />
                </span>
              </component>
            </li>
          </ol>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
/*
 * A raiz não desenha caixa: o próximo agendado e a linha do tempo entram direto na grade da página.
 * Assim o próximo ocupa a largura toda, acima das duas colunas, e a linha do tempo começa na mesma
 * altura que a coluna ao lado.
 */
.historico-lista {
  display: contents;
}

/* ---------------------------------------------------------------- próximo */

.proximos {
  position: relative;
  display: grid;
  overflow: hidden;
  grid-column: 1 / -1;
}

.proximos__linha {
  display: grid;
  align-items: center;
  gap: 6px 14px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding: 14px 20px 14px 22px;
}

.proximos__texto {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
}

.proximos__rotulo {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 550;
}

.proximos__texto strong {
  color: var(--pj-lugar-tinta, var(--tinta));
  font-size: 16px;
  font-weight: 650;
}

.proximos__contexto {
  color: var(--tinta-2);
  font-size: 14px;
}

.proximos__alternar {
  justify-self: end;
}

.proximos__lista {
  display: grid;
  margin: 0;
  padding: 0 20px 8px 72px;
  list-style: none;
}

.proximos__lista li {
  display: grid;
  align-items: baseline;
  gap: 12px;
  grid-template-columns: 8.5rem minmax(0, 1fr) auto;
  padding-block: 9px;
  border-top: 1px solid var(--linha-suave);
  font-size: 13.5px;
}

.proximos__quando {
  color: var(--tinta);
  font-weight: 600;
}

.proximos__status {
  color: var(--tinta-3);
  font-size: 13px;
}

/* ---------------------------------------------------------------- filtro */

/* Os tipos que não cabem numa linha descem para a segunda, dentro do mesmo trilho. */
.filtro :deep(.p-selectbutton) {
  display: inline-flex;
  max-width: 100%;
  flex-wrap: wrap;
}

.filtro__opcao {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.filtro__total {
  color: var(--tinta-3);
  font-size: 12px;
  font-weight: 650;
}

/* ---------------------------------------------------------------- meses e linhas */

.linha-do-tempo {
  overflow: hidden;
}

.linha-do-tempo__vazio {
  justify-items: center;
  padding-block: 32px;
  text-align: center;
}

.mes + .mes {
  border-top: 1px solid var(--linha-suave);
}

.mes__nome {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 9px 20px;
  border-bottom: 1px solid var(--linha-suave);
  background: color-mix(in oklab, var(--superficie-2) 60%, var(--superficie));
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.mes__itens {
  display: grid;
  margin: 0;
  padding: 6px 0;
  list-style: none;
}

/* A linha do acontecimento: data | ícone no fio | o que foi | desfecho. */
.evento {
  display: grid;
  width: 100%;
  align-items: start;
  gap: 0 14px;
  grid-template-columns: 3.4rem 34px minmax(0, 1fr) auto;
  padding: 0 20px;
  border: 0;
  background: transparent;
  color: var(--tinta);
  font: inherit;
  text-align: start;
}

.evento--abre {
  cursor: pointer;
}

.evento--abre:hover {
  background: var(--superficie-2);
}

.evento--abre:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -2px;
}

.evento__data {
  display: grid;
  gap: 1px;
  padding-block: 12px;
}

.evento__data .ui-hora {
  font-size: 14.5px;
}

.evento__data span {
  color: var(--tinta-2);
  font-size: 12.5px;
}

/*
 * O fio: uma linha vertical que passa por trás dos ícones e liga os acontecimentos do mês. Começa
 * no primeiro ícone e termina no último — não pende para fora do bloco.
 */
.evento__trilho {
  position: relative;
  display: flex;
  align-self: stretch;
  justify-content: center;
  padding-block: 10px;
}

.evento__trilho::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(50% - 1px);
  width: 2px;
  background: var(--linha);
  content: '';
}

.mes__item:first-child .evento__trilho::before {
  top: 27px;
}

.mes__item:last-child .evento__trilho::before {
  bottom: calc(100% - 27px);
}

.mes__item:only-child .evento__trilho::before {
  display: none;
}

.evento__marca {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  box-shadow: 0 0 0 3px var(--superficie);
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 18px;
}

.evento--abre:hover .evento__marca {
  box-shadow: 0 0 0 3px var(--superficie-2);
}

/* Falta é desfecho ruim: a cor fica no ícone e no selo, a linha continua neutra. */
.evento__marca--falta {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.evento__marca--cancelado {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.evento__corpo {
  display: grid;
  min-width: 0;
  gap: 2px;
  padding-block: 12px;
}

.evento__titulo {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
}

.evento__contexto {
  color: var(--tinta-2);
  font-size: 13px;
}

.evento__resumo {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.evento--apagado .evento__titulo {
  color: var(--tinta-2);
  text-decoration: line-through;
}

.evento__lado {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding-top: 18px;
}

[dir='rtl'] .evento__seta {
  scale: -1 1;
}

@media (max-width: 560px) {
  .evento {
    gap: 0 10px;
    grid-template-columns: 3rem 30px minmax(0, 1fr);
    padding: 0 12px;
  }

  .evento__marca {
    width: 30px;
    height: 30px;
    font-size: 16px;
  }

  .evento__trilho {
    grid-row: span 2;
  }

  .evento__lado {
    grid-column: 3;
    padding-top: 0;
    padding-bottom: 10px;
  }

  .evento__seta {
    display: none;
  }

  .proximos__linha {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .proximos__alternar {
    grid-column: 2;
    justify-self: start;
  }

  .proximos__lista {
    padding-inline-start: 18px;
  }

  .proximos__lista li {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
}
</style>
