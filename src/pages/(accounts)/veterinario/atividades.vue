<script setup lang="ts">
/**
 * Atividades — a caixa de pendências da clínica.
 *
 * Três pilhas que costumam ficar invisíveis até virarem problema: prontuário em rascunho,
 * retorno indicado sem horário e oferta da fila esperando resposta. Nenhuma delas aparece na
 * grade do dia, e é justamente por isso que envelhecem.
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * Uma seção por pilha, com a contagem e uma frase do **porquê** — "rascunho" sozinho não diz que
 * o resumo está preso. Cada linha é o paciente (rosto e nome), o que falta, há quanto tempo, e a
 * ação certa na ponta: continuar o prontuário, marcar o retorno, ver a oferta na fila. A linha
 * inteira leva ao lugar da ação; o botão desenhado na ponta só diz qual é.
 *
 * O tempo vira selo âmbar quando passa do razoável (rascunho de outro dia, retorno com uma semana
 * de atraso, oferta a menos de meia hora do prazo), com a marca na borda da linha: o olho acha o
 * que envelheceu sem ler a lista inteira.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { encounterRepository } from '@/features/clinico/data/repositories'
import type { Encounter, Pet, WaitlistEntry } from '@/features/clinico/data/types'
import { diffDays } from '@/features/clinico/domain/clinic-time'
import { retornosVencidos, type RetornoPendente } from '@/features/clinico/domain/follow-up'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useFilaStore } from '@/features/clinico/stores/fila'
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

const { t, locale } = useI18n()
const clinico = useClinicoStore()
const fila = useFilaStore()
const formato = useClinicFormat()

const rascunhos = ref<Encounter[]>([])
const retornos = ref<RetornoPendente[]>([])
const carregando = ref(false)
const erro = ref('')

const total = computed(() => rascunhos.value.length + retornos.value.length + fila.ofertadas.length)

const vazio = computed(() => !carregando.value && !erro.value && total.value === 0)

/** Uma semana depois do prazo, o retorno já perdeu a janela que o vet pediu. */
const ATRASO_QUE_PESA_DIAS = 7

/** Meia hora: o tempo de uma ligação e de o responsável conseguir responder. */
const PRAZO_CURTO_MIN = 30

type LinhaDeAtividade = {
  id: string
  to: RouteLocationRaw
  pet: Pet | null
  /** O que falta, e de quem é. */
  meta: string
  /** Há quanto tempo, ou quanto falta. */
  quando: string
  /** Passou do razoável: selo âmbar e marca na borda. */
  pesa: boolean
  acao: string
  icone: string
}

type Pilha = {
  id: 'rascunhos' | 'retornos' | 'ofertas'
  titulo: string
  porque: string
  icone: string
  linhas: LinhaDeAtividade[]
}

function juntar(partes: Array<string | null | undefined>) {
  return partes.filter(Boolean).join(' · ')
}

function nomeDoProfissional(id: string | null | undefined) {
  return id ? (clinico.profissional(id)?.nome ?? '') : ''
}

function linhaDoRascunho(encounter: Encounter): LinhaDeAtividade {
  const hoje = clinicClock.today()
  const dias = diffDays(clinicClock.dateOf(encounter.abertoEm), hoje)

  return {
    id: `rascunho-${encounter.id}`,
    to: `/veterinario/atendimento/${encounter.id}`,
    pet: clinico.pet(encounter.petId),
    meta: juntar([
      encounter.anamnese.queixaPrincipal || t('clinico.atividades.semQueixa'),
      nomeDoProfissional(encounter.professionalId),
    ]),
    quando:
      dias > 0
        ? t('clinico.atividades.abertoHa', { total: dias }, dias)
        : t('clinico.atividades.abertoHoje', { hora: formato.hora(encounter.abertoEm) }),
    pesa: dias > 0,
    acao: t('clinico.atividades.acao.continuar'),
    icone: 'ph ph-note-pencil',
  }
}

/**
 * "Marcar retorno" abre o formulário da agenda já com o paciente e o tipo "retorno" escolhidos
 * (`?novo=1&paciente=…&tipo=retorno`): quem clicou já disse de quem e o quê, falta só o horário.
 */
