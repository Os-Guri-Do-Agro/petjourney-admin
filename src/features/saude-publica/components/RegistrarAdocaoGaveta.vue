<script setup lang="ts">
/**
 * Registrar adoção (protótipo, Ofício 001/2026, item 4c): a ONG escolhe o animal e diz quem
 * adota; o histórico de saúde inteiro (vacinas, exames, castração, coleira) vai para o app do
 * adotante, com 3 meses do plano completo. Dois passos: o animal, e o adotante com o que vai
 * junto. Nada é enviado: é protótipo.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import {
  ANIMAIS_DAS_ONGS,
  dataCurta,
  ong,
  PERIODO,
  type AnimalDaOng,
  type RegistroDoHistorico,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo } from '@/features/saude-publica/estado'

const aberta = defineModel<boolean>('visible', { default: false })

const toast = useToast()
const { adotados, registrarAdocao } = useEstadoDoPrototipo()

const passo = ref(0)
const animal = ref<AnimalDaOng | null>(null)
const nome = ref('')
const celular = ref('')
const tentou = ref(false)

watch(aberta, (agora) => {
  if (!agora) return
  passo.value = 0
  animal.value = null
  nome.value = ''
  celular.value = ''
  tentou.value = false
})

const disponiveis = computed(() =>
  ANIMAIS_DAS_ONGS.filter((item) => !adotados.value.includes(item.id)),
)

const ICONE_DO_REGISTRO: Record<RegistroDoHistorico['tipo'], string> = {
  vacina: 'ph ph-syringe',
  exame: 'ph ph-test-tube',
  castracao: 'ph ph-gender-neuter',
  coleira: 'ph ph-shield-check',
  vermifugo: 'ph ph-pill',
}

/** O plano completo vai até 3 meses depois da adoção (o "hoje" da simulação). */
const planoAte = computed(() => {
  const [ano, mes, dia] = PERIODO.hoje.split('-').map(Number)
  const data = new Date(Date.UTC(ano!, mes! - 1 + 3, dia!))
  return dataCurta(data.toISOString().slice(0, 10))
})

const faltas = computed(() => {
  if (passo.value === 0) return animal.value ? [] : ['Escolha o animal.']
  return [
    nome.value.trim() ? '' : 'Diga o nome de quem adota.',
    celular.value.replace(/\D/g, '').length >= 10 ? '' : 'Diga o celular com DDD.',
  ].filter(Boolean)
})

function avancar() {
  tentou.value = true
  if (faltas.value.length) return
  tentou.value = false
  if (passo.value === 0) {
    passo.value = 1
    return
  }
  registrar()
}

