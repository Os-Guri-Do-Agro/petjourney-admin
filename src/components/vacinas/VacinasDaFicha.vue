<script setup lang="ts">
/**
 * As vacinas na ficha do paciente (E4-04, PJ-VQVQ0C; guia e4 3.2 a 3.5).
 *
 * O plano vem pronto da API (a ordem é a da ação: atrasada, devida, a vencer, não iniciada,
 * aguarda idade, em dia), cortado na dose da vez e na seguinte; os pontos da série saem do `total`.
 * O histórico, com as anuladas riscadas, fica recolhido. Aplicar, registrar de outro lugar e anular
 * só para quem tem `vacina.aplicar`.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import AnularAplicacaoGaveta from '@/components/vacinas/AnularAplicacaoGaveta.vue'
import AplicarVacinaGaveta from '@/components/vacinas/AplicarVacinaGaveta.vue'
import DoseExternaGaveta from '@/components/vacinas/DoseExternaGaveta.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { lerPacote, type Vacina } from '@/service/parceiro/catalogos-service'
import { listarProfissionais } from '@/service/parceiro/profissionais-service'
import {
  lerHistorico,
  lerPlano,
  pontosDaSerie,
  type Aplicacao,
  type HistoricoDeVacinas,
  type PlanoVacinal,
  type ResultadoDaAplicacao,
  type VacinaNoPlano,
} from '@/service/parceiro/vacinacao-service'

const props = defineProps<{
  pacienteId: string
  especie: string
  ativo: boolean
  responsavel: string
}>()

const { t, te } = useI18n()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const plano = ref<PlanoVacinal | null>(null)
const historico = ref<HistoricoDeVacinas | null>(null)
const vacinas = ref<Vacina[]>([])
const profissionais = ref<{ id: string; nome: string }[]>([])
const carregando = ref(false)
const erro = ref('')
const historicoAberto = ref(false)
const opcionaisAbertas = ref(false)
/** O que a última aplicação disse: a dose, a carteirinha do app, a próxima dose, os avisos. */
const recado = ref<string[]>([])

const gavetaAplicar = ref(false)
const gavetaExterna = ref(false)
const gavetaAnular = ref(false)
const vacinaInicial = ref<string | null>(null)
const aAnular = ref<Aplicacao | null>(null)

const podeAplicar = computed(
  () =>
    props.ativo &&
    Boolean(store.modulo('CLINICA')?.podeEscrever) &&
    store.temPermissao('vacina.aplicar'),
)

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const [lido, lidos] = await Promise.all([
      lerPlano(props.pacienteId, parceiroQuery()),
      lerHistorico(props.pacienteId, parceiroQuery()),
    ])
    plano.value = lido
    historico.value = lidos
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('vacinas.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

/** As vacinas da espécie e os profissionais, só quando alguém vai aplicar. */
async function prepararFormulario() {
  if (vacinas.value.length && profissionais.value.length) return
  try {
    const [pacote, lista] = await Promise.all([
      lerPacote(parceiroQuery()),
      listarProfissionais({ ...parceiroQuery(), ativo: true }),
    ])
    vacinas.value = pacote.vacinas.filter(
      (v) => v.ativo && (v.especies as string[]).includes(props.especie),
    )
    profissionais.value = lista.map((p) => ({ id: p.id, nome: p.nome }))
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('vacinas.erro.carregar')).mensagem
  }
}

async function abrirAplicar(vacinaId: string | null = null) {
  await prepararFormulario()
  vacinaInicial.value = vacinaId
  gavetaAplicar.value = true
}

async function abrirExterna() {
  await prepararFormulario()
  gavetaExterna.value = true
}

function abrirAnular(aplicacao: Aplicacao) {
  aAnular.value = aplicacao
  gavetaAnular.value = true
}

function aplicada(resultado: ResultadoDaAplicacao) {
  const linhas = [
    t('vacinas.recado.dose', {
      vacina: resultado.vacina.nome,
      dose: resultado.dose,
      total: resultado.dosesNaSerie,
    }),
  ]
  if (resultado.publicacao.publicada) {
    linhas.push(t('vacinas.recado.noApp', { responsavel: props.responsavel }))
  }
  if (resultado.marcacao.status === 'MARCADA') linhas.push(t('vacinas.recado.marcada'))
  if (resultado.marcacao.status === 'RECUSADA') linhas.push(t('vacinas.recado.naoMarcada'))
  for (const aviso of resultado.avisos) {
    const chave = `vacinas.recado.aviso.${aviso}`
    if (te(chave)) linhas.push(t(chave))
  }
  recado.value = linhas
  void carregar()
}

