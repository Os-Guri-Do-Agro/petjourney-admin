<script setup lang="ts">
/**
 * Como a clínica recebe pedidos pela internet (E3-05, seção 6.2), numa gaveta ao lado da caixa:
 * configuração rara, recolhida. O `PUT` substitui tudo.
 *
 * Nasce desligado. Ligar exige a página publicada (E1-01), um serviço, um profissional e um dos dois
 * caminhos; a tela confere antes e, se a API recusar mesmo assim (`AGENDAMENTO_ONLINE_INVALIDO`,
 * `TIPO_FORA_DO_ONLINE`, `PROFISSIONAL_INDISPONIVEL`), marca o que ela apontou.
 *
 * Serviços são os tipos de atendimento ativos com "aparece no pedido online" (Configuração da
 * agenda); profissionais, os ativos que atendem na agenda. O aceite sozinho vale só para quem já é
 * cliente (decisão 25, 29/10), e a chave diz isso.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import Skeleton from 'primevue/skeleton'
import ToggleSwitch from 'primevue/toggleswitch'
import { useToast } from 'primevue/usetoast'
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'
import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { ApiError } from '@/service/api'
import { listarTipos, type TipoDeAtendimento } from '@/service/parceiro/agenda-config-service'
import {
  ANTECEDENCIA_MAX_HORAS,
  configuracaoParaSalvar,
  HORIZONTE_MAX_DIAS,
  HORIZONTE_MIN_DIAS,
  obterConfiguracaoOnline,
  PRAZO_MAX_HORAS,
  PRAZO_MIN_HORAS,
  salvarConfiguracaoOnline,
  type ConfiguracaoOnline,
  type ConfiguracaoOnlineSalva,
} from '@/service/parceiro/pedidos-service'
import { listarProfissionais, type Profissional } from '@/service/parceiro/profissionais-service'
import { SITE_PUBLICO } from '@/utils/parceiro/pagina-publica'

const props = defineProps<{ podeEditar: boolean }>()
const emit = defineEmits<{ salva: [configuracao: ConfiguracaoOnline] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
const toast = useToast()
const { parceiroQuery } = useParceiroPortal()

const atual = ref<ConfiguracaoOnline | null>(null)
const tipos = ref<TipoDeAtendimento[]>([])
const profissionais = ref<Profissional[]>([])
const carregando = ref(false)
const erro = ref('')
const salvando = ref(false)
const tentou = ref(false)
/** O que a API recusou: o motivo geral, um serviço ou um profissional. */
const recusa = ref<{ texto: string; tipoId?: string; profissionalId?: string } | null>(null)

const rascunho = reactive<ConfiguracaoOnlineSalva>({
  ativo: false,
  permiteEscolherHorario: true,
  permiteMelhorHorario: true,
  aceitaPeloLink: true,
  aceitarSozinho: false,
  mostrarProfissionais: true,
  tipoIds: [],
  profissionalIds: [],
  antecedenciaMinimaHoras: 2,
  horizonteDias: 30,
  prazoDeRespostaHoras: 4,
})

function aplicar(configuracao: ConfiguracaoOnline) {
  atual.value = configuracao
  Object.assign(rascunho, configuracaoParaSalvar(configuracao))
}

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    const [configuracao, listaDeTipos, listaDeProfissionais] = await Promise.all([
      obterConfiguracaoOnline(parceiroQuery()),
      listarTipos({ ...parceiroQuery(), ativos: true }),
      listarProfissionais({ ...parceiroQuery(), ativo: true, atendeNaAgenda: true }),
    ])
    tipos.value = listaDeTipos
    profissionais.value = listaDeProfissionais
    aplicar(configuracao)
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('pedidos.config.erroAoCarregar')).mensagem
  } finally {
    carregando.value = false
  }
}

watch(visible, (aberta) => {
  if (!aberta) return

  tentou.value = false
  recusa.value = null
  void carregar()
})

/* ------------------------------------------------------------------------- o que se escolhe */

/** Só os que podem ir para o pedido online e estão marcados para isso. */
const servicos = computed(() =>
  tipos.value.filter((tipo) => tipo.ativo && tipo.ofertadoOnline && tipo.podeSerOfertadoOnline),
)

/** Na ordem da lista (a do app); quem saiu da lista sai também da configuração ao salvar. */
function naOrdem<T extends { id: string }>(lista: readonly T[], ids: readonly string[]) {
  return lista.filter((item) => ids.includes(item.id)).map((item) => item.id)
}

