/**
 * As famílias que completam a base da clínica de exemplo: uma clínica com quatro veterinários não
 * vive de 45 clientes. Sem elas, cada pet voltava a cada dois dias na agenda e o histórico não
 * parecia de verdade. São geradas pelo sorteio (as mesmas a cada carga), sem foto, com espécies na
 * proporção de uma clínica de cães e gatos que também atende exóticos.
 *
 * As 45 famílias escritas à mão (`cadastro.ts`) continuam as protagonistas: são elas que têm foto,
 * alertas, internação e as histórias das outras áreas.
 */
import type { Paciente } from '@/service/parceiro/pacientes-service'

import { criarSorteio } from '../aleatorio'

export type PetGerado = {
  nome: string
  especie: Paciente['especie']
  especieOutra?: string
  raca: string | null
  sexo: 'MACHO' | 'FEMEA'
  nascimento: string
  porte: Paciente['porte']
  peso: number
  castrado: boolean
}

export type FamiliaGerada = {
  nome: string
  bairro: string
  cep: string
  /** Quantos meses antes de hoje entrou na clínica (0 = este mês). */
  mesesDeCasa: number
  pets: PetGerado[]
}

const NOMES = [
  'Ana',
  'Beatriz',
  'Bruna',
  'Carla',
  'Cecília',
  'Débora',
  'Eduarda',
  'Elisa',
  'Fernanda',
  'Gabriela',
  'Giovana',
  'Heloísa',
  'Ingrid',
  'Joana',
  'Júlia',
  'Karina',
  'Laura',
  'Letícia',
  'Lúcia',
  'Luana',
  'Manuela',
  'Márcia',
  'Mariana',
  'Melissa',
  'Natália',
  'Olívia',
  'Paula',
  'Raquel',
  'Rebeca',
  'Regina',
  'Renata',
  'Sabrina',
  'Sandra',
  'Sofia',
  'Tatiana',
  'Valéria',
  'Vera',
  'Viviane',
  'Yasmin',
  'Zélia',
  'Adriano',
  'Alberto',
  'André',
  'Antônio',
  'Arthur',
  'Caio',
  'Carlos',
  'Cláudio',
  'Daniel',
  'Davi',
  'Diego',
  'Douglas',
  'Emanuel',
  'Fábio',
  'Felipe',
  'Francisco',
  'Guilherme',
  'Gustavo',
  'Hugo',
  'Igor',
  'Joaquim',
  'Jorge',
  'José',
  'Leandro',
  'Lucas',
  'Marcelo',
  'Mário',
  'Mateus',
  'Miguel',
  'Murilo',
  'Nelson',
  'Otávio',
  'Pedro',
  'Ricardo',
  'Roberto',
  'Rodrigo',
  'Samuel',
  'Sérgio',
  'Tiago',
  'Vítor',
]

const SOBRENOMES = [
  'Almeida',
  'Amaral',
  'Andrade',
  'Araújo',
  'Azevedo',
  'Barbosa',
  'Barros',
  'Bezerra',
  'Borges',
  'Cardoso',
  'Carvalho',
  'Castro',
  'Cavalcanti',
  'Correia',
  'Costa',
  'Cruz',
  'Dantas',
  'Dias',
  'Duarte',
  'Esteves',
  'Farias',
  'Ferraz',
  'Ferreira',
  'Fonseca',
  'Freire',
  'Gomes',
  'Guimarães',
  'Lacerda',
  'Leite',
  'Lima',
  'Lopes',
  'Macedo',
  'Machado',
  'Marques',
  'Martins',
  'Medeiros',
  'Mello',
  'Mendes',
  'Miranda',
  'Monteiro',
  'Moraes',
  'Moreira',
  'Moura',
  'Nascimento',
  'Neves',
  'Nogueira',
  'Oliveira',
  'Pacheco',
  'Paiva',
  'Pereira',
  'Pinheiro',
  'Prado',
  'Queiroz',
  'Ramos',
  'Rezende',
  'Ribeiro',
  'Rocha',
  'Sales',
  'Sampaio',
  'Santana',
  'Santos',
  'Silva',
  'Siqueira',
  'Soares',
  'Souza',
  'Tavares',
  'Teixeira',
  'Toledo',
  'Vasconcelos',
  'Vieira',
]

