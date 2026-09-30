/**
 * Planilhas de demonstração do migrador.
 *
 * Três arquivos que qualquer clínica reconheceria, cada um para mostrar uma coisa:
 *
 * - **A planilha feita na clínica** — quarenta linhas escritas à mão, com todo defeito que o
 *   requisito pede: data em cinco formatos, telefone com e sem máscara, peso com vírgula e em
 *   gramas, animal sem responsável (célula mesclada que o csv desfez), responsável sem animal,
 *   linha pela metade, o mesmo animal duas vezes, e gente que **já está cadastrada** nesta
 *   clínica (Marina, Eduardo, Fátima — da camada mocada) para o duplicado aparecer contra a base.
 *   Cada linha tem um porquê, anotado ao lado.
 * - **O export do SimplesVet** — cento e poucas linhas limpas, no formato presumido do sistema:
 *   mostra a origem reconhecida e o mapeamento que nasce certo.
 * - **O export do Vetus, base grande** — 2.400 linhas, para ver o progresso, pausar e continuar.
 *
 * Os dois exports são gerados com semente fixa: a mesma demonstração dá sempre o mesmo número.
 * Os cabeçalhos dos exports são presumidos (ver `ORIGENS_CONHECIDAS`).
 */

import { createPrng, intBetween, pickFrom } from '../mock-runtime'

export type DemonstracaoId = 'clinica' | 'simplesvet' | 'vetus'

export const DEMONSTRACOES: Array<{ id: DemonstracaoId; arquivo: string }> = [
  { id: 'clinica', arquivo: 'clientes-e-animais.csv' },
  { id: 'simplesvet', arquivo: 'simplesvet-export-clientes.csv' },
  { id: 'vetus', arquivo: 'vetus_pacientes_completo.csv' },
]

// ---------------------------------------------------------------------------
// A planilha feita na clínica
// ---------------------------------------------------------------------------

const CABECALHO_DA_CLINICA = [
  'NOME CLIENTE',
  'CPF',
  'Fone',
  'Cel/WhatsApp',
  'E-mail',
  'Endereço',
  'Bairro',
  'Cidade',
  'Animal',
  'Espécie',
  'Raça',
  'Sexo',
  'Nasc.',
  'Peso',
  'Castrado?',
  'Alergias',
  'Chip',
  'Obs',
  'Situação',
  '',
]

type LinhaDaClinica = [
  cliente: string,
  cpf: string,
  fone: string,
  cel: string,
  email: string,
  endereco: string,
  bairro: string,
  cidade: string,
  animal: string,
  especie: string,
  raca: string,
  sexo: string,
  nascimento: string,
  peso: string,
  castrado: string,
  alergias: string,
  chip: string,
  obs: string,
  situacao: string,
  sobra: string,
]

const _ = ''