/** Outra escrita (anular, dose de outro lugar): o recado da aplicação já não vale. */
function mudou() {
  recado.value = []
  void carregar()
}

watch(() => props.pacienteId, mudou)
onMounted(carregar)

/* --------------------------------------------------------------------------- leitura */

const TOM: Record<VacinaNoPlano['situacao'], string> = {
  ATRASADA: 'risco',
  DEVIDA: 'atencao',
  A_VENCER: 'atencao',
  NAO_INICIADA: 'atencao',
  AGUARDA_IDADE: '',
  EM_DIA: 'ok',
}

function proximaFrase(vacina: VacinaNoPlano) {
  const proxima = vacina.proxima
  if (!proxima) return vacina.serieCompleta ? t('vacinas.plano.serieCompleta') : ''
  const dia = rotulos.dia(proxima.em.slice(0, 10))
  const qual =
    proxima.tipo === 'REFORCO'
      ? t('vacinas.plano.reforco')
      : t('vacinas.plano.dose', { n: proxima.numero, total: proxima.total })
  if (proxima.estado === 'AGUARDA_IDADE') return t('vacinas.plano.aPartirDe', { qual, dia })
  if (proxima.agendamento)
    return t('vacinas.plano.marcada', {
      qual,
      dia: rotulos.dia(proxima.agendamento.inicio.slice(0, 10)),
    })
  return t('vacinas.plano.proxima', { qual, dia })
}

const aplicacoes = computed(() => historico.value?.itens ?? [])

