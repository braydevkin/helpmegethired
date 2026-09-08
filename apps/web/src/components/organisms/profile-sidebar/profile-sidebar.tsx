import { CardLabel } from "../../atoms/card-label/card-label";
import { CertificationEntry, type CertificationEntryProps } from "../../molecules/certification-entry/certification-entry";
import { CompletenessCard, type CompletenessCardProps } from "../../molecules/completeness-card/completeness-card";
import { ContactRow, type ContactRowProps } from "../../molecules/contact-row/contact-row";
import { LanguageRow, type LanguageRowProps } from "../../molecules/language-row/language-row";
import styles from "./profile-sidebar.module.css";

export interface ProfileSidebarProps {
  completeness: CompletenessCardProps;
  contact: readonly ContactRowProps[];
  languages: readonly LanguageRowProps[];
  certifications: readonly CertificationEntryProps[];
}

// The facts about the Candidate: how complete the Profile is, how to reach them, and what
// a section with nothing in it does not show at all.
export function ProfileSidebar({ completeness, contact, languages, certifications }: ProfileSidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <CompletenessCard {...completeness} />
      <section aria-label="Contact" className={styles.card}>
        <CardLabel>Contact</CardLabel>
        <ul className={styles.rows}>
          {contact.map((row) => (
            <ContactRow key={row.label} {...row} />
          ))}
        </ul>
      </section>
      {languages.length > 0 && (
        <section aria-label="Languages" className={styles.card}>
          <CardLabel>Languages</CardLabel>
          <ul className={styles.languages}>
            {languages.map((language) => (
              <LanguageRow key={language.name} {...language} />
            ))}
          </ul>
        </section>
      )}
      {certifications.length > 0 && (
        <section aria-label="Certifications" className={styles.card}>
          <CardLabel>Certifications</CardLabel>
          <ul className={styles.rows}>
            {certifications.map((certification) => (
              <CertificationEntry key={certification.name} {...certification} />
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
