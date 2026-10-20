<script setup lang="ts">
/**
 * Tratamento — o remédio de casa, visto pela clínica e pelo celular de quem cuida, lado a lado.
 *
 * É a tela que conta a história do requisito numa demonstração só: a receita que a clínica
 * emitiu vira lembrete no celular (à direita), alguém da casa toca "Dei", e a faixa da ficha (à
 * esquerda) ganha o quadradinho na mesma hora. No retorno, o vet lê a mesma faixa e sabe se o
 * tratamento foi feito — antes de concluir que ele não funcionou.
 *
 * À esquerda, a clínica: os remédios em curso, cada um com a faixa de doses, a conta desde a
 * última consulta e, se for crítico e a adesão caiu, o alerta com o registro da conversa. À
 * direita, o celular — e acima dele, **de quem é o celular**: a Fátima, o filho dela ou a filha
 * que só acompanha. É assim que "mais de uma pessoa cuidando" se demonstra: marcar no celular de
 * um e ver a dose aparecer "dada por Rafael" no do outro, sem botão.
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * A capa do paciente no alto (`FichaCabeca`, com as abas da ficha) e, embaixo, **um bloco por
 * remédio** (`TratamentoNaFicha`): o nome e como dar (dose, via, intervalo, duração), a faixa das
 * últimas duas semanas em tamanho de leitura, a conta desde a última consulta em número grande, e
 * os botões do bloco — registrar a dose da vez, registrar o contato, marcar como crítico. Os
 * encerrados vêm depois, uma linha cada.
 *
 * A dose da vez se registra daqui **em nome de quem cuida** — quem está com o celular na gaveta,
 * ou o responsável quando essa pessoa só acompanha. É a mesma dose e a mesma regra do celular; a
 * gaveta mostra a dose mudar de lado na mesma hora.
 *
 * O celular é a ação secundária do alto, "Como … vê no app": uma gaveta sem máscara. Aberta, a
 * ficha continua à vista e o quadradinho aparece na mesma hora em que alguém toca "Dei", que é a
 * demonstração que a tela existe para fazer.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Select from 'primevue/select'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import FichaCabeca from '@/features/clinico/components/pacientes/ficha/FichaCabeca.vue'
import LegendaDaFaixa from '@/features/clinico/components/tratamento/LegendaDaFaixa.vue'
import TratamentoNaFicha from '@/features/clinico/components/tratamento/TratamentoNaFicha.vue'
import TratamentoNoApp from '@/features/clinico/components/tratamento/TratamentoNoApp.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useRotulosDoTratamento } from '@/features/clinico/composables/useRotulosDoTratamento'
import {
  DoseRecusadaError,
  patientRepository,
  tratamentoRepository,
  type AdesaoDoPaciente,
  type TratamentosNoApp,
} from '@/features/clinico/data/repositories'
import type { Cuidador, Pet, Tutor } from '@/features/clinico/data/types'
import {
  diasDaFaixa,
  faixaMostraAConsulta,
  type MotivoDaDosePulada,
} from '@/features/clinico/domain/adesao'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const route = useRoute()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoTratamento()

const pet = ref<Pet | null>(null)
const tutor = ref<Tutor | null>(null)
const adesao = ref<AdesaoDoPaciente | null>(null)
const noApp = ref<TratamentosNoApp | null>(null)
const carregando = ref(false)
const erro = ref('')
const salvando = ref(false)
/** A gaveta do celular de quem cuida. Fechada por padrão: a ficha é a tela de todo dia. */
const celularAberto = ref(false)
const recusa = ref<{ tratamentoId: string; numero: number; texto: string } | null>(null)

/** De quem é o celular da prévia. Começa no responsável: é quem criou os lembretes. */
const cuidadorId = ref('')

const petId = computed(() => String(route.params.petId ?? ''))

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const dados = await patientRepository.obter(petId.value)

    pet.value = dados?.pet ?? null
    tutor.value = dados?.tutor ?? null
    cuidadorId.value = dados?.pet.tutorId ?? ''
    await recarregar()
  } catch {
    erro.value = t('clinico.erros.prontuario')
  } finally {
    carregando.value = false
  }
}

/**
 * A ficha e o celular de uma vez.
 *
 * Juntos, e não um de cada vez: a demonstração é ver os dois lados mudarem no mesmo instante —
 * a dose que alguém marcou no celular, entrando na faixa da clínica.
 */
