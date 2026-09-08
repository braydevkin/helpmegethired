import styles from "./project-card.module.css";

export interface ProjectCardProps {
  name: string;
  description: string | null;
  stack: string | null;
}

export function ProjectCard({ name, description, stack }: ProjectCardProps) {
  return (
    <li className={styles.card}>
      <h3 className={styles.name}>{name}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {stack && <p className={styles.stack}>{stack}</p>}
    </li>
  );
}
