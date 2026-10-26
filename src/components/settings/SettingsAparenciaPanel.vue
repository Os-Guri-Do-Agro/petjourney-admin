<script setup lang="ts">
/**
 * Configurações → Aparência: como o portal se mostra para quem está usando.
 *
 * Tudo aqui é preferência de exibição — muda na hora, fica neste navegador, não passa pela API e
 * por isso não tem "Salvar": o rodapé diz isso no lugar do botão.
 *
 * - **Tema** claro ou escuro (também no menu da pessoa, no pé da barra).
 * - **Navegação**, a barra lateral em quatro escolhas, com uma prévia só que muda junto com elas:
 *   a largura (larga, só ícones, ou automática pela largura da tela), os espaços (todos abertos ou
 *   só o da tela), a altura das linhas e o aviso de pendência (número ou ponto). Antes eram duas
 *   escolhas soltas com uma miniatura cada — e a da barra nem valia mais na moldura do app.
 * - **Explicações**: o texto de apoio das telas do Portal, o mesmo do botão "Mostrar explicações".
 * - **Idioma** da interface (também no menu da pessoa).
 *
 * Tema e navegação mostram o portal em miniatura, não um rótulo: "todos os espaços abertos" é
 * difícil de imaginar por nome, e ninguém precisa escolher às cegas.
 */
import RadioButton from 'primevue/radiobutton'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import flagAE from 'country-flag-icons/string/3x2/AE'
import flagBR from 'country-flag-icons/string/3x2/BR'
import flagES from 'country-flag-icons/string/3x2/ES'
import flagGB from 'country-flag-icons/string/3x2/GB'
import flagRS from 'country-flag-icons/string/3x2/RS'
import flagUS from 'country-flag-icons/string/3x2/US'

import SettingsLayoutMockup from '@/components/settings/SettingsLayoutMockup.vue'
import {
  isGuidanceVisible,
  NAVIGATOR_AUTO_MIN_WIDTH,
  navigatorBadges,
  navigatorDensity,
  navigatorMode,
  navigatorWidth,
  setNavigatorBadges,
  setNavigatorDensity,
  setNavigatorMode,
  setNavigatorWidth,
  toggleGuidance,
  type NavigatorBadges,
  type NavigatorDensity,
  type NavigatorMode,
  type NavigatorWidth,
} from '@/composables/useLayoutPreferences'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { changeLocale } from '@/i18n'
import { LOCALES, type Locale } from '@/i18n/locales'
import { colorMode } from '@/theme/color-mode'
import type { ThemeMode } from '@/theme/colors'

import './configuracoes.css'

const { t, locale } = useI18n()

type Maquete = { tema?: 'claro' | 'escuro' | 'atual' }

type Opcao<T extends string> = {
  valor: T
  label: string
  hint: string
  maquete: Maquete
}

const temas = computed<Opcao<ThemeMode>[]>(() => [
  {
    valor: 'light',
    label: t('settings.aparencia.tema.claro.label'),
    hint: t('settings.aparencia.tema.claro.hint'),
    maquete: { tema: 'claro' },
  },
  {
    valor: 'dark',
    label: t('settings.aparencia.tema.escuro.label'),
    hint: t('settings.aparencia.tema.escuro.hint'),
    maquete: { tema: 'escuro' },
  },
])

/** Uma escolha da navegação em linha: o ícone diz o que muda, o texto diz como. */
type Escolha<T extends string> = { valor: T; label: string; hint: string; icone: string }

const larguras = computed<Escolha<NavigatorWidth>[]>(() =>
  (
    [
      ['larga', 'ph ph-sidebar'],
      ['icones', 'ph ph-sidebar-simple'],
      ['auto', 'ph ph-arrows-horizontal'],
    ] as const
  ).map(([valor, icone]) => ({
    valor,
    icone,
    label: t(`settings.aparencia.navegacao.largura.${valor}.label`),
    hint: t(`settings.aparencia.navegacao.largura.${valor}.hint`, {
      largura: NAVIGATOR_AUTO_MIN_WIDTH,
    }),
  })),
)

