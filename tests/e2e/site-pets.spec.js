// End-to-end tests for Site Pets. Every outcome is checked in the database
// through WP-CLI as well as on screen.
const { test, expect, wp, wpEval, openEditor, logInAs } = require( './utils' );

const settings = () => JSON.parse( wp( 'site-pets', 'status', '--format=json' ) );
const instance = ( page ) => page.evaluate( () => document.sitePetsInstance && document.sitePetsInstance.pets.map( ( p ) => ( { type: p.type, state: p.state, x: p.x, happy: p.happy, name: p.name } ) ) );

function page( title, content = '<!-- wp:paragraph --><p>Hello.</p><!-- /wp:paragraph -->', type = 'post' ) {
	return wp( 'post', 'create', `--post_type=${ type }`, `--post_title=${ title }`, '--post_status=publish', `--post_content=${ content }`, '--porcelain' );
}

function savedOption() {
	try {
		return wp( 'option', 'get', 'site_pets_settings', '--format=json' );
	} catch ( error ) {
		return null;
	}
}

function resetSettings() {
	try {
		wp( 'option', 'delete', 'site_pets_settings' );
	} catch ( error ) {
		// Not saved yet.
	}
}

test.beforeEach( () => resetSettings() );

test.describe( 'Site pets', () => {
	test( 'out of the box: one orange cat on every page, with its sprite and buttons', async ( { page: tab } ) => {
		expect( settings() ).toMatchObject( { enabled: true, pets: [ { type: 'cat-orange', name: '' } ], where: 'everywhere' } );

		await tab.goto( `/?p=${ page( 'Hello pets' ) }` );

		const pet = tab.locator( '.spets-layer--page .spets-pet' );
		await expect( pet ).toHaveCount( 1 );
		await expect( pet ).toHaveAttribute( 'title', 'Mango' );
		const sprite = await pet.evaluate( ( node ) => getComputedStyle( node ).backgroundImage );
		expect( sprite ).toContain( '/wp-content/plugins/site-pets/assets/sprites/cat-orange.png' );
		const loaded = await tab.evaluate( ( url ) => fetch( url ).then( ( r ) => r.ok && r.headers.get( 'content-type' ) ), sprite.slice( 5, -2 ) );
		expect( loaded ).toContain( 'image/png' );
		await expect( tab.getByRole( 'button', { name: 'Throw a ball' } ) ).toBeVisible();
		await expect( tab.getByRole( 'button', { name: 'Hide pets' } ) ).toBeVisible();
	} );

	test( 'the settings screen saves pets, where and options, and previews the pets', async ( { page: tab } ) => {
		await tab.goto( '/wp-admin/themes.php?page=site-pets' );
		await tab.getByLabel( 'Pet 1', { exact: true } ).selectOption( 'dog' );
		await tab.getByLabel( 'Name of pet 1' ).fill( 'Biscuit' );
		await tab.getByLabel( 'Pet 2', { exact: true } ).selectOption( 'fox' );
		await expect( tab.locator( '#spets-preview .spets-pet' ) ).toHaveCount( 2 );
		await tab.getByLabel( 'The front page only' ).check();
		await tab.getByLabel( 'Show pets on phones' ).uncheck();
		await tab.getByRole( 'button', { name: 'Save Changes' } ).click();
		await expect( tab.locator( '#setting-error-settings_updated' ) ).toBeVisible();

		expect( settings() ).toMatchObject( {
			enabled: true,
			pets: [
				{ type: 'dog', name: 'Biscuit' },
				{ type: 'fox', name: '' },
			],
			where: 'front',
			mobile: false,
			ball: true,
		} );
	} );

	test( '"front page only" keeps pets and their script off other pages', async ( { page: tab } ) => {
		wp( 'site-pets', 'set', 'dog', '--where=front' );
		const post = page( 'Not the front page' );

		await tab.goto( `/?p=${ post }` );
		await expect( tab.locator( 'p', { hasText: 'Hello.' } ) ).toBeVisible();
		await expect( tab.locator( '.spets-layer' ) ).toHaveCount( 0 );
		await expect( tab.locator( 'script[src*="site-pets/assets/js/pets.js"]' ) ).toHaveCount( 0 );

		await tab.goto( '/' );
		await expect( tab.locator( '.spets-layer--page .spets-pet' ) ).toHaveCount( 1 );
	} );

	test( 'clicks go through the pets layer to the page', async ( { page: tab } ) => {
		const target = page( 'Target' );
		await tab.goto( `/?p=${ page( 'With a link', `<!-- wp:paragraph --><p><a href="/?p=${ target }">Go to the target</a></p><!-- /wp:paragraph -->` ) }` );
		await expect( tab.locator( '.spets-layer--page' ) ).toHaveCSS( 'pointer-events', 'none' );

		await tab.getByRole( 'link', { name: 'Go to the target' } ).click();

		await expect( tab ).toHaveURL( /\/target\/$/ );
	} );

	test( 'visitors can hide the pets, and they stay hidden after a reload', async ( { page: tab } ) => {
		const before = savedOption();
		await tab.goto( `/?p=${ page( 'Hide me' ) }` );

		await tab.getByRole( 'button', { name: 'Hide pets' } ).click();
		await expect( tab.locator( '.spets-layer--page' ) ).toBeHidden();
		await tab.reload();
		await expect( tab.locator( '.spets-layer--page' ) ).toBeHidden();
		await expect( tab.getByRole( 'button', { name: 'Show pets' } ) ).toHaveAttribute( 'aria-pressed', 'true' );
		expect( await tab.evaluate( () => localStorage.getItem( 'sitePets.hidden.site' ) ) ).toBe( '1' );

		await tab.getByRole( 'button', { name: 'Show pets' } ).click();
		await expect( tab.locator( '.spets-layer--page .spets-pet' ) ).toBeVisible();
		// The visitor's choice is not stored on the site.
		expect( savedOption() ).toBe( before );
	} );

	test( 'with reduced motion the pets sit still', async ( { page: tab } ) => {
		await tab.emulateMedia( { reducedMotion: 'reduce' } );
		await tab.goto( `/?p=${ page( 'Calm' ) }` );
		const first = await instance( tab );
		await tab.waitForTimeout( 3000 );
		const later = await instance( tab );

		expect( later[ 0 ].x ).toBe( first[ 0 ].x );
		expect( [ 'sit', 'sleep' ] ).toContain( later[ 0 ].state );
	} );

	test( 'a thrown ball is fetched', async ( { page: tab } ) => {
		wp( 'site-pets', 'set', 'dog' );
		await tab.goto( `/?p=${ page( 'Fetch' ) }` );

		await tab.locator( '.spets-controls--page' ).getByRole( 'button', { name: 'Throw a ball' } ).click();
		await expect( tab.locator( '.spets-layer--page .spets-ball' ) ).toHaveCount( 1 );

		await expect.poll( async () => ( await instance( tab ) )[ 0 ].happy, { timeout: 20000 } ).toBeGreaterThan( 0 );
		await expect( tab.locator( '.spets-layer--page .spets-ball' ) ).toHaveCount( 0 );
	} );

	test( 'petting a pet shows a heart', async ( { page: tab } ) => {
		await tab.emulateMedia( { reducedMotion: 'reduce' } );
		await tab.goto( `/?p=${ page( 'Pet me' ) }` );

		await tab.locator( '.spets-layer--page .spets-pet' ).click();

		await expect( tab.locator( '.spets-heart' ) ).toHaveCount( 1 );
		expect( ( await instance( tab ) )[ 0 ].happy ).toBeGreaterThan( 0 );
	} );

	test( 'the sitePets.nextState JS filter decides what pets do', async ( { page: tab } ) => {
		await tab.addInitScript( () => {
			document.addEventListener( 'DOMContentLoaded', () => {
				window.wp.hooks.addFilter( 'sitePets.nextState', 'e2e', () => 'sleep' );
			} );
		} );
		await tab.goto( `/?p=${ page( 'Sleepy' ) }` );

		await expect.poll( async () => ( await instance( tab ) )[ 0 ].state, { timeout: 10000 } ).toBe( 'sleep' );
	} );

	test( 'turned off: no pets anywhere', async ( { page: tab } ) => {
		wp( 'site-pets', 'disable' );
		await tab.goto( '/' );

		await expect( tab.locator( '.spets-layer' ) ).toHaveCount( 0 );
		expect( settings().enabled ).toBe( false );
	} );
} );