/* prettier-ignore */
const LINHAS_DA_CLINICA: LinhaDaClinica[] = [
  // 4 · Já cadastrada, achada pelo telefone sem máscara. Luna também já existe; o peso discorda.
  ['MARINA ALVES', _, '11984221030', _, 'MARINA.ALVES@EXEMPLO.COM', 'Rua Harmonia, 120', 'Vila Madalena', 'São Paulo', 'LUNA', 'Cão', 'SRD', 'F', '12/03/2017', '12,8', 'Sim', 'amoxicilina', _, _, 'Ativo', _],
  // 5 · Sem responsável: a célula mesclada de cima virou vazio no csv. Peso em gramas.
  [_, _, _, _, _, _, _, _, 'Frida', 'Calopsita', _, 'F', '2020-05-02', '95g', _, _, _, _, _, _],
  // 6 · Novo. Ano com dois dígitos, peso com vírgula e unidade colada.
  ['Paulo Henrique Souza', '034.981.207-19', '(11) 99876-5544', _, 'paulo.souza@gmail.com', 'Av. Rebouças, 1500 ap 32', 'Pinheiros', 'São Paulo', 'Bob', 'cachorro', 'Labrador', 'Macho', '05/11/17', '32,4kg', 'N', 'Não', '982000123456789', 'Bravo com estranhos', 'Ativo', _],
  // 7 · Data guardada como número serial do Excel. "Fêmea castrada" responde pelas duas colunas.
  ['Maria Souza', _, '(11) 3456-7788', _, _, 'Rua Augusta, 55', 'Consolação', 'São Paulo', 'Mimi', 'Gato', 'Siamês', 'Fêmea castrada', '43891', '4,2', _, 'nega', _, _, _, _],
  // 8 · Responsável sem animal: entra como contato.
  ['ROBERTO DIAS', '275.104.863-35', '(11) 99111-2233', _, 'roberto.dias@hotmail.com', _, _, 'Osasco', _, _, _, _, _, _, _, _, _, 'Cliente antigo, animal faleceu em 2021', _, _],
  // 9 · Dois telefones na mesma célula.
  ['Carla Menezes', '406.218.935-60', '11 98765-4321 / 3322-1100', _, 'carla.menezes@exemplo.com', 'Rua Girassol, 88', 'Vila Madalena', 'São Paulo', 'Pingo', 'Cão', 'Poodle', 'M', '22/07/2018', '6.3', 'x', _, _, _, 'Ativo', _],
  // 10 · Continuação da Carla. Espécie em branco, a raça resolve. Data sem dia.
  [_, _, _, _, _, _, _, _, 'Pipoca', _, 'Shih Tzu', 'F', 'mar/2021', '5,1', _, _, _, _, _, _],
  // 11 · Segunda continuação seguida.
  [_, _, _, _, _, _, _, _, 'Nino', 'gato', 'SRD', 'M', _, _, _, _, _, _, _, 'ver ficha'],
  // 12 · Linha em branco no meio.
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  // 13 · Animal sem responsável, e sem linha de cima para herdar: fica de fora.
  [_, _, _, _, _, _, _, _, 'Thor', 'Cão', _, 'M', _, _, _, _, _, 'achado na rua, sem dono', _, _],
  // 14 · Já cadastrado, achado pelo CPF. Celular sem o nono dígito. E-mail sem domínio. Chip em notação científica. Alergia nova.
  ['EDUARDO BITTENCOURT', '712.408.336-28', '(11) 8411-2299', _, 'eduardo.b@exemplo', _, _, 'São Paulo', 'Thor', 'Canino', 'Rottweiler', 'Macho', '10/10/2016', '41', 'Não', 'Dipirona', '9,82E+14', _, 'Ativo', _],
  // 15 · Mesmo nome de quem está cadastrada, telefone diferente: só a pessoa sabe.
  ['Luciana Prado', _, '(11) 97000-1234', _, _, _, _, _, 'Mel', 'Cão', 'Golden Retriever', 'F', _, '30', 'S', _, _, _, _, _],
  // 16 · Mesmo nome da linha 7, telefone diferente. Data que não existe.
  ['Maria Souza', _, '(11) 97654-0000', _, 'maria.souza@yahoo.com', _, _, _, 'Tobias', 'Cão', 'Beagle', 'M', '2019-02-30', '14', _, _, _, _, _, _],
  // 17 · Celular antigo, nascimento no futuro, CPF só com dígitos.
  ["Joana D'Arc Lima", '12846397546', '(11) 7654-3210', '(11) 3333-4444', 'joana.lima@exemplo.com', _, _, _, 'Belinha', 'Cão', 'Yorkshire', 'F', '15/08/2027', '2,7', 'Sim', _, _, _, 'Ativo', _],
  // 18 · O Paulo da linha 6 de novo (mesmo telefone), com o Bob de novo e outro peso.
  ['Paulo Henrique Souza', _, '11998765544', _, _, _, _, _, 'BOB', 'Cão', 'Labrador', 'M', '05/11/2017', '33', _, _, _, _, _, _],
  // 19 · CPF que perdeu o zero da frente no Excel. Sem telefone e sem e-mail. Idade em vez de data.
  ['Ana Beatriz Rocha', '1234567890', _, _, _, _, _, _, 'Luna', 'felino', 'Persa', 'F', '3 anos', _, _, _, _, _, _, _],
  // 20 · Falecido: não entra como paciente.
  ['Fábio Nunes', _, '8888-1234', _, 'fabio@exemplo.com', _, _, _, 'Rex', 'Cão', 'Pastor Alemão', 'M', '01.02.2015', '38,5', 'Sim', _, _, _, 'Falecido', _],
  // 21 · O mesmo Fábio, com outro animal. Telefone sem DDD e sem o nono dígito. Só o ano.
  ['Fábio Nunes', _, '8888-1234', _, _, _, _, _, 'Luna', 'Cachorro', 'SRD', 'F', '2022', '9', 'Não', _, _, _, 'Ativo', _],
  // 22 · Registro pela metade: tem bicho, não tem nome.
  ['Gustavo Lemos', '583.027.416-71', '(11) 95555-6666', _, _, _, _, _, _, 'Gato', 'SRD', 'F', _, '3,2', _, _, _, _, _, _],
  // 23 · Hamster: o de-para diz roedor.
  ['Helena Castro', _, '(11) 94444-3333', _, _, _, _, _, 'Kiara', 'Hamster', 'Sírio', 'F', _, '120g', _, _, _, _, _, _],
  // 24 · Jabuti, sem sexo informado.
  ['Igor Tavares', _, '(11) 93333-2222', _, _, _, _, _, 'Spike', 'Jabuti', _, _, '2008', '2,6', _, _, _, _, _, _],
  // 25 · Coelho vira roedor — o mais perto que o cadastro tem, e a tela diz que é palpite.
  ['Juliana Prates', _, '(21) 99888-7766', _, _, _, _, _, 'Zeca', 'Coelho', _, 'M', _, '1,8', _, _, _, _, _, _],
  // 26 · Peixe: o cadastro não tem essa espécie.
  ['Leonardo Quintana', _, '+55 11 97777-6666', _, 'LEO.Q@GMAIL.COM', _, _, _, 'Nemo', 'Peixe', 'Betta', 'M', _, _, _, _, _, _, _, _],
  // 27 · Espécie "?", mas Pinscher só pode ser cão. Telefone com 0xx.
  ['Márcia Oliveira', _, '0xx11 5555-1234', _, _, _, _, _, 'Amendoim', '?', 'Pinscher', 'M', '12/12/2012', '3,1', _, _, _, _, _, _],
  // 28 · Telefone que não é telefone, e nenhum outro contato.
  ['NATÁLIA RIBEIRO', _, '123', _, _, _, _, _, 'Tico', 'Pássaro', _, _, _, _, _, _, _, _, _, _],
  // 29 · Data americana numa coluna brasileira.
  ['Otávio Mendes', '741.285.390-23', '(11) 92222-1111', _, _, _, _, _, 'Mingau', 'Felino', 'Angorá', 'Macho castrado', '04/23/2019', '5', _, _, _, _, _, _],
  // 30 · CPF de onze dígitos iguais.
  ['Patrícia Gomes', '111.111.111-11', '(11) 91111-0000', _, _, _, _, _, 'Duda', 'Cadela', 'Maltês', 'F', '09/09/2019', '3,4', 'Sim', _, _, _, _, _],
  // 31 · Peso que só pode ser engano.
  ['Rafael Teixeira', '852.906.174-85', '(11) 98989-8989', _, _, _, _, _, 'Zeus', 'Cão', 'Husky Siberiano', 'M', '01/06/2020', '350', 'Não', _, _, _, _, _],
  // 32 · Duas Mel da mesma pessoa, uma cadela e uma gata: dois animais, sem pergunta.
  ['Sandra Vieira', _, '(11) 97878-7878', _, _, _, _, _, 'Mel', 'Cão', 'SRD', 'F', _, _, _, _, _, _, _, _],
  // 33
  ['Sandra Vieira', _, '(11) 97878-7878', _, _, _, _, _, 'Mel', 'Gato', 'SRD', 'F', _, _, _, _, _, _, _, _],
  // 34 · Telefone só na coluna do celular.
  ['Tatiane Freitas', _, _, '(11) 96767-6767', 'tati@exemplo.com', _, _, _, 'Paçoca', 'Cão', 'Dachshund', 'F', '2021-07-14', '7,4', _, _, _, _, _, _],
  // 35 · Égua de 430 kg: peso alto, mas de equino.
  ['Ulisses Barros', _, '(11) 95151-5151', _, _, _, _, 'Cotia', 'Faísca', 'Égua', 'Mangalarga', 'F', '2014', '430', _, _, _, _, _, _],
  // 36 · Linha em branco.
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  // 37 · Já cadastrada pelo CPF, com a Pipoca que já existe.
  ['Fátima Gonçalves', '389.114.700-74', '(11) 96622-7745', _, _, _, _, _, 'Pipoca', 'Porquinho-da-índia', _, 'F', _, '0,9', _, _, _, _, _, _],
  // 38 · Data que não existe.
  ['Vinícius Araújo', '963.170.528-59', '(11) 95656-5656', _, _, _, _, _, 'Luke', 'CÃO', 'Border Collie', 'M', '31/02/2020', '18', _, _, _, _, _, _],
  // 39 · O mínimo.
  ['Wagner Pires', _, '(11) 94545-4545', _, _, _, _, _, 'Bolinha', 'gata', _, 'f', _, _, _, _, _, _, _, _],
  // 40 · Espécie em branco e sem raça: ninguém tem como saber.
  ['Xênia Moraes', _, '(11) 93434-3434', _, _, _, _, _, 'Lua', _, _, _, _, _, _, _, _, _, _, _],
  // 41 · Tudo certo, para lembrar que a maioria das linhas é assim.
  ['Yuri Campos', _, '(11) 92323-2323', _, _, _, _, _, 'Rocky', 'Cão', 'Pit Bull', 'Macho', '15/03/2019', '28', 'Sim', _, '982000987654321', _, 'Ativo', _],
  // 42 · Só o nome de alguém: contato sem como contatar.
  ['Zilda Monteiro', _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
]

function planilhaDaClinica(): string[][] {
  return [
    ['CADASTRO DE CLIENTES E ANIMAIS - CLÍNICA VETERINÁRIA BICHO FELIZ'],
    ['Atualizado em 14/08/2025 pela recepção'],
    CABECALHO_DA_CLINICA,
    ...LINHAS_DA_CLINICA,
    [],
    [],
  ]
}

// ---------------------------------------------------------------------------
// Exports gerados
// ---------------------------------------------------------------------------

// prettier-ignore
const PRIMEIROS = [
  'Adriana', 'Alexandre', 'Aline', 'André', 'Beatriz', 'Bruno', 'Camila', 'Carlos', 'Cecília',
  'Daniela', 'Diego', 'Eduarda', 'Elias', 'Fernanda', 'Felipe', 'Gabriela', 'Gustavo', 'Heloísa',
  'Henrique', 'Isabela', 'Ivan', 'Júlia', 'João', 'Karina', 'Lucas', 'Larissa', 'Marcelo',
  'Mariana', 'Mateus', 'Natália', 'Nelson', 'Olívia', 'Otávio', 'Priscila', 'Pedro', 'Raquel',
  'Renato', 'Sabrina', 'Samuel', 'Tânia', 'Thiago', 'Úrsula', 'Vanessa', 'Vítor', 'Yasmin',
  'Wellington', 'Zuleica', 'Rodrigo', 'Simone', 'Leandro', 'Patrícia', 'Fábio', 'Luana',
  'Caio', 'Rebeca', 'Hugo', 'Débora', 'Ígor', 'Letícia', 'Murilo',
]

// prettier-ignore
const MEIOS = [
  'Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Figueira', 'Guedes', 'Holanda',
  'Iglesias', 'Jardim', 'Leite', 'Macedo', 'Nogueira', 'Pacheco', 'Queiroz', 'Rezende', 'Siqueira',
  'Toledo', 'Valente', 'Xavier', 'Brandão', 'Coutinho', 'Diniz', 'Falcão', 'Gouveia', 'Lacerda',
  'Moura', 'Peixoto', 'Rangel', 'Sales', 'Teles', 'Vasconcelos', 'Aguiar', 'Bastos', 'Campos',
  'Dantas', 'Freire', 'Godoy', 'Lobo', 'Marques',
]

// prettier-ignore
const ULTIMOS = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima',
  'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Rocha', 'Mendes', 'Araújo', 'Melo',
  'Barros', 'Freitas',
]

