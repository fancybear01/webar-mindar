# Task 7 DOM Overlay patch

Based on the WebXR Export 0.25.0 embedded with the task 6 source archive.
Only Runtime/Plugins/WebGL/webxr.jspre is changed:

- When #task7-overlay exists, immersive-ar requires dom-overlay and passes that
  element as domOverlay.root. Without an overlay the original session options apply.
- Dispatch task7-session on AR start/end and task7-session-error on rejection.
- Keep the original rejection handling that resumes Unity's browser main loop.

The rest of the exporter and its license are unchanged. DOM Overlay is required
rather than silently opening AR without functional mobile interaction controls.
