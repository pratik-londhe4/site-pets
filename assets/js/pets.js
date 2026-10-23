/**
 * Site Pets in the browser: draws the pets the engine moves.
 *
 * window.sitePets.mount( host, config ) puts pets on a page (host = document),
 * in wp-admin, or inside a Pet Playground block (host = the block's element).
 * Site and admin pets mount themselves from window.sitePetsConfig; playground
 * blocks from their data-site-pets attribute.
 *
 * Hooks (wp.hooks, when loaded):
 * - filter sitePets.config( config, host ): the settings for one mount.
 * - filter sitePets.platformSelector( selector ): elements pets walk on.
 * - filter sitePets.nextState( state, pet ): what a pet does next.
 * - action sitePets.ready( instance ), sitePets.petted( pet ), sitePets.ballThrown( ball ), sitePets.hidden( hidden ).
 */
( function ( window ) {
	'use strict';

	var engine = window.sitePetsEngine;
	var FRAME = 32;
	var FRAME_COUNT = 16;
	var DEFAULT_SELECTOR = 'h1, h2, h3, img, figure, .wp-block-image, .wp-block-button__link, .wp-block-separator, hr, blockquote, pre, table, .wp-block-cover, .wp-block-group.has-background';

	function hooks() {
		return window.wp && window.wp.hooks ? window.wp.hooks : null;
	}

	function filter( name, value, extra ) {
		var h = hooks();
		return h ? h.applyFilters( name, value, extra ) : value;
	}

	function action( name, value ) {
		var h = hooks();
		if ( h ) {
			h.doAction( name, value );
		}
	}

	function storage( win, key, value ) {
		try {
			if ( value === undefined ) {
				return win.localStorage.getItem( key );
			}
			if ( value === null ) {
				win.localStorage.removeItem( key );
			} else {
				win.localStorage.setItem( key, value );
			}
		} catch ( e ) {
			// Storage blocked (private mode): the choice lasts for this page only.
		}
		return null;
	}

	/**
	 * Puts pets somewhere.
	 *
	 * @param {Document|Element} host   Document for the whole page, or a playground element.
	 * @param {Object}           config { pets, scale, ball, hide, mobile, mode, strings }.
	 * @return {Object|null} { pets, throwBall, setHidden, destroy }, or null when nothing was mounted.
	 */
	function mount( host, config ) {
		var doc = host.ownerDocument || host;
		var win = doc.defaultView || window;
		config = filter( 'sitePets.config', config, host );
		if ( ! config || ! config.pets || ! config.pets.length ) {
			return null;
		}

		var playground = config.mode === 'playground';
		// Visitors hide site pets and users hide their desk buddy separately.
		var storageKey = 'sitePets.hidden.' + ( config.mode || 'site' );
		var strings = config.strings || {};
		var scale = config.scale || 2;
		var size = FRAME * scale;
		if ( ! playground && config.mobile === false && win.matchMedia && win.matchMedia( '(max-width: 600px)' ).matches ) {
			return null;
		}

		var container = playground ? host : doc.body;
		var layer = doc.createElement( 'div' );
		layer.className = 'spets-layer' + ( playground ? '' : ' spets-layer--page' ) + ( config.mode === 'admin' ? ' spets-layer--admin' : '' );
		layer.setAttribute( 'aria-hidden', 'true' );
		container.appendChild( layer );

		var reduced = win.matchMedia ? win.matchMedia( '(prefers-reduced-motion: reduce)' ) : { matches: false };
		var rng = engine.random( ( Date.now() ^ ( Math.random() * 1e9 ) ) >>> 0 );
		var selector = filter( 'sitePets.platformSelector', config.selector || DEFAULT_SELECTOR );
		var ids = new win.WeakMap();
		var nextId = 1;
		var platforms = [];
		var dirty = true;
		var lastScan = 0;
		var ball = null;
		var ballEl = null;
		var running = false;
		var hidden = false;
		var last = 0;
		var raf = 0;

		function bounds() {
			if ( playground ) {
				return { width: host.clientWidth, height: host.clientHeight - ( config.floor || 0 ) };
			}
			// A little above the bottom edge, so feet are not cut off.
			return { width: win.innerWidth, height: win.innerHeight - 4 };
		}

		function idFor( el ) {
			if ( ! ids.has( el ) ) {
				ids.set( el, 'p' + nextId++ );
			}
			return ids.get( el );
		}

		function scan() {
			var world = bounds();
			var rects = [];
			var origin = playground ? host.getBoundingClientRect() : { left: 0, top: 0 };
			var found = playground ? host.querySelectorAll( '.spets-ledge' ) : doc.querySelectorAll( selector );
			for ( var i = 0; i < found.length && rects.length < 60; i++ ) {
				var el = found[ i ];
				if ( ! playground && ( layer.contains( el ) || el.closest( '#wpadminbar, .spets-controls, .spets-playground' ) ) ) {
					continue;
				}
				var r = el.getBoundingClientRect();
				if ( r.width < 1 || r.bottom < 0 || r.top > world.height ) {
					continue;
				}
				rects.push( { id: idFor( el ), left: r.left - origin.left, right: r.right - origin.left, top: r.top - origin.top } );
			}
			platforms = engine.platforms( rects, world, { minTop: playground ? 30 : 70 } );
			dirty = false;
		}

		var pets = config.pets.map( function ( p, i ) {
			var area = bounds();
			var pet = engine.createPet( { id: i, type: p.type, name: p.name, x: area.width * ( 0.15 + 0.7 * rng() ), world: area } );
			var el = doc.createElement( 'div' );
			el.className = 'spets-pet spets-pet--' + String( p.type ).replace( /[^a-z0-9-]/gi, '' );
			el.style.width = size + 'px';
			el.style.height = size + 'px';
			el.style.backgroundImage = 'url("' + p.sprite + '")';
			el.style.backgroundSize = FRAME * FRAME_COUNT * scale + 'px ' + size + 'px';
			if ( p.name ) {
				el.title = p.name;
			}
			el.addEventListener( 'click', function () {
				engine.pat( pet, rng, world( true ) );
				heart( pet );
				action( 'sitePets.petted', pet );
			} );
			layer.appendChild( el );
			return { pet: pet, el: el };
		} );

		function world( fresh ) {
			if ( fresh || dirty ) {
				scan();
			}
			var b = bounds();
			return {
				width: b.width,
				height: b.height,
				platforms: platforms,
				ball: ball,
				reducedMotion: reduced.matches,
				chooseNext: function ( state, pet ) {
					return filter( 'sitePets.nextState', state, pet );
				},
			};
		}

		function heart( pet ) {
			var h = doc.createElement( 'span' );
			h.className = 'spets-heart';
			h.textContent = '♥';
			h.style.left = pet.x + 'px';
			h.style.top = pet.y - size - 6 + 'px';
			layer.appendChild( h );
			win.setTimeout( function () {
				h.remove();
			}, 1200 );
		}

		function render() {
			pets.forEach( function ( item ) {
				var pet = item.pet;
				var flip = pet.facing < 0 ? ' scaleX(-1)' : '';
				item.el.style.transform = 'translate3d(' + Math.round( pet.x - size / 2 ) + 'px,' + Math.round( pet.y - size ) + 'px,0)' + flip;
				item.el.style.backgroundPosition = -engine.frame( pet ) * size + 'px 0';
				item.el.setAttribute( 'data-state', pet.state );
			} );
			if ( ball && ballEl ) {
				ballEl.style.transform = 'translate3d(' + Math.round( ball.x - 7 ) + 'px,' + Math.round( ball.y - 14 ) + 'px,0)';
			}
		}

		function tick( now ) {
			raf = 0;
			if ( ! running ) {
				return;
			}
			var dt = Math.min( 0.05, last ? ( now - last ) / 1000 : 0.016 );
			last = now;
			if ( now - lastScan > 500 ) {
				dirty = true;
				lastScan = now;
			}
			var w = world();
			if ( ball ) {
				engine.stepBall( ball, dt, w );
				if ( ball.caught !== null && ! ball.done ) {
					ball.done = true;
					win.setTimeout( removeBall, 500 );
				} else if ( ball.age > 20 ) {
					removeBall();
				}
			}
			pets.forEach( function ( item ) {
				engine.step( item.pet, dt, w, rng );
			} );
			render();
			raf = win.requestAnimationFrame( tick );
		}

		function start() {
			if ( running || hidden || doc.hidden ) {
				return;
			}
			running = true;
			last = 0;
			raf = win.requestAnimationFrame( tick );
		}

		function stop() {
			running = false;
			if ( raf ) {
				win.cancelAnimationFrame( raf );
				raf = 0;
			}
		}

		function removeBall() {
			if ( ballEl ) {
				ballEl.remove();
			}
			ball = null;
			ballEl = null;
		}

		function throwBall() {
			removeBall();
			var b = bounds();
			var fromLeft = rng() < 0.5;
			ball = engine.throwBall( fromLeft ? 30 : b.width - 30, b.height - 80, ( fromLeft ? 1 : -1 ) * ( 250 + rng() * 450 ), -( 600 + rng() * 300 ) );
			ballEl = doc.createElement( 'span' );
			ballEl.className = 'spets-ball';
			layer.appendChild( ballEl );
			action( 'sitePets.ballThrown', ball );
			start();
		}

		function setHidden( value ) {
			hidden = !! value;
			layer.hidden = hidden;
			if ( hideButton ) {
				hideButton.textContent = hidden ? strings.show || 'Show pets' : strings.hide || 'Hide pets';
				hideButton.setAttribute( 'aria-pressed', hidden ? 'true' : 'false' );
			}
			if ( ballButton ) {
				ballButton.hidden = hidden;
			}
			if ( ! playground ) {
				storage( win, storageKey, hidden ? '1' : null );
			}
			if ( hidden ) {
				stop();
			} else {
				start();
			}
			action( 'sitePets.hidden', hidden );
		}

		// Controls: real buttons, outside the decorative layer.
		var controls = null;
		var ballButton = null;
		var hideButton = null;
		if ( config.ball || ( config.hide && ! playground ) ) {
			controls = doc.createElement( 'div' );
			controls.className = 'spets-controls' + ( playground ? '' : ' spets-controls--page' );
			if ( config.ball ) {
				ballButton = doc.createElement( 'button' );
				ballButton.type = 'button';
				ballButton.className = 'spets-button spets-button--ball';
				ballButton.textContent = strings.ball || 'Throw a ball';
				ballButton.addEventListener( 'click', throwBall );
				controls.appendChild( ballButton );
			}
			if ( config.hide && ! playground ) {
				hideButton = doc.createElement( 'button' );
				hideButton.type = 'button';
				hideButton.className = 'spets-button spets-button--hide';
				hideButton.addEventListener( 'click', function () {
					setHidden( ! hidden );
				} );
				controls.appendChild( hideButton );
			}
			container.appendChild( controls );
		}

		function onChange() {
			dirty = true;
		}
		function onVisibility() {
			if ( doc.hidden ) {
				stop();
			} else {
				start();
			}
		}
		win.addEventListener( 'scroll', onChange, { passive: true } );
		win.addEventListener( 'resize', onChange );
		doc.addEventListener( 'visibilitychange', onVisibility );

		scan();
		pets.forEach( function ( item ) {
			// Start on the ground, facing a random way.
			item.pet.facing = rng() < 0.5 ? -1 : 1;
		} );
		render();
		setHidden( ! playground && config.hide && storage( win, storageKey ) === '1' );

		var instance = {
			pets: pets.map( function ( item ) {
				return item.pet;
			} ),
			layer: layer,
			throwBall: throwBall,
			setHidden: setHidden,
			destroy: function () {
				stop();
				win.removeEventListener( 'scroll', onChange );
				win.removeEventListener( 'resize', onChange );
				doc.removeEventListener( 'visibilitychange', onVisibility );
				layer.remove();
				if ( controls ) {
					controls.remove();
				}
			},
		};
		host.sitePetsInstance = instance;
		action( 'sitePets.ready', instance );
		return instance;
	}

	function boot() {
		if ( window.sitePetsConfig && ! document.sitePetsInstance ) {
			mount( document, window.sitePetsConfig );
		}
		var blocks = document.querySelectorAll( '.spets-playground[data-site-pets]' );
		for ( var i = 0; i < blocks.length; i++ ) {
			if ( ! blocks[ i ].sitePetsInstance ) {
				try {
					mount( blocks[ i ], JSON.parse( blocks[ i ].getAttribute( 'data-site-pets' ) ) );
				} catch ( e ) {
					// A broken attribute leaves that playground empty.
				}
			}
		}
	}

	window.sitePets = { mount: mount, engine: engine };

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
} )( window );
