<script setup lang="ts">
/**
 * A evolução do plantão (E5-02c, guia e5 15.4 e 16.4): os vitais, o que se observou, a avaliação,
 * o plano (internos) e a gravidade, que muda a da internação na mesma operação.
 *
 * Uma por plantão: a segunda reescreve, e a anterior fica no histórico. A tela velha não estraga:
 * vai a gravidade que a tela mostrava (`gravidadeVista`) e, ao reescrever, a versão lida
 * (`atualizadoEmVisto`). Outra pessoa mudou antes: a API recusa e a gaveta pede para reabrir.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { GRAVIDADES, type Gravidade } from '@/service/parceiro/internacao-service'
import {
  salvarEvolucao,
  TEXTO_DA_EVOLUCAO_MAX,
  type Evolucao,
  type EvolucaoSalva,
  type NovaEvolucao,
} from '@/service/parceiro/plantao-da-internacao-service'

const props = defineProps<{
  internacaoId: string
  gravidadeAtual: Gravidade
  /** A evolução deste plantão a reescrever; `null` escreve a do plantão aberto. */
  editando: Evolucao | null
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salva: [evolucao: EvolucaoSalva]; desatualizada: [] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()

type Vital = 'temperatura' | 'frequenciaCardiaca' | 'frequenciaRespiratoria'
const VITAIS: { chave: Vital; casas: number; sufixo: string; min: number; max: number }[] = [
  { chave: 'temperatura', casas: 1, sufixo: ' °C', min: 20, max: 50 },
  { chave: 'frequenciaCardiaca', casas: 0, sufixo: ' bpm', min: 5, max: 600 },
  { chave: 'frequenciaRespiratoria', casas: 0, sufixo: ' mpm', min: 1, max: 300 },
]

const valores = ref<Record<Vital, number | null>>({
  temperatura: null,
  frequenciaCardiaca: null,
  frequenciaRespiratoria: null,
})
const naoAferido = ref<Record<Vital, boolean>>({
  temperatura: false,
  frequenciaCardiaca: false,
  frequenciaRespiratoria: false,
})
const observado = ref('')
const avaliacao = ref('')
const plano = ref('')
const gravidade = ref<Gravidade>('ESTAVEL')
/** A gravidade que a tela mostrava ao abrir: vai na gravação (16.4). */
const gravidadeVista = ref<Gravidade>('ESTAVEL')
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  const base = props.editando
  for (const vital of VITAIS) {
    const medida = base?.vitais?.[vital.chave]
    valores.value[vital.chave] = medida?.valor ?? null
    naoAferido.value[vital.chave] = Boolean(medida?.naoAferido)
  }
  observado.value = base?.observado ?? ''
  avaliacao.value = base?.avaliacao ?? ''
  plano.value = base?.plano ?? ''
  gravidade.value = props.gravidadeAtual
  gravidadeVista.value = props.gravidadeAtual
  erro.value = ''
})

const opcoesDeGravidade = computed(() =>
  GRAVIDADES.map((valor) => ({ valor, rotulo: t(`internacao.gravidade.${valor}`) })),
)

function corpo(): NovaEvolucao {
  const vitais: NovaEvolucao['vitais'] = {}
  for (const vital of VITAIS) {
    const valor = valores.value[vital.chave]
    if (naoAferido.value[vital.chave]) vitais[vital.chave] = { valor: null, naoAferido: true }
    else if (valor !== null) vitais[vital.chave] = { valor, naoAferido: false }
  }
  return {
    vitais,
    ...(observado.value.trim() ? { observado: observado.value.trim() } : {}),
    ...(avaliacao.value.trim() ? { avaliacao: avaliacao.value.trim() } : {}),
    ...(plano.value.trim() ? { plano: plano.value.trim() } : {}),
    gravidade: gravidade.value,
    gravidadeVista: gravidadeVista.value,
    ...(props.editando
      ? { evolucaoId: props.editando.id, atualizadoEmVisto: props.editando.atualizadoEm }
      : {}),
  }
}

async function salvar() {
  erro.value = ''
  salvando.value = true
  try {
    const salva = await salvarEvolucao(props.internacaoId, corpo(), parceiroQuery())
    aberta.value = false
    emit('salva', salva)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('internacao.evolucao.erro'))
    erro.value = lido.mensagem
    if (
      lido.codigo === 'EVOLUCAO_ALTERADA' ||
      lido.codigo === 'INTERNACAO_ALTERADA' ||
      lido.codigo === 'EVOLUCAO_CONGELADA'
    ) {
      erro.value = t('internacao.evolucao.desatualizada')
      emit('desatualizada')
    }
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="editando ? t('internacao.evolucao.reescrever') : t('internacao.evolucao.nova')"
    icone="ph ph-notepad"
    largura="36rem"
  >
    <form id="evolucao-form" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">{{ t('internacao.evolucao.dica') }}</p>

      <section class="eg__secao">
        <span id="ev-gravidade" class="eg__rotulo">{{ t('internacao.gravidadeRotulo') }}</span>
        <SelectButton
          v-model="gravidade"
          :options="opcoesDeGravidade"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="ev-gravidade"
          :disabled="salvando"
        />
        <small v-if="gravidade !== gravidadeVista" class="eg__dica">{{
          t('internacao.evolucao.mudaGravidade')
        }}</small>
      </section>

      <div class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('internacao.evolucao.vitais') }}</h3>
        <section v-for="vital in VITAIS" :key="vital.chave" class="eg__secao ev__vital">
          <label class="eg__rotulo" :for="`ev-${vital.chave}`">{{
            t(`internacao.evolucao.vital.${vital.chave}`)
          }}</label>
          <div class="ev__linha">
            <InputNumber
              :model-value="valores[vital.chave]"
              :input-id="`ev-${vital.chave}`"
              :min="vital.min"
              :max="vital.max"
              :max-fraction-digits="vital.casas"
              :suffix="vital.sufixo"
              :locale="locale"
              :disabled="salvando || naoAferido[vital.chave]"
              @update:model-value="(valor: number | null) => (valores[vital.chave] = valor)"
            />
            <label class="ev__marcar" :for="`ev-na-${vital.chave}`">
              <Checkbox
                v-model="naoAferido[vital.chave]"
                :input-id="`ev-na-${vital.chave}`"
                binary
                :disabled="salvando"
              />
              <span>{{ t('internacao.evolucao.naoAferido') }}</span>
            </label>
          </div>
        </section>
      </div>

      <section class="eg__secao">
        <label class="eg__rotulo" for="ev-observado">
          {{ t('internacao.evolucao.observado') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="ev-observado"
          v-model="observado"
          rows="2"
          auto-resize
          :maxlength="TEXTO_DA_EVOLUCAO_MAX"
          :disabled="salvando"
        />
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="ev-avaliacao">
          {{ t('internacao.evolucao.avaliacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="ev-avaliacao"
          v-model="avaliacao"
          rows="2"
          auto-resize
          :maxlength="TEXTO_DA_EVOLUCAO_MAX"
          :disabled="salvando"
        />
      </section>
      <section class="eg__secao">
        <label class="eg__rotulo" for="ev-plano">
          {{ t('internacao.evolucao.plano') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="ev-plano"
          v-model="plano"
          rows="2"
          auto-resize
          :maxlength="TEXTO_DA_EVOLUCAO_MAX"
          :disabled="salvando"
        />
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
        form="evolucao-form"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ev__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.ev__linha :deep(.p-inputnumber) {
  max-width: 12rem;
}

.ev__marcar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13.5px;
  cursor: pointer;
}
</style>
