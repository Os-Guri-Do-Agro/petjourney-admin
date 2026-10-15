<script setup lang="ts">
/**
 * Uma linha da caixa de pedidos: para quando, quem, o quê — e a resposta a um clique.
 *
 * A linha tem o que decide a triagem, e só isso. A folhinha à esquerda responde "para quando?"
 * antes de qualquer leitura; depois vêm o pet e quem pede, o serviço e com quem, o prazo e os
 * botões. A queixa, o histórico liberado, o telefone de quem veio pelo link e a escolha de outro
 * horário moram na gaveta que "Responder" abre — a versão anterior empilhava cinco linhas de ícone
 * e texto por pedido e três botões, e a caixa virava parede.
 *
 * A ação cheia é o próximo passo natural, e ela muda com o caso: "Aceitar" quando o horário
 * escolhido continua livre; "Marcar 13:00" quando a clínica precisa escolher — o melhor horário,
 * ou a alternativa ao escolhido que sumiu. Assim a pessoa nunca aceita às cegas um horário que já
 * não existe: o botão diz o horário que vai gravar.
 *
 * A urgência mora no ícone, não na superfície: o horário que sumiu aparece riscado na folha e com
 * o ícone de atenção na coluna do pedido; o prazo que vence muda a tinta do relógio.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useRotulosDoPedido } from '../../composables/useRotulosDoPedido'
import type { PedidoNaCaixa } from '../../data/agendamento-online'
import { aparenciaDoTipo } from '../../domain/appointment-kind'
import { situacaoDoPrazo, TIPO_DO_MOTIVO } from '../../domain/pedidos'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

import FolhaDoDia from './FolhaDoDia.vue'

const props = defineProps<{
  linha: PedidoNaCaixa
  respondendo: boolean
  /** Outra linha está sendo respondida: os botões desta esperam. */
  ocupado: boolean
  /** A gaveta está aberta nesta linha. */
  aberta: boolean
}>()

