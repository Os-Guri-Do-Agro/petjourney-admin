<script setup lang="ts">
/**
 * Exclusão a pedido do titular (LGPD, E2-01 seção 1.11; só DONO ou GESTOR). Não tem volta, então
 * são dois passos: o motivo (10 a 500 caracteres, sem dado pessoal) e a confirmação com o que
 * acontece. Depois, o resultado com o protocolo LGP para copiar e entregar ao titular.
 *
 * - `EXCLUIDO`: sem registro clínico, o cliente e os pacientes saíram de vez.
 * - `ANONIMIZADO`: contato e documento saíram na hora; o prontuário fica bloqueado até
 *   `bloqueadoAte` (5 anos depois do último atendimento, Res. CFMV 1.321/2020), sem acesso da
 *   equipe, e depois é anonimizado. Ninguém desbloqueia, nem o dono (parecer LGPD de 30/10).
 *
 * Com o hotel, a resposta conta as reservas canceladas, as que tinham pagamento (o dono acerta a
 * devolução no balcão) e as ajustadas (seção 45 do guia E7).
 */
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  anonimizarCliente,
  MOTIVO_DA_EXCLUSAO_MAX,
  MOTIVO_DA_EXCLUSAO_MIN,
  type Anonimizacao,
  type Cliente,
} from '@/service/parceiro/pacientes-service'

