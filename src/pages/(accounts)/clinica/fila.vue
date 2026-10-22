<script setup lang="ts">
/**
 * Fila de espera.
 *
 * Existe para responder à pergunta que a agenda cheia não responde: "e quando abrir?". Cada
 * entrada guarda a janela que o responsável aceita, e é essa janela que decide quem cabe numa
 * vaga que acabou de vagar.
 *
 * A oferta tem prazo. Passado o prazo ela expira sozinha e a vaga volta a ser da clínica —
 * senão a fila vira lista de promessas que ninguém cobra.
 *
 * A tela segue a ordem do trabalho, em seções separadas:
 *
 * 1. **A vaga que acabou de abrir** — aviso verde no alto, com quem cabe nela. É a única coisa da
 *    tela que pede ação agora mesmo.
 * 2. **Ofertas esperando resposta** — o prazo correndo em contagem regressiva, com o aceite e a
 *    recusa por extenso na própria linha.
 * 3. **Esperando vaga** — a fila pela posição: quem, quem é o responsável (com o telefone, que é
 *    o que se usa daqui), quando pode, há quanto tempo espera e a prioridade.
 * 4. **Já resolvidas** — aceitas e vencidas, recolhidas no fim: histórico, não trabalho.
 *
 * `?adicionar=1` é o pedido do "Criar → Espera por vaga" da barra lateral: abre o formulário e
 * sai da URL, como o `?novo=1` da agenda.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import FilaAdicionarDialog from '@/features/clinico/components/agenda/FilaAdicionarDialog.vue'
import FilaOfertaDialog from '@/features/clinico/components/agenda/FilaOfertaDialog.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { WaitlistEntry } from '@/features/clinico/data/types'
import { agruparJanelas } from '@/features/clinico/domain/waitlist'
import { useAvisosStore } from '@/features/clinico/stores/avisos'
import { useFilaStore } from '@/features/clinico/stores/fila'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const fila = useFilaStore()
const avisos = useAvisosStore()
const formato = useClinicFormat()

/**
 * O que o aceite fez, dito em uma linha. Marcado leva à agenda, que é onde a recepção confere o
 * horário; oferta vencida e vaga ocupada dizem o que aconteceu com o responsável, que é a
 * pergunta seguinte de quem está no telefone.
 */
const aceite = computed(() => {
  const resultado = fila.resultadoDoAceite

  if (!resultado) {
    return null
  }

  const paciente = clinico.pet(resultado.petId)?.nome ?? ''

  if (resultado.tipo === 'marcado') {
    const { atendimento } = resultado

    return {
      tipo: resultado.tipo,
      texto: t('clinico.fila.aceite.marcado', {
        paciente,
        data: formato.dataCurta(clinicClock.dateOf(atendimento.inicio)),
        hora: formato.hora(atendimento.inicio),
        profissional: clinico.profissional(atendimento.professionalId)?.nome ?? '',
      }),
      rota: `/clinica/agenda?data=${clinicClock.dateOf(atendimento.inicio)}&foco=${atendimento.id}`,
    }
  }

  return {
    tipo: resultado.tipo,
    texto:
      resultado.tipo === 'oferta-expirada'
        ? t('clinico.fila.aceite.ofertaExpirada', { paciente })
        : t('clinico.fila.aceite.vagaPreenchida', { paciente }),
    rota: null,
  }
})

const paraOfertar = ref<WaitlistEntry | null>(null)
const adicionarAberto = ref(false)

/*
 * `?adicionar=1` é o pedido do "Criar → Espera por vaga" da barra lateral: abre o formulário e
 * tira o pedido da URL, para que voltar no navegador não o abra de novo. Vale também quando a
 * fila já está aberta — a barra só troca a query.
 */
watch(
  () => route.query.adicionar,
  (adicionar) => {
    if (adicionar !== '1') {
      return
    }

    adicionarAberto.value = true

    const query = { ...route.query }

    delete query.adicionar
    void router.replace({ path: route.path, query })
  },
  { immediate: true },
)

/*
 * As três ações da fila. Aceitar e recusar só existem para quem recebeu oferta; remover, só para
 * quem ainda aguarda — cada seção mostra só as dela, em vez de botões apagados.
 */
function registrarResposta(entrada: WaitlistEntry, aceitou: boolean) {
  void fila.responder(entrada.id, aceitou)
}

