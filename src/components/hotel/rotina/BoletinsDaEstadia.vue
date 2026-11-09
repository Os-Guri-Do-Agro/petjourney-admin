<script setup lang="ts">
/**
 * A conversa do boletim ao responsável (E7-05c, guia e7 44): todos os boletins da estadia, do mais
 * recente, com a ação de cada estado.
 *
 * - Rascunho e liberado: "Enviar". Retido (R3): "Ligue para o responsável e registre o contato na
 *   ocorrência antes de enviar", com o atalho até as ocorrências; o "sem resposta" do gestor nunca
 *   libera o boletim.
 * - Enviado: a entrega (quantas pessoas; só no inbox depois do teto do dia). Cancelado: em cinza,
 *   com o motivo ("Substituído pelo boletim automático" para o rascunho superado).
 * - Sem app: nada sai, avise por telefone.
 * - A preferência e o próximo automático ficam no alto, com "Ajustar".
 *
 * Tudo é de quem cuida da rotina (`hotel.rotina`): o veterinário não vê o boletim.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { invalidarPendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
import { novaChaveDeIdempotencia } from '@/service/idempotencia'
import {
  boletimDoHotelAberto,
  descartarBoletimDoHotel,
  enviarBoletimDoHotel,
  lerConversaDoHotel,
  lerPreferenciaDoHotel,
  type BoletimDoHotel,
  type ConversaDoBoletimDoHotel,
  type PreferenciaDoBoletimDoHotel,
} from '@/service/parceiro/hotel-boletim-service'
import { urlDaFotoDoDiario } from '@/service/parceiro/hotel-ocorrencias-service'
import { abrirAbaVazia, levarAoArquivo } from '@/utils/arquivo-assinado'

import BoletimDoHotelGaveta from './BoletimDoHotelGaveta.vue'
import PreferenciaDoHotelGaveta from './PreferenciaDoHotelGaveta.vue'

const props = defineProps<{ hospedagemId: string; paciente: string; podeEscrever: boolean }>()
const emit = defineEmits<{ irParaOcorrencias: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

const conversa = ref<ConversaDoBoletimDoHotel | null>(null)
const preferencia = ref<PreferenciaDoBoletimDoHotel | null>(null)
const carregando = ref(false)
/** O erro da leitura da conversa e o da última ação ficam separados: reler não apaga o da ação. */
const erroDeLeitura = ref('')
const erro = ref('')
const recado = ref('')

