<script setup lang="ts">
/**
 * Financeiro › Contas (protótipo): o que vence e o que está para entrar. Duas perguntas, uma de
 * cada vez (o seletor no alto):
 *
 * - **A pagar:** pelo vencimento, as vencidas primeiro, depois esta semana e o resto do mês. O
 *   repasse dos veterinários e o lote que entrou no estoque chegam aqui sozinhos, com a origem
 *   escrita na linha. As pagas do mês ficam recolhidas embaixo.
 * - **A receber:** os clientes que levaram em aberto (com o lembrete pelo app, que já leva o Pix
 *   da clínica) e o que a maquininha ainda vai depositar, dia a dia, já sem a taxa.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import { addDays, diffDays } from '@/features/clinico/domain/clinic-time'

import { CATEGORIAS, dataComDia, dataCurta, reais, reaisCurtos, type Despesa } from '../dados'
import { useFinanceiro, type Devedor } from '../estado'
import { previsao } from '../resultado'

import AvisoDoFinanceiro from './AvisoDoFinanceiro.vue'
import DespesaGaveta from './DespesaGaveta.vue'
import ReceberContaGaveta from './ReceberContaGaveta.vue'
import SoParaQuemPode from './SoParaQuemPode.vue'

const fin = useFinanceiro()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const bloqueado = computed(() => fin.perfil.value.tipo !== 'gestao')
const hoje = computed(() => fin.hoje.value)

const ver = computed<'pagar' | 'receber'>({
  get: () => (route.query.ver === 'receber' ? 'receber' : 'pagar'),
  set: (novo) => {
    const query = { ...route.query }
    if (novo === 'pagar') delete query.ver
    else query.ver = novo
    void router.replace({ query })
  },
})

const prev = computed(() => previsao(fin.mundo.value, fin.recebiveis.value, hoje.value))

const resumo = computed(() => {
  if (bloqueado.value) return 'O que vence e o que está para entrar'
  const vencidas = fin.aPagar.value.filter((d) => d.vencimento < hoje.value)
  const partes = [`${reaisCurtos(prev.value.sai)} a pagar nos próximos 30 dias`]
  if (vencidas.length)
    partes.push(`${vencidas.length} ${vencidas.length === 1 ? 'vencida' : 'vencidas'}`)
  partes.push(`${reaisCurtos(prev.value.entra)} para entrar`)
  return partes.join(' · ')
})

// ---------------------------------------------------------------------------------- a pagar

type Grupo = { id: string; titulo: string; tom: '' | 'risco' | 'atencao'; itens: Despesa[] }

const grupos = computed<Grupo[]>(() => {
  const semana = addDays(hoje.value, 7)
  const mes = addDays(hoje.value, 30)
  const lista = fin.aPagar.value
  const g: Grupo[] = [
    {
      id: 'vencidas',
      titulo: 'Vencidas',
      tom: 'risco',
      itens: lista.filter((d) => d.vencimento < hoje.value),
    },
    {
      id: 'semana',
      titulo: 'Nos próximos 7 dias',
      tom: 'atencao',
      itens: lista.filter((d) => d.vencimento >= hoje.value && d.vencimento <= semana),
    },
    {
      id: 'mes',
      titulo: 'Até 30 dias',
      tom: '',
      itens: lista.filter((d) => d.vencimento > semana && d.vencimento <= mes),
    },
  ]
  return g.filter((grupo) => grupo.itens.length)
})

const depois = computed(() =>
  fin.aPagar.value.filter((d) => d.vencimento > addDays(hoje.value, 30)),
)
const verDepois = ref(false)
const verPagas = ref(false)

function quando(d: Despesa) {
  const dias = diffDays(hoje.value, d.vencimento)
  if (dias < 0) return { texto: `venceu há ${-dias} ${dias === -1 ? 'dia' : 'dias'}`, tom: 'risco' }
  if (dias === 0) return { texto: 'vence hoje', tom: 'atencao' }
  if (dias === 1) return { texto: 'vence amanhã', tom: 'atencao' }
  return { texto: `vence ${dataCurta(d.vencimento)}`, tom: '' }
}

const somaDe = (lista: Despesa[]) => lista.reduce((s, d) => s + d.valor, 0)

// -------------------------------------------------------------------------------- a receber

const devedores = computed(() => fin.devedores.value)
const totalDevido = computed(() => devedores.value.reduce((s, d) => s + d.total, 0))

function situacaoDoDebito(d: Devedor) {
  if (d.atraso > 0)
    return { texto: `venceu há ${d.atraso} ${d.atraso === 1 ? 'dia' : 'dias'}`, tom: 'risco' }
  if (d.atraso === 0) return { texto: 'vence hoje', tom: 'atencao' }
  return { texto: `vence ${dataCurta(d.vencimento)}`, tom: '' }
}

function lembrar(d: Devedor) {
  fin.lembrar(d.tutorId, 'app', 'Lembrete enviado pelo app')
  toast.add({
    severity: 'success',
    summary: `Lembrete para ${d.tutorNome.split(' ')[0]}`,
    detail: `O app avisa que há ${reais(d.total)} em aberto, com o Pix da clínica para pagar dali mesmo. No protótipo, nada é enviado.`,
    life: 5000,
  })
}

const recebiveisDoMes = computed(() =>
  fin.recebiveis.value.filter((r) => r.data <= addDays(hoje.value, 30)),
)
const recebiveisDepois = computed(() =>
  fin.recebiveis.value.filter((r) => r.data > addDays(hoje.value, 30)),
)
const verRecebiveisDepois = ref(false)

const diasDeRecebivel = computed(() => {
  const lista = verRecebiveisDepois.value ? fin.recebiveis.value : recebiveisDoMes.value
  const porDia = new Map<string, typeof lista>()
  for (const r of lista) porDia.set(r.data, [...(porDia.get(r.data) ?? []), r])
  return [...porDia.entries()].map(([data, itens]) => ({
    data,
    itens,
    liquido: itens.reduce((s, r) => s + r.liquido, 0),
    bruto: itens.reduce((s, r) => s + r.bruto, 0),
    taxa: itens.reduce((s, r) => s + r.taxa, 0),
  }))
})

// ---------------------------------------------------------------------------------- gavetas

const despesaAberta = ref(false)
const despesaEmFoco = ref<string | null>(null)
const modoDaDespesa = ref<'registrar' | 'pagar'>('registrar')

function abrirDespesa(id: string | null, modo: 'registrar' | 'pagar') {
  despesaEmFoco.value = id
  modoDaDespesa.value = modo
  despesaAberta.value = true
}

const receberAberta = ref(false)
const debitoEmFoco = ref<Devedor | null>(null)

function receberDebito(d: Devedor) {
  debitoEmFoco.value = d
  receberAberta.value = true
}
</script>

<template>
  <UiPagina :resumo="resumo">
    <template v-if="!bloqueado" #acoes>
      <Button
        type="button"
        icon="ph ph-plus"
        label="Registrar despesa"
        @click="abrirDespesa(null, 'registrar')"
      />
    </template>

    <div class="fin">
      <AvisoDoFinanceiro />

      <SoParaQuemPode v-if="bloqueado" />

      <template v-else>
        <div class="ct__barra">
          <SelectButton
            v-model="ver"
            :options="[
              { valor: 'pagar', rotulo: 'A pagar' },
              { valor: 'receber', rotulo: 'A receber' },
            ]"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-label="O que ver"
          />
          <p class="ct__previsao">
            <i class="ph ph-crystal-ball" aria-hidden="true" />
            <span>
              Já marcado para os próximos 30 dias: entram
              <strong class="ui-num">{{ reais(prev.entra) }}</strong> e saem
              <strong class="ui-num">{{ reais(prev.sai) }}</strong
              >.
              <template v-if="prev.saldo < 0">
                As vendas novas precisam cobrir
                <strong class="ui-num ct__neg">{{ reais(-prev.saldo) }}</strong
                >.
              </template>
              <template v-else>
                Sobram <strong class="ui-num ct__pos">{{ reais(prev.saldo) }}</strong> antes das
                vendas novas.
              </template>
            </span>
          </p>
        </div>

        <!-- A pagar -->
        <template v-if="ver === 'pagar'">
          <section class="ui-folha ui-cartao" aria-labelledby="ct-pagar">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-receipt" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="ct-pagar" class="ui-cartao__titulo">A pagar</h2>
                <p class="ui-cartao__descricao">
                  Pelo vencimento. Repasses e compras do estoque entram sozinhos; o resto se
                  registra aqui.
                </p>
              </span>
              <span class="ui-cartao__total ui-num">{{
                reais(somaDe(grupos.flatMap((g) => g.itens)))
              }}</span>
            </header>

            <template v-if="grupos.length">
              <div v-for="grupo in grupos" :key="grupo.id" class="ct__grupo">
                <h3
                  class="ct__grupo-titulo"
                  :class="grupo.tom ? `ct__grupo-titulo--${grupo.tom}` : ''"
                >
                  <i v-if="grupo.tom === 'risco'" class="ph ph-warning-circle" aria-hidden="true" />
                  {{ grupo.titulo }}
                  <span class="ct__grupo-soma ui-num">{{ reais(somaDe(grupo.itens)) }}</span>
                </h3>
                <ul class="ui-lista">
                  <li v-for="d in grupo.itens" :key="d.id">
                    <div class="ui-linha ct__linha">
                      <span
                        class="ui-ladrilho"
                        :class="{ 'ui-ladrilho--risco': quando(d).tom === 'risco' }"
                        aria-hidden="true"
                      >
                        <i :class="CATEGORIAS[d.categoria].icone" />
                      </span>
                      <span class="ui-linha__texto">
                        <span class="ui-linha__titulo">{{ d.descricao }}</span>
                        <span class="ui-linha__meta">
                          {{ d.fornecedor }} · {{ CATEGORIAS[d.categoria].nome }}
                          <template v-if="d.origem"> · {{ d.origem.texto }}</template>
                        </span>
                      </span>
                      <span class="ui-linha__fim">
                        <span v-if="d.recorrente" class="ct__todo-mes" title="Repete todo mês">
                          <i class="ph ph-repeat" aria-hidden="true" /> todo mês
                        </span>
                        <span
                          class="ct__quando"
                          :class="quando(d).tom ? `ct__quando--${quando(d).tom}` : ''"
                        >
                          {{ quando(d).texto }}
                        </span>
                        <strong class="ct__valor ui-num">{{ reais(d.valor) }}</strong>
                        <Button
                          type="button"
                          size="small"
                          severity="secondary"
                          outlined
                          icon="ph ph-pencil-simple"
                          :aria-label="`Editar ${d.descricao}`"
                          @click="abrirDespesa(d.id, 'registrar')"
                        />
                        <Button
                          type="button"
                          size="small"
                          :severity="quando(d).tom === 'risco' ? undefined : 'secondary'"
                          :outlined="quando(d).tom !== 'risco'"
                          icon="ph ph-check"
                          label="Pagar"
                          @click="abrirDespesa(d.id, 'pagar')"
                        />
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
            </template>

            <UiVazioIlustrado
              v-else
              aninhado
              icone="ph ph-check-circle"
              titulo="Nada vencendo nos próximos 30 dias"
              texto="Registre o aluguel, as contas de consumo e as compras para a previsão enxergar o mês."
            >
              <template #acao>
                <Button
                  type="button"
                  icon="ph ph-plus"
                  label="Registrar despesa"
                  severity="secondary"
                  outlined
                  @click="abrirDespesa(null, 'registrar')"
                />
              </template>
            </UiVazioIlustrado>

            <footer v-if="depois.length" class="ui-cartao__pe">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :icon="verDepois ? 'ph ph-caret-up' : 'ph ph-caret-down'"
                :label="
                  verDepois
                    ? 'Esconder as de depois'
                    : `Ver as ${depois.length} de depois de 30 dias (${reais(somaDe(depois))})`
                "
                @click="verDepois = !verDepois"
              />
            </footer>
            <ul v-if="verDepois" class="ui-lista ct__depois">
              <li v-for="d in depois" :key="d.id">
                <div class="ui-linha ct__linha">
                  <span class="ui-ladrilho" aria-hidden="true"
                    ><i :class="CATEGORIAS[d.categoria].icone"
                  /></span>
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo">{{ d.descricao }}</span>
                    <span class="ui-linha__meta">{{ d.fornecedor }}</span>
                  </span>
                  <span class="ui-linha__fim">
                    <span class="ct__quando">vence {{ dataCurta(d.vencimento) }}</span>
                    <strong class="ct__valor ui-num">{{ reais(d.valor) }}</strong>
                  </span>
                </div>
              </li>
            </ul>
          </section>

          <section class="ui-folha ui-cartao" aria-labelledby="ct-pagas">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho ui-ladrilho--ok" aria-hidden="true"
                ><i class="ph ph-check-circle"
              /></span>
              <span class="ui-cartao__titulos">
                <h2 id="ct-pagas" class="ui-cartao__titulo">
                  Pagas neste mês
                  <span class="ui-contagem">{{ fin.pagasNoMes.value.length }}</span>
                </h2>
              </span>
              <span class="ui-cartao__acoes">
                <strong class="ui-num ct__valor">{{ reais(somaDe(fin.pagasNoMes.value)) }}</strong>
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  :icon="verPagas ? 'ph ph-caret-up' : 'ph ph-caret-down'"
                  :label="verPagas ? 'Recolher' : 'Ver a lista'"
                  :aria-expanded="verPagas"
                  @click="verPagas = !verPagas"
                />
              </span>
            </header>
            <ul v-if="verPagas" class="ui-lista">
              <li v-for="d in fin.pagasNoMes.value" :key="d.id">
                <div class="ui-linha ct__linha">
                  <span class="ui-ladrilho" aria-hidden="true"
                    ><i :class="CATEGORIAS[d.categoria].icone"
                  /></span>
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo">{{ d.descricao }}</span>
                    <span class="ui-linha__meta"
                      >{{ d.fornecedor }} · paga em {{ dataCurta(d.pagaEm ?? d.vencimento) }}</span
                    >
                  </span>
                  <span class="ui-linha__fim">
                    <strong class="ct__valor ui-num">{{ reais(d.valor) }}</strong>
                    <Button
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      icon="ph ph-arrow-counter-clockwise"
                      :aria-label="`Desfazer o pagamento de ${d.descricao}`"
                      title="Desfazer o pagamento"
                      @click="fin.desfazerPagamento(d.id)"
                    />
                  </span>
                </div>
              </li>
            </ul>
          </section>
        </template>

        <!-- A receber -->
        <template v-else>
          <section class="ui-folha ui-cartao" aria-labelledby="ct-clientes">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"
                ><i class="ph ph-hourglass-medium"
              /></span>
              <span class="ui-cartao__titulos">
                <h2 id="ct-clientes" class="ui-cartao__titulo">
                  Clientes com conta em aberto
                  <span v-if="devedores.length" class="ui-contagem">{{ devedores.length }}</span>
                </h2>
                <p class="ui-cartao__descricao">
                  Quem levou para pagar depois. O lembrete chega no app do responsável com o Pix da
                  clínica, e ele paga dali mesmo.
                </p>
              </span>
              <span v-if="devedores.length" class="ui-cartao__total ui-num">{{
                reais(totalDevido)
              }}</span>
            </header>
            <ul v-if="devedores.length" class="ui-lista">
              <li v-for="d in devedores" :key="d.tutorId">
                <div class="ui-linha ct__linha">
                  <span class="ui-ladrilho ct__iniciais" aria-hidden="true">{{
                    iniciais(d.tutorNome)
                  }}</span>
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo">{{ d.tutorNome }}</span>
                    <span class="ui-linha__meta">
                      {{ d.pets.join(', ') }} · {{ d.contas.length }}
                      {{ d.contas.length === 1 ? 'conta' : 'contas' }}
                      <template v-if="d.ultimoLembrete">
                        · lembrado pelo app em {{ dataCurta(d.ultimoLembrete) }}</template
                      >
                    </span>
                  </span>
                  <span class="ui-linha__fim">
                    <span
                      class="ct__quando"
                      :class="
                        situacaoDoDebito(d).tom ? `ct__quando--${situacaoDoDebito(d).tom}` : ''
                      "
                    >
                      {{ situacaoDoDebito(d).texto }}
                    </span>
                    <strong class="ct__valor ui-num">{{ reais(d.total) }}</strong>
                    <Button
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      icon="ph ph-bell-ringing"
                      :label="d.ultimoLembrete === hoje ? 'Lembrado hoje' : 'Lembrar pelo app'"
                      :disabled="d.ultimoLembrete === hoje"
                      @click="lembrar(d)"
                    />
                    <Button
                      type="button"
                      size="small"
                      icon="ph ph-cash-register"
                      label="Receber"
                      @click="receberDebito(d)"
                    />
                  </span>
                </div>
              </li>
            </ul>
            <UiVazioIlustrado
              v-else
              aninhado
              icone="ph ph-check-circle"
              titulo="Ninguém devendo"
              texto="Quando a recepção escolhe 'Deixar em aberto' no receber, o cliente aparece aqui com o vencimento."
            />
          </section>

          <section class="ui-folha ui-cartao" aria-labelledby="ct-cartoes">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-credit-card" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="ct-cartoes" class="ui-cartao__titulo">Cartões a cair</h2>
                <p class="ui-cartao__descricao">
                  O que a maquininha ainda vai depositar, dia a dia, já sem a taxa. O crédito
                  parcelado cai uma parcela a cada 30 dias.
                </p>
              </span>
              <span class="ui-cartao__total ui-num">{{
                reais(recebiveisDoMes.reduce((s, r) => s + r.liquido, 0))
              }}</span>
            </header>
            <table class="ui-tabela ct__tabela">
              <thead>
                <tr>
                  <th scope="col">Cai em</th>
                  <th scope="col">Vendas</th>
                  <th scope="col" class="ct__num">Vendido</th>
                  <th scope="col" class="ct__num">Taxa</th>
                  <th scope="col" class="ct__num">Cai na conta</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="dia in diasDeRecebivel" :key="dia.data">
                  <td>{{ dataComDia(dia.data) }}</td>
                  <td class="ct__vendas">
                    <span v-for="r in dia.itens" :key="r.forma" class="ui-selo">
                      {{ r.vendas }} no {{ r.forma === 'debito' ? 'débito' : 'crédito' }}
                    </span>
                  </td>
                  <td class="ct__num ui-num">{{ reais(dia.bruto) }}</td>
                  <td class="ct__num ui-num ct__taxa">− {{ reais(dia.taxa) }}</td>
                  <td class="ct__num ui-num">
                    <strong>{{ reais(dia.liquido) }}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <footer v-if="recebiveisDepois.length" class="ui-cartao__pe">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                :icon="verRecebiveisDepois ? 'ph ph-caret-up' : 'ph ph-caret-down'"
                :label="
                  verRecebiveisDepois
                    ? 'Só os próximos 30 dias'
                    : `Ver as parcelas de depois (${reais(recebiveisDepois.reduce((s, r) => s + r.liquido, 0))})`
                "
                @click="verRecebiveisDepois = !verRecebiveisDepois"
              />
            </footer>
          </section>
        </template>
      </template>
    </div>

    <template #sempre>
      <DespesaGaveta
        v-model:visible="despesaAberta"
        :despesa-id="despesaEmFoco"
        :modo="modoDaDespesa"
      />
      <ReceberContaGaveta v-model:visible="receberAberta" :conta-id="null" :debito="debitoEmFoco" />
    </template>
  </UiPagina>
</template>

<style scoped>
/* As linhas seguem a largura do conteúdo (a gaveta aberta estreita a página), não a da janela. */
.fin {
  display: grid;
  gap: 20px;
  container-type: inline-size;
}

