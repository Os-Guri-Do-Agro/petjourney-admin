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
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useHotelFormat } from '../../composables/useHotelFormat'
import type {
  Acomodacao,
  AcomodacaoInativaMotivo,
  Bloco,
  TipoDeAcomodacao,
  PetPorte,
  PetSpecies,
  RecursoDaAcomodacao,
  Tarifa,
} from '../../data/types'

const props = defineProps<{
  aberto: boolean
  /** `null` cria; preenchido edita. */
  acomodacao: Acomodacao | null
  /**
   * O corredor em que a criação começa.
   *
   * Quem toca no "+" de dentro do Canil B está dizendo onde quer a vaga. Sem isto, o diálogo
   * abria no primeiro corredor da lista e a pessoa criava a baia no lugar errado sem perceber —
   * um campo já preenchido é um campo que ninguém relê.
   */
  blocoSugerido?: string
  blocos: Bloco[]
  /** Os tipos que a casa cadastrou. O nome de cada um é dela. */
  tipos: TipoDeAcomodacao[]
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
      tipoId: string
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

const PORTES: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']
/*
 * Todas as espécies que o cadastro do portal conhece.
 *
 * A lista anterior parava em réptil e deixava "equina" de fora sem motivo — e uma espécie que o
 * domínio tem e a tela esconde é uma hospedagem que a casa não consegue cadastrar.
 */
const ESPECIES: PetSpecies[] = ['canina', 'felina', 'ave', 'roedor', 'reptil', 'equina']
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
const tipoId = ref('')
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
    blocoId.value = alvo?.blocoId ?? props.blocoSugerido ?? props.blocos[0]?.id ?? ''
    tipoId.value = alvo?.tipoId ?? props.tipos[0]?.id ?? ''
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
    tipoId: tipoId.value,
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
    :style="{ width: 'min(44rem, 94vw)' }"
    class="clinic-scope pj-lugar--hotel"
    @update:visible="emit('fechar')"
  >
    <div class="form">
      <!--
        Nove campos numa grade lisa não dizem em que ordem se pensa. Em três grupos, cada linha tem
        um assunto só: o que é, quem cabe, quanto custa preparar e alugar.
      -->
      <section class="grupo">
        <h3 class="grupo__titulo">
          <i class="ph ph-tag-simple" aria-hidden="true" />
          {{ t('hotel.acomodacoes.secaoIdentidade') }}
        </h3>

        <div class="grade">
          <div class="campo">
            <label :for="`${idCampo}-nome`">{{ t('hotel.acomodacoes.nome') }}</label>
            <InputText :id="`${idCampo}-nome`" v-model="nome" autocomplete="off" fluid />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-bloco`">{{ t('hotel.acomodacoes.corredor.rotulo') }}</label>
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
            <label :for="`${idCampo}-kind`">{{ t('hotel.acomodacoes.tipo.rotulo') }}</label>
            <Select
              :input-id="`${idCampo}-kind`"
              v-model="tipoId"
              :options="tipos.map((item) => ({ valor: item.id, rotulo: item.nome }))"
              option-label="rotulo"
              option-value="valor"
              fluid
            />
          </div>
        </div>
      </section>

      <section class="grupo">
        <h3 class="grupo__titulo">
          <i class="ph ph-paw-print" aria-hidden="true" />
          {{ t('hotel.acomodacoes.secaoQuemCabe') }}
        </h3>

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

      <section class="grupo">
        <h3 class="grupo__titulo">
          <i class="ph ph-coins" aria-hidden="true" />
          {{ t('hotel.acomodacoes.secaoPreco') }}
        </h3>

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
        Tirar de operação vive numa caixa à parte, abaixo do cadastro: é uma decisão de outro tipo,
        e misturá-la aos campos faria alguém desativar uma baia querendo renomeá-la.
      -->
      <section
        v-if="editando"
        class="operacao"
        :class="{ 'operacao--parada': !acomodacao?.ativa }"
      >
        <header class="operacao__cabeca">
          <span class="operacao__icone" aria-hidden="true">
            <i :class="acomodacao?.ativa ? 'ph ph-power' : 'ph ph-wrench'" />
          </span>
          <span class="operacao__titulos">
            <h3 class="operacao__titulo">{{ t('hotel.acomodacoes.operacao') }}</h3>
            <span class="operacao__estado">
              <template v-if="acomodacao?.ativa">{{ t('hotel.casa.dialogo.emOperacao') }}</template>
              <template v-else>
                {{ formato.motivoInativa(acomodacao?.motivoInativa ?? 'outro') }}
                <template v-if="acomodacao?.detalheInativa">
                  · {{ acomodacao.detalheInativa }}
                </template>
              </template>
            </span>
          </span>
        </header>

        <template v-if="acomodacao?.ativa">
          <div class="grade grade--dupla">
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
        </template>

        <div class="operacao__acoes">
          <Button
            v-if="acomodacao?.ativa"
            type="button"
            :label="t('hotel.acomodacoes.desativar')"
            icon="ph ph-power"
            severity="secondary"
            outlined
            :loading="salvando"
            @click="emit('desativar', { motivo: motivoInativa, detalhe: detalheInativa })"
          />
          <Button
            v-else
            type="button"
            :label="t('hotel.acomodacoes.reativar')"
            icon="ph ph-check-circle"
            severity="secondary"
            outlined
            :loading="salvando"
            @click="emit('reativar')"
          />

          <!--
            Remover só existe para o que nunca hospedou — o repositório recusa o resto. O confirmar
            próprio existe porque a ação é irreversível e mora ao lado de outras que não são.
          -->
          <span class="operacao__remover">
            <Button
              v-if="!confirmandoRemocao"
              type="button"
              :label="t('hotel.acomodacoes.remover')"
              icon="ph ph-trash"
              severity="danger"
              text
              @click="confirmandoRemocao = true"
            />

            <template v-else>
              <span class="operacao__pergunta">{{ t('hotel.acomodacoes.removerConfirma') }}</span>
              <Button
                type="button"
                :label="t('hotel.comum.cancelar')"
                severity="secondary"
                text
                @click="confirmandoRemocao = false"
              />
              <Button
                type="button"
                :label="t('hotel.acomodacoes.removerSim')"
                severity="danger"
                :loading="salvando"
                @click="emit('remover')"
              />
            </template>
          </span>
        </div>
      </section>

      <p v-if="erro" class="erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t(erro) }}
      </p>
    </div>

    <template #footer>
      <Button
        type="button"
        :label="t('hotel.comum.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        type="button"
        :label="t('hotel.comum.salvar')"
        icon="ph ph-check"
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
  gap: 22px;
}

.grupo {
  display: grid;
  gap: 12px;
}

.grupo + .grupo {
  padding-top: 20px;
  border-top: 1px solid var(--linha);
}

.grupo__titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.grupo__titulo i {
  color: var(--hotel-tinta);
  font-size: 18px;
}

.grade {
  display: grid;
  gap: 14px 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
}

.grade--dupla {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
}

.campo {
  display: grid;
  /*
   * As linhas ficam no topo, e é isso que alinha a grade: sem `align-content`, as linhas de cada
   * campo esticam até a altura do campo mais alto da fileira — o que tem dica embaixo — e os
   * campos vizinhos descem em relação aos rótulos.
   */
  align-content: start;
  gap: 6px;
}

.campo label {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.campo__dica {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
}

/*
 * O rótulo do Select vem do PrimeVue em 1rem, por cima do tamanho do `.clinic-scope` que os
 * outros campos usam: "Canil A" saía maior e 2 px mais alto que o "Baia A1" ao lado, na mesma
 * fileira. Herdar devolve a mesma letra e a mesma altura a todos os campos.
 */
.campo :deep(.p-select-label) {
  font-size: inherit;
}

/*
 * Os chips quebram linha em vez de espremer: numa coluna de 12rem, dois recursos não cabem lado a
 * lado, e o segundo chip perdia o próprio "x" de remover.
 */
.campo :deep(.p-multiselect-label) {
  flex-wrap: wrap;
}

.campo :deep(.p-multiselect-label .p-chip) {
  flex: 0 0 auto;
}

/* ---- operação: caixa à parte, porque é decisão de outro tipo */

.operacao {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie-2);
}

.operacao--parada {
  border-style: dashed;
  border-color: var(--linha-forte);
}

.operacao__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
}

.operacao__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 18px;
}

.operacao--parada .operacao__icone {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.operacao__titulos {
  display: grid;
  gap: 1px;
}

.operacao__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.operacao__estado {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.operacao--parada .operacao__estado {
  color: var(--atencao-tinta);
  font-weight: 600;
}

.operacao__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.operacao__remover {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-inline-start: auto;
}

.operacao__pergunta {
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.erro {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 500;
}

.erro i {
  flex: none;
  font-size: 18px;
}
</style>
