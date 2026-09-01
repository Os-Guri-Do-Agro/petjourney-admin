<script setup lang="ts">
/**
 * Cabeçalho do paciente — a identidade que acompanha prontuário, drawer e histórico.
 *
 * É o componente que mais sofre com nome real. Três casos convivem no dataset de propósito:
 * "Ni" (duas letras), "Maximiliano Bartholomeu von Schnauzerhausen III" (longuíssimo) e
 * "Açaí Nhoque Çãpeçã" (acentuação densa). O nome ganha até duas linhas e quebra em qualquer
 * ponto; tudo o mais tem `min-width: 0` para que o flex não estoure a largura da coluna.
 *
 * Terminologia: em português a linha diz "responsável". `tutorId` continua sendo o campo.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicAlertChip from './ClinicAlertChip.vue'
import type { Pet, Tutor } from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { porteDoPaciente } from '../../domain/porte'

const props = withDefaults(
  defineProps<{
    pet: Pet | null
    tutor: Tutor | null
    /** Variante de drawer/linha: mesma informação, menos respiro. */
    compacto?: boolean
    /** Esconde os alertas quando quem chama já os mostra em outro lugar. */
    semAlertas?: boolean
  }>(),
  { compacto: false, semAlertas: false },
)

const { t } = useI18n()
const formato = useClinicFormat()

const meta = computed(() => {
  const pet = props.pet

  if (!pet) {
    return [] as string[]
  }

  /**
   * O porte entra na linha de identificação porque **é ele que escolhe a faixa de
   * referência** do exame físico. Sem ele visível, um valor marcado como alterado num cão
   * grande e normal num pequeno não teria explicação na tela.
   *
   * Aparece só quando a espécie tem porte clínico — em gato e ave a linha ganharia uma
   * palavra a mais sem informação nenhuma.
   */
  const porte = porteDoPaciente(pet)

  return [
    formato.especie(pet.especie),
    pet.raca,
    porte ? t(`clinico.paciente.porte.${porte}`) : '',
    formato.idade(pet.nascimento),
    t(`clinico.sexo.${pet.sexo}`),
    pet.castrado ? t('clinico.paciente.castrado') : t('clinico.paciente.inteiro'),
  ].filter(Boolean)
})

/** Alerta de risco vem primeiro: é o que muda conduta antes de a consulta começar. */
const alertasOrdenados = computed(() => {
  const peso = { risco: 0, atencao: 1, info: 2 } as const

  return [...(props.pet?.alertas ?? [])].sort(
    (a, b) => peso[a.severidade] - peso[b.severidade],
  )
})
</script>

<template>
  <header v-if="pet" class="paciente" :class="{ 'paciente--compacto': compacto }">
    <div class="paciente__avatar" :aria-hidden="true">{{ pet.iniciais }}</div>

    <div class="paciente__corpo">
      <div class="paciente__topo">
        <h2 class="paciente__nome" :title="pet.nome">{{ pet.nome }}</h2>
        <span class="paciente__peso clinic-value">{{ formato.peso(pet.pesoKg) }}</span>
      </div>

      <p class="paciente__meta">
        <span v-for="(item, indice) in meta" :key="item">
          <span v-if="indice > 0" class="paciente__sep" aria-hidden="true">·</span>{{ item }}
        </span>
      </p>

      <p v-if="tutor" class="paciente__tutor">
        <span class="clinic-label">{{ t('clinico.paciente.responsavel') }}</span>
        <span class="paciente__tutor-nome" :title="tutor.nome">{{ tutor.nome }}</span>
        <a class="paciente__telefone clinic-value" :href="`tel:${tutor.telefone}`">
          {{ tutor.telefone }}
        </a>
      </p>

      <ul v-if="!semAlertas && alertasOrdenados.length > 0" class="paciente__alertas">
        <li v-for="alerta in alertasOrdenados" :key="alerta.id">
          <ClinicAlertChip
            :severidade="alerta.severidade"
            :rotulo="formato.alerta(alerta.kind)"
            :detalhe="alerta.detalhe"
          />
        </li>
      </ul>
    </div>

    <div v-if="$slots.acoes" class="paciente__acoes">
      <slot name="acoes" />
    </div>
  </header>
