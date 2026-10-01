<script setup lang="ts">
/**
 * Um remédio de casa na ficha do paciente: a faixa, a conta do período e, quando é o caso, o
 * alerta.
 *
 * A ordem da leitura é a do retorno. Primeiro **o que é** (nome e posologia), depois **como foi**
 * (a faixa e a frase "desde a consulta de 19/08: 39 dadas · 1 pulada · 1 sem registro"), e só
 * então **o que fazer** — o alerta, quando há, com o registro da conversa ao lado.
 *
 * O alerta segue a regra da casa: a urgência mora no ícone e na palavra, não na superfície. Não há
 * faixa colorida em volta do bloco; há o selo, o ícone coral e a frase com o motivo que a própria
 * casa deu.
 *
 * Os registros ficam recolhidos. Abertos, são a versão sem cor da faixa — a tabela que o leitor de
 * tela e a impressão leem.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { PhChatCircleText, PhHeartbeat, PhLockSimple, PhWarning } from '@phosphor-icons/vue'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicDataTable from '../base/ClinicDataTable.vue'
import type { ColunaTabela } from '../base/table-types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoTratamento } from '../../composables/useRotulosDoTratamento'
import type { TratamentoNaFicha } from '../../data/repositories'
import { diasDaFaixa, horarioDestoante, type DoseNaGrade } from '../../domain/adesao'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

import FaixaDeDoses from './FaixaDeDoses.vue'

const props = withDefaults(
  defineProps<{
    lido: TratamentoNaFicha
    ultimaConsultaEm: string | null
    /** Quem cuida, pelo id: o nome que aparece no registro. */
    nomes: Record<string, string>
    /** Encerrado: sem alerta, sem controle, só a conta. */
    encerrado?: boolean
    salvando?: boolean
  }>(),
  { encerrado: false, salvando: false },
)

