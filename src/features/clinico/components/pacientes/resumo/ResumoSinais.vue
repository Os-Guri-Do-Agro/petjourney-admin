<script setup lang="ts">
/**
 * O que precisa ser visto antes de tudo — a primeira coisa abaixo da capa do paciente.
 *
 * Uma faixa de avisos: uma linha por sinal, risco primeiro, cada uma com a marca de gravidade na
 * borda **e** o selo com a palavra (Risco, Atenção) — a cor nunca diz sozinha. "Saltar aos olhos"
 * continua sendo ordem e tinta, não superfície: a linha não é pintada de vermelho inteira, porque
 * uma faixa cheia gritaria igual para a perda de peso de 16% e para a tosse de ontem, e a pessoa
 * aprende a não ler faixa.
 *
 * Sem sinal nenhum, a linha diz isso — "nada fora do comum" também é resposta, e é a que o vet
 * mais quer ler.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../../composables/useClinicFormat'
import { useRotulosDoDiario } from '../../../composables/useRotulosDoDiario'
import { useRotulosDoTratamento } from '../../../composables/useRotulosDoTratamento'
import type { SinalDoResumo } from '../../../domain/resumo-do-paciente'
import { clinicClock } from '../../../stores/clinico'

const props = withDefaults(
  defineProps<{
    sinais: SinalDoResumo[]
    /**
     * Quantos sinais mostrar. A sugestão do histórico mostra só os primeiros — que já vêm em
     * ordem de risco — e conta o resto; a página do resumo mostra todos.
     */
    limite?: number
    /** Sem borda nem fundo próprio: para morar dentro de outra superfície, como um modal. */
    semMoldura?: boolean
  }>(),
  { limite: Number.POSITIVE_INFINITY, semMoldura: false },
)

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoDiario()
const rotulosDoTratamento = useRotulosDoTratamento()

/** Balança de casa tem duas casas; a da clínica, uma. Zero à direita não é informação. */
function kg(valor: number): string {
  return formato.numero(valor, Number.isInteger(Math.round(valor * 100) / 10) ? 1 : 2)
}

function percentual(valor: number): string {
  /* Sinal de menos tipográfico: o hífen some ao lado do parêntese. */
  return `${valor > 0 ? '+' : valor < 0 ? '−' : ''}${formato.numero(Math.abs(valor), 1)}%`
}

/** A gravidade do sinal no vocabulário do kit: o `info` do cadastro é o neutro. */
function tomDe(severidade: SinalDoResumo['severidade']): 'risco' | 'atencao' | 'neutro' {
  return severidade === 'info' ? 'neutro' : severidade
}

const restantes = computed(() => Math.max(0, props.sinais.length - props.limite))

const linhas = computed(() =>
  props.sinais.slice(0, props.limite).map((sinal, indice) => {
    switch (sinal.tipo) {
      case 'perda-de-peso':
        return {
          chave: `peso-${indice}`,
          severidade: sinal.severidade,
          titulo: sinal.variacao.continua
            ? t('clinico.resumoDoPaciente.sinais.perdaContinua')
            : t('clinico.resumoDoPaciente.sinais.perda'),
          detalhe: t('clinico.resumoDoPaciente.sinais.perdaDetalhe', {
            de: kg(sinal.variacao.deKg),
            para: kg(sinal.variacao.paraKg),
            percentual: percentual(sinal.variacao.percentual),
            semanas: sinal.variacao.semanas,
          }),
          relato: '',
          citacao: '',
          complemento: '',
        }
      case 'alarme':
        return {
          chave: `alarme-${sinal.em}`,
          severidade: sinal.severidade,
          titulo: rotulos.lista(sinal.achados.map(rotulos.achado)),
          detalhe: t('clinico.resumoDoPaciente.sinais.alarmeDetalhe', {
            data: formato.dataCurta(clinicClock.dateOf(sinal.em)),
            quando: formato.relativo(sinal.em),
          }),
          /*
           * O que o enum não tem mora aqui: "desmaiou" não existe em `SintomaPet`, e é
           * justamente a palavra que o vet precisa ler.
           */
          relato: sinal.relato ?? '',
          citacao: sinal.texto ?? '',
          complemento: '',
        }
      case 'sintoma-recorrente':
        return {
          chave: `recorrente-${sinal.sintoma}`,
          severidade: sinal.severidade,
          titulo: rotulos.sintoma(sinal.sintoma),
          detalhe: t('clinico.resumoDoPaciente.sinais.recorrenteDetalhe', { vezes: sinal.vezes }),
          relato: '',
          citacao: '',
          complemento: '',
        }
      case 'campo-alterado':
        return {
          chave: `campo-${sinal.campo}`,
          severidade: sinal.severidade,
          titulo: `${rotulos.campo(sinal.campo)}: ${rotulos
            .valor(sinal.campo, sinal.predominante)
            .toLocaleLowerCase()}`,
          detalhe: t('clinico.resumoDoPaciente.sinais.campoDetalhe', {
            alterados: sinal.alterados,
            total: sinal.total,
          }),
          relato: '',
          citacao: '',
          complemento: '',
        }
      case 'polifarmacia':
        return {
          chave: 'polifarmacia',
          severidade: sinal.severidade,
          titulo: t('clinico.resumoDoPaciente.sinais.polifarmacia', { total: sinal.total }),
          detalhe: t('clinico.resumoDoPaciente.sinais.polifarmaciaDetalhe'),
          relato: '',
          citacao: '',
          complemento: '',
        }
      case 'adesao': {
        /*
         * O remédio crítico que perdeu o ritmo em casa. O motivo vai na linha de baixo, nas
         * palavras da casa — "acabou o remédio" diz ao vet o que fazer antes do exame.
         */
        const alerta = rotulosDoTratamento.alerta(sinal.alerta)

        return {
          chave: `adesao-${sinal.tratamentoId}`,
          severidade: sinal.severidade,
          titulo: t('clinico.resumoDoPaciente.sinais.adesao', {
            medicamento: rotulosDoTratamento.nome(sinal),
          }),
          detalhe: alerta.titulo,
          relato: '',
          citacao: '',
          complemento: alerta.detalhe,
        }
      }
    }
  }),
)
</script>

