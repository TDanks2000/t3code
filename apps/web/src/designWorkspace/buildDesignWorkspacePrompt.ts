import { buildContextSummary, type DesignContextSource } from "./designWorkspaceState";

export interface BuildDesignPromptInput {
  userPrompt: string;
  contextSources: ReadonlyArray<DesignContextSource>;
  targetPath: string;
}

/**
 * Build a structured prompt for the agent that includes context sources,
 * output rules, and a contract requiring the agent to produce a single-file
 * HTML artifact under a stable project-relative path.
 */
export function buildDesignWorkspacePrompt(input: BuildDesignPromptInput): string {
  const { userPrompt, contextSources, targetPath } = input;
  const contextBlock = buildContextSummary(contextSources);

  const sections: string[] = [
    `# Design Request`,
    ``,
    userPrompt,
    ``,
    `# Output Rules`,
    ``,
    `1. Create or update a single-file HTML artifact at the following project-relative path:`,
    `   \`${targetPath}\``,
    `2. The artifact must be self-contained — no external dependencies, no CDN links, no images.`,
    `3. Use inline <style> for all CSS and inline <script> for any JavaScript.`,
    `4. The HTML must be valid and renderable in a sandboxed iframe.`,
    `5. After creating the artifact, include ONLY the following completion summary in your response:`,
    `   "ARTIFACT: ${targetPath}"`,
    ``,
    `# Current Time`,
    `The current time is ${new Date().toLocaleString()}.`,
    ``,
  ];

  if (contextBlock) {
    sections.push(`# Context`, ``, contextBlock, ``);
  }

  return sections.join("\n");
}
