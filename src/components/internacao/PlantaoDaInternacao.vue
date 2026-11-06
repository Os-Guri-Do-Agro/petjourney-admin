<script setup lang="ts">
/**
 * O plantão da internação no mapa (E5-02c, guia e5 15.1 a 15.3): quem está de plantão, até
 * quando e o que ficou da passagem anterior. Sem plantão aberto, "Assumir" abre o da grade
 * (manhã 07-13, tarde 13-19, noite 19-07); o primeiro registro de dose abriria um automático.
 * O plantão vencido não bloqueia nada: o aviso e o "Passar plantão".
 *
 * O checklist de todas as internações do plantão mora numa tela própria.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { criarChaveadorDeIdempotencia } from '@/service/idempotencia'
import {
  assumirPlantao,
  lerPlantaoAtual,
  type Entrega,
  type PlantaoAtual,
} from '@/service/parceiro/plantao-da-internacao-service'
import { listarProfissionais, type Profissional } from '@/service/parceiro/profissionais-service'

import PassagemGaveta from './PassagemGaveta.vue'

const props = defineProps<{ podeExecutar: boolean }>()

const { t, locale } = useI18n()
const { store, parceiroQuery } = useParceiroPortal()
const chaveador = criarChaveadorDeIdempotencia()

const plantao = ref<PlantaoAtual | null>(null)
const profissionais = ref<Profissional[]>([])
const erro = ref('')
const recado = ref('')
const assumindo = ref(false)

async function carregar() {
  try {
    plantao.value = await lerPlantaoAtual(parceiroQuery())
    erro.value = ''
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('internacao.plantao.erro')).mensagem
  }
}

defineExpose({ carregar })

onMounted(async () => {
  void carregar()
  if (props.podeExecutar)
    profissionais.value = await listarProfissionais({ ...parceiroQuery(), ativo: true }).catch(
      () => [],
    )
})

function hora(valor: string) {
  return new Date(valor).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' })
}

const frase = computed(() => {
  const atual = plantao.value?.atual
  if (atual)
    return t('internacao.plantao.atual', {
      turno: t(`internacao.plantao.kind.${atual.kind}`),
      inicio: hora(atual.inicio),
      fim: hora(atual.fimPrevisto),
      nome: atual.responsavel.nome,
    })
  const sugerido = plantao.value?.sugerido
  if (sugerido)
    return t('internacao.plantao.semPlantao', {
      turno: t(`internacao.plantao.kind.${sugerido.kind}`),
      inicio: hora(sugerido.inicio),
      fim: hora(sugerido.fimPrevisto),
    })
  return ''
})

/* Entrega o responsável; o DONO também, com o plantão vencido (a API confere). */
const podePassar = computed(() => {
  const atual = plantao.value?.atual
  if (!atual || !props.podeExecutar) return false
  return (
    atual.responsavel.profissionalId === store.eu?.profissional?.id ||
    (atual.vencido && store.temPermissao('estabelecimento.editar'))
  )
})

async function assumir() {
  assumindo.value = true
  recado.value = ''
  try {
    await assumirPlantao(chaveador.para({ assumir: true }), parceiroQuery())
    chaveador.concluir()
    await carregar()
  } catch (err) {
    chaveador.concluir()
    recado.value = lerErroDoCadastro(err, t('internacao.plantao.erroAssumir')).mensagem
    await carregar()
  } finally {
    assumindo.value = false
  }
}

const passagemAberta = ref(false)
const recebidaAberta = ref(false)

function entregue(entrega: Entrega) {
  recado.value = t(
    'internacao.plantao.entregue',
    { nome: entrega.novo.responsavel.nome, n: entrega.pendenciasCongeladas },
    entrega.pendenciasCongeladas,
  )
  void carregar()
}

