<script setup lang="ts">
/**
 * Repetir a receita (E4-03b, P13) num atendimento aberto do mesmo paciente: um rascunho que já
 * existe ou um avulso novo. As prescrições chegam sem as confirmações e com a conta do peso de
 * agora; as que não voltaram (medicamento desativado, alergia a confirmar, sem peso) são ditas na
 * tela de destino.
 */
import Button from 'primevue/button'
import RadioButton from 'primevue/radiobutton'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { novaChaveDeIdempotencia } from '@/service/idempotencia'
import {
  abrirAvulso,
  abrirEdicao,
  dispositivoDaAba,
  listarAtendimentos,
  type ItemDaLista,
} from '@/service/parceiro/atendimentos-service'
import { repetirReceita, type Receita, type Repeticao } from '@/service/parceiro/receitas-service'

const props = defineProps<{ receita: Receita | null; pacienteId: string }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ repetida: [repeticao: Repeticao, destinoId: string] }>()

const { t } = useI18n()
const router = useRouter()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()

const NOVO = 'novo'
const rascunhos = ref<ItemDaLista[]>([])
const destino = ref<string>(NOVO)
const carregando = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, async (agora) => {
  if (!agora) return
  erro.value = ''
  destino.value = NOVO
  carregando.value = true
  try {
    const pagina = await listarAtendimentos({ status: 'RASCUNHO', limit: 50 }, parceiroQuery())
    rascunhos.value = pagina.itens.filter((item) => item.pacienteId === props.pacienteId)
    if (rascunhos.value[0]) destino.value = rascunhos.value[0].id
  } catch {
    rascunhos.value = []
  } finally {
    carregando.value = false
  }
})

async function repetir() {
  const receita = props.receita
  if (!receita) return
  salvando.value = true
  erro.value = ''
  try {
    const dispositivoId = dispositivoDaAba()
    const atendimentoId =
      destino.value === NOVO
        ? (
            await abrirAvulso(
              { pacienteId: props.pacienteId },
              novaChaveDeIdempotencia(),
              parceiroQuery(),
            )
          ).id
        : destino.value
    /* O destino é um rascunho com o lock desta aba: a repetição é uma gravação dele. */
    const edicao = await abrirEdicao(atendimentoId, { dispositivoId }, parceiroQuery())
    if (edicao.somenteLeitura) {
      erro.value = t('atendimento.receita.repetir.emOutra')
      return
    }
    const repeticao = await repetirReceita(
      receita.id,
      { atendimentoId, versao: edicao.versao, dispositivoId },
      parceiroQuery(),
    )
    aberta.value = false
    emit('repetida', repeticao, atendimentoId)
    void router.push({ path: `/clinica/atendimento/${atendimentoId}`, query: { secao: 'RECEITA' } })
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('atendimento.receita.repetir.erro')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('atendimento.receita.repetir.titulo')"
    icone="ph ph-arrows-clockwise"
  >
    <form id="repetir-receita" class="eg" novalidate @submit.prevent="repetir">
      <p class="eg__dica">{{ t('atendimento.receita.repetir.dica') }}</p>
      <section class="eg__secao" :aria-busy="carregando">
        <span id="rr-destino" class="eg__rotulo">{{ t('atendimento.receita.repetir.onde') }}</span>
        <div class="rr__opcoes" role="radiogroup" aria-labelledby="rr-destino">
          <label v-for="item in rascunhos" :key="item.id" class="rr__opcao" :for="`rr-${item.id}`">
            <RadioButton v-model="destino" :input-id="`rr-${item.id}`" :value="item.id" />
            <span>
              {{
                t('atendimento.receita.repetir.rascunho', {
                  dia: rotulos.dia(item.dataDoAtendimento),
                  hora: item.abertoEm.slice(11, 16),
                })
              }}
            </span>
          </label>
          <label class="rr__opcao" for="rr-novo">
            <RadioButton v-model="destino" input-id="rr-novo" :value="NOVO" />
            <span>{{ t('atendimento.receita.repetir.novo') }}</span>
          </label>
        </div>
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
        form="repetir-receita"
        icon="ph ph-arrows-clockwise"
        :label="t('atendimento.receita.repetir.confirmar')"
        :loading="salvando"
        :disabled="carregando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.rr__opcoes {
  display: grid;
  gap: 10px;
}

.rr__opcao {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}
</style>
