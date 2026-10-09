<script setup lang="ts">
/**
 * O cadastro como a clínica vai vê-lo — um perfil que se monta enquanto alguém digita.
 *
 * Não é enfeite para ocupar a coluna vazia. Um formulário mostra **campos**; quem atende vê um
 * **perfil** — e a distância entre os dois é onde mora o cadastro que passa na validação e não
 * serve para nada. "Alergia" marcada sem detalhe, raça em branco, nascimento não informado: cada
 * um desses é um campo opcional legítimo no formulário e um buraco visível aqui.
 *
 * **A estrutura aparece inteira desde o primeiro segundo, vazia.** A versão anterior mostrava
 * uma frase de convite e só desenhava o perfil depois da primeira letra — o que deixava metade
 * da tela em branco justamente no momento em que a pessoa está decidindo se vale preencher. Com
 * a ficha montada e os campos em traço, ela deixa de ser um convite e passa a ser uma lista do
 * que falta: dá para ver, antes de digitar, que existe um lugar para microchip e um para
 * endereço.
 *
 * O conteúdo sai das **mesmas funções** que o cabeçalho de verdade usa — `porteDoPaciente`,
 * `formato.idade`, `formato.peso`. A apresentação é própria (um cabeçalho compacto de prontuário
 * não tem como parecer um perfil em repouso), mas o que ele diz não pode divergir do que o vet
 * vai ler depois.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicAlertChip from '../base/ClinicAlertChip.vue'
import type { RascunhoDoPaciente } from './PacienteNovoForm.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { porteDoPaciente } from '../../domain/porte'

const props = defineProps<{ rascunho: RascunhoDoPaciente | null }>()

const { t } = useI18n()
const formato = useClinicFormat()

const pet = computed(() => props.rascunho?.pet ?? null)
const tutor = computed(() => props.rascunho?.tutor ?? null)

const TRACO = '—'

/** Duas letras, ou um ícone quando ainda não há nome. O círculo nunca some. */
const iniciais = computed(() => pet.value?.iniciais ?? '')

const nome = computed(() => pet.value?.nome?.trim() ?? '')

/**
 * A linha de identificação, na mesma ordem do cabeçalho do prontuário.
 *
 * Idade só entra quando há nascimento: "idade não informada" no meio de uma linha de atributos
 * ocupa o espaço de um dado e não é um. O que falta aqui se lê na ausência.
 */
const meta = computed(() => {
  const valor = pet.value

  if (!valor) {
    return []
  }

  const porte = porteDoPaciente(valor)

  return [
    formato.especie(valor.especie),
    valor.raca.trim(),
    porte ? t(`clinico.paciente.porte.${porte}`) : '',
    valor.nascimento ? formato.idade(valor.nascimento) : '',
    formato.sexo(valor.sexo),
    valor.castrado ? t('clinico.paciente.castrado') : t('clinico.paciente.inteiro'),
  ].filter(Boolean)
})

const peso = computed(() => (pet.value?.pesoKg ? formato.peso(pet.value.pesoKg) : TRACO))

/** Alerta de risco vem primeiro: é o que muda conduta antes de a consulta começar. */
const alertas = computed(() => {
  const ordem = { risco: 0, atencao: 1, info: 2 } as const

  return [...(pet.value?.alertas ?? [])].sort((a, b) => ordem[a.severidade] - ordem[b.severidade])
})

const endereco = computed(() => {
  const valor = tutor.value?.endereco

  if (!valor) {
    return ''
  }

  const rua = [valor.logradouro, valor.numero].filter(Boolean).join(', ')
  const cidade = [valor.cidade, valor.uf].filter(Boolean).join('/')

  return [rua, valor.complemento, valor.bairro, cidade, valor.cep].filter(Boolean).join(' · ')
})

/**
 * As linhas dos quadros, **sempre todas**.
 *
 * O traço no lugar do valor é o que transforma a prévia em lista de pendências: some a linha e
 * o quadro parece completo faltando metade.
 */
const identificacao = computed(() => [
  { rotulo: t('clinico.paciente.novo.microchip'), valor: pet.value?.microchip ?? '' },
  { rotulo: t('clinico.paciente.novo.pelagem'), valor: pet.value?.pelagem ?? '' },
])

const contato = computed(() => [
  { rotulo: t('clinico.paciente.novo.telefone'), valor: tutor.value?.telefone ?? '' },
  {
    rotulo: t('clinico.paciente.novo.telefoneSecundarioCurto'),
    valor: tutor.value?.telefoneSecundario ?? '',
  },
  { rotulo: t('clinico.paciente.novo.documentoCurto'), valor: tutor.value?.documento ?? '' },
  { rotulo: t('clinico.paciente.novo.emailCurto'), valor: tutor.value?.email ?? '' },
  {
    rotulo: t('clinico.paciente.novo.canalPreferido'),
    valor: tutor.value?.preferenciaContato
      ? t(`clinico.paciente.novo.canal.${tutor.value.preferenciaContato}`)
      : '',
  },
  { rotulo: t('clinico.paciente.novo.enderecoCurto'), valor: endereco.value },
])
</script>

