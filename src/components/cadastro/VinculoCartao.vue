<script setup lang="ts">
/**
 * O app na ficha do cadastro (E2-02, PJ-HD8PAB, seções 2.1 e 2.2).
 *
 * - Ligado: o selo "no app", desde quando e o que o responsável liberou (diário completo, peso de
 *   casa, notas); o que não foi liberado aparece como "não liberado", sem botão. Encerrar pede um
 *   motivo.
 * - Não ligado: "Ligar ao app", com os três caminhos (`LigarAoAppGaveta`).
 * - As propostas do responsável, com o estado de cada uma; a pendente se cancela. "Não respondida"
 *   inclui a que nunca chegou a ninguém: a clínica não sabe de bloqueio.
 * - Os pedidos de correção que o responsável mandou pelo app, para marcar como resolvidos depois
 *   de corrigir o cadastro.
 */
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import LigarAoAppGaveta from '@/components/cadastro/LigarAoAppGaveta.vue'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { Paciente } from '@/service/parceiro/pacientes-service'
import {
  cancelarProposta,
  encerrarVinculo,
  listarCorrecoes,
  listarPropostas,
  MOTIVO_DO_ENCERRAMENTO_MAX,
  MOTIVO_DO_ENCERRAMENTO_MIN,
  obterVinculo,
  resolverCorrecao,
  type PedidoDeCorrecao,
  type Proposta,
  type Vinculo,
} from '@/service/parceiro/vinculo-service'

const props = defineProps<{ paciente: Paciente; podeEscrever: boolean }>()

const { t } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

const vinculo = ref<Vinculo | null>(null)
const propostas = ref<Proposta[]>([])
const correcoes = ref<PedidoDeCorrecao[]>([])
const carregando = ref(true)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    const [atual, lista, abertas] = await Promise.all([
      obterVinculo(props.paciente.id, parceiroQuery()),
      listarPropostas(props.paciente.cliente.id, parceiroQuery()),
      listarCorrecoes(false, parceiroQuery()).catch(() => [] as PedidoDeCorrecao[]),
    ])

    vinculo.value = atual
    propostas.value = lista.filter((proposta) =>
      proposta.pets.some((pet) => pet.pacienteId === props.paciente.id),
    )
    correcoes.value = abertas.filter((pedido) => pedido.clienteId === props.paciente.cliente.id)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

watch(
  () => props.paciente.id,
  () => void carregar(),
  { immediate: true },
)

/* ----------------------------------------------------------------------------- ligar */

const ligando = ref(false)

/* ---------------------------------------------------------------------------- propostas */

const TOM: Record<Proposta['status'], string> = {
  PENDENTE: 'ui-selo--atencao',
  RESPONDIDA: 'ui-selo--ok',
  RECUSADA: '',
  EXPIRADA: '',
  CANCELADA: '',
}

const verTodas = ref(false)

const visiveis = computed(() => (verTodas.value ? propostas.value : propostas.value.slice(0, 3)))

function detalhe(proposta: Proposta) {
  const quando =
    proposta.status === 'PENDENTE'
      ? t('cadastro.vinculo.proposta.ate', { data: rotulos.data(proposta.expiraEm) })
      : proposta.respondidaEm
        ? t('cadastro.vinculo.proposta.respondidaEm', { data: rotulos.data(proposta.respondidaEm) })
        : t('cadastro.vinculo.proposta.criadaEm', { data: rotulos.data(proposta.criadaEm) })

  const motivo =
    proposta.status === 'RECUSADA' && proposta.motivoRecusa
      ? t(`cadastro.vinculo.recusa.${proposta.motivoRecusa}`)
      : ''

  return [t(`cadastro.vinculo.canal.${proposta.canal}`), quando, motivo].filter(Boolean).join(' · ')
}

const cancelando = ref<string | null>(null)

async function cancelar(proposta: Proposta) {
  cancelando.value = proposta.id

  try {
    await cancelarProposta(proposta.id, parceiroQuery())
    await carregar()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    cancelando.value = null
  }
}

/* ---------------------------------------------------------------------------- encerrar */

