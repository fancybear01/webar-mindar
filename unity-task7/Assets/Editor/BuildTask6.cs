using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEditor.XR.Management;
using UnityEditor.XR.Management.Metadata;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.XR.Management;
using WebXR;

namespace WebAR.Task6.Editor
{
    public static class BuildTask6
    {
        private const string ScenePath = "Assets/Scenes/ViewerSpace.unity";

        [MenuItem("WebAR/Prepare task 6 scene")]
        public static void Prepare()
        {
            Directory.CreateDirectory("Assets/Scenes");
            Directory.CreateDirectory("Assets/Prefabs");
            Directory.CreateDirectory("Assets/Materials");
            Directory.CreateDirectory("Assets/XR");
            AssetDatabase.Refresh();
            PlayerSettings.companyName = "WebAR Practice";
            PlayerSettings.productName = "Viewer Space AR";
            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.decompressionFallback = false;
            PlayerSettings.WebGL.threadsSupport = false;
            PlayerSettings.WebGL.initialMemorySize = 128;
            PlayerSettings.WebGL.maximumMemorySize = 512;
            PlayerSettings.WebGL.template = "PROJECT:WebXRFullView2020";
            PlayerSettings.defaultWebScreenWidth = 540;
            PlayerSettings.defaultWebScreenHeight = 960;
            PlayerSettings.runInBackground = true;
            PlayerSettings.stripEngineCode = true;
            PlayerSettings.SetIl2CppCodeGeneration(NamedBuildTarget.WebGL, Il2CppCodeGeneration.OptimizeSize);
            ConfigureXR();
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("WebXRManager").AddComponent<WebXRManager>();
            GameObject rig = new GameObject("WebXRCameraSet");
            WebXRCamera webCamera = rig.AddComponent<WebXRCamera>();
            Camera main = CreateCamera(rig.transform, "Main Camera", true, false);
            Camera leftVR = CreateCamera(rig.transform, "CameraVRL", false, false);
            Camera rightVR = CreateCamera(rig.transform, "CameraVRR", false, false);
            Camera leftAR = CreateCamera(rig.transform, "CameraARL", false, true);
            Camera rightAR = CreateCamera(rig.transform, "CameraARR", false, true);
            main.gameObject.AddComponent<AudioListener>();
            main.tag = "MainCamera";
            SerializedObject serialized = new SerializedObject(webCamera);
            serialized.FindProperty("cameraMain").objectReferenceValue = main;
            serialized.FindProperty("cameraL").objectReferenceValue = leftVR;
            serialized.FindProperty("cameraR").objectReferenceValue = rightVR;
            serialized.FindProperty("cameraARL").objectReferenceValue = leftAR;
            serialized.FindProperty("cameraARR").objectReferenceValue = rightAR;
            serialized.ApplyModifiedPropertiesWithoutUndo();
            foreach (WebXRControllerHand hand in new[] { WebXRControllerHand.LEFT, WebXRControllerHand.RIGHT })
            {
                GameObject controller = new GameObject("WebXRController " + hand);
                controller.transform.SetParent(rig.transform, false);
                controller.AddComponent<WebXRController>().hand = hand;
            }
            PrefabUtility.SaveAsPrefabAsset(rig, "Assets/Prefabs/WebXRCameraSet.prefab");
            GameObject cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cube.name = "Viewer-space cube";
            cube.transform.SetParent(main.transform, false);
            cube.transform.localPosition = new Vector3(0, 0, 0.65f);
            cube.transform.localScale = Vector3.one * 0.15f;
            Material material = AssetDatabase.LoadAssetAtPath<Material>("Assets/Materials/ViewerCube.mat");
            if (!material)
            {
                material = new Material(Shader.Find("Standard"));
                AssetDatabase.CreateAsset(material, "Assets/Materials/ViewerCube.mat");
            }
            material.color = new Color(0.96f, 0.56f, 0.12f);
            material.SetFloat("_Metallic", 0.25f);
            material.SetFloat("_Glossiness", 0.6f);
            EditorUtility.SetDirty(material);
            cube.GetComponent<Renderer>().sharedMaterial = material;
            cube.GetComponent<Renderer>().shadowCastingMode = ShadowCastingMode.Off;
            GameObject viewer = new GameObject("Viewer-space behaviour");
            ViewerSpaceCube follow = viewer.AddComponent<ViewerSpaceCube>();
            follow.cameraSet = rig.transform;
            follow.cube = cube.transform;
            Light light = new GameObject("Key Light").AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.5f;
            light.transform.rotation = Quaternion.Euler(35, -30, 0);
            RenderSettings.ambientLight = new Color(0.65f, 0.7f, 0.8f);
            RenderSettings.ambientMode = AmbientMode.Flat;
            EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene(), ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
            Debug.Log("TASK6_SCENE_READY " + ScenePath);
        }

