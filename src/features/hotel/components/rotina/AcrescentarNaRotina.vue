<script setup lang="ts">
/**
 * Acrescentar à rotina de **um** hóspede: quatro portas, e a diferença entre elas é o que importa.
 *
 * Até aqui só havia uma — medicação. O resto do que uma casa acrescenta no meio de uma estadia não
 * tinha lugar nenhum, e trabalho sem lugar acaba registrado no lugar errado.
 *
 * ## Por que quatro portas e não um campo livre
 *
 * As quatro guardam regras diferentes, e é justamente por isso que são quatro:
 *
 * - **Medicação** exige dose e via, e a receita é o respaldo de administrar o medicamento de outra
 *   pessoa. Sem esses campos não é medicação: é um texto que ninguém consegue conferir depois.
 * - **Ajuste dos horários da casa** mexe no que a casa já faz — água, higiene, passeio, pesagem —
 *   e só para aquele animal. Exige motivo, porque em dezembro ele é a única linha que explica a
 *   diferença.
 * - **Serviço extra** é vendido: entra na conta da estadia, e a tela diz o preço antes de gravar.
 * - **Cuidado** é o que não é nenhum dos três: curativo, compressa, casaco à noite. Não tem dose e
 *   não custa nada.
 *
 * Um campo de texto livre único resolveria a tela e destruiria as quatro regras: o remédio entraria
 * sem dose, o banho entraria sem ser cobrado, e a suspensão de passeio entraria sem motivo.
 *
 * ## A parede, de novo
 *
 * O caminho do **cuidado** é o que mais precisa dela: é tentador digitar "dar a pomada 3x ao dia"
 * ali. O tipo não tem campo de dose, a tela diz isso com todas as letras, e oferece a porta certa
 * a um clique. Não é uma trava — é a diferença entre dificultar e explicar.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { HospedeParaRotina } from '../../data/repositories'
import { TAREFAS_DA_CASA } from '../../data/types'
import type {
  ClockTime,
  ISODate,
  ItemDeRotina,
  Servico,
  TarefaDaCasaKind,
  ViaDeMedicacao,
} from '../../data/types'
import { escreverHorarios, lerHorarios } from '../../domain/rotina-padrao'

const props = defineProps<{
  aberto: boolean
  hospedes: HospedeParaRotina[]
  /** Quando já se sabe de quem é — aberto da ficha da estadia —, o seletor não aparece. */
  hospedagemId?: string
  /** A rotina da casa, para mostrar o que ela já faz ao lado do ajuste. */
  rotinaDaCasa: ItemDeRotina[]
  /** O catálogo, para o serviço extra saber o que existe e quanto custa. */
  servicos: Servico[]
  /** O dia de hoje na casa, para o serviço não nascer no passado. */
  hoje: ISODate
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  medicacao: [
    payload: {
      hospedagemId: string
      descricao: string
      via: ViaDeMedicacao
      doseTexto: string
      horarios: string[]
      receita: string
      observacao: string
    },
  ]
  ajuste: [
    payload: {
      hospedagemId: string
      kind: TarefaDaCasaKind
      horarios: ClockTime[]
      motivo: string
    },
  ]
  servico: [
    payload: {
      hospedagemId: string
      servicoId: string
      dia: ISODate
      hora: string
      observacao: string
    },
  ]
  cuidado: [
    payload: { hospedagemId: string; descricao: string; horarios: string[]; observacao: string },
  ]
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

type Via = 'medicacao' | 'ajuste' | 'servico' | 'cuidado'

const VIAS: Via[] = ['medicacao', 'ajuste', 'servico', 'cuidado']

/**
 * A chave de tradução de cada porta, escrita por extenso.
 *
 * Montar `hotel.acrescentar.via${via}` em tempo de execução funcionaria na tela e é **proibido**
 * aqui: chave composta não é encontrável por busca, escapa da verificação de paridade, e deixa um
 * idioma inteiro sem tradução sem nada acusar. `chaves-de-traducao.spec.ts` guarda essa regra — e
 * foi ele que pegou esta, que eu tinha escrito do jeito errado.
 */
