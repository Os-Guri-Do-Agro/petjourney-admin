<script setup lang="ts">
/**
 * Página de referência do módulo clínico — entregável do épico A.
 *
 * É a régua da casa: componente que não passa aqui não entra na agenda nem no prontuário.
 * A página existe para ser **olhada**, não para passar em teste: os quatro estados lado a
 * lado, densidade alternando ao vivo, os três nomes extremos no mesmo cabeçalho, duzentas
 * linhas para julgar cansaço e um interruptor de escala de cinza para verificar que nenhuma
 * informação depende só da cor.
 *
 * Confira em 1280, 1024 e 768 antes de dar por pronta.
 */
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicDensityToggle from '@/features/clinico/components/base/ClinicDensityToggle.vue'
import ClinicField from '@/features/clinico/components/base/ClinicField.vue'
import ClinicForm from '@/features/clinico/components/base/ClinicForm.vue'
import ClinicPatientHeader from '@/features/clinico/components/base/ClinicPatientHeader.vue'
import ClinicRefValue from '@/features/clinico/components/base/ClinicRefValue.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { patientRepository, type PacienteResumo } from '@/features/clinico/data/repositories'
import type { AlertSeverity, Measurement, Pet, ReferenceRange } from '@/features/clinico/data/types'
import { useClinicoStore } from '@/features/clinico/stores/clinico'
import { toggleColorMode, isDarkMode } from '@/theme/color-mode'

type EstadoDemo = 'carregando' | 'erro' | 'vazio' | 'pronto'

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const estado = ref<EstadoDemo>('pronto')
const escalaDeCinza = ref(false)
const pacientes = ref<PacienteResumo[]>([])

const ESTADOS: EstadoDemo[] = ['carregando', 'erro', 'vazio', 'pronto']

onMounted(async () => {
  await clinico.carregar()
  pacientes.value = await patientRepository.buscar('')
})

/** Os três nomes que quebram cabeçalho: duas letras, longuíssimo e acentuação densa. */
const nomesExtremos = computed<Pet[]>(() =>
  ['pet-ni', 'pet-maximiliano', 'pet-acai']
    .map((id) => clinico.pet(id))
    .filter((pet): pet is Pet => Boolean(pet)),
)

const pacienteExemplo = computed(() => clinico.pet('pet-nina'))
const tutorExemplo = computed(() =>
  pacienteExemplo.value ? clinico.tutor(pacienteExemplo.value.tutorId) : null,
)

const faixaTemperatura = computed<ReferenceRange | null>(() =>
  clinico.faixaDe('temperatura', 'canina'),
)
const faixaFrequencia = computed<ReferenceRange | null>(() =>
  clinico.faixaDe('frequenciaCardiaca', 'canina'),
)

const medicoes: Array<{ rotulo: string; valor: Measurement; faixa: 'temp' | 'fc' }> = [
  { rotulo: 'Temperatura', valor: { valor: 38.4, naoAferido: false }, faixa: 'temp' },
  { rotulo: 'Temperatura', valor: { valor: 40.1, naoAferido: false }, faixa: 'temp' },
  { rotulo: 'Frequência cardíaca', valor: { valor: 52, naoAferido: false }, faixa: 'fc' },
  { rotulo: 'Frequência cardíaca', valor: { valor: null, naoAferido: true }, faixa: 'fc' },
  { rotulo: 'Frequência cardíaca', valor: { valor: null, naoAferido: false }, faixa: 'fc' },
]

const severidades: AlertSeverity[] = ['risco', 'atencao', 'info']

/** Duzentas linhas seguidas: o teste é de cansaço, não de correção. */
const linhasDeCansaco = computed(() => {
  const base = pacientes.value

  if (base.length === 0) {
    return []
  }

  return Array.from({ length: 200 }, (_, indice) => {
    const item = base[indice % base.length] as PacienteResumo

    return { ...item, chave: `${item.pet.id}-${indice}`, indice: indice + 1 }
  })
})

