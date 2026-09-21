<script setup lang="ts">
/**
 * Justificativa de falta — e o lugar de onde se liga para o responsável.
 *
 * O diálogo existe porque falta sem motivo não decide nada. "Quatro faltas" é uma reclamação;
 * "quatro faltas, todas por transporte" é um horário no fim da tarde e o problema resolvido.
 * E o motivo só se descobre falando com a pessoa — por isso o telefone está **dentro** deste
 * diálogo, e não numa tela ao lado: mandar a recepção sair daqui para procurar o contato é
 * como a justificativa deixa de ser preenchida.
 *
 * Quatro decisões:
 *
 * - **Registrar é opcional.** A falta é marcada quando o horário passa; a ligação sai à tarde.
 *   Exigir o motivo na hora produziria "outro" em metade das faltas — que é o mesmo que não ter
 *   motivo, com a diferença de que a fila de pendências passaria a mentir. Daí o botão de
 *   deixar para depois, que só aparece quando ainda não há motivo registrado.
 * - **Motivo e canal são `kind`, a observação é texto.** Contar "quantas foram esquecimento" é
 *   o que muda a política de lembretes, e isso não se conta em campo livre. A observação existe
 *   para o que o `kind` não cobre, e nunca entra em contagem.
 * - **O canal registra a tentativa que não deu certo.** `sem-resposta` é o valor que impede a
 *   recepção de ligar de novo para quem já foi procurado três vezes.
 * - **Reabrir mostra o que já foi registrado.** O diálogo é o mesmo para cadastrar e para
 *   corrigir; o que muda é o texto do botão e o que vem preenchido.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import type {
  Appointment,
  CanalDeContato,
  JustificativaDeFalta,
  MotivoDeFalta,
  Tutor,
} from '../../data/types'
import { motivoEncerraOCaso } from '../../domain/faltas'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  appointment: Appointment | null
  /** Responsável do paciente — de onde saem o telefone e o nome. */
  tutor: Tutor | null
  salvando?: boolean
}>()

