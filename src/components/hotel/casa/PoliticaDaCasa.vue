<script setup lang="ts">
/**
 * A política da casa (E7-01, guia e7 9), por assunto como a Política da agenda: à esquerda o que o
 * número muda, à direita os campos. A casa que nunca salvou recebe o padrão do sistema
 * (`padrao: true`): o formulário abre com ele e avisa que ainda não foi salvo.
 *
 * O `PUT` leva a política inteira (os 6 campos). Sem `hotel.valores` a API devolve só os horários,
 * e a tela mostra só eles (quem não vê dinheiro também não edita). A saída não passa do limite da
 * meia diária (`POLITICA_INVALIDA`). Mudar não reescreve reserva: a reserva congela a dela.
 */
import Button from 'primevue/button'
import InputMask from 'primevue/inputmask'
import InputNumber from 'primevue/inputnumber'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  CANCELAMENTO_MAX_DIAS,
  salvarPolitica,
  type PoliticaDaCasa,
} from '@/service/parceiro/hotel-casa-service'

const props = defineProps<{ politica: PoliticaDaCasa; podeEditar: boolean }>()
const emit = defineEmits<{ salva: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const valores = reactive({
  horarioDeEntrada: '',
  horarioDeSaida: '',
  limiteMeiaDiaria: '',
  meiaDiariaPercentual: null as number | null,
  sinalPercentual: null as number | null,
  cancelamentoSemCustoDias: null as number | null,
})
const salvando = ref(false)
const erro = ref('')
const recado = ref('')
const tentou = ref(false)

watch(
  () => props.politica,
  (p) => {
    valores.horarioDeEntrada = p.horarioDeEntrada
    valores.horarioDeSaida = p.horarioDeSaida
    valores.limiteMeiaDiaria = p.limiteMeiaDiaria
    valores.meiaDiariaPercentual = p.meiaDiariaPercentual ?? null
    valores.sinalPercentual = p.sinalPercentual ?? null
    valores.cancelamentoSemCustoDias = p.cancelamentoSemCustoDias ?? null
  },
  { immediate: true },
)

/** Os percentuais só vêm para quem vê dinheiro. */
const veDinheiro = computed(() => typeof props.politica.sinalPercentual === 'number')

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const horaValida = (valor: string) => HORA.test(valor)
const saidaDepois = computed(
  () =>
    horaValida(valores.horarioDeSaida) &&
    horaValida(valores.limiteMeiaDiaria) &&
    valores.horarioDeSaida > valores.limiteMeiaDiaria,
)

const valido = computed(
  () =>
    horaValida(valores.horarioDeEntrada) &&
    horaValida(valores.horarioDeSaida) &&
    horaValida(valores.limiteMeiaDiaria) &&
    !saidaDepois.value &&
    valores.meiaDiariaPercentual !== null &&
    valores.sinalPercentual !== null &&
    valores.cancelamentoSemCustoDias !== null,
)

async function salvar() {
  tentou.value = true
  erro.value = ''
  recado.value = ''
  if (!valido.value) return
  salvando.value = true
  try {
    await salvarPolitica(
      {
        horarioDeEntrada: valores.horarioDeEntrada,
        horarioDeSaida: valores.horarioDeSaida,
        limiteMeiaDiaria: valores.limiteMeiaDiaria,
        meiaDiariaPercentual: valores.meiaDiariaPercentual!,
        sinalPercentual: valores.sinalPercentual!,
        cancelamentoSemCustoDias: valores.cancelamentoSemCustoDias!,
      },
      parceiroQuery(),
    )
    recado.value = t('casaDoHotel.politica.salva')
    emit('salva')
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}

const desligado = computed(() => !props.podeEditar || salvando.value)
</script>

<template>
  <section class="ui-folha ui-cartao pc" aria-labelledby="politica-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-scroll" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="politica-titulo" class="ui-cartao__titulo">
          {{ t('casaDoHotel.politica.titulo') }}
        </h2>
        <p class="ui-cartao__descricao">{{ t('casaDoHotel.politica.descricao') }}</p>
      </span>
    </header>

    <p v-if="politica.padrao" class="eg__aviso pc__aviso">
      <i class="ph ph-info" aria-hidden="true" />
      <span>{{ t('casaDoHotel.politica.padrao') }}</span>
    </p>

    <form class="pc__form" novalidate @submit.prevent="salvar">
      <section class="pc__grupo" aria-labelledby="pc-horarios">
        <div class="pc__sobre">
          <h3 id="pc-horarios" class="pc__titulo">
            {{ t('casaDoHotel.politica.horarios.titulo') }}
          </h3>
          <p class="pc__descricao">{{ t('casaDoHotel.politica.horarios.descricao') }}</p>
        </div>
        <div class="pc__campos">
          <div
            v-for="campo in ['horarioDeEntrada', 'horarioDeSaida', 'limiteMeiaDiaria'] as const"
            :key="campo"
            class="eg__secao"
          >
            <label class="eg__rotulo" :for="`pc-${campo}`">{{
              t(
                campo === 'horarioDeEntrada'
                  ? 'casaDoHotel.politica.entrada'
                  : campo === 'horarioDeSaida'
                    ? 'casaDoHotel.politica.saida'
                    : 'casaDoHotel.politica.limite',
              )
            }}</label>
            <InputMask
              :id="`pc-${campo}`"
              v-model="valores[campo]"
              mask="99:99"
              placeholder="08:00"
              :invalid="
                (tentou && !horaValida(valores[campo])) ||
                (campo !== 'horarioDeEntrada' && saidaDepois)
              "
              :disabled="desligado"
            />
          </div>
          <small v-if="saidaDepois" class="eg__invalido pc__largo">{{
            t('casaDoHotel.politica.saidaDepois')
          }}</small>
          <small v-else-if="tentou && !valido" class="eg__invalido pc__largo">{{
            t('casaDoHotel.politica.horaInvalida')
          }}</small>
        </div>
      </section>

      <template v-if="veDinheiro">
        <section class="pc__grupo" aria-labelledby="pc-meia">
          <div class="pc__sobre">
            <h3 id="pc-meia" class="pc__titulo">{{ t('casaDoHotel.politica.meia.titulo') }}</h3>
            <p class="pc__descricao">{{ t('casaDoHotel.politica.meia.descricao') }}</p>
          </div>
          <div class="pc__campos">
            <div class="eg__secao">
              <label class="eg__rotulo" for="pc-meiaPercentual">{{
                t('casaDoHotel.politica.meiaPercentual')
              }}</label>
              <InputNumber
                v-model="valores.meiaDiariaPercentual"
                input-id="pc-meiaPercentual"
                :min="0"
                :max="100"
                suffix=" %"
                :invalid="tentou && valores.meiaDiariaPercentual === null"
                :disabled="desligado"
              />
            </div>
          </div>
        </section>

        <section class="pc__grupo" aria-labelledby="pc-sinal">
          <div class="pc__sobre">
            <h3 id="pc-sinal" class="pc__titulo">{{ t('casaDoHotel.politica.sinal.titulo') }}</h3>
            <p class="pc__descricao">{{ t('casaDoHotel.politica.sinal.descricao') }}</p>
          </div>
          <div class="pc__campos">
            <div class="eg__secao">
              <label class="eg__rotulo" for="pc-sinalPercentual">{{
                t('casaDoHotel.politica.sinalPercentual')
              }}</label>
              <InputNumber
                v-model="valores.sinalPercentual"
                input-id="pc-sinalPercentual"
                :min="0"
                :max="100"
                suffix=" %"
                :invalid="tentou && valores.sinalPercentual === null"
                :disabled="desligado"
              />
            </div>
          </div>
        </section>

        <section class="pc__grupo" aria-labelledby="pc-cancelamento">
          <div class="pc__sobre">
            <h3 id="pc-cancelamento" class="pc__titulo">
              {{ t('casaDoHotel.politica.cancelamento.titulo') }}
            </h3>
            <p class="pc__descricao">{{ t('casaDoHotel.politica.cancelamento.descricao') }}</p>
          </div>
          <div class="pc__campos">
            <div class="eg__secao">
              <label class="eg__rotulo" for="pc-cancelamentoDias">{{
                t('casaDoHotel.politica.cancelamentoDias')
              }}</label>
              <InputNumber
                v-model="valores.cancelamentoSemCustoDias"
                input-id="pc-cancelamentoDias"
                :min="0"
                :max="CANCELAMENTO_MAX_DIAS"
                show-buttons
                :invalid="tentou && valores.cancelamentoSemCustoDias === null"
                :disabled="desligado"
              />
            </div>
          </div>
        </section>
      </template>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>

      <footer v-if="podeEditar && veDinheiro" class="pc__pe">
        <p class="pc__nota">
          <i :class="recado ? 'ph ph-check-circle pc__ok' : 'ph ph-info'" aria-hidden="true" />
          {{ recado || t('casaDoHotel.politica.naoReescreve') }}
        </p>
        <Button
          type="submit"
          icon="ph ph-check"
          :label="t('cadastro.salvar')"
          :loading="salvando"
        />
      </footer>
    </form>
  </section>
</template>

<style scoped>
.pc {
  container: politica-da-casa / inline-size;
}

.pc__aviso {
  padding: 0 10px 8px;
}

.pc__form {
  display: grid;
}

/* Um assunto por faixa: à esquerda o que ele muda, à direita os números (a Política da agenda). */
.pc__grupo {
  display: grid;
  gap: 14px 40px;
  padding: 20px 0;
}

.pc__grupo + .pc__grupo {
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.pc__grupo:first-child {
  padding-top: 4px;
}

@container politica-da-casa (min-width: 760px) {
  .pc__grupo {
    grid-template-columns: minmax(14rem, 20rem) minmax(0, 1fr);
  }
}

.pc__sobre {
  display: grid;
  align-content: start;
  gap: 4px;
}

.pc__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
  line-height: 1.35;
}

.pc__descricao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.pc__campos {
  display: grid;
  gap: 18px 20px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 10rem), 1fr));
  align-items: start;
}

.pc__campos :deep(.p-inputnumber),
.pc__campos :deep(.p-inputmask),
.pc__campos :deep(.p-inputtext) {
  width: 100%;
}

.pc__largo {
  grid-column: 1 / -1;
}

.pc__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.pc__nota {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.pc__ok {
  color: var(--ok-tinta);
}
</style>
