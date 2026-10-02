<script setup lang="ts">
/**
 * Folha de impressão do prontuário — A4.
 *
 * Não é a tela impressa: é **outro documento**. A tela é feita para preencher, com etapas,
 * botões e um histórico ao lado; o papel é feito para ser lido inteiro de uma vez, arquivado e
 * assinado. Imprimir a tela produziria três páginas de interface e nenhuma de prontuário.
 *
 * Decisões que vêm de documento clínico, não de interface:
 *
 * - **Sem cor.** Preto sobre branco, filetes finos. Poupa toner, sobrevive a fotocópia e a fax
 *   de convênio, e evita que a mesma informação dependa de um matiz que a impressora não tem.
 * - **`não aferido` sai escrito.** É a razão de o campo existir; some no papel e o prontuário
 *   passa a dizer que ninguém mediu quando alguém decidiu não medir.
 * - **A dose sai por extenso**, como na tela: é o texto que o responsável lê em casa.
 * - **Rascunho é carimbado.** Prontuário sem fecho não pode circular parecendo definitivo.
 *
 * Sai por `window.print()`; o destino "Salvar como PDF" do navegador faz o arquivo. Sem
 * biblioteca de PDF: seriam ~200 KB no bundle para reproduzir o que o navegador já faz — e
 * pior, com um segundo motor de layout para manter em dia.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Encounter, Pet, SystemKey, Tutor, VitalKey } from '../../data/types'
import { medicaoPreenchida, statusDaMedicao } from '../../domain/ranges'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  encounter: Encounter
  pet: Pet | null
  tutor: Tutor | null
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const VITAIS: VitalKey[] = [
  'peso',
  'temperatura',
  'frequenciaCardiaca',
  'frequenciaRespiratoria',
  'tempoPreenchimentoCapilar',
  'escoreCorporal',
  'pressaoSistolica',
]

const SISTEMAS: SystemKey[] = [
  'cardiovascular',
  'respiratorio',
  'digestorio',
  'urinario',
  'tegumentar',
  'locomotor',
  'neurologico',
  'linfonodos',
]

const profissional = computed(() => clinico.profissional(props.encounter.professionalId))

const dataDoAtendimento = computed(() =>
  clinicClock.dateOf(props.encounter.finalizadoEm ?? props.encounter.abertoEm),
)

const especie = computed(() => props.pet?.especie ?? 'canina')

function faixaDe(vital: VitalKey) {
  return clinico.faixaDe(vital, especie.value)
}

/** O peso não tem faixa — a unidade vem daqui para não sair um número solto no papel. */
function unidadeDe(vital: VitalKey) {
  return vital === 'peso' ? 'kg' : ''
}

/** Só o que foi registrado vai para o papel — inclusive o "não aferido", que é registro. */
const vitaisRegistrados = computed(() =>
  VITAIS.filter((vital) => medicaoPreenchida(props.encounter.exameFisico.vitais[vital])),
)

const sistemasAvaliados = computed(() =>
  SISTEMAS.filter(
    (sistema) => props.encounter.exameFisico.sistemas[sistema]?.status !== 'nao-avaliado',
  ),
)

/**
 * Sinais gerais viram uma linha de "rótulo: valor" só com o que foi respondido. Imprimir os
 * campos em branco produziria meia página de dois-pontos vazios.
 */
/**
 * Mucosas e hidratação para o papel.
 *
 * Só o que foi avaliado entra: "Mucosas: não avaliadas" num prontuário impresso ocupa linha
 * para dizer que ninguém olhou, e o silêncio já diz isso.
 */
const perfusao = computed(() => {
  const { mucosas, hidratacao } = props.encounter.exameFisico
  const itens: Array<{ rotulo: string; valor: string }> = []

  if (mucosas && mucosas !== 'nao-avaliado') {
    itens.push({
      rotulo: t('clinico.prontuario.exameFisico.mucosas'),
      valor: t(`clinico.prontuario.exameFisico.mucosa.${mucosas}`),
    })
  }

  if (hidratacao) {
    itens.push({
      rotulo: t('clinico.prontuario.exameFisico.hidratacaoRotulo'),
      valor: t(`clinico.prontuario.exameFisico.hidratacao.${hidratacao}`),
    })
  }

  return itens
})

