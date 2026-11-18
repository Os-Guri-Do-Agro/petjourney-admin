/**
 * Clientes e pacientes da demonstração. As 45 famílias escritas aqui (55 pets de várias espécies:
 * cães, gatos, porquinho-da-índia, jabuti, calopsita, coelho, furão, hamster) são as protagonistas:
 * nove têm retrato (as fotos livres de `public/demo/pacientes`, com os créditos ao lado), e as
 * histórias das outras áreas são delas. Em volta, as famílias geradas de `cadastro-gerado.ts`
 * completam a base de uma clínica de verdade, para a agenda não repetir os mesmos pets.
 *
 * Os registros guardam o paciente quase na forma da API (`PacienteDto` sem o cliente embutido) e o
 * cliente na forma de `ClienteComAutorizadosDto`. As áreas montam o DTO da rota delas com
 * `pacienteDto`, `pacienteResumo` e `clienteDe`.
 */
import type {
  Alerta,
  Cliente,
  Paciente,
  PacienteNaLista,
} from '@/service/parceiro/pacientes-service'

import { criarSorteio } from '../aleatorio'
import { hoje, instante, somarDias } from '../relogio'
import { gerarFamilias } from './cadastro-gerado'
import { proximaFoto } from './fotos'

export type ClienteDaDemo = Cliente & { criadoEm: string }

export type PacienteDaDemo = Omit<Paciente, 'cliente'> & {
  clienteId: string
  /** O responsável usa o app e o pet está ligado à clínica por ele. */
  noApp: boolean
  criadoEm: string
}

type Especie = Paciente['especie']
type Porte = Paciente['porte']

type PetDaTabela = {
  nome: string
  especie: Especie
  raca: string | null
  sexo: 'MACHO' | 'FEMEA'
  nascimento: string
  porte: Porte
  peso: number
  castrado: boolean
  pelagem?: string
  foto?: string
  especieOutra?: string
  estimado?: boolean
  alertas?: Array<Omit<Alerta, 'id' | 'ativo'>>
  inativo?: { motivo: 'OBITO' | 'TRANSFERIDO'; em: string }
}

type FamiliaDaTabela = {
  nome: string
  bairro: string
  cep: string
  contato?: 'WHATSAPP' | 'LIGACAO' | 'EMAIL'
  autorizado?: { nome: string; relacao: string }
  pets: PetDaTabela[]
}

