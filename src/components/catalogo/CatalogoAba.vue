<script setup lang="ts">
/**
 * O catálogo da clínica, na Configuração (E4-02, PJ-7JRYWN; guia e4 1.7): o que a clínica
 * acrescenta ao catálogo da PetJourney (que é só leitura). Um assunto por caixa: medicamentos,
 * vacinas, exames e diagnósticos, cada um com os ativos e, recolhidos embaixo, os desativados.
 * Desativar não apaga (e não libera lugar no teto de 2.000 medicamentos).
 *
 * Quem pode: `catalogo.gerir` (DONO e GESTOR). Com a Clínica só para consulta, lê e não escreve.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { lerErroDoCadastro } from '@/components/cadastro/erros-do-cadastro'
import ItemSimplesGaveta from '@/components/catalogo/ItemSimplesGaveta.vue'
import MedicamentoGaveta from '@/components/catalogo/MedicamentoGaveta.vue'
import VacinaGaveta from '@/components/catalogo/VacinaGaveta.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import {
  editarAcrescimo,
  listarAcrescimos,
  MEDICAMENTOS_PROPRIOS_MAX,
  type Acrescimos,
  type Diagnostico,
  type Exame,
  type Medicamento,
  type TipoDeAcrescimo,
  type Vacina,
} from '@/service/parceiro/catalogos-service'

const props = defineProps<{ podeEditar: boolean }>()

const { t } = useI18n()
const { parceiroQuery } = useParceiroPortal()

const lidos = ref<Acrescimos | null>(null)
const carregando = ref(false)
const erro = ref('')
const mexendo = ref<string | null>(null)
/** Os desativados ficam recolhidos, por tipo. */
const abertos = ref(new Set<TipoDeAcrescimo>())

function alternarDesativados(tipo: TipoDeAcrescimo) {
  const novo = new Set(abertos.value)
  if (novo.has(tipo)) novo.delete(tipo)
  else novo.add(tipo)
  abertos.value = novo
}

const gavetaMedicamento = ref(false)
const gavetaVacina = ref(false)
const gavetaSimples = ref(false)
const medicamento = ref<Medicamento | null>(null)
const vacina = ref<Vacina | null>(null)
const simples = ref<{ tipo: 'exames' | 'diagnosticos'; item: Exame | Diagnostico | null }>({
  tipo: 'exames',
  item: null,
})

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    lidos.value = await listarAcrescimos(parceiroQuery())
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('catalogo.erro.carregar')).mensagem
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)

type Linha = { id: string; titulo: string; meta: string; ativo: boolean }

type Secao = {
  tipo: TipoDeAcrescimo
  icone: string
  ativos: Linha[]
  inativos: Linha[]
}

function separar(linhas: Linha[]) {
  return {
    ativos: linhas.filter((linha) => linha.ativo),
    inativos: linhas.filter((linha) => !linha.ativo),
  }
}

const secoes = computed<Secao[]>(() => {
  const l = lidos.value
  if (!l) return []
  return [
    {
      tipo: 'medicamentos',
      icone: 'ph ph-pill',
      ...separar(
        l.medicamentos.map((m) => ({
          id: m.id,
          titulo: m.nome,
          meta: [m.principioAtivo, m.apresentacao].filter(Boolean).join(' · '),
          ativo: m.ativo,
        })),
      ),
    },
    {
      tipo: 'vacinas',
      icone: 'ph ph-syringe',
      ...separar(
        l.vacinas.map((v) => ({
          id: v.id,
          titulo: v.nome,
          meta: v.especies.map((e) => t(`cadastro.especie.${e}`)).join(', '),
          ativo: v.ativo,
        })),
      ),
    },
    {
      tipo: 'exames',
      icone: 'ph ph-flask',
      ...separar(
        l.exames.map((e) => ({
          id: e.id,
          titulo: e.nome,
          meta: t(`catalogo.exame.grupo.${e.grupo}`),
          ativo: e.ativo,
        })),
      ),
    },
    {
      tipo: 'diagnosticos',
      icone: 'ph ph-clipboard-text',
      ...separar(
        l.diagnosticos.map((d) => ({
          id: d.id,
          titulo: `${d.codigo} · ${d.descricao}`,
          meta: d.sistema ? t(`catalogo.diagnostico.sistema.${d.sistema}`) : '',
          ativo: d.ativo,
        })),
      ),
    },
  ]
})

const noLimite = computed(
  () => (lidos.value?.medicamentos.length ?? 0) >= MEDICAMENTOS_PROPRIOS_MAX,
)

function abrir(tipo: TipoDeAcrescimo, id: string | null) {
  const l = lidos.value
  if (tipo === 'medicamentos') {
    medicamento.value = (id && l?.medicamentos.find((m) => m.id === id)) || null
    gavetaMedicamento.value = true
  } else if (tipo === 'vacinas') {
    vacina.value = (id && l?.vacinas.find((v) => v.id === id)) || null
    gavetaVacina.value = true
  } else {
    const item =
      (id &&
        (tipo === 'exames'
          ? l?.exames.find((e) => e.id === id)
          : l?.diagnosticos.find((d) => d.id === id))) ||
      null
    simples.value = { tipo, item }
    gavetaSimples.value = true
  }
}

