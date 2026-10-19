<script setup lang="ts">
/**
 * Trazer pacientes de outro sistema.
 *
 * É a funcionalidade que decide a venda — nenhuma clínica troca de sistema se tiver que
 * redigitar quinze anos de pacientes — e a que mais facilmente destrói a confiança no primeiro
 * dia, se perder dado calada.
 *
 * A tela é um assistente: **uma coisa por vez**, num cartão só, com o acabamento da Visão geral
 * (escolha do usuário depois de a primeira versão ser recusada por confusa e com botões que não se
 * viam). Três passos: o arquivo, as dúvidas uma a uma, e o resumo que vira progresso e
 * relatório. As colunas eram um passo e deixaram de ser — ninguém no balcão entendia "ligar coluna
 * a campo"; o sistema liga sozinho, e a conferência fica num painel ("Ver colunas"), como a
 * explicação linha por linha: existe, mas só abre quando alguém pede.
 *
 * O estado mora na store (`stores/migracao.ts`), não aqui: a importação continua se a pessoa sair
 * desta tela, e a lista de pacientes avisa onde ela está.
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * Tela de detalhe do destino Pacientes: "Pacientes" para voltar, o título dizendo o que se faz e
 * a frase do porquê. Embaixo, os três passos numerados — o número só porque a ordem é de verdade —
 * e, ao lado deles, a garantia que tira o medo de começar: nada é gravado até a confirmação.
 * Ela fica à vista em todos os passos até o botão de importar, e não só no primeiro.
 */
import '@/features/clinico/components/migracao/migracao.css'

import Button from 'primevue/button'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import MigracaoPassoArquivo from '@/features/clinico/components/migracao/MigracaoPassoArquivo.vue'
import MigracaoColunas from '@/features/clinico/components/migracao/MigracaoColunas.vue'
import MigracaoPassoDuvidas from '@/features/clinico/components/migracao/MigracaoPassoDuvidas.vue'
import MigracaoPassoImportar from '@/features/clinico/components/migracao/MigracaoPassoImportar.vue'
import MigracaoPassos from '@/features/clinico/components/migracao/MigracaoPassos.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useClinicoStore } from '@/features/clinico/stores/clinico'
import { useMigracaoStore } from '@/features/clinico/stores/migracao'

const { t } = useI18n()
const clinico = useClinicoStore()
const migracao = useMigracaoStore()
const formato = useClinicFormat()

const colunasAbertas = ref(false)

/* O resumo compara com os pacientes que já existem: o catálogo precisa estar carregado. */
onMounted(() => {
  void clinico.carregar()
})
</script>

<template>
  <UiPagina
    class="tela-importar mg-tema"
    :titulo="t('clinico.migracao.titulo')"
    :resumo="t('clinico.migracao.lede')"
    bloquear-se-suspenso
  >
    <template #voltar>
      <RouterLink to="/veterinario/pacientes">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('clinico.migracao.sobre') }}
      </RouterLink>
    </template>

    <div class="migracao">
      <div class="migracao__topo">
        <MigracaoPassos
          class="migracao__passos"
          :etapa="migracao.etapa"
          :sem-duvidas="migracao.perguntas.length === 0"
        />

        <p v-if="migracao.estado === 'parada'" class="garantia">
          <i class="ph ph-lock-simple" aria-hidden="true" />
          {{ t('clinico.migracao.arquivo.promessa') }}
        </p>
      </div>

      <!-- O arquivo aberto, nos passos depois do primeiro: de onde vem o que está na tela. -->
      <div v-if="migracao.planilha && migracao.etapa !== 'arquivo'" class="arquivo ui-folha">
        <span class="arquivo__icone" aria-hidden="true"><i class="ph ph-file-text" /></span>
        <span class="arquivo__texto">
          <strong
            ><bdi>{{ migracao.planilha.arquivo }}</bdi></strong
          >
          <span class="ui-num">
            {{
              t(
                'clinico.migracao.arquivoLido',
                {
                  linhas: formato.numero(migracao.planilha.linhas.length, 0),
                  colunas: migracao.planilha.cabecalhos.length,
                },
                migracao.planilha.linhas.length,
              )
            }}
            <template v-if="migracao.origem">
              · {{ t('clinico.migracao.origem', { nome: migracao.origem.nome }) }}
            </template>
          </span>
        </span>
        <span class="arquivo__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-table"
            :label="t('clinico.migracao.colunas.ver')"
            @click="colunasAbertas = true"
          />
          <Button
            v-if="!migracao.emAndamento"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-arrow-clockwise"
            :label="t('clinico.migracao.trocar')"
            @click="migracao.recomecar()"
          />
        </span>
      </div>

      <MigracaoPassoArquivo v-if="migracao.etapa === 'arquivo'" />
      <MigracaoPassoDuvidas v-else-if="migracao.etapa === 'duvidas'" />
      <MigracaoPassoImportar v-else @colunas="colunasAbertas = true" />
    </div>

    <template #sempre>
      <MigracaoColunas v-if="migracao.planilha" v-model:visivel="colunasAbertas" />
    </template>
  </UiPagina>
</template>

<style scoped>
.migracao {
  display: grid;
  min-width: 0;
  gap: 20px;
}

/* Os passos à esquerda, a garantia à direita; no estreito, um embaixo do outro. */
.migracao__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px 32px;
}

.migracao__passos {
  flex: 1 1 30rem;
  max-width: 44rem;
}

.garantia {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 8px 14px;
  border-radius: 999px;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 13.5px;
  font-weight: 550;
}

.garantia i {
  font-size: 17px;
}

.arquivo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 14px;
  padding: 12px 14px 12px 16px;
}

.arquivo__icone {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 20px;
}

.arquivo__texto {
  display: grid;
  flex: 1 1 16rem;
  min-width: 0;
  gap: 1px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.arquivo__texto strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arquivo__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.arquivo__acoes :deep(.p-button) {
  min-height: 36px;
}
</style>
