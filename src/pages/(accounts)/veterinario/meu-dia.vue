<script setup lang="ts">
/**
 * Meu dia — a landing natural do perfil veterinário.
 *
 * A agenda responde a pergunta errada para quem chega de manhã. Grade é ferramenta de quem
 * **procura horário**; quem abre o portal às oito pergunta **o que é agora**.
 *
 * Esta tela responde nesta ordem, e a ordem é o conteúdo:
 * 1. o que estou atendendo, ou o que vem em seguida;
 * 2. quem já chegou e está esperando;
 * 3. quem está internado e cobra alguma coisa agora;
 * 4. quem tem alerta que muda conduta hoje;
 * 5. que retorno ficou sem horário marcado — receita parada na mesa.
 *
 * A agenda completa fica a um clique.
 *
 * ## Por que a internação entrou aqui
 *
 * Ela não estava, e a ausência tinha consequência: um veterinário com cinco animais internados
 * abria a landing do próprio perfil e não via nenhum deles. O portal parecia dois sistemas — o
 * das consultas, que "Meu dia" resumia, e o da internação, que só existia para quem lembrasse de
 * abrir o mapa de leitos. Foi essa costura faltando que fez o fluxo ser descrito como confuso.
 *
 * O bloco mostra **só quem cobra ação** — dose atrasada, boletim que não saiu —, e não a lista de
 * internados. Quem quer a lista tem o mapa; quem abre esta tela às oito da manhã quer saber o que
 * não pode esperar. Um bloco que repete o mapa inteiro é um bloco que ninguém lê duas vezes.
 *
 * O boletim retido sobe **acima de tudo**, junto com o destaque: é a única pendência do dia em
 * que há uma pessoa do outro lado, sem notícia do próprio animal, esperando um telefonema que
 * ninguém sabe que precisa dar.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicAlertChip from '@/features/clinico/components/base/ClinicAlertChip.vue'
import ClinicPatientHeader from '@/features/clinico/components/base/ClinicPatientHeader.vue'
import ClinicDevPanel from '@/features/clinico/components/base/ClinicDevPanel.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { encounterRepository } from '@/features/clinico/data/repositories'
import type { Appointment } from '@/features/clinico/data/types'
import { retornosVencidos, type RetornoPendente } from '@/features/clinico/domain/follow-up'
import { useAgendaStore } from '@/features/clinico/stores/agenda'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useInternacaoStore } from '@/features/clinico/stores/internacao'

const { t } = useI18n()
const router = useRouter()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const internacao = useInternacaoStore()
const formato = useClinicFormat()

const retornosPendentes = ref<RetornoPendente[]>([])

const agora = computed(
  () => agenda.atendimentos.find((item) => item.status === 'em-atendimento') ?? null,
)

/** O próximo é o primeiro que ainda não começou — inclusive o encaixe que entrou agora. */
const aSeguir = computed(() => {
  const instante = clinicClock.nowIso()

  return (
    agenda.atendimentos
      .filter(
        (item) =>
          item.inicio > instante && !['cancelado', 'falta', 'finalizado'].includes(item.status),
      )
      .sort((a, b) => a.inicio.localeCompare(b.inicio))[0] ?? null
  )
})

const esperando = computed(() =>
  agenda.atendimentos
    .filter((item) => item.status === 'aguardando')
    .sort((a, b) => (a.chegadaEm ?? '').localeCompare(b.chegadaEm ?? '')),
)

/**
 * Alerta que muda conduta **hoje**: só de pacientes que a clínica vai ver hoje, e só os de
 * risco e atenção. Listar todo alerta de todo paciente transforma o painel em ruído.
 *
 * Uma linha por paciente, com todos os alertas dele juntos — repetir o nome três vezes faz a
 * lista parecer maior do que o problema é.
 */
const alertasDoDia = computed(() => {
  const vistos = new Set<string>()

  return agenda.atendimentos
    .filter((item) => !['cancelado', 'falta'].includes(item.status))
    .flatMap((item) => {
      const pet = clinico.pet(item.petId)

      if (!pet || vistos.has(pet.id)) {
        return []
      }

      const relevantes = pet.alertas.filter((alerta) => alerta.severidade !== 'info')

      if (relevantes.length === 0) {
        return []
      }

      vistos.add(pet.id)

      return [{ pet, alertas: relevantes, appointment: item }]
    })
})

