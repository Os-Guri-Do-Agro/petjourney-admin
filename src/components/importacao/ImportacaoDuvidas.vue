<script setup lang="ts">
/**
 * Passo 2: as dúvidas do servidor, uma por vez (guia e2, 4.2).
 *
 * Quem já é cliente da clínica (só o nome, o telefone sem o nome inteiro, o mesmo CPF com outro
 * nome), quem se repete na planilha e o animal sem responsável. A primeira resposta aceita é a
 * segura: é a que a tela aponta para quem não sabe. Depois de cada resposta a lista é relida, porque
 * juntar duas pessoas pode fazer nascer uma dúvida nova contra a clínica. Com `revisao`, a tela
 * percorre todas (as respondidas também), para mudar de ideia antes de importar.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import {
  listarDuvidas,
  responderDuvidas,
  type Duvida,
  type LadoDaDuvida,
  type OpcaoDaDuvida,
} from '@/service/parceiro/importacao-service'
import { useImportacaoStore } from '@/stores/importacao-da-base'
import { useParceiroStore } from '@/stores/parceiro'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

const props = defineProps<{ revisao?: boolean }>()
const emit = defineEmits<{ voltar: [] }>()

const { t } = useI18n()
const toast = useToast()
const store = useImportacaoStore()
const parceiro = useParceiroStore()
const rotulos = useRotulosDoCadastro()

const lista = ref<Duvida[]>([])
const abertas = ref(0)
const total = ref(0)
const posicao = ref(0)
const carregando = ref(true)
const respondendo = ref<string | null>(null)
const perguntandoDescarte = ref(false)
const descartando = ref(false)

async function descartar() {
  descartando.value = true

  try {
    await store.descartar()
    perguntandoDescarte.value = false
    toast.add({ severity: 'success', summary: t('importacao.descartada'), life: 3000 })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem,
      life: 6000,
    })
  } finally {
    descartando.value = false
  }
}
const erro = ref('')

const leitura = criarUltimaLeitura()

function query() {
  return parceiro.parceiroId ? { parceiroId: parceiro.parceiroId } : undefined
}

/** Na revisão vêm todas, de 50 em 50, o teto da rota (são poucas); no normal, as 20 primeiras sem resposta. */
async function carregar() {
  const id = store.importacao?.id
  if (!id) return

  const vez = leitura.nova()
  carregando.value = true
  erro.value = ''

  try {
    const itens: Duvida[] = []
    let cursor: string | null | undefined = null

    do {
      const pagina = await listarDuvidas(
        id,
        { pendentes: !props.revisao, cursor, limite: props.revisao ? 50 : 20 },
        query(),
      )
      if (!leitura.valendo(vez)) return
      itens.push(...pagina.itens)
      abertas.value = pagina.abertas
      total.value = pagina.total
      cursor = props.revisao ? pagina.proximoCursor : null
    } while (cursor)

    lista.value = itens
    posicao.value = Math.min(posicao.value, Math.max(0, itens.length - 1))
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDoCadastro(err, t('importacao.erroAoCarregar')).mensagem
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

onMounted(() => void carregar())

const atual = computed(() => (props.revisao ? lista.value[posicao.value] : lista.value[0]))

const contador = computed(() =>
  props.revisao
    ? t('clinico.migracao.duvidas.contador', { n: posicao.value + 1, total: lista.value.length })
    : t('clinico.migracao.duvidas.contador', {
        n: Math.max(1, total.value - abertas.value + 1),
        total: total.value,
      }),
)

/* ------------------------------------------------------------------------- as frases */

function titulo(duvida: Duvida) {
  if (duvida.tipo === 'ORFAO') {
    return t('clinico.migracao.duvidas.orfao.pergunta', { nome: duvida.daPlanilha.nome })
  }
  if (duvida.tipo === 'MESMA_PESSOA') {
    return t('clinico.migracao.duvidas.mesma-pessoa.pergunta', { nome: duvida.daPlanilha.nome })
  }
  return t('clinico.migracao.duvidas.responsavel-existente.pergunta', {
    nome: duvida.daPlanilha.nome,
  })
}

function texto(duvida: Duvida) {
  if (duvida.tipo === 'ORFAO') {
    return t('clinico.migracao.duvidas.orfao.texto', { linha: duvida.numeroLinha })
  }
  if (duvida.tipo === 'MESMA_PESSOA') {
    return duvida.motivo === 'CPF_NOME_DIVERGE'
      ? t('importacao.duvida.mesmoCpf')
      : t('clinico.migracao.duvidas.mesma-pessoa.texto')
  }
  if (duvida.motivo === 'CPF_NOME_DIVERGE') {
    return t('importacao.duvida.cpf', { nome: duvida.candidatos[0]?.nome ?? '' })
  }
  if (duvida.motivo === 'TELEFONE') return t('importacao.duvida.telefone')
  return t('clinico.migracao.duvidas.responsavel-existente.texto')
}

/** O lado de lá: os candidatos da clínica, ou a outra linha da planilha. */
function rotuloDoOutro(duvida: Duvida, lado: LadoDaDuvida) {
  const linha = lado.linhas[0]
  if (duvida.tipo === 'ORFAO' && linha) {
    return t('clinico.migracao.duvidas.linhaDeCima', { n: linha })
  }
  return linha
    ? t('importacao.duvida.naPlanilha', { n: linha })
    : t('clinico.migracao.duvidas.jaCadastrado')
}

function rotuloDaPlanilha(duvida: Duvida) {
  return duvida.tipo === 'ORFAO'
    ? t('clinico.migracao.duvidas.oAnimal', { n: duvida.numeroLinha })
    : t('importacao.duvida.naPlanilha', { n: duvida.numeroLinha })
}

/** "Linhas 12, 13 e 14", cortado em 10 com "e mais {n}". */
function linhasDoLado(lado: LadoDaDuvida) {
  if (lado.linhas.length < 2) return ''
  const lista = new Intl.ListFormat(rotulos.intl(), { type: 'conjunction' }).format(
    lado.linhas.map(String),
  )
  const resto = lado.totalLinhas - lado.linhas.length
  return resto > 0
    ? t('importacao.duvida.linhasEMais', { lista, n: resto }, resto)
    : t('clinico.migracao.comum.linhasLista', { lista }, lado.linhas.length)
}

function animaisDoLado(lado: LadoDaDuvida) {
  if (!lado.animais.length) return t('clinico.migracao.duvidas.semAnimal')
  return new Intl.ListFormat(rotulos.intl(), { type: 'conjunction' }).format(lado.animais)
}

type Resposta = { resposta: OpcaoDaDuvida; clienteId?: string; rotulo: string }

/** Os botões, na ordem da API: a primeira é a segura. */
const respostas = computed<Resposta[]>(() => {
  const duvida = atual.value
  if (!duvida) return []

  return duvida.respostasAceitas.flatMap((resposta): Resposta[] => {
    if (resposta === 'JUNTAR_AO' && duvida.tipo === 'RESPONSAVEL_EXISTENTE') {
      return duvida.candidatos.map((candidato) => ({
        resposta,
        clienteId: candidato.clienteId,
        rotulo:
          duvida.candidatos.length === 1
            ? t('clinico.migracao.duvidas.responsavel-existente.sim')
            : t('importacao.duvida.ehCandidato', { nome: candidato.nome }),
      }))
    }
    if (resposta === 'JUNTAR_AO') {
      return [
        {
          resposta,
          rotulo: t('clinico.migracao.duvidas.orfao.sim', { outro: duvida.outro?.nome ?? '' }),
        },
      ]
    }
    if (resposta === 'MESMA_PESSOA') {
      return [{ resposta, rotulo: t('clinico.migracao.duvidas.mesma-pessoa.sim') }]
    }
    if (resposta === 'PESSOAS_DIFERENTES') {
      return [
        {
          resposta,
          rotulo:
            duvida.tipo === 'MESMA_PESSOA'
              ? t('clinico.migracao.duvidas.mesma-pessoa.nao')
              : t('clinico.migracao.duvidas.responsavel-existente.nao'),
        },
      ]
    }
    return [
      {
        resposta,
        rotulo:
          duvida.tipo === 'ORFAO'
            ? t('clinico.migracao.duvidas.orfao.nao')
            : t('importacao.duvida.deixarDeFora'),
      },
    ]
  })
})

const segura = computed(() => respostas.value[0])

function escolhida(item: Resposta) {
  const duvida = atual.value
  if (!duvida?.resposta || duvida.resposta !== item.resposta) return false
  return !item.clienteId || duvida.clienteEscolhidoId === item.clienteId
}

function chaveDe(item: Resposta) {
  return `${item.resposta}:${item.clienteId ?? ''}`
}

/* -------------------------------------------------------------------------- responder */

async function responder(item: Resposta) {
  const duvida = atual.value
  const id = store.importacao?.id
  if (!duvida || !id) return

  respondendo.value = chaveDe(item)

  try {
    const registradas = await responderDuvidas(
      id,
      [
        {
          duvidaId: duvida.id,
          resposta: item.resposta,
          ...(item.clienteId ? { clienteId: item.clienteId } : {}),
        },
      ],
      query(),
    )

    if (props.revisao && posicao.value < lista.value.length - 1) posicao.value += 1

    /* Sem nenhuma aberta, a importação fica PRONTA e a tela segue para o resumo. */
    if (registradas.duvidasAbertas === 0 || registradas.status !== store.importacao?.status) {
      await store.atualizar()
    }
    await carregar()
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    if (lido.codigo !== 'IMPORTACAO_DUVIDA_INEXISTENTE') {
      toast.add({ severity: 'error', summary: lido.mensagem, life: 6000 })
    }
    await carregar()
  } finally {
    respondendo.value = null
  }
}
</script>

<template>
  <section class="ui-folha ui-cartao duv" aria-labelledby="duv-titulo" aria-live="polite">
    <div v-if="carregando && !atual" class="duv__esqueleto" aria-busy="true">
      <Skeleton height="2.5rem" />
      <Skeleton height="7rem" />
    </div>

    <p v-else-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="carregar"
      />
    </p>

    <template v-else-if="atual">
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true">
          <i :class="atual.tipo === 'ORFAO' ? 'ph ph-paw-print' : 'ph ph-users-three'" />
        </span>
        <span class="ui-cartao__titulos">
          <span class="duv__contador ui-num">{{ contador }}</span>
          <h2 id="duv-titulo" class="ui-cartao__titulo">
            <bdi>{{ titulo(atual) }}</bdi>
          </h2>
          <p class="ui-cartao__descricao">{{ texto(atual) }}</p>
        </span>
      </header>

      <div class="duv__lados">
        <div class="duv__lado">
          <span class="eg__rotulo">{{ rotuloDaPlanilha(atual) }}</span>
          <strong class="duv__nome"
            ><bdi>{{ atual.daPlanilha.nome }}</bdi></strong
          >
          <span v-if="atual.daPlanilha.telefone" class="ui-num">{{
            atual.daPlanilha.telefone
          }}</span>
          <span v-if="atual.daPlanilha.especie" class="duv__meta">
            {{ t(`cadastro.especie.${atual.daPlanilha.especie}`) }}
          </span>
          <span v-if="atual.tipo !== 'ORFAO'" class="duv__meta">
            {{ animaisDoLado(atual.daPlanilha) }}
          </span>
          <span v-if="linhasDoLado(atual.daPlanilha)" class="duv__meta ui-num">
            {{ linhasDoLado(atual.daPlanilha) }}
          </span>
        </div>

        <template v-if="atual.tipo === 'RESPONSAVEL_EXISTENTE'">
          <div
            v-for="candidato in atual.candidatos"
            :key="candidato.clienteId"
            class="duv__lado duv__lado--clinica"
          >
            <span class="eg__rotulo">{{ t('clinico.migracao.duvidas.jaCadastrado') }}</span>
            <strong class="duv__nome"
              ><bdi>{{ candidato.nome }}</bdi></strong
            >
            <span v-if="candidato.telefone" class="ui-num">{{ candidato.telefone }}</span>
            <span class="duv__meta">{{ animaisDoLado(candidato) }}</span>
          </div>
        </template>

        <div v-else-if="atual.outro" class="duv__lado">
          <span class="eg__rotulo">{{ rotuloDoOutro(atual, atual.outro) }}</span>
          <strong class="duv__nome"
            ><bdi>{{ atual.outro.nome }}</bdi></strong
          >
          <span v-if="atual.outro.telefone" class="ui-num">{{ atual.outro.telefone }}</span>
          <span class="duv__meta">{{ animaisDoLado(atual.outro) }}</span>
          <span v-if="linhasDoLado(atual.outro)" class="duv__meta ui-num">
            {{ linhasDoLado(atual.outro) }}
          </span>
        </div>
      </div>

      <div class="duv__respostas">
        <Button
          v-for="item in respostas"
          :key="chaveDe(item)"
          type="button"
          :severity="escolhida(item) ? undefined : 'secondary'"
          :outlined="!escolhida(item)"
          :icon="escolhida(item) ? 'ph ph-check' : undefined"
          :label="item.rotulo"
          :loading="respondendo === chaveDe(item)"
          :disabled="respondendo !== null"
          @click="responder(item)"
        />
      </div>
      <p v-if="segura" class="eg__dica duv__segura">
        <i class="ph ph-shield-check" aria-hidden="true" />
        {{ t('importacao.duvida.segura', { resposta: segura.rotulo }) }}
      </p>

      <footer v-if="props.revisao" class="ui-cartao__pe duv__pe">
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-arrow-left"
          :label="t('clinico.migracao.duvidas.anterior')"
          :disabled="posicao === 0"
          @click="posicao -= 1"
        />
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-arrow-right"
          icon-pos="right"
          :label="t('clinico.migracao.duvidas.proxima')"
          :disabled="posicao >= lista.length - 1"
          @click="posicao += 1"
        />
        <span class="duv__espaco" />
        <Button
          type="button"
          icon="ph ph-list-checks"
          :label="t('clinico.migracao.duvidas.verResumo')"
          @click="emit('voltar')"
        />
      </footer>

      <!-- Desistir no meio: nada foi gravado, e o arquivo fica para mandar de novo. -->
      <footer v-else class="ui-cartao__pe duv__pe">
        <span class="duv__espaco" />
        <Button
          type="button"
          severity="secondary"
          outlined
          icon="ph ph-trash"
          :label="t('importacao.descartar')"
          @click="perguntandoDescarte = true"
        />
      </footer>
    </template>

    <Dialog
      :visible="perguntandoDescarte"
      modal
      :closable="!descartando"
      :header="t('importacao.descartarTitulo')"
      @update:visible="(aberto: boolean) => !aberto && (perguntandoDescarte = false)"
    >
      <p class="duv__dialogo">{{ t('importacao.descartarTexto') }}</p>
      <template #footer>
        <Button
          type="button"
          severity="secondary"
          outlined
          :label="t('cadastro.voltar')"
          :disabled="descartando"
          @click="perguntandoDescarte = false"
        />
        <Button
          type="button"
          severity="danger"
          :label="t('importacao.descartar')"
          :loading="descartando"
          @click="descartar"
        />
      </template>
    </Dialog>

    <div v-if="!carregando && !erro && !atual" class="ui-vazio duv__vazio">
      <i class="ph ph-check-circle" aria-hidden="true" />
      <strong>{{ t('clinico.migracao.duvidas.nenhumaTitulo') }}</strong>
      <span>{{ t('clinico.migracao.duvidas.nenhumaTexto') }}</span>
      <Button
        v-if="props.revisao"
        type="button"
        icon="ph ph-list-checks"
        :label="t('clinico.migracao.duvidas.verResumo')"
        @click="emit('voltar')"
      />
    </div>
  </section>
</template>

<style scoped>
.duv {
  display: grid;
  gap: 16px;
}

.duv__esqueleto {
  display: grid;
  gap: 12px;
}

.duv__contador {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.duv__lados {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
}

.duv__lado {
  display: grid;
  align-content: start;
  gap: 3px;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--app-cartao, var(--superficie));
  color: var(--tinta);
  font-size: 13.5px;
}

.duv__nome {
  font-size: 15px;
  font-weight: 650;
}

.duv__meta {
  color: var(--tinta-2);
  font-size: 13px;
}

.duv__respostas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.duv__segura {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.duv__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.duv__espaco {
  flex: 1;
}

.duv__dialogo {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.duv__vazio {
  justify-items: center;
  padding: 32px 16px;
  text-align: center;
}

.duv__vazio > i {
  color: var(--tinta-3);
  font-size: 26px;
}
</style>
