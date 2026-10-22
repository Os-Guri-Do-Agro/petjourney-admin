<script setup lang="ts">
/**
 * A equipe pela lista (E0-01): uma pessoa por linha, com o papel em selo, e os convites que ainda
 * não foram aceitos logo abaixo. Nada de digitar ID: trocar papel, remover e sair saem do menu da
 * própria linha; convidar abre a gaveta ao lado. As funções na clínica e no hotel (E1-03) aparecem
 * na linha e o dono as define pelo mesmo menu.
 *
 * Quem é OPERADOR vê nomes e papéis (a API não manda o e-mail para ele) e só pode sair. As regras
 * (último dono, limite de convites, link expirado) são da API; aqui se decide a reação pelo
 * `codigo` e se mostra a `message`, que já chega no idioma da sessão.
 */
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import type { MenuItem } from 'primevue/menuitem'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import EquipeConviteGaveta from '@/components/parceiro/EquipeConviteGaveta.vue'
import EquipeFuncoesGaveta from '@/components/parceiro/EquipeFuncoesGaveta.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import { getAuthUser } from '@/service/auth/auth-session'
import type {
  ConvitePendenteDto,
  EquipeParceiroDto,
  MembroEquipeDto,
} from '@/service/contrato/openapi'
import {
  cancelarConvite,
  convidarParaEquipe,
  definirFuncoesDoMembro,
  listarEquipe,
  reenviarConvite,
  removerDaEquipe,
  sairDaEquipe,
  trocarPapelDoMembro,
  type PapelOperacional,
} from '@/service/parceiro/equipe-service'
import type { PapelParceiro } from '@/service/parceiro/types'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

const gavetaAberta = defineModel<boolean>('convidar', { default: false })

const { t, locale } = useI18n()
const toast = useToast()
const router = useRouter()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()

const equipe = ref<EquipeParceiroDto | null>(null)
const carregando = ref(true)
const erroAoCarregar = ref('')
/** Linhas com ação em andamento: o botão delas mostra que está trabalhando. */
const ocupadas = ref(new Set<string>())
const enviando = ref(false)
const erroDoEnvio = ref<Error | null>(null)

const meuId = computed(() => getAuthUser()?.userId ?? null)
const souDono = computed(() => store.isDono && store.podeOperar)

const SELO_DO_PAPEL: Record<PapelParceiro, { classe: string; icone: string }> = {
  DONO: { classe: 'ui-selo--lugar', icone: 'ph ph-crown-simple' },
  OPERADOR: { classe: '', icone: 'ph ph-user' },
}

/* ------------------------------------------------------------------------- leitura */

async function carregar() {
  erroAoCarregar.value = ''

  try {
    equipe.value = await listarEquipe(parceiroQuery())
  } catch (err) {
    erroAoCarregar.value = err instanceof Error ? err.message : t('parceiro.equipe.erroCarregar')
  } finally {
    carregando.value = false
  }
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)

  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}

/* ------------------------------------------------------------------------- reações */

/** Códigos em que a lista na tela ficou velha: alguém mexeu antes. */
const CODIGOS_DE_LISTA_VELHA = new Set([
  'EQUIPE_MEMBRO_NAO_ENCONTRADO',
  'CONVITE_NAO_ENCONTRADO',
  'EQUIPE_APENAS_DONO',
])

function avisarErro(err: unknown) {
  toast.add({
    severity: 'error',
    summary: t('parceiro.equipe.toast.erro'),
    detail: err instanceof Error ? err.message : undefined,
    life: 6000,
  })

  if (err instanceof ApiError && err.codigo && CODIGOS_DE_LISTA_VELHA.has(err.codigo)) {
    /* O papel de quem está logado pode ter mudado: o contexto volta junto. */
    if (err.codigo === 'EQUIPE_APENAS_DONO') {
      void ensureContext(true)
    }

    void carregar()
  }
}

async function comLinhaOcupada(id: string, acao: () => Promise<void>) {
  ocupadas.value = new Set(ocupadas.value).add(id)

  try {
    await acao()
  } catch (err) {
    avisarErro(err)
  } finally {
    const resto = new Set(ocupadas.value)
    resto.delete(id)
    ocupadas.value = resto
  }
}

