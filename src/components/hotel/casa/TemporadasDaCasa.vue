<script setup lang="ts">
/**
 * As temporadas (E7-01, guia e7 7): faixas sem ano, com a régua do ano em cada linha (quando cai,
 * quanto dura, se encosta na outra). A que divide dias com outra (`sobrepoe`) avisa que nesses dias
 * vale a de maior acréscimo, sem somar. Só com `hotel.valores` (sem ela a chave nem vem).
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import FaixaDoAno from '@/features/hotel/components/acomodacoes/FaixaDoAno.vue'
import {
  apagarTemporada,
  type CasaDoHotel,
  type TemporadaDaCasa,
} from '@/service/parceiro/hotel-casa-service'

import TemporadaGaveta from './TemporadaGaveta.vue'
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

function meta(tp: TemporadaDaCasa) {
  return [
    t('casaDoHotel.temporada.intervalo', {
      de: rotulos.mesDia(tp.inicioMesDia),
      ate: rotulos.mesDia(tp.fimMesDia),
    }),
    t('casaDoHotel.temporada.mais', { p: tp.acrescimoPercentual }),
  ].join(' · ')
}

function sobreposicao(tp: TemporadaDaCasa) {
  if (!tp.sobrepoe.length) return ''
  const nomes = tp.sobrepoe
    .map((id) => props.casa.temporadas?.find((outra) => outra.id === id)?.nome)
    .filter(Boolean)
    .join(', ')
  return nomes ? t('casaDoHotel.temporada.sobrepoe', { nomes }) : ''
}

async function apagar(tp: TemporadaDaCasa) {
  erro.value = ''
  mexendo.value = tp.id
  try {
    await apagarTemporada(tp.id, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('casaDoHotel.apagado', { nome: tp.nome }),
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
const emEdicao = ref<TemporadaDaCasa | null>(null)

function abrir(tp: TemporadaDaCasa | null) {
  emEdicao.value = tp
  aberta.value = true
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="temporadas-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-sun-horizon" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="temporadas-titulo" class="ui-cartao__titulo">
          {{ t('casaDoHotel.temporada.titulo') }}
        </h2>
        <p class="ui-cartao__descricao">{{ t('casaDoHotel.temporada.descricao') }}</p>
      </span>
      <Button
        v-if="podeEditar"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('casaDoHotel.temporada.nova')"
        :disabled="(props.casa.temporadas?.length ?? 0) >= props.casa.limites.temporadas"
        @click="abrir(null)"
      />
    </header>

    <p v-if="erro" class="ca__erro" role="alert">{{ erro }}</p>
    <p
      v-if="(props.casa.temporadas?.length ?? 0) >= props.casa.limites.temporadas"
      class="ca__nota"
    >
      {{ t('casaDoHotel.temporada.noLimite', { limite: props.casa.limites.temporadas }) }}
    </p>
    <p v-if="!props.casa.temporadas?.length" class="ca__nota">
      {{ t('casaDoHotel.temporada.vazio') }}
    </p>

    <ul v-else class="ui-lista">
      <li v-for="tp in props.casa.temporadas" :key="tp.id" class="ui-linha">
        <span class="ui-linha__texto tps__texto">
          <strong class="ui-linha__titulo">{{ tp.nome }}</strong>
          <span class="ui-linha__meta">{{ meta(tp) }}</span>
          <FaixaDoAno :inicio="tp.inicioMesDia" :fim="tp.fimMesDia" class="tps__regua" />
          <span v-if="sobreposicao(tp)" class="ui-linha__meta tps__aviso">
            <i class="ph ph-info" aria-hidden="true" />
            {{ sobreposicao(tp) }}
          </span>
        </span>
        <span v-if="podeEditar" class="ui-linha__fim ca__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-pencil-simple"
            :aria-label="t('casaDoHotel.planta.editarDe', { nome: tp.nome })"
            @click="abrir(tp)"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-trash"
            :aria-label="t('casaDoHotel.planta.apagarDe', { nome: tp.nome })"
            :disabled="mexendo !== null"
            :loading="mexendo === tp.id"
            @click="apagar(tp)"
          />
        </span>
      </li>
    </ul>

    <TemporadaGaveta v-model:visible="aberta" :temporada="emEdicao" @salvo="emit('mudou')" />
  </section>
</template>

<style scoped>
.tps__texto {
  min-width: 0;
}

.tps__regua {
  max-width: 28rem;
  margin-block: 6px 2px;
}

.tps__aviso i {
  margin-inline-end: 4px;
  vertical-align: -2px;
}
</style>