const modos = computed<Escolha<NavigatorMode>[]>(() =>
  (
    [
      ['lista', 'ph ph-rows'],
      ['secoes', 'ph ph-crosshair-simple'],
    ] as const
  ).map(([valor, icone]) => ({
    valor,
    icone,
    label: t(`settings.aparencia.navegacao.espacos.${valor}.label`),
    hint: t(`settings.aparencia.navegacao.espacos.${valor}.hint`),
  })),
)

const densidades = computed<Array<{ valor: NavigatorDensity; label: string }>>(() => [
  { valor: 'confortavel', label: t('settings.aparencia.densidade.confortavel.label') },
  { valor: 'compacta', label: t('settings.aparencia.densidade.compacta.label') },
])

const avisos = computed<Array<{ valor: NavigatorBadges; label: string }>>(() => [
  { valor: 'numero', label: t('settings.aparencia.navegacao.avisos.numero') },
  { valor: 'ponto', label: t('settings.aparencia.navegacao.avisos.ponto') },
])

const dicaDaDensidade = computed(() =>
  navigatorDensity.value === 'compacta'
    ? t('settings.aparencia.densidade.compacta.hintBarra')
    : t('settings.aparencia.densidade.confortavel.hint'),
)

const dicaDosAvisos = computed(() =>
  t(`settings.aparencia.navegacao.avisos.${navigatorBadges.value}Dica`),
)

/** A automática, na prévia, aparece como fica nesta tela agora. */
const telaParaBarraLarga = useTelaLarga(NAVIGATOR_AUTO_MIN_WIDTH)

const larguraNaPrevia = computed(() =>
  navigatorWidth.value === 'icones' ||
  (navigatorWidth.value === 'auto' && !telaParaBarraLarga.value)
    ? 'icones'
    : 'larga',
)

const legendaDaPrevia = computed(() =>
  navigatorWidth.value === 'auto'
    ? t(
        larguraNaPrevia.value === 'icones'
          ? 'settings.aparencia.navegacao.previaAutoIcones'
          : 'settings.aparencia.navegacao.previaAutoLarga',
      )
    : t('settings.aparencia.navegacao.previa'),
)

/** A bandeira só ilumina; o nome de cada idioma vai escrito nele mesmo. */
const BANDEIRA: Record<Locale, string> = {
  pt: flagBR,
  en: flagUS,
  'en-GB': flagGB,
  es: flagES,
  sr: flagRS,
  ar: flagAE,
}

const NOME_NATIVO: Record<Locale, string> = {
  pt: 'Português',
  en: 'English (US)',
  'en-GB': 'English (UK)',
  es: 'Español',
  sr: 'Srpski',
  ar: 'العربية',
}

const idiomas = computed(() =>
  LOCALES.map((codigo) => ({ codigo, bandeira: BANDEIRA[codigo], nome: NOME_NATIVO[codigo] })),
)

function escolherIdioma(codigo: Locale) {
  if (codigo !== locale.value) {
    void changeLocale(codigo)
  }
}

function alternarExplicacoes(ligado: boolean) {
  if (ligado !== isGuidanceVisible.value) {
    toggleGuidance()
  }
}
</script>

