#include "ClinicalVRRoomEnvironment.h"

#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Engine/World.h"
#include "UObject/ConstructorHelpers.h"
#include "Engine/SkeletalMesh.h"
#include "Animation/AnimInstance.h"

AClinicalVRRoomEnvironment::AClinicalVRRoomEnvironment()
{
    PrimaryActorTick.bCanEverTick = false;

    SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
    SetRootComponent(SceneRoot);

    DoctorAnchor = CreateDefaultSubobject<USceneComponent>(TEXT("DoctorAnchor"));
    DoctorAnchor->SetupAttachment(SceneRoot);
    DoctorAnchor->SetRelativeLocation(FVector(0.0f, 490.0f, 0.0f));

    DoctorGazeTarget = CreateDefaultSubobject<USceneComponent>(TEXT("DoctorGazeTarget"));
    DoctorGazeTarget->SetupAttachment(DoctorAnchor);
    DoctorGazeTarget->SetRelativeLocation(FVector(0.0f, 0.0f, 160.0f));

    DoctorCharacter = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("DoctorCharacter"));
    DoctorCharacter->SetupAttachment(DoctorAnchor);
    DoctorCharacter->SetRelativeRotation(FRotator(0.0f, -90.0f, 0.0f));

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

    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
    if (CubeMesh.Succeeded())
    {
        Floor->SetStaticMesh(CubeMesh.Object);
        BackWall->SetStaticMesh(CubeMesh.Object);
        LeftWall->SetStaticMesh(CubeMesh.Object);
        RightWall->SetStaticMesh(CubeMesh.Object);
        InterviewDesk->SetStaticMesh(CubeMesh.Object);
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
}

void AClinicalVRRoomEnvironment::BeginPlay()
{
    Super::BeginPlay();

    if (DoctorCharacterClass && GetWorld())
    {
        FActorSpawnParameters SpawnParameters;
        SpawnParameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
        if (AActor* DoctorActor = GetWorld()->SpawnActor<AActor>(
            DoctorCharacterClass,
            DoctorAnchor->GetComponentTransform(),
            SpawnParameters))
        {
            DoctorActor->AttachToComponent(DoctorAnchor, FAttachmentTransformRules::KeepWorldTransform);
        }
        return;
    }

    if (DoctorSkeletalMeshAsset && DoctorCharacter)
    {
        DoctorCharacter->SetSkeletalMesh(DoctorSkeletalMeshAsset);
        if (DoctorAnimationClass)
        {
            DoctorCharacter->SetAnimInstanceClass(DoctorAnimationClass);
        }
    }
}
