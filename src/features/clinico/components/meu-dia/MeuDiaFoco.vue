<script setup lang="ts">
/**
 * Hoje, versão **Foco**, no **design do app** (perfil de parceiro).
 *
 * A tela é a home do parceiro no app, trazida para a tela grande: a barra lateral de sempre,
 * vestida como o menu do app (o destaque sálvia em cima, os ícones em véu, o item aberto em
 * pílula cheia), e na folha branca o destaque na mesma cor. Nele, a frase do dia, os números em
 * vidro e o paciente da vez num cartão de papel branco, que salta da cor. Embaixo, a fila numa
 * lista lisa e, ao lado, o que pede ação num painel em véu. Tudo na largura inteira da folha.
 *
 * Regras do app (`docs/design/padrao-tutor.md`, no petjourney-app): tela branca e lisa, sem
 * sombra nem degradê; destaque na cor do perfil com texto branco; marinho só como tinta; cor em
 * véu; atenção é marinho sobre cinza frio, nunca pêssego; Readex, peso máximo 700, título 26,
 * seção 17, linha 15,5. Os tokens moram em `components/layout/moldura-app.css`.
 */
import { PhInfo, PhWarning, PhWarningOctagon } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import '@/components/layout/moldura-app.css'
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

/** Os outros que estão em sala: cabem no pé do cartão, não disputam com ele. */
const tambemNaSala = computed(() =>
  props.dia.emConsulta.filter((item) => item.id !== destaque.value?.id),
)

type Entrada = { item: Appointment; estado: 'espera' | 'marcado' }

/** A recepção e depois os horários, sem repetir quem já está no cartão. */
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

/** Os números do destaque, em vidro: os três que dizem como está a clínica agora. */
const numeros = computed(() =>
  props.dia.indicadores.filter((indicador) => indicador.id !== 'a-seguir'),
)

/** O estado do paciente da vez, na pílula em véu ao lado do nome. */
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
    <!-- O destaque, colado no cabeçalho: a frase do dia, os números e o paciente da vez. -->
    <template #cabecalho>
      <section class="destaque">
        <UiRabiscos />

        <div class="destaque__miolo">
          <div class="destaque__topo">
            <div class="destaque__textos">
              <h1>{{ dia.fraseDoResumo }}</h1>
              <p>{{ [dia.dataDeHoje, dia.andamentoDoDia].filter(Boolean).join(' · ') }}</p>
            </div>

            <ul class="numeros" :aria-label="t('clinico.meuDia.abertura.indicadores')">
              <li v-for="numero in numeros" :key="numero.id">
                <RouterLink class="numero" :to="numero.to ?? '/veterinario/agenda'">
                  <i :class="numero.icone" aria-hidden="true" />
                  <strong>{{ numero.valor }}</strong>
                  <span>{{ numero.rotulo }}</span>
                  <span v-if="numero.tom" class="numero__ponto" aria-hidden="true" />
                </RouterLink>
              </li>
            </ul>
          </div>

          <article
            v-if="destaque && petDoDestaque"
            class="cartao"
            aria-labelledby="foco-agora-nome"
          >
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
                <h2 id="foco-agora-nome">{{ petDoDestaque.nome }}</h2>
                <p>{{ dia.linhaDoPaciente(petDoDestaque) }}</p>
              </div>
              <span class="cartao__estado">
                <i class="ph ph-clock" aria-hidden="true" />
                {{ estadoDoDestaque }}
              </span>
            </div>

            <!-- Os fatos em véu e, na mesma fileira, o alerta no véu vermelho: ele não pode sumir. -->
            <ul class="cartao__fichas">
              <li v-for="fato in fatosDoDestaque" :key="fato.icone">
                <i :class="fato.icone" aria-hidden="true" />
                {{ fato.texto }}
              </li>
              <li
                v-for="alerta in dia.alertasRelevantes(petDoDestaque)"
                :key="alerta.id"
                class="cartao__alerta"
                :class="`cartao__alerta--${alerta.severidade}`"
              >
                <i class="ph ph-warning" aria-hidden="true" />
                {{ dia.textoDoAlerta(alerta) }}
              </li>
            </ul>

            <div class="cartao__acoes">
              <Button
                v-if="dia.acaoPrincipal"
                type="button"
                class="cartao__principal"
                icon="ph ph-stethoscope"
                :label="dia.acaoPrincipal.rotulo"
                @click="dia.abrirProntuario(dia.acaoPrincipal.item)"
              />
              <RouterLink class="cartao__secundario" :to="dia.rotaDoResumo(destaque)">
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
                  <span>
                    {{ formato.duracao(dia.minutosDesde(item.iniciadoEm ?? item.inicio) ?? 0) }}
                  </span>
                </RouterLink>
              </p>
            </div>
          </article>

          <p v-else class="cartao cartao--vazio">{{ t('clinico.meuDia.versoes.ninguemAgora') }}</p>
        </div>
      </section>
    </template>

    <div class="corpo">
      <!-- A fila: recepção e depois horários, de ponta a ponta, sem caixa. -->
      <section class="secao" aria-labelledby="foco-fila">
        <header class="secao__cabeca">
          <h2 id="foco-fila">{{ t('clinico.meuDia.versoes.fila') }}</h2>
          <span v-if="fila.length" class="contagem">{{ fila.length }}</span>
          <RouterLink class="secao__acao" to="/veterinario/agenda">
            {{ t('clinico.fila.aceite.verNaAgenda') }}
            <i class="ph ph-caret-right" aria-hidden="true" />
          </RouterLink>
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
              <!-- A hora no quadradinho em véu, como a lista de consultas da home do app. -->
              <span v-else class="linha__hora" :title="formato.status(item.status)">
                {{ formato.hora(item.inicio) }}
                <i
                  v-if="item.status === 'confirmado'"
                  class="ph ph-check"
                  :aria-label="formato.status(item.status)"
                />
              </span>
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

    <template #sempre>
      <slot name="sempre" />
    </template>
  </UiPagina>
