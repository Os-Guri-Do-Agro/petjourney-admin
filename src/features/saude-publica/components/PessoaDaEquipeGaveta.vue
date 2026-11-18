<script setup lang="ts">
/**
 * Uma pessoa da equipe no recorte (17/11/2026, "relatório da equipe"), numa gaveta à direita: os
 * números dela, o que fez e o que não deu por procedimento (com os motivos), por origem (Consultório
 * Móvel e cada campanha) e por dia em campo.
 */
import Button from 'primevue/button'
import { computed } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import type { LinhaDaEquipe } from '@/features/saude-publica/campo'
import {
  dataCurta,
  funcao,
  funcaoDaPessoa,
  motivo as motivoDe,
  numero,
  procedimento as procedimentoDe,
  tipoDeCampanha,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo } from '@/features/saude-publica/estado'

const props = defineProps<{ linha: LinhaDaEquipe | null }>()
const aberta = defineModel<boolean>('visible', { default: false })

const { campanhas } = useEstadoDoPrototipo()

const FRENTE: Record<string, string> = {
  piloto: 'Consultório Móvel',
  campanhas: 'Campanhas',
}

const sobre = computed(() => {
  const linha = props.linha
  if (!linha) return ''
  return `${funcaoDaPessoa(linha.pessoa)} · trabalha em ${linha.pessoa.atua.map((frente) => FRENTE[frente]).join(' e ')}`
})

function nomeDaOrigem(origem: string) {
  if (origem === 'piloto') return 'Consultório Móvel (piloto)'
  const campanha = campanhas.value.find((item) => item.id === origem)
  return campanha
    ? `${tipoDeCampanha(campanha.tipo).rotulo} · ${dataCurta(campanha.data).slice(0, 5)}`
    : origem
}

function diaDaSemana(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number]
  return new Date(ano, mes - 1, dia)
    .toLocaleDateString('pt-BR', { weekday: 'short' })
    .replace('.', '')
}

const maiorDia = computed(() => Math.max(1, ...(props.linha?.porDia.map((dia) => dia.total) ?? [])))

