<script setup lang="ts">
/**
 * Saúde pública › ONGs e adoção (protótipo, Ofício 001/2026, itens 4b e 4c): os sistemas liberados
 * sem custo para as ONGs e os protetores, e a adoção que leva o histórico de saúde para o app de
 * quem adota, com 3 meses do plano completo. Os totais na frase do alto; embaixo, uma caixa com as
 * adoções recentes (é o que prova) e outra com as ONGs. "Registrar adoção" abre a gaveta do lado da
 * ONG.
 *
 * Os filtros do espaço (`FiltrosDoPrototipo`): período (data da adoção), região (a da ONG) e
 * espécie. Os totais das ONGs são repartidos pelos dias do período e pela parte de cada espécie.
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'

import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import AvisoDoPrototipo from '@/features/saude-publica/components/AvisoDoPrototipo.vue'
import FiltrosDoPrototipo from '@/features/saude-publica/components/FiltrosDoPrototipo.vue'
import RegistrarAdocaoGaveta from '@/features/saude-publica/components/RegistrarAdocaoGaveta.vue'
import {
  ADOCOES,
  dataCurta,
  numero,
  ong,
  ONGS,
  PERIODO,
  regiao,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo } from '@/features/saude-publica/estado'
import { useFiltrosDoPrototipo } from '@/features/saude-publica/filtros'

const { adocoes } = useEstadoDoPrototipo()
const filtros = useFiltrosDoPrototipo()

/** A parte de cada espécie nos animais das ONGs (ilustrativa): mais cães que gatos. */
const PARTE_DA_ESPECIE = { todos: 1, caes: 0.62, gatos: 0.38 } as const

const naRegiao = (id: (typeof ONGS)[number]['regiao']) =>
  !filtros.regioes.value.length || filtros.regioes.value.includes(id)

/** As ONGs do recorte, com os animais na espécie e as adoções nos dias do período. */
const ongs = computed(() => {
  const parte = PARTE_DA_ESPECIE[filtros.especie.value]
  const dias = filtros.recorte.value.ate - filtros.recorte.value.de
  return ONGS.filter((item) => naRegiao(item.regiao)).map((item) => ({
    ...item,
    animais: Math.round(item.animais * parte),
    adocoes: Math.round((item.adocoes * parte * dias) / PERIODO.dias),
  }))
})

/** As adoções do recorte: a data no período, a ONG numa região escolhida, a espécie. */
const adocoesNoRecorte = computed(() =>
  adocoes.value.filter((adocao) => {
    const especie = filtros.especie.value
    const daEspecie = especie === 'todos' || (especie === 'gatos') === (adocao.especie === 'GATO')
    return (
      daEspecie &&
      naRegiao(ong(adocao.ongId).regiao) &&
      adocao.data >= filtros.de.value &&
      adocao.data <= filtros.ate.value
    )
  }),
)

/** Os totais do recorte, mais as adoções registradas na apresentação. */
const resumo = computed(() => {
  const novas = adocoes.value.length - ADOCOES.length
  const animais = ongs.value.reduce((soma, item) => soma + item.animais, 0) - novas
  const adotados = ongs.value.reduce((soma, item) => soma + item.adocoes, 0) + novas
  return `${ongs.value.length} ONGs e protetores ${filtros.lugarNaFrase.value} · ${numero(Math.max(0, animais))} animais sob cuidado · ${numero(adotados)} adoções com o histórico junto`
})

const gavetaAberta = ref(false)
</script>

