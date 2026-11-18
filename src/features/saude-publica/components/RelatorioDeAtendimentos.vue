<script setup lang="ts">
/**
 * O relatório dos atendimentos em campo por lugar (17/11/2026, "gerar relatório dos atendimentos por
 * bairro, região ou CEP, e o usuário pode colocar quantos CEPs forem necessários").
 *
 * O recorte é a caixa de cima da página (`RecorteDoRelatorio.vue`, o mesmo nas abas): aqui ficam o
 * resultado agrupado (os números do recorte e uma linha por região, bairro ou CEP, com o "Ver por" e
 * a "Ordem" em cima da tabela) e o porquê (os motivos do que não deu e cada procedimento). Os
 * números saem de `campo.ts` (`registrosDoRelatorio`), então o que a equipe registra na
 * apresentação entra na hora. O "Ver por" é à parte do filtro: dá para filtrar por região e ver CEP
 * a CEP.
 *
 * Saídas: a folha para imprimir (cópia no `body` marcada `clinic-print-root`, cores fixas de papel)
 * e a planilha CSV (ponto e vírgula e BOM, para o Excel em português abrir certo). A página chama
 * as duas pelo `defineExpose`.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'

import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import {
  agruparRegistros,
  registrosDoRelatorio,
  resumirRegistros,
  type Agrupamento,
  type LinhaDoRelatorio,
} from '@/features/saude-publica/campo'
import {
  dataCurta,
  motivo as motivoDe,
  numero,
  procedimento as procedimentoDe,
} from '@/features/saude-publica/dados'
import { useRecorteDoRelatorio } from '@/features/saude-publica/recorte-do-relatorio'

/* =============================================================== o recorte e o "Ver por" */

const { filtro, recorteNaFrase } = useRecorteDoRelatorio()

const agrupamento = ref<Agrupamento>('regiao')

type Ordem = 'total' | 'taxa' | 'nome'
const ordem = ref<Ordem>('total')

const LUGARES: { valor: Agrupamento; rotulo: string; icone: string }[] = [
  { valor: 'regiao', rotulo: 'Região', icone: 'ph ph-map-trifold' },
  { valor: 'bairro', rotulo: 'Bairro', icone: 'ph ph-map-pin-area' },
  { valor: 'cep', rotulo: 'CEP', icone: 'ph ph-envelope-simple' },
]

const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'total', rotulo: 'Mais atendimentos' },
  { valor: 'taxa', rotulo: 'Menor % realizado' },
  { valor: 'nome', rotulo: 'Nome' },
]

/* ============================================================================== o resultado */

const registros = computed(() => registrosDoRelatorio(filtro.value))
const resumo = computed(() => resumirRegistros(registros.value))

const linhas = computed<LinhaDoRelatorio[]>(() => {
  const lista = agruparRegistros(registros.value, agrupamento.value)
  if (ordem.value === 'taxa') return [...lista].sort((uma, outra) => uma.taxa - outra.taxa)
  if (ordem.value === 'nome') {
    return [...lista].sort((uma, outra) => uma.rotulo.localeCompare(outra.rotulo, 'pt'))
  }
  return lista
})

/** CEP a CEP a lista passa de centenas: a tela mostra as 40 primeiras e o resto a pedido. */
const PRIMEIRAS = 40
const todasAsLinhas = ref(false)
watch([agrupamento, filtro], () => {
  todasAsLinhas.value = false
})
const linhasNaTela = computed(() =>
  todasAsLinhas.value ? linhas.value : linhas.value.slice(0, PRIMEIRAS),
)

const maiorMotivo = computed(() => Math.max(1, ...resumo.value.motivos.map((item) => item.vezes)))

/* --------------------------------------------------------------------------- os textos */

