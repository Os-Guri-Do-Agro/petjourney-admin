<script setup lang="ts">
/**
 * O checklist do plantão inteiro (E5-02b, guia e5 14.2 e 16.1): todas as internações em curso
 * numa lista só, por hora (a enfermagem não trabalha internação por internação). Sem período, o
 * plantão da grade em que estamos. A dose atrasada nunca some: as de até 12 h antes vêm primeiro;
 * as mais antigas que isso pedem para abrir a internação.
 *
 * Sem observação interna (ela fica no checklist da internação). Relê a cada minuto.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import {
  lerChecklistDoPlantao,
  RELER_CHECKLIST_MS,
  type ChecklistDoPlantao,
  type DoseDoPlantao,
} from '@/service/parceiro/plantao-da-internacao-service'

import LinhaDaDose from './LinhaDaDose.vue'
import RegistrarDoseGaveta from './RegistrarDoseGaveta.vue'
import { useRegistroDeDose } from './useRegistroDeDose'

const { t, locale } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()

const checklist = ref<ChecklistDoPlantao | null>(null)
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  try {
    checklist.value = await lerChecklistDoPlantao({}, parceiroQuery())
    erro.value = ''
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.checklist.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

let relendo: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  void carregar()
  relendo = setInterval(() => {
    if (document.visibilityState === 'visible') void carregar()
  }, RELER_CHECKLIST_MS)
})
onBeforeUnmount(() => {
  if (relendo) clearInterval(relendo)
})

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
    <template #voltar>
      <RouterLink to="/clinica/internacao" class="cp__voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('internacao.titulo') }}
      </RouterLink>
    </template>

    <section v-if="checklist" class="ui-folha ui-lista cp" :aria-busy="carregando">
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

      <p v-if="!checklist.grupos.length" class="ui-vazio">
        {{ t('internacao.checklist.vazioPlantao') }}
      </p>
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
.cp__voltar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13.5px;
  text-decoration: none;
}

.cp__voltar:hover {
  color: var(--tinta);
}

.cp__nota {
  margin: 0;
  padding: 12px 24px 0;
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
  padding: 0 24px;
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
