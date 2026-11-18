<script setup lang="ts">
/**
 * O extrato de um veterinário num mês (protótipo): quanto produziu, quanto tem a receber e de onde
 * sai cada real. É o mesmo extrato na gaveta da gestão e em "Meus repasses", a tela do próprio
 * veterinário: os dois leem a mesma conta, e ninguém discute número no fim do mês.
 */
import { computed } from 'vue'

import { dataCurta, descreverRegra, nomeDoMes, reais, ROTULO_DA_BASE } from '../dados'
import { useFinanceiro } from '../estado'

const props = defineProps<{ profissionalId: string; mes: string; compacto?: boolean }>()

const fin = useFinanceiro()

const dados = computed(() => fin.repasse(props.profissionalId, props.mes))
const parcial = computed(() => props.mes === fin.mesAtual.value)

const numeros = computed(() => {
  const d = dados.value
  if (!d) return []
  const c = d.calculo
  const valorFinal = d.fechamento ? d.fechamento.valor : c.aReceber
  return [
    {
      id: 'producao',
      rotulo: 'Produção',
      valor: reais(c.producao),
      nota: `${c.atendimentos} ${c.atendimentos === 1 ? 'atendimento' : 'atendimentos'}`,
    },
    {
      id: 'repasse',
      rotulo: 'Repasse',
      valor: reais(c.bruto),
      nota: c.aguardando
        ? `+ ${reais(c.aguardando)} quando os clientes pagarem`
        : 'tudo já recebido pela clínica',
    },
    {
      id: 'adiantado',
      rotulo: 'Adiantado',
      valor: c.adiantado ? `− ${reais(c.adiantado)}` : reais(0),
      nota: c.adiantado ? 'sai deste mês' : 'nenhum adiantamento',
    },
    {
      id: 'final',
      rotulo: d.fechamento?.pagoEm ? 'Pago' : 'A receber',
      valor: reais(valorFinal),
      nota: d.fechamento?.pagoEm
        ? `em ${dataCurta(d.fechamento.pagoEm)}`
        : d.fechamento
          ? `fechado em ${dataCurta(d.fechamento.fechadoEm)}`
          : parcial.value
            ? 'até hoje, o mês segue aberto'
            : 'mês aberto',
      destaque: true,
    },
  ]
})
</script>

<template>
  <div v-if="dados" class="ex" :class="{ 'ex--compacto': compacto }">
    <ul class="ex__numeros" :aria-label="`Repasse de ${nomeDoMes(mes)}`">
      <li
        v-for="n in numeros"
        :key="n.id"
        class="ex__numero"
        :class="{ 'ex__numero--destaque': n.destaque }"
      >
        <span class="ex__rotulo">{{ n.rotulo }}</span>
        <strong class="ui-num">{{ n.valor }}</strong>
        <small>{{ n.nota }}</small>
      </li>
    </ul>

    <p class="ex__regra ui-poco">
      <i class="ph ph-scales" aria-hidden="true" />
      <span>
        <strong>{{ dados.regra.vinculo }}:</strong> {{ descreverRegra(dados.regra) }}.
        <template v-if="dados.regra.modelo === 'percentual'">
          {{ ROTULO_DA_BASE[dados.regra.base] }}.</template
        >
        Pagamento no dia 5, no Pix {{ dados.regra.chavePix }}.
      </span>
    </p>

    <div class="ex__lista-cabeca">
      <h3 class="ex__titulo">
        {{ dados.regra.modelo === 'por-dia' ? 'Dias de atendimento' : 'Atendimentos' }} de
        {{ nomeDoMes(mes) }}
      </h3>
      <span class="ex__contagem">{{ dados.calculo.linhas.length }}</span>
    </div>
    <ul v-if="dados.calculo.linhas.length" class="ex__lista">
      <li
        v-for="linha in dados.calculo.linhas"
        :key="linha.id"
        class="ex__linha"
        :class="{ 'ex__linha--aguardando': linha.aguardando }"
      >
        <span class="ex__data ui-num">{{ dataCurta(linha.data) }}</span>
        <span class="ex__texto">
          <strong
            >{{ linha.petNome
            }}<template v-if="linha.tutorNome"> · {{ linha.tutorNome }}</template></strong
          >
          <small
            >{{ linha.descricao
            }}<template v-if="linha.base"> · base {{ reais(linha.base) }}</template></small
          >
        </span>
        <span v-if="linha.aguardando" class="ui-selo ui-selo--atencao ex__selo">
          <i class="ph ph-hourglass-medium" aria-hidden="true" /> cliente não pagou
        </span>
        <strong class="ex__valor ui-num">{{ reais(linha.valor) }}</strong>
      </li>
    </ul>
    <p v-else class="ex__vazio">Nenhum atendimento com repasse neste mês.</p>
  </div>
</template>

<style scoped>
.ex {
  display: grid;
  gap: 16px;
  container-type: inline-size;
}

.ex__numeros {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ex--compacto .ex__numeros {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ex__numero {
  display: grid;
  align-content: start;
  gap: 2px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--superficie-2);
}

.ex__numero--destaque {
  background: color-mix(in oklab, var(--pets-fundo) 55%, var(--superficie));
}

.ex__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.ex__numero strong {
  color: var(--tinta);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.ex__numero small {
  color: var(--tinta-2);
  font-size: 12px;
  line-height: 1.35;
}

.ex__regra {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.5;
}

.ex__regra i {
  margin-top: 2px;
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 17px;
}

.ex__regra strong {
  color: var(--tinta);
}

.ex__lista-cabeca {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ex__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.ex__contagem {
  color: var(--tinta-2);
  font-size: 13px;
}

.ex__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ex__linha {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.ex__linha + .ex__linha {
  border-top: 1px solid var(--linha-suave);
}

.ex__data {
  width: 3rem;
  flex: none;
  color: var(--tinta-2);
  font-size: 13px;
}

.ex__texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 1px;
}

.ex__texto strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ex__texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
}

.ex__valor {
  min-width: 5.5rem;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
  text-align: end;
}

.ex__linha--aguardando .ex__valor {
  color: var(--tinta-2);
  font-weight: 500;
}

.ex__vazio {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

@container (max-width: 700px) {
  .ex__numeros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
