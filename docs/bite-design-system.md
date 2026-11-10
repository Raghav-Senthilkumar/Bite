# Bite Design System & Mobile Specification

This document defines the exact visual design system, typography scale, color tokens, component metrics, and motion physics for Bite. Use these specifications to build or align mobile applications (iOS SwiftUI, React Native, or Flutter) with the web client.

---

## 1. Design Principles

- **Warm Editorial Feel**: Warm linen background (`#F9F9F6`) with dark slate ink (`#2E2E2E`) replaces harsh stark-white and pure-black contrasts.
- **Fresh Herbaceous Accents**: The signature palette pairs vibrant kelly green (`#00A859`) with soft lime yellow-green (`#D7F0A2`) and subtle mint tints (`#EAF7EE`).
- **Tactile Kitchen Utility**: Rounded pill geometry, generous tap targets, strike-through checklist states, and spring-based tactile compression for one-handed kitchen use.

---

## 2. Color Palette & Tokens

### Primary Brand & Accent Colors

| Token Name | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
| `green` | `#00A859` | Primary brand green, active pills, success checks, links |
| `green-dark` | `#008A47` | Active pill hover/pressed state, dark accent |
| `green-deep` | `#007A40` | Wordmark shadow, high-contrast text on light green |
| `lime` | `#D7F0A2` | Primary pill background, accent cards, uncompleted step circles |
| `lime-hover` | `#CBEB8B` | Pressed/hover state for lime pills |
| `mint` | `#EAF7EE` | Very soft green background tint for active states |
| `green-tint-12` | `rgba(0, 168, 89, 0.12)` | Badge backgrounds, count pill backgrounds |
| `green-tint-20` | `rgba(0, 168, 89, 0.20)` | Spinner track border |

### Neutrals & Surfaces

| Token Name | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
| `bg` | `#F9F9F6` | App canvas background, ingredient/step card backgrounds |
| `surface` | `#FFFFFF` | Cards, modals, segmented sliders, popovers |
| `surface-alt` | `#F2F2EE` | Segmented tab track, image placeholder background |
| `ink` | `#2E2E2E` | Primary typography, headers, main labels |
| `muted` | `rgba(46, 46, 46, 0.56)` | Secondary body copy, descriptions, captions |
| `ink-65` | `rgba(46, 46, 46, 0.65)` | Circle button icons, tab buttons |
| `ink-45` | `rgba(46, 46, 46, 0.45)` | Category counts, hints, subtle metadata |
| `ink-22` | `rgba(46, 46, 46, 0.22)` | Checkbox borders |
| `ink-16` | `rgba(46, 46, 46, 0.16)` | Mobile drag handle |
| `line` | `rgba(46, 46, 46, 0.10)` | Hairline dividers, borders |

### Status & Utility Colors

| Token Name | Hex / Value | Semantic Role |
| :--- | :--- | :--- |
| `error-bg` | `#FDECE7` | Error banner background |
| `error-ink` | `#9A3412` | Error banner text |
| `success-bg` | `#F3F8EC` | Import complete banner |
| `backdrop` | `rgba(20, 24, 21, 0.52)` | Modal / bottom sheet dimmed backdrop |
| `image-placeholder` | `linear-gradient(135deg, #DFE9DD 0%, #F1E9D8 48%, #DCE9E1 100%)` | Cover photo shimmer / fallback |

---

## 3. Typography System

### Typefaces

- **Primary UI & Text**: `DM Sans` (Google Fonts). Fallbacks: `-apple-system`, `BlinkMacSystemFont`, `sans-serif`.
- **Wordmark / Brand Display**: `Fredoka` (Weight: `700 Bold`).

### Type Scale (Mobile Spec)

