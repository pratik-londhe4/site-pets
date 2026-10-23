/**
 * Appearance > Site Pets: a live preview of the pets chosen in the form.
 */
( function ( window, document ) {
	'use strict';

	var settings = window.sitePetsSettings || { types: {} };
	var preview = document.getElementById( 'spets-preview' );
	var form = preview && preview.parentNode.querySelector( 'form' );
	var current = null;

	function chosen() {
		var pets = [];
		form.querySelectorAll( '.spets-settings__pet' ).forEach( function ( row ) {
			var type = row.querySelector( 'select' ).value;
			var name = row.querySelector( 'input' ).value;
			var info = settings.types[ type ];
			if ( info ) {
				pets.push( { type: type, name: name || info.name, sprite: info.sprite } );
			}
		} );
		return pets;
	}

	function draw() {
		if ( current ) {
			current.destroy();
			current = null;
		}
		var ball = form.querySelector( '[name$="[ball]"]' );
		current = window.sitePets.mount( preview, {
			mode: 'playground',
			pets: chosen(),
			scale: 2,
			ball: ! ball || ball.checked,
			floor: 28,
			strings: settings.strings || {},
		} );
	}

	if ( preview && form && window.sitePets ) {
		form.addEventListener( 'change', draw );
		draw();
	}
} )( window, document );
