export const DEFAULT_ANI_CONFIG = {
	duration: 1000,
	delay: 0,
	easing: 'easeOutElastic',
	elasticity:	500,
	begin: undefined,
	update: undefined,
	complete: undefined,
	loop: false,
	direction: 'normal',
	autoPlay: true,

    // when the property is scale,opacity, etc, there's a bug in this config;
    /*round: false, (desprecated)*/
};

export const validTransforms = ['translateX', 'translateY', 'translateZ', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'scale', 'scaleX', 'scaleY', 'scaleZ', 'skewX', 'skewY'];
