<script setup lang="ts">
/**
 * Receituário veterinário — A4.
 *
 * **Medicamento sob controle especial sai em folha separada, e em duas vias.** Não é preferência
 * de layout: a Portaria 344/98 exige receituário próprio, com retenção de uma via na farmácia e
 * identificação de comprador e fornecedor. Misturar dipirona e tramadol na mesma folha faz a
 * farmácia reter o papel inteiro — e o responsável vai embora sem a receita do resto.
 *
 * Por isso o componente emite até três folhas a partir da mesma conduta:
 *
 * 1. receituário simples, com o que não é controlado;
 * 2. e 3. receituário de controle especial, com o que é, em 1ª e 2ª via.
 *
 * A posologia sai **por extenso** — "0,26 mL (128,0 mg) a cada 8 h por 5 dias" —, que é o texto
 * que o responsável lê em casa e o balconista confere. Número solto em campo de formulário é
 * onde erro de vírgula vira erro de paciente.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import DocumentoFolha from './DocumentoFolha.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Encounter, Pet, Prescription, Tutor } from '../../data/types'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  encounter: Encounter
  pet: Pet | null
  tutor: Tutor | null
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const dataDoDocumento = computed(() =>
  clinicClock.dateOf(props.encounter.finalizadoEm ?? props.encounter.abertoEm),
)

type Item = {
  id: string
  nome: string
  apresentacao: string
  via: string
  posologia: string
  quantidade: string
  observacao: string
  controlado: boolean
}

function montarItem(prescricao: Prescription): Item | null {
  const medicamento = clinico.medicamento(prescricao.medicamentoId)

  if (!medicamento) {
    return null
  }

  const { calculo } = prescricao
  const unidade = t(
    `clinico.prontuario.conduta.unidade.${medicamento.unidadeApresentacao}`,
    calculo.quantidadeApresentacao,
  )

  return {
    id: prescricao.id,
    nome: medicamento.nome,
    apresentacao: medicamento.apresentacao,
    via: t(`clinico.prontuario.conduta.via_.${prescricao.via}`),
    posologia:
      calculo.quantidadeApresentacao > 0
        ? t('clinico.prontuario.conduta.resumoDose', {
            quantidade: formato.numero(calculo.quantidadeApresentacao, 2),
            unidade,
            mg: formato.numero(calculo.mgPorAdministracao, 1),
            frequencia: calculo.frequenciaHoras,
            duracao: calculo.duracaoDias,
            total: calculo.totalAdministracoes,
          })
        : t('clinico.prontuario.conduta.semPeso'),
    /** Quantidade total a dispensar: é o que a farmácia precisa para separar a caixa. */
    quantidade: t('clinico.documentos.receita.quantidadeTotal', {
      valor: formato.numero(
        calculo.quantidadeApresentacao * calculo.totalAdministracoes,
        calculo.quantidadeApresentacao * calculo.totalAdministracoes < 10 ? 2 : 1,
      ),
      unidade: t(
        `clinico.prontuario.conduta.unidade.${medicamento.unidadeApresentacao}`,
        calculo.quantidadeApresentacao * calculo.totalAdministracoes,
      ),
    }),
    observacao: prescricao.observacao,
    controlado: medicamento.controlado,
  }
}

const itens = computed(() =>
  props.encounter.conduta.prescricoes
    .map(montarItem)
    .filter((item): item is Item => item !== null),
)

const comuns = computed(() => itens.value.filter((item) => !item.controlado))
const controlados = computed(() => itens.value.filter((item) => item.controlado))

/** Folhas realmente emitidas: sem controlado, não existe a 1ª e a 2ª via. */
const folhas = computed(() => {
  const lista: { chave: string; titulo: string; carimbo: string; itens: Item[]; controle: boolean }[] =
    []

  if (comuns.value.length > 0) {
    lista.push({
      chave: 'simples',
      titulo: t('clinico.documentos.receita.titulo'),
      carimbo: '',
      itens: comuns.value,
      controle: false,
    })
  }

  for (const via of ['primeira', 'segunda'] as const) {
    if (controlados.value.length === 0) {
      break
    }

    lista.push({
      chave: `controle-${via}`,
      titulo: t('clinico.documentos.receita.tituloControle'),
      carimbo: t(`clinico.documentos.receita.via.${via}`),
      itens: controlados.value,
      controle: true,
    })
  }

  return lista
})

const orientacoes = computed(() => props.encounter.conduta.orientacoes.trim())
</script>