/* ------------------------------------------------------------------------- convite */

async function enviarConvite(payload: { email: string; papel: PapelParceiro }) {
  enviando.value = true
  erroDoEnvio.value = null

  try {
    await convidarParaEquipe(payload, parceiroQuery())
    gavetaAberta.value = false
    toast.add({
      severity: 'success',
      summary: t('parceiro.equipe.toast.convidado'),
      detail: t('parceiro.equipe.toast.convidadoDetalhe', { email: payload.email }),
      life: 4000,
    })
    await carregar()
  } catch (err) {
    erroDoEnvio.value = err instanceof Error ? err : new Error(String(err))
  } finally {
    enviando.value = false
  }
}

/** `CONVITE_JA_PENDENTE`: o convite para o endereço já existe; reenviar é o que a pessoa queria. */
async function reenviarPendente(email: string) {
  const alvo = equipe.value?.convites.find(
    (convite) => convite.email?.toLowerCase() === email.toLowerCase(),
  )

  if (!alvo) {
    await carregar()
    gavetaAberta.value = false
    return
  }

  enviando.value = true

  try {
    await reenviarConvite(alvo.id, parceiroQuery())
    gavetaAberta.value = false
    erroDoEnvio.value = null
    toast.add({
      severity: 'success',
      summary: t('parceiro.equipe.toast.reenviado'),
      detail: t('parceiro.equipe.toast.reenviadoDetalhe'),
      life: 4000,
    })
    await carregar()
  } catch (err) {
    erroDoEnvio.value = err instanceof Error ? err : new Error(String(err))
  } finally {
    enviando.value = false
  }
}

function reenviar(convite: ConvitePendenteDto) {
  void comLinhaOcupada(convite.id, async () => {
    await reenviarConvite(convite.id, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('parceiro.equipe.toast.reenviado'),
      detail: t('parceiro.equipe.toast.reenviadoDetalhe'),
      life: 4000,
    })
    await carregar()
  })
}

/* ------------------------------------------------------------------------- confirmações */

type Confirmacao =
  | { tipo: 'remover' | 'dono' | 'operador'; membro: MembroEquipeDto }
  | { tipo: 'sair' }
  | { tipo: 'cancelarConvite'; convite: ConvitePendenteDto }

const confirmacao = ref<Confirmacao | null>(null)
const confirmacaoVisivel = ref(false)

function pedirConfirmacao(pedido: Confirmacao) {
  confirmacao.value = pedido
  confirmacaoVisivel.value = true
}

const textoDaConfirmacao = computed(() => {
  const pedido = confirmacao.value

  if (!pedido) {
    return { titulo: '', mensagem: '', botao: '', tom: 'danger' as const }
  }

  const base = `parceiro.equipe.confirmar.${pedido.tipo}`
  const valores =
    pedido.tipo === 'cancelarConvite'
      ? { email: pedido.convite.email ?? '' }
      : pedido.tipo === 'sair'
        ? {}
        : { nome: pedido.membro.nome }

  return {
    titulo: t(`${base}.titulo`, valores),
    mensagem: t(`${base}.mensagem`, valores),
    botao: t(`${base}.botao`),
    tom:
      pedido.tipo === 'dono' || pedido.tipo === 'operador'
        ? ('warn' as const)
        : ('danger' as const),
  }
})

