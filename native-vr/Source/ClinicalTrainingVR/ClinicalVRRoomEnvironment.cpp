#include "ClinicalVRRoomEnvironment.h"

#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "UObject/ConstructorHelpers.h"

AClinicalVRRoomEnvironment::AClinicalVRRoomEnvironment()
{
    PrimaryActorTick.bCanEverTick = false;

    SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
    SetRootComponent(SceneRoot);

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
    PatientBody->SetupAttachment(SceneRoot);
    PatientHead = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PatientHeadPlaceholder"));
    PatientHead->SetupAttachment(SceneRoot);

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

    PatientBody->SetRelativeLocation(FVector(0.0f, 490.0f, 100.0f));
    PatientBody->SetRelativeScale3D(FVector(0.65f, 0.35f, 1.2f));

    PatientHead->SetRelativeLocation(FVector(0.0f, 485.0f, 235.0f));
    PatientHead->SetRelativeScale3D(FVector(0.42f, 0.42f, 0.42f));
}