const sinaisGerais = computed(() => {
  const { anamnese } = props.encounter
  const campos: Array<[string, string]> = [
    ['apetite', anamnese.apetite],
    ['evacuacao', anamnese.evacuacao],
    ['miccao', anamnese.miccao],
    ['ambiente', anamnese.ambiente],
  ]

  const registrados = campos
    .filter(([, valor]) => Boolean(valor))
    .map(([campo, valor]) => ({
      rotulo: t(`clinico.prontuario.anamnese.${campo}`),
      valor: t(`clinico.prontuario.anamnese.opcoes.${valor}`),
    }))

  for (const [campo, valor] of [
    ['vacinacao', anamnese.vacinacaoEmDia],
    ['vermifugacao', anamnese.vermifugacaoEmDia],
  ] as const) {
    if (valor !== null) {
      registrados.push({
        rotulo: t(`clinico.prontuario.anamnese.${campo}`),
        valor: t(`clinico.prontuario.anamnese.opcoes.${valor ? 'sim' : 'nao'}`),
      })
    }
  }

  return registrados
})

function resumoDaDose(prescricaoId: string) {
  const prescricao = props.encounter.conduta.prescricoes.find((item) => item.id === prescricaoId)
  const medicamento = prescricao ? clinico.medicamento(prescricao.medicamentoId) : null

  if (!prescricao || !medicamento) {
    return ''
  }

  return t('clinico.prontuario.conduta.resumoDose', {
    quantidade: formato.numero(prescricao.calculo.quantidadeApresentacao, 2),
    unidade: t(
      `clinico.prontuario.conduta.unidade.${medicamento.unidadeApresentacao}`,
      prescricao.calculo.quantidadeApresentacao,
    ),
    mg: formato.numero(prescricao.calculo.mgPorAdministracao, 1),
    frequencia: prescricao.calculo.frequenciaHoras,
    duracao: prescricao.calculo.duracaoDias,
    total: prescricao.calculo.totalAdministracoes,
  })
}

const condutaVazia = computed(() => {
  const { conduta } = props.encounter

  return (
    !conduta.orientacoes.trim() &&
    conduta.prescricoes.length === 0 &&
    conduta.examesSolicitados.length === 0 &&
    conduta.retorno.emDias === null
  )
})

function nomeDoExame(id: string) {
  return clinico.exames.find((exame) => exame.id === id)?.nome ?? id
}
</script>

