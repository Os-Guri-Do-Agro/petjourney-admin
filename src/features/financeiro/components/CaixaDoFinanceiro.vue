<script setup lang="ts">
/**
 * Financeiro › Caixa (protótipo): o balcão. Responde a pergunta da recepção, "quem falta pagar?",
 * e deixa o resto recolhido.
 *
 * - **Para receber** (o destaque): a conta de cada atendimento que terminou, com o que foi feito e
 *   o valor; "Receber" abre a gaveta. Quem ainda está em atendimento aparece só numa linha no pé.
 * - **Caixa de hoje** (ao lado): quanto entrou, por forma, e o dinheiro que deveria estar na
 *   gaveta. Abrir, retirar e fechar o caixa moram aqui.
 * - **Internados** e **Recebidos hoje** embaixo: a conta que corre até a alta e o que já entrou.
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'

import { iniciais } from '@/components/cadastro/useRotulosDoCadastro'
import UiPagina from '@/components/ui/UiPagina.vue'
import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import {
  dataCurta,
  devidoDaConta,
  pagoDaConta,
  profissional,
  reais,
  reaisCurtos,
  totalDaConta,
  type Conta,
} from '../dados'
import { useFinanceiro, type ModoDoCaixa } from '../estado'

import AvisoDoFinanceiro from './AvisoDoFinanceiro.vue'
import CaixaGaveta from './CaixaGaveta.vue'
import NovaCobrancaGaveta from './NovaCobrancaGaveta.vue'
import PrecosGaveta from './PrecosGaveta.vue'
import ReceberContaGaveta from './ReceberContaGaveta.vue'
import SoParaQuemPode from './SoParaQuemPode.vue'

const fin = useFinanceiro()
const { mundo, perfil, paraReceber, internados, pagamentosDeHoje, porForma, recebidoHoje } = fin

const bloqueado = computed(() => perfil.value.tipo === 'veterinario')
const caixa = computed(() => mundo.value.caixa)
const aberto = computed(() => fin.caixaAberto.value)

const resumo = computed(() => {
  if (bloqueado.value) return 'O caixa do balcão'
  const partes: string[] = []
  if (caixa.value.fechadoEm) partes.push(`Caixa fechado às ${caixa.value.fechadoEm}`)
  else if (caixa.value.abertoEm) partes.push(`Caixa aberto desde ${caixa.value.abertoEm}`)
  else partes.push('O caixa ainda não abriu hoje')
  partes.push(`${reaisCurtos(recebidoHoje.value)} recebidos hoje`)
  const n = paraReceber.value.length
  partes.push(n ? `${n} ${n === 1 ? 'conta esperando' : 'contas esperando'}` : 'ninguém esperando')
  return partes.join(' · ')
})

const totalParaReceber = computed(() =>
  paraReceber.value.reduce((soma, c) => soma + devidoDaConta(c), 0),
)

function oQueFoiFeito(conta: Conta) {
  const nomes = conta.itens.map((i) => (i.quantidade > 1 ? `${i.nome} (${i.quantidade})` : i.nome))
  return nomes.length > 3
    ? `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}`
    : nomes.join(', ')
}

function deQuem(conta: Conta) {
  if (conta.origem === 'balcao') return `Balcão · ${conta.hora}`
  const vet = conta.profissionalId ? profissional(conta.profissionalId).nome : 'Banho e tosa'
  return `${vet} · terminou às ${conta.hora}`
}

// ------------------------------------------------------------------------------ gavetas

const receberAberta = ref(false)
const contaEmFoco = ref<string | null>(null)
const novaAberta = ref(false)
const precosAberta = ref(false)
const caixaAberta = ref(false)
const modoDoCaixa = ref<ModoDoCaixa>('fechar')

function receber(id: string) {
  contaEmFoco.value = id
  receberAberta.value = true
}

function abrirGavetaDoCaixa(modo: ModoDoCaixa) {
  modoDoCaixa.value = modo
  caixaAberta.value = true
}

const verRecebidos = ref(false)

const ROTULO_DA_FORMA: Record<string, string> = {
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  dinheiro: 'Dinheiro',
}
</script>

<template>
  <UiPagina :resumo="resumo">
    <template v-if="!bloqueado" #acoes>
      <Button
        type="button"
        icon="ph ph-tag"
        label="Preços e taxas"
        severity="secondary"
        outlined
        @click="precosAberta = true"
      />
      <Button
        v-if="aberto"
        type="button"
        icon="ph ph-lock-key"
        label="Fechar o caixa"
        severity="secondary"
        outlined
        @click="abrirGavetaDoCaixa('fechar')"
      />
      <Button
        v-else
        type="button"
        icon="ph ph-lock-key-open"
        label="Abrir o caixa"
        severity="secondary"
        outlined
        @click="abrirGavetaDoCaixa('abrir')"
      />
      <Button type="button" icon="ph ph-plus" label="Nova cobrança" @click="novaAberta = true" />
    </template>

    <div class="fin">
      <AvisoDoFinanceiro />

      <SoParaQuemPode v-if="bloqueado" />

      <div v-else class="cx">
        <div class="cx__principal">
          <!-- Para receber: o destaque -->
          <section class="ui-folha ui-cartao" aria-labelledby="cx-receber">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-cash-register" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="cx-receber" class="ui-cartao__titulo">
                  Para receber
                  <span v-if="paraReceber.length" class="ui-contagem">{{
                    paraReceber.length
                  }}</span>
                </h2>
                <p class="ui-cartao__descricao">
                  O atendimento terminou e a conta já chegou com o que foi feito. Confira e receba.
                </p>
              </span>
              <span v-if="paraReceber.length" class="ui-cartao__total ui-num">{{
                reais(totalParaReceber)
              }}</span>
            </header>

            <p v-if="!aberto && paraReceber.length" class="cx__fechado">
              <i class="ph ph-lock-key" aria-hidden="true" />
              <span
                >{{
                  caixa.fechadoEm ? 'O caixa de hoje já foi fechado.' : 'O caixa ainda não abriu.'
                }}
                Abra o caixa para receber.</span
              >
              <Button
                type="button"
                size="small"
                icon="ph ph-lock-key-open"
                label="Abrir o caixa"
                @click="abrirGavetaDoCaixa('abrir')"
              />
            </p>

            <ul v-if="paraReceber.length" class="ui-lista">
              <li v-for="conta in paraReceber" :key="conta.id">
                <div class="ui-linha cx__linha">
                  <PetAvatar
                    :nome="conta.petNome"
                    :iniciais="iniciais(conta.petNome)"
                    :especie="conta.especie"
                    :foto-url="conta.fotoUrl"
                    tamanho="md"
                  />
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo"
                      >{{ conta.petNome }}
                      <span class="cx__tutor">· {{ conta.tutorNome }}</span></span
                    >
                    <span class="ui-linha__meta">{{ oQueFoiFeito(conta) }}</span>
                    <span class="ui-linha__meta cx__quem">{{ deQuem(conta) }}</span>
                  </span>
                  <span class="ui-linha__fim">
                    <strong class="cx__valor ui-num">{{ reais(devidoDaConta(conta)) }}</strong>
                    <Button
                      type="button"
                      size="small"
                      icon="ph ph-cash-register"
                      label="Receber"
                      :disabled="!aberto"
                      :aria-label="`Receber de ${conta.tutorNome}`"
                      @click="receber(conta.id)"
                    />
                  </span>
                </div>
              </li>
            </ul>

            <UiVazioIlustrado
              v-else
              aninhado
              icone="ph ph-check-circle"
              titulo="Ninguém esperando para pagar"
              texto="Quando o veterinário finaliza um atendimento, a conta aparece aqui com o que foi feito e os preços da tabela."
            >
              <template #acao>
                <Button
                  type="button"
                  icon="ph ph-plus"
                  label="Nova cobrança"
                  severity="secondary"
                  outlined
                  @click="novaAberta = true"
                />
              </template>
            </UiVazioIlustrado>

            <footer v-if="mundo.emAtendimento" class="ui-cartao__pe cx__pe">
              <i class="ph ph-stethoscope" aria-hidden="true" />
              {{ mundo.emAtendimento }}
              {{
                mundo.emAtendimento === 1
                  ? 'paciente em atendimento agora: a conta dele entra'
                  : 'pacientes em atendimento agora: a conta de cada um entra'
              }}
              aqui quando o veterinário finalizar.
            </footer>
          </section>

          <!-- Internados -->
          <section
            v-if="internados.length"
            class="ui-folha ui-cartao"
            aria-labelledby="cx-internados"
          >
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-bed" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="cx-internados" class="ui-cartao__titulo">
                  Internados
                  <span class="ui-contagem">{{ internados.length }}</span>
                </h2>
                <p class="ui-cartao__descricao">
                  A conta corre até a alta: diárias, medicação e exames entram sozinhos.
                </p>
              </span>
            </header>
            <ul class="ui-lista">
              <li v-for="conta in internados" :key="conta.id">
                <div class="ui-linha cx__linha">
                  <PetAvatar
                    :nome="conta.petNome"
                    :iniciais="iniciais(conta.petNome)"
                    :especie="conta.especie"
                    :foto-url="conta.fotoUrl"
                    tamanho="md"
                  />
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo"
                      >{{ conta.petNome }}
                      <span class="cx__tutor">· {{ conta.tutorNome }}</span></span
                    >
                    <span class="ui-linha__meta">
                      Desde {{ dataCurta(conta.data) }} ·
                      {{ conta.itens[0]?.quantidade ?? 1 }} diárias até agora
                      <template v-if="pagoDaConta(conta)">
                        · {{ reais(pagoDaConta(conta)) }} adiantados</template
                      >
                    </span>
                  </span>
                  <span class="ui-linha__fim">
                    <span class="cx__corrente">
                      <strong class="ui-num">{{ reais(totalDaConta(conta)) }}</strong>
                      <small>até agora</small>
                    </span>
                    <Button
                      type="button"
                      size="small"
                      severity="secondary"
                      outlined
                      icon="ph ph-receipt"
                      label="Ver conta"
                      :disabled="!aberto"
                      @click="receber(conta.id)"
                    />
                  </span>
                </div>
              </li>
            </ul>
          </section>

          <!-- Recebidos hoje, recolhidos -->
          <section class="ui-folha ui-cartao" aria-labelledby="cx-recebidos">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-check-circle" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="cx-recebidos" class="ui-cartao__titulo">
                  Recebidos hoje
                  <span class="ui-contagem">{{ pagamentosDeHoje.length }}</span>
                </h2>
              </span>
              <span class="ui-cartao__acoes">
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  :icon="verRecebidos ? 'ph ph-caret-up' : 'ph ph-caret-down'"
                  :label="verRecebidos ? 'Recolher' : 'Ver a lista'"
                  :aria-expanded="verRecebidos"
                  aria-controls="cx-recebidos-lista"
                  @click="verRecebidos = !verRecebidos"
                />
              </span>
            </header>
            <ul v-if="verRecebidos" id="cx-recebidos-lista" class="ui-lista">
              <li v-for="{ conta, pagamento } in pagamentosDeHoje" :key="pagamento.id">
                <div class="ui-linha cx__recebido">
                  <span class="cx__hora ui-num">{{ pagamento.hora }}</span>
                  <span class="ui-linha__texto">
                    <span class="ui-linha__titulo"
                      >{{ conta.petNome }}
                      <span class="cx__tutor">· {{ conta.tutorNome }}</span></span
                    >
                  </span>
                  <span class="ui-selo">
                    <i :class="fin.condicao(pagamento.forma).icone" aria-hidden="true" />
                    {{ ROTULO_DA_FORMA[pagamento.forma]
                    }}{{ pagamento.parcelas > 1 ? ` em ${pagamento.parcelas}x` : '' }}
                  </span>
                  <strong class="cx__valor ui-num">{{ reais(pagamento.valor) }}</strong>
                </div>
              </li>
            </ul>
          </section>
        </div>

        <!-- Caixa de hoje -->
        <aside class="cx__lado">
          <section class="ui-folha ui-cartao" aria-labelledby="cx-caixa">
            <header class="ui-cartao__cabeca">
              <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-vault" /></span>
              <span class="ui-cartao__titulos">
                <h2 id="cx-caixa" class="ui-cartao__titulo">Caixa de hoje</h2>
                <p class="ui-cartao__descricao">
                  <template v-if="caixa.fechadoEm"
                    >Fechado às {{ caixa.fechadoEm }} por {{ caixa.fechadoPor }}</template
                  >
                  <template v-else-if="caixa.abertoEm"
                    >Aberto às {{ caixa.abertoEm }} por {{ caixa.abertoPor }}</template
                  >
                  <template v-else>Ainda não abriu</template>
                </p>
              </span>
              <span class="ui-selo" :class="aberto ? 'ui-selo--ok' : ''">
                <i :class="aberto ? 'ph ph-lock-key-open' : 'ph ph-lock-key'" aria-hidden="true" />
                {{ aberto ? 'Aberto' : 'Fechado' }}
              </span>
            </header>

            <div class="ui-cartao__corpo cx__caixa">
              <p class="cx__entrou">
                <strong class="ui-num">{{ reais(recebidoHoje) }}</strong>
                <span>recebidos hoje</span>
              </p>

              <ul class="cx__formas">
                <li v-for="f in porForma" :key="f.forma">
                  <i :class="f.icone" aria-hidden="true" />
                  <span class="cx__forma-nome">{{ f.nome }}</span>
                  <span class="cx__vezes">{{ f.vezes }}x</span>
                  <span class="ui-num cx__forma-valor">{{ reais(f.total) }}</span>
                </li>
              </ul>

              <div class="cx__gaveta ui-poco">
                <span class="cx__gaveta-linha">
                  <span>Dinheiro na gaveta</span>
                  <strong class="ui-num">{{ reais(fin.dinheiroNaGaveta.value) }}</strong>
                </span>
                <small>
                  Troco de {{ reais(caixa.trocoInicial) }}
                  <template v-for="m in caixa.movimentos" :key="m.id">
                    · {{ m.tipo === 'retirada' ? 'saíram' : 'entraram' }} {{ reais(m.valor) }} às
                    {{ m.hora }} ({{ m.motivo.toLowerCase() }})
                  </template>
                </small>
              </div>

              <p v-if="fin.deixadasEmAbertoHoje.value.length" class="cx__aberto">
                <i class="ph ph-hourglass-medium" aria-hidden="true" />
                {{ fin.deixadasEmAbertoHoje.value.length }}
                {{
                  fin.deixadasEmAbertoHoje.value.length === 1 ? 'conta ficou' : 'contas ficaram'
                }}
                em aberto hoje ({{
                  reais(fin.deixadasEmAbertoHoje.value.reduce((s, c) => s + devidoDaConta(c), 0))
                }}).
              </p>

              <p v-if="caixa.fechadoEm" class="cx__conferido">
                <i class="ph ph-seal-check" aria-hidden="true" />
                Conferido no fechamento{{
                  caixa.observacao ? `: ${caixa.observacao}` : ', tudo bateu.'
                }}
              </p>
            </div>

            <footer v-if="aberto" class="ui-cartao__pe">
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-arrow-up-right"
                label="Retirada"
                @click="abrirGavetaDoCaixa('retirada')"
              />
              <Button
                type="button"
                size="small"
                severity="secondary"
                outlined
                icon="ph ph-arrow-down-left"
                label="Reforço"
                @click="abrirGavetaDoCaixa('reforco')"
              />
            </footer>
          </section>
        </aside>
      </div>
    </div>

    <template #sempre>
      <ReceberContaGaveta v-model:visible="receberAberta" :conta-id="contaEmFoco" />
      <NovaCobrancaGaveta v-model:visible="novaAberta" @receber="receber" />
      <CaixaGaveta v-model:visible="caixaAberta" :modo="modoDoCaixa" />
      <PrecosGaveta v-model:visible="precosAberta" />
    </template>
  </UiPagina>
</template>

<style scoped>
/*
 * As colunas seguem a largura do conteúdo, não a da janela: com uma gaveta aberta empurrando a
 * página, a tela larga fica estreita, e a quebra por `@media` deixava as colunas se sobrepondo.
 */
