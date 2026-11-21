import type { SiteDeploy } from './siteService';
import { SiteRepo } from '$lib/system/site/siteRepo';
import { extractZipToDirectory } from '$lib/system/site/siteExtractor.server';
import { siteUploadPath } from '$lib/system/site/siteConfig.server';
import postgres from 'postgres';
import { defaultPostgresOptions } from '$lib/db/postgres.server';

export interface Result<T> {
	ok: true;
	data: T;
	code: number;
}

export interface Error {
	ok: false;
	error: string;
	code: number;
}

//TODO replace with a proper logger system
const log = console;

export class SiteService {
	siteRepo: SiteRepo;

	constructor(siteRepo?: SiteRepo) {
		this.siteRepo = siteRepo || new SiteRepo(postgres(defaultPostgresOptions));
	}

	async deploy(
		filename: string,
		zipBuffer: Buffer,
		deployed_by: string
	): Promise<Result<SiteDeploy> | Error> {
		if (!filename) {
			return { ok: false, error: 'filename is required', code: 400 };
		}
		if (!zipBuffer?.length) {
			return { ok: false, error: 'file is required', code: 400 };
		}
		if (!deployed_by) {
			return { ok: false, error: 'deployed_by is required', code: 400 };
		}

		try {
			const { fileCount } = await extractZipToDirectory(zipBuffer, siteUploadPath);
			const deploy = await this.siteRepo.create(filename, zipBuffer.length, fileCount, deployed_by);
			return { ok: true, data: deploy, code: 201 };
		} catch (error) {
			log.error('Error deploying site:', error);
			const message = error instanceof globalThis.Error ? error.message : 'Failed to deploy site';
			return { ok: false, error: message, code: 500 };
		}
	}

	async listDeploys(): Promise<Result<SiteDeploy[]> | Error> {
		try {
			const deploys = await this.siteRepo.findAll();
			return { ok: true, data: deploys, code: 200 };
		} catch (error) {
			log.error('Error listing site deploys:', error);
			return { ok: false, error: 'Failed to list site deploys', code: 500 };
		}
	}
}
