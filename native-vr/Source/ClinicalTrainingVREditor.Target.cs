using UnrealBuildTool;
using System.Collections.Generic;

public class ClinicalTrainingVREditorTarget : TargetRules
{
    public ClinicalTrainingVREditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V5;
        ExtraModuleNames.Add("ClinicalTrainingVR");
    }
}
