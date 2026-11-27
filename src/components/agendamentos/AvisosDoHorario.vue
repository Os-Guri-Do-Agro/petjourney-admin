<script setup lang="ts">
/**
 * O comprovante dos avisos ao responsável de um horário, na gaveta da agenda (E3-06, guia e3 4.2):
 * o que saiu, quando, por qual canal, a mensagem inteira da clínica, quem pediu e a entrega do push,
 * com o automático da véspera e da falta. Recolhido: a gaveta mostra o último e abre o resto.
 *
 * Lê ao abrir a gaveta e depois de uma escrita com aviso (`reler`), nunca em laço: a rota soma 300
 * leituras por pessoa por hora com o rastro da clínica. Devolve à gaveta o `semCanalNoApp` de agora
 * (o selo "sem canal no app" e o padrão do interruptor de avisar).
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDaAgenda } from '@/components/agendamentos/useFrasesDaAgenda'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { getAuthUser } from '@/service/auth/auth-session'
import {
  listarAvisosDoAgendamento,
  type AvisoAoResponsavel,
} from '@/service/parceiro/agenda-service'

const props = defineProps<{
  agendamentoId: string
  /** O nome de quem pediu (`enviadoPorId` é o usuário da equipe); vazio quando não se sabe. */
  nomeDoUsuario: (usuarioId: string) => string
}>()
const emit = defineEmits<{ canal: [semCanalNoApp: boolean | null] }>()

const { t, te } = useI18n()
const rotulos = useRotulosDoCadastro()
const { parceiroQuery } = useParceiroPortal()

/*
 * O nome do aviso. A API manda tipos que o contrato não lista (PEDIDO_ACEITO e
 * PEDIDO_MARCADO_EM_OUTRO_HORARIO no horário que nasceu de um pedido): sem o nome, a chave crua
 * aparecia na gaveta (26/11/2026). Tipo novo que chegar sai como "Aviso ao responsável".
 */
function nomeDoTipo(tipo: string) {
  const chave = `agendamentos.aviso.comprovante.tipo.${tipo}`
  return te(chave) ? t(chave) : t('agendamentos.aviso.comprovante.tipoOutro')
}

const itens = ref<AvisoAoResponsavel[]>([])
const fuso = ref<string | undefined>(undefined)
const proximoCursor = ref<string | null>(null)
const lido = ref(false)
const carregando = ref(false)
const erro = ref('')
/** 403 (outra clínica) ou rota que a demonstração não tem: a seção some. */
const escondido = ref(false)
const aberto = ref(false)

let vez = 0

async function ler(mais = false) {
  const minha = ++vez
  carregando.value = true
  erro.value = ''
  try {
    const pagina = await listarAvisosDoAgendamento(
      props.agendamentoId,
      { cursor: mais ? proximoCursor.value : null },
      parceiroQuery(),
    )
    if (minha !== vez) return
    itens.value = mais ? [...itens.value, ...pagina.itens] : pagina.itens
    proximoCursor.value = pagina.proximoCursor
    fuso.value = pagina.fuso
    lido.value = true
    emit('canal', pagina.semCanalNoApp)
  } catch (err) {
    if (minha !== vez) return
    if (err instanceof ApiError && (err.statusCode === 403 || err.statusCode === 404)) {
      escondido.value = true
    } else {
      erro.value = lerErroDaAgenda(err, t('agendamentos.aviso.comprovante.erro')).mensagem
    }
    if (!mais) emit('canal', null)
  } finally {
    if (minha === vez) carregando.value = false
  }
}

watch(
  () => props.agendamentoId,
  () => {
    itens.value = []
    proximoCursor.value = null
    lido.value = false
    escondido.value = false
    aberto.value = false
    void ler()
  },
  { immediate: true },
)

defineExpose({ reler: () => ler() })

/* ------------------------------------------------------------------------------ leitura */

const meuId = computed(() => getAuthUser()?.userId ?? null)

function momento(iso: string) {
  try {
    return new Intl.DateTimeFormat(rotulos.intl(), {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: fuso.value,
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16).replace('T', ' ')
  }
}

function hora(iso: string) {
  try {
    return new Intl.DateTimeFormat(rotulos.intl(), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: fuso.value,
    }).format(new Date(iso))
  } catch {
    return iso.slice(11, 16)
  }
}

const ICONE = {
  PENDENTE: 'ph ph-clock',
  ENVIADO: 'ph ph-check-circle',
  NAO_ENVIADO: 'ph ph-bell-slash',
} as const

const SELO = {
  PENDENTE: 'ui-selo',
  ENVIADO: 'ui-selo ui-selo--ok',
  NAO_ENVIADO: 'ui-selo ui-selo--atencao',
} as const

/** "Pedido por você em 25/11, 10:00" ou "Automático, 24/11, 18:00". */
function quemPediu(item: AvisoAoResponsavel) {
  const quando = momento(item.criadoEm)
  if (item.automatico && !item.enviadoPorId) {
    return t('agendamentos.aviso.comprovante.automatico', { quando })
  }
  const quem = !item.enviadoPorId
    ? ''
    : item.enviadoPorId === meuId.value
      ? t('agendamentos.aviso.comprovante.voce')
      : props.nomeDoUsuario(item.enviadoPorId)
  return quem
    ? t('agendamentos.aviso.comprovante.pedidoPor', { quem, quando })
    : t('agendamentos.aviso.comprovante.pedido', { quando })
}

