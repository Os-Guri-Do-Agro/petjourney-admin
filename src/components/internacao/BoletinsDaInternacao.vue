<script setup lang="ts">
/**
 * A conversa do boletim ao responsável (E5-03, guia e5 17.1, 18 e 21): todos os boletins, do mais
 * recente, com o botão de cada estado.
 *
 * - Rascunho e liberado: "Enviar". Retido: "Registrar ligação" (a clínica liga pelo telefone do
 *   cadastro; a tela só registra). O retido do sistema (a piora) não se descarta.
 * - Enviado: a entrega (quantas pessoas, só no inbox depois do teto do dia). Cancelado: em cinza,
 *   com o motivo.
 * - Sem app: nada sai; a recepção avisa por telefone.
 * - A preferência do responsável e o próximo automático ficam no alto, com "Ajustar".
 *
 * Escrever, descartar, a foto e a preferência: `boletim.compor`. Ligar e enviar: `boletim.enviar`.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { novaChaveDeIdempotencia } from '@/service/idempotencia'
import {
  boletimAberto,
  descartarBoletim,
  enviarBoletim,
  lerConversaDoBoletim,
  lerPreferenciaDoBoletim,
  listarBoletinsPendentes,
  type Boletim,
  type ConversaDoBoletim,
  type PreferenciaDoBoletim,
} from '@/service/parceiro/boletins-da-internacao-service'
import type { Profissional } from '@/service/parceiro/profissionais-service'

import BoletimGaveta from './BoletimGaveta.vue'
import FotoDoBoletimGaveta from './FotoDoBoletimGaveta.vue'
import LigacaoGaveta, { type AlvoDaLigacao } from './LigacaoGaveta.vue'
import PreferenciaDoBoletimGaveta from './PreferenciaDoBoletimGaveta.vue'

const props = defineProps<{
  internacaoId: string
  paciente: string
  encerrada: boolean
  profissionais: Profissional[]
}>()

const { t, locale } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()

const clinicaEscreve = computed(() => Boolean(store.modulo('CLINICA')?.podeEscrever))
const compoe = computed(
  () => clinicaEscreve.value && !props.encerrada && store.temPermissao('boletim.compor'),
)
const envia = computed(
  () => clinicaEscreve.value && !props.encerrada && store.temPermissao('boletim.enviar'),
)

const conversa = ref<ConversaDoBoletim | null>(null)
const preferencia = ref<PreferenciaDoBoletim | null>(null)
const telefones = ref<string[]>([])
const carregando = ref(false)
const erro = ref('')
const recado = ref('')

async function carregar(mais = false) {
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await lerConversaDoBoletim(
      props.internacaoId,
      mais ? conversa.value?.proximoCursor : null,
      parceiroQuery(),
    )
    conversa.value =
      mais && conversa.value
        ? { ...pagina, itens: [...conversa.value.itens, ...pagina.itens] }
        : pagina
    if (store.temPermissao('boletim.compor'))
      preferencia.value = await lerPreferenciaDoBoletim(props.internacaoId, parceiroQuery()).catch(
        () => preferencia.value,
      )
    void lerTelefones()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.boletim.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

/** O telefone de quem ligar vem da fila da recepção (o detalhe não traz o cliente). */
async function lerTelefones() {
  if (!store.temPermissao('boletim.enviar')) return
  if (!conversa.value?.itens.some((item) => item.status === 'RETIDO')) return
  try {
    const fila = await listarBoletinsPendentes(parceiroQuery())
    const cliente = fila.itens.find((item) => item.internacaoId === props.internacaoId)?.cliente
    telefones.value = [cliente?.telefone, cliente?.telefoneSecundario].filter(
      (valor): valor is string => Boolean(valor),
    )
  } catch {
    telefones.value = []
  }
}

onMounted(() => void carregar())
watch(
  () => props.internacaoId,
  () => void carregar(),
)

defineExpose({ carregar })

