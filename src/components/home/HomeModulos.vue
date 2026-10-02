<script setup lang="ts">
/**
 * Módulos: o "Projects" do Prodify, com as áreas da casa.
 *
 * Uma grade de dois por dois. Cada bloco tem o ícone num quadrado colorido, o nome e uma linha de
 * contexto com números de verdade — atendimentos de hoje, hóspedes na casa, assuntos na pauta. O
 * primeiro bloco, tracejado, é o "Create new project" de lá: aqui, agendar um atendimento.
 */
import {
  PhHouseLine,
  PhMegaphone,
  PhPlus,
  PhSquaresFour,
  PhStethoscope,
  PhUsersThree,
} from '@phosphor-icons/vue'
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'

import { usePautaDaHome } from './usePautaDaHome'
import { useDiaDaCasa } from './useLinhaDoDia'

const props = defineProps<{ clinica: boolean; hotel: boolean }>()

const { t } = useI18n()
const dia = useDiaDaCasa()
const { modulos } = usePautaDaHome()
const { store } = useParceiroPortal()

type Bloco = {
  id: string
  rotulo: string
  detalhe: string
  to: string
  icone: Component
  cor: 'ciano' | 'lilas' | 'pessego' | 'verde' | 'azul'
  novo?: boolean
}

function assuntosDo(id: 'clinica' | 'hotel') {
  const modulo = modulos.value.find((item) => item.id === id)

  if (!modulo?.carregado) return ''

  const total = modulo.linhas.length

  return t('inicio.pauta.contagem', { total }, total)
}

function juntar(partes: string[]) {
  return partes.filter(Boolean).join(' • ')
}

const blocos = computed<Bloco[]>(() => {
  const lista: Bloco[] = []

  if (props.clinica) {
    lista.push({
      id: 'novo',
      rotulo: t('inicio.modulos.novoAgendamento'),
      detalhe: t('inicio.modulos.novoAgendamentoDetalhe'),
      to: '/veterinario/agenda',
      icone: PhPlus,
      cor: 'ciano',
      novo: true,
    })

    const agenda = dia.clinica.value
    const atendimentos =
      agenda.carga === 'pronta'
        ? t(
            'inicio.modulos.atendimentosHoje',
            { total: agenda.contas.length },
            agenda.contas.length,
          )
        : ''

    lista.push({
      id: 'clinica',
      rotulo: t('clinico.navegacao.secao'),
      detalhe: juntar([atendimentos, assuntosDo('clinica')]),
      to: '/veterinario/meu-dia',
      icone: PhStethoscope,
      cor: 'ciano',
    })
  }

  if (props.hotel) {
    const casa = dia.hotel.value
    const hospedes =
      casa.carga === 'pronta'
        ? t('inicio.modulos.hospedes', { total: casa.hospedes }, casa.hospedes)
        : ''

    lista.push({
      id: 'hotel',
      rotulo: t('hotel.navegacao.secao'),
      detalhe: juntar([hospedes, assuntosDo('hotel')]),
      to: '/hotel/painel',
      icone: PhHouseLine,
      cor: 'lilas',
    })
  }

  lista.push({
    id: 'divulgacao',
    rotulo: t('nav.items.divulgacao'),
    detalhe: t('inicio.modulos.divulgacaoDetalhe'),
    to: '/parceiro/divulgacao',
    icone: PhMegaphone,
    cor: 'pessego',
  })

  const status = store.status?.afiliado.status ?? 'NAO_SOLICITADO'

  lista.push({
    id: 'programas',
    rotulo: t('nav.items.programas'),
    detalhe: t('inicio.modulos.programasDetalhe', {
      status: t(`inicio.programa.selo.${status}`),
    }),
    to: '/parceiro/programas',
    icone: PhSquaresFour,
    cor: 'verde',
  })

  lista.push({
    id: 'acessos',
    rotulo: t('nav.items.acessos'),
    detalhe: t('inicio.modulos.acessosDetalhe'),
    to: '/parceiro/acessos',
    icone: PhUsersThree,
    cor: 'azul',
  })

  return lista.slice(0, 4)
})
</script>

<template>
  <section class="hc modulos" aria-labelledby="home-modulos-titulo">
    <header class="hc__cabeca">
      <h2 id="home-modulos-titulo" class="hc__titulo">
        <PhSquaresFour class="hc__icone" aria-hidden="true" />
        {{ t('inicio.modulos.titulo') }}
      </h2>
      <span class="modulos__rotulo">{{ t('inicio.modulos.rotulo') }}</span>
    </header>

    <ul class="modulos__grade">
      <li v-for="bloco in blocos" :key="bloco.id">
        <RouterLink class="bloco" :class="{ 'bloco--novo': bloco.novo }" :to="bloco.to">
          <span class="bloco__icone" :class="`bloco__icone--${bloco.cor}`" aria-hidden="true">
            <component :is="bloco.icone" :weight="bloco.novo ? 'bold' : 'fill'" />
          </span>
          <span class="bloco__texto">
            <span class="bloco__rotulo">{{ bloco.rotulo }}</span>
            <span v-if="bloco.detalhe" class="bloco__detalhe" :title="bloco.detalhe">{{
              bloco.detalhe
            }}</span>
          </span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.modulos {
  gap: 0.75rem;
}

.modulos__rotulo {
  color: var(--hc-tinta-3);
  font-size: 0.8125rem;
}

.modulos__grade {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bloco {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.5rem;
  border-radius: 0.75rem;
  color: var(--hc-tinta);
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.bloco:hover {
  background: var(--hc-fundo);
}

.bloco:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: 1px;
}

.bloco__icone {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  inline-size: 2.4rem;
  block-size: 2.4rem;
  border-radius: 0.7rem;
  color: #ffffff;
  font-size: 1.2rem;
}

.bloco__icone :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}

/* Os quadrados coloridos do "Projects", um por área — tons cheios da paleta, ícone branco. */
.bloco__icone--ciano {
  background: linear-gradient(135deg, #3fb6ae, #1f8a83);
}

.bloco__icone--lilas {
  background: linear-gradient(135deg, #9d8cf0, #6a58d6);
}

.bloco__icone--pessego {
  background: linear-gradient(135deg, #f7b27d, #e8834a);
}

.bloco__icone--verde {
  background: linear-gradient(135deg, #6cc9a0, #2f9c6c);
}

.bloco__icone--azul {
  background: linear-gradient(135deg, #7fa6f5, #4b72d8);
}

/* O "Create new project": quadrado tracejado, ícone na cor da marca. */
.bloco--novo .bloco__icone {
  border: 1.5px dashed var(--hc-marca);
  background: var(--hc-marca-clara);
  color: var(--hc-marca);
}

.bloco__texto {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.bloco__rotulo {
  overflow: hidden;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bloco__detalhe {
  overflow: hidden;
  color: var(--hc-tinta-3);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .bloco {
    transition: none;
  }
}
</style>
