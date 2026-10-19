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
import LanguageSwitcher from '@/components/common/LanguageSwitcher.vue'
import { useLogout } from '@/composables/useLogout'
import { getAuthUser } from '@/service/auth/auth-session'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { isDarkMode, toggleColorMode } from '@/theme/color-mode'

defineProps<{ recolhida: boolean }>()

const { t } = useI18n()
const perfil = useUsuarioPerfilStore()
const { logout } = useLogout()

const menu = ref<InstanceType<typeof Popover> | null>(null)
const menuAberto = ref(false)
const confirmarSaida = ref(false)

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
      :class="{ 'conta__botao--recolhida': recolhida }"
      aria-haspopup="menu"
      :aria-expanded="menuAberto"
      :title="recolhida ? nome : undefined"
      @click="alternar"
    >
      <span class="conta__avatar" aria-hidden="true">
        <img v-if="perfil.avatarUrl" :src="perfil.avatarUrl" alt="" />
        <template v-else>{{ perfil.initials }}</template>
      </span>
      <span v-if="!recolhida" class="conta__quem">
        <strong>{{ nome }}</strong>
        <small>{{ t('shell.user.role') }}</small>
      </span>
      <i v-if="!recolhida" class="ph ph-dots-three-vertical conta__mais" aria-hidden="true" />
    </button>

    <Popover
      ref="menu"
      class="conta__menu"
      @show="menuAberto = true"
      @hide="menuAberto = false"
    >
      <div class="conta__lista" role="menu">
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

        <div class="conta__linha" role="none">
          <i class="ph ph-translate" aria-hidden="true" />
          <span class="conta__linha-rotulo">{{ t('languageSwitcher.label') }}</span>
          <LanguageSwitcher variant="menu" />
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
.conta__botao {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--sobre-rail);
  cursor: pointer;
  text-align: left;
}

.conta__botao:hover {
  background: rgb(255 255 255 / 6%);
}

.conta__botao:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: -2px;
}

.conta__botao--recolhida {
  justify-content: center;
}

.conta__avatar {
  display: grid;
  flex: none;
  width: 36px;
  height: 36px;
  overflow: hidden;
  place-items: center;
  border-radius: 50%;
  background: var(--salvia);
  color: var(--sobre-salvia);
  font-size: 13px;
  font-weight: 650;
}

.conta__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  color: var(--sobre-rail-2);
  font-size: 18px;
}

.conta__lista {
  display: grid;
  min-width: 248px;
  gap: 2px;
}

.conta__item,
.conta__linha {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 0 10px;
  border-radius: 8px;
  color: var(--tinta);
  font-size: 14px;
  text-decoration: none;
}

.conta__item:hover {
  background: var(--superficie-2);
}

.conta__item:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: -2px;
}

.conta__item i,
.conta__linha i {
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

.conta__sair.p-button {
  justify-content: flex-start;
  gap: 12px;
  min-height: 40px;
  padding: 0 10px;
  font-weight: 500;
}
</style>
