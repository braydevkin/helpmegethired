"use client";

import type { CurationProgress, CurationProgressState, CurationStatements } from "@helpmegethired/shared";

import { ErrorMessage } from "../../../../components/atoms/error-message/error-message";
import { AnalysisProgress } from "../../../../components/organisms/analysis-progress/analysis-progress";
import { StatementList } from "../../../../components/organisms/statement-list/statement-list";
import { statementsSummaryOf, type RunSource } from "../../../../lib/curation-analysis/view";
import { useCurationProgress } from "../../../../lib/curation-progress/use-curation-progress";
import { phaseOf } from "../../../../lib/curation-progress/view";
import { readCurationAction } from "./actions";
import { AnalysisHeader, CompletedClosing, ReplacedAnalysis, RunPanels, StoppedBanner } from "./analysis-sections";
import { useCurationActions, type CurationActions } from "./use-curation-actions";
import { useStatements, type ReviewableStatements } from "./use-statements";
import styles from "./analysis.module.css";

export interface AnalysisLinks {
  journey: string;
  modelChoice: string;
}

export interface AnalysisFlowProps {
  initial: CurationProgressState;
  initialStatements: CurationStatements;
  run: RunSource;
  links: AnalysisLinks;
}

interface CurationViewProps {
  progress: CurationProgress;
  statements: ReviewableStatements;
  actions: CurationActions;
  run: RunSource;
  links: AnalysisLinks;
}

const PREVIOUS_STATEMENTS_NOTE = "These come from your last completed analysis, which stays in use until the new one completes.";

// The Statements of the last completed Curation stay listed while a newer run is in flight.
function sectionsOf(progress: CurationProgress, statementCount: number) {
  const phase = phaseOf(progress);
  const completed = phase === "completed";

  return {
    completed,
    stopped: phase === "failed" || phase === "cancelled",
    running: phase === "active" || phase === "paused",
    statements: completed || statementCount > 0,
  };
}

export function AnalysisFlow({ initial, initialStatements, run, links }: AnalysisFlowProps) {
  const { state, replace } = useCurationProgress(initial, readCurationAction);
  const progress = state.progress;
  const statements = useStatements(initialStatements, progress?.status === "completed" ? progress.curationId : null);
  const actions = useCurationActions(replace);

  if (progress === null) {
    return <ReplacedAnalysis journeyHref={links.journey} />;
  }

  return <CurationView progress={progress} statements={statements} actions={actions} run={run} links={links} />;
}

function CurationView({ progress, statements, actions, run, links }: CurationViewProps) {
  const shown = sectionsOf(progress, statements.statements.length);
  const message = actions.message ?? statements.message;

  return (
    <div className={styles.flow}>
      <AnalysisHeader progress={progress} completed={shown.completed} />
      <AnalysisProgress progress={progress} variant="page" />
      {message && <ErrorMessage>{message}</ErrorMessage>}
      {shown.stopped && <StoppedBanner progress={progress} actions={actions} modelChoiceHref={links.modelChoice} />}
      <RunPanels progress={progress} run={run} actions={actions} running={shown.running} />
      {shown.statements && (
        <StatementList
          statements={statements.statements}
          summary={statementsSummaryOf(statements.statements)}
          note={shown.completed ? undefined : PREVIOUS_STATEMENTS_NOTE}
          reviewing={statements.reviewing}
          onReview={statements.review}
        />
      )}
      {shown.completed && <CompletedClosing progress={progress} actions={actions} />}
    </div>
  );
}
