<script setup lang="ts">
/**
 * Hoje, versão **Mesa**, no design **ferramenta**.
 *
 * O layout é o de uma caixa de entrada: à esquerda as filas do dia com a contagem de cada uma, no
 * meio quem está na fila escolhida, à direita a ficha de quem foi escolhido, com a ação que cabe
 * ao momento dele. Ninguém sai da tela para saber de quem se trata antes de chamar. A fila e o
 * paciente escolhidos vão para a URL (`?fila=&item=`): voltar, recarregar ou mandar o link
 * mantém a mesa como estava.
 *
 * O desenho é o de um programa de mesa, feito para passar o dia aberto:
 *
 * - **Compacto.** Fonte do sistema (Segoe UI no Windows, SF no Mac) em 13,5 px, linhas de 52 px,
 *   botões de 34. Cabe o dobro de gente na mesma altura.
 * - **Uma janela, três painéis.** Moldura fina, cantos de 10, sem sombra; os painéis se separam
 *   por fio. O das filas é marinho `#1D3557`, como a barra de um programa.
 * - **Seleção em periwinkle** `#BDB2FF`, a cor da paleta que não tem outro uso aqui: onde ela
 *   aparece, é o que está escolhido.
 * - **Etiquetas pequenas** de canto quase reto para estado, em véu da cor de cada um.
 * - **Teclado.** Na lista, ↑ e ↓ trocam de paciente e a ficha acompanha.
 */
import Button from 'primevue/button'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'

import type { LinhaDaTabela } from '@/components/home/pauta-tabela'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { MeuDia } from '@/features/clinico/composables/useMeuDia'
import type { Appointment } from '@/features/clinico/data/types'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

const props = defineProps<{ dia: MeuDia }>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const formato = useClinicFormat()

const lista = ref<HTMLElement | null>(null)

type IdDaFila = 'pede-acao' | 'recepcao' | 'sala' | 'a-seguir' | 'finalizados'

type Entrada =
  | { id: string; tipo: 'atendimento'; item: Appointment }
  | { id: string; tipo: 'pendencia'; linha: LinhaDaTabela }

const atendimentos = (itens: Appointment[]): Entrada[] =>
  itens.map((item) => ({ id: item.id, tipo: 'atendimento', item }))

const filas = computed(() => [
  {
    id: 'pede-acao' as const,
    rotulo: t('inicio.pauta.titulo'),
    icone: 'ph ph-list-checks',
    alerta: props.dia.urgentes.length > 0,
    entradas: props.dia.linhasDaPauta.map<Entrada>((linha) => ({
      id: linha.id,
      tipo: 'pendencia',
      linha,
    })),
  },
  {
    id: 'recepcao' as const,
    rotulo: t('clinico.hoje.recepcao'),
    icone: 'ph ph-door-open',
    alerta: false,
    entradas: atendimentos(props.dia.naRecepcao),
  },
  {
    id: 'sala' as const,
    rotulo: t('clinico.hoje.emConsulta'),
    icone: 'ph ph-stethoscope',
    alerta: false,
    entradas: atendimentos(props.dia.emConsulta),
  },
  {
    id: 'a-seguir' as const,
    rotulo: t('clinico.meuDia.aSeguir'),
    icone: 'ph ph-clock',
    alerta: false,
    entradas: atendimentos(props.dia.aSeguir),
  },
  {
    id: 'finalizados' as const,
    rotulo: t('clinico.meuDia.versoes.mesa.finalizados'),
    icone: 'ph ph-check-circle',
    alerta: false,
    entradas: atendimentos(props.dia.finalizados),
  },
])

/** Sem escolha na URL, abre na primeira fila que tem alguém: a mais urgente. */
const filaAberta = computed(() => {
  const pedida = filas.value.find((fila) => fila.id === route.query.fila)

  return pedida ?? filas.value.find((fila) => fila.entradas.length) ?? filas.value[0]!
})

const escolhida = computed(
  () =>
    filaAberta.value.entradas.find((entrada) => entrada.id === route.query.item) ??
    filaAberta.value.entradas[0] ??
    null,
)

function irParaFila(id: IdDaFila): RouteLocationRaw {
  return { query: { ...route.query, fila: id, item: undefined } }
}

