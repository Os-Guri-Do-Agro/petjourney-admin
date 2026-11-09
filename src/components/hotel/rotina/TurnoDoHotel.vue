<script setup lang="ts">
/**
 * O turno do hotel na prancheta (E7-05b, guia e7 43): quem está com ele e até quando, as
 * ocorrências graves esperando a ligação ao responsável no topo (são elas que travam a passagem),
 * as pendências até o fim do turno e a passagem recebida, congelada.
 *
 * Sem turno aberto, "Assumir" abre o da grade (07 a 13, 13 a 19, 19 a 07 na casa). Registrar no
 * diário, ocorrência ou marcar tarefa sem turno abre um automático com quem registrou. Passa o turno
 * quem está com ele; o dono destrava o vencido (a API confere).
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  assumirTurno,
  lerTurnoAtual,
  type EntregaDoTurno,
  type TurnoAtual,
} from '@/service/parceiro/hotel-rotina-service'
import { listarProfissionais, type Profissional } from '@/service/parceiro/profissionais-service'

import PassagemDoHotelGaveta from './PassagemDoHotelGaveta.vue'
import { diaDaParede, diasEntre } from './rotina-do-hotel'

const props = defineProps<{ podeExecutar: boolean }>()
const emit = defineEmits<{ mudou: [] }>()

const { t, te } = useI18n()
const rotulos = useRotulosDasReservas()
const { store, parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const turno = ref<TurnoAtual | null>(null)
const profissionais = ref<Profissional[]>([])
const erro = ref('')
const recado = ref('')
const assumindo = ref(false)

async function carregar() {
  try {
    turno.value = await lerTurnoAtual(parceiroQuery())
    erro.value = ''
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('rotinaDoHotel.turno.erro')).mensagem
  }
}

defineExpose({ carregar, agora: computed(() => turno.value?.agora ?? null) })

onMounted(async () => {
  void carregar()
  if (props.podeExecutar)
    profissionais.value = await listarProfissionais({ ...parceiroQuery(), ativo: true }).catch(
      () => [],
    )
})

const hora = (iso: string) => iso.slice(11, 16)

/** "ontem 22:00": a data aparece quando a pendência não é de hoje. */
function quando(dia: string, horaDaTarefa: string) {
  const hoje = turno.value ? diaDaParede(turno.value.agora) : dia
  const distancia = diasEntre(hoje, dia)
  const prefixo =
    distancia === -1
      ? t('rotinaDoHotel.dia.ontem')
      : distancia === 1
        ? t('rotinaDoHotel.dia.amanha')
        : distancia !== 0
          ? rotulos.dia(dia)
          : ''
  return prefixo ? `${prefixo} ${horaDaTarefa}` : horaDaTarefa
}

const frase = computed(() => {
  const atual = turno.value?.atual
  if (atual)
    return t('rotinaDoHotel.turno.atual', {
      turno: t(`rotinaDoHotel.turno.kind.${atual.kind}`),
      inicio: hora(atual.inicio),
      fim: hora(atual.fimPrevisto),
      nome: atual.responsavel.nome,
    })
  const sugerido = turno.value?.sugerido
  if (sugerido)
    return t('rotinaDoHotel.turno.semTurno', {
      turno: t(`rotinaDoHotel.turno.kind.${sugerido.kind}`),
      inicio: hora(sugerido.inicio),
      fim: hora(sugerido.fimPrevisto),
    })
  return ''
})

const meuId = computed(() => store.eu?.profissional?.id ?? null)
const souDono = computed(() => store.eu?.papel === 'DONO')

/* Entrega quem está com o turno; o dono destrava o vencido (a API confere e diz quando não pode). */
const podePassar = computed(() => {
  const atual = turno.value?.atual
  if (!atual || !props.podeExecutar) return false
  return atual.responsavel.profissionalId === meuId.value || (souDono.value && atual.vencido)
})

