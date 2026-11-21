#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "ClinicalVRTelemetryComponent.generated.h"

class AActor;
class FJsonObject;
class USceneComponent;

UCLASS(ClassGroup=(ClinicalVR), meta=(BlueprintSpawnableComponent))
class CLINICALTRAININGVR_API UClinicalVRTelemetryComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UClinicalVRTelemetryComponent();

    UFUNCTION(BlueprintCallable, Category="Clinical VR|Connection")
    void ConfigureTelemetryEndpoint(const FString& InPlatformBaseUrl, const FString& InRoomName, const FString& InDeviceToken);

    UFUNCTION(BlueprintCallable, Category="Clinical VR|Privacy")
    void SetEyeGazeConsent(bool bConsentGiven);

    UFUNCTION(BlueprintCallable, Category="Clinical VR|Telemetry")
    void PublishNumericEvidence(const FString& Type, const FString& Label, float Value, const FString& Unit);

    UFUNCTION(BlueprintCallable, Category="Clinical VR|Telemetry")
    void PublishHandTrackingSample(const FString& Handedness, float ThumbIndexDistanceCm);

    UFUNCTION(BlueprintCallable, Category="Clinical VR|Telemetry")
    void PublishHandPinchInteraction(const FString& Handedness, float ThumbIndexDistanceCm);

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

    UPROPERTY(EditInstanceOnly, BlueprintReadWrite, Category="Clinical VR|Assessment")
    TObjectPtr<USceneComponent> PatientTargetComponent;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Clinical VR|Assessment")
    float HeadPoseSampleIntervalSeconds = 5.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Clinical VR|Privacy")
    bool bEnableEyeGazeTelemetry = false;
    bool bEyeGazeConsentProvided = false;

    void PublishHeadPoseSample();
    void SendEvents(const TArray<TSharedPtr<FJsonObject>>& Events);

private:
    TMap<FString, bool> HandPinchingState;
    FString PlatformBaseUrl;
    FString RoomName;
    FString DeviceToken;
    FTimerHandle HeadPoseTimer;
};
