import AdmZip from 'adm-zip';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const RELEASES_TO_KEEP = 5;
const STAGING_PREFIX = '.tmp-';
const LINK_PREFIX = '.site-link-';

function randomSuffix(): string {
	return crypto.randomBytes(4).toString('hex');
}

async function promoteStaging(
	stagingDir: string,
	releasesDir: string
): Promise<{ releaseName: string; releasePath: string }> {
	const base = new Date().toISOString().replace(/[:.]/g, '-');
	let releaseName = base;
	for (;;) {
		const releasePath = path.join(releasesDir, releaseName);
		try {
			await fs.rename(stagingDir, releasePath);
			return { releaseName, releasePath };
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== 'ENOTEMPTY' && code !== 'EEXIST') throw error;
			releaseName = `${base}-${randomSuffix()}`;
		}
	}
}

async function migrateLegacySite(
	targetDir: string,
	releasesDir: string,
	releaseName: string
): Promise<void> {
	const sitePath = path.join(targetDir, 'site');
	let stat;
	try {
		stat = await fs.lstat(sitePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
		throw error;
	}

	if (stat.isSymbolicLink()) return;
	if (stat.isDirectory()) {
		await fs.rename(sitePath, path.join(releasesDir, `legacy-${releaseName}`));
	} else {
		await fs.rm(sitePath, { force: true });
	}
}

async function swapSymlink(targetDir: string, relativeTarget: string): Promise<void> {
	const tempLink = path.join(targetDir, `${LINK_PREFIX}${randomSuffix()}`);
	try {
		await fs.symlink(relativeTarget, tempLink);
		await fs.rename(tempLink, path.join(targetDir, 'site'));
	} catch (error) {
		await fs.rm(tempLink, { force: true });
		throw error;
	}
}

async function pruneReleases(releasesDir: string, currentRelease: string): Promise<void> {
	const names = (await fs.readdir(releasesDir)).filter((name) => !name.startsWith(STAGING_PREFIX));
	const withTimes = await Promise.all(
		names.map(async (name) => ({
			name,
			mtime: (await fs.stat(path.join(releasesDir, name))).mtimeMs
		}))
	);

	const others = withTimes
		.filter((release) => release.name !== currentRelease)
		.sort((a, b) => b.mtime - a.mtime);
	const stale = others.slice(RELEASES_TO_KEEP - 1);

	await Promise.all(
		stale.map((release) =>
			fs.rm(path.join(releasesDir, release.name), { recursive: true, force: true })
		)
	);
}

export async function extractZipToDirectory(
	zipBuffer: Buffer,
	targetDir: string
): Promise<{ fileCount: number }> {
	const zip = new AdmZip(zipBuffer);
	const entries = zip.getEntries().filter((entry) => !entry.isDirectory);

	if (entries.length === 0) {
		throw new Error('Zip file is empty');
	}

	const releasesDir = path.join(targetDir, 'releases');
	await fs.mkdir(releasesDir, { recursive: true });

	const stagingDir = path.resolve(await fs.mkdtemp(path.join(releasesDir, STAGING_PREFIX)));
	let releasePath = stagingDir;
	let releaseName = '';

	try {
		for (const entry of entries) {
			const destination = path.resolve(stagingDir, entry.entryName);
			if (!destination.startsWith(stagingDir + path.sep)) {
				throw new Error(`Zip entry "${entry.entryName}" escapes the target directory`);
			}

			await fs.mkdir(path.dirname(destination), { recursive: true });
			await fs.writeFile(destination, entry.getData());
		}

		({ releaseName, releasePath } = await promoteStaging(stagingDir, releasesDir));
		await migrateLegacySite(targetDir, releasesDir, releaseName);
		await swapSymlink(targetDir, path.join('releases', releaseName));
	} catch (error) {
		await fs.rm(releasePath, { recursive: true, force: true });
		throw error;
	}

	try {
		await pruneReleases(releasesDir, releaseName);
	} catch (error) {
		console.error('Failed to prune old site releases', error);
	}

	return { fileCount: entries.length };
}
