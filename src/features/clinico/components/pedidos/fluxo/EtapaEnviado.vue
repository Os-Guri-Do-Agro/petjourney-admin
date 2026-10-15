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
import { useToast } from 'primevue/usetoast'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../../composables/useClinicFormat'
import { useRotulosDoPedido } from '../../../composables/useRotulosDoPedido'
import { clinicClock } from '../../../stores/clinico'
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
const toast = useToast()

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

async function copiar() {
  try {
    await navigator.clipboard.writeText(acompanhar.value)
    toast.add({ severity: 'success', summary: t('clinico.pedidos.link.copiado'), life: 2000 })
  } catch {
    /* Sem área de transferência: o endereço continua à vista para copiar à mão. */
  }
}
</script>

<template>
  <div v-if="pedido" class="fx-etapa enviado">
    <div class="fx-corpo">
      <!-- A notícia: enviado (ou já confirmado), até quando a clínica responde e por onde. -->
      <header class="enviado__cabeca">
        <span class="enviado__selo" :class="{ 'enviado__selo--ok': confirmado }" aria-hidden="true">
          <i class="ph" :class="confirmado ? 'ph-check' : 'ph-paper-plane-tilt'" />
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
              severity="secondary"
              outlined
              icon="ph ph-copy"
              :label="t('clinico.pedidos.link.copiar')"
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

<style scoped>
/* A largura é a do lugar onde a etapa está — o celular ou a página —, não a da janela. */
.enviado {
  container-type: inline-size;
}

.enviado .fx-corpo {
  gap: 1.25rem;
}

/* ------------------------------------------------------------------ a notícia */

.enviado__cabeca {
  display: grid;
  justify-items: start;
  gap: 0.4rem;
}

/*
 * O selo entra uma vez, crescendo do centro: é o "foi" do envio. Na segunda visita à tela não há
 * segunda entrada — a etapa só monta depois de enviar.
 */
.enviado__selo {
  display: grid;
  width: 3.25rem;
  height: 3.25rem;
  margin-bottom: 0.5rem;
  place-items: center;
  border-radius: 999px;
  background: var(--hc-degrade-botao);
  box-shadow:
    0 0 0 6px var(--hc-marca-clara),
    0 10px 24px -10px rgb(31 100 87 / 70%);
  color: #ffffff;
  font-size: 1.45rem;
  animation: enviado-selo 220ms ease-out both;
}

.enviado__selo--ok {
  font-size: 1.6rem;
}

@keyframes enviado-selo {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
}

.enviado__titulo {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.enviado__lide {
  max-width: 34rem;
  margin: 0;
  color: var(--hc-tinta-2);
  line-height: 1.5;
}

/* ------------------------------------------------------------------ o bilhete */

/*
 * Um comprovante: o miolo com o pedido e, no link, o canhoto separado por um picote com dois
 * recortes nas bordas. Os recortes têm a cor do fundo onde a etapa está (o celular e a página usam
 * o mesmo `--hc-fundo`); o `overflow` esconde a metade de fora.
 */
.enviado__bilhete {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--hc-borda);
  border-radius: 1rem;
  background: var(--hc-cartao);
  box-shadow: var(--hc-sombra);
}

/* Estreito: a situação numa linha só, em cima; a folhinha e o pedido lado a lado embaixo. */
.enviado__miolo {
  display: grid;
  align-items: center;
  padding: 1rem;
  grid-template-areas:
    'situacao situacao'
    'folha oque';
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 1rem;
  row-gap: 0.75rem;
}

.enviado__folha {
  grid-area: folha;
}

.enviado__oque {
  display: grid;
  min-width: 0;
  grid-area: oque;
  justify-items: start;
  gap: 0.15rem;
}

.enviado__oque strong {
  color: var(--hc-tinta);
  font-size: 1rem;
  line-height: 1.3;
}