function linhaDoRetorno(item: RetornoPendente): LinhaDeAtividade {
  const dias = item.diasDeAtraso

  return {
    id: `retorno-${item.encounter.id}`,
    to: {
      path: '/veterinario/agenda',
      query: { novo: '1', paciente: item.encounter.petId, tipo: 'retorno' },
    },
    pet: clinico.pet(item.encounter.petId),
    meta: juntar([
      clinico.diagnosticoPrincipal(item.encounter) || t('clinico.atividades.semDiagnostico'),
      nomeDoProfissional(item.encounter.professionalId),
    ]),
    quando:
      dias > 0
        ? t('clinico.atividades.atraso', { total: dias }, dias)
        : t('clinico.atividades.venceHoje'),
    pesa: dias >= ATRASO_QUE_PESA_DIAS,
    acao: t('clinico.meuDia.marcarRetorno'),
    icone: 'ph ph-calendar-plus',
  }
}

function linhaDaOferta(entrada: WaitlistEntry): LinhaDeAtividade {
  const expira = entrada.ofertaExpiraEm
  const minutos = expira
    ? Math.round((Date.parse(expira) - Date.parse(clinicClock.nowIso())) / 60_000)
    : null
  const vaga = entrada.ofertaSlotInicio
    ? t('clinico.atividades.vaga', {
        data: formato.dataCurta(clinicClock.dateOf(entrada.ofertaSlotInicio)),
        hora: formato.hora(entrada.ofertaSlotInicio),
      })
    : ''

  return {
    id: `oferta-${entrada.id}`,
    to: '/veterinario/fila',
    pet: clinico.pet(entrada.petId),
    meta: juntar([
      clinico.tipo(entrada.typeId)?.nome,
      vaga,
      nomeDoProfissional(entrada.ofertaProfessionalId ?? entrada.professionalId),
    ]),
    quando:
      minutos === null
        ? ''
        : minutos < 0
          ? t('clinico.fila.situacao.expirado')
          : t('clinico.fila.ofertaExpiraEm', { valor: formato.relativo(expira!) }),
    pesa: minutos !== null && minutos < PRAZO_CURTO_MIN,
    acao: t('clinico.atividades.acao.verNaFila'),
    icone: 'ph ph-hourglass',
  }
}

/** Pilha vazia não aparece: uma seção para dizer "nada aqui" é ruído entre as que pedem ação. */
const pilhas = computed<Pilha[]>(() => {
  const todas: Pilha[] = [
    {
      id: 'rascunhos',
      titulo: t('clinico.atividades.rascunhos'),
      porque: t('clinico.atividades.porque.rascunhos'),
      icone: 'ph ph-note-pencil',
      linhas: rascunhos.value.map(linhaDoRascunho),
    },
    {
      id: 'retornos',
      titulo: t('clinico.atividades.retornos'),
      porque: t('clinico.atividades.porque.retornos'),
      icone: 'ph ph-clock-counter-clockwise',
      linhas: retornos.value.map(linhaDoRetorno),
    },
    {
      id: 'ofertas',
      titulo: t('clinico.atividades.ofertasDaFila'),
      porque: t('clinico.atividades.porque.ofertas'),
      icone: 'ph ph-hourglass',
      linhas: fila.ofertadas.map(linhaDaOferta),
    },
  ]

  return todas.filter((pilha) => pilha.linhas.length > 0)
})

/** "3 prontuários em rascunho, 6 retornos sem horário e 3 ofertas da fila esperando resposta." */
const fraseDoResumo = computed(() => {
  if (carregando.value && total.value === 0) {
    return ''
  }

  const contagens = [
    ['clinico.atividades.resumo.rascunhos', rascunhos.value.length],
    ['clinico.atividades.resumo.retornos', retornos.value.length],
    ['clinico.atividades.resumo.ofertas', fila.ofertadas.length],
  ] as const
  const partes = contagens
    .filter(([, quantos]) => quantos > 0)
    .map(([chave, quantos]) => t(chave, { total: quantos }, quantos))

  if (partes.length === 0) {
    return t('clinico.atividades.resumo.emDia')
  }

  const tag = INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE]

  return t('clinico.atividades.resumo.frase', {
    lista: new Intl.ListFormat(tag, { type: 'conjunction' }).format(partes),
  })
})

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const [emRascunho, pendentes] = await Promise.all([
      encounterRepository.listarRascunhos(null),
      encounterRepository.listarRetornosPendentes(),
    ])

    rascunhos.value = emRascunho
    retornos.value = retornosVencidos(pendentes, clinicClock, clinicClock.today())

    await fila.carregar()
  } catch {
    erro.value = t('clinico.erros.prontuario')
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)
</script>

