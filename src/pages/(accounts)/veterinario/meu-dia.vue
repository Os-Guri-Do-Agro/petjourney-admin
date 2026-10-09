<script setup lang="ts">
/**
 * Hoje na clínica — a landing natural do perfil veterinário.
 *
 * A agenda responde a pergunta errada para quem chega de manhã. Grade é ferramenta de quem
 * **procura horário**; quem abre o portal às oito pergunta **o que é agora e o que não pode
 * esperar**. A agenda completa fica a um clique.
 *
 * ## A forma (redesenho de 30/09/2026)
 *
 * A da Visão geral, com o conteúdo do dia de quem atende:
 *
 * 1. **A saudação** — a data, o título e uma frase que diz o estado ("2 assuntos urgentes pedem
 *    sua atenção"), com as pílulas ao lado. A cheia é o próximo passo natural: continuar o
 *    atendimento em curso, ou começar o próximo.
 * 2. **Agora e A seguir**, lado a lado — o paciente da sala, e os três que vêm depois dele.
 * 3. **O que pede ação** — uma lista só, na forma da pauta da Visão geral (`PautaTabela`), por
 *    gravidade: boletim retido e dose atrasada da internação, quem espera na recepção, alerta de
 *    quem ainda vem hoje e, numa linha, os retornos sem horário.
 *
 * Antes eram seis cartões iguais e uma faixa vermelha no topo. A faixa virou a primeira linha da
 * lista, com o selo de urgente: a urgência mora no selo, não numa superfície pintada. Os retornos
 * viraram uma linha que leva a Atividades, dona da lista inteira — as duas telas repetiam a mesma.
 *
 * ## Por que a internação entra aqui
 *
 * Um veterinário com cinco animais internados abria a landing do próprio perfil e não via nenhum
 * deles: o portal parecia dois sistemas. Entra **só quem cobra ação** — boletim que não saiu, dose
 * atrasada —, e não a lista de internados: quem quer a lista tem o mapa de leitos.
 *
 * O boletim retido vem antes de tudo: é a única pendência do dia com uma pessoa do outro lado, sem
 * notícia do próprio animal, esperando um contato que ninguém sabe que precisa fazer.
 */
import '@/components/home/home-card.css'

import {
  PhBed,
  PhCalendarBlank,
  PhCheckCircle,
  PhClipboardText,
  PhClockCountdown,
  PhStethoscope,
  PhTimer,
} from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, onMounted, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter, type RouteLocationRaw } from 'vue-router'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import PautaTabela from '@/components/home/PautaTabela.vue'
import { porGravidade, type LinhaDaTabela } from '@/components/home/pauta-tabela'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicDevPanel from '@/features/clinico/components/base/ClinicDevPanel.vue'
import ClinicPatientHeader from '@/features/clinico/components/base/ClinicPatientHeader.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { encounterRepository } from '@/features/clinico/data/repositories'
import type { Appointment, Pet } from '@/features/clinico/data/types'
import { retornosVencidos, type RetornoPendente } from '@/features/clinico/domain/follow-up'
import { useAgendaStore } from '@/features/clinico/stores/agenda'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useInternacaoStore } from '@/features/clinico/stores/internacao'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

const { t, locale } = useI18n()
const router = useRouter()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const internacao = useInternacaoStore()
const formato = useClinicFormat()

const retornosPendentes = ref<RetornoPendente[]>([])

/** Quantas linhas a lista mostra antes de recolher o resto: o que se lê sem rolar a tela. */
const LIMITE_DA_PAUTA = 6
/** Quantos atendimentos o "A seguir" mostra depois do destaque. */
const LIMITE_A_SEGUIR = 3

const ENCERRADOS: Appointment['status'][] = ['cancelado', 'falta', 'finalizado']

const agora = computed(
  () => agenda.atendimentos.find((item) => item.status === 'em-atendimento') ?? null,
)

/** O próximo é o primeiro que ainda não começou — inclusive o encaixe que entrou agora. */
const aSeguir = computed(() => {
  const instante = clinicClock.nowIso()

  return (
    agenda.atendimentos
      .filter((item) => item.inicio > instante && !ENCERRADOS.includes(item.status))
      .sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null
  )
})

