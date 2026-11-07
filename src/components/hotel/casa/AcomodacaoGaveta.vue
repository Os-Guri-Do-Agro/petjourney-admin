<script setup lang="ts">
/**
 * Cadastrar ou editar uma acomodação (E7-01, guia e7 5): o que é (nome, corredor, tipo), quem cabe
 * (quantos da mesma casa, o porte máximo, as espécies: pelo menos uma, e "Outra espécie" vale de
 * verdade) e o preparo e o preço (higienização entre uma saída e a entrada seguinte, a tarifa).
 *
 * Só abre para quem edita, que sempre vê dinheiro (a tarifa é obrigatória). Com reserva viva em
 * cima, a API não deixa encolher (`ACOMODACAO_COM_RESERVAS`, com o motivo): a mensagem dela fica
 * na gaveta. O duplo toque ao criar devolve a mesma acomodação (Idempotency-Key).
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  CAPACIDADE_MAX,
  criarAcomodacao,
  editarAcomodacao,
  ESPECIES,
  HIGIENIZACAO_MAX_MINUTOS,
  NOME_MAX,
  NOME_VALIDO,
  PORTES,
  RECURSOS,
  type AcomodacaoDaCasa,
  type CasaDoHotel,
  type EspecieDaCasa,
  type PorteDaCasa,
  type RecursoDaCasa,
} from '@/service/parceiro/hotel-casa-service'

import { useRotulosDaCasa } from './useRotulosDaCasa'

const props = defineProps<{
  casa: CasaDoHotel
  /** `null` cria. */
  acomodacao: AcomodacaoDaCasa | null
  /** Ao criar dentro de um corredor, ele vem marcado. */
  blocoInicial: string | null
}>()
const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ salvo: [] }>()

