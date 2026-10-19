<script setup lang="ts">
/**
 * Evolução por plantão: o que aconteceu no turno e o que o próximo precisa fazer.
 *
 * Duas colunas: à esquerda, a evolução **deste** plantão (o formulário, numa folha); à direita, as
 * evoluções anteriores como uma linha do tempo, da mais recente para a mais antiga.
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

import UiSecao from '@/components/ui/UiSecao.vue'

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
    <UiSecao
      id="evolucao-registro"
      :titulo="t('clinico.internacao.evolucao.registrarTitulo')"
      folha
    >
      <template v-if="jaRegistrouNoTurno" #acoes>
        <span class="ui-selo ui-selo--ok">
          <i class="ph ph-check-circle" aria-hidden="true" />
          {{ t('clinico.internacao.evolucao.jaRegistrada') }}
        </span>
      </template>

      <div class="registro">
        <!--
          O turno anterior fica **embaixo de cada campo**, enquanto se digita o atual. É comparação,
          não histórico: sem ela, cada número é lido como se fosse o primeiro.
        -->
        <div class="vitais">
          <div v-for="vital in VITAIS_DO_TURNO" :key="vital" class="vital">
            <ClinicField :rotulo="t(`clinico.prontuario.exameFisico.${vital}`)">
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

            <div v-if="anterior" class="vital__antes">
              <span>{{ t('clinico.internacao.evolucao.turnoAnterior') }}</span>
              <ClinicRefValue
                :rotulo="t(`clinico.prontuario.exameFisico.${vital}`)"
                :valor="anterior.vitais[vital]"
                :faixa="clinico.faixaDoPaciente(vital, pet)"
                variante="linha"
                compacto
              />
            </div>
          </div>
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
          <i class="ph ph-phone" aria-hidden="true" />
          {{ t('clinico.internacao.evolucao.avisoPiora') }}
        </p>

        <div class="registro__acoes">
          <Button
            type="button"
            :label="t('clinico.internacao.evolucao.registrar')"
            icon="ph ph-floppy-disk"
            :disabled="!podeRegistrar || salvando"
            :loading="salvando"
            @click="registrar"
          />
        </div>
      </div>
    </UiSecao>

    <UiSecao
      id="evolucao-historico"
      :titulo="t('clinico.internacao.evolucao.historicoTitulo')"
      :contagem="evolucoes.length || null"
      folha
    >
      <p v-if="evolucoes.length === 0" class="ui-vazio">
        {{ t('clinico.internacao.evolucao.semEvolucao') }}
      </p>

      <ol v-else class="ui-lista historico">
        <li v-for="evolucao in evolucoes" :key="evolucao.id" class="turno">
          <header class="turno__topo">
            <div class="turno__quem">
              <strong>{{ nomeDoPlantao(evolucao) }}</strong>
              <span class="ui-num">
                {{ formato.dataCurta(evolucao.registradoEm.slice(0, 10)) }},
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
            <div v-if="evolucao.observado">
              <dt>{{ t('clinico.internacao.evolucao.observado') }}</dt>
              <dd>{{ evolucao.observado }}</dd>
            </div>
            <div v-if="evolucao.avaliacao">
              <dt>{{ t('clinico.internacao.evolucao.avaliacao') }}</dt>
              <dd>{{ evolucao.avaliacao }}</dd>
            </div>
            <div v-if="evolucao.plano">
              <dt>{{ t('clinico.internacao.evolucao.plano') }}</dt>
              <dd>{{ evolucao.plano }}</dd>
            </div>
          </dl>
        </li>
      </ol>
    </UiSecao>
  </div>
</template>

<style scoped>
.evolucoes {
  display: grid;
  align-items: start;
  gap: 28px;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
}

/* ----------------------------------------------------------------- registro */

.registro {
  display: grid;
  gap: 16px;
  padding: 18px;
}

/*
 * Dois campos por linha na coluna do formulário, quatro quando ele ocupa a largura toda. Cada
 * campo carrega embaixo o valor do turno anterior, alinhado com ele.
 */
.vitais {
  display: grid;
  gap: 14px 12px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
}

.vital {
  display: grid;
  align-content: end;
  gap: 6px;
}

.vital__antes {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.registro__aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 13.5px;
  line-height: 1.5;
}

.registro__aviso i {
  margin-top: 2px;
  font-size: 16px;
}

.registro__acoes {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

/* ----------------------------------------------------------------- histórico */

.turno {
  display: grid;
  gap: 12px;
  padding: 16px 18px;
  container-type: inline-size;
}

.turno__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.turno__quem {
  display: grid;
  gap: 2px;
}

.turno__quem strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.turno__quem span {
  color: var(--tinta-2);
  font-size: 13px;
}

/* Dois por linha na coluna estreita (o rótulo cabe inteiro), quatro quando a coluna é larga. */
.turno__vitais {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@container (width >= 640px) {
  .turno__vitais {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.turno__notas {
  display: grid;
  gap: 8px;
  margin: 0;
}

.turno__notas div {
  display: grid;
  gap: 2px;
}

.turno__notas dt {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.turno__notas dd {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

@media (width <= 1100px) {
  .evolucoes {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