</template>

<!-- Em tela estreita a moldura é a do portal: o fundo da área de conteúdo vira o branco do app. -->
<style>
.palco__conteudo:has(.app-pj) {
  background: var(--app-fundo, #fff);
}
</style>

<style scoped>
/* A folha na largura inteira da tela: nada de coluna centralizada com as bordas vazias. */
.app-pj.app-pj {
  max-width: none;
}

/* -------------------------------------------------------- botões do app (raio 16, peso 700) */

.app-pj {
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

  /* Readex nos números também, como no app. */
  --font-dados: var(--font-texto);

  color: var(--app-tinta);
  font-family: var(--font-texto);
}

.app-dark .app-pj {
  --p-button-primary-color: #10302a;
  --p-button-primary-hover-color: #10302a;
  --p-button-primary-active-color: #10302a;
}

.app-pj .p-button {
  min-height: 44px;
  border-width: 0;
  background-image: none !important;
  box-shadow: none !important;
}

.app-pj .p-button.p-button-sm {
  min-height: 38px;
  border-radius: 12px;
}

/* ------------------------------------------------------------------------------ destaque */

.destaque {
  --rabiscos-forca: 0.2;

  position: relative;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  border-radius: 28px;
  background: var(--app-destaque);
  color: #fff;
  isolation: isolate;
}

.destaque__miolo {
  display: grid;
  gap: 22px;
  padding: 26px 30px 30px;
}

/*
 * Na moldura do app o destaque vai de ponta a ponta da folha, colado no topo, só com os cantos de
 * baixo arredondados, como o topo da home do app. O miolo alinha com a margem da página.
 */
.shell--moldura-app .app-pj.app-pj {
  padding-top: 0;
}

.shell--moldura-app .destaque {
  margin-inline: calc(var(--pagina-margem) * -1);
  border-radius: 0 0 28px 28px;
}

.shell--moldura-app .destaque__miolo {
  padding: 32px var(--pagina-margem) 34px;
}

.destaque__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 18px 32px;
}

.destaque__textos {
  display: grid;
  min-width: 0;
  flex: 1 1 340px;
  gap: 4px;
}

.destaque__textos h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: 1.25;
  text-wrap: balance;
}

.destaque__textos p {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.4;
}

