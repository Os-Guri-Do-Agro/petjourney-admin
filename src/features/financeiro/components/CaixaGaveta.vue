<script setup lang="ts">
/**
 * O caixa do dia (protótipo), em três usos da mesma gaveta:
 *
 * - **Abrir:** o troco que fica na gaveta para começar.
 * - **Retirada ou reforço:** o dinheiro que sai (depósito no banco, pagar um entregador) ou entra
 *   (troco que faltou), com o motivo. É o que explica a gaveta no fechamento.
 * - **Fechar:** a conferência do "fim do dia" (o ezyVet chama de reconciliação): por forma de
 *   pagamento, o que o sistema esperava contra o que se contou. O dinheiro se conta na mão; Pix e
 *   cartão se conferem com o extrato e a maquininha. Diferença aparece na hora, com o motivo pedido
 *   só quando existe.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'

import { reais, type Centavos, type FormaDePagamento } from '../dados'
import { useFinanceiro, type ModoDoCaixa } from '../estado'

const props = defineProps<{ modo: ModoDoCaixa }>()
const aberta = defineModel<boolean>('visible', { default: false })

const toast = useToast()
const fin = useFinanceiro()

const troco = ref(200)
const valor = ref<number | null>(null)
const motivo = ref('')
const tipo = ref<'retirada' | 'reforco'>('retirada')
const contado = ref<Partial<Record<FormaDePagamento, number | null>>>({})
const deixarDeTroco = ref<number | null>(200)
const observacao = ref('')
const tentou = ref(false)

const MOTIVOS = {
  retirada: ['Depósito no banco', 'Pagamento a fornecedor', 'Vale de funcionário', 'Outro'],
  reforco: ['Troco que faltou', 'Devolução de vale', 'Outro'],
}

watch(aberta, (agora) => {
  if (!agora) return
  tentou.value = false
  troco.value = fin.mundo.value.caixa.trocoInicial / 100 || 200
  valor.value = null
  tipo.value = props.modo === 'reforco' ? 'reforco' : 'retirada'
  motivo.value = MOTIVOS[tipo.value][0]!
  observacao.value = ''
  deixarDeTroco.value = 200
  /* Cartão e Pix já vêm conferidos com o esperado: quem fecha só mexe se o extrato discordar. */
  const inicial: Partial<Record<FormaDePagamento, number | null>> = {}
  for (const f of fin.porForma.value) {
    inicial[f.forma] = f.forma === 'dinheiro' ? null : f.total / 100
  }
  contado.value = inicial
})

watch(tipo, (agora) => {
  motivo.value = MOTIVOS[agora][0]!
})

const esperadoDe = (forma: FormaDePagamento) =>
  forma === 'dinheiro'
    ? fin.dinheiroNaGaveta.value
    : (fin.porForma.value.find((f) => f.forma === forma)?.total ?? 0)

const linhas = computed(() =>
  fin.porForma.value.map((f) => {
    const esperado = esperadoDe(f.forma)
    const digitado = contado.value[f.forma]
    const contou = digitado === null || digitado === undefined ? null : Math.round(digitado * 100)
    return {
      ...f,
      esperado,
      contou,
      diferenca: contou === null ? null : contou - esperado,
      dica:
        f.forma === 'dinheiro'
          ? 'Conte a gaveta, com o troco.'
          : f.forma === 'pix'
            ? 'Confira com o extrato do banco.'
            : 'Confira com o relatório da maquininha.',
    }
  }),
)

const diferencaTotal = computed(() =>
  linhas.value.reduce((soma, l) => soma + (l.diferenca ?? 0), 0),
)
const faltaContar = computed(() => linhas.value.some((l) => l.contou === null))
const dinheiroContado = computed(
  () => linhas.value.find((l) => l.forma === 'dinheiro')?.contou ?? 0,
)
const vaiParaOBanco = computed(() =>
  Math.max(0, dinheiroContado.value - Math.round((deixarDeTroco.value ?? 0) * 100)),
)

const titulo = computed(
  () =>
    ({
      abrir: 'Abrir o caixa',
      fechar: 'Fechar o caixa',
      retirada: 'Retirada ou reforço',
      reforco: 'Retirada ou reforço',
    })[props.modo],
)

