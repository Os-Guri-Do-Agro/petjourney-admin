<script setup lang="ts">
/**
 * As ocorrências da estadia (E7-05b, guia e7 43). A GRAVE vem primeiro e pintada pelo
 * `travaAPassagem`: enquanto falta a ligação ao responsável, a passagem do turno e o check-out
 * seguram, e o boletim fica retido (`semContato`) até o contato de verdade.
 *
 * Na GRAVE ainda sem contato: "Registrar a ligação" (o telefone só depois de um toque, lá dentro),
 * o "sem resposta" do gestor e, antes da primeira tentativa, o "rebaixar" do gestor. As leves e
 * moderadas também aparecem no diário (uma fonte por fato).
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import {
  listarOcorrencias,
  type ContatoDoResponsavel,
  type Ocorrencia,
} from '@/service/parceiro/hotel-ocorrencias-service'
import { listarProfissionais, type Profissional } from '@/service/parceiro/profissionais-service'

import GravidadeGaveta from './GravidadeGaveta.vue'
import LigacaoDaOcorrenciaGaveta from './LigacaoDaOcorrenciaGaveta.vue'
import OcorrenciaGaveta from './OcorrenciaGaveta.vue'
import { ocorrenciasNaOrdem, pedeLigacao, podeRebaixarGrave } from './rotina-do-hotel'
import SemRespostaGaveta from './SemRespostaGaveta.vue'

const props = defineProps<{ hospedagemId: string; podeEscrever: boolean }>()
const emit = defineEmits<{ mudou: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()

const ocorrencias = ref<Ocorrencia[]>([])
const carregado = ref(false)
const erro = ref('')
const recado = ref('')
const profissionais = ref<Profissional[]>([])
/**
 * O telefone já lido de cada ocorrência, só na memória desta tela: visto, fica até a ligação ser
 * registrada (cada leitura é gravada e tem limite).
 */
const telefones = ref(new Map<string, ContatoDoResponsavel>())

async function carregar() {
  try {
    ocorrencias.value = await listarOcorrencias(props.hospedagemId, parceiroQuery())
    erro.value = ''
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('rotinaDoHotel.ocorrencia.erroAoCarregar')).mensagem
  } finally {
    carregado.value = true
  }
}

defineExpose({ carregar })

onMounted(async () => {
  void carregar()
  if (props.podeEscrever)
    profissionais.value = await listarProfissionais({ ...parceiroQuery(), ativo: true }).catch(
      () => [],
    )
})
watch(
  () => props.hospedagemId,
  () => {
    telefones.value = new Map()
    void carregar()
  },
)

const lista = computed(() => ocorrenciasNaOrdem(ocorrencias.value))
const gestor = computed(() => store.temPermissao('estabelecimento.editar'))
const travam = computed(() => ocorrencias.value.filter((item) => item.travaAPassagem).length)

const TOM_DA_GRAVIDADE = { LEVE: 'contorno', MODERADA: 'atencao', GRAVE: 'risco' } as const

function situacao(item: Ocorrencia) {
  if (!item.exigeContato) return null
  if (item.contato) return { tom: 'ok', texto: t('rotinaDoHotel.ocorrencia.comunicada') }
  if (item.semResposta) return { tom: 'atencao', texto: t('rotinaDoHotel.ocorrencia.semResposta') }
  return { tom: 'risco', texto: t('rotinaDoHotel.ocorrencia.faltaLigar') }
}

