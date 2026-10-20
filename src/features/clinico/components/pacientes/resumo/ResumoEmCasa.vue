<script setup lang="ts">
/**
 * O que o responsável registrou no Diário Pet desde a última consulta.
 *
 * É o bloco que nenhum concorrente consegue desenhar, e o que mais corre o risco de virar
 * ruído: o responsável que registra três vezes por dia produz noventa linhas. Por isso ele
 * **conta** antes de listar — uma linha por pergunta que o vet faria (peso, alimentação, água,
 * disposição, fezes, urina, sintomas), e as falas do responsável que explicam alguma alteração.
 *
 * A lista inteira continua a um clique, e abre filtrada no que tem alteração. "Todos" existe
 * para quem quer conferir; resumir não é esconder.
 *
 * Dois vazios diferentes, e a tela não os confunde: o responsável **não liberou** o diário para
 * a clínica (é uma escolha dele, feita no app), ou liberou e **não registrou nada** no período.
 *
 * Acabamento (20/10/2026): um cartão com cabeçalho (ladrilho, título e a contagem dos registros,
 * `ficha.css`), as respostas embaixo do fio. Redesenho (19/10/2026): as respostas numa folha só, rótulo à
 * esquerda e resposta à direita; a alteração que é maioria ganha o selo de atenção.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import '../ficha/ficha.css'
import { useClinicFormat } from '../../../composables/useClinicFormat'
import { useRotulosDoDiario } from '../../../composables/useRotulosDoDiario'
import type { EntradaDoDiarioParaClinica } from '../../../contrato/responsavel'
import {
  CAMPOS_DO_DIARIO,
  achadosDeAlarme,
  temAlteracao,
  textoDoRegistro,
  type ContagemDoCampo,
  type ResumoDoPaciente,
} from '../../../domain/resumo-do-paciente'
import { clinicClock } from '../../../stores/clinico'

const props = defineProps<{
  diario: ResumoDoPaciente['diario']
  /** Sem consulta anterior, a janela é "os últimos 30 dias" e o título diz isso. */
  temConsulta: boolean
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoDiario()
const idDaLista = useId()

const aberto = ref(false)
const filtro = ref<'alteracao' | 'todos'>('alteracao')

const total = computed(() => props.diario.entradas.length)

/** "12 registros no app, 2 sem alteração": a linha embaixo do título. */
const descricao = computed(() =>
  total.value > 0
    ? `${t('clinico.resumoDoPaciente.casa.registros', { total: total.value })} · ${t(
        'clinico.resumoDoPaciente.casa.semAlteracao',
        { total: props.diario.semAlteracao },
      )}`
    : '',
)
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

/**
 * Uma linha por campo: o valor alterado que mais apareceu, contado ("Pouco em 10 de 13"), ou
 * "normal em todos". O destaque só quando é a maioria — a mesma régua do sinal. Um em sessenta
 * não é notícia.
 */
function linhaDoCampo(contagem: ContagemDoCampo) {
  return {
    campo: contagem.campo,
    rotulo: rotulos.campo(contagem.campo),
    valor:
      contagem.alterados > 0 && contagem.predominante
        ? t(
            'clinico.resumoDoPaciente.casa.valorEm',
            {
              valor: rotulos.valor(contagem.campo, contagem.predominante),
              alterados: contagem.alterados,
              total: contagem.total,
            },
            contagem.total,
          )
        : t(
            'clinico.resumoDoPaciente.casa.normalEmTodos',
            { total: contagem.total },
            contagem.total,
          ),
    alterado: contagem.alterados * 2 >= contagem.total && contagem.alterados > 0,
    meta: t('clinico.resumoDoPaciente.casa.ultimo', {
      valor: rotulos.valor(contagem.campo, contagem.ultimo).toLocaleLowerCase(),
      quando: formato.relativo(contagem.ultimoEm),
    }),
  }
}

const linhasDosCampos = computed(() => props.diario.campos.map(linhaDoCampo))

const entradasVisiveis = computed(() =>
  filtro.value === 'todos' ? props.diario.entradas : props.diario.entradas.filter(temAlteracao),
)

/** O que cada registro disse, em pedaços curtos. Valor normal não entra: é o esperado. */
function pedacos(entrada: EntradaDoDiarioParaClinica): string[] {
  return [
    ...CAMPOS_DO_DIARIO.filter(
      (campo) => entrada[campo] !== null && entrada[campo] !== 'NORMAL',
    ).map(
      (campo) =>
        `${rotulos.campo(campo)}: ${rotulos.valor(campo, entrada[campo] as string).toLocaleLowerCase()}`,
    ),
    ...entrada.sintomas.map(rotulos.sintoma),
    ...entrada.doencas.map(rotulos.doenca),
    entrada.sintomasOutros ?? '',
  ].filter(Boolean)
}
</script>

