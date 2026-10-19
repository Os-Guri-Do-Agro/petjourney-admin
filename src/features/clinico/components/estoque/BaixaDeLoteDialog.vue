<script setup lang="ts">
/**
 * Dar baixa num lote: a dose que saiu da geladeira sem entrar em paciente.
 *
 * Sem este caminho, o frasco que caiu no chão continuava "na geladeira" até alguém tentar aplicá-lo
 * — e a perda só aparecia na contagem do fim do ano, sem motivo, sem data e sem nome.
 *
 * Os quatro motivos fazem perguntas diferentes, e o formulário muda com eles:
 *
 * - **Quebra, temperatura, vencimento** perguntam "quantas doses saíram".
 * - **Contagem** pergunta "quantas doses você achou". Quem conta a geladeira sabe o número que tem
 *   na mão, não a diferença — fazer a pessoa subtrair de cabeça é convidar o erro que a contagem
 *   existe para achar. A diferença aparece embaixo, escrita.
 *
 * O lote vencido abre no motivo "vencimento" com o saldo inteiro preenchido: descartar o frasco
 * vencido é a baixa mais comum, e é um clique.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicDateField from '../base/ClinicDateField.vue'
import ClinicField from '../base/ClinicField.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoEstoque } from '../../composables/useRotulosDoEstoque'
import { estoqueRepository, EstoqueRecusadoError } from '../../data/repositories'
import type { MotivoDePerda } from '../../data/types'
import type { LoteNoEstoque } from '../../domain/estoque-vacinas'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  visivel: boolean
  lote: LoteNoEstoque | null
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  registrada: []
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoEstoque()
const clinico = useClinicoStore()

const ptDoOverlay = { overlay: { class: 'clinic-overlay hc-tema' } }

const MOTIVOS: MotivoDePerda[] = ['quebra', 'temperatura', 'vencimento', 'contagem']

const motivo = ref<MotivoDePerda>('quebra')
const quantidade = ref<number | null>(null)
const contadas = ref<number | null>(null)
const em = ref('')
const registradaPor = ref<string | null>(null)
const observacao = ref('')
const salvando = ref(false)
const erro = ref('')

const hoje = computed(() => clinicClock.today())
const saldo = computed(() => props.lote?.saldo ?? 0)
const contagem = computed(() => motivo.value === 'contagem')

const opcoesMotivo = computed(() =>
  MOTIVOS.map((valor) => ({ valor, rotulo: t(`clinico.vacinas.estoque.perda.${valor}`) })),
)

const opcoesQuem = computed(() =>
  clinico.profissionais
    .filter((item) => item.ativo)
    .map((item) => ({ valor: item.id, rotulo: item.nome })),
)

watch(
  () => [props.visivel, props.lote?.id] as const,
  ([visivel]) => {
    if (!visivel || !props.lote) {
      return
    }

    const vencido = props.lote.situacao === 'vencido'

    motivo.value = vencido ? 'vencimento' : 'quebra'
    quantidade.value = vencido ? props.lote.saldo : null
    contadas.value = null
    em.value = hoje.value
    registradaPor.value = opcoesQuem.value[0]?.valor ?? null
    observacao.value = ''
    erro.value = ''
  },
  { immediate: true },
)

/** As doses que a baixa vai tirar, nos dois modos — é o número que a frase de baixo escreve. */
const doses = computed(() => {
  if (contagem.value) {
    return contadas.value === null ? null : saldo.value - contadas.value
  }

  return quantidade.value
})

const avisoDaContagem = computed(() => {
  if (!contagem.value || contadas.value === null) {
    return ''
  }

  if (contadas.value > saldo.value) {
    return t('clinico.estoque.recusa.contagem-acima-do-saldo')
  }

  return contadas.value === saldo.value ? t('clinico.estoque.baixa.confere') : ''
})

const pode = computed(
  () =>
    Boolean(props.lote) &&
    Boolean(em.value) &&
    Boolean(registradaPor.value) &&
    doses.value !== null &&
    doses.value > 0 &&
    doses.value <= saldo.value,
)

