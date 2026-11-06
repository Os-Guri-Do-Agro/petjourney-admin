<script setup lang="ts">
/**
 * O relatório por linha (guia e2, 4.5), de 100 em 100: o destino de cada linha do arquivo, as
 * frases dos ajustes (com o valor de antes e o de depois), o que não entrou e, depois do desfazer, o
 * que ficou e por quê. 30 dias depois do fim os detalhes somem; ficam o destino e os códigos.
 */
import Button from 'primevue/button'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import {
  chaveDoCampo,
  fraseDoAjuste,
  paraLegivel,
  tituloDoCodigo,
  tomDoCodigo,
} from '@/components/importacao/leitura-da-importacao'
import { telefoneNaTela } from '@/service/parceiro/pacientes-service'
import {
  listarLinhas,
  type CampoDaLinha,
  type DesfechoDaLinha,
  type DestinoDaLinha,
  type LinhaDoRelatorio,
} from '@/service/parceiro/importacao-service'
import { useImportacaoStore } from '@/stores/importacao-da-base'
import { useParceiroStore } from '@/stores/parceiro'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

const { t } = useI18n()
const store = useImportacaoStore()
const parceiro = useParceiroStore()
const rotulos = useRotulosDoCadastro()

const DESTINOS: readonly DestinoDaLinha[] = [
  'ENTRA',
  'JUNTA_EXISTENTE',
  'JUNTA_LINHA',
  'CONTATO',
  'FORA',
]
const DESFECHOS: readonly DesfechoDaLinha[] = [
  'DESFEITA',
  'FICOU_REGISTRO_POSTERIOR',
  'FICOU_VINCULO',
  'FICOU_EDITADO',
  'FICOU_CLIENTE_EM_USO',
  'NADA_A_DESFAZER',
]

const filtro = ref('todas')
const linhas = ref<LinhaDoRelatorio[]>([])
const proximo = ref<number | null>(null)
const carregando = ref(true)
const erro = ref('')
const leitura = criarUltimaLeitura()

const desfeita = computed(() => Boolean(store.importacao?.desfazer))

const opcoes = computed(() => [
  { valor: 'todas', rotulo: t('importacao.relatorio.todas') },
  ...DESTINOS.map((destino) => ({
    valor: `d:${destino}`,
    rotulo: t(`importacao.destino.${destino}`),
  })),
  ...(desfeita.value
    ? DESFECHOS.map((desfecho) => ({
        valor: `x:${desfecho}`,
        rotulo: t(`importacao.desfecho.${desfecho}`),
      }))
    : []),
])

async function carregar(mais = false) {
  const id = store.importacao?.id
  if (!id) return

  const vez = leitura.nova()
  carregando.value = true
  erro.value = ''

  const [tipo, valor] = filtro.value.split(':') as ['d' | 'x' | 'todas', string | undefined]

  try {
    const pagina = await listarLinhas(
      id,
      {
        destino: tipo === 'd' ? (valor as DestinoDaLinha) : null,
        desfecho: tipo === 'x' ? (valor as DesfechoDaLinha) : null,
        cursor: mais ? proximo.value : null,
        limite: 100,
      },
      parceiro.parceiroId ? { parceiroId: parceiro.parceiroId } : undefined,
    )
    if (!leitura.valendo(vez)) return
    linhas.value = mais ? [...linhas.value, ...pagina.itens] : pagina.itens
    proximo.value = pagina.proximoCursor ?? null
  } catch (err) {
    if (!leitura.valendo(vez)) return
    erro.value = lerErroDoCadastro(err, t('importacao.erroAoCarregar')).mensagem
  } finally {
    if (leitura.valendo(vez)) carregando.value = false
  }
}

onMounted(() => void carregar())
watch(filtro, () => void carregar())

/* O desfazer muda os desfechos: o relatório é relido quando ele acaba. */
watch(
  () => store.importacao?.status,
  (novo, antigo) => {
    if (novo !== antigo && (novo === 'DESFEITA' || novo === 'CONCLUIDA')) void carregar()
  },
)

/* ---------------------------------------------------------------------------- frases */

function formatarPara(para: string | null | undefined, campo: CampoDaLinha) {
  return paraLegivel(para, campo, {
    especie: (valor) => t(`cadastro.especie.${valor}`),
    data: (iso) => rotulos.dia(iso),
    telefone: (digitos) => telefoneNaTela(digitos),
    peso: (quilos) => rotulos.peso(quilos),
  })
}

type Frase = { texto: string; tom: 'ajuste' | 'descarte' | 'fora' | 'aviso' }

function frasesDa(linha: LinhaDoRelatorio): Frase[] {
  const frases: Frase[] = linha.ajustes.map((ajuste) => {
    const { chave, params } = fraseDoAjuste(ajuste, {
      campo: t(chaveDoCampo(ajuste.campo)),
      para: formatarPara(ajuste.para, ajuste.campo),
    })
    const tom = tomDoCodigo(ajuste.tipo)
    return { texto: t(chave, params), tom: tom === 'fora' ? 'descarte' : tom }
  })

  /* Os códigos que não têm detalhe (ou todos, depois que os detalhes foram apagados). */
  const detalhados = new Set(linha.ajustes.map((ajuste) => ajuste.tipo))
  for (const codigo of linha.motivos) {
    if (detalhados.has(codigo)) continue
    frases.push({ texto: t(tituloDoCodigo(codigo)), tom: tomDoCodigo(codigo) })
  }

  for (const campo of linha.camposPreenchidos) {
    frases.push({
      texto: t('importacao.relatorio.preencheu', {
        campo: t(chaveDoCampo(campo as Parameters<typeof chaveDoCampo>[0])),
      }),
      tom: 'ajuste',
    })
  }

  return frases
}

