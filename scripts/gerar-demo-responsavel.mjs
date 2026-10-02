/**
 * Gera os dados de demonstração do módulo clínico no app do responsável.
 *
 * O app monta o mock dele a partir do contrato (`src/features/clinico/contrato/responsavel.ts`)
 * e deste JSON — que sai do mesmo dataset que o portal mostra, projetado para a Fátima como a
 * API projetaria (`src/features/clinico/data/projecao-do-responsavel.ts`). Assim a demonstração
 * passa do portal para o celular sem trocar de história: a mesma Pérola, os mesmos horários, a
 * mesma oferta de vaga.
 *
 *   npm run contrato:demo
 *
 * O instante é fixo, e não o da hora em que se roda o script: 07:30 do dia âncora. É meia hora
 * antes do prazo de cancelamento da consulta das 10:00 da Pérola — a demonstração mostra a
 * pré-consulta aberta, o cancelamento ainda possível e a oferta da Brunilda correndo. Gerado à
 * tarde, o mesmo JSON traria a consulta já passada e a pré-consulta fechada.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createJiti } from 'jiti'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const jiti = createJiti(import.meta.url, { alias: { '@': resolve(raiz, 'src') } })

const clinico = (caminho) => jiti.import(resolve(raiz, 'src/features/clinico', caminho))

const { calcularAncora, gerarDataset } = await clinico('data/seed.ts')
const { montarDemoDoResponsavel } = await clinico('data/projecao-do-responsavel.ts')
const { RESPONSAVEL_DA_DEMONSTRACAO } = await clinico('data/seed-responsavel.ts')
const { createClinicClock, setClockSkew } = await clinico('domain/clinic-time.ts')
const { CLINIC_UTC_OFFSET } = await clinico('data/fixtures/index.ts')

const pt = JSON.parse(readFileSync(resolve(raiz, 'src/locales/pt.json'), 'utf8'))
const documentos = pt.clinico.documentos

const INSTANTE_DA_DEMONSTRACAO = 7 * 60 + 30

const clock = createClinicClock(CLINIC_UTC_OFFSET)
const ancora = calcularAncora(clock.today())

/* O mesmo deslocamento que o painel de desenvolvimento usa para viajar no tempo. */
setClockSkew(Date.parse(clock.toIso(ancora, INSTANTE_DA_DEMONSTRACAO)) - Date.now())

const dataset = gerarDataset()
const agora = clock.nowIso()

const demo = montarDemoDoResponsavel({
  dataset,
  tutorId: RESPONSAVEL_DA_DEMONSTRACAO,
  agora,
  textos: {
    /*
     * Não mora no catálogo do portal porque o portal não o mostra: é texto que a API escreve no
     * idioma da clínica, ao achatar o diagnóstico presuntivo para o responsável.
     */
    emInvestigacao: 'em investigação',
    sinaisDeAlerta: `${documentos.orientacoes.procureTitulo}: ${lowerFirst(documentos.orientacoes.procureTexto)}`,
    tituloDoDocumento: {
      RECEITUARIO: documentos.cartao.receituario.titulo,
      ORIENTACOES: documentos.orientacoes.titulo,
      PEDIDO_EXAME: documentos.pedidoExame.titulo,
    },
  },
})

const destino = resolve(raiz, 'docs/clinico/contrato/demo-responsavel.json')

mkdirSync(dirname(destino), { recursive: true })
writeFileSync(destino, `${JSON.stringify(demo, null, 2)}\n`)

console.log(`${relative(raiz, destino)} (${demo.hojeDaClinica}, gerado ${demo.geradoEm})`)
console.log(
  [
    `${demo.pets.length} pets`,
    `${demo.agendamentos.length} agendamentos`,
    `${demo.preConsultas.length} pré-consultas`,
    `${demo.fila.length} na fila`,
    `${demo.atendimentos.length} atendimentos`,
    `${demo.vacinas.length} vacinas`,
    `${demo.internacoes.length} internações (${demo.boletins.length} boletins)`,
    `${demo.horariosLivres.length} horários livres`,
    `${demo.notificacoes.length} notificações`,
  ].join(' · '),
)