const emit = defineEmits<{
  confirmar: [entrada: { motivo: MotivoDeFalta; canal: CanalDeContato; observacao: string }]
  /** "Depois": fecha sem registrar, e a falta segue na fila de pendências. */
  adiar: []
  fechar: []
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

/**
 * O óbito fica **no fim da lista**, e não junto dos clínicos.
 *
 * Não é ordem alfabética nem de frequência: é distância. Um `Select` escolhe pelo teclado e por
 * rolagem rápida, e o motivo que encerra o caso não pode ficar vizinho de "paciente melhorou" —
 * onde um dedo apressado o marca sem querer, e a clínica passa a tratar um animal vivo como
 * morto.
 */
const MOTIVOS: MotivoDeFalta[] = [
  'esqueceu',
  'imprevisto',
  'transporte',
  'paciente-melhorou',
  'emergencia',
  'custo',
  'insatisfacao',
  'outro',
  'obito',
]

const CANAIS: CanalDeContato[] = ['telefone', 'whatsapp', 'presencial', 'sem-resposta']

const motivo = ref<MotivoDeFalta>('esqueceu')
const canal = ref<CanalDeContato>('telefone')
const observacao = ref('')

const existente = computed<JustificativaDeFalta | null>(
  () => props.appointment?.justificativaDeFalta ?? null,
)

/**
 * Cada abertura recomeça do que está gravado.
 *
 * Sem isto, o diálogo carregaria o motivo da falta anterior para a seguinte — e como as duas
 * telas que o abrem são listas, a chance de registrar "transporte" no paciente errado seria
 * alta e silenciosa.
 */
watch(
  () => props.appointment?.id,
  () => {
    motivo.value = existente.value?.motivo ?? 'esqueceu'
    canal.value = existente.value?.canal ?? 'telefone'
    observacao.value = existente.value?.observacao ?? ''
  },
  { immediate: true },
)

const opcoesMotivo = computed(() =>
  MOTIVOS.map((valor) => ({ valor, rotulo: formato.motivoFalta(valor) })),
)

const opcoesCanal = computed(() =>
  CANAIS.map((valor) => ({ valor, rotulo: formato.canalDeContato(valor) })),
)

const aberto = computed({
  get: () => props.appointment !== null,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

const pet = computed(() => (props.appointment ? clinico.pet(props.appointment.petId) : null))

/**
 * Só dígitos, com o país na frente quando ele não veio.
 *
 * O telefone é cadastrado como a recepção digita — `(67) 98883-7848` — e tanto `tel:` quanto o
 * WhatsApp querem o número limpo. O `55` só entra quando falta: número já internacional não
 * pode ganhar um segundo país na frente.
 */
const telefoneLimpo = computed(() => {
  const digitos = (props.tutor?.telefone ?? '').replace(/\D/g, '')

  if (!digitos) {
    return ''
  }

  return digitos.length > 11 ? digitos : `55${digitos}`
})

/** Marcado óbito, a tela inteira muda de tom — e para de oferecer o que não se oferece mais. */
const encerra = computed(() => motivoEncerraOCaso(motivo.value))

/**
 * A mensagem já aberta com o nome do paciente e o dia — ninguém deveria digitar isso de novo.
 *
 * **Ela troca quando o motivo é óbito.** O texto padrão termina em "podemos remarcar?", e mandar
 * isso para quem acabou de perder o animal é o pior erro que esta tela pode cometer. O botão
 * continua ali, porque ainda pode haver o que conversar; o que sai é a pergunta.
 */
const linkDoWhatsapp = computed(() => {
  if (!telefoneLimpo.value || !props.appointment) {
    return ''
  }

  const texto = t(
    encerra.value
      ? 'clinico.faltas.justificativa.mensagemObito'
      : 'clinico.faltas.justificativa.mensagem',
    {
      paciente: pet.value?.nome ?? '',
      data: formato.dataCurta(props.appointment.inicio.slice(0, 10)),
    },
  )

  return `https://wa.me/${telefoneLimpo.value}?text=${encodeURIComponent(texto)}`
})
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog"
    :style="{ width: 'min(32rem, 94vw)' }"
    :header="t('clinico.faltas.justificativa.titulo')"
    dismissable-mask
  >
    <div v-if="appointment" class="falta clinic-scope">
      <p class="falta__alvo">
        <strong>{{ pet?.nome }}</strong>
        <span class="clinic-value">
          {{ formato.dataCurta(appointment.inicio.slice(0, 10)) }} ·
          {{ formato.hora(appointment.inicio) }}
        </span>
      </p>

      <!--
        O contato fica no topo, antes dos campos.

        A ordem é a da tarefa: primeiro se fala com a pessoa, depois se anota o que ela disse.
        Com os campos em cima, o telefone viraria rodapé de formulário — e formulário com o
        contato escondido no fim é formulário preenchido com "outro".
      -->
      <section v-if="tutor" class="contato">
        <div class="contato__quem">
          <span class="clinic-label">{{ t('clinico.faltas.colunaResponsavel') }}</span>
          <strong class="contato__nome">{{ tutor.nome }}</strong>
          <span v-if="tutor.telefone" class="contato__telefone clinic-value">
            <bdi dir="ltr">{{ tutor.telefone }}</bdi>
          </span>
          <span v-else class="contato__sem">{{
            t('clinico.faltas.justificativa.semTelefone')
          }}</span>
        </div>

        <div v-if="telefoneLimpo" class="contato__acoes">
          <a class="contato__botao" :href="`tel:${telefoneLimpo}`">
            <i class="pi pi-phone" aria-hidden="true" />
            {{ t('clinico.vacinas.ligar') }}
          </a>
          <a
            class="contato__botao"
            :href="linkDoWhatsapp"
            target="_blank"
            rel="noopener noreferrer"
          >
            <i class="pi pi-whatsapp" aria-hidden="true" />
            {{ t('clinico.faltas.justificativa.whatsapp') }}
          </a>
        </div>
      </section>

      <div class="falta__campos">
        <label class="falta__campo">
          <span class="clinic-label">{{ t('clinico.faltas.justificativa.motivo') }}</span>
          <Select
            v-model="motivo"
            :options="opcoesMotivo"
            option-label="rotulo"
            option-value="valor"
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </label>

        <label class="falta__campo">
          <span class="clinic-label">{{ t('clinico.faltas.justificativa.canal') }}</span>
          <Select
            v-model="canal"
            :options="opcoesCanal"
            option-label="rotulo"
            option-value="valor"
            fluid
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </label>
      </div>

      <label class="falta__campo">
        <span class="clinic-label">{{ t('clinico.faltas.justificativa.observacao') }}</span>
        <Textarea
          v-model="observacao"
          rows="2"
          auto-resize
          fluid
          :placeholder="t('clinico.faltas.justificativa.observacaoDica')"
        />
      </label>

      <!--
        O que o óbito desliga, dito antes de salvar.

        A consequência é grande e invisível — some a oferta de remarcação daquela falta —, e
        escolha que muda o comportamento do sistema sem avisar é escolha que alguém desfaz pelo
        suporte. O aviso também serve de segunda confirmação para o clique errado no `Select`.
      -->
      <p v-if="encerra" class="falta__obito" role="status">
        <i class="pi pi-info-circle" aria-hidden="true" />
        {{ t('clinico.faltas.justificativa.avisoObito') }}
      </p>

      <p v-if="existente" class="falta__nota">
        {{
          t('clinico.faltas.justificativa.registradaPor', {
            nome: clinico.profissional(existente.professionalId)?.nome ?? '',
            quando: formato.relativo(existente.registradaEm),
          })
        }}
      </p>
    </div>

    <template #footer>
      <!--
        "Depois" só existe enquanto não há motivo: com um já registrado, o botão que faz sentido
        ao lado de salvar é o de desistir da correção, não o de adiar o que já foi feito.
      -->
      <Button
        v-if="!existente"
        :label="t('clinico.faltas.justificativa.adiar')"
        severity="secondary"
        text
        @click="emit('adiar')"
      />
      <Button
        v-else
        :label="t('clinico.agenda.mover.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('clinico.faltas.justificativa.confirmar')"
        icon="pi pi-check"
        :loading="salvando"
        @click="emit('confirmar', { motivo, canal, observacao })"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.falta {
  display: grid;
  gap: var(--clinic-space-4);
}

.falta__alvo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--clinic-space-3);
  margin: 0;
}

.falta__alvo strong {
  font-size: var(--clinic-font-title);
  font-weight: 750;
  overflow-wrap: anywhere;
}

.contato {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-sunken);
}

