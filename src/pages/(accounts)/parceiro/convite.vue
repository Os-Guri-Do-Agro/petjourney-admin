<script setup lang="ts">
/**
 * O convite para a equipe (E0-01), em dois caminhos.
 *
 * Com o link do e-mail: a guarda do roteador já tirou o `token` da URL e o guardou
 * (`convite-pendente.ts`). A tela pede a prévia (PJ-4BI7TE) para dizer de que empresa é o
 * convite, quem convidou, com que papel e até quando vale; depois aceita ou recusa e esquece o
 * token. Qualquer conta logada aceita: o token prova que a pessoa abriu o e-mail convidado.
 *
 * A prévia também diz quem está conectado (`contaConectada`, PJ-VK5P13). Conta que já é da equipe
 * e abriu um convite que foi para outro e-mail (o dono testando no próprio navegador) vê "Este
 * convite é para outra conta" e entra com a conta certa sem perder o token: o logout não apaga o
 * `sessionStorage` do convite, e o login volta para cá quando há um guardado. Conta que já é da
 * equipe e abriu o próprio convite vê "Você já faz parte", e o "Ir para o portal" fecha o convite.
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
import { useLogout } from '@/composables/useLogout'
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

type Estado = 'link' | 'caixa' | 'recusado' | 'jaMembro' | 'contaErrada'

const { t, locale } = useI18n()
const toast = useToast()
const router = useRouter()
const store = useParceiroStore()
const { logout } = useLogout()

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

  if (estado.value === 'contaErrada') {
    return t('parceiro.convite.contaErrada.titulo')
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
      jaMembro: previa.value
        ? t('parceiro.convite.jaMembroCorpoComEmpresa', { empresa: previa.value.parceiro.nome })
        : t('parceiro.convite.jaMembroCorpo'),
      /* Sem prévia (ela falhou e o aceite deu 409), a tela não sabe o nome da empresa. */
      contaErrada: previa.value
        ? t('parceiro.convite.contaErrada.corpo', { empresa: previa.value.parceiro.nome })
        : t('parceiro.convite.contaErrada.corpoSemEmpresa'),
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

/** Com o link (antes e depois de decidir), o convite é o bilhete na faixa; sem ele, a caixa. */
const comBilhete = computed(() => estado.value !== 'caixa')

const ICONE_DO_PAPEL: Record<PreviaConviteDto['papel'], string> = {
  OPERADOR: 'ph ph-user',
  DONO: 'ph ph-crown-simple',
}

/** "Aurora Clínica e Hotel" vira "AC": as duas primeiras palavras de verdade, sem "e", "da", "de". */
function iniciaisDe(nome: string) {
  return nome
    .split(/\s+/)
    .filter((palavra) => palavra.length > 2 || /^\p{Lu}/u.test(palavra))
    .slice(0, 2)
    .map((palavra) => palavra[0]?.toLocaleUpperCase())
    .join('')
}

/** As letras do selo quando a empresa não tem logo. */
const iniciais = computed(() => iniciaisDe(previa.value?.parceiro.nome ?? ''))

/**
 * O carimbo só bate quando a pessoa acabou de recusar: é o movimento que diz o que mudou. Quem
 * abre a tela já sabendo (já está na equipe) vê o carimbo parado.
 */
const carimbouAgora = ref(false)

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    day: 'numeric',
    month: 'long',
  })
}

/**
 * "Helena Prado convidou você como operador." ou, sem o nome de quem convidou, só o papel. Na conta
 * errada também só o papel: o convite não é para quem está vendo, e "convidou você" contradiria o
 * título.
 */
function deQuem(convite: Pick<MeuConviteDto, 'convidadoPorNome' | 'papel'>) {
  const papel = t(`parceiro.equipe.papel.${convite.papel}`).toLowerCase()

  return convite.convidadoPorNome && estado.value !== 'contaErrada'
    ? t('parceiro.convite.caixa.deQuem', { nome: convite.convidadoPorNome, papel })
    : t('parceiro.convite.caixa.semNome', { papel })
}