// prettier-ignore
const NOMES_DE_CAO = [
  'Thor', 'Mel', 'Bob', 'Luna', 'Nina', 'Max', 'Bela', 'Fred', 'Lola', 'Toby', 'Pandora', 'Zeus',
  'Maya', 'Pipoca', 'Scooby', 'Luke', 'Amora', 'Bidu', 'Chico', 'Duque', 'Estrela', 'Fiona',
  'Gordo', 'Hulk', 'Jade', 'Kiko', 'Lady', 'Marley', 'Nescau', 'Ozzy', 'Paçoca', 'Rex', 'Sansão',
  'Tequila', 'Ursa', 'Vitória', 'Xuxa', 'Zara', 'Biscoito', 'Café',
]

// prettier-ignore
const NOMES_DE_GATO = [
  'Mingau', 'Frajola', 'Mimi', 'Tom', 'Salem', 'Nala', 'Garfield', 'Luna', 'Pantera', 'Chanel',
  'Sushi', 'Tofu', 'Bolinha', 'Farofa', 'Jujuba', 'Kitty', 'Mia', 'Oliver', 'Pérola', 'Simba',
]

// prettier-ignore
const RACAS_DE_CAO = [
  'SRD', 'SRD', 'SRD', 'Poodle', 'Shih Tzu', 'Yorkshire', 'Labrador', 'Golden Retriever',
  'Pinscher', 'Lhasa Apso', 'Bulldog Francês', 'Beagle', 'Dachshund', 'Border Collie',
  'Spitz Alemão', 'Pug', 'Maltês', 'Rottweiler',
]

