// Adapted from someone-s/webxr-xri-toolkit-bridge 0.1.2 (Apache-2.0).
// See PATCHES.md for WebXR 0.25 / XRI 2.6 / WebGL changes.
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.Layouts;
using UnityEngine.InputSystem.LowLevel;
using UnityEngine.InputSystem.Utilities;
using UnityEngine.Scripting;

namespace WebXR.XRITBridge
{
    // XRI's simulation states are guarded by ENABLE_VR in 2.6. A small explicit
    // Input System state keeps this bridge available in WebGL builds as well.
    [StructLayout(LayoutKind.Explicit, Size = 56)]
    public struct WebXRBridgeControllerState : IInputStateTypeInfo
    {
        public FourCC format => new FourCC('W', 'X', 'R', 'C');
        [InputControl(layout = "Vector2")][FieldOffset(0)] public Vector2 primary2DAxis;
        [InputControl(layout = "Axis")][FieldOffset(8)] public float trigger;
        [InputControl(name = "triggerPressed", layout = "Button", bit = 0)]
        [InputControl(name = "gripPressed", layout = "Button", bit = 1)]
        [FieldOffset(12)] public uint buttons;
        [InputControl(layout = "Axis")][FieldOffset(16)] public float grip;
        [InputControl(layout = "Button")][FieldOffset(20)] public byte isTracked;
        [InputControl(layout = "Integer")][FieldOffset(24)] public int trackingState;
        [InputControl(layout = "Vector3")][FieldOffset(28)] public Vector3 devicePosition;
        [InputControl(layout = "Quaternion")][FieldOffset(40)] public Quaternion deviceRotation;
    }

    [InputControlLayout(stateType = typeof(WebXRBridgeControllerState),
        commonUsages = new[] { "LeftHand", "RightHand" },
        displayName = "WebXR Controller", updateBeforeRender = true)]
    [Preserve]
    public class WebXRInteractionController : InputDevice
    {
        internal WebXRControllerHand ident;

        protected override void FinishSetup()
        {
            base.FinishSetup();
            WebXRManager.OnControllerUpdate += OnControllerUpdate;
            WebXRManager.OnXRChange += OnXRChange;
        }

        protected override void OnRemoved()
        {
            WebXRManager.OnControllerUpdate -= OnControllerUpdate;
            WebXRManager.OnXRChange -= OnXRChange;
            base.OnRemoved();
        }

        private void OnXRChange(WebXRState state, int views, Rect left, Rect right)
        {
            // Clear stale buttons and tracked state when ending or restarting XR.
            if (added) InputSystem.QueueStateEvent(this, new WebXRBridgeControllerState());
        }

        private void OnControllerUpdate(WebXRControllerData data)
        {
            if ((WebXRControllerHand)data.hand != ident || !added) return;
            uint buttons = 0;
            if (data.enabled && data.trigger >= 0.5f) buttons |= 1;
            if (data.enabled && data.squeeze >= 0.5f) buttons |= 2;
            InputSystem.QueueStateEvent(this, new WebXRBridgeControllerState {
                primary2DAxis = new Vector2(data.thumbstickX, data.thumbstickY),
                trigger = data.enabled ? data.trigger : 0,
                grip = data.enabled ? data.squeeze : 0,
                buttons = buttons,
                isTracked = data.enabled ? (byte)1 : (byte)0,
                trackingState = data.enabled ? 3 : 0,
                // Use exactly the same reference space and aim pose as WebXRCamera.
                devicePosition = data.position,
                deviceRotation = data.rotation
            });
        }
    }

    public class WebXRControllerAdapter : MonoBehaviour
    {
        private WebXRInteractionController left;
        private WebXRInteractionController right;

        private void OnEnable()
        {
            InputSystem.RegisterLayout<WebXRInteractionController>();
            left = InputSystem.AddDevice<WebXRInteractionController>("Left");
            left.ident = WebXRControllerHand.LEFT;
            InputSystem.SetDeviceUsage(left, CommonUsages.LeftHand);
            right = InputSystem.AddDevice<WebXRInteractionController>("Right");
            right.ident = WebXRControllerHand.RIGHT;
            InputSystem.SetDeviceUsage(right, CommonUsages.RightHand);
        }

        private void OnDisable()
        {
            if (left != null && left.added) InputSystem.RemoveDevice(left);
            if (right != null && right.added) InputSystem.RemoveDevice(right);
            left = right = null;
        }
    }
}
