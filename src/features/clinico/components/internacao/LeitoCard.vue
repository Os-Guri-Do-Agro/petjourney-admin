<script setup lang="ts">
/**
 * Um leito no mapa.
 *
 * O cartão vazio é tão importante quanto o ocupado, e por isso ocupa o mesmo espaço: o mapa
 * responde "onde há vaga", e uma grade em que os livres encolhem obriga a contar em vez de
 * olhar. O leito fora de operação fica visível e apagado pela mesma razão — some da conta de
 * vagas sem sumir do lugar, para que quem lê o mapa por posição não perca a referência.
 *
 * A informação numérica do cartão é escolhida a dedo: **o que cobra ação agora** e **quanto
 * falta para a próxima**. Peso, diagnóstico e previsão de alta cabem na tela do paciente; num
 * cartão de mapa eles disputariam espaço com a única linha que decide para onde a enfermagem
 * anda em seguida.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import InternacaoGravidade from './InternacaoGravidade.vue'
import type { LeitoNoMapa } from '../../data/repositories'

const props = defineProps<{ item: LeitoNoMapa }>()

const emit = defineEmits<{
  abrir: [internacaoId: string]
  internar: [leitoId: string]
}>()

const { t } = useI18n()

const ocupado = computed(() => props.item.internacao !== null)
const indisponivel = computed(() => !props.item.leito.ativo)

/**
 * O tom do cartão sai da urgência, não da gravidade.
 *
 * Um paciente crítico com tudo em dia não precisa piscar; um estável com duas doses atrasadas
 * precisa. Pintar por gravidade deixaria o mapa vermelho no lugar onde nada há para fazer, e
 * silencioso onde há.
 */
const tom = computed(() => {
  if (!ocupado.value) {
    return indisponivel.value ? 'inativo' : 'livre'
  }

  if (props.item.atrasadas > 0) {
    return 'atrasado'
  }

  return props.item.pendentes > 0 ? 'pendente' : 'ocupado'
})

const proxima = computed(() => {
  const minutos = props.item.proximaEmMinutos

  if (minutos === null) {
    return ''
  }

  return minutos < 60
    ? t('clinico.internacao.leito.proximaMinutos', { minutos })
    : t('clinico.internacao.leito.proximaHoras', { horas: Math.round(minutos / 60) })
})
</script>

<template>
  <article class="leito" :class="[`leito--${tom}`, { 'leito--clicavel': ocupado }]">
    <header class="leito__topo">
      <span class="leito__nome clinic-value">{{ item.leito.nome }}</span>
      <span class="leito__kind">{{ t(`clinico.internacao.leitoKind.${item.leito.kind}`) }}</span>
    </header>

    <template v-if="item.internacao">
      <!--
        O botão é o nome do paciente, mas o **alvo do clique é o cartão inteiro**: o `::after`
        dele se estende por toda a superfície (ver o CSS). Continua sendo um `<button>` de
        verdade — teclado, foco e leitor de tela nativos, com o nome do paciente como rótulo —
        em vez de um `role="button"` no `<article>`, que leria o cartão inteiro em voz alta,
        números e selos incluídos, para dizer "abrir o Bento".
      -->
      <button
        type="button"
        class="leito__paciente"
        @click="emit('abrir', item.internacao.id)"
      >
        <span class="leito__iniciais" aria-hidden="true">{{ item.petIniciais }}</span>
        <span class="leito__identidade">
          <strong class="leito__pet">{{ item.petNome }}</strong>
          <span class="leito__motivo">{{ item.internacao.motivo }}</span>
        </span>
      </button>

      <!--
        O chip precisa caber no próprio texto. Como filho direto de uma coluna flex ele era
        esticado à largura do cartão e virava uma faixa — e uma faixa de fundo colorido lê como
        alerta do cartão inteiro, não como o estado do paciente.
      -->
      <InternacaoGravidade class="leito__gravidade" :gravidade="item.internacao.gravidade" />

      <dl class="leito__numeros">
        <div>
          <dt>{{ t('clinico.internacao.leito.internadoHa') }}</dt>
          <dd class="clinic-value">
            {{ t('clinico.internacao.leito.horas', { horas: item.horasInternado }) }}
          </dd>
        </div>
        <div>
          <dt>{{ t('clinico.internacao.leito.pendentes') }}</dt>
          <dd class="clinic-value">{{ item.pendentes }}</dd>
        </div>
      </dl>

      <!--
        O atraso é um **selo**, não uma faixa na borda: ícone, forma e texto, três canais que
        sobrevivem à escala de cinza e à impressão. A faixa lateral dizia a mesma coisa só pela
        cor e pelo lado do cartão.
      -->
      <p v-if="item.atrasadas > 0" class="leito__selo">
        <i class="pi pi-exclamation-circle" aria-hidden="true" />
        {{ t('clinico.internacao.leito.atrasadas', { total: item.atrasadas }) }}
      </p>

      <p v-if="proxima" class="leito__proxima">{{ proxima }}</p>
    </template>

    <template v-else>
      <p class="leito__vazio">
        {{
          indisponivel
            ? t('clinico.internacao.leito.foraDeOperacao')
            : t('clinico.internacao.leito.livre')
        }}
      </p>

      <Button
        v-if="!indisponivel"
        class="leito__internar"
        :label="t('clinico.internacao.leito.internar')"
        icon="pi pi-plus"
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
  /* Âncora do alvo estendido do botão do paciente. */
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 12.5rem;
  flex-direction: column;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

