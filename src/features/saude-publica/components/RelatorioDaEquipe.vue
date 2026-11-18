<script setup lang="ts">
/**
 * O relatório da equipe de campo (17/11/2026, "adicionar relatório da equipe"), no mesmo recorte da
 * aba "Atendimentos por lugar" (`RecorteDoRelatorio.vue`, em cima da página).
 *
 * Três caixas, uma por assunto: os números da equipe e a tabela por pessoa (atendimentos,
 * realizados, não realizados com o motivo mais comum, % realizado, dias em campo e média por dia),
 * os totais por função, e a nota de que a equipe é de exemplo. Abrir uma pessoa mostra, numa gaveta,
 * o que ela fez e não fez por procedimento, por origem e por dia.
 *
 * Quem faz o cadastro e a acolhida entra em cada animal que acolheu; quem atende, em cada
 * atendimento que fez. Com pessoas escolhidas no filtro "Equipe", a tabela mostra só elas.
 *
 * Saídas como na outra aba: a folha para imprimir (`clinic-print-root`, cores fixas) e a planilha
 * CSV (ponto e vírgula e BOM). A página chama as duas pelo `defineExpose`.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, ref } from 'vue'

import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import {
  registrosDoRelatorio,
  resumirEquipe,
  resumirFuncoes,
  resumirRegistros,
  type LinhaDaEquipe,
} from '@/features/saude-publica/campo'
import PessoaDaEquipeGaveta from '@/features/saude-publica/components/PessoaDaEquipeGaveta.vue'
import {
  dataCurta,
  funcao,
  funcaoDaPessoa,
  motivo as motivoDe,
  numero,
} from '@/features/saude-publica/dados'
import { useRecorteDoRelatorio } from '@/features/saude-publica/recorte-do-relatorio'

const { filtro, recorteNaFrase, equipe } = useRecorteDoRelatorio()

type Ordem = 'total' | 'taxa' | 'nome'
const ordem = ref<Ordem>('total')

const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'total', rotulo: 'Mais atendimentos' },
  { valor: 'taxa', rotulo: 'Menor % realizado' },
  { valor: 'nome', rotulo: 'Nome' },
]

/* ============================================================================== o resultado */

const registros = computed(() => registrosDoRelatorio(filtro.value))
const resumo = computed(() => resumirRegistros(registros.value))

/** Uma linha por pessoa; com pessoas escolhidas no filtro, só elas. */
const pessoas = computed(() => {
  const todas = resumirEquipe(registros.value)
  return equipe.value.length
    ? todas.filter((linha) => equipe.value.includes(linha.pessoa.id))
    : todas
})

const linhas = computed<LinhaDaEquipe[]>(() => {
  const lista = [...pessoas.value]
  if (ordem.value === 'taxa') return lista.sort((uma, outra) => uma.taxa - outra.taxa)
  if (ordem.value === 'nome') {
    return lista.sort((uma, outra) => uma.pessoa.nome.localeCompare(outra.pessoa.nome, 'pt'))
  }
  return lista.sort((uma, outra) => outra.total - uma.total)
})

const funcoes = computed(() => resumirFuncoes(pessoas.value))
const maiorFuncao = computed(() => Math.max(1, ...funcoes.value.map((item) => item.atendimentos)))

/** A média de atendimentos por dia em campo, das pessoas do recorte. */
const mediaDaEquipe = computed(() => {
  if (!pessoas.value.length) return '0'
  const soma = pessoas.value.reduce((total, linha) => total + linha.mediaPorDia, 0)
  return decimal(soma / pessoas.value.length)
})

function decimal(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}

const FRENTE: Record<string, string> = {
  piloto: 'Consultório Móvel',
  campanhas: 'Campanhas',
}

function ondeAtuou(linha: LinhaDaEquipe) {
  return linha.frentes.length > 1 ? 'Os dois' : FRENTE[linha.frentes[0]!]
}

function motivoPrincipal(linha: LinhaDaEquipe) {
  const primeiro = linha.motivos[0]
  return primeiro ? motivoDe(primeiro.motivo) : null
}

const naoRealizados = (linha: LinhaDaEquipe) => linha.naoRealizados + linha.parciais

/* ---------------------------------------------------------------------------- a gaveta */

