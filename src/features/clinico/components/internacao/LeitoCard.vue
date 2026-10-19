<script setup lang="ts">
/**
 * Um leito na planta da ala.
 *
 * O ladrilho vazio é tão importante quanto o ocupado, e por isso ocupa o mesmo espaço: a planta
 * responde "onde há vaga", e uma grade em que os livres encolhem obriga a contar em vez de olhar.
 * O leito fora de operação fica no lugar, hachurado e calado, pela mesma razão — some da conta de
 * vagas sem sumir da planta, para que quem lê por posição não perca a referência.
 *
 * ## O ocupado
 *
 * Rosto, nome e o motivo curto, e embaixo dois números com legenda (como o "46 min esperando" do
 * Hoje): **há quanto tempo está internado** e **o que o checklist cobra** — quantos itens a fazer
 * agora ou quanto falta para o próximo. A gravidade aparece como selo com palavra e como marca na
 * borda esquerda; o crítico ganha também a borda tingida, para ser achado de longe.
 *
 * O que cobra alguém (atraso e boletim retido) vem em selo, com ícone e palavra: são dois pedidos
 * diferentes — o atraso chama a enfermagem; o boletim, alguém ao telefone.
 *
 * O ladrilho inteiro abre o paciente: o alvo é o botão com o nome, estendido por um `::after`
 * sobre toda a superfície. Continua sendo um botão de verdade (teclado, foco e leitor de tela),
 * em vez de um `role="button"` no `<article>`.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import InternacaoGravidade from './InternacaoGravidade.vue'
import type { LeitoNoMapa } from '../../data/repositories'
import type { GravidadeClinica } from '../../data/types'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{ item: LeitoNoMapa }>()

const emit = defineEmits<{
  abrir: [internacaoId: string]
  internar: [leitoId: string]
}>()

const { t } = useI18n()
const clinico = useClinicoStore()

const ocupado = computed(() => props.item.internacao !== null)
const indisponivel = computed(() => !props.item.leito.ativo)

const pet = computed(() =>
  props.item.internacao ? clinico.pet(props.item.internacao.petId) : null,
)

/** A marca da borda na cor da gravidade: verde, âmbar, vermelho. */
const MARCA: Record<GravidadeClinica, 'ok' | 'atencao' | 'risco'> = {
  estavel: 'ok',
  atencao: 'atencao',
  critico: 'risco',
}

const estado = computed(() => {
  if (ocupado.value) {
    return 'ocupado'
  }

  return indisponivel.value ? 'inativo' : 'livre'
})

/**
 * O segundo número do ladrilho: o que o checklist cobra.
 *
 * Havendo item na hora (ou atrasado), é quantos — a enfermagem anda para esse leito. Não havendo,
 * é quanto falta para o próximo, que é o que decide a ordem da ronda.
 */
const checklist = computed(() => {
  if (!props.item.internacao) {
    return null
  }

  if (props.item.pendentes > 0) {
    return {
      valor: String(props.item.pendentes),
      legenda: t('clinico.internacao.nova.leito.aFazerAgora'),
      tom: props.item.atrasadas > 0 ? 'risco' : 'atencao',
    }
  }

  const minutos = props.item.proximaEmMinutos

  if (minutos === null) {
    return null
  }

  return {
    valor:
      minutos < 60
        ? t('clinico.formato.minutos', { valor: minutos })
        : t('clinico.formato.horas', { valor: Math.round(minutos / 60) }),
    legenda: t('clinico.internacao.nova.leito.ateOProximo'),
    tom: 'neutro',
  }
})

const motivoInativo = computed(() =>
  t(`clinico.internacao.leitos.motivo.${props.item.leito.motivoInativo ?? 'outro'}`),
)
</script>

