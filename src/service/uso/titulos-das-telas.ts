/**
 * O nome de cada tela do portal no registro de uso, como a equipe lê no CMS.
 *
 * A chave é o molde da rota que o `file-routes.ts` gera (`/clinica/paciente/:petId/resumo`), nunca
 * o caminho com o ID. Em português e fixo: é dado que vai para a API, não texto da tela, então não
 * passa pelo idioma da sessão. Os nomes seguem o menu (`useAppNavigation.ts`).
 *
 * Tela nova sem nome aqui faz o `titulos-das-telas.spec.ts` falhar: o mapa não envelhece calado.
 */
export const TITULOS_DAS_TELAS: Readonly<Record<string, string>> = {
  '/inicio': 'Visão geral',
  '/perfil': 'Perfil',
  '/settings': 'Configurações',

  '/parceiro/selecionar': 'Escolher empresa',
  '/parceiro/convite': 'Convite para a equipe',
  '/parceiro/programas': 'Programas',
  '/parceiro/acessos': 'Acessos',
  '/parceiro/acessos/:id': 'Acesso',
  '/parceiro/divulgacao': 'Divulgação',
  '/parceiro/carteira': 'Carteira',
  '/parceiro/carteira/saques/:id': 'Carteira · Saque',
  '/parceiro/equipe': 'Equipe',
  '/parceiro/profissionais': 'Profissionais',
  '/parceiro/auditoria': 'Auditoria',
  '/parceiro/estabelecimento': 'Estabelecimento',

  '/clinica/meu-dia': 'Hoje na clínica',
  '/clinica/agenda': 'Agenda',
  '/clinica/pedidos': 'Pedidos de horário',
  '/clinica/fila': 'Fila de espera',
  '/clinica/atendimentos': 'Atendimentos',
  '/clinica/atendimento/:encounterId': 'Atendimento',
  '/clinica/internacao': 'Internação',
  '/clinica/internacao/:internacaoId': 'Internação · Paciente internado',
  '/clinica/internacao/plantao': 'Internação · Plantão',
  '/clinica/internacao/boletins-pendentes': 'Boletins pendentes',
  '/clinica/internacao/vagas': 'Vagas da internação',
  '/clinica/atividades': 'Pendências',
  '/clinica/faltas': 'Faltas',
  '/clinica/retornos-pendentes': 'Retornos',
  '/clinica/vacinas': 'Vacinas',
  '/clinica/estoque': 'Estoque de vacinas',
  '/clinica/tratamentos': 'Tratamentos em casa',
  '/clinica/resumo': 'Resumo da clínica',
  '/clinica/configuracao': 'Configuração da clínica',
  '/clinica/pacientes': 'Pacientes',
  '/clinica/paciente/novo': 'Novo paciente',
  '/clinica/paciente/importar': 'Importar pacientes',
  '/clinica/ficha/:petId': 'Ficha do paciente',
  '/clinica/paciente/:petId/resumo': 'Paciente · Resumo',
  '/clinica/paciente/:petId/historico': 'Paciente · Histórico',
  '/clinica/paciente/:petId/tratamento': 'Paciente · Tratamento',
  '/clinica/paciente/:petId/vacinas': 'Paciente · Vacinas',
  '/clinica/correcoes': 'Pedidos de correção',
  '/clinica/bulario': 'Bulário',
  '/clinica/historico-liberado': 'Histórico liberado',
  '/clinica/copias-do-prontuario': 'Cópias do prontuário',
  '/clinica/documentos': 'Documentos da clínica',
  '/clinica/financeiro': 'Financeiro · Caixa',
  '/clinica/financeiro/contas': 'Financeiro · Contas',
  '/clinica/financeiro/notas': 'Financeiro · Notas fiscais',
  '/clinica/financeiro/repasses': 'Financeiro · Repasses',
  '/clinica/financeiro/resultado': 'Financeiro · Resultado',

  '/hotel/painel': 'Painel do dia',
  '/hotel/mapa': 'Mapa de acomodações',
  '/hotel/reservas': 'Reservas',
  '/hotel/reserva/:reservaId': 'Reserva',
  '/hotel/pedidos': 'Pedidos de reserva',
  '/hotel/hospedes': 'Hóspedes na casa',
  '/hotel/hospedagem/:hospedagemId': 'Hospedagem',
  '/hotel/rotina': 'Rotina do turno',
  '/hotel/acomodacoes': 'Acomodações',
  '/hotel/rotina-padrao': 'Rotina padrão',
  '/hotel/resumo': 'Resumo do hotel',

  '/ong/animais': 'ONG · Animais',
  '/ong/animal/:animalId': 'ONG · Ficha do animal',
  '/ong/entregas': 'ONG · Entregas',
  '/ong/perfil': 'Perfil da ONG',

  '/saude-publica': 'Saúde pública',
  '/saude-publica/painel': 'Saúde pública · Painel',
  '/saude-publica/campanhas': 'Saúde pública · Campanhas',
  '/saude-publica/campanhas/:id': 'Saúde pública · Campanha',
  '/saude-publica/ongs': 'Saúde pública · ONGs',
  '/saude-publica/piloto': 'Saúde pública · Piloto',
  '/saude-publica/relatorio': 'Saúde pública · Relatório',
}

/**
 * Telas que nunca entram no registro: as de quem ainda não entrou (login, cadastro, senha), as
 * páginas públicas do responsável, a de endereço inexistente e a vitrine de design, que é
 * ferramenta de quem desenvolve.
 */
export const TELAS_FORA_DO_REGISTRO: ReadonlySet<string> = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/agendar/:clinica',
  '/reservar/:hotel',
  '/:pathMatch(.*)*',
  '/design/clinico',
])

/** Molde sem nome cadastrado vira o próprio molde: a equipe ainda sabe onde a pessoa estava. */
export function tituloDaTela(molde: string): string {
  return TITULOS_DAS_TELAS[molde] ?? molde
}
