<?php
/**
 * Plugin bootstrap.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets;

defined( 'ABSPATH' ) || exit;

/**
 * Creates the services once and registers their hooks.
 */
final class Plugin {

	/**
	 * The running instance.
	 *
	 * @var Plugin|null
	 */
	private static ?Plugin $instance = null;

	/**
	 * Starts the plugin. Runs on `plugins_loaded`.
	 */
	public static function boot(): void {
		if ( null === self::$instance ) {
			self::$instance = new self();
			self::$instance->register();
		}
	}

	/**
	 * The running instance, for other plugins.
	 *
	 * @return Plugin|null
	 */
	public static function instance(): ?Plugin {
		return self::$instance;
	}

	/**
	 * The plugin's services: one per concern (settings screen, abilities, WP-CLI, ...).
	 *
	 * @return Service[]
	 */
	private function services(): array {
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			\WP_CLI::add_command( 'site-pets', new Cli\Command() );
		}

		return array(
			new Assets(),
			new Frontend(),
			new Admin\SettingsPage(),
			new Admin\Buddy(),
			new Block\Playground(),
			new Abilities(),
			new Privacy(),
		);
	}

	/**
	 * Registers every service.
	 */
	private function register(): void {
		foreach ( $this->services() as $service ) {
			$service->register();
		}
	}
}
