<script setup lang="ts">
/**
 * Escolher o horário do retorno (E4-01, guia e4 5.7): as sugestões da agenda a partir do
 * vencimento, com quem atendeu (pode trocar). O tipo é o que o veterinário escolheu; sem escolha,
 * a recepção escolhe aqui. Marca pelo `POST .../retorno` com o `inicio` escolhido, e a tela de
 * trás oferece o "Desfazer".
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { lerErroDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import type { TipoDeAtendimento } from '@/service/parceiro/agenda-config-service'
import { obterSugestoes, type Sugestoes } from '@/service/parceiro/agenda-service'
import {
  marcarRetorno,
  type Mutacao,
  type RetornoPendente,
} from '@/service/parceiro/atendimentos-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

const props = defineProps<{
  retorno: RetornoPendente | null
  /** O dia de hoje no fuso da clínica (`hoje` da lista de pendentes). */
  hoje: string
  tipos: TipoDeAtendimento[]
  profissionais: Profissional[]
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ marcado: [mutacao: Mutacao, texto: string] }>()

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const tipoId = ref<string | null>(null)
const profissionalId = ref<string | null>(null)
const sugestoes = ref<Sugestoes['sugestoes']>([])
const escolhido = ref<string | null>(null)
const buscando = ref(false)
const salvando = ref(false)
const erro = ref('')

/** O tipo é do veterinário: com ele escolhido, a recepção não troca. */
const tipoFixo = computed(() => Boolean(props.retorno?.tipoId))

watch(aberta, (agora) => {
  if (!agora || !props.retorno) return
  tipoId.value =
    props.retorno.tipoId ?? props.tipos.find((tipo) => tipo.kind === 'RETORNO')?.id ?? null
  /* Quem atendeu, se ainda está na lista; senão, a busca sem profissional (qualquer um). */
  profissionalId.value =
    props.profissionais.find((p) => p.id === props.retorno?.profissionalId)?.id ?? null
  escolhido.value = null
  erro.value = ''
  void buscar()
})

watch([tipoId, profissionalId], () => {
  if (aberta.value) void buscar()
})

async function buscar() {
  const retorno = props.retorno
  if (!retorno || !tipoId.value) {
    sugestoes.value = []
    return
  }
  buscando.value = true
  erro.value = ''
  escolhido.value = null
  try {
    const lido = await obterSugestoes(
      {
        pacienteId: retorno.pacienteId,
        tipoId: tipoId.value,
        profissionalId: profissionalId.value,
        aPartirDe: retorno.venceEm < props.hoje ? props.hoje : retorno.venceEm,
        quantidade: 8,
      },
      parceiroQuery(),
    )
    sugestoes.value = lido.sugestoes
  } catch (err) {
    sugestoes.value = []
    erro.value = lerErroDaAgenda(err, t('atendimento.retornos.erro.sugestoes')).mensagem
  } finally {
    buscando.value = false
  }
}

const opcoesDeTipo = computed(() =>
  props.tipos.map((tipo) => ({ valor: tipo.id, rotulo: tipo.nome })),
)
const opcoesDeProfissional = computed(() =>
  props.profissionais.map((p) => ({ valor: p.id, rotulo: p.nome })),
)

function rotuloDoHorario(inicio: string) {
  return `${rotulos.dia(inicio.slice(0, 10))} ${inicio.slice(11, 16)}`
}

async function marcar() {
  const retorno = props.retorno
  const horario = sugestoes.value.find((item) => item.inicio === escolhido.value)
  if (!retorno || !horario) return
  salvando.value = true
  erro.value = ''
  const corpo = {
    inicio: horario.inicio,
    profissionalId: horario.profissionalId,
    ...(tipoFixo.value || !tipoId.value ? {} : { tipoId: tipoId.value }),
  }
  try {
    const mutacao = await marcarRetorno(
      retorno.atendimentoId,
      corpo,
      chaveador.para({ id: retorno.atendimentoId, ...corpo }),
      parceiroQuery(),
    )
    chaveador.concluir()
    emit(
      'marcado',
      mutacao,
      t('atendimento.retornos.marcado', {
        pet: retorno.pacienteNome,
        quando: rotuloDoHorario(horario.inicio),
      }),
    )
    aberta.value = false
  } catch (err) {
    erro.value = lerErroDaAgenda(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('atendimento.retornos.escolherTitulo')"
    icone="ph ph-calendar-plus"
    largura="32rem"
  >
    <form v-if="retorno" id="retorno-form" class="eg" novalidate @submit.prevent="marcar">
      <p class="eg__dica">
        {{
          t('atendimento.retornos.escolherDica', {
            pet: retorno.pacienteNome,
            dia: rotulos.dia(retorno.venceEm),
          })
        }}
      </p>

      <div class="eg__linha">
        <section class="eg__secao">
          <label class="eg__rotulo" for="retorno-tipo">{{ t('atendimento.retornos.tipo') }}</label>
          <Select
            v-model="tipoId"
            input-id="retorno-tipo"
            :options="opcoesDeTipo"
            option-label="rotulo"
            option-value="valor"
            :placeholder="t('atendimento.retornos.escolherTipo')"
            :disabled="salvando || tipoFixo"
          />
          <small v-if="tipoFixo" class="eg__dica">{{ t('atendimento.retornos.tipoDoVet') }}</small>
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="retorno-quem">{{
            t('atendimento.retornos.comQuem')
          }}</label>
          <Select
            v-model="profissionalId"
            input-id="retorno-quem"
            :options="opcoesDeProfissional"
            option-label="rotulo"
            option-value="valor"
            show-clear
            :placeholder="t('clinico.fila.qualquerProfissional')"
            :disabled="salvando"
          />
        </section>
      </div>

      <section class="eg__secao" :aria-busy="buscando">
        <span id="retorno-horarios" class="eg__rotulo">{{
          t('atendimento.retornos.horarios')
        }}</span>
        <div
          v-if="sugestoes.length"
          class="rg__horarios"
          role="radiogroup"
          aria-labelledby="retorno-horarios"
        >
          <Button
            v-for="item in sugestoes"
            :key="`${item.profissionalId}-${item.inicio}`"
            type="button"
            size="small"
            role="radio"
            :aria-checked="escolhido === item.inicio"
            :severity="escolhido === item.inicio ? undefined : 'secondary'"
            :outlined="escolhido !== item.inicio"
            :label="rotuloDoHorario(item.inicio)"
            :disabled="salvando"
            @click="escolhido = item.inicio"
          />
        </div>
        <small v-else-if="!buscando && tipoId" class="eg__dica">{{
          t('atendimento.retornos.semSugestao')
        }}</small>
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
        form="retorno-form"
        icon="ph ph-calendar-check"
        :label="t('atendimento.retornos.marcar')"
        :disabled="!escolhido"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.rg__horarios {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
