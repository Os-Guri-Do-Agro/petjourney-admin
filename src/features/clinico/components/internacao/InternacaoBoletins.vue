<script setup lang="ts">
/**
 * Boletins ao responsável: a fila do que sai, o que segurou, e por quê.
 *
 * O boletim retido abre a tela — não é uma linha na lista com um selo diferente. Enquanto ele
 * existir, é a única coisa que a clínica tem para fazer nesta aba, e uma tela que o mistura com
 * os enviados deixa a notícia grave esperando enquanto alguém escreve o boletim de rotina do
 * paciente ao lado.
 *
 * A frequência mostra **quantas mensagens por dia** ao lado de cada opção. "De hora em hora" soa
 * inofensivo até alguém ver vinte e quatro; e é o responsável, não a clínica, quem deve tomar
 * esse susto antes de confirmar.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import BoletimNoApp from './BoletimNoApp.vue'
import InternacaoGravidade from './InternacaoGravidade.vue'
import ClinicField from '../base/ClinicField.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import type {
  BoletimAoTutor,
  FrequenciaDeBoletim,
  PreferenciaDeBoletim,
  Pet,
  Tutor,
} from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { boletinsPorDia, proximoBoletimEm } from '../../domain/internacao'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  boletins: BoletimAoTutor[]
  preferencia: PreferenciaDeBoletim
  pet: Pet | null
  tutor: Tutor | null
  salvando: boolean
}>()

const emit = defineEmits<{
  ligar: [boletimId: string]
  enviar: [boletimId: string]
  compor: [observado: string]
  preferencia: [preferencia: PreferenciaDeBoletim]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

const rascunho = ref('')

const FREQUENCIAS: FrequenciaDeBoletim[] = [1, 2, 4, 6, 8, 12, 24]

const retidos = computed(() => props.boletins.filter((item) => item.status === 'retido'))
const prontos = computed(() => props.boletins.filter((item) => item.status === 'liberado'))
const enviados = computed(() => props.boletins.filter((item) => item.status === 'enviado'))

const ultimoEnvio = computed(
  () =>
    enviados.value
      .map((item) => item.enviadoEm ?? item.geradoEm)
      .sort((a, b) => b.localeCompare(a))[0] ?? null,
)

const proximo = computed(() =>
  ultimoEnvio.value
    ? proximoBoletimEm({
        frequenciaHoras: props.preferencia.frequenciaHoras,
        silencioNoturno: props.preferencia.silencioNoturno,
        desde: ultimoEnvio.value,
        clock: clinicClock,
      })
    : null,
)

const opcoesDeFrequencia = computed(() =>
  FREQUENCIAS.map((horas) => ({
    valor: horas,
    rotulo: t('clinico.internacao.boletim.aCadaHoras', { horas }),
    porDia: boletinsPorDia(horas, props.preferencia.silencioNoturno),
  })),
)

/*
 * Escolha binária vira grupo de opções, não caixa de marcar.
 *
 * É o idioma do módulo — o `ClinicToggleGroup` existe exatamente para "sim ou não" — e uma caixa
 * nativa solta no meio de um formulário de tokens aparecia como o único controle sem tratamento
 * da tela.
 */
const opcoesDeFoto = computed(() => [
  { valor: true, rotulo: t('clinico.internacao.boletim.fotoSempre'), tom: 'neutro' as const },
  { valor: false, rotulo: t('clinico.internacao.boletim.fotoNunca'), tom: 'neutro' as const },
])

const opcoesDeSilencio = computed(() => [
  { valor: true, rotulo: t('clinico.internacao.boletim.silencioLigado'), tom: 'neutro' as const },
  {
    valor: false,
    rotulo: t('clinico.internacao.boletim.silencioDesligado'),
    tom: 'atencao' as const,
  },
])

function nomeDe(professionalId: string | null): string {
  return professionalId ? (clinico.profissional(professionalId)?.nome ?? '') : ''
}

function mudarFrequencia(frequenciaHoras: FrequenciaDeBoletim) {
  emit('preferencia', { ...props.preferencia, frequenciaHoras })
}

