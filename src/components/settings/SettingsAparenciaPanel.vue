<script setup lang="ts">
/**
 * Configurações → Aparência: como o portal se mostra para quem está usando.
 *
 * Tudo aqui é preferência de exibição — muda na hora, fica neste navegador, não passa pela API e
 * por isso não tem "Salvar": o rodapé diz isso no lugar do botão.
 *
 * - **Tema** claro ou escuro (também no menu da pessoa, no pé da barra).
 * - **Barra lateral**: só o espaço da tela atual aberto (o padrão), ou todos os espaços abertos
 *   ao mesmo tempo — o modo "lista" de `useLayoutPreferences`.
 * - **Densidade**: linhas mais baixas na barra (a moldura aplica `shell--densa`).
 * - **Explicações**: o texto de apoio das telas do Portal, o mesmo do botão "Mostrar explicações".
 * - **Idioma** da interface (também no menu da pessoa).
 *
 * Tema, barra e densidade mostram uma miniatura do portal, não um rótulo: "todos os espaços
 * abertos" é difícil de imaginar por nome, e ninguém precisa escolher às cegas.
 */
import RadioButton from 'primevue/radiobutton'
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
  navigatorDensity,
  navigatorMode,
  setNavigatorDensity,
  setNavigatorMode,
  toggleGuidance,
  type NavigatorDensity,
  type NavigatorMode,
} from '@/composables/useLayoutPreferences'
import { changeLocale } from '@/i18n'
import { LOCALES, type Locale } from '@/i18n/locales'
import { colorMode } from '@/theme/color-mode'
import type { ThemeMode } from '@/theme/colors'

import './configuracoes.css'

const { t, locale } = useI18n()

type Maquete = { tema?: 'claro' | 'escuro' | 'atual'; todos?: boolean; densa?: boolean }

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

const modos = computed<Opcao<NavigatorMode>[]>(() => [
  {
    valor: 'secoes',
    label: t('settings.aparencia.barra.secoes.label'),
    hint: t('settings.aparencia.barra.secoes.hint'),
    maquete: { todos: false },
  },
  {
    valor: 'lista',
    label: t('settings.aparencia.barra.lista.label'),
    hint: t('settings.aparencia.barra.lista.hint'),
    maquete: { todos: true },
  },
])

const densidades = computed<Opcao<NavigatorDensity>[]>(() => [
  {
    valor: 'confortavel',
    label: t('settings.aparencia.densidade.confortavel.label'),
    hint: t('settings.aparencia.densidade.confortavel.hint'),
    maquete: { todos: true },
  },
  {
    valor: 'compacta',
    label: t('settings.aparencia.densidade.compacta.label'),
    hint: t('settings.aparencia.densidade.compacta.hintBarra'),
    maquete: { todos: true, densa: true },
  },
])

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
          <SettingsLayoutMockup v-bind="opcao.maquete" />
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

    <section class="cfg-secao" aria-labelledby="aparencia-barra-titulo">
      <header class="cfg-secao__cabeca">
        <h3 id="aparencia-barra-titulo" class="cfg-secao__titulo">
          {{ t('settings.aparencia.barra.titulo') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('settings.aparencia.barra.descricao') }}</p>
      </header>

      <div class="cfg-secao__corpo opcoes" role="radiogroup" aria-labelledby="aparencia-barra-titulo">
        <label
          v-for="opcao in modos"
          :key="opcao.valor"
          class="opcao"
          :class="{ 'opcao--ativa': navigatorMode === opcao.valor }"
        >
          <SettingsLayoutMockup v-bind="opcao.maquete" :densa="navigatorDensity === 'compacta'" />
          <span class="opcao__pe">
            <RadioButton
              :input-id="`aparencia-menu-${opcao.valor}`"
              name="aparencia-menu"
              :value="opcao.valor"
              :model-value="navigatorMode"
              @update:model-value="setNavigatorMode(opcao.valor)"
            />
            <span class="opcao__texto">
              <strong>{{ opcao.label }}</strong>
              <small>{{ opcao.hint }}</small>
            </span>
          </span>
        </label>
      </div>
    </section>

    <section class="cfg-secao" aria-labelledby="aparencia-densidade-titulo">
      <header class="cfg-secao__cabeca">
        <h3 id="aparencia-densidade-titulo" class="cfg-secao__titulo">
          {{ t('settings.aparencia.densidade.titulo') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('settings.aparencia.densidade.descricaoBarra') }}</p>
      </header>

      <div
        class="cfg-secao__corpo opcoes"
        role="radiogroup"
        aria-labelledby="aparencia-densidade-titulo"
      >
        <label
          v-for="opcao in densidades"
          :key="opcao.valor"
          class="opcao"
          :class="{ 'opcao--ativa': navigatorDensity === opcao.valor }"
        >
          <SettingsLayoutMockup v-bind="opcao.maquete" />
          <span class="opcao__pe">
            <RadioButton
              :input-id="`aparencia-densidade-${opcao.valor}`"
              name="aparencia-densidade"
              :value="opcao.valor"
              :model-value="navigatorDensity"
              @update:model-value="setNavigatorDensity(opcao.valor)"
            />
            <span class="opcao__texto">
              <strong>{{ opcao.label }}</strong>
              <small>{{ opcao.hint }}</small>
            </span>
          </span>
        </label>
      </div>
    </section>

    <section class="cfg-secao" aria-labelledby="aparencia-explicacoes-titulo">
      <header class="cfg-secao__cabeca">
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
  .idioma {
    transition: none;
  }
}
</style>
