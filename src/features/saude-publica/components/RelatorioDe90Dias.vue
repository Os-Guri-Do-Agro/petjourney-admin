<script setup lang="ts">
/**
 * O relatório de 90 dias que o Ofício 001/2026 (item 7) promete à Câmara, como uma folha: na tela,
 * uma folha branca nos dois temas (é um documento); no papel, só ela (`clinic-print-root`, a regra de
 * impressão do portal esconde o resto). Os números saem dos mesmos dados do painel, mais o que a
 * apresentação criou (campanhas, adoções).
 */
import { computed } from 'vue'

import {
  ADOCOES,
  coberturaDaCidade,
  CONTEXTO_LEISHMANIOSE,
  dataCurta,
  INDICADORES,
  MINIMO_POR_BAIRRO,
  numero,
  ONGS,
  PERIODO,
  regiao,
  REGIOES,
  TOTAIS,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo } from '@/features/saude-publica/estado'

const { campanhas, adocoes } = useEstadoDoPrototipo()

const indicadores = INDICADORES.map((definicao) => {
  const inicio = coberturaDaCidade(definicao.id, 'inicio')
  const hoje = coberturaDaCidade(definicao.id)
  return { definicao, inicio, hoje, delta: hoje - inicio }
})

const ordemDasCampanhas = computed(() =>
  [...campanhas.value].sort((uma, outra) => uma.data.localeCompare(outra.data)),
)

const adocoesNoPeriodo = computed(
  () => ONGS.reduce((soma, item) => soma + item.adocoes, 0) + adocoes.value.length - ADOCOES.length,
)
</script>

