<script setup lang="ts">
/**
 * A seção "Verificação de identidade" da aba Perfil (E1-08): o estado do envio numa linha e o
 * botão que abre a gaveta. É da pessoa, vale em todas as empresas dela, e é o que falta para o
 * CRMV ganhar o selo e a pessoa assinar.
 *
 * Abre sozinha com `?identidade=enviar`: é para onde o aviso dos botões de assinar leva quem ainda
 * não confirmou a identidade.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import IdentidadeGaveta from '@/components/settings/IdentidadeGaveta.vue'
import { useSeloDeAssinatura } from '@/composables/useSeloDeAssinatura'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { obterIdentidade, type IdentidadeDaPessoa } from '@/service/parceiro/identidade-service'
import { useParceiroStore } from '@/stores/parceiro'

const props = defineProps<{ nomeSugerido: string; cpfSugerido: string }>()

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useParceiroStore()
const { motivo } = useSeloDeAssinatura()

const identidade = ref<IdentidadeDaPessoa | null>(null)
const carregando = ref(true)
const erro = ref(false)
const aberta = ref(false)

const verificacao = computed(() => identidade.value?.verificacao ?? null)
const status = computed(() => verificacao.value?.status ?? null)

function data(iso: string | null | undefined) {
  if (!iso) return ''

  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** A frase do estado: o que aconteceu com o último envio, numa linha. */
const frase = computed(() => {
  const atual = verificacao.value

  if (!atual) return t('settings.identidade.estado.nenhum')
  if (atual.motivoDoSistema === 'EXPIRADA') return t('settings.identidade.expirada')

  const quando =
    atual.status === 'EM_ANALISE'
      ? atual.enviadaEm
      : atual.status === 'REVOGADA'
        ? atual.revogadaEm
        : (atual.decididaEm ?? atual.enviadaEm)

  return t(`settings.identidade.estado.${atual.status}`, {
    data: data(quando),
    prazo: data(atual.analiseExpiraEm),
  })
})

const icone = computed(() => {
  switch (status.value) {
    case 'EM_ANALISE':
      return 'ph ph-hourglass-medium'
    case 'APROVADA':
      return 'ph ph-seal-check'
    case 'RECUSADA':
    case 'REVOGADA':
      return 'ph ph-x-circle'
    default:
      return 'ph ph-identification-card'
  }
})

const rotuloDoBotao = computed(() => {
  if (status.value === null) return t('settings.identidade.acoes.enviar')
  if (status.value === 'EM_ANALISE' || status.value === 'APROVADA') {
    return t('settings.identidade.acoes.ver')
  }

  return t('settings.identidade.acoes.reenviar')
})

/**
 * A linha do selo, só quando a identidade já não é o que falta: com ela aprovada, o que segura a
 * assinatura é a conferência do CRMV (pendente ou vencida).
 */
const fraseDoSelo = computed(() =>
  motivo.value && motivo.value !== 'SEM_IDENTIDADE'
    ? t(`settings.identidade.selo.${motivo.value}`)
    : '',
)

/** Recusada ou revogada: o motivo do admin já na linha, porque é ele que diz o que refazer. */
const motivoDaDecisao = computed(() => {
  const atual = verificacao.value
  const texto =
    atual?.status === 'RECUSADA'
      ? atual.motivoDecisao
      : atual?.status === 'REVOGADA'
        ? atual.motivoRevogacao
        : null

  return texto ? t('settings.identidade.motivo', { motivo: texto }) : ''
})

async function carregar() {
  carregando.value = true
  erro.value = false

  try {
    identidade.value = await obterIdentidade()
  } catch {
    erro.value = true
  } finally {
    carregando.value = false
  }
}

/** O envio mudou: a gaveta manda o estado novo, e o `/eu` (o selo) é pedido de novo. */
function aoAtualizar(nova: IdentidadeDaPessoa | null) {
  /*
   * Sem toast: a gaveta segue aberta e já mostra o estado novo ("Em análise", "Cancelada"), e um
   * toast no canto cobriria o título dela.
   */
  if (nova) {
    identidade.value = nova
  } else {
    void carregar()
  }

  void store.bootstrap(true)
}

/** `?identidade=enviar` abre a gaveta e sai da URL (voltar não reabre). */
function abrirSePedido() {
  if (route.query.identidade !== 'enviar') return

  aberta.value = true

  const query = { ...route.query }
  delete query.identidade
  void router.replace({ query })
}

onMounted(async () => {
  await carregar()
  abrirSePedido()
})

/*
 * Também com a tela já aberta: o pedido do pé da barra leva para cá de qualquer tela, inclusive
 * desta, e aí a seção não é montada de novo.
 */
watch(
  () => route.query.identidade,
  () => {
    if (!carregando.value) abrirSePedido()
  },
)
</script>

<template>
  <section class="cfg-secao" aria-labelledby="perfil-secao-verificacao">
    <header class="cfg-secao__cabeca">
      <span class="ui-ladrilho cfg-secao__ladrilho" aria-hidden="true">
        <i class="ph ph-identification-card" />
      </span>
      <h3 id="perfil-secao-verificacao" class="cfg-secao__titulo">
        {{ t('settings.identidade.titulo') }}
      </h3>
      <p class="cfg-secao__descricao">{{ t('settings.identidade.descricao') }}</p>
    </header>

    <div class="cfg-secao__corpo">
      <div v-if="carregando" class="iv__linha">
        <Skeleton width="16rem" height="1.1rem" />
      </div>

      <p v-else-if="erro" class="iv__frase">
        <i class="ph ph-warning-circle iv__icone iv__icone--risco" aria-hidden="true" />
        <span>{{ t('settings.identidade.erros.carregar') }}</span>
        <Button
          :label="t('settings.identidade.acoes.tentarDeNovo')"
          severity="secondary"
          outlined
          size="small"
          @click="carregar"
        />
      </p>

      <template v-else>
        <p class="iv__frase" :class="status ? `iv__frase--${status}` : undefined">
          <i :class="['iv__icone', icone]" aria-hidden="true" />
          <span>{{ frase }}</span>
        </p>
        <p v-if="motivoDaDecisao" class="iv__selo">{{ motivoDaDecisao }}</p>
        <p v-if="fraseDoSelo" class="iv__selo">{{ fraseDoSelo }}</p>
        <!-- Contornado como o da ficha logo abaixo: a ação cheia da aba é "Salvar perfil". -->
        <Button
          type="button"
          class="iv__botao"
          icon="ph ph-identification-card"
          :label="rotuloDoBotao"
          severity="secondary"
          outlined
          @click="aberta = true"
        />
      </template>
    </div>

    <IdentidadeGaveta
      v-model:visible="aberta"
      :identidade="identidade"
      :nome-sugerido="props.nomeSugerido"
      :cpf-sugerido="props.cpfSugerido"
      @atualizada="aoAtualizar"
    />
  </section>
</template>

<style scoped>
.iv__linha {
  min-height: 24px;
}

.iv__frase {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  line-height: 1.45;
}

.iv__icone {
  color: var(--tinta-2);
  font-size: 20px;
}

.iv__frase--EM_ANALISE .iv__icone {
  color: var(--atencao-tinta);
}

.iv__frase--APROVADA .iv__icone {
  color: var(--ok-tinta);
}

.iv__frase--RECUSADA .iv__icone,
.iv__frase--REVOGADA .iv__icone,
.iv__icone--risco {
  color: var(--risco-tinta);
}

.iv__selo {
  margin: -8px 0 0;
  padding-inline-start: 30px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.iv__botao {
  justify-self: start;
}
</style>