function irParaItem(id: string): RouteLocationRaw {
  return { query: { ...route.query, fila: filaAberta.value.id, item: id } }
}

/** ↑ e ↓ na lista: a escolha anda uma linha e o foco vai junto, para a próxima seta valer. */
async function navegar(evento: KeyboardEvent) {
  const passo = evento.key === 'ArrowDown' ? 1 : evento.key === 'ArrowUp' ? -1 : 0
  const entradas = filaAberta.value.entradas

  if (!passo || !entradas.length) {
    return
  }

  evento.preventDefault()

  const atual = entradas.findIndex((entrada) => entrada.id === escolhida.value?.id)
  const proxima = entradas[Math.min(entradas.length - 1, Math.max(0, atual + passo))]!

  await router.replace(irParaItem(proxima.id))
  await nextTick()
  lista.value?.querySelector<HTMLElement>(`[data-entrada="${proxima.id}"]`)?.focus()
}

function petDe(entrada: Entrada) {
  return entrada.tipo === 'atendimento' ? props.dia.pet(entrada.item.petId) : null
}

/** A etiqueta da direita da linha: espera, tempo de sala ou a hora, conforme a fila. */
function quandoDe(item: Appointment) {
  if (item.status === 'aguardando') {
    return { tom: 'espera', texto: formato.duracao(props.dia.minutosDesde(item.chegadaEm) ?? 0) }
  }

  if (item.status === 'em-atendimento') {
    return {
      tom: 'sala',
      texto: formato.duracao(props.dia.minutosDesde(item.iniciadoEm ?? item.inicio) ?? 0),
    }
  }

  return { tom: 'hora', texto: formato.hora(item.inicio) }
}

const ETIQUETA_DO_STATUS: Partial<Record<Appointment['status'], string>> = {
  'em-atendimento': 'sala',
  aguardando: 'espera',
  confirmado: 'confirmado',
  finalizado: 'feito',
}

const ICONE_DO_TOM = {
  risco: 'ph ph-warning-octagon',
  atencao: 'ph ph-warning',
  neutro: 'ph ph-info',
}

/** A ficha do atendimento escolhido, já montada para o template. */
const ficha = computed(() => {
  const entrada = escolhida.value

  if (!entrada || entrada.tipo !== 'atendimento') {
    return null
  }

  const item = entrada.item
  const pet = props.dia.pet(item.petId)
  const quando = quandoDe(item)

  return {
    item,
    pet,
    etiqueta: ETIQUETA_DO_STATUS[item.status] ?? 'marcado',
    estado:
      quando.tom === 'hora'
        ? formato.status(item.status)
        : `${formato.status(item.status)} · ${quando.texto}`,
    fatos: [
      {
        rotulo: t('clinico.agenda.tabela.horario'),
        valor: formato.intervalo(item.inicio, item.fim),
      },
      { rotulo: t('clinico.pacientes.colunaAtendimento'), valor: props.dia.tipoDe(item) },
      { rotulo: t('clinico.agenda.mover.profissional'), valor: props.dia.profissionaisDe(item) },
      { rotulo: t('clinico.agenda.criar.sala'), valor: props.dia.salasDe(item) },
      {
        rotulo: t('clinico.paciente.responsavel'),
        valor: props.dia.tutor(item.tutorId)?.nome ?? '',
      },
    ].filter((fato) => fato.valor),
    alertas: props.dia.alertasRelevantes(pet),
  }
})
</script>

