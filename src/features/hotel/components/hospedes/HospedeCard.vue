<script setup lang="ts">
/**
 * Um hóspede na casa.
 *
 * Era uma linha de tabela, e tabela é a forma errada aqui. A lista de hóspedes não é um
 * inventário para varrer por coluna: é a pergunta "como está cada um dos meus cinco?", e a
 * resposta é um rosto, um estado e o que falta fazer. Numa tabela, "Thor" é texto de célula; num
 * cartão, é quem está dentro da baia.
 *
 * O cartão é organizado pelo que a pessoa procura, nesta ordem:
 *
 * 1. **Quem** — iniciais grandes, nome, acomodação.
 * 2. **Como está** — adaptação, e o que trava, se travar.
 * 3. **O que falta** — a barra de rotina do dia, que é a única coisa acionável daqui.
 * 4. **Até quando** — a saída, com o dia de hoje em destaque.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import HotelSelo from '../base/HotelSelo.vue'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { HospedeNaCasa } from '../../data/repositories'
import { tomDaAdaptacao } from '../../domain/estadia'

const props = defineProps<{ hospede: HospedeNaCasa }>()

const emit = defineEmits<{ abrir: [hospedagemId: string] }>()

const { t } = useI18n()
const formato = useHotelFormat()

/**
 * O cartão inteiro muda de tom quando algo trava.
 *
 * Um selo pequeno no canto não sobrevive a uma tela com doze cartões: o olho varre a grade e não
 * lê canto. O que trava precisa mudar a **silhueta** do cartão.
 */
const tom = computed(() => {
  if (props.hospede.ocorrenciaTravada) {
    return 'risco'
  }

  if (props.hospede.atrasadas > 0 || props.hospede.boletimRetido) {
    return 'atencao'
  }

  return 'calmo'
})

/** A barra de rotina: feito sobre total do dia. Vazia some — barra a 0% é ruído. */
const rotina = computed(() => {
  const total = props.hospede.pendentes + props.hospede.atrasadas

  return { pendentes: total, atrasadas: props.hospede.atrasadas }
})

const proxima = computed(() =>
  props.hospede.proximaEmMinutos === null ? '' : formato.duracao(props.hospede.proximaEmMinutos),
)
</script>

