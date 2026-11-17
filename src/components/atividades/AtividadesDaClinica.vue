<script setup lang="ts">
/**
 * Atividades da clínica pela rota `atividades` (E3-08, PJ-W2RB1D; guia e3 8.5).
 *
 * As pilhas do que ficou para trás, da clínica toda, no desenho da demonstração: um cartão por
 * pilha com o porquê e quantos esperam, e uma linha por paciente com o que falta e a ação. O
 * servidor diz quem vê o quê: pilha ausente é falta de permissão e não aparece (nunca "0");
 * pilha que falhou diz que não carregou, com o tentar de novo. Cada pilha traz até 20 itens e o
 * total real; o resto mora na tela do assunto.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import { lerErroDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { iniciaisDe } from '@/components/meu-dia/useMeuDiaDaClinica'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'
import { rotaDoModulo } from '@/navegacao/rotas-dos-modulos'
import {
  lerAtividades,
  type AtividadesDaClinica,
  type BlocoDoPainel,
  type ItemDoPainel,
} from '@/service/parceiro/painel-service'
import { listarProfissionais } from '@/service/parceiro/profissionais-service'

const { t, locale } = useI18n()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()

/** A ordem das pilhas: o que tem prazo prometido a alguém primeiro, o clínico depois. */
const ORDEM = [
  'pedidosAtrasados',
  'faltasSemJustificativa',
  'retornosVencidos',
  'vacinasAtrasadas',
  'iniciadosNuncaAbertos',
  'rascunhosSemFecho',
  'resumosNaoPublicados',
] as const

type ChaveDaPilha = (typeof ORDEM)[number]

const ICONE: Record<ChaveDaPilha, string> = {
  pedidosAtrasados: 'ph ph-calendar-plus',
  faltasSemJustificativa: 'ph ph-phone-x',
  retornosVencidos: 'ph ph-clock-counter-clockwise',
  vacinasAtrasadas: 'ph ph-syringe',
  iniciadosNuncaAbertos: 'ph ph-door-open',
  rascunhosSemFecho: 'ph ph-note-pencil',
  resumosNaoPublicados: 'ph ph-paper-plane-tilt',
}

/** A tela que mora a lista inteira, quando já fala com a API. */
const TELA_DA_PILHA: Partial<Record<ChaveDaPilha, string>> = {
  pedidosAtrasados: '/clinica/pedidos',
  faltasSemJustificativa: '/clinica/faltas',
}

const resposta = ref<AtividadesDaClinica | null>(null)
const carregando = ref(false)
const erro = ref('')
const profissionais = ref(new Map<string, string>())

type Linha = {
  id: string
  to: RouteLocationRaw
  nome: string
  meta: string
  /** O próximo passo numa frase curta, quando a ação sozinha não diz (o resumo sem app). */
  detalhe?: string
  quando: string
  pesa: boolean
  acao: string
  icone: string
}

type Pilha = {
  chave: ChaveDaPilha
  titulo: string
  porque: string
  icone: string
  total: number
  falhou: boolean
  linhas: Linha[]
  telaInteira: string | null
  /** Quantos itens a API mandou (as linhas podem juntar vários do mesmo paciente). */
  mostrados: number
}

function juntar(partes: Array<string | null | undefined>) {
  return partes.filter(Boolean).join(' · ')
}

function fuso() {
  return resposta.value?.fuso ?? Intl.DateTimeFormat().resolvedOptions().timeZone
}

function momento(iso: string | undefined) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat(rotulos.intl(), {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: fuso(),
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16).replace('T', ' ')
  }
}

function dia(data: string | undefined) {
  if (!data) return ''
  const [a, m, d] = data.slice(0, 10).split('-').map(Number)
  if (!a || !m || !d) return data
  return new Intl.DateTimeFormat(rotulos.intl(), { day: '2-digit', month: '2-digit' }).format(
    new Date(a, m - 1, d),
  )
}

/** "2 h 15 min", "40 min", "3 dias". */
function duracao(minutos: number) {
  if (minutos >= 24 * 60) {
    const dias = Math.floor(minutos / (24 * 60))
    return t('clinico.atividades.api.dias', { total: dias }, dias)
  }
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (!h) return t('agendamentos.duracao.minutos', { m })
  return m
    ? t('agendamentos.duracao.horasMinutos', { h, m })
    : t('agendamentos.duracao.horas', { h })
}

