<?php
/**
 * The kinds of pet.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets;

defined( 'ABSPATH' ) || exit;

/**
 * The pet registry: each type has a label, a default name and a sprite sheet.
 */
final class Types {

	/**
	 * Every pet type, keyed by its ID.
	 *
	 * @return array<string, array{label: string, name: string, sprite: string}>
	 */
	public static function all(): array {
		$url      = plugins_url( 'assets/sprites/', PLUGIN_FILE );
		$defaults = array(
			'cat-orange' => array(
				'label'  => __( 'Orange cat', 'site-pets' ),
				'name'   => __( 'Mango', 'site-pets' ),
				'sprite' => $url . 'cat-orange.png',
			),
			'cat-grey'   => array(
				'label'  => __( 'Grey cat', 'site-pets' ),
				'name'   => __( 'Smokey', 'site-pets' ),
				'sprite' => $url . 'cat-grey.png',
			),
			'cat-black'  => array(
				'label'  => __( 'Black cat', 'site-pets' ),
				'name'   => __( 'Shadow', 'site-pets' ),
				'sprite' => $url . 'cat-black.png',
			),
			'dog'        => array(
				'label'  => __( 'Dog', 'site-pets' ),
				'name'   => __( 'Biscuit', 'site-pets' ),
				'sprite' => $url . 'dog.png',
			),
			'fox'        => array(
				'label'  => __( 'Fox', 'site-pets' ),
				'name'   => __( 'Rusty', 'site-pets' ),
				'sprite' => $url . 'fox.png',
			),
			'duck'       => array(
				'label'  => __( 'Rubber duck', 'site-pets' ),
				'name'   => __( 'Quackers', 'site-pets' ),
				'sprite' => $url . 'duck.png',
			),
			'wapuu'      => array(
				'label'  => __( 'Wapuu', 'site-pets' ),
				'name'   => __( 'Wapuu', 'site-pets' ),
				'sprite' => $url . 'wapuu.png',
			),
		);

		/**
		 * Filters the pet types. Add your own pet with a sprite sheet laid out
		 * like the plugin's (one row of sixteen 32×32 frames: idle ×2, walk ×4,
		 * run ×4, sit ×2, sleep ×2, jump, fall), or remove a type.
		 *
		 * @param array $types Types keyed by ID: label, name (default name), sprite (URL).
		 */
		$types = (array) apply_filters( 'site_pets_types', $defaults );
		$valid = array();
		foreach ( $types as $id => $type ) {
			$id = sanitize_key( (string) $id );
			if ( '' === $id || ! is_array( $type ) || empty( $type['sprite'] ) ) {
				continue;
			}
			$valid[ $id ] = array(
				'label'  => (string) ( $type['label'] ?? $id ),
				'name'   => (string) ( $type['name'] ?? '' ),
				'sprite' => esc_url_raw( (string) $type['sprite'] ),
			);
		}

		return $valid;
	}

	/**
	 * Whether a type exists.
	 *
	 * @param string $type Type ID.
	 */
	public static function exists( string $type ): bool {
		return isset( self::all()[ $type ] );
	}

	/**
	 * A pet ready for the browser: type, name and sprite.
	 *
	 * @param string $type Type ID.
	 * @param string $name Name, or empty for the type's default name.
	 * @return array{type: string, name: string, sprite: string}|null
	 */
	public static function pet( string $type, string $name = '' ): ?array {
		$types = self::all();
		if ( ! isset( $types[ $type ] ) ) {
			return null;
		}

		return array(
			'type'   => $type,
			'name'   => '' === $name ? $types[ $type ]['name'] : $name,
			'sprite' => $types[ $type ]['sprite'],
		);
	}
}
