<script setup lang="ts">
/**
 * Os serviços da casa (E7-01, guia e7 8): o que ela vende além da diária. Serviço não se apaga
 * (não há `DELETE`): sai de venda (`ativo: false`) e volta. Quem não vê dinheiro vê quais serviços
 * existem e se são por diária, sem o preço (o campo não vem).
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  editarServico,
  KINDS_DE_SERVICO,
  type CasaDoHotel,
  type ServicoDaCasa,
} from '@/service/parceiro/hotel-casa-service'

import ServicoGaveta from './ServicoGaveta.vue'
import { useRotulosDaCasa } from './useRotulosDaCasa'
import './casa.css'

const props = defineProps<{ casa: CasaDoHotel; podeEditar: boolean }>()
const emit = defineEmits<{ mudou: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDaCasa()
const { parceiroQuery } = useParceiroPortal()

const erro = ref('')
const mexendo = ref<string | null>(null)

const existentes = computed(() => props.casa.servicos.map((s) => s.kind))
const faltam = computed(() => KINDS_DE_SERVICO.some((k) => !existentes.value.includes(k)))

function meta(s: ServicoDaCasa) {
  return [
    typeof s.precoCentavos === 'number' ? rotulos.dinheiro(s.precoCentavos) : '',
    s.porDiaria ? t('casaDoHotel.servico.porDiaria') : t('casaDoHotel.servico.porEstadia'),
  ]
    .filter(Boolean)
    .join(' · ')
}

async function alternar(s: ServicoDaCasa) {
  erro.value = ''
  mexendo.value = s.id
  try {
    await editarServico(s.id, { ativo: !s.ativo }, parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    mexendo.value = null
    emit('mudou')
  }
}

const aberta = ref(false)
const emEdicao = ref<ServicoDaCasa | null>(null)

function abrir(s: ServicoDaCasa | null) {
  emEdicao.value = s
  aberta.value = true
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="servicos-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-sparkle" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="servicos-titulo" class="ui-cartao__titulo">
          {{ t('casaDoHotel.servico.titulo') }}
        </h2>
        <p class="ui-cartao__descricao">{{ t('casaDoHotel.servico.descricao') }}</p>
      </span>
      <Button
        v-if="podeEditar && faltam"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('casaDoHotel.servico.novo')"
        @click="abrir(null)"
      />
    </header>

    <p v-if="erro" class="ca__erro" role="alert">{{ erro }}</p>
    <p v-if="!props.casa.servicos.length" class="ca__nota">{{ t('casaDoHotel.servico.vazio') }}</p>

    <ul v-else class="ui-lista">
      <li v-for="s in props.casa.servicos" :key="s.id" class="ui-linha">
        <span class="ui-linha__texto">
          <span class="ca__nome">
            <strong class="ui-linha__titulo">{{ rotulos.servico(s.kind) }}</strong>
            <span v-if="!s.ativo" class="ui-selo ui-selo--contorno">{{
              t('casaDoHotel.servico.foraDeVenda')
            }}</span>
          </span>
          <span class="ui-linha__meta">{{ meta(s) }}</span>
        </span>
        <span v-if="podeEditar" class="ui-linha__fim ca__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-pencil-simple"
            :aria-label="t('casaDoHotel.planta.editarDe', { nome: rotulos.servico(s.kind) })"
            @click="abrir(s)"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="
              s.ativo
                ? t('casaDoHotel.servico.tirarDeVenda')
                : t('casaDoHotel.servico.voltarAVender')
            "
            :loading="mexendo === s.id"
            :disabled="mexendo !== null"
            @click="alternar(s)"
          />
        </span>
      </li>
    </ul>

    <ServicoGaveta
      v-model:visible="aberta"
      :servico="emEdicao"
      :existentes="existentes"
      @salvo="emit('mudou')"
    />
  </section>
</template>
