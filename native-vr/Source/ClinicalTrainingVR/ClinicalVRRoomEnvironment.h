#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "ClinicalVRRoomEnvironment.generated.h"

class AActor;
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
    USceneComponent* GetDoctorGazeTarget() const { return DoctorGazeTarget; }

protected:
    UPROPERTY(VisibleAnywhere, Category = "Clinical Room")
    TObjectPtr<USceneComponent> SceneRoot;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room|Virtual Doctor")
    TObjectPtr<USceneComponent> DoctorAnchor;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room|Virtual Doctor")
    TObjectPtr<USceneComponent> DoctorGazeTarget;

    UPROPERTY(VisibleAnywhere, Category = "Clinical Room|Virtual Doctor")
    TObjectPtr<USkeletalMeshComponent> DoctorCharacter;

    // Use a MetaHuman Blueprint class here when the full body + face rig is available.
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Clinical Room|Virtual Doctor")
    TSubclassOf<AActor> DoctorCharacterClass;

    // Optional fallback for a single skeletal-mesh character that is not a MetaHuman Blueprint.
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Clinical Room|Virtual Doctor")
    TObjectPtr<USkeletalMesh> DoctorSkeletalMeshAsset;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Clinical Room|Virtual Doctor")
    TSubclassOf<UAnimInstance> DoctorAnimationClass;

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
};
