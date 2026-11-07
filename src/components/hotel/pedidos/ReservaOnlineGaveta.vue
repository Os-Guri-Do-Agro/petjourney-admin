<script setup lang="ts">
/**
 * Como o hotel recebe pedidos pela internet (E7-03, guia e7 22): ligar e desligar, os caminhos (o
 * responsável escolhe o tipo, o hotel escolhe, o link do hotel), os tipos oferecidos, a
 * antecedência, até quando à frente, o prazo de resposta (contado só com o balcão aberto) e a
 * mensagem de urgência. A configuração nasce desligada; ligar exige a página publicada, um caminho
 * e um tipo com acomodação ativa (a API diz qual falta).
 *
 * "Mostrar valores" fica desligado por padrão: ligado, preço, sinal e prazo de cancelamento
 * aparecem para o público, e a tela avisa. Desligar não apaga pedido: os pendentes seguem.
 */
import Button from 'primevue/button'
import InputMask from 'primevue/inputmask'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { TipoDaCasa } from '@/service/parceiro/hotel-casa-service'
import {
  ANTECEDENCIA_MAX_HORAS,
  BALCAO_MIN_MINUTOS,
  HORIZONTE_MAX_DIAS,
  ORIENTACAO_MAX,
  PRAZO_MAX_HORAS,
  salvarReservaOnline,
  TIPOS_ONLINE_MAX,
  type ReservaOnline,
} from '@/service/parceiro/hotel-pedidos-service'

const props = defineProps<{
  configuracao: ReservaOnline
  tipos: TipoDaCasa[]
  podeSalvar: boolean
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salva: [config: ReservaOnline] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const v = reactive({
  ativo: false,
  permiteEscolherAcomodacao: false,
  permiteHotelEscolhe: false,
  aceitaPeloLink: false,
  mostrarValores: false,
  tipoIds: [] as string[],
  antecedenciaMinimaHoras: 0 as number | null,
  horizonteDias: 1 as number | null,
  prazoDeRespostaHoras: 1 as number | null,
  balcaoAbre: '',
  balcaoFecha: '',
  orientacaoDeUrgencia: '',
})
const salvando = ref(false)
const erro = ref('')
const tentou = ref(false)

watch(aberta, (agora) => {
  if (!agora) return
  const c = props.configuracao
  Object.assign(v, {
    ativo: c.ativo,
    permiteEscolherAcomodacao: c.permiteEscolherAcomodacao,
    permiteHotelEscolhe: c.permiteHotelEscolhe,
    aceitaPeloLink: c.aceitaPeloLink,
    mostrarValores: c.mostrarValores,
    tipoIds: [...c.tipoIds],
    antecedenciaMinimaHoras: c.antecedenciaMinimaHoras,
    horizonteDias: c.horizonteDias,
    prazoDeRespostaHoras: c.prazoDeRespostaHoras,
    balcaoAbre: c.balcaoAbre,
    balcaoFecha: c.balcaoFecha,
    orientacaoDeUrgencia: c.orientacaoDeUrgencia ?? '',
  })
  erro.value = ''
  tentou.value = false
})

const opcoesDeTipo = computed(() => props.tipos.map((tp) => ({ valor: tp.id, rotulo: tp.nome })))

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const minutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}
const balcaoValido = computed(
  () =>
    HORA.test(v.balcaoAbre) &&
    HORA.test(v.balcaoFecha) &&
    minutos(v.balcaoFecha) - minutos(v.balcaoAbre) >= BALCAO_MIN_MINUTOS,
)
const valido = computed(
  () =>
    balcaoValido.value &&
    v.antecedenciaMinimaHoras !== null &&
    v.horizonteDias !== null &&
    v.prazoDeRespostaHoras !== null &&
    v.tipoIds.length <= TIPOS_ONLINE_MAX,
)

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (!valido.value) return
  salvando.value = true
  try {
    const salva = await salvarReservaOnline(
      {
        ativo: v.ativo,
        permiteEscolherAcomodacao: v.permiteEscolherAcomodacao,
        permiteHotelEscolhe: v.permiteHotelEscolhe,
        aceitaPeloLink: v.aceitaPeloLink,
        mostrarValores: v.mostrarValores,
        tipoIds: v.tipoIds,
        antecedenciaMinimaHoras: v.antecedenciaMinimaHoras!,
        horizonteDias: v.horizonteDias!,
        prazoDeRespostaHoras: v.prazoDeRespostaHoras!,
        balcaoAbre: v.balcaoAbre,
        balcaoFecha: v.balcaoFecha,
        orientacaoDeUrgencia: v.orientacaoDeUrgencia.trim() || null,
      },
      parceiroQuery(),
    )
    aberta.value = false
    emit('salva', salva)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}

