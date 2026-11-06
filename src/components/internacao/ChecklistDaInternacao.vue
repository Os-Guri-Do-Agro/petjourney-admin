<script setup lang="ts">
/**
 * O checklist da internação (E5-02b, guia e5 14.1 e 16.1): de 12 h atrás a 12 h à frente, por
 * hora cheia, com a linha do "agora". A situação de cada dose é lida na hora (o atraso não é um
 * registro): a lista se relê a cada minuto com a aba visível e depois de cada registro.
 *
 * Registrar é da enfermagem, do veterinário e do DONO (`internacao.executar`). O plantão vencido
 * não bloqueia o cuidado: só o aviso.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import {
  lerChecklistDaInternacao,
  RELER_CHECKLIST_MS,
  type ChecklistDaInternacao,
  type DoseNoChecklist,
} from '@/service/parceiro/plantao-da-internacao-service'

import LinhaDaDose from './LinhaDaDose.vue'
import RegistrarDoseGaveta from './RegistrarDoseGaveta.vue'
import { useRegistroDeDose } from './useRegistroDeDose'

const props = defineProps<{ internacaoId: string; podeRegistrar: boolean }>()
const emit = defineEmits<{ mudou: [] }>()

const { t, locale } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()

const checklist = ref<ChecklistDaInternacao | null>(null)
const carregando = ref(false)
const erro = ref('')

async function carregar() {
  carregando.value = true
  try {
    checklist.value = await lerChecklistDaInternacao(props.internacaoId, {}, parceiroQuery())
    erro.value = ''
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.checklist.erro')).mensagem
  } finally {
    carregando.value = false
  }
}

defineExpose({ carregar })

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
watch(
  () => props.internacaoId,
  () => void carregar(),
)

const registro = useRegistroDeDose(() => {
  void carregar()
  invalidarPendenciasDoPortal()
  emit('mudou')
})

const prescricoes = computed(
  () => new Map((checklist.value?.prescricoes ?? []).map((item) => [item.id, item])),
)
const nomes = computed(
  () =>
    new Map((checklist.value?.profissionais ?? []).map((item) => [item.profissionalId, item.nome])),
)
const meuId = computed(() => store.eu?.profissional?.id ?? null)
const podeRegistrar = computed(
  () => props.podeRegistrar && Boolean(checklist.value && !checklist.value.encerrada),
)

function hora(valor: string) {
  return new Date(valor).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
}

function titulo(dose: DoseNoChecklist) {
  return prescricoes.value.get(dose.prescricaoId)?.descricao ?? t('internacao.dose.item')
}

/** Desfazer: quem registrou, no mesmo plantão, em até 12 h (a API confere de novo). */
function podeDesfazer(dose: DoseNoChecklist) {
  if (!podeRegistrar.value || !meuId.value) return false
  if (dose.status === 'PENDENTE' || dose.status === 'SUSPENSA') return false
  if (dose.executadaPorId !== meuId.value) return false
  if (checklist.value?.plantao && dose.turnoId !== checklist.value.plantao.id) return false
  const quando = dose.registradaEm ?? dose.executadaEm
  return Boolean(quando && Date.now() - new Date(quando).getTime() < 12 * 3600 * 1000)
}

const resumo = computed(() => {
  const contagens = checklist.value?.contagens
  if (!contagens) return ''
  const partes: string[] = []
  if (contagens.dosesAtrasadas)
    partes.push(
      t(
        'internacao.checklist.atrasadas',
        { n: contagens.dosesAtrasadas },
        contagens.dosesAtrasadas,
      ),
    )
  if (contagens.conferenciasAtrasadas)
    partes.push(
      t(
        'internacao.checklist.conferenciasAtrasadas',
        { n: contagens.conferenciasAtrasadas },
        contagens.conferenciasAtrasadas,
      ),
    )
  if (contagens.naJanela)
    partes.push(t('internacao.checklist.naJanela', { n: contagens.naJanela }, contagens.naJanela))
  return partes.length ? partes.join(' · ') : t('internacao.checklist.emDia')
})
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="ck-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-list-checks" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="ck-titulo" class="ui-cartao__titulo">{{ t('internacao.checklist.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ resumo || t('internacao.checklist.descricao') }}</p>
      </span>
    </header>

    <p v-if="checklist?.plantao?.vencido" class="eg__aviso ck__nota">
      <i class="ph ph-clock-countdown" aria-hidden="true" />
      <span>{{
        t('internacao.plantao.vencido', { hora: hora(checklist.plantao.fimPrevisto) })
      }}</span>
    </p>
    <p v-if="registro.recado.value" class="eg__erro ck__nota" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ registro.recado.value }}</span>
    </p>
    <p v-if="erro" class="eg__erro ck__nota" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <template v-if="checklist">
      <p v-if="!checklist.grupos.length" class="ck__nota ck__vazio">
        {{ t('internacao.checklist.vazio') }}
      </p>
      <div v-for="grupo in checklist.grupos" :key="grupo.hora" class="ck__grupo">
        <!-- A hora já está em cada linha: o grupo só marca onde o "agora" passa. -->
        <p v-if="grupo.hora === checklist.linhaDoAgora" class="ck__agora-linha">
          <span class="ck__agora">{{ t('internacao.checklist.agora') }}</span>
        </p>
        <ul class="ui-lista">
          <LinhaDaDose
            v-for="dose in grupo.itens"
            :key="dose.id"
            :dose="dose"
            :prescricao="prescricoes.get(dose.prescricaoId) ?? null"
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
      <p v-if="checklist.truncado" class="eg__dica ck__nota">
        {{ t('internacao.checklist.truncado') }}
      </p>
    </template>

    <RegistrarDoseGaveta
      v-model:visible="registro.gavetaAberta.value"
      :pedido="registro.pedido.value"
      @registrada="(carregar(), invalidarPendenciasDoPortal(), emit('mudou'))"
    />
  </section>
</template>

<style scoped>
.ck__nota {
  margin: 0;
  padding: 0 24px 12px;
}

.ck__vazio {
  color: var(--tinta-2);
  font-size: 14px;
}

.ck__grupo {
  display: grid;
}

/* O "agora": um fio na cor do lugar atravessando a lista, com a palavra encostada. */
.ck__agora-linha {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0 0;
  padding: 0 24px;
}

.ck__agora-linha::after {
  height: 2px;
  flex: 1;
  background: var(--pj-lugar, var(--musgo));
  content: '';
}

.ck__agora {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--pj-lugar, var(--musgo));
  color: var(--pj-lugar-tinta, #10302a);
  font-size: 11px;
  letter-spacing: 0.04em;
}
</style>