.contato__quem {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
}

.contato__nome {
  font-weight: 750;
  overflow-wrap: anywhere;
}

.contato__telefone {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.contato__sem {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.contato__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

/*
 * Âncoras de verdade, e não botões com `@click`.
 *
 * `tel:` e `wa.me` são navegação: o toque longo precisa oferecer "copiar número", e o
 * WhatsApp precisa abrir em outra aba sem levar a agenda junto. Um `Button` com script
 * perderia as duas coisas em troca de nada.
 */
.contato__botao {
  display: inline-flex;
  min-height: var(--clinic-hit-target);
  align-items: center;
  gap: 0.35rem;
  padding: 0 var(--clinic-space-3);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-base);
  font-weight: 700;
  text-decoration: none;
}

.contato__botao:hover {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
}

.contato__botao:focus-visible {
  outline: none;
  box-shadow: var(--clinic-focus-ring);
}

.falta__campos {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
}

.falta__campo {
  display: grid;
  gap: 0.25rem;
}

.falta__nota {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/*
 * Tom de atenção, não de risco.
 *
 * Risco é para o que está errado, e não há nada errado em registrar um óbito — há algo
 * importante. Vermelho aqui leria como repreensão a quem está fazendo a coisa certa.
 */
.falta__obito {
  display: flex;
  align-items: flex-start;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}
</style>