/** O paciente do cartão principal: o da sala, ou, com a sala vazia, o próximo. */
const destaque = computed(() => agora.value ?? aSeguir.value)

/** Os que vêm depois do destaque, sem repeti-lo. */
const proximos = computed(() => {
  const instante = clinicClock.nowIso()

  return agenda.atendimentos
    .filter(
      (item) =>
        item.id !== destaque.value?.id &&
        item.inicio > instante &&
        !ENCERRADOS.includes(item.status) &&
        item.status !== 'em-atendimento',
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, LIMITE_A_SEGUIR)
})

const esperando = computed(() =>
  agenda.atendimentos
    .filter((item) => item.status === 'aguardando')
    .sort((a, b) => (a.chegadaEm ?? '').localeCompare(b.chegadaEm ?? '')),
)

/**
 * Alerta que muda conduta hoje: de quem **ainda vem**, e só de risco e atenção. Quem já foi
 * atendido sai — o alerta dele não muda mais nada hoje. Quem está na recepção leva o alerta na
 * própria linha, e o destaque, no próprio cartão: repetir o nome faz a lista parecer maior do que
 * o problema é.
 */
function alertasRelevantes(pet: Pet | null | undefined) {
  return pet ? pet.alertas.filter((alerta) => alerta.severidade !== 'info') : []
}

function textoDoAlerta(alerta: Pet['alertas'][number]) {
  return alerta.detalhe
    ? `${formato.alerta(alerta.kind)}: ${alerta.detalhe}`
    : formato.alerta(alerta.kind)
}

/**
 * Até quanto tempo depois do horário marcado alguém que não chegou ainda "vem": o atraso comum de
 * quem pega trânsito. Passou disso, é falta provável — e a falta tem tela própria.
 */
const TOLERANCIA_DE_ATRASO_MS = 30 * 60 * 1000

