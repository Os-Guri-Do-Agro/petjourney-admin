<script setup lang="ts">
/**
 * Vagas da internação (E5-01, guia e5 5, P4): a resposta para "tem vaga?" ao telefone. Os quatro
 * tipos de leito, sempre na mesma ordem, com quantos livres, ocupados e fora de operação. Nenhum
 * dado de paciente: é a tela da recepção (`agenda.ler`), que não lê o mapa.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { KINDS_DO_LEITO, lerVagas, type Vagas } from '@/service/parceiro/internacao-service'

import { ICONE_DO_KIND } from './rotulos-da-internacao'

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const vagas = ref<Vagas | null>(null)
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    vagas.value = await lerVagas(parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())

/* A UTI primeiro, como no mapa; o tipo sem leito nenhum some. */
const tipos = computed(() =>
  KINDS_DO_LEITO.map((kind) => vagas.value?.porKind.find((item) => item.kind === kind)).filter(
    (item): item is NonNullable<typeof item> =>
      Boolean(item && item.livres + item.ocupados + item.inativos > 0),
  ),
)

const resumo = computed(() => {
  if (!vagas.value) return ''
  return vagas.value.livres
    ? t('internacao.vagas.resumo', { n: vagas.value.livres }, vagas.value.livres)
    : t('internacao.vagas.semVaga')
})

function meta(item: { ocupados: number; inativos: number }) {
  return [
    t('internacao.vagas.ocupados', { n: item.ocupados }, item.ocupados),
    item.inativos ? t('internacao.vagas.inativos', { n: item.inativos }, item.inativos) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <UiPagina
    :titulo="t('internacao.vagas.titulo')"
    :resumo="resumo"
    icone="ph ph-bed"
    :carregando="carregando && !vagas"
    :erro="vagas ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <section v-if="vagas" class="ui-folha ui-lista" aria-labelledby="vagas-titulo">
      <h2 id="vagas-titulo" class="sr-only">{{ t('internacao.vagas.titulo') }}</h2>
      <ul v-if="tipos.length" class="ui-lista">
        <li v-for="item in tipos" :key="item.kind" class="ui-linha">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
            <i :class="ICONE_DO_KIND[item.kind]" />
          </span>
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">{{ t(`internacao.kind.${item.kind}`) }}</strong>
            <span class="ui-linha__meta">{{ meta(item) }}</span>
          </span>
          <span class="ui-linha__fim">
            <span class="ui-selo" :class="item.livres ? 'ui-selo--ok' : 'ui-selo--contorno'">
              {{
                item.livres
                  ? t('internacao.planta.vagas', { n: item.livres }, item.livres)
                  : t('internacao.planta.semVaga')
              }}
            </span>
          </span>
        </li>
      </ul>
      <p v-else class="ui-vazio">{{ t('internacao.vagas.semLeitos') }}</p>
    </section>
  </UiPagina>
</template>
