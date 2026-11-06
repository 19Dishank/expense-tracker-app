import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, PanResponder } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../constants/theme';
import {
  CELL_HEIGHT,
  ICON_SIZE,
  ICON_TOP,
  buildRingLayout,
  placeCategories,
  buildSlices,
  angleFromCenter,
} from '../utils/ringLayout';

// Plain absolute positioning (do not use StyleSheet.absoluteFillObject, it is removed in newer React Native)
const ABSOLUTE = { position: 'absolute', top: 0, left: 0 };

// Finds which slice contains the given angle (clockwise from 12 o'clock, 0-360)
function findSliceAtAngle(slices, rotation, touchAngle) {
  for (const s of slices) {
    const startAngle = (rotation + s.fractionStart * 360) % 360;
    const sweep = s.fraction * 360;
    const delta = (((touchAngle - startAngle) % 360) + 360) % 360;
    if (delta >= 0 && delta <= sweep + 0.1) {
      return s;
    }
  }
  return null;
}

// Donut in the middle, categories around it.
//   categories            = active categories, each with { id, name, icon, color, total }
//   archivedSpending      = deleted categories that still have spending (slice only, no icon)
//   onCategoryPress       = called with the category when its icon is tapped (opens add expense)
//   onCategoryLongPress   = called with the category when its icon is long-pressed (shows stats)
//   onHoleTap             = called when the user taps the donut hole area (e.g. to dismiss highlight)
//   highlightedId         = currently highlighted category id (or null)
//   onHighlightChange     = callback when a slice is clicked, held, or released
//   children              = content shown inside the donut hole
export default function CategoryRing({
  categories,
  archivedSpending = [],
  onCategoryPress,
  onCategoryLongPress,
  onHoleTap,
  highlightedId = null,
  onHighlightChange,
  children,
}) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const layout = buildRingLayout(width, categories.length);
  const placed = placeCategories(layout, categories);
  const { slices, rotation } = buildSlices(layout, placed, archivedSpending);

  const circumference = 2 * Math.PI * layout.ringRadius;
  const holeRadius = layout.ringRadius - layout.strokeWidth / 2;

  // Active slice for line drawing and visual emphasis
  const activeSlice = highlightedId ? slices.find((s) => s.id === highlightedId) : null;

  // Keep a ref to latest layout/slices/callbacks so the pan responder always uses fresh values
  const stateRef = useRef({ layout, slices, rotation, highlightedId, onHighlightChange });
  useEffect(() => {
    stateRef.current = { layout, slices, rotation, highlightedId, onHighlightChange };
  });

  const touchStartTime = useRef(0);
  const startPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const activeTouchId = useRef(null);

  function checkRingTouch(localX, localY) {
    const { layout: curLayout, slices: curSlices, rotation: curRot } = stateRef.current;
    if (!curSlices || curSlices.length === 0) return false;
    const center = curLayout.donutSize / 2;
    const dx = localX - center;
    const dy = localY - center;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curHole = curLayout.ringRadius - curLayout.strokeWidth / 2;
    const minR = curHole - 8;
    const maxR = curLayout.donutSize / 2 + 16;
    if (dist < minR || dist > maxR) {
      return false;
    }
    const angle = angleFromCenter(center, center, localX, localY);
    const slice = findSliceAtAngle(curSlices, curRot, angle);
    return slice !== null;
  }

  function getSliceAtPos(localX, localY) {
    const { layout: curLayout, slices: curSlices, rotation: curRot } = stateRef.current;
    if (!curSlices || curSlices.length === 0) return null;
    const center = curLayout.donutSize / 2;
    const dx = localX - center;
    const dy = localY - center;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curHole = curLayout.ringRadius - curLayout.strokeWidth / 2;
    const minR = curHole - 12;
    const maxR = curLayout.donutSize / 2 + 24;
    if (dist < minR || dist > maxR) {
      return null;
    }
    const angle = angleFromCenter(center, center, localX, localY);
    return findSliceAtAngle(curSlices, curRot, angle);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        return checkRingTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (activeTouchId.current) return true;
        return (
          (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3) &&
          checkRingTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY)
        );
      },
      onPanResponderGrant: (evt) => {
        touchStartTime.current = Date.now();
        hasMoved.current = false;
        startPos.current = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
        const slice = getSliceAtPos(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
        if (slice) {
          activeTouchId.current = slice.id;
          if (stateRef.current.onHighlightChange) {
            stateRef.current.onHighlightChange(slice.id);
          }
        } else {
          activeTouchId.current = null;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          hasMoved.current = true;
        }
        const curX = startPos.current.x + gestureState.dx;
        const curY = startPos.current.y + gestureState.dy;
        const slice = getSliceAtPos(curX, curY);
        if (slice) {
          if (activeTouchId.current !== slice.id) {
            activeTouchId.current = slice.id;
            if (stateRef.current.onHighlightChange) {
              stateRef.current.onHighlightChange(slice.id);
            }
          }
        }
      },
      onPanResponderRelease: () => {
        const duration = Date.now() - touchStartTime.current;
        const wasScrubOrHold = hasMoved.current || duration > 300;
        if (wasScrubOrHold) {
          // Held or dragged then released -> dismiss
          activeTouchId.current = null;
          if (stateRef.current.onHighlightChange) {
            stateRef.current.onHighlightChange(null);
          }
        } else {
          // Quick tap / click on a slice: toggle or select
          const tappedId = activeTouchId.current;
          if (stateRef.current.highlightedId === tappedId) {
            activeTouchId.current = null;
            if (stateRef.current.onHighlightChange) {
              stateRef.current.onHighlightChange(null);
            }
          }
        }
      },
      onPanResponderTerminate: () => {
        activeTouchId.current = null;
        if (stateRef.current.onHighlightChange) {
          stateRef.current.onHighlightChange(null);
        }
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  return (
    <View style={{ width: layout.width, height: layout.height }}>
      {/* Layer 1: ring, slices, and leader line */}
      <Svg width={layout.width} height={layout.height} style={[ABSOLUTE, { pointerEvents: 'none' }]}>
        {/* Fill the hole with the screen color so nothing shows through it */}
        <Circle cx={layout.cx} cy={layout.cy} r={holeRadius} fill={colors.background} />

        {/* Grey ring (also the empty state) */}
        <Circle
          cx={layout.cx}
          cy={layout.cy}
          r={layout.ringRadius}
          stroke={colors.border}
          strokeWidth={layout.strokeWidth}
          fill="none"
        />

        {/* Colored slices */}
        <G rotation={rotation - 90} origin={`${layout.cx}, ${layout.cy}`}>
          {slices.map((s) => {
            const length = s.fraction * circumference;
            const isHighlighted = activeSlice && activeSlice.id === s.id;
            return (
              <Circle
                key={'slice-' + s.id}
                cx={layout.cx}
                cy={layout.cy}
                r={layout.ringRadius}
                stroke={s.color}
                strokeWidth={isHighlighted ? layout.strokeWidth + 5 : layout.strokeWidth}
                strokeOpacity={activeSlice ? (isHighlighted ? 1 : 0.35) : 1}
                fill="none"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-s.fractionStart * circumference}
              />
            );
          })}
        </G>
      </Svg>

      {/* Layer 2: Dedicated touch area for donut ring and center hole */}
      <View
        style={{
          position: 'absolute',
          left: layout.cx - layout.donutSize / 2,
          top: layout.cy - layout.donutSize / 2,
          width: layout.donutSize,
          height: layout.donutSize,
          borderRadius: layout.donutSize / 2,
        }}
        {...panResponder.panHandlers}
      >
        {/* Content inside the donut hole — circular, only covers inner hole */}
        <TouchableOpacity
          style={[
            styles.hole,
            {
              position: 'absolute',
              left: layout.donutSize / 2 - holeRadius,
              top: layout.donutSize / 2 - holeRadius,
              width: holeRadius * 2,
              height: holeRadius * 2,
              borderRadius: holeRadius,
              paddingHorizontal: 16,
            },
          ]}
          onPress={() => {
            if (stateRef.current.onHighlightChange) {
              stateRef.current.onHighlightChange(null);
            }
            if (onHoleTap) onHoleTap();
          }}
          activeOpacity={0.8}
          accessibilityLabel="Donut center"
        >
          {children}
        </TouchableOpacity>
      </View>

      {/* Layer 3: category icons around the donut */}
      {placed.map((cat) => {
        const spent = cat.total > 0;
        const isHighlighted = activeSlice && activeSlice.id === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[ABSOLUTE, styles.cell, { left: cat.left, top: cat.top, width: layout.cellW, height: CELL_HEIGHT }]}
            onPress={() => onCategoryPress(cat)}
            onLongPress={() => onCategoryLongPress && onCategoryLongPress(cat)}
            activeOpacity={0.7}
            accessibilityLabel={`Add expense to ${cat.name}`}
          >
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: cat.color + (isHighlighted ? '38' : '1F') },
                spent && { borderWidth: 1.5, borderColor: cat.color },
                isHighlighted && { borderWidth: 3, borderColor: cat.color, transform: [{ scale: 1.12 }] },
              ]}
            >
              <MaterialCommunityIcons name={cat.icon} size={26} color={cat.color} />
            </View>
            <Text
              style={[
                styles.name,
                isHighlighted && { fontWeight: '700', color: cat.color },
              ]}
              numberOfLines={1}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    hole: { alignItems: 'center', justifyContent: 'center' },
    cell: { alignItems: 'center', paddingTop: ICON_TOP },
    iconCircle: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      borderRadius: ICON_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { fontSize: 12, color: colors.text, marginTop: 4, maxWidth: '92%' },
  });
