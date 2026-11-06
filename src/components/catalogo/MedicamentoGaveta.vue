<script setup lang="ts">
/**
 * Medicamento da clínica: criar e editar (E4-02, guia e4 1.7). O catálogo global é só leitura; a
 * clínica acrescenta o manipulado, o importado, o que é dela. Até 2.000 por clínica.
 *
 * Por assunto, de cima para baixo: o que é (nome, princípio, apresentação), a dose (a faixa geral e
 * a de cada espécie, com o proibido), o controle e as vias, e o texto de apoio (uma linha por item).
 * As traduções ficam de fora: sem elas, o item aparece em português em todos os idiomas.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  criarAcrescimo,
  editarAcrescimo,
  ESPECIES_DO_CATALOGO,
  type EspecieDoCatalogo,
  type Medicamento,
  type NovoMedicamento,
} from '@/service/parceiro/catalogos-service'

const props = defineProps<{ medicamento: Medicamento | null }>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: []; noLimite: [] }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const CLASSES = [
  'ANTIBIOTICO',
  'ANTI_INFLAMATORIO',
  'ANALGESICO',
  'CORTICOIDE',
  'ANTIEMETICO',
  'GASTROPROTETOR',
  'ANTIPARASITARIO',
  'SEDATIVO',
  'CARDIOLOGICO',
  'DERMATOLOGICO',
  'OUTRA',
] as const
const UNIDADES = ['ML', 'COMPRIMIDO', 'GOTA', 'APLICACAO'] as const
const CONTROLES = ['NENHUM', 'MAPA_VETERINARIO', 'ANVISA_HUMANO', 'ANVISA_RETENCAO'] as const
const VIAS = [
  'ORAL',
  'SUBCUTANEA',
  'INTRAMUSCULAR',
  'INTRAVENOSA',
  'TOPICA',
  'OTOLOGICA',
  'OFTALMICA',
  'INTRANASAL',
] as const
const CUIDADOS = [
  'GESTANTE',
  'LACTANTE',
  'FILHOTE',
  'IDOSO',
  'RENAL',
  'HEPATICO',
  'CARDIACO',
  'GASTRICO',
] as const

type Dose = {
  especie: EspecieDoCatalogo | null
  mgKgMin: number | null
  mgKgMax: number | null
  frequenciaHoras: number | null
  duracaoUsualDias: number | null
  proibido: boolean
  nota: string
}

const nome = ref('')
const principioAtivo = ref('')
const apresentacao = ref('')
const concentracao = ref<number | null>(null)
const unidade = ref<(typeof UNIDADES)[number]>('COMPRIMIDO')
const classe = ref<string>('OUTRA')
const controle = ref<(typeof CONTROLES)[number]>('NENHUM')
const listaControle = ref('')
const manipulado = ref(false)
const vias = ref<string[]>(['ORAL'])
const doseMin = ref<number | null>(null)
const doseMax = ref<number | null>(null)
const doses = ref<Dose[]>([])
const cuidados = ref<string[]>([])
/** O texto de apoio, uma linha por item. */
const textos = reactive({ indicacoes: '', contraindicacoes: '', efeitos: '', interacoes: '' })
const CAMPOS_DE_TEXTO = [
  { id: 'indicacoes', chave: 'clinico.bulario.indicacoes' },
  { id: 'contraindicacoes', chave: 'clinico.bulario.contraindicacoes' },
  { id: 'efeitos', chave: 'clinico.bulario.efeitosAdversos' },
  { id: 'interacoes', chave: 'clinico.bulario.interacoes' },
] as const
const observacao = ref('')

const salvando = ref(false)
const tentou = ref(false)
const erroNoNome = ref('')
const erroNasDoses = ref('')
const erroGeral = ref('')

const linhas = (texto: string) =>
  texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)
    .slice(0, 30)

watch(aberta, (agora) => {
  if (!agora) return
  const m = props.medicamento
  tentou.value = false
  erroNoNome.value = ''
  erroNasDoses.value = ''
  erroGeral.value = ''
  nome.value = m?.nome ?? ''
  principioAtivo.value = m?.principioAtivo ?? ''
  apresentacao.value = m?.apresentacao ?? ''
  concentracao.value = m?.concentracao ?? null
  unidade.value = m?.unidadeApresentacao ?? 'COMPRIMIDO'
  classe.value = m?.classe ?? 'OUTRA'
  controle.value = m?.controle ?? 'NENHUM'
  listaControle.value = m?.listaControle ?? ''
  manipulado.value = m?.manipulado ?? false
  vias.value = m ? [...m.viasPermitidas] : ['ORAL']
  doseMin.value = m?.doseUsualMgKg.min ?? null
  doseMax.value = m?.doseUsualMgKg.max ?? null
  doses.value = (m?.doses ?? []).map((d) => ({
    especie: d.especie,
    mgKgMin: d.mgKgMin,
    mgKgMax: d.mgKgMax,
    frequenciaHoras: d.frequenciaHoras,
    duracaoUsualDias: d.duracaoUsualDias,
    proibido: d.proibido,
    nota: d.nota ?? '',
  }))
  cuidados.value = m ? [...m.cuidados] : []
  textos.indicacoes = (m?.indicacoes ?? []).join('\n')
  textos.contraindicacoes = (m?.contraindicacoes ?? []).join('\n')
  textos.efeitos = (m?.efeitosAdversos ?? []).join('\n')
  textos.interacoes = (m?.interacoes ?? []).join('\n')
  observacao.value = m?.observacao ?? ''
})