async function recarregar() {
  const [daFicha, doCelular] = await Promise.all([
    tratamentoRepository.doPaciente(petId.value),
    tratamentoRepository.noApp(petId.value, cuidadorId.value),
  ])

  adesao.value = daFicha
  noApp.value = doCelular
}

onMounted(carregar)
watch(petId, carregar)

watch(cuidadorId, async (novo, antigo) => {
  if (antigo && novo !== antigo) {
    recusa.value = null
    noApp.value = await tratamentoRepository.noApp(petId.value, novo)
  }
})

// ------------------------------------------------------------------ a ficha

const nomes = computed<Record<string, string>>(() =>
  Object.fromEntries((adesao.value?.cuidadores ?? []).map((item) => [item.id, item.nome])),
)

const emCurso = computed(() => (adesao.value?.tratamentos ?? []).filter((item) => item.emCurso))
const encerrados = computed(() => (adesao.value?.tratamentos ?? []).filter((item) => !item.emCurso))
const comAlerta = computed(() => emCurso.value.filter((item) => item.alerta !== null))

/**
 * O estado numa frase, no lugar da saudação da Visão geral: o alerta primeiro, nomeando o remédio
 * quando é um só; depois o que está em curso. Sem nota e sem porcentagem — o como está na faixa.
 */
const frase = computed(() => {
  if (!adesao.value) {
    return ''
  }

  const [primeiroAlerta] = comAlerta.value

  if (comAlerta.value.length === 1 && primeiroAlerta) {
    return t('clinico.ficha.tratamento.alerta', {
      medicamento: rotulos.nome(primeiroAlerta.tratamento),
    })
  }

  if (comAlerta.value.length > 1) {
    return t(
      'clinico.ficha.tratamento.alertas',
      { total: comAlerta.value.length },
      comAlerta.value.length,
    )
  }

  const [unico] = emCurso.value

  if (emCurso.value.length === 1 && unico) {
    return t('clinico.ficha.tratamento.umEmCurso', { medicamento: rotulos.nome(unico.tratamento) })
  }

  if (emCurso.value.length > 1) {
    return t(
      'clinico.ficha.tratamento.emCurso',
      { total: emCurso.value.length },
      emCurso.value.length,
    )
  }

  return encerrados.value.length > 0
    ? t('clinico.ficha.tratamento.nenhumEmCurso')
    : t('clinico.ficha.tratamento.semTratamento')
})

const ultimaConsulta = computed(() =>
  adesao.value?.ultimaConsultaEm
    ? formato.dataCurta(clinicClock.dateOf(adesao.value.ultimaConsultaEm))
    : null,
)

/**
 * Alguma faixa desenha o fio da última consulta? A ajuda e a legenda só falam do fio quando ele
 * está na tela — no tratamento que começou no dia da consulta, não há "antes" para separar.
 */
const comFio = computed(() => {
  const consulta = adesao.value?.ultimaConsultaEm ?? null

  return emCurso.value.some((lido) =>
    faixaMostraAConsulta(lido.doses, consulta, diasDaFaixa(consulta, clinicClock.today())),
  )
})

async function marcarCritico(tratamentoId: string, critico: boolean) {
  await salvar(() => tratamentoRepository.marcarCritico(tratamentoId, critico))
}

async function registrarContato(
  tratamentoId: string,
  dados: { professionalId: string; nota: string },
) {
  await salvar(() => tratamentoRepository.registrarContato({ tratamentoId, ...dados }))
}

// ------------------------------------------------------------------ o celular

function papel(cuidador: Cuidador): string {
  if (cuidador.acesso === 'leitura') {
    return t('clinico.adesao.ficha.papel.leitura')
  }

  return t(`clinico.adesao.ficha.papel.${cuidador.papel}`)
}

const celulares = computed(() =>
  (adesao.value?.cuidadores ?? []).map((cuidador) => ({
    valor: cuidador.id,
    rotulo: `${rotulos.primeiroNome(cuidador.nome)} · ${papel(cuidador)}`,
  })),
)

const donoDoCelular = computed(
  () => adesao.value?.cuidadores.find((item) => item.id === cuidadorId.value) ?? null,
)

/**
 * Em nome de quem a ficha registra a dose da vez: quem está com o celular na gaveta — o mesmo
 * "Dei" que essa pessoa tocaria. Se ela só acompanha, o registro vai para o responsável, que é
 * quem a clínica atende ao telefone.
 */
