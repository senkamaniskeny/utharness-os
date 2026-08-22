# UTHARNESS OS branding and icon assets

This document records the canonical branding files and the 3D interface icon inventory used by the web and desktop surfaces.

## Canonical branding files

| File | Role | Consumers |
| --- | --- | --- |
| `apps/web/public/branding/utharness-logo.svg` | Supplied full UTHARNESS OS logo in SVG form | Web metadata, documentation, and future brand-led surfaces |
| `apps/web/public/branding/utharness-logo.png` | Supplied full UTHARNESS OS logo in PNG form | Open Graph preview and touch-icon fallback |
| `apps/web/public/branding/utharness-mark.svg` | Compact cyan/blue/lime/amber U mark | Sidebar identity and canonical favicon |
| `apps/web/public/favicon.svg` | Backward-compatible favicon path containing the compact mark | Existing bookmarks and browser caches |
| `apps/desktop/assets/utharness-app-icon.png` | Optimized 512×512 RGBA app icon derived from the supplied PNG | Electron `BrowserWindow` icon |

The full supplied logo is intentionally kept separate from the compact mark. The full artwork is appropriate for brand-led previews and documentation; the mark remains the fast-loading symbol for dense navigation and browser chrome.

## Interface icon pack

The supplied `3d_icon_pack_web_optimized_svg_variants.zip` contains 31 validated, transparent SVG concepts. The self-contained `minified_embedded` variants were copied to `apps/web/src/ui-icons/` with their numeric prefixes removed so Vite can import them with `import.meta.glob`.

| Concept family | Canonical file examples |
| --- | --- |
| Coordination and planning | `multi_agent_orchestrator.svg`, `agent_swarm_manager.svg`, `autonomous_task_planner.svg`, `goal_objective_manager.svg` |
| Tasks and workflow | `task_queue_scheduler.svg`, `workflow_builder.svg`, `multi_model_router.svg` |
| Runtime and tools | `mcp_server_manager.svg`, `terminal_command_executor.svg`, `code_generation_sandbox.svg`, `browser_automation_controller.svg` |
| Memory and knowledge | `memory_manager.svg`, `knowledge_base_manager.svg`, `rag_document_search.svg`, `vision_image_understanding.svg` |
| Telemetry and security | `realtime_logs_metrics_diagnostics.svg`, `security_permissions_audit_center.svg`, `security.svg`, `analytics.svg` |
| Product surfaces | `browser_live_preview.svg`, `settings.svg`, `notifications.svg`, `user_profile.svg`, `support.svg`, `search.svg`, `bookmarks.svg`, `billing.svg`, `shopping_cart.svg` |

The `ThreeDIcon` component maps the 18 semantic icon names used by the dashboard to this art family. Small inline action controls continue to use Lucide glyphs so button labels remain crisp and the dense UI does not over-fetch decorative artwork. When a supplied concept is not assigned to a semantic surface yet, it remains available in `apps/web/src/ui-icons/` for the next module that needs it.

## Integration rules

Use the compact mark for favicon, sidebar, app-icon, and other contexts below approximately 64px. Use the full supplied logo only when there is enough surface area for its detailed illustration and lettering. Keep all asset paths local; the dashboard must not depend on a remote CDN for identity or interface icons.

The supplied optimized SVGs are self-contained SVG files with the original artwork embedded as raster data. They are valid web-delivery SVGs and preserve the reference artwork, but they are not editable path-vector redraws. If an editable vector mark is required, create a separate manual vector-tracing deliverable rather than describing these embedded assets as path-vector artwork.

## Validation expectations

When changing this inventory, verify that all referenced files exist, every SVG has a valid root element and accessibility metadata, the web build succeeds, and the running dashboard loads the favicon, sidebar mark, and representative module icons without failed network requests. For desktop changes, build the Electron package and confirm the icon path resolves from `apps/desktop/dist/main.js` to `apps/desktop/assets/utharness-app-icon.png`.
