<script setup lang="ts">
/**
 * Configurações — a conta de quem está usando o portal.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Conta não é espaço da barra (mora no menu da pessoa, no pé dela), então a tela não tem destino:
 * o título é "Configurações", e a frase de estado diz com que e-mail e em que empresa se entrou.
 * As cinco partes — Perfil, Empresa, Segurança, Aparência e Conta — são abas desta tela, na mesma
 * trilha de vidro do cabeçalho que as abas de destino (desde 03/11/2026; antes eram uma fileira
 * sublinhada embaixo da faixa, a única do portal). Cada aba é um link de verdade (`?aba=…`, como
 * antes), então voltar, favoritar e abrir em outra guia funcionam, e os redirecionamentos antigos
 * para `?aba=empresa` continuam caindo no lugar certo.
 *
 * A tela é de leitura: título, abas e folhas numa coluna centralizada (`largura="leitura"`).
 *
 * Cada aba é uma folha com seções: o nome e uma frase da seção à esquerda, os campos à direita,
 * e o "Salvar" no rodapé da folha.
 */
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import SettingsAparenciaPanel from '@/components/settings/SettingsAparenciaPanel.vue'
import SettingsContaPanel from '@/components/settings/SettingsContaPanel.vue'
import SettingsEmpresaPanel from '@/components/settings/SettingsEmpresaPanel.vue'
import SettingsPerfilPanel from '@/components/settings/SettingsPerfilPanel.vue'
import SettingsSegurancaPanel from '@/components/settings/SettingsSegurancaPanel.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { usePartnerTabs } from '@/composables/usePartnerTabs'
import type { Aba } from '@/navegacao/espacos'
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

/*
 * As abas no formato das de destino: o endereço é o caminho inteiro, com o `?aba=` de cada uma, e
 * a frase de cada parte vai no `title` (o campo do selo, que estas abas não têm).
 */
const abas = computed<Aba[]>(() =>
  SETTINGS_TABS.map((id) => ({
    rotulo: t(`settings.tabs.${id}.label`),
    icone: ICONE_DA_ABA[id],
    to: router.resolve(destinoDa(id)).fullPath,
    tituloDoSelo: t(`settings.tabs.${id}.description`),
  })),
)

const abaAtual = computed(() => router.resolve(destinoDa(activeTab.value)).fullPath)

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
    :abas-da-tela="abas"
    :aba-atual="abaAtual"
  >
    <SettingsPerfilPanel v-if="activeTab === 'perfil'" />
    <SettingsEmpresaPanel v-else-if="activeTab === 'empresa'" />
    <SettingsSegurancaPanel v-else-if="activeTab === 'seguranca'" />
    <SettingsAparenciaPanel v-else-if="activeTab === 'aparencia'" />
    <SettingsContaPanel v-else />
  </UiPagina>
</template>