function atraso(dias: number | undefined) {
  return dias && dias > 0
    ? t('clinico.atividades.atraso', { total: dias }, dias)
    : t('clinico.atividades.venceHoje')
}

function ficha(item: ItemDoPainel): RouteLocationRaw {
  return item.pacienteId ? `/clinica/ficha/${item.pacienteId}` : '/clinica/pacientes'
}

function nomeDe(item: ItemDoPainel) {
  return item.pacienteNome ?? t('clinico.atividades.api.semPaciente')
}

function profissionalDe(item: ItemDoPainel) {
  return item.profissionalNome ?? profissionais.value.get(item.profissionalId ?? '') ?? ''
}

/** Nas pilhas do prontuário o `id` é o atendimento: a ação abre ele, e não a ficha. */
function atendimento(item: ItemDoPainel): RouteLocationRaw {
  return `/clinica/atendimento/${item.id}`
}

/** "Aberto por Ana em 09/11, 16:58"; sem o nome, "Aberto em 09/11, 16:58". */
function quemEQuando(chave: 'aberto' | 'iniciado', item: ItemDoPainel) {
  const nome = profissionalDe(item)
  const quando = momento(item.quando)
  if (!quando) return nome
  return nome
    ? t(`clinico.atividades.api.${chave}Por`, { nome, quando })
    : t(`clinico.atividades.api.${chave}Em`, { quando })
}

/*
 * O resumo que não chegou: o que fazer depende do porquê. Não liberado, liberar (no atendimento);
 * sem ligação com o app, ligar (na ficha, com a gaveta aberta); removido ou óbito, só ver.
 */
function acaoDoResumo(item: ItemDoPainel): Pick<Linha, 'to' | 'acao' | 'icone' | 'detalhe'> {
  const motivo = item.motivo ?? 'NAO_LIBERADO'
  const detalhe = t(`clinico.atividades.api.detalhe.${motivo}`)
  if (motivo === 'NAO_LIBERADO') {
    return {
      to: atendimento(item),
      acao: t('clinico.atividades.api.acao.liberarResumo'),
      icone: 'ph ph-paper-plane-tilt',
      detalhe,
    }
  }
  if (motivo === 'SEM_VINCULO' && item.pacienteId) {
    return {
      to: { path: `/clinica/ficha/${item.pacienteId}`, query: { ligar: 'app' } },
      acao: t('clinico.atividades.api.acao.ligarAoApp'),
      icone: 'ph ph-device-mobile',
      detalhe,
    }
  }
  return {
    to: atendimento(item),
    acao: t('clinico.atividades.api.acao.verAtendimento'),
    icone: 'ph ph-file-text',
    detalhe,
  }
}