<template>
  <article class="folha">
    <!-- Rascunho carimbado: documento sem fecho não circula parecendo definitivo. -->
    <p v-if="encounter.status === 'rascunho'" class="folha__rascunho">
      {{ t('clinico.prontuario.rascunho') }}
    </p>

    <header class="folha__topo">
      <div>
        <h1 class="folha__clinica">{{ clinico.clinic?.nome }}</h1>
        <p class="folha__titulo">{{ t('clinico.prontuario.impressao.titulo') }}</p>
      </div>

      <dl class="folha__meta">
        <div>
          <dt>{{ t('clinico.prontuario.impressao.dataAtendimento') }}</dt>
          <dd>{{ formato.dataPorExtenso(dataDoAtendimento) }}</dd>
        </div>
        <div>
          <dt>{{ t('clinico.agenda.mover.profissional') }}</dt>
          <dd>{{ profissional?.nome }} · {{ profissional?.conselho }}</dd>
        </div>
      </dl>
    </header>

    <!-- identificação -->
    <section class="bloco bloco--identificacao">
      <div>
        <h2>{{ t('clinico.prontuario.impressao.paciente') }}</h2>
        <p class="folha__destaque">{{ pet?.nome }}</p>
        <p>
          {{ pet ? formato.especie(pet.especie) : '' }} · {{ pet?.raca }} ·
          {{ pet ? formato.sexo(pet.sexo) : '' }} ·
          {{ pet ? formato.idade(pet.nascimento) : '' }} ·
          {{ formato.peso(pet?.pesoKg ?? null) }}
        </p>
        <p v-if="pet && pet.alertas.length > 0" class="folha__alertas">
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

    <!-- anamnese -->
    <section class="bloco">
      <h2>{{ t('clinico.prontuario.anamnese.titulo') }}</h2>

      <p class="campo">
        <span class="campo__rotulo">{{ t('clinico.prontuario.anamnese.queixaPrincipal') }}</span>
        <span>{{ encounter.anamnese.queixaPrincipal || '—' }}</span>
      </p>

      <p v-if="encounter.anamnese.duracaoSintomas" class="campo">
        <span class="campo__rotulo">{{ t('clinico.prontuario.anamnese.duracaoSintomas') }}</span>
        <span>{{ encounter.anamnese.duracaoSintomas }}</span>
      </p>

      <p v-if="encounter.anamnese.historia" class="campo campo--texto">
        <span class="campo__rotulo">{{ t('clinico.prontuario.anamnese.historia') }}</span>
        <span>{{ encounter.anamnese.historia }}</span>
      </p>

      <p v-if="sinaisGerais.length > 0" class="campo">
        <span class="campo__rotulo">{{ t('clinico.prontuario.anamnese.sinaisGerais') }}</span>
        <span>
          <template v-for="(sinal, indice) in sinaisGerais" :key="sinal.rotulo">
            <template v-if="indice > 0"> · </template>{{ sinal.rotulo }}: {{ sinal.valor }}
          </template>
        </span>
      </p>
    </section>

    <!-- exame físico -->
    <section class="bloco">
      <h2>{{ t('clinico.prontuario.exameFisico.titulo') }}</h2>

      <!--
        Mucosas e hidratação antes da tabela de vitais: no papel, é a leitura de perfusão que
        contextualiza os números que vêm em seguida. A hidratação saiu da anamnese e chegou
        aqui — é achado de exame, não relato do responsável.
      -->
      <p v-if="perfusao.length > 0" class="campo">
        <span class="campo__rotulo">{{ t('clinico.prontuario.exameFisico.perfusao') }}</span>
        <span>
          <template v-for="(item, indice) in perfusao" :key="item.rotulo">
            <template v-if="indice > 0"> · </template>{{ item.rotulo }}: {{ item.valor }}
          </template>
        </span>
      </p>

      <table v-if="vitaisRegistrados.length > 0" class="tabela">
        <thead>
          <tr>
            <th>{{ t('clinico.prontuario.exameFisico.vitais') }}</th>
            <th class="tabela__numero">{{ t('clinico.prontuario.impressao.valor') }}</th>
            <th class="tabela__numero">{{ t('clinico.prontuario.referencia') }}</th>
            <th>{{ t('clinico.prontuario.filtro.situacao') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="vital in vitaisRegistrados" :key="vital">
            <td>{{ t(`clinico.prontuario.exameFisico.${vital}`) }}</td>
            <td class="tabela__numero">
              {{
                formato.medicao(
                  encounter.exameFisico.vitais[vital],
                  faixaDe(vital),
                  unidadeDe(vital),
                )
              }}
            </td>
            <td class="tabela__numero">
              {{ faixaDe(vital) ? formato.faixaDeReferencia(faixaDe(vital)) : '—' }}
            </td>
            <!--
              Sem faixa cadastrada, a coluna de situação fica vazia em vez de repetir "sem
              faixa" ao lado de "sem faixa de referência". O traço já disse.
            -->
            <td>
              <template v-if="faixaDe(vital)">
                {{
                  formato.statusDeFaixa(
                    statusDaMedicao(encounter.exameFisico.vitais[vital], faixaDe(vital)),
                  )
                }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else class="folha__nota">{{ t('clinico.prontuario.impressao.semRegistro') }}</p>

      <p v-if="sistemasAvaliados.length > 0" class="campo campo--texto">
        <span class="campo__rotulo">{{ t('clinico.prontuario.exameFisico.sistemas') }}</span>
        <span>
          <template v-for="(sistema, indice) in sistemasAvaliados" :key="sistema">
            <template v-if="indice > 0"> · </template>
            {{ t(`clinico.prontuario.exameFisico.sistema.${sistema}`) }}:
            {{
              t(
                `clinico.prontuario.exameFisico.achado.${encounter.exameFisico.sistemas[sistema]?.status}`,
              )
            }}<template v-if="encounter.exameFisico.sistemas[sistema]?.nota">
              — {{ encounter.exameFisico.sistemas[sistema]?.nota }}</template>
          </template>
        </span>
      </p>

      <p v-if="encounter.exameFisico.observacao" class="campo campo--texto">
        <span class="campo__rotulo">{{ t('clinico.prontuario.exameFisico.observacao') }}</span>
        <span>{{ encounter.exameFisico.observacao }}</span>
      </p>
    </section>

    <!-- diagnóstico -->
    <section class="bloco">
      <h2>{{ t('clinico.prontuario.diagnostico.titulo') }}</h2>

      <ul v-if="encounter.diagnosticos.length > 0" class="itens">
        <li v-for="diagnostico in encounter.diagnosticos" :key="diagnostico.id">
          <strong>{{ diagnostico.codigo }}</strong> {{ clinico.descricaoDoDiagnostico(diagnostico) }} —
          {{ t(`clinico.prontuario.diagnostico.tipo.${diagnostico.kind}`) }}
        </li>
      </ul>

      <p v-else class="folha__nota">{{ t('clinico.prontuario.diagnostico.vazio') }}</p>
    </section>

    <!-- conduta -->
    <section class="bloco">
      <h2>{{ t('clinico.prontuario.conduta.titulo') }}</h2>

      <p v-if="encounter.conduta.orientacoes" class="campo campo--texto">
        <span class="campo__rotulo">{{ t('clinico.prontuario.conduta.orientacoes') }}</span>
        <span>{{ encounter.conduta.orientacoes }}</span>
      </p>

      <template v-if="encounter.conduta.prescricoes.length > 0">
        <h3>{{ t('clinico.prontuario.conduta.prescricoes') }}</h3>
        <ol class="itens itens--numerada">
          <li v-for="prescricao in encounter.conduta.prescricoes" :key="prescricao.id">
            <strong>{{ clinico.medicamento(prescricao.medicamentoId)?.nome }}</strong>
            — {{ t(`clinico.prontuario.conduta.via_.${prescricao.via}`) }}
            <br />
            <span class="itens__dose">{{ resumoDaDose(prescricao.id) }}</span>
            <template v-if="prescricao.observacao">
              <br />
              <span class="itens__nota">{{ prescricao.observacao }}</span>
            </template>
          </li>
        </ol>
      </template>

      <p v-if="encounter.conduta.examesSolicitados.length > 0" class="campo campo--texto">
        <span class="campo__rotulo">{{ t('clinico.prontuario.conduta.exames') }}</span>
        <span>
          {{ encounter.conduta.examesSolicitados.map(nomeDoExame).join(' · ') }}
        </span>
      </p>

      <p v-if="encounter.conduta.retorno.emDias !== null" class="campo">
        <span class="campo__rotulo">{{ t('clinico.prontuario.conduta.retorno') }}</span>
        <span>
          {{
            t('clinico.formato.dias', { valor: encounter.conduta.retorno.emDias }, encounter.conduta.retorno.emDias)
          }}
        </span>
      </p>

      <!-- Título mudo é pior que ausência: se nada foi registrado, o papel diz isso. -->
      <p v-if="condutaVazia" class="folha__nota">
        {{ t('clinico.prontuario.impressao.naoRegistrado') }}
      </p>
    </section>

    <!-- assinatura -->
    <footer class="folha__rodape">
      <div class="folha__assinatura">
        <span class="folha__linha" aria-hidden="true" />
        <p>{{ profissional?.nome }}</p>
        <p class="folha__conselho">{{ profissional?.conselho }}</p>
      </div>

      <p class="folha__emissao">
        {{ t('clinico.prontuario.impressao.emitidoEm', { data: formato.dataPorExtenso(clinicClock.today()) }) }}
      </p>
    </footer>
  </article>
</template>

<style scoped>
/*
 * A folha é desenhada em milímetros e em preto sobre branco: as unidades da tela (rem que
 * seguem a densidade escolhida, tokens que mudam com o modo escuro) não têm significado no
 * papel. Nada aqui usa `--clinic-*` de propósito.
 */
.folha {
  position: relative;
  width: 100%;
  max-width: 180mm;
  margin: 0 auto;
  color: #000;
  font-family: 'DM Sans', 'PetJourney Arabic', 'Segoe UI', system-ui, sans-serif;
  font-size: 9.5pt;
  line-height: 1.45;
}

/* Nenhuma cor da interface atravessa para o papel — nem por herança, nem por engano. */
.folha *,
.folha *::before,
.folha *::after {
  color: #000;
}

.folha__nota {
  margin: 0;
  font-style: italic;
}

.folha__rascunho {
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

.bloco {
  margin-top: 5mm;
  /* Bloco não se parte entre páginas quando cabe inteiro na seguinte. */
  break-inside: avoid;
}

.bloco--identificacao {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 6mm;
  padding: 3mm;
  border: 0.8pt solid #000;
}

.bloco h2 {
  margin: 0 0 1.5mm;
  font-size: 8pt;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.bloco h3 {
  margin: 3mm 0 1mm;
  font-size: 8.5pt;
  font-weight: 800;
}

.bloco p {
  margin: 0 0 1mm;
}

.folha__destaque {
  font-size: 11pt;
  font-weight: 800;
}

.folha__alertas {
  margin-top: 1.5mm;
}

.campo {
  display: grid;
  grid-template-columns: 38mm 1fr;
  gap: 3mm;
  padding: 1mm 0;
  border-bottom: 0.4pt dotted #999;
}

.campo--texto {
  grid-template-columns: 1fr;
  gap: 0.5mm;
}

.campo__rotulo {
  font-size: 7.5pt;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tabela {
  width: 100%;
  border-collapse: collapse;
}

.tabela th,
.tabela td {
  padding: 1mm 2mm;
  border-bottom: 0.4pt solid #666;
  text-align: start;
}

.tabela th {
  border-bottom-width: 0.8pt;
  font-size: 7.5pt;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tabela__numero {
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.itens {
  margin: 0;
  padding-inline-start: 5mm;
}

.itens li {
  margin-bottom: 1.5mm;
  break-inside: avoid;
}

.itens__dose {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.itens__nota {
  font-size: 8.5pt;
}

.folha__rodape {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6mm;
  margin-top: 12mm;
  break-inside: avoid;
}

.folha__assinatura {
  width: 80mm;
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
  font-size: 7.5pt;
}
</style>
