<script setup lang="ts">
/**
 * Hoje, versão **Foco**, no **design do app** (perfil de parceiro).
 *
 * O layout responde primeiro "quem eu atendo agora?" com um paciente só, grande, com o que se
 * precisa saber antes de abrir a porta. Embaixo, a fila numa lista só (recepção e depois os
 * horários) e, ao lado, o que pede ação.
 *
 * O desenho é o do petjourney-app (`docs/design/padrao-tutor.md` de lá), na cor do parceiro:
 *
 * - **Liso.** Fundo branco, sem sombra, sem cartão flutuando, sem degradê. O que separa é espaço,
 *   título de seção e régua fina na cor do perfil.
 * - **Destaque na cor do perfil.** O topo é um bloco sálvia (`#84A59D` escurecido para `#7C9B94`,
 *   o mínimo para o branco ler como título) com os rabiscos de traço branco e cantos de 28. O
 *   paciente da vez é o cartão de dentro, um tom mais fundo do mesmo matiz, como o pet na home.
 * - **Listas de ponta a ponta**, sem caixa, com a régua começando no texto.
 * - **Cor em véu**: botão secundário, ícone de pendência e "o que pede ação" em véu translúcido.
 *   Atenção é marinho sobre superfície fria, nunca pêssego; urgência é o vermelho do app.
 * - Readex Pro em tudo, peso máximo 700, título 26, seção 17, linha 15,5.
 */
import { PhInfo, PhWarning, PhWarningOctagon } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiRabiscos from '@/components/ui/UiRabiscos.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { MeuDia } from '@/features/clinico/composables/useMeuDia'
import type { Appointment } from '@/features/clinico/data/types'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

const props = defineProps<{ dia: MeuDia }>()

const { t } = useI18n()
const formato = useClinicFormat()

/** Quantos da fila aparecem antes do "mostrar mais": o que cabe numa tela de 900 px. */
const LIMITE_DA_FILA = 7
const LIMITE_DE_PENDENCIAS = 6

const filaAberta = ref(false)
const pendenciasAbertas = ref(false)

const destaque = computed(() => props.dia.destaque)
const petDoDestaque = computed(() => (destaque.value ? props.dia.pet(destaque.value.petId) : null))

/** Os outros que estão em sala: cabem no pé do destaque, não disputam com ele. */
const tambemNaSala = computed(() =>
  props.dia.emConsulta.filter((item) => item.id !== destaque.value?.id),
)

type Entrada = { item: Appointment; estado: 'espera' | 'marcado' }

/** A recepção e depois os horários, sem repetir quem já está no destaque. */
const fila = computed<Entrada[]>(() => [
  ...props.dia.naRecepcao
    .filter((item) => item.id !== destaque.value?.id)
    .map((item) => ({ item, estado: 'espera' as const })),
  ...props.dia.aSeguir
    .filter((item) => item.id !== destaque.value?.id)
    .map((item) => ({ item, estado: 'marcado' as const })),
])

const filaVisivel = computed(() =>
  filaAberta.value ? fila.value : fila.value.slice(0, LIMITE_DA_FILA),
)
const filaEscondida = computed(() => Math.max(0, fila.value.length - LIMITE_DA_FILA))

const pendenciasVisiveis = computed(() =>
  pendenciasAbertas.value
    ? props.dia.linhasDaPauta
    : props.dia.linhasDaPauta.slice(0, LIMITE_DE_PENDENCIAS),
)
const pendenciasEscondidas = computed(() =>
  Math.max(0, props.dia.linhasDaPauta.length - LIMITE_DE_PENDENCIAS),
)

/** A linha pequena do cartão do destaque: em que pé ele está. */
const estadoDoDestaque = computed(() => {
  const item = destaque.value

  if (!item) {
    return ''
  }

  if (item.status === 'em-atendimento') {
    return t('clinico.meuDia.versoes.estado.sala', {
      tempo: formato.duracao(props.dia.minutosDesde(item.iniciadoEm ?? item.inicio) ?? 0),
    })
  }

  if (item.status === 'aguardando') {
    return t('clinico.meuDia.versoes.estado.espera', {
      tempo: formato.duracao(props.dia.minutosDesde(item.chegadaEm) ?? 0),
    })
  }

  return t('clinico.meuDia.versoes.estado.marcado', { hora: formato.hora(item.inicio) })
})

