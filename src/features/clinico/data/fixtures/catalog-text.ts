/**
 * Tradução do catálogo clínico: diagnósticos, exames e bulário.
 *
 * Por que este texto não mora em `locales/*.json` como o resto da interface: **isto não é
 * interface, é conteúdo clínico**. Uma contraindicação e uma faixa de dose são a mesma
 * informação partida em duas — separá-las em arquivos diferentes obriga quem revisa o bulário a
 * abrir cinco arquivos para conferir um medicamento, e é assim que "não usar em coelhos" e a
 * dose de coelho param de concordar. Aqui cada medicamento continua sendo um bloco só, por
 * idioma, ao lado do bloco original.
 *
 * O português **não** aparece aqui: ele já é o texto de `medications.ts` e `catalogs.ts`, que
 * seguem sendo a fonte. Este arquivo é sobreposição — o que falta é substituído, o que não
 * consta cai no português. Assim um medicamento novo entra funcionando em todos os idiomas,
 * ainda que sem tradução, em vez de aparecer vazio.
 *
 * O inglês britânico é **derivado** do americano por uma tabela de grafia, e não escrito à mão.
 * Entre `en` e `en-GB` a diferença em texto clínico é ortográfica — *diarrhea/diarrhoea*,
 * *edema/oedema*, *hypokalemia/hypokalaemia* — e duas cópias inteiras divergiriam no primeiro
 * medicamento que alguém editasse só de um lado.
 *
 * A completude é garantida por teste (`catalog-text.spec.ts`), não por revisão: todo id do
 * catálogo precisa existir em todo idioma, com listas do mesmo tamanho da original — lista com
 * um item a menos é uma contraindicação que sumiu.
 */

import type { Locale } from '@/i18n/locales'

import type { PetSpecies } from '../types'

export type TextoDoMedicamento = {
  nome: string
  principioAtivo: string
  apresentacao: string
  indicacoes: string[]
  contraindicacoes: string[]
  efeitosAdversos: string[]
  interacoes: string[]
  observacao: string
  /** Nota da faixa de dose, por espécie. Só existe onde a fixture traz nota. */
  notas?: Partial<Record<PetSpecies, string>>
}

export type TextoDoCatalogo = {
  /** Descrição do diagnóstico, por código. */
  diagnosticos: Record<string, string>
  /** Nome do exame, por id. */
  exames: Record<string, string>
  medicamentos: Record<string, TextoDoMedicamento>
  /**
   * Nome do tipo de atendimento, por id.
   *
   * Traduzido por **id**, e não pelo `kind`, pela mesma razão dos exames: o nome é do
   * catálogo, não do enum. Uma clínica que renomeie "Consulta" para "Consulta de rotina"
   * mantém o próprio nome — a sobreposição só alcança o que ela conhece.
   */
  tipos: Record<string, string>
  /** Nome da sala, por id. Aparece no agrupamento "por sala" da agenda. */
  salas: Record<string, string>
}

// ---------------------------------------------------------------------------
// Inglês (americano)
// ---------------------------------------------------------------------------

