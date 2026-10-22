<script setup lang="ts">
/**
 * Os profissionais do parceiro (E1-03): uma ficha por pessoa que atende, aplica, prescreve ou
 * cuida, com ou sem login. É a aba ao lado de Pessoas, no destino Equipe: Pessoas são os logins,
 * Profissionais são as fichas que a agenda e o prontuário citam.
 *
 * Em cima, o que falta para quem está logado: escrever prontuário, liberar resumo e assinar
 * receita pedem uma ficha ativa com CRMV (`aguardandoCrmv` do `GET /parceiro/portal/eu`). O botão
 * aparece com o aviso, não some, como o guia pede.
 */
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import type { MenuItem } from 'primevue/menuitem'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import ProfissionalGaveta from '@/components/parceiro/ProfissionalGaveta.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { getAuthUser } from '@/service/auth/auth-session'
import { listarEquipe } from '@/service/parceiro/equipe-service'
import {
  alterarProfissional,
  cadastrarProfissional,
  desativarProfissional,
  listarProfissionais,
  type DadosDoProfissional,
  type Profissional,
} from '@/service/parceiro/profissionais-service'

const { t } = useI18n()
const toast = useToast()
const { store, bootstrapping, ensureContext, parceiroQuery } = useParceiroPortal()

const profissionais = ref<Profissional[] | null>(null)
const membros = ref<Array<{ usuarioId: string; nome: string }>>([])
const erroAoCarregar = ref('')
const desativadasAbertas = ref(false)

const meuId = computed(() => getAuthUser()?.userId ?? null)
const geroEquipe = computed(() => store.temPermissao('equipe.gerir') && store.podeOperar)
const minhaFicha = computed(() => store.eu?.profissional ?? null)
const aguardandoCrmv = computed(() => store.eu?.aguardandoCrmv ?? [])

const ativos = computed(() => (profissionais.value ?? []).filter((item) => item.ativo))
const desativados = computed(() => (profissionais.value ?? []).filter((item) => !item.ativo))

const nomeDoLogin = computed(
  () => new Map(membros.value.map((membro) => [membro.usuarioId, membro.nome])),
)

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

async function carregar() {
  erroAoCarregar.value = ''

  try {
    const [lista, equipe] = await Promise.all([
      listarProfissionais(parceiroQuery()),
      listarEquipe(parceiroQuery()).catch(() => null),
    ])

    profissionais.value = lista
    membros.value = (equipe?.membros ?? []).map(({ usuarioId, nome }) => ({ usuarioId, nome }))
  } catch (err) {
    erroAoCarregar.value =
      err instanceof Error ? err.message : t('parceiro.profissionais.erroCarregar')
  }
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)

  return ((partes[0]?.[0] ?? '?') + (partes[1]?.[0] ?? '')).toUpperCase()
}

function registroDe(profissional: Profissional) {
  if (profissional.conselho === 'NENHUM' || !profissional.registro) {
    return ''
  }

  const sigla =
    profissional.conselho === 'CRMV' ? 'CRMV' : t('parceiro.profissionais.conselhoCurto')

  return `${sigla} ${profissional.registro}/${profissional.uf ?? ''}`
}

/* ------------------------------------------------------------------------- a gaveta */

const gavetaAberta = ref(false)
const emEdicao = ref<Profissional | null>(null)
const sugestao = ref<Partial<DadosDoProfissional> | undefined>(undefined)
const salvando = ref(false)
const erroDaGaveta = ref<Error | null>(null)

/** Quem não gere a equipe só mexe na própria ficha, e nela só na cor e nas especialidades. */
const soOProprio = computed(() => !geroEquipe.value)

function abrirNova(dados?: Partial<DadosDoProfissional>) {
  emEdicao.value = null
  sugestao.value = dados
  erroDaGaveta.value = null
  gavetaAberta.value = true
}

function abrirEdicao(profissional: Profissional) {
  emEdicao.value = profissional
  sugestao.value = undefined
  erroDaGaveta.value = null
  gavetaAberta.value = true
}

