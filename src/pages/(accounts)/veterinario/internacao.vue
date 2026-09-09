<script setup lang="ts">
/**
 * Internação — o mapa de leitos.
 *
 * É a tela que responde às duas perguntas que a clínica faz o dia inteiro sobre internação:
 * **onde há vaga** e **quem precisa de mim agora**. Nessa ordem, e por isso é um mapa e não uma
 * lista: o leito vazio ocupa espaço na grade, porque a vaga é informação.
 *
 * O que o cartão pinta não é a gravidade, é a urgência. Um crítico com tudo em dia não precisa
 * piscar; um estável com duas doses atrasadas precisa. Pintar por gravidade deixaria a tela
 * vermelha onde nada há para fazer e silenciosa onde há.
 *
 * O boletim retido tem lugar próprio no topo. É a única coisa desta tela que **não pode esperar
 * o fim do turno** — enquanto ele existe, alguém precisa pegar o telefone.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicStat from '@/features/clinico/components/base/ClinicStat.vue'
import GerenciarLeitosDialog from '@/features/clinico/components/internacao/GerenciarLeitosDialog.vue'
import InternarDialog from '@/features/clinico/components/internacao/InternarDialog.vue'
import LeitoCard from '@/features/clinico/components/internacao/LeitoCard.vue'
import PassagemDePlantaoDialog from '@/features/clinico/components/internacao/PassagemDePlantaoDialog.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
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

const ocupacao = computed(() => (mapa.value ? formato.percentual(mapa.value.ocupacao) : '—'))

const vagas = computed(() => (mapa.value ? mapa.value.ativos - mapa.value.ocupados : 0))

const pendentesNoTurno = computed(() =>
  (mapa.value?.leitos ?? []).reduce((total, item) => total + item.pendentes, 0),
)

const atrasadasNoTurno = computed(() =>
  (mapa.value?.leitos ?? []).reduce((total, item) => total + item.atrasadas, 0),
)

const plantao = computed(() => mapa.value?.plantaoAtual ?? null)

const plantonista = computed(() =>
  plantao.value ? clinico.profissional(plantao.value.responsavelId) : null,
)

const jaInternados = computed(() =>
  (mapa.value?.leitos ?? [])
    .map((item) => item.internacao?.petId)
    .filter((id): id is string => Boolean(id)),
)

const vazio = computed(
  () => !internacao.carregando && !internacao.erro && (mapa.value?.leitos.length ?? 0) === 0,
)

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
    :title="t('clinico.internacao.titulo')"
    :subtitle="t('clinico.internacao.subtitulo')"
    :loading="internacao.carregando && !mapa"
    :error="internacao.erro ? t(internacao.erro) : ''"
    :empty="vazio"
    :empty-title="t('clinico.internacao.vazioTitulo')"
    :empty-description="t('clinico.internacao.vazioDescricao')"
  >
    <div v-if="mapa" class="internacao clinic-scope">
      <!--
        O boletim retido abre a página, acima até dos números. Não é um indicador: é uma tarefa
        que trava uma notícia grave na clínica, e um responsável do outro lado sem resposta.
      -->
      <p v-if="mapa.boletinsRetidos > 0" class="retidos" role="alert">
        <i class="pi pi-phone" aria-hidden="true" />
        {{ t('clinico.internacao.retidosAviso', { total: mapa.boletinsRetidos }) }}
      </p>

      <section class="numeros">
        <ClinicStat
          :rotulo="t('clinico.internacao.stat.ocupacao')"
          :valor="ocupacao"
          :detalhe="t('clinico.internacao.stat.vagas', { total: vagas })"
          icone="pi pi-th-large"
        />
        <ClinicStat
          :rotulo="t('clinico.internacao.stat.criticos')"
          :valor="String(mapa.criticos)"
          :detalhe="t('clinico.internacao.stat.criticosDetalhe')"
          icone="pi pi-exclamation-triangle"
          :tom="mapa.criticos > 0 ? 'risco' : 'neutro'"
        />
        <ClinicStat
          :rotulo="t('clinico.internacao.stat.pendentes')"
          :valor="String(pendentesNoTurno)"
          :detalhe="t('clinico.internacao.stat.atrasadas', { total: atrasadasNoTurno })"
          icone="pi pi-list-check"
          :tom="atrasadasNoTurno > 0 ? 'atencao' : 'neutro'"
        />
        <ClinicStat
          :rotulo="t('clinico.internacao.stat.boletins')"
          :valor="String(mapa.boletinsRetidos)"
          :detalhe="t('clinico.internacao.stat.boletinsDetalhe')"
          icone="pi pi-comment"
          :tom="mapa.boletinsRetidos > 0 ? 'risco' : 'neutro'"
        />
      </section>

      <section v-if="plantao" class="plantao">
        <div class="plantao__quem">
          <strong>
            {{ t(`clinico.internacao.plantao.${plantao.kind}`) }}
            ·
            {{ formato.intervalo(plantao.inicio, plantao.fim) }}
          </strong>
          <span>
            {{ t('clinico.internacao.plantao.responsavel', { nome: plantonista?.nome ?? '' }) }}
          </span>
        </div>

        <Button
          :label="t('clinico.internacao.plantao.passar')"
          icon="pi pi-sign-out"
          severity="secondary"
          outlined
          @click="passagemAberta = true"
        />
      </section>

      <!--
        Quantos leitos a clínica tem é resposta dela, não do sistema — e por isso o número fica
        escrito aqui, ao lado da porta que o altera. Gerenciar leitos é configuração: acontece no
        dia da mudança, então entra como ação discreta e não como painel permanente.
      -->
      <section class="grade__topo">
        <h2 class="grade__titulo">
          {{ t('clinico.internacao.leitos.tituloGrade', { total: mapa.leitos.length }) }}
        </h2>

        <Button
          :label="t('clinico.internacao.leitos.gerenciar')"
          icon="pi pi-cog"
          severity="secondary"
          text
          size="small"
          @click="cadastroAberto = true"
        />
      </section>

      <section class="grade">
        <LeitoCard
          v-for="item in mapa.leitos"
          :key="item.leito.id"
          :item="item"
          @abrir="abrir"
          @internar="abrirLeito"
        />
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
      @criar="(entrada: { nome: string; roomId: string; kind: LeitoKind }) => aoMudarCadastro(internacao.criarLeito(entrada))"
      @editar="(entrada: { leitoId: string; nome: string; kind: LeitoKind }) => aoMudarCadastro(internacao.editarLeito(entrada))"
      @desativar="(entrada: { leitoId: string; motivo: LeitoInativoMotivo; detalhe: string }) => aoMudarCadastro(internacao.desativarLeito(entrada))"
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
  </PartnerPageFrame>
</template>

<style scoped>
.internacao {
  display: grid;
  gap: var(--clinic-space-5);
}

.retidos {
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-risk-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
  font-weight: 700;
}

.numeros {
  display: grid;
  gap: var(--clinic-space-3);
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
}

.plantao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
}

.plantao__quem {
  display: grid;
  gap: 0.1rem;
}

.plantao__quem strong {
  font-weight: 750;
}

.plantao__quem span {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.grade__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: calc(var(--clinic-space-4) * -1 + var(--clinic-space-1));
  gap: var(--clinic-space-3);
}

.grade__titulo {
  margin: 0;
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.grade {
  display: grid;
  gap: var(--clinic-space-4);
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
}
</style>