<template>
  <aside class="previa clinic-scope" :aria-label="t('clinico.paciente.novo.previa.titulo')">
    <p class="previa__selo">{{ t('clinico.paciente.novo.previa.titulo') }}</p>

    <!--
      A faixa de identidade.

      Avatar, nome e atributos na mesma proporção do cabeçalho que o prontuário desenha — é a
      forma que quem usa o sistema já reconhece, e reconhecê-la aqui é o que faz a prévia
      parecer o resultado e não uma repetição do formulário.
    -->
    <header class="perfil">
      <div
        class="perfil__avatar"
        :class="{ 'perfil__avatar--vazio': !iniciais }"
        aria-hidden="true"
      >
        <span v-if="iniciais">{{ iniciais }}</span>
        <i v-else class="ph ph-user" />
      </div>

      <div class="perfil__corpo">
        <h3 v-if="nome" class="perfil__nome" :title="nome">{{ nome }}</h3>
        <p v-else class="perfil__nome perfil__nome--vazio">
          {{ t('clinico.paciente.novo.previa.nomeVazio') }}
        </p>

        <p class="perfil__meta">
          <span v-for="(item, indice) in meta" :key="item">
            <span v-if="indice > 0" class="perfil__sep" aria-hidden="true">·</span>{{ item }}
          </span>
        </p>
      </div>

      <div class="perfil__peso">
        <span class="clinic-label">{{ t('clinico.prontuario.exameFisico.peso') }}</span>
        <strong class="clinic-value" :class="{ previa__traco: peso === TRACO }">{{ peso }}</strong>
      </div>
    </header>

    <section class="quadro">
      <h4 class="clinic-label">{{ t('clinico.paciente.novo.alertas') }}</h4>

      <div v-if="alertas.length > 0" class="quadro__alertas">
        <ClinicAlertChip
          v-for="alerta in alertas"
          :key="alerta.id"
          :severidade="alerta.severidade"
          :rotulo="formato.alerta(alerta.kind)"
          :detalhe="alerta.detalhe"
        />
      </div>

      <p v-else class="previa__traco">{{ t('clinico.paciente.novo.previa.semAlertas') }}</p>
    </section>

    <section class="quadro">
      <h4 class="clinic-label">{{ t('clinico.paciente.novo.identificacao') }}</h4>
      <dl class="quadro__lista">
        <template v-for="linha in identificacao" :key="linha.rotulo">
          <dt>{{ linha.rotulo }}</dt>
          <dd :class="{ previa__traco: !linha.valor }">{{ linha.valor || TRACO }}</dd>
        </template>
      </dl>
    </section>

    <section class="quadro">
      <h4 class="clinic-label">{{ t('clinico.paciente.responsavel') }}</h4>

      <p v-if="tutor?.nome" class="quadro__quem">{{ tutor.nome }}</p>
      <!--
        A ausência de responsável é dita, e em tom de atenção.

        Não é alerta — o cadastro ainda está sendo preenchido. Mas é a única linha desta coluna
        que descreve algo que não pode ficar como está: paciente sem responsável é paciente que
        ninguém consegue avisar.
      -->
      <p v-else class="quadro__falta">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t('clinico.paciente.novo.previa.semResponsavel') }}
      </p>

      <dl class="quadro__lista">
        <template v-for="linha in contato" :key="linha.rotulo">
          <dt>{{ linha.rotulo }}</dt>
          <dd :class="{ previa__traco: !linha.valor }">{{ linha.valor || TRACO }}</dd>
        </template>
      </dl>
    </section>
  </aside>
</template>

<style scoped>
.previa {
  display: grid;
  gap: var(--clinic-space-3);
  align-content: start;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface-soft);
}

.previa__selo {
  margin: 0;
  color: var(--clinic-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

/* O valor ausente é traço, e o traço é apagado: ele marca lugar sem competir com o preenchido. */
.previa__traco {
  color: var(--clinic-faint);
  font-weight: 500;
}

.perfil {
  display: flex;
  align-items: flex-start;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.perfil__avatar {
  display: grid;
  width: 2.9rem;
  height: 2.9rem;
  flex: none;
  border-radius: 999px;
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: 0.02em;
  place-items: center;
}

/*
 * Sem nome, o círculo vira contorno tracejado.
 *
 * Preenchido e vazio precisam ser distinguíveis de relance: um disco cheio e mudo pareceria um
 * avatar que falhou ao carregar, e não um espaço à espera.
 */
.perfil__avatar--vazio {
  border: 1px dashed var(--clinic-line-strong);
  background: transparent;
  color: var(--clinic-faint);
  font-size: 1rem;
}

.perfil__corpo {
  min-width: 0;
  flex: 1 1 auto;
}

.perfil__nome {
  overflow: hidden;
  margin: 0;
  color: var(--clinic-text);
  font-size: var(--clinic-font-title);
  font-weight: 750;
  letter-spacing: -0.015em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.perfil__nome--vazio {
  color: var(--clinic-faint);
  font-weight: 600;
  font-style: italic;
}

.perfil__meta {
  margin: 0.15rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.5;
}

.perfil__sep {
  padding: 0 0.3rem;
  color: var(--clinic-faint);
}

.perfil__peso {
  display: grid;
  flex: none;
  justify-items: end;
  gap: 0.1rem;
  text-align: end;
}

.perfil__peso strong {
  font-size: var(--clinic-font-value);
  font-weight: 750;
}

.quadro {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.quadro__alertas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.quadro__quem {
  margin: 0;
  color: var(--clinic-text);
  font-size: var(--clinic-font-base);
  font-weight: 700;
}

/*
 * Rótulo e valor em duas colunas, e o valor quebra.
 *
 * Endereço completo numa coluna de 22 rem ocupa três linhas — e é assim que ele deve aparecer,
 * inteiro. Cortar com reticências economizaria altura e esconderia justamente o pedaço que a
 * farmácia vai conferir.
 */
.quadro__lista {
  display: grid;
  margin: 0;
  gap: 0.25rem var(--clinic-space-3);
  grid-template-columns: auto minmax(0, 1fr);
}

.quadro__lista dt {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.quadro__lista dd {
  margin: 0;
  color: var(--clinic-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
  overflow-wrap: anywhere;
  text-align: end;
}

.quadro__falta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.quadro__falta i {
  font-size: 0.8rem;
}
</style>