const CHAVE_DA_VIA: Record<Via, { rotulo: string; dica: string }> = {
  medicacao: {
    rotulo: 'hotel.acrescentar.viaMedicacao',
    dica: 'hotel.acrescentar.viaMedicacaoDica',
  },
  ajuste: { rotulo: 'hotel.acrescentar.viaAjuste', dica: 'hotel.acrescentar.viaAjusteDica' },
  servico: { rotulo: 'hotel.acrescentar.viaServico', dica: 'hotel.acrescentar.viaServicoDica' },
  cuidado: { rotulo: 'hotel.acrescentar.viaCuidado', dica: 'hotel.acrescentar.viaCuidadoDica' },
}

/** O ícone de cada porta sai do próprio domínio — o mapa de ícones já existe e é um só. */
const KIND_DA_VIA: Record<Via, TarefaDaCasaKind | 'medicacao' | 'banho'> = {
  medicacao: 'medicacao',
  ajuste: 'agua',
  servico: 'banho',
  cuidado: 'higiene',
}

const via = ref<Via>('medicacao')
const hospede = ref('')

/* medicação */
const VIAS_DE_MEDICACAO: ViaDeMedicacao[] = [
  'oral',
  'topica',
  'otologica',
  'oftalmica',
  'subcutanea',
]
const medDescricao = ref('')
const medVia = ref<ViaDeMedicacao>('oral')
const medDose = ref('')
const medHorarios = ref('')
const medReceita = ref('')
const medObservacao = ref('')

/* ajuste */
const ajusteKind = ref<TarefaDaCasaKind>('agua')
const ajusteHorarios = ref('')
const ajusteMotivo = ref('')

/* serviço */
const servicoId = ref('')
const servicoDia = ref<Date | null>(null)
const servicoHora = ref('14:00')
const servicoObservacao = ref('')

/* cuidado */
const cuidadoDescricao = ref('')
const cuidadoHorarios = ref('')
const cuidadoObservacao = ref('')

const alvo = computed(() => props.hospedagemId || hospede.value)

const escolhido = computed(() => props.hospedes.find((item) => item.hospedagemId === alvo.value))

/** O que a casa faz deste serviço hoje. É o contexto que torna o ajuste uma decisão. */
const daCasa = computed(() =>
  props.rotinaDaCasa.find((item) => item.kind === ajusteKind.value && item.ativo),
)

/** Só o que vira tarefa de canil. Transporte e medicação assistida não entram — ver `HORA_DO_SERVICO`. */
const servicosOferecidos = computed(() =>
  props.servicos.filter(
    (item) =>
      item.ativo &&
      ['banho', 'tosa', 'passeio-extra', 'recreacao-individual', 'adestramento'].includes(
        item.kind,
      ),
  ),
)

const servicoEscolhido = computed(() => props.servicos.find((item) => item.id === servicoId.value))

/**
 * O primeiro dia que o serviço pode ocupar.
 *
 * Computado, e nao `new Date(...)` dentro do template: ali ele viraria um objeto novo a cada
 * renderizacao, e um `minDate` que muda de identidade a cada quadro faz o calendario se
 * reconstruir sem parar.
 */
const primeiroDia = computed(() => new Date(`${props.hoje}T12:00:00`))

const podeGravar = computed(() => {
  if (!alvo.value) return false

  if (via.value === 'medicacao') {
    return medDescricao.value.trim() !== '' && lerHorarios(medHorarios.value).length > 0
  }

  /* O ajuste aceita lista vazia — é assim que se suspende —, mas nunca motivo vazio. */
  if (via.value === 'ajuste') return ajusteMotivo.value.trim() !== ''

  if (via.value === 'servico') return servicoId.value !== '' && servicoDia.value !== null

  return cuidadoDescricao.value.trim() !== '' && lerHorarios(cuidadoHorarios.value).length > 0
})

watch(
  () => props.aberto,
  (aberto) => {
    if (!aberto) return

    via.value = 'medicacao'
    hospede.value = ''
    medDescricao.value = ''
    medVia.value = 'oral'
    medDose.value = ''
    medHorarios.value = '08:00, 20:00'
    medReceita.value = ''
    medObservacao.value = ''
    ajusteKind.value = 'agua'
    ajusteHorarios.value = ''
    ajusteMotivo.value = ''
    servicoId.value = ''
    servicoDia.value = null
    servicoHora.value = '14:00'
    servicoObservacao.value = ''
    cuidadoDescricao.value = ''
    cuidadoHorarios.value = ''
    cuidadoObservacao.value = ''
  },
)

