using System;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.XR;
using UnityEngine.XR.Interaction.Toolkit;

namespace WebAR.Task7
{
    // DOM Overlay supplies normalized coordinates even when Unity's canvas no
    // longer receives browser touch events during an immersive session.
    [DefaultExecutionOrder(XRInteractionUpdateOrder.k_Controllers)]
    public sealed class ScreenRayController : XRBaseController
    {
        public Task7SceneController scene;
        public XRRayInteractor rayInteractor;
        private Vector2 pointer = new Vector2(0.5f, 0.5f);
        private bool pressed;
        private bool visible;

        [Serializable]
        private sealed class PointerPacket
        {
            public float x;
            public float y;
            public bool pressed;
            public bool visible;
            public float scale = 1;
        }

        // Called by unityInstance.SendMessage from task7-input.js.
        public void Pointer(string json)
        {
            PointerPacket packet = JsonUtility.FromJson<PointerPacket>(json);
            if (packet == null || !float.IsFinite(packet.x) || !float.IsFinite(packet.y)) return;
            pointer = new Vector2(Mathf.Clamp01(packet.x), Mathf.Clamp01(packet.y));
            pressed = packet.pressed;
            visible = packet.visible;
            if (rayInteractor.hasSelection) scene.ScaleBy(packet.scale);
        }

        public void CancelPointer()
        {
            pressed = false;
            visible = false;
            rayInteractor.allowHover = false;
            rayInteractor.allowSelect = false;
        }

        protected override void UpdateTrackingInput(XRControllerState state)
        {
#if UNITY_EDITOR
            // The DOM adapter is used by WebGL; allow a normal mouse grab in
            // the Unity Game view when reviewing the generated scene.
            if (Mouse.current != null && Screen.width > 0 && Screen.height > 0)
            {
                Vector2 position = Mouse.current.position.ReadValue();
                pointer = new Vector2(position.x / Screen.width, position.y / Screen.height);
                visible = pointer.x >= 0 && pointer.x <= 1 && pointer.y >= 0 && pointer.y <= 1;
                pressed = visible && Mouse.current.leftButton.isPressed;
                if (rayInteractor.hasSelection)
                    scene.ScaleBy(Mathf.Exp(Mouse.current.scroll.ReadValue().y * 0.001f));
            }
#endif
            Camera camera = scene.ActiveCamera;
            state.isTracked = camera != null && visible;
            state.inputTrackingState = state.isTracked
                ? InputTrackingState.Position | InputTrackingState.Rotation
                : InputTrackingState.None;
            rayInteractor.allowHover = state.isTracked;
            rayInteractor.allowSelect = state.isTracked;
            if (!state.isTracked) return;
            Ray ray = camera.ViewportPointToRay(new Vector3(pointer.x, pointer.y, 0));
            // This object is a child of the rig, whose transform may be changed
            // independently of the tracked camera poses.
            Transform parent = transform.parent;
            state.position = parent ? parent.InverseTransformPoint(ray.origin) : ray.origin;
            Quaternion rotation = Quaternion.LookRotation(ray.direction, camera.transform.up);
            state.rotation = parent ? Quaternion.Inverse(parent.rotation) * rotation : rotation;
        }

        protected override void UpdateInput(XRControllerState state)
        {
            state.ResetFrameDependentStates();
            state.selectInteractionState.SetFrameState(pressed && visible, pressed ? 1 : 0);
            state.activateInteractionState.SetFrameState(false, 0);
            state.uiPressInteractionState.SetFrameState(false, 0);
        }
    }
}
