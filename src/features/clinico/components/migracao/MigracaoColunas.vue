<script setup lang="ts">
/**
 * As colunas da planilha — num painel lateral, só para quem quer conferir.
 *
 * Isto já foi a etapa 2 do assistente, e o retorno foi que ninguém no balcão entende "ligar coluna
 * a campo". O sistema faz a ligação sozinho; o que ele não consegue (a coluna obrigatória que não
 * achou) vira pergunta nas dúvidas. Aqui fica a conferência, para quem pedir:
 *
 * - **Primeiro o que ficou de fora** — a coluna com conteúdo que não vai para lugar nenhum. É a
 *   única que pode esconder um dado que importa.
 * - **Depois o que foi usado**, com o palpite marcado quando o sistema adivinhou pelo conteúdo.
 *
 * Os dois grupos são fixados quando o painel abre: trocar o destino de uma coluna não a faz pular
 * de grupo debaixo do dedo de quem acabou de mexer.
 *
 * Fechar o painel confere o que mudou. Se um obrigatório ficou sem coluna, ele volta como
 * pergunta; se a troca criou uma dúvida nova (uma coluna de espécie com valor desconhecido), o
 * resumo leva para ela.
 */
import Drawer from 'primevue/drawer'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { useColunasDaPlanilha, type ColunaDaPlanilha } from '../../composables/useColunasDaPlanilha'
import { useRotulosDaMigracao } from '../../composables/useRotulosDaMigracao'
import { CAMPOS_DO_ANIMAL, CAMPOS_DO_RESPONSAVEL, type CampoDeDestino } from '../../domain/migracao'
import { useMigracaoStore } from '../../stores/migracao'

const visivel = defineModel<boolean>('visivel', { required: true })

const { t } = useI18n()
const migracao = useMigracaoStore()
const rotulos = useRotulosDaMigracao()
const formato = useClinicFormat()
const { colunas, comConteudo, deFora } = useColunasDaPlanilha()

/** O `Select` trata `null` como "nada escolhido"; "não trazer" precisa ser uma escolha de verdade. */
const NAO_TRAZER = 'nao-trazer'

/** As que estavam de fora quando o painel abriu. */
const fixadasDeFora = ref(new Set<number>())

watch(visivel, (aberto) => {
  if (aberto) {
    fixadasDeFora.value = new Set(
      colunas.value
        .filter((coluna) => coluna.destino === null && coluna.preenchidas > 0)
        .map((coluna) => coluna.coluna),
    )

    return
  }

  if (migracao.faltas.length > 0) {
    migracao.conferirObrigatorias()
  } else if (migracao.etapa === 'importar') {
    migracao.abrirResumo()
  }
})

const naoUsadas = computed(() =>
  colunas.value.filter((coluna) => fixadasDeFora.value.has(coluna.coluna)),
)
/* Coluna vazia não aparece em grupo nenhum: não há o que perder nela (a mesma conta do cabeçalho). */
const usadasNoPainel = computed(() =>
  comConteudo.value.filter((coluna) => !fixadasDeFora.value.has(coluna.coluna)),
)

/** Depois do botão de importar, o plano está congelado: mexer aqui não mudaria nada. */
const travado = computed(() => migracao.estado !== 'parada')

const grupos = computed(() => [
  {
    rotulo: t('clinico.migracao.colunas.grupoResponsavel'),
    itens: CAMPOS_DO_RESPONSAVEL.map((campo) => ({ valor: campo, rotulo: rotulos.campo(campo) })),
  },
  {
    rotulo: t('clinico.migracao.colunas.grupoAnimal'),
    itens: CAMPOS_DO_ANIMAL.map((campo) => ({ valor: campo, rotulo: rotulos.campo(campo) })),
  },
  {
    rotulo: t('clinico.migracao.colunas.grupoNenhum'),
    itens: [{ valor: NAO_TRAZER, rotulo: t('clinico.migracao.colunas.naoTrazer') }],
  },
])