/* Trocar o serviço do ajuste traz os horários que a casa já faz, como ponto de partida. */
watch(ajusteKind, () => {
  ajusteHorarios.value = escreverHorarios(daCasa.value?.horarios ?? [])
})

function gravar() {
  const hospedagemId = alvo.value

  if (!hospedagemId) return

  if (via.value === 'medicacao') {
    emit('medicacao', {
      hospedagemId,
      descricao: medDescricao.value.trim(),
      via: medVia.value,
      doseTexto: medDose.value.trim(),
      horarios: lerHorarios(medHorarios.value),
      receita: medReceita.value.trim(),
      observacao: medObservacao.value.trim(),
    })

    return
  }

  if (via.value === 'ajuste') {
    emit('ajuste', {
      hospedagemId,
      kind: ajusteKind.value,
      horarios: lerHorarios(ajusteHorarios.value),
      motivo: ajusteMotivo.value.trim(),
    })

    return
  }

  if (via.value === 'servico') {
    const dia = servicoDia.value

    if (!dia) return

    emit('servico', {
      hospedagemId,
      servicoId: servicoId.value,
      dia: `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}` as ISODate,
      hora: servicoHora.value,
      observacao: servicoObservacao.value.trim(),
    })

    return
  }

  emit('cuidado', {
    hospedagemId,
    descricao: cuidadoDescricao.value.trim(),
    horarios: lerHorarios(cuidadoHorarios.value),
    observacao: cuidadoObservacao.value.trim(),
  })
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.acrescentar.titulo')"
    :style="{ width: 'min(36rem, 94vw)' }"
    class="clinic-dialog hc-tema pj-lugar--hotel"
    @update:visible="emit('fechar')"
  >
    <div class="form">
      <!-- De quem é. Some quando o diálogo foi aberto de dentro da ficha de um animal. -->
      <div v-if="!hospedagemId" class="campo">
        <label :for="`${idCampo}-hospede`">{{ t('hotel.medicacaoNova.hospede') }}</label>

        <Select
          :input-id="`${idCampo}-hospede`"
          v-model="hospede"
          :options="hospedes"
          option-label="petNome"
          option-value="hospedagemId"
          size="small"
          fluid
          :pt="{ overlay: { class: 'clinic-overlay' } }"
        >
          <template #value>
            <span v-if="escolhido" class="opcao">
              <PetAvatar
                :nome="escolhido.petNome"
                :iniciais="escolhido.petIniciais"
                :especie="escolhido.petEspecie"
                :foto-url="escolhido.petFotoUrl"
                tamanho="sm"
              />
              <span class="opcao__nome">{{ escolhido.petNome }}</span>
              <span class="opcao__onde">{{ escolhido.acomodacaoNome }}</span>
            </span>

            <span v-else class="opcao opcao--vazia">
              {{ t('hotel.medicacaoNova.escolherHospede') }}
            </span>
          </template>

          <template #option="{ option }">
            <span class="opcao">
              <PetAvatar
                :nome="option.petNome"
                :iniciais="option.petIniciais"
                :especie="option.petEspecie"
                :foto-url="option.petFotoUrl"
                tamanho="sm"
              />
              <span class="opcao__nome">{{ option.petNome }}</span>
              <span class="opcao__onde">{{ option.acomodacaoNome }}</span>
            </span>
          </template>
        </Select>
      </div>

      <!--
        As quatro portas, com a dica de cada uma escrita ao lado. A dica não é enfeite: é o que
        impede alguém de registrar um banho como cuidado, ou uma pomada como cuidado em vez de
        medicação.
      -->
      <fieldset class="portas">
        <legend class="portas__titulo">{{ t('hotel.acrescentar.oQue') }}</legend>

        <label
          v-for="opcao in VIAS"
          :key="opcao"
          class="porta"
          :class="{ 'porta--ativa': via === opcao }"
        >
          <RadioButton v-model="via" :value="opcao" :input-id="`${idCampo}-${opcao}`" />

          <IconeDeTarefa :kind="KIND_DA_VIA[opcao]" class="porta__icone" />

          <span class="porta__texto">
            <strong>{{ t(CHAVE_DA_VIA[opcao].rotulo) }}</strong>
            <span class="porta__dica">{{ t(CHAVE_DA_VIA[opcao].dica) }}</span>
          </span>
        </label>
      </fieldset>

      <!-- ---------------------------------------------------------------- medicação -->
      <template v-if="via === 'medicacao'">
        <div class="campo">
          <label :for="`${idCampo}-med`">{{ t('hotel.medicacaoNova.descricao') }}</label>
          <InputText :id="`${idCampo}-med`" v-model="medDescricao" autocomplete="off" />
          <p class="campo__dica">{{ t('hotel.medicacaoNova.descricaoDica') }}</p>
        </div>

        <div class="dupla">
          <div class="campo">
            <label :for="`${idCampo}-via`">{{ t('hotel.medicacaoNova.via') }}</label>
            <Select
              :input-id="`${idCampo}-via`"
              v-model="medVia"
              :options="VIAS_DE_MEDICACAO"
              size="small"
              fluid
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            >
              <template #value="{ value }">{{ formato.via(value as ViaDeMedicacao) }}</template>
              <template #option="{ option }">{{ formato.via(option as ViaDeMedicacao) }}</template>
            </Select>
          </div>

          <div class="campo">
            <label :for="`${idCampo}-dose`">{{ t('hotel.medicacaoNova.dose') }}</label>
            <InputText :id="`${idCampo}-dose`" v-model="medDose" autocomplete="off" />
          </div>
        </div>

        <div class="campo">
          <label :for="`${idCampo}-medh`">{{ t('hotel.medicacaoNova.horarios') }}</label>
          <InputText :id="`${idCampo}-medh`" v-model="medHorarios" autocomplete="off" />
          <p class="campo__dica">{{ t('hotel.medicacaoNova.horariosDica') }}</p>

          <ul v-if="lerHorarios(medHorarios).length > 0" class="chips">
            <li v-for="hora in lerHorarios(medHorarios)" :key="hora" class="chip ui-num">
              {{ hora }}
            </li>
          </ul>
        </div>

        <div class="campo">
          <label :for="`${idCampo}-receita`">{{ t('hotel.medicacaoNova.receita') }}</label>
          <InputText :id="`${idCampo}-receita`" v-model="medReceita" autocomplete="off" />
          <p class="campo__dica">{{ t('hotel.medicacaoNova.receitaDica') }}</p>
        </div>

        <Message
          v-if="medDescricao.trim() !== '' && lerHorarios(medHorarios).length === 0"
          severity="warn"
          :closable="false"
        >
          {{ t('hotel.medicacaoNova.faltaHorario') }}
        </Message>
      </template>

      <!-- ---------------------------------------------------------------- ajuste da casa -->
      <template v-else-if="via === 'ajuste'">
        <div class="campo">
          <label :for="`${idCampo}-kind`">{{ t('hotel.acrescentar.ajusteServico') }}</label>
          <Select
            :input-id="`${idCampo}-kind`"
            v-model="ajusteKind"
            :options="TAREFAS_DA_CASA"
            size="small"
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          >
            <template #value="{ value }">{{
              formato.tarefaKind(value as TarefaDaCasaKind)
            }}</template>
            <template #option="{ option }">
              {{ formato.tarefaKind(option as TarefaDaCasaKind) }}
            </template>
          </Select>
        </div>

        <div class="campo">
          <label :for="`${idCampo}-ajh`">{{ t('hotel.acrescentar.ajusteHorarios') }}</label>
          <InputText :id="`${idCampo}-ajh`" v-model="ajusteHorarios" autocomplete="off" />

          <!-- O que a casa faz hoje, ao lado: é o que transforma o campo numa decisão. -->
          <p class="campo__dica">
            {{
              daCasa && daCasa.horarios.length > 0
                ? t('hotel.acrescentar.ajusteCasaFaz', {
                    horarios: escreverHorarios(daCasa.horarios),
                  })
                : t('hotel.acrescentar.ajusteCasaNaoFaz')
            }}
          </p>

          <p class="campo__dica">{{ t('hotel.acrescentar.ajusteVazio') }}</p>
        </div>

        <div class="campo">
          <label :for="`${idCampo}-motivo`">{{ t('hotel.acrescentar.motivo') }}</label>
          <InputText :id="`${idCampo}-motivo`" v-model="ajusteMotivo" autocomplete="off" />
          <p class="campo__dica">{{ t('hotel.acrescentar.motivoDica') }}</p>
        </div>

        <Message v-if="ajusteMotivo.trim() === ''" severity="warn" :closable="false">
          {{ t('hotel.acrescentar.faltaMotivo') }}
        </Message>
      </template>

      <!-- ---------------------------------------------------------------- serviço extra -->
      <template v-else-if="via === 'servico'">
        <div class="campo">
          <label :for="`${idCampo}-serv`">{{ t('hotel.acrescentar.servicoQual') }}</label>
          <Select
            :input-id="`${idCampo}-serv`"
            v-model="servicoId"
            :options="servicosOferecidos"
            option-label="id"
            option-value="id"
            size="small"
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          >
            <template #value>
              <span v-if="servicoEscolhido">{{ formato.servico(servicoEscolhido.kind) }}</span>
              <span v-else class="opcao--vazia">{{ t('hotel.acrescentar.servicoQual') }}</span>
            </template>
            <template #option="{ option }">
              <span class="servico">
                <span class="servico__nome">{{ formato.servico(option.kind) }}</span>
                <span class="servico__preco ui-num">
                  {{ formato.moeda(option.precoCentavos) }}
                </span>
              </span>
            </template>
          </Select>
        </div>

        <div class="dupla">
          <div class="campo">
            <label :for="`${idCampo}-dia`">{{ t('hotel.acrescentar.servicoDia') }}</label>
            <DatePicker
              panel-class="hc-tema"
              :input-id="`${idCampo}-dia`"
              v-model="servicoDia"
              :min-date="primeiroDia"
              date-format="dd/mm/yy"
              size="small"
              fluid
            />
          </div>

          <div class="campo">
            <label :for="`${idCampo}-hora`">{{ t('hotel.acrescentar.servicoHora') }}</label>
            <InputText :id="`${idCampo}-hora`" v-model="servicoHora" autocomplete="off" />
          </div>
        </div>

        <div class="campo">
          <label :for="`${idCampo}-sobs`">{{ t('hotel.medicacaoNova.observacao') }}</label>
          <InputText :id="`${idCampo}-sobs`" v-model="servicoObservacao" autocomplete="off" />
        </div>

        <!--
          O preço, antes de gravar. Acrescentar um serviço é vender: quem faz isso pelo telefone
          precisa saber quanto está combinando, e o responsável vai ver esse valor na saída.
        -->
        <p v-if="servicoEscolhido" class="cobra">
          <i class="ph ph-tag" aria-hidden="true" />
          {{
            t('hotel.acrescentar.servicoCobra', {
              preco: formato.moeda(servicoEscolhido.precoCentavos),
            })
          }}
        </p>
      </template>

      <!-- ---------------------------------------------------------------- cuidado -->
      <template v-else>
        <div class="campo">
          <label :for="`${idCampo}-cui`">{{ t('hotel.acrescentar.cuidadoOQue') }}</label>
          <InputText :id="`${idCampo}-cui`" v-model="cuidadoDescricao" autocomplete="off" />
          <p class="campo__dica">{{ t('hotel.acrescentar.cuidadoOQueDica') }}</p>
        </div>

        <div class="campo">
          <label :for="`${idCampo}-cuih`">{{ t('hotel.medicacaoNova.horarios') }}</label>
          <InputText :id="`${idCampo}-cuih`" v-model="cuidadoHorarios" autocomplete="off" />
          <p class="campo__dica">{{ t('hotel.medicacaoNova.horariosDica') }}</p>

          <ul v-if="lerHorarios(cuidadoHorarios).length > 0" class="chips">
            <li v-for="hora in lerHorarios(cuidadoHorarios)" :key="hora" class="chip ui-num">
              {{ hora }}
            </li>
          </ul>
        </div>

        <div class="campo">
          <label :for="`${idCampo}-cuio`">{{ t('hotel.medicacaoNova.observacao') }}</label>
          <Textarea :id="`${idCampo}-cuio`" v-model="cuidadoObservacao" rows="2" auto-resize />
        </div>

        <!--
          A parede, escrita e com a porta certa ao lado. Não é trava: quem quiser, digita "dar a
          pomada" aqui de qualquer jeito. O que a tela faz é explicar o que se perde ao fazer isso
          — a dose e a receita — e deixar o caminho certo a um clique.
        -->
        <p class="parede">
          <i class="ph ph-info" aria-hidden="true" />
          <span>
            {{ t('hotel.acrescentar.cuidadoNaoEhRemedio') }}
            <Button
              :label="t('hotel.acrescentar.cuidadoIrParaMedicacao')"
              severity="secondary"
              text
              size="small"
              @click="via = 'medicacao'"
            />
          </span>
        </p>
      </template>

      <p v-if="erro" class="erro">{{ erro }}</p>

      <!-- Nada nasce no passado — vale para as quatro portas. -->
      <p class="nota">{{ t('hotel.medicacaoNova.soDaquiParaFrente') }}</p>
    </div>

    <template #footer>
      <Button
        :label="t('hotel.acrescentar.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('hotel.acrescentar.acrescentar')"
        icon="ph ph-check"
        :loading="salvando"
        :disabled="!podeGravar"
        @click="gravar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.form {
  display: grid;
  gap: 18px;
}

