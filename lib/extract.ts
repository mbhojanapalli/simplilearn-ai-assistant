import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export const SUPPORTED_EXTENSIONS = ["txt", "md", "markdown", "pdf", "docx"] as const;

/**
 * Extract plain text from an uploaded document buffer.
 * Supports: .txt, .md, .pdf (via unpdf — serverless-friendly), .docx (via mammoth).
 */
export async function extractTextFromFile(
  filename: string,
  buffer: Buffer,
): Promise<string> {
  const ext = (filename.toLowerCase().split(".").pop() ?? "").trim();

  switch (ext) {
    case "txt":
    case "md":
    case "markdown":
      return buffer.toString("utf-8");

    case "pdf": {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return Array.isArray(text) ? text.join("\n\n") : text;
    }

    case "docx": {
      const { value } = await mammoth.extractRawText({ buffer });
      return value;
    }

    default:
      throw new Error(
        `Unsupported file type ".${ext}". Supported formats: ${SUPPORTED_EXTENSIONS.map((e) => "." + e).join(", ")}`,
      );
  }
}
