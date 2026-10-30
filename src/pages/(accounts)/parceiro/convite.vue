<script setup lang="ts">
/**
 * O convite para a equipe (E0-01), em dois caminhos.
 *
 * Com o link do e-mail: a guarda do roteador já tirou o `token` da URL e o guardou
 * (`convite-pendente.ts`). A tela pede a prévia (PJ-4BI7TE) para dizer de que empresa é o
 * convite, quem convidou, com que papel e até quando vale; depois aceita ou recusa e esquece o
 * token. Qualquer conta logada aceita: o token prova que a pessoa abriu o e-mail convidado.
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
import type { ConviteAceitoDto, MeuConviteDto, PreviaConviteDto } from '@/service/contrato/openapi'
import { esquecerTokenDoConvite, lerTokenDoConvite } from '@/service/parceiro/convite-pendente'
import {
  aceitarConviteDaCaixa,
  aceitarConvitePorLink,
  listarMeusConvites,
  previaDoConvitePorLink,
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

/** `undefined` enquanto a prévia carrega; `null` quando ela falhou e o convite segue sem nome. */
const previa = ref<PreviaConviteDto | null | undefined>(undefined)

const convites = ref<MeuConviteDto[] | null>(null)
const erroDaCaixa = ref('')

const tituloDaTela = computed(() => {
  if (estado.value === 'recusado') {
    return t('parceiro.convite.recusado.titulo')
  }

  return estado.value === 'caixa' ? t('parceiro.convite.caixa.titulo') : t('parceiro.convite.title')
})

const resumoDaTela = computed(
  () =>
    ({
      link: t('parceiro.convite.link.corpo'),
      caixa: t('parceiro.convite.caixa.vazioDica'),
      recusado: previa.value?.convidadoPorNome
        ? t('parceiro.convite.recusado.corpoComNome', { nome: previa.value.convidadoPorNome })
        : t('parceiro.convite.recusado.corpo'),
      /* A `message` do EQUIPE_JA_MEMBRO é escrita para quem convida ("Esta pessoa já faz parte"). */
      jaMembro: previa.value
        ? t('parceiro.convite.jaMembroCorpoComEmpresa', { empresa: previa.value.parceiro.nome })
        : t('parceiro.convite.jaMembroCorpo'),
    })[estado.value],
)

/** Conta sem empresa (o Início dela diz "Portal ainda não liberado"): o próximo passo é cadastrar a sua. */
const semEmpresa = computed(() => store.semAcessoParceiro)

/** Depois de recusar, os convites que ainda esperam esta conta, se houver. */
const outrosConvites = computed(() =>
  estado.value === 'recusado' && convites.value?.length ? convites.value : null,
)

/** A lista de convites aparece na caixa (sem link) e, depois de recusar, como "Outros convites". */
const mostrarLista = computed(() => estado.value === 'caixa' || Boolean(outrosConvites.value))

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    day: 'numeric',
    month: 'long',
  })
}

/** "Helena Prado convidou você como operador." ou, sem o nome de quem convidou, só o papel. */
function deQuem(convite: Pick<MeuConviteDto, 'convidadoPorNome' | 'papel'>) {
  const papel = t(`parceiro.equipe.papel.${convite.papel}`).toLowerCase()

  return convite.convidadoPorNome
    ? t('parceiro.convite.caixa.deQuem', { nome: convite.convidadoPorNome, papel })
    : t('parceiro.convite.caixa.semNome', { papel })
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

/**
 * Link que não vale mais (expirado, já usado, cancelado ou trocado por um reenvio): o token sai,
 * a tela diz o motivo com a mensagem da API e mostra os convites que ainda valem.
 */
function linkSemValor(err: unknown) {
  const codigo = err instanceof ApiError ? err.codigo : undefined
  /* 400 sem código: o validador recusou o token (link cortado ao copiar do e-mail). Antes a tela
     oferecia "Aceitar convite" para um link que nunca ia funcionar. */
  const incompleto = err instanceof ApiError && err.statusCode === 400 && !codigo

  if (!incompleto && codigo !== 'CONVITE_EXPIRADO' && codigo !== 'CONVITE_NAO_ENCONTRADO') {
    return false
  }

  esquecerTokenDoConvite()
  token.value = null
  avisoDoLink.value = incompleto ? t('parceiro.convite.linkIncompleto') : (err as Error).message
  estado.value = 'caixa'
  void carregarCaixa()
  return true
}

async function carregarPrevia() {
  const valor = token.value

  if (!valor) {
    return
  }

  try {
    previa.value = await previaDoConvitePorLink(valor)
  } catch (err) {
    /* Outra falha (rede, servidor): o convite continua valendo, só sem dizer de quem é. */
    if (!linkSemValor(err)) {
      previa.value = null
    }
  }
}

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
    void carregarCaixa()
  } catch (err) {
    if (linkSemValor(err)) {
      return
    }

    if (err instanceof ApiError && err.codigo === 'EQUIPE_JA_MEMBRO') {
      esquecerTokenDoConvite()
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
  if (estado.value === 'link') {
    void carregarPrevia()
  } else {
    void carregarCaixa()
  }
})
</script>

