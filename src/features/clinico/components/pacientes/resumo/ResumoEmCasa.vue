<script setup lang="ts">
/**
 * O que o responsável registrou no Diário Pet desde a última consulta.
 *
 * É o bloco que nenhum concorrente consegue desenhar, e o que mais corre o risco de virar
 * ruído: o responsável que registra três vezes por dia produz noventa linhas. Por isso ele
 * **conta** antes de listar — uma linha por pergunta que o vet faria (peso, apetite,
 * comportamento, sintomas), e as falas do responsável que explicam alguma alteração.
 *
 * A lista inteira continua a um clique, e abre filtrada no que tem alteração. "Todos" existe
 * para quem quer conferir; resumir não é esconder.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../../composables/useClinicFormat'
import type { ContagemDoDiario, ResumoDoPaciente } from '../../../domain/resumo-do-paciente'
import type { EntradaDoDiario } from '../../../data/types'
import { clinicClock } from '../../../stores/clinico'

const props = defineProps<{
  diario: ResumoDoPaciente['diario']
  /** Sem consulta anterior, a janela é "os últimos 30 dias" e o título diz isso. */
  temConsulta: boolean
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const idDaLista = useId()

const aberto = ref(false)
const filtro = ref<'alteracao' | 'todos'>('alteracao')

const total = computed(() => props.diario.entradas.length)
const comAlteracao = computed(() => total.value - props.diario.semAlteracao)

const opcoesDoFiltro = computed(() => [
  {
    valor: 'alteracao',
    rotulo: t('clinico.resumoDoPaciente.casa.filtroAlteracao', { total: comAlteracao.value }),
  },
  {
    valor: 'todos',
    rotulo: t('clinico.resumoDoPaciente.casa.filtroTodos', { total: total.value }),
  },
])

function kg(valor: number): string {
  return formato.numero(valor, Number.isInteger(Math.round(valor * 100) / 10) ? 1 : 2)
}

function quando(iso: string): string {
  return `${formato.dataCurta(clinicClock.dateOf(iso))} · ${formato.hora(iso)}`
}

function linhaDeContagem<T extends string>(
  contagem: ContagemDoDiario<T> | null,
  campo: 'apetite' | 'comportamento',
) {
  if (!contagem) {
    return null
  }

  return {
    valor:
      contagem.alterados > 0
        ? t('clinico.resumoDoPaciente.casa.alteradoEm', {
            alterados: contagem.alterados,
            total: contagem.total,
          })
        : t('clinico.resumoDoPaciente.casa.normalEmTodos', { total: contagem.total }),
    /* Destaque só quando é a maioria — a mesma régua do sinal. Um em sessenta não é notícia. */
    alterado: contagem.alterados * 2 >= contagem.total,
    meta: t('clinico.resumoDoPaciente.casa.ultimo', {
      valor: t(`clinico.resumoDoPaciente.diario.${campo}.${contagem.ultimo}`).toLocaleLowerCase(),
      quando: formato.relativo(contagem.ultimoEm),
    }),
  }
}

const apetite = computed(() => linhaDeContagem(props.diario.apetite, 'apetite'))
const comportamento = computed(() => linhaDeContagem(props.diario.comportamento, 'comportamento'))

const alterado = (entrada: EntradaDoDiario) =>
  entrada.sintomas.length > 0 ||
  entrada.apetite === 'reduzido' ||
  entrada.apetite === 'ausente' ||
  entrada.comportamento === 'quieto' ||
  entrada.comportamento === 'apatico'

const entradasVisiveis = computed(() =>
  filtro.value === 'todos' ? props.diario.entradas : props.diario.entradas.filter(alterado),
)

/** O que cada registro disse, em pedaços curtos. "Normal" não entra: é o esperado. */
function pedacos(entrada: EntradaDoDiario): string[] {
  return [
    entrada.pesoKg !== null ? `${kg(entrada.pesoKg)} kg` : '',
    entrada.apetite && entrada.apetite !== 'normal'
      ? t('clinico.resumoDoPaciente.casa.apetiteValor', {
          valor: t(
            `clinico.resumoDoPaciente.diario.apetite.${entrada.apetite}`,
          ).toLocaleLowerCase(),
        })
      : '',
    entrada.comportamento && entrada.comportamento !== 'normal'
      ? t(`clinico.resumoDoPaciente.diario.comportamento.${entrada.comportamento}`)
      : '',
    ...entrada.sintomas.map((sintoma) => t(`clinico.resumoDoPaciente.diario.sintoma.${sintoma}`)),
  ].filter(Boolean)
}
</script>

