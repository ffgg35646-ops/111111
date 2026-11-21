#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ClinicalVRRoomEnvironment.generated.h"

class USceneComponent;
class UStaticMeshComponent;

UCLASS()
class CLINICALTRAININGVR_API AClinicalVRRoomEnvironment : public AActor
{
    GENERATED_BODY()

public:
    AClinicalVRRoomEnvironment();

protected:
    UPROPERTY(VisibleAnywhere, Category = "Clinical Room")
    TObjectPtr<USceneComponent> SceneRoot;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room")
    TObjectPtr<UStaticMeshComponent> Floor;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room")
    TObjectPtr<UStaticMeshComponent> BackWall;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room")
    TObjectPtr<UStaticMeshComponent> LeftWall;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room")
    TObjectPtr<UStaticMeshComponent> RightWall;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room")
    TObjectPtr<UStaticMeshComponent> InterviewDesk;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room")
    TObjectPtr<UStaticMeshComponent> PatientBody;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room")
    TObjectPtr<UStaticMeshComponent> PatientHead;
};
