<script setup lang="ts">
/**
 * Quem está usando, no pé da barra — e o menu da conta: perfil, configurações, trocar de empresa,
 * idioma, tema e sair.
 *
 * O menu abre num Popover no `body` (fecha no clique fora e no Esc). Sair pede confirmação: o
 * botão mora ao lado do tema, e um clique errado ali derruba a sessão de quem está no balcão.
 */
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import { useLogout } from '@/composables/useLogout'
import { changeLocale } from '@/i18n'
import { BANDEIRA_DO_IDIOMA, NOME_NATIVO_DO_IDIOMA } from '@/i18n/idiomas'
import { LOCALES, type Locale } from '@/i18n/locales'
import { getAuthUser } from '@/service/auth/auth-session'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { isDarkMode, toggleColorMode } from '@/theme/color-mode'

defineProps<{ recolhida: boolean }>()

const { t, locale } = useI18n()
const perfil = useUsuarioPerfilStore()
const { logout } = useLogout()

const menu = ref<InstanceType<typeof Popover> | null>(null)
const menuAberto = ref(false)
const confirmarSaida = ref(false)

/*
 * O idioma abre como uma lista dentro do próprio menu, e não como outro menu suspenso por cima
 * dele: um seletor dentro de um menu flutuante abria cortado e sobreposto aos itens.
 */
const idiomasAbertos = ref(false)
const idiomaAtual = computed(() => locale.value as Locale)

async function escolherIdioma(codigo: Locale) {
  if (codigo !== idiomaAtual.value) {
    await changeLocale(codigo)
  }

  idiomasAbertos.value = false
}

const nome = computed(
  () => perfil.displayName || getAuthUser()?.nome || t('shell.user.fallbackName'),
)

function alternar(evento: Event) {
  menu.value?.toggle(evento)
}

function fechar() {
  menu.value?.hide()
}

function alternarTema(escuro: boolean) {
  if (escuro !== isDarkMode.value) {
    toggleColorMode()
  }
}

function pedirSaida() {
  fechar()
  confirmarSaida.value = true
}

async function sair() {
  await logout()
}
</script>

