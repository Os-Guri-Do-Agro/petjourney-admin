<script setup lang="ts">
/**
 * Confira e envie.
 *
 * O resumo diz o que vai para a clínica, e as regras ficam escritas antes do botão — não depois:
 * quanto tempo a clínica leva para responder, e até quando dá para cancelar pelo app. O horário
 * escolhido fica segurado enquanto a pessoa lê; o relógio aparece, e quando acaba o fluxo volta aos
 * horários (que podem ter mudado) em vez de deixar enviar um pedido que vai falhar.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Textarea from 'primevue/textarea'
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../../composables/useClinicFormat'
import { useRotulosDoPedido } from '../../../composables/useRotulosDoPedido'
import { LIMITES_CLINICOS } from '../../../contrato/responsavel'
import { clinicClock } from '../../../stores/clinico'
import FolhaDoDia from '../FolhaDoDia.vue'

import { useFluxo } from './fluxo-do-pedido'

const { t } = useI18n()
const fluxo = useFluxo()
const formato = useClinicFormat()
const rotulos = useRotulosDoPedido()

const agora = ref(Date.parse(clinicClock.nowIso()))
const relogio = setInterval(() => {
  agora.value = Date.parse(clinicClock.nowIso())

  if (fluxo.reserva.value && segundosRestantes.value <= 0) {
    void fluxo.reservaVenceu()
  }
}, 1000)

onBeforeUnmount(() => clearInterval(relogio))

const segundosRestantes = computed(() =>
  fluxo.reserva.value
    ? Math.max(0, Math.round((Date.parse(fluxo.reserva.value.expiraEm) - agora.value) / 1000))
    : 0,
)

const relogioTexto = computed(() => {
  const minutos = Math.floor(segundosRestantes.value / 60)
  const segundos = String(segundosRestantes.value % 60).padStart(2, '0')

  return `${minutos}:${segundos}`
})

const nomesDosPets = computed(() =>
  fluxo.canal === 'link'
    ? fluxo.pedido.visitante.petNome
    : rotulos.nomes(fluxo.petsEscolhidos.value.map((pet) => pet.nome)),
)

const horario = computed(() => {
  const reserva = fluxo.reserva.value

  if (!reserva) {
    return ''
  }

  /* Dois pets: quem vai em qual horário — "Brunilda 09:00 e Pérola 09:30". */
  const nomeDe = (petId: string) =>
    fluxo.petsEscolhidos.value.find((pet) => pet.id === petId)?.nome ?? ''
  const horas =
    reserva.opcao.porPet.length > 1
      ? rotulos.nomes(
          reserva.opcao.porPet.map(
            (trecho) => `${nomeDe(trecho.petId)} ${formato.hora(trecho.inicio)}`,
          ),
        )
      : formato.hora(reserva.opcao.inicio)

  return `${rotulos.dia(clinicClock.dateOf(reserva.opcao.inicio))} · ${horas}`
})

const preferencia = computed(() =>
  rotulos.preferencia({
    ...fluxo.janela.value,
    periodos: fluxo.pedido.periodos.map((periodo) => (periodo === 'MANHA' ? 'manha' : 'tarde')),
    professionalId: null,
  }),
)

/** A folhinha do bilhete: o dia segurado com a hora, ou os dias em que pode com o período. */
const folha = computed(() => {
  const reserva = fluxo.reserva.value

  if (reserva) {
    return {
      dia: clinicClock.dateOf(reserva.opcao.inicio),
      ate: null,
      rodape: formato.hora(reserva.opcao.inicio),
    }
  }

  const periodos = fluxo.pedido.periodos

  /* "qualquer hora" não cabe na folhinha; a janela inteira já está em "Quando pode", logo abaixo. */
  return {
    dia: fluxo.janela.value.de,
    ate: fluxo.janela.value.ate,
    rodape:
      periodos.length === 1
        ? t(`clinico.pedidos.periodoTitulo.${periodos[0] === 'MANHA' ? 'manha' : 'tarde'}`)
        : '',
  }
})

const comQuem = computed(() => {
  if (fluxo.reserva.value) {
    return fluxo.reserva.value.opcao.profissional.nome
  }

  return fluxo.profissional.value?.nome ?? t('clinico.pedidos.app.qualquerProfissional')
})

/** O nome de quem nunca passou pela clínica — para a pergunta do histórico. */
const novos = computed(() =>
  rotulos.nomes(
    fluxo.petsEscolhidos.value.filter((pet) => !pet.conhecidoPelaClinica).map((pet) => pet.nome),
  ),
)

const mensagemDeErro = computed(() => {
  const codigo = fluxo.erro.value

  if (!codigo || codigo === 'RESERVA_EXPIRADA') {
    return ''
  }

  return t(`clinico.pedidos.app.erro.${codigo === 'FALHA' ? 'FALHA' : codigo}`)
})
</script>