function confirmar() {
  const pedido = confirmacao.value

  if (!pedido) {
    return
  }

  if (pedido.tipo === 'sair') {
    void comLinhaOcupada(meuId.value ?? 'eu', async () => {
      await sairDaEquipe(parceiroQuery())
      toast.add({ severity: 'success', summary: t('parceiro.equipe.toast.saiu'), life: 4000 })
      await store.bootstrap(true).catch(() => undefined)
      await router.replace(getDefaultLandingPath())
    })
    return
  }

  if (pedido.tipo === 'cancelarConvite') {
    void comLinhaOcupada(pedido.convite.id, async () => {
      await cancelarConvite(pedido.convite.id, parceiroQuery())
      toast.add({ severity: 'success', summary: t('parceiro.equipe.toast.cancelado'), life: 3000 })
      await carregar()
    })
    return
  }

  const { membro } = pedido

  if (pedido.tipo === 'remover') {
    void comLinhaOcupada(membro.usuarioId, async () => {
      await removerDaEquipe(membro.usuarioId, parceiroQuery())
      toast.add({ severity: 'success', summary: t('parceiro.equipe.toast.removido'), life: 3000 })
      await carregar()
    })
    return
  }

  const papel: PapelParceiro = pedido.tipo === 'dono' ? 'DONO' : 'OPERADOR'

  void comLinhaOcupada(membro.usuarioId, async () => {
    await trocarPapelDoMembro(membro.usuarioId, papel, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('parceiro.equipe.toast.papelTrocado'),
      detail: t('parceiro.equipe.toast.papelTrocadoDetalhe', {
        nome: membro.nome,
        papel: t(`parceiro.equipe.papel.${papel}`).toLowerCase(),
      }),
      life: 4000,
    })
    await carregar()
  })
}

/* ------------------------------------------------------------------------- funções */

const membroDasFuncoes = ref<MembroEquipeDto | null>(null)
const funcoesAbertas = ref(false)
const salvandoFuncoes = ref(false)
const erroDasFuncoes = ref<Error | null>(null)

function abrirFuncoes(membro: MembroEquipeDto) {
  membroDasFuncoes.value = membro
  erroDasFuncoes.value = null
  funcoesAbertas.value = true
}

function nomesDasFuncoes(papeis: PapelOperacional[]) {
  return papeis.map((papel) => t(`parceiro.equipe.funcao.${papel}`)).join(', ')
}

async function salvarFuncoes(papeis: PapelOperacional[]) {
  const membro = membroDasFuncoes.value

  if (!membro) {
    return
  }

  salvandoFuncoes.value = true
  erroDasFuncoes.value = null

  try {
    await definirFuncoesDoMembro(membro.usuarioId, papeis, parceiroQuery())
    funcoesAbertas.value = false
    toast.add({
      severity: 'success',
      summary: t('parceiro.equipe.toast.funcoesSalvas'),
      detail: t('parceiro.equipe.toast.funcoesSalvasDetalhe', { nome: membro.nome }),
      life: 4000,
    })
    await carregar()

    /* As funções de quem está logado mudam o menu dele: o /eu volta junto. */
    if (membro.usuarioId === meuId.value) {
      await ensureContext(true)
    }
  } catch (err) {
    erroDasFuncoes.value = err instanceof Error ? err : new Error(String(err))
  } finally {
    salvandoFuncoes.value = false
  }
}

/* ------------------------------------------------------------------------- menu da linha */

const menu = ref<InstanceType<typeof Menu> | null>(null)
const membroDoMenu = ref<MembroEquipeDto | null>(null)

function acoesDe(membro: MembroEquipeDto): MenuItem[] {
  const funcoes: MenuItem[] = souDono.value
    ? [
        {
          label: t('parceiro.equipe.definirFuncoes'),
          icon: 'ph ph-identification-badge',
          command: () => abrirFuncoes(membro),
        },
      ]
    : []

  if (membro.usuarioId === meuId.value) {
    return [
      ...funcoes,
      ...(funcoes.length ? [{ separator: true }] : []),
      {
        label: t('parceiro.equipe.sair'),
        icon: 'ph ph-sign-out',
        class: 'menu-item--risco',
        command: () => pedirConfirmacao({ tipo: 'sair' }),
      },
    ]
  }

  if (!souDono.value) {
    return []
  }

  return [
    ...funcoes,
    membro.papel === 'OPERADOR'
      ? {
          label: t('parceiro.equipe.tornarDono'),
          icon: 'ph ph-crown-simple',
          command: () => pedirConfirmacao({ tipo: 'dono', membro }),
        }
      : {
          label: t('parceiro.equipe.tornarOperador'),
          icon: 'ph ph-user',
          command: () => pedirConfirmacao({ tipo: 'operador', membro }),
        },
    { separator: true },
    {
      label: t('parceiro.equipe.remover'),
      icon: 'ph ph-user-minus',
      class: 'menu-item--risco',
      command: () => pedirConfirmacao({ tipo: 'remover', membro }),
    },
  ]
}