// ---------------------------------------------------------------------------
// O momento da carteirinha conectada
// ---------------------------------------------------------------------------

/*
 * O "depois" da demonstração: a clínica aplica a segunda V10 do Biscoito, com o lote que o
 * diálogo sugere e a terceira dose já marcada. O arquivo traz o que o celular recebe nesse
 * instante — a linha nova, o plano avançado, o aviso e o horário —, para o mock do app
 * reproduzir a mudança "na hora" sem depender do portal aberto ao lado (doc 14, seção 7).
 *
 * Roda sobre o dataset do repositório (`getDataset`), e não sobre o `dataset` de cima, porque é
 * o repositório que aplica: lote conferido, próxima dose congelada, horário gravado. Uma cópia
 * montada à mão aqui seria uma segunda regra para a mesma aplicação.
 */
const { setMockConfig } = await clinico('data/mock-runtime.ts')
const { getDataset } = await clinico('data/store.ts')
const { agendaRepository, vacinaRepository } = await clinico('data/repositories/index.ts')
const { projetarAgendamento } = await clinico('data/projecao-do-responsavel.ts')
const { PET_EM_PROTOCOLO } = await clinico('data/seed-vacinacao.ts')

setMockConfig({ latenciaMs: 0, jitterMs: 0 })

const hoje = clock.today()
const [lote] = (await vacinaRepository.lotesParaAplicar('vac-v10')).filter((item) => item.sugerido)
const [horario] = await agendaRepository.sugerirRetorno({
  petId: PET_EM_PROTOCOLO,
  professionalId: 'prof-ana',
  typeId: 'tipo-vacina',
  aPartirDe: hoje,
  emDias: 28,
  tolerancia: 6,
  limite: 1,
})

const aplicacao = await vacinaRepository.aplicar({
  petId: PET_EM_PROTOCOLO,
  vacinaId: 'vac-v10',
  professionalId: 'prof-ana',
  lote: lote.codigo,
  validadeLote: lote.validade,
  dose: 2,
  dosesNaSerie: 3,
  via: 'subcutanea',
  observacao: '',
  encounterId: null,
  proximaNaAgenda: horario
    ? { professionalId: horario.professionalId, inicio: horario.inicio, fim: horario.fim }
    : null,
})

const carteirinha = await vacinaRepository.naCarteirinha(PET_EM_PROTOCOLO)
const marcado = getDataset().appointments.find((item) => item.id === aplicacao.agendamentoDaProximaId)

const depois = {
  geradoEm: agora,
  hojeDaClinica: demo.hojeDaClinica,
  petId: PET_EM_PROTOCOLO,
  /* A linha nova da carteira, o plano inteiro depois dela, o aviso e o horário marcado. */
  vacina: carteirinha.vacinas.find((item) => item.id === aplicacao.id),
  plano: carteirinha.plano,
  notificacao: carteirinha.ultimaNotificacao,
  agendamento: marcado
    ? projetarAgendamento(marcado, {
        dataset: getDataset(),
        tutorId: RESPONSAVEL_DA_DEMONSTRACAO,
        agora,
        textos: {
          emInvestigacao: '',
          sinaisDeAlerta: '',
          tituloDoDocumento: { RECEITUARIO: '', ORIENTACOES: '', PEDIDO_EXAME: '' },
        },
      })
    : null,
}

const destinoDoDepois = resolve(raiz, 'docs/clinico/contrato/demo-carteirinha-aplicacao.json')

writeFileSync(destinoDoDepois, `${JSON.stringify(depois, null, 2)}\n`)

console.log(
  `${relative(raiz, destinoDoDepois)} (V10 ${aplicacao.dose}/${aplicacao.dosesNaSerie} do Biscoito, lote ${aplicacao.lote}, próxima ${marcado?.inicio ?? 'sem horário'})`,
)

function lowerFirst(texto) {
  return texto.charAt(0).toLocaleLowerCase('pt-BR') + texto.slice(1)
}