| Role | Font Family | Size | Weight | Line Height | Tracking | Color |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Wordmark | `Fredoka` | Responsive | 700 | 1.00 | -8px | `#00A859` |
| Screen Heading (Large) | `DM Sans` | 30px | 400 | 1.08 | -0.03em | `#2E2E2E` |
| Modal Recipe Title | `DM Sans` | 20px | 500 | 1.15 | -0.03em | `#2E2E2E` |
| Section Header | `DM Sans` | 16px | 600 | 1.20 | -0.01em | `#2E2E2E` |
| Card Title | `DM Sans` | 18px | 500 | 1.25 | -0.025em | `#2E2E2E` |
| Instruction Body | `DM Sans` | 14.5px | 400 | 1.58 | normal | `#2E2E2E` |
| Ingredient Name | `DM Sans` | 14px | 500 | 1.40 | normal | `#2E2E2E` |
| Ingredient Measurement | `DM Sans` | 12px | 400 | 1.40 | normal | `rgba(46, 46, 46, 0.56)` |
| Segmented Tab Label | `DM Sans` | 13.5px | 500 / 600 | 1.20 | normal | `rgba(46, 46, 46, 0.6)` / `#2E2E2E` |
| Primary Pill Label | `DM Sans` | 12px | 500 | 1.00 | normal | `#00A859` or `#FFFFFF` |
| Meta Pill Label | `DM Sans` | 11px | 500 | 1.00 | normal | `#00A859` |
| Step Number Label | `DM Sans` | 12px | 600 | 1.00 | normal | `#00A859` or `#FFFFFF` |
| Counter Badge | `DM Sans` | 11px | 600 | 1.00 | tabular | `#00A859` |
| Microcopy / Original Line | `DM Sans` | 11px | 400 | 1.30 | normal | `rgba(46, 46, 46, 0.45)` |

---

## 4. Spacing, Radii & Elevations

### Border Radius Tokens

| Token | Radius | Usage |
| :--- | :--- | :--- |
| `radius-xs` | 6px | Checkbox squares |
| `radius-sm` | 8px | Counter buttons (`-` / `+`), small meta pills |
| `radius-md` | 10px-11px | Standard pills (`cabagges-pill`), segmented slider pill |
| `radius-lg` | 13px-14px | Ingredient rows, segmented track, search pill |
| `radius-xl` | 16px | Instruction step cards, mobile recipe cover photos |
| `radius-2xl` | 20px-24px | Recipe cards, desktop cover photos, bottom sheet top corners |
| `radius-full` | 9999px | Circle buttons (`close`, `copy`), drag handle, round badges |

### Shadow Tokens

| Token | Shadow Value | Usage |
| :--- | :--- | :--- |
| `shadow-card` | `0 2px 10px rgba(0, 0, 0, 0.03)` | Subtle card elevation |
| `shadow-tab-slider`| `0 2px 10px rgba(0, 0, 0, 0.06)` | Segmented active tab pill |
| `shadow-tab-track` | `0 6px 18px rgba(255, 255, 255, 0.90)` | White soft glow below sticky tab bar |
| `shadow-sheet` | `0 32px 80px rgba(0, 0, 0, 0.22)` | Bottom sheet modal elevation |
| `shadow-dispatch` | `0 16px 38px rgba(0, 0, 0, 0.10)` | Floating dispatch card |

---

## 5. Component Specifications (Mobile)

### 5.1 Pill Component (`cabagges-pill`)

The central interactive element throughout the application.

- **Default State**:
  - Background: `#D7F0A2` (`--lime`)
  - Label Color: `#00A859` (`--green`)
  - Font: `DM Sans`, 11px-12px, Weight 500
  - Border Radius: 10px (small) to 12px (standard)
  - Mobile Padding: 4px 9px (meta pills) or 7px 12px (filter pills)
- **Active / Solid State**:
  - Background: `#00A859` (`--green`)
  - Label Color: `#FFFFFF`