<template>
  <div class="conta">
    <button
      type="button"
      class="conta__botao"
      aria-haspopup="menu"
      :aria-expanded="menuAberto"
      :title="recolhida ? nome : undefined"
      @click="alternar"
    >
      <span class="conta__avatar" aria-hidden="true">
        <img v-if="perfil.avatarUrl" :src="perfil.avatarUrl" alt="" />
        <template v-else>{{ perfil.initials }}</template>
      </span>
      <span class="conta__quem shell-rotulo">
        <strong>{{ nome }}</strong>
        <small>{{ t('shell.user.role') }}</small>
      </span>
      <i class="ph ph-caret-up-down conta__mais shell-rotulo" aria-hidden="true" />
    </button>

    <Popover
      ref="menu"
      class="conta__menu"
      @show="menuAberto = true"
      @hide="
        () => {
          menuAberto = false
          idiomasAbertos = false
        }
      "
    >
      <div class="conta__lista" role="menu">
        <div class="conta__cabeca" role="none">
          <span class="conta__avatar conta__avatar--grande" aria-hidden="true">
            <img v-if="perfil.avatarUrl" :src="perfil.avatarUrl" alt="" />
            <template v-else>{{ perfil.initials }}</template>
          </span>
          <span class="conta__quem">
            <strong>{{ nome }}</strong>
            <small>{{ t('shell.user.role') }}</small>
          </span>
        </div>

        <hr class="conta__divisa" />

        <RouterLink role="menuitem" class="conta__item" to="/settings?aba=perfil" @click="fechar">
          <i class="ph ph-user-circle" aria-hidden="true" />
          {{ t('shell.user.perfil') }}
        </RouterLink>
        <RouterLink role="menuitem" class="conta__item" to="/settings" @click="fechar">
          <i class="ph ph-gear-six" aria-hidden="true" />
          {{ t('shell.user.settings') }}
        </RouterLink>
        <RouterLink role="menuitem" class="conta__item" to="/parceiro/selecionar" @click="fechar">
          <i class="ph ph-arrows-left-right" aria-hidden="true" />
          {{ t('shell.user.trocarEmpresa') }}
        </RouterLink>

        <hr class="conta__divisa" />

        <button
          type="button"
          role="menuitem"
          class="conta__item conta__idioma"
          aria-controls="conta-idiomas"
          :aria-expanded="idiomasAbertos"
          @click="idiomasAbertos = !idiomasAbertos"
        >
          <i class="ph ph-translate" aria-hidden="true" />
          <span class="conta__linha-rotulo">{{ t('languageSwitcher.label') }}</span>
          <span class="conta__idioma-atual">
            <span
              class="conta__bandeira"
              aria-hidden="true"
              v-html="BANDEIRA_DO_IDIOMA[idiomaAtual]"
            />
            {{ t(`languageSwitcher.${idiomaAtual}`) }}
          </span>
          <i
            class="ph ph-caret-down conta__seta"
            :class="{ 'conta__seta--aberta': idiomasAbertos }"
            aria-hidden="true"
          />
        </button>

        <div
          id="conta-idiomas"
          class="conta__idiomas"
          :class="{ 'conta__idiomas--abertos': idiomasAbertos }"
          :inert="!idiomasAbertos || undefined"
        >
          <div class="conta__idiomas-dobra">
            <div class="conta__idiomas-lista" role="group" :aria-label="t('languageSwitcher.label')">
              <button
                v-for="codigo in LOCALES"
                :key="codigo"
                type="button"
                role="menuitemradio"
                class="conta__opcao"
                :class="{ 'conta__opcao--atual': codigo === idiomaAtual }"
                :aria-checked="codigo === idiomaAtual"
                @click="escolherIdioma(codigo)"
              >
                <span class="conta__bandeira" aria-hidden="true" v-html="BANDEIRA_DO_IDIOMA[codigo]" />
                <span class="conta__opcao-nome" dir="auto">{{ NOME_NATIVO_DO_IDIOMA[codigo] }}</span>
                <span class="conta__opcao-codigo">{{ t(`languageSwitcher.${codigo}`) }}</span>
                <i
                  v-if="codigo === idiomaAtual"
                  class="ph ph-check conta__opcao-marca"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </div>

        <div class="conta__linha" role="none">
          <i class="ph ph-moon-stars" aria-hidden="true" />
          <label class="conta__linha-rotulo" for="conta-tema">{{ t('shell.theme.darkTitle') }}</label>
          <ToggleSwitch
            input-id="conta-tema"
            :model-value="isDarkMode"
            @update:model-value="alternarTema"
          />
        </div>

        <hr class="conta__divisa" />

        <Button
          class="conta__sair"
          type="button"
          role="menuitem"
          text
          severity="danger"
          icon="ph ph-sign-out"
          :label="t('shell.user.logout')"
          @click="pedirSaida"
        />
      </div>
    </Popover>

    <ConfirmActionDialog
      v-model:visible="confirmarSaida"
      :title="t('shell.logoutConfirm.title')"
      :message="t('shell.logoutConfirm.message')"
      :confirm-label="t('shell.logout')"
      :cancel-label="t('shell.logoutConfirm.cancel')"
      severity="danger"
      @confirm="sair"
    />
  </div>
</template>

<style scoped>
/* O gatilho: a conta num cartão de vidro no pé da barra. */
.conta__botao {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  overflow: hidden;
  padding: 7px 8px 7px 7px;
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 14px;
  background: rgb(255 255 255 / 5%);
  color: var(--sobre-rail);
  cursor: pointer;
  text-align: start;
  white-space: nowrap;
  transition: background-color var(--pj-tempo-curto) ease;
}

.conta__botao:hover {
  background: rgb(255 255 255 / 9%);
}

