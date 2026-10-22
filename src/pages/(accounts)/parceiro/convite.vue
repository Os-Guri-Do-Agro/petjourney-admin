<script setup lang="ts">
/**
 * O convite para a equipe (E0-01), em dois caminhos.
 *
 * Com o link do e-mail: a guarda do roteador já tirou o `token` da URL e o guardou
 * (`convite-pendente.ts`); aqui ele é lido, aceito ou recusado, e esquecido. Qualquer conta
 * logada aceita: o token prova que a pessoa abriu o e-mail convidado.
 *
 * Sem o link: os convites que chegaram para esta conta (`meus-convites`). O convite novo só se
 * aceita pelo link, então a linha dele só diz para abrir o e-mail; o antigo (`CAIXA`) ainda aceita
 * aqui.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import type { ConviteAceitoDto, MeuConviteDto } from '@/service/contrato/openapi'
import { esquecerTokenDoConvite, lerTokenDoConvite } from '@/service/parceiro/convite-pendente'
import {
  aceitarConviteDaCaixa,
  aceitarConvitePorLink,
  listarMeusConvites,
  recusarConviteDaCaixa,
  recusarConvitePorLink,
} from '@/service/parceiro/equipe-service'
import { useParceiroStore } from '@/stores/parceiro'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

type Estado = 'link' | 'caixa' | 'recusado' | 'jaMembro'

const { t, locale } = useI18n()
const toast = useToast()
const router = useRouter()
const store = useParceiroStore()

const token = ref(lerTokenDoConvite())
const estado = ref<Estado>(token.value ? 'link' : 'caixa')
/** A `message` da API quando o link não vale mais (expirado, usado, trocado por reenvio). */
const avisoDoLink = ref('')
const trabalhando = ref<string | null>(null)

const convites = ref<MeuConviteDto[] | null>(null)
const erroDaCaixa = ref('')

const icone = computed(
  () =>
    ({
      link: 'ph ph-envelope-open',
      caixa: 'ph ph-tray',
      recusado: 'ph ph-x-circle',
      jaMembro: 'ph ph-check-circle',
    })[estado.value],
)

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    day: 'numeric',
    month: 'long',
  })
}

async function entrarNaEquipe(aceito: ConviteAceitoDto) {
  store.setParceiroId(aceito.parceiroId)
  toast.add({
    severity: 'success',
    summary: t('parceiro.convite.aceito'),
    detail: t('parceiro.convite.aceitoDetalhe'),
    life: 4000,
  })
  await store.bootstrap(true).catch(() => undefined)
  await router.replace(getDefaultLandingPath())
}

function avisarErro(err: unknown) {
  toast.add({
    severity: 'error',
    summary: t('parceiro.equipe.toast.erro'),
    detail: err instanceof Error ? err.message : undefined,
    life: 6000,
  })
}

/* ------------------------------------------------------------------------- pelo link */

async function decidirPeloLink(aceitar: boolean) {
  const valor = token.value

  if (!valor || trabalhando.value) {
    return
  }

  trabalhando.value = aceitar ? 'aceitar' : 'recusar'

  try {
    if (aceitar) {
      const aceito = await aceitarConvitePorLink(valor)
      esquecerTokenDoConvite()
      await entrarNaEquipe(aceito)
      return
    }

    await recusarConvitePorLink(valor)
    esquecerTokenDoConvite()
    estado.value = 'recusado'
  } catch (err) {
    const codigo = err instanceof ApiError ? err.codigo : undefined

    if (codigo === 'CONVITE_EXPIRADO' || codigo === 'CONVITE_NAO_ENCONTRADO') {
      esquecerTokenDoConvite()
      token.value = null
      avisoDoLink.value = (err as Error).message
      estado.value = 'caixa'
      void carregarCaixa()
      return
    }

    if (codigo === 'EQUIPE_JA_MEMBRO') {
      esquecerTokenDoConvite()
      avisoDoLink.value = (err as Error).message
      estado.value = 'jaMembro'
      return
    }

    avisarErro(err)
  } finally {
    trabalhando.value = null
  }
}

/* ------------------------------------------------------------------------- pela caixa */

async function carregarCaixa() {
  erroDaCaixa.value = ''

  try {
    convites.value = await listarMeusConvites()
  } catch (err) {
    erroDaCaixa.value =
      err instanceof Error ? err.message : t('parceiro.convite.caixa.erroCarregar')
  }
}