/** A ficha do próprio login: com o nome e o login já ligados, à espera do CRMV. */
function cadastrarMinhaFicha() {
  if (minhaFicha.value) {
    abrirEdicao(minhaFicha.value)
    return
  }

  abrirNova({ nome: getAuthUser()?.nome ?? '', conselho: 'CRMV', usuarioId: meuId.value })
}

async function salvar(dados: DadosDoProfissional) {
  salvando.value = true
  erroDaGaveta.value = null

  try {
    if (emEdicao.value) {
      await alterarProfissional(emEdicao.value.id, dados, parceiroQuery())
    } else {
      await cadastrarProfissional(dados, parceiroQuery())
    }

    gavetaAberta.value = false
    toast.add({ severity: 'success', summary: t('parceiro.profissionais.toast.salvo'), life: 3000 })
    await carregar()
    /* A ficha pode ser a de quem está logado: o aviso de CRMV e o menu vêm do /eu. */
    await ensureContext(true)
  } catch (err) {
    erroDaGaveta.value = err instanceof Error ? err : new Error(String(err))
  } finally {
    salvando.value = false
  }
}

/* ------------------------------------------------------------------------- desativar e reativar */

const paraDesativar = ref<Profissional | null>(null)
const confirmacaoVisivel = ref(false)
const ocupado = ref<string | null>(null)

async function desativar() {
  const alvo = paraDesativar.value

  if (!alvo) {
    return
  }

  ocupado.value = alvo.id

  try {
    await desativarProfissional(alvo.id, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('parceiro.profissionais.toast.desativado'),
      life: 3000,
    })
    await carregar()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('parceiro.equipe.toast.erro'),
      detail: err instanceof Error ? err.message : undefined,
      life: 6000,
    })
  } finally {
    ocupado.value = null
  }
}

async function reativar(profissional: Profissional) {
  ocupado.value = profissional.id

  try {
    await alterarProfissional(profissional.id, { ativo: true }, parceiroQuery())
    toast.add({
      severity: 'success',
      summary: t('parceiro.profissionais.toast.reativado'),
      life: 3000,
    })
    await carregar()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('parceiro.equipe.toast.erro'),
      detail: err instanceof Error ? err.message : undefined,
      life: 6000,
    })
  } finally {
    ocupado.value = null
  }
}

/* ------------------------------------------------------------------------- menu da linha */

const menu = ref<InstanceType<typeof Menu> | null>(null)
const doMenu = ref<Profissional | null>(null)

function acoesDe(profissional: Profissional): MenuItem[] {
  const ehMinha = profissional.usuarioId !== null && profissional.usuarioId === meuId.value

  if (!geroEquipe.value) {
    return ehMinha
      ? [
          {
            label: t('parceiro.profissionais.editar'),
            icon: 'ph ph-pencil-simple',
            command: () => abrirEdicao(profissional),
          },
        ]
      : []
  }

  return [
    {
      label: t('parceiro.profissionais.editar'),
      icon: 'ph ph-pencil-simple',
      command: () => abrirEdicao(profissional),
    },
    { separator: true },
    {
      label: t('parceiro.profissionais.desativar'),
      icon: 'ph ph-prohibit',
      class: 'menu-item--risco',
      command: () => {
        paraDesativar.value = profissional
        confirmacaoVisivel.value = true
      },
    },
  ]
}

const itensDoMenu = computed(() => (doMenu.value ? acoesDe(doMenu.value) : []))

function abrirMenu(evento: Event, profissional: Profissional) {
  doMenu.value = profissional
  menu.value?.toggle(evento)
}

onMounted(async () => {
  await ensureContext()
  await carregar()
})
</script>

