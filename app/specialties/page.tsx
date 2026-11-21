import { Suspense } from "react";
import SpecialistTrainingHub from "@/components/specialist-training-hub";
import "./specialties.css";

export default function SpecialistTrainingPage() {
  return <Suspense fallback={<main className="specialist-loading">جارٍ تجهيز مركز التدريب التخصصي...</main>}>
    <SpecialistTrainingHub />
  </Suspense>;
}
