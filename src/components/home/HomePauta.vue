<script setup lang="ts">
/**
 * O que pede ação, na empresa inteira: o que está parado em cada espaço, e para onde ir resolver.
 *
 * ## A forma
 *
 * A mesma lista do Hoje da Clínica e do Hoje do Hotel (`UiPauta`): uma linha por assunto, da mais
 * grave para a menos, com a marca e o selo da gravidade e a tela aonde ela leva. Aqui ela vem
 * agrupada por espaço — Clínica, Hotel —, cada grupo com o ponto e o ícone na cor do espaço e a
 * contagem ao lado; o grupo recolhe para quem quer olhar só um.
 *
 * No alto, a hora da conferência e o "conferir de novo". Quando todos os espaços falham juntos
 * (quase sempre a rede), um aviso só, com uma ação só.
 *
 * O cálculo mora em `usePautaDaHome`, que a frase do alto da página também lê; a régua é a dos
 * selos da barra.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LinhaDaTabela } from '@/components/home/pauta-tabela'
import UiPauta from '@/components/ui/UiPauta.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'

import { usePautaDaHome, type ModuloDaPauta } from './usePautaDaHome'

const { t } = useI18n()
const {
  modulos,
  visivel,
  algumModuloCarregando,
  conferindo,
  conferidoEm,
  avisoGeral,
  avisoDe,
  reconferir,
} = usePautaDaHome()

/** Grupos recolhidos por quem usa. Estado da tela, não do dado: volta aberto no próximo acesso. */
const recolhidos = ref<Set<string>>(new Set())

function estaRecolhido(id: string) {
  return recolhidos.value.has(id)
}

function alternar(id: string) {
  const proximo = new Set(recolhidos.value)

  if (proximo.has(id)) proximo.delete(id)
  else proximo.add(id)

  recolhidos.value = proximo
}

const total = computed(() => modulos.value.reduce((soma, modulo) => soma + modulo.linhas.length, 0))

const ICONE_DO_ESPACO: Record<ModuloDaPauta['id'], string> = {
  clinica: 'ph ph-stethoscope',
  hotel: 'ph ph-bed',
}

/** A linha do espaço no formato da lista do sistema: a tela aonde ela leva vai junto, traduzida. */
function linhasDe(modulo: ModuloDaPauta): LinhaDaTabela[] {
  return modulo.linhas.map((linha) => ({
    id: linha.id,
    to: linha.to,
    frase: linha.frase,
    detalhe: linha.detalhe,
    tom: linha.tom,
    onde: t(`inicio.pauta.onde.${linha.id}`),
  }))
}
</script>

<template>
  <UiSecao
    v-if="visivel"
    id="inicio-pauta"
    class="pauta-da-casa"
    :titulo="t('inicio.pauta.titulo')"
    :contagem="!algumModuloCarregando && total > 0 ? total : null"
    :descricao="isGuidanceVisible ? t('inicio.guia.pauta') : undefined"
  >
    <template #acoes>
      <span class="conferencia" aria-live="polite">
        <template v-if="conferindo || algumModuloCarregando">
          {{ t('inicio.pauta.conferindo') }}
        </template>
        <time v-else-if="conferidoEm">{{
          t('inicio.pauta.conferido', { hora: conferidoEm })
        }}</time>
      </span>
      <Button
        type="button"
        class="conferencia__botao"
        :class="{ 'conferencia__botao--girando': conferindo }"
        severity="secondary"
        text
        rounded
        icon="ph ph-arrow-clockwise"
        :disabled="conferindo"
        :aria-label="t('inicio.pauta.reconferir')"
        :title="t('inicio.pauta.reconferir')"
        @click="reconferir"
      />
    </template>

    <!-- Todos os espaços falharam juntos: um aviso só, com uma ação só. -->
    <div v-if="avisoGeral" class="aviso ui-folha" role="status">
      <i class="ph ph-warning-circle aviso__icone" aria-hidden="true" />
      <p class="aviso__texto">{{ avisoGeral }}</p>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('inicio.pauta.tentar')"
        :disabled="conferindo"
        @click="reconferir"
      />
    </div>

    <div class="grupos">
      <section
        v-for="modulo in modulos"
        :key="modulo.id"
        class="grupo"
        :class="`pj-lugar--${modulo.id}`"
        :aria-labelledby="`inicio-pauta-${modulo.id}`"
      >
        <h3 :id="`inicio-pauta-${modulo.id}`" class="grupo__titulo">
          <button
            type="button"
            class="grupo__alternar"
            :aria-expanded="!estaRecolhido(modulo.id)"
            :aria-controls="`inicio-pauta-${modulo.id}-corpo`"
            :title="
              estaRecolhido(modulo.id)
                ? t('inicio.pauta.expandir', { modulo: modulo.titulo })
                : t('inicio.pauta.recolher', { modulo: modulo.titulo })
            "
            @click="alternar(modulo.id)"
          >
            <span class="grupo__icone" aria-hidden="true"
              ><i :class="ICONE_DO_ESPACO[modulo.id]"
            /></span>
            <span class="grupo__nome">{{ modulo.titulo }}</span>
            <span v-if="modulo.carregado" class="ui-contagem">{{ modulo.linhas.length }}</span>
            <i
              class="ph ph-caret-down grupo__caret"
              :class="{ 'grupo__caret--recolhido': estaRecolhido(modulo.id) }"
              aria-hidden="true"
            />
          </button>
        </h3>

        <!--
          Recolher tira do Tab e do leitor de tela o que ficou fechado (`v-show` esconde de todos):
          o teclado não entra em linhas que ninguém vê.
        -->
        <div
          v-show="!estaRecolhido(modulo.id)"
          :id="`inicio-pauta-${modulo.id}-corpo`"
          class="grupo__corpo"
        >
          <div v-if="modulo.carregado && avisoDe(modulo)" class="aviso ui-folha" role="status">
            <i class="ph ph-warning-circle aviso__icone" aria-hidden="true" />
            <p class="aviso__texto">{{ avisoDe(modulo) }}</p>
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('inicio.pauta.tentar')"
              :disabled="conferindo"
              @click="modulo.recarregar()"
            />
          </div>

          <div
            v-if="!modulo.carregado"
            class="grupo__esqueleto ui-folha"
            role="status"
            aria-busy="true"
            :aria-label="t('inicio.pauta.carregandoAria')"
          >
            <div v-for="n in 3" :key="n" class="grupo__esqueleto-linha">
              <Skeleton shape="circle" size="36px" />
              <Skeleton width="60%" height="14px" border-radius="6px" />
            </div>
          </div>

          <UiPauta v-else-if="modulo.linhas.length > 0" :linhas="linhasDe(modulo)" />

          <!-- Calma só com conferência completa. Parcial ou falha nunca chegam aqui. -->
          <p v-else-if="modulo.situacao === 'ok'" class="ui-folha ui-vazio calma">
            <i class="ph ph-check-circle" aria-hidden="true" />
            <strong>{{ t('inicio.pauta.calma') }}</strong>
          </p>
        </div>
      </section>
    </div>
  </UiSecao>
