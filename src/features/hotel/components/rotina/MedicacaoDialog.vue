<script setup lang="ts">
/**
 * Registrar o remédio que chegou com o hóspede.
 *
 * ## Por que existe fora do check-in
 *
 * O check-in já pergunta pela medicação de casa, e ele resolve o caso comum: o animal chega com a
 * caixa na sacola. O caso que ficava sem lugar é o outro — **o remédio que aparece depois**. O
 * responsável volta à tarde com a receita que esqueceu, o veterinário da casa prescreve na terceira
 * noite, a dose muda. Em qualquer um deles a estadia já está aberta e o check-in não abre mais.
 *
 * Sem esta porta, a saída era anotar no campo de observação — que não vira tarefa, não aparece na
 * ronda e não é conferido por ninguém. O remédio existia no papel e não existia no trabalho.
 *
 * ## Transcrever não é prescrever
 *
 * Os campos daqui são editáveis porque isto é **transcrição de uma receita que já existe**, feita
 * por uma pessoa que está com o papel na mão. É o contrário da sugestão automática de rotina, que
 * nunca compõe medicação e a mostra apenas como leitura: lá a máquina propõe, e propor dose seria
 * prescrever. Aqui quem digita é quem assina, e a receita é campo do formulário justamente para
 * ficar registrado de quem veio a ordem.
 *
 * ## Duas decisões herdadas do check-in
 *
 * - **Horário ausente trava.** Medicação sem horário não gera dose nenhuma e some — a pessoa
 *   escreveu o nome do remédio e o silêncio faria o animal passar a estadia sem tomá-lo.
 * - **Receita vazia não trava.** O remédio é dado do mesmo jeito e a pendência fica na ficha.
 *   Travar aqui ensinaria a recepção a inventar um número de CRMV para poder sair da tela.
 *
 * `inicio` e `fim` não são perguntados, pelo mesmo motivo do check-in: o padrão é a estadia inteira,
 * e suspender no meio já existe na tela da estadia, que é onde essa decisão de fato acontece.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { HospedeParaRotina } from '../../data/repositories'
import type { ViaDeMedicacao } from '../../data/types'
import { lerHorarios } from '../../domain/rotina-padrao'

const props = defineProps<{
  aberto: boolean
  /** Quem está na casa agora. Quem saiu não recebe medicação nova. */
  hospedes: HospedeParaRotina[]
  /**
   * De quem é o remédio, quando já se sabe.
   *
   * Aberto pela ficha da estadia o hóspede já está decidido, e perguntar de novo é oferecer à
   * pessoa a chance de escolher o animal errado numa tela que existe por causa deste animal.
   */
  hospedagemId?: string
  salvando: boolean
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  registrar: [
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
}>()

const { t } = useI18n()
const formato = useHotelFormat()
const idCampo = useId()

const VIAS: ViaDeMedicacao[] = ['oral', 'topica', 'otologica', 'oftalmica', 'subcutanea']

const escolhido = ref('')
const descricao = ref('')
const via = ref<ViaDeMedicacao>('oral')
const dose = ref('')
const texto = ref('')
const receita = ref('')
const observacao = ref('')

/** O hóspede que a prop fixou, ou o que a pessoa escolheu na lista. */
const alvo = computed(() => props.hospedagemId || escolhido.value)

const hospedeEscolhido = computed(() =>
  props.hospedes.find((item) => item.hospedagemId === alvo.value),
)

/** Os horários são digitados como se ditam ao telefone: "8:00, 20:00". */
const horarios = computed(() => lerHorarios(texto.value))

/**
 * Só avisa depois que há um remédio escrito.
 *
 * O formulário nasce inteiro vazio, e um aviso em vermelho antes do primeiro caractere é ruído que
 * a pessoa aprende a ignorar — inclusive quando ele passa a ter razão.
 */
const faltaHorario = computed(() => descricao.value.trim() !== '' && horarios.value.length === 0)

const podeRegistrar = computed(
  () => alvo.value !== '' && descricao.value.trim() !== '' && horarios.value.length > 0,
)

