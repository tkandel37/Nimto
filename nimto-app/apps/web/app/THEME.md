# myNimto theme guide

The product palette lives at the top of `globals.css` inside `:root`. Change
those tokens to retheme the website; do not add new page-specific hex values.

## Palette roles

- `--brand-plum`, `--brand-plum-deep`: primary identity and focused controls.
- `--brand-berry`, `--brand-berry-deep`: supporting identity color.
- `--brand-champagne`, `--brand-champagne-soft`: restrained premium accents.
- `--canvas`, `--canvas-tint`: page backgrounds.
- `--surface`, `--surface-raised`, `--surface-muted`, `--surface-brand`: cards,
  panels, table headers, and selected states.
- `--surface-dark`, `--surface-dark-raised`: user and admin navigation.
- `--text-strong`, `--text-body`, `--text-muted`, `--text-on-brand`: readable
  text hierarchy.
- `--border-soft`, `--border-medium`: separators and form controls.
- `--success`, `--warning`, `--danger`, `--info`: semantic feedback only.
- `--brand-gradient`, `--brand-gradient-hover`: primary calls to action.
- `--shadow-soft`, `--shadow-raised`, `--shadow-brand`: depth hierarchy.

The legacy aliases (`--ink`, `--leaf`, `--rose`, `--marigold`, and `--paper`)
must continue to point to semantic palette tokens until all older components
have been migrated. This keeps Tailwind utility classes and older screens in
the same theme.

## Rules for future changes

1. Adjust tokens in `:root`; keep component rules token-only.
2. Use champagne sparingly for details, never as a large page background.
3. Keep primary-button text white and verify its contrast against both ends of
   the gradient.
4. Do not use brand colors for success, warning, or destructive feedback.
5. After changing the palette, build the web app and check public, auth, user,
   and admin routes at desktop and 390px mobile widths.