const opcoes = (lista: readonly string[], prefixo: string) =>
  lista.map((valor) => ({ valor, rotulo: t(`${prefixo}.${valor}`) }))

const opcoesDeClasse = computed(() => opcoes(CLASSES, 'catalogo.medicamento.classe'))
const opcoesDeUnidade = computed(() =>
  UNIDADES.map((valor) => ({ valor, rotulo: t(`clinico.bulario.api.unidade.${valor}`, 1) })),
)
const opcoesDeControle = computed(() => opcoes(CONTROLES, 'clinico.bulario.api.controle'))
const opcoesDeVia = computed(() => opcoes(VIAS, 'clinico.bulario.api.via'))
const opcoesDeCuidado = computed(() => opcoes(CUIDADOS, 'clinico.bulario.api.cuidado'))
const opcoesDeEspecie = computed(() => opcoes(ESPECIES_DO_CATALOGO, 'cadastro.especie'))

function acrescentarDose() {
  doses.value.push({
    especie: null,
    mgKgMin: doseMin.value,
    mgKgMax: doseMax.value,
    frequenciaHoras: 12,
    duracaoUsualDias: null,
    proibido: false,
    nota: '',
  })
}

const valido = computed(
  () =>
    nome.value.trim().length >= 2 &&
    principioAtivo.value.trim().length >= 2 &&
    apresentacao.value.trim().length >= 2 &&
    (concentracao.value ?? 0) > 0 &&
    vias.value.length > 0 &&
    doseMin.value !== null &&
    doseMax.value !== null &&
    doses.value.every(
      (d) => d.especie && d.mgKgMin !== null && d.mgKgMax !== null && d.frequenciaHoras,
    ),
)

function corpo(): NovoMedicamento {
  return {
    nome: nome.value.trim(),
    principioAtivo: principioAtivo.value.trim(),
    apresentacao: apresentacao.value.trim(),
    concentracao: concentracao.value!,
    unidadeApresentacao: unidade.value,
    classe: classe.value as NovoMedicamento['classe'],
    controle: controle.value,
    listaControle: controle.value === 'NENHUM' ? null : listaControle.value.trim() || null,
    manipulado: manipulado.value,
    viasPermitidas: vias.value as NovoMedicamento['viasPermitidas'],
    doseUsualMgKgMin: doseMin.value!,
    doseUsualMgKgMax: doseMax.value!,
    doses: doses.value.map((d) => ({
      especie: d.especie!,
      mgKgMin: d.mgKgMin!,
      mgKgMax: d.mgKgMax!,
      frequenciaHoras: d.frequenciaHoras!,
      ...(d.duracaoUsualDias ? { duracaoUsualDias: d.duracaoUsualDias } : {}),
      proibido: d.proibido,
      ...(d.nota.trim() ? { nota: d.nota.trim() } : {}),
    })),
    cuidados: cuidados.value as NovoMedicamento['cuidados'],
    indicacoes: linhas(textos.indicacoes),
    contraindicacoes: linhas(textos.contraindicacoes),
    efeitosAdversos: linhas(textos.efeitos),
    interacoes: linhas(textos.interacoes),
    observacao: observacao.value.trim() || null,
  }
}

