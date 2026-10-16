<script setup lang="ts">
/**
 * O pedido enviado — o comprovante e o que acontece agora.
 *
 * "Pedido enviado" sozinho deixa a pessoa sem saber se está marcado. Por isso a frase de cima já
 * diz até quando a clínica responde e por onde a resposta chega; o bilhete repete o pedido inteiro
 * (o dia, o quê, para quem, com quem, onde) com a situação dele; e a linha do tempo diz o que
 * falta. Quando a clínica aceita sozinha (aceite automático), a tela já diz "confirmado".
 *
 * No link, o canhoto do bilhete guarda o endereço para acompanhar: quem não tem o app não tem
 * outro lugar onde olhar.
 *
 * A mesma etapa mora no celular da demonstração (22 rem) e na página pública: a consulta de
 * contêiner deita a linha do tempo quando há largura, e o título cresce junto.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../../composables/useClinicFormat'
import { useRotulosDoPedido } from '../../../composables/useRotulosDoPedido'
import { clinicClock } from '../../../stores/clinico'
import ConfeteDePatas from '../ConfeteDePatas.vue'
import FolhaDoDia from '../FolhaDoDia.vue'

import { useFluxo } from './fluxo-do-pedido'

const props = defineProps<{
  /** Endereço base da página pública, para o link de acompanhamento. */
  enderecoDoLink?: string
}>()

const { t } = useI18n()
const fluxo = useFluxo()
const rotulos = useRotulosDoPedido()
const formato = useClinicFormat()

const pedido = computed(() => fluxo.enviado.value)
const confirmado = computed(() => pedido.value?.status === 'ACEITO')

const acompanhar = computed(() =>
  pedido.value && 'token' in pedido.value && props.enderecoDoLink
    ? `${props.enderecoDoLink}?pedido=${pedido.value.token}`
    : '',
)

/** A folhinha do bilhete: o horário marcado, o pedido, ou a janela do melhor horário. */
const folha = computed(() => {
  const atual = pedido.value
  const horario = atual?.horarioMarcado ?? atual?.horarioPedido

  if (horario) {
    return {
      dia: clinicClock.dateOf(horario.inicio),
      ate: null,
      rodape: formato.hora(horario.inicio),
    }
  }

  const preferencia = atual?.preferencia

  if (!preferencia) {
    return null
  }

  /* "qualquer hora" não cabe na folhinha: ela leva só o período curto, e a janela vai numa linha. */
  return {
    dia: preferencia.de,
    ate: preferencia.ate,
    rodape:
      preferencia.periodos.length === 1
        ? t(
            `clinico.pedidos.periodoTitulo.${preferencia.periodos[0] === 'MANHA' ? 'manha' : 'tarde'}`,
          )
        : '',
  }
})

/** A janela do melhor horário por extenso: "a qualquer hora · 16/10 a 21/10". */
const janela = computed(() => {
  const preferencia = pedido.value?.preferencia

  return preferencia && !pedido.value?.horarioMarcado
    ? rotulos.preferencia({
        de: preferencia.de,
        ate: preferencia.ate,
        periodos: preferencia.periodos.map((periodo) => (periodo === 'MANHA' ? 'manha' : 'tarde')),
        professionalId: preferencia.profissionalId,
      })
    : ''
})

/** O motivo só quando diz mais que o serviço: "Consulta · Check-up", não "Vacinação · Vacina". */
const oQue = computed(() => {
  const atual = pedido.value

  if (!atual) {
    return ''
  }

  const motivo = fluxo.pedido.motivo

  return motivo && ['CHECKUP', 'SINTOMA', 'OUTRO'].includes(motivo)
    ? `${atual.servico.nome} · ${t(`clinico.pedidos.app.motivo.${motivo}`)}`
    : atual.servico.nome
})

const comQuem = computed(() => {
  const atual = pedido.value
  const horario = atual?.horarioMarcado ?? atual?.horarioPedido

  if (horario) {
    return horario.profissional.nome
  }

  const escolhido = fluxo.clinica.value?.profissionais.find(
    (item) => item.id === atual?.preferencia?.profissionalId,
  )

  return escolhido?.nome ?? t('clinico.pedidos.app.qualquerProfissional')
})

/** Por onde a resposta chega: notificação no app, mensagem no celular de quem veio pelo link. */
const porOnde = computed(() =>
  fluxo.canal === 'link'
    ? t('clinico.pedidos.link.confirmacaoPor', { telefone: fluxo.pedido.visitante.telefone })
    : t('clinico.pedidos.app.respostaNoApp'),
)

/**
 * Copiou: o próprio botão diz "Link copiado" com o visto por 2 s, e não um aviso no canto da tela —
 * a resposta fica onde o dedo está.
 */
const copiado = ref(false)
let relogioDoCopiado: ReturnType<typeof setTimeout> | undefined

async function copiar() {
  try {
    await navigator.clipboard.writeText(acompanhar.value)
    copiado.value = true
    clearTimeout(relogioDoCopiado)
    relogioDoCopiado = setTimeout(() => (copiado.value = false), 2000)
  } catch {
    /* Sem área de transferência: o endereço continua à vista para copiar à mão. */
  }
}

onBeforeUnmount(() => clearTimeout(relogioDoCopiado))
</script>

