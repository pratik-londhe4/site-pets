<?php
/**
 * Tests for settings, pet types, the front-end rules and the config hook.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets\Tests\Unit;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use PratikLondhe\SitePets\Assets;
use PratikLondhe\SitePets\Frontend;
use PratikLondhe\SitePets\Settings;
use PratikLondhe\SitePets\Types;

final class SettingsTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Functions\when( 'plugins_url' )->alias(
			static function ( $path ) {
				return 'https://example.com/wp-content/plugins/site-pets/' . $path;
			}
		);
		Functions\when( 'sanitize_key' )->alias(
			static function ( $key ) {
				return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
			}
		);
		Functions\when( 'sanitize_text_field' )->alias( 'trim' );
		Functions\when( 'esc_url_raw' )->returnArg();
		Functions\when( 'get_post_types' )->justReturn(
			array(
				'post'       => 'post',
				'page'       => 'page',
				'attachment' => 'attachment',
			)
		);
	}

	public function test_defaults_are_one_orange_cat_everywhere(): void {
		$settings = Settings::get();

		$this->assertTrue( $settings['enabled'] );
		$this->assertSame(
			array(
				array(
					'type' => 'cat-orange',
					'name' => '',
				),
			),
			$settings['pets']
		);
		$this->assertSame( 'everywhere', $settings['where'] );
		$this->assertTrue( $settings['ball'] );
	}

	public function test_sanitize_drops_unknown_pets_and_clamps_the_rest(): void {
		$clean = Settings::sanitize(
			array(
				'enabled'    => '1',
				'pets'       => array(
					array(
						'type' => 'dog',
						'name' => '  Biscuit  ',
					),
					array( 'type' => 'dragon' ),
					array(
						'type' => 'fox',
						'name' => str_repeat( 'x', 50 ),
					),
					array( 'type' => 'duck' ),
					array( 'type' => 'wapuu' ),
				),
				'where'      => 'nowhere',
				'post_types' => array( 'page', 'secret', 'post' ),
				'mobile'     => '',
			)
		);

		$this->assertSame( array( 'dog', 'fox', 'duck' ), array_column( $clean['pets'], 'type' ), 'unknown dropped, at most 3' );
		$this->assertSame( 'Biscuit', $clean['pets'][0]['name'] );
		$this->assertSame( 30, strlen( $clean['pets'][1]['name'] ) );
		$this->assertSame( 'everywhere', $clean['where'] );
		$this->assertSame( array( 'page', 'post' ), $clean['post_types'] );
		$this->assertFalse( $clean['mobile'], 'an unticked box turns an option off' );
		$this->assertFalse( $clean['ball'] );
	}

	public function test_max_pets_filter_is_clamped(): void {
		Filters\expectApplied( 'site_pets_max_pets' )->andReturn( 50 );
		$this->assertSame( 10, Settings::max_pets() );
	}

	public function test_update_keeps_other_settings(): void {
		$this->options[ Settings::OPTION ] = Settings::sanitize(
			array(
				'enabled' => true,
				'pets'    => array( array( 'type' => 'fox' ) ),
				'ball'    => true,
			)
		);

		$saved = Settings::update( array( 'enabled' => false ) );

		$this->assertFalse( $saved['enabled'] );
		$this->assertSame( 'fox', $saved['pets'][0]['type'] );
		$this->assertTrue( $this->options[ Settings::OPTION ]['ball'] );
	}

	public function test_settings_and_defaults_filters(): void {
		Filters\expectApplied( 'site_pets_defaults' )->once()->andReturnUsing(
			static function ( $defaults ) {
				$defaults['pets'] = array( array( 'type' => 'wapuu' ) );
				return $defaults;
			}
		);
		Filters\expectApplied( 'site_pets_settings' )->once()->andReturnUsing(
			static function ( $settings ) {
				$settings['ball'] = false;
				return $settings;
			}
		);

		$settings = Settings::get();

		$this->assertSame( 'wapuu', $settings['pets'][0]['type'] );
		$this->assertFalse( $settings['ball'] );
	}

	public function test_capability_filter_with_fallback(): void {
		$this->assertSame( 'manage_options', Settings::capability() );
		Filters\expectApplied( 'site_pets_capability' )->andReturn( '' );
		$this->assertSame( 'manage_options', Settings::capability() );
	}

	public function test_types_can_be_added_and_bad_ones_are_dropped(): void {
		Filters\expectApplied( 'site_pets_types' )->andReturnUsing(
			static function ( $types ) {
				$types['Hamster!'] = array(
					'label'  => 'Hamster',
					'sprite' => 'https://example.com/hamster.png',
				);
				$types['ghost']    = array( 'label' => 'No sprite' );
				unset( $types['duck'] );
				return $types;
			}
		);

		$types = Types::all();

		$this->assertArrayHasKey( 'hamster', $types );
		$this->assertArrayNotHasKey( 'ghost', $types );
		$this->assertArrayNotHasKey( 'duck', $types );
		$this->assertSame( 'https://example.com/hamster.png', Types::pet( 'hamster' )['sprite'] );
	}

	public function test_a_pet_gets_its_default_name_and_sprite(): void {
		$this->assertSame(
			array(
				'type'   => 'dog',
				'name'   => 'Biscuit',
				'sprite' => 'https://example.com/wp-content/plugins/site-pets/assets/sprites/dog.png',
			),
			Types::pet( 'dog' )
		);
		$this->assertSame( 'Rex', Types::pet( 'dog', 'Rex' )['name'] );
		$this->assertNull( Types::pet( 'dragon' ) );
	}

	public function test_config_lists_known_pets_and_is_filterable(): void {
		Filters\expectApplied( 'site_pets_config' )->once()->with( \Mockery::type( 'array' ), 'site' )->andReturnUsing(
			static function ( $config ) {
				$config['scale'] = 3;
				return $config;
			}
		);

		$config = Assets::config( 'site', array( array( 'type' => 'fox' ), array( 'type' => 'dragon' ) ) );

		$this->assertSame( array( 'fox' ), array_column( $config['pets'], 'type' ) );
		$this->assertSame( 3, $config['scale'] );
		$this->assertTrue( $config['ball'] );
	}

	public function test_admin_buddies_get_no_ball_and_always_a_hide_button(): void {
		$this->options[ Settings::OPTION ] = Settings::sanitize( array( 'enabled' => true ) );

		$config = Assets::config( 'admin', array( array( 'type' => 'fox' ) ) );

		$this->assertFalse( $config['ball'] );
		$this->assertTrue( $config['hide'] );
	}

	/**
	 * Runs Frontend::should_show() with conditional tags answering as given.
	 *
	 * @param array $settings Saved settings.
	 * @param array $tags     Conditional tag => result.
	 */
	private function shows( array $settings, array $tags = array() ): bool {
		$this->options[ Settings::OPTION ] = Settings::sanitize( $settings );
		foreach ( array( 'is_admin', 'is_feed', 'is_embed', 'is_front_page' ) as $tag ) {
			Functions\when( $tag )->justReturn( $tags[ $tag ] ?? false );
		}
		Functions\when( 'is_singular' )->alias(
			static function ( $types ) use ( $tags ) {
				return in_array( $tags['singular'] ?? '', (array) $types, true );
			}
		);

		return ( new Frontend() )->should_show();
	}

	public function test_where_rules(): void {
		$pets = array( array( 'type' => 'dog' ) );

		$this->assertTrue( $this->shows( array( 'enabled' => true, 'pets' => $pets ) ) );
		$this->assertFalse( $this->shows( array( 'enabled' => false, 'pets' => $pets ) ) );
		$this->assertFalse( $this->shows( array( 'enabled' => true, 'pets' => array() ) ), 'no pets, nothing to show' );
		$this->assertFalse( $this->shows( array( 'enabled' => true, 'pets' => $pets ), array( 'is_feed' => true ) ) );

		$front = array(
			'enabled' => true,
			'pets'    => $pets,
			'where'   => 'front',
		);
		$this->assertTrue( $this->shows( $front, array( 'is_front_page' => true ) ) );
		$this->assertFalse( $this->shows( $front ) );

		$types = array(
			'enabled'    => true,
			'pets'       => $pets,
			'where'      => 'types',
			'post_types' => array( 'post' ),
		);
		$this->assertTrue( $this->shows( $types, array( 'singular' => 'post' ) ) );
		$this->assertFalse( $this->shows( $types, array( 'singular' => 'page' ) ) );
	}

	public function test_show_filter_has_the_last_word(): void {
		Filters\expectApplied( 'site_pets_show' )->once()->andReturn( false );

		$this->assertFalse( $this->shows( array( 'enabled' => true, 'pets' => array( array( 'type' => 'dog' ) ) ) ) );
	}
}