<template>
  <UiPagina
    class="ferramenta"
    :carregando="dia.carregando"
    :erro="dia.erro"
    bloquear-se-suspenso
    @tentar-de-novo="dia.carregar"
  >
    <!-- A barra do programa: a frase do dia pequena, a data e a agenda. -->
    <template #cabecalho>
      <header class="barra">
        <div class="barra__textos">
          <h1>{{ dia.fraseDoResumo }}</h1>
          <p>{{ [dia.dataDeHoje, dia.andamentoDoDia].filter(Boolean).join(' · ') }}</p>
        </div>
        <RouterLink class="p-button p-component p-button-secondary" to="/veterinario/agenda">
          <i class="ph ph-calendar-blank" aria-hidden="true" />
          {{ t('clinico.meuDia.agendaCompleta') }}
        </RouterLink>
      </header>
    </template>

    <div class="janela-caixa">
      <div class="janela">
        <!-- As filas do dia: a barra marinho do programa. -->
        <nav class="filas" :aria-label="t('clinico.meuDia.versoes.mesa.filas')">
          <ul>
            <li v-for="fila in filas" :key="fila.id">
              <RouterLink
                replace
                class="fila"
                :class="{ 'fila--aberta': fila.id === filaAberta.id }"
                :to="irParaFila(fila.id)"
                :aria-current="fila.id === filaAberta.id ? 'true' : undefined"
              >
                <i :class="fila.icone" aria-hidden="true" />
                <span class="fila__rotulo">{{ fila.rotulo }}</span>
                <span class="fila__total" :class="{ 'fila__total--alerta': fila.alerta }">
                  {{ fila.entradas.length }}
                </span>
              </RouterLink>
            </li>
          </ul>
        </nav>

        <!-- Quem está na fila escolhida. -->
        <section class="lista" aria-labelledby="mesa-lista-titulo">
          <header class="painel__cabeca">
            <h2 id="mesa-lista-titulo">{{ filaAberta.rotulo }}</h2>
            <span class="painel__total">{{ filaAberta.entradas.length }}</span>
          </header>

          <ul v-if="filaAberta.entradas.length" ref="lista" @keydown="navegar">
            <li v-for="entrada in filaAberta.entradas" :key="entrada.id">
              <RouterLink
                replace
                class="item"
                :class="{ 'item--escolhido': entrada.id === escolhida?.id }"
                :to="irParaItem(entrada.id)"
                :data-entrada="entrada.id"
                :aria-current="entrada.id === escolhida?.id ? 'true' : undefined"
              >
                <template v-if="entrada.tipo === 'atendimento'">
                  <PetAvatar
                    :nome="petDe(entrada)?.nome ?? ''"
                    :iniciais="petDe(entrada)?.iniciais ?? ''"
                    :especie="petDe(entrada)?.especie ?? null"
                    :foto-url="petDe(entrada)?.fotoUrl ?? ''"
                    tamanho="sm"
                  />
                  <span class="item__texto">
                    <strong>
                      {{ petDe(entrada)?.nome }}
                      <i
                        v-if="dia.alertasRelevantes(petDe(entrada)).length"
                        class="ph ph-warning item__alerta"
                        :title="
                          dia.alertasRelevantes(petDe(entrada)).map(dia.textoDoAlerta).join(' · ')
                        "
                        aria-hidden="true"
                      />
                    </strong>
                    <span>{{ dia.linhaDoAtendimento(entrada.item) }}</span>
                  </span>
                  <span class="etiqueta" :class="`etiqueta--${quandoDe(entrada.item).tom}`">
                    {{ quandoDe(entrada.item).texto }}
                  </span>
                </template>

                <template v-else>
                  <i
                    class="item__tom"
                    :class="[ICONE_DO_TOM[entrada.linha.tom], `item__tom--${entrada.linha.tom}`]"
                    aria-hidden="true"
                  />
                  <span class="item__texto">
                    <strong>{{ entrada.linha.frase }}</strong>
                    <span>{{ entrada.linha.onde }}</span>
                  </span>
                </template>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="vazio">{{ t('clinico.meuDia.versoes.mesa.filaVazia') }}</p>

          <p v-if="filaAberta.entradas.length > 1" class="atalhos">
            <kbd>↑</kbd><kbd>↓</kbd> {{ t('clinico.meuDia.versoes.mesa.atalhos') }}
          </p>
        </section>

        <!-- A ficha de quem foi escolhido. -->
        <section class="ficha" aria-live="polite">
          <div class="ficha__conteudo">
            <template v-if="ficha">
              <header class="ficha__quem">
                <PetAvatar
                  :nome="ficha.pet?.nome ?? ''"
                  :iniciais="ficha.pet?.iniciais ?? ''"
                  :especie="ficha.pet?.especie ?? null"
                  :foto-url="ficha.pet?.fotoUrl ?? ''"
                  tamanho="lg"
                />
                <div class="ficha__nome">
                  <h2>{{ ficha.pet?.nome }}</h2>
                  <p>{{ dia.linhaDoPaciente(ficha.pet) }}</p>
                </div>
              </header>

              <span class="etiqueta ficha__etiqueta" :class="`etiqueta--${ficha.etiqueta}`">
                {{ ficha.estado }}
              </span>

              <dl class="ficha__fatos">
                <div v-for="fato in ficha.fatos" :key="fato.rotulo">
                  <dt>{{ fato.rotulo }}</dt>
                  <dd>{{ fato.valor }}</dd>
                </div>
              </dl>

              <div v-if="ficha.alertas.length" class="ficha__alertas">
                <h3>{{ t('clinico.hoje.alertas') }}</h3>
                <ul>
                  <li
                    v-for="alerta in ficha.alertas"
                    :key="alerta.id"
                    class="etiqueta"
                    :class="alerta.severidade === 'risco' ? 'etiqueta--risco' : 'etiqueta--espera'"
                  >
                    <i class="ph ph-warning" aria-hidden="true" />
                    {{ dia.textoDoAlerta(alerta) }}
                  </li>
                </ul>
              </div>

              <footer class="ficha__acoes">
                <Button
                  v-if="ficha.item.status === 'aguardando'"
                  type="button"
                  icon="ph ph-door-open"
                  :label="t('clinico.hoje.chamar')"
                  @click="dia.abrirProntuario(ficha.item)"
                />
                <Button
                  v-else-if="ficha.item.status === 'em-atendimento'"
                  type="button"
                  icon="ph ph-stethoscope"
                  :label="t('clinico.meuDia.continuarCom', { pet: ficha.pet?.nome ?? '' })"
                  @click="dia.abrirProntuario(ficha.item)"
                />
                <RouterLink
                  v-else-if="ficha.item.status === 'finalizado'"
                  class="p-button p-component"
                  :to="dia.rotaDoProntuario(ficha.item)"
                >
                  <i class="ph ph-stethoscope" aria-hidden="true" />
                  {{ t('clinico.paciente.abrirProntuario') }}
                </RouterLink>

                <RouterLink
                  class="p-button p-component p-button-secondary"
                  :to="dia.rotaDoResumo(ficha.item)"
                >
                  <i class="ph ph-notepad" aria-hidden="true" />
                  {{ t('clinico.resumoDoPaciente.verResumo') }}
                </RouterLink>
                <RouterLink
                  class="p-button p-component p-button-secondary"
                  :to="dia.focoNaAgenda(ficha.item.id)"
                >
                  <i class="ph ph-calendar-blank" aria-hidden="true" />
                  {{ t('clinico.fila.aceite.verNaAgenda') }}
                </RouterLink>
              </footer>
            </template>

            <template v-else-if="escolhida && escolhida.tipo === 'pendencia'">
              <header class="ficha__quem">
                <PetAvatar
                  v-if="escolhida.linha.pet"
                  :nome="escolhida.linha.pet.nome"
                  :iniciais="escolhida.linha.pet.iniciais"
                  :especie="escolhida.linha.pet.especie ?? null"
                  :foto-url="escolhida.linha.pet.fotoUrl ?? ''"
                  tamanho="lg"
                />
                <i
                  v-else
                  class="ficha__sem-rosto"
                  :class="ICONE_DO_TOM[escolhida.linha.tom]"
                  aria-hidden="true"
                />
                <div class="ficha__nome">
                  <h2>{{ escolhida.linha.frase }}</h2>
                </div>
              </header>

              <span
                class="etiqueta ficha__etiqueta"
                :class="{
                  'etiqueta--risco': escolhida.linha.tom === 'risco',
                  'etiqueta--espera': escolhida.linha.tom === 'atencao',
                  'etiqueta--marcado': escolhida.linha.tom === 'neutro',
                }"
              >
                <i :class="ICONE_DO_TOM[escolhida.linha.tom]" aria-hidden="true" />
                {{ t(`inicio.pauta.gravidade.${escolhida.linha.tom}`) }}
              </span>

              <p v-if="escolhida.linha.detalhe" class="ficha__detalhe">
                {{ escolhida.linha.detalhe }}
              </p>

              <footer class="ficha__acoes">
                <RouterLink class="p-button p-component" :to="escolhida.linha.to">
                  {{ t('clinico.meuDia.versoes.mesa.resolverEm', { onde: escolhida.linha.onde }) }}
                  <i class="ph ph-arrow-right" aria-hidden="true" />
                </RouterLink>
              </footer>
            </template>

            <p v-else class="vazio ficha__vazia">
              {{ t('clinico.meuDia.versoes.mesa.escolha') }}
            </p>
          </div>
        </section>
      </div>
    </div>

    <template #sempre>
      <slot name="sempre" />
    </template>
  </UiPagina>
