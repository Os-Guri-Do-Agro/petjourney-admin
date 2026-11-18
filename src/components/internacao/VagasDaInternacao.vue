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
import type { PassoDoGuia } from '@/components/ui/UiPassos.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { KINDS_DO_LEITO, lerVagas, type Vagas } from '@/service/parceiro/internacao-service'

import { ICONE_DO_KIND } from './rotulos-da-internacao'

const { t } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()

const clinicaEscreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
/* Quem cadastra leitos (DONO, GESTOR), como na aba Leitos da Configuração. */
const cadastraLeitos = computed(
  () => clinicaEscreve.value && store.temPermissao('estabelecimento.editar'),
)
/* Quem interna, como no mapa. */
const podeInternar = computed(
  () => clinicaEscreve.value && store.temPermissao('internacao.prescrever'),
)

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

/* Sem leito nenhum, a frase mora no vazio: o resumo não repete. */
const semLeitos = computed(() => Boolean(vagas.value) && !tipos.value.length)

/*
 * O vazio que ensina (o desenho de Acessos, 17/11/2026): sem leito nenhum, de onde as vagas vêm,
 * em três etapas (o cadastro dos leitos, internar ocupa, a vaga aparece aqui). Cada etapa que se
 * faz tem o botão dela: "Cadastrar leitos" para quem configura e o "Internar", apagado até haver
 * leito. A vaga que aparece é automática: sem botão.
 */
const passosDasVagas = computed<PassoDoGuia[]>(() => {
  const passo = (id: string, icone: string, acao?: PassoDoGuia['acao']): PassoDoGuia => ({
    id,
    icone,
    titulo: t(`internacao.vagas.guia.${id}.titulo`),
    texto: t(`internacao.vagas.guia.${id}.texto`),
    acao,
  })

  return [
    passo(
      'leitos',
      'ph ph-bed',
      cadastraLeitos.value
        ? {
            rotulo: t('internacao.irParaLeitos'),
            icone: 'ph ph-bed',
            to: { path: '/clinica/configuracao', query: { aba: 'leitos' } },
          }
        : undefined,
    ),
    passo(
      'internar',
      'ph ph-first-aid-kit',
      podeInternar.value
        ? { rotulo: t('internacao.internar.acao'), icone: 'ph ph-first-aid-kit', bloqueada: true }
        : undefined,
    ),
    passo('aparece', 'ph ph-phone'),
  ]
})

const resumo = computed(() => {
  if (!vagas.value || semLeitos.value) return ''
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
    :vazio="semLeitos"
    :vazio-titulo="t('internacao.vazioTitulo')"
    :vazio-descricao="
      cadastraLeitos ? t('internacao.vazioDescricao') : t('internacao.vazioSemCadastro')
    "
    vazio-icone="ph ph-bed"
    :vazio-guia-titulo="t('internacao.vagas.guia.titulo')"
    :vazio-passos="passosDasVagas"
    @tentar-de-novo="carregar"
  >
    <section v-if="vagas" class="ui-folha ui-lista" aria-labelledby="vagas-titulo">
      <h2 id="vagas-titulo" class="sr-only">{{ t('internacao.vagas.titulo') }}</h2>
      <ul class="ui-lista">
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
    </section>
  </UiPagina>
</template>
