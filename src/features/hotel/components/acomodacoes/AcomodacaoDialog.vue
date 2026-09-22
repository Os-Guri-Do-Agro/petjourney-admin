<script setup lang="ts">
/**
 * Cadastro de uma acomodação.
 *
 * Configuração: acontece no dia da mudança, não todo dia. Por isso é um diálogo e não um painel
 * permanente — e por isso o formulário pode ser longo sem custar nada a quem opera.
 *
 * **Tirar de operação e remover são coisas diferentes, e a tela não as confunde.** Remover apaga
 * história: a estadia de março passaria a apontar para um lugar que não existe. O repositório
 * recusa, e aqui a ação de remover fica atrás de um confirmar próprio — quando a acomodação nunca
 * hospedou, que é o único caso em que apagar é honesto.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useHotelFormat } from '../../composables/useHotelFormat'
import type {
  Acomodacao,
  AcomodacaoInativaMotivo,
  AcomodacaoKind,
  Bloco,
  PetPorte,
  PetSpecies,
  RecursoDaAcomodacao,
  Tarifa,
} from '../../data/types'

const props = defineProps<{
  aberto: boolean
  /** `null` cria; preenchido edita. */
  acomodacao: Acomodacao | null
  blocos: Bloco[]
  tarifas: Tarifa[]
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  salvar: [
    payload: {
      nome: string
      blocoId: string
      kind: AcomodacaoKind
      capacidade: number
      porteMaximo: PetPorte
      especiesAceitas: PetSpecies[]
      recursos: RecursoDaAcomodacao[]
      higienizacaoMinutos: number
      tarifaId: string
    },
  ]
  desativar: [payload: { motivo: AcomodacaoInativaMotivo; detalhe: string }]
  reativar: []
  remover: []
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

const KINDS: AcomodacaoKind[] = ['baia', 'suite', 'gatil', 'coletiva', 'isolamento']
const PORTES: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']
const ESPECIES: PetSpecies[] = ['canina', 'felina', 'ave', 'roedor', 'reptil']
const RECURSOS: RecursoDaAcomodacao[] = [
  'camera',
  'climatizacao',
  'area-externa',
  'piso-aquecido',
  'janela',
]
const MOTIVOS: AcomodacaoInativaMotivo[] = [
  'manutencao',
  'desinfeccao',
  'reforma',
  'equipamento',
  'outro',
]

const nome = ref('')
const blocoId = ref('')
const kind = ref<AcomodacaoKind>('baia')
const capacidade = ref<number>(1)
const porteMaximo = ref<PetPorte>('grande')
const especies = ref<PetSpecies[]>(['canina'])
const recursos = ref<RecursoDaAcomodacao[]>([])
const higienizacao = ref<number>(60)
const tarifaId = ref('')

const motivoInativa = ref<AcomodacaoInativaMotivo>('manutencao')
const detalheInativa = ref('')
const confirmandoRemocao = ref(false)

const editando = computed(() => props.acomodacao !== null)
const podeSalvar = computed(
  () => nome.value.trim() !== '' && blocoId.value !== '' && tarifaId.value !== '',
)

watch(
  () => [props.aberto, props.acomodacao?.id],
  () => {
    if (!props.aberto) {
      return
    }

    const alvo = props.acomodacao

    nome.value = alvo?.nome ?? ''
    blocoId.value = alvo?.blocoId ?? props.blocos[0]?.id ?? ''
    kind.value = alvo?.kind ?? 'baia'
    capacidade.value = alvo?.capacidade ?? 1
    porteMaximo.value = alvo?.porteMaximo ?? 'grande'
    especies.value = alvo?.especiesAceitas ?? ['canina']
    recursos.value = alvo?.recursos ?? []
    higienizacao.value = alvo?.higienizacaoMinutos ?? 60
    tarifaId.value = alvo?.tarifaId ?? props.tarifas[0]?.id ?? ''
    motivoInativa.value = alvo?.motivoInativa ?? 'manutencao'
    detalheInativa.value = alvo?.detalheInativa ?? ''
    confirmandoRemocao.value = false
  },
  { immediate: true },
)