</template>

<!-- O fundo da área de conteúdo é da página aberta: aqui, o cinza frio de uma área de trabalho. -->
<style>
.palco__conteudo:has(.ferramenta) {
  background: #eef0f3;
}

.app-dark .palco__conteudo:has(.ferramenta) {
  background: #0d1117;
}
</style>

<style scoped>
/* ------------------------------------------------------------------ tokens da ferramenta */

.ferramenta {
  --fe-janela: #fff;
  --fe-moldura: #d5d9e0;
  --fe-fio: #e6e9ee;
  --fe-texto: #1f2733;
  --fe-texto-2: #5b6474;
  --fe-sobre: #f4f6f8;
  --fe-ficha: #fafbfc;
  --fe-barra: #1d3557;
  --fe-barra-texto: #c9d3e3;
  --fe-barra-sobre: rgb(255 255 255 / 8%);
  --fe-escolha: #bdb2ff;
  --fe-escolha-texto: #1d3557;
  --fe-escolha-veu: rgb(189 178 255 / 30%);
  --fe-tinta: #1d3557;

  /* Etiquetas: véu da cor de cada estado, texto escuro do mesmo matiz. */
  --fe-espera-veu: rgb(255 183 161 / 45%);
  --fe-espera-texto: #7a3418;
  --fe-sala-veu: rgb(29 53 87 / 10%);
  --fe-sala-texto: #1d3557;
  --fe-confirmado-veu: rgb(132 165 157 / 28%);
  --fe-confirmado-texto: #2f4d46;
  --fe-risco-veu: rgb(242 132 130 / 30%);
  --fe-risco-texto: #8e2523;
  --fe-neutro-veu: #eceef2;
  --fe-neutro-texto: #4a5260;

  --font-sistema: 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Roboto, sans-serif;

  /* Botões de programa de mesa: 34 px, cantos de 6, tinta marinho ou papel com fio. */
  --p-button-border-radius: 6px;
  --p-button-label-font-weight: 600;
  --p-button-primary-background: var(--fe-tinta);
  --p-button-primary-hover-background: #142843;
  --p-button-primary-active-background: #142843;
  --p-button-primary-border-color: var(--fe-tinta);
  --p-button-primary-hover-border-color: #142843;
  --p-button-primary-active-border-color: #142843;
  --p-button-primary-color: #fff;
  --p-button-primary-hover-color: #fff;
  --p-button-primary-active-color: #fff;
  --p-button-secondary-background: var(--fe-janela);
  --p-button-secondary-hover-background: var(--fe-sobre);
  --p-button-secondary-active-background: var(--fe-sobre);
  --p-button-secondary-border-color: var(--fe-moldura);
  --p-button-secondary-hover-border-color: #b9bfc9;
  --p-button-secondary-active-border-color: #b9bfc9;
  --p-button-secondary-color: var(--fe-texto);
  --p-button-secondary-hover-color: var(--fe-texto);
  --p-button-secondary-active-color: var(--fe-texto);

  color: var(--fe-texto);
  font-family: var(--font-sistema);
  font-size: 13.5px;
}