const icone = computed(
  () =>
    ({
      abrir: 'ph ph-lock-key-open',
      fechar: 'ph ph-lock-key',
      retirada: 'ph ph-arrows-down-up',
      reforco: 'ph ph-arrows-down-up',
    })[props.modo],
)

function confirmar() {
  tentou.value = true
  if (props.modo === 'abrir') {
    fin.abrirCaixa(Math.round(troco.value * 100))
    toast.add({
      severity: 'success',
      summary: 'Caixa aberto',
      detail: `Com ${reais(Math.round(troco.value * 100))} de troco.`,
      life: 3500,
    })
  } else if (props.modo === 'fechar') {
    if (faltaContar.value) return
    if (diferencaTotal.value !== 0 && !observacao.value.trim()) return
    const final: Partial<Record<FormaDePagamento, Centavos>> = {}
    for (const l of linhas.value) final[l.forma] = l.contou ?? 0
    fin.fecharCaixa(final, observacao.value.trim())
    toast.add({
      severity: diferencaTotal.value === 0 ? 'success' : 'warn',
      summary: 'Caixa fechado',
      detail:
        diferencaTotal.value === 0
          ? `Tudo bateu. ${reais(vaiParaOBanco.value)} em dinheiro para depositar.`
          : `Diferença de ${reais(diferencaTotal.value)} registrada com o motivo.`,
      life: 5000,
    })
  } else {
    const centavos = Math.round((valor.value ?? 0) * 100)
    if (centavos <= 0) return
    if (tipo.value === 'retirada' && centavos > fin.dinheiroNaGaveta.value) return
    fin.movimentar(tipo.value, centavos, motivo.value)
    toast.add({
      severity: 'success',
      summary: tipo.value === 'retirada' ? 'Retirada registrada' : 'Reforço registrado',
      detail: `${reais(centavos)} · ${motivo.value}`,
      life: 3500,
    })
  }
  aberta.value = false
}

const erroDoMovimento = computed(() => {
  if (!tentou.value || props.modo === 'abrir' || props.modo === 'fechar') return ''
  const centavos = Math.round((valor.value ?? 0) * 100)
  if (centavos <= 0) return 'Diga o valor.'
  if (tipo.value === 'retirada' && centavos > fin.dinheiroNaGaveta.value)
    return `A gaveta tem ${reais(fin.dinheiroNaGaveta.value)}.`
  return ''
})
</script>

