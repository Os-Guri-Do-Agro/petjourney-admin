<script setup lang="ts">
/**
 * O que o paciente recebeu, e quando.
 *
 * A pergunta que esta lista responde é feita duas vezes por dia numa clínica e não tinha tela:
 * *este animal já tomou isso?* Antes, a resposta estava partida em três lugares que nunca se
 * encontravam — a carteira de vacinas, o checklist da internação e a receita da consulta, que
 * nem execução é: é ordem. Quem precisava juntar, juntava de cabeça.
 *
 * Três decisões que a lista toma e uma tabela genérica não tomaria:
 *
 * - **A origem aparece em cada linha.** "Dipirona há 14 dias" muda de peso conforme tenha sido
 *   aplicada na veia aqui, dada pela enfermagem no leito, ou contada pelo responsável. Sem a
 *   origem, as três viram a mesma frase.
 * - **O que a clínica não presenciou é dito.** Ato `avulso` não tem profissional, e o lugar de
 *   "quem" não fica em branco: ele diz *relatado*. Campo vazio parece dado que faltou carregar;
 *   a palavra é a informação.
 * - **O filtro é por natureza do ato, não por origem.** Quem procura medicamento não quer
 *   vacina e curativo no meio — e quem procura vacina tem a carteira, que diz muito mais.
 *
 * Mora na coluna estreita do histórico, ao lado da lista do que aconteceu. Por isso é lista de
 * linhas, e não tabela: quatro colunas em 20 rem cortavam o cabeçalho ("O / que") e a coluna de
 * quem executou sumia pela borda.
 *
 * Redesenho (19/10/2026): título no fundo com "Registrar" contornado à direita (a ação cheia da
 * tela é a da capa), filtro em controle segmentado com a contagem, e as linhas numa folha, com a
 * data à esquerda como na linha do tempo ao lado.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import UiSecao from '@/components/ui/UiSecao.vue'

import type { AtoClinico, AtoClinicoKind, OrigemDoAto } from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  atos: AtoClinico[]
  carregando: boolean
}>()

const emit = defineEmits<{
  registrar: []
  abrirAtendimento: [encounterId: string]
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

type Filtro = 'todos' | AtoClinicoKind

const filtro = ref<Filtro>('todos')

/** Contagem na própria ficha: antes de clicar já se sabe se vale. */
const opcoesFiltro = computed(() => {
  const contar = (kind: AtoClinicoKind) => props.atos.filter((ato) => ato.kind === kind).length

  return [
    {
      valor: 'todos' as Filtro,
      rotulo: t('clinico.paciente.atos.filtro.todos'),
      total: props.atos.length,
    },
    {
      valor: 'medicamento' as Filtro,
      rotulo: t('clinico.paciente.atos.filtro.medicamento'),
      total: contar('medicamento'),
    },
    {
      valor: 'procedimento' as Filtro,
      rotulo: t('clinico.paciente.atos.filtro.procedimento'),
      total: contar('procedimento'),
    },
  ].filter((opcao) => opcao.valor === 'todos' || opcao.total > 0)
})

const visiveis = computed(() =>
  filtro.value === 'todos' ? props.atos : props.atos.filter((ato) => ato.kind === filtro.value),
)

/** A segunda linha do ato: via e dose, quando existem. É o que distingue duas linhas iguais. */
function detalhe(ato: AtoClinico): string {
  const via = ato.via ? t(`clinico.prontuario.conduta.via_.${ato.via}`) : ''

  return [via, ato.doseTexto, ato.observacao].filter(Boolean).join(' · ')
}

function origem(valor: OrigemDoAto): string {
  return t(`clinico.paciente.atos.origem.${valor}`)
}

/**
 * A cor do selo de origem tem significado: internação é o lugar da casa, vacina é contorno (a
 * carteira diz o resto), e o relato do responsável é ressalva (atenção) — "alguém disse que
 * aplicaram" não lê como "a clínica aplicou".
 */
const TOM_DA_ORIGEM: Record<OrigemDoAto, string> = {
  clinica: '',
  internacao: 'ui-selo--lugar',
  vacina: 'ui-selo--contorno',
  avulso: 'ui-selo--atencao',
}

const anoAtual = computed(() => clinicClock.today().slice(0, 4))

/**
 * O dia em cima, e embaixo a hora — com o ano na frente quando não é este: "18/11" sobre
 * "2025, 09:30", mas "01/10" sobre "09:30". O ano na linha de baixo mantém a coluna estreita.
 */
function dataDoAto(ato: AtoClinico) {
  return formato.dataCurta(clinicClock.dateOf(ato.realizadoEm))
}

function horaDoAto(ato: AtoClinico) {
  const ano = clinicClock.dateOf(ato.realizadoEm).slice(0, 4)
  const hora = formato.hora(ato.realizadoEm)

  return ano === anoAtual.value ? hora : `${ano}, ${hora}`
}

function quem(ato: AtoClinico): string {
  return (
    clinico.profissional(ato.professionalId)?.nome ?? t('clinico.paciente.atos.semProfissional')
  )
}