test.describe( 'Desk buddy', () => {
	test( 'a user picks a buddy on their profile and it walks in wp-admin, for them only', async ( { page: tab, browser } ) => {
		await tab.goto( '/wp-admin/profile.php' );
		await tab.getByLabel( 'Pet', { exact: true } ).selectOption( 'wapuu' );
		await tab.getByLabel( 'Name', { exact: true } ).fill( 'Wappy' );
		await tab.getByRole( 'button', { name: 'Update Profile' } ).click();
		await expect( tab.locator( '#message' ) ).toBeVisible();

		expect( JSON.parse( wp( 'user', 'meta', 'get', 'admin', 'site_pets_buddy', '--format=json' ) ) ).toEqual( { type: 'wapuu', name: 'Wappy' } );

		await tab.goto( '/wp-admin/' );
		const buddy = tab.locator( '.spets-layer--admin .spets-pet' );
		await expect( buddy ).toHaveCount( 1 );
		await expect( buddy ).toHaveAttribute( 'title', 'Wappy' );

		try {
			wp( 'user', 'create', 'e2e_editor', 'e2e_editor@example.com', '--role=editor', '--user_pass=password' );
		} catch ( error ) {
			// Already there.
		}
		const { context, page: other } = await logInAs( browser, 'e2e_editor', 'password' );
		await other.goto( '/wp-admin/' );
		await expect( other.locator( '#wpbody' ) ).toBeVisible();
		await expect( other.locator( '.spets-layer--admin' ) ).toHaveCount( 0 );
		await context.close();

		wp( 'site-pets', 'buddy', 'admin', 'none' );
	} );

	test( 'buddies can be turned off for everyone', async ( { page: tab } ) => {
		wp( 'site-pets', 'buddy', 'admin', 'fox' );
		wpEval( "PratikLondhe\\SitePets\\Settings::update( array( 'buddies' => false ) );" );

		await tab.goto( '/wp-admin/profile.php' );
		await expect( tab.locator( '#site-pets-buddy' ) ).toHaveCount( 0 );
		await expect( tab.locator( '.spets-layer--admin' ) ).toHaveCount( 0 );

		wp( 'site-pets', 'buddy', 'admin', 'none' );
	} );
} );