const fatosDoDestaque = computed(() => {
  const item = destaque.value

  if (!item) {
    return []
  }

  return [
    { icone: 'ph ph-stethoscope', texto: props.dia.linhaDoAtendimento(item) },
    { icone: 'ph ph-door', texto: props.dia.salasDe(item) },
    { icone: 'ph ph-user', texto: props.dia.tutor(item.tutorId)?.nome ?? '' },
  ].filter((fato) => fato.texto)
})

const ICONE_DO_TOM = { risco: PhWarningOctagon, atencao: PhWarning, neutro: PhInfo }
</script>

<template>
  <UiPagina
    class="app-pj"
    :carregando="dia.carregando"
    :erro="dia.erro"
    bloquear-se-suspenso
    @tentar-de-novo="dia.carregar"
  >
    <!-- O destaque: o dia numa frase e, dentro, o paciente da vez. -->
    <template #cabecalho>
      <section class="destaque">
        <UiRabiscos />

        <div class="destaque__topo">
          <div class="destaque__textos">
            <p class="destaque__data">{{ dia.dataDeHoje }}</p>
            <h1 class="destaque__titulo">{{ dia.fraseDoResumo }}</h1>
            <p v-if="dia.andamentoDoDia" class="destaque__resumo">{{ dia.andamentoDoDia }}</p>
          </div>
          <RouterLink class="vidro" to="/veterinario/agenda">
            <i class="ph ph-calendar-blank" aria-hidden="true" />
            {{ t('clinico.meuDia.agendaCompleta') }}
          </RouterLink>
        </div>

        <article v-if="destaque && petDoDestaque" class="cartao" aria-labelledby="foco-agora-nome">
          <div class="cartao__quem">
            <span class="cartao__rosto">
              <PetAvatar
                :nome="petDoDestaque.nome"
                :iniciais="petDoDestaque.iniciais"
                :especie="petDoDestaque.especie"
                :foto-url="petDoDestaque.fotoUrl ?? ''"
                tamanho="lg"
              />
            </span>
            <div class="cartao__nome">
              <p class="cartao__rotulo">{{ t('clinico.meuDia.agora') }} · {{ estadoDoDestaque }}</p>
              <h2 id="foco-agora-nome">{{ petDoDestaque.nome }}</h2>
              <p>{{ dia.linhaDoPaciente(petDoDestaque) }}</p>
            </div>
          </div>

          <!-- Os fatos em vidro e, na mesma fileira, o alerta em papel branco: ele não pode sumir. -->
          <div class="cartao__fichas">
            <ul class="cartao__fatos">
              <li v-for="fato in fatosDoDestaque" :key="fato.icone">
                <i :class="fato.icone" aria-hidden="true" />
                {{ fato.texto }}
              </li>
            </ul>

            <ul
              v-if="dia.alertasRelevantes(petDoDestaque).length"
              class="cartao__alertas"
              :aria-label="t('clinico.hoje.alertas')"
            >
              <li
                v-for="alerta in dia.alertasRelevantes(petDoDestaque)"
                :key="alerta.id"
                :class="`cartao__alerta--${alerta.severidade}`"
              >
                <i class="ph ph-warning" aria-hidden="true" />
                {{ dia.textoDoAlerta(alerta) }}
              </li>
            </ul>
          </div>

          <div class="cartao__acoes">
            <Button
              v-if="dia.acaoPrincipal"
              type="button"
              class="botao-branco"
              icon="ph ph-stethoscope"
              :label="dia.acaoPrincipal.rotulo"
              @click="dia.abrirProntuario(dia.acaoPrincipal.item)"
            />
            <RouterLink class="vidro" :to="dia.rotaDoResumo(destaque)">
              <i class="ph ph-notepad" aria-hidden="true" />
              {{ t('clinico.resumoDoPaciente.verResumo') }}
            </RouterLink>

            <p v-if="tambemNaSala.length" class="cartao__tambem">
              <span>{{ t('clinico.meuDia.versoes.tambemNaSala') }}</span>
              <RouterLink
                v-for="item in tambemNaSala"
                :key="item.id"
                class="cartao__outro"
                :to="dia.rotaDoProntuario(item)"
              >
                {{ dia.pet(item.petId)?.nome }}
                <span class="cartao__outro-tempo">
                  {{ formato.duracao(dia.minutosDesde(item.iniciadoEm ?? item.inicio) ?? 0) }}
                </span>
              </RouterLink>
            </p>
          </div>
        </article>

        <p v-else class="destaque__vazio">{{ t('clinico.meuDia.versoes.ninguemAgora') }}</p>
      </section>
    </template>

    <div class="corpo-caixa">
      <div class="corpo">
        <!-- A fila: recepção e depois horários, de ponta a ponta, sem caixa. -->
        <section class="secao" aria-labelledby="foco-fila">
          <header class="secao__cabeca">
            <h2 id="foco-fila">{{ t('clinico.meuDia.versoes.fila') }}</h2>
            <span v-if="fila.length" class="contagem">{{ fila.length }}</span>
          </header>

          <ul v-if="fila.length" class="lista">
            <li
              v-for="{ item, estado } in filaVisivel"
              :key="item.id"
              class="linha"
              :class="`linha--${estado}`"
            >
              <RouterLink
                class="linha__toque"
                :to="estado === 'espera' ? dia.rotaDoProntuario(item) : dia.focoNaAgenda(item.id)"
              >
                <PetAvatar
                  :nome="dia.pet(item.petId)?.nome ?? ''"
                  :iniciais="dia.pet(item.petId)?.iniciais ?? ''"
                  :especie="dia.pet(item.petId)?.especie ?? null"
                  :foto-url="dia.pet(item.petId)?.fotoUrl ?? ''"
                  tamanho="md"
                />
                <span class="linha__texto">
                  <strong>{{ dia.pet(item.petId)?.nome }}</strong>
                  <span>{{ dia.linhaDoAtendimento(item) }}</span>
                  <span
                    v-if="dia.alertasRelevantes(dia.pet(item.petId)).length"
                    class="linha__alerta"
                  >
                    <i class="ph ph-warning" aria-hidden="true" />
                    {{
                      dia.alertasRelevantes(dia.pet(item.petId)).map(dia.textoDoAlerta).join(' · ')
                    }}
                  </span>
                </span>

                <span v-if="estado === 'espera'" class="pilula-fria">
                  {{
                    t('clinico.meuDia.versoes.estado.espera', {
                      tempo: formato.duracao(dia.minutosDesde(item.chegadaEm) ?? 0),
                    })
                  }}
                </span>
                <span v-else class="linha__hora">
                  <strong>{{ formato.hora(item.inicio) }}</strong>
                  <small>{{ formato.status(item.status) }}</small>
                </span>

                <i
                  v-if="estado !== 'espera'"
                  class="ph ph-caret-right linha__seta"
                  aria-hidden="true"
                />
              </RouterLink>

              <Button
                v-if="estado === 'espera'"
                type="button"
                size="small"
                severity="secondary"
                class="linha__chamar"
                icon="ph ph-door-open"
                :label="t('clinico.hoje.chamar')"
                @click="dia.abrirProntuario(item)"
              />
            </li>
          </ul>
          <p v-else class="vazio">{{ t('clinico.meuDia.semProximo') }}</p>

          <Button
            v-if="filaEscondida > 0"
            type="button"
            class="mais"
            text
            :icon="filaAberta ? 'ph ph-caret-up' : 'ph ph-caret-down'"
            :label="
              filaAberta
                ? t('clinico.meuDia.pauta.mostrarMenos')
                : t('clinico.meuDia.pauta.mostrarMais', { total: filaEscondida })
            "
            :aria-expanded="filaAberta"
            @click="filaAberta = !filaAberta"
          />
        </section>

        <!-- O que pede ação: um painel em véu, o único bloco com fundo da tela. -->
        <aside class="secao lado" aria-labelledby="foco-pendencias">
          <header class="secao__cabeca">
            <h2 id="foco-pendencias">{{ t('inicio.pauta.titulo') }}</h2>
            <span v-if="dia.linhasDaPauta.length" class="contagem">
              {{ dia.linhasDaPauta.length }}
            </span>
          </header>

          <div class="painel">
            <ul v-if="dia.linhasDaPauta.length" class="lista">
              <li v-for="linha in pendenciasVisiveis" :key="linha.id" class="linha">
                <RouterLink class="linha__toque" :to="linha.to">
                  <span class="icone-veu" :class="`icone-veu--${linha.tom}`" aria-hidden="true">
                    <component :is="ICONE_DO_TOM[linha.tom]" :size="22" weight="duotone" />
                  </span>
                  <span class="linha__texto">
                    <strong>
                      <span class="so-leitor">{{ t(`inicio.pauta.gravidade.${linha.tom}`) }}:</span>
                      {{ linha.frase }}
                    </strong>
                    <span class="linha__duas">
                      {{ [linha.detalhe, linha.onde].filter(Boolean).join(' · ') }}
                    </span>
                  </span>
                  <i class="ph ph-caret-right linha__seta" aria-hidden="true" />
                </RouterLink>
              </li>
            </ul>
            <p v-else class="vazio">{{ t('inicio.pauta.calma') }}</p>

            <Button
              v-if="pendenciasEscondidas > 0"
              type="button"
              class="mais"
              text
              :icon="pendenciasAbertas ? 'ph ph-caret-up' : 'ph ph-caret-down'"
              :label="
                pendenciasAbertas
                  ? t('clinico.meuDia.pauta.mostrarMenos')
                  : t('clinico.meuDia.pauta.mostrarMais', { total: pendenciasEscondidas })
              "
              :aria-expanded="pendenciasAbertas"
              @click="pendenciasAbertas = !pendenciasAbertas"
            />
          </div>
        </aside>
      </div>
    </div>

    <template #sempre>
      <slot name="sempre" />
    </template>
  </UiPagina>
