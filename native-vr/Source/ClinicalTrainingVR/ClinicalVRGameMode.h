#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "ClinicalVRGameMode.generated.h"

UCLASS()
class CLINICALTRAININGVR_API AClinicalVRGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    AClinicalVRGameMode();
    virtual void BeginPlay() override;
};