async function decidirPelaCaixa(convite: MeuConviteDto, aceitar: boolean) {
  if (trabalhando.value) {
    return
  }

  trabalhando.value = `${convite.conviteId}:${aceitar ? 'aceitar' : 'recusar'}`

  try {
    if (aceitar) {
      await entrarNaEquipe(await aceitarConviteDaCaixa(convite.conviteId))
      return
    }

    await recusarConviteDaCaixa(convite.conviteId)
    await carregarCaixa()
  } catch (err) {
    avisarErro(err)
    await carregarCaixa()
  } finally {
    trabalhando.value = null
  }
}

onMounted(() => {
  if (estado.value === 'caixa') {
    void carregarCaixa()
  }
})
</script>

<template>
  <UiPagina class="tela-convite" :titulo="t('parceiro.convite.title')">
    <template #cabecalho>
      <div class="centro-cabeca">
        <span class="ui-ladrilho ui-ladrilho--lugar centro-cabeca__selo" aria-hidden="true">
          <i :class="icone" />
        </span>
        <h1 class="centro-cabeca__titulo">
          {{
            estado === 'recusado'
              ? t('parceiro.convite.recusado.titulo')
              : estado === 'caixa'
                ? t('parceiro.convite.caixa.titulo')
                : t('parceiro.convite.title')
          }}
        </h1>
        <p v-if="estado === 'link'" class="centro-cabeca__texto">
          {{ t('parceiro.convite.link.corpo') }}
        </p>
        <p v-else-if="estado === 'recusado'" class="centro-cabeca__texto">
          {{ t('parceiro.convite.recusado.corpo') }}
        </p>
        <p v-else-if="estado === 'jaMembro'" class="centro-cabeca__texto">{{ avisoDoLink }}</p>
      </div>
    </template>

    <!-- Pelo link do e-mail: aceitar é o passo natural; recusar fica ao lado, com borda. -->
    <div v-if="estado === 'link'" class="convite ui-folha">
      <Button
        type="button"
        class="convite__principal"
        icon="ph ph-check"
        :label="t('parceiro.convite.link.aceitar')"
        :loading="trabalhando === 'aceitar'"
        :disabled="trabalhando !== null"
        @click="decidirPeloLink(true)"
      />
      <Button
        type="button"
        class="convite__principal"
        :label="t('parceiro.convite.link.recusar')"
        severity="secondary"
        outlined
        :loading="trabalhando === 'recusar'"
        :disabled="trabalhando !== null"
        @click="decidirPeloLink(false)"
      />
    </div>

    <div v-else-if="estado === 'jaMembro' || estado === 'recusado'" class="convite ui-folha">
      <RouterLink class="p-button p-component convite__principal" :to="getDefaultLandingPath()">
        {{ t('parceiro.convite.irParaPortal') }}
      </RouterLink>
    </div>

    <!-- Sem o link: os convites desta conta. -->
    <div v-else class="caixa">
      <p v-if="avisoDoLink" class="caixa__aviso" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>
          <strong>{{ t('parceiro.convite.naoVale') }}</strong>
          {{ avisoDoLink }}
        </span>
      </p>

      <ul v-if="!convites && !erroDaCaixa" class="ui-lista ui-folha" aria-hidden="true">
        <li v-for="n in 2" :key="n" class="ui-linha">
          <Skeleton shape="circle" size="2.5rem" />
          <span class="ui-linha__texto">
            <Skeleton width="10rem" height="0.9rem" border-radius="6px" />
            <Skeleton width="14rem" height="0.8rem" border-radius="6px" />
          </span>
        </li>
      </ul>

      <div v-else-if="erroDaCaixa" class="caixa__erro ui-folha" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroDaCaixa }}</span>
        <Button
          type="button"
          icon="ph ph-arrow-clockwise"
          :label="t('common.retry')"
          severity="secondary"
          outlined
          size="small"
          @click="carregarCaixa"
        />
      </div>

      <div v-else-if="convites && !convites.length" class="caixa__vazio ui-folha">
        <strong>{{ t('parceiro.convite.caixa.vazio') }}</strong>
        <span>{{ t('parceiro.convite.caixa.vazioDica') }}</span>
      </div>

      <ul v-else-if="convites" class="ui-lista ui-folha">
        <li v-for="convite in convites" :key="convite.conviteId" class="ui-linha caixa__linha">
          <img
            v-if="convite.parceiro.logoUrl"
            class="caixa__logo"
            :src="convite.parceiro.logoUrl"
            alt=""
          />
          <span v-else class="caixa__logo caixa__logo--sem" aria-hidden="true">
            <i class="ph ph-buildings" />
          </span>

          <span class="ui-linha__texto">
            <span class="ui-linha__titulo">{{ convite.parceiro.nome }}</span>
            <span class="ui-linha__meta">
              {{
                convite.convidadoPorNome
                  ? t('parceiro.convite.caixa.deQuem', {
                      nome: convite.convidadoPorNome,
                      papel: t(`parceiro.equipe.papel.${convite.papel}`).toLowerCase(),
                    })
                  : t('parceiro.convite.caixa.semNome', {
                      papel: t(`parceiro.equipe.papel.${convite.papel}`).toLowerCase(),
                    })
              }}
              <template v-if="convite.expiraEm">
                ·
                {{
                  t('parceiro.convite.caixa.validoAte', { data: formatarData(convite.expiraEm) })
                }}
              </template>
            </span>
            <span v-if="convite.aceitaPor === 'LINK'" class="ui-linha__meta caixa__dica">
              <i class="ph ph-envelope-simple" aria-hidden="true" />
              {{ t('parceiro.convite.caixa.abraOEmail') }}
            </span>
          </span>

          <span v-if="convite.aceitaPor === 'CAIXA'" class="ui-linha__fim caixa__acoes">
            <Button
              type="button"
              :label="t('parceiro.convite.caixa.recusar')"
              severity="secondary"
              outlined
              size="small"
              :loading="trabalhando === `${convite.conviteId}:recusar`"
              :disabled="trabalhando !== null"
              @click="decidirPelaCaixa(convite, false)"
            />
            <Button
              type="button"
              icon="ph ph-check"
              :label="t('parceiro.convite.caixa.aceitar')"
              size="small"
              :loading="trabalhando === `${convite.conviteId}:aceitar`"
              :disabled="trabalhando !== null"
              @click="decidirPelaCaixa(convite, true)"
            />
          </span>
        </li>
      </ul>
    </div>
  </UiPagina>
