/**
 * Site Pets engine: what each pet does next, and where it goes.
 *
 * No DOM here, so it is unit tested in Node (tests/js/engine.test.js).
 * Coordinates are pixels in the pets' world (the viewport for site pets, the
 * block for a playground): x grows to the right, y grows down. A pet's x is
 * the middle of its feet and its y is the line it stands on.
 */
( function ( root, factory ) {
	if ( typeof module === 'object' && module.exports ) {
		module.exports = factory();
	} else {
		root.sitePetsEngine = factory();
	}
} )( typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	// Frame indexes in the sprite sheets (tools/sprites/generate.py).
	var FRAMES = {
		idle: [ 0, 1 ],
		walk: [ 2, 3, 4, 5 ],
		run: [ 6, 7, 8, 9 ],
		sit: [ 10, 11 ],
		sleep: [ 12, 13 ],
		jump: [ 14 ],
		fall: [ 15 ],
	};

	// Frames per second for each animation; idle and sit blink now and then instead.
	var FPS = { idle: 0, walk: 8, run: 14, sit: 0, sleep: 1.2, jump: 1, fall: 1 };

	var GRAVITY = 1500;
	var WALK_SPEED = 45;
	var RUN_SPEED = 130;
	var JUMP_REACH_X = 220;
	var JUMP_REACH_Y = 260;

	/**
	 * A small seeded random number generator (mulberry32), so tests can replay a pet's day.
	 *
	 * @param {number} seed Seed.
	 * @return {Function} Returns numbers from 0 (inclusive) to 1.
	 */
	function random( seed ) {
		var a = seed >>> 0;
		return function () {
			a = ( a + 0x6d2b79f5 ) >>> 0;
			var t = a;
			t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
			t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
			return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
		};
	}

	function between( rng, min, max ) {
		return min + rng() * ( max - min );
	}

	/**
	 * Platforms from element rectangles: the top edge of each one, plus the ground.
	 *
	 * Edges that are too narrow, off screen or too close to the top are left
	 * out, and edges on the same line that touch are merged.
	 *
	 * @param {Array}  rects    { id, left, right, top } in world coordinates.
	 * @param {Object} world    { width, height }.
	 * @param {Object} options  { minWidth, minTop }.
	 * @return {Array} { id, left, right, y }, ground last.
	 */
	function platforms( rects, world, options ) {
		var o = options || {};
		var minWidth = o.minWidth || 80;
		var minTop = o.minTop === undefined ? 70 : o.minTop;
		var list = [];

		( rects || [] ).forEach( function ( r ) {
			var left = Math.max( 0, r.left );
			var right = Math.min( world.width, r.right );
			var y = Math.round( r.top );
			if ( right - left < minWidth || y < minTop || y > world.height - 40 ) {
				return;
			}
			list.push( { id: String( r.id ), left: left, right: right, y: y } );
		} );

		list.sort( function ( a, b ) {
			return a.y - b.y || a.left - b.left;
		} );

		var merged = [];
		list.forEach( function ( p ) {
			var last = merged[ merged.length - 1 ];
			if ( last && Math.abs( last.y - p.y ) <= 2 && p.left <= last.right + 4 ) {
				last.right = Math.max( last.right, p.right );
				return;
			}
			merged.push( p );
		} );

		merged.push( { id: 'ground', left: 0, right: world.width, y: world.height } );
		return merged;
	}

	/**
	 * The platform a falling thing at x lands on between two heights.
	 *
	 * @param {Array}  list Platforms.
	 * @param {number} x    Position.
	 * @param {number} from Height before the step.
	 * @param {number} to   Height after the step.
	 * @return {Object|null} Platform.
	 */
	function landing( list, x, from, to ) {
		var best = null;
		list.forEach( function ( p ) {
			if ( x >= p.left && x <= p.right && p.y >= from - 0.5 && p.y <= to + 0.5 ) {
				if ( ! best || p.y < best.y ) {
					best = p;
				}
			}
		} );
		return best;
	}

	function find( list, id ) {
		for ( var i = 0; i < list.length; i++ ) {
			if ( list[ i ].id === id ) {
				return list[ i ];
			}
		}
		return null;
	}

	/**
	 * A new pet, standing on the ground.
	 *
	 * @param {Object} options { id, type, name, x, world }.
	 * @return {Object} Pet.
	 */
	function createPet( options ) {
		return {
			id: options.id,
			type: options.type,
			name: options.name || '',
			x: options.x,
			y: options.world.height,
			vx: 0,
			vy: 0,
			facing: 1,
			state: 'idle',
			timer: 2,
			target: null,
			platform: 'ground',
			happy: 0,
			blink: 0,
			clock: 0,
		};
	}

	/**
	 * Moves a pet into a state, with how long it lasts.
	 *
	 * @param {Object}   pet   Pet.
	 * @param {string}   state State.
	 * @param {Function} rng   Random numbers.
	 * @param {Object}   world World.
	 */
	function enter( pet, state, rng, world ) {
		pet.state = state;
		pet.clock = 0;
		pet.vx = 0;
		var span = {
			idle: [ 1.5, 4 ],
			walk: [ 2, 6 ],
			run: [ 1, 2.5 ],
			sit: [ 3, 7 ],
			sleep: [ 8, 18 ],
		}[ state ];
		pet.timer = span ? between( rng, span[ 0 ], span[ 1 ] ) : 0;

		if ( state === 'walk' || state === 'run' ) {
			var p = find( world.platforms, pet.platform ) || world.platforms[ world.platforms.length - 1 ];
			var margin = 20;
			var target = between( rng, p.left + margin, Math.max( p.left + margin, p.right - margin ) );
			// Prefer going somewhere, not staying put.
			if ( Math.abs( target - pet.x ) < 30 ) {
				target = pet.x < ( p.left + p.right ) / 2 ? p.right - margin : p.left + margin;
			}
			pet.target = target;
			pet.facing = target >= pet.x ? 1 : -1;
		}
	}

	/**
	 * The next state after the current one runs out.
	 *
	 * @param {Object}   pet   Pet.
	 * @param {Function} rng   Random numbers.
	 * @param {Object}   world World.
	 * @return {string} State.
	 */
	function nextState( pet, rng, world ) {
		var r = rng();
		var choice;
		if ( pet.state === 'sleep' ) {
			choice = 'idle';
		} else if ( pet.state === 'sit' ) {
			choice = r < 0.35 ? 'sleep' : 'idle';
		} else if ( pet.state === 'idle' ) {
			if ( r < 0.5 ) {
				choice = 'walk';
			} else if ( r < 0.65 ) {
				choice = 'run';
			} else if ( r < 0.85 ) {
				choice = 'sit';
			} else {
				choice = 'jump';
			}
		} else {
			choice = r < 0.6 ? 'idle' : 'sit';
		}
		return world.chooseNext ? world.chooseNext( choice, pet ) || choice : choice;
	}

	/**
	 * A platform above the pet it can jump to, if any.
	 *
	 * @param {Object}   pet   Pet.
	 * @param {Object}   world World.
	 * @param {Function} rng   Random numbers.
	 * @return {Object|null} { platform, x }.
	 */
	function jumpTarget( pet, world, rng ) {
		var options = world.platforms.filter( function ( p ) {
			var dy = pet.y - p.y;
			var nearest = Math.max( p.left + 16, Math.min( p.right - 16, pet.x ) );
			return p.id !== pet.platform && dy > 20 && dy <= JUMP_REACH_Y && Math.abs( nearest - pet.x ) <= JUMP_REACH_X;
		} );
		if ( ! options.length ) {
			return null;
		}
		var p = options[ Math.floor( rng() * options.length ) ];
		var x = Math.max( p.left + 16, Math.min( p.right - 16, pet.x + between( rng, -60, 60 ) ) );
		return { platform: p, x: x };
	}

	/**
	 * Starts a jump to a point: the speed that lands on it at the top of a high arc.
	 *
	 * @param {Object} pet Pet.
	 * @param {number} x   Target x.
	 * @param {number} y   Target height.
	 */
	function launch( pet, x, y ) {
		var rise = Math.max( 30, pet.y - y + 24 );
		pet.vy = -Math.sqrt( 2 * GRAVITY * rise );
		var up = -pet.vy / GRAVITY;
		var down = Math.sqrt( ( 2 * Math.max( 1, rise - ( pet.y - y ) ) ) / GRAVITY );
		pet.vx = ( x - pet.x ) / ( up + down );
		pet.facing = pet.vx >= 0 ? 1 : -1;
		pet.state = 'jump';
		pet.platform = null;
	}

	/**
	 * Moves a pet on by dt seconds.
	 *
	 * @param {Object}   pet   Pet (changed in place).
	 * @param {number}   dt    Seconds.
	 * @param {Object}   world { width, height, platforms, ball, reducedMotion, chooseNext }.
	 * @param {Function} rng   Random numbers.
	 * @return {Object} The pet.
	 */
	function step( pet, dt, world, rng ) {
		pet.clock += dt;
		pet.happy = Math.max( 0, pet.happy - dt );
		pet.blink = pet.blink > 0 ? pet.blink - dt : rng() < dt / 3 ? 0.15 : 0;

		// Keep the pet on its platform as the platform moves (scrolling), or let it fall.
		if ( pet.platform ) {
			var standing = find( world.platforms, pet.platform );
			if ( ! standing || pet.x < standing.left - 2 || pet.x > standing.right + 2 ) {
				pet.platform = null;
				pet.state = 'fall';
				pet.vy = 0;
			} else {
				pet.y = standing.y;
			}
		}

		if ( world.reducedMotion ) {
			pet.vx = 0;
			if ( pet.platform === null ) {
				var ground = world.platforms[ world.platforms.length - 1 ];
				pet.platform = ground.id;
				pet.y = ground.y;
			}
			if ( pet.state !== 'sit' && pet.state !== 'sleep' ) {
				pet.state = 'sit';
			}
			return pet;
		}

		// In the air.
		if ( pet.state === 'jump' || pet.state === 'fall' ) {
			var before = pet.y;
			pet.vy += GRAVITY * dt;
			pet.x += pet.vx * dt;
			pet.y += pet.vy * dt;
			pet.x = Math.max( 8, Math.min( world.width - 8, pet.x ) );
			if ( pet.vy > 0 ) {
				pet.state = 'fall';
				var land = landing( world.platforms, pet.x, before, pet.y );
				if ( land ) {
					pet.y = land.y;
					pet.vy = 0;
					pet.vx = 0;
					pet.platform = land.id;
					enter( pet, world.ball && world.ball.landed ? 'run' : 'idle', rng, world );
				}
			}
			return pet;
		}

		// A ball to fetch on the same platform wins over everything else.
		var ball = world.ball;
		if ( ball && ball.landed && ball.platform === pet.platform && ball.caught === null ) {
			pet.state = 'run';
			pet.target = ball.x;
			pet.facing = ball.x >= pet.x ? 1 : -1;
			if ( Math.abs( ball.x - pet.x ) < 10 ) {
				ball.caught = pet.id;
				pet.happy = 2;
				enter( pet, 'sit', rng, world );
				pet.timer = 2.5;
			}
		} else if ( ball && ball.landed && ball.caught === null && ball.platform !== pet.platform && pet.state !== 'sleep' ) {
			// Ball elsewhere: jump down or across towards it.
			var p = find( world.platforms, ball.platform );
			if ( p && Math.abs( p.y - pet.y ) <= JUMP_REACH_Y * 1.5 && ( p.y > pet.y || pet.y - p.y <= JUMP_REACH_Y ) ) {
				launch( pet, ball.x, p.y );
				return pet;
			}
		}

		if ( pet.state === 'walk' || pet.state === 'run' ) {
			var speed = pet.state === 'run' ? RUN_SPEED : WALK_SPEED;
			var dx = pet.target - pet.x;
			var move = Math.min( Math.abs( dx ), speed * dt );
			pet.x += move * ( dx >= 0 ? 1 : -1 );
			pet.vx = move / dt * ( dx >= 0 ? 1 : -1 );
			if ( Math.abs( pet.target - pet.x ) < 0.5 && ! ( ball && ball.landed && ball.caught === null ) ) {
				enter( pet, nextState( pet, rng, world ), rng, world );
				return pet;
			}
		}

		pet.timer -= dt;
		if ( pet.timer <= 0 && pet.state !== 'walk' && pet.state !== 'run' ) {
			var next = nextState( pet, rng, world );
			if ( next === 'jump' ) {
				var target = jumpTarget( pet, world, rng );
				if ( target ) {
					launch( pet, target.x, target.platform.y );
					return pet;
				}
				next = 'walk';
			}
			enter( pet, next, rng, world );
		} else if ( pet.timer <= -4 ) {
			// A walk that cannot reach its target ends anyway.
			enter( pet, 'idle', rng, world );
		}

		return pet;
	}

	/**
	 * Throws a ball from a point with a speed.
	 *
	 * @param {number} x  Start x.
	 * @param {number} y  Start height.
	 * @param {number} vx Speed across.
	 * @param {number} vy Speed up (negative) or down.
	 * @return {Object} Ball.
	 */
	function throwBall( x, y, vx, vy ) {
		return { x: x, y: y, vx: vx, vy: vy, landed: false, platform: null, caught: null, age: 0 };
	}

	/**
	 * Moves a ball on: it falls, bounces off the sides and lands on a platform.
	 *
	 * @param {Object} ball  Ball (changed in place).
	 * @param {number} dt    Seconds.
	 * @param {Object} world World.
	 * @return {Object} The ball.
	 */
	function stepBall( ball, dt, world ) {
		ball.age += dt;
		if ( ball.landed ) {
			var p = find( world.platforms, ball.platform );
			if ( p ) {
				ball.y = p.y;
			} else {
				ball.landed = false;
				ball.platform = null;
			}
			return ball;
		}
		var before = ball.y;
		ball.vy += GRAVITY * dt;
		ball.x += ball.vx * dt;
		ball.y += ball.vy * dt;
		if ( ball.x < 6 || ball.x > world.width - 6 ) {
			ball.vx = -ball.vx * 0.6;
			ball.x = Math.max( 6, Math.min( world.width - 6, ball.x ) );
		}
		if ( ball.vy > 0 ) {
			var land = landing( world.platforms, ball.x, before, ball.y );
			if ( land ) {
				ball.y = land.y;
				ball.landed = true;
				ball.platform = land.id;
				ball.vx = 0;
				ball.vy = 0;
			}
		}
		return ball;
	}

	/**
	 * The sprite frame to show.
	 *
	 * @param {Object} pet Pet.
	 * @return {number} Frame index.
	 */
	function frame( pet ) {
		var frames = FRAMES[ pet.state ] || FRAMES.idle;
		if ( ( pet.state === 'idle' || pet.state === 'sit' ) && pet.blink > 0 ) {
			return frames[ 1 ];
		}
		var fps = FPS[ pet.state ] || 0;
		return frames[ fps ? Math.floor( pet.clock * fps ) % frames.length : 0 ];
	}

	/**
	 * Pets a pet: it stops, sits and is happy for a moment.
	 *
	 * @param {Object}   pet   Pet.
	 * @param {Function} rng   Random numbers.
	 * @param {Object}   world World.
	 */
	function pat( pet, rng, world ) {
		pet.happy = 2;
		if ( pet.platform ) {
			enter( pet, 'sit', rng, world );
			pet.timer = 2.5;
		}
	}

	return {
		FRAMES: FRAMES,
		random: random,
		platforms: platforms,
		createPet: createPet,
		step: step,
		throwBall: throwBall,
		stepBall: stepBall,
		frame: frame,
		pat: pat,
	};
} );
