/**
 * O texto que o responsável recebe.
 *
 * Vive fora do repositório porque **o dataset também precisa dele**: os boletins já enviados que
 * o protótipo planta são lidos na tela do celular, e nasceram com o texto em branco — a prévia do
 * app mostrava balões vazios, só com a hora. Um gerador só, usado nos dois lugares, é o que
 * garante que o histórico e o boletim novo falem a mesma língua.
 *
 * O texto é montado em português e **congelado no envio**, e isso não contradiz a disciplina de
 * i18n do módulo: o boletim não é interface, é mensagem endereçada ao responsável, no idioma
 * dele. O idioma da tela da clínica não tem relação com o idioma em que a Rita lê que o gato
 * dela piorou.
 *
 * Escrito para ser lido por quem está com medo, e por isso três regras: **primeiro o estado**,
 * depois o que foi feito, e nunca um número solto sem o que ele significa. "Temperatura 39,4"
 * assusta sem informar; "acima do normal, já sob medicação" informa.
 */

import type { GravidadeClinica } from './types'

const COMO_ESTA: Record<GravidadeClinica, string> = {
  estavel: 'está estável',
  atencao: 'segue sob observação atenta',
  critico: 'está em estado grave',
}

export type FatosDoBoletim = {
  petNome: string
  gravidade: GravidadeClinica
  /** Administrações concluídas e previstas desde o boletim anterior. */
  feitas: number
  previstas: number
  temperatura: number | null
  /** O que o plantão observou: comeu, urinou, dormiu. É o que o responsável quer ouvir. */
  observado: string
  /**
   * Boletim de piora não tenta suavizar — o responsável já ouviu a notícia por telefone antes de
   * receber isto, e um texto ameno depois de uma ligação grave soa a desconversa.
   */
  exigeLigacao: boolean
}

/** O fecho de todo boletim. É a promessa que faz o responsável largar o celular. */
const FECHO = 'Qualquer mudança, avisamos imediatamente.'

/**
 * A frase das medicações — ou nada, quando não havia o que fazer no período.
 *
 * "0 de 0 realizados" é pior que o silêncio: parece falha e não ausência de tarefa.
 */
function fraseDasMedicacoes(feitas: number, previstas: number): string {
  return previstas > 0
    ? `Medicações e cuidados do período: ${feitas} de ${previstas} realizados no horário.`
    : ''
}

/**
 * A temperatura **com o que ela significa**, nunca sozinha.
 *
 * É a regra do arquivo em uma linha: "39,4" assusta sem informar; "acima do normal, já sob
 * medicação" informa. Extraída para cá porque os modelos precisam dela pela mesma razão que o
 * boletim padrão — e duas cópias divergiriam na primeira vez que alguém mexesse na faixa.
 */
function fraseDaTemperatura(temperatura: number | null): string {
  if (temperatura === null) {
    return ''
  }

  const leitura =
    temperatura >= 39.2
      ? 'acima do normal, já sob medicação'
      : temperatura <= 37.5
        ? 'abaixo do normal, sob aquecimento'
        : 'dentro do normal'

  return `Temperatura ${temperatura.toFixed(1).replace('.', ',')} °C — ${leitura}.`
}

/** Junta o que existe e descarta o que veio vazio, sem deixar espaço duplo no meio. */
function frase(...partes: string[]): string {
  return partes
    .map((parte) => parte.trim())
    .filter(Boolean)
    .join(' ')
}

export function montarTextoDoBoletim(fatos: FatosDoBoletim): string {
  const estado = fatos.exigeLigacao
    ? `${fatos.petNome} apresentou piora e ${COMO_ESTA[fatos.gravidade]}. Nossa equipe entrou em contato por telefone para explicar o quadro e a conduta.`
    : `${fatos.petNome} ${COMO_ESTA[fatos.gravidade]} neste momento.`

  return frase(
    estado,
    fatos.observado,
    fraseDasMedicacoes(fatos.feitas, fatos.previstas),
    fraseDaTemperatura(fatos.temperatura),
    FECHO,
  )
}

// ---------------------------------------------------------------------------
// Modelos prontos
// ---------------------------------------------------------------------------

/**
 * Texto pronto, com os dados do paciente já dentro — e feito para ser editado.
 *
 * O plantão escreve boletim entre duas medicações, com o paciente na mesa. Nesse minuto, a
 * diferença entre mandar notícia e não mandar é ter de redigir do zero: o campo em branco vira
 * "tudo bem por aqui", ou vira nada, e o responsável passa a tarde sem saber do animal.
 *
 * Por isso o modelo chega **completo**, e não como um esqueleto com lacunas para preencher.
 * Lacuna é trabalho adiado: `[nome]` e `[temperatura]` no meio de uma frase custam mais atenção
 * do que escrever a frase inteira, e são o que acaba enviado por engano quando alguém tem
 * pressa. Aqui o nome, as medicações do período e a última temperatura já vêm escritos; o que
 * sobra para o profissional é o que só ele sabe — e ele apaga, acrescenta e corrige à vontade,
 * porque o texto vai para um campo comum, não para um formulário.
 */
export type ModeloDeBoletim = {
  id: string
  /** Rótulo do botão na tela. Em português, como o texto — ver o cabeçalho deste arquivo. */
  rotulo: string
  texto: string
}

export type FatosDoModelo = {
  petNome: string
  gravidade: GravidadeClinica
  feitas: number
  previstas: number
  /** Última temperatura aferida, quando houve alguma. */
  temperatura: number | null
  /** Dias completos desde a entrada. Zero no primeiro dia. */
  diasInternado: number
}

