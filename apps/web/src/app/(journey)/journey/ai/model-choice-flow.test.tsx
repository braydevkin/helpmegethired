import { MODEL_CATALOGUE } from "@helpmegethired/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { SAVE_FAILED_MESSAGE } from "../../../../lib/model-choice-messages";
import { requestModelKeyTicketAction } from "./actions";
import { ModelChoiceFlow } from "./model-choice-flow";

vi.mock("./actions", () => ({ requestModelKeyTicketAction: vi.fn(), revokeModelKeyAction: vi.fn() }));

const API = "http://api.public.test";
const KEY = "sk-ant-api03-a-key-nobody-should-see-again";
const entry = MODEL_CATALOGUE[0]!;
const stored = { provider: "anthropic", modelId: "claude-sonnet-5", keyStored: true };

const ticketOf = (fill: string) => ({ ok: true as const, value: { ticket: fill.repeat(43), expiresAt: "2026-09-11T12:01:00.000Z" } });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const refusedKey = json(422, { statusCode: 422, message: "The Provider does not accept this key", error: "Unprocessable Entity", code: "model_key_invalid" });

let fetchMock: Mock;

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderFlow = () => render(<ModelChoiceFlow entry={entry} initialChoice={null} apiPublicUrl={API} />);

const submitKey = (key: string) => {
  fireEvent.change(screen.getByLabelText("Anthropic API key"), { target: { value: key } });
  fireEvent.click(screen.getByRole("button", { name: "Save key" }));
};

const requestOf = (call: number) => fetchMock.mock.calls[call] as [string, RequestInit];

describe("ModelChoiceFlow", () => {
  it("sends the key from the browser straight to the API with a ticket, and hands no server action the key", async () => {
    vi.mocked(requestModelKeyTicketAction).mockResolvedValue(ticketOf("a"));
    fetchMock.mockResolvedValue(json(200, stored));

    renderFlow();
    submitKey(KEY);

    expect(await screen.findByText("Your Anthropic key is stored")).toBeInTheDocument();
    expect(requestModelKeyTicketAction).toHaveBeenCalledWith();

    const [url, init] = requestOf(0);

    expect(url).toBe(`${API}/account/model`);
    expect(init).toMatchObject({ method: "PUT", credentials: "omit", headers: { authorization: `Bearer ${"a".repeat(43)}` } });
    expect(JSON.parse(init.body as string)).toEqual({ provider: "anthropic", modelId: "claude-sonnet-5", key: KEY });
  });

  it("asks for a fresh ticket on every submit, since a refused key spends one", async () => {
    vi.mocked(requestModelKeyTicketAction).mockResolvedValueOnce(ticketOf("a")).mockResolvedValueOnce(ticketOf("b"));
    fetchMock.mockResolvedValueOnce(refusedKey).mockResolvedValueOnce(json(200, stored));

    renderFlow();
    submitKey(KEY);

    expect(await screen.findByRole("alert")).toHaveTextContent("Anthropic doesn't accept this key.");
    expect(screen.getByLabelText("Anthropic API key")).toHaveValue("");

    submitKey(`${KEY}-corrected`);

    expect(await screen.findByText("Your Anthropic key is stored")).toBeInTheDocument();
    expect(requestModelKeyTicketAction).toHaveBeenCalledTimes(2);
    expect(requestOf(1)[1].headers).toMatchObject({ authorization: `Bearer ${"b".repeat(43)}` });
  });

  it("refuses a key too short to be one before asking for a ticket", async () => {
    renderFlow();
    submitKey("sk-ant-short");

    expect(await screen.findByRole("alert")).toHaveTextContent("A key has at least 20 characters");
    expect(requestModelKeyTicketAction).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends nothing when no ticket could be had, and says why", async () => {
    vi.mocked(requestModelKeyTicketAction).mockResolvedValue({ ok: false, message: "Your session has expired. Sign in again to continue." });

    renderFlow();
    submitKey(KEY);

    expect(await screen.findByRole("alert")).toHaveTextContent("Your session has expired.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says the key could not be saved when the API cannot be reached, without repeating the key", async () => {
    vi.mocked(requestModelKeyTicketAction).mockResolvedValue(ticketOf("a"));
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    renderFlow();
    submitKey(KEY);

    expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_FAILED_MESSAGE);
    expect(document.body.textContent).not.toContain(KEY);
  });
});