<template>
  <div class="ui-folha cfg-folha aparencia">
    <section class="cfg-secao" aria-labelledby="aparencia-tema-titulo">
      <header class="cfg-secao__cabeca">
        <span class="ui-ladrilho cfg-secao__ladrilho" aria-hidden="true">
          <i class="ph ph-circle-half" />
        </span>
        <h3 id="aparencia-tema-titulo" class="cfg-secao__titulo">
          {{ t('settings.aparencia.tema.titulo') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('settings.aparencia.tema.ondeMais') }}</p>
      </header>

      <div class="cfg-secao__corpo opcoes" role="radiogroup" aria-labelledby="aparencia-tema-titulo">
        <label
          v-for="opcao in temas"
          :key="opcao.valor"
          class="opcao"
          :class="{ 'opcao--ativa': colorMode === opcao.valor }"
        >
          <SettingsLayoutMockup
            v-bind="opcao.maquete"
            :largura="larguraNaPrevia"
            :todos="navigatorMode === 'lista'"
            :densa="navigatorDensity === 'compacta'"
            :selo="navigatorBadges"
          />
          <span class="opcao__pe">
            <RadioButton
              v-model="colorMode"
              :input-id="`aparencia-tema-${opcao.valor}`"
              name="aparencia-tema"
              :value="opcao.valor"
            />
            <span class="opcao__texto">
              <strong>{{ opcao.label }}</strong>
              <small>{{ opcao.hint }}</small>
            </span>
          </span>
        </label>
      </div>
    </section>

    <section class="cfg-secao" aria-labelledby="aparencia-navegacao-titulo">
      <header class="cfg-secao__cabeca">
        <span class="ui-ladrilho cfg-secao__ladrilho" aria-hidden="true">
          <i class="ph ph-sidebar" />
        </span>
        <h3 id="aparencia-navegacao-titulo" class="cfg-secao__titulo">
          {{ t('settings.aparencia.navegacao.titulo') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('settings.aparencia.navegacao.descricao') }}</p>
      </header>

      <div class="cfg-secao__corpo navegacao">
        <!-- A prévia junta as quatro escolhas: muda junto, antes de a pessoa sair daqui. -->
        <figure class="navegacao__previa">
          <SettingsLayoutMockup
            :largura="larguraNaPrevia"
            :todos="navigatorMode === 'lista'"
            :densa="navigatorDensity === 'compacta'"
            :selo="navigatorBadges"
          />
          <figcaption class="navegacao__legenda">
            <i class="ph ph-eye" aria-hidden="true" />
            {{ legendaDaPrevia }}
          </figcaption>
        </figure>

        <div class="navegacao__grupos">
          <fieldset class="grupo">
            <legend class="grupo__titulo">
              {{ t('settings.aparencia.navegacao.largura.titulo') }}
            </legend>
            <div class="escolhas">
              <label
                v-for="opcao in larguras"
                :key="opcao.valor"
                class="escolha"
                :class="{ 'escolha--ativa': navigatorWidth === opcao.valor }"
              >
                <RadioButton
                  :input-id="`aparencia-largura-${opcao.valor}`"
                  name="aparencia-largura"
                  :value="opcao.valor"
                  :model-value="navigatorWidth"
                  @update:model-value="setNavigatorWidth(opcao.valor)"
                />
                <i class="escolha__icone" :class="opcao.icone" aria-hidden="true" />
                <span class="escolha__texto">
                  <strong>{{ opcao.label }}</strong>
                  <small>{{ opcao.hint }}</small>
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset class="grupo">
            <legend class="grupo__titulo">
              {{ t('settings.aparencia.navegacao.espacos.titulo') }}
            </legend>
            <div class="escolhas">
              <label
                v-for="opcao in modos"
                :key="opcao.valor"
                class="escolha"
                :class="{ 'escolha--ativa': navigatorMode === opcao.valor }"
              >
                <RadioButton
                  :input-id="`aparencia-menu-${opcao.valor}`"
                  name="aparencia-menu"
                  :value="opcao.valor"
                  :model-value="navigatorMode"
                  @update:model-value="setNavigatorMode(opcao.valor)"
                />
                <i class="escolha__icone" :class="opcao.icone" aria-hidden="true" />
                <span class="escolha__texto">
                  <strong>{{ opcao.label }}</strong>
                  <small>{{ opcao.hint }}</small>
                </span>
              </label>
            </div>
          </fieldset>

          <div class="grupo-par">
            <fieldset class="grupo">
              <legend id="aparencia-densidade-titulo" class="grupo__titulo">
                {{ t('settings.aparencia.navegacao.densidade.titulo') }}
              </legend>
              <SelectButton
                :model-value="navigatorDensity"
                :options="densidades"
                option-label="label"
                option-value="valor"
                :allow-empty="false"
                aria-labelledby="aparencia-densidade-titulo"
                @update:model-value="setNavigatorDensity"
              />
              <small class="grupo__ajuda">{{ dicaDaDensidade }}</small>
            </fieldset>

            <fieldset class="grupo">
              <legend id="aparencia-avisos-titulo" class="grupo__titulo">
                {{ t('settings.aparencia.navegacao.avisos.titulo') }}
              </legend>
              <SelectButton
                :model-value="navigatorBadges"
                :options="avisos"
                option-label="label"
                option-value="valor"
                :allow-empty="false"
                aria-labelledby="aparencia-avisos-titulo"
                @update:model-value="setNavigatorBadges"
              />
              <small class="grupo__ajuda">{{ dicaDosAvisos }}</small>
            </fieldset>
          </div>
        </div>
      </div>
    </section>

    <section class="cfg-secao" aria-labelledby="aparencia-explicacoes-titulo">
      <header class="cfg-secao__cabeca">
        <span class="ui-ladrilho cfg-secao__ladrilho" aria-hidden="true">
          <i class="ph ph-info" />
        </span>
        <h3 id="aparencia-explicacoes-titulo" class="cfg-secao__titulo">
          {{ t('settings.aparencia.explicacoes.titulo') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('settings.aparencia.explicacoes.descricao') }}</p>
      </header>

      <div class="cfg-secao__corpo">
        <label class="interruptor" for="aparencia-explicacoes">
          <span class="interruptor__texto">
            <strong>{{ t('shell.guidance.show') }}</strong>
            <small>{{ t('settings.aparencia.explicacoes.ajuda') }}</small>
          </span>
          <ToggleSwitch
            input-id="aparencia-explicacoes"
            :model-value="isGuidanceVisible"
            @update:model-value="alternarExplicacoes"
          />
        </label>
      </div>
    </section>

    <section class="cfg-secao" aria-labelledby="aparencia-idioma-titulo">
      <header class="cfg-secao__cabeca">
        <span class="ui-ladrilho cfg-secao__ladrilho" aria-hidden="true">
          <i class="ph ph-translate" />
        </span>
        <h3 id="aparencia-idioma-titulo" class="cfg-secao__titulo">
          {{ t('settings.conta.prefs.title') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('settings.conta.prefs.subtitle') }}</p>
      </header>

      <div
        class="cfg-secao__corpo idiomas"
        role="radiogroup"
        aria-labelledby="aparencia-idioma-titulo"
      >
        <label
          v-for="idioma in idiomas"
          :key="idioma.codigo"
          class="idioma"
          :class="{ 'idioma--ativo': locale === idioma.codigo }"
          :lang="idioma.codigo"
        >
          <RadioButton
            :input-id="`aparencia-idioma-${idioma.codigo}`"
            name="aparencia-idioma"
            :value="idioma.codigo"
            :model-value="locale"
            @update:model-value="escolherIdioma(idioma.codigo)"
          />
          <span class="idioma__bandeira" aria-hidden="true" v-html="idioma.bandeira" />
          <span class="idioma__nome" dir="auto">{{ idioma.nome }}</span>
        </label>
      </div>
    </section>

    <footer class="cfg-rodape">
      <p class="cfg-rodape__nota">
        <i class="ph ph-check-circle" aria-hidden="true" />
        {{ t('settings.aparencia.naHora') }}
      </p>
    </footer>
  </div>
