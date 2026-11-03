<script setup lang="ts">
/**
 * O Portal no pé do Início, numa linha, para quem tem a Clínica ou o Hotel.
 *
 * Até 03/11/2026 o Portal era um bloco ao lado da Clínica e do Hotel, com o código de indicação e
 * o QR na faixa do alto. Código, QR, leituras e "Compartilhar código" na mesma altura do trabalho
 * do dia faziam o Início parecer um programa de recrutamento. A linha diz só o saldo (ou em que pé
 * está o programa) e só ganha botão quando há algo a resolver: o saque, a chave PIX, o bloqueio, o
 * programa recusado ou suspenso. O resto continua no próprio Portal.
 *
 * Quem só tem o Portal vê as áreas dele (`HomePortalAreas`), não esta linha.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { Espaco } from '@/navegacao/espacos'

import { useCarteiraDoInicio, useProgramasDoParceiro, type AcaoDoPortal } from './portal-no-inicio'

defineProps<{ espaco: Espaco }>()

const { t } = useI18n()
const {
  carteira,
  falhou,
  pronto,
  afiliadoAtivo,
  retidoCentavos,
  capacidade,
  acao: acaoDoSaque,
  quantia,
  carregar,
} = useCarteiraDoInicio()
const { pedidos: programas } = useProgramasDoParceiro()

/** O saldo numa frase: o liberado e, quando há, o que ainda está na janela de segurança. */
const resumo = computed(() => {
  if (falhou.value) return t('inicio.saldo.falhou')
  if (!carteira.value) return ''
  if (capacidade.value === 'bloqueado') return t('inicio.saldo.capacidade.bloqueado')

  const partes = [
    t('inicio.espacos.portal.liberadoNaLinha', {
      valor: quantia(carteira.value.saldoSacavelCentavos),
    }),
  ]

  if (retidoCentavos.value > 0) {
    partes.push(t('inicio.espacos.portal.retidoNaLinha', { valor: quantia(retidoCentavos.value) }))
  }

  return partes.join(' · ')
})

/**
 * O botão da linha, só quando há o que resolver. Divulgar o código nunca é o passo aqui: a linha
 * existe para não empurrar indicação.
 */
const acao = computed<AcaoDoPortal | null>(() => {
  if (!pronto.value || falhou.value) return null

  if (!afiliadoAtivo.value) {
    const resolver = programas.value.some(
      (programa) => programa.status === 'REJEITADO' || programa.status === 'SUSPENSO',
    )

    return resolver
      ? { rotulo: t('inicio.programa.cta'), icone: 'ph ph-squares-four', to: '/parceiro/programas' }
      : null
  }

  return acaoDoSaque.value
})
</script>

<template>
  <section class="portal-linha" aria-labelledby="inicio-portal-linha">
    <span class="portal-linha__icone" aria-hidden="true"><i :class="espaco.icone" /></span>

    <div class="portal-linha__texto">
      <h2 id="inicio-portal-linha" class="portal-linha__titulo">
        <RouterLink class="portal-linha__nome" :to="espaco.to">
          {{ espaco.rotulo }}
          <i class="ph ph-caret-right portal-linha__caret" aria-hidden="true" />
        </RouterLink>
      </h2>

      <Skeleton v-if="!pronto" width="14rem" height="0.85rem" border-radius="6px" />
      <p v-else-if="!afiliadoAtivo" class="portal-linha__resumo">
        <span v-for="programa in programas" :key="programa.id" class="portal-linha__programa">
          {{ programa.titulo }}
          <span class="ui-selo" :class="`ui-selo--${programa.tom}`">
            {{ t(`inicio.programa.selo.${programa.status}`) }}
          </span>
        </span>
      </p>
      <p v-else class="portal-linha__resumo" :role="falhou ? 'status' : undefined">
        {{ resumo }}
      </p>
    </div>

    <Button
      v-if="falhou"
      type="button"
      size="small"
      severity="secondary"
      icon="ph ph-arrow-clockwise"
      :label="t('inicio.saldo.tentar')"
      @click="carregar"
    />
    <Button
      v-else-if="acao"
      :as="RouterLink"
      :to="acao.to"
      size="small"
      severity="secondary"
      :icon="acao.icone"
      :label="acao.rotulo"
    />
  </section>
</template>

<style scoped>
.portal-linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
}

/* O quadradinho do espaço em pastel, como na barra: identidade, não chamariz. */
.portal-linha__icone {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--portal-fundo);
  color: var(--portal-tinta);
  font-size: 17px;
}

.portal-linha__texto {
  display: grid;
  min-width: 0;
  flex: 1 1 16rem;
  justify-items: start;
  gap: 3px;
}

.portal-linha__titulo {
  margin: 0;
  font-size: 14.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.portal-linha__nome {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 6px;
  color: var(--tinta);
  text-decoration: none;
}

.portal-linha__nome:hover {
  color: var(--portal-tinta);
}

.portal-linha__nome:focus-visible {
  outline: 2px solid var(--portal);
  outline-offset: 2px;
}

.portal-linha__caret {
  color: var(--tinta-3);
  font-size: 13px;
  transition: translate var(--pj-tempo-curto) var(--pj-curva-chega);
}

.portal-linha__nome:hover .portal-linha__caret {
  translate: 2px 0;
}

[dir='rtl'] .portal-linha__caret {
  scale: -1 1;
}

.portal-linha__resumo {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.portal-linha__programa {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .portal-linha__caret {
    transition: none;
  }
}
</style>
