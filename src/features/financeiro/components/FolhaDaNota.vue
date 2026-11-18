<script setup lang="ts">
/**
 * A folha da nota fiscal para o "Baixar PDF" (protótipo): o resumo no desenho de uma NFS-e
 * (prestador, tomador, discriminação, valores e o código de verificação), que o navegador imprime ou
 * salva em PDF.
 *
 * Não é tela: mora no `body` marcada `clinic-print-root` e só existe enquanto a gaveta imprime (a
 * regra de impressão do portal mostra só ela, como a etiqueta e os relatórios da Saúde pública).
 * Papel branco nos dois temas, cores escritas por extenso. A faixa "Protótipo, sem valor fiscal"
 * vai no alto e no pé: a folha imita um documento fiscal e não pode circular como se fosse um.
 */
import { computed } from 'vue'

import { porcento, reais } from '../dados'
import {
  baseDaNota,
  cpfEscrito,
  dataCompleta,
  issDaNota,
  municipio,
  numeroDaNota,
  PADROES,
  REGIMES,
  servicoDoCodigo,
  type ConfiguracaoDaNota,
  type NotaFiscal,
} from '../notas'
import { usePrestador } from '@/features/financeiro/prestador'

const prestador = usePrestador()
const props = defineProps<{ nota: NotaFiscal; config: ConfiguracaoDaNota; geradaEm: string }>()

const servico = computed(() => servicoDoCodigo(props.nota.codigoDoServico))
const cidade = computed(() => municipio(props.config.municipio))
const sobreOAtendimento = computed(() =>
  props.nota.petNome === 'Venda no balcão'
    ? `Serviço prestado em ${dataCompleta(props.nota.competencia)}`
    : `Atendimento de ${props.nota.petNome} em ${dataCompleta(props.nota.competencia)}`,
)
</script>

<template>
  <Teleport to="body">
    <div class="clinic-print-root fn" aria-hidden="true">
      <article class="fn__papel">
        <p class="fn__prototipo">Protótipo · documento ilustrativo, sem valor fiscal</p>

        <header class="fn__cabeca">
          <div>
            <span class="fn__sobre"
              >{{ PADROES[config.padrao] }} · Município de {{ cidade.nome }}</span
            >
            <h1>Nota fiscal de serviço eletrônica</h1>
          </div>
          <dl class="fn__numero">
            <div>
              <dt>Número da nota</dt>
              <dd>{{ nota.numero !== null ? numeroDaNota(nota.numero) : 'Sem número' }}</dd>
            </div>
            <div>
              <dt>Emissão</dt>
              <dd>{{ dataCompleta(nota.emitidaEm) }} às {{ nota.hora }}</dd>
            </div>
            <div>
              <dt>Competência</dt>
              <dd>{{ dataCompleta(nota.competencia) }}</dd>
            </div>
            <div>
              <dt>Código de verificação</dt>
              <dd>{{ nota.codigoDeVerificacao ?? '—' }}</dd>
            </div>
          </dl>
        </header>

        <p v-if="nota.situacao === 'cancelada'" class="fn__carimbo">
          Nota cancelada em {{ dataCompleta(nota.cancelamento!.data) }}:
          {{ nota.cancelamento!.motivo }}
        </p>

        <section class="fn__bloco">
          <h2>Prestador do serviço</h2>
          <p>
            <strong>{{ prestador.razaoSocial }}</strong>
          </p>
          <p>
            CNPJ {{ prestador.cnpj }} · Inscrição municipal {{ config.inscricaoMunicipal }} ·
            {{ REGIMES[config.regime] }}
          </p>
          <p>{{ prestador.endereco }} · {{ cidade.nome }} · {{ prestador.telefone }}</p>
        </section>

        <section class="fn__bloco">
          <h2>Tomador do serviço</h2>
          <p>
            <strong>{{ nota.tomador.nome }}</strong>
          </p>
          <p>
            CPF {{ cpfEscrito(nota.tomador.cpf) }}
            <template v-if="nota.tomador.email"> · {{ nota.tomador.email }}</template>
          </p>
        </section>

        <section class="fn__bloco">
          <h2>Discriminação do serviço</h2>
          <table class="fn__tabela">
            <thead>
              <tr>
                <th>Serviço</th>
                <th class="fn__num">Qtd.</th>
                <th class="fn__num">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, indice) in nota.itens" :key="indice">
                <td>{{ item.nome }}</td>
                <td class="fn__num">{{ item.quantidade }}</td>
                <td class="fn__num">{{ reais(item.valor) }}</td>
              </tr>
            </tbody>
          </table>
          <p class="fn__nota">
            {{ sobreOAtendimento }}. RPS série {{ nota.serieRps }}, número
            {{ numeroDaNota(nota.numeroRps) }}.
          </p>
        </section>

        <section class="fn__bloco">
          <h2>Código do serviço</h2>
          <p>{{ servico.codigo }} – {{ servico.descricao }} (lista da Lei Complementar 116/2003)</p>
        </section>

        <section class="fn__bloco">
          <h2>Valores</h2>
          <dl class="fn__valores">
            <div>
              <dt>Valor dos serviços</dt>
              <dd>{{ reais(nota.valorDosServicos) }}</dd>
            </div>
            <div>
              <dt>Desconto incondicionado</dt>
              <dd>{{ reais(nota.desconto) }}</dd>
            </div>
            <div>
              <dt>Base de cálculo</dt>
              <dd>{{ reais(baseDaNota(nota)) }}</dd>
            </div>
            <div>
              <dt>Alíquota do ISS</dt>
              <dd>{{ porcento(nota.aliquota, 2) }}</dd>
            </div>
            <div>
              <dt>Valor do ISS</dt>
              <dd>{{ reais(issDaNota(nota)) }}</dd>
            </div>
            <div class="fn__total">
              <dt>Valor líquido da nota</dt>
              <dd>{{ reais(baseDaNota(nota)) }}</dd>
            </div>
          </dl>
          <p v-if="config.regime === 'simples'" class="fn__nota">
            Empresa optante pelo Simples Nacional: o ISS é recolhido na guia mensal do Simples.
          </p>
        </section>

        <p class="fn__pe">
          Folha gerada em {{ geradaEm }} no portal da PetJourney. Protótipo: esta folha não é
          documento fiscal e não substitui a nota da prefeitura.
        </p>
      </article>
    </div>
  </Teleport>