<template>
  <UiPagina class="tela-convite" :titulo="tituloDaTela" :resumo="resumoDaTela">
    <div class="convite-tela">
      <!--
      Pelo link do e-mail: o convite numa linha, como os da Equipe. A empresa e quem convidou à
      esquerda; recusar e aceitar à direita, os dois com contorno ou fundo à vista.
    -->
      <ul v-if="estado === 'link'" class="ui-lista ui-folha" aria-live="polite">
        <li class="ui-linha convite-linha">
          <template v-if="previa === undefined">
            <Skeleton width="2.75rem" height="2.75rem" border-radius="12px" aria-hidden="true" />
            <span class="ui-linha__texto" aria-hidden="true">
              <Skeleton width="14rem" height="1rem" border-radius="6px" />
              <Skeleton width="20rem" height="0.85rem" border-radius="6px" />
            </span>
          </template>

          <template v-else-if="previa">
            <img
              v-if="previa.parceiro.logoUrl"
              class="convite-linha__logo"
              :src="previa.parceiro.logoUrl"
              alt=""
            />
            <span v-else class="convite-linha__logo convite-linha__logo--sem" aria-hidden="true">
              <i class="ph ph-buildings" />
            </span>

            <span class="ui-linha__texto">
              <span class="ui-linha__titulo convite-linha__empresa">{{
                previa.parceiro.nome
              }}</span>
              <span class="ui-linha__meta">
                {{ deQuem(previa) }}
                ·
                {{ t('parceiro.convite.caixa.validoAte', { data: formatarData(previa.expiraEm) }) }}
              </span>
            </span>
          </template>

          <template v-else>
            <span class="convite-linha__logo convite-linha__logo--sem" aria-hidden="true">
              <i class="ph ph-envelope-open" />
            </span>
            <span class="ui-linha__texto">
              <span class="ui-linha__meta convite-linha__sem-previa">
                {{ t('parceiro.convite.link.semPrevia') }}
              </span>
            </span>
          </template>

          <span class="ui-linha__fim convite-linha__acoes">
            <Button
              type="button"
              :label="t('parceiro.convite.link.recusar')"
              severity="secondary"
              outlined
              :loading="trabalhando === 'recusar'"
              :disabled="previa === undefined || trabalhando !== null"
              @click="decidirPeloLink(false)"
            />
            <Button
              type="button"
              icon="ph ph-check"
              :label="t('parceiro.convite.link.aceitar')"
              :loading="trabalhando === 'aceitar'"
              :disabled="previa === undefined || trabalhando !== null"
              @click="decidirPeloLink(true)"
            />
          </span>
        </li>
      </ul>

      <!--
      Depois de recusar (ou de descobrir que já está na equipe): o convite continua na tela, na
      mesma linha da prévia, com o selo do que aconteceu; embaixo, o próximo passo. Conta sem
      empresa ganha o caminho de cadastrar a sua; quem tem empresa volta ao portal.
    -->
      <div v-else-if="estado === 'jaMembro' || estado === 'recusado'" class="desfecho">
        <ul v-if="previa" class="ui-lista ui-folha">
          <li class="ui-linha convite-linha">
            <img
              v-if="previa.parceiro.logoUrl"
              class="convite-linha__logo"
              :src="previa.parceiro.logoUrl"
              alt=""
            />
            <span v-else class="convite-linha__logo convite-linha__logo--sem" aria-hidden="true">
              <i class="ph ph-buildings" />
            </span>

            <span class="ui-linha__texto">
              <span class="ui-linha__titulo convite-linha__empresa">{{
                previa.parceiro.nome
              }}</span>
              <span class="ui-linha__meta">{{ deQuem(previa) }}</span>
            </span>

            <span class="ui-linha__fim">
              <span v-if="estado === 'recusado'" class="ui-selo">
                <i class="ph ph-x-circle" aria-hidden="true" />
                {{ t('parceiro.convite.recusado.selo') }}
              </span>
              <span v-else class="ui-selo ui-selo--ok">
                <i class="ph ph-check-circle" aria-hidden="true" />
                {{ t('parceiro.convite.jaNaEquipe') }}
              </span>
            </span>
          </li>
        </ul>

        <p v-if="estado === 'recusado' && semEmpresa" class="desfecho__nota">
          {{ t('parceiro.convite.recusado.semEmpresa') }}
        </p>

        <div class="desfecho__acoes">
          <RouterLink
            v-if="estado === 'recusado' && semEmpresa"
            class="p-button p-component"
            to="/settings?aba=empresa"
          >
            <i class="ph ph-buildings" aria-hidden="true" />
            {{ t('frame.noAccess.ctaPrograms') }}
          </RouterLink>
          <RouterLink
            class="p-button p-component"
            :class="{ 'p-button-secondary p-button-outlined': estado === 'recusado' && semEmpresa }"
            :to="getDefaultLandingPath()"
          >
            <i class="ph ph-house" aria-hidden="true" />
            {{ t('parceiro.convite.irParaPortal') }}
          </RouterLink>
        </div>
      </div>

      <!-- Os convites desta conta: a caixa (sem link) ou, depois de recusar, os que ainda esperam. -->
      <section
        v-if="mostrarLista"
        class="caixa"
        :aria-labelledby="outrosConvites ? 'convite-outros' : undefined"
      >
        <h2 v-if="outrosConvites" id="convite-outros" class="caixa__subtitulo">
          {{ t('parceiro.convite.outros') }}
          <span class="ui-num caixa__conta">{{ outrosConvites.length }}</span>
        </h2>

        <p v-if="avisoDoLink && estado === 'caixa'" class="caixa__aviso" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>
            <strong>{{ t('parceiro.convite.naoVale') }}</strong>
            {{ avisoDoLink }}
          </span>
        </p>

        <ul v-if="!convites && !erroDaCaixa" class="ui-lista ui-folha" aria-hidden="true">
          <li v-for="n in 2" :key="n" class="ui-linha">
            <Skeleton width="2.75rem" height="2.75rem" border-radius="12px" />
            <span class="ui-linha__texto">
              <Skeleton width="12rem" height="0.95rem" border-radius="6px" />
              <Skeleton width="18rem" height="0.8rem" border-radius="6px" />
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

        <ul v-else-if="convites" class="ui-lista ui-folha">
          <li v-if="!convites.length" class="ui-linha">
            <span class="convite-linha__logo convite-linha__logo--sem" aria-hidden="true">
              <i class="ph ph-tray" />
            </span>
            <span class="ui-linha__texto">
              <span class="ui-linha__titulo">{{ t('parceiro.convite.caixa.vazio') }}</span>
            </span>
          </li>

          <li v-for="convite in convites" :key="convite.conviteId" class="ui-linha convite-linha">
            <img
              v-if="convite.parceiro.logoUrl"
              class="convite-linha__logo"
              :src="convite.parceiro.logoUrl"
              alt=""
            />
            <span v-else class="convite-linha__logo convite-linha__logo--sem" aria-hidden="true">
              <i class="ph ph-buildings" />
            </span>

            <span class="ui-linha__texto">
              <span class="ui-linha__titulo">{{ convite.parceiro.nome }}</span>
              <span class="ui-linha__meta">
                {{ deQuem(convite) }}
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

            <span v-if="convite.aceitaPor === 'CAIXA'" class="ui-linha__fim convite-linha__acoes">
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
      </section>
    </div>
  </UiPagina>
</template>

<style scoped>
.convite-tela {
  display: grid;
  gap: 28px;
}

.convite-linha {
  flex-wrap: wrap;
  row-gap: 12px;
}

.desfecho {
  display: grid;
  gap: 16px;
}

.desfecho__nota {
  max-width: 72ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.5;
}

.desfecho__acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.desfecho__acoes .p-button {
  gap: 8px;
  text-decoration: none;
}

.caixa__subtitulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.caixa__conta {
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 500;
}

.convite-linha__logo {
  flex: none;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 12px;
  object-fit: cover;
}

.convite-linha__logo--sem {
  display: grid;
  place-items: center;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-size: 20px;
}

.convite-linha__empresa {
  font-size: 16px;
}

.convite-linha__sem-previa {
  max-width: 60ch;
  color: var(--tinta);
}

.convite-linha__acoes {
  gap: 8px;
  margin-inline-start: auto;
}

.caixa {
  display: grid;
  gap: 14px;
}

.caixa__aviso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 72ch;
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
  color: var(--tinta);
  font-size: 14px;
}

.caixa__erro > i {
  color: var(--risco-tinta);
  font-size: 18px;
}

.caixa__dica {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