test.describe( 'Pet Playground block', () => {
	test( 'renders its scene and pets on the site, even with site pets off', async ( { page: tab } ) => {
		wp( 'site-pets', 'disable' );
		const id = page( 'Playground', '<!-- wp:site-pets/playground {"pets":[{"type":"fox","name":"Fern"},{"type":"duck","name":""}],"scene":"beach","height":300} /-->' );
		await tab.goto( `/?p=${ id }` );

		const block = tab.locator( '.wp-block-site-pets-playground' );
		await expect( block ).toHaveClass( /spets-playground--beach/ );
		await expect( block ).toHaveAttribute( 'aria-label', 'Pets playing: Fern (Fox), Quackers (Rubber duck)' );
		await expect( block.locator( '.spets-pet' ) ).toHaveCount( 2 );
		expect( ( await block.boundingBox() ).height ).toBe( 300 );
		await expect( tab.locator( '.spets-layer--page' ) ).toHaveCount( 0 );
	} );

	test( 'in the editor the pets play in the canvas, and settings save to the post', async ( { page: tab } ) => {
		const id = Number( wp( 'post', 'create', '--post_title=Editor playground', '--post_status=draft', '--porcelain' ) );
		await openEditor( tab, id );
		await tab.evaluate( () => window.wp.data.dispatch( 'core/block-editor' ).insertBlocks( window.wp.blocks.createBlock( 'site-pets/playground' ) ) );

		const canvas = tab.frameLocator( 'iframe[name="editor-canvas"]' );
		await expect( canvas.locator( '.spets-playground .spets-pet' ) ).toHaveCount( 2 );

		const sidebar = tab.getByRole( 'region', { name: 'Editor settings' } );
		await sidebar.getByLabel( 'Scene', { exact: true } ).selectOption( 'night' );
		await sidebar.getByRole( 'button', { name: 'Add a pet' } ).click();
		await expect( canvas.locator( '.spets-playground .spets-pet' ) ).toHaveCount( 3 );
		await tab.evaluate( () => window.wp.data.dispatch( 'core/editor' ).savePost() );
		await tab.waitForFunction( () => ! window.wp.data.select( 'core/editor' ).isEditedPostDirty() );

		const content = wp( 'post', 'get', String( id ), '--field=post_content' );
		expect( content ).toContain( '"scene":"night"' );
		expect( ( content.match( /"type":/g ) || [] ).length ).toBe( 3 );
	} );
} );

