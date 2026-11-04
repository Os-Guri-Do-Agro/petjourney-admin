<script setup lang="ts">
/**
 * Internação — o plantão e a planta da ala.
 *
 * É a tela que responde às duas perguntas que a clínica faz o dia inteiro sobre internação:
 * **quem precisa de mim agora** e **onde há vaga**. Por isso ela tem duas partes, nessa ordem.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * - **O cabeçalho** diz o plantão (turno, horário, quem está de plantão) e o estado da ala numa
 *   frase: ocupação, quantos pacientes pedem ação e quantos estão críticos. A ação cheia é
 *   "Passar plantão" — o rito desta tela; "Gerenciar leitos" é configuração, contornada.
 * - **O que pede ação no plantão** é a pauta do sistema (`UiPauta`): boletim retido primeiro,
 *   depois atraso, depois o que vence na próxima hora. Cada linha abre o paciente.
 * - **A planta da ala**: um bloco por setor (UTI, Geral, Felino, Isolamento), com "x de y
 *   ocupados" e quantas vagas sobram — "tem vaga para um gato?" se responde sem contar ladrilho.
 *   Cada leito é um ladrilho (`LeitoCard`): o ocupado com rosto, gravidade, tempo de internação e
 *   o que o checklist cobra; o livre, tracejado e calmo, com "Internar".
 *
 * `?passagem=1` abre a passagem de plantão direto (o painel de casos difíceis entra por aí).
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { porGravidade, type LinhaDaTabela } from '@/components/home/pauta-tabela'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiPauta from '@/components/ui/UiPauta.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
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

async function carregar() {
  await internacao.carregarMapa()
  await internacao.carregarPassagem()
  await internacao.carregarLeitos()
}

onMounted(async () => {
  await carregar()

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

/** O plantão em uma frase: o turno, o horário e quem está nele. */
const fraseDoPlantao = computed(() => {
  if (!plantao.value) {
    return ''
  }

  const partes = {
    turno: t(`clinico.internacao.plantao.${plantao.value.kind}`),
    horario: formato.intervalo(plantao.value.inicio, plantao.value.fim),
  }

  return plantonista.value
    ? t('clinico.internacao.nova.resumo.plantaoCom', { ...partes, nome: plantonista.value.nome })
    : t('clinico.internacao.nova.resumo.plantao', partes)
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
  return `/clinica/internacao/${item.internacao!.id}`
}

/**
 * Boletim retido primeiro, atraso depois, a próxima hora por último. O boletim — uma pessoa sem
 * notícia do animal — vem antes em qualquer ordem de leitos.
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
    const doCadastro = clinico.pet(item.internacao.petId)
    const rosto = {
      nome: item.petNome,
      iniciais: item.petIniciais,
      especie: doCadastro?.especie ?? null,
      fotoUrl: doCadastro?.fotoUrl ?? '',
    }

    if (item.boletimRetido) {
      boletins.push({
        id: `boletim-${item.leito.id}`,
        to: paraOPaciente(item),
        frase: t('clinico.internacao.pauta.boletim', { pet }),
        detalhe: t('clinico.internacao.pauta.responsavel', { nome: item.tutorNome }),
        tom: 'risco',
        onde: item.leito.nome,
        pet: rosto,
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
        pet: rosto,
      })
    } else if (item.proximaEmMinutos !== null && item.proximaEmMinutos <= JANELA_DA_PROXIMA_MIN) {
      linhas.push({
        id: `proxima-${item.leito.id}`,
        to: paraOPaciente(item),
        frase: t('clinico.internacao.pauta.proxima', { pet, minutos: item.proximaEmMinutos }),
        detalhe: aFazer,
        tom: 'atencao',
        onde: item.leito.nome,
        pet: rosto,
      })
    }
  }

  return [...boletins, ...porGravidade(linhas)]
})

/** Quantos **pacientes** pedem ação — um paciente com boletim e atraso é um só a visitar. */
const pacientesComAcao = computed(
  () => new Set(linhasDaPauta.value.map((linha) => String(linha.to))).size,
)

/** O estado da ala numa frase: ocupação, quem pede ação e quem está crítico. */
const fraseDoResumo = computed(() => {
  const partes = [
    t('clinico.internacao.resumo.ocupacao', {
      ocupados: mapa.value?.ocupados ?? 0,
      ativos: mapa.value?.ativos ?? 0,
    }),
  ]
  const criticos = mapa.value?.criticos ?? 0

  if (pacientesComAcao.value > 0) {
    partes.push(
      t(
        'clinico.internacao.nova.resumo.pedemAcao',
        { total: pacientesComAcao.value },
        pacientesComAcao.value,
      ),
    )
  }

  if (criticos > 0) {
    partes.push(t('clinico.internacao.nova.resumo.criticos', { total: criticos }, criticos))
  }

  if (partes.length === 1) {
    partes.push(t('clinico.internacao.resumo.emDia'))
  }

  return t('clinico.internacao.nova.resumo.frase', {
    texto: partes.reduce((frase, parte) =>
      t('clinico.internacao.nova.resumo.lista', { a: frase, b: parte }),
    ),
  })
})

// ---------------------------------------------------------------------------- a planta da ala

type Setor = {
  kind: LeitoKind
  leitos: LeitoNoMapa[]
  ocupados: number
  ativos: number
}

const ICONE_DO_SETOR: Record<LeitoKind, string> = {
  uti: 'ph ph-heartbeat',
  geral: 'ph ph-bed',
  felino: 'ph ph-cat',
  isolamento: 'ph ph-virus',
}

/**
 * Os leitos por setor, na ordem em que a clínica os cadastrou — com a UTI na frente. É onde está
 * o paciente mais grave do plantão, e no fim da planta ela ficava abaixo da dobra.
 */
const setores = computed<Setor[]>(() => {
  const porTipo = new Map<LeitoKind, Setor>()

  for (const item of mapa.value?.leitos ?? []) {
    const kind = item.leito.kind
    const setor = porTipo.get(kind) ?? { kind, leitos: [], ocupados: 0, ativos: 0 }

    setor.leitos.push(item)
    setor.ocupados += item.internacao ? 1 : 0
    setor.ativos += item.leito.ativo ? 1 : 0
    porTipo.set(kind, setor)
  }

  /* `sort` estável: tirada a UTI, o resto continua na ordem do cadastro. */
  return [...porTipo.values()].sort((a, b) => Number(b.kind === 'uti') - Number(a.kind === 'uti'))
})

function vagasDo(setor: Setor) {
  return Math.max(0, setor.ativos - setor.ocupados)
}

/** O ponto de cada leito no cabeçalho do setor: ocupado na cor da gravidade, livre, ou parado. */
function pontoDo(item: LeitoNoMapa) {
  if (item.internacao) {
    return `ponto--${item.internacao.gravidade}`
  }

  return item.leito.ativo ? 'ponto--livre' : 'ponto--parado'
}

// ---------------------------------------------------------------------------- ações

function abrir(internacaoId: string) {
  void router.push(`/clinica/internacao/${internacaoId}`)
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
  <UiPagina
    :carregando="internacao.carregando && !mapa"
    :erro="internacao.erro ? t(internacao.erro) : ''"
    :vazio="vazio"
    :vazio-titulo="t('clinico.internacao.vazioTitulo')"
    :vazio-descricao="t('clinico.internacao.vazioDescricao')"
    :vazio-acao="t('clinico.internacao.leitos.adicionar')"
    vazio-icone="ph ph-bed"
    @tentar-de-novo="carregar"
    @acao-do-vazio="cadastroAberto = true"
  >
    <template v-if="mapa" #resumo>
      <template v-if="fraseDoPlantao">{{ fraseDoPlantao }}{{ ' ' }}</template>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <template #acoes>
      <Button
        type="button"
        icon="ph ph-gear-six"
        :label="t('clinico.internacao.leitos.gerenciar')"
        severity="secondary"
        outlined
        @click="cadastroAberto = true"
      />
      <Button
        v-if="plantao"
        type="button"
        icon="ph ph-arrows-left-right"
        :label="t('clinico.internacao.plantao.passar')"
        @click="passagemAberta = true"
      />
    </template>

    <div v-if="mapa" class="internacao">
      <!-- 1. quem precisa de mim agora -->
      <UiSecao
        id="internacao-pauta"
        :titulo="t('clinico.internacao.pauta.titulo')"
        :contagem="linhasDaPauta.length || null"
        icone="ph ph-bell-ringing"
      >
        <UiPauta v-if="linhasDaPauta.length" :linhas="linhasDaPauta" />
        <p v-else class="ui-folha calma">
          <span class="ui-ladrilho ui-ladrilho--ok" aria-hidden="true">
            <i class="ph ph-check-circle" />
          </span>
          <strong>{{ t('clinico.internacao.pauta.vazio') }}</strong>
        </p>
      </UiSecao>

      <!-- 2. onde há vaga: a planta da ala, um bloco por setor -->
      <UiSecao
        id="internacao-planta"
        :titulo="t('clinico.internacao.leitos.titulo')"
        :descricao="t('clinico.internacao.nova.planta.descricao')"
        icone="ph ph-bed"
      >
        <div class="planta">
          <section
            v-for="setor in setores"
            :key="setor.kind"
            class="setor"
            :class="`setor--${setor.kind}`"
            :style="{ '--setor-leitos': setor.leitos.length }"
            :aria-labelledby="`internacao-setor-${setor.kind}`"
          >
            <header class="setor__cabeca">
              <span
                class="ui-ladrilho setor__icone"
                :class="{ 'ui-ladrilho--risco': setor.kind === 'uti' }"
                aria-hidden="true"
              >
                <i :class="ICONE_DO_SETOR[setor.kind]" />
              </span>
              <div class="setor__titulos">
                <div class="setor__linha">
                  <h3 :id="`internacao-setor-${setor.kind}`" class="setor__nome">
                    {{ t(`clinico.internacao.leitoKind.${setor.kind}`) }}
                  </h3>
                  <!--
                    A lotação de relance: um ponto por leito, na cor da gravidade de quem está nele.
                    É a mesma conta da frase de baixo, desenhada — por isso fica fora do leitor.
                  -->
                  <span class="setor__pontos" aria-hidden="true">
                    <i
                      v-for="item in setor.leitos"
                      :key="item.leito.id"
                      class="ponto"
                      :class="pontoDo(item)"
                    />
                  </span>
                </div>
                <span class="setor__conta ui-num">
                  {{
                    t('clinico.internacao.grupo', {
                      ocupados: setor.ocupados,
                      ativos: setor.ativos,
                    })
                  }}
                </span>
              </div>
              <span
                class="ui-selo setor__vagas"
                :class="vagasDo(setor) > 0 ? 'ui-selo--ok' : 'ui-selo--contorno'"
              >
                <i
                  :class="vagasDo(setor) > 0 ? 'ph ph-check-circle' : 'ph ph-prohibit'"
                  aria-hidden="true"
                />
                {{
                  vagasDo(setor) > 0
                    ? t(
                        'clinico.internacao.nova.planta.vagas',
                        { total: vagasDo(setor) },
                        vagasDo(setor),
                      )
                    : t('clinico.internacao.nova.planta.semVaga')
                }}
              </span>
            </header>

            <div class="setor__leitos">
              <LeitoCard
                v-for="item in setor.leitos"
                :key="item.leito.id"
                :item="item"
                @abrir="abrir"
                @internar="abrirLeito"
              />
            </div>
          </section>
        </div>
      </UiSecao>
    </div>

    <template #sempre>
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
    </template>
  </UiPagina>
</template>

<style scoped>
.internacao {
  display: grid;
  gap: 36px;
}

/* Nada atrasado: uma folha calma, com o ladrilho do ok e a frase. */
.calma {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0;
  padding: 16px 24px;
  color: var(--tinta);
  font-size: 14.5px;
}

.calma strong {
  font-weight: 600;
}

/* ------------------------------------------------------------------ a planta da ala
 * Cada setor é um cômodo: chão rente e tingido, parede fina, o nome na porta — o mesmo desenho dos
 * corredores da casa do Hotel. Os leitos são os únicos objetos com papel: o cômodo não é cartão,
 * é lugar, e assim não há cartão dentro de cartão.
 *
 * Os setores correm lado a lado, cada um tão largo quanto os próprios leitos pedem
 * (`--setor-leitos`), e quebram de linha quando não cabem.
 */
.planta {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 20px;
}

.setor {
  --ladrilho: 220px;
  --vao: 12px;

  display: grid;
  min-width: min(100%, 290px);
  flex: var(--setor-leitos) 1 calc(var(--setor-leitos) * (var(--ladrilho) + var(--vao)) + 24px);
  align-content: start;
  gap: 16px;
  padding: 16px 16px 18px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-painel);
  background: color-mix(in oklab, var(--superficie-3) 50%, transparent);
}

/* No escuro o chão afunda pelo outro lado: um pouco mais claro que o fundo, mais escuro que o papel. */
.app-dark .setor {
  background: color-mix(in oklab, var(--superficie-2) 40%, transparent);
}

.setor__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-inline: 2px;
}

.setor__titulos {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 3px;
}

.setor__nome {
  margin: 0;
  overflow: hidden;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setor__linha {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.setor__conta {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

/* Os pontos da lotação: cheios na cor da gravidade, vazados quando livres, riscados quando parados. */
.setor__pontos {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ponto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--linha-forte);
}

.ponto--estavel {
  background: var(--ok);
}

.ponto--atencao {
  background: var(--atencao);
}

.ponto--critico {
  background: var(--risco);
  box-shadow: 0 0 0 2px var(--risco-fundo);
}

.ponto--livre {
  border: 1.5px solid color-mix(in oklab, var(--ok) 70%, var(--linha-forte));
  background: transparent;
}

.ponto--parado {
  border: 1.5px dashed var(--linha-forte);
  background: transparent;
}

.setor__vagas {
  flex: none;
}


.setor__leitos {
  display: grid;
  gap: var(--vao);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--ladrilho)), 1fr));
}

@media (max-width: 900px) {
  .setor {
    flex-basis: 100%;
  }
}

@media (max-width: 520px) {
  .setor {
    padding: 14px 12px 14px;
  }

  .setor__cabeca {
    flex-wrap: wrap;
  }
}
</style>