/*
 * O cartão ocupado inteiro abre o paciente.
 *
 * Alvo de nome e avatar era uma mira de 2 cm num cartão de 15: quem clicava no motivo, no número
 * de pendências ou no espaço vazio não ia a lugar nenhum, e nada na tela dizia por quê. O cartão
 * de leito tem um destino só — não há segunda ação disputando a superfície —, então a superfície
 * inteira é o botão.
 *
 * O leito **livre** fica de fora de propósito: ali a ação é internar alguém, e abrir um formulário
 * porque o dedo encostou no cartão vazio é o tipo de surpresa que ensina a ter medo da tela.
 */
.leito--clicavel {
  cursor: pointer;
}

.leito--clicavel:hover {
  background: var(--clinic-surface-soft);
}

/*
 * A urgência contorna o cartão inteiro, e não um dos lados dele.
 *
 * Fundo colorido derruba o contraste do texto clínico que vive dentro do cartão, então o estado
 * fica na moldura. Em anel — e não em faixa à esquerda — porque a faixa lateral marca o cartão
 * por uma aresta só: some quando a grade quebra em coluna única e some de novo em qualquer
 * leitura que não seja da esquerda para a direita. O anel é a mesma informação sem direção.
 *
 * A escada é de três degraus e cada um sobe um canal, não só o tom: ocupado tranquilo fica com a
 * moldura padrão, pendente troca a cor da moldura, atrasado ganha o anel **e** o selo com ícone.
 */
.leito--atrasado {
  border-color: var(--clinic-risk-line);
  box-shadow:
    0 0 0 2px var(--clinic-risk-text),
    var(--clinic-shadow-card);
}

/*
 * O degrau do meio também é um anel — só que em areia, e sem selo.
 *
 * Trocar apenas a cor da moldura de 1px não se enxerga: contra a linha padrão do cartão a
 * diferença é de dois por cento de luminância, e num mapa de oito leitos o cartão com duas doses
 * pendentes ficava idêntico ao que não tem nada para fazer. Mesmo desenho do atraso, um tom
 * abaixo: a escada continua legível e a hierarquia entre os dois permanece óbvia.
 */
.leito--pendente {
  border-color: var(--clinic-attention-line);
  box-shadow:
    0 0 0 2px var(--clinic-attention-line),
    var(--clinic-shadow-card);
}

.leito--livre {
  border-style: dashed;
  background: var(--clinic-surface-soft);
  box-shadow: none;
}

.leito--inativo {
  border-style: dashed;
  background: var(--clinic-surface-sunken);
  box-shadow: none;
  opacity: 0.65;
}

.leito__topo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.leito__nome {
  font-size: var(--clinic-font-title);
  font-weight: 750;
}

.leito__kind {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.leito__paciente {
  display: flex;
  min-width: 0;
  align-items: center;
  padding: 0;
  border: 0;
  gap: var(--clinic-space-3);
  background: none;
  cursor: pointer;
  text-align: start;
}

/*
 * O `::after` estende o botão por todo o cartão.
 *
 * É o que transforma a superfície inteira em alvo sem duplicar o `@click` no `<article>` — dois
 * manipuladores na mesma pilha disparariam duas vezes no clique sobre o nome.
 */
.leito__paciente::after {
  position: absolute;
  border-radius: var(--clinic-radius-card);
  content: '';
  inset: 0;
}

.leito__paciente:focus-visible {
  outline: none;
}

/* O foco contorna o cartão, que é o que o clique de fato aciona — não só o nome. */
.leito__paciente:focus-visible::after {
  box-shadow: var(--clinic-focus-ring);
}

.leito__iniciais {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  place-items: center;
}

.leito__identidade {
  display: grid;
  min-width: 0;
  gap: 0.1rem;
}

.leito__pet {
  overflow-wrap: anywhere;
  color: var(--clinic-text);
  font-size: var(--clinic-font-body);
  font-weight: 700;
  line-height: 1.25;
}

.leito__motivo {
  display: -webkit-box;
  overflow: hidden;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.leito__gravidade {
  align-self: flex-start;
}

.leito__numeros {
  display: flex;
  margin: auto 0 0;
  gap: var(--clinic-space-4);
}

.leito__numeros dt {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.leito__numeros dd {
  margin: 0;
  font-weight: 700;
}

.leito__selo {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  margin: 0;
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--clinic-risk-line);
  border-radius: var(--clinic-radius-chip);
  gap: var(--clinic-space-1);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.leito__selo i {
  font-size: 0.7rem;
}

.leito__proxima {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.leito__vazio {
  margin: auto 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-align: center;
}

.leito__internar {
  align-self: center;
}
</style>
