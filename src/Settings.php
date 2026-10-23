<?php
/**
 * Saved settings.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets;

defined( 'ABSPATH' ) || exit;

/**
 * The site's pet settings, stored in one option.
 */
final class Settings {

	public const OPTION = 'site_pets_settings';

	public const WHERE = array( 'everywhere', 'front', 'types' );

	/**
	 * The defaults: one orange cat on every page, with the ball and hide buttons.
	 *
	 * @return array
	 */
	public static function defaults(): array {
		$defaults = array(
			'enabled'    => true,
			'pets'       => array(
				array(
					'type' => 'cat-orange',
					'name' => '',
				),
			),
			'where'      => 'everywhere',
			'post_types' => array(),
			'mobile'     => true,
			'ball'       => true,
			'hide'       => true,
			'buddies'    => true,
		);

		/**
		 * Filters the default settings, used until the settings are first saved.
		 *
		 * @param array $defaults Settings.
		 */
		return self::sanitize( (array) apply_filters( 'site_pets_defaults', $defaults ) );
	}

	/**
	 * The current settings.
	 *
	 * @return array
	 */
	public static function get(): array {
		$saved    = get_option( self::OPTION, null );
		$settings = is_array( $saved ) ? self::sanitize( $saved ) : self::defaults();

		/**
		 * Filters the settings as they are used, without saving the change.
		 *
		 * @param array $settings Settings.
		 */
		return self::sanitize( (array) apply_filters( 'site_pets_settings', $settings ) );
	}

	/**
	 * Saves some settings, keeping the rest.
	 *
	 * @param array $changes Settings to change.
	 * @return array The saved settings.
	 */
	public static function update( array $changes ): array {
		$settings = self::sanitize( array_merge( self::get(), $changes ) );
		update_option( self::OPTION, $settings );

		return $settings;
	}

	/**
	 * How many pets can be out at once.
	 */
	public static function max_pets(): int {
		/**
		 * Filters how many pets the site can have out at once. Default 3, at most 10.
		 *
		 * @param int $max Number of pets.
		 */
		$max = (int) apply_filters( 'site_pets_max_pets', 3 );

		return max( 1, min( 10, $max ) );
	}

	/**
	 * Cleans settings from a form, the REST API, WP-CLI or a filter.
	 *
	 * Booleans are true only when present and truthy, so an unticked box in
	 * the settings form turns an option off.
	 *
	 * @param array $input Settings.
	 * @return array
	 */
	public static function sanitize( $input ): array {
		$input = (array) $input;
		$pets  = array();
		foreach ( (array) ( $input['pets'] ?? array() ) as $pet ) {
			$pet  = (array) $pet;
			$type = sanitize_key( (string) ( $pet['type'] ?? '' ) );
			if ( ! Types::exists( $type ) ) {
				continue;
			}
			$pets[] = array(
				'type' => $type,
				'name' => mb_substr( sanitize_text_field( (string) ( $pet['name'] ?? '' ) ), 0, 30 ),
			);
		}

		$where      = (string) ( $input['where'] ?? 'everywhere' );
		$public     = get_post_types( array( 'public' => true ) );
		$post_types = array_values( array_intersect( array_map( 'sanitize_key', array_map( 'strval', (array) ( $input['post_types'] ?? array() ) ) ), $public ) );

		return array(
			'enabled'    => ! empty( $input['enabled'] ),
			'pets'       => array_slice( $pets, 0, self::max_pets() ),
			'where'      => in_array( $where, self::WHERE, true ) ? $where : 'everywhere',
			'post_types' => $post_types,
			'mobile'     => ! empty( $input['mobile'] ),
			'ball'       => ! empty( $input['ball'] ),
			'hide'       => ! empty( $input['hide'] ),
			'buddies'    => ! empty( $input['buddies'] ),
		);
	}

	/**
	 * The capability needed to change the settings.
	 */
	public static function capability(): string {
		/**
		 * Filters the capability needed to change Site Pets settings. Default `manage_options`.
		 *
		 * @param string $capability Capability.
		 */
		$capability = (string) apply_filters( 'site_pets_capability', 'manage_options' );

		return '' !== $capability ? $capability : 'manage_options';
	}
}
