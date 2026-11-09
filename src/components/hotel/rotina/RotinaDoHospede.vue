<script setup lang="ts">
/**
 * A rotina deste hóspede (E7-05b, guia e7 43): a rotina da casa com os ajustes por cima (água,
 * higiene, passeio, pesagem), quem ajustou e por quê. "Ajustar" substitui a lista do tipo ou a
 * suspende; "Voltar à da casa" revoga o ajuste. A proposta (regras, não IA) mostra o porquê de cada
 * sugestão e só grava o que for aprovado.
 *
 * Ler é de quem lê a casa; ajustar, revogar e a proposta, de quem cuida da rotina.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  KINDS_DA_CASA,
  lerAjustes,
  revogarAjuste,
  type Ajuste,
  type AjustesDoHospede,
  type KindDaCasa,
} from '@/service/parceiro/hotel-rotina-service'

import AjusteGaveta from './AjusteGaveta.vue'
import PropostaGaveta from './PropostaGaveta.vue'

const props = defineProps<{ hospedagemId: string; podeEscrever: boolean }>()

const { t } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

const rotina = ref<AjustesDoHospede | null>(null)
const erro = ref('')
const recado = ref('')
const revogando = ref<string | null>(null)

async function carregar() {
  try {
    rotina.value = await lerAjustes(props.hospedagemId, parceiroQuery())
    erro.value = ''
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('rotinaDoHotel.ajuste.erroAoCarregar')).mensagem
  }
}

onMounted(() => void carregar())
watch(
  () => props.hospedagemId,
  () => void carregar(),
)

type LinhaDaRotina = {
  kind: KindDaCasa
  horarios: string[]
  ativo: boolean
  passeio: boolean
  ajuste: Ajuste | null
}

const linhas = computed<LinhaDaRotina[]>(() =>
  KINDS_DA_CASA.map((kind) => {
    const item = rotina.value?.rotinaEfetiva.find((atual) => atual.kind === kind)
    return {
      kind,
      horarios: item?.horarios ?? [],
      ativo: item?.ativo ?? false,
      passeio: item?.exigeAutorizacao === 'PASSEIO_EXTERNO',
      ajuste: rotina.value?.ajustes.find((ajuste) => ajuste.kind === kind) ?? null,
    }
  }),
)

function valor(linha: LinhaDaRotina) {
  if (linha.ajuste?.acao === 'SUSPENDE') return t('rotinaDoHotel.ajuste.suspenso')
  if (!linha.ativo || !linha.horarios.length) return t('rotinaDoHotel.casa.desligado')
  return linha.horarios.join(', ')
}

function deQuem(ajuste: Ajuste) {
  return [
    ajuste.origem === 'PROPOSTA' ? t('rotinaDoHotel.ajuste.daProposta') : '',
    ajuste.motivo ?? '',
    [ajuste.registradoPorNome ?? '', rotulos.quando(ajuste.registradoEm)]
      .filter(Boolean)
      .join(', '),
  ]
    .filter(Boolean)
    .join(' · ')
}

async function revogar(ajuste: Ajuste) {
  revogando.value = ajuste.id
  erro.value = ''
  try {
    await revogarAjuste(props.hospedagemId, ajuste.id, parceiroQuery())
    recado.value = t('rotinaDoHotel.ajuste.revogado')
    await carregar()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('rotinaDoHotel.ajuste.erro')).mensagem
  } finally {
    revogando.value = null
  }
}

const ajusteAberto = ref(false)
const propostaAberta = ref(false)
const kindEscolhido = ref<KindDaCasa | null>(null)
const horariosEscolhidos = ref<string[]>([])

function ajustar(linha: LinhaDaRotina | null) {
  kindEscolhido.value = linha?.kind ?? null
  horariosEscolhidos.value = linha?.horarios ?? []
  recado.value = ''
  ajusteAberto.value = true
}

function salvo(nova: AjustesDoHospede, texto = '') {
  rotina.value = nova
  recado.value = texto || t('rotinaDoHotel.ajuste.salvo')
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="rh-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-timer" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="rh-titulo" class="ui-cartao__titulo">{{ t('rotinaDoHotel.ajuste.secao') }}</h2>
        <p class="ui-cartao__descricao">{{ t('rotinaDoHotel.ajuste.descricao') }}</p>
      </span>
      <span v-if="podeEscrever" class="rh__acoes">
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-lightbulb"
          :label="t('rotinaDoHotel.proposta.ver')"
          @click="propostaAberta = true"
        />
        <Button
          type="button"
          size="small"
          icon="ph ph-sliders-horizontal"
          :label="t('rotinaDoHotel.ajuste.titulo')"
          @click="ajustar(null)"
        />
      </span>
    </header>

    <p v-if="recado" class="eg__aviso rh__nota" role="status">
      <i class="ph ph-check-circle" aria-hidden="true" />
      <span>{{ recado }}</span>
    </p>
    <p v-if="erro" class="eg__erro rh__nota" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <ul v-if="rotina" class="ui-lista">
      <li v-for="linha in linhas" :key="linha.kind" class="ui-linha">
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo rh__nome">
            {{ t(`rotinaDoHotel.kind.${linha.kind}`) }}
            <span v-if="linha.ajuste" class="ui-selo ui-selo--lugar">{{
              t('rotinaDoHotel.ajuste.proprio')
            }}</span>
          </strong>
          <span class="ui-linha__meta rh__valor">{{ valor(linha) }}</span>
          <span v-if="linha.ajuste" class="ui-linha__meta">{{ deQuem(linha.ajuste) }}</span>
          <span v-else-if="linha.passeio && linha.ativo" class="ui-linha__meta">{{
            t('rotinaDoHotel.casa.sobre.PASSEIO')
          }}</span>
        </span>
        <span v-if="podeEscrever" class="ui-linha__fim rh__acoes">
          <Button
            v-if="linha.ajuste"
            type="button"
            size="small"
            severity="secondary"
            outlined
            :label="t('rotinaDoHotel.ajuste.voltar')"
            :loading="revogando === linha.ajuste.id"
            @click="revogar(linha.ajuste)"
          />
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-pencil-simple"
            :aria-label="t('rotinaDoHotel.ajuste.titulo')"
            :title="t('rotinaDoHotel.ajuste.titulo')"
            @click="ajustar(linha)"
          />
        </span>
      </li>
    </ul>

    <AjusteGaveta
      v-model:visible="ajusteAberto"
      :hospedagem-id="hospedagemId"
      :kind="kindEscolhido"
      :horarios="horariosEscolhidos"
      @salvo="(nova) => salvo(nova)"
    />
    <PropostaGaveta
      v-model:visible="propostaAberta"
      :hospedagem-id="hospedagemId"
      :pode-aprovar="podeEscrever"
      @aprovada="(nova, texto) => salvo(nova, texto)"
    />
  </section>
</template>

<style scoped>
.rh__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.rh__nota {
  margin: 0;
  padding: 0 10px 12px;
}

.rh__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.rh__valor {
  color: var(--tinta);
  font-variant-numeric: tabular-nums;
}
</style>