/**
 * Os internados que cobram alguma coisa **agora**.
 *
 * Ordenados pelo que mais dói: primeiro quem tem boletim retido — há uma pessoa esperando
 * telefonema —, depois quem tem mais doses atrasadas. Um internado tranquilo não entra: quem
 * quer a lista completa tem o mapa de leitos, e repetir o mapa aqui faria o bloco virar
 * paisagem.
 */
const internadosComPendencia = computed(() =>
  (internacao.mapa?.leitos ?? [])
    .filter((item) => item.internacao !== null && (item.atrasadas > 0 || item.boletimRetido))
    .sort((a, b) => Number(b.boletimRetido) - Number(a.boletimRetido) || b.atrasadas - a.atrasadas),
)

const boletinsRetidos = computed(() => internacao.mapa?.boletinsRetidos ?? 0)

/**
 * Quantos itens cada bloco mostra antes de ceder o resto para a página que é dona do assunto.
 * Quatro é o que se lê de relance; o quinto já obriga a rolar, e um painel de "o que é agora"
 * que exige rolagem deixou de responder a pergunta.
 */
const LIMITE_DO_BLOCO = 4

const esperandoVisiveis = computed(() => esperando.value.slice(0, LIMITE_DO_BLOCO))
const internadosVisiveis = computed(() => internadosComPendencia.value.slice(0, LIMITE_DO_BLOCO))
const alertasVisiveis = computed(() => alertasDoDia.value.slice(0, LIMITE_DO_BLOCO))
const retornosVisiveis = computed(() => retornosPendentes.value.slice(0, LIMITE_DO_BLOCO))

const erroTraduzido = computed(() => (agenda.erro ? t(agenda.erro) : ''))

function abrirProntuario(appointment: Appointment) {
  void router.push(
    appointment.encounterId
      ? `/veterinario/atendimento/${appointment.encounterId}`
      : `/veterinario/atendimento/novo-${appointment.id}`,
  )
}

function irParaAgenda(appointmentId?: string) {
  void router.push({
    path: '/veterinario/agenda',
    query: appointmentId ? { foco: appointmentId } : {},
  })
}

function irParaInternacao(internacaoId?: string) {
  void router.push(
    internacaoId ? `/veterinario/internacao/${internacaoId}` : '/veterinario/internacao',
  )
}

