<script setup lang="ts">
/**
 * Responder um pedido de horário (E3-05, seção 6.5), numa gaveta ao lado da caixa: o pedido inteiro
 * (a queixa, o telefone e o e-mail de quem pediu pelo site), e as três respostas:
 *
 * - **o horário pedido**: aceitar vazio marca o que a pessoa escolheu;
 * - **outro horário**: as sugestões da API (`/sugestoes`), dentro do que a pessoa pediu ou perto do
 *   horário que sumiu; as de fora da preferência dizem isso. No melhor horário é o único caminho;
 * - **recusar**: o motivo e a mensagem, que vai citada no app, na página do pedido e no e-mail.
 *
 * O pedido não segura o horário (decisão 25): aceitar pode dar 409 `HORARIO_JA_TOMADO`. A gaveta
 * leva às sugestões, à recusa ou, com confirmação explícita, ao encaixe de propósito
 * (`professional-overlap`). O dia fechado (`CONFLITO_BLOQUEANTE`) pede a mesma confirmação
 * (`holiday-closed`). Os avisos que ficam depois do aceite aparecem no resultado.
 *
 * O telefone aparece como texto: a clínica liga pelo telefone dela, a tela não disca.
 */
import Button from 'primevue/button'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import {
  chaveDaRecusa,
  chaveDoConflito,
  chaveDoMotivo,
  comMaiuscula,
  conflitosQueAvisam,
  diaCurto,
  diaLongo,
} from '@/components/pedidos/leitura-do-pedido'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  aceitarPedido,
  diaDoInstante,
  horaDoInstante,
  horarioEscolhido,
  horarioSumiu,
  MOTIVOS_DA_RECUSA,
  obterPedido,
  recusarPedido,
  sugestoesDoPedido,
  type Aceite,
  type Conflito,
  type DetalheDoPedido,
  type MotivoDaRecusa,
  type SugestaoDoPedido,
} from '@/service/parceiro/pedidos-service'
import { telefoneNaTela } from '@/service/parceiro/pacientes-service'

const props = defineProps<{
  pedidoId: string | null
  podeAceitar: boolean
  podeRecusar: boolean
}>()

const emit = defineEmits<{ respondido: [] }>()
const visible = defineModel<boolean>('visible', { default: false })

const LIMITE_DE_SUGESTOES = 6

const { t, locale } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

const pedido = ref<DetalheDoPedido | null>(null)
const carregando = ref(false)
const erro = ref('')

type Acao = 'escolhido' | 'outro' | 'recusar'
const acao = ref<Acao>('escolhido')
const mensagem = ref('')
const enviando = ref(false)

/** O aceite que esbarrou e espera a confirmação de quem está no balcão. */
const aConfirmar = ref<{
  conflito: 'professional-overlap' | 'holiday-closed'
  aceite: Aceite
} | null>(null)
/** Depois do aceite: o que ficou marcado e os avisos que sobraram. */
const resultado = ref<{ quando: string; conflitos: Conflito[] } | null>(null)

