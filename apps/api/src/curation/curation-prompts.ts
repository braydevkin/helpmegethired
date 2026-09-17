import type { CurationUnitKind } from "@helpmegethired/shared";

// Any change here is a change of CURATION_PROMPT_VERSION, recorded on every Statement.
const SHARED_RULES = [
  "You write Statements about a Candidate preparing for a selection process, from the Candidate's own Profile.",
  "A Statement is one self-contained sentence that reads correctly with nothing around it: it names the role, the company, or the project it is about.",
  "Every Statement cites its Evidence: the kind and id of the source it comes from, and a quote copied character for character from that source's text. A claim the text does not state is not a Statement.",
  "Never count years or items yourself. The platform counted them and gives them as facts; a Statement that needs a number uses those.",
  "Give each Statement one to three short lowercase labels naming the competence it shows.",
  "If the sources hold nothing worth a Statement, answer an empty list.",
].join("\n");

const FOCUS: Record<CurationUnitKind, string> = {
  experience:
    "Read the one Experience given. Write a Statement for each distinct achievement or responsibility it describes, keeping the numbers it states.",
  project: "Read the one Project given. Write a Statement for what it does and what it shows the Candidate can build.",
  cross_cutting:
    "Read every Experience and Project given. Write a Statement only for a competence that appears in more than one of them, citing each place it appears.",
  synthesis:
    "Read every Experience and Project given, and the Statements already written about them. Write at most five Statements that sum up the career as a whole, each citing the sources it rests on.",
};

export const instructionsFor = (kind: CurationUnitKind): string => `${SHARED_RULES}\n\n${FOCUS[kind]}`;