function remover(entrada: WaitlistEntry) {
  void fila.remover(entrada.id)
}

/** A prioridade que precisa ser dita: "normal" é o padrão e não ganha selo. */
const TOM_DA_PRIORIDADE = {
  urgente: 'risco',
  preferencial: 'atencao',
  normal: '',
} as const

/**
 * Dia da semana pelo `Intl` do idioma da tela: abreviação fixa em português vazava para todo
 * idioma. Dias seguidos com o mesmo horário saem numa faixa só ("seg.–sex. 14:00–18:00").
 */
function janelasLegiveis(entrada: WaitlistEntry) {
  return agruparJanelas(entrada.janelas).map((faixa) => {
    const de = formato.diaDaSemanaCurtoPorIndice(faixa.de)
    const dias =
      faixa.de === faixa.ate ? de : `${de}–${formato.diaDaSemanaCurtoPorIndice(faixa.ate)}`

    return { dias, horas: `${faixa.inicio}–${faixa.fim}` }
  })
}

function minutosDesde(iso: string) {
  return Math.max(0, Math.round((Date.parse(clinicClock.nowIso()) - Date.parse(iso)) / 60_000))
}

/** "qual tipo · com quem": o que a entrada espera, na linha de baixo do nome. */
function oQueEspera(entrada: WaitlistEntry, professionalId: string | null = entrada.professionalId) {
  return [
    clinico.tipo(entrada.typeId)?.nome,
    professionalId ? clinico.profissional(professionalId)?.nome : t('clinico.fila.qualquerProfissional'),
  ]
    .filter(Boolean)
    .join(' · ')
}

// ------------------------------------------------------------------ as seções

/** Entre as ofertas, a que expira primeiro vem antes: é a que se perde se ninguém ligar. */
const ofertas = computed(() =>
  fila.ativas
    .filter((entrada) => entrada.status === 'ofertado')
    .sort((a, b) => (a.ofertaExpiraEm ?? '').localeCompare(b.ofertaExpiraEm ?? '')),
)

const esperando = computed(() =>
  fila.ativas
    .filter((entrada) => entrada.status === 'aguardando')
    .sort((a, b) => (fila.posicaoDe(a.id) ?? 0) - (fila.posicaoDe(b.id) ?? 0)),
)

const resolvidas = computed(() =>
  fila.ativas
    .filter((entrada) => entrada.status !== 'ofertado' && entrada.status !== 'aguardando')
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
)

const resolvidasAbertas = ref(false)

/** O prazo da oferta em tom: cinco minutos é risco, meia hora é atenção. */
function tomDaOferta(entrada: WaitlistEntry) {
  const minutos = fila.minutosParaExpirar(entrada) ?? 0

  if (minutos <= 5) {
    return 'risco'
  }

  return minutos <= 30 ? 'atencao' : 'neutro'
}

function contagemDaOferta(entrada: WaitlistEntry) {
  return formato.distancia(Math.max(0, fila.minutosParaExpirar(entrada) ?? 0))
}

async function confirmarOferta({ mensagem }: { mensagem: string }) {
  const entrada = paraOfertar.value
  const vaga = fila.vagaAberta

  if (!entrada || !vaga) {
    return
  }

  await fila.ofertar(entrada.id, vaga.inicio, vaga.professionalId)

  /* O texto ofertado vira comprovante, como o da remarcação e o do reagendamento. */
  avisos.registrar({
    appointmentId: entrada.id,
    tutorId: entrada.tutorId,
    kind: 'oferta-de-vaga',
    texto: mensagem,
  })

  paraOfertar.value = null
}

const erroTraduzido = computed(() => (fila.erro ? t(fila.erro) : ''))

/** Quantos esperam vaga e quantas ofertas esperam resposta. */
const fraseDoResumo = computed(() => {
  if (fila.carregando && fila.entradas.length === 0) {
    return ''
  }

  const aguardando = t(
    'clinico.fila.saudacao.aguardando',
    { n: esperando.value.length },
    esperando.value.length,
  )

  if (ofertas.value.length === 0) {
    return aguardando
  }

  return t('clinico.fila.tela.resumo', {
    aguardando,
    ofertas: t('clinico.fila.saudacao.ofertas', { n: ofertas.value.length }, ofertas.value.length),
  })
})

