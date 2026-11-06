<script setup lang="ts">
/**
 * As colunas da planilha e para onde cada uma vai (guia e2, 4.1: a ligação das colunas é do portal).
 *
 * O sistema liga sozinho; aqui só se confere e se troca. Um campo vai para uma coluna só. Depois que
 * as linhas saíram para o servidor, a ligação fica como foi mandada.
 */
import Select from 'primevue/select'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { chaveDoCampo } from '@/components/importacao/leitura-da-importacao'
import {
  CAMPOS_DO_ANIMAL,
  CAMPOS_DO_RESPONSAVEL,
  colunasUsadas,
  exemplosDaColuna,
  preenchidasNaColuna,
} from '@/components/importacao/planilha-para-a-api'
import { letraDaColuna } from '@/features/clinico/domain/planilha'
import type { CampoDaLinha } from '@/service/parceiro/importacao-service'
import { useImportacaoStore } from '@/stores/importacao-da-base'

const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const store = useImportacaoStore()
const rotulos = useRotulosDoCadastro()

const NAO_TRAZER = '__nao__'

const grupos = computed(() => [
  {
    rotulo: t('clinico.migracao.colunas.grupoResponsavel'),
    itens: CAMPOS_DO_RESPONSAVEL.map((campo) => ({ valor: campo, rotulo: t(chaveDoCampo(campo)) })),
  },
  {
    rotulo: t('clinico.migracao.colunas.grupoAnimal'),
    itens: CAMPOS_DO_ANIMAL.map((campo) => ({ valor: campo, rotulo: t(chaveDoCampo(campo)) })),
  },
  {
    rotulo: t('clinico.migracao.colunas.grupoNenhum'),
    itens: [{ valor: NAO_TRAZER, rotulo: t('clinico.migracao.colunas.naoTrazer') }],
  },
])

const colunas = computed(() => {
  const lida = store.planilha
  if (!lida) return []
  return lida.cabecalhos.map((cabecalho, coluna) => ({
    coluna,
    titulo: cabecalho || t('clinico.migracao.colunas.semTitulo'),
    letra: letraDaColuna(coluna),
    exemplos: exemplosDaColuna(lida, coluna).join(' · '),
    preenchidas: preenchidasNaColuna(lida, coluna),
    campo: store.colunas.find((item) => item.coluna === coluna)?.campo ?? null,
  }))
})

const usadas = computed(() => colunasUsadas(store.colunas))

const faltas = computed(() =>
  new Intl.ListFormat(rotulos.intl(), { type: 'conjunction' }).format(
    store.faltas.map((campo) => t(chaveDoCampo(campo))),
  ),
)

function trocar(coluna: number, valor: string) {
  store.ligarColuna(coluna, valor === NAO_TRAZER ? null : (valor as CampoDaLinha))
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="t('clinico.migracao.colunas.titulo')"
    icone="ph ph-table"
    largura="34rem"
  >
    <p class="eg__dica">
      {{
        store.colunasTravadas
          ? t('clinico.migracao.colunas.travado')
          : t('clinico.migracao.colunas.texto')
      }}
    </p>
    <p class="col__usadas ui-num">
      {{ t('clinico.migracao.colunas.usadas', { n: usadas, total: colunas.length }) }}
    </p>
    <p v-if="store.faltas.length" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ t('clinico.migracao.colunas.faltam', { campos: faltas }) }}</span>
    </p>

    <ul class="col__lista">
      <li v-for="item in colunas" :key="item.coluna" class="col__item">
        <span class="col__texto">
          <strong>
            {{ t('clinico.migracao.colunas.coluna', { letra: item.letra }) }} ·
            <bdi>{{ item.titulo }}</bdi>
          </strong>
          <span class="col__exemplos">{{
            item.exemplos || t('clinico.migracao.colunas.vazia')
          }}</span>
          <span v-if="!item.campo && item.preenchidas" class="col__aviso">
            {{ t('clinico.migracao.colunas.naoVem', { n: item.preenchidas }, item.preenchidas) }}
          </span>
        </span>
        <Select
          :model-value="item.campo ?? NAO_TRAZER"
          :options="grupos"
          option-group-label="rotulo"
          option-group-children="itens"
          option-label="rotulo"
          option-value="valor"
          class="col__campo"
          :disabled="store.colunasTravadas"
          :aria-label="t('clinico.migracao.colunas.vaiParaAria', { coluna: item.letra })"
          @update:model-value="(valor: string) => trocar(item.coluna, valor)"
        />
      </li>
    </ul>
  </CadastroGaveta>
</template>

<style scoped>
.col__usadas {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.col__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.col__item {
  display: grid;
  gap: 8px;
  padding: 12px 0;
}

.col__item + .col__item {
  border-top: 1px solid var(--linha-suave);
}

.col__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13px;
}

.col__texto strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.col__exemplos {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col__aviso {
  color: var(--atencao-tinta);
}

.col__campo {
  width: 100%;
}
</style>