const alertasDeQuemVem = computed(() => {
  const vistos = new Set<string>()
  const limite = Date.parse(clinicClock.nowIso()) - TOLERANCIA_DE_ATRASO_MS

  return agenda.atendimentos
    .filter(
      (item) =>
        (item.status === 'agendado' || item.status === 'confirmado') &&
        item.id !== destaque.value?.id &&
        Date.parse(item.inicio) >= limite,
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .flatMap((item) => {
      const pet = clinico.pet(item.petId)
      const alertas = alertasRelevantes(pet)

      if (!pet || alertas.length === 0 || vistos.has(pet.id)) {
        return []
      }

      vistos.add(pet.id)

      return [{ pet, alertas, appointment: item }]
    })
})

/**
 * Os internados que cobram alguma coisa **agora**: primeiro quem tem boletim retido, depois quem
 * tem mais doses atrasadas. Um internado tranquilo não entra.
 */
const internadosComPendencia = computed(() =>
  (internacao.mapa?.leitos ?? [])
    .filter((item) => item.internacao !== null && (item.atrasadas > 0 || item.boletimRetido))
    .sort((a, b) => Number(b.boletimRetido) - Number(a.boletimRetido) || b.atrasadas - a.atrasadas),
)

function focoNaAgenda(appointmentId: string): RouteLocationRaw {
  return { path: '/veterinario/agenda', query: { foco: appointmentId } }
}

/** "Lola, Nina e mais 4": os primeiros nomes dizem de quem se trata sem abrir a outra tela. */
function nomesComResto(nomes: string[], mostrar = 2) {
  const visiveis = nomes.slice(0, mostrar).join(', ')
  const resto = nomes.length - mostrar

  return resto > 0 ? t('clinico.meuDia.pauta.eMais', { nomes: visiveis, total: resto }) : visiveis
}

/** O rosto do paciente para a linha da pauta, quando ele está no catálogo. */
function rostoDe(pet: ReturnType<typeof clinico.pet>): LinhaDaTabela['pet'] {
  return pet
    ? { nome: pet.nome, iniciais: pet.iniciais, especie: pet.especie, fotoUrl: pet.fotoUrl }
    : undefined
}

const linhasDaPauta = computed<LinhaDaTabela[]>(() => {
  const linhas: LinhaDaTabela[] = []
  const ondeInternacao = t('inicio.pauta.onde.internacao')
  const ondeAgenda = t('clinico.meuDia.pauta.ondeAgenda')

  for (const item of internadosComPendencia.value) {
    const to = `/veterinario/internacao/${item.internacao!.id}`
    const doses = t('clinico.meuDia.pauta.doses', { total: item.atrasadas }, item.atrasadas)

    if (item.boletimRetido) {
      linhas.push({
        id: `boletim-${item.leito.id}`,
        to,
        frase: t('clinico.meuDia.pauta.boletim', { pet: item.petNome }),
        detalhe: [item.leito.nome, item.atrasadas > 0 ? doses : ''].filter(Boolean).join(' · '),
        tom: 'risco',
        onde: ondeInternacao,
        pet: rostoDe(clinico.pet(item.internacao!.petId)),
      })
    } else {
      linhas.push({
        id: `doses-${item.leito.id}`,
        to,
        frase: `${item.petNome}: ${doses}`,
        detalhe: item.leito.nome,
        tom: 'risco',
        onde: ondeInternacao,
        pet: rostoDe(clinico.pet(item.internacao!.petId)),
      })
    }
  }

  for (const item of esperando.value) {
    const pet = clinico.pet(item.petId)
    const partes = [clinico.profissional(item.professionalId)?.nome ?? '']

    if (item.chegadaEm) {
      partes.push(t('clinico.meuDia.esperaDe', { valor: formato.relativo(item.chegadaEm) }))
    }

    partes.push(...alertasRelevantes(pet).map(textoDoAlerta))

    linhas.push({
      id: `espera-${item.id}`,
      to: focoNaAgenda(item.id),
      frase: t('clinico.meuDia.pauta.naRecepcao', { pet: pet?.nome ?? '' }),
      detalhe: partes.filter(Boolean).join(' · '),
      tom: 'atencao',
      onde: ondeAgenda,
      pet: rostoDe(pet),
    })
  }

  for (const { pet, alertas, appointment } of alertasDeQuemVem.value) {
    linhas.push({
      id: `alerta-${pet.id}`,
      to: focoNaAgenda(appointment.id),
      frase: t('clinico.meuDia.pauta.alerta', {
        pet: pet.nome,
        hora: formato.hora(appointment.inicio),
      }),
      detalhe: alertas.map(textoDoAlerta).join(' · '),
      tom: 'atencao',
      onde: ondeAgenda,
      pet: rostoDe(pet),
    })
  }

  const retornos = retornosPendentes.value.length

  if (retornos > 0) {
    linhas.push({
      id: 'retornos',
      to: '/veterinario/atividades',
      frase: t('clinico.meuDia.pauta.retornos', { total: retornos }, retornos),
      detalhe: nomesComResto(
        retornosPendentes.value.map((item) => clinico.pet(item.encounter.petId)?.nome ?? ''),
      ),
      tom: 'neutro',
      onde: t('inicio.pauta.onde.atividades'),
    })
  }

  return porGravidade(linhas)
})

/** A lista recolhida além do limite: urgência mora no alto, e o alto cabe na tela. */
const pautaAberta = ref(false)

const linhasVisiveis = computed(() =>
  pautaAberta.value ? linhasDaPauta.value : linhasDaPauta.value.slice(0, LIMITE_DA_PAUTA),
)

const linhasRecolhidas = computed(() => Math.max(0, linhasDaPauta.value.length - LIMITE_DA_PAUTA))

/** A frase da saudação: quantos assuntos urgentes, ou quantos esperando, ou o dia em dia. */
const fraseDoResumo = computed(() => {
  const total = linhasDaPauta.value.length
  const urgentes = linhasDaPauta.value.filter((linha) => linha.tom === 'risco').length

  if (urgentes > 0) {
    return t('clinico.meuDia.resumo.urgentes', { total: urgentes }, urgentes)
  }

  if (total > 0) {
    return t('clinico.meuDia.resumo.pendentes', { total }, total)
  }

  return t('clinico.meuDia.resumo.emDia')
})

const dataDeHoje = computed(() => {
  const intl = INTL_LOCALE[locale.value as Locale]
  const rotulo = new Date(clinicClock.nowIso()).toLocaleDateString(intl, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })

  return rotulo.charAt(0).toLocaleUpperCase(intl) + rotulo.slice(1)
})