/* Os números do app: vidro sobre a cor, ícone, valor grande e rótulo curto. */
.numeros {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.numero {
  position: relative;
  display: grid;
  min-width: 112px;
  gap: 2px;
  padding: 12px 16px 13px;
  border-radius: 18px;
  background: var(--app-vidro);
  color: #fff;
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.numero:hover {
  background: var(--app-vidro-forte);
}

.numero:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.numero i {
  font-size: 18px;
}

.numero strong {
  font-size: 24px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1.15;
}

.numero span {
  font-size: 13px;
  font-weight: 600;
}

/* Número que é alerta: um ponto branco no canto, além da cor que não muda. */
.numero .numero__ponto {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
}

/* O paciente da vez: papel branco dentro do destaque, com a tinta do app. */
.cartao {
  display: grid;
  gap: 16px;
  margin: 0;
  padding: 20px 22px 22px;
  border-radius: 22px;
  background: var(--app-cartao);
  color: var(--app-tinta);
}

.cartao--vazio {
  font-size: 15px;
}

.cartao__quem {
  display: flex;
  align-items: center;
  gap: 16px;
}

.cartao__rosto {
  display: grid;
  flex: none;
  padding: 3px;
  border-radius: 50%;
  background: var(--app-veu-forte);
}

.cartao__nome {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.cartao__nome h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.5px;
  line-height: 1.15;
}

.cartao__nome p {
  margin: 0;
  color: var(--app-texto-2);
  font-size: 14.5px;
}

.cartao__estado {
  display: inline-flex;
  min-height: 34px;
  flex: none;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--app-veu-forte);
  color: var(--app-salvia-texto);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.cartao__fichas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cartao__fichas li {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 4px 14px;
  border-radius: 999px;
  background: var(--app-veu);
  color: var(--app-salvia-texto);
  font-size: 14px;
  font-weight: 600;
}

/* O alerta: atenção é marinho sobre cinza frio; risco, o vermelho do app no véu dele. */
.cartao__fichas .cartao__alerta {
  background: var(--app-fria);
  color: var(--app-tinta);
  font-weight: 700;
}

.cartao__fichas .cartao__alerta--risco {
  background: var(--app-risco-veu);
  color: var(--app-risco);
}

.cartao__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

/* A ação principal é o botão cheio do app; a de apoio, o mesmo tamanho em véu. */
.app-pj .cartao__principal {
  min-height: 48px;
  padding-inline: 20px;
  font-size: 15px;
}

.cartao__secundario {
  display: inline-flex;
  min-height: 48px;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 0 18px;
  border-radius: 16px;
  background: var(--app-veu);
  color: var(--app-salvia-texto);
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.cartao__secundario:hover {
  background: var(--app-veu-forte);
}

.cartao__secundario:focus-visible {
  outline: 2px solid var(--app-tinta);
  outline-offset: 2px;
}

.cartao__secundario i {
  font-size: 18px;
}

.cartao__tambem {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin: 0 0 0 auto;
  color: var(--app-texto-2);
  font-size: 14px;
}

.cartao__outro {
  color: var(--app-tinta);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: var(--app-regua);
  text-underline-offset: 3px;
}

.cartao__outro span {
  font-weight: 500;
}

/* -------------------------------------------------------------------------------- corpo */

.corpo {
  display: grid;
  align-items: start;
  gap: 36px 40px;
  grid-template-columns: minmax(0, 1fr) clamp(320px, 32%, 560px);
  padding: 12px 0 0;
}

.secao {
  display: grid;
  min-width: 0;
  gap: 6px;
}

.secao__cabeca {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
}

.secao__cabeca h2 {
  margin: 0;
  color: var(--app-tinta);
  font-size: 17px;
  font-weight: 700;
}

.secao__acao {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-inline-start: auto;
  border-radius: 8px;
  color: var(--app-salvia-texto);
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.secao__acao:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.secao__acao:focus-visible {
  outline: 2px solid var(--app-salvia-texto);
  outline-offset: 2px;
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
  left: 54px;
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
  background: var(--app-toque);
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

/* A hora no quadradinho em véu, como a lista de consultas da home do app. */
.linha__hora {
  display: inline-flex;
  min-width: 64px;
  height: 40px;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 10px;
  border-radius: 13px;
  background: var(--app-veu);
  color: var(--app-salvia-texto);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.linha__seta {
  flex: none;
  color: var(--app-texto-2);
  font-size: 18px;
}

/* Quem espera: a pílula fria do app (marinho sobre cinza frio) no lugar da hora. */
.pilula-fria {
  display: inline-flex;
  min-height: 30px;
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

@media (max-width: 1180px) {
  .corpo {
    grid-template-columns: minmax(0, 1fr);
  }

  .lado {
    position: static;
    order: -1;
  }

  .destaque__miolo {
    padding-inline: 22px;
  }

  .cartao__tambem {
    margin-left: 0;
  }
}

@media (max-width: 760px) {
  .cartao__quem {
    flex-wrap: wrap;
  }
}
</style>
