#include "ClinicalVRTelemetryComponent.h"

#include "Camera/PlayerCameraManager.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "ClinicalVRRoomEnvironment.h"
#include "Components/SceneComponent.h"
#include "EyeTrackerFunctionLibrary.h"
#include "EyeTrackerTypes.h"
#include "GameFramework/PlayerController.h"
#include "HeadMountedDisplayFunctionLibrary.h"
#include "HeadMountedDisplayTypes.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "JsonObject.h"
#include "JsonSerializer.h"
#include "JsonWriter.h"
#include "TimerManager.h"

UClinicalVRTelemetryComponent::UClinicalVRTelemetryComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UClinicalVRTelemetryComponent::ConfigureTelemetryEndpoint(
    const FString& InPlatformBaseUrl,
    const FString& InRoomName,
    const FString& InDeviceToken)
{
    PlatformBaseUrl = InPlatformBaseUrl.TrimEnd();
    while (PlatformBaseUrl.EndsWith(TEXT("/")))
    {
        PlatformBaseUrl.LeftChopInline(1);
    }
    RoomName = InRoomName.TrimStartAndEnd();
    DeviceToken = InDeviceToken.TrimStartAndEnd();
}

void UClinicalVRTelemetryComponent::BeginPlay()
{
    Super::BeginPlay();
    if (bEnableEyeGazeTelemetry && GetWorld())
    {
        if (APlayerController* PlayerController = GetWorld()->GetFirstPlayerController())
        {
            UEyeTrackerFunctionLibrary::SetEyeTrackedPlayer(PlayerController);
        }
    }
    if (GetWorld() && HeadPoseSampleIntervalSeconds > 0.5f)
    {
        GetWorld()->GetTimerManager().SetTimer(
            HeadPoseTimer,
            this,
            &UClinicalVRTelemetryComponent::PublishHeadPoseSample,
            HeadPoseSampleIntervalSeconds,
            true,
            HeadPoseSampleIntervalSeconds);
    }
}

void UClinicalVRTelemetryComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (GetWorld())
    {
        GetWorld()->GetTimerManager().ClearTimer(HeadPoseTimer);
    }
    DeviceToken.Reset();
    if (bEnableEyeGazeTelemetry)
    {
        UEyeTrackerFunctionLibrary::SetEyeTrackedPlayer(nullptr);
    }
    Super::EndPlay(EndPlayReason);
}

