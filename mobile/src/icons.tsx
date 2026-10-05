import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

/**
 * Tab bar icons.
 *
 * WHY HAND-DRAWN PATHS RATHER THAN AN ICON FONT
 * @expo/vector-icons ships with Expo and would be the obvious choice. It also
 * ships a font file, which means a second asset to load, a flash of invisible
 * glyphs while it arrives, and a build step that has to embed it. These are a
 * handful of paths that react-native-svg already draws - and react-native-svg is
 * a dependency either way, because the Google mark on the sign-in button uses it.
 *
 * WHY THEY ARE STROKES, NOT FILLS
 * A filled icon at 22px on a phone screen turns into a solid blob, and the shape
 * stops being readable. Stroked outlines stay legible at that size and at the
 * accessibility font-scaling sizes Android users actually set.
 *
 * 24x24 is the grid every one of these is drawn on, matching the Material and
 * iOS conventions, so they sit together at the same optical weight.
 */

/** The bag. Two tabs use icons from this set, so the sizes stay identical. */
export function BagIcon({
  size = 22,
  color,
}: {
  size?: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Handle, drawn as a stroke arc that stops at the bag's rim. */}
      <Path
        d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M9 8V6.5a3 3 0 0 1 6 0V8"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** The storefront: an awning over a box, which is a shop and not just a box. */
export function ShopIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9.5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      {/* Scalloped awning. Three arcs rather than a straight line, because the
          curve is what makes it read as a shopfront and not as a document. */}
      <Path
        d="M3.2 9.5 4.6 4.8A1 1 0 0 1 5.55 4.2h12.9a1 1 0 0 1 .95.6L20.8 9.5"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M3.2 9.5a2.6 2.6 0 0 0 5.2 0 2.6 2.6 0 0 0 5.2 0 2.6 2.6 0 0 0 5.2 0"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** The person. Head plus shoulders, which is the whole of it. */
export function PersonIcon({ size = 22, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="3.6" stroke={color} strokeWidth={1.7} />
      <Path
        d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * The magnifier. At 22px the diagonal handle is two pixels, so the circle is
 * pulled slightly off-centre to give it something to hold.
 */
export function SearchIcon({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={1.9} />
      <Line
        x1="15.4"
        y1="15.4"
        x2="20.5"
        y2="20.5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** The cross on the search field's clear button. */
export function CloseIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * The tick on the "added" state of the add button.
 *
 * It exists because a server round trip is not instant on mobile data, and a
 * button that does nothing visible for half a second reads as broken. The tick
 * confirms the tap landed before the number in the cart updates.
 */
export function TickIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The padlock, for the "signed in" state on the account screen. */
export function LockIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4.5" y="10.5" width="15" height="10" rx="2" stroke={color} strokeWidth={1.7} />
      <Path
        d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * The sync arrows, on the account screen next to the cart count.
 *
 * Two arcs rather than a circular arrow: a full circle reads as "refresh this
 * thing", and what is actually happening is a swap between two devices.
 */
export function SyncIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 9.5A8 8 0 0 1 17.7 6.4L20 8.7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 4.4v4.3h-4.3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20 14.5A8 8 0 0 1 6.3 17.6L4 15.3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 19.6v-4.3h4.3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}