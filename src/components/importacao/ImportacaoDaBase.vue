<script setup lang="ts">
/**
 * Trazer pacientes de outro sistema, pela API (E2-05, PJ-NSCETD; guia e2, seção 4).
 *
 * Os mesmos três passos da demonstração (arquivo, dúvidas, importar), um assunto por vez. O estado
 * mora no store (`stores/importacao-da-base.ts`) e no servidor: a gravação é um job que segue com a
 * aba fechada, e ao abrir a tela a importação aberta volta pelo histórico.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import ImportacaoAndamento from '@/components/importacao/ImportacaoAndamento.vue'
import ImportacaoArquivo from '@/components/importacao/ImportacaoArquivo.vue'
import ImportacaoColunas from '@/components/importacao/ImportacaoColunas.vue'
import ImportacaoDuvidas from '@/components/importacao/ImportacaoDuvidas.vue'
import ImportacaoFim from '@/components/importacao/ImportacaoFim.vue'
import ImportacaoResumo from '@/components/importacao/ImportacaoResumo.vue'
import { faseDoStatus } from '@/components/importacao/leitura-da-importacao'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import MigracaoPassos from '@/features/clinico/components/migracao/MigracaoPassos.vue'
import { useImportacaoStore } from '@/stores/importacao-da-base'

const { t } = useI18n()
const store = useImportacaoStore()
const rotulos = useRotulosDoCadastro()

const erro = ref('')
const colunasAbertas = ref(false)
const revendoRespostas = ref(false)

async function retomar() {
  erro.value = ''

  try {
    await store.retomar()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('importacao.erroAoCarregar')).mensagem
  }
}

onMounted(() => void retomar())

const fase = computed(() => (store.importacao ? faseDoStatus(store.importacao.status) : null))

/** "Nada é gravado até você confirmar": vale até o botão de importar. */
const antesDeConfirmar = computed(
  () =>
    !fase.value ||
    fase.value === 'recebendo' ||
    fase.value === 'duvidas' ||
    fase.value === 'pronta',
)

/** O arquivo que está na tela: o lido aqui ou, depois de recarregar, o nome que o servidor guardou. */
const nomeDoArquivo = computed(
  () => store.planilha?.arquivo ?? store.importacao?.arquivoNome ?? null,
)

const detalheDoArquivo = computed(() => {
  const lida = store.planilha
  if (lida) {
    return t(
      'clinico.migracao.arquivoLido',
      { linhas: rotulos.numero(lida.linhas.length), colunas: lida.cabecalhos.length },
      lida.linhas.length,
    )
  }
  const atual = store.importacao
  return atual
    ? t('importacao.linhasDoArquivo', { n: rotulos.numero(atual.totalLinhas) }, atual.totalLinhas)
    : ''
})
</script>

<template>
  <UiPagina
    class="tela-importar"
    :titulo="t('clinico.migracao.titulo')"
    :resumo="t('clinico.migracao.lede')"
    :carregando="store.retomando && !store.importacao && !store.planilha && !erro"
    :erro="erro && !store.importacao && !store.planilha ? erro : ''"
    bloquear-se-suspenso
    @tentar-de-novo="retomar"
  >
    <template #voltar>
      <RouterLink to="/clinica/pacientes">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('clinico.migracao.sobre') }}
      </RouterLink>
    </template>

    <div class="imp">
      <div class="ui-folha imp__topo">
        <MigracaoPassos class="imp__passos" :etapa="store.etapa" />
        <p v-if="antesDeConfirmar" class="imp__garantia">
          <i class="ph ph-lock-simple" aria-hidden="true" />
          {{ t('clinico.migracao.arquivo.promessa') }}
        </p>
      </div>

      <div v-if="nomeDoArquivo" class="ui-folha imp__arquivo">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-file-text" /></span>
        <span class="imp__arquivo-texto">
          <strong
            ><bdi>{{ nomeDoArquivo }}</bdi></strong
          >
          <span class="ui-num">{{ detalheDoArquivo }}</span>
        </span>
        <span class="imp__arquivo-acoes">
          <Button
            v-if="store.planilha"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-table"
            :label="t('clinico.migracao.colunas.ver')"
            @click="colunasAbertas = true"
          />
          <Button
            v-if="store.podeTrocarArquivo"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-arrow-clockwise"
            :label="t('clinico.migracao.trocar')"
            @click="store.recomecar()"
          />
        </span>
      </div>

      <ImportacaoArquivo v-if="store.etapa === 'arquivo'" />
      <ImportacaoDuvidas
        v-else-if="store.etapa === 'duvidas' || (revendoRespostas && fase === 'pronta')"
        :revisao="revendoRespostas && store.etapa !== 'duvidas'"
        @voltar="revendoRespostas = false"
      />
      <ImportacaoResumo
        v-else-if="fase === 'pronta'"
        @colunas="colunasAbertas = true"
        @rever="revendoRespostas = true"
      />
      <ImportacaoAndamento v-else-if="fase === 'andando' || fase === 'parada'" />
      <ImportacaoFim v-else />
    </div>

    <template #sempre>
      <ImportacaoColunas v-model:visible="colunasAbertas" />
    </template>
  </UiPagina>
</template>

<style scoped>
.imp {
  display: grid;
  min-width: 0;
  gap: 20px;
}

/* Os passos à esquerda, a garantia à direita; no estreito, um embaixo do outro. */
.imp__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px 32px;
  padding: 14px 16px 14px 22px;
}

.imp__passos {
  flex: 1 1 30rem;
  max-width: 44rem;
}

.imp__garantia {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 8px 14px;
  border-radius: var(--raio-controle);
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 13.5px;
  font-weight: 550;
}

.imp__garantia i {
  font-size: 17px;
}

.imp__arquivo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 14px;
  padding: 14px 16px 14px 18px;
}

.imp__arquivo-texto {
  display: grid;
  flex: 1 1 16rem;
  min-width: 0;
  gap: 1px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.imp__arquivo-texto strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.imp__arquivo-acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