</template>

<style scoped>
/* Na tela, a folha nunca aparece; na impressão, a regra do portal mostra só ela. */
.fn {
  display: none;
}

.fn__papel {
  display: grid;
  gap: 12px;
  background: #fff;
  color: #40524b;
  font-size: 11.5px;
  line-height: 1.45;
}

.fn__prototipo {
  margin: 0;
  padding: 6px 10px;
  border: 1px solid #c98a2b;
  border-radius: 6px;
  background: #fdf3e2;
  color: #7a4a06;
  font-size: 10.5px;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-align: center;
  text-transform: uppercase;
}

.fn__cabeca {
  display: grid;
  align-items: end;
  gap: 16px;
  padding-bottom: 10px;
  border-bottom: 2px solid #285e4e;
  grid-template-columns: minmax(0, 1fr) auto;
}

.fn__sobre {
  color: #285e4e;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fn__papel h1 {
  margin: 2px 0 0;
  color: #142721;
  font-size: 19px;
  font-weight: 800;
}

.fn__papel h2 {
  margin: 0 0 2px;
  color: #285e4e;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fn__numero {
  display: grid;
  gap: 2px 14px;
  margin: 0;
  grid-template-columns: auto auto;
}

.fn__numero dt,
.fn__valores dt {
  font-size: 10px;
}

.fn__numero dd,
.fn__valores dd {
  margin: 0;
  color: #142721;
  font-weight: 750;
}

.fn__carimbo {
  margin: 0;
  padding: 8px 10px;
  border: 2px solid #9b2c2c;
  border-radius: 6px;
  color: #9b2c2c;
  font-size: 12px;
  font-weight: 750;
}

.fn__bloco {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid #dfe7e3;
  border-radius: 8px;
  break-inside: avoid;
}

.fn__bloco p {
  margin: 0;
}

.fn__bloco strong {
  color: #142721;
}

.fn__tabela {
  width: 100%;
  border-collapse: collapse;
}

.fn__tabela th,
.fn__tabela td {
  padding: 4px 8px 4px 0;
  border-bottom: 1px solid #dfe7e3;
  text-align: start;
}

.fn__tabela th {
  color: #142721;
  font-size: 10.5px;
}

.fn__num {
  text-align: end !important;
  white-space: nowrap;
}

.fn__nota {
  color: #5e6d67;
  font-size: 10.5px;
}

.fn__valores {
  display: grid;
  gap: 6px 12px;
  margin: 0;
  grid-template-columns: repeat(3, 1fr);
}

.fn__total dd {
  font-size: 14px;
}

.fn__pe {
  margin: 0;
  color: #5e6d67;
  font-size: 10.5px;
}
</style>