function linhaDe(chave: ChaveDaPilha, item: ItemDoPainel): Linha {
  const base = { id: `${chave}-${item.id}`, nome: nomeDe(item), icone: ICONE[chave] }
  const verPaciente = t('clinico.atividades.api.acao.verPaciente')

  switch (chave) {
    case 'pedidosAtrasados':
      return {
        ...base,
        to: '/clinica/pedidos',
        meta: t('clinico.atividades.api.prazoEra', { quando: momento(item.quando) }),
        quando: t('clinico.atividades.api.atrasado', { tempo: duracao(item.minutosDeAtraso ?? 0) }),
        pesa: (item.minutosDeAtraso ?? 0) >= 60,
        acao: t('clinico.atividades.api.acao.responder'),
      }
    case 'faltasSemJustificativa':
      return {
        ...base,
        to: {
          path: '/clinica/agenda',
          query: { data: (item.quando ?? '').slice(0, 10), horario: item.id },
        },
        meta: juntar([
          t('clinico.atividades.api.faltouEm', { quando: momento(item.quando) }),
          profissionalDe(item),
        ]),
        quando:
          item.diasDeAtraso && item.diasDeAtraso > 0
            ? t('clinico.atividades.api.haDias', { total: item.diasDeAtraso }, item.diasDeAtraso)
            : t('clinico.atividades.api.hoje'),
        pesa: (item.diasDeAtraso ?? 0) >= 7,
        acao: t('clinico.atividades.api.acao.contato'),
      }
    case 'retornosVencidos':
      return {
        ...base,
        /* Os retornos pendentes marcam pelo atendimento (E4-01): o retorno sai ligado à consulta. */
        to: '/clinica/retornos-pendentes',
        meta: juntar([
          item.tipoNome,
          profissionalDe(item),
          t('clinico.atividades.api.venceu', { dia: dia(item.data) }),
        ]),
        quando: atraso(item.diasDeAtraso),
        pesa: (item.diasDeAtraso ?? 0) >= 7,
        acao: t('clinico.meuDia.marcarRetorno'),
      }
    case 'vacinasAtrasadas':
      /* A ficha abre já na gaveta de aplicar (o mesmo pedido das Ações rápidas). */
      return {
        ...base,
        to: item.pacienteId
          ? { path: `/clinica/ficha/${item.pacienteId}`, query: { aplicar: 'vacina' } }
          : ficha(item),
        meta: juntar([
          item.vacinaNome,
          t('clinico.atividades.api.doseDe', { dia: dia(item.data) }),
        ]),
        quando: atraso(item.diasDeAtraso),
        pesa: (item.diasDeAtraso ?? 0) >= 30,
        acao: item.pacienteId ? t('clinico.atividades.api.acao.aplicarVacina') : verPaciente,
        icone: 'ph ph-syringe',
      }
    case 'iniciadosNuncaAbertos':
      return {
        ...base,
        to: atendimento(item),
        meta: quemEQuando('iniciado', item),
        detalhe: t('clinico.atividades.api.detalhe.nuncaAberto'),
        quando: t('clinico.atividades.api.iniciadoHa', { tempo: duracao((item.horas ?? 0) * 60) }),
        pesa: (item.horas ?? 0) >= 2,
        acao: t('clinico.atividades.api.acao.abrirProntuario'),
        icone: 'ph ph-door-open',
      }
    case 'rascunhosSemFecho':
      return {
        ...base,
        to: atendimento(item),
        meta: quemEQuando('aberto', item),
        quando: t('clinico.atividades.api.abertoHa', { tempo: duracao((item.horas ?? 0) * 60) }),
        pesa: (item.horas ?? 0) >= 24,
        acao: t('clinico.atividades.api.acao.continuar'),
        icone: 'ph ph-note-pencil',
      }
    case 'resumosNaoPublicados':
      return {
        ...base,
        ...acaoDoResumo(item),
        meta: juntar([
          item.motivo ? t(`clinico.atividades.api.motivo.${item.motivo}`) : '',
          profissionalDe(item),
        ]),
        quando: t('clinico.atividades.api.finalizadoEm', { quando: momento(item.quando) }),
        pesa: false,
      }
  }
}

/*
 * Os resumos sem ligação com o app são do paciente, não do atendimento: ligar uma vez resolve
 * todos. Uma linha por paciente, com quantos atendimentos esperam e o mais recente.
 */
function linhasDaPilha(chave: ChaveDaPilha, itens: ItemDoPainel[]): Linha[] {
  if (chave !== 'resumosNaoPublicados') return itens.map((item) => linhaDe(chave, item))

  const porPaciente = new Map<string, ItemDoPainel[]>()
  const linhas: Array<Linha | string> = []
  for (const item of itens) {
    if (item.motivo === 'SEM_VINCULO' && item.pacienteId) {
      const grupo = porPaciente.get(item.pacienteId)
      if (grupo) grupo.push(item)
      else {
        porPaciente.set(item.pacienteId, [item])
        linhas.push(item.pacienteId)
      }
    } else {
      linhas.push(linhaDe(chave, item))
    }
  }

  return linhas.map((linha) => {
    if (typeof linha !== 'string') return linha
    const grupo = porPaciente.get(linha)!
    const recente = [...grupo].sort((a, b) => (b.quando ?? '').localeCompare(a.quando ?? ''))[0]!
    const base = linhaDe(chave, recente)
    if (grupo.length === 1) return base
    return {
      ...base,
      meta: juntar([
        t('clinico.atividades.api.motivo.SEM_VINCULO'),
        t('clinico.atividades.api.atendimentosDoPaciente', { n: grupo.length }, grupo.length),
      ]),
      quando: t('clinico.atividades.api.ultimoEm', { quando: momento(recente.quando) }),
    }
  })
}

