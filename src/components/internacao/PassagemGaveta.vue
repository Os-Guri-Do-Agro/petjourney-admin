<script setup lang="ts">
/**
 * Passar o plantão (E5-02c, guia e5 15.3 e 16.3): quem recebe (vira o responsável do seguinte), a
 * nota obrigatória e o dono de cada dose em cima da troca (a janela de 30 min contém o agora). As
 * atrasadas não travam: entram na lista congelada com quem recebe como dono.
 *
 * A API recusa quem não executa a internação (recepção, gestor, quem saiu da equipe) e devolve as
 * doses que ainda pedem dono: a gaveta marca as que faltam.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  entregarPlantao,
  NOTA_DA_PASSAGEM_MAX,
  type Entrega,
  type PlantaoAtual,
} from '@/service/parceiro/plantao-da-internacao-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

const props = defineProps<{ plantao: PlantaoAtual | null; profissionais: Profissional[] }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ entregue: [entrega: Entrega] }>()

const { t, locale } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const recebidoPor = ref<string | null>(null)
const nota = ref('')
const donos = ref<Record<string, string | null>>({})
const semDono = ref<string[]>([])
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

const responsavelId = computed(() => props.plantao?.atual?.responsavel.profissionalId ?? null)

/** As doses que pedem dono: as da troca, mais as que a API devolveu sem dono. */
const dosesDaTroca = computed(() =>
  (props.plantao?.pendencias ?? []).filter(
    (item) => item.exigeDonoNaPassagem || semDono.value.includes(item.administracaoId),
  ),
)

watch(aberta, (agora) => {
  if (!agora) return
  recebidoPor.value = null
  nota.value = ''
  donos.value = Object.fromEntries(
    (props.plantao?.pendencias ?? []).map((item) => [item.administracaoId, item.atribuidaAId]),
  )
  semDono.value = []
  tentou.value = false
  erro.value = ''
  chaveador.concluir()
})

/* Quem recebe ainda não tem dose: as da troca sem dono vão para ele por padrão. */
watch(recebidoPor, (agora) => {
  if (!agora) return
  for (const item of dosesDaTroca.value) {
    if (!donos.value[item.administracaoId]) donos.value[item.administracaoId] = agora
  }
})

const opcoesDePessoas = computed(() =>
  props.profissionais
    .filter((item) => item.ativo && item.usuarioId)
    .map((item) => ({ valor: item.id, rotulo: item.nome })),
)
const opcoesDeQuemRecebe = computed(() =>
  opcoesDePessoas.value.filter((item) => item.valor !== responsavelId.value),
)

const prescricoes = computed(
  () => new Map((props.plantao?.prescricoes ?? []).map((item) => [item.id, item])),
)
const internacoes = computed(
  () => new Map((props.plantao?.internacoes ?? []).map((item) => [item.id, item])),
)

function descricao(item: { prescricaoId: string; internacaoId: string; previstaPara: string }) {
  const internacao = internacoes.value.get(item.internacaoId)
  return [
    new Date(item.previstaPara).toLocaleTimeString(locale.value, {
      hour: '2-digit',
      minute: '2-digit',
    }),
    internacao ? `${internacao.pacienteNome} (${internacao.leitoNome})` : '',
    prescricoes.value.get(item.prescricaoId)?.descricao ?? '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const valido = computed(
  () =>
    Boolean(recebidoPor.value) &&
    nota.value.trim().length > 0 &&
    dosesDaTroca.value.every((item) => Boolean(donos.value[item.administracaoId])),
)

async function entregar() {
  tentou.value = true
  erro.value = ''
  const atual = props.plantao?.atual
  if (!atual || !valido.value) return
  const atribuicoes = Object.entries(donos.value)
    .filter(([, dono]) => Boolean(dono))
    .map(([administracaoId, profissionalId]) => ({
      administracaoId,
      profissionalId: profissionalId!,
    }))
  const corpo = { recebidoPorId: recebidoPor.value!, nota: nota.value.trim(), atribuicoes }
  salvando.value = true
  try {
    const entrega = await entregarPlantao(atual.id, corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('entregue', entrega)
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('internacao.plantao.erroEntregar'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    if (lido.codigo === 'DOSE_SEM_DONO_NA_PASSAGEM' && Array.isArray(detalhes.administracaoIds)) {
      semDono.value = detalhes.administracaoIds as string[]
      erro.value = t('internacao.plantao.facaDono')
      return
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('internacao.plantao.passar')"
    icone="ph ph-arrows-left-right"
    largura="36rem"
  >
    <form id="passagem-form" class="eg" novalidate @submit.prevent="entregar">
      <p class="eg__dica">{{ t('internacao.plantao.passarDica') }}</p>

      <section class="eg__secao">
        <label class="eg__rotulo" for="pp-recebe">{{ t('internacao.plantao.quemRecebe') }}</label>
        <Select
          v-model="recebidoPor"
          input-id="pp-recebe"
          :options="opcoesDeQuemRecebe"
          option-label="rotulo"
          option-value="valor"
          :invalid="tentou && !recebidoPor"
          :disabled="salvando"
        />
      </section>

      <section class="eg__secao">
        <label class="eg__rotulo" for="pp-nota">{{ t('internacao.plantao.nota') }}</label>
        <Textarea
          id="pp-nota"
          v-model="nota"
          rows="4"
          auto-resize
          :maxlength="NOTA_DA_PASSAGEM_MAX"
          :placeholder="t('internacao.plantao.notaExemplo')"
          :invalid="tentou && !nota.trim()"
          :disabled="salvando"
        />
      </section>

      <div v-if="dosesDaTroca.length" class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('internacao.plantao.dosesDaTroca') }}</h3>
        <section v-for="item in dosesDaTroca" :key="item.administracaoId" class="eg__secao">
          <label class="eg__rotulo" :for="`pp-dono-${item.administracaoId}`">{{
            descricao(item)
          }}</label>
          <Select
            v-model="donos[item.administracaoId]"
            :input-id="`pp-dono-${item.administracaoId}`"
            :options="opcoesDePessoas"
            option-label="rotulo"
            option-value="valor"
            :placeholder="t('internacao.plantao.escolhaDono')"
            :invalid="tentou && !donos[item.administracaoId]"
            :disabled="salvando"
          />
        </section>
      </div>

      <p v-if="(plantao?.pendencias.length ?? 0) > dosesDaTroca.length" class="eg__dica">
        {{
          t(
            'internacao.plantao.restoVai',
            { n: (plantao?.pendencias.length ?? 0) - dosesDaTroca.length },
            (plantao?.pendencias.length ?? 0) - dosesDaTroca.length,
          )
        }}
      </p>

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
        form="passagem-form"
        icon="ph ph-arrows-left-right"
        :label="t('internacao.plantao.entregar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>