function linhaDoHistorico(aplicacao: Aplicacao) {
  return [
    rotulos.dia(aplicacao.aplicadaEm.slice(0, 10)),
    t('vacinas.plano.dose', { n: aplicacao.dose, total: aplicacao.dosesNaSerie }),
    aplicacao.lote ? t('vacinas.historico.lote', { codigo: aplicacao.lote.codigo }) : '',
    aplicacao.origem === 'EXTERNA' && aplicacao.externa
      ? t('vacinas.historico.externa', { local: aplicacao.externa.local })
      : aplicacao.profissional.nome,
  ]
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <section class="ui-folha ui-cartao vf" aria-labelledby="vf-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span
        class="ui-ladrilho"
        :class="{ 'ui-ladrilho--risco': (plano?.atrasadas ?? 0) > 0 }"
        aria-hidden="true"
      >
        <i class="ph ph-syringe" />
      </span>
      <span class="ui-cartao__titulos">
        <h2 id="vf-titulo" class="ui-cartao__titulo">{{ t('vacinas.titulo') }}</h2>
        <p v-if="plano" class="ui-cartao__descricao">
          {{
            plano.atrasadas || plano.devidas
              ? t('vacinas.plano.resumo', { atrasadas: plano.atrasadas, devidas: plano.devidas })
              : t('vacinas.plano.emDia')
          }}
        </p>
      </span>
      <Button
        v-if="podeAplicar"
        type="button"
        size="small"
        icon="ph ph-syringe"
        :label="t('vacinas.aplicar.titulo')"
        @click="abrirAplicar()"
      />
    </header>

    <p v-if="erro" class="vf__nota vf__erro" role="alert">{{ erro }}</p>

    <ul v-if="recado.length" class="vf__recado" role="status">
      <li v-for="(linha, indice) in recado" :key="indice">{{ linha }}</li>
    </ul>

    <ul v-if="plano?.vacinas.length" class="ui-lista">
      <li v-for="item in plano.vacinas" :key="item.vacina.id" class="ui-linha vf__vacina">
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo vf__nome">
            {{ item.vacina.nome }}
            <span
              class="ui-selo"
              :class="TOM[item.situacao] ? `ui-selo--${TOM[item.situacao]}` : ''"
              >{{ t(`vacinas.situacao.${item.situacao}`) }}</span
            >
          </strong>
          <span class="ui-linha__meta">{{ proximaFrase(item) }}</span>
        </span>
        <span
          class="ui-linha__fim vf__serie"
          :aria-label="t('vacinas.plano.serie', { n: item.aplicadasNaSerie, total: item.total })"
        >
          <span
            v-for="(ponto, indice) in pontosDaSerie(item)"
            :key="indice"
            class="vf__ponto"
            :class="{ 'vf__ponto--dado': ponto === 'dada' }"
            aria-hidden="true"
          />
          <Button
            v-if="podeAplicar && item.situacao !== 'EM_DIA' && item.situacao !== 'AGUARDA_IDADE'"
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('vacinas.plano.aplicar')"
            @click="abrirAplicar(item.vacina.id)"
          />
        </span>
      </li>
    </ul>
    <p v-else-if="plano" class="vf__nota">{{ t('vacinas.plano.vazio') }}</p>

    <p v-if="plano?.truncado && plano.vacinasOmitidas" class="vf__nota">
      {{ t('vacinas.plano.eMais', { n: plano.vacinasOmitidas }) }}
    </p>

    <!-- Opcional não iniciada fica recolhida: nunca é pendência. -->
    <div v-if="plano?.opcionaisNaoIniciadas.length" class="vf__recolhido">
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :icon="opcionaisAbertas ? 'ph ph-caret-up' : 'ph ph-caret-down'"
        :label="t('vacinas.plano.opcionais', { n: plano.opcionaisNaoIniciadas.length })"
        :aria-expanded="opcionaisAbertas"
        @click="opcionaisAbertas = !opcionaisAbertas"
      />
      <p v-if="opcionaisAbertas" class="vf__nota">
        {{ plano.opcionaisNaoIniciadas.map((o) => o.nome).join(', ') }}
      </p>
    </div>

    <!-- O histórico, com as anuladas riscadas. -->
    <div class="vf__recolhido">
      <span class="vf__acoes">
        <Button
          v-if="aplicacoes.length"
          type="button"
          size="small"
          severity="secondary"
          outlined
          :icon="historicoAberto ? 'ph ph-caret-up' : 'ph ph-caret-down'"
          :label="t('vacinas.historico.titulo', { n: aplicacoes.length })"
          :aria-expanded="historicoAberto"
          @click="historicoAberto = !historicoAberto"
        />
        <Button
          v-if="podeAplicar"
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-file-text"
          :label="t('vacinas.externa.titulo')"
          @click="abrirExterna"
        />
      </span>
      <ul v-if="historicoAberto" class="ui-lista">
        <li
          v-for="aplicacao in aplicacoes"
          :key="aplicacao.id"
          class="ui-linha"
          :class="{ vf__anulada: aplicacao.anulada }"
        >
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">{{ aplicacao.vacina.nome }}</strong>
            <span class="ui-linha__meta">{{ linhaDoHistorico(aplicacao) }}</span>
            <span v-if="aplicacao.anulada" class="ui-linha__meta">
              {{ t('vacinas.historico.anulada', { motivo: aplicacao.anulada.motivo }) }}
            </span>
            <span v-else-if="aplicacao.observacao" class="ui-linha__meta">{{
              aplicacao.observacao
            }}</span>
          </span>
          <span v-if="podeAplicar && !aplicacao.anulada" class="ui-linha__fim">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('vacinas.anular.titulo')"
              @click="abrirAnular(aplicacao)"
            />
          </span>
        </li>
      </ul>
      <p v-if="historico?.truncado && historicoAberto" class="vf__nota">
        {{ t('vacinas.historico.truncado') }}
      </p>
    </div>

    <p class="vf__nota">
      <RouterLink to="/clinica/vacinas">{{ t('vacinas.verChamada') }}</RouterLink>
    </p>

    <AplicarVacinaGaveta
      v-model:visible="gavetaAplicar"
      :paciente-id="pacienteId"
      :vacinas="vacinas"
      :profissionais="profissionais"
      :vacina-inicial="vacinaInicial"
      @aplicada="aplicada"
    />
    <DoseExternaGaveta
      v-model:visible="gavetaExterna"
      :paciente-id="pacienteId"
      :vacinas="vacinas"
      :profissionais="profissionais"
      @registrada="mudou"
    />
    <AnularAplicacaoGaveta v-model:visible="gavetaAnular" :aplicacao="aAnular" @anulada="mudou" />
  </section>
</template>

<style scoped>
.vf__nota {
  margin: 0;
  padding: 8px 16px 12px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.vf__nota a {
  color: var(--tinta);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.vf__erro {
  color: var(--risco-tinta);
}

.vf__recado {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 10px 16px;
  color: var(--tinta);
  font-size: 13.5px;
  list-style: none;
  background: var(--superficie-2);
}

.vf__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.vf__serie {
  display: flex;
  align-items: center;
  gap: 5px;
}

.vf__ponto {
  width: 9px;
  height: 9px;
  border: 1.5px solid var(--tinta-3);
  border-radius: 999px;
}

.vf__ponto--dado {
  border-color: var(--tinta);
  background: var(--tinta);
}

.vf__serie .p-button {
  margin-inline-start: 8px;
}

.vf__recolhido {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 4px 16px 8px;
}

.vf__recolhido .ui-lista {
  justify-self: stretch;
}

.vf__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.vf__anulada .ui-linha__titulo,
.vf__anulada .ui-linha__meta:first-of-type {
  text-decoration: line-through;
}
</style>
