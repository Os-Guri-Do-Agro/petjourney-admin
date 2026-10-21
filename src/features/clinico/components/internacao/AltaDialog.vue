<script setup lang="ts">
/**
 * Encerrar a internação.
 *
 * A tela que faltava. O motor da alta existia no repositório desde o primeiro dia e **nenhuma
 * tela o chamava**: o animal entrava no mapa de leitos e não tinha por onde sair. Na prática o
 * protótipo demonstrava metade de um ciclo — internar, medicar, evoluir, comunicar — e parava
 * exatamente onde a clínica precisa registrar o que aconteceu.
 *
 * ## O que este diálogo faz antes de deixar confirmar
 *
 * **Confere o que fica para trás.** Doses pendentes agora, doses futuras que a alta vai suspender,
 * boletim que nunca saiu. São **avisos, não travas**: o animal pode ir para casa com a dose das
 * 18h no bolso do responsável, e travar a alta não faria a clínica resolver a pendência — faria o
 * animal sair pela porta enquanto o mapa continua dizendo que ele está no leito R3. É assim que
 * um mapa de leitos deixa de ser confiável.
 *
 * **Separa os três desfechos.** Alta, transferência e óbito não são graus da mesma coisa. A
 * transferência é o caso que costuma sumir dos sistemas — o animal saiu vivo e o caso continua em
 * outro lugar —, e somá-la à alta faria a clínica ler como sucesso um encaminhamento às 3 da
 * manhã para um centro de referência.
 *
 * **Cobra a ligação no desfecho grave.** Óbito e transferência não saem por mensagem, e o
 * encerramento é recusado sem o registro da ligação. É a mesma regra do boletim de piora, no
 * outro extremo da internação — e ela mora no repositório, não aqui: esta tela apenas evita
 * mandar quem trabalha bater numa recusa que já sabia que viria.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import type { Pet } from '../../data/types'
import {
  avisosDaAlta,
  DESFECHOS,
  saiPorMensagem,
  type DesfechoDaInternacao,
  type ResumoDaAlta,
} from '../../domain/internacao'

const props = defineProps<{
  aberto: boolean
  pet: Pet | null
  resumo: ResumoDaAlta | null
  salvando: boolean
  /** Recusa vinda do repositório, já como chave de tradução. */
  erro: string
}>()

const emit = defineEmits<{
  fechar: []
  confirmar: [
    entrada: {
      status: DesfechoDaInternacao
      observacao: string
      avisadoPorTelefone: boolean
    },
  ]
}>()

const { t } = useI18n()

const desfecho = ref<DesfechoDaInternacao>('alta')
const observacao = ref('')
const avisado = ref(false)

const visivel = computed({
  get: () => props.aberto,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

/*
 * Reabrir zera tudo — inclusive a caixa da ligação.
 *
 * Uma caixa marcada que sobrevive ao fechamento do diálogo é uma afirmação herdada de outra
 * conversa: "falei com o responsável" precisa ser dito sobre *este* encerramento, e não
 * arrastado de uma tentativa anterior que foi cancelada no meio.
 */
watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) {
      desfecho.value = 'alta'
      observacao.value = ''
      avisado.value = false
    }
  },
)

/* Trocar de desfecho também desmarca: a ligação é sobre o que se vai dizer, e isso mudou. */
watch(desfecho, () => {
  avisado.value = false
})

const TOM_DO_DESFECHO = {
  alta: 'ok',
  transferido: 'atencao',
  obito: 'risco',
} as const

const opcoesDeDesfecho = computed(() =>
  DESFECHOS.map((valor) => ({
    valor,
    rotulo: t(`clinico.internacao.alta.desfecho.${valor}`),
    tom: TOM_DO_DESFECHO[valor],
  })),
)

const porMensagem = computed(() => saiPorMensagem(desfecho.value))

const avisos = computed(() => (props.resumo ? avisosDaAlta(props.resumo) : []))

type AvisoDaAlta = ReturnType<typeof avisosDaAlta>[number]

/** A contagem de cada aviso. Vai também como número do plural: sem ele a frase sai no singular. */
function totalDoAviso(aviso: AvisoDaAlta): number {
  if (!props.resumo) {
    return 0
  }
  if (aviso === 'dose-pendente') {
    return props.resumo.pendentesAgora
  }
  return aviso === 'dose-futura' ? props.resumo.aSuspender : props.resumo.boletinsRetidos
}

/**
 * A orientação é obrigatória, e não por burocracia.
 *
 * Na alta ela é o que o responsável vai ler no aplicativo e seguir em casa. No óbito e na
 * transferência é o registro do que foi dito ao telefone — a única linha que responde, seis meses
 * depois, à pergunta de o que exatamente foi comunicado e por quem.
 */
const podeConfirmar = computed(
  () =>
    observacao.value.trim().length > 0 && (porMensagem.value || avisado.value) && !props.salvando,
)

