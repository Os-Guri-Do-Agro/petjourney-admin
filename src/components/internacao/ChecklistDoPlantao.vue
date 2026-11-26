<script setup lang="ts">
/**
 * O checklist do plantão inteiro (E5-02b, guia e5 14.2 e 16.1): todas as internações em curso
 * numa lista só, por hora (a enfermagem não trabalha internação por internação). Sem período, o
 * plantão da grade em que estamos. A dose atrasada nunca some: as de até 12 h antes vêm primeiro;
 * as mais antigas que isso pedem para abrir a internação.
 *
 * Sem observação interna (ela fica no checklist da internação). Relê quando o canal de tempo real
 * avisa que alguém marcou ou desfez uma dose de qualquer internação (PJ-3SO0WX); o polling fica de
 * reserva: 2 min com o canal entregando, 1 min sem ele.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import type { PassoDoGuia } from '@/components/ui/UiPassos.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { useReleituraDeReserva, useTempoReal } from '@/composables/useTempoReal'
import {
  lerChecklistDoPlantao,
  RELER_CHECKLIST_AO_VIVO_MS,
  RELER_CHECKLIST_MS,
  type ChecklistDoPlantao,
  type DoseDoPlantao,
} from '@/service/parceiro/plantao-da-internacao-service'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

import LinhaDaDose from './LinhaDaDose.vue'
import RegistrarDoseGaveta from './RegistrarDoseGaveta.vue'
import { useRegistroDeDose } from './useRegistroDeDose'

const { t, locale } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()

const checklist = ref<ChecklistDoPlantao | null>(null)
const carregando = ref(false)
const erro = ref('')

/* O aviso, o polling e o registro podem pedir juntos: a resposta velha não cobre a nova. */
const leitura = criarUltimaLeitura()