<template>
  <article
    class="leito"
    :class="[
      `leito--${estado}`,
      item.internacao ? ['ui-marca', `ui-marca--${MARCA[item.internacao.gravidade]}`] : [],
      item.internacao ? `leito--${item.internacao.gravidade}` : '',
      { 'leito--clicavel': ocupado },
    ]"
  >
    <header class="leito__topo">
      <span class="leito__nome ui-num">{{ item.leito.nome }}</span>
      <InternacaoGravidade v-if="item.internacao" :gravidade="item.internacao.gravidade" />
      <span v-else-if="!indisponivel" class="leito__estado">
        {{ t('clinico.internacao.leito.livre') }}
      </span>
    </header>

    <template v-if="item.internacao">
      <button type="button" class="leito__paciente" @click="emit('abrir', item.internacao.id)">
        <PetAvatar
          class="leito__avatar"
          :nome="item.petNome"
          :iniciais="item.petIniciais"
          :especie="pet?.especie ?? null"
          :foto-url="pet?.fotoUrl ?? ''"
          tamanho="md"
        />
        <span class="leito__identidade">
          <strong class="leito__pet">{{ item.petNome }}</strong>
          <span class="leito__motivo">{{ item.internacao.motivo }}</span>
        </span>
      </button>

      <p v-if="item.atrasadas > 0 || item.boletimRetido" class="leito__cobrancas">
        <span v-if="item.boletimRetido" class="ui-selo ui-selo--risco leito__selo-forte">
          <i class="ph ph-phone" aria-hidden="true" />
          {{ t('clinico.internacao.leito.boletimRetido') }}
        </span>
        <span v-if="item.atrasadas > 0" class="ui-selo ui-selo--risco">
          <i class="ph ph-clock-countdown" aria-hidden="true" />
          {{ t('clinico.internacao.leito.atrasadas', { total: item.atrasadas }, item.atrasadas) }}
        </span>
      </p>

      <div class="leito__numeros">
        <p class="numero">
          <strong class="ui-num">
            {{ t('clinico.internacao.leito.horas', { horas: item.horasInternado }) }}
          </strong>
          <small>{{ t('clinico.internacao.nova.leito.deInternacao') }}</small>
        </p>
        <p v-if="checklist" class="numero numero--fim" :class="`numero--${checklist.tom}`">
          <strong class="ui-num">{{ checklist.valor }}</strong>
          <small>{{ checklist.legenda }}</small>
        </p>
      </div>
    </template>

    <template v-else-if="indisponivel">
      <p class="leito__parado">
        <i class="ph ph-wrench" aria-hidden="true" />
        <span>
          <strong>{{ t('clinico.internacao.leito.foraDeOperacao') }}</strong>
          <small :title="item.leito.detalheInativo || undefined">{{ motivoInativo }}</small>
        </span>
      </p>
    </template>

    <template v-else>
      <p class="leito__vago" aria-hidden="true">
        <i class="ph ph-bed" />
      </p>

      <Button
        type="button"
        class="leito__internar"
        :label="t('clinico.internacao.leito.internar')"
        icon="ph ph-plus"
        severity="secondary"
        outlined
        size="small"
        @click="emit('internar', item.leito.id)"
      />
    </template>
  </article>
</template>

<style scoped>
.leito {
  /* Âncora do alvo estendido do botão do paciente e da marca de gravidade. */
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 196px;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px 14px 18px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  color: var(--tinta);
  transition:
    border-color var(--pj-tempo-curto) ease,
    box-shadow var(--pj-tempo-curto) ease,
    transform var(--pj-tempo-curto) var(--pj-curva-chega);
}

/*
 * O ocupado inteiro abre o paciente: ele sobe um pouco no hover, como coisa que se pega. O livre
 * fica parado de propósito — ali a ação é internar alguém, e abrir um formulário porque o dedo
 * encostou no ladrilho vazio é o tipo de surpresa que ensina a ter medo da tela.
 */
.leito--clicavel {
  cursor: pointer;
}

.leito--clicavel:hover {
  border-color: var(--linha-forte);
  box-shadow: var(--sombra-2);
  transform: translateY(-1px);
}