const pilhas = computed<Pilha[]>(() => {
  const lidas = resposta.value?.pilhas ?? {}
  return ORDEM.flatMap((chave) => {
    const bloco: BlocoDoPainel | undefined = lidas[chave]
    if (!bloco) return []
    if (!bloco.falhou && !bloco.total) return []
    const tela = TELA_DA_PILHA[chave]
    return [
      {
        chave,
        titulo: t(`clinico.atividades.api.pilha.${chave}.titulo`),
        porque: t(`clinico.atividades.api.pilha.${chave}.porque`),
        icone: ICONE[chave],
        total: bloco.total ?? 0,
        falhou: bloco.falhou,
        linhas: bloco.falhou ? [] : linhasDaPilha(chave, bloco.itens),
        telaInteira: tela && rotaDoModulo(tela)?.integrada ? tela : null,
        mostrados: bloco.falhou ? 0 : bloco.itens.length,
      },
    ]
  })
})

const vazio = computed(
  () => !carregando.value && !erro.value && Boolean(resposta.value) && pilhas.value.length === 0,
)

/** "2 pedidos com o prazo vencido e 3 faltas sem justificativa." */
const fraseDoResumo = computed(() => {
  if (!resposta.value) return ''
  const partes = pilhas.value
    .filter((pilha) => !pilha.falhou && pilha.total > 0)
    .map((pilha) =>
      t(`clinico.atividades.api.pilha.${pilha.chave}.resumo`, { total: pilha.total }, pilha.total),
    )
  if (!partes.length) return t('clinico.atividades.api.emDia')
  const tag = INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE]
  return t('clinico.atividades.resumo.frase', {
    lista: new Intl.ListFormat(tag, { type: 'conjunction' }).format(partes),
  })
})

