<script setup lang="ts">
/**
 * Como o hotel recebe pedidos pela internet — a mesma ideia da clínica, com o que é de hotel: os
 * tipos que se escolhem, a antecedência que separa pedido de urgência, e o horário do balcão (o
 * prazo de resposta só anda nele).
 *
 * Numa gaveta lateral, não num diálogo no meio da tela: a caixa que a configuração muda fica à vista.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Drawer from 'primevue/drawer'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { getDataset } from '../../data/store'
import type { ReservaOnline } from '../../data/types'

const props = defineProps<{
  visivel: boolean
  configuracao: ReservaOnline | null
  salvando: boolean
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  salvar: [configuracao: ReservaOnline]
}>()

const { t } = useI18n()

/** Cópia funda e sem reatividade: o structuredClone recusa o proxy do Vue. */
function copia<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

const rascunho = ref<ReservaOnline | null>(null)

watch(
  () => [props.visivel, props.configuracao] as const,
  ([visivel, configuracao]) => {
    if (visivel && configuracao) {
      rascunho.value = copia(configuracao)
    }
  },
  { immediate: true },
)

const aberto = computed({
  get: () => props.visivel,
  set: (valor: boolean) => emit('update:visivel', valor),
})

/** Isolamento nunca: quem vai para o isolamento é decisão da casa, não escolha do cliente. */
const tipos = computed(() =>
  getDataset().tiposDeAcomodacao.filter((tipo) => tipo.id !== 'tipo-isolamento'),
)

const horas = Array.from({ length: 24 }, (_, hora) => `${String(hora).padStart(2, '0')}:00`)

const valido = computed(
  () =>
    rascunho.value !== null &&
    (!rascunho.value.ativo ||
      ((rascunho.value.permiteEscolherAcomodacao || rascunho.value.permiteHotelEscolhe) &&
        rascunho.value.tipoIds.length > 0)) &&
    rascunho.value.balcao.abre < rascunho.value.balcao.fecha &&
    rascunho.value.urgencia.telefone.trim().length > 0,
)
</script>