type Acao = { id: string; rotulo: string; icone: Component; to?: string; executar?: () => void }

/**
 * As pílulas da saudação. A primeira é cheia: continuar quem está na sala, ou atender o próximo.
 * Sem ninguém na sala nem por vir, a agenda completa assume o lugar.
 */
const acoes = computed<Acao[]>(() => {
  const lista: Acao[] = []
  const item = destaque.value

  if (item) {
    const nome = clinico.pet(item.petId)?.nome ?? ''

    lista.push({
      id: 'prontuario',
      rotulo: agora.value
        ? t('clinico.meuDia.continuarCom', { pet: nome })
        : t('clinico.meuDia.atenderCom', { pet: nome }),
      icone: PhStethoscope,
      executar: () => abrirProntuario(item),
    })
  }

  lista.push({
    id: 'agenda',
    rotulo: t('clinico.meuDia.agendaCompleta'),
    icone: PhCalendarBlank,
    to: '/veterinario/agenda',
  })

  lista.push({
    id: 'leitos',
    rotulo: t('clinico.meuDia.mapaDeLeitos'),
    icone: PhBed,
    to: '/veterinario/internacao',
  })

  return lista
})

const erroTraduzido = computed(() => (agenda.erro ? t(agenda.erro) : ''))

function abrirProntuario(appointment: Appointment) {
  void router.push(
    appointment.encounterId
      ? `/veterinario/atendimento/${appointment.encounterId}`
      : `/veterinario/atendimento/novo-${appointment.id}`,
  )
}

async function carregar() {
  await clinico.carregar()
  agenda.hoje()
  await agenda.carregarDia()

  /*
   * O mapa de leitos entra fora do `await` em sequência: ele é o único bloco desta tela que não
   * pertence à agenda, e prendê-lo atrás dela faria a landing esperar duas viagens para desenhar
   * a primeira. Falhar aqui também não derruba o resto.
   */
  const mapa = internacao.carregarMapa()

  retornosPendentes.value = retornosVencidos(
    await encounterRepository.listarRetornosPendentes(),
    clinicClock,
    clinicClock.today(),
  )

  await mapa
}

onMounted(carregar)
</script>