void UClinicalVRTelemetryComponent::PublishHeadPoseSample()
{
    if (!GetWorld()) return;
    if (!PatientTargetComponent)
    {
        for (TActorIterator<AClinicalVRRoomEnvironment> It(GetWorld()); It; ++It)
        {
            PatientTargetComponent = It->GetPatientGazeTarget();
            break;
        }
    }
    if (!PatientTargetComponent) return;

    APlayerController* PlayerController = GetWorld()->GetFirstPlayerController();
    if (!PlayerController || !PlayerController->PlayerCameraManager) return;

    const FVector HeadLocation = PlayerController->PlayerCameraManager->GetCameraLocation();
    const FVector Forward = PlayerController->PlayerCameraManager->GetCameraRotation().Vector().GetSafeNormal();
    const FVector PatientLocation = PatientTargetComponent->GetComponentLocation();
    const FVector ToPatient = (PatientLocation - HeadLocation).GetSafeNormal();
    const float HeadAngle = FMath::RadiansToDegrees(FMath::Acos(FMath::Clamp(FVector::DotProduct(Forward, ToPatient), -1.0f, 1.0f)));
    const float DistanceCm = FVector::Distance(HeadLocation, PatientLocation);

    TArray<TSharedPtr<FJsonObject>> Events;
    auto AddNumericEvent = [&Events](const FString& Type, const FString& Label, float Value, const FString& Unit)
    {
        TSharedPtr<FJsonObject> Event = MakeShared<FJsonObject>();
        Event->SetStringField(TEXT("type"), Type);
        Event->SetStringField(TEXT("label"), Label);
        Event->SetNumberField(TEXT("value"), Value);
        Event->SetStringField(TEXT("unit"), Unit);
        Events.Add(Event);
    };

    AddNumericEvent(TEXT("head_pose_sample"), TEXT("Unreal OpenXR head pose sample"), 1.0f, TEXT("sample"));
    AddNumericEvent(TEXT("head_direction_angle_degrees"), TEXT("Head direction angle to simulated patient"), HeadAngle, TEXT("degrees"));
    AddNumericEvent(TEXT("interaction_distance_cm"), TEXT("Approximate distance to simulated patient"), DistanceCm, TEXT("cm"));
    SendEvents(Events);

    const auto SampleTrackedHand = [this](const EControllerHand Hand, const FString& Handedness)
    {
        FXRHandTrackingState HandState;
        UHeadMountedDisplayFunctionLibrary::GetHandTrackingState(this, EXRSpaceType::World, Hand, HandState);
        const int32 ThumbTipIndex = static_cast<int32>(EHandKeypoint::ThumbTip);
        const int32 IndexTipIndex = static_cast<int32>(EHandKeypoint::IndexTip);
        if (!HandState.bValid || HandState.TrackingStatus == ETrackingStatus::NotTracked ||
            HandState.HandKeyLocations.Num() <= FMath::Max(ThumbTipIndex, IndexTipIndex))
        {
            return;
        }

        const float ThumbIndexDistanceCm = FVector::Distance(
            HandState.HandKeyLocations[ThumbTipIndex],
            HandState.HandKeyLocations[IndexTipIndex]);
        PublishHandTrackingSample(Handedness, ThumbIndexDistanceCm);
    };

    SampleTrackedHand(EControllerHand::Left, TEXT("left"));
    SampleTrackedHand(EControllerHand::Right, TEXT("right"));

    // Eye tracking is opt-in and only emits coarse, non-identifying evidence.
    // No raw eye images, pupil measurements, or detailed gaze traces are stored.
    if (bEnableEyeGazeTelemetry && bEyeGazeConsentProvided && PatientTargetComponent && UEyeTrackerFunctionLibrary::IsEyeTrackerConnected())
    {
        FEyeTrackerGazeData GazeData;
        if (UEyeTrackerFunctionLibrary::GetGazeData(GazeData) && GazeData.ConfidenceValue >= 0.35f)
        {
            const FVector GazeDirection = GazeData.GazeDirection.GetSafeNormal();
            const FVector ToPatientFromGaze = (PatientTargetComponent->GetComponentLocation() - GazeData.GazeOrigin).GetSafeNormal();
            const float GazeAngle = FMath::RadiansToDegrees(FMath::Acos(
                FMath::Clamp(FVector::DotProduct(GazeDirection, ToPatientFromGaze), -1.0f, 1.0f)));

            TArray<TSharedPtr<FJsonObject>> EyeEvents;
            auto AddEyeEvent = [&EyeEvents](const FString& Type, const FString& Label, float Value, const FString& Unit)
            {
                TSharedPtr<FJsonObject> Event = MakeShared<FJsonObject>();
                Event->SetStringField(TEXT("type"), Type);
                Event->SetStringField(TEXT("label"), Label);
                Event->SetNumberField(TEXT("value"), Value);
                Event->SetStringField(TEXT("unit"), Unit);
                EyeEvents.Add(Event);
            };

            AddEyeEvent(TEXT("eye_gaze_sample"), TEXT("Opt-in eye gaze sample valid"), 1.0f, TEXT("sample"));
            AddEyeEvent(TEXT("eye_gaze_angle_degrees"), TEXT("Eye gaze direction angle to simulated patient"), GazeAngle, TEXT("degrees"));
            AddEyeEvent(TEXT("eye_gaze_confidence"), TEXT("Eye gaze confidence"), GazeData.ConfidenceValue, TEXT("ratio"));
            SendEvents(EyeEvents);
        }
    }
}

