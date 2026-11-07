<script setup lang="ts">
/**
 * Criar ou editar um corredor (bloco) ou um tipo de acomodação (E7-01, guia e7 3): o nome é da
 * casa ("Ala A", "Suíte"), o desenho ela escolhe entre os nove. Nome único na casa ignorando caixa,
 * acento e espaços das pontas: a API diz `NOME_EM_USO`, e o aviso fica no campo.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  criarAgrupamento,
  editarAgrupamento,
  ICONES_DA_CASA,
  NOME_MAX,
  NOME_VALIDO,
  type BlocoDaCasa,
  type IconeDaCasa,
  type TipoDaCasa,
} from '@/service/parceiro/hotel-casa-service'

import { ICONE_DA_CASA, useRotulosDaCasa } from './useRotulosDaCasa'

const props = defineProps<{
  qual: 'blocos' | 'tipos'
  /** `null` cria. */
  item: BlocoDaCasa | TipoDaCasa | null
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDaCasa()
const { parceiroQuery } = useParceiroPortal()

const nome = ref('')
const icone = ref<IconeDaCasa>('CASA')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const erroNoNome = ref('')

const chave = computed(() => (props.qual === 'blocos' ? 'bloco' : 'tipo'))

watch(aberta, (agora) => {
  if (!agora) return
  nome.value = props.item?.nome ?? ''
  icone.value = props.item?.icone ?? (props.qual === 'blocos' ? 'CASA' : 'CAMA')
  tentou.value = false
  erro.value = ''
  erroNoNome.value = ''
})

const nomeValido = computed(() => {
  const limpo = nome.value.trim()
  return limpo.length > 0 && limpo.length <= NOME_MAX && NOME_VALIDO.test(limpo)
})

const opcoes = computed(() =>
  ICONES_DA_CASA.map((valor) => ({ valor, rotulo: rotulos.desenho(valor) })),
)

async function salvar() {
  tentou.value = true
  erro.value = ''
  erroNoNome.value = ''
  if (!nomeValido.value) return
  salvando.value = true
  try {
    const corpo = { nome: nome.value.trim(), icone: icone.value }
    if (props.item) await editarAgrupamento(props.qual, props.item.id, corpo, parceiroQuery())
    else await criarAgrupamento(props.qual, corpo, parceiroQuery())
    aberta.value = false
    emit('salvo')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (lido.codigo === 'NOME_EM_USO') erroNoNome.value = lido.mensagem
    else erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="item ? t(`casaDoHotel.${chave}.editar`) : t(`casaDoHotel.${chave}.novo`)"
    :icone="ICONE_DA_CASA[icone]"
  >
    <form id="agrupamento-da-casa" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__secao">
        <label class="eg__rotulo" for="ag-nome">{{ t(`casaDoHotel.${chave}.nome`) }}</label>
        <InputText
          id="ag-nome"
          v-model="nome"
          :maxlength="NOME_MAX"
          :placeholder="t(`casaDoHotel.${chave}.nomeDica`)"
          :invalid="(tentou && !nomeValido) || Boolean(erroNoNome)"
          :disabled="salvando"
        />
        <small v-if="erroNoNome" class="eg__invalido">{{ erroNoNome }}</small>
        <small v-else class="eg__dica">{{ t(`casaDoHotel.${chave}.nomeExplica`) }}</small>
      </section>

      <section class="eg__secao">
        <span id="ag-desenho" class="eg__rotulo">{{ t(`casaDoHotel.${chave}.desenho`) }}</span>
        <SelectButton
          v-model="icone"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="ag-desenho"
          :disabled="salvando"
          class="ag__desenhos"
        >
          <template #option="{ option }">
            <i :class="ICONE_DA_CASA[option.valor as IconeDaCasa]" aria-hidden="true" />
            <span class="sr-only">{{ option.rotulo }}</span>
          </template>
        </SelectButton>
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
        form="agrupamento-da-casa"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ag__desenhos {
  flex-wrap: wrap;
}

.ag__desenhos :deep(.p-togglebutton) {
  min-width: 2.75rem;
}

.ag__desenhos i {
  font-size: 18px;
}
</style>
