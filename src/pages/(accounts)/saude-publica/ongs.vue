<script setup lang="ts">
/**
 * Saúde pública › ONGs e adoção (protótipo, Ofício 001/2026, itens 4b e 4c): os sistemas liberados
 * sem custo para as ONGs e os protetores, e a adoção que leva o histórico de saúde para o app de
 * quem adota, com 3 meses do plano completo. As adoções recentes em cima (é o que emociona e o que
 * prova), as ONGs embaixo. "Registrar adoção" abre a gaveta do lado da ONG.
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'

import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import AvisoDoPrototipo from '@/features/saude-publica/components/AvisoDoPrototipo.vue'
import RegistrarAdocaoGaveta from '@/features/saude-publica/components/RegistrarAdocaoGaveta.vue'
import { ADOCOES, dataCurta, numero, ong, ONGS, regiao } from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo } from '@/features/saude-publica/estado'

const { adocoes } = useEstadoDoPrototipo()

/** As adoções do período (as das ONGs) mais as registradas na apresentação. */
const totais = computed(() => {
  const novas = adocoes.value.length - ADOCOES.length
  return {
    ongs: ONGS.filter((item) => item.tipo === 'ONG').length,
    protetores: ONGS.filter((item) => item.tipo !== 'ONG').length,
    animais: ONGS.reduce((soma, item) => soma + item.animais, 0) - novas,
    adocoes: ONGS.reduce((soma, item) => soma + item.adocoes, 0) + novas,
  }
})

const gavetaAberta = ref(false)
</script>

<template>
  <UiPagina
    titulo="ONGs e adoção"
    icone="ph ph-hand-heart"
    resumo="Os sistemas sem custo para quem protege, e o animal adotado saindo com a saúde em dia e registrada."
  >
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

      <dl class="og-totais">
        <div>
          <dt>ONGs</dt>
          <dd class="ui-num">{{ totais.ongs }}</dd>
        </div>
        <div>
          <dt>Protetores independentes</dt>
          <dd class="ui-num">{{ totais.protetores }}</dd>
        </div>
        <div>
          <dt>Animais sob cuidado</dt>
          <dd class="ui-num">{{ numero(totais.animais) }}</dd>
        </div>
        <div>
          <dt>Adoções com o histórico junto</dt>
          <dd class="ui-num">{{ numero(totais.adocoes) }}</dd>
        </div>
      </dl>

      <UiSecao titulo="Adoções recentes" icone="ph ph-heart" :contagem="adocoes.length">
        <ul class="og-adocoes">
          <li v-for="adocao in adocoes" :key="adocao.id" class="og-adocao">
            <PetAvatar
              :nome="adocao.animal"
              :iniciais="iniciais(adocao.animal)"
              :especie="adocao.especie === 'GATO' ? 'felina' : 'canina'"
              tamanho="md"
            />
            <span class="og-adocao__texto">
              <strong>{{ adocao.animal }}</strong>
              <span>
                De {{ ong(adocao.ongId).nome }} para {{ adocao.adotante }} ·
                {{ dataCurta(adocao.data) }}
              </span>
            </span>
            <span class="og-adocao__selos">
              <span class="og-selo og-selo--historico">
                <i class="ph ph-clipboard-text" aria-hidden="true" />
                {{ adocao.registros }} registros no app
              </span>
              <span class="og-selo og-selo--plano">
                <i class="ph ph-gift" aria-hidden="true" />
                3 meses do plano
              </span>
            </span>
          </li>
        </ul>
      </UiSecao>

      <UiSecao
        titulo="ONGs e protetores"
        icone="ph ph-house-line"
        descricao="Com os sistemas da PetJourney liberados sem custo: o histórico de cada animal, os avisos de vacina e retorno, e a adoção."
        folha
      >
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
          <tbody>
            <tr v-for="item in ONGS" :key="item.id">
              <th scope="row">{{ item.nome }}</th>
              <td>{{ item.tipo }}</td>
              <td>{{ regiao(item.regiao).nome }}</td>
              <td class="og-tabela__numero ui-num">{{ item.animais }}</td>
              <td class="og-tabela__numero ui-num">{{ item.adocoes }}</td>
            </tr>
          </tbody>
        </table>
      </UiSecao>
    </div>

    <RegistrarAdocaoGaveta v-model:visible="gavetaAberta" />
  </UiPagina>
</template>

<style scoped>
.og {
  display: grid;
  gap: 22px;
}

.og-totais {
  display: grid;
  gap: 12px;
  margin: 0;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
}

.og-totais div {
  display: grid;
  gap: 2px;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
}

.og-totais dt {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.og-totais dd {
  margin: 0;
  color: var(--tinta);
  font-size: 26px;
  font-weight: 800;
}

.og-adocoes {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
  list-style: none;
}

.og-adocao {
  display: grid;
  align-items: center;
  gap: 10px 12px;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  grid-template-columns: auto minmax(0, 1fr);
}

.og-adocao__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13px;
}

.og-adocao__texto strong {
  color: var(--tinta);
  font-size: 15px;
}

.og-adocao__selos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  grid-column: 1 / -1;
}

.og-selo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 650;
}

.og-selo--historico {
  background: var(--pets-fundo);
  color: var(--pets-tinta);
}

.og-selo--plano {
  background: var(--portal-fundo);
  color: var(--portal-tinta);
}

.og-tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.og-tabela th,
.og-tabela td {
  padding: 10px 12px 10px 0;
  border-bottom: 1px solid var(--linha-suave);
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