.fin {
  display: grid;
  gap: 20px;
  container-type: inline-size;
}

.cx {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(19rem, 24rem);
}

.cx__principal,
.cx__lado {
  display: grid;
  min-width: 0;
  gap: 20px;
}

.cx__lado {
  position: sticky;
  top: 16px;
}

.cx__linha {
  align-items: center;
}

.cx__tutor {
  color: var(--tinta-2);
  font-weight: 500;
}

.cx__quem {
  font-size: 12.5px;
}

.cx__valor {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
}

.cx__fechado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  padding: 12px 24px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.cx__fechado span {
  flex: 1;
}

.cx__pe {
  color: var(--tinta-2);
  font-size: 13px;
}

.cx__pe i {
  font-size: 16px;
}

.cx__corrente {
  display: grid;
  justify-items: end;
}

.cx__corrente strong {
  color: var(--tinta);
  font-size: 15px;
}

.cx__corrente small {
  color: var(--tinta-2);
  font-size: 12px;
}

.cx__recebido {
  min-height: 0;
  padding-block: 10px;
}

.cx__hora {
  width: 3rem;
  color: var(--tinta-2);
  font-size: 13px;
}

.cx__caixa {
  display: grid;
  gap: 16px;
}

.cx__entrou {
  display: grid;
  gap: 2px;
  margin: 0;
}

.cx__entrou strong {
  color: var(--tinta);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.cx__entrou span {
  color: var(--tinta-2);
  font-size: 13px;
}

.cx__formas {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cx__formas li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  color: var(--tinta);
  font-size: 14px;
}

.cx__formas i {
  color: var(--tinta-2);
  font-size: 18px;
}

.cx__forma-nome {
  flex: 1;
}

.cx__vezes {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.cx__forma-valor {
  min-width: 6.5rem;
  font-weight: 650;
  text-align: end;
}

.cx__gaveta {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
}

.cx__gaveta-linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.cx__gaveta small {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.45;
}

.cx__aberto,
.cx__conferido {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.cx__aberto i {
  margin-top: 2px;
  color: var(--atencao-tinta);
}

.cx__conferido i {
  margin-top: 2px;
  color: var(--ok-tinta);
}

@container (max-width: 920px) {
  .cx {
    grid-template-columns: minmax(0, 1fr);
  }

  /* Estreito, o caixa do dia desce: quem está esperando para pagar continua sendo o primeiro. */
  .cx__lado {
    position: static;
  }
}
</style>