- **Count Badge (Inside Filter Pill)**:
  - Height: 20px, Min-Width: 20px, Padding: 0 6px
  - Radius: 9999px
  - Default Background: `rgba(0, 168, 89, 0.12)`, Text: `#00A859`
  - Active Background: `rgba(255, 255, 255, 0.22)`, Text: `#FFFFFF`

### 5.2 Circular Action Button (Close & Copy)

- **Dimensions**: 32px x 32px (Mobile), 36px x 36px (Desktop)
- **Border Radius**: 50% (Circle)
- **Border**: None
- **Initial / Idle State**:
  - Background: `#F9F9F6` (`--bg`)
  - Icon Color: `rgba(46, 46, 46, 0.65)`
- **Hover / Pressed State**:
  - Background: `#D7F0A2` (`--lime`)
  - Icon Color: `#00A859` (`--green`)
  - Active Press Scale: `0.88`
- **Copied State**:
  - Background: `#D7F0A2`
  - Icon Color: `#00A859`
  - Spring Pop Animation: 0% at 0.88 scale -> 45% at 1.14 scale -> 100% at 1.00 scale

### 5.3 Sticky Segmented Switcher (Ingredients / Steps)

Optimized for mobile viewing to prevent infinite scrolling.

- **Container / Track**:
  - Position: Sticky (`top: 0`)
  - Background: `#F2F2EE`
  - Padding: 4px
  - Border Radius: 14px
  - Box Shadow: `0 6px 18px rgba(255, 255, 255, 0.90)`
- **Sliding Indicator Pill**:
  - Background: `#FFFFFF`
  - Border Radius: 11px
  - Shadow: `0 2px 10px rgba(0, 0, 0, 0.06)`
  - Spring Animation: `transform 360ms cubic-bezier(0.34, 1.4, 0.64, 1)`
- **Tab Buttons**:
  - Padding: 10px 12px
  - Inactive Text: `rgba(46, 46, 46, 0.60)`, Weight 500
  - Active Text: `#2E2E2E`, Weight 600
  - Count Badge: 19px height, radius 9999px, background `rgba(0, 168, 89, 0.12)`, color `#00A859`

### 5.4 Ingredient Checklist Row

- **Container**:
  - Background: `#F9F9F6`
  - Padding: 10px 12px
  - Border Radius: 13px
  - Active Press Scale: `0.985`
- **Checkbox Element**:
  - Dimensions: 20px x 20px
  - Border Radius: 6px
  - Idle: White background, 1.5px solid `rgba(46, 46, 46, 0.22)`
  - Checked: `#00A859` background, `#00A859` border, scale `1.05`
  - Check Icon: `#FFFFFF`, stroke width 2.5px
- **Checked Row State**:
  - Overall Row Opacity: `0.56`
  - Text: `text-decoration: line-through` on primary ingredient name

### 5.5 Instruction Step Card

- **Container**:
  - Background: `#F9F9F6`
  - Padding: 14px 16px
  - Border Radius: 16px
  - Active Press Scale: `0.99`
- **Step Number Pill**:
  - Dimensions: 26px x 26px circle
  - Idle: Background `#D7F0A2`, Text `#00A859`, Font 12px Weight 600
  - Completed: Background `#00A859`, Text `#FFFFFF`
- **Completed Step State**:
  - Card Opacity: `0.58`
  - Step Body Text: `text-decoration: line-through`

### 5.6 Serving Scale Controls (`-` / `+`)

- **Container**:
  - Padding: 10px 12px
  - Border: 1px solid `rgba(46, 46, 46, 0.10)`
  - Border Radius: 13px
  - Background: `#F9F9F6`
- **Buttons**:
  - Dimensions: 29px x 29px
  - Border Radius: 8px
  - Background: `#FFFFFF`
  - Border: 1px solid `rgba(46, 46, 46, 0.10)`
  - Pressed/Hover: Background `#D7F0A2`, Color `#008A47`
- **Serving Output Value**:
  - Font: 14px, Weight 600, tabular numbers

### 5.7 Mobile Bottom Sheet Modal

