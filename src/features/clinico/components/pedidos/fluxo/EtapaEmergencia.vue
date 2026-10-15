<script setup lang="ts">
/**
 * Emergência: o contato da clínica, e nada entre a pessoa e ele.
 *
 * Não é pedido e não espera resposta. A tela diz se a clínica está aberta agora (o servidor
 * calcula — feriado incluído), dá o número grande com a ação de ligar, o WhatsApp e o endereço, e
 * a mensagem que a clínica deixou para fora do horário. Os sinais vêm por último, como conferência:
 * quem chegou aqui por eles já sabe.
 *
 * É o único "ligar" do fluxo, e de propósito: aqui quem liga é o responsável, para a clínica, numa
 * emergência. No portal a regra é outra (a clínica registra o contato, não disca).
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRotulosDoPedido } from '../../../composables/useRotulosDoPedido'
import { SINAIS_DE_EMERGENCIA } from '../../../contrato/responsavel'

import { useFluxo } from './fluxo-do-pedido'

const { t } = useI18n()
const fluxo = useFluxo()
const rotulos = useRotulosDoPedido()

const emergencia = computed(() => fluxo.clinica.value?.emergencia ?? null)

function soDigitos(telefone: string) {
  return telefone.replace(/\D/g, '')
}

const ligar = computed(() => {
  if (!emergencia.value) {
    return ''
  }

  /* Fechada, com plantão: o número que atende agora é o do plantão. */
  const numero =
    !emergencia.value.abertaAgora && emergencia.value.telefoneDePlantao
      ? emergencia.value.telefoneDePlantao
      : emergencia.value.telefone

  return numero
})

const mapa = computed(() =>
  emergencia.value
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(emergencia.value.endereco)}`
    : '',
)

const whatsapp = computed(() =>
  emergencia.value?.whatsapp ? `https://wa.me/55${soDigitos(emergencia.value.whatsapp)}` : '',
)

/** Voltar ao pedido só faz sentido para quem veio do motivo. Do início, volta ao início. */
function naoEEmergencia() {
  fluxo.pedido.sinais = []
  fluxo.pedido.motivo = null
  void fluxo.voltar()
}
</script>

<template>
  <div v-if="emergencia" class="fx-etapa">
    <div class="fx-corpo">
      <p
        class="fx-linha emergencia__estado"
        :class="emergencia.abertaAgora ? '' : 'fx-linha--atencao'"
      >
        <i
          class="ph"
          :class="emergencia.abertaAgora ? 'ph-door-open' : 'ph-door'"
          aria-hidden="true"
        />
        <span v-if="emergencia.abertaAgora">
          {{ t('clinico.pedidos.app.abertaAte', { hora: emergencia.fechaAs }) }}
        </span>
        <span v-else-if="emergencia.abreEm">
          {{ t('clinico.pedidos.app.fechadaAbre', { quando: rotulos.quando(emergencia.abreEm) }) }}
        </span>
      </p>

      <section class="fx-bloco emergencia__contato">
        <p class="fx-rotulo">
          {{
            !emergencia.abertaAgora && emergencia.telefoneDePlantao
              ? t('clinico.pedidos.app.plantao')
              : t('clinico.pedidos.app.ligueParaClinica')
          }}
        </p>
        <strong class="emergencia__numero"
          ><bdi dir="ltr">{{ ligar }}</bdi></strong
        >
        <Button
          as="a"
          :href="`tel:${soDigitos(ligar)}`"
          icon="ph ph-phone-call"
          :label="t('clinico.pedidos.app.ligarAgora')"
          class="emergencia__acao"
        />
        <Button
          v-if="whatsapp"
          as="a"
          :href="whatsapp"
          target="_blank"
          rel="noopener"
          severity="secondary"
          outlined
          icon="ph ph-whatsapp-logo"
          :label="t('clinico.pedidos.app.whatsapp')"
          class="emergencia__acao"
        />
      </section>

      <section class="fx-bloco">
        <p class="fx-linha">
          <i class="ph ph-map-pin" aria-hidden="true" />
          <span>{{ emergencia.endereco }}</span>
        </p>
        <Button
          as="a"
          :href="mapa"
          target="_blank"
          rel="noopener"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-navigation-arrow"
          :label="t('clinico.pedidos.app.comoChegar')"
        />
      </section>

      <section v-if="!emergencia.abertaAgora && emergencia.orientacao" class="fx-bloco">
        <p class="fx-rotulo">{{ t('clinico.pedidos.app.mensagemDaClinica') }}</p>
        <p class="emergencia__orientacao">{{ emergencia.orientacao }}</p>
      </section>

      <section class="emergencia__sinais">
        <p class="fx-rotulo">{{ t('clinico.pedidos.app.sinaisVaDireto') }}</p>
        <ul>
          <li v-for="sinal in SINAIS_DE_EMERGENCIA" :key="sinal">
            {{ t(`clinico.pedidos.app.sinal.${sinal}`) }}
          </li>
        </ul>
      </section>
    </div>

    <div class="fx-rodape">
      <Button
        severity="secondary"
        outlined
        :label="t('clinico.pedidos.app.naoEEmergencia')"
        @click="naoEEmergencia"
      />
    </div>
  </div>
</template>

<style scoped>
.emergencia__estado {
  font-weight: 650;
}

.emergencia__contato {
  justify-items: stretch;
}

.emergencia__numero {
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.emergencia__acao {
  min-height: 2.9rem;
  justify-content: center;
  text-decoration: none;
}

.emergencia__orientacao {
  margin: 0;
  color: var(--hc-tinta-2);
  line-height: 1.5;
}

.emergencia__sinais ul {
  display: grid;
  margin: 0.35rem 0 0;
  padding-inline-start: 1.1rem;
  color: var(--hc-tinta-2);
  gap: 0.2rem;
  line-height: 1.4;
}
</style>
