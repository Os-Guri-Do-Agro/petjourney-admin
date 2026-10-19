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

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

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
    <p class="previa__selo">
      <i class="ph ph-eye" aria-hidden="true" />
      {{ t('clinico.paciente.novo.previa.titulo') }}
    </p>

    <div class="previa__folha ui-folha">
      <!--
        A faixa de identidade.

        Rosto, nome e atributos na mesma ordem da capa da ficha — é a forma que quem usa o sistema
        já reconhece, e reconhecê-la aqui é o que faz a prévia parecer o resultado e não uma
        repetição do formulário. O rosto é o mesmo `PetAvatar` da lista e da ficha.
      -->
      <header class="perfil">
        <PetAvatar
          v-if="iniciais"
          class="perfil__avatar"
          :nome="nome"
          :iniciais="iniciais"
          :especie="pet?.especie ?? null"
          tamanho="lg"
        />
        <span v-else class="perfil__avatar perfil__avatar--vazio" aria-hidden="true">
          <i class="ph ph-paw-print" />
        </span>

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
          <small>{{ t('clinico.prontuario.exameFisico.peso') }}</small>
          <strong class="ui-num" :class="{ previa__traco: peso === TRACO }">{{ peso }}</strong>
        </div>
      </header>

      <section class="quadro">
        <h4 class="quadro__titulo">{{ t('clinico.paciente.novo.alertas') }}</h4>

        <div v-if="alertas.length > 0" class="quadro__alertas">
          <ClinicAlertChip
            v-for="alerta in alertas"
            :key="alerta.id"
            :severidade="alerta.severidade"
            :rotulo="formato.alerta(alerta.kind)"
            :detalhe="alerta.detalhe"
          />
        </div>

        <p v-else class="quadro__nada previa__traco">
          {{ t('clinico.paciente.novo.previa.semAlertas') }}
        </p>
      </section>

      <section class="quadro">
        <h4 class="quadro__titulo">{{ t('clinico.paciente.novo.identificacao') }}</h4>
        <dl class="quadro__lista">
          <template v-for="linha in identificacao" :key="linha.rotulo">
            <dt>{{ linha.rotulo }}</dt>
            <dd :class="{ previa__traco: !linha.valor }">{{ linha.valor || TRACO }}</dd>
          </template>
        </dl>
      </section>

      <section class="quadro">
        <h4 class="quadro__titulo">{{ t('clinico.paciente.responsavel') }}</h4>

        <p v-if="tutor?.nome" class="quadro__quem">
          <i class="ph ph-user" aria-hidden="true" />
          {{ tutor.nome }}
        </p>
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
    </div>
  </aside>
</template>

<style scoped>
.previa {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 10px;
}

/* A legenda da coluna: o que ela é, em tinta secundária, acima da folha. */
.previa__selo {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 550;
}

.previa__selo i {
  font-size: 17px;
}

.previa__folha {
  display: grid;
  overflow: hidden;
}

/* O valor ausente é traço, e o traço é apagado: ele marca lugar sem competir com o preenchido. */
.previa__traco {
  color: var(--tinta-3);
  font-weight: 400;
}

/* ---------------------------------------------------------------------------------- o perfil */

.perfil {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 20px 18px;
  background: color-mix(in oklab, var(--pj-lugar-fundo, var(--clinica-fundo)) 45%, var(--superficie));
}

.perfil__avatar {
  flex: none;
}

/*
 * Sem nome, o círculo vira contorno tracejado.
 *
 * Preenchido e vazio precisam ser distinguíveis de relance: um disco cheio e mudo pareceria um
 * avatar que falhou ao carregar, e não um espaço à espera.
 */
.perfil__avatar--vazio {
  display: grid;
  width: 3.25rem;
  height: 3.25rem;
  place-items: center;
  border: 1.5px dashed var(--linha-forte);
  border-radius: 50%;
  color: var(--tinta-3);
  font-size: 22px;
}

.perfil__corpo {
  min-width: 0;
  flex: 1 1 auto;
}

.perfil__nome {
  overflow: hidden;
  margin: 0;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.015em;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.perfil__nome--vazio {
  color: var(--tinta-3);
  font-weight: 500;
}

.perfil__meta {
  margin: 3px 0 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.5;
}

.perfil__sep {
  padding: 0 5px;
  color: var(--tinta-3);
}

.perfil__peso {
  display: grid;
  flex: none;
  justify-items: end;
  gap: 1px;
  text-align: end;
}

.perfil__peso small {
  color: var(--tinta-2);
  font-size: 12px;
}

.perfil__peso strong {
  color: var(--tinta);
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

/* --------------------------------------------------------------------------------- os quadros */

.quadro {
  display: grid;
  gap: 10px;
  padding: 16px 20px 18px;
  border-top: 1px solid var(--linha);
}

.quadro__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.quadro__alertas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.quadro__nada {
  margin: 0;
  font-size: 13.5px;
}

.quadro__quem {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.quadro__quem i {
  color: var(--tinta-2);
  font-size: 16px;
}

/*
 * Rótulo e valor em duas colunas, e o valor quebra.
 *
 * Endereço completo numa coluna estreita ocupa três linhas — e é assim que ele deve aparecer,
 * inteiro. Cortar com reticências economizaria altura e esconderia justamente o pedaço que a
 * farmácia vai conferir.
 */
.quadro__lista {
  display: grid;
  margin: 0;
  gap: 6px 16px;
  grid-template-columns: auto minmax(0, 1fr);
}

.quadro__lista dt {
  color: var(--tinta-2);
  font-size: 13px;
}

.quadro__lista dd {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 550;
  overflow-wrap: anywhere;
  text-align: end;
}

.quadro__lista dd.previa__traco {
  font-weight: 400;
}

.quadro__falta {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 13.5px;
  font-weight: 550;
}

.quadro__falta i {
  flex: none;
  font-size: 16px;
}
</style>
