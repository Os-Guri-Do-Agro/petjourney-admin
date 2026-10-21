<script setup lang="ts">
/**
 * Configurações — a conta de quem está usando o portal.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Conta não é espaço da barra (mora no menu da pessoa, no pé dela), então a tela não tem destino:
 * o título é "Configurações", e a frase de estado diz com que e-mail e em que empresa se entrou.
 * As cinco partes — Perfil, Empresa, Segurança, Aparência e Conta — são abas desta tela, com o
 * desenho das abas de destino (sublinhado, ícone e nome). Cada aba é um link de verdade
 * (`?aba=…`, como antes), então voltar, favoritar e abrir em outra guia funcionam, e os
 * redirecionamentos antigos para `?aba=empresa` continuam caindo no lugar certo.
 *
 * Cada aba é uma folha com seções: o nome e uma frase da seção à esquerda, os campos à direita,
 * e o "Salvar" no rodapé da folha.
 */
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import SettingsAparenciaPanel from '@/components/settings/SettingsAparenciaPanel.vue'
import SettingsContaPanel from '@/components/settings/SettingsContaPanel.vue'
import SettingsEmpresaPanel from '@/components/settings/SettingsEmpresaPanel.vue'
import SettingsPerfilPanel from '@/components/settings/SettingsPerfilPanel.vue'
import SettingsSegurancaPanel from '@/components/settings/SettingsSegurancaPanel.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { usePartnerTabs } from '@/composables/usePartnerTabs'
import { authSessionVersion, getAuthUser } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'

const SETTINGS_TABS = ['perfil', 'empresa', 'seguranca', 'aparencia', 'conta'] as const
type SettingsTab = (typeof SETTINGS_TABS)[number]

const HASH_TO_TAB: Record<string, SettingsTab> = {
  perfil: 'perfil',
  empresa: 'empresa',
  credenciamento: 'empresa',
  seguranca: 'seguranca',
  segurança: 'seguranca',
  aparencia: 'aparencia',
  aparência: 'aparencia',
  conta: 'conta',
}

const ICONE_DA_ABA: Record<SettingsTab, string> = {
  perfil: 'ph ph-user-circle',
  empresa: 'ph ph-buildings',
  seguranca: 'ph ph-lock-key',
  aparencia: 'ph ph-palette',
  conta: 'ph ph-identification-card',
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { activeTab } = usePartnerTabs(SETTINGS_TABS, 'perfil')
const parceiroStore = useParceiroStore()
const perfilStore = useUsuarioPerfilStore()

/** A aba é a mesma URL com outro `?aba=`; Perfil é a tela sem o parâmetro. */
function destinoDa(aba: SettingsTab) {
  const query = { ...route.query }

  if (aba === 'perfil') {
    delete query.aba
  } else {
    query.aba = aba
  }

  return { path: '/settings', query }
}

const tabs = computed(() =>
  SETTINGS_TABS.map((id) => ({
    id,
    label: t(`settings.tabs.${id}.label`),
    description: t(`settings.tabs.${id}.description`),
    icone: ICONE_DA_ABA[id],
    to: destinoDa(id),
  })),
)

/** "Você entrou como carla@… em Clínica Vida Animal." */
const resumo = computed(() => {
  void authSessionVersion.value
  const email = perfilStore.email || getAuthUser()?.email || ''

  if (!email) {
    return ''
  }

  return parceiroStore.loadState === 'ready' && parceiroStore.parceiroNome
    ? t('settings.resumoEmpresa', { email, empresa: parceiroStore.parceiroNome })
    : t('settings.resumo', { email })
})

async function resolveLegacyHash() {
  const hashId = route.hash.replace('#', '').trim().toLowerCase()

  if (!hashId || !(hashId in HASH_TO_TAB)) {
    return
  }

  const tab = HASH_TO_TAB[hashId]!
  const nextQuery = { ...route.query }

  if (tab === 'perfil') {
    delete nextQuery.aba
  } else {
    nextQuery.aba = tab
  }

  await router.replace({
    path: '/settings',
    query: nextQuery,
    hash: '',
  })
}

onMounted(() => {
  void resolveLegacyHash()
})

watch(
  () => route.hash,
  () => {
    void resolveLegacyHash()
  },
)
</script>

<template>
  <UiPagina
    class="tela-conta"
    :titulo="t('settings.title')"
    :resumo="resumo"
    largura="leitura"
    icone="ph ph-gear-six"
  >
    <nav class="conta-abas" :aria-label="t('settings.abasAria')">
      <RouterLink
        v-for="aba in tabs"
        :key="aba.id"
        class="conta-abas__aba"
        :class="{ 'conta-abas__aba--atual': aba.id === activeTab }"
        :to="aba.to"
        replace
        active-class=""
        exact-active-class=""
        :aria-current="aba.id === activeTab ? 'page' : undefined"
        :title="aba.description"
      >
        <i :class="aba.icone" aria-hidden="true" />
        <span>{{ aba.label }}</span>
      </RouterLink>
    </nav>

    <SettingsPerfilPanel v-if="activeTab === 'perfil'" />
    <SettingsEmpresaPanel v-else-if="activeTab === 'empresa'" />
    <SettingsSegurancaPanel v-else-if="activeTab === 'seguranca'" />
    <SettingsAparenciaPanel v-else-if="activeTab === 'aparencia'" />
    <SettingsContaPanel v-else />
  </UiPagina>
</template>

<style scoped>
/* As abas da conta, no desenho das abas de destino: sublinhado de 3 px na cor do lugar. */
.conta-abas {
  display: flex;
  gap: 4px;
  margin: -6px 0 24px;
  overflow-x: auto;
  border-bottom: 1px solid var(--linha);
  scrollbar-width: none;
}

.conta-abas::-webkit-scrollbar {
  display: none;
}

.conta-abas__aba {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 14px;
  color: var(--tinta-2);
  font-size: 14.5px;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}

.conta-abas__aba:first-child {
  padding-inline-start: 2px;
}

.conta-abas__aba i {
  font-size: 18px;
}

.conta-abas__aba:hover {
  color: var(--tinta);
}

.conta-abas__aba:focus-visible {
  border-radius: 6px;
  outline: 2px solid var(--pj-lugar);
  outline-offset: -4px;
}

.conta-abas__aba--atual {
  color: var(--tinta);
  font-weight: 600;
}

.conta-abas__aba--atual i {
  color: var(--pj-lugar);
}

.conta-abas__aba--atual::after {
  position: absolute;
  right: 14px;
  bottom: -1px;
  left: 14px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--pj-lugar);
  content: '';
}

.conta-abas__aba--atual:first-child::after {
  left: 2px;
}

[dir='rtl'] .conta-abas__aba--atual:first-child::after {
  right: 2px;
  left: 14px;
}

@media (max-width: 900px) {
  .conta-abas {
    margin-inline: -16px;
    padding-inline: 16px;
  }

  .conta-abas__aba {
    padding: 0 10px;
  }
}
</style>