.app-dark .ferramenta {
  --fe-janela: #161b22;
  --fe-moldura: #2b323d;
  --fe-fio: #232a34;
  --fe-texto: #e3e8ef;
  --fe-texto-2: #98a2b3;
  --fe-sobre: #1c232c;
  --fe-ficha: #1a2028;
  --fe-barra: #0f1a2b;
  --fe-barra-texto: #b4c0d3;
  --fe-escolha-veu: rgb(189 178 255 / 16%);
  --fe-tinta: #c9d6ea;
  --fe-espera-veu: rgb(255 183 161 / 18%);
  --fe-espera-texto: #ffc9b8;
  --fe-sala-veu: rgb(157 180 216 / 18%);
  --fe-sala-texto: #c9d6ea;
  --fe-confirmado-veu: rgb(132 165 157 / 22%);
  --fe-confirmado-texto: #b9d3cc;
  --fe-risco-veu: rgb(242 132 130 / 20%);
  --fe-risco-texto: #f8b4b2;
  --fe-neutro-veu: #262d37;
  --fe-neutro-texto: #b4bcc8;
  --p-button-primary-hover-background: #b4c5df;
  --p-button-primary-active-background: #b4c5df;
  --p-button-primary-hover-border-color: #b4c5df;
  --p-button-primary-color: #0d1117;
  --p-button-primary-hover-color: #0d1117;
  --p-button-primary-active-color: #0d1117;
  --p-button-secondary-hover-border-color: #3a4350;
}

