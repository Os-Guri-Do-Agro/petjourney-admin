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
  <section class="plano">
    <header class="plano__cabeca">
      <div class="plano__titulos">
        <h3 class="plano__titulo">{{ t('hotel.planoDaEstadia.titulo') }}</h3>
        <p v-if="vigentes.length === 0" class="plano__descricao">
          {{ t('hotel.planoDaEstadia.semAjustes') }}
        </p>
      </div>

      <Button
        type="button"
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

    <ul v-if="vigentes.length > 0" class="ui-lista ui-folha lista">
      <li v-for="ajuste in vigentes" :key="ajuste.id" class="ajuste">
        <span class="ajuste__icone" aria-hidden="true">
          <IconeDeTarefa :kind="ajuste.kind" />
        </span>

        <div class="ajuste__corpo">
          <p class="ajuste__topo">
            <strong>{{ formato.tarefaKind(ajuste.kind) }}</strong>

            <span v-if="ajuste.acao === 'suspende'" class="ui-selo ui-selo--atencao">
              {{ t('hotel.planoDaEstadia.suspenso') }}
            </span>

            <span v-else class="ajuste__horarios ui-num">
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
            {{
              t('hotel.planoDaEstadia.desde', {
                data: formato.data(ajuste.registradoEm.slice(0, 10)),
              })
            }}
          </p>
        </div>

        <Button
          type="button"
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
/* A seção no fundo, a lista na folha: o mesmo desenho das outras seções da estadia. */
.plano {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.plano__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 16px;
}

.plano__titulos {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.plano__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.plano__descricao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.botao__icone {
  width: 16px;
  height: 16px;
}

.ajuste {
  display: grid;
  align-items: center;
  padding: 14px 12px 14px 18px;
  gap: 14px;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.ajuste__icone {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 50%;
  background: var(--pj-lugar-fundo, var(--superficie-2));
  color: var(--pj-lugar-tinta, var(--tinta-2));
}

.ajuste__icone :deep(svg) {
  width: 18px;
  height: 18px;
}

.ajuste__corpo {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.ajuste__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
}

.ajuste__topo strong {
  font-weight: 600;
}

.ajuste__horarios {
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 600;
}

.ajuste__motivo {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
}

.ajuste__origem {
  margin: 0;
  color: var(--tinta-3);
  font-size: 12.5px;
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
