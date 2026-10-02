<script setup lang="ts">
/**
 * Um leito no mapa.
 *
 * O cartão vazio é tão importante quanto o ocupado, e por isso ocupa o mesmo espaço: o mapa
 * responde "onde há vaga", e uma grade em que os livres encolhem obriga a contar em vez de
 * olhar. O leito fora de operação fica visível e apagado pela mesma razão — some da conta de
 * vagas sem sumir do lugar, para que quem lê o mapa por posição não perca a referência.
 *
 * A informação numérica do cartão é escolhida a dedo: **o que cobra ação agora** e **quanto
 * falta para a próxima**. Peso, diagnóstico e previsão de alta cabem na tela do paciente; num
 * cartão de mapa eles disputariam espaço com a única linha que decide para onde a enfermagem
 * anda em seguida.
 *
 * ## A forma (redesenho de 30/09/2026)
 *
 * O cartão da Visão geral, neutro. A urgência deixou de contornar o cartão inteiro com um anel
 * coral ou areia — o mapa de oito leitos virava um mosaico de molduras — e mora em selos de 6 px:
 * a gravidade no alto (estável, atenção, crítico), e o atraso e o boletim retido embaixo, cada um
 * com ícone e palavra. O tipo do leito saiu do cartão: o mapa agrupa por tipo.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import type { LeitoNoMapa } from '../../data/repositories'
import type { GravidadeClinica } from '../../data/types'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{ item: LeitoNoMapa }>()

const emit = defineEmits<{
  abrir: [internacaoId: string]
  internar: [leitoId: string]
}>()

const { t } = useI18n()
const clinico = useClinicoStore()

const ocupado = computed(() => props.item.internacao !== null)
const indisponivel = computed(() => !props.item.leito.ativo)

const pet = computed(() =>
  props.item.internacao ? clinico.pet(props.item.internacao.petId) : null,
)

/** A gravidade no par de selo da Visão geral: verde, pêssego, coral. */
const COR_DA_GRAVIDADE: Record<GravidadeClinica, string> = {
  estavel: 'verde',
  atencao: 'pessego',
  critico: 'coral',
}

const proxima = computed(() => {
  const minutos = props.item.proximaEmMinutos

  if (minutos === null) {
    return ''
  }

  return minutos < 60
    ? t('clinico.internacao.leito.proximaMinutos', { minutos })
    : t('clinico.internacao.leito.proximaHoras', { horas: Math.round(minutos / 60) })
})

const estado = computed(() => {
  if (ocupado.value) {
    return 'ocupado'
  }

  return indisponivel.value ? 'inativo' : 'livre'
})
</script>

<template>
  <article class="leito" :class="[`leito--${estado}`, { 'leito--clicavel': ocupado }]">
    <header class="leito__topo">
      <span class="leito__nome">{{ item.leito.nome }}</span>
      <span
        v-if="item.internacao"
        class="hc-selo"
        :class="`hc--${COR_DA_GRAVIDADE[item.internacao.gravidade]}`"
      >
        {{ t(`clinico.internacao.gravidade.${item.internacao.gravidade}`) }}
      </span>
    </header>

    <template v-if="item.internacao">
      <!--
        O botão é o nome do paciente, mas o **alvo do clique é o cartão inteiro**: o `::after`
        dele se estende por toda a superfície (ver o CSS). Continua sendo um botão de verdade —
        teclado, foco e leitor de tela nativos, com o nome do paciente como rótulo — em vez de um
        `role="button"` no `<article>`, que leria o cartão inteiro em voz alta para dizer "abrir o
        Bento".
      -->
      <Button type="button" class="leito__paciente" text @click="emit('abrir', item.internacao.id)">
        <PetAvatar
          class="leito__avatar"
          :nome="item.petNome"
          :iniciais="item.petIniciais"
          :especie="pet?.especie ?? null"
          :foto-url="pet?.fotoUrl ?? ''"
          tamanho="md"
        />
        <span class="leito__identidade">
          <strong class="leito__pet">{{ item.petNome }}</strong>
          <span class="leito__motivo">{{ item.internacao.motivo }}</span>
        </span>
      </Button>

      <!--
        O que cobra ação, em selo: ícone, forma e palavra, três canais que sobrevivem à escala de
        cinza. O do boletim é cheio e o do atraso, contornado: os dois podem aparecer juntos, e são
        dois pedidos diferentes — o atraso chama a enfermagem; o boletim, alguém ao telefone.
      -->
      <p v-if="item.atrasadas > 0 || item.boletimRetido" class="leito__cobrancas">
        <span v-if="item.boletimRetido" class="hc-selo leito__selo leito__selo--boletim">
          <i class="pi pi-phone" aria-hidden="true" />
          {{ t('clinico.internacao.leito.boletimRetido') }}
        </span>
        <span v-if="item.atrasadas > 0" class="hc-selo hc--coral leito__selo">
          <i class="pi pi-exclamation-circle" aria-hidden="true" />
          {{ t('clinico.internacao.leito.atrasadas', { total: item.atrasadas }, item.atrasadas) }}
        </span>
      </p>

      <p class="leito__rodape">
        <span>
          {{ t('clinico.internacao.leito.internadoHa') }}
          <strong>{{ t('clinico.internacao.leito.horas', { horas: item.horasInternado }) }}</strong>
        </span>
        <span v-if="item.pendentes > 0">
          {{ t('clinico.internacao.leito.pendentes') }} <strong>{{ item.pendentes }}</strong>
        </span>
        <span v-if="proxima">{{ proxima }}</span>
      </p>
    </template>

    <template v-else>
      <p class="leito__vazio">
        {{
          indisponivel
            ? t('clinico.internacao.leito.foraDeOperacao')
            : t('clinico.internacao.leito.livre')
        }}
      </p>

      <Button
        v-if="!indisponivel"
        class="leito__internar"
        :label="t('clinico.internacao.leito.internar')"
        icon="pi pi-plus"
        severity="secondary"
        outlined
        size="small"
        @click="emit('internar', item.leito.id)"
      />
    </template>
  </article>
