#include "ClinicalVRGameMode.h"

#include "ClinicalVRPawn.h"
#include "ClinicalVRRoomEnvironment.h"
#include "Engine/World.h"

AClinicalVRGameMode::AClinicalVRGameMode()
{
    DefaultPawnClass = AClinicalVRPawn::StaticClass();
}

void AClinicalVRGameMode::BeginPlay()
{
    Super::BeginPlay();

    if (UWorld* World = GetWorld())
    {
        World->SpawnActor<AClinicalVRRoomEnvironment>(AClinicalVRRoomEnvironment::StaticClass(), FTransform::Identity);
    }
}