</template>

<style scoped>
.conferencia {
  color: var(--tinta-3);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.conferencia__botao.p-button {
  width: 36px;
  height: 36px;
  color: var(--tinta-2);
}

/* Gira só enquanto confere: o movimento diz "estou olhando agora", e para quando terminou. */
.conferencia__botao--girando :deep(.p-button-icon) {
  animation: conferencia-girar 900ms linear infinite;
}

@keyframes conferencia-girar {
  to {
    rotate: 360deg;
  }
}

.grupos {
  display: grid;
  gap: 20px;
}

.grupo {
  display: grid;
  gap: 10px;
}

.grupo__titulo {
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
}

.grupo__alternar {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 8px;
  margin-inline-start: -6px;
  padding: 0 8px 0 6px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
}

.grupo__alternar:hover {
  background: var(--superficie-2);
}

.grupo__alternar:focus-visible {
  outline: 2px solid var(--pj-lugar);
  outline-offset: 1px;
}

.grupo__icone {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 7px;
  background: var(--pj-lugar);
  color: var(--superficie);
  font-size: 14px;
}

.grupo__caret {
  color: var(--tinta-3);
  font-size: 14px;
  transition: rotate var(--pj-tempo-medio) var(--pj-curva-chega);
}

.grupo__caret--recolhido {
  rotate: -90deg;
}

[dir='rtl'] .grupo__caret--recolhido {
  rotate: 90deg;
}

/*
 * Linha sem rosto (o assunto é de vários pacientes): o ícone dela ganha a cor do espaço, para o
 * espaço estar na linha também, e não só no título do grupo.
 */
.grupo :deep(.pauta__sem-rosto) {
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
}

.grupo__corpo {
  display: grid;
  gap: 10px;
}

.grupo__esqueleto {
  display: grid;
  overflow: hidden;
}

.grupo__esqueleto-linha {
  display: flex;
  min-height: 60px;
  align-items: center;
  gap: 14px;
  padding: 10px 24px;
}

.grupo__esqueleto-linha + .grupo__esqueleto-linha {
  border-top: 1px solid var(--linha);
}

.aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 16px;
  border-color: color-mix(in oklab, var(--atencao) 35%, var(--linha));
  background: color-mix(in oklab, var(--atencao-fundo) 60%, var(--superficie));
}

.aviso__icone {
  color: var(--atencao-tinta);
  font-size: 20px;
}

.aviso__texto {
  flex: 1 1 16rem;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.calma {
  grid-auto-flow: column;
  justify-content: start;
  align-items: center;
  gap: 10px;
}

.calma i {
  color: var(--ok-tinta);
  font-size: 20px;
}

@media (prefers-reduced-motion: reduce) {
  .grupo__caret {
    transition: none;
  }

  .conferencia__botao--girando :deep(.p-button-icon) {
    animation: none;
  }
}
</style>