async function carregar() {
  await clinico.carregar()
  await fila.carregar()
}

onMounted(carregar)
</script>

<template>
  <UiPagina
    :carregando="fila.carregando && fila.entradas.length === 0"
    :erro="erroTraduzido"
    :vazio="fila.vazio"
    :vazio-titulo="t('clinico.fila.vazioTitulo')"
    :vazio-descricao="t('clinico.fila.vazioDescricao')"
    :vazio-acao="t('clinico.fila.adicionar')"
    vazio-icone="ph ph-hourglass-medium"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
    @acao-do-vazio="adicionarAberto = true"
  >
    <template v-if="fraseDoResumo" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <!-- A entrada na fila é a ação que a recepção dispara quando acaba de dizer "não tenho horário". -->
    <template #acoes>
      <Button
        type="button"
        icon="ph ph-plus"
        :label="t('clinico.fila.adicionar')"
        @click="adicionarAberto = true"
      />
    </template>

    <div class="fila clinic-scope">
      <!--
        A vaga que acabou de abrir: no alto, porque é a única coisa da tela que vence em minutos.
        Nasce na agenda (cancelamento, falta) e aparece aqui também.
      -->
      <section
        v-if="fila.vagaAberta"
        class="vaga ui-folha"
        role="status"
        aria-labelledby="vaga-titulo"
      >
        <div class="vaga__cabeca">
          <span class="ui-ladrilho ui-ladrilho--ok" aria-hidden="true">
            <i class="ph ph-calendar-plus" />
          </span>
          <div class="vaga__texto">
            <strong id="vaga-titulo">{{ t('clinico.fila.vagaAberta.titulo') }}</strong>
            <p>
              {{
                t('clinico.fila.vagaAberta.descricao', {
                  hora: formato.hora(fila.vagaAberta.inicio),
                  profissional: clinico.profissional(fila.vagaAberta.professionalId)?.nome ?? '',
                })
              }}
            </p>
          </div>
          <span class="vaga__quando">
            <small>{{ formato.diaDaSemanaCurto(clinicClock.dateOf(fila.vagaAberta.inicio)) }},
              {{ formato.dataCurta(clinicClock.dateOf(fila.vagaAberta.inicio)) }}</small>
            <strong class="ui-hora">{{ formato.hora(fila.vagaAberta.inicio) }}</strong>
          </span>
        </div>

        <ul class="vaga__candidatos">
          <li v-for="candidato in fila.vagaAberta.candidatos" :key="candidato.id" class="vaga__candidato">
            <PetAvatar
              :nome="clinico.pet(candidato.petId)?.nome ?? ''"
              :iniciais="clinico.pet(candidato.petId)?.iniciais ?? ''"
              :especie="clinico.pet(candidato.petId)?.especie ?? null"
              :foto-url="clinico.pet(candidato.petId)?.fotoUrl ?? ''"
              tamanho="sm"
            />
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ clinico.pet(candidato.petId)?.nome }}</strong>
              <span class="ui-linha__meta">
                <template v-if="fila.posicaoDe(candidato.id)">
                  {{ t('clinico.fila.posicaoNaFila', { posicao: fila.posicaoDe(candidato.id) }) }} ·
                </template>
                {{ clinico.tipo(candidato.typeId)?.nome }}
              </span>
            </span>
            <Button
              type="button"
              size="small"
              icon="ph ph-paper-plane-tilt"
              :label="t('clinico.fila.ofertarVaga')"
              :aria-label="
                t('clinico.fila.vagaAberta.oferecer', {
                  paciente: clinico.pet(candidato.petId)?.nome ?? '',
                })
              "
              :loading="fila.salvando"
              @click="paraOfertar = candidato"
            />
          </li>
        </ul>

        <Button
          type="button"
          class="vaga__depois"
          :label="t('clinico.fila.vagaAberta.depois')"
          severity="secondary"
          text
          size="small"
          @click="fila.dispensarVaga()"
        />
      </section>

      <p
        v-if="aceite"
        class="aviso ui-folha"
        :class="aceite.tipo === 'marcado' ? 'aviso--ok' : 'aviso--neutro'"
        role="status"
      >
        <span
          class="ui-ladrilho"
          :class="aceite.tipo === 'marcado' ? 'ui-ladrilho--ok' : 'ui-ladrilho--neutro'"
          aria-hidden="true"
        >
          <i class="ph" :class="aceite.tipo === 'marcado' ? 'ph-check-circle' : 'ph-info'" />
        </span>
        <span class="aviso__texto">{{ aceite.texto }}</span>
        <RouterLink v-if="aceite.rota" class="ui-mais" :to="aceite.rota">
          {{ t('clinico.fila.aceite.verNaAgenda') }}
          <i class="ph ph-arrow-right" aria-hidden="true" />
        </RouterLink>
        <Button
          type="button"
          icon="ph ph-x"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('clinico.fila.aceite.dispensar')"
          @click="fila.dispensarResultadoDoAceite()"
        />
      </p>

      <!-- ============================================================ ofertas -->
      <!--
        Cada seção é um cartão com cabeçalho próprio, como os postos do Hoje: as ofertas vencem em
        minutos e levam o tom da atenção no alto; a fila espera, e fica no papel.
      -->
      <section
        v-if="ofertas.length > 0"
        class="bloco bloco--ofertas ui-folha"
        aria-labelledby="fila-ofertas-titulo"
      >
        <header class="bloco__cabeca">
          <span class="ui-ladrilho ui-ladrilho--atencao" aria-hidden="true">
            <i class="ph ph-paper-plane-tilt" />
          </span>
          <span class="bloco__titulos">
            <h2 id="fila-ofertas-titulo">{{ t('clinico.fila.tela.ofertas') }}</h2>
            <span class="bloco__descricao">{{ t('clinico.fila.tela.ofertasDescricao') }}</span>
          </span>
          <span class="bloco__total ui-num">{{ ofertas.length }}</span>
        </header>

        <ul class="ui-lista lista">
          <li
            v-for="entrada in ofertas"
            :key="entrada.id"
            class="oferta"
            :class="tomDaOferta(entrada) !== 'neutro' ? `ui-marca ui-marca--${tomDaOferta(entrada)}` : ''"
          >
            <span class="quando">
              <template v-if="entrada.ofertaSlotInicio">
                <small>
                  {{ formato.diaDaSemanaCurto(clinicClock.dateOf(entrada.ofertaSlotInicio)) }},
                  {{ formato.dataCurta(clinicClock.dateOf(entrada.ofertaSlotInicio)) }}
                </small>
                <strong class="ui-hora">{{ formato.hora(entrada.ofertaSlotInicio) }}</strong>
                <span class="sr-only">{{ t('clinico.fila.tela.vagaPara') }}</span>
              </template>
            </span>

            <span class="quem">
              <PetAvatar
                :nome="clinico.pet(entrada.petId)?.nome ?? ''"
                :iniciais="clinico.pet(entrada.petId)?.iniciais ?? ''"
                :especie="clinico.pet(entrada.petId)?.especie ?? null"
                :foto-url="clinico.pet(entrada.petId)?.fotoUrl ?? ''"
                tamanho="md"
              />
              <span class="ui-linha__texto">
                <span class="quem__nome">
                  <strong class="ui-linha__titulo">{{ clinico.pet(entrada.petId)?.nome }}</strong>
                  <span
                    v-if="TOM_DA_PRIORIDADE[entrada.prioridade]"
                    class="ui-selo"
                    :class="`ui-selo--${TOM_DA_PRIORIDADE[entrada.prioridade]}`"
                  >
                    <i class="ph ph-warning" aria-hidden="true" />
                    {{ formato.prioridadeDaFila(entrada.prioridade) }}
                  </span>
                </span>
                <span class="ui-linha__meta">
                  {{ oQueEspera(entrada, entrada.ofertaProfessionalId ?? entrada.professionalId) }}
                </span>
              </span>
            </span>

            <span class="tutor">
              <span class="tutor__nome">{{ clinico.tutor(entrada.tutorId)?.nome }}</span>
              <span class="tutor__telefone ui-num">
                <i class="ph ph-phone" aria-hidden="true" />
                <bdi dir="ltr">{{ clinico.tutor(entrada.tutorId)?.telefone }}</bdi>
              </span>
            </span>

            <p class="prazo" :class="`prazo--${tomDaOferta(entrada)}`">
              <strong class="ui-num">
                <i
                  class="ph"
                  :class="tomDaOferta(entrada) === 'neutro' ? 'ph-clock' : 'ph-clock-countdown'"
                  aria-hidden="true"
                />
                {{ contagemDaOferta(entrada) }}
              </strong>
              <small v-if="entrada.ofertaExpiraEm">
                {{
                  t('clinico.fila.tela.paraResponder', { hora: formato.hora(entrada.ofertaExpiraEm) })
                }}
              </small>
            </p>

            <span class="acoes">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :label="t('clinico.fila.recusar')"
                :disabled="fila.salvando"
                @click="registrarResposta(entrada, false)"
              />
              <Button
                type="button"
                size="small"
                icon="ph ph-check"
                :label="t('clinico.fila.aceitar')"
                :disabled="fila.salvando"
                @click="registrarResposta(entrada, true)"
              />
            </span>
          </li>
        </ul>
      </section>

      <!-- ============================================================ esperando -->
      <section class="bloco ui-folha" aria-labelledby="fila-esperando-titulo">
        <header class="bloco__cabeca">
          <span class="ui-ladrilho" aria-hidden="true">
            <i class="ph ph-hourglass-medium" />
          </span>
          <span class="bloco__titulos">
            <h2 id="fila-esperando-titulo">{{ t('clinico.fila.tela.esperando') }}</h2>
            <span v-if="esperando.length > 1" class="bloco__descricao">
              {{ t('clinico.fila.tela.esperandoDescricao') }}
            </span>
          </span>
          <span class="bloco__total ui-num">{{ esperando.length }}</span>
        </header>

        <ul v-if="esperando.length > 0" class="ui-lista lista">
          <li
            v-for="entrada in esperando"
            :key="entrada.id"
            class="espera"
            :class="
              TOM_DA_PRIORIDADE[entrada.prioridade]
                ? `ui-marca ui-marca--${TOM_DA_PRIORIDADE[entrada.prioridade]}`
                : ''
            "
          >
            <span
              class="posicao ui-num"
              :class="{ 'posicao--primeira': fila.posicaoDe(entrada.id) === 1 }"
              :title="t('clinico.fila.posicaoNaFila', { posicao: fila.posicaoDe(entrada.id) ?? '' })"
            >
              <span aria-hidden="true">{{ fila.posicaoDe(entrada.id) }}</span>
              <span class="sr-only">
                {{ t('clinico.fila.posicaoNaFila', { posicao: fila.posicaoDe(entrada.id) ?? '' }) }}
              </span>
            </span>

            <span class="quem">
              <PetAvatar
                :nome="clinico.pet(entrada.petId)?.nome ?? ''"
                :iniciais="clinico.pet(entrada.petId)?.iniciais ?? ''"
                :especie="clinico.pet(entrada.petId)?.especie ?? null"
                :foto-url="clinico.pet(entrada.petId)?.fotoUrl ?? ''"
                tamanho="md"
              />
              <span class="ui-linha__texto">
                <span class="quem__nome">
                  <strong class="ui-linha__titulo">{{ clinico.pet(entrada.petId)?.nome }}</strong>
                  <span
                    v-if="TOM_DA_PRIORIDADE[entrada.prioridade]"
                    class="ui-selo"
                    :class="`ui-selo--${TOM_DA_PRIORIDADE[entrada.prioridade]}`"
                  >
                    <i class="ph ph-warning" aria-hidden="true" />
                    {{ formato.prioridadeDaFila(entrada.prioridade) }}
                  </span>
                </span>
                <span class="ui-linha__meta">{{ oQueEspera(entrada) }}</span>
              </span>
            </span>

            <span class="tutor">
              <span class="tutor__nome">{{ clinico.tutor(entrada.tutorId)?.nome }}</span>
              <span class="tutor__telefone ui-num">
                <i class="ph ph-phone" aria-hidden="true" />
                <bdi dir="ltr">{{ clinico.tutor(entrada.tutorId)?.telefone }}</bdi>
              </span>
            </span>

            <!-- Quebra só entre janelas: "qua." numa linha e "14:00–18:00" na outra não se lê. -->
            <span class="janelas" :aria-label="t('clinico.fila.janelas')">
              <span v-for="(faixa, indice) in janelasLegiveis(entrada)" :key="indice" class="janela">
                <span class="janela__dias">{{ faixa.dias }}</span>
                <span class="janela__horas ui-num">{{ faixa.horas }}</span>
              </span>
            </span>

            <span class="tempo">
              <strong class="ui-num">{{ formato.distancia(minutosDesde(entrada.criadoEm)) }}</strong>
              <small>{{ t('clinico.fila.tela.naFila') }}</small>
            </span>

            <span class="acoes">
              <Button
                type="button"
                size="small"
                icon="ph ph-trash"
                severity="danger"
                text
                :label="t('clinico.comum.remover')"
                :title="t('clinico.fila.remover')"
                :disabled="fila.salvando"
                @click="remover(entrada)"
              />
            </span>

            <p v-if="entrada.observacao" class="nota">
              <i class="ph ph-chat-text" aria-hidden="true" />
              {{ entrada.observacao }}
            </p>
          </li>
        </ul>
        <p v-else class="ui-vazio">{{ t('clinico.fila.saudacao.aguardando', { n: 0 }, 0) }}</p>
      </section>

      <!-- ============================================================ resolvidas -->
      <section v-if="resolvidas.length > 0" class="historico ui-folha">
        <button
          type="button"
          class="historico__alternar"
          :aria-expanded="resolvidasAbertas"
          aria-controls="fila-resolvidas"
          @click="resolvidasAbertas = !resolvidasAbertas"
        >
          <span class="ui-ladrilho ui-ladrilho--neutro ui-ladrilho--p" aria-hidden="true">
            <i class="ph ph-clock-counter-clockwise" />
          </span>
          <span class="historico__titulo">{{ t('clinico.fila.tela.resolvidas') }}</span>
          <span class="ui-contagem">{{ resolvidas.length }}</span>
          <i
            class="ph historico__seta"
            :class="resolvidasAbertas ? 'ph-caret-up' : 'ph-caret-down'"
            aria-hidden="true"
          />
        </button>

        <ul v-if="resolvidasAbertas" id="fila-resolvidas" class="ui-lista historico__lista">
          <li v-for="entrada in resolvidas" :key="entrada.id" class="resolvida">
            <span class="quem">
              <PetAvatar
                :nome="clinico.pet(entrada.petId)?.nome ?? ''"
                :iniciais="clinico.pet(entrada.petId)?.iniciais ?? ''"
                :especie="clinico.pet(entrada.petId)?.especie ?? null"
                :foto-url="clinico.pet(entrada.petId)?.fotoUrl ?? ''"
                tamanho="sm"
              />
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo">{{ clinico.pet(entrada.petId)?.nome }}</strong>
                <span class="ui-linha__meta">
                  {{ oQueEspera(entrada) }} · {{ clinico.tutor(entrada.tutorId)?.nome }}
                </span>
              </span>
            </span>
            <span class="resolvida__como">
              <span
                class="ui-selo"
                :class="entrada.status === 'aceito' ? 'ui-selo--ok' : ''"
              >
                <i
                  class="ph"
                  :class="entrada.status === 'aceito' ? 'ph-check-circle' : 'ph-clock-countdown'"
                  aria-hidden="true"
                />
                {{ t(`clinico.fila.situacao.${entrada.status}`) }}
              </span>
              <!-- Aceito é horário marcado: a linha diz qual, para ninguém precisar abrir a agenda. -->
              <span
                v-if="entrada.status === 'aceito' && entrada.ofertaSlotInicio"
                class="resolvida__marcado ui-num"
              >
                {{
                  t('clinico.fila.marcadoPara', {
                    data: formato.dataCurta(clinicClock.dateOf(entrada.ofertaSlotInicio)),
                    hora: formato.hora(entrada.ofertaSlotInicio),
                  })
                }}
              </span>
            </span>
          </li>
        </ul>
      </section>
    </div>

    <template #sempre>
      <FilaAdicionarDialog v-model:visivel="adicionarAberto" @adicionado="fila.carregar()" />

      <!--
        A oferta passa por uma prévia, no mesmo padrão da remarcação: o requisito pede "a
        mensagem que sai", e disparar sem mostrar o texto é o que faz ninguém saber o que foi dito.
      -->
      <FilaOfertaDialog
        :entrada="paraOfertar"
        :slot-inicio="fila.vagaAberta?.inicio ?? null"
        @confirmar="confirmarOferta"
        @fechar="paraOfertar = null"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.fila {
  display: grid;
  gap: 28px;
}