</template>

<style scoped>
.centro-cabeca {
  display: grid;
  width: 100%;
  max-width: 34rem;
  justify-items: center;
  gap: 8px;
  margin: clamp(16px, 7vh, 80px) auto 0;
  text-align: center;
}

.centro-cabeca__selo.ui-ladrilho {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  font-size: 28px;
}

.centro-cabeca__titulo {
  margin: 12px 0 0;
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.centro-cabeca__texto {
  max-width: 46ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 15px;
  line-height: 1.5;
}

.convite {
  display: grid;
  width: 100%;
  max-width: 30rem;
  gap: 12px;
  margin: 8px auto 0;
  padding: 22px;
}

.convite__principal.p-button,
.convite__principal {
  width: 100%;
  min-height: 46px;
  justify-content: center;
  font-size: 15px;
  text-decoration: none;
}

.caixa {
  display: grid;
  width: 100%;
  max-width: 40rem;
  gap: 14px;
  margin: 8px auto 0;
}

.caixa__aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.caixa__aviso > i {
  margin-top: 2px;
  color: var(--risco-tinta);
  font-size: 18px;
}

.caixa__aviso strong {
  display: block;
}

.caixa__erro {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  font-size: 14px;
}

.caixa__erro > i {
  color: var(--risco-tinta);
  font-size: 18px;
}

.caixa__vazio {
  display: grid;
  gap: 4px;
  padding: 22px 24px;
  color: var(--tinta-2);
  font-size: 14px;
  text-align: center;
}

.caixa__vazio strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.caixa__logo {
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 12px;
  object-fit: cover;
}

.caixa__logo--sem {
  display: grid;
  place-items: center;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-size: 18px;
}

.caixa__dica {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.caixa__acoes {
  gap: 8px;
}

@media (max-width: 520px) {
  .centro-cabeca {
    margin-top: 8px;
  }

  .centro-cabeca__titulo {
    font-size: 24px;
  }

  .caixa__linha {
    flex-wrap: wrap;
  }
}
</style>
