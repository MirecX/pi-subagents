/**
 * Safe bash extension for worker subagent.
 * Wraps the built-in bash tool with dangerous command blocking.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const DANGEROUS_PATTERNS = [
	// ── Recursive/destructive deletes across broad targets (/, ~, ., *, $HOME) ──
	/\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?(\/|~\/?\s|~\/?\b|\.(\s|\b)|\*|\$HOME(?:\b|\/))/,
	/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*\s+)?(\/|~\/?\s|~\/?\b|\.(\s|\b)|\*|\$HOME(?:\b|\/))/,
	/\brm\s+-rf\s+[A-Za-z0-9_\/.-]+\s+\/\s*$/, // rm -rf <prefix> / (trailing root)
	/\bgit\s+clean\s+-\s*f?d?x?f?/,
	/\bgit\s+reset\s+--hard/,
	/\bgit\s+checkout\s+--\s*\./,
	/\bfind\s+[^\n]*\s-delete/,
	/\bfind\s+[^\n]*\s-exec\s+rm/,
	/\bshred\b/,
	/\btruncate\s+[^\n]+\/dev\//,

	// ── Privilege escalation / system-level mutation ──
	/\bsudo\b/,
	/\bsu\s+-/,
	/\bchmod\s+(-[a-zA-Z]*R[a-zA-Z]*\s+)?(777|7777|0777)\s+(\/|\.)/,
	/\bchmod\s+(-[a-zA-Z]*R[a-zA-Z]*\s+)?[0-7]{3,4}\s+(\/|\/\*)/,
	/\bchown\s+(-[a-zA-Z]+\s+)?root/,
	/\bchattr\s+[^\n]*\+i/,
	/\busermod\b/,
	/\buseradd\b/,
	/\bpasswd\b/,
	/\bgroupadd\b/,

	// ── Filesystem / partition / device writes ──
	/\bmkfs\b/,
	/\bfdisk\b/,
	/\bparted\b/,
	/\bmkswap\b/,
	/\bswapon\b/,
	/\bmount\b/,
	/\bumount\b/,
	/\bdd\s+if=/,
	/\bdd\s+of=\/dev\//,
	/>\s*\/dev\/[sh]d[a-z]/,
	/(?:^|[>\|;])\s*(?:cat|echo|tee|printf|dd)\s+[^\n]*>\s*\/dev\//,
	/(?:^|[>\|;])\s*(?:cat|echo|tee|printf|dd)\s+[^\n]*>\s*\/etc\//,
	/\b:?\(\)\s*\{\s*:\|:&\s*\}\s*;:/, // fork bomb

	// ── Remote code execution / shell hijack / reverse shells ──
	/\b(?:curl|wget|lynx|fetch)\s+[^\n]*\|\s*(ba|z|k|c)sh\b/,
	/\b(base64|xxd|openssl)\s+[^\n]*\|\s*(ba|z|k|c)sh\b/,
	/\/(dev\/)?(tcp|udp)\//,
	/\bmkfifo\b/,
	/\bnc(\s+-[a-zA-Z]*e\b|\s+-e\b)/,
	/\bncat(\s+-[a-zA-Z]*e\b|\s+-e\b)/,
	/\bbash\s+-i\s*[><]/,
	/\bsocat\b/,
	/\b(?:python|perl|ruby|php)\s+-(?:c|e)\s+[^\n]*(?:exec|system|passthru|eval)/,
	/\bsh\s+-c\s+['"]?[^\n]*curl/,

	// ── Power / service disruption ──
	/\bshutdown\b/,
	/\breboot\b/,
	/\bpoweroff\b/,
	/\bhalt\b/,
	/\binit\s+0\b/,
	/\bsystemctl\s+(poweroff|reboot|halt|suspend)/,
	/\btelinit\b/,
	/\bkill\s+-9\s+1\b/,
	/\bkillall\b/,
	/\bpkill\s+-9\b/,
];

function isDangerous(command: string): string | null {
	// Normalize a few cheap obfuscations before matching, so a pattern can't be
	// dodged by trivial whitespace / quote insertion between characters.
	const normalized = command
		.replace(/\\\n/g, " ")
		.replace(/\$\{([a-zA-Z0-9_]+)\}/g, "$1") // ${var} → var
		.replace(/'/g, "")
		.replace(/;/g, " ") // `cmd; curl|sh` counts as a separate command
		.replace(/&&/g, " ")
		.replace(/\|\|/g, " ")
		.replace(/\s+/g, " ");
	for (const pattern of DANGEROUS_PATTERNS) {
		if (pattern.test(normalized)) {
			return `Command blocked by safe_bash: matches dangerous pattern ${pattern}`;
		}
	}
	return null;
}

export default function (pi: ExtensionAPI) {
	const bashTool = createBashTool(process.cwd());

	pi.registerTool({
		name: "safe_bash",
		label: "Safe Bash",
		description:
			"Execute a bash command. Blocks dangerous commands (rm -rf on broad targets, sudo, mkfs, reverse shells, /dev writes, etc.).",
		parameters: Type.Object({
			command: Type.String({ description: "Bash command to execute" }),
			timeout: Type.Optional(
				Type.Number({ description: "Timeout in seconds (optional)" }),
			),
		}),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const danger = isDangerous(params.command);
			if (danger) {
				throw new Error(danger);
			}
			return bashTool.execute(toolCallId, params, signal, onUpdate);
		},
	});
}