</template>

<style scoped>
/* ------------------------------------------------------------------ opções com miniatura */

.opcoes {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  container: opcoes / inline-size;
}

/*
 * A opção inteira é o `<label>` do rádio: clicar na miniatura marca a opção, e o rádio embaixo é
 * o controle de verdade (teclado, leitor de tela e estado marcado).
 */
.opcao {
  display: grid;
  /* O cartão estica até a altura do vizinho; a sobra vai para o fim, não para entre as linhas,
     senão o rádio do cartão de texto mais curto desce e as duas opções desalinham. */
  align-content: start;
  gap: 12px;
  padding: 10px 10px 14px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  cursor: pointer;
  transition:
    border-color var(--pj-tempo-curto) var(--pj-curva-chega),
    box-shadow var(--pj-tempo-curto) var(--pj-curva-chega);
}

.opcao:hover {
  border-color: var(--linha-forte);
}

/* Em uso: borda de musgo dupla — estado, não convite. */
.opcao--ativa,
.opcao--ativa:hover {
  border-color: var(--musgo);
  box-shadow: 0 0 0 1px var(--musgo);
}

.opcao:has(.p-radiobutton-input:focus-visible) {
  outline: 2px solid var(--musgo);
  outline-offset: 3px;
}

.opcao__pe {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-inline: 4px;
}

.opcao__pe :deep(.p-radiobutton) {
  flex: none;
  margin-top: 1px;
}

