using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.XR.Interaction.Toolkit;

namespace WebAR.Task7
{
    // An untracked virtual controller must not leave an invisible ray at (0,0,0).
    [DefaultExecutionOrder(-29980)]
    public sealed class BridgeRayGate : MonoBehaviour
    {
        public ActionBasedController controller;
        public XRRayInteractor ray;
        public LineRenderer line;
        public Task7SceneController scene;
        private InputAction scaleAxis;
        private XRInteractorLineVisual visual;

        private void OnEnable()
        {
            visual = GetComponent<XRInteractorLineVisual>();
            string hand = name.Contains("Left") ? "LeftHand" : "RightHand";
            scaleAxis = new InputAction("Scale", InputActionType.Value,
                "<WebXRInteractionController>{" + hand + "}/primary2DAxis");
            scaleAxis.Enable();
        }

        private void Update()
        {
            bool tracked = controller.currentControllerState != null && controller.currentControllerState.isTracked;
            ray.allowHover = tracked;
            ray.allowSelect = tracked;
            line.enabled = tracked;
            // LineVisual updates after this gate and can otherwise re-enable
            // an invalid red ray after the controller has disconnected.
            if (visual) visual.enabled = tracked;
            if (tracked && ray.hasSelection)
            {
                float y = scaleAxis.ReadValue<Vector2>().y;
                if (Mathf.Abs(y) > 0.2f) scene.ScaleBy(Mathf.Exp(y * Time.unscaledDeltaTime));
            }
        }

        private void OnDisable()
        {
            if (visual) visual.enabled = false;
            if (line) line.enabled = false;
            scaleAxis?.Disable();
            scaleAxis?.Dispose();
            scaleAxis = null;
        }
    }
}
