<script setup lang="ts">
/**
 * O plano da estadia: **o que muda para este animal** em relação ao que a casa faz por todos.
 *
 * Fica logo abaixo de "Rotina de hoje", e a posição é o argumento: a primeira responde *o que falta
 * hoje*, esta responde *por que é isso que falta*. Quem acabou de estranhar um horário na lista de
 * cima encontra a explicação na de baixo, sem trocar de tela.
 *
 * ## Por que cada ajuste mostra o motivo, sempre
 *
 * Um ajuste sem motivo escrito é um ajuste que ninguém sabe desfazer em dezembro. "Nina sem passeio"
 * é uma linha que, três meses depois, ninguém consegue julgar: foi uma perna machucada que já
 * sarou, ou uma decisão do responsável que continua valendo? Por isso `motivo` é campo obrigatório
 * no domínio, e aqui ele aparece com o mesmo peso do horário.
 *
 * ## Encerrar não é apagar
 *
 * "Encerrar" grava `revogadoEm` e a linha sai da lista dos vigentes — mas o registro fica, com o
 * motivo junto. É a mesma lição de `MedicacaoDaEstadia.suspensaEm`: apagar a linha apagaria a
 * única explicação de por que a rotina deste animal foi diferente durante seis dias.
 */
import Button from 'primevue/button'
import { PhSparkle } from '@phosphor-icons/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { AjusteDeRotina } from '../../data/types'

const props = defineProps<{
  ajustes: AjusteDeRotina[]
  salvando: boolean
}>()

const emit = defineEmits<{
  propor: []
  revogar: [ajusteId: string]
}>()

const { t } = useI18n()
const formato = useHotelFormat()

const vigentes = computed(() => props.ajustes.filter((ajuste) => !ajuste.revogadoEm))
</script>

<template>
  <section class="cartao">
    <header class="cartao__topo">
      <h3 class="cartao__titulo">{{ t('hotel.planoDaEstadia.titulo') }}</h3>

      <Button
        :label="t('hotel.planoDaEstadia.propor')"
        severity="secondary"
        outlined
        size="small"
        :disabled="salvando"
        @click="emit('propor')"
      >
        <template #icon>
          <PhSparkle class="botao__icone" weight="duotone" aria-hidden="true" />
        </template>
      </Button>
    </header>

    <p v-if="vigentes.length === 0" class="vazio">
      {{ t('hotel.planoDaEstadia.semAjustes') }}
    </p>

    <ul v-else class="lista">
      <li v-for="ajuste in vigentes" :key="ajuste.id" class="ajuste">
        <IconeDeTarefa :kind="ajuste.kind" class="ajuste__icone" />

        <div class="ajuste__corpo">
          <p class="ajuste__topo">
            <strong>{{ formato.tarefaKind(ajuste.kind) }}</strong>

            <span v-if="ajuste.acao === 'suspende'" class="ajuste__suspenso">
              {{ t('hotel.planoDaEstadia.suspenso') }}
            </span>

            <span v-else class="ajuste__horarios clinic-value">
              {{ ajuste.horarios.join(', ') }}
            </span>
          </p>

          <!-- O motivo tem o mesmo peso do horário: é ele que permite julgar o ajuste depois. -->
          <p class="ajuste__motivo">{{ ajuste.motivo }}</p>

          <p class="ajuste__origem">
            {{
              ajuste.origem === 'proposta'
                ? t('hotel.planoDaEstadia.origemProposta')
                : t('hotel.planoDaEstadia.origemPessoa')
            }}
            ·
            {{ t('hotel.planoDaEstadia.desde', { data: formato.data(ajuste.registradoEm.slice(0, 10)) }) }}
          </p>
        </div>

        <Button
          :label="t('hotel.planoDaEstadia.encerrar')"
          severity="secondary"
          text
          size="small"
          :disabled="salvando"
          @click="emit('revogar', ajuste.id)"
        />
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* A mesma silhueta dos outros cartões da ficha: esta tela é um dossiê, e o dossiê tem uma forma. */
.cartao {
  display: grid;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
}

.cartao__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.cartao__titulo {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.botao__icone {
  width: 0.9rem;
  height: 0.9rem;
}

.vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.lista {
  display: grid;
  margin: 0 calc(var(--clinic-space-4) * -1);
  padding: 0;
  gap: 0;
  list-style: none;
}

.ajuste {
  display: grid;
  align-items: center;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  gap: var(--clinic-space-3);
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.ajuste + .ajuste {
  border-block-start: 1px solid var(--clinic-line-soft);
}

.ajuste .ajuste__icone {
  width: 1.05rem;
  height: 1.05rem;
}

.ajuste__corpo {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.ajuste__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin: 0;
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-base);
}

.ajuste__horarios {
  color: var(--clinic-muted);
  font-variant-numeric: tabular-nums;
}

/* Suspenso é uma ausência, e ausência se diz em palavra — não numa superfície pintada. */
.ajuste__suspenso {
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.ajuste__motivo {
  margin: 0;
  color: var(--clinic-text);
  font-size: var(--clinic-font-label);
}

.ajuste__origem {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

@media (max-width: 620px) {
  .ajuste {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .ajuste > .p-button {
    grid-column: 1 / -1;
    justify-self: end;
  }
}
</style>
