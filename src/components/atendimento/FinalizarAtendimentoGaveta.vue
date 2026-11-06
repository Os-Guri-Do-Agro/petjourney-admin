<script setup lang="ts">
/**
 * Revisar e finalizar o atendimento (E4-01, guia e4 5.5 e 6.8). Antes de finalizar, a tela mostra
 * o que vai ao responsável quando o resumo for liberado: depois, orientação errada só se corrige
 * por adendo. Finalizar não publica (o resumo se libera depois) e a copy nunca diz "assinado
 * digitalmente".
 *
 * - Quem finaliza o atendimento de outro veterinário confirma que assina o que não escreveu
 *   (`confirmarOutroResponsavel`; sem isso, 409 `ATENDIMENTO_DE_OUTRO_PROFISSIONAL`).
 * - A senha da conta, a cada 15 minutos por sessão (401 `ASSINATURA_SENHA_EXIGIDA`).
 * - O selo do CRMV (E1-08): sem ele, 403 `CRMV_NAO_CONFERIDO`; o aviso fica no botão, nunca o
 *   esconde.
 * - 422 `ATENDIMENTO_INCOMPLETO`: o que falta, com o atalho para a seção.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  motivoDaRecusa,
  ROTA_DA_IDENTIDADE,
  useSeloDeAssinatura,
  type MotivoDaRecusa,
} from '@/composables/useSeloDeAssinatura'
import { ApiError } from '@/service/api'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  finalizarAtendimento,
  type Atendimento,
  type SecaoDoAtendimento,
} from '@/service/parceiro/atendimentos-service'

import { FALTAS_CONHECIDAS, SECAO_DA_FALTA, type RascunhoNaTela } from './rascunho-do-atendimento'
import SenhaDaAssinatura from './SenhaDaAssinatura.vue'
import { useSenhaDaAssinatura } from './useSenhaDaAssinatura'

const props = defineProps<{
  atendimento: Atendimento
  rascunho: RascunhoNaTela
  versao: number
  dispositivoId: string
  /** Grava o que está pendente antes de finalizar; `false` quando não deu. */
  esperarGravar: () => Promise<boolean>
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{
  finalizado: [atendimento: Atendimento]
  faltam: [faltam: string[]]
  irPara: [secao: SecaoDoAtendimento]
  alterado: []
}>()

const { t, te } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()
const selo = useSeloDeAssinatura()
const senha = useSenhaDaAssinatura()
const chaveador = criarChaveadorDeIdempotencia()

const confirmarOutro = ref(false)
const pedirConfirmacao = ref(false)
const faltam = ref<string[]>([])
const recusa = ref<MotivoDaRecusa | null>(null)
const erro = ref('')
const salvando = ref(false)

/** O responsável é outro: a confirmação aparece de saída, sem esperar o 409. */
const deOutro = computed(
  () =>
    Boolean(store.eu?.profissional?.id) &&
    store.eu?.profissional?.id !== props.atendimento.profissional.id,
)

watch(aberta, (agora) => {
  if (agora) {
    confirmarOutro.value = false
    pedirConfirmacao.value = deOutro.value
    faltam.value = [...props.atendimento.faltamParaFinalizar]
    recusa.value = null
    erro.value = ''
  } else {
    senha.limpar()
  }
})

/* ----------------------------------------------------------------- o que vai ao app */

const paraOApp = computed(() => {
  const r = props.rascunho
  const diagnosticos = r.diagnostico.semDiagnostico
    ? []
    : r.diagnostico.itens.filter((item) => item.kind !== 'DIFERENCIAL' && item.descricao.trim())
  return {
    diagnosticos,
    orientacoes: (r.conduta.orientacoes ?? '').trim(),
    sinais: (r.conduta.sinaisDeAlerta ?? '').trim(),
    retorno: r.conduta.retornoEmDias,
  }
})