<template>
  <section class="ficha-cartao ui-folha" aria-labelledby="resumo-casa-titulo">
    <header class="ficha-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-house-line" /></span>
      <div class="ficha-cartao__titulos">
        <h2 id="resumo-casa-titulo" class="ficha-cartao__titulo">
          {{
            temConsulta
              ? t('clinico.resumoDoPaciente.casa.titulo')
              : t('clinico.resumoDoPaciente.casa.tituloSemConsulta')
          }}
        </h2>
        <p v-if="descricao" class="ficha-cartao__descricao">{{ descricao }}</p>
      </div>
    </header>

    <div class="casa">
      <!--
        Não liberou: é escolha do responsável, e a tela diz onde ela se muda — no app, não aqui.
        Cadeado e não celular: o diário existe, só não é da clínica.
      -->
      <div v-if="!diario.liberado" class="casa__vazio">
        <i class="ph ph-lock" aria-hidden="true" />
        <p>
          <strong>{{ t('clinico.resumoDoPaciente.casa.naoLiberadoTitulo') }}</strong>
          {{ t('clinico.resumoDoPaciente.casa.naoLiberadoDescricao') }}
        </p>
      </div>

      <div v-else-if="total === 0 && !diario.peso" class="casa__vazio">
        <i class="ph ph-device-mobile" aria-hidden="true" />
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
              <span class="casa__valor ui-num">
                {{ kg(diario.peso.deKg) }} → {{ kg(diario.peso.paraKg) }} kg
              </span>
              <span class="casa__meta">{{ formato.relativo(diario.peso.ultimoEm) }}</span>
            </dd>
            <dd v-else class="casa__fraco">{{ t('clinico.resumoDoPaciente.casa.semRegistro') }}</dd>
          </div>

          <div v-for="linha in linhasDosCampos" :key="linha.campo" class="casa__linha">
            <dt>{{ linha.rotulo }}</dt>
            <dd>
              <span
                class="casa__valor"
                :class="{ 'casa__valor--alterado ui-selo ui-selo--atencao': linha.alterado }"
              >
                {{ linha.valor }}
              </span>
              <span class="casa__meta">{{ linha.meta }}</span>
            </dd>
          </div>

          <div class="casa__linha">
            <dt>{{ rotulos.campo('sintomas') }}</dt>
            <dd v-if="diario.sintomas.length > 0">
              <ul class="casa__sintomas">
                <li
                  v-for="item in diario.sintomas"
                  :key="item.sintoma"
                  :class="{ 'casa__sintoma--alarme': item.alarme }"
                >
                  <i v-if="item.alarme" class="ph ph-warning" aria-hidden="true" />
                  {{ rotulos.sintoma(item.sintoma) }}
                  <span class="casa__vezes ui-num">×{{ item.vezes }}</span>
                </li>
              </ul>
            </dd>
            <dd v-else class="casa__fraco">{{ t('clinico.resumoDoPaciente.casa.nenhum') }}</dd>
          </div>

          <!-- Doença que o responsável acha que o pet teve: é hipótese de casa, e diz isso no rótulo. -->
          <div v-if="diario.doencas.length > 0" class="casa__linha">
            <dt>{{ rotulos.campo('doencas') }}</dt>
            <dd>
              <ul class="casa__sintomas">
                <li v-for="item in diario.doencas" :key="item.doenca">
                  {{ rotulos.doenca(item.doenca) }}
                  <span class="casa__vezes ui-num">×{{ item.vezes }}</span>
                </li>
              </ul>
            </dd>
          </div>
        </dl>

        <div v-if="diario.notas.length > 0" class="casa__notas">
          <h3 class="casa__subtitulo">{{ t('clinico.resumoDoPaciente.casa.notas') }}</h3>
          <figure v-for="nota in diario.notas" :key="nota.entrada.id" class="nota">
            <blockquote>{{ nota.texto }}</blockquote>
            <figcaption class="ui-num">{{ quando(nota.entrada.data) }}</figcaption>
          </figure>
        </div>

        <div v-if="total > 0" class="casa__rodape">
          <Button
            type="button"
            :label="
              aberto
                ? t('clinico.resumoDoPaciente.casa.esconder')
                : t('clinico.resumoDoPaciente.casa.verRegistros', { total })
            "
            :icon="aberto ? 'ph ph-caret-up' : 'ph ph-caret-down'"
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
                :class="{
                  'registro--nada': !temAlteracao(entrada),
                  'registro--alarme': achadosDeAlarme(entrada).length > 0,
                }"
              >
                <span class="registro__quando ui-num">{{ quando(entrada.data) }}</span>
                <span class="registro__corpo">
                  <span class="registro__pedacos">
                    {{
                      pedacos(entrada).join(' · ') ||
                      t('clinico.resumoDoPaciente.casa.semAlteracaoCurto')
                    }}
                  </span>
                  <span v-if="textoDoRegistro(entrada)" class="registro__nota">
                    {{ textoDoRegistro(entrada) }}
                  </span>
                </span>
              </li>
            </ol>
          </div>
        </Transition>
      </template>
    </div>
  </section>