const FAMILIAS: FamiliaDaTabela[] = [
  {
    nome: 'Fátima Rocha',
    bairro: 'Vila Madalena',
    cep: '05433-000',
    autorizado: { nome: 'Davi Rocha', relacao: 'Filho' },
    pets: [
      {
        nome: 'Pérola',
        especie: 'GATO',
        raca: 'SRD',
        sexo: 'FEMEA',
        nascimento: '2019-04-12',
        porte: null,
        peso: 4.2,
        castrado: true,
        pelagem: 'Tricolor (escaminha)',
        foto: 'perola',
      },
      {
        nome: 'Pipoca',
        especie: 'ROEDOR',
        raca: 'Porquinho-da-índia abissínio',
        sexo: 'FEMEA',
        nascimento: '2023-05-11',
        porte: null,
        peso: 0.9,
        castrado: false,
        pelagem: 'Branco e marrom, rosetas',
        foto: 'pipoca',
      },
    ],
  },
  {
    nome: 'Ricardo Mendes',
    bairro: 'Pinheiros',
    cep: '05422-010',
    pets: [
      {
        nome: 'Thor',
        especie: 'CACHORRO',
        raca: 'Rottweiler',
        sexo: 'MACHO',
        nascimento: '2019-08-23',
        porte: 'GRANDE',
        peso: 44.2,
        castrado: false,
        pelagem: 'Preto e castanho',
        alertas: [
          {
            tipo: 'AGRESSIVO',
            severidade: 'ATENCAO',
            detalhe: 'Morde quando contido: focinheira antes do exame',
          },
        ],
      },
      {
        nome: 'Duque',
        especie: 'CACHORRO',
        raca: 'Rottweiler',
        sexo: 'MACHO',
        nascimento: '2025-01-14',
        porte: 'GRANDE',
        peso: 31.5,
        castrado: false,
      },
    ],
  },
  {
    nome: 'Luciana Campos',
    bairro: 'Perdizes',
    cep: '05014-000',
    pets: [
      {
        nome: 'Mel',
        especie: 'CACHORRO',
        raca: 'Golden Retriever',
        sexo: 'FEMEA',
        nascimento: '2016-12-05',
        porte: 'GRANDE',
        peso: 29.3,
        castrado: false,
        pelagem: 'Dourado claro, pelo longo',
        foto: 'mel',
        alertas: [{ tipo: 'GESTANTE', severidade: 'ATENCAO', detalhe: 'Gestação de 5 semanas' }],
      },
    ],
  },
  {
    nome: 'Sérgio Batista',
    bairro: 'Sumaré',
    cep: '01255-000',
    pets: [
      {
        nome: 'Biscoito',
        especie: 'CACHORRO',
        raca: 'Labrador Retriever',
        sexo: 'MACHO',
        nascimento: '2025-07-02',
        porte: 'GRANDE',
        peso: 14.8,
        castrado: false,
        pelagem: 'Preto',
        foto: 'biscoito',
      },
    ],
  },
  {
    nome: 'Tânia Moreira',
    bairro: 'Vila Madalena',
    cep: '05435-010',
    contato: 'LIGACAO',
    pets: [
      {
        nome: 'Nina',
        especie: 'CACHORRO',
        raca: 'Shih-tzu',
        sexo: 'FEMEA',
        nascimento: '2018-02-20',
        porte: 'PEQUENO',
        peso: 6.1,
        castrado: true,
        alertas: [
          { tipo: 'ALERGIA', severidade: 'RISCO', detalhe: 'Dipirona: reação grave em 2024' },
        ],
      },
    ],
  },
  {
    nome: 'Otávio Lins',
    bairro: 'Alto de Pinheiros',
    cep: '05447-000',
    pets: [
      {
        nome: 'Brunilda',
        especie: 'REPTIL',
        raca: 'Jabuti-piranga',
        sexo: 'FEMEA',
        nascimento: '2008-01-01',
        porte: null,
        peso: 3.4,
        castrado: false,
        foto: 'brunilda',
        estimado: true,
      },
    ],
  },
  {
    nome: 'Renata Figueiredo',
    bairro: 'Pompeia',
    cep: '05024-000',
    pets: [
      {
        nome: 'Cacau',
        especie: 'CACHORRO',
        raca: 'Dachshund',
        sexo: 'FEMEA',
        nascimento: '2017-09-08',
        porte: 'PEQUENO',
        peso: 8.4,
        castrado: true,
        pelagem: 'Chocolate e castanho',
        foto: 'cacau',
        alertas: [
          {
            tipo: 'CRONICO',
            severidade: 'ATENCAO',
            detalhe: 'Hérnia de disco: evitar escadas e saltos',
          },
        ],
      },
      {
        nome: 'Bento',
        especie: 'GATO',
        raca: 'Persa',
        sexo: 'MACHO',
        nascimento: '2014-03-17',
        porte: null,
        peso: 4.9,
        castrado: true,
        pelagem: 'Branco, pelo longo',
        alertas: [
          { tipo: 'CRONICO', severidade: 'ATENCAO', detalhe: 'Doença renal crônica, estágio 2' },
        ],
      },
    ],
  },
  {
    nome: 'Paulo Henrique Souza',
    bairro: 'Pinheiros',
    cep: '05416-001',
    pets: [
      {
        nome: 'Chico',
        especie: 'CACHORRO',
        raca: 'Pug',
        sexo: 'MACHO',
        nascimento: '2020-06-30',
        porte: 'PEQUENO',
        peso: 9.2,
        castrado: true,
        pelagem: 'Abricó',
        foto: 'chico',
        alertas: [
          { tipo: 'CRONICO', severidade: 'ATENCAO', detalhe: 'Braquicefálico: cuidado na sedação' },
        ],
      },
    ],
  },
  {
    nome: 'Adriana Pires',
    bairro: 'Lapa',
    cep: '05068-000',
    pets: [
      {
        nome: 'Paçoca',
        especie: 'CACHORRO',
        raca: 'SRD',
        sexo: 'MACHO',
        nascimento: '2025-03-19',
        porte: 'MEDIO',
        peso: 11.0,
        castrado: false,
        pelagem: 'Caramelo e branco',
        foto: 'pacoca',
      },
    ],
  },
  {
    nome: 'Gustavo Almeida',
    bairro: 'Vila Beatriz',
    cep: '05445-000',
    pets: [
      {
        nome: 'Duna',
        especie: 'CACHORRO',
        raca: 'Cavalier King Charles',
        sexo: 'FEMEA',
        nascimento: '2021-01-25',
        porte: 'PEQUENO',
        peso: 7.6,
        castrado: true,
        pelagem: 'Blenheim',
        foto: 'duna',
        alertas: [
          {
            tipo: 'MEDICACAO_CONTINUA',
            severidade: 'INFO',
            detalhe: 'Pimobendan 2,5 mg, 2x ao dia',
          },
        ],
      },
    ],
  },
  {
    nome: 'Beatriz Carvalho',
    bairro: 'Perdizes',
    cep: '05015-010',
    pets: [
      {
        nome: 'Luna',
        especie: 'GATO',
        raca: 'Siamês',
        sexo: 'FEMEA',
        nascimento: '2020-10-03',
        porte: null,
        peso: 3.8,
        castrado: true,
      },
      {
        nome: 'Sol',
        especie: 'GATO',
        raca: 'SRD',
        sexo: 'MACHO',
        nascimento: '2021-10-11',
        porte: null,
        peso: 5.1,
        castrado: true,
        pelagem: 'Laranja rajado',
      },
    ],
  },
  {
    nome: 'Eduardo Tavares',
    bairro: 'Vila Madalena',
    cep: '05434-020',
    pets: [
      {
        nome: 'Max',
        especie: 'CACHORRO',
        raca: 'Border Collie',
        sexo: 'MACHO',
        nascimento: '2019-05-14',
        porte: 'MEDIO',
        peso: 19.5,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Cristina Vasconcelos',
    bairro: 'Sumarezinho',
    cep: '05439-000',
    pets: [
      {
        nome: 'Kiwi',
        especie: 'AVE',
        raca: 'Calopsita',
        sexo: 'MACHO',
        nascimento: '2022-08-09',
        porte: null,
        peso: 0.09,
        castrado: false,
        pelagem: 'Cinza, face amarela',
      },
    ],
  },
  {
    nome: 'Fernando Ribeiro',
    bairro: 'Lapa',
    cep: '05075-010',
    pets: [
      {
        nome: 'Zeus',
        especie: 'CACHORRO',
        raca: 'Pastor-alemão',
        sexo: 'MACHO',
        nascimento: '2017-11-02',
        porte: 'GRANDE',
        peso: 36.0,
        castrado: false,
      },
    ],
  },
  {
    nome: 'Marcela Santos',
    bairro: 'Pinheiros',
    cep: '05419-000',
    pets: [
      {
        nome: 'Amora',
        especie: 'GATO',
        raca: 'Maine Coon',
        sexo: 'FEMEA',
        nascimento: '2022-04-18',
        porte: null,
        peso: 6.2,
        castrado: true,
      },
      {
        nome: 'Jabuticaba',
        especie: 'GATO',
        raca: 'SRD',
        sexo: 'FEMEA',
        nascimento: '2023-01-07',
        porte: null,
        peso: 3.9,
        castrado: true,
        pelagem: 'Preta',
      },
    ],
  },
  {
    nome: 'Rodrigo Pacheco',
    bairro: 'Pompeia',
    cep: '05022-000',
    pets: [
      {
        nome: 'Bolt',
        especie: 'CACHORRO',
        raca: 'Beagle',
        sexo: 'MACHO',
        nascimento: '2021-03-22',
        porte: 'MEDIO',
        peso: 13.4,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Sílvia Martins',
    bairro: 'Alto de Pinheiros',
    cep: '05448-000',
    pets: [
      {
        nome: 'Floquinho',
        especie: 'COELHO',
        raca: 'Mini Lop',
        sexo: 'MACHO',
        nascimento: '2023-09-04',
        porte: null,
        peso: 1.6,
        castrado: true,
        pelagem: 'Branco',
      },
    ],
  },
  {
    nome: 'André Cunha',
    bairro: 'Vila Madalena',
    cep: '05433-010',
    pets: [
      {
        nome: 'Tobias',
        especie: 'CACHORRO',
        raca: 'Yorkshire',
        sexo: 'MACHO',
        nascimento: '2015-07-19',
        porte: 'MINI',
        peso: 3.1,
        castrado: true,
        alertas: [{ tipo: 'CRONICO', severidade: 'ATENCAO', detalhe: 'Colapso de traqueia' }],
      },
    ],
  },
  {
    nome: 'Vanessa Lopes',
    bairro: 'Perdizes',
    cep: '05016-000',
    autorizado: { nome: 'Marcelo Lopes', relacao: 'Marido' },
    pets: [
      {
        nome: 'Frida',
        especie: 'CACHORRO',
        raca: 'Buldogue francês',
        sexo: 'FEMEA',
        nascimento: '2022-05-10',
        porte: 'PEQUENO',
        peso: 11.8,
        castrado: true,
      },
      {
        nome: 'Diego',
        especie: 'CACHORRO',
        raca: 'Buldogue francês',
        sexo: 'MACHO',
        nascimento: '2022-05-10',
        porte: 'PEQUENO',
        peso: 12.6,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Marcos Vinícius Teles',
    bairro: 'Pinheiros',
    cep: '05425-000',
    pets: [
      {
        nome: 'Pingo',
        especie: 'OUTRO',
        especieOutra: 'Furão',
        raca: null,
        sexo: 'MACHO',
        nascimento: '2023-02-15',
        porte: null,
        peso: 1.1,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Lívia Castro',
    bairro: 'Sumaré',
    cep: '01256-000',
    pets: [
      {
        nome: 'Mia',
        especie: 'GATO',
        raca: 'Ragdoll',
        sexo: 'FEMEA',
        nascimento: '2020-12-01',
        porte: null,
        peso: 4.7,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Roberto Antunes',
    bairro: 'Vila Madalena',
    cep: '05432-000',
    pets: [
      {
        nome: 'Apolo',
        especie: 'CACHORRO',
        raca: 'Golden Retriever',
        sexo: 'MACHO',
        nascimento: '2018-04-27',
        porte: 'GRANDE',
        peso: 33.2,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Daniela Freitas',
    bairro: 'Lapa',
    cep: '05072-000',
    pets: [
      {
        nome: 'Lola',
        especie: 'CACHORRO',
        raca: 'Poodle',
        sexo: 'FEMEA',
        nascimento: '2016-08-13',
        porte: 'PEQUENO',
        peso: 5.4,
        castrado: true,
      },
      {
        nome: 'Teco',
        especie: 'CACHORRO',
        raca: 'Poodle',
        sexo: 'MACHO',
        nascimento: '2019-11-29',
        porte: 'PEQUENO',
        peso: 6.0,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Felipe Barros',
    bairro: 'Pompeia',
    cep: '05025-000',
    pets: [
      {
        nome: 'Simba',
        especie: 'GATO',
        raca: 'SRD',
        sexo: 'MACHO',
        nascimento: '2019-06-06',
        porte: null,
        peso: 5.8,
        castrado: true,
        alertas: [{ tipo: 'IMUNOSSUPRIMIDO', severidade: 'ATENCAO', detalhe: 'FIV positivo' }],
      },
    ],
  },
  {
    nome: 'Carolina Rezende',
    bairro: 'Perdizes',
    cep: '05018-000',
    pets: [
      {
        nome: 'Belinha',
        especie: 'CACHORRO',
        raca: 'Lhasa Apso',
        sexo: 'FEMEA',
        nascimento: '2015-04-02',
        porte: 'PEQUENO',
        peso: 7.0,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Henrique Dias',
    bairro: 'Vila Beatriz',
    cep: '05446-000',
    pets: [
      {
        nome: 'Rex',
        especie: 'CACHORRO',
        raca: 'SRD',
        sexo: 'MACHO',
        nascimento: '2013-02-10',
        porte: 'MEDIO',
        peso: 18.0,
        castrado: true,
        pelagem: 'Preto e branco',
      },
    ],
  },
  {
    nome: 'Mariana Coelho',
    bairro: 'Pinheiros',
    cep: '05417-000',
    pets: [
      {
        nome: 'Nala',
        especie: 'CACHORRO',
        raca: 'Labrador Retriever',
        sexo: 'FEMEA',
        nascimento: '2020-09-16',
        porte: 'GRANDE',
        peso: 27.5,
        castrado: true,
        pelagem: 'Amarelo',
      },
    ],
  },
  {
    nome: 'Leonardo Faria',
    bairro: 'Sumarezinho',
    cep: '05440-000',
    pets: [
      {
        nome: 'Amendoim',
        especie: 'ROEDOR',
        raca: 'Hamster sírio',
        sexo: 'MACHO',
        nascimento: '2025-04-20',
        porte: null,
        peso: 0.15,
        castrado: false,
      },
    ],
  },
  {
    nome: 'Aline Monteiro',
    bairro: 'Vila Madalena',
    cep: '05436-000',
    pets: [
      {
        nome: 'Fiona',
        especie: 'GATO',
        raca: 'Sphynx',
        sexo: 'FEMEA',
        nascimento: '2021-07-21',
        porte: null,
        peso: 3.5,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Thiago Brandão',
    bairro: 'Lapa',
    cep: '05073-000',
    pets: [
      {
        nome: 'Bruce',
        especie: 'CACHORRO',
        raca: 'Boxer',
        sexo: 'MACHO',
        nascimento: '2018-12-08',
        porte: 'GRANDE',
        peso: 30.4,
        castrado: false,
      },
    ],
  },
  {
    nome: 'Isabela Nunes',
    bairro: 'Perdizes',
    cep: '05017-000',
    pets: [
      {
        nome: 'Princesa',
        especie: 'CACHORRO',
        raca: 'Maltês',
        sexo: 'FEMEA',
        nascimento: '2017-03-30',
        porte: 'MINI',
        peso: 3.4,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Vinícius Correia',
    bairro: 'Pinheiros',
    cep: '05418-000',
    pets: [
      {
        nome: 'Ozzy',
        especie: 'CACHORRO',
        raca: 'Husky siberiano',
        sexo: 'MACHO',
        nascimento: '2020-02-14',
        porte: 'GRANDE',
        peso: 24.8,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Natália Gomes',
    bairro: 'Pompeia',
    cep: '05023-000',
    pets: [
      {
        nome: 'Mingau',
        especie: 'GATO',
        raca: 'SRD',
        sexo: 'MACHO',
        nascimento: '2022-11-03',
        porte: null,
        peso: 4.4,
        castrado: true,
        pelagem: 'Branco',
      },
      {
        nome: 'Café',
        especie: 'GATO',
        raca: 'SRD',
        sexo: 'MACHO',
        nascimento: '2022-11-03',
        porte: null,
        peso: 4.9,
        castrado: true,
        pelagem: 'Marrom rajado',
      },
    ],
  },
  {
    nome: 'Caio Araújo',
    bairro: 'Vila Madalena',
    cep: '05433-020',
    pets: [
      {
        nome: 'Snoopy',
        especie: 'CACHORRO',
        raca: 'Beagle',
        sexo: 'MACHO',
        nascimento: '2016-05-07',
        porte: 'MEDIO',
        peso: 14.2,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Larissa Prates',
    bairro: 'Alto de Pinheiros',
    cep: '05449-000',
    pets: [
      {
        nome: 'Maya',
        especie: 'CACHORRO',
        raca: 'Spitz alemão',
        sexo: 'FEMEA',
        nascimento: '2021-04-11',
        porte: 'MINI',
        peso: 3.0,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Jorge Siqueira',
    bairro: 'Lapa',
    cep: '05074-000',
    pets: [
      {
        nome: 'Bidu',
        especie: 'CACHORRO',
        raca: 'SRD',
        sexo: 'MACHO',
        nascimento: '2012-08-01',
        porte: 'MEDIO',
        peso: 16.3,
        castrado: true,
        inativo: { motivo: 'OBITO', em: '2026-09-20' },
      },
      {
        nome: 'Pandora',
        especie: 'GATO',
        raca: 'SRD',
        sexo: 'FEMEA',
        nascimento: '2019-02-26',
        porte: null,
        peso: 4.0,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Priscila Teixeira',
    bairro: 'Perdizes',
    cep: '05019-000',
    pets: [
      {
        nome: 'Estrela',
        especie: 'CACHORRO',
        raca: 'Shih-tzu',
        sexo: 'FEMEA',
        nascimento: '2022-07-15',
        porte: 'PEQUENO',
        peso: 5.6,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Gabriel Moura',
    bairro: 'Pompeia',
    cep: '05026-000',
    pets: [
      {
        nome: 'Hulk',
        especie: 'CACHORRO',
        raca: 'Pit bull',
        sexo: 'MACHO',
        nascimento: '2019-09-09',
        porte: 'GRANDE',
        peso: 28.0,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Simone Andrade',
    bairro: 'Sumaré',
    cep: '01257-000',
    pets: [
      {
        nome: 'Lilica',
        especie: 'GATO',
        raca: 'Angorá',
        sexo: 'FEMEA',
        nascimento: '2015-01-19',
        porte: null,
        peso: 3.6,
        castrado: true,
        alertas: [
          { tipo: 'CRONICO', severidade: 'ATENCAO', detalhe: 'Hipertireoidismo em tratamento' },
        ],
      },
    ],
  },
  {
    nome: 'Alexandre Pinto',
    bairro: 'Vila Madalena',
    cep: '05434-000',
    pets: [
      {
        nome: 'Toddy',
        especie: 'CACHORRO',
        raca: 'SRD',
        sexo: 'MACHO',
        nascimento: '2023-06-12',
        porte: 'MEDIO',
        peso: 15.0,
        castrado: true,
        pelagem: 'Marrom',
      },
    ],
  },
  {
    nome: 'Mônica Ferraz',
    bairro: 'Pinheiros',
    cep: '05421-000',
    pets: [
      {
        nome: 'Bela',
        especie: 'CACHORRO',
        raca: 'Cocker spaniel',
        sexo: 'FEMEA',
        nascimento: '2017-10-24',
        porte: 'MEDIO',
        peso: 12.8,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Matheus Lacerda',
    bairro: 'Lapa',
    cep: '05076-000',
    pets: [
      {
        nome: 'Pretinha',
        especie: 'GATO',
        raca: 'SRD',
        sexo: 'FEMEA',
        nascimento: '2020-03-05',
        porte: null,
        peso: 4.1,
        castrado: true,
        pelagem: 'Preta',
      },
    ],
  },
  {
    nome: 'Elaine Bastos',
    bairro: 'Vila Beatriz',
    cep: '05444-000',
    pets: [
      {
        nome: 'Charlote',
        especie: 'CACHORRO',
        raca: 'Schnauzer',
        sexo: 'FEMEA',
        nascimento: '2019-01-18',
        porte: 'PEQUENO',
        peso: 8.9,
        castrado: true,
      },
    ],
  },
  {
    nome: 'Wagner Fontes',
    bairro: 'Perdizes',
    cep: '05020-000',
    pets: [
      {
        nome: 'Tigrão',
        especie: 'GATO',
        raca: 'SRD',
        sexo: 'MACHO',
        nascimento: '2018-08-28',
        porte: null,
        peso: 6.3,
        castrado: true,
        pelagem: 'Laranja rajado',
      },
      {
        nome: 'Faísca',
        especie: 'GATO',
        raca: 'SRD',
        sexo: 'FEMEA',
        nascimento: '2016-04-04',
        porte: null,
        peso: 3.7,
        castrado: true,
        inativo: { motivo: 'TRANSFERIDO', em: '2026-06-02' },
      },
    ],
  },
  {
    nome: 'Clara Menezes',
    bairro: 'Vila Madalena',
    cep: '05435-020',
    pets: [
      {
        nome: 'Nino',
        especie: 'CACHORRO',
        raca: 'Dachshund',
        sexo: 'MACHO',
        nascimento: '2022-02-08',
        porte: 'PEQUENO',
        peso: 7.9,
        castrado: true,
      },
    ],
  },
]

/* ------------------------------------------------------------------------------- a montagem */

function semAcento(texto: string) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function emailDe(nome: string) {
  const partes = semAcento(nome).split(' ')
  return `${partes[0]}.${partes[partes.length - 1]}@example.com`
}

export const CLIENTES: ClienteDaDemo[] = []
export const PACIENTES: PacienteDaDemo[] = []

function montar() {
  const sorte = criarSorteio('cadastro')
  let alerta = 0

  FAMILIAS.forEach((familia, i) => {
    const n = i + 1
    const clienteId = `demo-cli-${String(n).padStart(3, '0')}`
    const criadoEm = `2025-${String(3 + (n % 9)).padStart(2, '0')}-${String(1 + (n % 27)).padStart(2, '0')}T10:00:00-03:00`

    CLIENTES.push({
      id: clienteId,
      nome: familia.nome,
      cpf: null,
      telefone: `551198${String(7700000 + n * 1373)
        .padStart(7, '0')
        .slice(0, 7)}`,
      telefoneSecundario: null,
      email: emailDe(familia.nome),
      contatoPreferido: familia.contato ?? (n % 5 === 0 ? 'EMAIL' : 'WHATSAPP'),
      cep: familia.cep,
      logradouro: sorte.escolher([
        'Rua Fradique Coutinho',
        'Rua Aspicuelta',
        'Rua Mourato Coelho',
        'Rua Purpurina',
        'Rua Wisard',
        'Rua Girassol',
        'Rua Cardeal Arcoverde',
        'Rua Heitor Penteado',
      ]),
      numero: String(sorte.inteiro(20, 1400)),
      complemento: sorte.chance(0.35) ? `Apto ${sorte.inteiro(11, 182)}` : null,
      bairro: familia.bairro,
      cidade: 'São Paulo',
      uf: 'SP',
      observacao: null,
      emergenciaNome: null,
      emergenciaTelefone: null,
      codigoNaOrigem: null,
      ativo: true,
      inativoMotivo: null,
      mescladoEmId: null,
      anonimizadoEm: null,
      bloqueadoAte: null,
      autorizados: familia.autorizado
        ? [
            {
              id: `demo-aut-${n}`,
              nome: familia.autorizado.nome,
              telefone: `551197${String(6600000 + n * 911).slice(0, 7)}`,
              documento: null,
              relacao: familia.autorizado.relacao,
              ativo: true,
            },
          ]
        : [],
      criadoEm,
    })

    familia.pets.forEach((pet, j) => {
      const id = `demo-pac-${String(n).padStart(3, '0')}${j ? `-${j + 1}` : ''}`
      PACIENTES.push({
        id,
        nome: pet.nome,
        especie: pet.especie,
        especieOutra: pet.especieOutra ?? null,
        raca: pet.raca,
        sexo: pet.sexo,
        nascimento: pet.nascimento,
        nascimentoEstimado: pet.estimado ?? false,
        porte: pet.porte,
        ativo: !pet.inativo,
        inativoMotivo: pet.inativo?.motivo ?? null,
        obitoEm: pet.inativo?.motivo === 'OBITO' ? pet.inativo.em : null,
        temFoto: true,
        /* Os nove retratos de sempre ficam com os pets deles; os outros, pela raça. */
        fotoUrl: pet.foto
          ? `/demo/pacientes/${pet.foto}.jpg`
          : proximaFoto(id, pet.especie, pet.raca, pet.especieOutra ?? null),
        codigoNaOrigem: null,
        castrado: pet.castrado,
        pesoKg: pet.peso,
        microchip:
          pet.especie === 'CACHORRO' && sorte.chance(0.55)
            ? `9002150005${String(10000 + n * 37 + j).slice(0, 5)}`
            : null,
        pelagem: pet.pelagem ?? null,
        mescladoEmId: null,
        alertas: (pet.alertas ?? []).map((a) => ({
          ...a,
          id: `demo-alerta-${++alerta}`,
          ativo: true,
        })),
        clienteId,
        noApp: Boolean(pet.foto) || sorte.chance(0.55),
        criadoEm,
      })
    })
  })

  montarGeradas()
}

/**
 * Quantos pets a base tem ao todo: os escritos à mão e, até completar, os gerados. Todos com
 * foto (pedido do Luís, 18/11/2026: "deixa só 100 com foto").
 */
export const TOTAL_DE_PETS = 100

function montarGeradas() {
  const sorte = criarSorteio('cadastro-geradas')
  const usados = new Set(CLIENTES.map((c) => c.nome))

  for (const [i, familia] of gerarFamilias(TOTAL_DE_PETS, usados).entries()) {
    if (PACIENTES.length >= TOTAL_DE_PETS) break
    const n = i + 1
    /* A última família leva só os pets que cabem no total. */
    familia.pets = familia.pets.slice(0, TOTAL_DE_PETS - PACIENTES.length)
    const clienteId = `demo-cli-g${String(n).padStart(3, '0')}`
    /* Entrou há `mesesDeCasa` meses: o cadastro do cliente e dos pets é desse dia. */
    const dia = somarDias(hoje(), -(familia.mesesDeCasa * 30 + sorte.inteiro(0, 27)))
    const criadoEm = instante(
      dia,
      `${String(sorte.inteiro(8, 18)).padStart(2, '0')}:${sorte.escolher(['05', '20', '35', '50'])}`,
    )

    CLIENTES.push({
      id: clienteId,
      nome: familia.nome,
      cpf: null,
      telefone: `551199${String(1000000 + n * 4111).slice(0, 7)}`,
      telefoneSecundario: null,
      email: emailDe(familia.nome),
      contatoPreferido: sorte.pesado([
        ['WHATSAPP', 80],
        ['LIGACAO', 12],
        ['EMAIL', 8],
      ] as const),
      cep: familia.cep,
      logradouro: sorte.escolher([
        'Rua Fradique Coutinho',
        'Rua Aspicuelta',
        'Rua Mourato Coelho',
        'Rua Teodoro Sampaio',
        'Rua Cardeal Arcoverde',
        'Rua Heitor Penteado',
        'Rua Cayowaá',
        'Rua Capote Valente',
        'Avenida Pompeia',
        'Rua Clélia',
      ]),
      numero: String(sorte.inteiro(20, 2200)),
      complemento: sorte.chance(0.4) ? `Apto ${sorte.inteiro(11, 182)}` : null,
      bairro: familia.bairro,
      cidade: 'São Paulo',
      uf: 'SP',
      observacao: null,
      emergenciaNome: null,
      emergenciaTelefone: null,
      codigoNaOrigem: null,
      ativo: true,
      inativoMotivo: null,
      mescladoEmId: null,
      anonimizadoEm: null,
      bloqueadoAte: null,
      autorizados: [],
      criadoEm,
    })

    familia.pets.forEach((pet, j) => {
      PACIENTES.push({
        id: `demo-pac-g${String(n).padStart(3, '0')}${j ? `-${j + 1}` : ''}`,
        nome: pet.nome,
        especie: pet.especie,
        especieOutra: pet.especieOutra ?? null,
        raca: pet.raca,
        sexo: pet.sexo,
        nascimento: pet.nascimento,
        nascimentoEstimado: false,
        porte: pet.porte,
        ativo: true,
        inativoMotivo: null,
        obitoEm: null,
        temFoto: true,
        fotoUrl: proximaFoto(
          `demo-pac-g${String(n).padStart(3, '0')}${j ? `-${j + 1}` : ''}`,
          pet.especie,
          pet.raca,
          pet.especieOutra ?? null,
        ),
        codigoNaOrigem: null,
        castrado: pet.castrado,
        pesoKg: pet.peso,
        microchip:
          pet.especie === 'CACHORRO' && sorte.chance(0.45)
            ? `9002150007${String(10000 + n * 53 + j).slice(0, 5)}`
            : null,
        pelagem: null,
        mescladoEmId: null,
        alertas: [],
        clienteId,
        noApp: sorte.chance(0.5),
        criadoEm,
      })
    })
  }
}

montar()

/* ------------------------------------------------------------------------------ consultas */

export function cliente(id: string) {
  return CLIENTES.find((c) => c.id === id) ?? null
}

export function paciente(id: string) {
  return PACIENTES.find((p) => p.id === id) ?? null
}

export function pacientesDoCliente(clienteId: string) {
  return PACIENTES.filter((p) => p.clienteId === clienteId)
}

export function pacientesAtivos() {
  return PACIENTES.filter((p) => p.ativo)
}

/** O cliente como `ClienteComAutorizadosDto` (sem o `criadoEm` interno). */
export function clienteDe(id: string): Cliente {
  const registro = cliente(id)
  if (!registro) throw new Error(`demonstração: cliente ${id} não existe`)
  const { criadoEm: _criadoEm, ...dto } = registro
  return dto
}

/** O paciente como `PacienteDto`, com o cliente embutido. */
export function pacienteDto(id: string): Paciente {
  const registro = paciente(id)
  if (!registro) throw new Error(`demonstração: paciente ${id} não existe`)
  const { clienteId, noApp: _noApp, criadoEm: _criadoEm, ...resto } = registro
  return { ...resto, cliente: clienteDe(clienteId) }
}

/** O paciente como linha da lista (`PacienteResumoDto`). */
export function pacienteResumo(id: string): PacienteNaLista {
  const p = pacienteDto(id)
  return {
    id: p.id,
    nome: p.nome,
    especie: p.especie,
    especieOutra: p.especieOutra,
    raca: p.raca,
    sexo: p.sexo,
    nascimento: p.nascimento,
    nascimentoEstimado: p.nascimentoEstimado,
    porte: p.porte,
    ativo: p.ativo,
    inativoMotivo: p.inativoMotivo,
    obitoEm: p.obitoEm,
    temFoto: p.temFoto,
    fotoUrl: p.fotoUrl,
    codigoNaOrigem: p.codigoNaOrigem,
    cliente: {
      id: p.cliente.id,
      nome: p.cliente.nome,
      telefone: p.cliente.telefone,
      contatoPreferido: p.cliente.contatoPreferido,
    },
    alertas: p.alertas.filter((a) => a.ativo),
  }
}
