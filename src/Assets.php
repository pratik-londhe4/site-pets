<?php
/**
 * Scripts, styles and the browser configuration.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the pets scripts and builds the configuration each mount gets.
 */
final class Assets implements Service {

	public const SCRIPT = 'site-pets';

	/**
	 * Adds the hooks.
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'register_assets' ), 5 );
	}

	/**
	 * Registers the engine, the pets script and the stylesheet.
	 */
	public function register_assets(): void {
		$url = plugins_url( 'assets/', PLUGIN_FILE );

		wp_register_script( 'site-pets-engine', $url . 'js/engine.js', array(), VERSION, array( 'in_footer' => true ) );
		wp_register_script( self::SCRIPT, $url . 'js/pets.js', array( 'site-pets-engine', 'wp-hooks' ), VERSION, array( 'in_footer' => true ) );
		wp_register_style( self::SCRIPT, $url . 'css/pets.css', array(), VERSION );
	}

	/**
	 * Loads pets on the current screen.
	 *
	 * @param string $mode "site" or "admin".
	 * @param array  $pets Pets: type and name each.
	 */
	public static function enqueue( string $mode, array $pets ): void {
		$config = self::config( $mode, $pets );
		if ( ! $config['pets'] ) {
			return;
		}

		wp_enqueue_style( self::SCRIPT );
		wp_enqueue_script( self::SCRIPT );
		wp_add_inline_script( self::SCRIPT, 'window.sitePetsConfig = ' . wp_json_encode( $config ) . ';', 'before' );
	}

	/**
	 * The configuration for one mount.
	 *
	 * @param string $mode "site", "admin" or "playground".
	 * @param array  $pets Pets: type and name each.
	 * @param array  $args Overrides: ball, hide, mobile, floor.
	 * @return array
	 */
	public static function config( string $mode, array $pets, array $args = array() ): array {
		$settings = Settings::get();
		$list     = array();
		foreach ( $pets as $pet ) {
			$pet  = (array) $pet;
			$item = Types::pet( (string) ( $pet['type'] ?? '' ), (string) ( $pet['name'] ?? '' ) );
			if ( null !== $item ) {
				$list[] = $item;
			}
		}

		$config = array_merge(
			array(
				'mode'    => $mode,
				'pets'    => $list,
				'scale'   => 2,
				'ball'    => 'admin' === $mode ? false : $settings['ball'],
				'hide'    => 'playground' === $mode ? false : ( 'admin' === $mode || $settings['hide'] ),
				'mobile'  => 'site' === $mode ? $settings['mobile'] : true,
				'strings' => array(
					'ball' => __( 'Throw a ball', 'site-pets' ),
					'hide' => __( 'Hide pets', 'site-pets' ),
					'show' => __( 'Show pets', 'site-pets' ),
				),
			),
			$args
		);

		/**
		 * Filters what the pets script gets for one set of pets.
		 *
		 * @param array  $config mode, pets (type, name, sprite), scale, ball, hide, mobile, strings.
		 * @param string $mode   "site", "admin" or "playground".
		 */
		return (array) apply_filters( 'site_pets_config', $config, $mode );
	}
}