function salvar() {
  if (!podeSalvar.value) {
    return
  }

  emit('salvar', {
    nome: nome.value,
    blocoId: blocoId.value,
    kind: kind.value,
    capacidade: capacidade.value,
    porteMaximo: porteMaximo.value,
    especiesAceitas: especies.value,
    recursos: recursos.value,
    higienizacaoMinutos: higienizacao.value,
    tarifaId: tarifaId.value,
  })
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="editando ? t('hotel.acomodacoes.editar') : t('hotel.acomodacoes.nova')"
    :style="{ width: 'min(42rem, 94vw)' }"
    class="clinic-scope"
    @update:visible="emit('fechar')"
  >
    <div class="form">
      <!--
        Nove campos numa grade lisa não dizem em que ordem se pensa. Em três seções, cada linha
        tem um assunto só: o que é, quem cabe, quanto custa preparar e alugar.
      -->
      <section class="secao">
        <h3 class="secao__titulo">{{ t('hotel.acomodacoes.secaoIdentidade') }}</h3>

        <div class="grade">
          <div class="campo">
            <label :for="`${idCampo}-nome`">{{ t('hotel.acomodacoes.nome') }}</label>
            <InputText :id="`${idCampo}-nome`" v-model="nome" fluid />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-bloco`">{{ t('hotel.acomodacoes.bloco') }}</label>
            <Select
              :input-id="`${idCampo}-bloco`"
              v-model="blocoId"
              :options="blocos.map((item) => ({ valor: item.id, rotulo: item.nome }))"
              option-label="rotulo"
              option-value="valor"
              fluid
            />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-kind`">{{ t('hotel.acomodacoes.tipo') }}</label>
            <Select
              :input-id="`${idCampo}-kind`"
              v-model="kind"
              :options="
                KINDS.map((item) => ({ valor: item, rotulo: formato.acomodacaoKind(item) }))
              "
              option-label="rotulo"
              option-value="valor"
              fluid
            />
          </div>
        </div>
      </section>

      <section class="secao">
        <h3 class="secao__titulo">{{ t('hotel.acomodacoes.secaoQuemCabe') }}</h3>

        <div class="grade">
          <div class="campo">
            <label :for="`${idCampo}-cap`">{{ t('hotel.acomodacoes.capacidade') }}</label>
            <InputNumber
              :input-id="`${idCampo}-cap`"
              v-model="capacidade"
              :min="1"
              :max="8"
              show-buttons
              fluid
            />
            <small class="campo__dica">{{ t('hotel.acomodacoes.capacidadeDica') }}</small>
          </div>

          <div class="campo">
            <label :for="`${idCampo}-porte`">{{ t('hotel.acomodacoes.porteMaximo') }}</label>
            <Select
              :input-id="`${idCampo}-porte`"
              v-model="porteMaximo"
              :options="PORTES.map((item) => ({ valor: item, rotulo: formato.porte(item) }))"
              option-label="rotulo"
              option-value="valor"
              fluid
            />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-especies`">{{ t('hotel.acomodacoes.especies') }}</label>
            <MultiSelect
              :input-id="`${idCampo}-especies`"
              v-model="especies"
              :options="ESPECIES.map((item) => ({ valor: item, rotulo: formato.especie(item) }))"
              option-label="rotulo"
              option-value="valor"
              display="chip"
              fluid
            />
          </div>
        </div>
      </section>

      <section class="secao">
        <h3 class="secao__titulo">{{ t('hotel.acomodacoes.secaoPreco') }}</h3>

        <div class="grade">
          <div class="campo">
            <label :for="`${idCampo}-recursos`">{{ t('hotel.acomodacoes.recursos') }}</label>
            <MultiSelect
              :input-id="`${idCampo}-recursos`"
              v-model="recursos"
              :options="RECURSOS.map((item) => ({ valor: item, rotulo: formato.recurso(item) }))"
              option-label="rotulo"
              option-value="valor"
              display="chip"
              fluid
            />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-higiene`">{{ t('hotel.acomodacoes.higienizacao') }}</label>
            <InputNumber
              :input-id="`${idCampo}-higiene`"
              v-model="higienizacao"
              :min="0"
              :max="480"
              :step="15"
              suffix=" min"
              show-buttons
              fluid
            />
            <small class="campo__dica">{{ t('hotel.acomodacoes.higienizacaoDica') }}</small>
          </div>

          <div class="campo">
            <label :for="`${idCampo}-tarifa`">{{ t('hotel.acomodacoes.tarifa') }}</label>
            <Select
              :input-id="`${idCampo}-tarifa`"
              v-model="tarifaId"
              :options="tarifas.map((item) => ({ valor: item.id, rotulo: item.nome }))"
              option-label="rotulo"
              option-value="valor"
              fluid
            />
          </div>
        </div>
      </section>

      <!--
        Tirar de operação vive num bloco à parte, abaixo do cadastro: é uma decisão de outro tipo,
        e misturá-la aos campos faria alguém desativar uma baia querendo renomeá-la.
      -->
      <section v-if="editando" class="secao secao--operacao">
        <h3 class="secao__titulo">{{ t('hotel.acomodacoes.operacao') }}</h3>

        <template v-if="acomodacao?.ativa">
          <div class="grade">
            <div class="campo">
              <label :for="`${idCampo}-motivo`">{{ t('hotel.acomodacoes.motivo') }}</label>
              <Select
                :input-id="`${idCampo}-motivo`"
                v-model="motivoInativa"
                :options="
                  MOTIVOS.map((item) => ({ valor: item, rotulo: formato.motivoInativa(item) }))
                "
                option-label="rotulo"
                option-value="valor"
                fluid
              />
            </div>

            <div class="campo">
              <label :for="`${idCampo}-detalhe`">{{ t('hotel.acomodacoes.detalhe') }}</label>
              <InputText :id="`${idCampo}-detalhe`" v-model="detalheInativa" fluid />
            </div>
          </div>

          <Button
            class="secao__acao"
            :label="t('hotel.acomodacoes.desativar')"
            icon="pi pi-power-off"
            severity="secondary"
            outlined
            :loading="salvando"
            @click="emit('desativar', { motivo: motivoInativa, detalhe: detalheInativa })"
          />
        </template>

        <template v-else>
          <p class="operacao__estado">
            {{ formato.motivoInativa(acomodacao?.motivoInativa ?? 'outro') }}
            <template v-if="acomodacao?.detalheInativa">
              · {{ acomodacao.detalheInativa }}
            </template>
          </p>

          <Button
            class="secao__acao"
            :label="t('hotel.acomodacoes.reativar')"
            icon="pi pi-check-circle"
            severity="secondary"
            outlined
            :loading="salvando"
            @click="emit('reativar')"
          />
        </template>

        <!--
          Remover só existe para o que nunca hospedou — o repositório recusa o resto. O confirmar
          próprio existe porque a ação é irreversível e mora ao lado de outras que não são.
        -->
        <div class="operacao__remover">
          <Button
            v-if="!confirmandoRemocao"
            :label="t('hotel.acomodacoes.remover')"
            severity="danger"
            text
            size="small"
            @click="confirmandoRemocao = true"
          />

          <template v-else>
            <span class="operacao__pergunta">{{ t('hotel.acomodacoes.removerConfirma') }}</span>
            <Button
              :label="t('hotel.comum.cancelar')"
              severity="secondary"
              text
              size="small"
              @click="confirmandoRemocao = false"
            />
            <Button
              :label="t('hotel.acomodacoes.removerSim')"
              severity="danger"
              size="small"
              :loading="salvando"
              @click="emit('remover')"
            />
          </template>
        </div>
      </section>

      <Message v-if="erro" severity="error" :closable="false">{{ t(erro) }}</Message>
    </div>

    <template #footer>
      <Button
        :label="t('hotel.comum.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('hotel.comum.salvar')"
        icon="pi pi-check"
        :loading="salvando"
        :disabled="!podeSalvar"
        @click="salvar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.form {
  display: grid;
  gap: var(--clinic-space-4);
}