function abrir(ato: AtoClinico) {
  if (ato.encounterId) {
    emit('abrirAtendimento', ato.encounterId)
  }
}
</script>

<template>
  <UiSecao
    id="atos-do-paciente"
    class="atos"
    :titulo="t('clinico.paciente.atos.titulo')"
    icone="ph ph-first-aid-kit"
    :descricao="t('clinico.paciente.atos.ajuda')"
  >
    <template #acoes>
      <Button
        type="button"
        icon="ph ph-plus"
        :label="t('clinico.paciente.atos.registrar')"
        severity="secondary"
        outlined
        size="small"
        @click="emit('registrar')"
      />
    </template>

    <div class="atos__corpo">
      <SelectButton
        v-if="atos.length > 0 && opcoesFiltro.length > 1"
        v-model="filtro"
        class="atos__filtro"
        :options="opcoesFiltro"
        option-label="rotulo"
        option-value="valor"
        data-key="valor"
        :allow-empty="false"
        size="small"
        :aria-label="t('clinico.paciente.atos.titulo')"
      >
        <template #option="{ option }">
          <span class="atos__opcao">
            <span>{{ option.rotulo }}</span>
            <span class="atos__total ui-num">{{ option.total }}</span>
          </span>
        </template>
      </SelectButton>

      <div
        v-if="carregando && atos.length === 0"
        class="atos__carregando ui-folha"
        aria-busy="true"
      >
        <Skeleton v-for="n in 3" :key="n" height="2.6rem" border-radius="0.6rem" />
      </div>

      <div v-else-if="atos.length === 0" class="ui-folha ui-vazio">
        <strong>{{ t('clinico.paciente.atos.vazioTitulo') }}</strong>
        <span>{{ t('clinico.paciente.atos.vazioDescricao') }}</span>
      </div>

      <ol
        v-else
        class="atos__lista ui-folha ui-lista"
        :aria-label="t('clinico.paciente.atos.titulo')"
      >
        <li v-for="ato in visiveis" :key="ato.id">
          <component
            :is="ato.encounterId ? 'button' : 'div'"
            :type="ato.encounterId ? 'button' : undefined"
            class="atos__linha"
            :class="{ 'atos__linha--abre': ato.encounterId }"
            @click="abrir(ato)"
          >
            <span class="atos__quando">
              <strong class="ui-hora">{{ dataDoAto(ato) }}</strong>
              <span class="ui-num">{{ horaDoAto(ato) }}</span>
            </span>

            <span class="atos__corpo-linha">
              <span class="atos__nome">
                <i
                  class="atos__tipo"
                  :class="ato.kind === 'medicamento' ? 'ph ph-pill' : 'ph ph-bandaids'"
                  role="img"
                  :aria-label="t(`clinico.paciente.atos.kind.${ato.kind}`)"
                />
                <span>{{ ato.descricao }}</span>
              </span>
              <span v-if="detalhe(ato)" class="atos__meta">{{ detalhe(ato) }}</span>
              <span class="atos__origem">
                <span class="ui-selo" :class="TOM_DA_ORIGEM[ato.origem]">{{
                  origem(ato.origem)
                }}</span>
                <span :class="ato.professionalId ? 'atos__quem' : 'atos__relato'">{{
                  quem(ato)
                }}</span>
              </span>
            </span>
          </component>
        </li>
      </ol>
    </div>
  </UiSecao>
</template>

<style scoped>
.atos__corpo {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.atos__filtro {
  justify-self: start;
}

.atos__opcao {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.atos__total {
  color: var(--tinta-3);
  font-size: 12px;
  font-weight: 650;
}

.atos__carregando {
  display: grid;
  gap: 8px;
  padding: 14px;
}

.atos__lista {
  overflow: hidden;
}

.atos__linha {
  display: grid;
  width: 100%;
  align-items: start;
  gap: 12px;
  grid-template-columns: 4.6rem minmax(0, 1fr);
  padding: 12px 16px;
  border: 0;
  background: transparent;
  color: var(--tinta);
  font: inherit;
  text-align: start;
}

.atos__linha--abre {
  cursor: pointer;
}

.atos__linha--abre:hover {
  background: var(--superficie-2);
}

.atos__linha--abre:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -2px;
}

.atos__quando {
  display: grid;
  gap: 1px;
}

.atos__quando .ui-hora {
  font-size: 14px;
}

.atos__quando span {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.atos__corpo-linha {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.atos__nome {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
}

.atos__tipo {
  flex: none;
  margin-top: 2px;
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 16px;
}

.atos__meta {
  color: var(--tinta-2);
  font-size: 13px;
}

.atos__origem {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin-top: 3px;
  font-size: 13px;
}

.atos__origem .ui-selo {
  height: 22px;
  font-size: 12px;
}

.atos__quem {
  color: var(--tinta-2);
}

/* "Relatado" é itálico e apagado: diz que o dado existe e que a clínica não o presenciou. */
.atos__relato {
  color: var(--tinta-3);
  font-style: italic;
}
</style>
