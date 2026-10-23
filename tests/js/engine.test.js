/**
 * Tests for assets/js/engine.js: platforms, physics, states, the ball.
 */
const test = require( 'node:test' );
const assert = require( 'node:assert' );
const e = require( '../../assets/js/engine.js' );

const WORLD = { width: 1000, height: 800 };

function world( rects = [], extra = {} ) {
	return { ...WORLD, platforms: e.platforms( rects, WORLD ), ...extra };
}

function run( pet, w, seconds, rng = e.random( 1 ), each ) {
	for ( let t = 0; t < seconds; t += 1 / 60 ) {
		e.step( pet, 1 / 60, w, rng );
		if ( each ) {
			each( pet );
		}
	}
	return pet;
}

test( 'platforms: top edges, ground last, small and off-screen ones dropped', () => {
	const list = e.platforms(
		[
			{ id: 'h1', left: 100, right: 600, top: 300 },
			{ id: 'tiny', left: 10, right: 40, top: 400 },
			{ id: 'above', left: 0, right: 500, top: 20 },
			{ id: 'below', left: 0, right: 500, top: 900 },
		],
		WORLD
	);

	assert.deepStrictEqual( list.map( ( p ) => p.id ), [ 'h1', 'ground' ] );
	assert.deepStrictEqual( list[ 1 ], { id: 'ground', left: 0, right: 1000, y: 800 } );
} );

test( 'platforms: touching edges on one line merge, wide ones are clipped to the world', () => {
	const list = e.platforms(
		[
			{ id: 'a', left: 100, right: 300, top: 400 },
			{ id: 'b', left: 302, right: 500, top: 401 },
			{ id: 'wide', left: -50, right: 1200, top: 600 },
		],
		WORLD
	);

	assert.deepStrictEqual( list[ 0 ], { id: 'a', left: 100, right: 500, y: 400 } );
	assert.deepStrictEqual( list[ 1 ], { id: 'wide', left: 0, right: 1000, y: 600 } );
} );

test( 'a pet stays on the ground and inside the world for a long day', () => {
	const w = world();
	const pet = e.createPet( { id: 1, type: 'cat-orange', x: 500, world: w } );
	const states = new Set();

	run( pet, w, 300, e.random( 7 ), ( p ) => {
		states.add( p.state );
		assert.ok( p.x >= 0 && p.x <= WORLD.width, 'x inside the world' );
		assert.ok( p.y <= WORLD.height + 0.01, 'never below the ground' );
	} );

	for ( const s of [ 'idle', 'walk', 'run', 'sit', 'sleep' ] ) {
		assert.ok( states.has( s ), `went through ${ s }` );
	}
} );

test( 'the same seed replays the same day', () => {
	const w = world( [ { id: 'h2', left: 200, right: 700, top: 500 } ] );
	const a = run( e.createPet( { id: 1, x: 300, world: w } ), w, 60, e.random( 42 ) );
	const b = run( e.createPet( { id: 1, x: 300, world: w } ), w, 60, e.random( 42 ) );

	assert.deepStrictEqual( a, b );
} );

test( 'pets jump up onto platforms within reach', () => {
	const w = world( [ { id: 'shelf', left: 350, right: 650, top: 680 } ] );
	let reached = false;

	run( e.createPet( { id: 1, x: 500, world: w } ), w, 240, e.random( 3 ), ( p ) => {
		if ( p.platform === 'shelf' ) {
			reached = true;
			assert.strictEqual( p.y, 680 );
		}
	} );

	assert.ok( reached, 'got up on the shelf' );
} );