<template>
  <UiPagina
    :resumo="fraseDoResumo"
    :carregando="carregando && total === 0"
    :erro="erro"
    :vazio="vazio"
    :vazio-titulo="t('clinico.atividades.vazioTitulo')"
    :vazio-descricao="t('clinico.atividades.vazioDescricao')"
    vazio-icone="ph ph-check-circle"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <div class="atividades">
      <!--
        Cada pilha é um cartão com cabeçalho: o ladrilho do assunto, o nome, o porquê e, à direita,
        quantos esperam. A pilha que tem item envelhecido acende o ladrilho em atenção.
      -->
      <section
        v-for="pilha in pilhas"
        :key="pilha.id"
        class="pilha ui-folha ui-cartao"
        :aria-labelledby="`atividades-${pilha.id}-titulo`"
      >
        <header class="ui-cartao__cabeca">
          <span
            class="ui-ladrilho"
            :class="{ 'ui-ladrilho--atencao': pilha.linhas.some((linha) => linha.pesa) }"
            aria-hidden="true"
          >
            <i :class="pilha.icone" />
          </span>
          <span class="ui-cartao__titulos">
            <h2 :id="`atividades-${pilha.id}-titulo`" class="ui-cartao__titulo">
              {{ pilha.titulo }}
            </h2>
            <p class="ui-cartao__descricao">{{ pilha.porque }}</p>
          </span>
          <span class="ui-cartao__total">{{ pilha.linhas.length }}</span>
        </header>

        <ul class="ui-lista">
          <li v-for="linha in pilha.linhas" :key="linha.id">
            <RouterLink
              class="ui-linha atividade"
              :class="{ 'ui-marca ui-marca--atencao': linha.pesa }"
              :to="linha.to"
            >
              <PetAvatar
                :nome="linha.pet?.nome ?? ''"
                :iniciais="linha.pet?.iniciais ?? ''"
                :especie="linha.pet?.especie ?? null"
                :foto-url="linha.pet?.fotoUrl ?? ''"
                tamanho="md"
              />

              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo">{{ linha.pet?.nome }}</strong>
                <span class="ui-linha__meta atividade__meta">{{ linha.meta }}</span>
              </span>

              <span class="ui-linha__fim atividade__fim">
                <span class="atividade__quando">
                  <span v-if="linha.pesa" class="ui-selo ui-selo--atencao">
                    <i class="ph ph-clock" aria-hidden="true" />
                    {{ linha.quando }}
                  </span>
                  <span v-else-if="linha.quando" class="atividade__tempo">{{ linha.quando }}</span>
                </span>

                <!-- Desenho de botão, não botão: quem age é a linha inteira (um link só). -->
                <span class="atividade__acao">
                  <i :class="linha.icone" aria-hidden="true" />
                  {{ linha.acao }}
                </span>
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>
  </UiPagina>
</template>

<style scoped>
.atividades {
  display: grid;
  gap: 24px;
}

.atividade {
  padding-block: 12px;
}

/* Embaixo do cabeçalho, a primeira linha não leva o raio de cima: só a última, o de baixo. */
.pilha .ui-lista > li:first-child > .ui-linha {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.atividade__meta {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.atividade__fim {
  gap: 16px;
}

/* A coluna do tempo tem largura própria: selo e texto alinham numa linha só, de cima a baixo. */
.atividade__quando {
  display: flex;
  min-width: 152px;
  justify-content: flex-end;
}

.atividade__tempo {
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* O desenho do botão secundário do acabamento: papel, fio médio e sombra rente. */
.atividade__acao {
  display: inline-flex;
  min-width: 200px;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--linha-media);
  border-radius: var(--raio-controle);
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  transition:
    background-color var(--pj-tempo-curto) ease,
    border-color var(--pj-tempo-curto) ease;
}

.atividade__acao i {
  color: var(--pj-lugar-tinta, var(--musgo));
  font-size: 16px;
}

.atividade:hover .atividade__acao {
  border-color: color-mix(in oklab, var(--linha-media) 60%, var(--tinta-3));
  background: var(--superficie-2);
}

/* Em tela estreita o tempo e a ação descem para baixo do nome, alinhados ao texto. */
@media (max-width: 760px) {
  .atividade {
    flex-wrap: wrap;
    row-gap: 10px;
  }

  .atividade .ui-linha__texto {
    flex: 1 1 0;
  }

  .atividade__fim {
    flex: 1 1 100%;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px 12px;
    padding-inline-start: 54px;
  }

  .atividade__quando {
    min-width: 0;
    justify-content: flex-start;
  }

  .atividade__acao {
    min-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .atividade__acao {
    transition: none;
  }
}
</style>