<template>
  <UiPagina
    class="tela-profissionais"
    :titulo="t('parceiro.equipe.titulo')"
    :resumo="t('parceiro.profissionais.resumo')"
    :carregando="bootstrapping || (store.loadState === 'loading' && !store.dashboard)"
    :erro="loadError"
    :sem-acesso-de-parceiro="store.semAcessoParceiro"
    bloquear-se-suspenso
    @tentar-de-novo="ensureContext(true)"
  >
    <template v-if="geroEquipe" #acoes>
      <Button
        type="button"
        icon="ph ph-plus"
        :label="t('parceiro.profissionais.cadastrar')"
        @click="abrirNova()"
      />
    </template>

    <div class="profissionais">
      <!-- O que falta para quem está logado: a ficha com CRMV. -->
      <p v-if="aguardandoCrmv.length" class="profissionais__crmv" role="status">
        <i class="ph ph-seal-warning" aria-hidden="true" />
        <span>
          <strong>{{ t('parceiro.profissionais.crmv.titulo') }}</strong>
          {{
            geroEquipe || minhaFicha
              ? t('parceiro.profissionais.crmv.corpo')
              : t('parceiro.profissionais.crmv.peca')
          }}
        </span>
        <Button
          v-if="geroEquipe || minhaFicha"
          type="button"
          icon="ph ph-identification-card"
          :label="
            minhaFicha
              ? t('parceiro.profissionais.crmv.completar')
              : t('parceiro.profissionais.crmv.cadastrar')
          "
          severity="secondary"
          outlined
          size="small"
          @click="cadastrarMinhaFicha"
        />
      </p>

      <ul v-if="!profissionais && !erroAoCarregar" class="ui-lista ui-folha" aria-hidden="true">
        <li v-for="n in 3" :key="n" class="ui-linha">
          <Skeleton shape="circle" size="2.5rem" />
          <span class="ui-linha__texto">
            <Skeleton width="10rem" height="0.9rem" border-radius="6px" />
            <Skeleton width="14rem" height="0.8rem" border-radius="6px" />
          </span>
        </li>
      </ul>

      <div v-else-if="erroAoCarregar" class="profissionais__erro ui-folha" role="alert">
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

      <div v-else-if="!ativos.length" class="profissionais__vazio ui-folha">
        <strong>{{ t('parceiro.profissionais.vazio') }}</strong>
        <span>{{ t('parceiro.profissionais.vazioDica') }}</span>
      </div>

      <ul v-else class="ui-lista ui-folha">
        <li v-for="profissional in ativos" :key="profissional.id" class="ui-linha ficha">
          <span
            class="ficha__avatar"
            :style="{ '--cor': `var(--clinic-col-${profissional.corIndice % 6})` }"
            aria-hidden="true"
          >
            {{ iniciais(profissional.nome) }}
          </span>

          <span class="ui-linha__texto">
            <span class="ui-linha__titulo ficha__nome">
              {{ profissional.nome }}
              <span v-if="registroDe(profissional)" class="ui-num ficha__registro">
                {{ registroDe(profissional) }}
              </span>
            </span>
            <span class="ui-linha__meta">
              <template v-if="profissional.especialidades.length">
                {{ profissional.especialidades.join(', ') }} ·
              </template>
              {{
                profissional.usuarioId
                  ? t('parceiro.profissionais.comLogin', {
                      nome: nomeDoLogin.get(profissional.usuarioId) ?? '',
                    })
                  : t('parceiro.profissionais.semLogin')
              }}
              <template v-if="!profissional.atendeNaAgenda">
                · {{ t('parceiro.profissionais.foraDaAgenda') }}
              </template>
            </span>
          </span>

          <span class="ui-linha__fim">
            <span
              v-if="profissional.conselho === 'CRMV' && profissional.crmvConferidoEm"
              class="ui-selo ui-selo--ok"
            >
              <i class="ph ph-seal-check" aria-hidden="true" />
              {{ t('parceiro.profissionais.selo.conferido') }}
            </span>
            <span v-else-if="profissional.conselho === 'CRMV'" class="ui-selo">
              <i class="ph ph-hourglass" aria-hidden="true" />
              {{ t('parceiro.profissionais.selo.aConferir') }}
            </span>
            <Button
              v-if="acoesDe(profissional).length"
              type="button"
              icon="ph ph-dots-three"
              severity="secondary"
              outlined
              size="small"
              :loading="ocupado === profissional.id"
              :aria-label="t('parceiro.equipe.maisAcoes', { nome: profissional.nome })"
              :title="t('parceiro.equipe.maisAcoes', { nome: profissional.nome })"
              aria-haspopup="true"
              @click="abrirMenu($event, profissional)"
            />
            <span v-else class="ficha__sem-acao" aria-hidden="true" />
          </span>
        </li>
      </ul>

      <!-- As desativadas ficam recolhidas: a ficha não se apaga, mas não é trabalho do dia. -->
      <section v-if="desativados.length" class="profissionais__desativados">
        <Button
          type="button"
          :icon="desativadasAbertas ? 'ph ph-caret-up' : 'ph ph-caret-down'"
          icon-pos="right"
          :label="t('parceiro.profissionais.desativadas', { n: desativados.length })"
          severity="secondary"
          outlined
          size="small"
          :aria-expanded="desativadasAbertas"
          @click="desativadasAbertas = !desativadasAbertas"
        />

        <ul v-if="desativadasAbertas" class="ui-lista ui-folha">
          <li v-for="profissional in desativados" :key="profissional.id" class="ui-linha ficha">
            <span class="ficha__avatar ficha__avatar--inativo" aria-hidden="true">
              {{ iniciais(profissional.nome) }}
            </span>
            <span class="ui-linha__texto">
              <span class="ui-linha__titulo">{{ profissional.nome }}</span>
              <span class="ui-linha__meta">{{ registroDe(profissional) }}</span>
            </span>
            <span class="ui-linha__fim">
              <Button
                v-if="geroEquipe"
                type="button"
                icon="ph ph-arrow-counter-clockwise"
                :label="t('parceiro.profissionais.reativar')"
                severity="secondary"
                outlined
                size="small"
                :loading="ocupado === profissional.id"
                @click="reativar(profissional)"
              />
            </span>
          </li>
        </ul>
      </section>
    </div>

    <template #sempre>
      <Menu ref="menu" :model="itensDoMenu" popup />

      <ProfissionalGaveta
        v-model:visible="gavetaAberta"
        :profissional="emEdicao"
        :sugestao="sugestao"
        :so-o-proprio="soOProprio"
        :membros="membros"
        :salvando="salvando"
        :erro="erroDaGaveta"
        @salvar="salvar"
      />

      <ConfirmActionDialog
        v-model:visible="confirmacaoVisivel"
        :title="
          t('parceiro.profissionais.confirmarDesativar.titulo', { nome: paraDesativar?.nome ?? '' })
        "
        :message="t('parceiro.profissionais.confirmarDesativar.mensagem')"
        :confirm-label="t('parceiro.profissionais.desativar')"
        :cancel-label="t('parceiro.equipe.confirmar.voltar')"
        severity="danger"
        @confirm="desativar"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.profissionais {
  display: grid;
  gap: 20px;
}

.profissionais__crmv {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.profissionais__crmv > i {
  color: var(--atencao-tinta);
  font-size: 18px;
}

.profissionais__crmv > span {
  flex: 1 1 24rem;
}

.profissionais__crmv strong {
  display: block;
  font-weight: 600;
}

.profissionais__erro {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  font-size: 14px;
}

.profissionais__erro > i {
  color: var(--risco-tinta);
  font-size: 18px;
}

.profissionais__vazio {
  display: grid;
  gap: 4px;
  padding: 22px 24px;
  color: var(--tinta-2);
  font-size: 14px;
}

.profissionais__vazio strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.profissionais__desativados {
  display: grid;
  justify-items: start;
  gap: 12px;
}

.profissionais__desativados > .ui-lista {
  width: 100%;
}

/* A cor da coluna na agenda, no disco das iniciais: é o jeito de reconhecer a pessoa na grade. */
.ficha__avatar {
  display: grid;
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 999px;
  background: var(--cor);
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.ficha__avatar--inativo {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.ficha__nome {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

.ficha__registro {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
}

.ficha__sem-acao {
  width: 2.25rem;
}
</style>
