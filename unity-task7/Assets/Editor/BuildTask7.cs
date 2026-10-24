using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.XR.Interaction.Toolkit;
using WebAR.Task6.Editor;
using WebXR;
using WebXR.XRITBridge;

namespace WebAR.Task7.Editor
{
    public static class BuildTask7
    {
        private const string ScenePath = "Assets/Scenes/InteractiveAR.unity";

        [MenuItem("WebAR/Prepare task 7 scene")]
        public static void Prepare()
        {
            // Reuse the actual task 6 camera rig, lighting and WebXR loader.
            BuildTask6.Prepare();
            UnityEngine.Object.DestroyImmediate(GameObject.Find("Viewer-space behaviour"));
            GameObject cube = GameObject.Find("Viewer-space cube");
            cube.name = "Interactive cube";
            cube.transform.SetParent(null, true);
            Material cubeMaterial = cube.GetComponent<Renderer>().sharedMaterial;
            cubeMaterial.EnableKeyword("_EMISSION");
            cubeMaterial.SetColor("_EmissionColor", cubeMaterial.color * 0.08f);
            EditorUtility.SetDirty(cubeMaterial);
            new GameObject("XR Interaction Manager").AddComponent<XRInteractionManager>();
            new GameObject("WebXR XRIT Bridge Controllers").AddComponent<WebXRControllerAdapter>();
            Rigidbody body = cube.AddComponent<Rigidbody>();
            body.useGravity = false;
            body.isKinematic = true;
            XRGrabInteractable grab = cube.AddComponent<XRGrabInteractable>();
            grab.movementType = XRBaseInteractable.MovementType.Instantaneous;
            grab.useDynamicAttach = true;
            grab.matchAttachPosition = true;
            grab.matchAttachRotation = true;
            grab.attachEaseInTime = 0;
            grab.throwOnDetach = false;
            grab.trackScale = false;
            grab.selectMode = InteractableSelectMode.Single;

            GameObject app = new GameObject("Task7Scene");
            Task7SceneController scene = app.AddComponent<Task7SceneController>();
            Transform rig = GameObject.Find("WebXRCameraSet").transform;
            scene.cameraSet = rig;
            scene.target = grab;

            GameObject touch = new GameObject("Task7Input");
            touch.SetActive(false);
            touch.transform.SetParent(rig, false);
            ScreenRayController screen = touch.AddComponent<ScreenRayController>();
            XRRayInteractor screenRay = AddRay(touch);
            screenRay.allowHover = false;
            screenRay.allowSelect = false;
            screenRay.allowAnchorControl = false;
            screen.scene = scene;
            screen.rayInteractor = screenRay;
            screen.updateTrackingType = XRBaseController.UpdateType.Update;
            scene.screenInput = screen;
            touch.SetActive(true);

            CreateControllerRay(rig, "Left", scene);
            CreateControllerRay(rig, "Right", scene);
            WebXRSettings settings = AssetDatabase.LoadAssetAtPath<WebXRSettings>("Assets/XR/WebXRSettings.asset");
            // A released object stays in local space instead of following the
            // viewer. Placement is in front of the camera, without a hit test.
            settings.ARRequiredReferenceSpace = WebXRSettings.ReferenceSpaceTypes.local;
            settings.VRRequiredReferenceSpace = WebXRSettings.ReferenceSpaceTypes.local;
            EditorUtility.SetDirty(settings);
            PlayerSettings.productName = "Interactive WebAR Task 7";
            PlayerSettings.WebGL.template = "PROJECT:WebXRTask7";
            EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene(), ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            Validate();
            Debug.Log("TASK7_SCENE_READY " + ScenePath);
        }

        private static XRRayInteractor AddRay(GameObject go)
        {
            XRRayInteractor ray = go.AddComponent<XRRayInteractor>();
            ray.maxRaycastDistance = 5;
            ray.lineType = XRRayInteractor.LineType.StraightLine;
            ray.enableUIInteraction = false;
            ray.useForceGrab = false;
            ray.keepSelectedTargetValid = true;
            ray.selectActionTrigger = XRBaseControllerInteractor.InputTriggerType.StateChange;
            return ray;
        }

        private static InputActionProperty Action(string name, string binding, string type, bool button = false)
        {
            return new InputActionProperty(new InputAction(name,
                button ? InputActionType.Button : InputActionType.Value, binding,
                expectedControlType: type));
        }

