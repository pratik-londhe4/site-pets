<?php
/**
 * Removes everything Site Pets stored. Runs when the plugin is deleted from wp-admin.
 *
 * The settings option (on every site of a network) and every user's desk buddy.
 *
 * @package PratikLondhe\SitePets
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

if ( is_multisite() ) {
	$site_pets_page = 1;
	do {
		$site_pets_sites = get_sites(
			array(
				'fields' => 'ids',
				'number' => 100,
				'offset' => ( $site_pets_page - 1 ) * 100,
			)
		);
		foreach ( $site_pets_sites as $site_pets_site ) {
			switch_to_blog( (int) $site_pets_site );
			delete_option( 'site_pets_settings' );
			restore_current_blog();
		}
		++$site_pets_page;
		$site_pets_found = count( $site_pets_sites );
	} while ( 100 === $site_pets_found );
} else {
	delete_option( 'site_pets_settings' );
}

// User meta is shared by every site of a network.
delete_metadata( 'user', 0, 'site_pets_buddy', '', true );