</template>

<!-- O fundo da área de conteúdo é da página aberta: aqui, o branco liso do app. -->
<style>
.palco__conteudo:has(.app-pj) {
  background: #fff;
}

.app-dark .palco__conteudo:has(.app-pj) {
  background: #121917;
}
</style>

<style scoped>
/* ---------------------------------------------------------------- tokens do app (parceiro) */

.app-pj {
  --app-fundo: #fff;
  --app-destaque: #7c9b94;
  /* O cartão de dentro: marinho a 33% sobre o destaque (no app, 26%), para o texto pequeno passar. */
  --app-destaque-cartao: #5c7980;
  --app-vidro: rgb(0 0 0 / 13%);
  --app-vidro-forte: rgb(0 0 0 / 20%);
  --app-tinta: #1d3557;
  --app-texto-2: #666;
  --app-salvia: #84a59d;
  --app-salvia-texto: #5c736e;
  --app-botao: #627a74;
  --app-botao-hover: #586e68;
  --app-veu: rgb(132 165 157 / 9%);
  --app-veu-forte: rgb(132 165 157 / 15%);
  --app-regua: rgb(132 165 157 / 22%);
  --app-fria: #f0f0f0;
  --app-risco: #d32424;
  --app-risco-veu: rgb(242 132 130 / 15%);

  /* Readex nos números também, como no app. */
  --font-dados: var(--font-texto);

  /* Botões do app: cantos de 16, sem borda, sem sombra, peso 700. */
  --p-button-border-radius: 16px;
  --p-button-label-font-weight: 700;
  --p-button-primary-background: var(--app-botao);
  --p-button-primary-hover-background: var(--app-botao-hover);
  --p-button-primary-active-background: var(--app-botao-hover);
  --p-button-primary-border-color: var(--app-botao);
  --p-button-primary-hover-border-color: var(--app-botao-hover);
  --p-button-primary-active-border-color: var(--app-botao-hover);
  --p-button-primary-color: #fff;
  --p-button-primary-hover-color: #fff;
  --p-button-primary-active-color: #fff;
  --p-button-secondary-background: var(--app-veu);
  --p-button-secondary-hover-background: var(--app-veu-forte);
  --p-button-secondary-active-background: var(--app-veu-forte);
  --p-button-secondary-border-color: transparent;
  --p-button-secondary-hover-border-color: transparent;
  --p-button-secondary-active-border-color: transparent;
  --p-button-secondary-color: var(--app-salvia-texto);
  --p-button-secondary-hover-color: var(--app-salvia-texto);
  --p-button-secondary-active-color: var(--app-salvia-texto);
  --p-button-text-secondary-color: var(--app-salvia-texto);
  --p-button-text-primary-color: var(--app-salvia-texto);
  --p-button-text-primary-hover-background: var(--app-veu);
  --p-button-text-secondary-hover-background: var(--app-veu);

  color: var(--app-tinta);
  font-family: var(--font-texto);
}

