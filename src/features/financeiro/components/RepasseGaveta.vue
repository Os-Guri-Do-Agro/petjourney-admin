<script setup lang="ts">
/**
 * O repasse de um veterinário (protótipo): o extrato do mês e o que se faz com ele.
 *
 * - Mês aberto: **adiantar** (sai do próprio mês) e **mudar a regra**.
 * - Mês fechado: **marcar como pago** (a conta a pagar de Contas fica paga junto).
 * - Pago: o **recibo**, que o veterinário também vê em "Meus repasses".
 *
 * A regra é por veterinário, nos três modelos que as clínicas usam: porcentagem por tipo de
 * serviço (o prestador PJ), valor por dia (o volante que vem duas vezes por semana) e valor por
 * procedimento (a anestesista). A base da porcentagem também se escolhe: o valor cobrado, o
 * recebido, ou o recebido sem a taxa do cartão (o mais justo para a clínica, e o padrão).
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'

import {
  nomeDoMes,
  profissional,
  reais,
  ROTULO_DA_BASE,
  ROTULO_DO_TIPO,
  type BaseDoRepasse,
  type ModeloDeRepasse,
  type RegraDeRepasse,
  type TipoDeItem,
} from '../dados'
import { useFinanceiro } from '../estado'

import ExtratoDoRepasse from './ExtratoDoRepasse.vue'

const props = defineProps<{ profissionalId: string | null; mes: string }>()
const aberta = defineModel<boolean>('visible', { default: false })

const toast = useToast()
const fin = useFinanceiro()

const modo = ref<'extrato' | 'regra' | 'adiantar'>('extrato')
const rascunho = ref<RegraDeRepasse | null>(null)
const valorAdiantado = ref<number | null>(null)
const notaAdiantada = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  modo.value = 'extrato'
  valorAdiantado.value = null
  notaAdiantada.value = ''
})

const dados = computed(() =>
  props.profissionalId ? fin.repasse(props.profissionalId, props.mes) : null,
)
const pessoa = computed(() => profissional(props.profissionalId))
const situacao = computed(() => {
  const f = dados.value?.fechamento
  if (!f) return 'aberto'
  return f.pagoEm ? 'pago' : 'a-pagar'
})

const TIPOS_COM_PORCENTAGEM: TipoDeItem[] = [
  'consulta',
  'retorno',
  'vacina',
  'exame',
  'cirurgia',
  'anestesia',
  'emergencia',
  'internacao',
  'medicacao',
]

function editarRegra() {
  if (!dados.value) return
  const r = dados.value.regra
  rascunho.value = { ...r, percentuais: { ...r.percentuais } }
  modo.value = 'regra'
}

function porcentagem(tipo: TipoDeItem) {
  return Math.round((rascunho.value?.percentuais[tipo] ?? 0) * 1000) / 10
}

function mudarPorcentagem(tipo: TipoDeItem, valor: number | null) {
  if (!rascunho.value) return
  const v = (valor ?? 0) / 100
  if (v > 0) rascunho.value.percentuais[tipo] = v
  else delete rascunho.value.percentuais[tipo]
}

function salvarRegra() {
  if (!rascunho.value) return
  fin.salvarRegra(rascunho.value)
  toast.add({
    severity: 'success',
    summary: `Regra de ${pessoa.value.curto} atualizada`,
    detail: 'Vale para o mês aberto. Os meses fechados guardam o valor do fechamento.',
    life: 4500,
  })
  modo.value = 'extrato'
}

function adiantar() {
  const centavos = Math.round((valorAdiantado.value ?? 0) * 100)
  if (!props.profissionalId || centavos <= 0) return
  fin.adiantar(props.profissionalId, centavos, notaAdiantada.value.trim() || 'Adiantamento')
  toast.add({
    severity: 'success',
    summary: `${reais(centavos)} adiantados para ${pessoa.value.curto}`,
    detail: `Sai do repasse de ${nomeDoMes(props.mes)}.`,
    life: 4000,
  })
  modo.value = 'extrato'
}

function pagar() {
  if (!props.profissionalId) return
  fin.pagarRepasse(props.profissionalId, props.mes)
  toast.add({
    severity: 'success',
    summary: `Repasse de ${pessoa.value.curto} pago`,
    detail: `${nomeDoMes(props.mes)} · ${reais(dados.value?.fechamento?.valor ?? 0)} no Pix ${dados.value?.regra.chavePix}. ${pessoa.value.curto} vê o recibo em Meus repasses.`,
    life: 5000,
  })
}

function recibo() {
  toast.add({
    severity: 'info',
    summary: 'Recibo de repasse',
    detail: 'No protótipo, o recibo não é gerado. Ele sairia em PDF com o extrato do mês.',
    life: 4000,
  })
}

const opcoesDeModelo: { valor: ModeloDeRepasse; rotulo: string }[] = [
  { valor: 'percentual', rotulo: 'Porcentagem' },
  { valor: 'por-dia', rotulo: 'Valor por dia' },
  { valor: 'por-procedimento', rotulo: 'Por procedimento' },
]

const opcoesDeBase = (Object.keys(ROTULO_DA_BASE) as BaseDoRepasse[]).map((b) => ({
  valor: b,
  rotulo: ROTULO_DA_BASE[b],
}))

const opcoesDeProcedimento = TIPOS_COM_PORCENTAGEM.map((t) => ({
  valor: t,
  rotulo: ROTULO_DO_TIPO[t],
}))
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="modo === 'regra' ? `Regra de ${pessoa.curto}` : `Repasse de ${pessoa.curto}`"
    icone="ph ph-hand-coins"
    largura="42rem"
  >
    <div v-if="dados" class="rg">
      <header class="rg__quem">
        <span class="ui-ladrilho rg__iniciais" aria-hidden="true">{{ pessoa.iniciais }}</span>
        <span class="rg__quem-texto">
          <strong>{{ pessoa.nome }}</strong>
          <span>{{ pessoa.especialidade }} · {{ dados.regra.vinculo }} · {{ nomeDoMes(mes) }}</span>
        </span>
        <span
          class="ui-selo"
          :class="{
            'ui-selo--ok': situacao === 'pago',
            'ui-selo--atencao': situacao === 'a-pagar',
          }"
        >
          {{
            situacao === 'pago'
              ? 'Pago'
              : situacao === 'a-pagar'
                ? 'Fechado, a pagar'
                : 'Mês aberto'
          }}
        </span>
      </header>

      <!-- Extrato -->
      <template v-if="modo === 'extrato'">
        <ExtratoDoRepasse :profissional-id="profissionalId!" :mes="mes" compacto />
        <p class="eg__dica rg__vista">
          <i class="ph ph-eye" aria-hidden="true" />
          {{ pessoa.curto }} vê este mesmo extrato em Meus repasses, no portal, sem os números da
          clínica.
        </p>
      </template>

      <!-- Adiantar -->
      <template v-else-if="modo === 'adiantar'">
        <p class="eg__dica">
          O adiantamento sai do repasse de {{ nomeDoMes(mes) }}, no fechamento.
        </p>
        <section class="eg__secao">
          <label class="eg__rotulo" for="rg-adiantar">Valor</label>
          <InputNumber
            v-model="valorAdiantado"
            input-id="rg-adiantar"
            mode="currency"
            currency="BRL"
            locale="pt-BR"
            :min="0"
            placeholder="R$ 0,00"
          />
          <small class="eg__dica"
            >Até agora, {{ reais(dados.calculo.aReceber) }} a receber neste mês.</small
          >
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="rg-nota"
            >Motivo <span class="eg__opcional">(opcional)</span></label
          >
          <InputText
            id="rg-nota"
            v-model="notaAdiantada"
            placeholder="Ex.: pedido pela Ana"
            maxlength="80"
          />
        </section>
      </template>

      <!-- Regra -->
      <template v-else-if="rascunho">
        <section class="eg__secao">
          <label class="eg__rotulo" for="rg-vinculo">Vínculo</label>
          <InputText id="rg-vinculo" v-model="rascunho.vinculo" maxlength="40" />
        </section>
        <section class="eg__secao">
          <span class="eg__rotulo">Como recebe</span>
          <SelectButton
            v-model="rascunho.modelo"
            :options="opcoesDeModelo"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-label="Como recebe"
          />
        </section>

        <template v-if="rascunho.modelo === 'percentual'">
          <section class="eg__secao">
            <span class="eg__rotulo">Porcentagem por tipo de serviço</span>
            <ul class="rg__pcts">
              <li v-for="tipo in TIPOS_COM_PORCENTAGEM" :key="tipo">
                <label :for="`rg-pct-${tipo}`">{{ ROTULO_DO_TIPO[tipo] }}</label>
                <InputNumber
                  :input-id="`rg-pct-${tipo}`"
                  :model-value="porcentagem(tipo)"
                  suffix="%"
                  :min="0"
                  :max="100"
                  :max-fraction-digits="1"
                  locale="pt-BR"
                  placeholder="0%"
                  @update:model-value="mudarPorcentagem(tipo, $event)"
                />
              </li>
            </ul>
            <small class="eg__dica">Tipo em branco não entra no repasse.</small>
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="rg-base">Sobre qual valor</label>
            <Select
              v-model="rascunho.base"
              input-id="rg-base"
              :options="opcoesDeBase"
              option-label="rotulo"
              option-value="valor"
            />
            <small class="eg__dica"
              >Conta em aberto só entra no repasse quando o cliente paga.</small
            >
          </section>
        </template>

        <section v-else-if="rascunho.modelo === 'por-dia'" class="eg__secao">
          <label class="eg__rotulo" for="rg-dia">Valor por dia de atendimento</label>
          <InputNumber
            input-id="rg-dia"
            :model-value="rascunho.valorPorDia / 100"
            mode="currency"
            currency="BRL"
            locale="pt-BR"
            :min="0"
            @update:model-value="rascunho.valorPorDia = Math.round(($event ?? 0) * 100)"
          />
          <small class="eg__dica"
            >Conta o dia em que {{ pessoa.curto }} teve pelo menos um atendimento na agenda.</small
          >
        </section>

        <div v-else class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="rg-proc">Procedimento</label>
            <Select
              v-model="rascunho.procedimento"
              input-id="rg-proc"
              :options="opcoesDeProcedimento"
              option-label="rotulo"
              option-value="valor"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="rg-valor-proc">Valor por procedimento</label>
            <InputNumber
              input-id="rg-valor-proc"
              :model-value="rascunho.valorPorProcedimento / 100"
              mode="currency"
              currency="BRL"
              locale="pt-BR"
              :min="0"
              @update:model-value="rascunho.valorPorProcedimento = Math.round(($event ?? 0) * 100)"
            />
          </section>
        </div>

        <section class="eg__secao">
          <label class="eg__rotulo" for="rg-pix">Chave Pix para o pagamento</label>
          <InputText id="rg-pix" v-model="rascunho.chavePix" maxlength="80" />
        </section>
      </template>
    </div>

    <template #pe>
      <template v-if="modo === 'extrato'">
        <Button
          type="button"
          severity="secondary"
          outlined
          label="Fechar"
          @click="aberta = false"
        />
        <Button
          v-if="situacao === 'aberto'"
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-sliders-horizontal"
          label="Mudar a regra"
          @click="editarRegra"
        />
        <Button
          v-if="situacao === 'aberto'"
          type="button"
          icon="ph ph-money"
          label="Adiantar"
          @click="modo = 'adiantar'"
        />
        <Button
          v-if="situacao === 'a-pagar'"
          type="button"
          icon="ph ph-check"
          :label="`Marcar ${reais(dados?.fechamento?.valor ?? 0)} como pago`"
          @click="pagar"
        />
        <Button
          v-if="situacao === 'pago'"
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-file-arrow-down"
          label="Recibo em PDF"
          @click="recibo"
        />
      </template>
      <template v-else>
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-arrow-left"
          label="Voltar"
          @click="modo = 'extrato'"
        />
        <Button
          v-if="modo === 'regra'"
          type="button"
          icon="ph ph-check"
          label="Salvar a regra"
          @click="salvarRegra"
        />
        <Button
          v-else
          type="button"
          icon="ph ph-check"
          label="Registrar adiantamento"
          @click="adiantar"
        />
      </template>
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.rg {
  display: grid;
  gap: 20px;
}

.rg__quem {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rg__iniciais {
  font-size: 13px;
  font-weight: 700;
}

.rg__quem-texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.rg__quem-texto strong {
  color: var(--tinta);
  font-size: 16px;
}

.rg__quem-texto span {
  color: var(--tinta-2);
  font-size: 13px;
}

.rg__vista {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rg__pcts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 8px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rg__pcts li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
}

.rg__pcts :deep(.p-inputnumber) {
  width: 5.5rem;
}

.rg__pcts :deep(input) {
  width: 100%;
  text-align: end;
}
</style>