/**
 * O aviso diz o que aconteceu: entrou agora na equipe da empresa, ou já estava nela e o convite só
 * foi fechado (`jaEraMembro`). `empresa` vem da prévia ou da linha da caixa; sem ela, a frase
 * genérica.
 */
async function entrarNaEquipe(aceito: ConviteAceitoDto, empresa?: string) {
  store.setParceiroId(aceito.parceiroId)

  if (aceito.jaEraMembro) {
    toast.add({
      severity: 'success',
      summary: t('parceiro.convite.jaNaEquipe'),
      detail: t('parceiro.convite.jaEraMembroDetalhe'),
      life: 4000,
    })
  } else {
    toast.add({
      severity: 'success',
      summary: t('parceiro.convite.aceito'),
      detail: empresa
        ? t('parceiro.convite.aceitoDetalheComEmpresa', { empresa })
        : t('parceiro.convite.aceitoDetalhe'),
      life: 4000,
    })
  }

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

    /*
     * Conta que já é da equipe: o convite foi para o e-mail dela (fecha ao seguir para o portal) ou
     * para outro (troca de conta, sem o botão de aceitar). `paraEstaConta` só vem quando `jaFazParte`.
     */
    const conta = previa.value.contaConectada

    if (conta?.jaFazParte) {
      estado.value = conta.paraEstaConta ? 'jaMembro' : 'contaErrada'
    }
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
      await entrarNaEquipe(aceito, previa.value?.parceiro.nome)
      return
    }

    await recusarConvitePorLink(valor)
    esquecerTokenDoConvite()
    carimbouAgora.value = true
    estado.value = 'recusado'
    void carregarCaixa()
  } catch (err) {
    if (linkSemValor(err)) {
      return
    }

    /*
     * Conta da equipe com um convite que foi para outro e-mail. Acontece quando a prévia falhou e
     * a tela não sabia. O convite continua valendo para quem foi convidado: o token fica.
     */
    if (err instanceof ApiError && err.codigo === 'CONVITE_CONTA_JA_NA_EQUIPE') {
      estado.value = 'contaErrada'
      return
    }

    avisarErro(err)
  } finally {
    trabalhando.value = null
  }
}

/**
 * "Entrar com outra conta": sai da sessão sem esquecer o token. O logout só apaga a sessão, e o
 * login, achando um convite guardado, volta para esta tela com a conta nova.
 */