.enviado__oque > span:not(.enviado__situacao) {
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

.enviado__detalhe {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8125rem !important;
}

.enviado__detalhe .ph {
  color: var(--hc-marca);
}

/* A situação: esperando no teal claro, confirmado no verde. O ícone diz qual sem a cor. */
.enviado__situacao {
  display: inline-flex;
  align-items: center;
  grid-area: situacao;
  justify-self: start;
  padding: 0.15rem 0.55rem;
  border-radius: 6px;
  gap: 0.3rem;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
  font-size: 0.75rem;
  font-weight: 700;
}

.enviado__situacao--ok {
  background: var(--hc-verde-fundo);
  color: var(--hc-verde-tinta);
}

.enviado__canhoto {
  position: relative;
  display: grid;
  padding: 0.9rem 1rem 1rem;
  border-top: 1.5px dashed var(--hc-borda);
  gap: 0.5rem;
  background: color-mix(in srgb, var(--hc-fundo) 55%, var(--hc-cartao));
}

.enviado__canhoto::before,
.enviado__canhoto::after {
  position: absolute;
  top: -0.65rem;
  width: 1.2rem;
  height: 1.2rem;
  border: 1px solid var(--hc-borda);
  border-radius: 999px;
  background: var(--hc-fundo);
  content: '';
}

.enviado__canhoto::before {
  inset-inline-start: -0.65rem;
}

.enviado__canhoto::after {
  inset-inline-end: -0.65rem;
}

.enviado__link {
  display: flex;
  gap: 0.4rem;
}

.enviado__link .p-button {
  flex: 0 0 auto;
}

/* ------------------------------------------------------------------ o que acontece agora */

.enviado__agora {
  display: grid;
  gap: 0.75rem;
}

.enviado__passos {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Em pé (celular): a marca à esquerda, o traço descendo até a próxima. */
.enviado__passo {
  position: relative;
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  padding-bottom: 0.9rem;
  column-gap: 0.7rem;
}

.enviado__passo:last-child {
  padding-bottom: 0;
}

.enviado__passo:not(:last-child)::before {
  position: absolute;
  width: 2px;
  inset-block: 2.2rem 0.2rem;
  inset-inline-start: calc(1rem - 1px);
  border-radius: 1px;
  background: var(--hc-borda);
  content: '';
}

.enviado__passo--feito:not(:last-child)::before {
  background: var(--hc-marca);
}

.enviado__marca {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 1.5px solid var(--hc-borda);
  border-radius: 999px;
  background: var(--hc-cartao);
  color: var(--hc-tinta-2);
  font-size: 0.95rem;
}

.enviado__passo--feito .enviado__marca {
  border-color: transparent;
  background: var(--hc-marca-forte);
  color: var(--hc-cartao);
}

/* O passo de agora: o contorno tracejado é "ainda não", e o relógio de areia diz "esperando". */
.enviado__passo--agora .enviado__marca {
  border: 1.5px dashed var(--hc-marca);
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
}

.enviado__texto {
  display: grid;
  min-width: 0;
  padding-top: 0.2rem;
  gap: 0.1rem;
}

.enviado__texto strong {
  color: var(--hc-tinta);
  font-size: 0.875rem;
}

.enviado__texto > span {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.4;
}

/* ------------------------------------------------------------------ com largura */

@container (min-width: 32rem) {
  .enviado__titulo {
    font-size: 1.75rem;
    letter-spacing: -0.025em;
  }

  .enviado__lide {
    font-size: 0.9375rem;
  }

  /* Com largura, a situação sobe para o lado da folhinha, acima do pedido. */
  .enviado__miolo {
    padding: 1.15rem 1.25rem;
    grid-template-areas:
      'folha situacao'
      'folha oque';
    column-gap: 1.25rem;
    row-gap: 0.5rem;
  }

  .enviado__situacao {
    align-self: end;
  }

  .enviado__oque {
    align-self: start;
  }

  .enviado__oque strong {
    font-size: 1.0625rem;
  }

  .enviado__canhoto {
    padding: 1rem 1.25rem 1.15rem;
  }

  /* Deitada: três colunas, a marca em cima e o traço ligando uma à outra. */
  .enviado__passos {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    column-gap: 1rem;
  }

  /* `start`: o passo de texto mais longo estica a linha, e o que sobra não pode empurrar o título. */
  .enviado__passo {
    align-content: start;
    grid-template-columns: minmax(0, 1fr);
    padding-bottom: 0;
    row-gap: 0.6rem;
  }

  .enviado__passo:not(:last-child)::before {
    width: auto;
    height: 2px;
    inset-block: calc(1rem - 1px) auto;
    inset-inline: 2.6rem -0.4rem;
  }

  .enviado__texto {
    padding-top: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .enviado__selo {
    animation: none;
  }
}
</style>
