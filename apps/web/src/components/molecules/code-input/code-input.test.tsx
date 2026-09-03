import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CodeInput } from "./code-input";

function renderCodeInput(props: Partial<Parameters<typeof CodeInput>[0]> = {}) {
  const onChange = vi.fn();

  render(
    <form>
      <CodeInput name="code" autoFocus onChange={onChange} {...props} />
    </form>,
  );

  const boxes = screen.getAllByLabelText("Verification digit");
  const hidden = document.querySelector<HTMLInputElement>('input[name="code"]');

  return { boxes, hidden, onChange };
}

describe("CodeInput", () => {
  it("renders six boxes, focuses the first, and reports an empty code", () => {
    const { boxes, hidden } = renderCodeInput();

    expect(boxes).toHaveLength(6);
    expect(boxes[0]).toHaveFocus();
    expect(hidden).toHaveValue("");
  });

  it("moves focus forward on each digit and joins them into the hidden value", () => {
    const { boxes, hidden, onChange } = renderCodeInput();

    fireEvent.change(boxes[0]!, { target: { value: "4" } });
    expect(boxes[1]).toHaveFocus();

    fireEvent.change(boxes[1]!, { target: { value: "8" } });
    expect(boxes[2]).toHaveFocus();

    expect(hidden).toHaveValue("48");
    expect(onChange).toHaveBeenLastCalledWith("48");
  });

  it("accepts a pasted 6-digit code and focuses the last box", () => {
    const { boxes, hidden } = renderCodeInput();

    fireEvent.paste(boxes[0]!, { clipboardData: { getData: () => "482913" } });

    expect(boxes.map((box) => (box as HTMLInputElement).value)).toEqual(["4", "8", "2", "9", "1", "3"]);
    expect(hidden).toHaveValue("482913");
    expect(boxes[5]).toHaveFocus();
  });

  it("fills a paste from the current box onwards and ignores non-digits", () => {
    const { boxes, hidden } = renderCodeInput();

    fireEvent.paste(boxes[2]!, { clipboardData: { getData: () => "12-34 5" } });

    expect(hidden).toHaveValue("1234");
    expect(boxes.map((box) => (box as HTMLInputElement).value)).toEqual(["", "", "1", "2", "3", "4"]);
    expect(boxes[5]).toHaveFocus();
  });

  it("clears the previous box and moves back on backspace in an empty box", () => {
    const { boxes, hidden } = renderCodeInput();

    fireEvent.change(boxes[0]!, { target: { value: "4" } });
    fireEvent.change(boxes[1]!, { target: { value: "8" } });
    expect(boxes[2]).toHaveFocus();

    fireEvent.keyDown(boxes[2]!, { key: "Backspace" });

    expect(boxes[1]).toHaveFocus();
    expect(hidden).toHaveValue("4");
  });

  it("clears the digit of the box itself when backspace is pressed on a filled box", () => {
    const { boxes, hidden } = renderCodeInput();

    fireEvent.change(boxes[0]!, { target: { value: "4" } });
    fireEvent.change(boxes[0]!, { target: { value: "" } });

    expect(hidden).toHaveValue("");
    expect(boxes[0]).toHaveValue("");
  });

  it("overwrites a filled box when a digit is typed into it", () => {
    const { boxes, hidden } = renderCodeInput();

    fireEvent.paste(boxes[0]!, { clipboardData: { getData: () => "000000" } });
    fireEvent.keyDown(boxes[0]!, { key: "4" });

    expect(hidden).toHaveValue("400000");
    expect(boxes[1]).toHaveFocus();
  });

  it("ignores a non-digit key", () => {
    const { boxes, hidden } = renderCodeInput();

    fireEvent.keyDown(boxes[0]!, { key: "a" });

    expect(hidden).toHaveValue("");
    expect(boxes[0]).toHaveFocus();
  });

  it("moves focus with the arrow keys without changing the digits", () => {
    const { boxes, hidden } = renderCodeInput();

    fireEvent.change(boxes[0]!, { target: { value: "4" } });
    fireEvent.keyDown(boxes[1]!, { key: "ArrowLeft" });
    expect(boxes[0]).toHaveFocus();

    fireEvent.keyDown(boxes[0]!, { key: "ArrowRight" });
    expect(boxes[1]).toHaveFocus();

    expect(hidden).toHaveValue("4");
  });

  it("shows the error as an alert and marks the boxes invalid", () => {
    const { boxes } = renderCodeInput({ error: "Enter all 6 digits of your code." });

    expect(screen.getByRole("alert")).toHaveTextContent("Enter all 6 digits of your code.");
    expect(boxes[0]).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("group", { name: "Verification code" })).toHaveAccessibleDescription(
      "Enter all 6 digits of your code.",
    );
  });
});