async function trocarDeConta() {
  if (trabalhando.value) {
    return
  }

  trabalhando.value = 'trocar'

  try {
    await logout()
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
      await entrarNaEquipe(await aceitarConviteDaCaixa(convite.conviteId), convite.parceiro.nome)
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
    <!--
      O convite pelo link é um bilhete na faixa. À esquerda, a face: o selo da empresa, o nome dela,
      quem convidou e o que o papel deixa fazer, em branco direto na sálvia. À direita, o canhoto de
      papel, picotado do lado da face, com a resposta: até quando vale, aceitar e recusar. Depois de
      decidir, a face fica como estava e o canhoto troca a resposta pelo carimbo do que aconteceu e
      pelo próximo passo.
    -->
    <template v-if="comBilhete" #destaque>
      <div class="bilhete">
        <section class="bilhete__face" aria-labelledby="convite-titulo">
          <Skeleton
            v-if="previa === undefined"
            class="selo-esqueleto"
            width="5.75rem"
            height="6.5rem"
            border-radius="10px"
            aria-hidden="true"
          />
          <span v-else class="selo" aria-hidden="true">
            <span class="selo__miolo">
              <img v-if="previa?.parceiro.logoUrl" :src="previa.parceiro.logoUrl" alt="" />
              <i v-else-if="!previa || !iniciais" class="ph ph-envelope-open" />
              <template v-else>{{ iniciais }}</template>
            </span>
          </span>

          <div class="bilhete__textos">
            <h1 id="convite-titulo" class="bilhete__sobre">
              <i class="ph ph-envelope-simple" aria-hidden="true" />
              {{ tituloDaTela }}
            </h1>

            <template v-if="previa === undefined">
              <Skeleton width="min(26rem, 100%)" height="2.1rem" border-radius="8px" />
              <Skeleton width="min(18rem, 100%)" height="1rem" border-radius="6px" />
            </template>

            <template v-else>
              <p class="bilhete__empresa">
                {{ previa?.parceiro.nome ?? t('parceiro.convite.link.empresaSemNome') }}
              </p>
              <!-- O convite vem de alguém: as iniciais de quem convidou, como na lista da Equipe. -->
              <p v-if="previa" class="bilhete__quem">
                <span
                  v-if="previa.convidadoPorNome && estado !== 'contaErrada'"
                  class="bilhete__rosto"
                  aria-hidden="true"
                  >{{ iniciaisDe(previa.convidadoPorNome) }}</span
                >
                {{ deQuem(previa) }}
              </p>
              <p v-else-if="estado === 'link'" class="bilhete__quem bilhete__sem-previa">
                {{ t('parceiro.convite.link.semPrevia') }}
              </p>

              <p v-if="previa" class="bilhete__papel">
                <i :class="ICONE_DO_PAPEL[previa.papel]" aria-hidden="true" />
                <span>{{ t(`parceiro.equipe.papelDica.${previa.papel}`) }}</span>
              </p>
            </template>
          </div>
        </section>

        <div class="canhoto" aria-live="polite">
          <template v-if="estado === 'link'">
            <p v-if="previa" class="canhoto__prazo">
              <i class="ph ph-hourglass-medium" aria-hidden="true" />
              {{ t('parceiro.convite.caixa.validoAte', { data: formatarData(previa.expiraEm) }) }}
            </p>
            <Skeleton
              v-else-if="previa === undefined"
              width="10rem"
              height="1rem"
              border-radius="6px"
              aria-hidden="true"
            />

            <div class="canhoto__acoes">
              <Button
                type="button"
                icon="ph ph-check"
                :label="t('parceiro.convite.link.aceitar')"
                :loading="trabalhando === 'aceitar'"
                :disabled="previa === undefined || trabalhando !== null"
                @click="decidirPeloLink(true)"
              />
              <Button
                type="button"
                :label="t('parceiro.convite.link.recusar')"
                severity="secondary"
                outlined
                :loading="trabalhando === 'recusar'"
                :disabled="previa === undefined || trabalhando !== null"
                @click="decidirPeloLink(false)"
              />
            </div>
          </template>

          <!--
            Depois de recusar, de descobrir que já está na equipe ou de abrir o convite com a conta
            errada: o carimbo do que aconteceu (a conta errada não ganha carimbo: o convite segue
            valendo para quem foi convidado), a frase e o próximo passo. Conta sem empresa ganha o
            caminho de cadastrar a sua; quem tem empresa volta ao portal; a conta errada troca de
            conta.
          -->
          <template v-else>
            <span
              v-if="estado === 'recusado'"
              class="carimbo carimbo--recusado"
              :class="{ 'carimbo--agora': carimbouAgora }"
            >
              <i class="ph ph-x-circle" aria-hidden="true" />
              {{ t('parceiro.convite.recusado.selo') }}
            </span>
            <span v-else-if="estado === 'jaMembro'" class="carimbo carimbo--ok">
              <i class="ph ph-check-circle" aria-hidden="true" />
              {{ t('parceiro.convite.jaNaEquipe') }}
            </span>

            <p class="canhoto__texto">{{ resumoDaTela }}</p>
            <p v-if="estado === 'recusado' && semEmpresa" class="canhoto__nota">
              {{ t('parceiro.convite.recusado.semEmpresa') }}
            </p>

            <div v-if="estado === 'contaErrada'" class="canhoto__acoes">
              <Button
                type="button"
                icon="ph ph-sign-in"
                :label="t('parceiro.convite.contaErrada.trocarConta')"
                :loading="trabalhando === 'trocar'"
                :disabled="trabalhando !== null"
                @click="trocarDeConta"
              />
              <RouterLink
                class="p-button p-component p-button-secondary p-button-outlined"
                :to="getDefaultLandingPath()"
              >
                <i class="ph ph-house" aria-hidden="true" />
                {{ t('parceiro.convite.irParaPortal') }}
              </RouterLink>
            </div>

            <!-- Já é da equipe e o convite foi para esta conta: seguir para o portal fecha o convite. -->
            <div v-else-if="estado === 'jaMembro' && token" class="canhoto__acoes">
              <Button
                type="button"
                icon="ph ph-house"
                :label="t('parceiro.convite.irParaPortal')"
                :loading="trabalhando === 'aceitar'"
                :disabled="trabalhando !== null"
                @click="decidirPeloLink(true)"
              />
            </div>

            <div v-else class="canhoto__acoes">
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
                :class="{
                  'p-button-secondary p-button-outlined': estado === 'recusado' && semEmpresa,
                }"
                :to="getDefaultLandingPath()"
              >
                <i class="ph ph-house" aria-hidden="true" />
                {{ t('parceiro.convite.irParaPortal') }}
              </RouterLink>
            </div>
          </template>
        </div>
      </div>
    </template>

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
  </UiPagina>
</template>

<style scoped>
/* ------------------------------------------------------------------------------ o bilhete */

/*
 * A faixa (cor, desenhos, cantos) é a do `UiPagina`; aqui só o miolo dela. A face ocupa o que
 * sobra e o canhoto tem largura de canhoto: os dois na altura do conteúdo, centrados um no outro.
 */
.bilhete {
  display: grid;
  align-items: center;
  gap: 24px 40px;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
}

/* Na sálvia o esqueleto é vidro: o cinza do tema virava uma mancha. */
.bilhete :deep(.p-skeleton) {
  background: var(--app-vidro);
}

.canhoto :deep(.p-skeleton) {
  background: var(--app-veu-forte);
}

.bilhete__face {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 26px;
}

/*
 * O selo: papel picotado em volta do logo (ou das iniciais), levemente torto, como selo de
 * envelope. O picote é a máscara: furos redondos ladrilhados na borda e o miolo cheio por cima.
 */
.selo {
  --furo: 4px;

  display: grid;
  flex: none;
  width: 92px;
  height: 104px;
  padding: calc(var(--furo) * 2.25);
  background: var(--app-cartao);
  transform: rotate(-4deg);
  mask:
    radial-gradient(var(--furo), #0000 98%, #000) round calc(var(--furo) * -1.5)
      calc(var(--furo) * -1.5) / calc(var(--furo) * 3) calc(var(--furo) * 3),
    linear-gradient(#000 0 0) no-repeat 50% / calc(100% - var(--furo) * 3)
      calc(100% - var(--furo) * 3);
}

.selo__miolo {
  display: grid;
  overflow: hidden;
  place-items: center;
  border-radius: 4px;
  background: var(--app-veu-forte);
  color: var(--app-salvia-texto);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.selo__miolo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.selo__miolo .ph {
  font-size: 34px;
}

.selo-esqueleto {
  flex: none;
}

.bilhete__textos {
  display: grid;
  min-width: 0;
  justify-items: start;
  gap: 6px;
}

/* O título da página, pequeno: o que se lê primeiro é a empresa. */
.bilhete__sobre {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}

.bilhete__sobre .ph {
  font-size: 17px;
}

.bilhete__empresa {
  margin: 0;
  color: #fff;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.6px;
  line-height: 1.15;
  text-wrap: balance;
}

.bilhete__quem {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 0 0;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.bilhete__sem-previa {
  max-width: 60ch;
  font-weight: 500;
}

/* As iniciais de quem convidou, em vidro, como o rosto da pessoa nas listas do app. */
.bilhete__rosto {
  display: grid;
  flex: none;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: var(--app-vidro);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* O que o papel deixa fazer, com o ícone do papel (o mesmo da Equipe). */
.bilhete__papel {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 78ch;
  margin: 0;
  color: #fff;
  font-size: 14.5px;
  font-weight: 500;
  line-height: 1.45;
}

.bilhete__papel .ph {
  display: grid;
  flex: none;
  width: 30px;
  font-size: 18px;
  place-items: center;
  line-height: 1.2;
}

/*
 * O canhoto: papel do cartão com o picote no lado da face. A máscara morde meio círculo a cada
 * 18 px na borda de dentro; o `round` acerta a conta para não sobrar furo cortado nas pontas.
 */
.canhoto {
  --furo: 6px;

  display: grid;
  align-content: center;
  gap: 14px;
  padding: 22px 24px 22px 32px;
  border-radius: 22px;
  background: var(--app-cartao);
  color: var(--app-tinta);
  mask: radial-gradient(circle var(--furo) at 0 50%, #0000 98%, #000) 0 0 / 100%
    calc(var(--furo) * 3) round;
}

[dir='rtl'] .canhoto {
  padding: 22px 32px 22px 24px;
  mask-position: 100% 0;
  mask-image: radial-gradient(circle var(--furo) at 100% 50%, #0000 98%, #000);
}

.canhoto__prazo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--app-tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.canhoto__prazo .ph {
  color: var(--app-salvia-texto);
  font-size: 18px;
}

.canhoto__acoes {
  display: grid;
  gap: 10px;
}

.canhoto__acoes .p-button {
  gap: 8px;
  width: 100%;
  min-height: 44px;
  text-decoration: none;
}

.canhoto__texto {
  margin: 0;
  color: var(--app-tinta);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.45;
}

.canhoto__nota {
  margin: 0;
  color: var(--app-texto-2);
  font-size: 14px;
  line-height: 1.5;
}

/*
 * O carimbo do que aconteceu: tinta da família em borda dupla, torto como carimbo de borracha.
 * Fundo pastel da família por baixo, para ler como estado e não só como enfeite.
 */
.carimbo {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 7px;
  padding: 5px 14px 5px 11px;
  border: 2px solid currentcolor;
  border-radius: 10px;
  outline: 1px solid currentcolor;
  outline-offset: 2px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  transform: rotate(-3deg);
}

.carimbo .ph {
  font-size: 18px;
}

.carimbo--recusado {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.carimbo--ok {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

/* Quem acabou de recusar vê o carimbo bater: chega um pouco maior e assenta. */
.carimbo--agora {
  animation: carimbar 180ms ease-out;
}

@keyframes carimbar {
  from {
    opacity: 0;
    transform: rotate(-3deg) scale(1.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .carimbo--agora {
    animation: none;
  }
}

/*
 * Faixa estreita (tablet em pé, barra aberta): o canhoto desce para baixo da face, na largura
 * dela, com o picote em cima e os botões lado a lado.
 */
@container faixa (max-width: 860px) {
  .bilhete {
    grid-template-columns: minmax(0, 1fr);
  }

  .canhoto {
    padding: 26px 22px 20px;
    mask: radial-gradient(circle var(--furo) at 50% 0, #0000 98%, #000) 0 0 / calc(var(--furo) * 3)
      100% round;
  }

  [dir='rtl'] .canhoto {
    padding: 26px 22px 20px;
    mask-position: 0 0;
    mask-image: radial-gradient(circle var(--furo) at 50% 0, #0000 98%, #000);
  }

  .canhoto__acoes {
    grid-auto-flow: column;
    justify-content: start;
  }

  .canhoto__acoes .p-button {
    width: auto;
  }
}

@container faixa (max-width: 560px) {
  .bilhete__face {
    align-items: flex-start;
    gap: 18px;
  }

  .selo {
    width: 72px;
    height: 82px;
  }

  .bilhete__empresa {
    font-size: 24px;
  }
}

/* ------------------------------------------------------------------------------ a caixa */

.convite-linha {
  flex-wrap: wrap;
  row-gap: 12px;
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
