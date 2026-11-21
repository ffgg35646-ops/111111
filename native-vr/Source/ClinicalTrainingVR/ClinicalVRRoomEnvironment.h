#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ClinicalVRRoomEnvironment.generated.h"

class USceneComponent;
class UStaticMeshComponent;
class USkeletalMesh;
class USkeletalMeshComponent;
class UAnimInstance;

UCLASS()
class CLINICALTRAININGVR_API AClinicalVRRoomEnvironment : public AActor
{
    GENERATED_BODY()

public:
    AClinicalVRRoomEnvironment();
    virtual void BeginPlay() override;
    USceneComponent* GetPatientGazeTarget() const { return PatientGazeTarget; }

protected:
    UPROPERTY(VisibleAnywhere, Category = "Clinical Room")
    TObjectPtr<USceneComponent> SceneRoot;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room|Patient")
    TObjectPtr<USceneComponent> PatientAnchor;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room|Patient")
    TObjectPtr<USceneComponent> PatientGazeTarget;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room|Patient")
    TObjectPtr<USkeletalMeshComponent> PatientCharacter;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Clinical Room|Patient")
    TObjectPtr<USkeletalMesh> PatientSkeletalMeshAsset;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Clinical Room|Patient")
    TSubclassOf<UAnimInstance> PatientAnimationClass;

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
