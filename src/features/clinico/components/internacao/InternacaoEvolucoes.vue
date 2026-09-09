<script setup lang="ts">
/**
 * Evolução por plantão: o que aconteceu no turno e o que o próximo precisa fazer.
 *
 * O formulário abre com os **vitais do turno anterior à vista**, e não em branco. Evolução de
 * internação é comparação: 38,5 °C não quer dizer nada sozinho, e quer dizer muito se o turno
 * passado registrou 39,4. Um formulário vazio obriga a abrir a evolução anterior noutra aba,
 * que é como o dado do turno anterior deixa de ser consultado.
 *
 * A gravidade é escolhida **aqui**, no fim do raciocínio clínico, e não num seletor solto no topo
 * da tela. É a mesma decisão que a avaliação descreve — e é ela que dispara o boletim retido
 * quando o quadro piora. Separá-la da evolução produziria uma piora registrada em texto que o
 * sistema não enxerga.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import InternacaoGravidade from './InternacaoGravidade.vue'
import ClinicField from '../base/ClinicField.vue'
import ClinicRefValue from '../base/ClinicRefValue.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import type {
  EvolucaoDeInternacao,
  GravidadeClinica,
  Measurement,
  Pet,
  Plantao,
  VitalKey,
} from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  evolucoes: EvolucaoDeInternacao[]
  plantoes: Plantao[]
  plantaoAtualId: string | null
  pet: Pet | null
  gravidadeAtual: GravidadeClinica
  salvando: boolean
}>()

const emit = defineEmits<{
  registrar: [
    entrada: {
      vitais: Record<VitalKey, Measurement>
      observado: string
      avaliacao: string
      plano: string
      gravidade: GravidadeClinica
    },
  ]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

/**
 * Os vitais que um plantão de fato afere.
 *
 * Peso e escore corporal ficam de fora: não mudam em oito horas, e um campo que ninguém preenche
 * ensina a pular campos.
 */
const VITAIS_DO_TURNO: VitalKey[] = [
  'temperatura',
  'frequenciaCardiaca',
  'frequenciaRespiratoria',
  'pressaoSistolica',
]

const anterior = computed(() => props.evolucoes[0] ?? null)

/**
 * O campo vazio mostra **a faixa normal deste paciente**, não a unidade solta.
 *
 * "°C" só diz o que o rótulo já disse. "37,5–39,2 °C" diz onde o número deveria cair — e é a
 * mesma régua que o valor vai ser julgado depois, na mesma grafia que o `ClinicRefValue` usa no
 * histórico ao lado. Quem não tem faixa cadastrada fica sem sugestão em vez de ganhar uma
 * inventada.
 */
function faixaDoVital(vital: VitalKey): string {
  const faixa = clinico.faixaDoPaciente(vital, props.pet)

  return faixa ? formato.faixaDeReferencia(faixa) : ''
}

const jaRegistrouNoTurno = computed(() =>
  props.plantaoAtualId
    ? props.evolucoes.some((item) => item.plantaoId === props.plantaoAtualId)
    : false,
)

function vitaisVazios(): Record<VitalKey, Measurement> {
  return {
    peso: { valor: null, naoAferido: true },
    temperatura: { valor: null, naoAferido: false },
    frequenciaCardiaca: { valor: null, naoAferido: false },
    frequenciaRespiratoria: { valor: null, naoAferido: false },
    tempoPreenchimentoCapilar: { valor: null, naoAferido: true },
    escoreCorporal: { valor: null, naoAferido: true },
    pressaoSistolica: { valor: null, naoAferido: true },
  }
}

const rascunho = ref({
  vitais: vitaisVazios(),
  observado: '',
  avaliacao: '',
  plano: '',
  gravidade: props.gravidadeAtual,
})

/* A gravidade do formulário acompanha a do paciente enquanto ninguém a tocar. */
watch(
  () => props.gravidadeAtual,
  (valor) => {
    rascunho.value.gravidade = valor
  },
)

const opcoesDeGravidade = computed(() => [
  { valor: 'estavel' as const, rotulo: t('clinico.internacao.gravidade.estavel'), tom: 'ok' as const },
  {
    valor: 'atencao' as const,
    rotulo: t('clinico.internacao.gravidade.atencao'),
    tom: 'atencao' as const,
  },
  {
    valor: 'critico' as const,
    rotulo: t('clinico.internacao.gravidade.critico'),
    tom: 'risco' as const,
  },
])

