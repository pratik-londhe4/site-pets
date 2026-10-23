<?php
/**
 * The Pet Playground block.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets\Block;

use PratikLondhe\SitePets\Assets;
use PratikLondhe\SitePets\Service;
use PratikLondhe\SitePets\Settings;
use PratikLondhe\SitePets\Types;
use const PratikLondhe\SitePets\PLUGIN_FILE;
use const PratikLondhe\SitePets\VERSION;

defined( 'ABSPATH' ) || exit;

/**
 * A framed scene with pets playing in it, independent of the site-wide pets.
 */
final class Playground implements Service {

	/**
	 * Height of the scene's ground strip, in pixels (pets.css --spets-floor).
	 */
	public const FLOOR = 28;

	/**
	 * Adds the hooks.
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'register_block' ) );
	}

	/**
	 * The scenes.
	 *
	 * @return array<string, string> Scene ID => label.
	 */
	public static function scenes(): array {
		$defaults = array(
			'garden' => __( 'Garden', 'site-pets' ),
			'beach'  => __( 'Beach', 'site-pets' ),
			'night'  => __( 'Night', 'site-pets' ),
		);

		/**
		 * Filters the playground scenes. A scene's look comes from the CSS
		 * class `spets-playground--<id>`; add that to your theme for a new one.
		 *
		 * @param array $scenes Scene ID => label.
		 */
		$scenes = (array) apply_filters( 'site_pets_scenes', $defaults );
		$valid  = array();
		foreach ( $scenes as $id => $label ) {
			$id = sanitize_key( (string) $id );
			if ( '' !== $id ) {
				$valid[ $id ] = (string) $label;
			}
		}

		return $valid ? $valid : $defaults;
	}

	/**
	 * Registers the editor script and the block.
	 */
	public function register_block(): void {
		wp_register_script(
			'site-pets-playground-editor',
			plugins_url( 'assets/js/playground-editor.js', PLUGIN_FILE ),
			array( Assets::SCRIPT, 'wp-block-editor', 'wp-blocks', 'wp-components', 'wp-element', 'wp-i18n', 'wp-primitives' ),
			VERSION,
			true
		);
		wp_add_inline_script(
			'site-pets-playground-editor',
			'window.sitePetsEditor = ' . wp_json_encode(
				array(
					'types'   => Types::all(),
					'scenes'  => self::scenes(),
					'max'     => Settings::max_pets(),
					'floor'   => self::FLOOR,
					'strings' => Assets::config( 'playground', array() )['strings'],
				)
			) . ';',
			'before'
		);
		wp_set_script_translations( 'site-pets-playground-editor', 'site-pets' );

		register_block_type( dirname( PLUGIN_FILE ) . '/block', array( 'render_callback' => array( $this, 'render' ) ) );
	}

	/**
	 * Renders the block.
	 *
	 * @param array $attributes Block attributes.
	 */
	public function render( $attributes ): string {
		$attributes = (array) $attributes;
		$pets       = array_slice( (array) ( $attributes['pets'] ?? array() ), 0, Settings::max_pets() );
		$config     = Assets::config(
			'playground',
			$pets,
			array(
				'ball'  => ! empty( $attributes['ball'] ),
				'floor' => self::FLOOR,
			)
		);
		if ( ! $config['pets'] ) {
			return '';
		}

		$scenes = self::scenes();
		$scene  = isset( $scenes[ (string) ( $attributes['scene'] ?? '' ) ] ) ? (string) $attributes['scene'] : (string) array_key_first( $scenes );
		$height = max( 160, min( 800, (int) ( $attributes['height'] ?? 260 ) ) );
		$types  = Types::all();
		$names  = array_map(
			static function ( array $pet ) use ( $types ): string {
				/* translators: 1: pet name, 2: kind of pet, e.g. "Orange cat". */
				return sprintf( __( '%1$s (%2$s)', 'site-pets' ), $pet['name'], $types[ $pet['type'] ]['label'] );
			},
			$config['pets']
		);

		wp_enqueue_script( Assets::SCRIPT );

		return sprintf(
			'<div %1$s data-site-pets="%2$s" role="group" aria-label="%3$s"><div class="spets-ledge"></div></div>',
			get_block_wrapper_attributes(
				array(
					'class' => 'spets-playground spets-playground--' . $scene,
					'style' => 'height:' . $height . 'px',
				)
			),
			esc_attr( (string) wp_json_encode( $config ) ),
			/* translators: %s: list of pets, e.g. "Mango (Orange cat), Biscuit (Dog)". */
			esc_attr( sprintf( __( 'Pets playing: %s', 'site-pets' ), implode( ', ', $names ) ) )
		);
	}
}
