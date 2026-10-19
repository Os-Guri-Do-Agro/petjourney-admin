<script setup lang="ts">
/**
 * Hoje — a primeira tela da Clínica.
 *
 * Quem abre o portal às oito não pergunta "que horas tenho livre"; pergunta **o que é agora e o
 * que não pode esperar**. A tela responde no formato da própria clínica: o caminho que o paciente
 * faz lá dentro.
 *
 * 1. **Recepção** — quem já chegou e espera, com o tempo de espera em destaque e o alerta que muda
 *    a conduta. Dali se começa a consulta.
 * 2. **Em consulta** — quem está nas salas agora, com quem e desde quando. Dali se volta ao
 *    prontuário.
 * 3. **A seguir** — os próximos horários do dia.
 *
 * Embaixo, **o que pede ação**: boletim retido e dose atrasada da internação, quem espera, alerta
 * de quem ainda vem e os retornos sem horário — da mais grave para a menos.
 *
 * A internação entra só no que cobra ação; quem quer a lista de internados tem o mapa de leitos.
 * O boletim retido vem antes de tudo: é a única pendência do dia com uma pessoa do outro lado,
 * sem notícia do próprio animal, esperando um contato que ninguém sabe que precisa fazer.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter, type RouteLocationRaw } from 'vue-router'

import { porGravidade, type LinhaDaTabela } from '@/components/home/pauta-tabela'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiPauta from '@/components/ui/UiPauta.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import ClinicDevPanel from '@/features/clinico/components/base/ClinicDevPanel.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { encounterRepository } from '@/features/clinico/data/repositories'
import type { Appointment, Pet } from '@/features/clinico/data/types'
import { retornosVencidos, type RetornoPendente } from '@/features/clinico/domain/follow-up'
import { useAgendaStore } from '@/features/clinico/stores/agenda'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useInternacaoStore } from '@/features/clinico/stores/internacao'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

const { t, locale } = useI18n()
const router = useRouter()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const internacao = useInternacaoStore()
const formato = useClinicFormat()

const retornosPendentes = ref<RetornoPendente[]>([])

/** Quantos horários o "A seguir" mostra: o que cabe ao lado das outras duas colunas. */
const LIMITE_A_SEGUIR = 5

const ENCERRADOS: Appointment['status'][] = ['cancelado', 'falta', 'finalizado']

/**
 * Um atendimento ligado (a mesma cirurgia em duas salas, com dois profissionais) é um paciente
 * só: aparece uma vez, com os profissionais juntos na linha.
 */
function umPorGrupo(lista: Appointment[]) {
  const vistos = new Set<string>()

  return lista.filter((item) => {
    const chave = item.linkedGroupId ?? item.id

    if (vistos.has(chave)) {
      return false
    }

    vistos.add(chave)

    return true
  })
}

const emConsulta = computed(() =>
  umPorGrupo(
    agenda.atendimentos
      .filter((item) => item.status === 'em-atendimento')
      .sort((a, b) => (a.iniciadoEm ?? a.inicio).localeCompare(b.iniciadoEm ?? b.inicio)),
  ),
)

const naRecepcao = computed(() =>
  agenda.atendimentos
    .filter((item) => item.status === 'aguardando')
    .sort((a, b) => (a.chegadaEm ?? a.inicio).localeCompare(b.chegadaEm ?? b.inicio)),
)