<template>
  <div class="fx-etapa">
    <div class="fx-corpo">
      <p v-if="fluxo.reserva.value" class="fx-linha revisar__relogio" aria-live="polite">
        <i class="ph ph-timer" aria-hidden="true" />
        {{ t('clinico.pedidos.app.segurado', { tempo: relogioTexto }) }}
      </p>

      <!-- O bilhete: a folhinha do dia ao lado do quê e para quem — o resumo lido de relance. -->
      <section class="fx-bloco revisar__bilhete">
        <div class="revisar__topo">
          <FolhaDoDia tamanho="lg" :dia="folha.dia" :ate="folha.ate" :rodape="folha.rodape" />
          <div class="revisar__oque">
            <strong>
              {{ fluxo.servico.value?.nome }}
              <!-- O motivo só quando diz mais que o serviço: "Consulta · Check-up", não "Vacinação · Vacina". -->
              <template
                v-if="
                  fluxo.pedido.motivo &&
                  ['CHECKUP', 'SINTOMA', 'OUTRO'].includes(fluxo.pedido.motivo)
                "
              >
                · {{ t(`clinico.pedidos.app.motivo.${fluxo.pedido.motivo}`) }}
              </template>
            </strong>
            <span>{{ nomesDosPets }}</span>
            <span class="revisar__clinica">
              <i class="ph ph-map-pin" aria-hidden="true" />
              {{ fluxo.clinica.value?.clinica.nome }}
            </span>
          </div>
        </div>
        <dl class="fx-resumo">
          <div>
            <dt>
              {{
                fluxo.reserva.value
                  ? t('clinico.pedidos.app.resumo.horario')
                  : t('clinico.pedidos.app.resumo.quando')
              }}
            </dt>
            <dd>{{ fluxo.reserva.value ? horario : preferencia }}</dd>
          </div>
          <div>
            <dt>{{ t('clinico.pedidos.app.resumo.comQuem') }}</dt>
            <dd>{{ comQuem }}</dd>
          </div>
        </dl>
      </section>

      <label v-if="fluxo.pedido.motivo !== 'SINTOMA'" class="fx-campo">
        <span>{{ t('clinico.pedidos.app.contarAlgo') }}</span>
        <Textarea
          v-model="fluxo.pedido.queixa"
          rows="2"
          auto-resize
          fluid
          :maxlength="LIMITES_CLINICOS.observacaoDoAgendamento"
        />
      </label>

      <!-- Primeira vez: o histórico do app é da pessoa; ela decide se a clínica lê. -->
      <label v-if="fluxo.canal === 'app' && fluxo.primeiraVez.value" class="revisar__historico">
        <Checkbox v-model="fluxo.pedido.compartilharHistorico" binary />
        <span>
          <strong>{{ t('clinico.pedidos.app.compartilhar', { nomes: novos }) }}</strong>
          <span>{{ t('clinico.pedidos.app.compartilharAjuda') }}</span>
        </span>
      </label>

      <ul class="revisar__regras">
        <li class="fx-linha fx-linha--suave">
          <i class="ph ph-clock" aria-hidden="true" />
          {{
            t('clinico.pedidos.app.prazoDaClinica', {
              horas: fluxo.clinica.value?.prazoDeRespostaHoras ?? 0,
            })
          }}
        </li>
        <li class="fx-linha fx-linha--suave">
          <i class="ph ph-calendar-x" aria-hidden="true" />
          <!-- Quem veio pelo link não tem app para cancelar: a regra dele é outra. -->
          {{
            fluxo.canal === 'link'
              ? t('clinico.pedidos.link.regraCancelar', {
                  telefone: fluxo.clinica.value?.clinica.telefone ?? '',
                })
              : t('clinico.pedidos.app.regraCancelar', {
                  horas: fluxo.clinica.value?.politica.cancelarAteHorasAntes ?? 0,
                })
          }}
        </li>
        <li v-if="fluxo.canal === 'link'" class="fx-linha fx-linha--suave">
          <i class="ph ph-chat-circle-text" aria-hidden="true" />
          {{
            t('clinico.pedidos.link.confirmacaoPor', { telefone: fluxo.pedido.visitante.telefone })
          }}
        </li>
      </ul>

      <p v-if="mensagemDeErro" class="fx-linha fx-linha--risco" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ mensagemDeErro }}
      </p>
    </div>

    <div class="fx-rodape">
      <Button
        :label="t('clinico.pedidos.app.enviar')"
        icon="ph ph-paper-plane-tilt"
        :loading="fluxo.carregando.value"
        @click="fluxo.enviar()"
      />
    </div>
  </div>
</template>

<style scoped>
.revisar__bilhete {
  gap: 0.75rem;
}

.revisar__topo {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.revisar__oque {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.revisar__oque strong {
  color: var(--tinta);
  font-size: 1rem;
  line-height: 1.3;
}

.revisar__oque > span {
  color: var(--tinta-2);
  font-size: 0.875rem;
}

.revisar__clinica {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8125rem !important;
}

.revisar__relogio {
  color: var(--musgo);
  font-variant-numeric: tabular-nums;
  font-weight: 650;
}

.revisar__historico {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  cursor: pointer;
}

.revisar__historico > span {
  display: grid;
  gap: 0.15rem;
}

.revisar__historico > span > span {
  color: var(--tinta-2);
  font-size: 0.8125rem;
  line-height: 1.4;
}

.revisar__regras {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.35rem;
  list-style: none;
}
</style>