const nomes = computed(
  () =>
    new Map((plantao.value?.profissionais ?? []).map((item) => [item.profissionalId, item.nome])),
)
const recebida = computed(() => plantao.value?.passagemRecebida ?? null)
const pendentesDaRecebida = computed(
  () =>
    recebida.value?.pendencias.filter(
      (item) =>
        item.situacaoAgora === 'atrasada' ||
        item.situacaoAgora === 'na-janela' ||
        item.situacaoAgora === 'futura',
    ).length ?? 0,
)
</script>

<template>
  <section class="ui-folha ui-cartao" aria-labelledby="pl-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-clock-user" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="pl-titulo" class="ui-cartao__titulo">{{ t('internacao.plantao.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ frase }}</p>
      </span>
      <span class="pl__acoes">
        <RouterLink
          v-if="podeExecutar"
          to="/clinica/internacao/plantao"
          class="p-button p-component p-button-secondary p-button-outlined p-button-sm"
        >
          <i class="ph ph-list-checks" aria-hidden="true" />
          {{ t('internacao.plantao.checklist') }}
        </RouterLink>
        <Button
          v-if="podeExecutar && plantao && !plantao.atual"
          type="button"
          size="small"
          icon="ph ph-sign-in"
          :label="t('internacao.plantao.assumir')"
          :loading="assumindo"
          @click="assumir"
        />
        <Button
          v-if="podePassar"
          type="button"
          size="small"
          icon="ph ph-arrows-left-right"
          :label="t('internacao.plantao.passar')"
          @click="passagemAberta = true"
        />
      </span>
    </header>

    <p v-if="plantao?.atual?.vencido" class="eg__aviso pl__nota">
      <i class="ph ph-clock-countdown" aria-hidden="true" />
      <span>{{ t('internacao.plantao.vencido', { hora: hora(plantao.atual.fimPrevisto) }) }}</span>
    </p>
    <p v-if="recado" class="eg__aviso pl__nota" role="status">
      <i class="ph ph-info" aria-hidden="true" />
      <span>{{ recado }}</span>
    </p>
    <p v-if="erro" class="eg__erro pl__nota" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <template v-if="recebida">
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        class="pl__mais"
        :icon="recebidaAberta ? 'ph ph-caret-up' : 'ph ph-caret-down'"
        :label="
          t('internacao.plantao.recebida', {
            nome: recebida.entreguePor?.nome ?? '',
            hora: hora(recebida.entregueEm),
          })
        "
        :aria-expanded="recebidaAberta"
        @click="recebidaAberta = !recebidaAberta"
      />
      <div v-show="recebidaAberta" class="pl__recebida">
        <p class="pl__nota-da-passagem">{{ recebida.nota }}</p>
        <p v-if="recebida.pendencias.length" class="eg__dica">
          {{
            t(
              'internacao.plantao.pendentesDaRecebida',
              { n: pendentesDaRecebida, total: recebida.pendencias.length },
              pendentesDaRecebida,
            )
          }}
        </p>
        <ul v-if="recebida.pendencias.length" class="ui-lista">
          <li v-for="item in recebida.pendencias" :key="item.administracaoId" class="ui-linha">
            <span class="ui-hora">{{ hora(item.previstaPara) }}</span>
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ item.descricao }}</strong>
              <span class="ui-linha__meta">{{
                [
                  t(`internacao.dose.situacaoCurta.${item.situacaoAgora}`),
                  item.atribuidaAId ? nomes.get(item.atribuidaAId) : '',
                ]
                  .filter(Boolean)
                  .join(' · ')
              }}</span>
            </span>
          </li>
        </ul>
      </div>
    </template>

    <PassagemGaveta
      v-model:visible="passagemAberta"
      :plantao="plantao"
      :profissionais="profissionais"
      @entregue="entregue"
    />
  </section>
</template>

<style scoped>
.pl__acoes {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.pl__acoes a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
}

.pl__nota {
  margin: 0;
  padding: 0 24px 12px;
}

.pl__mais {
  justify-self: start;
  margin: 0 24px 14px;
}

.pl__recebida {
  display: grid;
  gap: 8px;
  padding: 0 24px 14px;
}

.pl__nota-da-passagem {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-line;
}
</style>