const RACAS_DE_GATO = ['SRD', 'SRD', 'SRD', 'Siamês', 'Persa', 'Maine Coon', 'Angorá', 'Ragdoll']

const BAIRROS = ['Pinheiros', 'Vila Madalena', 'Perdizes', 'Lapa', 'Butantã', 'Sumaré', 'Pompeia']

function cpfDe(base: number): string {
  const digitos = String(100_000_000 + (base % 899_999_999))
    .padStart(9, '0')
    .slice(0, 9)
  const verificador = (texto: string, ate: number) => {
    let soma = 0

    for (let indice = 0; indice < ate; indice += 1) {
      soma += Number(texto[indice]) * (ate + 1 - indice)
    }

    const resto = (soma * 10) % 11

    return resto === 10 ? 0 : resto
  }
  const primeiro = verificador(digitos, 9)
  const completo = `${digitos}${primeiro}${verificador(`${digitos}${primeiro}`, 10)}`

  return completo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function doisDigitos(valor: number) {
  return String(valor).padStart(2, '0')
}

type AnimalGerado = {
  nome: string
  especie: 'canina' | 'felina' | 'ave' | 'roedor'
  raca: string
  sexo: 'M' | 'F'
  nascimento: { dia: number; mes: number; ano: number }
  peso: number
  castrado: boolean
  falecido: boolean
}

type ClienteGerado = {
  nome: string
  cpf: string
  celular: string
  fixo: string
  email: string
  animais: AnimalGerado[]
}

function gerarClientes(semente: number, quantos: number): ClienteGerado[] {
  const sorteio = createPrng(semente)
  const clientes: ClienteGerado[] = []

  for (let indice = 0; indice < quantos; indice += 1) {
    /* Primeiro + meio é único até 2.400 clientes: nenhuma "mesma pessoa?" sai do sorteio. */
    const primeiro = PRIMEIROS[indice % PRIMEIROS.length]!
    const meio = MEIOS[Math.floor(indice / PRIMEIROS.length) % MEIOS.length]!
    const ultimo = pickFrom(sorteio, ULTIMOS, 'Silva')
    const nome = `${primeiro} ${meio} ${ultimo}`
    const email = `${primeiro}.${meio}${indice}`
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
    const quantosAnimais = sorteio() < 0.62 ? 1 : sorteio() < 0.8 ? 2 : 3
    const animais: AnimalGerado[] = []

    for (let numero = 0; numero < quantosAnimais; numero += 1) {
      const rolagem = sorteio()
      const especie =
        rolagem < 0.6 ? 'canina' : rolagem < 0.95 ? 'felina' : rolagem < 0.98 ? 'ave' : 'roedor'
      const nomes = especie === 'felina' ? NOMES_DE_GATO : NOMES_DE_CAO
      const nomeDoAnimal = pickFrom(
        sorteio,
        nomes.filter((candidato) => !animais.some((outro) => outro.nome === candidato)),
        'Bidu',
      )

      animais.push({
        nome: nomeDoAnimal,
        especie,
        raca:
          especie === 'canina'
            ? pickFrom(sorteio, RACAS_DE_CAO, 'SRD')
            : especie === 'felina'
              ? pickFrom(sorteio, RACAS_DE_GATO, 'SRD')
              : especie === 'ave'
                ? 'Calopsita'
                : 'Hamster Sírio',
        sexo: sorteio() < 0.5 ? 'M' : 'F',
        nascimento: {
          dia: intBetween(sorteio, 1, 28),
          mes: intBetween(sorteio, 1, 12),
          ano: intBetween(sorteio, 2009, 2025),
        },
        peso:
          especie === 'canina'
            ? Math.round((3 + sorteio() * 35) * 10) / 10
            : especie === 'felina'
              ? Math.round((2.5 + sorteio() * 4) * 10) / 10
              : Math.round((0.08 + sorteio() * 0.1) * 100) / 100,
        castrado: sorteio() < 0.55,
        falecido: sorteio() < 0.02,
      })
    }

    clientes.push({
      nome,
      cpf: sorteio() < 0.7 ? cpfDe(semente + indice * 7919) : '',
      celular: `(11) 9${intBetween(sorteio, 5000, 9999)}-${intBetween(sorteio, 1000, 9999)}`,
      fixo:
        sorteio() < 0.3
          ? `(11) ${intBetween(sorteio, 2000, 5999)}-${intBetween(sorteio, 1000, 9999)}`
          : '',
      email: sorteio() < 0.75 ? `${email}@exemplo.com` : '',
      animais,
    })
  }

  return clientes
}

const ESPECIE_NO_SIMPLESVET: Record<AnimalGerado['especie'], string> = {
  canina: 'Canina',
  felina: 'Felina',
  ave: 'Ave',
  roedor: 'Roedor',
}

function exportDoSimplesVet(): string[][] {
  const clientes = gerarClientes(20_260_929, 78)

  /* Um cliente que esta clínica já atende: o export traz o Daniel com a Sushi. */
  clientes[12] = {
    nome: 'Daniel Okamoto',
    cpf: '507.913.622-72',
    celular: '(11) 99504-3312',
    fixo: '',
    email: 'daniel.okamoto@exemplo.com',
    animais: [
      {
        nome: 'Sushi',
        especie: 'felina',
        raca: 'Persa',
        sexo: 'F',
        nascimento: { dia: 3, mes: 4, ano: 2019 },
        peso: 4.1,
        castrado: true,
        falecido: false,
      },
    ],
  }

  const linhas: string[][] = [
    // prettier-ignore
    [
      'Código', 'Cliente', 'CPF/CNPJ', 'Celular', 'Telefone', 'E-mail', 'CEP', 'Endereço', 'Número',
      'Bairro', 'Cidade', 'UF', 'Animal', 'Espécie', 'Raça', 'Sexo', 'Castrado',
      'Data de nascimento', 'Peso (kg)', 'Pelagem', 'Microchip', 'Situação',
    ],
  ]

  clientes.forEach((cliente, indice) => {
    const semContato = indice % 29 === 5

    for (const animal of cliente.animais) {
      linhas.push([
        String(1000 + indice),
        cliente.nome,
        cliente.cpf,
        semContato ? '' : cliente.celular,
        cliente.fixo,
        semContato ? '' : cliente.email,
        `05${String(400 + (indice % 90)).padStart(3, '0')}-${String(indice % 1000).padStart(3, '0')}`,
        `Rua ${MEIOS[indice % MEIOS.length]}`,
        String(10 + ((indice * 37) % 1900)),
        BAIRROS[indice % BAIRROS.length]!,
        'São Paulo',
        'SP',
        animal.nome,
        ESPECIE_NO_SIMPLESVET[animal.especie],
        animal.raca,
        animal.sexo === 'M' ? 'Macho' : 'Fêmea',
        animal.castrado ? 'Sim' : 'Não',
        `${doisDigitos(animal.nascimento.dia)}/${doisDigitos(animal.nascimento.mes)}/${animal.nascimento.ano}`,
        String(animal.peso).replace('.', ','),
        '',
        '',
        animal.falecido ? 'Inativo - Óbito' : 'Ativo',
      ])
    }
  })

  return linhas
}

function exportDoVetus(): string[][] {
  const clientes = gerarClientes(4_242, 1_720)
  const linhas: string[][] = [
    // prettier-ignore
    [
      'cod_cliente', 'nome_proprietario', 'cpf_proprietario', 'fone1', 'fone2', 'email',
      'cod_animal', 'nome_animal', 'especie', 'raca', 'sexo', 'dt_nascimento', 'peso', 'castrado',
      'obito',
    ],
  ]
  let codigoDoAnimal = 1

  clientes.forEach((cliente, indice) => {
    for (const animal of cliente.animais) {
      /* Um em cada cento e poucos com espécie que o cadastro não tem — o de-para precisa de uma decisão. */
      const especie = codigoDoAnimal % 157 === 0 ? 'OUTROS' : animal.especie.toUpperCase()

      linhas.push([
        String(indice + 1),
        cliente.nome.toUpperCase(),
        cliente.cpf.replace(/\D/g, ''),
        cliente.celular.replace(/\D/g, ''),
        cliente.fixo.replace(/\D/g, ''),
        cliente.email,
        String(codigoDoAnimal),
        codigoDoAnimal % 211 === 0 ? '' : animal.nome.toUpperCase(),
        especie,
        animal.raca.toUpperCase(),
        animal.sexo,
        `${animal.nascimento.ano}-${doisDigitos(animal.nascimento.mes)}-${doisDigitos(animal.nascimento.dia)}`,
        String(animal.peso),
        animal.castrado ? 'S' : 'N',
        animal.falecido ? 'S' : 'N',
      ])
      codigoDoAnimal += 1
    }
  })

  return linhas.slice(0, 2_401)
}

/** A grade do arquivo, como sairia de um `lerCsv` — título e linhas em branco inclusive. */
export function gradeDaDemonstracao(id: DemonstracaoId): string[][] {
  if (id === 'simplesvet') {
    return exportDoSimplesVet()
  }

  if (id === 'vetus') {
    return exportDoVetus()
  }

  return planilhaDaClinica()
}
