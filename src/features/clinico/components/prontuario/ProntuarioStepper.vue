<script setup lang="ts">
/**
 * Passos do prontuário.
 *
 * A consulta tem quatro momentos — anamnese, exame, diagnóstico, conduta — e eles acontecem em
 * ordem, com o paciente na mesa. Mostrar os quatro empilhados de uma vez faz a tela pedir mais
 * atenção do que o animal: são mais de trinta campos competindo pelo mesmo olhar.
 *
 * O passo mostra **um momento por vez** e, ao lado, o estado de cada um: o que já foi
 * preenchido, o que está vazio e o que tem alerta pendente. Assim a navegação também é o
 * resumo — não precisa de uma barra de progresso separada dizendo a mesma coisa.
 *
 * Cada passo é um botão de verdade: `Tab` percorre, `Enter` entra, e o rodapé de cada etapa
 * leva à seguinte sem tocar no mouse.
 *
 * Não é o `Stepper` do PrimeVue de propósito: aquele é dono dos painéis e do valor ativo, e aqui
 * quem troca a etapa é a página (rodapé, atalhos, âncora). O que vem do framework é o `Button`
 * de cada passo; a navegação continua sendo `nav` com `ol` e `aria-current="step"`.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { EstadoDaEtapa } from '../../domain/encounter-progress'
import type { PassoProntuario } from './step-types'

const props = defineProps<{
  passos: PassoProntuario[]
  ativo: string
}>()

const emit = defineEmits<{ ir: [id: string] }>()

const { t } = useI18n()

const ICONE: Record<EstadoDaEtapa, string> = {
  vazio: 'pi pi-circle',
  parcial: 'pi pi-clock',
  completo: 'pi pi-check-circle',
  alerta: 'pi pi-exclamation-circle',
}

const indiceAtivo = computed(() => props.passos.findIndex((passo) => passo.id === props.ativo))
</script>

<template>
  <nav class="passos" :aria-label="t('clinico.prontuario.passos.aria')">
    <ol class="passos__lista">
      <li v-for="(passo, indice) in passos" :key="passo.id" class="passos__item">
        <Button
          type="button"
          class="passo"
          :class="[`passo--${passo.estado}`, { 'passo--ativo': passo.id === ativo }]"
          text
          :aria-current="passo.id === ativo ? 'step' : undefined"
          @click="emit('ir', passo.id)"
        >
          <span class="passo__marca" aria-hidden="true">
            <i :class="ICONE[passo.estado]" />
          </span>

          <span class="passo__corpo">
            <span class="passo__rotulo">{{ passo.rotulo }}</span>
            <span v-if="passo.resumo" class="passo__resumo">{{ passo.resumo }}</span>
          </span>
        </Button>

        <!-- O traço entre passos indica a ordem sem prometer que ela é obrigatória. -->
        <span
          v-if="indice < passos.length - 1"
          class="passos__traco"
          :class="{ 'passos__traco--percorrido': indice < indiceAtivo }"
          aria-hidden="true"
        />
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.passos {
  overflow-x: auto;
  padding: var(--clinic-space-2);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.passos__lista {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
}

.passos__item {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
}

/* Botão de texto com conteúdo próprio: alinhado à esquerda, apagado até ser o passo da vez. */
.passo.p-button {
  min-width: 0;
  flex: 1;
  justify-content: flex-start;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid transparent;
  border-radius: var(--clinic-radius-control);
  color: var(--clinic-muted);
  font: inherit;
  text-align: start;
}

.passo.p-button:not(:disabled):hover,
.passo.p-button:not(:disabled):active {
  border-color: transparent;
  background: var(--clinic-surface-soft);
  color: var(--clinic-text);
}

.passo--ativo.p-button,
.passo--ativo.p-button:not(:disabled):hover,
.passo--ativo.p-button:not(:disabled):active {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-text);
}

.passo__marca {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: var(--clinic-surface-sunken);
  font-size: 0.7rem;
}

.passo--completo .passo__marca {
  background: var(--clinic-ok-bg);
  color: var(--clinic-ok-text);
}

.passo--parcial .passo__marca {
  background: var(--clinic-accent-soft);
  color: var(--clinic-accent-strong);
}

.passo--alerta .passo__marca {
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

.passo__corpo {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
}

.passo__rotulo {
  font-size: var(--clinic-font-base);
  font-weight: 700;
  letter-spacing: -0.01em;
}

/* O resumo é a memória do passo: some em tela estreita, onde o rótulo já basta. */
.passo__resumo {
  overflow: hidden;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.passos__traco {
  width: 1.5rem;
  height: 1px;
  flex: 0 0 auto;
  background: var(--clinic-line);
}

.passos__traco--percorrido {
  background: var(--clinic-accent);
}

@media (max-width: 1024px) {
  .passo__resumo {
    display: none;
  }
}

@media (max-width: 720px) {
  .passos__traco {
    width: 0.5rem;
  }

  .passo.p-button {
    padding-inline: var(--clinic-space-2);
  }
}
</style>