async function carregarNomes() {
  try {
    const lista = await listarProfissionais(parceiroQuery())
    profissionais.value = new Map(lista.map((p) => [p.id, p.nome]))
  } catch {
    /* Sem os nomes, a falta fica sem quem atenderia: o resto vale. */
  }
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    resposta.value = await lerAtividades(parceiroQuery())
  } catch (err) {
    erro.value = lerErroDaAgenda(err, t('clinico.atividades.api.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => {
  void carregarNomes()
  void carregar()
})
</script>

<template>
  <UiPagina
    :resumo="fraseDoResumo"
    :carregando="carregando && !resposta"
    :erro="erro"
    :vazio="vazio"
    :vazio-titulo="t('clinico.atividades.vazioTitulo')"
    :vazio-descricao="t('clinico.atividades.api.vazioDescricao')"
    vazio-icone="ph ph-check-circle"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <div class="atividades">
      <section
        v-for="pilha in pilhas"
        :key="pilha.chave"
        class="pilha ui-folha ui-cartao"
        :aria-labelledby="`atividades-${pilha.chave}-titulo`"
      >
        <header class="ui-cartao__cabeca">
          <span
            class="ui-ladrilho"
            :class="{ 'ui-ladrilho--atencao': pilha.linhas.some((linha) => linha.pesa) }"
            aria-hidden="true"
          >
            <i :class="pilha.icone" />
          </span>
          <span class="ui-cartao__titulos">
            <h2 :id="`atividades-${pilha.chave}-titulo`" class="ui-cartao__titulo">
              {{ pilha.titulo }}
            </h2>
            <p class="ui-cartao__descricao">{{ pilha.porque }}</p>
          </span>
          <span v-if="!pilha.falhou" class="ui-cartao__total">{{ pilha.total }}</span>
        </header>

        <!-- A leitura desta pilha passou do tempo: só ela falta. -->
        <p v-if="pilha.falhou" class="pilha__falhou" role="status">
          <i class="ph ph-cloud-slash" aria-hidden="true" />
          <span>{{ t('clinico.atividades.api.falhou') }}</span>
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('clinico.meuDia.tentarDeNovo')"
            :loading="carregando"
            @click="carregar"
          />
        </p>

        <ul v-else class="ui-lista">
          <li v-for="linha in pilha.linhas" :key="linha.id">
            <RouterLink
              class="ui-linha atividade"
              :class="{ 'ui-marca ui-marca--atencao': linha.pesa }"
              :to="linha.to"
            >
              <PetAvatar
                :nome="linha.nome"
                :iniciais="iniciaisDe(linha.nome)"
                :especie="null"
                foto-url=""
                tamanho="md"
              />

              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo">{{ linha.nome }}</strong>
                <span v-if="linha.meta" class="ui-linha__meta atividade__meta">{{
                  linha.meta
                }}</span>
                <span v-if="linha.detalhe" class="atividade__detalhe">
                  <i class="ph ph-arrow-bend-down-right" aria-hidden="true" />
                  {{ linha.detalhe }}
                </span>
              </span>

              <span class="ui-linha__fim atividade__fim">
                <span class="atividade__quando">
                  <span v-if="linha.pesa" class="ui-selo ui-selo--atencao">
                    <i class="ph ph-clock" aria-hidden="true" />
                    {{ linha.quando }}
                  </span>
                  <span v-else-if="linha.quando" class="atividade__tempo">{{ linha.quando }}</span>
                </span>

                <!-- Desenho de botão, não botão: quem age é a linha inteira (um link só). -->
                <span class="atividade__acao">
                  <i :class="linha.icone" aria-hidden="true" />
                  {{ linha.acao }}
                </span>
              </span>
            </RouterLink>
          </li>
        </ul>

        <!-- Até 20 por pilha: o resto mora na tela do assunto. -->
        <p v-if="!pilha.falhou && pilha.total > pilha.mostrados" class="pilha__resto">
          {{ t('clinico.atividades.api.mostrando', { n: pilha.mostrados, total: pilha.total }) }}
          <RouterLink v-if="pilha.telaInteira" :to="pilha.telaInteira">
            {{ t('clinico.atividades.api.verTudo') }}
            <i class="ph ph-arrow-right" aria-hidden="true" />
          </RouterLink>
        </p>
      </section>
    </div>
  </UiPagina>
</template>

<style scoped>
.atividades {
  display: grid;
  gap: 24px;
}

.atividade {
  padding-block: 12px;
}

/* Embaixo do cabeçalho, a primeira linha não leva o raio de cima: só a última, o de baixo. */
.pilha .ui-lista > li:first-child > .ui-linha {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.atividade__meta {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

/* O próximo passo, embaixo da frase: miúdo, com a seta de "então". */
.atividade__detalhe {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 12.5px;
}

.atividade__detalhe i {
  flex: none;
  font-size: 13px;
}

.atividade__fim {
  gap: 16px;
}

/* A coluna do tempo tem largura própria: selo e texto alinham numa linha só, de cima a baixo. */
.atividade__quando {
  display: flex;
  min-width: 152px;
  justify-content: flex-end;
}

.atividade__tempo {
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* O desenho do botão secundário do acabamento: papel, fio médio e sombra rente. */
.atividade__acao {
  display: inline-flex;
  min-width: 200px;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--linha-media);
  border-radius: var(--raio-controle);
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  transition:
    background-color var(--pj-tempo-curto) ease,
    border-color var(--pj-tempo-curto) ease;
}

.atividade__acao i {
  color: var(--pj-lugar-tinta, var(--musgo));
  font-size: 16px;
}

.atividade:hover .atividade__acao {
  border-color: color-mix(in oklab, var(--linha-media) 60%, var(--tinta-3));
  background: var(--superficie-2);
}

.pilha__falhou,
.pilha__resto {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  padding: 12px 16px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.pilha__resto a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tinta);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* Em tela estreita o tempo e a ação descem para baixo do nome, alinhados ao texto. */
@media (max-width: 760px) {
  .atividade {
    flex-wrap: wrap;
    row-gap: 10px;
  }

  .atividade .ui-linha__texto {
    flex: 1 1 0;
  }

  .atividade__fim {
    flex: 1 1 100%;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px 12px;
    padding-inline-start: 54px;
  }

  .atividade__quando {
    min-width: 0;
    justify-content: flex-start;
  }

  .atividade__acao {
    min-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .atividade__acao {
    transition: none;
  }
}
</style>
