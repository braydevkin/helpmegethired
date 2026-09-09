export const migrateCommands = ["up", "down"] as const;

export type MigrateCommand = (typeof migrateCommands)[number];

export function isMigrateCommand(value: string | undefined): value is MigrateCommand {
  return migrateCommands.some((command) => command === value);
}
