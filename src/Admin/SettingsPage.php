<?php
/**
 * Appearance > Site Pets.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets\Admin;

use PratikLondhe\SitePets\Assets;
use PratikLondhe\SitePets\Service;
use PratikLondhe\SitePets\Settings;
use PratikLondhe\SitePets\Types;
use const PratikLondhe\SitePets\PLUGIN_FILE;
use const PratikLondhe\SitePets\VERSION;

defined( 'ABSPATH' ) || exit;

/**
 * The settings screen, with a live preview of the chosen pets.
 */
final class SettingsPage implements Service {

	public const SLUG = 'site-pets';

	public const GROUP = 'site_pets';

	/**
	 * Adds the hooks.
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_init', array( $this, 'register_setting' ) );
		add_filter( 'option_page_capability_' . self::GROUP, array( Settings::class, 'capability' ) );
		add_action( 'update_option_' . Settings::OPTION, array( $this, 'saved' ), 10, 2 );
		add_action( 'add_option_' . Settings::OPTION, array( $this, 'added' ), 10, 2 );
		add_filter( 'plugin_action_links_' . plugin_basename( PLUGIN_FILE ), array( $this, 'action_links' ) );
	}

	/**
	 * Adds the screen under Appearance.
	 */
	public function menu(): void {
		$hook = add_theme_page( __( 'Site Pets', 'site-pets' ), __( 'Site Pets', 'site-pets' ), Settings::capability(), self::SLUG, array( $this, 'render' ) );
		if ( $hook ) {
			add_action( 'load-' . $hook, array( $this, 'assets' ) );
		}
	}

	/**
	 * Registers the option with its sanitizer.
	 */
	public function register_setting(): void {
		register_setting(
			self::GROUP,
			Settings::OPTION,
			array(
				'type'              => 'object',
				'sanitize_callback' => array( Settings::class, 'sanitize' ),
				'show_in_rest'      => false,
			)
		);
	}

	/**
	 * Fires the saved action when the option changes.
	 *
	 * @param mixed $old_value Previous value.
	 * @param mixed $value     New value.
	 */
	public function saved( $old_value, $value ): void {
		/**
		 * Fires after the Site Pets settings were saved.
		 *
		 * @param array $new New settings.
		 * @param array $old Previous settings.
		 */
		do_action( 'site_pets_settings_saved', Settings::sanitize( $value ), is_array( $old_value ) ? Settings::sanitize( $old_value ) : Settings::defaults() );
	}

	/**
	 * Fires the saved action the first time the option is stored.
	 *
	 * @param string $option Option name.
	 * @param mixed  $value  Value.
	 */
	public function added( $option, $value ): void {
		$this->saved( null, $value );
	}