<template>
  <div v-if="pedido" class="fx-etapa enviado">
    <div class="fx-corpo">
      <!-- A notícia: enviado (ou já confirmado), até quando a clínica responde e por onde. -->
      <header class="enviado__cabeca">
        <span class="enviado__selo" :class="{ 'enviado__selo--ok': confirmado }" aria-hidden="true">
          <i class="ph" :class="confirmado ? 'ph-check' : 'ph-paper-plane-tilt'" />
          <ConfeteDePatas />
        </span>
        <h4 class="enviado__titulo">
          {{
            confirmado
              ? t('clinico.pedidos.app.confirmadoTitulo')
              : t('clinico.pedidos.app.enviadoTitulo')
          }}
        </h4>
        <p class="enviado__lide">
          <template v-if="confirmado">{{ t('clinico.pedidos.app.confirmadoLide') }}</template>
          <template v-else>
            {{
              t('clinico.pedidos.app.enviadoLide', { quando: rotulos.quando(pedido.responderAte) })
            }}
            {{ porOnde }}
          </template>
        </p>
      </header>

      <!-- O bilhete: o pedido inteiro lido de relance, com o canhoto do acompanhamento no link. -->
      <article class="enviado__bilhete">
        <div class="enviado__miolo">
          <span class="enviado__situacao" :class="{ 'enviado__situacao--ok': confirmado }">
            <i
              class="ph"
              :class="confirmado ? 'ph-calendar-check' : 'ph-hourglass-medium'"
              aria-hidden="true"
            />
            {{ t(`clinico.pedidos.link.situacao.${pedido.status}`) }}
          </span>
          <FolhaDoDia
            v-if="folha"
            class="enviado__folha"
            tamanho="lg"
            :dia="folha.dia"
            :ate="folha.ate"
            :rodape="folha.rodape"
          />
          <div class="enviado__oque">
            <strong>{{ oQue }}</strong>
            <span>{{ rotulos.nomes(pedido.pets.map((pet) => pet.nome)) }}</span>
            <span v-if="janela" class="enviado__detalhe">
              <i class="ph ph-clock" aria-hidden="true" />
              {{ janela }}
            </span>
            <span class="enviado__detalhe">
              <i class="ph ph-user" aria-hidden="true" />
              {{ comQuem }}
            </span>
            <span class="enviado__detalhe">
              <i class="ph ph-map-pin" aria-hidden="true" />
              {{ pedido.clinica.nome }}
            </span>
          </div>
        </div>

        <div v-if="acompanhar" class="enviado__canhoto">
          <p class="fx-rotulo">{{ t('clinico.pedidos.link.acompanhe') }}</p>
          <div class="enviado__link">
            <InputText
              :model-value="acompanhar"
              readonly
              fluid
              :aria-label="t('clinico.pedidos.link.acompanhe')"
            />
            <Button
              class="enviado__copiar"
              :class="{ 'enviado__copiar--feito': copiado }"
              severity="secondary"
              outlined
              :icon="copiado ? 'ph ph-check' : 'ph ph-copy'"
              :label="
                copiado ? t('clinico.pedidos.link.copiado') : t('clinico.pedidos.link.copiar')
              "
              @click="copiar"
            />
          </div>
        </div>
      </article>

      <!-- O que falta: três passos com hora, deitados quando há largura. -->
      <section class="enviado__agora" aria-labelledby="enviado-agora">
        <p id="enviado-agora" class="fx-rotulo">{{ t('clinico.pedidos.app.agoraTitulo') }}</p>
        <ol class="enviado__passos">
          <li class="enviado__passo enviado__passo--feito">
            <span class="enviado__marca" aria-hidden="true"><i class="ph ph-check" /></span>
            <span class="enviado__texto">
              <strong>{{ t('clinico.pedidos.app.passoEnviado') }}</strong>
              <span>{{ rotulos.quando(pedido.criadoEm) }}</span>
            </span>
          </li>
          <li
            class="enviado__passo"
            :class="confirmado ? 'enviado__passo--feito' : 'enviado__passo--agora'"
          >
            <span class="enviado__marca" aria-hidden="true">
              <i class="ph" :class="confirmado ? 'ph-check' : 'ph-hourglass-medium'" />
            </span>
            <span v-if="confirmado && pedido.horarioMarcado" class="enviado__texto">
              <strong>{{ t('clinico.pedidos.app.passoMarcado') }}</strong>
              <span>
                {{ rotulos.quando(pedido.horarioMarcado.inicio) }} ·
                {{ pedido.horarioMarcado.profissional.nome }}
              </span>
            </span>
            <span v-else class="enviado__texto">
              <strong>{{ t('clinico.pedidos.app.passoClinica') }}</strong>
              <span>{{
                t('clinico.pedidos.app.ate', { quando: rotulos.quando(pedido.responderAte) })
              }}</span>
            </span>
          </li>
          <li class="enviado__passo">
            <span class="enviado__marca" aria-hidden="true"><i class="ph ph-bell" /></span>
            <span class="enviado__texto">
              <strong>{{ t('clinico.pedidos.app.passoLembrete') }}</strong>
              <span>{{ t('clinico.pedidos.app.passoLembreteAjuda') }}</span>
            </span>
          </li>
        </ol>
      </section>

      <p v-if="acompanhar" class="fx-linha fx-linha--suave">
        <i class="ph ph-device-mobile" aria-hidden="true" />
        {{ t('clinico.pedidos.link.baixeOApp') }}
      </p>
    </div>

    <div class="fx-rodape">
      <Button
        :label="
          fluxo.canal === 'app'
            ? t('clinico.pedidos.app.verMeusHorarios')
            : t('clinico.pedidos.link.outroPedido')
        "
        severity="secondary"
        outlined
        @click="fluxo.recomecar()"
      />
    </div>
  </div>
</template>
