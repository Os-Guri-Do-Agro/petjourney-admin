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
 * O acabamento é o da Visão geral, como o resto da ficha.
 *
 * O celular fica numa gaveta à direita, aberta pela pílula "Como … vê no app". Ele ocupava metade
 * da tela, todo dia, para quem só queria ler a faixa — a auditoria marcou a tela como pesada por
 * isso. A gaveta não tem máscara: aberta, a ficha continua à vista e o quadradinho aparece na mesma
 * hora em que alguém toca "Dei", que é a demonstração que a tela existe para fazer.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Select from 'primevue/select'
import { PhDeviceMobile, PhPill, PhArchive } from '@phosphor-icons/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import '@/components/home/home-card.css'
import '@/features/clinico/components/pacientes/ficha/ficha.css'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
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

async function registrar(dose: {
  tratamentoId: string
  numero: number
  situacao: 'dada' | 'pulada'
  motivo: MotivoDaDosePulada | null
}) {
  try {
    await salvar(() =>
      tratamentoRepository.registrarDose({ ...dose, cuidadorId: cuidadorId.value }),
    )
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

async function desfazer(dose: { tratamentoId: string; numero: number }) {
  try {
    await salvar(() => tratamentoRepository.desfazerDose({ ...dose, cuidadorId: cuidadorId.value }))
  } catch (falha) {
    recusa.value = {
      ...dose,
      texto:
        falha instanceof DoseRecusadaError ? textoDaRecusa(falha) : t('clinico.adesao.app.erro'),
    }
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
  <PartnerPageFrame
    class="ficha-tema hc-tema"
    :title="pet?.nome ?? t('clinico.ficha.tratamento.pilula')"
    :loading="carregando && !pet"
    :error="erro"
    block-when-suspended
    @retry="carregar"
  >
    <template v-if="pet" #cabecalho>
      <FichaCabeca :pet="pet" :tutor="tutor" atual="tratamento" :frase="frase" />
    </template>

    <div v-if="pet && adesao" class="ficha-conteudo clinic-scope">
      <section class="hc" :aria-labelledby="`${petId}-em-curso`">
        <header class="hc__cabeca">
          <h2 :id="`${petId}-em-curso`" class="hc__titulo">
            <PhPill class="hc__icone" weight="duotone" aria-hidden="true" />
            {{ t('clinico.adesao.ficha.emCurso') }}
          </h2>

          <Button
            v-if="noApp"
            type="button"
            class="hc-pilula"
            :label="
              t('clinico.adesao.ficha.comoVeNoApp', {
                responsavel: rotulos.primeiroNome(donoDoCelular?.nome ?? ''),
              })
            "
            :aria-expanded="celularAberto"
            aria-haspopup="dialog"
            @click="celularAberto = !celularAberto"
          >
            <template #icon>
              <PhDeviceMobile class="hc-pilula__icone" weight="duotone" aria-hidden="true" />
            </template>
          </Button>
        </header>
        <p class="ficha-ajuda">
          {{
            !ultimaConsulta
              ? t('clinico.adesao.ficha.emCursoAjudaSemConsulta')
              : comFio
                ? t('clinico.adesao.ficha.emCursoAjuda', { data: ultimaConsulta })
                : t('clinico.adesao.ficha.emCursoAjudaSemFio', { data: ultimaConsulta })
          }}
        </p>

        <template v-if="emCurso.length > 0">
          <ul class="tratamento__lista">
            <li v-for="lido in emCurso" :key="lido.tratamento.id">
              <TratamentoNaFicha
                :lido="lido"
                :ultima-consulta-em="adesao.ultimaConsultaEm"
                :nomes="nomes"
                :salvando="salvando"
                @critico="marcarCritico(lido.tratamento.id, $event)"
                @contato="registrarContato(lido.tratamento.id, $event)"
              />
            </li>
          </ul>
          <LegendaDaFaixa :com-marco="comFio" />
        </template>

        <div v-else class="tratamento__vazio">
          <strong>{{ t('clinico.adesao.ficha.vazioTitulo') }}</strong>
          <span>{{ t('clinico.adesao.ficha.vazioDescricao') }}</span>
        </div>
      </section>

      <section v-if="encerrados.length > 0" class="hc" :aria-labelledby="`${petId}-encerrados`">
        <header class="hc__cabeca">
          <h2 :id="`${petId}-encerrados`" class="hc__titulo">
            <PhArchive class="hc__icone" weight="duotone" aria-hidden="true" />
            {{ t('clinico.adesao.ficha.encerrados') }}
          </h2>
        </header>

        <ul class="tratamento__lista">
          <li v-for="lido in encerrados" :key="lido.tratamento.id">
            <TratamentoNaFicha
              :lido="lido"
              :ultima-consulta-em="adesao.ultimaConsultaEm"
              :nomes="nomes"
              encerrado
            />
          </li>
        </ul>
      </section>

      <!--
        O celular de quem cuida, numa gaveta sem máscara: a ficha continua à vista e muda na hora.
        Acima dele, de quem é o celular — é a troca que mostra a casa com mais de uma pessoa.
      -->
      <Drawer
        v-model:visible="celularAberto"
        position="right"
        :modal="false"
        class="hc-tema tratamento-gaveta"
        :style="{ width: 'min(25rem, 92vw)' }"
      >
        <template #header>
          <h2 class="tratamento-gaveta__titulo">
            <PhDeviceMobile class="hc__icone" weight="duotone" aria-hidden="true" />
            {{
              t('clinico.adesao.ficha.noApp', {
                responsavel: rotulos.primeiroNome(donoDoCelular?.nome ?? ''),
              })
            }}
          </h2>
        </template>

        <div class="tratamento-gaveta__corpo clinic-scope">
          <p class="ficha-ajuda">{{ t('clinico.adesao.ficha.noAppAjuda') }}</p>

          <div v-if="celulares.length > 1" class="tratamento__celulares">
            <label class="tratamento__celulares-rotulo" :for="`${petId}-celular-de`">{{
              t('clinico.adesao.ficha.celularDe')
            }}</label>
            <!--
              Lista, e não botões lado a lado: a família do app não tem tamanho fixo, e três nomes
              com o papel já não cabiam na largura do cartão.
            -->
            <Select
              v-model="cuidadorId"
              class="tratamento__celular"
              :input-id="`${petId}-celular-de`"
              :options="celulares"
              option-label="rotulo"
              option-value="valor"
              :pt="{ overlay: { class: 'clinic-overlay hc-tema' } }"
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
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
/* Os remédios em lista, separados por um fio — cartão dentro de cartão seria achatar tudo. */
.tratamento__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tratamento__lista > li {
  padding-block: 1.1rem;
}

.tratamento__lista > li:first-child {
  padding-top: 0.25rem;
}

.tratamento__lista > li + li {
  border-top: 1px solid var(--hc-linha);
}

.tratamento__vazio {
  display: grid;
  gap: 0.25rem;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  line-height: 1.45;
}

.tratamento__vazio strong {
  color: var(--hc-tinta);
  font-weight: 600;
}

.tratamento__celulares {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.6rem;
}

.tratamento__celulares-rotulo {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 600;
}

.tratamento__celular {
  flex: 1 1 12rem;
  min-width: 0;
}

.tratamento-gaveta__titulo {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1rem;
  font-weight: 650;
}

.tratamento-gaveta__corpo {
  display: grid;
  gap: 0.85rem;
}
</style>