const link = computed(() =>
  atual.value?.slug ? `${SITE_PUBLICO}/agendar/${encodeURIComponent(atual.value.slug)}` : null,
)

/** O que falta para ligar, conferido antes de enviar. */
const faltaParaLigar = computed(() => {
  if (!rascunho.ativo) return []

  const falta: string[] = []
  if (atual.value && !atual.value.perfilPublicado) falta.push('PERFIL_NAO_PUBLICADO')
  if (!naOrdem(servicos.value, rascunho.tipoIds).length) falta.push('SEM_SERVICO')
  if (!naOrdem(profissionais.value, rascunho.profissionalIds).length) {
    falta.push('SEM_PROFISSIONAL')
  }
  if (!rascunho.permiteEscolherHorario && !rascunho.permiteMelhorHorario) falta.push('SEM_MODO')

  return falta
})

const bloqueado = computed(() => !props.podeEditar || salvando.value)

/* ---------------------------------------------------------------------------------- salvar */

async function salvar() {
  tentou.value = true
  recusa.value = null
  if (faltaParaLigar.value.length) return

  salvando.value = true

  try {
    const salva = await salvarConfiguracaoOnline(
      {
        ...rascunho,
        aceitarSozinho: rascunho.permiteEscolherHorario && rascunho.aceitarSozinho,
        tipoIds: naOrdem(servicos.value, rascunho.tipoIds),
        profissionalIds: naOrdem(profissionais.value, rascunho.profissionalIds),
      },
      parceiroQuery(),
    )
    aplicar(salva)
    emit('salva', salva)
    toast.add({ severity: 'success', summary: t('pedidos.config.salva'), life: 3000 })
    visible.value = false
  } catch (err) {
    const lido = lerErroDoCadastro(err, t('cadastro.erros.salvar'))
    const detalhes = err instanceof ApiError ? (err.detalhes ?? {}) : {}
    const reason = typeof detalhes.reason === 'string' ? detalhes.reason : ''

    if (lido.codigo === 'AGENDAMENTO_ONLINE_INVALIDO' && reason) {
      recusa.value = {
        texto: ['PERFIL_NAO_PUBLICADO', 'SEM_SERVICO', 'SEM_PROFISSIONAL', 'SEM_MODO'].includes(
          reason,
        )
          ? t(`pedidos.config.falta.${reason}`)
          : lido.mensagem,
      }
    } else if (lido.codigo === 'TIPO_FORA_DO_ONLINE') {
      recusa.value = {
        texto: lido.mensagem,
        tipoId: typeof detalhes.tipoId === 'string' ? detalhes.tipoId : undefined,
      }
    } else if (lido.codigo === 'PROFISSIONAL_INDISPONIVEL') {
      recusa.value = {
        texto: lido.mensagem,
        profissionalId:
          typeof detalhes.profissionalId === 'string' ? detalhes.profissionalId : undefined,
      }
    } else {
      toast.add({ severity: 'error', summary: lido.mensagem, life: 6000 })
    }
  } finally {
    salvando.value = false
  }
}

async function copiarLink() {
  if (!link.value) return

  try {
    await navigator.clipboard.writeText(link.value)
    toast.add({ severity: 'success', summary: t('clinico.pedidos.link.copiado'), life: 2500 })
  } catch {
    toast.add({ severity: 'warn', summary: link.value, life: 8000 })
  }
}
</script>