/* O app não tem modo escuro; aqui ele existe, então o mesmo desenho com a luz apagada. */
.app-dark .app-pj {
  --app-fundo: #121917;
  --app-destaque: #56736c;
  --app-destaque-cartao: #3f5852;
  --app-tinta: #e6edeb;
  --app-texto-2: #a9b6b2;
  --app-salvia-texto: #a9c6be;
  --app-botao: #9dbdb5;
  --app-botao-hover: #b0cbc4;
  --app-veu: rgb(132 165 157 / 12%);
  --app-veu-forte: rgb(132 165 157 / 20%);
  --app-regua: rgb(255 255 255 / 9%);
  --app-fria: rgb(255 255 255 / 7%);
  --app-risco: #f4908a;
  --app-risco-veu: rgb(242 132 130 / 16%);
  --p-button-primary-color: #10302a;
  --p-button-primary-hover-color: #10302a;
  --p-button-primary-active-color: #10302a;
}

.app-pj .p-button {
  min-height: 44px;
  border-width: 0;
  background-image: none !important;
  box-shadow: none !important;
  font-weight: 700;
}

.app-pj .p-button.p-button-sm {
  min-height: 38px;
  border-radius: 12px;
}

/* ----------------------------------------------------------------------------- destaque */

.destaque {
  --rabiscos-forca: 0.2;

  position: relative;
  min-width: 0;
  flex: 1;
  display: grid;
  overflow: hidden;
  gap: 20px;
  padding: 24px 28px 28px;
  border-radius: 28px;
  background: var(--app-destaque);
  color: #fff;
  isolation: isolate;
}

