<script setup lang="ts">
/**
 * As evoluções da internação (E5-02c, guia e5 15.4 e 16.4): uma por plantão, da mais nova, com os
 * vitais, o texto interno e a gravidade. A do plantão aberto se reescreve (a anterior vai para as
 * versões); a de plantão entregue congela.
 */
import Button from 'primevue/button'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { Gravidade } from '@/service/parceiro/internacao-service'
import {
  listarEvolucoes,
  listarVersoesDaEvolucao,
  type Evolucao,
  type EvolucaoSalva,
  type VersoesDaEvolucao,
} from '@/service/parceiro/plantao-da-internacao-service'

import EvolucaoGaveta from './EvolucaoGaveta.vue'
import { TOM_DA_GRAVIDADE } from './rotulos-da-internacao'

const props = defineProps<{
  internacaoId: string
  gravidadeAtual: Gravidade
  podeEvoluir: boolean
}>()
const emit = defineEmits<{ mudou: []; desatualizada: [] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const itens = ref<Evolucao[]>([])
const cursor = ref<string | null>(null)
const carregando = ref(false)
const erro = ref('')

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await listarEvolucoes(
      props.internacaoId,
      mais ? cursor.value : null,
      parceiroQuery(),
    )
    itens.value = mais ? [...itens.value, ...pagina.itens] : pagina.itens
    cursor.value = pagina.proximoCursor
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.evolucao.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())
watch(
  () => props.internacaoId,
  () => void carregar(),
)

function quando(valor: string) {
  return new Date(valor).toLocaleString(locale.value, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function vitais(item: { vitais: Evolucao['vitais'] }) {
  const formato = new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 })
  const partes: string[] = []
  const v = item.vitais ?? {}
  if (v.temperatura?.valor != null) partes.push(`${formato.format(v.temperatura.valor)} °C`)
  if (v.frequenciaCardiaca?.valor != null) partes.push(`${v.frequenciaCardiaca.valor} bpm`)
  if (v.frequenciaRespiratoria?.valor != null) partes.push(`${v.frequenciaRespiratoria.valor} mpm`)
  return partes.join(' · ')
}

function texto(item: { observado: string | null; avaliacao: string | null; plano: string | null }) {
  return [
    item.observado ? `${t('internacao.evolucao.observado')}: ${item.observado}` : '',
    item.avaliacao ? `${t('internacao.evolucao.avaliacao')}: ${item.avaliacao}` : '',
    item.plano ? `${t('internacao.evolucao.plano')}: ${item.plano}` : '',
  ].filter(Boolean)
}

/* --------------------------------------------------------------------------- versões */

const versoes = ref<Record<string, VersoesDaEvolucao>>({})
const abrindoVersoes = ref<string | null>(null)

async function verVersoes(item: Evolucao) {
  if (versoes.value[item.id]) {
    const copia = { ...versoes.value }
    delete copia[item.id]
    versoes.value = copia
    return
  }
  abrindoVersoes.value = item.id
  try {
    versoes.value = {
      ...versoes.value,
      [item.id]: await listarVersoesDaEvolucao(props.internacaoId, item.id, null, parceiroQuery()),
    }
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.evolucao.erroAoCarregar')).mensagem
  } finally {
    abrindoVersoes.value = null
  }
}

/* ---------------------------------------------------------------------------- escrever */

const gavetaAberta = ref(false)
const editando = ref<Evolucao | null>(null)

function escrever(item: Evolucao | null) {
  editando.value = item
  gavetaAberta.value = true
}

function salva(evolucao: EvolucaoSalva) {
  void carregar()
  if (evolucao.gravidadeMudou) emit('mudou')
}

function desatualizada() {
  void carregar()
  emit('desatualizada')
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="ev-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-notepad" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="ev-titulo" class="ui-cartao__titulo">{{ t('internacao.evolucao.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ t('internacao.evolucao.descricao') }}</p>
      </span>
      <Button
        v-if="podeEvoluir && !(itens[0] && !itens[0].congelada)"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('internacao.evolucao.nova')"
        @click="escrever(null)"
      />
    </header>

    <p v-if="erro" class="eg__erro ev__nota" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <ul v-if="itens.length" class="ui-lista">
      <li v-for="item in itens" :key="item.id" class="ev__item">
        <div class="ui-linha">
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo ev__nome">
              {{ t(`internacao.plantao.kind.${item.plantao.kind}`) }} ·
              {{ quando(item.registradoEm) }}
              <span class="ui-selo" :class="`ui-selo--${TOM_DA_GRAVIDADE[item.gravidade]}`">{{
                t(`internacao.gravidade.${item.gravidade}`)
              }}</span>
            </strong>
            <span class="ui-linha__meta">{{
              [item.profissional.nome, vitais(item)].filter(Boolean).join(' · ')
            }}</span>
            <span v-for="linha in texto(item)" :key="linha" class="ui-linha__meta ev__texto">{{
              linha
            }}</span>
          </span>
          <span class="ui-linha__fim ev__acoes">
            <Button
              v-if="item.versoesAnteriores"
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="
                t(
                  'internacao.evolucao.versoes',
                  { n: item.versoesAnteriores },
                  item.versoesAnteriores,
                )
              "
              :loading="abrindoVersoes === item.id"
              @click="verVersoes(item)"
            />
            <Button
              v-if="podeEvoluir && !item.congelada"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-pencil-simple"
              :label="t('internacao.evolucao.reescrever')"
              @click="escrever(item)"
            />
          </span>
        </div>
        <ul v-if="versoes[item.id]" class="ui-lista ev__versoes">
          <li v-for="versao in versoes[item.id]!.itens" :key="versao.id" class="ui-linha">
            <span class="ui-linha__texto">
              <span class="ui-linha__meta">{{
                t('internacao.evolucao.versao', {
                  quem: versao.profissional.nome,
                  quando: quando(versao.escritaEm),
                  por: versao.substituidaPor.nome,
                })
              }}</span>
              <span class="ui-linha__meta">{{
                [t(`internacao.gravidade.${versao.gravidade}`), vitais(versao)]
                  .filter(Boolean)
                  .join(' · ')
              }}</span>
              <span v-for="linha in texto(versao)" :key="linha" class="ui-linha__meta ev__texto">{{
                linha
              }}</span>
            </span>
          </li>
        </ul>
      </li>
    </ul>
    <p v-else-if="!carregando && !erro" class="ev__nota ev__vazio">
      {{ t('internacao.evolucao.vazio') }}
    </p>

    <Button
      v-if="cursor"
      type="button"
      size="small"
      severity="secondary"
      outlined
      class="ev__mais"
      :label="t('internacao.evolucao.verMais')"
      :loading="carregando"
      @click="carregar(true)"
    />

    <EvolucaoGaveta
      v-model:visible="gavetaAberta"
      :internacao-id="internacaoId"
      :gravidade-atual="gravidadeAtual"
      :editando="editando"
      @salva="salva"
      @desatualizada="desatualizada"
    />
  </section>
</template>

<style scoped>
.ev__nota {
  margin: 0;
  padding: 0 24px 12px;
}

.ev__vazio {
  color: var(--tinta-2);
  font-size: 14px;
}

.ev__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.ev__texto {
  white-space: pre-line;
}

.ev__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.ev__versoes {
  margin: 0 24px 8px;
  border-left: 2px solid var(--linha);
  opacity: 0.85;
}

.ev__mais {
  justify-self: start;
  margin: 4px 24px 16px;
}
</style>
