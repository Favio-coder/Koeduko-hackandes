import { requireThat, validateResult } from "./domain.js";

export function normalizeGrade20(result) {
  validateResult(result);
  return (result.overallScore / result.maxScore) * 20;
}

export function calculateAreaAverage(records) {
  const unique = [];
  const byAssessment = new Map();
  for (const record of records) {
    if (!record.assessmentId) {
      unique.push(record);
      continue;
    }
    const currentIndex = byAssessment.get(record.assessmentId);
    if (currentIndex === undefined) {
      byAssessment.set(record.assessmentId, unique.length);
      unique.push(record);
      continue;
    }
    const current = unique[currentIndex];
    if ((record.gradedAt || "") > (current.gradedAt || "")) {
      unique[currentIndex] = record;
    }
  }
  const graded = unique.filter(
    (record) => record.resultStatus === "graded" && record.result,
  );
  if (!graded.length) {
    return {
      average20: null,
      method: "arithmetic",
      gradedCount: 0,
      pendingCount: unique.length,
      configurationError: null,
    };
  }

  const weightedCount = graded.filter(
    (record) => record.academicWeightPercent != null,
  ).length;
  if (weightedCount > 0 && weightedCount !== graded.length) {
    return {
      average20: null,
      method: "weighted",
      gradedCount: graded.length,
      pendingCount: unique.length - graded.length,
      configurationError:
        "Todas las evaluaciones calificadas del área deben tener un peso académico explícito.",
    };
  }

  if (!weightedCount) {
    const total = graded.reduce(
      (sum, record) => sum + normalizeGrade20(record.result),
      0,
    );
    return {
      average20: total / graded.length,
      method: "arithmetic",
      gradedCount: graded.length,
      pendingCount: unique.length - graded.length,
      configurationError: null,
    };
  }

  requireThat(
    graded.every(
      (record) =>
        Number.isFinite(record.academicWeightPercent) &&
        record.academicWeightPercent > 0 &&
        record.academicWeightPercent <= 100,
    ),
    "Cada peso académico debe ser mayor que 0 y hasta 100%.",
    409,
  );
  const totalWeight = graded.reduce(
    (sum, record) => sum + record.academicWeightPercent,
    0,
  );
  requireThat(
    Number.isFinite(totalWeight) && totalWeight > 0,
    "La ponderación académica debe sumar un valor positivo.",
    409,
  );
  const weightedTotal = graded.reduce(
    (sum, record) =>
      sum +
      normalizeGrade20(record.result) * record.academicWeightPercent,
    0,
  );
  return {
    average20: weightedTotal / totalWeight,
    method: "weighted",
    gradedCount: graded.length,
    pendingCount: unique.length - graded.length,
    configurationError: null,
  };
}
