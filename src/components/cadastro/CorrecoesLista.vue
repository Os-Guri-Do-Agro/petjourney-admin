<script setup lang="ts">
/**
 * Pedidos de correção (E2-02, PJ-HD8PAB, seção 2.2): o que o responsável pediu, pelo app, para a
 * clínica corrigir no cadastro dele. A recepção abre o cadastro, corrige e marca como resolvido.
 * "Resolvidos" é o histórico.
 *
 * O pedido traz o cliente, não o paciente: "Abrir cadastro" procura um paciente desse cliente pela
 * busca (a API não tem lista de pacientes por cliente) e abre a ficha dele, onde o responsável se
 * edita.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { listarPacientes } from '@/service/parceiro/pacientes-service'
import {
  listarCorrecoes,
  resolverCorrecao,
  type PedidoDeCorrecao,
} from '@/service/parceiro/vinculo-service'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const { store, parceiroQuery } = useParceiroPortal()
const rotulos = useRotulosDoCadastro()

const situacao = ref<'abertos' | 'resolvidos'>('abertos')
const pedidos = ref<PedidoDeCorrecao[]>([])
const carregando = ref(true)
const jaCarregou = ref(false)
const erro = ref('')

const podeResolver = computed(
  () =>
    store.temPermissao('paciente.escrever') &&
    Boolean(store.modulo('CLINICA')?.podeEscrever || store.modulo('HOTEL')?.podeEscrever),
)

const opcoes = computed(() => [
  { valor: 'abertos', rotulo: t('cadastro.correcoes.abertos') },
  { valor: 'resolvidos', rotulo: t('cadastro.correcoes.resolvidos') },
])

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    pedidos.value = await listarCorrecoes(situacao.value === 'resolvidos', parceiroQuery())
    jaCarregou.value = true
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

watch(situacao, () => void carregar(), { immediate: true })

const resumo = computed(() =>
  jaCarregou.value && situacao.value === 'abertos'
    ? t('cadastro.correcoes.contagem', { n: pedidos.value.length }, pedidos.value.length)
    : '',
)

const abrindo = ref<string | null>(null)

async function abrirCadastro(pedido: PedidoDeCorrecao) {
  abrindo.value = pedido.id

  try {
    const pagina = await listarPacientes({ q: pedido.clienteNome, limit: 50 }, parceiroQuery())
    const paciente = pagina.itens.find((item) => item.cliente.id === pedido.clienteId)

    if (paciente) {
      void router.push(`/clinica/ficha/${paciente.id}`)
    } else {
      toast.add({ severity: 'warn', summary: t('cadastro.correcoes.semPaciente'), life: 5000 })
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.carregar')).mensagem,
      life: 6000,
    })
  } finally {
    abrindo.value = null
  }
}

const resolvendo = ref<string | null>(null)

async function resolver(pedido: PedidoDeCorrecao) {
  resolvendo.value = pedido.id

  try {
    await resolverCorrecao(pedido.id, parceiroQuery())
    pedidos.value = pedidos.value.filter((item) => item.id !== pedido.id)
    toast.add({ severity: 'success', summary: t('cadastro.correcoes.resolvido'), life: 3000 })
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
</script>

<template>
  <UiPagina
    class="tela-correcoes"
    :carregando="carregando && !jaCarregou"
    :erro="erro && !jaCarregou ? erro : ''"
    @tentar-de-novo="carregar"
  >
    <template v-if="resumo" #resumo>
      <span aria-live="polite">{{ resumo }}</span>
    </template>

    <section class="cr ui-folha" :aria-label="t('cadastro.correcoes.titulo')">
      <div class="cr__barra">
        <p class="cr__lede">{{ t('cadastro.correcoes.lede') }}</p>
        <SelectButton
          v-model="situacao"
          :options="opcoes"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          :aria-label="t('cadastro.correcoes.titulo')"
        />
      </div>

      <ul v-if="carregando && !pedidos.length" class="ui-lista" aria-busy="true">
        <li v-for="n in 3" :key="n" class="ui-linha">
          <span class="ui-linha__texto">
            <Skeleton width="12rem" height="0.95rem" />
            <Skeleton width="20rem" height="0.8rem" />
          </span>
        </li>
      </ul>

      <div v-else-if="!pedidos.length" class="ui-vazio cr__vazio">
        <i class="ph ph-check-circle" aria-hidden="true" />
        <strong>
          {{
            situacao === 'abertos'
              ? t('cadastro.correcoes.vazio')
              : t('cadastro.correcoes.vazioResolvidos')
          }}
        </strong>
      </div>

      <ul v-else class="ui-lista">
        <li v-for="pedido in pedidos" :key="pedido.id" class="ui-linha">
          <span
            class="ui-ladrilho ui-ladrilho--p"
            :class="{ 'ui-ladrilho--atencao': !pedido.resolvidoEm }"
            aria-hidden="true"
          >
            <i :class="pedido.resolvidoEm ? 'ph ph-check' : 'ph ph-pencil-line'" />
          </span>
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">{{ pedido.clienteNome }}</strong>
            <span class="cr__mensagem">{{ pedido.mensagem }}</span>
            <span class="ui-linha__meta">
              {{
                pedido.resolvidoEm
                  ? t('cadastro.correcoes.resolvidoEm', { data: rotulos.data(pedido.resolvidoEm) })
                  : t('cadastro.correcoes.pedidoEm', { data: rotulos.data(pedido.criadoEm) })
              }}
            </span>
          </span>
          <span class="ui-linha__fim cr__acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-user"
              :label="t('cadastro.correcoes.abrir')"
              :loading="abrindo === pedido.id"
              @click="abrirCadastro(pedido)"
            />
            <Button
              v-if="!pedido.resolvidoEm && podeResolver"
              type="button"
              size="small"
              icon="ph ph-check"
              :label="t('cadastro.correcoes.resolver')"
              :loading="resolvendo === pedido.id"
              @click="resolver(pedido)"
            />
          </span>
        </li>
      </ul>
    </section>
  </UiPagina>
</template>

<style scoped>
.cr {
  display: grid;
  gap: 4px;
  padding: 12px;
}

.cr__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 4px 12px;
}

.cr__lede {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.cr__mensagem {
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.cr__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.cr__vazio {
  justify-items: center;
  padding: 40px 16px;
  text-align: center;
}

.cr__vazio > i {
  color: var(--tinta-3);
  font-size: 26px;
}
</style>
