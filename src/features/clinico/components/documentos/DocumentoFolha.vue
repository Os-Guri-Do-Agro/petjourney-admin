<script setup lang="ts">
/**
 * Casca A4 comum aos documentos que saem da clínica.
 *
 * Prontuário, receituário e atestado compartilham a mesma moldura porque são o **mesmo
 * documento institucional** com corpos diferentes: cabeçalho com a clínica e o responsável
 * técnico, identificação de paciente e responsável, e o rodapé de assinatura. Cada um repetindo
 * essa moldura por conta própria significaria três lugares para atualizar quando o CRMV mudar a
 * exigência de um campo — e três chances de esquecer um.
 *
 * Tudo aqui é desenhado em milímetros e em preto sobre branco. As unidades da tela — `rem` que
 * seguem a densidade escolhida, tokens que mudam no modo escuro — não têm significado no papel,
 * e nenhuma variável `--clinic-*` atravessa para cá de propósito.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import type { ISODate, Pet, Tutor } from '../../data/types'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    titulo: string
    professionalId: string
    pet: Pet | null
    tutor: Tutor | null
    dataDocumento: ISODate
    /** Faixa no topo: rascunho, via de retenção, o que a folha precisar anunciar. */
    carimbo?: string
    /** Alertas do paciente na identificação. O atestado de comparecimento não os expõe. */
    mostrarAlertas?: boolean
    /** Endereço do prescritor, exigido no receituário de controle especial. */
    mostrarEndereco?: boolean
  }>(),
  { carimbo: '', mostrarAlertas: true, mostrarEndereco: false },
)

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const profissional = computed(() => clinico.profissional(props.professionalId))
</script>

<template>
  <article class="folha">
    <p v-if="carimbo" class="folha__carimbo">{{ carimbo }}</p>

    <header class="folha__topo">
      <div>
        <h1 class="folha__clinica">{{ clinico.clinic?.nome }}</h1>
        <p class="folha__titulo">{{ titulo }}</p>
        <p v-if="mostrarEndereco && clinico.clinic" class="folha__endereco">
          {{ clinico.clinic.endereco }} · <bdi dir="ltr">{{ clinico.clinic.telefone }}</bdi>
        </p>
      </div>

      <dl class="folha__meta">
        <div>
          <dt>{{ t('clinico.documentos.data') }}</dt>
          <dd>{{ formato.dataPorExtenso(dataDocumento) }}</dd>
        </div>
        <div>
          <dt>{{ t('clinico.agenda.mover.profissional') }}</dt>
          <dd>{{ profissional?.nome }} · {{ profissional?.conselho }}</dd>
        </div>
      </dl>
    </header>

    <section class="folha__identificacao">
      <div>
        <h2>{{ t('clinico.prontuario.impressao.paciente') }}</h2>
        <p class="folha__destaque">{{ pet?.nome }}</p>
        <p>
          {{ pet ? formato.especie(pet.especie) : '' }} · {{ pet?.raca }} ·
          {{ pet ? t(`clinico.sexo.${pet.sexo}`) : '' }} ·
          {{ pet ? formato.idade(pet.nascimento) : '' }} ·
          {{ formato.peso(pet?.pesoKg ?? null) }}
        </p>
        <p v-if="mostrarAlertas && pet && pet.alertas.length > 0" class="folha__alertas">
          <strong>{{ t('clinico.pacientes.colunaAlertas') }}:</strong>
          <span v-for="(alerta, indice) in pet.alertas" :key="alerta.id">
            <template v-if="indice > 0"> · </template>
            {{ formato.alerta(alerta.kind) }}{{ alerta.detalhe ? ` (${alerta.detalhe})` : '' }}
          </span>
        </p>
      </div>

      <div>
        <h2>{{ t('clinico.paciente.responsavel') }}</h2>
        <p class="folha__destaque">{{ tutor?.nome }}</p>
        <p><bdi dir="ltr">{{ tutor?.telefone }}</bdi></p>
        <p v-if="tutor?.documento">
          {{ t('clinico.prontuario.impressao.documento') }} {{ tutor.documento }}
        </p>
      </div>
    </section>

    <div class="folha__corpo">
      <slot />
    </div>

    <footer class="folha__rodape">
      <slot name="antes-da-assinatura" />

      <div class="folha__assinatura">
        <span class="folha__linha" aria-hidden="true" />
        <p>{{ profissional?.nome }}</p>
        <p class="folha__conselho">{{ profissional?.conselho }}</p>
      </div>

      <p class="folha__emissao">
        {{
          t('clinico.prontuario.impressao.emitidoEm', {
            data: formato.dataPorExtenso(clinicClock.today()),
          })
        }}
      </p>
    </footer>
  </article>
</template>

<style scoped>
.folha {
  position: relative;
  display: flex;
  width: 100%;
  max-width: 180mm;
  min-height: 245mm;
  flex-direction: column;
  margin: 0 auto;
  color: #000;
  font-family: 'DM Sans', 'PetJourney Arabic', 'Segoe UI', system-ui, sans-serif;
  font-size: 9.5pt;
  line-height: 1.45;
}

/* Nenhuma cor da interface atravessa para o papel — nem por herança, nem por engano. */
.folha :deep(*),
.folha :deep(*::before),
.folha :deep(*::after) {
  color: #000;
}

.folha__carimbo {
  margin: 0 0 4mm;
  padding: 1.5mm 3mm;
  border: 1pt dashed #000;
  font-size: 8pt;
  font-weight: 800;
  letter-spacing: 0.25em;
  text-align: center;
  text-transform: uppercase;
}

.folha__topo {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6mm;
  padding-bottom: 3mm;
  border-bottom: 1.2pt solid #000;
}

.folha__clinica {
  margin: 0;
  font-size: 13pt;
  font-weight: 800;
  letter-spacing: -0.01em;
}

.folha__titulo {
  margin: 0.5mm 0 0;
  font-size: 9pt;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.folha__endereco {
  margin: 1mm 0 0;
  font-size: 8pt;
}

.folha__meta {
  margin: 0;
  text-align: end;
}

.folha__meta div + div {
  margin-top: 1mm;
}

.folha__meta dt {
  font-size: 7pt;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.folha__meta dd {
  margin: 0;
  font-weight: 700;
}

.folha__identificacao {
  display: grid;
  gap: 6mm;
  margin: 4mm 0;
  padding: 3mm 4mm;
  border: 0.8pt solid #000;
  grid-template-columns: 1fr 1fr;
}

.folha__identificacao h2 {
  margin: 0 0 1mm;
  font-size: 7.5pt;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.folha__identificacao p {
  margin: 0;
}

.folha__destaque {
  font-size: 11pt;
  font-weight: 800;
}

.folha__alertas {
  margin-top: 1mm;
}

/* O corpo empurra o rodapé para o pé da página, mesmo em documento curto. */
.folha__corpo {
  flex: 1 1 auto;
}

.folha__rodape {
  margin-top: 8mm;
  padding-top: 3mm;
  border-top: 0.8pt solid #000;
}

.folha__assinatura {
  width: 75mm;
  margin-top: 6mm;
  text-align: center;
}

.folha__linha {
  display: block;
  height: 0;
  margin-bottom: 1.5mm;
  border-top: 0.8pt solid #000;
}

.folha__assinatura p {
  margin: 0;
  font-weight: 700;
}

.folha__conselho {
  font-size: 8pt;
  font-weight: 400 !important;
}

.folha__emissao {
  margin: 4mm 0 0;
  font-size: 8pt;
  text-align: end;
}
</style>