const BAIRROS: Array<[string, string]> = [
  ['Vila Madalena', '05433'],
  ['Pinheiros', '05422'],
  ['Perdizes', '05015'],
  ['Sumaré', '01255'],
  ['Pompeia', '05024'],
  ['Lapa', '05068'],
  ['Alto de Pinheiros', '05447'],
  ['Vila Beatriz', '05445'],
  ['Sumarezinho', '05439'],
  ['Jardim Paulistano', '01452'],
  ['Butantã', '05503'],
  ['Vila Leopoldina', '05305'],
]

const NOMES_DE_CAO = [
  'Apolo',
  'Aurora',
  'Babalu',
  'Barney',
  'Biju',
  'Bilu',
  'Bisteca',
  'Blue',
  'Bolota',
  'Boris',
  'Brownie',
  'Buddy',
  'Caramelo',
  'Charlie',
  'Chiquinho',
  'Chocolate',
  'Cristal',
  'Dalila',
  'Dama',
  'Dexter',
  'Dóris',
  'Duda',
  'Elvis',
  'Estopa',
  'Faro',
  'Fênix',
  'Fofa',
  'Frederico',
  'Gaia',
  'Gordo',
  'Hachi',
  'Íris',
  'Jack',
  'Jasmim',
  'Joca',
  'Jolie',
  'Juca',
  'Kenai',
  'Kiko',
  'Lalá',
  'Laika',
  'Leão',
  'Léo',
  'Lindinha',
  'Lobo',
  'Lola',
  'Lupi',
  'Madalena',
  'Maggie',
  'Malu',
  'Manchinha',
  'Margarida',
  'Maria',
  'Meg',
  'Mike',
  'Milo',
  'Moana',
  'Nego',
  'Nick',
  'Nikita',
  'Ninoca',
  'Oliver',
  'Ônix',
  'Oreo',
  'Otto',
  'Pandinha',
  'Pepita',
  'Petúnia',
  'Pituca',
  'Polenta',
  'Preta',
  'Quindim',
  'Raja',
  'Ralf',
  'Romeu',
  'Ruiva',
  'Sasha',
  'Serena',
  'Simba',
  'Sky',
  'Sophie',
  'Tainá',
  'Thomas',
  'Tina',
  'Tufão',
  'Vida',
  'Vitória',
  'Willy',
  'Xodó',
  'Yoda',
  'Zeca',
  'Zoe',
  'Bob',
  'Lua',
  'Thor',
  'Pandora',
  'Fred',
  'Mel',
  'Lili',
  'Billy',
  'Jade',
  'Marley',
  'Bela',
  'Fumaça',
  'Zara',
  'Bento',
  'Kira',
  'Pipoca',
  'Baby',
  'Bruno',
  'Lady',
  'Tobby',
  'Flora',
  'Dino',
  'Cindy',
  'Scooby',
  'Lara',
  'Pingo',
  'Pérola',
  'Rocky',
  'Sansão',
  'Nicole',
  'Paçoca',
  'Juju',
  'Bolinha',
  'Feijão',
  'Cookie',
  'Amendoim',
  'Banguela',
  'Chiquinha',
  'Fiona',
  'Kiara',
  'Mila',
  'Ted',
  'Pudim',
  'Brisa',
  'Luke',
]

