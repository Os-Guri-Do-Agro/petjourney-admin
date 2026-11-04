<script setup lang="ts">
/**
 * Os dias especiais da aba Horários: os próximos em folhinhas, os que já passaram recolhidos, o
 * "Adicionar dia" (dia avulso ou feriados nacionais) e o "Apagar vários".
 *
 * "Apagar vários" põe a lista em modo de seleção: cada dia ganha a caixa, os que já passaram abrem,
 * e uma barra no alto diz quantos estão marcados, marca todos ou só os que já passaram, e apaga.
 * A tela só pede; quem fala com a API é a página (`remover`, `removerVarios`), e o modo de seleção
 * fecha sozinho quando a remoção em lote termina.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Menu from 'primevue/menu'
import type { MenuItem } from 'primevue/menuitem'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { DiaEspecial } from '@/service/parceiro/estabelecimento-service'

import { dataCivil, faixasDoDia } from './horario'

const props = defineProps<{
  dias: DiaEspecial[]
  /** Hoje no fuso da casa, `AAAA-MM-DD`: separa os próximos dos que já passaram. */
  hoje: string
  podeEditar: boolean
  copiandoFeriados: boolean
  /** O dia que está saindo agora, um por um. */
  removendo: string | null
  removendoVarios: boolean
}>()

const emit = defineEmits<{
  adicionar: []
  feriados: [ano: number]
  remover: [dia: DiaEspecial]
  removerVarios: [ids: string[]]
}>()

const { t, locale } = useI18n()

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

const ordenados = computed(() =>
  [...props.dias].sort((um, outro) => um.data.localeCompare(outro.data)),
)

const proximos = computed(() => ordenados.value.filter((dia) => dia.data >= props.hoje))
/** Do mais recente para o mais antigo: quem abre quer ver o que acabou de passar. */
const passados = computed(() => ordenados.value.filter((dia) => dia.data < props.hoje).reverse())

const mostrarPassados = ref(false)

function folhinha(dia: DiaEspecial) {
  const data = dataCivil(dia.data)
  const ano = dia.data.slice(0, 4)
  const semana = data.toLocaleDateString(intl.value, { weekday: 'long', timeZone: 'UTC' })

  return {
    numero: data.getUTCDate(),
    mes: data
      .toLocaleDateString(intl.value, { month: 'short', timeZone: 'UTC' })
      .replace(/\.$/, ''),
    /* "quinta-feira, 2027": o ano só aparece quando não é o de hoje. */
    semana: ano === props.hoje.slice(0, 4) ? semana : `${semana}, ${ano}`,
  }
}

function horarioDoDia(dia: DiaEspecial) {
  return dia.fechado ? t('parceiro.estabelecimento.horario.fechado') : faixasDoDia(dia).join(' · ')
}

/* ---------------------------------------------------------------------------- adicionar */

const menuDeAdicionar = ref<InstanceType<typeof Menu> | null>(null)

/** O catálogo da API tem o ano corrente e o próximo; outro ano ela recusa. */
const anosDeFeriado = computed(() => {
  const ano = Number(props.hoje.slice(0, 4))

  return [ano, ano + 1]
})

/**
 * Um botão "Adicionar" só, com o dia avulso e os feriados nacionais dentro: os dois botões lado a
 * lado não cabiam ao lado do título na coluna estreita.
 */
const itensDeAdicionar = computed<MenuItem[]>(() => [
  {
    label: t('parceiro.estabelecimento.dia.umDia'),
    icon: 'ph ph-calendar-plus',
    command: () => emit('adicionar'),
  },
  { separator: true },
  ...anosDeFeriado.value.map((ano) => ({
    label: t('parceiro.estabelecimento.dia.feriadosDe', { ano }),
    icon: 'ph ph-flag',
    command: () => emit('feriados', ano),
  })),
])

/* ------------------------------------------------------------------------ um por um */

const diaParaRemover = ref<DiaEspecial | null>(null)
const confirmarRemocao = ref(false)

function pedirRemocao(dia: DiaEspecial) {
  diaParaRemover.value = dia
  confirmarRemocao.value = true
}

/* ------------------------------------------------------------------------ em lote */

const selecionando = ref(false)
const marcados = ref<string[]>([])
const confirmarVarios = ref(false)

const podeApagarVarios = computed(() => props.podeEditar && props.dias.length > 1)

function entrarNaSelecao() {
  marcados.value = []
  selecionando.value = true
  /* Os que já passaram são os mais apagados de uma vez: a lista deles abre junto. */
  mostrarPassados.value = true
}

function sairDaSelecao() {
  selecionando.value = false
  marcados.value = []
}

function alternar(dia: DiaEspecial) {
  marcados.value = marcados.value.includes(dia.id)
    ? marcados.value.filter((id) => id !== dia.id)
    : [...marcados.value, dia.id]
}

const todosMarcados = computed(
  () => props.dias.length > 0 && props.dias.every((dia) => marcados.value.includes(dia.id)),
)