const colunas: ColunaTabela[] = [
  { id: 'ordem', rotulo: '#', largura: '3.2rem', numerico: true },
  { id: 'paciente', rotulo: t('clinico.pacientes.colunaPaciente'), largura: 'minmax(0, 2fr)' },
  {
    id: 'responsavel',
    rotulo: t('clinico.pacientes.colunaResponsavel'),
    largura: 'minmax(0, 1.6fr)',
    ocultarEmTelaEstreita: true,
  },
  { id: 'peso', rotulo: 'Peso', largura: '6rem', numerico: true, alinharAoFim: true },
  { id: 'alertas', rotulo: t('clinico.pacientes.colunaAlertas'), largura: 'minmax(0, 1fr)' },
]

const tokensDestacados = [
  '--clinic-surface',
  '--clinic-line',
  '--clinic-text',
  '--clinic-muted',
  '--clinic-accent',
  '--clinic-accent-strong',
  '--clinic-ok-bg',
  '--clinic-attention-bg',
  '--clinic-risk-bg',
  '--clinic-col-0',
  '--clinic-col-1',
  '--clinic-col-2',
  '--clinic-col-3',
  '--clinic-col-4',
  '--clinic-col-5',
]

const erroDemo = computed(() => (estado.value === 'erro' ? t('clinico.erros.agenda') : ''))

const demoQueixa = ref('Claudicação em membro pélvico direito')
const demoHistoria = ref(
  'Responsável relata início após caminhada longa, sem trauma observado.',
)
const demoApetite = ref('reduzido')
const opcoesApetite = computed(() =>
  (['normal', 'aumentado', 'reduzido', 'ausente'] as const).map((valor) => ({
    valor,
    rotulo: t(`clinico.prontuario.anamnese.opcoes.${valor}`),
  })),
)

const demoAchado = ref<'normal' | 'alterado' | 'nao-avaliado'>('alterado')
const demoSimNao = ref<boolean | null>(true)
const demoRisco = ref<'normal' | 'preferencial' | 'urgente'>('urgente')

const opcoesAchado = computed(() =>
  (
    [
      { valor: 'normal', tom: 'ok' },
      { valor: 'alterado', tom: 'atencao' },
      { valor: 'nao-avaliado', tom: 'neutro' },
    ] as const
  ).map((opcao) => ({
    valor: opcao.valor,
    tom: opcao.tom,
    rotulo: t(`clinico.prontuario.exameFisico.achado.${opcao.valor}`),
  })),
)

const opcoesSimNao = computed(() => [
  { valor: true, rotulo: t('clinico.prontuario.anamnese.opcoes.sim') },
  { valor: false, rotulo: t('clinico.prontuario.anamnese.opcoes.nao') },
])

const opcoesRisco = computed(() =>
  (
    [
      { valor: 'normal', tom: 'neutro' },
      { valor: 'preferencial', tom: 'atencao' },
      { valor: 'urgente', tom: 'risco' },
    ] as const
  ).map((opcao) => ({
    valor: opcao.valor,
    tom: opcao.tom,
    rotulo: t(`clinico.fila.prioridade.${opcao.valor}`),
  })),
)
</script>