.ferramenta .p-button {
  min-height: 34px;
  gap: 7px;
  padding-inline: 12px;
  background-image: none !important;
  box-shadow: none !important;
  font-size: 13.5px;
}

.ferramenta .p-button:not(:disabled):active {
  transform: none;
}

/* --------------------------------------------------------------------------------- barra */

.barra {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 24px;
}

.barra__textos {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.barra h1 {
  margin: 0;
  color: var(--fe-texto);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.barra p {
  margin: 0;
  color: var(--fe-texto-2);
  font-size: 13px;
}

/* -------------------------------------------------------------------------------- janela */

.janela-caixa {
  padding-bottom: 72px;
  container: janela / inline-size;
}

.janela {
  display: grid;
  overflow: clip;
  min-height: 600px;
  border: 1px solid var(--fe-moldura);
  border-radius: 10px;
  background: var(--fe-janela);
  grid-template-columns: 220px minmax(0, 1fr) minmax(300px, 360px);
}

/* As filas: a barra marinho do programa. */
.filas {
  padding: 12px 8px;
  background: var(--fe-barra);
}

.filas ul {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fila {
  display: flex;
  min-height: 36px;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--fe-barra-texto);
  font-weight: 500;
  text-decoration: none;
}

.fila i {
  font-size: 16px;
}

.fila:hover {
  background: var(--fe-barra-sobre);
  color: #fff;
}

.fila:focus-visible {
  outline: 2px solid var(--fe-escolha);
  outline-offset: -2px;
}

.fila--aberta,
.fila--aberta:hover {
  background: var(--fe-escolha);
  color: var(--fe-escolha-texto);
  font-weight: 600;
}

.fila__rotulo {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fila__total {
  min-width: 22px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgb(255 255 255 / 12%);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  text-align: center;
}

.fila--aberta .fila__total {
  background: rgb(29 53 87 / 14%);
}

.fila__total--alerta {
  background: #f28482;
  color: #3d0f0e;
}

/* --------------------------------------------------------------------------------- lista */

.lista {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border-inline-end: 1px solid var(--fe-fio);
}

.painel__cabeca {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border-bottom: 1px solid var(--fe-fio);
}

.painel__cabeca h2 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
}

.painel__total {
  color: var(--fe-texto-2);
  font-variant-numeric: tabular-nums;
}

.lista ul {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista li + li {
  border-top: 1px solid var(--fe-fio);
}

.item {
  display: flex;
  min-height: 52px;
  align-items: center;
  gap: 10px;
  padding: 6px 16px;
  color: var(--fe-texto);
  text-decoration: none;
}

.item:hover {
  background: var(--fe-sobre);
}

.item:focus-visible {
  outline: 2px solid var(--fe-tinta);
  outline-offset: -2px;
}

.item--escolhido,
.item--escolhido:hover {
  background: var(--fe-escolha-veu);
}

.item__texto {
  display: grid;
  min-width: 0;
  flex: 1;
}

.item__texto strong {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item__texto span {
  overflow: hidden;
  color: var(--fe-texto-2);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item__alerta {
  margin-inline-start: 4px;
  color: var(--fe-espera-texto);
  vertical-align: -2px;
}

.item__tom {
  display: grid;
  width: 28px;
  height: 28px;
  flex: none;
  place-items: center;
  border-radius: 6px;
  background: var(--fe-neutro-veu);
  color: var(--fe-neutro-texto);
  font-size: 16px;
}

.item__tom--risco {
  background: var(--fe-risco-veu);
  color: var(--fe-risco-texto);
}

.item__tom--atencao {
  background: var(--fe-espera-veu);
  color: var(--fe-espera-texto);
}

.atalhos {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: auto 0 0;
  padding: 10px 16px;
  border-top: 1px solid var(--fe-fio);
  color: var(--fe-texto-2);
  font-size: 12px;
}

kbd {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  place-items: center;
  border: 1px solid var(--fe-moldura);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--fe-janela);
  color: var(--fe-texto);
  font-family: inherit;
  font-size: 11px;
}

/* ------------------------------------------------------------------------------ etiqueta */

.etiqueta {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  min-height: 22px;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--fe-neutro-veu);
  color: var(--fe-neutro-texto);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 1.3;
}

.etiqueta--espera {
  background: var(--fe-espera-veu);
  color: var(--fe-espera-texto);
}

.etiqueta--sala {
  background: var(--fe-sala-veu);
  color: var(--fe-sala-texto);
}

.etiqueta--confirmado {
  background: var(--fe-confirmado-veu);
  color: var(--fe-confirmado-texto);
}

.etiqueta--risco {
  background: var(--fe-risco-veu);
  color: var(--fe-risco-texto);
}

.etiqueta--hora,
.etiqueta--marcado,
.etiqueta--feito {
  background: var(--fe-neutro-veu);
  color: var(--fe-neutro-texto);
}

/* ---------------------------------------------------------------------------------- ficha */

.ficha {
  min-width: 0;
  background: var(--fe-ficha);
}

/* Presa no topo da rolagem: a lista longa desce, a ficha de quem foi escolhido fica. */
.ficha__conteudo {
  position: sticky;
  top: 0;
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 20px;
}

.ficha__quem {
  display: flex;
  align-items: center;
  gap: 14px;
}

.ficha__nome {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.ficha__nome h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.25;
}

.ficha__nome p {
  margin: 0;
  color: var(--fe-texto-2);
  font-size: 13px;
}

.ficha__sem-rosto {
  display: grid;
  width: 48px;
  height: 48px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--fe-neutro-veu);
  color: var(--fe-neutro-texto);
  font-size: 22px;
}

.ficha__etiqueta {
  justify-self: start;
}

.ficha__fatos {
  display: grid;
  margin: 0;
  border-top: 1px solid var(--fe-fio);
}

.ficha__fatos div {
  display: grid;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--fe-fio);
  grid-template-columns: 96px minmax(0, 1fr);
}

.ficha__fatos dt {
  color: var(--fe-texto-2);
  font-size: 12.5px;
}

.ficha__fatos dd {
  margin: 0;
  font-weight: 600;
}

.ficha__alertas {
  display: grid;
  gap: 6px;
}

.ficha__alertas h3 {
  margin: 0;
  color: var(--fe-texto-2);
  font-size: 12px;
  font-weight: 600;
}

.ficha__alertas ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ficha__detalhe {
  margin: 0;
  color: var(--fe-texto-2);
  line-height: 1.5;
}

.ficha__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}

.vazio {
  margin: 0;
  padding: 24px 16px;
  color: var(--fe-texto-2);
}

.ficha__vazia {
  padding-top: 64px;
  text-align: center;
}

/* ------------------------------------------------------------------------------ estreito */

/* Sem largura para três painéis: as filas viram uma fileira em cima da lista e da ficha. */
@container janela (max-width: 1040px) {
  .janela {
    grid-template-columns: minmax(0, 1fr) minmax(280px, 330px);
    grid-template-rows: auto 1fr;
  }

  .filas {
    grid-column: 1 / -1;
    padding: 8px;
  }

  .filas ul {
    display: flex;
    overflow-x: auto;
    gap: 4px;
    scrollbar-width: none;
  }

  .fila {
    flex: none;
  }
}

@container janela (max-width: 600px) {
  .janela {
    grid-template-columns: minmax(0, 1fr);
  }

  .lista {
    border-inline-end: 0;
    border-bottom: 1px solid var(--fe-fio);
  }
}
</style>
