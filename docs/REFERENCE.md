# Reference

## How the pets move

`assets/js/engine.js` decides what each pet does. It has no DOM and is unit tested in Node (`tests/js/engine.test.js`).

- **World**: the browser window for site pets and desk buddies, the block for a playground. A pet's `x` is the middle of its feet, `y` the line it stands on.
- **Platforms**: the top edges of on-screen elements matching the platform selector (headings, images, figures, buttons, separators, quotes, preformatted text, tables, covers, coloured groups), at least 80 px wide and at least 70 px below the top of the window, plus the ground (the bottom of the window). Edges on the same line that touch are merged. They are read again on scroll, on resize and twice a second, so a pet stays on its heading as you scroll, and falls when the heading leaves the screen.
- **States**: idle, walk, run, sit, sleep, jump, fall. Idle leads to walk (50%), run (15%), sit (20%) or a jump to a platform within reach (15%; 220 px across, 260 px up). Sit leads to sleep (35%) or idle. Sleep leads to idle.
- **The ball**: falls with gravity, bounces off the sides and lands on a platform. Pets on that platform run to it; pets elsewhere jump towards it. The first to reach it catches it, sits and is happy for two seconds.
- **Reduced motion**: when the visitor's system asks for reduced motion, pets sit on the ground and only react to clicks.

## Sprite sheets

One PNG per pet in `assets/sprites/`: one row of sixteen 32×32 frames, facing right, drawn at 2× in the browser with `image-rendering: pixelated`.

| Frames | Animation |
| --- | --- |
| 0–1 | idle (1 is a blink) |
| 2–5 | walk |
| 6–9 | run |
| 10–11 | sit (11 is a blink) |
| 12–13 | sleep |
| 14 | jump |
| 15 | fall |

`tools/sprites/generate.py` draws every sheet from shapes (ellipses, polygons, thick lines), then adds the outline and highlights, so all pets share one style. Run `python3 tools/sprites/generate.py --preview preview.png` after changing it.

## Hooks

PHP filters:

| Hook | Arguments | Use |
| --- | --- | --- |
| `site_pets_types` | `( array $types )` | Pet types keyed by ID: `label`, `name` (default name), `sprite` (URL). Add your own or remove one |
| `site_pets_defaults` | `( array $settings )` | Settings used until the settings are first saved. Default: one orange cat on every page |
| `site_pets_settings` | `( array $settings )` | The settings as used, without saving |
| `site_pets_max_pets` | `( int $max )` | Pets out at once. Default 3, at most 10 |
| `site_pets_show` | `( bool $show, array $settings )` | Whether this request shows the site's pets |
| `site_pets_config` | `( array $config, string $mode )` | What the pets script gets (`mode` is `site`, `admin` or `playground`): `pets`, `scale`, `ball`, `hide`, `mobile`, `strings` |
| `site_pets_capability` | `( string $capability )` | Who can change the settings. Default `manage_options` |
| `site_pets_buddy_enabled` | `( bool $enabled )` | Whether users can have a desk buddy. Default: the "desk buddy" setting |
| `site_pets_scenes` | `( array $scenes )` | Playground scenes, ID => label. Style a new one with `.spets-playground--<id>` |

PHP actions:

| Hook | Arguments | When |
| --- | --- | --- |
| `site_pets_settings_saved` | `( array $new, array $old )` | The settings were saved |
| `site_pets_buddy_saved` | `( int $user_id, array\|null $buddy )` | A user's desk buddy was set or removed |

```php
// A hamster, drawn in the same layout as the plugin's sheets.
add_filter( 'site_pets_types', function ( $types ) {
	$types['hamster'] = array(
		'label'  => 'Hamster',
		'name'   => 'Peanut',
		'sprite' => get_stylesheet_directory_uri() . '/pets/hamster.png',
	);
	return $types;
} );

// No pets on the checkout.
add_filter( 'site_pets_show', fn( $show ) => $show && ! ( function_exists( 'is_checkout' ) && is_checkout() ) );
```

