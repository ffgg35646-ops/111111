#include "ClinicalVRRoomEnvironment.h"

#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "UObject/ConstructorHelpers.h"
#include "Engine/SkeletalMesh.h"
#include "Animation/AnimInstance.h"

AClinicalVRRoomEnvironment::AClinicalVRRoomEnvironment()
{
    PrimaryActorTick.bCanEverTick = false;

    SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
    SetRootComponent(SceneRoot);

    PatientAnchor = CreateDefaultSubobject<USceneComponent>(TEXT("PatientAnchor"));
    PatientAnchor->SetupAttachment(SceneRoot);
    PatientAnchor->SetRelativeLocation(FVector(0.0f, 490.0f, 0.0f));
    PatientGazeTarget = CreateDefaultSubobject<USceneComponent>(TEXT("PatientGazeTarget"));
    PatientGazeTarget->SetupAttachment(PatientAnchor);
    PatientGazeTarget->SetRelativeLocation(FVector(0.0f, 0.0f, 160.0f));
    PatientCharacter = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("PatientCharacter"));
    PatientCharacter->SetupAttachment(PatientAnchor);
    PatientCharacter->SetRelativeRotation(FRotator(0.0f, -90.0f, 0.0f));

    Floor = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Floor"));
    Floor->SetupAttachment(SceneRoot);
    BackWall = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BackWall"));
    BackWall->SetupAttachment(SceneRoot);
    LeftWall = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("LeftWall"));
    LeftWall->SetupAttachment(SceneRoot);
    RightWall = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("RightWall"));
    RightWall->SetupAttachment(SceneRoot);
    InterviewDesk = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("InterviewDesk"));
    InterviewDesk->SetupAttachment(SceneRoot);
    PatientBody = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PatientBodyPlaceholder"));
    PatientBody->SetupAttachment(PatientAnchor);
    PatientHead = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PatientHeadPlaceholder"));
    PatientHead->SetupAttachment(PatientAnchor);

    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
    static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereMesh(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
    if (CubeMesh.Succeeded())
    {
        Floor->SetStaticMesh(CubeMesh.Object);
        BackWall->SetStaticMesh(CubeMesh.Object);
        LeftWall->SetStaticMesh(CubeMesh.Object);
        RightWall->SetStaticMesh(CubeMesh.Object);
        InterviewDesk->SetStaticMesh(CubeMesh.Object);
        PatientBody->SetStaticMesh(CubeMesh.Object);
    }
    if (SphereMesh.Succeeded())
    {
        PatientHead->SetStaticMesh(SphereMesh.Object);
    }

    Floor->SetRelativeLocation(FVector(0.0f, 0.0f, -12.0f));
    Floor->SetRelativeScale3D(FVector(8.0f, 8.0f, 0.12f));

    BackWall->SetRelativeLocation(FVector(0.0f, 800.0f, 250.0f));
    BackWall->SetRelativeScale3D(FVector(8.0f, 0.12f, 2.5f));

    LeftWall->SetRelativeLocation(FVector(-800.0f, 0.0f, 250.0f));
    LeftWall->SetRelativeScale3D(FVector(0.12f, 8.0f, 2.5f));

    RightWall->SetRelativeLocation(FVector(800.0f, 0.0f, 250.0f));
    RightWall->SetRelativeScale3D(FVector(0.12f, 8.0f, 2.5f));

    InterviewDesk->SetRelativeLocation(FVector(0.0f, 240.0f, 85.0f));
    InterviewDesk->SetRelativeScale3D(FVector(180.0f, 75.0f, 8.0f));

    PatientBody->SetRelativeLocation(FVector(0.0f, 0.0f, 100.0f));
    PatientBody->SetRelativeScale3D(FVector(0.65f, 0.35f, 1.2f));

    PatientHead->SetRelativeLocation(FVector(0.0f, -5.0f, 235.0f));
    PatientHead->SetRelativeScale3D(FVector(0.42f, 0.42f, 0.42f));
}


void AClinicalVRRoomEnvironment::BeginPlay()
{
    Super::BeginPlay();
    if (PatientSkeletalMeshAsset && PatientCharacter)
    {
        PatientCharacter->SetSkeletalMesh(PatientSkeletalMeshAsset);
        if (PatientAnimationClass) PatientCharacter->SetAnimInstanceClass(PatientAnimationClass);
        PatientBody->SetHiddenInGame(true, true);
        PatientHead->SetHiddenInGame(true, true);
    }
}
