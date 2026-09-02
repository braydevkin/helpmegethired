import { describe, expect, it } from "vitest";

import { EnvironmentValidationError, validateEnvironment } from "./validate-environment";

const complete = {
  NODE_ENV: "production",
  PORT: "8080",
  WEB_ORIGIN: "https://helpmegethired.example",
};

describe("validateEnvironment", () => {
  it("parses every variable into its typed value", () => {
    expect(validateEnvironment(complete)).toEqual({
      NODE_ENV: "production",
      PORT: 8080,
      WEB_ORIGIN: "https://helpmegethired.example",
    });
  });

  it("applies defaults for the optional variables", () => {
    expect(validateEnvironment({ WEB_ORIGIN: complete.WEB_ORIGIN })).toEqual({
      NODE_ENV: "development",
      PORT: 3001,
      WEB_ORIGIN: complete.WEB_ORIGIN,
    });
  });

  it("drops variables the API does not declare", () => {
    const parsed = validateEnvironment({ ...complete, HOME: "/home/candidate" });

    expect(parsed).not.toHaveProperty("HOME");
  });

  it.each([
    ["a missing WEB_ORIGIN", { ...complete, WEB_ORIGIN: undefined }, "WEB_ORIGIN is required"],
    ["a relative WEB_ORIGIN", { ...complete, WEB_ORIGIN: "/app" }, "WEB_ORIGIN must be an absolute URL"],
    ["a non-numeric PORT", { ...complete, PORT: "http" }, "PORT must be a number"],
    ["a fractional PORT", { ...complete, PORT: "80.5" }, "PORT must be a whole number"],
    ["a PORT above 65535", { ...complete, PORT: "70000" }, "PORT must be between 1 and 65535"],
    ["an unknown NODE_ENV", { ...complete, NODE_ENV: "staging" }, "NODE_ENV Invalid option"],
  ])("fails on %s naming the variable", (_label, input, expectedProblem) => {
    expect(() => validateEnvironment(input)).toThrow(EnvironmentValidationError);
    expect(() => validateEnvironment(input)).toThrow(expectedProblem);
  });

  it("lists every problem in one message", () => {
    const message = () => validateEnvironment({ PORT: "0" });

    expect(message).toThrow("Invalid environment configuration:");
    expect(message).toThrow("PORT must be between 1 and 65535");
    expect(message).toThrow("WEB_ORIGIN is required");
  });
});
