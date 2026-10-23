// Records .github/media/demo.gif for the README. Run on demand: npm run demo
const { test, expect, wp } = require( './utils' );
const { prepareSite, recordDemo } = require( './utils/media' );

const p = ( text ) => `<!-- wp:paragraph --><p>${ text }</p><!-- /wp:paragraph -->`;
const h = ( text ) => `<!-- wp:heading --><h2 class="wp-block-heading">${ text }</h2><!-- /wp:heading -->`;

test( 'demo: pets walk, get petted, fetch a ball and play in a block', async ( { browser } ) => {
	test.setTimeout( 240_000 );
	prepareSite( 'Pixel Garden' );
	wp( 'site-pets', 'set', 'cat-orange', 'dog', 'wapuu' );
	const postId = wp(
		'post',
		'create',
		'--post_title=Meet the pets',
		'--post_status=publish',
		`--post_content=${ [
			p( 'Mango, Biscuit and Wapuu live on this site. Click one to pet it, or throw them a ball.' ),
			h( 'They hop onto headings' ),
			p( 'And play in a block:' ),
			'<!-- wp:site-pets/playground {"pets":[{"type":"fox","name":"Fern"},{"type":"duck","name":""},{"type":"cat-black","name":""}],"scene":"garden","height":240} /-->',
		].join( '\n\n' ) }`,
		'--porcelain'
	);

	await recordDemo(
		browser,
		async ( page, demo ) => {
			await page.goto( `/?p=${ postId }` );
			await expect( page.locator( '.spets-layer--page .spets-pet' ) ).toHaveCount( 3 );
			await page.evaluate( () => window.scrollTo( 0, 200 ) );
			await demo.start();
			await demo.pause( 3000 );

			// Pet one.
			const cat = page.locator( '.spets-layer--page .spets-pet' ).first();
			await demo.click( cat, 1600 );

			// Throw a ball and watch them fetch it.
			await demo.click( page.locator( '.spets-controls--page' ).getByRole( 'button', { name: 'Throw a ball' } ), 200 );
			await expect.poll( () => page.evaluate( () => document.sitePetsInstance.pets.some( ( pet ) => pet.happy > 0 ) ), { timeout: 15000 } ).toBe( true );
			await demo.pause( 2000 );

			// The playground block.
			await page.locator( '.wp-block-site-pets-playground' ).evaluate( ( node ) => node.scrollIntoView( { block: 'center', behavior: 'smooth' } ) );
			await demo.pause( 1500 );
			await demo.click( page.locator( '.wp-block-site-pets-playground' ).getByRole( 'button', { name: 'Throw a ball' } ), 200 );
			await demo.pause( 4500 );
		},
		{ viewport: { width: 1200, height: 720 }, width: 900, fps: 12 }
	);
} );