const props = defineProps<{ cliente: Cliente | null }>()
const emit = defineEmits<{ excluido: [resultado: Anonimizacao] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

const passo = ref<'motivo' | 'confirmar' | 'pronto'>('motivo')
const motivo = ref('')
const tentou = ref(false)
const erro = ref('')
const excluindo = ref(false)
const resultado = ref<Anonimizacao | null>(null)

watch(visible, (aberta) => {
  if (!aberta) return

  passo.value = 'motivo'
  motivo.value = ''
  tentou.value = false
  erro.value = ''
  resultado.value = null
})

const motivoOk = computed(() => {
  const tamanho = motivo.value.trim().length
  return tamanho >= MOTIVO_DA_EXCLUSAO_MIN && tamanho <= MOTIVO_DA_EXCLUSAO_MAX
})

function continuar() {
  tentou.value = true
  if (motivoOk.value) passo.value = 'confirmar'
}

async function excluir() {
  if (!props.cliente) return

  excluindo.value = true
  erro.value = ''

  try {
    resultado.value = await anonimizarCliente(props.cliente.id, motivo.value, parceiroQuery())
    passo.value = 'pronto'
    emit('excluido', resultado.value)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    excluindo.value = false
  }
}

async function copiarProtocolo() {
  if (!resultado.value) return

  try {
    await navigator.clipboard.writeText(resultado.value.protocolo)
    toast.add({ severity: 'success', summary: t('cadastro.exclusao.copiado'), life: 2500 })
  } catch {
    /* Sem área de transferência: o protocolo continua à vista para copiar à mão. */
  }
}

const reservas = computed(() => {
  const atual = resultado.value
  if (!atual) return []

  return [
    atual.reservasCanceladas.length
      ? t(
          'cadastro.exclusao.reservasCanceladas',
          { n: atual.reservasCanceladas.length },
          atual.reservasCanceladas.length,
        )
      : '',
    atual.comPagamento.length
      ? t(
          'cadastro.exclusao.comPagamento',
          { n: atual.comPagamento.length },
          atual.comPagamento.length,
        )
      : '',
    atual.reservasAjustadas.length
      ? t(
          'cadastro.exclusao.reservasAjustadas',
          { n: atual.reservasAjustadas.length },
          atual.reservasAjustadas.length,
        )
      : '',
    atual.internacoesEncerradas.length
      ? t(
          'cadastro.exclusao.internacoes',
          { n: atual.internacoesEncerradas.length },
          atual.internacoesEncerradas.length,
        )
      : '',
    atual.hospedagensEncerradas.length
      ? t(
          'cadastro.exclusao.hospedagens',
          { n: atual.hospedagensEncerradas.length },
          atual.hospedagensEncerradas.length,
        )
      : '',
  ].filter(Boolean)
})
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="t('cadastro.exclusao.titulo')"
    icone="ph ph-user-minus"
  >
    <!-- 1. O motivo. -->
    <template v-if="passo === 'motivo'">
      <p class="eg__dica">
        {{ t('cadastro.exclusao.lede', { nome: cliente?.nome ?? '' }) }}
      </p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="exclusao-motivo">{{ t('cadastro.exclusao.motivo') }}</label>
        <Textarea
          id="exclusao-motivo"
          v-model="motivo"
          rows="3"
          auto-resize
          :maxlength="MOTIVO_DA_EXCLUSAO_MAX"
          :placeholder="t('cadastro.exclusao.motivoExemplo')"
          :invalid="tentou && !motivoOk"
        />
        <small v-if="tentou && !motivoOk" class="eg__invalido">
          {{
            t('cadastro.exclusao.motivoTamanho', {
              min: MOTIVO_DA_EXCLUSAO_MIN,
              max: MOTIVO_DA_EXCLUSAO_MAX,
            })
          }}
        </small>
        <small v-else class="eg__dica">{{ t('cadastro.exclusao.motivoDica') }}</small>
      </section>
    </template>

    <!-- 2. A confirmação: o que acontece agora, sem volta. -->
    <template v-else-if="passo === 'confirmar'">
      <p class="eg__aviso ex__aviso" role="alert">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>{{ t('cadastro.exclusao.confirmacao') }}</span>
      </p>
      <ul class="ex__efeitos">
        <li>{{ t('cadastro.exclusao.efeitoContato') }}</li>
        <li>{{ t('cadastro.exclusao.efeitoProntuario') }}</li>
        <li>{{ t('cadastro.exclusao.efeitoAgenda') }}</li>
        <li>{{ t('cadastro.exclusao.efeitoSemVolta') }}</li>
      </ul>
      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
      </p>
    </template>

    <!-- 3. Pronto: o protocolo para o titular. -->
    <template v-else-if="resultado">
      <p class="ex__pronto" role="status">
        <i class="ph ph-check-circle" aria-hidden="true" />
        <span>
          {{
            resultado.resultado === 'EXCLUIDO'
              ? t('cadastro.exclusao.excluido')
              : resultado.bloqueadoAte
                ? t('cadastro.exclusao.anonimizadoAte', {
                    data: rotulos.data(resultado.bloqueadoAte),
                  })
                : t('cadastro.exclusao.anonimizado')
          }}
        </span>
      </p>

      <section class="eg__secao">
        <span class="eg__rotulo">{{ t('cadastro.exclusao.protocolo') }}</span>
        <div class="ex__protocolo">
          <bdi dir="ltr" class="ui-num">{{ resultado.protocolo }}</bdi>
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-copy"
            :label="t('cadastro.exclusao.copiar')"
            @click="copiarProtocolo"
          />
        </div>
        <small class="eg__dica">{{ t('cadastro.exclusao.protocoloDica') }}</small>
      </section>

      <ul v-if="reservas.length" class="ex__efeitos">
        <li v-for="linha in reservas" :key="linha">{{ linha }}</li>
      </ul>
    </template>

    <template #pe>
      <template v-if="passo === 'motivo'">
        <Button
          type="button"
          :label="t('cadastro.cancelar')"
          severity="secondary"
          outlined
          @click="visible = false"
        />
        <Button type="button" :label="t('cadastro.exclusao.continuar')" @click="continuar" />
      </template>
      <template v-else-if="passo === 'confirmar'">
        <Button
          type="button"
          :label="t('cadastro.voltar')"
          severity="secondary"
          outlined
          :disabled="excluindo"
          @click="passo = 'motivo'"
        />
        <Button
          type="button"
          severity="danger"
          icon="ph ph-user-minus"
          :label="t('cadastro.exclusao.excluir')"
          :loading="excluindo"
          @click="excluir"
        />
      </template>
      <Button v-else type="button" :label="t('cadastro.fechar')" @click="visible = false" />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ex__aviso {
  font-weight: 600;
}

.ex__efeitos {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-inline-start: 20px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.ex__pronto {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.ex__pronto i {
  margin-top: 2px;
  color: var(--ok-tinta);
  font-size: 18px;
}

.ex__protocolo {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
}
</style>
