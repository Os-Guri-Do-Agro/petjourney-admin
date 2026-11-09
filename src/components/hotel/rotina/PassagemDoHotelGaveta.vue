<script setup lang="ts">
/**
 * Passar o turno do hotel (E7-05b, guia e7 43): quem recebe (a ficha de alguém da casa que cuida
 * da rotina, diferente de quem entrega) e a nota. A lista congelada leva só a atrasada e a da janela
 * de 30 minutos; a futura fica na prancheta de quem recebe. Tarefa atrasada não trava.
 *
 * O que trava é a R3: ocorrência GRAVE sem ligação ao responsável (409 `OCORRENCIA_SEM_CONTATO`),
 * e o turno continua aberto. A gaveta mostra as graves no topo, antes de a pessoa escrever.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  entregarTurno,
  NOTA_DA_PASSAGEM_MAX,
  type EntregaDoTurno,
  type TurnoAtual,
} from '@/service/parceiro/hotel-rotina-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

const props = defineProps<{ turno: TurnoAtual | null; profissionais: Profissional[] }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ entregue: [entrega: EntregaDoTurno]; releu: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const recebidoPor = ref<string | null>(null)
const nota = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  recebidoPor.value = null
  nota.value = ''
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

const responsavelId = computed(() => props.turno?.atual?.responsavel.profissionalId ?? null)
const opcoes = computed(() =>
  props.profissionais
    .filter((item) => item.ativo && item.usuarioId && item.id !== responsavelId.value)
    .map((item) => ({ valor: item.id, rotulo: item.nome })),
)

const travas = computed(() => props.turno?.ocorrenciasSemContato ?? [])
/** O que vai congelado: a atrasada e a da janela. */
const vaoJunto = computed(
  () => props.turno?.pendencias.filter((item) => item.situacao !== 'futura').length ?? 0,
)

const valido = computed(() => Boolean(recebidoPor.value) && nota.value.trim().length > 0)

async function entregar() {
  tentou.value = true
  erro.value = ''
  const atual = props.turno?.atual
  if (!atual || !valido.value) return
  const corpo = { recebidoPorId: recebidoPor.value!, nota: nota.value.trim() }
  salvando.value = true
  try {
    const entrega = await entregarTurno(atual.id, corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('entregue', entrega)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('rotinaDoHotel.turno.erroPassar'))
    const detalhes = err instanceof ApiError ? err.detalhes : {}
    switch (lido.codigo) {
      case 'OCORRENCIA_SEM_CONTATO': {
        const total = Number(detalhes.total ?? 0)
        erro.value = t('rotinaDoHotel.turno.travaPassagem', { n: total }, total)
        emit('releu')
        break
      }
      case 'PASSAGEM_DO_HOTEL_GRANDE_DEMAIS':
        erro.value = t('rotinaDoHotel.turno.grandeDemais')
        break
      case 'PROFISSIONAL_OBRIGATORIO':
        erro.value = t('rotinaDoHotel.semFicha')
        break
      case 'TURNO_DO_HOTEL_ENCERRADO':
      case 'PLANTAO_DO_HOTEL_TROCOU':
        erro.value = lido.mensagem
        emit('releu')
        break
      default:
        erro.value = lido.mensagem
    }
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('rotinaDoHotel.turno.passar')"
    icone="ph ph-arrows-left-right"
  >
    <form id="passagem-hotel" class="eg" novalidate @submit.prevent="entregar">
      <section v-if="travas.length" class="eg__secao pg__trava">
        <p class="eg__erro">
          <i class="ph ph-phone-call" aria-hidden="true" />
          <span>{{
            t('rotinaDoHotel.turno.travaPassagem', { n: travas.length }, travas.length)
          }}</span>
        </p>
        <ul class="pg__lista">
          <li v-for="item in travas" :key="item.id">
            <RouterLink :to="`/hotel/hospedagem/${item.hospedagemId}#ocorrencias`">
              {{ item.pacienteNome }} · {{ t(`rotinaDoHotel.ocorrencia.kind.${item.kind}`) }}
            </RouterLink>
          </li>
        </ul>
      </section>

      <p class="eg__dica">
        {{ t('rotinaDoHotel.turno.vaoJunto', { n: vaoJunto }, vaoJunto) }}
      </p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="pg-quem">{{ t('rotinaDoHotel.turno.quemRecebe') }}</label>
        <Select
          v-model="recebidoPor"
          input-id="pg-quem"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          filter
          :invalid="tentou && !recebidoPor"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="pg-nota">{{ t('rotinaDoHotel.turno.nota') }}</label>
        <Textarea
          id="pg-nota"
          v-model="nota"
          rows="4"
          auto-resize
          :maxlength="NOTA_DA_PASSAGEM_MAX"
          :invalid="tentou && !nota.trim()"
          :disabled="salvando"
        />
      </section>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </form>
    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="passagem-hotel"
        icon="ph ph-check"
        :label="t('rotinaDoHotel.turno.entregar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.pg__trava {
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-controle);
}

.pg__lista {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-inline-start: 28px;
  font-size: 14px;
}

.pg__lista a {
  color: var(--tinta);
  font-weight: 600;
}
</style>
