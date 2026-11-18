<script setup lang="ts">
/**
 * Uma conta a pagar (protótipo), em dois usos:
 *
 * - **Registrar ou editar:** o que é, de quem, quanto e quando vence. "Repetir todo mês" serve ao
 *   aluguel e às contas de consumo: as próximas já entram na lista, e a previsão de 30 dias as vê.
 * - **Pagar:** quando e como saiu o dinheiro. O repasse de um veterinário, pago aqui, fica pago
 *   também em Repasses (é a mesma conta).
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'

import { CATEGORIAS, dataCurta, reais, type CategoriaDeDespesa } from '../dados'
import { useFinanceiro } from '../estado'

const props = defineProps<{ despesaId: string | null; modo: 'registrar' | 'pagar' }>()
const aberta = defineModel<boolean>('visible', { default: false })

const toast = useToast()
const fin = useFinanceiro()

const despesa = computed(() =>
  props.despesaId ? (fin.mundo.value.despesas.find((d) => d.id === props.despesaId) ?? null) : null,
)

const descricao = ref('')
const fornecedor = ref('')
const categoria = ref<CategoriaDeDespesa | null>(null)
const valor = ref<number | null>(null)
const vencimento = ref<Date>(new Date())
const recorrente = ref(false)
const jaPaga = ref(false)
const pagaEm = ref<Date>(new Date())
const pagoCom = ref('Pix')
const tentou = ref(false)

function dataLocal(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a!, m! - 1, d!)
}

function isoLocal(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

watch(aberta, (agora) => {
  if (!agora) return
  tentou.value = false
  const d = despesa.value
  descricao.value = d?.descricao ?? ''
  fornecedor.value = d?.fornecedor ?? ''
  categoria.value = d?.categoria ?? null
  valor.value = d ? d.valor / 100 : null
  vencimento.value = dataLocal(d?.vencimento ?? fin.hoje.value)
  recorrente.value = d?.recorrente ?? false
  jaPaga.value = false
  pagaEm.value = dataLocal(fin.hoje.value)
  pagoCom.value = d?.origem?.tipo === 'repasse' ? 'Pix' : 'Boleto'
})

const opcoesDeCategoria = computed(() =>
  (Object.keys(CATEGORIAS) as CategoriaDeDespesa[])
    .filter((c) => c !== 'repasses')
    .map((c) => ({ valor: c, rotulo: CATEGORIAS[c].nome, icone: CATEGORIAS[c].icone })),
)

const faltas = computed(() => {
  if (props.modo === 'pagar') return []
  return [
    descricao.value.trim() ? '' : 'Diga o que é a conta.',
    categoria.value ? '' : 'Escolha a categoria.',
    (valor.value ?? 0) > 0 ? '' : 'Diga o valor.',
  ].filter(Boolean)
})

const titulo = computed(() => {
  if (props.modo === 'pagar') return 'Pagar conta'
  return despesa.value ? 'Editar conta a pagar' : 'Registrar despesa'
})

function confirmar() {
  tentou.value = true
  if (faltas.value.length) return
  if (props.modo === 'pagar' && despesa.value) {
    fin.pagarDespesa(despesa.value.id, isoLocal(pagaEm.value))
    if (pagoCom.value === 'Dinheiro do caixa' && fin.caixaAberto.value) {
      fin.movimentar('retirada', despesa.value.valor, 'Pagamento a fornecedor')
    }
    toast.add({
      severity: 'success',
      summary: 'Conta paga',
      detail: `${despesa.value.descricao} · ${reais(despesa.value.valor)} no ${pagoCom.value.toLowerCase()}, em ${dataCurta(isoLocal(pagaEm.value))}.`,
      life: 4000,
    })
  } else {
    fin.salvarDespesa({
      id: despesa.value?.id,
      descricao: descricao.value.trim(),
      fornecedor: fornecedor.value.trim() || 'Sem fornecedor',
      categoria: categoria.value!,
      valor: Math.round((valor.value ?? 0) * 100),
      vencimento: isoLocal(vencimento.value),
      pagaEm: jaPaga.value ? fin.hoje.value : (despesa.value?.pagaEm ?? null),
      recorrente: recorrente.value,
      origem: despesa.value?.origem ?? null,
    })
    toast.add({
      severity: 'success',
      summary: despesa.value ? 'Conta atualizada' : 'Despesa registrada',
      detail:
        recorrente.value && !despesa.value
          ? 'Os próximos dois meses já entraram na lista.'
          : `Vence em ${dataCurta(isoLocal(vencimento.value))}.`,
      life: 4000,
    })
  }
  aberta.value = false
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="titulo"
    :icone="modo === 'pagar' ? 'ph ph-check-circle' : 'ph ph-receipt'"
    largura="34rem"
  >
    <form id="despesa-gaveta" class="dg" novalidate @submit.prevent="confirmar">
      <template v-if="modo === 'pagar' && despesa">
        <div class="dg__resumo">
          <span class="ui-ladrilho" aria-hidden="true"
            ><i :class="CATEGORIAS[despesa.categoria].icone"
          /></span>
          <span class="dg__resumo-texto">
            <strong>{{ despesa.descricao }}</strong>
            <span>{{ despesa.fornecedor }} · {{ CATEGORIAS[despesa.categoria].nome }}</span>
            <span v-if="despesa.origem">{{ despesa.origem.texto }}</span>
          </span>
          <span class="dg__resumo-valor">
            <strong class="ui-num">{{ reais(despesa.valor) }}</strong>
            <small>vence {{ dataCurta(despesa.vencimento) }}</small>
          </span>
        </div>

        <section class="eg__secao">
          <span class="eg__rotulo">Pago em</span>
          <DatePicker
            v-model="pagaEm"
            inline
            :max-date="dataLocal(fin.hoje.value)"
            class="dg__calendario"
          />
        </section>
        <section class="eg__secao">
          <span class="eg__rotulo">Como saiu</span>
          <SelectButton
            v-model="pagoCom"
            :options="['Pix', 'Boleto', 'Transferência', 'Dinheiro do caixa']"
            :allow-empty="false"
            aria-label="Como saiu"
            class="dg__como"
          />
          <small v-if="pagoCom === 'Dinheiro do caixa'" class="eg__dica">
            Sai da gaveta como uma retirada, com o motivo "Pagamento a fornecedor".
          </small>
        </section>
      </template>

      <template v-else>
        <section class="eg__secao">
          <label class="eg__rotulo" for="dg-descricao">O que é</label>
          <InputText
            id="dg-descricao"
            v-model="descricao"
            placeholder="Ex.: Conta de luz de novembro"
            maxlength="80"
            :invalid="tentou && !descricao.trim()"
          />
        </section>
        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="dg-categoria">Categoria</label>
            <Select
              v-model="categoria"
              input-id="dg-categoria"
              :options="opcoesDeCategoria"
              option-label="rotulo"
              option-value="valor"
              placeholder="Escolha na lista"
              :invalid="tentou && !categoria"
            >
              <template #option="{ option }">
                <span class="dg__opcao"
                  ><i :class="option.icone" aria-hidden="true" /> {{ option.rotulo }}</span
                >
              </template>
            </Select>
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="dg-valor">Valor</label>
            <InputNumber
              v-model="valor"
              input-id="dg-valor"
              mode="currency"
              currency="BRL"
              locale="pt-BR"
              :min="0"
              placeholder="R$ 0,00"
              :invalid="tentou && !(valor && valor > 0)"
            />
          </section>
        </div>
        <section class="eg__secao">
          <label class="eg__rotulo" for="dg-fornecedor"
            >De quem <span class="eg__opcional">(opcional)</span></label
          >
          <InputText
            id="dg-fornecedor"
            v-model="fornecedor"
            placeholder="Fornecedor, empresa ou pessoa"
            maxlength="80"
          />
        </section>
        <section class="eg__secao">
          <span class="eg__rotulo">Vence em</span>
          <DatePicker v-model="vencimento" inline class="dg__calendario" />
        </section>
        <label v-if="!despesa" class="dg__chave">
          <span>
            <strong>Repetir todo mês</strong>
            <small
              >Aluguel, contas de consumo, assinaturas. Os próximos meses já entram na lista.</small
            >
          </span>
          <ToggleSwitch v-model="recorrente" />
        </label>
        <label v-if="!despesa" class="dg__chave">
          <span>
            <strong>Já está paga</strong>
            <small>Para lançar o que saiu hoje e não passou pela lista.</small>
          </span>
          <ToggleSwitch v-model="jaPaga" />
        </label>
        <ul v-if="tentou && faltas.length" class="eg__erro dg__faltas" role="alert">
          <li v-for="falta in faltas" :key="falta">{{ falta }}</li>
        </ul>
      </template>
    </form>

    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        label="Cancelar"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="despesa-gaveta"
        icon="ph ph-check"
        :label="modo === 'pagar' ? 'Marcar como paga' : despesa ? 'Salvar' : 'Registrar'"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.dg {
  display: grid;
  gap: 20px;
}

.dg__resumo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--superficie-2);
}

.dg__resumo-texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.dg__resumo-texto strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.dg__resumo-texto span {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.dg__resumo-valor {
  display: grid;
  justify-items: end;
}

.dg__resumo-valor strong {
  color: var(--tinta);
  font-size: 18px;
}

.dg__resumo-valor small {
  color: var(--tinta-2);
  font-size: 12px;
}

.dg__calendario {
  width: 100%;
}

.dg__como {
  flex-wrap: wrap;
}

.dg__opcao {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.dg__chave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.dg__chave > span {
  display: grid;
  gap: 2px;
}

.dg__chave strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.dg__chave small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.dg__faltas {
  display: grid;
  gap: 2px;
  margin: 0;
  padding-inline-start: 18px;
}
</style>
