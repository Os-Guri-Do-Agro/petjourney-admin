<script setup lang="ts">
/**
 * Tratamentos em casa — o remédio que saiu da clínica, visto de todos os pacientes de uma vez.
 *
 * É onde o alerta da clínica mora. A ficha de cada paciente mostra o tratamento dele; esta tela
 * responde a pergunta de quem abre o dia: **para quem a clínica precisa ligar?** Por isso abre
 * no recorte "Pedem atenção" — os tratamentos críticos cuja adesão caiu —, e o selo do menu e a
 * Visão geral contam o mesmo número.
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * Uma lista **por paciente**, não por remédio: a ligação é para uma casa, e a casa responde por
 * todos os remédios do bicho. Cada paciente abre com o rosto, quem cuida e o telefone, e as duas
 * ações — ligar e abrir a ficha. Embaixo, um remédio por linha, com a faixa dos últimos 14 dias
 * em tamanho de leitura (horários à esquerda, datas embaixo), a conta da mesma janela e, quando a
 * adesão caiu, o selo e a frase do alerta: o que aconteceu, o motivo que a casa deu, e como era
 * antes. É o que a clínica precisa saber antes de discar.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import ClinicToggleGroup from '@/features/clinico/components/base/ClinicToggleGroup.vue'
import FaixaDeDoses from '@/features/clinico/components/tratamento/FaixaDeDoses.vue'
import LegendaDaFaixa from '@/features/clinico/components/tratamento/LegendaDaFaixa.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useRotulosDoTratamento } from '@/features/clinico/composables/useRotulosDoTratamento'
import { tratamentoRepository, type LinhaDeTratamento } from '@/features/clinico/data/repositories'
import { dosesNoPeriodo, resumirAdesao } from '@/features/clinico/domain/adesao'
import { epochToWall, wallToIso } from '@/features/clinico/domain/clinic-time'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

type Recorte = 'atencao' | 'emCurso' | 'encerrados'

/** A janela da faixa na lista: duas semanas cabem numa linha e mostram o ritmo. */
const JANELA_DIAS = 14

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoTratamento()

const linhas = ref<LinhaDeTratamento[]>([])
const carregando = ref(false)
const erro = ref('')
const recorte = ref<Recorte>('atencao')

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()
    linhas.value = await tratamentoRepository.daClinica()

    /* Sem nada pedindo atenção, abrir no recorte vazio esconderia o que existe. */
    if (porRecorte.value.atencao.length === 0) {
      recorte.value = 'emCurso'
    }
  } catch {
    erro.value = t('clinico.erros.agenda')
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)

const porRecorte = computed(() => ({
  atencao: linhas.value.filter((linha) => linha.alerta !== null),
  emCurso: linhas.value.filter((linha) => linha.emCurso),
  encerrados: linhas.value.filter((linha) => !linha.emCurso),
}))

/**
 * A frase de estado: quantos tratamentos pedem uma ligação hoje, e quantos estão em curso. O
 * número de críticos fica no selo de cada remédio — na frase, era o terceiro número de três.
 */
const fraseDoResumo = computed(() => {
  if (carregando.value && linhas.value.length === 0) {
    return ''
  }

  const atencao = porRecorte.value.atencao.length
  const emCurso = porRecorte.value.emCurso.length

  return [
    atencao > 0
      ? t('clinico.adesao.resumo.atencao', { total: atencao }, atencao)
      : t('clinico.adesao.resumo.semAtencao'),
    t('clinico.adesao.resumo.emCurso', { total: emCurso }, emCurso),
  ].join(' ')
})

const opcoesDoRecorte = computed(() => [
  {
    valor: 'atencao' as const,
    rotulo: t('clinico.adesao.lista.recorte.atencao'),
    contagem: porRecorte.value.atencao.length,
    tom: porRecorte.value.atencao.length > 0 ? ('risco' as const) : ('neutro' as const),
  },
  {
    valor: 'emCurso' as const,
    rotulo: t('clinico.adesao.lista.recorte.emCurso'),
    contagem: porRecorte.value.emCurso.length,
  },
  {
    valor: 'encerrados' as const,
    rotulo: t('clinico.adesao.lista.recorte.encerrados'),
    contagem: porRecorte.value.encerrados.length,
  },
])