/** Aviso em voz alta: piorar aqui trava um boletim lá. Ninguém deve ser pego de surpresa. */
const vaiPiorar = computed(() => {
  const peso: Record<GravidadeClinica, number> = { estavel: 0, atencao: 1, critico: 2 }

  return peso[rascunho.value.gravidade] > peso[props.gravidadeAtual]
})

const podeRegistrar = computed(
  () => rascunho.value.observado.trim().length > 0 || rascunho.value.avaliacao.trim().length > 0,
)

function nomeDoPlantao(evolucao: EvolucaoDeInternacao): string {
  const plantao = props.plantoes.find((item) => item.id === evolucao.plantaoId)

  return plantao ? t(`clinico.internacao.plantao.${plantao.kind}`) : ''
}

function registrar() {
  if (!podeRegistrar.value) {
    return
  }

  emit('registrar', {
    vitais: rascunho.value.vitais,
    observado: rascunho.value.observado,
    avaliacao: rascunho.value.avaliacao,
    plano: rascunho.value.plano,
    gravidade: rascunho.value.gravidade,
  })

  rascunho.value = {
    vitais: vitaisVazios(),
    observado: '',
    avaliacao: '',
    plano: '',
    gravidade: rascunho.value.gravidade,
  }
}
</script>

<template>
  <div class="evolucoes">
    <section class="registro">
      <header class="registro__topo">
        <h3 class="registro__titulo">{{ t('clinico.internacao.evolucao.registrarTitulo') }}</h3>
        <p v-if="jaRegistrouNoTurno" class="registro__jaFeita">
          <i class="pi pi-check-circle" aria-hidden="true" />
          {{ t('clinico.internacao.evolucao.jaRegistrada') }}
        </p>
      </header>

      <div class="vitais">
        <ClinicField
          v-for="vital in VITAIS_DO_TURNO"
          :key="vital"
          :rotulo="t(`clinico.prontuario.exameFisico.${vital}`)"
        >
          <template #default="{ id }">
            <InputNumber
              :id="id"
              :model-value="rascunho.vitais[vital].valor"
              :placeholder="faixaDoVital(vital)"
              :min-fraction-digits="0"
              :max-fraction-digits="1"
              fluid
              @update:model-value="
                rascunho.vitais[vital] = { valor: $event ?? null, naoAferido: false }
              "
            />
          </template>
        </ClinicField>
      </div>

      <!--
        O turno anterior fica à vista enquanto se digita o atual. É comparação, não histórico:
        sem ela, cada número é lido como se fosse o primeiro.
      -->
      <div v-if="anterior" class="anteriores">
        <span class="anteriores__rotulo">{{ t('clinico.internacao.evolucao.turnoAnterior') }}</span>
        <ClinicRefValue
          v-for="vital in VITAIS_DO_TURNO"
          :key="vital"
          :rotulo="t(`clinico.prontuario.exameFisico.${vital}`)"
          :valor="anterior.vitais[vital]"
          :faixa="clinico.faixaDoPaciente(vital, pet)"
          compacto
        />
      </div>

      <ClinicField
        :rotulo="t('clinico.internacao.evolucao.observado')"
        :dica="t('clinico.internacao.evolucao.observadoDica')"
      >
        <template #default="{ id }">
          <Textarea
            :id="id"
            v-model="rascunho.observado"
            :placeholder="t('clinico.internacao.evolucao.observadoExemplo')"
            rows="2"
            auto-resize
            fluid
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.internacao.evolucao.avaliacao')">
        <template #default="{ id }">
          <Textarea
            :id="id"
            v-model="rascunho.avaliacao"
            :placeholder="t('clinico.internacao.evolucao.avaliacaoExemplo')"
            rows="2"
            auto-resize
            fluid
          />
        </template>
      </ClinicField>

      <ClinicField
        :rotulo="t('clinico.internacao.evolucao.plano')"
        :dica="t('clinico.internacao.evolucao.planoDica')"
      >
        <template #default="{ id }">
          <Textarea
            :id="id"
            v-model="rascunho.plano"
            :placeholder="t('clinico.internacao.evolucao.planoExemplo')"
            rows="2"
            auto-resize
            fluid
          />
        </template>
      </ClinicField>

      <ClinicToggleGroup
        v-model="rascunho.gravidade"
        :opcoes="opcoesDeGravidade"
        :rotulo="t('clinico.internacao.evolucao.gravidade')"
      />

      <p v-if="vaiPiorar" class="registro__aviso" role="status">
        <i class="pi pi-info-circle" aria-hidden="true" />
        {{ t('clinico.internacao.evolucao.avisoPiora') }}
      </p>

      <Button
        :label="t('clinico.internacao.evolucao.registrar')"
        icon="pi pi-save"
        :disabled="!podeRegistrar || salvando"
        :loading="salvando"
        @click="registrar"
      />
    </section>

    <section class="historico">
      <h3 class="registro__titulo">{{ t('clinico.internacao.evolucao.historicoTitulo') }}</h3>

      <p v-if="evolucoes.length === 0" class="historico__vazio">
        {{ t('clinico.internacao.evolucao.semEvolucao') }}
      </p>

      <article v-for="evolucao in evolucoes" :key="evolucao.id" class="turno">
        <header class="turno__topo">
          <div class="turno__quem">
            <strong>{{ nomeDoPlantao(evolucao) }}</strong>
            <span>
              {{ formato.dataCurta(evolucao.registradoEm.slice(0, 10)) }} ·
              {{ formato.hora(evolucao.registradoEm) }} ·
              {{ clinico.profissional(evolucao.professionalId)?.nome }}
            </span>
          </div>
          <InternacaoGravidade :gravidade="evolucao.gravidade" />
        </header>

        <div class="turno__vitais">
          <ClinicRefValue
            v-for="vital in VITAIS_DO_TURNO"
            :key="vital"
            :rotulo="t(`clinico.prontuario.exameFisico.${vital}`)"
            :valor="evolucao.vitais[vital]"
            :faixa="clinico.faixaDoPaciente(vital, pet)"
            compacto
          />
        </div>

        <dl class="turno__notas">
          <template v-if="evolucao.observado">
            <dt>{{ t('clinico.internacao.evolucao.observado') }}</dt>
            <dd>{{ evolucao.observado }}</dd>
          </template>
          <template v-if="evolucao.avaliacao">
            <dt>{{ t('clinico.internacao.evolucao.avaliacao') }}</dt>
            <dd>{{ evolucao.avaliacao }}</dd>
          </template>
          <template v-if="evolucao.plano">
            <dt>{{ t('clinico.internacao.evolucao.plano') }}</dt>
            <dd>{{ evolucao.plano }}</dd>
          </template>
        </dl>
      </article>
    </section>
  </div>
