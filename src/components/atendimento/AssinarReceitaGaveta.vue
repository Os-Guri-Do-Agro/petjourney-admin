<script setup lang="ts">
/**
 * Assinar a receita (E4-03, guia e4 6.3 e 6.8): a prévia do que sai no PDF e do que fica só na
 * clínica (com a instrução pronta do servidor), e a senha da conta, que a receita pede sempre. A
 * `Idempotency-Key` vale para a mesma tentativa: o duplo toque recebe a mesma receita.
 *
 * Os recusos têm o caminho de cada um: a senha errada no campo, o selo do CRMV com o link da
 * identidade, o endereço que falta para o controle especial (o perfil da clínica ou a ficha do
 * cliente), a confirmação que voltou a faltar (editar a prescrição), o rascunho sem item que saia
 * no PDF (descartar e finalizar).
 */
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { motivoDaRecusa, ROTA_DA_IDENTIDADE } from '@/composables/useSeloDeAssinatura'
import { ApiError } from '@/service/api'
import { novaChaveDeIdempotencia } from '@/service/idempotencia'
import { assinarReceita, type Receita } from '@/service/parceiro/receitas-service'

import SenhaDaAssinatura from './SenhaDaAssinatura.vue'
import { useSenhaDaAssinatura } from './useSenhaDaAssinatura'

const props = defineProps<{ receita: Receita | null; pacienteId: string }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ assinada: [receita: Receita]; descartar: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const senha = useSenhaDaAssinatura()

const salvando = ref(false)
const erro = ref('')
const recusa = ref<string | null>(null)
const faltando = ref<string[]>([])
const semItemEmitivel = ref(false)
let chave: string | null = null

watch(aberta, (agora) => {
  if (agora) {
    erro.value = ''
    recusa.value = null
    faltando.value = []
    semItemEmitivel.value = false
    chave = null
    senha.pedindo.value = true
  } else {
    senha.limpar()
  }
})

const noPdf = computed(() => props.receita?.itens.filter((item) => !item.foraDoPdf) ?? [])
const foraDoPdf = computed(() => {
  const receita = props.receita
  if (!receita) return []
  return receita.foraDoPdf.map((fora) => ({
    ...fora,
    nome: receita.itens.find((item) => item.prescricaoId === fora.prescricaoId)?.nome ?? '',
  }))
})

async function assinar() {
  const receita = props.receita
  if (!receita || !senha.senha.value) return
  salvando.value = true
  erro.value = ''
  recusa.value = null
  faltando.value = []
  chave ??= novaChaveDeIdempotencia()
  try {
    const assinada = await assinarReceita(receita.id, senha.senha.value, chave, parceiroQuery())
    chave = null
    senha.concluir()
    aberta.value = false
    emit('assinada', assinada)
  } catch (err) {
    if (senha.tratar(err)) {
      chave = null
      return
    }
    const motivo = motivoDaRecusa(err)
    if (motivo) {
      recusa.value = motivo
      return
    }
    const lido = lerErroDoCadastro(err, t('atendimento.receita.assinar.erro'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    chave = null
    if (lido.codigo === 'ENDERECO_OBRIGATORIO_NA_RECEITA') {
      faltando.value = Array.isArray(detalhes.faltando) ? (detalhes.faltando as string[]) : []
      return
    }
    if (lido.codigo === 'RECEITA_SEM_ITEM_EMITIVEL') {
      semItemEmitivel.value = true
      return
    }
    if (lido.codigo === 'CONFIRMACAO_PENDENTE') {
      erro.value = t('atendimento.receita.assinar.confirmacao')
      return
    }
    if (lido.codigo === 'RECEITA_ARQUIVO_INDISPONIVEL') {
      erro.value = t('atendimento.receita.assinar.arquivo')
      return
    }
    erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}

const faltaDoEstabelecimento = computed(() => faltando.value.includes('estabelecimentoEndereco'))
const faltaDoComprador = computed(() =>
  faltando.value.some((campo) => campo.startsWith('comprador')),
)
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('atendimento.receita.assinar.titulo')"
    icone="ph ph-signature"
    largura="36rem"
  >
    <form v-if="receita" id="assinar-receita" class="eg" novalidate @submit.prevent="assinar">
      <p class="eg__dica">{{ t('atendimento.receita.assinar.dica') }}</p>

      <section class="eg__secao">
        <span class="eg__rotulo">{{ t('atendimento.receita.assinar.noPdf') }}</span>
        <ul v-if="noPdf.length" class="ar__lista">
          <li v-for="item in noPdf" :key="item.prescricaoId">
            <strong>{{ item.nome }}</strong>
            <span>{{ item.frase }}</span>
            <small v-if="item.instrucoes">{{ item.instrucoes }}</small>
          </li>
        </ul>
        <small v-else class="eg__dica">{{ t('atendimento.receita.assinar.nadaNoPdf') }}</small>
      </section>

      <section v-if="foraDoPdf.length" class="eg__secao">
        <span class="eg__rotulo">{{ t('atendimento.receita.foraDoPdf') }}</span>
        <ul class="ar__lista">
          <li v-for="item in foraDoPdf" :key="item.prescricaoId">
            <strong>{{ item.nome }}</strong>
            <span class="ar__instrucao">
              <i class="ph ph-info" aria-hidden="true" />
              {{ item.instrucao }}
            </span>
          </li>
        </ul>
      </section>

      <SenhaDaAssinatura
        id="ar-senha"
        :dica="t('atendimento.receita.assinar.senhaDica')"
        v-model="senha.senha.value"
        :erro="senha.erroDaSenha.value"
        :sem-senha-propria="senha.semSenhaPropria.value"
        :desabilitado="salvando"
      />

      <p v-if="recusa" class="eg__erro" role="alert">
        <i class="ph ph-seal-warning" aria-hidden="true" />
        <span>{{ t(`settings.identidade.selo.${recusa}`) }}</span>
        <RouterLink v-if="recusa === 'SEM_IDENTIDADE'" :to="ROTA_DA_IDENTIDADE">{{
          t('atendimento.selo.verificar')
        }}</RouterLink>
      </p>

      <div v-if="faltando.length" class="eg__erro ar__faltando" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>
          {{ t('atendimento.receita.assinar.endereco') }}
          <RouterLink v-if="faltaDoEstabelecimento" to="/parceiro/estabelecimento">{{
            t('atendimento.receita.assinar.abrirPerfil')
          }}</RouterLink>
          <RouterLink v-if="faltaDoComprador" :to="`/clinica/ficha/${pacienteId}`">{{
            t('atendimento.receita.assinar.abrirFicha')
          }}</RouterLink>
        </span>
      </div>

      <div v-if="semItemEmitivel" class="eg__erro ar__faltando" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ t('atendimento.receita.assinar.semItem') }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :label="t('atendimento.receita.descartar')"
          @click="emit('descartar')"
        />
      </div>

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
        form="assinar-receita"
        icon="ph ph-signature"
        :label="t('atendimento.receita.assinar.confirmar')"
        :disabled="!senha.senha.value || senha.semSenhaPropria.value"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ar__lista {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ar__lista li {
  display: grid;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ar__lista strong {
  color: var(--tinta);
  font-size: 14px;
}

.ar__instrucao {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.ar__instrucao i {
  margin-top: 2px;
  color: var(--atencao-tinta);
}

.ar__faltando {
  flex-wrap: wrap;
}

.ar__faltando a {
  margin-inline-start: 6px;
  color: var(--tinta);
}
</style>