async function salvar() {
  tentou.value = true
  erroNoNome.value = ''
  erroNasDoses.value = ''
  erroGeral.value = ''
  if (!valido.value) return
  salvando.value = true
  const dados = corpo()
  try {
    if (props.medicamento) {
      await editarAcrescimo('medicamentos', props.medicamento.id, dados, parceiroQuery())
    } else {
      await criarAcrescimo('medicamentos', dados, chaveador.para(dados), parceiroQuery())
      chaveador.concluir()
    }
    aberta.value = false
    emit('salvo')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (lido.codigo === 'CATALOGO_NOME_EM_USO') erroNoNome.value = t('catalogo.erro.nomeEmUso')
    else if (lido.codigo === 'DOSE_FAIXA_INVALIDA' || lido.codigo === 'DOSE_ESPECIE_REPETIDA')
      erroNasDoses.value = lido.mensagem
    else if (lido.codigo === 'CATALOGO_MEDICAMENTOS_NO_LIMITE') {
      erroGeral.value = t('catalogo.erro.noLimite')
      emit('noLimite')
    } else erroGeral.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="medicamento ? t('catalogo.medicamento.editar') : t('catalogo.medicamento.novo')"
    icone="ph ph-pill"
    largura="40rem"
  >
    <form id="medicamento-form" class="eg" novalidate @submit.prevent="salvar">
      <div class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('catalogo.medicamento.oQueE') }}</h3>
        <section class="eg__secao">
          <label class="eg__rotulo" for="med-nome">{{ t('catalogo.medicamento.nome') }}</label>
          <InputText
            id="med-nome"
            v-model="nome"
            maxlength="120"
            :invalid="(tentou && nome.trim().length < 2) || Boolean(erroNoNome)"
            :disabled="salvando"
          />
          <small v-if="erroNoNome" class="eg__invalido">{{ erroNoNome }}</small>
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="med-principio">{{
            t('catalogo.medicamento.principio')
          }}</label>
          <InputText
            id="med-principio"
            v-model="principioAtivo"
            maxlength="120"
            :invalid="tentou && principioAtivo.trim().length < 2"
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="med-apresentacao">{{
            t('catalogo.medicamento.apresentacao')
          }}</label>
          <InputText
            id="med-apresentacao"
            v-model="apresentacao"
            maxlength="200"
            :placeholder="t('catalogo.medicamento.apresentacaoExemplo')"
            :invalid="tentou && apresentacao.trim().length < 2"
            :disabled="salvando"
          />
        </section>
        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="med-concentracao">{{
              t('catalogo.medicamento.concentracao')
            }}</label>
            <InputNumber
              v-model="concentracao"
              input-id="med-concentracao"
              :min="0"
              :max-fraction-digits="3"
              suffix=" mg"
              :invalid="tentou && !(concentracao && concentracao > 0)"
              :disabled="salvando"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="med-unidade">{{
              t('catalogo.medicamento.porUnidade')
            }}</label>
            <Select
              v-model="unidade"
              input-id="med-unidade"
              :options="opcoesDeUnidade"
              option-label="rotulo"
              option-value="valor"
              :disabled="salvando"
            />
          </section>
        </div>
        <section class="eg__secao">
          <label class="eg__rotulo" for="med-classe">{{
            t('catalogo.medicamento.classeRotulo')
          }}</label>
          <Select
            v-model="classe"
            input-id="med-classe"
            :options="opcoesDeClasse"
            option-label="rotulo"
            option-value="valor"
            :disabled="salvando"
          />
        </section>
      </div>

      <div class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('catalogo.medicamento.dose') }}</h3>
        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="med-dose-min">{{
              t('catalogo.medicamento.doseMin')
            }}</label>
            <InputNumber
              v-model="doseMin"
              input-id="med-dose-min"
              :min="0"
              :max-fraction-digits="3"
              suffix=" mg/kg"
              :invalid="tentou && doseMin === null"
              :disabled="salvando"
            />
          </section>
          <section class="eg__secao">
            <label class="eg__rotulo" for="med-dose-max">{{
              t('catalogo.medicamento.doseMax')
            }}</label>
            <InputNumber
              v-model="doseMax"
              input-id="med-dose-max"
              :min="0"
              :max-fraction-digits="3"
              suffix=" mg/kg"
              :invalid="tentou && doseMax === null"
              :disabled="salvando"
            />
          </section>
        </div>

        <ul v-if="doses.length" class="med__doses">
          <li v-for="(dose, indice) in doses" :key="indice" class="med__dose">
            <div class="eg__linha">
              <Select
                v-model="dose.especie"
                :options="opcoesDeEspecie"
                option-label="rotulo"
                option-value="valor"
                :placeholder="t('catalogo.medicamento.especie')"
                :aria-label="t('catalogo.medicamento.especie')"
                :invalid="tentou && !dose.especie"
                :disabled="salvando"
              />
              <InputNumber
                v-model="dose.frequenciaHoras"
                :min="1"
                :max="168"
                suffix=" h"
                :aria-label="t('catalogo.medicamento.intervalo')"
                :disabled="salvando"
              />
            </div>
            <div class="eg__linha">
              <InputNumber
                v-model="dose.mgKgMin"
                :min="0"
                :max-fraction-digits="3"
                suffix=" mg/kg"
                :aria-label="t('catalogo.medicamento.doseMin')"
                :disabled="salvando || dose.proibido"
              />
              <InputNumber
                v-model="dose.mgKgMax"
                :min="0"
                :max-fraction-digits="3"
                suffix=" mg/kg"
                :aria-label="t('catalogo.medicamento.doseMax')"
                :disabled="salvando || dose.proibido"
              />
            </div>
            <InputText
              v-model="dose.nota"
              maxlength="300"
              :placeholder="t('catalogo.medicamento.nota')"
              :aria-label="t('catalogo.medicamento.nota')"
              :disabled="salvando"
            />
            <div class="med__dose-pe">
              <label class="med__chave">
                <ToggleSwitch v-model="dose.proibido" :disabled="salvando" />
                <span>{{ t('catalogo.medicamento.proibido') }}</span>
              </label>
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-trash"
                :label="t('catalogo.medicamento.tirarEspecie')"
                :disabled="salvando"
                @click="doses.splice(indice, 1)"
              />
            </div>
          </li>
        </ul>
        <small v-if="erroNasDoses" class="eg__invalido">{{ erroNasDoses }}</small>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-plus"
          class="med__mais"
          :label="t('catalogo.medicamento.doseDaEspecie')"
          :disabled="salvando"
          @click="acrescentarDose"
        />
      </div>

      <div class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('catalogo.medicamento.usoEControle') }}</h3>
        <section class="eg__secao">
          <label class="eg__rotulo" for="med-vias">{{ t('clinico.bulario.vias') }}</label>
          <MultiSelect
            v-model="vias"
            input-id="med-vias"
            :options="opcoesDeVia"
            option-label="rotulo"
            option-value="valor"
            display="chip"
            :invalid="tentou && !vias.length"
            :disabled="salvando"
          />
        </section>
        <div class="eg__linha">
          <section class="eg__secao">
            <label class="eg__rotulo" for="med-controle">{{
              t('catalogo.medicamento.controle')
            }}</label>
            <Select
              v-model="controle"
              input-id="med-controle"
              :options="opcoesDeControle"
              option-label="rotulo"
              option-value="valor"
              :disabled="salvando"
            />
          </section>
          <section v-if="controle !== 'NENHUM'" class="eg__secao">
            <label class="eg__rotulo" for="med-lista">{{ t('catalogo.medicamento.lista') }}</label>
            <InputText
              id="med-lista"
              v-model="listaControle"
              maxlength="10"
              placeholder="C1"
              :disabled="salvando"
            />
          </section>
        </div>
        <label class="med__chave">
          <ToggleSwitch v-model="manipulado" :disabled="salvando" />
          <span>{{ t('catalogo.medicamento.manipulado') }}</span>
        </label>
        <section class="eg__secao">
          <label class="eg__rotulo" for="med-cuidados">{{
            t('catalogo.medicamento.cuidados')
          }}</label>
          <MultiSelect
            v-model="cuidados"
            input-id="med-cuidados"
            :options="opcoesDeCuidado"
            option-label="rotulo"
            option-value="valor"
            display="chip"
            :disabled="salvando"
          />
        </section>
      </div>

      <div class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('catalogo.medicamento.texto') }}</h3>
        <small class="eg__dica">{{ t('catalogo.medicamento.umaPorLinha') }}</small>
        <section v-for="campo in CAMPOS_DE_TEXTO" :key="campo.id" class="eg__secao">
          <label class="eg__rotulo" :for="`med-${campo.id}`">{{ t(campo.chave) }}</label>
          <Textarea
            :id="`med-${campo.id}`"
            v-model="textos[campo.id]"
            rows="2"
            auto-resize
            :disabled="salvando"
          />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="med-obs">{{ t('catalogo.medicamento.observacao') }}</label>
          <Textarea
            id="med-obs"
            v-model="observacao"
            rows="2"
            auto-resize
            maxlength="1000"
            :disabled="salvando"
          />
        </section>
      </div>

      <p v-if="erroGeral" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroGeral }}</span>
      </p>
      <p v-else-if="tentou && !valido" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ t('catalogo.erro.faltaCampo') }}</span>
      </p>
    </form>

    <template #pe>
      <Button
        type="button"
        severity="secondary"
        outlined
        :label="t('cadastro.cancelar')"
        :disabled="salvando"
        @click="aberta = false"
      />
      <Button
        type="submit"
        form="medicamento-form"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.med__doses {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.med__dose {
  display: grid;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--linha-suave);
}

.med__dose :deep(.p-inputnumber),
.med__dose :deep(.p-inputnumber-input),
.med__dose :deep(.p-select),
.med__dose :deep(.p-inputtext) {
  width: 100%;
}

.med__dose-pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.med__chave {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  cursor: pointer;
}

.med__mais {
  justify-self: start;
}
</style>
