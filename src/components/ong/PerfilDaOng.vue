<script setup lang="ts">
/**
 * O perfil da ONG (guia 2.5 item 6): o limite de animais e o que a consulta do CNPJ trouxe
 * (natureza jurídica e situação na Receita), pelo `GET /parceiro/portal/ong/perfil`.
 *
 * - `cnpjIrregular` (inapto ou suspenso): a faixa de atenção, e nada foi bloqueado.
 * - `cnpjEncerrado` (baixado ou nulo): a faixa do encerrado. Quando o módulo já está só para
 *   consulta por isso, a linha do `UiPagina` diz a mesma frase e a daqui não repete.
 * - O limite só sobe pelo suporte, e o CNPJ da ONG também só muda pelo suporte.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { lerErroDaOng } from '@/components/ong/regras-da-ong'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { obterPerfilDaOng, type PerfilDaOng } from '@/service/parceiro/ong-service'
import { SUPPORT_CONTACTS } from '@/utils/parceiro/support-contacts'

const { t } = useI18n()
const rotulos = useRotulosDoCadastro()
const { store, parceiroQuery } = useParceiroPortal()

const perfil = ref<PerfilDaOng | null>(null)
const carregando = ref(true)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    perfil.value = await obterPerfilDaOng(parceiroQuery())
  } catch (err) {
    erro.value = lerErroDaOng(err, t, t('ong.erros.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())

/** As quatro naturezas de ONG da spec (D2); outra natureza aparece só com o código. */
const NATUREZAS_DE_ONG = new Set(['3999', '3069', '3301', '3204'])

const natureza = computed(() => {
  const codigo = perfil.value?.naturezaJuridica
  if (!codigo) return t('ong.perfil.cnpj.naoLida')

  const nome = NATUREZAS_DE_ONG.has(codigo) ? t(`ong.perfil.natureza.n${codigo}`) : ''
  return [codigo, nome].filter(Boolean).join(' · ')
})

const TOM_DA_SITUACAO: Record<string, string> = {
  ATIVA: 'ui-selo--ok',
  SUSPENSA: 'ui-selo--atencao',
  INAPTA: 'ui-selo--atencao',
  BAIXADA: 'ui-selo--risco',
  NULA: 'ui-selo--risco',
}

const situacao = computed(() => {
  const valor = perfil.value?.cnpjSituacao
  if (!valor) return null

  return {
    rotulo: TOM_DA_SITUACAO[valor] ? t(`ong.perfil.situacao.${valor}`) : valor,
    classe: TOM_DA_SITUACAO[valor] ?? 'ui-selo--contorno',
  }
})

const encerradoNaPagina = computed(
  () => store.modulo('ONG')?.motivoSomenteLeitura === 'CNPJ_ENCERRADO',
)

const numeros = computed(() => {
  const atual = perfil.value
  if (!atual) return []

  return [
    {
      rotulo: t('ong.perfil.numeros.emCuidado'),
      valor: t('ong.perfil.numeros.deLimite', {
        emCuidado: rotulos.numero(atual.emCuidado),
        limite: rotulos.numero(atual.limiteDeAnimais),
      }),
    },
    { rotulo: t('ong.perfil.numeros.entreguesNoMes'), valor: rotulos.numero(atual.entreguesNoMes) },
    { rotulo: t('ong.perfil.numeros.pendentes'), valor: rotulos.numero(atual.entregasPendentes) },
  ]
})
</script>

