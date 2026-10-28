# Task 7 compatibility patch

Upstream: https://github.com/someone-s/webxr-xri-toolkit-bridge
Commit: d556fd64afbd75718f15f54038175616b775fb23 (package 0.1.2).
The upstream Apache-2.0 LICENSE and README are retained. This embedded copy is
versioned 0.1.2-task7.1; it is a modified package, not an upstream AR support claim.

- Dependency versions match the task 6 WebXR Export 0.25.0 project, Input System
  1.11.2 and XRI 2.6.4. Assembly references use names, not foreign asset GUIDs.
- The controller adapter still receives WebXR OnControllerUpdate, creates left
  and right Input System devices and queues pose, tracking and trigger/grip state.
- An explicit InputDevice state replaces XRI simulation types guarded by ENABLE_VR.
  ActionBasedController actions bind to this state by device layout and hand usage.
- Removed HMD height subtraction and the fixed 30-degree controller rotation:
  WebXRCamera and rays must use the same local reference space and WebXR aim pose.
- Devices unsubscribe and are removed on disable; XR session transitions clear
  tracked state and buttons so a released or disconnected controller cannot stick.
- The old headset adapter and prefab are preserved in Upstream~ for reference;
  Unity does not import that folder. Its separate camera creation conflicts with
  task 6's working WebXRCamera camera rig. Only the controller adapter is instantiated.
- Phone multitouch has no handed controller: ScreenRayController maps DOM Overlay
  pointers to XRControllerState and XRRayInteractor instead. It uses the same
  XRInteractionManager and XRGrabInteractable as the bridge-backed controller rays.

The tracked flag uses an explicit bit control, rather than a normalized byte.
This makes a state value of 1 read as pressed by ActionBasedController.
Diagnostic packets can be passed through the same adapter for runtime tests;
these are synthetic input checks, not claims of physical-controller testing.
