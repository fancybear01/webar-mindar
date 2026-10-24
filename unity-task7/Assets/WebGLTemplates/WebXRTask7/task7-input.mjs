// Pure gesture state machine; browser adapters are attached separately so the
// same lifecycle and pinch behavior can be verified without an AR device.
export function createGestures(send) {
  const pointers = new Map();
  let primary = null;
  let blocked = false;
  let previousDistance = null;
  let last = { x: 0.5, y: 0.5 };

  function distance() {
    if (pointers.size !== 2) return null;
    const [a, b] = pointers.values();
    return Math.hypot(a.px - b.px, a.py - b.py);
  }
  function emit(scale = 1, hover = false) {
    if (pointers.has(primary)) last = pointers.get(primary);
    send({ x: last.x, y: last.y, pressed: primary !== null && !blocked,
      visible: (primary !== null && !blocked) || hover, scale });
  }
  return {
    down(id, point) {
      pointers.set(id, point);
      if (primary === null && !blocked) primary = id;
      previousDistance = distance();
      emit();
    },
    move(id, point, hover = false) {
      if (!pointers.has(id)) {
        if (hover && primary === null && !blocked) { last = point; emit(1, true); }
        return;
      }
      pointers.set(id, point);
      const current = distance();
      // Ratios use CSS pixel distances, so an unequal viewport aspect ratio
      // does not distort a diagonal pinch. Ignore nearly coincident contacts.
      const scale = current > 8 && previousDistance > 8 ? current / previousDistance : 1;
      previousDistance = current;
      emit(scale);
    },
    up(id) {
      if (!pointers.has(id)) return;
      pointers.delete(id);
      if (id === primary) {
        primary = null;
        // Do not jump the ray to the remaining finger and accidentally regrab.
        blocked = pointers.size > 0;
      }
      previousDistance = distance();
      if (!pointers.size) blocked = false;
      emit();
    },
    cancel() {
      pointers.clear(); primary = null; blocked = false; previousDistance = null;
      emit();
    }
  };
}

export function attachGestures(surface, send, lifecycle = window) {
  const gestures = createGestures(send);
  function point(event) {
    const rect = surface.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)),
      px: event.clientX, py: event.clientY };
  }
  surface.addEventListener('beforexrselect', event => event.preventDefault());
  surface.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    surface.setPointerCapture(event.pointerId);
    gestures.down(event.pointerId, point(event));
  });
  surface.addEventListener('pointermove', event => {
    event.preventDefault();
    gestures.move(event.pointerId, point(event), event.pointerType === 'mouse');
  });
  surface.addEventListener('pointerup', event => gestures.up(event.pointerId));
  surface.addEventListener('pointercancel', () => gestures.cancel());
  surface.addEventListener('lostpointercapture', event => gestures.up(event.pointerId));
  surface.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse' && !event.buttons) gestures.cancel();
  });
  surface.addEventListener('contextmenu', event => event.preventDefault());
  lifecycle.addEventListener('blur', () => gestures.cancel());
  lifecycle.addEventListener('pagehide', () => gestures.cancel());
  lifecycle.addEventListener('resize', () => gestures.cancel());
  lifecycle.document?.addEventListener('visibilitychange', () => {
    if (lifecycle.document.hidden) gestures.cancel();
  });
  return gestures;
}
