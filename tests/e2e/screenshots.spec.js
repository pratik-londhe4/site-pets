// Regenerates .wordpress-org/screenshot-N.png (readme.txt "== Screenshots ==" and README.md).
// Run on demand: npm run screenshots
const { test, expect, openEditor, wp } = require( './utils' );
const { prepareSite, shot } = require( './utils/media' );

const p = ( text ) => `<!-- wp:paragraph --><p>${ text }</p><!-- /wp:paragraph -->`;
const h = ( text ) => `<!-- wp:heading --><h2 class="wp-block-heading">${ text }</h2><!-- /wp:heading -->`;
const box = ( text ) =>
	`<!-- wp:group {"style":{"color":{"background":"#ffe9c7"},"spacing":{"padding":{"top":"48px","bottom":"48px","left":"32px","right":"32px"}}}} --><div class="wp-block-group has-background" style="background-color:#ffe9c7;padding-top:48px;padding-right:32px;padding-bottom:48px;padding-left:32px"><!-- wp:paragraph {"align":"center"} --><p class="has-text-align-center">${ text }</p><!-- /wp:paragraph --></div><!-- /wp:group -->`;

/**
 * Puts the site's pets in a pose: on a platform, in a state.
 *
 * @param {import('@playwright/test').Page} page  Page.
 * @param {Array}                           poses { index, selector (or "ground"), at (0 to 1 along it), state, facing }.
 */
async function pose( page, poses ) {
	await page.evaluate( ( list ) => {
		const instance = document.sitePetsInstance;
		list.forEach( ( item ) => {
			const pet = instance.pets[ item.index ];
			const ground = item.selector === 'ground';
			const rect = ground ? { left: 0, right: window.innerWidth, top: window.innerHeight } : document.querySelector( item.selector ).getBoundingClientRect();
			pet.x = rect.left + ( rect.right - rect.left ) * item.at;
			pet.y = rect.top;
			pet.vx = 0;
			pet.vy = 0;
			pet.state = item.state;
			pet.timer = 60;
			pet.target = pet.x;
			pet.facing = item.facing || 1;
			pet.platform = null;
		} );
	}, poses );
	// One frame later the engine has found each pet's platform.
	await page.waitForTimeout( 300 );
}

test.describe( 'Screenshots', () => {
	test.use( { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } );
	let postId;

	test.beforeAll( () => {
		prepareSite( 'Pixel Garden' );
		wp( 'site-pets', 'set', 'cat-orange', 'dog', 'wapuu' );
		postId = wp( 'post', 'create', '--post_title=Meet the pets', '--post_status=publish', `--post_content=${ [ p( 'Mango, Biscuit and Wapuu live on this site. Click one to pet it, or throw them a ball.' ), h( 'They nap on headings' ), box( 'And climb on boxes' ), p( 'Scroll and they hop from one to the next.' ) ].join( '\n\n' ) }`, '--porcelain' );
	} );

	test( '1: pets on a page', async ( { page } ) => {
		await page.goto( `/?p=${ postId }` );
		await page.evaluate( () => window.scrollTo( 0, 120 ) );
		await expect( page.locator( '.spets-layer--page .spets-pet' ) ).toHaveCount( 3 );
		await pose( page, [
			{ index: 0, selector: 'h2.wp-block-heading', at: 0.35, state: 'sleep' },
			{ index: 1, selector: '.wp-block-group.has-background', at: 0.7, state: 'sit', facing: -1 },
			{ index: 2, selector: 'ground', at: 0.5, state: 'walk' },
		] );
		await shot( page, 1 );
	} );

	test( '2: Appearance > Site Pets, with a live preview', async ( { page } ) => {
		await page.goto( '/wp-admin/themes.php?page=site-pets' );
		await expect( page.locator( '#spets-preview .spets-pet' ) ).toHaveCount( 3 );
		await page.waitForTimeout( 2500 );
		await shot( page, 2 );
	} );

	test( '3: the Pet Playground block in the editor', async ( { page } ) => {
		const id = Number( wp( 'post', 'create', '--post_title=Our garden', '--post_status=draft', `--post_content=${ p( 'Fern, Quackers and Shadow play here.' ) }\n\n<!-- wp:site-pets/playground {"pets":[{"type":"fox","name":"Fern"},{"type":"duck","name":""},{"type":"cat-black","name":""}],"scene":"garden","height":300} /-->`, '--porcelain' ) );
		await openEditor( page, id );
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		await expect( canvas.locator( '.spets-playground .spets-pet' ) ).toHaveCount( 3 );
		await page.evaluate( () => {
			const blocks = window.wp.data.select( 'core/block-editor' ).getBlocks();
			window.wp.data.dispatch( 'core/block-editor' ).selectBlock( blocks[ blocks.length - 1 ].clientId );
		} );
		await expect( page.getByRole( 'button', { name: 'Add a pet' } ) ).toHaveCount( 0 );
		await page.waitForTimeout( 3000 );
		await shot( page, 3 );
	} );

	test( '4: a desk buddy in wp-admin', async ( { page } ) => {
		wp( 'site-pets', 'buddy', 'admin', 'fox', '--name=Rusty' );
		await page.goto( '/wp-admin/' );
		await expect( page.locator( '.spets-layer--admin .spets-pet' ) ).toHaveCount( 1 );
		await page.waitForTimeout( 2500 );
		await shot( page, 4 );
		wp( 'site-pets', 'buddy', 'admin', 'none' );
	} );
} );
