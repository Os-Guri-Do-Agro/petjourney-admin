<script setup lang="ts">
/**
 * A clínica do pet, no app: o que está marcado, o que está pedido, e os dois caminhos — pedir
 * horário ou emergência.
 *
 * Cancelar e remarcar moram aqui, ao lado do horário, e obedecem ao prazo que o servidor calcula
 * (`podeCancelar`, `cancelarAte`). Passado o prazo, o botão some e a frase diz o que fazer: ligar
 * para a clínica. O app nunca recalcula — um relógio só.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { useRotulosDoPedido } from '../../../composables/useRotulosDoPedido'

import { useFluxo } from './fluxo-do-pedido'

const { t } = useI18n()
const fluxo = useFluxo()
const rotulos = useRotulosDoPedido()

const emergencia = computed(() => fluxo.clinica.value?.emergencia ?? null)

const abertos = computed(() =>
  fluxo.pedidos.value.filter(
    (pedido) => pedido.status === 'AGUARDANDO_CLINICA' || pedido.status === 'RECUSADO',
  ),
)

function iniciais(nome: string) {
  return nome.slice(0, 2).toUpperCase()
}

function especieDe(petId: string) {
  return fluxo.petsDaConta.value.find((pet) => pet.id === petId)?.especie ?? null
}
</script>

<template>
  <div class="fx-etapa">
    <div class="fx-corpo">
      <header class="inicio__clinica">
        <span class="fx-opcao__icone" aria-hidden="true"><i class="ph ph-first-aid-kit" /></span>
        <span class="fx-opcao__texto">
          <strong>{{ fluxo.clinica.value?.clinica.nome }}</strong>
          <span v-if="emergencia?.abertaAgora">
            {{ t('clinico.pedidos.app.abertaAte', { hora: emergencia.fechaAs }) }}
          </span>
          <span v-else-if="emergencia?.abreEm">
            {{
              t('clinico.pedidos.app.fechadaAbre', { quando: rotulos.quando(emergencia.abreEm) })
            }}
          </span>
        </span>
      </header>

      <p class="fx-rotulo">{{ t('clinico.pedidos.app.proximos') }}</p>

      <ul v-if="fluxo.agendamentos.value.length > 0" class="fx-lista">
        <li v-for="item in fluxo.agendamentos.value" :key="item.id" class="inicio__item">
          <div class="inicio__linha">
            <PetAvatar
              :nome="item.pet.nome"
              :iniciais="iniciais(item.pet.nome)"
              :especie="especieDe(item.pet.id)"
              :foto-url="item.pet.fotoUrl ?? ''"
              tamanho="sm"
            />
            <span class="fx-opcao__texto">
              <strong>{{ item.pet.nome }} · {{ item.servico.nome }}</strong>
              <span>
                {{ rotulos.quando(item.inicio) }} ·
                {{ t('clinico.pedidos.comProfissional', { nome: item.profissional.nome }) }}
              </span>
            </span>
            <span class="fx-selo" :class="item.status === 'CONFIRMADO' ? 'fx-selo--marca' : ''">
              {{ t(`clinico.pedidos.app.status.${item.status}`) }}
            </span>
          </div>

          <div v-if="item.podeCancelar" class="inicio__acoes">
            <Button
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrows-clockwise"
              :label="t('clinico.pedidos.app.remarcar')"
              @click="fluxo.remarcar(item)"
            />
            <Button
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-x"
              :label="t('clinico.pedidos.app.cancelar')"
              :loading="fluxo.carregando.value"
              @click="fluxo.cancelarAgendamento(item.id)"
            />
          </div>
          <!-- Passou do prazo: a regra da clínica, dita, e o número para ligar. -->
          <p v-else class="fx-linha fx-linha--suave inicio__regra">
            <i class="ph ph-phone" aria-hidden="true" />
            {{
              t('clinico.pedidos.app.cancelarPorTelefone', {
                horas: fluxo.clinica.value?.politica.cancelarAteHorasAntes ?? 0,
                telefone: fluxo.clinica.value?.clinica.telefone ?? '',
              })
            }}
          </p>
        </li>
      </ul>
      <p v-else class="fx-ajuda">{{ t('clinico.pedidos.app.nadaMarcado') }}</p>

      <template v-if="abertos.length > 0">
        <p class="fx-rotulo">{{ t('clinico.pedidos.app.pedidos') }}</p>

        <ul class="fx-lista">
          <li v-for="item in abertos" :key="item.id" class="inicio__item">
            <div class="inicio__linha">
              <span class="fx-opcao__icone" aria-hidden="true">
                <i
                  class="ph"
                  :class="item.status === 'RECUSADO' ? 'ph-calendar-x' : 'ph-hourglass-medium'"
                />
              </span>
              <span class="fx-opcao__texto">
                <strong
                  >{{ rotulos.nomes(item.pets.map((pet) => pet.nome)) }} ·
                  {{ item.servico.nome }}</strong
                >
                <span v-if="item.status === 'AGUARDANDO_CLINICA'">
                  {{
                    t('clinico.pedidos.app.aguardando', {
                      quando: rotulos.quando(item.responderAte),
                    })
                  }}
                </span>
                <span v-else>{{ t('clinico.pedidos.app.recusado') }}</span>
              </span>
            </div>

            <blockquote v-if="item.recusa" class="inicio__mensagem">
              {{ item.recusa.mensagemDaClinica }}
            </blockquote>

            <div class="inicio__acoes">
              <Button
                v-if="item.podeCancelar"
                size="small"
                severity="secondary"
                outlined
                :label="t('clinico.pedidos.app.desistir')"
                :loading="fluxo.carregando.value"
                @click="fluxo.desistirDoPedido(item.id)"
              />
              <Button
                v-if="item.status === 'RECUSADO'"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-calendar-plus"
                :label="t('clinico.pedidos.app.pedirDeNovo')"
                @click="fluxo.pedirDeNovo(item)"
              />
            </div>
          </li>
        </ul>
      </template>
    </div>

    <div class="fx-rodape">
      <Button
        icon="ph ph-calendar-plus"
        :label="t('clinico.pedidos.app.pedirHorario')"
        :disabled="!fluxo.clinica.value"
        @click="fluxo.comecarPedido()"
      />
      <Button
        severity="secondary"
        outlined
        icon="ph ph-first-aid"
        :label="t('clinico.pedidos.app.ehEmergencia')"
        @click="fluxo.irPara('emergencia')"
      />
    </div>
  </div>
</template>

<style scoped>
.inicio__clinica {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.inicio__item {
  display: grid;
  padding: 0.7rem 0.8rem;
  gap: 0.55rem;
}

.inicio__linha {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.inicio__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.inicio__acoes:empty {
  display: none;
}

.inicio__regra {
  font-size: 13px;
}

.inicio__mensagem {
  margin: 0;
  padding: 0.5rem 0.65rem;
  border-radius: 0.6rem;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 0.8125rem;
  line-height: 1.45;
}
</style>