</template>

<style scoped>
.paciente {
  display: flex;
  align-items: flex-start;
  gap: var(--clinic-space-4);
  min-width: 0;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
  /* O cabeçalho decide o próprio arranjo pela largura que recebeu, não pela da janela. */
  container-type: inline-size;
}

.paciente--compacto {
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3);
  border-radius: var(--clinic-radius-control);
}

.paciente__avatar {
  display: grid;
  width: 2.9rem;
  height: 2.9rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.9rem;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-value);
  font-weight: 800;
  letter-spacing: 0.02em;
}

.paciente--compacto .paciente__avatar {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 0.7rem;
}

.paciente__corpo {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.2rem;
}

/*
 * `flex-wrap` aqui não é enfeite: em cartão de ~20rem o nome longo empurrava o peso para
 * fora da borda e ele sumia. Quando não cabe na mesma linha, o peso desce — e continua
 * legível, que é o que importa.
 */
.paciente__topo {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--clinic-space-3);
}

/*
 * Nome longo ganha duas linhas e quebra onde precisar. Sem isto, "Maximiliano Bartholomeu von
 * Schnauzerhausen III" empurra o peso e as ações para fora da coluna em 1024.
 */
.paciente__nome {
  display: -webkit-box;
  overflow: hidden;
  min-width: 0;
  margin: 0;
  /*
   * Base `auto` deixa o nome pedir a largura do seu próprio texto. Nome curto divide a linha
   * com o peso; nome longo empurra o peso para a linha de baixo, inteiro, em vez de deixá-lo
   * ser cortado pela borda do cartão.
   */
  flex: 1 1 auto;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: var(--clinic-font-title);
  font-weight: 750;
  letter-spacing: -0.02em;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.paciente--compacto .paciente__nome {
  -webkit-line-clamp: 1;
  line-clamp: 1;
  font-size: var(--clinic-font-value);
}

.paciente__peso {
  flex: 0 0 auto;
  color: var(--clinic-muted);
  font-weight: 700;
  white-space: nowrap;
}

.paciente__meta {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-base);
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.paciente__sep {
  padding: 0 0.35rem;
  color: var(--clinic-faint);
}

.paciente__tutor {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem;
  margin: 0.15rem 0 0;
}

.paciente__tutor-nome {
  min-width: 0;
  overflow: hidden;
  color: var(--clinic-text);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paciente__telefone {
  color: var(--clinic-accent-strong);
  font-weight: 650;
  text-decoration: none;
  white-space: nowrap;
}

.paciente__telefone:hover,
.paciente__telefone:focus-visible {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.paciente__alertas {
  display: flex;
  flex-wrap: wrap;
  gap: var(--clinic-space-1);
  margin: 0.3rem 0 0;
  padding: 0;
  list-style: none;
}

.paciente__acoes {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
}

/*
 * Cartão estreito — coluna de painel, item de lista — manda o peso para a linha de baixo. Sem
 * este corte, o cálculo do flex deixava nome e peso "quase" cabendo na mesma linha e o "kg"
 * saía cortado pela borda. Largura de contêiner é determinística; largura de janela não diz
 * nada sobre o espaço que este cartão realmente recebeu.
 *
 * Fica no fim da folha de propósito: precisa vencer o `flex: 1 1 auto` declarado acima, e as
 * duas regras têm a mesma especificidade.
 */
@container (max-width: 26rem) {
  .paciente__nome {
    flex: 1 1 100%;
  }
}

/* Em 768 as ações caem para baixo em vez de espremer o nome. */
@media (max-width: 768px) {
  .paciente {
    flex-wrap: wrap;
  }

  .paciente__acoes {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