async function carregar() {
  if (!props.pedidoId) return

  carregando.value = true
  erro.value = ''

  try {
    pedido.value = await obterPedido(props.pedidoId, parceiroQuery())
    /* Com o horário pedido ocupado depois, a gaveta abre nas sugestões. */
    const inicial = sumiu.value ? opcoesDeAcao.value.find((opcao) => opcao.valor === 'outro') : null
    acao.value = inicial?.valor ?? opcoesDeAcao.value[0]?.valor ?? 'recusar'
    if (acao.value === 'outro' && pedido.value.status === 'PENDENTE') void buscarSugestoes()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('pedidos.caixa.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

/* Abrir, ou trocar de pedido com a gaveta aberta (clique em outra linha da caixa). */
watch([visible, () => props.pedidoId], ([aberta]) => {
  if (aberta) reiniciar()
})
onMounted(() => {
  if (visible.value) reiniciar()
})

function reiniciar() {
  pedido.value = null
  mensagem.value = ''
  aConfirmar.value = null
  resultado.value = null
  sugestoes.value = []
  escolhida.value = null
  motivoDaRecusa.value = null
  mensagemDaRecusa.value = ''
  tentouRecusar.value = false
  void carregar()
}

/* -------------------------------------------------------------------------- o que se mostra */

const pendente = computed(() => pedido.value?.status === 'PENDENTE')
const escolhido = computed(() => (pedido.value ? horarioEscolhido(pedido.value) : null))
const sumiu = computed(() => (pedido.value ? horarioSumiu(pedido.value) : false))
const nomesDosPets = computed(() => pedido.value?.pets.map((pet) => pet.nome).join(', ') ?? '')

function quando(inicio: string) {
  return t('pedidos.caixa.quando', {
    dia: diaLongo(diaDoInstante(inicio), intl.value),
    hora: horaDoInstante(inicio),
  })
}

const pedidoQuando = computed(() => {
  const atual = pedido.value
  if (!atual) return ''

  if (escolhido.value) return comMaiuscula(quando(escolhido.value.inicio), intl.value)

  const preferencia = atual.preferencia
  if (!preferencia) return ''

  const periodos = preferencia.periodos.length
    ? preferencia.periodos
        .map((periodo) => t(`clinico.pedidos.periodo.${periodo.toLowerCase()}`))
        .join(', ')
    : t('clinico.pedidos.periodo.qualquer')

  return t('pedidos.caixa.janela', {
    de: diaCurto(preferencia.de, intl.value),
    ate: diaCurto(preferencia.ate, intl.value),
    periodos,
  })
})

const comQuem = computed(() =>
  pedido.value?.profissionalNome
    ? t('clinico.pedidos.comProfissional', { nome: pedido.value.profissionalNome })
    : t('clinico.pedidos.qualquerProfissional'),
)

const opcoesDeAcao = computed(() => {
  const opcoes: { valor: Acao; rotulo: string }[] = []

  /* Mesmo com o horário ocupado, o pedido segue ali: marcar nele é o encaixe de propósito. */
  if (props.podeAceitar && escolhido.value) {
    opcoes.push({ valor: 'escolhido', rotulo: t('pedidos.caixa.acao.escolhido') })
  }
  if (props.podeAceitar) {
    opcoes.push({
      valor: 'outro',
      rotulo: escolhido.value ? t('pedidos.caixa.acao.outro') : t('pedidos.caixa.acao.marcar'),
    })
  }
  if (props.podeRecusar) opcoes.push({ valor: 'recusar', rotulo: t('clinico.pedidos.recusar') })

  return opcoes
})

function trocarAcao(nova: Acao | null) {
  if (!nova) return

  acao.value = nova
  aConfirmar.value = null
  if (nova === 'outro' && !sugestoes.value.length && !buscando.value) void buscarSugestoes()
}

/* ------------------------------------------------------------------------------ sugestões */

const sugestoes = ref<SugestaoDoPedido[]>([])
const buscaInterrompida = ref(false)
const buscando = ref(false)
const escolhida = ref<number | null>(null)

async function buscarSugestoes() {
  if (!props.pedidoId) return

  buscando.value = true
  escolhida.value = null

  try {
    const resposta = await sugestoesDoPedido(props.pedidoId, LIMITE_DE_SUGESTOES, parceiroQuery())
    sugestoes.value = resposta.sugestoes
    buscaInterrompida.value = resposta.buscaInterrompida
  } catch (err) {
    sugestoes.value = []
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('pedidos.caixa.erroAoCarregar')).mensagem,
      life: 6000,
    })
  } finally {
    buscando.value = false
  }
}

function rotuloDaSugestao(sugestao: SugestaoDoPedido) {
  return t('pedidos.caixa.sugestao', {
    dia: diaCurto(diaDoInstante(sugestao.inicio), intl.value),
    inicio: horaDoInstante(sugestao.inicio),
    fim: horaDoInstante(sugestao.fim),
    profissional: sugestao.profissionalNome,
  })
}

/* -------------------------------------------------------------------------------- aceitar */

function corpoDoAceite(): Aceite | null {
  const texto = mensagem.value.trim() || undefined

  if (acao.value === 'escolhido') return { mensagem: texto }

  const sugestao = escolhida.value === null ? null : sugestoes.value[escolhida.value]
  if (!sugestao) return null

  return { inicio: sugestao.inicio, profissionalId: sugestao.profissionalId, mensagem: texto }
}