- **Backdrop**:
  - Background: `rgba(20, 24, 21, 0.52)`
  - Backdrop Blur: 8px
- **Sheet Container**:
  - Border Radius: 24px 24px 0 0 (Top corners only)
  - Max Height: `92dvh`
  - Padding: 12px 16px 32px
  - Background: `#FFFFFF`
- **Drag Handle**:
  - Dimensions: 36px width, 4px height
  - Border Radius: 9999px
  - Background: `rgba(46, 46, 46, 0.16)`
  - Margin: 2px auto 14px

### 5.8 Recipe Card & Horizontal Scroller

- **Aspect Ratio**: 4 / 4.7 (or 3 / 4)
- **Border Radius**: 20px
- **Image Fallback Shimmer**: `linear-gradient(135deg, #DFE9DD 0%, #F1E9D8 48%, #DCE9E1 100%)`
- **Tap Compression**: `scale(0.975)` over 240ms cubic-bezier(0.22, 1, 0.36, 1)
- **Scroller Layout**: Snapping with scroll padding inset matching header text alignment

---

## 6. Motion & Spring Physics

### Cubic Bezier Curves

| Name | Curve Values | Description |
| :--- | :--- | :--- |
| `spring-pop` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful overshoot used on copy check, badges, and dispatch cards |
| `smooth-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Standard buttery deceleration for drawers, hovers, and modals |
| `snappy-page`| `cubic-bezier(0.16, 1, 0.3, 1)` | Crisp screen entrance curve |
| `tab-spring` | `cubic-bezier(0.34, 1.4, 0.64, 1)` | Segmented tab slider translation |

### Page Transitions

- **Forward (Index to All Recipes)**:
  - Exit: 140ms, opacity 1 -> 0, translateY 0 -> -8px
  - Reset scroll position instantly during zero-opacity
  - Enter: 260ms, opacity 0 -> 1, translateY 12px -> 0
- **Backward (All Recipes to Index)**:
  - Exit: 140ms, opacity 1 -> 0, translateY 0 -> 8px
  - Reset scroll position instantly during zero-opacity
  - Enter: 260ms, opacity 0 -> 1, translateY -10px -> 0

---

## 7. Platform Mapping Quick Reference

### SwiftUI (iOS)

```swift
extension Color {
    static let biteBg = Color(red: 0.976, green: 0.976, blue: 0.965)       // #F9F9F6
    static let biteInk = Color(red: 0.180, green: 0.180, blue: 0.180)      // #2E2E2E
    static let biteGreen = Color(red: 0.000, green: 0.659, blue: 0.349)    // #00A859
    static let biteLime = Color(red: 0.843, green: 0.941, blue: 0.635)     // #D7F0A2
    static let biteMint = Color(red: 0.918, green: 0.969, blue: 0.933)     // #EAF7EE
    static let biteLine = Color(red: 0.180, green: 0.180, blue: 0.180).opacity(0.10)
}

extension Font {
    static func dmSans(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        return Font.custom("DMSans-Regular", size: size).weight(weight)
    }
}
```

### React Native / StyleSheet

```typescript
export const BiteTheme = {
  colors: {
    bg: '#F9F9F6',
    ink: '#2E2E2E',
    muted: 'rgba(46, 46, 46, 0.56)',
    green: '#00A859',
    greenDark: '#008A47',
    lime: '#D7F0A2',
    limeHover: '#CBEB8B',
    mint: '#EAF7EE',
    line: 'rgba(46, 46, 46, 0.10)',
    surface: '#FFFFFF',
    surfaceAlt: '#F2F2EE',
  },
  radii: {
    xs: 6,
    sm: 8,
    md: 11,
    lg: 13,
    xl: 16,
    sheet: 24,
    full: 9999,
  },
  typography: {
    fontFamily: 'DMSans-Regular',
    wordmarkFamily: 'Fredoka-Bold',
  },
};
```