async function assumir() {
  assumindo.value = true
  recado.value = ''
  try {
    await assumirTurno(chaveador.para({ assumir: true }), parceiroQuery())
    chaveador.concluir()
    await carregar()
    emit('mudou')
  } catch (err) {
    chaveador.concluir()
    const lido = lerErroDoCadastro(err, t('rotinaDoHotel.turno.erroAssumir'))
    recado.value =
      lido.codigo === 'PROFISSIONAL_OBRIGATORIO' ? t('rotinaDoHotel.semFicha') : lido.mensagem
    await carregar()
  } finally {
    assumindo.value = false
  }
}

const passagemAberta = ref(false)
const pendenciasAbertas = ref(false)
const recebidaAberta = ref(false)

function entregue(entrega: EntregaDoTurno) {
  recado.value = t(
    'rotinaDoHotel.turno.entregue',
    { nome: entrega.novo.responsavel.nome, n: entrega.pendenciasCongeladas },
    entrega.pendenciasCongeladas,
  )
  void carregar()
  emit('mudou')
}

const travas = computed(() => turno.value?.ocorrenciasSemContato ?? [])
const totalDeTravas = computed(() => turno.value?.ocorrenciasSemContatoTotal ?? 0)
const pendencias = computed(() => turno.value?.pendencias ?? [])
const recebida = computed(() => turno.value?.passagemRecebida ?? null)

const deQuem = computed(() => {
  const passagem = recebida.value
  if (!passagem) return ''
  return passagem.destravadoPeloDono
    ? t('rotinaDoHotel.turno.encerradoPeloDono', { hora: hora(passagem.entregueEm) })
    : t('rotinaDoHotel.turno.recebida', {
        nome: passagem.entreguePor?.nome ?? '',
        hora: hora(passagem.entregueEm),
      })
})

