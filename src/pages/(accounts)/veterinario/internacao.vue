<script setup lang="ts">
/**
 * Internação — o mapa de leitos.
 *
 * É a tela que responde às duas perguntas que a clínica faz o dia inteiro sobre internação:
 * **quem precisa de mim agora** e **onde há vaga**. Por isso ela tem duas partes, nessa ordem:
 * a lista do que pede ação no plantão, e o mapa — onde o leito vazio ocupa espaço na grade,
 * porque a vaga é informação.
 *
 * ## A forma (redesenho de 30/09/2026)
 *
 * A da Visão geral. Saíram a fileira de quatro cartões de número e a faixa vermelha do boletim:
 *
 * - **A saudação** leva o plantão na linha pequena (turno, horário, quem está de plantão), a
 *   ocupação na frase de estado e "Passar plantão" como a pílula cheia — o rito desta tela.
 * - **O que pede ação no plantão** é a pauta (`PautaTabela`): boletim retido e administração
 *   atrasada como urgentes, e a administração da próxima hora como atenção, para a enfermagem ver
 *   o que vem antes de atrasar. Cada linha abre o paciente.
 * - **O mapa** agrupa os leitos por tipo (Geral, Felino, UTI, Isolamento), com a ocupação de cada
 *   grupo: "tem vaga para um gato?" se responde sem contar cartão. O cartão é neutro; a urgência
 *   mora nos selos dele (`LeitoCard`).
 *
 * O boletim retido continua vindo antes de tudo — agora como a primeira linha da lista, com o selo
 * de urgente. É a única coisa desta tela que não pode esperar o fim do turno.
 */
import {
  PhArrowsLeftRight,
  PhBed,
  PhClipboardText,
  PhCheckCircle,
  PhGearSix,
} from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PautaTabela from '@/components/home/PautaTabela.vue'
import { porGravidade, type LinhaDaTabela } from '@/components/home/pauta-tabela'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicDevPanel from '@/features/clinico/components/base/ClinicDevPanel.vue'
import GerenciarLeitosDialog from '@/features/clinico/components/internacao/GerenciarLeitosDialog.vue'
import InternarDialog from '@/features/clinico/components/internacao/InternarDialog.vue'
import LeitoCard from '@/features/clinico/components/internacao/LeitoCard.vue'
import PassagemDePlantaoDialog from '@/features/clinico/components/internacao/PassagemDePlantaoDialog.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { LeitoNoMapa } from '@/features/clinico/data/repositories'
import type { Leito, LeitoInativoMotivo, LeitoKind } from '@/features/clinico/data/types'
import { useClinicoStore } from '@/features/clinico/stores/clinico'
import { useInternacaoStore } from '@/features/clinico/stores/internacao'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const internacao = useInternacaoStore()
const formato = useClinicFormat()

const leitoParaInternar = ref<Leito | null>(null)
const passagemAberta = ref(false)
const cadastroAberto = ref(false)
const gerenciador = ref<InstanceType<typeof GerenciarLeitosDialog> | null>(null)

/** Até quantos minutos à frente uma administração no prazo entra na lista, como atenção. */
const JANELA_DA_PROXIMA_MIN = 60

onMounted(async () => {
  await internacao.carregarMapa()
  await internacao.carregarPassagem()
  await internacao.carregarLeitos()

  /* O painel de casos difíceis entra direto na passagem — a rota abre a conversa, não a explica. */
  if (route.query.passagem === '1') {
    passagemAberta.value = true
  }
})

/* Recarrega quando qualquer mutação do módulo invalidar o mundo (alta, nova prescrição, dose). */
watch(
  () => clinico.revisao,
  () => {
    void internacao.carregarMapa()
  },
)

const mapa = computed(() => internacao.mapa)

const plantao = computed(() => mapa.value?.plantaoAtual ?? null)

const plantonista = computed(() =>
  plantao.value ? clinico.profissional(plantao.value.responsavelId) : null,
)

/** A linha pequena da saudação: o turno, o horário e quem está de plantão. */
const linhaDoPlantao = computed(() => {
  if (!plantao.value) {
    return t('clinico.internacao.subtitulo')
  }

  return [
    t(`clinico.internacao.plantao.${plantao.value.kind}`),
    formato.intervalo(plantao.value.inicio, plantao.value.fim),
    plantonista.value?.nome ?? '',
  ]
    .filter(Boolean)
    .join(' · ')
})

const jaInternados = computed(() =>
  (mapa.value?.leitos ?? [])
    .map((item) => item.internacao?.petId)
    .filter((id): id is string => Boolean(id)),
)

