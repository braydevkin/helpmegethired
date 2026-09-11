import { act, render } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LocalTime } from "./local-time";

const AT = "2026-09-11T14:32:00.000Z";
const inThisTimeZone = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(AT));

describe("LocalTime", () => {
  it("writes the hour and minute in the browser's time zone", () => {
    const { container } = render(<LocalTime dateTime={AT} />);

    expect(container.querySelector("time")).toHaveTextContent(inThisTimeZone);
    expect(container.querySelector("time")).toHaveAttribute("datetime", AT);
  });

  it("leaves the time out of the server's HTML", () => {
    const html = renderToString(<LocalTime dateTime={AT} />);

    expect(html).toMatch(/^<time[^>]*><\/time>$/);
  });

  it("hydrates the server's HTML without a mismatch, then writes the local time", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<LocalTime dateTime={AT} />);
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, <LocalTime dateTime={AT} />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.querySelector("time")).toHaveTextContent(inThisTimeZone);
  });
});