        private static void CreateControllerRay(Transform rig, string hand, Task7SceneController scene)
        {
            GameObject go = new GameObject(hand + " XR Ray");
            go.SetActive(false);
            go.transform.SetParent(rig, false);
            string path = "<WebXRInteractionController>{" + hand + "Hand}/";
            ActionBasedController controller = go.AddComponent<ActionBasedController>();
            controller.positionAction = Action(hand + "Position", path + "devicePosition", "Vector3");
            controller.rotationAction = Action(hand + "Rotation", path + "deviceRotation", "Quaternion");
            controller.isTrackedAction = Action(hand + "Tracked", path + "isTracked", "Button", true);
            controller.trackingStateAction = Action(hand + "TrackingState", path + "trackingState", "Integer");
            controller.selectAction = Action(hand + "Select", path + "triggerPressed", "Button", true);
            controller.selectActionValue = Action(hand + "SelectValue", path + "trigger", "Axis");
            XRRayInteractor ray = AddRay(go);
            ray.allowAnchorControl = false; // thumbstick Y is assigned to scaling
            LineRenderer line = go.AddComponent<LineRenderer>();
            string materialPath = "Assets/Materials/ControllerRay.mat";
            Material material = AssetDatabase.LoadAssetAtPath<Material>(materialPath);
            if (!material)
            {
                material = new Material(Shader.Find("Sprites/Default"));
                AssetDatabase.CreateAsset(material, materialPath);
            }
            line.sharedMaterial = material;
            XRInteractorLineVisual visual = go.AddComponent<XRInteractorLineVisual>();
            visual.lineWidth = 0.004f;
            BridgeRayGate gate = go.AddComponent<BridgeRayGate>();
            gate.controller = controller;
            gate.ray = ray;
            gate.line = line;
            gate.scene = scene;
            go.SetActive(true);
        }

        [MenuItem("WebAR/Validate task 7 scene")]
        public static void Validate()
        {
            Task7SceneController scene = UnityEngine.Object.FindFirstObjectByType<Task7SceneController>();
            if (!scene || !scene.target || !scene.screenInput || !scene.cameraSet)
                throw new BuildFailedException("Task 7 scene references are incomplete. Run Prepare task 7 scene.");
            if (UnityEngine.Object.FindFirstObjectByType<WebAR.Task6.ViewerSpaceCube>())
                throw new BuildFailedException("ViewerSpaceCube would overwrite drag movement.");
            if (!UnityEngine.Object.FindFirstObjectByType<WebXRControllerAdapter>() ||
                UnityEngine.Object.FindObjectsByType<Camera>(FindObjectsSortMode.None).Length != 5)
                throw new BuildFailedException("Use the bridge controller adapter with the original WebXRCamera rig.");
            if (UnityEngine.Object.FindObjectsByType<XRRayInteractor>(FindObjectsSortMode.None).Length != 3)
                throw new BuildFailedException("Expected screen, left and right XR Ray Interactors.");
            if (scene.target.transform.parent != null || scene.target.trackScale || scene.target.throwOnDetach)
                throw new BuildFailedException("Grab configuration would interfere with world position or pinch.");
            Debug.Log("TASK7_SCENE_VALIDATED");
        }

        [MenuItem("WebAR/Build task 7 WebGL")]
        public static void Build()
        {
            string output = Path.GetFullPath("Build/WebGL");
            string metricsPath = Path.Combine(output, "build-metrics.json");
            if (File.Exists(metricsPath)) File.Delete(metricsPath);
            Prepare();
            if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.WebGL, BuildTarget.WebGL))
                throw new BuildFailedException("Install Web Build Support for this Unity Editor.");
            BuildReport report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { ScenePath }, target = BuildTarget.WebGL,
                locationPathName = output, options = BuildOptions.None
            });
            if (report.summary.result != BuildResult.Succeeded)
                throw new BuildFailedException(report.summary.result.ToString());
            File.WriteAllText(metricsPath,
                "{\n  \"task\": 7,\n  \"unity\": \"" + Application.unityVersion +
                "\",\n  \"xrit\": \"2.6.4\",\n  \"bridge\": \"0.1.2-task7.1\",\n  \"totalBytes\": " +
                report.summary.totalSize + ",\n  \"mobileARTest\": \"pending real device\"\n}\n");
            Debug.Log("TASK7_BUILD_SUCCESS " + report.summary.totalSize + " bytes " + output);
        }
    }
}