/** Na fila: quando sai; saiu: quando, por onde e a entrega; não saiu: o porquê. */
function situacao(item: AvisoAoResponsavel) {
  if (item.situacao === 'PENDENTE') {
    return t('agendamentos.aviso.comprovante.saiAs', { hora: hora(item.liberarEm) })
  }
  if (item.situacao === 'NAO_ENVIADO') {
    return item.motivoSemAviso
      ? t(`agendamentos.aviso.comprovante.motivo.${item.motivoSemAviso}`)
      : ''
  }
  const saiu = item.processadoEm
    ? t('agendamentos.aviso.comprovante.saiu', {
        quando: momento(item.processadoEm),
        canal: t(`agendamentos.aviso.comprovante.canal.${item.canal}`),
      })
    : t(`agendamentos.aviso.comprovante.canal.${item.canal}`)
  return item.entrega
    ? `${saiu} · ${t(`agendamentos.aviso.comprovante.entrega.${item.entrega}`)}`
    : saiu
}

/** O horário que o aviso conta e, no remarcado, o de antes (só quando mudou: o de profissional não). */
function horarioAvisado(item: AvisoAoResponsavel) {
  const { inicioAvisado, inicioAnterior } = item
  if (!inicioAvisado) return ''
  return inicioAnterior && Date.parse(inicioAnterior) !== Date.parse(inicioAvisado)
    ? t('agendamentos.aviso.comprovante.horarioAntes', {
        quando: momento(inicioAvisado),
        antes: momento(inicioAnterior),
      })
    : t('agendamentos.aviso.comprovante.horario', { quando: momento(inicioAvisado) })
}

const ultimo = computed(() => itens.value[0] ?? null)
/** 'Ver os 3 avisos'; com mais páginas, sem o número (ainda não se sabe quantos). */
const rotuloDoVer = computed(() =>
  proximoCursor.value
    ? t('agendamentos.aviso.comprovante.verTodos')
    : t('agendamentos.aviso.comprovante.ver', { n: itens.value.length }, itens.value.length),
)
</script>

<template>
  <section v-if="!escondido" class="eg__secao avh" :aria-busy="carregando">
    <span class="eg__rotulo">{{ t('agendamentos.aviso.comprovante.titulo') }}</span>

    <Skeleton v-if="!lido && carregando" height="2.25rem" />
    <p v-else-if="erro && !lido" class="avh__erro" role="alert">{{ erro }}</p>
    <p v-else-if="!itens.length" class="avh__vazio">
      {{ t('agendamentos.aviso.comprovante.vazio') }}
    </p>

    <template v-else>
      <!-- Recolhido: o último aviso, numa linha, e o botão que abre os outros. -->
      <p v-if="!aberto && ultimo" class="avh__linha">
        <i :class="ICONE[ultimo.situacao]" aria-hidden="true" />
        <span class="avh__tipo">{{ nomeDoTipo(ultimo.tipo) }}</span>
        <span :class="SELO[ultimo.situacao]">{{
          t(`agendamentos.aviso.comprovante.situacao.${ultimo.situacao}`)
        }}</span>
      </p>

      <ul v-else class="avh__lista">
        <li v-for="item in itens" :key="item.id" class="avh__item">
          <p class="avh__linha">
            <i :class="ICONE[item.situacao]" aria-hidden="true" />
            <span class="avh__tipo">{{ nomeDoTipo(item.tipo) }}</span>
            <span :class="SELO[item.situacao]">{{
              t(`agendamentos.aviso.comprovante.situacao.${item.situacao}`)
            }}</span>
          </p>
          <small>{{ quemPediu(item) }}</small>
          <small v-if="situacao(item)">{{ situacao(item) }}</small>
          <small v-if="horarioAvisado(item)">{{ horarioAvisado(item) }}</small>
          <blockquote v-if="item.mensagemDaClinica" class="avh__mensagem">
            {{ item.mensagemDaClinica }}
          </blockquote>
        </li>
      </ul>

      <p v-if="erro && lido" class="avh__erro" role="alert">{{ erro }}</p>

      <div class="avh__acoes">
        <Button
          v-if="!aberto"
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-list-bullets"
          :label="rotuloDoVer"
          @click="aberto = true"
        />
        <template v-else>
          <Button
            v-if="proximoCursor"
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-caret-down"
            :label="t('agendamentos.aviso.comprovante.mais')"
            :loading="carregando"
            @click="ler(true)"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-caret-up"
            :label="t('agendamentos.aviso.comprovante.recolher')"
            @click="aberto = false"
          />
        </template>
      </div>
    </template>
  </section>
</template>

<style scoped>
.avh__vazio,
.avh__erro {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.avh__erro {
  color: var(--risco-tinta);
}

.avh__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
}

.avh__linha i {
  color: var(--tinta-2);
  font-size: 16px;
}

.avh__tipo {
  font-weight: 600;
}

.avh__lista {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.avh__item {
  display: grid;
  gap: 3px;
}

.avh__item + .avh__item {
  padding-top: 14px;
  border-top: 1px solid var(--linha-suave);
}

.avh__item small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.avh__mensagem {
  margin: 4px 0 0;
  padding-inline-start: 10px;
  border-inline-start: 2px solid var(--linha);
  color: var(--tinta);
  font-size: 13.5px;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.avh__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