/* ------------------------------------------------------------------ a vaga que abriu */

/*
 * A vaga que abriu é um cartão de estado: o alto desce do verde do "ok" para o papel, como a
 * Recepção do Hoje, e os candidatos ficam em poços rentes dentro dele.
 */
.vaga {
  display: grid;
  gap: 14px;
  padding: 18px 24px 16px;
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--ok-fundo) 70%, var(--superficie)),
    var(--superficie) 140px
  );
}

.vaga__cabeca {
  display: flex;
  align-items: center;
  gap: 14px;
}

.vaga__texto {
  flex: 1;
  min-width: 0;
}

.vaga__texto strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.vaga__texto p {
  margin: 2px 0 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.vaga__quando {
  display: grid;
  flex: none;
  justify-items: end;
  line-height: 1.1;
}

.vaga__quando small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.vaga__quando strong {
  color: var(--ok-tinta);
  font-size: 28px;
  letter-spacing: -0.025em;
}

.vaga__candidatos {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
}

.vaga__candidato {
  display: flex;
  min-height: 60px;
  align-items: center;
  gap: 12px;
  padding: 8px 10px 8px 12px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
}

.vaga__depois.p-button {
  justify-self: start;
}

/* ------------------------------------------------------------------ avisos */

/* O aviso do aceite: cartão baixo em papel, com o ladrilho no tom do que aconteceu. */
.aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  margin: 0;
  padding: 12px 14px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.aviso__texto {
  flex: 1 1 18rem;
  min-width: 0;
}

/* ------------------------------------------------------------------ os cartões */

.bloco {
  overflow: hidden;
}

/* O alto do cartão: ladrilho, nome e a ordem de leitura; à direita, quantos são. */
.bloco__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 22px 16px 20px;
  border-bottom: 1px solid var(--linha-suave);
}

