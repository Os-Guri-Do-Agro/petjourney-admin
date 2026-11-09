<script setup lang="ts">
/**
 * O diário da estadia (E7-05b, guia e7 43): as entradas da equipe e as ocorrências LEVES e
 * MODERADAS, do mais recente, 30 por página (uma fonte por fato: a ocorrência não é copiada; a
 * GRAVE fica na caixa de ocorrências). A foto se abre pela URL assinada de 5 minutos, pedida no
 * toque. Estadia encerrada: lê, não escreve.
 */
import Button from 'primevue/button'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDasReservas } from '@/components/hotel/reservas/useRotulosDasReservas'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  lerDiario,
  urlDaFotoDoDiario,
  type PaginaDoDiario,
} from '@/service/parceiro/hotel-ocorrencias-service'
import { abrirAbaVazia, levarAoArquivo } from '@/utils/arquivo-assinado'

import DiarioGaveta from './DiarioGaveta.vue'

const props = defineProps<{ hospedagemId: string; podeEscrever: boolean }>()

const { t, te } = useI18n()
const rotulos = useRotulosDasReservas()
const { parceiroQuery } = useParceiroPortal()

const pagina = ref<PaginaDoDiario | null>(null)
const carregando = ref(false)
const erro = ref('')
const escreverAberta = ref(false)

async function carregar(mais = false) {
  carregando.value = true
  try {
    const lida = await lerDiario(
      props.hospedagemId,
      mais ? pagina.value?.proximoCursor : null,
      parceiroQuery(),
    )
    pagina.value =
      mais && pagina.value ? { ...lida, itens: [...pagina.value.itens, ...lida.itens] } : lida
    erro.value = ''
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('rotinaDoHotel.diario.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

defineExpose({ carregar })

onMounted(() => void carregar())
watch(
  () => props.hospedagemId,
  () => void carregar(),
)

function rotuloDoKind(tipo: 'REGISTRO' | 'OCORRENCIA', kind: string) {
  const chave =
    tipo === 'OCORRENCIA'
      ? `rotinaDoHotel.ocorrencia.kind.${kind}`
      : `rotinaDoHotel.diario.kind.${kind}`
  return te(chave) ? t(chave) : kind
}

async function verFoto(registroId: string) {
  const janela = abrirAbaVazia()
  try {
    const { url } = await urlDaFotoDoDiario(props.hospedagemId, registroId, parceiroQuery())
    levarAoArquivo(janela, url)
  } catch (err) {
    janela?.close()
    erro.value = lerErroDoCadastro(err, t('rotinaDoHotel.diario.erroFoto')).mensagem
  }
}
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="di-titulo" :aria-busy="carregando">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-notebook" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="di-titulo" class="ui-cartao__titulo">{{ t('rotinaDoHotel.diario.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ t('rotinaDoHotel.diario.descricao') }}</p>
      </span>
      <Button
        v-if="podeEscrever"
        type="button"
        size="small"
        icon="ph ph-plus"
        :label="t('rotinaDoHotel.diario.escrever')"
        @click="escreverAberta = true"
      />
    </header>

    <p v-if="erro" class="eg__erro di__nota" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <ul v-if="pagina?.itens.length" class="ui-lista">
      <li
        v-for="item in pagina.itens"
        :key="`${item.tipo}-${item.id}`"
        class="ui-linha"
        :class="{ 'ui-marca ui-marca--atencao': item.gravidade === 'MODERADA' }"
      >
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo di__nome">
            {{ rotuloDoKind(item.tipo, item.kind) }}
            <span
              v-if="item.gravidade"
              class="ui-selo"
              :class="item.gravidade === 'MODERADA' ? 'ui-selo--atencao' : 'ui-selo--contorno'"
              >{{ t(`rotinaDoHotel.ocorrencia.gravidade.${item.gravidade}`) }}</span
            >
          </strong>
          <span class="di__texto">{{ item.texto }}</span>
          <span v-if="item.conduta" class="ui-linha__meta">{{
            t('rotinaDoHotel.ocorrencia.condutaFeita', { conduta: item.conduta })
          }}</span>
          <span class="ui-linha__meta">{{
            [rotulos.quando(item.em), item.porNome ?? ''].filter(Boolean).join(' · ')
          }}</span>
        </span>
        <span v-if="item.temFoto" class="ui-linha__fim">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-image"
            :label="t('rotinaDoHotel.diario.verFoto')"
            @click="verFoto(item.id)"
          />
        </span>
      </li>
    </ul>
    <p v-else-if="pagina && !erro" class="di__nota di__vazio">
      {{ t('rotinaDoHotel.diario.vazio') }}
    </p>

    <Button
      v-if="pagina?.proximoCursor"
      type="button"
      size="small"
      severity="secondary"
      outlined
      class="di__mais"
      :label="t('rotinaDoHotel.verMais')"
      :loading="carregando"
      @click="carregar(true)"
    />

    <DiarioGaveta
      v-model:visible="escreverAberta"
      :hospedagem-id="hospedagemId"
      @escrito="carregar()"
    />
  </section>
</template>

<style scoped>
.di__nota {
  margin: 0;
  padding: 0 10px 12px;
}

.di__vazio {
  color: var(--tinta-2);
  font-size: 14px;
}

.di__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.di__texto {
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
}

.di__mais {
  justify-self: start;
  margin: 4px 10px 12px;
}
</style>
