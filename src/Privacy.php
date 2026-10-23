<?php
/**
 * Privacy policy text.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets;

defined( 'ABSPATH' ) || exit;

/**
 * Suggests text for the site's privacy policy.
 */
final class Privacy implements Service {

	/**
	 * Adds the hooks.
	 */
	public function register(): void {
		add_action( 'admin_init', array( $this, 'policy' ) );
	}

	/**
	 * Adds the suggested policy text.
	 */
	public function policy(): void {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}

		wp_add_privacy_policy_content(
			__( 'Site Pets', 'site-pets' ),
			'<p>' . esc_html__( 'The pets on this site do not collect personal data and send nothing to other services. If you hide the pets, that choice is stored in your own browser (local storage) so they stay hidden, and it is never sent to this site.', 'site-pets' ) . '</p>'
		);
	}
}