const desligado = computed(() => !props.podeSalvar || salvando.value)
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('pedidosDoHotel.config.titulo')"
    icone="ph ph-sliders-horizontal"
    largura="38rem"
  >
    <form id="reserva-online" class="eg" novalidate @submit.prevent="salvar">
      <p v-if="!configuracao.perfilPublicado" class="eg__aviso">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>{{ t('pedidosDoHotel.config.semPagina') }}</span>
      </p>

      <label class="ro__chave">
        <ToggleSwitch v-model="v.ativo" :disabled="desligado" />
        <span>
          <strong>{{ t('pedidosDoHotel.config.ativo') }}</strong>
          <small>{{ t('pedidosDoHotel.config.ativoAjuda') }}</small>
        </span>
      </label>

      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('pedidosDoHotel.config.caminhos') }}</h3>
        <label class="ro__chave">
          <ToggleSwitch v-model="v.permiteEscolherAcomodacao" :disabled="desligado" />
          <span>
            <strong>{{ t('pedidosDoHotel.config.escolherAcomodacao') }}</strong>
            <small>{{ t('pedidosDoHotel.config.escolherAcomodacaoAjuda') }}</small>
          </span>
        </label>
        <label class="ro__chave">
          <ToggleSwitch v-model="v.permiteHotelEscolhe" :disabled="desligado" />
          <span>
            <strong>{{ t('pedidosDoHotel.config.hotelEscolhe') }}</strong>
            <small>{{ t('pedidosDoHotel.config.hotelEscolheAjuda') }}</small>
          </span>
        </label>
        <label class="ro__chave">
          <ToggleSwitch v-model="v.aceitaPeloLink" :disabled="desligado" />
          <span>
            <strong>{{ t('pedidosDoHotel.config.link') }}</strong>
            <small>{{ t('pedidosDoHotel.config.linkAjuda') }}</small>
          </span>
        </label>
        <label class="ro__chave">
          <ToggleSwitch v-model="v.mostrarValores" :disabled="desligado" />
          <span>
            <strong>{{ t('pedidosDoHotel.config.mostrarValores') }}</strong>
            <small>{{ t('pedidosDoHotel.config.mostrarValoresAjuda') }}</small>
          </span>
        </label>
      </section>

      <section class="eg__secao">
        <span id="ro-tipos" class="eg__rotulo">{{ t('pedidosDoHotel.config.tipos') }}</span>
        <SelectButton
          v-model="v.tipoIds"
          :options="opcoesDeTipo"
          option-label="rotulo"
          option-value="valor"
          multiple
          aria-labelledby="ro-tipos"
          :disabled="desligado"
          class="ro__tipos"
        />
        <small class="eg__dica">{{
          t('pedidosDoHotel.config.tiposAjuda', { n: configuracao.tiposQueServem })
        }}</small>
      </section>

      <div class="eg__linha">
        <div class="eg__secao">
          <label class="eg__rotulo" for="ro-antecedencia">{{
            t('pedidosDoHotel.config.antecedencia')
          }}</label>
          <InputNumber
            v-model="v.antecedenciaMinimaHoras"
            input-id="ro-antecedencia"
            :min="0"
            :max="ANTECEDENCIA_MAX_HORAS"
            suffix=" h"
            :invalid="tentou && v.antecedenciaMinimaHoras === null"
            :disabled="desligado"
          />
        </div>
        <div class="eg__secao">
          <label class="eg__rotulo" for="ro-horizonte">{{
            t('pedidosDoHotel.config.horizonte')
          }}</label>
          <InputNumber
            v-model="v.horizonteDias"
            input-id="ro-horizonte"
            :min="1"
            :max="HORIZONTE_MAX_DIAS"
            :suffix="` ${t('pedidosDoHotel.config.dias')}`"
            :invalid="tentou && v.horizonteDias === null"
            :disabled="desligado"
          />
        </div>
        <div class="eg__secao">
          <label class="eg__rotulo" for="ro-prazo">{{ t('pedidosDoHotel.config.prazo') }}</label>
          <InputNumber
            v-model="v.prazoDeRespostaHoras"
            input-id="ro-prazo"
            :min="1"
            :max="PRAZO_MAX_HORAS"
            suffix=" h"
            :invalid="tentou && v.prazoDeRespostaHoras === null"
            :disabled="desligado"
          />
        </div>
      </div>

      <div class="eg__linha">
        <div class="eg__secao">
          <label class="eg__rotulo" for="ro-abre">{{
            t('pedidosDoHotel.config.balcaoAbre')
          }}</label>
          <InputMask
            id="ro-abre"
            v-model="v.balcaoAbre"
            mask="99:99"
            :invalid="tentou && !balcaoValido"
            :disabled="desligado"
          />
        </div>
        <div class="eg__secao">
          <label class="eg__rotulo" for="ro-fecha">{{
            t('pedidosDoHotel.config.balcaoFecha')
          }}</label>
          <InputMask
            id="ro-fecha"
            v-model="v.balcaoFecha"
            mask="99:99"
            :invalid="tentou && !balcaoValido"
            :disabled="desligado"
          />
        </div>
      </div>
      <small :class="tentou && !balcaoValido ? 'eg__invalido' : 'eg__dica'" class="ro__dica">{{
        t('pedidosDoHotel.config.balcaoAjuda')
      }}</small>

      <section class="eg__secao">
        <label class="eg__rotulo" for="ro-orientacao">
          {{ t('pedidosDoHotel.config.orientacao') }}
          <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
        </label>
        <Textarea
          id="ro-orientacao"
          v-model="v.orientacaoDeUrgencia"
          rows="2"
          auto-resize
          :maxlength="ORIENTACAO_MAX"
          :disabled="desligado"
        />
        <small class="eg__dica">{{ t('pedidosDoHotel.config.orientacaoAjuda') }}</small>
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
        v-if="podeSalvar"
        type="submit"
        form="reserva-online"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ro__chave {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
}

.ro__chave :deep(.p-toggleswitch) {
  flex: 0 0 auto;
  margin-top: 2px;
}

.ro__chave span {
  display: grid;
  gap: 2px;
}

.ro__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.ro__chave small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.ro__tipos {
  flex-wrap: wrap;
}

.ro__dica {
  margin-top: -14px;
}
</style>
