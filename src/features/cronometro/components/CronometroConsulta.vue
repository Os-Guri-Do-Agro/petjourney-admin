<script setup lang="ts">
/**
 * Cronômetro de atendimento no cabeçalho.
 *
 * Fica fixo porque é onde ele precisa estar: quem cobra por tempo alterna entre anamnese,
 * bulário e agenda durante o mesmo atendimento, e um relógio que só existe numa das telas é um
 * relógio que alguém esquece de parar. No cabeçalho ele atravessa a navegação inteira.
 *
 * A leitura tem duas linhas de propósito, e a ordem importa:
 *
 * - **O tempo decorrido vem primeiro, cru, com segundos.** É o número que a pessoa consegue
 *   justificar para o responsável. Segundo aparece porque a virada de unidade acontece num
 *   segundo específico, e ver a virada chegando é metade da razão de o cronômetro existir.
 * - **A unidade faturável vem ao lado, nunca no lugar.** Mostrar só "2 unidades" esconde que
 *   foram dezesseis minutos, e é assim que arredondar para cima deixa de ser regra e vira
 *   abuso.
 *
 * A cor muda uma vez só, no fim do bloco contratado — e junto com ela muda o texto. Um aviso
 * que só existe em cor não sobrevive a quem não distingue âmbar de verde, nem à sala mal
 * iluminada em que metade destes atendimentos acontece.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAgora } from '@/composables/useAgora'

import {
  BLOCOS_MINUTOS,
  formatarDuracao,
  INCREMENTOS_MINUTOS,
  medirSessao,
  totalDecorridoMs,
  totalDeMinutosCobraveis,
} from '../domain/cronometro'
import { useCronometroStore } from '../stores/cronometro'

const { t } = useI18n()
const cronometro = useCronometroStore()

/** Um tique por segundo: é a menor unidade que a tela mostra. */
const agora = useAgora(1000)

const painelAberto = ref(false)
const raiz = ref<HTMLElement | null>(null)

const medicao = computed(() =>
  cronometro.sessao ? medirSessao(cronometro.sessao, agora.value) : null,
)

const rodando = computed(() => medicao.value?.correndo ?? false)
const pausado = computed(() => Boolean(cronometro.sessao) && !rodando.value)

const relogio = computed(() => formatarDuracao(medicao.value?.decorridoMs ?? 0))

const estado = computed(() => medicao.value?.estado ?? 'dentro')

const rotuloDoEstado = computed(() => {
  if (!cronometro.sessao) {
    return t('cronometro.semSessao')
  }

  if (pausado.value) {
    return t('cronometro.pausado')
  }

  return t(`cronometro.estado.${estado.value}`)
})

/** Nome do paciente quando a tela informou um; senão, o rótulo genérico. */
const alvo = computed(() => cronometro.sessao?.rotulo || cronometro.contexto?.rotulo || '')

const intervaloDesdeAUltima = computed(() => {
  const ultima = cronometro.ultimaEncerrada

  if (!ultima || cronometro.sessao) {
    return ''
  }

  return formatarDuracao(Math.max(0, agora.value - ultima.encerradaEm))
})

const totalDoDia = computed(() => ({
  atendimentos: cronometro.sessoesDeHoje.length,
  decorrido: formatarDuracao(totalDecorridoMs(cronometro.sessoesDeHoje)),
  cobravel: totalDeMinutosCobraveis(cronometro.sessoesDeHoje),
}))

const opcoesDeBloco = BLOCOS_MINUTOS
const opcoesDeIncremento = INCREMENTOS_MINUTOS

function alternarPainel() {
  painelAberto.value = !painelAberto.value
}

function aoClicarNoChip() {
  if (cronometro.sessao) {
    alternarPainel()
    return
  }

  cronometro.iniciar()
}

function encerrar() {
  cronometro.encerrar()
  painelAberto.value = false
}

function descartar() {
  cronometro.descartar()
  painelAberto.value = false
}

