<script setup lang="ts">
/**
 * Preços e taxas (protótipo): a tabela que a conta do atendimento usa, e o que cada forma de
 * pagamento custa e demora. Mudar um preço vale para as contas novas; a conta já feita guarda o
 * preço do dia em que nasceu.
 */
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import { computed, ref } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'

import { ICONE_DO_TIPO } from '../dados'
import { useFinanceiro } from '../estado'

const aberta = defineModel<boolean>('visible', { default: false })

const fin = useFinanceiro()

const aba = ref<'servico' | 'produto' | 'formas'>('servico')
const busca = ref('')

const itens = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  return fin.tabela.value.filter(
    (item) => item.grupo === aba.value && (!termo || item.nome.toLowerCase().includes(termo)),
  )
})

const formas = computed(() =>
  fin.condicoes.value.filter((c) => c.forma !== 'em-aberto' && c.forma !== 'dinheiro'),
)
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    titulo="Preços e taxas"
    icone="ph ph-tag"
    largura="36rem"
  >
    <div class="pg">
      <SelectButton
        v-model="aba"
        :options="[
          { valor: 'servico', rotulo: 'Serviços' },
          { valor: 'produto', rotulo: 'Produtos' },
          { valor: 'formas', rotulo: 'Formas de pagamento' },
        ]"
        option-label="rotulo"
        option-value="valor"
        :allow-empty="false"
        aria-label="O que ver"
      />

      <template v-if="aba !== 'formas'">
        <IconField>
          <InputIcon class="ph ph-magnifying-glass" />
          <InputText
            v-model="busca"
            placeholder="Procurar na tabela"
            aria-label="Procurar na tabela"
            class="pg__busca"
          />
        </IconField>
        <ul class="pg__lista">
          <li v-for="item in itens" :key="item.id" class="pg__linha">
            <i :class="ICONE_DO_TIPO[item.tipo]" class="pg__icone" aria-hidden="true" />
            <label class="pg__nome" :for="`pg-${item.id}`">{{ item.nome }}</label>
            <InputNumber
              :input-id="`pg-${item.id}`"
              :model-value="item.preco / 100"
              mode="currency"
              currency="BRL"
              locale="pt-BR"
              :min="0"
              class="pg__preco"
              @update:model-value="fin.salvarPreco(item.id, Math.round(($event ?? 0) * 100))"
            />
          </li>
        </ul>
        <p v-if="!itens.length" class="eg__dica">Nada com esse nome na tabela.</p>
      </template>

      <template v-else>
        <p class="eg__dica">
          O que a maquininha cobra e quando deposita. É daqui que saem o "cai em 30 dias" do
          receber, os cartões a cair em Contas e as taxas do Resultado.
        </p>
        <section v-for="c in formas" :key="c.forma" class="pg__forma">
          <h3 class="pg__forma-titulo"><i :class="c.icone" aria-hidden="true" /> {{ c.nome }}</h3>
          <div class="eg__linha">
            <div class="eg__secao">
              <label class="eg__rotulo" :for="`pg-taxa-${c.forma}`">{{
                c.forma === 'credito' ? 'Taxa à vista' : 'Taxa'
              }}</label>
              <InputNumber
                :input-id="`pg-taxa-${c.forma}`"
                :model-value="c.taxa * 100"
                :min-fraction-digits="2"
                :max-fraction-digits="2"
                suffix="%"
                locale="pt-BR"
                :min="0"
                :max="20"
                @update:model-value="fin.salvarCondicao(c.forma, { taxa: ($event ?? 0) / 100 })"
              />
            </div>
            <div v-if="c.forma === 'credito'" class="eg__secao">
              <label class="eg__rotulo" for="pg-taxa-parcelado">Taxa parcelado</label>
              <InputNumber
                input-id="pg-taxa-parcelado"
                :model-value="(c.taxaParcelado ?? 0) * 100"
                :min-fraction-digits="2"
                :max-fraction-digits="2"
                suffix="%"
                locale="pt-BR"
                :min="0"
                :max="20"
                @update:model-value="
                  fin.salvarCondicao('credito', { taxaParcelado: ($event ?? 0) / 100 })
                "
              />
            </div>
            <div class="eg__secao">
              <label class="eg__rotulo" :for="`pg-prazo-${c.forma}`">Cai em</label>
              <InputNumber
                :input-id="`pg-prazo-${c.forma}`"
                :model-value="c.prazoDias"
                suffix=" dias"
                :min="0"
                :max="60"
                @update:model-value="fin.salvarCondicao(c.forma, { prazoDias: $event ?? 0 })"
              />
            </div>
            <div v-if="c.forma === 'credito'" class="eg__secao">
              <label class="eg__rotulo" for="pg-parcelas">Até</label>
              <InputNumber
                input-id="pg-parcelas"
                :model-value="c.maxParcelas ?? 1"
                suffix=" vezes"
                :min="1"
                :max="12"
                @update:model-value="fin.salvarCondicao('credito', { maxParcelas: $event ?? 1 })"
              />
            </div>
          </div>
        </section>
      </template>
    </div>

    <template #pe>
      <Button type="button" icon="ph ph-check" label="Pronto" @click="aberta = false" />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.pg {
  display: grid;
  gap: 16px;
}

.pg__busca {
  width: 100%;
}

.pg__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pg__linha {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.pg__linha + .pg__linha {
  border-top: 1px solid var(--linha-suave);
}

.pg__icone {
  color: var(--tinta-2);
  font-size: 18px;
}

.pg__nome {
  flex: 1;
  min-width: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.pg__preco {
  width: 9rem;
}

.pg__preco :deep(input) {
  width: 100%;
  text-align: end;
}

.pg__novo {
  justify-self: start;
}

.pg__forma {
  display: grid;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--linha-suave);
}

.pg__forma-titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.pg__forma :deep(.p-inputnumber),
.pg__forma :deep(input) {
  width: 100%;
}
</style>
