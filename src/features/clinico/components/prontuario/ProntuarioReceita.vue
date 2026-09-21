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
 */
import Button from 'primevue/button'
import { computed } from 'vue'
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
}>()

const { t } = useI18n()
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
  <section class="receita">
    <header class="receita__topo">
      <h4 class="clinic-label">{{ t('clinico.receita.titulo') }}</h4>

      <div class="receita__acoes">
        <!--
          Repetir vem antes de emitir porque é o que se usa **antes** de montar a prescrição:
          medicação contínua se repete todo mês, e remontá-la à mão é o que faz a clínica voltar
          para o bloco de papel.
        -->
        <Button
          v-if="podeRepetir"
          :label="t('clinico.receita.repetir')"
          icon="pi pi-replay"
          size="small"
          severity="secondary"
          outlined
          :title="
            t('clinico.receita.repetirDica', {
              data: formato.dataCurta(clinicClock.dateOf(anterior!.emitidaEm)),
            })
          "
          @click="repetir"
        />

        <Button
          :label="t('clinico.receita.emitir')"
          icon="pi pi-verified"
          size="small"
          :disabled="!podeEmitir"
          :loading="receitas.salvando"
          @click="emitir"
        />
      </div>
    </header>

    <p v-if="prescricoes.length === 0" class="receita__vazio">
      {{ t('clinico.receita.semPrescricao') }}
    </p>

    <template v-else>
      <!--
        O que o responsável recebe, ao lado do que o vet prescreveu. É assim que "sem
        redigitação" deixa de ser promessa: as duas leituras saem do mesmo dado, e o vet vê as
        duas antes de assinar.
      -->
      <section class="responsavel">
        <span class="clinic-label">{{ t('clinico.receita.vistaDoResponsavel') }}</span>

        <ul class="responsavel__lista">
          <li v-for="item in vistaDoResponsavel" :key="item.id">
            <strong>{{ item.nome }}</strong>
            <span class="responsavel__instrucao">{{ item.quantidade }}</span>
            <span class="responsavel__quando">
              {{ item.frequencia }}
              <template v-if="item.dias !== null">
                · {{ t('clinico.prontuario.conduta.porDias', { dias: item.dias }, item.dias) }}
              </template>
            </span>
            <span class="responsavel__lembrete">
              <i class="pi pi-bell" aria-hidden="true" />
              {{
                item.continuo
                  ? t('clinico.receita.lembreteContinuo')
                  : t('clinico.receita.lembrete', {
                      quantidade: item.quantidade,
                      frequencia: item.frequencia,
                    })
              }}
            </span>
          </li>
        </ul>
      </section>
    </template>

    <!-- Receitas já assinadas neste atendimento, com o código que a farmácia confere. -->
    <article v-for="doc in emitidas" :key="doc.id" class="emitida">
      <header class="emitida__topo">
        <div>
          <strong class="emitida__assinatura">
            <i class="pi pi-verified" aria-hidden="true" />
            {{ t('clinico.receita.assinadaPor', { nome: doc.assinatura?.nome ?? '' }) }}
          </strong>
          <p class="emitida__conselho">{{ doc.assinatura?.conselho }}</p>
        </div>

        <ClinicAlertChip
          v-if="doc.controlada"
          severidade="atencao"
          :rotulo="t('clinico.receita.controlada')"
        />
      </header>

      <dl class="emitida__dados">
        <div>
          <dt class="clinic-label">{{ t('clinico.receita.codigo') }}</dt>
          <dd class="emitida__codigo clinic-value">{{ doc.assinatura?.codigo }}</dd>
        </div>
        <div>
          <dt class="clinic-label">{{ t('clinico.agenda.mover.para') }}</dt>
          <dd class="clinic-value">
            {{ t('clinico.receita.validaAte', { data: formato.dataCurta(doc.validaAte) }) }}
          </dd>
        </div>
      </dl>

      <div class="emitida__rodape">
        <span v-if="doc.enviadaEm" class="emitida__enviada">
          <i class="pi pi-check" aria-hidden="true" />
          {{ t('clinico.receita.enviada') }} · {{ formato.relativo(doc.enviadaEm) }}
        </span>

        <Button
          v-else
          :label="t('clinico.receita.enviar')"
          icon="pi pi-send"
          size="small"
          severity="secondary"
          outlined
          @click="receitas.enviar(doc.id)"
        />
      </div>
    </article>
  </section>
</template>

<style scoped>
.receita {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.receita__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.receita__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

.receita__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

/* --------------------------------------------------------- visão do responsável */

.responsavel {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3);
  border: 1px dashed var(--clinic-accent);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-accent-tint);
}

.responsavel__lista {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.responsavel__lista li {
  display: grid;
  gap: 0.1rem;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
}

.responsavel__instrucao {
  font-weight: 700;
}

.responsavel__quando {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

/* O lembrete é o elo com o app: dizer que ele nasce daqui é metade do valor da tela. */
.responsavel__lembrete {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.15rem;
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

/* ------------------------------------------------------------------- emitida */

.emitida {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-ok-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-ok-bg);
}

.emitida__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.emitida__assinatura {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--clinic-ok-text);
  font-weight: 750;
}

.emitida__conselho {
  margin: 0.05rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.emitida__dados {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  gap: var(--clinic-space-3);
  margin: 0;
}

.emitida__dados div {
  display: grid;
  gap: 0.1rem;
}

.emitida__dados dd {
  margin: 0;
  font-weight: 700;
}

/*
 * O código é ditado ao telefone e conferido na farmácia: monoespaçado e com folga entre
 * caracteres, porque é assim que se lê em voz alta sem errar.
 */
.emitida__codigo {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 0.95rem;
  letter-spacing: 0.06em;
}

.emitida__rodape {
  display: flex;
  justify-content: flex-end;
}

.emitida__enviada {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-ok-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}
</style>