watch(
  () => props.aberto,
  (aberto) => {
    if (!aberto) {
      return
    }

    escolhido.value = ''
    descricao.value = ''
    via.value = 'oral'
    dose.value = ''
    texto.value = ''
    receita.value = ''
    observacao.value = ''
  },
)

function registrar() {
  if (!podeRegistrar.value) {
    return
  }

  emit('registrar', {
    hospedagemId: alvo.value,
    descricao: descricao.value.trim(),
    via: via.value,
    doseTexto: dose.value.trim(),
    horarios: horarios.value,
    receita: receita.value.trim(),
    observacao: observacao.value.trim(),
  })
}
</script>

<template>
  <Dialog
    :visible="aberto"
    modal
    :header="t('hotel.medicacaoNova.titulo')"
    :style="{ width: 'min(34rem, 94vw)' }"
    class="clinic-dialog"
    @update:visible="emit('fechar')"
  >
    <div class="medicacao">
      <div v-if="!hospedagemId" class="campo">
        <label :for="`${idCampo}-hospede`">{{ t('hotel.medicacaoNova.hospede') }}</label>

        <Select
          :input-id="`${idCampo}-hospede`"
          v-model="escolhido"
          :options="hospedes"
          option-label="petNome"
          option-value="hospedagemId"
          :placeholder="t('hotel.medicacaoNova.escolherHospede')"
          :pt="{ overlay: { class: 'clinic-overlay' } }"
          scroll-height="18rem"
          fluid
        >
          <!--
            O rosto do animal também no valor recolhido: sem ele, abrir a lista trocava a forma do
            que se estava lendo, e a conferência de "é este mesmo?" acontece com a lista fechada.
            O `v-else` devolve o texto de convite, que o slot de valor substitui.
          -->
          <template #value>
            <span v-if="hospedeEscolhido" class="hospede">
              <PetAvatar
                :nome="hospedeEscolhido.petNome"
                :iniciais="hospedeEscolhido.petIniciais"
                :especie="hospedeEscolhido.petEspecie"
                :foto-url="hospedeEscolhido.petFotoUrl"
                tamanho="xs"
              />
              <span class="hospede__nome">{{ hospedeEscolhido.petNome }}</span>
              <span class="hospede__onde">{{ hospedeEscolhido.acomodacaoNome }}</span>
            </span>

            <span v-else class="hospede__vazio">
              {{ t('hotel.medicacaoNova.escolherHospede') }}
            </span>
          </template>

          <!--
            A fileira é montada dentro do slot, e não solta: o painel do Select é teleportado para
            fora da página, então `:deep` daqui não o alcança — o que alcança é o conteúdo do slot,
            que carrega o atributo de escopo consigo.
          -->
          <template #option="{ option }">
            <span class="hospede">
              <PetAvatar
                :nome="option.petNome"
                :iniciais="option.petIniciais"
                :especie="option.petEspecie"
                :foto-url="option.petFotoUrl"
                tamanho="xs"
              />
              <span class="hospede__nome">{{ option.petNome }}</span>
              <span class="hospede__onde">{{ option.acomodacaoNome }}</span>
            </span>
          </template>
        </Select>
      </div>

      <div class="campo">
        <label :for="`${idCampo}-descricao`">{{ t('hotel.medicacaoNova.descricao') }}</label>
        <InputText :id="`${idCampo}-descricao`" v-model="descricao" autocomplete="off" fluid />
        <p class="campo__dica">{{ t('hotel.medicacaoNova.descricaoDica') }}</p>
      </div>

      <div class="grade">
        <div class="campo">
          <label :for="`${idCampo}-via`">{{ t('hotel.medicacaoNova.via') }}</label>
          <!--
            O rótulo sai de `formato.via` — é a única camada autorizada a virar `kind` em frase, e
            é a mesma que o check-in e a ficha da estadia usam para as mesmas cinco vias.
          -->
          <Select
            :input-id="`${idCampo}-via`"
            v-model="via"
            :options="VIAS.map((item) => ({ valor: item, rotulo: formato.via(item) }))"
            option-label="rotulo"
            option-value="valor"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
            fluid
          />
        </div>

        <div class="campo">
          <label :for="`${idCampo}-dose`">{{ t('hotel.medicacaoNova.dose') }}</label>
          <InputText :id="`${idCampo}-dose`" v-model="dose" autocomplete="off" fluid />
          <p class="campo__dica">{{ t('hotel.medicacaoNova.doseDica') }}</p>
        </div>
      </div>

      <div class="campo">
        <label :for="`${idCampo}-horarios`">{{ t('hotel.medicacaoNova.horarios') }}</label>
        <InputText
          :id="`${idCampo}-horarios`"
          v-model="texto"
          autocomplete="off"
          placeholder="08:00, 20:00"
          fluid
        />
        <p class="campo__dica">{{ t('hotel.medicacaoNova.horariosDica') }}</p>
      </div>

      <!--
        A leitura do que foi digitado, já ordenada e sem repetidos. É o que de fato vira dose, e
        vê-lo antes de gravar é o que torna seguro um campo de texto livre.
      -->
      <ul v-if="horarios.length > 0" class="chips">
        <li v-for="hora in horarios" :key="hora" class="chip clinic-value">{{ hora }}</li>
      </ul>

      <Message v-if="faltaHorario" severity="warn" :closable="false">
        {{ t('hotel.medicacaoNova.faltaHorario') }}
      </Message>

      <div class="campo">
        <label :for="`${idCampo}-receita`">{{ t('hotel.medicacaoNova.receita') }}</label>
        <InputText :id="`${idCampo}-receita`" v-model="receita" autocomplete="off" fluid />
        <p class="campo__dica">{{ t('hotel.medicacaoNova.receitaDica') }}</p>
      </div>

      <div class="campo">
        <label :for="`${idCampo}-observacao`">{{ t('hotel.medicacaoNova.observacao') }}</label>
        <Textarea :id="`${idCampo}-observacao`" v-model="observacao" rows="2" auto-resize fluid />
      </div>

      <Message v-if="erro" severity="error" :closable="false">{{ t(erro) }}</Message>

      <!--
        A regra de que nada nasce no passado, escrita **antes** de a pessoa gravar.
        Quem registra às 19h um remédio de 8:00 e 20:00 espera duas doses hoje; nasce uma, e a
        diferença precisa ter sido dita aqui e não descoberta na prancheta.
      -->
      <p class="nota">{{ t('hotel.medicacaoNova.soDaquiParaFrente') }}</p>
    </div>

    <template #footer>
      <Button
        :label="t('hotel.medicacaoNova.cancelar')"
        severity="secondary"
        text
        size="small"
        @click="emit('fechar')"
      />
      <Button
        :label="t('hotel.medicacaoNova.registrar')"
        icon="pi pi-check"
        size="small"
        :loading="salvando"
        :disabled="!podeRegistrar"
        @click="registrar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.medicacao {
  display: grid;
  gap: var(--clinic-space-4);
}

.grade {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
}

.campo {
  display: grid;
  /* Linhas no topo: sem isto, o campo ao lado de um mais alto desce e a fileira sai torta. */
  align-content: start;
  gap: var(--clinic-space-2);
}

.campo label {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.campo__dica {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/* A fileira do hóspede: rosto, nome e onde ele está — a acomodação é o que separa duas Meis. */
.hospede {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-base);
}

.hospede__nome {
  color: var(--clinic-text);
  font-weight: 700;
}

.hospede__onde {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.hospede__vazio {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-base);
}

/* Os horários lidos, como pastilhas: é a confirmação visual do que o texto virou. */
.chips {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  gap: var(--clinic-space-2);
  list-style: none;
}

.chip {
  padding: 0.15rem var(--clinic-space-3);
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.nota {
  margin: 0;
  padding-top: var(--clinic-space-3);
  border-top: 1px solid var(--clinic-line-soft);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}
</style>