/**
 * Os modelos, na ordem em que o plantão precisa deles.
 *
 * **O padrão vem primeiro** porque é o que serve a qualquer hora e a qualquer paciente; os
 * outros são situações, e situação é o que se procura quando o padrão não diz o que aconteceu.
 * A lista é curta de propósito: vinte modelos custam mais para escolher do que quatro para
 * escrever, e o campo continua aberto para quem não achar o seu aqui.
 *
 * Nenhum deles promete alta, horário ou resultado de exame. Boletim não é lugar de compromisso
 * que a clínica talvez não cumpra — e é exatamente o tipo de frase que um texto pronto faria
 * alguém enviar sem pensar.
 */
export function montarModelos(fatos: FatosDoModelo): ModeloDeBoletim[] {
  const { petNome } = fatos
  const medicacoes = fraseDasMedicacoes(fatos.feitas, fatos.previstas)
  const temperatura = fraseDaTemperatura(fatos.temperatura)

  return [
    {
      id: 'padrao',
      rotulo: 'Padrão do plantão',
      texto: frase(
        `${petNome} ${COMO_ESTA[fatos.gravidade]} neste momento.`,
        medicacoes,
        temperatura,
        FECHO,
      ),
    },
    {
      id: 'noite',
      rotulo: 'Passou bem a noite',
      texto: frase(
        `${petNome} passou bem a noite. Dormiu tranquilo e não houve intercorrência no período.`,
        medicacoes,
        temperatura,
        FECHO,
      ),
    },
    {
      id: 'alimento',
      rotulo: 'Aceitou alimento',
      texto: frase(
        `${petNome} aceitou o alimento oferecido e está se hidratando bem.`,
        medicacoes,
        temperatura,
        FECHO,
      ),
    },
    {
      id: 'pos-operatorio',
      rotulo: 'Pós-operatório',
      texto: frase(
        `${petNome} está se recuperando bem da anestesia. A ferida cirúrgica segue limpa e sem sinal de sangramento, e ele está com analgesia em dia.`,
        medicacoes,
        temperatura,
        FECHO,
      ),
    },
    {
      id: 'exame',
      rotulo: 'Exame realizado',
      texto: frase(
        `${petNome} passou pelo exame solicitado e tolerou bem o procedimento. Assim que o resultado sair, a veterinária responsável entra em contato para explicar.`,
        medicacoes,
        temperatura,
        FECHO,
      ),
    },
    {
      id: 'observacao',
      rotulo: 'Segue em observação',
      texto: frase(
        `${petNome} segue sob observação da equipe, com monitoramento de perto ao longo do turno.`,
        medicacoes,
        temperatura,
        FECHO,
      ),
    },
    {
      id: 'melhora',
      rotulo: 'Melhorou',
      texto: frase(
        `${petNome} apresentou melhora desde o último boletim: está mais ativo e responde melhor ao nosso manejo.`,
        medicacoes,
        temperatura,
        /*
         * O único modelo que fala do tempo de internação. Depois do segundo dia, "está melhor"
         * sozinho não responde à pergunta que o responsável está realmente fazendo — há quanto
         * tempo isso dura —, e o número responde sem prometer alta.
         */
        fatos.diasInternado >= 1
          ? `Está internado conosco há ${fatos.diasInternado} ${fatos.diasInternado === 1 ? 'dia' : 'dias'}.`
          : '',
        FECHO,
      ),
    },
  ]
}

/**
 * A última mensagem da internação: o animal foi para casa.
 *
 * Fecha a conversa que os boletins abriram. Sem ela, a última coisa que o responsável leu no
 * aplicativo continua sendo o boletim das 14h — e ele fica com o celular na mão num sábado à
 * noite sem saber se pode parar de olhar.
 *
 * Só existe para o desfecho **alta**. Óbito e transferência não saem por mensagem, pela mesma
 * razão que a piora não sai: quem recebe essa notícia por notificação não volta à clínica.
 *
 * Três coisas, nesta ordem, e nada além: **foi para casa**, quanto tempo ficou, e o que fazer
 * agora. A gratidão vem no fim porque no começo soa a formulário.
 */
export type FatosDaAlta = {
  petNome: string
  horas: number
  /** Orientação de alta escrita pelo veterinário. Vazio quando ele não escreveu nada. */
  orientacao: string
}

export function montarTextoDeAlta(fatos: FatosDaAlta): string {
  const partes: string[] = []

  /*
   * "Ficou 3 dias" e "ficou 18 horas" são a mesma informação em unidades diferentes, e quem
   * recebe lê a que corresponde à própria experiência: quem deixou o animal de manhã e buscou à
   * tarde não pensa em dias.
   */
  const dias = Math.floor(fatos.horas / 24)
  const permanencia =
    dias >= 1
      ? `${dias} ${dias === 1 ? 'dia' : 'dias'}`
      : `${Math.max(1, fatos.horas)} ${fatos.horas === 1 ? 'hora' : 'horas'}`

  partes.push(`${fatos.petNome} recebeu alta e já está indo para casa.`)
  partes.push(`Ficou ${permanencia} internado conosco.`)

  if (fatos.orientacao.trim()) {
    partes.push(fatos.orientacao.trim())
  }

  partes.push(
    'As orientações e a receita foram entregues na recepção. Qualquer dúvida, estamos à disposição.',
  )

  return partes.join(' ')
}