const quemRegistraNaFicha = computed(() => {
  const cuidadores = adesao.value?.cuidadores ?? []
  const escolhido = donoDoCelular.value

  if (escolhido && escolhido.acesso === 'edicao') {
    return { id: escolhido.id, nome: escolhido.nome }
  }

  const quemEdita =
    cuidadores.find((item) => item.papel === 'dono' && item.acesso === 'edicao') ??
    cuidadores.find((item) => item.acesso === 'edicao')

  return quemEdita ? { id: quemEdita.id, nome: quemEdita.nome } : null
})

/** O primeiro nome de quem está com o celular — é o que a ação do alto e a gaveta dizem. */
const responsavelNoApp = computed(() => rotulos.primeiroNome(donoDoCelular.value?.nome ?? ''))

/** A receita que ainda não virou lembrete: é por ela que o tratamento nasce, no celular. */
const receitaPendente = computed(() => noApp.value?.receitasSemLembrete[0] ?? null)

const ajudaDosRemedios = computed(() =>
  !ultimaConsulta.value
    ? t('clinico.adesao.ficha.emCursoAjudaSemConsulta')
    : comFio.value
      ? t('clinico.adesao.ficha.emCursoAjuda', { data: ultimaConsulta.value })
      : t('clinico.adesao.ficha.emCursoAjudaSemFio', { data: ultimaConsulta.value }),
)

/**
 * Toda escrita passa por aqui: recarrega os dois lados e avisa o resto do módulo — o selo do menu
 * e a Visão geral contam os alertas, e um alerta resolvido que continua no menu mente.
 */
async function salvar<T>(acao: () => Promise<T>) {
  salvando.value = true
  recusa.value = null

  try {
    await acao()
  } finally {
    salvando.value = false
    await recarregar()
    clinico.invalidarTudo()
  }
}

function textoDaRecusa(erroDaDose: DoseRecusadaError): string {
  if (erroDaDose.kind === 'dose-ja-registrada' && erroDaDose.registro) {
    return t('clinico.adesao.app.jaRegistrada', {
      nome: rotulos.primeiroNome(nomes.value[erroDaDose.registro.cuidadorId] ?? ''),
      hora: formato.hora(erroDaDose.registro.registradaEm),
    })
  }

  return erroDaDose.kind === 'somente-leitura'
    ? t('clinico.adesao.app.somenteLeitura', { pet: pet.value?.nome ?? '' })
    : t('clinico.adesao.app.foraDaJanela')
}

async function registrar(
  dose: {
    tratamentoId: string
    numero: number
    situacao: 'dada' | 'pulada'
    motivo: MotivoDaDosePulada | null
  },
  quem: string = cuidadorId.value,
) {
  try {
    await salvar(() => tratamentoRepository.registrarDose({ ...dose, cuidadorId: quem }))
  } catch (falha) {
    recusa.value = {
      tratamentoId: dose.tratamentoId,
      numero: dose.numero,
      texto:
        falha instanceof DoseRecusadaError ? textoDaRecusa(falha) : t('clinico.adesao.app.erro'),
    }
  }
}

/**
 * O "Dei" do aviso: todas as doses dele. A que alguém da casa já marcou fica como está — é o que
 * a rota `registrarVarias` do contrato faz.
 */
async function registrarVarias(doses: Array<{ tratamentoId: string; numero: number }>) {
  await salvar(async () => {
    for (const dose of doses) {
      try {
        await tratamentoRepository.registrarDose({
          ...dose,
          situacao: 'dada',
          motivo: null,
          cuidadorId: cuidadorId.value,
        })
      } catch (falha) {
        if (!(falha instanceof DoseRecusadaError) || falha.kind !== 'dose-ja-registrada') {
          throw falha
        }
      }
    }
  }).catch(() => {
    recusa.value = null
  })
}

async function desfazer(
  dose: { tratamentoId: string; numero: number },
  quem: string = cuidadorId.value,
) {
  try {
    await salvar(() => tratamentoRepository.desfazerDose({ ...dose, cuidadorId: quem }))
  } catch (falha) {
    recusa.value = {
      ...dose,
      texto:
        falha instanceof DoseRecusadaError ? textoDaRecusa(falha) : t('clinico.adesao.app.erro'),
    }
  }
}