const encerrando = ref(false)
const motivo = ref('')
const tentou = ref(false)
const salvando = ref(false)
const erroDoEncerramento = ref('')

const motivoOk = computed(() => {
  const tamanho = motivo.value.trim().length
  return tamanho >= MOTIVO_DO_ENCERRAMENTO_MIN && tamanho <= MOTIVO_DO_ENCERRAMENTO_MAX
})

watch(encerrando, (aberta) => {
  if (!aberta) return
  motivo.value = ''
  tentou.value = false
  erroDoEncerramento.value = ''
})

async function encerrar() {
  tentou.value = true
  if (!motivoOk.value) return

  salvando.value = true
  erroDoEncerramento.value = ''

  try {
    await encerrarVinculo(props.paciente.id, motivo.value, parceiroQuery())
    encerrando.value = false
    toast.add({ severity: 'success', summary: t('cadastro.vinculo.encerrado'), life: 3500 })
    await carregar()
  } catch (err) {
    erroDoEncerramento.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    salvando.value = false
  }
}

/* --------------------------------------------------------------------------- correções */

const resolvendo = ref<string | null>(null)

async function resolver(pedido: PedidoDeCorrecao) {
  resolvendo.value = pedido.id

  try {
    await resolverCorrecao(pedido.id, parceiroQuery())
    correcoes.value = correcoes.value.filter((item) => item.id !== pedido.id)
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    resolvendo.value = null
  }
}

const liberado = computed(() =>
  vinculo.value
    ? (['diarioCompleto', 'peso', 'notas'] as const).map((chave) => ({
        chave,
        rotulo: t(`cadastro.vinculo.consentimento.${chave}`),
        sim: vinculo.value!.consentimento[chave],
      }))
    : [],
)
</script>