function mudarSilencio(silencioNoturno: boolean) {
  emit('preferencia', { ...props.preferencia, silencioNoturno })
}

function mudarFoto(fotoSempre: boolean) {
  emit('preferencia', { ...props.preferencia, fotoSempre })
}

function compor() {
  if (!rascunho.value.trim()) {
    return
  }

  emit('compor', rascunho.value)
  rascunho.value = ''
}
</script>

<template>
  <div class="boletins">
    <div class="boletins__coluna">
      <!--
        O bloqueio, quando existe, é a primeira coisa da tela — e explica a regra na própria
        caixa. Um botão desabilitado sem motivo escrito parece defeito, e defeito se contorna.
      -->
      <section
        v-for="boletim in retidos"
        :key="boletim.id"
        class="retido"
        role="alert"
      >
        <header class="retido__topo">
          <h3 class="retido__titulo">
            <i class="pi pi-lock" aria-hidden="true" />
            {{ t('clinico.internacao.boletim.retidoTitulo') }}
          </h3>
          <InternacaoGravidade :gravidade="boletim.gravidade" />
        </header>

        <p class="retido__regra">{{ t('clinico.internacao.boletim.retidoRegra') }}</p>

        <blockquote class="retido__texto">{{ boletim.texto }}</blockquote>

        <p class="retido__passos">
          <span class="retido__passo" :class="{ 'retido__passo--feito': boletim.ligacaoEm }">
            <i :class="boletim.ligacaoEm ? 'pi pi-check-circle' : 'pi pi-phone'" aria-hidden="true" />
            {{
              boletim.ligacaoEm
                ? t('clinico.internacao.boletim.ligacaoFeita', {
                    nome: nomeDe(boletim.ligacaoPor),
                    hora: formato.hora(boletim.ligacaoEm),
                  })
                : t('clinico.internacao.boletim.ligacaoPendente', {
                    nome: tutor?.nome ?? '',
                    telefone: tutor?.telefone ?? '',
                  })
            }}
          </span>
        </p>

        <footer class="retido__acoes">
          <Button
            v-if="!boletim.ligacaoEm"
            :label="t('clinico.internacao.boletim.registrarLigacao')"
            icon="pi pi-phone"
            :loading="salvando"
            @click="emit('ligar', boletim.id)"
          />
          <Button
            :label="t('clinico.internacao.boletim.enviar')"
            icon="pi pi-send"
            severity="secondary"
            :outlined="!boletim.ligacaoEm"
            :disabled="!boletim.ligacaoEm || salvando"
            @click="emit('enviar', boletim.id)"
          />
        </footer>
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">{{ t('clinico.internacao.boletim.composerTitulo') }}</h3>
        <p class="bloco__ajuda">{{ t('clinico.internacao.boletim.composerAjuda') }}</p>

        <ClinicField
          :rotulo="t('clinico.internacao.boletim.observado')"
          :dica="t('clinico.internacao.boletim.observadoDica')"
        >
          <template #default="{ id }">
            <Textarea
              :id="id"
              v-model="rascunho"
              :placeholder="t('clinico.internacao.boletim.observadoExemplo')"
              rows="3"
              auto-resize
              fluid
            />
          </template>
        </ClinicField>

        <Button
          :label="t('clinico.internacao.boletim.compor')"
          icon="pi pi-pencil"
          :disabled="!rascunho.trim() || salvando"
          :loading="salvando"
          @click="compor"
        />
      </section>

      <section v-if="prontos.length > 0" class="bloco">
        <h3 class="bloco__titulo">{{ t('clinico.internacao.boletim.prontosTitulo') }}</h3>

        <article v-for="boletim in prontos" :key="boletim.id" class="pronto">
          <p class="pronto__texto">{{ boletim.texto }}</p>
          <footer class="pronto__acoes">
            <span class="pronto__meta">
              {{ formato.hora(boletim.geradoEm) }} ·
              {{ t(`clinico.internacao.boletim.origem.${boletim.origem}`) }}
            </span>
            <Button
              :label="t('clinico.internacao.boletim.enviar')"
              icon="pi pi-send"
              size="small"
              :loading="salvando"
              @click="emit('enviar', boletim.id)"
            />
          </footer>
        </article>
      </section>

      <section class="bloco">
        <h3 class="bloco__titulo">{{ t('clinico.internacao.boletim.frequenciaTitulo') }}</h3>
        <p class="bloco__ajuda">{{ t('clinico.internacao.boletim.frequenciaAjuda') }}</p>

        <ClinicField :rotulo="t('clinico.internacao.boletim.frequencia')">
          <template #default="{ id }">
            <Select
              :id="id"
              :model-value="preferencia.frequenciaHoras"
              :options="opcoesDeFrequencia"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="{ overlay: { class: 'clinic-overlay' } }"
              @update:model-value="mudarFrequencia"
            >
              <template #option="{ option }">
                <span class="opcao">
                  <span>{{ option.rotulo }}</span>
                  <span class="opcao__custo">
                    {{ t('clinico.internacao.boletim.porDia', { total: option.porDia }) }}
                  </span>
                </span>
              </template>
            </Select>
          </template>
        </ClinicField>

        <p class="custo">
          {{
            t(
              'clinico.internacao.boletim.custoAtual',
              { total: boletinsPorDia(preferencia.frequenciaHoras, preferencia.silencioNoturno) },
              boletinsPorDia(preferencia.frequenciaHoras, preferencia.silencioNoturno),
            )
          }}
        </p>

        <ClinicToggleGroup
          :model-value="preferencia.silencioNoturno"
          :opcoes="opcoesDeSilencio"
          :rotulo="t('clinico.internacao.boletim.silencio')"
          @update:model-value="mudarSilencio"
        />

        <ClinicToggleGroup
          :model-value="preferencia.fotoSempre"
          :opcoes="opcoesDeFoto"
          :rotulo="t('clinico.internacao.boletim.foto')"
          @update:model-value="mudarFoto"
        />

        <p v-if="proximo" class="custo">
          {{ t('clinico.internacao.boletim.proximo', { hora: formato.hora(proximo) }) }}
        </p>
      </section>
    </div>

    <div class="boletins__coluna boletins__coluna--app">
      <h3 class="bloco__titulo">{{ t('clinico.internacao.boletim.appTitulo') }}</h3>
      <p class="bloco__ajuda">{{ t('clinico.internacao.boletim.appAjuda') }}</p>

      <BoletimNoApp
        :boletins="boletins"
        :pet-nome="pet?.nome ?? ''"
        :pet-iniciais="pet?.iniciais ?? ''"
        :clinica-nome="clinico.clinic?.nome ?? ''"
      />
    </div>
  </div>