async function registrar() {
  erro.value = ''

  if (!pode.value || !props.lote || !registradaPor.value) {
    return
  }

  salvando.value = true

  try {
    await estoqueRepository.registrarBaixa({
      loteId: props.lote.id,
      motivo: motivo.value,
      quantidade: quantidade.value ?? 0,
      contadas: contagem.value ? contadas.value : null,
      em: em.value,
      registradaPor: registradaPor.value,
      observacao: observacao.value,
    })

    emit('registrada')
    emit('update:visivel', false)
  } catch (falha) {
    erro.value =
      falha instanceof EstoqueRecusadoError
        ? t(`clinico.estoque.recusa.${falha.kind}`)
        : t('clinico.estoque.erroAoSalvar')
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(36rem, 94vw)' }"
    :dismissable-mask="!salvando"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"
          ><i class="ph ph-minus-circle"
        /></span>
        {{ t('clinico.estoque.baixa.titulo', { lote: lote?.codigo ?? '' }) }}
      </h2>
    </template>

    <form v-if="lote" class="baixa clinic-scope" @submit.prevent="registrar">
      <p class="baixa__lote">
        <strong>{{ lote.vacinaNome }}</strong>
        {{
          t('clinico.estoque.baixa.saldoAgora', {
            saldo: rotulos.doses(lote.saldo),
            validade: formato.dataCurta(lote.validade),
          })
        }}
      </p>

      <ClinicField :rotulo="t('clinico.estoque.baixa.motivo')" obrigatorio>
        <ClinicToggleGroup
          v-model="motivo"
          :opcoes="opcoesMotivo"
          :rotulo="t('clinico.estoque.baixa.motivo')"
        />
      </ClinicField>

      <p class="baixa__explica">
        <i class="ph ph-info" aria-hidden="true" />
        {{ t(`clinico.estoque.baixa.explica.${motivo}`) }}
      </p>

      <div class="baixa__linha">
        <ClinicField
          v-if="contagem"
          :rotulo="t('clinico.estoque.baixa.contadas')"
          obrigatorio
          :erro="contadas !== null && contadas > lote.saldo ? avisoDaContagem : ''"
        >
          <template #default="{ id, descrito }">
            <InputNumber
              v-model="contadas"
              :input-id="id"
              :min="0"
              fluid
              :aria-describedby="descrito"
            />
          </template>
        </ClinicField>

        <ClinicField v-else :rotulo="t('clinico.estoque.baixa.quantidade')" obrigatorio>
          <template #default="{ id }">
            <InputNumber v-model="quantidade" :input-id="id" :min="1" :max="lote.saldo" fluid />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.estoque.baixa.quando')" obrigatorio>
          <template #default="{ id }">
            <ClinicDateField v-model="em" :input-id="id" :min="lote.recebidoEm" :max="hoje" />
          </template>
        </ClinicField>
      </div>

      <!-- A diferença escrita, e nunca deixada para a pessoa calcular. -->
      <p
        v-if="doses !== null && doses > 0 && doses <= lote.saldo"
        class="baixa__resultado"
        role="status"
      >
        {{
          t('clinico.estoque.baixa.resultado', {
            doses: rotulos.doses(doses),
            valor: formato.moeda(doses * lote.custoUnitario),
            saldo: lote.saldo - doses,
          })
        }}
      </p>
      <p
        v-else-if="contagem && contadas === lote.saldo"
        class="baixa__resultado baixa__resultado--ok"
        role="status"
      >
        <i class="ph ph-check" aria-hidden="true" />
        {{ avisoDaContagem }}
      </p>

      <div class="baixa__linha">
        <ClinicField :rotulo="t('clinico.estoque.baixa.quem')" obrigatorio>
          <template #default="{ id }">
            <Select
              v-model="registradaPor"
              :input-id="id"
              :options="opcoesQuem"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="ptDoOverlay"
            />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.estoque.baixa.observacao')">
          <template #default="{ id }">
            <InputText
              :id="id"
              v-model="observacao"
              :placeholder="t(`clinico.estoque.baixa.observacaoDica.${motivo}`)"
              fluid
            />
          </template>
        </ClinicField>
      </div>

      <Message v-if="erro" severity="error" :closable="false">{{ erro }}</Message>
    </form>

    <template #footer>
      <Button
        :label="t('clinico.comum.cancelar')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="emit('update:visivel', false)"
      />
      <Button
        :label="t('clinico.estoque.baixa.confirmar')"
        icon="ph ph-check"
        class="clinic-acao-principal"
        :loading="salvando"
        :disabled="!pode"
        @click="registrar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.baixa {
  display: grid;
  gap: var(--clinic-space-3);
}

.baixa__lote {
  margin: 0;
  color: var(--clinic-muted);
  font-size: 13px;
}

.baixa__lote strong {
  color: var(--clinic-text);
}

.baixa__linha {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.baixa__explica,
.baixa__resultado {
  display: flex;
  align-items: baseline;
  margin: 0;
  gap: 0.4rem;
  color: var(--clinic-muted);
  font-size: 13px;
  line-height: 1.45;
}

.baixa__explica {
  margin-top: calc(var(--clinic-space-2) * -1);
}

.baixa__resultado {
  color: var(--clinic-text);
  font-weight: 650;
}

.baixa__resultado--ok i {
  color: var(--clinic-accent-strong);
}

@media (max-width: 620px) {
  .baixa__linha {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