const visiveis = computed(() => porRecorte.value[recorte.value])

/**
 * Os tratamentos do recorte, juntos por paciente. Quem tem alerta vem antes; dentro do paciente,
 * o remédio com alerta vem antes dos outros. Fora isso, a ordem do repositório.
 */
const pacientes = computed(() => {
  const grupos = new Map<string, LinhaDeTratamento[]>()

  for (const linha of visiveis.value) {
    grupos.set(linha.tratamento.petId, [...(grupos.get(linha.tratamento.petId) ?? []), linha])
  }

  return [...grupos.entries()]
    .map(([petId, tratamentos]) => ({
      petId,
      primeira: tratamentos[0]!,
      alerta: tratamentos.some((linha) => linha.alerta !== null),
      tratamentos: [...tratamentos].sort(
        (uma, outra) => Number(outra.alerta !== null) - Number(uma.alerta !== null),
      ),
    }))
    .sort((um, outro) => Number(outro.alerta) - Number(um.alerta))
})

// ------------------------------------------------------------------ a janela da faixa

function somarDias(iso: string, dias: number): string {
  return wallToIso(
    epochToWall(Date.parse(iso) + dias * 86_400_000, clinicClock.utcOffset),
    clinicClock.utcOffset,
  )
}

/** A conta das duas semanas da faixa — a mesma janela que ela desenha, para os dois concordarem. */
function daJanela(linha: LinhaDeTratamento) {
  const fim = linha.emCurso
    ? clinicClock.nowIso()
    : (linha.doses[linha.doses.length - 1]?.previstaEm ?? clinicClock.nowIso())
  const inicio = somarDias(clinicClock.toIso(clinicClock.dateOf(fim), 0), -(JANELA_DIAS - 1))
  const doses = dosesNoPeriodo(linha.doses, inicio, somarDias(fim, 1))

  return {
    doses,
    resumo: resumirAdesao(doses, inicio, fim, linha.tratamento.frequenciaHoras),
  }
}

const janelas = computed(
  () => new Map(visiveis.value.map((linha) => [linha.tratamento.id, daJanela(linha)])),
)

function rotaDaFicha(petId: string) {
  return `/veterinario/paciente/${petId}/tratamento`
}

function hrefDoTelefone(telefone: string) {
  return `tel:${telefone.replace(/[^\d+]/g, '')}`
}
</script>