.conta__botao:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: 2px;
}

.conta__avatar {
  display: grid;
  flex: none;
  width: 34px;
  height: 34px;
  overflow: hidden;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--pets-claro), var(--salvia));
  box-shadow: 0 0 0 2px rgb(255 255 255 / 14%);
  color: var(--rail);
  font-size: 13px;
  font-weight: 700;
}

.conta__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.conta__avatar--grande {
  width: 42px;
  height: 42px;
  box-shadow: 0 0 0 3px var(--superficie), 0 0 0 4px var(--linha);
  font-size: 15px;
}

.conta__quem {
  display: grid;
  flex: 1;
  min-width: 0;
  line-height: 1.25;
}

.conta__quem strong {
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conta__quem small {
  color: var(--sobre-rail-2);
  font-size: 12px;
}

.conta__mais {
  flex: none;
  color: var(--sobre-rail-2);
  font-size: 16px;
}

/* ------------------------------------------------------------------------------------ menu */

.conta__lista {
  display: grid;
  width: 296px;
  gap: 2px;
}

.conta__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px 8px;
}

.conta__cabeca .conta__quem strong {
  color: var(--tinta);
  font-size: 14.5px;
}

.conta__cabeca .conta__quem small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.conta__item,
.conta__linha {
  display: flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  gap: 12px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--tinta);
  font: inherit;
  font-size: 14px;
  text-align: start;
  text-decoration: none;
}

button.conta__item {
  cursor: pointer;
}

.conta__item:hover {
  background: var(--superficie-2);
}

.conta__item:focus-visible,
.conta__opcao:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: -2px;
}

.conta__item > i:first-child,
.conta__linha > i:first-child {
  color: var(--tinta-2);
  font-size: 18px;
}

.conta__linha-rotulo {
  flex: 1;
}

.conta__divisa {
  height: 1px;
  margin: 4px 6px;
  border: 0;
  background: var(--linha);
}

/* ------------------------------------------------------------------------------- idioma */

.conta__idioma-atual {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 650;
}

.conta__bandeira {
  display: inline-flex;
  width: 20px;
  height: 14px;
  flex: none;
  overflow: hidden;
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 8%);
}

.conta__bandeira :deep(svg) {
  width: 100%;
  height: 100%;
}

.conta__seta {
  color: var(--tinta-3);
  font-size: 13px;
  transition: transform var(--pj-tempo-medio) var(--pj-curva-chega);
}

.conta__seta--aberta {
  transform: rotate(180deg);
}

.conta__idiomas {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 260ms var(--pj-curva-chega);
}

.conta__idiomas--abertos {
  grid-template-rows: 1fr;
}

.conta__idiomas-dobra {
  min-height: 0;
  overflow: hidden;
}

.conta__idiomas-lista {
  display: grid;
  gap: 2px;
  margin: 2px 4px 6px 34px;
  padding: 4px;
  border: 1px solid var(--linha-suave);
  border-radius: 12px;
  background: var(--superficie-2);
}

.conta__opcao {
  display: flex;
  min-height: 36px;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  text-align: start;
}

.conta__opcao:hover {
  background: var(--superficie);
}

.conta__opcao--atual {
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  font-weight: 600;
}

.conta__opcao-nome {
  flex: 1;
  min-width: 0;
  text-align: match-parent;
}

.conta__opcao-codigo {
  color: var(--tinta-3);
  font-family: var(--font-dados);
  font-size: 11.5px;
  font-weight: 650;
}

.conta__opcao-marca {
  color: var(--musgo);
  font-size: 15px;
}

.conta__sair.p-button {
  justify-content: flex-start;
  gap: 12px;
  min-height: 42px;
  padding: 0 10px;
  font-weight: 500;
}

@media (prefers-reduced-motion: reduce) {
  .conta__idiomas,
  .conta__seta,
  .conta__botao {
    transition: none;
  }
}
</style>
