<script setup lang="ts">
/**
 * As tabelas de preço (E7-01, guia e7 4): a diária por porte e o segundo animal, com quantas
 * acomodações usam cada uma. Só quem vê dinheiro (`hotel.valores`) chega aqui. Apagar só a que
 * nenhuma acomodação usa (`TARIFA_EM_USO`).
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  apagarTarifa,
  PORTES,
  type CasaDoHotel,
  type TarifaDaCasa,
} from '@/service/parceiro/hotel-casa-service'

import TarifaGaveta from './TarifaGaveta.vue'
import { useRotulosDaCasa } from './useRotulosDaCasa'
import './casa.css'

const props = defineProps<{ casa: CasaDoHotel; podeEditar: boolean }>()
const emit = defineEmits<{ mudou: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDaCasa()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()

const erro = ref('')
const mexendo = ref<string | null>(null)

function precos(tarifa: TarifaDaCasa) {
  return [
    ...PORTES.map(
      (porte) => `${rotulos.porte(porte)} ${rotulos.dinheiro(tarifa.diariaPorPorte[porte])}`,
    ),
    t('casaDoHotel.tarifa.segundo', { p: tarifa.acompanhantePercentual }),
  ].join(' · ')
}

async function apagar(tarifa: TarifaDaCasa) {
  erro.value = ''
  mexendo.value = tarifa.id
  try {
    await apagarTarifa(tarifa.id, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('casaDoHotel.apagado', { nome: tarifa.nome }),
      life: 3000,
    })
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    mexendo.value = null
    emit('mudou')
  }
}

const aberta = ref(false)
const emEdicao = ref<TarifaDaCasa | null>(null)

function abrir(tarifa: TarifaDaCasa | null) {
  emEdicao.value = tarifa
  aberta.value = true
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="tarifas-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-currency-circle-dollar" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="tarifas-titulo" class="ui-cartao__titulo">{{ t('casaDoHotel.tarifa.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ t('casaDoHotel.tarifa.descricao') }}</p>
      </span>
      <Button
        v-if="podeEditar"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('casaDoHotel.tarifa.nova')"
        :disabled="(props.casa.tarifas?.length ?? 0) >= props.casa.limites.tarifas"
        @click="abrir(null)"
      />
    </header>

    <p v-if="erro" class="ca__erro" role="alert">{{ erro }}</p>
    <p v-if="(props.casa.tarifas?.length ?? 0) >= props.casa.limites.tarifas" class="ca__nota">
      {{ t('casaDoHotel.tarifa.noLimite', { limite: props.casa.limites.tarifas }) }}
    </p>
    <p v-if="!props.casa.tarifas?.length" class="ca__nota">{{ t('casaDoHotel.tarifa.vazio') }}</p>

    <ul v-else class="ui-lista">
      <li v-for="tarifa in props.casa.tarifas" :key="tarifa.id" class="ui-linha">
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo">{{ tarifa.nome }}</strong>
          <span class="ui-linha__meta">{{ precos(tarifa) }}</span>
          <span class="ui-linha__meta">{{
            t(
              'casaDoHotel.tarifa.usos',
              { total: tarifa.quantidadeDeAcomodacoes },
              tarifa.quantidadeDeAcomodacoes,
            )
          }}</span>
        </span>
        <span v-if="podeEditar" class="ui-linha__fim ca__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-pencil-simple"
            :aria-label="t('casaDoHotel.planta.editarDe', { nome: tarifa.nome })"
            @click="abrir(tarifa)"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-trash"
            :aria-label="t('casaDoHotel.planta.apagarDe', { nome: tarifa.nome })"
            :title="
              tarifa.quantidadeDeAcomodacoes
                ? t(
                    'casaDoHotel.tarifa.emUso',
                    { total: tarifa.quantidadeDeAcomodacoes },
                    tarifa.quantidadeDeAcomodacoes,
                  )
                : undefined
            "
            :disabled="tarifa.quantidadeDeAcomodacoes > 0 || mexendo !== null"
            :loading="mexendo === tarifa.id"
            @click="apagar(tarifa)"
          />
        </span>
      </li>
    </ul>

    <TarifaGaveta v-model:visible="aberta" :tarifa="emEdicao" @salvo="emit('mudou')" />
  </section>
</template>