async function alternar(tipo: TipoDeAcrescimo, linha: Linha) {
  mexendo.value = linha.id
  erro.value = ''
  try {
    await editarAcrescimo(tipo, linha.id, { ativo: !linha.ativo }, parceiroQuery())
    await carregar()
  } catch (err) {
    erro.value = lerErroDoCadastro(err, t('cadastro.erros.salvar')).mensagem
  } finally {
    mexendo.value = null
  }
}
</script>

<template>
  <div class="cat">
    <p class="cat__dica">{{ t('catalogo.dica') }}</p>

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

    <section
      v-for="secao in secoes"
      :key="secao.tipo"
      class="ui-folha ui-cartao"
      :aria-labelledby="`cat-${secao.tipo}`"
    >
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i :class="secao.icone" /></span>
        <span class="ui-cartao__titulos">
          <h2 :id="`cat-${secao.tipo}`" class="ui-cartao__titulo">
            {{ t(`catalogo.secao.${secao.tipo}.titulo`) }}
          </h2>
          <p class="ui-cartao__descricao">{{ t(`catalogo.secao.${secao.tipo}.descricao`) }}</p>
        </span>
        <Button
          v-if="props.podeEditar"
          type="button"
          size="small"
          icon="ph ph-plus"
          :label="t(`catalogo.secao.${secao.tipo}.novo`)"
          :disabled="secao.tipo === 'medicamentos' && noLimite"
          @click="abrir(secao.tipo, null)"
        />
      </header>

      <p v-if="secao.tipo === 'medicamentos' && noLimite" class="cat__vazio">
        {{ t('catalogo.erro.noLimite') }}
      </p>

      <ul v-if="secao.ativos.length" class="ui-lista">
        <li v-for="linha in secao.ativos" :key="linha.id" class="ui-linha">
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo">{{ linha.titulo }}</strong>
            <span v-if="linha.meta" class="ui-linha__meta">{{ linha.meta }}</span>
          </span>
          <span v-if="props.podeEditar" class="ui-linha__fim cat__acoes">
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-pencil-simple"
              :aria-label="t('catalogo.editarDe', { nome: linha.titulo })"
              @click="abrir(secao.tipo, linha.id)"
            />
            <Button
              type="button"
              size="small"
              severity="secondary"
              outlined
              :label="t('agenda.config.desativar')"
              :loading="mexendo === linha.id"
              @click="alternar(secao.tipo, linha)"
            />
          </span>
        </li>
      </ul>
      <p v-else-if="!carregando" class="cat__vazio">
        {{ t(`catalogo.secao.${secao.tipo}.vazio`) }}
      </p>

      <div v-if="secao.inativos.length" class="cat__inativos">
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          :icon="abertos.has(secao.tipo) ? 'ph ph-caret-up' : 'ph ph-caret-down'"
          :label="t('catalogo.desativados', { n: secao.inativos.length })"
          :aria-expanded="abertos.has(secao.tipo)"
          @click="alternarDesativados(secao.tipo)"
        />
        <ul v-if="abertos.has(secao.tipo)" class="ui-lista">
          <li v-for="linha in secao.inativos" :key="linha.id" class="ui-linha">
            <span class="ui-linha__texto">
              <strong class="ui-linha__titulo">{{ linha.titulo }}</strong>
              <span v-if="linha.meta" class="ui-linha__meta">{{ linha.meta }}</span>
            </span>
            <span v-if="props.podeEditar" class="ui-linha__fim">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-arrow-counter-clockwise"
                :label="t('agenda.config.reativar')"
                :loading="mexendo === linha.id"
                @click="alternar(secao.tipo, linha)"
              />
            </span>
          </li>
        </ul>
      </div>
    </section>

    <ul v-if="carregando && !lidos" class="ui-lista" aria-busy="true">
      <li v-for="n in 4" :key="n" class="ui-linha"><Skeleton width="16rem" height="1rem" /></li>
    </ul>

    <MedicamentoGaveta
      v-model:visible="gavetaMedicamento"
      :medicamento="medicamento"
      @salvo="carregar"
      @no-limite="carregar"
    />
    <VacinaGaveta v-model:visible="gavetaVacina" :vacina="vacina" @salvo="carregar" />
    <ItemSimplesGaveta
      v-model:visible="gavetaSimples"
      :tipo="simples.tipo"
      :item="simples.item"
      @salvo="carregar"
    />
  </div>
</template>

<style scoped>
.cat {
  display: grid;
  gap: 24px;
}

.cat__dica,
.cat__vazio {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.cat__vazio {
  padding: 12px 16px 16px;
}

.cat__acoes {
  display: flex;
  gap: 8px;
}

.cat__inativos {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 4px 16px 12px;
}

.cat__inativos .ui-lista {
  justify-self: stretch;
}
</style>