const media = computed(() =>
  (props.linha?.mediaPorDia ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }),
)
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="linha?.pessoa.nome ?? 'Pessoa da equipe'"
    :icone="linha ? funcao(linha.pessoa.funcao).icone : 'ph ph-user'"
    largura="34rem"
  >
    <div v-if="linha" class="pe">
      <p class="pe__sobre">{{ sobre }}</p>

      <dl class="pe__numeros">
        <div>
          <dt>
            {{ linha.pessoa.funcao === 'cadastro' ? 'Cadastros e acolhidas' : 'Atendimentos' }}
          </dt>
          <dd class="ui-num">{{ numero(linha.total) }}</dd>
        </div>
        <div>
          <dt>Realizados</dt>
          <dd class="ui-num">{{ numero(linha.realizados) }}</dd>
        </div>
        <div>
          <dt>Não realizados</dt>
          <dd class="ui-num">{{ numero(linha.naoRealizados + linha.parciais) }}</dd>
        </div>
        <div>
          <dt>Realizado</dt>
          <dd class="ui-num">{{ linha.taxa }}%</dd>
        </div>
        <div>
          <dt>Dias em campo</dt>
          <dd class="ui-num">{{ numero(linha.dias) }}</dd>
        </div>
        <div>
          <dt>Por dia, em média</dt>
          <dd class="ui-num">{{ media }}</dd>
        </div>
      </dl>

      <section class="pe__bloco" aria-labelledby="pe-procedimentos">
        <h3 id="pe-procedimentos" class="eg__rotulo">Por procedimento</h3>
        <ol class="pe__barras">
          <li v-for="item in linha.procedimentos" :key="item.procedimento" class="pe__barra">
            <span class="pe__barra-rotulo">
              <i :class="procedimentoDe(item.procedimento).icone" aria-hidden="true" />
              {{ procedimentoDe(item.procedimento).rotulo }}
            </span>
            <span class="pe__barra-valor">
              <span class="ui-num">{{ numero(item.feitos) }}</span> feitos ·
              <span class="ui-num">{{ numero(item.naoFeitos) }}</span> não
            </span>
            <span class="pe__trilho" aria-hidden="true">
              <span
                class="pe__cheio"
                :style="{ width: `${(item.feitos / (item.feitos + item.naoFeitos)) * 100}%` }"
              />
            </span>
          </li>
        </ol>
        <p v-if="linha.motivos.length" class="pe__motivos">
          <strong>Por que não deu:</strong>{{ ' ' }}
          <span v-for="(item, indice) in linha.motivos.slice(0, 4)" :key="item.motivo">
            {{ motivoDe(item.motivo).rotulo.toLowerCase() }} ({{ numero(item.vezes) }}){{
              indice < Math.min(4, linha.motivos.length) - 1 ? ', ' : '.'
            }}
          </span>
        </p>
      </section>

      <section class="pe__bloco" aria-labelledby="pe-origem">
        <h3 id="pe-origem" class="eg__rotulo">Por origem</h3>
        <ul class="pe__linhas">
          <li v-for="item in linha.porOrigem" :key="item.origem" class="pe__linha">
            <span>{{ nomeDaOrigem(item.origem) }}</span>
            <span class="pe__linha-numeros">
              <span class="ui-num">{{ numero(item.total) }}</span>
              <small class="ui-num">{{ item.taxa }}% realizado</small>
            </span>
          </li>
        </ul>
      </section>

      <section class="pe__bloco" aria-labelledby="pe-dias">
        <h3 id="pe-dias" class="eg__rotulo">
          Por dia
          <span class="ui-contagem">{{ numero(linha.porDia.length) }}</span>
        </h3>
        <ol class="pe__dias">
          <li v-for="dia in linha.porDia" :key="dia.data" class="pe__dia">
            <span class="pe__dia-data">
              <span class="ui-num">{{ dataCurta(dia.data) }}</span>
              <small>{{ diaDaSemana(dia.data) }}</small>
            </span>
            <span class="pe__trilho" aria-hidden="true">
              <span class="pe__cheio" :style="{ width: `${(dia.total / maiorDia) * 100}%` }" />
            </span>
            <span class="pe__dia-valor ui-num">
              {{ numero(dia.total) }}
              <small>· {{ numero(dia.realizados) }} feitos</small>
            </span>
          </li>
        </ol>
      </section>
    </div>

    <template #pe>
      <Button type="button" severity="secondary" outlined label="Fechar" @click="aberta = false" />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.pe {
  display: grid;
  gap: 18px;
}

.pe__sobre {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.pe__numeros {
  display: grid;
  gap: 12px 14px;
  margin: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.pe__numeros div {
  display: grid;
  gap: 2px;
}

.pe__numeros dt {
  order: 2;
  color: var(--tinta-2);
  font-size: 12px;
}

.pe__numeros dd {
  margin: 0;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
}

.pe__bloco {
  display: grid;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--linha);
}

.pe__bloco h3 {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.pe__barras,
.pe__linhas,
.pe__dias {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pe__barra {
  display: grid;
  align-items: center;
  gap: 6px 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.pe__barra-rotulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.pe__barra-valor {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.pe__barra-valor .ui-num {
  color: var(--tinta);
  font-weight: 650;
}

.pe__barra .pe__trilho {
  grid-column: 1 / -1;
}

.pe__trilho {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.pe__cheio {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--ok);
}

.pe__motivos {
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.5;
}

.pe__motivos strong {
  color: var(--tinta);
}

.pe__linha {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: var(--tinta);
  font-size: 13.5px;
}

.pe__linha-numeros {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}

.pe__linha-numeros .ui-num {
  font-weight: 650;
}

.pe__linha-numeros small {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 400;
}

.pe__dia {
  display: grid;
  align-items: center;
  gap: 10px;
  grid-template-columns: 7.5rem minmax(0, 1fr) 8.5rem;
}

.pe__dia-data {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: var(--tinta);
  font-size: 13px;
}

.pe__dia-data small {
  color: var(--tinta-2);
  font-size: 11.5px;
}

.pe__dia-valor {
  color: var(--tinta);
  font-size: 13px;
  font-weight: 650;
  text-align: end;
}

.pe__dia-valor small {
  color: var(--tinta-2);
  font-weight: 400;
}
</style>