<template>
  <UiPagina
    :resumo="fraseDoResumo"
    :carregando="carregando && linhas.length === 0"
    :erro="erro"
    :vazio="!carregando && !erro && linhas.length === 0"
    :vazio-titulo="t('clinico.adesao.lista.vazioTitulo')"
    :vazio-descricao="t('clinico.adesao.lista.vazioDescricao')"
    vazio-icone="ph ph-pill"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <div class="tratamentos">
      <div class="tratamentos__barra">
        <ClinicToggleGroup
          v-model="recorte"
          :opcoes="opcoesDoRecorte"
          :rotulo="t('clinico.adesao.titulo')"
        />
        <!-- A legenda num poço: lê-se uma vez e vale para todas as faixas da lista. -->
        <div class="tratamentos__legenda ui-poco">
          <LegendaDaFaixa />
        </div>
      </div>

      <div v-if="pacientes.length === 0" class="ui-folha vazio-centro">
        <span class="ui-ladrilho ui-ladrilho--g" aria-hidden="true"><i class="ph ph-pill" /></span>
        <strong>{{ t(`clinico.adesao.lista.vazioRecorte.${recorte}`) }}</strong>
      </div>

      <ul v-else class="tratamentos__lista">
        <li v-for="paciente in pacientes" :key="paciente.petId">
          <article
            class="paciente ui-folha ui-cartao"
            :class="{ 'paciente--alerta': paciente.alerta }"
            :aria-labelledby="`tratamentos-${paciente.petId}`"
          >
            <!-- Quem tem a adesão em queda leva o cabeçalho tingido de risco: é a ligação de hoje. -->
            <header
              class="ui-cartao__cabeca paciente__cabeca"
              :class="{ 'ui-cartao__cabeca--risco': paciente.alerta }"
            >
              <PetAvatar
                :nome="paciente.primeira.petNome"
                :iniciais="paciente.primeira.petIniciais"
                :especie="paciente.primeira.especie"
                :foto-url="paciente.primeira.petFotoUrl"
                tamanho="lg"
              />

              <div class="paciente__quem">
                <h2 :id="`tratamentos-${paciente.petId}`" class="paciente__nome">
                  {{ paciente.primeira.petNome }}
                </h2>
                <p class="paciente__meta">
                  {{ formato.especie(paciente.primeira.especie) }} ·
                  {{ paciente.primeira.tutorNome }}
                  <template v-if="paciente.primeira.tutorTelefone">
                    ·
                    <bdi dir="ltr" class="ui-num">{{ paciente.primeira.tutorTelefone }}</bdi>
                  </template>
                </p>
              </div>

              <div class="paciente__acoes">
                <Button
                  v-if="paciente.primeira.tutorTelefone"
                  as="a"
                  :href="hrefDoTelefone(paciente.primeira.tutorTelefone)"
                  icon="ph ph-phone"
                  :label="t('clinico.vacinas.ligar')"
                  :aria-label="
                    t('clinico.adesao.lista.ligarPara', {
                      nome: paciente.primeira.tutorNome,
                      telefone: paciente.primeira.tutorTelefone,
                    })
                  "
                  severity="secondary"
                  outlined
                  size="small"
                />
                <RouterLink class="ui-mais paciente__ficha" :to="rotaDaFicha(paciente.petId)">
                  <i class="ph ph-clipboard-text" aria-hidden="true" />
                  {{ t('clinico.adesao.lista.abrirFicha') }}
                </RouterLink>
              </div>
            </header>

            <ul class="ui-lista paciente__tratamentos">
              <li
                v-for="linha in paciente.tratamentos"
                :key="linha.tratamento.id"
                class="tratamento"
                :class="{ 'ui-marca ui-marca--risco': linha.alerta }"
              >
                <span
                  class="ui-ladrilho tratamento__icone"
                  :class="{
                    'ui-ladrilho--risco': linha.alerta,
                    'ui-ladrilho--neutro': !linha.emCurso,
                  }"
                  aria-hidden="true"
                >
                  <i class="ph ph-pill" />
                </span>

                <div class="tratamento__remedio">
                  <span class="tratamento__titulo">
                    <strong>{{ rotulos.nome(linha.tratamento) }}</strong>
                    <span v-if="linha.alerta" class="ui-selo ui-selo--risco">
                      <i class="ph ph-warning" aria-hidden="true" />
                      {{ t('clinico.adesao.alerta.selo') }}
                    </span>
                    <span
                      v-else-if="linha.tratamento.critico && linha.emCurso"
                      class="ui-selo ui-selo--atencao"
                    >
                      <i class="ph ph-first-aid" aria-hidden="true" />
                      {{ t('clinico.adesao.critico.selo') }}
                    </span>
                    <!-- "Em curso" é o normal da lista: só o encerrado ganha selo. -->
                    <span v-else-if="!linha.emCurso" class="ui-selo">
                      {{ t('clinico.adesao.lista.situacaoEncerrado') }}
                    </span>
                  </span>
                  <span class="tratamento__posologia">{{ rotulos.posologia(linha.tratamento) }}</span>

                  <p v-if="linha.alerta" class="tratamento__alerta">
                    <strong>{{ rotulos.alerta(linha.alerta).titulo }}.</strong>
                    {{ rotulos.alerta(linha.alerta).detalhe }}
                  </p>
                </div>

                <div class="tratamento__janela ui-poco">
                  <template v-if="linha.compartilhado && janelas.get(linha.tratamento.id)">
                    <span class="tratamento__rotulo">
                      {{ t('clinico.adesao.lista.coluna.janela', { dias: JANELA_DIAS }) }}
                    </span>
                    <FaixaDeDoses
                      :doses="janelas.get(linha.tratamento.id)!.doses"
                      :frequencia-horas="linha.tratamento.frequenciaHoras"
                      :dias="JANELA_DIAS"
                      :nomes="linha.nomes"
                      :rotulo="`${rotulos.nome(linha.tratamento)}: ${rotulos.contagem(janelas.get(linha.tratamento.id)!.resumo)}`"
                    />
                    <span class="tratamento__contagem">
                      {{ rotulos.contagem(janelas.get(linha.tratamento.id)!.resumo) }}
                    </span>
                  </template>
                  <span v-else class="tratamento__sem-registro">
                    <i class="ph ph-eye-slash" aria-hidden="true" />
                    {{ t('clinico.adesao.naoCompartilhado') }}
                  </span>
                </div>
              </li>
            </ul>
          </article>
        </li>
      </ul>
    </div>
  </UiPagina>