<template>
  <section class="casa" aria-labelledby="casa-titulo">
    <header class="casa__topo">
      <h2 id="casa-titulo" class="casa__titulo">
        {{
          temConsulta
            ? t('clinico.resumoDoPaciente.casa.titulo')
            : t('clinico.resumoDoPaciente.casa.tituloSemConsulta')
        }}
      </h2>
      <span v-if="total > 0" class="casa__meta">
        {{ t('clinico.resumoDoPaciente.casa.registros', { total }) }}
        ·
        {{ t('clinico.resumoDoPaciente.casa.semAlteracao', { total: diario.semAlteracao }) }}
      </span>
    </header>

    <div v-if="total === 0" class="casa__vazio">
      <i class="pi pi-mobile" aria-hidden="true" />
      <p>
        <strong>{{ t('clinico.resumoDoPaciente.casa.vazioTitulo') }}</strong>
        {{ t('clinico.resumoDoPaciente.casa.vazioDescricao') }}
      </p>
    </div>

    <template v-else>
      <dl class="casa__linhas">
        <div class="casa__linha">
          <dt>{{ t('clinico.resumoDoPaciente.casa.peso') }}</dt>
          <dd v-if="diario.peso">
            <span class="clinic-value casa__valor">
              {{ kg(diario.peso.deKg) }} → {{ kg(diario.peso.paraKg) }} kg
            </span>
            <span class="casa__meta">{{ formato.relativo(diario.peso.ultimoEm) }}</span>
          </dd>
          <dd v-else class="casa__fraco">{{ t('clinico.resumoDoPaciente.casa.semRegistro') }}</dd>
        </div>

        <div class="casa__linha">
          <dt>{{ t('clinico.resumoDoPaciente.casa.apetite') }}</dt>
          <dd v-if="apetite">
            <span class="casa__valor" :class="{ 'casa__valor--alterado': apetite.alterado }">
              {{ apetite.valor }}
            </span>
            <span class="casa__meta">{{ apetite.meta }}</span>
          </dd>
          <dd v-else class="casa__fraco">{{ t('clinico.resumoDoPaciente.casa.semRegistro') }}</dd>
        </div>

        <div class="casa__linha">
          <dt>{{ t('clinico.resumoDoPaciente.casa.comportamento') }}</dt>
          <dd v-if="comportamento">
            <span class="casa__valor" :class="{ 'casa__valor--alterado': comportamento.alterado }">
              {{ comportamento.valor }}
            </span>
            <span class="casa__meta">{{ comportamento.meta }}</span>
          </dd>
          <dd v-else class="casa__fraco">{{ t('clinico.resumoDoPaciente.casa.semRegistro') }}</dd>
        </div>

        <div class="casa__linha">
          <dt>{{ t('clinico.resumoDoPaciente.casa.sintomas') }}</dt>
          <dd v-if="diario.sintomas.length > 0">
            <ul class="casa__sintomas">
              <li
                v-for="item in diario.sintomas"
                :key="item.sintoma"
                :class="{ 'casa__sintoma--alarme': item.alarme }"
              >
                <i v-if="item.alarme" class="pi pi-exclamation-triangle" aria-hidden="true" />
                {{ t(`clinico.resumoDoPaciente.diario.sintoma.${item.sintoma}`) }}
                <span class="clinic-value casa__vezes">×{{ item.vezes }}</span>
              </li>
            </ul>
          </dd>
          <dd v-else class="casa__fraco">{{ t('clinico.resumoDoPaciente.casa.nenhum') }}</dd>
        </div>
      </dl>

      <div v-if="diario.notas.length > 0" class="casa__notas">
        <h3 class="clinic-label">{{ t('clinico.resumoDoPaciente.casa.notas') }}</h3>
        <figure v-for="nota in diario.notas" :key="nota.id" class="nota">
          <blockquote>{{ nota.nota }}</blockquote>
          <figcaption class="clinic-value">{{ quando(nota.registradoEm) }}</figcaption>
        </figure>
      </div>

      <div class="casa__rodape">
        <Button
          :label="
            aberto
              ? t('clinico.resumoDoPaciente.casa.esconder')
              : t('clinico.resumoDoPaciente.casa.verRegistros', { total })
          "
          :icon="aberto ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          severity="secondary"
          text
          size="small"
          :aria-expanded="aberto"
          :aria-controls="idDaLista"
          @click="aberto = !aberto"
        />
      </div>

      <Transition name="casa-abre">
        <div v-if="aberto" :id="idDaLista" class="registros">
          <SelectButton
            v-model="filtro"
            :options="opcoesDoFiltro"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            size="small"
            :aria-label="t('clinico.resumoDoPaciente.casa.filtro')"
          />

          <ol class="registros__lista">
            <li
              v-for="entrada in entradasVisiveis"
              :key="entrada.id"
              class="registro"
              :class="{ 'registro--nada': !alterado(entrada) }"
            >
              <span class="registro__quando clinic-value">{{ quando(entrada.registradoEm) }}</span>
              <span class="registro__corpo">
                <span class="registro__pedacos">
                  {{
                    pedacos(entrada).join(' · ') ||
                    t('clinico.resumoDoPaciente.casa.semAlteracaoCurto')
                  }}
                </span>
                <span v-if="entrada.nota" class="registro__nota">{{ entrada.nota }}</span>
              </span>
            </li>
          </ol>
        </div>
      </Transition>
    </template>
  </section>