<template>
  <UiPagina
    class="tela-perfil-ong"
    :resumo="t('ong.perfil.resumo')"
    :carregando="carregando && !perfil"
    :erro="erro && !perfil ? erro : ''"
    @tentar-de-novo="carregar"
  >
    <div v-if="perfil" class="po">
      <p v-if="perfil.cnpjIrregular" class="po__faixa po__faixa--atencao" role="status">
        <i class="ph ph-warning" aria-hidden="true" />
        <span>{{ t('ong.cnpj.irregular') }}</span>
      </p>
      <p
        v-if="perfil.cnpjEncerrado && !encerradoNaPagina"
        class="po__faixa po__faixa--risco"
        role="status"
      >
        <i class="ph ph-warning-octagon" aria-hidden="true" />
        <span>{{ t('ong.cnpj.encerrado') }}</span>
      </p>

      <div class="po__colunas">
        <!-- Os animais e o limite. -->
        <section class="ui-folha ui-cartao po__cartao" aria-labelledby="po-animais">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-paw-print" /></span>
            <span class="ui-cartao__titulos">
              <h2 id="po-animais" class="ui-cartao__titulo">
                {{ t('ong.perfil.numeros.titulo') }}
              </h2>
              <p class="ui-cartao__descricao">{{ t('ong.perfil.gratis') }}</p>
            </span>
          </header>

          <dl class="po__dados">
            <div v-for="numero in numeros" :key="numero.rotulo" class="po__dado">
              <dt>{{ numero.rotulo }}</dt>
              <dd class="ui-num">{{ numero.valor }}</dd>
            </div>
          </dl>

          <p class="po__nota">
            <i class="ph ph-info" aria-hidden="true" />
            <span>{{ t('ong.perfil.limiteDica') }}</span>
          </p>
        </section>

        <!-- O CNPJ na Receita. -->
        <section class="ui-folha ui-cartao po__cartao" aria-labelledby="po-cnpj">
          <header class="ui-cartao__cabeca">
            <span class="ui-ladrilho" aria-hidden="true"
              ><i class="ph ph-identification-card"
            /></span>
            <span class="ui-cartao__titulos">
              <h2 id="po-cnpj" class="ui-cartao__titulo">{{ t('ong.perfil.cnpj.titulo') }}</h2>
              <p class="ui-cartao__descricao">{{ t('ong.perfil.cnpj.descricao') }}</p>
            </span>
          </header>

          <dl class="po__dados">
            <div class="po__dado">
              <dt>{{ t('ong.perfil.cnpj.natureza') }}</dt>
              <dd :class="{ po__vazio: !perfil.naturezaJuridica }">
                <span class="ui-num">{{ natureza }}</span>
              </dd>
            </div>
            <div class="po__dado">
              <dt>{{ t('ong.perfil.cnpj.situacao') }}</dt>
              <dd :class="{ po__vazio: !situacao }">
                <span v-if="situacao" class="ui-selo" :class="situacao.classe">
                  {{ situacao.rotulo }}
                </span>
                <template v-else>{{ t('ong.perfil.cnpj.naoLida') }}</template>
              </dd>
            </div>
          </dl>

          <p class="po__nota">
            <i class="ph ph-info" aria-hidden="true" />
            <span>{{ t('ong.perfil.cnpj.trocar') }}</span>
          </p>
        </section>
      </div>

      <div class="po__suporte">
        <Button
          as="a"
          :href="SUPPORT_CONTACTS.whatsappHref"
          target="_blank"
          rel="noopener noreferrer"
          severity="secondary"
          outlined
          icon="ph ph-whatsapp-logo"
          :label="t('ong.perfil.suporte')"
        />
      </div>
    </div>
  </UiPagina>
</template>

<style scoped>
.po {
  display: grid;
  gap: 16px;
  container-type: inline-size;
}

.po__colunas {
  display: grid;
  gap: 16px;
}

@container (min-width: 900px) {
  .po__colunas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

.po__cartao {
  display: grid;
  gap: 14px;
}

.po__dados {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 12px 20px;
  margin: 0;
}

.po__dado dt {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.po__dado dd {
  margin: 4px 0 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.po__vazio {
  color: var(--tinta-3) !important;
  font-weight: 450 !important;
}

.po__nota {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.po__nota > i {
  margin-top: 2px;
  font-size: 16px;
}

/* A faixa do CNPJ: o tom do estado no fundo pastel, a tinta do mesmo tom no texto. */
.po__faixa {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 16px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.5;
}

.po__faixa > i {
  margin-top: 2px;
  font-size: 18px;
}

.po__faixa--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.po__faixa--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.po__suporte {
  display: flex;
}
</style>