const vazio = computed(
  () => !internacao.carregando && !internacao.erro && (mapa.value?.leitos.length ?? 0) === 0,
)

// ---------------------------------------------------------------------------- o que pede ação

function paraOPaciente(item: LeitoNoMapa) {
  return `/veterinario/internacao/${item.internacao!.id}`
}

/**
 * Boletim retido primeiro, atraso depois, a próxima hora por último. As três ficam em listas
 * separadas porque o selo não basta: boletim e atraso são os dois urgentes, e o boletim — uma
 * pessoa sem notícia do animal — vem antes em qualquer ordem de leitos.
 */
const linhasDaPauta = computed<LinhaDaTabela[]>(() => {
  const boletins: LinhaDaTabela[] = []
  const linhas: LinhaDaTabela[] = []

  for (const item of mapa.value?.leitos ?? []) {
    if (!item.internacao) {
      continue
    }

    const pet = item.petNome
    const aFazer = t('clinico.internacao.pauta.aFazer', { total: item.pendentes })

    if (item.boletimRetido) {
      boletins.push({
        id: `boletim-${item.leito.id}`,
        to: paraOPaciente(item),
        frase: t('clinico.internacao.pauta.boletim', { pet }),
        detalhe: t('clinico.internacao.pauta.responsavel', { nome: item.tutorNome }),
        tom: 'risco',
        onde: item.leito.nome,
      })
    }

    if (item.atrasadas > 0) {
      linhas.push({
        id: `atraso-${item.leito.id}`,
        to: paraOPaciente(item),
        frase: t(
          'clinico.internacao.pauta.atrasadas',
          { pet, total: item.atrasadas },
          item.atrasadas,
        ),
        detalhe: aFazer,
        tom: 'risco',
        onde: item.leito.nome,
      })
    } else if (item.proximaEmMinutos !== null && item.proximaEmMinutos <= JANELA_DA_PROXIMA_MIN) {
      linhas.push({
        id: `proxima-${item.leito.id}`,
        to: paraOPaciente(item),
        frase: t('clinico.internacao.pauta.proxima', { pet, minutos: item.proximaEmMinutos }),
        detalhe: aFazer,
        tom: 'atencao',
        onde: item.leito.nome,
      })
    }
  }

  return [...boletins, ...porGravidade(linhas)]
})

const urgentes = computed(() => linhasDaPauta.value.filter((linha) => linha.tom === 'risco').length)

/** A frase da saudação: a ocupação, e o que pede ação — ou que nada está atrasado. */
const fraseDoResumo = computed(() => {
  const ocupacao = t('clinico.internacao.resumo.ocupacao', {
    ocupados: mapa.value?.ocupados ?? 0,
    ativos: mapa.value?.ativos ?? 0,
  })

  if (urgentes.value > 0) {
    return `${ocupacao} · ${t('clinico.internacao.resumo.urgentes', { total: urgentes.value }, urgentes.value)}`
  }

  const total = linhasDaPauta.value.length

  if (total > 0) {
    return `${ocupacao} · ${t('clinico.internacao.resumo.proximaHora', { total }, total)}`
  }

  return `${ocupacao} · ${t('clinico.internacao.resumo.emDia')}`
})

// ---------------------------------------------------------------------------- o mapa

type GrupoDeLeitos = { kind: LeitoKind; leitos: LeitoNoMapa[]; ocupados: number; ativos: number }

/** Os leitos por tipo, na ordem em que a clínica os cadastrou. */
const grupos = computed<GrupoDeLeitos[]>(() => {
  const porTipo = new Map<LeitoKind, GrupoDeLeitos>()

  for (const item of mapa.value?.leitos ?? []) {
    const kind = item.leito.kind
    const grupo = porTipo.get(kind) ?? { kind, leitos: [], ocupados: 0, ativos: 0 }

    grupo.leitos.push(item)
    grupo.ocupados += item.internacao ? 1 : 0
    grupo.ativos += item.leito.ativo ? 1 : 0
    porTipo.set(kind, grupo)
  }

  return [...porTipo.values()]
})

// ---------------------------------------------------------------------------- ações

type Acao = { id: string; rotulo: string; icone: Component; executar: () => void }