<template>
  <article class="cartao" :class="`cartao--${tom}`">
    <button type="button" class="cartao__botao" @click="emit('abrir', hospede.hospedagem.id)">
      <header class="quem">
        <PetAvatar
          :nome="hospede.petNome"
          :iniciais="hospede.petIniciais"
          :especie="hospede.petEspecie"
          :foto-url="hospede.petFotoUrl"
          tamanho="md"
        />

        <span class="quem__texto">
          <strong class="quem__nome">{{ hospede.petNome }}</strong>
          <span class="quem__onde">{{ hospede.acomodacaoNome }}</span>
          <span class="quem__tutor">{{ hospede.tutorNome }}</span>
        </span>

        <HotelSelo
          :rotulo="formato.adaptacao(hospede.hospedagem.adaptacao)"
          :tom="tomDaAdaptacao(hospede.hospedagem.adaptacao)"
        />
      </header>

      <!--
        O que trava vem antes de tudo o mais, com a frase inteira. "Ligar" sozinho não diz para
        quem nem por quê, e é essa a informação que decide se alguém larga o que está fazendo.
      -->
      <p v-if="hospede.ocorrenciaTravada" class="trava trava--risco">
        <i class="pi pi-phone" aria-hidden="true" />
        {{ t('hotel.hospedes.cartao.precisaLigar', { tutor: hospede.tutorNome }) }}
      </p>

      <p v-else-if="hospede.boletimRetido" class="trava trava--atencao">
        <i class="pi pi-comment" aria-hidden="true" />
        {{ t('hotel.hospedes.cartao.boletimRetido') }}
      </p>

      <dl class="fatos">
        <div class="fato">
          <dt>{{ t('hotel.hospedes.cartao.rotina') }}</dt>
          <dd>
            <template v-if="rotina.atrasadas > 0">
              <strong class="fato--alerta">
                {{
                  t(
                    'hotel.hospedes.cartao.atrasadas',
                    { total: rotina.atrasadas },
                    rotina.atrasadas,
                  )
                }}
              </strong>
            </template>
            <template v-else-if="rotina.pendentes > 0">
              {{
                t('hotel.hospedes.cartao.pendentes', { total: rotina.pendentes }, rotina.pendentes)
              }}
            </template>
            <template v-else-if="proxima">
              {{ t('hotel.hospedes.cartao.proxima', { tempo: proxima }) }}
            </template>
            <template v-else>{{ t('hotel.hospedes.cartao.nadaAFazer') }}</template>
          </dd>
        </div>

        <div class="fato">
          <dt>{{ t('hotel.hospedes.cartao.naCasaHa') }}</dt>
          <dd>
            {{ t('hotel.hospedes.cartao.noites', { total: hospede.noites }, hospede.noites) }}
          </dd>
        </div>

        <div class="fato">
          <dt>{{ t('hotel.hospedes.cartao.sai') }}</dt>
          <dd :class="{ 'fato--destaque': hospede.saiHoje }">
            <template v-if="hospede.saiHoje">
              {{
                t('hotel.hospedes.cartao.hojeAs', {
                  hora: formato.hora(hospede.hospedagem.saidaPrevistaEm),
                })
              }}
            </template>
            <template v-else>
              {{ formato.quando(hospede.hospedagem.saidaPrevistaEm) }}
            </template>
          </dd>
        </div>
      </dl>

      <footer v-if="hospede.saiHoje && hospede.hospedagem.pesoSaidaKg === null" class="rodape">
        <HotelSelo
          :rotulo="t('hotel.hospedes.cartao.faltaPesar')"
          tom="atencao"
          icone="pi pi-exclamation-triangle"
        />
      </footer>
    </button>
  </article>
</template>

<style scoped>
.cartao {
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.cartao--atencao {
  border-color: var(--clinic-attention-line);
  background: color-mix(in srgb, var(--clinic-attention-bg) 45%, var(--clinic-surface));
}

/* Sem barra lateral: o cartão inteiro já muda de tom, que é sinal de sobra. */
.cartao--risco {
  border-color: var(--clinic-risk-line);
  background: color-mix(in srgb, var(--clinic-risk-bg) 55%, var(--clinic-surface));
}

.cartao__botao {
  display: grid;
  width: 100%;
  height: 100%;
  align-content: start;
  padding: var(--clinic-space-4);
  border: 0;
  border-radius: inherit;
  gap: var(--clinic-space-3);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.cartao__botao:hover,
.cartao__botao:focus-visible {
  background: color-mix(in srgb, var(--clinic-accent-tint) 55%, transparent);
  outline: none;
}

/* ------------------------------------------------------------------ quem */

.quem {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-3);
}

.quem__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0;
}

.quem__nome {
  font-size: 1.02rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quem__onde {
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.quem__tutor {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ------------------------------------------------------------------ trava */

.trava {
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

.trava--risco {
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

.trava--atencao {
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

/* ------------------------------------------------------------------ fatos */

.fatos {
  display: grid;
  gap: 0.35rem;
  margin: 0;
}

.fato {
  display: grid;
  align-items: baseline;
  gap: var(--clinic-space-2);
  grid-template-columns: 6.5rem 1fr;
}

.fato dt {
  color: var(--clinic-faint);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.fato dd {
  margin: 0;
  font-size: var(--clinic-font-label);
}

.fato--alerta {
  color: var(--clinic-risk-text);
  font-weight: 800;
}

.fato--destaque {
  color: var(--clinic-accent-strong);
  font-weight: 750;
}

.rodape {
  display: flex;
  padding-top: var(--clinic-space-2);
  border-top: 1px solid var(--clinic-line-soft);
}
</style>