</template>

<style scoped>
.leito {
  --leito-sombra: var(--hc-sombra);

  /* Âncora do alvo estendido do botão do paciente. */
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 11.5rem;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.1rem 1.05rem;
  border: 1px solid var(--hc-borda);
  border-radius: 1rem;
  background: var(--hc-cartao);
  box-shadow: var(--leito-sombra);
  color: var(--hc-tinta);
  transition:
    border-color 150ms ease-out,
    box-shadow 150ms ease-out;
}

/*
 * O cartão ocupado inteiro abre o paciente. Ele sobe pela sombra, como as pílulas: trocar o fundo
 * de um cartão branco não se vê.
 *
 * O leito **livre** fica de fora de propósito: ali a ação é internar alguém, e abrir um formulário
 * porque o dedo encostou no cartão vazio é o tipo de surpresa que ensina a ter medo da tela.
 */
.leito--clicavel {
  cursor: pointer;
}

.leito--clicavel:hover {
  --leito-sombra: var(--hc-sombra-alta);

  border-color: color-mix(in srgb, var(--hc-marca) 40%, var(--hc-borda));
}

.leito--livre,
.leito--inativo {
  justify-content: space-between;
  border-style: dashed;
  border-color: color-mix(in srgb, var(--hc-tinta-3) 45%, transparent);
  background: transparent;
  box-shadow: none;
}

.leito--inativo {
  background: var(--hc-linha);
  opacity: 0.7;
}

.leito__topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.leito__nome {
  color: var(--hc-tinta);
  font-size: 1rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: -0.01em;
}

/*
 * `position: static` e `overflow: visible` desfazem dois padrões do `.p-button`: com eles o
 * `::after` abaixo se ancoraria no próprio botão e seria recortado por ele, e o alvo estendido
 * voltaria a ser só o nome.
 */
.leito__paciente.p-button {
  position: static;
  min-width: 0;
  justify-content: flex-start;
  padding: 0;
  border: 0;
  overflow: visible;
  gap: 0.75rem;
  color: inherit;
  text-align: start;
}

/* O hover é do cartão inteiro (`.leito--clicavel:hover`); o fundo do botão de texto sobraria. */
.leito__paciente.p-button:not(:disabled):hover,
.leito__paciente.p-button:not(:disabled):active {
  background: transparent;
  color: inherit;
}

/*
 * O `::after` estende o botão por todo o cartão — a superfície inteira vira alvo sem duplicar o
 * `@click` no `<article>`, que dispararia duas vezes no clique sobre o nome.
 */
.leito__paciente::after {
  position: absolute;
  border-radius: 1rem;
  content: '';
  inset: 0;
}

.leito__paciente.p-button:focus-visible {
  outline: none;
  box-shadow: none;
}

/* O foco contorna o cartão, que é o que o clique de fato aciona — não só o nome. */
.leito__paciente:focus-visible::after {
  outline: 2px solid var(--hc-marca);
  outline-offset: 2px;
}

.leito__avatar {
  flex-shrink: 0;
}

.leito__identidade {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.leito__pet {
  overflow-wrap: anywhere;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  font-weight: 650;
  line-height: 1.25;
}

.leito__motivo {
  display: -webkit-box;
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.leito__cobrancas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
}

.leito__selo {
  gap: 0.3rem;
}

.leito__selo i {
  font-size: 0.72rem;
}

/* O boletim é o selo cheio: o coral invertido do bloco urgente da pauta. */
.leito__selo--boletim {
  background: var(--hc-coral-tinta);
  color: var(--hc-cartao);
  font-weight: 700;
}

.leito__rodape {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.9rem;
  margin: auto 0 0;
  padding-block-start: 0.7rem;
  border-block-start: 1px solid var(--hc-linha);
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.leito__rodape strong {
  color: var(--hc-tinta);
  font-weight: 650;
}

.leito__vazio {
  margin: auto 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  text-align: center;
}

.leito__internar {
  align-self: center;
}

@media (prefers-reduced-motion: reduce) {
  .leito {
    transition: none;
  }
}
</style>
