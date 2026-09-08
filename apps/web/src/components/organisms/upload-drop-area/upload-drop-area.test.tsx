import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UploadDropArea } from "./upload-drop-area";

const hint = "PDF only · up to 5 MB · one file";

describe("UploadDropArea", () => {
  it("renders the drop zone copy and the three tips", () => {
    render(<UploadDropArea hint={hint} onFile={vi.fn()} />);

    expect(screen.getByText("Drop your PDF here, or browse files")).toBeInTheDocument();
    expect(screen.getByText(hint)).toBeInTheDocument();
    expect(screen.getByText("Text-based PDFs work best")).toBeInTheDocument();
    expect(screen.getByText("Keep your links in")).toBeInTheDocument();
    expect(screen.getByText("Only you can see what we extract. Nothing is shared without you.")).toBeInTheDocument();
    expect(screen.queryByText(/Fill your profile by hand/)).not.toBeInTheDocument();
  });

  it("hands the picked file over through the hidden input", () => {
    const onFile = vi.fn();
    const { container } = render(<UploadDropArea hint={hint} onFile={onFile} />);
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File(["%PDF-1.7"], "ada.pdf", { type: "application/pdf" });

    expect(input).toHaveAttribute("accept", "application/pdf");
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("accepts a dropped file and shows the rejection it was given", () => {
    const onFile = vi.fn();
    const file = new File(["png"], "ada.png", { type: "image/png" });

    render(<UploadDropArea hint={hint} message="That file is not a PDF. Export your résumé as PDF and try again." onFile={onFile} />);
    fireEvent.drop(screen.getByText("Drop your PDF here, or browse files").closest("label")!, { dataTransfer: { files: [file] } });

    expect(onFile).toHaveBeenCalledWith(file);
    expect(screen.getByRole("alert")).toHaveTextContent("That file is not a PDF.");
  });
});