const emit = defineEmits<{
  critico: [valor: boolean]
  contato: [dados: { professionalId: string; nota: string }]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const rotulos = useRotulosDoTratamento()
const clinico = useClinicoStore()
const idDoCritico = useId()
const idDaNota = useId()
const idDeQuem = useId()

const tratamento = computed(() => props.lido.tratamento)
const nome = computed(() => rotulos.nome(tratamento.value))
const alerta = computed(() => (props.lido.alerta ? rotulos.alerta(props.lido.alerta) : null))
const destoante = computed(() => horarioDestoante(props.lido.periodo))

/** Seis semanas, ou o bastante para a última consulta caber — encerrado, três semanas bastam. */
const dias = computed(() =>
  props.encerrado ? 21 : diasDaFaixa(props.ultimaConsultaEm, clinicClock.today()),
)

const rotuloDaFaixa = computed(
  () =>
    `${nome.value}: ${rotulos.periodo(props.lido.periodo, props.ultimaConsultaEm)}, ${rotulos.contagem(props.lido.periodo)}`,
)

const periodoDoEncerrado = computed(() =>
  t('clinico.adesao.ficha.encerradosPeriodo', {
    inicio: formato.dataCurta(clinicClock.dateOf(tratamento.value.inicioEm)),
    fim: formato.dataCurta(
      clinicClock.dateOf(
        tratamento.value.encerradoEm ?? props.lido.ultimaDoseEm ?? tratamento.value.inicioEm,
      ),
    ),
  }),
)

// ------------------------------------------------------------------ contato

const registrandoContato = ref(false)
const quemFalou = ref<string>(tratamento.value.prescritoPor)
const nota = ref('')

const profissionais = computed(() =>
  clinico.profissionais
    .filter((item) => item.ativo)
    .map((item) => ({ valor: item.id, rotulo: item.nome })),
)

const contato = computed(() => {
  const registrado = tratamento.value.contato

  if (!registrado) {
    return null
  }

  return {
    texto: t('clinico.adesao.alerta.contato', {
      nome: clinico.profissional(registrado.professionalId)?.nome ?? '',
      quando: formato.relativo(registrado.em),
    }),
    nota: registrado.nota,
  }
})

function salvarContato() {
  emit('contato', { professionalId: quemFalou.value, nota: nota.value })
  registrandoContato.value = false
  nota.value = ''
}

// ------------------------------------------------------------------ registros

const verRegistros = ref(false)

type LinhaDeRegistro = DoseNaGrade

const registros = computed<LinhaDeRegistro[]>(() =>
  props.lido.doses
    .filter((dose) => dose.situacao !== 'prevista')
    .filter((dose) => Date.parse(dose.previstaEm) >= Date.parse(props.lido.periodo.desde))
    .reverse(),
)

const colunas = computed<ColunaTabela<LinhaDeRegistro>[]>(() => [
  {
    id: 'quando',
    rotulo: t('clinico.adesao.registros.colunaQuando'),
    largura: '8.5rem',
    ordenarPor: (linha) => linha.previstaEm,
    ordemInicial: 'desc',
  },
  {
    id: 'situacao',
    rotulo: t('clinico.adesao.registros.colunaSituacao'),
    largura: 'minmax(0, 1.2fr)',
  },
  { id: 'quem', rotulo: t('clinico.adesao.registros.colunaQuem'), largura: 'minmax(0, 1fr)' },
])

function textoDaSituacao(dose: DoseNaGrade): string {
  const situacao = t(`clinico.adesao.situacao.${dose.situacao}`)

  return dose.situacao === 'pulada' && dose.registro?.motivo
    ? `${situacao} · ${t(`clinico.adesao.motivoNaFrase.${dose.registro.motivo}`)}`
    : situacao
}
</script>

<template>
  <article class="trat" :class="{ 'trat--encerrado': encerrado }">
    <header class="trat__cabeca">
      <div class="trat__identidade">
        <h3 class="trat__nome">{{ nome }}</h3>
        <p class="trat__posologia">
          {{ rotulos.posologia(tratamento) }}
          <template v-if="encerrado"> · {{ periodoDoEncerrado }}</template>
        </p>
      </div>

      <span v-if="lido.alerta" class="hc-selo hc--coral trat__selo">
        <PhWarning class="trat__selo-icone" weight="fill" aria-hidden="true" />
        {{ t('clinico.adesao.alerta.selo') }}
      </span>
      <span v-else-if="tratamento.critico && !encerrado" class="hc-selo hc--cinza trat__selo">
        <PhHeartbeat class="trat__selo-icone" weight="duotone" aria-hidden="true" />
        {{ t('clinico.adesao.critico.selo') }}
      </span>
    </header>

    <template v-if="lido.compartilhado">
      <FaixaDeDoses
        :doses="lido.doses"
        :frequencia-horas="tratamento.frequenciaHoras"
        :rotulo="rotuloDaFaixa"
        :marco="encerrado ? null : ultimaConsultaEm"
        :nomes="nomes"
        :compacta="encerrado"
        :dias="dias"
      />

      <p class="trat__contagem">
        <strong>{{ rotulos.periodo(lido.periodo, ultimaConsultaEm) }}:</strong>
        {{ rotulos.contagem(lido.periodo) }}
      </p>

      <p v-if="rotulos.quem(lido.periodo, nomes) || destoante" class="trat__detalhe">
        <span v-if="rotulos.quem(lido.periodo, nomes)">{{
          rotulos.quem(lido.periodo, nomes)
        }}</span>
        <span v-if="destoante" class="trat__destoante">{{
          rotulos.horarioDestoante(destoante)
        }}</span>
      </p>

      <!--
        O alerta: ícone e palavra em coral, a superfície neutra. A ligação a clínica faz como já
        faz, pelo telefone do cadastro; aqui fica o registro da conversa — é ela que apaga o
        alerta, não o tempo.
      -->
      <section v-if="alerta && !encerrado" class="trat__alerta" role="status">
        <PhWarning class="trat__alerta-icone" weight="fill" aria-hidden="true" />
        <div class="trat__alerta-texto">
          <strong>{{ alerta.titulo }}</strong>
          <span v-if="alerta.detalhe">{{ alerta.detalhe }}</span>
        </div>

        <div v-if="!registrandoContato" class="trat__alerta-acoes">
          <Button
            class="hc-pilula"
            :label="t('clinico.adesao.alerta.registrarContato')"
            @click="registrandoContato = true"
          >
            <template #icon>
              <PhChatCircleText class="hc-pilula__icone" weight="duotone" aria-hidden="true" />
            </template>
          </Button>
        </div>

        <form v-if="registrandoContato" class="trat__contato-form" @submit.prevent="salvarContato">
          <div class="trat__campo">
            <label :for="idDeQuem">{{ t('clinico.adesao.alerta.quemFalou') }}</label>
            <Select
              v-model="quemFalou"
              :input-id="idDeQuem"
              :options="profissionais"
              option-label="rotulo"
              option-value="valor"
            />
          </div>
          <div class="trat__campo trat__campo--nota">
            <label :for="idDaNota">{{ t('clinico.adesao.alerta.nota') }}</label>
            <InputText
              :id="idDaNota"
              v-model="nota"
              :placeholder="t('clinico.adesao.alerta.notaPlaceholder')"
              maxlength="280"
            />
          </div>
          <div class="trat__contato-acoes">
            <Button
              type="submit"
              class="hc-pilula hc-pilula--cheia"
              :label="t('clinico.adesao.alerta.salvar')"
              :loading="salvando"
            />
            <Button
              type="button"
              class="hc-pilula"
              :label="t('clinico.adesao.alerta.cancelar')"
              @click="registrandoContato = false"
            />
          </div>
        </form>
      </section>

      <p v-else-if="contato && !encerrado" class="trat__contato">
        <PhChatCircleText class="trat__contato-icone" weight="duotone" aria-hidden="true" />
        <span>
          {{ contato.texto }}
          <q v-if="contato.nota">{{ contato.nota }}</q>
        </span>
      </p>

      <div v-if="!encerrado" class="trat__rodape">
        <div class="trat__critico">
          <ToggleSwitch
            :model-value="tratamento.critico"
            :input-id="idDoCritico"
            :disabled="salvando"
            @update:model-value="emit('critico', Boolean($event))"
          />
          <label :for="idDoCritico">{{ t('clinico.adesao.critico.alternar') }}</label>
        </div>

        <Button
          class="hc-pilula"
          :label="
            verRegistros
              ? t('clinico.adesao.registros.esconder')
              : t('clinico.adesao.registros.ver')
          "
          :aria-expanded="verRegistros"
          @click="verRegistros = !verRegistros"
        />
      </div>

      <ClinicDataTable
        v-if="verRegistros && !encerrado"
        :colunas="colunas"
        :linhas="registros"
        :chave="(linha) => String(linha.numero)"
        :vazio-titulo="t('clinico.adesao.registros.vazio')"
        :rotulo="t('clinico.adesao.registros.rotulo', { medicamento: nome })"
      >
        <template #celula-quando="{ linha }">
          <strong class="clinic-value">{{ rotulos.diaEHora(linha.previstaEm) }}</strong>
        </template>
        <template #celula-situacao="{ linha }">
          <span class="trat__situacao faixa-cores">
            <span
              class="trat__amostra"
              :class="`trat__amostra--${linha.situacao}`"
              aria-hidden="true"
            />
            {{ textoDaSituacao(linha) }}
          </span>
        </template>
        <template #celula-quem="{ linha }">
          <template v-if="linha.registro">
            <span class="trat__quem">{{ nomes[linha.registro.cuidadorId] ?? '' }}</span>
            <span class="trat__meta">
              {{
                t('clinico.adesao.registros.registradaAs', {
                  quando: rotulos.diaEHora(linha.registro.registradaEm),
                })
              }}
            </span>
          </template>
          <span v-else class="trat__meta">—</span>
        </template>
      </ClinicDataTable>
    </template>

    <p v-else class="trat__nao-compartilhado">
      <PhLockSimple class="trat__contato-icone" weight="duotone" aria-hidden="true" />
      <span>
        <strong>{{ t('clinico.adesao.naoCompartilhado') }}</strong>
        {{ t('clinico.adesao.naoCompartilhadoDetalhe') }}
      </span>
    </p>
  </article>
</template>

<style scoped>
.trat {
  display: grid;
  gap: 0.7rem;
  min-width: 0;
}

.trat__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.35rem 0.75rem;
}