const faltam = computed(() => migracao.faltas.map((campo) => rotulos.campo(campo)))

function mudar(coluna: number, valor: string) {
  migracao.mapear(coluna, valor === NAO_TRAZER ? null : (valor as CampoDeDestino))
}

const secoes = computed(() =>
  [
    { id: 'fora', lista: naoUsadas.value },
    { id: 'usadas', lista: usadasNoPainel.value },
  ].filter((secao) => secao.lista.length > 0),
)

function estadoDa(
  coluna: ColunaDaPlanilha,
): { classe: string; icone: string; texto: string } | null {
  if (coluna.destino === null && coluna.preenchidas > 0) {
    return {
      classe: 'hc--pessego',
      icone: 'pi pi-exclamation-circle',
      texto: t(
        'clinico.migracao.colunas.naoVem',
        { n: formato.numero(coluna.preenchidas, 0) },
        coluna.preenchidas,
      ),
    }
  }

  if (coluna.como === 'pessoa') {
    return {
      classe: 'hc--verde',
      icone: 'pi pi-check',
      texto: t('clinico.migracao.colunas.voceEscolheu'),
    }
  }

  if (coluna.destino !== null && coluna.confianca === 'provavel') {
    return {
      classe: 'hc--lilas',
      icone: 'pi pi-sparkles',
      texto: t('clinico.migracao.colunas.sugestao'),
    }
  }

  return null
}
</script>

