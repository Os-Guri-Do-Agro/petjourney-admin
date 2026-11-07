<script setup lang="ts">
/**
 * Quem pode buscar o animal (E7-02b, guia e7 31): até 5 pessoas, copiadas para a reserva. A lista
 * vai inteira no `PATCH` (sem ninguém, tira todos) e não muda o preço. Quem veio do cadastro do
 * cliente segue pelo `pessoaAutorizadaId`; quem foi escrito à mão leva nome, telefone, documento e
 * relação. O documento volta só com o final (os 4 últimos caracteres): a tela mostra "final 8901".
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  AUTORIZADOS_MAX,
  editarReserva,
  type AutorizadoNovo,
  type ReservaDetalhe,
} from '@/service/parceiro/hotel-reservas-service'

const props = defineProps<{ reserva: ReservaDetalhe }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

type Linha = {
  pessoaAutorizadaId: string | null
  nome: string
  telefone: string
  documento: string
  relacao: string
}

const linhas = ref<Linha[]>([])
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  linhas.value = (props.reserva.autorizados ?? []).map((a) => ({
    pessoaAutorizadaId: a.pessoaAutorizadaId,
    nome: a.nome,
    telefone: a.telefone ?? '',
    documento: a.documento ?? '',
    relacao: a.relacao ?? '',
  }))
  tentou.value = false
  erro.value = ''
})

function acrescentar() {
  if (linhas.value.length < AUTORIZADOS_MAX)
    linhas.value.push({
      pessoaAutorizadaId: null,
      nome: '',
      telefone: '',
      documento: '',
      relacao: '',
    })
}

function corpo(): AutorizadoNovo[] {
  return linhas.value.map((l) =>
    l.pessoaAutorizadaId
      ? { pessoaAutorizadaId: l.pessoaAutorizadaId }
      : {
          nome: l.nome.trim(),
          ...(l.telefone.trim() ? { telefone: l.telefone.trim() } : {}),
          ...(l.documento.trim() ? { documento: l.documento.trim() } : {}),
          ...(l.relacao.trim() ? { relacao: l.relacao.trim() } : {}),
        },
  )
}

async function salvar() {
  tentou.value = true
  erro.value = ''
  if (linhas.value.some((l) => !l.pessoaAutorizadaId && !l.nome.trim())) return
  salvando.value = true
  try {
    await editarReserva(
      props.reserva.id,
      { versao: props.reserva.versao, autorizados: corpo() },
      parceiroQuery(),
    )
    aberta.value = false
    emit('salvo')
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('reservasDoHotel.autorizados.titulo')"
    icone="ph ph-users"
    largura="36rem"
  >
    <form id="autorizados-da-reserva" class="eg" novalidate @submit.prevent="salvar">
      <p class="eg__dica">{{ t('reservasDoHotel.autorizados.dica', { max: AUTORIZADOS_MAX }) }}</p>
      <section v-for="(l, i) in linhas" :key="i" class="eg__grupo au__pessoa">
        <div class="au__cabeca">
          <h3 class="eg__grupo-titulo">
            {{ t('reservasDoHotel.autorizados.pessoa', { n: i + 1 }) }}
          </h3>
          <Button
            type="button"
            icon="ph ph-x"
            severity="secondary"
            outlined
            rounded
            size="small"
            :aria-label="t('reservasDoHotel.autorizados.tirar', { nome: l.nome || i + 1 })"
            :disabled="salvando"
            @click="linhas.splice(i, 1)"
          />
        </div>
        <p v-if="l.pessoaAutorizadaId" class="au__fixo">
          {{ [l.nome, l.relacao, l.telefone].filter(Boolean).join(' · ') }}
        </p>
        <template v-else>
          <div class="eg__secao">
            <label class="eg__rotulo" :for="`au-nome-${i}`">{{
              t('reservasDoHotel.autorizados.nome')
            }}</label>
            <InputText
              :id="`au-nome-${i}`"
              v-model="l.nome"
              :invalid="tentou && !l.nome.trim()"
              :disabled="salvando"
            />
          </div>
          <div class="eg__linha">
            <div class="eg__secao">
              <label class="eg__rotulo" :for="`au-tel-${i}`">
                {{ t('reservasDoHotel.autorizados.telefone') }}
                <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
              </label>
              <InputText :id="`au-tel-${i}`" v-model="l.telefone" :disabled="salvando" />
            </div>
            <div class="eg__secao">
              <label class="eg__rotulo" :for="`au-rel-${i}`">
                {{ t('reservasDoHotel.autorizados.relacao') }}
                <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
              </label>
              <InputText :id="`au-rel-${i}`" v-model="l.relacao" :disabled="salvando" />
            </div>
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" :for="`au-doc-${i}`">
              {{ t('reservasDoHotel.autorizados.documento') }}
              <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
            </label>
            <InputText :id="`au-doc-${i}`" v-model="l.documento" :disabled="salvando" />
            <small class="eg__dica">{{ t('reservasDoHotel.autorizados.documentoDica') }}</small>
          </div>
        </template>
      </section>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        icon="ph ph-plus"
        :label="t('reservasDoHotel.autorizados.acrescentar')"
        :disabled="salvando || linhas.length >= AUTORIZADOS_MAX"
        class="au__mais"
        @click="acrescentar"
      />
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
        form="autorizados-da-reserva"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.au__pessoa {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--linha);
}

.au__cabeca {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.au__fixo {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.au__mais {
  justify-self: start;
}
</style>
