<script setup lang="ts">
/**
 * Mudar de leito (E5-01, guia e5 4): os leitos ativos e livres do mapa, por tipo, e o motivo
 * opcional. O leito de origem fica livre na hora. Leito incompatível (gato em leito comum, cão em
 * leito felino) pede a confirmação e reenvia; leito que outra pessoa ocupou antes recarrega a
 * lista (`LEITO_INDISPONIVEL`).
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import {
  KINDS_DO_LEITO,
  lerMapa,
  mudarDeLeito,
  type AvisoDeLeito,
  type CelulaDoMapa,
  type Internacao,
} from '@/service/parceiro/internacao-service'

const props = defineProps<{ internacao: Internacao | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ mudou: [internacao: Internacao] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const livres = ref<CelulaDoMapa[]>([])
const carregando = ref(false)
const paraLeitoId = ref<string | null>(null)
const motivo = ref('')
const avisos = ref<AvisoDeLeito[]>([])
const confirmo = ref(false)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

async function carregarLivres() {
  carregando.value = true
  try {
    const mapa = await lerMapa(parceiroQuery())
    livres.value = mapa.leitos.filter((celula) => celula.leito.ativo && !celula.internacao)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

watch(aberta, (agora) => {
  if (!agora) return
  paraLeitoId.value = null
  motivo.value = ''
  avisos.value = []
  confirmo.value = false
  tentou.value = false
  erro.value = ''
  void carregarLivres()
})

watch(paraLeitoId, () => {
  avisos.value = []
  confirmo.value = false
})

const opcoes = computed(() =>
  KINDS_DO_LEITO.flatMap((kind) =>
    livres.value
      .filter((celula) => celula.leito.kind === kind)
      .map((celula) => ({
        valor: celula.leito.id,
        rotulo: `${celula.leito.nome} · ${t(`internacao.kind.${kind}`)}`,
      })),
  ),
)

async function mudar() {
  tentou.value = true
  erro.value = ''
  if (!props.internacao || !paraLeitoId.value) return
  if (avisos.value.length && !confirmo.value) {
    erro.value = t('internacao.internar.confirmeAviso')
    return
  }
  salvando.value = true
  try {
    const mudada = await mudarDeLeito(
      props.internacao.id,
      {
        paraLeitoId: paraLeitoId.value,
        ...(motivo.value.trim() ? { motivo: motivo.value.trim() } : {}),
        ...(avisos.value.length && confirmo.value ? { confirmarAvisos: avisos.value } : {}),
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('mudou', mudada)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    if (lido.codigo === 'LEITO_INCOMPATIVEL' && Array.isArray(detalhes.avisos)) {
      avisos.value = detalhes.avisos as AvisoDeLeito[]
      return
    }
    if (lido.codigo === 'LEITO_INDISPONIVEL') {
      paraLeitoId.value = null
      void carregarLivres()
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('internacao.mudarLeito.titulo')"
    icone="ph ph-arrows-left-right"
  >
    <form id="mudar-leito" class="eg" novalidate @submit.prevent="mudar">
      <p v-if="internacao" class="eg__dica">
        {{ t('internacao.mudarLeito.dica', { leito: internacao.leito.nome }) }}
      </p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="ml-leito">{{ t('internacao.mudarLeito.para') }}</label>
        <Select
          v-model="paraLeitoId"
          input-id="ml-leito"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :loading="carregando"
          :placeholder="
            !carregando && !opcoes.length
              ? t('internacao.mudarLeito.semLivre')
              : t('internacao.mudarLeito.escolha')
          "
          :invalid="tentou && !paraLeitoId"
          :disabled="salvando || (!carregando && !opcoes.length)"
        />
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="ml-motivo">
          {{ t('internacao.mudarLeito.motivo') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <InputText id="ml-motivo" v-model="motivo" :disabled="salvando" />
      </section>
      <section v-if="avisos.length" class="eg__secao">
        <p v-for="aviso in avisos" :key="aviso" class="eg__aviso">
          <i class="ph ph-warning" aria-hidden="true" />
          <span>{{ t(`internacao.aviso.${aviso}`) }}</span>
        </p>
        <label class="ml__marcar" for="ml-aviso">
          <Checkbox v-model="confirmo" input-id="ml-aviso" binary :disabled="salvando" />
          <span>{{ t('internacao.internar.confirmoAviso') }}</span>
        </label>
      </section>
      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>
    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="mudar-leito"
        icon="ph ph-arrows-left-right"
        :label="t('internacao.mudarLeito.confirmar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ml__marcar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}
</style>
