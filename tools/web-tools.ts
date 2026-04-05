/**
 * Web tools extension for researcher subagent.
 * Provides web_search and web_fetch tools that wrap the skill scripts.
 */
import { execFile } from "node:child_process";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const SKILLS_DIR = path.join(
	process.env.HOME || "~",
	".pi",
	"agent",
	"skills",
);

function runScript(
	scriptPath: string,
	args: string[],
	signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string; code: number }> {
	return new Promise((resolve) => {
		const child = execFile(
			process.execPath,
			[scriptPath, ...args],
			{ maxBuffer: 1024 * 1024, signal },
			(error, stdout, stderr) => {
				resolve({
					stdout: stdout || "",
					stderr: stderr || "",
					code: error ? (error as any).code ?? 1 : 0,
				});
			},
		);
	});
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description:
			"Search the web via DuckDuckGo. Returns title, URL, and snippet for each result.",
		parameters: Type.Object({
			query: Type.String({ description: "Search query" }),
			count: Type.Optional(
				Type.Number({ description: "Number of results (default: 5)" }),
			),
		}),
		async execute(_toolCallId, params, signal) {
			const scriptPath = path.join(SKILLS_DIR, "web-search", "search.js");
			const args: string[] = [];
			if (params.count) {
				args.push("-n", String(params.count));
			}
			args.push(params.query);

			const result = await runScript(scriptPath, args, signal);
			const output = result.stdout || result.stderr || "No results found.";
			return {
				content: [{ type: "text" as const, text: output }],
				details: {},
			};
		},
	});

	pi.registerTool({
		name: "web_fetch",
		label: "Web Fetch",
		description:
			"Fetch a web page and extract readable text content.",
		parameters: Type.Object({
			url: Type.String({ description: "URL to fetch" }),
		}),
		async execute(_toolCallId, params, signal) {
			const scriptPath = path.join(SKILLS_DIR, "web-fetch", "fetch.js");
			const result = await runScript(scriptPath, [params.url], signal);
			const output = result.stdout || result.stderr || "Failed to fetch page.";
			return {
				content: [{ type: "text" as const, text: output }],
				details: {},
			};
		},
	});
}
