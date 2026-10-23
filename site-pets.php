<?php
/**
 * Plugin Name:       Site Pets
 * Plugin URI:        https://wordpress.org/plugins/site-pets/
 * Description:       Little pixel pets that walk around your pages, keep you company in wp-admin, and play in a block.
 * Version:           1.0.0
 * Requires at least: 6.6
 * Requires PHP:      7.4
 * Author:            Pratik Londhe
 * Author URI:        https://profiles.wordpress.org/pratiklondhe/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       site-pets
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets;

defined( 'ABSPATH' ) || exit;

const VERSION     = '1.0.0';
const PLUGIN_FILE = __FILE__;

// PSR-4: PratikLondhe\SitePets\Foo\Bar lives in src/Foo/Bar.php.
spl_autoload_register(
	static function ( $class_name ) {
		$prefix = __NAMESPACE__ . '\\';
		if ( 0 !== strpos( $class_name, $prefix ) ) {
			return;
		}

		$file = __DIR__ . '/src/' . str_replace( '\\', '/', substr( $class_name, strlen( $prefix ) ) ) . '.php';
		if ( is_readable( $file ) ) {
			require $file;
		}
	}
);

add_action( 'plugins_loaded', array( Plugin::class, 'boot' ) );