</template>

<style scoped>
.tratamentos {
  display: grid;
  gap: 20px;
}

.tratamentos__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 24px;
}

.tratamentos__legenda {
  max-width: 36rem;
  padding: 10px 16px;
}

.tratamentos__lista {
  display: grid;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.vazio-centro {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 36px 20px 40px;
  color: var(--tinta);
  font-size: 15px;
  text-align: center;
}

.vazio-centro strong {
  font-weight: 650;
}

/* ------------------------------------------------------------------------------ o paciente */

/* O cartão do paciente com adesão em queda: contorno no tom do risco, além do cabeçalho tingido. */
.paciente--alerta {
  border-color: color-mix(in oklab, var(--risco) 40%, var(--linha));
}

.paciente__cabeca {
  flex-wrap: wrap;
  gap: 12px 16px;
  padding: 18px 24px 16px;
}

.paciente__quem {
  display: grid;
  min-width: 0;
  flex: 1 1 12rem;
  gap: 2px;
}

.paciente__nome {
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.paciente__meta {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.paciente__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.paciente__acoes :deep(a.p-button) {
  text-decoration: none;
}

/* --------------------------------------------------------------------------- o remédio */

/*
 * O remédio à esquerda, com o ladrilho do assunto; a faixa à direita, num poço de largura fixa —
 * de um paciente para o outro, os dias caem no mesmo lugar.
 */
.tratamento {
  position: relative;
  display: grid;
  align-items: start;
  gap: 16px 18px;
  grid-template-columns: auto minmax(0, 1fr) 340px;
  padding: 18px 24px 20px;
}

.tratamento__icone {
  margin-top: 1px;
}

.tratamento__remedio {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 4px;
}

.tratamento__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}

.tratamento__titulo strong {
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.005em;
}

.tratamento__posologia {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.tratamento__alerta {
  max-width: 62ch;
  margin: 6px 0 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.tratamento__alerta strong {
  color: var(--risco-tinta);
  font-weight: 600;
}

/* A faixa em tamanho de leitura, num poço: horários à esquerda, datas embaixo, a conta abaixo. */
.tratamento__janela {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 6px;
  padding: 12px 14px 14px;
}

/*
 * A faixa é compartilhada com a ficha; aqui ela cresce para o tamanho de leitura de uma lista que
 * se percorre de longe: 15 px por dose, 3 px de vão, horários e datas em 12 px.
 */
.tratamento__janela :deep(.faixa) {
  --faixa-celula: 15px;
  --faixa-vao: 3px;
}

.tratamento__janela :deep(.faixa__horarios),
.tratamento__janela :deep(.faixa__eixo) {
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 12px;
}

.tratamento__rotulo {
  color: var(--tinta);
  font-size: 13px;
  font-weight: 600;
}

.tratamento__contagem {
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 1.45;
}

.tratamento__sem-registro {
  display: inline-flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.tratamento__sem-registro i {
  margin-top: 2px;
  font-size: 15px;
}

@media (max-width: 900px) {
  .tratamento {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .tratamento__janela {
    grid-column: 2;
  }
}

@media (max-width: 520px) {
  .tratamento {
    grid-template-columns: minmax(0, 1fr);
    padding-inline: 16px;
  }

  .tratamento__icone {
    display: none;
  }

  .tratamento__janela {
    grid-column: 1;
  }

  .paciente__cabeca {
    padding-inline: 16px;
  }
}
</style>