function confirmar() {
  if (!podeConfirmar.value) {
    return
  }

  emit('confirmar', {
    status: desfecho.value,
    observacao: observacao.value,
    avisadoPorTelefone: avisado.value,
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visivel"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(36rem, 96vw)' }"
    dismissable-mask
  >
    <template #header>
      <h2 class="clinic-dialog__titulo">
        <span class="clinic-dialog__marca" aria-hidden="true"><i class="ph ph-sign-out" /></span>
        {{ t('clinico.internacao.alta.titulo') }}
      </h2>
    </template>

    <div class="alta clinic-scope">
      <p class="alta__quem">
        {{ t('clinico.internacao.alta.sobre', { nome: pet?.nome ?? '' }) }}
      </p>

      <ClinicToggleGroup
        v-model="desfecho"
        :opcoes="opcoesDeDesfecho"
        :rotulo="t('clinico.internacao.alta.desfechoRotulo')"
      />

      <!--
        A conferência de última hora. Números e não lista: quem chegou aqui já viu o checklist —
        o que falta é a pergunta "ficou alguma coisa?" antes de um registro que não se desfaz.
      -->
      <section v-if="resumo" class="alta__resumo">
        <h3 class="alta__resumo-titulo">{{ t('clinico.internacao.alta.resumoTitulo') }}</h3>

        <dl class="alta__numeros">
          <div>
            <dt>{{ t('clinico.internacao.alta.permanencia') }}</dt>
            <dd class="ui-num">
              {{ t('clinico.internacao.leito.horas', { horas: resumo.horas }) }}
            </dd>
          </div>
          <div>
            <dt>{{ t('clinico.internacao.alta.dosesFeitas') }}</dt>
            <dd class="ui-num">{{ resumo.feitas }}</dd>
          </div>
          <div v-if="resumo.naoFeitas > 0">
            <dt>{{ t('clinico.internacao.alta.dosesNaoFeitas') }}</dt>
            <dd class="ui-num">{{ resumo.naoFeitas }}</dd>
          </div>
          <div>
            <dt>{{ t('clinico.internacao.alta.boletinsEnviados') }}</dt>
            <dd class="ui-num">{{ resumo.boletinsEnviados }}</dd>
          </div>
        </dl>

        <p v-for="aviso in avisos" :key="aviso" class="alta__aviso" role="status">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>
            {{
              t(
                `clinico.internacao.alta.aviso.${aviso}`,
                { total: totalDoAviso(aviso) },
                totalDoAviso(aviso),
              )
            }}
          </span>
        </p>
      </section>

      <ClinicField
        :rotulo="t(`clinico.internacao.alta.orientacao.${desfecho}`)"
        :dica="t(`clinico.internacao.alta.orientacaoDica.${desfecho}`)"
        obrigatorio
      >
        <template #default="{ id }">
          <Textarea
            :id="id"
            v-model="observacao"
            :rows="4"
            :placeholder="t(`clinico.internacao.alta.orientacaoExemplo.${desfecho}`)"
            auto-resize
            fluid
          />
        </template>
      </ClinicField>

      <!--
        O que o responsável vai receber, dito antes de acontecer.
        Na alta, uma mensagem sai; nos outros dois, nenhuma sai — e é a segunda frase que evita a
        pergunta "então ele já sabe?" depois de o botão ter sido apertado.
      -->
      <p class="alta__canal" :class="{ 'alta__canal--grave': !porMensagem }">
        <i :class="porMensagem ? 'ph ph-chat-circle' : 'ph ph-phone'" aria-hidden="true" />
        <span>{{ t(`clinico.internacao.alta.canal.${desfecho}`) }}</span>
      </p>

      <label v-if="!porMensagem" class="alta__ligacao">
        <Checkbox v-model="avisado" binary />
        <span>{{ t(`clinico.internacao.alta.confirmaLigacao.${desfecho}`) }}</span>
      </label>

      <p v-if="erro" class="alta__erro" role="alert">{{ t(erro) }}</p>
    </div>

    <template #footer>
      <Button
        :label="t('clinico.internacao.alta.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t(`clinico.internacao.alta.confirmar.${desfecho}`)"
        :icon="porMensagem ? 'ph ph-check' : 'ph ph-warning'"
        :severity="porMensagem ? undefined : 'danger'"
        :disabled="!podeConfirmar"
        :loading="salvando"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.alta {
  display: grid;
  gap: 18px;
}

.alta__quem {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

/* A conferência de última hora: números grandes com legenda, numa faixa afundada. */
.alta__resumo {
  display: grid;
  gap: 12px;
  padding: 14px 16px 16px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
}

.alta__resumo-titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.alta__numeros {
  display: grid;
  gap: 12px;
  margin: 0;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
}

.alta__numeros div {
  display: grid;
  gap: 2px;
}

.alta__numeros dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.alta__numeros dd {
  margin: 0;
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.alta__aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--raio-controle);
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 13.5px;
  line-height: 1.5;
}

.alta__aviso i {
  margin-top: 2px;
  font-size: 16px;
}

/*
 * A linha do canal é informação de consequência, não decoração: ela diz o que vai acontecer do
 * lado de fora da clínica no instante em que o botão for apertado.
 */
.alta__canal {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao-pequeno);
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.alta__canal i {
  flex: none;
  font-size: 18px;
}

.alta__canal--grave {
  border-color: transparent;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-weight: 600;
}

.alta__ligacao {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: var(--tinta);
  cursor: pointer;
  font-size: 14px;
  line-height: 1.5;
}

.alta__erro {
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--raio-cartao-pequeno);
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 600;
}
</style>