function registrar() {
  if (!animal.value) return
  const adotante = nome.value.trim()
  registrarAdocao(
    {
      animal: animal.value.nome,
      especie: animal.value.especie,
      ongId: animal.value.ongId,
      adotante: iniciais(adotante)
        .split('')
        .map((letra) => `${letra}.`)
        .join(' '),
      data: PERIODO.hoje,
      registros: animal.value.historico.length,
    },
    animal.value.id,
  )
  toast.add({
    severity: 'success',
    summary: `${animal.value.nome} foi adotado`,
    detail: `O histórico de saúde iria para o app de ${adotante.split(' ')[0]}, com 3 meses do plano completo. No protótipo, nada é enviado.`,
    life: 5000,
  })
  aberta.value = false
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    titulo="Registrar adoção"
    icone="ph ph-hand-heart"
    largura="34rem"
  >
    <form id="registrar-adocao" class="eg ra" novalidate @submit.prevent="avancar">
      <!-- 1. O animal. -->
      <template v-if="passo === 0">
        <p class="ra__dica">Quem vai para casa nova hoje?</p>
        <div class="ra__animais" role="radiogroup" aria-label="Animal">
          <button
            v-for="item in disponiveis"
            :key="item.id"
            type="button"
            role="radio"
            class="ra__animal"
            :class="{ 'ra__animal--escolhido': animal?.id === item.id }"
            :aria-checked="animal?.id === item.id"
            @click="animal = item"
          >
            <PetAvatar
              :nome="item.nome"
              :iniciais="iniciais(item.nome)"
              :especie="item.especie === 'GATO' ? 'felina' : 'canina'"
              tamanho="md"
            />
            <span class="ra__animal-texto">
              <strong>{{ item.nome }}</strong>
              <small>
                {{ item.especie === 'GATO' ? 'Gato' : 'Cachorro' }} · {{ item.idade }} ·
                {{ ong(item.ongId).nome }}
              </small>
              <small>{{ item.historico.length }} registros no histórico</small>
            </span>
            <i
              class="ra__marca"
              :class="animal?.id === item.id ? 'ph ph-check-circle' : 'ph ph-circle'"
              aria-hidden="true"
            />
          </button>
        </div>
        <p v-if="!disponiveis.length" class="eg__dica">
          Todos os animais de exemplo já foram adotados.
        </p>
      </template>

      <!-- 2. Quem adota e o que vai junto. -->
      <template v-else-if="animal">
        <section class="eg__secao">
          <label class="eg__rotulo" for="ra-nome">Nome de quem adota</label>
          <InputText id="ra-nome" v-model="nome" autocomplete="off" maxlength="80" />
        </section>
        <section class="eg__secao">
          <label class="eg__rotulo" for="ra-celular">Celular</label>
          <InputText
            id="ra-celular"
            v-model="celular"
            inputmode="tel"
            autocomplete="off"
            placeholder="(67) 99999-9999"
            maxlength="16"
          />
          <small class="eg__dica"
            >O app chega por mensagem nesse número, com o pet já cadastrado.</small
          >
        </section>

        <section class="ra__junto" aria-labelledby="ra-junto">
          <h3 id="ra-junto" class="ra__junto-titulo">
            <i class="ph ph-package" aria-hidden="true" />
            Vai junto com {{ animal.nome }}
          </h3>
          <ul class="ra__historico">
            <li v-for="registro in animal.historico" :key="`${registro.tipo}-${registro.texto}`">
              <i :class="ICONE_DO_REGISTRO[registro.tipo]" aria-hidden="true" />
              <span>{{ registro.texto }}</span>
              <span class="ra__data ui-num">{{ dataCurta(registro.data) }}</span>
            </li>
          </ul>
          <p class="ra__plano">
            <i class="ph ph-gift" aria-hidden="true" />
            3 meses do plano completo, até {{ planoAte }}
          </p>
        </section>
      </template>

      <ul v-if="tentou && faltas.length" class="eg__erro ra__faltas" role="alert">
        <li v-for="falta in faltas" :key="falta">{{ falta }}</li>
      </ul>
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
        type="submit"
        form="registrar-adocao"
        :icon="passo === 0 ? 'ph ph-arrow-right' : 'ph ph-check'"
        :icon-pos="passo === 0 ? 'right' : 'left'"
        :label="passo === 0 ? 'Continuar' : 'Registrar adoção'"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ra__dica {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ra__animais {
  display: grid;
  gap: 10px;
}

.ra__animal {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1.5px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.ra__animal:hover {
  border-color: var(--linha-media);
}

.ra__animal:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

.ra__animal--escolhido,
.ra__animal--escolhido:hover {
  border-color: var(--pets);
  background: color-mix(in oklab, var(--pets-fundo) 35%, var(--superficie));
}

.ra__animal-texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 1px;
}

.ra__animal-texto strong {
  color: var(--tinta);
  font-size: 15px;
}

.ra__animal-texto small {
  font-size: 12.5px;
}

.ra__marca {
  flex: none;
  color: var(--pets-tinta);
  font-size: 20px;
}

/* O que vai junto: uma carteirinha pequena, no verde dos pets. */
.ra__junto {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 16px;
  background: color-mix(in oklab, var(--pets-fundo) 40%, var(--superficie));
}

.ra__junto-titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 700;
}

.ra__historico {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ra__historico li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 13.5px;
}

.ra__historico i {
  color: var(--pets-tinta);
  font-size: 16px;
}

.ra__data {
  margin-inline-start: auto;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ra__plano {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding-top: 10px;
  border-top: 1px dashed color-mix(in oklab, var(--pets-tinta) 40%, transparent);
  color: var(--pets-tinta);
  font-size: 13.5px;
  font-weight: 700;
}

.ra__faltas {
  display: grid;
  gap: 2px;
  margin: 0;
  padding-inline-start: 18px;
}
</style>