</template>

<style scoped>
.casa {
  display: grid;
  gap: 16px;
  padding: 6px 20px 16px;
}

.casa:has(> .casa__vazio) {
  padding-block: 4px 18px;
}

.casa__linhas {
  display: grid;
  margin: 0;
}

/* Rótulo à esquerda, resposta à direita: o olho desce pela coluna de perguntas. */
.casa__linha {
  display: grid;
  align-items: baseline;
  gap: 4px 16px;
  grid-template-columns: 8.5rem minmax(0, 1fr);
  padding-block: 12px;
  border-top: 1px solid var(--linha-suave);
}

.casa__linha:first-child {
  border-top: 0;
}

.casa__linha dt {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 550;
}

.casa__linha dd {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  margin: 0;
}

.casa__valor {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

/* A alteração que é maioria: selo de atenção, com a palavra do diário dentro. */
.casa__valor--alterado.ui-selo {
  align-self: center;
  height: auto;
  min-height: 24px;
  padding-block: 3px;
  font-size: 13.5px;
  white-space: normal;
}

.casa__meta {
  color: var(--tinta-2);
  font-size: 13px;
}

.casa__fraco {
  color: var(--tinta-3);
  font-size: 14px;
}

.casa__sintomas {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.casa__sintomas li {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.casa__sintoma--alarme {
  color: var(--risco-tinta);
}

.casa__sintoma--alarme .ph {
  align-self: center;
  font-size: 14px;
}

.casa__vezes {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.casa__notas {
  display: grid;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--linha-suave);
}

.casa__subtitulo {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 550;
}

.nota {
  margin: 0;
  padding-inline-start: 12px;
  border-inline-start: 2px solid var(--linha-forte);
}

.nota blockquote {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-style: italic;
  line-height: 1.45;
}

.nota figcaption {
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.casa__vazio {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-top: 12px;
  padding: 14px 16px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.casa__vazio p {
  margin: 0;
}

.casa__vazio strong {
  display: block;
  color: var(--tinta);
  font-weight: 600;
}

.casa__vazio .ph {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--superficie-3);
  color: var(--tinta-2);
  font-size: 19px;
}

.casa__rodape {
  margin-top: -6px;
  margin-inline-start: -10px;
}

.registros {
  display: grid;
  gap: 10px;
}

.registros :deep(.p-selectbutton) {
  justify-self: start;
}

.registros__lista {
  display: grid;
  max-height: 22rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  border-top: 1px solid var(--linha);
  list-style: none;
}

.registro {
  display: grid;
  gap: 4px 14px;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  padding-block: 9px;
  border-bottom: 1px solid var(--linha);
}

.registro__quando {
  color: var(--tinta-2);
  font-size: 13px;
}

.registro__corpo {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.registro__pedacos {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

/* O registro com achado de alarme puxa a cor do sinal: é o mesmo fato, lido de outro lugar. */
.registro--alarme .registro__pedacos {
  color: var(--risco-tinta);
}

.registro--nada .registro__pedacos {
  color: var(--tinta-3);
  font-weight: 500;
}

.registro__nota {
  color: var(--tinta-2);
  font-size: 13px;
  overflow-wrap: anywhere;
}

/* Abrir a lista é mudança de estado: 160 ms, e nada para quem pediu menos movimento. */
.casa-abre-enter-active,
.casa-abre-leave-active {
  transition:
    opacity var(--pj-tempo-curto, 140ms) ease-out,
    transform var(--pj-tempo-curto, 140ms) ease-out;
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
  }
}
</style>