<template>
  <section class="ui-folha ui-cartao vc" aria-labelledby="vc-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" :class="{ 'ui-ladrilho--ok': vinculo }" aria-hidden="true">
        <i class="ph ph-device-mobile" />
      </span>
      <span class="ui-cartao__titulos">
        <h2 id="vc-titulo" class="ui-cartao__titulo">
          {{ t('cadastro.vinculo.titulo') }}
          <span v-if="vinculo" class="ui-selo ui-selo--ok">
            <i class="ph ph-check" aria-hidden="true" />
            {{ t('cadastro.vinculo.noApp') }}
          </span>
        </h2>
        <p class="ui-cartao__descricao">
          {{
            vinculo
              ? t('cadastro.vinculo.desde', {
                  data: rotulos.data(vinculo.ativadoEm),
                  origem: t(`cadastro.vinculo.canal.${vinculo.origem}`),
                })
              : t('cadastro.vinculo.naoLigado')
          }}
        </p>
      </span>
      <Button
        v-if="!vinculo && podeEscrever && paciente.ativo && !carregando"
        type="button"
        size="small"
        icon="ph ph-device-mobile"
        :label="t('cadastro.vinculo.ligar')"
        @click="ligando = true"
      />
      <Button
        v-else-if="vinculo && podeEscrever"
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.vinculo.encerrar')"
        @click="encerrando = true"
      />
    </header>

    <p v-if="erro" class="eg__erro vc__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <ul v-if="vinculo" class="vc__consentimento" :aria-label="t('cadastro.vinculo.liberou')">
      <li v-for="item in liberado" :key="item.chave" :class="{ vc__nao: !item.sim }">
        <i :class="item.sim ? 'ph ph-check-circle' : 'ph ph-minus-circle'" aria-hidden="true" />
        <span>{{ item.rotulo }}</span>
        <small>{{
          item.sim ? t('cadastro.vinculo.liberado') : t('cadastro.vinculo.naoLiberado')
        }}</small>
      </li>
    </ul>

    <template v-if="propostas.length">
      <h3 class="eg__grupo-titulo vc__subtitulo">{{ t('cadastro.vinculo.propostas') }}</h3>
      <ul class="ui-lista">
        <li v-for="proposta in visiveis" :key="proposta.id" class="ui-linha">
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">
              <span class="ui-selo" :class="TOM[proposta.status]">
                {{ t(`cadastro.vinculo.status.${proposta.status}`) }}
              </span>
            </strong>
            <span class="ui-linha__meta">{{ detalhe(proposta) }}</span>
          </span>
          <span v-if="proposta.status === 'PENDENTE' && podeEscrever" class="ui-linha__fim">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('cadastro.vinculo.cancelarProposta')"
              :loading="cancelando === proposta.id"
              @click="cancelar(proposta)"
            />
          </span>
        </li>
      </ul>
      <Button
        v-if="propostas.length > 3"
        type="button"
        size="small"
        severity="secondary"
        text
        class="vc__mais"
        :label="
          verTodas
            ? t('cadastro.vinculo.verMenos')
            : t('cadastro.vinculo.verTodas', { n: propostas.length })
        "
        @click="verTodas = !verTodas"
      />
    </template>

    <template v-if="correcoes.length">
      <h3 class="eg__grupo-titulo vc__subtitulo">{{ t('cadastro.correcoes.titulo') }}</h3>
      <ul class="ui-lista">
        <li v-for="pedido in correcoes" :key="pedido.id" class="ui-linha">
          <span class="ui-ladrilho ui-ladrilho--p ui-ladrilho--atencao" aria-hidden="true">
            <i class="ph ph-pencil-line" />
          </span>
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">{{ pedido.mensagem }}</strong>
            <span class="ui-linha__meta">{{
              t('cadastro.correcoes.pedidoEm', { data: rotulos.data(pedido.criadoEm) })
            }}</span>
          </span>
          <span v-if="podeEscrever" class="ui-linha__fim">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-check"
              :label="t('cadastro.correcoes.resolver')"
              :loading="resolvendo === pedido.id"
              @click="resolver(pedido)"
            />
          </span>
        </li>
      </ul>
    </template>

    <LigarAoAppGaveta v-model:visible="ligando" :paciente="paciente" @proposto="carregar" />

    <CadastroGaveta
      v-model:visible="encerrando"
      :titulo="t('cadastro.vinculo.encerrarTitulo', { nome: paciente.nome })"
      icone="ph ph-link-break"
    >
      <p class="eg__dica">{{ t('cadastro.vinculo.encerrarLede') }}</p>
      <section class="eg__secao">
        <label class="eg__rotulo" for="vinculo-motivo">{{ t('cadastro.vinculo.motivo') }}</label>
        <Textarea
          id="vinculo-motivo"
          v-model="motivo"
          rows="3"
          auto-resize
          :maxlength="MOTIVO_DO_ENCERRAMENTO_MAX"
          :invalid="tentou && !motivoOk"
          :disabled="salvando"
        />
        <small v-if="tentou && !motivoOk" class="eg__invalido">
          {{
            t('cadastro.vinculo.motivoTamanho', {
              min: MOTIVO_DO_ENCERRAMENTO_MIN,
              max: MOTIVO_DO_ENCERRAMENTO_MAX,
            })
          }}
        </small>
      </section>
      <p v-if="erroDoEncerramento" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroDoEncerramento }}</span>
      </p>
      <template #pe>
        <Button
          type="button"
          :label="t('cadastro.cancelar')"
          severity="secondary"
          outlined
          :disabled="salvando"
          @click="encerrando = false"
        />
        <Button
          type="button"
          severity="danger"
          icon="ph ph-link-break"
          :label="t('cadastro.vinculo.encerrar')"
          :loading="salvando"
          @click="encerrar"
        />
      </template>
    </CadastroGaveta>
  </section>
</template>

<style scoped>
.vc {
  display: grid;
  gap: 14px;
}

.vc .ui-cartao__titulo {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.vc__consentimento {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.vc__consentimento li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 14px;
}

.vc__consentimento i {
  color: var(--ok-tinta);
  font-size: 17px;
}

.vc__consentimento small {
  margin-inline-start: auto;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.vc__nao,
.vc__nao i {
  color: var(--tinta-2) !important;
}

.vc__subtitulo {
  margin: 4px 0 0;
}

.vc__mais {
  justify-self: start;
}

.vc__erro {
  margin: 0;
}
</style>
