#include "ClinicalVRPawn.h"

#include "Camera/CameraComponent.h"
#include "Components/SceneComponent.h"
#include "Components/WidgetInteractionComponent.h"
#include "InputCoreTypes.h"
#include "MotionControllerComponent.h"

AClinicalVRPawn::AClinicalVRPawn()
{
    PrimaryActorTick.bCanEverTick = false;
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