<template>
  <article class="rel">
    <header class="rel__cabeca">
      <span class="rel__empresa">Pet Journey Saúde e Tecnologia Ltda.</span>
      <h1>Relatório de 90 dias</h1>
      <p class="rel__sub">Programa de acompanhamento da saúde de cães e gatos · Campo Grande/MS</p>
      <p class="rel__periodo">
        Período: {{ dataCurta(PERIODO.inicio) }} a {{ dataCurta(PERIODO.fim) }} ·
        <strong>simulação com dados ilustrativos (protótipo)</strong>
      </p>
    </header>

    <section class="rel__secao">
      <h2>1. Adesão</h2>
      <dl class="rel__numeros">
        <div>
          <dt>Cães e gatos com histórico no app</dt>
          <dd>{{ numero(TOTAIS.caes + TOTAIS.gatos) }}</dd>
        </div>
        <div>
          <dt>Tutores cadastrados</dt>
          <dd>{{ numero(TOTAIS.tutores) }}</dd>
        </div>
        <div>
          <dt>Com os 3 meses do plano completo</dt>
          <dd>{{ numero(TOTAIS.planoCompleto) }}</dd>
        </div>
        <div>
          <dt>Avisos de vacina, retorno e coleira</dt>
          <dd>{{ numero(TOTAIS.avisosEnviados) }}</dd>
        </div>
      </dl>
    </section>

    <section class="rel__secao">
      <h2>2. Prevenção na cidade</h2>
      <table class="rel__tabela">
        <thead>
          <tr>
            <th scope="col">Indicador</th>
            <th scope="col" class="rel__num">Início</th>
            <th scope="col" class="rel__num">90 dias</th>
            <th scope="col" class="rel__num">Variação</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="linha in indicadores" :key="linha.definicao.id">
            <th scope="row">
              {{ linha.definicao.rotulo }}
              <small>{{ linha.definicao.regra }}</small>
            </th>
            <td class="rel__num">{{ linha.inicio }}%</td>
            <td class="rel__num">
              <strong>{{ linha.hoje }}%</strong>
            </td>
            <td class="rel__num rel__alta">+{{ linha.delta }} p.p.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="rel__secao">
      <h2>3. Por região urbana (90 dias)</h2>
      <table class="rel__tabela">
        <thead>
          <tr>
            <th scope="col">Região</th>
            <th v-for="linha in indicadores" :key="linha.definicao.id" scope="col" class="rel__num">
              {{ linha.definicao.rotulo }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in REGIOES" :key="item.id">
            <th scope="row">{{ item.nome }}</th>
            <td v-for="linha in indicadores" :key="linha.definicao.id" class="rel__num">
              {{ item.cobertura[linha.definicao.id] }}%
              <small class="rel__alta"
                >+{{ item.cobertura[linha.definicao.id] - item.inicio[linha.definicao.id] }}</small
              >
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="rel__secao">
      <h2>4. Campanhas avisadas pelo app</h2>
      <table class="rel__tabela">
        <thead>
          <tr>
            <th scope="col">Campanha</th>
            <th scope="col">Dia</th>
            <th scope="col">Regiões</th>
            <th scope="col" class="rel__num">Avisados</th>
            <th scope="col" class="rel__num">Atendidos</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="campanha in ordemDasCampanhas" :key="campanha.id">
            <th scope="row">{{ campanha.titulo }}</th>
            <td>{{ dataCurta(campanha.data) }}</td>
            <td>{{ campanha.regioes.map((id) => regiao(id).nome).join(', ') }}</td>
            <td class="rel__num">{{ numero(campanha.avisados) }}</td>
            <td class="rel__num">
              {{ campanha.atendidos === null ? 'agendada' : numero(campanha.atendidos) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="rel__secao">
      <h2>5. ONGs e adoção</h2>
      <p>
        {{ ONGS.length }} ONGs e protetores usam os sistemas sem custo, com
        {{ numero(ONGS.reduce((soma, item) => soma + item.animais, 0)) }} animais sob cuidado.
        {{ numero(adocoesNoPeriodo) }} animais adotados saíram com o histórico de saúde no app de
        quem adotou, e cada adotante ganhou 3 meses do plano completo.
      </p>
    </section>

    <section class="rel__secao">
      <h2>6. Contexto: leishmaniose visceral</h2>
      <p>
        <template v-for="(ano, indice) in CONTEXTO_LEISHMANIOSE.anos" :key="ano.ano">
          {{ indice ? ' ' : '' }}Em {{ ano.ano }} ({{ ano.observacao }}), {{ ano.casos }} casos
          humanos{{ ano.obitos ? ` e ${ano.obitos} óbitos` : '' }}.
        </template>
        Fonte: {{ CONTEXTO_LEISHMANIOSE.fonte }}. Esses são os únicos números reais desta folha.
      </p>
    </section>

    <section class="rel__secao">
      <h2>7. Método e privacidade</h2>
      <p>
        Os números são contagens e percentuais por região urbana e por bairro, sem nenhum tutor
        identificado. Bairro com menos de {{ MINIMO_POR_BAIRRO }} animais não aparece. Dados
        pessoais não são vendidos nem cedidos a terceiros, nos termos da Lei nº 13.709/2018.
      </p>
    </section>

    <footer class="rel__pe">
      Ofício nº 001/2026, item 7: em 90 dias do início do programa, a empresa apresenta à Câmara
      Municipal de Campo Grande relatório com os resultados.
    </footer>
  </article>
</template>

<style scoped>
/* A folha: cores fixas de papel nos dois temas, para a tela e o PDF ficarem iguais. */
.rel {
  --rel-tinta: #142721;
  --rel-tinta-2: #40524b;
  --rel-tinta-3: #5e6d67;
  --rel-linha: #dfe7e3;
  --rel-verde: #285e4e;

  display: grid;
  gap: 18px;
  width: 100%;
  max-width: 210mm;
  box-sizing: border-box;
  padding: 18mm 16mm;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 16px 40px -24px rgb(0 0 0 / 45%);
  color: var(--rel-tinta-2);
  font-size: 13px;
  line-height: 1.5;
  justify-self: center;
}

.rel__cabeca {
  display: grid;
  gap: 2px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--rel-verde);
}

.rel__empresa {
  color: var(--rel-verde);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.rel h1 {
  margin: 0;
  color: var(--rel-tinta);
  font-size: 24px;
  font-weight: 800;
}

.rel__sub,
.rel__periodo {
  margin: 0;
}

.rel__periodo strong {
  color: #905204;
}

.rel__secao {
  display: grid;
  gap: 8px;
  break-inside: avoid;
}

.rel h2 {
  margin: 0;
  color: var(--rel-tinta);
  font-size: 15px;
  font-weight: 750;
}

.rel p {
  margin: 0;
}

.rel__numeros {
  display: grid;
  gap: 8px;
  margin: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.rel__numeros div {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--rel-linha);
  border-radius: 8px;
}

.rel__numeros dt {
  font-size: 11.5px;
}

.rel__numeros dd {
  margin: 0;
  color: var(--rel-tinta);
  font-size: 18px;
  font-weight: 800;
}

.rel__tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.rel__tabela th,
.rel__tabela td {
  padding: 6px 8px 6px 0;
  border-bottom: 1px solid var(--rel-linha);
  text-align: start;
  vertical-align: top;
}

.rel__tabela thead th {
  color: var(--rel-tinta-3);
  font-size: 11.5px;
  font-weight: 650;
}

.rel__tabela tbody th {
  color: var(--rel-tinta);
  font-weight: 650;
}

.rel__tabela tbody th small {
  display: block;
  color: var(--rel-tinta-3);
  font-size: 11px;
  font-weight: 400;
}

.rel__tabela strong {
  color: var(--rel-tinta);
}

.rel__num {
  text-align: end !important;
  white-space: nowrap;
}

.rel__alta {
  color: var(--rel-verde);
  font-weight: 650;
}

.rel__pe {
  padding-top: 10px;
  border-top: 1px solid var(--rel-linha);
  color: var(--rel-tinta-3);
  font-size: 11.5px;
}

/* No papel: sem a sombra e sem o recuo de tela (a margem é a do `@page`). */
@media print {
  .rel {
    max-width: none;
    padding: 0;
    border-radius: 0;
    box-shadow: none;
  }
}
</style>
