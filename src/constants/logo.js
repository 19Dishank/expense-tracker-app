// Geometry of the app logo, drawn in a 1024 x 1024 box.
// The PNG files in /assets were rendered from exactly these numbers (see assets/logo-mark.svg),
// so the animated launch screen lines up with the native splash image.
export const LOGO = {
  box: 1024,
  center: 512,
  ringRadius: 280,
  ringWidth: 80,
  arcDegrees: 100, // length of the green part of the ring
  arcStartDegrees: -90, // -90 = starts at 12 o'clock and runs clockwise
  glyphWidth: 30, // line thickness of the rupee symbol
  glyphShiftY: -10,
  // The rupee symbol: two bars, a bowl and a leg
  glyphPaths: [
    'M430 410 H602',
    'M430 468 H602',
    'M472 410 H524 C590 410 590 528 524 528 H472',
    'M472 528 L586 640',
  ],
};

