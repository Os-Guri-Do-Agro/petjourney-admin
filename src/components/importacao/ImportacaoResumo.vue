<script setup lang="ts">
/**
 * Passo 3, antes do botão: o resumo do servidor em três caixas (guia e2, 4.3) e a confirmação.
 *
 * Vão entrar, arrumamos sozinhos, não vão entrar. "Importar" refaz o plano com a base de agora e
 * congela: se a recepção cadastrou alguém nesse meio-tempo e nasceu dúvida nova, volta-se às
 * dúvidas (409 `IMPORTACAO_COM_DUVIDAS`).
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { tituloDoCodigo } from '@/components/importacao/leitura-da-importacao'
import { colunasUsadas } from '@/components/importacao/planilha-para-a-api'
import { obterResumo, type ResumoDaImportacao } from '@/service/parceiro/importacao-service'
import { useImportacaoStore } from '@/stores/importacao-da-base'
import { useParceiroStore } from '@/stores/parceiro'

const emit = defineEmits<{ colunas: []; rever: [] }>()

const { t } = useI18n()
const toast = useToast()
const store = useImportacaoStore()
const parceiro = useParceiroStore()
const rotulos = useRotulosDoCadastro()

const resumo = ref<ResumoDaImportacao | null>(null)
const erro = ref('')
const importando = ref(false)
const descartando = ref(false)
const perguntandoDescarte = ref(false)

async function carregar() {
  const id = store.importacao?.id
  if (!id) return
  erro.value = ''

  try {
    resumo.value = await obterResumo(
      id,
      parceiro.parceiroId ? { parceiroId: parceiro.parceiroId } : undefined,
    )
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('importacao.erroAoCarregar')).mensagem
  }
}

onMounted(() => void carregar())

const notaDasColunas = computed(() => {
  const total = store.planilha?.cabecalhos.length ?? 0
  if (!total) return ''
  const usadas = colunasUsadas(store.colunas)
  return usadas === total
    ? t('clinico.migracao.colunas.nota.todas', { n: total }, total)
    : t('clinico.migracao.colunas.nota.parte', { n: usadas, total })
})

const padronizacoes = computed(() => {
  const itens = (resumo.value?.padronizacoes ?? []).filter((item) => item.n > 0)
  if (!itens.length) return ''
  const lista = new Intl.ListFormat(rotulos.intl(), { type: 'conjunction' }).format(
    itens.map((item) => t(`clinico.migracao.padronizacao.${item.tipo}`, { n: item.n }, item.n)),
  )
  return t('clinico.migracao.resumo.arrumamos.formatacao', { lista })
})

async function importar() {
  importando.value = true

  try {
    await store.confirmar()
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    toast.add({
      severity: lido.codigo === 'IMPORTACAO_COM_DUVIDAS' ? 'warn' : 'error',
      summary: lido.mensagem,
      life: 6000,
    })
    if (lido.codigo === 'IMPORTACAO_COM_DUVIDAS') await store.atualizar()
  } finally {
    importando.value = false
  }
}

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
</script>

<template>
  <section class="ui-folha ui-cartao res" aria-labelledby="res-titulo">
    <header class="ui-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-list-checks" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="res-titulo" class="ui-cartao__titulo">{{ t('clinico.migracao.resumo.titulo') }}</h2>
        <p class="ui-cartao__descricao">{{ t('clinico.migracao.resumo.texto') }}</p>
      </span>
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
        @click="carregar"
      />
    </p>

    <div v-else-if="!resumo" class="res__caixas" aria-busy="true">
      <Skeleton v-for="n in 3" :key="n" height="8rem" />
    </div>

    <template v-else>
      <div class="res__caixas">
        <div class="res__caixa">
          <span class="res__rotulo">
            <i class="ph ph-check-circle res__icone--ok" aria-hidden="true" />
            {{ t('clinico.migracao.resumo.entram.titulo') }}
          </span>
          <strong class="res__numero ui-num">{{ rotulos.numero(resumo.entram) }}</strong>
          <ul class="res__lista">
            <li v-if="resumo.pacientesNovos">
              {{
                t(
                  'clinico.migracao.resumo.entram.pacientesNovos',
                  { n: rotulos.numero(resumo.pacientesNovos) },
                  resumo.pacientesNovos,
                )
              }}
            </li>
            <li v-if="resumo.pacientesExistentes">
              {{
                t(
                  'clinico.migracao.resumo.entram.pacientesExistentes',
                  { n: rotulos.numero(resumo.pacientesExistentes) },
                  resumo.pacientesExistentes,
                )
              }}
            </li>
            <li v-if="resumo.responsaveisNovos">
              {{
                t(
                  'clinico.migracao.resumo.entram.responsaveisNovos',
                  { n: rotulos.numero(resumo.responsaveisNovos) },
                  resumo.responsaveisNovos,
                )
              }}
            </li>
            <li v-if="resumo.responsaveisExistentes">
              {{
                t(
                  'clinico.migracao.resumo.entram.responsaveisExistentes',
                  { n: rotulos.numero(resumo.responsaveisExistentes) },
                  resumo.responsaveisExistentes,
                )
              }}
            </li>
          </ul>
        </div>

        <div class="res__caixa">
          <span class="res__rotulo">
            <i class="ph ph-magic-wand res__icone--ajuste" aria-hidden="true" />
            {{ t('clinico.migracao.resumo.arrumamos.titulo') }}
          </span>
          <strong class="res__numero ui-num">{{ rotulos.numero(resumo.corrigidas) }}</strong>
          <ul class="res__lista">
            <li v-if="resumo.corrigidas">
              {{ t('clinico.migracao.resumo.arrumamos.corrigidas') }}
            </li>
            <li v-if="resumo.paraCompletar">
              {{
                t(
                  'importacao.resumo.paraCompletar',
                  { n: rotulos.numero(resumo.paraCompletar) },
                  resumo.paraCompletar,
                )
              }}
            </li>
            <li v-if="padronizacoes">{{ padronizacoes }}</li>
          </ul>
        </div>

        <div class="res__caixa">
          <span class="res__rotulo">
            <i class="ph ph-x-circle res__icone--fora" aria-hidden="true" />
            {{ t('clinico.migracao.resumo.fora.titulo') }}
          </span>
          <strong class="res__numero ui-num">{{ rotulos.numero(resumo.naoEntram) }}</strong>
          <ul class="res__lista">
            <li v-for="item in resumo.foraPorMotivo" :key="item.codigo">
              {{ t(tituloDoCodigo(item.codigo)) }}:
              <span class="ui-num">{{
                t('clinico.migracao.comum.linhasN', { n: rotulos.numero(item.linhas) }, item.linhas)
              }}</span>
            </li>
            <li v-if="!resumo.naoEntram">{{ t('clinico.migracao.resumo.fora.nenhuma') }}</li>
          </ul>
        </div>
      </div>

      <p class="res__nota">
        <span v-if="resumo.emBranco" class="ui-num">
          {{
            t('importacao.resumo.emBranco', { n: rotulos.numero(resumo.emBranco) }, resumo.emBranco)
          }}
        </span>
        <span v-if="notaDasColunas">{{ notaDasColunas }}</span>
        <span>{{ t('clinico.migracao.resumo.promessa') }}</span>
      </p>
    </template>

    <footer class="ui-cartao__pe res__pe">
      <Button
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-chats-circle"
        :label="t('importacao.resumo.rever')"
        @click="emit('rever')"
      />
      <Button
        v-if="store.planilha"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-table"
        :label="t('clinico.migracao.colunas.ver')"
        @click="emit('colunas')"
      />
      <span class="res__espaco" />
      <Button
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-trash"
        :label="t('importacao.descartar')"
        :disabled="importando"
        @click="perguntandoDescarte = true"
      />
      <Button
        type="button"
        icon="ph ph-database"
        :label="
          t(
            'clinico.migracao.resumo.importar',
            { n: rotulos.numero(resumo?.entram ?? 0) },
            resumo?.entram ?? 0,
          )
        "
        :loading="importando"
        :disabled="!resumo || resumo.entram === 0"
        @click="importar"
      />
    </footer>

    <Dialog
      :visible="perguntandoDescarte"
      modal
      :closable="!descartando"
      :header="t('importacao.descartarTitulo')"
      @update:visible="(aberto: boolean) => !aberto && (perguntandoDescarte = false)"
    >
      <p class="res__dialogo">{{ t('importacao.descartarTexto') }}</p>
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
  </section>
</template>

<style scoped>
.res {
  display: grid;
  gap: 16px;
}

.res__caixas {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
}

.res__caixa {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 16px;
  background: var(--app-cartao, var(--superficie));
}

.res__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.res__icone--ok {
  color: var(--ok-tinta);
}

.res__icone--ajuste {
  color: var(--atencao-tinta);
}

.res__icone--fora {
  color: var(--risco-tinta);
}

.res__numero {
  color: var(--tinta);
  font-size: 22px;
  font-weight: 650;
}

.res__lista {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
  list-style: none;
}

.res__nota {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.res__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.res__espaco {
  flex: 1;
}

/* Quebrando a linha no estreito, o botão principal continua à direita. */
.res__pe > :last-child {
  margin-inline-start: auto;
}

.res__dialogo {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}
</style>