<template>
  <CadastroGaveta v-model:visible="aberta" :titulo="titulo" :icone="icone" largura="34rem">
    <form id="caixa-gaveta" class="cg" novalidate @submit.prevent="confirmar">
      <!-- Abrir -->
      <template v-if="modo === 'abrir'">
        <p class="eg__dica">
          O troco que fica na gaveta para começar o dia. É a base da conferência na hora de fechar.
        </p>
        <section class="eg__secao">
          <label class="eg__rotulo" for="cg-troco">Troco na gaveta</label>
          <InputNumber
            v-model="troco"
            input-id="cg-troco"
            mode="currency"
            currency="BRL"
            locale="pt-BR"
            :min="0"
          />
        </section>
      </template>

      <!-- Retirada ou reforço -->
      <template v-else-if="modo === 'retirada' || modo === 'reforco'">
        <SelectButton
          v-model="tipo"
          :options="[
            { valor: 'retirada', rotulo: 'Tirar da gaveta' },
            { valor: 'reforco', rotulo: 'Pôr na gaveta' },
          ]"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-label="Retirada ou reforço"
        />
        <section class="eg__secao">
          <label class="eg__rotulo" for="cg-valor">Valor</label>
          <InputNumber
            v-model="valor"
            input-id="cg-valor"
            mode="currency"
            currency="BRL"
            locale="pt-BR"
            :min="0"
            placeholder="R$ 0,00"
          />
          <small class="eg__dica">Na gaveta agora: {{ reais(fin.dinheiroNaGaveta.value) }}</small>
        </section>
        <section class="eg__secao">
          <span class="eg__rotulo">Motivo</span>
          <SelectButton
            v-model="motivo"
            :options="MOTIVOS[tipo]"
            :allow-empty="false"
            aria-label="Motivo"
            class="cg__motivos"
          />
        </section>
        <p v-if="erroDoMovimento" class="eg__invalido" role="alert">{{ erroDoMovimento }}</p>
      </template>

      <!-- Fechar -->
      <template v-else>
        <p class="eg__dica">
          Confira cada forma. O dinheiro se conta na mão; Pix e cartão já vêm com o que o sistema
          registrou: mude só se o extrato ou a maquininha disserem outra coisa.
        </p>
        <ul class="cg__linhas">
          <li v-for="l in linhas" :key="l.forma" class="cg__linha">
            <span class="cg__forma">
              <i :class="l.icone" aria-hidden="true" />
              <span>
                <strong>{{ l.nome }}</strong>
                <small>{{ l.dica }} Esperado: {{ reais(l.esperado) }}</small>
              </span>
            </span>
            <InputNumber
              v-model="contado[l.forma]"
              mode="currency"
              currency="BRL"
              locale="pt-BR"
              :min="0"
              placeholder="Contar"
              :aria-label="`${l.nome} conferido`"
              class="cg__campo"
              :invalid="tentou && l.contou === null"
            />
            <span
              class="cg__dif"
              :class="{
                'cg__dif--ok': l.diferenca === 0,
                'cg__dif--falta': (l.diferenca ?? 0) < 0,
                'cg__dif--sobra': (l.diferenca ?? 0) > 0,
              }"
            >
              <template v-if="l.diferenca === null">—</template>
              <template v-else-if="l.diferenca === 0"
                ><i class="ph ph-check" aria-hidden="true" /> Bate</template
              >
              <template v-else>
                <i class="ph ph-warning" aria-hidden="true" />
                {{ l.diferenca < 0 ? 'Falta' : 'Sobra' }} {{ reais(Math.abs(l.diferenca)) }}
              </template>
            </span>
          </li>
        </ul>

        <section class="eg__secao">
          <label class="eg__rotulo" for="cg-deixar">Deixar de troco para amanhã</label>
          <InputNumber
            v-model="deixarDeTroco"
            input-id="cg-deixar"
            mode="currency"
            currency="BRL"
            locale="pt-BR"
            :min="0"
          />
          <small class="eg__dica">Vai para o banco: {{ reais(vaiParaOBanco) }} em dinheiro.</small>
        </section>

        <section v-if="diferencaTotal !== 0 && !faltaContar" class="eg__secao">
          <label class="eg__rotulo" for="cg-obs">O que explica a diferença</label>
          <Textarea
            id="cg-obs"
            v-model="observacao"
            rows="2"
            auto-resize
            placeholder="Ex.: troco dado a mais para a Rita"
            :invalid="tentou && !observacao.trim()"
          />
        </section>

        <p v-if="tentou && faltaContar" class="eg__invalido" role="alert">
          Falta contar o dinheiro da gaveta.
        </p>
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
        form="caixa-gaveta"
        :icon="
          modo === 'fechar'
            ? 'ph ph-lock-key'
            : modo === 'abrir'
              ? 'ph ph-lock-key-open'
              : 'ph ph-check'
        "
        :label="
          modo === 'fechar' ? 'Fechar o caixa' : modo === 'abrir' ? 'Abrir o caixa' : 'Registrar'
        "
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.cg {
  display: grid;
  gap: 20px;
}

.cg__motivos {
  flex-wrap: wrap;
}

.cg__linhas {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cg__linha {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 9.5rem 7.5rem;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
}

.cg__linha + .cg__linha {
  border-top: 1px solid var(--linha-suave);
}

.cg__forma {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.cg__forma i {
  color: var(--tinta-2);
  font-size: 20px;
}

.cg__forma > span {
  display: grid;
  gap: 2px;
}

.cg__forma strong {
  color: var(--tinta);
  font-size: 14px;
}

.cg__forma small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.cg__campo :deep(input) {
  width: 100%;
}

.cg__dif {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  color: var(--tinta-3);
  font-size: 13px;
  font-weight: 650;
}

.cg__dif--ok {
  color: var(--ok-tinta);
}

.cg__dif--falta {
  color: var(--risco-tinta);
}

.cg__dif--sobra {
  color: var(--atencao-tinta);
}
</style>