function quando(valor: string | null) {
  if (!valor) return ''
  return new Date(valor).toLocaleString(locale.value, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TOM: Record<string, string> = {
  RASCUNHO: 'atencao',
  RETIDO: 'risco',
  LIBERADO: 'atencao',
  ENVIADO: 'ok',
  CANCELADO: '',
}

const aberto = computed(
  () => conversa.value?.itens.find((item) => boletimAberto(item.status)) ?? null,
)

function meta(item: Boletim) {
  const partes = [
    item.tipo === 'ALTA' ? t('internacao.boletim.alta') : '',
    item.origem === 'AUTOMATICO' ? t('internacao.boletim.automatico') : '',
    quando(item.geradoEm),
  ]
  if (item.ligacao)
    partes.push(
      t('internacao.boletim.ligou', {
        nome: item.ligacao.por.nome,
        quando: quando(item.ligacao.em),
      }),
    )
  if (item.status === 'CANCELADO' && item.motivoCancelamento)
    partes.push(t(`internacao.boletim.cancelado.${item.motivoCancelamento}`))
  return partes.filter(Boolean).join(' · ')
}

function entrega(item: Boletim) {
  const comprovante = item.entrega
  if (!comprovante) return ''
  if (comprovante.situacao !== 'ENVIADO')
    return comprovante.motivo
      ? t(`internacao.boletim.semEntrega.${comprovante.motivo}`)
      : t('internacao.boletim.naoSaiu')
  return [
    t(
      'internacao.boletim.entregue',
      { n: comprovante.destinatarios, quando: quando(comprovante.em) },
      comprovante.destinatarios,
    ),
    comprovante.soInbox ? t('internacao.boletim.soInbox') : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * O rascunho parado (guia 21.2): sem edição há mais que a frequência do boletim, ele deixa de calar
 * o automático. A conversa avisa para enviar ou descartar.
 */
function parado(item: Boletim) {
  const horas = preferencia.value?.frequenciaHoras
  if (item.status !== 'RASCUNHO' || !horas) return false
  return Date.now() - new Date(item.atualizadoEm).getTime() > horas * 3600 * 1000
}

const resumoDaPreferencia = computed(() => {
  const pref = preferencia.value
  if (!pref) return ''
  return [
    t('internacao.prescricao.aCada', { n: pref.frequenciaHoras }, pref.frequenciaHoras),
    pref.proximoBoletimEm
      ? t('internacao.boletim.proximo', { quando: quando(pref.proximoBoletimEm) })
      : '',
    pref.silencioNoturno ? t('internacao.boletim.comSilencio') : '',
    pref.definidaPor ? t(`internacao.boletim.definidaPor.${pref.definidaPor}`) : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

/* ----------------------------------------------------------------------------- as ações */

const ocupado = ref<string | null>(null)

async function enviar(item: Boletim) {
  ocupado.value = item.id
  recado.value = ''
  erro.value = ''
  try {
    const envio = await enviarBoletim(item.id, novaChaveDeIdempotencia(), parceiroQuery())
    recado.value = envio.entregue
      ? t('internacao.boletim.enviado')
      : t(`internacao.boletim.semEntrega.${envio.motivo ?? 'SEM_CANAL_NO_APP'}`)
    invalidarPendenciasDoPortal()
    void carregar()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.boletim.erroEnviar')).mensagem
    void carregar()
  } finally {
    ocupado.value = null
  }
}

async function descartar(item: Boletim) {
  ocupado.value = item.id
  erro.value = ''
  try {
    await descartarBoletim(item.id, parceiroQuery())
    invalidarPendenciasDoPortal()
    void carregar()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.boletim.erroDescartar')).mensagem
  } finally {
    ocupado.value = null
  }
}

const escreverAberta = ref(false)
const ligacaoAberta = ref(false)
const fotoAberta = ref(false)
const preferenciaAberta = ref(false)
const alvo = ref<AlvoDaLigacao | null>(null)
const paraFoto = ref<Boletim | null>(null)

function ligar(item: Boletim | null) {
  alvo.value = {
    boletimId: item?.id ?? null,
    internacaoId: props.internacaoId,
    paciente: props.paciente,
    desde: item?.retidoDesde ?? null,
    telefones: telefones.value,
  }
  ligacaoAberta.value = true
}

function foto(item: Boletim) {
  paraFoto.value = item
  fotoAberta.value = true
}

function mudou() {
  invalidarPendenciasDoPortal()
  void carregar()
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="bl-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-chat-text" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="bl-titulo" class="ui-cartao__titulo">{{ t('internacao.boletim.titulo') }}</h2>
        <p class="ui-cartao__descricao">
          {{
            conversa?.semCanalNoApp
              ? t('internacao.boletim.semApp')
              : resumoDaPreferencia || t('internacao.boletim.descricao')
          }}
        </p>
      </span>
      <span class="bl__acoes">
        <Button
          v-if="compoe && preferencia && !conversa?.semCanalNoApp"
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-sliders-horizontal"
          :label="t('internacao.boletim.ajustar')"
          @click="preferenciaAberta = true"
        />
        <Button
          v-if="compoe && !aberto && !conversa?.semCanalNoApp"
          type="button"
          size="small"
          icon="ph ph-plus"
          :label="t('internacao.boletim.escrever')"
          @click="escreverAberta = true"
        />
      </span>
    </header>

    <p v-if="recado" class="eg__aviso bl__nota" role="status">
      <i class="ph ph-check-circle" aria-hidden="true" />
      <span>{{ recado }}</span>
    </p>
    <p v-if="erro" class="eg__erro bl__nota" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <ul v-if="conversa?.itens.length" class="ui-lista">
      <li
        v-for="item in conversa.itens"
        :key="item.id"
        class="ui-linha bl__item"
        :class="{ 'bl__item--cancelado': item.status === 'CANCELADO' }"
      >
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo bl__nome">
            <span class="ui-selo" :class="TOM[item.status] ? `ui-selo--${TOM[item.status]}` : ''">{{
              t(`internacao.boletim.status.${item.status}`)
            }}</span>
            <span v-if="item.status === 'RETIDO' && item.motivoDaRetencao" class="bl__motivo">{{
              t(`internacao.boletim.retencao.${item.motivoDaRetencao}`)
            }}</span>
            <span v-if="item.temFoto" class="ui-selo ui-selo--contorno">
              <i class="ph ph-camera" aria-hidden="true" />
              {{ t('internacao.boletim.comFoto') }}
            </span>
          </strong>
          <span class="bl__texto">{{ item.texto }}</span>
          <span class="ui-linha__meta">{{ meta(item) }}</span>
          <span v-if="entrega(item)" class="ui-linha__meta">{{ entrega(item) }}</span>
          <span v-if="parado(item)" class="ui-linha__meta bl__parado">
            <i class="ph ph-pause-circle" aria-hidden="true" />
            {{ t('internacao.boletim.rascunhoParado') }}
          </span>
          <span
            v-if="item.status === 'RETIDO' && telefones.length && envia"
            class="ui-linha__meta bl__telefone"
          >
            <i class="ph ph-phone" aria-hidden="true" />
            {{ t('internacao.boletim.ligarPara', { telefones: telefones.join(' · ') }) }}
          </span>
        </span>
        <span v-if="boletimAberto(item.status)" class="ui-linha__fim bl__acoes">
          <Button
            v-if="compoe && item.tipo !== 'ALTA'"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-camera"
            :aria-label="t('internacao.boletim.foto')"
            :disabled="ocupado === item.id"
            @click="foto(item)"
          />
          <Button
            v-if="compoe && item.autorUsuarioId !== null"
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('internacao.boletim.descartar')"
            :disabled="ocupado === item.id"
            @click="descartar(item)"
          />
          <Button
            v-if="envia && item.status === 'RETIDO'"
            type="button"
            size="small"
            icon="ph ph-phone"
            :label="t('internacao.boletim.registrarLigacao')"
            :disabled="ocupado === item.id"
            @click="ligar(item)"
          />
          <Button
            v-else-if="envia"
            type="button"
            size="small"
            icon="ph ph-paper-plane-tilt"
            :label="t('internacao.boletim.enviar')"
            :loading="ocupado === item.id"
            @click="enviar(item)"
          />
        </span>
      </li>
    </ul>
    <p v-else-if="conversa" class="bl__nota bl__vazio">{{ t('internacao.boletim.vazio') }}</p>

    <Button
      v-if="conversa?.proximoCursor"
      type="button"
      size="small"
      severity="secondary"
      outlined
      class="bl__mais"
      :label="t('internacao.boletim.verMais')"
      :loading="carregando"
      @click="carregar(true)"
    />

    <BoletimGaveta
      v-model:visible="escreverAberta"
      :internacao-id="internacaoId"
      :paciente="paciente"
      @escrito="mudou"
    />
    <LigacaoGaveta
      v-model:visible="ligacaoAberta"
      :alvo="alvo"
      :profissionais="profissionais"
      @registrada="mudou"
    />
    <FotoDoBoletimGaveta v-model:visible="fotoAberta" :boletim="paraFoto" @mudou="mudou" />
    <PreferenciaDoBoletimGaveta
      v-model:visible="preferenciaAberta"
      :internacao-id="internacaoId"
      :preferencia="preferencia"
      @salva="(nova) => (preferencia = nova)"
    />
  </section>
</template>

<style scoped>
.bl__nota {
  margin: 0;
  padding: 0 24px 12px;
}

.bl__vazio {
  color: var(--tinta-2);
  font-size: 14px;
}

.bl__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.bl__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.bl__motivo {
  color: var(--risco-tinta);
  font-size: 13px;
  font-weight: 600;
}

.bl__texto {
  display: -webkit-box;
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
}

.bl__item--cancelado .bl__texto,
.bl__item--cancelado .ui-linha__meta {
  color: var(--tinta-3);
}

.bl__telefone {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-weight: 600;
}

.bl__parado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--atencao-tinta);
  font-weight: 600;
}

.bl__mais {
  justify-self: start;
  margin: 4px 24px 16px;
}
</style>
