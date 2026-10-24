using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.XR.Interaction.Toolkit;
using WebXR;

namespace WebAR.Task7
{
    [DefaultExecutionOrder(200)]
    public sealed class Task7SceneController : MonoBehaviour
    {
        public Transform cameraSet;
        public XRGrabInteractable target;
        public ScreenRayController screenInput;
        public const float InitialScale = 0.15f;
        public const float MinimumScale = 0.06f;
        public const float MaximumScale = 0.45f;
        private Camera[] cameras;
        private Material material;
        private bool resetPending = true;
        private float desiredScale = InitialScale;
        private string lastStatus;
        private int lastPercent;

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void Task7Report(string status, int percent);
#endif

        public Camera ActiveCamera
        {
            get
            {
                if (cameras == null) cameras = cameraSet.GetComponentsInChildren<Camera>(true);
                foreach (Camera camera in cameras)
                    if (camera.isActiveAndEnabled) return camera;
                return null;
            }
        }

        private void Awake()
        {
            material = target.GetComponent<Renderer>().material;
            material.EnableKeyword("_EMISSION");
        }

        private void OnEnable()
        {
            WebXRManager.OnXRChange += OnXRChange;
            WebXRManager.OnVisibilityChange += OnVisibilityChange;
        }

        private void OnDisable()
        {
            WebXRManager.OnXRChange -= OnXRChange;
            WebXRManager.OnVisibilityChange -= OnVisibilityChange;
        }

        private void OnVisibilityChange(WebXRVisibilityState visibility)
        {
            if (visibility != WebXRVisibilityState.VISIBLE) screenInput.CancelPointer();
        }

        private void OnXRChange(WebXRState state, int views, Rect left, Rect right)
        {
            screenInput.CancelPointer();
            resetPending = true;
        }

        public void ResetObject()
        {
            screenInput.CancelPointer();
            resetPending = true;
        }

        // HTML buttons and pinch share the same bounded scale path.
        public void ScaleUp() => ScaleBy(1.1f);
        public void ScaleDown() => ScaleBy(1 / 1.1f);

        public void ScaleBy(float factor)
        {
            if (!float.IsFinite(factor) || factor <= 0) return;
            desiredScale = Mathf.Clamp(desiredScale * factor, MinimumScale, MaximumScale);
        }

        private void LateUpdate()
        {
            Camera camera = ActiveCamera;
            if (resetPending && camera)
            {
                // Disabling an interactable cancels selections through XRI,
                // including a controller that was disconnected during a grab.
                target.enabled = false;
                Transform cube = target.transform;
                cube.SetParent(null, true);
                cube.position = camera.transform.position + camera.transform.forward * 0.65f;
                cube.rotation = camera.transform.rotation * Quaternion.Euler(15, 25, 0);
                desiredScale = InitialScale;
                cube.localScale = Vector3.one * desiredScale;
                target.enabled = true;
                target.SetTargetPose(new Pose(cube.position, cube.rotation));
                resetPending = false;
                Physics.SyncTransforms();
                Debug.Log("TASK7_RUNTIME_READY XRI grab + WebXR XRIT bridge + screen ray");
            }

            // XRI owns translation/rotation; trackScale is disabled on the grab
            // so its default transformer cannot overwrite the pinch result.
            target.transform.localScale = Vector3.one * desiredScale;
            Color color = target.isSelected ? new Color(0.2f, 1f, 0.55f)
                : target.isHovered ? new Color(0.15f, 0.75f, 1f) : new Color(0.96f, 0.56f, 0.12f);
            material.color = color;
            material.SetColor("_EmissionColor", color * (target.isSelected ? 0.3f : 0.08f));
            string status = target.isSelected ? "Объект захвачен — двигайте палец или луч"
                : target.isHovered ? "Объект под лучом — нажмите для захвата"
                : "Коснитесь куба и тяните. Два пальца — масштаб";
            int percent = Mathf.RoundToInt(desiredScale / InitialScale * 100);
            if (status == lastStatus && percent == lastPercent) return;
            lastStatus = status;
            lastPercent = percent;
#if UNITY_WEBGL && !UNITY_EDITOR
            Task7Report(status, percent);
#endif
        }

        private void OnDestroy()
        {
            if (material) Destroy(material);
        }
    }
}