const NOMES_DE_GATO = [
  'Ágata',
  'Alecrim',
  'Amarula',
  'Aslan',
  'Belchior',
  'Biscoito',
  'Bóris',
  'Canela',
  'Caju',
  'Catarina',
  'Chanel',
  'Cocada',
  'Cosmo',
  'Docinho',
  'Fubá',
  'Gaspar',
  'Gigi',
  'Guga',
  'Jabuticaba',
  'Lasanha',
  'Lince',
  'Lola',
  'Luiza',
  'Mafalda',
  'Magali',
  'Merlin',
  'Miau',
  'Mocha',
  'Nala',
  'Nescau',
  'Nhoque',
  'Ozzy',
  'Pipa',
  'Princesa',
  'Puma',
  'Rajado',
  'Sardinha',
  'Sombra',
  'Toddy',
  'Tom Jobim',
  'Vovó',
  'Xuxa',
  'Zelda',
  'Zorro',
  'Mimi',
  'Félix',
  'Nina',
  'Tom',
  'Frajola',
  'Luna',
  'Salem',
  'Bolinha',
  'Cléo',
  'Mingau',
  'Fumaça',
  'Garfield',
  'Pantera',
  'Branquinha',
  'Chico',
  'Dengo',
  'Lilo',
  'Tigre',
  'Olívia',
  'Pipoca',
  'Tapioca',
  'Nuvem',
  'Zeca',
  'Belinha',
  'Sushi',
  'Mel',
  'Jujuba',
  'Capitu',
  'Orelha',
  'Pudim',
]

const RACAS_DE_CAO: Array<[string, Paciente['porte'], [number, number]]> = [
  ['SRD', 'MEDIO', [10, 22]],
  ['SRD', 'PEQUENO', [5, 10]],
  ['Shih-tzu', 'PEQUENO', [4.5, 8]],
  ['Yorkshire', 'MINI', [2, 3.5]],
  ['Labrador Retriever', 'GRANDE', [26, 36]],
  ['Golden Retriever', 'GRANDE', [27, 35]],
  ['Buldogue francês', 'PEQUENO', [9, 14]],
  ['Spitz alemão', 'MINI', [2, 4]],
  ['Poodle', 'PEQUENO', [4, 8]],
  ['Lhasa Apso', 'PEQUENO', [5, 8]],
  ['Beagle', 'MEDIO', [10, 15]],
  ['Border Collie', 'MEDIO', [15, 22]],
  ['Pastor-alemão', 'GRANDE', [28, 40]],
  ['Dachshund', 'PEQUENO', [6, 10]],
  ['Pug', 'PEQUENO', [7, 10]],
  ['Maltês', 'MINI', [2.5, 4]],
  ['Schnauzer', 'PEQUENO', [6, 9]],
  ['Pit bull', 'GRANDE', [22, 32]],
]

const RACAS_DE_GATO = [
  'SRD',
  'SRD',
  'SRD',
  'Siamês',
  'Persa',
  'Maine Coon',
  'Angorá',
  'Ragdoll',
  'British Shorthair',
]

const EXOTICOS: Array<
  Omit<PetGerado, 'nome' | 'sexo' | 'nascimento' | 'castrado'> & { nomes: string[] }
> = [
  {
    especie: 'COELHO',
    raca: 'Mini Lop',
    porte: null,
    peso: 1.8,
    nomes: ['Algodão', 'Tambor', 'Neve', 'Bolacha'],
  },
  {
    especie: 'ROEDOR',
    raca: 'Porquinho-da-índia',
    porte: null,
    peso: 0.9,
    nomes: ['Batata', 'Grão', 'Paçoquinha'],
  },
  { especie: 'AVE', raca: 'Calopsita', porte: null, peso: 0.09, nomes: ['Piu', 'Sol', 'Limão'] },
  {
    especie: 'AVE',
    raca: 'Periquito-australiano',
    porte: null,
    peso: 0.04,
    nomes: ['Azulão', 'Kiwi'],
  },
  {
    especie: 'REPTIL',
    raca: 'Jabuti-tinga',
    porte: null,
    peso: 2.6,
    nomes: ['Lentilha', 'Matusalém'],
  },
  {
    especie: 'OUTRO',
    especieOutra: 'Furão',
    raca: null,
    porte: null,
    peso: 1.2,
    nomes: ['Faísca', 'Bandido'],
  },
]

function dataDeNascimento(sorte: ReturnType<typeof criarSorteio>, anos: number) {
  const ano = 2026 - anos
  return `${ano}-${String(sorte.inteiro(1, 12)).padStart(2, '0')}-${String(sorte.inteiro(1, 28)).padStart(2, '0')}`
}

