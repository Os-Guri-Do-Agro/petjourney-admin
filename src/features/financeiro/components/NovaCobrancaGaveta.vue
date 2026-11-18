<script setup lang="ts">
/**
 * Nova cobrança (protótipo): o que não nasce de um atendimento. O antipulgas vendido no balcão, o
 * banho que entrou sem horário, a ração terapêutica que o responsável veio buscar. Dois passos:
 * de quem (um paciente do cadastro, ou venda sem cadastro) e o quê (da tabela de preços). No fim,
 * "Receber agora" abre o receber; "Deixar na lista" põe a conta junto das outras do balcão.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import { getDataset } from '@/features/clinico/data/store'
import type { Pet, Tutor } from '@/features/clinico/data/types'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { reais, type ItemDaConta } from '../dados'
import { useFinanceiro } from '../estado'

const aberta = defineModel<boolean>('visible', { default: false })
const emit = defineEmits<{ receber: [contaId: string] }>()

const fin = useFinanceiro()

const SEM_CADASTRO = 'sem-cadastro'

const passo = ref(0)
const quem = ref<string | null>(null)
const itens = ref<ItemDaConta[]>([])
const novoItem = ref<string | null>(null)
const tentou = ref(false)

watch(aberta, (agora) => {
  if (!agora) return
  passo.value = 0
  quem.value = null
  itens.value = []
  tentou.value = false
})

type Escolha = { id: string; rotulo: string; detalhe: string; pet: Pet | null; tutor: Tutor | null }

const pacientes = computed<Escolha[]>(() => {
  const dataset = getDataset()
  const comCadastro: Escolha[] = []
  for (const pet of dataset.pets) {
    const tutor = dataset.tutores.find((t) => t.id === pet.tutorId)
    if (tutor) comCadastro.push({ id: pet.id, rotulo: pet.nome, detalhe: tutor.nome, pet, tutor })
  }
  return [
    {
      id: SEM_CADASTRO,
      rotulo: 'Venda sem cadastro',
      detalhe: 'Cliente de passagem, só produto',
      pet: null,
      tutor: null,
    },
    ...comCadastro.sort((a, b) => a.rotulo.localeCompare(b.rotulo)),
  ]
})

const escolhido = computed(() => pacientes.value.find((p) => p.id === quem.value) ?? null)

const opcoesDeItem = computed(() => [
  { grupo: 'Produtos', itens: fin.tabela.value.filter((i) => i.grupo === 'produto') },
  { grupo: 'Serviços', itens: fin.tabela.value.filter((i) => i.grupo === 'servico') },
])

watch(novoItem, (id) => {
  if (!id) return
  const existente = itens.value.find((i) => i.precoId === id)
  if (existente) existente.quantidade += 1
  else itens.value.push(fin.itemDaTabela(id, null))
  novoItem.value = null
})

const total = computed(() => itens.value.reduce((s, i) => s + i.preco * i.quantidade, 0))

function mudar(item: ItemDaConta, delta: number) {
  item.quantidade = Math.max(1, item.quantidade + delta)
}

function tirar(item: ItemDaConta) {
  itens.value = itens.value.filter((i) => i.id !== item.id)
}

function continuar() {
  tentou.value = true
  if (!quem.value) return
  tentou.value = false
  passo.value = 1
}

function criar(receberAgora: boolean) {
  tentou.value = true
  if (!itens.value.length || !escolhido.value) return
  const { pet, tutor } = escolhido.value
  const id = fin.criarConta({
    petId: pet?.id ?? null,
    petNome: pet?.nome ?? 'Venda no balcão',
    especie: pet?.especie ?? null,
    fotoUrl: pet?.fotoUrl ?? '',
    tutorId: tutor?.id ?? null,
    tutorNome: tutor?.nome ?? 'Cliente sem cadastro',
    itens: itens.value,
  })
  aberta.value = false
  if (receberAgora) {
    /* A gaveta de receber só abre depois de esta terminar de sair (duas gavetas não se cruzam). */
    window.setTimeout(() => emit('receber', id), 320)
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    titulo="Nova cobrança"
    icone="ph ph-plus-circle"
    largura="34rem"
  >
    <ol class="nc__passos" aria-label="Passos">
      <li :class="{ 'nc__passo--atual': passo === 0, 'nc__passo--feito': passo > 0 }">
        <span class="nc__num"
          >{{ passo > 0 ? '' : '1' }}<i v-if="passo > 0" class="ph ph-check" aria-hidden="true"
        /></span>
        De quem
      </li>
      <li :class="{ 'nc__passo--atual': passo === 1 }">
        <span class="nc__num">2</span>
        O quê
      </li>
    </ol>

    <form
      id="nova-cobranca"
      class="nc"
      novalidate
      @submit.prevent="passo === 0 ? continuar() : criar(true)"
    >
      <template v-if="passo === 0">
        <section class="eg__secao">
          <label class="eg__rotulo" for="nc-quem">Paciente ou responsável</label>
          <Select
            v-model="quem"
            input-id="nc-quem"
            :options="pacientes"
            option-label="rotulo"
            option-value="id"
            filter
            :filter-fields="['rotulo', 'detalhe']"
            filter-placeholder="Nome do pet ou do responsável"
            placeholder="Escolha na lista"
            :invalid="tentou && !quem"
          >
            <template #option="{ option }">
              <span class="nc__opcao">
                <PetAvatar
                  v-if="option.pet"
                  :nome="option.pet.nome"
                  :iniciais="iniciais(option.pet.nome)"
                  :especie="option.pet.especie"
                  :foto-url="option.pet.fotoUrl"
                  tamanho="xs"
                />
                <i v-else class="ph ph-storefront nc__opcao-icone" aria-hidden="true" />
                <span>
                  <strong>{{ option.rotulo }}</strong>
                  <small>{{ option.detalhe }}</small>
                </span>
              </span>
            </template>
          </Select>
          <small class="eg__dica"
            >Com cadastro, o recibo vai para o app do responsável e a venda entra no histórico do
            pet.</small
          >
        </section>
      </template>

      <template v-else>
        <p v-if="escolhido" class="nc__para">
          Para <strong>{{ escolhido.rotulo }}</strong>
          <span v-if="escolhido.id !== SEM_CADASTRO"> · {{ escolhido.detalhe }}</span>
        </p>
        <section class="eg__secao">
          <label class="eg__rotulo" for="nc-item">Acrescentar da tabela</label>
          <Select
            v-model="novoItem"
            input-id="nc-item"
            :options="opcoesDeItem"
            option-group-label="grupo"
            option-group-children="itens"
            option-label="nome"
            option-value="id"
            filter
            filter-placeholder="Procurar"
            placeholder="Escolha na lista"
            :invalid="tentou && !itens.length"
          >
            <template #option="{ option }">
              <span class="nc__preco">
                <span>{{ option.nome }}</span>
                <span class="ui-num">{{ reais(option.preco) }}</span>
              </span>
            </template>
          </Select>
        </section>

        <ul v-if="itens.length" class="nc__itens">
          <li v-for="item in itens" :key="item.id" class="nc__item">
            <span class="nc__item-nome">{{ item.nome }}</span>
            <span class="nc__qtd">
              <Button
                type="button"
                icon="ph ph-minus"
                severity="secondary"
                outlined
                size="small"
                :disabled="item.quantidade <= 1"
                :aria-label="`Tirar um de ${item.nome}`"
                @click="mudar(item, -1)"
              />
              <span class="ui-num">{{ item.quantidade }}</span>
              <Button
                type="button"
                icon="ph ph-plus"
                severity="secondary"
                outlined
                size="small"
                :aria-label="`Mais um de ${item.nome}`"
                @click="mudar(item, 1)"
              />
            </span>
            <span class="ui-num nc__valor">{{ reais(item.preco * item.quantidade) }}</span>
            <Button
              type="button"
              icon="ph ph-trash"
              severity="secondary"
              outlined
              size="small"
              :aria-label="`Tirar ${item.nome}`"
              @click="tirar(item)"
            />
          </li>
        </ul>
        <p v-else class="eg__dica">Nada ainda. Escolha na lista acima: os produtos vêm primeiro.</p>

        <div v-if="itens.length" class="nc__total">
          <span>Total</span>
          <strong class="ui-num">{{ reais(total) }}</strong>
        </div>
      </template>
    </form>

    <template #pe>
      <Button
        v-if="passo === 0"
        type="button"
        severity="secondary"
        outlined
        label="Cancelar"
        @click="aberta = false"
      />
      <Button
        v-else
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-arrow-left"
        label="Voltar"
        @click="passo = 0"
      />
      <Button
        v-if="passo === 1"
        type="button"
        severity="secondary"
        outlined
        label="Deixar na lista"
        @click="criar(false)"
      />
      <Button
        type="submit"
        form="nova-cobranca"
        :icon="passo === 0 ? 'ph ph-arrow-right' : 'ph ph-cash-register'"
        :icon-pos="passo === 0 ? 'right' : 'left'"
        :label="passo === 0 ? 'Continuar' : 'Receber agora'"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.nc {
  display: grid;
  gap: 18px;
}

