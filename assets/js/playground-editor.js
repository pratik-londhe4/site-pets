/**
 * The Pet Playground block in the editor: the real pets, playing in the canvas.
 */
( function ( wp, data ) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var useRef = wp.element.useRef;
	var useEffect = wp.element.useEffect;
	var __ = wp.i18n.__;
	var sprintf = wp.i18n.sprintf;
	var be = wp.blockEditor;
	var c = wp.components;
	var types = data.types || {};
	var scenes = data.scenes || {};
	var max = data.max || 3;

	var icon = el(
		wp.primitives ? wp.primitives.SVG : 'svg',
		{ xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24' },
		el( wp.primitives ? wp.primitives.Path : 'path', {
			d: 'M8.5 5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Zm7 0a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6ZM4.8 9.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Zm14.4 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2ZM12 11c2.6 0 5.2 3 5.2 5.4 0 1.8-1.4 2.6-2.8 2.6-1 0-1.6-.5-2.4-.5s-1.4.5-2.4.5c-1.4 0-2.8-.8-2.8-2.6C6.8 14 9.4 11 12 11Z',
		} )
	);

	function petsFor( list ) {
		return ( list || [] )
			.filter( function ( p ) {
				return types[ p.type ];
			} )
			.map( function ( p ) {
				return { type: p.type, name: p.name || types[ p.type ].name, sprite: types[ p.type ].sprite };
			} );
	}

	function Preview( props ) {
		var ref = useRef( null );
		var a = props.attributes;
		var key = JSON.stringify( [ a.pets, a.ball, a.scene, a.height ] );

		useEffect(
			function () {
				var node = ref.current;
				if ( ! node || ! window.sitePets ) {
					return;
				}
				var instance = window.sitePets.mount( node, {
					mode: 'playground',
					pets: petsFor( a.pets ),
					scale: 2,
					ball: a.ball,
					floor: data.floor || 28,
					strings: data.strings || {},
				} );
				return function () {
					if ( instance ) {
						instance.destroy();
					}
				};
			},
			[ key ]
		);

		return el( 'div', { ref: ref, className: 'spets-playground spets-playground--' + a.scene, style: { height: a.height + 'px' } }, el( 'div', { className: 'spets-ledge' } ) );
	}

	function Edit( props ) {
		var a = props.attributes;
		var set = props.setAttributes;
		var blockProps = be.useBlockProps();
		var options = Object.keys( types ).map( function ( id ) {
			return { value: id, label: types[ id ].label };
		} );

		function change( index, field, value ) {
			var pets = a.pets.map( function ( p ) {
				return Object.assign( {}, p );
			} );
			pets[ index ][ field ] = value;
			set( { pets: pets } );
		}

		var rows = a.pets.map( function ( pet, i ) {
			return el(
				'div',
				{ key: i, className: 'spets-editor-pet' },
				el( c.SelectControl, {
					label: sprintf( /* translators: %d: pet number. */ __( 'Pet %d', 'site-pets' ), i + 1 ),
					value: pet.type,
					options: options,
					onChange: function ( value ) {
						change( i, 'type', value );
					},
					__nextHasNoMarginBottom: true,
				} ),
				el( c.TextControl, {
					label: __( 'Name', 'site-pets' ),
					value: pet.name || '',
					placeholder: types[ pet.type ] ? types[ pet.type ].name : '',
					maxLength: 30,
					onChange: function ( value ) {
						change( i, 'name', value );
					},
					__nextHasNoMarginBottom: true,
				} ),
				a.pets.length > 1
					? el(
							c.Button,
							{
								variant: 'tertiary',
								isDestructive: true,
								className: 'spets-editor-remove',
								onClick: function () {
									set( {
										pets: a.pets.filter( function ( p, j ) {
											return j !== i;
										} ),
									} );
								},
							},
							__( 'Remove', 'site-pets' )
					  )
					: null
			);
		} );

		return el(
			Fragment,
			null,
			el(
				be.InspectorControls,
				null,
				el(
					c.PanelBody,
					{ title: __( 'Pets', 'site-pets' ) },
					rows,
					a.pets.length < max
						? el(
								c.Button,
								{
									variant: 'secondary',
									onClick: function () {
										set( { pets: a.pets.concat( [ { type: options[ 0 ] ? options[ 0 ].value : 'cat-orange', name: '' } ] ) } );
									},
								},
								__( 'Add a pet', 'site-pets' )
						  )
						: null
				),
				el(
					c.PanelBody,
					{ title: __( 'Scene', 'site-pets' ) },
					el( c.SelectControl, {
						label: __( 'Scene', 'site-pets' ),
						value: a.scene,
						options: Object.keys( scenes ).map( function ( id ) {
							return { value: id, label: scenes[ id ] };
						} ),
						onChange: function ( value ) {
							set( { scene: value } );
						},
						__nextHasNoMarginBottom: true,
					} ),
					el( c.RangeControl, {
						label: __( 'Height', 'site-pets' ),
						value: a.height,
						min: 160,
						max: 800,
						onChange: function ( value ) {
							set( { height: value || 260 } );
						},
						__nextHasNoMarginBottom: true,
					} ),
					el( c.ToggleControl, {
						label: __( 'Show a “Throw a ball” button', 'site-pets' ),
						checked: !! a.ball,
						onChange: function ( value ) {
							set( { ball: value } );
						},
						__nextHasNoMarginBottom: true,
					} )
				)
			),
			el( 'div', blockProps, el( Preview, { attributes: a } ) )
		);
	}

	wp.blocks.registerBlockType( 'site-pets/playground', {
		icon: icon,
		edit: Edit,
		save: function () {
			return null;
		},
	} );
} )( window.wp, window.sitePetsEditor || {} );
