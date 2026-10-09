<script setup lang="ts">
/**
 * O que precisa ser visto antes de tudo — a primeira coisa abaixo do nome do paciente.
 *
 * "Saltar aos olhos" aqui é **ordem e tinta**, não superfície: o sinal de risco é a primeira
 * linha da página, com ícone e texto no tom de risco, e nada mais na tela usa esse tom. Uma
 * faixa vermelha cheia gritaria igual para a perda de peso de 16% e para a tosse de ontem, e a
 * pessoa aprende a não ler faixa.
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
    <ul v-if="linhas.length > 0" class="sinais__lista">
      <li
        v-for="linha in linhas"
        :key="linha.chave"
        class="sinal"
        :class="`sinal--${linha.severidade}`"
      >
        <i
          class="sinal__icone ph"
          :class="
            linha.severidade === 'risco' ? 'ph-warning' : 'ph-warning-circle'
          "
          aria-hidden="true"
        />
        <span class="sinal__texto">
          <strong class="sinal__titulo">{{ linha.titulo }}</strong>
          <span class="sinal__detalhe clinic-value">{{ linha.detalhe }}</span>
          <span v-if="linha.relato" class="sinal__relato">
            {{ t('clinico.resumoDoPaciente.sinais.relato', { relato: linha.relato }) }}
          </span>
          <span v-if="linha.complemento" class="sinal__complemento">
            {{ linha.complemento }}
          </span>
          <q v-if="linha.citacao" class="sinal__citacao">{{ linha.citacao }}</q>
        </span>
        <span class="sr-only">{{ formato.severidade(linha.severidade) }}</span>
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
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.sinais--sem-moldura {
  padding: 0;
  border: 0;
  background: transparent;
}

.sinais__mais {
  margin: var(--clinic-space-2) 0 0;
  padding-inline-start: calc(1rem + var(--clinic-space-2));
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 600;
}

.sinais__lista {
  display: grid;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-3);
  list-style: none;
}

.sinal {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: var(--clinic-space-2);
}

.sinal__icone {
  margin-top: 0.15em;
  font-size: 1rem;
}

.sinal--risco .sinal__icone,
.sinal--risco .sinal__titulo {
  color: var(--clinic-risk-text);
}

.sinal--atencao .sinal__icone {
  color: var(--clinic-attention-text);
}

.sinal__texto {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: var(--clinic-space-2);
  row-gap: var(--clinic-space-1);
  min-width: 0;
}

.sinal__titulo {
  font-size: var(--clinic-font-body);
  font-weight: 700;
}

.sinal--risco .sinal__titulo {
  font-size: var(--clinic-font-title);
}

.sinal__detalhe {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-body);
}

/* O relato fica na linha de baixo, em peso de texto: é a palavra que o enum não tinha. */
.sinal__relato {
  flex-basis: 100%;
  font-size: var(--clinic-font-body);
  font-weight: 700;
}

/* O motivo e o padrão de antes, numa linha própria, em tinta de texto. */
.sinal__complemento {
  flex-basis: 100%;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-body);
}

/* A fala do responsável, na íntegra: é o contexto que o número não dá. */
.sinal__citacao {
  flex-basis: 100%;
  padding-inline-start: var(--clinic-space-3);
  border-inline-start: 2px solid var(--clinic-risk-line);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-body);
  font-style: italic;
}

.sinais__nada {
  display: flex;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
  color: var(--clinic-muted);
  font-weight: 600;
}

.sinais__nada .ph {
  color: var(--clinic-ok-text);
}
</style>