/** Quantas vezes cada nome já saiu: um nome se repete no máximo duas vezes na base gerada. */
const USOS = new Map<string, number>()

function nomeLivre(
  sorte: ReturnType<typeof criarSorteio>,
  lista: readonly string[],
  reserva: readonly string[],
) {
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    const nome = sorte.escolher(tentativa < 20 ? lista : reserva)
    if ((USOS.get(nome) ?? 0) < 2) {
      USOS.set(nome, (USOS.get(nome) ?? 0) + 1)
      return nome
    }
  }
  return sorte.escolher(lista)
}

function petGerado(sorte: ReturnType<typeof criarSorteio>): PetGerado {
  const sexo = sorte.chance(0.5) ? 'MACHO' : 'FEMEA'
  const tipo = sorte.pesado([
    ['cao', 58],
    ['gato', 34],
    ['exotico', 8],
  ] as const)
  if (tipo === 'cao') {
    const [raca, porte, [min, max]] = sorte.escolher(RACAS_DE_CAO)
    const anos = sorte.pesado([
      [0, 8],
      [sorte.inteiro(1, 4), 45],
      [sorte.inteiro(5, 9), 32],
      [sorte.inteiro(10, 15), 15],
    ] as const)
    return {
      nome: nomeLivre(sorte, NOMES_DE_CAO, NOMES_DE_GATO),
      especie: 'CACHORRO',
      raca,
      sexo,
      nascimento: dataDeNascimento(sorte, anos),
      porte,
      peso: Math.round((min + sorte.numero() * (max - min)) * (anos === 0 ? 0.5 : 1) * 10) / 10,
      castrado: anos > 0 && sorte.chance(0.7),
    }
  }
  if (tipo === 'gato') {
    const anos = sorte.inteiro(0, 15)
    return {
      nome: nomeLivre(sorte, NOMES_DE_GATO, NOMES_DE_CAO),
      especie: 'GATO',
      raca: sorte.escolher(RACAS_DE_GATO),
      sexo,
      nascimento: dataDeNascimento(sorte, anos),
      porte: null,
      peso: Math.round((anos === 0 ? 1.6 : 3.2 + sorte.numero() * 3) * 10) / 10,
      castrado: anos > 0 && sorte.chance(0.8),
    }
  }
  const exotico = sorte.escolher(EXOTICOS)
  const { nomes, ...resto } = exotico
  return {
    ...resto,
    nome: nomeLivre(sorte, nomes, NOMES_DE_CAO),
    sexo,
    nascimento: dataDeNascimento(sorte, sorte.inteiro(1, 6)),
    castrado: false,
  }
}

/** `total` famílias novas, cujos nomes não repetem os de `usados`. */
export function gerarFamilias(total: number, usados: Set<string>): FamiliaGerada[] {
  const sorte = criarSorteio('cadastro-gerado')
  const familias: FamiliaGerada[] = []
  let tentativas = 0

  while (familias.length < total && tentativas < total * 20) {
    tentativas++
    const nome = `${sorte.escolher(NOMES)} ${sorte.escolher(SOBRENOMES)}`
    if (usados.has(nome)) continue
    usados.add(nome)
    const [bairro, prefixo] = sorte.escolher(BAIRROS)
    const quantos = sorte.pesado([
      [1, 76],
      [2, 20],
      [3, 4],
    ] as const)
    familias.push({
      nome,
      bairro,
      cep: `${prefixo}-${String(sorte.inteiro(0, 99) * 10).padStart(3, '0')}`,
      /* A maior parte é cliente antigo; alguns chegaram nos últimos meses (os "pacientes novos"). */
      mesesDeCasa: sorte.pesado([
        [0, 6],
        [1, 6],
        [2, 6],
        [sorte.inteiro(3, 12), 30],
        [sorte.inteiro(13, 40), 52],
      ] as const),
      pets: Array.from({ length: quantos }, () => petGerado(sorte)),
    })
  }

  return familias
}
