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
import type { ModeloDeBoletim } from '../../data/boletim-texto'
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
  /** Textos prontos, já com os dados deste paciente dentro. Vazio esconde a fileira. */
  modelos: ModeloDeBoletim[]
}>()

const emit = defineEmits<{
  ligar: [boletimId: string]
  enviar: [boletimId: string]
  /**
   * O texto **final** da mensagem, não mais a observação do plantão.
   *
   * Antes o campo guardava só a nota do turno e o repositório a embrulhava numa moldura
   * automática. Com o modelo pronto no campo, quem escreve está vendo a mensagem inteira — e
   * embrulhá-la de novo repetiria o estado do paciente e a temperatura que o próprio modelo já
   * traz. O que sai daqui é o que o responsável vai ler.
   */
  compor: [texto: string]
  preferencia: [preferencia: PreferenciaDeBoletim]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

const rascunho = ref('')

/**
 * Qual modelo está no campo agora — e por que o estado é necessário.
 *
 * Marcar o botão escolhido responde à pergunta que surge depois de editar metade do texto: "de
 * onde isto veio?". A marcação cai assim que a pessoa digita, porque a partir daí o texto é
 * dela, e um botão aceso sobre um texto reescrito promete uma correspondência que não existe.
 */
const modeloEscolhido = ref('')

/**
 * Troca o texto do campo pelo do modelo, sem perguntar.
 *
 * Um "descartar o que você escreveu?" a cada clique transformaria a escolha de modelo numa
 * decisão, quando ela é uma tentativa — o normal é experimentar dois e ficar com um. E o que se
 * perde é sempre recuperável no mesmo clique: o modelo é gerado, não digitado.
 */
function usarModelo(modelo: ModeloDeBoletim) {
  rascunho.value = modelo.texto
  modeloEscolhido.value = modelo.id
}

function limpar() {
  rascunho.value = ''
  modeloEscolhido.value = ''
}

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
  limpar()
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
            <i class="ph ph-lock" aria-hidden="true" />
            {{ t('clinico.internacao.boletim.retidoTitulo') }}
          </h3>
          <InternacaoGravidade :gravidade="boletim.gravidade" />
        </header>

        <p class="retido__regra">{{ t('clinico.internacao.boletim.retidoRegra') }}</p>

        <blockquote class="retido__texto">{{ boletim.texto }}</blockquote>

        <p class="retido__passos">
          <span class="retido__passo" :class="{ 'retido__passo--feito': boletim.ligacaoEm }">
            <i :class="boletim.ligacaoEm ? 'ph ph-check-circle' : 'ph ph-phone'" aria-hidden="true" />
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
            icon="ph ph-phone"
            :loading="salvando"
            @click="emit('ligar', boletim.id)"
          />
          <Button
            :label="t('clinico.internacao.boletim.enviar')"
            icon="ph ph-paper-plane-tilt"
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

        <!--
          Os modelos ficam **acima** do campo, e não dentro de um menu.

          A ordem é a do trabalho: escolhe-se a situação e depois se ajusta o texto. Escondidos
          atrás de um "inserir modelo", eles viram um recurso que existe para quem já sabe que
          existe — e quem está com o paciente na mesa não vai procurar.
        -->
        <div v-if="modelos.length > 0" class="modelos">
          <span class="modelos__rotulo clinic-label">
            {{ t('clinico.internacao.boletim.modelosTitulo') }}
          </span>
          <div class="modelos__lista" role="group" :aria-label="t('clinico.internacao.boletim.modelosTitulo')">
            <button
              v-for="modelo in modelos"
              :key="modelo.id"
              type="button"
              class="modelo"
              :class="{ 'modelo--ativo': modeloEscolhido === modelo.id }"
              :aria-pressed="modeloEscolhido === modelo.id"
              @click="usarModelo(modelo)"
            >
              {{ modelo.rotulo }}
            </button>
          </div>
        </div>

        <ClinicField
          :rotulo="t('clinico.internacao.boletim.mensagem')"
          :dica="t('clinico.internacao.boletim.mensagemDica')"
        >
          <template #default="{ id }">
            <Textarea
              :id="id"
              v-model="rascunho"
              :placeholder="t('clinico.internacao.boletim.mensagemExemplo')"
              rows="5"
              auto-resize
              fluid
              @input="modeloEscolhido = ''"
            />
          </template>
        </ClinicField>

        <div class="composer__acoes">
          <Button
            :label="t('clinico.internacao.boletim.compor')"
            icon="ph ph-pencil-simple"
            :disabled="!rascunho.trim() || salvando"
            :loading="salvando"
            @click="compor"
          />
          <!--
            Limpar só aparece com algo escrito. Um botão que não faz nada em metade das visitas
            ensina a ignorá-lo justamente na metade em que ele faria.
          -->
          <Button
            v-if="rascunho.trim()"
            :label="t('clinico.internacao.boletim.limpar')"
            severity="secondary"
            text
            :disabled="salvando"
            @click="limpar"
          />
        </div>
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
              icon="ph ph-paper-plane-tilt"
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

.modelos {
  display: grid;
  gap: var(--clinic-space-2);
}

.modelos__lista {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

/*
 * Ficha, e não botão cheio.
 *
 * São sete numa fileira, e sete botões com peso de ação competiriam com o "Compor" que de fato
 * envia. A ficha diz "escolha", o botão diz "faça" — e aqui só um dos dois faz alguma coisa
 * acontecer do lado do responsável.
 */
.modelo {
  min-height: var(--clinic-hit-target);
  padding: 0 var(--clinic-space-3);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  white-space: nowrap;
}

.modelo:hover {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.modelo:focus-visible {
  outline: none;
  box-shadow: var(--clinic-focus-ring);
}

/* Anel e peso, não só fundo: a marcação precisa sobreviver à escala de cinza. */
.modelo--ativo {
  border-color: var(--clinic-accent-strong);
  background: var(--clinic-accent-tint);
  box-shadow: inset 0 0 0 1px var(--clinic-accent-strong);
  color: var(--clinic-accent-strong);
  font-weight: 800;
}

.composer__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
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
