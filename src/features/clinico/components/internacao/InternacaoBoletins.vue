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

import UiSecao from '@/components/ui/UiSecao.vue'

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
        O bloqueio, quando existe, é a primeira coisa da aba — e explica a regra na própria
        folha. Um botão desabilitado sem motivo escrito parece defeito, e defeito se contorna.
      -->
      <section
        v-for="boletim in retidos"
        :key="boletim.id"
        class="retido ui-folha ui-cartao"
        role="alert"
      >
        <header class="ui-cartao__cabeca ui-cartao__cabeca--risco retido__topo">
          <span class="ui-ladrilho ui-ladrilho--risco" aria-hidden="true">
            <i class="ph ph-lock-simple" />
          </span>
          <div class="ui-cartao__titulos">
            <h3 class="ui-cartao__titulo retido__titulo">
              {{ t('clinico.internacao.boletim.retidoTitulo') }}
            </h3>
            <p class="ui-cartao__descricao">{{ t('clinico.internacao.boletim.retidoRegra') }}</p>
          </div>
          <InternacaoGravidade :gravidade="boletim.gravidade" />
        </header>

        <div class="ui-cartao__corpo">
          <blockquote class="retido__texto">{{ boletim.texto }}</blockquote>
        </div>

        <footer class="ui-cartao__pe retido__pe">
          <p class="retido__passo" :class="{ 'retido__passo--feito': boletim.ligacaoEm }">
            <i
              :class="boletim.ligacaoEm ? 'ph ph-check-circle' : 'ph ph-phone-call'"
              aria-hidden="true"
            />
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
          </p>

          <div class="retido__acoes">
            <Button
              v-if="!boletim.ligacaoEm"
              type="button"
              :label="t('clinico.internacao.boletim.registrarLigacao')"
              icon="ph ph-phone"
              :loading="salvando"
              @click="emit('ligar', boletim.id)"
            />
            <Button
              type="button"
              :label="t('clinico.internacao.boletim.enviar')"
              icon="ph ph-paper-plane-tilt"
              :severity="boletim.ligacaoEm ? undefined : 'secondary'"
              :outlined="!boletim.ligacaoEm"
              :disabled="!boletim.ligacaoEm || salvando"
              @click="emit('enviar', boletim.id)"
            />
          </div>
        </footer>
      </section>

      <section
        v-if="prontos.length > 0"
        class="ui-folha ui-cartao"
        aria-labelledby="boletim-prontos-titulo"
      >
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-paper-plane-tilt" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="boletim-prontos-titulo" class="ui-cartao__titulo">
              {{ t('clinico.internacao.boletim.prontosTitulo') }}
            </h2>
          </span>
          <span class="ui-cartao__total">{{ prontos.length }}</span>
        </header>

        <ul class="ui-lista">
          <li v-for="boletim in prontos" :key="boletim.id" class="pronto">
            <p class="pronto__texto">{{ boletim.texto }}</p>
            <footer class="pronto__pe">
              <span class="pronto__meta">
                <span class="ui-hora">{{ formato.hora(boletim.geradoEm) }}</span>
                {{ t(`clinico.internacao.boletim.origem.${boletim.origem}`) }}
              </span>
              <Button
                type="button"
                :label="t('clinico.internacao.boletim.enviar')"
                icon="ph ph-paper-plane-tilt"
                size="small"
                :loading="salvando"
                @click="emit('enviar', boletim.id)"
              />
            </footer>
          </li>
        </ul>
      </section>

      <section class="ui-folha ui-cartao" aria-labelledby="boletim-compor-titulo">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-pencil-simple-line" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="boletim-compor-titulo" class="ui-cartao__titulo">
              {{ t('clinico.internacao.boletim.composerTitulo') }}
            </h2>
            <p class="ui-cartao__descricao">{{ t('clinico.internacao.boletim.composerAjuda') }}</p>
          </span>
        </header>

        <div class="compor ui-cartao__corpo">
          <!--
            Os modelos ficam **acima** do campo, e não dentro de um menu: escolhe-se a situação e
            depois se ajusta o texto. Escondidos atrás de um "inserir modelo", eles viram um
            recurso que existe só para quem já sabe que existe.
          -->
          <div v-if="modelos.length > 0" class="modelos">
            <span class="modelos__rotulo">{{ t('clinico.internacao.boletim.modelosTitulo') }}</span>
            <div
              class="modelos__lista"
              role="group"
              :aria-label="t('clinico.internacao.boletim.modelosTitulo')"
            >
              <button
                v-for="modelo in modelos"
                :key="modelo.id"
                type="button"
                class="modelo"
                :class="{ 'modelo--ativo': modeloEscolhido === modelo.id }"
                :aria-pressed="modeloEscolhido === modelo.id"
                @click="usarModelo(modelo)"
              >
                <i
                  v-if="modeloEscolhido === modelo.id"
                  class="ph ph-check"
                  aria-hidden="true"
                />
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
        </div>

        <footer class="ui-cartao__pe compor__acoes">
          <!--
              Limpar só aparece com algo escrito. Um botão que não faz nada em metade das visitas
              ensina a ignorá-lo justamente na metade em que ele faria.
            -->
          <Button
            v-if="rascunho.trim()"
            type="button"
            :label="t('clinico.internacao.boletim.limpar')"
            severity="secondary"
            text
            :disabled="salvando"
            @click="limpar"
          />
          <Button
            type="button"
            :label="t('clinico.internacao.boletim.compor')"
            icon="ph ph-pencil-simple"
            :disabled="!rascunho.trim() || salvando"
            :loading="salvando"
            @click="compor"
          />
        </footer>
      </section>

      <section class="ui-folha ui-cartao" aria-labelledby="boletim-frequencia-titulo">
        <header class="ui-cartao__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-bell-simple" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="boletim-frequencia-titulo" class="ui-cartao__titulo">
              {{ t('clinico.internacao.boletim.frequenciaTitulo') }}
            </h2>
            <p class="ui-cartao__descricao">
              {{ t('clinico.internacao.boletim.frequenciaAjuda') }}
            </p>
          </span>
        </header>

        <div class="frequencia ui-cartao__corpo">
          <div class="frequencia__linha">
            <ClinicField :rotulo="t('clinico.internacao.boletim.frequencia')">
              <template #default="{ id }">
                <Select
                  :input-id="id"
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
              <strong class="ui-num">
                {{ boletinsPorDia(preferencia.frequenciaHoras, preferencia.silencioNoturno) }}
              </strong>
              <span>
                {{
                  t(
                    'clinico.internacao.nova.boletim.mensagensPorDia',
                    {},
                    boletinsPorDia(preferencia.frequenciaHoras, preferencia.silencioNoturno),
                  )
                }}
              </span>
            </p>
          </div>

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
        </div>

        <footer v-if="proximo" class="ui-cartao__pe proximo">
          <i class="ph ph-clock" aria-hidden="true" />
          {{ t('clinico.internacao.boletim.proximo', { hora: formato.hora(proximo) }) }}
        </footer>
      </section>
    </div>

    <div class="boletins__coluna boletins__coluna--app">
      <UiSecao
        id="boletim-app"
        :titulo="t('clinico.internacao.boletim.appTitulo')"
        :descricao="t('clinico.internacao.boletim.appAjuda')"
        icone="ph ph-device-mobile"
      >
        <BoletimNoApp
          :boletins="boletins"
          :pet-nome="pet?.nome ?? ''"
          :pet-iniciais="pet?.iniciais ?? ''"
          :clinica-nome="clinico.clinic?.nome ?? ''"
        />
      </UiSecao>
    </div>
  </div>
