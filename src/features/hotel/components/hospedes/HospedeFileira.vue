<script setup lang="ts">
/**
 * Um hóspede que não cobra nada agora.
 *
 * ## Por que existe uma segunda forma
 *
 * Porque uma densidade só não hierarquiza. A grade anterior dava o mesmo cartão de 19rem para
 * quem tinha quatro tarefas atrasadas e para quem estava dormindo — e uma tela em que tudo tem o
 * mesmo peso obriga a ler tudo para descobrir o que importa. Aqui quem cobra ação ganha o cartão
 * largo e quem está em dia ganha esta fileira, de ~2,4rem.
 *
 * O contraste entre as duas densidades é o que dá ritmo à página, e é o que distingue esta tela da
 * prancheta do turno, que é de uma densidade só de propósito.
 *
 * ## Por que não tem moldura própria
 *
 * Ela vive dentro de uma moldura de **grupo**, e as irmãs se separam por um filete. É a lição que
 * a ronda da prancheta já tinha aprendido: quarenta e nove molduras do mesmo peso não hierarquizam
 * nada. Duas gramáticas de moldura na mesma página — por item no que é quente, por grupo no que é
 * frio — é o que faz a banda fria ler como um bloco só, que é o que ela é.
 */
import { PhDoorOpen, PhMoon } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'

import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { HospedeNaCasa } from '../../data/repositories'

defineProps<{ hospede: HospedeNaCasa }>()

const emit = defineEmits<{ abrir: [hospedagemId: string] }>()

const { t } = useI18n()
const formato = useHotelFormat()
</script>

<template>
  <li class="fileira">
    <PetAvatar
      class="fileira__rosto"
      :nome="hospede.petNome"
      :iniciais="hospede.petIniciais"
      :especie="hospede.petEspecie"
      :foto-url="hospede.petFotoUrl"
      tamanho="sm"
    />

    <button
      type="button"
      class="fileira__abrir"
      :aria-label="t('hotel.hospedes.acao.abrir', { pet: hospede.petNome })"
      @click="emit('abrir', hospede.hospedagem.id)"
    >
      {{ hospede.petNome }}
    </button>

    <span class="fileira__onde">{{ hospede.acomodacaoNome }}</span>

    <!-- A próxima, sem contador: quem está em dia não precisa de relógio correndo. -->
    <span v-if="hospede.foco" class="fileira__proxima">
      <IconeDeTarefa :kind="hospede.foco.kind" />
      <span class="clinic-value">{{ formato.hora(hospede.foco.previstaPara) }}</span>
    </span>

    <span class="fileira__noites">
      <PhMoon weight="duotone" aria-hidden="true" />
      {{ t('hotel.hospedes.cartao.noites', { total: hospede.noites }, hospede.noites) }}
    </span>

    <span class="fileira__saida" :class="{ 'fileira__saida--hoje': hospede.saiHoje }">
      <PhDoorOpen weight="duotone" aria-hidden="true" />
      <span class="clinic-value">{{ formato.quando(hospede.hospedagem.saidaPrevistaEm) }}</span>
    </span>

    <i class="ph ph-caret-right fileira__seta" aria-hidden="true" />
  </li>
</template>

<style scoped>
.fileira {
  position: relative;
  display: flex;
  align-items: center;
  padding: var(--clinic-space-2) var(--clinic-space-4);
  gap: var(--clinic-space-3);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.fileira:hover {
  background: var(--clinic-surface-soft);
}

.fileira:has(.fileira__abrir:focus-visible) {
  box-shadow: var(--clinic-focus-ring);
}

.fileira__rosto {
  flex: 0 0 auto;
}

/* Mesmo padrão de link esticado do cartão: um foco, superfície inteira clicável. */
.fileira__abrir {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--clinic-text);
  cursor: pointer;
  font: inherit;
  font-weight: 750;
  text-align: start;
}

.fileira__abrir::after {
  position: absolute;
  content: '';
  inset: 0;
}

.fileira__abrir:focus-visible {
  outline: none;
}

.fileira__onde {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * Empurra o resto para a borda. `margin-inline-start` e não `margin-left`: em árabe a fileira
 * inverte inteira, e a próxima tarefa precisa continuar do lado de dentro.
 */
.fileira__proxima {
  margin-inline-start: auto;
}

.fileira__proxima,
.fileira__noites,
.fileira__saida {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 0.3rem;
}

.fileira__saida--hoje {
  color: var(--clinic-accent-strong);
  font-weight: 750;
}

.fileira :deep(svg) {
  width: 1em;
  height: 1em;
  color: var(--clinic-faint);
}

.fileira__saida--hoje :deep(svg) {
  color: currentcolor;
}

.fileira__seta {
  flex: 0 0 auto;
  color: var(--clinic-faint);
  font-size: 0.75rem;
}

/* O glifo é direcional: em árabe ele aponta para o outro lado ou vira mentira. */
[dir='rtl'] .fileira__seta {
  transform: scaleX(-1);
}

/* Abaixo de 720px a fileira vira duas linhas em vez de espremer seis dados numa. */
@media (max-width: 720px) {
  .fileira {
    flex-wrap: wrap;
  }

  .fileira__proxima {
    margin-inline-start: 0;
  }
}
</style>