function statusAgora(valor: string) {
  const chave = `rotinaDoHotel.turno.statusAgora.${valor}`
  return te(chave) ? t(chave) : valor
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="tn-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-clock-user" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="tn-titulo" class="ui-cartao__titulo">{{ t('rotinaDoHotel.turno.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ frase }}</p>
      </span>
    </header>
    <div v-if="(podeExecutar && turno && !turno.atual) || podePassar" class="tn__acoes">
      <Button
        v-if="podeExecutar && turno && !turno.atual"
        type="button"
        size="small"
        icon="ph ph-sign-in"
        :label="t('rotinaDoHotel.turno.assumir')"
        :loading="assumindo"
        @click="assumir"
      />
      <Button
        v-if="podePassar"
        type="button"
        size="small"
        icon="ph ph-arrows-left-right"
        :label="t('rotinaDoHotel.turno.passar')"
        @click="passagemAberta = true"
      />
    </div>

    <p v-if="turno?.atual?.vencido" class="eg__aviso tn__nota">
      <i class="ph ph-clock-countdown" aria-hidden="true" />
      <span>{{ t('rotinaDoHotel.turno.vencido', { hora: hora(turno.atual.fimPrevisto) }) }}</span>
    </p>
    <p v-if="recado" class="eg__aviso tn__nota" role="status">
      <i class="ph ph-info" aria-hidden="true" />
      <span>{{ recado }}</span>
    </p>
    <p v-if="erro" class="eg__erro tn__nota" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <!-- As graves sem ligação travam a passagem: no topo, cada uma leva à estadia. -->
    <template v-if="travas.length">
      <p class="tn__trava">
        <i class="ph ph-phone-call" aria-hidden="true" />
        <span>{{ t('rotinaDoHotel.turno.travas', { n: totalDeTravas }, totalDeTravas) }}</span>
      </p>
      <ul class="ui-lista">
        <li v-for="item in travas" :key="item.id" class="ui-linha ui-marca ui-marca--risco">
          <RouterLink
            :to="`/hotel/hospedagem/${item.hospedagemId}#ocorrencias`"
            class="ui-linha__texto tn__link"
          >
            <strong class="ui-linha__titulo">{{ item.pacienteNome }}</strong>
            <span class="ui-linha__meta">{{
              [
                t(`rotinaDoHotel.ocorrencia.kind.${item.kind}`),
                rotulos.quando(item.registradaEm),
                t('rotinaDoHotel.ocorrencia.tentativas', { n: item.tentativas }, item.tentativas),
              ].join(' · ')
            }}</span>
          </RouterLink>
          <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
        </li>
      </ul>
    </template>

    <Button
      v-if="pendencias.length"
      type="button"
      size="small"
      severity="secondary"
      outlined
      class="tn__mais"
      :icon="pendenciasAbertas ? 'ph ph-caret-up' : 'ph ph-caret-down'"
      :label="
        t('rotinaDoHotel.turno.pendencias', { n: pendencias.length }, pendencias.length) +
        (turno?.pendenciasTruncado ? '+' : '')
      "
      :aria-expanded="pendenciasAbertas"
      @click="pendenciasAbertas = !pendenciasAbertas"
    />
    <ul v-if="pendenciasAbertas" class="ui-lista">
      <li
        v-for="item in pendencias"
        :key="item.tarefaId"
        class="ui-linha"
        :class="{
          'ui-marca ui-marca--risco': item.situacao === 'atrasada' && item.medicacao,
          'ui-marca ui-marca--atencao': item.situacao === 'atrasada' && !item.medicacao,
        }"
      >
        <span class="ui-hora tn__hora">{{ quando(item.dia, item.hora) }}</span>
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo">{{
            `${t(`rotinaDoHotel.kind.${item.kind}`)} · ${item.pacienteNome}`
          }}</strong>
          <span class="ui-linha__meta">{{
            [
              item.acomodacaoNome,
              item.descricao,
              t(`rotinaDoHotel.turno.situacao.${item.situacao}`),
            ]
              .filter(Boolean)
              .join(' · ')
          }}</span>
        </span>
      </li>
    </ul>

    <template v-if="recebida">
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        class="tn__mais"
        :icon="recebidaAberta ? 'ph ph-caret-up' : 'ph ph-caret-down'"
        :label="deQuem"
        :aria-expanded="recebidaAberta"
        @click="recebidaAberta = !recebidaAberta"
      />
      <div v-if="recebidaAberta" class="tn__recebida">
        <p class="tn__nota-da-passagem">{{ recebida.nota }}</p>
        <ul v-if="recebida.pendencias.length" class="ui-lista">
          <li v-for="item in recebida.pendencias" :key="item.tarefaId" class="ui-linha">
            <span class="ui-hora tn__hora">{{ quando(item.dia, hora(item.previstaPara)) }}</span>
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ item.descricao }}</strong>
              <span class="ui-linha__meta">{{ statusAgora(item.statusAgora) }}</span>
            </span>
          </li>
        </ul>
      </div>
    </template>

    <PassagemDoHotelGaveta
      v-model:visible="passagemAberta"
      :turno="turno"
      :profissionais="profissionais"
      @entregue="entregue"
      @releu="carregar"
    />
  </section>
</template>

<style scoped>
/* As ações do turno embaixo do título: a coluna é estreita e a frase do turno precisa da largura. */
.tn__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 10px 12px;
}

.tn__nota {
  margin: 0;
  padding: 0 10px 12px;
}

.tn__trava {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 4px 10px 6px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.tn__trava i {
  margin-top: 2px;
  color: var(--risco-tinta);
  font-size: 16px;
}

.tn__link {
  color: inherit;
  text-decoration: none;
}

.tn__hora {
  min-width: 4.6rem;
}

.tn__mais {
  justify-self: start;
  margin: 2px 4px 6px;
}

.tn__recebida {
  display: grid;
  gap: 8px;
  padding: 0 10px 12px;
}

.tn__nota-da-passagem {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
}
</style>