const emit = defineEmits<{
  aceitar: [escolha: { professionalId: string; inicio: string } | null]
  abrir: []
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const rotulos = useRotulosDoPedido()

const primeiro = computed(() => props.linha.pedidos[0]!)
const tipo = computed(() => clinico.tipo(primeiro.value.typeId))
const aparencia = computed(() => aparenciaDoTipo(tipo.value?.kind))

/** Cada pet do grupo, com o que a clínica sabe dele — ou o que o cadastro mínimo trouxe. */
const pets = computed(() =>
  props.linha.pedidos.map((pedido) => {
    const pet = pedido.petId ? clinico.pet(pedido.petId) : null
    const nome = pet?.nome ?? pedido.novoCadastro?.petNome ?? ''

    return {
      id: pedido.id,
      nome,
      iniciais: pet?.iniciais ?? nome.slice(0, 2).toUpperCase(),
      especie: pet?.especie ?? pedido.novoCadastro?.especie ?? null,
      fotoUrl: pet?.fotoUrl ?? '',
    }
  }),
)

const nomeDoResponsavel = computed(() => {
  const tutor = primeiro.value.tutorId ? clinico.tutor(primeiro.value.tutorId) : null

  return tutor?.nome ?? primeiro.value.novoCadastro?.nome ?? ''
})

/** Primeira vez: o pet não está no cadastro da clínica — veio do link, ou do app sem vínculo. */
const primeiraVez = computed(() =>
  props.linha.pedidos.some(
    (pedido) => pedido.novoCadastro !== null && !(pedido.petId && clinico.pet(pedido.petId)),
  ),
)

const escolheu = computed(() => primeiro.value.modo === 'horario-escolhido')

/** A folhinha: o dia escolhido com a hora, ou a janela em que pode com o período. */
const folha = computed(() => {
  const pedido = primeiro.value

  if (escolheu.value && pedido.inicio) {
    const hora = formato.hora(pedido.inicio)

    return {
      dia: clinicClock.dateOf(pedido.inicio),
      ate: null,
      rodape: props.linha.pedidos.length > 1 ? `${hora} +${props.linha.pedidos.length - 1}` : hora,
      riscada: !props.linha.horarioLivre,
    }
  }

  if (pedido.preferencia) {
    const periodos = pedido.preferencia.periodos

    return {
      dia: pedido.preferencia.de,
      ate: pedido.preferencia.ate,
      rodape:
        periodos.length === 1
          ? t(`clinico.pedidos.periodoTitulo.${periodos[0]}`)
          : t('clinico.pedidos.linha.qualquerHora'),
      riscada: false,
    }
  }

  return null
})

/** Com quem: o profissional escolhido, o preferido na janela, ou qualquer um. */
const comQuem = computed(() => {
  const pedido = primeiro.value
  const id = escolheu.value ? pedido.professionalId : (pedido.preferencia?.professionalId ?? null)

  return id
    ? t('clinico.pedidos.comProfissional', { nome: clinico.profissional(id)?.nome ?? '' })
    : t('clinico.pedidos.qualquerProfissional')
})

const sugestao = computed(() => props.linha.sugestao)

const prazo = computed(() => situacaoDoPrazo(primeiro.value, clinicClock.nowIso()))

const fraseDoPrazo = computed(() => {
  const ate = primeiro.value.responderAte

  if (prazo.value === 'atrasado') {
    return t('clinico.pedidos.prazo.atrasado', { valor: formato.relativo(ate) })
  }

  /* Prazo de outro dia diz o dia: "até 08:26" lido às 18h parece daqui a pouco. */
  const hoje = clinicClock.dateOf(ate) === clinicClock.today()

  return t('clinico.pedidos.linha.ate', {
    quando: hoje ? formato.hora(ate) : rotulos.quando(ate),
  })
})

/** O botão cheio: aceita o escolhido, ou marca o melhor horário que a clínica tem. */
const acaoPrincipal = computed(() => {
  if (props.linha.horarioLivre) {
    return { rotulo: t('clinico.pedidos.aceitar'), escolha: null }
  }

  if (sugestao.value) {
    return {
      rotulo: t('clinico.pedidos.marcarEm', { hora: formato.hora(sugestao.value.inicio) }),
      escolha: { professionalId: sugestao.value.professionalId, inicio: sugestao.value.inicio },
    }
  }

  return null
})

const rotuloDoCanal = computed(() => t(`clinico.pedidos.canal.${primeiro.value.canal}`))
</script>

<template>
  <li
    class="pedido"
    :class="{ 'pedido--respondendo': respondendo, 'pedido--aberta': aberta }"
    :aria-busy="respondendo"
    @click="emit('abrir')"
  >
    <FolhaDoDia
      v-if="folha"
      class="pedido__folha"
      :dia="folha.dia"
      :ate="folha.ate"
      :rodape="folha.rodape"
      :riscada="folha.riscada"
    />

    <!-- Quem -->
    <div class="pedido__quem">
      <span class="pedido__rostos" :class="{ 'pedido__rostos--grupo': pets.length > 1 }">
        <PetAvatar
          v-for="pet in pets"
          :key="pet.id"
          :nome="pet.nome"
          :iniciais="pet.iniciais"
          :especie="pet.especie"
          :foto-url="pet.fotoUrl"
          tamanho="sm"
        />
      </span>

      <span class="pedido__identidade">
        <span class="pedido__nomes">
          <strong>{{ rotulos.nomes(pets.map((pet) => pet.nome)) }}</strong>
          <span v-if="primeiraVez" class="pedido__selo">
            <i class="ph ph-sparkle" aria-hidden="true" />
            {{ t('clinico.pedidos.primeiraVez') }}
          </span>
        </span>
        <span class="pedido__meta">
          <i
            class="ph"
            :class="primeiro.canal === 'app' ? 'ph-device-mobile' : 'ph-globe-simple'"
            :title="rotuloDoCanal"
            aria-hidden="true"
          />
          <span class="sr-only">{{ rotuloDoCanal }}:</span>
          <span class="pedido__responsavel">{{ nomeDoResponsavel }}</span>
        </span>
      </span>
    </div>

    <!-- O pedido -->
    <div class="pedido__oque">
      <span class="pedido__servico">
        <i
          v-if="aparencia.icone"
          :class="['pedido__tipo', aparencia.icone]"
          :style="{ color: aparencia.cor }"
          aria-hidden="true"
        />
        <strong>{{ tipo?.nome }}</strong>
        <!-- O motivo só quando diz mais que o serviço: "Consulta · Sintoma", nunca "Retorno · Retorno". -->
        <span v-if="TIPO_DO_MOTIVO[primeiro.motivo] === 'consulta'" class="pedido__motivo">
          · {{ t(`clinico.pedidos.motivo.${primeiro.motivo}`) }}
        </span>
        <i
          v-if="primeiro.remarcaAppointmentId"
          class="ph ph-arrows-clockwise pedido__remarca"
          :title="t('clinico.pedidos.remarcacao')"
          :aria-label="t('clinico.pedidos.remarcacao')"
        />
      </span>

      <!-- O horário que sumiu: o ícone de atenção no lugar de "com quem". O botão já oferece outro. -->
      <span v-if="escolheu && !linha.horarioLivre" class="pedido__detalhe pedido__detalhe--atencao">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t('clinico.pedidos.linha.ocupado') }}
      </span>
      <span v-else-if="!escolheu && !sugestao" class="pedido__detalhe pedido__detalhe--atencao">
        <i class="ph ph-calendar-x" aria-hidden="true" />
        {{ t('clinico.pedidos.semSugestao') }}
      </span>
      <span v-else class="pedido__detalhe">{{ comQuem }}</span>
    </div>

    <!-- A resposta -->
    <p class="pedido__prazo" :class="`pedido__prazo--${prazo}`">
      <i
        class="ph"
        :class="prazo === 'no-prazo' ? 'ph-clock' : 'ph-clock-countdown'"
        aria-hidden="true"
      />
      {{ fraseDoPrazo }}
    </p>

    <div class="pedido__botoes">
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('clinico.pedidos.linha.responder')"
        :aria-expanded="aberta"
        :disabled="ocupado && !aberta"
        @click.stop="emit('abrir')"
      />
      <Button
        v-if="acaoPrincipal"
        type="button"
        size="small"
        icon="ph ph-check"
        :label="acaoPrincipal.rotulo"
        :loading="respondendo"
        :disabled="ocupado && !respondendo"
        @click.stop="emit('aceitar', acaoPrincipal.escolha)"
      />
    </div>
  </li>