async function carregar(mais = false) {
  carregando.value = true
  try {
    const pagina = await lerConversaDoHotel(
      props.hospedagemId,
      mais ? conversa.value?.proximoCursor : null,
      parceiroQuery(),
    )
    conversa.value =
      mais && conversa.value
        ? { ...pagina, itens: [...conversa.value.itens, ...pagina.itens] }
        : pagina
    erroDeLeitura.value = ''
    if (!mais)
      preferencia.value = await lerPreferenciaDoHotel(props.hospedagemId, parceiroQuery()).catch(
        () => preferencia.value,
      )
  } catch (err) {
    erroDeLeitura.value = lerErroDoCadastro(err, t('boletimDoHotel.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

defineExpose({ carregar })

onMounted(() => void carregar())
watch(
  () => props.hospedagemId,
  () => void carregar(),
)

const TOM: Record<BoletimDoHotel['status'], string> = {
  RASCUNHO: 'atencao',
  RETIDO: 'risco',
  LIBERADO: 'atencao',
  ENVIADO: 'ok',
  CANCELADO: '',
}

const aberto = computed(
  () => conversa.value?.itens.find((item) => boletimDoHotelAberto(item.status)) ?? null,
)

function meta(item: BoletimDoHotel) {
  const partes = [
    item.tipo === 'SAIDA' ? t('boletimDoHotel.saida') : '',
    item.origem === 'AUTOMATICO' ? t('boletimDoHotel.automatico') : '',
    rotulos.quando(item.enviadoEm ?? item.geradoEm),
    item.fotos ? t('boletimDoHotel.comFotos', { n: item.fotos }, item.fotos) : '',
  ]
  if (item.status === 'CANCELADO' && item.motivoCancelamento)
    partes.push(t(`boletimDoHotel.cancelado.${item.motivoCancelamento}`))
  return partes.filter(Boolean).join(' · ')
}

function entrega(item: BoletimDoHotel) {
  const comprovante = item.entrega
  if (!comprovante) return ''
  if (comprovante.situacao !== 'ENVIADO')
    return comprovante.motivo === 'SEM_CANAL_NO_APP' || comprovante.motivo === 'NAO_AVISAR'
      ? t('boletimDoHotel.semApp')
      : t('boletimDoHotel.naoSaiu')
  return [
    t(
      'boletimDoHotel.entregue',
      { n: comprovante.destinatarios, quando: rotulos.quando(comprovante.em) },
      comprovante.destinatarios,
    ),
    comprovante.soInbox ? t('boletimDoHotel.soInbox') : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** O rascunho esquecido: mais velho que a frequência da estadia (sem preferência, 24 h). */
function esquecido(item: BoletimDoHotel) {
  if (item.status !== 'RASCUNHO') return false
  const horas = preferencia.value?.frequenciaHoras ?? 24
  return Date.now() - Date.parse(item.geradoEm) > horas * 3600 * 1000
}

const resumoDaPreferencia = computed(() => {
  const pref = preferencia.value
  if (!pref) return ''
  return [
    t('boletimDoHotel.aCada', { n: pref.frequenciaHoras }),
    pref.proximoBoletimEm
      ? t('boletimDoHotel.proximo', { quando: rotulos.quando(pref.proximoBoletimEm) })
      : '',
    pref.definidaPor ? t(`boletimDoHotel.definidaPor.${pref.definidaPor}`) : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

/* ----------------------------------------------------------------------------- as ações */

const ocupado = ref<string | null>(null)
const escreverAberta = ref(false)
const preferenciaAberta = ref(false)

async function enviar(item: BoletimDoHotel) {
  ocupado.value = item.id
  recado.value = ''
  erro.value = ''
  try {
    const envio = await enviarBoletimDoHotel(item.id, novaChaveDeIdempotencia(), parceiroQuery())
    recado.value = envio.entregue ? t('boletimDoHotel.enviado') : t('boletimDoHotel.semApp')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('boletimDoHotel.erroEnviar'))
    erro.value =
      lido.codigo === 'BOLETIM_EXIGE_CONTATO'
        ? t('boletimDoHotel.exigeContato')
        : lido.codigo === 'BOLETIM_HOTEL_DESATUALIZADO'
          ? t('boletimDoHotel.desatualizado')
          : lido.mensagem
  } finally {
    ocupado.value = null
    invalidarPendenciasDoPortal()
    void carregar()
  }
}

async function descartar(item: BoletimDoHotel) {
  ocupado.value = item.id
  erro.value = ''
  recado.value = ''
  try {
    await descartarBoletimDoHotel(item.id, parceiroQuery())
    invalidarPendenciasDoPortal()
    void carregar()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('boletimDoHotel.erroDescartar')).mensagem
  } finally {
    ocupado.value = null
  }
}

async function verFoto(registroId: string) {
  const janela = abrirAbaVazia()
  try {
    const { url } = await urlDaFotoDoDiario(props.hospedagemId, registroId, parceiroQuery())
    levarAoArquivo(janela, url)
  } catch (err) {
    janela?.close()
    erro.value = lerErroDoCadastro(err, t('rotinaDoHotel.diario.erroFoto')).mensagem
  }
}

function escrito() {
  recado.value = ''
  erro.value = ''
  invalidarPendenciasDoPortal()
  void carregar()
}

function jaAberto(texto: string) {
  recado.value = ''
  erro.value = texto
  void carregar()
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="bo-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-chat-text" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="bo-titulo" class="ui-cartao__titulo">{{ t('boletimDoHotel.titulo') }}</h2>
        <p class="ui-cartao__descricao">
          {{
            conversa?.semCanalNoApp
              ? t('boletimDoHotel.semApp')
              : resumoDaPreferencia || t('boletimDoHotel.descricao')
          }}
        </p>
      </span>
      <span v-if="podeEscrever" class="bo__acoes">
        <Button
          v-if="preferencia && !conversa?.semCanalNoApp"
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-sliders-horizontal"
          :label="t('boletimDoHotel.ajustar')"
          @click="preferenciaAberta = true"
        />
        <Button
          v-if="conversa && !aberto && !conversa.semCanalNoApp"
          type="button"
          size="small"
          icon="ph ph-plus"
          :label="t('boletimDoHotel.escrever')"
          @click="escreverAberta = true"
        />
      </span>
    </header>

    <p v-if="recado" class="eg__aviso bo__nota" role="status">
      <i class="ph ph-check-circle" aria-hidden="true" />
      <span>{{ recado }}</span>
    </p>
    <p v-if="erro || erroDeLeitura" class="eg__erro bo__nota" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro || erroDeLeitura }}</span>
    </p>

    <ul v-if="conversa?.itens.length" class="ui-lista">
      <li
        v-for="item in conversa.itens"
        :key="item.id"
        class="ui-linha bo__item"
        :class="{
          'bo__item--cancelado': item.status === 'CANCELADO',
          'ui-marca ui-marca--risco': item.contatoPendente,
        }"
      >
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo bo__nome">
            <span class="ui-selo" :class="TOM[item.status] ? `ui-selo--${TOM[item.status]}` : ''">{{
              t(`boletimDoHotel.status.${item.status}`)
            }}</span>
          </strong>
          <span class="bo__texto">{{ item.texto }}</span>
          <span class="ui-linha__meta">{{ meta(item) }}</span>
          <span v-if="entrega(item)" class="ui-linha__meta">{{ entrega(item) }}</span>
          <span v-if="item.contatoPendente" class="bo__alerta">
            <i class="ph ph-phone-call" aria-hidden="true" />
            {{ t('boletimDoHotel.exigeContato') }}
          </span>
          <span v-else-if="esquecido(item)" class="bo__alerta bo__alerta--atencao">
            <i class="ph ph-pause-circle" aria-hidden="true" />
            {{ t('boletimDoHotel.esquecido') }}
          </span>
          <span v-if="item.fotoDiarioIds.length" class="bo__fotos">
            <Button
              v-for="(fotoId, indice) in item.fotoDiarioIds"
              :key="fotoId"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-image"
              :label="t('boletimDoHotel.foto', { n: indice + 1 })"
              @click="verFoto(fotoId)"
            />
          </span>
          <span v-if="podeEscrever && boletimDoHotelAberto(item.status)" class="bo__acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('boletimDoHotel.descartar')"
              :disabled="ocupado === item.id"
              @click="descartar(item)"
            />
            <Button
              v-if="item.contatoPendente"
              type="button"
              size="small"
              icon="ph ph-phone-call"
              :label="t('boletimDoHotel.irParaOcorrencias')"
              @click="emit('irParaOcorrencias')"
            />
            <Button
              v-else
              type="button"
              size="small"
              icon="ph ph-paper-plane-tilt"
              :label="t('boletimDoHotel.enviar')"
              :loading="ocupado === item.id"
              @click="enviar(item)"
            />
          </span>
        </span>
      </li>
    </ul>
    <p v-else-if="conversa" class="bo__nota bo__vazio">{{ t('boletimDoHotel.vazio') }}</p>

    <Button
      v-if="conversa?.proximoCursor"
      type="button"
      size="small"
      severity="secondary"
      outlined
      class="bo__mais"
      :label="t('rotinaDoHotel.verMais')"
      :loading="carregando"
      @click="carregar(true)"
    />

    <BoletimDoHotelGaveta
      v-model:visible="escreverAberta"
      :hospedagem-id="hospedagemId"
      :paciente="paciente"
      @escrito="escrito"
      @ja-aberto="jaAberto"
    />
    <PreferenciaDoHotelGaveta
      v-model:visible="preferenciaAberta"
      :hospedagem-id="hospedagemId"
      :preferencia="preferencia"
      @salva="(nova) => (preferencia = nova)"
    />
  </section>
</template>

<style scoped>
.bo__nota {
  margin: 0;
  padding: 0 10px 12px;
}

.bo__vazio {
  color: var(--tinta-2);
  font-size: 14px;
}

.bo__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

/* Na linha do boletim, as ações vão embaixo do texto: ele é longo e precisa da largura. */
.bo__item .bo__acoes {
  display: flex;
  justify-content: flex-start;
  margin-top: 6px;
}

.bo__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.bo__texto {
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

.bo__item--cancelado .bo__texto,
.bo__item--cancelado .ui-linha__meta {
  color: var(--tinta-3);
}

.bo__alerta {
  display: inline-flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--risco-tinta);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.bo__alerta i {
  margin-top: 2px;
}

.bo__alerta--atencao {
  color: var(--atencao-tinta);
}

.bo__fotos {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.bo__mais {
  justify-self: start;
  margin: 4px 10px 12px;
}
</style>