/** O que ainda não começou, do mais cedo para o mais tarde — inclusive o encaixe de agora. */
const aSeguir = computed(() => {
  const instante = clinicClock.nowIso()

  return agenda.atendimentos
    .filter(
      (item) =>
        item.inicio > instante &&
        !ENCERRADOS.includes(item.status) &&
        item.status !== 'em-atendimento' &&
        item.status !== 'aguardando',
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
})

const proximos = computed(() => aSeguir.value.slice(0, LIMITE_A_SEGUIR))

/**
 * O paciente da ação principal: o primeiro que está na sala, ou o primeiro da recepção, ou o
 * próximo horário. É o "e agora?" de quem acabou de chegar ao computador.
 */
const destaque = computed(
  () => emConsulta.value[0] ?? naRecepcao.value[0] ?? aSeguir.value[0] ?? null,
)

/**
 * Alerta que muda conduta hoje: de quem **ainda vem**, e só de risco e atenção. Quem já foi
 * atendido sai; quem está na recepção leva o alerta na própria linha.
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

/** Os internados que cobram alguma coisa **agora**: boletim retido primeiro, depois doses. */
const internadosComPendencia = computed(() =>
  (internacao.mapa?.leitos ?? [])
    .filter((item) => item.internacao !== null && (item.atrasadas > 0 || item.boletimRetido))
    .sort((a, b) => Number(b.boletimRetido) - Number(a.boletimRetido) || b.atrasadas - a.atrasadas),
)

function focoNaAgenda(appointmentId: string): RouteLocationRaw {
  return { path: '/veterinario/agenda', query: { foco: appointmentId } }
}

function rotaDoProntuario(appointment: Appointment) {
  return appointment.encounterId
    ? `/veterinario/atendimento/${appointment.encounterId}`
    : `/veterinario/atendimento/novo-${appointment.id}`
}

function abrirProntuario(appointment: Appointment) {
  void router.push(rotaDoProntuario(appointment))
}

/** "Lola, Nina e mais 4": os primeiros nomes dizem de quem se trata sem abrir a outra tela. */
function nomesComResto(nomes: string[], mostrar = 2) {
  const visiveis = nomes.slice(0, mostrar).join(', ')
  const resto = nomes.length - mostrar

  return resto > 0 ? t('clinico.meuDia.pauta.eMais', { nomes: visiveis, total: resto }) : visiveis
}

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

    linhas.push(
      item.boletimRetido
        ? {
            id: `boletim-${item.leito.id}`,
            to,
            frase: t('clinico.meuDia.pauta.boletim', { pet: item.petNome }),
            detalhe: [item.leito.nome, item.atrasadas > 0 ? doses : ''].filter(Boolean).join(' · '),
            tom: 'risco',
            onde: ondeInternacao,
            pet: rostoDe(clinico.pet(item.internacao!.petId)),
          }
        : {
            id: `doses-${item.leito.id}`,
            to,
            frase: `${item.petNome}: ${doses}`,
            detalhe: item.leito.nome,
            tom: 'risco',
            onde: ondeInternacao,
            pet: rostoDe(clinico.pet(item.internacao!.petId)),
          },
    )
  }

  for (const item of naRecepcao.value) {
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
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return rotulo.charAt(0).toLocaleUpperCase(intl) + rotulo.slice(1)
})

/** A ação principal muda com o momento: continuar quem está na sala, ou começar o próximo. */
const acaoPrincipal = computed(() => {
  const item = destaque.value

  if (!item) {
    return null
  }

  const nome = clinico.pet(item.petId)?.nome ?? ''

  return {
    rotulo:
      item.status === 'em-atendimento'
        ? t('clinico.meuDia.continuarCom', { pet: nome })
        : t('clinico.meuDia.atenderCom', { pet: nome }),
    item,
  }
})

/** Minutos desde um instante, para o número grande da espera e da consulta. */
function minutosDesde(iso: string | null) {
  if (!iso) {
    return null
  }

  return Math.max(0, Math.round((Date.parse(clinicClock.nowIso()) - Date.parse(iso)) / 60_000))
}

function linhaDoAtendimento(item: Appointment) {
  const profissionais = item.linkedGroupId
    ? agenda.atendimentos
        .filter((outro) => outro.linkedGroupId === item.linkedGroupId)
        .map((outro) => clinico.profissional(outro.professionalId)?.nome)
    : [clinico.profissional(item.professionalId)?.nome]

  return [clinico.tipo(item.typeId)?.nome, [...new Set(profissionais.filter(Boolean))].join(', ')]
    .filter(Boolean)
    .join(' · ')
}

const erroTraduzido = computed(() => (agenda.erro ? t(agenda.erro) : ''))

