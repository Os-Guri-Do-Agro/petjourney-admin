<script setup lang="ts">
/**
 * Um atendimento do piloto com a Subea, aberto pela lista: a ficha no celular do tutor, que quem
 * apresenta toca como se fosse o tutor (ler o QR, "Já fiz", "Já cadastrei"), e ao lado o que
 * aconteceu desde o atendimento. Cada toque muda o atendimento, o aviso do canto diz em quanto a meta
 * foi, e o painel da tela anda junto: é o circuito do Ofício 002/2026 inteiro, na frente de quem
 * decide. Cuidado que passou da data não se confirma no prazo; dá para reenviar o aviso.
 *
 * Embaixo, o resultado do atendimento (17/11/2026): o que foi feito e o que não deu, com o motivo, e
 * o "Anotar resultado" para a equipe corrigir depois. A ficha mostra só o que foi feito.
 */
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed } from 'vue'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import FichaNoCelular from '@/features/saude-publica/components/FichaNoCelular.vue'
import ResultadoDoAtendimento from '@/features/saude-publica/components/ResultadoDoAtendimento.vue'
import { useCampo } from '@/features/saude-publica/campo'
import {
  dataCurta,
  META_DO_PROCEDIMENTO,
  procedimento,
  proximosCuidados,
  type MetaDoPiloto,
  type ResultadoDoProcedimento,
} from '@/features/saude-publica/dados'
import {
  responsavelPeloAtendimento,
  useEstadoDoPrototipo,
  useMetasDoPiloto,
} from '@/features/saude-publica/estado'
import {
  feitosDoAtendimento,
  fraseDoResultado,
  resultadosDoAtendimento,
} from '@/features/saude-publica/resultado'

const props = defineProps<{ atendimentoId: string | null }>()
const aberta = defineModel<boolean>('visible', { default: false })

const toast = useToast()
const { atendimentos, atualizarAtendimento } = useEstadoDoPrototipo()
const metas = useMetasDoPiloto()
const { anotarResultado } = useCampo()

const atendimento = computed(
  () => atendimentos.value.find((item) => item.id === props.atendimentoId) ?? null,
)

/** O que de fato foi feito: a ficha e os cuidados não mostram o que não deu. */
const feitos = computed(() => (atendimento.value ? feitosDoAtendimento(atendimento.value) : []))
const resultados = computed(() =>
  atendimento.value ? resultadosDoAtendimento(atendimento.value) : [],
)

const cuidado = computed(() =>
  atendimento.value ? proximosCuidados(atendimento.value.data, feitos.value)[0] : undefined,
)

const sobre = computed(() =>
  atendimento.value
    ? `${resultados.value.map((item) => procedimento(item.procedimento).rotulo).join(' · ')} · ${responsavelPeloAtendimento(atendimento.value)}`
    : '',
)

type Evento = { icone: string; texto: string; quando?: string; tom: 'feito' | 'atraso' | 'adiante' }

/** O que aconteceu desde o atendimento, na ordem, e o que vem pela frente. */
const eventos = computed<Evento[]>(() => {
  const item = atendimento.value
  if (!item) return []

  const lista: Evento[] = [
    {
      icone: 'ph ph-qr-code',
      texto: 'Atendido no Consultório Móvel, com o QR Code entregue',
      quando: dataCurta(item.data),
      tom: 'feito',
    },
  ]
  if (item.situacao !== 'nao-abriu') {
    lista.push({ icone: 'ph ph-eye', texto: 'O tutor abriu a ficha no celular', tom: 'feito' })
  }
  if (item.sinpatinhas) {
    lista.push({
      icone: 'ph ph-identification-card',
      texto: 'Informou o cadastro no SinPatinhas',
      tom: 'feito',
    })
  }

  const proximo = cuidado.value
  if (proximo) {
    if (item.situacao === 'cumpriu') {
      lista.push({
        icone: 'ph ph-check-circle',
        texto: `Confirmou no prazo: ${proximo.rotulo.toLowerCase()}`,
        tom: 'feito',
      })
    } else if (item.situacao === 'atrasado') {
      lista.push({
        icone: 'ph ph-clock-countdown',
        texto: `${proximo.rotulo} passou da data`,
        quando: dataCurta(proximo.data),
        tom: 'atraso',
      })
    } else {
      lista.push({
        icone: 'ph ph-bell-ringing',
        texto: `Aviso de ${proximo.rotulo.toLowerCase()} marcado para 3 dias antes`,
        quando: dataCurta(proximo.data),
        tom: 'adiante',
      })
    }
  }

  return lista
})

/** A frase do aviso: em quanto a meta foi depois do toque. */
function comoFicou(id: MetaDoPiloto['id']) {
  const meta = metas.value.find((item) => item.id === id)
  return meta
    ? `${meta.rotulo}: ${meta.feitos} de ${meta.base} (${meta.valor}%).`
    : 'O cuidado sai da lista de avisos.'
}

function abrir() {
  const item = atendimento.value
  if (!item) return
  atualizarAtendimento(item.id, { situacao: 'abriu' })
  toast.add({
    severity: 'success',
    summary: `${item.animal}: o tutor abriu a ficha`,
    detail: comoFicou('ficha'),
    life: 4500,
  })
}