.destaque__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px 24px;
}

.destaque__textos {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.destaque__data {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.destaque__titulo {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: 1.2;
  text-wrap: balance;
}

.destaque__resumo {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
}

.destaque__vazio {
  margin: 0;
  padding: 18px 20px;
  border-radius: 22px;
  background: var(--app-destaque-cartao);
  font-size: 15px;
}

/* O vidro do app: botão e etiqueta sobre a cor, escuro translúcido, sem borda. */
.vidro {
  display: inline-flex;
  min-height: 44px;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  border-radius: 16px;
  background: var(--app-vidro);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.vidro:hover {
  background: var(--app-vidro-forte);
}

.vidro:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.vidro i {
  font-size: 18px;
}

/* O paciente da vez: o cartão de dentro do destaque, como o pet na home do app. */
.cartao {
  display: grid;
  gap: 16px;
  padding: 20px 22px 22px;
  border-radius: 22px;
  background: var(--app-destaque-cartao);
}

.cartao__rotulo {
  margin: 0;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
}

.cartao__quem {
  display: flex;
  align-items: center;
  gap: 18px;
}

.cartao__rosto {
  display: grid;
  flex: none;
  padding: 3px;
  border-radius: 50%;
  background: rgb(255 255 255 / 90%);
}

.cartao__nome {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.cartao__nome h2 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: 1.15;
}

.cartao__nome p {
  margin: 0;
  font-size: 15px;
}

.cartao__fichas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cartao__fatos,
.cartao__alertas {
  display: contents;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cartao__fatos li {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--app-vidro);
  font-size: 14px;
  font-weight: 600;
}

/* O alerta sobre a cor: pílula branca com o texto no vermelho do app, para não sumir no vidro. */
.cartao__alertas li {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 4px 14px;
  border-radius: 999px;
  background: #fff;
  color: var(--app-tinta);
  font-size: 14px;
  font-weight: 700;
}

.cartao__alertas .cartao__alerta--risco {
  color: #d32424;
}

.app-dark .cartao__alertas li {
  background: #fff;
  color: #1d3557;
}

.app-dark .cartao__alertas .cartao__alerta--risco {
  color: #d32424;
}

.cartao__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
}

/* A ação principal sobre a cor: papel branco com a tinta do destaque. */
.app-pj .botao-branco {
  --p-button-primary-background: #fff;
  --p-button-primary-hover-background: #f1f5f4;
  --p-button-primary-active-background: #e7eeec;
  --p-button-primary-border-color: #fff;
  --p-button-primary-hover-border-color: #f1f5f4;
  --p-button-primary-active-border-color: #e7eeec;
  --p-button-primary-color: #3f5852;
  --p-button-primary-hover-color: #3f5852;
  --p-button-primary-active-color: #3f5852;

  min-height: 48px;
  padding-inline: 20px;
  font-size: 15px;
}

.cartao__tambem {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin: 0 0 0 auto;
  font-size: 14px;
}

.cartao__outro {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #fff;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: rgb(255 255 255 / 50%);
  text-underline-offset: 3px;
}

.cartao__outro-tempo {
  font-weight: 500;
}

/* -------------------------------------------------------------------------------- corpo */

.corpo {
  display: grid;
  align-items: start;
  gap: 36px 40px;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
  padding: 8px 0 72px;
}

.corpo-caixa {
  container: corpo-app / inline-size;
}

.secao {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.secao__cabeca {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 32px;
}

.secao__cabeca h2 {
  margin: 0;
  color: var(--app-tinta);
  font-size: 17px;
  font-weight: 700;
}

.contagem {
  display: inline-grid;
  min-width: 26px;
  height: 24px;
  padding: 0 8px;
  place-items: center;
  border-radius: 999px;
  background: var(--app-veu);
  color: var(--app-salvia-texto);
  font-size: 13px;
  font-weight: 700;
}

.lado {
  position: sticky;
  top: 20px;
}

/* ------------------------------------------------------------------- lista de ponta a ponta */

.lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.linha {
  position: relative;
  display: flex;
  align-items: center;
}

/* A régua do app começa no texto, não na borda: avatar de 40 mais o vão de 14. */
.linha + .linha::before {
  position: absolute;
  top: 0;
  right: 0;
  left: 54px;
  height: 1px;
  background: var(--app-regua);
  content: '';
}

.painel .linha + .linha::before {
  left: 70px;
}

.linha__toque {
  display: flex;
  min-width: 0;
  min-height: 72px;
  flex: 1;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-radius: 14px;
  color: var(--app-tinta);
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.linha__toque:hover {
  background: rgb(132 165 157 / 6%);
}

.linha__toque:focus-visible {
  outline: 2px solid var(--app-salvia-texto);
  outline-offset: 2px;
}

.linha__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.linha__texto strong {
  overflow: hidden;
  color: var(--app-tinta);
  font-size: 15.5px;
  font-weight: 600;
  line-height: 1.3;
  text-overflow: ellipsis;
}

.linha__texto > span {
  overflow: hidden;
  color: var(--app-texto-2);
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Alerta na linha: marinho, a cor de "atenção" do app; nunca pêssego. */
.linha .linha__alerta {
  display: block;
  color: var(--app-tinta);
  font-weight: 600;
}

.linha__alerta i {
  margin-inline-end: 4px;
  vertical-align: -2px;
}

.linha__duas {
  display: -webkit-box !important;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal !important;
}

.linha__hora {
  display: grid;
  flex: none;
  justify-items: end;
  line-height: 1.2;
}

.linha__hora strong {
  color: var(--app-tinta);
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.linha__hora small {
  color: var(--app-texto-2);
  font-size: 12.5px;
}

.linha__seta {
  flex: none;
  color: var(--app-texto-2);
  font-size: 18px;
}

/* Quem espera: a pílula fria do app (marinho sobre cinza frio) no lugar da hora. */
.pilula-fria {
  display: inline-flex;
  min-height: 28px;
  flex: none;
  align-items: center;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--app-fria);
  color: var(--app-tinta);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.linha__chamar {
  flex: none;
  margin-inline-start: 12px;
}

.mais {
  justify-self: start;
}

.vazio {
  margin: 0;
  padding: 22px 0;
  color: var(--app-texto-2);
  font-size: 14.5px;
}

/* ------------------------------------------------------------------------ painel em véu */

.painel {
  display: grid;
  padding: 6px 16px 8px;
  border-radius: 22px;
  background: var(--app-veu);
}

.painel .linha__toque {
  min-height: 0;
  align-items: flex-start;
  padding: 14px 0;
}

.painel .linha__seta {
  align-self: center;
}

.painel .vazio {
  padding: 18px 4px;
}

/* O quadradinho de ícone do app: 40 px, cantos de 13, ícone duotone sobre o véu do estado. */
.icone-veu {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  background: var(--app-fundo);
  color: var(--app-salvia-texto);
}

.icone-veu--risco {
  background: var(--app-risco-veu);
  color: var(--app-risco);
}

.icone-veu--atencao {
  background: var(--app-fria);
  color: var(--app-tinta);
}

.so-leitor {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ---------------------------------------------------------------------------- estreito */

@container corpo-app (max-width: 940px) {
  .corpo {
    grid-template-columns: minmax(0, 1fr);
  }

  .lado {
    position: static;
    order: -1;
  }
}

@media (max-width: 1100px) {
  .destaque {
    padding: 24px 22px 24px;
  }

  .cartao__tambem {
    margin-left: 0;
  }
}
</style>