<template>
  <div class="receituario">
    <p v-if="folhas.length === 0" class="receituario__vazio">
      {{ t('clinico.documentos.receita.semPrescricao') }}
    </p>

    <DocumentoFolha
      v-for="folha in folhas"
      :key="folha.chave"
      class="receituario__folha"
      :titulo="folha.titulo"
      :carimbo="folha.carimbo"
      :professional-id="encounter.professionalId"
      :pet="pet"
      :tutor="tutor"
      :data-documento="dataDoDocumento"
      :mostrar-endereco="folha.controle"
    >
      <ol class="itens">
        <li v-for="(item, indice) in folha.itens" :key="item.id" class="item">
          <p class="item__nome">{{ indice + 1 }}. {{ item.nome }}</p>
          <p class="item__apresentacao">{{ item.apresentacao }}</p>
          <p class="item__quantidade">{{ item.quantidade }}</p>
          <p class="item__posologia">
            <strong>{{ t('clinico.documentos.receita.usoRotulo') }}</strong>
            {{ item.via }} — {{ item.posologia }}
          </p>
          <p v-if="item.observacao" class="item__observacao">{{ item.observacao }}</p>
        </li>
      </ol>

      <section v-if="orientacoes" class="orientacoes">
        <h2>{{ t('clinico.prontuario.conduta.orientacoes') }}</h2>
        <p>{{ orientacoes }}</p>
      </section>

      <!--
        Identificação de comprador e fornecedor: campos em branco de propósito. Quem preenche é
        a farmácia, no ato da dispensação — imprimir preenchido inventaria um dado que a clínica
        não tem.
      -->
      <section v-if="folha.controle" class="controle">
        <div class="controle__caixa">
          <h3>{{ t('clinico.documentos.receita.comprador') }}</h3>
          <p class="controle__linha">{{ t('clinico.documentos.receita.nome') }}</p>
          <p class="controle__linha">{{ t('clinico.documentos.receita.documentoIdentidade') }}</p>
          <p class="controle__linha">{{ t('clinico.documentos.receita.endereco') }}</p>
          <p class="controle__linha">{{ t('clinico.documentos.receita.telefone') }}</p>
        </div>

        <div class="controle__caixa">
          <h3>{{ t('clinico.documentos.receita.fornecedor') }}</h3>
          <p class="controle__linha">{{ t('clinico.documentos.receita.nome') }}</p>
          <p class="controle__linha">{{ t('clinico.documentos.receita.dataDispensacao') }}</p>
          <p class="controle__linha controle__linha--alta">
            {{ t('clinico.documentos.receita.assinaturaFarmaceutico') }}
          </p>
        </div>
      </section>

      <template #antes-da-assinatura>
        <p v-if="folha.controle" class="controle__aviso">
          {{ t('clinico.documentos.receita.avisoControle') }}
        </p>
      </template>
    </DocumentoFolha>
  </div>
</template>

<style scoped>
.receituario__vazio {
  margin: 0;
  font-style: italic;
}

/* Cada folha é uma página: a quebra é a regra, não o acaso do fluxo. */
.receituario__folha + .receituario__folha {
  margin-top: 10mm;
  break-before: page;
}

.itens {
  margin: 4mm 0 0;
  padding: 0;
  list-style: none;
}

.item + .item {
  margin-top: 4mm;
  padding-top: 4mm;
  border-top: 0.4pt solid #000;
}

.item p {
  margin: 0;
}

.item__nome {
  font-size: 11pt;
  font-weight: 800;
}

.item__apresentacao {
  font-size: 8.5pt;
}

.item__quantidade {
  margin-top: 1mm !important;
  font-weight: 700;
}

.item__posologia {
  margin-top: 1.5mm !important;
}

.item__observacao {
  margin-top: 1mm !important;
  font-style: italic;
}

.orientacoes {
  margin-top: 6mm;
  padding-top: 3mm;
  border-top: 0.4pt solid #000;
}

.orientacoes h2 {
  margin: 0 0 1mm;
  font-size: 7.5pt;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.orientacoes p {
  margin: 0;
}

.controle {
  display: grid;
  gap: 4mm;
  margin-top: 6mm;
  grid-template-columns: 1fr 1fr;
}

.controle__caixa {
  padding: 2.5mm 3mm;
  border: 0.6pt solid #000;
}

.controle__caixa h3 {
  margin: 0 0 2mm;
  font-size: 7pt;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.controle__linha {
  margin: 0 0 4mm;
  border-bottom: 0.4pt solid #000;
  font-size: 7.5pt;
}

.controle__linha--alta {
  margin-bottom: 6mm;
}

.controle__aviso {
  margin: 0;
  font-size: 8pt;
  font-weight: 700;
}
</style>
