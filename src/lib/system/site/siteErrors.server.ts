export class ZipValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ZipValidationError';
	}
}