.campo {
  display: grid;
  gap: 6px;
}

.campo label,
.portas__titulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.campo__dica {
  margin: 0;
  color: var(--tinta-3);
  font-size: 12.5px;
  line-height: 1.45;
}

.dupla {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr;
}

/* ------------------------------------------------------------------ as quatro portas */

/*
 * Lista vertical, e não um segmentado de quatro botões: cada porta carrega uma linha de dica, e a
 * dica é o que impede o registro errado — "Cuidado" sem "sem dose" ao lado é o convite a
 * registrar remédio ali.
 */
.portas {
  display: grid;
  margin: 0;
  padding: 0;
  border: 0;
  gap: 6px;
}

.portas__titulo {
  margin-bottom: 4px;
  padding: 0;
}

.porta {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 8px 12px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-controle);
  cursor: pointer;
}

.porta:hover {
  background: var(--superficie-2);
}

/* A escolhida se distingue por contorno na cor do hotel e fundo leve, nunca por cor cheia. */
.porta--ativa {
  border-color: var(--hotel);
  background: color-mix(in oklab, var(--hotel-fundo) 60%, var(--superficie));
}

.porta:has(:focus-visible) {
  outline: 2px solid var(--hotel);
  outline-offset: 2px;
}

.porta .porta__icone {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  color: var(--tinta-2);
}

.porta--ativa .porta__icone {
  color: var(--hotel-tinta);
}

.porta__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.porta__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.porta__dica {
  color: var(--tinta-2);
  font-size: 13px;
}

/* ------------------------------------------------------------------ miudezas */

.opcao {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.opcao--vazia {
  color: var(--tinta-3);
}

.opcao__nome {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.opcao__onde {
  margin-inline-start: auto;
  color: var(--tinta-2);
  font-size: 13px;
}

.servico {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
}

.servico__nome {
  flex: 1;
}

.servico__preco {
  color: var(--tinta-2);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  gap: 6px;
  list-style: none;
}

.chip {
  padding: 3px 10px;
  border-radius: 7px;
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
  font-size: 13.5px;
  font-weight: 600;
}

/* O preço fala pelo ícone e pela cor do texto — a superfície não se pinta. */
.cobra {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--atencao-tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.parede {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--raio-controle);
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.parede .ph,
.cobra .ph {
  margin-top: 2px;
  font-size: 15px;
}

.nota {
  margin: 0;
  color: var(--tinta-3);
  font-size: 12.5px;
}

.erro {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--raio-controle);
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 600;
}

@media (max-width: 620px) {
  .dupla {
    grid-template-columns: 1fr;
  }
}
</style>
