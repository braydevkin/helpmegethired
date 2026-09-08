import { normalise } from "../text";

// Words and phrases that make a heading part read as a degree rather than an institution, in
// Portuguese and English, compared after normalisation.
export const DEGREE_TERMS: readonly string[] = [
  "bacharelado",
  "bacharel",
  "bachelor",
  "bachelors",
  "bachelor's",
  "licenciatura",
  "tecnologo",
  "tecnologa",
  "tecnologia em",
  "curso superior",
  "graduacao",
  "pos-graduacao",
  "pos graduacao",
  "especializacao",
  "mestrado",
  "mestre",
  "master",
  "masters",
  "master's",
  "mba",
  "phd",
  "ph.d",
  "doutorado",
  "doutor",
  "doctorate",
  "doctor",
  "msc",
  "bsc",
  "beng",
  "meng",
  "ba",
  "bs",
  "ma",
  "ms",
  "llb",
  "associate degree",
  "diploma",
  "curso tecnico",
  "tecnico em",
  "ensino medio",
  "high school",
  "bootcamp",
];

const single = new Set(DEGREE_TERMS.filter((term) => !term.includes(" ")));
const phrases = DEGREE_TERMS.filter((term) => term.includes(" "));

export function hasDegreeTerm(text: string): boolean {
  const normalised = normalise(text);
  const words = normalised.split(/[^\p{L}\p{N}.'-]+/u).map((word) => word.replace(/[.'-]+$/u, ""));

  return words.some((word) => single.has(word)) || phrases.some((phrase) => ` ${normalised} `.includes(` ${phrase} `));
}