.trat__identidade {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.trat__nome {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.trat__posologia {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.trat__selo {
  gap: 0.3rem;
}

.trat__selo-icone {
  flex-shrink: 0;
  width: 0.9rem;
  height: 0.9rem;
}

.trat__contagem {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.trat__contagem strong {
  font-weight: 600;
}

.trat__detalhe {
  display: flex;
  flex-wrap: wrap;
  margin: -0.35rem 0 0;
  gap: 0.2rem 1rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.trat__destoante {
  color: var(--hc-tinta);
  font-weight: 600;
}

/* ------------------------------------------------------------------ alerta */

.trat__alerta {
  display: grid;
  align-items: start;
  gap: 0.6rem 0.6rem;
  grid-template-columns: auto minmax(0, 1fr);
}

.trat__alerta-icone {
  width: 1.15rem;
  height: 1.15rem;
  margin-top: 0.1rem;
  color: var(--hc-coral-tinta);
}

.trat__alerta-texto {
  display: grid;
  gap: 0.15rem;
  font-size: 0.875rem;
}

.trat__alerta-texto strong {
  color: var(--hc-coral-tinta);
  font-weight: 650;
}

.trat__alerta-texto span {
  color: var(--hc-tinta-2);
}

.trat__alerta-acoes,
.trat__contato-form {
  display: flex;
  flex-wrap: wrap;
  grid-column: 2;
  align-items: flex-end;
  gap: 0.5rem;
}

.trat__campo {
  display: grid;
  gap: 0.25rem;
  min-width: 12rem;
}

.trat__campo--nota {
  flex: 1 1 16rem;
}

.trat__campo label {
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-weight: 600;
}

.trat__contato-acoes {
  display: flex;
  gap: 0.5rem;
}

.trat__contato,
.trat__nao-compartilhado {
  display: flex;
  align-items: flex-start;
  margin: 0;
  gap: 0.45rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.trat__contato q {
  margin-inline-start: 0.25rem;
  color: var(--hc-tinta);
  font-style: italic;
}

.trat__nao-compartilhado strong {
  display: block;
  color: var(--hc-tinta);
  font-weight: 600;
}

.trat__contato-icone {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  margin-top: 0.1rem;
  color: var(--hc-marca);
}

/* ------------------------------------------------------------------ rodapé */

.trat__rodape {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.trat__critico {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.trat__critico label {
  cursor: pointer;
}

.trat__situacao {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.trat__amostra {
  width: 0.625rem;
  height: 0.625rem;
  flex-shrink: 0;
  border-radius: 2px;
}

.trat__amostra--dada {
  background: var(--faixa-dada);
}

.trat__amostra--pulada {
  background: var(--faixa-pulada);
}

.trat__amostra--sem-registro {
  background: var(--faixa-sem-registro);
}

.trat__amostra--aberta {
  box-shadow: inset 0 0 0 1.5px var(--faixa-agora);
}

.trat__quem {
  display: block;
  font-weight: 600;
}

.trat__meta {
  display: block;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}
</style>