.grade {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.campo {
  display: grid;
  /*
   * As linhas ficam no topo, e é isso que alinha a grade.
   *
   * Sem `align-content`, as linhas automáticas de cada campo **esticam** para preencher a altura
   * da célula — e a célula tem a altura do campo mais alto da fileira, que é o que tem dica
   * embaixo. Resultado: "Porte máximo" e "Espécies aceitas" desciam em relação a "Capacidade", com
   * os rótulos alinhados e os campos não. Parecia grade torta; era alinhamento de conteúdo.
   */
  align-content: start;
  gap: 0.25rem;
}

.campo label {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.campo__dica {
  color: var(--clinic-faint);
  font-size: 0.7rem;
}

/*
 * Os chips quebram linha em vez de espremer.
 *
 * Numa coluna de 12rem, dois recursos selecionados não cabem lado a lado. O padrão do flex é
 * encolher, e o segundo chip perdia o próprio "x" de remover — ficava um rótulo cortado que não
 * dava para desmarcar. Quebrando, o campo cresce alguns pixels e cada chip continua inteiro.
 */
.campo :deep(.p-multiselect-label) {
  flex-wrap: wrap;
}

.campo :deep(.p-multiselect-label .p-chip) {
  flex: 0 0 auto;
}

.secao {
  display: grid;
  gap: var(--clinic-space-2);
}

/* Só a operação leva régua: ela separa cadastrar de tirar de operação, que é decisão de outro tipo. */
.secao--operacao {
  gap: var(--clinic-space-3);
  padding-top: var(--clinic-space-3);
  border-top: 1px solid var(--clinic-line-soft);
}

.secao__titulo {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/*
 * O botão não estica; a grade de campos, sim.
 *
 * Antes a seção inteira levava `justify-items: start` para segurar o botão, e isso encolhia
 * **também** a grade de "Motivo" e "Detalhe": os dois campos caíam num vão estreito à esquerda,
 * empilhados, com metade do diálogo vazia ao lado. Agora a exceção é do botão, não da seção.
 */
.secao__acao {
  justify-self: start;
}

.operacao__estado {
  margin: 0;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.operacao__remover {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
}

.operacao__pergunta {
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.operacao__remover :deep(.p-button) {
  flex: 0 0 auto;
}
</style>