const aberta = ref(false)
const pessoaAberta = ref<string | null>(null)
const linhaAberta = computed(
  () => pessoas.value.find((linha) => linha.pessoa.id === pessoaAberta.value) ?? null,
)

function abrir(linha: LinhaDaEquipe) {
  pessoaAberta.value = linha.pessoa.id
  aberta.value = true
}

/* ================================================================================ as saídas */

function hojeEmTexto() {
  const agora = new Date()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${agora.getFullYear()}-${mes}-${dia}`
}

const geradoEm = computed(() => dataCurta(hojeEmTexto()))

function imprimir() {
  window.print()
}

function campoCsv(valor: string | number) {
  const texto = String(valor)
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** A planilha da equipe: uma linha por pessoa, com o recorte na primeira linha. */
function baixarPlanilha() {
  const cabeca = [
    'Pessoa',
    'Função',
    'Onde atuou',
    'Atendimentos',
    'Realizados',
    'Parciais',
    'Não realizados',
    '% realizado',
    'Motivo mais comum',
    'Dias em campo',
    'Média por dia',
  ]
  const corpo = linhas.value.map((linha) => [
    linha.pessoa.nome,
    funcaoDaPessoa(linha.pessoa),
    ondeAtuou(linha) ?? '',
    linha.total,
    linha.realizados,
    linha.parciais,
    linha.naoRealizados,
    linha.taxa,
    motivoPrincipal(linha)?.rotulo ?? '',
    linha.dias,
    decimal(linha.mediaPorDia),
  ])
  const texto = [[`Recorte: ${recorteNaFrase.value}`], cabeca, ...corpo]
    .map((linha) => linha.map(campoCsv).join(';'))
    .join('\r\n')
  const blob = new Blob([`﻿${texto}\r\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `equipe-de-campo-${hojeEmTexto()}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

defineExpose({ imprimir, baixarPlanilha })
</script>

<template>
  <div class="re">
    <!-- A equipe: os números e uma linha por pessoa. -->
    <section class="ui-folha ui-cartao re-caixa" aria-labelledby="re-equipe">
      <header class="ui-cartao__cabeca re-cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-users-three" /></span>
        <span class="ui-cartao__titulos">
          <h2 id="re-equipe" class="ui-cartao__titulo">
            A equipe no recorte
            <span class="ui-contagem">{{ numero(linhas.length) }}</span>
          </h2>
          <p class="ui-cartao__descricao">
            Equipe de exemplo. No Consultório Móvel, cada pessoa atende em pessoa; nas campanhas,
            responde por um posto, com os voluntários dele. Quem faz o cadastro conta cada animal
            que acolheu.
          </p>
        </span>
      </header>

      <UiVazioIlustrado
        v-if="!linhas.length"
        aninhado
        icone="ph ph-users-three"
        titulo="Ninguém da equipe neste recorte"
        texto="Mude a origem, o período, os animais, a situação, a equipe ou o lugar."
      />

      <template v-else>
        <dl class="re-numeros">
          <div>
            <dt>Pessoas</dt>
            <dd class="ui-num">{{ numero(linhas.length) }}</dd>
          </div>
          <div>
            <dt>Atendimentos</dt>
            <dd class="ui-num">{{ numero(resumo.total) }}</dd>
          </div>
          <div>
            <dt>Realizado</dt>
            <dd class="ui-num">{{ resumo.taxa }}%</dd>
          </div>
          <div>
            <dt>Por pessoa, por dia em campo</dt>
            <dd class="ui-num">{{ mediaDaEquipe }}</dd>
          </div>
        </dl>

        <div class="re-ver">
          <span id="re-ordem" class="re-rotulo">Ordem</span>
          <SelectButton
            v-model="ordem"
            :options="ORDENS"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            size="small"
            aria-labelledby="re-ordem"
          />
        </div>

        <div class="re-tabela__rolo">
          <table class="re-tabela">
            <thead>
              <tr>
                <th scope="col">Pessoa</th>
                <th scope="col">Onde atuou</th>
                <th scope="col" class="re-tabela__numero">Atendimentos</th>
                <th scope="col" class="re-tabela__numero">Realizados</th>
                <th scope="col">Não realizados</th>
                <th scope="col" class="re-tabela__taxa">% realizado</th>
                <th scope="col" class="re-tabela__numero">Dias</th>
                <th scope="col" class="re-tabela__numero">Por dia</th>
                <th scope="col"><span class="sr-only">Detalhe</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="linha in linhas" :key="linha.pessoa.id">
                <th scope="row">
                  <span class="re-pessoa">
                    <span class="ui-ladrilho re-pessoa__icone" aria-hidden="true">
                      <i :class="funcao(linha.pessoa.funcao).icone" />
                    </span>
                    <span class="re-pessoa__texto">
                      <strong>{{ linha.pessoa.nome }}</strong>
                      <small>{{ funcaoDaPessoa(linha.pessoa) }}</small>
                    </span>
                  </span>
                </th>
                <td>{{ ondeAtuou(linha) }}</td>
                <td class="re-tabela__numero ui-num">{{ numero(linha.total) }}</td>
                <td class="re-tabela__numero ui-num">{{ numero(linha.realizados) }}</td>
                <td>
                  <span class="re-nao">
                    <span class="ui-num">{{ numero(naoRealizados(linha)) }}</span>
                    <small v-if="motivoPrincipal(linha)" :title="motivoPrincipal(linha)!.rotulo">
                      <i :class="motivoPrincipal(linha)!.icone" aria-hidden="true" />
                      {{ motivoPrincipal(linha)!.rotulo }}
                    </small>
                  </span>
                </td>
                <td class="re-tabela__taxa">
                  <span class="re-taxa">
                    <span class="re-taxa__trilho" aria-hidden="true">
                      <span
                        class="re-taxa__barra"
                        :class="{ 're-taxa__barra--baixa': linha.taxa < 85 }"
                        :style="{ width: `${linha.taxa}%` }"
                      />
                    </span>
                    <span class="ui-num">{{ linha.taxa }}%</span>
                  </span>
                </td>
                <td class="re-tabela__numero ui-num">{{ numero(linha.dias) }}</td>
                <td class="re-tabela__numero ui-num">{{ decimal(linha.mediaPorDia) }}</td>
                <td class="re-tabela__acao">
                  <Button
                    type="button"
                    size="small"
                    severity="secondary"
                    outlined
                    icon="ph ph-caret-right"
                    icon-pos="right"
                    label="Abrir"
                    :aria-label="`Abrir ${linha.pessoa.nome}`"
                    @click="abrir(linha)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <!-- Por função: quantas pessoas, quantos atendimentos e quanto deu certo. -->
    <section v-if="funcoes.length" class="ui-folha ui-cartao re-caixa" aria-labelledby="re-funcoes">
      <header class="ui-cartao__cabeca re-cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-briefcase" /></span>
        <span class="ui-cartao__titulos">
          <h2 id="re-funcoes" class="ui-cartao__titulo">Por função</h2>
          <p class="ui-cartao__descricao">
            Quantas pessoas de cada função entraram no recorte, e quanto do que fizeram deu certo.
          </p>
        </span>
      </header>
      <ol class="re-barras">
        <li v-for="item in funcoes" :key="item.funcao" class="re-barra">
          <span class="re-barra__rotulo">
            <i :class="funcao(item.funcao).icone" aria-hidden="true" />
            {{ funcao(item.funcao).grupo }}
            <small>
              {{ numero(item.pessoas) }} {{ item.pessoas === 1 ? 'pessoa' : 'pessoas' }}
            </small>
          </span>
          <span class="re-barra__valor">
            <span class="ui-num">{{ numero(item.atendimentos) }}</span>
            {{ item.funcao === 'cadastro' ? 'acolhidos' : 'atendimentos' }} ·
            <span class="ui-num">{{ item.taxa }}%</span> realizado
          </span>
          <span class="re-barra__trilho" aria-hidden="true">
            <span
              class="re-barra__cheio"
              :style="{ width: `${(item.atendimentos / maiorFuncao) * 100}%` }"
            />
          </span>
        </li>
      </ol>
    </section>

    <p class="re-privacidade">
      <i class="ph ph-lock-simple" aria-hidden="true" />
      Só contagens: o relatório não traz nome de tutor nem endereço. A equipe é de exemplo, com
      nomes fictícios.
    </p>

    <PessoaDaEquipeGaveta v-model:visible="aberta" :linha="linhaAberta" />

    <!-- A folha do papel: só ela vai para a impressão, em cores fixas. -->
    <Teleport to="body">
      <div class="clinic-print-root re-impressao" aria-hidden="true">
        <article class="re-papel">
          <header class="re-papel__cabeca">
            <span class="re-papel__empresa">Pet Journey Saúde e Tecnologia Ltda.</span>
            <h1>Relatório da equipe de campo</h1>
            <p>Programa de saúde de cães e gatos · Campo Grande/MS</p>
            <p>
              Recorte: {{ recorteNaFrase }} ·
              <strong>simulação com dados ilustrativos e equipe de exemplo (protótipo)</strong>
            </p>
          </header>

          <dl class="re-papel__numeros">
            <div>
              <dt>Pessoas</dt>
              <dd>{{ numero(linhas.length) }}</dd>
            </div>
            <div>
              <dt>Atendimentos</dt>
              <dd>{{ numero(resumo.total) }}</dd>
            </div>
            <div>
              <dt>Realizado</dt>
              <dd>{{ resumo.taxa }}%</dd>
            </div>
            <div>
              <dt>Por pessoa, por dia</dt>
              <dd>{{ mediaDaEquipe }}</dd>
            </div>
          </dl>

          <table class="re-papel__tabela">
            <thead>
              <tr>
                <th>Pessoa</th>
                <th>Função</th>
                <th>Onde atuou</th>
                <th class="re-papel__numero">Atend.</th>
                <th class="re-papel__numero">Realiz.</th>
                <th class="re-papel__numero">Não realiz.</th>
                <th class="re-papel__numero">%</th>
                <th class="re-papel__numero">Dias</th>
                <th class="re-papel__numero">Por dia</th>
                <th>Motivo mais comum</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="linha in linhas" :key="linha.pessoa.id">
                <td>
                  <strong>{{ linha.pessoa.nome }}</strong>
                </td>
                <td>{{ funcaoDaPessoa(linha.pessoa) }}</td>
                <td>{{ ondeAtuou(linha) }}</td>
                <td class="re-papel__numero">{{ numero(linha.total) }}</td>
                <td class="re-papel__numero">{{ numero(linha.realizados) }}</td>
                <td class="re-papel__numero">{{ numero(naoRealizados(linha)) }}</td>
                <td class="re-papel__numero">{{ linha.taxa }}%</td>
                <td class="re-papel__numero">{{ numero(linha.dias) }}</td>
                <td class="re-papel__numero">{{ decimal(linha.mediaPorDia) }}</td>
                <td>{{ motivoPrincipal(linha)?.rotulo ?? 'Tudo feito' }}</td>
              </tr>
            </tbody>
          </table>

          <section class="re-papel__secao">
            <h2>Por função</h2>
            <p>
              <span v-for="(item, indice) in funcoes" :key="item.funcao">
                {{ funcao(item.funcao).grupo }}: {{ numero(item.pessoas) }}
                {{ item.pessoas === 1 ? 'pessoa' : 'pessoas' }}, {{ numero(item.atendimentos) }}
                {{ item.funcao === 'cadastro' ? 'acolhidos' : 'atendimentos' }}, {{ item.taxa }}%
                realizado{{ indice < funcoes.length - 1 ? ' · ' : '.' }}
              </span>
            </p>
          </section>

          <p class="re-papel__pe">
            Equipe de exemplo. Só contagens, sem nome de tutor nem endereço. Gerado em
            {{ geradoEm }} no portal da PetJourney.
          </p>
        </article>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.re {
  display: grid;
  gap: 18px;
}

.re-caixa {
  display: grid;
  align-content: start;
  gap: 16px;
}

.re-cabeca {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.re-rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 650;
}

.re-numeros {
  display: grid;
  gap: 12px 14px;
  margin: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.re-numeros div {
  display: grid;
  gap: 2px;
}

.re-numeros dt {
  order: 2;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.re-numeros dd {
  margin: 0;
  color: var(--tinta);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.re-ver {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.re-tabela__rolo {
  overflow-x: auto;
}

.re-tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.re-tabela th,
.re-tabela td {
  padding: 10px 14px 10px 0;
  border-bottom: 1px solid var(--app-regua, var(--linha-suave));
  color: var(--tinta-2);
  text-align: start;
  vertical-align: middle;
}

.re-tabela thead th {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.re-tabela tbody tr:last-child th,
.re-tabela tbody tr:last-child td {
  border-bottom: 0;
}

.re-tabela__numero {
  text-align: end !important;
  white-space: nowrap;
}

.re-tabela__taxa {
  width: 11rem;
}

.re-tabela__acao {
  width: 1%;
  padding-inline-end: 0 !important;
  text-align: end !important;
}

.re-pessoa {
  display: flex;
  align-items: center;
  gap: 10px;
}

.re-pessoa__icone {
  flex: none;
}

.re-pessoa__texto {
  display: grid;
  gap: 1px;
}

.re-pessoa__texto strong {
  color: var(--tinta);
  font-weight: 650;
  white-space: nowrap;
}

.re-pessoa__texto small {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
}

.re-nao {
  display: grid;
  gap: 1px;
}

.re-nao .ui-num {
  color: var(--tinta);
  font-weight: 600;
}

/* O motivo numa linha só, cortado com reticências (o texto inteiro fica no title). */
.re-nao small {
  display: block;
  overflow: hidden;
  max-width: 14rem;
  color: var(--tinta-2);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.re-nao small i {
  margin-inline-end: 5px;
  vertical-align: -1px;
}

.re-taxa {
  display: flex;
  align-items: center;
  gap: 10px;
}

.re-taxa > .ui-num {
  min-width: 3ch;
  color: var(--tinta);
  font-weight: 650;
  text-align: end;
}

.re-taxa__trilho {
  position: relative;
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.re-taxa__barra {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--ok);
}

/* Abaixo de 85% realizado, a barra fica na cor de atenção, como na aba dos lugares. */
.re-taxa__barra--baixa {
  background: var(--atencao);
}

.re-barras {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.re-barra {
  display: grid;
  align-items: center;
  gap: 6px 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.re-barra__rotulo {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.re-barra__rotulo small {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 400;
}

.re-barra__valor {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.re-barra__valor .ui-num {
  color: var(--tinta);
  font-weight: 650;
}

.re-barra__trilho {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--superficie-3);
  grid-column: 1 / -1;
}

.re-barra__cheio {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--ok);
}

.re-privacidade {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.re-privacidade i {
  margin-top: 2px;
}

/* ------------------------------------------------------------------------------- o papel */

.re-impressao {
  display: none;
}

.re-papel {
  display: grid;
  gap: 14px;
  background: #fff;
  color: #40524b;
  font-size: 11.5px;
  line-height: 1.45;
}

.re-papel__cabeca {
  display: grid;
  gap: 2px;
  padding-bottom: 10px;
  border-bottom: 2px solid #285e4e;
}

.re-papel__cabeca p {
  margin: 0;
}

.re-papel__cabeca strong {
  color: #905204;
}

.re-papel__empresa {
  color: #285e4e;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.re-papel h1 {
  margin: 0;
  color: #142721;
  font-size: 20px;
  font-weight: 800;
}

.re-papel h2 {
  margin: 0;
  color: #142721;
  font-size: 13px;
  font-weight: 750;
}

.re-papel__numeros {
  display: grid;
  gap: 8px;
  margin: 0;
  grid-template-columns: repeat(4, 1fr);
}

.re-papel__numeros div {
  padding: 8px 10px;
  border: 1px solid #dfe7e3;
  border-radius: 8px;
}

.re-papel__numeros dt {
  font-size: 10.5px;
}

.re-papel__numeros dd {
  margin: 0;
  color: #142721;
  font-size: 18px;
  font-weight: 800;
}

.re-papel__tabela {
  width: 100%;
  border-collapse: collapse;
}

.re-papel__tabela th,
.re-papel__tabela td {
  padding: 5px 8px 5px 0;
  border-bottom: 1px solid #dfe7e3;
  text-align: start;
}

.re-papel__tabela th {
  color: #142721;
  font-size: 10.5px;
}

.re-papel__tabela tr {
  break-inside: avoid;
}

.re-papel__tabela strong {
  color: #142721;
}

.re-papel__numero {
  text-align: end !important;
  white-space: nowrap;
}

.re-papel__secao {
  display: grid;
  gap: 4px;
  break-inside: avoid;
}

.re-papel__secao p,
.re-papel__pe {
  margin: 0;
}

.re-papel__pe {
  color: #5e6d67;
  font-size: 10.5px;
}
</style>
