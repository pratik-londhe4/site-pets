<?php
/**
 * A desk buddy in wp-admin.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets\Admin;

use PratikLondhe\SitePets\Assets;
use PratikLondhe\SitePets\Service;
use PratikLondhe\SitePets\Settings;
use PratikLondhe\SitePets\Types;

defined( 'ABSPATH' ) || exit;

/**
 * Lets each user pick a pet that keeps them company in wp-admin.
 */
final class Buddy implements Service {

	public const META = 'site_pets_buddy';

	/**
	 * Adds the hooks.
	 */
	public function register(): void {
		add_action( 'show_user_profile', array( $this, 'fields' ) );
		add_action( 'edit_user_profile', array( $this, 'fields' ) );
		add_action( 'personal_options_update', array( $this, 'save_profile' ) );
		add_action( 'edit_user_profile_update', array( $this, 'save_profile' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	/**
	 * Whether desk buddies are on for this site.
	 */
	public static function enabled(): bool {
		/**
		 * Filters whether users can have a desk buddy in wp-admin.
		 *
		 * @param bool $enabled Default: the "Desk buddies" setting.
		 */
		return (bool) apply_filters( 'site_pets_buddy_enabled', Settings::get()['buddies'] );
	}

	/**
	 * A user's buddy.
	 *
	 * @param int $user_id User ID.
	 * @return array{type: string, name: string}|null
	 */
	public static function get( int $user_id ): ?array {
		$buddy = get_user_meta( $user_id, self::META, true );
		if ( ! is_array( $buddy ) || ! Types::exists( (string) ( $buddy['type'] ?? '' ) ) ) {
			return null;
		}

		return array(
			'type' => (string) $buddy['type'],
			'name' => (string) ( $buddy['name'] ?? '' ),
		);
	}

	/**
	 * Sets or removes a user's buddy.
	 *
	 * @param int    $user_id User ID.
	 * @param string $type    Pet type, or empty for none.
	 * @param string $name    Name, or empty for the type's default.
	 * @return array{type: string, name: string}|null The buddy.
	 */
	public static function set( int $user_id, string $type, string $name = '' ): ?array {
		$type  = sanitize_key( $type );
		$buddy = null;
		if ( Types::exists( $type ) ) {
			$buddy = array(
				'type' => $type,
				'name' => mb_substr( sanitize_text_field( $name ), 0, 30 ),
			);
			update_user_meta( $user_id, self::META, $buddy );
		} else {
			delete_user_meta( $user_id, self::META );
		}

		/**
		 * Fires after a user's desk buddy was set or removed.
		 *
		 * @param int        $user_id User ID.
		 * @param array|null $buddy   type and name, or null when removed.
		 */
		do_action( 'site_pets_buddy_saved', $user_id, $buddy );

		return $buddy;
	}

	/**
	 * The "Desk buddy" fields on the profile screen.
	 *
	 * @param \WP_User $user User being edited.
	 */
	public function fields( $user ): void {
		if ( ! self::enabled() ) {
			return;
		}
		$buddy = self::get( (int) $user->ID );
		?>
		<h2 id="site-pets-buddy"><?php esc_html_e( 'Desk buddy', 'site-pets' ); ?></h2>
		<p><?php esc_html_e( 'A small pet that walks along the bottom of the admin screens while you work. Only you see it.', 'site-pets' ); ?></p>
		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><label for="site-pets-buddy-type"><?php esc_html_e( 'Pet', 'site-pets' ); ?></label></th>
				<td>
					<select name="site_pets_buddy[type]" id="site-pets-buddy-type">
						<option value=""><?php esc_html_e( 'No desk buddy', 'site-pets' ); ?></option>
						<?php foreach ( Types::all() as $id => $type ) : ?>
							<option value="<?php echo esc_attr( $id ); ?>" <?php selected( null !== $buddy && $buddy['type'] === $id ); ?>><?php echo esc_html( $type['label'] ); ?></option>
						<?php endforeach; ?>
					</select>
				</td>
			</tr>
			<tr>
				<th scope="row"><label for="site-pets-buddy-name"><?php esc_html_e( 'Name', 'site-pets' ); ?></label></th>
				<td>
					<input type="text" class="regular-text" maxlength="30" name="site_pets_buddy[name]" id="site-pets-buddy-name" value="<?php echo esc_attr( null !== $buddy ? $buddy['name'] : '' ); ?>" aria-describedby="site-pets-buddy-name-description">
					<p class="description" id="site-pets-buddy-name-description"><?php esc_html_e( 'Leave empty for the pet’s own name.', 'site-pets' ); ?></p>
				</td>
			</tr>
		</table>
		<?php
		wp_nonce_field( 'site_pets_buddy_' . $user->ID, 'site_pets_buddy_nonce' );
	}

	/**
	 * Saves the profile fields.
	 *
	 * @param int $user_id User being saved.
	 */
	public function save_profile( $user_id ): void {
		$user_id = (int) $user_id;
		$nonce   = isset( $_POST['site_pets_buddy_nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['site_pets_buddy_nonce'] ) ) : '';
		if ( ! self::enabled() || ! current_user_can( 'edit_user', $user_id ) || ! wp_verify_nonce( $nonce, 'site_pets_buddy_' . $user_id ) ) {
			return;
		}

		$input = isset( $_POST['site_pets_buddy'] ) && is_array( $_POST['site_pets_buddy'] ) ? map_deep( wp_unslash( $_POST['site_pets_buddy'] ), 'sanitize_text_field' ) : array();
		self::set( $user_id, (string) ( $input['type'] ?? '' ), (string) ( $input['name'] ?? '' ) );
	}

	/**
	 * Loads the current user's buddy on admin screens.
	 */
	public function enqueue(): void {
		$buddy = self::enabled() ? self::get( get_current_user_id() ) : null;
		if ( null !== $buddy ) {
			Assets::enqueue( 'admin', array( $buddy ) );
		}
	}
}