JavaScript, through `wp.hooks` (loaded with the pets):

| Hook | Type | Use |
| --- | --- | --- |
| `sitePets.config` | filter | `( Object config, Document\|Element host )`. The settings of one set of pets before they start |
| `sitePets.platformSelector` | filter | `( string selector )`. Elements whose top edges pets walk on |
| `sitePets.nextState` | filter | `( string state, Object pet )`. What a pet does next: `idle`, `walk`, `run`, `sit`, `sleep` or `jump` |
| `sitePets.ready` | action | `( Object instance )`. Pets started. `instance.pets`, `instance.throwBall()`, `instance.setHidden( bool )`, `instance.destroy()` |
| `sitePets.petted` | action | `( Object pet )`. Someone clicked a pet |
| `sitePets.ballThrown` | action | `( Object ball )` |
| `sitePets.hidden` | action | `( boolean hidden )` |

```js
// Pets nap more on Sundays, and only walk on headings.
wp.hooks.addFilter( 'sitePets.nextState', 'my-theme', ( state ) => ( new Date().getDay() === 0 && state === 'run' ? 'sleep' : state ) );
wp.hooks.addFilter( 'sitePets.platformSelector', 'my-theme', () => 'h1, h2, h3' );
```

Add these from a script that depends on `wp-hooks` and loads before `site-pets` (the pets start on `DOMContentLoaded`).

`window.sitePets.mount( element, config )` puts pets in any element; `window.sitePets.engine` is the engine.

## Block

`site-pets/playground`, dynamic.

| Attribute | Default | Notes |
| --- | --- | --- |
| `pets` | orange cat and dog | up to `site_pets_max_pets`, each `{ type, name }` |
| `scene` | `garden` | `garden`, `beach`, `night`, or one added with `site_pets_scenes` |
| `height` | `260` | 160 to 800 px |
| `ball` | `true` | the "Throw a ball" button |

## Settings

One option, `site_pets_settings`:

| Key | Default | |
| --- | --- | --- |
| `enabled` | `true` | pets on the site |
| `pets` | `[ { type: "cat-orange", name: "" } ]` | empty name = the type's default name |
| `where` | `everywhere` | `everywhere`, `front` or `types` |
| `post_types` | `[]` | for `types` |
| `mobile` | `true` | show on screens 600 px wide or less |
| `ball` | `true` | "Throw a ball" button |
| `hide` | `true` | "Hide pets" button |
| `buddies` | `true` | desk buddies in wp-admin |

A user's desk buddy is the user meta `site_pets_buddy`: `{ type, name }`.

## WP-CLI

```sh
wp site-pets status [--format=json]
wp site-pets enable
wp site-pets disable
wp site-pets set cat-orange:Mango dog:Biscuit [--where=everywhere|front|types] [--post-types=post,page] [--mobile=yes|no] [--ball=yes|no] [--hide=yes|no]
wp site-pets types [--format=table|csv|json]
wp site-pets buddy <user> <type|none> [--name=<name>]
```

## Abilities

On WordPress 6.9 and later, in the `site-pets` category, shown in REST under `/wp-abilities/v1/` and marked public for the MCP adapter:

| Ability | Annotations | Input |
| --- | --- | --- |
| `site-pets/get-settings` | readonly | none |
| `site-pets/update-settings` | idempotent | any of the settings keys; the rest are kept |
| `site-pets/list-pet-types` | readonly | none |

## Data, privacy and uninstall

The plugin stores the option above and each user's buddy meta. Visitors' "hide" choice lives in their browser's local storage (`sitePets.hidden.site`; `sitePets.hidden.admin` for the desk buddy) and is never sent to the site. A suggested privacy-policy paragraph says so. Deleting the plugin removes the option (on every site of a network) and every user's buddy.
