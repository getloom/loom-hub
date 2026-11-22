import { describe, it, expect, afterEach } from 'vitest';
import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractZipToDirectory } from './siteExtractor.server';
import { ZipValidationError } from './siteErrors.server';

const tempDirs: string[] = [];

async function makeTargetDir(): Promise<string> {
	const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'site-extractor-test-'));
	tempDirs.push(parent);
	return path.join(parent, 'target');
}

function makeZip(files: Record<string, string>): Buffer {
	const zip = new AdmZip();
	for (const [name, content] of Object.entries(files)) {
		zip.addFile(name, Buffer.from(content));
	}
	return zip.toBuffer();
}

async function currentRelease(targetDir: string): Promise<string> {
	return path.resolve(targetDir, await fs.readlink(path.join(targetDir, 'site')));
}

afterEach(async () => {
	await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
	tempDirs.length = 0;
});

describe('extractZipToDirectory', () => {
	it('extracts a well-formed zip and returns the correct file count', async () => {
		const targetDir = await makeTargetDir();

		const result = await extractZipToDirectory(
			makeZip({ 'index.html': '<h1>hi</h1>', 'assets/style.css': 'body {}' }),
			targetDir
		);

		expect(result).toEqual({ fileCount: 2 });
		expect(await fs.readFile(path.join(targetDir, 'site', 'index.html'), 'utf-8')).toBe(
			'<h1>hi</h1>'
		);
		expect(await fs.readFile(path.join(targetDir, 'site', 'assets/style.css'), 'utf-8')).toBe(
			'body {}'
		);
	});

	it('points a relative site symlink at a release directory and creates a missing root', async () => {
		const targetDir = await makeTargetDir();

		await extractZipToDirectory(makeZip({ 'index.html': 'x' }), targetDir);

		const link = await fs.readlink(path.join(targetDir, 'site'));
		expect(path.isAbsolute(link)).toBe(false);
		expect(link.startsWith('releases' + path.sep)).toBe(true);
		expect(
			await fs.readFile(path.join(await currentRelease(targetDir), 'index.html'), 'utf-8')
		).toBe('x');
	});

	it('makes the release directory world-readable and traversable (0755)', async () => {
		const targetDir = await makeTargetDir();

		await extractZipToDirectory(makeZip({ 'index.html': 'x' }), targetDir);

		const stat = await fs.stat(await currentRelease(targetDir));
		expect(stat.mode & 0o777).toBe(0o755);
	});

	it('preserves the root directory inode across deploys', async () => {
		const targetDir = await makeTargetDir();
		await fs.mkdir(targetDir, { recursive: true });
		const before = (await fs.stat(targetDir)).ino;

		await extractZipToDirectory(makeZip({ 'index.html': 'x', 'a.txt': '1' }), targetDir);
		await extractZipToDirectory(makeZip({ 'index.html': 'x', 'a.txt': '2' }), targetDir);

		expect((await fs.stat(targetDir)).ino).toBe(before);
	});

	it('repoints site on a second deploy and keeps the previous release', async () => {
		const targetDir = await makeTargetDir();

		await extractZipToDirectory(makeZip({ 'index.html': 'x', 'a.txt': 'old' }), targetDir);
		const first = await currentRelease(targetDir);
		await extractZipToDirectory(makeZip({ 'index.html': 'x', 'a.txt': 'new' }), targetDir);
		const second = await currentRelease(targetDir);

		expect(second).not.toBe(first);
		expect(await fs.readFile(path.join(first, 'a.txt'), 'utf-8')).toBe('old');
		expect(await fs.readFile(path.join(targetDir, 'site', 'a.txt'), 'utf-8')).toBe('new');
	});

	it('rejects a path-traversal zip, keeps the previous release live, and leaves no leftovers', async () => {
		const targetDir = await makeTargetDir();
		await extractZipToDirectory(makeZip({ 'index.html': 'x', 'a.txt': 'original' }), targetDir);
		const before = await currentRelease(targetDir);

		const zip = new AdmZip();
		zip.addFile('escape.txt', Buffer.from('evil'));
		// addFile sanitizes entryName; set it directly to simulate a malicious zip.
		zip.getEntries()[0].entryName = '../../escape.txt';

		await expect(extractZipToDirectory(zip.toBuffer(), targetDir)).rejects.toThrow();

		expect(await currentRelease(targetDir)).toBe(before);
		expect(await fs.readFile(path.join(targetDir, 'site', 'a.txt'), 'utf-8')).toBe('original');
		await expect(fs.access(path.join(targetDir, '..', 'escape.txt'))).rejects.toThrow();
		await expect(
			fs.access(path.join(targetDir, 'releases', '..', '..', 'escape.txt'))
		).rejects.toThrow();

		const rootEntries = await fs.readdir(targetDir);
		expect(rootEntries.filter((name) => name.startsWith('.site-link-'))).toEqual([]);
		const releaseEntries = await fs.readdir(path.join(targetDir, 'releases'));
		expect(releaseEntries.filter((name) => name.startsWith('.tmp-'))).toEqual([]);
	});

	it('rejects an empty zip without creating anything', async () => {
		const targetDir = await makeTargetDir();

		await expect(extractZipToDirectory(new AdmZip().toBuffer(), targetDir)).rejects.toThrow(
			'Zip file is empty'
		);
		await expect(fs.access(targetDir)).rejects.toThrow();
	});

	it('rejects a zip without index.html and creates nothing', async () => {
		const targetDir = await makeTargetDir();

		const promise = extractZipToDirectory(makeZip({ 'a.txt': '1' }), targetDir);

		await expect(promise).rejects.toBeInstanceOf(ZipValidationError);
		await expect(promise).rejects.toThrow('Zip file must contain an index.html at its root');
		await expect(fs.access(targetDir)).rejects.toThrow();
	});

	it('rejects a zip whose index.html is inside a wrapper folder', async () => {
		const targetDir = await makeTargetDir();

		await expect(
			extractZipToDirectory(makeZip({ 'mysite/index.html': 'x' }), targetDir)
		).rejects.toBeInstanceOf(ZipValidationError);
	});

	it('matches index.html case-sensitively', async () => {
		const targetDir = await makeTargetDir();

		await expect(
			extractZipToDirectory(makeZip({ 'Index.html': 'x' }), targetDir)
		).rejects.toBeInstanceOf(ZipValidationError);
	});

	it('keeps the previous release live after a zip without index.html is rejected', async () => {
		const targetDir = await makeTargetDir();
		await extractZipToDirectory(makeZip({ 'index.html': 'original' }), targetDir);
		const before = await currentRelease(targetDir);

		await expect(
			extractZipToDirectory(makeZip({ 'a.txt': '1' }), targetDir)
		).rejects.toBeInstanceOf(ZipValidationError);

		expect(await currentRelease(targetDir)).toBe(before);
		expect(await fs.readFile(path.join(targetDir, 'site', 'index.html'), 'utf-8')).toBe('original');
		expect(await fs.readdir(path.join(targetDir, 'releases'))).toHaveLength(1);
	});

	it('moves a pre-existing real site directory to releases/legacy-* and links site', async () => {
		const targetDir = await makeTargetDir();
		await fs.mkdir(path.join(targetDir, 'site'), { recursive: true });
		await fs.writeFile(path.join(targetDir, 'site', 'old.txt'), 'old content');

		await extractZipToDirectory(
			makeZip({ 'index.html': 'x', 'new.txt': 'new content' }),
			targetDir
		);

		expect((await fs.lstat(path.join(targetDir, 'site'))).isSymbolicLink()).toBe(true);
		expect(await fs.readFile(path.join(targetDir, 'site', 'new.txt'), 'utf-8')).toBe('new content');
		const legacy = (await fs.readdir(path.join(targetDir, 'releases'))).filter((name) =>
			name.startsWith('legacy-')
		);
		expect(legacy).toHaveLength(1);
		expect(await fs.readFile(path.join(targetDir, 'releases', legacy[0], 'old.txt'), 'utf-8')).toBe(
			'old content'
		);
	});

	it('keeps only the 5 most recent releases, including the current one', async () => {
		const targetDir = await makeTargetDir();

		for (let i = 0; i < 7; i++) {
			await extractZipToDirectory(makeZip({ 'index.html': 'x', 'a.txt': String(i) }), targetDir);
			// Ensure distinct, increasing mtimes between releases.
			await new Promise((resolve) => setTimeout(resolve, 5));
		}

		const releases = await fs.readdir(path.join(targetDir, 'releases'));
		expect(releases).toHaveLength(5);
		expect(releases).toContain(path.basename(await currentRelease(targetDir)));
		expect(await fs.readFile(path.join(targetDir, 'site', 'a.txt'), 'utf-8')).toBe('6');
	});
});
