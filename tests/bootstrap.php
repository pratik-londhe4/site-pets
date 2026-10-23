<?php
/**
 * PHPUnit bootstrap: the Composer autoloader plus the WordPress constants and
 * classes the plugin touches. WordPress functions are mocked per test with
 * Brain Monkey, so WordPress itself is not loaded.
 *
 * @package PratikLondhe\SitePets
 */

require dirname( __DIR__ ) . '/vendor/autoload.php';
require __DIR__ . '/Stubs/wordpress.php';

defined( 'ABSPATH' ) || define( 'ABSPATH', __DIR__ . '/' );

// The plugin's constants, normally defined by site-pets.php.
defined( 'PratikLondhe\SitePets\PLUGIN_FILE' ) || define( 'PratikLondhe\SitePets\PLUGIN_FILE', dirname( __DIR__ ) . '/site-pets.php' );
defined( 'PratikLondhe\SitePets\VERSION' ) || define( 'PratikLondhe\SitePets\VERSION', '1.0.0' );