function meta(item: Ocorrencia) {
  return [
    rotulos.quando(item.registradaEm),
    item.registradaPorNome ?? '',
    item.encaminhadaAoVeterinario ? t('rotinaDoHotel.ocorrencia.encaminhadaCurta') : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function contato(item: Ocorrencia) {
  if (item.contato)
    return t('rotinaDoHotel.ocorrencia.contatoFeito', {
      nome: item.contato.porNome ?? '',
      quando: rotulos.quando(item.contato.em),
      canal: t(`rotinaDoHotel.ligacao.canal.${item.contato.canal}`),
    })
  if (item.semResposta)
    return t('rotinaDoHotel.ocorrencia.semRespostaNota', { nota: item.semResposta.nota })
  if (item.exigeContato && item.tentativas)
    return t(
      'rotinaDoHotel.ocorrencia.tentativasSemResposta',
      { n: item.tentativas, m: item.tentativasSemResposta },
      item.tentativas,
    )
  return ''
}

/* ------------------------------------------------------------------------------- gavetas */

const novaAberta = ref(false)
const ligacaoAberta = ref(false)
const semRespostaAberta = ref(false)
const gravidadeAberta = ref(false)
const escolhida = ref<Ocorrencia | null>(null)

const telefoneDaEscolhida = computed({
  get: () => (escolhida.value ? (telefones.value.get(escolhida.value.id) ?? null) : null),
  set: (valor) => {
    if (!escolhida.value) return
    const proximo = new Map(telefones.value)
    if (valor) proximo.set(escolhida.value.id, valor)
    else proximo.delete(escolhida.value.id)
    telefones.value = proximo
  },
})

function abrir(item: Ocorrencia, qual: 'ligacao' | 'semResposta' | 'gravidade') {
  escolhida.value = item
  recado.value = ''
  if (qual === 'ligacao') ligacaoAberta.value = true
  if (qual === 'semResposta') semRespostaAberta.value = true
  if (qual === 'gravidade') gravidadeAberta.value = true
}

function podeMudarGravidade(item: Ocorrencia) {
  if (item.gravidade !== 'GRAVE') return true
  return gestor.value && podeRebaixarGrave(item)
}

function mudou(texto = '') {
  recado.value = texto
  invalidarPendenciasDoPortal()
  void carregar()
  emit('mudou')
}

function registrada(item: Ocorrencia) {
  mudou(
    item.gravidade === 'GRAVE'
      ? t('rotinaDoHotel.ocorrencia.registradaGrave')
      : t('rotinaDoHotel.ocorrencia.registrada'),
  )
}
</script>

<template>
  <section id="ocorrencias" class="ui-folha ui-cartao" aria-labelledby="oc-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-warning-diamond" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="oc-titulo" class="ui-cartao__titulo">{{ t('rotinaDoHotel.ocorrencia.titulo') }}</h2>
        <p class="ui-cartao__descricao">
          {{
            travam
              ? t('rotinaDoHotel.ocorrencia.travam', { n: travam }, travam)
              : t('rotinaDoHotel.ocorrencia.sobre')
          }}
        </p>
      </span>
      <Button
        v-if="podeEscrever"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('rotinaDoHotel.ocorrencia.registrar')"
        @click="novaAberta = true"
      />
    </header>

    <p v-if="recado" class="eg__aviso oe__nota" role="status">
      <i class="ph ph-check-circle" aria-hidden="true" />
      <span>{{ recado }}</span>
    </p>
    <p v-if="erro" class="eg__erro oe__nota" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <ul v-if="lista.length" class="ui-lista">
      <li
        v-for="item in lista"
        :key="item.id"
        class="ui-linha oe__item"
        :class="{
          'ui-marca ui-marca--risco': item.travaAPassagem,
          'ui-marca ui-marca--atencao': !item.travaAPassagem && item.semContato,
        }"
      >
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo oe__nome">
            {{ t(`rotinaDoHotel.ocorrencia.kind.${item.kind}`) }}
            <span class="ui-selo" :class="`ui-selo--${TOM_DA_GRAVIDADE[item.gravidade]}`">{{
              t(`rotinaDoHotel.ocorrencia.gravidade.${item.gravidade}`)
            }}</span>
            <span
              v-if="situacao(item)"
              class="ui-selo"
              :class="`ui-selo--${situacao(item)!.tom}`"
              >{{ situacao(item)!.texto }}</span
            >
          </strong>
          <span class="oe__texto">{{ item.descricao }}</span>
          <span class="ui-linha__meta">{{
            t('rotinaDoHotel.ocorrencia.condutaFeita', { conduta: item.conduta })
          }}</span>
          <span class="ui-linha__meta">{{ meta(item) }}</span>
          <span v-if="contato(item)" class="ui-linha__meta">{{ contato(item) }}</span>
          <span
            v-if="podeEscrever && pedeLigacao(item) && telefones.get(item.id)"
            class="oe__telefone"
          >
            <i class="ph ph-phone" aria-hidden="true" />
            {{
              [
                telefones.get(item.id)!.responsavel.nome,
                telefones.get(item.id)!.responsavel.telefone ?? '',
              ]
                .filter(Boolean)
                .join(' · ')
            }}
          </span>
          <span v-if="podeEscrever" class="oe__acoes">
            <Button
              v-if="pedeLigacao(item)"
              type="button"
              size="small"
              icon="ph ph-phone-call"
              :label="t('rotinaDoHotel.ligacao.titulo')"
              @click="abrir(item, 'ligacao')"
            />
            <Button
              v-if="gestor && item.travaAPassagem && item.tentativas > 0"
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('rotinaDoHotel.semResposta.titulo')"
              @click="abrir(item, 'semResposta')"
            />
            <Button
              v-if="podeMudarGravidade(item)"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrows-down-up"
              :aria-label="t('rotinaDoHotel.gravidade.titulo')"
              :title="t('rotinaDoHotel.gravidade.titulo')"
              @click="abrir(item, 'gravidade')"
            />
          </span>
        </span>
      </li>
    </ul>
    <p v-else-if="carregado && !erro" class="oe__nota oe__vazio">
      {{ t('rotinaDoHotel.ocorrencia.vazio') }}
    </p>

    <OcorrenciaGaveta
      v-model:visible="novaAberta"
      :hospedagem-id="hospedagemId"
      @registrada="registrada"
    />
    <LigacaoDaOcorrenciaGaveta
      v-model:visible="ligacaoAberta"
      v-model:telefone="telefoneDaEscolhida"
      :ocorrencia="escolhida"
      :profissionais="profissionais"
      @registrada="mudou(t('rotinaDoHotel.ligacao.registrada'))"
      @releia="carregar"
    />
    <SemRespostaGaveta
      v-model:visible="semRespostaAberta"
      :ocorrencia="escolhida"
      @registrada="mudou(t('rotinaDoHotel.semResposta.registrado'))"
    />
    <GravidadeGaveta
      v-model:visible="gravidadeAberta"
      :ocorrencia="escolhida"
      :pode-rebaixar-grave="Boolean(escolhida && gestor && podeRebaixarGrave(escolhida))"
      @mudada="mudou(t('rotinaDoHotel.gravidade.mudada'))"
    />
  </section>
</template>

<style scoped>
.oe__nota {
  margin: 0;
  padding: 0 10px 12px;
}

.oe__vazio {
  color: var(--tinta-2);
  font-size: 14px;
}

.oe__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.oe__texto {
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
}

.oe__telefone {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

/* As ações embaixo do texto: a ocorrência tem frase longa e precisa da largura da linha. */
.oe__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
</style>