function nomes(linha: LinhaDoRelatorio) {
  return [linha.responsavel, linha.animal].filter(Boolean).join(' · ')
}

const ICONE: Record<Frase['tom'], string> = {
  ajuste: 'ph ph-magic-wand',
  descarte: 'ph ph-eraser',
  fora: 'ph ph-x-circle',
  aviso: 'ph ph-info',
}

const TOM_DO_DESTINO: Record<DestinoDaLinha, string> = {
  ENTRA: 'ui-selo--ok',
  JUNTA_EXISTENTE: 'ui-selo--ok',
  JUNTA_LINHA: 'ui-selo--ok',
  CONTATO: 'ui-selo--ok',
  FORA: 'ui-selo--risco',
  DUVIDA: 'ui-selo--atencao',
}
</script>

<template>
  <section class="ui-folha ui-cartao rel" aria-labelledby="rel-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-rows" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="rel-titulo" class="ui-cartao__titulo">{{ t('clinico.migracao.linhas.titulo') }}</h2>
        <p class="ui-cartao__descricao">
          {{
            store.importacao?.dadosApagadosEm
              ? t('importacao.relatorio.apagados')
              : t('importacao.relatorio.texto')
          }}
        </p>
      </span>
      <Select
        v-model="filtro"
        :options="opcoes"
        option-label="rotulo"
        option-value="valor"
        class="rel__filtro"
        :aria-label="t('clinico.migracao.linhas.filtroAria')"
      />
    </header>

    <p v-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
      <Button
        type="button"
        size="small"
        severity="secondary"
        outlined
        :label="t('cadastro.tentarDeNovo')"
        @click="carregar()"
      />
    </p>

    <div v-else-if="carregando && !linhas.length" class="rel__esqueleto" aria-busy="true">
      <Skeleton v-for="n in 4" :key="n" height="3.5rem" />
    </div>

    <p v-else-if="!linhas.length" class="rel__vazio">{{ t('clinico.migracao.linhas.vazio') }}</p>

    <ul v-else class="ui-lista">
      <li v-for="linha in linhas" :key="linha.numeroLinha" class="ui-linha rel__linha">
        <span class="ui-linha__texto">
          <strong class="ui-linha__titulo rel__titulo">
            <span class="ui-num">{{
              t('clinico.migracao.comum.linha', { n: linha.numeroLinha })
            }}</span>
            <span class="ui-selo" :class="TOM_DO_DESTINO[linha.destino]">
              {{ t(`importacao.destino.${linha.destino}`) }}
            </span>
            <span v-if="linha.desfecho" class="ui-selo">
              {{ t(`importacao.desfecho.${linha.desfecho}`) }}
            </span>
          </strong>
          <span v-if="nomes(linha)" class="ui-linha__meta"
            ><bdi>{{ nomes(linha) }}</bdi></span
          >
          <ul v-if="frasesDa(linha).length" class="rel__frases">
            <li
              v-for="(frase, indice) in frasesDa(linha)"
              :key="indice"
              :class="`rel__frase--${frase.tom}`"
            >
              <i :class="ICONE[frase.tom]" aria-hidden="true" />
              <span>{{ frase.texto }}</span>
            </li>
          </ul>
        </span>
        <span v-if="linha.pacienteId && linha.desfecho !== 'DESFEITA'" class="ui-linha__fim">
          <RouterLink :to="`/clinica/ficha/${linha.pacienteId}`" class="rel__abrir">
            {{ t('clinico.migracao.linhas.abrirPaciente') }}
            <i class="ph ph-arrow-right" aria-hidden="true" />
          </RouterLink>
        </span>
      </li>
    </ul>

    <footer v-if="proximo !== null" class="ui-cartao__pe rel__pe">
      <Button
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-caret-down"
        :label="t('importacao.relatorio.mais')"
        :loading="carregando"
        @click="carregar(true)"
      />
    </footer>
  </section>
</template>

<style scoped>
.rel {
  display: grid;
  gap: 12px;
}

.rel__filtro {
  min-width: 14rem;
}

.rel__esqueleto {
  display: grid;
  gap: 10px;
}

.rel__vazio {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.rel__linha {
  align-items: flex-start;
}

.rel__titulo {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.rel__frases {
  display: grid;
  gap: 3px;
  margin: 6px 0 0;
  padding: 0;
  font-size: 13px;
  line-height: 1.45;
  list-style: none;
}

.rel__frases li {
  display: flex;
  gap: 6px;
  color: var(--tinta-2);
}

.rel__frases i {
  flex: none;
  margin-top: 2px;
}

.rel__frase--ajuste i {
  color: var(--ok-tinta);
}

.rel__frase--descarte i,
.rel__frase--aviso i {
  color: var(--atencao-tinta);
}

.rel__frase--fora i {
  color: var(--risco-tinta);
}

.rel__abrir {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.rel__abrir:hover {
  text-decoration: underline;
}

.rel__pe {
  display: flex;
  justify-content: center;
}
</style>
