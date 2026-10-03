const PATH_ONLY_BODY = /^(<path[^>]*\/>)+$/;

function extractPathData(body: string): string[] {
	return [...body.matchAll(/d="([^"]+)"/g)].map((match) => match[1]);
}

export function parseIconPaths(value: string | null | undefined): string[] | null {
	if (!value) return null;
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
			? (parsed as string[])
			: null;
	} catch {
		return null;
	}
}

export async function loadIconLibrary(): Promise<Record<string, string[]>> {
	const mod = await import('@iconify-json/mdi/icons.json');
	const data = mod.default as unknown as {
		icons: Record<string, { body: string }>;
		aliases: Record<string, { parent: string }>;
	};

	const paths: Record<string, string[]> = {};
	for (const [name, icon] of Object.entries(data.icons)) {
		if (PATH_ONLY_BODY.test(icon.body)) {
			paths[name] = extractPathData(icon.body);
		}
	}
	for (const [name, alias] of Object.entries(data.aliases)) {
		const parentPaths = paths[alias.parent];
		if (parentPaths) paths[name] = parentPaths;
	}

	return paths;
}