async function carregar() {
  const vez = leitura.nova()
  carregando.value = true
  try {
    const lido = await lerChecklistDoPlantao({}, parceiroQuery())
    if (!leitura.valendo(vez)) return
    checklist.value = lido
    erro.value = ''
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDoCadastro(err, t('internacao.checklist.erro')).mensagem
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

const { aoVivo } = useTempoReal({
  tipos: ['internacao.checklist'],
  ativo: () => store.temPermissao('internacao.executar'),
  aoMudar: () => void carregar(),
})
useReleituraDeReserva(() => void carregar(), aoVivo, {
  aoVivoMs: RELER_CHECKLIST_AO_VIVO_MS,
  foraMs: RELER_CHECKLIST_MS,
})

onMounted(() => void carregar())

const registro = useRegistroDeDose(() => {
  void carregar()
  invalidarPendenciasDoPortal()
})

const podeRegistrar = computed(
  () => Boolean(store.modulo('CLINICA')?.podeEscrever) && store.temPermissao('internacao.executar'),
)
const meuId = computed(() => store.eu?.profissional?.id ?? null)

const prescricoes = computed(
  () => new Map((checklist.value?.prescricoes ?? []).map((item) => [item.id, item])),
)
const nomes = computed(
  () =>
    new Map((checklist.value?.profissionais ?? []).map((item) => [item.profissionalId, item.nome])),
)
const internacoes = computed(
  () => new Map((checklist.value?.internacoes ?? []).map((item) => [item.id, item])),
)

function onde(dose: DoseDoPlantao) {
  const internacao = internacoes.value.get(dose.internacaoId)
  return internacao ? `${internacao.pacienteNome} (${internacao.leitoNome})` : ''
}

function titulo(dose: DoseDoPlantao) {
  return [onde(dose), prescricoes.value.get(dose.prescricaoId)?.descricao ?? '']
    .filter(Boolean)
    .join(' · ')
}

function podeDesfazer(dose: DoseDoPlantao) {
  if (!podeRegistrar.value || !meuId.value) return false
  if (dose.status === 'PENDENTE' || dose.status === 'SUSPENSA') return false
  if (dose.executadaPorId !== meuId.value) return false
  if (checklist.value?.plantao && dose.turnoId !== checklist.value.plantao.id) return false
  const quando = dose.registradaEm ?? dose.executadaEm
  return Boolean(quando && Date.now() - new Date(quando).getTime() < 12 * 3600 * 1000)
}

function hora(valor: string) {
  return new Date(valor).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
}

/*
 * O plantão sem dose não é uma linha cinza: ensina de onde as doses vêm (pedido do Luís, 17/11/2026,
 * "design simples demais"; o modelo é o vazio de Acessos).
 */
const passosDoPlantao = computed<PassoDoGuia[]>(() => {
  const passo = (id: string, icone: string, acao?: PassoDoGuia['acao']): PassoDoGuia => ({
    id,
    icone,
    titulo: t(`internacao.plantao.guia.${id}.titulo`),
    texto: t(`internacao.plantao.guia.${id}.texto`),
    acao,
  })

  /*
   * Cada etapa com o botão dela (17/11/2026): a prescrição se faz na internação (o mapa leva até
   * ela), o registro se faz aqui (apagado até haver dose) e a passagem, no cartão do plantão do
   * mapa.
   */
  return [
    passo('prescricao', 'ph ph-prescription', {
      rotulo: t('internacao.plantao.guia.mapa'),
      icone: 'ph ph-bed',
      to: '/clinica/internacao',
    }),
    passo(
      'registro',
      'ph ph-check-square-offset',
      podeRegistrar.value
        ? {
            rotulo: t('internacao.plantao.guia.registrar'),
            icone: 'ph ph-check-square-offset',
            bloqueada: true,
          }
        : undefined,
    ),
    passo(
      'passagem',
      'ph ph-arrows-left-right',
      podeRegistrar.value
        ? {
            rotulo: t('internacao.plantao.passar'),
            icone: 'ph ph-arrows-left-right',
            to: '/clinica/internacao',
          }
        : undefined,
    ),
  ]
})

const resumo = computed(() => {
  const c = checklist.value
  if (!c) return ''
  const partes = [t('internacao.checklist.janela', { de: hora(c.de), ate: hora(c.ate) })]
  if (c.contagens.dosesAtrasadas)
    partes.push(
      t(
        'internacao.checklist.atrasadas',
        { n: c.contagens.dosesAtrasadas },
        c.contagens.dosesAtrasadas,
      ),
    )
  if (c.contagens.naJanela)
    partes.push(
      t('internacao.checklist.naJanela', { n: c.contagens.naJanela }, c.contagens.naJanela),
    )
  return partes.join(' · ')
})
</script>

<template>
  <UiPagina
    :titulo="t('internacao.plantao.checklist')"
    :resumo="resumo"
    icone="ph ph-list-checks"
    :carregando="carregando && !checklist"
    :erro="checklist ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <!-- Sem "voltar": o plantão é aba do destino Internação, ao lado do mapa. -->
    <section
      v-if="checklist"
      class="ui-folha ui-cartao cp"
      aria-labelledby="cp-titulo"
      :aria-busy="carregando"
    >
      <header class="ui-cartao__cabeca cp__cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-pill" /></span>
        <span class="ui-cartao__titulos">
          <h2 id="cp-titulo" class="ui-cartao__titulo">
            {{ t('internacao.plantao.doses.titulo') }}
          </h2>
          <p class="ui-cartao__descricao">{{ t('internacao.plantao.doses.descricao') }}</p>
        </span>
      </header>

      <p v-if="checklist.plantao?.vencido" class="eg__aviso cp__nota">
        <i class="ph ph-clock-countdown" aria-hidden="true" />
        <span>{{
          t('internacao.plantao.vencido', { hora: hora(checklist.plantao.fimPrevisto) })
        }}</span>
      </p>
      <p v-if="checklist.contagens.atrasadasForaDaLista" class="eg__aviso cp__nota">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>{{
          t(
            'internacao.checklist.foraDaLista',
            { n: checklist.contagens.atrasadasForaDaLista },
            checklist.contagens.atrasadasForaDaLista,
          )
        }}</span>
      </p>
      <p v-if="registro.recado.value" class="eg__erro cp__nota" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ registro.recado.value }}</span>
      </p>

      <UiVazioIlustrado
        v-if="!checklist.grupos.length"
        aninhado
        icone="ph ph-pill"
        :titulo="t('internacao.checklist.vazioPlantao')"
        :texto="t('internacao.plantao.guia.vazio')"
        :guia-titulo="t('internacao.plantao.guia.titulo')"
        :passos="passosDoPlantao"
      />
      <div v-for="grupo in checklist.grupos" :key="grupo.hora" class="cp__grupo">
        <!-- A hora já está em cada linha: o grupo só marca onde o "agora" passa. -->
        <p v-if="grupo.hora === checklist.linhaDoAgora" class="cp__agora-linha">
          <span class="cp__agora">{{ t('internacao.checklist.agora') }}</span>
        </p>
        <ul class="ui-lista">
          <LinhaDaDose
            v-for="dose in grupo.itens"
            :key="dose.id"
            :dose="dose"
            :prescricao="prescricoes.get(dose.prescricaoId) ?? null"
            :onde="onde(dose)"
            :executada-por="dose.executadaPorId ? (nomes.get(dose.executadaPorId) ?? '') : ''"
            :atribuida-a="dose.atribuidaAId ? (nomes.get(dose.atribuidaAId) ?? '') : ''"
            :pode-registrar="podeRegistrar"
            :pode-desfazer="podeDesfazer(dose)"
            :ocupada="registro.registrando.value === dose.id"
            @dei="registro.dei(dose, titulo(dose))"
            @nao-dei="(status) => registro.naoDei(dose, titulo(dose), status)"
            @desfazer="registro.desfazer(dose.id)"
          />
        </ul>
      </div>
      <p v-if="checklist.truncado" class="eg__dica cp__nota">
        {{ t('internacao.checklist.truncado') }}
      </p>
    </section>

    <template #sempre>
      <RegistrarDoseGaveta
        v-model:visible="registro.gavetaAberta.value"
        :pedido="registro.pedido.value"
        @registrada="(carregar(), invalidarPendenciasDoPortal())"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.cp__cabeca {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

/* Os avisos embaixo do fio do cabeçalho, com respiro e alinhados ao conteúdo do cartão. */
.cp__nota {
  margin: 14px 0 0;
  padding: 0;
}

.cp__grupo {
  display: grid;
}

/* O "agora": um fio na cor do lugar atravessando a lista, com a palavra encostada. */
.cp__agora-linha {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 0;
  padding: 0 10px;
}

.cp__agora-linha::after {
  height: 2px;
  flex: 1;
  background: var(--pj-lugar, var(--musgo));
  content: '';
}

.cp__agora {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--pj-lugar, var(--musgo));
  color: var(--pj-lugar-tinta, #10302a);
  font-size: 11px;
  letter-spacing: 0.04em;
}
</style>