<template>
  <main class="referencia clinic-scope" :class="{ 'referencia--cinza': escalaDeCinza }">
    <header class="referencia__cabecalho">
      <div>
        <p class="clinic-label">{{ t('clinico.design.subtitulo') }}</p>
        <h1 class="referencia__titulo">{{ t('clinico.design.titulo') }}</h1>
        <p class="referencia__lede">{{ t('clinico.design.descricao') }}</p>
        <p class="referencia__nota">
          <i class="pi pi-desktop" aria-hidden="true" />
          {{ t('clinico.design.larguras') }}
        </p>
      </div>

      <div class="referencia__controles">
        <ClinicDensityToggle />

        <label class="referencia__switch">
          <input v-model="escalaDeCinza" type="checkbox" />
          <span>{{ t('clinico.design.escalaDeCinza') }}</span>
        </label>

        <button type="button" class="referencia__botao clinic-focusable" @click="toggleColorMode">
          <i :class="isDarkMode ? 'pi pi-sun' : 'pi pi-moon'" aria-hidden="true" />
          <span>{{ isDarkMode ? 'Claro' : 'Escuro' }}</span>
        </button>
      </div>
    </header>

    <p v-if="escalaDeCinza" class="referencia__aviso" role="status">
      {{ t('clinico.design.escalaDeCinzaDescricao') }}
    </p>

    <!-- ------------------------------------------------------------ quatro estados -->
    <section class="secao">
      <div class="secao__cabecalho">
        <h2 class="secao__titulo">{{ t('clinico.design.estados') }}</h2>

        <div class="segmentado" role="radiogroup" :aria-label="t('clinico.design.estados')">
          <button
            v-for="opcao in ESTADOS"
            :key="opcao"
            type="button"
            class="segmentado__botao clinic-focusable"
            :class="{ 'segmentado__botao--ativo': estado === opcao }"
            role="radio"
            :aria-checked="estado === opcao"
            @click="estado = opcao"
          >
            {{ t(`clinico.design.estado.${opcao}`) }}
          </button>
        </div>
      </div>

      <div class="vitrine">
        <!-- PatientHeader -->
        <article class="vitrine__item">
          <h3 class="vitrine__nome">ClinicPatientHeader</h3>

          <div v-if="estado === 'carregando'" class="esqueleto esqueleto--alto" aria-hidden="true" />
          <p v-else-if="estado === 'erro'" class="estado-erro" role="alert">
            <i class="pi pi-exclamation-circle" aria-hidden="true" />
            {{ erroDemo }}
          </p>
          <p v-else-if="estado === 'vazio'" class="estado-vazio">
            <i class="pi pi-user" aria-hidden="true" />
            {{ t('clinico.pacientes.vazioTitulo') }}
          </p>
          <ClinicPatientHeader v-else :pet="pacienteExemplo" :tutor="tutorExemplo" />
        </article>

        <!-- AlertChip -->
        <article class="vitrine__item">
          <h3 class="vitrine__nome">ClinicAlertChip</h3>

          <div v-if="estado === 'carregando'" class="esqueleto" aria-hidden="true" />
          <p v-else-if="estado === 'erro'" class="estado-erro" role="alert">
            <i class="pi pi-exclamation-circle" aria-hidden="true" />
            {{ erroDemo }}
          </p>
          <p v-else-if="estado === 'vazio'" class="estado-vazio">
            <i class="pi pi-check-circle" aria-hidden="true" />
            Nenhum alerta neste paciente
          </p>
          <div v-else class="vitrine__linha">
            <ClinicAlertChip
              v-for="severidade in severidades"
              :key="severidade"
              :severidade="severidade"
              :rotulo="formato.severidade(severidade)"
              detalhe="Detalhe curto"
            />
            <ClinicAlertChip severidade="risco" rotulo="Alergia" detalhe="Amoxicilina" compacto />
          </div>
        </article>

        <!-- RefValue -->
        <article class="vitrine__item">
          <h3 class="vitrine__nome">ClinicRefValue</h3>

          <div v-if="estado === 'carregando'" class="esqueleto" aria-hidden="true" />
          <p v-else-if="estado === 'erro'" class="estado-erro" role="alert">
            <i class="pi pi-exclamation-circle" aria-hidden="true" />
            {{ erroDemo }}
          </p>
          <p v-else-if="estado === 'vazio'" class="estado-vazio">
            <i class="pi pi-minus-circle" aria-hidden="true" />
            Exame físico ainda não preenchido
          </p>
          <div v-else class="vitrine__grade">
            <ClinicRefValue
              v-for="(medicao, indice) in medicoes"
              :key="indice"
              :rotulo="medicao.rotulo"
              :valor="medicao.valor"
              :faixa="medicao.faixa === 'temp' ? faixaTemperatura : faixaFrequencia"
            />
            <ClinicRefValue rotulo="Peso" :valor="{ valor: 12.4, naoAferido: false }" :faixa="null" />
          </div>
        </article>

        <!-- ClinicToggleGroup -->
        <article class="vitrine__item">
          <h3 class="vitrine__nome">ClinicToggleGroup</h3>

          <div v-if="estado === 'carregando'" class="esqueleto" aria-hidden="true" />
          <p v-else-if="estado === 'erro'" class="estado-erro" role="alert">
            <i class="pi pi-exclamation-circle" aria-hidden="true" />
            {{ erroDemo }}
          </p>
          <p v-else-if="estado === 'vazio'" class="estado-vazio">
            <i class="pi pi-minus-circle" aria-hidden="true" />
            Nada escolhido ainda
          </p>
          <!--
            O ponto desta vitrine é a **marcação**: em escala de cinza o anel e o peso da
            opção escolhida têm que bastar. O tom só acrescenta o significado por cima.
          -->
          <div v-else class="vitrine__coluna">
            <ClinicToggleGroup
              v-model="demoAchado"
              :opcoes="opcoesAchado"
              rotulo="Achado do sistema"
            />
            <ClinicToggleGroup
              v-model="demoSimNao"
              :opcoes="opcoesSimNao"
              rotulo="Vacinação em dia"
              limpavel
              :vazio="null"
            />
            <ClinicToggleGroup
              v-model="demoRisco"
              :opcoes="opcoesRisco"
              rotulo="Prioridade"
            />
          </div>
        </article>

        <!-- ClinicForm + ClinicField -->
        <article class="vitrine__item vitrine__item--largo">
          <h3 class="vitrine__nome">ClinicForm · ClinicField</h3>

          <div v-if="estado === 'carregando'" class="esqueleto esqueleto--alto" aria-hidden="true" />
          <ClinicForm
            v-else
            :titulo="t('clinico.prontuario.anamnese.titulo')"
            :descricao="t('clinico.prontuario.anamnese.descricao')"
            :somente-leitura="estado === 'vazio'"
            :motivo-somente-leitura="
              estado === 'vazio'
                ? t('clinico.prontuario.somenteLeitura', {
                    dispositivo: 'Recepção · Chrome',
                    desde: '09:12',
                  })
                : ''
            "
          >
            <ClinicField
              :rotulo="t('clinico.prontuario.anamnese.queixaPrincipal')"
              obrigatorio
              atalho="Q"
              :erro="estado === 'erro' ? 'Campo obrigatório' : ''"
            >
              <template #default="{ id, descrito }">
                <InputText
                  :id="id"
                  v-model="demoQueixa"
                  fluid
                  :aria-describedby="descrito"
                  :disabled="estado === 'vazio'"
                />
              </template>
            </ClinicField>

            <!--
              Select existe aqui de propósito: o painel dele é teleportado para fora da página
              e é onde o fundo claro no modo escuro aparecia. A classe `clinic-overlay` é o que
              faz o overlay pintar o próprio fundo.
            -->
            <ClinicField :rotulo="t('clinico.prontuario.anamnese.apetite')" atalho="A">
              <template #default="{ id }">
                <Select
                  :input-id="id"
                  v-model="demoApetite"
                  :options="opcoesApetite"
                  option-label="rotulo"
                  option-value="valor"
                  fluid
                  :disabled="estado === 'vazio'"
                  :pt="{ overlay: { class: 'clinic-overlay' } }"
                />
              </template>
            </ClinicField>

            <ClinicField :rotulo="t('clinico.prontuario.anamnese.historia')" largo>
              <template #default="{ id }">
                <Textarea
                  :id="id"
                  v-model="demoHistoria"
                  rows="3"
                  fluid
                  auto-resize
                  :disabled="estado === 'vazio'"
                />
              </template>
            </ClinicField>
          </ClinicForm>
        </article>
      </div>
    </section>

    <!-- --------------------------------------------------------- nomes extremos -->
    <section class="secao">
      <div class="secao__cabecalho">
        <div>
          <h2 class="secao__titulo">{{ t('clinico.design.nomesExtremos') }}</h2>
          <p class="secao__lede">{{ t('clinico.design.nomesExtremosDescricao') }}</p>
        </div>
      </div>

      <div class="extremos">
        <ClinicPatientHeader
          v-for="pet in nomesExtremos"
          :key="pet.id"
          :pet="pet"
          :tutor="clinico.tutor(pet.tutorId)"
        >
          <template #acoes>
            <button type="button" class="referencia__botao clinic-focusable">
              {{ t('clinico.paciente.abrirProntuario') }}
            </button>
          </template>
        </ClinicPatientHeader>
      </div>
    </section>

    <!-- ------------------------------------------------------------- 200 linhas -->
    <section class="secao">
      <div class="secao__cabecalho">
        <div>
          <h2 class="secao__titulo">{{ t('clinico.design.cansaco') }}</h2>
          <p class="secao__lede">{{ t('clinico.design.cansacoDescricao') }}</p>
        </div>
      </div>

      <div class="cansaco">
        <ClinicDataTable
          :colunas="colunas"
          :linhas="linhasDeCansaco"
          :chave="(linha) => linha.chave"
          :carregando="estado === 'carregando'"
          :erro="erroDemo"
          :vazio-titulo="t('clinico.pacientes.vazioTitulo')"
          :vazio-descricao="t('clinico.pacientes.vazioDescricao')"
          :rotulo="t('clinico.design.cansaco')"
        >
          <template #celula-ordem="{ linha }">{{ linha.indice }}</template>
          <template #celula-paciente="{ linha }">
            <strong class="cansaco__nome">{{ linha.pet.nome }}</strong>
            <span class="cansaco__meta">
              {{ formato.especie(linha.pet.especie) }} · {{ linha.pet.raca }}
            </span>
          </template>
          <template #celula-responsavel="{ linha }">{{ linha.tutor?.nome }}</template>
          <template #celula-peso="{ linha }">{{ formato.peso(linha.pet.pesoKg) }}</template>
          <template #celula-alertas="{ linha }">
            <span v-if="linha.pet.alertas.length === 0" class="cansaco__meta">—</span>
            <ClinicAlertChip
              v-for="alerta in linha.pet.alertas"
              :key="alerta.id"
              :severidade="alerta.severidade"
              :rotulo="formato.alerta(alerta.kind)"
              compacto
            />
          </template>
        </ClinicDataTable>
      </div>
    </section>

    <!-- ----------------------------------------------------------------- tokens -->
    <section class="secao">
      <h2 class="secao__titulo">{{ t('clinico.design.tokens') }}</h2>

      <ul class="tokens">
        <li v-for="token in tokensDestacados" :key="token" class="tokens__item">
          <span class="tokens__amostra" :style="{ background: `var(${token})` }" aria-hidden="true" />
          <code>{{ token }}</code>
        </li>
      </ul>
    </section>

    <!-- --------------------------------------------------------------- feedback -->
    <section class="secao secao--feedback">
      <h2 class="secao__titulo">{{ t('clinico.design.feedback') }}</h2>
      <p class="secao__lede">{{ t('clinico.design.feedbackVazio') }}</p>
    </section>
  </main>