const itensDoMenu = computed(() => (membroDoMenu.value ? acoesDe(membroDoMenu.value) : []))

function abrirMenu(evento: Event, membro: MembroEquipeDto) {
  membroDoMenu.value = membro
  menu.value?.toggle(evento)
}

onMounted(async () => {
  await ensureContext()
  await carregar()
})
</script>

<template>
  <div class="equipe">
    <section class="equipe__bloco" aria-labelledby="equipe-pessoas">
      <h2 id="equipe-pessoas" class="equipe__subtitulo">
        {{ t('parceiro.equipe.pessoas') }}
        <span v-if="equipe" class="ui-num equipe__conta">{{ equipe.membros.length }}</span>
      </h2>

      <ul v-if="carregando" class="ui-lista ui-folha" aria-hidden="true">
        <li v-for="n in 3" :key="n" class="ui-linha">
          <Skeleton shape="circle" size="2.5rem" />
          <span class="ui-linha__texto">
            <Skeleton width="10rem" height="0.9rem" border-radius="6px" />
            <Skeleton width="14rem" height="0.8rem" border-radius="6px" />
          </span>
        </li>
      </ul>

      <div v-else-if="erroAoCarregar" class="equipe__erro ui-folha" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ erroAoCarregar }}</span>
        <Button
          type="button"
          icon="ph ph-arrow-clockwise"
          :label="t('common.retry')"
          severity="secondary"
          outlined
          size="small"
          @click="carregar"
        />
      </div>

      <ul v-else-if="equipe" class="ui-lista ui-folha">
        <li v-for="membro in equipe.membros" :key="membro.usuarioId" class="ui-linha pessoa">
          <span class="pessoa__avatar" aria-hidden="true">{{ iniciais(membro.nome) }}</span>

          <span class="ui-linha__texto">
            <span class="ui-linha__titulo pessoa__nome">
              {{ membro.nome }}
              <span v-if="membro.usuarioId === meuId" class="ui-selo ui-selo--contorno">
                {{ t('parceiro.equipe.voce') }}
              </span>
            </span>
            <span class="ui-linha__meta">
              <bdi v-if="membro.email" dir="ltr">{{ membro.email }}</bdi>
              <span v-if="membro.email" aria-hidden="true"> · </span>
              {{ t('parceiro.equipe.desde', { data: formatarData(membro.desde) }) }}
              <template v-if="membro.convidadoPor">
                · {{ t('parceiro.equipe.convidadoPor', { nome: membro.convidadoPor }) }}
              </template>
            </span>
            <span v-if="membro.papeisOperacionais.length" class="ui-linha__meta pessoa__funcoes">
              <i class="ph ph-identification-badge" aria-hidden="true" />
              {{ nomesDasFuncoes(membro.papeisOperacionais) }}
            </span>
          </span>

          <span class="ui-linha__fim">
            <span class="ui-selo" :class="SELO_DO_PAPEL[membro.papel].classe">
              <i :class="SELO_DO_PAPEL[membro.papel].icone" aria-hidden="true" />
              {{ t(`parceiro.equipe.papel.${membro.papel}`) }}
            </span>
            <Button
              v-if="acoesDe(membro).length"
              type="button"
              icon="ph ph-dots-three"
              severity="secondary"
              outlined
              size="small"
              :loading="ocupadas.has(membro.usuarioId)"
              :aria-label="t('parceiro.equipe.maisAcoes', { nome: membro.nome })"
              :title="t('parceiro.equipe.maisAcoes', { nome: membro.nome })"
              aria-haspopup="true"
              @click="abrirMenu($event, membro)"
            />
            <span v-else class="pessoa__sem-acao" aria-hidden="true" />
          </span>
        </li>
      </ul>
    </section>

    <section
      v-if="equipe && equipe.convites.length && souDono"
      class="equipe__bloco"
      aria-labelledby="equipe-convites"
    >
      <h2 id="equipe-convites" class="equipe__subtitulo">
        {{ t('parceiro.equipe.convites.titulo') }}
        <span class="ui-num equipe__conta">{{ equipe.convites.length }}</span>
      </h2>

      <ul class="ui-lista ui-folha">
        <li v-for="convite in equipe.convites" :key="convite.id" class="ui-linha pessoa">
          <span class="pessoa__avatar pessoa__avatar--convite" aria-hidden="true">
            <i class="ph ph-envelope-simple" />
          </span>

          <span class="ui-linha__texto">
            <bdi class="ui-linha__titulo" dir="ltr">{{ convite.email }}</bdi>
            <span class="ui-linha__meta">
              {{ t(`parceiro.equipe.papel.${convite.papel}`) }}
              ·
              <template v-if="convite.expiraEm">
                {{
                  t('parceiro.equipe.convites.validoAte', { data: formatarData(convite.expiraEm) })
                }}
              </template>
              <template v-else>{{ t('parceiro.equipe.convites.antigo') }}</template>
              ·
              {{
                t('parceiro.equipe.convites.enviadoEm', { data: formatarData(convite.criadoEm) })
              }}
            </span>
          </span>

          <span class="ui-linha__fim convite__acoes">
            <Button
              type="button"
              icon="ph ph-paper-plane-tilt"
              :label="t('parceiro.equipe.convites.reenviar')"
              severity="secondary"
              outlined
              size="small"
              :loading="ocupadas.has(convite.id)"
              @click="reenviar(convite)"
            />
            <Button
              type="button"
              icon="ph ph-x"
              :label="t('parceiro.equipe.convites.cancelar')"
              severity="danger"
              outlined
              size="small"
              :disabled="ocupadas.has(convite.id)"
              @click="pedirConfirmacao({ tipo: 'cancelarConvite', convite })"
            />
          </span>
        </li>
      </ul>
    </section>

    <p v-if="equipe && !store.isDono" class="equipe__nota">
      <i class="ph ph-lock-simple" aria-hidden="true" />
      {{ t('parceiro.equipe.soDono') }}
    </p>

    <Menu ref="menu" :model="itensDoMenu" popup />

    <EquipeFuncoesGaveta
      v-model:visible="funcoesAbertas"
      :nome="membroDasFuncoes?.nome ?? ''"
      :atuais="membroDasFuncoes?.papeisOperacionais ?? []"
      :salvando="salvandoFuncoes"
      :erro="erroDasFuncoes"
      @salvar="salvarFuncoes"
    />

    <EquipeConviteGaveta
      v-model:visible="gavetaAberta"
      :enviando="enviando"
      :erro="erroDoEnvio"
      @enviar="enviarConvite"
      @reenviar-pendente="reenviarPendente"
    />

    <ConfirmActionDialog
      v-model:visible="confirmacaoVisivel"
      :title="textoDaConfirmacao.titulo"
      :message="textoDaConfirmacao.mensagem"
      :confirm-label="textoDaConfirmacao.botao"
      :cancel-label="t('parceiro.equipe.confirmar.voltar')"
      :severity="textoDaConfirmacao.tom"
      @confirm="confirmar"
    />
  </div>
</template>

<style scoped>
.equipe {
  display: grid;
  gap: 28px;
}

.equipe__bloco {
  display: grid;
  gap: 12px;
}

.equipe__subtitulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.equipe__conta {
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 500;
}

.pessoa__avatar {
  display: grid;
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 999px;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-size: 14px;
  font-weight: 650;
  letter-spacing: 0.02em;
}

.pessoa__avatar--convite {
  background: transparent;
  border: 1px dashed var(--linha-forte);
  color: var(--tinta-2);
  font-size: 18px;
}

.pessoa__funcoes {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.pessoa__nome {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* Linha sem menu guarda o lugar do botão: os selos de papel ficam alinhados na coluna. */
.pessoa__sem-acao {
  width: 2.25rem;
}

.convite__acoes {
  gap: 8px;
}

.equipe__erro {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  color: var(--tinta);
  font-size: 14px;
}

.equipe__erro > i {
  color: var(--risco-tinta);
  font-size: 18px;
}

.equipe__nota {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.equipe__nota i {
  color: var(--tinta-3);
  font-size: 16px;
}

@media (max-width: 40rem) {
  .convite__acoes {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}
</style>
