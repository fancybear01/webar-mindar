using UnityEngine;
using WebXR;

namespace WebAR.Task6
{
    // Viewer-space: объект намеренно следует за камерой, в отличие от hit-test.
    public sealed class ViewerSpaceCube : MonoBehaviour
    {
        public Transform cameraSet;
        public Transform cube;
        public float distance = 0.65f;
        private Camera[] cameras;

        private void Awake() => cameras = cameraSet.GetComponentsInChildren<Camera>(true);
        private void Start() => Debug.Log("TASK6_RUNTIME_READY viewer-space distance=" + distance);

        private void LateUpdate()
        {
            foreach (Camera view in cameras)
            {
                if (!view.isActiveAndEnabled) continue;
                if (cube.parent != view.transform) cube.SetParent(view.transform, false);
                cube.localPosition = new Vector3(0, 0, distance);
                cube.localRotation = Quaternion.Euler(15, Time.time * 24, 0);
                break;
            }
        }
    }
}