async function aceitar(aceite: Aceite) {
  if (!props.pedidoId) return

  enviando.value = true

  try {
    const resposta = await aceitarPedido(props.pedidoId, aceite, parceiroQuery())
    const inicio = aceite.inicio ?? resposta.pedido.pets.find((pet) => pet.inicio)?.inicio ?? null
    pedido.value = resposta.pedido
    aConfirmar.value = null
    resultado.value = {
      quando: inicio ? quando(inicio) : '',
      conflitos: conflitosQueAvisam(resposta.conflitos),
    }
    toast.add({ severity: 'success', summary: t('pedidos.caixa.aceito'), life: 3000 })
    emit('respondido')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))

    if (lido.codigo === 'HORARIO_JA_TOMADO') {
      aConfirmar.value = { conflito: 'professional-overlap', aceite }
    } else if (lido.codigo === 'CONFLITO_BLOQUEANTE') {
      aConfirmar.value = { conflito: 'holiday-closed', aceite }
    } else if (lido.codigo === 'PEDIDO_JA_RESPONDIDO') {
      toast.add({
        severity: 'warn',
        summary: t('clinico.pedidos.resultado.ja-respondido'),
        life: 5000,
      })
      emit('respondido')
      await carregar()
    } else {
      toast.add({ severity: 'error', summary: lido.mensagem, life: 6000 })
    }
  } finally {
    enviando.value = false
  }
}

function enviarAceite() {
  const aceite = corpoDoAceite()
  if (aceite) void aceitar(aceite)
}

/** O encaixe de propósito (ou o dia fechado), depois do "marcar mesmo assim". */
function confirmarMesmoAssim() {
  const pendencia = aConfirmar.value
  if (!pendencia) return

  const anteriores = pendencia.aceite.confirmarConflitos ?? []
  void aceitar({
    ...pendencia.aceite,
    confirmarConflitos: [...new Set([...anteriores, pendencia.conflito])],
  })
}

function verOutrosHorarios() {
  aConfirmar.value = null
  acao.value = 'outro'
  void buscarSugestoes()
}

/* -------------------------------------------------------------------------------- recusar */

const motivoDaRecusa = ref<MotivoDaRecusa | null>(null)
const mensagemDaRecusa = ref('')
const tentouRecusar = ref(false)

const opcoesDaRecusa = computed(() =>
  MOTIVOS_DA_RECUSA.map((valor) => ({ valor, rotulo: t(chaveDaRecusa(valor)) })),
)

async function recusar() {
  tentouRecusar.value = true
  if (!props.pedidoId || !motivoDaRecusa.value) return

  enviando.value = true

  try {
    pedido.value = await recusarPedido(
      props.pedidoId,
      { motivo: motivoDaRecusa.value, mensagem: mensagemDaRecusa.value.trim() || null },
      parceiroQuery(),
    )
    toast.add({ severity: 'success', summary: t('clinico.pedidos.resultado.recusado'), life: 3000 })
    emit('respondido')
    visible.value = false
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))

    if (lido.codigo === 'PEDIDO_JA_RESPONDIDO') {
      toast.add({
        severity: 'warn',
        summary: t('clinico.pedidos.resultado.ja-respondido'),
        life: 5000,
      })
      emit('respondido')
      await carregar()
    } else {
      toast.add({ severity: 'error', summary: lido.mensagem, life: 6000 })
    }
  } finally {
    enviando.value = false
  }
}

/* ----------------------------------------------------------------------- já respondido */

const desfecho = computed(() => {
  const atual = pedido.value
  if (!atual || atual.status === 'PENDENTE') return ''

  /*
   * Lacuna N24: com "outro horário", o pedido continua com o horário pedido (`pets[].inicio`) e não
   * há leitura do agendamento por id; o desfecho não afirma hora que não sabe.
   */
  if (atual.status === 'ACEITO') {
    return t(
      atual.respondidoPor === 'AUTOMATICO'
        ? 'pedidos.caixa.desfechoCurto.automatico'
        : 'pedidos.caixa.desfechoCurto.aceito',
    )
  }
  if (atual.status === 'RECUSADO' && atual.recusa) {
    return t('clinico.pedidos.respondido.recusado', {
      motivo: t(chaveDaRecusa(atual.recusa.motivo)),
    })
  }

  return t(`clinico.pedidos.respondido.${atual.status === 'DESISTIU' ? 'desistiu' : 'expirado'}`)
})

