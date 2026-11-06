import React, { useRef } from 'react';
import { Animated, AccessibilityInfo, Easing, StyleSheet, useColorScheme } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';
import { lightColors, darkColors } from '../constants/theme';
import { LOGO } from '../constants/logo';

// Android gives the native splash icon a 288 dp box. Drawing the logo in the same box,
// with the same numbers, makes the native splash and this screen line up.
const BOX = 288;

// Animated launch screen. It sits on top of the app while the app loads underneath.
//   1. The native splash (same logo, same background) hides as soon as this screen has drawn.
//   2. The green part of the ring makes one full turn.
//   3. The whole screen fades out and the app is already there.
export default function AnimatedSplash({ onFinish }) {
  // The native splash follows the PHONE's theme, so this screen does the same.
  // The app then fades into the theme chosen in Settings.
  const scheme = useColorScheme();
  const palette = scheme === 'dark' ? darkColors : lightColors;

  const spin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const started = useRef(false);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const circumference = 2 * Math.PI * LOGO.ringRadius;
  const arcLength = (circumference * LOGO.arcDegrees) / 360;

  async function handleLayout() {
    if (started.current) {
      return;
    }
    started.current = true;

    // The first frame of this screen is on screen now, so the native splash can go
    try {
      await SplashScreen.hideAsync();
    } catch (e) {
      console.log('Native splash hide error:', e.message);
    }

    // Respect the phone's "remove animations" setting: just a quick fade
    let reduceMotion = false;
    try {
      reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
    } catch (e) {
      console.log('Reduce motion check error:', e.message);
    }
    if (reduceMotion) {
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onFinish());
      return;
    }

    Animated.sequence([
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.12, duration: 280, useNativeDriver: true }),
      ]),
    ]).start(() => onFinish());
  }

  const c = LOGO.center;

  return (
    <Animated.View
      style={[styles.overlay, { backgroundColor: palette.background, opacity: fade }]}
      onLayout={handleLayout}
    >
      <Animated.View style={{ width: BOX, height: BOX, transform: [{ scale }] }}>
        {/* Still part: the ring and the rupee symbol */}
        <Svg width={BOX} height={BOX} viewBox={`0 0 ${LOGO.box} ${LOGO.box}`}>
          <Circle
            cx={c}
            cy={c}
            r={LOGO.ringRadius}
            stroke={palette.text}
            strokeWidth={LOGO.ringWidth}
            fill="none"
          />
          <G transform={`translate(0 ${LOGO.glyphShiftY})`}>
            {LOGO.glyphPaths.map((d) => (
              <Path
                key={d}
                d={d}
                fill="none"
                stroke={palette.text}
                strokeWidth={LOGO.glyphWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </G>
        </Svg>

        {/* Turning part: the green arc, drawn in its own layer so it can rotate */}
        <Animated.View style={[styles.layer, { transform: [{ rotate }] }]}>
          <Svg width={BOX} height={BOX} viewBox={`0 0 ${LOGO.box} ${LOGO.box}`}>
            <G transform={`rotate(${LOGO.arcStartDegrees} ${c} ${c})`}>
              <Circle
                cx={c}
                cy={c}
                r={LOGO.ringRadius}
                stroke={palette.income}
                strokeWidth={LOGO.ringWidth}
                fill="none"
                strokeDasharray={`${arcLength} ${circumference - arcLength}`}
              />
            </G>
          </Svg>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Plain absolute values (StyleSheet.absoluteFillObject does not exist in this React Native version)
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BOX,
    height: BOX,
  },
});

