import { ProjectCard, type ProjectCardProps } from "../../molecules/project-card/project-card";
import { ProfileSection } from "../../molecules/profile-section/profile-section";
import styles from "./projects-grid.module.css";

export interface ProjectEntry extends ProjectCardProps {
  id: string;
}

export interface ProjectsGridProps {
  entries: readonly ProjectEntry[];
}

export function ProjectsGrid({ entries }: ProjectsGridProps) {
  return (
    <ProfileSection title="Projects">
      <ul className={styles.grid}>
        {entries.map(({ id, ...project }) => (
          <ProjectCard key={id} {...project} />
        ))}
      </ul>
    </ProfileSection>
  );
}
