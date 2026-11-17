<script setup lang="ts">
/**
 * A região escolhida no mapa, numa gaveta à direita: quantos animais e tutores, os quatro
 * indicadores com o começo e o hoje, as campanhas que passaram por ela, e o atalho para criar uma
 * campanha já com a região marcada. É a pergunta do gestor: "e no Anhanduizinho, o que eu faço?".
 *
 * Os números seguem o período e a espécie dos filtros (`recorte`): o do fim do período, o do começo
 * e quanto andou entre os dois.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import {
  dataCurta,
  INDICADORES,
  numero,
  regiao as regiaoDe,
  tipoDeCampanha,
  type IdDaRegiao,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo } from '@/features/saude-publica/estado'
import {
  coberturaDaRegiao,
  dataDoDia,
  pontos,
  publicoNoRecorte,
  RECORTE_INTEIRO,
  seAplica,
  type Recorte,
} from '@/features/saude-publica/serie'

const props = withDefaults(defineProps<{ regiaoId: IdDaRegiao | null; recorte?: Recorte }>(), {
  recorte: () => RECORTE_INTEIRO,
})
const aberta = defineModel<boolean>('visible', { default: false })

const router = useRouter()
const { campanhas } = useEstadoDoPrototipo()

const regiao = computed(() => (props.regiaoId ? regiaoDe(props.regiaoId) : null))

/** A data em que o período começa, para a frase "era X% em 01/12/2026". */
const comecoDoPeriodo = computed(() => dataCurta(dataDoDia(props.recorte.de)))

const linhas = computed(() => {
  const alvo = regiao.value
  if (!alvo) return []
  const { de, ate, especie } = props.recorte
  return INDICADORES.filter((definicao) => seAplica(definicao.id, especie)).map((definicao) => ({
    definicao,
    hoje: Math.round(coberturaDaRegiao(alvo, definicao.id, ate, especie)),
    inicio: Math.round(coberturaDaRegiao(alvo, definicao.id, de, especie)),
    publico: publicoNoRecorte(alvo, definicao.id, especie),
    quem:
      definicao.publico === 'caes' || especie === 'caes'
        ? 'cães'
        : especie === 'gatos'
          ? 'gatos'
          : 'cães e gatos',
  }))
})

const daRegiao = computed(() =>
  regiao.value ? campanhas.value.filter((item) => item.regioes.includes(regiao.value!.id)) : [],
)

function criarCampanha() {
  if (!regiao.value) return
  aberta.value = false
  void router.push({
    path: '/saude-publica/campanhas',
    query: { nova: '1', regiao: regiao.value.id },
  })
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="regiao ? `Região ${regiao.nome}` : ''"
    icone="ph ph-map-pin-area"
    largura="32rem"
  >
    <template v-if="regiao">
      <dl class="rg__numeros">
        <div>
          <dt>Cães</dt>
          <dd class="ui-num">{{ numero(regiao.caes) }}</dd>
        </div>
        <div>
          <dt>Gatos</dt>
          <dd class="ui-num">{{ numero(regiao.gatos) }}</dd>
        </div>
        <div>
          <dt>Tutores no app</dt>
          <dd class="ui-num">{{ numero(regiao.tutores) }}</dd>
        </div>
      </dl>

      <section class="eg__secao">
        <h3 class="rg__titulo">Prevenção na região</h3>
        <ul class="rg__indicadores">
          <li v-for="linha in linhas" :key="linha.definicao.id" class="rg__indicador">
            <span class="rg__rotulo">
              <i :class="linha.definicao.icone" aria-hidden="true" />
              {{ linha.definicao.rotulo }}
            </span>
            <span class="rg__valor ui-num">{{ linha.hoje }}%</span>
            <!-- O começo (traço) e o hoje (barra) na mesma régua de 0 a 100%. -->
            <span class="rg__regua" aria-hidden="true">
              <span class="rg__barra" :style="{ width: `${linha.hoje}%` }" />
              <span class="rg__inicio" :style="{ insetInlineStart: `${linha.inicio}%` }" />
            </span>
            <span class="rg__frase">
              Era {{ linha.inicio }}% em {{ comecoDoPeriodo }}:
              {{ pontos(linha.hoje - linha.inicio) }}, de {{ numero(linha.publico) }}
              {{ linha.quem }}.
            </span>
          </li>
        </ul>
      </section>

      <section class="eg__secao">
        <h3 class="rg__titulo">Campanhas na região</h3>
        <ul v-if="daRegiao.length" class="rg__campanhas">
          <li v-for="campanha in daRegiao" :key="campanha.id">
            <i :class="tipoDeCampanha(campanha.tipo).icone" aria-hidden="true" />
            <span>
              <strong>{{ campanha.titulo }}</strong>
              {{ dataCurta(campanha.data) }} ·
              {{ campanha.situacao === 'encerrada' ? 'encerrada' : 'agendada' }}
            </span>
          </li>
        </ul>
        <p v-else class="eg__dica">Nenhuma campanha nesta região no período.</p>
      </section>
    </template>

    <template #pe>
      <Button type="button" severity="secondary" outlined label="Fechar" @click="aberta = false" />
      <Button
        type="button"
        icon="ph ph-megaphone"
        label="Criar campanha aqui"
        @click="criarCampanha"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.rg__numeros {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.rg__numeros div {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--superficie-2);
}

.rg__numeros dt {
  color: var(--tinta-3);
  font-size: 12px;
  font-weight: 650;
}

.rg__numeros dd {
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 750;
}

.rg__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 700;
}

.rg__indicadores {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rg__indicador {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 10px;
}

.rg__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
}

.rg__valor {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 750;
}

.rg__regua {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: var(--superficie-3);
  grid-column: 1 / -1;
}

.rg__barra {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--pets);
}

.rg__inicio {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  margin-inline-start: -1px;
  border-radius: 2px;
  background: var(--tinta);
}

.rg__frase {
  color: var(--tinta-2);
  font-size: 12.5px;
  grid-column: 1 / -1;
}

.rg__campanhas {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rg__campanhas li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta-2);
  font-size: 13px;
}

.rg__campanhas i {
  margin-top: 2px;
  color: var(--tinta);
  font-size: 16px;
}

.rg__campanhas strong {
  display: block;
  color: var(--tinta);
  font-size: 13.5px;
}
</style>
