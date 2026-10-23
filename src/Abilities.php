<?php
/**
 * Abilities: the site's pets for AI agents and other Abilities API clients.
 *
 * @package PratikLondhe\SitePets
 */

namespace PratikLondhe\SitePets;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the plugin's abilities on WordPress 6.9 and later.
 */
final class Abilities implements Service {

	public const CATEGORY = 'site-pets';

	/**
	 * Hooks into the Abilities API when WordPress has it.
	 */
	public function register(): void {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}

		add_action( 'wp_abilities_api_categories_init', array( $this, 'register_category' ) );
		add_action( 'wp_abilities_api_init', array( $this, 'register_abilities' ) );
	}

	/**
	 * Registers the category.
	 */
	public function register_category(): void {
		if ( ! function_exists( 'wp_register_ability_category' ) ) {
			return;
		}

		wp_register_ability_category(
			self::CATEGORY,
			array(
				'label'       => __( 'Site Pets', 'site-pets' ),
				'description' => __( 'The pixel pets that walk around the site: which pets, where, and the buttons visitors get.', 'site-pets' ),
			)
		);
	}

	/**
	 * Registers the abilities.
	 */
	public function register_abilities(): void {
		$can_manage = static function (): bool {
			return current_user_can( Settings::capability() );
		};
		$type_ids   = array_keys( Types::all() );
		$pets       = array(
			'type'     => 'array',
			'maxItems' => Settings::max_pets(),
			'items'    => array(
				'type'       => 'object',
				'properties' => array(
					'type' => array(
						'type' => 'string',
						'enum' => $type_ids,
					),
					'name' => array(
						'type'      => 'string',
						'maxLength' => 30,
					),
				),
				'required'   => array( 'type' ),
			),
		);
		$settings   = array(
			'type'       => 'object',
			'properties' => array(
				'enabled'    => array( 'type' => 'boolean' ),
				'pets'       => $pets,
				'where'      => array(
					'type' => 'string',
					'enum' => Settings::WHERE,
				),
				'post_types' => array(
					'type'  => 'array',
					'items' => array( 'type' => 'string' ),
				),
				'mobile'     => array( 'type' => 'boolean' ),
				'ball'       => array( 'type' => 'boolean' ),
				'hide'       => array( 'type' => 'boolean' ),
				'buddies'    => array( 'type' => 'boolean' ),
			),
		);

		$this->ability(
			'get-settings',
			__( 'Get pet settings', 'site-pets' ),
			__( 'Whether pets are on, which pets (type and name), on which pages, and which buttons visitors see.', 'site-pets' ),
			null,
			$settings,
			array( Settings::class, 'get' ),
			$can_manage,
			array(
				'readonly'   => true,
				'idempotent' => true,
			)
		);

		$update                         = $settings;
		$update['additionalProperties'] = false;
		$this->ability(
			'update-settings',
			__( 'Change pet settings', 'site-pets' ),
			__( 'Changes some pet settings and keeps the rest. For example { "pets": [ { "type": "dog", "name": "Biscuit" } ] } or { "enabled": false }.', 'site-pets' ),
			$update,
			$settings,
			array( $this, 'update_settings' ),
			$can_manage,
			array(
				'readonly'    => false,
				'destructive' => false,
				'idempotent'  => true,
			)
		);

		$this->ability(
			'list-pet-types',
			__( 'List pet types', 'site-pets' ),
			__( 'The kinds of pet available, with their default names.', 'site-pets' ),
			null,
			array(
				'type'  => 'array',
				'items' => array(
					'type'       => 'object',
					'properties' => array(
						'type'  => array( 'type' => 'string' ),
						'label' => array( 'type' => 'string' ),
						'name'  => array( 'type' => 'string' ),
					),
				),
			),
			array( $this, 'list_types' ),
			static function (): bool {
				return current_user_can( 'read' );
			},
			array(
				'readonly'   => true,
				'idempotent' => true,
			)
		);
	}

	/**
	 * Ability: change settings.
	 *
	 * @param array|null $input Ability input.
	 * @return array
	 */
	public function update_settings( $input = null ): array {
		return Settings::update( (array) $input );
	}

	/**
	 * Ability: pet types.
	 *
	 * @return array[]
	 */
	public function list_types(): array {
		$list = array();
		foreach ( Types::all() as $id => $type ) {
			$list[] = array(
				'type'  => $id,
				'label' => $type['label'],
				'name'  => $type['name'],
			);
		}

		return $list;
	}

	/**
	 * Registers one ability in the plugin's category.
	 *
	 * @param string     $name        Name without the namespace.
	 * @param string     $label       Label.
	 * @param string     $description What it does.
	 * @param array|null $input       Input schema, or null for none.
	 * @param array      $output      Output schema.
	 * @param callable   $execute     Execute callback.
	 * @param callable   $permission  Permission callback.
	 * @param array      $annotations readonly, destructive, idempotent.
	 */
	private function ability( string $name, string $label, string $description, ?array $input, array $output, callable $execute, callable $permission, array $annotations ): void {
		$args = array(
			'label'               => $label,
			'description'         => $description,
			'category'            => self::CATEGORY,
			'output_schema'       => $output,
			'execute_callback'    => $execute,
			'permission_callback' => $permission,
			'meta'                => array(
				'annotations'  => $annotations,
				'show_in_rest' => true,
				// Clients such as the MCP adapter only list abilities marked public:
				// `public` from WordPress 7.1, `mcp.public` for the adapter on 6.9 and 7.0.
				'public'       => true,
				'mcp'          => array( 'public' => true ),
			),
		);
		if ( null !== $input ) {
			$args['input_schema'] = $input;
		}

		wp_register_ability( self::CATEGORY . '/' . $name, $args );
	}
}