/** A cheia é passar o plantão: o rito desta tela. Gerenciar leitos é configuração, contornada. */
const acoes = computed<Acao[]>(() => {
  const lista: Acao[] = []

  if (plantao.value) {
    lista.push({
      id: 'plantao',
      rotulo: t('clinico.internacao.plantao.passar'),
      icone: PhArrowsLeftRight,
      executar: () => (passagemAberta.value = true),
    })
  }

  lista.push({
    id: 'leitos',
    rotulo: t('clinico.internacao.leitos.gerenciar'),
    icone: PhGearSix,
    executar: () => (cadastroAberto.value = true),
  })

  return lista
})

function abrir(internacaoId: string) {
  void router.push(`/veterinario/internacao/${internacaoId}`)
}

async function internarPaciente(entrada: {
  petId: string
  tutorId: string
  responsavelId: string
  motivo: string
  diagnostico: string
  gravidade: 'estavel' | 'atencao' | 'critico'
  pesoEntradaKg: number
}) {
  const leitoId = leitoParaInternar.value?.id

  if (!leitoId) {
    return
  }

  const criada = await internacao.internar({ ...entrada, leitoId })

  if (criada) {
    leitoParaInternar.value = null
  }
}

async function entregarPlantao(nota: string, recebidoPor: string) {
  await internacao.entregarPlantao(nota, recebidoPor)
  passagemAberta.value = false
}

/**
 * As internações que o cadastro precisa consultar.
 *
 * O mapa só carrega as **abertas**, e é o suficiente para saber o que está ocupado. Para saber o
 * que já teve história — e portanto não pode ser apagado — o cadastro consulta o mesmo conjunto:
 * no protótipo, um leito com internação encerrada continua listado no mapa como livre, e a regra
 * de remoção o alcança pelo histórico que o repositório enxerga.
 */
const internacoesConhecidas = computed(() =>
  (mapa.value?.leitos ?? [])
    .map((item) => item.internacao)
    .filter((item): item is NonNullable<typeof item> => item !== null),
)

/**
 * Cada mudança de cadastro fecha o formulário **só quando é aceita**.
 *
 * Recusada por regra — leito ocupado, nome repetido —, o formulário fica aberto com o texto do
 * impedimento à vista. Sumir com ele deixaria o usuário sem saber por que nada mudou.
 */
async function aoMudarCadastro(mudanca: Promise<boolean>) {
  if (await mudanca) {
    gerenciador.value?.voltarParaLista()
  }
}