</template>

<style scoped>
.evolucoes {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-5);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.registro,
.historico {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.registro__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.registro__titulo {
  margin: 0;
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.registro__jaFeita {
  display: inline-flex;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
  color: var(--clinic-ok-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

/*
 * Os campos alinham pela **base**, não pelo topo.
 *
 * "Frequência respiratória" quebra em duas linhas e "Temperatura" não; alinhados pelo topo, o
 * campo mais longo empurrava o próprio input meia linha abaixo dos vizinhos e a fileira ficava
 * em degraus. Alinhados pelo fim, os quatro inputs ficam na mesma altura seja qual for o rótulo.
 */
.vitais {
  display: grid;
  align-items: end;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 7rem), 1fr));
}

.anteriores {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface-sunken);
}

.anteriores__rotulo {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.registro__aviso {
  display: flex;
  align-items: flex-start;
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

.historico__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.turno {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.turno__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.turno__quem {
  display: grid;
  gap: 0.05rem;
}

.turno__quem strong {
  font-weight: 750;
}

.turno__quem span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.turno__vitais {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-3);
}

.turno__notas {
  display: grid;
  margin: 0;
  gap: 0.15rem;
}

.turno__notas dt {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.turno__notas dd {
  margin: 0 0 var(--clinic-space-2);
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

@media (width <= 1024px) {
  .evolucoes {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