function textoDoAviso(aviso: DetalheDoPedido['avisos'][number]) {
  return t(`pedidos.caixa.aviso.${aviso.situacao}`, {
    canal: t(`pedidos.caixa.aviso.canal.${aviso.canal}`),
  })
}

const podeResponder = computed(
  () => pendente.value && (props.podeAceitar || props.podeRecusar) && !resultado.value,
)
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="nomesDosPets || t('clinico.pedidos.titulo')"
    icone="ph ph-calendar-plus"
    largura="34rem"
  >
    <p v-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="carregar"
      />
    </p>

    <div v-if="carregando && !pedido" class="rp__esqueleto" aria-busy="true">
      <Skeleton v-for="n in 5" :key="n" height="2.5rem" />
    </div>

    <template v-else-if="pedido">
      <!-- O pedido: o que, quando, quem. -->
      <section class="eg__secao">
        <span class="eg__rotulo">{{ t('pedidos.caixa.pedido') }}</span>
        <p class="rp__quando">
          <strong>{{ pedidoQuando }}</strong>
          <span>{{ pedido.servico.nome }} · {{ comQuem }}</span>
        </p>
        <ul v-if="pedido.pets.length > 1 && escolhido" class="rp__pets">
          <li v-for="pet in pedido.pets" :key="pet.pedidoId">
            {{ pet.nome }}
            <span v-if="pet.inicio" class="ui-num">{{ horaDoInstante(pet.inicio) }}</span>
          </li>
        </ul>
        <p v-if="sumiu && pendente" class="rp__alerta" role="status">
          <i class="ph ph-calendar-x" aria-hidden="true" />
          {{ t('clinico.pedidos.ocupado') }}
        </p>
        <p v-if="pedido.remarcacao" class="rp__nota">
          <i class="ph ph-arrows-clockwise" aria-hidden="true" />
          {{ t('clinico.pedidos.remarcacao') }}
        </p>
      </section>

      <dl class="rp__dados">
        <div>
          <dt>{{ t('pedidos.caixa.motivo') }}</dt>
          <dd>{{ t(chaveDoMotivo(pedido.motivo)) }}</dd>
        </div>
        <div v-if="pedido.queixa">
          <dt>{{ t('pedidos.caixa.queixa') }}</dt>
          <dd class="rp__queixa">{{ pedido.queixa }}</dd>
        </div>
        <div>
          <dt>{{ t('pedidos.caixa.quemPede') }}</dt>
          <dd>
            {{ pedido.quemPede }}
            <span class="rp__canal">
              ·
              {{
                t(pedido.canal === 'APP' ? 'clinico.pedidos.canal.app' : 'pedidos.caixa.peloSite')
              }}
            </span>
          </dd>
        </div>
        <div v-if="pedido.telefone">
          <dt>{{ t('pedidos.caixa.telefone') }}</dt>
          <dd class="ui-num">{{ telefoneNaTela(pedido.telefone) }}</dd>
        </div>
        <div v-if="pedido.email">
          <dt>{{ t('pedidos.caixa.email') }}</dt>
          <dd>{{ pedido.email }}</dd>
        </div>
      </dl>

      <p v-if="pedido.ativaVinculo && pendente" class="rp__nota">
        <i class="ph ph-link-simple" aria-hidden="true" />
        {{ t('pedidos.caixa.ativaVinculo') }}
      </p>
      <p v-if="pedido.compartilharHistorico" class="rp__nota">
        <i class="ph ph-notebook" aria-hidden="true" />
        {{ t('clinico.pedidos.historicoLiberado') }}
      </p>

      <!-- A resposta. -->
      <section v-if="podeResponder" class="eg__secao rp__resposta">
        <span id="rp-resposta" class="eg__rotulo">{{ t('pedidos.caixa.resposta') }}</span>
        <SelectButton
          v-if="opcoesDeAcao.length > 1"
          :model-value="acao"
          :options="opcoesDeAcao"
          option-label="rotulo"
          option-value="valor"
          :allow-empty="false"
          aria-labelledby="rp-resposta"
          :disabled="enviando"
          @update:model-value="trocarAcao"
        />

        <!-- O horário que a pessoa escolheu. -->
        <p v-if="acao === 'escolhido' && escolhido" class="rp__dica">
          {{
            t(sumiu ? 'pedidos.caixa.marcaComoEncaixe' : 'pedidos.caixa.marcaOEscolhido', {
              quando: quando(escolhido.inicio),
            })
          }}
        </p>

        <!-- Outro horário: as sugestões da API. -->
        <div v-if="acao === 'outro'" class="rp__sugestoes">
          <div v-if="buscando" aria-busy="true" class="rp__esqueleto">
            <Skeleton v-for="n in 3" :key="n" height="2.25rem" />
          </div>
          <p v-else-if="!sugestoes.length" class="rp__dica">
            {{ t('clinico.pedidos.semSugestao') }}
          </p>
          <template v-else>
            <label
              v-for="(sugestao, indice) in sugestoes"
              :key="`${sugestao.profissionalId}-${sugestao.inicio}`"
              class="rp__sugestao"
            >
              <RadioButton
                v-model="escolhida"
                :value="indice"
                name="rp-sugestao"
                :disabled="enviando"
              />
              <span>
                {{ rotuloDaSugestao(sugestao) }}
                <span v-if="sugestao.foraDaPreferencia" class="ui-selo">
                  {{ t('clinico.pedidos.horario.foraDaJanela') }}
                </span>
              </span>
            </label>
            <small v-if="buscaInterrompida" class="eg__dica">{{
              t('pedidos.caixa.buscaInterrompida')
            }}</small>
          </template>
        </div>

        <!-- Recusar. -->
        <template v-if="acao === 'recusar'">
          <label class="eg__rotulo" for="rp-motivo">{{ t('clinico.pedidos.recusa.porque') }}</label>
          <Select
            v-model="motivoDaRecusa"
            input-id="rp-motivo"
            :options="opcoesDaRecusa"
            option-label="rotulo"
            option-value="valor"
            :placeholder="t('pedidos.caixa.escolhaOMotivo')"
            :invalid="tentouRecusar && !motivoDaRecusa"
            :disabled="enviando"
          />
          <small v-if="tentouRecusar && !motivoDaRecusa" class="eg__invalido">{{
            t('pedidos.caixa.motivoObrigatorio')
          }}</small>
          <label class="eg__rotulo" for="rp-mensagem-recusa">
            {{ t('clinico.pedidos.recusa.mensagemPara', { nome: pedido.quemPede }) }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <Textarea
            id="rp-mensagem-recusa"
            v-model="mensagemDaRecusa"
            rows="3"
            auto-resize
            :disabled="enviando"
          />
          <small class="eg__dica">{{ t('pedidos.caixa.mensagemDaRecusaDica') }}</small>
        </template>

        <!-- A mensagem do aceite. -->
        <template v-else>
          <label class="eg__rotulo" for="rp-mensagem">
            {{ t('pedidos.caixa.mensagem', { nome: pedido.quemPede }) }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </label>
          <Textarea id="rp-mensagem" v-model="mensagem" rows="2" auto-resize :disabled="enviando" />
          <small class="eg__dica">{{ t('pedidos.caixa.mensagemDica') }}</small>
        </template>

        <!-- O aceite que esbarrou: o horário foi tomado, ou o dia está fechado. -->
        <div v-if="aConfirmar" class="rp__confirmar" role="alert">
          <p>
            <i class="ph ph-warning" aria-hidden="true" />
            {{ t(`pedidos.caixa.confirmar.${aConfirmar.conflito}`) }}
          </p>
          <span class="rp__botoes">
            <Button
              v-if="aConfirmar.conflito === 'professional-overlap'"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-calendar-dots"
              :label="t('pedidos.caixa.verOutros')"
              :disabled="enviando"
              @click="verOutrosHorarios"
            />
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('pedidos.caixa.marcarMesmoAssim')"
              :loading="enviando"
              @click="confirmarMesmoAssim"
            />
          </span>
        </div>
      </section>

      <!-- Depois do aceite. -->
      <section v-if="resultado" class="eg__secao rp__resultado" role="status">
        <p class="rp__feito">
          <i class="ph ph-check-circle" aria-hidden="true" />
          {{ t('pedidos.caixa.marcado', { quando: resultado.quando }) }}
        </p>
        <ul v-if="resultado.conflitos.length" class="rp__conflitos">
          <li v-for="(conflito, indice) in resultado.conflitos" :key="indice">
            <i class="ph ph-warning" aria-hidden="true" />
            {{ t(chaveDoConflito(conflito)) }}
          </li>
        </ul>
      </section>

      <!-- Já respondido. -->
      <section v-else-if="!pendente" class="eg__secao">
        <span class="eg__rotulo">{{ t('pedidos.caixa.desfecho') }}</span>
        <p class="rp__quando">
          <strong>{{ desfecho }}</strong>
        </p>
        <blockquote v-if="pedido.recusa?.mensagem" class="rp__citacao">
          {{ pedido.recusa.mensagem }}
        </blockquote>
        <ul v-if="pedido.avisos.length" class="rp__avisos">
          <li v-for="aviso in pedido.avisos" :key="aviso.id">
            <i
              :class="aviso.situacao === 'NAO_ENVIADO' ? 'ph ph-bell-slash' : 'ph ph-bell'"
              aria-hidden="true"
            />
            {{ textoDoAviso(aviso) }}
          </li>
        </ul>
      </section>
    </template>

    <template #pe>
      <Button
        type="button"
        :label="podeResponder ? t('cadastro.cancelar') : t('agenda.config.expediente.fechar')"
        severity="secondary"
        outlined
        :disabled="enviando"
        @click="visible = false"
      />
      <template v-if="podeResponder">
        <Button
          v-if="acao === 'recusar'"
          type="button"
          icon="ph ph-x"
          :label="t('clinico.pedidos.recusa.enviar')"
          :loading="enviando"
          @click="recusar"
        />
        <Button
          v-else
          type="button"
          icon="ph ph-check"
          :label="t('clinico.pedidos.aceitar')"
          :loading="enviando && !aConfirmar"
          :disabled="Boolean(aConfirmar) || (acao === 'outro' && escolhida === null)"
          @click="enviarAceite"
        />
      </template>
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.rp__esqueleto {
  display: grid;
  gap: 10px;
}

.rp__quando {
  display: grid;
  gap: 2px;
  margin: 0;
}

.rp__quando strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.rp__quando span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.rp__pets {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--tinta-2);
  font-size: 13px;
}

.rp__pets .ui-num {
  margin-inline-start: 6px;
  color: var(--tinta);
}

.rp__alerta,
.rp__nota,
.rp__feito {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.rp__alerta i {
  margin-top: 2px;
  color: var(--risco-tinta);
}

.rp__nota i,
.rp__feito i {
  margin-top: 2px;
}

.rp__feito {
  color: var(--tinta);
  font-size: 14px;
}

.rp__dados {
  display: grid;
  gap: 10px;
  margin: 0;
}

.rp__dados div {
  display: grid;
  gap: 2px;
}

.rp__dados dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.rp__dados dd {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.rp__queixa {
  white-space: pre-line;
}

.rp__canal {
  color: var(--tinta-2);
}

.rp__resposta {
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--linha-suave);
}

.rp__dica {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.rp__sugestoes {
  display: grid;
  gap: 4px;
}

.rp__sugestao {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  color: var(--tinta);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.rp__sugestao .ui-selo {
  margin-inline-start: 6px;
}

.rp__confirmar {
  display: grid;
  gap: 8px;
}

.rp__confirmar p {
  display: flex;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
}

.rp__confirmar i {
  margin-top: 2px;
  color: var(--risco-tinta);
}

.rp__botoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rp__resultado {
  padding-top: 14px;
  border-top: 1px solid var(--linha-suave);
}

.rp__conflitos,
.rp__avisos {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--tinta-2);
  font-size: 13px;
}

.rp__conflitos li,
.rp__avisos li {
  display: flex;
  gap: 8px;
}

.rp__conflitos i,
.rp__avisos i {
  margin-top: 2px;
}

.rp__citacao {
  margin: 0;
  padding-inline-start: 12px;
  border-inline-start: 3px solid var(--linha-suave);
  color: var(--tinta);
  font-size: 13.5px;
  white-space: pre-line;
}
</style>
