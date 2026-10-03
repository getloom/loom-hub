export type PostId = number;

export interface Post {
	post_id: PostId;
	type: 'news' | 'motd' | 'quicklink' | 'quote';
	title: string;
	body: string | null;
	link: string | null;
	image: string | null;
	active: boolean;
	created_by: string;
	created_at: Date;
	updated_at: Date | null;
}

export type PostPatch = Partial<
	Pick<Post, 'type' | 'title' | 'body' | 'link' | 'image' | 'active'>
>;
