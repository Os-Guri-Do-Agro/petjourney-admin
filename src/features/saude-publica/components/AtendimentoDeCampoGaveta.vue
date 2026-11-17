<script setup lang="ts">
/**
 * Um atendimento da campanha, aberto pela lista do dia (17/11/2026): onde (bairro, região e CEP, o
 * que alimenta o relatório), o cadastro de quem levou e do animal quando a equipe cadastrou na
 * hora, e o resultado com o "Anotar resultado". Os atendimentos de antes do protótipo só têm as
 * iniciais do tutor: o relatório não identifica ninguém.
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { cepNaTela, useCampo } from '@/features/saude-publica/campo'
import ResultadoDoAtendimento from '@/features/saude-publica/components/ResultadoDoAtendimento.vue'
import {
  dataCurta,
  funcaoDaPessoa,
  pessoaDaEquipe,
  procedimento,
  regiao as regiaoDe,
  type ResultadoDoProcedimento,
} from '@/features/saude-publica/dados'
import { fraseDoResultado } from '@/features/saude-publica/resultado'

const props = defineProps<{ registroId: string | null }>()
const aberta = defineModel<boolean>('visible', { default: false })

const toast = useToast()
const { registros, responsavel, pet, anotarResultado } = useCampo()

const registro = computed(
  () => registros.value.find((item) => item.id === props.registroId) ?? null,
)
const dono = computed(() => responsavel(registro.value?.responsavelId))
const animal = computed(() => pet(registro.value?.petId))
/** Quem da equipe atendeu e quem fez o cadastro e a acolhida. */
const atendeu = computed(() => pessoaDaEquipe(registro.value?.equipeId))
const cadastrou = computed(() => pessoaDaEquipe(registro.value?.cadastroId))

const ESPECIE: Record<string, string> = {
  CACHORRO: 'Cachorro',
  GATO: 'Gato',
  OUTRO: 'Outra espécie',
}
const PORTE: Record<string, string> = {
  MINI: 'mini',
  PEQUENO: 'pequeno',
  MEDIO: 'médio',
  GRANDE: 'grande',
  GIGANTE: 'gigante',
}

const sobre = computed(() => {
  const item = registro.value
  if (!item) return ''
  return [
    ESPECIE[item.especie],
    `${dataCurta(item.data)} às ${item.hora}`,
    item.resultados.map((r) => procedimento(r.procedimento).rotulo).join(' · '),
  ].join(' · ')
})

const lugar = computed(() => {
  const item = registro.value
  if (!item) return null
  return {
    bairro: item.bairro ?? 'Bairro não informado',
    regiao: item.regiao ? `Região ${regiaoDe(item.regiao).nome}` : 'Região não informada',
    cep: item.cep ? `CEP ${cepNaTela(item.cep)}` : 'Sem CEP',
  }
})

const endereco = computed(() => {
  const campos = dono.value?.campos
  if (!campos) return ''
  return [
    [campos.logradouro, campos.numero].filter(Boolean).join(', '),
    campos.complemento,
    campos.bairro,
  ]
    .filter(Boolean)
    .join(' · ')
})

const sobreOAnimal = computed(() => {
  const campos = animal.value?.campos
  if (!campos) return ''
  return [
    campos.raca,
    campos.sexo === 'MACHO' ? 'macho' : campos.sexo === 'FEMEA' ? 'fêmea' : '',
    campos.castrado === true ? 'castrado' : campos.castrado === false ? 'não castrado' : '',
    campos.porte ? `porte ${PORTE[campos.porte] ?? campos.porte}` : '',
    campos.pesoKg ? `${String(campos.pesoKg).replace('.', ',')} kg` : '',
    campos.pelagem,
    campos.microchip ? `microchip ${campos.microchip}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

function salvarResultado(novos: ResultadoDoProcedimento[]) {
  const item = registro.value
  if (!item) return
  anotarResultado(item.id, novos)
  toast.add({
    severity: 'success',
    summary: `Resultado de ${item.animal} anotado`,
    detail: `${novos.map(fraseDoResultado).join('; ')}. O relatório já conta o novo resultado.`,
    life: 4500,
  })
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="registro?.animal ?? 'Atendimento'"
    icone="ph ph-paw-print"
    largura="32rem"
  >
    <div v-if="registro" class="adc">
      <p class="adc__sobre">{{ sobre }}</p>

      <section class="adc__bloco" aria-labelledby="adc-onde">
        <h3 id="adc-onde" class="eg__rotulo">Onde</h3>
        <p v-if="lugar" class="adc__onde">
          <i class="ph ph-map-pin-area" aria-hidden="true" />
          <span>
            <strong>{{ lugar.bairro }}</strong>
            {{ lugar.regiao }} · <span class="ui-num">{{ lugar.cep }}</span>
          </span>
        </p>
      </section>

      <section v-if="atendeu" class="adc__bloco" aria-labelledby="adc-equipe">
        <h3 id="adc-equipe" class="eg__rotulo">Equipe</h3>
        <p class="adc__onde">
          <i class="ph ph-user-circle" aria-hidden="true" />
          <span>
            <strong>{{ atendeu.nome }}</strong>
            {{ funcaoDaPessoa(atendeu) }}, atendeu<template v-if="cadastrou">
              · cadastro e acolhida com {{ cadastrou.nome }}</template
            >
          </span>
        </p>
      </section>

      <section class="adc__bloco" aria-labelledby="adc-quem">
        <h3 id="adc-quem" class="eg__rotulo">Quem levou e o animal</h3>
        <dl v-if="dono" class="adc__dados">
          <div>
            <dt>{{ dono.quem === 'ong' ? 'ONG' : 'Tutor' }}</dt>
            <dd>
              {{ dono.quem === 'ong' ? `${dono.ong} · ${dono.campos.nome}` : dono.campos.nome }}
            </dd>
          </div>
          <div v-if="dono.campos.telefone">
            <dt>Telefone</dt>
            <dd class="ui-num">{{ dono.campos.telefone }}</dd>
          </div>
          <div v-if="endereco">
            <dt>Endereço</dt>
            <dd>{{ endereco }}</dd>
          </div>
          <div v-if="sobreOAnimal">
            <dt>{{ registro.animal }}</dt>
            <dd>{{ sobreOAnimal }}</dd>
          </div>
        </dl>
        <p v-else class="eg__dica">
          Tutor {{ registro.tutor }} · atendimento do período, de antes do cadastro: o relatório
          guarda só as iniciais.
        </p>
      </section>

      <ResultadoDoAtendimento
        :id="`adc-resultado-${registro.id}`"
        :resultados="registro.resultados"
        class="adc__bloco"
        @salvar="salvarResultado"
      />
    </div>

    <template #pe>
      <Button type="button" severity="secondary" outlined label="Fechar" @click="aberta = false" />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.adc {
  display: grid;
  gap: 18px;
}

.adc__sobre {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.adc__bloco {
  display: grid;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--linha);
}

.adc__bloco h3 {
  margin: 0;
}

.adc__onde {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.adc__onde i {
  color: var(--pets-tinta);
  font-size: 19px;
}

.adc__onde strong {
  display: block;
  color: var(--tinta);
  font-size: 14.5px;
}

.adc__dados {
  display: grid;
  gap: 8px;
  margin: 0;
}

.adc__dados div {
  display: grid;
  gap: 1px;
}

.adc__dados dt {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 650;
}

.adc__dados dd {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
}
</style>