function alternarTodos() {
  marcados.value = todosMarcados.value ? [] : props.dias.map((dia) => dia.id)
}

function marcarPassados() {
  marcados.value = [...new Set([...marcados.value, ...passados.value.map((dia) => dia.id)])]
}

/* Dias que saíram da lista (recarga depois de remover) saem também da seleção. */
watch(
  () => props.dias,
  (dias) => {
    marcados.value = marcados.value.filter((id) => dias.some((dia) => dia.id === id))

    if (dias.length === 0) sairDaSelecao()
  },
)

/* A remoção em lote terminou: o modo de seleção fecha, com o que sobrou à vista. */
watch(
  () => props.removendoVarios,
  (agora, antes) => {
    if (antes && !agora) sairDaSelecao()
  },
)

const grupos = computed(() => [
  { id: 'proximos', dias: proximos.value, aberto: true },
  { id: 'passados', dias: passados.value, aberto: mostrarPassados.value },
])
</script>

<template>
  <UiSecao
    :titulo="t('parceiro.estabelecimento.dia.titulo')"
    :contagem="proximos.length || null"
    icone="ph ph-calendar-star"
    folha
  >
    <template v-if="podeEditar" #acoes>
      <Button
        icon="ph ph-plus"
        :label="t('parceiro.estabelecimento.dia.adicionar')"
        severity="secondary"
        outlined
        size="small"
        aria-haspopup="true"
        aria-controls="menu-adicionar-dia"
        :loading="copiandoFeriados"
        :disabled="selecionando"
        @click="menuDeAdicionar?.toggle($event)"
      />
      <Menu id="menu-adicionar-dia" ref="menuDeAdicionar" :model="itensDeAdicionar" popup />
    </template>

    <div class="especiais" :class="{ 'especiais--selecionando': selecionando }">
      <!-- A barra da seleção: quantos estão marcados, os atalhos e o apagar. -->
      <div
        v-if="selecionando"
        class="selecao"
        role="group"
        :aria-label="t('parceiro.estabelecimento.dia.apagarVarios')"
      >
        <label class="selecao__todos">
          <Checkbox
            :model-value="todosMarcados"
            :indeterminate="marcados.length > 0 && !todosMarcados"
            binary
            :disabled="removendoVarios"
            @update:model-value="alternarTodos"
          />
          <span aria-live="polite">
            {{
              t(
                'parceiro.estabelecimento.dia.marcados',
                { total: marcados.length },
                marcados.length,
              )
            }}
          </span>
        </label>
        <Button
          v-if="passados.length"
          :label="t('parceiro.estabelecimento.dia.marcarPassados')"
          icon="ph ph-clock-counter-clockwise"
          severity="secondary"
          outlined
          size="small"
          :disabled="removendoVarios"
          @click="marcarPassados"
        />
        <span class="selecao__acoes">
          <Button
            :label="t('parceiro.estabelecimento.gaveta.cancelar')"
            severity="secondary"
            outlined
            size="small"
            :disabled="removendoVarios"
            @click="sairDaSelecao"
          />
          <Button
            icon="ph ph-trash"
            :label="
              t(
                'parceiro.estabelecimento.dia.apagarMarcados',
                { total: marcados.length },
                marcados.length,
              )
            "
            severity="danger"
            size="small"
            :disabled="marcados.length === 0"
            :loading="removendoVarios"
            @click="confirmarVarios = true"
          />
        </span>
      </div>

      <p v-if="proximos.length === 0" class="especiais__vazio">
        {{
          passados.length
            ? t('parceiro.estabelecimento.dia.nenhumProximo')
            : t('parceiro.estabelecimento.dia.vazio')
        }}
      </p>

      <template v-for="grupo in grupos" :key="grupo.id">
        <ul
          v-if="grupo.dias.length && grupo.aberto"
          class="especiais__lista"
          :class="{ 'especiais__lista--passados': grupo.id === 'passados' }"
        >
          <li
            v-for="dia in grupo.dias"
            :key="dia.id"
            class="especial"
            :class="{ 'especial--marcado': selecionando && marcados.includes(dia.id) }"
          >
            <Checkbox
              v-if="selecionando"
              :input-id="`dia-especial-${dia.id}`"
              :model-value="marcados.includes(dia.id)"
              binary
              :disabled="removendoVarios"
              @update:model-value="alternar(dia)"
            />
            <!-- No modo de seleção, a linha inteira marca: o rótulo é a folhinha e o texto. -->
            <component
              :is="selecionando ? 'label' : 'span'"
              :for="selecionando ? `dia-especial-${dia.id}` : undefined"
              class="especial__corpo"
            >
              <span class="folhinha" aria-hidden="true">
                <strong class="ui-num">{{ folhinha(dia).numero }}</strong>
                <small>{{ folhinha(dia).mes }}</small>
              </span>
              <span class="especial__texto">
                <span class="especial__nome" :title="dia.nome">{{ dia.nome }}</span>
                <span class="especial__meta">
                  <span class="sr-only">{{ folhinha(dia).numero }} {{ folhinha(dia).mes }},</span>
                  {{ folhinha(dia).semana }} ·
                  <bdi class="ui-num" dir="ltr">{{ horarioDoDia(dia) }}</bdi>
                </span>
              </span>
            </component>
            <Button
              v-if="podeEditar && !selecionando"
              icon="ph ph-trash"
              severity="secondary"
              outlined
              size="small"
              :aria-label="t('parceiro.estabelecimento.dia.remover', { nome: dia.nome })"
              :title="t('parceiro.estabelecimento.dia.remover', { nome: dia.nome })"
              :loading="removendo === dia.id"
              @click="pedirRemocao(dia)"
            />
          </li>
        </ul>

        <!-- Entre as duas listas: abrir os que já passaram e, na ponta, o "Apagar vários". -->
        <div
          v-if="grupo.id === 'proximos' && !selecionando && (passados.length || podeApagarVarios)"
          class="especiais__pe"
        >
          <Button
            v-if="passados.length"
            :icon="mostrarPassados ? 'ph ph-caret-up' : 'ph ph-caret-down'"
            :label="
              mostrarPassados
                ? t('parceiro.estabelecimento.dia.esconderPassados')
                : t(
                    'parceiro.estabelecimento.dia.mostrarPassados',
                    { total: passados.length },
                    passados.length,
                  )
            "
            :aria-expanded="mostrarPassados"
            severity="secondary"
            text
            size="small"
            @click="mostrarPassados = !mostrarPassados"
          />
          <Button
            v-if="podeApagarVarios"
            class="especiais__apagar-varios"
            icon="ph ph-list-checks"
            :label="t('parceiro.estabelecimento.dia.apagarVarios')"
            severity="secondary"
            outlined
            size="small"
            @click="entrarNaSelecao"
          />
        </div>
      </template>
    </div>
  </UiSecao>

  <ConfirmActionDialog
    v-model:visible="confirmarRemocao"
    :title="t('parceiro.estabelecimento.confirmar.remover.titulo')"
    :message="
      t('parceiro.estabelecimento.confirmar.remover.mensagem', { nome: diaParaRemover?.nome ?? '' })
    "
    :confirm-label="t('parceiro.estabelecimento.confirmar.remover.botao')"
    :cancel-label="t('parceiro.estabelecimento.confirmar.voltar')"
    severity="danger"
    @confirm="diaParaRemover && emit('remover', diaParaRemover)"
  />
  <ConfirmActionDialog
    v-model:visible="confirmarVarios"
    :title="
      t(
        'parceiro.estabelecimento.confirmar.removerVarios.titulo',
        { total: marcados.length },
        marcados.length,
      )
    "
    :message="t('parceiro.estabelecimento.confirmar.removerVarios.mensagem')"
    :confirm-label="t('parceiro.estabelecimento.confirmar.removerVarios.botao')"
    :cancel-label="t('parceiro.estabelecimento.confirmar.voltar')"
    severity="danger"
    @confirm="emit('removerVarios', [...marcados])"
  />
