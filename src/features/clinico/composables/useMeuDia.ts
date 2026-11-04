/**
 * Os dados do Hoje da Clínica, separados do desenho.
 *
 * Quem está na sala, quem espera na recepção, quem vem depois e o que pede ação. A conta mora
 * aqui, e o desenho (`MeuDiaFoco`) só lê: mudar o layout nunca muda a resposta.
 *
 * Volta um `reactive`: o layout recebe o objeto inteiro como prop e lê `dia.naRecepcao` direto no
 * template, sem `.value`.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, type RouteLocationRaw } from 'vue-router'

import { porGravidade, type LinhaDaTabela } from '@/components/home/pauta-tabela'
import type { IndicadorDaAbertura } from '@/components/ui/UiAbertura.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { encounterRepository } from '@/features/clinico/data/repositories'
import type { Appointment, Pet } from '@/features/clinico/data/types'
import { retornosVencidos, type RetornoPendente } from '@/features/clinico/domain/follow-up'
import { umPorGrupo } from '@/features/clinico/domain/load'
import { useAgendaStore } from '@/features/clinico/stores/agenda'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useInternacaoStore } from '@/features/clinico/stores/internacao'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

const ENCERRADOS: Appointment['status'][] = ['cancelado', 'falta', 'finalizado']

export function useMeuDia() {
  const { t, locale } = useI18n()
  const router = useRouter()
  const agenda = useAgendaStore()
  const clinico = useClinicoStore()
  const internacao = useInternacaoStore()
  const formato = useClinicFormat()

  const retornosPendentes = ref<RetornoPendente[]>([])

  const emConsulta = computed(() =>
    umPorGrupo(
      agenda.atendimentos
        .filter((item) => item.status === 'em-atendimento')
        .sort((a, b) => (a.iniciadoEm ?? a.inicio).localeCompare(b.iniciadoEm ?? b.inicio)),
    ),
  )

  const naRecepcao = computed(() =>
    agenda.atendimentos
      .filter((item) => item.status === 'aguardando')
      .sort((a, b) => (a.chegadaEm ?? a.inicio).localeCompare(b.chegadaEm ?? b.inicio)),
  )

  /** O que ainda não começou, do mais cedo para o mais tarde — inclusive o encaixe de agora. */
  const aSeguir = computed(() => {
    const instante = clinicClock.nowIso()

    return umPorGrupo(
      agenda.atendimentos
        .filter(
          (item) =>
            item.inicio > instante &&
            !ENCERRADOS.includes(item.status) &&
            item.status !== 'em-atendimento' &&
            item.status !== 'aguardando',
        )
        .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    )
  })

  /**
   * O paciente da ação principal: o primeiro que está na sala, ou o primeiro da recepção, ou o
   * próximo horário. É o "e agora?" de quem acabou de chegar ao computador.
   */
  const destaque = computed(
    () => emConsulta.value[0] ?? naRecepcao.value[0] ?? aSeguir.value[0] ?? null,
  )

  /**
   * Alerta que muda conduta hoje: só de risco e atenção. Cada paciente da fila leva os seus na
   * própria linha; a pauta ao lado não os repete.
   */
  function alertasRelevantes(pet: Pet | null | undefined) {
    return pet ? pet.alertas.filter((alerta) => alerta.severidade !== 'info') : []
  }

  function textoDoAlerta(alerta: Pet['alertas'][number]) {
    return alerta.detalhe
      ? `${formato.alerta(alerta.kind)}: ${alerta.detalhe}`
      : formato.alerta(alerta.kind)
  }

  /** Os internados que cobram alguma coisa **agora**: boletim retido primeiro, depois doses. */
  const internadosComPendencia = computed(() =>
    (internacao.mapa?.leitos ?? [])
      .filter((item) => item.internacao !== null && (item.atrasadas > 0 || item.boletimRetido))
      .sort(
        (a, b) => Number(b.boletimRetido) - Number(a.boletimRetido) || b.atrasadas - a.atrasadas,
      ),
  )

  function focoNaAgenda(appointmentId: string): RouteLocationRaw {
    return { path: '/clinica/agenda', query: { foco: appointmentId } }
  }

  function rotaDoProntuario(appointment: Appointment) {
    return appointment.encounterId
      ? `/clinica/atendimento/${appointment.encounterId}`
      : `/clinica/atendimento/novo-${appointment.id}`
  }

  function rotaDoResumo(appointment: Appointment) {
    return `/clinica/paciente/${appointment.petId}/resumo`
  }

  function abrirProntuario(appointment: Appointment) {
    void router.push(rotaDoProntuario(appointment))
  }

  /** "Lola, Nina e mais 4": os primeiros nomes dizem de quem se trata sem abrir a outra tela. */
  function nomesComResto(nomes: string[], mostrar = 2) {
    const visiveis = nomes.slice(0, mostrar).join(', ')
    const resto = nomes.length - mostrar

    return resto > 0 ? t('clinico.meuDia.pauta.eMais', { nomes: visiveis, total: resto }) : visiveis
  }

  function rostoDe(pet: ReturnType<typeof clinico.pet>): LinhaDaTabela['pet'] {
    return pet
      ? { nome: pet.nome, iniciais: pet.iniciais, especie: pet.especie, fotoUrl: pet.fotoUrl }
      : undefined
  }

  /**
   * O que pede ação e **não está na fila**: a internação (boletim retido, doses atrasadas) e os
   * retornos vencidos. Quem espera na recepção e o alerta de quem vem já estão na lista "Quem vem
   * depois", ao lado, com a mesma informação; repetir os dois aqui dobrava o texto da tela (03/11).
   */
  const linhasDaPauta = computed<LinhaDaTabela[]>(() => {
    const linhas: LinhaDaTabela[] = []
    const ondeInternacao = t('inicio.pauta.onde.internacao')

    for (const item of internadosComPendencia.value) {
      const to = `/clinica/internacao/${item.internacao!.id}`
      const doses = t('clinico.meuDia.pauta.doses', { total: item.atrasadas }, item.atrasadas)

      linhas.push(
        item.boletimRetido
          ? {
              id: `boletim-${item.leito.id}`,
              to,
              frase: t('clinico.meuDia.pauta.boletim', { pet: item.petNome }),
              detalhe: [item.leito.nome, item.atrasadas > 0 ? doses : '']
                .filter(Boolean)
                .join(' · '),
              tom: 'risco',
              onde: ondeInternacao,
              pet: rostoDe(clinico.pet(item.internacao!.petId)),
            }
          : {
              id: `doses-${item.leito.id}`,
              to,
              frase: `${item.petNome}: ${doses}`,
              detalhe: item.leito.nome,
              tom: 'risco',
              onde: ondeInternacao,
              pet: rostoDe(clinico.pet(item.internacao!.petId)),
            },
      )
    }

    const retornos = retornosPendentes.value.length

    if (retornos > 0) {
      linhas.push({
        id: 'retornos',
        to: '/clinica/atividades',
        frase: t('clinico.meuDia.pauta.retornos', { total: retornos }, retornos),
        detalhe: nomesComResto(
          retornosPendentes.value.map((item) => clinico.pet(item.encounter.petId)?.nome ?? ''),
        ),
        tom: 'neutro',
        onde: t('inicio.pauta.onde.atividades'),
      })
    }

    return porGravidade(linhas)
  })

  const urgentes = computed(() => linhasDaPauta.value.filter((linha) => linha.tom === 'risco'))

  /** O que espera por alguém nesta tela: a pauta ao lado e quem está na recepção, na fila. */
  const fraseDoResumo = computed(() => {
    const total = linhasDaPauta.value.length + naRecepcao.value.length

    if (urgentes.value.length > 0) {
      return t(
        'clinico.meuDia.resumo.urgentes',
        { total: urgentes.value.length },
        urgentes.value.length,
      )
    }

    if (total > 0) {
      return t('clinico.meuDia.resumo.pendentes', { total }, total)
    }

    return t('clinico.meuDia.resumo.emDia')
  })

  /**
   * O dia que a agenda carregou, e não o relógio lido uma vez: assim a data acompanha a virada da
   * meia-noite e o relógio deslocado. Meio-dia, para o fuso do navegador não puxar para outro dia.
   */
  const dataDeHoje = computed(() => {
    const intl = INTL_LOCALE[locale.value as Locale]
    const rotulo = new Date(clinicClock.toIso(agenda.data, 12 * 60)).toLocaleDateString(intl, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })

    return rotulo.charAt(0).toLocaleUpperCase(intl) + rotulo.slice(1)
  })

  /** A ação principal muda com o momento: continuar quem está na sala, ou começar o próximo. */
  const acaoPrincipal = computed(() => {
    const item = destaque.value

    if (!item) {
      return null
    }

    const nome = clinico.pet(item.petId)?.nome ?? ''

    return {
      rotulo:
        item.status === 'em-atendimento'
          ? t('clinico.meuDia.continuarCom', { pet: nome })
          : t('clinico.meuDia.atenderCom', { pet: nome }),
      item,
    }
  })

  /** Minutos desde um instante, para o número grande da espera e da consulta. */
  function minutosDesde(iso: string | null) {
    if (!iso) {
      return null
    }

    return Math.max(0, Math.round((Date.parse(clinicClock.nowIso()) - Date.parse(iso)) / 60_000))
  }

  function profissionaisDe(item: Appointment) {
    const nomes = item.linkedGroupId
      ? agenda.atendimentos
          .filter((outro) => outro.linkedGroupId === item.linkedGroupId)
          .map((outro) => clinico.profissional(outro.professionalId)?.nome)
      : [clinico.profissional(item.professionalId)?.nome]

    return [...new Set(nomes.filter(Boolean))].join(', ')
  }

  function linhaDoAtendimento(item: Appointment) {
    return [clinico.tipo(item.typeId)?.nome, profissionaisDe(item)].filter(Boolean).join(' · ')
  }

  /**
   * O atendimento do cartão do destaque numa linha curta: o serviço, o primeiro profissional (com
   * "+1" quando a cirurgia tem equipe) e a sala. Os nomes inteiros moram no prontuário.
   */
  function linhaCurtaDoAtendimento(item: Appointment) {
    const nomes = profissionaisDe(item).split(', ').filter(Boolean)
    const equipe = nomes.length > 1 ? `${nomes[0]} +${nomes.length - 1}` : (nomes[0] ?? '')

    return [clinico.tipo(item.typeId)?.nome, equipe, salasDe(item)].filter(Boolean).join(' · ')
  }

  /** "Cão · Shih-tzu · 6 anos": quem é o paciente, numa linha. */
  function linhaDoPaciente(pet: Pet | null) {
    return pet
      ? [formato.especie(pet.especie), pet.raca, formato.idade(pet.nascimento)]
          .filter(Boolean)
          .join(' · ')
      : ''
  }

  function salasDe(item: Appointment) {
    return item.roomIds
      .map((id) => clinico.sala(id)?.nome)
      .filter(Boolean)
      .join(', ')
  }

  /**
   * Quantos atendimentos do dia já terminaram: a barra do resumo. Sem cancelados e sem faltas,
   * a mesma conta do Início e da Agenda; com a falta no total, a barra nunca chegava ao fim.
   */
  const progressoDoDia = computed(() => {
    const doDiaSemCancelados = umPorGrupo(
      agenda.atendimentos.filter((item) => item.status !== 'cancelado' && item.status !== 'falta'),
    )

    return {
      feitos: doDiaSemCancelados.filter((item) => item.status === 'finalizado').length,
      total: doDiaSemCancelados.length,
    }
  })

  /** "6 de 38 atendimentos feitos hoje": o ritmo do dia, embaixo da frase principal. */
  const andamentoDoDia = computed(() => {
    const { feitos, total } = progressoDoDia.value

    return total ? t('inicio.espacos.clinica.andamento', { feitos, total }, total) : ''
  })

  const internados = computed(
    () => (internacao.mapa?.leitos ?? []).filter((item) => item.internacao !== null).length,
  )

  /** Os quatro números que decidem o que fazer primeiro, cada um levando à tela dele. */
  const indicadores = computed<IndicadorDaAbertura[]>(() => [
    {
      id: 'recepcao',
      valor: naRecepcao.value.length,
      rotulo: t('inicio.espacos.clinica.recepcao'),
      icone: 'ph ph-door-open',
      to: '/clinica/agenda',
      tom: naRecepcao.value.length ? 'atencao' : undefined,
    },
    {
      id: 'consulta',
      valor: emConsulta.value.length,
      rotulo: t('inicio.espacos.clinica.consulta'),
      icone: 'ph ph-stethoscope',
      to: '/clinica/agenda',
    },
    {
      id: 'internados',
      valor: internados.value,
      rotulo: t('clinico.meuDia.abertura.internados', internados.value),
      icone: 'ph ph-bed',
      to: '/clinica/internacao',
      tom: internadosComPendencia.value.length ? 'risco' : undefined,
    },
    {
      id: 'a-seguir',
      valor: aSeguir.value.length,
      rotulo: t('inicio.espacos.clinica.aSeguir'),
      icone: 'ph ph-clock',
      to: '/clinica/agenda',
    },
  ])

  const erroTraduzido = computed(() => (agenda.erro ? t(agenda.erro) : ''))
  /*
   * Carregando até o dia de hoje chegar. Antes, enquanto o catálogo carregava (a agenda ainda nem
   * tinha começado), a tela já desenhava "Nada parado", "Ninguém na sala" e três zeros: mentira
   * que piscava na abertura e ficava parada enquanto a rede demorava. Vale também para o dia de
   * outra data, pedido antes na agenda, até o de hoje chegar.
   */
  const carregando = computed(() => !agenda.erro && agenda.dia?.data !== agenda.data)

  async function carregar() {
    await clinico.carregar()
    agenda.hoje()
    await agenda.carregarDia()

    /*
     * O mapa de leitos entra fora do `await` em sequência: é o único bloco desta tela que não
     * pertence à agenda, e prendê-lo atrás dela faria a tela esperar duas viagens para desenhar.
     */
    const mapa = internacao.carregarMapa()

    retornosPendentes.value = retornosVencidos(
      await encounterRepository.listarRetornosPendentes(),
      clinicClock,
      clinicClock.today(),
    )

    await mapa
  }

  onMounted(carregar)

  return reactive({
    carregando,
    erro: erroTraduzido,
    emConsulta,
    naRecepcao,
    aSeguir,
    destaque,
    linhasDaPauta,
    fraseDoResumo,
    dataDeHoje,
    andamentoDoDia,
    progressoDoDia,
    acaoPrincipal,
    indicadores,
    pet: clinico.pet,
    tutor: clinico.tutor,
    alertasRelevantes,
    textoDoAlerta,
    minutosDesde,
    linhaDoAtendimento,
    linhaCurtaDoAtendimento,
    linhaDoPaciente,
    salasDe,
    focoNaAgenda,
    rotaDoProntuario,
    rotaDoResumo,
    abrirProntuario,
    carregar,
  })
}

export type MeuDia = ReturnType<typeof useMeuDia>