</template>

<style scoped>
.referencia {
  display: grid;
  gap: var(--clinic-space-6);
  min-height: 100vh;
  padding: var(--clinic-space-6);
  background: var(--clinic-bg);
}

/* O interruptor de cinza é o teste, não um tema: derruba a cor de tudo que está abaixo. */
.referencia--cinza {
  filter: grayscale(1);
}

.referencia__cabecalho {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--clinic-space-4);
}

.referencia__titulo {
  margin: 0.2rem 0 0;
  font-size: clamp(1.4rem, 2.2vw, 1.85rem);
  font-weight: 750;
  letter-spacing: -0.03em;
}

.referencia__lede {
  max-width: 62ch;
  margin: 0.4rem 0 0;
  color: var(--clinic-muted);
  line-height: 1.6;
}

.referencia__nota {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0.5rem 0 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.referencia__controles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-3);
}

.referencia__switch {
  display: inline-flex;
  min-height: var(--clinic-hit-target);
  align-items: center;
  gap: 0.4rem;
  padding: 0 var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.referencia__botao {
  display: inline-flex;
  min-height: var(--clinic-hit-target);
  align-items: center;
  gap: 0.35rem;
  padding: 0 var(--clinic-space-3);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-text);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.referencia__aviso {
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px dashed var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
}

.secao {
  display: grid;
  gap: var(--clinic-space-4);
}

.secao__cabecalho {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.secao__titulo {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.secao__lede {
  max-width: 70ch;
  margin: 0.25rem 0 0;
  color: var(--clinic-muted);
  line-height: 1.55;
}

.segmentado {
  display: inline-flex;
  padding: 2px;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.segmentado__botao {
  min-height: var(--clinic-hit-target);
  padding: 0 var(--clinic-space-4);
  border: none;
  border-radius: calc(var(--clinic-radius-control) - 2px);
  background: transparent;
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Anel + peso: a marcação precisa se ler antes da cor, e sobreviver à escala de cinza. */
.segmentado__botao--ativo {
  background: var(--clinic-surface);
  box-shadow:
    var(--clinic-shadow-card),
    inset 0 0 0 1.5px var(--clinic-accent-strong);
  color: var(--clinic-accent-strong);
  font-weight: 800;
}

.vitrine {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
  align-items: start;
  gap: var(--clinic-space-4);
}

.vitrine__item {
  display: grid;
  align-content: start;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface-soft);
}

.vitrine__item--largo {
  grid-column: 1 / -1;
}

.vitrine__nome {
  margin: 0;
  color: var(--clinic-faint);
  font-family: ui-monospace, 'SFMono-Regular', 'Cascadia Mono', monospace;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.vitrine__linha {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-2);
}

.vitrine__coluna {
  display: grid;
  justify-items: start;
  gap: var(--clinic-space-3);
}

.vitrine__grade {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
  gap: var(--clinic-space-2);
}

.esqueleto {
  height: 3.5rem;
  border-radius: var(--clinic-radius-control);
  background: linear-gradient(
    90deg,
    var(--clinic-surface) 0%,
    var(--clinic-surface-sunken) 50%,
    var(--clinic-surface) 100%
  );
  background-size: 200% 100%;
  animation: brilho 1.4s ease-in-out infinite;
}

.esqueleto--alto {
  height: 7rem;
}

@keyframes brilho {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}

.estado-erro,
.estado-vazio {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
}

.estado-erro {
  border-color: var(--clinic-risk-line);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

.extremos {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  align-items: start;
  gap: var(--clinic-space-4);
}

.cansaco {
  max-height: 30rem;
  overflow: auto;
  border-radius: var(--clinic-radius-card);
}

.cansaco__nome {
  display: block;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cansaco__meta {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.tokens {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.tokens__item {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-2);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
}

.tokens__amostra {
  width: 1.5rem;
  height: 1.5rem;
  flex: 0 0 auto;
  border: 1px solid var(--clinic-line-strong);
  border-radius: 0.4rem;
}

.tokens__item code {
  overflow: hidden;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  text-overflow: ellipsis;
}

.secao--feedback {
  padding: var(--clinic-space-5);
  border: 1px dashed var(--clinic-line-strong);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

@media (max-width: 768px) {
  .referencia {
    padding: var(--clinic-space-4);
  }
}
</style>