.ct__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
}

.ct__previsao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ct__previsao i {
  color: var(--app-salvia-texto, var(--musgo));
  font-size: 17px;
}

.ct__previsao strong {
  color: var(--tinta);
}

.ct__pos {
  color: var(--ok-tinta) !important;
}

.ct__neg {
  color: var(--atencao-tinta) !important;
}

.ct__grupo + .ct__grupo {
  border-top: 1px solid var(--linha-suave);
}

.ct__grupo-titulo {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 14px 24px 4px;
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 11.5px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.ct__grupo-titulo--risco {
  color: var(--risco-tinta);
}

.ct__grupo-titulo--atencao {
  color: var(--atencao-tinta);
}

.ct__grupo-soma {
  margin-inline-start: auto;
  letter-spacing: 0;
}

.ct__linha {
  min-height: 0;
  padding-block: 12px;
}

.ct__valor {
  min-width: 6.5rem;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
  text-align: end;
}

.ct__quando {
  color: var(--tinta-2);
  font-size: 13px;
  white-space: nowrap;
}

.ct__quando--risco {
  color: var(--risco-tinta);
  font-weight: 650;
}

.ct__quando--atencao {
  color: var(--atencao-tinta);
  font-weight: 650;
}

.ct__todo-mes {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ct__depois {
  border-top: 1px solid var(--linha-suave);
}

.ct__iniciais {
  font-size: 13px;
  font-weight: 700;
}

.ct__tabela {
  width: 100%;
}

.ct__tabela th:first-child,
.ct__tabela td:first-child {
  padding-inline-start: 24px;
}

.ct__tabela th:last-child,
.ct__tabela td:last-child {
  padding-inline-end: 24px;
}

.ct__num {
  text-align: end;
}

.ct__vendas {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ct__taxa {
  color: var(--tinta-2);
}

@container (max-width: 900px) {
  .ct__todo-mes {
    display: none;
  }

  .ct__linha {
    flex-wrap: wrap;
  }

  .ct__linha .ui-linha__fim {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