/* O crítico se acha de longe: borda tingida, além da marca e do selo. */
.leito--critico {
  border-color: color-mix(in oklab, var(--risco) 55%, var(--linha));
}

.leito--critico.leito--clicavel:hover {
  border-color: var(--risco);
}

.leito--livre,
.leito--inativo {
  border-style: dashed;
  border-color: var(--linha-forte);
  background: transparent;
}

.leito--livre {
  border-color: color-mix(in oklab, var(--linha-forte) 60%, transparent);
}

/* Fora de operação: hachurado e calado, mas no lugar. */
.leito--inativo {
  border-color: var(--linha);
  background: repeating-linear-gradient(
    -45deg,
    transparent 0 9px,
    color-mix(in oklab, var(--linha) 70%, transparent) 9px 10px
  );
}

/* ----------------------------------------------------------------- topo */

.leito__topo {
  display: flex;
  min-height: 24px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.leito__nome {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.005em;
}

.leito--livre .leito__nome,
.leito--inativo .leito__nome {
  color: var(--tinta-2);
}

.leito__estado {
  color: var(--ok-tinta);
  font-size: 13px;
  font-weight: 600;
}

/* ----------------------------------------------------------------- paciente */

.leito__paciente {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
}

/*
 * O `::after` estende o botão por todo o ladrilho — a superfície inteira vira alvo sem duplicar o
 * `@click` no `<article>`, que dispararia duas vezes no clique sobre o nome.
 */
.leito__paciente::after {
  position: absolute;
  border-radius: 14px;
  content: '';
  inset: 0;
}

.leito__paciente:focus-visible {
  outline: none;
}

/* O foco contorna o ladrilho, que é o que o clique de fato aciona — não só o nome. */
.leito__paciente:focus-visible::after {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.leito__avatar {
  flex: none;
}

.leito__identidade {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.leito__pet {
  overflow-wrap: anywhere;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
}

.leito__motivo {
  display: -webkit-box;
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

/* ----------------------------------------------------------------- cobranças */

.leito__cobrancas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}

.leito__cobrancas .ui-selo {
  max-width: 100%;
  white-space: normal;
}

/* O boletim é o selo cheio: há uma pessoa do outro lado esperando um telefonema. */
.leito__selo-forte.ui-selo {
  background: var(--risco-tinta);
  color: var(--superficie);
}

/* ----------------------------------------------------------------- números */

.leito__numeros {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--linha);
}

.numero {
  display: grid;
  margin: 0;
  line-height: 1.1;
}

.numero--fim {
  justify-items: end;
  text-align: end;
}

.numero strong {
  color: var(--tinta);
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.numero small {
  margin-top: 3px;
  color: var(--tinta-2);
  font-size: 12px;
}

.numero--atencao strong {
  color: var(--atencao-tinta);
}

.numero--risco strong,
.numero--risco small {
  color: var(--risco-tinta);
}

/* ----------------------------------------------------------------- livre e parado */

.leito__vago {
  display: grid;
  flex: 1;
  margin: 0;
  place-items: center;
  color: var(--tinta-3);
  font-size: 30px;
  opacity: 0.55;
}

.leito__internar {
  align-self: stretch;
}

.leito__parado {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0;
  color: var(--tinta-2);
  text-align: start;
}

.leito__parado > i {
  font-size: 20px;
}

.leito__parado span {
  display: grid;
  gap: 2px;
}

.leito__parado strong {
  font-size: 14px;
  font-weight: 600;
}

.leito__parado small {
  font-size: 12.5px;
}

/* Estreito, um ladrilho por linha: o vazio não precisa da altura do ocupado para ser visto. */
@media (width <= 640px) {
  .leito--livre,
  .leito--inativo {
    min-height: 132px;
  }

  .leito__vago {
    display: none;
  }

  .leito--livre .leito__internar {
    margin-top: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .leito {
    transition: none;
  }

  .leito--clicavel:hover {
    transform: none;
  }
}
</style>
