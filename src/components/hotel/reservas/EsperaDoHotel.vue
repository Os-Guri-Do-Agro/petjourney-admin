<script setup lang="ts">
/**
 * A lista de espera do hotel (E7-02b, guia e7 32): as vivas por entrada desejada. Ofertar avisa
 * que abriu vaga, mas não segura a baia (a oferta vencida aparece como "Expirada"); reservar cria a
 * reserva com `esperaId` e a espera vira "Convertida" junto; desistir tira da lista.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { TipoDaCasa } from '@/service/parceiro/hotel-casa-service'
import {
  desistirDaEspera,
  listarEspera,
  OFERTA_HORAS_PADRAO,
  ofertarEspera,
  type Espera,
} from '@/service/parceiro/hotel-reservas-service'

import EsperaGaveta from './EsperaGaveta.vue'
import { useRotulosDasReservas } from './useRotulosDasReservas'
import '@/components/hotel/casa/casa.css'

const props = defineProps<{ tipos: TipoDaCasa[]; podeReservar: boolean }>()
const emit = defineEmits<{ reservar: [espera: Espera] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

const itens = ref<Espera[]>([])
const truncado = ref(false)
const carregando = ref(false)
const erro = ref('')
const mexendo = ref<string | null>(null)

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const lista = await listarEspera(null, parceiroQuery())
    itens.value = lista.itens
    truncado.value = lista.truncado
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('reservasDoHotel.espera.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())

const nomeDoTipo = computed(() => new Map(props.tipos.map((tp) => [tp.id, tp.nome])))

function meta(e: Espera) {
  return [
    t('reservasDoHotel.periodo', {
      de: rotulos.dia(e.entradaDesejada),
      ate: rotulos.dia(e.saidaDesejada),
    }),
    rotulos.especie(e.especie),
    e.tiposAceitos.length
      ? e.tiposAceitos
          .map((id) => nomeDoTipo.value.get(id) ?? '')
          .filter(Boolean)
          .join(', ')
      : t('reservasDoHotel.espera.qualquerTipo'),
    e.status === 'OFERTADA' && e.ofertaExpiraEm
      ? t('reservasDoHotel.espera.expiraEm', { quando: rotulos.quando(e.ofertaExpiraEm) })
      : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

async function fazer(e: Espera, acao: () => Promise<unknown>) {
  erro.value = ''
  mexendo.value = e.id
  try {
    await acao()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    mexendo.value = null
    void carregar()
  }
}

const vivas = (e: Espera) => ['AGUARDANDO', 'OFERTADA', 'EXPIRADA'].includes(e.status)
const novaAberta = ref(false)

defineExpose({ carregar })
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="espera-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-hourglass" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="espera-titulo" class="ui-cartao__titulo">
          {{ t('reservasDoHotel.espera.titulo') }}
        </h2>
        <p class="ui-cartao__descricao">{{ t('reservasDoHotel.espera.descricao') }}</p>
      </span>
      <Button
        v-if="podeReservar"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('reservasDoHotel.espera.nova')"
        @click="novaAberta = true"
      />
    </header>

    <p v-if="erro" class="ca__erro" role="alert">{{ erro }}</p>
    <p v-if="truncado" class="ca__nota">{{ t('reservasDoHotel.espera.truncado') }}</p>
    <p v-if="!itens.length && !carregando" class="ca__nota">
      {{ t('reservasDoHotel.espera.vazio') }}
    </p>

    <ul v-else class="ui-lista">
      <li v-for="e in itens" :key="e.id" class="ui-linha">
        <span class="ui-linha__texto">
          <span class="ca__nome">
            <strong class="ui-linha__titulo">{{ e.pacienteNome }}</strong>
            <span
              class="ui-selo"
              :class="{
                'ui-selo--atencao': e.status === 'OFERTADA',
                'ui-selo--contorno': e.status === 'EXPIRADA',
              }"
              >{{ rotulos.espera(e.status) }}</span
            >
          </span>
          <span class="ui-linha__meta">{{ meta(e) }}</span>
          <span v-if="e.observacao" class="ui-linha__meta">{{ e.observacao }}</span>
        </span>
        <span v-if="podeReservar && vivas(e)" class="ui-linha__fim ca__acoes">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('reservasDoHotel.espera.reservar')"
            @click="emit('reservar', e)"
          />
          <Button
            v-if="e.status !== 'OFERTADA'"
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('reservasDoHotel.espera.ofertar')"
            :loading="mexendo === e.id"
            :disabled="mexendo !== null"
            @click="fazer(e, () => ofertarEspera(e.id, OFERTA_HORAS_PADRAO, parceiroQuery()))"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-x"
            :aria-label="t('reservasDoHotel.espera.desistir', { nome: e.pacienteNome })"
            :disabled="mexendo !== null"
            @click="fazer(e, () => desistirDaEspera(e.id, parceiroQuery()))"
          />
        </span>
      </li>
    </ul>

    <EsperaGaveta v-model:visible="novaAberta" :tipos="tipos" @criada="carregar" />
  </section>
</template>
