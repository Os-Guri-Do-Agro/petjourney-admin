/**
 * Todas as rotas da demonstração, por área. Cada arquivo registra as suas com `rota()`.
 */
import { registrarAgenda } from './agenda'
import { registrarCadastro } from './cadastro'
import { registrarInternacao } from './internacao'
import { registrarNucleo } from './nucleo'
import { registrarPaineis } from './paineis'
import { registrarPortal } from './portal'
import { registrarProntuario } from './prontuario'
import { registrarVacinasEstoque } from './vacinas-estoque'

export function registrarRotas() {
  registrarNucleo()
  registrarPortal()
  registrarCadastro()
  registrarAgenda()
  registrarProntuario()
  registrarInternacao()
  registrarVacinasEstoque()
  registrarPaineis()
}
