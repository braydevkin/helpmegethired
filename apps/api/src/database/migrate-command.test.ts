import { describe, expect, it } from "vitest";

import { isMigrateCommand, migrateCommands } from "./migrate-command";

describe("isMigrateCommand", () => {
  it.each(migrateCommands)("accepts %s", (command) => {
    expect(isMigrateCommand(command)).toBe(true);
  });

  it.each(["sideways", "UP", "", undefined])("refuses %o", (value) => {
    expect(isMigrateCommand(value)).toBe(false);
  });

  it.each(["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"])(
    "refuses the inherited property %s",
    (value) => {
      expect(isMigrateCommand(value)).toBe(false);
    },
  );
});