const nomeDoAgrupamento: Record<Agrupamento, { titulo: string; coluna: string; arquivo: string }> =
  {
    regiao: { titulo: 'Por região urbana', coluna: 'Região', arquivo: 'regiao' },
    bairro: { titulo: 'Por bairro', coluna: 'Bairro', arquivo: 'bairro' },
    cep: { titulo: 'Por CEP', coluna: 'CEP', arquivo: 'cep' },
  }

function motivoPrincipal(linha: LinhaDoRelatorio) {
  const primeiro = linha.motivos[0]
  return primeiro ? motivoDe(primeiro.motivo) : null
}

const naoRealizadosDaLinha = (linha: LinhaDoRelatorio) => linha.naoRealizados + linha.parciais

/* ================================================================================ as saídas */

function paraTexto(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

function hojeEmTexto() {
  return paraTexto(new Date())
}

const geradoEm = computed(() => dataCurta(hojeEmTexto()))

function imprimir() {
  window.print()
}

function campoCsv(valor: string | number) {
  const texto = String(valor)
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** A planilha da tabela agrupada: uma linha por lugar, com o recorte na primeira linha. */
function baixarPlanilha() {
  const coluna = nomeDoAgrupamento[agrupamento.value].coluna
  const cabeca = [
    coluna,
    'Onde fica',
    'Atendimentos',
    'Realizados',
    'Parciais',
    'Não realizados',
    '% realizado',
    'Motivo mais comum',
  ]
  const corpo = linhas.value.map((linha) => [
    linha.rotulo,
    linha.onde,
    linha.total,
    linha.realizados,
    linha.parciais,
    linha.naoRealizados,
    linha.taxa,
    motivoPrincipal(linha)?.rotulo ?? '',
  ])
  const texto = [[`Recorte: ${recorteNaFrase.value}`], cabeca, ...corpo]
    .map((linha) => linha.map(campoCsv).join(';'))
    .join('\r\n')
  const blob = new Blob([`﻿${texto}\r\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `atendimentos-por-${nomeDoAgrupamento[agrupamento.value].arquivo}-${hojeEmTexto()}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

defineExpose({ imprimir, baixarPlanilha })
</script>

<template>
  <div class="ra">
    <!-- O resultado: os números do recorte e uma linha por lugar. -->
    <section class="ui-folha ui-cartao ra-caixa" aria-labelledby="ra-resultado">
      <header class="ui-cartao__cabeca ra-cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-table" /></span>
        <span class="ui-cartao__titulos">
          <h2 id="ra-resultado" class="ui-cartao__titulo">
            {{ nomeDoAgrupamento[agrupamento].titulo }}
            <span class="ui-contagem">{{ numero(linhas.length) }}</span>
          </h2>
          <p class="ui-cartao__descricao">
            Uma linha por {{ nomeDoAgrupamento[agrupamento].coluna.toLowerCase() }}, com quantos
            deram certo e o motivo que mais aparece no que não deu.
          </p>
        </span>
      </header>

      <UiVazioIlustrado
        v-if="!resumo.total"
        aninhado
        icone="ph ph-clipboard-text"
        titulo="Nenhum atendimento neste recorte"
        texto="Mude a origem, o período, os animais, a situação ou o lugar."
      />

      <template v-else>
        <dl class="ra-numeros">
          <div>
            <dt>Atendimentos</dt>
            <dd class="ui-num">{{ numero(resumo.total) }}</dd>
          </div>
          <div>
            <dt>Realizados</dt>
            <dd class="ui-num">{{ numero(resumo.realizados) }}</dd>
          </div>
          <div>
            <dt>Parciais</dt>
            <dd class="ui-num">{{ numero(resumo.parciais) }}</dd>
          </div>
          <div>
            <dt>Não realizados</dt>
            <dd class="ui-num">{{ numero(resumo.naoRealizados) }}</dd>
          </div>
          <div>
            <dt>Realizado</dt>
            <dd class="ui-num">{{ resumo.taxa }}%</dd>
          </div>
        </dl>

        <!-- Como ver o resultado: uma linha por lugar e a ordem. Não é filtro: o recorte é lá em cima. -->
        <div class="ra-ver">
          <div class="ra-ver__item">
            <span id="ra-ver-por" class="ra-rotulo">Ver por</span>
            <SelectButton
              v-model="agrupamento"
              class="ra-trilho"
              :options="LUGARES"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              size="small"
              aria-labelledby="ra-ver-por"
            >
              <template #option="{ option }">
                <i :class="option.icone" aria-hidden="true" />
                <span>{{ option.rotulo }}</span>
              </template>
            </SelectButton>
          </div>
          <div class="ra-ver__item">
            <span id="ra-ordem" class="ra-rotulo">Ordem</span>
            <SelectButton
              v-model="ordem"
              :options="ORDENS"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              size="small"
              aria-labelledby="ra-ordem"
            />
          </div>
        </div>

        <div class="ra-tabela__rolo">
          <table class="ra-tabela">
            <thead>
              <tr>
                <th scope="col">{{ nomeDoAgrupamento[agrupamento].coluna }}</th>
                <th scope="col" class="ra-tabela__numero">Atendimentos</th>
                <th scope="col" class="ra-tabela__numero">Realizados</th>
                <th scope="col" class="ra-tabela__numero">Não realizados</th>
                <th scope="col" class="ra-tabela__taxa">% realizado</th>
                <th scope="col">Motivo mais comum</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="linha in linhasNaTela" :key="linha.chave">
                <th scope="row">
                  <span class="ra-lugar">
                    <strong :class="{ 'ra-lugar--sem': linha.chave === 'sem' }">
                      {{ linha.rotulo }}
                    </strong>
                    <small v-if="linha.onde">{{ linha.onde }}</small>
                  </span>
                </th>
                <td class="ra-tabela__numero ui-num">{{ numero(linha.total) }}</td>
                <td class="ra-tabela__numero ui-num">{{ numero(linha.realizados) }}</td>
                <td class="ra-tabela__numero ui-num">
                  {{ numero(naoRealizadosDaLinha(linha)) }}
                  <small v-if="linha.parciais" class="ra-parciais">
                    ({{ numero(linha.parciais) }}
                    {{ linha.parciais === 1 ? 'parcial' : 'parciais' }})
                  </small>
                </td>
                <td class="ra-tabela__taxa">
                  <span class="ra-taxa">
                    <span class="ra-taxa__trilho" aria-hidden="true">
                      <span
                        class="ra-taxa__barra"
                        :class="{ 'ra-taxa__barra--baixa': linha.taxa < 85 }"
                        :style="{ width: `${linha.taxa}%` }"
                      />
                    </span>
                    <span class="ui-num">{{ linha.taxa }}%</span>
                  </span>
                </td>
                <td>
                  <span v-if="motivoPrincipal(linha)" class="ra-motivo">
                    <i :class="motivoPrincipal(linha)!.icone" aria-hidden="true" />
                    {{ motivoPrincipal(linha)!.rotulo }}
                  </span>
                  <span v-else class="ra-motivo ra-motivo--nada">Tudo feito</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Button
          v-if="linhas.length > PRIMEIRAS && !todasAsLinhas"
          type="button"
          class="ra-mais"
          severity="secondary"
          outlined
          icon="ph ph-caret-down"
          :label="`Mostrar as ${numero(linhas.length)} linhas`"
          @click="todasAsLinhas = true"
        />
      </template>
    </section>

    <!-- O porquê: os motivos do que não deu e cada procedimento. -->
    <div v-if="resumo.total" class="ra-par">
      <section class="ui-folha ui-cartao ra-caixa" aria-labelledby="ra-motivos">
        <header class="ui-cartao__cabeca ra-cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-question" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="ra-motivos" class="ui-cartao__titulo">Por que não deu</h2>
            <p class="ui-cartao__descricao">
              O motivo anotado em cada procedimento que não foi feito.
            </p>
          </span>
        </header>
        <p v-if="!resumo.motivos.length" class="ra-nada">
          <i class="ph ph-check-circle" aria-hidden="true" />
          Todos os procedimentos do recorte foram feitos.
        </p>
        <ol v-else class="ra-barras">
          <li v-for="item in resumo.motivos" :key="item.motivo" class="ra-barra">
            <span class="ra-barra__rotulo">
              <i :class="motivoDe(item.motivo).icone" aria-hidden="true" />
              {{ motivoDe(item.motivo).rotulo }}
            </span>
            <span class="ra-barra__valor ui-num">{{ numero(item.vezes) }}</span>
            <span class="ra-barra__trilho" aria-hidden="true">
              <span
                class="ra-barra__cheio ra-barra__cheio--motivo"
                :style="{ width: `${(item.vezes / maiorMotivo) * 100}%` }"
              />
            </span>
          </li>
        </ol>
      </section>

      <section class="ui-folha ui-cartao ra-caixa" aria-labelledby="ra-procedimentos">
        <header class="ui-cartao__cabeca ra-cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-syringe" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="ra-procedimentos" class="ui-cartao__titulo">Por procedimento</h2>
            <p class="ui-cartao__descricao">Quantas vezes cada um foi feito, e quantas não deu.</p>
          </span>
        </header>
        <ol class="ra-barras">
          <li v-for="item in resumo.procedimentos" :key="item.procedimento" class="ra-barra">
            <span class="ra-barra__rotulo">
              <i :class="procedimentoDe(item.procedimento).icone" aria-hidden="true" />
              {{ procedimentoDe(item.procedimento).rotulo }}
            </span>
            <span class="ra-barra__valor">
              <span class="ui-num">{{ numero(item.feitos) }}</span> feitos ·
              <span class="ui-num">{{ numero(item.naoFeitos) }}</span> não
            </span>
            <span class="ra-barra__trilho" aria-hidden="true">
              <span
                class="ra-barra__cheio"
                :style="{ width: `${(item.feitos / (item.feitos + item.naoFeitos)) * 100}%` }"
              />
            </span>
          </li>
        </ol>
      </section>
    </div>

    <p class="ra-privacidade">
      <i class="ph ph-lock-simple" aria-hidden="true" />
      Só contagens: o relatório não traz nome de tutor nem endereço. Um CEP pode ser uma rua só:
      cuidado ao divulgar recortes com poucos atendimentos.
    </p>

    <!-- A folha do papel: só ela vai para a impressão, em cores fixas. -->
    <Teleport to="body">
      <div class="clinic-print-root ra-impressao" aria-hidden="true">
        <article class="ra-papel">
          <header class="ra-papel__cabeca">
            <span class="ra-papel__empresa">Pet Journey Saúde e Tecnologia Ltda.</span>
            <h1>Relatório de atendimentos · {{ nomeDoAgrupamento[agrupamento].titulo }}</h1>
            <p>Programa de saúde de cães e gatos · Campo Grande/MS</p>
            <p>
              Recorte: {{ recorteNaFrase }} ·
              <strong>simulação com dados ilustrativos (protótipo)</strong>
            </p>
          </header>

          <dl class="ra-papel__numeros">
            <div>
              <dt>Atendimentos</dt>
              <dd>{{ numero(resumo.total) }}</dd>
            </div>
            <div>
              <dt>Realizados</dt>
              <dd>{{ numero(resumo.realizados) }}</dd>
            </div>
            <div>
              <dt>Parciais</dt>
              <dd>{{ numero(resumo.parciais) }}</dd>
            </div>
            <div>
              <dt>Não realizados</dt>
              <dd>{{ numero(resumo.naoRealizados) }}</dd>
            </div>
            <div>
              <dt>Realizado</dt>
              <dd>{{ resumo.taxa }}%</dd>
            </div>
          </dl>

          <table class="ra-papel__tabela">
            <thead>
              <tr>
                <th>{{ nomeDoAgrupamento[agrupamento].coluna }}</th>
                <th>Onde fica</th>
                <th class="ra-papel__numero">Atend.</th>
                <th class="ra-papel__numero">Realiz.</th>
                <th class="ra-papel__numero">Não realiz.</th>
                <th class="ra-papel__numero">%</th>
                <th>Motivo mais comum</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="linha in linhas" :key="linha.chave">
                <td>
                  <strong>{{ linha.rotulo }}</strong>
                </td>
                <td>{{ linha.onde }}</td>
                <td class="ra-papel__numero">{{ numero(linha.total) }}</td>
                <td class="ra-papel__numero">{{ numero(linha.realizados) }}</td>
                <td class="ra-papel__numero">{{ numero(naoRealizadosDaLinha(linha)) }}</td>
                <td class="ra-papel__numero">{{ linha.taxa }}%</td>
                <td>{{ motivoPrincipal(linha)?.rotulo ?? 'Tudo feito' }}</td>
              </tr>
            </tbody>
          </table>

          <section v-if="resumo.motivos.length" class="ra-papel__secao">
            <h2>Por que não deu</h2>
            <p>
              <span v-for="(item, indice) in resumo.motivos" :key="item.motivo">
                {{ motivoDe(item.motivo).rotulo }}: {{ numero(item.vezes)
                }}{{ indice < resumo.motivos.length - 1 ? ' · ' : '.' }}
              </span>
            </p>
          </section>

          <section class="ra-papel__secao">
            <h2>Por procedimento</h2>
            <p>
              <span v-for="(item, indice) in resumo.procedimentos" :key="item.procedimento">
                {{ procedimentoDe(item.procedimento).rotulo }}: {{ numero(item.feitos) }} feitos,
                {{ numero(item.naoFeitos) }} não{{
                  indice < resumo.procedimentos.length - 1 ? ' · ' : '.'
                }}
              </span>
            </p>
          </section>

          <p class="ra-papel__pe">
            Só contagens, sem nome de tutor nem endereço. Gerado em {{ geradoEm }} no portal da
            PetJourney.
          </p>
        </article>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ra {
  display: grid;
  gap: 18px;
}

.ra-caixa {
  display: grid;
  align-content: start;
  gap: 16px;
}

.ra-cabeca {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ra-rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 650;
}

.ra-trilho :deep(.p-togglebutton-content) {
  gap: 6px;
}

/* ---------------------------------------------------------------------------- o resultado */

.ra-numeros {
  display: grid;
  gap: 12px 14px;
  margin: 0;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

@media (max-width: 900px) {
  .ra-numeros {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.ra-numeros div {
  display: grid;
  gap: 2px;
}

.ra-numeros dt {
  order: 2;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ra-numeros dd {
  margin: 0;
  color: var(--tinta);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

/* "Ver por" e "Ordem" lado a lado, em cima da tabela. */
.ra-ver {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 28px;
}

.ra-ver__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.ra-tabela__rolo {
  overflow-x: auto;
}

.ra-tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.ra-tabela th,
.ra-tabela td {
  padding: 10px 14px 10px 0;
  border-bottom: 1px solid var(--app-regua, var(--linha-suave));
  color: var(--tinta-2);
  text-align: start;
  vertical-align: middle;
}

.ra-tabela thead th {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.ra-tabela tbody tr:last-child th,
.ra-tabela tbody tr:last-child td {
  border-bottom: 0;
}

.ra-tabela__numero {
  text-align: end !important;
  white-space: nowrap;
}

.ra-tabela__taxa {
  width: 12rem;
}

.ra-lugar {
  display: grid;
  gap: 1px;
}

.ra-lugar strong {
  color: var(--tinta);
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.ra-lugar--sem {
  font-style: italic;
}

.ra-lugar small {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 400;
}

.ra-parciais {
  display: block;
  color: var(--tinta-2);
  font-size: 11.5px;
}

.ra-taxa {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ra-taxa > .ui-num {
  min-width: 3ch;
  color: var(--tinta);
  font-weight: 650;
  text-align: end;
}

.ra-taxa__trilho {
  position: relative;
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.ra-taxa__barra {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--ok);
}

/* Abaixo de 85% realizado, a barra fica na cor de atenção: o lugar pede uma olhada. */
.ra-taxa__barra--baixa {
  background: var(--atencao);
}

.ra-motivo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
}

.ra-motivo--nada {
  color: var(--tinta-2);
  font-style: italic;
}

.ra-mais {
  justify-self: center;
}

/* ------------------------------------------------------------------------------ o porquê */

.ra-par {
  display: grid;
  align-items: start;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr));
}

.ra-nada {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ra-nada i {
  color: var(--ok-tinta);
}

.ra-barras {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ra-barra {
  display: grid;
  align-items: center;
  gap: 6px 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.ra-barra__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.ra-barra__valor {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.ra-barra__valor .ui-num,
.ra-barra__valor.ui-num {
  color: var(--tinta);
  font-weight: 650;
}

.ra-barra__trilho {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--superficie-3);
  grid-column: 1 / -1;
}

.ra-barra__cheio {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--ok);
}

.ra-barra__cheio--motivo {
  background: var(--atencao);
}

.ra-privacidade {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ra-privacidade i {
  margin-top: 2px;
}

/* ------------------------------------------------------------------------------- o papel */

/* Na tela, a cópia do papel nunca aparece; na impressão, a regra do portal a mostra. */
.ra-impressao {
  display: none;
}

.ra-papel {
  display: grid;
  gap: 14px;
  background: #fff;
  color: #40524b;
  font-size: 11.5px;
  line-height: 1.45;
}

.ra-papel__cabeca {
  display: grid;
  gap: 2px;
  padding-bottom: 10px;
  border-bottom: 2px solid #285e4e;
}

.ra-papel__cabeca p {
  margin: 0;
}

.ra-papel__cabeca strong {
  color: #905204;
}

.ra-papel__empresa {
  color: #285e4e;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ra-papel h1 {
  margin: 0;
  color: #142721;
  font-size: 20px;
  font-weight: 800;
}

.ra-papel h2 {
  margin: 0;
  color: #142721;
  font-size: 13px;
  font-weight: 750;
}

.ra-papel__numeros {
  display: grid;
  gap: 8px;
  margin: 0;
  grid-template-columns: repeat(5, 1fr);
}

.ra-papel__numeros div {
  padding: 8px 10px;
  border: 1px solid #dfe7e3;
  border-radius: 8px;
}

.ra-papel__numeros dt {
  font-size: 10.5px;
}

.ra-papel__numeros dd {
  margin: 0;
  color: #142721;
  font-size: 18px;
  font-weight: 800;
}

.ra-papel__tabela {
  width: 100%;
  border-collapse: collapse;
}

.ra-papel__tabela th,
.ra-papel__tabela td {
  padding: 5px 8px 5px 0;
  border-bottom: 1px solid #dfe7e3;
  text-align: start;
}

.ra-papel__tabela th {
  color: #142721;
  font-size: 10.5px;
}

.ra-papel__tabela tr {
  break-inside: avoid;
}

.ra-papel__tabela strong {
  color: #142721;
}

.ra-papel__numero {
  text-align: end !important;
  white-space: nowrap;
}

.ra-papel__secao {
  display: grid;
  gap: 4px;
  break-inside: avoid;
}

.ra-papel__secao p,
.ra-papel__pe {
  margin: 0;
}

.ra-papel__pe {
  color: #5e6d67;
  font-size: 10.5px;
}
</style>