<template>
  <section
    class="sinais"
    :class="{ 'sinais--sem-moldura': semMoldura }"
    :aria-label="t('clinico.resumoDoPaciente.sinais.titulo')"
  >
    <ul v-if="linhas.length > 0" class="sinais__lista ui-lista">
      <li
        v-for="linha in linhas"
        :key="linha.chave"
        class="sinal ui-marca"
        :class="[`sinal--${linha.severidade}`, `ui-marca--${tomDe(linha.severidade)}`]"
      >
        <span class="sinal__icone" aria-hidden="true">
          <i class="ph" :class="linha.severidade === 'risco' ? 'ph-warning' : 'ph-warning-circle'" />
        </span>
        <span class="sinal__texto">
          <strong class="sinal__titulo">{{ linha.titulo }}</strong>
          <span class="sinal__detalhe">{{ linha.detalhe }}</span>
          <span v-if="linha.relato" class="sinal__relato">
            {{ t('clinico.resumoDoPaciente.sinais.relato', { relato: linha.relato }) }}
          </span>
          <span v-if="linha.complemento" class="sinal__complemento">
            {{ linha.complemento }}
          </span>
          <q v-if="linha.citacao" class="sinal__citacao">{{ linha.citacao }}</q>
        </span>
        <span class="ui-selo sinal__selo" :class="`ui-selo--${tomDe(linha.severidade)}`">
          {{ formato.severidade(linha.severidade) }}
        </span>
      </li>
    </ul>

    <p v-if="linhas.length > 0 && restantes > 0" class="sinais__mais">
      {{ t('clinico.resumoDoPaciente.sinais.mais', { total: restantes }) }}
    </p>

    <p v-if="linhas.length === 0" class="sinais__nada">
      <i class="ph ph-check-circle" aria-hidden="true" />
      {{ t('clinico.resumoDoPaciente.sinais.nadaFora') }}
    </p>
  </section>
</template>

<style scoped>
.sinais {
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
}

.sinais--sem-moldura {
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.sinal {
  position: relative;
  display: grid;
  align-items: start;
  gap: 4px 14px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding: 14px 18px 14px 22px;
}

.sinal__icone {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-size: 18px;
}

.sinal--risco .sinal__icone {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.sinal--atencao .sinal__icone {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.sinal__texto {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
  padding-top: 5px;
}

.sinal__titulo {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
}

.sinal--risco .sinal__titulo {
  color: var(--risco-tinta);
}

.sinal__detalhe {
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 13.5px;
  font-variant-numeric: tabular-nums;
}

/* O relato fica na linha de baixo, em peso de texto: é a palavra que o enum não tinha. */
.sinal__relato {
  flex-basis: 100%;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

/* O motivo e o padrão de antes, numa linha própria, em tinta de texto. */
.sinal__complemento {
  flex-basis: 100%;
  color: var(--tinta-2);
  font-size: 13.5px;
}

/* A fala do responsável, na íntegra: é o contexto que o número não dá. */
.sinal__citacao {
  flex-basis: 100%;
  margin-top: 4px;
  padding-inline-start: 12px;
  border-inline-start: 2px solid var(--linha-forte);
  color: var(--tinta-2);
  font-size: 14px;
  font-style: italic;
}

.sinal__selo {
  margin-top: 4px;
}

.sinais__mais {
  margin: 0;
  padding: 10px 18px 14px 68px;
  border-top: 1px solid var(--linha);
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 550;
}

.sinais__nada {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 14px 18px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 550;
}

.sinais__nada .ph {
  color: var(--ok-tinta);
  font-size: 20px;
}

@media (max-width: 520px) {
  .sinal {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .sinal__selo {
    grid-column: 2;
    justify-self: start;
    margin-top: 2px;
  }
}
</style>
