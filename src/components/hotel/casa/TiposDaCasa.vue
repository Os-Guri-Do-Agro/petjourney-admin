<script setup lang="ts">
/**
 * Os tipos de acomodação (E7-01, guia e7 3): como a casa chama cada tipo de vaga e o desenho dele,
 * na ordem do mapa. Apagar só o que nenhuma acomodação usa (o último também pode sair).
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  apagarAgrupamento,
  moverAgrupamento,
  type CasaDoHotel,
  type TipoDaCasa,
} from '@/service/parceiro/hotel-casa-service'

import AgrupamentoGaveta from './AgrupamentoGaveta.vue'
import './casa.css'
import { ICONE_DA_CASA } from './useRotulosDaCasa'

const props = defineProps<{ casa: CasaDoHotel; podeEditar: boolean }>()
const emit = defineEmits<{ mudou: [] }>()

const { t } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()

const erro = ref('')
const mexendo = ref<string | null>(null)

async function fazer(id: string, acao: () => Promise<unknown>, apagado?: string) {
  erro.value = ''
  mexendo.value = id
  try {
    await acao()
    if (apagado)
      toast.add({
        severity: 'success',
        summary: t('casaDoHotel.apagado', { nome: apagado }),
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
const emEdicao = ref<TipoDaCasa | null>(null)

function abrir(tipo: TipoDaCasa | null) {
  emEdicao.value = tipo
  aberta.value = true
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="tipos-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-shapes" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="tipos-titulo" class="ui-cartao__titulo">{{ t('casaDoHotel.tipo.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ t('casaDoHotel.tipo.descricao') }}</p>
      </span>
      <Button
        v-if="podeEditar"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('casaDoHotel.tipo.novo')"
        :disabled="props.casa.tipos.length >= props.casa.limites.tipos"
        @click="abrir(null)"
      />
    </header>

    <p v-if="erro" class="ca__erro" role="alert">{{ erro }}</p>
    <p v-if="props.casa.tipos.length >= props.casa.limites.tipos" class="ca__nota">
      {{ t('casaDoHotel.tipo.noLimite', { limite: props.casa.limites.tipos }) }}
    </p>
    <p v-if="!props.casa.tipos.length" class="ca__nota">{{ t('casaDoHotel.tipo.vazio') }}</p>

    <ul v-else class="ui-lista">
      <li v-for="(tipo, indice) in props.casa.tipos" :key="tipo.id" class="ui-linha">
        <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
          <i :class="ICONE_DA_CASA[tipo.icone]" />
        </span>
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo">{{ tipo.nome }}</strong>
          <span class="ui-linha__meta">{{
            t(
              'casaDoHotel.tipo.usos',
              { total: tipo.quantidadeDeAcomodacoes },
              tipo.quantidadeDeAcomodacoes,
            )
          }}</span>
        </span>
        <span v-if="podeEditar" class="ui-linha__fim ca__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-arrow-up"
            :aria-label="t('casaDoHotel.planta.subir', { nome: tipo.nome })"
            :disabled="indice === 0 || mexendo !== null"
            @click="
              fazer(tipo.id, () => moverAgrupamento('tipos', tipo.id, 'SOBE', parceiroQuery()))
            "
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-arrow-down"
            :aria-label="t('casaDoHotel.planta.descer', { nome: tipo.nome })"
            :disabled="indice === props.casa.tipos.length - 1 || mexendo !== null"
            @click="
              fazer(tipo.id, () => moverAgrupamento('tipos', tipo.id, 'DESCE', parceiroQuery()))
            "
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-pencil-simple"
            :aria-label="t('casaDoHotel.planta.editarDe', { nome: tipo.nome })"
            @click="abrir(tipo)"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-trash"
            :aria-label="t('casaDoHotel.planta.apagarDe', { nome: tipo.nome })"
            :title="
              tipo.quantidadeDeAcomodacoes
                ? t(
                    'casaDoHotel.tipo.emUso',
                    { total: tipo.quantidadeDeAcomodacoes },
                    tipo.quantidadeDeAcomodacoes,
                  )
                : undefined
            "
            :disabled="tipo.quantidadeDeAcomodacoes > 0 || mexendo !== null"
            :loading="mexendo === tipo.id"
            @click="
              fazer(tipo.id, () => apagarAgrupamento('tipos', tipo.id, parceiroQuery()), tipo.nome)
            "
          />
        </span>
      </li>
    </ul>

    <AgrupamentoGaveta
      v-model:visible="aberta"
      qual="tipos"
      :item="emEdicao"
      @salvo="emit('mudou')"
    />
  </section>
</template>