function abrirLeito(leitoId: string) {
  leitoParaInternar.value =
    (mapa.value?.leitos ?? []).find((item) => item.leito.id === leitoId)?.leito ?? null
}
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :title="t('clinico.internacao.titulo')"
    :loading="internacao.carregando && !mapa"
    :error="internacao.erro ? t(internacao.erro) : ''"
    :empty="vazio"
    :empty-title="t('clinico.internacao.vazioTitulo')"
    :empty-description="t('clinico.internacao.vazioDescricao')"
  >
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ linhaDoPlantao }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('clinico.internacao.titulo') }}</h1>

        <div class="hc-saudacao__linha">
          <p v-if="mapa" class="hc-saudacao__resumo" aria-live="polite">{{ fraseDoResumo }}</p>

          <nav class="hc-acoes" :aria-label="t('clinico.internacao.acoesRotulo')">
            <Button
              v-for="(acao, indice) in acoes"
              :key="acao.id"
              type="button"
              class="hc-pilula"
              :class="{ 'hc-pilula--cheia': indice === 0 && acao.id === 'plantao' }"
              :label="acao.rotulo"
              @click="acao.executar()"
            >
              <template #icon>
                <component
                  :is="acao.icone"
                  class="hc-pilula__icone"
                  :weight="indice === 0 && acao.id === 'plantao' ? 'fill' : 'duotone'"
                  aria-hidden="true"
                />
              </template>
            </Button>
          </nav>
        </div>
      </div>
    </template>

    <div v-if="mapa" class="internacao clinic-scope">
      <!-- 1. quem precisa de mim agora -->
      <section class="hc pauta" aria-labelledby="internacao-pauta">
        <header class="hc__cabeca">
          <h2 id="internacao-pauta" class="hc__titulo">
            <PhClipboardText class="hc__icone" weight="duotone" aria-hidden="true" />
            {{ t('clinico.internacao.pauta.titulo') }}
          </h2>
        </header>

        <PautaTabela v-if="linhasDaPauta.length > 0" :linhas="linhasDaPauta" />

        <p v-else class="pauta__calma">
          <PhCheckCircle class="pauta__calma-icone" weight="fill" aria-hidden="true" />
          {{ t('clinico.internacao.pauta.vazio') }}
        </p>
      </section>

      <!-- 2. onde há vaga -->
      <section class="mapa" aria-labelledby="internacao-mapa">
        <h2 id="internacao-mapa" class="mapa__titulo">
          <PhBed class="mapa__icone" weight="duotone" aria-hidden="true" />
          {{ t('clinico.internacao.leitos.titulo') }}
        </h2>

        <div class="mapa__grupos">
          <section
            v-for="grupo in grupos"
            :key="grupo.kind"
            class="grupo"
            :aria-labelledby="`internacao-grupo-${grupo.kind}`"
          >
            <h3 :id="`internacao-grupo-${grupo.kind}`" class="grupo__titulo">
              {{ t(`clinico.internacao.leitoKind.${grupo.kind}`) }}
              <span class="grupo__conta">
                {{
                  t('clinico.internacao.grupo', { ocupados: grupo.ocupados, ativos: grupo.ativos })
                }}
              </span>
            </h3>

            <div class="grade">
              <LeitoCard
                v-for="item in grupo.leitos"
                :key="item.leito.id"
                :item="item"
                @abrir="abrir"
                @internar="abrirLeito"
              />
            </div>
          </section>
        </div>
      </section>
    </div>

    <InternarDialog
      :leito="leitoParaInternar"
      :salvando="internacao.salvando"
      :ja-internados="jaInternados"
      @fechar="leitoParaInternar = null"
      @confirmar="internarPaciente"
    />

    <GerenciarLeitosDialog
      ref="gerenciador"
      :aberto="cadastroAberto"
      :leitos="internacao.leitos"
      :internacoes="internacoesConhecidas"
      :salvando="internacao.salvando"
      :erro="internacao.erroDeAcao"
      @fechar="cadastroAberto = false"
      @criar="
        (entrada: { nome: string; roomId: string; kind: LeitoKind }) =>
          aoMudarCadastro(internacao.criarLeito(entrada))
      "
      @editar="
        (entrada: { leitoId: string; nome: string; kind: LeitoKind }) =>
          aoMudarCadastro(internacao.editarLeito(entrada))
      "
      @desativar="
        (entrada: { leitoId: string; motivo: LeitoInativoMotivo; detalhe: string }) =>
          aoMudarCadastro(internacao.desativarLeito(entrada))
      "
      @reativar="(leitoId: string) => aoMudarCadastro(internacao.reativarLeito(leitoId))"
      @remover="(leitoId: string) => aoMudarCadastro(internacao.removerLeito(leitoId))"
    />

    <PassagemDePlantaoDialog
      :aberto="passagemAberta"
      :passagem="internacao.passagem"
      :salvando="internacao.salvando"
      @fechar="passagemAberta = false"
      @entregar="entregarPlantao"
      @ir-para="abrir"
    />

    <!--
      O painel de casos difíceis também mora aqui: os casos plantados da internação — a piora com
      boletim travado, a dose em cima da troca de plantão — precisam estar à mão de quem demonstra
      a internação.
    -->
    <ClinicDevPanel />
  </PartnerPageFrame>
</template>

<style scoped>
.internacao {
  display: grid;
  gap: 1.75rem;
}

/* ------------------------------------------------------------------ o que pede ação */

.pauta {
  gap: 0.75rem;
}

.pauta__calma {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.4rem 0.25rem;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

.pauta__calma-icone {
  width: 1.05rem;
  height: 1.05rem;
  color: var(--hc-verde-tinta);
}

/* ------------------------------------------------------------------ o mapa
 * Os grupos vivem direto sobre o plano, sem cartão em volta: o cartão já é o leito, e uma caixa
 * por grupo seria cartão dentro de cartão.
 */

.mapa {
  display: grid;
  gap: 1.25rem;
}

.mapa__titulo {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.mapa__icone {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--hc-marca);
}

/*
 * Os grupos correm lado a lado, cada um da largura dos próprios leitos, e quebram de linha quando
 * não cabem: um grupo de um leito só não reserva uma faixa inteira da tela.
 */
.mapa__grupos {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  gap: 1.5rem 2.25rem;
}

/* Sem encolher: o grupo guarda a largura dos leitos lado a lado e só quebra se não couber inteiro. */
.grupo {
  display: grid;
  flex: 0 0 auto;
  max-width: 100%;
  gap: 0.65rem;
}

.grupo__titulo {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
}

.grupo__conta {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.grade {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

/*
 * Largura fixa, e não `min(100%, …)`: a porcentagem é cíclica no cálculo da largura do grupo, e o
 * navegador media o grupo pelo texto mais comprido de um cartão.
 */
.grade > * {
  width: 14rem;
  max-width: 100%;
}
</style>