.bloco--ofertas .bloco__cabeca {
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--atencao-fundo) 60%, var(--superficie)),
    var(--superficie)
  );
}

.bloco__titulos {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.bloco__titulos h2 {
  margin: 0;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.bloco__descricao {
  color: var(--tinta-2);
  font-size: 13px;
}

.bloco__total {
  color: var(--tinta);
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

/* ------------------------------------------------------------------ as listas */

.lista {
  overflow: hidden;
  container-type: inline-size;
}

.lista > li {
  position: relative;
  display: grid;
  min-height: 84px;
  align-items: center;
  gap: 8px 22px;
  padding: 14px 24px 14px 18px;
}

.oferta {
  grid-template-columns: 6.5rem minmax(0, 1.3fr) minmax(0, 1fr) 11rem auto;
}

.espera {
  grid-template-columns: 2.5rem minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) 5.5rem auto;
}

/*
 * Para quando é a vaga oferecida: num ladrilho de calendário rente, a data pequena e a hora
 * grande — o mesmo desenho dos pedidos.
 */
.quando {
  display: grid;
  justify-items: center;
  gap: 1px;
  padding: 9px 8px 10px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
  line-height: 1.15;
  text-align: center;
}

.quando:empty {
  padding: 0;
  border: 0;
  background: none;
}

.quando small {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
}

.quando .ui-hora {
  font-size: 22px;
  letter-spacing: -0.02em;
}

.quem {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.quem__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.quem__nome .ui-linha__titulo {
  font-size: 15px;
}

.quem__nome .ui-selo {
  height: 22px;
  font-size: 12px;
}

.tutor {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.tutor__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tutor__telefone {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--tinta-2);
  font-size: 13px;
  white-space: nowrap;
}

.tutor__telefone i {
  color: var(--tinta-3);
}

/* O prazo da oferta, contando: o número grande com o tom, a hora-limite embaixo. */
.prazo {
  display: grid;
  gap: 2px;
  margin: 0;
  line-height: 1.15;
}

.prazo strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 19px;
  font-weight: 650;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.prazo strong i {
  color: var(--tinta-3);
  font-size: 17px;
}

.prazo small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.prazo--risco strong,
.prazo--risco strong i {
  color: var(--risco-tinta);
}

.prazo--atencao strong,
.prazo--atencao strong i {
  color: var(--atencao-tinta);
}

.acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

/* Botão de linha no tamanho pequeno, mas com o alvo de toque de 36 px. */
.acoes :deep(.p-button),
.vaga__candidato :deep(.p-button) {
  min-height: 36px;
  white-space: nowrap;
}

/* A posição: o número que responde "sou o quantos?". O primeiro, na cor da clínica. */
.posicao {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid var(--linha-suave);
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.posicao--primeira {
  border-color: color-mix(in oklab, var(--clinica) 25%, transparent);
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
}

.janelas {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.janela {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13.5px;
  white-space: nowrap;
}

.janela__dias {
  min-width: 3.5em;
  color: var(--tinta);
  font-weight: 550;
}

.janela__horas {
  color: var(--tinta-2);
}

/* Há quanto tempo espera: número com a legenda embaixo, como o "min esperando" do Hoje. */
.tempo {
  display: grid;
  justify-items: end;
  line-height: 1.1;
}

.tempo strong {
  color: var(--tinta);
  font-size: 17px;
  font-weight: 650;
  white-space: nowrap;
}

.tempo small {
  color: var(--tinta-3);
  font-size: 12px;
}

.nota {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: -2px 0 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
  grid-column: 2 / -1;
}

.nota i {
  flex: none;
  color: var(--tinta-3);
  transform: translateY(2px);
}

/* ------------------------------------------------------------------ resolvidas */

/* As resolvidas: um cartão que abre — o alto é o botão, a lista desce embaixo dele. */
.historico {
  display: grid;
  overflow: hidden;
}

.historico__alternar {
  display: flex;
  width: 100%;
  min-height: 60px;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
  border: 0;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 650;
  text-align: start;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.historico__alternar:hover {
  background: var(--superficie-2);
}

.historico__alternar:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -2px;
}

.historico__titulo {
  letter-spacing: -0.01em;
}

.historico__seta {
  margin-inline-start: auto;
  color: var(--tinta-3);
  font-size: 16px;
}

.historico__lista {
  border-top: 1px solid var(--linha-suave);
}

.resolvida {
  display: flex;
  min-height: 60px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 10px 18px;
}

.resolvida__como {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.resolvida__marcado {
  color: var(--ok-tinta);
  font-size: 13px;
  font-weight: 600;
}

/* ------------------------------------------------------------------ larguras */

/* Pela largura da lista: a linha desce em duas, o "quando"/posição à esquerda ocupando a altura. */
@container (max-width: 64rem) {
  .oferta {
    grid-template-columns: 5.75rem minmax(0, 1fr) auto;
    align-items: start;
  }

  .oferta .quando {
    grid-row: span 2;
    align-self: center;
  }

  .oferta .tutor {
    grid-column: 2;
  }

  .oferta .prazo {
    grid-column: 3;
    grid-row: 1;
    justify-items: end;
    text-align: end;
  }

  .oferta .acoes {
    grid-column: 3;
    grid-row: 2;
  }

  .espera {
    grid-template-columns: 2.5rem minmax(0, 1fr) minmax(0, 1fr) auto;
    align-items: start;
  }

  .espera .posicao {
    grid-row: span 2;
    align-self: center;
  }

  .espera .tutor {
    grid-column: 2;
  }

  .espera .janelas {
    grid-column: 3;
    grid-row: 1 / span 2;
  }

  .espera .tempo {
    grid-column: 4;
    grid-row: 1;
  }

  .espera .acoes {
    grid-column: 4;
    grid-row: 2;
  }
}

@container (max-width: 36rem) {
  .lista > li {
    padding-inline: 14px;
  }

  .oferta {
    grid-template-columns: 4.75rem minmax(0, 1fr);
  }

  .oferta .quando {
    grid-row: span 4;
    align-self: start;
  }

  .oferta .prazo,
  .oferta .acoes {
    grid-column: 2;
    grid-row: auto;
    justify-items: start;
    justify-content: flex-start;
    text-align: start;
  }

  .espera {
    grid-template-columns: 2.25rem minmax(0, 1fr) auto;
  }

  .espera .posicao {
    grid-row: span 3;
    align-self: start;
  }

  .espera .tutor,
  .espera .janelas {
    grid-column: 2 / -1;
    grid-row: auto;
  }

  .espera .tempo {
    grid-column: 3;
    grid-row: 1;
  }

  .espera .acoes {
    grid-column: 2 / -1;
    grid-row: auto;
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .vaga__cabeca {
    flex-wrap: wrap;
  }

  .vaga__quando {
    justify-items: start;
  }
}
</style>