</template>

<style scoped>
.casa {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.casa__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--clinic-space-1) var(--clinic-space-3);
}

.casa__titulo {
  margin: 0;
  font-size: var(--clinic-font-title);
  font-weight: 700;
}

.casa__meta {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 500;
}

.casa__linhas {
  display: grid;
  margin: 0;
}

/* Rótulo à esquerda, resposta à direita: o olho desce pela coluna de perguntas. */
.casa__linha {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr);
  align-items: baseline;
  gap: var(--clinic-space-3);
  padding-block: var(--clinic-space-2);
  border-top: 1px solid var(--clinic-line-soft);
}

.casa__linha:first-child {
  border-top: 0;
  padding-top: 0;
}

.casa__linha dt {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.casa__linha dd {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--clinic-space-1) var(--clinic-space-2);
  margin: 0;
  min-width: 0;
}

.casa__valor {
  font-weight: 600;
}

.casa__valor--alterado {
  font-weight: 800;
}

.casa__fraco {
  color: var(--clinic-faint);
}

.casa__sintomas {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-1) var(--clinic-space-3);
  list-style: none;
}

.casa__sintomas li {
  display: inline-flex;
  align-items: baseline;
  gap: var(--clinic-space-1);
  font-weight: 600;
}

.casa__sintoma--alarme {
  color: var(--clinic-risk-text);
}

.casa__sintoma--alarme .pi {
  font-size: 0.8rem;
}

.casa__vezes {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.casa__notas {
  display: grid;
  gap: var(--clinic-space-2);
}

.casa__notas h3 {
  margin: 0;
}

.nota {
  margin: 0;
  padding-inline-start: var(--clinic-space-3);
  border-inline-start: 2px solid var(--clinic-line-strong);
}

.nota blockquote {
  margin: 0;
  font-style: italic;
}

.nota figcaption {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.casa__vazio {
  display: flex;
  align-items: flex-start;
  gap: var(--clinic-space-2);
  color: var(--clinic-muted);
}

.casa__vazio p {
  margin: 0;
}

.casa__vazio strong {
  display: block;
  color: var(--clinic-text);
}

.casa__vazio .pi {
  margin-top: 0.2em;
  color: var(--clinic-faint);
}

.casa__rodape {
  margin-inline-start: calc(var(--clinic-space-2) * -1);
}

.registros {
  display: grid;
  gap: var(--clinic-space-2);
}

.registros__lista {
  display: grid;
  max-height: 22rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  border-top: 1px solid var(--clinic-line-soft);
  list-style: none;
}

.registro {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: var(--clinic-space-3);
  padding-block: var(--clinic-space-2);
  border-bottom: 1px solid var(--clinic-line-soft);
}

.registro__quando {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.registro__corpo {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.registro__pedacos {
  font-weight: 600;
}

.registro--nada .registro__pedacos {
  color: var(--clinic-faint);
  font-weight: 500;
}

.registro__nota {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  overflow-wrap: anywhere;
}

/* Abrir a lista é mudança de estado: 160 ms, e nada para quem pediu menos movimento. */
.casa-abre-enter-active,
.casa-abre-leave-active {
  transition:
    opacity 160ms ease-out,
    transform 160ms ease-out;
}

.casa-abre-enter-from,
.casa-abre-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .casa-abre-enter-active,
  .casa-abre-leave-active {
    transition: none;
  }
}

@media (max-width: 640px) {
  .casa__linha,
  .registro {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--clinic-space-1);
  }
}
</style>
