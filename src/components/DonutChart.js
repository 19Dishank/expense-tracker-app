import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

// data = [{ id, value, color }]
// children are shown in the center of the donut
export default function DonutChart({ data, size = 240, strokeWidth = 28, children }) {
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, item) => sum + item.value, 0);

  let usedLength = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Rotate so the first slice starts at the top */}
        <G rotation="-90" origin={`${center}, ${center}`}>
          {/* Grey background ring (also the empty state) */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#E9ECEF"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {total > 0 &&
            data.map((item) => {
              const sliceLength = (item.value / total) * circumference;
              const circle = (
                <Circle
                  key={item.id}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${sliceLength} ${circumference - sliceLength}`}
                  strokeDashoffset={-usedLength}
                />
              );
              usedLength += sliceLength;
              return circle;
            })}
        </G>
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // FIX: StyleSheet.absoluteFillObject is missing in newer React Native versions,
  // which made this view fall BELOW the ring. Plain absolute values always work.
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
});
