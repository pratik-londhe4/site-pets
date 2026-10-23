<?php
/**
 * Pets on the site's pages.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets;

defined( 'ABSPATH' ) || exit;

/**
 * Loads the pets on the pages the settings choose.
 */
final class Frontend implements Service {

	/**
	 * Adds the hooks.
	 */
	public function register(): void {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	/**
	 * Loads the pets when this page should have them.
	 */
	public function enqueue(): void {
		if ( $this->should_show() ) {
			Assets::enqueue( 'site', Settings::get()['pets'] );
		}
	}

	/**
	 * Whether this request shows pets.
	 */
	public function should_show(): bool {
		$settings = Settings::get();
		$show     = $settings['enabled'] && $settings['pets'] && ! is_admin() && ! is_feed() && ! is_embed();

		if ( $show && 'front' === $settings['where'] ) {
			$show = is_front_page();
		} elseif ( $show && 'types' === $settings['where'] ) {
			$show = $settings['post_types'] && is_singular( $settings['post_types'] );
		}

		/**
		 * Filters whether this page shows the site's pets.
		 *
		 * @param bool  $show     Whether to show them.
		 * @param array $settings Settings.
		 */
		return (bool) apply_filters( 'site_pets_show', $show, $settings );
	}
}
