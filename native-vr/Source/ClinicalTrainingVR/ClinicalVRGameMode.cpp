#include "ClinicalVRGameMode.h"

#include "ClinicalVRPawn.h"
#include "ClinicalVRRoomEnvironment.h"
#include "Engine/World.h"

AClinicalVRGameMode::AClinicalVRGameMode()
{
    DefaultPawnClass = AClinicalVRPawn::StaticClass();
    RoomEnvironmentClass = AClinicalVRRoomEnvironment::StaticClass();
}

void AClinicalVRGameMode::BeginPlay()
{
    Super::BeginPlay();

    if (UWorld* World = GetWorld())
    {
        const TSubclassOf<AClinicalVRRoomEnvironment> EnvironmentClass = RoomEnvironmentClass ? RoomEnvironmentClass : AClinicalVRRoomEnvironment::StaticClass();
        World->SpawnActor<AClinicalVRRoomEnvironment>(EnvironmentClass, FTransform::Identity);
    }
}