async function carregar() {
  await clinico.carregar()
  agenda.hoje()
  await agenda.carregarDia()

  /*
   * O mapa de leitos entra fora do `await` em sequência: ele é o único bloco desta tela que não
   * pertence à agenda, e prendê-lo atrás dela faria a landing esperar duas viagens para desenhar
   * a primeira. Falhar aqui também não derruba o resto — sem internação, "Meu dia" continua
   * respondendo o que sempre respondeu.
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
    :subtitle="t('clinico.meuDia.subtitulo')"
    :title="t('clinico.meuDia.titulo')"
    :loading="agenda.carregando && !agenda.dia"
    :error="erroTraduzido"
    block-when-suspended
    @retry="carregar"
  >
    <template #actions>
      <span class="clinic-scope clinic-acoes">
        <Button
          :label="t('clinico.meuDia.irParaAgenda')"
          icon="pi pi-calendar"
          severity="secondary"
          outlined
          @click="irParaAgenda()"
        />
      </span>
    </template>

    <div class="dia clinic-scope">
      <!--
        O boletim retido abre a tela, acima do próprio destaque.

        É a única pendência do dia com uma pessoa do outro lado — um responsável sem notícia do
        animal dele — e a única que não pode esperar alguém lembrar de abrir outra tela.
      -->
      <button
        v-if="boletinsRetidos > 0"
        type="button"
        class="retidos clinic-focusable"
        @click="irParaInternacao()"
      >
        <i class="pi pi-phone" aria-hidden="true" />
        <span>{{ t('clinico.internacao.retidosAviso', { total: boletinsRetidos }) }}</span>
        <i class="pi pi-arrow-right" aria-hidden="true" />
      </button>

      <!-- 1. o que é agora -->
      <section class="destaque">
        <header class="destaque__topo">
          <span class="clinic-label">
            {{ agora ? t('clinico.meuDia.agora') : t('clinico.meuDia.aSeguir') }}
          </span>
          <span v-if="agora || aSeguir" class="destaque__hora clinic-value">
            {{ formato.hora((agora ?? aSeguir)!.inicio) }}
          </span>
        </header>

        <template v-if="agora ?? aSeguir">
          <ClinicPatientHeader
            :pet="clinico.pet((agora ?? aSeguir)!.petId)"
            :tutor="clinico.tutor((agora ?? aSeguir)!.tutorId)"
          >
            <template #acoes>
              <Button
                :label="
                  agora ? t('clinico.meuDia.continuar') : t('clinico.meuDia.iniciarAtendimento')
                "
                icon="pi pi-file-edit"
                @click="abrirProntuario((agora ?? aSeguir)!)"
              />
            </template>
          </ClinicPatientHeader>

          <p class="destaque__meta">
            {{ clinico.tipo((agora ?? aSeguir)!.typeId)?.nome }}
            ·
            {{ clinico.profissional((agora ?? aSeguir)!.professionalId)?.nome }}
            <template v-if="!agora"> · {{ formato.relativo(aSeguir!.inicio) }} </template>
          </p>
        </template>

        <p v-else class="vazio">{{ t('clinico.meuDia.semProximo') }}</p>
      </section>

      <div class="colunas">
        <!-- 2. quem já chegou -->
        <section class="bloco" :class="{ 'bloco--vazio': esperando.length === 0 }">
          <h2 class="bloco__titulo">
            <i class="pi pi-users" aria-hidden="true" />
            {{ t('clinico.meuDia.esperando') }}
            <span v-if="esperando.length > 0" class="bloco__contagem clinic-value">
              {{ esperando.length }}
            </span>
          </h2>

          <ul v-if="esperando.length > 0" class="lista">
            <li v-for="item in esperandoVisiveis" :key="item.id">
              <button
                type="button"
                class="lista__item clinic-focusable"
                @click="irParaAgenda(item.id)"
              >
                <span class="lista__hora clinic-value">{{ formato.hora(item.inicio) }}</span>
                <span class="lista__corpo">
                  <strong>{{ clinico.pet(item.petId)?.nome }}</strong>
                  <small>
                    {{ clinico.profissional(item.professionalId)?.nome }}
                    <template v-if="item.chegadaEm">
                      ·
                      {{
                        t('clinico.meuDia.esperaDe', {
                          valor: formato.relativo(item.chegadaEm),
                        })
                      }}
                    </template>
                  </small>
                </span>
                <i class="pi pi-chevron-right" aria-hidden="true" />
              </button>
            </li>
          </ul>

          <p v-else class="vazio">
            <i class="pi pi-check" aria-hidden="true" />{{ t('clinico.meuDia.esperandoVazio') }}
          </p>
          <RouterLink
            v-if="esperando.length > LIMITE_DO_BLOCO"
            class="bloco__mais"
            to="/veterinario/agenda"
          >
            {{ t('clinico.comum.verTodos', { contagem: esperando.length }) }}
            <i class="pi pi-arrow-right" aria-hidden="true" />
          </RouterLink>
        </section>

        <!-- 3. quem está internado e cobra alguma coisa agora -->
        <section class="bloco" :class="{ 'bloco--vazio': internadosComPendencia.length === 0 }">
          <h2 class="bloco__titulo">
            <i class="pi pi-building" aria-hidden="true" />
            {{ t('clinico.meuDia.internados') }}
            <span v-if="internadosComPendencia.length > 0" class="bloco__contagem clinic-value">
              {{ internadosComPendencia.length }}
            </span>
          </h2>

          <ul v-if="internadosComPendencia.length > 0" class="lista">
            <li v-for="item in internadosVisiveis" :key="item.leito.id">
              <button
                type="button"
                class="lista__item clinic-focusable"
                @click="irParaInternacao(item.internacao!.id)"
              >
                <span class="lista__hora clinic-value">{{ item.leito.nome }}</span>
                <span class="lista__corpo">
                  <strong>{{ item.petNome }}</strong>
                  <small>
                    <!--
                      Boletim primeiro, dose depois: a ordem da linha é a ordem da urgência, e o
                      telefonema pendente é o que a clínica descobre tarde demais.
                    -->
                    <span v-if="item.boletimRetido" class="lista__atraso">
                      {{ t('clinico.internacao.leito.boletimRetido') }}
                    </span>
                    <template v-if="item.boletimRetido && item.atrasadas > 0"> · </template>
                    <template v-if="item.atrasadas > 0">
                      {{ t('clinico.internacao.leito.atrasadas', { total: item.atrasadas }) }}
                    </template>
                  </small>
                </span>
                <i class="pi pi-chevron-right" aria-hidden="true" />
              </button>
            </li>
          </ul>

          <p v-else class="vazio">
            <i class="pi pi-check" aria-hidden="true" />{{ t('clinico.meuDia.internadosVazio') }}
          </p>
          <RouterLink
            v-if="internadosComPendencia.length > LIMITE_DO_BLOCO"
            class="bloco__mais"
            to="/veterinario/internacao"
          >
            {{ t('clinico.comum.verTodos', { contagem: internadosComPendencia.length }) }}
            <i class="pi pi-arrow-right" aria-hidden="true" />
          </RouterLink>
        </section>

        <!-- 4. alertas que mudam conduta hoje -->
        <section class="bloco" :class="{ 'bloco--vazio': alertasDoDia.length === 0 }">
          <h2 class="bloco__titulo">
            <i class="pi pi-exclamation-triangle" aria-hidden="true" />
            {{ t('clinico.meuDia.alertasDoDia') }}
            <span v-if="alertasDoDia.length > 0" class="bloco__contagem clinic-value">
              {{ alertasDoDia.length }}
            </span>
          </h2>

          <ul v-if="alertasDoDia.length > 0" class="lista">
            <li v-for="item in alertasVisiveis" :key="item.pet.id">
              <button
                type="button"
                class="lista__item clinic-focusable"
                @click="irParaAgenda(item.appointment.id)"
              >
                <span class="lista__hora clinic-value">
                  {{ formato.hora(item.appointment.inicio) }}
                </span>
                <span class="lista__corpo">
                  <strong>{{ item.pet.nome }}</strong>
                  <span class="lista__chips">
                    <ClinicAlertChip
                      v-for="alerta in item.alertas"
                      :key="alerta.id"
                      :severidade="alerta.severidade"
                      :rotulo="formato.alerta(alerta.kind)"
                      :detalhe="alerta.detalhe"
                    />
                  </span>
                </span>
              </button>
            </li>
          </ul>

          <p v-else class="vazio">
            <i class="pi pi-check" aria-hidden="true" />{{ t('clinico.meuDia.alertasVazio') }}
          </p>
          <RouterLink
            v-if="alertasDoDia.length > LIMITE_DO_BLOCO"
            class="bloco__mais"
            to="/veterinario/agenda"
          >
            {{ t('clinico.comum.verTodos', { contagem: alertasDoDia.length }) }}
            <i class="pi pi-arrow-right" aria-hidden="true" />
          </RouterLink>
        </section>

        <!-- 5. retorno sem horário: receita parada na mesa -->
        <section class="bloco" :class="{ 'bloco--vazio': retornosPendentes.length === 0 }">
          <h2 class="bloco__titulo">
            <i class="pi pi-replay" aria-hidden="true" />
            {{ t('clinico.meuDia.retornosSemHorario') }}
            <span v-if="retornosPendentes.length > 0" class="bloco__contagem clinic-value">
              {{ retornosPendentes.length }}
            </span>
          </h2>

          <ul v-if="retornosPendentes.length > 0" class="lista">
            <li v-for="item in retornosVisiveis" :key="item.encounter.id">
              <div class="lista__item lista__item--estatico">
                <span class="lista__corpo">
                  <strong>{{ clinico.pet(item.encounter.petId)?.nome }}</strong>
                  <small>
                    {{
                      clinico.diagnosticoPrincipal(item.encounter) ||
                      item.encounter.anamnese.queixaPrincipal
                    }}
                    ·
                    <!-- Vencido há quanto tempo: é o atraso que faz a pendência doer. -->
                    <span class="lista__atraso clinic-value">
                      {{
                        t('clinico.formato.haTempo', {
                          valor: t(
                            'clinico.formato.dias',
                            { valor: item.diasDeAtraso },
                            item.diasDeAtraso,
                          ),
                        })
                      }}
                    </span>
                  </small>
                </span>
                <Button
                  :label="t('clinico.meuDia.marcarRetorno')"
                  size="small"
                  severity="secondary"
                  outlined
                  @click="irParaAgenda()"
                />
              </div>
            </li>
          </ul>

          <p v-else class="vazio">
            <i class="pi pi-check" aria-hidden="true" />{{ t('clinico.meuDia.retornosVazio') }}
          </p>
          <RouterLink
            v-if="retornosPendentes.length > LIMITE_DO_BLOCO"
            class="bloco__mais"
            to="/veterinario/atividades"
          >
            {{ t('clinico.comum.verTodos', { contagem: retornosPendentes.length }) }}
            <i class="pi pi-arrow-right" aria-hidden="true" />
          </RouterLink>
        </section>
      </div>
    </div>

    <ClinicDevPanel />
  </PartnerPageFrame>
</template>

<style scoped>
.dia {
  display: grid;
  gap: var(--clinic-space-4);
}

/*
 * A faixa do boletim retido é um botão, e não um aviso.
 *
 * No mapa de leitos ela é texto: quem está lá já chegou ao lugar onde se resolve. Aqui ela
 * aparece três telas antes, e um aviso que diz "ligue para alguém" sem levar a lugar nenhum
 * transfere para quem lê o trabalho de descobrir onde é esse lugar.
 */
.retidos {
  display: flex;
  width: 100%;
  align-items: center;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-risk-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  text-align: left;
}

.retidos span {
  flex: 1 1 auto;
}

.retidos:hover {
  background: color-mix(in srgb, var(--clinic-risk-line) 22%, var(--clinic-risk-bg));
}

.retidos i:last-child {
  font-size: 0.72rem;
}

/*
 * O destaque é o cartão que responde "o que é agora". Ele ganha o gradiente e a hora grande
 * porque é a única coisa da tela que se olha de longe; tudo abaixo é consulta.
 */
.destaque {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-5);
  border: 1px solid var(--clinic-accent);
  border-radius: var(--clinic-radius-card);
  background:
    radial-gradient(
      120% 140% at 100% 0%,
      color-mix(in srgb, var(--clinic-accent) 22%, transparent) 0%,
      transparent 55%
    ),
    var(--clinic-surface);
}