<template>
  <PartnerPageFrame
    class="hc-tema hoje"
    :title="t('clinico.meuDia.titulo')"
    :loading="agenda.carregando && !agenda.dia"
    :error="erroTraduzido"
    block-when-suspended
    @retry="carregar"
  >
    <template #cabecalho>
      <div class="hc-saudacao">
        <time class="hc-saudacao__data" :datetime="clinicClock.today()">{{ dataDeHoje }}</time>
        <h1 class="hc-saudacao__titulo">{{ t('clinico.meuDia.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p class="hc-saudacao__resumo" aria-live="polite">{{ fraseDoResumo }}</p>

          <nav class="hc-acoes" :aria-label="t('clinico.meuDia.acoesRotulo')">
            <template v-for="(acao, indice) in acoes" :key="acao.id">
              <RouterLink
                v-if="acao.to"
                class="hc-pilula"
                :class="{ 'hc-pilula--cheia': indice === 0 }"
                :to="acao.to"
              >
                <component
                  :is="acao.icone"
                  class="hc-pilula__icone"
                  :weight="indice === 0 ? 'fill' : 'duotone'"
                  aria-hidden="true"
                />
                {{ acao.rotulo }}
              </RouterLink>
              <Button
                v-else
                type="button"
                class="hc-pilula"
                :class="{ 'hc-pilula--cheia': indice === 0 }"
                :label="acao.rotulo"
                @click="acao.executar?.()"
              >
                <template #icon>
                  <component
                    :is="acao.icone"
                    class="hc-pilula__icone"
                    :weight="indice === 0 ? 'fill' : 'duotone'"
                    aria-hidden="true"
                  />
                </template>
              </Button>
            </template>
          </nav>
        </div>
      </div>
    </template>

    <div class="hoje__conteudo clinic-scope">
      <div class="hoje__grade">
        <!-- 1. o que é agora -->
        <section class="hc agora" aria-labelledby="hoje-agora">
          <header class="hc__cabeca">
            <h2 id="hoje-agora" class="hc__titulo">
              <PhStethoscope class="hc__icone" weight="duotone" aria-hidden="true" />
              {{ agora ? t('clinico.meuDia.agora') : t('clinico.meuDia.aSeguir') }}
            </h2>
            <span v-if="destaque" class="agora__hora">{{ formato.hora(destaque.inicio) }}</span>
          </header>

          <template v-if="destaque">
            <ClinicPatientHeader
              :pet="clinico.pet(destaque.petId)"
              :tutor="clinico.tutor(destaque.tutorId)"
            >
              <!-- O que se lê antes de entrar na sala: só faz sentido para quem ainda vai entrar. -->
              <template v-if="!agora" #acoes>
                <RouterLink
                  class="hc-pilula"
                  :to="`/veterinario/paciente/${destaque.petId}/resumo`"
                >
                  <PhTimer class="hc-pilula__icone" weight="duotone" aria-hidden="true" />
                  {{ t('clinico.resumoDoPaciente.verResumo') }}
                </RouterLink>
              </template>
            </ClinicPatientHeader>

            <p class="agora__meta">
              {{ clinico.tipo(destaque.typeId)?.nome }}
              ·
              {{ clinico.profissional(destaque.professionalId)?.nome }}
              <template v-if="!agora"> · {{ formato.relativo(destaque.inicio) }}</template>
            </p>
          </template>

          <p v-else class="hoje__vazio">
            <PhCheckCircle class="hoje__vazio-icone" weight="fill" aria-hidden="true" />
            {{ t('clinico.meuDia.semProximo') }}
          </p>
        </section>

        <!-- 2. o que vem depois -->
        <section class="hc seguir" aria-labelledby="hoje-seguir">
          <header class="hc__cabeca">
            <h2 id="hoje-seguir" class="hc__titulo">
              <PhClockCountdown class="hc__icone" weight="duotone" aria-hidden="true" />
              <!-- Com a sala vazia o cartão ao lado já é o "A seguir": este vira o "Depois". -->
              {{ agora ? t('clinico.meuDia.aSeguir') : t('clinico.meuDia.depois') }}
            </h2>
            <RouterLink class="hc__link" to="/veterinario/agenda">
              {{ t('clinico.meuDia.agendaCompleta') }}
              <i class="ph ph-arrow-right hoje__seta" aria-hidden="true" />
            </RouterLink>
          </header>

          <ul v-if="proximos.length > 0" class="seguir__lista">
            <li v-for="item in proximos" :key="item.id">
              <RouterLink class="seguir__item" :to="focoNaAgenda(item.id)">
                <span class="seguir__hora">{{ formato.hora(item.inicio) }}</span>
                <PetAvatar
                  :nome="clinico.pet(item.petId)?.nome ?? ''"
                  :iniciais="clinico.pet(item.petId)?.iniciais ?? ''"
                  :especie="clinico.pet(item.petId)?.especie ?? null"
                  :foto-url="clinico.pet(item.petId)?.fotoUrl ?? ''"
                  tamanho="md"
                />
                <span class="seguir__corpo">
                  <strong>{{ clinico.pet(item.petId)?.nome }}</strong>
                  <small>
                    {{ clinico.tipo(item.typeId)?.nome }} ·
                    {{ clinico.profissional(item.professionalId)?.nome }}
                  </small>
                </span>
              </RouterLink>
            </li>
          </ul>

          <p v-else class="hoje__vazio">
            <PhCheckCircle class="hoje__vazio-icone" weight="fill" aria-hidden="true" />
            {{ t('clinico.meuDia.semProximo') }}
          </p>
        </section>
      </div>

      <!-- 3. o que pede ação -->
      <section class="hc pauta" aria-labelledby="hoje-pauta">
        <header class="hc__cabeca">
          <h2 id="hoje-pauta" class="hc__titulo">
            <PhClipboardText class="hc__icone" weight="duotone" aria-hidden="true" />
            {{ t('inicio.pauta.titulo') }}
          </h2>
          <span v-if="linhasDaPauta.length > 0" class="pauta__contagem">
            {{ t('inicio.pauta.contagem', { total: linhasDaPauta.length }, linhasDaPauta.length) }}
          </span>
        </header>

        <template v-if="linhasDaPauta.length > 0">
          <PautaTabela :linhas="linhasVisiveis" />

          <Button
            v-if="linhasRecolhidas > 0"
            type="button"
            class="pauta__mais"
            severity="secondary"
            text
            size="small"
            :label="
              pautaAberta
                ? t('clinico.meuDia.pauta.mostrarMenos')
                : t('clinico.meuDia.pauta.mostrarMais', { total: linhasRecolhidas })
            "
            :aria-expanded="pautaAberta"
            @click="pautaAberta = !pautaAberta"
          />
        </template>

        <p v-else class="hoje__vazio">
          <PhCheckCircle class="hoje__vazio-icone" weight="fill" aria-hidden="true" />
          {{ t('inicio.pauta.calma') }}
        </p>
      </section>
    </div>

    <ClinicDevPanel />
  </PartnerPageFrame>
</template>

<style scoped>
.hoje__conteudo {
  display: grid;
  gap: 1.25rem;
  container-type: inline-size;
}

/*
 * Agora e A seguir lado a lado quando o conteúdo tem largura para os dois — pela largura do
 * conteúdo, não da janela: com trilho e painel abertos, um tablet deixa uns 720px para a página.
 */
.hoje__grade {
  display: grid;
  align-items: start;
  gap: 1.25rem;
}

@container (min-width: 56rem) {
  .hoje__grade {
    grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  }
}

/* ------------------------------------------------------------------ agora */

.agora__hora {
  color: var(--hc-tinta);
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
  font-weight: 750;
  letter-spacing: -0.03em;
}

/* O cabeçalho do paciente já é um cartão; aqui ele mora dentro de um, e fica plano. */
.agora :deep(.paciente) {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.agora__meta {
  margin: 0;
  padding-block-start: 0.85rem;
  border-block-start: 1px solid var(--hc-linha);
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

/* ------------------------------------------------------------------ a seguir */

.seguir__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.seguir__lista li + li {
  border-block-start: 1px solid var(--hc-linha);
}

.seguir__item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-height: 3rem;
  padding: 0.55rem 0.5rem;
  border-radius: 0.5rem;
  color: var(--hc-tinta);
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.seguir__item:hover {
  background: var(--hc-fundo);
}

.seguir__item:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: -2px;
}

.seguir__hora {
  flex: 0 0 auto;
  min-width: 3rem;
  color: var(--hc-marca-forte);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.seguir__corpo {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.seguir__corpo strong,
.seguir__corpo small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seguir__corpo strong {
  font-size: 0.875rem;
  font-weight: 600;
}

.seguir__corpo small {
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
}

.hoje__seta {
  font-size: 0.7rem;
}

[dir='rtl'] .hoje__seta {
  scale: -1 1;
}

/* ------------------------------------------------------------------ o que pede ação */

.pauta {
  gap: 0.75rem;
}

.pauta__contagem {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

/* `.pauta` na frente: o `.clinic-scope` pinta todo botão de texto com a tinta, e empatava. */
.pauta .pauta__mais.p-button {
  justify-self: start;
  color: var(--hc-marca-forte);
  font-weight: 600;
}

/* ------------------------------------------------------------------ vazio */

.hoje__vazio {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.4rem 0.25rem;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

.hoje__vazio-icone {
  flex-shrink: 0;
  width: 1.05rem;
  height: 1.05rem;
  color: var(--hc-verde-tinta);
}

@media (prefers-reduced-motion: reduce) {
  .seguir__item {
    transition: none;
  }
}
</style>
