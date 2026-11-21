import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function extractZipToDirectory(
	zipBuffer: Buffer,
	targetDir: string
): Promise<{ fileCount: number }> {
	const zip = new AdmZip(zipBuffer);
	const entries = zip.getEntries().filter((entry) => !entry.isDirectory);

	if (entries.length === 0) {
		throw new Error('Zip file is empty');
	}

	const stagingDir = await fs.mkdtemp(path.join(path.dirname(targetDir), '.site-deploy-'));

	try {
		for (const entry of entries) {
			const destination = path.resolve(stagingDir, entry.entryName);
			if (!destination.startsWith(stagingDir + path.sep)) {
				throw new Error(`Zip entry "${entry.entryName}" escapes the target directory`);
			}

			await fs.mkdir(path.dirname(destination), { recursive: true });
			await fs.writeFile(destination, entry.getData());
		}

		await fs.rm(targetDir, { recursive: true, force: true });
		await fs.rename(stagingDir, targetDir);
	} catch (error) {
		await fs.rm(stagingDir, { recursive: true, force: true });
		throw error;
	}

	return { fileCount: entries.length };
}
