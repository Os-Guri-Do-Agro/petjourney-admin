<script setup lang="ts">
/**
 * Emissão da receita: assinar, entregar e repetir.
 *
 * A receita é o artefato do módulo que mais circula fora dele — vai para a farmácia, para o
 * responsável e, havendo fiscalização, para o CRMV. Três coisas que este painel encarna:
 *
 * - **Assinar congela.** A receita é uma cópia da conduta no instante da assinatura, não um
 *   espelho dela. Se apontasse para a conduta viva, mudar a dose no prontuário depois de
 *   assinar alteraria em silêncio um papel que já está na mão da farmácia.
 * - **A visão do responsável fica lado a lado.** O requisito pede que a mesma prescrição chegue
 *   ao app "sem redigitação", e o jeito de garantir isso é o vet **ver** o que a outra pessoa
 *   vai ler — em palavra, não em decimal.
 * - **Repetir é um toque.** Medicação contínua se repete todo mês, e obrigar a remontar a
 *   prescrição inteira é o que faz a clínica voltar para o bloco de papel.
 *
 * Na tela nova é uma folha própria, embaixo da vacinação: o título com as duas ações (repetir e
 * assinar), a prévia do app do responsável num painel afundado — é outra tela, a do celular — e
 * cada receita já assinada numa linha em tom de "pronto", com o código que a farmácia confere.
 */
import Button from 'primevue/button'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicAlertChip from '../base/ClinicAlertChip.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Encounter, Prescription } from '../../data/types'
import { fracionar } from '../../domain/receita'
import { clinicClock, useClinicoStore } from '../../stores/clinico'
import { useReceitasStore } from '../../stores/receitas'

const props = defineProps<{
  encounter: Encounter
  somenteLeitura: boolean
}>()

const emit = defineEmits<{
  repetir: [prescricoes: Prescription[]]
  /** O vet marcou (ou desmarcou) o item como tratamento crítico. */
  critico: [prescricaoId: string, valor: boolean]
}>()

const { t } = useI18n()
const idBase = useId()
const clinico = useClinicoStore()
const receitas = useReceitasStore()
const formato = useClinicFormat()

const prescricoes = computed(() => props.encounter.conduta.prescricoes)

/** Receitas já emitidas neste atendimento. Mais de uma acontece: aditou remédio, emitiu de novo. */
const emitidas = computed(() => receitas.doAtendimento(props.encounter.id))

/**
 * A última receita assinada **deste paciente**, de qualquer atendimento.
 *
 * É o que "repetir" oferece — e é de outro atendimento que ela costuma vir: o contínuo do mês
 * passado, não o desta consulta.
 */
const anterior = computed(() => receitas.ultimaAssinada(props.encounter.petId))

const podeRepetir = computed(
  () => !props.somenteLeitura && anterior.value !== null && anterior.value.prescricoes.length > 0,
)

const podeEmitir = computed(() => !props.somenteLeitura && prescricoes.value.length > 0)

/**
 * Como cada item chega ao responsável.
 *
 * Deliberadamente sem miligrama e sem a conta: quem vai dar o remédio precisa saber **o que**
 * dar, **quando** e **por quantos dias**. O mg/kg é conferência do vet e só o confundiria.
 */
const vistaDoResponsavel = computed(() =>
  prescricoes.value.map((prescricao) => {
    const medicamento = clinico.medicamento(prescricao.medicamentoId)
    const fracao = medicamento
      ? fracionar(prescricao.calculo.quantidadeApresentacao, medicamento.unidadeApresentacao)
      : null

    const quantidade = fracao
      ? t(`clinico.prontuario.conduta.fracao.${fracao.kind}`, {
          inteiros: fracao.inteiros,
          quantidade: formato.numero(fracao.quantidade, 2),
        })
      : t('clinico.prontuario.conduta.resumoQuantidade', {
          quantidade: formato.numero(prescricao.calculo.quantidadeApresentacao, 2),
          unidade: t(
            `clinico.prontuario.conduta.unidade.${medicamento?.unidadeApresentacao ?? 'comprimido'}`,
            prescricao.calculo.quantidadeApresentacao,
          ),
        })

    return {
      id: prescricao.id,
      nome: medicamento?.nome ?? '',
      quantidade,
      continuo: prescricao.calculo.duracaoDias === null,
      frequencia: t('clinico.prontuario.conduta.aCadaHoras', {
        horas: prescricao.calculo.frequenciaHoras,
      }),
      dias: prescricao.calculo.duracaoDias,
      critico: prescricao.critico ?? false,
    }
  }),
)

