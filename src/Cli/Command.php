<?php
/**
 * `wp site-pets` commands.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets\Cli;

use PratikLondhe\SitePets\Admin\Buddy;
use PratikLondhe\SitePets\Settings;
use PratikLondhe\SitePets\Types;

defined( 'ABSPATH' ) || exit;

/**
 * Shows and changes the site's pets, and users' desk buddies.
 */
final class Command {

	/**
	 * Shows the pet settings.
	 *
	 * ## OPTIONS
	 *
	 * [--format=<format>]
	 * : table or json.
	 * ---
	 * default: table
	 * ---
	 *
	 * @param array $args       Positional arguments.
	 * @param array $assoc_args Named arguments.
	 */
	public function status( array $args, array $assoc_args ): void {
		$settings = Settings::get();
		if ( 'json' === ( $assoc_args['format'] ?? 'table' ) ) {
			\WP_CLI::line( (string) wp_json_encode( $settings ) );
			return;
		}

		$pets = array_map(
			static function ( array $pet ): string {
				$item = Types::pet( $pet['type'], $pet['name'] );
				return null === $item ? $pet['type'] : $item['name'] . ' (' . $pet['type'] . ')';
			},
			$settings['pets']
		);
		$rows = array(
			'Pets on' => $settings['enabled'] ? 'yes' : 'no',
			'Pets'    => implode( ', ', $pets ),
			'Where'   => $settings['where'] . ( 'types' === $settings['where'] ? ': ' . implode( ', ', $settings['post_types'] ) : '' ),
			'Phones'  => $settings['mobile'] ? 'yes' : 'no',
			'Ball'    => $settings['ball'] ? 'yes' : 'no',
			'Hide'    => $settings['hide'] ? 'yes' : 'no',
			'Buddies' => $settings['buddies'] ? 'yes' : 'no',
		);
		foreach ( $rows as $label => $value ) {
			\WP_CLI::line( str_pad( $label . ':', 10 ) . $value );
		}
	}

	/**
	 * Turns the site's pets on.
	 */
	public function enable(): void {
		Settings::update( array( 'enabled' => true ) );
		\WP_CLI::success( 'Pets are on.' );
	}

	/**
	 * Turns the site's pets off.
	 */
	public function disable(): void {
		Settings::update( array( 'enabled' => false ) );
		\WP_CLI::success( 'Pets are off.' );
	}

	/**
	 * Chooses the site's pets and where they appear.
	 *
	 * ## OPTIONS
	 *
	 * [<pet>...]
	 * : Pet types, optionally with a name: dog or dog:Biscuit. See `wp site-pets types`.
	 *
	 * [--where=<where>]
	 * : everywhere, front or types.
	 *
	 * [--post-types=<types>]
	 * : Comma-separated post types, for --where=types.
	 *
	 * [--mobile=<yes|no>]
	 * : Show pets on phones.
	 *
	 * [--ball=<yes|no>]
	 * : Show the "Throw a ball" button.
	 *
	 * [--hide=<yes|no>]
	 * : Show the "Hide pets" button.
	 *
	 * ## EXAMPLES
	 *
	 *     wp site-pets set cat-orange:Mango dog:Biscuit --where=front
	 *
	 * @param array $args       Positional arguments.
	 * @param array $assoc_args Named arguments.
	 */
	public function set( array $args, array $assoc_args ): void {
		$changes = array();
		if ( $args ) {
			$changes['pets'] = array();
			foreach ( $args as $arg ) {
				$parts = explode( ':', (string) $arg, 2 );
				if ( ! Types::exists( $parts[0] ) ) {
					\WP_CLI::error( 'Unknown pet type "' . $parts[0] . '". See: wp site-pets types' );
				}
				$changes['pets'][] = array(
					'type' => $parts[0],
					'name' => $parts[1] ?? '',
				);
			}
			if ( count( $changes['pets'] ) > Settings::max_pets() ) {
				\WP_CLI::warning( 'Only the first ' . Settings::max_pets() . ' pets are kept.' );
			}
		}
		if ( isset( $assoc_args['where'] ) ) {
			if ( ! in_array( $assoc_args['where'], Settings::WHERE, true ) ) {
				\WP_CLI::error( '--where must be everywhere, front or types.' );
			}
			$changes['where'] = $assoc_args['where'];
		}
		if ( isset( $assoc_args['post-types'] ) ) {
			$changes['post_types'] = array_filter( array_map( 'trim', explode( ',', (string) $assoc_args['post-types'] ) ) );
		}
		foreach ( array( 'mobile', 'ball', 'hide' ) as $flag ) {
			if ( isset( $assoc_args[ $flag ] ) ) {
				$changes[ $flag ] = in_array( strtolower( (string) $assoc_args[ $flag ] ), array( 'yes', '1', 'true', 'on' ), true );
			}
		}

		Settings::update( $changes );
		\WP_CLI::success( 'Saved.' );
	}

	/**
	 * Lists the pet types.
	 *
	 * ## OPTIONS
	 *
	 * [--format=<format>]
	 * : table, csv or json.
	 * ---
	 * default: table
	 * ---
	 *
	 * @param array $args       Positional arguments.
	 * @param array $assoc_args Named arguments.
	 */
	public function types( array $args, array $assoc_args ): void {
		$rows = array();
		foreach ( Types::all() as $id => $type ) {
			$rows[] = array(
				'type'  => $id,
				'label' => $type['label'],
				'name'  => $type['name'],
			);
		}

		\WP_CLI\Utils\format_items( $assoc_args['format'] ?? 'table', $rows, array( 'type', 'label', 'name' ) );
	}

	/**
	 * Sets or removes a user's desk buddy in wp-admin.
	 *
	 * ## OPTIONS
	 *
	 * <user>
	 * : User ID, login or email.
	 *
	 * <pet>
	 * : A pet type, or "none".
	 *
	 * [--name=<name>]
	 * : The buddy's name.
	 *
	 * @param array $args       Positional arguments.
	 * @param array $assoc_args Named arguments.
	 */
	public function buddy( array $args, array $assoc_args ): void {
		$user = get_user_by( is_numeric( $args[0] ) ? 'id' : ( is_email( $args[0] ) ? 'email' : 'login' ), $args[0] );
		if ( ! $user ) {
			\WP_CLI::error( 'No such user: ' . $args[0] );
		}
		if ( 'none' !== $args[1] && ! Types::exists( $args[1] ) ) {
			\WP_CLI::error( 'Unknown pet type "' . $args[1] . '". See: wp site-pets types' );
		}

		$buddy = Buddy::set( (int) $user->ID, 'none' === $args[1] ? '' : $args[1], (string) ( $assoc_args['name'] ?? '' ) );
		\WP_CLI::success( null === $buddy ? 'Desk buddy removed.' : 'Desk buddy set.' );
	}
}