<template>
  <Drawer
    v-model:visible="aberto"
    position="right"
    class="config-gaveta clinic-overlay"
    :style="{ width: 'min(34rem, 96vw)' }"
    :header="t('hotel.pedidos.config.titulo')"
  >
    <div v-if="rascunho" class="config clinic-scope">
      <label class="config__chave" :class="{ 'config__chave--ligada': rascunho.ativo }">
        <span class="config__chave-icone" aria-hidden="true">
          <i class="ph" :class="rascunho.ativo ? 'ph-broadcast' : 'ph-pause'" />
        </span>
        <span class="config__texto">
          <strong>{{ t('hotel.pedidos.config.ativo') }}</strong>
          <span>{{ t('hotel.pedidos.config.ativoAjuda') }}</span>
        </span>
        <ToggleSwitch v-model="rascunho.ativo" />
      </label>

      <fieldset class="config__bloco" :disabled="!rascunho.ativo">
        <legend class="config__titulo">
          <i class="ph ph-signpost" aria-hidden="true" />
          {{ t('hotel.pedidos.config.caminhos') }}
        </legend>
        <label class="config__opcao">
          <Checkbox
            v-model="rascunho.permiteEscolherAcomodacao"
            binary
            :disabled="!rascunho.permiteHotelEscolhe && rascunho.permiteEscolherAcomodacao"
          />
          <span class="config__texto">
            <strong>{{ t('hotel.pedidos.config.escolherAcomodacao') }}</strong>
            <span>{{ t('hotel.pedidos.config.escolherAcomodacaoAjuda') }}</span>
          </span>
        </label>
        <label class="config__opcao">
          <Checkbox
            v-model="rascunho.permiteHotelEscolhe"
            binary
            :disabled="!rascunho.permiteEscolherAcomodacao && rascunho.permiteHotelEscolhe"
          />
          <span class="config__texto">
            <strong>{{ t('hotel.pedidos.config.hotelEscolhe') }}</strong>
            <span>{{ t('hotel.pedidos.config.hotelEscolheAjuda') }}</span>
          </span>
        </label>

        <div class="config__grupo">
          <span class="config__rotulo">{{ t('hotel.pedidos.config.tipos') }}</span>
          <div class="config__marcas">
            <label v-for="tipo in tipos" :key="tipo.id" class="config__marca">
              <Checkbox v-model="rascunho.tipoIds" :value="tipo.id" />
              {{ tipo.nome }}
            </label>
          </div>
        </div>

        <div class="config__numeros">
          <label class="config__numero">
            <span class="config__rotulo">{{ t('hotel.pedidos.config.prazo') }}</span>
            <InputNumber
              v-model="rascunho.prazoDeRespostaHoras"
              :min="1"
              :max="24"
              show-buttons
              suffix=" h"
              fluid
            />
          </label>
          <label class="config__numero">
            <span class="config__rotulo">{{ t('hotel.pedidos.config.antecedencia') }}</span>
            <InputNumber
              v-model="rascunho.antecedenciaMinimaHoras"
              :min="0"
              :max="96"
              show-buttons
              suffix=" h"
              fluid
            />
          </label>
          <label class="config__numero">
            <span class="config__rotulo">{{ t('hotel.pedidos.config.balcaoAbre') }}</span>
            <Select v-model="rascunho.balcao.abre" :options="horas" fluid />
          </label>
          <label class="config__numero">
            <span class="config__rotulo">{{ t('hotel.pedidos.config.balcaoFecha') }}</span>
            <Select v-model="rascunho.balcao.fecha" :options="horas" fluid />
          </label>
        </div>
      </fieldset>

      <fieldset class="config__bloco">
        <legend class="config__titulo">
          <i class="ph ph-phone" aria-hidden="true" />
          {{ t('hotel.pedidos.config.urgencia') }}
        </legend>
        <p class="config__ajuda">{{ t('hotel.pedidos.config.urgenciaAjuda') }}</p>
        <div class="config__numeros">
          <label class="config__numero">
            <span class="config__rotulo">{{ t('hotel.pedidos.config.telefone') }}</span>
            <InputText v-model="rascunho.urgencia.telefone" fluid />
          </label>
          <label class="config__numero">
            <span class="config__rotulo">{{ t('hotel.pedidos.config.whatsapp') }}</span>
            <InputText
              :model-value="rascunho.urgencia.whatsapp ?? ''"
              fluid
              @update:model-value="rascunho.urgencia.whatsapp = $event || null"
            />
          </label>
        </div>
        <label class="config__grupo">
          <span class="config__rotulo">{{ t('hotel.pedidos.config.orientacao') }}</span>
          <Textarea v-model="rascunho.urgencia.orientacao" rows="3" auto-resize fluid />
        </label>
      </fieldset>
    </div>

    <template #footer>
      <div class="config__rodape">
        <Button
          :label="t('hotel.pedidos.voltar')"
          severity="secondary"
          outlined
          @click="aberto = false"
        />
        <Button
          class="config__salvar"
          :label="t('hotel.pedidos.config.salvar')"
          icon="ph ph-check"
          :disabled="!valido"
          :loading="salvando"
          @click="rascunho && emit('salvar', copia(rascunho))"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.config__rodape {
  display: flex;
  gap: 8px;
}

.config__salvar.p-button {
  flex: 1;
}

.config {
  display: grid;
  gap: 18px;
  color: var(--tinta);
}

/* A chave-mestra: o único bloco tingido, porque é a única coisa que muda tudo. */
.config__chave {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie-2);
  cursor: pointer;
}

.config__chave--ligada {
  border-color: color-mix(in oklab, var(--hotel) 40%, transparent);
  background: var(--hotel-fundo);
}

.config__chave-icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie);
  color: var(--hotel-tinta);
  font-size: 19px;
}

.config__chave .config__texto {
  flex: 1;
}

.config__texto {
  display: grid;
  gap: 2px;
}

.config__texto strong {
  font-size: 14.5px;
  font-weight: 600;
}

.config__texto span,
.config__ajuda {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.config__ajuda {
  margin: 0;
}

.config__bloco {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 16px;
  border: 1px solid var(--linha);
  border-radius: 16px;
}

.config__bloco:disabled {
  opacity: 0.55;
}

.config__titulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 6px;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.config__titulo i {
  color: var(--hotel-tinta);
  font-size: 17px;
}

.config__opcao {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.config__grupo {
  display: grid;
  gap: 8px;
}

.config__rotulo {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.config__marcas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.config__marca {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--linha);
  border-radius: 10px;
  cursor: pointer;
  font-size: 14px;
}

.config__marca:has(:checked) {
  border-color: color-mix(in oklab, var(--hotel) 45%, transparent);
  background: var(--hotel-fundo);
}

.config__numeros {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
}

.config__numero {
  display: grid;
  gap: 6px;
}
</style>
