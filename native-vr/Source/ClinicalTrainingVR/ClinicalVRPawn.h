#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "ClinicalVRPawn.generated.h"

class UCameraComponent;
class USceneComponent;
class UMotionControllerComponent;
class UWidgetInteractionComponent;
class UClinicalVRTelemetryComponent;

UCLASS()
class CLINICALTRAININGVR_API AClinicalVRPawn : public APawn
{
    GENERATED_BODY()

public:
    AClinicalVRPawn();

protected:
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
    virtual void Tick(float DeltaSeconds) override;

    void PressLeftPointer();
    void ReleaseLeftPointer();
    void PressRightPointer();
    void ReleaseRightPointer();

    UPROPERTY(VisibleAnywhere, Category = "Clinical VR")
    TObjectPtr<USceneComponent> VROrigin;

    UPROPERTY(VisibleAnywhere, Category = "Clinical VR")
    TObjectPtr<UCameraComponent> HeadCamera;

    UPROPERTY(VisibleAnywhere, Category = "Clinical VR")
    TObjectPtr<UMotionControllerComponent> LeftController;

    UPROPERTY(VisibleAnywhere, Category = "Clinical VR")
    TObjectPtr<UMotionControllerComponent> RightController;

    UPROPERTY(VisibleAnywhere, Category = "Clinical VR")
    TObjectPtr<UWidgetInteractionComponent> LeftPointer;

    UPROPERTY(VisibleAnywhere, Category = "Clinical VR")
    TObjectPtr<UWidgetInteractionComponent> RightPointer;

    UPROPERTY(VisibleAnywhere, Category = "Clinical VR|Hand Interaction")
    TObjectPtr<UWidgetInteractionComponent> LeftHandPointer;

    UPROPERTY(VisibleAnywhere, Category = "Clinical VR|Hand Interaction")
    TObjectPtr<UWidgetInteractionComponent> RightHandPointer;

    bool bLeftHandPinching = false;
    bool bRightHandPinching = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Clinical VR")
    TObjectPtr<UClinicalVRTelemetryComponent> Telemetry;
};