test( 'a pet moves with its platform when the page scrolls, and falls when it goes', () => {
	const w = world( [ { id: 'h2', left: 100, right: 900, top: 500 } ] );
	const pet = e.createPet( { id: 1, x: 500, world: w } );
	pet.platform = 'h2';
	pet.y = 500;
	pet.state = 'sit';
	pet.timer = 100;

	w.platforms = e.platforms( [ { id: 'h2', left: 100, right: 900, top: 450 } ], WORLD );
	e.step( pet, 1 / 60, w, e.random( 1 ) );
	assert.strictEqual( pet.y, 450, 'moved up with the heading' );

	w.platforms = e.platforms( [], WORLD );
	e.step( pet, 1 / 60, w, e.random( 1 ) );
	assert.strictEqual( pet.state, 'fall' );
	run( pet, w, 2 );
	assert.strictEqual( pet.platform, 'ground' );
	assert.strictEqual( pet.y, 800 );
} );

test( 'a thrown ball lands and the pet fetches it', () => {
	const w = world();
	const pet = e.createPet( { id: 9, x: 100, world: w } );
	w.ball = e.throwBall( 50, 700, 600, -500 );

	for ( let t = 0; t < 6 && ! w.ball.caught; t += 1 / 60 ) {
		e.stepBall( w.ball, 1 / 60, w );
		e.step( pet, 1 / 60, w, e.random( 5 ) );
	}

	assert.ok( w.ball.landed );
	assert.strictEqual( w.ball.caught, 9 );
	assert.ok( Math.abs( pet.x - w.ball.x ) < 10 );
	assert.strictEqual( pet.state, 'sit' );
	assert.ok( pet.happy > 0 );
} );

test( 'pet 0 catches the ball once (an ID of 0 still counts as caught)', () => {
	const w = world();
	const pet = e.createPet( { id: 0, x: 100, world: w } );
	w.ball = e.throwBall( 50, 700, 600, -500 );
	let catches = 0;

	for ( let t = 0; t < 8; t += 1 / 60 ) {
		e.stepBall( w.ball, 1 / 60, w );
		const before = w.ball.caught;
		e.step( pet, 1 / 60, w, e.random( 5 ) );
		if ( before === null && w.ball.caught !== null ) {
			catches++;
		}
	}

	assert.strictEqual( w.ball.caught, 0 );
	assert.strictEqual( catches, 1 );
	assert.ok( pet.happy === 0, 'happiness wears off after the catch' );
} );

test( 'the ball bounces off the sides and stays inside', () => {
	const w = world();
	const ball = e.throwBall( 980, 300, 2000, -100 );
	for ( let t = 0; t < 3; t += 1 / 60 ) {
		e.stepBall( ball, 1 / 60, w );
		assert.ok( ball.x >= 6 && ball.x <= 994 );
	}
	assert.ok( ball.landed );
	assert.strictEqual( ball.y, 800 );
} );

test( 'with reduced motion a pet sits still', () => {
	const w = world( [], { reducedMotion: true } );
	const pet = e.createPet( { id: 1, x: 300, world: w } );

	run( pet, w, 30 );

	assert.strictEqual( pet.x, 300 );
	assert.ok( [ 'sit', 'sleep' ].includes( pet.state ) );
} );

test( 'chooseNext can change what a pet does next', () => {
	const w = world( [], { chooseNext: () => 'sleep' } );
	const pet = e.createPet( { id: 1, x: 300, world: w } );

	run( pet, w, 5 );

	assert.strictEqual( pet.state, 'sleep' );
} );

test( 'frames follow the state and blink', () => {
	const pet = e.createPet( { id: 1, x: 0, world: WORLD } );
	pet.state = 'walk';
	pet.clock = 0.13;
	assert.strictEqual( e.frame( pet ), e.FRAMES.walk[ 1 ] );
	pet.state = 'idle';
	pet.blink = 0.1;
	assert.strictEqual( e.frame( pet ), e.FRAMES.idle[ 1 ] );
	pet.state = 'fall';
	assert.strictEqual( e.frame( pet ), 15 );
} );

test( 'petting makes a pet sit and be happy', () => {
	const w = world();
	const pet = e.createPet( { id: 1, x: 300, world: w } );
	pet.state = 'run';
	e.pat( pet, e.random( 1 ), w );

	assert.strictEqual( pet.state, 'sit' );
	assert.strictEqual( pet.happy, 2 );
} );
