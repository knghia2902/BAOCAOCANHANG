---
name: apply-design-system
description: >-
  Enforces the BAOCAOCANHANG design system rules from DESIGN.md when coding, editing, or creating views and components.
---

# Apply Design System

## Overview
This skill ensures that all changes, additions, and refactoring within the **BAOCAOCANHANG** project strictly conform to the design system specified in [DESIGN.md](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/DESIGN.md). It outlines the workflow for reading, applying, and verifying the design system.

## Dependencies
- None (relies on [DESIGN.md](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/DESIGN.md) at the project root).

## Quick Start
Before editing any frontend code (Vue components, style.css, HTML, Tailwind classes), read the design tokens from [DESIGN.md](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/DESIGN.md).

## Workflow

### 1. Verification of Design System Tokens
Before making any layout or styling modifications:
- Read [DESIGN.md](file:///c:/Users/TVPL-NgocAnh/Desktop/Tools/BAOCAOCANHANG/DESIGN.md) to inspect the active colors, typography scale, border-radii, and button specifications.
- Do NOT use hardcoded colors (like pink `#f0426e`, or arbitrary grays) unless they are explicitly authorized by the design tokens.

### 2. Styling Application Rules
When writing Tailwind CSS classes or CSS variables:
- **Colors**: Use `primary` (`#4a78c2`), `background-light` (`#f0f4f8`), `bg-[#f1f5f9]` for inputs/secondary controls, and `text-[#1e293b]` (main slate text).
- **Typography**: Display titles must use `font-display` (`Space Grotesk`) and size `text-3xl`/`text-xl` with weight `font-black`. Body text uses `Quicksand`. Minimum UI font size is `12px` (`text-xs`).
- **Border Radii**: Large containers use `rounded-[2.5rem]` (40px) or `rounded-[2rem]` / `rounded-[24px]`. Inputs and secondary buttons use `rounded-2xl` (16px). Primary Puffy buttons and icon buttons use `rounded-full` (9999px).
- **Buttons**:
  - **Primary (Puffy)**: `bg-primary text-white font-bold rounded-full shadow-[0_4px_0_0_#6495ed] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#6495ed] active:translate-y-[4px] active:shadow-none transition-all`
  - **Secondary (Outline)**: `bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl hover:bg-primary/5 active:scale-95 transition-all shadow-sm`
  - **Icon Button (Circle)**: `size-10 bg-[#f1f5f9] rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 hover:scale-105 active:scale-95 transition-all`
  - **Table Action Icons**: `size-8 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all active:scale-95` (Edit) and `size-8 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all active:scale-95` (Delete).

### 3. Layout Grid Alignment
- Floating headers must use sticky styling (`sticky top-6 z-50`) with backdrop blur (`backdrop-blur bg-white/80`) and width `w-[95%] max-w-[1200px]`.
- Tables must have sticky headers (`sticky top-0 z-10`) with table row hover transitions (`hover:bg-gray-50`).

## Common Mistakes
- **Hardcoding Old Pink Colors**: Reintroducing `#f0426e`, `#faebee`, or `#fb6f92` instead of using the new blue/slate values.
- **Wrong Border Radius**: Using standard Tailwind radii like `rounded-md` or `rounded-lg` on large panels where `rounded-[2rem]` or `rounded-[2.5rem]` is expected.
- **Missing Puffy Shadows**: Forgetting the `shadow-[0_4px_0_0_#6495ed]` and translate-y transitions on primary action buttons.
