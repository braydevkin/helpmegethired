import styles from "./timeline-marker.module.css";

// The dot of one entry with the line that carries the eye to the next one.
export function TimelineMarker() {
  return <span aria-hidden="true" className={styles.marker} />;
}