test.describe( 'Permissions, WP-CLI, abilities and uninstall', () => {
	test( 'an editor cannot open the settings screen', async ( { browser } ) => {
		try {
			wp( 'user', 'create', 'e2e_editor', 'e2e_editor@example.com', '--role=editor', '--user_pass=password' );
		} catch ( error ) {
			// Already there.
		}
		const { context, page: tab } = await logInAs( browser, 'e2e_editor', 'password' );
		const response = await tab.goto( '/wp-admin/themes.php?page=site-pets' );
		const status = response.status();
		await context.close();

		expect( status ).toBe( 403 );
	} );

	test( 'wp site-pets set, status, types and buddy', () => {
		wp( 'site-pets', 'set', 'cat-grey:Smoke', 'duck', '--where=types', '--post-types=page', '--ball=no' );
		expect( settings() ).toMatchObject( { pets: [ { type: 'cat-grey', name: 'Smoke' }, { type: 'duck', name: '' } ], where: 'types', post_types: [ 'page' ], ball: false } );

		const types = JSON.parse( wp( 'site-pets', 'types', '--format=json' ) ).map( ( t ) => t.type );
		expect( types ).toEqual( [ 'cat-orange', 'cat-grey', 'cat-black', 'dog', 'fox', 'duck', 'wapuu' ] );

		expect( () => wp( 'site-pets', 'set', 'dragon' ) ).toThrow( /Unknown pet type/ );

		wp( 'site-pets', 'buddy', 'admin', 'dog', '--name=Rex' );
		expect( JSON.parse( wp( 'user', 'meta', 'get', 'admin', 'site_pets_buddy', '--format=json' ) ) ).toEqual( { type: 'dog', name: 'Rex' } );
		wp( 'site-pets', 'buddy', 'admin', 'none' );
	} );

	test( 'abilities read and change the settings on WordPress 6.9 and later', async ( { rest } ) => {
		test.skip( '1' !== wpEval( "echo (int) function_exists( 'wp_register_ability' );" ), 'The Abilities API needs WordPress 6.9.' );

		const update = await rest( 'POST', '/wp-abilities/v1/abilities/site-pets/update-settings/run', { input: { pets: [ { type: 'fox', name: 'Agent fox' } ], enabled: true } } );
		expect( update.status ).toBe( 200 );
		expect( settings().pets ).toEqual( [ { type: 'fox', name: 'Agent fox' } ] );

		const read = await rest( 'GET', '/wp-abilities/v1/abilities/site-pets/get-settings/run' );
		expect( read.body.pets[ 0 ].name ).toBe( 'Agent fox' );

		const bad = await rest( 'POST', '/wp-abilities/v1/abilities/site-pets/update-settings/run', { input: { where: 'moon' } } );
		expect( bad.status ).toBe( 400 );
	} );

	test( 'uninstall removes the settings and every buddy', () => {
		wp( 'site-pets', 'set', 'fox' );
		wp( 'site-pets', 'buddy', 'admin', 'dog' );

		// Runs uninstall.php directly: `wp plugin uninstall` would delete the mounted plugin folder.
		wpEval( "define( 'WP_UNINSTALL_PLUGIN', 'site-pets/site-pets.php' ); include WP_PLUGIN_DIR . '/site-pets/uninstall.php';" );

		expect( () => wp( 'option', 'get', 'site_pets_settings' ) ).toThrow();
		expect( wp( 'user', 'meta', 'list', 'admin', '--keys=site_pets_buddy', '--format=count' ) ).toBe( '0' );
	} );
} );