</template>

<style scoped>
.boletins {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-5);
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
}

.boletins__coluna {
  display: grid;
  gap: var(--clinic-space-4);
}

.boletins__coluna--app {
  position: sticky;
  top: var(--clinic-space-4);
}

.bloco {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.bloco__titulo {
  margin: 0;
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.bloco__ajuda {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

/* O retido é o único bloco com fundo quente da tela — e só há um por vez, quase sempre nenhum. */
.retido {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-risk-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-risk-bg);
}

.retido__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.retido__titulo {
  display: flex;
  align-items: center;
  margin: 0;
  gap: var(--clinic-space-2);
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.retido__regra {
  margin: 0;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

/*
 * O que o responsável vai ler aparece como painel fechado sobre o fundo quente da caixa retida —
 * o contraste entre os dois já separa a mensagem do aviso da clínica, sem precisar de filete.
 */
.retido__texto {
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-risk-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

.retido__passos {
  margin: 0;
}

.retido__passo {
  display: inline-flex;
  align-items: center;
  gap: var(--clinic-space-2);
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.retido__passo--feito {
  color: var(--clinic-ok-text);
}

.retido__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

.pronto {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.pronto__texto {
  margin: 0;
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

.pronto__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.pronto__meta {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.opcao {
  display: flex;
  width: 100%;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.opcao__custo {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.custo {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

@media (width <= 1024px) {
  .boletins {
    grid-template-columns: minmax(0, 1fr);
  }

  .boletins__coluna--app {
    position: static;
  }
}
</style>