</template>

<style scoped>
.especiais {
  display: grid;
  gap: 4px;
  padding: 10px 20px 12px;
}

.especiais__vazio {
  margin: 0;
  padding: 8px 0;
  color: var(--tinta-3);
  font-size: 13.5px;
  line-height: 1.45;
}

/* A barra da seleção, no véu: é o que está acontecendo com a lista agora. */
.selecao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 2px 0 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--app-veu, var(--superficie-2));
}

.selecao__todos {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.selecao__acoes {
  display: inline-flex;
  gap: 8px;
  margin-inline-start: auto;
}

.especiais__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.especiais__lista--passados {
  opacity: 0.7;
}

.especiais--selecionando .especiais__lista--passados {
  opacity: 1;
}

.especial {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--linha);
}

.especial:first-child {
  border-top: 0;
}

.especial__corpo {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

label.especial__corpo {
  cursor: pointer;
}

.especial--marcado .folhinha {
  background: var(--app-veu-forte, var(--superficie-3));
}

/* A data como folhinha de calendário: o dia grande o bastante para achar, o mês embaixo. */
.folhinha {
  display: grid;
  width: 44px;
  flex: none;
  justify-items: center;
  padding: 4px 0 5px;
  border-radius: 10px;
  background: var(--app-veu, var(--superficie-2));
  line-height: 1.1;
}

.folhinha strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 700;
}

.folhinha small {
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 11px;
  font-weight: 650;
  text-transform: uppercase;
}

.especial__texto {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.especial__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.especial__meta {
  color: var(--tinta-2);
  font-size: 13px;
}

.especiais__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

/* O botão de texto encosta na borda da lista: o ícone dele alinha com as folhinhas. */
.especiais__pe > .p-button-text:first-child {
  margin-inline-start: -12px;
}

.especiais__apagar-varios {
  margin-inline-start: auto;
}
</style>