</template>

<style scoped>
.pedido {
  display: grid;
  align-items: center;
  margin-inline: -0.75rem;
  padding: 0.8rem 0.75rem;
  border-radius: 0.8rem;
  gap: 0.5rem 1.25rem;
  /* Larguras fixas no prazo e nos botões: cada linha é uma grade própria, e colunas medidas pelo
     conteúdo desalinhavam "Retorno" e "Consulta" de uma linha para a outra. */
  grid-template-columns: 4.25rem minmax(0, 1.1fr) minmax(0, 1fr) 10.75rem 14.5rem;
  cursor: pointer;
  transition: background-color 150ms ease-out;
}

.pedido + .pedido {
  box-shadow: 0 -1px 0 var(--hc-linha);
}

.pedido:hover {
  background: color-mix(in srgb, var(--hc-marca-clara) 45%, transparent);
}

/* A linha que está na gaveta: tingida, para o olho voltar a ela ao fechar. */
.pedido--aberta,
.pedido--aberta:hover {
  background: var(--hc-marca-clara);
  box-shadow: none;
}

.pedido--aberta + .pedido {
  box-shadow: none;
}

.pedido--respondendo {
  opacity: 0.6;
}

/* ------------------------------------------------------------------ quem */

.pedido__quem {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.pedido__rostos {
  display: inline-flex;
  flex: 0 0 auto;
}

/* Dois pets da mesma casa: os rostos se sobrepõem, como uma ficha só. */
.pedido__rostos--grupo > * + * {
  margin-inline-start: -0.6rem;
  box-shadow: 0 0 0 2px var(--hc-cartao);
  border-radius: 50%;
}

.pedido__identidade,
.pedido__oque {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.pedido__nomes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.45rem;
}

.pedido__nomes strong {
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  font-weight: 700;
}

.pedido__selo {
  display: inline-flex;
  align-items: center;
  padding: 0.05rem 0.45rem;
  border-radius: 6px;
  gap: 0.25rem;
  /* Ciano: "cliente novo" é categoria própria — o lilás da casa é o do que a máquina propôs. */
  background: var(--hc-ciano-fundo);
  color: var(--hc-ciano-tinta);
  font-size: 0.6875rem;
  font-weight: 700;
}

.pedido__meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.pedido__meta > i {
  flex: 0 0 auto;
  color: var(--hc-tinta-3);
}

.pedido__responsavel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ o pedido */

.pedido__servico {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
  font-size: 0.875rem;
}

.pedido__servico strong {
  color: var(--hc-tinta);
  font-weight: 650;
}

.pedido__motivo {
  color: var(--hc-tinta-2);
}

.pedido__remarca {
  color: var(--hc-tinta-3);
}

.pedido__detalhe {
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pedido__detalhe--atencao {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-attention-text);
  font-weight: 650;
}

/* ------------------------------------------------------------------ resposta */

.pedido__prazo {
  display: inline-flex;
  align-items: center;
  margin: 0;
  gap: 0.35rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.pedido__prazo--vencendo i {
  color: var(--clinic-attention-text);
}

.pedido__prazo--atrasado {
  color: var(--clinic-risk-text);
}

.pedido__botoes {
  display: flex;
  justify-content: flex-end;
  gap: 0.4rem;
}

/*
 * Pela largura da lista, não da janela: com a gaveta aberta a página perde 30 rem, e uma linha
 * medida pela janela continuava em cinco colunas espremidas. O pedido desce para baixo de quem, e
 * a resposta para baixo dos dois — a folha fica à esquerda, ocupando a altura.
 */
@container (max-width: 60rem) {
  .pedido {
    align-items: start;
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .pedido__folha {
    grid-row: span 2;
  }

  .pedido__oque {
    grid-column: 2;
  }

  .pedido__prazo {
    grid-column: 3;
    grid-row: 1;
    justify-self: end;
  }

  .pedido__botoes {
    grid-column: 3;
    grid-row: 2;
    align-self: end;
  }
}

@container (max-width: 34rem) {
  .pedido {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .pedido__folha {
    grid-row: span 3;
  }

  .pedido__prazo,
  .pedido__botoes {
    grid-column: 2;
    grid-row: auto;
    justify-self: start;
  }
}

@media (pointer: coarse) {
  .pedido__botoes :deep(.p-button) {
    min-height: 2.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pedido {
    transition: none;
  }
}
</style>