void UClinicalVRTelemetryComponent::PublishHandTrackingSample(const FString& Handedness, float ThumbIndexDistanceCm)
{
    const FString Side = Handedness == TEXT("left") ? TEXT("left") : Handedness == TEXT("right") ? TEXT("right") : TEXT("unknown");
    const float Distance = FMath::Clamp(ThumbIndexDistanceCm, 0.0f, 50.0f);
    const bool bPinching = Distance <= 3.5f;
    const bool bWasPinching = HandPinchingState.FindRef(Side);
    HandPinchingState.Add(Side, bPinching);

    TSharedPtr<FJsonObject> Event = MakeShared<FJsonObject>();
    Event->SetStringField(TEXT("type"), TEXT("hand_tracking_sample"));
    Event->SetStringField(TEXT("label"), Side + (bPinching ? TEXT(":pinch") : TEXT(":open")));
    Event->SetNumberField(TEXT("value"), Distance);
    Event->SetStringField(TEXT("unit"), TEXT("cm"));
    TArray<TSharedPtr<FJsonObject>> Events;
    Events.Add(Event);
    SendEvents(Events);

    if (bPinching && !bWasPinching)
    {
        PublishHandPinchInteraction(Side, Distance);
    }
}

void UClinicalVRTelemetryComponent::PublishHandPinchInteraction(const FString& Handedness, float ThumbIndexDistanceCm)
{
    TSharedPtr<FJsonObject> Event = MakeShared<FJsonObject>();
    Event->SetStringField(TEXT("type"), TEXT("hand_pinch_interaction"));
    Event->SetStringField(TEXT("label"), Handedness + TEXT(" pinch gesture"));
    Event->SetNumberField(TEXT("value"), FMath::Clamp(ThumbIndexDistanceCm, 0.0f, 50.0f));
    Event->SetStringField(TEXT("unit"), TEXT("cm"));
    TArray<TSharedPtr<FJsonObject>> Events;
    Events.Add(Event);
    SendEvents(Events);
}

void UClinicalVRTelemetryComponent::SetEyeGazeConsent(bool bConsentGiven)
{
    bEyeGazeConsentProvided = bEnableEyeGazeTelemetry && bConsentGiven;
    if (bEyeGazeConsentProvided && GetWorld())
    {
        if (APlayerController* PlayerController = GetWorld()->GetFirstPlayerController())
            UEyeTrackerFunctionLibrary::SetEyeTrackedPlayer(PlayerController);
    }
    else
    {
        UEyeTrackerFunctionLibrary::SetEyeTrackedPlayer(nullptr);
    }
}

void UClinicalVRTelemetryComponent::PublishNumericEvidence(
    const FString& Type,
    const FString& Label,
    float Value,
    const FString& Unit)
{
    TSharedPtr<FJsonObject> Event = MakeShared<FJsonObject>();
    Event->SetStringField(TEXT("type"), Type.Left(60));
    Event->SetStringField(TEXT("label"), Label.Left(120));
    Event->SetNumberField(TEXT("value"), Value);
    Event->SetStringField(TEXT("unit"), Unit.Left(32));
    TArray<TSharedPtr<FJsonObject>> Events;
    Events.Add(Event);
    SendEvents(Events);
}

void UClinicalVRTelemetryComponent::SendEvents(const TArray<TSharedPtr<FJsonObject>>& Events)
{
    if (PlatformBaseUrl.IsEmpty() || RoomName.IsEmpty() || DeviceToken.IsEmpty() || Events.IsEmpty()) return;

    TArray<TSharedPtr<FJsonValue>> EventValues;
    for (const TSharedPtr<FJsonObject>& Event : Events)
    {
        EventValues.Add(MakeShared<FJsonValueObject>(Event));
    }

    TSharedPtr<FJsonObject> Payload = MakeShared<FJsonObject>();
    Payload->SetStringField(TEXT("roomName"), RoomName);
    Payload->SetArrayField(TEXT("telemetry"), EventValues);

    FString Body;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Body);
    FJsonSerializer::Serialize(Payload.ToSharedRef(), Writer);

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(PlatformBaseUrl + TEXT("/api/supervision/vr-telemetry"));
    Request->SetVerb(TEXT("POST"));
    Request->SetHeader(TEXT("Authorization"), TEXT("Bearer ") + DeviceToken);
    Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
    Request->SetContentAsString(Body);
    Request->ProcessRequest();
}
