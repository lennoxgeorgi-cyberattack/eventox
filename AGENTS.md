<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the browser-only Leaflet map mounted across tabs and resize it on activation so navigation preserves the user's map view.
- Keep date presets, navigation snapping and pinned-friend ordering in browser-safe pure helpers so interaction rules are testable.
- Resolve typed German locations through explicit user-triggered public OpenStreetMap place searches; never use autocomplete requests.