const INGLES: TextoDoCatalogo = {
  diagnosticos: {
    'GE-01': 'Acute gastroenteritis',
    'DR-04': 'Flea allergy dermatitis',
    'DR-09': 'Bacterial otitis externa',
    'CV-02': 'Myxomatous mitral valve disease',
    'UR-03': 'Chronic kidney disease, stage 2',
    'UR-07': 'Feline idiopathic cystitis',
    'LO-05': 'Hip dysplasia',
    'LO-11': 'Intervertebral disc disease',
    'RE-02': 'Brachycephalic syndrome',
    'NE-06': 'Peripheral vestibular syndrome',
    'LF-01': 'Reactive lymphadenomegaly',
    'GN-00': 'Check-up with no abnormalities',
  },
  exames: {
    'exame-hemograma': 'Complete blood count',
    'exame-bioquimico': 'Biochemistry panel (ALT, ALP, urea, creatinine)',
    'exame-urina': 'Urinalysis',
    'exame-t4': 'Free T4',
    'exame-raiox': 'Chest radiograph',
    'exame-raiox-quadril': 'Hip radiograph',
    'exame-ultrassom': 'Abdominal ultrasound',
    'exame-eco': 'Doppler echocardiogram',
    'exame-citologia': 'Skin cytology',
  },
  tipos: {
    'tipo-consulta': 'Consultation',
    'tipo-retorno': 'Follow-up',
    'tipo-vacina': 'Vaccination',
    'tipo-exame': 'Imaging exam',
    'tipo-cirurgia': 'Surgery',
    'tipo-banho': 'Grooming',
    'tipo-emergencia': 'Emergency',
  },
  salas: {
    'sala-1': 'Exam room 1',
    'sala-2': 'Exam room 2',
    'sala-3': 'Exam room 3',
    'sala-cirurgia': 'Operating theatre',
    'sala-recuperacao': 'Recovery',
    'sala-isolamento': 'Isolation',
    'sala-banho': 'Grooming',
    'sala-exame': 'Imaging',
  },
  medicamentos: {
    'med-amoxicilina': {
      nome: 'Amoxicillin + Clavulanate 250 mg',
      principioAtivo: 'Amoxicillin',
      apresentacao: '250 mg tablet (200 mg amoxicillin + 50 mg clavulanate)',
      indicacoes: [
        'Skin and soft tissue infections',
        'Urinary tract infections',
        'Periodontal disease',
        'Respiratory infections',
      ],
      contraindicacoes: [
        'Hypersensitivity to penicillins or cephalosporins',
        'Use in rabbits, hamsters and guinea pigs (fatal dysbiosis)',
      ],
      efeitosAdversos: ['Vomiting', 'Diarrhea', 'Transient inappetence'],
      interacoes: ['Antagonism with bacteriostatics (tetracyclines, chloramphenicol)'],
      observacao: 'Giving it with food reduces gastric discomfort.',
      notas: {
        roedor: 'Oral beta-lactams cause fatal dysbiosis in herbivorous rodents.',
      },
    },
    'med-cefalexina': {
      nome: 'Cephalexin 300 mg',
      principioAtivo: 'Cephalexin',
      apresentacao: '300 mg tablet',
      indicacoes: [
        'Superficial and deep pyoderma',
        'Urinary tract infection',
        'Surgical wounds',
      ],
      contraindicacoes: ['Hypersensitivity to cephalosporins'],
      efeitosAdversos: ['Vomiting', 'Diarrhea', 'Salivation in cats'],
      interacoes: ['Aminoglycosides raise the risk of nephrotoxicity'],
      observacao: 'Deep pyoderma usually needs 4 to 6 weeks of treatment.',
    },
    'med-enrofloxacina': {
      nome: 'Enrofloxacin 50 mg',
      principioAtivo: 'Enrofloxacin',
      apresentacao: '50 mg tablet · 50 mg/mL injectable solution',
      indicacoes: [
        'Gram-negative infections',
        'Prostatitis and pyelonephritis',
        'Resistant otitis externa',
      ],
      contraindicacoes: [
        'Growing animals (articular cartilage damage)',
        'History of seizures',
      ],
      efeitosAdversos: [
        'Blindness from retinal degeneration in cats above 5 mg/kg/day',
        'Vomiting',
        'Anorexia',
      ],
      interacoes: [
        'Antacids and sucralfate reduce absorption',
        'Theophylline metabolism is prolonged',
      ],
      observacao: 'Keep two hours away from any supplement with calcium, iron or aluminum.',
      notas: {
        felina: 'Hard ceiling of 5 mg/kg/day: above that there is a risk of irreversible blindness.',
      },
    },
    'med-metronidazol': {
      nome: 'Metronidazole 250 mg',
      principioAtivo: 'Metronidazole',
      apresentacao: '250 mg tablet · 5 mg/mL injectable solution',
      indicacoes: ['Giardiasis', 'Anaerobic enteritis', 'Periodontal disease'],
      contraindicacoes: ['Pregnancy', 'Severe liver disease'],
      efeitosAdversos: [
        'Neurotoxicity with prolonged use (ataxia, nystagmus)',
        'Vomiting',
        'Metallic taste with food refusal',
      ],
      interacoes: ['Potentiates warfarin', 'Phenobarbital speeds up metabolism'],
      observacao: 'Do not exceed 60 mg/kg/day: above that neurotoxicity is expected.',
    },
    'med-meloxicam': {
      nome: 'Meloxicam 2 mg/mL',
      principioAtivo: 'Meloxicam',
      apresentacao: '2 mg/mL oral suspension · 2 mg/mL injectable',
      indicacoes: ['Osteoarthritis', 'Post-operative pain', 'Musculoskeletal conditions'],
      contraindicacoes: [
        'Dehydration or hypotension',
        'Decompensated kidney or liver disease',
        'Gastroduodenal ulcer',
        'Concurrent use with a corticosteroid',
      ],
      efeitosAdversos: ['Vomiting', 'Melena', 'Rising urea and creatinine'],
      interacoes: [
        'Corticosteroids: high ulcer risk',
        'Other NSAIDs',
        'Aminoglycosides and diuretics increase nephrotoxicity',
      ],
      observacao: 'Stop and reassess at the first sign of vomiting, diarrhea or reduced appetite.',
      notas: {
        canina: 'Loading dose of 0.2 mg/kg on day one, then 0.1 mg/kg maintenance.',
        felina:
          'Feline maintenance is about one fifth of the canine dose; prolonged use is not advised.',
      },
    },
    'med-carprofeno': {
      nome: 'Carprofen 25 mg',
      principioAtivo: 'Carprofen',
      apresentacao: '25 mg palatable tablet',
      indicacoes: ['Canine osteoarthritis', 'Perioperative pain'],
      contraindicacoes: ['Liver disease', 'Kidney disease', 'Blood dyscrasias'],
      efeitosAdversos: ['Idiosyncratic hepatotoxicity', 'Vomiting', 'Diarrhea'],
      interacoes: ['Corticosteroids', 'Other NSAIDs', 'Anticoagulants'],
      observacao: 'Check liver enzymes before starting and after two weeks of continuous use.',
      notas: {
        felina: 'No safe repeated dose has been established for cats.',
      },
    },
    'med-dipirona': {
      nome: 'Metamizole sodium 500 mg/mL',
      principioAtivo: 'Metamizole',
      apresentacao: '500 mg/mL oral and injectable solution',
      indicacoes: ['Mild to moderate pain', 'Fever', 'Colic'],
      contraindicacoes: ['Blood dyscrasias', 'Hypersensitivity to pyrazolones'],
      efeitosAdversos: [
        'Agranulocytosis (rare)',
        'Hypotension with rapid intravenous administration',
      ],
      interacoes: ['Chlorpromazine: risk of severe hypothermia'],
      observacao: 'Intravenous administration must be slow, over at least two minutes.',
      notas: {
        felina: 'Cats metabolize it slowly: lower dose, longer interval, short course.',
      },
    },
    'med-tramadol': {
      nome: 'Tramadol 50 mg/mL',
      principioAtivo: 'Tramadol',
      apresentacao: '50 mg/mL solution · 50 mg tablet',
      indicacoes: [
        'Moderate to severe pain',
        'Post-operative analgesia',
        'Chronic cancer pain',
      ],
      contraindicacoes: ['Epilepsy', 'Concurrent use of MAO inhibitors'],
      efeitosAdversos: ['Sedation', 'Dysphoria', 'Nausea', 'Mydriasis in cats'],
      interacoes: ['Fluoxetine and trazodone: risk of serotonin syndrome'],
      observacao: 'Controlled-substance prescription in duplicate (Brazilian Ordinance 344/98).',
      notas: {
        felina: 'Very bitter: refusal is common with the oral form.',
      },
    },
    'med-prednisolona': {
      nome: 'Prednisolone 20 mg',
      principioAtivo: 'Prednisolone',
      apresentacao: '20 mg tablet',
      indicacoes: [
        'Allergic dermatitis',
        'Immune-mediated disease',
        'Chronic inflammatory disease',
      ],
      contraindicacoes: [
        'Uncontrolled systemic infection',
        'Gastroduodenal ulcer',
        'Concurrent use with an NSAID',
        'Uncontrolled diabetes mellitus',
      ],
      efeitosAdversos: [
        'Polyuria, polydipsia and polyphagia',
        'Immunosuppression',
        'Muscle atrophy with prolonged use',
      ],
      interacoes: ['NSAIDs: high ulcer risk', 'Insulin becomes less effective'],
      observacao: 'Always taper after more than seven days of use; never stop abruptly.',
      notas: {
        canina:
          'Immunosuppression needs 2 to 4 mg/kg/day; the anti-inflammatory range is 0.5 to 1.',
      },
    },
    'med-omeprazol': {
      nome: 'Omeprazole 10 mg',
      principioAtivo: 'Omeprazole',
      apresentacao: '10 mg capsule',
      indicacoes: [
        'Gastroduodenal ulcer',
        'Reflux',
        'Protection during NSAID or corticosteroid use',
      ],
      contraindicacoes: ['Hypersensitivity to the active ingredient'],
      efeitosAdversos: ['Diarrhea', 'Flatulence', 'Hypergastrinemia with prolonged use'],
      interacoes: ['Reduces the absorption of ketoconazole and itraconazole'],
      observacao: 'Give on an empty stomach, thirty minutes before the first meal.',
    },
    'med-sucralfato': {
      nome: 'Sucralfate 1 g',
      principioAtivo: 'Sucralfate',
      apresentacao: '1 g tablet · 200 mg/mL suspension',
      indicacoes: ['Gastric ulcer', 'Esophagitis', 'Erosive gastritis'],
      contraindicacoes: ['Gastrointestinal obstruction'],
      efeitosAdversos: ['Constipation'],
      interacoes: [
        'Reduces the absorption of quinolones, tetracyclines and digoxin',
        'Keep two hours away from any other oral medication',
      ],
      observacao: 'It works as a physical barrier: it needs an empty stomach to bind to the lesion.',
    },
    'med-ondansetrona': {
      nome: 'Ondansetron 2 mg/mL',
      principioAtivo: 'Ondansetron',
      apresentacao: '2 mg/mL injectable solution',
      indicacoes: [
        'Refractory vomiting',
        'Chemotherapy-induced emesis',
        'Post-anesthetic nausea',
      ],
      contraindicacoes: ['Hypersensitivity to the active ingredient'],
      efeitosAdversos: ['Mild sedation', 'Constipation'],
      interacoes: ['Tramadol: may reduce the analgesic effect'],
      observacao: 'It does not treat the cause: investigate the source of the vomiting in parallel.',
    },
    'med-maropitant': {
      nome: 'Maropitant 10 mg/mL',
      principioAtivo: 'Maropitant',
      apresentacao: '10 mg/mL injectable solution · 16 mg tablet',
      indicacoes: ['Acute vomiting', 'Motion sickness', 'Prophylaxis of pre-anesthetic emesis'],
      contraindicacoes: ['Puppies and kittens under 8 weeks', 'Severe liver disease'],
      efeitosAdversos: ['Pain on subcutaneous injection', 'Ptyalism', 'Drowsiness'],
      interacoes: ['Highly plasma-protein bound: care with NSAIDs and anticonvulsants'],
      observacao: 'Chilling the solution reduces the pain of injection.',
      notas: {
        canina: 'Motion sickness uses 8 mg/kg orally, well above the antiemetic dose.',
      },
    },
    'med-furosemida': {
      nome: 'Furosemide 40 mg',
      principioAtivo: 'Furosemide',
      apresentacao: '40 mg tablet · 10 mg/mL injectable',
      indicacoes: [
        'Cardiogenic pulmonary edema',
        'Congestive heart failure',
        'Ascites',
      ],
      contraindicacoes: ['Dehydration', 'Anuria', 'Uncorrected hypokalemia'],
      efeitosAdversos: ['Dehydration', 'Hypokalemia', 'Pre-renal azotemia', 'Ototoxicity'],
      interacoes: [
        'NSAIDs reduce the diuretic effect',
        'Aminoglycosides increase ototoxicity',
        'Digoxin: hypokalemia potentiates toxicity',
      ],
      observacao: 'Recheck urea, creatinine and potassium five to seven days after starting.',
    },
    'med-acepromazina': {
      nome: 'Acepromazine 10 mg',
      principioAtivo: 'Acepromazine',
      apresentacao: '10 mg tablet · 10 mg/mL injectable',
      indicacoes: [
        'Chemical restraint',
        'Pre-anesthetic medication',
        'Anxiolysis during transport',
      ],
      contraindicacoes: [
        'Hypovolemia and shock',
        'History of seizures',
        'Heart disease with compromised output',
      ],
      efeitosAdversos: [
        'Hypotension',
        'Hypothermia',
        'Third eyelid prolapse',
        'Priapism in horses',
      ],
      interacoes: [
        'Metamizole: risk of severe hypothermia',
        'Potentiates general anesthetics',
      ],
      observacao: 'It has no analgesic effect: sedation without analgesia masks pain.',
      notas: {
        equina: 'Avoid in stallions because of the risk of priapism.',
      },
    },
    'med-ivermectina': {
      nome: 'Ivermectin 1%',
      principioAtivo: 'Ivermectin',
      apresentacao: '1% injectable solution (10 mg/mL)',
      indicacoes: ['Sarcoptic mange', 'Demodectic mange', 'Endoparasite infestations'],
      contraindicacoes: [
        'Breeds with the MDR1 mutation: Collie, Border Collie, Australian Shepherd, Shetland Sheepdog',
        'Puppies under 6 weeks',
        'Heart patients with microfilaremia',
      ],
      efeitosAdversos: [
        'Ataxia',
        'Mydriasis',
        'Central nervous system depression',
        'Coma',
      ],
      interacoes: ['Ketoconazole and ciclosporin increase brain concentration'],
      observacao: 'Rule out circulating microfilariae before the first dose.',
      notas: {
        canina: 'Test for MDR1 or start with a stepped-up dose in at-risk breeds.',
        reptil: 'Fatal in chelonians.',
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Espanhol
// ---------------------------------------------------------------------------

const ESPANHOL: TextoDoCatalogo = {
  diagnosticos: {
    'GE-01': 'Gastroenteritis aguda',
    'DR-04': 'Dermatitis alérgica a la picadura de pulga',
    'DR-09': 'Otitis externa bacteriana',
    'CV-02': 'Enfermedad mixomatosa de la válvula mitral',
    'UR-03': 'Enfermedad renal crónica, estadio 2',
    'UR-07': 'Cistitis idiopática felina',
    'LO-05': 'Displasia de cadera',
    'LO-11': 'Enfermedad del disco intervertebral',
    'RE-02': 'Síndrome braquicefálico',
    'NE-06': 'Síndrome vestibular periférico',
    'LF-01': 'Linfadenomegalia reactiva',
    'GN-00': 'Chequeo sin alteraciones',
  },
  exames: {
    'exame-hemograma': 'Hemograma completo',
    'exame-bioquimico': 'Perfil bioquímico (ALT, FA, urea, creatinina)',
    'exame-urina': 'Análisis de orina',
    'exame-t4': 'T4 libre',
    'exame-raiox': 'Radiografía torácica',
    'exame-raiox-quadril': 'Radiografía de cadera',
    'exame-ultrassom': 'Ecografía abdominal',
    'exame-eco': 'Ecocardiograma Doppler',
    'exame-citologia': 'Citología cutánea',
  },
  tipos: {
    'tipo-consulta': 'Consulta',
    'tipo-retorno': 'Revisión',
    'tipo-vacina': 'Vacunación',
    'tipo-exame': 'Examen de imagen',
    'tipo-cirurgia': 'Cirugía',
    'tipo-banho': 'Baño y peluquería',
    'tipo-emergencia': 'Urgencia',
  },
  salas: {
    'sala-1': 'Consultorio 1',
    'sala-2': 'Consultorio 2',
    'sala-3': 'Consultorio 3',
    'sala-cirurgia': 'Quirófano',
    'sala-recuperacao': 'Recuperación',
    'sala-isolamento': 'Aislamiento',
    'sala-banho': 'Baño y peluquería',
    'sala-exame': 'Imagen',
  },
  medicamentos: {
    'med-amoxicilina': {
      nome: 'Amoxicilina + Clavulánico 250 mg',
      principioAtivo: 'Amoxicilina',
      apresentacao: 'Comprimido de 250 mg (200 mg de amoxicilina + 50 mg de clavulánico)',
      indicacoes: [
        'Infecciones de piel y tejidos blandos',
        'Infecciones del tracto urinario',
        'Enfermedad periodontal',
        'Infecciones respiratorias',
      ],
      contraindicacoes: [
        'Hipersensibilidad a penicilinas o cefalosporinas',
        'Uso en conejos, hámsteres y cobayas (disbiosis mortal)',
      ],
      efeitosAdversos: ['Vómitos', 'Diarrea', 'Inapetencia transitoria'],
      interacoes: ['Antagonismo con bacteriostáticos (tetraciclinas, cloranfenicol)'],
      observacao: 'Administrar con comida reduce la molestia gástrica.',
      notas: {
        roedor: 'Los betalactámicos por vía oral causan disbiosis mortal en roedores herbívoros.',
      },
    },
    'med-cefalexina': {
      nome: 'Cefalexina 300 mg',
      principioAtivo: 'Cefalexina',
      apresentacao: 'Comprimido de 300 mg',
      indicacoes: [
        'Piodermia superficial y profunda',
        'Infección urinaria',
        'Heridas quirúrgicas',
      ],
      contraindicacoes: ['Hipersensibilidad a cefalosporinas'],
      efeitosAdversos: ['Vómitos', 'Diarrea', 'Salivación en gatos'],
      interacoes: ['Los aminoglucósidos aumentan el riesgo de nefrotoxicidad'],
      observacao: 'La piodermia profunda suele exigir de 4 a 6 semanas de tratamiento.',
    },
    'med-enrofloxacina': {
      nome: 'Enrofloxacina 50 mg',
      principioAtivo: 'Enrofloxacina',
      apresentacao: 'Comprimido de 50 mg · Solución inyectable de 50 mg/mL',
      indicacoes: [
        'Infecciones por gramnegativos',
        'Prostatitis y pielonefritis',
        'Otitis externa resistente',
      ],
      contraindicacoes: [
        'Animales en crecimiento (lesión del cartílago articular)',
        'Antecedentes de convulsiones',
      ],
      efeitosAdversos: [
        'Ceguera por degeneración retiniana en gatos por encima de 5 mg/kg/día',
        'Vómitos',
        'Anorexia',
      ],
      interacoes: [
        'Los antiácidos y el sucralfato reducen la absorción',
        'El metabolismo de la teofilina se prolonga',
      ],
      observacao: 'Separar dos horas de cualquier suplemento con calcio, hierro o aluminio.',
      notas: {
        felina: 'Techo rígido de 5 mg/kg/día: por encima hay riesgo de ceguera irreversible.',
      },
    },
    'med-metronidazol': {
      nome: 'Metronidazol 250 mg',
      principioAtivo: 'Metronidazol',
      apresentacao: 'Comprimido de 250 mg · Solución inyectable de 5 mg/mL',
      indicacoes: ['Giardiasis', 'Enteritis por anaerobios', 'Enfermedad periodontal'],
      contraindicacoes: ['Gestación', 'Hepatopatía grave'],
      efeitosAdversos: [
        'Neurotoxicidad con uso prolongado (ataxia, nistagmo)',
        'Vómitos',
        'Sabor metálico con rechazo del alimento',
      ],
      interacoes: ['Potencia la warfarina', 'El fenobarbital acelera el metabolismo'],
      observacao: 'No superar 60 mg/kg/día: por encima, la neurotoxicidad es esperable.',
    },
    'med-meloxicam': {
      nome: 'Meloxicam 2 mg/mL',
      principioAtivo: 'Meloxicam',
      apresentacao: 'Suspensión oral de 2 mg/mL · Inyectable de 2 mg/mL',
      indicacoes: ['Osteoartritis', 'Dolor posoperatorio', 'Afecciones musculoesqueléticas'],
      contraindicacoes: [
        'Deshidratación o hipotensión',
        'Enfermedad renal o hepática descompensada',
        'Úlcera gastroduodenal',
        'Uso concomitante con corticoide',
      ],
      efeitosAdversos: ['Vómitos', 'Melena', 'Elevación de urea y creatinina'],
      interacoes: [
        'Corticoides: riesgo alto de úlcera',
        'Otros AINE',
        'Los aminoglucósidos y diuréticos aumentan la nefrotoxicidad',
      ],
      observacao: 'Suspender y reevaluar ante vómitos, diarrea o caída del apetito.',
      notas: {
        canina: 'Carga de 0,2 mg/kg el primer día y mantenimiento de 0,1 mg/kg.',
        felina:
          'El mantenimiento felino es cerca de un quinto del canino; el uso prolongado no está indicado.',
      },
    },
    'med-carprofeno': {
      nome: 'Carprofeno 25 mg',
      principioAtivo: 'Carprofeno',
      apresentacao: 'Comprimido palatable de 25 mg',
      indicacoes: ['Osteoartritis canina', 'Dolor perioperatorio'],
      contraindicacoes: ['Hepatopatía', 'Nefropatía', 'Discrasias sanguíneas'],
      efeitosAdversos: ['Hepatotoxicidad idiosincrásica', 'Vómitos', 'Diarrea'],
      interacoes: ['Corticoides', 'Otros AINE', 'Anticoagulantes'],
      observacao: 'Medir enzimas hepáticas antes y tras dos semanas de uso continuado.',
      notas: {
        felina: 'No hay una dosis repetida segura establecida para gatos.',
      },
    },
    'med-dipirona': {
      nome: 'Metamizol sódico 500 mg/mL',
      principioAtivo: 'Metamizol',
      apresentacao: 'Solución oral e inyectable de 500 mg/mL',
      indicacoes: ['Dolor de intensidad leve a moderada', 'Fiebre', 'Cólico'],
      contraindicacoes: ['Discrasias sanguíneas', 'Hipersensibilidad a pirazolonas'],
      efeitosAdversos: [
        'Agranulocitosis (rara)',
        'Hipotensión en aplicación intravenosa rápida',
      ],
      interacoes: ['Clorpromazina: riesgo de hipotermia grave'],
      observacao: 'La aplicación intravenosa debe ser lenta, a lo largo de al menos dos minutos.',
      notas: {
        felina: 'Los gatos lo metabolizan despacio: dosis menor, intervalo mayor, uso corto.',
      },
    },
    'med-tramadol': {
      nome: 'Tramadol 50 mg/mL',
      principioAtivo: 'Tramadol',
      apresentacao: 'Solución de 50 mg/mL · Comprimido de 50 mg',
      indicacoes: [
        'Dolor moderado a intenso',
        'Analgesia posoperatoria',
        'Dolor crónico oncológico',
      ],
      contraindicacoes: ['Epilepsia', 'Uso concomitante de inhibidores de la MAO'],
      efeitosAdversos: ['Sedación', 'Disforia', 'Náuseas', 'Midriasis en gatos'],
      interacoes: ['Fluoxetina y trazodona: riesgo de síndrome serotoninérgico'],
      observacao: 'Receta de control especial por duplicado (Ordenanza brasileña 344/98).',
      notas: {
        felina: 'Muy amargo: el rechazo es común en la presentación oral.',
      },
    },
    'med-prednisolona': {
      nome: 'Prednisolona 20 mg',
      principioAtivo: 'Prednisolona',
      apresentacao: 'Comprimido de 20 mg',
      indicacoes: [
        'Dermatitis alérgica',
        'Enfermedades inmunomediadas',
        'Proceso inflamatorio crónico',
      ],
      contraindicacoes: [
        'Infección sistémica no controlada',
        'Úlcera gastroduodenal',
        'Uso concomitante con AINE',
        'Diabetes mellitus descompensada',
      ],
      efeitosAdversos: [
        'Poliuria, polidipsia y polifagia',
        'Inmunosupresión',
        'Atrofia muscular con uso prolongado',
      ],
      interacoes: ['AINE: riesgo alto de úlcera', 'La insulina reduce su efecto'],
      observacao: 'Retirada siempre gradual por encima de siete días de uso; nunca de golpe.',
      notas: {
        canina:
          'La inmunosupresión exige de 2 a 4 mg/kg/día; el rango antiinflamatorio es de 0,5 a 1.',
      },
    },
    'med-omeprazol': {
      nome: 'Omeprazol 10 mg',
      principioAtivo: 'Omeprazol',
      apresentacao: 'Cápsula de 10 mg',
      indicacoes: [
        'Úlcera gastroduodenal',
        'Reflujo',
        'Protección durante el uso de AINE o corticoide',
      ],
      contraindicacoes: ['Hipersensibilidad al principio activo'],
      efeitosAdversos: ['Diarrea', 'Flatulencia', 'Hipergastrinemia con uso prolongado'],
      interacoes: ['Reduce la absorción de ketoconazol e itraconazol'],
      observacao: 'Administrar en ayunas, treinta minutos antes de la primera comida.',
    },
    'med-sucralfato': {
      nome: 'Sucralfato 1 g',
      principioAtivo: 'Sucralfato',
      apresentacao: 'Comprimido de 1 g · Suspensión de 200 mg/mL',
      indicacoes: ['Úlcera gástrica', 'Esofagitis', 'Gastritis erosiva'],
      contraindicacoes: ['Obstrucción gastrointestinal'],
      efeitosAdversos: ['Estreñimiento'],
      interacoes: [
        'Reduce la absorción de quinolonas, tetraciclinas y digoxina',
        'Separar dos horas de cualquier otro medicamento oral',
      ],
      observacao: 'Actúa como barrera física: necesita el estómago vacío para adherirse a la lesión.',
    },
    'med-ondansetrona': {
      nome: 'Ondansetrón 2 mg/mL',
      principioAtivo: 'Ondansetrón',
      apresentacao: 'Solución inyectable de 2 mg/mL',
      indicacoes: [
        'Vómitos refractarios',
        'Emesis por quimioterapia',
        'Náuseas posanestésicas',
      ],
      contraindicacoes: ['Hipersensibilidad al principio activo'],
      efeitosAdversos: ['Sedación leve', 'Estreñimiento'],
      interacoes: ['Tramadol: puede reducir el efecto analgésico'],
      observacao: 'No trata la causa: investigar el origen de los vómitos en paralelo.',
    },
    'med-maropitant': {
      nome: 'Maropitant 10 mg/mL',
      principioAtivo: 'Maropitant',
      apresentacao: 'Solución inyectable de 10 mg/mL · Comprimido de 16 mg',
      indicacoes: ['Vómitos agudos', 'Cinetosis', 'Profilaxis de emesis preanestésica'],
      contraindicacoes: ['Cachorros de menos de 8 semanas', 'Hepatopatía grave'],
      efeitosAdversos: ['Dolor a la aplicación subcutánea', 'Sialorrea', 'Somnolencia'],
      interacoes: ['Alta unión a proteínas plasmáticas: cautela con AINE y anticonvulsivos'],
      observacao: 'Refrigerar la solución reduce el dolor al momento de la aplicación.',
      notas: {
        canina: 'La cinetosis usa 8 mg/kg por vía oral, dosis muy por encima de la antiemética.',
      },
    },
    'med-furosemida': {
      nome: 'Furosemida 40 mg',
      principioAtivo: 'Furosemida',
      apresentacao: 'Comprimido de 40 mg · Inyectable de 10 mg/mL',
      indicacoes: [
        'Edema pulmonar cardiogénico',
        'Insuficiencia cardíaca congestiva',
        'Ascitis',
      ],
      contraindicacoes: ['Deshidratación', 'Anuria', 'Hipopotasemia no corregida'],
      efeitosAdversos: ['Deshidratación', 'Hipopotasemia', 'Azotemia prerrenal', 'Ototoxicidad'],
      interacoes: [
        'Los AINE reducen el efecto diurético',
        'Los aminoglucósidos aumentan la ototoxicidad',
        'Digoxina: la hipopotasemia potencia la toxicidad',
      ],
      observacao: 'Reevaluar urea, creatinina y potasio entre cinco y siete días tras iniciar.',
    },
    'med-acepromazina': {
      nome: 'Acepromacina 10 mg',
      principioAtivo: 'Acepromacina',
      apresentacao: 'Comprimido de 10 mg · Inyectable de 10 mg/mL',
      indicacoes: [
        'Contención química',
        'Medicación preanestésica',
        'Ansiólisis en el transporte',
      ],
      contraindicacoes: [
        'Hipovolemia y shock',
        'Antecedentes de convulsiones',
        'Cardiopatía con gasto comprometido',
      ],
      efeitosAdversos: [
        'Hipotensión',
        'Hipotermia',
        'Prolapso del tercer párpado',
        'Priapismo en equinos',
      ],
      interacoes: [
        'Metamizol: riesgo de hipotermia grave',
        'Potencia los anestésicos generales',
      ],
      observacao: 'No tiene efecto analgésico: la sedación sin analgesia enmascara el dolor.',
      notas: {
        equina: 'Evitar en sementales por el riesgo de priapismo.',
      },
    },
    'med-ivermectina': {
      nome: 'Ivermectina 1%',
      principioAtivo: 'Ivermectina',
      apresentacao: 'Solución inyectable al 1% (10 mg/mL)',
      indicacoes: ['Sarna sarcóptica', 'Sarna demodécica', 'Endoparasitosis'],
      contraindicacoes: [
        'Razas con mutación MDR1: Collie, Border Collie, Pastor Australiano, Sheepdog',
        'Cachorros de menos de 6 semanas',
        'Cardiópatas con microfilaremia',
      ],
      efeitosAdversos: [
        'Ataxia',
        'Midriasis',
        'Depresión del sistema nervioso central',
        'Coma',
      ],
      interacoes: ['El ketoconazol y la ciclosporina aumentan la concentración cerebral'],
      observacao: 'Descartar microfilarias circulantes antes de la primera aplicación.',
      notas: {
        canina: 'Testar MDR1 o iniciar con dosis escalonada en razas de riesgo.',
        reptil: 'Mortal en quelonios.',
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Sérvio (latinica)
// ---------------------------------------------------------------------------

const SERVIO: TextoDoCatalogo = {
  diagnosticos: {
    'GE-01': 'Akutni gastroenteritis',
    'DR-04': 'Alergijski dermatitis na ujed buva',
    'DR-09': 'Bakterijski otitis externa',
    'CV-02': 'Miksomatozna bolest mitralnog zaliska',
    'UR-03': 'Hronična bolest bubrega, stadijum 2',
    'UR-07': 'Idiopatski cistitis mačaka',
    'LO-05': 'Displazija kukova',
    'LO-11': 'Bolest intervertebralnog diska',
    'RE-02': 'Brahicefalični sindrom',
    'NE-06': 'Periferni vestibularni sindrom',
    'LF-01': 'Reaktivna limfadenomegalija',
    'GN-00': 'Preventivni pregled bez patološkog nalaza',
  },
  exames: {
    'exame-hemograma': 'Kompletna krvna slika',
    'exame-bioquimico': 'Biohemijski profil (ALT, ALP, urea, kreatinin)',
    'exame-urina': 'Analiza urina',
    'exame-t4': 'Slobodni T4',
    'exame-raiox': 'Rendgenski snimak grudnog koša',
    'exame-raiox-quadril': 'Rendgenski snimak kukova',
    'exame-ultrassom': 'Ultrazvuk abdomena',
    'exame-eco': 'Dopler ehokardiografija',
    'exame-citologia': 'Citologija kože',
  },
  tipos: {
    'tipo-consulta': 'Pregled',
    'tipo-retorno': 'Kontrola',
    'tipo-vacina': 'Vakcinacija',
    'tipo-exame': 'Snimanje',
    'tipo-cirurgia': 'Operacija',
    'tipo-banho': 'Šišanje i kupanje',
    'tipo-emergencia': 'Hitan slučaj',
  },
  salas: {
    'sala-1': 'Ordinacija 1',
    'sala-2': 'Ordinacija 2',
    'sala-3': 'Ordinacija 3',
    'sala-cirurgia': 'Operaciona sala',
    'sala-recuperacao': 'Oporavak',
    'sala-isolamento': 'Izolacija',
    'sala-banho': 'Šišanje i kupanje',
    'sala-exame': 'Snimanje',
  },
  medicamentos: {
    'med-amoxicilina': {
      nome: 'Amoksicilin + klavulanska kiselina 250 mg',
      principioAtivo: 'Amoksicilin',
      apresentacao: 'Tableta od 250 mg (200 mg amoksicilina + 50 mg klavulanske kiseline)',
      indicacoes: [
        'Infekcije kože i mekih tkiva',
        'Infekcije urinarnog trakta',
        'Parodontalna bolest',
        'Respiratorne infekcije',
      ],
      contraindicacoes: [
        'Preosetljivost na peniciline ili cefalosporine',
        'Primena kod kunića, hrčaka i zamoraca (fatalna disbioza)',
      ],
      efeitosAdversos: ['Povraćanje', 'Dijareja', 'Prolazan gubitak apetita'],
      interacoes: ['Antagonizam sa bakteriostaticima (tetraciklini, hloramfenikol)'],
      observacao: 'Davanje uz hranu smanjuje želudačne tegobe.',
      notas: {
        roedor: 'Oralni beta-laktami izazivaju fatalnu disbiozu kod glodara biljojeda.',
      },
    },
    'med-cefalexina': {
      nome: 'Cefaleksin 300 mg',
      principioAtivo: 'Cefaleksin',
      apresentacao: 'Tableta od 300 mg',
      indicacoes: ['Površinska i duboka pioderma', 'Infekcija urinarnog trakta', 'Hirurške rane'],
      contraindicacoes: ['Preosetljivost na cefalosporine'],
      efeitosAdversos: ['Povraćanje', 'Dijareja', 'Salivacija kod mačaka'],
      interacoes: ['Aminoglikozidi povećavaju rizik od nefrotoksičnosti'],
      observacao: 'Duboka pioderma obično zahteva 4 do 6 nedelja lečenja.',
    },
    'med-enrofloxacina': {
      nome: 'Enrofloksacin 50 mg',
      principioAtivo: 'Enrofloksacin',
      apresentacao: 'Tableta od 50 mg · rastvor za injekciju 50 mg/mL',
      indicacoes: [
        'Infekcije gram-negativnim bakterijama',
        'Prostatitis i pijelonefritis',
        'Rezistentni otitis externa',
      ],
      contraindicacoes: ['Životinje u rastu (oštećenje zglobne hrskavice)', 'Konvulzije u anamnezi'],
      efeitosAdversos: [
        'Slepilo usled degeneracije retine kod mačaka pri dozi većoj od 5 mg/kg/dan',
        'Povraćanje',
        'Anoreksija',
      ],
      interacoes: ['Antacidi i sukralfat smanjuju apsorpciju', 'Usporen metabolizam teofilina'],
      observacao: 'Održavajte razmak od dva sata od bilo kog suplementa sa kalcijumom, gvožđem ili aluminijumom.',
      notas: {
        felina: 'Apsolutna gornja granica je 5 mg/kg/dan: iznad nje postoji rizik od nepovratnog slepila.',
      },
    },
    'med-metronidazol': {
      nome: 'Metronidazol 250 mg',
      principioAtivo: 'Metronidazol',
      apresentacao: 'Tableta od 250 mg · rastvor za injekciju 5 mg/mL',
      indicacoes: ['Giardijaza', 'Anaerobni enteritis', 'Parodontalna bolest'],
      contraindicacoes: ['Graviditet', 'Teška bolest jetre'],
      efeitosAdversos: [
        'Neurotoksičnost pri dugotrajnoj primeni (ataksija, nistagmus)',
        'Povraćanje',
        'Metalni ukus i odbijanje hrane',
      ],
      interacoes: ['Pojačava dejstvo varfarina', 'Fenobarbital ubrzava metabolizam'],
      observacao: 'Ne prekoračujte 60 mg/kg/dan: iznad te doze očekuje se neurotoksičnost.',
    },
    'med-meloxicam': {
      nome: 'Meloksikam 2 mg/mL',
      principioAtivo: 'Meloksikam',
      apresentacao: 'Oralna suspenzija 2 mg/mL · rastvor za injekciju 2 mg/mL',
      indicacoes: ['Osteoartritis', 'Postoperativni bol', 'Mišićno-skeletna oboljenja'],
      contraindicacoes: [
        'Dehidratacija ili hipotenzija',
        'Dekompenzovana bolest bubrega ili jetre',
        'Gastroduodenalni ulkus',
        'Istovremena primena sa kortikosteroidom',
      ],
      efeitosAdversos: ['Povraćanje', 'Melena', 'Porast uree i kreatinina'],
      interacoes: [
        'Kortikosteroidi: visok rizik od ulkusa',
        'Drugi NSAIL',
        'Aminoglikozidi i diuretici povećavaju nefrotoksičnost',
      ],
      observacao: 'Prekinite primenu i ponovo procenite stanje pri prvom znaku povraćanja, dijareje ili smanjenog apetita.',
      notas: {
        canina: 'Udarna doza od 0,2 mg/kg prvog dana, zatim 0,1 mg/kg kao doza održavanja.',
        felina: 'Doza održavanja kod mačaka iznosi oko petinu doze za pse; dugotrajna primena se ne preporučuje.',
      },
    },
    'med-carprofeno': {
      nome: 'Karprofen 25 mg',
      principioAtivo: 'Karprofen',
      apresentacao: 'Palatabilna tableta od 25 mg',
      indicacoes: ['Osteoartritis kod pasa', 'Perioperativni bol'],
      contraindicacoes: ['Bolest jetre', 'Bolest bubrega', 'Krvne diskrazije'],
      efeitosAdversos: ['Idiosinkratska hepatotoksičnost', 'Povraćanje', 'Dijareja'],
      interacoes: ['Kortikosteroidi', 'Drugi NSAIL', 'Antikoagulansi'],
      observacao: 'Proverite enzime jetre pre početka terapije i nakon dve nedelje neprekidne primene.',
      notas: {
        felina: 'Za mačke nije utvrđena bezbedna ponovljena doza.',
      },
    },
    'med-dipirona': {
      nome: 'Metamizol-natrijum 500 mg/mL',
      principioAtivo: 'Metamizol',
      apresentacao: 'Oralni i injekcioni rastvor 500 mg/mL',
      indicacoes: ['Blag do umeren bol', 'Groznica', 'Kolike'],
      contraindicacoes: ['Krvne diskrazije', 'Preosetljivost na pirazolone'],
      efeitosAdversos: ['Agranulocitoza (retko)', 'Hipotenzija pri brzoj intravenskoj primeni'],
      interacoes: ['Hlorpromazin: rizik od teške hipotermije'],
      observacao: 'Intravenska primena mora biti spora, u trajanju od najmanje dva minuta.',
      notas: {
        felina: 'Mačke ga sporo metabolišu: manja doza, duži interval, kratka terapija.',
      },
    },
    'med-tramadol': {
      nome: 'Tramadol 50 mg/mL',
      principioAtivo: 'Tramadol',
      apresentacao: 'Rastvor 50 mg/mL · tableta od 50 mg',
      indicacoes: [
        'Umeren do jak bol',
        'Postoperativna analgezija',
        'Hronični bol kod malignih oboljenja',
      ],
      contraindicacoes: ['Epilepsija', 'Istovremena primena MAO inhibitora'],
      efeitosAdversos: ['Sedacija', 'Disforija', 'Mučnina', 'Midrijaza kod mačaka'],
      interacoes: ['Fluoksetin i trazodon: rizik od serotoninskog sindroma'],
      observacao: 'Recept za kontrolisane supstance u dva primerka (brazilski Pravilnik 344/98).',
      notas: {
        felina: 'Veoma gorak: mačke često odbijaju oralni oblik.',
      },
    },
    'med-prednisolona': {
      nome: 'Prednizolon 20 mg',
      principioAtivo: 'Prednizolon',
      apresentacao: 'Tableta od 20 mg',
      indicacoes: [
        'Alergijski dermatitis',
        'Imunski posredovana bolest',
        'Hronična zapaljenska bolest',
      ],
      contraindicacoes: [
        'Nekontrolisana sistemska infekcija',
        'Gastroduodenalni ulkus',
        'Istovremena primena sa NSAIL',
        'Nekontrolisani dijabetes melitus',
      ],
      efeitosAdversos: [
        'Poliurija, polidipsija i polifagija',
        'Imunosupresija',
        'Atrofija mišića pri dugotrajnoj primeni',
      ],
      interacoes: ['NSAIL: visok rizik od ulkusa', 'Smanjena efikasnost insulina'],
      observacao: 'Posle više od sedam dana primene dozu uvek postepeno smanjujte; nikada ne prekidajte naglo.',
      notas: {
        canina: 'Za imunosupresiju je potrebno 2 do 4 mg/kg/dan; antiinflamatorni opseg je 0,5 do 1.',
      },
    },
    'med-omeprazol': {
      nome: 'Omeprazol 10 mg',
      principioAtivo: 'Omeprazol',
      apresentacao: 'Kapsula od 10 mg',
      indicacoes: [
        'Gastroduodenalni ulkus',
        'Refluks',
        'Zaštita tokom primene NSAIL ili kortikosteroida',
      ],
      contraindicacoes: ['Preosetljivost na aktivnu supstancu'],
      efeitosAdversos: ['Dijareja', 'Flatulencija', 'Hipergastrinemija pri dugotrajnoj primeni'],
      interacoes: ['Smanjuje apsorpciju ketokonazola i itrakonazola'],
      observacao: 'Dajte na prazan stomak, trideset minuta pre prvog obroka.',
    },
    'med-sucralfato': {
      nome: 'Sukralfat 1 g',
      principioAtivo: 'Sukralfat',
      apresentacao: 'Tableta od 1 g · suspenzija 200 mg/mL',
      indicacoes: ['Ulkus želuca', 'Ezofagitis', 'Erozivni gastritis'],
      contraindicacoes: ['Gastrointestinalna opstrukcija'],
      efeitosAdversos: ['Opstipacija'],
      interacoes: [
        'Smanjuje apsorpciju hinolona, tetraciklina i digoksina',
        'Održavajte razmak od dva sata od bilo kog drugog oralnog leka',
      ],
      observacao: 'Deluje kao fizička barijera: potreban mu je prazan stomak da bi se vezao za leziju.',
    },
    'med-ondansetrona': {
      nome: 'Ondansetron 2 mg/mL',
      principioAtivo: 'Ondansetron',
      apresentacao: 'Rastvor za injekciju 2 mg/mL',
      indicacoes: [
        'Refraktarno povraćanje',
        'Povraćanje izazvano hemioterapijom',
        'Postanestezijska mučnina',
      ],
      contraindicacoes: ['Preosetljivost na aktivnu supstancu'],
      efeitosAdversos: ['Blaga sedacija', 'Opstipacija'],
      interacoes: ['Tramadol: moguće smanjenje analgetskog efekta'],
      observacao: 'Ne otklanja uzrok: paralelno ispitajte poreklo povraćanja.',
    },
    'med-maropitant': {
      nome: 'Maropitant 10 mg/mL',
      principioAtivo: 'Maropitant',
      apresentacao: 'Rastvor za injekciju 10 mg/mL · tableta od 16 mg',
      indicacoes: ['Akutno povraćanje', 'Kinetoza', 'Profilaksa povraćanja pre anestezije'],
      contraindicacoes: ['Štenci i mačići mlađi od 8 nedelja', 'Teška bolest jetre'],
      efeitosAdversos: ['Bol pri subkutanoj injekciji', 'Ptijalizam', 'Pospanost'],
      interacoes: ['Visok stepen vezivanja za proteine plazme: oprez sa NSAIL i antikonvulzivima'],
      observacao: 'Hlađenje rastvora smanjuje bol pri injekciji.',
      notas: {
        canina: 'Za kinetozu se daje 8 mg/kg oralno, znatno više od antiemetičke doze.',
      },
    },
    'med-furosemida': {
      nome: 'Furosemid 40 mg',
      principioAtivo: 'Furosemid',
      apresentacao: 'Tableta od 40 mg · rastvor za injekciju 10 mg/mL',
      indicacoes: ['Kardiogeni edem pluća', 'Kongestivna srčana insuficijencija', 'Ascites'],
      contraindicacoes: ['Dehidratacija', 'Anurija', 'Nekorigovana hipokalemija'],
      efeitosAdversos: ['Dehidratacija', 'Hipokalemija', 'Prerenalna azotemija', 'Ototoksičnost'],
      interacoes: [
        'NSAIL smanjuju diuretski efekat',
        'Aminoglikozidi povećavaju ototoksičnost',
        'Digoksin: hipokalemija pojačava toksičnost',
      ],
      observacao: 'Ponovo proverite ureu, kreatinin i kalijum pet do sedam dana nakon početka terapije.',
    },
    'med-acepromazina': {
      nome: 'Acepromazin 10 mg',
      principioAtivo: 'Acepromazin',
      apresentacao: 'Tableta od 10 mg · rastvor za injekciju 10 mg/mL',
      indicacoes: [
        'Hemijska imobilizacija',
        'Premedikacija pre anestezije',
        'Anksioliza tokom transporta',
      ],
      contraindicacoes: [
        'Hipovolemija i šok',
        'Konvulzije u anamnezi',
        'Srčano oboljenje sa smanjenim minutnim volumenom',
      ],
      efeitosAdversos: [
        'Hipotenzija',
        'Hipotermija',
        'Prolaps trećeg očnog kapka',
        'Prijapizam kod konja',
      ],
      interacoes: ['Metamizol: rizik od teške hipotermije', 'Pojačava dejstvo opštih anestetika'],
      observacao: 'Nema analgetsko dejstvo: sedacija bez analgezije maskira bol.',
      notas: {
        equina: 'Izbegavajte kod pastuva zbog rizika od prijapizma.',
      },
    },
    'med-ivermectina': {
      nome: 'Ivermektin 1%',
      principioAtivo: 'Ivermektin',
      apresentacao: 'Rastvor za injekciju 1% (10 mg/mL)',
      indicacoes: ['Sarkoptična šuga', 'Demodikoza', 'Infestacije endoparazitima'],
      contraindicacoes: [
        'Rase sa mutacijom MDR1 (koli, border koli, australijski ovčar, šetlandski ovčar)',
        'Štenci mlađi od 6 nedelja',
        'Kardiološki pacijenti sa mikrofilaremijom',
      ],
      efeitosAdversos: ['Ataksija', 'Midrijaza', 'Depresija centralnog nervnog sistema', 'Koma'],
      interacoes: ['Ketokonazol i ciklosporin povećavaju koncentraciju u mozgu'],
      observacao: 'Pre prve doze isključite prisustvo cirkulišućih mikrofilarija.',
      notas: {
        canina: 'Kod rizičnih rasa uradite test na MDR1 ili počnite sa postepeno povećavanom dozom.',
        reptil: 'Fatalan za kornjače.',
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Árabe
// ---------------------------------------------------------------------------

const ARABE: TextoDoCatalogo = {
  diagnosticos: {
    'GE-01': 'التهاب المعدة والأمعاء الحاد',
    'DR-04': 'التهاب الجلد التحسسي الناتج عن البراغيث',
    'DR-09': 'التهاب الأذن الخارجية البكتيري',
    'CV-02': 'مرض الصمام التاجي المخاطي التنكسي',
    'UR-03': 'مرض الكلى المزمن: المرحلة 2',
    'UR-07': 'التهاب المثانة مجهول السبب لدى القطط',
    'LO-05': 'خلل تنسج مفصل الورك',
    'LO-11': 'مرض القرص بين الفقرات',
    'RE-02': 'متلازمة السلالات قصيرة الرأس',
    'NE-06': 'المتلازمة الدهليزية الطرفية',
    'LF-01': 'تضخم العقد اللمفية التفاعلي',
    'GN-00': 'فحص عام دون نتائج غير طبيعية',
  },
  exames: {
    'exame-hemograma': 'تعداد الدم الكامل',
    'exame-bioquimico': 'لوحة الكيمياء الحيوية (ALT، ALP، اليوريا، الكرياتينين)',
    'exame-urina': 'تحليل البول',
    'exame-t4': 'هرمون T4 الحر',
    'exame-raiox': 'أشعة سينية للصدر',
    'exame-raiox-quadril': 'أشعة سينية للورك',
    'exame-ultrassom': 'موجات فوق صوتية للبطن',
    'exame-eco': 'تخطيط صدى القلب بالدوبلر',
    'exame-citologia': 'فحص خلوي للجلد',
  },
  tipos: {
    'tipo-consulta': 'زيارة بيطرية',
    'tipo-retorno': 'زيارة متابعة',
    'tipo-vacina': 'تطعيم',
    'tipo-exame': 'فحص بالتصوير',
    'tipo-cirurgia': 'جراحة',
    'tipo-banho': 'استحمام وتجميل',
    'tipo-emergencia': 'طوارئ',
  },
  salas: {
    'sala-1': 'غرفة الفحص 1',
    'sala-2': 'غرفة الفحص 2',
    'sala-3': 'غرفة الفحص 3',
    'sala-cirurgia': 'غرفة العمليات',
    'sala-recuperacao': 'الإفاقة',
    'sala-isolamento': 'العزل',
    'sala-banho': 'الاستحمام والتجميل',
    'sala-exame': 'التصوير',
  },
  medicamentos: {
    'med-amoxicilina': {
      nome: 'أموكسيسيلين + كلافولانات 250 mg',
      principioAtivo: 'أموكسيسيلين',
      apresentacao: 'قرص 250 mg (200 mg أموكسيسيلين + 50 mg كلافولانات)',
      indicacoes: [
        'عدوى الجلد والأنسجة الرخوة',
        'عدوى المسالك البولية',
        'مرض دواعم الأسنان',
        'عدوى الجهاز التنفسي',
      ],
      contraindicacoes: [
        'فرط الحساسية للبنسلينات أو السيفالوسبورينات',
        'الاستخدام في الأرانب والهامستر وخنازير غينيا (خلل مميت في الفلورا المعوية)',
      ],
      efeitosAdversos: ['قيء', 'إسهال', 'فقدان شهية عابر'],
      interacoes: ['تضاد مع مضادات البكتيريا الكابحة للنمو (التتراسيكلينات، الكلورامفينيكول)'],
      observacao: 'إعطاؤه مع الطعام يقلل الانزعاج المعدي.',
      notas: {
        roedor: 'تسبب مضادات بيتا لاكتام الفموية خللًا مميتًا في الفلورا المعوية لدى القوارض العاشبة.',
      },
    },
    'med-cefalexina': {
      nome: 'سيفالكسين 300 mg',
      principioAtivo: 'سيفالكسين',
      apresentacao: 'قرص 300 mg',
      indicacoes: ['تقيح الجلد السطحي والعميق', 'عدوى المسالك البولية', 'الجروح الجراحية'],
      contraindicacoes: ['فرط الحساسية للسيفالوسبورينات'],
      efeitosAdversos: ['قيء', 'إسهال', 'سيلان اللعاب لدى القطط'],
      interacoes: ['تزيد الأمينوغليكوزيدات خطر السمية الكلوية'],
      observacao: 'يحتاج تقيح الجلد العميق عادة إلى 4 إلى 6 أسابيع من العلاج.',
    },
    'med-enrofloxacina': {
      nome: 'إنروفلوكساسين 50 mg',
      principioAtivo: 'إنروفلوكساسين',
      apresentacao: 'قرص 50 mg · محلول للحقن 50 mg/mL',
      indicacoes: [
        'عدوى البكتيريا سالبة الغرام',
        'التهاب البروستاتا والتهاب الحويضة والكلية',
        'التهاب الأذن الخارجية المقاوم للعلاج',
      ],
      contraindicacoes: ['الحيوانات في طور النمو (تلف الغضروف المفصلي)', 'تاريخ من النوبات التشنجية'],
      efeitosAdversos: [
        'عمى ناتج عن تنكس الشبكية لدى القطط بجرعات تزيد على 5 mg/kg يوميًا',
        'قيء',
        'فقدان الشهية',
      ],
      interacoes: ['تقلل مضادات الحموضة والسكرالفات امتصاصه', 'يطول استقلاب الثيوفيلين'],
      observacao: 'يجب ترك فاصل ساعتين بينه وبين أي مكمل يحتوي على الكالسيوم أو الحديد أو الألومنيوم.',
      notas: {
        felina: 'حد أقصى صارم قدره 5 mg/kg يوميًا: تجاوزه ينطوي على خطر عمى لا رجعة فيه.',
      },
    },
    'med-metronidazol': {
      nome: 'ميترونيدازول 250 mg',
      principioAtivo: 'ميترونيدازول',
      apresentacao: 'قرص 250 mg · محلول للحقن 5 mg/mL',
      indicacoes: ['داء الجيارديات', 'التهاب الأمعاء بالبكتيريا اللاهوائية', 'مرض دواعم الأسنان'],
      contraindicacoes: ['الحمل', 'مرض كبدي شديد'],
      efeitosAdversos: ['سمية عصبية مع الاستخدام المطول (رنح، رأرأة)', 'قيء', 'طعم معدني مع رفض الطعام'],
      interacoes: ['يعزز تأثير الوارفارين', 'يسرع الفينوباربيتال استقلابه'],
      observacao: 'يجب عدم تجاوز 60 mg/kg يوميًا: السمية العصبية متوقعة فوق هذه الجرعة.',
    },
    'med-meloxicam': {
      nome: 'ميلوكسيكام 2 mg/mL',
      principioAtivo: 'ميلوكسيكام',
      apresentacao: 'معلق فموي 2 mg/mL · مستحضر للحقن 2 mg/mL',
      indicacoes: ['الفصال العظمي', 'ألم ما بعد الجراحة', 'الاضطرابات العضلية الهيكلية'],
      contraindicacoes: [
        'الجفاف أو انخفاض ضغط الدم',
        'مرض كلوي أو كبدي غير معاوض',
        'قرحة المعدة والاثني عشر',
        'الاستخدام المتزامن مع الكورتيكوستيرويدات',
      ],
      efeitosAdversos: ['قيء', 'ميلينا (براز أسود قطراني)', 'ارتفاع اليوريا والكرياتينين'],
      interacoes: [
        'الكورتيكوستيرويدات: خطر مرتفع للإصابة بالقرحة',
        'مضادات الالتهاب غير الستيرويدية الأخرى',
        'تزيد الأمينوغليكوزيدات ومدرات البول السمية الكلوية',
      ],
      observacao: 'يجب إيقاف الدواء وإعادة التقييم عند أول علامة على القيء أو الإسهال أو ضعف الشهية.',
      notas: {
        canina: 'جرعة تحميل 0.2 mg/kg في اليوم الأول، ثم 0.1 mg/kg جرعة مداومة.',
        felina: 'جرعة المداومة للقطط نحو خمس جرعة الكلاب؛ ولا ينصح بالاستخدام المطول.',
      },
    },
    'med-carprofeno': {
      nome: 'كاربروفين 25 mg',
      principioAtivo: 'كاربروفين',
      apresentacao: 'قرص مستساغ 25 mg',
      indicacoes: ['الفصال العظمي لدى الكلاب', 'ألم ما حول الجراحة'],
      contraindicacoes: ['مرض كبدي', 'مرض كلوي', 'اعتلالات الدم'],
      efeitosAdversos: ['سمية كبدية فردية غير متوقعة', 'قيء', 'إسهال'],
      interacoes: ['الكورتيكوستيرويدات', 'مضادات الالتهاب غير الستيرويدية الأخرى', 'مضادات التخثر'],
      observacao: 'يجب فحص إنزيمات الكبد قبل البدء وبعد أسبوعين من الاستخدام المستمر.',
      notas: {
        felina: 'لم تثبت جرعة متكررة آمنة للقطط.',
      },
    },
    'med-dipirona': {
      nome: 'ميتاميزول الصوديوم 500 mg/mL',
      principioAtivo: 'ميتاميزول',
      apresentacao: 'محلول فموي وللحقن 500 mg/mL',
      indicacoes: ['ألم خفيف إلى متوسط', 'حمى', 'مغص'],
      contraindicacoes: ['اعتلالات الدم', 'فرط الحساسية للبيرازولونات'],
      efeitosAdversos: ['ندرة المحببات (نادرة)', 'انخفاض ضغط الدم مع الإعطاء الوريدي السريع'],
      interacoes: ['الكلوربرومازين: خطر انخفاض شديد في حرارة الجسم'],
      observacao: 'يجب أن يكون الإعطاء الوريدي بطيئًا، على مدى دقيقتين على الأقل.',
      notas: {
        felina: 'تستقلبه القطط ببطء: جرعة أقل، وفاصل أطول، ومدة علاج قصيرة.',
      },
    },
    'med-tramadol': {
      nome: 'ترامادول 50 mg/mL',
      principioAtivo: 'ترامادول',
      apresentacao: 'محلول 50 mg/mL · قرص 50 mg',
      indicacoes: ['ألم متوسط إلى شديد', 'تسكين الألم بعد الجراحة', 'ألم السرطان المزمن'],
      contraindicacoes: ['الصرع', 'الاستخدام المتزامن لمثبطات أكسيداز أحادي الأمين (MAO)'],
      efeitosAdversos: ['تهدئة', 'اضطراب المزاج (ديسفوريا)', 'غثيان', 'توسع الحدقة لدى القطط'],
      interacoes: ['الفلوكسيتين والترازودون: خطر متلازمة السيروتونين'],
      observacao: 'وصفة مادة خاضعة للرقابة من نسختين (اللائحة البرازيلية 344/98).',
      notas: {
        felina: 'مذاقه مر جدًا: رفض الشكل الفموي شائع.',
      },
    },
    'med-prednisolona': {
      nome: 'بريدنيزولون 20 mg',
      principioAtivo: 'بريدنيزولون',
      apresentacao: 'قرص 20 mg',
      indicacoes: ['التهاب الجلد التحسسي', 'أمراض ذات وساطة مناعية', 'أمراض التهابية مزمنة'],
      contraindicacoes: [
        'عدوى جهازية غير مسيطر عليها',
        'قرحة المعدة والاثني عشر',
        'الاستخدام المتزامن مع مضادات الالتهاب غير الستيرويدية',
        'داء السكري غير المنضبط',
      ],
      efeitosAdversos: [
        'كثرة التبول وكثرة العطش وكثرة الأكل',
        'تثبيط المناعة',
        'ضمور العضلات مع الاستخدام المطول',
      ],
      interacoes: [
        'مضادات الالتهاب غير الستيرويدية: خطر مرتفع للإصابة بالقرحة',
        'تنخفض فعالية الإنسولين',
      ],
      observacao: 'يجب دائمًا تخفيض الجرعة تدريجيًا بعد أكثر من سبعة أيام من الاستخدام؛ ولا يوقف فجأة أبدًا.',
      notas: {
        canina: 'يحتاج تثبيط المناعة إلى 2 إلى 4 mg/kg يوميًا؛ والنطاق المضاد للالتهاب من 0.5 إلى 1.',
      },
    },
    'med-omeprazol': {
      nome: 'أوميبرازول 10 mg',
      principioAtivo: 'أوميبرازول',
      apresentacao: 'كبسولة 10 mg',
      indicacoes: [
        'قرحة المعدة والاثني عشر',
        'الارتجاع',
        'الحماية أثناء استخدام مضادات الالتهاب غير الستيرويدية أو الكورتيكوستيرويدات',
      ],
      contraindicacoes: ['فرط الحساسية للمادة الفعالة'],
      efeitosAdversos: ['إسهال', 'غازات البطن', 'فرط غاسترين الدم مع الاستخدام المطول'],
      interacoes: ['يقلل امتصاص الكيتوكونازول والإيتراكونازول'],
      observacao: 'يعطى على معدة فارغة، قبل الوجبة الأولى بثلاثين دقيقة.',
    },
    'med-sucralfato': {
      nome: 'سكرالفات 1 g',
      principioAtivo: 'سكرالفات',
      apresentacao: 'قرص 1 g · معلق 200 mg/mL',
      indicacoes: ['قرحة المعدة', 'التهاب المريء', 'التهاب المعدة التآكلي'],
      contraindicacoes: ['انسداد الجهاز الهضمي'],
      efeitosAdversos: ['إمساك'],
      interacoes: [
        'يقلل امتصاص الكينولونات والتتراسيكلينات والديجوكسين',
        'يجب ترك فاصل ساعتين بينه وبين أي دواء فموي آخر',
      ],
      observacao: 'يعمل كحاجز فيزيائي: يحتاج إلى معدة فارغة ليرتبط بموضع الآفة.',
    },
    'med-ondansetrona': {
      nome: 'أوندانسيترون 2 mg/mL',
      principioAtivo: 'أوندانسيترون',
      apresentacao: 'محلول للحقن 2 mg/mL',
      indicacoes: ['قيء معند على العلاج', 'قيء ناتج عن العلاج الكيميائي', 'غثيان ما بعد التخدير'],
      contraindicacoes: ['فرط الحساسية للمادة الفعالة'],
      efeitosAdversos: ['تهدئة خفيفة', 'إمساك'],
      interacoes: ['الترامادول: قد ينخفض تأثيره المسكن'],
      observacao: 'لا يعالج السبب: يجب البحث عن مصدر القيء بالتوازي.',
    },
    'med-maropitant': {
      nome: 'ماروبيتانت 10 mg/mL',
      principioAtivo: 'ماروبيتانت',
      apresentacao: 'محلول للحقن 10 mg/mL · قرص 16 mg',
      indicacoes: ['قيء حاد', 'دوار الحركة', 'الوقاية من القيء قبل التخدير'],
      contraindicacoes: ['الجراء والهريرات بعمر أقل من 8 أسابيع', 'مرض كبدي شديد'],
      efeitosAdversos: ['ألم عند الحقن تحت الجلد', 'فرط إفراز اللعاب', 'نعاس'],
      interacoes: [
        'ارتباط مرتفع ببروتينات البلازما: الحذر مع مضادات الالتهاب غير الستيرويدية ومضادات الاختلاج',
      ],
      observacao: 'تبريد المحلول يقلل ألم الحقن.',
      notas: {
        canina: 'جرعة دوار الحركة 8 mg/kg عن طريق الفم، أعلى بكثير من الجرعة المضادة للقيء.',
      },
    },
    'med-furosemida': {
      nome: 'فوروسيميد 40 mg',
      principioAtivo: 'فوروسيميد',
      apresentacao: 'قرص 40 mg · مستحضر للحقن 10 mg/mL',
      indicacoes: ['وذمة رئوية قلبية المنشأ', 'قصور القلب الاحتقاني', 'الاستسقاء'],
      contraindicacoes: ['الجفاف', 'انقطاع البول', 'نقص بوتاسيوم الدم غير المصحح'],
      efeitosAdversos: ['جفاف', 'نقص بوتاسيوم الدم', 'آزوتيميا قبل كلوية', 'سمية أذنية'],
      interacoes: [
        'تقلل مضادات الالتهاب غير الستيرويدية التأثير المدر للبول',
        'تزيد الأمينوغليكوزيدات السمية الأذنية',
        'الديجوكسين: نقص بوتاسيوم الدم يعزز سميته',
      ],
      observacao: 'يعاد فحص اليوريا والكرياتينين والبوتاسيوم بعد خمسة إلى سبعة أيام من البدء.',
    },
    'med-acepromazina': {
      nome: 'أسيبرومازين 10 mg',
      principioAtivo: 'أسيبرومازين',
      apresentacao: 'قرص 10 mg · مستحضر للحقن 10 mg/mL',
      indicacoes: ['التقييد الكيميائي', 'التحضير الدوائي قبل التخدير', 'تخفيف القلق أثناء النقل'],
      contraindicacoes: [
        'نقص حجم الدم والصدمة',
        'تاريخ من النوبات التشنجية',
        'مرض قلبي مع ضعف النتاج القلبي',
      ],
      efeitosAdversos: [
        'انخفاض ضغط الدم',
        'انخفاض حرارة الجسم',
        'تدلي الجفن الثالث',
        'قساح (انتصاب مستمر) لدى الخيول',
      ],
      interacoes: ['الميتاميزول: خطر انخفاض شديد في حرارة الجسم', 'يعزز تأثير أدوية التخدير العام'],
      observacao: 'ليس له تأثير مسكن: التهدئة دون تسكين تخفي الألم.',
      notas: {
        equina: 'يجب تجنبه في الفحول بسبب خطر القساح.',
      },
    },
    'med-ivermectina': {
      nome: 'إيفرمكتين 1%',
      principioAtivo: 'إيفرمكتين',
      apresentacao: 'محلول للحقن 1% (10 mg/mL)',
      indicacoes: ['الجرب الساركوبتي', 'الجرب الديمودكسي', 'الإصابة بالطفيليات الداخلية'],
      contraindicacoes: [
        'السلالات الحاملة لطفرة MDR1: كولي (Collie)، بوردر كولي (Border Collie)، الراعي الأسترالي (Australian Shepherd)، راعي شتلاند (Shetland Sheepdog)',
        'الجراء بعمر أقل من 6 أسابيع',
        'مرضى القلب المصابون بالميكروفيلاريا في الدم',
      ],
      efeitosAdversos: ['رنح', 'توسع الحدقة', 'تثبيط الجهاز العصبي المركزي', 'غيبوبة'],
      interacoes: ['يزيد الكيتوكونازول والسيكلوسبورين تركيزه في الدماغ'],
      observacao: 'يجب استبعاد وجود الميكروفيلاريا الجائلة في الدم قبل الجرعة الأولى.',
      notas: {
        canina: 'في السلالات المعرضة للخطر، يجب إجراء اختبار MDR1 أو البدء بجرعة متدرجة الزيادة.',
        reptil: 'مميت للسلاحف.',
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Inglês britânico, derivado
// ---------------------------------------------------------------------------

/**
 * Grafias que mudam entre `en` e `en-GB` no vocabulário deste bulário.
 *
 * A troca é por radical e sem fronteira de palavra: `anesthetic` alcança `anesthetics` na mesma
 * regra. Uma passada só sobre a alternância inteira, para `edema → oedema` não voltar a ser
 * processado e virar `ooedema`.
 */
const GRAFIA_BRITANICA: Record<string, string> = {
  diarrhea: 'diarrhoea',
  esophagitis: 'oesophagitis',
  anesthetic: 'anaesthetic',
  hypergastrinemia: 'hypergastrinaemia',
  hypokalemia: 'hypokalaemia',
  hypovolemia: 'hypovolaemia',
  microfilaremia: 'microfilaraemia',
  azotemia: 'azotaemia',
  metabolize: 'metabolise',
  aluminum: 'aluminium',
  edema: 'oedema',
}

const PADRAO_BRITANICO = new RegExp(Object.keys(GRAFIA_BRITANICA).join('|'), 'gi')

function britanizar(texto: string): string {
  return texto.replace(PADRAO_BRITANICO, (achado) => {
    const trocado = GRAFIA_BRITANICA[achado.toLowerCase()] ?? achado

    /** `Edema` no começo da frase precisa voltar `Oedema`, não `oedema`. */
    return achado[0] === achado[0]?.toUpperCase()
      ? trocado[0]!.toUpperCase() + trocado.slice(1)
      : trocado
  })
}

function britanizarMedicamento(texto: TextoDoMedicamento): TextoDoMedicamento {
  return {
    nome: britanizar(texto.nome),
    principioAtivo: britanizar(texto.principioAtivo),
    apresentacao: britanizar(texto.apresentacao),
    indicacoes: texto.indicacoes.map(britanizar),
    contraindicacoes: texto.contraindicacoes.map(britanizar),
    efeitosAdversos: texto.efeitosAdversos.map(britanizar),
    interacoes: texto.interacoes.map(britanizar),
    observacao: britanizar(texto.observacao),
    notas: texto.notas
      ? Object.fromEntries(
          Object.entries(texto.notas).map(([especie, nota]) => [especie, britanizar(nota)]),
        )
      : undefined,
  }
}

function mapear<T, R>(registro: Record<string, T>, fn: (valor: T) => R): Record<string, R> {
  return Object.fromEntries(Object.entries(registro).map(([id, valor]) => [id, fn(valor)]))
}

const INGLES_BRITANICO: TextoDoCatalogo = {
  diagnosticos: mapear(INGLES.diagnosticos, britanizar),
  exames: mapear(INGLES.exames, britanizar),
  medicamentos: mapear(INGLES.medicamentos, britanizarMedicamento),
  tipos: mapear(INGLES.tipos, britanizar),
  salas: mapear(INGLES.salas, britanizar),
}

/**
 * Sobreposição por idioma. O português não entra: é a base, e vive nas fixtures.
 */
export const TEXTO_DO_CATALOGO: Partial<Record<Locale, TextoDoCatalogo>> = {
  en: INGLES,
  'en-GB': INGLES_BRITANICO,
  es: ESPANHOL,
  sr: SERVIO,
  ar: ARABE,
}
