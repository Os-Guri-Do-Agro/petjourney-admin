<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { ApiError } from '@/service/api'
import { getPerfis, trocarParaParceiro, type PerfilParceiro } from '@/service/auth/auth-service'
import { getAuthUser } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { montarOpcoesParceiro, podeCadastrarNovaEmpresa } from '@/utils/parceiro/perfis-parceiro'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const store = useParceiroStore()

const parceiros = ref<PerfilParceiro[]>([])
const loading = ref(true)
const errorMessage = ref('')
const trocandoId = ref<string | null>(null)

const opcoes = computed(() =>
  montarOpcoesParceiro(parceiros.value, getAuthUser()?.parceiroAtivoId ?? store.parceiroId),
)
const mostrarCadastro = computed(
  () => !loading.value && !errorMessage.value && podeCadastrarNovaEmpresa(parceiros.value),
)

/** As iniciais do nome da empresa, para o rosto da linha ("Clínica Vida Animal" → "CV"). */
function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toLocaleUpperCase())
    .join('')
}

async function carregarPerfis() {
  loading.value = true
  errorMessage.value = ''

  try {
    const perfis = await getPerfis()
    parceiros.value = perfis.parceiros
  } catch (err) {
    parceiros.value = []
    errorMessage.value =
      err instanceof Error ? err.message : String(t('parceiro.selecionar.errorLoad'))
  } finally {
    loading.value = false
  }
}

async function selecionar(parceiroId: string, jaAtivo: boolean) {
  if (jaAtivo || trocandoId.value) {
    return
  }

  trocandoId.value = parceiroId

  try {
    await trocarParaParceiro(parceiroId)
    /* Contexto novo: o cache do parceiro anterior não pode vazar na tela do próximo. */
    store.reset()
    store.setParceiroId(parceiroId)
    await store.bootstrap(true)
    await router.replace('/inicio')
  } catch (err) {
    /* 403 = lista velha (membership removida em outro lugar): recarrega em vez de insistir. */
    if (err instanceof ApiError && err.statusCode === 403) {
      toast.add({
        severity: 'warn',
        summary: t('parceiro.selecionar.toast.stale'),
        detail: t('parceiro.selecionar.toast.staleDetail'),
        life: 5000,
      })
      await carregarPerfis()
      return
    }

    toast.add({
      severity: 'error',
      summary: t('parceiro.selecionar.toast.error'),
      detail: err instanceof Error ? err.message : t('parceiro.selecionar.toast.errorDetail'),
      life: 5000,
    })
  } finally {
    trocandoId.value = null
  }
}

onMounted(() => {
  void carregarPerfis()
})
</script>

<template>
  <!--
    Uma pergunta só, no meio da tela: qual empresa operar agora. Cada empresa é uma linha inteira
    clicável, com o papel na conta e o estado do cadastro; a que já está em uso diz isso.
  -->
  <UiPagina
    class="tela-selecionar"
    :titulo="t('parceiro.selecionar.title')"
    :carregando="loading"
    :erro="errorMessage"
    :vazio="!opcoes.length && !mostrarCadastro"
    :vazio-titulo="t('parceiro.selecionar.emptyTitle')"
    :vazio-descricao="t('parceiro.selecionar.emptyBody')"
    vazio-icone="ph ph-buildings"
    @tentar-de-novo="carregarPerfis"
  >
    <template #cabecalho>
      <div class="centro-cabeca">
        <span class="ui-ladrilho ui-ladrilho--lugar centro-cabeca__selo" aria-hidden="true"><i class="ph ph-buildings" /></span>
        <h1 class="centro-cabeca__titulo">{{ t('parceiro.selecionar.title') }}</h1>
        <p class="centro-cabeca__texto">{{ t('parceiro.selecionar.body') }}</p>
      </div>
    </template>

    <div class="selecionar">
      <ul v-if="opcoes.length" class="ui-lista ui-folha selecionar__lista">
        <li v-for="opcao in opcoes" :key="opcao.parceiroId">
          <button
            type="button"
            class="ui-linha empresa"
            :class="{ 'empresa--ativa ui-marca ui-marca--lugar': opcao.ativo }"
            :disabled="trocandoId != null && trocandoId !== opcao.parceiroId"
            :aria-current="opcao.ativo ? 'true' : undefined"
            :aria-busy="trocandoId === opcao.parceiroId || undefined"
            @click="selecionar(opcao.parceiroId, opcao.ativo)"
          >
            <span class="empresa__rosto" :class="{ 'empresa__rosto--equipe': opcao.equipe }" aria-hidden="true">
              {{ iniciais(opcao.nome) }}
            </span>

            <span class="ui-linha__texto">
              <span class="ui-linha__titulo empresa__nome">{{ opcao.nome }}</span>
              <span class="ui-linha__meta empresa__papel">
                <i :class="opcao.equipe ? 'ph ph-users-three' : 'ph ph-storefront'" aria-hidden="true" />
                {{
                  opcao.equipe
                    ? t('parceiro.selecionar.roleOperador')
                    : t('parceiro.selecionar.roleDono')
                }}
              </span>
            </span>

            <span class="ui-linha__fim">
              <PartnerStatusBadge v-if="opcao.badgeStatus" :status="opcao.badgeStatus" />
              <span v-if="opcao.ativo" class="ui-selo ui-selo--ok">
                <i class="ph ph-check" aria-hidden="true" />
                {{ t('parceiro.selecionar.current') }}
              </span>
              <i
                v-else-if="trocandoId === opcao.parceiroId"
                class="ph ph-spin ph-circle-notch empresa__girando"
                aria-hidden="true"
              />
              <i v-else class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
            </span>
          </button>
        </li>
      </ul>

      <RouterLink v-if="mostrarCadastro" to="/settings?aba=empresa" class="nova-empresa">
        <span class="nova-empresa__icone" aria-hidden="true"><i class="ph ph-plus" /></span>
        <span class="ui-linha__texto">
          <span class="ui-linha__titulo">{{ t('parceiro.selecionar.newTitle') }}</span>
          <span class="ui-linha__meta nova-empresa__texto">{{ t('parceiro.selecionar.newBody') }}</span>
        </span>
        <span class="nova-empresa__acao">{{ t('parceiro.selecionar.newCta') }}</span>
      </RouterLink>
    </div>
  </UiPagina>