.nc__passos {
  display: flex;
  gap: 18px;
  margin: 0 0 20px;
  padding: 0 0 14px;
  border-bottom: 1px solid var(--linha-suave);
  list-style: none;
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 600;
}

.nc__passos li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.nc__num {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 999px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 12.5px;
}

.nc__passo--atual {
  color: var(--tinta);
}

.nc__passo--atual .nc__num {
  background: var(--segmento-escolhido-fundo, var(--musgo));
  color: var(--segmento-escolhido-tinta, var(--sobre-musgo));
}

.nc__passo--feito .nc__num {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.nc__opcao {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nc__opcao > span {
  display: grid;
}

.nc__opcao small {
  color: var(--tinta-2);
  font-size: 12px;
}

.nc__opcao-icone {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  font-size: 18px;
}

.nc__preco {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 12px;
}

.nc__para {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.nc__para strong {
  color: var(--tinta);
}

.nc__itens {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.nc__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.nc__item + .nc__item {
  border-top: 1px dashed var(--linha-suave);
}

.nc__item-nome {
  flex: 1;
  min-width: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.nc__qtd {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.nc__qtd .ui-num {
  min-width: 1.4rem;
  font-weight: 650;
  text-align: center;
}

.nc__valor {
  min-width: 6rem;
  color: var(--tinta);
  font-weight: 650;
  text-align: end;
}

.nc__total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-radius: 16px;
  background: color-mix(in oklab, var(--pets-fundo) 45%, var(--superficie));
  color: var(--tinta);
  font-weight: 650;
}

.nc__total strong {
  font-size: 20px;
}
</style>