<template>
  <UiPagina titulo="ONGs e adoção" icone="ph ph-hand-heart" :resumo="resumo">
    <template #acoes>
      <Button
        type="button"
        icon="ph ph-hand-heart"
        label="Registrar adoção"
        @click="gavetaAberta = true"
      />
    </template>

    <div class="og">
      <AvisoDoPrototipo />

      <FiltrosDoPrototipo :campos="['periodo', 'regiao', 'especie']" />

      <section class="ui-folha ui-cartao og-caixa" aria-labelledby="og-adocoes">
        <header class="ui-cartao__cabeca og-cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-heart" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="og-adocoes" class="ui-cartao__titulo">
              Adoções recentes
              <span class="ui-contagem">{{ adocoesNoRecorte.length }}</span>
            </h2>
            <p class="ui-cartao__descricao">
              Cada animal sai com o histórico de saúde no app de quem adotou, e o adotante ganha 3
              meses do plano completo.
            </p>
          </span>
        </header>

        <UiVazioIlustrado
          v-if="!adocoesNoRecorte.length"
          aninhado
          icone="ph ph-heart"
          titulo="Nenhuma adoção neste recorte"
          texto="Mude o período, a região ou a espécie nos filtros, ou limpe os filtros."
        />
        <ul v-else class="og-lista">
          <li v-for="adocao in adocoesNoRecorte" :key="adocao.id" class="og-linha">
            <PetAvatar
              :nome="adocao.animal"
              :iniciais="iniciais(adocao.animal)"
              :especie="adocao.especie === 'GATO' ? 'felina' : 'canina'"
              tamanho="sm"
            />
            <span class="og-linha__texto">
              <strong>{{ adocao.animal }}</strong>
              <span>
                De {{ ong(adocao.ongId).nome }} para {{ adocao.adotante }} ·
                {{ dataCurta(adocao.data) }}
              </span>
            </span>
            <span class="og-linha__selos">
              <span class="ui-selo og-selo--historico">
                <i class="ph ph-clipboard-text" aria-hidden="true" />
                {{ adocao.registros }} registros no app
              </span>
              <span class="ui-selo og-selo--plano">
                <i class="ph ph-gift" aria-hidden="true" />
                3 meses do plano
              </span>
            </span>
          </li>
        </ul>
      </section>

      <section class="ui-folha ui-cartao og-caixa" aria-labelledby="og-ongs">
        <header class="ui-cartao__cabeca og-cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-house-line" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="og-ongs" class="ui-cartao__titulo">
              ONGs e protetores
              <span class="ui-contagem">{{ ongs.length }}</span>
            </h2>
            <p class="ui-cartao__descricao">
              Com os sistemas da PetJourney sem custo: o histórico de cada animal, os avisos de
              vacina e retorno, e a adoção.
            </p>
          </span>
        </header>

        <table class="og-tabela">
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Tipo</th>
              <th scope="col">Região</th>
              <th scope="col" class="og-tabela__numero">Animais</th>
              <th scope="col" class="og-tabela__numero">Adoções no período</th>
            </tr>
          </thead>
          <tbody v-if="!ongs.length">
            <tr>
              <td colspan="5" class="og-tabela__vazio">Nenhuma ONG nas regiões escolhidas.</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr v-for="item in ongs" :key="item.id">
              <th scope="row">{{ item.nome }}</th>
              <td>{{ item.tipo }}</td>
              <td>{{ regiao(item.regiao).nome }}</td>
              <td class="og-tabela__numero ui-num">{{ item.animais }}</td>
              <td class="og-tabela__numero ui-num">{{ item.adocoes }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <RegistrarAdocaoGaveta v-model:visible="gavetaAberta" />
  </UiPagina>
</template>

<style scoped>
.og {
  display: grid;
  gap: 18px;
}

.og-tabela__vazio {
  color: var(--tinta-2);
  text-align: center;
}

.og-caixa {
  container: ongs / inline-size;
  display: grid;
  align-content: start;
  gap: 4px;
}

.og-cabeca {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.og-lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.og-linha {
  display: grid;
  align-items: center;
  gap: 8px 14px;
  padding: 12px 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.og-linha + .og-linha {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.og-linha__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
  color: var(--tinta-2);
  font-size: 13px;
}

.og-linha__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.og-linha__selos {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.og-linha__selos .ui-selo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.og-selo--historico {
  background: var(--pets-fundo);
  color: var(--pets-tinta);
}

.og-selo--plano {
  background: var(--portal-fundo);
  color: var(--portal-tinta);
}

@container ongs (max-width: 760px) {
  .og-linha {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .og-linha__selos {
    justify-content: flex-start;
    grid-column: 2;
  }
}

.og-tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.og-tabela th,
.og-tabela td {
  padding: 11px 12px 11px 0;
  border-bottom: 1px solid var(--app-regua, var(--linha-suave));
  color: var(--tinta-2);
  text-align: start;
}

.og-tabela thead th {
  color: var(--tinta-3);
  font-size: 12px;
  font-weight: 650;
}

.og-tabela tbody th {
  color: var(--tinta);
  font-weight: 650;
}

.og-tabela tbody tr:last-child th,
.og-tabela tbody tr:last-child td {
  border-bottom: 0;
}

.og-tabela__numero {
  padding-inline-end: 0;
  text-align: end !important;
}
</style>