        private static Camera CreateCamera(Transform parent, string name, bool enabled, bool transparent)
        {
            GameObject go = new GameObject(name);
            go.transform.SetParent(parent, false);
            Camera camera = go.AddComponent<Camera>();
            camera.enabled = enabled;
            camera.nearClipPlane = 0.01f;
            camera.farClipPlane = 30;
            camera.fieldOfView = 60;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = transparent ? new Color(0, 0, 0, 0) : new Color(0.06f, 0.09f, 0.16f, 1);
            return camera;
        }

        private static void ConfigureXR()
        {
            WebXRSettings web = AssetDatabase.LoadAssetAtPath<WebXRSettings>("Assets/XR/WebXRSettings.asset");
            if (!web) { web = ScriptableObject.CreateInstance<WebXRSettings>(); AssetDatabase.CreateAsset(web, "Assets/XR/WebXRSettings.asset"); }
            web.DisableXRDisplaySubsystem = true; // Official BiRP camera-set mode.
            web.AutoLoadWebXRManager = false;
            web.AutoLoadWebXRInputSystem = false;
            web.ARRequiredReferenceSpace = WebXRSettings.ReferenceSpaceTypes.viewer;
            web.AROptionalFeatures = 0;
            web.VROptionalFeatures = 0;
            EditorBuildSettings.AddConfigObject("WebXR.Settings", web, true);
            var perTarget = AssetDatabase.LoadAssetAtPath<XRGeneralSettingsPerBuildTarget>("Assets/XR/XRGeneralSettings.asset");
            if (!perTarget)
            {
                perTarget = ScriptableObject.CreateInstance<XRGeneralSettingsPerBuildTarget>();
                AssetDatabase.CreateAsset(perTarget, "Assets/XR/XRGeneralSettings.asset");
            }
            var general = perTarget.SettingsForBuildTarget(BuildTargetGroup.WebGL);
            if (!general)
            {
                general = ScriptableObject.CreateInstance<XRGeneralSettings>();
                AssetDatabase.AddObjectToAsset(general, perTarget);
            }
            var manager = general.Manager;
            if (!manager)
            {
                manager = ScriptableObject.CreateInstance<XRManagerSettings>();
                AssetDatabase.AddObjectToAsset(manager, perTarget);
            }
            manager.automaticLoading = true;
            manager.automaticRunning = true;
            general.Manager = manager;
            general.InitManagerOnStart = true;
            perTarget.SetSettingsForBuildTarget(BuildTargetGroup.WebGL, general);
            EditorUtility.SetDirty(web);
            EditorUtility.SetDirty(perTarget);
            EditorUtility.SetDirty(general);
            EditorUtility.SetDirty(manager);
            EditorBuildSettings.AddConfigObject(XRGeneralSettings.k_SettingsKey, perTarget, true);
            if (!XRPackageMetadataStore.AssignLoader(manager, typeof(WebXRLoader).FullName, BuildTargetGroup.WebGL))
                throw new BuildFailedException("Could not enable WebXR Export loader.");
        }

        [MenuItem("WebAR/Build task 6 WebGL")]
        public static void Build()
        {
            Prepare();
            if (!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.WebGL, BuildTarget.WebGL))
                throw new BuildFailedException("Unity Web Build Support is not installed for this Editor.");
            string output = Path.GetFullPath("Build/WebGL");
            BuildReport report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { ScenePath }, target = BuildTarget.WebGL,
                locationPathName = output, options = BuildOptions.None
            });
            if (report.summary.result != BuildResult.Succeeded) throw new BuildFailedException(report.summary.result.ToString());
            string metrics = "{\n  \"unity\": \"" + Application.unityVersion + "\",\n  \"webxrExport\": \"0.25.0\",\n  \"compression\": \"Disabled\",\n  \"decompressionFallback\": false,\n  \"multithread\": false,\n  \"totalBytes\": " + report.summary.totalSize + ",\n  \"mobileTest\": \"Pending real Android device\"\n}";
            File.WriteAllText(Path.Combine(output, "build-metrics.json"), metrics);
            Debug.Log("TASK6_BUILD_SUCCESS " + report.summary.totalSize + " bytes " + output);
        }
    }
}
