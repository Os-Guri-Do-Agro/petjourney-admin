/**
 * Gerado na escolha das fotos (18/11/2026): os arquivos de `public/demo/pacientes` por grupo, sem a
 * extensão. Créditos em `public/demo/pacientes/CREDITOS.md`.
 */
export type GrupoDeFoto =
  | 'cao-srd'
  | 'cao-shih-tzu'
  | 'cao-yorkshire'
  | 'cao-labrador'
  | 'cao-golden'
  | 'cao-buldogue-frances'
  | 'cao-spitz'
  | 'cao-poodle'
  | 'cao-lhasa'
  | 'cao-beagle'
  | 'cao-border-collie'
  | 'cao-pastor-alemao'
  | 'cao-dachshund'
  | 'cao-pug'
  | 'cao-maltes'
  | 'cao-schnauzer'
  | 'cao-pit-bull'
  | 'cao-rottweiler'
  | 'cao-boxer'
  | 'cao-husky'
  | 'cao-cocker'
  | 'cao-cavalier'
  | 'gato-srd'
  | 'gato-siames'
  | 'gato-persa'
  | 'gato-maine-coon'
  | 'gato-angora'
  | 'gato-ragdoll'
  | 'gato-british'
  | 'gato-sphynx'
  | 'coelho'
  | 'porquinho'
  | 'hamster'
  | 'calopsita'
  | 'periquito'
  | 'jabuti'
  | 'furao'

export const FOTOS_POR_GRUPO: Partial<Record<GrupoDeFoto, readonly string[]>> = {
  'cao-srd': ['cao-srd-01', 'cao-srd-02', 'cao-srd-03', 'cao-srd-04', 'cao-srd-05'],
  'cao-shih-tzu': ['cao-shih-tzu-01', 'cao-shih-tzu-02', 'cao-shih-tzu-03'],
  'cao-yorkshire': ['cao-yorkshire-01', 'cao-yorkshire-02', 'cao-yorkshire-03'],
  'cao-labrador': ['cao-labrador-01', 'cao-labrador-02', 'cao-labrador-03', 'cao-labrador-04'],
  'cao-golden': ['cao-golden-01', 'cao-golden-02', 'cao-golden-03'],
  'cao-buldogue-frances': ['cao-buldogue-frances-01', 'cao-buldogue-frances-02'],
  'cao-spitz': ['cao-spitz-01', 'cao-spitz-02', 'cao-spitz-03', 'cao-spitz-04'],
  'cao-poodle': ['cao-poodle-01', 'cao-poodle-02'],
  'cao-lhasa': ['cao-lhasa-01', 'cao-lhasa-02'],
  'cao-beagle': ['cao-beagle-01', 'cao-beagle-02', 'cao-beagle-03', 'cao-beagle-04'],
  'cao-border-collie': ['cao-border-collie-01'],
  'cao-pastor-alemao': ['cao-pastor-alemao-01', 'cao-pastor-alemao-02', 'cao-pastor-alemao-03'],
  'cao-dachshund': ['cao-dachshund-01'],
  'cao-maltes': ['cao-maltes-01', 'cao-maltes-02'],
  'cao-schnauzer': ['cao-schnauzer-01', 'cao-schnauzer-02', 'cao-schnauzer-03'],
  'cao-pit-bull': ['cao-pit-bull-01', 'cao-pit-bull-02', 'cao-pit-bull-03'],
  'cao-rottweiler': ['cao-rottweiler-01', 'cao-rottweiler-02'],
  'cao-boxer': ['cao-boxer-01'],
  'cao-husky': ['cao-husky-01'],
  'cao-cocker': ['cao-cocker-01'],
  'gato-srd': [
    'gato-srd-01',
    'gato-srd-02',
    'gato-srd-03',
    'gato-srd-04',
    'gato-srd-05',
    'gato-srd-06',
  ],
  'gato-siames': ['gato-siames-01', 'gato-siames-02', 'gato-siames-03'],
  'gato-persa': ['gato-persa-01', 'gato-persa-02'],
  'gato-maine-coon': ['gato-maine-coon-01', 'gato-maine-coon-02', 'gato-maine-coon-03'],
  'gato-angora': ['gato-angora-01', 'gato-angora-02', 'gato-angora-03'],
  'gato-ragdoll': ['gato-ragdoll-01', 'gato-ragdoll-02', 'gato-ragdoll-03', 'gato-ragdoll-04'],
  'gato-british': ['gato-british-01', 'gato-british-02'],
  'gato-sphynx': ['gato-sphynx-01'],
  coelho: ['coelho-01'],
  porquinho: ['porquinho-01'],
  hamster: ['hamster-01'],
  calopsita: ['calopsita-01'],
  furao: ['furao-01', 'furao-02'],
}

/** A foto de pets específicos, quando o cadastro descreve a pelagem (gata preta, gato laranja). */
export const FOTO_ESCOLHIDA: Record<string, string> = {
  'demo-pac-011-2': 'gato-srd-06',
  'demo-pac-044': 'gato-srd-06',
  'demo-pac-015-2': 'gato-srd-03',
  'demo-pac-042': 'gato-srd-04',
  'demo-pac-033': 'gato-srd-05',
  'demo-pac-033-2': 'gato-srd-01',
  'demo-pac-026': 'cao-srd-04',
  'demo-pac-040': 'cao-srd-05',
}
