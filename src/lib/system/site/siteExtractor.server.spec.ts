import { describe, it, expect, afterEach } from 'vitest';
import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { extractZipToDirectory } from './siteExtractor.server';

const tempDirs: string[] = [];

async function makeTargetDir(): Promise<string> {
	const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'site-extractor-test-'));
	tempDirs.push(parent);
	return path.join(parent, 'target');
}

afterEach(async () => {
	await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
	tempDirs.length = 0;
});

describe('extractZipToDirectory', () => {
	it('extracts a well-formed zip and returns the correct file count', async () => {
		const targetDir = await makeTargetDir();
		const zip = new AdmZip();
		zip.addFile('index.html', Buffer.from('<h1>hi</h1>'));
		zip.addFile('assets/style.css', Buffer.from('body {}'));

		const result = await extractZipToDirectory(zip.toBuffer(), targetDir);

		expect(result).toEqual({ fileCount: 2 });
		expect(await fs.readFile(path.join(targetDir, 'index.html'), 'utf-8')).toBe('<h1>hi</h1>');
		expect(await fs.readFile(path.join(targetDir, 'assets/style.css'), 'utf-8')).toBe('body {}');
	});

	it('rejects a zip containing a path-traversal entry and leaves the target directory untouched', async () => {
		const targetDir = await makeTargetDir();
		await fs.mkdir(targetDir, { recursive: true });
		await fs.writeFile(path.join(targetDir, 'existing.txt'), 'original');

		const zip = new AdmZip();
		zip.addFile('escape.txt', Buffer.from('evil'));
		// addFile sanitizes entryName; set it directly to simulate a malicious zip.
		zip.getEntries()[0].entryName = '../../escape.txt';

		await expect(extractZipToDirectory(zip.toBuffer(), targetDir)).rejects.toThrow();

		expect(await fs.readFile(path.join(targetDir, 'existing.txt'), 'utf-8')).toBe('original');
		await expect(
			fs.access(path.join(path.dirname(targetDir), '..', 'escape.txt'))
		).rejects.toThrow();
	});

	it('rejects an empty zip', async () => {
		const targetDir = await makeTargetDir();
		const zip = new AdmZip();

		await expect(extractZipToDirectory(zip.toBuffer(), targetDir)).rejects.toThrow(
			'Zip file is empty'
		);
	});

	it('fully replaces existing content in the target directory', async () => {
		const targetDir = await makeTargetDir();
		await fs.mkdir(targetDir, { recursive: true });
		await fs.writeFile(path.join(targetDir, 'old.txt'), 'old content');

		const zip = new AdmZip();
		zip.addFile('new.txt', Buffer.from('new content'));

		await extractZipToDirectory(zip.toBuffer(), targetDir);

		await expect(fs.access(path.join(targetDir, 'old.txt'))).rejects.toThrow();
		expect(await fs.readFile(path.join(targetDir, 'new.txt'), 'utf-8')).toBe('new content');
	});
});