const soNaClinica = computed(() => {
  const r = props.rascunho
  const diferenciais = r.diagnostico.semDiagnostico
    ? 0
    : r.diagnostico.itens.filter((item) => item.kind === 'DIFERENCIAL' && item.descricao.trim())
        .length
  return { diferenciais, interna: Boolean((r.conduta.observacaoInterna ?? '').trim()) }
})

function fraseDaFalta(codigo: string) {
  return (FALTAS_CONHECIDAS as readonly string[]).includes(codigo) &&
    te(`atendimento.finalizar.falta.${codigo}`)
    ? t(`atendimento.finalizar.falta.${codigo}`)
    : t('atendimento.finalizar.falta.outra')
}

function irPara(codigo: string) {
  const secao = SECAO_DA_FALTA[codigo]
  if (!secao) return
  aberta.value = false
  emit('irPara', secao)
}

/* -------------------------------------------------------------------------- finalizar */

async function finalizar() {
  erro.value = ''
  recusa.value = null
  if (pedirConfirmacao.value && !confirmarOutro.value) {
    erro.value = t('atendimento.finalizar.confirmeOutro')
    return
  }
  salvando.value = true
  try {
    const gravou = await props.esperarGravar()
    if (!gravou) {
      erro.value = t('atendimento.finalizar.naoGravou')
      return
    }
    const corpo = {
      versao: props.versao,
      dispositivoId: props.dispositivoId,
      ...(confirmarOutro.value ? { confirmarOutroResponsavel: true } : {}),
    }
    const novo = await finalizarAtendimento(
      props.atendimento.id,
      { ...corpo, ...senha.campo() },
      chaveador.para({ id: props.atendimento.id, ...corpo }),
      parceiroQuery(),
    )
    chaveador.concluir()
    senha.concluir()
    aberta.value = false
    emit('finalizado', novo)
  } catch (err) {
    if (senha.tratar(err)) return
    const motivo = motivoDaRecusa(err)
    if (motivo) {
      recusa.value = motivo
      return
    }
    const lido = lerErroDoCadastro(err, t('atendimento.finalizar.erro'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    if (lido.codigo === 'ATENDIMENTO_INCOMPLETO') {
      faltam.value = Array.isArray(detalhes.faltam) ? (detalhes.faltam as string[]) : []
      emit('faltam', faltam.value)
      return
    }
    if (lido.codigo === 'ATENDIMENTO_DE_OUTRO_PROFISSIONAL') {
      pedirConfirmacao.value = true
      erro.value = t('atendimento.finalizar.confirmeOutro')
      return
    }
    if (lido.codigo === 'ATENDIMENTO_ALTERADO') {
      erro.value = t('atendimento.finalizar.alterado')
      emit('alterado')
      return
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}

const aguardaSelo = computed(() => selo.permissaoAguarda('prontuario.finalizar'))
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('atendimento.finalizar.titulo')"
    icone="ph ph-check-circle"
    largura="36rem"
  >
    <form id="finalizar-atendimento" class="eg" novalidate @submit.prevent="finalizar">
      <p class="eg__dica">{{ t('atendimento.finalizar.dica') }}</p>

      <!-- O que falta: o finalizar não passa sem. -->
      <section v-if="faltam.length" class="eg__secao fa__faltam" role="alert">
        <span class="eg__rotulo">{{ t('atendimento.finalizar.faltamTitulo') }}</span>
        <ul class="fa__lista">
          <li v-for="codigo in faltam" :key="codigo">
            <i class="ph ph-warning-circle" aria-hidden="true" />
            <span>{{ fraseDaFalta(codigo) }}</span>
            <Button
              v-if="SECAO_DA_FALTA[codigo]"
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('atendimento.finalizar.irPara')"
              @click="irPara(codigo)"
            />
          </li>
        </ul>
      </section>

      <!-- O que vai ao responsável quando o resumo for liberado. -->
      <section class="eg__secao">
        <span class="eg__rotulo">{{ t('atendimento.finalizar.vaiAoApp') }}</span>
        <dl class="fa__revisao">
          <div>
            <dt>{{ t('atendimento.finalizar.diagnosticos') }}</dt>
            <dd v-if="rascunho.diagnostico.semDiagnostico">
              {{ t('atendimento.diagnostico.sem') }}
            </dd>
            <dd v-else-if="paraOApp.diagnosticos.length">
              {{ paraOApp.diagnosticos.map((item) => item.descricao.trim()).join('; ') }}
            </dd>
            <dd v-else class="fa__vazio">{{ t('atendimento.finalizar.nada') }}</dd>
          </div>
          <div>
            <dt>{{ t('atendimento.conduta.orientacoes') }}</dt>
            <dd v-if="paraOApp.orientacoes" class="fa__texto">{{ paraOApp.orientacoes }}</dd>
            <dd v-else class="fa__vazio">{{ t('atendimento.finalizar.nada') }}</dd>
          </div>
          <div v-if="paraOApp.sinais">
            <dt>{{ t('atendimento.conduta.sinaisDeAlerta') }}</dt>
            <dd class="fa__texto">{{ paraOApp.sinais }}</dd>
          </div>
          <div v-if="paraOApp.retorno">
            <dt>{{ t('atendimento.conduta.retorno') }}</dt>
            <dd>
              {{ t('atendimento.finalizar.retornoEm', { n: paraOApp.retorno }, paraOApp.retorno) }}
            </dd>
          </div>
        </dl>
        <small class="eg__dica">
          {{
            soNaClinica.diferenciais || soNaClinica.interna
              ? t('atendimento.finalizar.ficaNaClinica')
              : t('atendimento.finalizar.depois')
          }}
        </small>
      </section>

      <!-- Assinar o que outro veterinário escreveu. -->
      <label v-if="pedirConfirmacao" class="fa__confirmar" for="fa-outro">
        <Checkbox v-model="confirmarOutro" input-id="fa-outro" binary :disabled="salvando" />
        <span>{{
          t('atendimento.finalizar.outroResponsavel', { nome: atendimento.profissional.nome })
        }}</span>
      </label>

      <SenhaDaAssinatura
        v-if="senha.pedindo.value || senha.semSenhaPropria.value"
        id="fa-senha"
        v-model="senha.senha.value"
        :erro="senha.erroDaSenha.value"
        :sem-senha-propria="senha.semSenhaPropria.value"
        :desabilitado="salvando"
      />

      <p v-if="recusa || aguardaSelo" class="eg__erro" role="alert">
        <i class="ph ph-seal-warning" aria-hidden="true" />
        <span>{{ t(`atendimento.selo.${recusa ?? selo.motivo.value ?? 'SEM_SELO'}`) }}</span>
        <RouterLink
          v-if="(recusa ?? selo.motivo.value) === 'SEM_IDENTIDADE'"
          :to="ROTA_DA_IDENTIDADE"
          >{{ t('atendimento.selo.verificar') }}</RouterLink
        >
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
        :label="t('atendimento.finalizar.voltar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="finalizar-atendimento"
        icon="ph ph-check-circle"
        :label="t('atendimento.finalizar.confirmar')"
        :loading="salvando"
        :disabled="senha.semSenhaPropria.value || (senha.pedindo.value && !senha.senha.value)"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.fa__lista {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.fa__lista li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--atencao-tinta);
  font-size: 14px;
}

.fa__revisao {
  display: grid;
  gap: 12px;
  margin: 0;
}

.fa__revisao dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.fa__revisao dd {
  margin: 2px 0 0;
  color: var(--tinta);
  font-size: 14px;
}

.fa__texto {
  white-space: pre-line;
}

.fa__vazio {
  color: var(--tinta-3) !important;
}

.fa__confirmar {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
  cursor: pointer;
}
</style>
