import { Repo } from '$lib/db/repo';
import type { SiteDeploy } from '$lib/system/site/siteService';

//TODO replace with a proper logger system
const log = console;

export class SiteRepo extends Repo {
	async create(
		filename: string,
		size_bytes: number,
		file_count: number,
		deployed_by: string
	): Promise<SiteDeploy> {
		log.debug(`[create] site deploy by ${deployed_by}`);
		const data = await this.sql<SiteDeploy[]>`
			INSERT INTO site_deploys (filename, size_bytes, file_count, deployed_by)
			VALUES (${filename}, ${size_bytes}, ${file_count}, ${deployed_by})
			RETURNING deploy_id, filename, size_bytes, file_count, deployed_by, deployed_at
		`;
		log.debug('[create] result', data);
		return data[0];
	}

	async findAll(): Promise<SiteDeploy[]> {
		log.debug('[findAll] all site deploys');
		const data = await this.sql<SiteDeploy[]>`
			SELECT deploy_id, filename, size_bytes, file_count, deployed_by, deployed_at
			FROM site_deploys
			ORDER BY deployed_at DESC
		`;
		log.debug('[findAll] result', data);
		return data;
	}
}