async function carregar() {
  await clinico.carregar()
  agenda.hoje()
  await agenda.carregarDia()

  /*
   * O mapa de leitos entra fora do `await` em sequência: é o único bloco desta tela que não
   * pertence à agenda, e prendê-lo atrás dela faria a tela esperar duas viagens para desenhar.
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
  <UiPagina
    :carregando="agenda.carregando && !agenda.dia"
    :erro="erroTraduzido"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template #resumo>
      <time :datetime="clinicClock.today()">{{ dataDeHoje }}</time>{{ '. ' }}
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template #acoes>
      <Button
        v-if="acaoPrincipal"
        type="button"
        icon="ph ph-stethoscope"
        :label="acaoPrincipal.rotulo"
        @click="abrirProntuario(acaoPrincipal.item)"
      />
    </template>

    <div class="hoje">
      <!-- O caminho do paciente dentro da clínica: recepção, sala, e quem vem depois. -->
      <div class="andar">
        <section class="posto posto--recepcao ui-folha" aria-labelledby="posto-recepcao">
          <header class="posto__cabeca">
            <span class="posto__ponto" aria-hidden="true" />
            <h2 id="posto-recepcao">{{ t('clinico.hoje.recepcao') }}</h2>
            <span class="ui-contagem">{{ naRecepcao.length }}</span>
          </header>

          <ul v-if="naRecepcao.length" class="ui-lista">
            <li v-for="item in naRecepcao" :key="item.id" class="posto__item">
              <div class="posto__quem">
                <PetAvatar
                  :nome="clinico.pet(item.petId)?.nome ?? ''"
                  :iniciais="clinico.pet(item.petId)?.iniciais ?? ''"
                  :especie="clinico.pet(item.petId)?.especie ?? null"
                  :foto-url="clinico.pet(item.petId)?.fotoUrl ?? ''"
                  tamanho="md"
                />
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">{{ clinico.pet(item.petId)?.nome }}</strong>
                  <span class="ui-linha__meta">{{ linhaDoAtendimento(item) }}</span>
                </span>
                <span class="posto__tempo">
                  <strong class="ui-num">{{ minutosDesde(item.chegadaEm) ?? 0 }}</strong>
                  <small>{{ t('clinico.hoje.minEsperando') }}</small>
                </span>
              </div>

              <ul
                v-if="alertasRelevantes(clinico.pet(item.petId)).length"
                class="posto__alertas"
                :aria-label="t('clinico.hoje.alertas')"
              >
                <li
                  v-for="alerta in alertasRelevantes(clinico.pet(item.petId))"
                  :key="alerta.id"
                  class="ui-selo"
                  :class="`ui-selo--${alerta.severidade}`"
                >
                  <i class="ph ph-warning" aria-hidden="true" />
                  {{ textoDoAlerta(alerta) }}
                </li>
              </ul>

              <div class="posto__acoes">
                <Button
                  type="button"
                  size="small"
                  icon="ph ph-door-open"
                  :label="t('clinico.hoje.chamar')"
                  @click="abrirProntuario(item)"
                />
                <RouterLink class="ui-mais" :to="`/veterinario/paciente/${item.petId}/resumo`">
                  {{ t('clinico.resumoDoPaciente.verResumo') }}
                </RouterLink>
              </div>
            </li>
          </ul>
          <p v-else class="ui-vazio">{{ t('clinico.hoje.recepcaoVazia') }}</p>
        </section>

        <section class="posto posto--sala ui-folha" aria-labelledby="posto-sala">
          <header class="posto__cabeca">
            <span class="posto__ponto" aria-hidden="true" />
            <h2 id="posto-sala">{{ t('clinico.hoje.emConsulta') }}</h2>
            <span class="ui-contagem">{{ emConsulta.length }}</span>
          </header>

          <ul v-if="emConsulta.length" class="ui-lista">
            <li v-for="item in emConsulta" :key="item.id">
              <RouterLink class="ui-linha posto__linha" :to="rotaDoProntuario(item)">
                <PetAvatar
                  :nome="clinico.pet(item.petId)?.nome ?? ''"
                  :iniciais="clinico.pet(item.petId)?.iniciais ?? ''"
                  :especie="clinico.pet(item.petId)?.especie ?? null"
                  :foto-url="clinico.pet(item.petId)?.fotoUrl ?? ''"
                  tamanho="md"
                />
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">{{ clinico.pet(item.petId)?.nome }}</strong>
                  <span class="ui-linha__meta">{{ linhaDoAtendimento(item) }}</span>
                </span>
                <span class="posto__tempo">
                  <strong class="ui-num">{{ minutosDesde(item.iniciadoEm ?? item.inicio) }}</strong>
                  <small>{{ t('clinico.hoje.minNaSala') }}</small>
                </span>
                <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
              </RouterLink>
            </li>
          </ul>
          <p v-else class="ui-vazio">{{ t('clinico.hoje.salaVazia') }}</p>
        </section>

        <section class="posto posto--seguir ui-folha" aria-labelledby="posto-seguir">
          <header class="posto__cabeca">
            <span class="posto__ponto" aria-hidden="true" />
            <h2 id="posto-seguir">{{ t('clinico.meuDia.aSeguir') }}</h2>
            <span class="ui-contagem">{{ aSeguir.length }}</span>
          </header>

          <ul v-if="proximos.length" class="ui-lista">
            <li v-for="item in proximos" :key="item.id">
              <RouterLink class="ui-linha posto__linha" :to="focoNaAgenda(item.id)">
                <span class="ui-hora posto__hora">{{ formato.hora(item.inicio) }}</span>
                <PetAvatar
                  :nome="clinico.pet(item.petId)?.nome ?? ''"
                  :iniciais="clinico.pet(item.petId)?.iniciais ?? ''"
                  :especie="clinico.pet(item.petId)?.especie ?? null"
                  :foto-url="clinico.pet(item.petId)?.fotoUrl ?? ''"
                  tamanho="sm"
                />
                <span class="ui-linha__texto">
                  <strong class="ui-linha__titulo">{{ clinico.pet(item.petId)?.nome }}</strong>
                  <span class="ui-linha__meta">{{ linhaDoAtendimento(item) }}</span>
                </span>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="ui-vazio">{{ t('clinico.meuDia.semProximo') }}</p>

          <footer class="posto__pe">
            <RouterLink class="ui-mais" to="/veterinario/agenda">
              {{ t('clinico.meuDia.agendaCompleta') }}
              <i class="ph ph-arrow-right" aria-hidden="true" />
            </RouterLink>
          </footer>
        </section>
      </div>

      <UiSecao
        id="hoje-pauta"
        :titulo="t('inicio.pauta.titulo')"
        :contagem="linhasDaPauta.length || null"
      >
        <UiPauta v-if="linhasDaPauta.length" :linhas="linhasDaPauta" />
        <p v-else class="ui-folha ui-vazio">
          <strong>{{ t('inicio.pauta.calma') }}</strong>
        </p>
      </UiSecao>
    </div>

    <template #sempre>
      <ClinicDevPanel />
    </template>
  </UiPagina>
</template>

<style scoped>
.hoje {
  display: grid;
  gap: 36px;
}

/* As três colunas são o caminho do paciente: da esquerda (chegou) para a direita (vem depois). */
.andar {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.posto {
  display: grid;
  overflow: hidden;
}

.posto__cabeca {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--linha);
}

.posto__cabeca h2 {
  flex: 1;
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.posto__ponto {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--tinta-3);
}

.posto--recepcao .posto__ponto {
  background: var(--atencao);
}

.posto--sala .posto__ponto {
  background: var(--clinica);
}

.posto--recepcao .posto__cabeca {
  background: color-mix(in oklab, var(--atencao-fundo) 55%, var(--superficie));
}

.posto--sala .posto__cabeca {
  background: color-mix(in oklab, var(--clinica-fundo) 55%, var(--superficie));
}

.posto__item {
  display: grid;
  gap: 10px;
  padding: 14px 18px 16px;
}

.posto__quem {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* O número grande: quanto tempo esperando, quanto tempo na sala. */
.posto__tempo {
  display: grid;
  flex: none;
  justify-items: end;
  line-height: 1.05;
}

.posto__tempo strong {
  color: var(--tinta);
  font-size: 22px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.posto--recepcao .posto__tempo strong {
  color: var(--atencao-tinta);
}

.posto__tempo small {
  color: var(--tinta-3);
  font-size: 11.5px;
}

.posto__alertas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0 0 0 48px;
  list-style: none;
}

.posto__alertas .ui-selo {
  flex: 0 1 auto;
  max-width: 100%;
  height: auto;
  min-height: 24px;
  padding-block: 4px;
  white-space: normal;
}

.posto__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding-left: 48px;
}

.posto__linha {
  padding-inline: 18px;
}

.posto__hora {
  width: 44px;
  flex: none;
}

.posto__pe {
  padding: 12px 18px 16px;
  border-top: 1px solid var(--linha);
}

@media (max-width: 1240px) {
  .andar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .posto--seguir {
    grid-column: 1 / -1;
  }
}

@media (max-width: 760px) {
  .andar {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