<template>
  <Drawer
    v-model:visible="visivel"
    position="right"
    class="mg-tema hc-tema mg-painel"
    :close-button-props="{ severity: 'secondary', text: false, rounded: true }"
    :pt="{ root: { style: 'width: min(46rem, 100vw)' } }"
  >
    <template #header>
      <div class="cabeca">
        <!-- O foco de abertura vem para o título, não para o fechar: o anel no X, sem ninguém ter
             usado o teclado, fazia do fechar a coisa mais chamativa do painel. -->
        <h2 class="cabeca__titulo" tabindex="-1" autofocus>
          {{ t('clinico.migracao.colunas.titulo') }}
        </h2>
        <p v-if="migracao.planilha" class="cabeca__arquivo">
          <i class="pi pi-file" aria-hidden="true" />
          <bdi>{{ migracao.planilha.arquivo }}</bdi>
          <span>·</span>
          <span>
            {{
              t('clinico.migracao.colunas.usadas', {
                n: comConteudo.length - deFora.length,
                total: comConteudo.length,
              })
            }}
          </span>
        </p>
      </div>
    </template>

    <div class="corpo">
      <p class="mg-texto">
        {{ travado ? t('clinico.migracao.colunas.travado') : t('clinico.migracao.colunas.texto') }}
      </p>

      <p v-if="faltam.length" class="mg-caixa mg-caixa--coral aviso" role="status">
        <i class="pi pi-exclamation-circle" aria-hidden="true" />
        <span>{{ t('clinico.migracao.colunas.faltam', { campos: faltam.join(', ') }) }}</span>
      </p>

      <section
        v-for="secao in secoes"
        :key="secao.id"
        class="secao"
        :aria-labelledby="`mg-colunas-${secao.id}`"
      >
        <header class="secao__cabeca">
          <h3 :id="`mg-colunas-${secao.id}`" class="secao__titulo">
            {{
              t(
                `clinico.migracao.colunas.${secao.id === 'fora' ? 'naoUsadasTitulo' : 'usadasTitulo'}`,
                { n: secao.lista.length },
                secao.lista.length,
              )
            }}
          </h3>
          <p v-if="secao.id === 'fora'" class="secao__texto">
            {{ t('clinico.migracao.colunas.naoUsadasTexto', secao.lista.length) }}
          </p>
        </header>

        <ul class="lista">
          <li v-for="coluna in secao.lista" :key="coluna.coluna" class="coluna">
            <div class="coluna__planilha">
              <span class="coluna__nome">
                <span class="mg-chip hc--cinza">{{
                  t('clinico.migracao.colunas.coluna', { letra: coluna.letra })
                }}</span>
                <strong
                  ><bdi>{{ coluna.titulo }}</bdi></strong
                >
              </span>
              <span class="coluna__exemplos">
                <bdi v-for="exemplo in coluna.exemplos" :key="exemplo" class="mg-celula">{{
                  exemplo
                }}</bdi>
                <em v-if="coluna.exemplos.length === 0" class="coluna__vazia">
                  {{ t('clinico.migracao.colunas.vazia') }}
                </em>
              </span>
              <span
                v-if="estadoDa(coluna)"
                class="mg-chip coluna__estado"
                :class="estadoDa(coluna)!.classe"
              >
                <i :class="estadoDa(coluna)!.icone" aria-hidden="true" />
                {{ estadoDa(coluna)!.texto }}
              </span>
            </div>

            <label class="coluna__destino">
              <span class="coluna__rotulo">{{ t('clinico.migracao.colunas.vaiPara') }}</span>
              <Select
                :model-value="coluna.destino ?? NAO_TRAZER"
                :options="grupos"
                option-group-label="rotulo"
                option-group-children="itens"
                option-label="rotulo"
                option-value="valor"
                fluid
                :disabled="travado"
                :pt="{ overlay: { class: 'clinic-overlay' } }"
                :aria-label="t('clinico.migracao.colunas.vaiParaAria', { coluna: coluna.titulo })"
                @update:model-value="(valor: string) => mudar(coluna.coluna, valor)"
              />
            </label>
          </li>
        </ul>
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.cabeca {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.cabeca__titulo:focus {
  outline: none;
}

.cabeca__titulo {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.cabeca__arquivo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  gap: 0.4rem;
}

.cabeca__arquivo .pi {
  color: var(--hc-marca);
  font-size: 0.8rem;
}

.corpo {
  display: grid;
  align-content: start;
  padding-top: 0.25rem;
  gap: 1.5rem;
  container-type: inline-size;
}

.aviso {
  display: flex;
  align-items: center;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  font-weight: 600;
  gap: 0.6rem;
}

.aviso .pi {
  color: var(--hc-coral-tinta);
}

.secao {
  display: grid;
  gap: 0.75rem;
}

.secao__cabeca {
  display: grid;
  gap: 0.25rem;
}

.secao__titulo {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1.0625rem;
  font-weight: 700;
}

.secao__texto {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.9375rem;
  line-height: 1.5;
}

/* Um cartão só, com fio entre as colunas — o mesmo ritmo do painel de linhas. */
.lista {
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: 1px solid var(--hc-borda);
  border-radius: 1rem;
  background: var(--hc-cartao);
  box-shadow: var(--hc-sombra);
  list-style: none;
}

/*
 * A coluna à esquerda, o destino à direita, na mesma altura: o painel tem largura para os dois, e
 * o olho liga um ao outro sem descer. No estreito, o destino desce para baixo da coluna.
 */
.coluna {
  display: grid;
  align-items: center;
  padding: 0.9rem 1rem;
  gap: 0.75rem 1.25rem;
  grid-template-columns: minmax(0, 1fr) 14rem;
}

.coluna + .coluna {
  border-top: 1px solid var(--hc-linha);
}

.coluna__planilha {
  display: grid;
  justify-items: start;
  min-width: 0;
  gap: 0.45rem;
}

.coluna__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  gap: 0.5rem;
}

.coluna__exemplos {
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
  gap: 0.35rem;
}

.coluna__vazia {
  color: var(--hc-tinta-3);
  font-size: 0.875rem;
}

.coluna__destino {
  display: grid;
  gap: 0.3rem;
}

.coluna__rotulo {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 600;
}

@container (max-width: 34rem) {
  .coluna {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