function emitir() {
  receitas.emitir(props.encounter, prescricoes.value)
}

function repetir() {
  if (anterior.value) {
    /*
     * Cópia nova de tudo, com id próprio: repetir não pode fazer duas receitas apontarem para
     * a mesma prescrição, senão editar a dose de hoje reescreveria a do mês passado.
     */
    emit(
      'repetir',
      anterior.value.prescricoes.map((prescricao) => ({
        ...prescricao,
        id: `presc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        calculo: { ...prescricao.calculo },
        /* A confirmação de alergia não se herda: é decisão desta consulta. */
        alergiaConfirmada: false,
      })),
    )
  }
}
</script>

<template>
  <section class="receita ui-folha" :aria-labelledby="`receita-${encounter.id}`">
    <header class="receita__topo">
      <span class="receita__icone" aria-hidden="true"><i class="ph ph-prescription" /></span>

      <div class="receita__titulos">
        <h3 :id="`receita-${encounter.id}`" class="receita__titulo">
          {{ t('clinico.receita.titulo') }}
        </h3>
        <p v-if="prescricoes.length === 0" class="receita__sub">
          {{ t('clinico.receita.semPrescricao') }}
        </p>
        <p v-else class="receita__sub">
          {{
            t(
              'clinico.prontuario.passos.prescricoes',
              { contagem: prescricoes.length },
              prescricoes.length,
            )
          }}
        </p>
      </div>

      <div class="receita__acoes">
        <!--
          Repetir vem antes de emitir porque é o que se usa **antes** de montar a prescrição:
          medicação contínua se repete todo mês, e remontá-la à mão é o que faz a clínica voltar
          para o bloco de papel.
        -->
        <Button
          v-if="podeRepetir"
          type="button"
          :label="t('clinico.receita.repetir')"
          icon="ph ph-arrow-counter-clockwise"
          size="small"
          severity="secondary"
          text
          :title="
            t('clinico.receita.repetirDica', {
              data: formato.dataCurta(clinicClock.dateOf(anterior!.emitidaEm)),
            })
          "
          @click="repetir"
        />

        <Button
          type="button"
          :label="t('clinico.receita.emitir')"
          icon="ph ph-seal-check"
          size="small"
          severity="secondary"
          outlined
          :disabled="!podeEmitir"
          :loading="receitas.salvando"
          @click="emitir"
        />
      </div>
    </header>

    <!--
      O que o responsável recebe, ao lado do que o vet prescreveu. É assim que "sem redigitação"
      deixa de ser promessa: as duas leituras saem do mesmo dado, e o vet vê as duas antes de
      assinar.
    -->
    <section v-if="prescricoes.length > 0" class="responsavel">
      <h4 class="responsavel__titulo">
        <i class="ph ph-device-mobile" aria-hidden="true" />
        {{ t('clinico.receita.vistaDoResponsavel') }}
      </h4>

      <ul class="responsavel__lista">
        <li v-for="item in vistaDoResponsavel" :key="item.id" class="item">
          <span class="item__nome">{{ item.nome }}</span>
          <span class="item__instrucao">{{ item.quantidade }}</span>
          <span class="item__quando ui-num">
            {{ item.frequencia }}
            <template v-if="item.dias !== null">
              · {{ t('clinico.prontuario.conduta.porDias', { dias: item.dias }, item.dias) }}
            </template>
          </span>
          <span class="item__lembrete">
            <i class="ph ph-bell" aria-hidden="true" />
            {{
              item.continuo
                ? t('clinico.receita.lembreteContinuo')
                : t('clinico.receita.lembrete', {
                    quantidade: item.quantidade,
                    frequencia: item.frequencia,
                  })
            }}
          </span>
          <!--
            Crítico é decisão de quem prescreve, e mora aqui porque é aqui que ela é tomada: a
            clínica passa a ser avisada se, em casa, a adesão deste item cair.
          -->
          <span class="item__critico">
            <ToggleSwitch
              :model-value="item.critico"
              :input-id="`${idBase}-${item.id}`"
              :disabled="somenteLeitura"
              @update:model-value="emit('critico', item.id, Boolean($event))"
            />
            <label :for="`${idBase}-${item.id}`">{{ t('clinico.receita.critico') }}</label>
          </span>
        </li>
      </ul>
    </section>

    <!-- Receitas já assinadas neste atendimento, com o código que a farmácia confere. -->
    <ul v-if="emitidas.length > 0" class="emitidas">
      <li v-for="doc in emitidas" :key="doc.id" class="emitida">
        <i class="ph ph-seal-check emitida__icone" aria-hidden="true" />

        <div class="emitida__corpo">
          <p class="emitida__assinatura">
            <strong>
              {{ t('clinico.receita.assinadaPor', { nome: doc.assinatura?.nome ?? '' }) }}
            </strong>
            <span>{{ doc.assinatura?.conselho }}</span>
          </p>

          <p class="emitida__dados">
            <span>
              {{ t('clinico.receita.codigo') }}
              <strong class="emitida__codigo ui-num">{{ doc.assinatura?.codigo }}</strong>
            </span>
            <span class="ui-num">
              {{ t('clinico.receita.validaAte', { data: formato.dataCurta(doc.validaAte) }) }}
            </span>
          </p>

          <ClinicAlertChip
            v-if="doc.controlada"
            severidade="atencao"
            :rotulo="t('clinico.receita.controlada')"
          />
        </div>

        <span v-if="doc.enviadaEm" class="emitida__enviada">
          <i class="ph ph-check" aria-hidden="true" />
          {{ t('clinico.receita.enviada') }}, {{ formato.relativo(doc.enviadaEm) }}
        </span>

        <Button
          v-else
          type="button"
          :label="t('clinico.receita.enviar')"
          icon="ph ph-paper-plane-tilt"
          size="small"
          severity="secondary"
          outlined
          @click="receitas.enviar(doc.id)"
        />
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* O cartão com cabeçalho: o topo separado do corpo por um fio suave, como as folhas das etapas. */
.receita {
  display: grid;
  gap: 16px;
  padding: 0 22px 20px;
}

.receita__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 14px;
  margin-inline: -22px;
  padding: 18px 22px 16px;
  border-bottom: 1px solid var(--linha-suave);
}

/* Sem corpo embaixo (nada a mostrar ainda), o topo é o cartão inteiro: sem fio sobrando. */
.receita__topo:last-child {
  margin-bottom: -20px;
  border-bottom: 0;
}

/* O ladrilho do assunto, no tom do lugar — o mesmo das folhas das etapas. */
.receita__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  font-size: 20px;
}

.receita__titulos {
  display: grid;
  min-width: 0;
  flex: 1 1 220px;
  gap: 2px;
}

.receita__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.005em;
}

.receita__sub {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.receita__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

/* --------------------------------------------------------- visão do responsável */

/* A prévia do celular: um painel afundado, porque é outra tela — a do app. */
.responsavel {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  background: var(--superficie-2);
}

.responsavel__titulo {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 600;
}

.responsavel__titulo .ph {
  font-size: 16px;
}

.responsavel__lista {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: grid;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: 10px;
  background: var(--superficie);
}

.item__nome {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.item__instrucao {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
}

.item__quando {
  color: var(--tinta-2);
  font-size: 13px;
}

/* O lembrete é o elo com o app: dizer que ele nasce daqui é metade do valor da tela. */
.item__lembrete {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  color: var(--musgo);
  font-size: 13px;
  font-weight: 550;
}

.item__critico {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--linha);
  color: var(--tinta-2);
  font-size: 13px;
}

.item__critico label {
  cursor: pointer;
}

/* ------------------------------------------------------------------- emitidas */

.emitidas {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.emitida {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 12px 14px;
  border: 1px solid color-mix(in oklab, var(--ok) 35%, var(--linha));
  border-radius: 12px;
  background: color-mix(in oklab, var(--ok-fundo) 60%, var(--superficie));
}

.emitida__icone {
  align-self: flex-start;
  margin-top: 1px;
  color: var(--ok-tinta);
  font-size: 20px;
}

.emitida__corpo {
  display: grid;
  min-width: 0;
  flex: 1 1 260px;
  gap: 4px;
}

.emitida__assinatura,
.emitida__dados {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 12px;
  margin: 0;
  font-size: 13.5px;
}

.emitida__assinatura strong {
  color: var(--ok-tinta);
  font-size: 14px;
  font-weight: 600;
}

.emitida__assinatura span,
.emitida__dados {
  color: var(--tinta-2);
}

/* O código é ditado ao telefone e conferido na farmácia: algarismos de mesma largura. */
.emitida__codigo {
  margin-inline-start: 4px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.emitida__enviada {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ok-tinta);
  font-size: 13px;
  font-weight: 600;
}

@media (max-width: 640px) {
  .receita {
    padding: 0 16px 16px;
  }

  .receita__topo {
    margin-inline: -16px;
    padding: 16px 16px 14px;
  }

  .receita__topo:last-child {
    margin-bottom: -16px;
  }
}
</style>