	/**
	 * A "Settings" link on the Plugins screen.
	 *
	 * @param array $links Links.
	 * @return array
	 */
	public function action_links( $links ): array {
		$links = (array) $links;
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'themes.php?page=' . self::SLUG ) ) . '">' . esc_html__( 'Settings', 'site-pets' ) . '</a>' );

		return $links;
	}

	/**
	 * Loads the preview on this screen.
	 */
	public function assets(): void {
		add_action(
			'admin_enqueue_scripts',
			static function (): void {
				wp_enqueue_style( Assets::SCRIPT );
				wp_enqueue_script( 'site-pets-settings', plugins_url( 'assets/js/settings.js', PLUGIN_FILE ), array( Assets::SCRIPT ), VERSION, true );
				wp_add_inline_script(
					'site-pets-settings',
					'window.sitePetsSettings = ' . wp_json_encode(
						array(
							'types'   => Types::all(),
							'strings' => Assets::config( 'playground', array() )['strings'],
						)
					) . ';',
					'before' 
				);
			}
		);
	}

	/**
	 * Renders the screen.
	 */
	public function render(): void {
		if ( ! current_user_can( Settings::capability() ) ) {
			return;
		}

		$settings = Settings::get();
		$types    = Types::all();
		$name     = Settings::OPTION;
		$max      = Settings::max_pets();
		$public   = get_post_types( array( 'public' => true ), 'objects' );
		unset( $public['attachment'] );
		?>
		<div class="wrap spets-settings">
			<h1><?php esc_html_e( 'Site Pets', 'site-pets' ); ?></h1>
			<?php settings_errors(); ?>
			<p><?php esc_html_e( 'Small pixel pets that walk around your pages. Visitors can pet them, throw them a ball, or hide them.', 'site-pets' ); ?></p>

			<div class="spets-playground spets-playground--garden spets-settings__preview" id="spets-preview" role="group" aria-label="<?php esc_attr_e( 'Preview of the chosen pets', 'site-pets' ); ?>"><div class="spets-ledge"></div></div>

			<form method="post" action="options.php">
				<?php settings_fields( self::GROUP ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Pets on the site', 'site-pets' ); ?></th>
						<td>
							<label><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[enabled]" value="1" <?php checked( $settings['enabled'] ); ?>> <?php esc_html_e( 'Show pets to visitors', 'site-pets' ); ?></label>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Pets', 'site-pets' ); ?></th>
						<td>
							<fieldset id="spets-pets">
								<legend class="screen-reader-text"><?php esc_html_e( 'Pets', 'site-pets' ); ?></legend>
								<?php for ( $i = 0; $i < $max; $i++ ) : ?>
									<?php
									$pet = $settings['pets'][ $i ] ?? array(
										'type' => '',
										'name' => '',
									);
									?>
									<p class="spets-settings__pet">
										<label for="spets-pet-<?php echo (int) $i; ?>">
											<?php
											/* translators: %d: pet number, 1 to 3. */
											echo esc_html( sprintf( __( 'Pet %d', 'site-pets' ), $i + 1 ) );
											?>
										</label>
										<select id="spets-pet-<?php echo (int) $i; ?>" name="<?php echo esc_attr( $name ); ?>[pets][<?php echo (int) $i; ?>][type]">
											<option value=""><?php esc_html_e( 'None', 'site-pets' ); ?></option>
											<?php foreach ( $types as $id => $type ) : ?>
												<option value="<?php echo esc_attr( $id ); ?>" <?php selected( $pet['type'], $id ); ?>><?php echo esc_html( $type['label'] ); ?></option>
											<?php endforeach; ?>
										</select>
										<label class="screen-reader-text" for="spets-name-<?php echo (int) $i; ?>">
											<?php
											/* translators: %d: pet number, 1 to 3. */
											echo esc_html( sprintf( __( 'Name of pet %d', 'site-pets' ), $i + 1 ) );
											?>
										</label>
										<input type="text" id="spets-name-<?php echo (int) $i; ?>" maxlength="30" placeholder="<?php esc_attr_e( 'Name (optional)', 'site-pets' ); ?>" name="<?php echo esc_attr( $name ); ?>[pets][<?php echo (int) $i; ?>][name]" value="<?php echo esc_attr( $pet['name'] ); ?>">
									</p>
								<?php endfor; ?>
							</fieldset>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Where', 'site-pets' ); ?></th>
						<td>
							<fieldset>
								<legend class="screen-reader-text"><?php esc_html_e( 'Where', 'site-pets' ); ?></legend>
								<label><input type="radio" name="<?php echo esc_attr( $name ); ?>[where]" value="everywhere" <?php checked( $settings['where'], 'everywhere' ); ?>> <?php esc_html_e( 'Every page', 'site-pets' ); ?></label><br>
								<label><input type="radio" name="<?php echo esc_attr( $name ); ?>[where]" value="front" <?php checked( $settings['where'], 'front' ); ?>> <?php esc_html_e( 'The front page only', 'site-pets' ); ?></label><br>
								<label><input type="radio" name="<?php echo esc_attr( $name ); ?>[where]" value="types" <?php checked( $settings['where'], 'types' ); ?>> <?php esc_html_e( 'Only on single:', 'site-pets' ); ?></label>
								<?php foreach ( $public as $type ) : ?>
									<label class="spets-settings__type"><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[post_types][]" value="<?php echo esc_attr( $type->name ); ?>" <?php checked( in_array( $type->name, $settings['post_types'], true ) ); ?>> <?php echo esc_html( $type->labels->name ); ?></label>
								<?php endforeach; ?>
							</fieldset>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Options', 'site-pets' ); ?></th>
						<td>
							<fieldset>
								<legend class="screen-reader-text"><?php esc_html_e( 'Options', 'site-pets' ); ?></legend>
								<label><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[mobile]" value="1" <?php checked( $settings['mobile'] ); ?>> <?php esc_html_e( 'Show pets on phones', 'site-pets' ); ?></label><br>
								<label><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[ball]" value="1" <?php checked( $settings['ball'] ); ?>> <?php esc_html_e( 'Show a “Throw a ball” button', 'site-pets' ); ?></label><br>
								<label><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[hide]" value="1" <?php checked( $settings['hide'] ); ?>> <?php esc_html_e( 'Show a “Hide pets” button (visitors’ choice is kept in their browser)', 'site-pets' ); ?></label><br>
								<label><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[buddies]" value="1" <?php checked( $settings['buddies'] ); ?>> <?php esc_html_e( 'Let each user pick a desk buddy for wp-admin on their profile', 'site-pets' ); ?></label>
							</fieldset>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}
}
