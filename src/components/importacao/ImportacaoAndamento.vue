<script setup lang="ts">
/**
 * A gravação (e o desfazer) é um job no servidor, em lotes de 80 (guia e2, 4.4 e 4.6): segue com a
 * aba fechada e pode ser acompanhada de outro aparelho. Enquanto anda, a tela relê o status a cada
 * 1,5 s; ao sair dela, para de perguntar. Pausar deixa o lote no ar terminar; continuar retoma do
 * mesmo lote (ou do mesmo ponto do desfazer, se foi ele que parou).
 */
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import { useToast } from 'primevue/usetoast'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { erroDoDesfazer } from '@/components/importacao/leitura-da-importacao'
import {
  INTERVALO_DO_ACOMPANHAMENTO_MS,
  STATUS_EM_ANDAMENTO,
} from '@/service/parceiro/importacao-service'
import { useImportacaoStore } from '@/stores/importacao-da-base'

const { t } = useI18n()
const toast = useToast()
const store = useImportacaoStore()
const rotulos = useRotulosDoCadastro()

const ocupado = ref(false)

const importacao = computed(() => store.importacao)
const status = computed(() => importacao.value?.status)
const andando = computed(() => Boolean(status.value && STATUS_EM_ANDAMENTO.includes(status.value)))

/* ----------------------------------------------------------------------- acompanhar */

let relogio: ReturnType<typeof setTimeout> | null = null
let vivo = true

async function tique() {
  relogio = null
  if (!vivo) return

  try {
    await store.atualizar()
  } catch {
    /* Uma leitura que falha não para o acompanhamento: a próxima tenta de novo. */
  }

  agendar()
}

function agendar() {
  if (vivo && relogio === null && andando.value) {
    relogio = setTimeout(tique, INTERVALO_DO_ACOMPANHAMENTO_MS)
  }
}

watch(andando, () => agendar(), { immediate: true })

onBeforeUnmount(() => {
  vivo = false
  if (relogio !== null) clearTimeout(relogio)
})

/* ------------------------------------------------------------------------- a tela */

const percentual = computed(() => {
  const atual = importacao.value
  if (!atual?.aGravar) return 0
  return Math.min(100, Math.round((atual.processadas / atual.aGravar) * 100))
})

const desfazendo = computed(
  () => status.value === 'DESFAZENDO' || erroDoDesfazer(importacao.value?.ultimoErro),
)

const titulo = computed(() => {
  switch (status.value) {
    case 'PROCESSANDO':
      return t('clinico.migracao.importacao.titulo.rodando')
    case 'PAUSADA':
      return t('clinico.migracao.importacao.titulo.pausada')
    case 'DESFAZENDO':
      return t('importacao.andamento.desfazendo')
    default:
      return desfazendo.value
        ? t('importacao.andamento.desfazerParou')
        : t('importacao.andamento.parou')
  }
})

const texto = computed(() => {
  switch (status.value) {
    case 'PROCESSANDO':
    case 'DESFAZENDO':
      return t('clinico.migracao.importacao.podeSair')
    case 'PAUSADA':
      return t('clinico.migracao.importacao.continuaDoPonto')
    default:
      return desfazendo.value
        ? t('importacao.andamento.desfazerParouTexto')
        : t('importacao.andamento.parouTexto')
  }
})

async function agir(acao: () => Promise<void>) {
  ocupado.value = true

  try {
    await acao()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    ocupado.value = false
  }
}
</script>

<template>
  <section v-if="importacao" class="ui-folha ui-cartao and" aria-labelledby="and-titulo">
    <header class="ui-cartao__cabeca">
      <span
        class="ui-ladrilho"
        :class="{ 'ui-ladrilho--atencao': status === 'FALHOU' }"
        aria-hidden="true"
      >
        <i
          :class="
            andando
              ? 'ph ph-spin ph-circle-notch'
              : status === 'FALHOU'
                ? 'ph ph-warning'
                : 'ph ph-pause'
          "
        />
      </span>
      <span class="ui-cartao__titulos">
        <h2 id="and-titulo" class="ui-cartao__titulo">{{ titulo }}</h2>
        <p class="ui-cartao__descricao">{{ texto }}</p>
      </span>
    </header>

    <div class="and__corpo" role="status" aria-live="polite">
      <template v-if="!desfazendo">
        <span class="ui-num and__feitas">
          {{
            t('clinico.migracao.importacao.feitas', {
              feitas: rotulos.numero(importacao.processadas),
              total: rotulos.numero(importacao.aGravar),
            })
          }}
        </span>
        <ProgressBar
          :value="percentual"
          :show-value="false"
          :aria-label="t('clinico.migracao.importacao.progressoAria')"
        />
      </template>

      <template v-else>
        <ProgressBar
          v-if="status === 'DESFAZENDO'"
          mode="indeterminate"
          :aria-label="t('importacao.andamento.desfazendo')"
        />
        <span v-if="importacao.desfazer" class="ui-num and__feitas">
          {{
            t('importacao.andamento.desfazerContagem', {
              pacientes: rotulos.numero(importacao.desfazer.pacientesRemovidos),
              clientes: rotulos.numero(importacao.desfazer.clientesRemovidos),
              ficaram: rotulos.numero(importacao.desfazer.ficaram),
            })
          }}
        </span>
      </template>

      <p v-if="status === 'FALHOU' && importacao.ultimoErro" class="eg__dica">
        {{ t('importacao.andamento.codigo', { codigo: importacao.ultimoErro }) }}
      </p>
    </div>

    <footer class="ui-cartao__pe and__pe">
      <Button
        v-if="status === 'PROCESSANDO'"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-pause"
        :label="t('clinico.migracao.importacao.pausar')"
        :loading="ocupado"
        @click="agir(store.pausar)"
      />
      <Button
        v-if="status === 'PAUSADA' || status === 'FALHOU'"
        type="button"
        icon="ph ph-play"
        :label="t('clinico.migracao.importacao.continuar')"
        :loading="ocupado"
        @click="agir(store.continuar)"
      />
    </footer>
  </section>
</template>

<style scoped>
.and {
  display: grid;
  gap: 16px;
}

.and__corpo {
  display: grid;
  gap: 8px;
}

.and__feitas {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.and__corpo :deep(.p-progressbar) {
  height: 8px;
}

.and__pe {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.and__pe:empty {
  display: none;
}
</style>