</template>

<style scoped>
/* A pergunta no centro: o selo, o título e a frase, alinhados à coluna da lista. */
.centro-cabeca {
  display: grid;
  width: 100%;
  max-width: 34rem;
  justify-items: center;
  gap: 8px;
  margin: clamp(16px, 7vh, 80px) auto 0;
  text-align: center;
}

.centro-cabeca__selo.ui-ladrilho {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  font-size: 28px;
}

.centro-cabeca__titulo {
  margin: 12px 0 0;
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.centro-cabeca__texto {
  max-width: 44ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 15px;
  line-height: 1.5;
}

.selecionar {
  display: grid;
  width: 100%;
  max-width: 34rem;
  gap: 14px;
  margin: 8px auto 0;
}

.selecionar__lista {
  overflow: hidden;
}

.empresa.ui-linha {
  min-height: 72px;
  padding-block: 12px;
}

.empresa.ui-linha:disabled {
  cursor: default;
  opacity: 0.6;
}

.empresa--ativa.ui-linha {
  background: color-mix(in oklab, var(--pj-lugar-fundo) 55%, var(--superficie));
}

.empresa--ativa.ui-linha:hover {
  background: color-mix(in oklab, var(--pj-lugar-fundo) 75%, var(--superficie));
}

/* O rosto da empresa: o degradê do Portal para o seu negócio, papel claro para a equipe. */
.empresa__rosto {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  background: var(--pj-lugar-degrade);
  box-shadow:
    var(--pj-lugar-sombra),
    inset 0 1px 0 rgb(255 255 255 / 22%);
  color: #fff;
  font-family: var(--font-dados);
  font-size: 15px;
  font-weight: 650;
}

.app-dark .empresa__rosto {
  color: var(--rail);
}

.empresa__rosto--equipe,
.app-dark .empresa__rosto--equipe {
  background: var(--superficie-3);
  box-shadow: none;
  color: var(--tinta);
}

.empresa__nome {
  font-size: 15.5px;
  white-space: nowrap;
}

.empresa__papel {
  display: flex;
  align-items: center;
  gap: 6px;
}

.empresa__girando {
  color: var(--tinta-2);
  font-size: 18px;
}

/* Cadastrar outra empresa: a linha tracejada, fora da folha, porque não é uma empresa ainda. */
.nova-empresa {
  display: flex;
  min-height: 72px;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
  border: 1.5px dashed var(--linha-media);
  border-radius: var(--raio-cartao);
  color: var(--tinta);
  text-decoration: none;
}

.nova-empresa:hover {
  background: var(--superficie);
}

.nova-empresa:focus-visible {
  outline: 2px solid var(--pj-lugar);
  outline-offset: 2px;
}

.nova-empresa__icone {
  display: grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  border-radius: 13px;
  background: var(--superficie-3);
  color: var(--tinta-2);
  font-size: 20px;
}

.nova-empresa__texto {
  white-space: normal;
}

.nova-empresa__acao {
  flex: none;
  color: var(--pj-lugar-tinta);
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 520px) {
  .centro-cabeca {
    margin-top: 8px;
  }

  .centro-cabeca__titulo {
    font-size: 24px;
  }

  .nova-empresa {
    flex-wrap: wrap;
  }

  .nova-empresa__acao {
    margin-inline-start: 58px;
  }
}
</style>
