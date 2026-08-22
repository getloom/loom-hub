import { json } from '@sveltejs/kit';

//TODO
// seems like the most "Svelte" way to do this is to make this a page that returns results
// then make some post return work in the SpaceNavActions that confirms data and closes the display
// ideally it should also update the data underneath?
// it might also just be better to trigger a full page refresh on submission or something
// probably better to start with the API though for backend behavior, add some tests, then connect the front end stub to backend logic
export function POST(data) {
	console.log(data);
	console.log('inside the api spaces routes');
	const number = Math.floor(Math.random() * 6) + 1;

	return json(number);
}