</template>

<style scoped>
.boletins {
  display: grid;
  align-items: start;
  gap: 28px;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
}

.boletins__coluna {
  display: grid;
  min-width: 0;
  gap: 28px;
}

.boletins__coluna--app {
  position: sticky;
  top: 16px;
}

/* ----------------------------------------------------------------- retido
 * O único bloco de risco da aba — e só há um por vez, quase sempre nenhum. Cartão com cabeçalho
 * tingido de risco: a regra mora no cabeçalho, a mensagem no corpo, o passo e as ações no pé.
 */
.retido {
  border-color: color-mix(in oklab, var(--risco) 45%, var(--linha));
}

.retido__topo {
  align-items: flex-start;
}

.retido__titulo {
  color: var(--risco-tinta);
}

/* O que o responsável vai ler: citação, não caixa — o fio separa a mensagem do aviso. */
.retido__texto {
  margin: 0;
  padding: 2px 0 2px 14px;
  border-inline-start: 3px solid var(--linha-forte);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-line;
}

.retido__pe {
  justify-content: space-between;
}

.retido__passo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 600;
}

.retido__passo i {
  font-size: 18px;
}

.retido__passo--feito {
  color: var(--ok-tinta);
}

.retido__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ----------------------------------------------------------------- prontos */

.pronto {
  display: grid;
  gap: 10px;
  padding: 14px 24px;
}

.pronto__texto {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-line;
}

.pronto__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pronto__meta {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13px;
}

.pronto__meta .ui-hora {
  font-size: 14px;
}

/* ----------------------------------------------------------------- compor */

.compor {
  display: grid;
  gap: 16px;
}

.modelos {
  display: grid;
  gap: 8px;
}

.modelos__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.modelos__lista {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/*
 * Ficha, e não botão cheio: são sete numa fileira, e sete botões com peso de ação competiriam com
 * o "Gerar boletim", que é o único que faz alguma coisa acontecer do lado do responsável.
 */
.modelo {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--linha-media);
  border-radius: var(--raio-controle);
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  transition:
    background-color var(--pj-tempo-curto) ease,
    border-color var(--pj-tempo-curto) ease;
}

.modelo:hover {
  background: var(--superficie-2);
}

.modelo:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

/* Anel, ícone e peso, não só fundo: a marcação precisa sobreviver à escala de cinza. */
.modelo--ativo {
  border-color: var(--musgo);
  background: var(--musgo-fundo);
  box-shadow: inset 0 0 0 1px var(--musgo);
  color: var(--musgo);
  font-weight: 600;
}

.compor__acoes {
  justify-content: flex-end;
}

/* ----------------------------------------------------------------- frequência */

.frequencia {
  display: grid;
  gap: 16px;
}

.frequencia__linha {
  display: grid;
  align-items: end;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.opcao {
  display: flex;
  width: 100%;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.opcao__custo {
  color: var(--tinta-2);
  font-size: 13px;
}

/* O custo da escolha, em número grande: "24 mensagens por dia" se lê antes de confirmar. */
.custo {
  display: grid;
  justify-items: end;
  margin: 0;
  padding-bottom: 2px;
  line-height: 1.1;
  text-align: end;
}

.custo strong {
  color: var(--tinta);
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.custo span {
  max-width: 18ch;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.proximo {
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

@media (width <= 1100px) {
  .boletins {
    grid-template-columns: minmax(0, 1fr);
  }

  .boletins__coluna--app {
    position: static;
  }
}

@media (width <= 520px) {
  .frequencia__linha {
    grid-template-columns: minmax(0, 1fr);
  }

  .custo {
    justify-items: start;
    text-align: start;
  }
}
</style>
