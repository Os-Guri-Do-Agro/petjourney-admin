<script setup lang="ts">
/**
 * A fila da recepção (E5-03, guia e5 19.1 a 19.3 e 21.2): os internados com boletim a ligar ou a
 * enviar, em ordem de entrada, sem texto clínico (nem gravidade, motivo ou o texto do boletim). A
 * tela diz o animal, o leito, para quem ligar e o botão certo:
 *
 * - "Ligar": registrar a ligação (no boletim retido, ou na internação quando o paciente não tem
 *   app e não ganha boletim). A clínica liga pelo telefone do cadastro; aqui só se registra.
 * - "Enviar": o boletim liberado (ou o rascunho parado) vai ao app.
 * - Sem app: "avise por telefone"; a ligação fecha a pendência.
 *
 * `boletim.enviar`: DONO, veterinário, enfermagem e recepção.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { novaChaveDeIdempotencia } from '@/service/idempotencia'
import {
  enviarBoletim,
  listarBoletinsPendentes,
  type BoletimPendente,
  type BoletinsPendentes,
} from '@/service/parceiro/boletins-da-internacao-service'
import { listarProfissionais, type Profissional } from '@/service/parceiro/profissionais-service'

import LigacaoGaveta, { type AlvoDaLigacao } from './LigacaoGaveta.vue'

const { t, locale } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()

const fila = ref<BoletinsPendentes | null>(null)
const profissionais = ref<Profissional[]>([])
const carregando = ref(false)
const erro = ref('')
const recado = ref('')

async function carregar() {
  carregando.value = true
  try {
    fila.value = await listarBoletinsPendentes(parceiroQuery())
    erro.value = ''
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.boletim.erroFila')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(async () => {
  void carregar()
  profissionais.value = await listarProfissionais({ ...parceiroQuery(), ativo: true }).catch(
    () => [],
  )
})

const pode = computed(
  () => Boolean(store.modulo('CLINICA')?.podeEscrever) && store.temPermissao('boletim.enviar'),
)

function quando(valor: string | null) {
  if (!valor) return ''
  return new Date(valor).toLocaleString(locale.value, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function telefones(item: BoletimPendente) {
  return [item.cliente?.telefone, item.cliente?.telefoneSecundario].filter(
    (valor): valor is string => Boolean(valor),
  )
}

function meta(item: BoletimPendente) {
  return [
    item.leito.nome,
    item.cliente?.nome ?? t('internacao.boletim.anonimizado'),
    telefones(item).join(' · '),
    item.desde ? t('internacao.boletim.desde', { quando: quando(item.desde) }) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const resumo = computed(() => {
  const n = fila.value?.itens.length ?? 0
  /* Vazia, a frase mora na lista: o resumo não repete. */
  return n ? t('internacao.boletim.filaResumo', { n }, n) : ''
})

/* ----------------------------------------------------------------------------- as ações */

const ligacaoAberta = ref(false)
const alvo = ref<AlvoDaLigacao | null>(null)
const ocupado = ref<string | null>(null)

function ligar(item: BoletimPendente) {
  alvo.value = {
    boletimId: item.boletim?.id ?? null,
    internacaoId: item.internacaoId,
    paciente: item.paciente.nome,
    desde: item.desde,
    telefones: telefones(item),
  }
  ligacaoAberta.value = true
}

async function enviar(item: BoletimPendente) {
  if (!item.boletim) return
  ocupado.value = item.internacaoId
  recado.value = ''
  try {
    const envio = await enviarBoletim(item.boletim.id, novaChaveDeIdempotencia(), parceiroQuery())
    recado.value = envio.entregue
      ? t('internacao.boletim.enviadoDe', { pet: item.paciente.nome })
      : t(`internacao.boletim.semEntrega.${envio.motivo ?? 'SEM_CANAL_NO_APP'}`)
    invalidarPendenciasDoPortal()
  } catch (err) {
    recado.value = lerErroDoCadastro(err, t('internacao.boletim.erroEnviar')).mensagem
  } finally {
    ocupado.value = null
    void carregar()
  }
}

function registrada() {
  invalidarPendenciasDoPortal()
  void carregar()
}
</script>

<template>
  <UiPagina
    :titulo="t('internacao.boletim.fila')"
    :resumo="resumo"
    icone="ph ph-phone"
    :carregando="carregando && !fila"
    :erro="fila ? '' : erro"
    @tentar-de-novo="carregar"
  >
    <div v-if="fila" class="bp">
      <p v-if="recado" class="bp__recado" role="status">{{ recado }}</p>
      <section class="ui-folha ui-lista" :aria-busy="carregando">
        <ul v-if="fila.itens.length" class="ui-lista">
          <li v-for="item in fila.itens" :key="item.internacaoId" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo bp__nome">
                {{ item.paciente.nome }}
                <span
                  class="ui-selo"
                  :class="item.pendencia === 'LIGAR' ? 'ui-selo--risco' : 'ui-selo--atencao'"
                  >{{ t(`internacao.boletim.pendencia.${item.pendencia}`) }}</span
                >
                <span v-if="item.semCanalNoApp" class="ui-selo ui-selo--contorno">{{
                  t('internacao.boletim.semAppCurto')
                }}</span>
              </strong>
              <span class="ui-linha__meta">{{ meta(item) }}</span>
            </span>
            <span v-if="pode" class="ui-linha__fim">
              <Button
                v-if="item.pendencia === 'LIGAR'"
                type="button"
                size="small"
                icon="ph ph-phone"
                :label="t('internacao.boletim.registrarLigacao')"
                @click="ligar(item)"
              />
              <Button
                v-else-if="item.boletim"
                type="button"
                size="small"
                icon="ph ph-paper-plane-tilt"
                :label="t('internacao.boletim.enviar')"
                :loading="ocupado === item.internacaoId"
                @click="enviar(item)"
              />
            </span>
          </li>
        </ul>
        <p v-else class="ui-vazio">{{ t('internacao.boletim.filaVazia') }}</p>
      </section>
      <p v-if="fila.truncado" class="bp__recado">{{ t('internacao.boletim.filaTruncada') }}</p>
    </div>

    <template #sempre>
      <LigacaoGaveta
        v-model:visible="ligacaoAberta"
        :alvo="alvo"
        :profissionais="profissionais"
        @registrada="registrada"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.bp {
  display: grid;
  gap: 16px;
}

.bp__recado {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.bp__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
</style>
