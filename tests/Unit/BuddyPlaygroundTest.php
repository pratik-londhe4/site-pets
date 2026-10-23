<?php
/**
 * Tests for desk buddies, the Pet Playground block and the settings-saved action.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets\Tests\Unit;

use Brain\Monkey\Actions;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use PratikLondhe\SitePets\Admin\Buddy;
use PratikLondhe\SitePets\Admin\SettingsPage;
use PratikLondhe\SitePets\Block\Playground;
use PratikLondhe\SitePets\Settings;

final class BuddyPlaygroundTest extends TestCase {

	/**
	 * User meta: user ID => key => value.
	 *
	 * @var array
	 */
	private array $meta = array();

	protected function setUp(): void {
		parent::setUp();
		Functions\when( 'plugins_url' )->alias(
			static function ( $path ) {
				return 'https://example.com/p/' . $path;
			}
		);
		Functions\when( 'sanitize_key' )->alias(
			static function ( $key ) {
				return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
			}
		);
		Functions\when( 'sanitize_text_field' )->alias( 'trim' );
		Functions\when( 'esc_url_raw' )->returnArg();
		Functions\when( 'get_post_types' )->justReturn( array( 'post' => 'post' ) );
		Functions\when( 'get_user_meta' )->alias(
			function ( $id, $key ) {
				return $this->meta[ $id ][ $key ] ?? '';
			}
		);
		Functions\when( 'update_user_meta' )->alias(
			function ( $id, $key, $value ) {
				$this->meta[ $id ][ $key ] = $value;
				return true;
			}
		);
		Functions\when( 'delete_user_meta' )->alias(
			function ( $id, $key ) {
				unset( $this->meta[ $id ][ $key ] );
				return true;
			}
		);
		Functions\when( 'wp_json_encode' )->alias( 'json_encode' );
		Functions\when( 'wp_enqueue_script' )->justReturn( null );
		Functions\when( 'get_block_wrapper_attributes' )->alias(
			static function ( $extra ) {
				return 'class="wp-block-site-pets-playground ' . $extra['class'] . '" style="' . $extra['style'] . '"';
			}
		);
	}

	public function test_buddy_is_saved_read_and_removed_with_an_action(): void {
		Actions\expectDone( 'site_pets_buddy_saved' )->twice();

		$this->assertSame(
			array(
				'type' => 'fox',
				'name' => 'Rusty Jr',
			),
			Buddy::set( 7, 'fox', ' Rusty Jr ' )
		);
		$this->assertSame( 'fox', Buddy::get( 7 )['type'] );

		$this->assertNull( Buddy::set( 7, 'none' ) );
		$this->assertNull( Buddy::get( 7 ) );
	}

	public function test_a_buddy_of_a_removed_type_is_ignored(): void {
		$this->meta[3][ Buddy::META ] = array(
			'type' => 'dragon',
			'name' => 'Old',
		);

		$this->assertNull( Buddy::get( 3 ) );
	}

	public function test_buddy_enabled_filter(): void {
		$this->assertTrue( Buddy::enabled() );
		Filters\expectApplied( 'site_pets_buddy_enabled' )->once()->with( true )->andReturn( false );
		$this->assertFalse( Buddy::enabled() );
	}

	public function test_playground_renders_its_scene_pets_and_label(): void {
		$html = ( new Playground() )->render(
			array(
				'pets'   => array(
					array(
						'type' => 'fox',
						'name' => 'Fern',
					),
					array( 'type' => 'dragon' ),
					array( 'type' => 'duck' ),
				),
				'scene'  => 'night',
				'height' => 9000,
				'ball'   => false,
			)
		);

		$this->assertStringContainsString( 'spets-playground spets-playground--night', $html );
		$this->assertStringContainsString( 'height:800px', $html, 'height is clamped' );
		$this->assertStringContainsString( 'aria-label="Pets playing: Fern (Fox), Quackers (Rubber duck)"', $html );

		preg_match( '/data-site-pets="([^"]+)"/', $html, $m );
		$config = json_decode( html_entity_decode( $m[1] ), true );
		$this->assertSame( 'playground', $config['mode'] );
		$this->assertSame( array( 'fox', 'duck' ), array_column( $config['pets'], 'type' ) );
		$this->assertFalse( $config['ball'] );
		$this->assertSame( 28, $config['floor'] );
	}

	public function test_playground_without_known_pets_renders_nothing(): void {
		$this->assertSame( '', ( new Playground() )->render( array( 'pets' => array( array( 'type' => 'dragon' ) ) ) ) );
	}

	public function test_unknown_scene_falls_back_and_scenes_are_filterable(): void {
		Filters\expectApplied( 'site_pets_scenes' )->andReturnUsing(
			static function ( $scenes ) {
				$scenes['Space Station'] = 'Space';
				return $scenes;
			}
		);

		$this->assertArrayHasKey( 'spacestation', Playground::scenes() );
		$html = ( new Playground() )->render(
			array(
				'pets'  => array( array( 'type' => 'dog' ) ),
				'scene' => 'volcano',
			)
		);
		$this->assertStringContainsString( 'spets-playground--garden', $html );
	}

	public function test_settings_saved_action_gets_clean_values(): void {
		Actions\expectDone( 'site_pets_settings_saved' )->once()->with(
			\Mockery::on(
				static function ( $new ) {
					return false === $new['enabled'] && array( 'dog' ) === array_column( $new['pets'], 'type' );
				}
			),
			\Mockery::type( 'array' )
		);

		( new SettingsPage() )->saved(
			null,
			array(
				'pets' => array( array( 'type' => 'dog' ), array( 'type' => 'dragon' ) ),
			)
		);
		$this->assertSame( 'manage_options', Settings::capability() );
	}
}
