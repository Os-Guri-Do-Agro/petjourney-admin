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
    <!--
      O quadro é o que estica; o avatar dentro dele tira a largura da própria altura.
      Duas camadas porque `aspect-ratio` precisa de uma dimensão **definida** para derivar a
      outra — e a altura de um item de flex esticado só fica definida depois do layout. Com o
      quadro assumindo o esticamento, o avatar recebe uma altura concreta e vira quadrado.
    -->
    <div class="paciente__quadro">
      <div class="paciente__avatar" :aria-hidden="true">{{ pet.iniciais }}</div>
    </div>

    <div class="paciente__corpo">
      <h2 class="paciente__nome" :title="pet.nome">{{ pet.nome }}</h2>

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

    <!--
      Trilho da direita: **dado em cima, ação embaixo**, com uma divisória entre os dois.
      Antes o peso morava na linha do nome, mas o nome tem `flex: 1 1 auto` e cresce — o
      resultado era "6,4 kg" empurrado até a borda direita, encostado no botão. Peso é o
      número mais consultado do cabeçalho (toda dose sai dele) e estava com o peso visual de
      uma legenda, colado numa ação.
    -->
    <div v-if="!compacto || $slots.acoes" class="paciente__trilho">
      <div v-if="pet.pesoKg !== null" class="peso">
        <span class="peso__valor clinic-value">{{ formato.numero(pet.pesoKg, 1) }}</span>
        <span class="peso__unidade">{{ t('clinico.formato.kg') }}</span>
      </div>

      <div v-if="$slots.acoes" class="paciente__acoes">
        <slot name="acoes" />
      </div>
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

/*
 * O avatar **acompanha a altura do bloco de informação** ao lado.
 *
 * Quadrado fixo, ele flutuava alinhado ao topo enquanto o corpo do cartão descia por quatro
 * linhas — nome, meta, responsável e alertas —, e a borda inferior do cartão não encontrava
 * nada do lado esquerdo. Esticado, ele fecha a coluna: o olho lê um bloco, não um marcador
 * solto acima de um vazio.
 *
 * `align-self: stretch` só funciona sem altura declarada; o piso fica no `min-height`, para o
 * caso de o cartão ter uma linha só.
 */
/* O quadro não desenha nada: só carrega o esticamento para o avatar ter altura definida. */
.paciente__quadro {
  flex: 0 0 auto;
  align-self: stretch;
  min-height: 3.6rem;
}

.paciente__avatar {
  display: grid;
  height: 100%;
  /* A largura sai da altura: o bloco é quadrado seja qual for o tamanho do cartão. */
  aspect-ratio: 1;
  place-items: center;
  border-radius: 1.1rem;
  background: var(--clinic-accent-tint);
  /* Contorno interno: dá borda ao bloco sem escurecer o fundo nem inventar outra cor. */
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--clinic-accent-strong) 22%, transparent);
  color: var(--clinic-accent-strong);
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

/* No drawer o cartão tem menos linhas, então o avatar volta a acompanhá-las. */
.paciente--compacto .paciente__quadro {
  min-height: 2.6rem;
}

.paciente--compacto .paciente__avatar {
  border-radius: 0.8rem;
  font-size: var(--clinic-font-value);
}

.paciente__corpo {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.2rem;
}

/*
 * Nome longo ganha duas linhas e quebra onde precisar. Sem isto, "Maximiliano Bartholomeu von
 * Schnauzerhausen III" empurra o trilho da direita para fora da coluna em 1024.
 */
.paciente__nome {
  display: -webkit-box;
  overflow: hidden;
  min-width: 0;
  margin: 0;
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

/* ------------------------------------------------------------------- trilho direito */

.paciente__trilho {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--clinic-space-2);
}

/*
 * O peso como valor clínico, não como legenda: número grande e unidade pequena ao lado, no
 * mesmo tratamento que o módulo dá a qualquer medição. É dele que sai toda dose.
 */
.peso {
  display: flex;
  align-items: baseline;
  gap: 0.2rem;
  white-space: nowrap;
}

.peso__valor {
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.peso__unidade {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.paciente--compacto .peso__valor {
  font-size: 1.05rem;
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

/* A divisória separa o que se lê do que se clica. Sem ela os dois viram um bloco só. */
.paciente__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
  padding-top: var(--clinic-space-2);
  border-top: 1px solid var(--clinic-line);
}

/* Sem peso não há o que separar: a divisória sobraria como um traço solto. */
.paciente__trilho > .paciente__acoes:first-child {
  padding-top: 0;
  border-top: 0;
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
/*
 * Estreito: o trilho desce e vira uma faixa horizontal — peso à esquerda, ações à direita.
 *
 * Empilhado à direita numa coluna de 26 rem ele espremia o corpo do cartão e o nome quebrava
 * em três linhas. Como faixa, os dois continuam legíveis e a divisória passa a separar o
 * trilho do resto do cartão — que é a mesma leitura, na horizontal.
 *
 * A consulta é de **contêiner**, não de janela: o cabeçalho aparece no prontuário em coluna
 * larga e no drawer de 320 px, e é a largura recebida que decide, não o tamanho da tela.
 */
@container (max-width: 26rem) {
  .paciente {
    flex-wrap: wrap;
  }

  .paciente__trilho {
    width: 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding-top: var(--clinic-space-2);
    border-top: 1px solid var(--clinic-line);
  }

  /* A divisória subiu para o trilho: repeti-la nas ações desenharia duas linhas. */
  .paciente__acoes {
    padding-top: 0;
    border-top: 0;
  }
}
</style>
