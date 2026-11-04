/**
 * As empresas da conta e a troca entre elas: a tela "Trocar de empresa" e o seletor do topo da
 * barra usam o mesmo caminho.
 *
 * Uma conta pode estar em várias equipes ao mesmo tempo (dona de uma, operadora de outras). A troca
 * pede um token novo para a empresa escolhida, limpa o que era da anterior e abre o Início dela.
 */
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { ApiError } from '@/service/api'
import { getPerfis, trocarParaParceiro, type PerfilParceiro } from '@/service/auth/auth-service'
import { authSessionVersion, getAuthUser } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { montarOpcoesParceiro, podeCadastrarNovaEmpresa } from '@/utils/parceiro/perfis-parceiro'

export function useTrocaDeEmpresa() {
  const { t } = useI18n()
  const toast = useToast()
  const router = useRouter()
  const store = useParceiroStore()

  const parceiros = ref<PerfilParceiro[]>([])
  /* Começa carregando: quem usa chama `carregar()` logo ao abrir. */
  const carregando = ref(true)
  const erro = ref('')
  const trocandoId = ref<string | null>(null)

  /*
   * "Em uso" é a empresa que o portal opera (a que vai no `?parceiroId=` de cada chamada). O
   * `parceiroAtivoId` do token é informativo e fica para trás quando o aceite de um convite troca a
   * empresa sem token novo: só vale quando o portal ainda não escolheu.
   */
  const opcoes = computed(() => {
    void authSessionVersion.value

    return montarOpcoesParceiro(parceiros.value, store.parceiroId ?? getAuthUser()?.parceiroAtivoId)
  })

  const podeCadastrar = computed(
    () => !carregando.value && !erro.value && podeCadastrarNovaEmpresa(parceiros.value),
  )

  async function carregar() {
    carregando.value = true
    erro.value = ''

    try {
      parceiros.value = (await getPerfis()).parceiros
    } catch (err) {
      parceiros.value = []
      erro.value = err instanceof Error ? err.message : String(t('parceiro.selecionar.errorLoad'))
    } finally {
      carregando.value = false
    }
  }

  /** `true` quando trocou; a empresa em uso não troca de novo. */
  async function trocar(parceiroId: string, jaAtiva: boolean): Promise<boolean> {
    if (jaAtiva || trocandoId.value) {
      return false
    }

    trocandoId.value = parceiroId

    try {
      await trocarParaParceiro(parceiroId)
      /* Contexto novo: o cache do parceiro anterior não pode vazar na tela do próximo. */
      store.reset()
      store.setParceiroId(parceiroId)
      await store.bootstrap(true)
      await router.replace('/inicio')
      return true
    } catch (err) {
      /* 403 = lista velha (membership removida em outro lugar): recarrega em vez de insistir. */
      if (err instanceof ApiError && err.statusCode === 403) {
        toast.add({
          severity: 'warn',
          summary: t('parceiro.selecionar.toast.stale'),
          detail: t('parceiro.selecionar.toast.staleDetail'),
          life: 5000,
        })
        await carregar()
        return false
      }

      toast.add({
        severity: 'error',
        summary: t('parceiro.selecionar.toast.error'),
        detail: err instanceof Error ? err.message : t('parceiro.selecionar.toast.errorDetail'),
        life: 5000,
      })
      return false
    } finally {
      trocandoId.value = null
    }
  }

  return { parceiros, opcoes, carregando, erro, trocandoId, podeCadastrar, carregar, trocar }
}
