<script setup lang="ts">
/**
 * Trazer pacientes de outro sistema.
 *
 * É a funcionalidade que decide a venda — nenhuma clínica troca de sistema se tiver que
 * redigitar quinze anos de pacientes — e a que mais facilmente destrói a confiança no primeiro
 * dia, se perder dado calada.
 *
 * A tela é um assistente: **uma coisa por vez**, num cartão só, com o acabamento da Visão geral
 * (escolha do usuário depois de a primeira versão ser recusada por confusa e com botões que não se
 * viam). Três passos: o arquivo, as dúvidas uma a uma, e o resumo que vira progresso e
 * relatório. As colunas eram um passo e deixaram de ser — ninguém no balcão entendia "ligar coluna
 * a campo"; o sistema liga sozinho, e a conferência fica num painel ("Ver colunas"), como a
 * explicação linha por linha: existe, mas só abre quando alguém pede.
 *
 * O estado mora na store (`stores/migracao.ts`), não aqui: a importação continua se a pessoa sair
 * desta tela, e a lista de pacientes avisa onde ela está.
 */
import '@/components/home/home-card.css'
import '@/features/clinico/components/migracao/migracao.css'

import Button from 'primevue/button'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import MigracaoPassoArquivo from '@/features/clinico/components/migracao/MigracaoPassoArquivo.vue'
import MigracaoColunas from '@/features/clinico/components/migracao/MigracaoColunas.vue'
import MigracaoPassoDuvidas from '@/features/clinico/components/migracao/MigracaoPassoDuvidas.vue'
import MigracaoPassoImportar from '@/features/clinico/components/migracao/MigracaoPassoImportar.vue'
import MigracaoPassos from '@/features/clinico/components/migracao/MigracaoPassos.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useClinicoStore } from '@/features/clinico/stores/clinico'
import { useMigracaoStore } from '@/features/clinico/stores/migracao'

const { t } = useI18n()
const clinico = useClinicoStore()
const migracao = useMigracaoStore()
const formato = useClinicFormat()

const colunasAbertas = ref(false)

/* O resumo compara com os pacientes que já existem: o catálogo precisa estar carregado. */
onMounted(() => {
  void clinico.carregar()
})
</script>

<template>
  <PartnerPageFrame
    class="migracao-pagina mg-tema hc-tema"
    :title="t('clinico.migracao.titulo')"
    block-when-suspended
  >
    <template #cabecalho>
      <div class="cabecalho">
        <span class="cabecalho__sobre">{{ t('clinico.migracao.sobre') }}</span>
        <h1 class="cabecalho__titulo">{{ t('clinico.migracao.titulo') }}</h1>
        <p class="cabecalho__lede">{{ t('clinico.migracao.lede') }}</p>
      </div>
    </template>

    <div class="migracao">
      <MigracaoPassos :etapa="migracao.etapa" :sem-duvidas="migracao.perguntas.length === 0" />

      <div v-if="migracao.planilha && migracao.etapa !== 'arquivo'" class="arquivo">
        <span class="arquivo__icone" aria-hidden="true"><i class="pi pi-file" /></span>
        <span class="arquivo__texto">
          <strong
            ><bdi>{{ migracao.planilha.arquivo }}</bdi></strong
          >
          <span>
            {{
              t(
                'clinico.migracao.arquivoLido',
                {
                  linhas: formato.numero(migracao.planilha.linhas.length, 0),
                  colunas: migracao.planilha.cabecalhos.length,
                },
                migracao.planilha.linhas.length,
              )
            }}
            <template v-if="migracao.origem">
              · {{ t('clinico.migracao.origem', { nome: migracao.origem.nome }) }}
            </template>
          </span>
        </span>
        <Button
          class="mg-pilula mg-pilula--pequena"
          icon="pi pi-table"
          :label="t('clinico.migracao.colunas.ver')"
          @click="colunasAbertas = true"
        />
        <Button
          v-if="!migracao.emAndamento"
          class="mg-pilula mg-pilula--pequena"
          icon="pi pi-refresh"
          :label="t('clinico.migracao.trocar')"
          @click="migracao.recomecar()"
        />
      </div>

      <MigracaoPassoArquivo v-if="migracao.etapa === 'arquivo'" />
      <MigracaoPassoDuvidas v-else-if="migracao.etapa === 'duvidas'" />
      <MigracaoPassoImportar v-else @colunas="colunasAbertas = true" />
    </div>

    <MigracaoColunas v-if="migracao.planilha" v-model:visivel="colunasAbertas" />
  </PartnerPageFrame>
</template>

<style scoped>
/* O fundo da Visão geral: dois brilhos sálvia no topo e a grade fina que some descendo. */
.migracao-pagina.partner-page {
  position: relative;
  isolation: isolate;
  background:
    radial-gradient(52rem 26rem at 8% -6rem, rgb(120 196 178 / 30%), transparent 70%),
    radial-gradient(44rem 24rem at 96% -4rem, rgb(96 178 196 / 22%), transparent 70%),
    var(--hc-pagina);
}

.migracao-pagina.partner-page::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background-image:
    linear-gradient(var(--hc-grade) 1px, transparent 1px),
    linear-gradient(90deg, var(--hc-grade) 1px, transparent 1px);
  background-size: 28px 28px;
  content: '';
  mask-image: linear-gradient(to bottom, #000 0, rgb(0 0 0 / 60%) 16rem, transparent 34rem);
  pointer-events: none;
}

.app-dark .migracao-pagina.partner-page {
  background:
    radial-gradient(52rem 26rem at 8% -6rem, rgb(108 201 181 / 13%), transparent 70%),
    radial-gradient(44rem 24rem at 96% -4rem, rgb(108 198 208 / 9%), transparent 70%),
    var(--hc-pagina);
}

.cabecalho {
  display: grid;
  gap: 0.25rem;
}

.cabecalho__sobre {
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
  font-weight: 600;
}

.cabecalho__titulo {
  margin: 0.2rem 0 0;
  color: var(--hc-tinta);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.cabecalho__lede {
  margin: 0;
  background: var(--hc-degrade);
  background-clip: text;
  color: transparent;
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: -0.015em;
  -webkit-text-fill-color: transparent;
}

/*
 * A página inteira, como a Visão geral. Havia um teto de 60rem, e em monitor largo o assistente
 * ocupava a metade esquerda da tela com um vazio do lado — o que se limita agora é só o texto
 * corrido (`.mg-texto`), onde linha longa cansa de verdade.
 */
.migracao {
  display: grid;
  gap: 1.25rem;
}

.arquivo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--hc-borda);
  border-radius: 0.9rem;
  background: var(--hc-cartao);
  box-shadow: var(--hc-sombra);
  gap: 0.75rem;
}

.arquivo__icone {
  display: inline-grid;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.65rem;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
  place-items: center;
}

.arquivo__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

.arquivo__texto strong {
  overflow: hidden;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