.destaque__topo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.destaque__hora {
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.045em;
}

.destaque__meta {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-base);
}

/*
 * Três colunas de altura livre. Bloco vazio encolhe até a altura do próprio título em vez de
 * reservar uma coluna inteira de nada — que era o que fazia a tela parecer meio construída.
 */
.colunas {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
  align-items: start;
  gap: var(--clinic-space-3);
}

.bloco {
  display: grid;
  align-content: start;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.bloco--vazio {
  border-style: dashed;
  background: transparent;
}

.bloco__titulo {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.bloco__titulo i {
  color: var(--clinic-faint);
  font-size: 0.75rem;
}

.bloco__contagem {
  margin-left: auto;
  min-width: 1.3rem;
  padding: 0 0.35rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-weight: 800;
  letter-spacing: 0;
  text-align: center;
}

.lista {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista__item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: var(--clinic-space-3);
  min-height: var(--clinic-row-height);
  padding: var(--clinic-cell-padding-y) var(--clinic-space-2);
  border: none;
  border-radius: var(--clinic-radius-control);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.lista__item:hover {
  background: var(--clinic-surface-soft);
}

.lista__item--estatico {
  cursor: default;
}

.lista__item--estatico:hover {
  background: transparent;
}

.lista__hora {
  flex: 0 0 auto;
  color: var(--clinic-accent-strong);
  font-weight: 800;
}

.lista__corpo {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.1rem;
  justify-items: start;
}

.lista__corpo strong {
  overflow: hidden;
  max-width: 100%;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lista__corpo small {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.lista__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.lista__atraso {
  color: var(--clinic-attention-text);
  font-weight: 700;
}

.lista__item i {
  color: var(--clinic-faint);
  font-size: 0.7rem;
}

.bloco__mais {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.2rem;
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  text-decoration: none;
}

.bloco__mais:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.bloco__mais i {
  font-size: 0.62rem;
}

.vazio {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--clinic-faint);
  line-height: 1.5;
}

.vazio i {
  color: var(--clinic-ok-text);
  font-size: 0.7rem;
}
</style>