/**
 * Duas abas do mesmo profissional precisam contar a mesma coisa.
 *
 * Sem isto, pausar numa aba deixa a outra correndo, e o total do dia passa a depender de qual
 * das duas a pessoa olhou por último.
 */
function aoMudarArmazenamento(evento: StorageEvent) {
  if (cronometro.ehChaveDoCronometro(evento.key)) {
    cronometro.recarregarDoArmazenamento()
  }
}

function aoClicarFora(evento: MouseEvent) {
  if (painelAberto.value && raiz.value && !raiz.value.contains(evento.target as Node)) {
    painelAberto.value = false
  }
}

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'Escape') {
    painelAberto.value = false
  }
}

onMounted(() => {
  window.addEventListener('storage', aoMudarArmazenamento)
  document.addEventListener('mousedown', aoClicarFora)
  document.addEventListener('keydown', aoTeclar)
})

onUnmounted(() => {
  window.removeEventListener('storage', aoMudarArmazenamento)
  document.removeEventListener('mousedown', aoClicarFora)
  document.removeEventListener('keydown', aoTeclar)
})
</script>

<template>
  <div ref="raiz" class="cron" :class="`cron--${cronometro.sessao ? estado : 'ocioso'}`">
    <button
      class="cron__chip"
      type="button"
      :class="{ 'cron__chip--pausado': pausado }"
      :aria-expanded="cronometro.sessao ? painelAberto : undefined"
      :aria-label="
        cronometro.sessao
          ? t('cronometro.ariaAbrir', { tempo: relogio, estado: rotuloDoEstado })
          : t('cronometro.ariaIniciar')
      "
      @click="aoClicarNoChip"
    >
      <span class="cron__marca" aria-hidden="true">
        <i :class="pausado ? 'pi pi-pause' : 'pi pi-stopwatch'" />
      </span>

      <span v-if="cronometro.sessao" class="cron__leitura">
        <!--
          `role="timer"` com `aria-live="off"`: leitor de tela não deve anunciar um número que
          muda a cada segundo. Quem quiser o valor lê o botão; quem não quiser não é interrompido
          sessenta vezes por minuto.
        -->
        <strong class="cron__tempo" role="timer" aria-live="off">{{ relogio }}</strong>
        <small class="cron__unidades">
          {{
            t('cronometro.unidades', { contagem: medicao?.unidades ?? 0 }, medicao?.unidades ?? 0)
          }}
        </small>
      </span>

      <span v-else class="cron__ocioso">
        <span class="cron__rotulo">{{ t('cronometro.iniciar') }}</span>
        <small v-if="intervaloDesdeAUltima" class="cron__intervalo">
          {{ t('cronometro.ultimaHa', { valor: intervaloDesdeAUltima }) }}
        </small>
      </span>
    </button>

    <button
      v-if="cronometro.sessao"
      class="cron__acao"
      type="button"
      :aria-label="rodando ? t('cronometro.pausar') : t('cronometro.retomar')"
      :title="rodando ? t('cronometro.pausar') : t('cronometro.retomar')"
      @click="cronometro.alternar()"
    >
      <i :class="rodando ? 'pi pi-pause' : 'pi pi-play'" aria-hidden="true" />
    </button>

    <button
      v-if="cronometro.sessao"
      class="cron__acao cron__acao--encerrar"
      type="button"
      :aria-label="t('cronometro.encerrar')"
      :title="t('cronometro.encerrar')"
      @click="encerrar"
    >
      <i class="pi pi-stop-circle" aria-hidden="true" />
    </button>

    <button
      v-else
      class="cron__acao"
      type="button"
      :aria-expanded="painelAberto"
      :aria-label="t('cronometro.abrirPainel')"
      @click="alternarPainel"
    >
      <i class="pi pi-angle-down" aria-hidden="true" />
    </button>

    <div v-if="painelAberto" class="painel" role="dialog" :aria-label="t('cronometro.titulo')">
      <header class="painel__topo">
        <h2>{{ t('cronometro.titulo') }}</h2>
        <p>{{ alvo || t('cronometro.semPaciente') }}</p>
      </header>

      <!-- Sessão em curso: os números que sustentam a cobrança. -->
      <section v-if="cronometro.sessao && medicao" class="painel__bloco">
        <div v-if="medicao.esquecida" class="aviso">
          <strong>{{ t('cronometro.esquecidaTitulo') }}</strong>
          <p>{{ t('cronometro.esquecidaDescricao') }}</p>
          <button type="button" class="aviso__acao" @click="descartar">
            {{ t('cronometro.descartar') }}
          </button>
        </div>

        <dl class="numeros">
          <div>
            <dt>{{ t('cronometro.decorrido') }}</dt>
            <dd class="numeros__forte">{{ relogio }}</dd>
          </div>
          <div>
            <dt>{{ t('cronometro.cobravel') }}</dt>
            <dd class="numeros__forte">
              {{ t('cronometro.minutos', { valor: medicao.minutosCobraveis }) }}
              <small>{{
                t('cronometro.unidades', { contagem: medicao.unidades }, medicao.unidades)
              }}</small>
            </dd>
          </div>
        </dl>

        <!-- Barra do bloco: o que já foi consumido do tempo que o preço de tabela cobre. -->
        <div class="barra" :aria-hidden="true">
          <span class="barra__preenchida" :style="{ width: `${medicao.fracaoDoBloco * 100}%` }" />
        </div>

        <p class="painel__estado">
          <span class="painel__ponto" aria-hidden="true" />
          {{ rotuloDoEstado }}
          <template v-if="medicao.excedenteMs > 0">
            ·
            {{ t('cronometro.excedente', { valor: formatarDuracao(medicao.excedenteMs) }) }}
          </template>
          <template v-else-if="rodando">
            ·
            {{
              t('cronometro.proximaUnidade', {
                valor: formatarDuracao(medicao.ateProximaUnidadeMs),
              })
            }}
          </template>
        </p>

        <div class="painel__botoes">
          <button type="button" class="botao" @click="cronometro.alternar()">
            {{ rodando ? t('cronometro.pausar') : t('cronometro.retomar') }}
          </button>
          <button type="button" class="botao botao--forte" @click="encerrar">
            {{ t('cronometro.encerrar') }}
          </button>
        </div>
      </section>

      <section v-else class="painel__bloco">
        <p class="painel__vazio">{{ t('cronometro.semSessao') }}</p>
        <button type="button" class="botao botao--forte" @click="cronometro.iniciar()">
          {{ t('cronometro.iniciar') }}
        </button>
      </section>

      <!-- Total do dia: é o que o profissional pago por tempo precisa somar no fim do turno. -->
      <section class="painel__bloco">
        <h3>{{ t('cronometro.hoje') }}</h3>

        <p v-if="totalDoDia.atendimentos === 0" class="painel__vazio">
          {{ t('cronometro.semHistorico') }}
        </p>

        <dl v-else class="numeros">
          <div>
            <dt>{{ t('cronometro.hojeResumo', { contagem: totalDoDia.atendimentos }, totalDoDia.atendimentos) }}</dt>
            <dd>{{ t('cronometro.totalDecorrido') }}: {{ totalDoDia.decorrido }}</dd>
          </div>
          <div>
            <dt>{{ t('cronometro.totalCobravel') }}</dt>
            <dd class="numeros__forte">
              {{ t('cronometro.minutos', { valor: totalDoDia.cobravel }) }}
            </dd>
          </div>
        </dl>

        <button
          v-if="totalDoDia.atendimentos > 0"
          type="button"
          class="botao botao--discreto"
          @click="cronometro.limparHistorico()"
        >
          {{ t('cronometro.limparHistorico') }}
        </button>
      </section>

      <!-- Configuração: bloco e incremento mudam por país, por clínica e por tabela. -->
      <section class="painel__bloco">
        <label class="campo">
          <span>{{ t('cronometro.bloco') }}</span>
          <select
            :value="cronometro.preferencias.blocoMinutos"
            @change="
              cronometro.definirPreferencias({
                blocoMinutos: Number(($event.target as HTMLSelectElement).value),
              })
            "
          >
            <option v-for="opcao in opcoesDeBloco" :key="opcao" :value="opcao">
              {{ t('cronometro.minutos', { valor: opcao }) }}
            </option>
          </select>
        </label>

        <label class="campo">
          <span>{{ t('cronometro.incremento') }}</span>
          <select
            :value="cronometro.preferencias.incrementoMinutos"
            @change="
              cronometro.definirPreferencias({
                incrementoMinutos: Number(($event.target as HTMLSelectElement).value),
              })
            "
          >
            <option v-for="opcao in opcoesDeIncremento" :key="opcao" :value="opcao">
              {{ t('cronometro.minutos', { valor: opcao }) }}
            </option>
          </select>
        </label>

        <p class="painel__nota">{{ t('cronometro.comoFunciona') }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.cron {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.16rem;
  border: 1px solid var(--shell-line);
  border-radius: 0.78rem;
  background: var(--shell-surface);
}

/*
 * O tom é do estado, não do gosto: sage enquanto dentro do bloco contratado, âmbar na virada,
 * vermelho depois. As três cores vêm com mudança de texto junto — a cor reforça, não informa.
 */
.cron--ocioso {
  --cron-tinta: var(--shell-muted);
  --cron-fundo: var(--shell-surface-soft);
}

.cron--dentro {
  --cron-tinta: var(--shell-accent-strong);
  --cron-fundo: color-mix(in srgb, var(--shell-accent) 20%, var(--shell-surface));
}

.cron--no-limite {
  --cron-tinta: #8a6100;
  --cron-fundo: color-mix(in srgb, #f0b429 26%, var(--shell-surface));
}

.cron--excedido {
  --cron-tinta: var(--danger-soft);
  --cron-fundo: color-mix(in srgb, var(--danger-soft) 18%, var(--shell-surface));
}

.cron__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.15rem;
  padding: 0.1rem 0.55rem 0.1rem 0.1rem;
  border: none;
  border-radius: 0.64rem;
  background: transparent;
  color: var(--shell-text);
  cursor: pointer;
  font: inherit;
}

.cron__chip:hover {
  background: var(--shell-surface-soft);
}

.cron__marca {
  display: grid;
  width: 1.95rem;
  height: 1.95rem;
  place-items: center;
  border-radius: 0.55rem;
  background: var(--cron-fundo);
  color: var(--cron-tinta);
  font-size: 0.82rem;
}

.cron__leitura,
.cron__ocioso {
  display: grid;
  gap: 0.05rem;
  justify-items: start;
  line-height: 1.15;
  text-align: left;
}

.cron__tempo {
  color: var(--shell-text);
  font-size: 0.92rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.cron__unidades,
.cron__intervalo {
  color: var(--shell-muted);
  font-size: 0.62rem;
  font-weight: 700;
  white-space: nowrap;
}

.cron__rotulo {
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

/* Pausado perde o preenchimento: um relógio parado não pode parecer um relógio correndo. */
.cron__chip--pausado .cron__tempo {
  color: var(--shell-muted);
}

.cron__acao {
  display: grid;
  width: 1.9rem;
  height: 1.9rem;
  place-items: center;
  border: none;
  border-radius: 0.55rem;
  background: transparent;
  color: var(--shell-muted);
  cursor: pointer;
  font-size: 0.78rem;
}

.cron__acao:hover {
  background: var(--shell-surface-soft);
  color: var(--shell-text);
}

.cron__acao--encerrar:hover {
  color: var(--danger-soft);
}

.painel {
  position: absolute;
  z-index: 60;
  top: calc(100% + 0.5rem);
  right: 0;
  display: grid;
  width: min(22rem, calc(100vw - 2rem));
  gap: 0.85rem;
  padding: 0.95rem;
  border: 1px solid var(--shell-line);
  border-radius: 0.9rem;
  background: var(--shell-surface);
  box-shadow: 0 14px 34px rgb(var(--shell-shadow-rgb) / 22%);
  color: var(--shell-text);
  text-align: left;
}

.painel__topo h2 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 800;
}

.painel__topo p {
  margin: 0.1rem 0 0;
  color: var(--shell-muted);
  font-size: 0.74rem;
}

.painel__bloco {
  display: grid;
  gap: 0.55rem;
  padding-top: 0.7rem;
  border-top: 1px solid var(--shell-line);
}

.painel__bloco h3 {
  margin: 0;
  color: var(--shell-muted);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.numeros {
  display: grid;
  margin: 0;
  gap: 0.5rem;
  grid-template-columns: 1fr 1fr;
}

.numeros div {
  display: grid;
  gap: 0.1rem;
}

.numeros dt {
  color: var(--shell-muted);
  font-size: 0.66rem;
  font-weight: 700;
}

.numeros dd {
  margin: 0;
  font-size: 0.76rem;
}

.numeros__forte {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.numeros__forte small {
  color: var(--shell-muted);
  font-size: 0.66rem;
  font-weight: 700;
}

.barra {
  height: 0.34rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--shell-surface-soft);
}

.barra__preenchida {
  display: block;
  height: 100%;
  background: var(--cron-tinta);
}

.painel__estado {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  color: var(--shell-muted);
  font-size: 0.7rem;
  font-weight: 650;
}

.painel__ponto {
  width: 0.5rem;
  height: 0.5rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--cron-tinta);
}

.painel__vazio,
.painel__nota {
  margin: 0;
  color: var(--shell-muted);
  font-size: 0.7rem;
  line-height: 1.45;
}

.painel__botoes {
  display: flex;
  gap: 0.4rem;
}

.botao {
  flex: 1;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--shell-line);
  border-radius: 0.6rem;
  background: var(--shell-surface);
  color: var(--shell-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 700;
}

.botao:hover {
  background: var(--shell-surface-soft);
}

.botao--forte {
  border-color: transparent;
  background: var(--shell-accent-strong);
  color: var(--shell-on-brand);
}

.botao--forte:hover {
  filter: brightness(1.06);
  background: var(--shell-accent-strong);
}

.botao--discreto {
  flex: 0 0 auto;
  justify-self: start;
  border-color: transparent;
  background: transparent;
  color: var(--shell-muted);
  font-size: 0.68rem;
}

.aviso {
  display: grid;
  gap: 0.35rem;
  padding: 0.6rem;
  border: 1px solid color-mix(in srgb, var(--danger-soft) 34%, transparent);
  border-radius: 0.6rem;
  background: color-mix(in srgb, var(--danger-soft) 12%, var(--shell-surface));
}

.aviso strong {
  font-size: 0.74rem;
}

.aviso p {
  margin: 0;
  font-size: 0.7rem;
  line-height: 1.45;
}

.aviso__acao {
  justify-self: start;
  padding: 0.28rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--danger-soft) 40%, transparent);
  border-radius: 0.5rem;
  background: transparent;
  color: var(--danger-soft);
  cursor: pointer;
  font: inherit;
  font-size: 0.7rem;
  font-weight: 700;
}

.campo {
  display: grid;
  gap: 0.2rem;
}

.campo span {
  color: var(--shell-muted);
  font-size: 0.66rem;
  font-weight: 700;
}

.campo select {
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--shell-line);
  border-radius: 0.55rem;
  background: var(--shell-surface);
  color: var(--shell-text);
  font: inherit;
  font-size: 0.74rem;
}

/* No cabeçalho estreito sobra o relógio, que é o que não pode sumir. */
@media (max-width: 900px) {
  .cron__unidades,
  .cron__intervalo,
  .cron__rotulo {
    display: none;
  }

  .painel {
    right: auto;
    left: 50%;
    transform: translateX(-50%);
  }
}
</style>