.opcao__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.opcao__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.opcao__texto small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

/*
 * Estreito (celular): as duas opções uma embaixo da outra, cada uma deitada — a miniatura à
 * esquerda e o texto ao lado —, para a escolha caber na tela sem rolar três miniaturas inteiras.
 */
@container opcoes (max-width: 27rem) {
  .opcao {
    align-items: start;
    padding: 10px;
    grid-template-columns: 7rem minmax(0, 1fr);
  }

  .opcao__pe {
    padding-inline: 0;
  }
}

/* ------------------------------------------------------------------ navegação */

/*
 * Em folha larga, a prévia à esquerda, presa no alto enquanto as escolhas rolam ao lado; mais
 * estreita, ela fica em cima delas.
 */
.navegacao {
  align-items: start;
  gap: 24px;
}

.navegacao__previa {
  display: grid;
  gap: 10px;
  max-width: 34rem;
  margin: 0;
}

/* Mais alta que as do tema: cabe a barra com os três espaços abertos. */
.navegacao__previa :deep(.maquete) {
  aspect-ratio: 5 / 4;
}

@container cfg-folha (min-width: 980px) {
  .navegacao {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  }

  .navegacao__previa {
    position: sticky;
    top: 16px;
  }
}

.navegacao__legenda {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
}

.navegacao__grupos {
  display: grid;
  min-width: 0;
  gap: 22px;
}

.grupo {
  display: grid;
  min-width: 0;
  gap: 10px;
  margin: 0;
  padding: 0;
  border: 0;
}

.grupo__titulo {
  margin-bottom: 2px;
  padding: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 700;
}

.grupo__ajuda {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.45;
}

.grupo-par {
  display: grid;
  gap: 22px 18px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
}

.grupo :deep(.p-selectbutton) {
  display: flex;
  width: 100%;
}

.grupo :deep(.p-togglebutton) {
  flex: 1;
}

/*
 * Cada escolha numa linha: o rádio, o ícone do que muda e o texto. A linha inteira é o `<label>`,
 * e a marcada ganha o véu e a borda da sálvia.
 */
.escolhas {
  display: grid;
  gap: 6px;
}

.escolha {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  cursor: pointer;
  transition:
    border-color var(--pj-tempo-curto) var(--pj-curva-chega),
    background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.escolha:hover {
  border-color: var(--linha-forte);
}

/* Marcada: o véu da sálvia e a borda dela, em tom pastel. */
.escolha--ativa,
.escolha--ativa:hover {
  border-color: var(--app-salvia, var(--musgo));
  background: var(--app-veu-forte, var(--musgo-fundo));
}

.escolha:has(.p-radiobutton-input:focus-visible) {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.escolha :deep(.p-radiobutton) {
  flex: none;
}

.escolha__icone {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 18px;
}

.escolha--ativa .escolha__icone {
  background: var(--superficie);
  color: var(--app-salvia-texto, var(--musgo));
}

.escolha__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.escolha__texto strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.escolha__texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
}

/* ------------------------------------------------------------------ interruptor */

.interruptor {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  cursor: pointer;
}

.interruptor__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.interruptor__texto strong {
  font-size: 14.5px;
  font-weight: 600;
}

.interruptor__texto small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.interruptor :deep(.p-toggleswitch) {
  flex: none;
}

/* ------------------------------------------------------------------ idiomas */

.idiomas {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 12rem), 1fr));
}

.idioma {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.idioma:hover {
  border-color: var(--linha-forte);
}

.idioma--ativo,
.idioma--ativo:hover {
  border-color: var(--musgo);
  background: var(--musgo-fundo);
}

.idioma:has(.p-radiobutton-input:focus-visible) {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.idioma :deep(.p-radiobutton) {
  flex: none;
}

.idioma__bandeira {
  display: inline-flex;
  width: 24px;
  height: 16px;
  flex: none;
  overflow: hidden;
  border-radius: 3px;
  box-shadow: 0 0 0 1px var(--linha);
}

.idioma__bandeira :deep(svg) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.idioma__nome {
  min-width: 0;
  overflow: hidden;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.idioma--ativo .idioma__nome {
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .opcao,
  .escolha,
  .idioma {
    transition: none;
  }
}
</style>