const { t } = useI18n()
const rotulos = useRotulosDaCasa()
const { parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const nome = ref('')
const blocoId = ref<string | null>(null)
const tipoId = ref<string | null>(null)
const tarifaId = ref<string | null>(null)
const capacidade = ref<number | null>(1)
const porte = ref<PorteDaCasa>('MEDIO')
const especies = ref<EspecieDaCasa[]>([])
const recursos = ref<RecursoDaCasa[]>([])
const higienizacao = ref<number | null>(60)
const tentou = ref(false)
const salvando = ref(false)
const erro = ref('')
const erroNoNome = ref('')

watch(aberta, (agora) => {
  if (!agora) return
  const a = props.acomodacao
  nome.value = a?.nome ?? ''
  blocoId.value = a?.blocoId ?? props.blocoInicial ?? props.casa.blocos[0]?.id ?? null
  tipoId.value = a?.tipoId ?? props.casa.tipos[0]?.id ?? null
  tarifaId.value = a?.tarifaId ?? props.casa.tarifas?.[0]?.id ?? null
  capacidade.value = a?.capacidade ?? 1
  porte.value = a?.porteMaximo ?? 'MEDIO'
  especies.value = a ? [...a.especiesAceitas] : ['CACHORRO']
  recursos.value = a ? [...a.recursos] : []
  higienizacao.value = a?.higienizacaoMinutos ?? 60
  tentou.value = false
  erro.value = ''
  erroNoNome.value = ''
  chaveador.concluir()
})

const opcoesDeBloco = computed(() =>
  props.casa.blocos.map((b) => ({ valor: b.id, rotulo: b.nome })),
)
const opcoesDeTipo = computed(() => props.casa.tipos.map((b) => ({ valor: b.id, rotulo: b.nome })))
const opcoesDeTarifa = computed(() =>
  (props.casa.tarifas ?? []).map((b) => ({ valor: b.id, rotulo: b.nome })),
)
const opcoesDePorte = computed(() =>
  PORTES.map((valor) => ({ valor, rotulo: rotulos.porte(valor) })),
)
const opcoesDeEspecie = computed(() =>
  ESPECIES.map((valor) => ({ valor, rotulo: rotulos.especie(valor) })),
)
const opcoesDeRecurso = computed(() =>
  RECURSOS.map((valor) => ({ valor, rotulo: rotulos.recurso(valor) })),
)

const nomeValido = computed(() => {
  const limpo = nome.value.trim()
  return limpo.length > 0 && limpo.length <= NOME_MAX && NOME_VALIDO.test(limpo)
})

const valido = computed(
  () =>
    nomeValido.value &&
    Boolean(blocoId.value && tipoId.value && tarifaId.value) &&
    typeof capacidade.value === 'number' &&
    capacidade.value >= 1 &&
    especies.value.length > 0 &&
    typeof higienizacao.value === 'number',
)

async function salvar() {
  tentou.value = true
  erro.value = ''
  erroNoNome.value = ''
  if (!valido.value) return
  const corpo = {
    nome: nome.value.trim(),
    blocoId: blocoId.value!,
    tipoId: tipoId.value!,
    tarifaId: tarifaId.value!,
    capacidade: capacidade.value!,
    porteMaximo: porte.value,
    especiesAceitas: especies.value,
    recursos: recursos.value,
    higienizacaoMinutos: higienizacao.value!,
  }
  salvando.value = true
  try {
    if (props.acomodacao) await editarAcomodacao(props.acomodacao.id, corpo, parceiroQuery())
    else await criarAcomodacao(corpo, chaveador.para(corpo), parceiroQuery())
    chaveador.concluir()
    aberta.value = false
    emit('salvo')
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (lido.codigo === 'NOME_EM_USO') erroNoNome.value = lido.mensagem
    else erro.value = lido.mensagem
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="acomodacao ? t('casaDoHotel.acomodacao.editar') : t('casaDoHotel.acomodacao.nova')"
    icone="ph ph-door"
    largura="38rem"
  >
    <form id="acomodacao-da-casa" class="eg" novalidate @submit.prevent="salvar">
      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('casaDoHotel.acomodacao.secaoIdentidade') }}</h3>
        <div class="eg__secao">
          <label class="eg__rotulo" for="ac-nome">{{ t('casaDoHotel.acomodacao.nome') }}</label>
          <InputText
            id="ac-nome"
            v-model="nome"
            :maxlength="NOME_MAX"
            :invalid="(tentou && !nomeValido) || Boolean(erroNoNome)"
            :disabled="salvando"
          />
          <small v-if="erroNoNome" class="eg__invalido">{{ erroNoNome }}</small>
        </div>
        <div class="eg__linha">
          <div class="eg__secao">
            <label class="eg__rotulo" for="ac-bloco">{{ t('casaDoHotel.acomodacao.bloco') }}</label>
            <Select
              v-model="blocoId"
              input-id="ac-bloco"
              :options="opcoesDeBloco"
              option-label="rotulo"
              option-value="valor"
              :invalid="tentou && !blocoId"
              :disabled="salvando"
            />
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="ac-tipo">{{ t('casaDoHotel.acomodacao.tipo') }}</label>
            <Select
              v-model="tipoId"
              input-id="ac-tipo"
              :options="opcoesDeTipo"
              option-label="rotulo"
              option-value="valor"
              :invalid="tentou && !tipoId"
              :disabled="salvando"
            />
          </div>
        </div>
      </section>

      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('casaDoHotel.acomodacao.secaoQuemCabe') }}</h3>
        <div class="eg__linha">
          <div class="eg__secao">
            <label class="eg__rotulo" for="ac-capacidade">{{
              t('casaDoHotel.acomodacao.capacidade')
            }}</label>
            <InputNumber
              v-model="capacidade"
              input-id="ac-capacidade"
              :min="1"
              :max="CAPACIDADE_MAX"
              show-buttons
              :invalid="tentou && !capacidade"
              :disabled="salvando"
            />
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="ac-porte">{{ t('casaDoHotel.acomodacao.porte') }}</label>
            <Select
              v-model="porte"
              input-id="ac-porte"
              :options="opcoesDePorte"
              option-label="rotulo"
              option-value="valor"
              :disabled="salvando"
            />
          </div>
        </div>
        <small class="eg__dica ac__dica">{{ t('casaDoHotel.acomodacao.capacidadeDica') }}</small>
        <div class="eg__secao">
          <span id="ac-especies" class="eg__rotulo">{{
            t('casaDoHotel.acomodacao.especies')
          }}</span>
          <SelectButton
            v-model="especies"
            :options="opcoesDeEspecie"
            option-label="rotulo"
            option-value="valor"
            multiple
            aria-labelledby="ac-especies"
            :invalid="tentou && !especies.length"
            :disabled="salvando"
            class="ac__opcoes"
          />
          <small :class="tentou && !especies.length ? 'eg__invalido' : 'eg__dica'">{{
            t('casaDoHotel.acomodacao.especiesDica')
          }}</small>
        </div>
        <div class="eg__secao">
          <span id="ac-recursos" class="eg__rotulo">
            {{ t('casaDoHotel.acomodacao.recursos') }}
            <span class="eg__opcional">{{ t('cadastro.opcional') }}</span>
          </span>
          <SelectButton
            v-model="recursos"
            :options="opcoesDeRecurso"
            option-label="rotulo"
            option-value="valor"
            multiple
            aria-labelledby="ac-recursos"
            :disabled="salvando"
            class="ac__opcoes"
          />
        </div>
      </section>

      <section class="eg__grupo">
        <h3 class="eg__grupo-titulo">{{ t('casaDoHotel.acomodacao.secaoPreco') }}</h3>
        <div class="eg__linha">
          <div class="eg__secao">
            <label class="eg__rotulo" for="ac-higienizacao">{{
              t('casaDoHotel.acomodacao.higienizacao')
            }}</label>
            <InputNumber
              v-model="higienizacao"
              input-id="ac-higienizacao"
              :min="0"
              :max="HIGIENIZACAO_MAX_MINUTOS"
              :suffix="` ${t('casaDoHotel.acomodacao.minutos')}`"
              :invalid="tentou && higienizacao === null"
              :disabled="salvando"
            />
          </div>
          <div class="eg__secao">
            <label class="eg__rotulo" for="ac-tarifa">{{
              t('casaDoHotel.acomodacao.tarifa')
            }}</label>
            <Select
              v-model="tarifaId"
              input-id="ac-tarifa"
              :options="opcoesDeTarifa"
              option-label="rotulo"
              option-value="valor"
              :invalid="tentou && !tarifaId"
              :disabled="salvando"
            />
          </div>
        </div>
        <small class="eg__dica ac__dica">{{ t('casaDoHotel.acomodacao.higienizacaoDica') }}</small>
      </section>

      <p v-if="acomodacao" class="eg__dica">{{ t('casaDoHotel.acomodacao.comReservas') }}</p>

      <p v-if="erro" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erro }}</span>
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
        form="acomodacao-da-casa"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ac__dica {
  margin-top: -8px;
}

.ac__opcoes {
  flex-wrap: wrap;
}
</style>