/** A dose da vez registrada no bloco da ficha, em nome de quem cuida. */
function registrarNaFicha(dose: Parameters<typeof registrar>[0]) {
  if (quemRegistraNaFicha.value) {
    void registrar(dose, quemRegistraNaFicha.value.id)
  }
}

function desfazerNaFicha(dose: { tratamentoId: string; numero: number }) {
  if (quemRegistraNaFicha.value) {
    void desfazer(dose, quemRegistraNaFicha.value.id)
  }
}

async function criarLembretes(pedido: {
  encounterId: string
  itens: Array<{ prescricaoId: string; primeiraDoseEm: string }>
  compartilhar: boolean
}) {
  await salvar(() =>
    tratamentoRepository.criarLembretes({
      encounterId: pedido.encounterId,
      itens: pedido.itens,
      cuidadorId: cuidadorId.value,
      compartilharComAClinica: pedido.compartilhar,
    }),
  ).catch(() => undefined)
}

async function compartilhar(pedido: { tratamentoId: string; compartilhado: boolean }) {
  await salvar(() =>
    tratamentoRepository.alterarCompartilhamento({ ...pedido, cuidadorId: cuidadorId.value }),
  ).catch(() => undefined)
}
</script>

<template>
  <UiPagina
    class="tela-ficha"
    :titulo="pet?.nome ?? t('clinico.ficha.tratamento.pilula')"
    :carregando="carregando && !pet"
    :erro="erro"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <RouterLink to="/veterinario/pacientes">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('clinico.pacientes.titulo') }}
      </RouterLink>
    </template>

    <template v-if="pet" #cabecalho>
      <FichaCabeca :pet="pet" :tutor="tutor" atual="tratamento" :frase="frase">
        <!-- O celular de quem cuida é a ação da capa, e secundária: a ficha é a tela de todo dia. -->
        <template v-if="noApp" #acoes>
          <Button
            type="button"
            icon="ph ph-device-mobile"
            :label="t('clinico.adesao.ficha.comoVeNoApp', { responsavel: responsavelNoApp })"
            severity="secondary"
            outlined
            :aria-expanded="celularAberto"
            aria-haspopup="dialog"
            @click="celularAberto = !celularAberto"
          />
        </template>
      </FichaCabeca>
    </template>

    <div v-if="pet && adesao" class="ficha-tratamento">
      <UiSecao
        :id="`${petId}-em-curso`"
        :titulo="t('clinico.adesao.ficha.emCurso')"
        :contagem="emCurso.length"
        :descricao="ajudaDosRemedios"
        icone="ph ph-pill"
      >
        <!-- A legenda da faixa num poço, antes dos remédios: lê-se uma vez e vale para todos. -->
        <div v-if="emCurso.length > 0" class="ficha-tratamento__legenda ui-poco">
          <LegendaDaFaixa :com-marco="comFio" />
        </div>

        <ul v-if="emCurso.length > 0" class="ficha-tratamento__lista">
          <li v-for="lido in emCurso" :key="lido.tratamento.id">
            <TratamentoNaFicha
              :lido="lido"
              :ultima-consulta-em="adesao.ultimaConsultaEm"
              :nomes="nomes"
              :salvando="salvando"
              :quem-registra="quemRegistraNaFicha"
              :recusa="recusa"
              @critico="marcarCritico(lido.tratamento.id, $event)"
              @contato="registrarContato(lido.tratamento.id, $event)"
              @registrar="registrarNaFicha"
              @desfazer="desfazerNaFicha"
            />
          </li>
        </ul>

        <!--
          Sem remédio com lembrete. Se a receita já chegou ao celular e ainda não virou lembrete,
          a tela diz isso e leva até lá: é no celular, com "Criar lembretes", que o tratamento nasce.
        -->
        <div v-else class="ui-folha ficha-tratamento__vazio">
          <span class="ficha-tratamento__vazio-icone" aria-hidden="true">
            <i class="ph ph-pill" />
          </span>
          <div class="ficha-tratamento__vazio-texto">
            <strong>{{ t('clinico.adesao.ficha.vazioTitulo') }}</strong>
            <span v-if="receitaPendente">
              {{
                t(
                  'clinico.ficha.tratamento.receitaSemLembrete',
                  {
                    data: formato.dataCurta(clinicClock.dateOf(receitaPendente.liberadaEm)),
                    total: receitaPendente.itens.length,
                  },
                  receitaPendente.itens.length,
                )
              }}
            </span>
            <span v-else>{{ t('clinico.adesao.ficha.vazioDescricao') }}</span>
          </div>
          <Button
            v-if="receitaPendente"
            type="button"
            icon="ph ph-device-mobile"
            :label="t('clinico.adesao.ficha.comoVeNoApp', { responsavel: responsavelNoApp })"
            severity="secondary"
            outlined
            size="small"
            @click="celularAberto = true"
          />
        </div>
      </UiSecao>

      <UiSecao
        v-if="encerrados.length > 0"
        :id="`${petId}-encerrados`"
        :titulo="t('clinico.adesao.ficha.encerrados')"
        :contagem="encerrados.length"
      >
        <ul class="ui-folha ui-lista">
          <li v-for="lido in encerrados" :key="lido.tratamento.id">
            <TratamentoNaFicha
              :lido="lido"
              :ultima-consulta-em="adesao.ultimaConsultaEm"
              :nomes="nomes"
              encerrado
            />
          </li>
        </ul>
      </UiSecao>
    </div>

    <template #sempre>
      <!--
        O celular de quem cuida, numa gaveta sem máscara: a ficha continua à vista e muda na hora.
        Acima dele, de quem é o celular — é a troca que mostra a casa com mais de uma pessoa.
      -->
      <Drawer
        v-if="pet"
        v-model:visible="celularAberto"
        position="right"
        :modal="false"
        class="gaveta-celular clinic-overlay"
        :style="{ width: 'min(26rem, 94vw)' }"
      >
        <template #header>
          <div class="gaveta__cabeca">
            <span class="gaveta__icone" aria-hidden="true"><i class="ph ph-device-mobile" /></span>
            <span class="gaveta__texto">
              <h2 class="gaveta__titulo">
                {{ t('clinico.adesao.ficha.noApp', { responsavel: responsavelNoApp }) }}
              </h2>
              <span class="gaveta__meta">{{ t('clinico.adesao.ficha.noAppAjuda') }}</span>
            </span>
          </div>
        </template>

        <div class="gaveta__corpo clinic-scope">
          <div v-if="celulares.length > 1" class="gaveta__de-quem">
            <label :for="`${petId}-celular-de`">{{ t('clinico.adesao.ficha.celularDe') }}</label>
            <!--
              Lista, e não botões lado a lado: a família do app não tem tamanho fixo, e três nomes
              com o papel não cabem lado a lado na largura da gaveta.
            -->
            <Select
              v-model="cuidadorId"
              class="gaveta__celular"
              :input-id="`${petId}-celular-de`"
              :options="celulares"
              option-label="rotulo"
              option-value="valor"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
          </div>

          <TratamentoNoApp
            v-if="noApp"
            :dados="noApp"
            :pet-iniciais="pet.iniciais"
            :pet-foto-url="pet.fotoUrl"
            :salvando="salvando"
            :recusa="recusa"
            @registrar="registrar"
            @registrar-varias="registrarVarias"
            @desfazer="desfazer"
            @criar-lembretes="criarLembretes"
            @compartilhar="compartilhar"
          />
        </div>
      </Drawer>
    </template>
  </UiPagina>
</template>

<style scoped>
.ficha-tratamento {
  display: grid;
  gap: 32px;
}

.ficha-tratamento__legenda {
  justify-self: start;
  max-width: 100%;
  margin-bottom: 14px;
  padding: 10px 16px;
}

.ficha-tratamento__lista {
  display: grid;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ficha-tratamento__vazio {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 18px;
  padding: 20px 22px;
}

.ficha-tratamento__vazio-icone {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  background: var(--pj-lugar-fundo, var(--superficie-2));
  color: var(--pj-lugar-tinta, var(--tinta-2));
  font-size: 22px;
}

.ficha-tratamento__vazio-texto {
  display: grid;
  flex: 1 1 20rem;
  min-width: 0;
  gap: 3px;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.ficha-tratamento__vazio-texto strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

/* ------------------------------------------------------------------ gaveta */

.gaveta__cabeca {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.gaveta__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-size: 20px;
}

.gaveta__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.gaveta__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.gaveta__meta {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
}

.gaveta__corpo {
  display: grid;
  gap: 14px;
}

.gaveta__de-quem {
  display: grid;
  gap: 6px;
}

.gaveta__de-quem label {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.gaveta__celular {
  width: 100%;
}
</style>