<template>
  <CadastroGaveta
    v-model:visible="visible"
    :titulo="t('clinico.pedidos.config.titulo')"
    icone="ph ph-sliders-horizontal"
    largura="34rem"
  >
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

    <div v-if="carregando && !atual" class="co__esqueleto" aria-busy="true">
      <Skeleton v-for="n in 6" :key="n" height="2.75rem" />
    </div>

    <form v-else-if="atual" id="online-form" class="eg" novalidate @submit.prevent="salvar">
      <label class="co__chave co__chave--mestra">
        <span class="co__texto">
          <strong>{{ t('pedidos.config.ativo') }}</strong>
          <small>{{ t('pedidos.config.ativoDica') }}</small>
        </span>
        <ToggleSwitch v-model="rascunho.ativo" :disabled="bloqueado" />
      </label>

      <p v-if="!atual.perfilPublicado" class="co__aviso" role="status">
        <i class="ph ph-globe-hemisphere-west" aria-hidden="true" />
        <span>{{ t('pedidos.config.semPagina') }}</span>
        <RouterLink to="/parceiro/estabelecimento" class="co__link">
          {{ t('pedidos.config.irAPagina') }}
        </RouterLink>
      </p>

      <p v-if="recusa" class="eg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>{{ recusa.texto }}</span>
      </p>
      <ul v-else-if="tentou && faltaParaLigar.length" class="co__faltas" role="alert">
        <li v-for="falta in faltaParaLigar" :key="falta">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          {{ t(`pedidos.config.falta.${falta}`) }}
        </li>
      </ul>

      <section class="eg__secao">
        <h3 class="eg__rotulo">{{ t('clinico.pedidos.config.caminhos') }}</h3>
        <label class="co__opcao">
          <Checkbox v-model="rascunho.permiteEscolherHorario" binary :disabled="bloqueado" />
          <span class="co__texto">
            <strong>{{ t('clinico.pedidos.config.escolherHorario') }}</strong>
            <small>{{ t('pedidos.config.escolherHorarioDica') }}</small>
          </span>
        </label>
        <label class="co__opcao">
          <Checkbox v-model="rascunho.permiteMelhorHorario" binary :disabled="bloqueado" />
          <span class="co__texto">
            <strong>{{ t('clinico.pedidos.config.melhorHorario') }}</strong>
            <small>{{ t('clinico.pedidos.config.melhorHorarioAjuda') }}</small>
          </span>
        </label>
      </section>

      <section class="eg__secao co__chaves">
        <label class="co__chave">
          <span class="co__texto">
            <strong>{{ t('pedidos.config.peloSite') }}</strong>
            <small>{{ t('pedidos.config.peloSiteDica') }}</small>
          </span>
          <ToggleSwitch v-model="rascunho.aceitaPeloLink" :disabled="bloqueado" />
        </label>
        <label class="co__chave">
          <span class="co__texto">
            <strong>{{ t('pedidos.config.mostrarProfissionais') }}</strong>
            <small>{{ t('pedidos.config.mostrarProfissionaisDica') }}</small>
          </span>
          <ToggleSwitch v-model="rascunho.mostrarProfissionais" :disabled="bloqueado" />
        </label>
        <label class="co__chave">
          <span class="co__texto">
            <strong>{{ t('pedidos.config.aceitarSozinho') }}</strong>
            <small>{{ t('pedidos.config.aceitarSozinhoDica') }}</small>
          </span>
          <ToggleSwitch
            v-model="rascunho.aceitarSozinho"
            :disabled="bloqueado || !rascunho.permiteEscolherHorario"
          />
        </label>
      </section>

      <section class="eg__secao">
        <h3 class="eg__rotulo">{{ t('clinico.pedidos.config.servicos') }}</h3>
        <p v-if="!servicos.length" class="co__vazio">
          {{ t('pedidos.config.semServicos') }}
          <RouterLink to="/clinica/configuracao?aba=tipos" class="co__link">
            {{ t('pedidos.config.irAosTipos') }}
          </RouterLink>
        </p>
        <label
          v-for="tipo in servicos"
          :key="tipo.id"
          class="co__opcao"
          :class="{ 'co__opcao--erro': recusa?.tipoId === tipo.id }"
        >
          <Checkbox v-model="rascunho.tipoIds" :value="tipo.id" :disabled="bloqueado" />
          <span class="co__texto">
            <strong>{{ tipo.nome }}</strong>
            <small>{{ t('agenda.config.tipo.minutos', { n: tipo.duracaoMinutos }) }}</small>
          </span>
        </label>
        <small v-if="servicos.length" class="eg__dica">{{
          t('pedidos.config.servicosDica')
        }}</small>
      </section>

      <section class="eg__secao">
        <h3 class="eg__rotulo">{{ t('clinico.pedidos.config.profissionais') }}</h3>
        <p v-if="!profissionais.length" class="co__vazio">
          {{ t('pedidos.config.semProfissionais') }}
          <RouterLink to="/parceiro/profissionais" class="co__link">
            {{ t('pedidos.config.irAosProfissionais') }}
          </RouterLink>
        </p>
        <label
          v-for="profissional in profissionais"
          :key="profissional.id"
          class="co__opcao"
          :class="{ 'co__opcao--erro': recusa?.profissionalId === profissional.id }"
        >
          <Checkbox
            v-model="rascunho.profissionalIds"
            :value="profissional.id"
            :disabled="bloqueado"
          />
          <span class="co__texto">
            <strong>{{ profissional.nome }}</strong>
            <small v-if="profissional.especialidades.length">{{
              profissional.especialidades.join(', ')
            }}</small>
          </span>
        </label>
      </section>

      <section class="eg__secao">
        <h3 class="eg__rotulo">{{ t('clinico.pedidos.config.prazos') }}</h3>
        <div class="co__prazos">
          <label class="co__prazo" for="online-prazo">
            <span class="co__texto">
              <strong>{{ t('clinico.pedidos.config.prazo') }}</strong>
              <small>{{ t('pedidos.config.prazoDica') }}</small>
            </span>
            <InputNumber
              v-model="rascunho.prazoDeRespostaHoras"
              input-id="online-prazo"
              :min="PRAZO_MIN_HORAS"
              :max="PRAZO_MAX_HORAS"
              suffix=" h"
              show-buttons
              :disabled="bloqueado"
            />
          </label>
          <label class="co__prazo" for="online-antecedencia">
            <span class="co__texto">
              <strong>{{ t('clinico.pedidos.config.antecedencia') }}</strong>
              <small>{{ t('clinico.pedidos.config.antecedenciaAjuda') }}</small>
            </span>
            <InputNumber
              v-model="rascunho.antecedenciaMinimaHoras"
              input-id="online-antecedencia"
              :min="0"
              :max="ANTECEDENCIA_MAX_HORAS"
              suffix=" h"
              show-buttons
              :disabled="bloqueado"
            />
          </label>
          <label class="co__prazo" for="online-horizonte">
            <span class="co__texto">
              <strong>{{ t('clinico.pedidos.config.horizonte') }}</strong>
              <small>{{ t('clinico.pedidos.config.horizonteAjuda') }}</small>
            </span>
            <InputNumber
              v-model="rascunho.horizonteDias"
              input-id="online-horizonte"
              :min="HORIZONTE_MIN_DIAS"
              :max="HORIZONTE_MAX_DIAS"
              :suffix="` ${t('clinico.pedidos.config.dias')}`"
              show-buttons
              :disabled="bloqueado"
            />
          </label>
        </div>
      </section>

      <section v-if="link" class="eg__secao">
        <h3 class="eg__rotulo">{{ t('clinico.pedidos.link.titulo') }}</h3>
        <span class="co__endereco">{{ link }}</span>
        <span class="co__acoes-link">
          <Button
            type="button"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-copy"
            :label="t('clinico.pedidos.link.copiar')"
            @click="copiarLink"
          />
          <Button
            as="a"
            :href="link"
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            severity="secondary"
            outlined
            icon="ph ph-arrow-square-out"
            :label="t('clinico.pedidos.link.abrir')"
          />
        </span>
        <small v-if="!atual.aceitaPeloLink" class="eg__dica">{{
          t('pedidos.config.linkDesligado')
        }}</small>
      </section>
    </form>

    <template #pe>
      <Button
        type="button"
        :label="props.podeEditar ? t('cadastro.cancelar') : t('agenda.config.expediente.fechar')"
        severity="secondary"
        outlined
        :disabled="salvando"
        @click="visible = false"
      />
      <Button
        v-if="props.podeEditar && atual"
        type="submit"
        form="online-form"
        icon="ph ph-check"
        :label="t('cadastro.salvar')"
        :loading="salvando"
      />
    </template>
  </CadastroGaveta>
</template>

<style scoped>
.co__esqueleto {
  display: grid;
  gap: 10px;
}

.co__texto {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.co__texto strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.co__texto small {
  color: var(--tinta-2);
  font-size: 13px;
}

.co__chave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
}

.co__chave :deep(.p-toggleswitch) {
  flex: 0 0 auto;
}

.co__chave--mestra {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--linha-suave);
}

.co__chaves {
  gap: 14px;
}

.co__opcao {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 0;
  cursor: pointer;
}

.co__opcao :deep(.p-checkbox) {
  margin-top: 2px;
}

.co__opcao--erro strong {
  color: var(--risco-tinta);
}

.co__aviso,
.co__vazio {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.co__link {
  color: var(--tinta);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.co__faltas {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--risco-tinta);
  font-size: 13px;
}

.co__faltas li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.co__prazos {
  display: grid;
  gap: 14px;
}

.co__prazo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.co__prazo :deep(.p-inputnumber) {
  flex: 0 0 9rem;
}

.co__prazo :deep(.p-inputnumber-input) {
  width: 100%;
}

.co__endereco {
  overflow-wrap: anywhere;
  color: var(--tinta);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.co__acoes-link {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