function jaFiz() {
  const item = atendimento.value
  const proximo = cuidado.value
  if (!item || !proximo) return
  atualizarAtendimento(item.id, { situacao: 'cumpriu' })
  const meta = META_DO_PROCEDIMENTO[proximo.procedimento]
  toast.add({
    severity: 'success',
    summary: `Cuidado confirmado: ${proximo.rotulo.toLowerCase()} de ${item.animal}`,
    detail: meta ? comoFicou(meta) : 'O cuidado sai da lista de avisos.',
    life: 4500,
  })
}

function sinpatinhas() {
  const item = atendimento.value
  if (!item) return
  atualizarAtendimento(item.id, { sinpatinhas: true })
  toast.add({
    severity: 'success',
    summary: `${item.animal}: cadastro no SinPatinhas informado`,
    detail: comoFicou('sinpatinhas'),
    life: 4500,
  })
}

/** O resultado anotado depois: grava no atendimento, e o relatório passa a contar o novo. */
function salvarResultado(novos: ResultadoDoProcedimento[]) {
  const item = atendimento.value
  if (!item) return
  anotarResultado(item.id, novos)
  toast.add({
    severity: 'success',
    summary: `Resultado de ${item.animal} anotado`,
    detail: novos.map(fraseDoResultado).join('; '),
    life: 4500,
  })
}

function reenviar() {
  const item = atendimento.value
  if (!item || !cuidado.value) return
  toast.add({
    severity: 'info',
    summary: `Aviso reenviado ao tutor de ${item.animal}`,
    detail: `${cuidado.value.rotulo}: o tutor recebe de novo no celular. No protótipo, nada é enviado.`,
    life: 4500,
  })
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="atendimento?.animal ?? 'Atendimento'"
    icone="ph ph-paw-print"
    largura="38rem"
  >
    <div v-if="atendimento" class="ap-caixa">
      <p class="ap__sobre">{{ sobre }}</p>

      <div class="ap">
        <FichaNoCelular
          interativa
          :animal="atendimento.animal"
          :especie="atendimento.especie"
          :data="atendimento.data"
          :procedimentos="feitos"
          :situacao="atendimento.situacao"
          :sinpatinhas="atendimento.sinpatinhas"
          @abrir="abrir"
          @ja-fiz="jaFiz"
          @sinpatinhas="sinpatinhas"
        />

        <section class="ap__depois" aria-labelledby="ap-depois">
          <h3 id="ap-depois" class="eg__rotulo">O que aconteceu</h3>
          <ol class="ap__eventos">
            <li
              v-for="evento in eventos"
              :key="evento.texto"
              class="ap__evento"
              :class="`ap__evento--${evento.tom}`"
            >
              <span class="ap__marco" aria-hidden="true"><i :class="evento.icone" /></span>
              <span class="ap__evento-texto">
                <span>{{ evento.texto }}</span>
                <small v-if="evento.quando">{{ evento.quando }}</small>
              </span>
            </li>
          </ol>

          <ResultadoDoAtendimento
            :id="`ap-resultado-${atendimento.id}`"
            :resultados="resultados"
            class="ap__resultado"
            @salvar="salvarResultado"
          />

          <Button
            v-if="atendimento.situacao === 'atrasado'"
            type="button"
            severity="secondary"
            outlined
            icon="ph ph-paper-plane-tilt"
            label="Reenviar o aviso"
            class="ap__reenviar"
            @click="reenviar"
          />
        </section>
      </div>
    </div>

    <template #pe>
      <Button type="button" severity="secondary" outlined label="Fechar" @click="aberta = false" />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.ap-caixa {
  container: atendimento / inline-size;
  display: grid;
  gap: 16px;
}

.ap__sobre {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

/* O celular à esquerda e o que aconteceu ao lado; sem largura, um embaixo do outro. */
.ap {
  display: grid;
  align-items: start;
  gap: 22px;
  grid-template-columns: auto minmax(0, 1fr);
}

.ap__depois {
  display: grid;
  gap: 12px;
}

.ap__eventos {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ap__evento {
  position: relative;
  display: grid;
  gap: 10px;
  grid-template-columns: 30px minmax(0, 1fr);
  padding-bottom: 16px;
}

.ap__evento:last-child {
  padding-bottom: 0;
}

/* A linha que liga um marco ao próximo. */
.ap__evento:not(:last-child)::after {
  position: absolute;
  top: 32px;
  bottom: 2px;
  inset-inline-start: 14px;
  border-inline-start: 2px solid var(--linha);
  content: '';
}

.ap__marco {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  font-size: 15px;
}

.ap__evento--feito .ap__marco {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.ap__evento--atraso .ap__marco {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.ap__evento--adiante .ap__marco {
  border: 1.5px dashed var(--linha-media);
  color: var(--tinta-2);
}

.ap__evento-texto {
  display: grid;
  gap: 1px;
  padding-top: 5px;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.4;
}

.ap__evento-texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ap__reenviar {
  justify-self: start;
}

.ap__resultado {
  padding-top: 14px;
  border-top: 1px solid var(--linha);
}

@container atendimento (max-width: 520px) {
  .ap {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
  }

  .ap__depois {
    width: 100%;
  }
}
</style>
