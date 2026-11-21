#include "ClinicalVRPawn.h"
#include "ClinicalVRTelemetryComponent.h"

#include "Camera/CameraComponent.h"
#include "Components/SceneComponent.h"
#include "Components/WidgetInteractionComponent.h"
#include "InputCoreTypes.h"
#include "HeadMountedDisplayFunctionLibrary.h"
#include "HeadMountedDisplayTypes.h"
#include "MotionControllerComponent.h"

AClinicalVRPawn::AClinicalVRPawn()
{
    PrimaryActorTick.bCanEverTick = true;
    AutoPossessPlayer = EAutoReceiveInput::Player0;

    VROrigin = CreateDefaultSubobject<USceneComponent>(TEXT("VROrigin"));
    SetRootComponent(VROrigin);

    HeadCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("HeadCamera"));
    HeadCamera->SetupAttachment(VROrigin);
    HeadCamera->bLockToHmd = true;

    LeftController = CreateDefaultSubobject<UMotionControllerComponent>(TEXT("LeftController"));
    LeftController->SetupAttachment(VROrigin);
    LeftController->MotionSource = FName("Left");

    RightController = CreateDefaultSubobject<UMotionControllerComponent>(TEXT("RightController"));
    RightController->SetupAttachment(VROrigin);
    RightController->MotionSource = FName("Right");

    LeftPointer = CreateDefaultSubobject<UWidgetInteractionComponent>(TEXT("LeftPointer"));
    LeftPointer->SetupAttachment(LeftController);
    LeftPointer->InteractionSource = EWidgetInteractionSource::World;
    LeftPointer->InteractionDistance = 500.0f;
    LeftPointer->PointerIndex = 0;

    RightPointer = CreateDefaultSubobject<UWidgetInteractionComponent>(TEXT("RightPointer"));
    RightPointer->SetupAttachment(RightController);
    RightPointer->InteractionSource = EWidgetInteractionSource::World;
    RightPointer->InteractionDistance = 500.0f;
    RightPointer->PointerIndex = 1;

    LeftHandPointer = CreateDefaultSubobject<UWidgetInteractionComponent>(TEXT("LeftHandPointer"));
    LeftHandPointer->SetupAttachment(VROrigin);
    LeftHandPointer->InteractionSource = EWidgetInteractionSource::World;
    LeftHandPointer->InteractionDistance = 500.0f;
    LeftHandPointer->PointerIndex = 2;
    LeftHandPointer->SetActive(false);

    RightHandPointer = CreateDefaultSubobject<UWidgetInteractionComponent>(TEXT("RightHandPointer"));
    RightHandPointer->SetupAttachment(VROrigin);
    RightHandPointer->InteractionSource = EWidgetInteractionSource::World;
    RightHandPointer->InteractionDistance = 500.0f;
    RightHandPointer->PointerIndex = 3;
    RightHandPointer->SetActive(false);

    Telemetry = CreateDefaultSubobject<UClinicalVRTelemetryComponent>(TEXT("ClinicalVRTelemetry"));
}

void AClinicalVRPawn::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    const auto UpdateHandPointer = [this](
        const EControllerHand Hand,
        UWidgetInteractionComponent* Pointer,
        bool& bWasPinching)
    {
        if (!Pointer) return;

        FXRHandTrackingState HandState;
        UHeadMountedDisplayFunctionLibrary::GetHandTrackingState(
            this, EXRSpaceType::World, Hand, HandState);

        const int32 ThumbTipIndex = static_cast<int32>(EHandKeypoint::ThumbTip);
        const int32 IndexIntermediateIndex = static_cast<int32>(EHandKeypoint::IndexIntermediate);
        const int32 IndexTipIndex = static_cast<int32>(EHandKeypoint::IndexTip);
        const int32 RequiredIndex = FMath::Max(ThumbTipIndex, IndexTipIndex);

        const bool bTracked =
            HandState.bValid &&
            HandState.TrackingStatus != ETrackingStatus::NotTracked &&
            HandState.HandKeyLocations.Num() > FMath::Max(RequiredIndex, IndexIntermediateIndex);

        if (!bTracked)
        {
            if (bWasPinching)
            {
                Pointer->ReleasePointerKey(EKeys::LeftMouseButton);
                bWasPinching = false;
            }
            Pointer->SetActive(false);
            return;
        }

        const FVector ThumbTip = HandState.HandKeyLocations[ThumbTipIndex];
        const FVector IndexIntermediate = HandState.HandKeyLocations[IndexIntermediateIndex];
        const FVector IndexTip = HandState.HandKeyLocations[IndexTipIndex];
        const FVector IndexDirection = (IndexTip - IndexIntermediate).GetSafeNormal();
        if (IndexDirection.IsNearlyZero())
        {
            Pointer->SetActive(false);
            return;
        }

        Pointer->SetWorldLocation(IndexTip);
        Pointer->SetWorldRotation(IndexDirection.Rotation());
        Pointer->SetActive(true);

        const float PinchDistanceCm = FVector::Distance(ThumbTip, IndexTip);
        const bool bIsPinching = PinchDistanceCm <= 3.5f;
        if (bIsPinching && !bWasPinching)
        {
            Pointer->PressPointerKey(EKeys::LeftMouseButton);
        }
        else if (!bIsPinching && bWasPinching)
        {
            Pointer->ReleasePointerKey(EKeys::LeftMouseButton);
        }
        bWasPinching = bIsPinching;
    };

    UpdateHandPointer(EControllerHand::Left, LeftHandPointer, bLeftHandPinching);
    UpdateHandPointer(EControllerHand::Right, RightHandPointer, bRightHandPinching);
}

void AClinicalVRPawn::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);
    if (!PlayerInputComponent) return;

    PlayerInputComponent->BindKey(EKeys::MotionController_Left_Trigger, IE_Pressed, this, &AClinicalVRPawn::PressLeftPointer);
    PlayerInputComponent->BindKey(EKeys::MotionController_Left_Trigger, IE_Released, this, &AClinicalVRPawn::ReleaseLeftPointer);
    PlayerInputComponent->BindKey(EKeys::MotionController_Right_Trigger, IE_Pressed, this, &AClinicalVRPawn::PressRightPointer);
    PlayerInputComponent->BindKey(EKeys::MotionController_Right_Trigger, IE_Released, this, &AClinicalVRPawn::ReleaseRightPointer);
    PlayerInputComponent->BindKey(EKeys::Enter, IE_Pressed, this, &AClinicalVRPawn::PressRightPointer);
    PlayerInputComponent->BindKey(EKeys::Enter, IE_Released, this, &AClinicalVRPawn::ReleaseRightPointer);
}

void AClinicalVRPawn::PressLeftPointer()
{
    if (LeftPointer) LeftPointer->PressPointerKey(EKeys::LeftMouseButton);
}

void AClinicalVRPawn::ReleaseLeftPointer()
{
    if (LeftPointer) LeftPointer->ReleasePointerKey(EKeys::LeftMouseButton);
}

void AClinicalVRPawn::PressRightPointer()
{
    if (RightPointer) RightPointer->PressPointerKey(EKeys::LeftMouseButton);
}

void AClinicalVRPawn::ReleaseRightPointer()
{
    if (RightPointer) RightPointer->ReleasePointerKey(EKeys::LeftMouseButton);
}
